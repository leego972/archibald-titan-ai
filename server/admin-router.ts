/**
 * Admin Router — User management panel for admin users.
 *
 * All procedures use adminProcedure — only users with role="admin" can access.
 * Provides: list users, view user details, update role, ban/unban,
 * reset password, and system stats.
 */

import { z } from "zod";
import { eq, desc, asc, like, or, sql, and, count } from "drizzle-orm";
import { adminProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import {
  users,
  fetcherCredentials,
  fetcherJobs,
  identityProviders,
  subscriptions,
  creditBalances,
  creditTransactions,
  teamMembers,
  apiKeys,
  selfModificationLog,
  systemSnapshots,
  userSecrets,
} from "../drizzle/schema";
import { decrypt } from "./fetcher-db";
import { logAudit } from "./audit-log-db";
import { logAdminAction } from "./admin-activity-log";
import { addCredits } from "./credit-service";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { isAdminRole } from '@shared/const';
import { getAllVeniceUsage, resetVeniceUsage, VENICE_DAILY_LIMITS } from "./venice-usage-limiter";

export const adminRouter = router({
  /**
   * List all users with pagination, search, and filters.
   */
  listUsers: adminProcedure
    .input(
      z.object({
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(100).default(20),
        search: z.string().optional(),
        role: z.enum(["all", "user", "admin", "head_admin"]).default("all"),
        sortBy: z.enum(["createdAt", "lastSignedIn", "name", "email"]).default("createdAt"),
        sortOrder: z.enum(["asc", "desc"]).default("desc"),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      const offset = (input.page - 1) * input.limit;

      // Build where conditions
      const conditions: import("drizzle-orm").SQL<unknown>[] = [];

      if (input.search) {
        const searchPattern = `%${input.search}%`;
        conditions.push(
          or(
            like(users.name, searchPattern),
            like(users.email, searchPattern),
            like(users.openId, searchPattern)
          )!
        );
      }

      if (input.role !== "all") {
        conditions.push(eq(users.role, input.role));
      }

      const whereClause: import("drizzle-orm").SQL<unknown> | undefined = conditions.length > 0 ? and(...conditions) : undefined;

      // Get total count
      const [countResult] = await db
        .select({ total: count() })
        .from(users)
        .where(whereClause);

      // Get users
      const sortCol =
        input.sortBy === "name" ? users.name :
        input.sortBy === "email" ? users.email :
        input.sortBy === "lastSignedIn" ? users.lastSignedIn :
        users.createdAt;

      const orderFn = input.sortOrder === "asc" ? asc(sortCol) : desc(sortCol);

      const rows = await db
        .select({
          id: users.id,
          openId: users.openId,
          name: users.name,
          email: users.email,
          role: users.role,
          loginMethod: users.loginMethod,
          emailVerified: users.emailVerified,
          twoFactorEnabled: users.twoFactorEnabled,
          onboardingCompleted: users.onboardingCompleted,
          createdAt: users.createdAt,
          lastSignedIn: users.lastSignedIn,
        })
        .from(users)
        .where(whereClause)
        .orderBy(orderFn)
        .limit(input.limit)
        .offset(offset);

      return {
        users: rows,
        total: countResult.total,
        page: input.page,
        totalPages: Math.ceil(countResult.total / input.limit),
      };
    }),

  /**
   * Get detailed info about a specific user.
   */
  getUser: adminProcedure
    .input(z.object({ userId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      const [user] = await db
        .select({
          id: users.id,
          openId: users.openId,
          name: users.name,
          email: users.email,
          role: users.role,
          loginMethod: users.loginMethod,
          emailVerified: users.emailVerified,
          twoFactorEnabled: users.twoFactorEnabled,
          onboardingCompleted: users.onboardingCompleted,
          createdAt: users.createdAt,
          updatedAt: users.updatedAt,
          lastSignedIn: users.lastSignedIn,
        })
        .from(users)
        .where(eq(users.id, input.userId))
        .limit(1);

      if (!user) throw new Error("User not found");

      // Get linked providers
      const providers = await db
        .select({
          provider: identityProviders.provider,
          email: identityProviders.email,
          createdAt: identityProviders.createdAt,
        })
        .from(identityProviders)
        .where(eq(identityProviders.userId, input.userId));

      // Get credential count
      const [credCount] = await db
        .select({ total: count() })
        .from(fetcherCredentials)
        .where(eq(fetcherCredentials.userId, input.userId));

      // Get job count
      const [jobCount] = await db
        .select({ total: count() })
        .from(fetcherJobs)
        .where(eq(fetcherJobs.userId, input.userId));

      // Get subscription
      const [sub] = await db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.userId, input.userId))
        .limit(1);

      // Get API key count
      const [keyCount] = await db
        .select({ total: count() })
        .from(apiKeys)
        .where(eq(apiKeys.userId, input.userId));

      return {
        ...user,
        providers,
        stats: {
          credentials: credCount.total,
          jobs: jobCount.total,
          apiKeys: keyCount.total,
          subscription: sub
            ? { plan: sub.plan, status: sub.status }
            : null,
        },
      };
    }),

  /**
   * Update a user's role.
   */
  updateRole: adminProcedure
    .input(
      z.object({
        userId: z.number(),
        role: z.enum(["user", "admin", "head_admin"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      // Prevent self-demotion
      if (input.userId === ctx.user.id && !isAdminRole(input.role)) {
        throw new Error("You cannot remove your own admin role.");
      }

      await db
        .update(users)
        .set({ role: input.role })
        .where(eq(users.id, input.userId));

      await logAudit({
        userId: ctx.user.id,
        userName: ctx.user.name || "Admin",
        action: "admin.update_role",
        resource: "user",
        resourceId: String(input.userId),
        details: { change: "role", newRole: input.role },
        ipAddress: ctx.req.ip || "unknown",
      });

      return { success: true };
    }),

  /**
   * Reset a user's password (generates a random temporary password).
   */
  resetPassword: adminProcedure
    .input(z.object({ userId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      const [user] = await db
        .select({ id: users.id, loginMethod: users.loginMethod })
        .from(users)
        .where(eq(users.id, input.userId))
        .limit(1);

      if (!user) throw new Error("User not found");
      if (user.loginMethod !== "email") {
        throw new Error("Cannot reset password for OAuth-only users.");
      }

      // Generate temporary password
      const tempPassword = crypto.randomBytes(12).toString("base64url").slice(0, 16);
      const hash = await bcrypt.hash(tempPassword, 12);

      await db
        .update(users)
        .set({ passwordHash: hash })
        .where(eq(users.id, input.userId));

      await logAudit({
        userId: ctx.user.id,
        userName: ctx.user.name || "Admin",
        action: "admin.reset_password",
        resource: "user",
        resourceId: String(input.userId),
        details: { action: "password_reset" },
        ipAddress: ctx.req.ip || "unknown",
      });

      return { success: true, tempPassword };
    }),

  /**
   * Disable 2FA for a user (admin override).
   */
  disable2FA: adminProcedure
    .input(z.object({ userId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      await db
        .update(users)
        .set({
          twoFactorEnabled: false,
          twoFactorSecret: null,
          twoFactorBackupCodes: null,
        })
        .where(eq(users.id, input.userId));

      await logAudit({
        userId: ctx.user.id,
        userName: ctx.user.name || "Admin",
        action: "admin.disable_2fa",
        resource: "user",
        resourceId: String(input.userId),
        details: { action: "2fa_disabled" },
        ipAddress: ctx.req.ip || "unknown",
      });

      return { success: true };
    }),

  /**
   * Delete a user account (soft — marks as deleted, doesn't remove data).
   * For now, we actually delete since there's no "deleted" flag in schema.
   * In production, you'd add a deletedAt column.
   */
  deleteUser: adminProcedure
    .input(z.object({ userId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      // Prevent self-deletion
      if (input.userId === ctx.user.id) {
        throw new Error("You cannot delete your own account from the admin panel.");
      }

      // Check user exists
      const [user] = await db
        .select({ id: users.id, name: users.name, email: users.email })
        .from(users)
        .where(eq(users.id, input.userId))
        .limit(1);

      if (!user) throw new Error("User not found");

      // Delete user's related data first
      await db.delete(identityProviders).where(eq(identityProviders.userId, input.userId));
      await db.delete(apiKeys).where(eq(apiKeys.userId, input.userId));
      await db.delete(teamMembers).where(eq(teamMembers.userId, input.userId));
      await db.delete(fetcherCredentials).where(eq(fetcherCredentials.userId, input.userId));
      await db.delete(fetcherJobs).where(eq(fetcherJobs.userId, input.userId));
      await db.delete(subscriptions).where(eq(subscriptions.userId, input.userId));

      // Delete the user
      await db.delete(users).where(eq(users.id, input.userId));

      await logAudit({
        userId: ctx.user.id,
        userName: ctx.user.name || "Admin",
        action: "admin.delete_user",
        resource: "user",
        resourceId: String(input.userId),
        details: { deletedUser: user.name || user.email },
        ipAddress: ctx.req.ip || "unknown",
      });

      return { success: true };
    }),

  /**
   * Get system-wide stats for the admin dashboard.
   */
  systemStats: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database unavailable");

    const [userCount] = await db.select({ total: count() }).from(users);
    const [adminCount] = await db
      .select({ total: count() })
      .from(users)
      .where(eq(users.role, "admin"));
    const [credCount] = await db.select({ total: count() }).from(fetcherCredentials);
    const [jobCount] = await db.select({ total: count() }).from(fetcherJobs);
    const [keyCount] = await db.select({ total: count() }).from(apiKeys);
    const [subCount] = await db
      .select({ total: count() })
      .from(subscriptions)
      .where(eq(subscriptions.status, "active"));
    const [snapshotCount] = await db.select({ total: count() }).from(systemSnapshots);
    const [modCount] = await db.select({ total: count() }).from(selfModificationLog);

    // Recent signups (last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const [recentSignups] = await db
      .select({ total: count() })
      .from(users)
      .where(sql`${users.createdAt} >= ${sevenDaysAgo}`);

    return {
      totalUsers: userCount.total,
      adminUsers: adminCount.total,
      totalCredentials: credCount.total,
      totalJobs: jobCount.total,
      totalApiKeys: keyCount.total,
      activeSubscriptions: subCount.total,
      systemSnapshots: snapshotCount.total,
      selfModifications: modCount.total,
      recentSignups: recentSignups.total,
    };
  }),

  // ─── Marketing Email Export ─────────────────────────────────────────
  exportMarketingEmails: adminProcedure
    .input(z.object({
      consentOnly: z.boolean().default(true),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { emails: [], total: 0 };
      try {
        const consentOnly = input?.consentOnly ?? true;
        const conditions: any[] = [
          sql`${users.email} IS NOT NULL`,
          sql`${users.email} != ''`,
        ];
        if (consentOnly) {
          conditions.push(sql`COALESCE(${users.marketingConsent}, true) = true`);
        }
        const results = await db
          .select({
            id: users.id,
            name: users.name,
            email: users.email,
            loginCount: users.loginCount,
            lastSignedIn: users.lastSignedIn,
            createdAt: users.createdAt,
            marketingConsent: users.marketingConsent,
          })
          .from(users)
          .where(and(...conditions))
          .orderBy(desc(users.lastSignedIn));
        return {
          emails: results,
          total: results.length,
        };
      } catch (err) {
        // Fallback if new columns don't exist yet
        const results = await db
          .select({ id: users.id, name: users.name, email: users.email, lastSignedIn: users.lastSignedIn, createdAt: users.createdAt })
          .from(users)
          .where(and(sql`${users.email} IS NOT NULL`, sql`${users.email} != ''`))
          .orderBy(desc(users.lastSignedIn));
        return { emails: results.map(r => ({ ...r, loginCount: 0, marketingConsent: true })), total: results.length };
      }
    }),

  // ─── Grant Subscription (Admin Comp) ─────────────────────────────────
  /**
   * Grant a subscription plan to a user without requiring Stripe payment.
   * Used for comp'd accounts, beta testers, partners, etc.
   */
  grantSubscription: adminProcedure
    .input(
      z.object({
        email: z.string().email(),
        plan: z.enum(["pro", "enterprise", "cyber", "cyber_plus", "titan"]),
        durationMonths: z.number().min(1).max(120).default(12),
        reason: z.string().min(1),
        grantCredits: z.boolean().default(true),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      // Find user by email
      const [user] = await db
        .select({ id: users.id, name: users.name, email: users.email })
        .from(users)
        .where(eq(users.email, input.email))
        .limit(1);

      if (!user) {
        throw new Error(`No user found with email: ${input.email}. They must sign up first.`);
      }

      // Calculate period end
      const periodEnd = new Date();
      periodEnd.setMonth(periodEnd.getMonth() + input.durationMonths);

      // Check for existing subscription
      const existing = await db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.userId, user.id))
        .limit(1);

      if (existing.length > 0) {
        // Update existing subscription
        await db
          .update(subscriptions)
          .set({
            plan: input.plan,
            status: "active",
            currentPeriodEnd: periodEnd,
            stripeCustomerId: existing[0].stripeCustomerId || `admin_comp_${user.id}`,
          })
          .where(eq(subscriptions.userId, user.id));
      } else {
        // Create new subscription record
        await db.insert(subscriptions).values({
          userId: user.id,
          stripeCustomerId: `admin_comp_${user.id}`,
          stripeSubscriptionId: `admin_grant_${Date.now()}`,
          plan: input.plan,
          status: "active",
          currentPeriodEnd: periodEnd,
        });
      }

      // Grant credits based on plan tier
      if (input.grantCredits) {
        const creditAmounts: Record<string, number> = {
          pro: 5000,
          enterprise: 25000,
          cyber: 100000,
          cyber_plus: 500000,
          titan: -1, // unlimited
        };
        const amount = creditAmounts[input.plan] || 5000;

        if (amount === -1) {
          // Set unlimited for Titan tier
          const { setUnlimited } = await import("./credit-service");
          await setUnlimited(user.id, true);
        } else {
          await addCredits(
            user.id,
            amount,
            "admin_adjustment",
            `Admin grant: ${input.plan} plan comp'd by ${ctx.user.name || "admin"} — ${input.reason}`
          );
        }
      }

      await logAudit({
        userId: ctx.user.id,
        userName: ctx.user.name || "Admin",
        action: "admin.grant_subscription",
        resource: "user",
        resourceId: String(user.id),
        details: {
          email: input.email,
          plan: input.plan,
          durationMonths: input.durationMonths,
          reason: input.reason,
          grantCredits: input.grantCredits,
          periodEnd: periodEnd.toISOString(),
        },
        ipAddress: ctx.req.ip || "unknown",
      });

      return {
        success: true,
        userId: user.id,
        userName: user.name,
        email: user.email,
        plan: input.plan,
        periodEnd: periodEnd.toISOString(),
        creditsGranted: input.grantCredits,
      };
    }),

  /**
   * Admin: List all stored API tokens/credentials across all users (metadata only, no values).
   * Organised by user, showing secretType, label, and timestamps.
   */
  listAllUserCredentials: adminProcedure
    .input(
      z.object({
        userId: z.number().optional(),
        secretType: z.string().optional(),
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(200).default(50),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const offset = (input.page - 1) * input.limit;
      const conditions: ReturnType<typeof eq>[] = [];
      if (input.userId) conditions.push(eq(userSecrets.userId, input.userId));
      if (input.secretType) conditions.push(eq(userSecrets.secretType, input.secretType));
      const rows = await db
        .select({
          id: userSecrets.id,
          userId: userSecrets.userId,
          userName: users.name,
          userEmail: users.email,
          secretType: userSecrets.secretType,
          label: userSecrets.label,
          lastUsedAt: userSecrets.lastUsedAt,
          createdAt: userSecrets.createdAt,
          updatedAt: userSecrets.updatedAt,
        })
        .from(userSecrets)
        .leftJoin(users, eq(userSecrets.userId, users.id))
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(userSecrets.createdAt))
        .limit(input.limit)
        .offset(offset);
      const [totalRow] = await db
        .select({ count: count() })
        .from(userSecrets)
        .where(conditions.length > 0 ? and(...conditions) : undefined);
      return {
        credentials: rows.map((r) => ({
          id: r.id,
          userId: r.userId,
          userName: r.userName || "Unknown",
          userEmail: r.userEmail || "Unknown",
          secretType: r.secretType,
          label: r.label || r.secretType,
          lastUsedAt: r.lastUsedAt?.toISOString() || null,
          createdAt: r.createdAt.toISOString(),
          updatedAt: r.updatedAt.toISOString(),
        })),
        total: totalRow?.count ?? 0,
        page: input.page,
        limit: input.limit,
      };
    }),

  /**
   * Admin: Retrieve the decrypted value of a specific credential by ID.
   * All retrievals are audit-logged with reason.
   */
  retrieveCredentialValue: adminProcedure
    .input(
      z.object({
        credentialId: z.number(),
        reason: z.string().min(1, "Reason is required for audit log"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const [row] = await db
        .select({
          id: userSecrets.id,
          userId: userSecrets.userId,
          secretType: userSecrets.secretType,
          label: userSecrets.label,
          encryptedValue: userSecrets.encryptedValue,
          userName: users.name,
          userEmail: users.email,
        })
        .from(userSecrets)
        .leftJoin(users, eq(userSecrets.userId, users.id))
        .where(eq(userSecrets.id, input.credentialId))
        .limit(1);
      if (!row) throw new Error("Credential not found");
      let decryptedValue: string;
      try {
        decryptedValue = decrypt(row.encryptedValue);
      } catch {
        throw new Error("Failed to decrypt credential — encryption key mismatch");
      }
      await logAudit({
        userId: ctx.user.id,
        userName: ctx.user.name || "Admin",
        action: "admin.retrieve_credential",
        resource: "user_secret",
        resourceId: String(row.id),
        details: {
          targetUserId: row.userId,
          targetUserEmail: row.userEmail,
          secretType: row.secretType,
          label: row.label,
          reason: input.reason,
        },
        ipAddress: ctx.req?.ip || "unknown",
      });
      return {
        id: row.id,
        userId: row.userId,
        userName: row.userName || "Unknown",
        userEmail: row.userEmail || "Unknown",
        secretType: row.secretType,
        label: row.label || row.secretType,
        value: decryptedValue,
      };
    }),

  /**
   * Admin: List all fetcher credentials (captured from Fetcher jobs) across all users.
   */
  listAllFetcherCredentials: adminProcedure
    .input(
      z.object({
        userId: z.number().optional(),
        providerId: z.string().optional(),
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(200).default(50),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const offset = (input.page - 1) * input.limit;
      const conditions: ReturnType<typeof eq>[] = [];
      if (input.userId) conditions.push(eq(fetcherCredentials.userId, input.userId));
      if (input.providerId) conditions.push(eq(fetcherCredentials.providerId, input.providerId));
      const rows = await db
        .select({
          id: fetcherCredentials.id,
          userId: fetcherCredentials.userId,
          userName: users.name,
          userEmail: users.email,
          jobId: fetcherCredentials.jobId,
          providerId: fetcherCredentials.providerId,
          providerName: fetcherCredentials.providerName,
          keyType: fetcherCredentials.keyType,
          keyLabel: fetcherCredentials.keyLabel,
          createdAt: fetcherCredentials.createdAt,
        })
        .from(fetcherCredentials)
        .leftJoin(users, eq(fetcherCredentials.userId, users.id))
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(fetcherCredentials.createdAt))
        .limit(input.limit)
        .offset(offset);
      const [totalRow] = await db
        .select({ count: count() })
        .from(fetcherCredentials)
        .where(conditions.length > 0 ? and(...conditions) : undefined);
      return {
        credentials: rows.map((r) => ({
          id: r.id,
          userId: r.userId,
          userName: r.userName || "Unknown",
          userEmail: r.userEmail || "Unknown",
          jobId: r.jobId,
          providerId: r.providerId,
          providerName: r.providerName,
          keyType: r.keyType,
          keyLabel: r.keyLabel || r.keyType,
          createdAt: r.createdAt.toISOString(),
        })),
        total: totalRow?.count ?? 0,
        page: input.page,
        limit: input.limit,
      };
    }),

  // ─── Venice Shared-Key Usage Dashboard ──────────────────────────────────────

  /**
   * Get all active Venice shared-key usage (today's requests per user).
   * Useful for monitoring cost exposure.
   */
  getVeniceUsage: adminProcedure.query(async () => {
    const usage = getAllVeniceUsage();
    const limits = VENICE_DAILY_LIMITS;
    return {
      usage,
      limits,
      totalRequestsToday: usage.reduce((sum, u) => sum + u.count, 0),
      activeUsers: usage.length,
    };
  }),

  /**
   * Reset a specific user's daily Venice usage (e.g. after support ticket).
   */
  resetUserVeniceUsage: adminProcedure
    .input(z.object({ userId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      resetVeniceUsage(input.userId);
      await logAdminAction({
        adminId: ctx.user.id,
        adminRole: ctx.user.role,
        action: "reset_venice_usage",
        category: "system" as const,
        targetUserId: input.userId,
        details: { action: "venice_usage_reset" },
      });
      return { success: true };
    }),
});
