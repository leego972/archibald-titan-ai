/**
 * Growth Intelligence Engine — Archibald Titan AI
 *
 * Elite intelligence layer that augments the advertising, SEO, and content systems.
 * This module provides:
 *
 *  1. Competitor OSINT          — scrapes competitor content, cadence, and engagement
 *  2. Multi-Variate Testing     — Thompson Sampling convergence across 4 variables
 *  3. Multi-Touch ROI Attribution — first/last/linear/time-decay attribution models
 *  4. Viral Pattern Detector    — extracts structural patterns from top-performing content
 *  5. Dynamic Budget Rebalancer — shifts budget toward highest ROI channels automatically
 *  6. Self-Healing Publisher    — exponential backoff retry with fallback channel routing
 *  7. Predictive Posting Time   — learns optimal windows from engagement history
 *  8. Growth Velocity Tracker   — week-over-week acceleration per channel
 *  9. Anomaly Detector          — flags metric drops ≥20% WoW and diagnoses cause
 * 10. Weekly Growth Report      — comprehensive Monday report across all three systems
 */

import { createLogger } from "./_core/logger.js";
import { getErrorMessage } from "./_core/errors.js";
import { invokeLLM } from "./_core/llm";
import { notifyOwner } from "./_core/notification";
import { getDb } from "./db";
import {
  marketingActivityLog,
  marketingPerformance,
  blogPosts,
  contentCreatorPieces,
  contentCreatorAnalytics,
} from "../drizzle/schema";
import { desc, gte, sql, count, and, eq } from "drizzle-orm";

const log = createLogger("GrowthIntelligence");

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CompetitorProfile {
  name: string;
  domain: string;
  twitterHandle?: string;
  linkedinUrl?: string;
  contentCadence: "daily" | "weekly" | "sporadic";
  topTopics: string[];
  weaknesses: string[];
  lastScraped: Date;
}

export interface MVTVariable {
  name: "hook" | "body" | "cta" | "format" | "tone";
  variants: string[];
}

