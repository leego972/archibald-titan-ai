import { createLogger } from "./_core/logger.js";
import type { PlanId } from "../shared/pricing";

const log = createLogger("RateLimiter");

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Per-User Rate Limiter — Sliding Window
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * In-memory sliding window rate limiter that enforces requests-per-minute
 * (RPM) limits based on the user's subscription tier. This protects the
 * OpenAI key pool from being exhausted by any single user or tier.
 *
 * Design decisions:
 * - In-memory (not Redis) because Railway runs a single container and
 *   the data is ephemeral — if the container restarts, limits reset.
 * - Sliding window (not fixed window) to prevent burst-at-boundary attacks.
 * - Automatic cleanup of stale entries every 5 minutes to prevent leaks.
 * - Admin users bypass all limits (isUnlimited flag from credit system).
 *
 * ┌──────────────────────────────────────────────────────────────────────┐
 * │  Tier         │  RPM  │  Concurrent Builds  │  Rationale            │
 * │───────────────────────────────────────────────────────────────────── │
 * │  Free         │   6   │         1            │  ~1 req/10s, fair    │
 * │  Pro          │  20   │         3            │  Power user pace     │
 * │  Enterprise   │  60   │         5            │  Team/org usage      │
 * │  Cyber        │ 100   │         8            │  Heavy automation    │
 * │  Cyber+       │ 200   │        15            │  Agency-scale        │
 * │  Titan        │ 500   │        50            │  Enterprise-scale    │
 * └──────────────────────────────────────────────────────────────────────┘
 */

// ═══════════════════════════════════════════════════════════════════════════
// Tier Limits
// ═══════════════════════════════════════════════════════════════════════════

interface TierLimits {
  /** Maximum requests per minute (sliding window) */
  rpm: number;
  /** Maximum concurrent build requests */
  maxConcurrentBuilds: number;
}

const TIER_LIMITS: Record<string, TierLimits> = {
  free:        { rpm: 6,   maxConcurrentBuilds: 1  },
  pro:         { rpm: 20,  maxConcurrentBuilds: 3  },
  enterprise:  { rpm: 60,  maxConcurrentBuilds: 5  },
  cyber:       { rpm: 100, maxConcurrentBuilds: 8  },
  cyber_plus:  { rpm: 200, maxConcurrentBuilds: 15 },
  titan:       { rpm: 500, maxConcurrentBuilds: 50 },
};

// ═══════════════════════════════════════════════════════════════════════════
// State
// ═══════════════════════════════════════════════════════════════════════════

interface UserWindow {
  /** Timestamps of requests in the current sliding window */
  timestamps: number[];
  /** Number of currently active build requests */
  activeBuilds: number;
  /** Last activity timestamp (for cleanup) */
  lastActivity: number;
}

const userWindows: Map<number, UserWindow> = new Map();

// Cleanup stale entries every 5 minutes
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
const STALE_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes of inactivity

setInterval(() => {
  const now = Date.now();
  let cleaned = 0;
  for (const [userId, window] of userWindows) {
    if (now - window.lastActivity > STALE_THRESHOLD_MS) {
      userWindows.delete(userId);
      cleaned++;
    }
  }
  if (cleaned > 0) {
    log.info(`[RateLimiter] Cleaned ${cleaned} stale user windows (${userWindows.size} active)`);
  }
}, CLEANUP_INTERVAL_MS);

// ═══════════════════════════════════════════════════════════════════════════
// Core Functions
// ═══════════════════════════════════════════════════════════════════════════

function getOrCreateWindow(userId: number): UserWindow {
  let window = userWindows.get(userId);
  if (!window) {
    window = { timestamps: [], activeBuilds: 0, lastActivity: Date.now() };
    userWindows.set(userId, window);
  }
  return window;
}

function pruneWindow(window: UserWindow): void {
  const cutoff = Date.now() - 60_000; // 1-minute sliding window
  window.timestamps = window.timestamps.filter(t => t > cutoff);
}

