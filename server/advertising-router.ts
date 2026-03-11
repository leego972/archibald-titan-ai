/**
 * Advertising Router — tRPC procedures for the autonomous advertising system
 *
 * All procedures are admin-only since this controls the advertising budget
 * and autonomous content generation.
 *
 * Endpoints:
 *  Core Strategy:       getStrategy, getPerformance, getActivity, runCycle, getStrategies
 *  Content Queue:       getContentQueue, updateContentStatus, getContentById, getPreviewableContent
 *  Dashboard:           getDashboard
 *  TikTok:              getTikTokStats, triggerTikTokPost, checkTikTokPostStatus
 *  Video Generation:    getVideoStatus, generateVideo, generateShortVideo, generateAdVideo, generateSocialClip
 *  Channel Statuses:    getChannelStatuses, getChannelPerformance
 *  Budget:              getBudgetBreakdown
 *  Attribution:         getCrossChannelAttribution
 *  A/B Testing:         getABTests, createABTest, recordABTestResult
 *  Scheduler Control:   startScheduler, stopScheduler
 *  Blog Posts:          getBlogPosts
 *  Campaign Data:       getCampaignPerformance
 *  Autonomous Content:  triggerContentCycle, autoApproveContent
 */

import { z } from "zod";
import { router, adminProcedure } from "./_core/trpc";
import { getAllChannelStatuses } from "./marketing-channels";
import { getExpandedChannelStatuses } from "./expanded-channels";
import {
  runAdvertisingCycle,
  getStrategyOverview,
  getRecentActivity,
  getPerformanceMetrics,
  GROWTH_STRATEGIES,
  startAdvertisingScheduler,
  stopAdvertisingScheduler,
  getChannelPerformanceReport,
  getCrossChannelAttribution,
  getActiveABTests,
  createABTest,
  recordABTestResult,
} from "./advertising-orchestrator";
import {
  runTikTokContentPipeline,
  getTikTokContentStats,
  isTikTokContentConfigured,
  queryCreatorInfo,
  getPostStatus,
} from "./tiktok-content-service";
import {
  generateVideo,
  generateShortFormVideo,
  generateMarketingVideo,
  generateSocialClip,
  getVideoGenerationStatus,
  type GenerateVideoOptions,
} from "./_core/videoGeneration";
import { getDb } from "./db";
import {
  marketingContent,
  marketingActivityLog,
  marketingCampaigns,
  marketingPerformance,
  blogPosts,
  affiliatePartners,
  affiliateClicks,
} from "../drizzle/schema";
import { eq, desc, and, gte, sql, count } from "drizzle-orm";

