import { z } from "zod";
import { eq, and, desc, lte, gte, sql } from "drizzle-orm";
import { protectedProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "./db";
import {
  credentialWatches,
  credentialHistory,
  bulkSyncJobs,
  fetcherCredentials,
} from "../drizzle/schema";

// ─── Feature 1: Credential Expiry Watchdog ──────────────────────────

export const watchdogRouter = router({
  /**
   * List all credential watches for the current user.
   */
  list: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];
    return db
      .select()
      .from(credentialWatches)
      .where(eq(credentialWatches.userId, ctx.user.id))
      .orderBy(credentialWatches.expiresAt);
  }),

  /**
   * Add a watch on a credential with an expiry date.
   */
  create: protectedProcedure
    .input(
      z.object({
        credentialId: z.number(),
        expiresAt: z.string().datetime(),
        alertDaysBefore: z.number().min(1).max(90).default(7),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      // Verify the credential belongs to this user
      const cred = await db
        .select({ id: fetcherCredentials.id })
        .from(fetcherCredentials)
        .where(and(eq(fetcherCredentials.id, input.credentialId), eq(fetcherCredentials.userId, ctx.user.id)))
        .limit(1);

      if (cred.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Credential not found" });
      }

      // Check if watch already exists
      const existing = await db
        .select({ id: credentialWatches.id })
        .from(credentialWatches)
        .where(
          and(
            eq(credentialWatches.userId, ctx.user.id),
            eq(credentialWatches.credentialId, input.credentialId)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        // Update existing watch
        await db
          .update(credentialWatches)
          .set({
            expiresAt: new Date(input.expiresAt),
            alertDaysBefore: input.alertDaysBefore,
            status: "active",
          })
          .where(eq(credentialWatches.id, existing[0].id));
        return { success: true, id: existing[0].id, updated: true };
      }

      const result = await db.insert(credentialWatches).values({
        userId: ctx.user.id,
        credentialId: input.credentialId,
        expiresAt: new Date(input.expiresAt),
        alertDaysBefore: input.alertDaysBefore,
      });

      return { success: true, id: Number(result[0].insertId), updated: false };
    }),

  /**
   * Remove a watch.
   */
  remove: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      await db
        .delete(credentialWatches)
        .where(and(eq(credentialWatches.id, input.id), eq(credentialWatches.userId, ctx.user.id)));

      return { success: true };
    }),

  /**
   * Dismiss an expiry alert.
   */
  dismiss: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      await db
        .update(credentialWatches)
        .set({ status: "dismissed" })
        .where(and(eq(credentialWatches.id, input.id), eq(credentialWatches.userId, ctx.user.id)));

      return { success: true };
    }),

  /**
   * Get summary of expiring credentials (for dashboard widget).
   */
  summary: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) {
      return { total: 0, expiringSoon: 0, expired: 0, active: 0 };
    }

    const now = new Date();
    const watches = await db
      .select()
      .from(credentialWatches)
      .where(eq(credentialWatches.userId, ctx.user.id));

    let expiringSoon = 0;
    let expired = 0;
    let active = 0;

    for (const w of watches) {
      const expiresAt = new Date(w.expiresAt);
      const daysUntil = Math.ceil((expiresAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));

      if (daysUntil <= 0) {
        expired++;
      } else if (daysUntil <= w.alertDaysBefore) {
        expiringSoon++;
      } else {
        active++;
      }
    }

    return { total: watches.length, expiringSoon, expired, active };
  }),
});

// ─── Feature 2: Bulk Provider Sync ──────────────────────────────────

export const bulkSyncRouter = router({
  /**
   * List bulk sync jobs for the current user.
   */
  list: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];
    return db
      .select()
      .from(bulkSyncJobs)
      .where(eq(bulkSyncJobs.userId, ctx.user.id))
      .orderBy(desc(bulkSyncJobs.createdAt))
      .limit(20);
  }),

  /**
   * Create a new bulk sync job. This queues a re-fetch across all
   * providers that the user has previously fetched credentials from.
   */
  create: protectedProcedure
    .input(
      z.object({
        providerIds: z.array(z.string()).min(1).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      // Get unique providers the user has credentials for
      const userCreds = await db
        .select({ providerId: fetcherCredentials.providerId })
        .from(fetcherCredentials)
        .where(eq(fetcherCredentials.userId, ctx.user.id));

      const uniqueProviders = Array.from(new Set(userCreds.map((c) => c.providerId)));
      const targetProviders = input.providerIds
        ? uniqueProviders.filter((p) => input.providerIds!.includes(p))
        : uniqueProviders;

      if (targetProviders.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No providers to sync. Fetch credentials from at least one provider first.",
        });
      }

      const result = await db.insert(bulkSyncJobs).values({
        userId: ctx.user.id,
        totalProviders: targetProviders.length,
        status: "queued",
        triggeredBy: "manual",
        linkedJobIds: [],
      });

      return {
        success: true,
        id: Number(result[0].insertId),
        totalProviders: targetProviders.length,
        providers: targetProviders,
      };
    }),

  /**
   * Get the status of a specific bulk sync job.
   */
  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const rows = await db
        .select()
        .from(bulkSyncJobs)
        .where(and(eq(bulkSyncJobs.id, input.id), eq(bulkSyncJobs.userId, ctx.user.id)))
        .limit(1);

      if (rows.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Bulk sync job not found" });
      }

      return rows[0];
    }),

  /**
   * Cancel a running bulk sync job.
   */
  cancel: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      await db
        .update(bulkSyncJobs)
        .set({ status: "cancelled" })
        .where(
          and(
            eq(bulkSyncJobs.id, input.id),
            eq(bulkSyncJobs.userId, ctx.user.id)
          )
        );

      return { success: true };
    }),
});