/**
 * Check if a user is within their rate limit.
 * Does NOT consume a slot — call `recordRequest` after the check passes.
 */
export function checkRateLimit(
  userId: number,
  planId: PlanId,
  isUnlimited: boolean,
  isBuild: boolean = false,
): { allowed: boolean; message?: string; retryAfterMs?: number } {
  // Admin/unlimited users bypass all limits
  if (isUnlimited) {
    return { allowed: true };
  }

  const limits = TIER_LIMITS[planId] || TIER_LIMITS.free;
  const window = getOrCreateWindow(userId);
  pruneWindow(window);

  // Check RPM
  if (window.timestamps.length >= limits.rpm) {
    const oldestInWindow = window.timestamps[0];
    const retryAfterMs = oldestInWindow + 60_000 - Date.now();
    log.warn(`[RateLimiter] User ${userId} (${planId}) hit RPM limit: ${window.timestamps.length}/${limits.rpm}`);
    return {
      allowed: false,
      message: `You're sending messages too quickly. Your ${planId} plan allows ${limits.rpm} messages per minute. Please wait a moment and try again.`,
      retryAfterMs: Math.max(retryAfterMs, 1000),
    };
  }

  // Check concurrent builds
  if (isBuild && window.activeBuilds >= limits.maxConcurrentBuilds) {
    log.warn(`[RateLimiter] User ${userId} (${planId}) hit concurrent build limit: ${window.activeBuilds}/${limits.maxConcurrentBuilds}`);
    return {
      allowed: false,
      message: `You have ${window.activeBuilds} build${window.activeBuilds > 1 ? 's' : ''} running. Your ${planId} plan allows ${limits.maxConcurrentBuilds} concurrent build${limits.maxConcurrentBuilds > 1 ? 's' : ''}. Please wait for a build to finish, or upgrade your plan for more capacity.`,
    };
  }

  return { allowed: true };
}

/**
 * Record a request in the sliding window.
 * Call this AFTER checkRateLimit passes and before the actual LLM call.
 */
export function recordRequest(userId: number): void {
  const window = getOrCreateWindow(userId);
  window.timestamps.push(Date.now());
  window.lastActivity = Date.now();
}

/**
 * Mark a build as started (increments concurrent build counter).
 */
export function buildStarted(userId: number): void {
  const window = getOrCreateWindow(userId);
  window.activeBuilds++;
  window.lastActivity = Date.now();
}

/**
 * Mark a build as finished (decrements concurrent build counter).
 */
export function buildFinished(userId: number): void {
  const window = getOrCreateWindow(userId);
  window.activeBuilds = Math.max(0, window.activeBuilds - 1);
  window.lastActivity = Date.now();
}

/**
 * Get rate limiter status for monitoring/diagnostics.
 */
export function getRateLimiterStatus(): {
  activeUsers: number;
  users: Array<{
    userId: number;
    requestsInWindow: number;
    activeBuilds: number;
    lastActivityAgo: string;
  }>;
} {
  const now = Date.now();
  const users: Array<{
    userId: number;
    requestsInWindow: number;
    activeBuilds: number;
    lastActivityAgo: string;
  }> = [];

  for (const [userId, window] of userWindows) {
    pruneWindow(window);
    const agoMs = now - window.lastActivity;
    const agoStr = agoMs < 60_000
      ? `${Math.round(agoMs / 1000)}s`
      : `${Math.round(agoMs / 60_000)}m`;

    users.push({
      userId,
      requestsInWindow: window.timestamps.length,
      activeBuilds: window.activeBuilds,
      lastActivityAgo: agoStr,
    });
  }

  return {
    activeUsers: userWindows.size,
    users: users.sort((a, b) => b.requestsInWindow - a.requestsInWindow),
  };
}

/**
 * Get the tier limits configuration (for frontend display).
 */
export function getTierLimits(): Record<string, TierLimits> {
  return { ...TIER_LIMITS };
}
