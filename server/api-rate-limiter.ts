/**
 * api-rate-limiter.ts
 *
 * In-memory sliding window rate limiter for API key requests.
 * Each API key has a configurable `rateLimit` (requests per minute).
 *
 * Algorithm: sliding window log — stores timestamps of recent requests
 * in a circular buffer per key. On each request, prune entries older
 * than 60 seconds, then check if the count exceeds the limit.
 *
 * Memory: O(rateLimit) per active key. Stale keys are evicted after
 * 5 minutes of inactivity to prevent unbounded growth.
 */

const WINDOW_MS = 60_000; // 1 minute sliding window
const EVICTION_TTL_MS = 5 * 60_000; // evict inactive keys after 5 minutes

interface RateLimitEntry {
  timestamps: number[]; // sorted ascending list of request timestamps
  lastAccess: number;   // for eviction
}

// Global in-process store — survives across requests in the same process
const store = new Map<string, RateLimitEntry>();

// Periodic eviction of stale entries (runs every 5 minutes)
let evictionTimer: ReturnType<typeof setInterval> | null = null;

function startEviction() {
  if (evictionTimer) return;
  evictionTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store.entries()) {
      if (now - entry.lastAccess > EVICTION_TTL_MS) {
        store.delete(key);
      }
    }
  }, EVICTION_TTL_MS);
  // Don't block process exit
  if (evictionTimer.unref) evictionTimer.unref();
}

startEviction();

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number; // Unix ms timestamp when the oldest request in window expires
  retryAfterMs: number; // ms to wait before retrying (0 if allowed)
}

/**
 * Check and record a request for the given API key.
 *
 * @param keyId     Unique identifier for the API key (e.g. DB row id as string)
 * @param limitRpm  Max requests per minute for this key
 */
export function checkRateLimit(keyId: string, limitRpm: number): RateLimitResult {
  const now = Date.now();
  const windowStart = now - WINDOW_MS;

  let entry = store.get(keyId);
  if (!entry) {
    entry = { timestamps: [], lastAccess: now };
    store.set(keyId, entry);
  }

  // Prune timestamps outside the current window
  entry.timestamps = entry.timestamps.filter((t) => t > windowStart);
  entry.lastAccess = now;

  const count = entry.timestamps.length;
  const remaining = Math.max(0, limitRpm - count);

  if (count >= limitRpm) {
    // Rate limit exceeded — calculate when the oldest request will expire
    const oldest = entry.timestamps[0] ?? now;
    const resetAt = oldest + WINDOW_MS;
    return {
      allowed: false,
      limit: limitRpm,
      remaining: 0,
      resetAt,
      retryAfterMs: Math.max(0, resetAt - now),
    };
  }

  // Record this request
  entry.timestamps.push(now);

  return {
    allowed: true,
    limit: limitRpm,
    remaining: remaining - 1,
    resetAt: (entry.timestamps[0] ?? now) + WINDOW_MS,
    retryAfterMs: 0,
  };
}

/**
 * Express middleware factory — enforces rate limiting for a given API key.
 * Attaches rate limit headers to every response.
 */
export function createRateLimitMiddleware(keyId: string, limitRpm: number) {
  return function rateLimitMiddleware(
    req: import("express").Request,
    res: import("express").Response,
    next: import("express").NextFunction
  ) {
    const result = checkRateLimit(keyId, limitRpm);

    // Standard rate limit headers (RFC 6585 / IETF draft)
    res.setHeader("X-RateLimit-Limit", result.limit);
    res.setHeader("X-RateLimit-Remaining", result.remaining);
    res.setHeader("X-RateLimit-Reset", Math.ceil(result.resetAt / 1000)); // Unix seconds

    if (!result.allowed) {
      res.setHeader("Retry-After", Math.ceil(result.retryAfterMs / 1000));
      return res.status(429).json({
        error: "Rate limit exceeded",
        message: `This API key allows ${limitRpm} requests per minute. Please retry after ${Math.ceil(result.retryAfterMs / 1000)} seconds.`,
        retryAfterSeconds: Math.ceil(result.retryAfterMs / 1000),
        resetAt: new Date(result.resetAt).toISOString(),
      });
    }

    next();
  };
}

/**
 * Get current rate limit stats for a key (for monitoring/admin).
 */
export function getRateLimitStats(keyId: string, limitRpm: number) {
  const now = Date.now();
  const windowStart = now - WINDOW_MS;
  const entry = store.get(keyId);
  if (!entry) return { requests: 0, limit: limitRpm, remaining: limitRpm };
  const recent = entry.timestamps.filter((t) => t > windowStart);
  return {
    requests: recent.length,
    limit: limitRpm,
    remaining: Math.max(0, limitRpm - recent.length),
  };
}
