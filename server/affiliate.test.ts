import { describe, it, expect, vi, beforeEach } from "vitest";

// Mocks must be hoisted — no external variable references
vi.mock("./db", () => {
  const mockChain = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
    orderBy: vi.fn().mockResolvedValue([]),
    leftJoin: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockResolvedValue([{ insertId: 1 }]),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
  };
  // Make chainable methods return the chain
  mockChain.select.mockReturnValue(mockChain);
  mockChain.from.mockReturnValue(mockChain);
  mockChain.where.mockReturnValue(mockChain);
  mockChain.leftJoin.mockReturnValue(mockChain);
  mockChain.insert.mockReturnValue(mockChain);
  mockChain.update.mockReturnValue(mockChain);
  mockChain.set.mockReturnValue(mockChain);
  mockChain.orderBy.mockReturnValue(mockChain);

  return {
    getDb: vi.fn().mockResolvedValue(mockChain),
    __mockChain: mockChain,
  };
});

vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn().mockResolvedValue({
    choices: [{
      message: {
        content: JSON.stringify({
          subject: "Partnership Opportunity: Archibald Titan",
          body: "Dear Partner Team, we'd love to collaborate.",
        }),
      },
    }],
  }),
}));

import {
  KNOWN_AFFILIATE_PROGRAMS,
  REFERRAL_CONFIG,
  CONTEXTUAL_PLACEMENTS,
  calculatePerformanceScore,
} from "./affiliate-engine";

describe("Affiliate Engine - Static Configuration", () => {
  describe("KNOWN_AFFILIATE_PROGRAMS", () => {
    it("should have at least 25 programs", () => {
      expect(KNOWN_AFFILIATE_PROGRAMS.length).toBeGreaterThanOrEqual(25);
    });

    it("should cover all key verticals", () => {
      const verticals = new Set(KNOWN_AFFILIATE_PROGRAMS.map(p => p.vertical));
      expect(verticals.has("ai_tools")).toBe(true);
      expect(verticals.has("hosting")).toBe(true);
      expect(verticals.has("dev_tools")).toBe(true);
      expect(verticals.has("security")).toBe(true);
      expect(verticals.has("saas")).toBe(true);
    });

    it("should have valid commission types", () => {
      for (const p of KNOWN_AFFILIATE_PROGRAMS) {
        expect(["revshare", "cpa", "hybrid", "cpm", "cpc"]).toContain(p.commissionType);
      }
    });

    it("should have positive commission rates", () => {
      for (const p of KNOWN_AFFILIATE_PROGRAMS) {
        expect(p.commissionRate).toBeGreaterThan(0);
      }
    });

    it("should have unique domains", () => {
      const domains = KNOWN_AFFILIATE_PROGRAMS.map(p => p.domain);
      expect(new Set(domains).size).toBe(domains.length);
    });

    it("should have application URLs for all programs", () => {
      for (const p of KNOWN_AFFILIATE_PROGRAMS) {
        expect(p.applicationUrl).toBeTruthy();
      }
    });
  });

  describe("REFERRAL_CONFIG", () => {
    it("should require 3 referrals for a free month", () => {
      expect(REFERRAL_CONFIG.referralsForFreeMonth).toBe(3);
    });

    it("should have 4 tiers", () => {
      expect(REFERRAL_CONFIG.tiers).toHaveLength(4);
    });

    it("should have increasing commission multipliers", () => {
      for (let i = 1; i < REFERRAL_CONFIG.tiers.length; i++) {
        expect(REFERRAL_CONFIG.tiers[i].commissionMultiplier)
          .toBeGreaterThan(REFERRAL_CONFIG.tiers[i - 1].commissionMultiplier);
      }
    });

    it("should have increasing minReferrals", () => {
      for (let i = 1; i < REFERRAL_CONFIG.tiers.length; i++) {
        expect(REFERRAL_CONFIG.tiers[i].minReferrals)
          .toBeGreaterThan(REFERRAL_CONFIG.tiers[i - 1].minReferrals);
      }
    });

    it("should start with Starter tier at 0 referrals", () => {
      expect(REFERRAL_CONFIG.tiers[0].name).toBe("Starter");
      expect(REFERRAL_CONFIG.tiers[0].minReferrals).toBe(0);
    });

    it("should end with Ambassador tier at 2x multiplier", () => {
      const last = REFERRAL_CONFIG.tiers[REFERRAL_CONFIG.tiers.length - 1];
      expect(last.name).toBe("Ambassador");
      expect(last.commissionMultiplier).toBe(2.0);
    });

    it("should have a TITAN code prefix", () => {
      expect(REFERRAL_CONFIG.codePrefix).toBe("TITAN");
    });

    it("should limit rewards per month", () => {
      expect(REFERRAL_CONFIG.maxReferralRewardsPerMonth).toBeGreaterThan(0);
    });
  });

  describe("CONTEXTUAL_PLACEMENTS", () => {
    it("should have placements for key contexts", () => {
      expect(CONTEXTUAL_PLACEMENTS).toHaveProperty("ai_chat");
      expect(CONTEXTUAL_PLACEMENTS).toHaveProperty("app_builder");
      expect(CONTEXTUAL_PLACEMENTS).toHaveProperty("security");
      expect(CONTEXTUAL_PLACEMENTS).toHaveProperty("dashboard");
      expect(CONTEXTUAL_PLACEMENTS).toHaveProperty("database");
      expect(CONTEXTUAL_PLACEMENTS).toHaveProperty("api_integration");
      expect(CONTEXTUAL_PLACEMENTS).toHaveProperty("design");
      expect(CONTEXTUAL_PLACEMENTS).toHaveProperty("content_creation");
      expect(CONTEXTUAL_PLACEMENTS).toHaveProperty("automation");
    });

    it("should have at least 3 partners per context", () => {
      for (const [context, domains] of Object.entries(CONTEXTUAL_PLACEMENTS)) {
        expect(domains.length).toBeGreaterThanOrEqual(3);
      }
    });

    it("should have valid domain formats", () => {
      for (const domains of Object.values(CONTEXTUAL_PLACEMENTS)) {
        for (const domain of domains) {
          expect(domain).toMatch(/^[a-z0-9.-]+\.[a-z]{2,}$/);
        }
      }
    });

    it("should map AI chat context to AI tools", () => {
      const aiDomains = CONTEXTUAL_PLACEMENTS["ai_chat"];
      expect(aiDomains).toContain("openai.com");
      expect(aiDomains).toContain("anthropic.com");
    });

    it("should map app_builder context to hosting providers", () => {
      const hostingDomains = CONTEXTUAL_PLACEMENTS["app_builder"];
      expect(hostingDomains).toContain("vercel.com");
    });
  });
});

