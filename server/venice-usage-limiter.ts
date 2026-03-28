/**
 * venice-usage-limiter.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Per-tier daily Venice Pro shared-key usage limiter.
 *
 * When a user has NO personal API key, all their LLM calls route through the
 * owner's Venice Pro key. This module enforces a daily request budget per tier
 * to prevent a small number of users exhausting the shared key.
 *
 * Budget design (daily requests on shared Venice key):
 * ┌─────────────┬──────────────┬───────────────────────────────────────────┐
 * │ Tier        │ Daily Limit  │ Rationale                                 │
 * ├─────────────┼──────────────┼───────────────────────────────────────────┤
 * │ free        │ 20           │ Enough to evaluate the platform           │
 * │ pro         │ 100          │ ~$29/mo — comfortable daily usage         │
 * │ enterprise  │ 300          │ ~$99/mo — power user                      │
 * │ cyber       │ 600          │ ~$199/mo — heavy security usage           │
 * │ cyber_plus  │ 1500         │ ~$499/mo — near unlimited                 │
 * │ titan       │ unlimited    │ ~$4999/mo — no cap                        │
 * │ admin       │ unlimited    │ Owner accounts — no cap                   │
 * └─────────────┴──────────────┴───────────────────────────────────────────┘
 *
 * Storage: in-memory Map keyed by userId, reset at UTC midnight.
 * A DB-backed version can replace this later for multi-instance deployments.
 */

import { log } from "./_core/logger";
import type { PlanId } from "../shared/pricing";

// ─── Daily Limits Per Tier ────────────────────────────────────────────────────

export const VENICE_DAILY_LIMITS: Record<string, number> = {
  free:        20,
  pro:         100,
  enterprise:  300,
  cyber:       600,
  cyber_plus:  1500,
  titan:       -1,   // unlimited
  // Internal/admin tiers
  admin:       -1,
  head_admin:  -1,
};

// ─── In-Memory Usage Store ────────────────────────────────────────────────────

interface DailyUsage {
  /** UTC date string YYYY-MM-DD for which this count applies */
  date: string;
  /** Number of Venice shared-tier requests made today */
  count: number;
}

const usageStore = new Map<number, DailyUsage>();

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10); // "2026-03-28"
}

function getUsage(userId: number): DailyUsage {
  const today = todayUTC();
  const existing = usageStore.get(userId);
  if (existing && existing.date === today) return existing;
  // New day or new user — reset
  const fresh: DailyUsage = { date: today, count: 0 };
  usageStore.set(userId, fresh);
  return fresh;
}

// Cleanup stale entries every hour (entries older than today)
setInterval(() => {
  const today = todayUTC();
  let cleaned = 0;
  for (const [userId, usage] of usageStore) {
    if (usage.date !== today) {
      usageStore.delete(userId);
      cleaned++;
    }
  }
  if (cleaned > 0) {
    log.info(`[VeniceUsage] Cleaned ${cleaned} stale daily usage entries`);
  }
}, 60 * 60 * 1000);

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Check if a user is within their daily Venice shared-tier budget.
 * Does NOT consume a slot — call `recordVeniceRequest` after the call succeeds.
 *
 * @param userId  - The user's numeric ID
 * @param planId  - Their current plan (e.g. "free", "pro", "titan")
 * @returns { allowed: boolean; used: number; limit: number; message?: string }
 */
export function checkVeniceLimit(
  userId: number,
  planId: string,
): { allowed: boolean; used: number; limit: number; message?: string } {
  const limit = VENICE_DAILY_LIMITS[planId] ?? VENICE_DAILY_LIMITS.free;

  // Unlimited tiers always pass
  if (limit === -1) {
    const usage = getUsage(userId);
    return { allowed: true, used: usage.count, limit: -1 };
  }

  const usage = getUsage(userId);

  if (usage.count >= limit) {
    const tierLabel = planId.charAt(0).toUpperCase() + planId.slice(1).replace("_", " ");
    log.warn(`[VeniceUsage] User ${userId} (${planId}) hit daily Venice limit: ${usage.count}/${limit}`);
    return {
      allowed: false,
      used: usage.count,
      limit,
      message:
        `You've used all ${limit} shared AI requests for today on the ${tierLabel} plan. ` +
        `Your quota resets at midnight UTC. ` +
        (planId === "free"
          ? `Upgrade to Pro for 100 daily requests, or add your own OpenAI API key for unlimited usage.`
          : planId === "pro"
          ? `Upgrade to Enterprise for 300 daily requests, or add your own OpenAI API key for unlimited usage.`
          : `Add your own OpenAI API key in Account Settings for unlimited usage.`),
    };
  }

  return { allowed: true, used: usage.count, limit };
}

/**
 * Record a successful Venice shared-tier request for a user.
 * Call this AFTER the LLM call completes (success or failure — it was still consumed).
 */
export function recordVeniceRequest(userId: number): void {
  const usage = getUsage(userId);
  usage.count++;
  log.debug(`[VeniceUsage] User ${userId} Venice usage: ${usage.count}/${VENICE_DAILY_LIMITS.free}`);
}

/**
 * Get the current Venice usage for a user (for UI display).
 */
export function getVeniceUsage(userId: number, planId: string): {
  used: number;
  limit: number;
  remaining: number;
  resetAt: string;
} {
  const limit = VENICE_DAILY_LIMITS[planId] ?? VENICE_DAILY_LIMITS.free;
  const usage = getUsage(userId);
  const remaining = limit === -1 ? -1 : Math.max(0, limit - usage.count);

  // Next UTC midnight
  const now = new Date();
  const tomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));

  return {
    used: usage.count,
    limit,
    remaining,
    resetAt: tomorrow.toISOString(),
  };
}

/**
 * Get Venice usage stats for all active users (admin dashboard).
 */
export function getAllVeniceUsage(): Array<{
  userId: number;
  date: string;
  count: number;
}> {
  const result: Array<{ userId: number; date: string; count: number }> = [];
  for (const [userId, usage] of usageStore) {
    result.push({ userId, date: usage.date, count: usage.count });
  }
  return result.sort((a, b) => b.count - a.count);
}

/**
 * Admin: reset a specific user's daily Venice usage (e.g. after support ticket).
 */
export function resetVeniceUsage(userId: number): void {
  const today = todayUTC();
  usageStore.set(userId, { date: today, count: 0 });
  log.info(`[VeniceUsage] Admin reset Venice usage for user ${userId}`);
}
