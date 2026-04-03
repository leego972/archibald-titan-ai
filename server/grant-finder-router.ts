import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { invokeLLM } from "./_core/llm";
import { getProviderParams } from "./_core/provider-policy";
import { getUserOpenAIKey } from "./user-secrets-router";
import { TRPCError } from "@trpc/server";
import * as db from "./db";
import { refreshGrantsForCountry, refreshAllGrants, getSupportedCountries } from "./grant-refresh-service";
import { seedExternalCampaigns, getSourceStats } from "./crowdfunding-aggregator";
import {
  isBinancePayConfigured,
  generateMerchantTradeNo,
  calculatePlatformFee,
  createCryptoPaymentOrder,
  queryOrderStatus,
  getFallbackCryptoInfo,
  PLATFORM_FEE_PERCENT,
  SUPPORTED_CRYPTO,
} from "./binance-pay-service";
import Stripe from "stripe";
import { ENV } from "./_core/env.js";
import { promoteCampaign } from "./crowdfunding-promoter.js";
import { createLogger } from "./_core/logger.js";
import { getErrorMessage } from "./_core/errors.js";
import { isAdminRole } from '@shared/const';
import { consumeCredits, checkCredits } from "./credit-service";
const log = createLogger("GrantFinderRouter");

// ==========================================
// NO MORE FAKE SEED DATA
// All grants come from real government APIs
// ==========================================

// ==========================================
// HELPER FUNCTIONS
// ==========================================
function extractSection(text: string, sectionName: string): string {
  const patterns = [
    new RegExp(`##\\s*${sectionName}[\\s\\S]*?(?=##\\s|$)`, 'i'),
    new RegExp(`\\*\\*${sectionName}\\*\\*[\\s\\S]*?(?=\\*\\*|$)`, 'i'),
    new RegExp(`${sectionName}:\\s*([\\s\\S]*?)(?=\\n\\n|$)`, 'i'),
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[0].replace(/^##\s*\w+\s*/, '').trim();
  }
  return '';
}

// ==========================================
// ROUTERS
// ==========================================

export const companyRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return db.getCompaniesByUser(ctx.user.id);
  }),
  get: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
    return db.getCompanyById(input.id);
  }),
  create: protectedProcedure.input(z.object({
    name: z.string().min(1),
    industry: z.string().optional(),
    technologyArea: z.string().optional(),
    employeeCount: z.number().optional(),
    annualRevenue: z.number().optional(),
    foundedYear: z.number().optional(),
    location: z.string().optional(),
    minorityOwned: z.number().optional(),
    womenOwned: z.number().optional(),
    veteranOwned: z.number().optional(),
  })).mutation(async ({ ctx, input }) => {
    return db.createCompany({ ...input, userId: ctx.user.id });
  }),
  update: protectedProcedure.input(z.object({
    id: z.number(),
    name: z.string().optional(),
    industry: z.string().optional(),
    technologyArea: z.string().optional(),
    employeeCount: z.number().optional(),
    annualRevenue: z.number().optional(),
    foundedYear: z.number().optional(),
    location: z.string().optional(),
    minorityOwned: z.number().optional(),
    womenOwned: z.number().optional(),
    veteranOwned: z.number().optional(),
  })).mutation(async ({ input }) => {
    const { id, ...data } = input;
    await db.updateCompany(id, data);
    return { success: true };
  }),
  delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
    await db.deleteCompany(input.id);
    return { success: true };
  }),
});

export const businessPlanRouter = router({
  list: protectedProcedure.input(z.object({ companyId: z.number() })).query(async ({ input }) => {
    return db.getBusinessPlansByCompany(input.companyId);
  }),
  get: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
    return db.getBusinessPlanById(input.id);
  }),
  generate: protectedProcedure.input(z.object({
    companyId: z.number(),
    projectTitle: z.string(),
    projectDescription: z.string(),
    targetMarket: z.string().optional(),
    competitiveAdvantage: z.string().optional(),
  })).mutation(async ({ input, ctx }) => {
    const creditCheck = await checkCredits(ctx.user.id, "business_plan_generate");
    if (!creditCheck.allowed) {
      throw new TRPCError({ code: "FORBIDDEN", message: `Insufficient credits. Need ${creditCheck.cost}, have ${creditCheck.currentBalance}.` });
    }
    try { await consumeCredits(ctx.user.id, "business_plan_generate", "Business plan generation"); } catch {}
    const company = await db.getCompanyById(input.companyId);
    if (!company) throw new TRPCError({ code: "NOT_FOUND", message: "Company not found" });
    const userApiKey = await getUserOpenAIKey(ctx.user.id) || undefined;

    const prompt = `Generate a comprehensive business plan for a grant application.

Company: ${company.name}
Industry: ${company.industry || 'Not specified'}
Technology Area: ${company.technologyArea || 'Not specified'}
Employees: ${company.employeeCount || 'Not specified'}
Annual Revenue: ${company.annualRevenue ? '$' + company.annualRevenue.toLocaleString() : 'Not specified'}
Location: ${company.location || 'Not specified'}

Project: ${input.projectTitle}
Description: ${input.projectDescription}
Target Market: ${input.targetMarket || 'Not specified'}
Competitive Advantage: ${input.competitiveAdvantage || 'Not specified'}

Generate the following sections with detailed, professional content:
## Executive Summary
## Technology Description
## Market Analysis
## Competitive Analysis
## Team Qualifications
## Research Plan
## Commercialization Strategy
## Financial Projections
## IP Strategy`;

    const response = await invokeLLM({
      ...getProviderParams("grant_plan_generation"),
      userApiKey,
      messages: [{ role: "user", content: prompt }] });
    const content = String(response.choices[0]?.message?.content || '');

    const plan = {
      companyId: input.companyId,
      title: input.projectTitle,
      executiveSummary: extractSection(content, 'Executive Summary') || content.substring(0, 500),
      technologyDescription: extractSection(content, 'Technology Description'),
      marketAnalysis: extractSection(content, 'Market Analysis'),
      competitiveAnalysis: extractSection(content, 'Competitive Analysis'),
      teamQualifications: extractSection(content, 'Team Qualifications'),
      researchPlan: extractSection(content, 'Research Plan'),
      commercializationStrategy: extractSection(content, 'Commercialization Strategy'),
      financialProjections: extractSection(content, 'Financial Projections'),
      ipStrategy: extractSection(content, 'IP Strategy'),
      status: "completed" as const,
    };

    return db.createBusinessPlan(plan);
  }),
});

