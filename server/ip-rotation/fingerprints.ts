/**
 * Browser Fingerprint Profiles
 *
 * 20 fully consistent browser profiles. Each profile defines ALL headers
 * a real browser sends together — mixing headers from different browsers
 * is a major bot detection signal. Each profile is internally consistent.
 *
 * Profiles cover: Chrome/Windows, Chrome/Mac, Chrome/Linux, Chrome/Android,
 * Firefox/Windows, Firefox/Mac, Firefox/Linux, Safari/Mac, Safari/iPhone,
 * Safari/iPad, Edge/Windows, Samsung Internet/Android, Opera/Windows,
 * Googlebot, Bingbot, and regional variants.
 */

export interface BrowserProfile {
  id: string;
  name: string;
  platform: "windows" | "mac" | "linux" | "android" | "ios" | "bot";
  browser: "chrome" | "firefox" | "safari" | "edge" | "opera" | "samsung" | "bot";
  mobile: boolean;
  userAgent: string;
  acceptLanguage: string;
  accept: string;
  acceptEncoding: string;
  secChUa?: string;
  secChUaMobile?: string;
  secChUaPlatform?: string;
  secFetchDest: string;
  secFetchMode: string;
  secFetchSite: string;
  secFetchUser?: string;
  upgradeInsecureRequests?: string;
  dnt?: string;
  connection: string;
  cacheControl: string;
  pragma?: string;
}

