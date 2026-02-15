import Stripe from "stripe";
import { z } from "zod";
import { eq, and, isNotNull, ne } from "drizzle-orm";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { ENV } from "./_core/env";
import { getDb } from "./db";
import { subscriptions, users, creditBalances } from "../drizzle/schema";
import { PRICING_TIERS, CREDIT_PACKS, type PlanId } from "../shared/pricing";
import { addCredits, processMonthlyRefill } from "./credit-service";
import type { Express, Request, Response } from "express";

// ─── Stripe Client ──────────────────────────────────────────────────

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

// ─── Price Cache ────────────────────────────────────────────────────
// We create Stripe products/prices on-demand and cache the IDs

const priceCache: Record<string, string> = {};

async function getOrCreatePrice(
  planId: "pro" | "enterprise",
  interval: "month" | "year"
): Promise<string> {
  const cacheKey = `${planId}_${interval}`;
  if (priceCache[cacheKey]) return priceCache[cacheKey];

  const stripe = getStripe();
  const tier = PRICING_TIERS.find((t) => t.id === planId);
  if (!tier) throw new Error(`Unknown plan: ${planId}`);

  const amount =
    interval === "month" ? tier.monthlyPrice * 100 : tier.yearlyPrice * 100;

  // Search for existing product
  const products = await stripe.products.list({ limit: 100 });
  let product = products.data.find(
    (p) => p.metadata.plan_id === planId && p.active
  );

  if (!product) {
    product = await stripe.products.create({
      name: `Archibald Titan ${tier.name}`,
      description: tier.tagline,
      metadata: { plan_id: planId },
    });
  }

  // Search for existing price
  const prices = await stripe.prices.list({
    product: product.id,
    active: true,
    limit: 100,
  });
  let price = prices.data.find(
    (p) =>
      p.recurring?.interval === interval && p.unit_amount === amount
  );

  if (!price) {
    price = await stripe.prices.create({
      product: product.id,
      unit_amount: amount,
      currency: "usd",
      recurring: { interval },
      metadata: { plan_id: planId, interval },
    });
  }

  priceCache[cacheKey] = price.id;
  return price.id;
}

// ─── Helper: Get or create Stripe customer ──────────────────────────

async function getOrCreateCustomer(
  userId: number,
  email: string,
  name?: string | null
): Promise<string> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Check if user already has a subscription record with a customer ID
  const existing = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId))
    .limit(1);

  if (existing.length > 0 && existing[0].stripeCustomerId) {
    return existing[0].stripeCustomerId;
  }

  // Create new Stripe customer
  const stripe = getStripe();
  const customer = await stripe.customers.create({
    email,
    name: name || undefined,
    metadata: { user_id: userId.toString() },
  });

  return customer.id;
}

// ─── Helper: Look up userId from Stripe customer ID ─────────────────

async function getUserIdFromCustomerId(customerId: string): Promise<number | null> {
  const db = await getDb();
  if (!db) return null;

  const sub = await db
    .select({ userId: subscriptions.userId })
    .from(subscriptions)
    .where(eq(subscriptions.stripeCustomerId, customerId))
    .limit(1);

  return sub.length > 0 ? sub[0].userId : null;
}

// ─── tRPC Router ────────────────────────────────────────────────────

