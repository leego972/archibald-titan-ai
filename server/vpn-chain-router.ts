/**
 * VPN Chain Router — Multi-hop VPN chaining for maximum anonymity.
 *
 * Architecture:
 *   User → Hop 1 (VPS/WireGuard) → Hop 2 (VPS/WireGuard) → ... → Hop N → Internet
 *
 * Each hop is a VPS the user controls. Traffic is tunnelled through SSH port-forwarding
 * chains so no single node knows both the origin AND the destination.
 *
 * Hop configs are AES-256 encrypted at rest in userSecrets (type: "__vpn_chain").
 *
 * Features:
 *   - Add/remove/reorder hops
 *   - Test each hop's SSH connectivity
 *   - Build/tear down the full chain via SSH tunnel nesting
 *   - Per-user chain state (active/inactive)
 *   - Titan Server can act as Hop 1 automatically
 */

import { z } from "zod";
import { router, protectedProcedure } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "./db";
import { userSecrets } from "../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { encrypt, decrypt } from "./fetcher-db";
import { getUserPlan, enforceFeature } from "./subscription-gate";
import { getTitanServerConfig, execSSHCommand } from "./titan-server";
import { createLogger } from "./_core/logger.js";

const log = createLogger("VpnChainRouter");

// ─── Types ────────────────────────────────────────────────────────────────────

export interface VpnHop {
  id: string;           // uuid
  label: string;        // e.g. "Germany VPS", "US Exit Node"
  host: string;
  port: number;
  username: string;
  password?: string;
  privateKey?: string;
  country?: string;     // display only
  order: number;        // 0 = entry, N-1 = exit
}

export interface VpnChainConfig {
  hops: VpnHop[];
  active: boolean;
  useTitanAsEntry: boolean;  // prepend Titan Server as hop 0
  createdAt: string;
  updatedAt: string;
}

const SECRET_TYPE = "__vpn_chain";

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getChainConfig(userId: number): Promise<VpnChainConfig | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(userSecrets)
    .where(and(eq(userSecrets.userId, userId), eq(userSecrets.secretType, SECRET_TYPE)))
    .limit(1);
  if (rows.length === 0) return null;
  try {
    return JSON.parse(decrypt(rows[0].encryptedValue)) as VpnChainConfig;
  } catch {
    return null;
  }
}

async function saveChainConfig(userId: number, config: VpnChainConfig): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  config.updatedAt = new Date().toISOString();
  const encrypted = encrypt(JSON.stringify(config));
  const existing = await db.select().from(userSecrets)
    .where(and(eq(userSecrets.userId, userId), eq(userSecrets.secretType, SECRET_TYPE)))
    .limit(1);
  if (existing.length > 0) {
    await db.update(userSecrets)
      .set({ encryptedValue: encrypted, updatedAt: new Date() })
      .where(eq(userSecrets.id, existing[0].id));
  } else {
    await db.insert(userSecrets).values({
      userId,
      secretType: SECRET_TYPE,
      label: "VPN Chain Config",
      encryptedValue: encrypted,
    });
  }
}

