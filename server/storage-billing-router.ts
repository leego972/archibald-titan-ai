/**
 * Titan Storage Billing Router
 * Handles Stripe checkout, customer portal, and webhooks for storage subscriptions.
 * Registered as an Express route (not tRPC) for the Stripe webhook endpoint.
 *
 * Fixes applied:
 *  - Stripe.CheckoutSession → Stripe.Checkout.Session (correct namespace)
 *  - sub.current_period_end cast via (sub as any) — field exists at runtime
 *    but is not on the TypeScript type in newer Stripe SDK versions
 */

import Stripe from "stripe";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { storageSubscriptions } from "../drizzle/storage-schema";
import { STORAGE_PLANS, type StoragePlanId, getStorageSubscription } from "./storage-service";
import { ENV } from "./_core/env";
import { createLogger } from "./_core/logger.js";
import type { Express, Request, Response } from "express";

const log = createLogger("StorageBilling");

// ─── Stripe Client ────────────────────────────────────────────────────────

let stripeInstance: Stripe | null = null;
function getStripe(): Stripe {
  if (!stripeInstance) {
    if (!ENV.stripeSecretKey) throw new Error("STRIPE_SECRET_KEY is not configured");
    stripeInstance = new Stripe(ENV.stripeSecretKey, {
      apiVersion: "2025-01-27.acacia" as Stripe.LatestApiVersion,
    });
  }
  return stripeInstance;
}

// ─── Price Cache ──────────────────────────────────────────────────────────

const priceCache: Record<string, string> = {};

async function getOrCreateStoragePrice(planId: StoragePlanId): Promise<string> {
  if (priceCache[planId]) return priceCache[planId];

  // Check env var first (set by running scripts/seed-storage.ts)
  const envKey = `STRIPE_STORAGE_PRICE_${planId.toUpperCase().replace(/-/g, "_")}`;
  const envPrice = process.env[envKey];
  if (envPrice) {
    priceCache[planId] = envPrice;
    return envPrice;
  }

  // Auto-create product and price
  const stripe = getStripe();
  const plan = STORAGE_PLANS[planId];

  const products = await stripe.products.list({ limit: 100 });
  let product = products.data.find(p => p.metadata.titan_storage_plan === planId && p.active);
  if (!product) {
    product = await stripe.products.create({
      name: `Archibald Titan Storage — ${plan.label}`,
      description: `Extra cloud storage add-on for Archibald Titan AI — ${plan.label}`,
      metadata: { titan_storage_plan: planId, quota_bytes: String(plan.bytes) },
    });
  }

  const prices = await stripe.prices.list({ product: product.id, active: true, limit: 100 });
  let price = prices.data.find(
    p => p.recurring?.interval === "month" && p.unit_amount === Math.round(plan.price_monthly * 100)
  );
  if (!price) {
    price = await stripe.prices.create({
      product: product.id,
      unit_amount: Math.round(plan.price_monthly * 100),
      currency: "usd",
      recurring: { interval: "month" },
      metadata: { titan_storage_plan: planId },
    });
  }

  priceCache[planId] = price.id;
  return price.id;
}

// ─── Get or create Stripe customer ───────────────────────────────────────

async function getOrCreateStorageCustomer(
  userId: number,
  email: string,
  name?: string | null
): Promise<string> {
  const existing = await getStorageSubscription(userId);
  if (existing?.stripeCustomerId) return existing.stripeCustomerId;

  const stripe = getStripe();
  const customer = await stripe.customers.create({
    email,
    name: name ?? undefined,
    metadata: { titan_user_id: String(userId) },
  });

  return customer.id;
}

// ─── tRPC Router ─────────────────────────────────────────────────────────

export const storageBillingRouter = router({

  /**
   * Create a Stripe Checkout session for a storage plan.
   */
  createCheckout: protectedProcedure
    .input(z.object({
      plan: z.enum(["10gb", "50gb", "100gb", "500gb", "1tb"]),
      successUrl: z.string().url().optional(),
      cancelUrl: z.string().url().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const stripe = getStripe();
      const priceId = await getOrCreateStoragePrice(input.plan as StoragePlanId);
      const customerId = await getOrCreateStorageCustomer(
        ctx.user.id,
        ctx.user.email ?? "",
        ctx.user.name
      );
      const appUrl = process.env.APP_URL || "https://archibaldtitan.com";

      // If user already has an active subscription, redirect to portal instead
      const existing = await getStorageSubscription(ctx.user.id);
      if (existing?.status === "active" && existing.stripeSubscriptionId) {
        const portal = await stripe.billingPortal.sessions.create({
          customer: customerId,
          return_url: input.successUrl || `${appUrl}/dashboard?tab=storage`,
        });
        return { checkout_url: portal.url, is_portal: true };
      }

      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        mode: "subscription",
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: input.successUrl || `${appUrl}/dashboard?tab=storage&storage_success=1`,
        cancel_url: input.cancelUrl || `${appUrl}/dashboard?tab=storage`,
        metadata: {
          titan_user_id: String(ctx.user.id),
          titan_storage_plan: input.plan,
        },
        subscription_data: {
          metadata: {
            titan_user_id: String(ctx.user.id),
            titan_storage_plan: input.plan,
          },
        },
        allow_promotion_codes: true,
      });

      return { checkout_url: session.url, is_portal: false };
    }),

  /**
   * Create a Stripe Customer Portal session for managing the storage subscription.
   */
  createPortal: protectedProcedure
    .input(z.object({ returnUrl: z.string().url().optional() }))
    .mutation(async ({ ctx, input }) => {
      const stripe = getStripe();
      const sub = await getStorageSubscription(ctx.user.id);
      if (!sub?.stripeCustomerId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "No storage subscription found." });
      }

      const appUrl = process.env.APP_URL || "https://archibaldtitan.com";
      const session = await stripe.billingPortal.sessions.create({
        customer: sub.stripeCustomerId,
        return_url: input.returnUrl || `${appUrl}/dashboard?tab=storage`,
      });

      return { portal_url: session.url };
    }),
});