export const stripeRouter = router({
  // Get current user's subscription status
  getSubscription: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return { plan: "free" as PlanId, status: "active" };

    const sub = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, ctx.user.id))
      .limit(1);

    if (sub.length === 0) {
      return { plan: "free" as PlanId, status: "active" };
    }

    return {
      plan: sub[0].plan as PlanId,
      status: sub[0].status,
      stripeSubscriptionId: sub[0].stripeSubscriptionId,
      currentPeriodEnd: sub[0].currentPeriodEnd,
    };
  }),

  // Create a Stripe Checkout session for subscription
  createCheckout: protectedProcedure
    .input(
      z.object({
        planId: z.enum(["pro", "enterprise"]),
        interval: z.enum(["month", "year"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const stripe = getStripe();
      const priceId = await getOrCreatePrice(input.planId, input.interval);
      const customerId = await getOrCreateCustomer(
        ctx.user.id,
        ctx.user.email || "",
        ctx.user.name
      );

      const origin = ctx.req.headers.origin || "http://localhost:3000";

      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        client_reference_id: ctx.user.id.toString(),
        customer_email: undefined, // Already set on customer object
        mode: "subscription",
        allow_promotion_codes: true,
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${origin}/pricing?success=true&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/pricing?canceled=true`,
        metadata: {
          user_id: ctx.user.id.toString(),
          plan_id: input.planId,
          interval: input.interval,
        },
        subscription_data: {
          metadata: {
            user_id: ctx.user.id.toString(),
            plan_id: input.planId,
          },
        },
      });

      return { url: session.url };
    }),

  // Change subscription plan (upgrade or downgrade)
  changePlan: protectedProcedure
    .input(
      z.object({
        planId: z.enum(["pro", "enterprise"]),
        interval: z.enum(["month", "year"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const sub = await db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.userId, ctx.user.id))
        .limit(1);

      if (sub.length === 0 || !sub[0].stripeSubscriptionId) {
        throw new Error("No active subscription found. Please subscribe first.");
      }

      const stripe = getStripe();
      const subscription = await stripe.subscriptions.retrieve(sub[0].stripeSubscriptionId);

      if (subscription.status !== "active" && subscription.status !== "trialing") {
        throw new Error("Subscription is not active. Cannot change plan.");
      }

      const newPriceId = await getOrCreatePrice(input.planId, input.interval);
      const currentItem = subscription.items.data[0];

      // Update subscription with proration_behavior = "always_invoice"
      // This charges the user immediately for downgrades (as requested)
      await stripe.subscriptions.update(sub[0].stripeSubscriptionId, {
        items: [
          {
            id: currentItem.id,
            price: newPriceId,
          },
        ],
        proration_behavior: "always_invoice",
        metadata: {
          user_id: ctx.user.id.toString(),
          plan_id: input.planId,
        },
      });

      // Update local subscription record immediately
      await db
        .update(subscriptions)
        .set({ plan: input.planId })
        .where(eq(subscriptions.userId, ctx.user.id));

      return { success: true, newPlan: input.planId };
    }),

  // Cancel subscription (keeps remaining credits, stops auto-renewal)
  cancelSubscription: protectedProcedure.mutation(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const sub = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, ctx.user.id))
      .limit(1);

    if (sub.length === 0 || !sub[0].stripeSubscriptionId) {
      throw new Error("No active subscription found");
    }

    const stripe = getStripe();

    // Cancel at period end — user keeps access until billing period ends
    // Their remaining credits are preserved (never zeroed out)
    await stripe.subscriptions.update(sub[0].stripeSubscriptionId, {
      cancel_at_period_end: true,
    });

    console.log(`[Stripe] Subscription ${sub[0].stripeSubscriptionId} set to cancel at period end for user ${ctx.user.id}`);

    return { success: true, message: "Subscription will cancel at the end of your billing period. Your remaining credits are preserved." };
  }),

  // Resume a cancelled subscription (undo cancel_at_period_end)
  resumeSubscription: protectedProcedure.mutation(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const sub = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, ctx.user.id))
      .limit(1);

    if (sub.length === 0 || !sub[0].stripeSubscriptionId) {
      throw new Error("No subscription found");
    }

    const stripe = getStripe();

    await stripe.subscriptions.update(sub[0].stripeSubscriptionId, {
      cancel_at_period_end: false,
    });

    return { success: true, message: "Subscription resumed. Auto-renewal is back on." };
  }),

  // Create a Stripe Customer Portal session (manage subscription)
  createPortalSession: protectedProcedure.mutation(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const sub = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, ctx.user.id))
      .limit(1);

    if (sub.length === 0 || !sub[0].stripeCustomerId) {
      throw new Error("No active subscription found");
    }

    const stripe = getStripe();
    const origin = ctx.req.headers.origin || "http://localhost:3000";

    const session = await stripe.billingPortal.sessions.create({
      customer: sub[0].stripeCustomerId,
      return_url: `${origin}/pricing`,
    });

    return { url: session.url };
  }),
});

// ─── Webhook Handler (Express route) ────────────────────────────────

export function registerStripeWebhook(app: Express) {
  // MUST register BEFORE express.json() middleware
  app.post(
    "/api/stripe/webhook",
    // Use raw body for signature verification
    (req: Request, res: Response, next) => {
      // Check if body is already parsed (raw buffer)
      if (Buffer.isBuffer(req.body)) {
        return next();
      }
      // Otherwise, collect raw body
      let data = "";
      req.setEncoding("utf8");
      req.on("data", (chunk) => (data += chunk));
      req.on("end", () => {
        (req as any).rawBody = data;
        next();
      });
    },
    async (req: Request, res: Response) => {
      const stripe = getStripe();
      const sig = req.headers["stripe-signature"] as string;
      const webhookSecret = ENV.stripeWebhookSecret;

      let event: Stripe.Event;

      try {
        const body = Buffer.isBuffer(req.body)
          ? req.body
          : (req as any).rawBody || JSON.stringify(req.body);

        event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
      } catch (err: any) {
        console.error("[Stripe Webhook] Signature verification failed:", err.message);
        return res.status(400).json({ error: "Webhook signature verification failed" });
      }

      // Handle test events
      if (event.id.startsWith("evt_test_")) {
        console.log("[Stripe Webhook] Test event detected, returning verification response");
        return res.json({ verified: true });
      }

      console.log(`[Stripe Webhook] Received event: ${event.type} (${event.id})`);

      try {
        switch (event.type) {
          case "checkout.session.completed": {
            const session = event.data.object as Stripe.Checkout.Session;
            await handleCheckoutCompleted(session);
            break;
          }
          case "customer.subscription.updated": {
            const subscription = event.data.object as Stripe.Subscription;
            await handleSubscriptionUpdated(subscription);
            break;
          }
          case "customer.subscription.deleted": {
            const subscription = event.data.object as Stripe.Subscription;
            await handleSubscriptionDeleted(subscription);
            break;
          }
          case "invoice.paid": {
            const invoice = event.data.object as Stripe.Invoice;
            await handleInvoicePaid(invoice);
            break;
          }
          case "invoice.payment_failed": {
            const invoice = event.data.object as Stripe.Invoice;
            await handleInvoicePaymentFailed(invoice);
            break;
          }
          default:
            console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`);
        }
      } catch (err: any) {
        console.error(`[Stripe Webhook] Error processing ${event.type}:`, err.message);
      }

      res.json({ received: true });
    }
  );

  // ─── Monthly Credit Refill Cron Endpoint ─────────────────────────
  // Called by an external cron service (e.g., cron-job.org) on the 1st of each month
  // Also can be triggered manually by admin
  app.post("/api/cron/monthly-refill", async (req: Request, res: Response) => {
    // Verify cron secret or admin auth
    const authHeader = req.headers.authorization;
    const cronSecret = process.env.CRON_SECRET || ENV.cookieSecret; // Reuse JWT secret as fallback

    if (authHeader !== `Bearer ${cronSecret}`) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    try {
      const result = await processAllMonthlyRefills();
      console.log(`[Cron] Monthly credit refill completed: ${result.processed} users processed, ${result.refilled} refilled`);
      res.json({ success: true, ...result });
    } catch (err: any) {
      console.error("[Cron] Monthly refill error:", err.message);
      res.status(500).json({ error: "Refill processing failed", message: err.message });
    }
  });
}

