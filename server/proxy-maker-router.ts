/**
 * Titan Proxy Maker Router — Multi-Node Architecture
 *
 * Security model:
 *   Each proxy node is a SEPARATE VPS with its own unique public IP.
 *   Nothing sensitive runs on the shared Railway Titan Server.
 *   Node SSH credentials are encrypted per-user in the DB (AES-256).
 *   Each node runs 3proxy (SOCKS5 + HTTP) on its own IP.
 *   Rotating pool cycles across all node IPs — no single IP is reused.
 *   Firewall rules on each node block inbound reverse connections.
 */

import { z } from "zod";
import { router, protectedProcedure } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "./db";
import { userSecrets } from "../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { encrypt, decrypt } from "./fetcher-db";
import { getUserPlan, enforceFeature } from "./subscription-gate";
import { consumeCredits } from "./credit-service";
import { execSSHCommand, type SSHConfig } from "./titan-server";
import { createLogger } from "./_core/logger.js";

const log = createLogger("ProxyMaker");

const SECRET_NODES    = "__proxy_nodes";
const SECRET_ROTATION = "__proxy_rotation";

// Install 3proxy + hardened firewall (blocks inbound reverse connections)
const INSTALL_3PROXY = [
  "#!/bin/bash",
  "set -e",
  "export DEBIAN_FRONTEND=noninteractive",
  "apt-get update -qq 2>&1 | tail -1",
  "apt-get install -y -qq 3proxy curl wget iptables iptables-persistent 2>&1 | tail -2",
  "iptables -F INPUT 2>/dev/null || true",
  "iptables -A INPUT -i lo -j ACCEPT",
  "iptables -A INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT",
  "iptables -A INPUT -p tcp --dport 22 -j ACCEPT",
  "iptables -A INPUT -p tcp --dport 1080 -j ACCEPT",
  "iptables -A INPUT -p tcp --dport 8080 -j ACCEPT",
  "iptables -A INPUT -j DROP",
  "mkdir -p /etc/iptables",
  "iptables-save > /etc/iptables/rules.v4 2>/dev/null || true",
  "netfilter-persistent save 2>/dev/null || true",
  "mkdir -p /etc/3proxy",
  "printf 'daemon\\nmaxconn 1000\\nnscache 65536\\ntimeouts 1 5 30 60 180 1800 15 60\\nlog /var/log/3proxy.log D\\nauth none\\nallow *\\nsocks -p1080\\nproxy -p8080\\n' > /etc/3proxy/3proxy.cfg",
  "systemctl enable 3proxy 2>/dev/null || true",
  "systemctl restart 3proxy 2>/dev/null || service 3proxy restart 2>/dev/null || 3proxy /etc/3proxy/3proxy.cfg &",
  "sleep 3",
  "if pgrep 3proxy > /dev/null; then",
  "  PUBLIC_IP=$(curl -s --max-time 5 ifconfig.me 2>/dev/null || curl -s --max-time 5 api.ipify.org 2>/dev/null || hostname -I | awk '{print $1}')",
  "  echo PROXY_OK",
  "  echo PUBLIC_IP:$PUBLIC_IP",
  "else",
  "  echo PROXY_FAILED",
  "  exit 1",
  "fi",
].join("\n");

const STOP_3PROXY = "kill $(pgrep 3proxy) 2>/dev/null; echo STOPPED";

const CHECK_3PROXY = [
  "PUBLIC_IP=$(curl -s --max-time 5 ifconfig.me 2>/dev/null || curl -s --max-time 5 api.ipify.org 2>/dev/null || hostname -I | awk '{print $1}')",
  "if pgrep 3proxy > /dev/null; then echo ALIVE; else echo DEAD; fi",
  "echo PUBLIC_IP:$PUBLIC_IP",
].join("\n");

