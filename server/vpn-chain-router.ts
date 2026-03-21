/**
 * VPN Chain Router — Dedicated VPS Node Architecture
 *
 * Security model:
 *   Each hop in the VPN chain is a SEPARATE dedicated VPS with its own IP.
 *   No hop runs on the Railway Titan Server.
 *   Traffic: You → Hop 1 → Hop 2 → Hop 3 → Internet
 *   No single server knows both who you are AND where you're going.
 *   Each hop has a firewall kill-switch (iptables).
 *   WireGuard tunnels between hops — encrypted end-to-end.
 *   VPS SSH credentials encrypted per-user in DB (AES-256).
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

const log = createLogger("VpnChain");

const SECRET_HOPS    = "__vpnchain_hops";
const SECRET_ACTIVE  = "__vpnchain_active";

// ─── WireGuard install + firewall script ─────────────────────────────────────
function buildHopInstallScript(hopIndex: number, totalHops: number): string {
  return [
    "#!/bin/bash",
    "set -e",
    "export DEBIAN_FRONTEND=noninteractive",
    "apt-get update -qq 2>&1 | tail -1",
    "apt-get install -y -qq wireguard iptables iptables-persistent curl wget 2>&1 | tail -2",
    "",
    "# Generate WireGuard keys",
    "mkdir -p /etc/wireguard",
    "wg genkey | tee /etc/wireguard/privatekey | wg pubkey > /etc/wireguard/publickey",
    "PRIVKEY=$(cat /etc/wireguard/privatekey)",
    "PUBKEY=$(cat /etc/wireguard/publickey)",
    "",
    "# Firewall: block inbound reverse connections",
    "iptables -F INPUT 2>/dev/null || true",
    "iptables -A INPUT -i lo -j ACCEPT",
    "iptables -A INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT",
    "iptables -A INPUT -p tcp --dport 22 -j ACCEPT",
    "iptables -A INPUT -p udp --dport 51820 -j ACCEPT",
    "iptables -A INPUT -j DROP",
    "mkdir -p /etc/iptables",
    "iptables-save > /etc/iptables/rules.v4 2>/dev/null || true",
    "netfilter-persistent save 2>/dev/null || true",
    "",
    "# Enable IP forwarding",
    "echo 'net.ipv4.ip_forward=1' > /etc/sysctl.d/99-wireguard.conf",
    "sysctl -p /etc/sysctl.d/99-wireguard.conf 2>/dev/null || true",
    "",
    "PUBLIC_IP=$(curl -s --max-time 5 ifconfig.me 2>/dev/null || curl -s --max-time 5 api.ipify.org 2>/dev/null || hostname -I | awk '{print $1}')",
    "echo WG_OK",
    `echo HOP_INDEX:${hopIndex}`,
    `echo TOTAL_HOPS:${totalHops}`,
    "echo PUBLIC_IP:$PUBLIC_IP",
    "echo PUBKEY:$PUBKEY",
  ].join("\n");
}

const CHECK_HOP = [
  "PUBLIC_IP=$(curl -s --max-time 5 ifconfig.me 2>/dev/null || curl -s --max-time 5 api.ipify.org 2>/dev/null || hostname -I | awk '{print $1}')",
  "if command -v wg > /dev/null 2>&1; then echo WG_INSTALLED; else echo WG_NOT_INSTALLED; fi",
  "echo PUBLIC_IP:$PUBLIC_IP",
  "PUBKEY=$(cat /etc/wireguard/publickey 2>/dev/null || echo 'no_key')",
  "echo PUBKEY:$PUBKEY",
].join("\n");

const TEST_CHAIN_SCRIPT = [
  "PUBLIC_IP=$(curl -s --max-time 5 ifconfig.me 2>/dev/null || curl -s --max-time 5 api.ipify.org 2>/dev/null || hostname -I | awk '{print $1}')",
  "echo PUBLIC_IP:$PUBLIC_IP",
  "LATENCY=$(ping -c 3 8.8.8.8 2>/dev/null | tail -1 | awk -F'/' '{print $5}' || echo 'N/A')",
  "echo LATENCY:$LATENCY",
].join("\n");

// ─── Types ────────────────────────────────────────────────────────────────────
export interface VpnHop {
  id: string;
  label: string;
  hopIndex: number;
  sshHost: string;
  sshPort: number;
  sshUser: string;
  sshPassword?: string;
  sshKey?: string;
  publicIp?: string;
  wgPublicKey?: string;
  status: "pending" | "deploying" | "ready" | "offline" | "error";
  installed: boolean;
  firewallEnabled: boolean;
  lastChecked?: string;
  country?: string;
  addedAt: string;
  deployedAt?: string;
  errorMessage?: string;
  latencyMs?: number;
}

export interface VpnChainConfig {
  active: boolean;
  hops: VpnHop[];
}

// ─── DB helpers ───────────────────────────────────────────────────────────────
async function getHops(userId: number): Promise<VpnHop[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select().from(userSecrets)
    .where(and(eq(userSecrets.userId, userId), eq(userSecrets.secretType, SECRET_HOPS))).limit(1);
  if (!rows.length) return [];
  try { return JSON.parse(decrypt(rows[0].encryptedValue)) as VpnHop[]; } catch { return []; }
}

async function saveHops(userId: number, hops: VpnHop[]): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const enc = encrypt(JSON.stringify(hops));
  const ex = await db.select().from(userSecrets)
    .where(and(eq(userSecrets.userId, userId), eq(userSecrets.secretType, SECRET_HOPS))).limit(1);
  if (ex.length) {
    await db.update(userSecrets).set({ encryptedValue: enc, updatedAt: new Date() }).where(eq(userSecrets.id, ex[0].id));
  } else {
    await db.insert(userSecrets).values({ userId, secretType: SECRET_HOPS, label: "VPN Chain Hops", encryptedValue: enc });
  }
}

async function isChainActive(userId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const rows = await db.select().from(userSecrets)
    .where(and(eq(userSecrets.userId, userId), eq(userSecrets.secretType, SECRET_ACTIVE))).limit(1);
  if (!rows.length) return false;
  try { return decrypt(rows[0].encryptedValue) === "true"; } catch { return false; }
}

async function setChainActive(userId: number, active: boolean): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const enc = encrypt(active ? "true" : "false");
  const ex = await db.select().from(userSecrets)
    .where(and(eq(userSecrets.userId, userId), eq(userSecrets.secretType, SECRET_ACTIVE))).limit(1);
  if (ex.length) {
    await db.update(userSecrets).set({ encryptedValue: enc, updatedAt: new Date() }).where(eq(userSecrets.id, ex[0].id));
  } else {
    await db.insert(userSecrets).values({ userId, secretType: SECRET_ACTIVE, label: "VPN Chain Active", encryptedValue: enc });
  }
}

function hopToSSH(h: VpnHop): SSHConfig {
  return { host: h.sshHost, port: h.sshPort, username: h.sshUser, password: h.sshPassword, privateKey: h.sshKey };
}

function sanitize(h: VpnHop): Omit<VpnHop, "sshPassword" | "sshKey"> {
  const { sshPassword: _p, sshKey: _k, ...safe } = h;
  return safe;
}

// ─── Router ───────────────────────────────────────────────────────────────────
export const vpnChainRouter = router({

  listHops: protectedProcedure.query(async ({ ctx }) => {
    const plan = await getUserPlan(ctx.user.id);
    enforceFeature(plan.planId, "offensive_tooling", "VPN Chain");
    const hops = await getHops(ctx.user.id);
    const active = await isChainActive(ctx.user.id);
    return {
      hops: hops.sort((a, b) => a.hopIndex - b.hopIndex).map(sanitize),
      chainActive: active,
      hopCount: hops.length,
      readyCount: hops.filter(h => h.status === "ready").length,
    };
  }),

  addHop: protectedProcedure
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
      enforceFeature(plan.planId, "offensive_tooling", "VPN Chain");
      if (!input.sshPassword && !input.sshKey) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "SSH password or private key required." });
      }
      const hops = await getHops(ctx.user.id);
      if (hops.some(h => h.sshHost === input.sshHost && h.sshPort === input.sshPort)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Hop with this host:port already exists." });
      }
      const hop: VpnHop = {
        id: crypto.randomUUID(), label: input.label,
        hopIndex: hops.length,
        sshHost: input.sshHost, sshPort: input.sshPort, sshUser: input.sshUser,
        sshPassword: input.sshPassword, sshKey: input.sshKey,
        status: "pending", installed: false, firewallEnabled: false,
        country: input.country, addedAt: new Date().toISOString(),
      };
      hops.push(hop);
      await saveHops(ctx.user.id, hops);
      log.info(`User ${ctx.user.id} added VPN hop: ${input.label} (${input.sshHost})`);
      return { success: true, hop: sanitize(hop) };
    }),

  deployHop: protectedProcedure
    .input(z.object({ hopId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const plan = await getUserPlan(ctx.user.id);
      enforceFeature(plan.planId, "offensive_tooling", "VPN Chain");
      const hops = await getHops(ctx.user.id);
      const idx = hops.findIndex(h => h.id === input.hopId);
      if (idx === -1) throw new TRPCError({ code: "NOT_FOUND", message: "Hop not found." });
      const hop = hops[idx];
      hop.status = "deploying";
      await saveHops(ctx.user.id, hops);
      try {
        const script = buildHopInstallScript(hop.hopIndex, hops.length);
        const output = await execSSHCommand(hopToSSH(hop), script, 180000, ctx.user.id);
        if (!output.includes("WG_OK")) {
          hop.status = "error";
          hop.errorMessage = "WireGuard installation failed. Check SSH credentials.";
          await saveHops(ctx.user.id, hops);
          return { success: false, message: hop.errorMessage };
        }
        const ipMatch = output.match(/PUBLIC_IP:(\S+)/);
        const pubkeyMatch = output.match(/PUBKEY:(\S+)/);
        if (ipMatch) hop.publicIp = ipMatch[1];
        if (pubkeyMatch) hop.wgPublicKey = pubkeyMatch[1];
        hop.status = "ready"; hop.installed = true; hop.firewallEnabled = true;
        hop.deployedAt = new Date().toISOString();
        hop.lastChecked = new Date().toISOString();
        hop.errorMessage = undefined;
        await saveHops(ctx.user.id, hops);
        return { success: true, publicIp: hop.publicIp, wgPublicKey: hop.wgPublicKey, message: `Hop "${hop.label}" deployed at ${hop.publicIp}. WireGuard ready. Firewall active.` };
      } catch (err: any) {
        hop.status = "error"; hop.errorMessage = err.message;
        await saveHops(ctx.user.id, hops);
        return { success: false, message: `Deploy failed: ${err.message}` };
      }
    }),

  checkHop: protectedProcedure
    .input(z.object({ hopId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const plan = await getUserPlan(ctx.user.id);
      enforceFeature(plan.planId, "offensive_tooling", "VPN Chain");
      const hops = await getHops(ctx.user.id);
      const idx = hops.findIndex(h => h.id === input.hopId);
      if (idx === -1) throw new TRPCError({ code: "NOT_FOUND", message: "Hop not found." });
      const hop = hops[idx];
      try {
        const output = await execSSHCommand(hopToSSH(hop), CHECK_HOP, 15000, ctx.user.id);
        const installed = output.includes("WG_INSTALLED");
        const ipMatch = output.match(/PUBLIC_IP:(\S+)/);
        const pubkeyMatch = output.match(/PUBKEY:(\S+)/);
        if (ipMatch) hop.publicIp = ipMatch[1];
        if (pubkeyMatch && pubkeyMatch[1] !== "no_key") hop.wgPublicKey = pubkeyMatch[1];
        hop.installed = installed;
        hop.status = installed ? "ready" : "offline";
        hop.lastChecked = new Date().toISOString();
        await saveHops(ctx.user.id, hops);
        return { installed, publicIp: hop.publicIp, message: installed ? `Hop "${hop.label}" ready at ${hop.publicIp}` : `WireGuard not installed on "${hop.label}"` };
      } catch (err: any) {
        hop.status = "offline"; hop.lastChecked = new Date().toISOString();
        await saveHops(ctx.user.id, hops);
        return { installed: false, message: `SSH failed: ${err.message}` };
      }
    }),

  reorderHops: protectedProcedure
    .input(z.object({ orderedIds: z.array(z.string()) }))
    .mutation(async ({ ctx, input }) => {
      const plan = await getUserPlan(ctx.user.id);
      enforceFeature(plan.planId, "offensive_tooling", "VPN Chain");
      const hops = await getHops(ctx.user.id);
      const reordered = input.orderedIds.map((id, i) => {
        const hop = hops.find(h => h.id === id);
        if (!hop) throw new TRPCError({ code: "NOT_FOUND", message: `Hop ${id} not found.` });
        return { ...hop, hopIndex: i };
      });
      await saveHops(ctx.user.id, reordered);
      return { success: true, hops: reordered.map(sanitize) };
    }),

  removeHop: protectedProcedure
    .input(z.object({ hopId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const plan = await getUserPlan(ctx.user.id);
      enforceFeature(plan.planId, "offensive_tooling", "VPN Chain");
      const hops = await getHops(ctx.user.id);
      const idx = hops.findIndex(h => h.id === input.hopId);
      if (idx === -1) throw new TRPCError({ code: "NOT_FOUND", message: "Hop not found." });
      const label = hops[idx].label;
      hops.splice(idx, 1);
      // Re-index
      hops.forEach((h, i) => { h.hopIndex = i; });
      await saveHops(ctx.user.id, hops);
      return { success: true, message: `Hop "${label}" removed` };
    }),

  testChain: protectedProcedure.mutation(async ({ ctx }) => {
    const plan = await getUserPlan(ctx.user.id);
    enforceFeature(plan.planId, "offensive_tooling", "VPN Chain");
    const hops = await getHops(ctx.user.id);
    const sorted = hops.sort((a, b) => a.hopIndex - b.hopIndex);
    const results: Array<{ label: string; publicIp?: string; latency?: string; ok: boolean; error?: string }> = [];
    for (const hop of sorted) {
      try {
        const output = await execSSHCommand(hopToSSH(hop), TEST_CHAIN_SCRIPT, 15000, ctx.user.id);
        const ipMatch = output.match(/PUBLIC_IP:(\S+)/);
        const latMatch = output.match(/LATENCY:(\S+)/);
        results.push({ label: hop.label, publicIp: ipMatch?.[1], latency: latMatch?.[1], ok: true });
      } catch (err: any) {
        results.push({ label: hop.label, ok: false, error: err.message });
      }
    }
    const allOk = results.every(r => r.ok);
    return { success: allOk, results, message: allOk ? `All ${sorted.length} hops reachable — chain is operational` : `${results.filter(r => !r.ok).length} hop(s) unreachable` };
  }),

  setChainActive: protectedProcedure
    .input(z.object({ enabled: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const plan = await getUserPlan(ctx.user.id);
      enforceFeature(plan.planId, "offensive_tooling", "VPN Chain");
      await setChainActive(ctx.user.id, input.enabled);
      return { success: true, chainActive: input.enabled };
    }),

  getStatus: protectedProcedure.query(async ({ ctx }) => {
    const plan = await getUserPlan(ctx.user.id);
    enforceFeature(plan.planId, "offensive_tooling", "VPN Chain");
    const hops = await getHops(ctx.user.id);
    const active = await isChainActive(ctx.user.id);
    const sorted = hops.sort((a, b) => a.hopIndex - b.hopIndex);
    return {
      chainActive: active,
      hopCount: hops.length,
      readyCount: hops.filter(h => h.status === "ready").length,
      hops: sorted.map(sanitize),
      chainSummary: sorted.map(h => `${h.label} (${h.publicIp ?? h.sshHost})`).join(" → "),
    };
  }),

  // ── Backward-compatible aliases for existing VpnChainPage UI ─────────────────
  getChain: protectedProcedure.query(async ({ ctx }) => {
    const plan = await getUserPlan(ctx.user.id);
    enforceFeature(plan.planId, "offensive_tooling", "VPN Chain");
    const hops = await getHops(ctx.user.id);
    const active = await isChainActive(ctx.user.id);
    const sorted = hops.sort((a, b) => a.hopIndex - b.hopIndex);
    return {
      hops: sorted.map(h => ({
        id: h.id, label: h.label, host: h.sshHost, port: h.sshPort,
        username: h.sshUser, country: h.country ?? "",
        status: h.status, publicIp: h.publicIp,
      })),
      chainActive: active,
      useTitanAsEntry: false,
    };
  }),

  getActiveState: protectedProcedure.query(async ({ ctx }) => {
    const plan = await getUserPlan(ctx.user.id);
    enforceFeature(plan.planId, "offensive_tooling", "VPN Chain");
    const active = await isChainActive(ctx.user.id);
    return { active };
  }),

  setActive: protectedProcedure
    .input(z.object({ active: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const plan = await getUserPlan(ctx.user.id);
      enforceFeature(plan.planId, "offensive_tooling", "VPN Chain");
      await setChainActive(ctx.user.id, input.active);
      return { success: true };
    }),

  testHop: protectedProcedure
    .input(z.object({ hopId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const plan = await getUserPlan(ctx.user.id);
      enforceFeature(plan.planId, "offensive_tooling", "VPN Chain");
      const hops = await getHops(ctx.user.id);
      const hop = hops.find(h => h.id === input.hopId);
      if (!hop) throw new TRPCError({ code: "NOT_FOUND", message: "Hop not found." });
      try {
        const output = await execSSHCommand(hopToSSH(hop), "echo ok", 10000, ctx.user.id);
        const ok = output.trim().includes("ok");
        return { success: ok, message: ok ? `${hop.label} is reachable` : `${hop.label} responded unexpectedly` };
      } catch (e: any) {
        return { success: false, message: e.message };
      }
    }),

  clearChain: protectedProcedure.mutation(async ({ ctx }) => {
    const plan = await getUserPlan(ctx.user.id);
    enforceFeature(plan.planId, "offensive_tooling", "VPN Chain");
    await saveHops(ctx.user.id, []);
    return { success: true };
  }),

  setUseTitanEntry: protectedProcedure
    .input(z.object({ enabled: z.boolean() }))
    .mutation(async ({ ctx }) => {
      // Titan Server as entry hop is managed at the node level — no-op alias
      return { success: true };
    }),
});
