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
import { router, protectedProcedure } from "./_core/trpc";
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

const log = createLogger("WebAgentRouter");

// Active task runners (taskId -> promise)
const activeRunners = new Map<number, Promise<any>>();

export const webAgentRouter = router({
  // ─── Submit a new task ──────────────────────────────────────────────────────
  submitTask: protectedProcedure
    .input(
      z.object({
        instruction: z.string().min(5).max(2000),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const userId = ctx.user.id;

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
  getTask: protectedProcedure
    .input(z.object({ taskId: z.number() }))
    .query(async ({ input, ctx }) => {
      const db = getDb();
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
  listTasks: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(20),
      })
    )
    .query(async ({ input, ctx }) => {
      const db = getDb();
      return db
        .select()
        .from(webAgentTasks)
        .where(eq(webAgentTasks.userId, ctx.user.id))
        .orderBy(desc(webAgentTasks.createdAt))
        .limit(input.limit);
    }),

  // ─── Confirm an awaiting task (allow it to proceed) ─────────────────────────
  confirmTask: protectedProcedure
    .input(z.object({ taskId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
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
  cancelTask: protectedProcedure
    .input(z.object({ taskId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
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
  deleteTask: protectedProcedure
    .input(z.object({ taskId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
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
  listCredentials: protectedProcedure.query(async ({ ctx }) => {
    return listCredentials(ctx.user.id);
  }),

  saveCredential: protectedProcedure
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

  deleteCredential: protectedProcedure
    .input(z.object({ credentialId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      await deleteCredential(ctx.user.id, input.credentialId);
      return { deleted: true };
    }),
});
