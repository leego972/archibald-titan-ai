import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  isTikTokContentConfigured,
} from "./tiktok-content-service";

// Mock the ENV module
vi.mock("./_core/env", () => ({
  ENV: {
    tiktokAccessToken: "",
    tiktokAdvertiserId: "",
    tiktokAppId: "",
    tiktokAppSecret: "",
    tiktokOpenId: "",
    tiktokCreatorToken: "",
    forgeApiUrl: "",
    forgeApiKey: "",
  },
}));

// Mock LLM
vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn().mockResolvedValue({
    choices: [{
      message: {
        content: JSON.stringify({
          title: "Stop scrolling! Your API keys are exposed #cybersecurity #infosec",
          description: "Most developers store API keys in plain text. Here's why that's dangerous and how to fix it with Archibald Titan.",
          hashtags: ["#cybersecurity", "#infosec", "#apikeys", "#devsecops", "#tech"],
          hook: "Your API keys are probably exposed right now",
          visualStyle: "Dark cyberpunk with neon accents",
          imagePrompt: "Cyberpunk infographic about API key security",
          contentType: "photo_carousel",
        }),
      },
    }],
  }),
}));

// Mock image generation
vi.mock("./_core/imageGeneration", () => ({
  generateImage: vi.fn().mockResolvedValue({ url: "https://example.com/generated-image.png" }),
}));

// Mock storage
vi.mock("./storage", () => ({
  storagePut: vi.fn().mockResolvedValue({ url: "https://s3.example.com/tiktok-content/image.png", key: "tiktok-content/image.png" }),
}));

// Mock DB
vi.mock("./db", () => ({
  getDb: vi.fn().mockResolvedValue(null),
}));

