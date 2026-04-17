/**
 * API Access Router — Manage API keys and provide REST-style access to credentials.
 *
 * Enterprise-only feature. Users generate API keys with scoped permissions,
 * then use them via Bearer token to access credentials programmatically.
 */

import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "./db";
import { apiKeys } from "../drizzle/schema";
import { eq, and, isNull, desc, sql } from "drizzle-orm";
import { getUserPlan, enforceFeature } from "./subscription-gate";
import { getDecryptedCredentials, exportCredentials } from "./fetcher-db";
import { logAudit } from "./audit-log-db";
import crypto from "crypto";

// ─── Helpers ─────────────────────────────────────────────────────────

function generateApiKey(): { raw: string; prefix: string; hash: string } {
  const raw = `at_${crypto.randomBytes(32).toString("hex")}`;
  const prefix = raw.substring(0, 11); // "at_" + first 8 hex chars
  const hash = crypto.createHash("sha256").update(raw).digest("hex");
  return { raw, prefix, hash };
}

function hashKey(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

const AVAILABLE_SCOPES = [
  "credentials:read",
  "credentials:export",
  "jobs:read",
  "jobs:create",
  "totp:read",
  "totp:generate",
  "audit:read",
  "audit:export",
  // Titan AI public access — lets the user use the self-hosted Titan model
  // through this API key, OpenAI-compatible.
  "titan:chat",
] as const;

// ─── Validate API Key (for REST endpoints) ──────────────────────────

export async function validateApiKey(rawKey: string) {
  const db = await getDb();
  if (!db) return null;

  const keyHash = hashKey(rawKey);
  const results = await db
    .select()
    .from(apiKeys)
    .where(and(eq(apiKeys.keyHash, keyHash), isNull(apiKeys.revokedAt)))
    .limit(1);

  if (results.length === 0) return null;

  const key = results[0];

  // Check expiration
  if (key.expiresAt && key.expiresAt < new Date()) return null;

  // Update usage stats
  await db
    .update(apiKeys)
    .set({
      lastUsedAt: new Date(),
      usageCount: sql`${apiKeys.usageCount} + 1`,
    })
    .where(eq(apiKeys.id, key.id));

  return key;
}

// ─── tRPC Router ─────────────────────────────────────────────────────

export const apiAccessRouter = router({
  // List all API keys for the current user
  listKeys: protectedProcedure.query(async ({ ctx }) => {
    const plan = await getUserPlan(ctx.user.id);
    enforceFeature(plan.planId, "api_access", "API Access");

    const db = await getDb();
    if (!db) return [];

    const keys = await db
      .select({
        id: apiKeys.id,
        name: apiKeys.name,
        keyPrefix: apiKeys.keyPrefix,
        scopes: apiKeys.scopes,
        lastUsedAt: apiKeys.lastUsedAt,
        usageCount: apiKeys.usageCount,
        expiresAt: apiKeys.expiresAt,
        revokedAt: apiKeys.revokedAt,
        rateLimit: apiKeys.rateLimit,
        createdAt: apiKeys.createdAt,
      })
      .from(apiKeys)
      .where(eq(apiKeys.userId, ctx.user.id))
      .orderBy(desc(apiKeys.createdAt));

    return keys;
  }),

  // Create a new API key
  createKey: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(128),
        scopes: z.array(z.enum(AVAILABLE_SCOPES)).min(1),
        expiresInDays: z.number().min(1).max(365).optional(),
        rateLimit: z.number().min(1).max(10000).default(60).optional(), // requests per minute
      })
    )
    .mutation(async ({ ctx, input }) => {
      const plan = await getUserPlan(ctx.user.id);
      enforceFeature(plan.planId, "api_access", "API Access");

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      // Limit to 10 active keys
      const activeCount = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(apiKeys)
        .where(and(eq(apiKeys.userId, ctx.user.id), isNull(apiKeys.revokedAt)));

      if (activeCount[0].count >= 10) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Maximum of 10 active API keys allowed. Revoke an existing key first.",
        });
      }

      const { raw, prefix, hash } = generateApiKey();
      const expiresAt = input.expiresInDays
        ? new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000)
        : null;

      await db.insert(apiKeys).values({
        userId: ctx.user.id,
        name: input.name,
        keyPrefix: prefix,
        keyHash: hash,
        scopes: input.scopes,
        expiresAt,
        rateLimit: input.rateLimit ?? 60,
      });

      await logAudit({
        userId: ctx.user.id,
        userName: ctx.user.name || undefined,
        userEmail: ctx.user.email || undefined,
        action: "apiKey.create",
        resource: "apiKey",
        details: { name: input.name, scopes: input.scopes },
      });

      // Return the raw key ONLY on creation — it's never shown again
      return { key: raw, prefix, name: input.name };
    }),

  // Revoke an API key
  revokeKey: protectedProcedure
    .input(z.object({ keyId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const result = await db
        .update(apiKeys)
        .set({ revokedAt: new Date() })
        .where(and(eq(apiKeys.id, input.keyId), eq(apiKeys.userId, ctx.user.id)));

      await logAudit({
        userId: ctx.user.id,
        userName: ctx.user.name || undefined,
        userEmail: ctx.user.email || undefined,
        action: "apiKey.revoke",
        resource: "apiKey",
        resourceId: input.keyId.toString(),
      });

      return { success: true };
    }),

  // Get live rate limit stats for a specific key
  getRateLimitStats: protectedProcedure
    .input(z.object({ keyId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return null;

      const results = await db
        .select({ id: apiKeys.id, rateLimit: apiKeys.rateLimit })
        .from(apiKeys)
        .where(and(eq(apiKeys.id, input.keyId), eq(apiKeys.userId, ctx.user.id)))
        .limit(1);

      if (results.length === 0) return null;
      const key = results[0];

      const { getRateLimitStats } = await import("./api-rate-limiter");
      return getRateLimitStats(String(key.id), key.rateLimit);
    }),

  // Update the rate limit on an existing key
  updateRateLimit: protectedProcedure
    .input(z.object({ keyId: z.number(), rateLimit: z.number().min(1).max(10000) }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      await db
        .update(apiKeys)
        .set({ rateLimit: input.rateLimit })
        .where(and(eq(apiKeys.id, input.keyId), eq(apiKeys.userId, ctx.user.id)));

      await logAudit({
        userId: ctx.user.id,
        userName: ctx.user.name || undefined,
        userEmail: ctx.user.email || undefined,
        action: "apiKey.updateRateLimit",
        resource: "apiKey",
        resourceId: input.keyId.toString(),
        details: { rateLimit: input.rateLimit },
      });

      return { success: true };
    }),

  // Available scopes
  scopes: protectedProcedure.query(() => {
    return AVAILABLE_SCOPES.map((s) => ({
      id: s,
      label: s.replace(":", " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      description: {
        "credentials:read": "Read and list stored credentials",
        "credentials:export": "Export credentials in any format",
        "jobs:read": "View fetch job history and status",
        "jobs:create": "Create new fetch jobs",
        "totp:read": "List TOTP entries and view current codes",
        "totp:generate": "Generate fresh TOTP codes on demand",
        "audit:read": "View audit log entries",
        "audit:export": "Export audit logs as CSV",
      }[s],
    }));
  }),
});

