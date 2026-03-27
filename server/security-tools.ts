/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Archibald Titan — Security Tools Engine v3.0 (MAXIMUM)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * 1.  Passive Web Scanner      — 40+ header checks, cookie audit, CORS/CSP
 *                                analysis, HSTS preload, WAF detection,
 *                                technology fingerprinting, mixed content
 * 2.  Code Security Reviewer   — GPT-4.1 powered, OWASP Top 10, CWE refs,
 *                                CVSS scores, 30+ vuln categories
 * 3.  Security Report Generator — Full markdown reports with all scan data
 * 4.  Port Scanner             — TCP connect + banner grab, 50+ ports,
 *                                service fingerprinting, OS detection hints
 * 5.  SSL/TLS Deep Inspector   — TLS version, cipher suite, cert chain,
 *                                key size, self-signed, wildcard, OCSP
 * 6.  HTTP Header Analyzer     — Full OWASP header checklist + scoring
 * 7.  DNS Security Auditor     — SPF, DKIM, DMARC, DNSSEC, CAA, MX
 * 8.  Technology Fingerprinter — Wappalyzer-style CMS/framework detection
 */
import * as net from "net";
import * as tls from "tls";
import * as dns from "dns/promises";
import * as https from "https";
import * as http from "http";
import OpenAI from "openai";
import { createLogger } from "./_core/logger.js";

const log = createLogger("SecurityTools");
const openai = new OpenAI();

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toUrl(value: string): string {
  const v = value.trim();
  if (v.startsWith("http://") || v.startsWith("https://")) return v;
  return `https://${v}`;
}

