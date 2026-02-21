import { z } from "zod";
import { eq, and, desc } from "drizzle-orm";
import { protectedProcedure, router } from "./_core/trpc";
import { customProviders } from "../drizzle/schema";
import { getDb } from "./db";
import { TRPCError } from "@trpc/server";

// ─── Helpers ─────────────────────────────────────────────────────────

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .substring(0, 100);
}

// ─── Router ──────────────────────────────────────────────────────────

export const customProviderRouter = router({
  /** List all custom providers for the current user */
  list: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

    const providers = await db
      .select()
      .from(customProviders)
      .where(eq(customProviders.userId, ctx.user.id))
      .orderBy(desc(customProviders.createdAt));

    return providers;
  }),

  /** Create a new custom provider */
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        icon: z.string().max(10).default("🔌"),
        category: z.string().max(50).default("custom"),
        loginUrl: z.string().url(),
        keysUrl: z.string().url(),
        keyTypes: z.array(z.string().min(1).max(50)).min(1).max(10),
        description: z.string().max(500).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const slug = `custom_${slugify(input.name)}_${Date.now().toString(36)}`;

      const [result] = await db.insert(customProviders).values({
        userId: ctx.user.id,
        name: input.name,
        slug,
        icon: input.icon,
        category: input.category,
        loginUrl: input.loginUrl,
        keysUrl: input.keysUrl,
        keyTypes: input.keyTypes,
        description: input.description || null,
      });

      return {
        id: result.insertId,
        slug,
        success: true,
      };
    }),

  /** Update a custom provider */
  update: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().min(1).max(100).optional(),
        icon: z.string().max(10).optional(),
        category: z.string().max(50).optional(),
        loginUrl: z.string().url().optional(),
        keysUrl: z.string().url().optional(),
        keyTypes: z.array(z.string().min(1).max(50)).min(1).max(10).optional(),
        description: z.string().max(500).optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const { id, ...updates } = input;

      // Verify ownership
      const [existing] = await db
        .select()
        .from(customProviders)
        .where(and(eq(customProviders.id, id), eq(customProviders.userId, ctx.user.id)));

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Custom provider not found" });
      }

      const setValues: Record<string, any> = {};
      if (updates.name !== undefined) setValues.name = updates.name;
      if (updates.icon !== undefined) setValues.icon = updates.icon;
      if (updates.category !== undefined) setValues.category = updates.category;
      if (updates.loginUrl !== undefined) setValues.loginUrl = updates.loginUrl;
      if (updates.keysUrl !== undefined) setValues.keysUrl = updates.keysUrl;
      if (updates.keyTypes !== undefined) setValues.keyTypes = updates.keyTypes;
      if (updates.description !== undefined) setValues.description = updates.description;
      if (updates.isActive !== undefined) setValues.isActive = updates.isActive;

      if (Object.keys(setValues).length > 0) {
        await db
          .update(customProviders)
          .set(setValues)
          .where(eq(customProviders.id, id));
      }

      return { success: true };
    }),

  /** Delete a custom provider */
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      // Verify ownership
      const [existing] = await db
        .select()
        .from(customProviders)
        .where(and(eq(customProviders.id, input.id), eq(customProviders.userId, ctx.user.id)));

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Custom provider not found" });
      }

      await db.delete(customProviders).where(eq(customProviders.id, input.id));

      return { success: true };
    }),
});
