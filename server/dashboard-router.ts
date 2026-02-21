import { z } from "zod";
import { eq, and, isNull, lte, gte, desc, sql } from "drizzle-orm";
import { protectedProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { dashboardLayouts, apiKeys, fetcherCredentials } from "../drizzle/schema";

export const dashboardRouter = router({
  /**
   * Get the user's saved dashboard layout.
   * Returns null if no custom layout has been saved yet.
   */
  getLayout: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return null;

    const rows = await db
      .select()
      .from(dashboardLayouts)
      .where(eq(dashboardLayouts.userId, ctx.user.id))
      .limit(1);

    if (rows.length === 0) return null;

    return {
      widgetOrder: rows[0].widgetOrder,
      hiddenWidgets: rows[0].hiddenWidgets ?? [],
      widgetSizes: rows[0].widgetSizes ?? {},
    };
  }),

  /**
   * Save/update the user's dashboard layout.
   * Uses upsert — creates on first save, updates thereafter.
   */
  saveLayout: protectedProcedure
    .input(
      z.object({
        widgetOrder: z.array(z.string()),
        hiddenWidgets: z.array(z.string()).optional(),
        widgetSizes: z.record(z.string(), z.enum(["sm", "md", "lg"])).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return { success: false };

      // Check if layout exists
      const existing = await db
        .select({ id: dashboardLayouts.id })
        .from(dashboardLayouts)
        .where(eq(dashboardLayouts.userId, ctx.user.id))
        .limit(1);

      if (existing.length > 0) {
        await db
          .update(dashboardLayouts)
          .set({
            widgetOrder: input.widgetOrder,
            hiddenWidgets: input.hiddenWidgets ?? [],
            widgetSizes: (input.widgetSizes ?? {}) as Record<string, "sm" | "md" | "lg">,
          })
          .where(eq(dashboardLayouts.userId, ctx.user.id));
      } else {
        await db.insert(dashboardLayouts).values({
          userId: ctx.user.id,
          widgetOrder: input.widgetOrder,
          hiddenWidgets: input.hiddenWidgets ?? [],
          widgetSizes: (input.widgetSizes ?? {}) as Record<string, "sm" | "md" | "lg">,
        });
      }

      return { success: true };
    }),

  /**
   * Reset layout to default (deletes the saved layout).
   */
  resetLayout: protectedProcedure.mutation(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return { success: false };

    await db
      .delete(dashboardLayouts)
      .where(eq(dashboardLayouts.userId, ctx.user.id));

    return { success: true };
  }),

  /**
   * Get credential health summary.
   * Checks API keys for expiration and credentials for age.
   * Returns categorized items: expired, expiring_soon (within 7 days),
   * expiring_warning (within 30 days), and healthy.
   */
  credentialHealth: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) {
      return {
        totalCredentials: 0,
        totalApiKeys: 0,
        expired: [] as HealthItem[],
        expiringSoon: [] as HealthItem[],
        expiringWarning: [] as HealthItem[],
        healthy: [] as HealthItem[],
        summary: { expired: 0, expiringSoon: 0, expiringWarning: 0, healthy: 0 },
        overallStatus: "healthy" as "healthy" | "warning" | "critical",
      };
    }

    const now = new Date();
    const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const staleThreshold = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000); // 90 days old

    const items: HealthItem[] = [];

    // 1. Check API keys with expiration dates
    const userApiKeys = await db
      .select()
      .from(apiKeys)
      .where(and(eq(apiKeys.userId, ctx.user.id), isNull(apiKeys.revokedAt)))
      .orderBy(apiKeys.expiresAt);

    for (const key of userApiKeys) {
      if (key.expiresAt) {
        const expiresAt = new Date(key.expiresAt);
        let status: HealthItem["status"];
        if (expiresAt < now) {
          status = "expired";
        } else if (expiresAt <= in7Days) {
          status = "expiring_soon";
        } else if (expiresAt <= in30Days) {
          status = "expiring_warning";
        } else {
          status = "healthy";
        }

        items.push({
          id: `apikey-${key.id}`,
          type: "api_key",
          name: key.name,
          identifier: `${key.keyPrefix}...`,
          status,
          expiresAt: expiresAt.toISOString(),
          daysRemaining: Math.ceil((expiresAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)),
          lastUsedAt: key.lastUsedAt?.toISOString() || null,
        });
      } else {
        // No expiration — always healthy
        items.push({
          id: `apikey-${key.id}`,
          type: "api_key",
          name: key.name,
          identifier: `${key.keyPrefix}...`,
          status: "healthy",
          expiresAt: null,
          daysRemaining: null,
          lastUsedAt: key.lastUsedAt?.toISOString() || null,
        });
      }
    }

    // 2. Check fetched credentials for staleness (age > 90 days)
    const userCredentials = await db
      .select({
        id: fetcherCredentials.id,
        providerId: fetcherCredentials.providerId,
        providerName: fetcherCredentials.providerName,
        keyType: fetcherCredentials.keyType,
        keyLabel: fetcherCredentials.keyLabel,
        createdAt: fetcherCredentials.createdAt,
      })
      .from(fetcherCredentials)
      .where(eq(fetcherCredentials.userId, ctx.user.id))
      .orderBy(fetcherCredentials.createdAt);

    for (const cred of userCredentials) {
      const createdAt = new Date(cred.createdAt);
      const ageInDays = Math.floor((now.getTime() - createdAt.getTime()) / (24 * 60 * 60 * 1000));

      let status: HealthItem["status"];
      if (ageInDays > 90) {
        status = "expiring_warning"; // stale credential
      } else if (ageInDays > 60) {
        status = "expiring_soon"; // getting old
      } else {
        status = "healthy";
      }

      items.push({
        id: `cred-${cred.id}`,
        type: "credential",
        name: cred.keyLabel || `${cred.providerName} ${cred.keyType}`,
        identifier: `${cred.providerName} / ${cred.keyType}`,
        status,
        expiresAt: null, // credentials don't have explicit expiry, tracked by age
        daysRemaining: status === "healthy" ? null : (status === "expiring_soon" ? 90 - ageInDays : -(ageInDays - 90)),
        lastUsedAt: null,
        ageInDays,
      });
    }

    // Categorize
    const expired = items.filter((i) => i.status === "expired");
    const expiringSoon = items.filter((i) => i.status === "expiring_soon");
    const expiringWarning = items.filter((i) => i.status === "expiring_warning");
    const healthy = items.filter((i) => i.status === "healthy");

    // Overall status
    let overallStatus: "healthy" | "warning" | "critical" = "healthy";
    if (expired.length > 0) overallStatus = "critical";
    else if (expiringSoon.length > 0 || expiringWarning.length > 0) overallStatus = "warning";

    return {
      totalCredentials: userCredentials.length,
      totalApiKeys: userApiKeys.length,
      expired,
      expiringSoon,
      expiringWarning,
      healthy,
      summary: {
        expired: expired.length,
        expiringSoon: expiringSoon.length,
        expiringWarning: expiringWarning.length,
        healthy: healthy.length,
      },
      overallStatus,
    };
  }),
});

// ─── Types ──────────────────────────────────────────────────────────

interface HealthItem {
  id: string;
  type: "api_key" | "credential";
  name: string;
  identifier: string;
  status: "expired" | "expiring_soon" | "expiring_warning" | "healthy";
  expiresAt: string | null;
  daysRemaining: number | null;
  lastUsedAt: string | null;
  ageInDays?: number;
}