// ─── Express REST Endpoints (for external API consumers) ─────────────

import { Express, Request, Response } from "express";
import { checkRateLimit } from "./api-rate-limiter";

export function registerApiRoutes(app: Express) {
  // Middleware to validate API key and enforce per-key rate limits
  const authenticateApiKey = async (req: Request, res: Response, next: Function) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Missing or invalid Authorization header. Use: Bearer <api_key>" });
    }

    const rawKey = authHeader.substring(7);
    const apiKey = await validateApiKey(rawKey);
    if (!apiKey) {
      return res.status(401).json({ error: "Invalid or expired API key" });
    }

    // ── Rate limiting: sliding window per API key ──────────────────
    const limitRpm = apiKey.rateLimit ?? 60;
    const rl = checkRateLimit(String(apiKey.id), limitRpm);

    // Always attach rate limit headers so clients can track usage
    res.setHeader("X-RateLimit-Limit", rl.limit);
    res.setHeader("X-RateLimit-Remaining", rl.remaining);
    res.setHeader("X-RateLimit-Reset", Math.ceil(rl.resetAt / 1000));

    if (!rl.allowed) {
      res.setHeader("Retry-After", Math.ceil(rl.retryAfterMs / 1000));
      return res.status(429).json({
        error: "Rate limit exceeded",
        message: `This API key allows ${limitRpm} requests per minute. Retry after ${Math.ceil(rl.retryAfterMs / 1000)} seconds.`,
        retryAfterSeconds: Math.ceil(rl.retryAfterMs / 1000),
        resetAt: new Date(rl.resetAt).toISOString(),
      });
    }

    (req as any).apiKeyUserId = apiKey.userId;
    (req as any).apiKeyScopes = apiKey.scopes;
    (req as any).apiKeyId = apiKey.id;
    next();
  };

  const requireScope = (scope: string) => (req: Request, res: Response, next: Function) => {
    const scopes = (req as any).apiKeyScopes as string[];
    if (!scopes.includes(scope)) {
      return res.status(403).json({ error: `Missing required scope: ${scope}` });
    }
    next();
  };

  // GET /api/v1/credentials
  app.get("/api/v1/credentials", authenticateApiKey, requireScope("credentials:read"), async (req, res) => {
    try {
      const userId = (req as any).apiKeyUserId;
      const creds = await getDecryptedCredentials(userId);
      res.json({
        data: creds.map((c) => ({
          id: c.id,
          provider: c.providerName,
          providerId: c.providerId,
          keyType: c.keyType,
          label: c.keyLabel,
          value: c.value,
          createdAt: c.createdAt,
        })),
        count: creds.length,
      });
    } catch (err) {
      res.status(500).json({ error: "Failed to retrieve credentials" });
    }
  });

  // GET /api/v1/credentials/export?format=json|env|csv
  app.get("/api/v1/credentials/export", authenticateApiKey, requireScope("credentials:export"), async (req, res) => {
    try {
      const userId = (req as any).apiKeyUserId;
      const format = (req.query.format as string) || "json";
      if (!["json", "env", "csv"].includes(format)) {
        return res.status(400).json({ error: "Invalid format. Use: json, env, or csv" });
      }

      const plan = await getUserPlan(userId);
      const allowedFormats = plan.tier.limits.exportFormats;
      if (!allowedFormats.includes(format)) {
        return res.status(403).json({ error: `${format.toUpperCase()} export not available on your plan` });
      }

      const data = await exportCredentials(userId, format as "json" | "env" | "csv");
      const contentType = format === "json" ? "application/json" : "text/plain";
      res.setHeader("Content-Type", contentType);
      res.send(data);
    } catch (err) {
      res.status(500).json({ error: "Failed to export credentials" });
    }
  });

  // ─── Titan AI public proxy — OpenAI-compatible /v1/chat/completions ──
  // Lets users plug Titan into their own apps the same way they use OpenAI:
  //   curl https://archibald.app/api/v1/chat/completions \
  //     -H "Authorization: Bearer at_<archibald-api-key>" \
  //     -H "Content-Type: application/json" \
  //     -d '{"model":"titan-tool-v01","messages":[...]}'
  // The Archibald API key is validated and rate-limited via authenticateApiKey,
  // then proxied to the self-hosted Titan inference API on Vast (TITAN_API_URL).
  app.post("/api/v1/chat/completions", authenticateApiKey, requireScope("titan:chat"), async (req, res) => {
    const titanUrl = process.env.TITAN_API_URL || "";
    const titanKey = process.env.TITAN_API_KEY || "";
    if (!titanUrl) {
      return res.status(503).json({
        error: { message: "Titan AI is not configured on this server (TITAN_API_URL missing).", type: "service_unavailable" },
      });
    }

    try {
      const upstream = await fetch(`${titanUrl.replace(/\/+$/, "")}/v1/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(titanKey ? { Authorization: `Bearer ${titanKey}` } : {}),
        },
        body: JSON.stringify(req.body ?? {}),
      });

      const text = await upstream.text();
      res.status(upstream.status);
      const ct = upstream.headers.get("content-type");
      if (ct) res.setHeader("Content-Type", ct);
      res.send(text);
    } catch (err: any) {
      res.status(502).json({
        error: {
          message: `Titan AI upstream error: ${err?.message || "unknown"}`,
          type: "bad_gateway",
        },
      });
    }
  });

  // GET /api/v1/models — OpenAI-compatible model list (only Titan models exposed)
  app.get("/api/v1/models", authenticateApiKey, requireScope("titan:chat"), async (_req, res) => {
    res.json({
      object: "list",
      data: [
        {
          id: "titan-tool-v01",
          object: "model",
          created: Math.floor(Date.now() / 1000),
          owned_by: "archibald",
        },
        {
          id: "titan-sft-v01",
          object: "model",
          created: Math.floor(Date.now() / 1000),
          owned_by: "archibald",
        },
      ],
    });
  });
}
