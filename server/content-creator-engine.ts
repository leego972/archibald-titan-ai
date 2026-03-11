/**
 * Content Creator Engine v3.0 — Archibald Titan
 *
 * Fully autonomous AI-powered content generation and distribution system.
 * Operates without manual intervention: generates, scores, auto-approves,
 * schedules at optimal times, and publishes across 15 platforms.
 *
 * Architecture:
 *  ┌─────────────────────────────────────────────────────────────┐
 *  │  SEO Engine → keyword briefs & content gaps                 │
 *  │  Advertising Orchestrator → campaign context & strategy     │
 *  │  TikTok Content Service → organic posting pipeline          │
 *  │  Marketing Engine → brand voice & performance data          │
 *  └─────────────────────────────────────────────────────────────┘
 *
 * Autonomous Loop:
 *  1. Pull live SEO briefs + keyword gaps
 *  2. Generate platform-optimised content for all 15 channels
 *  3. Score each piece (quality + SEO + virality + brand alignment)
 *  4. Auto-approve pieces scoring ≥ 75 — no human needed
 *  5. Schedule at optimal posting times per platform
 *  6. Publish via TikTok API or mark ready for other platforms
 *  7. Track performance and feed back into next cycle
 */

import { getDb } from "./db";
import { invokeLLM } from "./_core/llm";
import { generateImage } from "./_core/imageGeneration";
import { createLogger } from "./_core/logger.js";
import { getErrorMessage } from "./_core/errors.js";
import {
  contentCreatorCampaigns,
  contentCreatorPieces,
  contentCreatorSchedules,
  contentCreatorAnalytics,
  marketingContent,
  marketingActivityLog,
} from "../drizzle/schema";
import { eq, desc, and, gte, lte, sql, count, lt } from "drizzle-orm";
import {
  generateContentBriefs,
  analyzeKeywords,
  type ContentBrief,
  type KeywordAnalysis,
} from "./seo-engine";
import {
  generateTikTokContentPlan,
  generateCarouselImages,
  postPhotos,
  postVideoByUrl,
  isTikTokContentConfigured,
  type TikTokPostResult,
} from "./tiktok-content-service";
import { getStrategyOverview } from "./advertising-orchestrator";

const log = createLogger("ContentCreatorEngine");

// ─── Brand Context ─────────────────────────────────────────────────────────
const BRAND = {
  name: "Archibald Titan",
  tagline: "The World's Most Advanced Local AI Agent",
  website: "https://archibaldtitan.com",
  tone: "Confident, technical, authoritative but approachable. Think Iron Man's JARVIS meets a world-class cybersecurity expert. Never corporate, always sharp.",
  voice: {
    hooks: [
      "Most people don't know their credentials are already leaked.",
      "Your password manager just became your biggest security risk.",
      "I built an AI that runs entirely on your machine. Here's why that matters.",
      "ChatGPT can't do this. Archibald Titan can.",
      "Stop trusting the cloud with your secrets.",
      "The AI that actually protects you — not just assists you.",
      "Your data. Your machine. Your AI.",
      "One breach can end a business. This prevents it.",
    ],
    ctaVariants: [
      "Download free at archibaldtitan.com",
      "Try Archibald Titan free — no cloud required",
      "Get your free security audit at archibaldtitan.com",
      "Start protecting your credentials today",
      "Join 10,000+ security professionals using Titan",
    ],
  },
  keyFeatures: [
    "AI-powered chat assistant with autonomous code execution",
    "Secure credential vault with breach monitoring",
    "TOTP two-factor authentication manager",
    "Dark web leak scanner",
    "Website replication engine",
    "Sandbox code execution environment",
    "Cross-platform (Web + Desktop via Electron)",
    "Titan Builder — AI that builds full software for you",
  ],
  targetAudiences: [
    "Cybersecurity professionals and penetration testers",
    "Software developers and DevOps engineers",
    "IT administrators and security teams",
    "Tech-savvy professionals who value privacy",
    "Small business owners needing enterprise-grade security",
    "CTOs and security leads at startups",
  ],
  painPoints: [
    "Credential breaches costing businesses millions",
    "Cloud-based password managers being hacked",
    "AI tools sending sensitive data to third-party servers",
    "Manual code execution wasting developer time",
    "No single tool combining AI + security + automation",
  ],
  competitors: ["1Password", "LastPass", "Bitwarden", "GitHub Copilot", "ChatGPT"],
  differentiators: [
    "100% local — your data never leaves your machine",
    "AI + security + automation in one platform",
    "Titan Builder creates full software autonomously",
    "Dark web monitoring built-in",
    "No subscription required for core features",
  ],
  artStyle: {
    prefix: "Dark futuristic cyberpunk digital art, chrome-armored AI knight warrior with glowing blue eyes, deep navy midnight blue background with electric blue circuit patterns and digital particles, metallic silver armor with blue LED accents, bold metallic 3D text,",
    suffix: "high quality digital illustration, cinematic lighting, tech aesthetic, dark background with blue glow effects, professional marketing campaign art, 4K ultra-detailed",
  },
  campaignImages: [
    "https://files.manuscdn.com/user_upload_by_module/session_file/310519663339631904/gvTVttaFEQstvWuh.png",
    "https://files.manuscdn.com/user_upload_by_module/session_file/310519663339631904/KeTLfaSXYpSzZYrC.png",
    "https://files.manuscdn.com/user_upload_by_module/session_file/310519663339631904/myFnaqFpXtIwMYmX.png",
    "https://files.manuscdn.com/user_upload_by_module/session_file/310519663339631904/UmexBzectsHuvsNd.png",
    "https://files.manuscdn.com/user_upload_by_module/session_file/310519663339631904/RGWrfdQoAtcdKjif.png",
    "https://files.manuscdn.com/user_upload_by_module/session_file/310519663339631904/eLBbWQGICiDYYbYD.png",
  ],
  get defaultImage() {
    return this.campaignImages[Math.floor(Math.random() * this.campaignImages.length)];
  },
};

// ─── Autonomous Configuration ──────────────────────────────────────────────
export const AUTONOMOUS_CONFIG = {
  autoApproveThreshold: 75,       // pieces scoring ≥ 75 are auto-approved
  autoScheduleAfterApproval: true, // auto-schedule approved pieces immediately
  batchSize: 5,                    // pieces per autonomous cycle
  cycleIntervalHours: 6,           // run every 6 hours
  maxDailyPieces: 20,              // cap to avoid spam
  platforms: ["tiktok", "instagram", "x_twitter", "linkedin", "reddit", "blog", "email", "youtube_shorts"],
};

// ─── Optimal Posting Times (UTC) ──────────────────────────────────────────
const OPTIMAL_POSTING_HOURS: Record<string, number[]> = {
  tiktok: [19, 20, 21],           // 7-9pm peak
  instagram: [11, 19, 20],        // 11am, 7-8pm
  x_twitter: [9, 12, 17, 20],     // 9am, noon, 5pm, 8pm
  linkedin: [8, 12, 17],          // 8am, noon, 5pm
  reddit: [10, 14, 20],           // 10am, 2pm, 8pm
  facebook: [13, 15, 20],         // 1pm, 3pm, 8pm
  youtube_shorts: [15, 18, 20],   // 3pm, 6pm, 8pm
  blog: [9, 10],                  // 9-10am
  email: [9, 10, 14],             // 9-10am, 2pm
  pinterest: [20, 21, 22],        // 8-10pm
  discord: [18, 19, 20],          // 6-8pm
  telegram: [9, 18],              // 9am, 6pm
  medium: [9, 10],                // 9-10am
  hackernews: [9, 10, 14],        // 9-10am, 2pm
  whatsapp: [9, 18],              // 9am, 6pm
};

