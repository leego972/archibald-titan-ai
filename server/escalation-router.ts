/**
 * Credit Escalation Router
 *
 * Handles the progressive credit escalation funnel:
 *
 * FREE TIER:
 *   - Gets 375 daily free credits (reset every 24h, do not accumulate)
 *   - Daily free credits are used BEFORE paid credits
 *   - Cannot buy boost packs — upgrade to a paid plan instead
 *   - When out of daily free credits: shown upgrade-to-paid offer only
 *
 * PAID TIERS (Pro, Enterprise, Cyber, Cyber+, Titan):
 *   Step 1: Out of credits → buy up to 3 boost packs (top-up, no plan change)
 *   Step 2: Used 3 packs OR skipped → offered to double membership (charged immediately)
 *   Step 3: Run out again → offered to double again (up to MAX_DOUBLES_PER_CYCLE times)
 *   Step 4: Month resets → billed at current (possibly doubled) rate going forward
 *
 * DOWNGRADE RULES:
 *   - User can downgrade at any time → charged new lower rate immediately via Stripe
 *   - Credits do NOT refill on downgrade — only refill when billing cycle rolls over
 */

import { z } from "zod";
import { router, protectedProcedure } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { eq, and } from "drizzle-orm";
import { getDb } from "./db";
import { creditBalances, creditEscalation, subscriptions } from "../drizzle/schema";
import { getUserPlan } from "./subscription-gate";
import { addCredits, getCreditBalance } from "./credit-service";
import { createLogger } from "./_core/logger.js";
import {
  PLAN_DOUBLE_MAP,
  CREDIT_PACKS,
  MAX_BOOST_PACKS_PER_CYCLE,
  MAX_DOUBLES_PER_CYCLE,
  DAILY_FREE_CREDITS_AMOUNT,
  DAILY_FREE_CREDITS_RESET_HOURS,
  DAILY_FREE_CREDITS_PLAN,
} from "../shared/pricing";

const log = createLogger("Escalation");

// ─── Helpers ───────────────────────────────────────────────────────────────────

async function getOrCreateEscalation(userId: number) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

  const existing = await db
    .select()
    .from(creditEscalation)
    .where(eq(creditEscalation.userId, userId))
    .limit(1);

  if (existing.length > 0) return existing[0];

  // Create fresh escalation record
  await db.insert(creditEscalation).values({ userId });
  const created = await db
    .select()
    .from(creditEscalation)
    .where(eq(creditEscalation.userId, userId))
    .limit(1);
  return created[0];
}

async function resetEscalationCycle(userId: number) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(creditEscalation)
    .set({
      boostPacksBought: 0,
      doublesThisCycle: 0,
      currentDoubledPlanId: null,
      doubledPriceUsd: 0,
      hasBeenOfferedDouble: false,
      cycleResetAt: new Date(),
    })
    .where(eq(creditEscalation.userId, userId));
}

function isCycleExpired(billingCycleEnd: Date | null): boolean {
  if (!billingCycleEnd) return false;
  return new Date() > billingCycleEnd;
}

// ─── Router ────────────────────────────────────────────────────────────────────

