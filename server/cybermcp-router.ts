/**
 * CyberMCP Router — Backend tRPC endpoints for AI-powered API security testing.
 * Integrates the CyberMCP Model Context Protocol security toolkit.
 *
 * Provides 14 specialised security tools across 4 categories:
 *   - Authentication: JWT analysis, bypass detection, OAuth2, token auth
 *   - Injection: SQL injection, XSS vulnerability detection
 *   - Data Protection: Sensitive data exposure, path traversal
 *   - Infrastructure: Rate limiting, security headers (OWASP)
 *
 * Reference: https://github.com/ricauts/CyberMCP
 * Placed in the Security section — accessible to cyber, cyber_plus, and titan tiers.
 * All HTTP requests are proxied server-side to avoid CORS issues.
 */
import { z } from "zod";
import { router, adminProcedure } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { consumeCredits } from "./credit-service";
import { getUserPlan, enforceFeature, enforceAdminFeature } from "./subscription-gate";
import { logAdminAction } from "./admin-activity-log";

// ─── HTTP Helper ──────────────────────────────────────────────────
async function httpRequest(
  url: string,
  method: string,
  headers: Record<string, string> = {},
  body?: string,
  timeoutMs = 15000
): Promise<{ status: number; headers: Record<string, string>; body: string; responseTime: number }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const start = Date.now();
  try {
    const res = await fetch(url, {
      method,
      headers,
      body: body || undefined,
      signal: controller.signal,
      redirect: "follow",
    });
    clearTimeout(timer);
    const responseBody = await res.text();
    const responseHeaders: Record<string, string> = {};
    res.headers.forEach((v, k) => { responseHeaders[k] = v; });
    return {
      status: res.status,
      headers: responseHeaders,
      body: responseBody,
      responseTime: Date.now() - start,
    };
  } catch (err: any) {
    clearTimeout(timer);
    if (err.name === "AbortError") throw new TRPCError({ code: "TIMEOUT", message: `Request to ${url} timed out after ${timeoutMs}ms` });
    throw new TRPCError({ code: "BAD_REQUEST", message: `Request failed: ${err.message}` });
  }
}

// ─── JWT Analysis Helper ──────────────────────────────────────────
function analyseJwt(token: string): {
  header: any; payload: any; issues: string[]; risk: "critical" | "high" | "medium" | "low" | "info";
} {
  const issues: string[] = [];
  try {
    const parts = token.replace(/^Bearer\s+/i, "").split(".");
    if (parts.length !== 3) { return { header: null, payload: null, issues: ["Invalid JWT format — expected 3 parts"], risk: "high" }; }
    const header = JSON.parse(Buffer.from(parts[0], "base64url").toString());
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString());

    if (header.alg === "none" || header.alg === "None") issues.push("CRITICAL: Algorithm 'none' — token signature is not verified");
    if (header.alg?.startsWith("HS") && !header.alg?.startsWith("HS256") && !header.alg?.startsWith("HS384") && !header.alg?.startsWith("HS512")) issues.push("Weak or non-standard HMAC algorithm detected");
    if (!payload.exp) issues.push("No expiration (exp) claim — token never expires");
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) issues.push("Token is EXPIRED");
    if (!payload.iat) issues.push("No issued-at (iat) claim");
    if (!payload.iss) issues.push("No issuer (iss) claim — cannot verify token origin");
    if (!payload.sub && !payload.userId && !payload.user_id) issues.push("No subject (sub) claim — identity unclear");
    if (payload.role === "admin" || payload.isAdmin === true) issues.push("HIGH: Elevated privilege claim in payload — verify server-side enforcement");
    if (payload.password || payload.secret || payload.key) issues.push("CRITICAL: Sensitive data embedded in JWT payload");

    const risk = issues.some(i => i.startsWith("CRITICAL")) ? "critical"
      : issues.some(i => i.startsWith("HIGH") || i.includes("EXPIRED")) ? "high"
      : issues.length > 2 ? "medium"
      : issues.length > 0 ? "low" : "info";

    return { header, payload, issues, risk };
  } catch {
    return { header: null, payload: null, issues: ["Failed to decode JWT — malformed token"], risk: "high" };
  }
}

