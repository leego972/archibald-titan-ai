/**
 * Web Agent tRPC Router
 *
 * Exposes the Web Agent engine to the frontend:
 * - Submit tasks (natural-language instructions)
 * - Poll task status
 * - Confirm/cancel awaiting tasks
 * - Manage site credentials
 * - View task history
 */

import { z } from "zod";
import { router, adminProcedure } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { enforceAdminFeature } from "./subscription-gate";
import { getDb } from "./db";
import { webAgentTasks, webAgentCredentials } from "../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";
import {
  runWebAgentTask,
  saveCredential,
  listCredentials,
  deleteCredential,
} from "./web-agent-engine";
import { createLogger } from "./_core/logger.js";
import { getErrorMessage } from "./_core/errors.js";
import { consumeCredits, checkCredits } from "./credit-service";

const log = createLogger("WebAgentRouter");

// Active task runners (taskId -> promise)
const activeRunners = new Map<number, Promise<any>>();

export const webAgentRouter = router({
  // ─── Submit a new task ──────────────────────────────────────────────────────
  submitTask: adminProcedure
    .input(
      z.object({
        instruction: z.string().min(5).max(2000),
      })
    )
    .mutation(async ({ input, ctx }) => {
    enforceAdminFeature(ctx.user.role, "Web Agent");
      const creditCheck = await checkCredits(ctx.user.id, "web_agent_task");
      if (!creditCheck.allowed) {
        throw new TRPCError({ code: "FORBIDDEN", message: `Insufficient credits for Web Agent task. Need ${creditCheck.cost}, have ${creditCheck.currentBalance}.` });
      }
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const userId = ctx.user.id;

      // Consume credits upfront before running the task
      try {
        const _cr1 = await consumeCredits(ctx.user.id, "web_agent_task", `Web Agent: ${input.instruction.slice(0, 80)}`);
        if (!_cr1.success) throw new TRPCError({ code: "FORBIDDEN", message: "Insufficient credits. Purchase more credits or upgrade your plan." });
      } catch (e) {
        log.warn("[WebAgent] Credit consumption failed (non-fatal):", { error: getErrorMessage(e) });
      }

      // Create task record
      const result = await db.insert(webAgentTasks).values({
        userId,
        instruction: input.instruction,
        status: "pending",
      });
      const taskId = (result as any).insertId as number;

      // Run task in background (non-blocking)
      const runner = runWebAgentTask(taskId, userId).catch((err) => {
        log.error("Background task runner failed", { taskId, error: getErrorMessage(err) });
      });
      activeRunners.set(taskId, runner);
      runner.finally(() => activeRunners.delete(taskId));

      return { taskId, status: "pending" };
    }),

  // ─── Get task status and result ─────────────────────────────────────────────
  getTask: adminProcedure
    .input(z.object({ taskId: z.number() }))
    .query(async ({ input, ctx }) => {
    enforceAdminFeature(ctx.user.role, "Web Agent");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const tasks = await db
        .select()
        .from(webAgentTasks)
        .where(
          and(
            eq(webAgentTasks.id, input.taskId),
            eq(webAgentTasks.userId, ctx.user.id)
          )
        )
        .limit(1);

      if (!tasks.length) throw new Error("Task not found");
      return tasks[0];
    }),

  // ─── List all tasks for user ────────────────────────────────────────────────
  listTasks: adminProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(20),
      })
    )
    .query(async ({ input, ctx }) => {
    enforceAdminFeature(ctx.user.role, "Web Agent");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      return db
        .select()
        .from(webAgentTasks)
        .where(eq(webAgentTasks.userId, ctx.user.id))
        .orderBy(desc(webAgentTasks.createdAt))
        .limit(input.limit);
    }),

  // ─── Confirm an awaiting task (allow it to proceed) ─────────────────────────
  confirmTask: adminProcedure
    .input(z.object({ taskId: z.number() }))
    .mutation(async ({ input, ctx }) => {
    enforceAdminFeature(ctx.user.role, "Web Agent");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const tasks = await db
        .select()
        .from(webAgentTasks)
        .where(
          and(
            eq(webAgentTasks.id, input.taskId),
            eq(webAgentTasks.userId, ctx.user.id)
          )
        )
        .limit(1);

      if (!tasks.length) throw new Error("Task not found");
      if (tasks[0].status !== "awaiting_confirmation") {
        throw new Error("Task is not awaiting confirmation");
      }

      // Re-run the task (it will pick up from where it left off)
      // For now, mark as pending and re-run
      await db
        .update(webAgentTasks)
        .set({ status: "pending", confirmationRequired: null })
        .where(eq(webAgentTasks.id, input.taskId));

      const runner = runWebAgentTask(input.taskId, ctx.user.id).catch((err) => {
        log.error("Confirmed task runner failed", { taskId: input.taskId, error: getErrorMessage(err) });
      });
      activeRunners.set(input.taskId, runner);
      runner.finally(() => activeRunners.delete(input.taskId));

      return { status: "running" };
    }),

  // ─── Cancel a task ──────────────────────────────────────────────────────────
  cancelTask: adminProcedure
    .input(z.object({ taskId: z.number() }))
    .mutation(async ({ input, ctx }) => {
    enforceAdminFeature(ctx.user.role, "Web Agent");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      await db
        .update(webAgentTasks)
        .set({ status: "cancelled" })
        .where(
          and(
            eq(webAgentTasks.id, input.taskId),
            eq(webAgentTasks.userId, ctx.user.id)
          )
        );
      return { status: "cancelled" };
    }),

  // ─── Delete a task from history ─────────────────────────────────────────────
  deleteTask: adminProcedure
    .input(z.object({ taskId: z.number() }))
    .mutation(async ({ input, ctx }) => {
    enforceAdminFeature(ctx.user.role, "Web Agent");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      await db
        .delete(webAgentTasks)
        .where(
          and(
            eq(webAgentTasks.id, input.taskId),
            eq(webAgentTasks.userId, ctx.user.id)
          )
        );
      return { deleted: true };
    }),

  // ─── Credential Management ───────────────────────────────────────────────────
  listCredentials: adminProcedure.query(async ({ ctx }) => {
    enforceAdminFeature(ctx.user.role, "Web Agent");
    return listCredentials(ctx.user.id);
  }),

  saveCredential: adminProcedure
    .input(
      z.object({
        siteName: z.string().min(1).max(255),
        siteUrl: z.string().url(),
        username: z.string().min(1).max(512),
        password: z.string().min(1).max(1024),
        totpSecret: z.string().optional(),
        notes: z.string().max(1000).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
    enforceAdminFeature(ctx.user.role, "Web Agent");
      const id = await saveCredential(
        ctx.user.id,
        input.siteName,
        input.siteUrl,
        input.username,
        input.password,
        input.totpSecret,
        input.notes
      );
      return { id };
    }),

  deleteCredential: adminProcedure
    .input(z.object({ credentialId: z.number() }))
    .mutation(async ({ input, ctx }) => {
    enforceAdminFeature(ctx.user.role, "Web Agent");
      await deleteCredential(ctx.user.id, input.credentialId);
      return { deleted: true };
    }),
});
