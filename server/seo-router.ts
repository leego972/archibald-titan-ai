/**
 * SEO Router v4 — tRPC endpoints for the autonomous SEO engine
 *
 * Upgrade: exposes ALL SEO Engine v4 features that were previously missing:
 *  - GEO / llms.txt / llms-full.txt generation
 *  - AI citation meta tags
 *  - Programmatic SEO pages (all 500+ pages)
 *  - Enhanced structured data (15 schema types)
 *  - Topic cluster mapping
 *  - E-E-A-T structured data
 *  - Featured snippet targets
 *  - Advanced robots.txt
 *  - Sitemap index + comparison/integrations/use-case sitemaps
 *  - Content freshness analysis
 *  - Search intent mappings
 *  - Content gap analysis
 *  - Semantic keyword clusters
 *  - GEO optimization run
 *  - Run GEO optimization
 */

import { z } from "zod";
import { adminProcedure } from "./_core/trpc";
import { router } from "./_core/trpc";
import {
  analyzeSeoHealth,
  analyzeKeywords,
  analyzeInternalLinks,
  optimizeMetaTags,
  generateSeoReport,
  generateStructuredData,
  getOpenGraphTags,
  getPublicPages,
  getCachedReport,
  getLastOptimizationRun,
  runScheduledSeoOptimization,
  triggerSeoKillSwitch,
  resetSeoKillSwitch,
  isSeoKilled,
  getWebVitalsSummary,
  getRedirects,
  submitToIndexNow,
  getSeoEventLog,
} from "./seo-engine";

import {
  generateLlmsTxt,
  generateLlmsFullTxt,
  generateAiCitationMeta,
  getAllProgrammaticPages,
  generateEnhancedStructuredData,
  getTopicClusters,
  generateEEATStructuredData,
  getFeaturedSnippetTargets,
  generateAdvancedRobotsTxt,
  generateSitemapIndex,
  generateComparisonSitemap,
  generateIntegrationsSitemap,
  generateUseCasesSitemap,
  analyzeContentFreshness,
  getSearchIntentMappings,
  analyzeContentGaps,
  getSemanticKeywordClusters,
  runGeoOptimization,
} from "./seo-engine-v4";

import {
  getRankings,
  getRisingKeywords,
  getFallingKeywords,
  getStrikingDistanceKeywords,
  updateRankPositions,
  analyzeContentDecay,
  getBacklinkGaps,
  getTopBacklinkOpportunities,
  validateAndGenerateSchema,
  auditAllPageSchemas,
  checkAiSearchPresence,
  getAiPresenceSummary,
  getAiPresenceLog,
  generateInternalLinkSuggestions,
  getOrphanPages,
  getCoreWebVitalsDiagnosis,
  analyzeSerpFeatures,
  detectKeywordCannibalization,
  generateSeoIntelligenceReport,
} from "./seo-intelligence";

import { consumeCredits, checkCredits } from "./credit-service";
import { createLogger } from "./_core/logger.js";
import { getErrorMessage } from "./_core/errors.js";
const log = createLogger("SeoRouter");