// ─── Platform Configuration ────────────────────────────────────────────────
export const PLATFORM_CONFIG: Record<string, {
  label: string;
  maxChars: number;
  maxHashtags: number;
  contentTypes: string[];
  guidelines: string;
  seoWeight: number;
  viralityFactors: string[];
}> = {
  tiktok: {
    label: "TikTok",
    maxChars: 2200,
    maxHashtags: 10,
    contentTypes: ["video_script", "photo_carousel"],
    guidelines: "Hook in first 3 seconds. Vertical format. Educational or entertaining. 15-60 seconds optimal. Use trending audio hooks. End with strong CTA. Pattern interrupt every 5 seconds.",
    seoWeight: 0.3,
    viralityFactors: ["strong_hook", "educational_value", "controversy", "relatable_pain_point", "surprising_fact"],
  },
  instagram: {
    label: "Instagram",
    maxChars: 2200,
    maxHashtags: 30,
    contentTypes: ["photo_carousel", "reel", "story", "social_post"],
    guidelines: "Visual-first. Carousel posts get 3x more engagement. Stories for urgency. Reels for reach. Strong opening line before 'more' fold. Save-worthy content.",
    seoWeight: 0.2,
    viralityFactors: ["save_worthy", "share_worthy", "aesthetic_visual", "step_by_step", "list_format"],
  },
  x_twitter: {
    label: "X (Twitter)",
    maxChars: 280,
    maxHashtags: 3,
    contentTypes: ["social_post", "thread"],
    guidelines: "Punchy, direct, opinionated. Threads for depth. Hot takes perform well. Engage with replies. Technical audience appreciates real insights. Controversial but accurate.",
    seoWeight: 0.4,
    viralityFactors: ["hot_take", "contrarian_view", "breaking_news", "thread_hook", "quotable"],
  },
  linkedin: {
    label: "LinkedIn",
    maxChars: 3000,
    maxHashtags: 5,
    contentTypes: ["social_post", "ad_copy"],
    guidelines: "Thought leadership tone. Personal story + insight performs best. B2B angle. CTOs and security leaders are the audience. No fluff. Start with a bold statement.",
    seoWeight: 0.6,
    viralityFactors: ["personal_story", "industry_insight", "career_lesson", "data_backed", "contrarian"],
  },
  reddit: {
    label: "Reddit",
    maxChars: 40000,
    maxHashtags: 0,
    contentTypes: ["social_post"],
    guidelines: "Authentic, value-first. No hard selling. Community-appropriate tone. Detailed technical posts perform well. r/netsec, r/cybersecurity, r/devops, r/programming. Ask for feedback.",
    seoWeight: 0.5,
    viralityFactors: ["genuine_value", "technical_depth", "community_question", "show_dont_tell", "honest_limitation"],
  },
  facebook: {
    label: "Facebook",
    maxChars: 63206,
    maxHashtags: 5,
    contentTypes: ["social_post", "ad_copy"],
    guidelines: "Conversational tone. Behind-the-scenes content works well. Video gets priority reach. Groups for community building. Question posts drive comments.",
    seoWeight: 0.2,
    viralityFactors: ["question_format", "behind_scenes", "community_poll", "emotional_hook", "share_trigger"],
  },
  youtube_shorts: {
    label: "YouTube Shorts",
    maxChars: 5000,
    maxHashtags: 15,
    contentTypes: ["video_script", "reel"],
    guidelines: "Vertical 9:16 format. Under 60 seconds. Hook in first 2 seconds. Educational content performs best. Strong thumbnail concept. Subscribe CTA at end.",
    seoWeight: 0.7,
    viralityFactors: ["educational_hook", "quick_tip", "before_after", "myth_busting", "tutorial_format"],
  },
  blog: {
    label: "Blog",
    maxChars: 100000,
    maxHashtags: 0,
    contentTypes: ["blog_article"],
    guidelines: "1500-3000 words. SEO-optimised with focus keyword in title, H1, first paragraph, and 3x in body. H2/H3 structure. Include code examples. Internal links. Meta description 155 chars.",
    seoWeight: 1.0,
    viralityFactors: ["comprehensive_guide", "original_research", "step_by_step", "comparison", "case_study"],
  },
  email: {
    label: "Email",
    maxChars: 10000,
    maxHashtags: 0,
    contentTypes: ["email_campaign"],
    guidelines: "Subject line under 50 chars with power word. Preview text under 90 chars. Single CTA. Mobile-first. Personalisation tokens. 3-5 short paragraphs. P.S. line for second CTA.",
    seoWeight: 0.1,
    viralityFactors: ["curiosity_subject", "personalisation", "urgency", "social_proof", "exclusive_value"],
  },
  pinterest: {
    label: "Pinterest",
    maxChars: 500,
    maxHashtags: 20,
    contentTypes: ["infographic", "social_post"],
    guidelines: "Vertical image 2:3 ratio. SEO-rich descriptions. Keywords in title. Actionable content. Link to landing page. How-to and list formats dominate.",
    seoWeight: 0.6,
    viralityFactors: ["how_to", "list_format", "inspirational", "actionable_tip", "visual_impact"],
  },
  discord: {
    label: "Discord",
    maxChars: 2000,
    maxHashtags: 0,
    contentTypes: ["social_post"],
    guidelines: "Community-first. Value before promotion. Share tools, tips, and insights. Engage in cybersecurity and developer servers. Ask questions to spark discussion.",
    seoWeight: 0.1,
    viralityFactors: ["community_value", "tool_share", "question_spark", "exclusive_tip", "discussion_starter"],
  },
  telegram: {
    label: "Telegram",
    maxChars: 4096,
    maxHashtags: 5,
    contentTypes: ["social_post"],
    guidelines: "Broadcast channel style. Security alerts, product updates, tips. Concise and actionable. Emoji for visual breaks. Links to full content.",
    seoWeight: 0.1,
    viralityFactors: ["breaking_alert", "exclusive_tip", "quick_win", "product_update", "security_warning"],
  },
  medium: {
    label: "Medium",
    maxChars: 100000,
    maxHashtags: 5,
    contentTypes: ["blog_article"],
    guidelines: "Republish blog posts with canonical URLs. 5-10 min read. Technical depth appreciated. 100M+ monthly readers. Claps come from genuine insight.",
    seoWeight: 0.8,
    viralityFactors: ["deep_insight", "personal_experience", "technical_tutorial", "industry_analysis", "controversial_take"],
  },
  hackernews: {
    label: "Hacker News",
    maxChars: 10000,
    maxHashtags: 0,
    contentTypes: ["social_post"],
    guidelines: "Technical, concise, no marketing speak. HN audience hates fluff. Show HN format for product launches. 50-150 words. Acknowledge limitations honestly.",
    seoWeight: 0.9,
    viralityFactors: ["technical_novelty", "honest_limitations", "show_hn_format", "interesting_problem", "open_source_angle"],
  },
  whatsapp: {
    label: "WhatsApp",
    maxChars: 4096,
    maxHashtags: 0,
    contentTypes: ["social_post"],
    guidelines: "Broadcast to opted-in subscribers. Security alerts, weekly tips, product updates. Conversational tone. Short paragraphs. Emoji sparingly.",
    seoWeight: 0.1,
    viralityFactors: ["urgent_alert", "exclusive_tip", "weekly_roundup", "product_news", "actionable_advice"],
  },
};

