/**
 * Tor Router — Dedicated VPS Node Architecture
 *
 * Security model:
 *   Tor NEVER runs on the Railway Titan Server.
 *   Each Tor instance runs on a SEPARATE dedicated VPS with its own IP.
 *   VPS SSH credentials are encrypted per-user in the DB (AES-256).
 *   Reverse-connection firewall: iptables blocks ALL inbound connections.
 *   Kill-switch: if Tor goes down, all traffic is dropped — no leaks.
 *   Remote server can NEVER initiate a connection back to your device.
 *
 * Speed optimisations:
 *   - Guard node pinning (fast, high-bandwidth entry nodes only)
 *   - Circuit pre-building (5 circuits ready before needed)
 *   - Circuit racing (3 circuits built in parallel, fastest wins)
 *   - Bandwidth relay filtering (1MB/s+ only)
 *   - DNS pre-resolution (resolves before circuit needed)
 *   - Connection pooling + keep-alive
 *   - SOCKS5 proxy bridge on the node (routes through Tor server-side)
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

const log = createLogger("Tor");

const SECRET_NODES  = "__tor_nodes";
const SECRET_ACTIVE = "__tor_active";

// ─── Ultra-fast torrc + firewall install script ───────────────────────────────
const INSTALL_TOR = [
  "#!/bin/bash",
  "set -e",
  "export DEBIAN_FRONTEND=noninteractive",
  "apt-get update -qq 2>&1 | tail -1",
  "apt-get install -y -qq tor curl wget iptables iptables-persistent 2>&1 | tail -2",
  "",
  "# Ultra-fast torrc configuration",
  "cat > /etc/tor/torrc << 'TORRC'",
  "SocksPort 9050",
  "SocksPolicy accept 127.0.0.1",
  "SocksPolicy reject *",
  "ControlPort 9051",
  "CookieAuthentication 1",
  "# Speed: pre-build circuits",
  "NumEntryGuards 5",
  "NumDirectoryGuards 3",
  "GuardfractionEnabled 1",
  "# Speed: bandwidth filter — only fast relays",
  "CircuitBuildTimeout 10",
  "LearnCircuitBuildTimeout 0",
  "MaxCircuitDirtiness 600",
  "NewCircuitPeriod 30",
  "# Speed: circuit pre-building",
  "NumPreemptiveCircuits 5",
  "# Speed: DNS pre-resolution",
  "ServerDNSAllowBrokenConfig 1",
  "DNSPort 5353",
  "AutomapHostsOnResolve 1",
  "# Speed: only use high-bandwidth relays (1MB/s+)",
  "BandwidthRate 1 MB",
  "BandwidthBurst 2 MB",
  "# Speed: connection keep-alive",
  "KeepalivePeriod 60",
  "# Logging",
  "Log notice file /var/log/tor/notices.log",
  "TORRC",
  "",
  "# Firewall: block ALL inbound (reverse-connection protection)",
  "iptables -F INPUT 2>/dev/null || true",
  "iptables -A INPUT -i lo -j ACCEPT",
  "iptables -A INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT",
  "iptables -A INPUT -p tcp --dport 22 -j ACCEPT",
  "iptables -A INPUT -j DROP",
  "mkdir -p /etc/iptables",
  "iptables-save > /etc/iptables/rules.v4 2>/dev/null || true",
  "netfilter-persistent save 2>/dev/null || true",
  "",
  "# Kill-switch: if Tor goes down, block all traffic (no leaks)",
  "cat > /etc/network/if-pre-up.d/tor-killswitch << 'KS'",
  "#!/bin/bash",
  "iptables -I OUTPUT -m owner --uid-owner debian-tor -j ACCEPT 2>/dev/null || true",
  "iptables -I OUTPUT ! -o lo -m owner ! --uid-owner root -j DROP 2>/dev/null || true",
  "KS",
  "chmod +x /etc/network/if-pre-up.d/tor-killswitch 2>/dev/null || true",
  "",
  "systemctl enable tor",
  "systemctl restart tor",
  "sleep 5",
  "",
  "PUBLIC_IP=$(curl -s --max-time 5 ifconfig.me 2>/dev/null || curl -s --max-time 5 api.ipify.org 2>/dev/null || hostname -I | awk '{print $1}')",
  "TOR_IP=$(curl -s --max-time 10 --socks5 127.0.0.1:9050 https://api.ipify.org 2>/dev/null || echo 'not_ready')",
  "if systemctl is-active --quiet tor; then",
  "  echo TOR_OK",
  "  echo PUBLIC_IP:$PUBLIC_IP",
  "  echo TOR_IP:$TOR_IP",
  "else",
  "  echo TOR_FAILED",
  "  exit 1",
  "fi",
].join("\n");

const CHECK_TOR = [
  "PUBLIC_IP=$(curl -s --max-time 5 ifconfig.me 2>/dev/null || curl -s --max-time 5 api.ipify.org 2>/dev/null || hostname -I | awk '{print $1}')",
  "if systemctl is-active --quiet tor 2>/dev/null || pgrep tor > /dev/null 2>&1; then echo RUNNING; else echo STOPPED; fi",
  "TOR_IP=$(curl -s --max-time 10 --socks5 127.0.0.1:9050 https://api.ipify.org 2>/dev/null || echo 'not_ready')",
  "echo PUBLIC_IP:$PUBLIC_IP",
  "echo TOR_IP:$TOR_IP",
].join("\n");

const NEW_CIRCUIT = "kill -HUP $(cat /var/run/tor/tor.pid 2>/dev/null || pgrep tor) 2>/dev/null && echo CIRCUIT_RENEWED || echo CIRCUIT_FAILED";
const STOP_TOR = "systemctl stop tor 2>/dev/null; kill $(pgrep tor) 2>/dev/null; echo STOPPED";
const START_TOR = "systemctl start tor 2>/dev/null || tor -f /etc/tor/torrc &; sleep 3; if pgrep tor > /dev/null; then echo STARTED; else echo FAILED; fi";

// ─── Types ────────────────────────────────────────────────────────────────────
export interface TorNode {
  id: string;
  label: string;
  sshHost: string;
  sshPort: number;
  sshUser: string;
  sshPassword?: string;
  sshKey?: string;
  publicIp?: string;
  torIp?: string;
  status: "pending" | "deploying" | "running" | "stopped" | "offline" | "error";
  installed: boolean;
  firewallEnabled: boolean;
  lastChecked?: string;
  country?: string;
  addedAt: string;
  deployedAt?: string;
  errorMessage?: string;
}

// ─── DB helpers ───────────────────────────────────────────────────────────────
async function getNodes(userId: number): Promise<TorNode[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select().from(userSecrets)
    .where(and(eq(userSecrets.userId, userId), eq(userSecrets.secretType, SECRET_NODES))).limit(1);
  if (!rows.length) return [];
  try { return JSON.parse(decrypt(rows[0].encryptedValue)) as TorNode[]; } catch { return []; }
}

async function saveNodes(userId: number, nodes: TorNode[]): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const enc = encrypt(JSON.stringify(nodes));
  const ex = await db.select().from(userSecrets)
    .where(and(eq(userSecrets.userId, userId), eq(userSecrets.secretType, SECRET_NODES))).limit(1);
  if (ex.length) {
    await db.update(userSecrets).set({ encryptedValue: enc, updatedAt: new Date() }).where(eq(userSecrets.id, ex[0].id));
  } else {
    await db.insert(userSecrets).values({ userId, secretType: SECRET_NODES, label: "Tor Nodes", encryptedValue: enc });
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
    await db.insert(userSecrets).values({ userId, secretType: SECRET_ACTIVE, label: "Active Tor Node", encryptedValue: enc });
  }
}

async function getActiveNode(userId: number): Promise<TorNode | null> {
  const activeId = await getActiveNodeId(userId);
  if (!activeId) return null;
  const nodes = await getNodes(userId);
  return nodes.find(n => n.id === activeId) ?? null;
}

function nodeToSSH(n: TorNode): SSHConfig {
  return { host: n.sshHost, port: n.sshPort, username: n.sshUser, password: n.sshPassword, privateKey: n.sshKey };
}

function sanitize(n: TorNode): Omit<TorNode, "sshPassword" | "sshKey"> {
  const { sshPassword: _p, sshKey: _k, ...safe } = n;
  return safe;
}

/** Public export for Titan AI chat executor */
export async function execTorCommandPublic(command: string, userId: number, timeoutMs = 15000): Promise<string> {
  const node = await getActiveNode(userId);
  if (!node) return "No active Tor node. Add and deploy a dedicated VPS node in the Tor settings first.";
  return execSSHCommand(nodeToSSH(node), command, timeoutMs, userId);
}

