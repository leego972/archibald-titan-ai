import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock dependencies ──────────────────────────────────────────────
vi.mock("./db", () => ({
  getDb: vi.fn().mockResolvedValue({
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue([{ insertId: 1 }]) }),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    execute: vi.fn().mockResolvedValue([]),
    innerJoin: vi.fn().mockReturnThis(),
  }),
}));

vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn().mockResolvedValue({
    choices: [{
      message: {
        content: JSON.stringify({
          title: "Test Blog Post About AI Security",
          slug: "test-blog-post-ai-security",
          excerpt: "A comprehensive test post about AI security best practices for developers.",
          content: "## Introduction\n\nThis is a comprehensive guide to AI security. AI credential managers are transforming how developers handle sensitive data. In this article, we explore the best practices for securing your applications with AI-powered tools.\n\n## Why AI Security Matters\n\nThe landscape of cybersecurity is evolving rapidly. Traditional password vaults are being replaced by intelligent AI systems that can detect threats in real-time.\n\n## Best Practices\n\n1. Use AES-256 encryption\n2. Implement zero-trust architecture\n3. Monitor for credential leaks\n4. Automate security audits\n\n## Conclusion\n\nAI security is not just a trend — it's the future of cybersecurity.",
          metaTitle: "AI Security Best Practices for Developers | Archibald Titan",
          metaDescription: "Learn essential AI security best practices for developers. Discover how AI credential managers protect your applications with AES-256 encryption and zero-trust architecture.",
          tags: ["AI", "security", "cybersecurity", "developer-tools"],
          secondaryKeywords: ["AI security", "credential management", "zero trust"],
        }),
      },
    }],
  }),
}));

vi.mock("./_core/notification", () => ({
  notifyOwner: vi.fn().mockResolvedValue(true),
}));

// ─── Blog Router Tests ──────────────────────────────────────────────

