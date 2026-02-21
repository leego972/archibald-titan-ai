import crypto from "crypto";
import { z } from "zod";
import { eq, and, sql, desc, gte } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { sdk } from "./_core/sdk";
import {
  downloadTokens,
  downloadAuditLog,
  releases,
  users,
} from "../drizzle/schema";
import { COOKIE_NAME } from "../shared/const";
import { parse as parseCookieHeader } from "cookie";
import type { Express, Request, Response } from "express";

// ─── Constants ─────────────────────────────────────────────────────

const TOKEN_EXPIRY_MINUTES = 15; // Tokens expire after 15 minutes
const MAX_DOWNLOADS_PER_HOUR = 10; // Rate limit per user
const TOKEN_BYTES = 32; // 256-bit token

// ─── Token Generation ──────────────────────────────────────────────

function generateSecureToken(): string {
  return crypto.randomBytes(TOKEN_BYTES).toString("hex");
}

// ─── Rate Limiting ─────────────────────────────────────────────────

async function checkRateLimit(userId: number): Promise<{
  allowed: boolean;
  remaining: number;
  resetAt: Date;
}> {
  const db = await getDb();
  if (!db) return { allowed: true, remaining: MAX_DOWNLOADS_PER_HOUR, resetAt: new Date() };

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  const [result] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(downloadAuditLog)
    .where(
      and(
        eq(downloadAuditLog.userId, userId),
        gte(downloadAuditLog.downloadedAt, oneHourAgo)
      )
    );

  const count = result?.count ?? 0;
  const remaining = Math.max(0, MAX_DOWNLOADS_PER_HOUR - count);
  const resetAt = new Date(Date.now() + 60 * 60 * 1000);

  return {
    allowed: count < MAX_DOWNLOADS_PER_HOUR,
    remaining,
    resetAt,
  };
}

// ─── Audit Logging ─────────────────────────────────────────────────

async function logDownload(params: {
  userId: number;
  userEmail: string | null;
  userName: string | null;
  releaseId: number;
  releaseVersion: string;
  platform: "windows" | "mac" | "linux";
  tokenId: number | null;
  ipAddress: string | null;
  userAgent: string | null;
  status: "initiated" | "completed" | "expired" | "revoked" | "rate_limited";
}) {
  const db = await getDb();
  if (!db) return;

  await db.insert(downloadAuditLog).values({
    userId: params.userId,
    userEmail: params.userEmail,
    userName: params.userName,
    releaseId: params.releaseId,
    releaseVersion: params.releaseVersion,
    platform: params.platform,
    tokenId: params.tokenId,
    ipAddress: params.ipAddress,
    userAgent: params.userAgent,
    status: params.status,
  });
}

// ─── tRPC Router ───────────────────────────────────────────────────

export const downloadRouter = router({
  /**
   * Request a download token — requires authentication.
   * Returns a time-limited token that can be exchanged for the actual download URL.
   */
  requestToken: protectedProcedure
    .input(
      z.object({
        releaseId: z.number(),
        platform: z.enum(["windows", "mac", "linux"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database unavailable",
        });
      }

      // Rate limit check
      const rateLimit = await checkRateLimit(ctx.user.id);
      if (!rateLimit.allowed) {
        await logDownload({
          userId: ctx.user.id,
          userEmail: ctx.user.email ?? null,
          userName: ctx.user.name ?? null,
          releaseId: input.releaseId,
          releaseVersion: "unknown",
          platform: input.platform,
          tokenId: null,
          ipAddress: ctx.req.ip ?? ctx.req.headers["x-forwarded-for"]?.toString() ?? null,
          userAgent: ctx.req.headers["user-agent"] ?? null,
          status: "rate_limited",
        });

        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: `Download rate limit exceeded. You can download up to ${MAX_DOWNLOADS_PER_HOUR} times per hour. Try again after ${rateLimit.resetAt.toISOString()}.`,
        });
      }

      // Verify the release exists and get download URL
      let release;
      if (input.releaseId === 0) {
        // Seed release — no actual download URL
        release = null;
      } else {
        const [found] = await db
          .select()
          .from(releases)
          .where(eq(releases.id, input.releaseId))
          .limit(1);
        release = found ?? null;
      }

      // Get the download URL for the requested platform
      const downloadUrl = release
        ? input.platform === "windows"
          ? release.downloadUrlWindows
          : input.platform === "mac"
          ? release.downloadUrlMac
          : release.downloadUrlLinux
        : null;

      if (!downloadUrl) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `No download available for ${input.platform}. The installer for this platform hasn't been uploaded yet.`,
        });
      }

      // Generate secure token
      const token = generateSecureToken();
      const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_MINUTES * 60 * 1000);

      // Store token in database
      const [result] = await db.insert(downloadTokens).values({
        token,
        userId: ctx.user.id,
        releaseId: input.releaseId,
        platform: input.platform,
        expiresAt,
      });

      // Log the download initiation
      await logDownload({
        userId: ctx.user.id,
        userEmail: ctx.user.email ?? null,
        userName: ctx.user.name ?? null,
        releaseId: input.releaseId,
        releaseVersion: release?.version ?? "seed",
        platform: input.platform,
        tokenId: Number(result.insertId),
        ipAddress: ctx.req.ip ?? ctx.req.headers["x-forwarded-for"]?.toString() ?? null,
        userAgent: ctx.req.headers["user-agent"] ?? null,
        status: "initiated",
      });

      // Increment download count on the release
      if (input.releaseId > 0) {
        await db
          .update(releases)
          .set({ downloadCount: sql`${releases.downloadCount} + 1` })
          .where(eq(releases.id, input.releaseId));
      }

      return {
        token,
        expiresAt: expiresAt.toISOString(),
        expiresInSeconds: TOKEN_EXPIRY_MINUTES * 60,
      };
    }),

  /**
   * Get download status for the current user — shows rate limit info and recent downloads.
   */
  status: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) {
      return {
        rateLimit: {
          allowed: true,
          remaining: MAX_DOWNLOADS_PER_HOUR,
          limit: MAX_DOWNLOADS_PER_HOUR,
          resetAt: new Date().toISOString(),
        },
        recentDownloads: [],
      };
    }

    const rateLimit = await checkRateLimit(ctx.user.id);

    // Get recent downloads for this user
    const recent = await db
      .select()
      .from(downloadAuditLog)
      .where(eq(downloadAuditLog.userId, ctx.user.id))
      .orderBy(desc(downloadAuditLog.downloadedAt))
      .limit(10);

    return {
      rateLimit: {
        allowed: rateLimit.allowed,
        remaining: rateLimit.remaining,
        limit: MAX_DOWNLOADS_PER_HOUR,
        resetAt: rateLimit.resetAt.toISOString(),
      },
      recentDownloads: recent.map((d) => ({
        platform: d.platform,
        version: d.releaseVersion,
        status: d.status,
        downloadedAt: d.downloadedAt,
      })),
    };
  }),

  /**
   * Admin: view download audit log
   */
  auditLog: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
      }

      const db = await getDb();
      if (!db) return { logs: [], total: 0 };

      const limit = input?.limit ?? 50;
      const offset = input?.offset ?? 0;

      const [countResult] = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(downloadAuditLog);

      const logs = await db
        .select()
        .from(downloadAuditLog)
        .orderBy(desc(downloadAuditLog.downloadedAt))
        .limit(limit)
        .offset(offset);

      return {
        logs,
        total: countResult?.count ?? 0,
      };
    }),
});

