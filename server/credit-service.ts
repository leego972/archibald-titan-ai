/**
 * Credit Service — Core business logic for the Manus-style credit system.
 *
 * Admin users get unlimited credits (isUnlimited = true).
 * Paid users get monthly refills based on their plan tier.
 * All users can purchase additional credit packs.
 */

import { eq, sql, desc } from "drizzle-orm";
import { log } from "./_core/logger";
import { getDb } from "./db";
import { creditBalances, creditTransactions, users, subscriptions } from "../drizzle/schema";
import {
  PRICING_TIERS, INTERNAL_TIERS, CREDIT_COSTS,
  DAILY_FREE_CREDITS_PLAN,
  type PlanId, type CreditActionType
} from "../shared/pricing";
import { getUserPlan } from "./subscription-gate";
import { isAdminRole } from '@shared/const';
import {
  validateCreditOperation,
  logSecurityEvent,
} from "./security-hardening";

// ─── Types ─────────────────────────────────────────────────────────

export interface CreditBalanceInfo {
  credits: number;
  isUnlimited: boolean;
  lifetimeUsed: number;
  lifetimeAdded: number;
  lastRefillAt: Date | null;
  /** Free tier only — separate daily pool that resets every 24h, used before paid credits */
  dailyFreeCredits: number;
  dailyFreeLastGrantedAt: Date | null;
}

export interface CreditCheckResult {
  allowed: boolean;
  currentBalance: number;
  cost: number;
  isUnlimited: boolean;
  message?: string;
}

// ─── Ensure Balance Exists ─────────────────────────────────────────

async function ensureBalance(userId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const existing = await db
    .select({ id: creditBalances.id })
    .from(creditBalances)
    .where(eq(creditBalances.userId, userId))
    .limit(1);

  if (existing.length === 0) {
    // Check if user is admin
    const userResult = await db
      .select({ role: users.role })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const isAdmin = userResult.length > 0 && isAdminRole(userResult[0].role);

    // Get user's plan for signup bonus
    const plan = await getUserPlan(userId);
    const tier = PRICING_TIERS.find((t) => t.id === plan.planId) || INTERNAL_TIERS.find((t) => t.id === plan.planId);
    const signupBonus = tier?.credits.signupBonus ?? 25;

    await db.insert(creditBalances).values({
      userId,
      credits: isAdmin ? 999999 : signupBonus,
      isUnlimited: isAdmin,
      lifetimeCreditsAdded: isAdmin ? 0 : signupBonus,
      lifetimeCreditsUsed: 0,
    });

    // Log the signup bonus transaction (only for non-admin)
    if (!isAdmin && signupBonus > 0) {
      await db.insert(creditTransactions).values({
        userId,
        amount: signupBonus,
        type: "signup_bonus",
        description: `Welcome bonus: ${signupBonus} credits for signing up`,
        balanceAfter: signupBonus,
      });
    }
  }
}

// ─── Get Balance ───────────────────────────────────────────────────

export async function getCreditBalance(userId: number): Promise<CreditBalanceInfo> {
  const db = await getDb();
  if (!db) {
    return { credits: 0, isUnlimited: false, lifetimeUsed: 0, lifetimeAdded: 0, lastRefillAt: null, dailyFreeCredits: 0, dailyFreeLastGrantedAt: null };
  }

  await ensureBalance(userId);

  const result = await db
    .select()
    .from(creditBalances)
    .where(eq(creditBalances.userId, userId))
    .limit(1);

  if (result.length === 0) {
    return { credits: 0, isUnlimited: false, lifetimeUsed: 0, lifetimeAdded: 0, lastRefillAt: null, dailyFreeCredits: 0, dailyFreeLastGrantedAt: null };
  }

  const bal = result[0];
  return {
    credits: bal.credits,
    isUnlimited: bal.isUnlimited,
    lifetimeUsed: bal.lifetimeCreditsUsed,
    lifetimeAdded: bal.lifetimeCreditsAdded,
    lastRefillAt: bal.lastRefillAt,
    dailyFreeCredits: bal.dailyFreeCredits ?? 0,
    dailyFreeLastGrantedAt: bal.dailyFreeLastGrantedAt ?? null,
  };
}

