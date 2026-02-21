import { z } from "zod";
import { adminProcedure, publicProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { blogPosts, blogCategories } from "../drizzle/schema";
import { eq, desc, sql, like, and, or } from "drizzle-orm";
import { invokeLLM } from "./_core/llm";

// ─── Blog Router ────────────────────────────────────────────────
export const blogRouter = router({
  // ── Public: List published posts ──
  listPublished: publicProcedure
    .input(z.object({
      category: z.string().optional(),
      search: z.string().optional(),
      page: z.number().default(1),
      limit: z.number().default(10),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const page = input?.page ?? 1;
      const limit = input?.limit ?? 10;
      const offset = (page - 1) * limit;

      const conditions = [eq(blogPosts.status, "published")];
      if (input?.category) {
        conditions.push(eq(blogPosts.category, input.category));
      }
      if (input?.search) {
        conditions.push(
          or(
            like(blogPosts.title, `%${input.search}%`),
            like(blogPosts.excerpt, `%${input.search}%`)
          )!
        );
      }

      const posts = await db
        .select()
        .from(blogPosts)
        .where(and(...conditions))
        .orderBy(desc(blogPosts.publishedAt))
        .limit(limit)
        .offset(offset);

      const [{ count }] = await db
        .select({ count: sql<number>`count(*)` })
        .from(blogPosts)
        .where(and(...conditions));

      return { posts, total: count, page, totalPages: Math.ceil(count / limit) };
    }),

  // ── Public: Get single post by slug ──
  getBySlug: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const [post] = await db
        .select()
        .from(blogPosts)
        .where(eq(blogPosts.slug, input.slug))
        .limit(1);

      if (!post) return null;

      // Increment view count
      await db
        .update(blogPosts)
        .set({ viewCount: sql`${blogPosts.viewCount} + 1` })
        .where(eq(blogPosts.id, post.id));

      return post;
    }),

  // ── Public: List categories ──
  listCategories: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    return db.select().from(blogCategories).orderBy(blogCategories.name);
  }),

  // ── Admin: List all posts (including drafts) ──
  adminList: adminProcedure
    .input(z.object({
      status: z.enum(["draft", "published", "archived"]).optional(),
      page: z.number().default(1),
      limit: z.number().default(20),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const page = input?.page ?? 1;
      const limit = input?.limit ?? 20;
      const offset = (page - 1) * limit;

      const conditions = [];
      if (input?.status) {
        conditions.push(eq(blogPosts.status, input.status));
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const posts = await db
        .select()
        .from(blogPosts)
        .where(whereClause)
        .orderBy(desc(blogPosts.createdAt))
        .limit(limit)
        .offset(offset);

      const [{ count }] = await db
        .select({ count: sql<number>`count(*)` })
        .from(blogPosts)
        .where(whereClause);

      return { posts, total: count, page, totalPages: Math.ceil(count / limit) };
    }),

  // ── Admin: Create post ──
  create: adminProcedure
    .input(z.object({
      title: z.string().min(1),
      slug: z.string().min(1),
      excerpt: z.string().optional(),
      content: z.string().min(1),
      category: z.string().min(1),
      tags: z.array(z.string()).optional(),
      metaTitle: z.string().optional(),
      metaDescription: z.string().optional(),
      focusKeyword: z.string().optional(),
      secondaryKeywords: z.array(z.string()).optional(),
      coverImageUrl: z.string().optional(),
      status: z.enum(["draft", "published"]).default("draft"),
      aiGenerated: z.boolean().default(false),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const seoScore = calculateSeoScore(input);

      await db.insert(blogPosts).values({
        ...input,
        seoScore,
        readingTimeMinutes: Math.ceil(input.content.split(/\s+/).length / 200),
        publishedAt: input.status === "published" ? new Date() : null,
      });

      // Update category post count
      const existing = await db
        .select()
        .from(blogCategories)
        .where(eq(blogCategories.slug, input.category))
        .limit(1);

      if (existing.length === 0) {
        await db.insert(blogCategories).values({
          name: input.category.replace(/-/g, " ").replace(/\b\w/g, l => l.toUpperCase()),
          slug: input.category,
          postCount: 1,
        });
      } else {
        await db
          .update(blogCategories)
          .set({ postCount: sql`${blogCategories.postCount} + 1` })
          .where(eq(blogCategories.slug, input.category));
      }

      return { success: true };
    }),

  // ── Admin: Update post ──
  update: adminProcedure
    .input(z.object({
      id: z.number(),
      title: z.string().optional(),
      slug: z.string().optional(),
      excerpt: z.string().optional(),
      content: z.string().optional(),
      category: z.string().optional(),
      tags: z.array(z.string()).optional(),
      metaTitle: z.string().optional(),
      metaDescription: z.string().optional(),
      focusKeyword: z.string().optional(),
      secondaryKeywords: z.array(z.string()).optional(),
      coverImageUrl: z.string().optional(),
      status: z.enum(["draft", "published", "archived"]).optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const { id, ...updates } = input;

      const updateData: Record<string, any> = { ...updates, updatedAt: new Date() };

      if (updates.status === "published") {
        updateData.publishedAt = new Date();
      }

      if (updates.content || updates.title || updates.focusKeyword) {
        updateData.seoScore = calculateSeoScore({
          title: updates.title || "",
          content: updates.content || "",
          focusKeyword: updates.focusKeyword || "",
          metaTitle: updates.metaTitle || "",
          metaDescription: updates.metaDescription || "",
          excerpt: updates.excerpt || "",
        });
      }

      if (updates.content) {
        updateData.readingTimeMinutes = Math.ceil(updates.content.split(/\s+/).length / 200);
      }

      await db.update(blogPosts).set(updateData).where(eq(blogPosts.id, id));
      return { success: true };
    }),

  // ── Admin: Delete post ──
  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      await db.delete(blogPosts).where(eq(blogPosts.id, input.id));
      return { success: true };
    }),

  // ── Admin: AI Generate blog post ──
  aiGenerate: adminProcedure
    .input(z.object({
      topic: z.string().min(1),
      focusKeyword: z.string().min(1),
      category: z.string().default("ai-tools"),
      tone: z.enum(["professional", "casual", "technical", "educational"]).default("professional"),
    }))
    .mutation(async ({ input }) => {
      const response = await invokeLLM({
        systemTag: "misc",
      model: "fast",
        messages: [
          {
            role: "system",
            content: `You are an expert SEO content writer for Archibald Titan, the world's most advanced local AI agent for credential management, cybersecurity, and developer tools. Write blog posts that are:
- SEO-optimized with the focus keyword naturally integrated
- 1500-2500 words long
- Written in markdown format with proper headings (H2, H3)
- Include practical examples and actionable advice
- Include a compelling introduction and conclusion
- Target developers, security professionals, and IT teams

Return a JSON object with these fields:
{
  "title": "SEO-optimized title (60 chars max)",
  "slug": "url-friendly-slug",
  "excerpt": "Compelling excerpt (160 chars max)",
  "content": "Full markdown content",
  "metaTitle": "Meta title for search engines (60 chars max)",
  "metaDescription": "Meta description (155 chars max)",
  "tags": ["tag1", "tag2", "tag3"],
  "secondaryKeywords": ["keyword1", "keyword2"]
}`
          },
          {
            role: "user",
            content: `Write a blog post about: "${input.topic}"
Focus keyword: "${input.focusKeyword}"
Category: ${input.category}
Tone: ${input.tone}`
          }
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "blog_post",
            strict: true,
            schema: {
              type: "object",
              properties: {
                title: { type: "string" },
                slug: { type: "string" },
                excerpt: { type: "string" },
                content: { type: "string" },
                metaTitle: { type: "string" },
                metaDescription: { type: "string" },
                tags: { type: "array", items: { type: "string" } },
                secondaryKeywords: { type: "array", items: { type: "string" } },
              },
              required: ["title", "slug", "excerpt", "content", "metaTitle", "metaDescription", "tags", "secondaryKeywords"],
              additionalProperties: false,
            },
          },
        },
      });

      const generated = JSON.parse(response.choices[0].message.content as string);
      return {
        ...generated,
        category: input.category,
        focusKeyword: input.focusKeyword,
        aiGenerated: true,
      };
    }),

  // ── Admin: Bulk generate SEO posts ──
  bulkGenerate: adminProcedure
    .input(z.object({
      topics: z.array(z.object({
        topic: z.string(),
        focusKeyword: z.string(),
        category: z.string(),
      })),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const results: { title: string; slug: string; status: string }[] = [];

      for (const topicConfig of input.topics) {
        try {
          const response = await invokeLLM({
            systemTag: "misc",
      model: "fast",
            messages: [
              {
                role: "system",
                content: `You are an expert SEO content writer for Archibald Titan, the world's most advanced local AI agent. Write a comprehensive, SEO-optimized blog post in markdown. Return JSON with: title, slug, excerpt, content, metaTitle, metaDescription, tags (array), secondaryKeywords (array).`
              },
              {
                role: "user",
                content: `Topic: "${topicConfig.topic}" | Focus keyword: "${topicConfig.focusKeyword}" | Category: ${topicConfig.category}`
              }
            ],
            response_format: {
              type: "json_schema",
              json_schema: {
                name: "blog_post",
                strict: true,
                schema: {
                  type: "object",
                  properties: {
                    title: { type: "string" },
                    slug: { type: "string" },
                    excerpt: { type: "string" },
                    content: { type: "string" },
                    metaTitle: { type: "string" },
                    metaDescription: { type: "string" },
                    tags: { type: "array", items: { type: "string" } },
                    secondaryKeywords: { type: "array", items: { type: "string" } },
                  },
                  required: ["title", "slug", "excerpt", "content", "metaTitle", "metaDescription", "tags", "secondaryKeywords"],
                  additionalProperties: false,
                },
              },
            },
          });

          const generated = JSON.parse(response.choices[0].message.content as string);
          const seoScore = calculateSeoScore({
            title: generated.title,
            content: generated.content,
            focusKeyword: topicConfig.focusKeyword,
            metaTitle: generated.metaTitle,
            metaDescription: generated.metaDescription,
            excerpt: generated.excerpt,
          });

          await db.insert(blogPosts).values({
            title: generated.title,
            slug: generated.slug,
            excerpt: generated.excerpt,
            content: generated.content,
            category: topicConfig.category,
            tags: generated.tags,
            metaTitle: generated.metaTitle,
            metaDescription: generated.metaDescription,
            focusKeyword: topicConfig.focusKeyword,
            secondaryKeywords: generated.secondaryKeywords,
            seoScore,
            readingTimeMinutes: Math.ceil(generated.content.split(/\s+/).length / 200),
            status: "published",
            publishedAt: new Date(),
            aiGenerated: true,
          });

          // Ensure category exists
          const existing = await db
            .select()
            .from(blogCategories)
            .where(eq(blogCategories.slug, topicConfig.category))
            .limit(1);

          if (existing.length === 0) {
            await db.insert(blogCategories).values({
              name: topicConfig.category.replace(/-/g, " ").replace(/\b\w/g, l => l.toUpperCase()),
              slug: topicConfig.category,
              postCount: 1,
            });
          } else {
            await db
              .update(blogCategories)
              .set({ postCount: sql`${blogCategories.postCount} + 1` })
              .where(eq(blogCategories.slug, topicConfig.category));
          }

          results.push({ title: generated.title, slug: generated.slug, status: "published" });
        } catch (err) {
          results.push({ title: topicConfig.topic, slug: "error", status: `failed: ${(err as Error).message}` });
        }
      }

      return { generated: results.length, results };
    }),

  // ── Admin: Get blog stats ──
  stats: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    const [totalResult] = await db.select({ count: sql<number>`count(*)` }).from(blogPosts);
    const [publishedResult] = await db.select({ count: sql<number>`count(*)` }).from(blogPosts).where(eq(blogPosts.status, "published"));
    const [draftResult] = await db.select({ count: sql<number>`count(*)` }).from(blogPosts).where(eq(blogPosts.status, "draft"));
    const [viewsResult] = await db.select({ total: sql<number>`COALESCE(SUM(viewCount), 0)` }).from(blogPosts);
    const [avgSeoResult] = await db.select({ avg: sql<number>`COALESCE(AVG(seoScore), 0)` }).from(blogPosts);

    return {
      total: totalResult.count,
      published: publishedResult.count,
      drafts: draftResult.count,
      totalViews: viewsResult.total,
      avgSeoScore: Math.round(avgSeoResult.avg),
    };
  }),
});

