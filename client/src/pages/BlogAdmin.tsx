import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  FileText, Plus, Trash2, Edit, Eye, Sparkles, Loader2,
  BarChart3, BookOpen, PenTool, Rocket
} from "lucide-react";

// ─── SEO Keyword Topics for Bulk Generation ──────────────────────
const SEO_TOPICS = [
  { topic: "Best Password Manager for Developers in 2026 - Why AI-Powered Credential Management is the Future", focusKeyword: "best password manager for developers", category: "developer-tools" },
  { topic: "How to Automate Security Audits with AI - A Complete Guide for DevOps Teams", focusKeyword: "automate security audits AI", category: "cybersecurity" },
  { topic: "Local AI vs Cloud AI for Enterprise Security - Privacy, Speed, and Cost Comparison", focusKeyword: "local AI vs cloud AI security", category: "ai-security" },
  { topic: "Zero Trust Architecture Implementation Guide for Small Businesses in 2026", focusKeyword: "zero trust architecture small business", category: "cybersecurity" },
  { topic: "How to Build a Secure API Key Management System - Best Practices and Tools", focusKeyword: "API key management best practices", category: "developer-tools" },
  { topic: "Dark Web Monitoring for Developers - How to Protect Your Credentials and Code Repositories", focusKeyword: "dark web monitoring developers", category: "cybersecurity" },
  { topic: "AI-Powered Threat Detection - How Machine Learning is Revolutionizing Cybersecurity in 2026", focusKeyword: "AI threat detection cybersecurity", category: "ai-security" },
  { topic: "SSH Key Management Best Practices - Automate, Rotate, and Secure Your Infrastructure", focusKeyword: "SSH key management best practices", category: "developer-tools" },
  { topic: "How to Set Up Automated Vulnerability Scanning for Your CI/CD Pipeline", focusKeyword: "automated vulnerability scanning CI/CD", category: "developer-tools" },
  { topic: "The Complete Guide to Browser Extension Security - Protecting Your Credentials from Malicious Extensions", focusKeyword: "browser extension security credentials", category: "cybersecurity" },
];