// ─── Multi-Dimensional Quality Scorer ─────────────────────────────────────
export interface ContentQualityResult {
  overall: number;
  seoScore: number;
  engagementScore: number;
  viralityScore: number;
  brandAlignmentScore: number;
  readabilityScore: number;
  ctaStrengthScore: number;
  breakdown: Record<string, number>;
  suggestions: string[];
  autoApprove: boolean;
}

export function scoreContentQuality(params: {
  body: string;
  platform: string;
  seoKeywords?: string[];
  hashtags?: string[];
  callToAction?: string;
  hook?: string;
  title?: string;
  headline?: string;
}): ContentQualityResult {
  const config = PLATFORM_CONFIG[params.platform];
  const breakdown: Record<string, number> = {};
  const suggestions: string[] = [];

  // ── 1. SEO Score ──────────────────────────────────────────────────────────
  let seoScore = 0;
  if (config && config.seoWeight > 0) {
    const bodyLower = params.body.toLowerCase();
    const titleLower = (params.title || "").toLowerCase();

    if (params.seoKeywords && params.seoKeywords.length > 0) {
      const bodyMatches = params.seoKeywords.filter(kw => bodyLower.includes(kw.toLowerCase())).length;
      const titleMatches = params.seoKeywords.filter(kw => titleLower.includes(kw.toLowerCase())).length;
      seoScore += Math.min(bodyMatches * 15, 50);
      seoScore += titleMatches * 20;
    }

    // Keyword density check (0.5-2.5% is ideal)
    if (params.seoKeywords?.[0]) {
      const kw = params.seoKeywords[0].toLowerCase();
      const wordCount = params.body.split(/\s+/).length;
      const kwCount = (params.body.toLowerCase().match(new RegExp(kw, "g")) || []).length;
      const density = wordCount > 0 ? (kwCount / wordCount) * 100 : 0;
      if (density >= 0.5 && density <= 2.5) seoScore += 20;
      else if (density > 0) seoScore += 10;
      else suggestions.push(`Add primary keyword "${params.seoKeywords[0]}" to the content`);
    }

    seoScore = Math.min(seoScore, 100);
  } else {
    seoScore = 70; // non-SEO platforms get neutral score
  }
  breakdown.seo = seoScore;

  // ── 2. Engagement Score ───────────────────────────────────────────────────
  let engagementScore = 40;
  const len = params.body.length;

  if (config) {
    if (len > 50 && len <= config.maxChars) engagementScore += 15;
    if (len > config.maxChars * 0.3 && len <= config.maxChars * 0.8) engagementScore += 10;
    if (len > config.maxChars) {
      engagementScore -= 20;
      suggestions.push(`Content exceeds ${config.maxChars} character limit for ${config.label}`);
    }
  }

  if (params.callToAction && params.callToAction.length > 5) {
    engagementScore += 15;
    // Strong CTA verbs
    const strongVerbs = ["download", "get", "start", "try", "join", "discover", "learn", "protect", "secure"];
    if (strongVerbs.some(v => params.callToAction!.toLowerCase().includes(v))) engagementScore += 10;
  } else {
    suggestions.push("Add a clear call-to-action");
  }

  if (params.hook && params.hook.length > 10) {
    engagementScore += 10;
    // Question hooks or stat hooks score higher
    if (params.hook.includes("?") || /\d/.test(params.hook)) engagementScore += 5;
  } else if (["tiktok", "instagram", "youtube_shorts"].includes(params.platform)) {
    suggestions.push("Add a strong hook for video/short-form content");
  }

  engagementScore = Math.min(engagementScore, 100);
  breakdown.engagement = engagementScore;

  // ── 3. Virality Score ─────────────────────────────────────────────────────
  let viralityScore = 30;
  const bodyLower = params.body.toLowerCase();

  // Power words that drive shares
  const powerWords = ["secret", "never", "always", "mistake", "wrong", "truth", "exposed", "warning", "critical", "shocking", "proven", "guaranteed", "free", "instant", "exclusive"];
  const powerWordCount = powerWords.filter(w => bodyLower.includes(w)).length;
  viralityScore += Math.min(powerWordCount * 8, 30);

  // Numbers/stats increase credibility and shareability
  const hasNumbers = /\d+/.test(params.body);
  if (hasNumbers) viralityScore += 15;

  // Question format drives engagement
  if (params.body.includes("?")) viralityScore += 10;

  // Lists are highly shareable
  if (params.body.includes("\n-") || params.body.includes("\n•") || /\d\.\s/.test(params.body)) viralityScore += 15;

  viralityScore = Math.min(viralityScore, 100);
  breakdown.virality = viralityScore;

  // ── 4. Brand Alignment Score ──────────────────────────────────────────────
  let brandScore = 30;
  const brandTerms = ["archibald titan", "titan", "local ai", "credential", "security", "breach", "vault", "dark web", "titan builder", "autonomous"];
  const brandMatches = brandTerms.filter(t => bodyLower.includes(t)).length;
  brandScore += Math.min(brandMatches * 12, 50);

  // Check brand voice alignment
  const toneWords = ["protect", "secure", "advanced", "powerful", "intelligent", "autonomous", "private"];
  const toneMatches = toneWords.filter(t => bodyLower.includes(t)).length;
  brandScore += Math.min(toneMatches * 5, 20);

  if (brandMatches === 0) suggestions.push("Include brand name or key product terms");
  brandScore = Math.min(brandScore, 100);
  breakdown.brandAlignment = brandScore;

  // ── 5. Readability Score ──────────────────────────────────────────────────
  let readabilityScore = 50;
  const sentences = params.body.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const words = params.body.split(/\s+/).filter(w => w.length > 0);
  const avgWordsPerSentence = sentences.length > 0 ? words.length / sentences.length : 0;

  if (avgWordsPerSentence <= 20) readabilityScore += 20;
  else if (avgWordsPerSentence <= 30) readabilityScore += 10;
  else suggestions.push("Use shorter sentences for better readability");

  // Paragraph breaks
  const paragraphs = params.body.split(/\n\n+/).length;
  if (paragraphs >= 2) readabilityScore += 15;

  // Avoid passive voice indicators
  const passiveIndicators = ["was done", "were made", "is being", "has been", "will be done"];
  const passiveCount = passiveIndicators.filter(p => bodyLower.includes(p)).length;
  readabilityScore -= passiveCount * 5;

  readabilityScore = Math.max(0, Math.min(readabilityScore, 100));
  breakdown.readability = readabilityScore;

  // ── 6. CTA Strength Score ─────────────────────────────────────────────────
  let ctaScore = 0;
  if (params.callToAction) {
    ctaScore = 40;
    const urgencyWords = ["now", "today", "free", "limited", "instant", "immediately"];
    if (urgencyWords.some(w => params.callToAction!.toLowerCase().includes(w))) ctaScore += 30;
    if (params.callToAction.includes("archibaldtitan.com") || params.callToAction.includes("http")) ctaScore += 20;
    if (params.callToAction.length > 10 && params.callToAction.length < 80) ctaScore += 10;
  } else {
    suggestions.push("Add a CTA with urgency and a direct link");
  }
  ctaScore = Math.min(ctaScore, 100);
  breakdown.ctaStrength = ctaScore;

  // ── Hashtag Score ─────────────────────────────────────────────────────────
  if (config && params.hashtags) {
    if (params.hashtags.length > 0 && params.hashtags.length <= config.maxHashtags) {
      breakdown.hashtags = 80;
    } else if (params.hashtags.length > config.maxHashtags) {
      breakdown.hashtags = 40;
      suggestions.push(`Reduce hashtags to max ${config.maxHashtags} for ${config.label}`);
    } else {
      breakdown.hashtags = 20;
    }
  }

  // ── Overall Score (weighted) ──────────────────────────────────────────────
  const seoWeight = config?.seoWeight ?? 0.3;
  const overall = Math.round(
    seoScore * seoWeight * 0.25 +
    engagementScore * 0.25 +
    viralityScore * 0.20 +
    brandScore * 0.15 +
    readabilityScore * 0.10 +
    ctaScore * 0.05
  );

  return {
    overall: Math.min(overall, 100),
    seoScore,
    engagementScore,
    viralityScore,
    brandAlignmentScore: brandScore,
    readabilityScore,
    ctaStrengthScore: ctaScore,
    breakdown,
    suggestions,
    autoApprove: overall >= AUTONOMOUS_CONFIG.autoApproveThreshold,
  };
}