describe("Affiliate Engine - Performance Scoring", () => {
  describe("calculatePerformanceScore", () => {
    it("should return 0 for a partner with no activity", () => {
      expect(calculatePerformanceScore({
        totalClicks: 0, totalConversions: 0, totalEarnings: 0,
      })).toBe(0);
    });

    it("should return higher score for more conversions", () => {
      const low = calculatePerformanceScore({ totalClicks: 100, totalConversions: 1, totalEarnings: 1000 });
      const high = calculatePerformanceScore({ totalClicks: 100, totalConversions: 5, totalEarnings: 5000 });
      expect(high).toBeGreaterThan(low);
    });

    it("should cap at 100", () => {
      const score = calculatePerformanceScore({
        totalClicks: 10000, totalConversions: 1000, totalEarnings: 1000000,
      });
      expect(score).toBeLessThanOrEqual(100);
    });

    it("should weight conversions heavily", () => {
      const highClicks = calculatePerformanceScore({ totalClicks: 1000, totalConversions: 0, totalEarnings: 0 });
      const highConversions = calculatePerformanceScore({ totalClicks: 100, totalConversions: 10, totalEarnings: 10000 });
      expect(highConversions).toBeGreaterThan(highClicks);
    });

    it("should return integer score", () => {
      const score = calculatePerformanceScore({ totalClicks: 50, totalConversions: 3, totalEarnings: 5000 });
      expect(Number.isInteger(score)).toBe(true);
    });

    it("should handle very high numbers gracefully", () => {
      const score = calculatePerformanceScore({
        totalClicks: 999999, totalConversions: 999999, totalEarnings: 99999999,
      });
      expect(score).toBe(100);
    });
  });
});

describe("Zero Ad Spend Strategy Validation", () => {
  it("should have contextual placements for all major user activities", () => {
    const contexts = Object.keys(CONTEXTUAL_PLACEMENTS);
    expect(contexts.length).toBeGreaterThanOrEqual(8);
  });

  it("should have high-CPA programs for maximum revenue per conversion", () => {
    const highCPA = KNOWN_AFFILIATE_PROGRAMS.filter(
      p => p.commissionType === "cpa" && (p.commissionRate ?? 0) >= 5000
    );
    expect(highCPA.length).toBeGreaterThanOrEqual(5);
  });

  it("should have high-revshare programs for recurring revenue", () => {
    const highRevshare = KNOWN_AFFILIATE_PROGRAMS.filter(
      p => p.commissionType === "revshare" && (p.commissionRate ?? 0) >= 20
    );
    expect(highRevshare.length).toBeGreaterThanOrEqual(5);
  });

  it("should have viral referral program with escalating tiers", () => {
    expect(REFERRAL_CONFIG.tiers.length).toBeGreaterThanOrEqual(3);
    const lastTier = REFERRAL_CONFIG.tiers[REFERRAL_CONFIG.tiers.length - 1];
    expect(lastTier.commissionMultiplier).toBeGreaterThan(1);
  });

  it("should have AI tools as highest-relevance vertical", () => {
    const aiTools = KNOWN_AFFILIATE_PROGRAMS.filter(p => p.vertical === "ai_tools");
    expect(aiTools.length).toBeGreaterThanOrEqual(5);
  });

  it("should have hosting partners for app builders", () => {
    const hosting = KNOWN_AFFILIATE_PROGRAMS.filter(p => p.vertical === "hosting");
    expect(hosting.length).toBeGreaterThanOrEqual(4);
  });

  it("should have DigitalOcean with highest CPA ($200)", () => {
    const DO = KNOWN_AFFILIATE_PROGRAMS.find(p => p.domain === "digitalocean.com");
    expect(DO).toBeTruthy();
    expect(DO!.commissionRate).toBe(20000);
  });
});
