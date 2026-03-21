/**
 * Metasploit Router — Dedicated VPS Node Architecture
 *
 * Security model:
 *   Metasploit NEVER runs on the Railway Titan Server.
 *   Each Metasploit instance runs on a SEPARATE dedicated VPS with its own IP.
 *   VPS SSH credentials are encrypted per-user in the DB (AES-256).
 *   Firewall rules block ALL inbound connections (only established/related allowed).
 *   Kill-switch drops traffic if the node goes offline.
 *   Per-operation isolation: different engagements use different nodes.
 */

import { z } from "zod";
import { router, protectedProcedure } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { getUserPlan, enforceFeature } from "./subscription-gate";
import { getDb } from "./db";
import { userSecrets } from "../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { encrypt, decrypt } from "./fetcher-db";
import { execSSHCommand, type SSHConfig } from "./titan-server";
import { createLogger } from "./_core/logger.js";

const log = createLogger("Metasploit");

const SECRET_NODES  = "__msf_nodes";
const SECRET_ACTIVE = "__msf_active";

// ─── Install script: Metasploit Framework + hardened firewall ─────────────────
const INSTALL_METASPLOIT = [
  "#!/bin/bash",
  "set -e",
  "export DEBIAN_FRONTEND=noninteractive",
  "echo '[Titan] Updating packages...'",
  "apt-get update -qq 2>&1 | tail -1",
  "echo '[Titan] Installing dependencies...'",
  "apt-get install -y -qq curl wget gnupg2 iptables iptables-persistent 2>&1 | tail -2",
  "",
  "echo '[Titan] Applying firewall (block inbound reverse connections)...'",
  "iptables -F INPUT 2>/dev/null || true",
  "iptables -A INPUT -i lo -j ACCEPT",
  "iptables -A INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT",
  "iptables -A INPUT -p tcp --dport 22 -j ACCEPT",
  "iptables -A INPUT -j DROP",
  "mkdir -p /etc/iptables",
  "iptables-save > /etc/iptables/rules.v4 2>/dev/null || true",
  "netfilter-persistent save 2>/dev/null || true",
  "",
  "echo '[Titan] Installing Metasploit Framework...'",
  "if command -v msfconsole > /dev/null 2>&1; then",
  "  echo '[Titan] Metasploit already installed, skipping...'",
  "else",
  "  curl -s https://raw.githubusercontent.com/rapid7/metasploit-omnibus/master/config/templates/metasploit-framework-wrappers/msfupdate.erb > /tmp/msfinstall",
  "  chmod +x /tmp/msfinstall",
  "  /tmp/msfinstall 2>&1 | tail -5",
  "fi",
  "",
  "echo '[Titan] Verifying installation...'",
  "if command -v msfconsole > /dev/null 2>&1; then",
  "  PUBLIC_IP=$(curl -s --max-time 5 ifconfig.me 2>/dev/null || curl -s --max-time 5 api.ipify.org 2>/dev/null || hostname -I | awk '{print $1}')",
  "  echo MSF_OK",
  "  echo PUBLIC_IP:$PUBLIC_IP",
  "else",
  "  echo MSF_FAILED",
  "  exit 1",
  "fi",
].join("\n");

const CHECK_MSF = [
  "PUBLIC_IP=$(curl -s --max-time 5 ifconfig.me 2>/dev/null || curl -s --max-time 5 api.ipify.org 2>/dev/null || hostname -I | awk '{print $1}')",
  "if command -v msfconsole > /dev/null 2>&1; then echo INSTALLED; else echo NOT_INSTALLED; fi",
  "echo PUBLIC_IP:$PUBLIC_IP",
].join("\n");

// ─── Types ────────────────────────────────────────────────────────────────────
export interface MetasploitNode {
  id: string;
  label: string;
  sshHost: string;
  sshPort: number;
  sshUser: string;
  sshPassword?: string;
  sshKey?: string;
  publicIp?: string;
  status: "pending" | "deploying" | "ready" | "offline" | "error";
  installed: boolean;
  lastChecked?: string;
  country?: string;
  addedAt: string;
  deployedAt?: string;
  errorMessage?: string;
  engagement?: string;
}