export const BROWSER_PROFILES: BrowserProfile[] = [
  // ── Chrome on Windows ──────────────────────────────────────────────────────
  {
    id: "chrome-win-us",
    name: "Chrome 122 / Windows 11 / US",
    platform: "windows", browser: "chrome", mobile: false,
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    acceptLanguage: "en-US,en;q=0.9",
    accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
    acceptEncoding: "gzip, deflate, br, zstd",
    secChUa: '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
    secChUaMobile: "?0",
    secChUaPlatform: '"Windows"',
    secFetchDest: "document", secFetchMode: "navigate", secFetchSite: "none", secFetchUser: "?1",
    upgradeInsecureRequests: "1", dnt: "1",
    connection: "keep-alive", cacheControl: "max-age=0",
  },
  {
    id: "chrome-win-gb",
    name: "Chrome 122 / Windows 11 / UK",
    platform: "windows", browser: "chrome", mobile: false,
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    acceptLanguage: "en-GB,en;q=0.9,en-US;q=0.8",
    accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
    acceptEncoding: "gzip, deflate, br, zstd",
    secChUa: '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
    secChUaMobile: "?0", secChUaPlatform: '"Windows"',
    secFetchDest: "document", secFetchMode: "navigate", secFetchSite: "none", secFetchUser: "?1",
    upgradeInsecureRequests: "1",
    connection: "keep-alive", cacheControl: "max-age=0",
  },
  {
    id: "chrome-win-de",
    name: "Chrome 121 / Windows 10 / Germany",
    platform: "windows", browser: "chrome", mobile: false,
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    acceptLanguage: "de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7",
    accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
    acceptEncoding: "gzip, deflate, br",
    secChUa: '"Not A(Brand";v="99", "Google Chrome";v="121", "Chromium";v="121"',
    secChUaMobile: "?0", secChUaPlatform: '"Windows"',
    secFetchDest: "document", secFetchMode: "navigate", secFetchSite: "none", secFetchUser: "?1",
    upgradeInsecureRequests: "1",
    connection: "keep-alive", cacheControl: "max-age=0",
  },
  // ── Chrome on Mac ──────────────────────────────────────────────────────────
  {
    id: "chrome-mac-us",
    name: "Chrome 122 / macOS 14 / US",
    platform: "mac", browser: "chrome", mobile: false,
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    acceptLanguage: "en-US,en;q=0.9",
    accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
    acceptEncoding: "gzip, deflate, br, zstd",
    secChUa: '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
    secChUaMobile: "?0", secChUaPlatform: '"macOS"',
    secFetchDest: "document", secFetchMode: "navigate", secFetchSite: "none", secFetchUser: "?1",
    upgradeInsecureRequests: "1",
    connection: "keep-alive", cacheControl: "max-age=0",
  },
  {
    id: "chrome-mac-fr",
    name: "Chrome 122 / macOS 13 / France",
    platform: "mac", browser: "chrome", mobile: false,
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_6_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    acceptLanguage: "fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7",
    accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
    acceptEncoding: "gzip, deflate, br, zstd",
    secChUa: '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
    secChUaMobile: "?0", secChUaPlatform: '"macOS"',
    secFetchDest: "document", secFetchMode: "navigate", secFetchSite: "none", secFetchUser: "?1",
    upgradeInsecureRequests: "1",
    connection: "keep-alive", cacheControl: "max-age=0",
  },
  // ── Chrome on Linux ────────────────────────────────────────────────────────
  {
    id: "chrome-linux-us",
    name: "Chrome 122 / Linux x86_64 / US",
    platform: "linux", browser: "chrome", mobile: false,
    userAgent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    acceptLanguage: "en-US,en;q=0.9",
    accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
    acceptEncoding: "gzip, deflate, br",
    secChUa: '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
    secChUaMobile: "?0", secChUaPlatform: '"Linux"',
    secFetchDest: "document", secFetchMode: "navigate", secFetchSite: "none", secFetchUser: "?1",
    upgradeInsecureRequests: "1", dnt: "1",
    connection: "keep-alive", cacheControl: "max-age=0",
  },
  // ── Firefox ────────────────────────────────────────────────────────────────
  {
    id: "firefox-win-us",
    name: "Firefox 123 / Windows 11 / US",
    platform: "windows", browser: "firefox", mobile: false,
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0",
    acceptLanguage: "en-US,en;q=0.5",
    accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    acceptEncoding: "gzip, deflate, br",
    secFetchDest: "document", secFetchMode: "navigate", secFetchSite: "none", secFetchUser: "?1",
    upgradeInsecureRequests: "1", dnt: "1",
    connection: "keep-alive", cacheControl: "no-cache", pragma: "no-cache",
  },
  {
    id: "firefox-mac-gb",
    name: "Firefox 123 / macOS 14 / UK",
    platform: "mac", browser: "firefox", mobile: false,
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 14.3; rv:123.0) Gecko/20100101 Firefox/123.0",
    acceptLanguage: "en-GB,en;q=0.7,en-US;q=0.3",
    accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    acceptEncoding: "gzip, deflate, br",
    secFetchDest: "document", secFetchMode: "navigate", secFetchSite: "none", secFetchUser: "?1",
    upgradeInsecureRequests: "1",
    connection: "keep-alive", cacheControl: "no-cache", pragma: "no-cache",
  },
  {
    id: "firefox-linux-de",
    name: "Firefox 122 / Ubuntu Linux / Germany",
    platform: "linux", browser: "firefox", mobile: false,
    userAgent: "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:122.0) Gecko/20100101 Firefox/122.0",
    acceptLanguage: "de,en-US;q=0.7,en;q=0.3",
    accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    acceptEncoding: "gzip, deflate, br",
    secFetchDest: "document", secFetchMode: "navigate", secFetchSite: "none", secFetchUser: "?1",
    upgradeInsecureRequests: "1", dnt: "1",
    connection: "keep-alive", cacheControl: "no-cache", pragma: "no-cache",
  },
  // ── Safari ─────────────────────────────────────────────────────────────────
  {
    id: "safari-mac-us",
    name: "Safari 17 / macOS 14 Sonoma / US",
    platform: "mac", browser: "safari", mobile: false,
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_3_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3.1 Safari/605.1.15",
    acceptLanguage: "en-US,en;q=0.9",
    accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    acceptEncoding: "gzip, deflate, br",
    secFetchDest: "document", secFetchMode: "navigate", secFetchSite: "none",
    upgradeInsecureRequests: "1",
    connection: "keep-alive", cacheControl: "max-age=0",
  },
  {
    id: "safari-iphone-us",
    name: "Safari 17 / iPhone iOS 17 / US",
    platform: "ios", browser: "safari", mobile: true,
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_3_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3.1 Mobile/15E148 Safari/604.1",
    acceptLanguage: "en-US,en;q=0.9",
    accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    acceptEncoding: "gzip, deflate, br",
    secFetchDest: "document", secFetchMode: "navigate", secFetchSite: "none",
    upgradeInsecureRequests: "1",
    connection: "keep-alive", cacheControl: "max-age=0",
  },
  {
    id: "safari-ipad-gb",
    name: "Safari 17 / iPad iOS 17 / UK",
    platform: "ios", browser: "safari", mobile: true,
    userAgent: "Mozilla/5.0 (iPad; CPU OS 17_3_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3.1 Mobile/15E148 Safari/604.1",
    acceptLanguage: "en-GB,en;q=0.9",
    accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    acceptEncoding: "gzip, deflate, br",
    secFetchDest: "document", secFetchMode: "navigate", secFetchSite: "none",
    upgradeInsecureRequests: "1",
    connection: "keep-alive", cacheControl: "max-age=0",
  },
  // ── Chrome Mobile ──────────────────────────────────────────────────────────
  {
    id: "chrome-android-us",
    name: "Chrome 122 / Android 14 Pixel / US",
    platform: "android", browser: "chrome", mobile: true,
    userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.6261.119 Mobile Safari/537.36",
    acceptLanguage: "en-US,en;q=0.9",
    accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
    acceptEncoding: "gzip, deflate, br",
    secChUa: '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
    secChUaMobile: "?1", secChUaPlatform: '"Android"',
    secFetchDest: "document", secFetchMode: "navigate", secFetchSite: "none", secFetchUser: "?1",
    upgradeInsecureRequests: "1",
    connection: "keep-alive", cacheControl: "max-age=0",
  },
  {
    id: "chrome-android-samsung",
    name: "Chrome 122 / Samsung Galaxy S23 / US",
    platform: "android", browser: "chrome", mobile: true,
    userAgent: "Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36",
    acceptLanguage: "en-US,en;q=0.9",
    accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
    acceptEncoding: "gzip, deflate, br",
    secChUa: '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
    secChUaMobile: "?1", secChUaPlatform: '"Android"',
    secFetchDest: "document", secFetchMode: "navigate", secFetchSite: "none", secFetchUser: "?1",
    upgradeInsecureRequests: "1",
    connection: "keep-alive", cacheControl: "max-age=0",
  },
  // ── Edge ───────────────────────────────────────────────────────────────────
  {
    id: "edge-win-us",
    name: "Edge 122 / Windows 11 / US",
    platform: "windows", browser: "edge", mobile: false,
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 Edg/122.0.0.0",
    acceptLanguage: "en-US,en;q=0.9",
    accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
    acceptEncoding: "gzip, deflate, br, zstd",
    secChUa: '"Chromium";v="122", "Not(A:Brand";v="24", "Microsoft Edge";v="122"',
    secChUaMobile: "?0", secChUaPlatform: '"Windows"',
    secFetchDest: "document", secFetchMode: "navigate", secFetchSite: "none", secFetchUser: "?1",
    upgradeInsecureRequests: "1",
    connection: "keep-alive", cacheControl: "max-age=0",
  },
  // ── Opera ──────────────────────────────────────────────────────────────────
  {
    id: "opera-win-nl",
    name: "Opera 106 / Windows 10 / Netherlands",
    platform: "windows", browser: "opera", mobile: false,
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 OPR/106.0.0.0",
    acceptLanguage: "nl-NL,nl;q=0.9,en-US;q=0.8,en;q=0.7",
    accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
    acceptEncoding: "gzip, deflate, br",
    secChUa: '"Chromium";v="120", "Not(A:Brand";v="24", "Opera";v="106"',
    secChUaMobile: "?0", secChUaPlatform: '"Windows"',
    secFetchDest: "document", secFetchMode: "navigate", secFetchSite: "none", secFetchUser: "?1",
    upgradeInsecureRequests: "1",
    connection: "keep-alive", cacheControl: "max-age=0",
  },
  // ── Samsung Internet ───────────────────────────────────────────────────────
  {
    id: "samsung-android-kr",
    name: "Samsung Internet 23 / Android / Korea",
    platform: "android", browser: "samsung", mobile: true,
    userAgent: "Mozilla/5.0 (Linux; Android 13; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/23.0 Chrome/115.0.0.0 Mobile Safari/537.36",
    acceptLanguage: "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
    accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    acceptEncoding: "gzip, deflate, br",
    secFetchDest: "document", secFetchMode: "navigate", secFetchSite: "none",
    upgradeInsecureRequests: "1",
    connection: "keep-alive", cacheControl: "max-age=0",
  },
  // ── Bots (useful for bypassing paywalls/rate limits) ──────────────────────
  {
    id: "googlebot",
    name: "Googlebot 2.1",
    platform: "bot", browser: "bot", mobile: false,
    userAgent: "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
    acceptLanguage: "en-US,en;q=0.9",
    accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    acceptEncoding: "gzip, deflate, br",
    secFetchDest: "document", secFetchMode: "navigate", secFetchSite: "none",
    connection: "keep-alive", cacheControl: "no-cache",
  },
  {
    id: "bingbot",
    name: "Bingbot 2.0",
    platform: "bot", browser: "bot", mobile: false,
    userAgent: "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)",
    acceptLanguage: "en-US,en;q=0.9",
    accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    acceptEncoding: "gzip, deflate, br",
    secFetchDest: "document", secFetchMode: "navigate", secFetchSite: "none",
    connection: "keep-alive", cacheControl: "no-cache",
  },
];

