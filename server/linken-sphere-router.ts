/**
 * Linken Sphere Backend Proxy Router
 *
 * Proxies all Linken Sphere API calls server-side to avoid CORS issues,
 * browser security restrictions, and expose a stable tRPC interface.
 *
 * Architecture:
 * - User stores their LS API port in userSecrets (secretType: "ls_api_port")
 * - All LS API calls go through this router (server → localhost:port)
 * - Credit deductions applied on session start / quick create
 * - Full session lifecycle management exposed via tRPC
 */
import { z } from "zod";
import { , router } from "./_core/trpc";
import { getDb } from "./db";
import { TRPCError } from "@trpc/server";
import { enforceAdminFeature } from "./subscription-gate";
import { and, eq } from "drizzle-orm";
import { userSecrets } from "../drizzle/schema";
import { createLogger } from "./_core/logger.js";
import { consumeCredits, checkCredits } from "./credit-service";

const log = createLogger("LinkenSphereRouter");

const LS_PORT_SECRET_TYPE = "ls_api_port";
const DEFAULT_LS_PORT = 40080;

// ─── LS API Helper ────────────────────────────────────────────────────────────

async function lsRequest(
  port: number,
  method: string,
  path: string,
  body?: unknown
): Promise<unknown> {
  const url = `http://127.0.0.1:${port}${path}`;
  const opts: RequestInit = {
    method,
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(10_000),
  };
  if (body) opts.body = JSON.stringify(body);
  let resp: Response;
  try {
    resp = await fetch(url, opts);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new TRPCError({
      code: "BAD_GATEWAY",
      message: `Cannot reach Linken Sphere at port ${port}: ${msg}. Make sure Linken Sphere is running and the port is correct.`,
    });
  }
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new TRPCError({
      code: "BAD_GATEWAY",
      message: `Linken Sphere API error ${resp.status}: ${text || resp.statusText}`,
    });
  }
  const text = await resp.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

// ─── Port storage helpers ─────────────────────────────────────────────────────

async function getLsPort(userId: number): Promise<number> {
  const db = await getDb();
  if (!db) return DEFAULT_LS_PORT;
  const rows = await db
    .select({ encryptedValue: userSecrets.encryptedValue })
    .from(userSecrets)
    .where(and(eq(userSecrets.userId, userId), eq(userSecrets.secretType, LS_PORT_SECRET_TYPE)));
  if (!rows.length) return DEFAULT_LS_PORT;
  const port = parseInt(rows[0].encryptedValue, 10);
  return isNaN(port) ? DEFAULT_LS_PORT : port;
}

