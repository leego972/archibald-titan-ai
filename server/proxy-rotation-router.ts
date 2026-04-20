/**
 * Proxy Rotation Router
 *
 * Zero-VPS proxy rotation for Titan's server-side fetch requests.
 * Users paste a list of SOCKS5/HTTP proxies (from any provider).
 * Titan rotates through them for all outbound fetch/scrape requests.
 *
 * Proxy list format (one per line):
 *   socks5://user:pass@host:port
 *   http://user:pass@host:port
 *   host:port:user:pass          (auto-detected as http)
 *   host:port                    (no auth)
 *
 * Storage: encrypted in userSecrets table (same pattern as VPN Chain).
 * Global state: in-memory rotation index per user, persisted to DB.
 */

import { z } from "zod";
import { router, protectedProcedure } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { enforceAdminFeature } from "./subscription-gate";
import { getDb } from "./db";
import { userSecrets } from "../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { encrypt, decrypt } from "./fetcher-db";
import { createLogger } from "./_core/logger.js";
import { consumeCredits, checkCredits } from "./credit-service";
import { getErrorMessage } from "./_core/errors.js";

const log = createLogger("ProxyRotation");

const SECRET_PROXIES = "__proxy_rotation_list";
const SECRET_ACTIVE  = "__proxy_rotation_active";
const SECRET_INDEX   = "__proxy_rotation_index";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RotationProxy {
  id: string;
  raw: string;           // original line as pasted
  protocol: "http" | "https" | "socks5";
  host: string;
  port: number;
  username?: string;
  password?: string;
  addedAt: string;
  lastUsed?: string;
  requestCount: number;
  healthy?: boolean;
  latencyMs?: number;
  externalIp?: string;
  errorCount: number;
}

// ─── Parse a proxy string into structured form ────────────────────────────────

export function parseProxyLine(line: string): Omit<RotationProxy, "id" | "addedAt" | "requestCount" | "errorCount"> | null {
  line = line.trim();
  if (!line || line.startsWith("#")) return null;

  // Format: protocol://[user:pass@]host:port
  const urlMatch = line.match(/^(socks5|socks4|http|https):\/\/(?:([^:@]+):([^@]+)@)?([^:]+):(\d+)/i);
  if (urlMatch) {
    const [, proto, user, pass, host, portStr] = urlMatch;
    const protocol = proto.toLowerCase() === "socks5" || proto.toLowerCase() === "socks4" ? "socks5" : "http";
    return { raw: line, protocol, host, port: parseInt(portStr), username: user || undefined, password: pass || undefined };
  }

  // Format: host:port:user:pass
  const colonMatch = line.match(/^([^:]+):(\d+):([^:]+):(.+)$/);
  if (colonMatch) {
    const [, host, portStr, user, pass] = colonMatch;
    return { raw: line, protocol: "http", host, port: parseInt(portStr), username: user, password: pass };
  }

  // Format: host:port (no auth)
  const simpleMatch = line.match(/^([^:]+):(\d+)$/);
  if (simpleMatch) {
    const [, host, portStr] = simpleMatch;
    return { raw: line, protocol: "http", host, port: parseInt(portStr) };
  }

  return null;
}

// ─── DB helpers ───────────────────────────────────────────────────────────────

async function getProxyList(userId: number): Promise<RotationProxy[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select().from(userSecrets)
    .where(and(eq(userSecrets.userId, userId), eq(userSecrets.secretType, SECRET_PROXIES))).limit(1);
  if (!rows.length) return [];
  try { return JSON.parse(decrypt(rows[0].encryptedValue)) as RotationProxy[]; } catch { return []; }
}

async function saveProxyList(userId: number, proxies: RotationProxy[]): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const enc = encrypt(JSON.stringify(proxies));
  const ex = await db.select().from(userSecrets)
    .where(and(eq(userSecrets.userId, userId), eq(userSecrets.secretType, SECRET_PROXIES))).limit(1);
  if (ex.length) {
    await db.update(userSecrets).set({ encryptedValue: enc, updatedAt: new Date() }).where(eq(userSecrets.id, ex[0].id));
  } else {
    await db.insert(userSecrets).values({ userId, secretType: SECRET_PROXIES, label: "Proxy Rotation List", encryptedValue: enc });
  }
}

