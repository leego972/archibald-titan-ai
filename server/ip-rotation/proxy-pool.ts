/**
 * Proxy Pool Manager
 *
 * Production-quality proxy management:
 * - 20+ scrape sources (HTTP + SOCKS5)
 * - DB persistence — pool survives server restarts
 * - Per-proxy health tracking (success rate, latency, last tested)
 * - Per-domain proxy assignment — sticky proxy per domain for session consistency
 * - Auto-eviction of consistently failing proxies
 * - Smart rotation: prefer low-latency, high-success-rate proxies
 * - Concurrent testing with configurable batch size
 * - Auto-refresh every 30 minutes
 */

import { createLogger } from "../_core/logger.js";
import { getDb } from "../db";
import { userSecrets } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { encrypt, decrypt } from "../fetcher-db";

const log = createLogger("ProxyPool");

export interface Proxy {
  id: string; // host:port
  host: string;
  port: number;
  protocol: "http" | "https" | "socks4" | "socks5";
  username?: string;
  password?: string;
  // Health metrics
  healthy: boolean;
  successCount: number;
  failureCount: number;
  consecutiveFailures: number;
  avgLatencyMs: number;
  lastTestedAt: string | null;
  lastSuccessAt: string | null;
  externalIp: string | null;
  // Source
  source: string;
  addedAt: string;
}

export interface DomainProxyAssignment {
  domain: string;
  proxyId: string;
  assignedAt: number;
}

const PROXY_SOURCES: Array<{ url: string; protocol: "http" | "socks5" | "socks4"; name: string }> = [
  // HTTP proxies
  { url: "https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/http.txt", protocol: "http", name: "TheSpeedX-HTTP" },
  { url: "https://raw.githubusercontent.com/ShiftyTR/Proxy-List/master/http.txt", protocol: "http", name: "ShiftyTR-HTTP" },
  { url: "https://raw.githubusercontent.com/monosans/proxy-list/main/proxies/http.txt", protocol: "http", name: "monosans-HTTP" },
  { url: "https://raw.githubusercontent.com/clarketm/proxy-list/master/proxy-list-raw.txt", protocol: "http", name: "clarketm-HTTP" },
  { url: "https://raw.githubusercontent.com/sunny9577/proxy-scraper/master/proxies.txt", protocol: "http", name: "sunny9577-HTTP" },
  { url: "https://raw.githubusercontent.com/mmpx12/proxy-list/master/http.txt", protocol: "http", name: "mmpx12-HTTP" },
  { url: "https://raw.githubusercontent.com/roosterkid/openproxylist/main/HTTPS_RAW.txt", protocol: "http", name: "roosterkid-HTTPS" },
  { url: "https://raw.githubusercontent.com/almroot/proxylist/master/list.txt", protocol: "http", name: "almroot-HTTP" },
  { url: "https://raw.githubusercontent.com/elliottophellia/yakumo/master/results/http/global/http_checked.txt", protocol: "http", name: "yakumo-HTTP" },
  { url: "https://raw.githubusercontent.com/vakhov/fresh-proxy-list/master/http.txt", protocol: "http", name: "vakhov-HTTP" },
  // SOCKS5 proxies
  { url: "https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/socks5.txt", protocol: "socks5", name: "TheSpeedX-SOCKS5" },
  { url: "https://raw.githubusercontent.com/ShiftyTR/Proxy-List/master/socks5.txt", protocol: "socks5", name: "ShiftyTR-SOCKS5" },
  { url: "https://raw.githubusercontent.com/monosans/proxy-list/main/proxies/socks5.txt", protocol: "socks5", name: "monosans-SOCKS5" },
  { url: "https://raw.githubusercontent.com/hookzof/socks5_list/master/proxy.txt", protocol: "socks5", name: "hookzof-SOCKS5" },
  { url: "https://raw.githubusercontent.com/mmpx12/proxy-list/master/socks5.txt", protocol: "socks5", name: "mmpx5-SOCKS5" },
  { url: "https://raw.githubusercontent.com/roosterkid/openproxylist/main/SOCKS5_RAW.txt", protocol: "socks5", name: "roosterkid-SOCKS5" },
  { url: "https://raw.githubusercontent.com/elliottophellia/yakumo/master/results/socks5/global/socks5_checked.txt", protocol: "socks5", name: "yakumo-SOCKS5" },
  { url: "https://raw.githubusercontent.com/vakhov/fresh-proxy-list/master/socks5.txt", protocol: "socks5", name: "vakhov-SOCKS5" },
  // SOCKS4 proxies
  { url: "https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/socks4.txt", protocol: "socks4", name: "TheSpeedX-SOCKS4" },
  { url: "https://raw.githubusercontent.com/ShiftyTR/Proxy-List/master/socks4.txt", protocol: "socks4", name: "ShiftyTR-SOCKS4" },
  { url: "https://raw.githubusercontent.com/monosans/proxy-list/main/proxies/socks4.txt", protocol: "socks4", name: "monosans-SOCKS4" },
  { url: "https://raw.githubusercontent.com/mmpx12/proxy-list/master/socks4.txt", protocol: "socks4", name: "mmpx12-SOCKS4" },
];