async function saveLsPort(userId: number, port: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
  const existing = await db
    .select({ id: userSecrets.id })
    .from(userSecrets)
    .where(and(eq(userSecrets.userId, userId), eq(userSecrets.secretType, LS_PORT_SECRET_TYPE)));
  if (existing.length) {
    await db
      .update(userSecrets)
      .set({ encryptedValue: String(port) })
      .where(eq(userSecrets.id, existing[0].id));
  } else {
    await db.insert(userSecrets).values({
      userId,
      secretType: LS_PORT_SECRET_TYPE,
      encryptedValue: String(port),
      label: "Linken Sphere API Port",
    });
  }
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const linkenSphereRouter = router({
  /**
   * Save the Linken Sphere API port for this user.
   */
  savePort: adminProcedure
    .input(z.object({ port: z.number().int().min(1024).max(65535) }))
    .mutation(async ({ input, ctx }) => {
    enforceAdminFeature(ctx.user.role, "Linken Sphere");
      await saveLsPort(ctx.user.id, input.port);
      log.info(`[savePort] User ${ctx.user.id} saved LS port ${input.port}`);
      return { success: true, port: input.port };
    }),

  /**
   * Get the saved port for this user.
   */
  getPort: adminProcedure.query(async ({ ctx }) => {
    enforceAdminFeature(ctx.user.role, "Linken Sphere");
    const port = await getLsPort(ctx.user.id);
    return { port };
  }),

  /**
   * Test connectivity to Linken Sphere.
   */
  testConnection: adminProcedure
    .input(z.object({ port: z.number().int().min(1024).max(65535).optional() }))
    .mutation(async ({ input, ctx }) => {
    enforceAdminFeature(ctx.user.role, "Linken Sphere");
      const port = input.port ?? (await getLsPort(ctx.user.id));
      const result = await lsRequest(port, "GET", "/app") as Record<string, unknown>;
      log.info(`[testConnection] User ${ctx.user.id} connected to LS at port ${port}`);
      return {
        success: true,
        port,
        version: result.version as string | undefined,
        build: result.build as string | undefined,
        appInfo: result,
      };
    }),

  /**
   * Sign in to Linken Sphere.
   */
  signIn: adminProcedure
    .input(z.object({
      port: z.number().int().min(1024).max(65535).optional(),
      email: z.string().email(),
      password: z.string().min(1),
      autologin: z.boolean().optional().default(true),
    }))
    .mutation(async ({ input, ctx }) => {
    enforceAdminFeature(ctx.user.role, "Linken Sphere");
      const port = input.port ?? (await getLsPort(ctx.user.id));
      const result = await lsRequest(port, "POST", "/auth/signin", {
        email: input.email,
        password: input.password,
        autologin: input.autologin,
      });
      log.info(`[signIn] User ${ctx.user.id} signed in to LS`);
      return result;
    }),

  /**
   * Sign out of Linken Sphere.
   */
  signOut: adminProcedure
    .input(z.object({ port: z.number().int().min(1024).max(65535).optional() }))
    .mutation(async ({ input, ctx }) => {
    enforceAdminFeature(ctx.user.role, "Linken Sphere");
      const port = input.port ?? (await getLsPort(ctx.user.id));
      const result = await lsRequest(port, "POST", "/auth/signout");
      log.info(`[signOut] User ${ctx.user.id} signed out of LS`);
      return result;
    }),

  /**
   * List all sessions.
   */
  getSessions: adminProcedure
    .input(z.object({
      port: z.number().int().min(1024).max(65535).optional(),
      status: z.string().optional(),
      proxyInfo: z.boolean().optional().default(false),
    }))
    .query(async ({ input, ctx }) => {
    enforceAdminFeature(ctx.user.role, "Linken Sphere");
      const port = input.port ?? (await getLsPort(ctx.user.id));
      const body: Record<string, unknown> = {};
      if (input.status) body.status = input.status;
      if (input.proxyInfo) body.proxy_info = true;
      const result = await lsRequest(
        port,
        "GET",
        "/sessions",
        Object.keys(body).length ? body : undefined
      );
      return result;
    }),

  /**
   * Get a single session by UUID.
   */
  getSession: adminProcedure
    .input(z.object({
      port: z.number().int().min(1024).max(65535).optional(),
      uuid: z.string().min(1),
    }))
    .query(async ({ input, ctx }) => {
    enforceAdminFeature(ctx.user.role, "Linken Sphere");
      const port = input.port ?? (await getLsPort(ctx.user.id));
      return lsRequest(port, "GET", `/sessions/${input.uuid}`);
    }),

  /**
   * Create quick sessions.
   * Deducts credits: linken_quick_create per session.
   */
  createQuickSessions: adminProcedure
    .input(z.object({
      port: z.number().int().min(1024).max(65535).optional(),
      count: z.number().int().min(1).max(50).default(1),
    }))
    .mutation(async ({ input, ctx }) => {
    enforceAdminFeature(ctx.user.role, "Linken Sphere");
      const port = input.port ?? (await getLsPort(ctx.user.id));
      const creditCheck = await checkCredits(ctx.user.id, "linken_quick_create");
      if (!creditCheck.allowed) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: `Insufficient credits. Need ${25 * input.count} credits to create ${input.count} session(s). You have ${creditCheck.currentBalance}.`,
        });
      }
      const result = await lsRequest(port, "POST", "/sessions/create_quick", { count: input.count });
      await consumeCredits(ctx.user.id, "linken_quick_create", `Created ${input.count} Linken Sphere quick session(s)`);
      log.info(`[createQuickSessions] User ${ctx.user.id} created ${input.count} LS sessions`);
      return result;
    }),

  /**
   * Start a session.
   * Deducts credits: linken_session_start.
   */
  startSession: adminProcedure
    .input(z.object({
      port: z.number().int().min(1024).max(65535).optional(),
      uuid: z.string().min(1),
      headless: z.boolean().optional().default(false),
      debugPort: z.number().int().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
    enforceAdminFeature(ctx.user.role, "Linken Sphere");
      const port = input.port ?? (await getLsPort(ctx.user.id));
      const creditCheck = await checkCredits(ctx.user.id, "linken_session_start");
      if (!creditCheck.allowed) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: `Insufficient credits. Need 50 credits to start a Linken Sphere session. You have ${creditCheck.currentBalance}.`,
        });
      }
      const body: Record<string, unknown> = { uuid: input.uuid, headless: input.headless };
      if (input.debugPort) body.debug_port = input.debugPort;
      const result = await lsRequest(port, "POST", "/sessions/start", body);
      await consumeCredits(ctx.user.id, "linken_session_start", `Started Linken Sphere session ${input.uuid}`);
      log.info(`[startSession] User ${ctx.user.id} started LS session ${input.uuid}`);
      return result;
    }),

  /**
   * Stop a session.
   */
  stopSession: adminProcedure
    .input(z.object({
      port: z.number().int().min(1024).max(65535).optional(),
      uuid: z.string().min(1),
    }))
    .mutation(async ({ input, ctx }) => {
    enforceAdminFeature(ctx.user.role, "Linken Sphere");
      const port = input.port ?? (await getLsPort(ctx.user.id));
      const result = await lsRequest(port, "POST", "/sessions/stop", { uuid: input.uuid });
      log.info(`[stopSession] User ${ctx.user.id} stopped LS session ${input.uuid}`);
      return result;
    }),

  /**
   * Rename a session.
   */
  setSessionName: adminProcedure
    .input(z.object({
      port: z.number().int().min(1024).max(65535).optional(),
      uuid: z.string().min(1),
      name: z.string().min(1).max(100),
    }))
    .mutation(async ({ input, ctx }) => {
    enforceAdminFeature(ctx.user.role, "Linken Sphere");
      const port = input.port ?? (await getLsPort(ctx.user.id));
      const result = await lsRequest(port, "POST", "/sessions/set_name", {
        uuid: input.uuid,
        name: input.name,
      });
      log.info(`[setSessionName] User ${ctx.user.id} renamed LS session ${input.uuid} to "${input.name}"`);
      return result;
    }),

  /**
   * Get all providers.
   */
  getProviders: adminProcedure
    .input(z.object({ port: z.number().int().min(1024).max(65535).optional() }))
    .query(async ({ input, ctx }) => {
    enforceAdminFeature(ctx.user.role, "Linken Sphere");
      const port = input.port ?? (await getLsPort(ctx.user.id));
      return lsRequest(port, "GET", "/providers");
    }),

  /**
   * Get all desktops.
   */
  getDesktops: adminProcedure
    .input(z.object({ port: z.number().int().min(1024).max(65535).optional() }))
    .query(async ({ input, ctx }) => {
    enforceAdminFeature(ctx.user.role, "Linken Sphere");
      const port = input.port ?? (await getLsPort(ctx.user.id));
      return lsRequest(port, "GET", "/desktops");
    }),

  /**
   * Get app info (version, build, etc.).
   */
  getAppInfo: adminProcedure
    .input(z.object({ port: z.number().int().min(1024).max(65535).optional() }))
    .query(async ({ input, ctx }) => {
    enforceAdminFeature(ctx.user.role, "Linken Sphere");
      const port = input.port ?? (await getLsPort(ctx.user.id));
      return lsRequest(port, "GET", "/app");
    }),
});