export const grantRouter = router({
  list: publicProcedure.input(z.object({
    region: z.string().optional(),
    agency: z.string().optional(),
    minAmount: z.number().optional(),
    maxAmount: z.number().optional(),
    status: z.string().optional(),
    search: z.string().optional(),
  }).optional()).query(async ({ input }) => {
    return db.listGrantOpportunities(input || {});
  }),
  get: publicProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
    return db.getGrantOpportunityById(input.id);
  }),
  match: protectedProcedure.input(z.object({ companyId: z.number() })).mutation(async ({ input, ctx }) => {
    try { await consumeCredits(ctx.user.id, "grant_match", "Grant matching analysis"); } catch {}
    const company = await db.getCompanyById(input.companyId);
    if (!company) throw new TRPCError({ code: "NOT_FOUND", message: "Company not found" });
    const userApiKey = await getUserOpenAIKey(ctx.user.id) || undefined;

    const allGrants = await db.listGrantOpportunities();

    // Smart filtering: prioritize grants matching the company's region, then include global/nearby
    const companyLocation = (company.location || '').toLowerCase();
    let regionHints: string[] = [];
    if (companyLocation.includes('united kingdom') || companyLocation.includes('london') || companyLocation.includes('uk')) {
      regionHints = ['United Kingdom', 'European Union'];
    } else if (companyLocation.includes('australia') || companyLocation.includes('sydney') || companyLocation.includes('melbourne')) {
      regionHints = ['Australia', 'New Zealand'];
    } else if (companyLocation.includes('united states') || companyLocation.includes('usa') || companyLocation.includes('new york') || companyLocation.includes('san francisco')) {
      regionHints = ['United States', 'Canada'];
    } else if (companyLocation.includes('canada')) {
      regionHints = ['Canada', 'United States'];
    } else if (companyLocation.includes('singapore')) {
      regionHints = ['Singapore'];
    } else if (companyLocation.includes('israel')) {
      regionHints = ['Israel'];
    }

    // Filter to relevant regions (max ~40 grants per batch), fall back to all if no region match
    let grants = regionHints.length > 0
      ? allGrants.filter((g: any) => regionHints.some(r => (g.region || '').includes(r)))
      : allGrants;
    if (grants.length === 0) grants = allGrants;

    // Batch into chunks of 40 to avoid token limits
    const BATCH_SIZE = 40;
    let allMatches: any[] = [];

    for (let i = 0; i < grants.length; i += BATCH_SIZE) {
      const batch = grants.slice(i, i + BATCH_SIZE);
      const prompt = `Analyze this company and score each grant opportunity for fit.

Company: ${company.name}
Industry: ${company.industry || 'General'}
Technology: ${company.technologyArea || 'General'}
Employees: ${company.employeeCount || 'Unknown'}
Revenue: ${company.annualRevenue || 'Unknown'}
Location: ${company.location || 'Unknown'}
Minority-owned: ${company.minorityOwned ? 'Yes' : 'No'}
Women-owned: ${company.womenOwned ? 'Yes' : 'No'}
Veteran-owned: ${company.veteranOwned ? 'Yes' : 'No'}

For each grant, provide a JSON array with objects containing:
- grantId (number)
- matchScore (0-100)
- eligibilityScore (0-100)
- alignmentScore (0-100)
- competitivenessScore (0-100)
- reason (string, max 100 chars)
- successProbability (0-100)

Grants:
${batch.map((g: any) => `ID:${g.id} - ${g.agency}: ${g.title} ($${g.minAmount}-$${g.maxAmount})`).join('\n')}

Return ONLY a JSON object with a "matches" array.`;

      try {
        const response = await invokeLLM({
          ...getProviderParams("grant_matching"),
          userApiKey,
          messages: [{ role: "user", content: prompt }],
          response_format: { type: "json_object" } as any,
        });
        const content = String(response.choices[0]?.message?.content || '{}');
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed.matches)) {
          allMatches = [...allMatches, ...parsed.matches];
        }
      } catch (err) {
        log.warn('Grant matching batch failed', { error: getErrorMessage(err) });
      }
    }

    const sorted = allMatches.sort((a: any, b: any) => b.matchScore - a.matchScore).slice(0, 20);
    return { matchCount: sorted.length, matches: sorted };
  }),
  submitApplication: protectedProcedure.input(z.object({
    grantId: z.number(),
    companyId: z.number(),
    businessPlanId: z.number().optional(),
  })).mutation(async ({ input, ctx }) => {
    try { await consumeCredits(ctx.user.id, "grant_apply", "Grant application"); } catch {}
    const grant = await db.getGrantOpportunityById(input.grantId);
    if (!grant) throw new TRPCError({ code: "NOT_FOUND", message: "Grant not found" });
    const company = await db.getCompanyById(input.companyId);
    if (!company) throw new TRPCError({ code: "NOT_FOUND", message: "Company not found" });
    return db.createGrantApplication({
      grantOpportunityId: input.grantId,
      companyId: input.companyId,
      businessPlanId: input.businessPlanId,
      status: "draft",
    });
  }),
  applications: protectedProcedure.query(async ({ ctx }) => {
    return db.getGrantApplicationsByUser(ctx.user.id);
  }),
  updateApplication: protectedProcedure.input(z.object({
    id: z.number(),
    status: z.enum(["draft", "ready", "submitted", "under_review", "awarded", "rejected"]).optional(),
    notes: z.string().optional(),
  })).mutation(async ({ input }) => {
    const { id, ...data } = input;
    await db.updateGrantApplication(id, data as any);
    return { success: true };
  }),
  refresh: protectedProcedure.input(z.object({
    country: z.string().optional(),
  })).mutation(async ({ input, ctx }) => {
    if (!isAdminRole(ctx.user.role)) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
    }
    if (input.country) {
      return refreshGrantsForCountry(input.country);
    }
    return refreshAllGrants();
  }),
  supportedCountries: publicProcedure.query(async () => {
    return getSupportedCountries();
  }),
});

