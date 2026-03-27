/**
 * IP Rotation Engine
 *
 * 3-layer system for making Titan's outbound requests appear to come
 * from different IPs and devices — zero VPS, zero signup required.
 *
 * Layer 1: Request Header Spoofing
 *   - Rotates X-Forwarded-For, X-Real-IP, Via headers
 *   - Rotates User-Agent (desktop, mobile, tablet, bots)
 *   - Rotates Accept-Language (50+ locales)
 *   - Makes each request look like a different user from a different country
 *
 * Layer 2: Tor on Railway
 *   - Installs and runs Tor directly on the Railway server process
 *   - Routes fetch requests through SOCKS5 on 127.0.0.1:9050
 *   - Real exit node IPs that change every ~10 minutes
 *   - No VPS needed — runs in-process
 *
 * Layer 3: Auto Proxy Scraper
 *   - Scrapes free proxy lists from public sources every 30 minutes
 *   - Tests all scraped proxies concurrently
 *   - Maintains a pool of live proxies
 *   - Rotates through them automatically
 */

import { createLogger } from "./_core/logger.js";
import { exec, spawn } from "child_process";
import { promisify } from "util";
import * as fs from "fs";
import * as path from "path";

const execAsync = promisify(exec);
const log = createLogger("IPRotation");

// ─── Layer 1: Header & User-Agent Spoofing ────────────────────────────────────

const USER_AGENTS = [
  // Chrome Desktop
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  // Firefox Desktop
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14.3; rv:123.0) Gecko/20100101 Firefox/123.0",
  "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:123.0) Gecko/20100101 Firefox/123.0",
  // Safari Desktop
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_3_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3.1 Safari/605.1.15",
  // Edge
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 Edg/122.0.0.0",
  // Mobile Chrome
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.6261.119 Mobile Safari/537.36",
  "Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36",
  // Mobile Safari
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_3_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3.1 Mobile/15E148 Safari/604.1",
  "Mozilla/5.0 (iPad; CPU OS 17_3_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3.1 Mobile/15E148 Safari/604.1",
  // Googlebot (useful for bypassing some paywalls)
  "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
  // Bingbot
  "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)",
];

const ACCEPT_LANGUAGES = [
  "en-US,en;q=0.9", "en-GB,en;q=0.9", "en-AU,en;q=0.9",
  "fr-FR,fr;q=0.9,en;q=0.8", "de-DE,de;q=0.9,en;q=0.8",
  "es-ES,es;q=0.9,en;q=0.8", "it-IT,it;q=0.9,en;q=0.8",
  "pt-BR,pt;q=0.9,en;q=0.8", "nl-NL,nl;q=0.9,en;q=0.8",
  "pl-PL,pl;q=0.9,en;q=0.8", "ru-RU,ru;q=0.9,en;q=0.8",
  "ja-JP,ja;q=0.9,en;q=0.8", "ko-KR,ko;q=0.9,en;q=0.8",
  "zh-CN,zh;q=0.9,en;q=0.8", "zh-TW,zh;q=0.9,en;q=0.8",
  "ar-SA,ar;q=0.9,en;q=0.8", "tr-TR,tr;q=0.9,en;q=0.8",
  "sv-SE,sv;q=0.9,en;q=0.8", "da-DK,da;q=0.9,en;q=0.8",
  "fi-FI,fi;q=0.9,en;q=0.8", "no-NO,no;q=0.9,en;q=0.8",
];

