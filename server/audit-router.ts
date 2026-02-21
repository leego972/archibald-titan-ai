/**
 * Audit Logs Router — View and filter audit trail events.
 *
 * Enterprise-only feature. Provides a searchable, filterable log of
 * all actions taken within the account.
 */

import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { getUserPlan, enforceFeature } from "./subscription-gate";
import { queryAuditLogs, getDistinctActions } from "./audit-log-db";

/**
 * Convert an array of audit log entries to CSV string.
 * Properly escapes fields containing commas, quotes, or newlines.
 */
export function auditLogsToCsv(logs: Array<{
  id: number;
  createdAt: Date | string;
  userId: number;
  userName?: string | null;
  userEmail?: string | null;
  action: string;
  resource?: string | null;
  resourceId?: string | null;
  details?: Record<string, unknown> | null;
  ipAddress?: string | null;
}>): string {
  const header = "ID,Timestamp,User ID,User Name,User Email,Action,Resource,Resource ID,Details,IP Address";

  function escapeField(value: string | null | undefined): string {
    if (value == null || value === "") return "";
    const str = String(value);
    // If the field contains comma, quote, or newline, wrap in quotes and escape internal quotes
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
      return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
  }

  const rows = logs.map((log) => {
    const timestamp = log.createdAt instanceof Date
      ? log.createdAt.toISOString()
      : String(log.createdAt);
    const details = log.details && typeof log.details === "object"
      ? JSON.stringify(log.details)
      : "";

    return [
      log.id,
      timestamp,
      log.userId,
      escapeField(log.userName),
      escapeField(log.userEmail),
      escapeField(log.action),
      escapeField(log.resource),
      escapeField(log.resourceId),
      escapeField(details),
      escapeField(log.ipAddress),
    ].join(",");
  });

  return [header, ...rows].join("\n");
}

export const auditRouter = router({
  // List audit logs with filtering
  list: protectedProcedure
    .input(
      z.object({
        action: z.string().optional(),
        resource: z.string().optional(),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
        search: z.string().optional(),
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const plan = await getUserPlan(ctx.user.id);
      enforceFeature(plan.planId, "audit_logs", "Audit Logs");

      const result = await queryAuditLogs({
        action: input?.action ?? undefined,
        resource: input?.resource ?? undefined,
        startDate: input?.startDate ?? undefined,
        endDate: input?.endDate ?? undefined,
        search: input?.search ?? undefined,
        limit: input?.limit ?? 50,
        offset: input?.offset ?? 0,
      });

      return result;
    }),

  // Get distinct action types for filter dropdown
  actions: protectedProcedure.query(async ({ ctx }) => {
    const plan = await getUserPlan(ctx.user.id);
    enforceFeature(plan.planId, "audit_logs", "Audit Logs");

    return getDistinctActions();
  }),

  // Get audit log summary stats
  stats: protectedProcedure.query(async ({ ctx }) => {
    const plan = await getUserPlan(ctx.user.id);
    enforceFeature(plan.planId, "audit_logs", "Audit Logs");

    // Get last 24h, 7d, 30d counts
    const now = new Date();
    const day = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const week = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const month = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [last24h, last7d, last30d] = await Promise.all([
      queryAuditLogs({ startDate: day, limit: 1 }),
      queryAuditLogs({ startDate: week, limit: 1 }),
      queryAuditLogs({ startDate: month, limit: 1 }),
    ]);

    return {
      last24h: last24h.total,
      last7d: last7d.total,
      last30d: last30d.total,
    };
  }),

  // Export audit logs as CSV string
  exportCsv: protectedProcedure
    .input(
      z.object({
        action: z.string().optional(),
        resource: z.string().optional(),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
        search: z.string().optional(),
        limit: z.number().min(1).max(10000).default(1000),
      }).optional()
    )
    .mutation(async ({ ctx, input }) => {
      const plan = await getUserPlan(ctx.user.id);
      enforceFeature(plan.planId, "audit_logs", "Audit Logs");

      const result = await queryAuditLogs({
        action: input?.action ?? undefined,
        resource: input?.resource ?? undefined,
        startDate: input?.startDate ?? undefined,
        endDate: input?.endDate ?? undefined,
        search: input?.search ?? undefined,
        limit: input?.limit ?? 1000,
        offset: 0,
      });

      const csv = auditLogsToCsv(result.logs);

      return {
        csv,
        totalExported: result.logs.length,
        totalAvailable: result.total,
        filename: `audit-logs-${new Date().toISOString().split("T")[0]}.csv`,
      };
    }),
});
