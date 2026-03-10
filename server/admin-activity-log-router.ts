/**
 * Admin Activity Log Router
 *
 * Provides tRPC endpoints for admins to view their own activity log.
 * Every endpoint enforces admin/head_admin role — regular users will
 * receive a generic "Access denied" error with no indication that
 * this endpoint or table exists.
 */
import { z } from "zod";
import { router, protectedProcedure } from "./_core/trpc";
import {
  queryAdminActivityLogs,
  requireAdminRole,
  type AdminActivityCategory,
} from "./admin-activity-log";

const categoryEnum = z.enum([
  "user_management",
  "subscription",
  "specialised_tools",
  "releases",
  "self_improvement",
  "system",
  "security",
]);

export const adminActivityLogRouter = router({
  /**
   * List admin activity log entries with optional filtering.
   * Admin/head_admin only.
   */
  list: protectedProcedure
    .input(
      z.object({
        category: categoryEnum.optional(),
        action: z.string().optional(),
        adminId: z.number().optional(),
        targetUserId: z.number().optional(),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
        search: z.string().optional(),
        limit: z.number().min(1).max(200).default(50),
        offset: z.number().min(0).default(0),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      requireAdminRole(ctx.user.role);
      return queryAdminActivityLogs({
        category: input?.category as AdminActivityCategory | undefined,
        action: input?.action,
        adminId: input?.adminId,
        targetUserId: input?.targetUserId,
        startDate: input?.startDate,
        endDate: input?.endDate,
        search: input?.search,
        limit: input?.limit ?? 50,
        offset: input?.offset ?? 0,
      });
    }),

  /**
   * Summary stats for the admin activity log.
   * Admin/head_admin only.
   */
  stats: protectedProcedure.query(async ({ ctx }) => {
    requireAdminRole(ctx.user.role);
    const now = new Date();
    const day = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const week = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const month = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [last24h, last7d, last30d, specialised] = await Promise.all([
      queryAdminActivityLogs({ startDate: day, limit: 1 }),
      queryAdminActivityLogs({ startDate: week, limit: 1 }),
      queryAdminActivityLogs({ startDate: month, limit: 1 }),
      queryAdminActivityLogs({ category: "specialised_tools", limit: 1 }),
    ]);

    return {
      last24h: last24h.total,
      last7d: last7d.total,
      last30d: last30d.total,
      specialisedTotal: specialised.total,
    };
  }),

  /**
   * Export admin activity log as CSV.
   * Admin/head_admin only.
   */
  exportCsv: protectedProcedure
    .input(
      z.object({
        category: categoryEnum.optional(),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
        limit: z.number().min(1).max(10000).default(1000),
      }).optional()
    )
    .mutation(async ({ ctx, input }) => {
      requireAdminRole(ctx.user.role);
      const result = await queryAdminActivityLogs({
        category: input?.category as AdminActivityCategory | undefined,
        startDate: input?.startDate,
        endDate: input?.endDate,
        limit: input?.limit ?? 1000,
        offset: 0,
      });

      const header = "ID,Timestamp,Admin ID,Admin Email,Admin Role,Action,Category,Target User ID,Target User Email,Success,IP Address";
      const rows = result.logs.map((log: any) => {
        const ts = log.createdAt instanceof Date
          ? log.createdAt.toISOString()
          : String(log.createdAt);
        const esc = (v: string | null | undefined) => {
          if (!v) return "";
          const s = String(v);
          return s.includes(",") || s.includes('"') || s.includes("\n")
            ? '"' + s.replace(/"/g, '""') + '"'
            : s;
        };
        return [
          log.id,
          ts,
          log.adminId,
          esc(log.adminEmail),
          esc(log.adminRole),
          esc(log.action),
          esc(log.category),
          log.targetUserId ?? "",
          esc(log.targetUserEmail),
          log.success ? "true" : "false",
          esc(log.ipAddress),
        ].join(",");
      });

      return {
        csv: [header, ...rows].join("\n"),
        totalExported: result.logs.length,
        totalAvailable: result.total,
      };
    }),
});