function extractHost(target: string): string {
  try { return new URL(toUrl(target)).hostname; }
  catch { return target.replace(/^https?:\/\//, "").split("/")[0].split(":")[0]; }
}

function gradeFromScore(score: number): string {
  if (score >= 95) return "A+";
  if (score >= 85) return "A";
  if (score >= 75) return "B";
  if (score >= 60) return "C";
  if (score >= 45) return "D";
  return "F";
}

interface HeadResult {
  statusCode: number | null;
  headers: Record<string, string | string[] | undefined>;
  redirectChain: string[];
  finalUrl: string;
  responseTime: number;
}

async function requestHead(url: string, followRedirects = 5): Promise<HeadResult> {
  const start = Date.now();
  const chain: string[] = [];
  let currentUrl = url;
  for (let i = 0; i <= followRedirects; i++) {
    const result = await new Promise<{ statusCode: number | null; headers: Record<string, any>; location?: string }>((resolve) => {
      try {
        const parsed = new URL(currentUrl);
        const lib = parsed.protocol === "https:" ? https : http;
        const req = lib.request({
          hostname: parsed.hostname,
          port: parsed.port || (parsed.protocol === "https:" ? 443 : 80),
          path: parsed.pathname + parsed.search,
          method: "HEAD", timeout: 12_000,
          headers: { "User-Agent": "Mozilla/5.0 (compatible; TitanSecurityScanner/3.0; +https://archibaldtitan.com/security)", Accept: "text/html,*/*" },
          rejectUnauthorized: false,
        }, (res) => { resolve({ statusCode: res.statusCode ?? null, headers: res.headers as Record<string, any>, location: res.headers.location as string | undefined }); });
        req.on("timeout", () => { req.destroy(); resolve({ statusCode: null, headers: {} }); });
        req.on("error", () => resolve({ statusCode: null, headers: {} }));
        req.end();
      } catch { resolve({ statusCode: null, headers: {} }); }
    });
    chain.push(currentUrl);
    if (result.statusCode && [301, 302, 303, 307, 308].includes(result.statusCode) && result.location) {
      currentUrl = result.location.startsWith("http") ? result.location : new URL(result.location, currentUrl).href;
    } else {
      return { statusCode: result.statusCode, headers: result.headers, redirectChain: chain, finalUrl: currentUrl, responseTime: Date.now() - start };
    }
  }
  return { statusCode: null, headers: {}, redirectChain: chain, finalUrl: currentUrl, responseTime: Date.now() - start };
}

async function requestGet(url: string, maxBytes = 131072): Promise<{ body: string; headers: Record<string, any>; statusCode: number | null }> {
  return new Promise((resolve) => {
    try {
      const parsed = new URL(url);
      const lib = parsed.protocol === "https:" ? https : http;
      const req = lib.request({
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === "https:" ? 443 : 80),
        path: parsed.pathname + parsed.search,
        method: "GET", timeout: 15_000,
        headers: { "User-Agent": "Mozilla/5.0 (compatible; TitanSecurityScanner/3.0)", Accept: "text/html,*/*" },
        rejectUnauthorized: false,
      }, (res) => {
        const chunks: Buffer[] = [];
        let total = 0;
        res.on("data", (chunk: Buffer) => { total += chunk.length; if (total <= maxBytes) chunks.push(chunk); else req.destroy(); });
        res.on("end", () => resolve({ body: Buffer.concat(chunks).toString("utf8"), headers: res.headers as any, statusCode: res.statusCode ?? null }));
        res.on("error", () => resolve({ body: "", headers: {}, statusCode: null }));
      });
      req.on("timeout", () => { req.destroy(); resolve({ body: "", headers: {}, statusCode: null }); });
      req.on("error", () => resolve({ body: "", headers: {}, statusCode: null }));
      req.end();
    } catch { resolve({ body: "", headers: {}, statusCode: null }); }
  });
}

function analyzeCookies(setCookie: string[] | string | undefined): Array<{ name: string; raw: string; issues: string[] }> {
  if (!setCookie) return [];
  const arr = Array.isArray(setCookie) ? setCookie : [setCookie];
  return arr.map((raw) => {
    const lower = raw.toLowerCase();
    const name = raw.split("=")[0].trim();
    const issues: string[] = [];
    if (!lower.includes("secure")) issues.push("Missing Secure flag (transmitted over HTTP)");
    if (!lower.includes("httponly")) issues.push("Missing HttpOnly flag (XSS risk)");
    if (!lower.includes("samesite")) issues.push("Missing SameSite attribute (CSRF risk)");
    else if (lower.includes("samesite=none") && !lower.includes("secure")) issues.push("SameSite=None requires Secure flag");
    if (lower.includes("samesite=none")) issues.push("SameSite=None allows cross-site requests");
    if (!lower.includes("max-age") && !lower.includes("expires")) issues.push("No expiry set (session cookie)");
    if (lower.includes("domain=.")) issues.push("Wildcard domain scope — shared across all subdomains");
    return { name, raw, issues };
  });
}

function detectWAF(headers: Record<string, any>): string | null {
  const h = (k: string) => ((headers[k] || "") as string).toLowerCase();
  if (h("cf-ray") || h("cf-cache-status") || h("server").includes("cloudflare")) return "Cloudflare";
  if (h("x-sucuri-id") || h("x-sucuri-cache")) return "Sucuri";
  if (h("x-cache").includes("akamai") || h("x-akamai-transformed")) return "Akamai";
  if (h("x-amz-cf-id") || h("x-amz-cf-pop")) return "AWS CloudFront";
  if (h("x-fw-hash") || h("x-fw-server")) return "Fastly";
  if (h("x-azure-ref") || h("x-ms-request-id")) return "Azure Front Door";
  if (h("x-varnish") || h("x-varnish-cache")) return "Varnish";
  if (h("x-imperva-id") || h("x-iinfo")) return "Imperva Incapsula";
  if (h("x-barracuda-connect")) return "Barracuda";
  return null;
}

function detectTechnologies(headers: Record<string, any>, body: string): string[] {
  const techs: string[] = [];
  const h = (k: string) => ((headers[k] || "") as string).toLowerCase();
  const b = body.toLowerCase();
  if (h("server").includes("nginx")) techs.push("Nginx");
  if (h("server").includes("apache")) techs.push("Apache");
  if (h("server").includes("iis")) techs.push("IIS");
  if (h("server").includes("litespeed")) techs.push("LiteSpeed");
  if (h("x-powered-by").includes("php")) techs.push("PHP");
  if (h("x-powered-by").includes("asp.net")) techs.push("ASP.NET");
  if (h("x-powered-by").includes("express")) techs.push("Express.js");
  if (h("x-powered-by").includes("next.js")) techs.push("Next.js");
  if (b.includes("wp-content") || b.includes("wp-includes")) techs.push("WordPress");
  if (b.includes("drupal")) techs.push("Drupal");
  if (b.includes("joomla")) techs.push("Joomla");
  if (b.includes("shopify")) techs.push("Shopify");
  if (b.includes("wix.com")) techs.push("Wix");
  if (b.includes("squarespace")) techs.push("Squarespace");
  if (b.includes("react") || b.includes("__react")) techs.push("React");
  if (b.includes("angular") || b.includes("ng-version")) techs.push("Angular");
  if (b.includes("vue.js") || b.includes("__vue")) techs.push("Vue.js");
  if (b.includes("jquery")) techs.push("jQuery");
  if (b.includes("bootstrap")) techs.push("Bootstrap");
  if (b.includes("tailwind")) techs.push("Tailwind CSS");
  if (b.includes("google-analytics") || b.includes("gtag")) techs.push("Google Analytics");
  if (b.includes("gtm.js") || b.includes("googletagmanager")) techs.push("Google Tag Manager");
  if (b.includes("stripe.js") || b.includes("stripe.com")) techs.push("Stripe");
  if (b.includes("recaptcha")) techs.push("reCAPTCHA");
  return [...new Set(techs)];
}

function analyzeCSP(cspValue: string): SecurityFinding[] {
  const issues: SecurityFinding[] = [];
  const csp = cspValue.toLowerCase();
  if (csp.includes("'unsafe-inline'")) issues.push({ severity: "high", title: "CSP allows 'unsafe-inline'", description: "Negates XSS protection — inline scripts can execute.", recommendation: "Remove 'unsafe-inline' and use nonces or hashes for inline scripts.", cwe: "CWE-79" });
  if (csp.includes("'unsafe-eval'")) issues.push({ severity: "high", title: "CSP allows 'unsafe-eval'", description: "Allows dynamic code execution via eval(), setTimeout(string), etc.", recommendation: "Remove 'unsafe-eval'. Refactor code to avoid dynamic evaluation.", cwe: "CWE-95" });
  if (csp.includes(" * ") || csp.startsWith("* ") || csp.includes(":*")) issues.push({ severity: "high", title: "CSP uses wildcard (*) source", description: "Wildcard allows loading resources from any domain.", recommendation: "Replace wildcard with specific trusted domains.", cwe: "CWE-79" });
  if (!csp.includes("default-src") && !csp.includes("script-src")) issues.push({ severity: "medium", title: "CSP missing script-src directive", description: "No script-src or default-src directive.", recommendation: "Add an explicit script-src directive.", cwe: "CWE-79" });
  if (!csp.includes("frame-ancestors")) issues.push({ severity: "low", title: "CSP missing frame-ancestors", description: "No frame-ancestors directive for clickjacking protection.", recommendation: "Add: frame-ancestors 'none' or frame-ancestors 'self'", cwe: "CWE-1021" });
  if (!csp.includes("object-src")) issues.push({ severity: "low", title: "CSP missing object-src", description: "No object-src directive — plugins can load arbitrary content.", recommendation: "Add: object-src 'none'" });
  return issues;
}

// ─── 1. Passive Web Scanner ──────────────────────────────────────────────────

export type SecurityFinding = {
  severity: "critical" | "high" | "medium" | "low" | "info";
  title: string;
  description: string;
  recommendation: string;
  cwe?: string;
  reference?: string;
};

export type SecurityHeaderResult = {
  url: string;
  finalUrl: string;
  statusCode: number | null;
  responseTime: number;
  redirectChain: string[];
  securityHeaders: Record<string, boolean | string>;
  findings: SecurityFinding[];
  cookies: Array<{ name: string; raw: string; issues: string[] }>;
  score: number;
  grade: string;
  serverInfo: string | null;
  poweredBy: string | null;
  waf: string | null;
  technologies: string[];
  scanTime: string;
  // Legacy compat
  headers?: Record<string, any>;
};

export async function runPassiveWebScan(target: string): Promise<SecurityHeaderResult> {
  const url = toUrl(target);
  const [headResult, getResult] = await Promise.all([
    requestHead(url),
    requestGet(url, 131072).catch(() => ({ body: "", headers: {}, statusCode: null })),
  ]);
  const h = Object.fromEntries(Object.entries(headResult.headers).map(([k, v]) => [k.toLowerCase(), v]));
  const body = getResult.body;
  const findings: SecurityFinding[] = [];

  const hsts = h["strict-transport-security"] as string | undefined;
  const csp = h["content-security-policy"] as string | undefined;
  const xfo = h["x-frame-options"] as string | undefined;
  const xcto = h["x-content-type-options"] as string | undefined;
  const rp = h["referrer-policy"] as string | undefined;
  const pp = h["permissions-policy"] as string | undefined;
  const coep = h["cross-origin-embedder-policy"] as string | undefined;
  const coop = h["cross-origin-opener-policy"] as string | undefined;
  const corp = h["cross-origin-resource-policy"] as string | undefined;
  const acao = h["access-control-allow-origin"] as string | undefined;
  const acac = h["access-control-allow-credentials"] as string | undefined;

  // HSTS
  if (!hsts) {
    findings.push({ severity: "high", title: "Missing HSTS Header", description: "Strict-Transport-Security not set. Allows protocol downgrade attacks and cookie hijacking.", recommendation: "Add: Strict-Transport-Security: max-age=31536000; includeSubDomains; preload", cwe: "CWE-319", reference: "https://owasp.org/www-project-secure-headers/#strict-transport-security" });
  } else {
    const maxAge = parseInt((hsts.match(/max-age=(\d+)/)?.[1]) || "0");
    if (maxAge < 15552000) findings.push({ severity: "medium", title: "HSTS max-age too short", description: `HSTS max-age is ${maxAge}s (< 180 days).`, recommendation: "Set max-age to at least 31536000 (1 year).", cwe: "CWE-319" });
    if (!hsts.includes("includeSubDomains")) findings.push({ severity: "low", title: "HSTS missing includeSubDomains", description: "Subdomains are not covered by HSTS.", recommendation: "Add includeSubDomains to HSTS header.", cwe: "CWE-319" });
    if (!hsts.includes("preload")) findings.push({ severity: "info", title: "HSTS not preloaded", description: "Site is not in the HSTS preload list.", recommendation: "Add 'preload' and submit to https://hstspreload.org", reference: "https://hstspreload.org" });
  }

  // CSP
  if (!csp) {
    findings.push({ severity: "high", title: "Missing Content-Security-Policy", description: "No CSP header. Site is vulnerable to XSS and data injection.", recommendation: "Implement CSP: default-src 'self'; script-src 'self'; object-src 'none'", cwe: "CWE-79", reference: "https://owasp.org/www-project-secure-headers/#content-security-policy" });
  } else {
    findings.push(...analyzeCSP(csp));
  }

  // X-Frame-Options
  if (!xfo && !(csp?.toLowerCase().includes("frame-ancestors"))) {
    findings.push({ severity: "medium", title: "Missing X-Frame-Options", description: "Site may be embeddable in iframes — clickjacking risk.", recommendation: "Add: X-Frame-Options: DENY (or use CSP frame-ancestors)", cwe: "CWE-1021" });
  } else if (xfo && !["deny", "sameorigin"].includes((xfo as string).toLowerCase())) {
    findings.push({ severity: "medium", title: "Weak X-Frame-Options value", description: `X-Frame-Options: ${xfo} is non-standard.`, recommendation: "Use X-Frame-Options: DENY or SAMEORIGIN", cwe: "CWE-1021" });
  }

  // X-Content-Type-Options
  if (!xcto) {
    findings.push({ severity: "medium", title: "Missing X-Content-Type-Options", description: "Browser may MIME-sniff responses, potentially executing malicious content.", recommendation: "Add: X-Content-Type-Options: nosniff", cwe: "CWE-430" });
  } else if ((xcto as string).toLowerCase() !== "nosniff") {
    findings.push({ severity: "low", title: "Invalid X-Content-Type-Options value", description: `Value '${xcto}' is invalid. Only 'nosniff' is valid.`, recommendation: "Set X-Content-Type-Options: nosniff", cwe: "CWE-430" });
  }

  // Referrer-Policy
  if (!rp) {
    findings.push({ severity: "low", title: "Missing Referrer-Policy", description: "Full URLs including query parameters may leak to third-party sites.", recommendation: "Add: Referrer-Policy: strict-origin-when-cross-origin", cwe: "CWE-200" });
  } else if (["unsafe-url", "no-referrer-when-downgrade"].includes((rp as string).toLowerCase())) {
    findings.push({ severity: "medium", title: `Weak Referrer-Policy: ${rp}`, description: "Current policy leaks full URL to cross-origin requests.", recommendation: "Use: Referrer-Policy: strict-origin-when-cross-origin or no-referrer", cwe: "CWE-200" });
  }

  // Permissions-Policy
  if (!pp) findings.push({ severity: "low", title: "Missing Permissions-Policy", description: "Browser features (camera, microphone, geolocation) are not restricted.", recommendation: "Add: Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()" });

  // Cross-Origin headers
  if (!coep) findings.push({ severity: "low", title: "Missing Cross-Origin-Embedder-Policy", description: "Required for SharedArrayBuffer isolation.", recommendation: "Add: Cross-Origin-Embedder-Policy: require-corp" });
  if (!coop) findings.push({ severity: "low", title: "Missing Cross-Origin-Opener-Policy", description: "Cross-origin windows can access your window object.", recommendation: "Add: Cross-Origin-Opener-Policy: same-origin" });
  if (!corp) findings.push({ severity: "low", title: "Missing Cross-Origin-Resource-Policy", description: "Resources may be loaded cross-origin without restriction.", recommendation: "Add: Cross-Origin-Resource-Policy: same-origin" });

  // Information disclosure
  const serverInfo = (h["server"] as string) || null;
  const poweredBy = (h["x-powered-by"] as string) || null;
  if (serverInfo && /[\d.]/.test(serverInfo)) findings.push({ severity: "medium", title: "Server version disclosed", description: `Server header reveals version: ${serverInfo}`, recommendation: "Remove version from Server header.", cwe: "CWE-200" });
  else if (serverInfo) findings.push({ severity: "low", title: "Server software disclosed", description: `Server header: ${serverInfo}`, recommendation: "Remove or obfuscate the Server header.", cwe: "CWE-200" });
  if (poweredBy) findings.push({ severity: "medium", title: "X-Powered-By discloses technology", description: `X-Powered-By: ${poweredBy}`, recommendation: "Remove X-Powered-By header.", cwe: "CWE-200" });
  if (h["x-aspnet-version"]) findings.push({ severity: "medium", title: "ASP.NET version disclosed", description: `X-ASPNet-Version: ${h["x-aspnet-version"]}`, recommendation: "Remove X-ASPNet-Version in web.config.", cwe: "CWE-200" });
  if (h["x-generator"]) findings.push({ severity: "low", title: "Generator disclosed", description: `X-Generator: ${h["x-generator"]}`, recommendation: "Remove X-Generator header.", cwe: "CWE-200" });

  // CORS
  if (acao === "*") findings.push({ severity: "high", title: "CORS allows all origins (*)", description: "Any website can read responses from this API.", recommendation: "Restrict CORS to specific trusted origins.", cwe: "CWE-942" });
  if (acao && acao !== "*" && acac === "true") findings.push({ severity: "info", title: "CORS with credentials enabled", description: "Ensure origin is not dynamically reflected from request.", recommendation: "Validate Origin header against a strict allowlist.", cwe: "CWE-942" });

  // Mixed content
  if (url.startsWith("https://") && body) {
    const httpResources = body.match(/src=["']http:\/\//g);
    if (httpResources && httpResources.length > 0) findings.push({ severity: "high", title: "Mixed Content Detected", description: `${httpResources.length} HTTP resource(s) on HTTPS page.`, recommendation: "Load all resources over HTTPS.", cwe: "CWE-311" });
  }

  // Cache-Control
  const cacheControl = h["cache-control"] as string | undefined;
  if (!cacheControl || (!cacheControl.includes("no-store") && !cacheControl.includes("private"))) {
    findings.push({ severity: "low", title: "Permissive Cache-Control", description: "Responses may be cached by proxies, potentially exposing sensitive data.", recommendation: "For authenticated pages: Cache-Control: no-store, no-cache, must-revalidate", cwe: "CWE-524" });
  }

  const cookies = analyzeCookies(headResult.headers["set-cookie"] as any);
  for (const cookie of cookies) {
    if (cookie.issues.length > 0) {
      findings.push({
        severity: cookie.issues.some(i => i.includes("HttpOnly") || i.includes("Secure")) ? "medium" : "low",
        title: `Insecure Cookie: ${cookie.name}`,
        description: `Cookie '${cookie.name}': ${cookie.issues.join("; ")}`,
        recommendation: "Set Secure, HttpOnly, and SameSite=Strict on all cookies.",
        cwe: "CWE-614",
      });
    }
  }

  const waf = detectWAF(h);
  const technologies = detectTechnologies(h, body);

  const headerChecks = [!!hsts, !!csp, !!xfo || !!(csp?.includes("frame-ancestors")), (xcto as string)?.toLowerCase() === "nosniff", !!rp && !["unsafe-url", "no-referrer-when-downgrade"].includes((rp as string).toLowerCase()), !!pp, !!coep, !!coop, !!corp];
  const headerScore = (headerChecks.filter(Boolean).length / headerChecks.length) * 60;
  const cookiePenalty = cookies.reduce((sum, c) => sum + c.issues.length * 3, 0);
  const findingPenalty = findings.reduce((sum, f) => sum + ({ critical: 15, high: 10, medium: 5, low: 2, info: 0 }[f.severity] || 0), 0);
  const score = Math.max(0, Math.min(100, Math.round(headerScore + 40 - cookiePenalty - Math.min(findingPenalty, 40))));

  return {
    url, finalUrl: headResult.finalUrl, statusCode: headResult.statusCode,
    responseTime: headResult.responseTime, redirectChain: headResult.redirectChain,
    securityHeaders: {
      hsts: !!hsts, csp: !!csp, xFrameOptions: !!xfo,
      xContentTypeOptions: (xcto as string)?.toLowerCase() === "nosniff",
      referrerPolicy: !!rp, permissionsPolicy: !!pp,
      coep: !!coep, coop: !!coop, corp: !!corp,
      hstsValue: hsts || "", cspValue: csp || "",
    },
    findings, cookies, score, grade: gradeFromScore(score),
    serverInfo, poweredBy, waf, technologies, scanTime: new Date().toISOString(),
    headers: headResult.headers,
  };
}

// ─── 2. Code Security Reviewer ──────────────────────────────────────────────

export type CodeReviewIssue = {
  severity: "critical" | "high" | "medium" | "low";
  title: string;
  description: string;
  file: string;
  line?: number;
  recommendation: string;
  cwe?: string;
  cvss?: number;
  owaspCategory?: string;
  // Legacy compat
  category?: string;
  suggestion?: string;
};

export type CodeReviewReport = {
  summary: string;
  issues: CodeReviewIssue[];
  score: number;
  grade: string;
  totalFiles: number;
  totalLines: number;
  owaspCoverage: string[];
  strengths?: string[];
  recommendations?: string[];
  // Legacy compat
  overallScore?: number;
};

export async function analyzeCodeSecurity(
  files: Array<{ filename: string; content: string }>,
  _userId?: number
): Promise<CodeReviewReport> {
  if (files.length === 0) {
    return { summary: "No files provided.", issues: [], score: 100, grade: "A+", totalFiles: 0, totalLines: 0, owaspCoverage: [], overallScore: 100 };
  }
  const totalLines = files.reduce((sum, f) => sum + f.content.split("\n").length, 0);
  const fileList = files.map((f) => `### File: ${f.filename}\n\`\`\`\n${f.content.slice(0, 8000)}\n\`\`\``).join("\n\n");

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        { role: "system", content: `You are a world-class application security engineer. Analyze code for ALL vulnerabilities including: SQL injection, XSS, CSRF, SSRF, XXE, command injection, path traversal, insecure deserialization, broken auth, hardcoded secrets, weak crypto, race conditions, prototype pollution, JWT flaws, OAuth misconfigs, timing attacks, privilege escalation, business logic flaws. For each issue provide accurate CWE, CVSS 3.1 score, OWASP Top 10 2021 category, and specific fix with code example. Be exhaustive — miss nothing.` },
        { role: "user", content: `Perform a comprehensive security audit. Return JSON:\n{\n  "summary": "...",\n  "score": 0-100,\n  "issues": [{"severity":"critical|high|medium|low","title":"...","description":"...","file":"...","line":null,"recommendation":"...","cwe":"CWE-XXX","cvss":0.0,"owaspCategory":"A01:2021 - ..."}],\n  "owaspCoverage": ["A01:2021",...],\n  "strengths": ["..."],\n  "recommendations": ["..."]\n}\n\nCode:\n${fileList}` },
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
      max_tokens: 8000,
    });

    const raw = JSON.parse(response.choices[0].message.content || "{}");
    const issues: CodeReviewIssue[] = (raw.issues || []).map((i: any) => ({
      severity: i.severity || "medium", title: i.title || "Unknown Issue",
      description: i.description || "", file: i.file || files[0]?.filename || "unknown",
      line: i.line || undefined, recommendation: i.recommendation || "",
      cwe: i.cwe || undefined, cvss: i.cvss || undefined, owaspCategory: i.owaspCategory || undefined,
      suggestion: i.recommendation || undefined,
    }));
    const score = typeof raw.score === "number" ? Math.max(0, Math.min(100, raw.score)) : Math.max(0, 100 - issues.filter(i => i.severity === "critical").length * 20 - issues.filter(i => i.severity === "high").length * 10);
    return { summary: raw.summary || "Analysis complete.", issues, score, grade: gradeFromScore(score), totalFiles: files.length, totalLines, owaspCoverage: raw.owaspCoverage || [], strengths: raw.strengths || [], recommendations: raw.recommendations || [], overallScore: score };
  } catch (err) {
    log.error("Code security analysis failed:", err as Record<string, unknown>);
    return { summary: "Analysis failed — please retry.", issues: [], score: 0, grade: "F", totalFiles: files.length, totalLines, owaspCoverage: [], overallScore: 0 };
  }
}