// ─── Check Credits ─────────────────────────────────────────────────

export async function checkCredits(
  userId: number,
  action: CreditActionType
): Promise<CreditCheckResult> {
  const balance = await getCreditBalance(userId);
  const cost = CREDIT_COSTS[action];

  if (balance.isUnlimited) {
    return { allowed: true, currentBalance: balance.credits, cost, isUnlimited: true };
  }

  if (balance.credits >= cost) {
    return { allowed: true, currentBalance: balance.credits, cost, isUnlimited: false };
  }

  return {
    allowed: false,
    currentBalance: balance.credits,
    cost,
    isUnlimited: false,
    message: `Insufficient credits. You need ${cost} credits for this action but only have ${balance.credits}. Purchase more credits or upgrade your plan.`,
  };
}

// ─── Consume Credits ───────────────────────────────────────────────

export async function consumeCredits(
  userId: number,
  action: CreditActionType,
  description?: string
): Promise<{ success: boolean; balanceAfter: number }> {
  const db = await getDb();
  if (!db) return { success: false, balanceAfter: 0 };

  await ensureBalance(userId);

  // ── SECURITY: Credit Integrity Validation ──────────────────────
  const cost = CREDIT_COSTS[action];
  const validation = validateCreditOperation("consume", cost, userId);
  if (!validation.valid) {
    await logSecurityEvent(userId, "credit_integrity_violation", {
      operation: "consume",
      action,
      cost,
      error: validation.error,
    });
    return { success: false, balanceAfter: 0 };
  }

  // Map action key to DB enum type. All new action types pass through directly
  // since they are now defined in the schema enum. Fallback: "chat_message".
  const validTxTypes = new Set([
      // Core AI
      "chat_message", "builder_action", "voice_action", "image_generation", "video_generation",
      // Fetch & integrations
      "fetch_action", "github_action", "import_action", "clone_action", "replicate_action",
      // SEO & content
      "seo_run", "blog_generate", "content_generate",
      "content_campaign_create", "content_bulk_generate", "content_seo_brief",
      "marketing_run", "advertising_run",
      // Security tools
      "security_scan", "metasploit_action", "evilginx_action", "blackeye_action",
      "astra_scan", "exploit_exec", "exploit_cve_search",
      "cybermcp_scan", "red_team_run", "compliance_report",
      "siem_config", "siem_test", "event_bus_rule", "security_module_install",
      // Grants & business
      "grant_match", "grant_apply", "business_plan_generate",
      // Marketplace
      "marketplace_list", "marketplace_feature", "marketplace_ai_describe", "marketplace_ai_price",
      // Site monitor & sandbox
      "site_monitor_add", "site_monitor_check", "sandbox_run",
      // Affiliate, API, VPN
      "affiliate_action", "api_call", "vpn_generate",
      "vpn_chain_build", "vpn_chain_config",
      // Proxy & IP routing
      "proxy_test", "proxy_test_all", "proxy_scrape", "proxy_add", "ip_rotation_circuit",
      // Isolated browser & anonymity
      "isolated_browser", "isolated_browser_session",
      "tor_new_circuit", "tor_run_command",
      "linken_session_start", "linken_quick_create",
      // BIN checker
      "bin_lookup", "bin_bulk_lookup", "bin_reverse_search", "card_live_check",
      // Web agent
      "web_agent_task",
      // Credential & auth tools
      "credential_breach_check", "totp_code_generate",
    ]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const txType = (validTxTypes.has(action) ? action : "chat_message") as any;

  // Wrap in a transaction to prevent race conditions (check-then-deduct atomicity)
  return await db.transaction(async (tx) => {
    // Lock the row with SELECT ... FOR UPDATE to prevent concurrent deductions
    const bal = await tx
      .select({
        credits: creditBalances.credits,
        isUnlimited: creditBalances.isUnlimited,
        dailyFreeCredits: creditBalances.dailyFreeCredits,
      })
      .from(creditBalances)
      .where(eq(creditBalances.userId, userId))
      .for("update")
      .limit(1);

    if (bal.length === 0) return { success: false, balanceAfter: 0 };

    if (bal[0].isUnlimited) {
      // Admin — log the action but don't deduct
      await tx.insert(creditTransactions).values({
        userId,
        amount: 0,
        type: txType,
        description: description || `${action} (unlimited account)`,
        balanceAfter: bal[0].credits,
      });
      return { success: true, balanceAfter: bal[0].credits };
    }

    const cost = CREDIT_COSTS[action];

    // ── Daily Free Credits (Free Tier Only) ───────────────────────────────────────────────────────────────────────────
    // If the user has daily free credits, drain those first before touching paid credits.
    // Paid plan users never have dailyFreeCredits > 0 — this only fires for Free tier.
    const dailyFree = bal[0].dailyFreeCredits ?? 0;
    if (dailyFree > 0) {
      const freeDeduct = Math.min(dailyFree, cost);
      const remainingCost = cost - freeDeduct;

      // Deduct from daily free pool first
      await tx
        .update(creditBalances)
        .set({ dailyFreeCredits: sql`${creditBalances.dailyFreeCredits} - ${freeDeduct}` })
        .where(eq(creditBalances.userId, userId));

      // If daily free covered the full cost, done — no paid credits consumed
      if (remainingCost === 0) {
        await tx.insert(creditTransactions).values({
          userId,
          amount: 0,
          type: txType,
          description: description || `${action}: -${cost} daily free credits (no paid credits used)`,
          balanceAfter: bal[0].credits,
        });
        return { success: true, balanceAfter: bal[0].credits };
      }

      // Daily free partially covered it — deduct the remainder from paid credits
      if (bal[0].credits < remainingCost) {
        // Undo the daily free deduction since we can't complete the full action
        await tx
          .update(creditBalances)
          .set({ dailyFreeCredits: sql`${creditBalances.dailyFreeCredits} + ${freeDeduct}` })
          .where(eq(creditBalances.userId, userId));
        return { success: false, balanceAfter: bal[0].credits };
      }

      await tx
        .update(creditBalances)
        .set({
          credits: sql`${creditBalances.credits} - ${remainingCost}`,
          lifetimeCreditsUsed: sql`${creditBalances.lifetimeCreditsUsed} + ${remainingCost}`,
        })
        .where(eq(creditBalances.userId, userId));

      const updatedPartial = await tx
        .select({ credits: creditBalances.credits })
        .from(creditBalances)
        .where(eq(creditBalances.userId, userId))
        .limit(1);
      const partialBalance = updatedPartial[0]?.credits ?? 0;

      await tx.insert(creditTransactions).values({
        userId,
        amount: -remainingCost,
        type: txType,
        description: description || `${action}: -${freeDeduct} daily free + -${remainingCost} paid credits`,
        balanceAfter: partialBalance,
      });
      return { success: true, balanceAfter: partialBalance };
    }

    // ── Standard paid credit deduction ───────────────────────────────────────────────────────────────────────────
    if (bal[0].credits < cost) {
      return { success: false, balanceAfter: bal[0].credits };
    }

    // Deduct credits atomically within the transaction
    await tx
      .update(creditBalances)
      .set({
        credits: sql`${creditBalances.credits} - ${cost}`,
        lifetimeCreditsUsed: sql`${creditBalances.lifetimeCreditsUsed} + ${cost}`,
      })
      .where(eq(creditBalances.userId, userId));

    // Get updated balance
    const updated = await tx
      .select({ credits: creditBalances.credits })
      .from(creditBalances)
      .where(eq(creditBalances.userId, userId))
      .limit(1);

    const newBalance = updated[0]?.credits ?? 0;

    // Log transaction
    await tx.insert(creditTransactions).values({
      userId,
      amount: -cost,
      type: txType,
      description: description || `${action}: -${cost} credits`,
      balanceAfter: newBalance,
    });

    return { success: true, balanceAfter: newBalance };
  });
}

// ─── Consume a custom credit amount (for tiered/scaled actions) ──────────────
/**
 * Like consumeCredits but accepts a custom cost instead of the fixed CREDIT_COSTS lookup.
 * Use this for actions whose cost scales with complexity (e.g. hop count, node count).
 * The action key is still used for transaction logging and type tracking.
 */
export async function consumeCreditsAmount(
  userId: number,
  amount: number,
  action: CreditActionType,
  description?: string
): Promise<{ success: boolean; balanceAfter: number }> {
  if (amount <= 0) return { success: true, balanceAfter: 0 };
  const db = await getDb();
  if (!db) return { success: false, balanceAfter: 0 };

  await ensureBalance(userId);

  const validTxTypes = new Set([
    // Core AI
    "chat_message", "builder_action", "voice_action", "image_generation", "video_generation",
    // Fetch & integrations
    "fetch_action", "github_action", "import_action", "clone_action", "replicate_action",
    // SEO & Content
    "seo_run", "blog_generate", "content_generate",
    "content_campaign_create", "content_bulk_generate", "content_seo_brief",
    "marketing_run", "advertising_run",
    // Security tools
    "security_scan", "metasploit_action", "evilginx_action", "blackeye_action",
    "astra_scan", "exploit_exec", "exploit_cve_search",
    "cybermcp_scan", "red_team_run", "compliance_report",
    "siem_config", "siem_test", "event_bus_rule", "security_module_install",
    // Grants & business
    "grant_match", "grant_apply", "business_plan_generate",
    // Marketplace
    "marketplace_list", "marketplace_feature", "marketplace_ai_describe", "marketplace_ai_price",
    // Site monitor & sandbox
    "site_monitor_add", "site_monitor_check", "sandbox_run",
    // Affiliate, API, VPN
    "affiliate_action", "api_call", "vpn_generate",
    "vpn_chain_build", "vpn_chain_config",
    // Proxy & IP routing
    "proxy_test", "proxy_test_all", "proxy_scrape", "proxy_add", "ip_rotation_circuit",
    // Isolated browser & anonymity
    "isolated_browser", "isolated_browser_session",
    "tor_new_circuit", "tor_run_command",
    "linken_session_start", "linken_quick_create",
    // BIN checker
    "bin_lookup", "bin_bulk_lookup", "bin_reverse_search", "card_live_check",
    // Web agent
    "web_agent_task",
    // Credential & auth tools
    "credential_breach_check", "totp_code_generate",
  ]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const txType = (validTxTypes.has(action) ? action : "chat_message") as any;

  return await db.transaction(async (tx) => {
    const bal = await tx
      .select({ credits: creditBalances.credits, isUnlimited: creditBalances.isUnlimited })
      .from(creditBalances)
      .where(eq(creditBalances.userId, userId))
      .for("update")
      .limit(1);
    if (bal.length === 0) return { success: false, balanceAfter: 0 };
    if (bal[0].isUnlimited) {
      await tx.insert(creditTransactions).values({
        userId, amount: 0, type: txType,
        description: description || `${action}: ${amount} credits (unlimited account)`,
        balanceAfter: bal[0].credits,
      });
      return { success: true, balanceAfter: bal[0].credits };
    }
    if (bal[0].credits < amount) return { success: false, balanceAfter: bal[0].credits };
    await tx
      .update(creditBalances)
      .set({
        credits: sql`${creditBalances.credits} - ${amount}`,
        lifetimeCreditsUsed: sql`${creditBalances.lifetimeCreditsUsed} + ${amount}`,
      })
      .where(eq(creditBalances.userId, userId));
    const updated = await tx
      .select({ credits: creditBalances.credits })
      .from(creditBalances)
      .where(eq(creditBalances.userId, userId))
      .limit(1);
    const newBalance = updated[0]?.credits ?? 0;
    await tx.insert(creditTransactions).values({
      userId, amount: -amount, type: txType,
      description: description || `${action}: -${amount} credits`,
      balanceAfter: newBalance,
    });
    return { success: true, balanceAfter: newBalance };
  });
}

// ─── Add Credits ───────────────────────────────────────────────────

export async function addCredits(
  userId: number,
  amount: number,
  type: "monthly_refill" | "pack_purchase" | "admin_adjustment" | "referral_bonus" | "signup_bonus" | "daily_login_bonus" | "marketplace_sale" | "marketplace_refund" | "marketplace_purchase" | "marketplace_seller_fee" | "marketplace_seller_renewal" | "marketplace_boost" | "marketplace_verification",
  description: string,
  stripePaymentIntentId?: string
): Promise<{ success: boolean; balanceAfter: number }> {
  const db = await getDb();
  if (!db) return { success: false, balanceAfter: 0 };

  await ensureBalance(userId);

  // ── SECURITY: Credit Integrity Validation ──────────────────────
  // Validate the credit addition amount. Admin adjustments bypass.
  const isAdminOp = type === "admin_adjustment";
  const validation = validateCreditOperation("add", amount, userId, isAdminOp);
  if (!validation.valid) {
    await logSecurityEvent(userId, "credit_integrity_violation", {
      operation: "add",
      type,
      amount,
      error: validation.error,
    });
    return { success: false, balanceAfter: 0 };
  }

  // ── Idempotency: prevent double-crediting on Stripe webhook retries ──────
  if (stripePaymentIntentId) {
    const { creditTransactions: ctTable } = await import("../drizzle/schema.js");
    const existing = await db
      .select({ id: ctTable.id })
      .from(ctTable)
      .where(eq(ctTable.stripePaymentIntentId, stripePaymentIntentId))
      .limit(1);
    if (existing.length > 0) {
      const bal = await db
        .select({ credits: creditBalances.credits })
        .from(creditBalances)
        .where(eq(creditBalances.userId, userId))
        .limit(1);
      const currentBalance = bal[0]?.credits ?? 0;
      log.info(`[Credits] Idempotency skip: payment_intent=${stripePaymentIntentId} already credited for user=${userId}`);
      return { success: true, balanceAfter: currentBalance };
    }
  }
  // Wrap in a transaction to ensure balance update + transaction log are atomic
  return await db.transaction(async (tx) => {
    // Add credits atomically within the transaction
    await tx
      .update(creditBalances)
      .set({
        credits: sql`${creditBalances.credits} + ${amount}`,
        lifetimeCreditsAdded: sql`${creditBalances.lifetimeCreditsAdded} + ${amount}`,
        ...(type === "monthly_refill" ? { lastRefillAt: new Date() } : {}),
      })
      .where(eq(creditBalances.userId, userId));

    // Get updated balance
    const updated = await tx
      .select({ credits: creditBalances.credits })
      .from(creditBalances)
      .where(eq(creditBalances.userId, userId))
      .limit(1);

    const newBalance = updated[0]?.credits ?? 0;

    // Log transaction
    await tx.insert(creditTransactions).values({
      userId,
      amount,
      type,
      description,
      balanceAfter: newBalance,
      stripePaymentIntentId: stripePaymentIntentId || null,
    });

    return { success: true, balanceAfter: newBalance };
  });
}

// ─── Monthly Refill ────────────────────────────────────────────────

export async function processMonthlyRefill(userId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  await ensureBalance(userId);

  const bal = await db
    .select({ lastRefillAt: creditBalances.lastRefillAt, isUnlimited: creditBalances.isUnlimited })
    .from(creditBalances)
    .where(eq(creditBalances.userId, userId))
    .limit(1);

  if (bal.length === 0 || bal[0].isUnlimited) return false;

  // ── Subscription status guard ─────────────────────────────────────────────
  // Free-tier users have no subscription record → always eligible for 500/mo refill.
  // Paid subscribers who are past_due, canceled, unpaid, or incomplete are NOT
  // refilled until their payment is resolved (Stripe will send subscription.updated
  // with status "active" when payment recovers, which restores their full access).
  const subRecord = await db
    .select({ status: subscriptions.status })
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId))
    .limit(1);

  if (subRecord.length > 0 && !["active", "trialing"].includes(subRecord[0].status)) {
    log.info(`[Credits] Skipping monthly refill for user=${userId}: subscription status is "${subRecord[0].status}"`);
    return false;
  }

  // Check if already refilled this month
  const now = new Date();
  const lastRefill = bal[0].lastRefillAt;
  if (lastRefill) {
    const sameMonth =
      lastRefill.getUTCFullYear() === now.getUTCFullYear() &&
      lastRefill.getUTCMonth() === now.getUTCMonth();
    if (sameMonth) return false; // Already refilled this month
  }

  // Get user's plan allocation
  const plan = await getUserPlan(userId);
  const tier = PRICING_TIERS.find((t) => t.id === plan.planId) || INTERNAL_TIERS.find((t) => t.id === plan.planId);
  const allocation = tier?.credits.monthlyAllocation ?? 50;

  if (allocation <= 0) return false;

  await addCredits(
    userId,
    allocation,
    "monthly_refill",
    `Monthly credit refill: +${allocation} credits (${tier?.name || "Free"} plan)`
  );

  return true;
}