// ─── Feature 3: Credential Diff & History ───────────────────────────

export const credentialHistoryRouter = router({
  /**
   * Get the full history of a specific credential.
   */
  getHistory: protectedProcedure
    .input(z.object({ credentialId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return [];

      // Verify credential belongs to user
      const cred = await db
        .select({ id: fetcherCredentials.id })
        .from(fetcherCredentials)
        .where(and(eq(fetcherCredentials.id, input.credentialId), eq(fetcherCredentials.userId, ctx.user.id)))
        .limit(1);

      if (cred.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Credential not found" });
      }

      return db
        .select()
        .from(credentialHistory)
        .where(
          and(
            eq(credentialHistory.credentialId, input.credentialId),
            eq(credentialHistory.userId, ctx.user.id)
          )
        )
        .orderBy(desc(credentialHistory.createdAt));
    }),

  /**
   * Get all credential history entries for the current user (recent first).
   */
  listAll: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(100).default(50) }).optional())
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return [];
      const limit = input?.limit ?? 50;

      return db
        .select()
        .from(credentialHistory)
        .where(eq(credentialHistory.userId, ctx.user.id))
        .orderBy(desc(credentialHistory.createdAt))
        .limit(limit);
    }),

  /**
   * Add a manual snapshot note to a credential's history.
   */
  addNote: protectedProcedure
    .input(
      z.object({
        credentialId: z.number(),
        note: z.string().min(1).max(512),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      // Get the credential to snapshot
      const cred = await db
        .select()
        .from(fetcherCredentials)
        .where(and(eq(fetcherCredentials.id, input.credentialId), eq(fetcherCredentials.userId, ctx.user.id)))
        .limit(1);

      if (cred.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Credential not found" });
      }

      await db.insert(credentialHistory).values({
        credentialId: input.credentialId,
        userId: ctx.user.id,
        providerId: cred[0].providerId,
        keyType: cred[0].keyType,
        encryptedValue: cred[0].encryptedValue,
        changeType: "manual_update",
        snapshotNote: input.note,
        jobId: cred[0].jobId,
      });

      return { success: true };
    }),

  /**
   * Rollback a credential to a previous historical value.
   */
  rollback: protectedProcedure
    .input(z.object({ historyEntryId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      // Get the history entry
      const entry = await db
        .select()
        .from(credentialHistory)
        .where(
          and(
            eq(credentialHistory.id, input.historyEntryId),
            eq(credentialHistory.userId, ctx.user.id)
          )
        )
        .limit(1);

      if (entry.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "History entry not found" });
      }

      const historyEntry = entry[0];

      // Snapshot current value before rollback
      const currentCred = await db
        .select()
        .from(fetcherCredentials)
        .where(eq(fetcherCredentials.id, historyEntry.credentialId))
        .limit(1);

      if (currentCred.length > 0) {
        // Save current value as a history entry before overwriting
        await db.insert(credentialHistory).values({
          credentialId: historyEntry.credentialId,
          userId: ctx.user.id,
          providerId: currentCred[0].providerId,
          keyType: currentCred[0].keyType,
          encryptedValue: currentCred[0].encryptedValue,
          changeType: "rollback",
          snapshotNote: `Auto-snapshot before rollback to entry #${historyEntry.id}`,
          jobId: currentCred[0].jobId,
        });

        // Update the credential with the historical value
        await db
          .update(fetcherCredentials)
          .set({ encryptedValue: historyEntry.encryptedValue })
          .where(eq(fetcherCredentials.id, historyEntry.credentialId));
      }

      return { success: true };
    }),

  /**
   * Get diff summary: how many credentials have changed since last fetch.
   */
  diffSummary: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return { totalChanges: 0, rotated: 0, created: 0, rolledBack: 0 };

    const last30Days = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const entries = await db
      .select({
        changeType: credentialHistory.changeType,
        count: sql<number>`COUNT(*)`,
      })
      .from(credentialHistory)
      .where(
        and(
          eq(credentialHistory.userId, ctx.user.id),
          gte(credentialHistory.createdAt, last30Days)
        )
      )
      .groupBy(credentialHistory.changeType);

    const counts: Record<string, number> = {};
    for (const e of entries) {
      counts[e.changeType] = Number(e.count);
    }

    return {
      totalChanges: Object.values(counts).reduce((a, b) => a + b, 0),
      rotated: counts["rotated"] ?? 0,
      created: counts["created"] ?? 0,
      rolledBack: counts["rollback"] ?? 0,
      manualUpdates: counts["manual_update"] ?? 0,
    };
  }),
});