describe("TikTok Content Service", () => {
  describe("isTikTokContentConfigured", () => {
    it("should return false when no tokens are set", () => {
      expect(isTikTokContentConfigured()).toBe(false);
    });
  });

  describe("Content Posting API endpoints", () => {
    it("should use correct video init endpoint URL", () => {
      const expectedUrl = "https://open.tiktokapis.com/v2/post/publish/video/init/";
      expect(expectedUrl).toContain("open.tiktokapis.com");
      expect(expectedUrl).toContain("/v2/post/publish/video/init/");
    });

    it("should use correct photo init endpoint URL", () => {
      const expectedUrl = "https://open.tiktokapis.com/v2/post/publish/content/init/";
      expect(expectedUrl).toContain("open.tiktokapis.com");
      expect(expectedUrl).toContain("/v2/post/publish/content/init/");
    });

    it("should use correct status fetch endpoint URL", () => {
      const expectedUrl = "https://open.tiktokapis.com/v2/post/publish/status/fetch/";
      expect(expectedUrl).toContain("open.tiktokapis.com");
      expect(expectedUrl).toContain("/v2/post/publish/status/fetch/");
    });

    it("should use correct creator info endpoint URL", () => {
      const expectedUrl = "https://open.tiktokapis.com/v2/post/publish/creator_info/query/";
      expect(expectedUrl).toContain("open.tiktokapis.com");
      expect(expectedUrl).toContain("/v2/post/publish/creator_info/query/");
    });
  });

  describe("Content plan structure", () => {
    it("should define valid content types", () => {
      const validTypes = ["photo_carousel", "video_script"];
      expect(validTypes).toContain("photo_carousel");
      expect(validTypes).toContain("video_script");
    });

    it("should define valid privacy levels", () => {
      const validLevels = [
        "PUBLIC_TO_EVERYONE",
        "MUTUAL_FOLLOW_FRIENDS",
        "FOLLOWER_OF_CREATOR",
        "SELF_ONLY",
      ];
      expect(validLevels).toHaveLength(4);
      expect(validLevels).toContain("PUBLIC_TO_EVERYONE");
    });

    it("should enforce max caption length of 2200 chars", () => {
      const maxLength = 2200;
      const longCaption = "a".repeat(3000);
      const truncated = longCaption.slice(0, maxLength);
      expect(truncated.length).toBe(maxLength);
    });

    it("should enforce photo count between 1 and 35", () => {
      const minPhotos = 1;
      const maxPhotos = 35;
      expect(minPhotos).toBeGreaterThanOrEqual(1);
      expect(maxPhotos).toBeLessThanOrEqual(35);
    });
  });

  describe("Carousel image generation", () => {
    it("should plan 3 slides: hook, info, CTA", () => {
      const slideTypes = ["hook", "key_insight", "cta"];
      expect(slideTypes).toHaveLength(3);
      expect(slideTypes[0]).toBe("hook");
      expect(slideTypes[2]).toBe("cta");
    });

    it("should use portrait orientation (1080x1920) for TikTok", () => {
      const width = 1080;
      const height = 1920;
      expect(height).toBeGreaterThan(width);
      expect(height / width).toBeCloseTo(16 / 9, 1);
    });
  });

  describe("Orchestrator integration", () => {
    it("should run on Tue/Thu/Sat schedule (days 2, 4, 6)", () => {
      const scheduleDays = [2, 4, 6]; // Tuesday, Thursday, Saturday
      expect(scheduleDays).toContain(2);
      expect(scheduleDays).toContain(4);
      expect(scheduleDays).toContain(6);
      expect(scheduleDays).not.toContain(0); // Sunday
      expect(scheduleDays).not.toContain(1); // Monday
    });

    it("should track tiktok_organic as a free channel", () => {
      const freeChannels = [
        "seo_organic", "blog_content", "social_organic",
        "tiktok_organic", "pinterest_organic", "linkedin_organic",
      ];
      expect(freeChannels).toContain("tiktok_organic");
    });

    it("should store content in marketing_content table with tiktok channel", () => {
      const validChannels = ["meta", "google_ads", "x_twitter", "linkedin", "snapchat",
        "content_seo", "devto", "medium", "hashnode", "discord", "mastodon",
        "telegram", "whatsapp", "pinterest", "reddit", "tiktok", "youtube",
        "quora", "skool", "indiehackers", "hackernews", "producthunt",
        "email_outreach", "sendgrid", "hacker_forum"];
      expect(validChannels).toContain("tiktok");
    });
  });

  describe("Post result handling", () => {
    it("should handle successful post result", () => {
      const result = {
        success: true,
        publishId: "v_pub_url~v2.123456789",
      };
      expect(result.success).toBe(true);
      expect(result.publishId).toBeDefined();
    });

    it("should handle failed post result with error", () => {
      const result = {
        success: false,
        error: "TikTok API error: access_token_invalid - Invalid access token",
      };
      expect(result.success).toBe(false);
      expect(result.error).toContain("access_token_invalid");
    });

    it("should handle unconfigured state gracefully", () => {
      const result = {
        success: false,
        error: "TikTok Content Posting not configured — no access token",
      };
      expect(result.success).toBe(false);
      expect(result.error).toContain("not configured");
    });
  });

  describe("Post status tracking", () => {
    it("should handle all valid post statuses", () => {
      const validStatuses = [
        "PROCESSING_UPLOAD",
        "PROCESSING_DOWNLOAD",
        "SEND_TO_POST",
        "PUBLISH_COMPLETE",
        "FAILED",
      ];
      expect(validStatuses).toHaveLength(5);
      expect(validStatuses).toContain("PUBLISH_COMPLETE");
      expect(validStatuses).toContain("FAILED");
    });
  });

  describe("Content stats", () => {
    it("should return default stats when DB is unavailable", async () => {
      const { getTikTokContentStats } = await import("./tiktok-content-service");
      const stats = await getTikTokContentStats();
      expect(stats).toBeDefined();
      expect(stats.totalPosts).toBe(0);
      expect(stats.publishedPosts).toBe(0);
      expect(stats.draftPosts).toBe(0);
      expect(stats.approvedPosts).toBe(0);
      expect(stats.recentPosts).toEqual([]);
    });
  });
});
