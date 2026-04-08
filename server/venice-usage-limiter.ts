/**
 * venice-usage-limiter.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Per-tier daily Venice Pro shared-key usage limiter.
 *
 * Uses a write-through in-memory cache backed by the `venice_daily_usage`
 * database table so limits survive server restarts.
 *
 * Hot path: in-memory Map (O(1) read/write, no DB round-trip on check).
 * Persistence: DB upsert on every recordVeniceRequest call.
 * Warm-up: loadVeniceUsageFromDb() is called at server startup.
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
 */

import { getDb } from "./db";
import { venicelDailyUsage } from "../drizzle/schema";
import { eq, sql } from "drizzle-orm";
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

// ─── In-Memory Cache (hot path) ───────────────────────────────────────────────

interface DailyUsage {
  /** UTC date string YYYY-MM-DD for which this count applies */
  date: string;
  /** Number of Venice shared-tier requests made today */
  count: number;
}

const usageStore = new Map<number, DailyUsage>();

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

function getUsage(userId: number): DailyUsage {
  const today = todayUTC();
  const existing = usageStore.get(userId);
  if (existing && existing.date === today) return existing;
  const fresh: DailyUsage = { date: today, count: 0 };
  usageStore.set(userId, fresh);
  return fresh;
}

// ─── DB Persistence ───────────────────────────────────────────────────────────

/**
 * Warm up the in-memory store from today's DB rows.
 * Call once at server startup so limits survive restarts.
 */
export async function loadVeniceUsageFromDb(): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;
    const today = todayUTC();
    const rows = await db
      .select()
      .from(venicelDailyUsage)
      .where(eq(venicelDailyUsage.date, today));
    let loaded = 0;
    for (const row of rows) {
      usageStore.set(row.userId, { date: row.date, count: row.count });
      loaded++;
    }
    if (loaded > 0) {
      log.info(`[VeniceUsage] Loaded ${loaded} usage records from DB for ${today}`);
    }
  } catch (err) {
    log.warn(`[VeniceUsage] Failed to load usage from DB (will use fresh counts): ${err}`);
  }
}

/**
 * Persist the current in-memory count to the DB (upsert).
 * Called after every successful Venice request (non-blocking).
 */
async function persistUsage(userId: number, count: number): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;
    const today = todayUTC();
    await db
      .insert(venicelDailyUsage)
      .values({ userId, date: today, count })
      .onDuplicateKeyUpdate({ set: { count, updatedAt: sql`NOW()` } });
  } catch (err) {
    // Non-fatal — in-memory limit still enforced
    log.warn(`[VeniceUsage] Failed to persist usage to DB for user ${userId}: ${err}`);
  }
}

// Cleanup stale in-memory entries every hour
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
 */
export function checkVeniceLimit(
  userId: number,
  planId: string,
): { allowed: boolean; used: number; limit: number; message?: string } {
  const limit = VENICE_DAILY_LIMITS[planId] ?? VENICE_DAILY_LIMITS.free;

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
 * Updates the in-memory cache immediately and persists to DB asynchronously.
 */
export function recordVeniceRequest(userId: number): void {
  const usage = getUsage(userId);
  usage.count++;
  log.debug(`[VeniceUsage] User ${userId} Venice usage: ${usage.count}`);
  // Persist asynchronously — do not await to keep the hot path fast
  void persistUsage(userId, usage.count);
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
  void persistUsage(userId, 0);
  log.info(`[VeniceUsage] Admin reset Venice usage for user ${userId}`);
}
