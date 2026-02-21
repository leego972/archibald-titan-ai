import { describe, it, expect } from "vitest";
import {
  getStrategyOverview,
  GROWTH_STRATEGIES,
} from "./advertising-orchestrator";

describe("Advertising Orchestrator", () => {
  describe("GROWTH_STRATEGIES", () => {
    it("should have at least 10 growth strategies", () => {
      expect(GROWTH_STRATEGIES.length).toBeGreaterThanOrEqual(10);
    });

    it("should have exactly 1 paid channel (Google Ads)", () => {
      const paid = GROWTH_STRATEGIES.filter((s) => s.costPerMonth > 0);
      expect(paid.length).toBe(1);
      expect(paid[0].channel).toBe("google_ads");
    });

    it("should have at least 9 free channels", () => {
      const free = GROWTH_STRATEGIES.filter((s) => s.costPerMonth === 0);
      expect(free.length).toBeGreaterThanOrEqual(9);
    });

    it("should allocate $500 AUD to Google Ads", () => {
      const googleAds = GROWTH_STRATEGIES.find((s) => s.channel === "google_ads");
      expect(googleAds).toBeDefined();
      expect(googleAds!.costPerMonth).toBe(500);
    });

    it("should have all required fields for each strategy", () => {
      for (const strategy of GROWTH_STRATEGIES) {
        expect(strategy.channel).toBeTruthy();
        expect(strategy.frequency).toBeTruthy();
        expect(strategy.description).toBeTruthy();
        expect(["high", "medium", "low"]).toContain(strategy.expectedImpact);
        expect(typeof strategy.costPerMonth).toBe("number");
        expect(typeof strategy.automatable).toBe("boolean");
      }
    });

    it("should have mostly automatable strategies", () => {
      const automatable = GROWTH_STRATEGIES.filter((s) => s.automatable);
      expect(automatable.length).toBeGreaterThanOrEqual(8);
    });

    it("should include key free channels", () => {
      const channels = GROWTH_STRATEGIES.map((s) => s.channel);
      expect(channels).toContain("seo_organic");
      expect(channels).toContain("blog_content");
      expect(channels).toContain("social_organic");
      expect(channels).toContain("community_engagement");
      expect(channels).toContain("affiliate_network");
      expect(channels).toContain("email_nurture");
      expect(channels).toContain("backlink_outreach");
    });

    it("should have high impact for SEO, blog, and Google Ads", () => {
      const highImpact = GROWTH_STRATEGIES.filter((s) => s.expectedImpact === "high");
      const highChannels = highImpact.map((s) => s.channel);
      expect(highChannels).toContain("seo_organic");
      expect(highChannels).toContain("blog_content");
      expect(highChannels).toContain("google_ads");
    });
  });

  describe("getStrategyOverview", () => {
    it("should return a valid strategy overview", () => {
      const overview = getStrategyOverview();

      expect(overview.monthlyBudget).toBe(500);
      expect(overview.currency).toBe("AUD");
      expect(overview.budgetAllocation.googleAds).toBe(500);
      expect(overview.budgetAllocation.freeChannels).toBe(0);
      expect(overview.freeChannelCount).toBeGreaterThanOrEqual(9);
      expect(overview.paidChannelCount).toBe(1);
    });

    it("should include content pillars", () => {
      const overview = getStrategyOverview();
      expect(overview.contentPillars.length).toBeGreaterThanOrEqual(5);

      for (const pillar of overview.contentPillars) {
        expect(pillar.name).toBeTruthy();
        expect(pillar.keywordCount).toBeGreaterThan(0);
        expect(pillar.blogTopicCount).toBeGreaterThan(0);
        expect(pillar.socialAngleCount).toBeGreaterThan(0);
      }
    });

    it("should include content pillar names covering key topics", () => {
      const overview = getStrategyOverview();
      const pillarNames = overview.contentPillars.map((p) => p.name);
      expect(pillarNames).toContain("API Key Security");
      expect(pillarNames).toContain("Cloud Security");
      expect(pillarNames).toContain("Developer Tools");
    });

    it("should include community targets", () => {
      const overview = getStrategyOverview();
      expect(overview.communityTargets.length).toBeGreaterThan(0);

      const platforms = overview.communityTargets.map((t) => t.platform);
      expect(platforms).toContain("reddit");
      expect(platforms).toContain("hackernews");
    });

    it("should include a schedule", () => {
      const overview = getStrategyOverview();
      expect(overview.schedule).toBeDefined();
      expect(overview.schedule.seoOptimization).toBe("Daily");
      expect(overview.schedule.blogPosts).toBe("Mon/Wed/Fri");
      expect(overview.schedule.socialMedia).toBe("Daily (2-3 posts)");
    });

    it("should have strategies array matching GROWTH_STRATEGIES", () => {
      const overview = getStrategyOverview();
      expect(overview.strategies.length).toBe(GROWTH_STRATEGIES.length);
    });
  });

  describe("Budget allocation", () => {
    it("total paid spend should not exceed $500 AUD/month", () => {
      const totalPaid = GROWTH_STRATEGIES.reduce((sum, s) => sum + s.costPerMonth, 0);
      expect(totalPaid).toBeLessThanOrEqual(500);
    });

    it("should have 80%+ free strategies by count", () => {
      const freeCount = GROWTH_STRATEGIES.filter((s) => s.costPerMonth === 0).length;
      const freePercent = (freeCount / GROWTH_STRATEGIES.length) * 100;
      expect(freePercent).toBeGreaterThanOrEqual(80);
    });
  });

  describe("Content pillars", () => {
    it("should have at least 5 content pillars", () => {
      const overview = getStrategyOverview();
      expect(overview.contentPillars.length).toBeGreaterThanOrEqual(5);
    });

    it("each pillar should have at least 3 keywords", () => {
      const overview = getStrategyOverview();
      for (const pillar of overview.contentPillars) {
        expect(pillar.keywordCount).toBeGreaterThanOrEqual(3);
      }
    });

    it("each pillar should have at least 3 blog topics", () => {
      const overview = getStrategyOverview();
      for (const pillar of overview.contentPillars) {
        expect(pillar.blogTopicCount).toBeGreaterThanOrEqual(3);
      }
    });
  });
});