// ─── Daily Login Bonus (Free Tier Engagement) ────────────────────────
//
// DAILY LOGIN BONUS PHILOSOPHY:
// - Free users get 5 credits per day just for logging in / using the platform.
// - Capped at 150 credits per month (30 days × 5) to prevent abuse.
// - This costs nothing (credits are virtual) but dramatically increases:
//   1. Daily active users (DAU) — users come back every day to claim bonus
//   2. Retention — users feel progress even on the free tier
//   3. Conversion — users who engage daily are more likely to upgrade
// - Only applies to free tier users. Paid users already get generous allocations.
// - The bonus resets each calendar month along with loginBonusThisMonth counter.

const DAILY_LOGIN_BONUS_AMOUNT = 50;
const MONTHLY_LOGIN_BONUS_CAP = 1500;

export async function processDailyLoginBonus(userId: number): Promise<{ awarded: boolean; amount: number; monthlyTotal: number }> {
  const db = await getDb();
  if (!db) return { awarded: false, amount: 0, monthlyTotal: 0 };

  await ensureBalance(userId);

  // Only award to non-unlimited (non-admin) users
  const bal = await db
    .select({
      isUnlimited: creditBalances.isUnlimited,
      lastLoginBonusAt: creditBalances.lastLoginBonusAt,
      loginBonusThisMonth: creditBalances.loginBonusThisMonth,
    })
    .from(creditBalances)
    .where(eq(creditBalances.userId, userId))
    .limit(1);

  if (bal.length === 0 || bal[0].isUnlimited) {
    return { awarded: false, amount: 0, monthlyTotal: 0 };
  }

  // Only award to free tier users
  const plan = await getUserPlan(userId);
  if (plan.planId !== "free") {
    return { awarded: false, amount: 0, monthlyTotal: bal[0].loginBonusThisMonth };
  }

  const now = new Date();
  const lastBonus = bal[0].lastLoginBonusAt;
  let monthlyTotal = bal[0].loginBonusThisMonth;

  // Reset monthly counter if we're in a new month
  if (lastBonus) {
    const differentMonth =
      lastBonus.getUTCFullYear() !== now.getUTCFullYear() ||
      lastBonus.getUTCMonth() !== now.getUTCMonth();
    if (differentMonth) {
      monthlyTotal = 0;
    }
  }

  // Check if already claimed today
  if (lastBonus) {
    const sameDay =
      lastBonus.getUTCFullYear() === now.getUTCFullYear() &&
      lastBonus.getUTCMonth() === now.getUTCMonth() &&
      lastBonus.getUTCDate() === now.getUTCDate();
    if (sameDay) {
      return { awarded: false, amount: 0, monthlyTotal };
    }
  }

  // Check monthly cap
  if (monthlyTotal >= MONTHLY_LOGIN_BONUS_CAP) {
    return { awarded: false, amount: 0, monthlyTotal };
  }

  // Calculate amount (might be less than 5 if near cap)
  const remaining = MONTHLY_LOGIN_BONUS_CAP - monthlyTotal;
  const awardAmount = Math.min(DAILY_LOGIN_BONUS_AMOUNT, remaining);

  if (awardAmount <= 0) {
    return { awarded: false, amount: 0, monthlyTotal };
  }

  // Award the bonus — atomic conditional UPDATE prevents double-grant on concurrent calls.
    // The WHERE DATE() check means only one concurrent UPDATE will succeed (affectedRows=1).
    const newMonthlyTotal = monthlyTotal + awardAmount;

    const updateResult = await db
      .update(creditBalances)
      .set({ lastLoginBonusAt: now, loginBonusThisMonth: newMonthlyTotal })
      .where(
        and(
          eq(creditBalances.userId, userId),
          sql`(DATE(${creditBalances.lastLoginBonusAt}) < CURDATE() OR ${creditBalances.lastLoginBonusAt} IS NULL)`
        )
      );

    // If affectedRows = 0, another concurrent request already claimed today's bonus — bail out
    const affected = (updateResult as any)?.[0]?.affectedRows ?? (updateResult as any)?.affectedRows ?? 1;
    if (affected === 0) {
      return { awarded: false, amount: 0, monthlyTotal };
    }

    const result = await addCredits(
      userId,
      awardAmount,
      "daily_login_bonus",
      `Daily login bonus: +${awardAmount} credits (${newMonthlyTotal}/${MONTHLY_LOGIN_BONUS_CAP} this month)`
    );

    if (result.success) {
      return { awarded: true, amount: awardAmount, monthlyTotal: newMonthlyTotal };
    }

    // addCredits failed — restore the login bonus state so user can retry tomorrow
    await db
      .update(creditBalances)
      .set({ lastLoginBonusAt: bal[0].lastLoginBonusAt, loginBonusThisMonth: monthlyTotal })
      .where(eq(creditBalances.userId, userId))
      .catch(() => {});

    return { awarded: false, amount: 0, monthlyTotal };
  }

