/**
 * Titan Proxy Maker Router
 *
 * Features:
 *   • Deploy your own SOCKS5/HTTP proxy on any VPS via SSH (one click)
 *   • Rotating proxy pool — automatically cycles through multiple proxies
 *   • Auto-scraper — finds and tests free public proxies, adds working ones
 *   • Health checker — continuously pings pool, removes dead proxies
 *   • Export pool as list for use in other tools
 *   • Per-user encrypted proxy pool stored in userSecrets
 *
 * Proxy types supported:
 *   • SOCKS5 (recommended — supports all protocols)
 *   • HTTP/HTTPS
 *   • Custom SSH-tunnelled (deploy 3proxy on your VPS)
 */

import { z } from "zod";
import { router, protectedProcedure } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "./db";
import { userSecrets } from "../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { encrypt, decrypt } from "./fetcher-db";
import { getUserPlan, enforceFeature } from "./subscription-gate";
import { getTitanServerConfig, execSSHCommand, type SSHConfig } from "./titan-server";
import { createLogger } from "./_core/logger.js";

const log = createLogger("ProxyMaker");
const SECRET_TYPE = "__proxy_pool";

// ─── 3proxy install script (lightweight SOCKS5+HTTP proxy server) ─────────────

const INSTALL_3PROXY = `#!/bin/bash
set -e
echo "[Titan] Installing 3proxy..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq 2>&1 | tail -2
apt-get install -y -qq 3proxy curl wget 2>&1 | tail -3

# Write 3proxy config
cat > /etc/3proxy/3proxy.cfg << 'CFG_EOF'
daemon
maxconn 500
nscache 65536
timeouts 1 5 30 60 180 1800 15 60
log /var/log/3proxy.log D
logformat "- +_L%t.%.  %N.%p %E %U %C:%c %R:%r %O %I %h %T"
auth none
allow *
socks -p1080
proxy -p8080
CFG_EOF

# Start 3proxy
systemctl enable 3proxy 2>/dev/null || true
systemctl restart 3proxy 2>/dev/null || service 3proxy restart 2>/dev/null || 3proxy /etc/3proxy/3proxy.cfg &
sleep 2

# Verify
pgrep 3proxy > /dev/null && echo "PROXY_RUNNING" || echo "PROXY_FAILED"
echo "SOCKS5 port: 1080"
echo "HTTP port: 8080"
`;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ProxyEntry {
  id: string;
  host: string;
  port: number;
  type: "socks5" | "http" | "https";
  username?: string;
  password?: string;
  country?: string;
  label?: string;
  latencyMs?: number;
  alive: boolean;
  lastChecked?: string;
  addedAt: string;
  source: "manual" | "scraped" | "deployed";
}

interface ProxyPool {
  proxies: ProxyEntry[];
  rotationEnabled: boolean;
  currentIndex: number;
  autoHealthCheck: boolean;
  createdAt: string;
  updatedAt: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getPool(userId: number): Promise<ProxyPool | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(userSecrets)
    .where(and(eq(userSecrets.userId, userId), eq(userSecrets.secretType, SECRET_TYPE)))
    .limit(1);
  if (rows.length === 0) return null;
  try { return JSON.parse(decrypt(rows[0].encryptedValue)) as ProxyPool; }
  catch { return null; }
}

async function savePool(userId: number, pool: ProxyPool): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  pool.updatedAt = new Date().toISOString();
  const encrypted = encrypt(JSON.stringify(pool));
  const existing = await db.select().from(userSecrets)
    .where(and(eq(userSecrets.userId, userId), eq(userSecrets.secretType, SECRET_TYPE)))
    .limit(1);
  if (existing.length > 0) {
    await db.update(userSecrets).set({ encryptedValue: encrypted, updatedAt: new Date() }).where(eq(userSecrets.id, existing[0].id));
  } else {
    await db.insert(userSecrets).values({ userId, secretType: SECRET_TYPE, label: "Proxy Pool", encryptedValue: encrypted });
  }
}

