/**
 * Affiliate Marketing tRPC Router
 * 
 * Endpoints:
 * - Admin: partner CRUD, stats, outreach, optimization, payouts
 * - Admin: autonomous discovery management, kill switch, promote
 * - User: referral code, referral info, contextual recommendations, click tracking
 */

import { z } from "zod";
import { router, publicProcedure, protectedProcedure, adminProcedure, TRPCError } from "./_core/trpc";
import { checkCredits, consumeCredits } from "./credit-service";
import {
  seedAffiliatePrograms,
  generateReferralCode,
  trackReferralSignup,
  trackAffiliateClick,
  trackConversion,
  getContextualRecommendations,
  getAffiliateStats,
  generateOutreachEmail,
  analyzePartnerPerformance,
  runAffiliateOptimizationCycle,
  getReferralLeaderboard,
  getPartners,
  createPartner,
  updatePartner,
  getUserReferralInfo,
  getUserReferralDashboard,
  requestReferralPayout,
  recordReferralCommission,
  getPartnerOutreach,
  getPayoutHistory,
  REFERRAL_CONFIG,
  CONTEXTUAL_PLACEMENTS,
  generateBulkOutreach,
} from "./affiliate-engine";
import {
  runDiscoveryCycle,
  getDiscoveries,
  getDiscoveryRuns,
  getDiscoveryApplications,
  getDiscoveryStats,
  promoteDiscoveryToPartner,
  triggerKillSwitch,
  resetKillSwitch,
  isDiscoveryKilled,
} from "./affiliate-discovery-engine";
import {
  runSignupBatch,
  getSignupStats,
  triggerSignupKillSwitch,
  resetSignupKillSwitch,
  isSignupKilled,
} from "./affiliate-signup-engine";
import {
  calculatePartnerEPCs,
  getSmartRecommendations,
  trackClickWithFraudCheck,
  getRevenueAnalytics,
  generateSmartLink,
  getConversionSignals,
  getSeasonalMultiplier,
  getEnhancedReferralInfo,
  generateRevenueForecast,
  runOptimizationCycleV2,
  aiScorePartner,
  MILESTONE_BONUSES,
  TWO_SIDED_REWARDS,
  AFFILIATE_V2_VERSION,
  AFFILIATE_V2_FEATURES,
} from "./affiliate-engine-v2";