// ─── Express Route: Token Validation & Download Redirect ───────────
// This is a direct Express route (not tRPC) because it needs to
// redirect the browser to the actual download URL.

export function registerDownloadRoute(app: Express) {
  app.get("/api/download/:token", async (req: Request, res: Response) => {
    const { token } = req.params;

    if (!token || token.length !== TOKEN_BYTES * 2) {
      return res.status(400).json({
        error: "Invalid download token format",
      });
    }

    const db = await getDb();
    if (!db) {
      return res.status(503).json({ error: "Service unavailable" });
    }

    // Look up the token
    const [tokenRecord] = await db
      .select()
      .from(downloadTokens)
      .where(eq(downloadTokens.token, token))
      .limit(1);

    if (!tokenRecord) {
      return res.status(404).json({
        error: "Download token not found. Please request a new download from the website.",
      });
    }

    // Check if token has been revoked
    if (tokenRecord.revokedAt) {
      return res.status(403).json({
        error: "This download token has been revoked.",
      });
    }

    // Check if token has expired
    if (new Date() > tokenRecord.expiresAt) {
      // Log the expired attempt
      await logDownload({
        userId: tokenRecord.userId,
        userEmail: null,
        userName: null,
        releaseId: tokenRecord.releaseId,
        releaseVersion: "unknown",
        platform: tokenRecord.platform,
        tokenId: tokenRecord.id,
        ipAddress: req.ip ?? req.headers["x-forwarded-for"]?.toString() ?? null,
        userAgent: req.headers["user-agent"] ?? null,
        status: "expired",
      });

      return res.status(410).json({
        error: "Download token has expired. Please request a new download from the website.",
        expiredAt: tokenRecord.expiresAt.toISOString(),
      });
    }

    // Check if token was already used (one-time use)
    if (tokenRecord.usedAt) {
      return res.status(409).json({
        error: "This download token has already been used. Please request a new download.",
        usedAt: tokenRecord.usedAt.toISOString(),
      });
    }

    // Get the release to find the download URL
    const [release] = await db
      .select()
      .from(releases)
      .where(eq(releases.id, tokenRecord.releaseId))
      .limit(1);

    if (!release) {
      return res.status(404).json({
        error: "Release not found.",
      });
    }

    const downloadUrl =
      tokenRecord.platform === "windows"
        ? release.downloadUrlWindows
        : tokenRecord.platform === "mac"
        ? release.downloadUrlMac
        : release.downloadUrlLinux;

    if (!downloadUrl) {
      return res.status(404).json({
        error: `No download available for ${tokenRecord.platform}.`,
      });
    }

    // Mark token as used
    await db
      .update(downloadTokens)
      .set({ usedAt: new Date() })
      .where(eq(downloadTokens.id, tokenRecord.id));

    // Log successful download
    await logDownload({
      userId: tokenRecord.userId,
      userEmail: null,
      userName: null,
      releaseId: tokenRecord.releaseId,
      releaseVersion: release.version,
      platform: tokenRecord.platform,
      tokenId: tokenRecord.id,
      ipAddress: req.ip ?? req.headers["x-forwarded-for"]?.toString() ?? null,
      userAgent: req.headers["user-agent"] ?? null,
      status: "completed",
    });

    // Redirect to the actual download URL
    return res.redirect(302, downloadUrl);
  });
}