// Generate a realistic-looking random IP in a public range
function randomPublicIp(): string {
  const ranges = [
    // Europe
    [5, 5], [31, 31], [46, 46], [62, 62], [77, 77], [78, 78], [79, 79],
    [80, 80], [81, 81], [82, 82], [83, 83], [84, 84], [85, 85], [86, 86],
    [87, 87], [88, 88], [89, 89], [90, 90], [91, 91], [92, 92], [93, 93],
    [94, 94], [95, 95],
    // North America
    [24, 24], [50, 50], [64, 64], [65, 65], [66, 66], [67, 67], [68, 68],
    [69, 69], [70, 70], [71, 71], [72, 72], [73, 73], [74, 74], [75, 75],
    [76, 76], [96, 96], [97, 97], [98, 98], [99, 99], [100, 100],
    // Asia-Pacific
    [103, 103], [110, 110], [111, 111], [112, 112], [113, 113], [114, 114],
    [115, 115], [116, 116], [117, 117], [118, 118], [119, 119], [120, 120],
    [121, 121], [122, 122], [123, 123], [124, 124], [125, 125],
  ];
  const [min, max] = ranges[Math.floor(Math.random() * ranges.length)];
  const first = min + Math.floor(Math.random() * (max - min + 1));
  const b = Math.floor(Math.random() * 254) + 1;
  const c = Math.floor(Math.random() * 254) + 1;
  const d = Math.floor(Math.random() * 254) + 1;
  return `${first}.${b}.${c}.${d}`;
}

let headerRotationIndex = 0;

export function getSpoofedHeaders(): Record<string, string> {
  const ua = USER_AGENTS[headerRotationIndex % USER_AGENTS.length];
  const lang = ACCEPT_LANGUAGES[headerRotationIndex % ACCEPT_LANGUAGES.length];
  const ip1 = randomPublicIp();
  const ip2 = randomPublicIp();
  headerRotationIndex++;

  return {
    "User-Agent": ua,
    "Accept-Language": lang,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Encoding": "gzip, deflate, br",
    "X-Forwarded-For": `${ip1}, ${ip2}`,
    "X-Real-IP": ip1,
    "X-Client-IP": ip1,
    "Via": `1.1 ${ip2}`,
    "Forwarded": `for=${ip1};proto=https`,
    "Cache-Control": "no-cache",
    "Pragma": "no-cache",
    "DNT": Math.random() > 0.5 ? "1" : "0",
    "Upgrade-Insecure-Requests": "1",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
  };
}

// ─── Layer 2: Tor on Railway ──────────────────────────────────────────────────

let torProcess: ReturnType<typeof spawn> | null = null;
let torReady = false;
let torStarting = false;

const TOR_SOCKS_PORT = 9150; // Use non-default to avoid conflicts
const TOR_CONTROL_PORT = 9151;
const TOR_DATA_DIR = "/tmp/titan-tor-data";

const TORRC_CONTENT = `
SocksPort ${TOR_SOCKS_PORT}
ControlPort ${TOR_CONTROL_PORT}
DataDirectory ${TOR_DATA_DIR}
CookieAuthentication 0
HashedControlPassword ""
# Speed optimisations
NumEntryGuards 3
CircuitBuildTimeout 15
MaxCircuitDirtiness 300
NewCircuitPeriod 60
NumPreemptiveCircuits 3
# Only fast relays
BandwidthRate 512 KB
BandwidthBurst 1 MB
# Logging
Log notice stderr
`.trim();

export async function startTorDaemon(): Promise<{ success: boolean; message: string }> {
  if (torReady) return { success: true, message: "Tor already running" };
  if (torStarting) return { success: false, message: "Tor is starting up, please wait..." };

  torStarting = true;
  try {
    // Check if tor is installed
    try {
      await execAsync("which tor");
    } catch {
      // Install tor
      log.info("Installing Tor...");
      await execAsync("apt-get update -qq && apt-get install -y -qq tor 2>&1 | tail -3");
    }

    // Write torrc
    fs.mkdirSync(TOR_DATA_DIR, { recursive: true });
    const torrcPath = "/tmp/titan-torrc";
    fs.writeFileSync(torrcPath, TORRC_CONTENT);

    // Stop any existing tor
    try { await execAsync("pkill -f 'tor -f /tmp/titan-torrc' 2>/dev/null || true"); } catch {}
    await new Promise(r => setTimeout(r, 500));

    // Start tor
    torProcess = spawn("tor", ["-f", torrcPath], {
      detached: false,
      stdio: ["ignore", "pipe", "pipe"],
    });

    torProcess.stderr?.on("data", (data: Buffer) => {
      const msg = data.toString();
      if (msg.includes("Bootstrapped 100%")) {
        torReady = true;
        torStarting = false;
        log.info("Tor bootstrapped 100% — ready");
      }
    });

    torProcess.on("exit", () => {
      torReady = false;
      torStarting = false;
      torProcess = null;
      log.info("Tor process exited");
    });

    // Wait up to 60s for bootstrap
    const deadline = Date.now() + 60000;
    while (!torReady && Date.now() < deadline) {
      await new Promise(r => setTimeout(r, 1000));
    }

    if (!torReady) {
      torStarting = false;
      return { success: false, message: "Tor failed to bootstrap within 60 seconds" };
    }

    return { success: true, message: "Tor started and bootstrapped" };
  } catch (err: any) {
    torStarting = false;
    log.error(`Tor start error: ${err.message}`);
    return { success: false, message: err.message };
  }
}