// ─── Types ────────────────────────────────────────────────────────────────────
export interface ProxyNode {
  id: string;
  label: string;
  sshHost: string;
  sshPort: number;
  sshUser: string;
  sshPassword?: string;
  sshKey?: string;
  publicIp?: string;
  socks5Port: number;
  httpPort: number;
  status: "pending" | "deploying" | "online" | "offline" | "error";
  deployed: boolean;
  lastChecked?: string;
  latencyMs?: number;
  country?: string;
  addedAt: string;
  deployedAt?: string;
  errorMessage?: string;
}

interface RotationState {
  enabled: boolean;
  currentIndex: number;
  updatedAt: string;
}

// ─── DB helpers ───────────────────────────────────────────────────────────────
async function getNodes(userId: number): Promise<ProxyNode[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select().from(userSecrets)
    .where(and(eq(userSecrets.userId, userId), eq(userSecrets.secretType, SECRET_NODES))).limit(1);
  if (!rows.length) return [];
  try { return JSON.parse(decrypt(rows[0].encryptedValue)) as ProxyNode[]; } catch { return []; }
}

async function saveNodes(userId: number, nodes: ProxyNode[]): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const enc = encrypt(JSON.stringify(nodes));
  const ex = await db.select().from(userSecrets)
    .where(and(eq(userSecrets.userId, userId), eq(userSecrets.secretType, SECRET_NODES))).limit(1);
  if (ex.length) {
    await db.update(userSecrets).set({ encryptedValue: enc, updatedAt: new Date() }).where(eq(userSecrets.id, ex[0].id));
  } else {
    await db.insert(userSecrets).values({ userId, secretType: SECRET_NODES, label: "Proxy Nodes", encryptedValue: enc });
  }
}

async function getRotation(userId: number): Promise<RotationState> {
  const db = await getDb();
  if (!db) return { enabled: false, currentIndex: 0, updatedAt: new Date().toISOString() };
  const rows = await db.select().from(userSecrets)
    .where(and(eq(userSecrets.userId, userId), eq(userSecrets.secretType, SECRET_ROTATION))).limit(1);
  if (!rows.length) return { enabled: false, currentIndex: 0, updatedAt: new Date().toISOString() };
  try { return JSON.parse(decrypt(rows[0].encryptedValue)) as RotationState; }
  catch { return { enabled: false, currentIndex: 0, updatedAt: new Date().toISOString() }; }
}

async function saveRotation(userId: number, state: RotationState): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  state.updatedAt = new Date().toISOString();
  const enc = encrypt(JSON.stringify(state));
  const ex = await db.select().from(userSecrets)
    .where(and(eq(userSecrets.userId, userId), eq(userSecrets.secretType, SECRET_ROTATION))).limit(1);
  if (ex.length) {
    await db.update(userSecrets).set({ encryptedValue: enc, updatedAt: new Date() }).where(eq(userSecrets.id, ex[0].id));
  } else {
    await db.insert(userSecrets).values({ userId, secretType: SECRET_ROTATION, label: "Proxy Rotation", encryptedValue: enc });
  }
}

function nodeToSSH(n: ProxyNode): SSHConfig {
  return { host: n.sshHost, port: n.sshPort, username: n.sshUser, password: n.sshPassword, privateKey: n.sshKey };
}

function sanitize(n: ProxyNode): Omit<ProxyNode, "sshPassword" | "sshKey"> {
  const { sshPassword: _p, sshKey: _k, ...safe } = n;
  return safe;
}

