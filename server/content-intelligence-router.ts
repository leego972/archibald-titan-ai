/**
 * Content Intelligence Router
 *
 * Elite-level content intelligence endpoints:
 * - 5-stage refinement pipeline
 * - Content atom generator (1 topic → 9 platform variants)
 * - Trend injection engine
 * - Evergreen content recycler
 * - Brand voice DNA scorer
 * - Performance feedback loop
 * - Buyer persona targeting
 * - Content velocity tracker
 * - Cross-platform repurposing engine
 */

import { z } from "zod";
import { adminProcedure, router } from "./_core/trpc";
import {
  runContentPipeline,
  generateContentAtom,
  getTrendSignals,
  getBreakingTrends,
  getTrendContentIdeas,
  getEvergreenCandidates,
  getTopEvergreenOpportunity,
  scoreBrandVoice,
  getTopPerformingPatterns,
  recordContentPerformance,
  getAllPersonas,
  getPersonaContentAngles,
  calculateContentVelocity,
  repurposeContent,
  getContentIntelligenceSummary,
} from "./content-intelligence";

export const contentIntelligenceRouter = router({

  // ─── 5-Stage Refinement Pipeline ─────────────────────────────────────────
  runPipeline: adminProcedure
    .input(z.object({
      prompt: z.string().min(1),
      platform: z.string(),
      targetKeywords: z.array(z.string()).optional(),
      persona: z.string().optional(),
      minScore: z.number().min(0).max(100).optional(),
    }))
    .mutation(async ({ input }) => {
      return runContentPipeline(input);
    }),

  // ─── Content Atom System (1 topic → 9 variants) ───────────────────────────
  generateAtom: adminProcedure
    .input(z.object({
      topic: z.string().min(1),
      targetKeywords: z.array(z.string()).optional(),
      persona: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      return generateContentAtom(input);
    }),

  // ─── Trend Intelligence ───────────────────────────────────────────────────
  getTrends: adminProcedure
    .input(z.object({ limit: z.number().min(1).max(20).optional() }))
    .query(async ({ input }) => {
      return getTrendSignals(input.limit ?? 5);
    }),

  getBreakingTrends: adminProcedure
    .query(async () => {
      return getBreakingTrends();
    }),

  getTrendIdeas: adminProcedure
    .input(z.object({ limit: z.number().min(1).max(30).optional() }))
    .query(async ({ input }) => {
      return getTrendContentIdeas(input.limit ?? 10);
    }),

  // ─── Evergreen Content Recycler ───────────────────────────────────────────
  getEvergreenCandidates: adminProcedure
    .input(z.object({
      priority: z.enum(["critical", "high", "medium", "low"]).optional(),
    }))
    .query(async ({ input }) => {
      return getEvergreenCandidates(input.priority);
    }),

  getTopEvergreenOpportunity: adminProcedure
    .query(async () => {
      return getTopEvergreenOpportunity();
    }),

  // ─── Brand Voice DNA ──────────────────────────────────────────────────────
  scoreBrandVoice: adminProcedure
    .input(z.object({ content: z.string().min(1) }))
    .mutation(async ({ input }) => {
      return scoreBrandVoice(input.content);
    }),

  // ─── Performance Feedback Loop ────────────────────────────────────────────
  getPerformancePatterns: adminProcedure
    .query(async () => {
      return getTopPerformingPatterns();
    }),

  recordPerformance: adminProcedure
    .input(z.object({
      contentId: z.number(),
      platform: z.string(),
      publishedAt: z.string(),
      impressions: z.number(),
      engagementRate: z.number(),
      clickRate: z.number(),
      conversionRate: z.number(),
      topPerformingElement: z.string(),
      learnings: z.array(z.string()),
      nextBriefAdjustments: z.array(z.string()),
    }))
    .mutation(async ({ input }) => {
      recordContentPerformance(input);
      return { success: true };
    }),

  // ─── Persona Targeting ────────────────────────────────────────────────────
  getPersonas: adminProcedure
    .query(async () => {
      return getAllPersonas();
    }),

  getPersonaAngles: adminProcedure
    .input(z.object({ personaId: z.string() }))
    .query(async ({ input }) => {
      return getPersonaContentAngles(input.personaId);
    }),

  // ─── Content Velocity Tracker ─────────────────────────────────────────────
  getVelocityReport: adminProcedure
    .input(z.object({
      publishedLast30Days: z.number().min(0),
      publishedByPlatform: z.record(z.string(), z.number()),
    }))
    .query(async ({ input }) => {
      return calculateContentVelocity(input);
    }),

  // ─── Cross-Platform Repurposing ───────────────────────────────────────────
  repurposeContent: adminProcedure
    .input(z.object({
      sourceContent: z.string().min(1),
      sourcePlatform: z.string(),
      targetPlatforms: z.array(z.string()).min(1),
    }))
    .mutation(async ({ input }) => {
      return repurposeContent(input);
    }),

  // ─── Full Intelligence Summary ────────────────────────────────────────────
  getIntelligenceSummary: adminProcedure
    .query(async () => {
      return getContentIntelligenceSummary();
    }),
});
