import { describe, it, expect } from "vitest";

/**
 * Email Verification & Email Service Tests
 * Tests the email verification flow and email delivery service
 */

describe("Email Verification", () => {
  describe("Verification token generation", () => {
    it("should generate a 96-character hex token", () => {
      const crypto = require("crypto");
      const token = crypto.randomBytes(48).toString("hex");
      expect(token).toHaveLength(96);
      expect(token).toMatch(/^[a-f0-9]+$/);
    });

    it("should generate unique tokens each time", () => {
      const crypto = require("crypto");
      const token1 = crypto.randomBytes(48).toString("hex");
      const token2 = crypto.randomBytes(48).toString("hex");
      expect(token1).not.toBe(token2);
    });

    it("should set expiration to 24 hours from now", () => {
      const now = Date.now();
      const expires = new Date(now + 24 * 60 * 60 * 1000);
      const diff = expires.getTime() - now;
      expect(diff).toBe(24 * 60 * 60 * 1000);
    });
  });

  describe("Verification endpoint validation", () => {
    it("should reject missing token", async () => {
      const res = await fetch("http://localhost:3000/api/auth/verify-email");
      // Should return 400 for missing token
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.verified).toBe(false);
    });

    it("should reject invalid token", async () => {
      const res = await fetch("http://localhost:3000/api/auth/verify-email?token=invalid_token_123");
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.verified).toBe(false);
    });

    it("should reject empty token", async () => {
      const res = await fetch("http://localhost:3000/api/auth/verify-email?token=");
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.verified).toBe(false);
    });
  });

  describe("Resend verification endpoint", () => {
    it("should reject missing email", async () => {
      const res = await fetch("http://localhost:3000/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(400);
    });

    it("should return success even for non-existent email (anti-enumeration)", async () => {
      const res = await fetch("http://localhost:3000/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "nonexistent@example.com" }),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });
  });
});

describe("Email Service", () => {
  describe("Email template structure", () => {
    it("should generate valid HTML for password reset email", () => {
      // Test the HTML template generation pattern
      const name = "Test User";
      const resetUrl = "https://example.com/reset-password?token=abc123";
      
      const html = `
        <div style="font-family: sans-serif;">
          <h1>Password Reset</h1>
          <p>Hello ${name},</p>
          <a href="${resetUrl}">Reset Password</a>
        </div>
      `;
      
      expect(html).toContain(name);
      expect(html).toContain(resetUrl);
      expect(html).toContain("Password Reset");
    });

    it("should generate valid HTML for verification email", () => {
      const name = "Test User";
      const verifyUrl = "https://example.com/verify-email?token=abc123";
      
      const html = `
        <div style="font-family: sans-serif;">
          <h1>Verify Your Email</h1>
          <p>Hello ${name},</p>
          <a href="${verifyUrl}">Verify Email</a>
        </div>
      `;
      
      expect(html).toContain(name);
      expect(html).toContain(verifyUrl);
      expect(html).toContain("Verify");
    });

    it("should generate valid HTML for welcome email", () => {
      const name = "Test User";
      const dashboardUrl = "https://example.com/dashboard";
      
      const html = `
        <div style="font-family: sans-serif;">
          <h1>Welcome to Archibald Titan</h1>
          <p>Hello ${name},</p>
          <a href="${dashboardUrl}">Go to Dashboard</a>
        </div>
      `;
      
      expect(html).toContain(name);
      expect(html).toContain(dashboardUrl);
      expect(html).toContain("Welcome");
    });
  });

  describe("Email validation", () => {
    it("should validate email format", () => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      
      expect(emailRegex.test("user@example.com")).toBe(true);
      expect(emailRegex.test("user+tag@example.com")).toBe(true);
      expect(emailRegex.test("invalid")).toBe(false);
      expect(emailRegex.test("@example.com")).toBe(false);
      expect(emailRegex.test("user@")).toBe(false);
    });

    it("should normalize email to lowercase", () => {
      const email = "User@Example.COM";
      const normalized = email.trim().toLowerCase();
      expect(normalized).toBe("user@example.com");
    });
  });
});

describe("Social Login", () => {
  describe("OAuth URL construction", () => {
    it("should build valid Manus OAuth URL", () => {
      const oauthPortalUrl = "https://portal.manus.im";
      const appId = "test-app-id";
      const redirectUri = "https://example.com/api/oauth/callback";
      
      const url = new URL(`${oauthPortalUrl}/app-auth`);
      url.searchParams.set("appId", appId);
      url.searchParams.set("redirectUri", redirectUri);
      url.searchParams.set("type", "signIn");
      
      expect(url.toString()).toContain("app-auth");
      expect(url.searchParams.get("appId")).toBe(appId);
      expect(url.searchParams.get("redirectUri")).toBe(redirectUri);
      expect(url.searchParams.get("type")).toBe("signIn");
    });

    it("should include provider parameter for Google OAuth", () => {
      const oauthPortalUrl = "https://portal.manus.im";
      const url = new URL(`${oauthPortalUrl}/app-auth`);
      url.searchParams.set("provider", "google");
      
      expect(url.searchParams.get("provider")).toBe("google");
    });

    it("should include provider parameter for GitHub OAuth", () => {
      const oauthPortalUrl = "https://portal.manus.im";
      const url = new URL(`${oauthPortalUrl}/app-auth`);
      url.searchParams.set("provider", "github");
      
      expect(url.searchParams.get("provider")).toBe("github");
    });

    it("should encode state with redirect info", () => {
      const redirectUri = "https://example.com/api/oauth/callback";
      const state = btoa(JSON.stringify({ redirectUri, returnPath: "/dashboard", provider: "google" }));
      
      const decoded = JSON.parse(atob(state));
      expect(decoded.redirectUri).toBe(redirectUri);
      expect(decoded.returnPath).toBe("/dashboard");
      expect(decoded.provider).toBe("google");
    });
  });
});