// ─── Security Headers Analyser ────────────────────────────────────
function analyseSecurityHeaders(headers: Record<string, string>): Array<{
  name: string; present: boolean; value: string; severity: "High" | "Medium" | "Low"; recommendation: string;
}> {
  const h = (name: string) => headers[name.toLowerCase()] || "";
  return [
    { name: "Strict-Transport-Security", present: !!h("strict-transport-security"), value: h("strict-transport-security"), severity: "High", recommendation: h("strict-transport-security") ? "Verify max-age ≥ 31536000 and includeSubDomains" : "Add: Strict-Transport-Security: max-age=31536000; includeSubDomains; preload" },
    { name: "Content-Security-Policy", present: !!h("content-security-policy"), value: h("content-security-policy"), severity: "High", recommendation: h("content-security-policy") ? "Review CSP directives for unsafe-inline/unsafe-eval" : "Add a Content-Security-Policy to prevent XSS attacks" },
    { name: "X-Frame-Options", present: !!h("x-frame-options"), value: h("x-frame-options"), severity: "High", recommendation: h("x-frame-options") ? "Ensure value is DENY or SAMEORIGIN" : "Add: X-Frame-Options: DENY" },
    { name: "X-Content-Type-Options", present: !!h("x-content-type-options"), value: h("x-content-type-options"), severity: "Medium", recommendation: h("x-content-type-options") ? "Value should be nosniff" : "Add: X-Content-Type-Options: nosniff" },
    { name: "Referrer-Policy", present: !!h("referrer-policy"), value: h("referrer-policy"), severity: "Medium", recommendation: h("referrer-policy") ? "Verify policy is strict-origin or no-referrer" : "Add: Referrer-Policy: strict-origin-when-cross-origin" },
    { name: "Permissions-Policy", present: !!h("permissions-policy"), value: h("permissions-policy"), severity: "Low", recommendation: h("permissions-policy") ? "Review feature policies" : "Consider adding Permissions-Policy to restrict browser features" },
    { name: "Access-Control-Allow-Origin", present: !!h("access-control-allow-origin"), value: h("access-control-allow-origin"), severity: "High", recommendation: h("access-control-allow-origin") === "*" ? "WARNING: Wildcard CORS — restrict to specific origins" : h("access-control-allow-origin") ? "Verify CORS origin is intentional" : "CORS not set — appropriate if not a public API" },
    { name: "X-XSS-Protection", present: !!h("x-xss-protection"), value: h("x-xss-protection"), severity: "Low", recommendation: h("x-xss-protection") ? "Legacy header — CSP is preferred" : "Consider CSP instead of X-XSS-Protection" },
  ];
}

// ─── SQL Injection Payloads (OWASP + time-based + union + error-based + NoSQL) ────
const SQL_PAYLOADS = [
  // Classic boolean-based
  "' OR '1'='1", "' OR 1=1--", "' OR 'x'='x", "\" OR \"1\"=\"1",
  "' OR 1=1#", "' OR 1=1/*", "admin'--", "admin'#",
  // UNION-based
  "' UNION SELECT null--", "' UNION SELECT null,null--", "' UNION SELECT null,null,null--",
  "' UNION SELECT 1,2,3--", "' UNION ALL SELECT null,null--",
  // Error-based
  "'", "''", "\"'", "';", "'; --", "1; DROP TABLE users--",
  "1' AND EXTRACTVALUE(1,CONCAT(0x7e,VERSION()))--",
  "1 AND 1=CONVERT(int,@@version)--",
  // Time-based blind
  "'; WAITFOR DELAY '0:0:5'--", "' AND SLEEP(5)--",
  "1; SELECT SLEEP(5)--", "' OR SLEEP(5)--",
  // Stacked queries
  "'; INSERT INTO users VALUES('hacked','hacked')--",
  // Second-order
  "' OR 1=1 LIMIT 1--", "' OR '1'='1' /*",
  // NoSQL injection
  "{ $gt: '' }", "{ $ne: null }", "{ $where: 'sleep(5000)' }",
];
const SQL_ERROR_PATTERNS = [
  /sql syntax/i, /mysql_fetch/i, /ORA-\d{5}/i, /SQLite.*error/i,
  /pg_query/i, /syntax error.*SQL/i, /unclosed quotation/i, /ODBC.*error/i,
  /Microsoft.*ODBC.*SQL/i, /Incorrect syntax near/i, /Unexpected end of SQL/i,
  /quoted string not properly terminated/i, /SQLSTATE/i, /mysql_num_rows/i,
  /supplied argument is not a valid MySQL/i, /Column count doesn't match/i,
  /Warning.*mysql_/i, /valid MySQL result/i, /MySqlException/i,
  /com\.mysql\.jdbc\.exceptions/i, /org\.postgresql\.util\.PSQLException/i,
];