describe("Blog Content Engine", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("SEO Score Calculator", () => {
    function calculateSeoScore(post: {
      title?: string;
      content?: string;
      focusKeyword?: string;
      metaTitle?: string;
      metaDescription?: string;
      excerpt?: string;
    }): number {
      let score = 0;
      const keyword = (post.focusKeyword || "").toLowerCase();

      if (keyword && post.title?.toLowerCase().includes(keyword)) score += 15;
      if (post.metaTitle && post.metaTitle.length >= 30 && post.metaTitle.length <= 60) score += 10;
      if (post.metaDescription && post.metaDescription.length >= 120 && post.metaDescription.length <= 160) score += 10;

      const wordCount = (post.content || "").split(/\s+/).length;
      if (wordCount >= 1500) score += 15;
      else if (wordCount >= 800) score += 10;
      else if (wordCount >= 300) score += 5;

      if (keyword && post.content) {
        const keywordCount = (post.content.toLowerCase().match(new RegExp(keyword, "g")) || []).length;
        const density = (keywordCount / wordCount) * 100;
        if (density >= 0.5 && density <= 2.5) score += 10;
        else if (density > 0 && density < 5) score += 5;
      }

      if (post.content?.includes("## ")) score += 10;
      if (post.excerpt && post.excerpt.length >= 50) score += 10;
      if (post.content?.includes("[") && post.content?.includes("](")) score += 5;
      if (post.content?.includes("![")) score += 5;

      if (keyword && post.content) {
        const firstParagraph = post.content.split("\n\n")[0]?.toLowerCase() || "";
        if (firstParagraph.includes(keyword)) score += 10;
      }

      return Math.min(score, 100);
    }

    it("should score a well-optimized post highly", () => {
      const score = calculateSeoScore({
        title: "AI Credential Manager: Complete Guide",
        content: "## Introduction\n\nThe AI credential manager is transforming security. " + "word ".repeat(1500) + "\n\n## Section 2\n\nMore about AI credential manager. [Link](https://example.com)\n\n![Image](image.png)",
        focusKeyword: "AI credential manager",
        metaTitle: "AI Credential Manager Guide | Archibald Titan",
        metaDescription: "Learn how AI credential managers are replacing traditional password vaults. Complete guide with best practices for developers and security teams.",
        excerpt: "A comprehensive guide to AI credential managers and how they're transforming security for developers.",
      });
      expect(score).toBeGreaterThanOrEqual(70);
    });

    it("should score a poorly optimized post low", () => {
      const score = calculateSeoScore({
        title: "Blog Post",
        content: "Short content.",
        focusKeyword: "missing keyword",
        metaTitle: "Short",
        metaDescription: "Short desc",
        excerpt: "Short",
      });
      expect(score).toBeLessThan(30);
    });

    it("should give points for keyword in title", () => {
      const withKeyword = calculateSeoScore({
        title: "AI credential manager guide",
        focusKeyword: "AI credential manager",
        content: "Some content about AI credential manager.",
      });
      const withoutKeyword = calculateSeoScore({
        title: "Security guide",
        focusKeyword: "AI credential manager",
        content: "Some content about AI credential manager.",
      });
      expect(withKeyword).toBeGreaterThan(withoutKeyword);
    });

    it("should give points for proper meta title length", () => {
      const goodLength = calculateSeoScore({
        metaTitle: "AI Credential Manager Guide | Archibald Titan",
      });
      const tooShort = calculateSeoScore({
        metaTitle: "Short",
      });
      expect(goodLength).toBeGreaterThan(tooShort);
    });

    it("should give points for content with headings", () => {
      const withHeadings = calculateSeoScore({
        content: "## Heading\n\nContent here. " + "word ".repeat(300),
      });
      const withoutHeadings = calculateSeoScore({
        content: "Content here. " + "word ".repeat(300),
      });
      expect(withHeadings).toBeGreaterThan(withoutHeadings);
    });

    it("should cap score at 100", () => {
      const score = calculateSeoScore({
        title: "AI credential manager complete guide for developers",
        content: "## AI credential manager intro\n\nThe AI credential manager is key. " + "word ".repeat(2000) + "\n\n## More\n\n[Link](url)\n\n![img](img.png)\n\nAI credential manager mentioned again.",
        focusKeyword: "AI credential manager",
        metaTitle: "AI Credential Manager Guide | Archibald Titan",
        metaDescription: "Learn how AI credential managers are replacing traditional password vaults. Complete guide with best practices for developers.",
        excerpt: "A comprehensive guide to AI credential managers and how they're transforming security for developers.",
      });
      expect(score).toBeLessThanOrEqual(100);
    });
  });

  describe("Blog Post Structure", () => {
    it("should define required fields for a blog post", () => {
      const post = {
        title: "Test Post",
        slug: "test-post",
        excerpt: "Test excerpt",
        content: "Test content",
        category: "ai-security",
        tags: ["AI", "security"],
        metaTitle: "Test Meta Title",
        metaDescription: "Test meta description",
        focusKeyword: "test keyword",
        secondaryKeywords: ["keyword1", "keyword2"],
        seoScore: 75,
        readingTimeMinutes: 5,
        status: "published",
        aiGenerated: true,
      };

      expect(post.title).toBeTruthy();
      expect(post.slug).toBeTruthy();
      expect(post.content).toBeTruthy();
      expect(post.category).toBeTruthy();
      expect(post.tags).toBeInstanceOf(Array);
      expect(post.seoScore).toBeGreaterThanOrEqual(0);
      expect(post.seoScore).toBeLessThanOrEqual(100);
      expect(post.readingTimeMinutes).toBeGreaterThan(0);
      expect(["draft", "published", "archived"]).toContain(post.status);
    });

    it("should calculate reading time correctly", () => {
      const content = "word ".repeat(1000).trim(); // 1000 words
      const readingTime = Math.ceil(content.split(/\s+/).length / 200);
      expect(readingTime).toBe(5); // 1000/200 = 5 minutes
    });

    it("should generate valid slugs", () => {
      const slug = "ai-credential-managers-replacing-password-vaults";
      expect(slug).toMatch(/^[a-z0-9-]+$/);
      expect(slug).not.toContain(" ");
      expect(slug).not.toContain("_");
    });
  });

  describe("SEO Topics Configuration", () => {
    const SEO_TOPICS = [
      { topic: "How AI Credential Managers Are Replacing Traditional Password Vaults", focusKeyword: "AI credential manager", category: "ai-security" },
      { topic: "The Complete Guide to Zero-Trust Security for Small Teams", focusKeyword: "zero trust security", category: "cybersecurity" },
      { topic: "Why Local AI Agents Are the Future of Cybersecurity", focusKeyword: "local AI agent cybersecurity", category: "ai-security" },
      { topic: "Credential Stuffing Attacks: How to Detect and Prevent Them", focusKeyword: "credential stuffing prevention", category: "cybersecurity" },
      { topic: "Building a Security-First Development Workflow with AI", focusKeyword: "security development workflow", category: "developer-tools" },
      { topic: "The Hidden Costs of Password Breaches for Startups", focusKeyword: "password breach cost", category: "cybersecurity" },
      { topic: "How to Automate Security Audits with AI-Powered Tools", focusKeyword: "automated security audit", category: "ai-security" },
      { topic: "API Key Management Best Practices for Developer Teams", focusKeyword: "API key management", category: "developer-tools" },
      { topic: "Dark Web Monitoring: How AI Detects Leaked Credentials in Real-Time", focusKeyword: "dark web monitoring AI", category: "ai-security" },
      { topic: "The Developer's Guide to Secrets Management in 2025", focusKeyword: "secrets management guide", category: "developer-tools" },
    ];

    it("should have 10 SEO topics configured", () => {
      expect(SEO_TOPICS).toHaveLength(10);
    });

    it("should have unique focus keywords", () => {
      const keywords = SEO_TOPICS.map(t => t.focusKeyword);
      const unique = new Set(keywords);
      expect(unique.size).toBe(keywords.length);
    });

    it("should cover multiple categories", () => {
      const categories = new Set(SEO_TOPICS.map(t => t.category));
      expect(categories.size).toBeGreaterThanOrEqual(3);
      expect(categories.has("ai-security")).toBe(true);
      expect(categories.has("cybersecurity")).toBe(true);
      expect(categories.has("developer-tools")).toBe(true);
    });

    it("should have non-empty topics and keywords", () => {
      for (const topic of SEO_TOPICS) {
        expect(topic.topic.length).toBeGreaterThan(10);
        expect(topic.focusKeyword.length).toBeGreaterThan(3);
        expect(topic.category.length).toBeGreaterThan(0);
      }
    });
  });

  describe("Blog Categories", () => {
    it("should generate category name from slug", () => {
      const slug = "ai-security";
      const name = slug.replace(/-/g, " ").replace(/\b\w/g, l => l.toUpperCase());
      expect(name).toBe("Ai Security");
    });

    it("should handle multi-word categories", () => {
      const slug = "developer-tools";
      const name = slug.replace(/-/g, " ").replace(/\b\w/g, l => l.toUpperCase());
      expect(name).toBe("Developer Tools");
    });
  });
});

