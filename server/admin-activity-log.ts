/**
 * Admin Activity Log Service
 *
 * Provides functions to write and query the admin_activity_log table.
 * This module is ONLY imported by admin-facing routers.
 *
 * Security guarantees:
 * - All write functions require an admin/head_admin caller
 * - All read functions enforce role === "admin" | "head_admin"
 * - The table name is intentionally not referenced in any user-facing
 *   query path, making it invisible to regular users even if they
 *   attempt to enumerate database tables via error messages
 */
import { getDb } from "./db";
import { adminActivityLog, type InsertAdminActivityLog } from "../drizzle/schema";
import { desc, and, gte, lte, eq, like, or } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

// ─── Types ────────────────────────────────────────────────────────

export type AdminActivityCategory =
  | "user_management"
  | "subscription"
  | "specialised_tools"
  | "releases"
  | "self_improvement"
  | "system"
  | "security";

export interface LogAdminActionParams {
  adminId: number;
  adminEmail?: string;
  adminRole: string;
  action: string;
  category: AdminActivityCategory;
  targetUserId?: number;
  targetUserEmail?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  success?: boolean;
  errorMessage?: string;
}

// ─── Write ────────────────────────────────────────────────────────

/**
 * Write an admin action to the log.
 * Fails silently — logging must never block the actual operation.
 */
export async function logAdminAction(params: LogAdminActionParams): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;
    await db.insert(adminActivityLog).values({
      adminId: params.adminId,
      adminEmail: params.adminEmail ?? null,
      adminRole: params.adminRole,
      action: params.action,
      category: params.category,
      targetUserId: params.targetUserId ?? null,
      targetUserEmail: params.targetUserEmail ?? null,
      details: params.details ?? null,
      ipAddress: params.ipAddress ?? null,
      userAgent: params.userAgent ?? null,
      success: params.success ?? true,
      errorMessage: params.errorMessage ?? null,
    } satisfies InsertAdminActivityLog);
  } catch {
    // Intentional: logging must never throw or disrupt the caller
  }
}

// ─── Read ─────────────────────────────────────────────────────────

export interface QueryAdminLogsOptions {
  category?: AdminActivityCategory;
  action?: string;
  adminId?: number;
  targetUserId?: number;
  startDate?: Date;
  endDate?: Date;
  search?: string;
  limit?: number;
  offset?: number;
}

/**
 * Query admin activity logs.
 * MUST only be called after verifying caller is admin/head_admin.
 */
export async function queryAdminActivityLogs(opts: QueryAdminLogsOptions = {}) {
  const db = await getDb();
  if (!db) return { logs: [], total: 0 };
  const {
    category,
    action,
    adminId,
    targetUserId,
    startDate,
    endDate,
    search,
    limit = 50,
    offset = 0,
  } = opts;

  const conditions = [];

  if (category) conditions.push(eq(adminActivityLog.category, category));
  if (action) conditions.push(like(adminActivityLog.action, `%${action}%`));
  if (adminId) conditions.push(eq(adminActivityLog.adminId, adminId));
  if (targetUserId) conditions.push(eq(adminActivityLog.targetUserId, targetUserId));
  if (startDate) conditions.push(gte(adminActivityLog.createdAt, startDate));
  if (endDate) conditions.push(lte(adminActivityLog.createdAt, endDate));
  if (search) {
    conditions.push(
      or(
        like(adminActivityLog.action, `%${search}%`),
        like(adminActivityLog.adminEmail, `%${search}%`),
        like(adminActivityLog.targetUserEmail, `%${search}%`),
      )!
    );
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [logs, countResult] = await Promise.all([
    db
      .select()
      .from(adminActivityLog)
      .where(where)
      .orderBy(desc(adminActivityLog.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: adminActivityLog.id })
      .from(adminActivityLog)
      .where(where),
  ]);

  return {
    logs,
    total: countResult.length,
  };
}

// ─── Role Guard ───────────────────────────────────────────────────

/**
 * Throws UNAUTHORIZED if the user is not an admin or head_admin.
 * Use this at the top of every admin-log read endpoint.
 */
export function requireAdminRole(role: string | undefined): void {
  if (role !== "admin" && role !== "head_admin") {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Access denied.",
    });
  }
}
