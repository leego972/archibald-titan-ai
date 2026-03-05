import { z } from "zod";
import { eq } from "drizzle-orm";
import { protectedProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { users } from "../drizzle/schema";

export const customInstructionsRouter = router({
  /**
   * Get the current user's custom instructions.
   */
  get: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return { customInstructions: null };
    const rows = await db
      .select({ customInstructions: users.customInstructions })
      .from(users)
      .where(eq(users.id, ctx.user.id))
      .limit(1);
    return { customInstructions: rows[0]?.customInstructions ?? null };
  }),

  /**
   * Save the current user's custom instructions.
   * Max 2000 characters. Cannot override system rules.
   */
  save: protectedProcedure
    .input(
      z.object({
        customInstructions: z.string().max(2000).nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      await db
        .update(users)
        .set({ customInstructions: input.customInstructions })
        .where(eq(users.id, ctx.user.id));
      return { success: true };
    }),
});