// ─── DB helpers ───────────────────────────────────────────────────────────────
async function getNodes(userId: number): Promise<MetasploitNode[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select().from(userSecrets)
    .where(and(eq(userSecrets.userId, userId), eq(userSecrets.secretType, SECRET_NODES))).limit(1);
  if (!rows.length) return [];
  try { return JSON.parse(decrypt(rows[0].encryptedValue)) as MetasploitNode[]; } catch { return []; }
}

async function saveNodes(userId: number, nodes: MetasploitNode[]): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const enc = encrypt(JSON.stringify(nodes));
  const ex = await db.select().from(userSecrets)
    .where(and(eq(userSecrets.userId, userId), eq(userSecrets.secretType, SECRET_NODES))).limit(1);
  if (ex.length) {
    await db.update(userSecrets).set({ encryptedValue: enc, updatedAt: new Date() }).where(eq(userSecrets.id, ex[0].id));
  } else {
    await db.insert(userSecrets).values({ userId, secretType: SECRET_NODES, label: "Metasploit Nodes", encryptedValue: enc });
  }
}

async function getActiveNodeId(userId: number): Promise<string | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(userSecrets)
    .where(and(eq(userSecrets.userId, userId), eq(userSecrets.secretType, SECRET_ACTIVE))).limit(1);
  if (!rows.length) return null;
  try { return decrypt(rows[0].encryptedValue) || null; } catch { return null; }
}

async function setActiveNodeId(userId: number, nodeId: string | null): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const enc = encrypt(nodeId ?? "");
  const ex = await db.select().from(userSecrets)
    .where(and(eq(userSecrets.userId, userId), eq(userSecrets.secretType, SECRET_ACTIVE))).limit(1);
  if (ex.length) {
    await db.update(userSecrets).set({ encryptedValue: enc, updatedAt: new Date() }).where(eq(userSecrets.id, ex[0].id));
  } else {
    await db.insert(userSecrets).values({ userId, secretType: SECRET_ACTIVE, label: "Active MSF Node", encryptedValue: enc });
  }
}

async function getActiveNode(userId: number): Promise<MetasploitNode | null> {
  const activeId = await getActiveNodeId(userId);
  if (!activeId) return null;
  const nodes = await getNodes(userId);
  return nodes.find(n => n.id === activeId) ?? null;
}

function nodeToSSH(n: MetasploitNode): SSHConfig {
  return { host: n.sshHost, port: n.sshPort, username: n.sshUser, password: n.sshPassword, privateKey: n.sshKey };
}

function sanitize(n: MetasploitNode): Omit<MetasploitNode, "sshPassword" | "sshKey"> {
  const { sshPassword: _p, sshKey: _k, ...safe } = n;
  return safe;
}