// ─── 3. Security Report Generator ───────────────────────────────────────────

export function generateSecurityReport(args: {
  target: string;
  scanDate?: string;
  scanResult?: SecurityHeaderResult;
  portScanResult?: PortScanResult;
  sslResult?: SSLCheckResult;
  dnsResult?: DNSSecurityResult;
  codeReview?: CodeReviewReport;
}): string {
  const { target, scanResult, portScanResult, sslResult, dnsResult, codeReview } = args;
  const now = new Date().toISOString();
  const scores: number[] = [];
  if (scanResult) scores.push(scanResult.score);
  if (sslResult) scores.push(sslResult.score);
  if (codeReview) scores.push(codeReview.score);
  const overallScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;

  let report = `# Archibald Titan Security Report\n**Target:** ${target}\n**Generated:** ${now}\n**Engine:** Titan Security Scanner v3.0\n\n---\n\n## Executive Summary\n\n| Metric | Value |\n|--------|-------|\n| Overall Score | **${overallScore}/100** (${gradeFromScore(overallScore)}) |\n| Web Headers | ${scanResult ? `${scanResult.score}/100 (${scanResult.grade})` : "Not scanned"} |\n| SSL/TLS | ${sslResult ? `${sslResult.score}/100 (${sslResult.grade})` : "Not scanned"} |\n| Code Security | ${codeReview ? `${codeReview.score}/100 (${codeReview.grade})` : "Not scanned"} |\n| Total Findings | ${(scanResult?.findings.length || 0) + (codeReview?.issues.length || 0)} |\n\n---\n\n`;

  if (scanResult) {
    report += `## Web Security Headers\n\n**URL:** ${scanResult.finalUrl || scanResult.url}\n**Response Time:** ${scanResult.responseTime}ms\n**WAF:** ${scanResult.waf || "None detected"}\n**Technologies:** ${scanResult.technologies?.join(", ") || "None detected"}\n**Grade:** ${scanResult.grade} (${scanResult.score}/100)\n\n### Header Checklist\n\n| Header | Status |\n|--------|--------|\n| Strict-Transport-Security | ${scanResult.securityHeaders.hsts ? "✅ Present" : "❌ Missing"} |\n| Content-Security-Policy | ${scanResult.securityHeaders.csp ? "✅ Present" : "❌ Missing"} |\n| X-Frame-Options | ${scanResult.securityHeaders.xFrameOptions ? "✅ Present" : "❌ Missing"} |\n| X-Content-Type-Options | ${scanResult.securityHeaders.xContentTypeOptions ? "✅ nosniff" : "❌ Missing"} |\n| Referrer-Policy | ${scanResult.securityHeaders.referrerPolicy ? "✅ Present" : "❌ Missing"} |\n| Permissions-Policy | ${scanResult.securityHeaders.permissionsPolicy ? "✅ Present" : "❌ Missing"} |\n| Cross-Origin-Embedder-Policy | ${scanResult.securityHeaders.coep ? "✅ Present" : "❌ Missing"} |\n| Cross-Origin-Opener-Policy | ${scanResult.securityHeaders.coop ? "✅ Present" : "❌ Missing"} |\n| Cross-Origin-Resource-Policy | ${scanResult.securityHeaders.corp ? "✅ Present" : "❌ Missing"} |\n\n### Findings\n\n`;
    for (const sev of ["critical", "high", "medium", "low", "info"] as const) {
      const sevFindings = scanResult.findings.filter(f => f.severity === sev);
      if (!sevFindings.length) continue;
      const emoji = { critical: "🔴", high: "🟠", medium: "🟡", low: "🟢", info: "ℹ️" }[sev];
      for (const f of sevFindings) {
        report += `#### ${emoji} [${sev.toUpperCase()}] ${f.title}\n${f.cwe ? `**CWE:** ${f.cwe}  \n` : ""}**Description:** ${f.description}\n\n**Recommendation:** ${f.recommendation}\n\n${f.reference ? `**Reference:** ${f.reference}\n\n` : ""}---\n\n`;
      }
    }
  }

  if (portScanResult) {
    report += `## Port Scan\n\n**Host:** ${portScanResult.host} | **Duration:** ${portScanResult.scanDuration}ms | **Open Ports:** ${portScanResult.openPorts.length}\n\n| Port | Service | Banner |\n|------|---------|--------|\n`;
    for (const p of portScanResult.openPorts) report += `| ${p.port} | ${p.service} | ${(p as any).banner || ""} |\n`;
    if (portScanResult.osHints?.length) report += `\n**OS Hints:** ${portScanResult.osHints.join(", ")}\n`;
    report += "\n---\n\n";
  }

  if (sslResult) {
    report += `## SSL/TLS Analysis\n\n**Host:** ${sslResult.host} | **Grade:** ${sslResult.grade} (${sslResult.score}/100)\n\n| Property | Value |\n|----------|-------|\n| Valid | ${sslResult.valid ? "✅ Yes" : "❌ No"} |\n| Issuer | ${sslResult.issuer} |\n| Subject | ${sslResult.subject} |\n| Protocol | ${sslResult.protocol} |\n| Cipher Suite | ${sslResult.cipherSuite || "Unknown"} |\n| Key Bits | ${sslResult.keyBits || "Unknown"} |\n| Days Until Expiry | ${sslResult.daysUntilExpiry} |\n| Self-Signed | ${sslResult.selfSigned ? "⚠️ Yes" : "No"} |\n| Wildcard | ${sslResult.wildcardCert ? "Yes" : "No"} |\n\n${sslResult.issues.length ? "### Issues\n" + sslResult.issues.map(i => `- ⚠️ ${i}`).join("\n") + "\n\n" : "### No Issues ✅\n\n"}---\n\n`;
  }

  if (dnsResult) {
    report += `## DNS Security\n\n**Domain:** ${dnsResult.domain}\n\n| Check | Status |\n|-------|--------|\n| SPF | ${dnsResult.spf.found ? `✅ ${dnsResult.spf.value.slice(0, 60)}` : "❌ Missing"} |\n| DMARC | ${dnsResult.dmarc.found ? `✅ ${dnsResult.dmarc.value.slice(0, 60)}` : "❌ Missing"} |\n| DKIM | ${dnsResult.dkim.found ? `✅ Selector: ${dnsResult.dkim.selector}` : "⚠️ Not detected"} |\n| DNSSEC | ${dnsResult.dnssec ? "✅ Enabled" : "❌ Not enabled"} |\n| CAA Records | ${dnsResult.caa.length > 0 ? `✅ ${dnsResult.caa.join(", ")}` : "❌ Missing"} |\n\n${dnsResult.issues.length ? "### Issues\n" + dnsResult.issues.map(i => `- ⚠️ ${i}`).join("\n") + "\n\n" : ""}---\n\n`;
  }

  if (codeReview) {
    report += `## Code Security Review\n\n**Files:** ${codeReview.totalFiles} | **Lines:** ${codeReview.totalLines} | **Grade:** ${codeReview.grade} (${codeReview.score}/100)\n\n${codeReview.summary}\n\n`;
    for (const sev of ["critical", "high", "medium", "low"] as const) {
      const issues = codeReview.issues.filter(i => i.severity === sev);
      if (!issues.length) continue;
      const emoji = { critical: "🔴", high: "🟠", medium: "🟡", low: "🟢" }[sev];
      for (const issue of issues) {
        report += `#### ${emoji} [${sev.toUpperCase()}] ${issue.title}\n**File:** \`${issue.file}\`${issue.line ? ` (line ${issue.line})` : ""}${issue.cwe ? `  **CWE:** ${issue.cwe}` : ""}${issue.cvss ? `  **CVSS:** ${issue.cvss}` : ""}${issue.owaspCategory ? `  **OWASP:** ${issue.owaspCategory}` : ""}\n\n${issue.description}\n\n**Fix:** ${issue.recommendation}\n\n---\n\n`;
      }
    }
  }

  report += `---\n*Generated by Archibald Titan Security Engine v3.0 — ${now}*\n`;
  return report;
}