// ─── Legacy compat export ──────────────────────────────────────────────────
export function scoreSeoContent(params: {
  body: string;
  title?: string;
  seoKeywords?: string[];
  platform: string;
}): number {
  const result = scoreContentQuality({
    body: params.body,
    title: params.title,
    seoKeywords: params.seoKeywords,
    platform: params.platform,
  });
  return result.seoScore;
}

// ─── Content Generation ────────────────────────────────────────────────────
export interface GenerateContentParams {
  platform: string;
  contentType: string;
  topic?: string;
  seoKeywords?: string[];
  includeImage?: boolean;
  campaignId?: number;
  campaignObjective?: string;
  targetAudience?: string;
  angle?: string;
  useViralHook?: boolean;
}

export interface GeneratedContent {
  title: string;
  headline: string;
  body: string;
  callToAction: string;
  hashtags: string[];
  hook?: string;
  videoScript?: string;
  visualDirections?: string[];
  imagePrompt?: string;
  mediaUrl?: string;
  seoKeywords: string[];
  seoScore: number;
  qualityScore: number;
  qualityBreakdown?: ContentQualityResult;
  generationMs: number;
  abVariants?: Array<{ field: string; variant: string }>;
}

export async function generateCreatorContent(
  params: GenerateContentParams
): Promise<GeneratedContent> {
  const startTime = Date.now();
  const config = PLATFORM_CONFIG[params.platform];
  if (!config) throw new Error(`Unknown platform: ${params.platform}`);

  // Pull advertising context for campaign alignment
  let adContext = "";
  try {
    const strategy = getStrategyOverview();
    if (strategy) {
      adContext = `\nActive campaign budget: $${strategy.monthlyBudget}/month. Current focus: ${strategy.currentFocus || "brand awareness"}. Top performing channel: ${strategy.topChannel || "organic"}.`;
    }
  } catch {}

  // Select a viral hook
  const viralHook = params.useViralHook !== false
    ? BRAND.voice.hooks[Math.floor(Math.random() * BRAND.voice.hooks.length)]
    : "";

  const systemPrompt = `You are the senior content strategist for ${BRAND.name} — ${BRAND.tagline}.

BRAND VOICE: ${BRAND.tone}

KEY DIFFERENTIATORS:
${BRAND.differentiators.map(d => `• ${d}`).join("\n")}

TARGET AUDIENCE PAIN POINTS:
${BRAND.painPoints.map(p => `• ${p}`).join("\n")}

PLATFORM: ${config.label}
PLATFORM GUIDELINES: ${config.guidelines}
CHARACTER LIMIT: ${config.maxChars}
MAX HASHTAGS: ${config.maxHashtags}
${adContext}

VIRAL HOOK TO USE OR ADAPT: "${viralHook}"

Generate content that is genuinely valuable, not generic. Every piece must:
1. Start with a pattern interrupt or surprising statement
2. Deliver real value (tip, insight, or solution)
3. Connect to a specific pain point
4. End with a clear, urgent CTA linking to archibaldtitan.com

Return ONLY valid JSON with this exact structure:
{
  "title": "SEO-optimised title",
  "headline": "Attention-grabbing headline (different from title)",
  "body": "Full content body",
  "callToAction": "Specific CTA text",
  "hashtags": ["hashtag1", "hashtag2"],
  "hook": "Opening hook line (for video/social)",
  "videoScript": "Full video script if applicable, else null",
  "visualDirections": ["Visual direction 1", "Visual direction 2"],
  "imagePrompt": "Detailed image generation prompt",
  "abVariants": [{"field": "headline", "variant": "Alternative headline for A/B test"}]
}`;

  const userPrompt = `Create ${config.label} content for ${BRAND.name}.

Topic: ${params.topic || "Why Archibald Titan is the most advanced local AI agent"}
Content Type: ${params.contentType}
SEO Keywords: ${(params.seoKeywords || ["local AI agent", "credential security", "dark web scanner"]).join(", ")}
Target Audience: ${params.targetAudience || BRAND.targetAudiences[0]}
Campaign Objective: ${params.campaignObjective || "Brand awareness and free trial signups"}
Angle: ${params.angle || "Educational — show the problem, then present Titan as the solution"}

Make this the highest-quality piece of content possible for this platform. Be specific, not generic.`;

  const response = await invokeLLM({
    priority: "background",
    model: "strong",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    responseFormat: { type: "json_object" },
  });

  let parsed: any = {};
  try {
    const raw = response.choices?.[0]?.message?.content as string || "{}";
    parsed = JSON.parse(raw);
  } catch {
    parsed = {
      title: params.topic || "Archibald Titan — Local AI Security Agent",
      headline: viralHook,
      body: `${BRAND.name} is ${BRAND.tagline}. ${BRAND.keyFeatures[0]}. ${BRAND.keyFeatures[1]}.`,
      callToAction: BRAND.voice.ctaVariants[0],
      hashtags: ["#ArcibaldTitan", "#CyberSecurity", "#AI"],
      hook: viralHook,
    };
  }

  // Generate image if requested
  let mediaUrl: string | undefined;
  if (params.includeImage && parsed.imagePrompt) {
    try {
      const styledPrompt = `${BRAND.artStyle.prefix} ${parsed.imagePrompt}. ${BRAND.artStyle.suffix}`;
      const img = await generateImage({
        prompt: styledPrompt,
        originalImages: [{ url: BRAND.defaultImage, mimeType: "image/png" }],
      });
      mediaUrl = img.url;
    } catch (err) {
      log.warn("[ContentCreator] Image generation failed:", { error: getErrorMessage(err) });
      mediaUrl = BRAND.defaultImage;
    }
  }

  const seoKeywords = params.seoKeywords || ["local AI agent", "credential security", "dark web scanner"];
  const qualityResult = scoreContentQuality({
    body: parsed.body || "",
    platform: params.platform,
    seoKeywords,
    hashtags: parsed.hashtags,
    callToAction: parsed.callToAction,
    hook: parsed.hook,
    title: parsed.title,
    headline: parsed.headline,
  });

  return {
    title: parsed.title || "",
    headline: parsed.headline || "",
    body: parsed.body || "",
    callToAction: parsed.callToAction || BRAND.voice.ctaVariants[0],
    hashtags: Array.isArray(parsed.hashtags) ? parsed.hashtags : [],
    hook: parsed.hook,
    videoScript: parsed.videoScript,
    visualDirections: Array.isArray(parsed.visualDirections) ? parsed.visualDirections : [],
    imagePrompt: parsed.imagePrompt,
    mediaUrl,
    seoKeywords,
    seoScore: qualityResult.seoScore,
    qualityScore: qualityResult.overall,
    qualityBreakdown: qualityResult,
    generationMs: Date.now() - startTime,
    abVariants: Array.isArray(parsed.abVariants) ? parsed.abVariants : [],
  };
}