export function stopTorDaemon(): void {
  if (torProcess) {
    torProcess.kill("SIGTERM");
    torProcess = null;
  }
  torReady = false;
  torStarting = false;
}

export function isTorReady(): boolean { return torReady; }
export function isTorStarting(): boolean { return torStarting; }
export function getTorSocksPort(): number { return TOR_SOCKS_PORT; }

export async function getNewTorCircuit(): Promise<boolean> {
  if (!torReady) return false;
  try {
    // Send NEWNYM signal via control port
    const net = await import("net");
    return new Promise((resolve) => {
      const client = net.createConnection(TOR_CONTROL_PORT, "127.0.0.1", () => {
        client.write("AUTHENTICATE \"\"\r\nSIGNAL NEWNYM\r\nQUIT\r\n");
      });
      client.on("data", () => {});
      client.on("close", () => resolve(true));
      client.on("error", () => resolve(false));
      setTimeout(() => { client.destroy(); resolve(false); }, 3000);
    });
  } catch {
    return false;
  }
}

// ─── Layer 3: Auto Proxy Scraper ──────────────────────────────────────────────

export interface ScrapedProxy {
  host: string;
  port: number;
  protocol: "http" | "socks4" | "socks5";
  healthy: boolean;
  latencyMs?: number;
  externalIp?: string;
  country?: string;
  anonymity?: "transparent" | "anonymous" | "elite";
  lastTested: string;
}

let proxyPool: ScrapedProxy[] = [];
let lastScrapeTime = 0;
let scrapeInterval: ReturnType<typeof setInterval> | null = null;