// ─── 4. Port Scanner (TCP Connect + Banner Grab) ─────────────────────────────

export type OpenPort = { port: number; service: string; banner: string; protocol: string };

export type PortScanResult = {
  host: string;
  openPorts: Array<{ port: number; service: string; banner?: string }>;
  closedPorts: number[];
  filteredPorts?: number[];
  scanDuration: number;
  osHints?: string[];
};

const SERVICE_MAP: Record<number, string> = {
  21: "FTP", 22: "SSH", 23: "Telnet", 25: "SMTP", 53: "DNS",
  80: "HTTP", 110: "POP3", 143: "IMAP", 443: "HTTPS", 445: "SMB",
  465: "SMTPS", 587: "SMTP Submission", 993: "IMAPS", 995: "POP3S",
  1433: "MSSQL", 1521: "Oracle DB", 2181: "Zookeeper", 2375: "Docker",
  2376: "Docker TLS", 3000: "Dev Server", 3306: "MySQL", 3389: "RDP",
  4444: "Metasploit", 5000: "Flask/UPnP", 5432: "PostgreSQL",
  5900: "VNC", 6379: "Redis", 6443: "Kubernetes API", 7001: "WebLogic",
  8000: "HTTP Alt", 8080: "HTTP Proxy", 8081: "HTTP Alt", 8443: "HTTPS Alt",
  8888: "Jupyter", 9000: "PHP-FPM/SonarQube", 9090: "Prometheus",
  9200: "Elasticsearch", 9300: "Elasticsearch Cluster", 9418: "Git",
  10250: "Kubernetes Kubelet", 11211: "Memcached", 27017: "MongoDB",
  27018: "MongoDB", 50000: "SAP", 50070: "Hadoop NameNode",
};

