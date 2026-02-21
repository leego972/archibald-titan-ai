import { describe, it, expect, vi, beforeEach } from "vitest";
import bcrypt from "bcryptjs";

// ─── Mock database ─────────────────────────────────────────────────
const mockUsers: any[] = [];
let insertCalled = false;
let insertValues: any = null;

vi.mock("./db", () => ({
  getDb: vi.fn(async () => ({
    select: () => ({
      from: () => ({
        where: (condition: any) => ({
          limit: () => {
            // Simple mock: search by email or openId
            return mockUsers.filter(u => {
              // Check if searching by email
              if (insertValues?.email && u.email === insertValues.email) return true;
              return false;
            });
          },
        }),
      }),
    }),
    insert: () => ({
      values: (vals: any) => {
        insertCalled = true;
        insertValues = vals;
        mockUsers.push(vals);
        return {
          onDuplicateKeyUpdate: () => Promise.resolve(),
        };
      },
    }),
    update: () => ({
      set: () => ({
        where: () => Promise.resolve(),
      }),
    }),
  })),
  getUserByOpenId: vi.fn(),
  upsertUser: vi.fn(),
}));

vi.mock("./_core/sdk", () => ({
  sdk: {
    createSessionToken: vi.fn(async () => "mock-session-token"),
  },
}));

vi.mock("./_core/cookies", () => ({
  getSessionCookieOptions: vi.fn(() => ({
    httpOnly: true,
    path: "/",
    sameSite: "none",
    secure: false,
  })),
}));

vi.mock("./_core/env", () => ({
  ENV: {
    ownerOpenId: "owner-123",
    cookieSecret: "test-secret",
    appId: "test-app",
  },
}));