const MAX_CONSECUTIVE_FAILURES = 5; // Evict after 5 consecutive failures
const DOMAIN_STICKY_MS = 30 * 60 * 1000; // 30 min sticky assignment per domain
const TEST_BATCH_SIZE = 25; // Concurrent test batch
const MAX_PROXIES_TO_TEST = 300; // Cap per scrape cycle
const TEST_TIMEOUT_MS = 8000;
const SCRAPE_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes
const DB_PERSIST_KEY = "__proxy_pool_v2";

class ProxyPoolManager {
  private pool: Map<string, Proxy> = new Map();
  private domainAssignments: Map<string, DomainProxyAssignment> = new Map();
  private scrapeTimer: ReturnType<typeof setInterval> | null = null;
  private lastScrapeAt = 0;
  private scrapeInProgress = false;
  private rotationIndex = 0;
  private totalRequestsRouted = 0;
  private persistUserId: number | null = null;

  // ─── Lifecycle ─────────────────────────────────────────────────────────────

  async start(userId?: number): Promise<void> {
    if (userId) this.persistUserId = userId;
    await this._loadFromDb();
    // Initial scrape after 5 seconds
    setTimeout(() => this._scrape(), 5000);
    // Recurring scrape
    this.scrapeTimer = setInterval(() => this._scrape(), SCRAPE_INTERVAL_MS);
    log.info(`Proxy pool started (${this.pool.size} loaded from DB)`);
  }

