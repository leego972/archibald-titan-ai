/**
 * Virelle Studios Router
 *
 * Scene management system for directors. All procedures require admin role.
 * External scenes are added WITHOUT any AI content censorship — directors
 * have full creative freedom. Copyright responsibility rests solely with
 * the director per the Terms of Service.
 */
import { z } from "zod";
import { eq, and, desc } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { adminProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { virelleDirectors, virelleScenes } from "../drizzle/schema";
import { createLogger } from "./_core/logger.js";

const log = createLogger("Virelle");

// ─── Input Schemas ────────────────────────────────────────────────────────────

const updateProfileInput = z.object({
  studioName: z.string().min(1).max(255),
  bio: z.string().max(2000).optional(),
});

const createSceneInput = z.object({
  title: z.string().min(1).max(255),
  description: z.string().max(5000).optional(),
  type: z.enum(["internal", "external"]),
  externalUrl: z.string().url().optional(),
  externalSource: z.string().max(128).optional(),
  notes: z.string().max(5000).optional(),
  // Director must explicitly acknowledge copyright for external scenes
  copyrightAcknowledged: z.boolean().optional(),
});

const updateSceneInput = z.object({
  sceneId: z.number().int().positive(),
  title: z.string().min(1).max(255).optional(),
  description: z.string().max(5000).optional(),
  externalUrl: z.string().url().optional().nullable(),
  externalSource: z.string().max(128).optional().nullable(),
  notes: z.string().max(5000).optional(),
  status: z.enum(["draft", "published", "archived"]).optional(),
  content: z.record(z.unknown()).optional(),
});

const sceneIdInput = z.object({
  sceneId: z.number().int().positive(),
});

// ─── Helper: ensure director profile exists ───────────────────────────────────

async function ensureDirectorProfile(userId: number) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

  const [existing] = await db
    .select()
    .from(virelleDirectors)
    .where(eq(virelleDirectors.userId, userId))
    .limit(1);

  if (existing) return existing;

  // Auto-create a director profile on first access
  await db.insert(virelleDirectors).values({
    userId,
    studioName: "My Studio",
  });

  const [created] = await db
    .select()
    .from(virelleDirectors)
    .where(eq(virelleDirectors.userId, userId))
    .limit(1);

  return created!;
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const virelleRouter = router({
  /**
   * Get or auto-create the director profile for the current admin user.
   */
  getDirectorProfile: adminProcedure.query(async ({ ctx }) => {
    const userId = ctx.user.id;
    const profile = await ensureDirectorProfile(userId);
    return profile;
  }),

  /**
   * Update the director's studio name and bio.
   */
  updateDirectorProfile: adminProcedure
    .input(updateProfileInput)
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.id;
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const profile = await ensureDirectorProfile(userId);

      await db
        .update(virelleDirectors)
        .set({
          studioName: input.studioName,
          bio: input.bio ?? null,
        })
        .where(eq(virelleDirectors.id, profile.id));

      log.info(`[Virelle] Director ${userId} updated profile: ${input.studioName}`);
      return { success: true };
    }),

  /**
   * List all scenes for the current director.
   */
  listScenes: adminProcedure.query(async ({ ctx }) => {
    const userId = ctx.user.id;
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

    const profile = await ensureDirectorProfile(userId);

    const scenes = await db
      .select()
      .from(virelleScenes)
      .where(eq(virelleScenes.directorId, profile.id))
      .orderBy(desc(virelleScenes.createdAt));

    return scenes;
  }),

  /**
   * Get a single scene by ID (must belong to the current director).
   */
  getScene: adminProcedure.input(sceneIdInput).query(async ({ ctx, input }) => {
    const userId = ctx.user.id;
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

    const [scene] = await db
      .select()
      .from(virelleScenes)
      .where(
        and(
          eq(virelleScenes.id, input.sceneId),
          eq(virelleScenes.userId, userId)
        )
      )
      .limit(1);

    if (!scene) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Scene not found" });
    }

    return scene;
  }),

  /**
   * Create a new scene.
   *
   * External scenes: No content censorship applied. The director is solely
   * responsible for copyright compliance per the Virelle Studios Terms of Service.
   * "Any copyright material used without permission is the sole responsibility
   * of the user and Virelle Studios are not liable for any misuse."
   */
  createScene: adminProcedure.input(createSceneInput).mutation(async ({ ctx, input }) => {
    const userId = ctx.user.id;
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

    const profile = await ensureDirectorProfile(userId);

    // For external scenes, validate that a URL is provided
    if (input.type === "external" && !input.externalUrl) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "External scenes require a URL.",
      });
    }

    await db.insert(virelleScenes).values({
      directorId: profile.id,
      userId,
      title: input.title,
      description: input.description ?? null,
      type: input.type,
      externalUrl: input.externalUrl ?? null,
      externalSource: input.externalSource ?? null,
      notes: input.notes ?? null,
      status: "draft",
      copyrightAcknowledged: input.copyrightAcknowledged ?? false,
    });

    // Fetch the newly created scene
    const [created] = await db
      .select()
      .from(virelleScenes)
      .where(eq(virelleScenes.userId, userId))
      .orderBy(desc(virelleScenes.createdAt))
      .limit(1);

    log.info(`[Virelle] Director ${userId} created scene: "${input.title}" (${input.type})`);
    return created!;
  }),

  /**
   * Update an existing scene.
   */
  updateScene: adminProcedure.input(updateSceneInput).mutation(async ({ ctx, input }) => {
    const userId = ctx.user.id;
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

    // Verify ownership
    const [scene] = await db
      .select()
      .from(virelleScenes)
      .where(
        and(
          eq(virelleScenes.id, input.sceneId),
          eq(virelleScenes.userId, userId)
        )
      )
      .limit(1);

    if (!scene) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Scene not found" });
    }

    const updateData: Partial<typeof virelleScenes.$inferInsert> = {};
    if (input.title !== undefined) updateData.title = input.title;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.externalUrl !== undefined) updateData.externalUrl = input.externalUrl;
    if (input.externalSource !== undefined) updateData.externalSource = input.externalSource;
    if (input.notes !== undefined) updateData.notes = input.notes;
    if (input.status !== undefined) updateData.status = input.status;
    if (input.content !== undefined) updateData.content = input.content;

    await db
      .update(virelleScenes)
      .set(updateData)
      .where(eq(virelleScenes.id, input.sceneId));

    log.info(`[Virelle] Director ${userId} updated scene ${input.sceneId}`);
    return { success: true };
  }),

  /**
   * Delete a scene.
   */
  deleteScene: adminProcedure.input(sceneIdInput).mutation(async ({ ctx, input }) => {
    const userId = ctx.user.id;
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

    // Verify ownership
    const [scene] = await db
      .select()
      .from(virelleScenes)
      .where(
        and(
          eq(virelleScenes.id, input.sceneId),
          eq(virelleScenes.userId, userId)
        )
      )
      .limit(1);

    if (!scene) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Scene not found" });
    }

    await db
      .delete(virelleScenes)
      .where(eq(virelleScenes.id, input.sceneId));

    log.info(`[Virelle] Director ${userId} deleted scene ${input.sceneId}`);
    return { success: true };
  }),
});
