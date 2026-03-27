/**
 * Argus Router — Backend tRPC endpoints for Argus OSINT & Reconnaissance.
 * Integrates the jasonxtn/argus Python toolkit (135 modules).
 *
 * Argus covers 3 categories:
 *   - Network & Infrastructure (52 modules): DNS, SSL, ports, traceroute, WHOIS, BGP...
 *   - Web Application Analysis (50 modules): crawl, XSS, CORS, JS analysis, headers...
 *   - Security & Threat Intelligence (33 modules): VirusTotal, Shodan, breached creds...
 *
 * Reference: https://github.com/jasonxtn/argus
 * Placed in the Security section — accessible to cyber, cyber_plus, and titan tiers.
 *
 * Architecture: Argus runs as a Python CLI on the user's VPS via SSH.
 * This router installs, manages, and executes Argus modules server-side.
 * Results are streamed back and parsed into structured JSON.
 */
import { z } from "zod";
import { router, protectedProcedure } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { getUserPlan, enforceFeature } from "./subscription-gate";
import { getDb } from "./db";
import { userSecrets } from "../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { Client as SSHClient } from "ssh2";
import { encrypt, decrypt } from "./fetcher-db";
import { logAdminAction } from "./admin-activity-log";
import { consumeCredits } from "./credit-service";
import { getTitanServerConfig, execSSHCommand as execTitanSSH } from "./titan-server";

// ─── SSH Execution Helper ─────────────────────────────────────────
interface SSHConfig {
  host: string;
  port: number;
  username: string;
  password?: string;
  privateKey?: string;
}

async function execSSHCommand(ssh: SSHConfig, command: string, timeoutMs = 60000): Promise<string> {
  return new Promise((resolve, reject) => {
    const conn = new SSHClient();
    let output = "";
    const timer = setTimeout(() => { conn.end(); reject(new TRPCError({ code: "TIMEOUT", message: `SSH command timed out after ${timeoutMs / 1000}s` })); }, timeoutMs);
    conn.on("ready", () => {
      conn.exec(command, (err: Error | undefined, stream: import("ssh2").ClientChannel) => {
        if (err) { clearTimeout(timer); conn.end(); reject(err); return; }
        stream
          .on("close", () => { clearTimeout(timer); conn.end(); resolve(output.trim()); })
          .on("data", (d: Buffer) => { output += d.toString(); })
          .stderr.on("data", (d: Buffer) => { output += d.toString(); });
      });
    }).on("error", (err: Error) => { clearTimeout(timer); reject(err); })
      .connect({ host: ssh.host, port: ssh.port, username: ssh.username, password: ssh.password, privateKey: ssh.privateKey, readyTimeout: 8000 });
  });
}

// ─── Get SSH Config ───────────────────────────────────────────────
async function getSshConfig(userId: number): Promise<SSHConfig> {
  // First try user-specific SSH config, then fall back to shared Titan server
  const titanConfig = getTitanServerConfig();
  const db = await getDb();
  if (!db) {
    if (titanConfig) return { host: titanConfig.host, port: titanConfig.port, username: titanConfig.username, password: titanConfig.password, privateKey: titanConfig.privateKey };
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
  }
  const result = await db.select().from(userSecrets)
    .where(and(eq(userSecrets.userId, userId), eq(userSecrets.secretType, "__argus_ssh")))
    .limit(1);
  if (result.length === 0) {
    // Fall back to shared Titan server if configured
    if (titanConfig) return { host: titanConfig.host, port: titanConfig.port, username: titanConfig.username, password: titanConfig.password, privateKey: titanConfig.privateKey };
    throw new TRPCError({ code: "BAD_REQUEST", message: "No Argus server configured. Please set up your SSH connection first." });
  }
  const cfg = JSON.parse(decrypt(result[0].encryptedValue));
  return { host: cfg.host, port: cfg.port || 22, username: cfg.username, password: cfg.password || undefined, privateKey: cfg.privateKey || undefined };
}