  stop(): void {
    if (this.scrapeTimer) { clearInterval(this.scrapeTimer); this.scrapeTimer = null; }
    log.info("Proxy pool stopped");
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  /** Get the best proxy for a given domain (sticky per session) */
  getProxyForDomain(domain: string): Proxy | null {
    const now = Date.now();
    const assignment = this.domainAssignments.get(domain);

    if (assignment && now - assignment.assignedAt < DOMAIN_STICKY_MS) {
      const proxy = this.pool.get(assignment.proxyId);
      if (proxy && proxy.healthy && proxy.consecutiveFailures < MAX_CONSECUTIVE_FAILURES) {
        return proxy;
      }
    }

    // Assign a new proxy
    const proxy = this._pickBestProxy();
    if (proxy) {
      this.domainAssignments.set(domain, { domain, proxyId: proxy.id, assignedAt: now });
    }
    return proxy;
  }

  /** Get next proxy in rotation (round-robin with health weighting) */
  getNextProxy(): Proxy | null {
    return this._pickBestProxy();
  }

  /** Report a successful request through a proxy */
  reportSuccess(proxyId: string, latencyMs: number): void {
    const proxy = this.pool.get(proxyId);
    if (!proxy) return;
    proxy.successCount++;
    proxy.consecutiveFailures = 0;
    proxy.healthy = true;
    proxy.lastSuccessAt = new Date().toISOString();
    proxy.avgLatencyMs = proxy.avgLatencyMs === 0
      ? latencyMs
      : Math.round((proxy.avgLatencyMs * 0.8) + (latencyMs * 0.2)); // EMA
    this.totalRequestsRouted++;
  }

  /** Report a failed request through a proxy */
  reportFailure(proxyId: string): void {
    const proxy = this.pool.get(proxyId);
    if (!proxy) return;
    proxy.failureCount++;
    proxy.consecutiveFailures++;
    if (proxy.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
      proxy.healthy = false;
      log.info(`Proxy ${proxyId} evicted after ${proxy.consecutiveFailures} consecutive failures`);
    }
  }

  getStats() {
    const all = Array.from(this.pool.values());
    const live = all.filter(p => p.healthy);
    const avgLatency = live.length
      ? Math.round(live.reduce((s, p) => s + p.avgLatencyMs, 0) / live.length)
      : 0;
    return {
      total: all.length,
      live: live.length,
      dead: all.length - live.length,
      avgLatencyMs: avgLatency,
      totalRequestsRouted: this.totalRequestsRouted,
      lastScrapeAt: this.lastScrapeAt,
      scrapeInProgress: this.scrapeInProgress,
      nextScrapeIn: this.scrapeTimer
        ? Math.max(0, SCRAPE_INTERVAL_MS - (Date.now() - this.lastScrapeAt))
        : 0,
    };
  }

  getProxies(limit = 100): Proxy[] {
    return Array.from(this.pool.values())
      .sort((a, b) => {
        if (a.healthy !== b.healthy) return a.healthy ? -1 : 1;
        return a.avgLatencyMs - b.avgLatencyMs;
      })
      .slice(0, limit);
  }

  async triggerScrape(): Promise<{ scraped: number; tested: number; live: number }> {
    return this._scrape();
  }

  // ─── Internal ──────────────────────────────────────────────────────────────

  private _pickBestProxy(): Proxy | null {
    const live = Array.from(this.pool.values()).filter(
      p => p.healthy && p.consecutiveFailures < MAX_CONSECUTIVE_FAILURES
    );
    if (!live.length) return null;

    // Weighted selection: lower latency = higher weight
    // Also prefer proxies not recently used (round-robin within top tier)
    const sorted = live.sort((a, b) => {
      const scoreA = a.avgLatencyMs || 9999;
      const scoreB = b.avgLatencyMs || 9999;
      return scoreA - scoreB;
    });

    // Round-robin through top 10 fastest proxies
    const topN = Math.min(10, sorted.length);
    const proxy = sorted[this.rotationIndex % topN];
    this.rotationIndex++;
    return proxy;
  }

  private async _scrape(): Promise<{ scraped: number; tested: number; live: number }> {
    if (this.scrapeInProgress) return { scraped: 0, tested: 0, live: 0 };
    this.scrapeInProgress = true;
    this.lastScrapeAt = Date.now();

    log.info(`Starting proxy scrape from ${PROXY_SOURCES.length} sources...`);

    try {
      // Scrape all sources concurrently
      const rawResults = await Promise.allSettled(
        PROXY_SOURCES.map(source => this._scrapeSource(source))
      );

      const allRaw: Array<{ host: string; port: number; protocol: Proxy["protocol"]; source: string }> = [];
      for (const r of rawResults) {
        if (r.status === "fulfilled") allRaw.push(...r.value);
      }

      // Deduplicate
      const seen = new Set<string>();
      const unique = allRaw.filter(p => {
        const key = `${p.host}:${p.port}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      log.info(`Scraped ${unique.length} unique proxies, testing up to ${MAX_PROXIES_TO_TEST}...`);

      // Shuffle and cap
      const toTest = unique.sort(() => Math.random() - 0.5).slice(0, MAX_PROXIES_TO_TEST);

      // Test in batches
      const tested: Proxy[] = [];
      for (let i = 0; i < toTest.length; i += TEST_BATCH_SIZE) {
        const batch = toTest.slice(i, i + TEST_BATCH_SIZE);
        const results = await Promise.all(batch.map(p => this._testProxy(p)));
        tested.push(...results);

        // Early stop if we have 50+ live proxies
        const liveCount = tested.filter(p => p.healthy).length;
        if (liveCount >= 50) break;
      }

      // Merge into pool: update existing, add new
      for (const proxy of tested) {
        const existing = this.pool.get(proxy.id);
        if (existing) {
          // Update health metrics but preserve history
          existing.healthy = proxy.healthy;
          existing.lastTestedAt = proxy.lastTestedAt;
          existing.externalIp = proxy.externalIp || existing.externalIp;
          if (proxy.healthy) {
            existing.successCount++;
            existing.consecutiveFailures = 0;
            existing.lastSuccessAt = proxy.lastSuccessAt;
            existing.avgLatencyMs = existing.avgLatencyMs === 0
              ? proxy.avgLatencyMs
              : Math.round((existing.avgLatencyMs * 0.7) + (proxy.avgLatencyMs * 0.3));
          } else {
            existing.failureCount++;
            existing.consecutiveFailures++;
          }
        } else {
          this.pool.set(proxy.id, proxy);
        }
      }

      // Evict permanently dead proxies (never worked + consistently failing)
      for (const [id, proxy] of this.pool.entries()) {
        if (!proxy.healthy && proxy.successCount === 0 && proxy.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
          this.pool.delete(id);
        }
      }

      const live = Array.from(this.pool.values()).filter(p => p.healthy).length;
      log.info(`Scrape complete: ${tested.length} tested, ${live} live in pool (${this.pool.size} total)`);

      await this._persistToDb();
      return { scraped: unique.length, tested: tested.length, live };
    } finally {
      this.scrapeInProgress = false;
    }
  }

  private async _scrapeSource(source: { url: string; protocol: Proxy["protocol"]; name: string }): Promise<Array<{ host: string; port: number; protocol: Proxy["protocol"]; source: string }>> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000);
      const res = await fetch(source.url, { signal: controller.signal });
      clearTimeout(timeout);
      if (!res.ok) return [];
      const text = await res.text();
      const results: Array<{ host: string; port: number; protocol: Proxy["protocol"]; source: string }> = [];

      for (const line of text.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        // Strip protocol prefix
        const clean = trimmed.replace(/^(https?|socks[45]):\/\//i, "");
        // Match host:port (with optional user:pass)
        const match = clean.match(/^([0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}):(\d+)/);
        if (!match) continue;
        const port = parseInt(match[2]);
        if (port < 1 || port > 65535) continue;
        results.push({ host: match[1], port, protocol: source.protocol, source: source.name });
      }
      return results;
    } catch {
      return [];
    }
  }

  private async _testProxy(raw: { host: string; port: number; protocol: Proxy["protocol"]; source: string }): Promise<Proxy> {
    const id = `${raw.host}:${raw.port}`;
    const base: Proxy = {
      id, host: raw.host, port: raw.port, protocol: raw.protocol, source: raw.source,
      healthy: false, successCount: 0, failureCount: 1, consecutiveFailures: 1,
      avgLatencyMs: 0, lastTestedAt: new Date().toISOString(), lastSuccessAt: null,
      externalIp: null, addedAt: new Date().toISOString(),
    };

    const start = Date.now();
    try {
      let agent: any;
      const proxyUrl = `${raw.protocol}://${raw.host}:${raw.port}`;

      if (raw.protocol === "socks5" || raw.protocol === "socks4") {
        const { SocksProxyAgent } = await import("socks-proxy-agent");
        agent = new SocksProxyAgent(proxyUrl);
      } else {
        const { HttpsProxyAgent } = await import("https-proxy-agent");
        agent = new HttpsProxyAgent(proxyUrl);
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), TEST_TIMEOUT_MS);

      const res = await fetch("https://api.ipify.org?format=json", {
        signal: controller.signal,
        // @ts-ignore
        agent,
      } as any);
      clearTimeout(timeout);

      const latencyMs = Date.now() - start;
      if (!res.ok) return { ...base, failureCount: 1 };

      const data = await res.json() as { ip: string };
      return {
        ...base,
        healthy: true,
        successCount: 1,
        failureCount: 0,
        consecutiveFailures: 0,
        avgLatencyMs: latencyMs,
        lastSuccessAt: new Date().toISOString(),
        externalIp: data.ip,
      };
    } catch {
      return { ...base, avgLatencyMs: Date.now() - start };
    }
  }

  // ─── DB Persistence ────────────────────────────────────────────────────────

  private async _persistToDb(): Promise<void> {
    if (!this.persistUserId) return;
    try {
      const db = await getDb();
      if (!db) return;
      const data = JSON.stringify({
        proxies: Array.from(this.pool.values()).slice(0, 500), // cap at 500
        savedAt: Date.now(),
      });
      const enc = encrypt(data);
      const ex = await db.select().from(userSecrets)
        .where(and(eq(userSecrets.userId, this.persistUserId), eq(userSecrets.secretType, DB_PERSIST_KEY))).limit(1);
      if (ex.length) {
        await db.update(userSecrets).set({ encryptedValue: enc, updatedAt: new Date() }).where(eq(userSecrets.id, ex[0].id));
      } else {
        await db.insert(userSecrets).values({ userId: this.persistUserId, secretType: DB_PERSIST_KEY, label: "Proxy Pool Cache", encryptedValue: enc });
      }
    } catch (e: any) {
      log.warn(`Failed to persist proxy pool: ${e.message}`);
    }
  }

  private async _loadFromDb(): Promise<void> {
    if (!this.persistUserId) return;
    try {
      const db = await getDb();
      if (!db) return;
      const rows = await db.select().from(userSecrets)
        .where(and(eq(userSecrets.userId, this.persistUserId), eq(userSecrets.secretType, DB_PERSIST_KEY))).limit(1);
      if (!rows.length) return;
      const data = JSON.parse(decrypt(rows[0].encryptedValue)) as { proxies: Proxy[]; savedAt: number };
      // Only load if saved within last 2 hours (proxies go stale)
      if (Date.now() - data.savedAt > 2 * 60 * 60 * 1000) return;
      for (const proxy of data.proxies) {
        this.pool.set(proxy.id, proxy);
      }
      log.info(`Loaded ${this.pool.size} proxies from DB`);
    } catch (e: any) {
      log.warn(`Failed to load proxy pool from DB: ${e.message}`);
    }
  }
}

export const proxyPool = new ProxyPoolManager();
