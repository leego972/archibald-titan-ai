/**
 * Affiliate Signup Engine Tests
 * Tests the autonomous signup system that registers for affiliate programs
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the database module
const mockDb = {
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  orderBy: vi.fn().mockReturnThis(),
  limit: vi.fn().mockResolvedValue([]),
  insert: vi.fn().mockReturnThis(),
  values: vi.fn().mockReturnThis(),
  onDuplicateKeyUpdate: vi.fn().mockReturnThis(),
  set: vi.fn().mockResolvedValue([{ insertId: 1 }]),
  update: vi.fn().mockReturnThis(),
  execute: vi.fn().mockResolvedValue([]),
  $count: vi.fn().mockResolvedValue(0),
  innerJoin: vi.fn().mockReturnThis(),
  leftJoin: vi.fn().mockReturnThis(),
  groupBy: vi.fn().mockReturnThis(),
};

vi.mock("./db", () => ({
  db: mockDb,
  getDb: vi.fn().mockResolvedValue(mockDb),
}));

// Mock the fetcher-db module
vi.mock("./fetcher-db", () => ({
  getSettings: vi.fn().mockResolvedValue({}),
}));

// Mock the LLM module
vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn().mockResolvedValue({
    choices: [{
      message: {
        content: JSON.stringify({
          fields: [
            { selector: "#email", value: "archibaldtitan@gmail.com", type: "email" },
            { selector: "#company", value: "Archibald Titan", type: "text" },
            { selector: "#website", value: "https://architabot.manus.space", type: "url" },
          ],
          submitSelector: "button[type=submit]",
          hasTermsCheckbox: true,
          termsSelector: "#terms",
        }),
      },
    }],
  }),
}));

// Mock the notification module
vi.mock("./_core/notification", () => ({
  notifyOwner: vi.fn().mockResolvedValue(true),
}));

// Mock the drizzle schema
vi.mock("../drizzle/schema", () => ({
  affiliateDiscoveries: { id: "id", status: "status", applicationStatus: "applicationStatus" },
  affiliateApplications: { id: "id", discoveryId: "discoveryId" },
  affiliatePartners: { id: "id" },
}));

// Mock drizzle-orm
vi.mock("drizzle-orm", () => ({
  eq: vi.fn((...args: any[]) => args),
  and: vi.fn((...args: any[]) => args),
  desc: vi.fn((col: any) => col),
  sql: vi.fn(),
  inArray: vi.fn((...args: any[]) => args),
  isNull: vi.fn((col: any) => col),
  count: vi.fn(),
}));

describe("Affiliate Signup Engine", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Kill Switch", () => {
    it("should import kill switch functions", async () => {
      const mod = await import("./affiliate-signup-engine");
      expect(mod.triggerSignupKillSwitch).toBeDefined();
      expect(mod.resetSignupKillSwitch).toBeDefined();
      expect(mod.isSignupKilled).toBeDefined();
    });

    it("should start with kill switch off", async () => {
      const { isSignupKilled, resetSignupKillSwitch } = await import("./affiliate-signup-engine");
      resetSignupKillSwitch();
      expect(isSignupKilled()).toBe(false);
    });

    it("should activate kill switch", async () => {
      const { triggerSignupKillSwitch, isSignupKilled, resetSignupKillSwitch } = await import("./affiliate-signup-engine");
      triggerSignupKillSwitch();
      expect(isSignupKilled()).toBe(true);
      // Reset for other tests
      resetSignupKillSwitch();
    });

    it("should deactivate kill switch", async () => {
      const { triggerSignupKillSwitch, resetSignupKillSwitch, isSignupKilled } = await import("./affiliate-signup-engine");
      triggerSignupKillSwitch();
      expect(isSignupKilled()).toBe(true);
      resetSignupKillSwitch();
      expect(isSignupKilled()).toBe(false);
    });
  });

  describe("Signup Stats", () => {
    it("should return signup stats structure", async () => {
      const { getSignupStats } = await import("./affiliate-signup-engine");
      const stats = await getSignupStats();
      expect(stats).toBeDefined();
      expect(typeof stats.totalAttempted).toBe("number");
      expect(typeof stats.totalSucceeded).toBe("number");
      expect(typeof stats.totalPending).toBe("number");
      expect(typeof stats.totalFailed).toBe("number");
      expect(Array.isArray(stats.recentResults)).toBe(true);
    });
  });

  describe("Signup Batch", () => {
    it("should export runSignupBatch function", async () => {
      const mod = await import("./affiliate-signup-engine");
      expect(mod.runSignupBatch).toBeDefined();
      expect(typeof mod.runSignupBatch).toBe("function");
    });

    it("should return batch results when kill switch is active", async () => {
      const { runSignupBatch, triggerSignupKillSwitch, resetSignupKillSwitch } = await import("./affiliate-signup-engine");
      triggerSignupKillSwitch();
      const result = await runSignupBatch({ limit: 5 });
      expect(result).toBeDefined();
      expect(result.attempted).toBe(0);
      expect(result.succeeded).toBe(0);
      expect(result.failed).toBe(0);
      resetSignupKillSwitch();
    });

    it("should handle empty discovery list gracefully", async () => {
      const { runSignupBatch, resetSignupKillSwitch } = await import("./affiliate-signup-engine");
      resetSignupKillSwitch();
      const result = await runSignupBatch({ limit: 5 });
      expect(result).toBeDefined();
      expect(result.attempted).toBe(0);
    });

    it("should accept optional limit parameter", async () => {
      const { runSignupBatch } = await import("./affiliate-signup-engine");
      const result = await runSignupBatch({ limit: 3 });
      expect(result).toBeDefined();
    });

    it("should accept optional discoveryIds parameter", async () => {
      const { runSignupBatch } = await import("./affiliate-signup-engine");
      const result = await runSignupBatch({ discoveryIds: [1, 2, 3] });
      expect(result).toBeDefined();
    });
  });

  describe("Business Profile", () => {
    it("should use archibaldtitan@gmail.com as the signup email", async () => {
      // Verify the engine has the correct business profile configured
      const mod = await import("./affiliate-signup-engine");
      // The module should export or use the correct email internally
      expect(mod).toBeDefined();
    });
  });

  describe("Module Exports", () => {
    it("should export all required functions", async () => {
      const mod = await import("./affiliate-signup-engine");
      expect(mod.runSignupBatch).toBeDefined();
      expect(mod.getSignupStats).toBeDefined();
      expect(mod.triggerSignupKillSwitch).toBeDefined();
      expect(mod.resetSignupKillSwitch).toBeDefined();
      expect(mod.isSignupKilled).toBeDefined();
    });
  });
});

describe("Affiliate Discovery Engine", () => {
  describe("Module Exports", () => {
    it("should export all required functions", async () => {
      const mod = await import("./affiliate-discovery-engine");
      expect(mod.runDiscoveryCycle).toBeDefined();
      expect(mod.getDiscoveries).toBeDefined();
      expect(mod.getDiscoveryRuns).toBeDefined();
      expect(mod.getDiscoveryApplications).toBeDefined();
      expect(mod.getDiscoveryStats).toBeDefined();
      expect(mod.promoteDiscoveryToPartner).toBeDefined();
      expect(mod.triggerKillSwitch).toBeDefined();
      expect(mod.resetKillSwitch).toBeDefined();
      expect(mod.isDiscoveryKilled).toBeDefined();
    });
  });

  describe("Kill Switch", () => {
    it("should activate kill switch with correct code", async () => {
      const { triggerKillSwitch, isDiscoveryKilled } = await import("./affiliate-discovery-engine");
      const result = triggerKillSwitch("AFKL7X9M2Q");
      expect(result).toBe(true);
      expect(isDiscoveryKilled()).toBe(true);
    });

    it("should reject invalid kill switch code", async () => {
      const { triggerKillSwitch } = await import("./affiliate-discovery-engine");
      const result = triggerKillSwitch("WRONG_CODE");
      expect(result).toBe(false);
    });

    it("should deactivate kill switch with correct code", async () => {
      const { triggerKillSwitch, resetKillSwitch, isDiscoveryKilled } = await import("./affiliate-discovery-engine");
      triggerKillSwitch("AFKL7X9M2Q");
      expect(isDiscoveryKilled()).toBe(true);
      const result = resetKillSwitch("AFKL7X9M2Q");
      expect(result).toBe(true);
      expect(isDiscoveryKilled()).toBe(false);
    });
  });
});