export const seoRouter = router({

  // ─── CORE (v3) ─────────────────────────────────────────────────────────────

  getHealthScore: adminProcedure.query(async () => {
    return analyzeSeoHealth();
  }),

  getKeywords: adminProcedure.query(async () => {
    return analyzeKeywords();
  }),

  getMetaOptimizations: adminProcedure.query(async () => {
    return optimizeMetaTags();
  }),

  getReport: adminProcedure.query(async () => {
    const cached = getCachedReport();
    if (cached && Date.now() - cached.generatedAt < 3600_000) return cached;
    return generateSeoReport();
  }),

  runOptimization: adminProcedure.mutation(async ({ ctx }) => {
    const creditCheck = await checkCredits(ctx.user.id, "seo_run");
    if (!creditCheck.allowed) {
      throw new Error(`Insufficient credits for SEO optimization. Need ${creditCheck.cost}, have ${creditCheck.currentBalance}.`);
    }
    const result = await runScheduledSeoOptimization();
    try {
      const _cr1 = await consumeCredits(ctx.user.id, "seo_run", "SEO optimization run");
      if (!_cr1.success) throw new TRPCError({ code: "FORBIDDEN", message: "Insufficient credits. Purchase more credits or upgrade your plan." });
    } catch (e) {
      log.warn("[SEO] Credit consumption failed (non-fatal):", { error: getErrorMessage(e) });
    }
    return result;
  }),

  getStructuredData: adminProcedure.query(async () => {
    return generateStructuredData();
  }),

  getOpenGraphTags: adminProcedure
    .input(z.object({ path: z.string() }))
    .query(async ({ input }) => {
      return getOpenGraphTags(input.path);
    }),

  getPublicPages: adminProcedure.query(async () => {
    return getPublicPages();
  }),

  getInternalLinks: adminProcedure.query(async () => {
    return analyzeInternalLinks();
  }),

  getWebVitals: adminProcedure.query(async () => {
    return getWebVitalsSummary();
  }),

  getRedirects: adminProcedure.query(async () => {
    return getRedirects();
  }),

  getEventLog: adminProcedure
    .input(z.object({ limit: z.number().min(1).max(500).default(50) }).optional())
    .query(async ({ input }) => {
      return getSeoEventLog(input?.limit || 50);
    }),

  submitIndexNow: adminProcedure
    .input(z.object({ urls: z.array(z.string()).min(1).max(100) }))
    .mutation(async ({ input }) => {
      return submitToIndexNow(input.urls);
    }),

  killSwitch: adminProcedure
    .input(z.object({ action: z.enum(["activate", "deactivate"]) }))
    .mutation(async ({ input }) => {
      if (input.action === "activate") {
        return { success: triggerSeoKillSwitch("SEO_KILL_9X4M"), killed: true };
      } else {
        return { success: resetSeoKillSwitch("SEO_KILL_9X4M"), killed: false };
      }
    }),

  // ─── GEO / AI SEARCH (v4) ──────────────────────────────────────────────────

  /** Generate llms.txt — the AI search standard for LLM discoverability */
  getLlmsTxt: adminProcedure.query(() => {
    return { content: generateLlmsTxt() };
  }),

  /** Generate llms-full.txt — complete site context for AI crawlers */
  getLlmsFullTxt: adminProcedure.query(() => {
    return { content: generateLlmsFullTxt() };
  }),

  /** Generate AI citation meta tags for a specific page */
  getAiCitationMeta: adminProcedure
    .input(z.object({
      title: z.string(),
      description: z.string(),
      path: z.string(),
    }))
    .query(({ input }) => {
      return { html: generateAiCitationMeta(input) };
    }),

  /** Run full GEO optimization cycle */
  runGeoOptimization: adminProcedure.mutation(async ({ ctx }) => {
    const creditCheck = await checkCredits(ctx.user.id, "seo_run");
    if (!creditCheck.allowed) {
      throw new Error(`Insufficient credits for GEO optimization. Need ${creditCheck.cost}, have ${creditCheck.currentBalance}.`);
    }
    await runGeoOptimization();
    try {
      const _cr2 = await consumeCredits(ctx.user.id, "seo_run", "GEO optimization run");
      if (!_cr2.success) throw new TRPCError({ code: "FORBIDDEN", message: "Insufficient credits. Purchase more credits or upgrade your plan." });
    } catch (e) {
      log.warn("[SEO] Credit consumption failed (non-fatal):", { error: getErrorMessage(e) });
    }
    return { success: true, message: "GEO optimization complete — llms.txt, AI meta tags, and structured data updated" };
  }),

  // ─── PROGRAMMATIC SEO (v4) ─────────────────────────────────────────────────

  /** Get all 500+ programmatic SEO pages */
  getProgrammaticPages: adminProcedure
    .input(z.object({
      category: z.enum(["comparison", "integration", "use-case", "location", "all"]).default("all"),
      limit: z.number().min(1).max(500).default(50),
      offset: z.number().min(0).default(0),
    }).optional())
    .query(({ input }) => {
      const all = getAllProgrammaticPages();
      const category = input?.category ?? "all";
      const limit = input?.limit ?? 50;
      const offset = input?.offset ?? 0;
      const filtered = category === "all" ? all : all.filter(p => p.type === category);
      return {
        total: filtered.length,
        items: filtered.slice(offset, offset + limit),
        categories: {
          comparison: all.filter(p => p.type === "comparison").length,
          integration: all.filter(p => p.type === "integration").length,
          "use-case": all.filter(p => p.type === "use-case").length,
          location: all.filter(p => (p.type as string) === "location").length,
        },
      };
    }),

  // ─── STRUCTURED DATA (v4) ──────────────────────────────────────────────────

  /** Get enhanced structured data (15 schema types) */
  getEnhancedStructuredData: adminProcedure.query(() => {
    return generateEnhancedStructuredData();
  }),

  /** Get E-E-A-T structured data */
  getEEATStructuredData: adminProcedure.query(() => {
    return generateEEATStructuredData();
  }),

  // ─── TOPIC CLUSTERS (v4) ───────────────────────────────────────────────────

  /** Get all topic clusters with pillar + cluster pages */
  getTopicClusters: adminProcedure.query(() => {
    return getTopicClusters();
  }),

  // ─── FEATURED SNIPPETS (v4) ────────────────────────────────────────────────

  /** Get featured snippet targets with optimized answer blocks */
  getFeaturedSnippetTargets: adminProcedure.query(() => {
    return getFeaturedSnippetTargets();
  }),

  // ─── SITEMAPS (v4) ─────────────────────────────────────────────────────────

  /** Get sitemap index XML */
  getSitemapIndex: adminProcedure.query(() => {
    return { xml: generateSitemapIndex() };
  }),

  /** Get comparison pages sitemap XML */
  getComparisonSitemap: adminProcedure.query(() => {
    return { xml: generateComparisonSitemap() };
  }),

  /** Get integrations sitemap XML */
  getIntegrationsSitemap: adminProcedure.query(() => {
    return { xml: generateIntegrationsSitemap() };
  }),

  /** Get use-case pages sitemap XML */
  getUseCasesSitemap: adminProcedure.query(() => {
    return { xml: generateUseCasesSitemap() };
  }),

  /** Get advanced robots.txt */
  getAdvancedRobotsTxt: adminProcedure.query(() => {
    return { content: generateAdvancedRobotsTxt() };
  }),

  // ─── CONTENT INTELLIGENCE (v4) ─────────────────────────────────────────────

  /** Analyze content freshness across all pages */
  analyzeContentFreshness: adminProcedure.mutation(async ({ ctx }) => {
    const creditCheck = await checkCredits(ctx.user.id, "seo_run");
    if (!creditCheck.allowed) {
      throw new Error(`Insufficient credits for content freshness analysis. Need ${creditCheck.cost}, have ${creditCheck.currentBalance}.`);
    }
    const result = await analyzeContentFreshness();
    try {
      const _cr3 = await consumeCredits(ctx.user.id, "seo_run", "Content freshness analysis");
      if (!_cr3.success) throw new TRPCError({ code: "FORBIDDEN", message: "Insufficient credits. Purchase more credits or upgrade your plan." });
    } catch (e) {
      log.warn("[SEO] Credit consumption failed (non-fatal):", { error: getErrorMessage(e) });
    }
    return result;
  }),

  /** Get search intent mappings (informational / transactional / navigational / commercial) */
  getSearchIntentMappings: adminProcedure.query(() => {
    return getSearchIntentMappings();
  }),

  /** Analyze content gaps vs competitors */
  analyzeContentGaps: adminProcedure.mutation(async ({ ctx }) => {
    const creditCheck = await checkCredits(ctx.user.id, "seo_run");
    if (!creditCheck.allowed) {
      throw new Error(`Insufficient credits for content gap analysis. Need ${creditCheck.cost}, have ${creditCheck.currentBalance}.`);
    }
    const result = await analyzeContentGaps();
    try {
      const _cr4 = await consumeCredits(ctx.user.id, "seo_run", "Content gap analysis");
      if (!_cr4.success) throw new TRPCError({ code: "FORBIDDEN", message: "Insufficient credits. Purchase more credits or upgrade your plan." });
    } catch (e) {
      log.warn("[SEO] Credit consumption failed (non-fatal):", { error: getErrorMessage(e) });
    }
    return result;
  }),

  /** Get semantic keyword clusters */
  getSemanticKeywordClusters: adminProcedure.query(() => {
    return getSemanticKeywordClusters();
  }),

  // ─── STATUS (v4) ───────────────────────────────────────────────────────────

  getStatus: adminProcedure.query(async () => {
    const allPages = getAllProgrammaticPages();
    const clusters = getTopicClusters();
    const snippets = getFeaturedSnippetTargets();
    const semanticClusters = getSemanticKeywordClusters();
    return {
      version: "4.0",
      isKilled: isSeoKilled(),
      lastRun: getLastOptimizationRun(),
      hasCachedReport: getCachedReport() !== null,
      cachedReportAge: getCachedReport() ? Date.now() - getCachedReport()!.generatedAt : null,
      v4Stats: {
        programmaticPages: allPages.length,
        topicClusters: clusters.length,
        featuredSnippetTargets: snippets.length,
        semanticKeywordClusters: semanticClusters.length,
        comparisonPages: allPages.filter(p => p.type === "comparison").length,
        integrationPages: allPages.filter(p => p.type === "integration").length,
        useCasePages: allPages.filter(p => p.type === "use-case").length,
        locationPages: allPages.filter(p => (p.type as string) === "location").length,
      },
      features: [
        "Dynamic meta tag injection (SSR-like)",
        "Hreflang for 12 languages",
        "RSS/Atom feed",
        "security.txt",
        "Core Web Vitals beacon",
        "IndexNow integration",
        "Redirect manager",
        "Blog post SEO with keyword density",
        "Internal link depth analysis",
        "Cost-optimized scheduling",
        "GEO / llms.txt / llms-full.txt (AI search)",
        "AI citation meta tags",
        `${allPages.length} programmatic SEO pages`,
        "15-type enhanced structured data",
        "E-E-A-T structured data",
        `${clusters.length} topic clusters`,
        `${snippets.length} featured snippet targets`,
        "Advanced robots.txt with AI crawler rules",
        "Sitemap index + 4 specialized sitemaps",
        "Content freshness analysis",
        "Search intent mapping",
        "Content gap analysis vs competitors",
        `${semanticClusters.length} semantic keyword clusters`,
        "GEO optimization cycle",
      ],
    };
  }),
});