// ─── SEO-Driven Content Briefs ─────────────────────────────────────────────
export interface ContentCreatorBrief {
  topic: string;
  targetKeyword: string;
  secondaryKeywords: string[];
  recommendedPlatforms: string[];
  contentTypes: string[];
  angle: string;
  estimatedImpact: "high" | "medium" | "low";
  seoOpportunity: string;
}

export async function getSeoDrivenBriefs(count = 5): Promise<ContentCreatorBrief[]> {
  try {
    const [seoBriefs, keywordData] = await Promise.allSettled([
      generateContentBriefs(count),
      analyzeKeywords(),
    ]);

    const briefs = seoBriefs.status === "fulfilled" ? seoBriefs.value : [];
    const keywords = keywordData.status === "fulfilled" ? keywordData.value : null;

    const creatorBriefs: ContentCreatorBrief[] = briefs.map(brief => ({
      topic: brief.title,
      targetKeyword: brief.targetKeyword,
      secondaryKeywords: brief.secondaryKeywords || [],
      recommendedPlatforms: ["blog", "linkedin", "x_twitter", "tiktok", "hackernews"],
      contentTypes: ["blog_article", "social_post", "video_script"],
      angle: brief.outline?.[0] || "Educational deep-dive with practical examples",
      estimatedImpact: "high" as const,
      seoOpportunity: `Target keyword: "${brief.targetKeyword}" — ${brief.intent} intent`,
    }));

    if (keywords && keywords.contentGaps?.length > 0) {
      for (const gap of keywords.contentGaps.slice(0, Math.max(0, count - creatorBriefs.length))) {
        creatorBriefs.push({
          topic: gap,
          targetKeyword: gap.toLowerCase(),
          secondaryKeywords: keywords.competitorKeywords?.slice(0, 3) || [],
          recommendedPlatforms: ["blog", "linkedin", "hackernews", "reddit"],
          contentTypes: ["blog_article", "social_post"],
          angle: "Fill content gap — competitors rank for this, we should too",
          estimatedImpact: "medium" as const,
          seoOpportunity: `Content gap vs competitors — high opportunity`,
        });
      }
    }

    return creatorBriefs.slice(0, count);
  } catch (err) {
    log.error("[ContentCreator] Failed to generate SEO briefs:", { error: getErrorMessage(err) });
    return [];
  }
}

// ─── Optimal Posting Time Calculator ──────────────────────────────────────
export function getOptimalPostingTime(platform: string, offsetDays = 0): Date {
  const hours = OPTIMAL_POSTING_HOURS[platform] || [12];
  const now = new Date();
  const targetHour = hours[Math.floor(Math.random() * hours.length)];

  // Find the next occurrence of this hour
  const target = new Date(now);
  target.setDate(target.getDate() + offsetDays);
  target.setHours(targetHour, 0, 0, 0);

  // If the time has already passed today, schedule for tomorrow
  if (target <= now && offsetDays === 0) {
    target.setDate(target.getDate() + 1);
  }

  return target;
}

// ─── Auto-Approve High Quality Content ────────────────────────────────────
export async function autoApproveHighQualityContent(): Promise<{
  approved: number;
  scheduled: number;
  skipped: number;
}> {
  const db = await getDb();
  if (!db) return { approved: 0, scheduled: 0, skipped: 0 };

  const draftPieces = await db.select().from(contentCreatorPieces)
    .where(eq(contentCreatorPieces.status, "draft"))
    .limit(50);

  let approved = 0;
  let scheduled = 0;
  let skipped = 0;

  for (const piece of draftPieces) {
    const qualityScore = piece.qualityScore || 0;

    if (qualityScore >= AUTONOMOUS_CONFIG.autoApproveThreshold) {
      // Auto-approve
      const scheduledAt = getOptimalPostingTime(piece.platform);

      await db.update(contentCreatorPieces).set({
        status: "scheduled",
        scheduledAt,
      }).where(eq(contentCreatorPieces.id, piece.id));

      // Create schedule entry
      await db.insert(contentCreatorSchedules).values({
        pieceId: piece.id,
        campaignId: piece.campaignId,
        platform: piece.platform as any,
        scheduledAt,
        status: "pending",
      });

      approved++;
      scheduled++;

      log.info(`[ContentCreator] Auto-approved piece ${piece.id} (score: ${qualityScore}) — scheduled for ${scheduledAt.toISOString()}`);
    } else {
      skipped++;
      log.info(`[ContentCreator] Piece ${piece.id} score ${qualityScore} below threshold ${AUTONOMOUS_CONFIG.autoApproveThreshold} — needs review`);
    }
  }

  return { approved, scheduled, skipped };
}

// ─── Autonomous Content Cycle ──────────────────────────────────────────────
export interface AutonomousCycleResult {
  success: boolean;
  generated: number;
  autoApproved: number;
  scheduled: number;
  published: number;
  failed: number;
  platforms: string[];
  durationMs: number;
}

