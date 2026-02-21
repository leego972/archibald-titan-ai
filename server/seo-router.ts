/**
 * SEO Router v3 — tRPC endpoints for the autonomous SEO engine
 */

import { z } from "zod";
import { adminProcedure, protectedProcedure } from "./_core/trpc";
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

export const seoRouter = router({
  // Get SEO health score and issues
  getHealthScore: adminProcedure.query(async () => {
    return analyzeSeoHealth();
  }),

  // Get keyword analysis
  getKeywords: adminProcedure.query(async () => {
    return analyzeKeywords();
  }),

  // Get meta tag optimization suggestions
  getMetaOptimizations: adminProcedure.query(async () => {
    return optimizeMetaTags();
  }),

  // Get full SEO report (cached if available)
  getReport: adminProcedure.query(async () => {
    const cached = getCachedReport();
    if (cached && Date.now() - cached.generatedAt < 3600_000) {
      return cached; // Return cached if less than 1 hour old
    }
    return generateSeoReport();
  }),

  // Force a new SEO optimization run
  runOptimization: adminProcedure.mutation(async () => {
    return runScheduledSeoOptimization();
  }),

  // Get structured data schemas
  getStructuredData: adminProcedure.query(async () => {
    return generateStructuredData();
  }),

  // Get Open Graph tags for a page
  getOpenGraphTags: adminProcedure
    .input(z.object({ path: z.string() }))
    .query(async ({ input }) => {
      return getOpenGraphTags(input.path);
    }),

  // Get all public pages configuration
  getPublicPages: adminProcedure.query(async () => {
    return getPublicPages();
  }),

  // Get internal link analysis
  getInternalLinks: adminProcedure.query(async () => {
    return analyzeInternalLinks();
  }),

  // Get Core Web Vitals summary
  getWebVitals: adminProcedure.query(async () => {
    return getWebVitalsSummary();
  }),

  // Get redirect configuration
  getRedirects: adminProcedure.query(async () => {
    return getRedirects();
  }),

  // Get SEO event log
  getEventLog: adminProcedure
    .input(z.object({ limit: z.number().min(1).max(500).default(50) }).optional())
    .query(async ({ input }) => {
      return getSeoEventLog(input?.limit || 50);
    }),

  // Submit URLs to IndexNow for instant indexing
  submitIndexNow: adminProcedure
    .input(z.object({ urls: z.array(z.string()).min(1).max(100) }))
    .mutation(async ({ input }) => {
      return submitToIndexNow(input.urls);
    }),

  // Get engine status
  getStatus: adminProcedure.query(async () => {
    return {
      version: "3.0",
      isKilled: isSeoKilled(),
      lastRun: getLastOptimizationRun(),
      hasCachedReport: getCachedReport() !== null,
      cachedReportAge: getCachedReport()
        ? Date.now() - getCachedReport()!.generatedAt
        : null,
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
      ],
    };
  }),

  // Kill switch
  killSwitch: adminProcedure
    .input(z.object({ action: z.enum(["activate", "deactivate"]) }))
    .mutation(async ({ input }) => {
      if (input.action === "activate") {
        return { success: triggerSeoKillSwitch("SEO_KILL_9X4M"), killed: true };
      } else {
        return { success: resetSeoKillSwitch("SEO_KILL_9X4M"), killed: false };
      }
    }),
});