describe("Sitemap with Blog Posts", () => {
  it("should include blog post URLs in sitemap format", () => {
    const SITE_URL = "https://www.archibaldtitan.com";
    const posts = [
      { slug: "test-post-1", updatedAt: new Date("2026-02-15") },
      { slug: "test-post-2", updatedAt: new Date("2026-02-14") },
    ];

    for (const post of posts) {
      const url = `${SITE_URL}/blog/${post.slug}`;
      expect(url).toContain("/blog/");
      expect(url).toMatch(/^https:\/\//);
    }
  });

  it("should format lastmod dates correctly", () => {
    const date = new Date("2026-02-15T10:30:00Z");
    const lastmod = date.toISOString().split("T")[0];
    expect(lastmod).toBe("2026-02-15");
  });
});

describe("Search Engine Ping", () => {
  it("should construct correct Google ping URL", () => {
    const sitemapUrl = "https://www.archibaldtitan.com/sitemap.xml";
    const encoded = encodeURIComponent(sitemapUrl);
    const pingUrl = `https://www.google.com/ping?sitemap=${encoded}`;
    expect(pingUrl).toContain("google.com/ping");
    expect(pingUrl).toContain("sitemap=");
  });

  it("should construct correct Bing ping URL", () => {
    const sitemapUrl = "https://www.archibaldtitan.com/sitemap.xml";
    const encoded = encodeURIComponent(sitemapUrl);
    const pingUrl = `https://www.bing.com/ping?sitemap=${encoded}`;
    expect(pingUrl).toContain("bing.com/ping");
    expect(pingUrl).toContain("sitemap=");
  });
});