export const escalationRouter = router({

  /**
   * Get the current escalation state for the logged-in user.
   * Returns everything the frontend needs to render the correct modal step.
   */
  getState: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.user.id;
    const plan = await getUserPlan(userId);
    const balance = await getCreditBalance(userId);
    const escalation = await getOrCreateEscalation(userId);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    // Auto-reset cycle if billing period has rolled over
    if (isCycleExpired(escalation.billingCycleEnd)) {
      await resetEscalationCycle(userId);
      const fresh = await getOrCreateEscalation(userId);
      return buildState(plan.planId, balance, fresh);
    }

    return buildState(plan.planId, balance, escalation);
  }),

  /**
   * Grant daily free credits to a Free tier user.
   * Called automatically when a free user opens the app or makes their first action of the day.
   * Resets the daily pool (does NOT add to existing — unused credits are discarded).
   */
  grantDailyFreeCredits: protectedProcedure.mutation(async ({ ctx }) => {
    const userId = ctx.user.id;
    const plan = await getUserPlan(userId);

    if (plan.planId !== DAILY_FREE_CREDITS_PLAN) {
      return { granted: false, reason: "Daily free credits are only available on the Free plan." };
    }

    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    const bal = await db
      .select({ dailyFreeCredits: creditBalances.dailyFreeCredits, dailyFreeLastGrantedAt: creditBalances.dailyFreeLastGrantedAt })
      .from(creditBalances)
      .where(eq(creditBalances.userId, userId))
      .limit(1);

    if (bal.length === 0) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Credit balance not found." });
    }

    const lastGranted = bal[0].dailyFreeLastGrantedAt;
      const now = new Date();

      // Atomic conditional UPDATE — only succeeds if cooldown has elapsed.
      // Prevents double-grant if two concurrent requests race past the time check.
      const updateRes = await db
        .update(creditBalances)
        .set({
          dailyFreeCredits: DAILY_FREE_CREDITS_AMOUNT,
          dailyFreeLastGrantedAt: now,
        })
        .where(
          and(
            eq(creditBalances.userId, userId),
            sql`(${creditBalances.dailyFreeLastGrantedAt} IS NULL OR
              ${creditBalances.dailyFreeLastGrantedAt} < DATE_SUB(NOW(), INTERVAL ${DAILY_FREE_CREDITS_RESET_HOURS} HOUR))`
          )
        );

      const affected = (updateRes as any)?.[0]?.affectedRows ?? (updateRes as any)?.affectedRows ?? 0;
      if (affected === 0) {
        const hoursSinceLast = lastGranted
          ? (now.getTime() - lastGranted.getTime()) / (1000 * 60 * 60)
          : 0;
        const hoursRemaining = Math.max(0, Math.ceil(DAILY_FREE_CREDITS_RESET_HOURS - hoursSinceLast));
        return {
          granted: false,
          reason: `Daily free credits already granted. Resets in ${hoursRemaining} hour${hoursRemaining === 1 ? "" : "s"}.`,
          currentDailyFree: bal[0].dailyFreeCredits,
          resetsInHours: hoursRemaining,
        };
      }

    log.info(`Granted ${DAILY_FREE_CREDITS_AMOUNT} daily free credits to free tier user ${userId}`);

    return {
      granted: true,
      amount: DAILY_FREE_CREDITS_AMOUNT,
      message: `${DAILY_FREE_CREDITS_AMOUNT} daily free credits granted — good for ~5 tasks today!`,
    };
  }),

  /**
   * Buy a boost pack (paid tiers only, max 3 per billing cycle).
   * Credits are added immediately. Stripe charge is handled client-side before calling this.
   */
  buyBoostPack: protectedProcedure
    .input(z.object({
      packId: z.string(),
      stripePaymentIntentId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.id;
      const plan = await getUserPlan(userId);

      // Free tier cannot buy boost packs
      if (plan.planId === "free") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Boost packs are available on paid plans only. Upgrade to Pro or higher to unlock boost packs.",
        });
      }

      const pack = CREDIT_PACKS.find(p => p.id === input.packId);
      if (!pack) throw new TRPCError({ code: "NOT_FOUND", message: "Boost pack not found." });

      const escalation = await getOrCreateEscalation(userId);

      // Auto-reset if cycle expired
      if (isCycleExpired(escalation.billingCycleEnd)) {
        await resetEscalationCycle(userId);
      }

      const freshEscalation = await getOrCreateEscalation(userId);

      if (freshEscalation.boostPacksBought >= MAX_BOOST_PACKS_PER_CYCLE) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: `You've already purchased ${MAX_BOOST_PACKS_PER_CYCLE} boost packs this billing cycle. Consider upgrading your plan for more monthly credits.`,
        });
      }

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Add credits
      await addCredits(userId, pack.credits, "pack_purchase", `Boost pack: ${pack.name} (+${pack.credits.toLocaleString()} credits)`, input.stripePaymentIntentId);

      // Increment boost pack counter
      await db
        .update(creditEscalation)
        .set({ boostPacksBought: freshEscalation.boostPacksBought + 1 })
        .where(eq(creditEscalation.userId, userId));

      const newCount = freshEscalation.boostPacksBought + 1;
      const packsRemaining = MAX_BOOST_PACKS_PER_CYCLE - newCount;

      log.info(`User ${userId} bought boost pack ${pack.id} (${newCount}/${MAX_BOOST_PACKS_PER_CYCLE} this cycle)`);

      return {
        success: true,
        creditsAdded: pack.credits,
        boostPacksBought: newCount,
        packsRemaining,
        offerUpgrade: packsRemaining === 0, // prompt upgrade offer after 3rd pack
      };
    }),

  /**
   * Accept the membership doubling offer (paid tiers only).
   * Charges the user the doubled rate immediately via Stripe.
   * Credits for the doubled allocation are added immediately.
   */
  acceptDoubleUpgrade: protectedProcedure
    .input(z.object({
      stripePaymentIntentId: z.string(), // charged client-side first
    }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.id;
      const plan = await getUserPlan(userId);

      if (plan.planId === "free") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Plan doubling is available on paid plans only.",
        });
      }

      const doubleOffer = PLAN_DOUBLE_MAP[plan.planId];
      if (!doubleOffer) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "No doubling offer available for your plan." });
      }

      const escalation = await getOrCreateEscalation(userId);

      if (isCycleExpired(escalation.billingCycleEnd)) {
        await resetEscalationCycle(userId);
      }

      const freshEscalation = await getOrCreateEscalation(userId);

      if (freshEscalation.doublesThisCycle >= MAX_DOUBLES_PER_CYCLE) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: `You've already doubled your plan ${MAX_DOUBLES_PER_CYCLE} times this cycle. Your credits will refresh when your billing cycle resets.`,
        });
      }

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Add the doubled credit allocation immediately
      const creditsToAdd = doubleOffer.doubledCredits;
      await addCredits(
        userId,
        creditsToAdd,
        "pack_purchase",
        `Plan doubled: ${doubleOffer.label} — +${creditsToAdd.toLocaleString()} credits at $${doubleOffer.doubledPriceUsd}/mo`,
        input.stripePaymentIntentId
      );

      const newDoubles = freshEscalation.doublesThisCycle + 1;

      // Record the doubling
      await db
        .update(creditEscalation)
        .set({
          doublesThisCycle: newDoubles,
          currentDoubledPlanId: `${plan.planId}_doubled_${newDoubles}x`,
          doubledPriceUsd: doubleOffer.doubledPriceUsd,
          hasBeenOfferedDouble: true,
        })
        .where(eq(creditEscalation.userId, userId));

      log.info(`User ${userId} accepted plan double (${newDoubles}/${MAX_DOUBLES_PER_CYCLE}) — ${doubleOffer.label}`);

      return {
        success: true,
        creditsAdded: creditsToAdd,
        doublesThisCycle: newDoubles,
        doublesRemaining: MAX_DOUBLES_PER_CYCLE - newDoubles,
        newMonthlyRate: doubleOffer.doubledPriceUsd,
        label: doubleOffer.label,
      };
    }),

  /**
   * Downgrade to a lower plan.
   * Charges the new lower rate immediately via Stripe.
   * Credits do NOT refill — only refill when billing cycle rolls over.
   */
  downgrade: protectedProcedure
    .input(z.object({
      targetPlan: z.enum(["free", "pro", "enterprise", "cyber", "cyber_plus", "titan"]),
      stripeSubscriptionId: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.id;
      const plan = await getUserPlan(userId);

      const planOrder = ["free", "pro", "enterprise", "cyber", "cyber_plus", "titan"];
      const currentIdx = planOrder.indexOf(plan.planId);
      const targetIdx = planOrder.indexOf(input.targetPlan);

      if (targetIdx >= currentIdx) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Use the upgrade flow to move to a higher plan.",
        });
      }

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Record the pending downgrade — actual Stripe subscription change is handled client-side
      await db
        .update(creditEscalation)
        .set({
          pendingDowngradePlan: input.targetPlan,
          pendingDowngradeAt: new Date(),
        })
        .where(eq(creditEscalation.userId, userId));

      log.info(`User ${userId} initiated downgrade from ${plan.planId} to ${input.targetPlan}`);

      return {
        success: true,
        message: `Downgrade to ${input.targetPlan} recorded. Your current credits remain until your billing cycle resets, then you'll receive ${input.targetPlan} credits.`,
        currentPlan: plan.planId,
        targetPlan: input.targetPlan,
        creditsRefreshNote: "Your credits will refresh to the new plan allocation when your current billing cycle ends.",
      };
    }),

  /**
   * Sync billing cycle end date from Stripe webhook data.
   * Called by the Stripe webhook handler when a subscription is updated.
   */
  syncBillingCycle: protectedProcedure
    .input(z.object({ billingCycleEnd: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.id;
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const cycleEnd = new Date(input.billingCycleEnd);

      await db
        .update(creditEscalation)
        .set({ billingCycleEnd: cycleEnd })
        .where(eq(creditEscalation.userId, userId));

      // If cycle has rolled over, reset escalation state
      if (new Date() > cycleEnd) {
        await resetEscalationCycle(userId);
      }

      return { success: true };
    }),
});