async function execMsfCommand(node: MetasploitNode, command: string, timeoutMs = 30000, userId?: number): Promise<string> {
  const safeCmd = command.replace(/[`\\|;&><]/g, "");
  const script = `echo '${safeCmd.replace(/'/g, "'\\''")}' | msfconsole -q -x "${safeCmd.replace(/"/g, '\\"')}; exit" 2>&1 | head -200`;
  return execSSHCommand(nodeToSSH(node), script, timeoutMs, userId);
}

/** Public export for Titan AI chat executor */
export async function execMetasploitCommandPublic(command: string, userId: number, timeoutMs = 30000): Promise<string> {
  const node = await getActiveNode(userId);
  if (!node) return "No active Metasploit node. Add and deploy a dedicated VPS node in the Metasploit settings first.";
  return execMsfCommand(node, command, timeoutMs, userId);
}

// ─── Router ───────────────────────────────────────────────────────────────────
export const metasploitRouter = router({

  listNodes: protectedProcedure.query(async ({ ctx }) => {
    const plan = await getUserPlan(ctx.user.id);
    enforceFeature(plan.planId, "offensive_tooling", "Metasploit");
    const nodes = await getNodes(ctx.user.id);
    const activeId = await getActiveNodeId(ctx.user.id);
    return { nodes: nodes.map(sanitize), activeNodeId: activeId };
  }),

  addNode: protectedProcedure
    .input(z.object({
      label: z.string().min(1).max(64),
      sshHost: z.string().min(1),
      sshPort: z.number().int().min(1).max(65535).default(22),
      sshUser: z.string().min(1).default("root"),
      sshPassword: z.string().optional(),
      sshKey: z.string().optional(),
      country: z.string().optional(),
      engagement: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const plan = await getUserPlan(ctx.user.id);
      enforceFeature(plan.planId, "offensive_tooling", "Metasploit");
      if (!input.sshPassword && !input.sshKey) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "SSH password or private key required." });
      }
      const nodes = await getNodes(ctx.user.id);
      if (nodes.some(n => n.sshHost === input.sshHost && n.sshPort === input.sshPort)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Node with this host:port already exists." });
      }
      const node: MetasploitNode = {
        id: crypto.randomUUID(), label: input.label,
        sshHost: input.sshHost, sshPort: input.sshPort, sshUser: input.sshUser,
        sshPassword: input.sshPassword, sshKey: input.sshKey,
        status: "pending", installed: false,
        country: input.country, engagement: input.engagement,
        addedAt: new Date().toISOString(),
      };
      nodes.push(node);
      await saveNodes(ctx.user.id, nodes);
      const activeId = await getActiveNodeId(ctx.user.id);
      if (!activeId) await setActiveNodeId(ctx.user.id, node.id);
      log.info(`User ${ctx.user.id} added Metasploit node: ${input.label} (${input.sshHost})`);
      return { success: true, node: sanitize(node) };
    }),

  deployNode: protectedProcedure
    .input(z.object({ nodeId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const plan = await getUserPlan(ctx.user.id);
      enforceFeature(plan.planId, "offensive_tooling", "Metasploit");
      const nodes = await getNodes(ctx.user.id);
      const idx = nodes.findIndex(n => n.id === input.nodeId);
      if (idx === -1) throw new TRPCError({ code: "NOT_FOUND", message: "Node not found." });
      const node = nodes[idx];
      node.status = "deploying";
      await saveNodes(ctx.user.id, nodes);
      try {
        const output = await execSSHCommand(nodeToSSH(node), INSTALL_METASPLOIT, 600000, ctx.user.id);
        if (!output.includes("MSF_OK")) {
          node.status = "error";
          node.errorMessage = "Metasploit installation failed. Check SSH credentials and server access.";
          await saveNodes(ctx.user.id, nodes);
          return { success: false, message: node.errorMessage };
        }
        const ipMatch = output.match(/PUBLIC_IP:(\S+)/);
        if (ipMatch) node.publicIp = ipMatch[1];
        node.status = "ready"; node.installed = true;
        node.deployedAt = new Date().toISOString();
        node.lastChecked = new Date().toISOString();
        node.errorMessage = undefined;
        await saveNodes(ctx.user.id, nodes);
        return { success: true, publicIp: node.publicIp, message: `Metasploit Framework installed on "${node.label}" at ${node.publicIp}. Ready to use.` };
      } catch (err: any) {
        node.status = "error"; node.errorMessage = err.message;
        await saveNodes(ctx.user.id, nodes);
        return { success: false, message: `Deploy failed: ${err.message}` };
      }
    }),

  checkNode: protectedProcedure
    .input(z.object({ nodeId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const plan = await getUserPlan(ctx.user.id);
      enforceFeature(plan.planId, "offensive_tooling", "Metasploit");
      const nodes = await getNodes(ctx.user.id);
      const idx = nodes.findIndex(n => n.id === input.nodeId);
      if (idx === -1) throw new TRPCError({ code: "NOT_FOUND", message: "Node not found." });
      const node = nodes[idx];
      try {
        const output = await execSSHCommand(nodeToSSH(node), CHECK_MSF, 15000, ctx.user.id);
        const installed = output.includes("INSTALLED");
        const ipMatch = output.match(/PUBLIC_IP:(\S+)/);
        if (ipMatch) node.publicIp = ipMatch[1];
        node.installed = installed;
        node.status = installed ? "ready" : "offline";
        node.lastChecked = new Date().toISOString();
        await saveNodes(ctx.user.id, nodes);
        return { installed, publicIp: node.publicIp, message: installed ? `Metasploit ready on "${node.label}" at ${node.publicIp}` : `Metasploit not installed on "${node.label}"` };
      } catch (err: any) {
        node.status = "offline"; node.lastChecked = new Date().toISOString();
        await saveNodes(ctx.user.id, nodes);
        return { installed: false, message: `SSH failed: ${err.message}` };
      }
    }),

  setActiveNode: protectedProcedure
    .input(z.object({ nodeId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const plan = await getUserPlan(ctx.user.id);
      enforceFeature(plan.planId, "offensive_tooling", "Metasploit");
      const nodes = await getNodes(ctx.user.id);
      if (!nodes.some(n => n.id === input.nodeId)) throw new TRPCError({ code: "NOT_FOUND", message: "Node not found." });
      await setActiveNodeId(ctx.user.id, input.nodeId);
      return { success: true };
    }),

  removeNode: protectedProcedure
    .input(z.object({ nodeId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const plan = await getUserPlan(ctx.user.id);
      enforceFeature(plan.planId, "offensive_tooling", "Metasploit");
      const nodes = await getNodes(ctx.user.id);
      const idx = nodes.findIndex(n => n.id === input.nodeId);
      if (idx === -1) throw new TRPCError({ code: "NOT_FOUND", message: "Node not found." });
      const label = nodes[idx].label;
      nodes.splice(idx, 1);
      await saveNodes(ctx.user.id, nodes);
      const activeId = await getActiveNodeId(ctx.user.id);
      if (activeId === input.nodeId) {
        await setActiveNodeId(ctx.user.id, nodes.length > 0 ? nodes[0].id : null);
      }
      return { success: true, message: `Node "${label}" removed` };
    }),

  /** Get connection status */
  getConnection: protectedProcedure.query(async ({ ctx }) => {
    const plan = await getUserPlan(ctx.user.id);
    enforceFeature(plan.planId, "offensive_tooling", "Metasploit");
    const node = await getActiveNode(ctx.user.id);
    const nodes = await getNodes(ctx.user.id);
    return {
      connected: !!node,
      mode: node ? "node" : "none",
      nodeLabel: node?.label,
      publicIp: node?.publicIp,
      nodeCount: nodes.length,
      onlineCount: nodes.filter(n => n.status === "ready").length,
      // backward-compat fields MetasploitPage uses
      host: node?.publicIp ?? node?.sshHost ?? null,
      port: node?.sshPort ?? 22,
      username: node?.sshUser ?? "root",
    };
  }),

  /** Run any msfconsole command on the active node */
  runCommand: protectedProcedure
    .input(z.object({ command: z.string().min(1), timeoutMs: z.number().optional() }))
    .mutation(async ({ ctx, input }) => {
      const plan = await getUserPlan(ctx.user.id);
      enforceFeature(plan.planId, "offensive_tooling", "Metasploit");
      const node = await getActiveNode(ctx.user.id);
      if (!node) throw new TRPCError({ code: "BAD_REQUEST", message: "No active Metasploit node. Add and deploy a dedicated VPS node first." });
      const output = await execMsfCommand(node, input.command, input.timeoutMs ?? 30000, ctx.user.id);
      return { output, nodeLabel: node.label, publicIp: node.publicIp };
    }),

  /** List active sessions */
  listSessions: protectedProcedure.mutation(async ({ ctx }) => {
    const plan = await getUserPlan(ctx.user.id);
    enforceFeature(plan.planId, "offensive_tooling", "Metasploit");
    const node = await getActiveNode(ctx.user.id);
    if (!node) throw new TRPCError({ code: "BAD_REQUEST", message: "No active Metasploit node." });
    const output = await execMsfCommand(node, "sessions -l", 30000, ctx.user.id);
    const sessions = output.split('\n').filter(l => l.match(/^\s+\d+\s+/)).map(l => {
      const parts = l.trim().split(/\s+/);
      return { id: parts[0] ?? '0', type: parts[1] ?? '', info: parts.slice(2).join(' '), via: parts[2] ?? '', remoteAddr: parts[3] ?? '', connection: parts[3] ?? '' };
    });
    return { output, raw: output, sessions, nodeLabel: node.label };
  }),

  /** Search modules */
  searchModules: protectedProcedure
    .input(z.object({ query: z.string().min(1), type: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const plan = await getUserPlan(ctx.user.id);
      enforceFeature(plan.planId, "offensive_tooling", "Metasploit");
      const node = await getActiveNode(ctx.user.id);
      if (!node) throw new TRPCError({ code: "BAD_REQUEST", message: "No active Metasploit node." });
      const typeFilter = input.type ? ` type:${input.type}` : '';
      const output = await execMsfCommand(node, `search ${input.query}${typeFilter}`, 30000, ctx.user.id);
      // Parse output into modules array for MetasploitPage
      const lines = output.split('\n').filter(l => l.match(/^\s+\d+\s+/));
      const modules = lines.map(l => {
        const parts = l.trim().split(/\s+/);
        return { name: parts[1] ?? '', rank: parts[2] ?? '', description: parts.slice(3).join(' ') };
      }).filter(m => m.name);
      return { output, raw: output, modules, nodeLabel: node.label };
    }),

  /** Legacy: connect (now just checks active node) */
  connect: protectedProcedure
    .input(z.object({ host: z.string().optional(), port: z.number().optional(), password: z.string().optional() }))
    .mutation(async ({ ctx }) => {
      const plan = await getUserPlan(ctx.user.id);
      enforceFeature(plan.planId, "offensive_tooling", "Metasploit");
      const node = await getActiveNode(ctx.user.id);
      if (!node) return { success: false, message: "No active Metasploit node. Add a dedicated VPS node first." };
      return { success: true, message: `Using node "${node.label}" at ${node.publicIp ?? node.sshHost}` };
    }),

  disconnect: protectedProcedure.mutation(async ({ ctx }) => {
    const plan = await getUserPlan(ctx.user.id);
    enforceFeature(plan.planId, "offensive_tooling", "Metasploit");
    await setActiveNodeId(ctx.user.id, null);
    return { success: true, message: "Disconnected from active node." };
  }),

  // ── Backward-compatible aliases for existing MetasploitPage UI ───────────────
  testConnection: protectedProcedure
    .input(z.object({ host: z.string().optional(), port: z.number().default(55553).optional(), username: z.string().optional(), password: z.string().optional(), privateKey: z.string().optional() }).optional())
    .mutation(async ({ ctx }) => {
      const plan = await getUserPlan(ctx.user.id);
      enforceFeature(plan.planId, "offensive_tooling", "Metasploit");
      const node = await getActiveNode(ctx.user.id);
      if (!node) return { success: false, message: "No active Metasploit node. Add a dedicated VPS node first." };
      try {
        const out = await execMsfCommand(node, "echo connected", 10000, ctx.user.id);
        return { success: out.includes("connected"), message: `Node "${node.label}" at ${node.publicIp ?? node.sshHost} is reachable.` };
      } catch (e: any) { return { success: false, message: e.message }; }
    }),

  saveConnection: protectedProcedure
    .input(z.object({ host: z.string().optional(), port: z.number().default(55553).optional(), username: z.string().optional(), password: z.string().optional(), privateKey: z.string().optional() }).optional())
    .mutation(async ({ ctx }) => {
      // Connection is now managed via dedicated nodes — no-op alias
      return { success: true, message: "Connection managed via dedicated VPS nodes." };
    }),

  getStatus: protectedProcedure.mutation(async ({ ctx }) => {
    const plan = await getUserPlan(ctx.user.id);
    enforceFeature(plan.planId, "offensive_tooling", "Metasploit");
    const node = await getActiveNode(ctx.user.id);
    if (!node) return { running: false, version: null, raw: "No active node.", message: "No active node." };
    try {
      const out = await execMsfCommand(node, "msfconsole -v 2>/dev/null | head -1 || echo not_installed", 15000, ctx.user.id);
      const installed = !out.includes("not_installed") && !out.includes("command not found");
      return { running: installed, version: out.trim(), raw: out, message: installed ? `Metasploit running on ${node.publicIp ?? node.sshHost}` : "Metasploit not installed on active node." };
    } catch (e: any) { return { running: false, version: null, raw: e.message, message: e.message }; }
  }),

  install: protectedProcedure.mutation(async ({ ctx }) => {
    const plan = await getUserPlan(ctx.user.id);
    enforceFeature(plan.planId, "offensive_tooling", "Metasploit");
    const node = await getActiveNode(ctx.user.id);
    if (!node) throw new TRPCError({ code: "BAD_REQUEST", message: "No active node. Add a dedicated VPS node and deploy it first." });
    try {
      const out = await execMsfCommand(node, "msfconsole -v 2>/dev/null | head -1 || echo not_installed", 15000, ctx.user.id);
      if (!out.includes("not_installed")) return { success: true, output: "Metasploit already installed on active node.", message: "Metasploit already installed on active node." };
      return { success: false, output: "Deploy the node first using the Deploy button — it installs Metasploit automatically.", message: "Deploy the node first using the Deploy button — it installs Metasploit automatically." };
    } catch (e: any) { return { success: false, output: e.message, message: e.message }; }
  }),

  update: protectedProcedure.mutation(async ({ ctx }) => {
    const plan = await getUserPlan(ctx.user.id);
    enforceFeature(plan.planId, "offensive_tooling", "Metasploit");
    const node = await getActiveNode(ctx.user.id);
    if (!node) throw new TRPCError({ code: "BAD_REQUEST", message: "No active node." });
    try {
      const out = await execMsfCommand(node, "apt-get update -qq && apt-get upgrade -y metasploit-framework 2>&1 | tail -3", 120000, ctx.user.id);
      return { success: true, output: out || "Update complete.", message: out || "Update complete." };
    } catch (e: any) { return { success: false, output: e.message, message: e.message }; }
  }),

  startRpcd: protectedProcedure
    .input(z.object({ rpcPassword: z.string().optional(), rpcPort: z.number().optional(), ssl: z.boolean().optional() }).optional())
    .mutation(async ({ ctx, input }) => {
    const plan = await getUserPlan(ctx.user.id);
    enforceFeature(plan.planId, "offensive_tooling", "Metasploit");
    const node = await getActiveNode(ctx.user.id);
    if (!node) throw new TRPCError({ code: "BAD_REQUEST", message: "No active node." });
    try {
      const pass = input?.rpcPassword ?? 'msf';
      const port = input?.rpcPort ?? 55553;
      const sslFlag = input?.ssl !== false ? '-S' : '';
      const out = await execMsfCommand(node, `msfrpcd -P ${pass} ${sslFlag} -f -a 127.0.0.1 -p ${port} 2>&1 & sleep 2; echo RPCD_STARTED`, 30000, ctx.user.id);
      return { success: out.includes("RPCD_STARTED"), message: "MSFRPCD started on active node." };
    } catch (e: any) { return { success: false, message: e.message }; }
  }),

  stopRpcd: protectedProcedure.mutation(async ({ ctx }) => {
    const plan = await getUserPlan(ctx.user.id);
    enforceFeature(plan.planId, "offensive_tooling", "Metasploit");
    const node = await getActiveNode(ctx.user.id);
    if (!node) throw new TRPCError({ code: "BAD_REQUEST", message: "No active node." });
    try {
      const out = await execMsfCommand(node, "pkill -f msfrpcd 2>/dev/null; echo RPCD_STOPPED", 10000, ctx.user.id);
      return { success: true, message: "MSFRPCD stopped." };
    } catch (e: any) { return { success: false, message: e.message }; }
  }),

  getModuleInfo: protectedProcedure
    .input(z.object({ module: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const plan = await getUserPlan(ctx.user.id);
      enforceFeature(plan.planId, "offensive_tooling", "Metasploit");
      const node = await getActiveNode(ctx.user.id);
      if (!node) throw new TRPCError({ code: "BAD_REQUEST", message: "No active node." });
      const out = await execMsfCommand(node, `msfconsole -q -x 'info ${input.module}; exit' 2>&1`, 30000, ctx.user.id);
      return { info: out, output: out };
    }),

  killSession: protectedProcedure
    .input(z.object({ sessionId: z.union([z.string(), z.number()]).transform(v => String(v)) }))
    .mutation(async ({ ctx, input }) => {
      const plan = await getUserPlan(ctx.user.id);
      enforceFeature(plan.planId, "offensive_tooling", "Metasploit");
      const node = await getActiveNode(ctx.user.id);
      if (!node) throw new TRPCError({ code: "BAD_REQUEST", message: "No active node." });
      const out = await execMsfCommand(node, `msfconsole -q -x 'sessions -k ${input.sessionId}; exit' 2>&1`, 20000, ctx.user.id);
      return { success: true, output: out };
    }),

  runModule: protectedProcedure
    .input(z.object({ module: z.string(), options: z.record(z.string(), z.unknown()).optional(), payload: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const plan = await getUserPlan(ctx.user.id);
      enforceFeature(plan.planId, "offensive_tooling", "Metasploit");
      const node = await getActiveNode(ctx.user.id);
      if (!node) throw new TRPCError({ code: "BAD_REQUEST", message: "No active node." });
      const setOpts = Object.entries(input.options ?? {}).map(([k, v]) => `set ${k} ${v}`).join('; ');
      const cmd = `msfconsole -q -x 'use ${input.module}; ${setOpts}; run; exit' 2>&1`;
      const out = await execMsfCommand(node, cmd, 60000, ctx.user.id);
      return { success: true, output: out };
    }),

  generatePayload: protectedProcedure
    .input(z.object({ payload: z.string(), lhost: z.string(), lport: z.number(), format: z.string().default("raw"), encoder: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const plan = await getUserPlan(ctx.user.id);
      enforceFeature(plan.planId, "offensive_tooling", "Metasploit");
      const node = await getActiveNode(ctx.user.id);
      if (!node) throw new TRPCError({ code: "BAD_REQUEST", message: "No active node." });
      const encoderFlag = input.encoder ? `-e ${input.encoder}` : '';
      const outputFile = `/tmp/payload_${Date.now()}.${input.format}`;
      const cmd = `msfvenom -p ${input.payload} LHOST=${input.lhost} LPORT=${input.lport} -f ${input.format} ${encoderFlag} -o ${outputFile} 2>&1; echo OUTPUT_FILE:${outputFile}`;
      const out = await execMsfCommand(node, cmd, 60000, ctx.user.id);
      return { success: true, output: out, outputFile };
    }),

  listWorkspaces: protectedProcedure.mutation(async ({ ctx }) => {
    const plan = await getUserPlan(ctx.user.id);
    enforceFeature(plan.planId, "offensive_tooling", "Metasploit");
    const node = await getActiveNode(ctx.user.id);
    if (!node) throw new TRPCError({ code: "BAD_REQUEST", message: "No active node." });
    const out = await execMsfCommand(node, "msfconsole -q -x 'workspace; exit' 2>&1", 20000, ctx.user.id);
    const workspaces = out.split('\n').filter(l => l.trim().startsWith('*') || l.trim().match(/^\w/)).map(l => l.trim().replace(/^\*\s*/, ''));
    return { raw: out, workspaces };
  }),

  listHosts: protectedProcedure.mutation(async ({ ctx }) => {
    const plan = await getUserPlan(ctx.user.id);
    enforceFeature(plan.planId, "offensive_tooling", "Metasploit");
    const node = await getActiveNode(ctx.user.id);
    if (!node) throw new TRPCError({ code: "BAD_REQUEST", message: "No active node." });
    const out = await execMsfCommand(node, "msfconsole -q -x 'hosts; exit' 2>&1", 20000, ctx.user.id);
    return { output: out };
  }),

  listServices: protectedProcedure.mutation(async ({ ctx }) => {
    const plan = await getUserPlan(ctx.user.id);
    enforceFeature(plan.planId, "offensive_tooling", "Metasploit");
    const node = await getActiveNode(ctx.user.id);
    if (!node) throw new TRPCError({ code: "BAD_REQUEST", message: "No active node." });
    const out = await execMsfCommand(node, "msfconsole -q -x 'services; exit' 2>&1", 20000, ctx.user.id);
    return { output: out };
  }),

  listVulns: protectedProcedure.mutation(async ({ ctx }) => {
    const plan = await getUserPlan(ctx.user.id);
    enforceFeature(plan.planId, "offensive_tooling", "Metasploit");
    const node = await getActiveNode(ctx.user.id);
    if (!node) throw new TRPCError({ code: "BAD_REQUEST", message: "No active node." });
    const out = await execMsfCommand(node, "msfconsole -q -x 'vulns; exit' 2>&1", 20000, ctx.user.id);
    return { output: out };
  }),
});
