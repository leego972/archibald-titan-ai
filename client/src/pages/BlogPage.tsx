import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Link, useRoute } from "wouter";
import { Streamdown } from "streamdown";
import { ArrowLeft, Calendar, Clock, Eye, Search, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import AffiliateRecommendations from "@/components/AffiliateRecommendations";

// ─── Blog List Page ──────────────────────────────────────────────
export function BlogListPage() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string | undefined>();
  const [page, setPage] = useState(1);

  const { data, isLoading } = trpc.blog.listPublished.useQuery({
    search: search || undefined,
    category,
    page,
    limit: 12,
  });

  const { data: categories } = trpc.blog.listCategories.useQuery();

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="bg-gradient-to-br from-emerald-950 via-gray-950 to-gray-900 border-b border-emerald-900/30">
        <div className="container max-w-6xl py-16">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Archibald Titan Blog
          </h1>
          <p className="text-lg text-gray-400 max-w-2xl mb-8">
            Expert insights on AI security, credential management, developer tools, and cybersecurity best practices.
          </p>

          {/* Search */}
          <div className="flex gap-3 max-w-lg">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <Input
                placeholder="Search articles..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="pl-10 bg-gray-900/50 border-gray-700 text-white"
              />
            </div>
          </div>

          {/* Category Filters */}
          {categories && categories.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-6">
              <Badge
                variant={!category ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => { setCategory(undefined); setPage(1); }}
              >
                All
              </Badge>
              {categories.map((cat) => (
                <Badge
                  key={cat.id}
                  variant={category === cat.slug ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => { setCategory(cat.slug); setPage(1); }}
                >
                  {cat.name} ({cat.postCount})
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Posts Grid */}
      <div className="container max-w-6xl py-12">
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-card rounded-lg p-6 animate-pulse">
                <div className="h-4 bg-muted rounded w-1/3 mb-4" />
                <div className="h-6 bg-muted rounded w-full mb-2" />
                <div className="h-4 bg-muted rounded w-2/3 mb-4" />
                <div className="h-20 bg-muted rounded w-full" />
              </div>
            ))}
          </div>
        ) : data?.posts.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-muted-foreground text-lg">No articles found.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {data?.posts.map((post) => (
                <Link key={post.id} href={`/blog/${post.slug}`}>
                  <article className="bg-card border border-border rounded-lg p-6 hover:border-emerald-500/50 transition-colors cursor-pointer h-full flex flex-col">
                    <div className="flex items-center gap-2 mb-3">
                      <Badge variant="outline" className="text-xs">
                        {post.category}
                      </Badge>
                      {post.aiGenerated && (
                        <Badge variant="secondary" className="text-xs">AI</Badge>
                      )}
                    </div>
                    <h2 className="text-lg font-semibold text-foreground mb-2 line-clamp-2">
                      {post.title}
                    </h2>
                    <p className="text-sm text-muted-foreground mb-4 line-clamp-3 flex-1">
                      {post.excerpt}
                    </p>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground mt-auto pt-4 border-t border-border">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {post.publishedAt ? new Date(post.publishedAt).toLocaleDateString() : "Draft"}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {post.readingTimeMinutes} min read
                      </span>
                      <span className="flex items-center gap-1">
                        <Eye className="w-3 h-3" />
                        {post.viewCount}
                      </span>
                    </div>
                  </article>
                </Link>
              ))}
            </div>

            {/* Pagination */}
            {data && data.totalPages > 1 && (
              <div className="flex justify-center gap-2 mt-8">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage(p => p - 1)}
                >
                  Previous
                </Button>
                <span className="flex items-center px-4 text-sm text-muted-foreground">
                  Page {page} of {data.totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= data.totalPages}
                  onClick={() => setPage(p => p + 1)}
                >
                  Next
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Single Blog Post Page ───────────────────────────────────────
export function BlogPostPage() {
  const [, params] = useRoute("/blog/:slug");
  const slug = params?.slug || "";

  const { data: post, isLoading } = trpc.blog.getBySlug.useQuery(
    { slug },
    { enabled: !!slug }
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container max-w-3xl py-16">
          <div className="animate-pulse">
            <div className="h-8 bg-muted rounded w-2/3 mb-4" />
            <div className="h-4 bg-muted rounded w-1/3 mb-8" />
            <div className="space-y-3">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="h-4 bg-muted rounded w-full" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Article Not Found</h1>
          <p className="text-muted-foreground mb-4">This article doesn't exist or has been removed.</p>
          <Link href="/blog">
            <Button>Back to Blog</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Article Header */}
      <div className="bg-gradient-to-br from-emerald-950 via-gray-950 to-gray-900 border-b border-emerald-900/30">
        <div className="container max-w-3xl py-12">
          <Link href="/blog">
            <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white mb-6">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Blog
            </Button>
          </Link>

          <div className="flex items-center gap-2 mb-4">
            <Badge variant="outline">{post.category}</Badge>
            {post.aiGenerated && <Badge variant="secondary">AI Generated</Badge>}
          </div>

          <h1 className="text-3xl md:text-4xl font-bold text-white mb-4">
            {post.title}
          </h1>

          {post.excerpt && (
            <p className="text-lg text-gray-400 mb-6">{post.excerpt}</p>
          )}

          <div className="flex items-center gap-6 text-sm text-gray-500">
            <span className="flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              {post.publishedAt ? new Date(post.publishedAt).toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              }) : "Draft"}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              {post.readingTimeMinutes} min read
            </span>
            <span className="flex items-center gap-1">
              <Eye className="w-4 h-4" />
              {(post.viewCount ?? 0) + 1} views
            </span>
          </div>
        </div>
      </div>

      {/* Article Content */}
      <div className="container max-w-3xl py-12">
        <article className="prose prose-invert prose-emerald max-w-none">
          <Streamdown>{post.content}</Streamdown>
        </article>

        {/* Tags */}
        {post.tags && (post.tags as string[]).length > 0 && (
          <div className="flex items-center gap-2 mt-12 pt-8 border-t border-border">
            <Tag className="w-4 h-4 text-muted-foreground" />
            {(post.tags as string[]).map((tag) => (
              <Badge key={tag} variant="outline" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        )}

        {/* Affiliate Recommendations — contextual to blog content */}
        <AffiliateRecommendations context="content_creation" variant="card" limit={3} className="mt-8" />

        {/* CTA */}
        <div className="mt-12 p-8 bg-emerald-950/30 border border-emerald-900/30 rounded-lg text-center">
          <h3 className="text-xl font-semibold text-white mb-2">
            Ready to secure your credentials?
          </h3>
          <p className="text-gray-400 mb-4">
            Try Archibald Titan — the world's most advanced local AI agent for credential management.
          </p>
          <Link href="/">
            <Button className="bg-emerald-600 hover:bg-emerald-700">
              Get Started Free
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

// Blog list also gets affiliate recs at bottom
// (already added to BlogPostPage above)
export default BlogListPage;