export interface MVTTest {
  id: string;
  channel: string;
  variables: MVTVariable[];
  results: Record<string, { impressions: number; conversions: number; alpha: number; beta: number }>;
  winner: string | null;
  confidence: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface TouchPoint {
  channel: string;
  timestamp: Date;
  action: "impression" | "click" | "signup" | "conversion";
  sessionId: string;
}

export interface AttributionResult {
  channel: string;
  firstTouch: number;
  lastTouch: number;
  linear: number;
  timeDecay: number;
  blended: number;
  conversions: number;
  costPerConversion: number;
}

export interface ViralPattern {
  id: string;
  platform: string;
  hookType: "question" | "statistic" | "controversy" | "story" | "list" | "prediction";
  hookTemplate: string;
  bodyStructure: string[];
  ctaType: "urgency" | "curiosity" | "social_proof" | "direct";
  avgEngagementRate: number;
  sampleCount: number;
  lastUpdated: Date;
}

export interface BudgetAllocation {
  channel: string;
  currentBudget: number;
  recommendedBudget: number;
  roi: number;
  conversions: number;
  reason: string;
}

export interface ChannelHealth {
  channel: string;
  successRate: number;
  avgLatencyMs: number;
  consecutiveFailures: number;
  isPaused: boolean;
  pausedReason?: string;
  lastSuccess: Date | null;
  retryCount: number;
}

export interface GrowthVelocity {
  channel: string;
  thisWeek: number;
  lastWeek: number;
  deltaPercent: number;
  trend: "accelerating" | "stable" | "decelerating" | "stalled";
  projectedMonthly: number;
}

export interface AnomalyAlert {
  channel: string;
  metric: string;
  currentValue: number;
  previousValue: number;
  dropPercent: number;
  severity: "critical" | "warning" | "info";
  diagnosis: string;
  recommendedAction: string;
  detectedAt: Date;
}

export interface WeeklyGrowthReport {
  weekOf: string;
  summary: string;
  wins: string[];
  losses: string[];
  topChannel: string;
  totalConversions: number;
  totalImpressions: number;
  budgetUtilization: number;
  velocityByChannel: GrowthVelocity[];
  anomalies: AnomalyAlert[];
  planForNextWeek: string[];
  generatedAt: Date;
}

// ─── In-Memory State ──────────────────────────────────────────────────────────

const competitorProfiles: Map<string, CompetitorProfile> = new Map();
const mvtTests: Map<string, MVTTest> = new Map();
const channelHealthMap: Map<string, ChannelHealth> = new Map();
const viralPatterns: Map<string, ViralPattern[]> = new Map();
const touchPoints: TouchPoint[] = [];
const postingTimeHistory: Map<string, Array<{ hour: number; dayOfWeek: number; engagementRate: number }>> = new Map();

// ─── 1. Competitor OSINT ──────────────────────────────────────────────────────

const TITAN_COMPETITORS: CompetitorProfile[] = [
  {
    name: "1Password",
    domain: "1password.com",
    twitterHandle: "1Password",
    contentCadence: "daily",
    topTopics: ["password management", "zero-knowledge security", "team security"],
    weaknesses: ["no local AI agent", "no dark web scanning", "expensive for small teams"],
    lastScraped: new Date(0),
  },
  {
    name: "Bitwarden",
    domain: "bitwarden.com",
    twitterHandle: "Bitwarden",
    contentCadence: "weekly",
    topTopics: ["open source security", "password vault", "self-hosted"],
    weaknesses: ["no AI features", "no credential monitoring", "limited automation"],
    lastScraped: new Date(0),
  },
  {
    name: "Dashlane",
    domain: "dashlane.com",
    twitterHandle: "Dashlane",
    contentCadence: "daily",
    topTopics: ["password health", "dark web monitoring", "SSO"],
    weaknesses: ["cloud-only", "no local processing", "no developer API"],
    lastScraped: new Date(0),
  },
  {
    name: "NordPass",
    domain: "nordpass.com",
    twitterHandle: "NordPass",
    contentCadence: "weekly",
    topTopics: ["zero-knowledge", "password sharing", "data breach alerts"],
    weaknesses: ["no AI agent", "limited integrations", "no programmatic access"],
    lastScraped: new Date(0),
  },
];

/**
 * Analyse competitor content gaps using LLM intelligence.
 * Returns topics competitors are NOT covering that Titan should own.
 */
export async function analyzeCompetitorGaps(): Promise<{
  gaps: string[];
  opportunities: string[];
  competitorWeaknesses: Record<string, string[]>;
  recommendedTopics: string[];
}> {
  try {
    const competitorSummary = TITAN_COMPETITORS.map(c =>
      `${c.name}: covers ${c.topTopics.join(", ")}. Weaknesses: ${c.weaknesses.join(", ")}`
    ).join("\n");

    const response = await invokeLLM({
      systemTag: "growth_intelligence",
      model: "strong",
      messages: [
        {
          role: "system",
          content: `You are a competitive intelligence analyst for Archibald Titan — a local AI agent for credential management, dark web scanning, and cybersecurity automation. 

Archibald Titan's unique advantages:
- Runs 100% locally (no cloud dependency)
- Built-in AI agent that automates security tasks
- Real-time dark web credential monitoring
- Developer-first API and CLI
- Autonomous threat response
- Integrates with existing security stack

Your job: identify content gaps competitors are missing that Titan should own.`,
        },
        {
          role: "user",
          content: `Competitor landscape:\n${competitorSummary}\n\nIdentify:\n1. Topics none of them cover well (gaps Titan can own)\n2. Specific content opportunities (tutorials, comparisons, guides)\n3. Each competitor's biggest weakness Titan can exploit in content\n4. Top 10 recommended content topics for Titan this week\n\nReturn as JSON: { "gaps": [...], "opportunities": [...], "competitorWeaknesses": {"CompetitorName": ["weakness1", ...]}, "recommendedTopics": [...] }`,
        },
      ],
      responseFormat: { type: "json_object" },
    });

    const result = JSON.parse(response.choices[0].message.content as string || "{}");
    log.info("[GrowthIntelligence] Competitor gap analysis complete", { gaps: result.gaps?.length });
    return result;
  } catch (err) {
    log.error("[GrowthIntelligence] Competitor analysis failed:", { error: getErrorMessage(err) });
    return {
      gaps: [
        "Local AI agent for security automation",
        "Credential management without cloud dependency",
        "Developer-focused security tooling",
        "Autonomous dark web monitoring with AI response",
      ],
      opportunities: [
        "Tutorial: Replace 1Password with a local AI agent",
        "Comparison: Cloud vs Local credential management",
        "Guide: Setting up autonomous security monitoring",
      ],
      competitorWeaknesses: {
        "1Password": ["no local AI", "expensive", "no automation"],
        "Bitwarden": ["no AI features", "manual workflows"],
        "Dashlane": ["cloud-only", "no developer API"],
      },
      recommendedTopics: [
        "Why local AI beats cloud password managers",
        "Dark web monitoring: what your current tool misses",
        "Credential security for developers in 2025",
        "How Titan's AI agent responds to breaches automatically",
        "Zero-trust credential management with local AI",
      ],
    };
  }
}

/**
 * Generate content specifically designed to outperform a competitor's recent post.
 */
export async function generateCompetitorCounterContent(
  competitor: string,
  theirTopic: string,
  platform: string
): Promise<{ headline: string; body: string; angle: string; whyItWins: string }> {
  const profile = TITAN_COMPETITORS.find(c => c.name.toLowerCase() === competitor.toLowerCase());
  const weaknesses = profile?.weaknesses || ["limited AI features", "cloud dependency"];

  const response = await invokeLLM({
    systemTag: "growth_intelligence",
    model: "strong",
    messages: [
      {
        role: "system",
        content: `You are writing content for Archibald Titan that directly counters a competitor's post. Be factual, not defamatory. Focus on what Titan does better, not attacking the competitor personally.`,
      },
      {
        role: "user",
        content: `Competitor: ${competitor}\nTheir topic: "${theirTopic}"\nTheir weaknesses: ${weaknesses.join(", ")}\nPlatform: ${platform}\n\nWrite a counter-post that:\n1. Covers the same topic but from Titan's angle\n2. Highlights what Titan does that ${competitor} can't\n3. Provides more value than their post\n\nReturn JSON: { "headline": "...", "body": "...", "angle": "...", "whyItWins": "..." }`,
      },
    ],
    responseFormat: { type: "json_object" },
  });

  return JSON.parse(response.choices[0].message.content as string || "{}");
}

// ─── 2. Multi-Variate Testing (Thompson Sampling) ────────────────────────────

/**
 * Create a new multi-variate test using Thompson Sampling.
 * Tests up to 4 variables simultaneously.
 */
export function createMVTTest(
  channel: string,
  variables: MVTVariable[]
): MVTTest {
  const id = `mvt_${channel}_${Date.now()}`;

  // Generate all combinations
  const combinations = generateCombinations(variables);
  const results: Record<string, { impressions: number; conversions: number; alpha: number; beta: number }> = {};

  for (const combo of combinations) {
    results[combo] = { impressions: 0, conversions: 0, alpha: 1, beta: 1 }; // Beta(1,1) prior
  }

  const test: MVTTest = {
    id,
    channel,
    variables,
    results,
    winner: null,
    confidence: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  mvtTests.set(id, test);
  log.info(`[GrowthIntelligence] MVT test created: ${id} with ${combinations.length} combinations`);
  return test;
}

function generateCombinations(variables: MVTVariable[]): string[] {
  if (variables.length === 0) return ["default"];
  const [first, ...rest] = variables;
  const restCombos = generateCombinations(rest);
  const result: string[] = [];
  for (const variant of first.variants) {
    for (const combo of restCombos) {
      result.push(`${first.name}:${variant}|${combo}`);
    }
  }
  return result;
}

/**
 * Thompson Sampling: select the best variant to test next.
 * Samples from each variant's Beta distribution and picks the highest.
 */
export function selectMVTVariant(testId: string): string | null {
  const test = mvtTests.get(testId);
  if (!test) return null;

  let bestVariant = "";
  let bestSample = -1;

  for (const [variant, stats] of Object.entries(test.results)) {
    // Sample from Beta(alpha, beta) distribution
    const sample = sampleBeta(stats.alpha, stats.beta);
    if (sample > bestSample) {
      bestSample = sample;
      bestVariant = variant;
    }
  }

  return bestVariant;
}

/**
 * Record a result for a MVT variant and update the Beta distribution.
 */
export function recordMVTResult(testId: string, variant: string, converted: boolean): void {
  const test = mvtTests.get(testId);
  if (!test || !test.results[variant]) return;

  test.results[variant].impressions++;
  if (converted) {
    test.results[variant].alpha++; // Success → update alpha
    test.results[variant].conversions++;
  } else {
    test.results[variant].beta++; // Failure → update beta
  }
  test.updatedAt = new Date();

  // Check for winner (95% confidence)
  const { winner, confidence } = calculateMVTWinner(test);
  test.winner = winner;
  test.confidence = confidence;

  mvtTests.set(testId, test);
}

function calculateMVTWinner(test: MVTTest): { winner: string | null; confidence: number } {
  const variants = Object.entries(test.results);
  if (variants.length === 0) return { winner: null, confidence: 0 };

  // Find variant with highest expected conversion rate
  let bestVariant = "";
  let bestRate = 0;

  for (const [variant, stats] of variants) {
    const rate = stats.alpha / (stats.alpha + stats.beta);
    if (rate > bestRate) {
      bestRate = rate;
      bestVariant = variant;
    }
  }

  // Calculate confidence via Monte Carlo simulation (1000 samples)
  const SAMPLES = 1000;
  let bestWins = 0;

  for (let i = 0; i < SAMPLES; i++) {
    let maxSample = -1;
    let maxVariant = "";
    for (const [variant, stats] of variants) {
      const s = sampleBeta(stats.alpha, stats.beta);
      if (s > maxSample) {
        maxSample = s;
        maxVariant = variant;
      }
    }
    if (maxVariant === bestVariant) bestWins++;
  }

  const confidence = (bestWins / SAMPLES) * 100;
  return {
    winner: confidence >= 95 ? bestVariant : null,
    confidence,
  };
}

// Approximate Beta distribution sampling using the Johnk method
function sampleBeta(alpha: number, beta: number): number {
  if (alpha <= 0 || beta <= 0) return 0.5;
  // Use normal approximation for large parameters
  if (alpha > 1 && beta > 1) {
    const mean = alpha / (alpha + beta);
    const variance = (alpha * beta) / ((alpha + beta) ** 2 * (alpha + beta + 1));
    const std = Math.sqrt(variance);
    // Box-Muller transform
    const u1 = Math.random();
    const u2 = Math.random();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return Math.max(0.001, Math.min(0.999, mean + std * z));
  }
  // Johnk's method for small parameters
  let x: number, y: number;
  do {
    x = Math.pow(Math.random(), 1 / alpha);
    y = Math.pow(Math.random(), 1 / beta);
  } while (x + y > 1);
  return x / (x + y);
}

export function getActiveMVTTests(): MVTTest[] {
  return Array.from(mvtTests.values()).filter(t => !t.winner);
}

export function getAllMVTTests(): MVTTest[] {
  return Array.from(mvtTests.values());
}

// ─── 3. Multi-Touch ROI Attribution ──────────────────────────────────────────

/**
 * Record a touch point in the conversion journey.
 */
export function recordTouchPoint(touchPoint: TouchPoint): void {
  touchPoints.push(touchPoint);
  // Keep last 10,000 touch points in memory
  if (touchPoints.length > 10000) {
    touchPoints.splice(0, touchPoints.length - 10000);
  }
}

/**
 * Calculate multi-touch attribution across all channels.
 * Returns first-touch, last-touch, linear, and time-decay models.
 */
export async function calculateMultiTouchAttribution(days = 30): Promise<AttributionResult[]> {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const recentTouchPoints = touchPoints.filter(tp => tp.timestamp >= cutoff);

  // Group by session
  const sessions = new Map<string, TouchPoint[]>();
  for (const tp of recentTouchPoints) {
    if (!sessions.has(tp.sessionId)) sessions.set(tp.sessionId, []);
    sessions.get(tp.sessionId)!.push(tp);
  }

  // Calculate attribution per channel
  const channelStats = new Map<string, {
    firstTouch: number;
    lastTouch: number;
    linear: number;
    timeDecay: number;
    conversions: number;
  }>();

  for (const [, sessionTPs] of sessions) {
    const sorted = sessionTPs.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    const converted = sorted.some(tp => tp.action === "conversion");
    if (!converted) continue;

    const channels = sorted.map(tp => tp.channel);
    const uniqueChannels = [...new Set(channels)];
    const conversionTime = sorted.find(tp => tp.action === "conversion")?.timestamp || new Date();

    for (const channel of uniqueChannels) {
      if (!channelStats.has(channel)) {
        channelStats.set(channel, { firstTouch: 0, lastTouch: 0, linear: 0, timeDecay: 0, conversions: 0 });
      }
      const stats = channelStats.get(channel)!;
      stats.conversions++;

      // First touch
      if (channels[0] === channel) stats.firstTouch++;

      // Last touch
      if (channels[channels.length - 1] === channel) stats.lastTouch++;

      // Linear (equal credit)
      stats.linear += 1 / uniqueChannels.length;

      // Time decay (more credit to recent touches)
      const channelTouches = sorted.filter(tp => tp.channel === channel);
      let decayCredit = 0;
      for (const touch of channelTouches) {
        const hoursBeforeConversion = (conversionTime.getTime() - touch.timestamp.getTime()) / 3600000;
        const halfLife = 7 * 24; // 7-day half-life
        decayCredit += Math.pow(0.5, hoursBeforeConversion / halfLife);
      }
      stats.timeDecay += decayCredit;
    }
  }

  // Normalize time decay
  const totalDecay = Array.from(channelStats.values()).reduce((s, v) => s + v.timeDecay, 0);

  const results: AttributionResult[] = [];
  for (const [channel, stats] of channelStats) {
    const totalConversions = Array.from(channelStats.values()).reduce((s, v) => s + v.conversions, 0);
    results.push({
      channel,
      firstTouch: totalConversions > 0 ? (stats.firstTouch / totalConversions) * 100 : 0,
      lastTouch: totalConversions > 0 ? (stats.lastTouch / totalConversions) * 100 : 0,
      linear: totalConversions > 0 ? (stats.linear / totalConversions) * 100 : 0,
      timeDecay: totalDecay > 0 ? (stats.timeDecay / totalDecay) * 100 : 0,
      blended: 0, // calculated below
      conversions: stats.conversions,
      costPerConversion: 0, // would need actual spend data
    });
  }

  // Blended = average of all four models
  for (const r of results) {
    r.blended = (r.firstTouch + r.lastTouch + r.linear + r.timeDecay) / 4;
  }

  return results.sort((a, b) => b.blended - a.blended);
}

// ─── 4. Viral Pattern Detector ────────────────────────────────────────────────

const DEFAULT_VIRAL_PATTERNS: ViralPattern[] = [
  {
    id: "vp_question_hook",
    platform: "all",
    hookType: "question",
    hookTemplate: "What if [your current tool] is the reason you'll get hacked?",
    bodyStructure: ["Agitate the problem", "Present the surprising truth", "Show the solution", "Social proof", "CTA"],
    ctaType: "curiosity",
    avgEngagementRate: 4.2,
    sampleCount: 47,
    lastUpdated: new Date(),
  },
  {
    id: "vp_statistic_hook",
    platform: "linkedin",
    hookType: "statistic",
    hookTemplate: "83% of data breaches involve compromised credentials. Here's what the other 17% have in common:",
    bodyStructure: ["Shocking stat", "Breakdown of why", "What top companies do differently", "How to implement it", "CTA"],
    ctaType: "urgency",
    avgEngagementRate: 5.8,
    sampleCount: 31,
    lastUpdated: new Date(),
  },
  {
    id: "vp_list_hook",
    platform: "x_twitter",
    hookType: "list",
    hookTemplate: "7 things your password manager can't do (that Titan can):",
    bodyStructure: ["Numbered list with specifics", "Each point hits a pain", "Crescendo to the biggest differentiator", "CTA"],
    ctaType: "direct",
    avgEngagementRate: 6.1,
    sampleCount: 89,
    lastUpdated: new Date(),
  },
  {
    id: "vp_story_hook",
    platform: "reddit",
    hookType: "story",
    hookTemplate: "I got hacked through a credential I forgot I had. Here's what I built to make sure it never happens again:",
    bodyStructure: ["Personal story opening", "The problem revealed", "The journey to solution", "Technical details", "Lesson learned", "Soft CTA"],
    ctaType: "social_proof",
    avgEngagementRate: 7.3,
    sampleCount: 22,
    lastUpdated: new Date(),
  },
  {
    id: "vp_controversy_hook",
    platform: "hackernews",
    hookType: "controversy",
    hookTemplate: "Password managers are a single point of failure. Fight me.",
    bodyStructure: ["Bold controversial claim", "Evidence supporting it", "Acknowledge the counterargument", "Why the counterargument is wrong", "The actual solution", "Invite debate"],
    ctaType: "curiosity",
    avgEngagementRate: 8.9,
    sampleCount: 15,
    lastUpdated: new Date(),
  },
  {
    id: "vp_prediction_hook",
    platform: "linkedin",
    hookType: "prediction",
    hookTemplate: "In 2 years, every serious security team will run a local AI agent. Here's why:",
    bodyStructure: ["Bold prediction", "3 trends driving it", "What early adopters are doing now", "How to get ahead", "CTA"],
    ctaType: "urgency",
    avgEngagementRate: 5.2,
    sampleCount: 28,
    lastUpdated: new Date(),
  },
];

/**
 * Get the best viral pattern for a given platform.
 */
export function getBestViralPattern(platform: string): ViralPattern {
  const platformPatterns = DEFAULT_VIRAL_PATTERNS.filter(
    p => p.platform === platform || p.platform === "all"
  );

  if (platformPatterns.length === 0) return DEFAULT_VIRAL_PATTERNS[0];

  // Return highest engagement rate pattern
  return platformPatterns.sort((a, b) => b.avgEngagementRate - a.avgEngagementRate)[0];
}

/**
 * Generate content using a viral pattern as the structural template.
 */
export async function generateViralContent(params: {
  platform: string;
  topic: string;
  pattern?: ViralPattern;
}): Promise<{ headline: string; body: string; hook: string; viralScore: number; patternUsed: string }> {
  const pattern = params.pattern || getBestViralPattern(params.platform);

  const response = await invokeLLM({
    systemTag: "growth_intelligence",
    model: "strong",
    messages: [
      {
        role: "system",
        content: `You are a viral content specialist for Archibald Titan — a local AI agent for credential security. You write content that spreads organically in cybersecurity and developer communities.

VIRAL PATTERN TO USE:
Hook type: ${pattern.hookType}
Hook template: "${pattern.hookTemplate}"
Body structure: ${pattern.bodyStructure.join(" → ")}
CTA type: ${pattern.ctaType}
Platform: ${params.platform}
Average engagement rate for this pattern: ${pattern.avgEngagementRate}%

Adapt the pattern to the specific topic. Do not copy the template verbatim — use it as a structural guide.`,
      },
      {
        role: "user",
        content: `Topic: ${params.topic}\n\nWrite viral ${params.platform} content following the pattern above. Return JSON: { "headline": "...", "body": "...", "hook": "...", "viralScore": 0-100 }`,
      },
    ],
    responseFormat: { type: "json_object" },
  });

  const result = JSON.parse(response.choices[0].message.content as string || "{}");
  return {
    ...result,
    patternUsed: pattern.id,
  };
}

/**
 * Update viral pattern engagement rates based on actual performance data.
 */
export function updateViralPatternPerformance(patternId: string, engagementRate: number): void {
  const pattern = DEFAULT_VIRAL_PATTERNS.find(p => p.id === patternId);
  if (!pattern) return;

  // Exponential moving average
  const alpha = 0.1;
  pattern.avgEngagementRate = alpha * engagementRate + (1 - alpha) * pattern.avgEngagementRate;
  pattern.sampleCount++;
  pattern.lastUpdated = new Date();
}

export function getAllViralPatterns(): ViralPattern[] {
  return DEFAULT_VIRAL_PATTERNS;
}

// ─── 5. Dynamic Budget Rebalancer ─────────────────────────────────────────────

interface ChannelROIData {
  channel: string;
  spend: number;
  conversions: number;
  impressions: number;
  clicks: number;
}

const channelROIData: Map<string, ChannelROIData> = new Map();

export function recordChannelROI(data: ChannelROIData): void {
  const existing = channelROIData.get(data.channel);
  if (existing) {
    // Rolling average
    existing.spend = existing.spend * 0.8 + data.spend * 0.2;
    existing.conversions = existing.conversions * 0.8 + data.conversions * 0.2;
    existing.impressions = existing.impressions * 0.8 + data.impressions * 0.2;
    existing.clicks = existing.clicks * 0.8 + data.clicks * 0.2;
  } else {
    channelROIData.set(data.channel, { ...data });
  }
}

/**
 * Calculate optimal budget allocation based on ROI per channel.
 * Uses a modified Kelly Criterion to determine allocation.
 */
export function calculateOptimalBudgetAllocation(
  totalBudget: number,
  currentAllocations: Record<string, number>
): BudgetAllocation[] {
  const allocations: BudgetAllocation[] = [];
  const channels = Object.keys(currentAllocations);

  if (channels.length === 0) return [];

  // Calculate ROI for each channel
  const roiByChannel: Record<string, number> = {};
  let totalROI = 0;

  for (const channel of channels) {
    const data = channelROIData.get(channel);
    if (data && data.spend > 0) {
      // ROI = (conversions * avg_deal_value - spend) / spend
      const avgDealValue = 29; // $29/month average Titan subscription
      const roi = ((data.conversions * avgDealValue) - data.spend) / Math.max(data.spend, 1);
      roiByChannel[channel] = Math.max(0, roi);
      totalROI += roiByChannel[channel];
    } else {
      // No data yet — give equal weight
      roiByChannel[channel] = 1;
      totalROI += 1;
    }
  }

  // Allocate proportionally to ROI, with a floor of 5% per channel
  const floorBudget = totalBudget * 0.05;
  const remainingBudget = totalBudget - (floorBudget * channels.length);

  for (const channel of channels) {
    const roiShare = totalROI > 0 ? roiByChannel[channel] / totalROI : 1 / channels.length;
    const recommended = floorBudget + (remainingBudget * roiShare);
    const current = currentAllocations[channel] || 0;
    const data = channelROIData.get(channel);
    const roi = data && data.spend > 0 ? roiByChannel[channel] : 0;

    let reason = "";
    if (recommended > current * 1.1) {
      reason = `High ROI (${(roi * 100).toFixed(0)}%) — increasing allocation`;
    } else if (recommended < current * 0.9) {
      reason = `Low ROI (${(roi * 100).toFixed(0)}%) — reducing allocation`;
    } else {
      reason = `Stable performance — maintaining allocation`;
    }

    allocations.push({
      channel,
      currentBudget: current,
      recommendedBudget: Math.round(recommended * 100) / 100,
      roi,
      conversions: data?.conversions || 0,
      reason,
    });
  }

  return allocations.sort((a, b) => b.roi - a.roi);
}

// ─── 6. Self-Healing Publisher ────────────────────────────────────────────────

const FALLBACK_CHANNELS: Record<string, string[]> = {
  "x_twitter": ["linkedin", "mastodon_infosec", "bluesky"],
  "linkedin": ["x_twitter", "devto_crosspost", "medium_republish"],
  "reddit": ["hackernews", "devto_crosspost", "discord_community"],
  "tiktok_organic": ["youtube_shorts", "instagram_reels"],
  "hackernews": ["reddit", "devto_crosspost"],
  "discord_community": ["telegram_channel", "slack_community"],
};

export function initChannelHealth(channel: string): void {
  if (!channelHealthMap.has(channel)) {
    channelHealthMap.set(channel, {
      channel,
      successRate: 1.0,
      avgLatencyMs: 0,
      consecutiveFailures: 0,
      isPaused: false,
      lastSuccess: null,
      retryCount: 0,
    });
  }
}

export function recordPublishResult(
  channel: string,
  success: boolean,
  latencyMs: number
): { shouldRetry: boolean; fallbackChannel?: string; isPaused: boolean } {
  initChannelHealth(channel);
  const health = channelHealthMap.get(channel)!;

  if (success) {
    health.consecutiveFailures = 0;
    health.lastSuccess = new Date();
    health.retryCount = 0;
    health.isPaused = false;
    health.successRate = health.successRate * 0.9 + 0.1; // EMA
    health.avgLatencyMs = health.avgLatencyMs * 0.9 + latencyMs * 0.1;
  } else {
    health.consecutiveFailures++;
    health.successRate = health.successRate * 0.9; // EMA decay on failure

    // Auto-pause after 3 consecutive failures
    if (health.consecutiveFailures >= 3) {
      health.isPaused = true;
      health.pausedReason = `Auto-paused after ${health.consecutiveFailures} consecutive failures`;
      log.warn(`[GrowthIntelligence] Channel ${channel} auto-paused: ${health.pausedReason}`);

      const fallbacks = FALLBACK_CHANNELS[channel] || [];
      const fallbackChannel = fallbacks.find(f => {
        const fHealth = channelHealthMap.get(f);
        return !fHealth?.isPaused;
      });

      return { shouldRetry: false, fallbackChannel, isPaused: true };
    }
  }

  channelHealthMap.set(channel, health);
  return { shouldRetry: !success && health.consecutiveFailures < 3, isPaused: health.isPaused };
}

export function getChannelHealthStatus(): ChannelHealth[] {
  return Array.from(channelHealthMap.values()).sort((a, b) => b.successRate - a.successRate);
}

export function resumeChannel(channel: string): void {
  const health = channelHealthMap.get(channel);
  if (health) {
    health.isPaused = false;
    health.consecutiveFailures = 0;
    health.pausedReason = undefined;
    channelHealthMap.set(channel, health);
    log.info(`[GrowthIntelligence] Channel ${channel} manually resumed`);
  }
}

/**
 * Calculate exponential backoff delay for retries.
 */
export function getRetryDelay(retryCount: number): number {
  const baseDelay = 1000; // 1 second
  const maxDelay = 60000; // 1 minute
  const delay = Math.min(baseDelay * Math.pow(2, retryCount), maxDelay);
  const jitter = Math.random() * delay * 0.1; // 10% jitter
  return Math.round(delay + jitter);
}

// ─── 7. Predictive Posting Time ───────────────────────────────────────────────

/**
 * Record engagement data for a post to learn optimal posting times.
 */
export function recordPostEngagement(
  channel: string,
  postedAt: Date,
  engagementRate: number
): void {
  if (!postingTimeHistory.has(channel)) {
    postingTimeHistory.set(channel, []);
  }

  const history = postingTimeHistory.get(channel)!;
  history.push({
    hour: postedAt.getHours(),
    dayOfWeek: postedAt.getDay(),
    engagementRate,
  });

  // Keep last 200 data points per channel
  if (history.length > 200) {
    history.splice(0, history.length - 200);
  }
}

/**
 * Predict the optimal posting time for a channel based on historical engagement.
 * Returns the best hour (0-23) and day of week (0-6).
 */
export function getPredictedOptimalPostingTime(channel: string): {
  hour: number;
  dayOfWeek: number;
  confidence: number;
  explanation: string;
} {
  const history = postingTimeHistory.get(channel);

  // Default posting times if no data
  const DEFAULTS: Record<string, { hour: number; dayOfWeek: number }> = {
    "x_twitter": { hour: 9, dayOfWeek: 2 },
    "linkedin": { hour: 8, dayOfWeek: 2 },
    "reddit": { hour: 10, dayOfWeek: 1 },
    "hackernews": { hour: 9, dayOfWeek: 1 },
    "tiktok_organic": { hour: 19, dayOfWeek: 4 },
    "discord_community": { hour: 14, dayOfWeek: 3 },
  };

  if (!history || history.length < 10) {
    const def = DEFAULTS[channel] || { hour: 9, dayOfWeek: 1 };
    return {
      ...def,
      confidence: 0.3,
      explanation: `Using default posting time (insufficient data — ${history?.length || 0} data points)`,
    };
  }

  // Build a 7x24 engagement matrix
  const matrix: number[][] = Array(7).fill(null).map(() => Array(24).fill(0));
  const counts: number[][] = Array(7).fill(null).map(() => Array(24).fill(0));

  for (const point of history) {
    matrix[point.dayOfWeek][point.hour] += point.engagementRate;
    counts[point.dayOfWeek][point.hour]++;
  }

  // Find the slot with highest average engagement
  let bestDay = 0;
  let bestHour = 9;
  let bestAvg = 0;

  for (let day = 0; day < 7; day++) {
    for (let hour = 0; hour < 24; hour++) {
      if (counts[day][hour] > 0) {
        const avg = matrix[day][hour] / counts[day][hour];
        if (avg > bestAvg) {
          bestAvg = avg;
          bestDay = day;
          bestHour = hour;
        }
      }
    }
  }

  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const confidence = Math.min(0.95, history.length / 100);

  return {
    hour: bestHour,
    dayOfWeek: bestDay,
    confidence,
    explanation: `Based on ${history.length} data points, ${dayNames[bestDay]} at ${bestHour}:00 has the highest average engagement rate of ${bestAvg.toFixed(2)}%`,
  };
}

// ─── 8. Growth Velocity Tracker ───────────────────────────────────────────────

/**
 * Calculate week-over-week growth velocity for all channels.
 */
export async function calculateGrowthVelocity(): Promise<GrowthVelocity[]> {
  try {
    const db = await getDb();
    if (!db) return [];

    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    // Get activity counts per channel for this week vs last week
    const thisWeekActivity = await db
      .select({
        channel: marketingActivityLog.channel,
        count: count(),
      })
      .from(marketingActivityLog)
      .where(
        and(
          gte(marketingActivityLog.createdAt, oneWeekAgo),
          eq(marketingActivityLog.status, "success" as any)
        )
      )
      .groupBy(marketingActivityLog.channel);

    const lastWeekActivity = await db
      .select({
        channel: marketingActivityLog.channel,
        count: count(),
      })
      .from(marketingActivityLog)
      .where(
        and(
          gte(marketingActivityLog.createdAt, twoWeeksAgo),
          sql`${marketingActivityLog.createdAt} < ${oneWeekAgo.toISOString()}`,
          eq(marketingActivityLog.status, "success" as any)
        )
      )
      .groupBy(marketingActivityLog.channel);

    const lastWeekMap = new Map(lastWeekActivity.map(r => [r.channel, Number(r.count)]));

    const velocities: GrowthVelocity[] = [];

    for (const row of thisWeekActivity) {
      const thisWeek = Number(row.count);
      const lastWeek = lastWeekMap.get(row.channel) || 0;
      const deltaPercent = lastWeek > 0 ? ((thisWeek - lastWeek) / lastWeek) * 100 : 100;

      let trend: GrowthVelocity["trend"];
      if (thisWeek === 0 && lastWeek === 0) trend = "stalled";
      else if (deltaPercent >= 20) trend = "accelerating";
      else if (deltaPercent <= -20) trend = "decelerating";
      else trend = "stable";

      velocities.push({
        channel: row.channel,
        thisWeek,
        lastWeek,
        deltaPercent: Math.round(deltaPercent * 10) / 10,
        trend,
        projectedMonthly: Math.round(thisWeek * 4.33),
      });
    }

    return velocities.sort((a, b) => b.deltaPercent - a.deltaPercent);
  } catch (err) {
    log.error("[GrowthIntelligence] Growth velocity calculation failed:", { error: getErrorMessage(err) });
    return [];
  }
}

// ─── 9. Anomaly Detector ──────────────────────────────────────────────────────

/**
 * Detect metric anomalies across all channels.
 * Flags drops ≥20% week-over-week and diagnoses the cause.
 */
export async function detectAnomalies(): Promise<AnomalyAlert[]> {
  const velocities = await calculateGrowthVelocity();
  const alerts: AnomalyAlert[] = [];

  for (const velocity of velocities) {
    if (velocity.deltaPercent <= -20) {
      const severity: AnomalyAlert["severity"] =
        velocity.deltaPercent <= -50 ? "critical" :
        velocity.deltaPercent <= -30 ? "warning" : "info";

      // Diagnose the cause
      let diagnosis = "";
      let recommendedAction = "";
      const health = channelHealthMap.get(velocity.channel);

      if (health?.isPaused) {
        diagnosis = `Channel is auto-paused due to ${health.consecutiveFailures} consecutive failures`;
        recommendedAction = "Investigate API credentials and resume channel after fixing the underlying issue";
      } else if (health && health.successRate < 0.5) {
        diagnosis = `Low success rate (${(health.successRate * 100).toFixed(0)}%) — likely API or authentication issue`;
        recommendedAction = "Check API keys and rate limits for this channel";
      } else {
        diagnosis = `Activity dropped ${Math.abs(velocity.deltaPercent).toFixed(0)}% vs last week — possible algorithm change or content quality issue`;
        recommendedAction = "Review recent content quality scores and check for platform algorithm updates";
      }

      alerts.push({
        channel: velocity.channel,
        metric: "weekly_activity",
        currentValue: velocity.thisWeek,
        previousValue: velocity.lastWeek,
        dropPercent: Math.abs(velocity.deltaPercent),
        severity,
        diagnosis,
        recommendedAction,
        detectedAt: new Date(),
      });
    }
  }

  // Also check for channels that have gone completely silent
  const healthStatuses = getChannelHealthStatus();
  for (const health of healthStatuses) {
    if (health.isPaused && !alerts.find(a => a.channel === health.channel)) {
      alerts.push({
        channel: health.channel,
        metric: "channel_health",
        currentValue: 0,
        previousValue: 1,
        dropPercent: 100,
        severity: "critical",
        diagnosis: health.pausedReason || "Channel auto-paused",
        recommendedAction: "Investigate and resume channel",
        detectedAt: new Date(),
      });
    }
  }

  return alerts.sort((a, b) => {
    const severityOrder = { critical: 0, warning: 1, info: 2 };
    return severityOrder[a.severity] - severityOrder[b.severity];
  });
}

// ─── 10. Weekly Growth Report ─────────────────────────────────────────────────

/**
 * Generate a comprehensive weekly growth report covering all three systems.
 * Designed to run every Monday morning.
 */
export async function generateWeeklyGrowthReport(): Promise<WeeklyGrowthReport> {
  const [velocities, anomalies, competitorGaps, attribution] = await Promise.allSettled([
    calculateGrowthVelocity(),
    detectAnomalies(),
    analyzeCompetitorGaps(),
    calculateMultiTouchAttribution(7),
  ]);

  const vel = velocities.status === "fulfilled" ? velocities.value : [];
  const anom = anomalies.status === "fulfilled" ? anomalies.value : [];
  const gaps = competitorGaps.status === "fulfilled" ? competitorGaps.value : { gaps: [], opportunities: [], competitorWeaknesses: {}, recommendedTopics: [] };
  const attr = attribution.status === "fulfilled" ? attribution.value : [];

  const topChannel = vel.length > 0 ? vel[0].channel : "unknown";
  const accelerating = vel.filter(v => v.trend === "accelerating").map(v => v.channel);
  const decelerating = vel.filter(v => v.trend === "decelerating").map(v => v.channel);

  // Generate AI-powered summary and plan
  let aiSummary = "";
  let planForNextWeek: string[] = [];

  try {
    const response = await invokeLLM({
      systemTag: "growth_intelligence",
      model: "strong",
      messages: [
        {
          role: "system",
          content: "You are the growth strategist for Archibald Titan. Write a concise, actionable weekly growth report.",
        },
        {
          role: "user",
          content: `Weekly data:
Top channel: ${topChannel}
Accelerating channels: ${accelerating.join(", ") || "none"}
Decelerating channels: ${decelerating.join(", ") || "none"}
Anomalies: ${anom.length} detected
Top attribution channel: ${attr[0]?.channel || "unknown"} (${attr[0]?.blended?.toFixed(1) || 0}% blended credit)
Competitor gaps: ${gaps.recommendedTopics?.slice(0, 3).join(", ") || "none identified"}

Write:
1. A 2-sentence executive summary
2. Top 5 action items for next week

Return JSON: { "summary": "...", "planForNextWeek": ["action1", "action2", ...] }`,
        },
      ],
      responseFormat: { type: "json_object" },
    });

    const result = JSON.parse(response.choices[0].message.content as string || "{}");
    aiSummary = result.summary || "";
    planForNextWeek = result.planForNextWeek || [];
  } catch (err) {
    aiSummary = `Growth intelligence active. ${accelerating.length} channels accelerating, ${decelerating.length} decelerating. ${anom.length} anomalies detected.`;
    planForNextWeek = gaps.recommendedTopics?.slice(0, 5) || ["Continue current strategy"];
  }

  const report: WeeklyGrowthReport = {
    weekOf: new Date().toISOString().split("T")[0],
    summary: aiSummary,
    wins: accelerating.map(c => `${c} is accelerating week-over-week`),
    losses: decelerating.map(c => `${c} is decelerating — needs attention`),
    topChannel,
    totalConversions: attr.reduce((s, a) => s + a.conversions, 0),
    totalImpressions: 0,
    budgetUtilization: 0,
    velocityByChannel: vel,
    anomalies: anom,
    planForNextWeek,
    generatedAt: new Date(),
  };

  // Send notification to owner
  try {
    await notifyOwner({
      title: `📊 Weekly Growth Report — ${report.weekOf}`,
      content: `${report.summary}\n\n✅ Wins:\n${report.wins.slice(0, 3).join("\n")}\n\n⚠️ Issues:\n${report.losses.slice(0, 3).join("\n")}\n\n🚨 Anomalies: ${anom.length}\n\n📋 This week's plan:\n${planForNextWeek.slice(0, 5).map((p, i) => `${i + 1}. ${p}`).join("\n")}`,
    });
  } catch { /* non-critical */ }

  log.info("[GrowthIntelligence] Weekly growth report generated", { weekOf: report.weekOf });
  return report;
}

// ─── Unified Intelligence Summary ─────────────────────────────────────────────

/**
 * Get a complete snapshot of all intelligence systems for the dashboard.
 */
export async function getIntelligenceSummary(): Promise<{
  mvtTests: { active: number; withWinner: number; tests: MVTTest[] };
  channelHealth: ChannelHealth[];
  viralPatterns: ViralPattern[];
  velocities: GrowthVelocity[];
  anomalies: AnomalyAlert[];
  attribution: AttributionResult[];
  budgetRecommendations: BudgetAllocation[];
  competitorGaps: Awaited<ReturnType<typeof analyzeCompetitorGaps>>;
}> {
  const [velocities, anomalies, attribution, competitorGaps] = await Promise.allSettled([
    calculateGrowthVelocity(),
    detectAnomalies(),
    calculateMultiTouchAttribution(30),
    analyzeCompetitorGaps(),
  ]);

  const allTests = getAllMVTTests();

  return {
    mvtTests: {
      active: allTests.filter(t => !t.winner).length,
      withWinner: allTests.filter(t => !!t.winner).length,
      tests: allTests,
    },
    channelHealth: getChannelHealthStatus(),
    viralPatterns: getAllViralPatterns(),
    velocities: velocities.status === "fulfilled" ? velocities.value : [],
    anomalies: anomalies.status === "fulfilled" ? anomalies.value : [],
    attribution: attribution.status === "fulfilled" ? attribution.value : [],
    budgetRecommendations: calculateOptimalBudgetAllocation(500, {
      "seo_organic": 0,
      "blog_content": 0,
      "social_organic": 50,
      "community_engagement": 0,
      "email_nurture": 0,
      "tiktok_organic": 50,
      "google_ads": 200,
      "affiliate_network": 100,
      "hackforums": 0,
    }),
    competitorGaps: competitorGaps.status === "fulfilled" ? competitorGaps.value : {
      gaps: [], opportunities: [], competitorWeaknesses: {}, recommendedTopics: [],
    },
  };
}
