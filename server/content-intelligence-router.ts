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
import { consumeCredits, checkCredits } from "./credit-service";
import { createLogger } from "./_core/logger.js";
import { getErrorMessage } from "./_core/errors.js";
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

const log = createLogger("ContentIntelligenceRouter");

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
    .mutation(async ({ ctx, input }) => {
      const creditCheck = await checkCredits(ctx.user.id, "content_bulk_generate");
      if (!creditCheck.allowed) {
        throw new Error(`Insufficient credits for pipeline. Need ${creditCheck.cost}, have ${creditCheck.currentBalance}.`);
      }
      const result = await runContentPipeline(input);
      try {
        await consumeCredits(ctx.user.id, "content_bulk_generate", `Content pipeline: ${input.platform} — ${input.prompt.slice(0, 60)}`);
      } catch (e) {
        log.warn("[ContentIntelligence] Credit consumption failed (non-fatal):", { error: getErrorMessage(e) });
      }
      return result;
    }),

  // ─── Content Atom System (1 topic → 9 variants) ───────────────────────────
  generateAtom: adminProcedure
    .input(z.object({
      topic: z.string().min(1),
      targetKeywords: z.array(z.string()).optional(),
      persona: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const creditCheck = await checkCredits(ctx.user.id, "content_bulk_generate");
      if (!creditCheck.allowed) {
        throw new Error(`Insufficient credits for atom generation. Need ${creditCheck.cost}, have ${creditCheck.currentBalance}.`);
      }
      const result = await generateContentAtom(input);
      try {
        await consumeCredits(ctx.user.id, "content_bulk_generate", `Content atom: ${input.topic}`);
      } catch (e) {
        log.warn("[ContentIntelligence] Credit consumption failed (non-fatal):", { error: getErrorMessage(e) });
      }
      return result;
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
    .mutation(async ({ ctx, input }) => {
      const creditCheck = await checkCredits(ctx.user.id, "content_generate");
      if (!creditCheck.allowed) {
        throw new Error(`Insufficient credits for brand voice scoring. Need ${creditCheck.cost}, have ${creditCheck.currentBalance}.`);
      }
      const result = await scoreBrandVoice(input.content);
      try {
        await consumeCredits(ctx.user.id, "content_generate", `Brand voice score: ${input.content.slice(0, 40)}`);
      } catch (e) {
        log.warn("[ContentIntelligence] Credit consumption failed (non-fatal):", { error: getErrorMessage(e) });
      }
      return result;
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
    .mutation(async ({ ctx, input }) => {
      const creditCheck = await checkCredits(ctx.user.id, "content_generate");
      if (!creditCheck.allowed) {
        throw new Error(`Insufficient credits for repurposing. Need ${creditCheck.cost}, have ${creditCheck.currentBalance}.`);
      }
      const result = await repurposeContent(input);
      try {
        await consumeCredits(ctx.user.id, "content_generate", `Repurpose: ${input.sourcePlatform} → ${input.targetPlatforms.join(", ")}`);
      } catch (e) {
        log.warn("[ContentIntelligence] Credit consumption failed (non-fatal):", { error: getErrorMessage(e) });
      }
      return result;
    }),

  // ─── Full Intelligence Summary ────────────────────────────────────────────
  getIntelligenceSummary: adminProcedure
    .query(async () => {
      return getContentIntelligenceSummary();
    }),
});