// ─── SEO Score Calculator ───────────────────────────────────────
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

  // Title contains keyword (15 points)
  if (keyword && post.title?.toLowerCase().includes(keyword)) score += 15;

  // Meta title exists and is good length (10 points)
  if (post.metaTitle && post.metaTitle.length >= 30 && post.metaTitle.length <= 60) score += 10;

  // Meta description exists and is good length (10 points)
  if (post.metaDescription && post.metaDescription.length >= 120 && post.metaDescription.length <= 160) score += 10;

  // Content length (15 points)
  const wordCount = (post.content || "").split(/\s+/).length;
  if (wordCount >= 1500) score += 15;
  else if (wordCount >= 800) score += 10;
  else if (wordCount >= 300) score += 5;

  // Keyword density (10 points)
  if (keyword && post.content) {
    const keywordCount = (post.content.toLowerCase().match(new RegExp(keyword, "g")) || []).length;
    const density = (keywordCount / wordCount) * 100;
    if (density >= 0.5 && density <= 2.5) score += 10;
    else if (density > 0 && density < 5) score += 5;
  }

  // Has headings (10 points)
  if (post.content?.includes("## ")) score += 10;

  // Excerpt exists (10 points)
  if (post.excerpt && post.excerpt.length >= 50) score += 10;

  // Content has links (5 points)
  if (post.content?.includes("[") && post.content?.includes("](")) score += 5;

  // Content has images (5 points)
  if (post.content?.includes("![")) score += 5;

  // Keyword in first paragraph (10 points)
  if (keyword && post.content) {
    const firstParagraph = post.content.split("\n\n")[0]?.toLowerCase() || "";
    if (firstParagraph.includes(keyword)) score += 10;
  }

  return Math.min(score, 100);
}
