import { z } from "zod";
import { publicProcedure, router, protectedProcedure } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "./db";
import { contactSubmissions } from "../drizzle/schema";
import { desc, eq } from "drizzle-orm";
import { notifyOwner } from "./_core/notification";

export const contactRouter = router({
  /**
   * Public: submit a contact/billing inquiry
   */
  submit: publicProcedure
    .input(
      z.object({
        name: z.string().min(1, "Name is required").max(256),
        email: z.string().email("Valid email is required").max(320),
        category: z.enum(["billing", "technical", "account", "general"]),
        subject: z.string().min(1, "Subject is required").max(512),
        message: z.string().min(10, "Message must be at least 10 characters").max(5000),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      await db.insert(contactSubmissions).values({
        name: input.name,
        email: input.email,
        category: input.category,
        subject: input.subject,
        message: input.message,
      });

      // Notify the owner about the new submission
      await notifyOwner({
        title: `New Contact: [${input.category.toUpperCase()}] ${input.subject}`,
        content: `From: ${input.name} (${input.email})\nCategory: ${input.category}\n\n${input.message}`,
      });

      return { success: true };
    }),

  /**
   * Admin: list all contact submissions
   */
  list: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role !== "admin") {
      throw new TRPCError({ code: "FORBIDDEN", message: "Admin only" });
    }
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
    return db.select().from(contactSubmissions).orderBy(desc(contactSubmissions.createdAt)).limit(100);
  }),

  /**
   * Admin: update submission status
   */
  updateStatus: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        status: z.enum(["new", "in_progress", "resolved", "closed"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Admin only" });
      }
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      await db.update(contactSubmissions).set({ status: input.status }).where(eq(contactSubmissions.id, input.id));
      return { success: true };
    }),
});
