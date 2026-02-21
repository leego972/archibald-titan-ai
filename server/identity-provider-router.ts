import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { protectedProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { identityProviders, users } from "../drizzle/schema";

export const identityProviderRouter = router({
  /**
   * List all identity providers linked to the current user
   */
  list: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];

    const providers = await db
      .select()
      .from(identityProviders)
      .where(eq(identityProviders.userId, ctx.user.id))
      .orderBy(identityProviders.linkedAt);

    return providers.map((p) => ({
      id: p.id,
      provider: p.provider,
      providerAccountId: p.providerAccountId,
      email: p.email,
      displayName: p.displayName,
      avatarUrl: p.avatarUrl,
      linkedAt: p.linkedAt,
      lastUsedAt: p.lastUsedAt,
    }));
  }),

  /**
   * Link a new identity provider to the current user's account
   * This is called after OAuth callback or when adding email auth
   */
  link: protectedProcedure
    .input(
      z.object({
        provider: z.enum(["email", "google", "github"]),
        providerAccountId: z.string().min(1),
        email: z.string().email().optional(),
        displayName: z.string().optional(),
        avatarUrl: z.string().url().optional(),
        metadata: z.record(z.string(), z.unknown()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Check if this provider account is already linked to another user
      const existing = await db
        .select()
        .from(identityProviders)
        .where(
          and(
            eq(identityProviders.provider, input.provider),
            eq(identityProviders.providerAccountId, input.providerAccountId)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        if (existing[0].userId === ctx.user.id) {
          // Already linked to this user — update lastUsedAt
          await db
            .update(identityProviders)
            .set({ lastUsedAt: new Date() })
            .where(eq(identityProviders.id, existing[0].id));
          return { success: true, alreadyLinked: true };
        }
        // Linked to a different user
        throw new Error(
          `This ${input.provider} account is already linked to another user. Please unlink it from the other account first.`
        );
      }

      // Check if user already has this provider type linked (allow multiple emails but one per OAuth)
      if (input.provider !== "email") {
        const existingProvider = await db
          .select()
          .from(identityProviders)
          .where(
            and(
              eq(identityProviders.userId, ctx.user.id),
              eq(identityProviders.provider, input.provider)
            )
          )
          .limit(1);

        if (existingProvider.length > 0) {
          throw new Error(
            `You already have a ${input.provider} account linked. Unlink it first to link a different one.`
          );
        }
      }

      await db.insert(identityProviders).values({
        userId: ctx.user.id,
        provider: input.provider,
        providerAccountId: input.providerAccountId,
        email: input.email || null,
        displayName: input.displayName || null,
        avatarUrl: input.avatarUrl || null,
        metadata: input.metadata || null,
        linkedAt: new Date(),
        lastUsedAt: new Date(),
      });

      return { success: true, alreadyLinked: false };
    }),

  /**
   * Unlink an identity provider from the current user's account
   * Must keep at least one auth method
   */
  unlink: protectedProcedure
    .input(
      z.object({
        providerId: z.number(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Get the provider to unlink
      const providerToUnlink = await db
        .select()
        .from(identityProviders)
        .where(
          and(
            eq(identityProviders.id, input.providerId),
            eq(identityProviders.userId, ctx.user.id)
          )
        )
        .limit(1);

      if (providerToUnlink.length === 0) {
        throw new Error("Provider not found or does not belong to you");
      }

      // Count remaining providers
      const allProviders = await db
        .select()
        .from(identityProviders)
        .where(eq(identityProviders.userId, ctx.user.id));

      // Check if user has a password set (email auth fallback)
      const user = await db
        .select()
        .from(users)
        .where(eq(users.id, ctx.user.id))
        .limit(1);

      const hasPassword = user.length > 0 && !!user[0].passwordHash;
      const remainingProviders = allProviders.length - 1;

      // Must keep at least one auth method
      if (remainingProviders === 0 && !hasPassword) {
        throw new Error(
          "Cannot unlink your last identity provider. You must have at least one way to sign in. Set a password first or link another provider."
        );
      }

      // If unlinking the email provider, make sure they have another way in
      if (providerToUnlink[0].provider === "email" && !hasPassword && remainingProviders === 0) {
        throw new Error(
          "Cannot unlink email provider without a password or another linked provider."
        );
      }

      await db
        .delete(identityProviders)
        .where(eq(identityProviders.id, input.providerId));

      return { success: true };
    }),

  /**
   * Get a summary of linked providers for the current user
   */
  summary: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db)
      return {
        total: 0,
        providers: [] as string[],
        hasEmail: false,
        hasManus: false,
        hasGoogle: false,
        hasGithub: false,
      };

    const providers = await db
      .select()
      .from(identityProviders)
      .where(eq(identityProviders.userId, ctx.user.id));

    const providerNames = providers.map((p) => p.provider);

    return {
      total: providers.length,
      providers: providerNames,
      hasEmail: providerNames.includes("email"),
      hasManus: providerNames.includes("manus"),
      hasGoogle: providerNames.includes("google"),
      hasGithub: providerNames.includes("github"),
    };
  }),
});