// ─── Get Transaction History ───────────────────────────────────────

export async function getCreditHistory(
  userId: number,
  limit: number = 50,
  offset: number = 0
): Promise<{ transactions: Array<{
  id: number;
  amount: number;
  type: string;
  description: string | null;
  balanceAfter: number;
  createdAt: Date;
}>; total: number }> {
  const db = await getDb();
  if (!db) return { transactions: [], total: 0 };

  const [rows, countResult] = await Promise.all([
    db
      .select()
      .from(creditTransactions)
      .where(eq(creditTransactions.userId, userId))
      .orderBy(desc(creditTransactions.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`COUNT(*)` })
      .from(creditTransactions)
      .where(eq(creditTransactions.userId, userId)),
  ]);

  return {
    transactions: rows.map((r) => ({
      id: r.id,
      amount: r.amount,
      type: r.type,
      description: r.description,
      balanceAfter: r.balanceAfter,
      createdAt: r.createdAt,
    })),
    total: countResult[0]?.count ?? 0,
  };
}

// ─── Admin: Set Unlimited ──────────────────────────────────────────

export async function setUnlimited(userId: number, unlimited: boolean): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await ensureBalance(userId);

  await db
    .update(creditBalances)
    .set({ isUnlimited: unlimited })
    .where(eq(creditBalances.userId, userId));
}

// ─── Admin: Adjust Credits ─────────────────────────────────────────

export async function adminAdjustCredits(
  userId: number,
  amount: number,
  reason: string
): Promise<{ success: boolean; balanceAfter: number }> {
  return addCredits(userId, amount, "admin_adjustment", `Admin adjustment: ${reason}`);
}
