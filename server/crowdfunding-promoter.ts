/**
 * Crowdfunding Multi-Channel Promotion Engine
 *
 * Automatically advertises every new (or newly-activated) crowdfunding campaign
 * across all connected social channels and relevant niche forums.
 *
 * Channels covered:
 *   • X / Twitter
 *   • LinkedIn company page
 *   • Facebook page
 *   • Instagram (image required)
 *   • Reddit — multiple category-matched subreddits
 *   • Discord — rich embed via webhook
 *   • Telegram channel
 *   • Mastodon
 *   • Product Hunt (via GraphQL API)
 *   • Hacker News (via Algolia submit — "Show HN" post)
 *   • Dev.to article
 *   • Medium draft
 *   • Hashnode draft
 *
 * Triggered by:
 *   1. Campaign status changes to "active"
 *   2. Campaign hits 25 %, 50 %, 75 %, 100 % funded milestones
 *   3. Campaign creator manually re-promotes via the router
 *
 * All results are logged to the `crowdfundingPromotionLog` DB table.
 */

import { getDb } from "./db.js";
import { crowdfundingPromotionLog } from "../drizzle/schema.js";
import { eq, and, desc } from "drizzle-orm";
import { createLogger } from "./_core/logger.js";
import { getErrorMessage } from "./_core/errors.js";
import { notifyOwner } from "./_core/notification.js";
import { ENV } from "./_core/env.js";
import { invokeLLM } from "./_core/llm.js";
import { getProviderParams } from "./_core/provider-policy.js";
import {
  xAdapter,
  linkedinAdapter,
  metaAdapter,
  redditAdapter,
} from "./marketing-channels.js";
import {
  discordAdapter,
  telegramAdapter,
  mastodonAdapter,
  devtoAdapter,
  mediumAdapter,
  hashnodeAdapter,
} from "./expanded-channels.js";

const log = createLogger("CrowdfundingPromoter");

// ─── Category → Subreddit Mapping ────────────────────────────────────────────
// Maps campaign categories to the most relevant subreddits for organic reach.
const CATEGORY_SUBREDDITS: Record<string, string[]> = {
  technology:    ["technology", "startups", "entrepreneur", "SideProject", "webdev", "programming", "artificial"],
  ai:            ["artificial", "MachineLearning", "LocalLLaMA", "ChatGPT", "OpenAI", "startups", "SideProject"],
  software:      ["software", "SideProject", "startups", "webdev", "programming", "learnprogramming"],
  startup:       ["startups", "entrepreneur", "smallbusiness", "business", "SideProject"],
  business:      ["entrepreneur", "smallbusiness", "business", "startups", "Entrepreneur"],
  creative:      ["ArtificialIntelligence", "graphic_design", "Design", "creativity", "art"],
  art:           ["art", "ArtificialIntelligence", "graphic_design", "Design", "creativity"],
  music:         ["WeAreTheMusicMakers", "makinghiphop", "edmproduction", "indieheads", "Music"],
  film:          ["Filmmakers", "videography", "cinematography", "shortfilms", "indiefilms"],
  gaming:        ["gamedev", "indiegaming", "indiegames", "gaming", "pcgaming"],
  education:     ["education", "learnprogramming", "edtech", "OnlineLearning", "Teachers"],
  health:        ["HealthTech", "medicine", "health", "nutrition", "fitness"],
  environment:   ["environment", "sustainability", "ClimateChange", "ZeroWaste", "EcoFriendly"],
  social:        ["socialenterprise", "nonprofit", "philanthropy", "community", "volunteer"],
  food:          ["food", "Cooking", "FoodTech", "restaurant", "nutrition"],
  fashion:       ["femalefashionadvice", "malefashionadvice", "streetwear", "fashion", "sustainability"],
  sports:        ["sports", "fitness", "running", "cycling", "outdoors"],
  hardware:      ["hardware", "electronics", "DIY", "raspberry_pi", "arduino", "3Dprinting"],
  default:       ["startups", "entrepreneur", "SideProject", "crowdfunding", "business"],
};