export default function BlogAdmin() {

  const [activeTab, setActiveTab] = useState<"posts" | "create" | "generate">("posts");
  const [editingPost, setEditingPost] = useState<any>(null);

  // Form state
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("ai-security");
  const [focusKeyword, setFocusKeyword] = useState("");
  const [metaTitle, setMetaTitle] = useState("");
  const [metaDescription, setMetaDescription] = useState("");

  // AI generate state
  const [aiTopic, setAiTopic] = useState("");
  const [aiKeyword, setAiKeyword] = useState("");
  const [aiCategory, setAiCategory] = useState("ai-security");

  const { data: stats } = trpc.blog.stats.useQuery();
  const { data: postsData, refetch } = trpc.blog.adminList.useQuery({ page: 1, limit: 50 });
  const utils = trpc.useUtils();

  const createMutation = trpc.blog.create.useMutation({
    onSuccess: () => {
      toast.success("Post created");
      resetForm();
      setActiveTab("posts");
      utils.blog.adminList.invalidate();
      utils.blog.stats.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const updateMutation = trpc.blog.update.useMutation({
    onSuccess: () => {
      toast.success("Post updated");
      setEditingPost(null);
      resetForm();
      setActiveTab("posts");
      utils.blog.adminList.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.blog.delete.useMutation({
    onSuccess: () => {
      toast.success("Post deleted");
      utils.blog.adminList.invalidate();
      utils.blog.stats.invalidate();
    },
  });

  const aiGenerateMutation = trpc.blog.aiGenerate.useMutation({
    onSuccess: (data) => {
      setTitle(data.title);
      setSlug(data.slug);
      setExcerpt(data.excerpt);
      setContent(data.content);
      setMetaTitle(data.metaTitle);
      setMetaDescription(data.metaDescription);
      setFocusKeyword(data.focusKeyword);
      setCategory(data.category);
      setActiveTab("create");
      toast.success("AI Content Generated");
    },
    onError: (err) => toast.error(err.message),
  });

  const bulkGenerateMutation = trpc.blog.bulkGenerate.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.generated} posts generated`);
      utils.blog.adminList.invalidate();
      utils.blog.stats.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  function resetForm() {
    setTitle(""); setSlug(""); setExcerpt(""); setContent("");
    setCategory("ai-security"); setFocusKeyword(""); setMetaTitle(""); setMetaDescription("");
  }

  function handleEdit(post: any) {
    setEditingPost(post);
    setTitle(post.title);
    setSlug(post.slug);
    setExcerpt(post.excerpt || "");
    setContent(post.content);
    setCategory(post.category);
    setFocusKeyword(post.focusKeyword || "");
    setMetaTitle(post.metaTitle || "");
    setMetaDescription(post.metaDescription || "");
    setActiveTab("create");
  }

  function handleSave(status: "draft" | "published") {
    if (editingPost) {
      updateMutation.mutate({
        id: editingPost.id,
        title, slug, excerpt, content, category,
        focusKeyword, metaTitle, metaDescription, status,
      });
    } else {
      createMutation.mutate({
        title, slug, excerpt, content, category,
        focusKeyword, metaTitle, metaDescription, status,
        aiGenerated: false,
      });
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-emerald-500" />
            Blog Content Engine
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            AI-powered SEO content generation and management
          </p>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="text-2xl font-bold">{stats.total}</div>
            <div className="text-xs text-muted-foreground">Total Posts</div>
          </div>
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="text-2xl font-bold text-emerald-500">{stats.published}</div>
            <div className="text-xs text-muted-foreground">Published</div>
          </div>
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="text-2xl font-bold text-yellow-500">{stats.drafts}</div>
            <div className="text-xs text-muted-foreground">Drafts</div>
          </div>
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="text-2xl font-bold">{stats.totalViews}</div>
            <div className="text-xs text-muted-foreground">Total Views</div>
          </div>
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="text-2xl font-bold">{stats.avgSeoScore}/100</div>
            <div className="text-xs text-muted-foreground">Avg SEO Score</div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border pb-2">
        <Button
          variant={activeTab === "posts" ? "default" : "ghost"}
          size="sm"
          onClick={() => { setActiveTab("posts"); setEditingPost(null); resetForm(); }}
        >
          <FileText className="w-4 h-4 mr-1" /> Posts
        </Button>
        <Button
          variant={activeTab === "create" ? "default" : "ghost"}
          size="sm"
          onClick={() => { setActiveTab("create"); setEditingPost(null); resetForm(); }}
        >
          <Plus className="w-4 h-4 mr-1" /> {editingPost ? "Edit Post" : "Create Post"}
        </Button>
        <Button
          variant={activeTab === "generate" ? "default" : "ghost"}
          size="sm"
          onClick={() => setActiveTab("generate")}
        >
          <Sparkles className="w-4 h-4 mr-1" /> AI Generate
        </Button>
      </div>

      {/* Posts Tab */}
      {activeTab === "posts" && (
        <div className="space-y-3">
          {postsData?.posts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No blog posts yet. Create one or use AI to generate SEO content.</p>
            </div>
          ) : (
            postsData?.posts.map((post) => (
              <div key={post.id} className="bg-card border border-border rounded-lg p-4 flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-medium truncate">{post.title}</h3>
                    <Badge variant={post.status === "published" ? "default" : post.status === "draft" ? "secondary" : "outline"}>
                      {post.status}
                    </Badge>
                    {post.aiGenerated && <Badge variant="outline" className="text-xs">AI</Badge>}
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>{post.category}</span>
                    <span>SEO: {post.seoScore}/100</span>
                    <span>{post.viewCount} views</span>
                    <span>{post.readingTimeMinutes} min read</span>
                    {post.focusKeyword && <span className="text-emerald-500">KW: {post.focusKeyword}</span>}
                  </div>
                </div>
                <div className="flex gap-2 ml-4">
                  <Button variant="ghost" size="sm" onClick={() => handleEdit(post)}>
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="sm" asChild>
                    <a href={`/blog/${post.slug}`} target="_blank" rel="noopener noreferrer">
                      <Eye className="w-4 h-4" />
                    </a>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-500"
                    onClick={() => {
                      if (confirm("Delete this post?")) deleteMutation.mutate({ id: post.id });
                    }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Create/Edit Tab */}
      {activeTab === "create" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Title</label>
              <Input value={title} onChange={(e) => {
                setTitle(e.target.value);
                if (!editingPost) setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""));
              }} placeholder="Post title" />
            </div>
            <div>
              <label className="text-sm font-medium">Slug</label>
              <Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="url-slug" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium">Category</label>
              <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="ai-security" />
            </div>
            <div>
              <label className="text-sm font-medium">Focus Keyword</label>
              <Input value={focusKeyword} onChange={(e) => setFocusKeyword(e.target.value)} placeholder="main SEO keyword" />
            </div>
            <div>
              <label className="text-sm font-medium">Meta Title</label>
              <Input value={metaTitle} onChange={(e) => setMetaTitle(e.target.value)} placeholder="SEO meta title (60 chars)" />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">Meta Description</label>
            <Input value={metaDescription} onChange={(e) => setMetaDescription(e.target.value)} placeholder="SEO meta description (155 chars)" />
          </div>

          <div>
            <label className="text-sm font-medium">Excerpt</label>
            <Textarea value={excerpt} onChange={(e) => setExcerpt(e.target.value)} placeholder="Brief summary..." rows={2} />
          </div>

          <div>
            <label className="text-sm font-medium">Content (Markdown)</label>
            <Textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Write your post in Markdown..." rows={20} className="font-mono text-sm" />
          </div>

          <div className="flex gap-3">
            <Button onClick={() => handleSave("draft")} variant="outline" disabled={!title || !content || !slug}>
              <PenTool className="w-4 h-4 mr-2" /> Save as Draft
            </Button>
            <Button onClick={() => handleSave("published")} disabled={!title || !content || !slug} className="bg-emerald-600 hover:bg-emerald-700">
              <Rocket className="w-4 h-4 mr-2" /> Publish
            </Button>
          </div>
        </div>
      )}

      {/* AI Generate Tab */}
      {activeTab === "generate" && (
        <div className="space-y-6">
          {/* Single AI Generation */}
          <div className="bg-card border border-border rounded-lg p-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-emerald-500" />
              Generate Single Post
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <Input value={aiTopic} onChange={(e) => setAiTopic(e.target.value)} placeholder="Topic: e.g., AI in cybersecurity" />
              <Input value={aiKeyword} onChange={(e) => setAiKeyword(e.target.value)} placeholder="Focus keyword" />
              <Input value={aiCategory} onChange={(e) => setAiCategory(e.target.value)} placeholder="Category" />
            </div>
            <Button
              onClick={() => aiGenerateMutation.mutate({ topic: aiTopic, focusKeyword: aiKeyword, category: aiCategory })}
              disabled={!aiTopic || !aiKeyword || aiGenerateMutation.isPending}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {aiGenerateMutation.isPending ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating...</>
              ) : (
                <><Sparkles className="w-4 h-4 mr-2" /> Generate with AI</>
              )}
            </Button>
          </div>

          {/* Bulk SEO Content Generation */}
          <div className="bg-card border border-border rounded-lg p-6">
            <h3 className="font-semibold mb-2 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-emerald-500" />
              Bulk SEO Content Generation
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Generate {SEO_TOPICS.length} SEO-optimized blog posts targeting high-volume keywords identified by the SEO engine.
            </p>

            <div className="space-y-2 mb-4">
              {SEO_TOPICS.map((t, i) => (
                <div key={i} className="flex items-center gap-3 text-sm">
                  <Badge variant="outline" className="text-xs min-w-[100px] justify-center">{t.category}</Badge>
                  <span className="flex-1 truncate">{t.topic}</span>
                  <span className="text-emerald-500 text-xs">KW: {t.focusKeyword}</span>
                </div>
              ))}
            </div>

            <Button
              onClick={() => bulkGenerateMutation.mutate({ topics: SEO_TOPICS })}
              disabled={bulkGenerateMutation.isPending}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {bulkGenerateMutation.isPending ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating {SEO_TOPICS.length} posts...</>
              ) : (
                <><Rocket className="w-4 h-4 mr-2" /> Generate All {SEO_TOPICS.length} Posts</>
              )}
            </Button>

            {bulkGenerateMutation.data && (
              <div className="mt-4 p-4 bg-emerald-950/30 border border-emerald-900/30 rounded-lg">
                <p className="font-medium text-emerald-500 mb-2">
                  Generated {bulkGenerateMutation.data.generated} posts
                </p>
                {bulkGenerateMutation.data.results.map((r, i) => (
                  <div key={i} className="text-sm flex items-center gap-2">
                    <Badge variant={r.status === "published" ? "default" : "destructive"} className="text-xs">
                      {r.status}
                    </Badge>
                    <span className="truncate">{r.title}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
