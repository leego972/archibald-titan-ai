/**
 * Titan Marketing Engine — Admin-Only tRPC Router
 *
 * All endpoints require admin role. This is Titan's internal marketing
 * agency — not a user-facing feature.
 */

import { z } from "zod";
import { router, adminProcedure } from "./_core/trpc";
import { getDb } from "./db";
import {
  marketingBudgets,
  marketingCampaigns,
  marketingContent,
  marketingPerformance,
  marketingActivityLog,
  marketingSettings,
} from "../drizzle/schema";
import { eq, desc, and } from "drizzle-orm";
import {
  generateContent,
  allocateBudget,
  createCampaignPlan,
  executeCampaign,
  analyzePerformance,
  runAutonomousCycle,
} from "./marketing-engine";
import {
  getAllChannelStatuses,
  getConnectedChannels,
  type ChannelId,
} from "./marketing-channels";

export const marketingRouter = router({
  // ============================================
  // SETTINGS & CONFIGURATION
  // ============================================

  /** Get all marketing engine settings */
  getSettings: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { enabled: false, monthlyBudget: 0, autoPublish: false, contentFrequency: "daily" };

    const settings = await db.select().from(marketingSettings);

    const settingsMap: Record<string, string> = {};
    for (const s of settings) {
      settingsMap[s.key] = s.value || "";
    }

    return {
      enabled: settingsMap["enabled"] === "true",
      monthlyBudget: parseFloat(settingsMap["monthly_budget"] || "0"),
      autoPublish: settingsMap["auto_publish"] === "true",
      contentFrequency: settingsMap["content_frequency"] || "daily",
      lastCycleAt: settingsMap["last_cycle_at"] || null,
      totalSpendThisMonth: parseFloat(settingsMap["total_spend_this_month"] || "0"),
    };
  }),

  /** Update marketing engine settings */
  updateSettings: adminProcedure
    .input(
      z.object({
        enabled: z.boolean().optional(),
        monthlyBudget: z.number().min(0).optional(),
        autoPublish: z.boolean().optional(),
        contentFrequency: z.enum(["hourly", "daily", "weekly"]).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const updates: Array<{ key: string; value: string }> = [];
      if (input.enabled !== undefined) updates.push({ key: "enabled", value: String(input.enabled) });
      if (input.monthlyBudget !== undefined) updates.push({ key: "monthly_budget", value: String(input.monthlyBudget) });
      if (input.autoPublish !== undefined) updates.push({ key: "auto_publish", value: String(input.autoPublish) });
      if (input.contentFrequency !== undefined) updates.push({ key: "content_frequency", value: input.contentFrequency });

      for (const { key, value } of updates) {
        const result = await db.update(marketingSettings).set({ value }).where(eq(marketingSettings.key, key));
        if ((result as any)[0]?.affectedRows === 0) {
          await db.insert(marketingSettings).values({ key, value });
        }
      }

      await db.insert(marketingActivityLog).values({
        action: "settings_updated",
        details: input as any,
        status: "success",
      });

      return { success: true };
    }),

  // ============================================
  // CHANNEL MANAGEMENT
  // ============================================

  /** Get status of all advertising channels */
  getChannelStatuses: adminProcedure.query(async () => {
    return getAllChannelStatuses();
  }),

  /** Get only connected channels */
  getConnectedChannels: adminProcedure.query(async () => {
    return getConnectedChannels();
  }),

  // ============================================
  // BUDGET MANAGEMENT
  // ============================================

  /** Get current month's budget and allocations */
  getCurrentBudget: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) return null;

    const currentMonth = new Date().toISOString().substring(0, 7);

    const rows = await db
      .select()
      .from(marketingBudgets)
      .where(eq(marketingBudgets.month, currentMonth))
      .orderBy(desc(marketingBudgets.createdAt))
      .limit(1);

    return rows[0] || null;
  }),

  /** Get budget history */
  getBudgetHistory: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];

    return db
      .select()
      .from(marketingBudgets)
      .orderBy(desc(marketingBudgets.createdAt))
      .limit(12);
  }),

  /** AI-allocate the monthly budget across channels */
  allocateBudget: adminProcedure
    .input(z.object({ monthlyBudget: z.number().min(1) }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const allocations = await allocateBudget({ monthlyBudget: input.monthlyBudget });
      const month = new Date().toISOString().substring(0, 7);

      await db.insert(marketingBudgets).values({
        month,
        totalBudget: Math.round(input.monthlyBudget * 100),
        status: "active",
        allocations: allocations.map((a) => ({
          channel: a.channel,
          amount: Math.round(a.amount * 100),
          reasoning: a.reasoning,
        })),
      });

      await db.insert(marketingActivityLog).values({
        action: "budget_allocated",
        details: { month, totalBudget: input.monthlyBudget, allocations } as any,
        status: "success",
      });

      return { allocations, month };
    }),

  // ============================================
  // CONTENT MANAGEMENT
  // ============================================

  /** Generate content for a specific platform */
  generateContent: adminProcedure
    .input(
      z.object({
        platform: z.enum(["facebook", "instagram", "x_twitter", "linkedin", "snapchat", "blog"]),
        contentType: z.enum(["organic_post", "ad_copy", "blog_article"]),
        topic: z.string().optional(),
        campaignGoal: z.string().optional(),
        includeImage: z.boolean().default(true),
      })
    )
    .mutation(async ({ input }) => {
      const content = await generateContent(input);

      const db = await getDb();
      if (db) {
        await db.insert(marketingActivityLog).values({
          action: "content_generated",
          channel: input.platform,
          details: { type: input.contentType, headline: content.headline } as any,
          status: "success",
        });
      }

      return content;
    }),

  /** Get all generated content */
  listContent: adminProcedure
    .input(
      z.object({
        status: z.enum(["draft", "approved", "published", "failed"]).optional(),
        channel: z.string().optional(),
        limit: z.number().min(1).max(100).default(50),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];

      const conditions = [];
      if (input.status) conditions.push(eq(marketingContent.status, input.status));
      if (input.channel) conditions.push(eq(marketingContent.channel, input.channel as any));

      const query = db
        .select()
        .from(marketingContent)
        .orderBy(desc(marketingContent.createdAt))
        .limit(input.limit);

      if (conditions.length > 0) {
        return query.where(and(...conditions));
      }
      return query;
    }),

  /** Approve or reject content */
  updateContentStatus: adminProcedure
    .input(
      z.object({
        contentId: z.number(),
        status: z.enum(["approved", "draft", "failed"]),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      await db
        .update(marketingContent)
        .set({ status: input.status })
        .where(eq(marketingContent.id, input.contentId));

      return { success: true };
    }),

  // ============================================
  // CAMPAIGN MANAGEMENT
  // ============================================

  /** Create a new AI-planned campaign */
  createCampaign: adminProcedure
    .input(
      z.object({
        goal: z.enum(["awareness", "signups", "engagement", "retention"]),
        budget: z.number().min(1),
        durationDays: z.number().min(1).max(90),
        focusChannels: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const plan = await createCampaignPlan({
        goal: input.goal,
        budget: input.budget,
        durationDays: input.durationDays,
        focusChannels: input.focusChannels as ChannelId[],
      });

      const result = await db.insert(marketingCampaigns).values({
        channel: (plan.channels[0] || "meta") as any,
        name: plan.name,
        status: "draft",
        type: input.goal === "signups" ? "conversion" : input.goal === "awareness" ? "awareness" : "engagement",
        targetAudience: plan.targeting as any,
        dailyBudget: Math.round((input.budget / input.durationDays) * 100),
        totalBudget: Math.round(input.budget * 100),
        startDate: new Date(),
        endDate: new Date(Date.now() + input.durationDays * 24 * 60 * 60 * 1000),
        aiStrategy: JSON.stringify(plan),
      });

      const campaignId = (result as any)[0]?.insertId;

      await db.insert(marketingActivityLog).values({
        action: "campaign_created",
        details: { campaignId, name: plan.name, goal: input.goal, budget: input.budget } as any,
        status: "success",
      });

      return { campaignId, plan };
    }),

  /** List all campaigns */
  listCampaigns: adminProcedure
    .input(
      z.object({
        status: z.enum(["draft", "pending_review", "active", "paused", "completed", "failed"]).optional(),
        limit: z.number().min(1).max(100).default(50),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];

      const query = db
        .select()
        .from(marketingCampaigns)
        .orderBy(desc(marketingCampaigns.createdAt))
        .limit(input.limit);

      if (input.status) {
        return query.where(eq(marketingCampaigns.status, input.status));
      }
      return query;
    }),

  /** Launch a campaign (execute it across platforms) */
  launchCampaign: adminProcedure
    .input(z.object({ campaignId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const rows = await db
        .select()
        .from(marketingCampaigns)
        .where(eq(marketingCampaigns.id, input.campaignId))
        .limit(1);

      const campaign = rows[0];
      if (!campaign) throw new Error("Campaign not found");
      if (!campaign.aiStrategy) throw new Error("Campaign has no AI strategy — create a plan first");

      const plan = JSON.parse(campaign.aiStrategy);
      const budgetAllocations = await allocateBudget({ monthlyBudget: campaign.totalBudget / 100 });

      await db
        .update(marketingCampaigns)
        .set({ status: "active" })
        .where(eq(marketingCampaigns.id, input.campaignId));

      const results = await executeCampaign({
        campaignId: input.campaignId,
        plan,
        budgetAllocations,
      });

      await db.insert(marketingActivityLog).values({
        action: "campaign_launched",
        details: {
          campaignId: input.campaignId,
          contentPublished: results.contentPublished,
          adsCreated: results.adsCreated,
        } as any,
        status: results.contentPublished > 0 || results.adsCreated > 0 ? "success" : "failed",
      });

      return results;
    }),

  /** Pause or resume a campaign */
  updateCampaignStatus: adminProcedure
    .input(
      z.object({
        campaignId: z.number(),
        status: z.enum(["active", "paused", "completed"]),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      await db
        .update(marketingCampaigns)
        .set({ status: input.status })
        .where(eq(marketingCampaigns.id, input.campaignId));

      return { success: true };
    }),

  // ============================================
  // ANALYTICS & PERFORMANCE
  // ============================================

  /** Get performance metrics for a campaign */
  getCampaignPerformance: adminProcedure
    .input(z.object({ campaignId: z.number() }))
    .query(async ({ input }) => {
      return analyzePerformance(input.campaignId);
    }),

  /** Get aggregated performance across all channels */
  getDashboardMetrics: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db)
      return {
        totalSpend: 0,
        totalImpressions: 0,
        totalClicks: 0,
        totalConversions: 0,
        avgCtr: 0,
        avgCpc: 0,
        channelBreakdown: [],
        recentPerformance: [],
      };

    const recentPerformance = await db
      .select()
      .from(marketingPerformance)
      .orderBy(desc(marketingPerformance.date))
      .limit(90);

    let totalSpend = 0;
    let totalImpressions = 0;
    let totalClicks = 0;
    let totalConversions = 0;
    const channelTotals: Record<string, { spend: number; impressions: number; clicks: number; conversions: number }> =
      {};

    for (const p of recentPerformance) {
      totalSpend += p.spend || 0;
      totalImpressions += p.impressions || 0;
      totalClicks += p.clicks || 0;
      totalConversions += p.conversions || 0;

      if (!channelTotals[p.channel]) {
        channelTotals[p.channel] = { spend: 0, impressions: 0, clicks: 0, conversions: 0 };
      }
      channelTotals[p.channel].spend += p.spend || 0;
      channelTotals[p.channel].impressions += p.impressions || 0;
      channelTotals[p.channel].clicks += p.clicks || 0;
      channelTotals[p.channel].conversions += p.conversions || 0;
    }

    const channelBreakdown = Object.entries(channelTotals).map(([channel, totals]) => ({
      channel,
      ...totals,
      ctr: totals.impressions > 0 ? totals.clicks / totals.impressions : 0,
      cpc: totals.clicks > 0 ? totals.spend / totals.clicks / 100 : 0,
    }));

    return {
      totalSpend: totalSpend / 100,
      totalImpressions,
      totalClicks,
      totalConversions,
      avgCtr: totalImpressions > 0 ? totalClicks / totalImpressions : 0,
      avgCpc: totalClicks > 0 ? totalSpend / totalClicks / 100 : 0,
      channelBreakdown,
      recentPerformance: recentPerformance.slice(0, 30),
    };
  }),

  // ============================================
  // ACTIVITY LOG
  // ============================================

  /** Get recent marketing engine activity */
  getActivityLog: adminProcedure
    .input(z.object({ limit: z.number().min(1).max(200).default(50) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];

      return db
        .select()
        .from(marketingActivityLog)
        .orderBy(desc(marketingActivityLog.createdAt))
        .limit(input.limit);
    }),

  // ============================================
  // AUTONOMOUS CYCLE
  // ============================================

  /** Manually trigger an autonomous marketing cycle */
  runCycle: adminProcedure.mutation(async () => {
    const db = await getDb();

    const result = await runAutonomousCycle();

    if (db) {
      await db.insert(marketingActivityLog).values({
        action: "autonomous_cycle",
        details: result as any,
        status: "success",
      });

      const updateResult = await db
        .update(marketingSettings)
        .set({ value: new Date().toISOString() })
        .where(eq(marketingSettings.key, "last_cycle_at"));
      if ((updateResult as any)[0]?.affectedRows === 0) {
        await db.insert(marketingSettings).values({ key: "last_cycle_at", value: new Date().toISOString() });
      }
    }

    return result;
  }),
});