// ─── Subreddits always included regardless of category ────────────────────────
const ALWAYS_POST_SUBREDDITS = ["crowdfunding"];

// ─── Types ────────────────────────────────────────────────────────────────────
export type PromotionTrigger = "launch" | "milestone_25" | "milestone_50" | "milestone_75" | "milestone_100" | "manual";

export interface CampaignPromotionInput {
  campaignId: number;
  title: string;
  description: string;
  category: string;
  goalAmount: number;
  currentAmount: number;
  percentFunded: number;
  imageUrl?: string;
  slug: string;
  creatorName: string;
  trigger: PromotionTrigger;
  daysLeft?: number;
}

export interface ChannelResult {
  channel: string;
  success: boolean;
  url?: string;
  error?: string;
}

export interface PromotionResult {
  campaignId: number;
  trigger: PromotionTrigger;
  channels: ChannelResult[];
  successCount: number;
  failCount: number;
}

// ─── AI Copy Generator ────────────────────────────────────────────────────────
async function generatePromotionCopy(campaign: CampaignPromotionInput): Promise<{
  tweet: string;
  linkedinPost: string;
  redditTitle: string;
  redditBody: string;
  discordEmbed: { title: string; description: string };
  telegramMessage: string;
  hackerNewsTitle: string;
  devtoTitle: string;
  devtoBody: string;
}> {
  const baseUrl = process.env.APP_URL || "https://www.archibaldtitan.com";
  const campaignUrl = `${baseUrl}/crowdfunding/campaign/${campaign.slug}`;
  const goalFormatted = `$${campaign.goalAmount.toLocaleString()}`;
  const raisedFormatted = `$${campaign.currentAmount.toLocaleString()}`;
  const triggerContext = campaign.trigger === "launch"
    ? "just launched"
    : campaign.trigger === "milestone_25" ? "has reached 25% funded"
    : campaign.trigger === "milestone_50" ? "has reached 50% funded — halfway there!"
    : campaign.trigger === "milestone_75" ? "is 75% funded — almost there!"
    : campaign.trigger === "milestone_100" ? "has been FULLY FUNDED! 🎉"
    : "is live and accepting backers";

  const prompt = `You are a professional crowdfunding copywriter. Write promotional copy for this campaign.

Campaign: "${campaign.title}"
Description: ${campaign.description.substring(0, 500)}
Category: ${campaign.category}
Goal: ${goalFormatted}
Raised so far: ${raisedFormatted} (${campaign.percentFunded}% funded)
Status: Campaign ${triggerContext}
Creator: ${campaign.creatorName}
URL: ${campaignUrl}
${campaign.daysLeft ? `Days remaining: ${campaign.daysLeft}` : ""}

Write the following pieces of copy. Return ONLY valid JSON with these exact keys:
{
  "tweet": "A compelling tweet under 280 chars. Include the URL and 2-3 relevant hashtags. No emojis in excess.",
  "linkedinPost": "A professional LinkedIn post 150-250 words. Explain the problem being solved, the solution, and why people should back it. End with the URL.",
  "redditTitle": "A Reddit post title under 300 chars. Factual, no clickbait. Include [Crowdfunding] prefix.",
  "redditBody": "A Reddit self-post body 100-200 words. Explain the project, what makes it unique, and how to back it. Include the URL at the end.",
  "discordEmbed": {
    "title": "Discord embed title under 256 chars",
    "description": "Discord embed description 100-200 chars with key highlights"
  },
  "telegramMessage": "A Telegram message in HTML format. Use <b>bold</b> for key points. 100-150 words. Include the URL as a hyperlink.",
  "hackerNewsTitle": "A Hacker News Show HN title. Format: 'Show HN: [Project Name] – [One sentence description]'. Under 80 chars.",
  "devtoTitle": "A Dev.to article title. Engaging, SEO-friendly. Under 60 chars.",
  "devtoBody": "A Dev.to article body in Markdown. 300-500 words. Cover: what the project is, the technical approach, why it matters, and how to back it. Include the URL."
}`;

  try {
    const response = await invokeLLM({
      messages: [{ role: "user", content: prompt }],
      ...getProviderParams("crowdfunding_story"),
      response_format: { type: "json_object" },
    });
    const content = String(response.choices[0]?.message?.content || "{}");
    const parsed = JSON.parse(content);
    return {
      tweet: parsed.tweet || `🚀 "${campaign.title}" is now live on Archibald Titan! Goal: ${goalFormatted} | ${campaign.percentFunded}% funded. Back it here: ${campaignUrl} #crowdfunding #startup`,
      linkedinPost: parsed.linkedinPost || `Exciting new crowdfunding campaign: "${campaign.title}"\n\n${campaign.description.substring(0, 300)}\n\nGoal: ${goalFormatted} | ${campaign.percentFunded}% funded\n\nBack it here: ${campaignUrl}`,
      redditTitle: parsed.redditTitle || `[Crowdfunding] ${campaign.title} — ${goalFormatted} goal, ${campaign.percentFunded}% funded`,
      redditBody: parsed.redditBody || `${campaign.description.substring(0, 400)}\n\nBack the project here: ${campaignUrl}`,
      discordEmbed: parsed.discordEmbed || { title: campaign.title, description: campaign.description.substring(0, 200) },
      telegramMessage: parsed.telegramMessage || `<b>${campaign.title}</b>\n\n${campaign.description.substring(0, 300)}\n\n<a href="${campaignUrl}">Back this project →</a>`,
      hackerNewsTitle: parsed.hackerNewsTitle || `Show HN: ${campaign.title} – ${campaign.description.substring(0, 60)}`,
      devtoTitle: parsed.devtoTitle || `Crowdfunding: ${campaign.title}`,
      devtoBody: parsed.devtoBody || `# ${campaign.title}\n\n${campaign.description}\n\n[Back this project →](${campaignUrl})`,
    };
  } catch (err) {
    log.warn("AI copy generation failed, using fallback copy", { error: getErrorMessage(err) });
    return {
      tweet: `🚀 "${campaign.title}" is live on Archibald Titan! Goal: ${goalFormatted} | ${campaign.percentFunded}% funded. Back it: ${campaignUrl} #crowdfunding`,
      linkedinPost: `New crowdfunding campaign: "${campaign.title}"\n\n${campaign.description.substring(0, 300)}\n\nGoal: ${goalFormatted}\n\nBack it: ${campaignUrl}`,
      redditTitle: `[Crowdfunding] ${campaign.title} — ${goalFormatted} goal, ${campaign.percentFunded}% funded`,
      redditBody: `${campaign.description.substring(0, 400)}\n\nBack the project: ${campaignUrl}`,
      discordEmbed: { title: campaign.title, description: campaign.description.substring(0, 200) },
      telegramMessage: `<b>${campaign.title}</b>\n\n${campaign.description.substring(0, 300)}\n\n<a href="${campaignUrl}">Back this project →</a>`,
      hackerNewsTitle: `Show HN: ${campaign.title} – ${campaign.description.substring(0, 60)}`,
      devtoTitle: `Crowdfunding: ${campaign.title}`,
      devtoBody: `# ${campaign.title}\n\n${campaign.description}\n\n[Back this project →](${campaignUrl})`,
    };
  }
}