async function isRotationActive(userId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const rows = await db.select().from(userSecrets)
    .where(and(eq(userSecrets.userId, userId), eq(userSecrets.secretType, SECRET_ACTIVE))).limit(1);
  if (!rows.length) return false;
  try { return decrypt(rows[0].encryptedValue) === "true"; } catch { return false; }
}

async function setRotationActiveFlag(userId: number, active: boolean): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const enc = encrypt(active ? "true" : "false");
  const ex = await db.select().from(userSecrets)
    .where(and(eq(userSecrets.userId, userId), eq(userSecrets.secretType, SECRET_ACTIVE))).limit(1);
  if (ex.length) {
    await db.update(userSecrets).set({ encryptedValue: enc, updatedAt: new Date() }).where(eq(userSecrets.id, ex[0].id));
  } else {
    await db.insert(userSecrets).values({ userId, secretType: SECRET_ACTIVE, label: "Proxy Rotation Active", encryptedValue: enc });
  }
}

async function getRotationIndex(userId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const rows = await db.select().from(userSecrets)
    .where(and(eq(userSecrets.userId, userId), eq(userSecrets.secretType, SECRET_INDEX))).limit(1);
  if (!rows.length) return 0;
  try { return parseInt(decrypt(rows[0].encryptedValue)) || 0; } catch { return 0; }
}

async function saveRotationIndex(userId: number, index: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const enc = encrypt(String(index));
  const ex = await db.select().from(userSecrets)
    .where(and(eq(userSecrets.userId, userId), eq(userSecrets.secretType, SECRET_INDEX))).limit(1);
  if (ex.length) {
    await db.update(userSecrets).set({ encryptedValue: enc, updatedAt: new Date() }).where(eq(userSecrets.id, ex[0].id));
  } else {
    await db.insert(userSecrets).values({ userId, secretType: SECRET_INDEX, label: "Proxy Rotation Index", encryptedValue: enc });
  }
}

// ─── Public API: get next proxy for a user (used by fetcher engine) ───────────

export async function getNextProxy(userId: number): Promise<RotationProxy | null> {
  const active = await isRotationActive(userId);
  if (!active) return null;
  const proxies = await getProxyList(userId);
  const healthy = proxies.filter(p => p.healthy !== false); // include untested (undefined) and healthy
  if (!healthy.length) return null;
  const idx = await getRotationIndex(userId);
  const next = healthy[idx % healthy.length];
  await saveRotationIndex(userId, (idx + 1) % healthy.length);
  // Update last used + request count (fire and forget)
  const allIdx = proxies.findIndex(p => p.id === next.id);
  if (allIdx !== -1) {
    proxies[allIdx].lastUsed = new Date().toISOString();
    proxies[allIdx].requestCount = (proxies[allIdx].requestCount || 0) + 1;
    saveProxyList(userId, proxies).catch(() => {});
  }
  return next;
}

export function buildProxyUrl(proxy: RotationProxy): string {
  const auth = proxy.username && proxy.password
    ? `${encodeURIComponent(proxy.username)}:${encodeURIComponent(proxy.password)}@`
    : proxy.username
    ? `${encodeURIComponent(proxy.username)}@`
    : "";
  return `${proxy.protocol}://${auth}${proxy.host}:${proxy.port}`;
}

// ─── Test a single proxy ──────────────────────────────────────────────────────

