/**
 * Astra Router — Backend tRPC endpoints for Astra REST API security testing.
 * Integrates the Flipkart Incubator Astra automated security testing framework.
 *
 * Astra tests for:
 *   SQL injection, XSS, Information Leakage, Broken Auth, CSRF,
 *   Rate limiting, CORS misconfiguration, JWT attacks, CRLF injection,
 *   Blind XXE, SSRF, Template Injection
 *
 * Reference: https://github.com/flipkart-incubator/Astra
 * Placed in the Security section — accessible to cyber, cyber_plus, and titan tiers.
 *
 * Architecture: Astra runs as a Python/Flask service (port 8094) on the user's
 * configured VPS. This router proxies requests to that service via SSH tunnelling
 * and also supports direct HTTP mode when Astra is network-accessible.
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
import { getTitanServerConfig, execSSHCommand as execTitanSSH } from "./titan-server";

// ─── SSH Execution Helper ─────────────────────────────────────────
interface SSHConfig {
  host: string;
  port: number;
  username: string;
  password?: string;
  privateKey?: string;
  astraPort?: number;
}

async function execSSHCommand(ssh: SSHConfig, command: string, timeoutMs = 30000): Promise<string> {
  return new Promise((resolve, reject) => {
    const conn = new SSHClient();
    let output = "";
    const timer = setTimeout(() => { conn.end(); reject(new TRPCError({ code: "TIMEOUT", message: "SSH command timed out" })); }, timeoutMs);
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

// ─── Astra HTTP Proxy (via SSH tunnel) ───────────────────────────
async function astraApiCall(
  ssh: SSHConfig,
  path: string,
  method: "GET" | "POST",
  body?: object,
  timeoutMs = 60000,
  userId?: number
): Promise<{ status: number; data: any }> {
  const astraPort = ssh.astraPort || 8094;
  const bodyJson = body ? JSON.stringify(body) : "";
  const curlCmd = method === "POST"
    ? `curl -s -w "\\n__STATUS__%{http_code}" -X POST -H "Content-Type: application/json" -d '${bodyJson.replace(/'/g, "'\\''")}' http://127.0.0.1:${astraPort}${path} 2>/dev/null`
    : `curl -s -w "\\n__STATUS__%{http_code}" http://127.0.0.1:${astraPort}${path} 2>/dev/null`;

  const raw = (ssh as any).isTitanServer && userId 
    ? await execTitanSSH(ssh as any, curlCmd, timeoutMs, userId)
    : await execSSHCommand(ssh, curlCmd, timeoutMs);
  const statusMatch = raw.match(/__STATUS__(\d+)$/);
  const status = statusMatch ? parseInt(statusMatch[1]) : 0;
  const responseBody = raw.replace(/__STATUS__\d+$/, "").trim();

  let data: any;
  try { data = JSON.parse(responseBody); } catch { data = { raw: responseBody }; }
  return { status, data };
}

// ─── Get SSH Config ───────────────────────────────────────────────
async function getSshConfig(userId: number): Promise<SSHConfig> {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
  const result = await db.select().from(userSecrets)
    .where(and(eq(userSecrets.userId, userId), eq(userSecrets.secretType, "__astra_ssh")))
    .limit(1);
  
  if (result.length === 0) {
    // Fallback to shared Titan Server if configured
    const titanConfig = getTitanServerConfig();
    if (titanConfig) {
      return { ...titanConfig, astraPort: 8094 };
    }
    throw new TRPCError({ code: "BAD_REQUEST", message: "No Astra server configured. Please set up your SSH connection first." });
  }
  const cfg = JSON.parse(decrypt(result[0].encryptedValue));
  return { host: cfg.host, port: cfg.port || 22, username: cfg.username, password: cfg.password || undefined, privateKey: cfg.privateKey || undefined, astraPort: cfg.astraPort || 8094 };
}

// ─── Router ───────────────────────────────────────────────────────
export const astraRouter = router({

  // ── Server: Test SSH connection and check Astra status ─────────
  testConnection: protectedProcedure
    .input(z.object({
      host: z.string().min(1),
      port: z.number().default(22),
      username: z.string().default("root"),
      authType: z.enum(["password", "key"]),
      password: z.string().optional(),
      privateKey: z.string().optional(),
      astraPort: z.number().default(8094),
    }))
    .mutation(async ({ ctx, input }) => {
      const plan = await getUserPlan(ctx.user.id);
      enforceFeature(plan.planId, "security_tools", "Astra");
      const ssh: SSHConfig = { host: input.host, port: input.port, username: input.username, password: input.authType === "password" ? input.password : undefined, privateKey: input.authType === "key" ? input.privateKey : undefined, astraPort: input.astraPort };
      const osInfo = await execSSHCommand(ssh, "uname -a && python3 --version 2>&1", 10000);
      const astraStatus = await execSSHCommand(ssh, `curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:${input.astraPort}/ 2>/dev/null || echo "not_running"`, 10000);
      const astraRunning = astraStatus.trim() === "200" || astraStatus.trim() === "302";
      return { success: true, osInfo, astraRunning, astraPort: input.astraPort, message: astraRunning ? `Astra is running on port ${input.astraPort}` : "SSH connected — Astra not yet running. Use 'Start Astra' to launch it." };
    }),

  // ── Server: Save SSH credentials ──────────────────────────────
  saveConnection: protectedProcedure
    .input(z.object({
      host: z.string().min(1),
      port: z.number().default(22),
      username: z.string().default("root"),
      authType: z.enum(["password", "key"]),
      password: z.string().optional(),
      privateKey: z.string().optional(),
      astraPort: z.number().default(8094),
    }))
    .mutation(async ({ ctx, input }) => {
      const plan = await getUserPlan(ctx.user.id);
      enforceFeature(plan.planId, "security_tools", "Astra");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const payload = { host: input.host, port: input.port, username: input.username, password: input.authType === "password" ? input.password : undefined, privateKey: input.authType === "key" ? input.privateKey : undefined, astraPort: input.astraPort };
      const encrypted = encrypt(JSON.stringify(payload));
      const existing = await db.select().from(userSecrets).where(and(eq(userSecrets.userId, ctx.user.id), eq(userSecrets.secretType, "__astra_ssh"))).limit(1);
      if (existing.length > 0) {
        await db.update(userSecrets).set({ encryptedValue: encrypted }).where(and(eq(userSecrets.userId, ctx.user.id), eq(userSecrets.secretType, "__astra_ssh")));
      } else {
        await db.insert(userSecrets).values({ userId: ctx.user.id, secretType: "__astra_ssh", encryptedValue: encrypted });
      }
      await logAdminAction({ adminId: ctx.user.id, adminEmail: ctx.user.email || undefined, adminRole: ctx.user.role || "user", action: "security.astra_save_connection", category: "security", details: { host: input.host }, ipAddress: ctx.req?.ip || "unknown" });
      return { success: true, message: "Astra server credentials saved" };
    }),

  // ── Server: Install Astra on VPS ──────────────────────────────
  install: protectedProcedure.mutation(async ({ ctx }) => {
    const plan = await getUserPlan(ctx.user.id);
    enforceFeature(plan.planId, "security_tools", "Astra");
    const ssh = await getSshConfig(ctx.user.id);
    const installCmd = [
      "apt-get update -qq 2>&1 | tail -3",
      "apt-get install -y git python3 python3-pip rabbitmq-server mongodb 2>&1 | tail -5",
      "cd /opt && rm -rf Astra && git clone https://github.com/flipkart-incubator/Astra.git 2>&1",
      "cd /opt/Astra && pip3 install -r requirements.txt 2>&1 | tail -10",
      "echo 'Astra installation complete'",
    ].join(" && ");
    const output = await execSSHCommand(ssh, installCmd, 180000);
    await logAdminAction({ adminId: ctx.user.id, adminEmail: ctx.user.email || undefined, adminRole: ctx.user.role || "user", action: "security.astra_install", category: "security", details: { host: ssh.host }, ipAddress: ctx.req?.ip || "unknown" });
    return { success: output.includes("installation complete"), output };
  }),

  // ── Server: Start Astra service ───────────────────────────────
  start: protectedProcedure.mutation(async ({ ctx }) => {
    const plan = await getUserPlan(ctx.user.id);
    enforceFeature(plan.planId, "security_tools", "Astra");
    const ssh = await getSshConfig(ctx.user.id);
    const astraPort = ssh.astraPort || 8094;
    const startCmd = [
      "systemctl start rabbitmq-server 2>/dev/null || service rabbitmq-server start 2>/dev/null || true",
      "systemctl start mongod 2>/dev/null || service mongod start 2>/dev/null || mongod --fork --logpath /var/log/mongod.log 2>/dev/null || true",
      "sleep 2",
      `pkill -f 'python3.*api.py' 2>/dev/null || true`,
      `cd /opt/Astra && nohup celery -A worker -loglevel=ERROR > /tmp/astra-celery.log 2>&1 &`,
      `sleep 2`,
      `cd /opt/Astra/API && nohup python3 api.py > /tmp/astra-api.log 2>&1 &`,
      `sleep 3`,
      `curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:${astraPort}/ 2>/dev/null`,
    ].join(" && ");
    const output = await execSSHCommand(ssh, startCmd, 60000);
    const running = output.trim().endsWith("200") || output.trim().endsWith("302");
    await logAdminAction({ adminId: ctx.user.id, adminEmail: ctx.user.email || undefined, adminRole: ctx.user.role || "user", action: "security.astra_start", category: "security", details: { host: ssh.host, running: String(running) }, ipAddress: ctx.req?.ip || "unknown" });
    return { success: running, output, message: running ? `Astra started on port ${astraPort}` : "Astra may not have started — check logs" };
  }),

  // ── Server: Stop Astra service ────────────────────────────────
  stop: protectedProcedure.mutation(async ({ ctx }) => {
    const plan = await getUserPlan(ctx.user.id);
    enforceFeature(plan.planId, "security_tools", "Astra");
    const ssh = await getSshConfig(ctx.user.id);
    const output = await execSSHCommand(ssh, "pkill -f 'python3.*api.py' 2>/dev/null; pkill -f 'celery.*worker' 2>/dev/null; echo 'Stopped'", 15000);
    return { success: true, output };
  }),

  // ── Server: Get Astra logs ─────────────────────────────────────
  getLogs: protectedProcedure
    .input(z.object({ lines: z.number().min(10).max(200).default(50), logType: z.enum(["api", "celery"]).default("api") }))
    .mutation(async ({ ctx, input }) => {
      const plan = await getUserPlan(ctx.user.id);
      enforceFeature(plan.planId, "security_tools", "Astra");
      const ssh = await getSshConfig(ctx.user.id);
      const logFile = input.logType === "api" ? "/tmp/astra-api.log" : "/tmp/astra-celery.log";
      const output = await execSSHCommand(ssh, `tail -${input.lines} ${logFile} 2>/dev/null || echo 'No log file found'`, 10000);
      return { output, logType: input.logType };
    }),

  // ── Scan: Start a new API scan ────────────────────────────────
  startScan: protectedProcedure
    .input(z.object({
      appname: z.string().min(1).max(100),
      url: z.string().url(),
      method: z.enum(["GET", "POST"]).default("GET"),
      headers: z.string().optional().describe('JSON string, e.g. {"Authorization":"Bearer token"}'),
      body: z.string().optional().describe("Request body for POST endpoints"),
      authHeader: z.string().optional().describe("Additional auth header value"),
      authUrl: z.string().url().optional().describe("URL to refresh auth token automatically"),
    }))
    .mutation(async ({ ctx, input }) => {
      const plan = await getUserPlan(ctx.user.id);
      enforceFeature(plan.planId, "security_tools", "Astra");
      const ssh = await getSshConfig(ctx.user.id);
      const payload = {
        appname: input.appname,
        url: input.url,
        method: input.method,
        headers: input.headers || "",
        body: input.body || "",
        auth_header: input.authHeader || "",
        auth_url: input.authUrl || "",
      };
      const result = await astraApiCall(ssh, "/scan/", "POST", payload, 30000);
      if (result.data?.status && result.data.status !== "Failed") {
        await logAdminAction({ adminId: ctx.user.id, adminEmail: ctx.user.email || undefined, adminRole: ctx.user.role || "user", action: "security.astra_start_scan", category: "security", details: { appname: input.appname, url: input.url }, ipAddress: ctx.req?.ip || "unknown" });
        return { success: true, scanId: result.data.status, message: `Scan started for ${input.url}` };
      }
      throw new TRPCError({ code: "BAD_REQUEST", message: "Failed to start scan — ensure Astra is running and the target URL is reachable" });
    }),

  // ── Scan: List all scan IDs ───────────────────────────────────
  listScans: protectedProcedure.query(async ({ ctx }) => {
    const plan = await getUserPlan(ctx.user.id);
    enforceFeature(plan.planId, "security_tools", "Astra");
    const ssh = await getSshConfig(ctx.user.id);
    const result = await astraApiCall(ssh, "/scan/scanids/", "GET", undefined, 15000);
    return { scans: Array.isArray(result.data) ? result.data : [], total: Array.isArray(result.data) ? result.data.length : 0 };
  }),

  // ── Scan: Get alerts/vulnerabilities for a scan ───────────────
  getAlerts: protectedProcedure
    .input(z.object({ scanId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const plan = await getUserPlan(ctx.user.id);
      enforceFeature(plan.planId, "security_tools", "Astra");
      const ssh = await getSshConfig(ctx.user.id);
      const result = await astraApiCall(ssh, `/alerts/${input.scanId}`, "GET", undefined, 15000);
      const alerts = Array.isArray(result.data) ? result.data : [];
      const bySeverity = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
      for (const a of alerts) {
        const impact = (a.impact || "").toLowerCase();
        if (impact.includes("critical")) bySeverity.critical++;
        else if (impact.includes("high")) bySeverity.high++;
        else if (impact.includes("medium")) bySeverity.medium++;
        else if (impact.includes("low")) bySeverity.low++;
        else bySeverity.info++;
      }
      return { alerts, total: alerts.length, bySeverity, scanId: input.scanId };
    }),

  // ── Scan: Start a Postman collection scan ─────────────────────
  startPostmanScan: protectedProcedure
    .input(z.object({
      collectionUrl: z.string().url().describe("Public URL of the Postman collection JSON"),
      appname: z.string().min(1).max(100),
      authHeader: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const plan = await getUserPlan(ctx.user.id);
      enforceFeature(plan.planId, "security_tools", "Astra");
      const ssh = await getSshConfig(ctx.user.id);
      const payload = { collection_url: input.collectionUrl, appname: input.appname, auth_header: input.authHeader || "" };
      const result = await astraApiCall(ssh, "/scan/postman/", "POST", payload, 30000);
      if (result.data?.status && result.data.status !== "Failed") {
        await logAdminAction({ adminId: ctx.user.id, adminEmail: ctx.user.email || undefined, adminRole: ctx.user.role || "user", action: "security.astra_postman_scan", category: "security", details: { appname: input.appname, collectionUrl: input.collectionUrl }, ipAddress: ctx.req?.ip || "unknown" });
        return { success: true, scanId: result.data.status, message: "Postman collection scan started" };
      }
      throw new TRPCError({ code: "BAD_REQUEST", message: "Failed to start Postman scan" });
    }),

  // ── Status: Check if Astra is running ─────────────────────────
  getStatus: protectedProcedure.query(async ({ ctx }) => {
    const plan = await getUserPlan(ctx.user.id);
    enforceFeature(plan.planId, "security_tools", "Astra");
    const ssh = await getSshConfig(ctx.user.id);
    const astraPort = ssh.astraPort || 8094;
    const statusCmd = [
      `curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:${astraPort}/ 2>/dev/null`,
      `pgrep -a -f 'python3.*api.py' 2>/dev/null | head -1`,
      `pgrep -a -f 'celery.*worker' 2>/dev/null | head -1`,
      `systemctl is-active rabbitmq-server 2>/dev/null || service rabbitmq-server status 2>/dev/null | grep -i running | head -1`,
    ].join(" && echo '---' && ");
    const raw = await execSSHCommand(ssh, statusCmd, 15000);
    const parts = raw.split("---").map(s => s.trim());
    const httpStatus = parts[0]?.trim();
    return {
      astraRunning: httpStatus === "200" || httpStatus === "302",
      apiProcess: parts[1] || null,
      celeryProcess: parts[2] || null,
      rabbitmqStatus: parts[3] || null,
      astraPort,
      host: ssh.host,
    };
  }),

  // ── Update: Pull latest Astra from GitHub ─────────────────────
  update: protectedProcedure.mutation(async ({ ctx }) => {
    const plan = await getUserPlan(ctx.user.id);
    enforceFeature(plan.planId, "security_tools", "Astra");
    const ssh = await getSshConfig(ctx.user.id);
    const output = await execSSHCommand(ssh, "cd /opt/Astra && git pull origin master 2>&1 && pip3 install -r requirements.txt 2>&1 | tail -5 && echo 'Update complete'", 120000);
    return { success: output.includes("Update complete"), output };
  }),
});