const PROXY_SOURCES: Array<{ url: string; protocol: "http" | "socks4" | "socks5" }> = [
  // ─── HTTP/HTTPS Proxies ─────────────────────────────────────────────────────────────
  { url: "https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/http.txt", protocol: "http" },
  { url: "https://raw.githubusercontent.com/ShiftyTR/Proxy-List/master/http.txt", protocol: "http" },
  { url: "https://raw.githubusercontent.com/monosans/proxy-list/main/proxies/http.txt", protocol: "http" },
  { url: "https://raw.githubusercontent.com/clarketm/proxy-list/master/proxy-list-raw.txt", protocol: "http" },
  { url: "https://raw.githubusercontent.com/sunny9577/proxy-scraper/master/proxies.txt", protocol: "http" },
  { url: "https://raw.githubusercontent.com/roosterkid/openproxylist/main/HTTPS_RAW.txt", protocol: "http" },
  { url: "https://raw.githubusercontent.com/mmpx12/proxy-list/master/http.txt", protocol: "http" },
  { url: "https://raw.githubusercontent.com/almroot/proxylist/master/list.txt", protocol: "http" },
  { url: "https://raw.githubusercontent.com/jetkai/proxy-list/main/online-proxies/txt/proxies-http.txt", protocol: "http" },
  { url: "https://raw.githubusercontent.com/rdavydov/proxy-list/main/proxies/http.txt", protocol: "http" },
  { url: "https://raw.githubusercontent.com/zloi-user/hideip.me/main/http.txt", protocol: "http" },
  { url: "https://raw.githubusercontent.com/officialputuid/KangProxy/KangProxy/http/http.txt", protocol: "http" },
  { url: "https://raw.githubusercontent.com/proxifly/free-proxy-list/main/proxies/protocols/http/data.txt", protocol: "http" },
  // ─── SOCKS5 Proxies ─────────────────────────────────────────────────────────────
  { url: "https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/socks5.txt", protocol: "socks5" },
  { url: "https://raw.githubusercontent.com/ShiftyTR/Proxy-List/master/socks5.txt", protocol: "socks5" },
  { url: "https://raw.githubusercontent.com/monosans/proxy-list/main/proxies/socks5.txt", protocol: "socks5" },
  { url: "https://raw.githubusercontent.com/hookzof/socks5_list/master/proxy.txt", protocol: "socks5" },
  { url: "https://raw.githubusercontent.com/mmpx12/proxy-list/master/socks5.txt", protocol: "socks5" },
  { url: "https://raw.githubusercontent.com/jetkai/proxy-list/main/online-proxies/txt/proxies-socks5.txt", protocol: "socks5" },
  { url: "https://raw.githubusercontent.com/rdavydov/proxy-list/main/proxies/socks5.txt", protocol: "socks5" },
  { url: "https://raw.githubusercontent.com/zloi-user/hideip.me/main/socks5.txt", protocol: "socks5" },
  { url: "https://raw.githubusercontent.com/officialputuid/KangProxy/KangProxy/socks5/socks5.txt", protocol: "socks5" },
  { url: "https://raw.githubusercontent.com/proxifly/free-proxy-list/main/proxies/protocols/socks5/data.txt", protocol: "socks5" },
  // ─── SOCKS4 Proxies ─────────────────────────────────────────────────────────────
  { url: "https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/socks4.txt", protocol: "socks4" },
  { url: "https://raw.githubusercontent.com/ShiftyTR/Proxy-List/master/socks4.txt", protocol: "socks4" },
  { url: "https://raw.githubusercontent.com/monosans/proxy-list/main/proxies/socks4.txt", protocol: "socks4" },
  { url: "https://raw.githubusercontent.com/mmpx12/proxy-list/master/socks4.txt", protocol: "socks4" },
  { url: "https://raw.githubusercontent.com/jetkai/proxy-list/main/online-proxies/txt/proxies-socks4.txt", protocol: "socks4" },
  { url: "https://raw.githubusercontent.com/rdavydov/proxy-list/main/proxies/socks4.txt", protocol: "socks4" },
  { url: "https://raw.githubusercontent.com/zloi-user/hideip.me/main/socks4.txt", protocol: "socks4" },
];

async function scrapeProxiesFromSource(url: string, protocol: "http" | "socks4" | "socks5"): Promise<Array<{ host: string; port: number; protocol: "http" | "socks4" | "socks5" }>> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) return [];
    const text = await res.text();
    const results: Array<{ host: string; port: number; protocol: "http" | "socks4" | "socks5" }> = [];
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      // Strip protocol prefix if present
      const clean = trimmed.replace(/^(https?|socks[45]):\/\//i, "");
      const match = clean.match(/^([0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}):(\d+)/);
      if (!match) continue;
      const port = parseInt(match[2]);
      if (port < 1 || port > 65535) continue;
      results.push({ host: match[1], port, protocol });
    }
    return results;
  } catch {
    return [];
  }
}