// ─── Product Hunt Submission ──────────────────────────────────────────────────
async function postToProductHunt(campaign: CampaignPromotionInput, tagline: string): Promise<ChannelResult> {
  const token = ENV.productHuntToken;
  if (!token) {
    return { channel: "product_hunt", success: false, error: "PRODUCT_HUNT_TOKEN not configured" };
  }
  const baseUrl = process.env.APP_URL || "https://www.archibaldtitan.com";
  const campaignUrl = `${baseUrl}/crowdfunding/campaign/${campaign.slug}`;
  try {
    const mutation = `
      mutation CreatePost($input: PostCreateInput!) {
        postCreate(input: $input) {
          post { id url name }
          errors { field message }
        }
      }
    `;
    const variables = {
      input: {
        name: campaign.title.substring(0, 60),
        tagline: tagline.substring(0, 60),
        url: campaignUrl,
        description: campaign.description.substring(0, 260),
      },
    };
    const response = await fetch("https://api.producthunt.com/v2/api/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ query: mutation, variables }),
    });
    const data = await response.json() as any;
    if (data.errors || data.data?.postCreate?.errors?.length) {
      const errMsg = (data.errors || data.data.postCreate.errors).map((e: any) => e.message).join(", ");
      return { channel: "product_hunt", success: false, error: errMsg };
    }
    const post = data.data?.postCreate?.post;
    return { channel: "product_hunt", success: true, url: post?.url };
  } catch (err) {
    return { channel: "product_hunt", success: false, error: getErrorMessage(err) };
  }
}