export const affiliateRouter = router({
  // ─── Admin: Stats & Dashboard ───────────────────────────────────
  getStats: adminProcedure.query(async () => {
    return await getAffiliateStats();
  }),

  // ─── Admin: Partner Management ──────────────────────────────────
  listPartners: adminProcedure
    .input(z.object({
      status: z.string().optional(),
      vertical: z.string().optional(),
    }).optional())
    .query(async ({ input }) => {
      return await getPartners(input);
    }),

  getPartner: adminProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const partners = await getPartners();
      return partners.find(p => p.id === input.id) || null;
    }),

  createPartner: adminProcedure
    .input(z.object({
      name: z.string().min(1),
      domain: z.string().optional(),
      contactEmail: z.string().email().optional(),
      vertical: z.enum(["ai_tools", "hosting", "dev_tools", "security", "vpn", "crypto", "saas", "education", "other"]).default("other"),
      commissionType: z.enum(["revshare", "cpa", "hybrid", "cpm", "cpc"]).default("cpa"),
      commissionRate: z.number().min(0).default(20),
      affiliateUrl: z.string().optional(),
      applicationUrl: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const id = await createPartner(input);
      return { id, success: true };
    }),

  updatePartner: adminProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().optional(),
      domain: z.string().optional(),
      contactEmail: z.string().optional(),
      vertical: z.enum(["ai_tools", "hosting", "dev_tools", "security", "vpn", "crypto", "saas", "education", "other"]).optional(),
      commissionType: z.enum(["revshare", "cpa", "hybrid", "cpm", "cpc"]).optional(),
      commissionRate: z.number().optional(),
      affiliateUrl: z.string().optional(),
      status: z.enum(["prospect", "applied", "active", "paused", "rejected", "churned"]).optional(),
      tier: z.enum(["bronze", "silver", "gold", "platinum"]).optional(),
    }))
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      await updatePartner(id, data);
      return { success: true };
    }),

  // ─── Admin: Seed Programs ───────────────────────────────────────
  seedPrograms: adminProcedure.mutation(async () => {
    const count = await seedAffiliatePrograms();
    return { seeded: count, success: true };
  }),

  // ─── Admin: AI Outreach ─────────────────────────────────────────
  generateOutreach: adminProcedure
    .input(z.object({ partnerId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const creditCheck = await checkCredits(ctx.user.id, "affiliate_action");
      if (!creditCheck.allowed) {
        throw new Error(`Insufficient credits for outreach generation. Need ${creditCheck.cost}, have ${creditCheck.currentBalance}.`);
      }
      const email = await generateOutreachEmail(input.partnerId);
      const _cr4 = await consumeCredits(ctx.user.id, "affiliate_action", `Affiliate outreach generated for partner #${input.partnerId}`);
      if (!_cr4.success) throw new TRPCError({ code: "FORBIDDEN", message: "Insufficient credits. Purchase more credits or upgrade your plan." });
      return { ...email, success: true };
    }),

  generateBulkOutreach: adminProcedure.mutation(async ({ ctx }) => {
    const creditCheck = await checkCredits(ctx.user.id, "affiliate_action");
    if (!creditCheck.allowed) {
      throw new Error(`Insufficient credits for bulk outreach. Need ${creditCheck.cost}, have ${creditCheck.currentBalance}.`);
    }
    const count = await generateBulkOutreach();
    const _cr5 = await consumeCredits(ctx.user.id, "affiliate_action", `Affiliate bulk outreach generated: ${count} emails`);
    if (!_cr5.success) throw new TRPCError({ code: "FORBIDDEN", message: "Insufficient credits. Purchase more credits or upgrade your plan." });
    return { generated: count, success: true };
  }),

  getOutreach: adminProcedure
    .input(z.object({ partnerId: z.number() }))
    .query(async ({ input }) => {
      return await getPartnerOutreach(input.partnerId);
    }),

  // ─── Admin: Performance Analysis ────────────────────────────────────
  analyzePartner: adminProcedure
    .input(z.object({ partnerId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const creditCheck = await checkCredits(ctx.user.id, "affiliate_action");
      if (!creditCheck.allowed) {
        throw new Error(`Insufficient credits for partner analysis. Need ${creditCheck.cost}, have ${creditCheck.currentBalance}.`);
      }
      const result = await analyzePartnerPerformance(input.partnerId);
      const _cr6 = await consumeCredits(ctx.user.id, "affiliate_action", `Affiliate partner #${input.partnerId} performance analysis`);
      if (!_cr6.success) throw new TRPCError({ code: "FORBIDDEN", message: "Insufficient credits. Purchase more credits or upgrade your plan." });
      return result;
    }),

  // ─── Admin: Autonomous Optimization ─────────────────────────────────
  runOptimization: adminProcedure.mutation(async ({ ctx }) => {
    const creditCheck = await checkCredits(ctx.user.id, "affiliate_action");
    if (!creditCheck.allowed) {
      throw new Error(`Insufficient credits for optimization cycle. Need ${creditCheck.cost}, have ${creditCheck.currentBalance}.`);
    }
    const result = await runAffiliateOptimizationCycle();
    const _cr1 = await consumeCredits(ctx.user.id, "affiliate_action", "Affiliate optimization cycle run");
    if (!_cr1.success) throw new TRPCError({ code: "FORBIDDEN", message: "Insufficient credits. Purchase more credits or upgrade your plan." });
    return result;
  }),

  // ─── Admin: Payouts ─────────────────────────────────────────────
  getPayouts: adminProcedure
    .input(z.object({ limit: z.number().min(1).max(100).default(20) }).optional())
    .query(async ({ input }) => {
      return await getPayoutHistory(input?.limit);
    }),

  // ─── Admin: Track Conversion (webhook or manual) ────────────────
  trackConversion: adminProcedure
    .input(z.object({
      clickId: z.string(),
      commissionCents: z.number().min(0),
    }))
    .mutation(async ({ input }) => {
      await trackConversion(input.clickId, input.commissionCents);
      return { success: true };
    }),

  // ═══════════════════════════════════════════════════════════════════
  // ─── AUTONOMOUS DISCOVERY ENGINE ──────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════

  // ─── Admin: Discovery Stats ─────────────────────────────────────
  getDiscoveryStats: adminProcedure.query(async () => {
    return await getDiscoveryStats();
  }),

  // ─── Admin: Run Discovery Manually ──────────────────────────────
  runDiscovery: adminProcedure.mutation(async ({ ctx }) => {
    const creditCheck = await checkCredits(ctx.user.id, "affiliate_action");
    if (!creditCheck.allowed) {
      throw new Error(`Insufficient credits for discovery cycle. Need ${creditCheck.cost}, have ${creditCheck.currentBalance}.`);
    }
    const result = await runDiscoveryCycle("manual");
    const _cr2 = await consumeCredits(ctx.user.id, "affiliate_action", "Affiliate discovery cycle run");
    if (!_cr2.success) throw new TRPCError({ code: "FORBIDDEN", message: "Insufficient credits. Purchase more credits or upgrade your plan." });
    return result;
  }),

  // ─── Admin: List Discoveries ────────────────────────────────────
  listDiscoveries: adminProcedure
    .input(z.object({
      status: z.string().optional(),
      vertical: z.string().optional(),
      minScore: z.number().optional(),
      batchId: z.string().optional(),
      limit: z.number().min(1).max(200).default(100),
    }).optional())
    .query(async ({ input }) => {
      return await getDiscoveries(input || undefined);
    }),

  // ─── Admin: Discovery Run History ───────────────────────────────
  listDiscoveryRuns: adminProcedure
    .input(z.object({ limit: z.number().min(1).max(50).default(20) }).optional())
    .query(async ({ input }) => {
      return await getDiscoveryRuns(input?.limit);
    }),

  // ─── Admin: Get Applications for a Discovery ───────────────────
  getDiscoveryApplications: adminProcedure
    .input(z.object({ discoveryId: z.number() }))
    .query(async ({ input }) => {
      return await getDiscoveryApplications(input.discoveryId);
    }),

  // ─── Admin: Promote Discovery to Partner ────────────────────────
  promoteDiscovery: adminProcedure
    .input(z.object({ discoveryId: z.number() }))
    .mutation(async ({ input }) => {
      const partnerId = await promoteDiscoveryToPartner(input.discoveryId);
      return { partnerId, success: true };
    }),

  // ─── Admin: Kill Switch ─────────────────────────────────────────
  discoveryKillSwitch: adminProcedure
    .input(z.object({ code: z.string(), action: z.enum(["kill", "reset"]) }))
    .mutation(async ({ input }) => {
      if (input.action === "kill") {
        const success = triggerKillSwitch(input.code);
        return { success, message: success ? "Discovery engine killed" : "Invalid kill switch code" };
      } else {
        const success = resetKillSwitch(input.code);
        return { success, message: success ? "Discovery engine resumed" : "Invalid kill switch code" };
      }
    }),

  // ─── Admin: Discovery Status ────────────────────────────────────
  getDiscoveryStatus: adminProcedure.query(() => {
    return {
      isKilled: isDiscoveryKilled(),
      isSignupKilled: isSignupKilled(),
      schedule: "Every Wednesday and Saturday at 6 AM UTC",
      killSwitchCode: "Contact admin for kill switch code",
    };
  }),

  // ═══════════════════════════════════════════════════════════════════
  // ─── AUTONOMOUS SIGNUP ENGINE ─────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════

  // ─── Admin: Run Signup Batch ─────────────────────────────────────
  runSignupBatch: adminProcedure
    .input(z.object({
      limit: z.number().min(1).max(50).default(10),
      discoveryIds: z.array(z.number()).optional(),
    }).optional())
    .mutation(async ({ input, ctx }) => {
      const creditCheck = await checkCredits(ctx.user.id, "affiliate_action");
      if (!creditCheck.allowed) {
        throw new Error(`Insufficient credits for signup batch. Need ${creditCheck.cost}, have ${creditCheck.currentBalance}.`);
      }
      const result = await runSignupBatch({
        limit: input?.limit,
        discoveryIds: input?.discoveryIds,
        adminUserId: ctx.user.id,
      });
      const _cr7 = await consumeCredits(ctx.user.id, "affiliate_action", `Affiliate signup batch run (limit: ${input?.limit ?? 10})`);
      if (!_cr7.success) throw new TRPCError({ code: "FORBIDDEN", message: "Insufficient credits. Purchase more credits or upgrade your plan." });
      return result;
    }),

  // ─── Admin: Signup Stats ───────────────────────────────────────
  getSignupStats: adminProcedure.query(async () => {
    return await getSignupStats();
  }),

  // ─── Admin: Signup Kill Switch ─────────────────────────────────
  signupKillSwitch: adminProcedure
    .input(z.object({ action: z.enum(["kill", "reset"]) }))
    .mutation(async ({ input }) => {
      if (input.action === "kill") {
        triggerSignupKillSwitch();
        return { success: true, message: "Signup engine killed" };
      } else {
        resetSignupKillSwitch();
        return { success: true, message: "Signup engine resumed" };
      }
    }),

  // ─── User: Referral Program ─────────────────────────────────────
  getMyReferralInfo: protectedProcedure.query(async ({ ctx }) => {
    return await getUserReferralInfo(ctx.user.id);
  }),

  // ─── User: Full Referral Dashboard ─────────────────────────────
  getMyReferralDashboard: protectedProcedure.query(async ({ ctx }) => {
    return await getUserReferralDashboard(ctx.user.id);
  }),

  generateMyReferralCode: protectedProcedure.mutation(async ({ ctx }) => {
    const code = await generateReferralCode(ctx.user.id);
    return { code, success: true };
  }),

  // ─── User: Request Payout ──────────────────────────────────────
  requestPayout: protectedProcedure
    .input(z.object({
      method: z.enum(["wire_transfer", "credits"]),
    }))
    .mutation(async ({ input, ctx }) => {
      return await requestReferralPayout(ctx.user.id, input.method);
    }),

  // ─── Admin: Record Commission (from Stripe webhook) ────────────
  recordCommission: adminProcedure
    .input(z.object({
      referredUserId: z.number(),
      paymentAmountCents: z.number(),
      subscriptionId: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      return await recordReferralCommission(
        input.referredUserId,
        input.paymentAmountCents,
        input.subscriptionId
      );
    }),

  // ─── Public: Track Referral Signup ──────────────────────────────
  trackReferral: publicProcedure
    .input(z.object({
      referralCode: z.string(),
      newUserId: z.number(),
    }))
    .mutation(async ({ input }) => {
      return await trackReferralSignup(input.referralCode, input.newUserId);
    }),

  // ─── Public: Referral Leaderboard ───────────────────────────────
  getLeaderboard: publicProcedure
    .input(z.object({ limit: z.number().min(1).max(50).default(10) }).optional())
    .query(async ({ input }) => {
      return await getReferralLeaderboard(input?.limit);
    }),

  // ─── Public: Contextual Recommendations ─────────────────────────
  getRecommendations: publicProcedure
    .input(z.object({
      context: z.string(),
      limit: z.number().min(1).max(10).default(3),
    }))
    .query(async ({ input }) => {
      return await getContextualRecommendations(input.context, input.limit);
    }),

  // ─── Public: Track Click ────────────────────────────────────────
  trackClick: publicProcedure
    .input(z.object({
      partnerId: z.number(),
      userId: z.number().optional(),
      utmSource: z.string().optional(),
      utmMedium: z.string().optional(),
      utmCampaign: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const clickId = await trackAffiliateClick({
        partnerId: input.partnerId,
        userId: input.userId,
        ipAddress: ctx.req.ip,
        userAgent: ctx.req.headers["user-agent"],
        referrer: ctx.req.headers["referer"],
        utmSource: input.utmSource,
        utmMedium: input.utmMedium,
        utmCampaign: input.utmCampaign,
      });
      return { clickId, success: true };
    }),

  // ─── Public: Config ─────────────────────────────────────────────
  getReferralConfig: publicProcedure.query(() => {
    return {
      referralsForDiscount: REFERRAL_CONFIG.referralsForDiscount,
      discountPercent: REFERRAL_CONFIG.discountPercent,
      discountOneTime: REFERRAL_CONFIG.discountOneTime,
      baseCommissionPercent: REFERRAL_CONFIG.baseCommissionPercent,
      commissionDurationMonths: REFERRAL_CONFIG.commissionDurationMonths,
      minPayoutCents: REFERRAL_CONFIG.minPayoutCents,
      creditBonusMultiplier: REFERRAL_CONFIG.creditBonusMultiplier,
      tiers: REFERRAL_CONFIG.tiers,
      contexts: Object.keys(CONTEXTUAL_PLACEMENTS),
    };
  }),

  // ═══════════════════════════════════════════════════════════════════
  // ─── AFFILIATE ENGINE V2 — MAXIMUM PROFITABILITY ──────────────────
  // ═══════════════════════════════════════════════════════════════════

  // ─── Admin: Revenue Analytics Dashboard ────────────────────────────
  getRevenueAnalytics: adminProcedure.query(async () => {
    return await getRevenueAnalytics();
  }),

  // ─── Admin: Partner EPC Rankings ──────────────────────────────────
  getPartnerEPCs: adminProcedure.query(async () => {
    return await calculatePartnerEPCs();
  }),

  // ─── Admin: Revenue Forecast ──────────────────────────────────────
  getRevenueForecast: adminProcedure.query(async () => {
    return await generateRevenueForecast();
  }),

  // ─── Admin: AI Score Partner ──────────────────────────────────────────
  aiScorePartner: adminProcedure
    .input(z.object({
      name: z.string(),
      domain: z.string(),
      vertical: z.string(),
      commissionType: z.string(),
      commissionRate: z.number(),
      description: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const creditCheck = await checkCredits(ctx.user.id, "affiliate_action");
      if (!creditCheck.allowed) {
        throw new Error(`Insufficient credits for AI partner scoring. Need ${creditCheck.cost}, have ${creditCheck.currentBalance}.`);
      }
      const result = await aiScorePartner(input);
      const _cr8 = await consumeCredits(ctx.user.id, "affiliate_action", `AI scored affiliate partner: ${input.name}`);
      if (!_cr8.success) throw new TRPCError({ code: "FORBIDDEN", message: "Insufficient credits. Purchase more credits or upgrade your plan." });
      return result;
    }),

  // ─── Admin: Run v2 Optimization Cycle ─────────────────────────────────
  runOptimizationV2: adminProcedure.mutation(async ({ ctx }) => {
    const creditCheck = await checkCredits(ctx.user.id, "affiliate_action");
    if (!creditCheck.allowed) {
      throw new Error(`Insufficient credits for v2 optimization cycle. Need ${creditCheck.cost}, have ${creditCheck.currentBalance}.`);
    }
    const result = await runOptimizationCycleV2();
    const _cr3 = await consumeCredits(ctx.user.id, "affiliate_action", "Affiliate v2 optimization cycle run");
    if (!_cr3.success) throw new TRPCError({ code: "FORBIDDEN", message: "Insufficient credits. Purchase more credits or upgrade your plan." });
    return result;
  }),

  // ─── Admin: v2 System Info ────────────────────────────────────────────
  getV2Info: adminProcedure.query(() => {
    const seasonal = getSeasonalMultiplier();
    return {
      version: AFFILIATE_V2_VERSION,
      features: AFFILIATE_V2_FEATURES,
      seasonalMultiplier: seasonal,
      milestoneBonuses: MILESTONE_BONUSES,
      twoSidedRewards: TWO_SIDED_REWARDS,
    };
  }),

  // ─── User: Enhanced Referral Dashboard ─────────────────────────────
  getMyEnhancedReferral: protectedProcedure.query(async ({ ctx }) => {
    return await getEnhancedReferralInfo(ctx.user.id);
  }),

  // ─── Public: Smart Recommendations (EPC-weighted) ─────────────────
  getSmartRecommendations: publicProcedure
    .input(z.object({
      context: z.string(),
      limit: z.number().min(1).max(10).default(3),
      userId: z.number().optional(),
    }))
    .query(async ({ input }) => {
      return await getSmartRecommendations(input.context, input.limit, input.userId);
    }),

  // ─── Public: Track Click with Fraud Prevention ────────────────────
  trackClickV2: publicProcedure
    .input(z.object({
      partnerId: z.number(),
      userId: z.number().optional(),
      utmSource: z.string().optional(),
      utmMedium: z.string().optional(),
      utmCampaign: z.string().optional(),
      subId: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      return await trackClickWithFraudCheck({
        partnerId: input.partnerId,
        userId: input.userId,
        ipAddress: ctx.req.ip,
        userAgent: ctx.req.headers["user-agent"],
        referrer: ctx.req.headers["referer"],
        utmSource: input.utmSource,
        utmMedium: input.utmMedium,
        utmCampaign: input.utmCampaign,
        subId: input.subId,
      });
    }),

  // ─── Public: Conversion Signals ───────────────────────────────────
  getConversionSignals: publicProcedure
    .input(z.object({
      context: z.string(),
      userId: z.number().optional(),
    }))
    .query(async ({ input }) => {
      return await getConversionSignals(input.context, input.userId);
    }),

  // ─── Public: Smart Link Generator ─────────────────────────────────
  generateSmartLink: publicProcedure
    .input(z.object({
      partnerId: z.number(),
      affiliateUrl: z.string(),
      placement: z.string(),
      userId: z.number().optional(),
      deepLinkPath: z.string().optional(),
    }))
    .query(({ input }) => {
      return generateSmartLink(input);
    }),

  // ─── Public: Seasonal Info ────────────────────────────────────────
  getSeasonalInfo: publicProcedure.query(() => {
    return getSeasonalMultiplier();
  }),
});