// ─── State Builder ─────────────────────────────────────────────────────────────

function buildState(
  planId: string,
  balance: { credits: number; isUnlimited: boolean },
  escalation: typeof creditEscalation.$inferSelect
) {
  const isFreeTier = planId === DAILY_FREE_CREDITS_PLAN;
  const boostPacksBought = escalation.boostPacksBought ?? 0;
  const doublesThisCycle = escalation.doublesThisCycle ?? 0;
  const packsRemaining = MAX_BOOST_PACKS_PER_CYCLE - boostPacksBought;
  const doublesRemaining = MAX_DOUBLES_PER_CYCLE - doublesThisCycle;
  const doubleOffer = !isFreeTier ? (PLAN_DOUBLE_MAP[planId] ?? null) : null;

  // Determine what step of the funnel the user is at
  let funnelStep: "none" | "boost_packs" | "double_offer" | "upgrade_required" | "maxed_out" = "none";

  if (balance.credits <= 0 && !balance.isUnlimited) {
    if (isFreeTier) {
      funnelStep = "upgrade_required"; // Free tier: only option is to upgrade to paid
    } else if (packsRemaining > 0) {
      funnelStep = "boost_packs"; // Paid tier: still has boost packs available
    } else if (doublesRemaining > 0 && doubleOffer) {
      funnelStep = "double_offer"; // Used all packs: offer to double membership
    } else {
      funnelStep = "maxed_out"; // Used all packs + all doubles: wait for cycle reset
    }
  }

  return {
    planId,
    isFreeTier,
    credits: balance.credits,
    isUnlimited: balance.isUnlimited,
    // Boost pack state
    boostPacksBought,
    packsRemaining,
    maxPacksPerCycle: MAX_BOOST_PACKS_PER_CYCLE,
    canBuyBoostPack: !isFreeTier && packsRemaining > 0,
    // Doubling state
    doublesThisCycle,
    doublesRemaining,
    maxDoublesPerCycle: MAX_DOUBLES_PER_CYCLE,
    canDoubleUpgrade: !isFreeTier && doublesRemaining > 0 && doubleOffer !== null,
    doubleOffer,
    // Billing cycle
    billingCycleEnd: escalation.billingCycleEnd,
    pendingDowngradePlan: escalation.pendingDowngradePlan,
    // Funnel state
    funnelStep,
    // Available boost packs to show in UI
    availablePacks: isFreeTier ? [] : CREDIT_PACKS,
  };
}