// ─── Session-based profile assignment ────────────────────────────────────────
// Each domain gets a consistent profile for the duration of a session window
// (1 hour). This prevents header inconsistency within a scraping session.

const domainProfileCache = new Map<string, { profileId: string; assignedAt: number }>();
const SESSION_WINDOW_MS = 60 * 60 * 1000; // 1 hour

let globalProfileIndex = 0;

export function getProfileForDomain(domain: string): BrowserProfile {
  const now = Date.now();
  const cached = domainProfileCache.get(domain);

  // Reuse existing profile if within session window
  if (cached && now - cached.assignedAt < SESSION_WINDOW_MS) {
    const profile = BROWSER_PROFILES.find(p => p.id === cached.profileId);
    if (profile) return profile;
  }

  // Assign a new profile (round-robin, skip bots for non-bot requests)
  const nonBotProfiles = BROWSER_PROFILES.filter(p => p.platform !== "bot");
  const profile = nonBotProfiles[globalProfileIndex % nonBotProfiles.length];
  globalProfileIndex++;
  domainProfileCache.set(domain, { profileId: profile.id, assignedAt: now });
  return profile;
}

export function getRandomProfile(includeBots = false): BrowserProfile {
  const pool = includeBots ? BROWSER_PROFILES : BROWSER_PROFILES.filter(p => p.platform !== "bot");
  return pool[Math.floor(Math.random() * pool.length)];
}