// ─── XSS Payloads (reflected + DOM + stored + filter bypass + template injection) ───
const XSS_PAYLOADS = [
  // Basic
  "<script>alert(1)</script>", "<img src=x onerror=alert(1)>",
  "javascript:alert(1)", "<svg onload=alert(1)>",
  "'\"><script>alert(1)</script>", "<body onload=alert(1)>",
  // Template injection
  "{{7*7}}", "${7*7}", "#{7*7}", "<%= 7*7 %>",
  // Filter bypass
  "<ScRiPt>alert(1)</ScRiPt>", "<SCRIPT>alert(1)</SCRIPT>",
  "<img src=1 onerror=alert(1)>", "<iframe src=javascript:alert(1)>",
  "<details open ontoggle=alert(1)>", "<video src=1 onerror=alert(1)>",
  "<input autofocus onfocus=alert(1)>", "<select autofocus onfocus=alert(1)>",
  // Encoded
  "&lt;script&gt;alert(1)&lt;/script&gt;",
  "%3Cscript%3Ealert(1)%3C/script%3E",
];

// ─── Sensitive Data Patterns (OWASP + cloud secrets + crypto keys + modern tokens) ───
const SENSITIVE_PATTERNS: Array<{ name: string; regex: RegExp; severity: "critical" | "high" | "medium" }> = [
  { name: "Credit Card Number", regex: /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|6(?:011|5[0-9]{2})[0-9]{12})\b/, severity: "critical" },
  { name: "Social Security Number", regex: /\b\d{3}-\d{2}-\d{4}\b/, severity: "critical" },
  { name: "AWS Access Key", regex: /AKIA[0-9A-Z]{16}/, severity: "critical" },
  { name: "AWS Secret Key", regex: /(?:aws_secret|AWS_SECRET)[\s=:]+[A-Za-z0-9/+=]{40}/, severity: "critical" },
  { name: "Google API Key", regex: /AIza[0-9A-Za-z-_]{35}/, severity: "critical" },
  { name: "GitHub Token", regex: /ghp_[0-9a-zA-Z]{36}|github_pat_[0-9a-zA-Z_]{82}/, severity: "critical" },
  { name: "Stripe Secret Key", regex: /sk_live_[0-9a-zA-Z]{24,}/, severity: "critical" },
  { name: "Private Key (RSA/EC/PEM)", regex: /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/, severity: "critical" },
  { name: "JWT Token", regex: /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/, severity: "high" },
  { name: "Password in Response", regex: /"password"\s*:\s*"[^"]{3,}"/, severity: "high" },
  { name: "API Key / Token", regex: /"(api_key|apikey|access_token|secret_key|auth_token)"\s*:\s*"[^"]{8,}"/, severity: "high" },
  { name: "Bearer Token", regex: /Bearer\s+[A-Za-z0-9-._~+/]+=*/, severity: "high" },
  { name: "Database Connection String", regex: /(mysql|postgres|mongodb|redis):(\/\/)[^\s"']+/, severity: "high" },
  { name: "Email Address", regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/, severity: "medium" },
  { name: "Internal IP Address", regex: /\b(10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)\b/, severity: "medium" },
  { name: "Stack Trace / Debug Info", regex: /at\s+\w+\s*\(.*:\d+:\d+\)|Traceback \(most recent call last\)/, severity: "medium" },
  { name: "Server Version Disclosure", regex: /Apache\/[\d.]+|nginx\/[\d.]+|PHP\/[\d.]+|ASP\.NET [\d.]+/, severity: "medium" },
  { name: "Directory Listing", regex: /Index of \//i, severity: "medium" },
];

// ─── Path Traversal Payloads (LFI + RFI + null byte + double encoding) ──────────
const PATH_TRAVERSAL_PAYLOADS = [
  // Unix
  "../../../etc/passwd", "../../../../etc/passwd", "../../../../../etc/shadow",
  "../etc/passwd", "../../etc/passwd",
  // Windows
  "..\\..\\..\\windows\\win.ini", "..\\..\\..\\windows\\system32\\drivers\\etc\\hosts",
  // URL encoded
  "%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd",
  "%252e%252e%252fetc%252fpasswd",
  // Double encoded
  "....//....//....//etc/passwd",
  // Null byte
  "../../../etc/passwd%00",
  // Absolute paths
  "/etc/passwd", "/etc/shadow", "/proc/self/environ",
];

// ─── Router ───────────────────────────────────────────────────────
export const cybermcpRouter = router({

  // ── Authentication: Set & test basic auth ──────────────────────
  testBasicAuth: adminProcedure
    .input(z.object({
      endpoint: z.string().url(),
      username: z.string(),
      password: z.string(),
      method: z.enum(["GET", "POST", "PUT", "DELETE", "PATCH"]).default("GET"),
    }))
    .mutation(async ({ ctx, input }) => {
    enforceAdminFeature(ctx.user.role, "CyberMCP");
      const plan = await getUserPlan(ctx.user.id);
      enforceFeature(plan.planId, "security_tools", "CyberMCP");
      const credentials = Buffer.from(`${input.username}:${input.password}`).toString("base64");
      const result = await httpRequest(input.endpoint, input.method, { Authorization: `Basic ${credentials}` });
      await logAdminAction({ adminId: ctx.user.id, adminEmail: ctx.user.email || undefined, adminRole: ctx.user.role || "user", action: "security.cybermcp_basic_auth", category: "security", details: { endpoint: input.endpoint }, ipAddress: ctx.req?.ip || "unknown" });
      return {
        status: result.status,
        responseTime: result.responseTime,
        authenticated: result.status < 400,
        authHeader: `Basic ${credentials.substring(0, 8)}...`,
        message: result.status < 400 ? "Basic authentication successful" : `Authentication failed with status ${result.status}`,
      };
    }),

  // ── Authentication: Token / Bearer auth ───────────────────────
  testTokenAuth: adminProcedure
    .input(z.object({
      endpoint: z.string().url(),
      token: z.string(),
      tokenType: z.string().default("Bearer"),
      method: z.enum(["GET", "POST", "PUT", "DELETE", "PATCH"]).default("GET"),
      customHeader: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
    enforceAdminFeature(ctx.user.role, "CyberMCP");
      const plan = await getUserPlan(ctx.user.id);
      enforceFeature(plan.planId, "security_tools", "CyberMCP");
      const headerName = input.customHeader || "Authorization";
      const result = await httpRequest(input.endpoint, input.method, { [headerName]: `${input.tokenType} ${input.token}` });
      return {
        status: result.status,
        responseTime: result.responseTime,
        authenticated: result.status < 400,
        tokenType: input.tokenType,
        message: result.status < 400 ? "Token authentication successful" : `Token auth failed — status ${result.status}`,
      };
    }),

  // ── Authentication: JWT vulnerability check ───────────────────
  checkJwtVulnerability: adminProcedure
    .input(z.object({ token: z.string().min(10) }))
    .mutation(async ({ ctx, input }) => {
    enforceAdminFeature(ctx.user.role, "CyberMCP");
      const plan = await getUserPlan(ctx.user.id);
      enforceFeature(plan.planId, "security_tools", "CyberMCP");
      const analysis = analyseJwt(input.token);
      const _cr1 = await consumeCredits(ctx.user.id, "security_scan", "CyberMCP JWT check");
      if (!_cr1.success) throw new TRPCError({ code: "FORBIDDEN", message: "Insufficient credits. Purchase more credits or upgrade your plan." });
      await logAdminAction({ adminId: ctx.user.id, adminEmail: ctx.user.email || undefined, adminRole: ctx.user.role || "user", action: "security.cybermcp_jwt_check", category: "security", details: { risk: analysis.risk }, ipAddress: ctx.req?.ip || "unknown" });
      return {
        header: analysis.header,
        payload: analysis.payload ? { ...analysis.payload, sub: analysis.payload.sub ? "[REDACTED]" : undefined } : null,
        issues: analysis.issues,
        risk: analysis.risk,
        issueCount: analysis.issues.length,
        summary: analysis.issues.length === 0 ? "No JWT vulnerabilities detected" : `${analysis.issues.length} issue(s) found — risk level: ${analysis.risk.toUpperCase()}`,
      };
    }),

  // ── Authentication: Auth bypass check ─────────────────────────
  checkAuthBypass: adminProcedure
    .input(z.object({
      endpoint: z.string().url(),
      method: z.enum(["GET", "POST", "PUT", "DELETE", "PATCH"]).default("GET"),
      validToken: z.string().optional(),
      authHeaderName: z.string().default("Authorization"),
    }))
    .mutation(async ({ ctx, input }) => {
    enforceAdminFeature(ctx.user.role, "CyberMCP");
      const plan = await getUserPlan(ctx.user.id);
      enforceFeature(plan.planId, "security_tools", "CyberMCP");

      const tests: Array<{ test: string; status: number; vulnerable: boolean; details: string }> = [];

      // Test 1: No auth
      const noAuth = await httpRequest(input.endpoint, input.method, {});
      tests.push({ test: "No Authentication", status: noAuth.status, vulnerable: noAuth.status < 400, details: `Unauthenticated request returned ${noAuth.status}` });

      // Test 2: Invalid token
      const invalidToken = await httpRequest(input.endpoint, input.method, { [input.authHeaderName]: "Bearer invalid_token_xyz_123" });
      tests.push({ test: "Invalid Token", status: invalidToken.status, vulnerable: invalidToken.status < 400, details: `Invalid token returned ${invalidToken.status}` });

      // Test 3: Empty auth header
      const emptyAuth = await httpRequest(input.endpoint, input.method, { [input.authHeaderName]: "" });
      tests.push({ test: "Empty Auth Header", status: emptyAuth.status, vulnerable: emptyAuth.status < 400, details: `Empty auth header returned ${emptyAuth.status}` });

      // Test 4: Null byte injection
      const nullByte = await httpRequest(input.endpoint, input.method, { [input.authHeaderName]: "Bearer \x00" });
      tests.push({ test: "Null Byte Injection", status: nullByte.status, vulnerable: nullByte.status < 400, details: `Null byte in token returned ${nullByte.status}` });

      // Test 5: Valid token if provided
      if (input.validToken) {
        const validAuth = await httpRequest(input.endpoint, input.method, { [input.authHeaderName]: `Bearer ${input.validToken}` });
        tests.push({ test: "Valid Token (baseline)", status: validAuth.status, vulnerable: false, details: `Valid token returned ${validAuth.status}` });
        const bypassRisk = noAuth.status === validAuth.status && noAuth.status < 400;
        if (bypassRisk) tests.push({ test: "Auth Effectiveness", status: noAuth.status, vulnerable: true, details: "CRITICAL: Same response with and without auth — authentication may be bypassed" });
      }

      const vulnerableCount = tests.filter(t => t.vulnerable).length;
      const _cr2 = await consumeCredits(ctx.user.id, "security_scan", "CyberMCP auth bypass check");
      if (!_cr2.success) throw new TRPCError({ code: "FORBIDDEN", message: "Insufficient credits. Purchase more credits or upgrade your plan." });
      await logAdminAction({ adminId: ctx.user.id, adminEmail: ctx.user.email || undefined, adminRole: ctx.user.role || "user", action: "security.cybermcp_auth_bypass", category: "security", details: { endpoint: input.endpoint }, ipAddress: ctx.req?.ip || "unknown" });
      return { tests, vulnerableCount, endpoint: input.endpoint, overallRisk: vulnerableCount >= 2 ? "critical" : vulnerableCount === 1 ? "high" : "pass" };
    }),

  // ── Injection: SQL injection check ────────────────────────────
  checkSqlInjection: adminProcedure
    .input(z.object({
      endpoint: z.string().url(),
      method: z.enum(["GET", "POST"]).default("GET"),
      paramName: z.string().default("id"),
      headers: z.record(z.string(), z.string()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
    enforceAdminFeature(ctx.user.role, "CyberMCP");
      const plan = await getUserPlan(ctx.user.id);
      enforceFeature(plan.planId, "security_tools", "CyberMCP");

      const results: Array<{ payload: string; status: number; vulnerable: boolean; evidence: string }> = [];
      const hdrs = { "Content-Type": "application/json", ...(input.headers || {}) };

      for (const payload of SQL_PAYLOADS.slice(0, 6)) {
        try {
          const url = input.method === "GET" ? `${input.endpoint}?${input.paramName}=${encodeURIComponent(payload)}` : input.endpoint;
          const body = input.method === "POST" ? JSON.stringify({ [input.paramName]: payload }) : undefined;
          const res = await httpRequest(url, input.method, hdrs, body, 10000);
          const hasError = SQL_ERROR_PATTERNS.some(p => p.test(res.body));
          const isVulnerable = hasError || (res.status === 500 && res.body.length > 100);
          results.push({ payload, status: res.status, vulnerable: isVulnerable, evidence: hasError ? "SQL error pattern detected in response" : res.status === 500 ? "Internal server error triggered" : "No SQL error detected" });
        } catch {
          results.push({ payload, status: 0, vulnerable: false, evidence: "Request failed or timed out" });
        }
      }

      const vulnerableCount = results.filter(r => r.vulnerable).length;
      const _cr3 = await consumeCredits(ctx.user.id, "security_scan", "CyberMCP SQL injection check");
      if (!_cr3.success) throw new TRPCError({ code: "FORBIDDEN", message: "Insufficient credits. Purchase more credits or upgrade your plan." });
      await logAdminAction({ adminId: ctx.user.id, adminEmail: ctx.user.email || undefined, adminRole: ctx.user.role || "user", action: "security.cybermcp_sql_injection", category: "security", details: { endpoint: input.endpoint }, ipAddress: ctx.req?.ip || "unknown" });
      return { results, vulnerableCount, endpoint: input.endpoint, risk: vulnerableCount > 0 ? "critical" : "pass", summary: vulnerableCount > 0 ? `SQL injection vulnerability detected — ${vulnerableCount} payloads triggered errors` : "No SQL injection vulnerabilities detected" };
    }),

  // ── Injection: XSS check ──────────────────────────────────────
  checkXss: adminProcedure
    .input(z.object({
      endpoint: z.string().url(),
      method: z.enum(["GET", "POST"]).default("GET",),
      paramName: z.string().default("q"),
      headers: z.record(z.string(), z.string()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
    enforceAdminFeature(ctx.user.role, "CyberMCP");
      const plan = await getUserPlan(ctx.user.id);
      enforceFeature(plan.planId, "security_tools", "CyberMCP");

      const results: Array<{ payload: string; status: number; reflected: boolean; evidence: string }> = [];
      const hdrs = { "Content-Type": "application/json", ...(input.headers || {}) };

      for (const payload of XSS_PAYLOADS.slice(0, 6)) {
        try {
          const url = input.method === "GET" ? `${input.endpoint}?${input.paramName}=${encodeURIComponent(payload)}` : input.endpoint;
          const body = input.method === "POST" ? JSON.stringify({ [input.paramName]: payload }) : undefined;
          const res = await httpRequest(url, input.method, hdrs, body, 10000);
          const reflected = res.body.includes(payload) || res.body.includes(payload.replace(/</g, "&lt;").replace(/>/g, "&gt;"));
          const csp = res.headers["content-security-policy"];
          results.push({ payload, status: res.status, reflected, evidence: reflected ? `Payload reflected in response${csp ? " (CSP present — may mitigate)" : " — NO CSP protection"}` : "Payload not reflected" });
        } catch {
          results.push({ payload, status: 0, reflected: false, evidence: "Request failed or timed out" });
        }
      }

      const reflectedCount = results.filter(r => r.reflected).length;
      await logAdminAction({ adminId: ctx.user.id, adminEmail: ctx.user.email || undefined, adminRole: ctx.user.role || "user", action: "security.cybermcp_xss_check", category: "security", details: { endpoint: input.endpoint }, ipAddress: ctx.req?.ip || "unknown" });
      return { results, reflectedCount, endpoint: input.endpoint, risk: reflectedCount > 0 ? "high" : "pass", summary: reflectedCount > 0 ? `XSS: ${reflectedCount} payload(s) reflected — review CSP headers` : "No XSS reflection detected" };
    }),

  // ── Data Protection: Sensitive data exposure ──────────────────
  checkSensitiveData: adminProcedure
    .input(z.object({
      endpoint: z.string().url(),
      method: z.enum(["GET", "POST"]).default("GET"),
      headers: z.record(z.string(), z.string()).optional(),
      body: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
    enforceAdminFeature(ctx.user.role, "CyberMCP");
      const plan = await getUserPlan(ctx.user.id);
      enforceFeature(plan.planId, "security_tools", "CyberMCP");

      const res = await httpRequest(input.endpoint, input.method, input.headers || {}, input.body, 15000);
      const findings: Array<{ type: string; severity: string; evidence: string }> = [];

      for (const pattern of SENSITIVE_PATTERNS) {
        const match = res.body.match(pattern.regex);
        if (match) {
          findings.push({ type: pattern.name, severity: pattern.severity, evidence: `Pattern matched: "${match[0].substring(0, 40)}..."` });
        }
      }

      // Check for verbose error messages
      if (res.status >= 500 && res.body.length > 200) {
        findings.push({ type: "Verbose Server Error", severity: "medium", evidence: `HTTP ${res.status} with ${res.body.length} byte response body` });
      }

      await logAdminAction({ adminId: ctx.user.id, adminEmail: ctx.user.email || undefined, adminRole: ctx.user.role || "user", action: "security.cybermcp_sensitive_data", category: "security", details: { endpoint: input.endpoint }, ipAddress: ctx.req?.ip || "unknown" });
      return { findings, findingCount: findings.length, status: res.status, endpoint: input.endpoint, risk: findings.some(f => f.severity === "critical") ? "critical" : findings.some(f => f.severity === "high") ? "high" : findings.length > 0 ? "medium" : "pass" };
    }),

  // ── Data Protection: Path traversal check ─────────────────────
  checkPathTraversal: adminProcedure
    .input(z.object({
      endpoint: z.string().url(),
      paramName: z.string().default("file"),
      headers: z.record(z.string(), z.string()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
    enforceAdminFeature(ctx.user.role, "CyberMCP");
      const plan = await getUserPlan(ctx.user.id);
      enforceFeature(plan.planId, "security_tools", "CyberMCP");

      const results: Array<{ payload: string; status: number; vulnerable: boolean; evidence: string }> = [];

      for (const payload of PATH_TRAVERSAL_PAYLOADS) {
        try {
          const url = `${input.endpoint}?${input.paramName}=${encodeURIComponent(payload)}`;
          const res = await httpRequest(url, "GET", input.headers || {}, undefined, 10000);
          const isVulnerable = res.body.includes("root:") || res.body.includes("[boot loader]") || res.body.includes("[extensions]");
          results.push({ payload, status: res.status, vulnerable: isVulnerable, evidence: isVulnerable ? "File system content detected in response" : `Status ${res.status} — no traversal evidence` });
        } catch {
          results.push({ payload, status: 0, vulnerable: false, evidence: "Request failed" });
        }
      }

      const vulnerableCount = results.filter(r => r.vulnerable).length;
      await logAdminAction({ adminId: ctx.user.id, adminEmail: ctx.user.email || undefined, adminRole: ctx.user.role || "user", action: "security.cybermcp_path_traversal", category: "security", details: { endpoint: input.endpoint }, ipAddress: ctx.req?.ip || "unknown" });
      return { results, vulnerableCount, endpoint: input.endpoint, risk: vulnerableCount > 0 ? "critical" : "pass" };
    }),

  // ── Infrastructure: Rate limit check ──────────────────────────
  checkRateLimit: adminProcedure
    .input(z.object({
      endpoint: z.string().url(),
      method: z.enum(["GET", "POST"]).default("GET"),
      requestCount: z.number().min(5).max(50).default(20),
      headers: z.record(z.string(), z.string()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
    enforceAdminFeature(ctx.user.role, "CyberMCP");
      const plan = await getUserPlan(ctx.user.id);
      enforceFeature(plan.planId, "security_tools", "CyberMCP");

      const responses: Array<{ attempt: number; status: number; rateLimited: boolean; retryAfter?: string }> = [];
      let rateLimitDetected = false;

      for (let i = 1; i <= Math.min(input.requestCount, 20); i++) {
        try {
          const res = await httpRequest(input.endpoint, input.method, input.headers || {}, undefined, 8000);
          const isRateLimited = res.status === 429 || res.status === 503;
          const retryAfter = res.headers["retry-after"] || res.headers["x-ratelimit-reset"];
          if (isRateLimited) rateLimitDetected = true;
          responses.push({ attempt: i, status: res.status, rateLimited: isRateLimited, retryAfter });
          if (isRateLimited) break;
        } catch {
          responses.push({ attempt: i, status: 0, rateLimited: false });
        }
      }

      const rateLimitHeaders = ["x-ratelimit-limit", "x-ratelimit-remaining", "x-ratelimit-reset", "ratelimit-limit", "ratelimit-remaining"];
      const firstResponse = responses[0];
      await logAdminAction({ adminId: ctx.user.id, adminEmail: ctx.user.email || undefined, adminRole: ctx.user.role || "user", action: "security.cybermcp_rate_limit", category: "security", details: { endpoint: input.endpoint }, ipAddress: ctx.req?.ip || "unknown" });
      return {
        responses,
        rateLimitDetected,
        totalRequests: responses.length,
        endpoint: input.endpoint,
        risk: rateLimitDetected ? "pass" : "high",
        summary: rateLimitDetected
          ? `Rate limiting active — triggered after ${responses.findIndex(r => r.rateLimited) + 1} requests`
          : `No rate limiting detected after ${responses.length} requests — DoS risk`,
      };
    }),

  // ── Infrastructure: Security headers check ────────────────────
  checkSecurityHeaders: adminProcedure
    .input(z.object({
      endpoint: z.string().url(),
      includeAuth: z.boolean().default(false),
      authToken: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
    enforceAdminFeature(ctx.user.role, "CyberMCP");
      const plan = await getUserPlan(ctx.user.id);
      enforceFeature(plan.planId, "security_tools", "CyberMCP");

      const hdrs: Record<string, string> = {};
      if (input.includeAuth && input.authToken) hdrs["Authorization"] = `Bearer ${input.authToken}`;
      const res = await httpRequest(input.endpoint, "GET", hdrs, undefined, 15000);
      const analysis = analyseSecurityHeaders(res.headers);

      const present = analysis.filter(h => h.present).length;
      const missing = analysis.filter(h => !h.present);
      const score = Math.round((present / analysis.length) * 100);
      const criticalMissing = missing.filter(h => h.severity === "High").length;

      await logAdminAction({ adminId: ctx.user.id, adminEmail: ctx.user.email || undefined, adminRole: ctx.user.role || "user", action: "security.cybermcp_security_headers", category: "security", details: { endpoint: input.endpoint }, ipAddress: ctx.req?.ip || "unknown" });
      return {
        headers: analysis,
        score,
        present,
        total: analysis.length,
        criticalMissing,
        status: res.status,
        endpoint: input.endpoint,
        risk: criticalMissing >= 3 ? "critical" : criticalMissing >= 1 ? "high" : score < 60 ? "medium" : "pass",
        summary: `Security score: ${score}% — ${present}/${analysis.length} headers present, ${criticalMissing} critical missing`,
      };
    }),

  // ── Full Scan: Run all checks against a target ─────────────────
  runFullScan: adminProcedure
    .input(z.object({
      endpoint: z.string().url(),
      method: z.enum(["GET", "POST"]).default("GET"),
      authToken: z.string().optional(),
      paramName: z.string().default("id"),
      headers: z.record(z.string(), z.string()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
    enforceAdminFeature(ctx.user.role, "CyberMCP");
      const plan = await getUserPlan(ctx.user.id);
      enforceFeature(plan.planId, "security_tools", "CyberMCP");

      const hdrs = { ...(input.headers || {}), ...(input.authToken ? { Authorization: `Bearer ${input.authToken}` } : {}) };
      const scanResults: Record<string, any> = {};
      const startTime = Date.now();

      // Security headers
      try {
        const res = await httpRequest(input.endpoint, "GET", hdrs, undefined, 15000);
        const analysis = analyseSecurityHeaders(res.headers);
        const present = analysis.filter(h => h.present).length;
        scanResults.securityHeaders = { score: Math.round((present / analysis.length) * 100), criticalMissing: analysis.filter(h => !h.present && h.severity === "High").length, risk: analysis.filter(h => !h.present && h.severity === "High").length >= 2 ? "high" : "medium" };
      } catch { scanResults.securityHeaders = { error: "Scan failed" }; }

      // Auth bypass
      try {
        const noAuth = await httpRequest(input.endpoint, input.method, {});
        const invalidToken = await httpRequest(input.endpoint, input.method, { Authorization: "Bearer invalid_token_xyz" });
        const bypassed = noAuth.status < 400 || invalidToken.status < 400;
        scanResults.authBypass = { vulnerable: bypassed, risk: bypassed ? "critical" : "pass" };
      } catch { scanResults.authBypass = { error: "Scan failed" }; }

      // SQL injection (quick)
      try {
        const sqlUrl = `${input.endpoint}?${input.paramName}=${encodeURIComponent("' OR '1'='1")}`;
        const sqlRes = await httpRequest(sqlUrl, "GET", hdrs, undefined, 8000);
        const hasError = SQL_ERROR_PATTERNS.some(p => p.test(sqlRes.body));
        scanResults.sqlInjection = { vulnerable: hasError, risk: hasError ? "critical" : "pass" };
      } catch { scanResults.sqlInjection = { error: "Scan failed" }; }

      // XSS (quick)
      try {
        const xssUrl = `${input.endpoint}?${input.paramName}=${encodeURIComponent("<script>alert(1)</script>")}`;
        const xssRes = await httpRequest(xssUrl, "GET", hdrs, undefined, 8000);
        const reflected = xssRes.body.includes("<script>alert(1)</script>");
        scanResults.xss = { vulnerable: reflected, risk: reflected ? "high" : "pass" };
      } catch { scanResults.xss = { error: "Scan failed" }; }

      // Sensitive data
      try {
        const dataRes = await httpRequest(input.endpoint, input.method, hdrs, undefined, 10000);
        const findings = SENSITIVE_PATTERNS.filter(p => p.regex.test(dataRes.body));
        scanResults.sensitiveData = { findingCount: findings.length, types: findings.map(f => f.name), risk: findings.some(f => f.severity === "critical") ? "critical" : findings.length > 0 ? "high" : "pass" };
      } catch { scanResults.sensitiveData = { error: "Scan failed" }; }

      const risks = Object.values(scanResults).map((r: any) => r.risk).filter(Boolean);
      const overallRisk = risks.includes("critical") ? "critical" : risks.includes("high") ? "high" : risks.includes("medium") ? "medium" : "pass";

      await logAdminAction({ adminId: ctx.user.id, adminEmail: ctx.user.email || undefined, adminRole: ctx.user.role || "user", action: "security.cybermcp_full_scan", category: "security", details: { endpoint: input.endpoint }, ipAddress: ctx.req?.ip || "unknown" });
      return { endpoint: input.endpoint, scanResults, overallRisk, duration: Date.now() - startTime, scannedAt: new Date().toISOString() };
    }),
});