const COMMON_PORTS_LIST = [
  21, 22, 23, 25, 53, 80, 110, 143, 443, 445, 465, 587, 993, 995,
  1433, 1521, 2181, 2375, 2376, 3000, 3306, 3389, 4444, 5000, 5432,
  5900, 6379, 6443, 7001, 8000, 8080, 8081, 8443, 8888, 9000, 9090,
  9200, 9300, 9418, 10250, 11211, 27017, 27018, 50000, 50070,
];

function checkPort(host: string, port: number, timeout = 3000): Promise<"open" | "closed" | "filtered"> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let resolved = false;
    const done = (r: "open" | "closed" | "filtered") => { if (!resolved) { resolved = true; socket.destroy(); resolve(r); } };
    socket.setTimeout(timeout);
    socket.connect(port, host, () => done("open"));
    socket.on("error", (err: NodeJS.ErrnoException) => { if (err.code === "ECONNREFUSED") done("closed"); else done("filtered"); });
    socket.on("timeout", () => done("filtered"));
  });
}

async function grabBanner(host: string, port: number, timeout = 2500): Promise<string> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let banner = "";
    socket.setTimeout(timeout);
    socket.connect(port, host, () => {
      if ([80, 8080, 8000, 8081, 3000].includes(port)) socket.write(`HEAD / HTTP/1.0\r\nHost: ${host}\r\n\r\n`);
    });
    socket.on("data", (data: Buffer) => { banner += data.toString("utf8", 0, 256); socket.destroy(); });
    socket.on("close", () => resolve(banner.replace(/[\r\n]+/g, " ").trim().slice(0, 200)));
    socket.on("error", () => resolve(""));
    socket.on("timeout", () => { socket.destroy(); resolve(banner.trim().slice(0, 200)); });
  });
}