// ─── Hacker News Submission ───────────────────────────────────────────────────
async function postToHackerNews(campaign: CampaignPromotionInput, title: string): Promise<ChannelResult> {
  const username = ENV.hackerNewsUsername;
  const password = ENV.hackerNewsPassword;
  if (!username || !password) {
    return { channel: "hacker_news", success: false, error: "HN_USERNAME / HN_PASSWORD not configured" };
  }
  const baseUrl = process.env.APP_URL || "https://www.archibaldtitan.com";
  const campaignUrl = `${baseUrl}/crowdfunding/campaign/${campaign.slug}`;
  try {
    // Step 1: Login to get cookie
    const loginRes = await fetch("https://news.ycombinator.com/login", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ acct: username, pw: password, goto: "news" }).toString(),
      redirect: "manual",
    });
    const cookie = loginRes.headers.get("set-cookie") || "";
    if (!cookie.includes("user=")) {
      return { channel: "hacker_news", success: false, error: "HN login failed — check credentials" };
    }
    // Step 2: Get FNID for submission
    const submitPageRes = await fetch("https://news.ycombinator.com/submit", {
      headers: { Cookie: cookie.split(";")[0] },
    });
    const submitHtml = await submitPageRes.text();
    const fnidMatch = submitHtml.match(/name="fnid" value="([^"]+)"/);
    const fnidkMatch = submitHtml.match(/name="fnop" value="([^"]+)"/);
    if (!fnidMatch) {
      return { channel: "hacker_news", success: false, error: "Could not extract HN submission token" };
    }
    // Step 3: Submit the post
    const submitRes = await fetch("https://news.ycombinator.com/r", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Cookie: cookie.split(";")[0],
      },
      body: new URLSearchParams({
        fnid: fnidMatch[1],
        fnop: fnidkMatch?.[1] || "submit-page",
        title: title.substring(0, 80),
        url: campaignUrl,
        text: "",
      }).toString(),
      redirect: "manual",
    });
    const location = submitRes.headers.get("location") || "";
    if (location.includes("item?id=")) {
      const itemId = location.match(/item\?id=(\d+)/)?.[1];
      return {
        channel: "hacker_news",
        success: true,
        url: `https://news.ycombinator.com/item?id=${itemId}`,
      };
    }
    return { channel: "hacker_news", success: false, error: "HN submission did not redirect to item page" };
  } catch (err) {
    return { channel: "hacker_news", success: false, error: getErrorMessage(err) };
  }
}