export const crowdfundingRouter = router({
  list: publicProcedure.input(z.object({
    status: z.string().optional(),
    category: z.string().optional(),
    source: z.string().optional(),
    search: z.string().optional(),
    userId: z.number().optional(),
    limit: z.number().optional(),
    offset: z.number().optional(),
    sort: z.string().optional(),
  }).optional()).query(async ({ input }) => {
    return db.listCampaigns(input || {});
  }),
  get: publicProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
    return db.getCampaignById(input.id);
  }),
  create: protectedProcedure.input(z.object({
    title: z.string().min(1),
    description: z.string().min(1),
    story: z.string().optional(),
    goalAmount: z.number().min(1),
    category: z.string().optional(),
    imageUrl: z.string().optional(),
    videoUrl: z.string().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    tags: z.array(z.string()).optional(),
    rewards: z.array(z.object({
      title: z.string(),
      description: z.string(),
      minAmount: z.number(),
      estimatedDelivery: z.string().optional(),
      maxBackers: z.number().optional(),
    })).optional(),
  })).mutation(async ({ ctx, input }) => {
    const { rewards: _rewards, startDate: _sd, endDate: _ed, ...campaignInput } = input;
    const now = new Date();
    const campaign = await db.createCampaign({
      ...campaignInput,
      slug: campaignInput.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 200) + "-" + Date.now(),
      userId: ctx.user.id,
      status: "active",
      source: "internal",
      currentAmount: 0,
      backerCount: 0,
      percentFunded: 0,
      startDate: input.startDate ? new Date(input.startDate) : now,
      endDate: input.endDate ? new Date(input.endDate) : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
    });
    // Auto-promote on launch (fire-and-forget, non-blocking)
    promoteCampaign(campaign as any, "launch").catch((err: unknown) => {
      log.warn("Campaign launch promotion failed (non-fatal)", { error: getErrorMessage(err) });
    });
    return campaign;
  }),
  update: protectedProcedure.input(z.object({
    id: z.number(),
    title: z.string().optional(),
    description: z.string().optional(),
    story: z.string().optional(),
    goalAmount: z.number().optional(),
    category: z.string().optional(),
    imageUrl: z.string().optional(),
    videoUrl: z.string().optional(),
    endDate: z.string().optional(),
    status: z.enum(["draft", "active", "funded", "ended", "cancelled"]).optional(),
  })).mutation(async ({ ctx, input }) => {
    const campaign = await db.getCampaignById(input.id);
    if (!campaign) throw new TRPCError({ code: "NOT_FOUND", message: "Campaign not found" });
    if ((campaign as any).userId !== ctx.user.id && !isAdminRole(ctx.user.role)) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Not authorised to update this campaign" });
    }
    const { id, ...data } = input;
    await db.updateCampaign(id, data as any);
    return { success: true };
  }),
  delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
    const campaign = await db.getCampaignById(input.id);
    if (!campaign) throw new TRPCError({ code: "NOT_FOUND", message: "Campaign not found" });
    if ((campaign as any).userId !== ctx.user.id && !isAdminRole(ctx.user.role)) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Not authorised to delete this campaign" });
    }
    await db.deleteCampaign(input.id);
    return { success: true };
  }),
  stats: publicProcedure.query(async () => {
    return db.getCrowdfundingStats();
  }),
  sourceStats: publicProcedure.query(async () => {
    const campaigns = await db.listCampaigns();
    return getSourceStats(campaigns);
  }),
  generateStory: protectedProcedure.input(z.object({
    title: z.string(),
    description: z.string(),
    category: z.string().optional(),
    goalAmount: z.number(),
  })).mutation(async ({ ctx, input }) => {
    const creditCheck = await checkCredits(ctx.user.id, "grant_match");
    if (!creditCheck.allowed) {
      throw new TRPCError({ code: "BAD_REQUEST", message: `Insufficient credits. Need ${creditCheck.cost}, have ${creditCheck.currentBalance}.` });
    }
    const userApiKey = await getUserOpenAIKey(ctx.user.id) || undefined;
    const prompt = `Write a compelling crowdfunding campaign story for the following project.

Title: ${input.title}
Category: ${input.category || 'General'}
Goal: $${input.goalAmount.toLocaleString()}
Description: ${input.description}

Write a 3-4 paragraph story that:
1. Opens with a hook that grabs attention
2. Explains the problem being solved
3. Describes the solution and its impact
4. Ends with a clear call to action

Keep it authentic, emotional, and persuasive. Use "you" to address backers directly.`;
    const response = await invokeLLM({
      ...getProviderParams("crowdfunding_story"),
      userApiKey,
      messages: [{ role: "user", content: prompt }],
    });
    const story = String(response.choices[0]?.message?.content || '');
    try { await consumeCredits(ctx.user.id, "grant_match", `Crowdfunding story generated: ${input.title}`); } catch {}
    return { story };
  }),
  /** Contribute to an internal campaign (records contribution, updates totals) */
  contribute: protectedProcedure.input(z.object({
    campaignId: z.number(),
    amount: z.number().min(1),
    message: z.string().optional(),
    anonymous: z.number().optional(),
  })).mutation(async ({ ctx, input }) => {
    // Verify campaign exists and is internal + active
    const campaign = await db.getCampaignById(input.campaignId);
    if (!campaign) throw new TRPCError({ code: "NOT_FOUND", message: "Campaign not found" });
    if ((campaign as any).source !== "internal") {
      throw new TRPCError({ code: "BAD_REQUEST", message: "External campaigns must be funded on their original platform" });
    }
    if (campaign.status !== "active") {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Campaign is not accepting contributions" });
    }
    const result = await db.createContribution({
      campaignId: input.campaignId,
      userId: ctx.user.id,
      amount: input.amount,
      status: "completed",
      backerName: ctx.user.name || "Anonymous",
      backerEmail: ctx.user.email || "",
      message: input.message,
      anonymous: input.anonymous || 0,
    });
    // Update percent funded and check milestones
    const updated = await db.getCampaignById(input.campaignId);
    if (updated) {
      const pct = Math.round((updated.currentAmount / updated.goalAmount) * 100);
      await db.updateCampaign(input.campaignId, { percentFunded: pct } as any);
      // Fire-and-forget milestone promotion check
      const prevPct = Math.round(((updated.currentAmount - input.amount) / updated.goalAmount) * 100);
      for (const milestone of [25, 50, 75, 100]) {
        if (prevPct < milestone && pct >= milestone) {
          const trigger = `milestone_${milestone}` as "milestone_25" | "milestone_50" | "milestone_75" | "milestone_100";
          promoteCampaign(updated as any, trigger).catch((err: unknown) => {
            log.warn(`Milestone ${milestone}% promotion failed (non-fatal)`, { error: getErrorMessage(err) });
          });
        }
      }
    }
    return result;
  }),
  /** Post an update to a campaign */
  addUpdate: protectedProcedure.input(z.object({
    campaignId: z.number(),
    title: z.string().min(1),
    content: z.string().min(1),
  })).mutation(async ({ input }) => {
    return db.createCampaignUpdate(input);
  }),
  /** Get rewards for a campaign */
  rewards: publicProcedure.input(z.object({ campaignId: z.number() })).query(async ({ input }) => {
    return db.getRewardsByCampaign(input.campaignId);
  }),
  /** Get contributions for a campaign */
  contributions: protectedProcedure.input(z.object({ campaignId: z.number() })).query(async ({ input }) => {
    return db.getContributionsByCampaign(input.campaignId);
  }),
  /** Get updates for a campaign */
  updates: publicProcedure.input(z.object({ campaignId: z.number() })).query(async ({ input }) => {
    return db.getUpdatesByCampaign(input.campaignId);
  }),
  /** Seed external campaigns from aggregator */
  seed: protectedProcedure.mutation(async () => {
    const result = await seedExternalCampaigns(db.createCampaign, db.listCampaigns);
    return result;
  }),
  /** Get user's own campaigns */
  myCampaigns: protectedProcedure.query(async ({ ctx }) => {
    return db.listCampaigns({ userId: ctx.user.id });
  }),
  /** Get crypto payment configuration info */
  cryptoConfig: publicProcedure.query(async () => {
    const configured = isBinancePayConfigured();
    return {
      configured,
      supportedCurrencies: [...SUPPORTED_CRYPTO],
      platformFeePercent: PLATFORM_FEE_PERCENT,
      fallback: configured ? null : getFallbackCryptoInfo(),
    };
  }),
  /** Create a crypto payment order via Binance Pay */
  createCryptoPayment: protectedProcedure.input(z.object({
    campaignId: z.number(),
    amount: z.number().min(1),
    currency: z.string().default("USD"),
    donorName: z.string().optional(),
    donorEmail: z.string().optional(),
    donorMessage: z.string().optional(),
  })).mutation(async ({ ctx, input }) => {
    // Verify campaign exists and is internal + active
    const campaign = await db.getCampaignById(input.campaignId);
    if (!campaign) throw new TRPCError({ code: "NOT_FOUND", message: "Campaign not found" });
    if ((campaign as any).source !== "internal") {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Crypto payments only available for internal campaigns" });
    }
    if (campaign.status !== "active") {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Campaign is not accepting contributions" });
    }
    // Calculate platform fee
    const { platformFee, creatorAmount } = calculatePlatformFee(input.amount);
    const merchantTradeNo = generateMerchantTradeNo();
    // Determine base URL for callbacks
    const baseUrl = ENV.publicUrl || "https://www.archibaldtitan.com";
    if (!isBinancePayConfigured()) {
      // Return fallback wallet info for manual crypto transfer
      const fallback = getFallbackCryptoInfo();
      // Still record the payment intent in DB
      try {
        const { getDb } = await import("./db.js");
        const { cryptoPayments } = await import("../drizzle/schema.js");
        const dbConn = await getDb();
        if (dbConn) {
          await dbConn.insert(cryptoPayments).values({
            userId: ctx.user.id,
            campaignId: input.campaignId,
            merchantTradeNo,
            status: "awaiting_manual",
            fiatAmount: input.amount.toFixed(2),
            fiatCurrency: input.currency,
            platformFee: platformFee.toFixed(2),
            creatorAmount: creatorAmount.toFixed(2),
            donorName: input.donorName || ctx.user.name || "Anonymous",
            donorEmail: input.donorEmail || ctx.user.email || "",
            donorMessage: input.donorMessage,
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          });
        }
      } catch (err) {
        log.error("Failed to record manual crypto payment:", { error: String(err) });
      }
      return {
        type: "manual" as const,
        merchantTradeNo,
        walletAddresses: fallback.walletAddresses,
        instructions: fallback.instructions,
        amount: input.amount,
        platformFee,
        creatorAmount,
      };
    }
    // Create Binance Pay order
    try {
      const order = await createCryptoPaymentOrder({
        merchantTradeNo,
        fiatAmount: input.amount,
        fiatCurrency: input.currency,
        goodsName: `Contribution to: ${campaign.title}`,
        goodsDetail: `Crowdfunding contribution for campaign #${campaign.id}`,
        returnUrl: `${baseUrl}/crowdfunding/campaign/${campaign.id}?payment=success`,
        cancelUrl: `${baseUrl}/crowdfunding/campaign/${campaign.id}?payment=cancelled`,
        webhookUrl: `${baseUrl}/api/webhooks/binance-pay`,
        supportPayCurrency: "USDT,BTC,ETH,BNB",
        passThroughInfo: JSON.stringify({
          campaignId: input.campaignId,
          userId: ctx.user.id,
          donorName: input.donorName || ctx.user.name,
          donorMessage: input.donorMessage,
        }),
      });
      // Record in DB
      try {
        const { getDb } = await import("./db.js");
        const { cryptoPayments } = await import("../drizzle/schema.js");
        const dbConn = await getDb();
        if (dbConn) {
          await dbConn.insert(cryptoPayments).values({
            userId: ctx.user.id,
            campaignId: input.campaignId,
            merchantTradeNo,
            binancePrepayId: order.data.prepayId,
            status: "pending",
            fiatAmount: input.amount.toFixed(2),
            fiatCurrency: input.currency,
            platformFee: platformFee.toFixed(2),
            creatorAmount: creatorAmount.toFixed(2),
            checkoutUrl: order.data.checkoutUrl,
            qrcodeLink: order.data.qrcodeLink,
            donorName: input.donorName || ctx.user.name || "Anonymous",
            donorEmail: input.donorEmail || ctx.user.email || "",
            donorMessage: input.donorMessage,
            expiresAt: new Date(order.data.expireTime),
          });
        }
      } catch (err) {
        log.error("Failed to record crypto payment:", { error: String(err) });
      }
      return {
        type: "binance_pay" as const,
        merchantTradeNo,
        checkoutUrl: order.data.checkoutUrl,
        qrcodeLink: order.data.qrcodeLink,
        qrContent: order.data.qrContent,
        universalUrl: order.data.universalUrl,
        expireTime: order.data.expireTime,
        amount: input.amount,
        platformFee,
        creatorAmount,
      };
    } catch (error: unknown) {
      log.error("Binance Pay order creation failed:", { error: String(error) });
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: `Crypto payment failed: ${getErrorMessage(error)}`,
      });
    }
  }),
  /** Check crypto payment status */
  checkCryptoPayment: protectedProcedure.input(z.object({
    merchantTradeNo: z.string(),
  })).query(async ({ input }) => {
    try {
      const { getDb } = await import("./db.js");
      const { cryptoPayments } = await import("../drizzle/schema.js");
      const { eq } = await import("drizzle-orm");
      const dbConn = await getDb();
      if (!dbConn) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [payment] = await dbConn.select().from(cryptoPayments)
        .where(eq(cryptoPayments.merchantTradeNo, input.merchantTradeNo));
      if (!payment) throw new TRPCError({ code: "NOT_FOUND" });
      // If pending and Binance Pay is configured, also check with Binance
      if (payment.status === "pending" && isBinancePayConfigured()) {
        try {
          const binanceStatus = await queryOrderStatus(input.merchantTradeNo);
          if (binanceStatus?.data?.status === "PAID") {
            // Update our DB
            await dbConn.update(cryptoPayments)
              .set({ status: "completed", paidAt: new Date(), webhookData: JSON.stringify(binanceStatus.data) })
              .where(eq(cryptoPayments.merchantTradeNo, input.merchantTradeNo));
            return { ...payment, status: "completed" };
          }
        } catch (err) {
          // Ignore query errors, return DB status
        }
      }
      return payment;
    } catch (error: unknown) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: getErrorMessage(error) });
    }
  }),

  // ─── Stripe Card Donation (guest-friendly) ────────────────────────────────
  /** Create a Stripe card checkout session for a donation — works for guests AND logged-in users */
  createStripeCheckout: publicProcedure.input(z.object({
    campaignId: z.number(),
    amount: z.number().min(1).max(100000),
    donorName: z.string().max(256).optional(),
    donorEmail: z.string().email().optional(),
    donorMessage: z.string().max(500).optional(),
    anonymous: z.number().optional(),
  })).mutation(async ({ input }) => {
    const campaign = await db.getCampaignById(input.campaignId);
    if (!campaign) throw new TRPCError({ code: "NOT_FOUND", message: "Campaign not found" });
    if ((campaign as any).source !== "internal") {
      throw new TRPCError({ code: "BAD_REQUEST", message: "External campaigns must be funded on their original platform" });
    }
    if (campaign.status !== "active") {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Campaign is not accepting contributions" });
    }
    if (!ENV.stripeSecretKey) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Payment processing is not configured" });
    }
    const stripe = new Stripe(ENV.stripeSecretKey, { apiVersion: "2025-01-27.acacia" as any });
    const baseUrl = ENV.publicUrl || "https://www.archibaldtitan.com";
    const { platformFee, creatorAmount } = calculatePlatformFee(input.amount);
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [{
        price_data: {
          currency: "usd",
          unit_amount: Math.round(input.amount * 100),
          product_data: {
            name: `Donation to: ${campaign.title}`,
            description: input.donorMessage || `Supporting crowdfunding campaign #${campaign.id}`,
          },
        },
        quantity: 1,
      }],
      customer_email: input.donorEmail || undefined,
      metadata: {
        type: "crowdfunding_donation",
        campaignId: String(input.campaignId),
        donorName: input.donorName || "Anonymous",
        donorEmail: input.donorEmail || "",
        donorMessage: input.donorMessage || "",
        anonymous: String(input.anonymous || 0),
        platformFee: platformFee.toFixed(2),
        creatorAmount: creatorAmount.toFixed(2),
      },
      success_url: `${baseUrl}/crowdfunding/campaign/${campaign.id}?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/crowdfunding/campaign/${campaign.id}?payment=cancelled`,
    });
    return { checkoutUrl: session.url, sessionId: session.id };
  }),

  // ─── Multi-Channel Promotion ──────────────────────────────────────────────
  /** Trigger multi-channel promotion for a campaign (campaign owner or admin only) */
  promote: protectedProcedure.input(z.object({
    campaignId: z.number(),
    trigger: z.enum(["launch", "milestone_25", "milestone_50", "milestone_75", "milestone_100", "manual"]).default("manual"),
  })).mutation(async ({ ctx, input }) => {
    const campaign = await db.getCampaignById(input.campaignId);
    if (!campaign) throw new TRPCError({ code: "NOT_FOUND", message: "Campaign not found" });
    const isOwner = (campaign as any).userId === ctx.user.id;
    const isAdmin = isAdminRole(ctx.user.role);
    if (!isOwner && !isAdmin) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Only the campaign owner or an admin can trigger promotion" });
    }
    return promoteCampaign(campaign as any, input.trigger);
  }),

  /** Get promotion history for a campaign */
  promotionHistory: publicProcedure.input(z.object({ campaignId: z.number() })).query(async ({ input }) => {
    try {
      const { getDb } = await import("./db.js");
      const { crowdfundingPromotionLog } = await import("../drizzle/schema.js");
      const { eq, desc } = await import("drizzle-orm");
      const dbConn = await getDb();
      if (!dbConn) return [];
      return dbConn.select().from(crowdfundingPromotionLog)
        .where(eq(crowdfundingPromotionLog.campaignId, input.campaignId))
        .orderBy(desc(crowdfundingPromotionLog.createdAt))
        .limit(20);
    } catch {
      return [];
    }
  }),
  suggestRewards: protectedProcedure.input(z.object({
    title: z.string(),
    category: z.string(),
    goalAmount: z.number(),
  })).mutation(async ({ ctx, input }) => {
    const creditCheck = await checkCredits(ctx.user.id, "grant_match");
    if (!creditCheck.allowed) {
      throw new TRPCError({ code: "BAD_REQUEST", message: `Insufficient credits for reward suggestions. Need ${creditCheck.cost}, have ${creditCheck.currentBalance}.` });
    }
    const userApiKey = await getUserOpenAIKey(ctx.user.id) || undefined;
    const prompt = `Suggest 5 reward tiers for a crowdfunding campaign. Return as JSON array.
Project: ${input.title}
Category: ${input.category}
Goal: $${input.goalAmount.toLocaleString()}
Return ONLY a JSON array with objects having: title, description, minAmount, estimatedDelivery (in months from now).
Example: [{"title":"Early Bird","description":"Get early access","minAmount":25,"estimatedDelivery":"3 months"}]`;
    const response = await invokeLLM({
      ...getProviderParams("crowdfunding_story"),
      userApiKey,
      messages: [{ role: "user", content: prompt }],
    });
    const content = String(response.choices[0]?.message?.content || "[]");
    try { await consumeCredits(ctx.user.id, "grant_match", `Crowdfunding reward tiers suggested: ${input.title}`); } catch {}
    try {
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      return { rewards: jsonMatch ? JSON.parse(jsonMatch[0]) : [] };
    } catch {
      return { rewards: [] };
    }
  }),
  /** Add a reward tier to a campaign */
  addReward: protectedProcedure.input(z.object({
    campaignId: z.number(),
    title: z.string().min(1),
    description: z.string(),
    minAmount: z.number().min(1),
    estimatedDelivery: z.string().optional(),
    maxBackers: z.number().optional(),
  })).mutation(async ({ ctx, input }) => {
    const campaign = await db.getCampaignById(input.campaignId);
    if (!campaign) throw new TRPCError({ code: "NOT_FOUND", message: "Campaign not found" });
    if ((campaign as any).userId !== ctx.user.id && !isAdminRole(ctx.user.role)) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Not authorised to add rewards to this campaign" });
    }
    return db.createReward({
      campaignId: input.campaignId,
      title: input.title,
      description: input.description,
      minAmount: input.minAmount,
      estimatedDelivery: input.estimatedDelivery ? new Date(input.estimatedDelivery) : undefined,
      maxClaims: input.maxBackers,
    });
  }),
  /** Get comments for a campaign */
  comments: publicProcedure.input(z.object({ campaignId: z.number() })).query(async ({ input }) => {
    return db.getCommentsByCampaign(input.campaignId);
  }),
  /** Add a comment to a campaign */
  addComment: protectedProcedure.input(z.object({
    campaignId: z.number(),
    content: z.string().min(1).max(2000),
    parentId: z.number().optional(),
  })).mutation(async ({ ctx, input }) => {
    const campaign = await db.getCampaignById(input.campaignId);
    if (!campaign) throw new TRPCError({ code: "NOT_FOUND", message: "Campaign not found" });
    return db.createComment({
      campaignId: input.campaignId,
      userId: ctx.user.id,
      content: input.content,
      parentId: input.parentId,
    });
  }),
});

