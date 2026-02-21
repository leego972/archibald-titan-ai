import { z } from "zod";
import { router, publicProcedure, protectedProcedure } from "./_core/trpc";
import { getDb } from "./db";
import { desktopLicenses, users, creditBalances, subscriptions } from "../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import * as jose from "jose";

const JWT_SECRET_KEY = new TextEncoder().encode(process.env.JWT_SECRET || "desktop-license-secret");
const LICENSE_DURATION_DAYS = 30;

/**
 * Generate a signed license JWT for a desktop device.
 */
async function generateLicenseJWT(userId: number, deviceId: string, role: string, plan: string) {
  const expiresAt = new Date(Date.now() + LICENSE_DURATION_DAYS * 24 * 60 * 60 * 1000);
  const jwt = await new jose.SignJWT({
    userId,
    deviceId,
    role,
    plan,
    isUnlimited: role === "admin",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .setSubject(userId.toString())
    .sign(JWT_SECRET_KEY);

  return { jwt, expiresAt };
}

/**
 * Validate a license JWT and return the payload.
 */
async function validateLicenseJWT(token: string) {
  try {
    const { payload } = await jose.jwtVerify(token, JWT_SECRET_KEY);
    return payload as jose.JWTPayload & {
      userId: number;
      deviceId: string;
      role: string;
      plan: string;
      isUnlimited: boolean;
    };
  } catch {
    return null;
  }
}

export const desktopLicenseRouter = router({
  /**
   * Activate a desktop license — called when user logs in from the desktop app.
   * Returns a license JWT + user info + credit balance.
   */
  activate: publicProcedure
    .input(
      z.object({
        email: z.string().email(),
        password: z.string().min(1),
        deviceId: z.string().min(1),
        deviceName: z.string().optional(),
        platform: z.string().min(1),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      // Verify credentials
      const userRows = await db
        .select()
        .from(users)
        .where(eq(users.email, input.email))
        .limit(1);
      const user = userRows[0];

      if (!user || !user.passwordHash) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid email or password" });
      }

      // Verify password
      const bcrypt = await import("bcryptjs");
      const valid = await bcrypt.compare(input.password, user.passwordHash);
      if (!valid) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid email or password" });
      }

      // Get subscription plan
      const subRows = await db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.userId, user.id))
        .limit(1);
      const plan = subRows[0]?.plan || "free";

      // Generate license JWT
      const { jwt, expiresAt } = await generateLicenseJWT(
        user.id,
        input.deviceId,
        user.role,
        plan
      );

      // Revoke any existing license for this device
      await db
        .update(desktopLicenses)
        .set({ status: "revoked", revokedAt: new Date() })
        .where(
          and(
            eq(desktopLicenses.userId, user.id),
            eq(desktopLicenses.deviceId, input.deviceId),
            eq(desktopLicenses.status, "active")
          )
        );

      // Create new license record
      await db.insert(desktopLicenses).values({
        userId: user.id,
        deviceId: input.deviceId,
        deviceName: input.deviceName || `${input.platform} device`,
        platform: input.platform,
        licenseKey: jwt,
        status: "active",
        expiresAt,
        lastValidatedAt: new Date(),
      });

      // Get credit balance
      const balanceRows = await db
        .select()
        .from(creditBalances)
        .where(eq(creditBalances.userId, user.id))
        .limit(1);
      const balance = balanceRows[0];

      return {
        licenseKey: jwt,
        expiresAt: expiresAt.toISOString(),
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          avatarUrl: null,
          isDesktop: true,
        },
        credits: {
          balance: balance?.credits ?? 0,
          isUnlimited: user.role === "admin" || (balance?.isUnlimited ?? false),
        },
        plan,
      };
    }),

  /**
   * Validate an existing license — called on desktop app launch and periodically.
   * Returns refreshed user info + credit balance.
   */
  validate: publicProcedure
    .input(
      z.object({
        licenseKey: z.string().min(1),
        deviceId: z.string().min(1),
      })
    )
    .mutation(async ({ input }) => {
      const payload = await validateLicenseJWT(input.licenseKey);
      if (!payload) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid or expired license" });
      }

      if (payload.deviceId !== input.deviceId) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "License not valid for this device" });
      }

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      // Verify user still exists
      const userRows = await db
        .select()
        .from(users)
        .where(eq(users.id, payload.userId))
        .limit(1);
      const user = userRows[0];
      if (!user) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "User account not found" });
      }

      // Check license is still active in DB
      const licenseRows = await db
        .select()
        .from(desktopLicenses)
        .where(
          and(
            eq(desktopLicenses.userId, payload.userId),
            eq(desktopLicenses.deviceId, input.deviceId),
            eq(desktopLicenses.status, "active")
          )
        )
        .limit(1);
      const license = licenseRows[0];
      if (!license) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "License has been revoked" });
      }

      // Update last validated timestamp
      await db
        .update(desktopLicenses)
        .set({ lastValidatedAt: new Date() })
        .where(eq(desktopLicenses.id, license.id));

      // Get current subscription
      const subRows = await db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.userId, user.id))
        .limit(1);
      const plan = subRows[0]?.plan || "free";

      // Get credit balance
      const balanceRows = await db
        .select()
        .from(creditBalances)
        .where(eq(creditBalances.userId, user.id))
        .limit(1);
      const balance = balanceRows[0];

      // Auto-refresh license if within 7 days of expiry
      let newLicenseKey = input.licenseKey;
      let newExpiresAt = license.expiresAt;
      const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      if (license.expiresAt && license.expiresAt < sevenDaysFromNow) {
        const refreshed = await generateLicenseJWT(user.id, input.deviceId, user.role, plan);
        newLicenseKey = refreshed.jwt;
        newExpiresAt = refreshed.expiresAt;
        await db
          .update(desktopLicenses)
          .set({ licenseKey: refreshed.jwt, expiresAt: refreshed.expiresAt })
          .where(eq(desktopLicenses.id, license.id));
      }

      return {
        valid: true,
        licenseKey: newLicenseKey,
        expiresAt: newExpiresAt?.toISOString(),
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          avatarUrl: null,
          isDesktop: true,
        },
        credits: {
          balance: balance?.credits ?? 0,
          isUnlimited: user.role === "admin" || (balance?.isUnlimited ?? false),
        },
        plan,
      };
    }),

  /**
   * Deactivate a desktop license — called when user logs out from desktop.
   */
  deactivate: publicProcedure
    .input(
      z.object({
        licenseKey: z.string().min(1),
        deviceId: z.string().min(1),
      })
    )
    .mutation(async ({ input }) => {
      const payload = await validateLicenseJWT(input.licenseKey);
      if (!payload) {
        return { success: true }; // already invalid, no-op
      }

      const db = await getDb();
      if (!db) return { success: true };

      await db
        .update(desktopLicenses)
        .set({ status: "revoked", revokedAt: new Date() })
        .where(
          and(
            eq(desktopLicenses.userId, payload.userId),
            eq(desktopLicenses.deviceId, input.deviceId),
            eq(desktopLicenses.status, "active")
          )
        );

      return { success: true };
    }),

  /**
   * List all active licenses for the current user — for device management.
   */
  listDevices: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];

    const licenses = await db
      .select({
        id: desktopLicenses.id,
        deviceId: desktopLicenses.deviceId,
        deviceName: desktopLicenses.deviceName,
        platform: desktopLicenses.platform,
        lastValidatedAt: desktopLicenses.lastValidatedAt,
        activatedAt: desktopLicenses.activatedAt,
        expiresAt: desktopLicenses.expiresAt,
      })
      .from(desktopLicenses)
      .where(
        and(
          eq(desktopLicenses.userId, ctx.user.id),
          eq(desktopLicenses.status, "active")
        )
      )
      .orderBy(desc(desktopLicenses.lastValidatedAt));

    return licenses;
  }),

  /**
   * Revoke a specific device license — for device management.
   */
  revokeDevice: protectedProcedure
    .input(z.object({ licenseId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const licenseRows = await db
        .select()
        .from(desktopLicenses)
        .where(
          and(
            eq(desktopLicenses.id, input.licenseId),
            eq(desktopLicenses.userId, ctx.user.id)
          )
        )
        .limit(1);

      if (!licenseRows[0]) {
        throw new TRPCError({ code: "NOT_FOUND", message: "License not found" });
      }

      await db
        .update(desktopLicenses)
        .set({ status: "revoked", revokedAt: new Date() })
        .where(eq(desktopLicenses.id, input.licenseId));

      return { success: true };
    }),
});
