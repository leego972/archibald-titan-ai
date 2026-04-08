/**
 * CyberMCP Full Scan SSE Streaming
 * ─────────────────────────────────────────────────────────────────────────────
 * Provides real-time progress updates for the CyberMCP full security scan.
 * Each of the 5 checks emits a progress event as it completes, so the user
 * sees live feedback instead of waiting for the full scan to finish.
 *
 * Endpoint: GET /api/cybermcp-scan/stream?endpoint=<url>&method=<GET|POST>&authToken=<token>&paramName=<param>
 *
 * Events:
 *   start      — { totalChecks: 5 }
 *   progress   — { check: string, status: "running"|"done"|"error", result?: any, index: number }
 *   complete   — { scanResults, overallRisk, duration, scannedAt }
 *   error      — { message: string }
 */

import type { Express, Request, Response } from "express";
import { createContext } from "./_core/context";
import { createLogger } from "./_core/logger.js";
import { consumeCredits, checkCredits } from "./credit-service";

const log = createLogger("cybermcp-stream");

// ─── Re-use the same helpers from cybermcp-router ─────────────────────────────
// (copied inline to avoid circular imports)

const SQL_ERROR_PATTERNS = [
  /sql syntax/i, /mysql_fetch/i, /ORA-\d{5}/i, /pg_query/i,
  /sqlite3?\.OperationalError/i, /unclosed quotation mark/i,
  /syntax error.*near/i, /SQLSTATE/i,
];

const SENSITIVE_PATTERNS = [
  { name: "API Key", regex: /(?:api[_-]?key|apikey)\s*[:=]\s*["']?[A-Za-z0-9_-]{20,}/i, severity: "critical" as const },
  { name: "AWS Key", regex: /AKIA[0-9A-Z]{16}/i, severity: "critical" as const },
  { name: "Password in response", regex: /"password"\s*:\s*"[^"]{4,}"/i, severity: "critical" as const },
  { name: "Private Key", regex: /-----BEGIN (RSA |EC )?PRIVATE KEY-----/i, severity: "critical" as const },
  { name: "JWT Token", regex: /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/i, severity: "high" as const },
  { name: "Email Address", regex: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/i, severity: "medium" as const },
  { name: "Credit Card", regex: /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13})\b/, severity: "critical" as const },
];

async function httpRequest(url: string, method: string, headers: Record<string, string> = {}, body?: string, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const start = Date.now();
  try {
    const resp = await fetch(url, { method, headers, body, signal: controller.signal });
    const text = await resp.text();
    const respHeaders: Record<string, string> = {};
    resp.headers.forEach((v, k) => { respHeaders[k] = v; });
    return { status: resp.status, body: text, headers: respHeaders, duration: Date.now() - start };
  } finally {
    clearTimeout(timer);
  }
}

function analyseSecurityHeaders(headers: Record<string, string>) {
  const h = (name: string) => headers[name.toLowerCase()] || "";
  return [
    { name: "Strict-Transport-Security", present: !!h("strict-transport-security"), severity: "High" as const, recommendation: "Add HSTS header" },
    { name: "Content-Security-Policy", present: !!h("content-security-policy"), severity: "High" as const, recommendation: "Add CSP header" },
    { name: "X-Frame-Options", present: !!h("x-frame-options"), severity: "Medium" as const, recommendation: "Add X-Frame-Options: DENY" },
    { name: "X-Content-Type-Options", present: !!h("x-content-type-options"), severity: "Medium" as const, recommendation: "Add X-Content-Type-Options: nosniff" },
    { name: "Referrer-Policy", present: !!h("referrer-policy"), severity: "Low" as const, recommendation: "Add Referrer-Policy header" },
    { name: "Permissions-Policy", present: !!h("permissions-policy"), severity: "Low" as const, recommendation: "Add Permissions-Policy header" },
  ];
}

// ─── SSE helper ───────────────────────────────────────────────────────────────

function sseWrite(res: Response, event: string, data: unknown) {
  try {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    if (typeof (res as any).flush === "function") (res as any).flush();
  } catch { /* client disconnected */ }
}