// ─── Core Promotion Function ──────────────────────────────────────────────────
export async function promoteCampaign(campaign: CampaignPromotionInput, triggerOverride?: PromotionTrigger): Promise<PromotionResult> {
  if (triggerOverride) campaign = { ...campaign, trigger: triggerOverride };
  const baseUrl = process.env.APP_URL || "https://www.archibaldtitan.com";
  const campaignUrl = `${baseUrl}/crowdfunding/campaign/${campaign.slug}`;
  const results: ChannelResult[] = [];

  log.info("Starting campaign promotion", {
    campaignId: campaign.campaignId,
    title: campaign.title,
    trigger: campaign.trigger,
  });

  // Generate AI copy for all channels
  const copy = await generatePromotionCopy(campaign);

  // ── X / Twitter ──────────────────────────────────────────────────────────
  if (xAdapter.isConfigured) {
    try {
      let mediaId: string | undefined;
      if (campaign.imageUrl) {
        mediaId = (await xAdapter.uploadMedia(campaign.imageUrl).catch(() => null)) ?? undefined;
      }
      const r = await xAdapter.postTweet({
        text: copy.tweet,
        mediaIds: mediaId ? [mediaId] : undefined,
      });
      results.push({ channel: "x_twitter", success: r.success, url: r.url, error: r.error });
    } catch (err) {
      results.push({ channel: "x_twitter", success: false, error: getErrorMessage(err) });
    }
  }

  // ── LinkedIn ──────────────────────────────────────────────────────────────
  if (linkedinAdapter.isConfigured) {
    try {
      const r = await linkedinAdapter.postToPage({
        text: copy.linkedinPost,
        link: campaignUrl,
        imageUrl: campaign.imageUrl,
      });
      results.push({ channel: "linkedin", success: r.success, url: r.url, error: r.error });
    } catch (err) {
      results.push({ channel: "linkedin", success: false, error: getErrorMessage(err) });
    }
  }

  // ── Facebook ──────────────────────────────────────────────────────────────
  if (metaAdapter.isConfigured && ENV.metaPageId) {
    try {
      const r = await metaAdapter.postToFacebook({
        message: copy.linkedinPost,
        link: campaignUrl,
        imageUrl: campaign.imageUrl,
      });
      results.push({ channel: "facebook", success: r.success, url: r.url, error: r.error });
    } catch (err) {
      results.push({ channel: "facebook", success: false, error: getErrorMessage(err) });
    }
  }

  // ── Instagram (image required) ────────────────────────────────────────────
  if (metaAdapter.isConfigured && ENV.metaInstagramAccountId && campaign.imageUrl) {
    try {
      const r = await metaAdapter.postToInstagram({
        imageUrl: campaign.imageUrl,
        caption: copy.tweet,
      });
      results.push({ channel: "instagram", success: r.success, url: r.url, error: r.error });
    } catch (err) {
      results.push({ channel: "instagram", success: false, error: getErrorMessage(err) });
    }
  }

  // ── Reddit — category-matched subreddits ──────────────────────────────────
  if (redditAdapter.isConfigured) {
    const categoryKey = campaign.category.toLowerCase().replace(/[^a-z]/g, "");
    const targetSubreddits = [
      ...new Set([
        ...(CATEGORY_SUBREDDITS[categoryKey] || CATEGORY_SUBREDDITS.default),
        ...ALWAYS_POST_SUBREDDITS,
      ]),
    ].slice(0, 5); // Cap at 5 subreddits to avoid spam detection

    for (const subreddit of targetSubreddits) {
      try {
        const r = await redditAdapter.submitPost({
          subreddit,
          title: copy.redditTitle,
          text: copy.redditBody,
          url: undefined, // self-post for better engagement
        });
        results.push({
          channel: `reddit_r/${subreddit}`,
          success: r.success,
          url: r.url,
          error: r.error,
        });
        // Rate limit: 2 second delay between Reddit posts
        await new Promise((resolve) => setTimeout(resolve, 2000));
      } catch (err) {
        results.push({ channel: `reddit_r/${subreddit}`, success: false, error: getErrorMessage(err) });
      }
    }
  }

  // ── Discord ───────────────────────────────────────────────────────────────
  if (discordAdapter.isConfigured) {
    try {
      const milestoneColor = campaign.trigger === "milestone_100" ? 0x00ff00
        : campaign.trigger === "milestone_75" ? 0xffaa00
        : campaign.trigger === "milestone_50" ? 0xff8800
        : campaign.trigger === "milestone_25" ? 0x0088ff
        : 0x7c3aed; // purple for launch

      const r = await discordAdapter.postMessage({
        username: "Archibald Titan Crowdfunding",
        embeds: [{
          title: copy.discordEmbed.title,
          description: copy.discordEmbed.description,
          url: campaignUrl,
          color: milestoneColor,
          thumbnail: campaign.imageUrl ? { url: campaign.imageUrl } : undefined,
          fields: [
            { name: "Goal", value: `$${campaign.goalAmount.toLocaleString()}`, inline: true },
            { name: "Raised", value: `$${campaign.currentAmount.toLocaleString()} (${campaign.percentFunded}%)`, inline: true },
            ...(campaign.daysLeft ? [{ name: "Days Left", value: String(campaign.daysLeft), inline: true }] : []),
            { name: "Category", value: campaign.category, inline: true },
            { name: "Creator", value: campaign.creatorName, inline: true },
          ],
          footer: { text: "Archibald Titan Crowdfunding • archibaldtitan.com" },
        }],
      });
      results.push({ channel: "discord", success: r.success, error: r.error });
    } catch (err) {
      results.push({ channel: "discord", success: false, error: getErrorMessage(err) });
    }
  }

  // ── Telegram ──────────────────────────────────────────────────────────────
  if (telegramAdapter.isConfigured) {
    try {
      let r;
      if (campaign.imageUrl) {
        r = await telegramAdapter.sendPhoto({
          photoUrl: campaign.imageUrl,
          caption: copy.telegramMessage,
          parseMode: "HTML",
        });
      } else {
        r = await telegramAdapter.sendMessage({
          text: copy.telegramMessage,
          parseMode: "HTML",
          disableWebPagePreview: false,
        });
      }
      results.push({ channel: "telegram", success: r.success, error: r.error });
    } catch (err) {
      results.push({ channel: "telegram", success: false, error: getErrorMessage(err) });
    }
  }

  // ── Mastodon ──────────────────────────────────────────────────────────────
  if (mastodonAdapter.isConfigured) {
    try {
      const mastodonText = `${copy.tweet.substring(0, 400)}\n\n${campaignUrl}`;
      const r = await mastodonAdapter.postStatus({
        status: mastodonText,
        visibility: "public",
      });
      results.push({ channel: "mastodon", success: r.success, url: r.url, error: r.error });
    } catch (err) {
      results.push({ channel: "mastodon", success: false, error: getErrorMessage(err) });
    }
  }

  // ── Dev.to ────────────────────────────────────────────────────────────────
  if (devtoAdapter.isConfigured && campaign.trigger === "launch") {
    try {
      const r = await devtoAdapter.publishArticle({
        title: copy.devtoTitle,
        body: copy.devtoBody,
        tags: ([campaign.category, "crowdfunding", "startup", "buildinpublic"].filter(Boolean) as string[]).slice(0, 4),
        published: true,
        canonicalUrl: campaignUrl,
      });
      results.push({ channel: "devto", success: r.success, url: r.url, error: r.error });
    } catch (err) {
      results.push({ channel: "devto", success: false, error: getErrorMessage(err) });
    }
  }

  // ── Medium (draft only — requires manual publish) ─────────────────────────
  if (mediumAdapter.isConfigured && campaign.trigger === "launch") {
    try {
      const r = await mediumAdapter.publishPost({
        title: copy.devtoTitle,
        contentFormat: "markdown",
        content: copy.devtoBody,
        tags: ([campaign.category, "crowdfunding", "startup"].filter(Boolean) as string[]).slice(0, 3),
        publishStatus: "draft",
        canonicalUrl: campaignUrl,
      });
      results.push({ channel: "medium", success: r.success, url: r.url, error: r.error });
    } catch (err) {
      results.push({ channel: "medium", success: false, error: getErrorMessage(err) });
    }
  }

  // ── Hashnode (draft) ──────────────────────────────────────────────────────
  if (hashnodeAdapter.isConfigured && campaign.trigger === "launch") {
    try {
      const r = await hashnodeAdapter.publishArticle({
        title: copy.devtoTitle,
        content: copy.devtoBody,
        tags: ([campaign.category, "crowdfunding", "startup"].filter(Boolean) as string[]).map(t => ({ slug: t.toLowerCase().replace(/[^a-z0-9]+/g, "-"), name: t })),
        canonicalUrl: campaignUrl,
      });
      results.push({ channel: "hashnode", success: r.success, url: r.url, error: r.error });
    } catch (err) {
      results.push({ channel: "hashnode", success: false, error: getErrorMessage(err) });
    }
  }

  // ── Product Hunt ──────────────────────────────────────────────────────────
  if (ENV.productHuntToken && campaign.trigger === "launch") {
    const tagline = campaign.description.split(".")[0].substring(0, 60);
    const r = await postToProductHunt(campaign, tagline);
    results.push(r);
  }

  // ── Hacker News ───────────────────────────────────────────────────────────
  if (ENV.hackerNewsUsername && ENV.hackerNewsPassword && campaign.trigger === "launch") {
    const r = await postToHackerNews(campaign, copy.hackerNewsTitle);
    results.push(r);
  }

  // ── Persist results to DB ─────────────────────────────────────────────────
  const successCount = results.filter((r) => r.success).length;
  const failCount = results.filter((r) => !r.success).length;

  try {
    const db = await getDb();
    if (db) {
      await db.insert(crowdfundingPromotionLog).values({
        campaignId: campaign.campaignId,
        trigger: campaign.trigger,
        channelsAttempted: results.length,
        channelsSucceeded: successCount,
        channelsFailed: failCount,
        results: JSON.stringify(results),
      });
    }
  } catch (err) {
    log.warn("Failed to persist promotion log", { error: getErrorMessage(err) });
  }

  // ── Notify owner ──────────────────────────────────────────────────────────
  const successChannels = results.filter((r) => r.success).map((r) => r.channel).join(", ");
  await notifyOwner({
    title: `Campaign Promoted: ${campaign.title}`,
    content: `Trigger: ${campaign.trigger} | ${successCount}/${results.length} channels succeeded.\nChannels: ${successChannels || "none"}`,
  }).catch(() => {});

  log.info("Campaign promotion complete", {
    campaignId: campaign.campaignId,
    trigger: campaign.trigger,
    successCount,
    failCount,
    channels: results.map((r) => `${r.channel}:${r.success ? "ok" : "fail"}`).join(", "),
  });

  return {
    campaignId: campaign.campaignId,
    trigger: campaign.trigger,
    channels: results,
    successCount,
    failCount,
  };
}

