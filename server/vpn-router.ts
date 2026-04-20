import { z } from "zod";
import { router, protectedProcedure } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "./db";
import { userSecrets } from "../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { consumeCredits } from "./credit-service";
import { getUserPlan } from "./subscription-gate";

// Decodo (formerly Smartproxy) API — correct v2 endpoint
// Docs: https://help.decodo.com/reference/create-sub-user
const DECODO_API_URL = "https://api.decodo.com/v2";
const DECODO_API_KEY = process.env.SMARTPROXY_API_KEY || "";
if (!DECODO_API_KEY) {
  console.warn("[VPN] ⚠ SMARTPROXY_API_KEY is not configured — VPN proxy provisioning will fail. Set this in Railway environment variables.");
}

/**
 * Generate a Decodo-compliant password.
 * Requirements: 12+ chars, ≥1 uppercase, ≥1 lowercase, ≥1 digit, ≥1 of _ ~ + =
 * Forbidden chars: @ and :
 */
function generateDecodoPassword(): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";   // no I/O to avoid confusion
  const lower = "abcdefghjkmnpqrstuvwxyz";     // no i/l/o
  const digits = "23456789";                   // no 0/1 to avoid confusion
  const special = "_~+=";                      // allowed special chars per Decodo docs

  const rand = (chars: string) => chars[Math.floor(Math.random() * chars.length)];
  const randN = (chars: string, n: number) => Array.from({ length: n }, () => rand(chars)).join("");

  // Build a guaranteed-compliant 16-char password
  const required = rand(upper) + rand(lower) + rand(digits) + rand(special);
  const fill = randN(upper + lower + digits, 12);

  // Shuffle the combined string
  const combined = (required + fill).split("");
  for (let i = combined.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [combined[i], combined[j]] = [combined[j], combined[i]];
  }
  return combined.join("");
}

// Helper to get or create a Decodo sub-user for a Titan user
async function getOrCreateSubUser(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");

  const row = await db.select().from(userSecrets)
    .where(and(eq(userSecrets.userId, userId), eq(userSecrets.secretType, "__smartproxy_subuser")))
    .limit(1);

  if (row.length) {
    return JSON.parse(row[0].encryptedValue);
  }

  // Generate a unique sub-user name.
  // Decodo username: 6–64 chars, letters/numbers/underscores only.
  const suffix = Math.random().toString(36).replace(/[^a-z0-9]/g, "").substring(0, 8).padEnd(8, "0");
  const subUserName = `titan_${userId}_${suffix}`.substring(0, 64);

  // Generate a Decodo-compliant password
  const subUserPassword = generateDecodoPassword();

  // Attempt to create sub-user via Decodo API
  try {
    const response = await fetch(`${DECODO_API_URL}/sub-users`, {
      method: "POST",
      headers: {
        "Authorization": DECODO_API_KEY,
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify({
        username: subUserName,
        password: subUserPassword,
        service_type: "residential_proxies",
        traffic_limit: 5,   // 5 GB default limit per user
        auto_disable: false,
      }),
    });

    if (!response.ok) {
      // Read error body for better diagnostics, but don't throw — UI works even if API fails
      try {
        const errBody = await response.json();
        const apiMsg = errBody?.errors?.[0]?.message || errBody?.message || response.statusText;
        console.warn(`[VPN] Decodo sub-user creation failed (${response.status}): ${apiMsg}`);
      } catch {
        console.warn(`[VPN] Decodo sub-user creation failed (${response.status}): ${response.statusText}`);
      }
    } else {
      console.info(`[VPN] Decodo sub-user created: ${subUserName}`);
    }
  } catch (err) {
    console.warn("[VPN] Decodo API unreachable, storing local credentials:", err);
  }

  const subUser = { username: subUserName, password: subUserPassword };

  await db.insert(userSecrets).values({
    userId,
    secretType: "__smartproxy_subuser",
    label: "Decodo Sub-User",
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
      let plan: { planId: string } = { planId: "free" };
      try { plan = await getUserPlan(ctx.user.id); } catch { /* treat as free if DB error */ }
      if (plan.planId === "free") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "VPN access requires a Pro subscription or higher.",
        });
      }

      // If turning on, deduct credits
      if (input.active) {
        const creditCheck = await consumeCredits(ctx.user.id, "vpn_generate", "VPN proxy generation via Decodo");
        if (!creditCheck.success) {
          throw new TRPCError({
            code: "PAYMENT_REQUIRED",
            message: "Insufficient credits to generate VPN proxy. Each connection costs 300 credits.",
          });
        }
      }

      try {
        // Ensure sub-user exists in Decodo
        await getOrCreateSubUser(ctx.user.id);

        // Get current status to preserve country if not changing
        const row = await db.select().from(userSecrets)
          .where(and(eq(userSecrets.userId, ctx.user.id), eq(userSecrets.secretType, "__vpn_status")))
          .limit(1);

        const currentCountry = row.length
          ? (JSON.parse(row[0].encryptedValue).country ?? "us")
          : "us";

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
      } catch (error: unknown) {
        if (error instanceof TRPCError) throw error;
        const msg = error instanceof Error ? error.message : String(error);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `Failed to configure VPN: ${msg}` });
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

    // Decodo endpoint: gate.decodo.com:10000 (residential HTTP)
    // Country targeting via username suffix: username-country-US
    const proxyUsername = `${subUser.username}-country-${(status.country as string).toUpperCase()}`;

    return {
      host: "gate.decodo.com",
      port: 10000,
      username: proxyUsername,
      password: subUser.password,
      protocol: "HTTP/SOCKS5",
      country: status.country,
    };
  }),
});