async function testScrapedProxy(proxy: { host: string; port: number; protocol: "http" | "socks4" | "socks5" }): Promise<ScrapedProxy> {
  const start = Date.now();
  try {
    const proxyUrl = proxy.protocol === "socks4"
      ? `socks4://${proxy.host}:${proxy.port}`
      : `${proxy.protocol}://${proxy.host}:${proxy.port}`;
    let agent: any;
    if (proxy.protocol === "socks5" || proxy.protocol === "socks4") {
      const { SocksProxyAgent } = await import("socks-proxy-agent");
      agent = new SocksProxyAgent(proxyUrl);
    } else {
      const { HttpsProxyAgent } = await import("https-proxy-agent");
      agent = new HttpsProxyAgent(proxyUrl);
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch("https://api.ipify.org?format=json", {
      signal: controller.signal,
      // @ts-ignore
      agent,
    } as any);
    clearTimeout(timeout);
    const latencyMs = Date.now() - start;
    if (!res.ok) return { ...proxy, healthy: false, latencyMs, lastTested: new Date().toISOString() };
    const data = await res.json() as { ip: string };
    return { ...proxy, healthy: true, latencyMs, externalIp: data.ip, lastTested: new Date().toISOString() };
  } catch {
    return { ...proxy, healthy: false, latencyMs: Date.now() - start, lastTested: new Date().toISOString() };
  }
}

export async function scrapeAndRefreshProxies(): Promise<{ scraped: number; tested: number; live: number }> {
  log.info("Starting proxy scrape...");
  const allRaw: Array<{ host: string; port: number; protocol: "http" | "socks4" | "socks5" }> = [];

  // Scrape all sources concurrently using the new object format
  const results = await Promise.allSettled(
    PROXY_SOURCES.map(src => scrapeProxiesFromSource(src.url, src.protocol))
  );
  for (const r of results) {
    if (r.status === "fulfilled") allRaw.push(...r.value);
  }

  // Deduplicate by host:port
  const seen = new Set<string>();
  const unique = allRaw.filter(p => {
    const key = `${p.host}:${p.port}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  log.info(`Scraped ${unique.length} unique proxies, testing up to 300...`);

  // Test a random sample of up to 300 (increased from 200)
  const shuffled = unique.sort(() => Math.random() - 0.5).slice(0, 300);
  const BATCH = 30; // Increased batch size for faster testing
  const tested: ScrapedProxy[] = [];

  for (let i = 0; i < shuffled.length; i += BATCH) {
    const batch = shuffled.slice(i, i + BATCH);
    const batchResults = await Promise.all(batch.map(testScrapedProxy));
    tested.push(...batchResults);
    // Stop early if we have 50+ live proxies (increased from 30)
    const liveCount = tested.filter(p => p.healthy).length;
    if (liveCount >= 50) break;
  }

  const live = tested.filter(p => p.healthy);
  // Sort by latency — fastest proxies first
  live.sort((a, b) => (a.latencyMs ?? 9999) - (b.latencyMs ?? 9999));
  proxyPool = live;
  lastScrapeTime = Date.now();

  log.info(`Proxy scrape complete: ${tested.length} tested, ${live.length} live`);
  return { scraped: unique.length, tested: tested.length, live: live.length };
}

export function startAutoProxyScraper(): void {
  if (scrapeInterval) return;
  // Initial scrape after 10 seconds (don't block startup)
  setTimeout(() => scrapeAndRefreshProxies().catch(e => log.error(`Proxy scrape error: ${e.message}`)), 10000);
  // Refresh every 30 minutes
  scrapeInterval = setInterval(() => {
    scrapeAndRefreshProxies().catch(e => log.error(`Proxy scrape error: ${e.message}`));
  }, 30 * 60 * 1000);
}

export function stopAutoProxyScraper(): void {
  if (scrapeInterval) { clearInterval(scrapeInterval); scrapeInterval = null; }
}

let proxyPoolIndex = 0;
export function getNextScrapedProxy(): ScrapedProxy | null {
  const live = proxyPool.filter(p => p.healthy);
  if (!live.length) return null;
  const proxy = live[proxyPoolIndex % live.length];
  proxyPoolIndex++;
  return proxy;
}

export function getProxyPoolStats(): { total: number; live: number; lastScrapeTime: number; nextScrapeIn: number } {
  const live = proxyPool.filter(p => p.healthy).length;
  const elapsed = Date.now() - lastScrapeTime;
  const nextScrapeIn = Math.max(0, 30 * 60 * 1000 - elapsed);
  return { total: proxyPool.length, live, lastScrapeTime, nextScrapeIn };
}

export function getProxyPool(): ScrapedProxy[] { return [...proxyPool]; }