// ─── Generate realistic public IP ────────────────────────────────────────────
// Covers major ISP ranges in US, EU, UK, DE, FR, NL, AU, JP, KR, BR

const PUBLIC_IP_RANGES: Array<[number, number, number, number]> = [
  // US Comcast
  [24, 0, 0, 0], [24, 255, 255, 255],
  // US AT&T
  [12, 0, 0, 0], [12, 255, 255, 255],
  // UK BT
  [86, 128, 0, 0], [86, 191, 255, 255],
  // Germany Telekom
  [80, 128, 0, 0], [80, 191, 255, 255],
  // France Orange
  [90, 0, 0, 0], [90, 63, 255, 255],
  // Netherlands KPN
  [84, 104, 0, 0], [84, 107, 255, 255],
  // Australia Telstra
  [110, 144, 0, 0], [110, 159, 255, 255],
  // Japan NTT
  [118, 0, 0, 0], [118, 63, 255, 255],
  // Korea KT
  [112, 160, 0, 0], [112, 191, 255, 255],
  // Brazil Claro
  [177, 0, 0, 0], [177, 63, 255, 255],
  // Canada Rogers
  [99, 224, 0, 0], [99, 255, 255, 255],
  // Sweden Telia
  [83, 248, 0, 0], [83, 255, 255, 255],
  // Poland Orange
  [83, 0, 0, 0], [83, 63, 255, 255],
  // Italy Telecom
  [79, 0, 0, 0], [79, 63, 255, 255],
  // Spain Telefonica
  [88, 0, 0, 0], [88, 63, 255, 255],
];

