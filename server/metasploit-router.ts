/**
 * Metasploit Router — Backend tRPC endpoints for managing Metasploit
 * Framework via SSH. Titan-tier exclusive feature.
 *
 * Supports:
 * - msfrpcd (Metasploit RPC daemon) management
 * - msfconsole command execution
 * - Module search and info
 * - Session management
 * - Workspace management
 * - Payload generation (msfvenom)
 *
 * Reference: https://docs.metasploit.com/
 * All operations execute on the user's configured VPS via SSH.
 * Credentials are AES-256 encrypted at rest.
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
import { consumeCredits } from "./credit-service";
import { logAdminAction } from "./admin-activity-log";

// ─── SSH Execution Helper ─────────────────────────────────────────
interface SSHConfig {
  host: string;
  port: number;
  username: string;
  password?: string;
  privateKey?: string;
}

async function execSSHCommand(
  ssh: SSHConfig,
  command: string,
  timeoutMs = 20000
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
        conn.exec(command, (err: Error | undefined, stream: import('ssh2').ClientChannel) => {
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
      .on("error", (err: Error) => {
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

// ─── Helper: Get SSH Config ───────────────────────────────────────
async function getSshConfig(userId: number) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
  const result = await db
    .select()
    .from(userSecrets)
    .where(and(eq(userSecrets.userId, userId), eq(userSecrets.secretType, "__metasploit_ssh")))
    .limit(1);
  if (result.length === 0) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "No Metasploit server configured. Please set up your SSH connection first.",
    });
  }
  return JSON.parse(decrypt(result[0].encryptedValue)) as SSHConfig;
}

// ─── Execute msfconsole command ───────────────────────────────────
async function execMsfConsole(ssh: SSHConfig, command: string, timeoutMs = 30000): Promise<string> {
  // Run a single msfconsole command non-interactively using -x flag
  const safeCmd = command.replace(/'/g, "'\\''");
  const msfCmd = `msfconsole -q -x '${safeCmd}; exit' 2>/dev/null`;
  return execSSHCommand(ssh, msfCmd, timeoutMs);
}

// ─── Router ───────────────────────────────────────────────────────
export const metasploitRouter = router({
  /**
   * Test SSH connection to the Metasploit server
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
      enforceFeature(plan.planId, "offensive_tooling", "Metasploit");
      try {
        const result = await execSSHCommand(
          input,
          "which msfconsole 2>/dev/null && msfconsole --version 2>/dev/null || echo 'Metasploit not installed'",
          10000
        );
        const installed = result.includes("metasploit") || result.includes("Framework");
        return {
          success: true,
          message: installed ? "Connected — Metasploit Framework detected" : "Connected — Metasploit not yet installed",
          installed,
          version: result.includes("Framework") ? result.split("\n").find(l => l.includes("Framework")) || "" : "",
          raw: result,
        };
      } catch (err: any) {
        return { success: false, message: err.message || "Connection failed", installed: false, version: "" };
      }
    }),

  /**
   * Save SSH connection details for the user's Metasploit server
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
      enforceFeature(plan.planId, "offensive_tooling", "Metasploit");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const configJson = encrypt(JSON.stringify(input));
      const existing = await db
        .select()
        .from(userSecrets)
        .where(and(eq(userSecrets.userId, ctx.user.id), eq(userSecrets.secretType, "__metasploit_ssh")))
        .limit(1);
      if (existing.length > 0) {
        await db
          .update(userSecrets)
          .set({ encryptedValue: configJson, updatedAt: new Date() })
          .where(eq(userSecrets.id, existing[0].id));
      } else {
        await db.insert(userSecrets).values({
          userId: ctx.user.id,
          secretType: "__metasploit_ssh",
          label: "Metasploit SSH Config",
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
    enforceFeature(plan.planId, "offensive_tooling", "Metasploit");
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const result = await db
      .select()
      .from(userSecrets)
      .where(and(eq(userSecrets.userId, ctx.user.id), eq(userSecrets.secretType, "__metasploit_ssh")))
      .limit(1);
    if (result.length === 0) return null;
    const config = JSON.parse(decrypt(result[0].encryptedValue)) as SSHConfig;
    return {
      host: config.host,
      port: config.port,
      username: config.username,
      hasPassword: !!config.password,
      hasKey: !!config.privateKey,
    };
  }),

  /**
   * Install Metasploit Framework on the server
   */
  install: protectedProcedure.mutation(async ({ ctx }) => {
    const plan = await getUserPlan(ctx.user.id);
    enforceFeature(plan.planId, "offensive_tooling", "Metasploit");
    const sshConfig = await getSshConfig(ctx.user.id);
    // Official Metasploit installer from rapid7
    const installScript = [
      "apt-get update -qq",
      "apt-get install -y curl gnupg 2>/dev/null",
      "curl -fsSL https://apt.metasploit.com/metasploit-framework.gpg | apt-key add - 2>/dev/null",
      "echo 'deb https://apt.metasploit.com/ buster main' > /etc/apt/sources.list.d/metasploit-framework.list",
      "apt-get update -qq",
      "apt-get install -y metasploit-framework 2>&1",
      "msfdb init 2>&1",
      "echo 'Metasploit Framework installed successfully'",
    ].join(" && ");
    const output = await execSSHCommand(sshConfig, installScript, 120000);
    return { success: true, output };
  }),

  /**
   * Get Metasploit version and status
   */
  getStatus: protectedProcedure.mutation(async ({ ctx }) => {
    const plan = await getUserPlan(ctx.user.id);
    enforceFeature(plan.planId, "offensive_tooling", "Metasploit");
    const sshConfig = await getSshConfig(ctx.user.id);
    const output = await execSSHCommand(
      sshConfig,
      "msfconsole --version 2>/dev/null; msfdb status 2>/dev/null; ps aux | grep -c '[m]sfconsole' || echo 0",
      15000
    );
    const lines = output.split("\n").filter(Boolean);
    const versionLine = lines.find(l => l.includes("Framework")) || "";
    const dbStatus = lines.find(l => l.includes("connected") || l.includes("not connected")) || "unknown";
    const activeSessions = parseInt(lines[lines.length - 1] || "0");
    return {
      version: versionLine,
      dbStatus,
      activeSessions,
      raw: output,
    };
  }),

  /**
   * Search for Metasploit modules
   */
  searchModules: protectedProcedure
    .input(
      z.object({
        query: z.string().min(1).max(100),
        type: z.enum(["exploit", "auxiliary", "post", "payload", "encoder", "nop", "all"]).default("all"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const plan = await getUserPlan(ctx.user.id);
      enforceFeature(plan.planId, "offensive_tooling", "Metasploit");
      const sshConfig = await getSshConfig(ctx.user.id);
      const typeFilter = input.type !== "all" ? ` type:${input.type}` : "";
      const output = await execMsfConsole(
        sshConfig,
        `search ${input.query}${typeFilter}`,
        30000
      );
      // Parse module list from output
      const modules = output
        .split("\n")
        .filter(line => line.match(/^\s+\d+\s+/))
        .map(line => {
          const parts = line.trim().split(/\s{2,}/);
          return {
            rank: parts[0] || "",
            name: parts[1] || "",
            disclosure: parts[2] || "",
            check: parts[3] || "",
            description: parts[4] || "",
          };
        })
        .filter(m => m.name);
      return { modules, raw: output };
    }),

  /**
   * Get detailed info about a specific module
   */
  getModuleInfo: protectedProcedure
    .input(z.object({ module: z.string().min(1).max(200) }))
    .mutation(async ({ ctx, input }) => {
      const plan = await getUserPlan(ctx.user.id);
      enforceFeature(plan.planId, "offensive_tooling", "Metasploit");
      const sshConfig = await getSshConfig(ctx.user.id);
      const output = await execMsfConsole(
        sshConfig,
        `use ${input.module}; info`,
        30000
      );
      return { output };
    }),

  /**
   * List active sessions
   */
  listSessions: protectedProcedure.mutation(async ({ ctx }) => {
    const plan = await getUserPlan(ctx.user.id);
    enforceFeature(plan.planId, "offensive_tooling", "Metasploit");
    const sshConfig = await getSshConfig(ctx.user.id);
    const output = await execMsfConsole(sshConfig, "sessions -l", 20000);
    // Parse sessions from output
    const sessions = output
      .split("\n")
      .filter(line => line.match(/^\s+\d+\s+/))
      .map(line => {
        const parts = line.trim().split(/\s{2,}/);
        return {
          id: parts[0] || "",
          type: parts[1] || "",
          info: parts[2] || "",
          connection: parts[3] || "",
        };
      })
      .filter(s => s.id);
    return { sessions, raw: output };
  }),

  /**
   * Interact with a session (run a command)
   */
  sessionCommand: protectedProcedure
    .input(
      z.object({
        sessionId: z.number().int().positive(),
        command: z.string().min(1).max(500),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const plan = await getUserPlan(ctx.user.id);
      enforceFeature(plan.planId, "offensive_tooling", "Metasploit");
      const sshConfig = await getSshConfig(ctx.user.id);
      const output = await execMsfConsole(
        sshConfig,
        `sessions -i ${input.sessionId}; ${input.command}`,
        30000
      );
      return { output };
    }),

  /**
   * Kill a session
   */
  killSession: protectedProcedure
    .input(z.object({ sessionId: z.union([z.number(), z.literal("all")]) }))
    .mutation(async ({ ctx, input }) => {
      const plan = await getUserPlan(ctx.user.id);
      enforceFeature(plan.planId, "offensive_tooling", "Metasploit");
      const sshConfig = await getSshConfig(ctx.user.id);
      const output = await execMsfConsole(
        sshConfig,
        `sessions -k ${input.sessionId}`,
        15000
      );
      return { output };
    }),

  /**
   * Run a module with options
   */
  runModule: protectedProcedure
    .input(
      z.object({
        module: z.string().min(1).max(200),
        options: z.record(z.string(), z.string()).default({}),
        payload: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const plan = await getUserPlan(ctx.user.id);
      enforceFeature(plan.planId, "offensive_tooling", "Metasploit");
      const sshConfig = await getSshConfig(ctx.user.id);
      const setCommands = Object.entries(input.options)
        .map(([key, val]) => `set ${key} ${val}`)
        .join("; ");
      const payloadCmd = input.payload ? `; set PAYLOAD ${input.payload}` : "";
      const cmd = `use ${input.module}; ${setCommands}${payloadCmd}; run`;
      const output = await execMsfConsole(sshConfig, cmd, 60000);
      await consumeCredits(ctx.user.id, "metasploit_action", `Metasploit run: ${input.module}`);
      await logAdminAction({
        adminId: ctx.user.id,
        adminEmail: ctx.user.email || undefined,
        adminRole: ctx.user.role || "user",
        action: "specialised.metasploit_run_module",
        category: "specialised_tools",
        details: { module: input.module, payload: input.payload },
        ipAddress: ctx.req?.ip || "unknown",
      });
      return { output };
    }),

  /**
   * Generate a payload using msfvenom
   */
  generatePayload: protectedProcedure
    .input(
      z.object({
        payload: z.string().min(1),
        lhost: z.string().min(1),
        lport: z.number().default(4444),
        format: z.enum(["exe", "elf", "macho", "raw", "python", "ruby", "bash", "powershell", "asp", "aspx", "jsp", "php", "war"]).default("exe"),
        encoder: z.string().optional(),
        iterations: z.number().default(1),
        outputPath: z.string().default("/tmp/payload"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const plan = await getUserPlan(ctx.user.id);
      enforceFeature(plan.planId, "offensive_tooling", "Metasploit");
      const sshConfig = await getSshConfig(ctx.user.id);
      const encoderFlag = input.encoder ? `-e ${input.encoder} -i ${input.iterations}` : "";
      const outputFile = `${input.outputPath}.${input.format}`;
      const cmd = `msfvenom -p ${input.payload} LHOST=${input.lhost} LPORT=${input.lport} -f ${input.format} ${encoderFlag} -o ${outputFile} 2>&1 && echo "Payload saved to ${outputFile}"`;
      const output = await execSSHCommand(sshConfig, cmd, 30000);
      await consumeCredits(ctx.user.id, "metasploit_action", `Metasploit payload: ${input.payload}`);
      await logAdminAction({
        adminId: ctx.user.id,
        adminEmail: ctx.user.email || undefined,
        adminRole: ctx.user.role || "user",
        action: "specialised.metasploit_generate_payload",
        category: "specialised_tools",
        details: { payload: input.payload, format: input.format, lhost: input.lhost, lport: input.lport },
        ipAddress: ctx.req?.ip || "unknown",
      });
      return { output, outputFile };
    }),

  /**
   * List workspaces
   */
  listWorkspaces: protectedProcedure.mutation(async ({ ctx }) => {
    const plan = await getUserPlan(ctx.user.id);
    enforceFeature(plan.planId, "offensive_tooling", "Metasploit");
    const sshConfig = await getSshConfig(ctx.user.id);
    const output = await execMsfConsole(sshConfig, "workspace", 15000);
    const workspaces = output
      .split("\n")
      .filter(line => line.trim() && !line.includes("Workspaces"))
      .map(line => ({
        name: line.replace("*", "").trim(),
        active: line.includes("*"),
      }))
      .filter(w => w.name);
    return { workspaces, raw: output };
  }),

  /**
   * Create or switch workspace
   */
  setWorkspace: protectedProcedure
    .input(z.object({ name: z.string().min(1).max(50) }))
    .mutation(async ({ ctx, input }) => {
      const plan = await getUserPlan(ctx.user.id);
      enforceFeature(plan.planId, "offensive_tooling", "Metasploit");
      const sshConfig = await getSshConfig(ctx.user.id);
      const output = await execMsfConsole(sshConfig, `workspace -a ${input.name}; workspace ${input.name}`, 15000);
      return { output };
    }),

  /**
   * List hosts discovered in the current workspace
   */
  listHosts: protectedProcedure.mutation(async ({ ctx }) => {
    const plan = await getUserPlan(ctx.user.id);
    enforceFeature(plan.planId, "offensive_tooling", "Metasploit");
    const sshConfig = await getSshConfig(ctx.user.id);
    const output = await execMsfConsole(sshConfig, "hosts", 15000);
    return { output };
  }),

  /**
   * List services discovered in the current workspace
   */
  listServices: protectedProcedure.mutation(async ({ ctx }) => {
    const plan = await getUserPlan(ctx.user.id);
    enforceFeature(plan.planId, "offensive_tooling", "Metasploit");
    const sshConfig = await getSshConfig(ctx.user.id);
    const output = await execMsfConsole(sshConfig, "services", 15000);
    return { output };
  }),

  /**
   * List vulnerabilities in the current workspace
   */
  listVulns: protectedProcedure.mutation(async ({ ctx }) => {
    const plan = await getUserPlan(ctx.user.id);
    enforceFeature(plan.planId, "offensive_tooling", "Metasploit");
    const sshConfig = await getSshConfig(ctx.user.id);
    const output = await execMsfConsole(sshConfig, "vulns", 15000);
    return { output };
  }),

  /**
   * Run a raw msfconsole command
   */
  runCommand: protectedProcedure
    .input(z.object({ command: z.string().min(1).max(1000) }))
    .mutation(async ({ ctx, input }) => {
      const plan = await getUserPlan(ctx.user.id);
      enforceFeature(plan.planId, "offensive_tooling", "Metasploit");
      const sshConfig = await getSshConfig(ctx.user.id);
      const output = await execMsfConsole(sshConfig, input.command, 30000);
      return { output };
    }),

  /**
   * Start msfrpcd (Metasploit RPC daemon) for API access
   */
  startRpcd: protectedProcedure
    .input(
      z.object({
        rpcPassword: z.string().min(8),
        rpcPort: z.number().default(55553),
        ssl: z.boolean().default(true),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const plan = await getUserPlan(ctx.user.id);
      enforceFeature(plan.planId, "offensive_tooling", "Metasploit");
      const sshConfig = await getSshConfig(ctx.user.id);
      const sslFlag = input.ssl ? "-S" : "";
      const cmd = `pkill -f msfrpcd 2>/dev/null; sleep 1; nohup msfrpcd -P '${input.rpcPassword}' -p ${input.rpcPort} ${sslFlag} -a 0.0.0.0 > /tmp/msfrpcd.log 2>&1 &`;
      await execSSHCommand(sshConfig, cmd, 10000);
      return {
        success: true,
        rpcPort: input.rpcPort,
        ssl: input.ssl,
        message: `msfrpcd started on port ${input.rpcPort}`,
      };
    }),

  /**
   * Stop msfrpcd
   */
  stopRpcd: protectedProcedure.mutation(async ({ ctx }) => {
    const plan = await getUserPlan(ctx.user.id);
    enforceFeature(plan.planId, "offensive_tooling", "Metasploit");
    const sshConfig = await getSshConfig(ctx.user.id);
    const output = await execSSHCommand(sshConfig, "pkill -f msfrpcd 2>/dev/null; echo 'Stopped'", 10000);
    return { success: true, output };
  }),

  /**
   * Update Metasploit Framework to latest version
   */
  update: protectedProcedure.mutation(async ({ ctx }) => {
    const plan = await getUserPlan(ctx.user.id);
    enforceFeature(plan.planId, "offensive_tooling", "Metasploit");
    const sshConfig = await getSshConfig(ctx.user.id);
    const output = await execSSHCommand(
      sshConfig,
      "apt-get update -qq && apt-get install -y --only-upgrade metasploit-framework 2>&1 && echo 'Metasploit updated'",
      120000
    );
    return { success: true, output };
  }),
});