// ─── Module Catalogue ─────────────────────────────────────────────
export const ARGUS_MODULES = [
  // Network & Infrastructure
  { id: 1, name: "Associated Hosts", category: "network", description: "Find hosts associated with the target domain" },
  { id: 2, name: "DNS Over HTTPS", category: "network", description: "Query DNS records via HTTPS (DoH)" },
  { id: 3, name: "DNS Records", category: "network", description: "Enumerate all DNS records (A, AAAA, MX, NS, TXT, CNAME)" },
  { id: 4, name: "DNSSEC Check", category: "network", description: "Verify DNSSEC implementation and chain of trust" },
  { id: 5, name: "Domain Info", category: "network", description: "Comprehensive domain registration information" },
  { id: 6, name: "Domain Reputation Check", category: "network", description: "Check domain reputation across threat intelligence feeds" },
  { id: 8, name: "IP Info", category: "network", description: "Detailed IP address geolocation and ownership info" },
  { id: 9, name: "Open Ports Scan", category: "network", description: "Scan for open TCP/UDP ports on the target" },
  { id: 10, name: "Server Info", category: "network", description: "Detect server software, version, and configuration" },
  { id: 12, name: "SSL Chain Analysis", category: "network", description: "Analyse the full SSL/TLS certificate chain" },
  { id: 13, name: "SSL Expiry Alert", category: "network", description: "Check SSL certificate expiry dates" },
  { id: 14, name: "TLS Cipher Suites", category: "network", description: "Enumerate supported TLS cipher suites" },
  { id: 16, name: "Traceroute", category: "network", description: "Trace the network path to the target" },
  { id: 17, name: "TXT Records", category: "network", description: "Extract TXT records (SPF, DKIM, verification tokens)" },
  { id: 18, name: "WHOIS Lookup", category: "network", description: "Full WHOIS registration data for domain or IP" },
  { id: 19, name: "Zone Transfer", category: "network", description: "Attempt DNS zone transfer (AXFR)" },
  { id: 20, name: "ASN Lookup", category: "network", description: "Autonomous System Number and BGP prefix lookup" },
  { id: 21, name: "Reverse IP Lookup", category: "network", description: "Find all domains hosted on the same IP" },
  { id: 27, name: "CDN Detection", category: "network", description: "Detect CDN provider and edge nodes" },
  { id: 28, name: "Reverse DNS Scan", category: "network", description: "Reverse DNS lookup across IP ranges" },
  // Web Application Analysis
  { id: 53, name: "Archive History", category: "web", description: "Query Wayback Machine for historical snapshots" },
  { id: 54, name: "Broken Links Detection", category: "web", description: "Find broken links and dead resources on the site" },
  { id: 56, name: "CMS Detection", category: "web", description: "Identify the CMS (WordPress, Drupal, Joomla, etc.)" },
  { id: 57, name: "Cookies Analyzer", category: "web", description: "Analyse cookie security flags and attributes" },
  { id: 58, name: "Content Discovery", category: "web", description: "Discover hidden files, directories, and endpoints" },
  { id: 59, name: "Crawler", category: "web", description: "Crawl the site and map all accessible pages" },
  { id: 60, name: "Robots.txt Analyzer", category: "web", description: "Parse and analyse robots.txt for sensitive paths" },
  { id: 61, name: "Directory Finder", category: "web", description: "Brute-force common directory and file paths" },
  { id: 62, name: "Email Harvesting", category: "web", description: "Extract email addresses from the target domain" },
  { id: 68, name: "Technology Stack Detection", category: "web", description: "Fingerprint web technologies (frameworks, libraries, CDNs)" },
  { id: 70, name: "JavaScript File Analyzer", category: "web", description: "Analyse JavaScript files for secrets and endpoints" },
  { id: 71, name: "CORS Misconfiguration Scanner", category: "web", description: "Test for CORS policy misconfigurations" },
  { id: 74, name: "Clickjacking Test", category: "web", description: "Test for clickjacking vulnerability (X-Frame-Options)" },
  { id: 77, name: "HTML Comments Extractor", category: "web", description: "Extract developer comments from HTML source" },
  { id: 80, name: "Virtual Host Fuzzer", category: "web", description: "Discover virtual hosts via Host header fuzzing" },
  { id: 89, name: "WebSocket Endpoint Sniffer", category: "web", description: "Detect WebSocket endpoints and protocols" },
  { id: 90, name: "API Schema Grabber", category: "web", description: "Discover and extract API schemas (OpenAPI, GraphQL)" },
  { id: 92, name: "HTTP Method Enumerator", category: "web", description: "Enumerate allowed HTTP methods (OPTIONS, PUT, DELETE)" },
  { id: 93, name: "GraphQL Introspection Probe", category: "web", description: "Test GraphQL endpoints for introspection exposure" },
  { id: 98, name: "CSP Deep Analyzer", category: "web", description: "Deep analysis of Content Security Policy headers" },
  // Security & Threat Intelligence
  { id: 103, name: "Censys Reconnaissance", category: "security", description: "Query Censys for exposed services and certificates" },
  { id: 104, name: "Certificate Authority Recon", category: "security", description: "Query certificate transparency logs" },
  { id: 105, name: "Data Leak Detection", category: "security", description: "Check for data leaks in public breach databases" },
  { id: 106, name: "Exposed Environment Files", category: "security", description: "Scan for exposed .env, config, and credential files" },
  { id: 107, name: "Firewall Detection", category: "security", description: "Detect WAF and firewall presence" },
  { id: 109, name: "HTTP Headers", category: "security", description: "Full HTTP response header analysis" },
  { id: 110, name: "HTTP Security Features", category: "security", description: "Check HSTS, CSP, and other security headers" },
  { id: 111, name: "Malware & Phishing Check", category: "security", description: "Check domain against malware and phishing databases" },
  { id: 115, name: "Shodan Reconnaissance", category: "security", description: "Query Shodan for exposed services and vulnerabilities" },
  { id: 116, name: "SSL Labs Report", category: "security", description: "Full Qualys SSL Labs grade and report" },
  { id: 118, name: "Subdomain Enumeration", category: "security", description: "Enumerate subdomains via multiple techniques" },
  { id: 119, name: "Subdomain Takeover", category: "security", description: "Test subdomains for takeover vulnerabilities" },
  { id: 120, name: "VirusTotal Scan", category: "security", description: "Scan domain/IP against VirusTotal threat intelligence" },
  { id: 122, name: "Breached Credentials Lookup", category: "security", description: "Check for breached credentials (HIBP)" },
  { id: 123, name: "Cloud Bucket Exposure", category: "security", description: "Find exposed S3, GCS, and Azure storage buckets" },
  { id: 124, name: "JWT Token Analyzer", category: "security", description: "Analyse JWT tokens for vulnerabilities" },
  { id: 125, name: "Exposed API Endpoints", category: "security", description: "Discover exposed and undocumented API endpoints" },
  { id: 126, name: "Git Repository Exposure Check", category: "security", description: "Check for exposed .git directories" },
  { id: 127, name: "Typosquat Domain Checker", category: "security", description: "Find typosquatting domains targeting the target" },
  { id: 128, name: "SPF / DKIM / DMARC Validator", category: "security", description: "Validate email security DNS records" },
  { id: 129, name: "Open Redirect Finder", category: "security", description: "Test for open redirect vulnerabilities" },
  { id: 130, name: "Rate-Limit & WAF Bypass Test", category: "security", description: "Test rate limiting and WAF bypass techniques" },
  { id: 134, name: "JS Malware Scanner", category: "security", description: "Scan JavaScript files for malicious code patterns" },
  { id: 135, name: "Cloud Service Enumeration", category: "security", description: "Enumerate cloud services and infrastructure" },
];