// ─── Register SSE route ───────────────────────────────────────────────────────

export function registerCyberMcpStreamRoutes(app: Express): void {
  app.get("/api/cybermcp-scan/stream", async (req: Request, res: Response) => {
    // ── Auth ──
    let userId: number;
    try {
      const ctx = await createContext({ req, res, info: {} as any });
      if (!ctx.user) { res.status(401).json({ error: "Unauthorized" }); return; }
      userId = ctx.user.id;
    } catch { res.status(401).json({ error: "Unauthorized" }); return; }

    const endpoint = (req.query.endpoint as string | undefined) ?? "";
    const method = ((req.query.method as string | undefined) ?? "GET").toUpperCase();
    const authToken = (req.query.authToken as string | undefined) ?? "";
    const paramName = (req.query.paramName as string | undefined) ?? "id";

    if (!endpoint) { res.status(400).json({ error: "endpoint query parameter is required" }); return; }

    // ── Credit check ──
    try {
      const ok = await checkCredits(userId, "cybermcp_scan");
      if (!ok) { res.status(402).json({ error: "Insufficient credits" }); return; }
    } catch { res.status(500).json({ error: "Credit check failed" }); return; }

    // ── Set up SSE ──
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    const keepAlive = setInterval(() => {
      try { res.write(": ping\n\n"); } catch { clearInterval(keepAlive); }
    }, 20_000);

    const hdrs: Record<string, string> = {
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    };

    const scanResults: Record<string, any> = {};
    const startTime = Date.now();
    const CHECKS = ["securityHeaders", "authBypass", "sqlInjection", "xss", "sensitiveData"];

    sseWrite(res, "start", { totalChecks: CHECKS.length });

    let aborted = false;
    req.on("close", () => { aborted = true; clearInterval(keepAlive); });

    try {
      // ── 1. Security Headers ──
      if (!aborted) {
        sseWrite(res, "progress", { check: "securityHeaders", status: "running", index: 0 });
        try {
          const r = await httpRequest(endpoint, "GET", hdrs, undefined, 15000);
          const analysis = analyseSecurityHeaders(r.headers);
          const present = analysis.filter(h => h.present).length;
          const criticalMissing = analysis.filter(h => !h.present && h.severity === "High").length;
          scanResults.securityHeaders = {
            score: Math.round((present / analysis.length) * 100),
            criticalMissing,
            risk: criticalMissing >= 2 ? "high" : criticalMissing >= 1 ? "medium" : "pass",
            details: analysis,
          };
          sseWrite(res, "progress", { check: "securityHeaders", status: "done", result: scanResults.securityHeaders, index: 0 });
        } catch (e: any) {
          scanResults.securityHeaders = { error: e.message, risk: "info" };
          sseWrite(res, "progress", { check: "securityHeaders", status: "error", result: scanResults.securityHeaders, index: 0 });
        }
      }

      // ── 2. Auth Bypass ──
      if (!aborted) {
        sseWrite(res, "progress", { check: "authBypass", status: "running", index: 1 });
        try {
          const noAuth = await httpRequest(endpoint, method, {}, undefined, 10000);
          const invalidToken = await httpRequest(endpoint, method, { Authorization: "Bearer invalid_token_xyz_12345" }, undefined, 10000);
          const bypassed = noAuth.status < 400 || invalidToken.status < 400;
          scanResults.authBypass = { vulnerable: bypassed, noAuthStatus: noAuth.status, invalidTokenStatus: invalidToken.status, risk: bypassed ? "critical" : "pass" };
          sseWrite(res, "progress", { check: "authBypass", status: "done", result: scanResults.authBypass, index: 1 });
        } catch (e: any) {
          scanResults.authBypass = { error: e.message, risk: "info" };
          sseWrite(res, "progress", { check: "authBypass", status: "error", result: scanResults.authBypass, index: 1 });
        }
      }

      // ── 3. SQL Injection ──
      if (!aborted) {
        sseWrite(res, "progress", { check: "sqlInjection", status: "running", index: 2 });
        try {
          const payloads = ["' OR '1'='1", "'; DROP TABLE users; --", "1 UNION SELECT NULL--"];
          let vulnerable = false;
          for (const payload of payloads) {
            const sqlUrl = `${endpoint}?${paramName}=${encodeURIComponent(payload)}`;
            const sqlRes = await httpRequest(sqlUrl, "GET", hdrs, undefined, 8000);
            if (SQL_ERROR_PATTERNS.some(p => p.test(sqlRes.body))) { vulnerable = true; break; }
          }
          scanResults.sqlInjection = { vulnerable, payloadsTested: payloads.length, risk: vulnerable ? "critical" : "pass" };
          sseWrite(res, "progress", { check: "sqlInjection", status: "done", result: scanResults.sqlInjection, index: 2 });
        } catch (e: any) {
          scanResults.sqlInjection = { error: e.message, risk: "info" };
          sseWrite(res, "progress", { check: "sqlInjection", status: "error", result: scanResults.sqlInjection, index: 2 });
        }
      }

      // ── 4. XSS ──
      if (!aborted) {
        sseWrite(res, "progress", { check: "xss", status: "running", index: 3 });
        try {
          const xssPayloads = ['<script>alert(1)</script>', '"><img src=x onerror=alert(1)>', "javascript:alert(1)"];
          let reflected = false;
          for (const payload of xssPayloads) {
            const xssUrl = `${endpoint}?${paramName}=${encodeURIComponent(payload)}`;
            const xssRes = await httpRequest(xssUrl, "GET", hdrs, undefined, 8000);
            if (xssRes.body.includes(payload)) { reflected = true; break; }
          }
          scanResults.xss = { vulnerable: reflected, payloadsTested: xssPayloads.length, risk: reflected ? "high" : "pass" };
          sseWrite(res, "progress", { check: "xss", status: "done", result: scanResults.xss, index: 3 });
        } catch (e: any) {
          scanResults.xss = { error: e.message, risk: "info" };
          sseWrite(res, "progress", { check: "xss", status: "error", result: scanResults.xss, index: 3 });
        }
      }

      // ── 5. Sensitive Data ──
      if (!aborted) {
        sseWrite(res, "progress", { check: "sensitiveData", status: "running", index: 4 });
        try {
          const dataRes = await httpRequest(endpoint, method, hdrs, undefined, 10000);
          const findings = SENSITIVE_PATTERNS.filter(p => p.regex.test(dataRes.body));
          scanResults.sensitiveData = {
            findingCount: findings.length,
            types: findings.map(f => f.name),
            risk: findings.some(f => f.severity === "critical") ? "critical" : findings.length > 0 ? "high" : "pass",
          };
          sseWrite(res, "progress", { check: "sensitiveData", status: "done", result: scanResults.sensitiveData, index: 4 });
        } catch (e: any) {
          scanResults.sensitiveData = { error: e.message, risk: "info" };
          sseWrite(res, "progress", { check: "sensitiveData", status: "error", result: scanResults.sensitiveData, index: 4 });
        }
      }

      // ── Deduct credits ──
      try { await consumeCredits(userId, "cybermcp_scan"); } catch { /* non-fatal */ }

      const risks = Object.values(scanResults).map((r: any) => r.risk).filter(Boolean);
      const overallRisk = risks.includes("critical") ? "critical" : risks.includes("high") ? "high" : risks.includes("medium") ? "medium" : "pass";

      sseWrite(res, "complete", {
        scanResults,
        overallRisk,
        duration: Date.now() - startTime,
        scannedAt: new Date().toISOString(),
      });

      log.info("[CyberMcpStream] Full scan complete", { userId, endpoint, overallRisk });
    } catch (err: any) {
      sseWrite(res, "error", { message: err.message || "Scan failed" });
      log.error("[CyberMcpStream] Scan error", { userId, error: err.message });
    } finally {
      clearInterval(keepAlive);
      res.end();
    }
  });
}