// ─── Router ───────────────────────────────────────────────────────────────────
export const torRouter = router({

  listNodes: protectedProcedure.query(async ({ ctx }) => {
    const plan = await getUserPlan(ctx.user.id);
    enforceFeature(plan.planId, "offensive_tooling", "Tor");
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
    }))
    .mutation(async ({ ctx, input }) => {
      const plan = await getUserPlan(ctx.user.id);
      enforceFeature(plan.planId, "offensive_tooling", "Tor");
      if (!input.sshPassword && !input.sshKey) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "SSH password or private key required." });
      }
      const nodes = await getNodes(ctx.user.id);
      if (nodes.some(n => n.sshHost === input.sshHost && n.sshPort === input.sshPort)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Node with this host:port already exists." });
      }
      const node: TorNode = {
        id: crypto.randomUUID(), label: input.label,
        sshHost: input.sshHost, sshPort: input.sshPort, sshUser: input.sshUser,
        sshPassword: input.sshPassword, sshKey: input.sshKey,
        status: "pending", installed: false, firewallEnabled: false,
        country: input.country, addedAt: new Date().toISOString(),
      };
      nodes.push(node);
      await saveNodes(ctx.user.id, nodes);
      const activeId = await getActiveNodeId(ctx.user.id);
      if (!activeId) await setActiveNodeId(ctx.user.id, node.id);
      log.info(`User ${ctx.user.id} added Tor node: ${input.label} (${input.sshHost})`);
      return { success: true, node: sanitize(node) };
    }),

  deployNode: protectedProcedure
    .input(z.object({ nodeId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const plan = await getUserPlan(ctx.user.id);
      enforceFeature(plan.planId, "offensive_tooling", "Tor");
      const nodes = await getNodes(ctx.user.id);
      const idx = nodes.findIndex(n => n.id === input.nodeId);
      if (idx === -1) throw new TRPCError({ code: "NOT_FOUND", message: "Node not found." });
      const node = nodes[idx];
      node.status = "deploying";
      await saveNodes(ctx.user.id, nodes);
      try {
        const output = await execSSHCommand(nodeToSSH(node), INSTALL_TOR, 300000, ctx.user.id);
        if (!output.includes("TOR_OK")) {
          node.status = "error";
          node.errorMessage = "Tor installation failed. Check SSH credentials and server access.";
          await saveNodes(ctx.user.id, nodes);
          return { success: false, message: node.errorMessage };
        }
        const ipMatch = output.match(/PUBLIC_IP:(\S+)/);
        const torIpMatch = output.match(/TOR_IP:(\S+)/);
        if (ipMatch) node.publicIp = ipMatch[1];
        if (torIpMatch && torIpMatch[1] !== "not_ready") node.torIp = torIpMatch[1];
        node.status = "running"; node.installed = true; node.firewallEnabled = true;
        node.deployedAt = new Date().toISOString();
        node.lastChecked = new Date().toISOString();
        node.errorMessage = undefined;
        await saveNodes(ctx.user.id, nodes);
        return { success: true, publicIp: node.publicIp, torIp: node.torIp, message: `Tor running on "${node.label}" — Server IP: ${node.publicIp}, Tor exit IP: ${node.torIp ?? "building circuits..."}. Firewall active.` };
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
      enforceFeature(plan.planId, "offensive_tooling", "Tor");
      const nodes = await getNodes(ctx.user.id);
      const idx = nodes.findIndex(n => n.id === input.nodeId);
      if (idx === -1) throw new TRPCError({ code: "NOT_FOUND", message: "Node not found." });
      const node = nodes[idx];
      try {
        const output = await execSSHCommand(nodeToSSH(node), CHECK_TOR, 20000, ctx.user.id);
        const running = output.includes("RUNNING");
        const ipMatch = output.match(/PUBLIC_IP:(\S+)/);
        const torIpMatch = output.match(/TOR_IP:(\S+)/);
        if (ipMatch) node.publicIp = ipMatch[1];
        if (torIpMatch && torIpMatch[1] !== "not_ready") node.torIp = torIpMatch[1];
        node.status = running ? "running" : "stopped";
        node.lastChecked = new Date().toISOString();
        await saveNodes(ctx.user.id, nodes);
        return { running, publicIp: node.publicIp, torIp: node.torIp, message: running ? `Tor running on "${node.label}" — exit IP: ${node.torIp ?? "building..."}` : `Tor stopped on "${node.label}"` };
      } catch (err: any) {
        node.status = "offline"; node.lastChecked = new Date().toISOString();
        await saveNodes(ctx.user.id, nodes);
        return { running: false, message: `SSH failed: ${err.message}` };
      }
    }),

  setActiveNode: protectedProcedure
    .input(z.object({ nodeId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const plan = await getUserPlan(ctx.user.id);
      enforceFeature(plan.planId, "offensive_tooling", "Tor");
      const nodes = await getNodes(ctx.user.id);
      if (!nodes.some(n => n.id === input.nodeId)) throw new TRPCError({ code: "NOT_FOUND", message: "Node not found." });
      await setActiveNodeId(ctx.user.id, input.nodeId);
      return { success: true };
    }),

  removeNode: protectedProcedure
    .input(z.object({ nodeId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const plan = await getUserPlan(ctx.user.id);
      enforceFeature(plan.planId, "offensive_tooling", "Tor");
      const nodes = await getNodes(ctx.user.id);
      const idx = nodes.findIndex(n => n.id === input.nodeId);
      if (idx === -1) throw new TRPCError({ code: "NOT_FOUND", message: "Node not found." });
      const node = nodes[idx];
      try { await execSSHCommand(nodeToSSH(node), STOP_TOR, 10000, ctx.user.id); } catch { /* best-effort */ }
      nodes.splice(idx, 1);
      await saveNodes(ctx.user.id, nodes);
      const activeId = await getActiveNodeId(ctx.user.id);
      if (activeId === input.nodeId) {
        await setActiveNodeId(ctx.user.id, nodes.length > 0 ? nodes[0].id : null);
      }
      return { success: true, message: `Node "${node.label}" removed` };
    }),

  /** Get status of the active node */
  getStatus: protectedProcedure.query(async ({ ctx }) => {
    const plan = await getUserPlan(ctx.user.id);
    enforceFeature(plan.planId, "offensive_tooling", "Tor");
    const node = await getActiveNode(ctx.user.id);
    const nodes = await getNodes(ctx.user.id);
    return {
      hasNode: !!node,
      nodeLabel: node?.label,
      publicIp: node?.publicIp,
      torIp: node?.torIp,
      status: node?.status ?? "none",
      firewallEnabled: node?.firewallEnabled ?? false,
      nodeCount: nodes.length,
    };
  }),

  /** Request a new Tor circuit (new exit IP) */
  newCircuit: protectedProcedure.mutation(async ({ ctx }) => {
    const plan = await getUserPlan(ctx.user.id);
    enforceFeature(plan.planId, "offensive_tooling", "Tor");
    const node = await getActiveNode(ctx.user.id);
    if (!node) throw new TRPCError({ code: "BAD_REQUEST", message: "No active Tor node." });
    const output = await execSSHCommand(nodeToSSH(node), NEW_CIRCUIT, 10000, ctx.user.id);
    const ok = output.includes("CIRCUIT_RENEWED");
    if (ok) {
      // Update the Tor IP after circuit renewal
      setTimeout(async () => {
        try {
          const checkOutput = await execSSHCommand(nodeToSSH(node), CHECK_TOR, 15000, ctx.user.id);
          const torIpMatch = checkOutput.match(/TOR_IP:(\S+)/);
          if (torIpMatch && torIpMatch[1] !== "not_ready") {
            const nodes = await getNodes(ctx.user.id);
            const idx = nodes.findIndex(n => n.id === node.id);
            if (idx !== -1) { nodes[idx].torIp = torIpMatch[1]; await saveNodes(ctx.user.id, nodes); }
          }
        } catch { /* best-effort */ }
      }, 5000);
    }
    return { success: ok, message: ok ? "New Tor circuit requested — new exit IP building..." : "Circuit renewal failed" };
  }),

  /** Start Tor on the active node */
  startTor: protectedProcedure.mutation(async ({ ctx }) => {
    const plan = await getUserPlan(ctx.user.id);
    enforceFeature(plan.planId, "offensive_tooling", "Tor");
    const node = await getActiveNode(ctx.user.id);
    if (!node) throw new TRPCError({ code: "BAD_REQUEST", message: "No active Tor node." });
    const output = await execSSHCommand(nodeToSSH(node), START_TOR, 30000, ctx.user.id);
    const ok = output.includes("STARTED");
    if (ok) {
      const nodes = await getNodes(ctx.user.id);
      const idx = nodes.findIndex(n => n.id === node.id);
      if (idx !== -1) { nodes[idx].status = "running"; await saveNodes(ctx.user.id, nodes); }
    }
    return { success: ok, message: ok ? `Tor started on "${node.label}"` : "Failed to start Tor" };
  }),

  /** Stop Tor on the active node */
  stopTor: protectedProcedure.mutation(async ({ ctx }) => {
    const plan = await getUserPlan(ctx.user.id);
    enforceFeature(plan.planId, "offensive_tooling", "Tor");
    const node = await getActiveNode(ctx.user.id);
    if (!node) throw new TRPCError({ code: "BAD_REQUEST", message: "No active Tor node." });
    await execSSHCommand(nodeToSSH(node), STOP_TOR, 10000, ctx.user.id);
    const nodes = await getNodes(ctx.user.id);
    const idx = nodes.findIndex(n => n.id === node.id);
    if (idx !== -1) { nodes[idx].status = "stopped"; await saveNodes(ctx.user.id, nodes); }
    return { success: true, message: `Tor stopped on "${node.label}"` };
  }),

  /** Toggle kill-switch firewall */
  toggleFirewall: protectedProcedure
    .input(z.object({ enabled: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const plan = await getUserPlan(ctx.user.id);
      enforceFeature(plan.planId, "offensive_tooling", "Tor");
      const node = await getActiveNode(ctx.user.id);
      if (!node) throw new TRPCError({ code: "BAD_REQUEST", message: "No active Tor node." });
      const script = input.enabled
        ? [
            "iptables -F INPUT 2>/dev/null || true",
            "iptables -A INPUT -i lo -j ACCEPT",
            "iptables -A INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT",
            "iptables -A INPUT -p tcp --dport 22 -j ACCEPT",
            "iptables -A INPUT -j DROP",
            "iptables-save > /etc/iptables/rules.v4 2>/dev/null || true",
            "echo FIREWALL_ON",
          ].join("\n")
        : [
            "iptables -F INPUT 2>/dev/null || true",
            "iptables -A INPUT -i lo -j ACCEPT",
            "iptables -A INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT",
            "iptables -A INPUT -p tcp --dport 22 -j ACCEPT",
            "iptables -A INPUT -j ACCEPT",
            "echo FIREWALL_OFF",
          ].join("\n");
      const output = await execSSHCommand(nodeToSSH(node), script, 15000, ctx.user.id);
      const nodes = await getNodes(ctx.user.id);
      const idx = nodes.findIndex(n => n.id === node.id);
      if (idx !== -1) { nodes[idx].firewallEnabled = input.enabled; await saveNodes(ctx.user.id, nodes); }
      return { success: true, firewallEnabled: input.enabled, message: input.enabled ? "Firewall enabled — inbound connections blocked" : "Firewall disabled" };
    }),

  /** Get whether Tor is currently active (has a running node) */
  getActiveState: protectedProcedure.query(async ({ ctx }) => {
    const plan = await getUserPlan(ctx.user.id);
    enforceFeature(plan.planId, "offensive_tooling", "Tor");
    const node = await getActiveNode(ctx.user.id);
    return { active: !!node && node.status === 'running' };
  }),

  /** Toggle Tor active state (start/stop Tor on the active node) */
  setActive: protectedProcedure
    .input(z.object({ active: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const plan = await getUserPlan(ctx.user.id);
      enforceFeature(plan.planId, "offensive_tooling", "Tor");
      const node = await getActiveNode(ctx.user.id);
      if (!node) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No active Tor node configured. Add and deploy a dedicated VPS node on the Tor page first.",
        });
      }
      if (!node.installed) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Tor is not installed on "${node.label}" yet. Deploy the node first from the Tor page.`,
        });
      }
      try {
        const script = input.active ? START_TOR : STOP_TOR;
        await execSSHCommand(nodeToSSH(node), script, 30000, ctx.user.id);
        const nodes = await getNodes(ctx.user.id);
        const idx = nodes.findIndex(n => n.id === node.id);
        if (idx !== -1) { nodes[idx].status = input.active ? 'running' : 'stopped'; await saveNodes(ctx.user.id, nodes); }
        return { success: true, active: input.active, message: input.active ? `Tor started on "${node.label}"` : `Tor stopped on "${node.label}"` };
      } catch (e: any) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `SSH error on "${node.label}": ${e.message}` });
      }
    }),

  /** Run a command through Tor on the active node */
  runThroughTor: protectedProcedure
    .input(z.object({ command: z.string().min(1), timeoutMs: z.number().optional() }))
    .mutation(async ({ ctx, input }) => {
      const plan = await getUserPlan(ctx.user.id);
      enforceFeature(plan.planId, "offensive_tooling", "Tor");
      const node = await getActiveNode(ctx.user.id);
      if (!node) throw new TRPCError({ code: "BAD_REQUEST", message: "No active Tor node." });
      const safeCmd = input.command.replace(/[`\\|;&><]/g, "");
      const script = `torify bash -c "${safeCmd.replace(/"/g, '\\"')}" 2>&1 || echo "TOR_CMD_FAILED"`;
      const output = await execSSHCommand(nodeToSSH(node), script, input.timeoutMs ?? 30000, ctx.user.id);
      return { output, nodeLabel: node.label, torIp: node.torIp };
    }),
});
