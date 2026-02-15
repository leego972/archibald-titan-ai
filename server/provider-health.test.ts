import { describe, it, expect, beforeEach } from "vitest";
import {
  classifyError,
  isRetryable,
  getCircuitState,
  checkCircuit,
  recordCircuitSuccess,
  recordCircuitFailure,
  getCircuitBreakerSummary,
  resetCircuitBreaker,
  calculateRetryDelay,
  sanitizeEmail,
  validatePassword,
  getActiveJobCount,
  incrementActiveJobs,
  decrementActiveJobs,
} from "./fetcher-engine/safety-engine";

describe("Provider Health & Safety Engine", () => {
  // ─── Error Classification ───────────────────────────────────────
  describe("classifyError", () => {
    it("classifies network errors as transient", () => {
      expect(classifyError("ECONNRESET")).toBe("transient");
      expect(classifyError("ETIMEDOUT")).toBe("transient");
      expect(classifyError("socket hang up")).toBe("transient");
      expect(classifyError(new Error("503 Service Unavailable"))).toBe("transient");
    });

    it("classifies rate limit errors", () => {
      expect(classifyError("429 Too Many Requests")).toBe("rate_limit");
      expect(classifyError("rate limit exceeded")).toBe("rate_limit");
      expect(classifyError("throttled")).toBe("rate_limit");
    });

    it("classifies bot detection errors", () => {
      expect(classifyError("bot protection triggered")).toBe("bot_detected");
      expect(classifyError("cloudflare challenge")).toBe("bot_detected");
      expect(classifyError("access denied")).toBe("bot_detected");
    });

    it("classifies auth failures", () => {
      expect(classifyError("invalid password")).toBe("auth_failure");
      expect(classifyError("login failed")).toBe("auth_failure");
      expect(classifyError("account locked")).toBe("auth_failure");
    });

    it("classifies permanent errors", () => {
      expect(classifyError("provider not found")).toBe("permanent");
      expect(classifyError("404 not found")).toBe("permanent");
      expect(classifyError("deprecated endpoint")).toBe("permanent");
    });

    it("classifies resource errors", () => {
      expect(classifyError("out of memory")).toBe("resource");
      expect(classifyError("ENOMEM")).toBe("resource");
    });

    it("returns unknown for unclassified errors", () => {
      expect(classifyError("something weird happened")).toBe("unknown");
    });
  });

  describe("isRetryable", () => {
    it("transient errors are retryable", () => {
      expect(isRetryable("transient")).toBe(true);
    });

    it("rate limit errors are retryable", () => {
      expect(isRetryable("rate_limit")).toBe(true);
    });

    it("bot detection errors are retryable", () => {
      expect(isRetryable("bot_detected")).toBe(true);
    });

    it("permanent errors are NOT retryable", () => {
      expect(isRetryable("permanent")).toBe(false);
    });

    it("auth failures are NOT retryable", () => {
      expect(isRetryable("auth_failure")).toBe(false);
    });

    it("unknown errors are retryable (conservative)", () => {
      expect(isRetryable("unknown")).toBe(true);
    });
  });

  // ─── Circuit Breaker ────────────────────────────────────────────
  describe("Circuit Breaker", () => {
    beforeEach(() => {
      resetCircuitBreaker("test-provider");
    });

    it("starts in closed state", () => {
      const state = getCircuitState("test-provider");
      expect(state.state).toBe("closed");
      expect(state.failures).toBe(0);
    });

    it("allows requests when closed", () => {
      const result = checkCircuit("test-provider");
      expect(result.allowed).toBe(true);
    });

    it("opens after threshold failures", () => {
      for (let i = 0; i < 5; i++) {
        recordCircuitFailure("test-provider", "transient");
      }
      const state = getCircuitState("test-provider");
      expect(state.state).toBe("open");
    });

    it("blocks requests when open", () => {
      for (let i = 0; i < 5; i++) {
        recordCircuitFailure("test-provider", "transient");
      }
      const result = checkCircuit("test-provider");
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("Circuit open");
    });

    it("resets on success", () => {
      recordCircuitFailure("test-provider", "transient");
      recordCircuitFailure("test-provider", "transient");
      recordCircuitSuccess("test-provider");
      const state = getCircuitState("test-provider");
      expect(state.state).toBe("closed");
      expect(state.failures).toBe(0);
    });

    it("does NOT trip for permanent errors", () => {
      for (let i = 0; i < 10; i++) {
        recordCircuitFailure("test-provider", "permanent");
      }
      const state = getCircuitState("test-provider");
      expect(state.state).toBe("closed");
    });

    it("does NOT trip for auth failures", () => {
      for (let i = 0; i < 10; i++) {
        recordCircuitFailure("test-provider", "auth_failure");
      }
      const state = getCircuitState("test-provider");
      expect(state.state).toBe("closed");
    });

    it("summary returns all circuit states", () => {
      recordCircuitFailure("provider-a", "transient");
      recordCircuitFailure("provider-b", "transient");
      const summary = getCircuitBreakerSummary();
      expect(summary["provider-a"]).toBeDefined();
      expect(summary["provider-b"]).toBeDefined();
      // Cleanup
      resetCircuitBreaker("provider-a");
      resetCircuitBreaker("provider-b");
    });

    it("manual reset clears the circuit", () => {
      for (let i = 0; i < 5; i++) {
        recordCircuitFailure("test-provider", "transient");
      }
      expect(getCircuitState("test-provider").state).toBe("open");
      resetCircuitBreaker("test-provider");
      const result = checkCircuit("test-provider");
      expect(result.allowed).toBe(true);
    });
  });

  // ─── Retry Delay Calculation ────────────────────────────────────
  describe("calculateRetryDelay", () => {
    it("increases delay with each attempt", () => {
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
      expect(delay1).toBeGreaterThan(delay0);
    });

    it("rate limit errors get longer backoff (3x multiplier)", () => {
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

    it("respects max delay cap", () => {
      const delay = calculateRetryDelay(10, "transient", {
        maxRetries: 15,
        baseDelayMs: 1000,
        maxDelayMs: 5000,
        jitterMs: 0,
      });
      expect(delay).toBeLessThanOrEqual(5000);
    });
  });

  // ─── Input Sanitization ─────────────────────────────────────────
  describe("Input Sanitization", () => {
    it("sanitizes email addresses", () => {
      expect(sanitizeEmail("  User@Example.COM  ")).toBe("user@example.com");
      expect(sanitizeEmail("test<script>@evil.com")).toBe("testscript@evil.com");
    });

    it("validates passwords", () => {
      expect(validatePassword("").valid).toBe(false);
      expect(validatePassword("  ").valid).toBe(false);
      expect(validatePassword("a".repeat(513)).valid).toBe(false);
      expect(validatePassword("validPassword123").valid).toBe(true);
    });
  });

  // ─── Resource Guards ────────────────────────────────────────────
  describe("Resource Guards", () => {
    it("tracks active job counts", () => {
      const userId = 99999;
      expect(getActiveJobCount(userId)).toBe(0);
      incrementActiveJobs(userId);
      expect(getActiveJobCount(userId)).toBe(1);
      incrementActiveJobs(userId);
      expect(getActiveJobCount(userId)).toBe(2);
      decrementActiveJobs(userId);
      expect(getActiveJobCount(userId)).toBe(1);
      decrementActiveJobs(userId);
      expect(getActiveJobCount(userId)).toBe(0);
    });

    it("does not go below zero", () => {
      const userId = 99998;
      decrementActiveJobs(userId);
      expect(getActiveJobCount(userId)).toBe(0);
    });
  });
});
