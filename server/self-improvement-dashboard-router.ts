import { z } from "zod";
import { adminProcedure, publicProcedure } from "./_core/trpc";
import { router } from "./_core/trpc";
import { getDb } from "./db";
import { TRPCError } from "@trpc/server";
import { desc, eq, sql, and, gte, lte } from "drizzle-orm";
import {
  systemSnapshots,
  snapshotFiles,
  selfModificationLog,
  builderActivityLog,
} from "../drizzle/schema";
import {
  runHealthCheck,
  getModificationHistory,
  getProtectedFiles,
  getAllowedDirectories,
  rollbackToSnapshot,
  rollbackToLastGood,
  createSnapshot,
} from "./self-improvement-engine";

export const selfImprovementDashboardRouter = router({
  /**
   * Get overview stats: total snapshots, total modifications, health status, etc.
   */
  overview: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) {
      return {
        totalSnapshots: 0,
        activeSnapshots: 0,
        knownGoodSnapshots: 0,
        totalModifications: 0,
        appliedModifications: 0,
        rolledBackModifications: 0,
        failedValidations: 0,
        protectedFileCount: getProtectedFiles().length,
        allowedDirectoryCount: getAllowedDirectories().length,
      };
    }

    const [snapCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(systemSnapshots);

    const [activeSnapCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(systemSnapshots)
      .where(eq(systemSnapshots.status, "active"));

    const [goodSnapCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(systemSnapshots)
      .where(eq(systemSnapshots.isKnownGood, 1));

    const [modCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(selfModificationLog);

    const [appliedCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(selfModificationLog)
      .where(eq(selfModificationLog.applied, 1));

    const [rolledBackCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(selfModificationLog)
      .where(eq(selfModificationLog.rolledBack, 1));

    const [failedCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(selfModificationLog)
      .where(eq(selfModificationLog.validationResult, "failed"));

    return {
      totalSnapshots: snapCount?.count ?? 0,
      activeSnapshots: activeSnapCount?.count ?? 0,
      knownGoodSnapshots: goodSnapCount?.count ?? 0,
      totalModifications: modCount?.count ?? 0,
      appliedModifications: appliedCount?.count ?? 0,
      rolledBackModifications: rolledBackCount?.count ?? 0,
      failedValidations: failedCount?.count ?? 0,
      protectedFileCount: getProtectedFiles().length,
      allowedDirectoryCount: getAllowedDirectories().length,
    };
  }),

  /**
   * List all snapshots with pagination.
   */
  listSnapshots: adminProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).optional().default(25),
        offset: z.number().min(0).optional().default(0),
        status: z
          .enum(["active", "rolled_back", "superseded"])
          .optional(),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { snapshots: [], total: 0 };

      const conditions = [];
      if (input.status) {
        conditions.push(eq(systemSnapshots.status, input.status));
      }

      const whereClause =
        conditions.length > 0 ? and(...conditions) : undefined;

      const rows = await db
        .select()
        .from(systemSnapshots)
        .where(whereClause)
        .orderBy(desc(systemSnapshots.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      const [countResult] = await db
        .select({ count: sql<number>`count(*)` })
        .from(systemSnapshots)
        .where(whereClause);

      return {
        snapshots: rows,
        total: countResult?.count ?? 0,
      };
    }),

  /**
   * Get snapshot details including file list.
   */
  getSnapshot: adminProcedure
    .input(z.object({ snapshotId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [snapshot] = await db
        .select()
        .from(systemSnapshots)
        .where(eq(systemSnapshots.id, input.snapshotId))
        .limit(1);

      if (!snapshot) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Snapshot not found" });
      }

      const files = await db
        .select({
          id: snapshotFiles.id,
          filePath: snapshotFiles.filePath,
          contentHash: snapshotFiles.contentHash,
          createdAt: snapshotFiles.createdAt,
        })
        .from(snapshotFiles)
        .where(eq(snapshotFiles.snapshotId, input.snapshotId))
        .orderBy(snapshotFiles.filePath);

      return { snapshot, files };
    }),

  /**
   * List modification log with pagination and filtering.
   */
  listModifications: adminProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).optional().default(25),
        offset: z.number().min(0).optional().default(0),
        action: z
          .enum([
            "modify_file",
            "create_file",
            "delete_file",
            "modify_config",
            "add_dependency",
            "restart_service",
            "rollback",
            "validate",
          ])
          .optional(),
        applied: z.boolean().optional(),
        rolledBack: z.boolean().optional(),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { modifications: [], total: 0 };

      const conditions = [];
      if (input.action) {
        conditions.push(eq(selfModificationLog.action, input.action));
      }
      if (input.applied !== undefined) {
        conditions.push(
          eq(selfModificationLog.applied, input.applied ? 1 : 0)
        );
      }
      if (input.rolledBack !== undefined) {
        conditions.push(
          eq(selfModificationLog.rolledBack, input.rolledBack ? 1 : 0)
        );
      }

      const whereClause =
        conditions.length > 0 ? and(...conditions) : undefined;

      const rows = await db
        .select()
        .from(selfModificationLog)
        .where(whereClause)
        .orderBy(desc(selfModificationLog.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      const [countResult] = await db
        .select({ count: sql<number>`count(*)` })
        .from(selfModificationLog)
        .where(whereClause);

      return {
        modifications: rows,
        total: countResult?.count ?? 0,
      };
    }),

  /**
   * Run a real-time health check.
   */
  healthCheck: adminProcedure.mutation(async () => {
    const result = await runHealthCheck();
    return result;
  }),

  /**
   * Get protected files list and allowed directories.
   */
  safetyConfig: adminProcedure.query(() => {
    return {
      protectedFiles: getProtectedFiles(),
      allowedDirectories: getAllowedDirectories(),
    };
  }),

  /**
   * Rollback to a specific snapshot.
   */
  rollbackToSnapshot: adminProcedure
    .input(z.object({ snapshotId: z.number() }))
    .mutation(async ({ input }) => {
      const result = await rollbackToSnapshot(input.snapshotId);
      return result;
    }),

  /**
   * Rollback to the last known good snapshot.
   */
  rollbackToLastGood: adminProcedure.mutation(async () => {
    const result = await rollbackToLastGood();
    return result;
  }),

  /**
   * Create a manual snapshot (for admin to save current state).
   */
  createManualSnapshot: adminProcedure
    .input(
      z.object({
        reason: z.string().min(1).max(512),
        filePaths: z.array(z.string()).min(1).max(50),
      })
    )
    .mutation(async ({ input }) => {
      const result = await createSnapshot(
        input.filePaths,
        "admin",
        input.reason
      );
      return result;
    }),

  /**
   * Get activity timeline — recent modifications and snapshots merged chronologically.
   */
  activityTimeline: adminProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(50).optional().default(20),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { events: [] };

      const recentMods = await db
        .select({
          id: selfModificationLog.id,
          type: sql<string>`'modification'`,
          action: selfModificationLog.action,
          description: selfModificationLog.description,
          targetFile: selfModificationLog.targetFile,
          applied: selfModificationLog.applied,
          rolledBack: selfModificationLog.rolledBack,
          validationResult: selfModificationLog.validationResult,
          errorMessage: selfModificationLog.errorMessage,
          createdAt: selfModificationLog.createdAt,
        })
        .from(selfModificationLog)
        .orderBy(desc(selfModificationLog.createdAt))
        .limit(input.limit);

      const recentSnaps = await db
        .select({
          id: systemSnapshots.id,
          type: sql<string>`'snapshot'`,
          triggeredBy: systemSnapshots.triggeredBy,
          reason: systemSnapshots.reason,
          fileCount: systemSnapshots.fileCount,
          status: systemSnapshots.status,
          isKnownGood: systemSnapshots.isKnownGood,
          createdAt: systemSnapshots.createdAt,
        })
        .from(systemSnapshots)
        .orderBy(desc(systemSnapshots.createdAt))
        .limit(input.limit);

      // Merge and sort by createdAt descending
      const events = [
        ...recentMods.map((m) => ({
          id: m.id,
          eventType: "modification" as const,
          action: m.action,
          description: m.description,
          targetFile: m.targetFile,
          applied: m.applied === 1,
          rolledBack: m.rolledBack === 1,
          validationResult: m.validationResult,
          errorMessage: m.errorMessage,
          createdAt: m.createdAt,
        })),
        ...recentSnaps.map((s) => ({
          id: s.id,
          eventType: "snapshot" as const,
          triggeredBy: s.triggeredBy,
          reason: s.reason,
          fileCount: s.fileCount,
          status: s.status,
          isKnownGood: s.isKnownGood === 1,
          createdAt: s.createdAt,
        })),
      ]
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )
         .slice(0, input.limit);
      return { events };
    }),

  // ── V6.0: Builder Activity Feed ──────────────────────────────────

  builderActivity: adminProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(20),
        tool: z.enum(["self_type_check", "self_run_tests", "self_multi_file_modify"]).optional(),
      }).optional()
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { activities: [] };
      const limit = input?.limit ?? 20;

      const activities = input?.tool
        ? await db
            .select()
            .from(builderActivityLog)
            .where(eq(builderActivityLog.tool, input.tool))
            .orderBy(desc(builderActivityLog.createdAt))
            .limit(limit)
        : await db
            .select()
            .from(builderActivityLog)
            .orderBy(desc(builderActivityLog.createdAt))
            .limit(limit);

      return { activities };
    }),

  // ── V6.0: Builder Stats (public — for landing page badges) ──────

  builderStats: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { typeCheck: null, tests: null, totalRuns: 0, passRate: 0 };

    // Get latest type check
    const [latestTypeCheck] = await db
      .select()
      .from(builderActivityLog)
      .where(eq(builderActivityLog.tool, "self_type_check"))
      .orderBy(desc(builderActivityLog.createdAt))
      .limit(1);

    // Get latest test run
    const [latestTests] = await db
      .select()
      .from(builderActivityLog)
      .where(eq(builderActivityLog.tool, "self_run_tests"))
      .orderBy(desc(builderActivityLog.createdAt))
      .limit(1);

    // Get aggregate stats
    const [stats] = await db
      .select({
        totalRuns: sql<number>`COUNT(*)`,
        successRuns: sql<number>`SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END)`,
        avgDuration: sql<number>`AVG(durationMs)`,
      })
      .from(builderActivityLog);

    const totalRuns = Number(stats?.totalRuns ?? 0);
    const successRuns = Number(stats?.successRuns ?? 0);
    const passRate = totalRuns > 0 ? Math.round((successRuns / totalRuns) * 100) : 0;
    const avgDuration = Math.round(Number(stats?.avgDuration ?? 0));

    return {
      typeCheck: latestTypeCheck
        ? { status: latestTypeCheck.status, summary: latestTypeCheck.summary, durationMs: latestTypeCheck.durationMs, at: latestTypeCheck.createdAt }
        : null,
      tests: latestTests
        ? { status: latestTests.status, summary: latestTests.summary, durationMs: latestTests.durationMs, at: latestTests.createdAt }
        : null,
      totalRuns,
      passRate,
      avgDuration,
    };
  }),
});