// ─── Stripe Webhook Handler (Express) ────────────────────────────────────

const processedStorageEvents = new Set<string>();

export function registerStorageWebhook(app: Express): void {
  app.post(
    "/api/storage/stripe-webhook",
    // Note: body must be raw Buffer for Stripe signature verification.
    // This route is registered BEFORE express.json() middleware in _core/index.ts
    async (req: Request, res: Response) => {
      const sig = req.headers["stripe-signature"];
      const webhookSecret = process.env.STRIPE_STORAGE_WEBHOOK_SECRET;

      if (!webhookSecret) {
        log.warn("[StorageBilling] STRIPE_STORAGE_WEBHOOK_SECRET not set");
        return res.status(200).json({ received: true });
      }

      let event: Stripe.Event;
      try {
        const stripe = getStripe();
        event = stripe.webhooks.constructEvent(
          req.body as Buffer,
          sig as string,
          webhookSecret
        );
      } catch (err) {
        log.error(`[StorageBilling] Webhook signature verification failed: ${err}`);
        return res.status(400).send(`Webhook Error: ${err}`);
      }

      // Idempotency guard
      if (processedStorageEvents.has(event.id)) {
        return res.json({ received: true, duplicate: true });
      }
      processedStorageEvents.add(event.id);
      if (processedStorageEvents.size > 10000) {
        const first = processedStorageEvents.values().next().value;
        if (first) processedStorageEvents.delete(first);
      }

      try {
        await handleStorageWebhookEvent(event);
      } catch (err) {
        log.error(`[StorageBilling] Error handling event ${event.type}: ${err}`);
      }

      res.json({ received: true });
    }
  );
}

async function handleStorageWebhookEvent(event: Stripe.Event): Promise<void> {
  const db = await getDb();
  if (!db) return;

  switch (event.type) {

    case "checkout.session.completed": {
      // Use Stripe.Checkout.Session (correct namespace — not Stripe.CheckoutSession)
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = parseInt(session.metadata?.titan_user_id ?? "0");
      const plan = session.metadata?.titan_storage_plan as StoragePlanId;
      if (!userId || !plan) break;

      const planData = STORAGE_PLANS[plan];
      const existing = await getStorageSubscription(userId);

      if (existing) {
        await db.update(storageSubscriptions)
          .set({
            stripeCustomerId: session.customer as string,
            stripeSubscriptionId: session.subscription as string,
            plan,
            quotaBytes: planData.bytes,
            status: "active",
          })
          .where(eq(storageSubscriptions.userId, userId));
      } else {
        await db.insert(storageSubscriptions).values({
          userId,
          stripeCustomerId: session.customer as string,
          stripeSubscriptionId: session.subscription as string,
          plan,
          quotaBytes: planData.bytes,
          usedBytes: 0,
          status: "active",
        });
      }
      log.info(`[StorageBilling] Storage activated: user=${userId} plan=${plan}`);
      break;
    }

    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      const userId = parseInt(sub.metadata?.titan_user_id ?? "0");
      const plan = sub.metadata?.titan_storage_plan as StoragePlanId;
      if (!userId) break;

      const status = sub.status as "active" | "canceled" | "past_due" | "incomplete" | "trialing";
      const planData = plan ? STORAGE_PLANS[plan] : null;

      // current_period_end exists at runtime but may not be on the TS type in newer SDK
      // versions — cast via any to avoid TS2339
      const periodEnd = (sub as any).current_period_end as number | undefined;

      await db.update(storageSubscriptions)
        .set({
          status,
          ...(planData ? { plan, quotaBytes: planData.bytes } : {}),
          currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
          cancelAtPeriodEnd: sub.cancel_at_period_end,
        })
        .where(eq(storageSubscriptions.userId, userId));

      log.info(`[StorageBilling] Subscription updated: user=${userId} status=${status}`);
      break;
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const userId = parseInt(sub.metadata?.titan_user_id ?? "0");
      if (!userId) break;

      await db.update(storageSubscriptions)
        .set({ status: "canceled", cancelAtPeriodEnd: false })
        .where(eq(storageSubscriptions.userId, userId));

      log.info(`[StorageBilling] Subscription canceled: user=${userId}`);
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = invoice.customer as string;

      await db.update(storageSubscriptions)
        .set({ status: "past_due" })
        .where(eq(storageSubscriptions.stripeCustomerId, customerId));

      log.warn(`[StorageBilling] Payment failed for customer ${customerId}`);
      break;
    }

    case "invoice.payment_succeeded": {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = invoice.customer as string;

      await db.update(storageSubscriptions)
        .set({ status: "active" })
        .where(eq(storageSubscriptions.stripeCustomerId, customerId));
      break;
    }

    default:
      log.info(`[StorageBilling] Unhandled event: ${event.type}`);
  }
}