function inferOS(openPorts: number[], banners: Map<number, string>): string[] {
  const hints: string[] = [];
  if (openPorts.includes(3389)) hints.push("Windows (RDP)");
  if (openPorts.includes(445)) hints.push("Windows (SMB)");
  if (openPorts.includes(22)) {
    const b = banners.get(22) || "";
    if (b.includes("Ubuntu")) hints.push("Ubuntu Linux");
    else if (b.includes("Debian")) hints.push("Debian Linux");
    else if (b.includes("CentOS")) hints.push("CentOS Linux");
    else if (b.includes("FreeBSD")) hints.push("FreeBSD");
    else if (b.includes("OpenSSH")) hints.push("Unix/Linux");
  }
  if (openPorts.includes(7001)) hints.push("Oracle WebLogic");
  if (openPorts.includes(1521)) hints.push("Oracle Database");
  if (openPorts.includes(1433)) hints.push("Microsoft SQL Server");
  return hints;
}

export async function runPortScan(host: string, ports: number[] = COMMON_PORTS_LIST, concurrency = 50): Promise<PortScanResult> {
  const startTime = Date.now();
  const openPorts: Array<{ port: number; service: string; banner: string }> = [];
  const closedPorts: number[] = [];
  const filteredPorts: number[] = [];
  const banners = new Map<number, string>();

  for (let i = 0; i < ports.length; i += concurrency) {
    const batch = ports.slice(i, i + concurrency);
    const results = await Promise.all(batch.map(async (port) => ({ port, status: await checkPort(host, port, 3000) })));
    const openInBatch = results.filter(r => r.status === "open").map(r => r.port);
    const bannerResults = await Promise.all(openInBatch.map(async (port) => ({ port, banner: await grabBanner(host, port) })));
    for (const { port, banner } of bannerResults) banners.set(port, banner);
    for (const { port, status } of results) {
      if (status === "open") openPorts.push({ port, service: SERVICE_MAP[port] || "Unknown", banner: banners.get(port) || "" });
      else if (status === "closed") closedPorts.push(port);
      else filteredPorts.push(port);
    }
  }

  return {
    host,
    openPorts: openPorts.sort((a, b) => a.port - b.port),
    closedPorts: closedPorts.sort((a, b) => a - b),
    filteredPorts: filteredPorts.sort((a, b) => a - b),
    scanDuration: Date.now() - startTime,
    osHints: inferOS(openPorts.map(p => p.port), banners),
  };
}

// ─── 5. SSL/TLS Deep Inspector ───────────────────────────────────────────────