export const advertisingRouter = router({

  // ══════════════════════════════════════════════════════════════════════════
  // CORE STRATEGY
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Get the full advertising strategy overview
   */
  getStrategy: adminProcedure.query(async () => {
    return getStrategyOverview();
  }),

  /**
   * Get performance metrics for the advertising system
   */
  getPerformance: adminProcedure
    .input(z.object({ days: z.number().min(1).max(365).default(30) }).optional())
    .query(async ({ input }) => {
      const days = input?.days ?? 30;
      return getPerformanceMetrics(days);
    }),

  /**
   * Get recent advertising activity log
   */
  getActivity: adminProcedure
    .input(z.object({ limit: z.number().min(1).max(200).default(50) }).optional())
    .query(async ({ input }) => {
      const limit = input?.limit ?? 50;
      return getRecentActivity(limit);
    }),

  /**
   * Manually trigger an advertising cycle (for testing or immediate action)
   */
  runCycle: adminProcedure.mutation(async () => {
    const result = await runAdvertisingCycle();
    return result;
  }),

  /**
   * Get all growth strategies with their details
   */
  getStrategies: adminProcedure.query(async () => {
    return GROWTH_STRATEGIES;
  }),

  // ══════════════════════════════════════════════════════════════════════════
  // CONTENT QUEUE
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Get content queue — all generated content awaiting review/publishing
   */
  getContentQueue: adminProcedure
    .input(
      z.object({
        status: z.enum(["draft", "approved", "published", "rejected"]).optional(),
        platform: z.string().optional(),
        limit: z.number().min(1).max(100).default(25),
      }).optional()
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];

      const conditions = [];
      if (input?.status) conditions.push(eq(marketingContent.status, input.status as any));
      if (input?.platform) conditions.push(eq(marketingContent.channel, input.platform as any));

      const content = await (db as any).query.marketingContent.findMany({
        where: conditions.length > 0 ? and(...conditions) : undefined,
        orderBy: [desc(marketingContent.createdAt)],
        limit: input?.limit ?? 25,
      });

      return content;
    }),

  /**
   * Approve or reject content from the queue
   */
  updateContentStatus: adminProcedure
    .input(
      z.object({
        id: z.number(),
        status: z.enum(["approved", "published", "failed", "draft"]),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      await db
        .update(marketingContent)
        .set({ status: input.status, updatedAt: new Date() })
        .where(eq(marketingContent.id, input.id));

      return { success: true };
    }),

  /**
   * Get a single content item by ID — used for ad preview
   */
  getContentById: adminProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const [item] = await db
        .select()
        .from(marketingContent)
        .where(eq(marketingContent.id, input.id))
        .limit(1);

      if (!item) throw new Error("Content not found");
      return item;
    }),

  /**
   * Get all previewable content — content in draft or approved status
   */
  getPreviewableContent: adminProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(50),
      }).optional()
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];

      const content = await db
        .select()
        .from(marketingContent)
        .where(
          sql`${marketingContent.status} IN ('draft', 'approved')`
        )
        .orderBy(desc(marketingContent.createdAt))
        .limit(input?.limit ?? 50);

      return content;
    }),

  // ══════════════════════════════════════════════════════════════════════════
  // DASHBOARD
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Get a summary dashboard with key metrics
   */
  getDashboard: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) {
      return {
        strategy: getStrategyOverview(),
        performance: null,
        recentActivity: [],
        contentQueue: { draft: 0, approved: 0, published: 0, rejected: 0 },
        channelPerformance: [],
        abTests: [],
      };
    }

    const [performance, recentActivity] = await Promise.all([
      getPerformanceMetrics(30),
      getRecentActivity(10),
    ]);

    // Content queue counts
    const contentCounts = await db
      .select({
        status: marketingContent.status,
        count: count(),
      })
      .from(marketingContent)
      .groupBy(marketingContent.status);

    const contentQueue = {
      draft: 0,
      approved: 0,
      published: 0,
      rejected: 0,
    };
    for (const c of contentCounts) {
      if (c.status in contentQueue) {
        (contentQueue as any)[c.status] = Number(c.count);
      }
    }

    return {
      strategy: getStrategyOverview(),
      performance,
      recentActivity,
      contentQueue,
      channelPerformance: getChannelPerformanceReport(),
      abTests: getActiveABTests(),
    };
  }),

  // ══════════════════════════════════════════════════════════════════════════
  // TIKTOK
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Get TikTok content posting stats and status
   */
  getTikTokStats: adminProcedure.query(async () => {
    const stats = await getTikTokContentStats();
    const creatorInfo = await queryCreatorInfo();
    return {
      ...stats,
      creatorInfo,
      configured: isTikTokContentConfigured(),
    };
  }),

  /**
   * Manually trigger TikTok content generation and posting
   */
  triggerTikTokPost: adminProcedure.mutation(async () => {
    const result = await runTikTokContentPipeline();
    return result;
  }),

  /**
   * Check the status of a TikTok post by publish_id
   */
  checkTikTokPostStatus: adminProcedure
    .input(z.object({ publishId: z.string() }))
    .query(async ({ input }) => {
      const status = await getPostStatus(input.publishId);
      return status;
    }),

  // ══════════════════════════════════════════════════════════════════════════
  // VIDEO GENERATION
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Get video generation status and availability
   */
  getVideoStatus: adminProcedure.query(async () => {
    return getVideoGenerationStatus();
  }),

  /**
   * Generate a video from a text prompt
   */
  generateVideo: adminProcedure
    .input(
      z.object({
        prompt: z.string().min(5).max(1000),
        duration: z.number().min(1).max(8).default(4),
        aspectRatio: z.enum(["16:9", "9:16", "1:1"]).default("16:9"),
        model: z.enum(["seedance", "grok-video"]).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const result = await generateVideo({
        prompt: input.prompt,
        duration: input.duration,
        aspectRatio: input.aspectRatio,
        model: input.model,
      });
      return result;
    }),

  /**
   * Generate a short-form vertical video (TikTok/YouTube Shorts)
   */
  generateShortVideo: adminProcedure
    .input(
      z.object({
        hook: z.string().min(3).max(200),
        scriptSummary: z.string().min(3).max(500),
      })
    )
    .mutation(async ({ input }) => {
      const result = await generateShortFormVideo(input.hook, input.scriptSummary);
      return result;
    }),

  /**
   * Generate a marketing/ad video
   */
  generateAdVideo: adminProcedure
    .input(
      z.object({
        topic: z.string().min(3).max(300),
        cta: z.string().min(3).max(200),
      })
    )
    .mutation(async ({ input }) => {
      const result = await generateMarketingVideo(input.topic, input.cta);
      return result;
    }),

  /**
   * Generate a social media clip for a specific platform
   */
  generateSocialClip: adminProcedure
    .input(
      z.object({
        feature: z.string().min(3).max(300),
        platform: z.enum(["tiktok", "youtube", "linkedin", "twitter", "instagram"]),
      })
    )
    .mutation(async ({ input }) => {
      const result = await generateSocialClip(input.feature, input.platform);
      return result;
    }),

  // ══════════════════════════════════════════════════════════════════════════
  // CHANNEL STATUSES & PERFORMANCE
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Get the connection status of all advertising channels (free + paid)
   */
  getChannelStatuses: adminProcedure.query(() => {
    const core = getAllChannelStatuses();
    const expanded = getExpandedChannelStatuses();
    const freeApiChannels = expanded.filter(c => c.type === "api_automated");
    const contentQueueChannels = expanded.filter(c => c.type === "content_queue");
    return {
      core,
      freeApiChannels,
      contentQueueChannels,
      summary: {
        coreConnected: core.filter(c => c.connected).length,
        coreTotal: core.length,
        freeApiConnected: freeApiChannels.filter(c => c.connected).length,
        freeApiTotal: freeApiChannels.length,
        contentQueueTotal: contentQueueChannels.length,
      },
    };
  }),

  /**
   * Get detailed performance metrics per channel
   */
  getChannelPerformance: adminProcedure.query(() => {
    return getChannelPerformanceReport();
  }),

  // ══════════════════════════════════════════════════════════════════════════
  // BUDGET
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Get budget breakdown and cost per channel
   */
  getBudgetBreakdown: adminProcedure.query(async () => {
    const overview = getStrategyOverview();
    const performance = await getPerformanceMetrics(30);
    return {
      monthlyBudget: overview.monthlyBudget,
      currency: overview.currency,
      allocation: overview.budgetAllocation,
      utilization: performance?.budgetUtilization || null,
      freeChannels: overview.freeChannelCount,
      paidChannels: overview.paidChannelCount,
      costBreakdown: GROWTH_STRATEGIES.map((s) => ({
        channel: s.channel,
        costPerMonth: s.costPerMonth,
        frequency: s.frequency,
        impact: s.expectedImpact,
        automatable: s.automatable,
      })),
    };
  }),

  // ══════════════════════════════════════════════════════════════════════════
  // CROSS-CHANNEL ATTRIBUTION
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Get cross-channel attribution — which channels drive the most conversions
   */
  getCrossChannelAttribution: adminProcedure
    .input(z.object({ days: z.number().min(1).max(365).default(30) }))
    .query(async ({ input }) => {
      return getCrossChannelAttribution(input.days);
    }),

  // ══════════════════════════════════════════════════════════════════════════
  // A/B TESTING
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Get all active A/B tests across channels
   */
  getABTests: adminProcedure.query(() => {
    return getActiveABTests();
  }),

  /**
   * Create a new A/B test for a specific channel
   */
  createABTest: adminProcedure
    .input(
      z.object({
        channel: z.string(),
        variantADesc: z.string().min(3).max(500),
        variantBDesc: z.string().min(3).max(500),
      })
    )
    .mutation(({ input }) => {
      return createABTest(input.channel, input.variantADesc, input.variantBDesc);
    }),

  /**
   * Record a result for an A/B test variant
   */
  recordABTestResult: adminProcedure
    .input(
      z.object({
        testId: z.string(),
        variant: z.enum(["A", "B"]),
        success: z.boolean(),
      })
    )
    .mutation(({ input }) => {
      recordABTestResult(input.testId, input.variant, input.success);
      return { success: true };
    }),

  // ══════════════════════════════════════════════════════════════════════════
  // SCHEDULER CONTROL
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Start the autonomous advertising + content scheduler
   */
  startScheduler: adminProcedure.mutation(() => {
    startAdvertisingScheduler();
    return { success: true, message: "Archibald Titan autonomous advertising scheduler started" };
  }),

  /**
   * Stop the autonomous advertising + content scheduler
   */
  stopScheduler: adminProcedure.mutation(() => {
    stopAdvertisingScheduler();
    return { success: true, message: "Archibald Titan autonomous advertising scheduler stopped" };
  }),

  // ══════════════════════════════════════════════════════════════════════════
  // BLOG POSTS
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Get recent blog posts generated by the autonomous advertising orchestrator
   */
  getBlogPosts: adminProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(50).default(20),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { items: [], total: 0 };
      const [items, totalRows] = await Promise.all([
        db
          .select()
          .from(blogPosts)
          .orderBy(desc(blogPosts.createdAt))
          .limit(input.limit)
          .offset(input.offset),
        db.select({ count: count() }).from(blogPosts),
      ]);
      return { items, total: Number(totalRows[0]?.count ?? 0) };
    }),

  // ══════════════════════════════════════════════════════════════════════════
  // CAMPAIGN PERFORMANCE
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Get marketing campaign performance data
   */
  getCampaignPerformance: adminProcedure
    .input(z.object({ days: z.number().min(1).max(365).default(30) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      return db
        .select()
        .from(marketingPerformance)
        .orderBy(desc(marketingPerformance.createdAt))
        .limit(100);
    }),

  // ══════════════════════════════════════════════════════════════════════════
  // AUTONOMOUS CONTENT CONTROL
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Manually trigger the full autonomous content generation cycle
   * (generates content, scores it, auto-approves ≥ threshold, schedules, posts to TikTok)
   */
  triggerContentCycle: adminProcedure
    .input(
      z.object({
        maxPiecesPerPlatform: z.number().min(1).max(10).default(2),
        autoApproveThreshold: z.number().min(0).max(100).default(75),
        autoSchedule: z.boolean().default(true),
        autoPublishTikTok: z.boolean().default(true),
      }).optional()
    )
    .mutation(async ({ input }) => {
      const { runAutonomousContentCycle } = await import("./content-creator-engine");
      return runAutonomousContentCycle({
        maxPieces: input?.maxPiecesPerPlatform ?? 2,
        forceGenerate: true,
      });
    }),

  /**
   * Auto-approve all high-quality draft content pieces (score ≥ threshold)
   */
  autoApproveContent: adminProcedure
    .input(z.object({ threshold: z.number().min(0).max(100).default(75) }).optional())
    .mutation(async ({ input }) => {
      const { autoApproveHighQualityContent } = await import("./content-creator-engine");
      return autoApproveHighQualityContent();
    }),
});