// ─── Router ───────────────────────────────────────────────────────
export const argusRouter = router({

  // ── Setup: Test SSH connection ────────────────────────────────
  testConnection: protectedProcedure
    .input(z.object({
      host: z.string().min(1),
      port: z.number().default(22),
      username: z.string().default("root"),
      authType: z.enum(["password", "key"]),
      password: z.string().optional(),
      privateKey: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const plan = await getUserPlan(ctx.user.id);
      enforceFeature(plan.planId, "security_tools", "Argus");
      const ssh: SSHConfig = { host: input.host, port: input.port, username: input.username, password: input.authType === "password" ? input.password : undefined, privateKey: input.authType === "key" ? input.privateKey : undefined };
      const osInfo = await execSSHCommand(ssh, "uname -a && python3 --version 2>&1 && echo 'SSH_OK'", 10000);
      const argusInstalled = await execSSHCommand(ssh, "python3 -c 'import argus; print(\"argus_ok\")' 2>/dev/null || (ls /opt/argus/argus/__main__.py 2>/dev/null && echo 'argus_ok') || echo 'not_installed'", 10000);
      return { success: osInfo.includes("SSH_OK"), osInfo, argusInstalled: argusInstalled.includes("argus_ok"), message: argusInstalled.includes("argus_ok") ? "SSH connected — Argus is installed" : "SSH connected — Argus not yet installed. Use 'Install Argus' to set it up." };
    }),

  // ── Setup: Save SSH credentials ───────────────────────────────
  saveConnection: protectedProcedure
    .input(z.object({
      host: z.string().min(1),
      port: z.number().default(22),
      username: z.string().default("root"),
      authType: z.enum(["password", "key"]),
      password: z.string().optional(),
      privateKey: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const plan = await getUserPlan(ctx.user.id);
      enforceFeature(plan.planId, "security_tools", "Argus");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const payload = { host: input.host, port: input.port, username: input.username, password: input.authType === "password" ? input.password : undefined, privateKey: input.authType === "key" ? input.privateKey : undefined };
      const encrypted = encrypt(JSON.stringify(payload));
      const existing = await db.select().from(userSecrets).where(and(eq(userSecrets.userId, ctx.user.id), eq(userSecrets.secretType, "__argus_ssh"))).limit(1);
      if (existing.length > 0) {
        await db.update(userSecrets).set({ encryptedValue: encrypted }).where(and(eq(userSecrets.userId, ctx.user.id), eq(userSecrets.secretType, "__argus_ssh")));
      } else {
        await db.insert(userSecrets).values({ userId: ctx.user.id, secretType: "__argus_ssh", encryptedValue: encrypted });
      }
      await logAdminAction({ adminId: ctx.user.id, adminEmail: ctx.user.email || undefined, adminRole: ctx.user.role || "user", action: "security.argus_save_connection", category: "security", details: { host: input.host }, ipAddress: ctx.req?.ip || "unknown" });
      return { success: true, message: "Argus server credentials saved" };
    }),

  // ── Setup: Install Argus on VPS ───────────────────────────────
  install: protectedProcedure
    .input(z.object({ method: z.enum(["pip", "git", "docker"]).default("git") }))
    .mutation(async ({ ctx, input }) => {
      const plan = await getUserPlan(ctx.user.id);
      enforceFeature(plan.planId, "security_tools", "Argus");
      const ssh = await getSshConfig(ctx.user.id);

      let installCmd: string;
      if (input.method === "pip") {
        installCmd = "pip3 install argus-recon 2>&1 | tail -10 && echo 'Argus pip install complete'";
      } else if (input.method === "docker") {
        installCmd = [
          "apt-get install -y docker.io 2>&1 | tail -3",
          "cd /opt && rm -rf argus && git clone https://github.com/jasonxtn/argus.git 2>&1",
          "cd /opt/argus && docker build -t argus-recon:latest . 2>&1 | tail -10",
          "echo 'Argus Docker install complete'",
        ].join(" && ");
      } else {
        installCmd = [
          "apt-get update -qq 2>&1 | tail -2",
          "apt-get install -y git python3 python3-pip 2>&1 | tail -3",
          "cd /opt && rm -rf argus && git clone https://github.com/jasonxtn/argus.git 2>&1",
          "cd /opt/argus && pip3 install -r requirements.txt 2>&1 | tail -10",
          "chmod +x /opt/argus/install.sh && cd /opt/argus && ./install.sh 2>&1 | tail -5",
          "echo 'Argus git install complete'",
        ].join(" && ");
      }

      const output = await execSSHCommand(ssh, installCmd, 300000);
      await logAdminAction({ adminId: ctx.user.id, adminEmail: ctx.user.email || undefined, adminRole: ctx.user.role || "user", action: "security.argus_install", category: "security", details: { host: ssh.host, method: input.method }, ipAddress: ctx.req?.ip || "unknown" });
      return { success: output.includes("complete"), output, method: input.method };
    }),

  // ── Setup: Configure API keys ─────────────────────────────────
  setApiKeys: protectedProcedure
    .input(z.object({
      virustotalKey: z.string().optional(),
      shodanKey: z.string().optional(),
      censysId: z.string().optional(),
      censysSecret: z.string().optional(),
      hibpKey: z.string().optional(),
      googleKey: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const plan = await getUserPlan(ctx.user.id);
      enforceFeature(plan.planId, "security_tools", "Argus");
      const ssh = await getSshConfig(ctx.user.id);
      const exports: string[] = [];
      if (input.virustotalKey) exports.push(`export VIRUSTOTAL_API_KEY="${input.virustotalKey}"`);
      if (input.shodanKey) exports.push(`export SHODAN_API_KEY="${input.shodanKey}"`);
      if (input.censysId) exports.push(`export CENSYS_API_ID="${input.censysId}"`);
      if (input.censysSecret) exports.push(`export CENSYS_API_SECRET="${input.censysSecret}"`);
      if (input.hibpKey) exports.push(`export HIBP_API_KEY="${input.hibpKey}"`);
      if (input.googleKey) exports.push(`export GOOGLE_API_KEY="${input.googleKey}"`);
      if (exports.length === 0) throw new TRPCError({ code: "BAD_REQUEST", message: "No API keys provided" });
      const envLine = exports.join(" && ");
      const cmd = `${envLine} && echo "${exports.map(e => e.replace("export ", "")).join("\\n")}" >> ~/.bashrc && echo 'API keys saved'`;
      const output = await execSSHCommand(ssh, cmd, 10000);
      return { success: output.includes("saved"), keysConfigured: exports.length };
    }),

  // ── Modules: Get module catalogue ────────────────────────────
  getModules: protectedProcedure
    .input(z.object({ category: z.enum(["all", "network", "web", "security"]).default("all") }))
    .query(async ({ ctx, input }) => {
      const plan = await getUserPlan(ctx.user.id);
      enforceFeature(plan.planId, "security_tools", "Argus");
      const filtered = input.category === "all" ? ARGUS_MODULES : ARGUS_MODULES.filter(m => m.category === input.category);
      return { modules: filtered, total: filtered.length, categories: { network: ARGUS_MODULES.filter(m => m.category === "network").length, web: ARGUS_MODULES.filter(m => m.category === "web").length, security: ARGUS_MODULES.filter(m => m.category === "security").length } };
    }),

  // ── Scan: Run a single Argus module ──────────────────────────
  runModule: protectedProcedure
    .input(z.object({
      moduleId: z.number().min(1).max(135),
      target: z.string().min(1),
      threads: z.number().min(1).max(50).default(10),
      timeout: z.number().min(10).max(300).default(60),
      extraOptions: z.record(z.string(), z.string()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const plan = await getUserPlan(ctx.user.id);
      enforceFeature(plan.planId, "security_tools", "Argus");
      const ssh = await getSshConfig(ctx.user.id);

      const moduleMeta = ARGUS_MODULES.find(m => m.id === input.moduleId);
      if (!moduleMeta) throw new TRPCError({ code: "BAD_REQUEST", message: `Module ${input.moduleId} not found` });

      // Build Argus CLI command using the interactive pipe approach
      const argusCmd = [
        `cd /opt/argus 2>/dev/null || true`,
        `ARGUS_CMD="use ${input.moduleId}\\nset target ${input.target}\\nset threads ${input.threads}\\nrun\\nexit"`,
        `echo -e "$ARGUS_CMD" | timeout ${input.timeout} python3 -m argus 2>&1`,
        `# Fallback: pip-installed argus`,
        `echo -e "$ARGUS_CMD" | timeout ${input.timeout} argus 2>&1 || true`,
      ].join("\n");

      const startTime = Date.now();
      const output = await execSSHCommand(ssh, argusCmd, (input.timeout + 15) * 1000);
      const duration = Date.now() - startTime;

      await consumeCredits(ctx.user.id, "security_scan", `Argus module: ${moduleMeta.name}`);
      await logAdminAction({ adminId: ctx.user.id, adminEmail: ctx.user.email || undefined, adminRole: ctx.user.role || "user", action: "security.argus_run_module", category: "security", details: { moduleId: String(input.moduleId), moduleName: moduleMeta.name, target: input.target, duration: String(duration) }, ipAddress: ctx.req?.ip || "unknown" });

      return {
        moduleId: input.moduleId,
        moduleName: moduleMeta.name,
        category: moduleMeta.category,
        target: input.target,
        output: output || "No output returned",
        duration,
        scannedAt: new Date().toISOString(),
      };
    }),

  // ── Scan: Run multiple modules (batch, up to 30, optional parallel) ───
  runBatch: protectedProcedure
    .input(z.object({
      moduleIds: z.array(z.number()).min(1).max(30),
      target: z.string().min(1),
      threads: z.number().min(1).max(50).default(10),
      parallel: z.boolean().optional().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      const plan = await getUserPlan(ctx.user.id);
      enforceFeature(plan.planId, "security_tools", "Argus");
      const ssh = await getSshConfig(ctx.user.id);
      const results: Array<{ moduleId: number; moduleName: string; output: string; duration: number }> = [];
      const runOne = async (moduleId: number) => {
        const moduleMeta = ARGUS_MODULES.find(m => m.id === moduleId);
        if (!moduleMeta) return;
        const argusCmd = `cd /opt/argus 2>/dev/null || true && echo -e "use ${moduleId}\\nset target ${input.target}\\nset threads ${input.threads}\\nrun\\nexit" | timeout 60 python3 -m argus 2>&1 || echo -e "use ${moduleId}\\nset target ${input.target}\\nrun\\nexit" | timeout 60 argus 2>&1 || echo 'Module failed'`;
        const start = Date.now();
        try {
          const output = await execSSHCommand(ssh, argusCmd, 75000);
          results.push({ moduleId, moduleName: moduleMeta.name, output, duration: Date.now() - start });
        } catch (e: any) {
          results.push({ moduleId, moduleName: moduleMeta.name, output: `Error: ${e.message}`, duration: Date.now() - start });
        }
      };
      if (input.parallel) {
        await Promise.allSettled(input.moduleIds.map(runOne));
      } else {
        for (const moduleId of input.moduleIds) await runOne(moduleId);
      }
      await consumeCredits(ctx.user.id, "security_scan", `Argus batch scan: ${input.moduleIds.length} modules`);
      await logAdminAction({ adminId: ctx.user.id, adminEmail: ctx.user.email || undefined, adminRole: ctx.user.role || "user", action: "security.argus_batch_scan", category: "security", details: { moduleCount: String(input.moduleIds.length), target: input.target, parallel: String(input.parallel) }, ipAddress: ctx.req?.ip || "unknown" });
      results.sort((a, b) => input.moduleIds.indexOf(a.moduleId) - input.moduleIds.indexOf(b.moduleId));
      return { results, target: input.target, totalModules: results.length, scannedAt: new Date().toISOString() };
    }),

  // ── Scan: Run a full category scan ────────────────────────────
  runCategory: protectedProcedure
    .input(z.object({
      category: z.enum(["infra", "web", "security"]),
      target: z.string().min(1),
      threads: z.number().min(1).max(50).default(10),
    }))
    .mutation(async ({ ctx, input }) => {
      const plan = await getUserPlan(ctx.user.id);
      enforceFeature(plan.planId, "security_tools", "Argus");
      const ssh = await getSshConfig(ctx.user.id);
      const argusCmd = `cd /opt/argus 2>/dev/null || true && echo -e "set target ${input.target}\\nset threads ${input.threads}\\nrunall ${input.category}\\nexit" | timeout 300 python3 -m argus 2>&1 || echo -e "set target ${input.target}\\nrunall ${input.category}\\nexit" | timeout 300 argus 2>&1 || echo 'Category scan failed'`;
      const start = Date.now();
      const output = await execSSHCommand(ssh, argusCmd, 320000);
      await consumeCredits(ctx.user.id, "security_scan", `Argus category scan: ${input.category}`);
      await logAdminAction({ adminId: ctx.user.id, adminEmail: ctx.user.email || undefined, adminRole: ctx.user.role || "user", action: "security.argus_category_scan", category: "security", details: { category: input.category, target: input.target }, ipAddress: ctx.req?.ip || "unknown" });
      return { category: input.category, target: input.target, output, duration: Date.now() - start, scannedAt: new Date().toISOString() };
    }),

  // ── Scan: Quick recon (top 5 essential modules) ───────────────
  quickRecon: protectedProcedure
    .input(z.object({
      target: z.string().min(1),
      depth: z.enum(["fast", "standard", "deep"]).optional().default("standard"),
    }))
    .mutation(async ({ ctx, input }) => {
      const plan = await getUserPlan(ctx.user.id);
      enforceFeature(plan.planId, "security_tools", "Argus");
      const ssh = await getSshConfig(ctx.user.id);
      // fast: 5 modules | standard: 12 modules | deep: 20 modules
      const fastModules = [3, 18, 12, 9, 118];
      const standardModules = [3, 18, 12, 9, 118, 4, 17, 20, 21, 27, 10, 13];
      const deepModules = [3, 18, 12, 9, 118, 4, 17, 20, 21, 27, 10, 13, 14, 16, 19, 6, 5, 8, 28, 2];
      const moduleList = input.depth === "fast" ? fastModules : input.depth === "deep" ? deepModules : standardModules;
      const results: Array<{ moduleId: number; moduleName: string; output: string; duration: number }> = [];
      // Run all modules in parallel for speed
      const promises = moduleList.map(async (moduleId) => {
        const moduleMeta = ARGUS_MODULES.find(m => m.id === moduleId);
        if (!moduleMeta) return;
        const cmd = `cd /opt/argus 2>/dev/null || true && echo -e "use ${moduleId}\\nset target ${input.target}\\nrun\\nexit" | timeout 60 python3 -m argus 2>&1 || echo -e "use ${moduleId}\\nset target ${input.target}\\nrun\\nexit" | timeout 60 argus 2>&1 || echo 'Skipped'`;
        const t = Date.now();
        try {
          const output = await execSSHCommand(ssh, cmd, 75000);
          results.push({ moduleId, moduleName: moduleMeta.name, output, duration: Date.now() - t });
        } catch {
          results.push({ moduleId, moduleName: moduleMeta.name, output: "Timed out", duration: Date.now() - t });
        }
      });
      await Promise.allSettled(promises);
      await consumeCredits(ctx.user.id, "security_scan", `Argus quick recon (${input.depth})`);
      await logAdminAction({ adminId: ctx.user.id, adminEmail: ctx.user.email || undefined, adminRole: ctx.user.role || "user", action: "security.argus_quick_recon", category: "security", details: { target: input.target, depth: input.depth }, ipAddress: ctx.req?.ip || "unknown" });
      results.sort((a, b) => moduleList.indexOf(a.moduleId) - moduleList.indexOf(b.moduleId));
      return { results, target: input.target, depth: input.depth, totalModules: results.length, scannedAt: new Date().toISOString() };
    }),

   // ── Scan: Full recon — all 135 modules in parallel batches ───────
  fullRecon: protectedProcedure
    .input(z.object({
      target: z.string().min(1),
      batchSize: z.number().min(1).max(20).optional().default(10),
      skipModules: z.array(z.number()).optional().default([]),
    }))
    .mutation(async ({ ctx, input }) => {
      const plan = await getUserPlan(ctx.user.id);
      enforceFeature(plan.planId, "security_tools", "Argus");
      const ssh = await getSshConfig(ctx.user.id);
      const allModuleIds = ARGUS_MODULES
        .map(m => m.id)
        .filter(id => !input.skipModules.includes(id));
      const results: Array<{ moduleId: number; moduleName: string; output: string; duration: number; category: string }> = [];
      // Process in parallel batches to avoid overwhelming the VPS
      for (let i = 0; i < allModuleIds.length; i += input.batchSize) {
        const batch = allModuleIds.slice(i, i + input.batchSize);
        const batchPromises = batch.map(async (moduleId) => {
          const moduleMeta = ARGUS_MODULES.find(m => m.id === moduleId);
          if (!moduleMeta) return;
          const cmd = `cd /opt/argus 2>/dev/null || true && echo -e "use ${moduleId}\\nset target ${input.target}\\nrun\\nexit" | timeout 60 python3 -m argus 2>&1 || echo 'Skipped'`;
          const t = Date.now();
          try {
            const output = await execSSHCommand(ssh, cmd, 75000);
            results.push({ moduleId, moduleName: moduleMeta.name, output, duration: Date.now() - t, category: moduleMeta.category });
          } catch {
            results.push({ moduleId, moduleName: moduleMeta.name, output: "Timed out", duration: Date.now() - t, category: moduleMeta.category });
          }
        });
        await Promise.allSettled(batchPromises);
      }
      await consumeCredits(ctx.user.id, "security_scan", `Argus full recon (${allModuleIds.length} modules)`);
      await logAdminAction({ adminId: ctx.user.id, adminEmail: ctx.user.email || undefined, adminRole: ctx.user.role || "user", action: "security.argus_full_recon", category: "security", details: { target: input.target, moduleCount: String(allModuleIds.length) }, ipAddress: ctx.req?.ip || "unknown" });
      results.sort((a, b) => a.moduleId - b.moduleId);
      const byCategory = results.reduce((acc, r) => {
        if (!acc[r.category]) acc[r.category] = [];
        (acc[r.category] as typeof results).push(r);
        return acc;
      }, {} as Record<string, typeof results>);
      return { results, byCategory, target: input.target, totalModules: results.length, scannedAt: new Date().toISOString() };
    }),

  // ── Status: Check Argus installation ─────────────────────
  getStatus: protectedProcedure.query(async ({ ctx }) => {
    const plan = await getUserPlan(ctx.user.id);
    enforceFeature(plan.planId, "security_tools", "Argus");
    const ssh = await getSshConfig(ctx.user.id);
    const statusCmd = [
      "python3 --version 2>&1",
      "echo '---'",
      "python3 -c 'import argus; print(argus.__version__)' 2>/dev/null || (ls /opt/argus 2>/dev/null && echo 'git_install') || echo 'not_installed'",
      "echo '---'",
      "pip3 show argus-recon 2>/dev/null | grep Version || echo 'pip_not_found'",
    ].join(" && ");
    const raw = await execSSHCommand(ssh, statusCmd, 15000);
    const parts = raw.split("---").map(s => s.trim());
    return {
      pythonVersion: parts[0] || "unknown",
      argusVersion: parts[1] || "not_installed",
      pipInfo: parts[2] || "not_found",
      installed: !parts[1]?.includes("not_installed"),
      host: ssh.host,
    };
  }),

  // ── Update: Pull latest Argus ─────────────────────────────────
  update: protectedProcedure.mutation(async ({ ctx }) => {
    const plan = await getUserPlan(ctx.user.id);
    enforceFeature(plan.planId, "security_tools", "Argus");
    const ssh = await getSshConfig(ctx.user.id);
    const output = await execSSHCommand(ssh, "cd /opt/argus && git pull origin main 2>&1 && pip3 install -r requirements.txt 2>&1 | tail -5 && echo 'Argus updated'", 120000);
    return { success: output.includes("updated"), output };
  }),
});