export async function runAutonomousContentCycle(options?: {
  platforms?: string[];
  forceGenerate?: boolean;
  maxPieces?: number;
}): Promise<AutonomousCycleResult> {
  const startTime = Date.now();
  const db = await getDb();
  if (!db) return { success: false, generated: 0, autoApproved: 0, scheduled: 0, published: 0, failed: 0, platforms: [], durationMs: 0 };

  const platforms = options?.platforms || AUTONOMOUS_CONFIG.platforms;
  const maxPieces = options?.maxPieces || AUTONOMOUS_CONFIG.batchSize;

  log.info(`[ContentCreator] Starting autonomous cycle — platforms: ${platforms.join(", ")}`);

  let generated = 0;
  let failed = 0;

  // 1. Get SEO-driven content briefs
  const briefs = await getSeoDrivenBriefs(3);
  const topic = briefs[0]?.topic;
  const seoKeywords = briefs[0] ? [briefs[0].targetKeyword, ...briefs[0].secondaryKeywords.slice(0, 3)] : undefined;

  // 2. Get or create an autonomous campaign
  let campaign = (await db.select().from(contentCreatorCampaigns)
    .where(and(
      eq(contentCreatorCampaigns.status, "active"),
      eq(contentCreatorCampaigns.name, "Autonomous Content Campaign"),
    ))
    .limit(1))[0];

  if (!campaign) {
    const [ins] = await db.insert(contentCreatorCampaigns).values({
      name: "Autonomous Content Campaign",
      description: "Automatically generated content across all platforms",
      objective: "brand_awareness",
      status: "active",
      platforms: platforms as any,
      seoEnabled: true,
      tiktokEnabled: isTikTokContentConfigured(),
      advertisingEnabled: true,
    });
    const rows = await db.select().from(contentCreatorCampaigns)
      .where(eq(contentCreatorCampaigns.id, (ins as any).insertId)).limit(1);
    campaign = rows[0];
  }

  if (!campaign) {
    log.error("[ContentCreator] Failed to get/create autonomous campaign");
    return { success: false, generated: 0, autoApproved: 0, scheduled: 0, published: 0, failed: 1, platforms, durationMs: Date.now() - startTime };
  }

  // 3. Generate content for each platform
  const platformsToGenerate = platforms.slice(0, maxPieces);

  for (const platform of platformsToGenerate) {
    const config = PLATFORM_CONFIG[platform];
    if (!config) continue;

    try {
      const content = await generateCreatorContent({
        platform,
        contentType: config.contentTypes[0],
        topic,
        seoKeywords,
        includeImage: ["tiktok", "instagram", "pinterest"].includes(platform),
        campaignId: campaign.id,
        campaignObjective: "brand_awareness",
        useViralHook: true,
      });

      const [ins] = await db.insert(contentCreatorPieces).values({
        campaignId: campaign.id,
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
        aiPrompt: topic || "Autonomous generation",
        aiModel: "gpt-4.1-mini",
        generationMs: content.generationMs,
      } as any);

      generated++;

      // 4. Auto-approve if quality threshold met
      if (content.qualityScore >= AUTONOMOUS_CONFIG.autoApproveThreshold) {
        const scheduledAt = getOptimalPostingTime(platform);
        const pieceId = (ins as any).insertId;

        await db.update(contentCreatorPieces).set({
          status: "scheduled",
          scheduledAt,
        }).where(eq(contentCreatorPieces.id, pieceId));

        await db.insert(contentCreatorSchedules).values({
          pieceId,
          campaignId: campaign.id,
          platform: platform as any,
          scheduledAt,
          status: "pending",
        });

        log.info(`[ContentCreator] Auto-approved ${platform} piece (score: ${content.qualityScore}) — scheduled ${scheduledAt.toISOString()}`);
      }

      await new Promise(r => setTimeout(r, 300));
    } catch (err) {
      log.error(`[ContentCreator] Failed to generate for ${platform}:`, { error: getErrorMessage(err) });
      failed++;
    }
  }

  // 5. Process any due schedules
  const publishResult = await processDueSchedules();

  // 6. Run auto-approve pass on any remaining drafts
  const approveResult = await autoApproveHighQualityContent();

  // 7. Update campaign stats
  await db.update(contentCreatorCampaigns)
    .set({ totalPieces: sql`totalPieces + ${generated}` })
    .where(eq(contentCreatorCampaigns.id, campaign.id));

  // 8. Log to marketing activity
  await db.insert(marketingActivityLog).values({
    action: "autonomous_content_cycle",
    channel: "content_creator",
    details: {
      generated,
      autoApproved: approveResult.approved,
      scheduled: approveResult.scheduled,
      published: publishResult.published,
      platforms,
    },
    status: "success",
  });

  const result: AutonomousCycleResult = {
    success: true,
    generated,
    autoApproved: approveResult.approved,
    scheduled: approveResult.scheduled,
    published: publishResult.published,
    failed,
    platforms,
    durationMs: Date.now() - startTime,
  };

  log.info(`[ContentCreator] Autonomous cycle complete:`, result);
  return result;
}

// ─── Bulk Campaign Generation ──────────────────────────────────────────────
export interface BulkGenerateParams {
  campaignId: number;
  platforms: string[];
  topic?: string;
  seoKeywords?: string[];
  includeImages?: boolean;
  campaignObjective?: string;
}

export interface BulkGenerateResult {
  success: boolean;
  generated: number;
  failed: number;
  autoApproved: number;
  pieces: Array<{ platform: string; contentType: string; id?: number; qualityScore?: number; error?: string }>;
}

export async function bulkGenerateForCampaign(
  params: BulkGenerateParams
): Promise<BulkGenerateResult> {
  const db = await getDb();
  if (!db) return { success: false, generated: 0, failed: 0, autoApproved: 0, pieces: [] };

  const results: BulkGenerateResult["pieces"] = [];
  let generated = 0;
  let failed = 0;
  let autoApproved = 0;

  for (const platform of params.platforms) {
    const config = PLATFORM_CONFIG[platform];
    if (!config) continue;

    const contentType = config.contentTypes[0];

    try {
      const content = await generateCreatorContent({
        platform,
        contentType,
        topic: params.topic,
        seoKeywords: params.seoKeywords,
        includeImage: params.includeImages,
        campaignId: params.campaignId,
        campaignObjective: params.campaignObjective,
        useViralHook: true,
      });

      const shouldAutoApprove = content.qualityScore >= AUTONOMOUS_CONFIG.autoApproveThreshold;
      const scheduledAt = shouldAutoApprove ? getOptimalPostingTime(platform) : undefined;

      const [inserted] = await db.insert(contentCreatorPieces).values({
        campaignId: params.campaignId,
        platform: platform as any,
        contentType: contentType as any,
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
        status: shouldAutoApprove ? "scheduled" : "draft",
        scheduledAt,
        aiPrompt: params.topic || "Bulk generation",
        aiModel: "gpt-4.1-mini",
        generationMs: content.generationMs,
      } as any);

      const pieceId = (inserted as any).insertId;

      if (shouldAutoApprove && scheduledAt) {
        await db.insert(contentCreatorSchedules).values({
          pieceId,
          campaignId: params.campaignId,
          platform: platform as any,
          scheduledAt,
          status: "pending",
        });
        autoApproved++;
      }

      results.push({ platform, contentType, id: pieceId, qualityScore: content.qualityScore });
      generated++;

      await new Promise(r => setTimeout(r, 400));
    } catch (err) {
      log.error(`[ContentCreator] Bulk generation failed for ${platform}:`, { error: getErrorMessage(err) });
      results.push({ platform, contentType, error: getErrorMessage(err) });
      failed++;
    }
  }

  await db.update(contentCreatorCampaigns)
    .set({ totalPieces: sql`totalPieces + ${generated}` })
    .where(eq(contentCreatorCampaigns.id, params.campaignId));

  return { success: generated > 0, generated, failed, autoApproved, pieces: results };
}

// ─── TikTok Integration ────────────────────────────────────────────────────
export interface TikTokPublishParams {
  pieceId: number;
  privacyLevel?: string;
}

export interface TikTokPublishResult {
  success: boolean;
  publishId?: string;
  error?: string;
  action: "posted" | "queued" | "failed";
}