// ─── Grant Applications Sub-Router ───────────────────────────────────────────
export const grantApplicationRouter = router({
  /** List grant applications for a company */
  list: protectedProcedure.input(z.object({
    companyId: z.number(),
  })).query(async ({ input }) => {
    return db.getGrantApplicationsByCompany(input.companyId);
  }),
  /** Generate an AI-powered grant application for a company */
  generate: protectedProcedure.input(z.object({
    companyId: z.number(),
    grantOpportunityId: z.number(),
    businessPlanId: z.number().optional(),
  })).mutation(async ({ ctx, input }) => {
    const creditCheck = await checkCredits(ctx.user.id, "grant_apply");
    if (!creditCheck.allowed) {
      throw new TRPCError({ code: "BAD_REQUEST", message: `Insufficient credits. Need ${creditCheck.cost}, have ${creditCheck.currentBalance}.` });
    }
    const grant = await db.getGrantOpportunityById(input.grantOpportunityId);
    if (!grant) throw new TRPCError({ code: "NOT_FOUND", message: "Grant not found" });
    const company = await db.getCompanyById(input.companyId);
    if (!company) throw new TRPCError({ code: "NOT_FOUND", message: "Company not found" });
    // Create the application record
    const appRecord = await db.createGrantApplication({
      grantOpportunityId: input.grantOpportunityId,
      companyId: input.companyId,
      businessPlanId: input.businessPlanId,
      status: "draft",
    });
    // Generate AI content
    const userApiKey = await getUserOpenAIKey(ctx.user.id) || undefined;
    const prompt = `You are an expert grant writer. Generate a comprehensive grant application for the following:

Company: ${company.name}\nIndustry: ${(company as any).industry || 'Technology'}\nDescription: ${(company as any).description || ''}

Grant: ${grant.title}\nAgency: ${grant.agency}\nAmount: $${grant.minAmount?.toLocaleString()} - $${grant.maxAmount?.toLocaleString()}\nDescription: ${grant.description || ''}

Generate a JSON object with these fields: technicalAbstract, projectDescription, specificAims, innovation, approach, commercializationPlan, budget, budgetJustification, timeline, successProbability (0-100), expectedValue (in USD), qualityScore (0-100), priority (1-5).`;
    try {
      const response = await invokeLLM({
        ...getProviderParams("grant_matching"),
        userApiKey,
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" } as any,
      });
      const content = String(response.choices[0]?.message?.content || "{}");
      const generated = JSON.parse(content);
      await db.updateGrantApplication(appRecord.id, {
        technicalAbstract: generated.technicalAbstract,
        projectDescription: generated.projectDescription,
        specificAims: generated.specificAims,
        innovation: generated.innovation,
        approach: generated.approach,
        commercializationPlan: generated.commercializationPlan,
        budget: generated.budget,
        budgetJustification: generated.budgetJustification,
        timeline: generated.timeline,
        successProbability: generated.successProbability,
        expectedValue: generated.expectedValue,
        qualityScore: generated.qualityScore,
        priority: generated.priority,
        status: "ready",
      });
      try { await consumeCredits(ctx.user.id, "grant_apply", `Grant application generated for: ${grant.title}`); } catch {}
    } catch (err) {
      log.warn("Grant application AI generation failed", { error: getErrorMessage(err) });
    }
    return { id: appRecord.id, success: true };
  }),
  /** Regenerate missing sections of an existing application */
  regenerateMissing: protectedProcedure.input(z.object({
    applicationId: z.number(),
  })).mutation(async ({ ctx, input }) => {
    const app = await db.getGrantApplicationById(input.applicationId);
    if (!app) throw new TRPCError({ code: "NOT_FOUND", message: "Application not found" });
    const grant = await db.getGrantOpportunityById(app.grantOpportunityId);
    const company = await db.getCompanyById(app.companyId);
    if (!grant || !company) throw new TRPCError({ code: "NOT_FOUND", message: "Grant or company not found" });
    const missingSections = [
      "technicalAbstract", "projectDescription", "specificAims", "innovation",
      "approach", "commercializationPlan", "budget", "budgetJustification", "timeline",
    ].filter(field => !(app as any)[field]);
    if (!missingSections.length) return { success: true, message: "All sections already complete" };
    const userApiKey = await getUserOpenAIKey(ctx.user.id) || undefined;
    const prompt = `Generate the following missing sections for a grant application. Return as JSON object with only these keys: ${missingSections.join(", ")}.

Company: ${company.name}\nGrant: ${grant.title}\nAgency: ${grant.agency}`;
    try {
      const response = await invokeLLM({
        ...getProviderParams("grant_matching"),
        userApiKey,
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" } as any,
      });
      const content = String(response.choices[0]?.message?.content || "{}");
      const generated = JSON.parse(content);
      await db.updateGrantApplication(input.applicationId, generated);
      return { success: true, message: `Regenerated ${missingSections.length} missing section(s)` };
    } catch (err) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `Regeneration failed: ${getErrorMessage(err)}` });
    }
  }),
});

// ─── Grant Seed Sub-Router ────────────────────────────────────────────────────
export const grantSeedRouter = router({
  /** Count total seeded grant opportunities */
  count: publicProcedure.query(async () => {
    const grants = await db.listGrantOpportunities();
    return { count: grants.length };
  }),
});

// ─── Grant Refresh Sub-Router ─────────────────────────────────────────────────
export const grantRefreshRouter = router({
  /** Refresh grants for all supported countries (admin only) */
  refreshAll: protectedProcedure.input(z.object({}).optional()).mutation(async ({ ctx }) => {
    if (!isAdminRole(ctx.user.role)) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
    }
    return refreshAllGrants();
  }),
  /** Refresh grants for a specific country */
  refreshCountry: protectedProcedure.input(z.object({
    countryCode: z.string().min(2).max(10),
  })).mutation(async ({ ctx, input }) => {
    if (!isAdminRole(ctx.user.role)) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
    }
    return refreshGrantsForCountry(input.countryCode);
  }),
});
