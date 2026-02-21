import { describe, expect, it, beforeEach } from "vitest";
import {
  classifyError,
  isRetryable,
  checkCircuit,
  recordCircuitSuccess,
  recordCircuitFailure,
  resetCircuitBreaker,
  getCircuitBreakerSummary,
  calculateRetryDelay,
  sanitizeEmail,
  validatePassword,
  getActiveJobCount,
  incrementActiveJobs,
  decrementActiveJobs,
} from "./fetcher-engine/safety-engine";

// ─── Error Classification ────────────────────────────────────────────

describe("classifyError", () => {
  it("classifies network errors as transient", () => {
    expect(classifyError("ECONNRESET")).toBe("transient");
    expect(classifyError("ECONNREFUSED")).toBe("transient");
    expect(classifyError("ETIMEDOUT")).toBe("transient");
    expect(classifyError("socket hang up")).toBe("transient");
    expect(classifyError(new Error("network error occurred"))).toBe("transient");
    expect(classifyError("503 Service Unavailable")).toBe("transient");
    expect(classifyError("502 Bad Gateway")).toBe("transient");
  });

  it("classifies rate limit errors correctly", () => {
    expect(classifyError("429 Too Many Requests")).toBe("rate_limit");
    expect(classifyError("rate limit exceeded")).toBe("rate_limit");
    expect(classifyError("Request throttled")).toBe("rate_limit");
  });

  it("classifies bot detection errors correctly", () => {
    expect(classifyError("Cloudflare challenge detected")).toBe("bot_detected");
    expect(classifyError("Bot protection triggered")).toBe("bot_detected");
    expect(classifyError("Access denied by Akamai")).toBe("bot_detected");
    expect(classifyError("CAPTCHA required")).toBe("bot_detected");
  });

  it("classifies auth failures correctly", () => {
    expect(classifyError("Invalid password")).toBe("auth_failure");
    expect(classifyError("Login failed")).toBe("auth_failure");
    expect(classifyError("Authentication failed")).toBe("auth_failure");
    expect(classifyError("Account locked")).toBe("auth_failure");
  });

  it("classifies permanent errors correctly", () => {
    expect(classifyError("Provider not found")).toBe("permanent");
    expect(classifyError("Feature deprecated")).toBe("permanent");
    expect(classifyError("404 Not Found")).toBe("permanent");
  });

  it("classifies resource errors correctly", () => {
    expect(classifyError("Out of memory")).toBe("resource");
    expect(classifyError("ENOMEM")).toBe("resource");
  });

  it("returns unknown for unrecognized errors", () => {
    expect(classifyError("something weird happened")).toBe("unknown");
    expect(classifyError(42)).toBe("unknown");
  });
});

describe("isRetryable", () => {
  it("returns true for retryable categories", () => {
    expect(isRetryable("transient")).toBe(true);
    expect(isRetryable("rate_limit")).toBe(true);
    expect(isRetryable("bot_detected")).toBe(true);
    expect(isRetryable("resource")).toBe(true);
    expect(isRetryable("unknown")).toBe(true);
  });

  it("returns false for non-retryable categories", () => {
    expect(isRetryable("permanent")).toBe(false);
    expect(isRetryable("auth_failure")).toBe(false);
  });
});

// ─── Circuit Breaker ─────────────────────────────────────────────────

describe("Circuit Breaker", () => {
  beforeEach(() => {
    resetCircuitBreaker("test-provider");
    resetCircuitBreaker("test-provider-2");
  });

  it("starts in closed state and allows requests", () => {
    const result = checkCircuit("test-provider");
    expect(result.allowed).toBe(true);
  });

  it("stays closed after fewer than 5 failures", () => {
    for (let i = 0; i < 4; i++) {
      recordCircuitFailure("test-provider", "transient");
    }
    const result = checkCircuit("test-provider");
    expect(result.allowed).toBe(true);
  });

  it("opens after 5 consecutive failures", () => {
    for (let i = 0; i < 5; i++) {
      recordCircuitFailure("test-provider", "transient");
    }
    const result = checkCircuit("test-provider");
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("Circuit open");
  });

  it("resets on success", () => {
    for (let i = 0; i < 4; i++) {
      recordCircuitFailure("test-provider", "transient");
    }
    recordCircuitSuccess("test-provider");
    // Should be back to 0 failures
    for (let i = 0; i < 4; i++) {
      recordCircuitFailure("test-provider", "transient");
    }
    const result = checkCircuit("test-provider");
    expect(result.allowed).toBe(true); // Still under threshold
  });

  it("does not trip for permanent or auth_failure errors", () => {
    for (let i = 0; i < 10; i++) {
      recordCircuitFailure("test-provider", "permanent");
    }
    const result = checkCircuit("test-provider");
    expect(result.allowed).toBe(true);

    for (let i = 0; i < 10; i++) {
      recordCircuitFailure("test-provider-2", "auth_failure");
    }
    const result2 = checkCircuit("test-provider-2");
    expect(result2.allowed).toBe(true);
  });

  it("provides a summary of all circuit states", () => {
    recordCircuitFailure("test-provider", "transient");
    const summary = getCircuitBreakerSummary();
    expect(summary["test-provider"]).toBeDefined();
    expect(summary["test-provider"].state).toBe("closed");
    expect(summary["test-provider"].failures).toBe(1);
  });

  it("can be manually reset", () => {
    for (let i = 0; i < 5; i++) {
      recordCircuitFailure("test-provider", "transient");
    }
    expect(checkCircuit("test-provider").allowed).toBe(false);

    resetCircuitBreaker("test-provider");
    expect(checkCircuit("test-provider").allowed).toBe(true);
  });
});

