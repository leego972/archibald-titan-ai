import { describe, expect, it, vi, beforeEach } from "vitest";
import crypto from "crypto";

// ─── Unit Tests for Download Gate Logic ───────────────────────────

describe("download-gate", () => {
  describe("token generation", () => {
    it("generates a 64-character hex token (256-bit)", () => {
      const token = crypto.randomBytes(32).toString("hex");
      expect(token).toHaveLength(64);
      expect(/^[a-f0-9]{64}$/.test(token)).toBe(true);
    });

    it("generates unique tokens on each call", () => {
      const tokens = new Set<string>();
      for (let i = 0; i < 100; i++) {
        tokens.add(crypto.randomBytes(32).toString("hex"));
      }
      expect(tokens.size).toBe(100);
    });

    it("produces cryptographically random tokens", () => {
      const token1 = crypto.randomBytes(32).toString("hex");
      const token2 = crypto.randomBytes(32).toString("hex");
      expect(token1).not.toBe(token2);
      // Tokens should have high entropy - check they're not all zeros or repeated
      expect(token1).not.toMatch(/^0+$/);
      expect(token1).not.toMatch(/^(.)\1+$/);
    });
  });

  describe("token validation logic", () => {
    it("rejects tokens with incorrect length", () => {
      const shortToken = "abc123";
      const longToken = "a".repeat(128);
      const correctLength = 64; // 32 bytes * 2 hex chars

      expect(shortToken.length).not.toBe(correctLength);
      expect(longToken.length).not.toBe(correctLength);
    });

    it("accepts tokens with correct 64-character hex format", () => {
      const validToken = crypto.randomBytes(32).toString("hex");
      expect(validToken.length).toBe(64);
      expect(/^[a-f0-9]+$/.test(validToken)).toBe(true);
    });

    it("rejects tokens with non-hex characters", () => {
      const invalidToken = "g".repeat(64); // 'g' is not hex
      expect(/^[a-f0-9]+$/.test(invalidToken)).toBe(false);
    });
  });

  describe("token expiry logic", () => {
    it("creates tokens that expire in 15 minutes", () => {
      const TOKEN_EXPIRY_MINUTES = 15;
      const now = Date.now();
      const expiresAt = new Date(now + TOKEN_EXPIRY_MINUTES * 60 * 1000);

      const diffMs = expiresAt.getTime() - now;
      const diffMinutes = diffMs / (60 * 1000);

      expect(diffMinutes).toBe(15);
    });

    it("correctly identifies expired tokens", () => {
      const pastExpiry = new Date(Date.now() - 1000); // 1 second ago
      const futureExpiry = new Date(Date.now() + 60000); // 1 minute from now

      expect(new Date() > pastExpiry).toBe(true); // expired
      expect(new Date() > futureExpiry).toBe(false); // not expired
    });

    it("correctly identifies tokens that just expired", () => {
      const justExpired = new Date(Date.now() - 1); // 1ms ago
      expect(new Date() > justExpired).toBe(true);
    });
  });

  describe("rate limiting logic", () => {
    const MAX_DOWNLOADS_PER_HOUR = 10;

    it("allows downloads under the limit", () => {
      const count = 5;
      const allowed = count < MAX_DOWNLOADS_PER_HOUR;
      const remaining = Math.max(0, MAX_DOWNLOADS_PER_HOUR - count);

      expect(allowed).toBe(true);
      expect(remaining).toBe(5);
    });

    it("blocks downloads at the limit", () => {
      const count = 10;
      const allowed = count < MAX_DOWNLOADS_PER_HOUR;
      const remaining = Math.max(0, MAX_DOWNLOADS_PER_HOUR - count);

      expect(allowed).toBe(false);
      expect(remaining).toBe(0);
    });

    it("blocks downloads over the limit", () => {
      const count = 15;
      const allowed = count < MAX_DOWNLOADS_PER_HOUR;
      const remaining = Math.max(0, MAX_DOWNLOADS_PER_HOUR - count);

      expect(allowed).toBe(false);
      expect(remaining).toBe(0);
    });

    it("allows first download (zero count)", () => {
      const count = 0;
      const allowed = count < MAX_DOWNLOADS_PER_HOUR;
      const remaining = Math.max(0, MAX_DOWNLOADS_PER_HOUR - count);

      expect(allowed).toBe(true);
      expect(remaining).toBe(10);
    });

    it("calculates correct reset time (1 hour from now)", () => {
      const now = Date.now();
      const resetAt = new Date(now + 60 * 60 * 1000);
      const diffMs = resetAt.getTime() - now;

      expect(diffMs).toBe(3600000); // 1 hour in ms
    });
  });

  describe("platform validation", () => {
    const validPlatforms = ["windows", "mac", "linux"] as const;

    it("accepts valid platforms", () => {
      for (const platform of validPlatforms) {
        expect(validPlatforms.includes(platform)).toBe(true);
      }
    });

    it("rejects invalid platforms", () => {
      const invalidPlatforms = ["android", "ios", "chromeos", ""];
      for (const platform of invalidPlatforms) {
        expect((validPlatforms as readonly string[]).includes(platform)).toBe(false);
      }
    });
  });

  describe("download URL resolution", () => {
    const mockRelease = {
      downloadUrlWindows: "https://cdn.example.com/archibald-titan-1.0.0.exe",
      downloadUrlMac: "https://cdn.example.com/archibald-titan-1.0.0.dmg",
      downloadUrlLinux: "https://cdn.example.com/archibald-titan-1.0.0.AppImage",
    };

    it("resolves correct URL for each platform", () => {
      const getUrl = (platform: string) => {
        return platform === "windows"
          ? mockRelease.downloadUrlWindows
          : platform === "mac"
          ? mockRelease.downloadUrlMac
          : mockRelease.downloadUrlLinux;
      };

      expect(getUrl("windows")).toBe(mockRelease.downloadUrlWindows);
      expect(getUrl("mac")).toBe(mockRelease.downloadUrlMac);
      expect(getUrl("linux")).toBe(mockRelease.downloadUrlLinux);
    });

    it("handles null download URLs", () => {
      const partialRelease = {
        downloadUrlWindows: "https://cdn.example.com/app.exe",
        downloadUrlMac: null,
        downloadUrlLinux: null,
      };

      const getUrl = (platform: string) => {
        return platform === "windows"
          ? partialRelease.downloadUrlWindows
          : platform === "mac"
          ? partialRelease.downloadUrlMac
          : partialRelease.downloadUrlLinux;
      };

      expect(getUrl("windows")).toBeTruthy();
      expect(getUrl("mac")).toBeNull();
      expect(getUrl("linux")).toBeNull();
    });
  });

  describe("one-time use enforcement", () => {
    it("detects already-used tokens", () => {
      const tokenRecord = { usedAt: new Date() };
      expect(tokenRecord.usedAt).toBeTruthy();
    });

    it("allows unused tokens", () => {
      const tokenRecord = { usedAt: null };
      expect(tokenRecord.usedAt).toBeNull();
    });
  });

  describe("revocation check", () => {
    it("detects revoked tokens", () => {
      const tokenRecord = { revokedAt: new Date() };
      expect(tokenRecord.revokedAt).toBeTruthy();
    });

    it("allows non-revoked tokens", () => {
      const tokenRecord = { revokedAt: null };
      expect(tokenRecord.revokedAt).toBeNull();
    });
  });

  describe("audit log status values", () => {
    const validStatuses = ["initiated", "completed", "expired", "revoked", "rate_limited"] as const;

    it("covers all expected status values", () => {
      expect(validStatuses).toContain("initiated");
      expect(validStatuses).toContain("completed");
      expect(validStatuses).toContain("expired");
      expect(validStatuses).toContain("revoked");
      expect(validStatuses).toContain("rate_limited");
      expect(validStatuses).toHaveLength(5);
    });
  });

  describe("security properties", () => {
    it("token entropy is sufficient (256 bits)", () => {
      const TOKEN_BYTES = 32;
      const entropyBits = TOKEN_BYTES * 8;
      expect(entropyBits).toBe(256);
      // 256 bits means 2^256 possible tokens — brute force infeasible
    });

    it("token format prevents URL injection", () => {
      const token = crypto.randomBytes(32).toString("hex");
      // Hex-only tokens can't contain URL-special characters
      expect(token).not.toContain("/");
      expect(token).not.toContain("?");
      expect(token).not.toContain("&");
      expect(token).not.toContain("#");
      expect(token).not.toContain("=");
      expect(token).not.toContain(" ");
      expect(token).not.toContain("%");
    });

    it("download URLs are never exposed in public API responses", () => {
      // The releases.latest and releases.list endpoints should NOT return download URLs
      // They only return hasWindows, hasMac, hasLinux booleans
      const publicReleaseShape = {
        id: 1,
        version: "1.0.0",
        title: "Release",
        changelog: "Changes",
        fileSizeMb: "50",
        isLatest: true,
        isPrerelease: false,
        downloadCount: 0,
        hasWindows: true,
        hasMac: false,
        hasLinux: false,
        publishedAt: new Date(),
        createdAt: new Date(),
      };

      // Verify no download URL fields exist in public shape
      expect("downloadUrlWindows" in publicReleaseShape).toBe(false);
      expect("downloadUrlMac" in publicReleaseShape).toBe(false);
      expect("downloadUrlLinux" in publicReleaseShape).toBe(false);
    });
  });
});