export function generateRealisticIp(): string {
  // Pick a random range pair
  const pairIdx = Math.floor(Math.random() * (PUBLIC_IP_RANGES.length / 2)) * 2;
  const [minA, minB, minC, minD] = PUBLIC_IP_RANGES[pairIdx];
  const [maxA, maxB, maxC, maxD] = PUBLIC_IP_RANGES[pairIdx + 1];

  const a = minA + Math.floor(Math.random() * (maxA - minA + 1));
  const b = minB + Math.floor(Math.random() * (maxB - minB + 1));
  const c = minC + Math.floor(Math.random() * (maxC - minC + 1));
  const d = Math.floor(Math.random() * 254) + 1;
  return `${a}.${b}.${c}.${d}`;
}

// ─── Build full header set from a profile ────────────────────────────────────

export function buildHeadersFromProfile(profile: BrowserProfile, targetUrl?: string): Record<string, string> {
  const ip1 = generateRealisticIp();
  const ip2 = generateRealisticIp();

  const headers: Record<string, string> = {
    "User-Agent": profile.userAgent,
    "Accept": profile.accept,
    "Accept-Language": profile.acceptLanguage,
    "Accept-Encoding": profile.acceptEncoding,
    "Connection": profile.connection,
    "Cache-Control": profile.cacheControl,
    "X-Forwarded-For": `${ip1}, ${ip2}`,
    "X-Real-IP": ip1,
    "Forwarded": `for=${ip1};proto=https`,
  };

  if (profile.pragma) headers["Pragma"] = profile.pragma;
  if (profile.upgradeInsecureRequests) headers["Upgrade-Insecure-Requests"] = profile.upgradeInsecureRequests;
  if (profile.dnt) headers["DNT"] = profile.dnt;
  if (profile.secChUa) headers["Sec-CH-UA"] = profile.secChUa;
  if (profile.secChUaMobile) headers["Sec-CH-UA-Mobile"] = profile.secChUaMobile;
  if (profile.secChUaPlatform) headers["Sec-CH-UA-Platform"] = profile.secChUaPlatform;
  if (profile.secFetchDest) headers["Sec-Fetch-Dest"] = profile.secFetchDest;
  if (profile.secFetchMode) headers["Sec-Fetch-Mode"] = profile.secFetchMode;
  if (profile.secFetchSite) headers["Sec-Fetch-Site"] = profile.secFetchSite;
  if (profile.secFetchUser) headers["Sec-Fetch-User"] = profile.secFetchUser;

  return headers;
}

export function getSpoofedHeadersForUrl(url: string): Record<string, string> {
  try {
    const domain = new URL(url).hostname;
    const profile = getProfileForDomain(domain);
    return buildHeadersFromProfile(profile, url);
  } catch {
    const profile = getRandomProfile();
    return buildHeadersFromProfile(profile);
  }
}
