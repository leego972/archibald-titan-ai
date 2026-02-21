/**
 * Credit Router — tRPC procedures for the credit system.
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "./_core/trpc";
import {
  getCreditBalance,
  getCreditHistory,
  checkCredits,
  addCredits,
  adminAdjustCredits,
  setUnlimited,
  processMonthlyRefill,
} from "./credit-service";
import { CREDIT_COSTS, CREDIT_PACKS } from "../shared/pricing";
import { ENV } from "./_core/env";
import Stripe from "stripe";

// ─── Stripe Client (reuse pattern from stripe-router) ──────────────

let stripeInstance: Stripe | null = null;

function getStripe(): Stripe {
  if (!stripeInstance) {
    if (!ENV.stripeSecretKey) {
      throw new Error("STRIPE_SECRET_KEY is not configured");
    }
    stripeInstance = new Stripe(ENV.stripeSecretKey, {
      apiVersion: "2025-01-27.acacia" as any,
    });
  }
  return stripeInstance;
}

// ─── Credit Router ─────────────────────────────────────────────────

export const creditRouter = router({
  /** Get current user's credit balance */
  getBalance: protectedProcedure.query(async ({ ctx }) => {
    // Attempt monthly refill on every balance check
    await processMonthlyRefill(ctx.user.id);
    return getCreditBalance(ctx.user.id);
  }),

  /** Get credit transaction history */
  getHistory: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      return getCreditHistory(ctx.user.id, input?.limit ?? 50, input?.offset ?? 0);
    }),

  /** Get credit costs for all action types */
  getCosts: protectedProcedure.query(() => {
    return CREDIT_COSTS;
  }),

  /** Get available credit packs for purchase */
  getPacks: protectedProcedure.query(() => {
    return CREDIT_PACKS;
  }),

  /** Check if user has enough credits for an action */
  check: protectedProcedure
    .input(z.object({ action: z.enum(["chat_message", "builder_action", "voice_action", "fetch_action"]) }))
    .query(async ({ ctx, input }) => {
      return checkCredits(ctx.user.id, input.action);
    }),

  /** Purchase a credit pack via Stripe */
  purchasePack: protectedProcedure
    .input(
      z.object({
        packId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const pack = CREDIT_PACKS.find((p) => p.id === input.packId);
      if (!pack) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid credit pack" });
      }

      const stripe = getStripe();
      const origin = ctx.req.headers.origin || ctx.req.headers.referer?.replace(/\/$/, "") || "";

      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        payment_method_types: ["card"],
        allow_promotion_codes: true,
        customer_email: ctx.user.email || undefined,
        client_reference_id: ctx.user.id.toString(),
        metadata: {
          user_id: ctx.user.id.toString(),
          customer_email: ctx.user.email || "",
          customer_name: ctx.user.name || "",
          type: "credit_pack",
          pack_id: pack.id,
          credits: pack.credits.toString(),
        },
        line_items: [
          {
            price_data: {
              currency: "usd",
              unit_amount: Math.round(pack.price * 100),
              product_data: {
                name: `${pack.name} (${pack.credits} Credits)`,
                description: `Add ${pack.credits} credits to your Archibald Titan account`,
              },
            },
            quantity: 1,
          },
        ],
        success_url: `${origin}/dashboard/credits?purchase=success&credits=${pack.credits}`,
        cancel_url: `${origin}/dashboard/credits?purchase=canceled`,
      });

      return { checkoutUrl: session.url };
    }),

  /** Admin: Adjust a user's credit balance */
  adminAdjust: protectedProcedure
    .input(
      z.object({
        userId: z.number(),
        amount: z.number(),
        reason: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Admin only" });
      }
      return adminAdjustCredits(input.userId, input.amount, input.reason);
    }),

  /** Admin: Toggle unlimited credits for a user */
  adminSetUnlimited: protectedProcedure
    .input(
      z.object({
        userId: z.number(),
        unlimited: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Admin only" });
      }
      await setUnlimited(input.userId, input.unlimited);
      return { success: true };
    }),
});
