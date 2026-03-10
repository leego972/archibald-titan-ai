/**
 * Content Creator Engine v1.0
 *
 * AI-powered content generation system that bridges:
 *  - SEO Engine  → keyword-driven content briefs
 *  - Advertising Orchestrator → multi-channel distribution
 *  - TikTok Content Service → organic TikTok posting pipeline
 *  - Marketing Engine → brand voice & campaign context
 *
 * Capabilities:
 *  1. Generate platform-optimised content for 15 channels
 *  2. SEO-first content briefs pulled from live keyword analysis
 *  3. TikTok carousel + video script generation with direct posting
 *  4. Quality scoring (SEO + engagement + brand alignment)
 *  5. Content calendar scheduling
 *  6. Bulk generation across all platforms for a campaign
 *  7. Analytics aggregation and performance insights
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
import { eq, desc, and, gte, sql, count, sum } from "drizzle-orm";
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

// ─── Brand Context (mirrors marketing-engine TITAN_BRAND) ──────────────────
const BRAND = {
  name: "Archibald Titan",
  tagline: "The World's Most Advanced Local AI Agent",
  website: "https://archibaldtitan.com",
  tone: "Confident, technical, authoritative but approachable. Think Iron Man's JARVIS meets a cybersecurity expert.",
  keyFeatures: [
    "AI-powered chat assistant with autonomous code execution",
    "Secure credential vault with breach monitoring",
    "TOTP two-factor authentication manager",
    "Dark web leak scanner",
    "Website replication engine",
    "Sandbox code execution environment",
    "Cross-platform (Web + Desktop via Electron)",
    "Titan Builder — AI that builds software for you",
  ],
  targetAudiences: [
    "Cybersecurity professionals and penetration testers",
    "Software developers and DevOps engineers",
    "IT administrators and security teams",
    "Tech-savvy professionals who value security",
    "Small business owners needing security tools",
  ],
  competitors: ["1Password", "LastPass", "Bitwarden", "GitHub Copilot", "ChatGPT"],
  artStyle: {
    prefix: "Dark futuristic cyberpunk digital art, chrome-armored AI knight warrior with glowing blue eyes, deep navy midnight blue background with electric blue circuit patterns and digital particles, metallic silver armor with blue LED accents, bold metallic 3D text,",
    suffix: "high quality digital illustration, cinematic lighting, tech aesthetic, dark background with blue glow effects, professional marketing campaign art",
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

// ─── Platform Configuration ────────────────────────────────────────────────
export const PLATFORM_CONFIG: Record<string, {
  label: string;
  maxChars: number;
  maxHashtags: number;
  contentTypes: string[];
  guidelines: string;
  seoWeight: number;
}> = {
  tiktok: {
    label: "TikTok",
    maxChars: 2200,
    maxHashtags: 10,
    contentTypes: ["video_script", "photo_carousel"],
    guidelines: "Hook in first 3 seconds. Vertical format. Educational or entertaining. 15-60 seconds optimal. Use trending audio hooks. End with strong CTA.",
    seoWeight: 0.3,
  },
  instagram: {
    label: "Instagram",
    maxChars: 2200,
    maxHashtags: 30,
    contentTypes: ["photo_carousel", "reel", "story", "social_post"],
    guidelines: "Visual-first. Carousel posts get highest engagement. Stories for urgency. Reels for reach. Strong opening line before 'more' fold.",
    seoWeight: 0.2,
  },
  x_twitter: {
    label: "X (Twitter)",
    maxChars: 280,
    maxHashtags: 3,
    contentTypes: ["social_post", "thread"],
    guidelines: "Punchy, direct, opinionated. Threads for depth. Engage with replies. Technical audience appreciates real insights.",
    seoWeight: 0.4,
  },
  linkedin: {
    label: "LinkedIn",
    maxChars: 3000,
    maxHashtags: 5,
    contentTypes: ["social_post", "ad_copy"],
    guidelines: "Thought leadership tone. Personal insights perform well. B2B angle. CTOs and security leaders are the audience. No fluff.",
    seoWeight: 0.6,
  },
  reddit: {
    label: "Reddit",
    maxChars: 40000,
    maxHashtags: 0,
    contentTypes: ["social_post"],
    guidelines: "Authentic, value-first. No hard selling. Community-appropriate tone. Detailed technical posts perform well. r/netsec, r/cybersecurity, r/devops.",
    seoWeight: 0.5,
  },
  facebook: {
    label: "Facebook",
    maxChars: 63206,
    maxHashtags: 5,
    contentTypes: ["social_post", "ad_copy"],
    guidelines: "Conversational tone. Behind-the-scenes content works well. Video gets priority reach. Groups for community building.",
    seoWeight: 0.2,
  },
  youtube_shorts: {
    label: "YouTube Shorts",
    maxChars: 5000,
    maxHashtags: 15,
    contentTypes: ["video_script", "reel"],
    guidelines: "Vertical 9:16 format. Under 60 seconds. Hook in first 2 seconds. Educational content performs best. Strong thumbnail concept.",
    seoWeight: 0.7,
  },
  blog: {
    label: "Blog",
    maxChars: 100000,
    maxHashtags: 0,
    contentTypes: ["blog_article"],
    guidelines: "800-2500 words. SEO-optimised with focus keyword. H2/H3 structure. Include code examples for technical topics. Link to product features naturally.",
    seoWeight: 1.0,
  },
  email: {
    label: "Email",
    maxChars: 10000,
    maxHashtags: 0,
    contentTypes: ["email_campaign"],
    guidelines: "Subject line under 50 chars. Preview text under 90 chars. Clear CTA button. Mobile-first. Personalisation tokens where possible.",
    seoWeight: 0.1,
  },
  pinterest: {
    label: "Pinterest",
    maxChars: 500,
    maxHashtags: 20,
    contentTypes: ["infographic", "social_post"],
    guidelines: "Vertical image 2:3 ratio. SEO-rich descriptions. Keywords in title. Actionable content. Link to landing page.",
    seoWeight: 0.6,
  },
  discord: {
    label: "Discord",
    maxChars: 2000,
    maxHashtags: 0,
    contentTypes: ["social_post"],
    guidelines: "Community-first. Value before promotion. Share tools, tips, and insights. Engage in cybersecurity servers.",
    seoWeight: 0.1,
  },
  telegram: {
    label: "Telegram",
    maxChars: 4096,
    maxHashtags: 5,
    contentTypes: ["social_post"],
    guidelines: "Broadcast channel style. Security alerts, product updates, tips. Concise and actionable.",
    seoWeight: 0.1,
  },
  medium: {
    label: "Medium",
    maxChars: 100000,
    maxHashtags: 5,
    contentTypes: ["blog_article"],
    guidelines: "Republish blog posts with canonical URLs. 5-10 min read. Technical depth appreciated. 100M+ monthly readers.",
    seoWeight: 0.8,
  },
  hackernews: {
    label: "Hacker News",
    maxChars: 10000,
    maxHashtags: 0,
    contentTypes: ["social_post"],
    guidelines: "Technical, concise, no marketing speak. HN audience hates fluff. Show HN format for product launches. 50-100 words.",
    seoWeight: 0.9,
  },
  whatsapp: {
    label: "WhatsApp",
    maxChars: 4096,
    maxHashtags: 0,
    contentTypes: ["social_post"],
    guidelines: "Broadcast to opted-in subscribers. Security alerts, weekly tips, product updates. Conversational tone.",
    seoWeight: 0.1,
  },
};

// ─── Content Quality Scorer ────────────────────────────────────────────────
export function scoreContentQuality(params: {
  body: string;
  platform: string;
  seoKeywords?: string[];
  hashtags?: string[];
  callToAction?: string;
  hook?: string;
}): number {
  let score = 50; // base score
  const config = PLATFORM_CONFIG[params.platform];
  if (!config) return score;

  // Length check
  const len = params.body.length;
  if (len > 50 && len <= config.maxChars) score += 10;
  if (len > config.maxChars * 0.5) score += 5; // good length

  // CTA present
  if (params.callToAction && params.callToAction.length > 5) score += 10;

  // Hook present (for video/social)
  if (params.hook && params.hook.length > 10) score += 10;

  // SEO keywords present in body
  if (params.seoKeywords && params.seoKeywords.length > 0) {
    const bodyLower = params.body.toLowerCase();
    const matchCount = params.seoKeywords.filter(kw => bodyLower.includes(kw.toLowerCase())).length;
    score += Math.min(matchCount * 5, 15);
  }

  // Hashtags (platform-appropriate)
  if (params.hashtags && params.hashtags.length > 0) {
    if (params.hashtags.length <= config.maxHashtags) score += 5;
    if (params.hashtags.length >= 3 && params.hashtags.length <= config.maxHashtags) score += 5;
  }

  // Brand mention
  if (params.body.toLowerCase().includes("archibald titan") || params.body.toLowerCase().includes("titan")) {
    score += 5;
  }

  return Math.min(score, 100);
}

// ─── SEO Score for Content ─────────────────────────────────────────────────
export function scoreSeoContent(params: {
  body: string;
  title?: string;
  seoKeywords?: string[];
  platform: string;
}): number {
  const config = PLATFORM_CONFIG[params.platform];
  if (!config) return 0;

  let score = 0;
  const bodyLower = params.body.toLowerCase();
  const titleLower = (params.title || "").toLowerCase();

  // Platform SEO weight
  score += config.seoWeight * 30;

  // Keywords in title
  if (params.seoKeywords && params.title) {
    const titleMatches = params.seoKeywords.filter(kw => titleLower.includes(kw.toLowerCase())).length;
    score += Math.min(titleMatches * 10, 20);
  }

  // Keywords in body
  if (params.seoKeywords) {
    const bodyMatches = params.seoKeywords.filter(kw => bodyLower.includes(kw.toLowerCase())).length;
    score += Math.min(bodyMatches * 5, 30);
  }

  // Content length bonus for SEO-heavy platforms
  if (["blog", "medium", "linkedin", "hackernews"].includes(params.platform)) {
    if (params.body.length > 500) score += 10;
    if (params.body.length > 1500) score += 10;
  }

  return Math.min(Math.round(score), 100);
}

// ─── Core Content Generation ───────────────────────────────────────────────
export interface GenerateContentParams {
  platform: string;
  contentType: string;
  topic?: string;
  campaignObjective?: string;
  seoKeywords?: string[];
  targetAudience?: string;
  brandVoice?: string;
  includeImage?: boolean;
  campaignId?: number;
}

export interface GeneratedContent {
  platform: string;
  contentType: string;
  title?: string;
  headline?: string;
  body: string;
  callToAction?: string;
  hashtags: string[];
  hook?: string;
  videoScript?: string;
  visualDirections?: string[];
  imagePrompt?: string;
  mediaUrl?: string;
  seoKeywords: string[];
  seoScore: number;
  qualityScore: number;
  generationMs: number;
}

export async function generateCreatorContent(
  params: GenerateContentParams
): Promise<GeneratedContent> {
  const startMs = Date.now();
  const config = PLATFORM_CONFIG[params.platform] || PLATFORM_CONFIG.x_twitter;
  const keywords = params.seoKeywords || [];

  const systemPrompt = `You are the head of content for ${BRAND.name} — ${BRAND.tagline}.

BRAND VOICE: ${params.brandVoice || BRAND.tone}

KEY FEATURES TO PROMOTE:
${BRAND.keyFeatures.map(f => `• ${f}`).join("\n")}

TARGET AUDIENCES:
${BRAND.targetAudiences.map(a => `• ${a}`).join("\n")}

WEBSITE: ${BRAND.website}
COMPETITORS: ${BRAND.competitors.join(", ")}

PLATFORM: ${config.label}
PLATFORM GUIDELINES: ${config.guidelines}
MAX CHARACTERS: ${config.maxChars}
MAX HASHTAGS: ${config.maxHashtags}

SEO KEYWORDS TO INCORPORATE: ${keywords.length > 0 ? keywords.join(", ") : "Use relevant cybersecurity and AI keywords naturally"}

QUALITY STANDARDS:
- Never be generic — every piece must feel authentic and technically credible
- Lead with value, not promotion
- Use real technical terminology our audience understands
- Include specific, concrete benefits
- End with a clear, compelling call to action
- For video content: hook must grab attention in under 3 seconds

Return valid JSON only. No markdown, no explanation.`;

  const isVideo = ["video_script", "reel"].includes(params.contentType);
  const isBlog = ["blog_article"].includes(params.contentType);
  const isEmail = ["email_campaign"].includes(params.contentType);
  const isCarousel = ["photo_carousel", "infographic"].includes(params.contentType);

  const userPrompt = `Create a ${params.contentType} for ${config.label}.
${params.topic ? `TOPIC/ANGLE: ${params.topic}` : "Choose the most compelling angle for our audience."}
${params.campaignObjective ? `CAMPAIGN OBJECTIVE: ${params.campaignObjective}` : ""}
${params.targetAudience ? `TARGET AUDIENCE: ${params.targetAudience}` : ""}

Generate the content now. Make it genuinely compelling — not corporate fluff.`;

  const schema = {
    type: "object" as const,
    properties: {
      title: { type: "string" as const, description: "Content title or subject line" },
      headline: { type: "string" as const, description: "Attention-grabbing headline" },
      body: { type: "string" as const, description: "Main content body" },
      callToAction: { type: "string" as const, description: "Clear call to action" },
      hashtags: { type: "array" as const, items: { type: "string" as const }, description: "Relevant hashtags without # prefix" },
      hook: { type: "string" as const, description: isVideo ? "Opening hook (first 3 seconds)" : "Opening line" },
      videoScript: { type: "string" as const, description: isVideo ? "Full video script with timestamps" : "" },
      visualDirections: { type: "array" as const, items: { type: "string" as const }, description: isCarousel || isVideo ? "Visual direction notes for each slide/scene" : "" },
      imagePrompt: { type: "string" as const, description: "DALL-E prompt for accompanying image in Titan cyberpunk art style" },
    },
    required: ["title", "headline", "body", "callToAction", "hashtags", "hook", "videoScript", "visualDirections", "imagePrompt"],
    additionalProperties: false,
  };

  const response = await invokeLLM({
    priority: "chat",
    model: "strong",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    response_format: {
      type: "json_schema",
      json_schema: { name: "content_piece", strict: true, schema },
    },
  });

  const raw = response.choices?.[0]?.message?.content;
  const parsed = JSON.parse(typeof raw === "string" ? raw : "{}");

  // Truncate to platform limits
  let body = (parsed.body || "") as string;
  if (body.length > config.maxChars) {
    body = body.slice(0, config.maxChars - 3) + "...";
  }

  // Cap hashtags
  let hashtags = (parsed.hashtags || []) as string[];
  if (hashtags.length > config.maxHashtags && config.maxHashtags > 0) {
    hashtags = hashtags.slice(0, config.maxHashtags);
  }

  // Generate image if requested
  let mediaUrl: string | undefined;
  if (params.includeImage && parsed.imagePrompt) {
    try {
      const styledPrompt = `${BRAND.artStyle.prefix} ${parsed.imagePrompt}. ${BRAND.artStyle.suffix}. No text in image.`;
      const imgResult = await generateImage({
        prompt: styledPrompt,
        originalImages: [{ url: BRAND.defaultImage, mimeType: "image/png" }],
      });
      mediaUrl = imgResult.url;
    } catch (err) {
      log.warn("[ContentCreator] Image generation failed, using fallback:", { error: getErrorMessage(err) });
      mediaUrl = BRAND.defaultImage;
    }
  }

  const seoScore = scoreSeoContent({
    body,
    title: parsed.title,
    seoKeywords: keywords,
    platform: params.platform,
  });

  const qualityScore = scoreContentQuality({
    body,
    platform: params.platform,
    seoKeywords: keywords,
    hashtags,
    callToAction: parsed.callToAction,
    hook: parsed.hook,
  });

  return {
    platform: params.platform,
    contentType: params.contentType,
    title: parsed.title,
    headline: parsed.headline,
    body,
    callToAction: parsed.callToAction,
    hashtags,
    hook: parsed.hook,
    videoScript: parsed.videoScript || undefined,
    visualDirections: parsed.visualDirections?.length ? parsed.visualDirections : undefined,
    imagePrompt: parsed.imagePrompt,
    mediaUrl,
    seoKeywords: keywords,
    seoScore,
    qualityScore,
    generationMs: Date.now() - startMs,
  };
}

// ─── SEO-Driven Content Brief Generation ──────────────────────────────────
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

export async function generateSeoContentBriefs(count = 5): Promise<ContentCreatorBrief[]> {
  try {
    // Pull live SEO data
    const [seoBriefs, keywordData] = await Promise.allSettled([
      generateContentBriefs(count),
      analyzeKeywords(),
    ]);

    const briefs = seoBriefs.status === "fulfilled" ? seoBriefs.value : [];
    const keywords = keywordData.status === "fulfilled" ? keywordData.value : null;

    // Map SEO briefs to content creator briefs
    const creatorBriefs: ContentCreatorBrief[] = briefs.map(brief => ({
      topic: brief.title,
      targetKeyword: brief.targetKeyword,
      secondaryKeywords: brief.secondaryKeywords || [],
      recommendedPlatforms: ["blog", "linkedin", "x_twitter", "tiktok"],
      contentTypes: ["blog_article", "social_post", "video_script"],
      angle: brief.outline?.[0] || "Educational deep-dive",
      estimatedImpact: "high" as const,
      seoOpportunity: `Target keyword: "${brief.targetKeyword}" — ${brief.intent} intent`,
    }));

    // Add keyword-gap briefs
    if (keywords && keywords.contentGaps?.length > 0) {
      for (const gap of keywords.contentGaps.slice(0, Math.max(0, count - creatorBriefs.length))) {
        creatorBriefs.push({
          topic: gap,
          targetKeyword: gap.toLowerCase(),
          secondaryKeywords: keywords.competitorKeywords?.slice(0, 3) || [],
          recommendedPlatforms: ["blog", "linkedin", "hackernews"],
          contentTypes: ["blog_article", "social_post"],
          angle: "Fill content gap vs competitors",
          estimatedImpact: "medium" as const,
          seoOpportunity: `Content gap identified — competitors rank for this topic`,
        });
      }
    }

    return creatorBriefs.slice(0, count);
  } catch (err) {
    log.error("[ContentCreator] Failed to generate SEO briefs:", { error: getErrorMessage(err) });
    return [];
  }
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
  pieces: Array<{ platform: string; contentType: string; id?: number; error?: string }>;
}

export async function bulkGenerateForCampaign(
  params: BulkGenerateParams
): Promise<BulkGenerateResult> {
  const db = await getDb();
  if (!db) return { success: false, generated: 0, failed: 0, pieces: [] };

  const results: BulkGenerateResult["pieces"] = [];
  let generated = 0;
  let failed = 0;

  for (const platform of params.platforms) {
    const config = PLATFORM_CONFIG[platform];
    if (!config) continue;

    // Pick the best content type for this platform
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
      });

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
        status: "draft",
        aiPrompt: params.topic || "Bulk generation",
        aiModel: "gpt-4.1-mini",
        generationMs: content.generationMs,
      } as any);

      results.push({ platform, contentType, id: (inserted as any).insertId });
      generated++;

      // Small delay to avoid rate limits
      await new Promise(r => setTimeout(r, 500));
    } catch (err) {
      log.error(`[ContentCreator] Failed to generate for ${platform}:`, { error: getErrorMessage(err) });
      results.push({ platform, contentType, error: getErrorMessage(err) });
      failed++;
    }
  }

  // Update campaign piece count
  await db.update(contentCreatorCampaigns)
    .set({ totalPieces: sql`totalPieces + ${generated}` })
    .where(eq(contentCreatorCampaigns.id, params.campaignId));

  return { success: generated > 0, generated, failed, pieces: results };
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
    // Use existing carousel images or generate new ones
    const imageUrls: string[] = [];

    if (piece.mediaUrl) {
      imageUrls.push(piece.mediaUrl);
    }

    // Generate additional carousel slides if we have visual directions
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

  // Update piece status
  const newStatus = postResult.success ? "published" : "approved";
  await db.update(contentCreatorPieces).set({
    status: newStatus as any,
    publishedAt: postResult.success ? new Date() : undefined,
    tiktokPublishId: postResult.publishId,
    externalPostId: postResult.publishId,
  }).where(eq(contentCreatorPieces.id, params.pieceId));

  // Mirror to marketing_content for advertising orchestrator visibility
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

    // Log to marketing activity
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

  const platformBreakdown: Record<string, { count: number; impressions: number; clicks: number; engagements: number }> = {};
  let totalImpressions = 0;
  let totalClicks = 0;
  let totalEngagements = 0;

  for (const piece of pieces) {
    if (!platformBreakdown[piece.platform]) {
      platformBreakdown[piece.platform] = { count: 0, impressions: 0, clicks: 0, engagements: 0 };
    }
    platformBreakdown[piece.platform].count++;
    platformBreakdown[piece.platform].impressions += piece.impressions;
    platformBreakdown[piece.platform].clicks += piece.clicks;
    platformBreakdown[piece.platform].engagements += piece.engagements;
    totalImpressions += piece.impressions;
    totalClicks += piece.clicks;
    totalEngagements += piece.engagements;
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
    .sort((a, b) => (b.impressions + b.engagements) - (a.impressions + a.engagements))
    .slice(0, 5);

  // Get advertising orchestrator status
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

  // Update piece status to scheduled
  await db.update(contentCreatorPieces).set({
    status: "scheduled",
    scheduledAt: params.scheduledAt,
  }).where(eq(contentCreatorPieces.id, params.pieceId));

  // Create schedule entry
  const [result] = await db.insert(contentCreatorSchedules).values({
    pieceId: params.pieceId,
    campaignId: params.campaignId,
    platform: pieces[0].platform,
    scheduledAt: params.scheduledAt,
    status: "pending",
  });

  return { success: true, scheduleId: (result as any).insertId };
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
      sql`${contentCreatorSchedules.scheduledAt} <= ${now}`,
    ))
    .limit(10);

  let published = 0;
  let failed = 0;

  for (const schedule of dueSchedules) {
    // Mark as processing
    await db.update(contentCreatorSchedules).set({ status: "processing" })
      .where(eq(contentCreatorSchedules.id, schedule.id));

    try {
      if (schedule.platform === "tiktok") {
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
        // For non-TikTok platforms, mark as published (manual posting reminder)
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

// ─── AI Strategy Generator ─────────────────────────────────────────────────
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
        content: `You are a senior content strategist for ${BRAND.name}. Generate a concise, actionable content campaign strategy. Return plain text, max 400 words.`,
      },
      {
        role: "user",
        content: `Campaign: "${params.name}"
Objective: ${params.objective}
Platforms: ${params.platforms.join(", ")}
Target Audience: ${params.targetAudience || "Cybersecurity professionals and developers"}

Generate a focused content strategy including: key messaging pillars, content mix per platform, posting frequency, and success metrics.`,
      },
    ],
  });

  return response.choices?.[0]?.message?.content as string || "Strategy generation failed.";
}
