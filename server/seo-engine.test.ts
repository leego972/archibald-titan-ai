import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the LLM module
vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn().mockResolvedValue({
    choices: [
      {
        message: {
          content: JSON.stringify({
            primaryKeywords: [
              { keyword: "AI agent", volume: "high", difficulty: "medium", opportunity: "high" },
            ],
            longTailKeywords: [
              { keyword: "best AI credential manager", intent: "transactional", suggestedPage: "/pricing" },
            ],
            contentGaps: ["Blog about security best practices"],
            competitorKeywords: ["1Password developer tools"],
          }),
        },
      },
    ],
  }),
}));

// Mock the notification module
vi.mock("./_core/notification", () => ({
  notifyOwner: vi.fn().mockResolvedValue(true),
}));

// Mock the db module
vi.mock("./db", () => ({
  getDb: vi.fn().mockReturnValue({
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockResolvedValue([]),
  }),
}));

import {
  generateSitemapXml,
  generateStructuredData,
  analyzeSeoHealth,
  analyzeKeywords,
  getOpenGraphTags,
  getPublicPages,
  triggerSeoKillSwitch,
  resetSeoKillSwitch,
  isSeoKilled,
} from "./seo-engine";

describe("SEO Engine", () => {
  beforeEach(() => {
    // Reset kill switch before each test
    resetSeoKillSwitch("SEO_KILL_9X4M");
  });

  describe("Sitemap Generation", () => {
    it("should generate valid XML sitemap", async () => {
      const sitemap = await generateSitemapXml();
      expect(sitemap).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(sitemap).toContain("<urlset");
      expect(sitemap).toContain("</urlset>");
    });

    it("should include all public pages in sitemap", async () => {
      const sitemap = await generateSitemapXml();
      const pages = getPublicPages();
      for (const page of pages) {
        expect(sitemap).toContain(`<loc>https://www.archibaldtitan.com${page.path}</loc>`);
      }
    });

    it("should include priority and changefreq for each URL", async () => {
      const sitemap = await generateSitemapXml();
      expect(sitemap).toContain("<priority>1.0</priority>"); // Homepage
      expect(sitemap).toContain("<changefreq>daily</changefreq>");
      expect(sitemap).toContain("<changefreq>weekly</changefreq>");
    });

    it("should include image sitemap for homepage", async () => {
      const sitemap = await generateSitemapXml();
      expect(sitemap).toContain("<image:image>");
      expect(sitemap).toContain("<image:title>Archibald Titan</image:title>");
    });

    it("should include lastmod date", async () => {
      const sitemap = await generateSitemapXml();
      const today = new Date().toISOString().split("T")[0];
      expect(sitemap).toContain(`<lastmod>${today}</lastmod>`);
    });
  });

  describe("Structured Data", () => {
    it("should generate multiple JSON-LD schemas", () => {
      const schemas = generateStructuredData();
      expect(schemas.length).toBeGreaterThanOrEqual(3);
    });

    it("should include Organization schema", () => {
      const schemas = generateStructuredData();
      const org = schemas.find((s) => s["@type"] === "Organization");
      expect(org).toBeDefined();
      expect(org!.name).toBe("Archibald Titan");
      expect(org!.url).toBe("https://www.archibaldtitan.com");
      expect(org!["@context"]).toBe("https://schema.org");
    });

    it("should include SoftwareApplication schema", () => {
      const schemas = generateStructuredData();
      const app = schemas.find((s) => s["@type"] === "SoftwareApplication");
      expect(app).toBeDefined();
      expect(app!.applicationCategory).toBe("DeveloperApplication");
      expect(app!.operatingSystem).toContain("Windows");
      expect(app!.offers).toHaveLength(3); // Free, Pro, Enterprise
    });

    it("should include WebSite schema with search action", () => {
      const schemas = generateStructuredData();
      const website = schemas.find((s) => s["@type"] === "WebSite");
      expect(website).toBeDefined();
      expect(website!.potentialAction).toBeDefined();
      expect(website!.potentialAction["@type"]).toBe("SearchAction");
    });

    it("should include FAQPage schema", () => {
      const schemas = generateStructuredData();
      const faq = schemas.find((s) => s["@type"] === "FAQPage");
      expect(faq).toBeDefined();
      expect(faq!.mainEntity.length).toBeGreaterThanOrEqual(3);
      for (const q of faq!.mainEntity) {
        expect(q["@type"]).toBe("Question");
        expect(q.acceptedAnswer["@type"]).toBe("Answer");
      }
    });

    it("should include pricing in offers", () => {
      const schemas = generateStructuredData();
      const app = schemas.find((s) => s["@type"] === "SoftwareApplication");
      const freeOffer = app!.offers.find((o: any) => o.name === "Free Plan");
      expect(freeOffer!.price).toBe("0");
      expect(freeOffer!.priceCurrency).toBe("USD");
    });
  });

  describe("SEO Health Analysis", () => {
    it("should return a score between 0 and 100", async () => {
      const score = await analyzeSeoHealth();
      expect(score.overall).toBeGreaterThanOrEqual(0);
      expect(score.overall).toBeLessThanOrEqual(100);
    });

    it("should include all score categories", async () => {
      const score = await analyzeSeoHealth();
      expect(score.titleScore).toBeDefined();
      expect(score.descriptionScore).toBeDefined();
      expect(score.keywordsScore).toBeDefined();
      expect(score.structuredDataScore).toBeDefined();
      expect(score.technicalScore).toBeDefined();
      expect(score.contentScore).toBeDefined();
    });

    it("should include issues array", async () => {
      const score = await analyzeSeoHealth();
      expect(Array.isArray(score.issues)).toBe(true);
      for (const issue of score.issues) {
        expect(["critical", "warning", "info"]).toContain(issue.severity);
        expect(issue.category).toBeDefined();
        expect(issue.message).toBeDefined();
      }
    });

    it("should include recommendations", async () => {
      const score = await analyzeSeoHealth();
      expect(Array.isArray(score.recommendations)).toBe(true);
      expect(score.recommendations.length).toBeGreaterThan(0);
    });

    it("should include lastAnalyzed timestamp", async () => {
      const score = await analyzeSeoHealth();
      expect(score.lastAnalyzed).toBeGreaterThan(0);
      expect(score.lastAnalyzed).toBeLessThanOrEqual(Date.now());
    });
  });

  describe("Keyword Analysis", () => {
    it("should return keyword analysis with primary keywords", async () => {
      const analysis = await analyzeKeywords();
      expect(analysis.primaryKeywords.length).toBeGreaterThan(0);
    });

    it("should return long-tail keywords", async () => {
      const analysis = await analyzeKeywords();
      expect(analysis.longTailKeywords.length).toBeGreaterThan(0);
    });

    it("should include generatedAt timestamp", async () => {
      const analysis = await analyzeKeywords();
      expect(analysis.generatedAt).toBeGreaterThan(0);
    });

    it("should return empty results when kill switch is active", async () => {
      triggerSeoKillSwitch("SEO_KILL_9X4M");
      const analysis = await analyzeKeywords();
      expect(analysis.primaryKeywords).toHaveLength(0);
      expect(analysis.longTailKeywords).toHaveLength(0);
    });
  });

  describe("Open Graph Tags", () => {
    it("should return OG tags for homepage", () => {
      const tags = getOpenGraphTags("/");
      expect(tags["og:title"]).toContain("Archibald Titan");
      expect(tags["og:type"]).toBe("website");
      expect(tags["og:url"]).toBe("https://www.archibaldtitan.com/");
      expect(tags["og:site_name"]).toBe("Archibald Titan");
    });

    it("should return Twitter card tags", () => {
      const tags = getOpenGraphTags("/");
      expect(tags["twitter:card"]).toBe("summary_large_image");
      expect(tags["twitter:title"]).toBeDefined();
      expect(tags["twitter:description"]).toBeDefined();
    });

    it("should return OG tags for pricing page", () => {
      const tags = getOpenGraphTags("/pricing");
      expect(tags["og:title"]).toContain("Pricing");
      expect(tags["og:url"]).toBe("https://www.archibaldtitan.com/pricing");
    });

    it("should fall back to homepage for unknown paths", () => {
      const tags = getOpenGraphTags("/nonexistent");
      expect(tags["og:title"]).toContain("Archibald Titan");
    });
  });

  describe("Public Pages Configuration", () => {
    it("should return all public pages", () => {
      const pages = getPublicPages();
      expect(pages.length).toBeGreaterThanOrEqual(5);
    });

    it("should have homepage with highest priority", () => {
      const pages = getPublicPages();
      const home = pages.find((p) => p.path === "/");
      expect(home).toBeDefined();
      expect(home!.priority).toBe(1.0);
    });

    it("should have valid changefreq values", () => {
      const validFreqs = ["always", "hourly", "daily", "weekly", "monthly", "yearly", "never"];
      const pages = getPublicPages();
      for (const page of pages) {
        expect(validFreqs).toContain(page.changefreq);
      }
    });

    it("should have keywords for each page", () => {
      const pages = getPublicPages();
      for (const page of pages) {
        expect(page.keywords.length).toBeGreaterThan(0);
      }
    });
  });

  describe("Kill Switch", () => {
    it("should activate with correct code", () => {
      const result = triggerSeoKillSwitch("SEO_KILL_9X4M");
      expect(result).toBe(true);
      expect(isSeoKilled()).toBe(true);
    });

    it("should not activate with wrong code", () => {
      const result = triggerSeoKillSwitch("WRONG_CODE");
      expect(result).toBe(false);
      expect(isSeoKilled()).toBe(false);
    });

    it("should deactivate with correct code", () => {
      triggerSeoKillSwitch("SEO_KILL_9X4M");
      expect(isSeoKilled()).toBe(true);
      const result = resetSeoKillSwitch("SEO_KILL_9X4M");
      expect(result).toBe(true);
      expect(isSeoKilled()).toBe(false);
    });

    it("should not deactivate with wrong code", () => {
      triggerSeoKillSwitch("SEO_KILL_9X4M");
      const result = resetSeoKillSwitch("WRONG_CODE");
      expect(result).toBe(false);
      expect(isSeoKilled()).toBe(true);
    });
  });
});
