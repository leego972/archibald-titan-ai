/**
 * Titan Storage Router
 * tRPC procedures for per-user paid cloud storage.
 * Registered in routers.ts as `titanStorage: storageRouter`
 *
 * Admin policy:
 *   - All protectedProcedure endpoints pass ctx.user.role to service functions.
 *   - Admins bypass subscription and quota checks everywhere.
 *   - Admins can access, list, download, and delete any user's files.
 *   - Admin-only procedures are still gated by adminProcedure.
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
  buildAdminSubscription,
} from "./storage-service";
import { isAdminRole } from "../shared/const";
import { createLogger } from "./_core/logger.js";

const log = createLogger("StorageRouter");

export const storageRouter = router({

  // ── Subscription & Quota ──────────────────────────────────────────────────

  /**
   * Get the current user's storage subscription and quota.
   * Admins receive a virtual "unlimited" subscription response.
   */
  getSubscription: protectedProcedure.query(async ({ ctx }) => {
    const role = ctx.user.role;

    // Admin: return virtual unlimited subscription
    if (isAdminRole(role)) {
      const quota = await getStorageQuota(ctx.user.id, role);
      return {
        id: -1,
        userId: ctx.user.id,
        plan: "admin_unlimited",
        plan_label: "Admin (Unlimited)",
        status: "active",
        quotaBytes: quota.quota,
        usedBytes: quota.used,
        used_formatted: formatBytes(quota.used),
        quota_formatted: "Unlimited",
        available_bytes: quota.quota,
        usage_pct: 0,
        cancelAtPeriodEnd: false,
        currentPeriodEnd: null,
        isAdmin: true,
      };
    }

    const sub = await getStorageSubscription(ctx.user.id, role);
    if (!sub) return null;
    return {
      ...sub,
      plan_label: STORAGE_PLANS[sub.plan as StoragePlanId]?.label ?? sub.plan,
      used_formatted: formatBytes(sub.usedBytes),
      quota_formatted: formatBytes(sub.quotaBytes),
      available_bytes: Math.max(0, sub.quotaBytes - sub.usedBytes),
      usage_pct: sub.quotaBytes > 0 ? Math.round((sub.usedBytes / sub.quotaBytes) * 100) : 0,
      isAdmin: false,
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
   * Admins see platform-wide stats alongside their own usage.
   */
  getStats: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

    const role = ctx.user.role;
    const isAdmin = isAdminRole(role);

    // Usage by feature for this user (or all users if admin)
    const featureCondition = isAdmin
      ? eq(storageFiles.isDeleted, false)
      : and(eq(storageFiles.userId, ctx.user.id), eq(storageFiles.isDeleted, false));

    const byFeature = await db
      .select({
        feature: storageFiles.feature,
        file_count: sql<number>`COUNT(*)`,
        total_bytes: sql<number>`SUM(sizeBytes)`,
      })
      .from(storageFiles)
      .where(featureCondition)
      .groupBy(storageFiles.feature);

    if (isAdmin) {
      // Platform-wide totals for admins
      const [platformTotals] = await db
        .select({
          total_files: sql<number>`COUNT(*)`,
          total_bytes: sql<number>`COALESCE(SUM(sizeBytes), 0)`,
        })
        .from(storageFiles)
        .where(eq(storageFiles.isDeleted, false));

      const [userTotals] = await db
        .select({ total_users: sql<number>`COUNT(*)` })
        .from(storageSubscriptions);

      return {
        has_subscription: true,
        is_admin: true,
        used_bytes: Number(platformTotals.total_bytes ?? 0),
        quota_bytes: Number.MAX_SAFE_INTEGER,
        available_bytes: Number.MAX_SAFE_INTEGER,
        usage_pct: 0,
        plan: "admin_unlimited",
        status: "active",
        by_feature: byFeature,
        platform: {
          total_files: platformTotals.total_files,
          total_bytes: Number(platformTotals.total_bytes ?? 0),
          total_subscribed_users: userTotals.total_users,
        },
      };
    }

    const sub = await getStorageSubscription(ctx.user.id, role);
    if (!sub) return { has_subscription: false };

    return {
      has_subscription: true,
      is_admin: false,
      used_bytes: sub.usedBytes,
      quota_bytes: sub.quotaBytes,
      available_bytes: Math.max(0, sub.quotaBytes - sub.usedBytes),
      usage_pct: sub.quotaBytes > 0 ? Math.round((sub.usedBytes / sub.quotaBytes) * 100) : 0,
      plan: sub.plan,
      status: sub.status,
      by_feature: byFeature,
    };
  }),

  // ── File Operations ───────────────────────────────────────────────────────

  /**
   * List files.
   * Admins can list files for any user or all files platform-wide.
   */
  listFiles: protectedProcedure
    .input(z.object({
      feature: z.enum(["vault", "builder", "fetcher", "scanner", "webhook", "export", "generic"]).optional(),
      limit: z.number().min(1).max(500).default(50),
      offset: z.number().min(0).default(0),
      userId: z.number().optional(), // Admin: list a specific user's files
      allUsers: z.boolean().default(false), // Admin: list all files platform-wide
    }))
    .query(async ({ ctx, input }) => {
      const role = ctx.user.role;
      const isAdmin = isAdminRole(role);

      // Non-admins must have an active subscription
      if (!isAdmin) {
        const active = await hasActiveStorageSubscription(ctx.user.id, role);
        if (!active) throw new TRPCError({ code: "FORBIDDEN", message: "No active storage subscription." });
      }

      // Admins can target a specific user's files or all files
      const targetUserId = isAdmin && input.userId ? input.userId : ctx.user.id;

      const files = await listFiles(
        targetUserId,
        {
          feature: input.feature,
          limit: input.limit,
          offset: input.offset,
          allUsers: isAdmin && input.allUsers,
        },
        role
      );
      return files;
    }),

  /**
   * Get a pre-signed download URL for a file.
   * Admins can download any user's file.
   */
  getDownloadUrl: protectedProcedure
    .input(z.object({ fileId: z.number(), expiresIn: z.number().default(3600) }))
    .query(async ({ ctx, input }) => {
      const role = ctx.user.role;
      const isAdmin = isAdminRole(role);

      if (!isAdmin) {
        const active = await hasActiveStorageSubscription(ctx.user.id, role);
        if (!active) throw new TRPCError({ code: "FORBIDDEN", message: "No active storage subscription." });
      }

      const { url, file } = await getDownloadUrl(ctx.user.id, input.fileId, input.expiresIn, role);
      return { url, file };
    }),

  /**
   * Delete a file.
   * Admins can delete any user's file.
   */
  deleteFile: protectedProcedure
    .input(z.object({ fileId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await deleteFile(ctx.user.id, input.fileId, ctx.user.role);
      return { success: true };
    }),

  /**
   * Create a shareable download link.
   * Admins can share any user's file.
   */
  createShareLink: protectedProcedure
    .input(z.object({
      fileId: z.number(),
      expiresHours: z.number().min(1).max(720).optional(),
      maxDownloads: z.number().min(0).default(0),
      password: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const role = ctx.user.role;
      const isAdmin = isAdminRole(role);

      if (!isAdmin) {
        const active = await hasActiveStorageSubscription(ctx.user.id, role);
        if (!active) throw new TRPCError({ code: "FORBIDDEN", message: "No active storage subscription." });
      }

      return createShareLink(ctx.user.id, input.fileId, {
        expiresHours: input.expiresHours,
        maxDownloads: input.maxDownloads,
        password: input.password,
      }, role);
    }),

  // ── API Keys ──────────────────────────────────────────────────────────────

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
   * Admins can create API keys without a subscription.
   */
  createApiKey: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(128),
      scopes: z.array(z.enum(["read", "write", "delete", "admin"])).min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      return createApiKey(ctx.user.id, input.name, input.scopes, ctx.user.role);
    }),

  /**
   * Revoke a storage API key.
   */
  revokeApiKey: protectedProcedure
    .input(z.object({ keyId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const isAdmin = isAdminRole(ctx.user.role);

      // Admins can revoke any key; regular users only their own
      const condition = isAdmin
        ? eq(storageApiKeys.id, input.keyId)
        : and(eq(storageApiKeys.id, input.keyId), eq(storageApiKeys.userId, ctx.user.id));

      await db
        .update(storageApiKeys)
        .set({ isActive: false })
        .where(condition);

      return { success: true };
    }),

  // ── Admin Procedures ──────────────────────────────────────────────────────

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
   * Admin: List all files across the entire platform.
   */
  adminListAllFiles: adminProcedure
    .input(z.object({
      userId: z.number().optional(),
      feature: z.enum(["vault", "builder", "fetcher", "scanner", "webhook", "export", "generic"]).optional(),
      limit: z.number().default(200),
      offset: z.number().default(0),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const conditions: any[] = [eq(storageFiles.isDeleted, false)];
      if (input.userId) conditions.push(eq(storageFiles.userId, input.userId));
      if (input.feature) conditions.push(eq(storageFiles.feature, input.feature as any));

      return db
        .select()
        .from(storageFiles)
        .where(and(...conditions))
        .orderBy(desc(storageFiles.createdAt))
        .limit(input.limit)
        .offset(input.offset);
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

  /**
   * Admin: Revoke a user's storage subscription.
   */
  adminRevokeStorage: adminProcedure
    .input(z.object({ userId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      await db
        .update(storageSubscriptions)
        .set({ status: "canceled" })
        .where(eq(storageSubscriptions.userId, input.userId));

      log.info(`[StorageRouter] Admin revoked storage for user ${input.userId}`);
      return { success: true };
    }),

  /**
   * Admin: Hard-delete a file permanently (removes from S3 and DB).
   */
  adminHardDeleteFile: adminProcedure
    .input(z.object({ fileId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await deleteFile(ctx.user.id, input.fileId, ctx.user.role);
      return { success: true };
    }),
});