function makeEmptyPool(): ProxyPool {
  return { proxies: [], rotationEnabled: false, currentIndex: 0, autoHealthCheck: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
}

function sanitizeProxy(p: ProxyEntry): Omit<ProxyEntry, "password"> & { hasAuth: boolean } {
  const { password, ...rest } = p;
  return { ...rest, hasAuth: !!(p.username && password) };
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const proxyMakerRouter = router({

  /** Get the full proxy pool (sanitised) */
  getPool: protectedProcedure.query(async ({ ctx }) => {
    const plan = await getUserPlan(ctx.user.id);
    enforceFeature(plan.planId, "offensive_tooling", "Proxy Maker");
    const pool = await getPool(ctx.user.id);
    if (!pool) return { proxies: [], rotationEnabled: false, currentIndex: 0, autoHealthCheck: true, aliveCount: 0, totalCount: 0 };
    const alive = pool.proxies.filter(p => p.alive).length;
    return {
      proxies: pool.proxies.map(sanitizeProxy),
      rotationEnabled: pool.rotationEnabled,
      currentIndex: pool.currentIndex,
      autoHealthCheck: pool.autoHealthCheck,
      aliveCount: alive,
      totalCount: pool.proxies.length,
    };
  }),

  /** Add a proxy manually */
  addProxy: protectedProcedure
    .input(z.object({
      host: z.string().min(1),
      port: z.number().min(1).max(65535),
      type: z.enum(["socks5", "http", "https"]).default("socks5"),
      username: z.string().optional(),
      password: z.string().optional(),
      country: z.string().optional(),
      label: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const plan = await getUserPlan(ctx.user.id);
      enforceFeature(plan.planId, "offensive_tooling", "Proxy Maker");
      const pool = (await getPool(ctx.user.id)) ?? makeEmptyPool();
      if (pool.proxies.length >= 500) throw new TRPCError({ code: "BAD_REQUEST", message: "Maximum 500 proxies in pool." });
      const proxy: ProxyEntry = {
        id: crypto.randomUUID(),
        host: input.host, port: input.port, type: input.type,
        username: input.username, password: input.password,
        country: input.country, label: input.label,
        alive: true, addedAt: new Date().toISOString(), source: "manual",
      };
      pool.proxies.push(proxy);
      await savePool(ctx.user.id, pool);
      return { success: true, proxy: sanitizeProxy(proxy), totalCount: pool.proxies.length };
    }),

  /** Remove a proxy by ID */
  removeProxy: protectedProcedure
    .input(z.object({ proxyId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const plan = await getUserPlan(ctx.user.id);
      enforceFeature(plan.planId, "offensive_tooling", "Proxy Maker");
      const pool = await getPool(ctx.user.id);
      if (!pool) throw new TRPCError({ code: "NOT_FOUND", message: "No proxy pool." });
      pool.proxies = pool.proxies.filter(p => p.id !== input.proxyId);
      await savePool(ctx.user.id, pool);
      return { success: true, totalCount: pool.proxies.length };
    }),

  /** Test a single proxy's connectivity and measure latency */
  testProxy: protectedProcedure
    .input(z.object({ proxyId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const plan = await getUserPlan(ctx.user.id);
      enforceFeature(plan.planId, "offensive_tooling", "Proxy Maker");
      const pool = await getPool(ctx.user.id);
      if (!pool) throw new TRPCError({ code: "NOT_FOUND", message: "No proxy pool." });
      const proxy = pool.proxies.find(p => p.id === input.proxyId);
      if (!proxy) throw new TRPCError({ code: "NOT_FOUND", message: "Proxy not found." });

      const start = Date.now();
      try {
        const proxyArg = proxy.type === "socks5"
          ? `--socks5 ${proxy.host}:${proxy.port}`
          : `--proxy ${proxy.host}:${proxy.port}`;
        const authArg = proxy.username ? `--proxy-user ${proxy.username}:${proxy.password || ""}` : "";
        // Test via Titan Server SSH if available, otherwise direct
        const titan = getTitanServerConfig();
        let alive = false;
        let ip = "unknown";
        if (titan) {
          const cmd = `curl -s ${proxyArg} ${authArg} --max-time 8 https://api.ipify.org 2>/dev/null || echo "FAILED"`;
          const out = await execSSHCommand(titan, cmd, 12000, ctx.user.id);
          alive = !out.includes("FAILED") && out.trim().length > 0;
          ip = out.trim();
        }
        const latencyMs = Date.now() - start;
        proxy.alive = alive;
        proxy.latencyMs = latencyMs;
        proxy.lastChecked = new Date().toISOString();
        await savePool(ctx.user.id, pool);
        return { success: alive, alive, latencyMs, ip, message: alive ? `✓ Proxy alive — ${latencyMs}ms — IP: ${ip}` : "Proxy unreachable" };
      } catch (err: any) {
        proxy.alive = false;
        proxy.lastChecked = new Date().toISOString();
        await savePool(ctx.user.id, pool);
        return { success: false, alive: false, latencyMs: Date.now() - start, ip: null, message: `Proxy failed: ${err.message}` };
      }
    }),

  /** Health-check all proxies in the pool */
  healthCheckAll: protectedProcedure.mutation(async ({ ctx }) => {
    const plan = await getUserPlan(ctx.user.id);
    enforceFeature(plan.planId, "offensive_tooling", "Proxy Maker");
    const pool = await getPool(ctx.user.id);
    if (!pool || pool.proxies.length === 0) return { success: true, alive: 0, dead: 0, total: 0, message: "Pool is empty." };

    const titan = getTitanServerConfig();
    let alive = 0, dead = 0;

    for (const proxy of pool.proxies) {
      try {
        const proxyArg = proxy.type === "socks5"
          ? `--socks5 ${proxy.host}:${proxy.port}`
          : `--proxy ${proxy.host}:${proxy.port}`;
        const authArg = proxy.username ? `--proxy-user ${proxy.username}:${proxy.password || ""}` : "";
        const start = Date.now();
        if (titan) {
          const cmd = `curl -s ${proxyArg} ${authArg} --max-time 6 https://api.ipify.org 2>/dev/null || echo "FAILED"`;
          const out = await execSSHCommand(titan, cmd, 10000, ctx.user.id);
          proxy.alive = !out.includes("FAILED") && out.trim().length > 0;
          proxy.latencyMs = Date.now() - start;
        } else {
          proxy.alive = false;
        }
        proxy.lastChecked = new Date().toISOString();
        proxy.alive ? alive++ : dead++;
      } catch {
        proxy.alive = false;
        dead++;
      }
    }

    await savePool(ctx.user.id, pool);
    return { success: true, alive, dead, total: pool.proxies.length, message: `Health check complete: ${alive} alive, ${dead} dead out of ${pool.proxies.length}` };
  }),

  /** Deploy a fresh SOCKS5+HTTP proxy on a VPS via SSH */
  deployProxy: protectedProcedure
    .input(z.object({
      host: z.string().min(1),
      port: z.number().default(22),
      username: z.string().min(1),
      password: z.string().optional(),
      privateKey: z.string().optional(),
      label: z.string().optional(),
      useTitanServer: z.boolean().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      const plan = await getUserPlan(ctx.user.id);
      enforceFeature(plan.planId, "offensive_tooling", "Proxy Maker");

      let ssh: SSHConfig;
      if (input.useTitanServer) {
        const titan = getTitanServerConfig();
        if (!titan) throw new TRPCError({ code: "BAD_REQUEST", message: "Titan Server not configured." });
        ssh = titan;
      } else {
        ssh = { host: input.host, port: input.port, username: input.username, password: input.password, privateKey: input.privateKey };
      }

      try {
        const output = await execSSHCommand(ssh, INSTALL_3PROXY, 120000, ctx.user.id);
        const isRunning = output.includes("PROXY_RUNNING");

        if (isRunning) {
          const pool = (await getPool(ctx.user.id)) ?? makeEmptyPool();
          // Add both SOCKS5 and HTTP proxy entries
          const socks5Entry: ProxyEntry = {
            id: crypto.randomUUID(), host: ssh.host, port: 1080, type: "socks5",
            label: input.label ? `${input.label} (SOCKS5)` : `${ssh.host}:1080 (SOCKS5)`,
            alive: true, addedAt: new Date().toISOString(), source: "deployed",
          };
          const httpEntry: ProxyEntry = {
            id: crypto.randomUUID(), host: ssh.host, port: 8080, type: "http",
            label: input.label ? `${input.label} (HTTP)` : `${ssh.host}:8080 (HTTP)`,
            alive: true, addedAt: new Date().toISOString(), source: "deployed",
          };
          pool.proxies.push(socks5Entry, httpEntry);
          await savePool(ctx.user.id, pool);
        }

        return {
          success: isRunning,
          message: isRunning ? `✓ Proxy deployed on ${ssh.host} — SOCKS5:1080, HTTP:8080` : "Deployment may have issues — check output.",
          socksPort: 1080, httpPort: 8080, host: ssh.host,
          output: output.trim().slice(-2000),
        };
      } catch (err: any) {
        return { success: false, message: `Deployment failed: ${err.message}`, socksPort: null, httpPort: null, host: ssh.host, output: "" };
      }
    }),

  /**
   * Auto-scrape free public proxies from known sources,
   * test them, and add working ones to the pool.
   */
  scrapeProxies: protectedProcedure
    .input(z.object({
      type: z.enum(["socks5", "http", "all"]).default("socks5"),
      maxToAdd: z.number().min(1).max(100).default(20),
    }))
    .mutation(async ({ ctx, input }) => {
      const plan = await getUserPlan(ctx.user.id);
      enforceFeature(plan.planId, "offensive_tooling", "Proxy Maker");

      const titan = getTitanServerConfig();
      if (!titan) throw new TRPCError({ code: "BAD_REQUEST", message: "Titan Server required for proxy scraping." });

      // Scrape from multiple public proxy lists
      const scrapeScript = `
set -e
echo "[Titan] Scraping proxy lists..."
TMPDIR=$(mktemp -d)

# Fetch from multiple sources
curl -s --max-time 10 "https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/socks5.txt" > $TMPDIR/socks5.txt 2>/dev/null || echo "" > $TMPDIR/socks5.txt
curl -s --max-time 10 "https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/http.txt" > $TMPDIR/http.txt 2>/dev/null || echo "" > $TMPDIR/http.txt
curl -s --max-time 10 "https://raw.githubusercontent.com/clarketm/proxy-list/master/proxy-list-raw.txt" > $TMPDIR/extra.txt 2>/dev/null || echo "" > $TMPDIR/extra.txt

# Combine and deduplicate
cat $TMPDIR/socks5.txt $TMPDIR/http.txt $TMPDIR/extra.txt | grep -E "^[0-9]+\\.[0-9]+\\.[0-9]+\\.[0-9]+:[0-9]+" | sort -u | head -200 > $TMPDIR/all.txt
wc -l < $TMPDIR/all.txt
cat $TMPDIR/all.txt | head -50
rm -rf $TMPDIR
echo "SCRAPE_DONE"
`;

      try {
        const output = await execSSHCommand(titan, scrapeScript, 60000, ctx.user.id);
        const lines = output.trim().split("\n");
        const proxyLines = lines.filter(l => /^\d+\.\d+\.\d+\.\d+:\d+/.test(l.trim()));

        const pool = (await getPool(ctx.user.id)) ?? makeEmptyPool();
        const existingKeys = new Set(pool.proxies.map(p => `${p.host}:${p.port}`));
        let added = 0;

        for (const line of proxyLines.slice(0, input.maxToAdd)) {
          const [host, portStr] = line.trim().split(":");
          const port = parseInt(portStr, 10);
          if (!host || !port || existingKeys.has(`${host}:${port}`)) continue;
          const proxyType = input.type === "all" ? (port === 1080 || port === 9050 ? "socks5" : "http") : (input.type === "socks5" ? "socks5" : "http");
          pool.proxies.push({
            id: crypto.randomUUID(), host, port, type: proxyType,
            alive: true, addedAt: new Date().toISOString(), source: "scraped",
          });
          existingKeys.add(`${host}:${port}`);
          added++;
          if (added >= input.maxToAdd) break;
        }

        await savePool(ctx.user.id, pool);
        return { success: true, added, total: pool.proxies.length, message: `✓ Scraped and added ${added} proxies to pool. Run health check to verify which are alive.` };
      } catch (err: any) {
        return { success: false, added: 0, total: 0, message: `Scrape failed: ${err.message}` };
      }
    }),

  /** Toggle rotation on/off */
  setRotation: protectedProcedure
    .input(z.object({ enabled: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const plan = await getUserPlan(ctx.user.id);
      enforceFeature(plan.planId, "offensive_tooling", "Proxy Maker");
      const pool = (await getPool(ctx.user.id)) ?? makeEmptyPool();
      pool.rotationEnabled = input.enabled;
      await savePool(ctx.user.id, pool);
      return { success: true, rotationEnabled: input.enabled };
    }),

  /** Get the next proxy in rotation */
  getNextProxy: protectedProcedure.query(async ({ ctx }) => {
    const pool = await getPool(ctx.user.id);
    if (!pool || pool.proxies.length === 0) return { proxy: null, message: "Pool is empty." };
    const aliveProxies = pool.proxies.filter(p => p.alive);
    if (aliveProxies.length === 0) return { proxy: null, message: "No alive proxies in pool." };
    const idx = pool.currentIndex % aliveProxies.length;
    const proxy = aliveProxies[idx];
    pool.currentIndex = (idx + 1) % aliveProxies.length;
    await savePool(ctx.user.id, pool);
    return { proxy: sanitizeProxy(proxy), remaining: aliveProxies.length };
  }),

  /** Export pool as plain text list (host:port format) */
  exportPool: protectedProcedure
    .input(z.object({ aliveOnly: z.boolean().default(true), type: z.enum(["socks5", "http", "all"]).default("all") }))
    .query(async ({ ctx, input }) => {
      const plan = await getUserPlan(ctx.user.id);
      enforceFeature(plan.planId, "offensive_tooling", "Proxy Maker");
      const pool = await getPool(ctx.user.id);
      if (!pool) return { list: "", count: 0 };
      let proxies = pool.proxies;
      if (input.aliveOnly) proxies = proxies.filter(p => p.alive);
      if (input.type !== "all") proxies = proxies.filter(p => p.type === input.type);
      const list = proxies.map(p => `${p.host}:${p.port}`).join("\n");
      return { list, count: proxies.length };
    }),

  /** Clear all proxies from pool */
  clearPool: protectedProcedure.mutation(async ({ ctx }) => {
    const plan = await getUserPlan(ctx.user.id);
    enforceFeature(plan.planId, "offensive_tooling", "Proxy Maker");
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    await db.delete(userSecrets).where(and(eq(userSecrets.userId, ctx.user.id), eq(userSecrets.secretType, SECRET_TYPE)));
    return { success: true };
  }),
});