export async function publishPieceToTikTok(
  params: TikTokPublishParams
): Promise<TikTokPublishResult> {
  const db = await getDb();
  if (!db) return { success: false, error: "Database unavailable", action: "failed" };

  const pieces = await db.select().from(contentCreatorPieces)
    .where(eq(contentCreatorPieces.id, params.pieceId))
    .limit(1);

  const piece = pieces[0];
  if (!piece) return { success: false, error: "Content piece not found", action: "failed" };

  if (!["tiktok", "instagram", "youtube_shorts"].includes(piece.platform)) {
    return { success: false, error: `Platform ${piece.platform} does not support TikTok posting`, action: "failed" };
  }

  let postResult: TikTokPostResult;

  if (piece.contentType === "photo_carousel") {
    const imageUrls: string[] = [];
    if (piece.mediaUrl) imageUrls.push(piece.mediaUrl);

    if (piece.visualDirections && (piece.visualDirections as string[]).length > 0 && imageUrls.length < 3) {
      const directions = piece.visualDirections as string[];
      for (const direction of directions.slice(0, 5 - imageUrls.length)) {
        try {
          const styledPrompt = `${BRAND.artStyle.prefix} ${direction}. ${BRAND.artStyle.suffix}. No text in image.`;
          const img = await generateImage({
            prompt: styledPrompt,
            originalImages: [{ url: BRAND.defaultImage, mimeType: "image/png" }],
          });
          if (img.url) imageUrls.push(img.url);
        } catch (err) {
          log.warn("[ContentCreator] Carousel slide generation failed:", { error: getErrorMessage(err) });
        }
      }
    }

    if (imageUrls.length === 0) {
      return { success: false, error: "No images available for carousel", action: "failed" };
    }

    if (isTikTokContentConfigured()) {
      const hashtags = (piece.hashtags as string[] || []).map(h => h.startsWith("#") ? h : `#${h}`).join(" ");
      const caption = `${piece.title || piece.headline || ""}\n\n${piece.body.slice(0, 1500)}\n\n${hashtags}`;
      postResult = await postPhotos({
        photoUrls: imageUrls,
        title: caption.slice(0, 2200),
        description: piece.body.slice(0, 500),
        autoAddMusic: true,
        privacyLevel: params.privacyLevel || "PUBLIC_TO_EVERYONE",
      });
    } else {
      postResult = { success: false, error: "TikTok Content Posting API not configured" };
    }
  } else if (piece.contentType === "video_script" && piece.mediaUrl) {
    if (isTikTokContentConfigured()) {
      const hashtags = (piece.hashtags as string[] || []).map(h => h.startsWith("#") ? h : `#${h}`).join(" ");
      const caption = `${piece.title || ""}\n\n${hashtags}`;
      postResult = await postVideoByUrl({
        videoUrl: piece.mediaUrl,
        title: caption.slice(0, 2200),
        privacyLevel: params.privacyLevel || "PUBLIC_TO_EVERYONE",
      });
    } else {
      postResult = { success: false, error: "TikTok Content Posting API not configured" };
    }
  } else {
    return { success: false, error: "Content type not supported for TikTok posting or no media URL", action: "failed" };
  }

  const newStatus = postResult.success ? "published" : "approved";
  await db.update(contentCreatorPieces).set({
    status: newStatus as any,
    publishedAt: postResult.success ? new Date() : undefined,
    tiktokPublishId: postResult.publishId,
    externalPostId: postResult.publishId,
  }).where(eq(contentCreatorPieces.id, params.pieceId));

  if (postResult.success) {
    await db.insert(marketingContent).values({
      channel: "tiktok" as any,
      contentType: "social_post" as any,
      title: piece.title || piece.headline || "TikTok Post",
      body: piece.body,
      mediaUrl: piece.mediaUrl,
      hashtags: piece.hashtags,
      platform: "tiktok_organic",
      status: "published" as any,
      externalPostId: postResult.publishId,
      publishedAt: new Date(),
      metadata: { source: "content_creator", pieceId: params.pieceId },
    });

    await db.insert(marketingActivityLog).values({
      action: "content_creator_tiktok_post",
      channel: "tiktok",
      details: { pieceId: params.pieceId, publishId: postResult.publishId, title: piece.title },
      status: "success",
    });
  }

  return {
    success: postResult.success,
    publishId: postResult.publishId,
    error: postResult.error,
    action: postResult.success ? "posted" : (postResult.error?.includes("not configured") ? "queued" : "failed"),
  };
}

// ─── Process Due Schedules ─────────────────────────────────────────────────
export async function processDueSchedules(): Promise<{
  processed: number;
  published: number;
  failed: number;
}> {
  const db = await getDb();
  if (!db) return { processed: 0, published: 0, failed: 0 };

  const now = new Date();
  const dueSchedules = await db.select().from(contentCreatorSchedules)
    .where(and(
      eq(contentCreatorSchedules.status, "pending"),
      lte(contentCreatorSchedules.scheduledAt, now),
    ))
    .limit(20);

  let published = 0;
  let failed = 0;

  for (const schedule of dueSchedules) {
    await db.update(contentCreatorSchedules).set({ status: "processing" })
      .where(eq(contentCreatorSchedules.id, schedule.id));

    try {
      if (schedule.platform === "tiktok" && isTikTokContentConfigured()) {
        const result = await publishPieceToTikTok({ pieceId: schedule.pieceId });
        if (result.success) {
          await db.update(contentCreatorSchedules).set({
            status: "published",
            publishedAt: new Date(),
          }).where(eq(contentCreatorSchedules.id, schedule.id));
          published++;
        } else {
          throw new Error(result.error || "TikTok post failed");
        }
      } else {
        // For non-TikTok platforms, mark as published (content is ready)
        await db.update(contentCreatorSchedules).set({
          status: "published",
          publishedAt: new Date(),
        }).where(eq(contentCreatorSchedules.id, schedule.id));
        await db.update(contentCreatorPieces).set({
          status: "published",
          publishedAt: new Date(),
        }).where(eq(contentCreatorPieces.id, schedule.pieceId));
        published++;
      }
    } catch (err) {
      const retryCount = schedule.retryCount + 1;
      const shouldRetry = retryCount < schedule.maxRetries;
      await db.update(contentCreatorSchedules).set({
        status: shouldRetry ? "pending" : "failed",
        retryCount,
        failReason: getErrorMessage(err),
        scheduledAt: shouldRetry ? new Date(Date.now() + 15 * 60 * 1000) : schedule.scheduledAt,
      }).where(eq(contentCreatorSchedules.id, schedule.id));
      failed++;
    }
  }

  return { processed: dueSchedules.length, published, failed };
}