// ─── Router ───────────────────────────────────────────────────────────────────
export const proxyMakerRouter = router({

  /** List all proxy nodes (SSH credentials stripped) */
  listNodes: protectedProcedure.query(async ({ ctx }) => {
    const plan = await getUserPlan(ctx.user.id);
    enforceFeature(plan.planId, "offensive_tooling", "Proxy Maker");
    const nodes = await getNodes(ctx.user.id);
    const rotation = await getRotation(ctx.user.id);
    return {
      nodes: nodes.map(sanitize),
      rotationEnabled: rotation.enabled,
      currentIndex: rotation.currentIndex,
      onlineCount: nodes.filter(n => n.status === "online").length,
      totalCount: nodes.length,
    };
  }),

  /** Add a new proxy node (saves SSH credentials encrypted in DB) */
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
      enforceFeature(plan.planId, "offensive_tooling", "Proxy Maker");
      if (!input.sshPassword && !input.sshKey) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "SSH password or private key required." });
      }
      const nodes = await getNodes(ctx.user.id);
      if (nodes.some(n => n.sshHost === input.sshHost && n.sshPort === input.sshPort)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Node with this host:port already exists." });
      }
      const node: ProxyNode = {
        id: crypto.randomUUID(), label: input.label,
        sshHost: input.sshHost, sshPort: input.sshPort, sshUser: input.sshUser,
        sshPassword: input.sshPassword, sshKey: input.sshKey,
        socks5Port: 1080, httpPort: 8080,
        status: "pending", deployed: false,
        country: input.country, addedAt: new Date().toISOString(),
      };
      nodes.push(node);
      await saveNodes(ctx.user.id, nodes);
      log.info(`User ${ctx.user.id} added proxy node: ${input.label} (${input.sshHost})`);
      return { success: true, node: sanitize(node) };
    }),

  /** Deploy 3proxy + firewall on a node via SSH */
  deployNode: protectedProcedure
    .input(z.object({ nodeId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const plan = await getUserPlan(ctx.user.id);
      enforceFeature(plan.planId, "offensive_tooling", "Proxy Maker");
      const nodes = await getNodes(ctx.user.id);
      const idx = nodes.findIndex(n => n.id === input.nodeId);
      if (idx === -1) throw new TRPCError({ code: "NOT_FOUND", message: "Node not found." });
      const node = nodes[idx];
      node.status = "deploying";
      await saveNodes(ctx.user.id, nodes);
      try { await consumeCredits(ctx.user.id, "vpn_generate", `Proxy Maker: deploy node ${node.label}`); } catch {}
      try {
        const output = await execSSHCommand(nodeToSSH(node), INSTALL_3PROXY, 180000, ctx.user.id);
        if (!output.includes("PROXY_OK")) {
          node.status = "error";
          node.errorMessage = "3proxy failed to start. Check SSH credentials and server access.";
          await saveNodes(ctx.user.id, nodes);
          return { success: false, message: node.errorMessage };
        }
        const ipMatch = output.match(/PUBLIC_IP:(\S+)/);
        if (ipMatch) node.publicIp = ipMatch[1];
        node.status = "online"; node.deployed = true;
        node.deployedAt = new Date().toISOString();
        node.lastChecked = new Date().toISOString();
        node.errorMessage = undefined;
        await saveNodes(ctx.user.id, nodes);
        return { success: true, publicIp: node.publicIp, message: `Proxy node "${node.label}" live at ${node.publicIp} — SOCKS5 :1080, HTTP :8080` };
      } catch (err: any) {
        node.status = "error"; node.errorMessage = err.message;
        await saveNodes(ctx.user.id, nodes);
        return { success: false, message: `Deploy failed: ${err.message}` };
      }
    }),

  /** Check if a node's proxy is alive */
  checkNode: protectedProcedure
    .input(z.object({ nodeId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const plan = await getUserPlan(ctx.user.id);
      enforceFeature(plan.planId, "offensive_tooling", "Proxy Maker");
      const nodes = await getNodes(ctx.user.id);
      const idx = nodes.findIndex(n => n.id === input.nodeId);
      if (idx === -1) throw new TRPCError({ code: "NOT_FOUND", message: "Node not found." });
      const node = nodes[idx];
      const start = Date.now();
      try {
        const output = await execSSHCommand(nodeToSSH(node), CHECK_3PROXY, 15000, ctx.user.id);
        const alive = output.includes("ALIVE");
        const ipMatch = output.match(/PUBLIC_IP:(\S+)/);
        if (ipMatch) node.publicIp = ipMatch[1];
        node.status = alive ? "online" : "offline";
        node.latencyMs = Date.now() - start;
        node.lastChecked = new Date().toISOString();
        await saveNodes(ctx.user.id, nodes);
        return { alive, latencyMs: node.latencyMs, publicIp: node.publicIp, message: alive ? `"${node.label}" online at ${node.publicIp} (${node.latencyMs}ms)` : `"${node.label}" offline` };
      } catch (err: any) {
        node.status = "offline"; node.lastChecked = new Date().toISOString();
        await saveNodes(ctx.user.id, nodes);
        return { alive: false, latencyMs: Date.now() - start, message: `SSH failed: ${err.message}` };
      }
    }),

  /** Check all nodes at once */
  checkAllNodes: protectedProcedure.mutation(async ({ ctx }) => {
    const plan = await getUserPlan(ctx.user.id);
    enforceFeature(plan.planId, "offensive_tooling", "Proxy Maker");
    const nodes = await getNodes(ctx.user.id);
    const results: { nodeId: string; label: string; alive: boolean; publicIp?: string; latencyMs: number }[] = [];
    for (const node of nodes) {
      const start = Date.now();
      try {
        const output = await execSSHCommand(nodeToSSH(node), CHECK_3PROXY, 15000, ctx.user.id);
        const alive = output.includes("ALIVE");
        const ipMatch = output.match(/PUBLIC_IP:(\S+)/);
        if (ipMatch) node.publicIp = ipMatch[1];
        node.status = alive ? "online" : "offline";
        node.latencyMs = Date.now() - start;
        node.lastChecked = new Date().toISOString();
        results.push({ nodeId: node.id, label: node.label, alive, publicIp: node.publicIp, latencyMs: node.latencyMs });
      } catch {
        node.status = "offline"; node.lastChecked = new Date().toISOString();
        results.push({ nodeId: node.id, label: node.label, alive: false, latencyMs: Date.now() - start });
      }
    }
    await saveNodes(ctx.user.id, nodes);
    const onlineCount = results.filter(r => r.alive).length;
    return { results, onlineCount, totalCount: nodes.length, message: `${onlineCount}/${nodes.length} nodes online` };
  }),

  /** Stop 3proxy on a node */
  stopNode: protectedProcedure
    .input(z.object({ nodeId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const plan = await getUserPlan(ctx.user.id);
      enforceFeature(plan.planId, "offensive_tooling", "Proxy Maker");
      const nodes = await getNodes(ctx.user.id);
      const idx = nodes.findIndex(n => n.id === input.nodeId);
      if (idx === -1) throw new TRPCError({ code: "NOT_FOUND", message: "Node not found." });
      const node = nodes[idx];
      try {
        await execSSHCommand(nodeToSSH(node), STOP_3PROXY, 10000, ctx.user.id);
        node.status = "offline"; node.deployed = false;
        await saveNodes(ctx.user.id, nodes);
        return { success: true, message: `Proxy stopped on "${node.label}"` };
      } catch (err: any) {
        return { success: false, message: `Stop failed: ${err.message}` };
      }
    }),

  /** Remove a node from DB (optionally stop first) */
  removeNode: protectedProcedure
    .input(z.object({ nodeId: z.string(), stopFirst: z.boolean().default(true) }))
    .mutation(async ({ ctx, input }) => {
      const plan = await getUserPlan(ctx.user.id);
      enforceFeature(plan.planId, "offensive_tooling", "Proxy Maker");
      const nodes = await getNodes(ctx.user.id);
      const idx = nodes.findIndex(n => n.id === input.nodeId);
      if (idx === -1) throw new TRPCError({ code: "NOT_FOUND", message: "Node not found." });
      const node = nodes[idx];
      if (input.stopFirst && node.deployed) {
        try { await execSSHCommand(nodeToSSH(node), STOP_3PROXY, 10000, ctx.user.id); } catch { /* best-effort */ }
      }
      nodes.splice(idx, 1);
      await saveNodes(ctx.user.id, nodes);
      return { success: true, message: `Node "${node.label}" removed` };
    }),

  /** Update node label/country */
  updateNodeLabel: protectedProcedure
    .input(z.object({ nodeId: z.string(), label: z.string().min(1).max(64), country: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const nodes = await getNodes(ctx.user.id);
      const idx = nodes.findIndex(n => n.id === input.nodeId);
      if (idx === -1) throw new TRPCError({ code: "NOT_FOUND", message: "Node not found." });
      nodes[idx].label = input.label;
      if (input.country !== undefined) nodes[idx].country = input.country;
      await saveNodes(ctx.user.id, nodes);
      return { success: true };
    }),

  /** Toggle rotation on/off */
  setRotation: protectedProcedure
    .input(z.object({ enabled: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const plan = await getUserPlan(ctx.user.id);
      enforceFeature(plan.planId, "offensive_tooling", "Proxy Maker");
      const rotation = await getRotation(ctx.user.id);
      rotation.enabled = input.enabled;
      await saveRotation(ctx.user.id, rotation);
      return { success: true, rotationEnabled: input.enabled };
    }),

  /** Get next proxy in round-robin rotation */
  getNextProxy: protectedProcedure.query(async ({ ctx }) => {
    const nodes = await getNodes(ctx.user.id);
    const rotation = await getRotation(ctx.user.id);
    const online = nodes.filter(n => n.status === "online" && n.publicIp);
    if (!online.length) return { proxy: null, message: "No online proxy nodes. Deploy a node first." };
    const idx = rotation.currentIndex % online.length;
    const node = online[idx];
    rotation.currentIndex = (idx + 1) % online.length;
    await saveRotation(ctx.user.id, rotation);
    return { proxy: { host: node.publicIp!, socks5Port: node.socks5Port, httpPort: node.httpPort, label: node.label, country: node.country, nodeId: node.id }, remaining: online.length };
  }),

  /** Test a node's proxy by curling through it */
  testProxy: protectedProcedure
    .input(z.object({ nodeId: z.string(), testUrl: z.string().default("https://api.ipify.org") }))
    .mutation(async ({ ctx, input }) => {
      const plan = await getUserPlan(ctx.user.id);
      enforceFeature(plan.planId, "offensive_tooling", "Proxy Maker");
      const nodes = await getNodes(ctx.user.id);
      const node = nodes.find(n => n.id === input.nodeId);
      if (!node) throw new TRPCError({ code: "NOT_FOUND", message: "Node not found." });
      if (!node.publicIp) return { success: false, message: "Deploy node first." };
      try { await consumeCredits(ctx.user.id, "vpn_generate", `Proxy Maker: test proxy ${node.label}`); } catch {}
      const script = `curl -s --max-time 10 --socks5 127.0.0.1:1080 "${input.testUrl}" 2>&1 || echo PROXY_TEST_FAILED`;
      try {
        const output = await execSSHCommand(nodeToSSH(node), script, 20000, ctx.user.id);
        const ok = !output.includes("PROXY_TEST_FAILED") && !output.includes("Connection refused");
        return { success: ok, output: output.trim(), message: ok ? `Proxy test passed on "${node.label}" — ${output.trim()}` : `Proxy test failed — ${output.trim()}` };
      } catch (err: any) {
        return { success: false, message: `SSH failed: ${err.message}` };
      }
    }),

  /** Export all online proxy endpoints as a list */
  exportProxies: protectedProcedure
    .input(z.object({ type: z.enum(["socks5", "http", "all"]).default("socks5"), onlineOnly: z.boolean().default(true) }))
    .query(async ({ ctx, input }) => {
      const plan = await getUserPlan(ctx.user.id);
      enforceFeature(plan.planId, "offensive_tooling", "Proxy Maker");
      let nodes = await getNodes(ctx.user.id);
      if (input.onlineOnly) nodes = nodes.filter(n => n.status === "online" && n.publicIp);
      const lines: string[] = [];
      for (const n of nodes) {
        if (!n.publicIp) continue;
        if (input.type === "socks5" || input.type === "all") lines.push(`socks5://${n.publicIp}:${n.socks5Port}  # ${n.label}${n.country ? ` (${n.country})` : ""}`);
        if (input.type === "http" || input.type === "all") lines.push(`http://${n.publicIp}:${n.httpPort}  # ${n.label}${n.country ? ` (${n.country})` : ""}`);
      }
      return { list: lines.join("\n"), count: nodes.length };
    }),
});
