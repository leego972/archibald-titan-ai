/**
 * Titan Storage Router
 * tRPC procedures for per-user paid cloud storage.
 * Registered in routers.ts as `storage: storageRouter`
 */

import { z } from "zod";
import { eq, and, desc, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, adminProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import {
  storageSubscriptions,
  storageFiles,
  storageShareLinks,
  storageApiKeys,
} from "../drizzle/storage-schema";
import {
  STORAGE_PLANS,
  type StoragePlanId,
  getStorageSubscription,
  hasActiveStorageSubscription,
  getStorageQuota,
  listFiles,
  getDownloadUrl,
  deleteFile,
  createShareLink,
  createApiKey,
  formatBytes,
} from "./storage-service";
import { createLogger } from "./_core/logger.js";

const log = createLogger("StorageRouter");

export const storageRouter = router({

  // ── Subscription & Quota ──────────────────────────────────────────────

  /**
   * Get the current user's storage subscription and quota.
   */
  getSubscription: protectedProcedure.query(async ({ ctx }) => {
    const sub = await getStorageSubscription(ctx.user.id);
    if (!sub) return null;
    return {
      ...sub,
      plan_label: STORAGE_PLANS[sub.plan as StoragePlanId]?.label ?? sub.plan,
      used_formatted: formatBytes(sub.usedBytes),
      quota_formatted: formatBytes(sub.quotaBytes),
      available_bytes: Math.max(0, sub.quotaBytes - sub.usedBytes),
      usage_pct: sub.quotaBytes > 0 ? Math.round((sub.usedBytes / sub.quotaBytes) * 100) : 0,
    };
  }),

  /**
   * Get available storage plans.
   */
  getPlans: protectedProcedure.query(() => {
    return Object.entries(STORAGE_PLANS).map(([id, plan]) => ({
      id,
      ...plan,
    }));
  }),

  /**
   * Get storage usage statistics.
   */
  getStats: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

    const sub = await getStorageSubscription(ctx.user.id);
    if (!sub) return { has_subscription: false };

    // Usage by feature
    const byFeature = await db
      .select({
        feature: storageFiles.feature,
        file_count: sql<number>`COUNT(*)`,
        total_bytes: sql<number>`SUM(sizeBytes)`,
      })
      .from(storageFiles)
      .where(and(eq(storageFiles.userId, ctx.user.id), eq(storageFiles.isDeleted, false)))
      .groupBy(storageFiles.feature);

    return {
      has_subscription: true,
      used_bytes: sub.usedBytes,
      quota_bytes: sub.quotaBytes,
      available_bytes: Math.max(0, sub.quotaBytes - sub.usedBytes),
      usage_pct: sub.quotaBytes > 0 ? Math.round((sub.usedBytes / sub.quotaBytes) * 100) : 0,
      plan: sub.plan,
      status: sub.status,
      by_feature: byFeature,
    };
  }),

  // ── File Operations ───────────────────────────────────────────────────

  /**
   * List files for the current user.
   */
  listFiles: protectedProcedure
    .input(z.object({
      feature: z.enum(["vault", "builder", "fetcher", "scanner", "webhook", "export", "generic"]).optional(),
      limit: z.number().min(1).max(200).default(50),
      offset: z.number().min(0).default(0),
    }))
    .query(async ({ ctx, input }) => {
      const active = await hasActiveStorageSubscription(ctx.user.id);
      if (!active) throw new TRPCError({ code: "FORBIDDEN", message: "No active storage subscription." });

      const files = await listFiles(ctx.user.id, {
        feature: input.feature,
        limit: input.limit,
        offset: input.offset,
      });
      return files;
    }),

  /**
   * Get a pre-signed download URL for a file.
   */
  getDownloadUrl: protectedProcedure
    .input(z.object({ fileId: z.number(), expiresIn: z.number().default(3600) }))
    .query(async ({ ctx, input }) => {
      const active = await hasActiveStorageSubscription(ctx.user.id);
      if (!active) throw new TRPCError({ code: "FORBIDDEN", message: "No active storage subscription." });

      const { url, file } = await getDownloadUrl(ctx.user.id, input.fileId, input.expiresIn);
      return { url, file };
    }),

  /**
   * Delete a file.
   */
  deleteFile: protectedProcedure
    .input(z.object({ fileId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await deleteFile(ctx.user.id, input.fileId);
      return { success: true };
    }),

  /**
   * Create a shareable download link.
   */
  createShareLink: protectedProcedure
    .input(z.object({
      fileId: z.number(),
      expiresHours: z.number().min(1).max(720).optional(),
      maxDownloads: z.number().min(0).default(0),
      password: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const active = await hasActiveStorageSubscription(ctx.user.id);
      if (!active) throw new TRPCError({ code: "FORBIDDEN", message: "No active storage subscription." });

      return createShareLink(ctx.user.id, input.fileId, {
        expiresHours: input.expiresHours,
        maxDownloads: input.maxDownloads,
        password: input.password,
      });
    }),

  // ── API Keys ──────────────────────────────────────────────────────────

  /**
   * List the current user's storage API keys.
   */
  listApiKeys: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

    return db
      .select()
      .from(storageApiKeys)
      .where(and(eq(storageApiKeys.userId, ctx.user.id), eq(storageApiKeys.isActive, true)))
      .orderBy(desc(storageApiKeys.createdAt));
  }),

  /**
   * Create a new storage API key.
   */
  createApiKey: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(128),
      scopes: z.array(z.enum(["read", "write", "delete", "admin"])).min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      const active = await hasActiveStorageSubscription(ctx.user.id);
      if (!active) throw new TRPCError({ code: "FORBIDDEN", message: "No active storage subscription." });

      return createApiKey(ctx.user.id, input.name, input.scopes);
    }),

  /**
   * Revoke a storage API key.
   */
  revokeApiKey: protectedProcedure
    .input(z.object({ keyId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      await db
        .update(storageApiKeys)
        .set({ isActive: false })
        .where(and(eq(storageApiKeys.id, input.keyId), eq(storageApiKeys.userId, ctx.user.id)));

      return { success: true };
    }),

  // ── Admin ─────────────────────────────────────────────────────────────

  /**
   * Admin: List all users with storage subscriptions.
   */
  adminListSubscriptions: adminProcedure
    .input(z.object({ limit: z.number().default(100), offset: z.number().default(0) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      return db
        .select()
        .from(storageSubscriptions)
        .orderBy(desc(storageSubscriptions.createdAt))
        .limit(input.limit)
        .offset(input.offset);
    }),

  /**
   * Admin: Get platform-wide storage statistics.
   */
  adminGetStats: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

    const [totals] = await db
      .select({
        total_users: sql<number>`COUNT(*)`,
        total_quota: sql<number>`SUM(quotaBytes)`,
        total_used: sql<number>`SUM(usedBytes)`,
      })
      .from(storageSubscriptions);

    const byPlan = await db
      .select({
        plan: storageSubscriptions.plan,
        status: storageSubscriptions.status,
        count: sql<number>`COUNT(*)`,
        used_bytes: sql<number>`SUM(usedBytes)`,
      })
      .from(storageSubscriptions)
      .groupBy(storageSubscriptions.plan, storageSubscriptions.status);

    const [fileStats] = await db
      .select({
        total_files: sql<number>`COUNT(*)`,
        total_size: sql<number>`SUM(sizeBytes)`,
      })
      .from(storageFiles)
      .where(eq(storageFiles.isDeleted, false));

    return {
      users: {
        total: totals.total_users,
        total_quota_bytes: totals.total_quota || 0,
        total_used_bytes: totals.total_used || 0,
        by_plan: byPlan,
      },
      files: {
        total_files: fileStats.total_files,
        total_size_bytes: fileStats.total_size || 0,
      },
    };
  }),

  /**
   * Admin: Manually grant or override a user's storage subscription.
   */
  adminGrantStorage: adminProcedure
    .input(z.object({
      userId: z.number(),
      plan: z.enum(["10gb", "50gb", "100gb", "500gb", "1tb"]),
      status: z.enum(["active", "canceled", "past_due"]).default("active"),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const planData = STORAGE_PLANS[input.plan];
      const existing = await getStorageSubscription(input.userId);

      if (existing) {
        await db
          .update(storageSubscriptions)
          .set({ plan: input.plan, quotaBytes: planData.bytes, status: input.status })
          .where(eq(storageSubscriptions.userId, input.userId));
      } else {
        await db.insert(storageSubscriptions).values({
          userId: input.userId,
          plan: input.plan,
          quotaBytes: planData.bytes,
          usedBytes: 0,
          status: input.status,
        });
      }

      log.info(`[StorageRouter] Admin granted ${input.plan} storage to user ${input.userId}`);
      return { success: true, plan: input.plan, quota_bytes: planData.bytes };
    }),
});