async function testProxy(proxy: RotationProxy): Promise<{ healthy: boolean; latencyMs: number; externalIp: string | null; error: string | null }> {
  const start = Date.now();
  try {
    const proxyUrl = buildProxyUrl(proxy);
    let agent: any;
    if (proxy.protocol === "socks5") {
      const { SocksProxyAgent } = await import("socks-proxy-agent");
      agent = new SocksProxyAgent(proxyUrl);
    } else {
      const { HttpsProxyAgent } = await import("https-proxy-agent");
      agent = new HttpsProxyAgent(proxyUrl);
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    const res = await fetch("https://api.ipify.org?format=json", {
      signal: controller.signal,
      agent,
    } as any);
    clearTimeout(timeout);
    const latencyMs = Date.now() - start;
    if (!res.ok) return { healthy: false, latencyMs, externalIp: null, error: `HTTP ${res.status}` };
    const data = await res.json() as { ip: string };
    return { healthy: true, latencyMs, externalIp: data.ip, error: null };
  } catch (e: any) {
    return { healthy: false, latencyMs: Date.now() - start, externalIp: null, error: e.message };
  }
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const proxyRotationRouter = router({

  /** Get current state: proxy list + active flag */
  getState: protectedProcedure.query(async ({ ctx }) => {
    enforceAdminFeature(ctx.user.role, "Proxy Rotation");
    const [proxies, active] = await Promise.all([
      getProxyList(ctx.user.id),
      isRotationActive(ctx.user.id),
    ]);
    const healthyCount = proxies.filter(p => p.healthy === true).length;
    const totalRequests = proxies.reduce((s, p) => s + (p.requestCount || 0), 0);
    return {
      active,
      proxies: proxies.map(p => ({
        id: p.id,
        raw: p.raw,
        protocol: p.protocol,
        host: p.host,
        port: p.port,
        username: p.username,
        addedAt: p.addedAt,
        lastUsed: p.lastUsed,
        requestCount: p.requestCount,
        healthy: p.healthy,
        latencyMs: p.latencyMs,
        externalIp: p.externalIp,
        errorCount: p.errorCount,
        // Never expose password
      })),
      totalCount: proxies.length,
      healthyCount,
      totalRequests,
    };
  }),

  /** Import a bulk proxy list (newline-separated) */
  importList: protectedProcedure
    .input(z.object({
      text: z.string().min(1).max(500000),
      replace: z.boolean().default(false), // if true, replaces existing list
    }))
    .mutation(async ({ ctx, input }) => {
    enforceAdminFeature(ctx.user.role, "Proxy Rotation");
      const lines = input.text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      const parsed: RotationProxy[] = [];
      let skipped = 0;
      for (const line of lines) {
        const p = parseProxyLine(line);
        if (!p) { skipped++; continue; }
        parsed.push({
          id: crypto.randomUUID(),
          ...p,
          addedAt: new Date().toISOString(),
          requestCount: 0,
          errorCount: 0,
        });
      }
      if (!parsed.length) throw new TRPCError({ code: "BAD_REQUEST", message: "No valid proxies found. Use format: host:port, host:port:user:pass, or socks5://user:pass@host:port" });

      const existing = input.replace ? [] : await getProxyList(ctx.user.id);
      // Deduplicate by host:port
      const seen = new Set(existing.map(p => `${p.host}:${p.port}`));
      const newOnes = parsed.filter(p => !seen.has(`${p.host}:${p.port}`));
      const combined = [...existing, ...newOnes];
      await saveProxyList(ctx.user.id, combined);
      log.info(`User ${ctx.user.id} imported ${newOnes.length} proxies (${skipped} skipped, ${parsed.length - newOnes.length} duplicates)`);
      return { added: newOnes.length, skipped, duplicates: parsed.length - newOnes.length, total: combined.length };
    }),

  /** Add a single proxy */
  addProxy: protectedProcedure
    .input(z.object({
      protocol: z.enum(["http", "https", "socks5"]).default("http"),
      host: z.string().min(1),
      port: z.number().int().min(1).max(65535),
      username: z.string().optional(),
      password: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
    enforceAdminFeature(ctx.user.role, "Proxy Rotation");
      const proxies = await getProxyList(ctx.user.id);
      if (proxies.some(p => p.host === input.host && p.port === input.port)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Proxy with this host:port already exists." });
      }
      const auth = input.username && input.password ? `${input.username}:${input.password}@` : "";
      const raw = `${input.protocol}://${auth}${input.host}:${input.port}`;
      const proxy: RotationProxy = {
        id: crypto.randomUUID(),
        raw,
        protocol: input.protocol,
        host: input.host,
        port: input.port,
        username: input.username,
        password: input.password,
        addedAt: new Date().toISOString(),
        requestCount: 0,
        errorCount: 0,
      };
      proxies.push(proxy);
      await saveProxyList(ctx.user.id, proxies);
      return { success: true, id: proxy.id };
    }),

  /** Remove a proxy */
  removeProxy: protectedProcedure
    .input(z.object({ proxyId: z.string() }))
    .mutation(async ({ ctx, input }) => {
    enforceAdminFeature(ctx.user.role, "Proxy Rotation");
      const proxies = await getProxyList(ctx.user.id);
      const filtered = proxies.filter(p => p.id !== input.proxyId);
      if (filtered.length === proxies.length) throw new TRPCError({ code: "NOT_FOUND", message: "Proxy not found." });
      await saveProxyList(ctx.user.id, filtered);
      return { success: true, remaining: filtered.length };
    }),

  /** Clear all proxies */
  clearAll: protectedProcedure.mutation(async ({ ctx }) => {
    enforceAdminFeature(ctx.user.role, "Proxy Rotation");
    await saveProxyList(ctx.user.id, []);
    await setRotationActiveFlag(ctx.user.id, false);
    return { success: true };
  }),

  /** Toggle rotation on/off */
  setActive: protectedProcedure
    .input(z.object({ active: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
    enforceAdminFeature(ctx.user.role, "Proxy Rotation");
      if (input.active) {
        const proxies = await getProxyList(ctx.user.id);
        if (!proxies.length) throw new TRPCError({ code: "BAD_REQUEST", message: "No proxies configured. Import a proxy list first." });
      }
      await setRotationActiveFlag(ctx.user.id, input.active);
      log.info(`User ${ctx.user.id} ${input.active ? "enabled" : "disabled"} proxy rotation`);
      return { success: true, active: input.active };
    }),

  /** Get active state (for sidebar button) */
  getActiveState: protectedProcedure.query(async ({ ctx }) => {
    enforceAdminFeature(ctx.user.role, "Proxy Rotation");
    const [active, proxies] = await Promise.all([
      isRotationActive(ctx.user.id),
      getProxyList(ctx.user.id),
    ]);
    return { active, proxyCount: proxies.length, hasProxies: proxies.length > 0 };
  }),

  /** Test a specific proxy */
  testProxy: protectedProcedure
    .input(z.object({ proxyId: z.string() }))
    .mutation(async ({ ctx, input }) => {
    enforceAdminFeature(ctx.user.role, "Proxy Rotation");
      const proxies = await getProxyList(ctx.user.id);
      const idx = proxies.findIndex(p => p.id === input.proxyId);
      if (idx === -1) throw new TRPCError({ code: "NOT_FOUND", message: "Proxy not found." });
      const result = await testProxy(proxies[idx]);
      proxies[idx].healthy = result.healthy;
      proxies[idx].latencyMs = result.latencyMs;
      proxies[idx].externalIp = result.externalIp ?? undefined;
      if (!result.healthy) proxies[idx].errorCount = (proxies[idx].errorCount || 0) + 1;
      await saveProxyList(ctx.user.id, proxies);
      return result;
    }),

  /** Test all proxies (health check sweep) */
  testAll: protectedProcedure.mutation(async ({ ctx }) => {
    enforceAdminFeature(ctx.user.role, "Proxy Rotation");
    const creditCheck = await checkCredits(ctx.user.id, "proxy_test_all");
    if (!creditCheck.allowed) {
      throw new TRPCError({ code: "FORBIDDEN", message: `Insufficient credits to test proxies. Need ${creditCheck.cost}, have ${creditCheck.currentBalance}.` });
    }
    const proxies = await getProxyList(ctx.user.id);
    if (!proxies.length) throw new TRPCError({ code: "BAD_REQUEST", message: "No proxies to test." });
    // Test up to 20 at a time concurrently
    const results: Array<{ id: string; healthy: boolean; latencyMs: number; externalIp: string | null; error: string | null }> = [];
    const BATCH = 10;
    for (let i = 0; i < proxies.length; i += BATCH) {
      const batch = proxies.slice(i, i + BATCH);
      const batchResults = await Promise.all(batch.map(p => testProxy(p).then(r => ({ id: p.id, ...r }))));
      results.push(...batchResults);
      // Update proxy health in list
      for (const r of batchResults) {
        const pi = proxies.findIndex(p => p.id === r.id);
        if (pi !== -1) {
          proxies[pi].healthy = r.healthy;
          proxies[pi].latencyMs = r.latencyMs;
          proxies[pi].externalIp = r.externalIp ?? undefined;
          if (!r.healthy) proxies[pi].errorCount = (proxies[pi].errorCount || 0) + 1;
        }
      }
    }
    await saveProxyList(ctx.user.id, proxies);
    try {
      const _cr1 = await consumeCredits(ctx.user.id, "proxy_test_all", `Proxy health check: ${results.length} proxies`);
      if (!_cr1.success) throw new TRPCError({ code: "FORBIDDEN", message: "Insufficient credits. Purchase more credits or upgrade your plan." });
    } catch (e) {
      log.warn("[ProxyRotation] Credit consumption failed (non-fatal):", { error: getErrorMessage(e) });
    }
    const healthyCount = results.filter(r => r.healthy).length;
    return { tested: results.length, healthy: healthyCount, dead: results.length - healthyCount, results };
  }),
});