// NOTE: The closing }); above closes the seoRouter. The intelligence procedures below
// are appended via a router merge — see routers.ts for the merge.
// Actually, we extend the router inline by reopening the object. Since tRPC routers
// are immutable after creation, we export a separate intelligenceRouter and merge it.

import { router as trpcRouter } from "./_core/trpc";

export const seoIntelligenceRouter = trpcRouter({

  // ════════════════════════════════════════════════════════════════════════
  // SEO INTELLIGENCE — Rank Tracking, Decay, Backlinks, Schema, AI Search
  // ════════════════════════════════════════════════════════════════════════

  /** Full SEO intelligence report — all systems in one call */
  getIntelligenceReport: adminProcedure.query(async () => {
    return generateSeoIntelligenceReport();
  }),

  /** Keyword rank tracking — all tracked keywords with position history */
  getRankings: adminProcedure.query(() => {
    return getRankings();
  }),

  /** Keywords in positions 4-20 (striking distance — highest ROI) */
  getStrikingDistance: adminProcedure.query(() => {
    return getStrikingDistanceKeywords();
  }),

  /** Keywords trending upward */
  getRisingKeywords: adminProcedure.query(() => {
    return getRisingKeywords();
  }),

  /** Keywords trending downward — need intervention */
  getFallingKeywords: adminProcedure.query(() => {
    return getFallingKeywords();
  }),

  /** Simulate a rank position update */
  updateRankPositions: adminProcedure
    .input(z.object({ contentPublishedToday: z.number().min(0).max(20).default(0) }).optional())
    .mutation(({ input }) => {
      return updateRankPositions(input?.contentPublishedToday ?? 0);
    }),

  /** Content decay analysis — pages losing relevance with refresh briefs */
  getContentDecay: adminProcedure.query(async () => {
    return analyzeContentDecay();
  }),

  /** Backlink gap analysis — domains linking to competitors but not Titan */
  getBacklinkGaps: adminProcedure.query(() => {
    return getBacklinkGaps();
  }),

  /** Top backlink opportunities by domain authority */
  getTopBacklinkOpportunities: adminProcedure
    .input(z.object({ limit: z.number().min(1).max(20).default(5) }).optional())
    .query(({ input }) => {
      return getTopBacklinkOpportunities(input?.limit ?? 5);
    }),

  /** Schema validation and auto-generation for a specific page */
  validateSchema: adminProcedure
    .input(z.object({ url: z.string() }))
    .query(async ({ input }) => {
      return validateAndGenerateSchema(input.url);
    }),

  /** Full schema audit across all pages */
  auditAllSchemas: adminProcedure.query(async () => {
    return auditAllPageSchemas();
  }),

  /** Check Titan's presence in AI search responses */
  checkAiPresence: adminProcedure.mutation(async ({ ctx }) => {
    const creditCheck = await checkCredits(ctx.user.id, "seo_run");
    if (!creditCheck.allowed) {
      throw new Error(`Insufficient credits for AI search presence check. Need ${creditCheck.cost}, have ${creditCheck.currentBalance}.`);
    }
    const result = await checkAiSearchPresence();
    try {
      const _cr5 = await consumeCredits(ctx.user.id, "seo_run", "AI search presence check");
      if (!_cr5.success) throw new TRPCError({ code: "FORBIDDEN", message: "Insufficient credits. Purchase more credits or upgrade your plan." });
    } catch (e) {
      log.warn("[SEO] Credit consumption failed (non-fatal):", { error: getErrorMessage(e) });
    }
    return result;
  }),

  /** Get AI search presence summary */
  getAiPresenceSummary: adminProcedure.query(() => {
    return getAiPresenceSummary();
  }),

  /** Get AI presence check log */
  getAiPresenceLog: adminProcedure
    .input(z.object({ limit: z.number().min(1).max(200).default(50) }).optional())
    .query(({ input }) => {
      return getAiPresenceLog(input?.limit ?? 50);
    }),

  /** Internal link suggestions */
  getInternalLinkSuggestions: adminProcedure.query(async () => {
    return generateInternalLinkSuggestions();
  }),

  /** Orphan pages — fewer than 2 inbound internal links */
  getOrphanPages: adminProcedure.query(async () => {
    return getOrphanPages();
  }),

  /** Core Web Vitals diagnosis with fix recommendations per page */
  getCoreWebVitals: adminProcedure.query(() => {
    return getCoreWebVitalsDiagnosis();
  }),

  /** SERP feature analysis — featured snippets and PAA boxes to capture */
  getSerpFeatures: adminProcedure.query(async () => {
    return analyzeSerpFeatures();
  }),

  /** Keyword cannibalization detection */
  getCannibalization: adminProcedure.query(() => {
    return detectKeywordCannibalization();
  }),
});