// ─── Batch Monthly Refill ──────────────────────────────────────────

export async function processAllMonthlyRefills(): Promise<{ processed: number; refilled: number; errors: number }> {
  const db = await getDb();
  if (!db) return { processed: 0, refilled: 0, errors: 0 };

  // Get all non-unlimited credit balance holders
  const allBalances = await db
    .select({ userId: creditBalances.userId })
    .from(creditBalances)
    .where(eq(creditBalances.isUnlimited, false));

  let processed = 0;
  let refilled = 0;
  let errors = 0;

  for (const bal of allBalances) {
    processed++;
    try {
      const result = await processMonthlyRefill(bal.userId);
      if (result) refilled++;
    } catch (err: any) {
      errors++;
      console.error(`[Cron] Refill error for user ${bal.userId}:`, err.message);
    }
  }

  return { processed, refilled, errors };
}

// ─── Webhook Event Handlers ─────────────────────────────────────────

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const db = await getDb();
  if (!db) return;

  const userId = parseInt(session.metadata?.user_id || session.client_reference_id || "0");

  // Handle credit pack purchases
  if (session.metadata?.type === "credit_pack") {
    const packId = session.metadata.pack_id;
    const pack = CREDIT_PACKS.find((p) => p.id === packId);
    const credits = pack?.credits || parseInt(session.metadata.credits || "0");
    const paymentIntentId = typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id || "";

    if (userId && credits > 0) {
      await addCredits(
        userId,
        credits,
        "pack_purchase",
        `Purchased ${pack?.name || "Credit Pack"}: +${credits} credits`,
        paymentIntentId
      );
      console.log(`[Stripe Webhook] Credit pack purchased: user=${userId}, pack=${packId}, credits=${credits}`);
    }
    return;
  }

  const planId = (session.metadata?.plan_id || "pro") as PlanId;
  const customerId =
    typeof session.customer === "string" ? session.customer : session.customer?.id || "";
  const subscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription?.id || "";

  if (!userId || !customerId) {
    console.error("[Stripe Webhook] Missing userId or customerId in checkout session");
    return;
  }

  // Upsert subscription record
  const existing = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(subscriptions)
      .set({
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscriptionId,
        plan: planId,
        status: "active",
      })
      .where(eq(subscriptions.userId, userId));
  } else {
    await db.insert(subscriptions).values({
      userId,
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscriptionId,
      plan: planId,
      status: "active",
    });
  }

  // Grant initial monthly credit allocation for the new subscription
  const tier = PRICING_TIERS.find((t) => t.id === planId);
  if (tier && tier.credits.monthlyAllocation > 0) {
    await addCredits(
      userId,
      tier.credits.monthlyAllocation,
      "monthly_refill",
      `Initial ${tier.name} plan credits: +${tier.credits.monthlyAllocation} credits`
    );
    console.log(`[Stripe Webhook] Initial credits granted: user=${userId}, plan=${planId}, credits=${tier.credits.monthlyAllocation}`);
  }

  console.log(
    `[Stripe Webhook] Checkout completed: user=${userId}, plan=${planId}, subscription=${subscriptionId}`
  );
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const db = await getDb();
  if (!db) return;

  const planId = (subscription.metadata?.plan_id || "pro") as PlanId;
  const status = mapStripeStatus(subscription.status);
  const currentPeriodEnd = new Date(
    ((subscription as any).current_period_end || Math.floor(Date.now() / 1000)) * 1000
  );

  // Get the subscription record to find userId
  const subRecord = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.stripeSubscriptionId, subscription.id))
    .limit(1);

  const previousPlan = subRecord[0]?.plan as PlanId | undefined;

  await db
    .update(subscriptions)
    .set({
      plan: planId,
      status,
      currentPeriodEnd,
    })
    .where(eq(subscriptions.stripeSubscriptionId, subscription.id));

  // If plan changed (upgrade or downgrade), log it
  if (previousPlan && previousPlan !== planId && subRecord[0]) {
    const newTier = PRICING_TIERS.find((t) => t.id === planId);
    const oldTier = PRICING_TIERS.find((t) => t.id === previousPlan);
    console.log(
      `[Stripe Webhook] Plan changed: user=${subRecord[0].userId}, ${oldTier?.name || previousPlan} → ${newTier?.name || planId}`
    );
  }

  console.log(
    `[Stripe Webhook] Subscription updated: ${subscription.id}, status=${status}, plan=${planId}`
  );
}

