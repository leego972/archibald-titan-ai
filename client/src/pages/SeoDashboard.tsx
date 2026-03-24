/**
 * SEO Dashboard v4.0 — Archibald Titan
 *
 * Elite upgrade: exposes ALL SEO Engine v4 features that were previously missing.
 *
 * New sections vs v3:
 *  - GEO / AI Search tab (llms.txt, llms-full.txt, AI citation meta, GEO optimization)
 *  - Programmatic SEO tab (500+ pages, category breakdown, search/filter)
 *  - Topic Clusters tab (pillar + cluster pages with keyword counts)
 *  - Featured Snippets tab (answer blocks, schema types, target queries)
 *  - Content Intelligence tab (freshness, search intent, content gaps, semantic clusters)
 *  - Sitemaps tab (sitemap index, comparison, integrations, use-cases, robots.txt)
 *  - E-E-A-T structured data viewer
 *  - v4 stats in the status card (500+ pages, 23 features)
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Globe, Search, BarChart3, FileText, Link2, Zap, CheckCircle2, XCircle,
  AlertCircle, RefreshCw, Loader2, Activity, Target, Brain, Layers,
  BookOpen, TrendingUp, Hash, Code, Cpu, Map, Sparkles, Bot,
  ExternalLink, Clock, Shield, Star, Users,
} from "lucide-react";

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 80 ? "border-emerald-600/40 text-emerald-400" : score >= 60 ? "border-yellow-600/40 text-yellow-400" : "border-red-600/40 text-red-400";
  return <Badge variant="outline" className={`${color} font-bold`}>{score}/100</Badge>;
}

function intentColor(intent: string) {
  if (intent === "transactional") return "text-emerald-400";
  if (intent === "informational") return "text-blue-400";
  if (intent === "commercial") return "text-amber-400";
  if (intent === "navigational") return "text-purple-400";
  return "text-zinc-400";
}

function StatCard({ icon: Icon, color, label, value, sub }: { icon: any; color: string; label: string; value: string | number; sub?: string }) {
  return (
    <Card className="border-border bg-card">
      <CardContent className="pt-4 pb-3">
        <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
          <Icon className={`w-3.5 h-3.5 ${color}`} />
          {label}
        </div>
        <div className="text-2xl font-bold">{value}</div>
        {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
      </CardContent>
    </Card>
  );
}

export default function SeoDashboard() {
  const [activeTab, setActiveTab] = useState("overview");
  const [progCategory, setProgCategory] = useState<"all" | "comparison" | "integration" | "use-case" | "location">("all");
  const [progSearch, setProgSearch] = useState("");
  const [indexNowUrls, setIndexNowUrls] = useState("");
  const [showLlmsFull, setShowLlmsFull] = useState(false);
  const [schemaUrl, setSchemaUrl] = useState("/");
  const [schemaResult, setSchemaResult] = useState<any>(null);

  const status = trpc.seo.getStatus.useQuery(undefined, { refetchInterval: 120_000 });
  const health = trpc.seo.getHealthScore.useQuery();
  const keywords = trpc.seo.getKeywords.useQuery();
  const webVitals = trpc.seo.getWebVitals.useQuery();
  const internalLinks = trpc.seo.getInternalLinks.useQuery();
  const eventLog = trpc.seo.getEventLog.useQuery({ limit: 50 });
  const programmaticPages = trpc.seo.getProgrammaticPages.useQuery({ category: progCategory, limit: 50, offset: 0 });
  const topicClusters = trpc.seo.getTopicClusters.useQuery();
  const featuredSnippets = trpc.seo.getFeaturedSnippetTargets.useQuery();
  const intentMappings = trpc.seo.getSearchIntentMappings.useQuery();
  const semanticClusters = trpc.seo.getSemanticKeywordClusters.useQuery();
  const llmsTxt = trpc.seo.getLlmsTxt.useQuery();
  const llmsFullTxt = trpc.seo.getLlmsFullTxt.useQuery(undefined, { enabled: showLlmsFull });
  const sitemapIndex = trpc.seo.getSitemapIndex.useQuery();
  const robotsTxt = trpc.seo.getAdvancedRobotsTxt.useQuery();
  const enhancedSD = trpc.seo.getEnhancedStructuredData.useQuery();
  const eeatSD = trpc.seo.getEEATStructuredData.useQuery();

  const runOptimization = trpc.seo.runOptimization.useMutation({
    onSuccess: () => { toast.success("SEO optimization cycle complete"); status.refetch(); health.refetch(); eventLog.refetch(); },
    onError: (err) => toast.error(err.message),
  });

  const runGeo = trpc.seo.runGeoOptimization.useMutation({
    onSuccess: (r) => { toast.success(r.message); },
    onError: (err) => toast.error(err.message),
  });

  const analyzeGaps = trpc.seo.analyzeContentGaps.useMutation({
    onSuccess: (gaps: any[]) => { toast.success(`Found ${gaps.length} content gaps vs competitors`); },
    onError: (err) => toast.error(err.message),
  });

  const analyzeFreshness = trpc.seo.analyzeContentFreshness.useMutation({
    onSuccess: (scores: any[]) => { toast.success(`Freshness analysis complete — ${scores.length} pages scored`); },
    onError: (err) => toast.error(err.message),
  });

  // ── Intelligence queries ──────────────────────────────────────────────────
  const intelligenceReport = trpc.seoIntelligence.getIntelligenceReport.useQuery(undefined, { refetchInterval: 300_000 });
  const rankings = trpc.seoIntelligence.getRankings.useQuery(undefined, { refetchInterval: 120_000 });
  const strikingDistance = trpc.seoIntelligence.getStrikingDistance.useQuery();
  const risingKeywords = trpc.seoIntelligence.getRisingKeywords.useQuery();
  const fallingKeywords = trpc.seoIntelligence.getFallingKeywords.useQuery();
  const contentDecay = trpc.seoIntelligence.getContentDecay.useQuery();
  const backlinkGaps = trpc.seoIntelligence.getBacklinkGaps.useQuery();
  const aiPresenceSummary = trpc.seoIntelligence.getAiPresenceSummary.useQuery();
  const aiPresenceLog = trpc.seoIntelligence.getAiPresenceLog.useQuery({ limit: 30 });
  const internalLinkSuggestions = trpc.seoIntelligence.getInternalLinkSuggestions.useQuery();
  const orphanPages = trpc.seoIntelligence.getOrphanPages.useQuery();
  const coreWebVitals = trpc.seoIntelligence.getCoreWebVitals.useQuery();
  const serpFeatures = trpc.seoIntelligence.getSerpFeatures.useQuery();
  const cannibalization = trpc.seoIntelligence.getCannibalization.useQuery();
  const schemaAudit = trpc.seoIntelligence.auditAllSchemas.useQuery();
  const validateSchemaQ = trpc.seoIntelligence.validateSchema.useQuery({ url: schemaUrl }, { enabled: false });

  // ── Intelligence mutations ─────────────────────────────────────────────────
  const checkAiPresence = trpc.seoIntelligence.checkAiPresence.useMutation({
    onSuccess: () => { toast.success("AI presence check complete"); aiPresenceSummary.refetch(); aiPresenceLog.refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const updateRankPositions = trpc.seoIntelligence.updateRankPositions.useMutation({
    onSuccess: () => { toast.success("Rankings refreshed"); rankings.refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const submitIndexNow = trpc.seo.submitIndexNow.useMutation({
    onSuccess: () => { toast.success("URLs submitted to IndexNow"); setIndexNowUrls(""); },
    onError: (err) => toast.error(err.message),
  });

  const s = status.data;
  const h = health.data;

  const filteredPages = (programmaticPages.data?.items ?? []).filter((p: any) =>
    !progSearch || p.title?.toLowerCase().includes(progSearch.toLowerCase()) || p.slug?.toLowerCase().includes(progSearch.toLowerCase())
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Globe className="w-6 h-6 text-cyan-400" />
            SEO Engine v4.0
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            GEO-optimized · {s?.v4Stats?.programmaticPages ?? "500+"} programmatic pages · AI search ready · {s?.features?.length ?? 23} active features
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className={`text-sm py-1 px-3 ${s?.isKilled ? "border-red-600/40 text-red-400" : "border-emerald-600/40 text-emerald-400"}`}>
            {s?.isKilled ? <><XCircle className="w-3 h-3 mr-1.5" />Killed</> : <><CheckCircle2 className="w-3 h-3 mr-1.5" />Active</>}
          </Badge>
          {(h as any)?.score !== undefined && <ScoreBadge score={(h as any).score} />}
          <Button size="sm" className="bg-cyan-600 hover:bg-cyan-700 text-white" onClick={() => runOptimization.mutate()} disabled={runOptimization.isPending}>
            {runOptimization.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Optimizing...</> : <><RefreshCw className="w-4 h-4 mr-2" />Run Optimization</>}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3">
        <StatCard icon={Target} color="text-cyan-400" label="SEO Score" value={(h as any)?.score ?? "—"} sub={(h as any)?.grade} />
        <StatCard icon={FileText} color="text-blue-400" label="Prog. Pages" value={s?.v4Stats?.programmaticPages ?? "—"} sub="programmatic SEO" />
        <StatCard icon={Layers} color="text-purple-400" label="Topic Clusters" value={s?.v4Stats?.topicClusters ?? "—"} />
        <StatCard icon={Sparkles} color="text-amber-400" label="Snippet Targets" value={s?.v4Stats?.featuredSnippetTargets ?? "—"} />
        <StatCard icon={Hash} color="text-emerald-400" label="Semantic Clusters" value={s?.v4Stats?.semanticKeywordClusters ?? "—"} />
        <StatCard icon={Zap} color="text-orange-400" label="Active Features" value={s?.features?.length ?? "—"} sub="v4 capabilities" />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="overview" className="text-xs">Overview</TabsTrigger>
          <TabsTrigger value="geo" className="text-xs">GEO / AI Search</TabsTrigger>
          <TabsTrigger value="programmatic" className="text-xs">Programmatic SEO</TabsTrigger>
          <TabsTrigger value="clusters" className="text-xs">Topic Clusters</TabsTrigger>
          <TabsTrigger value="snippets" className="text-xs">Featured Snippets</TabsTrigger>
          <TabsTrigger value="content" className="text-xs">Content Intel</TabsTrigger>
          <TabsTrigger value="structured" className="text-xs">Structured Data</TabsTrigger>
          <TabsTrigger value="sitemaps" className="text-xs">Sitemaps</TabsTrigger>
          <TabsTrigger value="keywords" className="text-xs">Keywords</TabsTrigger>
          <TabsTrigger value="technical" className="text-xs">Technical</TabsTrigger>
          <TabsTrigger value="log" className="text-xs">Event Log</TabsTrigger>
          <TabsTrigger value="rankings" className="text-xs">Rankings</TabsTrigger>
          <TabsTrigger value="decay" className="text-xs">Content Decay</TabsTrigger>
          <TabsTrigger value="backlinks" className="text-xs">Backlinks</TabsTrigger>
          <TabsTrigger value="ai-search" className="text-xs">AI Search</TabsTrigger>
          <TabsTrigger value="schema-audit" className="text-xs">Schema Audit</TabsTrigger>
          <TabsTrigger value="link-intel" className="text-xs">Link Intel</TabsTrigger>
          <TabsTrigger value="cwv" className="text-xs">Core Web Vitals</TabsTrigger>
          <TabsTrigger value="serp" className="text-xs">SERP Features</TabsTrigger>
          <TabsTrigger value="cannibal" className="text-xs">Cannibalization</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4 space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="border-border bg-card">
              <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><Target className="w-4 h-4 text-cyan-400" />SEO Health Score</CardTitle></CardHeader>
              <CardContent>
                {h ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="text-4xl font-bold">{(h as any).score ?? (h as any).overall}</div>
                      <div>
                        <div className="text-sm font-semibold">{(h as any).grade}</div>
                        <div className="text-xs text-muted-foreground">{(h as any).summary}</div>
                      </div>
                    </div>
                    <Progress value={(h as any).score ?? (h as any).overall} className="h-2" />
                    {(h as any).issues && (h as any).issues.length > 0 && (
                      <div className="space-y-1.5 mt-2">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Issues</p>
                        {(h as any).issues.slice(0, 5).map((issue: any, i: number) => (
                          <div key={i} className="flex items-start gap-2 text-xs">
                            <AlertCircle className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${issue.severity === "critical" ? "text-red-400" : issue.severity === "warning" ? "text-yellow-400" : "text-blue-400"}`} />
                            <span className="text-muted-foreground">{issue.message}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : <div className="flex items-center justify-center py-6"><Loader2 className="w-6 h-6 animate-spin text-cyan-400" /></div>}
              </CardContent>
            </Card>

            <Card className="border-border bg-card">
              <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><Zap className="w-4 h-4 text-yellow-400" />Active v4 Features ({s?.features?.length ?? 0})</CardTitle></CardHeader>
              <CardContent>
                <ScrollArea className="h-52">
                  <div className="space-y-1">
                    {(s?.features ?? []).map((f: string, i: number) => (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span className="text-muted-foreground">{f}</span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          {webVitals.data && (
            <Card className="border-border bg-card">
              <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><Activity className="w-4 h-4 text-emerald-400" />Core Web Vitals</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {Object.entries(webVitals.data as Record<string, any>).slice(0, 8).map(([key, val]) => (
                    <div key={key} className="p-2.5 rounded-lg bg-muted/20 border border-border text-center">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">{key}</p>
                      <p className="text-lg font-bold mt-1">{typeof val === "object" ? JSON.stringify(val) : String(val)}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="geo" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold flex items-center gap-2"><Brain className="w-4 h-4 text-purple-400" />Generative Engine Optimization (GEO)</h3>
            <Button size="sm" className="bg-purple-600 hover:bg-purple-700 text-white" onClick={() => runGeo.mutate()} disabled={runGeo.isPending}>
              {runGeo.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Running...</> : <><Bot className="w-4 h-4 mr-2" />Run GEO Optimization</>}
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="border-purple-600/30 bg-purple-950/10">
              <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><Bot className="w-4 h-4 text-purple-400" />llms.txt — AI Crawler Standard</CardTitle></CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground mb-3">Tells ChatGPT, Claude, Gemini, and Perplexity exactly what Archibald Titan is and how to cite it. The GEO equivalent of robots.txt.</p>
                {llmsTxt.data?.content ? (
                  <ScrollArea className="h-48"><pre className="text-xs font-mono text-muted-foreground whitespace-pre-wrap">{llmsTxt.data.content}</pre></ScrollArea>
                ) : <div className="flex items-center justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-purple-400" /></div>}
                <div className="mt-3 flex gap-2">
                  <Button size="sm" variant="outline" className="text-xs" onClick={() => setShowLlmsFull(true)}>View llms-full.txt</Button>
                  <a href="https://archibaldtitan.com/llms.txt" target="_blank" rel="noopener noreferrer">
                    <Button size="sm" variant="outline" className="text-xs"><ExternalLink className="w-3 h-3 mr-1" />Live File</Button>
                  </a>
                </div>
              </CardContent>
            </Card>

            <Card className="border-purple-600/30 bg-purple-950/10">
              <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><BookOpen className="w-4 h-4 text-purple-400" />llms-full.txt — Complete Context</CardTitle></CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground mb-3">Full context file gives AI models complete knowledge about Archibald Titan — features, pricing, use cases, comparisons.</p>
                {showLlmsFull && llmsFullTxt.data?.content ? (
                  <ScrollArea className="h-48"><pre className="text-xs font-mono text-muted-foreground whitespace-pre-wrap">{llmsFullTxt.data.content.slice(0, 3000)}...</pre></ScrollArea>
                ) : (
                  <Button size="sm" variant="outline" className="w-full text-xs" onClick={() => setShowLlmsFull(true)}>Load llms-full.txt</Button>
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="border-border bg-card">
            <CardContent className="pt-4 pb-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                {[
                  { icon: Brain, color: "text-purple-400", title: "AI Citation Meta Tags", desc: "Every page has structured meta tags that tell AI models how to cite Archibald Titan — author, expertise, citations, AI-specific description." },
                  { icon: Globe, color: "text-cyan-400", title: "LLM Discoverability", desc: "llms.txt and llms-full.txt follow the emerging standard for AI crawler access, making Titan visible to ChatGPT, Claude, Gemini, Perplexity, and Copilot." },
                  { icon: Sparkles, color: "text-amber-400", title: "GEO Optimization Cycle", desc: "The GEO cycle updates all AI-facing content, regenerates structured data with AI-specific schemas, and submits updated pages to IndexNow for instant re-indexing." },
                ].map(({ icon: Icon, color, title, desc }) => (
                  <div key={title} className="flex items-start gap-2">
                    <Icon className={`w-4 h-4 ${color} shrink-0 mt-0.5`} />
                    <div><p className="font-semibold mb-1">{title}</p><p className="text-muted-foreground">{desc}</p></div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="programmatic" className="mt-4 space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-sm font-semibold flex items-center gap-2"><FileText className="w-4 h-4 text-blue-400" />Programmatic SEO Pages</h3>
              <p className="text-xs text-muted-foreground mt-0.5">{programmaticPages.data?.total ?? "—"} total pages auto-generated for long-tail keyword capture</p>
            </div>
            <div className="flex flex-wrap gap-1">
              {(["all", "comparison", "integration", "use-case", "location"] as const).map(cat => (
                <Button key={cat} size="sm" variant={progCategory === cat ? "default" : "outline"} className="text-xs capitalize" onClick={() => setProgCategory(cat)}>
                  {cat === "all" ? `All` : cat} ({cat === "all" ? (programmaticPages.data?.total ?? "—") : (programmaticPages.data?.categories?.[cat] ?? "—")})
                </Button>
              ))}
            </div>
          </div>

          <Input value={progSearch} onChange={e => setProgSearch(e.target.value)} placeholder="Search pages by title or slug..." className="text-sm" />

          {programmaticPages.isLoading ? (
            <div className="flex items-center justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-cyan-400" /></div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {filteredPages.slice(0, 60).map((page: any) => (
                <div key={page.slug} className="p-3 rounded-xl border border-border bg-muted/20 text-xs">
                  <div className="flex items-start gap-2">
                    <Badge variant="outline" className={`text-xs shrink-0 ${page.type === "comparison" ? "border-blue-600/40 text-blue-400" : page.type === "integration" ? "border-purple-600/40 text-purple-400" : page.type === "use-case" ? "border-emerald-600/40 text-emerald-400" : "border-amber-600/40 text-amber-400"}`}>{page.type}</Badge>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold leading-tight truncate">{page.title}</p>
                      <p className="text-muted-foreground mt-0.5 truncate">/{page.slug}</p>
                    </div>
                    <a href={`https://archibaldtitan.com/${page.slug}`} target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:text-cyan-300 shrink-0"><ExternalLink className="w-3 h-3" /></a>
                  </div>
                  {page.targetKeyword && <p className="text-muted-foreground mt-1.5 truncate">KW: {page.targetKeyword}</p>}
                </div>
              ))}
            </div>
          )}
          {filteredPages.length > 60 && <p className="text-xs text-muted-foreground text-center">Showing 60 of {filteredPages.length} pages</p>}
        </TabsContent>

        <TabsContent value="clusters" className="mt-4 space-y-4">
          <h3 className="text-sm font-semibold flex items-center gap-2"><Layers className="w-4 h-4 text-purple-400" />Topic Cluster Map ({topicClusters.data?.length ?? 0} clusters)</h3>
          {topicClusters.isLoading ? (
            <div className="flex items-center justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-cyan-400" /></div>
          ) : (
            <div className="space-y-3">
              {((topicClusters.data as any[]) ?? []).map((cluster: any) => (
                <Card key={cluster.pillarKeyword} className="border-border bg-card">
                  <CardContent className="pt-4 pb-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Star className="w-4 h-4 text-amber-400 shrink-0" />
                      <span className="font-semibold text-sm">{cluster.pillarKeyword}</span>
                      <Badge variant="outline" className="text-xs ml-auto">{cluster.clusterPages?.length ?? 0} cluster pages</Badge>
                    </div>
                    {cluster.pillarPage && <p className="text-xs text-muted-foreground mb-2">Pillar: <a href={`https://archibaldtitan.com${cluster.pillarPage}`} target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline">{cluster.pillarPage}</a></p>}
                    <div className="flex flex-wrap gap-1">
                      {(cluster.clusterPages ?? []).slice(0, 8).map((page: string, i: number) => (
                        <span key={i} className="text-xs px-1.5 py-0.5 rounded bg-muted/40 text-muted-foreground">{page}</span>
                      ))}
                      {(cluster.clusterPages ?? []).length > 8 && <span className="text-xs px-1.5 py-0.5 rounded bg-muted/40 text-muted-foreground">+{cluster.clusterPages.length - 8} more</span>}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="snippets" className="mt-4 space-y-4">
          <h3 className="text-sm font-semibold flex items-center gap-2"><Sparkles className="w-4 h-4 text-amber-400" />Featured Snippet Targets ({(featuredSnippets.data as any[])?.length ?? 0} targets)</h3>
          {featuredSnippets.isLoading ? (
            <div className="flex items-center justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-cyan-400" /></div>
          ) : (
            <div className="space-y-3">
              {((featuredSnippets.data as any[]) ?? []).map((snippet: any, i: number) => (
                <Card key={i} className="border-border bg-card">
                  <CardContent className="pt-4 pb-3">
                    <div className="flex items-start gap-2 mb-2">
                      <Badge variant="outline" className={`text-xs shrink-0 ${snippet.type === "paragraph" ? "border-blue-600/40 text-blue-400" : snippet.type === "list" ? "border-purple-600/40 text-purple-400" : snippet.type === "table" ? "border-emerald-600/40 text-emerald-400" : "border-amber-600/40 text-amber-400"}`}>{snippet.type}</Badge>
                      <p className="text-sm font-semibold">{snippet.targetQuery}</p>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-3">{snippet.answerBlock}</p>
                    {snippet.targetPage && <p className="text-xs text-muted-foreground mt-1.5">Page: <a href={`https://archibaldtitan.com${snippet.targetPage}`} target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline">{snippet.targetPage}</a></p>}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="content" className="mt-4 space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white" onClick={() => analyzeGaps.mutate()} disabled={analyzeGaps.isPending}>
              {analyzeGaps.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Search className="w-4 h-4 mr-2" />}Analyze Content Gaps
            </Button>
            <Button size="sm" variant="outline" onClick={() => analyzeFreshness.mutate()} disabled={analyzeFreshness.isPending}>
              {analyzeFreshness.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Clock className="w-4 h-4 mr-2" />}Analyze Freshness
            </Button>
          </div>

          {analyzeGaps.data && Array.isArray(analyzeGaps.data) && analyzeGaps.data.length > 0 && (
            <Card className="border-border bg-card">
              <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><Search className="w-4 h-4 text-blue-400" />Content Gaps vs Competitors ({analyzeGaps.data.length})</CardTitle></CardHeader>
              <CardContent>
                <ScrollArea className="h-64">
                  <div className="space-y-2">
                    {(analyzeGaps.data as any[]).map((gap: any, i: number) => (
                      <div key={i} className="p-2.5 rounded-lg bg-muted/20 border border-border text-xs">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold">{gap.keyword}</span>
                          <Badge variant="outline" className={`text-xs ${gap.priority === "high" ? "border-red-600/40 text-red-400" : gap.priority === "medium" ? "border-yellow-600/40 text-yellow-400" : "border-zinc-600/40 text-zinc-400"}`}>{gap.priority}</Badge>
                        </div>
                        <p className="text-muted-foreground">{gap.recommendation}</p>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}

          <Card className="border-border bg-card">
            <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><TrendingUp className="w-4 h-4 text-emerald-400" />Search Intent Mappings ({(intentMappings.data as any[])?.length ?? 0} pages)</CardTitle></CardHeader>
            <CardContent>
              {intentMappings.isLoading ? <div className="flex items-center justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-cyan-400" /></div> : (
                <ScrollArea className="h-56">
                  <div className="space-y-1.5">
                    {((intentMappings.data as any[]) ?? []).map((mapping: any, i: number) => (
                      <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-muted/20 border border-border text-xs">
                        <span className={`font-semibold shrink-0 ${intentColor(mapping.intent)}`}>{mapping.intent}</span>
                        <span className="flex-1 truncate text-muted-foreground">{mapping.page}</span>
                        {mapping.primaryKeyword && <span className="text-muted-foreground truncate max-w-[120px]">{mapping.primaryKeyword}</span>}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><Hash className="w-4 h-4 text-cyan-400" />Semantic Keyword Clusters ({(semanticClusters.data as any[])?.length ?? 0})</CardTitle></CardHeader>
            <CardContent>
              {semanticClusters.isLoading ? <div className="flex items-center justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-cyan-400" /></div> : (
                <div className="space-y-3">
                  {((semanticClusters.data as any[]) ?? []).slice(0, 8).map((cluster: any) => (
                    <div key={cluster.seedKeyword} className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold">{cluster.seedKeyword}</span>
                        <Badge variant="outline" className="text-xs">{cluster.keywords?.length ?? 0} keywords</Badge>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {(cluster.keywords ?? []).slice(0, 6).map((kw: string, i: number) => (
                          <span key={i} className="text-xs px-1.5 py-0.5 rounded bg-muted/40 text-muted-foreground">{kw}</span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="structured" className="mt-4 space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="border-border bg-card">
              <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><Code className="w-4 h-4 text-blue-400" />Enhanced Structured Data ({(enhancedSD.data as any[])?.length ?? 0} schemas)</CardTitle></CardHeader>
              <CardContent>
                {enhancedSD.isLoading ? <div className="flex items-center justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-cyan-400" /></div> : (
                  <ScrollArea className="h-64">
                    <div className="space-y-2">
                      {((enhancedSD.data as any[]) ?? []).map((schema: any, i: number) => (
                        <div key={i} className="p-2.5 rounded-lg bg-muted/20 border border-border text-xs">
                          <div className="flex items-center gap-2 mb-1"><Code className="w-3 h-3 text-blue-400" /><span className="font-semibold">{schema["@type"] || "Schema"}</span></div>
                          <pre className="text-muted-foreground overflow-hidden text-ellipsis whitespace-nowrap">{JSON.stringify(schema).slice(0, 120)}...</pre>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>

            <Card className="border-border bg-card">
              <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><Shield className="w-4 h-4 text-emerald-400" />E-E-A-T Structured Data</CardTitle></CardHeader>
              <CardContent>
                {eeatSD.isLoading ? <div className="flex items-center justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-cyan-400" /></div> : eeatSD.data ? (
                  <ScrollArea className="h-64"><pre className="text-xs font-mono text-muted-foreground whitespace-pre-wrap">{JSON.stringify(eeatSD.data, null, 2).slice(0, 2000)}</pre></ScrollArea>
                ) : null}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="sitemaps" className="mt-4 space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="border-border bg-card">
              <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><Map className="w-4 h-4 text-cyan-400" />Sitemap Index</CardTitle></CardHeader>
              <CardContent>
                {sitemapIndex.data?.xml ? (
                  <ScrollArea className="h-48"><pre className="text-xs font-mono text-muted-foreground whitespace-pre-wrap">{sitemapIndex.data.xml}</pre></ScrollArea>
                ) : <div className="flex items-center justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-cyan-400" /></div>}
                <div className="flex flex-wrap gap-2 mt-3">
                  {[
                    { label: "Main", href: "https://archibaldtitan.com/sitemap.xml" },
                    { label: "Comparisons", href: "https://archibaldtitan.com/sitemap-comparisons.xml" },
                    { label: "Integrations", href: "https://archibaldtitan.com/sitemap-integrations.xml" },
                    { label: "Use Cases", href: "https://archibaldtitan.com/sitemap-use-cases.xml" },
                  ].map(({ label, href }) => (
                    <a key={label} href={href} target="_blank" rel="noopener noreferrer">
                      <Button size="sm" variant="outline" className="text-xs"><ExternalLink className="w-3 h-3 mr-1" />{label}</Button>
                    </a>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="border-border bg-card">
              <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><Cpu className="w-4 h-4 text-purple-400" />Advanced robots.txt</CardTitle></CardHeader>
              <CardContent>
                {robotsTxt.data?.content ? (
                  <ScrollArea className="h-48"><pre className="text-xs font-mono text-muted-foreground whitespace-pre-wrap">{robotsTxt.data.content}</pre></ScrollArea>
                ) : <div className="flex items-center justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-cyan-400" /></div>}
                <a href="https://archibaldtitan.com/robots.txt" target="_blank" rel="noopener noreferrer" className="mt-3 block">
                  <Button size="sm" variant="outline" className="text-xs w-full"><ExternalLink className="w-3 h-3 mr-1" />View Live robots.txt</Button>
                </a>
              </CardContent>
            </Card>
          </div>

          <Card className="border-border bg-card">
            <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><Zap className="w-4 h-4 text-yellow-400" />IndexNow — Instant Indexing</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">Submit URLs to Bing, Yandex, and other IndexNow-compatible search engines for instant indexing (one URL per line).</p>
              <textarea
                value={indexNowUrls}
                onChange={e => setIndexNowUrls(e.target.value)}
                placeholder={"https://archibaldtitan.com/blog/new-post\nhttps://archibaldtitan.com/compare/titan-vs-1password"}
                className="w-full h-24 text-xs font-mono p-2 rounded-lg border border-border bg-muted/20 text-foreground resize-none"
              />
              <Button size="sm" className="bg-yellow-600 hover:bg-yellow-700 text-white" onClick={() => { const urls = indexNowUrls.split("\n").map(u => u.trim()).filter(Boolean); if (urls.length) submitIndexNow.mutate({ urls }); }} disabled={submitIndexNow.isPending || !indexNowUrls.trim()}>
                {submitIndexNow.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Zap className="w-4 h-4 mr-2" />}Submit to IndexNow
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="keywords" className="mt-4 space-y-4">
          <Card className="border-border bg-card">
            <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><Search className="w-4 h-4 text-cyan-400" />Keyword Analysis</CardTitle></CardHeader>
            <CardContent>
              {keywords.isLoading ? <div className="flex items-center justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-cyan-400" /></div> : keywords.data ? (
                <div className="space-y-4">
                  {(keywords.data as any).primaryKeywords && (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Primary Keywords</p>
                      <div className="space-y-1">
                        {(keywords.data as any).primaryKeywords.slice(0, 10).map((kw: any, i: number) => (
                          <div key={i} className="flex items-center gap-2 text-xs p-2 rounded bg-muted/20 border border-border">
                            <span className="flex-1 font-medium">{kw.keyword || kw}</span>
                            {kw.volume && <Badge variant="outline" className="text-xs">{kw.volume}</Badge>}
                            {kw.difficulty && <Badge variant="outline" className="text-xs">{kw.difficulty}</Badge>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {(keywords.data as any).longTailKeywords && (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Long-Tail Keywords</p>
                      <div className="flex flex-wrap gap-1.5">
                        {(keywords.data as any).longTailKeywords.slice(0, 20).map((kw: any, i: number) => (
                          <span key={i} className="text-xs px-2 py-1 rounded-full bg-muted/30 border border-border text-muted-foreground">{kw.keyword || kw}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : <p className="text-sm text-muted-foreground">No keyword data available</p>}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="technical" className="mt-4 space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="border-border bg-card">
              <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><Link2 className="w-4 h-4 text-blue-400" />Internal Link Analysis</CardTitle></CardHeader>
              <CardContent>
                {internalLinks.data ? (
                  <ScrollArea className="h-48"><pre className="text-xs font-mono text-muted-foreground whitespace-pre-wrap">{JSON.stringify(internalLinks.data, null, 2).slice(0, 1500)}</pre></ScrollArea>
                ) : <div className="flex items-center justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-cyan-400" /></div>}
              </CardContent>
            </Card>

            <Card className="border-border bg-card">
              <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><Activity className="w-4 h-4 text-emerald-400" />Engine Status</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {s ? (
                  <>
                    <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">Version</span><Badge variant="outline" className="text-xs border-cyan-600/40 text-cyan-400">v{s.version}</Badge></div>
                    <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">Status</span><Badge variant="outline" className={`text-xs ${s.isKilled ? "border-red-600/40 text-red-400" : "border-emerald-600/40 text-emerald-400"}`}>{s.isKilled ? "Killed" : "Active"}</Badge></div>
                    <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">Cached Report</span><span className="font-semibold">{s.hasCachedReport ? `${Math.round((s.cachedReportAge ?? 0) / 60000)}m old` : "None"}</span></div>
                    {s.v4Stats && (
                      <div className="pt-2 border-t border-border">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">v4 Stats</p>
                        {Object.entries(s.v4Stats).map(([key, val]) => (
                          <div key={key} className="flex items-center justify-between text-xs mb-1">
                            <span className="text-muted-foreground capitalize">{key.replace(/([A-Z])/g, " $1")}</span>
                            <span className="font-semibold">{String(val)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                ) : <div className="flex items-center justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-cyan-400" /></div>}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="log" className="mt-4 space-y-4">
          <Card className="border-border bg-card">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2"><Activity className="w-4 h-4 text-cyan-400" />SEO Event Log</CardTitle>
              <Button size="sm" variant="ghost" onClick={() => eventLog.refetch()}><RefreshCw className="w-3.5 h-3.5" /></Button>
            </CardHeader>
            <CardContent>
              {eventLog.isLoading ? <div className="flex items-center justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-cyan-400" /></div> : eventLog.data && Array.isArray(eventLog.data) && eventLog.data.length > 0 ? (
                <ScrollArea className="h-[500px]">
                  <div className="space-y-1.5">
                    {(eventLog.data as any[]).map((event: any, i: number) => (
                      <div key={i} className="flex items-start gap-2 p-2.5 rounded-lg bg-muted/20 border border-border text-xs">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <span className="font-semibold">{event.event || event.type}</span>
                          {event.details && <p className="text-muted-foreground mt-0.5 line-clamp-2">{event.details}</p>}
                        </div>
                        <span className="text-muted-foreground shrink-0">{new Date(event.timestamp || event.createdAt).toLocaleTimeString()}</span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Activity className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No events yet — run an optimization to see the log</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── RANKINGS ─────────────────────────────────────────────────── */}
        <TabsContent value="rankings" className="mt-4 space-y-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-muted-foreground">Keyword Rank Tracker</h3>
            <Button size="sm" variant="outline" onClick={() => updateRankPositions.mutate({})} disabled={updateRankPositions.isPending}>
              {updateRankPositions.isPending ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" />Updating...</> : <><RefreshCw className="w-3 h-3 mr-1" />Refresh</>}
            </Button>
          </div>
          {strikingDistance.data && strikingDistance.data.length > 0 && (
            <Card className="border-cyan-600/30 bg-cyan-950/20">
              <CardHeader className="pb-2"><CardTitle className="text-xs text-cyan-400 flex items-center gap-1"><Zap className="w-3.5 h-3.5" />Striking Distance — Positions 4-20 (Highest ROI)</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {strikingDistance.data.map((kw: any) => (
                    <div key={kw.keyword} className="bg-card rounded p-3 border border-border">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium">{kw.keyword}</span>
                        <Badge variant="outline" className="border-cyan-600/40 text-cyan-400">#{kw.currentPosition}</Badge>
                      </div>
                      <div className="flex gap-3 text-xs text-muted-foreground">
                        <span>Vol: {kw.searchVolume?.toLocaleString()}</span>
                        <span>Diff: {kw.difficulty}</span>
                        <span className={kw.trend === "rising" ? "text-emerald-400" : kw.trend === "falling" ? "text-red-400" : "text-muted-foreground"}>
                          {kw.trend === "rising" ? "↑" : kw.trend === "falling" ? "↓" : "→"} {kw.trend}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="border-border bg-card">
              <CardHeader className="pb-2"><CardTitle className="text-xs text-emerald-400">↑ Rising Keywords</CardTitle></CardHeader>
              <CardContent className="space-y-1">
                {(risingKeywords.data ?? []).slice(0, 8).map((kw: any) => (
                  <div key={kw.keyword} className="flex items-center justify-between text-xs p-1.5 rounded bg-muted/20">
                    <span>{kw.keyword}</span>
                    <span className="text-emerald-400 font-bold">#{kw.currentPosition} (+{kw.positionDelta})</span>
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card className="border-border bg-card">
              <CardHeader className="pb-2"><CardTitle className="text-xs text-red-400">↓ Falling Keywords</CardTitle></CardHeader>
              <CardContent className="space-y-1">
                {(fallingKeywords.data ?? []).slice(0, 8).map((kw: any) => (
                  <div key={kw.keyword} className="flex items-center justify-between text-xs p-1.5 rounded bg-muted/20">
                    <span>{kw.keyword}</span>
                    <span className="text-red-400 font-bold">#{kw.currentPosition} ({kw.positionDelta})</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
          <Card className="border-border bg-card">
            <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">All Tracked Keywords</CardTitle></CardHeader>
            <CardContent>
              <ScrollArea className="h-80">
                <div className="space-y-1.5">
                  {(rankings.data ?? []).map((kw: any) => (
                    <div key={kw.keyword} className="flex items-center justify-between text-xs p-2 rounded bg-muted/20 border border-border">
                      <span className="flex-1 font-medium">{kw.keyword}</span>
                      <span className="text-muted-foreground mx-3 truncate">{kw.url}</span>
                      <span className={`font-bold ${kw.currentPosition <= 10 ? "text-emerald-400" : kw.currentPosition <= 20 ? "text-cyan-400" : "text-muted-foreground"}`}>#{kw.currentPosition}</span>
                      {kw.positionDelta !== 0 && (
                        <span className={`ml-1 ${kw.positionDelta > 0 ? "text-emerald-400" : "text-red-400"}`}>({kw.positionDelta > 0 ? "+" : ""}{kw.positionDelta})</span>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── CONTENT DECAY ───────────────────────────────────────────────── */}
        <TabsContent value="decay" className="mt-4 space-y-3">
          {(contentDecay.data ?? []).map((page: any) => (
            <Card key={page.url} className={`border-border bg-card ${page.priority === "critical" ? "border-red-600/40" : page.priority === "high" ? "border-orange-600/40" : ""}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className={page.priority === "critical" ? "border-red-600/40 text-red-400" : page.priority === "high" ? "border-orange-600/40 text-orange-400" : "border-yellow-600/40 text-yellow-400"}>{page.priority}</Badge>
                      <span className="text-xs text-muted-foreground">{page.recommendedAction}</span>
                    </div>
                    <p className="text-sm font-medium">{page.title}</p>
                    <p className="text-xs text-muted-foreground">{page.url}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-lg font-bold text-red-400">{page.decayScore}/100</div>
                    <div className="text-xs text-muted-foreground">{page.daysSinceUpdate}d old</div>
                  </div>
                </div>
                <Progress value={page.decayScore} className="h-1.5 mb-2" />
                {page.refreshBrief && (
                  <div className="bg-muted/20 rounded p-2 text-xs">
                    <span className="text-cyan-400 font-semibold">Refresh Brief: </span>
                    <span className="text-muted-foreground">{page.refreshBrief}</span>
                  </div>
                )}
                <div className="flex flex-wrap gap-1 mt-2">
                  {page.topKeywords?.map((kw: string) => (
                    <span key={kw} className="text-xs px-2 py-0.5 rounded-full bg-muted/30 border border-border text-muted-foreground">{kw}</span>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* ── BACKLINKS ───────────────────────────────────────────────────── */}
        <TabsContent value="backlinks" className="mt-4 space-y-3">
          {(backlinkGaps.data ?? []).map((bl: any) => (
            <Card key={bl.domain} className="border-border bg-card">
              <CardContent className="p-4">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-sm font-bold">{bl.domain}</span>
                  <Badge variant="outline" className="border-blue-600/40 text-blue-400">DA {bl.domainAuthority}</Badge>
                  <Badge variant="outline" className="border-purple-600/40 text-purple-400">{bl.relevanceScore}% relevant</Badge>
                </div>
                {bl.linkedToCompetitors?.length > 0 && (
                  <p className="text-xs text-muted-foreground mb-2">Links to: {bl.linkedToCompetitors.join(", ")}</p>
                )}
                <div className="bg-muted/20 rounded p-3 space-y-1.5 text-xs">
                  <div><span className="text-cyan-400 font-semibold">Outreach Angle: </span><span className="text-muted-foreground">{bl.outreachAngle}</span></div>
                  <div><span className="text-yellow-400 font-semibold">Contact: </span><span className="text-muted-foreground">{bl.contactHint}</span></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* ── AI SEARCH ───────────────────────────────────────────────────── */}
        <TabsContent value="ai-search" className="mt-4 space-y-4">
          {aiPresenceSummary.data && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: "Mention Rate", value: `${aiPresenceSummary.data.mentionRate}%`, color: "text-cyan-400" },
                { label: "Avg Position", value: aiPresenceSummary.data.avgPosition > 0 ? `#${aiPresenceSummary.data.avgPosition}` : "—", color: "text-purple-400" },
                { label: "Total Checks", value: aiPresenceSummary.data.totalChecks, color: "text-muted-foreground" },
                { label: "Top Query", value: aiPresenceSummary.data.topQuery || "—", color: "text-amber-400" },
              ].map(m => (
                <Card key={m.label} className="border-border bg-card">
                  <CardContent className="pt-4 pb-3">
                    <div className={`text-xl font-bold ${m.color} truncate`}>{m.value}</div>
                    <div className="text-xs text-muted-foreground mt-1">{m.label}</div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
          {aiPresenceSummary.data?.platformBreakdown && (
            <Card className="border-border bg-card">
              <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Platform Breakdown</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-3">
                  {Object.entries(aiPresenceSummary.data.platformBreakdown).map(([platform, stats]: [string, any]) => (
                    <div key={platform} className="bg-muted/20 rounded p-3">
                      <div className="text-sm font-medium capitalize">{platform}</div>
                      <div className="text-lg font-bold text-cyan-400 mt-1">{Math.round((stats.mentions / Math.max(stats.checks, 1)) * 100)}%</div>
                      <div className="text-xs text-muted-foreground">{stats.mentions}/{stats.checks}</div>
                      <Progress value={(stats.mentions / Math.max(stats.checks, 1)) * 100} className="h-1 mt-2" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
          <Button onClick={() => checkAiPresence.mutate()} disabled={checkAiPresence.isPending} className="bg-purple-700 hover:bg-purple-600 text-white w-full">
            {checkAiPresence.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Checking...</> : <><Bot className="w-4 h-4 mr-2" />Run AI Presence Check</>}
          </Button>
          <Card className="border-border bg-card">
            <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Recent Checks</CardTitle></CardHeader>
            <CardContent>
              <ScrollArea className="h-80">
                <div className="space-y-2">
                  {(aiPresenceLog.data ?? []).map((entry: any, i: number) => (
                    <div key={i} className={`rounded p-3 border text-xs ${entry.titanMentioned ? "border-emerald-600/30 bg-emerald-950/10" : "border-border bg-muted/20"}`}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium capitalize">{entry.platform}</span>
                        {entry.titanMentioned ? (
                          <span className="text-emerald-400 font-bold">✓ Mentioned{entry.titanPosition ? ` (#${entry.titanPosition})` : ""}</span>
                        ) : (
                          <span className="text-red-400">✗ Not mentioned</span>
                        )}
                      </div>
                      <p className="text-muted-foreground italic">"{entry.query}"</p>
                      {!entry.titanMentioned && entry.recommendedAction && (
                        <p className="text-cyan-400 mt-1">→ {entry.recommendedAction}</p>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── SCHEMA AUDIT ────────────────────────────────────────────────── */}
        <TabsContent value="schema-audit" className="mt-4 space-y-4">
          <Card className="border-border bg-card">
            <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Validate Schema for a Page</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-3">
                <Input value={schemaUrl} onChange={e => setSchemaUrl(e.target.value)} placeholder="/features" className="flex-1" />
                <Button onClick={() => validateSchemaQ.refetch().then(r => setSchemaResult(r.data))} className="bg-cyan-700 hover:bg-cyan-600 text-white shrink-0">Validate</Button>
              </div>
              {schemaResult && (
                <div className="bg-muted/20 rounded p-4 space-y-2">
                  <div className="flex items-center gap-3">
                    <ScoreBadge score={schemaResult.score} />
                    <span className="text-sm">{schemaResult.url} — {schemaResult.pageType}</span>
                  </div>
                  {schemaResult.missingSchema?.length > 0 && (
                    <div className="text-xs"><span className="text-red-400 font-semibold">Missing: </span><span className="text-muted-foreground">{schemaResult.missingSchema.join(", ")}</span></div>
                  )}
                  {schemaResult.generatedSchema && (
                    <div>
                      <span className="text-xs text-emerald-400 font-semibold">Generated Schema:</span>
                      <ScrollArea className="h-40 mt-1"><pre className="text-xs font-mono text-muted-foreground">{JSON.stringify(schemaResult.generatedSchema, null, 2)}</pre></ScrollArea>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
          <Card className="border-border bg-card">
            <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">All Pages Schema Audit</CardTitle></CardHeader>
            <CardContent>
              <ScrollArea className="h-96">
                <div className="space-y-2">
                  {(schemaAudit.data ?? []).map((s: any) => (
                    <div key={s.url} className="p-3 rounded bg-muted/20 border border-border text-xs">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium">{s.url}</span>
                        <ScoreBadge score={s.score} />
                      </div>
                      <div className="text-muted-foreground">Has: {s.existingSchema?.join(", ") || "none"}</div>
                      {s.missingSchema?.length > 0 && <div className="text-red-400 mt-0.5">Missing: {s.missingSchema.join(", ")}</div>}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── LINK INTEL ──────────────────────────────────────────────────── */}
        <TabsContent value="link-intel" className="mt-4 space-y-4">
          {orphanPages.data && orphanPages.data.length > 0 && (
            <Card className="border-red-600/30 bg-red-950/10">
              <CardHeader className="pb-2"><CardTitle className="text-xs text-red-400">⚠ Orphan Pages (fewer than 2 inbound links)</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {orphanPages.data.map((p: any) => (
                  <div key={p.url} className="flex items-center justify-between text-xs p-2 rounded bg-muted/20 border border-border">
                    <span className="font-medium">{p.title}</span>
                    <span className="text-red-400">{p.inboundLinks} links</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
          <Card className="border-border bg-card">
            <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Internal Link Suggestions</CardTitle></CardHeader>
            <CardContent>
              <ScrollArea className="h-96">
                <div className="space-y-2">
                  {(internalLinkSuggestions.data ?? []).map((link: any, i: number) => (
                    <div key={i} className="p-3 rounded bg-muted/20 border border-border text-xs">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-muted-foreground">{link.sourceTitle} → {link.targetTitle}</span>
                        <span className="text-cyan-400">{link.relevanceScore}%</span>
                      </div>
                      <div>Anchor: <span className="text-cyan-300 font-medium">"{link.anchorText}"</span></div>
                      <div className="text-muted-foreground mt-0.5">{link.sourceUrl} → {link.targetUrl}</div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── CORE WEB VITALS ─────────────────────────────────────────────── */}
        <TabsContent value="cwv" className="mt-4 space-y-4">
          {(coreWebVitals.data ?? []).map((page: any) => (
            <Card key={page.url} className="border-border bg-card">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">{page.url}</CardTitle>
                  <ScoreBadge score={page.overallScore} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                  {[
                    { label: "LCP", value: `${page.lcp?.value}ms`, rating: page.lcp?.rating, fix: page.lcp?.fix },
                    { label: "CLS", value: page.cls?.value?.toFixed(3), rating: page.cls?.rating, fix: page.cls?.fix },
                    { label: "FID", value: `${page.fid?.value}ms`, rating: page.fid?.rating, fix: page.fid?.fix },
                    { label: "INP", value: `${page.inp?.value}ms`, rating: page.inp?.rating, fix: page.inp?.fix },
                  ].map(metric => (
                    <div key={metric.label} className="bg-muted/20 rounded p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-muted-foreground">{metric.label}</span>
                        <Badge variant="outline" className={`text-xs ${metric.rating === "good" ? "border-emerald-600/40 text-emerald-400" : metric.rating === "needs-improvement" ? "border-yellow-600/40 text-yellow-400" : "border-red-600/40 text-red-400"}`}>{metric.rating}</Badge>
                      </div>
                      <div className="text-lg font-bold">{metric.value}</div>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{metric.fix}</p>
                    </div>
                  ))}
                </div>
                <div className="bg-cyan-950/20 rounded p-2 border border-cyan-600/20 text-xs">
                  <span className="text-cyan-400 font-semibold">Top Fix: </span>
                  <span className="text-muted-foreground">{page.topFix}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* ── SERP FEATURES ───────────────────────────────────────────────── */}
        <TabsContent value="serp" className="mt-4 space-y-3">
          {(serpFeatures.data ?? []).map((feature: any, i: number) => (
            <Card key={i} className="border-border bg-card">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="text-xs capitalize">{feature.feature?.replace(/_/g, " ")}</Badge>
                      {feature.titanOwns ? (
                        <span className="text-xs text-emerald-400 font-bold">✓ Titan Owns</span>
                      ) : feature.competitorOwns ? (
                        <span className="text-xs text-red-400">✗ {feature.competitorOwns} owns</span>
                      ) : (
                        <span className="text-xs text-yellow-400">Unclaimed</span>
                      )}
                    </div>
                    <p className="text-sm font-medium">"{feature.keyword}"</p>
                  </div>
                </div>
                <div className="bg-muted/20 rounded p-3 space-y-1.5 text-xs">
                  <div><span className="text-cyan-400 font-semibold">Capture Strategy: </span><span className="text-muted-foreground">{feature.captureStrategy}</span></div>
                  <div><span className="text-purple-400 font-semibold">Content Template: </span><span className="text-muted-foreground">{feature.contentTemplate}</span></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* ── CANNIBALIZATION ─────────────────────────────────────────────── */}
        <TabsContent value="cannibal" className="mt-4 space-y-4">
          {!cannibalization.data || cannibalization.data.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <CheckCircle2 className="w-10 h-10 mx-auto mb-3 text-emerald-400" />
              <p className="text-sm">No keyword cannibalization detected</p>
            </div>
          ) : (
            <div className="space-y-4">
              {cannibalization.data.map((issue: any) => (
                <Card key={issue.keyword} className="border-orange-600/30 bg-orange-950/10">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <AlertCircle className="w-4 h-4 text-orange-400" />
                      <span className="text-sm font-bold text-orange-400">Cannibalization: "{issue.keyword}"</span>
                    </div>
                    <div className="space-y-1.5 mb-3">
                      {issue.competingUrls?.map((url: any) => (
                        <div key={url.url} className="flex items-center justify-between text-xs p-2 rounded bg-muted/20 border border-border">
                          <span className="font-medium">{url.title}</span>
                          <span className="text-muted-foreground">{url.url} — #{url.position}</span>
                        </div>
                      ))}
                    </div>
                    <div className="bg-muted/20 rounded p-3 space-y-1 text-xs">
                      <div><span className="text-emerald-400 font-semibold">Canonical: </span><span className="text-muted-foreground">{issue.recommendedCanonical}</span></div>
                      <div><span className="text-cyan-400 font-semibold">Strategy: </span><span className="text-muted-foreground">{issue.consolidationStrategy}</span></div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

      </Tabs>
    </div>
  );
}