// ─── Retry Delay Calculation ─────────────────────────────────────────

describe("calculateRetryDelay", () => {
  it("increases delay exponentially", () => {
    const delay0 = calculateRetryDelay(0, "transient", {
      maxRetries: 3,
      baseDelayMs: 1000,
      maxDelayMs: 60000,
      jitterMs: 0,
    });
    const delay1 = calculateRetryDelay(1, "transient", {
      maxRetries: 3,
      baseDelayMs: 1000,
      maxDelayMs: 60000,
      jitterMs: 0,
    });
    const delay2 = calculateRetryDelay(2, "transient", {
      maxRetries: 3,
      baseDelayMs: 1000,
      maxDelayMs: 60000,
      jitterMs: 0,
    });

    expect(delay0).toBe(1000); // 1000 * 2^0
    expect(delay1).toBe(2000); // 1000 * 2^1
    expect(delay2).toBe(4000); // 1000 * 2^2
  });

  it("applies 3x multiplier for rate_limit errors", () => {
    const normalDelay = calculateRetryDelay(0, "transient", {
      maxRetries: 3,
      baseDelayMs: 1000,
      maxDelayMs: 60000,
      jitterMs: 0,
    });
    const rateLimitDelay = calculateRetryDelay(0, "rate_limit", {
      maxRetries: 3,
      baseDelayMs: 1000,
      maxDelayMs: 60000,
      jitterMs: 0,
    });

    expect(rateLimitDelay).toBe(normalDelay * 3);
  });

  it("caps at maxDelayMs", () => {
    const delay = calculateRetryDelay(10, "transient", {
      maxRetries: 15,
      baseDelayMs: 1000,
      maxDelayMs: 5000,
      jitterMs: 0,
    });
    expect(delay).toBe(5000);
  });
});

// ─── Input Sanitization ──────────────────────────────────────────────

describe("sanitizeEmail", () => {
  it("trims and lowercases email", () => {
    expect(sanitizeEmail("  User@Example.COM  ")).toBe("user@example.com");
  });

  it("removes invalid characters", () => {
    expect(sanitizeEmail("user<script>@test.com")).toBe("userscript@test.com");
  });

  it("preserves valid email characters", () => {
    expect(sanitizeEmail("user.name+tag@example.co")).toBe("user.name+tag@example.co");
  });
});

describe("validatePassword", () => {
  it("rejects empty passwords", () => {
    expect(validatePassword("").valid).toBe(false);
    expect(validatePassword("   ").valid).toBe(false);
  });

  it("rejects passwords over 512 characters", () => {
    const long = "a".repeat(513);
    expect(validatePassword(long).valid).toBe(false);
  });

  it("accepts valid passwords", () => {
    expect(validatePassword("mySecureP@ss123").valid).toBe(true);
    expect(validatePassword("a".repeat(512)).valid).toBe(true);
  });
});

// ─── Resource Guards ─────────────────────────────────────────────────

describe("Resource Guards", () => {
  it("tracks active job counts per user", () => {
    expect(getActiveJobCount(999)).toBe(0);
    incrementActiveJobs(999);
    expect(getActiveJobCount(999)).toBe(1);
    incrementActiveJobs(999);
    expect(getActiveJobCount(999)).toBe(2);
    decrementActiveJobs(999);
    expect(getActiveJobCount(999)).toBe(1);
    decrementActiveJobs(999);
    expect(getActiveJobCount(999)).toBe(0);
  });

  it("does not go below zero", () => {
    decrementActiveJobs(998);
    expect(getActiveJobCount(998)).toBe(0);
  });
});