/**
 * Handle subscription deletion (cancellation completed).
 * IMPORTANT: We keep the user's remaining credits — they are NOT zeroed out.
 * The user simply won't get any more monthly refills.
 */
async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const db = await getDb();
  if (!db) return;

  // Get userId before updating
  const subRecord = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.stripeSubscriptionId, subscription.id))
    .limit(1);

  await db
    .update(subscriptions)
    .set({
      plan: "free",
      status: "canceled",
      stripeSubscriptionId: null,
    })
    .where(eq(subscriptions.stripeSubscriptionId, subscription.id));

  if (subRecord[0]) {
    console.log(
      `[Stripe Webhook] Subscription deleted for user=${subRecord[0].userId}. Credits preserved — no more monthly refills.`
    );
  }
}

/**
 * Handle invoice.paid — this fires on every successful subscription payment,
 * including the initial payment AND all subsequent auto-renewals.
 * 
 * On renewal (not the first invoice), we process the monthly credit refill.
 * This is the core auto-renewal billing logic:
 * - Stripe auto-charges the customer
 * - We receive invoice.paid webhook
 * - We refill the user's credits based on their plan tier
 */
async function handleInvoicePaid(invoice: Stripe.Invoice) {
  const db = await getDb();
  if (!db) return;

  const subId = typeof (invoice as any).subscription === "string"
    ? (invoice as any).subscription
    : (invoice as any).subscription?.id;

  if (!subId) {
    // Not a subscription invoice (could be a one-time credit pack purchase)
    console.log(`[Stripe Webhook] Invoice paid (non-subscription): ${invoice.id}`);
    return;
  }

  // Find the user from the subscription
  const subRecord = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.stripeSubscriptionId, subId))
    .limit(1);

  if (subRecord.length === 0) {
    console.log(`[Stripe Webhook] Invoice paid but no matching subscription found: sub=${subId}`);
    return;
  }

  const userId = subRecord[0].userId;
  const planId = subRecord[0].plan as PlanId;

  // Check if this is a renewal (not the first invoice)
  // billing_reason can be: "subscription_create", "subscription_cycle", "subscription_update", etc.
  const billingReason = (invoice as any).billing_reason;

  if (billingReason === "subscription_cycle") {
    // This is an auto-renewal payment — refill credits!
    const tier = PRICING_TIERS.find((t) => t.id === planId);
    const allocation = tier?.credits.monthlyAllocation ?? 0;

    if (allocation > 0) {
      await addCredits(
        userId,
        allocation,
        "monthly_refill",
        `Auto-renewal credit refill (${tier?.name || planId} plan): +${allocation} credits`,
        typeof (invoice as any).payment_intent === "string" ? (invoice as any).payment_intent : (invoice as any).payment_intent?.id
      );
      console.log(
        `[Stripe Webhook] Auto-renewal refill: user=${userId}, plan=${planId}, credits=+${allocation}`
      );
    }
  } else if (billingReason === "subscription_update") {
    // Plan was changed (upgrade/downgrade) — the proration invoice was paid
    console.log(`[Stripe Webhook] Plan change invoice paid: user=${userId}, plan=${planId}`);
  } else {
    // First invoice (subscription_create) — credits already granted in handleCheckoutCompleted
    console.log(`[Stripe Webhook] Initial invoice paid: user=${userId}, plan=${planId}, reason=${billingReason}`);
  }
}

/**
 * Handle failed invoice payment — mark subscription as past_due.
 * Credits are preserved but no new refills will happen until payment succeeds.
 */
async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  const db = await getDb();
  if (!db) return;

  const subId = typeof (invoice as any).subscription === "string"
    ? (invoice as any).subscription
    : (invoice as any).subscription?.id;

  if (subId) {
    const subscriptionId = typeof subId === "string" ? subId : subId;
    await db
      .update(subscriptions)
      .set({ status: "past_due" })
      .where(eq(subscriptions.stripeSubscriptionId, subscriptionId));

    console.log(`[Stripe Webhook] Invoice payment failed: ${invoice.id}, subscription marked past_due`);
  }
}

function mapStripeStatus(
  stripeStatus: string
): "active" | "canceled" | "past_due" | "incomplete" | "trialing" {
  switch (stripeStatus) {
    case "active":
      return "active";
    case "canceled":
    case "unpaid":
      return "canceled";
    case "past_due":
      return "past_due";
    case "incomplete":
    case "incomplete_expired":
      return "incomplete";
    case "trialing":
      return "trialing";
    default:
      return "active";
  }
}