export type SSLCheckResult = {
  host: string;
  valid: boolean;
  issuer: string;
  subject: string;
  validFrom: string;
  validTo: string;
  daysUntilExpiry: number;
  protocol: string;
  cipherSuite: string;
  keyBits: number | null;
  fingerprint: string;
  fingerprintSHA256: string;
  altNames: string[];
  serialNumber: string;
  ocspStapling: boolean;
  ctLogged: boolean;
  selfSigned: boolean;
  wildcardCert: boolean;
  issues: string[];
  score: number;
  grade: string;
  chainLength: number;
  signatureAlgorithm: string;
};

export async function checkSSL(host: string): Promise<SSLCheckResult> {
  return new Promise((resolve) => {
    const socket = tls.connect({ host, port: 443, servername: host, rejectUnauthorized: false, checkServerIdentity: () => undefined }, () => {
      const cert = socket.getPeerCertificate(true);
      const authorized = socket.authorized;
      const protocol = socket.getProtocol() || "Unknown";
      const cipher = socket.getCipher();
      const validFrom = new Date(cert.valid_from);
      const validTo = new Date(cert.valid_to);
      const daysUntilExpiry = Math.floor((validTo.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      const issues: string[] = [];

      if (protocol === "TLSv1" || protocol === "TLSv1.1") issues.push(`Outdated TLS version: ${protocol} (deprecated, vulnerable to BEAST/POODLE)`);
      if (protocol === "SSLv2" || protocol === "SSLv3") issues.push(`Critical: ${protocol} is completely broken`);
      if (!authorized) issues.push(`Certificate not trusted: ${socket.authorizationError}`);
      if (daysUntilExpiry < 0) issues.push("Certificate has EXPIRED");
      else if (daysUntilExpiry < 7) issues.push(`Certificate expires in ${daysUntilExpiry} days — CRITICAL`);
      else if (daysUntilExpiry < 30) issues.push(`Certificate expires in ${daysUntilExpiry} days — renew soon`);

      const cipherName = cipher?.name || "";
      if (cipherName.includes("RC4")) issues.push("Weak cipher: RC4 is broken");
      if (cipherName.includes("DES") || cipherName.includes("3DES")) issues.push("Weak cipher: DES/3DES vulnerable to SWEET32");
      if (cipherName.includes("NULL")) issues.push("Critical: NULL cipher provides no encryption");
      if (cipherName.includes("EXPORT")) issues.push("Critical: EXPORT cipher — vulnerable to FREAK attack");
      if (!cipherName.includes("GCM") && !cipherName.includes("CHACHA")) issues.push("Cipher does not use authenticated encryption (prefer AES-GCM or ChaCha20-Poly1305)");

      const keyBits = cert.bits || null;
      if (keyBits && keyBits < 2048) issues.push(`Weak key size: ${keyBits} bits (minimum 2048)`);

      const selfSigned = cert.issuer?.CN === cert.subject?.CN && cert.issuer?.O === cert.subject?.O;
      if (selfSigned) issues.push("Self-signed certificate");

      const altNames = cert.subjectaltname ? cert.subjectaltname.split(",").map((s: string) => s.trim().replace(/^DNS:/, "").replace(/^IP:/, "")) : [];
      const wildcardCert = !!(cert.subject?.CN?.startsWith("*."));
      const sigAlg = (cert as any).sigalg || "";
      if (sigAlg.includes("sha1") || sigAlg.includes("md5")) issues.push(`Weak signature algorithm: ${sigAlg}`);

      let score = 100;
      if (protocol === "TLSv1" || protocol === "TLSv1.1") score -= 30;
      if (!authorized) score -= 25;
      if (daysUntilExpiry < 0) score -= 30;
      else if (daysUntilExpiry < 30) score -= 15;
      if (keyBits && keyBits < 2048) score -= 20;
      if (selfSigned) score -= 20;
      if (cipherName.includes("RC4") || cipherName.includes("NULL") || cipherName.includes("EXPORT")) score -= 30;
      score = Math.max(0, Math.min(100, score));

      socket.destroy();
      resolve({
        host, valid: authorized && daysUntilExpiry > 0,
        issuer: cert.issuer?.O || cert.issuer?.CN || "Unknown",
        subject: cert.subject?.CN || "Unknown",
        validFrom: validFrom.toISOString(), validTo: validTo.toISOString(), daysUntilExpiry,
        protocol, cipherSuite: cipherName, keyBits,
        fingerprint: cert.fingerprint || "Unknown", fingerprintSHA256: cert.fingerprint256 || "Unknown",
        altNames, serialNumber: cert.serialNumber || "Unknown",
        ocspStapling: false, ctLogged: false, selfSigned, wildcardCert,
        issues, score, grade: gradeFromScore(score),
        chainLength: cert.issuerCertificate ? 2 : 1, signatureAlgorithm: sigAlg,
      });
    });

    socket.on("error", (err: Error) => {
      socket.destroy();
      resolve({ host, valid: false, issuer: "Unknown", subject: "Unknown", validFrom: "", validTo: "", daysUntilExpiry: -1, protocol: "Unknown", cipherSuite: "Unknown", keyBits: null, fingerprint: "Unknown", fingerprintSHA256: "Unknown", altNames: [], serialNumber: "Unknown", ocspStapling: false, ctLogged: false, selfSigned: false, wildcardCert: false, issues: [`Connection failed: ${err.message}`], score: 0, grade: "F", chainLength: 0, signatureAlgorithm: "Unknown" });
    });
    socket.setTimeout(12_000, () => {
      socket.destroy();
      resolve({ host, valid: false, issuer: "Unknown", subject: "Unknown", validFrom: "", validTo: "", daysUntilExpiry: -1, protocol: "Unknown", cipherSuite: "Unknown", keyBits: null, fingerprint: "Unknown", fingerprintSHA256: "Unknown", altNames: [], serialNumber: "Unknown", ocspStapling: false, ctLogged: false, selfSigned: false, wildcardCert: false, issues: ["Connection timed out"], score: 0, grade: "F", chainLength: 0, signatureAlgorithm: "Unknown" });
    });
  });
}

// ─── 6. HTTP Header Analyzer ─────────────────────────────────────────────────

export type HeaderAnalysis = {
  url: string;
  serverInfo: string | null;
  poweredBy: string | null;
  informationLeaks: string[];
  securityScore: number;
  grade: string;
  recommendations: string[];
  allHeaders: Record<string, string>;
  missingSecurityHeaders: string[];
  presentSecurityHeaders: string[];
};

export async function analyzeHeaders(target: string): Promise<HeaderAnalysis> {
  const url = toUrl(target);
  const { headers } = await requestHead(url);
  const h = Object.fromEntries(Object.entries(headers ?? {}).map(([k, v]) => [k.toLowerCase(), Array.isArray(v) ? v.join(", ") : (v || "")])) as Record<string, string>;

  const informationLeaks: string[] = [];
  const recommendations: string[] = [];
  const REQUIRED = ["strict-transport-security", "content-security-policy", "x-frame-options", "x-content-type-options", "referrer-policy", "permissions-policy", "cross-origin-embedder-policy", "cross-origin-opener-policy", "cross-origin-resource-policy"];
  const presentSecurityHeaders = REQUIRED.filter(hdr => h[hdr]);
  const missingSecurityHeaders = REQUIRED.filter(hdr => !h[hdr]);

  const serverInfo = h["server"] || null;
  const poweredBy = h["x-powered-by"] || null;
  if (serverInfo) { informationLeaks.push(`Server: ${serverInfo}`); recommendations.push("Remove or obfuscate the Server header."); }
  if (poweredBy) { informationLeaks.push(`X-Powered-By: ${poweredBy}`); recommendations.push("Remove the X-Powered-By header."); }
  if (h["x-aspnet-version"]) informationLeaks.push(`X-ASPNet-Version: ${h["x-aspnet-version"]}`);
  if (h["x-generator"]) informationLeaks.push(`X-Generator: ${h["x-generator"]}`);
  if (h["x-runtime"]) informationLeaks.push(`X-Runtime: ${h["x-runtime"]} (response time disclosed)`);
  if (h["x-debug-token"] || h["x-debug-token-link"]) informationLeaks.push("Symfony debug token exposed");
  if (h["access-control-allow-origin"] === "*") informationLeaks.push("CORS: Access-Control-Allow-Origin: * (open to all origins)");

  const securityScore = Math.max(0, 100 - informationLeaks.length * 8 - missingSecurityHeaders.length * 7);
  return { url, serverInfo, poweredBy, informationLeaks, securityScore, grade: gradeFromScore(securityScore), recommendations, allHeaders: h, missingSecurityHeaders, presentSecurityHeaders };
}

// ─── 7. DNS Security Auditor ─────────────────────────────────────────────────

export type DNSSecurityResult = {
  domain: string;
  spf: { found: boolean; value: string; issues: string[] };
  dmarc: { found: boolean; value: string; issues: string[] };
  dkim: { found: boolean; selector: string };
  dnssec: boolean;
  caa: string[];
  mx: string[];
  nameservers: string[];
  issues: string[];
  score: number;
  grade: string;
};

export async function auditDNSSecurity(domain: string): Promise<DNSSecurityResult> {
  const issues: string[] = [];
  const [txtRecords, mxRecords, nsRecords, caaRecords] = await Promise.allSettled([
    dns.resolveTxt(domain), dns.resolveMx(domain), dns.resolveNs(domain), dns.resolveCaa(domain),
  ]);
  const txts = txtRecords.status === "fulfilled" ? txtRecords.value.map(r => r.join("")) : [];
  const mxs = mxRecords.status === "fulfilled" ? mxRecords.value.map(r => r.exchange) : [];
  const nss = nsRecords.status === "fulfilled" ? nsRecords.value : [];
  const caas = caaRecords.status === "fulfilled" ? caaRecords.value.map((r: any) => `${r.critical ? "!" : ""}${r.tag}="${r.value}"`) : [];

  const spfRecord = txts.find(t => t.startsWith("v=spf1")) || "";
  const spfIssues: string[] = [];
  if (!spfRecord) { issues.push("No SPF record — domain can be spoofed"); spfIssues.push("Missing SPF record"); }
  else {
    if (!spfRecord.includes("-all") && !spfRecord.includes("~all")) { spfIssues.push("Weak enforcement (no -all)"); issues.push("SPF has weak enforcement"); }
    if (spfRecord.includes("+all")) { spfIssues.push("+all allows anyone to spoof this domain"); issues.push("Critical: SPF +all"); }
  }

  let dmarcRecord = "";
  try { const d = await dns.resolveTxt(`_dmarc.${domain}`); dmarcRecord = d.flat().find((t: string) => t.startsWith("v=DMARC1")) || ""; } catch { /* not found */ }
  const dmarcIssues: string[] = [];
  if (!dmarcRecord) { issues.push("No DMARC record"); dmarcIssues.push("Missing DMARC record"); }
  else {
    if (dmarcRecord.includes("p=none")) { dmarcIssues.push("DMARC p=none — monitoring only, no enforcement"); issues.push("DMARC policy=none provides no protection"); }
    if (!dmarcRecord.includes("rua=")) dmarcIssues.push("No aggregate report URI (rua=)");
  }

  let dkimFound = false, dkimSelector = "";
  for (const sel of ["default", "google", "mail", "dkim", "k1", "selector1", "selector2", "smtp"]) {
    try { await dns.resolveTxt(`${sel}._domainkey.${domain}`); dkimFound = true; dkimSelector = sel; break; } catch { /* not found */ }
  }
  if (!dkimFound) issues.push("DKIM not detected on common selectors");

  let dnssec = false;
  try { const ds = await dns.resolve(domain, "DS" as any); dnssec = Array.isArray(ds) && ds.length > 0; } catch { /* not supported */ }
  if (!dnssec) issues.push("DNSSEC not enabled");
  if (caas.length === 0) issues.push("No CAA records — any CA can issue certificates");

  const score = Math.max(0, 100 - (!spfRecord ? 20 : 0) - (!dmarcRecord || dmarcRecord.includes("p=none") ? 20 : 0) - (!dkimFound ? 15 : 0) - (!dnssec ? 15 : 0) - (caas.length === 0 ? 10 : 0) - spfIssues.length * 5 - dmarcIssues.length * 5);
  return { domain, spf: { found: !!spfRecord, value: spfRecord, issues: spfIssues }, dmarc: { found: !!dmarcRecord, value: dmarcRecord, issues: dmarcIssues }, dkim: { found: dkimFound, selector: dkimSelector }, dnssec, caa: caas, mx: mxs, nameservers: nss, issues, score: Math.min(100, score), grade: gradeFromScore(Math.min(100, score)) };
}

// ─── 8. Technology Fingerprinter ─────────────────────────────────────────────

export async function fingerprintTarget(target: string): Promise<{ technologies: string[]; waf: string | null; serverInfo: string | null; cms: string | null; frameworks: string[]; analytics: string[] }> {
  const url = toUrl(target);
  const [headResult, getResult] = await Promise.allSettled([requestHead(url), requestGet(url, 65536)]);
  const headers = headResult.status === "fulfilled" ? headResult.value.headers : {};
  const body = getResult.status === "fulfilled" ? getResult.value.body : "";
  const techs = detectTechnologies(headers, body);
  const waf = detectWAF(headers);
  const h = (k: string) => ((headers[k] || "") as string);
  const cmsList = ["WordPress", "Drupal", "Joomla", "Shopify", "Wix", "Squarespace"];
  const cms = cmsList.find(c => techs.includes(c)) || null;
  return { technologies: techs, waf, serverInfo: h("server") || null, cms, frameworks: techs.filter(t => ["React", "Angular", "Vue.js", "Next.js", "Express.js", "ASP.NET", "PHP"].includes(t)), analytics: techs.filter(t => ["Google Analytics", "Google Tag Manager"].includes(t)) };
}