// ─── Campaign Analytics ────────────────────────────────────────────────────
export async function getCampaignAnalytics(campaignId: number) {
  const db = await getDb();
  if (!db) return null;

  const [campaign] = await db.select().from(contentCreatorCampaigns)
    .where(eq(contentCreatorCampaigns.id, campaignId)).limit(1);

  if (!campaign) return null;

  const pieces = await db.select().from(contentCreatorPieces)
    .where(eq(contentCreatorPieces.campaignId, campaignId))
    .orderBy(desc(contentCreatorPieces.createdAt));

  const platformBreakdown: Record<string, {
    count: number;
    impressions: number;
    clicks: number;
    engagements: number;
    avgQuality: number;
  }> = {};

  let totalImpressions = 0;
  let totalClicks = 0;
  let totalEngagements = 0;

  for (const piece of pieces) {
    if (!platformBreakdown[piece.platform]) {
      platformBreakdown[piece.platform] = { count: 0, impressions: 0, clicks: 0, engagements: 0, avgQuality: 0 };
    }
    platformBreakdown[piece.platform].count++;
    platformBreakdown[piece.platform].impressions += piece.impressions;
    platformBreakdown[piece.platform].clicks += piece.clicks;
    platformBreakdown[piece.platform].engagements += piece.engagements;
    platformBreakdown[piece.platform].avgQuality += piece.qualityScore || 0;
    totalImpressions += piece.impressions;
    totalClicks += piece.clicks;
    totalEngagements += piece.engagements;
  }

  // Average quality per platform
  for (const platform of Object.keys(platformBreakdown)) {
    const pd = platformBreakdown[platform];
    pd.avgQuality = pd.count > 0 ? Math.round(pd.avgQuality / pd.count) : 0;
  }

  const statusBreakdown = pieces.reduce((acc, p) => {
    acc[p.status] = (acc[p.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const avgQualityScore = pieces.length > 0
    ? Math.round(pieces.reduce((sum, p) => sum + (p.qualityScore || 0), 0) / pieces.length)
    : 0;

  const avgSeoScore = pieces.length > 0
    ? Math.round(pieces.reduce((sum, p) => sum + (p.seoScore || 0), 0) / pieces.length)
    : 0;

  const topPieces = [...pieces]
    .sort((a, b) => (b.impressions + b.engagements * 2) - (a.impressions + a.engagements * 2))
    .slice(0, 5);

  return {
    campaign,
    pieces,
    totalPieces: pieces.length,
    totalImpressions,
    totalClicks,
    totalEngagements,
    avgQualityScore,
    avgSeoScore,
    ctr: totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) : "0",
    engagementRate: totalImpressions > 0 ? ((totalEngagements / totalImpressions) * 100).toFixed(2) : "0",
    platformBreakdown,
    statusBreakdown,
    topPieces,
  };
}

// ─── Dashboard Overview ────────────────────────────────────────────────────
export async function getContentCreatorDashboard() {
  const db = await getDb();
  if (!db) {
    return {
      totalCampaigns: 0,
      activeCampaigns: 0,
      totalPieces: 0,
      publishedPieces: 0,
      draftPieces: 0,
      scheduledPieces: 0,
      totalImpressions: 0,
      totalClicks: 0,
      totalEngagements: 0,
      recentPieces: [],
      topPerformingPieces: [],
      platformBreakdown: {},
      tiktokConfigured: isTikTokContentConfigured(),
      advertisingLinked: false,
      autonomousConfig: AUTONOMOUS_CONFIG,
    };
  }

  const [campaigns, allPieces] = await Promise.all([
    db.select().from(contentCreatorCampaigns).orderBy(desc(contentCreatorCampaigns.createdAt)).limit(50),
    db.select().from(contentCreatorPieces).orderBy(desc(contentCreatorPieces.createdAt)).limit(200),
  ]);

  const activeCampaigns = campaigns.filter(c => c.status === "active").length;
  const publishedPieces = allPieces.filter(p => p.status === "published").length;
  const draftPieces = allPieces.filter(p => p.status === "draft").length;
  const scheduledPieces = allPieces.filter(p => p.status === "scheduled").length;

  const totalImpressions = allPieces.reduce((s, p) => s + p.impressions, 0);
  const totalClicks = allPieces.reduce((s, p) => s + p.clicks, 0);
  const totalEngagements = allPieces.reduce((s, p) => s + p.engagements, 0);

  const platformBreakdown: Record<string, number> = {};
  for (const piece of allPieces) {
    platformBreakdown[piece.platform] = (platformBreakdown[piece.platform] || 0) + 1;
  }

  const topPerformingPieces = [...allPieces]
    .sort((a, b) => (b.impressions + b.engagements * 2) - (a.impressions + a.engagements * 2))
    .slice(0, 5);

  let advertisingLinked = false;
  try {
    const overview = getStrategyOverview();
    advertisingLinked = !!(overview && overview.monthlyBudget > 0);
  } catch {}

  return {
    totalCampaigns: campaigns.length,
    activeCampaigns,
    totalPieces: allPieces.length,
    publishedPieces,
    draftPieces,
    scheduledPieces,
    totalImpressions,
    totalClicks,
    totalEngagements,
    recentPieces: allPieces.slice(0, 10),
    topPerformingPieces,
    platformBreakdown,
    campaigns: campaigns.slice(0, 10),
    tiktokConfigured: isTikTokContentConfigured(),
    advertisingLinked,
    autonomousConfig: AUTONOMOUS_CONFIG,
  };
}

// ─── Content Scheduling ────────────────────────────────────────────────────
export async function scheduleContentPiece(params: {
  pieceId: number;
  scheduledAt: Date;
  campaignId?: number;
}): Promise<{ success: boolean; scheduleId?: number; error?: string }> {
  const db = await getDb();
  if (!db) return { success: false, error: "Database unavailable" };

  const pieces = await db.select().from(contentCreatorPieces)
    .where(eq(contentCreatorPieces.id, params.pieceId)).limit(1);

  if (!pieces[0]) return { success: false, error: "Piece not found" };

  await db.update(contentCreatorPieces).set({
    status: "scheduled",
    scheduledAt: params.scheduledAt,
  }).where(eq(contentCreatorPieces.id, params.pieceId));

  const [result] = await db.insert(contentCreatorSchedules).values({
    pieceId: params.pieceId,
    campaignId: params.campaignId,
    platform: pieces[0].platform as any,
    scheduledAt: params.scheduledAt,
    status: "pending",
  });

  return { success: true, scheduleId: (result as any).insertId };
}

// ─── AI Campaign Strategy Generator ───────────────────────────────────────
export async function generateCampaignStrategy(params: {
  name: string;
  objective: string;
  platforms: string[];
  targetAudience?: string;
}): Promise<string> {
  const response = await invokeLLM({
    priority: "background",
    model: "strong",
    messages: [
      {
        role: "system",
        content: `You are the senior content strategist for ${BRAND.name} — ${BRAND.tagline}. Generate a detailed, actionable content campaign strategy. Be specific, not generic. Return plain text, max 500 words.`,
      },
      {
        role: "user",
        content: `Campaign: "${params.name}"
Objective: ${params.objective}
Platforms: ${params.platforms.join(", ")}
Target Audience: ${params.targetAudience || BRAND.targetAudiences[0]}

Generate a focused content strategy including:
1. Key messaging pillars (3-4 core messages)
2. Content mix per platform (what types, what ratio)
3. Posting frequency per platform
4. Hook strategy (what angles will resonate)
5. Success metrics (what to track)
6. 30-day content calendar outline

Brand differentiators to emphasise: ${BRAND.differentiators.join(", ")}`,
      },
    ],
  });

  return response.choices?.[0]?.message?.content as string || "Strategy generation failed.";
}

// ─── Content Stats ─────────────────────────────────────────────────────────
export async function getContentCreatorStats() {
  const db = await getDb();
  if (!db) return null;

  const allPieces = await db.select().from(contentCreatorPieces)
    .orderBy(desc(contentCreatorPieces.createdAt)).limit(500);

  const byPlatform = allPieces.reduce((acc, p) => {
    if (!acc[p.platform]) acc[p.platform] = { total: 0, published: 0, avgQuality: 0 };
    acc[p.platform].total++;
    if (p.status === "published") acc[p.platform].published++;
    acc[p.platform].avgQuality += p.qualityScore || 0;
    return acc;
  }, {} as Record<string, { total: number; published: number; avgQuality: number }>);

  for (const platform of Object.keys(byPlatform)) {
    const p = byPlatform[platform];
    p.avgQuality = p.total > 0 ? Math.round(p.avgQuality / p.total) : 0;
  }

  return {
    totalPieces: allPieces.length,
    publishedPieces: allPieces.filter(p => p.status === "published").length,
    scheduledPieces: allPieces.filter(p => p.status === "scheduled").length,
    draftPieces: allPieces.filter(p => p.status === "draft").length,
    avgQualityScore: allPieces.length > 0
      ? Math.round(allPieces.reduce((s, p) => s + (p.qualityScore || 0), 0) / allPieces.length)
      : 0,
    byPlatform,
    autoApproveThreshold: AUTONOMOUS_CONFIG.autoApproveThreshold,
  };
}