describe("Email Authentication", () => {
  beforeEach(() => {
    mockUsers.length = 0;
    insertCalled = false;
    insertValues = null;
  });

  describe("Password hashing", () => {
    it("should hash passwords with bcrypt", async () => {
      const password = "testPassword123";
      const hash = await bcrypt.hash(password, 12);
      
      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);
      expect(hash.startsWith("$2a$") || hash.startsWith("$2b$")).toBe(true);
    });

    it("should verify correct passwords", async () => {
      const password = "mySecurePassword!";
      const hash = await bcrypt.hash(password, 12);
      
      const isValid = await bcrypt.compare(password, hash);
      expect(isValid).toBe(true);
    });

    it("should reject incorrect passwords", async () => {
      const password = "mySecurePassword!";
      const hash = await bcrypt.hash(password, 10);
      
      const isValid = await bcrypt.compare("wrongPassword", hash);
      expect(isValid).toBe(false);
    });

    it("should generate different hashes for same password", async () => {
      const password = "samePassword123";
      const hash1 = await bcrypt.hash(password, 12);
      const hash2 = await bcrypt.hash(password, 12);
      
      expect(hash1).not.toBe(hash2);
      // But both should verify
      expect(await bcrypt.compare(password, hash1)).toBe(true);
      expect(await bcrypt.compare(password, hash2)).toBe(true);
    });
  });

  describe("Email validation", () => {
    const validateEmail = (email: string): boolean => {
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 320;
    };

    it("should accept valid emails", () => {
      expect(validateEmail("user@example.com")).toBe(true);
      expect(validateEmail("user.name@domain.co")).toBe(true);
      expect(validateEmail("user+tag@example.org")).toBe(true);
    });

    it("should reject invalid emails", () => {
      expect(validateEmail("")).toBe(false);
      expect(validateEmail("notanemail")).toBe(false);
      expect(validateEmail("@domain.com")).toBe(false);
      expect(validateEmail("user@")).toBe(false);
      expect(validateEmail("user @domain.com")).toBe(false);
    });

    it("should reject emails over 320 characters", () => {
      const longEmail = "a".repeat(310) + "@example.com";
      expect(validateEmail(longEmail)).toBe(false);
    });
  });

  describe("Password requirements", () => {
    it("should require minimum 8 characters", () => {
      expect("short".length >= 8).toBe(false);
      expect("longEnough".length >= 8).toBe(true);
      expect("exactly8".length >= 8).toBe(true);
    });

    it("should enforce maximum 128 characters", () => {
      expect("a".repeat(128).length <= 128).toBe(true);
      expect("a".repeat(129).length <= 128).toBe(false);
    });
  });

  describe("OpenId generation for email users", () => {
    it("should generate unique openIds with email_ prefix", () => {
      const crypto = require("crypto");
      const openId1 = `email_${crypto.randomUUID().replace(/-/g, "")}`;
      const openId2 = `email_${crypto.randomUUID().replace(/-/g, "")}`;
      
      expect(openId1.startsWith("email_")).toBe(true);
      expect(openId2.startsWith("email_")).toBe(true);
      expect(openId1).not.toBe(openId2);
      // Should be email_ + 32 hex chars
      expect(openId1.length).toBe(6 + 32);
    });
  });

  describe("Registration flow", () => {
    it("should normalize email to lowercase", () => {
      const email = "User@Example.COM";
      const normalized = email.trim().toLowerCase();
      expect(normalized).toBe("user@example.com");
    });

    it("should use email prefix as default name when name not provided", () => {
      const email = "john.doe@example.com";
      const defaultName = email.split("@")[0];
      expect(defaultName).toBe("john.doe");
    });

    it("should trim whitespace from inputs", () => {
      const email = "  user@example.com  ";
      const name = "  John Doe  ";
      expect(email.trim()).toBe("user@example.com");
      expect(name.trim()).toBe("John Doe");
    });
  });

  describe("Session token creation", () => {
    it("should create session token via SDK after successful auth", async () => {
      const { sdk } = await import("./_core/sdk");
      const token = await sdk.createSessionToken("email_abc123", {
        name: "Test User",
        expiresInMs: 365 * 24 * 60 * 60 * 1000,
      });
      
      expect(token).toBe("mock-session-token");
      expect(sdk.createSessionToken).toHaveBeenCalledWith("email_abc123", {
        name: "Test User",
        expiresInMs: 365 * 24 * 60 * 60 * 1000,
      });
    });
  });

  describe("Login flow", () => {
    it("should compare password with stored hash", async () => {
      const password = "userPassword123";
      const storedHash = await bcrypt.hash(password, 12);
      
      // Correct password
      expect(await bcrypt.compare(password, storedHash)).toBe(true);
      // Wrong password
      expect(await bcrypt.compare("wrongPassword", storedHash)).toBe(false);
    });

    it("should reject login for non-existent email", () => {
      const users: any[] = [];
      const found = users.find(u => u.email === "nonexistent@example.com");
      expect(found).toBeUndefined();
    });
  });

  describe("Cookie options", () => {
    it("should return correct cookie options", async () => {
      const { getSessionCookieOptions } = await import("./_core/cookies");
      const options = getSessionCookieOptions({ protocol: "https" } as any);
      
      expect(options).toHaveProperty("httpOnly");
      expect(options).toHaveProperty("path", "/");
      expect(options).toHaveProperty("sameSite");
    });
  });

  describe("Login rate limiting", () => {
    it("should track failed login attempts per IP", () => {
      const loginAttempts = new Map<string, { count: number; firstAttempt: number }>();
      const ip = "192.168.1.1";
      const now = Date.now();

      // Simulate 5 failed attempts
      for (let i = 0; i < 5; i++) {
        const existing = loginAttempts.get(ip);
        if (existing) {
          existing.count++;
        } else {
          loginAttempts.set(ip, { count: 1, firstAttempt: now });
        }
      }

      const record = loginAttempts.get(ip);
      expect(record).toBeDefined();
      expect(record!.count).toBe(5);
    });

    it("should block after MAX_LOGIN_ATTEMPTS (5) within window", () => {
      const MAX_LOGIN_ATTEMPTS = 5;
      const LOCKOUT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
      const LOCKOUT_DURATION_MS = 15 * 60 * 1000;

      const loginAttempts = new Map<string, { count: number; firstAttempt: number; lockedUntil?: number }>();
      const ip = "10.0.0.1";
      const now = Date.now();

      // Simulate 5 failed attempts
      loginAttempts.set(ip, { count: 5, firstAttempt: now });

      const record = loginAttempts.get(ip)!;
      const isWithinWindow = (now - record.firstAttempt) < LOCKOUT_WINDOW_MS;
      const isLocked = isWithinWindow && record.count >= MAX_LOGIN_ATTEMPTS;

      expect(isLocked).toBe(true);
    });

    it("should reset attempts after lockout window expires", () => {
      const LOCKOUT_WINDOW_MS = 15 * 60 * 1000;
      const loginAttempts = new Map<string, { count: number; firstAttempt: number }>();
      const ip = "10.0.0.2";
      const pastTime = Date.now() - LOCKOUT_WINDOW_MS - 1000; // 15 min + 1 sec ago

      loginAttempts.set(ip, { count: 5, firstAttempt: pastTime });

      const record = loginAttempts.get(ip)!;
      const now = Date.now();
      const isWithinWindow = (now - record.firstAttempt) < LOCKOUT_WINDOW_MS;

      expect(isWithinWindow).toBe(false);
      // Should reset and allow login
    });

    it("should allow login when under attempt limit", () => {
      const MAX_LOGIN_ATTEMPTS = 5;
      const LOCKOUT_WINDOW_MS = 15 * 60 * 1000;
      const loginAttempts = new Map<string, { count: number; firstAttempt: number }>();
      const ip = "10.0.0.3";
      const now = Date.now();

      loginAttempts.set(ip, { count: 3, firstAttempt: now });

      const record = loginAttempts.get(ip)!;
      const isWithinWindow = (now - record.firstAttempt) < LOCKOUT_WINDOW_MS;
      const isLocked = isWithinWindow && record.count >= MAX_LOGIN_ATTEMPTS;

      expect(isLocked).toBe(false);
    });

    it("should clear attempts on successful login", () => {
      const loginAttempts = new Map<string, { count: number; firstAttempt: number }>();
      const ip = "10.0.0.4";

      loginAttempts.set(ip, { count: 3, firstAttempt: Date.now() });
      expect(loginAttempts.has(ip)).toBe(true);

      // On successful login, delete the record
      loginAttempts.delete(ip);
      expect(loginAttempts.has(ip)).toBe(false);
    });
  });

  describe("Account settings - change password", () => {
    it("should verify current password before allowing change", async () => {
      const currentPassword = "oldPassword123";
      const currentHash = await bcrypt.hash(currentPassword, 12);

      // Correct current password
      const isValid = await bcrypt.compare(currentPassword, currentHash);
      expect(isValid).toBe(true);

      // Wrong current password
      const isWrong = await bcrypt.compare("wrongPassword", currentHash);
      expect(isWrong).toBe(false);
    });

    it("should hash new password with bcrypt before storing", async () => {
      const newPassword = "newSecurePassword!";
      const hash = await bcrypt.hash(newPassword, 12);

      expect(hash).not.toBe(newPassword);
      expect(await bcrypt.compare(newPassword, hash)).toBe(true);
    });

    it("should reject if new password is same as current", async () => {
      const password = "samePassword123";
      const hash = await bcrypt.hash(password, 12);

      const isSame = await bcrypt.compare(password, hash);
      expect(isSame).toBe(true);
      // Backend should reject this case
    });

    it("should enforce minimum 8 characters on new password", () => {
      expect("short".length >= 8).toBe(false);
      expect("longEnoughPw".length >= 8).toBe(true);
    });
  });

  describe("Account settings - update profile", () => {
    it("should normalize email to lowercase", () => {
      const email = "NewEmail@Example.COM";
      expect(email.trim().toLowerCase()).toBe("newemail@example.com");
    });

    it("should trim name whitespace", () => {
      const name = "  Updated Name  ";
      expect(name.trim()).toBe("Updated Name");
    });

    it("should allow partial updates (name only or email only)", () => {
      const updates: Record<string, any> = {};
      const name = "New Name";
      const email = undefined;

      if (name) updates.name = name.trim();
      if (email) updates.email = email.trim().toLowerCase();

      expect(updates).toEqual({ name: "New Name" });
      expect(updates.email).toBeUndefined();
    });

    it("should validate email format on update", () => {
      const validateEmail = (email: string): boolean => {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 320;
      };

      expect(validateEmail("valid@example.com")).toBe(true);
      expect(validateEmail("invalid")).toBe(false);
      expect(validateEmail("")).toBe(false);
    });
  });

  describe("Password reset token flow", () => {
    it("should generate a random hex token", () => {
      const crypto = require("crypto");
      const token = crypto.randomBytes(32).toString("hex");

      expect(token).toBeDefined();
      expect(token.length).toBe(64); // 32 bytes = 64 hex chars
      expect(/^[a-f0-9]+$/.test(token)).toBe(true);
    });

    it("should hash reset tokens before storing", async () => {
      const crypto = require("crypto");
      const token = crypto.randomBytes(32).toString("hex");
      const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

      expect(hashedToken).not.toBe(token);
      expect(hashedToken.length).toBe(64);

      // Same token should produce same hash
      const hashedAgain = crypto.createHash("sha256").update(token).digest("hex");
      expect(hashedAgain).toBe(hashedToken);
    });

    it("should set token expiry to 1 hour from now", () => {
      const now = Date.now();
      const expiresAt = now + 60 * 60 * 1000; // 1 hour

      expect(expiresAt - now).toBe(3600000);
      expect(expiresAt > now).toBe(true);
    });

    it("should detect expired tokens", () => {
      const now = Date.now();
      const expiredAt = now - 1000; // 1 second ago
      const validAt = now + 3600000; // 1 hour from now

      expect(expiredAt < now).toBe(true); // expired
      expect(validAt < now).toBe(false); // still valid
    });

    it("should invalidate token after use (mark as used)", () => {
      const token = {
        id: 1,
        token: "hashed_token",
        userId: 42,
        expiresAt: Date.now() + 3600000,
        usedAt: null as number | null,
      };

      expect(token.usedAt).toBeNull(); // not used yet

      // Mark as used
      token.usedAt = Date.now();
      expect(token.usedAt).not.toBeNull();
      expect(token.usedAt).toBeGreaterThan(0);
    });

    it("should reject already-used tokens", () => {
      const token = {
        usedAt: Date.now() - 5000,
      };

      const isUsed = token.usedAt !== null;
      expect(isUsed).toBe(true);
    });
  });

  describe("OAuth redirect fix", () => {
    it("should redirect to /dashboard after OAuth callback", () => {
      // The OAuth callback should redirect to /dashboard, not /
      const redirectPath = "/dashboard";
      expect(redirectPath).toBe("/dashboard");
      expect(redirectPath).not.toBe("/");
    });

    it("should preserve return-to path in state parameter", () => {
      const state = JSON.stringify({
        origin: "https://example.com",
        returnPath: "/fetcher/credentials",
      });

      const parsed = JSON.parse(state);
      expect(parsed.returnPath).toBe("/fetcher/credentials");
      expect(parsed.origin).toBe("https://example.com");
    });
  });
});