// ─── Milestone Checker ────────────────────────────────────────────────────────
// Called after every successful donation to check if a milestone was just crossed.
export async function checkAndPromoteMilestone(
  campaignId: number,
  previousPercent: number,
  newPercent: number,
  campaignData: CampaignPromotionInput
): Promise<void> {
  const milestones: Array<{ threshold: number; trigger: PromotionTrigger }> = [
    { threshold: 25, trigger: "milestone_25" },
    { threshold: 50, trigger: "milestone_50" },
    { threshold: 75, trigger: "milestone_75" },
    { threshold: 100, trigger: "milestone_100" },
  ];

  for (const { threshold, trigger } of milestones) {
    if (previousPercent < threshold && newPercent >= threshold) {
      // Check we haven't already promoted this milestone
      try {
        const db = await getDb();
        if (db) {
          const existing = await db
            .select()
            .from(crowdfundingPromotionLog)
            .where(
              and(
                eq(crowdfundingPromotionLog.campaignId, campaignId),
                eq(crowdfundingPromotionLog.trigger, trigger)
              )
            )
            .limit(1);
          if (existing.length > 0) continue; // Already promoted this milestone
        }
      } catch {
        // DB check failed — promote anyway to avoid missing milestones
      }

      log.info(`Campaign ${campaignId} hit ${threshold}% milestone — triggering promotion`);
      promoteCampaign({ ...campaignData, trigger, percentFunded: newPercent }).catch((err) => {
        log.error(`Milestone promotion failed for campaign ${campaignId}`, { error: getErrorMessage(err) });
      });
      break; // Only trigger one milestone per donation
    }
  }
}

// ─── Get Promotion History ────────────────────────────────────────────────────
export async function getCampaignPromotionHistory(campaignId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(crowdfundingPromotionLog)
    .where(eq(crowdfundingPromotionLog.campaignId, campaignId))
    .orderBy(desc(crowdfundingPromotionLog.createdAt));
}
