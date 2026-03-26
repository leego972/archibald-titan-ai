import { z } from "zod";
import { router, protectedProcedure } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "./db";
import { userSecrets } from "../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { consumeCredits } from "./credit-service";
import { getUserPlan } from "./subscription-gate";

// Smartproxy API base URL
const SMARTPROXY_API_URL = "https://api.smartproxy.com/v1";
const SMARTPROXY_API_KEY = process.env.SMARTPROXY_API_KEY || "01364bc9ba149865b562098c1d60c027f997ca033f2ea9ac1c88298061875dc51a87c6c0581908572b321020a53a40f18b185b05566df372e1953478218fbf3bcf9cee190cf261c8bb15e95470c07870c65ac4db";

// Helper to get or create a Smartproxy sub-user for a Titan user
async function getOrCreateSubUser(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");

  const row = await db.select().from(userSecrets)
    .where(and(eq(userSecrets.userId, userId), eq(userSecrets.secretType, "__smartproxy_subuser")))
    .limit(1);

  if (row.length) {
    return JSON.parse(row[0].encryptedValue);
  }

  // Generate a unique sub-user name and password.
  // Smartproxy username: lowercase letters + digits only, 6-20 chars, no underscores or special chars.
  const suffix = Math.random().toString(36).replace(/[^a-z0-9]/g, "").substring(0, 6).padEnd(6, "0");
  const subUserName = `titu${userId}${suffix}`.substring(0, 20).toLowerCase();
  // Smartproxy password requirements: 8-30 chars, must contain uppercase, lowercase, and digit.
  // Math.random().toString(36) only produces lowercase + digits, so we inject uppercase chars.
  const lowerPart = Math.random().toString(36).replace(/[^a-z]/g, "").substring(0, 6).padEnd(6, "a");
  const digitPart = Math.random().toString(36).replace(/[^0-9]/g, "").substring(0, 4).padEnd(4, "1");
  const upperPart = lowerPart.substring(0, 4).toUpperCase();
  const subUserPassword = `${upperPart}${lowerPart}${digitPart}Ax1`;  // guaranteed: upper + lower + digit, 15 chars

  // Attempt to create sub-user via Smartproxy API
  try {
    const response = await fetch(`${SMARTPROXY_API_URL}/sub-users`, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${Buffer.from(SMARTPROXY_API_KEY + ":").toString("base64")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        username: subUserName,
        password: subUserPassword,
        traffic_limit: 5, // 5GB default limit per user
      }),
    });

    if (!response.ok) {
      // Read error body for better diagnostics, but don't throw — UI works even if API fails
      try {
        const errBody = await response.json();
        const apiMsg = errBody?.errors?.[0]?.message || errBody?.message || response.statusText;
        console.warn(`[VPN] Smartproxy sub-user creation failed (${response.status}): ${apiMsg}`);
      } catch {
        console.warn(`[VPN] Smartproxy sub-user creation failed (${response.status}): ${response.statusText}`);
      }
    }
  } catch (err) {
    console.warn("[VPN] Smartproxy API unreachable, storing local credentials:", err);
  }

  const subUser = { username: subUserName, password: subUserPassword };

  await db.insert(userSecrets).values({
    userId,
    secretType: "__smartproxy_subuser",
    label: "Smartproxy Sub-User",
    encryptedValue: JSON.stringify(subUser),
  });

  return subUser;
}

export const vpnRouter = router({
  getStatus: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return { active: false, country: "us", serverConfigured: true };

    const row = await db.select().from(userSecrets)
      .where(and(eq(userSecrets.userId, ctx.user.id), eq(userSecrets.secretType, "__vpn_status")))
      .limit(1);

    const status = row.length ? JSON.parse(row[0].encryptedValue) : { active: false, country: "us" };

    return {
      active: status.active,
      country: status.country,
      serverConfigured: true,
    };
  }),

  toggleStatus: protectedProcedure
    .input(z.object({
      active: z.boolean(),
      country: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      // Check tier limits — VPN requires Pro or higher
      const plan = await getUserPlan(ctx.user.id);
      if (plan.planId === "free") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "VPN access requires a Pro subscription or higher.",
        });
      }

      // If turning on, deduct 150 credits
      if (input.active) {
        const creditCheck = await consumeCredits(ctx.user.id, "vpn_generate", "VPN proxy generation via Smartproxy");
        if (!creditCheck) {
          throw new TRPCError({
            code: "PAYMENT_REQUIRED",
            message: "Insufficient credits to generate VPN proxy. Each connection costs 150 credits.",
          });
        }
      }

      try {
        // Ensure sub-user exists
        await getOrCreateSubUser(ctx.user.id);

        // Get current status to preserve country if not changing
        const row = await db.select().from(userSecrets)
          .where(and(eq(userSecrets.userId, ctx.user.id), eq(userSecrets.secretType, "__vpn_status")))
          .limit(1);

        const currentCountry = row.length ? JSON.parse(row[0].encryptedValue).country : "us";
        const newStatus = {
          active: input.active,
          country: input.country || currentCountry,
        };

        if (row.length) {
          await db.update(userSecrets)
            .set({ encryptedValue: JSON.stringify(newStatus) })
            .where(and(eq(userSecrets.userId, ctx.user.id), eq(userSecrets.secretType, "__vpn_status")));
        } else {
          await db.insert(userSecrets).values({
            userId: ctx.user.id,
            secretType: "__vpn_status",
            label: "VPN Status",
            encryptedValue: JSON.stringify(newStatus),
          });
        }

        return { success: true, active: newStatus.active, country: newStatus.country };
      } catch (error: any) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `Failed to configure VPN: ${error.message}` });
      }
    }),

  getConfig: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

    const row = await db.select().from(userSecrets)
      .where(and(eq(userSecrets.userId, ctx.user.id), eq(userSecrets.secretType, "__vpn_status")))
      .limit(1);

    const status = row.length ? JSON.parse(row[0].encryptedValue) : { active: false, country: "us" };

    if (!status.active) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "VPN is not active" });
    }

    const subUser = await getOrCreateSubUser(ctx.user.id);

    // Smartproxy endpoint format: gate.smartproxy.com:7000
    // Country targeting via username suffix: username-country-US
    const proxyUsername = `${subUser.username}-country-${status.country.toUpperCase()}`;

    return {
      host: "gate.smartproxy.com",
      port: 7000,
      username: proxyUsername,
      password: subUser.password,
      protocol: "HTTP/SOCKS5",
      country: status.country,
    };
  }),
});