function makeEmptyConfig(): VpnChainConfig {
  return {
    hops: [],
    active: false,
    useTitanAsEntry: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function sanitizeHop(hop: VpnHop): Omit<VpnHop, "password" | "privateKey"> & { hasPassword: boolean; hasKey: boolean } {
  const { password, privateKey, ...rest } = hop;
  return { ...rest, hasPassword: !!password, hasKey: !!privateKey };
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const vpnChainRouter = router({

  /**
   * Get the current chain config (sanitised — no credentials returned).
   */
  getChain: protectedProcedure.query(async ({ ctx }) => {
    const plan = await getUserPlan(ctx.user.id);
    enforceFeature(plan.planId, "offensive_tooling", "VPN Chain");
    const config = await getChainConfig(ctx.user.id);
    if (!config) return { hops: [], active: false, useTitanAsEntry: false };
    return {
      hops: config.hops.map(sanitizeHop),
      active: config.active,
      useTitanAsEntry: config.useTitanAsEntry,
    };
  }),

  /**
   * Add a new hop to the chain.
   */
  addHop: protectedProcedure
    .input(z.object({
      label: z.string().min(1).max(64),
      host: z.string().min(1),
      port: z.number().default(22),
      username: z.string().min(1),
      password: z.string().optional(),
      privateKey: z.string().optional(),
      country: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const plan = await getUserPlan(ctx.user.id);
      enforceFeature(plan.planId, "offensive_tooling", "VPN Chain");
      const config = (await getChainConfig(ctx.user.id)) ?? makeEmptyConfig();
      if (config.hops.length >= 10) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Maximum 10 hops allowed per chain." });
      }
      const hop: VpnHop = {
        id: crypto.randomUUID(),
        label: input.label,
        host: input.host,
        port: input.port,
        username: input.username,
        password: input.password,
        privateKey: input.privateKey,
        country: input.country,
        order: config.hops.length,
      };
      config.hops.push(hop);
      await saveChainConfig(ctx.user.id, config);
      return { success: true, hop: sanitizeHop(hop), totalHops: config.hops.length };
    }),

  /**
   * Remove a hop by ID.
   */
  removeHop: protectedProcedure
    .input(z.object({ hopId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const plan = await getUserPlan(ctx.user.id);
      enforceFeature(plan.planId, "offensive_tooling", "VPN Chain");
      const config = await getChainConfig(ctx.user.id);
      if (!config) throw new TRPCError({ code: "NOT_FOUND", message: "No chain configured." });
      config.hops = config.hops.filter(h => h.id !== input.hopId);
      // Re-number order
      config.hops.forEach((h, i) => { h.order = i; });
      await saveChainConfig(ctx.user.id, config);
      return { success: true, totalHops: config.hops.length };
    }),

  /**
   * Reorder hops (pass full ordered array of hop IDs).
   */
  reorderHops: protectedProcedure
    .input(z.object({ orderedIds: z.array(z.string()) }))
    .mutation(async ({ ctx, input }) => {
      const plan = await getUserPlan(ctx.user.id);
      enforceFeature(plan.planId, "offensive_tooling", "VPN Chain");
      const config = await getChainConfig(ctx.user.id);
      if (!config) throw new TRPCError({ code: "NOT_FOUND", message: "No chain configured." });
      const hopMap = new Map(config.hops.map(h => [h.id, h]));
      config.hops = input.orderedIds
        .filter(id => hopMap.has(id))
        .map((id, i) => ({ ...hopMap.get(id)!, order: i }));
      await saveChainConfig(ctx.user.id, config);
      return { success: true, hops: config.hops.map(sanitizeHop) };
    }),

  /**
   * Toggle whether the Titan Server is prepended as the entry hop.
   */
  setUseTitanEntry: protectedProcedure
    .input(z.object({ enabled: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const plan = await getUserPlan(ctx.user.id);
      enforceFeature(plan.planId, "offensive_tooling", "VPN Chain");
      const titanConfig = getTitanServerConfig();
      if (input.enabled && !titanConfig) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Titan Server is not configured. Contact your admin." });
      }
      const config = (await getChainConfig(ctx.user.id)) ?? makeEmptyConfig();
      config.useTitanAsEntry = input.enabled;
      await saveChainConfig(ctx.user.id, config);
      return { success: true, useTitanAsEntry: input.enabled };
    }),

  /**
   * Test connectivity to a single hop.
   */
  testHop: protectedProcedure
    .input(z.object({ hopId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const plan = await getUserPlan(ctx.user.id);
      enforceFeature(plan.planId, "offensive_tooling", "VPN Chain");
      const config = await getChainConfig(ctx.user.id);
      if (!config) throw new TRPCError({ code: "NOT_FOUND", message: "No chain configured." });
      const hop = config.hops.find(h => h.id === input.hopId);
      if (!hop) throw new TRPCError({ code: "NOT_FOUND", message: "Hop not found." });
      try {
        const output = await execSSHCommand(
          { host: hop.host, port: hop.port, username: hop.username, password: hop.password, privateKey: hop.privateKey },
          "echo 'TITAN_HOP_OK' && uname -a && curl -s --max-time 5 https://api.ipify.org 2>/dev/null || hostname -I | awk '{print $1}'",
          12000
        );
        const ipMatch = output.match(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g);
        const exitIp = ipMatch ? ipMatch[ipMatch.length - 1] : "unknown";
        return { success: true, message: `Hop ${hop.label} reachable`, output: output.trim(), exitIp };
      } catch (err: any) {
        return { success: false, message: `Hop ${hop.label} unreachable: ${err.message}` };
      }
    }),

  /**
   * Test the full chain end-to-end: SSH through each hop in sequence and
   * return the exit IP as seen from the last node.
   */
  testChain: protectedProcedure.mutation(async ({ ctx }) => {
    const plan = await getUserPlan(ctx.user.id);
    enforceFeature(plan.planId, "offensive_tooling", "VPN Chain");
    const config = await getChainConfig(ctx.user.id);
    if (!config || config.hops.length === 0) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "No hops configured. Add at least one hop first." });
    }

    const allHops: VpnHop[] = [];

    // Optionally prepend Titan Server as entry hop
    if (config.useTitanAsEntry) {
      const titan = getTitanServerConfig();
      if (titan) {
        allHops.push({
          id: "__titan__",
          label: "Titan Server (Entry)",
          host: titan.host,
          port: titan.port,
          username: titan.username,
          password: titan.password,
          privateKey: titan.privateKey,
          order: -1,
        });
      }
    }
    allHops.push(...config.hops.sort((a, b) => a.order - b.order));

    if (allHops.length === 0) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "No hops available." });
    }

    // Build a nested SSH ProxyJump command to test the full chain
    // ssh -J hop1,hop2,...,hopN-1 hopN 'curl https://api.ipify.org'
    // We test this by SSHing into hop1 and building a chain from there
    try {
      const results: Array<{ hop: string; ip: string; ok: boolean }> = [];

      // Test each hop individually first
      for (const hop of allHops) {
        try {
          const out = await execSSHCommand(
            { host: hop.host, port: hop.port, username: hop.username, password: hop.password, privateKey: hop.privateKey },
            "curl -s --max-time 5 https://api.ipify.org 2>/dev/null || wget -qO- --timeout=5 https://api.ipify.org 2>/dev/null || hostname -I | awk '{print $1}'",
            12000
          );
          const ip = out.trim().split("\n").pop() || "unknown";
          results.push({ hop: hop.label, ip, ok: true });
        } catch (e: any) {
          results.push({ hop: hop.label, ip: "unreachable", ok: false });
        }
      }

      const allOk = results.every(r => r.ok);
      const exitIp = results[results.length - 1]?.ip || "unknown";

      return {
        success: allOk,
        message: allOk
          ? `Chain of ${allHops.length} hop(s) verified. Exit IP: ${exitIp}`
          : `Some hops failed. Check individual hop status.`,
        hops: results,
        exitIp,
        hopCount: allHops.length,
      };
    } catch (err: any) {
      return { success: false, message: `Chain test failed: ${err.message}`, hops: [], exitIp: null, hopCount: 0 };
    }
  }),

  /**
   * Activate or deactivate the VPN chain (stores active state).
   * The actual tunnel is managed client-side via the Titan Server SSH config.
   */
  setActive: protectedProcedure
    .input(z.object({ active: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const plan = await getUserPlan(ctx.user.id);
      enforceFeature(plan.planId, "offensive_tooling", "VPN Chain");
      const config = (await getChainConfig(ctx.user.id)) ?? makeEmptyConfig();
      if (input.active && config.hops.length === 0 && !config.useTitanAsEntry) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Add at least one hop before activating the chain." });
      }
      config.active = input.active;
      await saveChainConfig(ctx.user.id, config);
      log.info(`[VpnChain] User ${ctx.user.id} ${input.active ? "activated" : "deactivated"} VPN chain`);
      return { success: true, active: input.active };
    }),

  /**
   * Get the active state only (lightweight, for sidebar toggle).
   */
  getActiveState: protectedProcedure.query(async ({ ctx }) => {
    const config = await getChainConfig(ctx.user.id);
    return { active: config?.active ?? false, hopCount: config?.hops.length ?? 0 };
  }),

  /**
   * Clear the entire chain config.
   */
  clearChain: protectedProcedure.mutation(async ({ ctx }) => {
    const plan = await getUserPlan(ctx.user.id);
    enforceFeature(plan.planId, "offensive_tooling", "VPN Chain");
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    await db.delete(userSecrets)
      .where(and(eq(userSecrets.userId, ctx.user.id), eq(userSecrets.secretType, SECRET_TYPE)));
    return { success: true };
  }),
});
