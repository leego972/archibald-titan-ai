/**
 * Content Creator Router — tRPC endpoints for the Content Creator System
 *
 * All endpoints require admin role (adminProcedure).
 * Integrates with SEO engine, advertising orchestrator, and TikTok pipeline.
 */

import { z } from "zod";
import { adminProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import {
  contentCreatorCampaigns,
  contentCreatorPieces,
  contentCreatorSchedules,
  contentCreatorAnalytics,
} from "../drizzle/schema";
import { eq, desc, and, gte, sql, count } from "drizzle-orm";
import {
  generateCreatorContent,
  bulkGenerateForCampaign,
  publishPieceToTikTok,
  getCampaignAnalytics,
  getContentCreatorDashboard,
  scheduleContentPiece,
  processDueSchedules,
  generateSeoContentBriefs,
  generateCampaignStrategy,
  PLATFORM_CONFIG,
  scoreContentQuality,
  scoreSeoContent,
} from "./content-creator-engine";
import { isTikTokContentConfigured } from "./tiktok-content-service";
import { createLogger } from "./_core/logger.js";
import { getErrorMessage } from "./_core/errors.js";

const log = createLogger("ContentCreatorRouter");

export const contentCreatorRouter = router({

  // ─── Dashboard ────────────────────────────────────────────────────────────
  getDashboard: adminProcedure.query(async () => {
    return getContentCreatorDashboard();
  }),

  // ─── Platform Config ──────────────────────────────────────────────────────
  getPlatformConfig: adminProcedure.query(async () => {
    return Object.entries(PLATFORM_CONFIG).map(([id, config]) => ({
      id,
      ...config,
    }));
  }),

  // ─── Campaigns ────────────────────────────────────────────────────────────
  getCampaigns: adminProcedure
    .input(z.object({
      status: z.enum(["draft", "active", "paused", "completed", "archived"]).optional(),
      limit: z.number().min(1).max(100).default(50),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const query = db.select().from(contentCreatorCampaigns)
        .orderBy(desc(contentCreatorCampaigns.createdAt))
        .limit(input?.limit || 50);
      return query;
    }),

  getCampaign: adminProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;
      const [campaign] = await db.select().from(contentCreatorCampaigns)
        .where(eq(contentCreatorCampaigns.id, input.id)).limit(1);
      return campaign || null;
    }),

  createCampaign: adminProcedure
    .input(z.object({
      name: z.string().min(1).max(255),
      objective: z.string().max(100).default("brand_awareness"),
      description: z.string().optional(),
      targetAudience: z.string().optional(),
      brandVoice: z.string().max(100).default("confident"),
      primaryKeywords: z.array(z.string()).optional(),
      platforms: z.array(z.string()).min(1),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      seoLinked: z.boolean().default(false),
      advertisingLinked: z.boolean().default(false),
      tiktokLinked: z.boolean().default(false),
      generateStrategy: z.boolean().default(true),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      // Generate AI strategy if requested
      let aiStrategy: string | undefined;
      if (input.generateStrategy) {
        try {
          aiStrategy = await generateCampaignStrategy({
            name: input.name,
            objective: input.objective,
            platforms: input.platforms,
            targetAudience: input.targetAudience,
          });
        } catch (err) {
          log.warn("[ContentCreator] Strategy generation failed:", { error: getErrorMessage(err) });
        }
      }

      const [result] = await db.insert(contentCreatorCampaigns).values({
        name: input.name,
        objective: input.objective,
        description: input.description,
        targetAudience: input.targetAudience,
        brandVoice: input.brandVoice,
        primaryKeywords: input.primaryKeywords,
        platforms: input.platforms,
        status: "draft",
        startDate: input.startDate ? new Date(input.startDate) : undefined,
        endDate: input.endDate ? new Date(input.endDate) : undefined,
        seoLinked: input.seoLinked,
        advertisingLinked: input.advertisingLinked,
        tiktokLinked: input.tiktokLinked,
        aiStrategy,
      } as any);

      const campaignId = (result as any).insertId;
      return { success: true, campaignId };
    }),

  updateCampaign: adminProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().min(1).max(255).optional(),
      objective: z.string().max(100).optional(),
      description: z.string().optional(),
      targetAudience: z.string().optional(),
      brandVoice: z.string().max(100).optional(),
      primaryKeywords: z.array(z.string()).optional(),
      platforms: z.array(z.string()).min(1).optional(),
      status: z.enum(["draft", "active", "paused", "completed", "archived"]).optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      seoLinked: z.boolean().optional(),
      advertisingLinked: z.boolean().optional(),
      tiktokLinked: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const { id, startDate, endDate, ...rest } = input;
      await db.update(contentCreatorCampaigns).set({
        ...rest,
        ...(startDate ? { startDate: new Date(startDate) } : {}),
        ...(endDate ? { endDate: new Date(endDate) } : {}),
      } as any).where(eq(contentCreatorCampaigns.id, id));
      return { success: true };
    }),

  deleteCampaign: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      await db.update(contentCreatorCampaigns).set({ status: "archived" as any })
        .where(eq(contentCreatorCampaigns.id, input.id));
      return { success: true };
    }),

  getCampaignAnalytics: adminProcedure
    .input(z.object({ campaignId: z.number() }))
    .query(async ({ input }) => {
      return getCampaignAnalytics(input.campaignId);
    }),

  // ─── Content Pieces ───────────────────────────────────────────────────────
  getPieces: adminProcedure
    .input(z.object({
      campaignId: z.number().optional(),
      platform: z.string().optional(),
      status: z.enum(["draft", "review", "approved", "scheduled", "published", "failed", "archived"]).optional(),
      limit: z.number().min(1).max(200).default(50),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const conditions = [];
      if (input?.campaignId) conditions.push(eq(contentCreatorPieces.campaignId, input.campaignId));
      if (input?.platform) conditions.push(eq(contentCreatorPieces.platform, input.platform as any));
      if (input?.status) conditions.push(eq(contentCreatorPieces.status, input.status as any));
      const query = db.select().from(contentCreatorPieces)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(contentCreatorPieces.createdAt))
        .limit(input?.limit || 50);
      return query;
    }),

  getPiece: adminProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;
      const [piece] = await db.select().from(contentCreatorPieces)
        .where(eq(contentCreatorPieces.id, input.id)).limit(1);
      return piece || null;
    }),

  // ─── AI Content Generation ────────────────────────────────────────────────
  generateContent: adminProcedure
    .input(z.object({
      platform: z.string(),
      contentType: z.string(),
      topic: z.string().optional(),
      campaignObjective: z.string().optional(),
      seoKeywords: z.array(z.string()).optional(),
      targetAudience: z.string().optional(),
      brandVoice: z.string().optional(),
      includeImage: z.boolean().default(false),
      campaignId: z.number().optional(),
      saveToDraft: z.boolean().default(true),
    }))
    .mutation(async ({ input }) => {
      const { saveToDraft, ...genParams } = input;

      const content = await generateCreatorContent(genParams);

      if (saveToDraft) {
        const db = await getDb();
        if (db) {
          const [result] = await db.insert(contentCreatorPieces).values({
            campaignId: input.campaignId,
            platform: input.platform as any,
            contentType: input.contentType as any,
            title: content.title,
            body: content.body,
            headline: content.headline,
            callToAction: content.callToAction,
            hashtags: content.hashtags,
            mediaUrl: content.mediaUrl,
            imagePrompt: content.imagePrompt,
            hook: content.hook,
            videoScript: content.videoScript,
            visualDirections: content.visualDirections,
            seoKeywords: content.seoKeywords,
            seoScore: content.seoScore,
            qualityScore: content.qualityScore,
            status: "draft",
            aiPrompt: input.topic || `${input.platform} ${input.contentType}`,
            aiModel: "gpt-4.1-mini",
            generationMs: content.generationMs,
          } as any);

          return { ...content, pieceId: (result as any).insertId };
        }
      }

      return { ...content, pieceId: null };
    }),

  bulkGenerate: adminProcedure
    .input(z.object({
      campaignId: z.number(),
      platforms: z.array(z.string()).min(1),
      topic: z.string().optional(),
      seoKeywords: z.array(z.string()).optional(),
      includeImages: z.boolean().default(false),
      campaignObjective: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      return bulkGenerateForCampaign(input);
    }),

  updatePiece: adminProcedure
    .input(z.object({
      id: z.number(),
      title: z.string().optional(),
      headline: z.string().optional(),
      body: z.string().optional(),
      callToAction: z.string().optional(),
      hashtags: z.array(z.string()).optional(),
      hook: z.string().optional(),
      videoScript: z.string().optional(),
      visualDirections: z.array(z.string()).optional(),
      status: z.enum(["draft", "review", "approved", "scheduled", "published", "failed", "archived"]).optional(),
      mediaUrl: z.string().optional(),
      imagePrompt: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const { id, ...updates } = input;

      // Recalculate scores if body changed
      if (updates.body) {
        const [existing] = await db.select().from(contentCreatorPieces)
          .where(eq(contentCreatorPieces.id, id)).limit(1);
        if (existing) {
          const seoScore = scoreSeoContent({
            body: updates.body,
            title: updates.title || existing.title || undefined,
            seoKeywords: existing.seoKeywords as string[] || [],
            platform: existing.platform,
          });
          const qualityScore = scoreContentQuality({
            body: updates.body,
            platform: existing.platform,
            seoKeywords: existing.seoKeywords as string[] || [],
            hashtags: updates.hashtags || existing.hashtags as string[] || [],
            callToAction: updates.callToAction || existing.callToAction || undefined,
            hook: updates.hook || existing.hook || undefined,
          });
          (updates as any).seoScore = seoScore;
          (updates as any).qualityScore = qualityScore;
        }
      }

      await db.update(contentCreatorPieces).set(updates as any)
        .where(eq(contentCreatorPieces.id, id));
      return { success: true };
    }),

  approvePiece: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      await db.update(contentCreatorPieces).set({ status: "approved" as any })
        .where(eq(contentCreatorPieces.id, input.id));
      return { success: true };
    }),

  rejectPiece: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      await db.update(contentCreatorPieces).set({ status: "draft" as any })
        .where(eq(contentCreatorPieces.id, input.id));
      return { success: true };
    }),

  deletePiece: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      await db.update(contentCreatorPieces).set({ status: "archived" as any })
        .where(eq(contentCreatorPieces.id, input.id));
      return { success: true };
    }),

  // ─── Scheduling ───────────────────────────────────────────────────────────
  schedulePiece: adminProcedure
    .input(z.object({
      pieceId: z.number(),
      scheduledAt: z.string(),
      campaignId: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      return scheduleContentPiece({
        pieceId: input.pieceId,
        scheduledAt: new Date(input.scheduledAt),
        campaignId: input.campaignId,
      });
    }),

  getSchedules: adminProcedure
    .input(z.object({
      status: z.enum(["pending", "processing", "published", "failed", "cancelled"]).optional(),
      limit: z.number().min(1).max(100).default(50),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const conditions = [];
      if (input?.status) conditions.push(eq(contentCreatorSchedules.status, input.status as any));
      return db.select().from(contentCreatorSchedules)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(contentCreatorSchedules.scheduledAt)
        .limit(input?.limit || 50);
    }),

  processDueSchedules: adminProcedure.mutation(async () => {
    return processDueSchedules();
  }),

  cancelSchedule: adminProcedure
    .input(z.object({ scheduleId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      await db.update(contentCreatorSchedules).set({ status: "cancelled" as any })
        .where(eq(contentCreatorSchedules.id, input.scheduleId));
      return { success: true };
    }),

  // ─── TikTok Integration ───────────────────────────────────────────────────
  getTikTokStatus: adminProcedure.query(async () => {
    return {
      configured: isTikTokContentConfigured(),
      capabilities: isTikTokContentConfigured()
        ? ["photo_carousel", "video_by_url", "post_status_check"]
        : [],
      setupRequired: !isTikTokContentConfigured()
        ? ["TIKTOK_OPEN_ID", "TIKTOK_CREATOR_TOKEN"]
        : [],
    };
  }),

  publishToTikTok: adminProcedure
    .input(z.object({
      pieceId: z.number(),
      privacyLevel: z.enum([
        "PUBLIC_TO_EVERYONE",
        "MUTUAL_FOLLOW_FRIENDS",
        "FOLLOWER_OF_CREATOR",
        "SELF_ONLY",
      ]).default("PUBLIC_TO_EVERYONE"),
    }))
    .mutation(async ({ input }) => {
      return publishPieceToTikTok({
        pieceId: input.pieceId,
        privacyLevel: input.privacyLevel,
      });
    }),

  // ─── SEO Integration ──────────────────────────────────────────────────────
  getSeoContentBriefs: adminProcedure
    .input(z.object({ count: z.number().min(1).max(20).default(5) }).optional())
    .query(async ({ input }) => {
      return generateSeoContentBriefs(input?.count || 5);
    }),

  generateFromSeoBrief: adminProcedure
    .input(z.object({
      topic: z.string(),
      targetKeyword: z.string(),
      secondaryKeywords: z.array(z.string()),
      recommendedPlatforms: z.array(z.string()),
      campaignId: z.number().optional(),
      includeImages: z.boolean().default(false),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      const results = [];
      for (const platform of input.recommendedPlatforms.slice(0, 4)) {
        const config = PLATFORM_CONFIG[platform];
        if (!config) continue;

        try {
          const content = await generateCreatorContent({
            platform,
            contentType: config.contentTypes[0],
            topic: input.topic,
            seoKeywords: [input.targetKeyword, ...input.secondaryKeywords],
            campaignObjective: "SEO-driven organic traffic",
            includeImage: input.includeImages,
            campaignId: input.campaignId,
          });

          const [result] = await db.insert(contentCreatorPieces).values({
            campaignId: input.campaignId,
            platform: platform as any,
            contentType: config.contentTypes[0] as any,
            title: content.title,
            body: content.body,
            headline: content.headline,
            callToAction: content.callToAction,
            hashtags: content.hashtags,
            mediaUrl: content.mediaUrl,
            imagePrompt: content.imagePrompt,
            hook: content.hook,
            videoScript: content.videoScript,
            visualDirections: content.visualDirections,
            seoKeywords: content.seoKeywords,
            seoScore: content.seoScore,
            qualityScore: content.qualityScore,
            status: "draft",
            aiPrompt: `SEO brief: ${input.topic}`,
            aiModel: "gpt-4.1-mini",
            generationMs: content.generationMs,
          } as any);

          results.push({ platform, pieceId: (result as any).insertId, seoScore: content.seoScore });
          await new Promise(r => setTimeout(r, 400));
        } catch (err) {
          results.push({ platform, error: getErrorMessage(err) });
        }
      }

      return { success: true, generated: results.filter(r => !r.error).length, results };
    }),

  // ─── Analytics ────────────────────────────────────────────────────────────
  getAnalytics: adminProcedure
    .input(z.object({
      campaignId: z.number().optional(),
      days: z.number().min(1).max(365).default(30),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;

      const since = new Date(Date.now() - (input?.days || 30) * 24 * 60 * 60 * 1000);

      const conditions = [gte(contentCreatorAnalytics.createdAt, since)];
      if (input?.campaignId) {
        conditions.push(eq(contentCreatorAnalytics.campaignId, input.campaignId));
      }

      const analyticsData = await db.select().from(contentCreatorAnalytics)
        .where(and(...conditions))
        .orderBy(desc(contentCreatorAnalytics.createdAt))
        .limit(500);

      // Aggregate by platform
      const byPlatform: Record<string, {
        impressions: number;
        clicks: number;
        engagements: number;
        shares: number;
        saves: number;
        videoViews: number;
      }> = {};

      for (const row of analyticsData) {
        if (!byPlatform[row.platform]) {
          byPlatform[row.platform] = { impressions: 0, clicks: 0, engagements: 0, shares: 0, saves: 0, videoViews: 0 };
        }
        byPlatform[row.platform].impressions += row.impressions;
        byPlatform[row.platform].clicks += row.clicks;
        byPlatform[row.platform].engagements += row.engagements;
        byPlatform[row.platform].shares += row.shares;
        byPlatform[row.platform].saves += row.saves;
        byPlatform[row.platform].videoViews += row.videoViews;
      }

      const totals = {
        impressions: analyticsData.reduce((s, r) => s + r.impressions, 0),
        clicks: analyticsData.reduce((s, r) => s + r.clicks, 0),
        engagements: analyticsData.reduce((s, r) => s + r.engagements, 0),
        shares: analyticsData.reduce((s, r) => s + r.shares, 0),
        saves: analyticsData.reduce((s, r) => s + r.saves, 0),
        videoViews: analyticsData.reduce((s, r) => s + r.videoViews, 0),
      };

      return { analyticsData, byPlatform, totals };
    }),

  // ─── Content Calendar ─────────────────────────────────────────────────────
  getContentCalendar: adminProcedure
    .input(z.object({
      startDate: z.string(),
      endDate: z.string(),
      campaignId: z.number().optional(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];

      const start = new Date(input.startDate);
      const end = new Date(input.endDate);

      const conditions = [
        gte(contentCreatorPieces.scheduledAt, start),
        sql`${contentCreatorPieces.scheduledAt} <= ${end}`,
      ];
      if (input.campaignId) {
        conditions.push(eq(contentCreatorPieces.campaignId, input.campaignId));
      }

      return db.select().from(contentCreatorPieces)
        .where(and(...conditions))
        .orderBy(contentCreatorPieces.scheduledAt)
        .limit(200);
    }),

  // ─── AI Content Strategy ──────────────────────────────────────────────────
  generateStrategy: adminProcedure
    .input(z.object({
      name: z.string(),
      objective: z.string(),
      platforms: z.array(z.string()),
      targetAudience: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const strategy = await generateCampaignStrategy(input);
      return { strategy };
    }),

  // ─── Stats Summary ────────────────────────────────────────────────────────
  getStats: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) return {
      totalCampaigns: 0, activeCampaigns: 0, totalPieces: 0,
      publishedPieces: 0, avgQualityScore: 0, avgSeoScore: 0,
      tiktokPosts: 0, scheduledPieces: 0,
    };

    const [campaigns, pieces] = await Promise.all([
      db.select({ total: count() }).from(contentCreatorCampaigns),
      db.select().from(contentCreatorPieces).limit(1000),
    ]);

    const activeCampaigns = await db.select({ total: count() }).from(contentCreatorCampaigns)
      .where(eq(contentCreatorCampaigns.status, "active"));

    const totalPieces = pieces.length;
    const publishedPieces = pieces.filter(p => p.status === "published").length;
    const scheduledPieces = pieces.filter(p => p.status === "scheduled").length;
    const tiktokPosts = pieces.filter(p => p.platform === "tiktok" && p.status === "published").length;
    const avgQualityScore = totalPieces > 0
      ? Math.round(pieces.reduce((s, p) => s + (p.qualityScore || 0), 0) / totalPieces)
      : 0;
    const avgSeoScore = totalPieces > 0
      ? Math.round(pieces.reduce((s, p) => s + (p.seoScore || 0), 0) / totalPieces)
      : 0;

    return {
      totalCampaigns: campaigns[0]?.total || 0,
      activeCampaigns: activeCampaigns[0]?.total || 0,
      totalPieces,
      publishedPieces,
      scheduledPieces,
      tiktokPosts,
      avgQualityScore,
      avgSeoScore,
    };
  }),
});
