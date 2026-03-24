/**
 * Advertising Dashboard v3.0 — Archibald Titan
 *
 * Elite upgrade: exposes ALL backend capabilities that were previously hidden.
 *
 * New sections vs v2:
 *  - Scheduler control panel (start/stop with live status + daily schedule display)
 *  - A/B Test Manager (create, record results, see winners)
 *  - Cross-Channel Attribution (which channels drive conversions)
 *  - Blog Post Gallery (all AI-generated posts with live links)
 *  - Campaign Performance (impressions, clicks, conversions, spend, CTR, CPC)
 *  - Activity Log (real-time feed of every advertising action with status icons)
 *  - Autonomous Content Cycle trigger + auto-approve controls
 *  - Channel Performance Intelligence (priority scores, success rates)
 *  - Budget utilization progress bar
 *  - TikTok pipeline with stats
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
  Megaphone, Play, Square, RefreshCw, Loader2, CheckCircle2, XCircle,
  AlertCircle, Clock, DollarSign, FileText, PenTool, MousePointerClick,
  TrendingUp, BarChart3, Zap, Globe, Activity, Calendar, Beaker,
  ChevronDown, ChevronUp, ExternalLink, Radio, Bot, Sparkles,
  Target, Users, Eye, Hash, Layers, Share2, Video, Mail, Link2, Star,
} from "lucide-react";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function statusIcon(status: string) {
  if (status === "success") return <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />;
  if (status === "failed") return <XCircle className="w-4 h-4 text-red-500 shrink-0" />;
  if (status === "partial") return <AlertCircle className="w-4 h-4 text-yellow-500 shrink-0" />;
  if (status === "skipped") return <Clock className="w-4 h-4 text-zinc-500 shrink-0" />;
  return <Clock className="w-4 h-4 text-zinc-400 shrink-0" />;
}

function channelIcon(channel: string) {
  if (!channel) return <Hash className="w-3.5 h-3.5" />;
  if (channel.includes("blog") || channel.includes("content")) return <FileText className="w-3.5 h-3.5" />;
  if (channel.includes("social") || channel.includes("twitter") || channel.includes("linkedin")) return <Share2 className="w-3.5 h-3.5" />;
  if (channel.includes("tiktok") || channel.includes("video") || channel.includes("youtube")) return <Video className="w-3.5 h-3.5" />;
  if (channel.includes("email")) return <Mail className="w-3.5 h-3.5" />;
  if (channel.includes("seo")) return <Globe className="w-3.5 h-3.5" />;
  if (channel.includes("affiliate")) return <Link2 className="w-3.5 h-3.5" />;
  if (channel.includes("community") || channel.includes("forum") || channel.includes("reddit")) return <Users className="w-3.5 h-3.5" />;
  return <Hash className="w-3.5 h-3.5" />;
}

function priorityColor(priority: number) {
  if (priority >= 8) return "text-emerald-400";
  if (priority >= 5) return "text-yellow-400";
  return "text-red-400";
}

function MetricCard({ icon: Icon, color, label, value, sub }: { icon: any; color: string; label: string; value: string | number; sub?: string }) {
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

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AdvertisingDashboard() {
  const [activeTab, setActiveTab] = useState("overview");
  const [isRunning, setIsRunning] = useState(false);
  const [abTestChannel, setAbTestChannel] = useState("");
  const [abVariantA, setAbVariantA] = useState("");
  const [abVariantB, setAbVariantB] = useState("");
  const [showCreateAB, setShowCreateAB] = useState(false);

  // ── Queries ──
  const dashboard = trpc.advertising.getDashboard.useQuery(undefined, { refetchInterval: 60_000 });
  const strategies = trpc.advertising.getStrategies.useQuery();
  const budget = trpc.advertising.getBudgetBreakdown.useQuery();
  const contentQueue = trpc.advertising.getContentQueue.useQuery({ limit: 30 });
  const channelStatuses = trpc.advertising.getChannelStatuses.useQuery();
  const channelPerf = trpc.advertising.getChannelPerformance.useQuery();
  const attribution = trpc.advertising.getCrossChannelAttribution.useQuery({ days: 30 });
  const abTests = trpc.advertising.getABTests.useQuery();
  const blogPostsQuery = trpc.advertising.getBlogPosts.useQuery({ limit: 20, offset: 0 });
  const campaignPerf = trpc.advertising.getCampaignPerformance.useQuery({ days: 30 });
  const activity = trpc.advertising.getActivity.useQuery({ limit: 50 });
  const tiktokStats = trpc.advertising.getTikTokStats.useQuery();

  // ── Mutations ──
  const runCycle = trpc.advertising.runCycle.useMutation({
    onSuccess: (result) => {
      setIsRunning(false);
      const ok = result.actions.filter((a: any) => a.status === "success").length;
      toast.success(`Cycle complete: ${ok}/${result.actions.length} actions succeeded`);
      dashboard.refetch(); activity.refetch(); blogPostsQuery.refetch();
    },
    onError: (err) => { setIsRunning(false); toast.error(err.message); },
  });

  const startScheduler = trpc.advertising.startScheduler.useMutation({
    onSuccess: () => { toast.success("Daily advertising scheduler started — promoting archibaldtitan.com every day"); dashboard.refetch(); },
    onError: (err) => toast.error(err.message),
  });

  const stopScheduler = trpc.advertising.stopScheduler.useMutation({
    onSuccess: () => { toast.info("Scheduler stopped"); dashboard.refetch(); },
    onError: (err) => toast.error(err.message),
  });

  const triggerContentCycle = trpc.advertising.triggerContentCycle.useMutation({
    onSuccess: (r: any) => {
      toast.success(`Content cycle: ${r.generated ?? 0} generated, ${r.autoApproved ?? 0} auto-approved, ${r.published ?? 0} published`);
      contentQueue.refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const autoApprove = trpc.advertising.autoApproveContent.useMutation({
    onSuccess: (r: any) => { toast.success(`Auto-approved ${r.approved ?? 0} high-quality pieces`); contentQueue.refetch(); },
    onError: (err) => toast.error(err.message),
  });

  const createABTest = trpc.advertising.createABTest.useMutation({
    onSuccess: () => {
      toast.success("A/B test created");
      abTests.refetch();
      setShowCreateAB(false);
      setAbTestChannel(""); setAbVariantA(""); setAbVariantB("");
    },
    onError: (err) => toast.error(err.message),
  });

  const recordABResult = trpc.advertising.recordABTestResult.useMutation({
    onSuccess: () => { toast.success("Result recorded"); abTests.refetch(); },
    onError: (err) => toast.error(err.message),
  });

  const triggerTikTok = trpc.advertising.triggerTikTokPost.useMutation({
    onSuccess: () => { toast.success("TikTok content pipeline triggered"); tiktokStats.refetch(); },
    onError: (err) => toast.error(err.message),
  });

  const data = dashboard.data;
  const perf = data?.performance;
  const strat = data?.strategy;

  return (
    <div className="space-y-5">

      {/* ── Header ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Megaphone className="w-6 h-6 text-cyan-400" />
            Autonomous Advertising Engine
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Daily promotion of <span className="text-cyan-400 font-semibold">archibaldtitan.com</span> — 80% free organic, 20% paid amplification
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="text-sm py-1 px-3 border-emerald-600/40 text-emerald-400">
            <Radio className="w-3 h-3 mr-1.5 animate-pulse" />
            Daily Schedule Active
          </Badge>
          <Badge variant="outline" className="text-sm py-1 px-3">
            <DollarSign className="w-3.5 h-3.5 mr-1" />
            ${strat?.monthlyBudget || 500} AUD/mo
          </Badge>
          <Button
            onClick={() => { setIsRunning(true); runCycle.mutate(); }}
            disabled={isRunning}
            size="sm"
            className="bg-cyan-600 hover:bg-cyan-700 text-white"
          >
            {isRunning ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Running...</> : <><Play className="w-4 h-4 mr-2" />Run Cycle Now</>}
          </Button>
        </div>
      </div>

      {/* ── Key Metrics ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <MetricCard icon={FileText} color="text-blue-400" label="Blog Posts (30d)" value={perf?.organic?.blogPostsPublished ?? "—"} />
        <MetricCard icon={PenTool} color="text-purple-400" label="Content Created" value={perf?.organic?.contentPiecesCreated ?? "—"} />
        <MetricCard icon={MousePointerClick} color="text-amber-400" label="Affiliate Clicks" value={perf?.organic?.affiliateClicks ?? "—"} />
        <MetricCard icon={Eye} color="text-cyan-400" label="Impressions (30d)" value={perf?.paid?.totalImpressions?.toLocaleString() ?? "—"} />
        <MetricCard icon={Target} color="text-emerald-400" label="Conversions" value={perf?.paid?.totalConversions ?? "—"} sub={perf?.paid?.conversionRate ? `${perf.paid.conversionRate}% CVR` : undefined} />
        <MetricCard icon={DollarSign} color="text-orange-400" label="Budget Used" value={perf?.budgetUtilization ? `${perf.budgetUtilization.utilizationPercent}%` : "—"} sub={perf?.budgetUtilization ? `$${perf.budgetUtilization.spent} / $${perf.budgetUtilization.monthlyBudget}` : undefined} />
      </div>

      {/* ── Budget Bar ── */}
      {perf?.budgetUtilization && (
        <Card className="border-border bg-card">
          <CardContent className="py-3 px-4">
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="text-muted-foreground">Monthly Budget Utilization</span>
              <span className="font-semibold">${perf.budgetUtilization.spent} / ${perf.budgetUtilization.monthlyBudget} AUD</span>
            </div>
            <Progress value={perf.budgetUtilization.utilizationPercent} className="h-2" />
            <div className="flex justify-between text-xs text-muted-foreground mt-1.5">
              <span>${perf.budgetUtilization.remaining} remaining</span>
              <span>{perf.budgetUtilization.utilizationPercent}% used</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Main Tabs ── */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="overview" className="text-xs">Overview</TabsTrigger>
          <TabsTrigger value="scheduler" className="text-xs">Scheduler</TabsTrigger>
          <TabsTrigger value="channels" className="text-xs">Channels</TabsTrigger>
          <TabsTrigger value="attribution" className="text-xs">Attribution</TabsTrigger>
          <TabsTrigger value="abtests" className="text-xs">A/B Tests</TabsTrigger>
          <TabsTrigger value="blog" className="text-xs">Blog Posts</TabsTrigger>
          <TabsTrigger value="content" className="text-xs">Content Queue</TabsTrigger>
          <TabsTrigger value="tiktok" className="text-xs">TikTok</TabsTrigger>
          <TabsTrigger value="activity" className="text-xs">Activity Log</TabsTrigger>
          <TabsTrigger value="strategies" className="text-xs">Strategies</TabsTrigger>
        </TabsList>

        {/* ── OVERVIEW ── */}
        <TabsContent value="overview" className="mt-4 space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="border-border bg-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-cyan-400" />
                  Paid Performance (30d)
                </CardTitle>
              </CardHeader>
              <CardContent>
                {perf?.paid ? (
                  <div className="space-y-3">
                    {[
                      { label: "Impressions", value: perf.paid.totalImpressions?.toLocaleString() ?? "0", icon: Eye, color: "text-cyan-400" },
                      { label: "Clicks", value: perf.paid.totalClicks?.toLocaleString() ?? "0", icon: MousePointerClick, color: "text-blue-400" },
                      { label: "CTR", value: `${perf.paid.ctr ?? 0}%`, icon: TrendingUp, color: "text-purple-400" },
                      { label: "Conversions", value: perf.paid.totalConversions?.toLocaleString() ?? "0", icon: Target, color: "text-emerald-400" },
                      { label: "CPC", value: `$${perf.paid.cpc ?? 0}`, icon: DollarSign, color: "text-amber-400" },
                      { label: "Total Spend", value: `$${perf.paid.totalSpend ?? 0} AUD`, icon: DollarSign, color: "text-orange-400" },
                    ].map(({ label, value, icon: Icon, color }) => (
                      <div key={label} className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2 text-muted-foreground"><Icon className={`w-3.5 h-3.5 ${color}`} />{label}</span>
                        <span className="font-semibold">{value}</span>
                      </div>
                    ))}
                  </div>
                ) : <p className="text-sm text-muted-foreground">No paid campaign data yet</p>}
              </CardContent>
            </Card>

            <Card className="border-border bg-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Globe className="w-4 h-4 text-emerald-400" />
                  Organic Performance (30d)
                </CardTitle>
              </CardHeader>
              <CardContent>
                {perf?.organic ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground flex items-center gap-2"><FileText className="w-3.5 h-3.5 text-blue-400" />Blog Posts Published</span>
                      <span className="font-semibold">{perf.organic.blogPostsPublished}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground flex items-center gap-2"><PenTool className="w-3.5 h-3.5 text-purple-400" />Content Pieces</span>
                      <span className="font-semibold">{perf.organic.contentPiecesCreated}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground flex items-center gap-2"><Link2 className="w-3.5 h-3.5 text-amber-400" />Affiliate Clicks</span>
                      <span className="font-semibold">{perf.organic.affiliateClicks}</span>
                    </div>
                    {perf.organic.contentByPlatform && Object.entries(perf.organic.contentByPlatform).slice(0, 5).map(([platform, count]) => (
                      <div key={platform} className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground capitalize">{platform.replace(/_/g, " ")}</span>
                        <span className="font-mono">{String(count)}</span>
                      </div>
                    ))}
                  </div>
                ) : <p className="text-sm text-muted-foreground">No organic data yet</p>}
              </CardContent>
            </Card>
          </div>

          {channelPerf.data && Array.isArray(channelPerf.data) && channelPerf.data.length > 0 && (
            <Card className="border-border bg-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Zap className="w-4 h-4 text-yellow-400" />
                  Channel Intelligence — Top Performers
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {(channelPerf.data as any[]).slice(0, 12).map((c: any) => (
                    <div key={c.channel} className="flex items-center gap-2 p-2 rounded-lg bg-muted/20 border border-border text-xs">
                      {channelIcon(c.channel)}
                      <span className="flex-1 truncate capitalize text-foreground/80">{c.channel.replace(/_/g, " ")}</span>
                      <span className={`font-bold ${priorityColor(c.priority)}`}>{c.priority}/10</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── SCHEDULER ── */}
        <TabsContent value="scheduler" className="mt-4 space-y-4">
          <Card className="border-emerald-600/30 bg-emerald-950/10">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
                Autonomous Advertising Scheduler
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-600/20 text-sm space-y-2">
                <div className="flex items-center gap-2 text-emerald-400 font-semibold">
                  <CheckCircle2 className="w-4 h-4" />
                  Running Daily — Promoting archibaldtitan.com Every Day
                </div>
                <p className="text-muted-foreground text-xs">
                  Runs once per day, checks every 30 minutes, persists state across server restarts.
                  Generates blog posts, social content, community engagement, email nurture, backlink outreach, TikTok content, and more — fully autonomously.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { label: "Advertising Cycle", value: "Daily (every day)", icon: Calendar, color: "text-cyan-400" },
                  { label: "Blog Posts", value: "Mon / Wed / Fri", icon: FileText, color: "text-blue-400" },
                  { label: "Social Media", value: "Daily (2–3 posts)", icon: Share2, color: "text-purple-400" },
                  { label: "Community Engagement", value: "Every cycle", icon: Users, color: "text-amber-400" },
                  { label: "Email Nurture", value: "Wednesday", icon: Mail, color: "text-orange-400" },
                  { label: "Backlink Outreach", value: "Monday", icon: Link2, color: "text-emerald-400" },
                  { label: "TikTok Content", value: "Wed / Fri", icon: Video, color: "text-pink-400" },
                  { label: "SEO Optimization", value: "Daily", icon: Globe, color: "text-cyan-400" },
                  { label: "Affiliate Optimization", value: "Wed / Fri", icon: Star, color: "text-yellow-400" },
                  { label: "Hacker Forums", value: "Mon / Wed / Fri", icon: Hash, color: "text-red-400" },
                ].map(({ label, value, icon: Icon, color }) => (
                  <div key={label} className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/20 border border-border text-xs">
                    <Icon className={`w-4 h-4 ${color} shrink-0`} />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium">{label}</p>
                      <p className="text-muted-foreground">{value}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => startScheduler.mutate()} disabled={startScheduler.isPending}>
                  {startScheduler.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
                  Start Scheduler
                </Button>
                <Button variant="outline" className="flex-1" onClick={() => stopScheduler.mutate()} disabled={stopScheduler.isPending}>
                  {stopScheduler.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Square className="w-4 h-4 mr-2" />}
                  Stop Scheduler
                </Button>
              </div>

              <div className="pt-2 border-t border-border space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Autonomous Content Controls</p>
                <div className="flex gap-2">
                  <Button className="flex-1 bg-purple-600 hover:bg-purple-700 text-white text-sm" onClick={() => triggerContentCycle.mutate({ maxPiecesPerPlatform: 3, autoApproveThreshold: 75, autoSchedule: true, autoPublishTikTok: true })} disabled={triggerContentCycle.isPending}>
                    {triggerContentCycle.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Bot className="w-4 h-4 mr-2" />}
                    Run Content Cycle
                  </Button>
                  <Button variant="outline" className="flex-1 text-sm" onClick={() => autoApprove.mutate({ threshold: 75 })} disabled={autoApprove.isPending}>
                    {autoApprove.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
                    Auto-Approve (≥75)
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── CHANNELS ── */}
        <TabsContent value="channels" className="mt-4 space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="border-border bg-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Activity className="w-4 h-4 text-cyan-400" />
                  Channel Connection Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                {channelStatuses.data ? (
                  <ScrollArea className="h-72">
                    <div className="space-y-1.5">
                      {Object.entries(channelStatuses.data as Record<string, any>).map(([channel, status]) => (
                        <div key={channel} className="flex items-center gap-2 p-2 rounded-lg bg-muted/20 border border-border text-xs">
                          {channelIcon(channel)}
                          <span className="flex-1 capitalize">{channel.replace(/_/g, " ")}</span>
                          <Badge variant="outline" className={status?.connected ? "border-emerald-600/40 text-emerald-400 text-xs" : "border-zinc-600/40 text-zinc-400 text-xs"}>
                            {status?.connected ? "Connected" : "Not configured"}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                ) : <p className="text-sm text-muted-foreground">Loading...</p>}
              </CardContent>
            </Card>

            <Card className="border-border bg-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Zap className="w-4 h-4 text-yellow-400" />
                  Channel Performance Intelligence
                </CardTitle>
              </CardHeader>
              <CardContent>
                {channelPerf.data && Array.isArray(channelPerf.data) && channelPerf.data.length > 0 ? (
                  <ScrollArea className="h-72">
                    <div className="space-y-1.5">
                      {(channelPerf.data as any[]).map((c: any) => (
                        <div key={c.channel} className="flex items-center gap-2 p-2 rounded-lg bg-muted/20 border border-border text-xs">
                          {channelIcon(c.channel)}
                          <span className="flex-1 capitalize">{c.channel.replace(/_/g, " ")}</span>
                          <div className="flex items-center gap-1.5">
                            <span className="text-muted-foreground">{c.successRate ? `${Math.round(c.successRate * 100)}%` : "—"}</span>
                            <span className={`font-bold ${priorityColor(c.priority)}`}>{c.priority}/10</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                ) : <p className="text-sm text-muted-foreground">No performance data yet — run a cycle to populate</p>}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── ATTRIBUTION ── */}
        <TabsContent value="attribution" className="mt-4 space-y-4">
          <Card className="border-border bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Layers className="w-4 h-4 text-purple-400" />
                Cross-Channel Attribution (30d)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {attribution.data && Array.isArray(attribution.data) && attribution.data.length > 0 ? (
                <div className="space-y-3">
                  {(attribution.data as any[]).map((item: any, i: number) => (
                    <div key={i} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2 capitalize">{channelIcon(item.channel)}{item.channel?.replace(/_/g, " ")}</span>
                        <span className="font-semibold text-cyan-400">{item.conversionShare ?? 0}%</span>
                      </div>
                      <Progress value={item.conversionShare ?? 0} className="h-1.5" />
                      <div className="flex gap-3 text-xs text-muted-foreground">
                        <span>{item.clicks ?? 0} clicks</span>
                        <span>{item.conversions ?? 0} conversions</span>
                        {item.revenue && <span>${item.revenue} revenue</span>}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Layers className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Attribution data will appear after campaigns run</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── A/B TESTS ── */}
        <TabsContent value="abtests" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Beaker className="w-4 h-4 text-amber-400" />
              A/B Test Manager
            </h3>
            <Button size="sm" variant="outline" onClick={() => setShowCreateAB(v => !v)}>
              {showCreateAB ? <ChevronUp className="w-3.5 h-3.5 mr-1.5" /> : <ChevronDown className="w-3.5 h-3.5 mr-1.5" />}
              New Test
            </Button>
          </div>

          {showCreateAB && (
            <Card className="border-amber-600/30 bg-amber-950/10">
              <CardContent className="pt-4 space-y-3">
                <Input value={abTestChannel} onChange={e => setAbTestChannel(e.target.value)} placeholder="Channel (e.g. blog_content, social_organic)" className="text-sm" />
                <Textarea value={abVariantA} onChange={e => setAbVariantA(e.target.value)} placeholder="Variant A description..." className="text-sm min-h-[80px]" />
                <Textarea value={abVariantB} onChange={e => setAbVariantB(e.target.value)} placeholder="Variant B description..." className="text-sm min-h-[80px]" />
                <Button className="w-full bg-amber-600 hover:bg-amber-700 text-white" onClick={() => createABTest.mutate({ channel: abTestChannel, variantADesc: abVariantA, variantBDesc: abVariantB })} disabled={createABTest.isPending || !abTestChannel || !abVariantA || !abVariantB}>
                  {createABTest.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Beaker className="w-4 h-4 mr-2" />}
                  Create A/B Test
                </Button>
              </CardContent>
            </Card>
          )}

          {abTests.data && Array.isArray(abTests.data) && abTests.data.length > 0 ? (
            <div className="space-y-3">
              {(abTests.data as any[]).map((test: any) => (
                <Card key={test.id} className="border-border bg-card">
                  <CardContent className="pt-4 pb-3">
                    <div className="flex items-center gap-2 mb-3">
                      <Badge variant="outline" className="text-xs capitalize">{test.channel?.replace(/_/g, " ")}</Badge>
                      <Badge variant="outline" className={`text-xs ${test.winner === "A" ? "border-emerald-600/40 text-emerald-400" : test.winner === "B" ? "border-blue-600/40 text-blue-400" : "border-zinc-600/40 text-zinc-400"}`}>
                        {test.winner ? `Winner: ${test.winner}` : "Running"}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="p-2 rounded-lg bg-emerald-950/20 border border-emerald-600/20">
                        <p className="text-xs text-emerald-400 font-semibold mb-1">Variant A</p>
                        <p className="text-xs text-muted-foreground">{test.variantADesc}</p>
                        <div className="flex gap-2 mt-2 text-xs"><span>{test.variantASuccess ?? 0} wins</span><span>{test.variantATotal ?? 0} total</span></div>
                        <div className="flex gap-1 mt-2">
                          <Button size="sm" className="h-6 text-xs px-2 bg-emerald-700 hover:bg-emerald-600" onClick={() => recordABResult.mutate({ testId: test.id, variant: "A", success: true })}>+Win</Button>
                          <Button size="sm" variant="outline" className="h-6 text-xs px-2" onClick={() => recordABResult.mutate({ testId: test.id, variant: "A", success: false })}>+Loss</Button>
                        </div>
                      </div>
                      <div className="p-2 rounded-lg bg-blue-950/20 border border-blue-600/20">
                        <p className="text-xs text-blue-400 font-semibold mb-1">Variant B</p>
                        <p className="text-xs text-muted-foreground">{test.variantBDesc}</p>
                        <div className="flex gap-2 mt-2 text-xs"><span>{test.variantBSuccess ?? 0} wins</span><span>{test.variantBTotal ?? 0} total</span></div>
                        <div className="flex gap-1 mt-2">
                          <Button size="sm" className="h-6 text-xs px-2 bg-blue-700 hover:bg-blue-600" onClick={() => recordABResult.mutate({ testId: test.id, variant: "B", success: true })}>+Win</Button>
                          <Button size="sm" variant="outline" className="h-6 text-xs px-2" onClick={() => recordABResult.mutate({ testId: test.id, variant: "B", success: false })}>+Loss</Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Beaker className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No A/B tests yet — create one to start optimizing</p>
            </div>
          )}
        </TabsContent>

        {/* ── BLOG POSTS ── */}
        <TabsContent value="blog" className="mt-4 space-y-4">
          <Card className="border-border bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-400" />
                AI-Generated Blog Posts ({blogPostsQuery.data?.total ?? 0} total)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {blogPostsQuery.isLoading ? (
                <div className="flex items-center justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-cyan-400" /></div>
              ) : blogPostsQuery.data?.items && blogPostsQuery.data.items.length > 0 ? (
                <ScrollArea className="h-[500px]">
                  <div className="space-y-2">
                    {blogPostsQuery.data.items.map((post: any) => (
                      <div key={post.id} className="p-3 rounded-xl border border-border bg-muted/20 space-y-1.5">
                        <div className="flex items-start gap-2">
                          <FileText className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold leading-tight">{post.title}</p>
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{post.excerpt || post.metaDescription}</p>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <Badge variant="outline" className={`text-xs ${post.publishedAt ? "border-emerald-600/40 text-emerald-400" : "border-zinc-600/40 text-zinc-400"}`}>
                            {post.publishedAt ? "Published" : "Draft"}
                          </Badge>
                          {post.category && <Badge variant="outline" className="text-xs">{post.category}</Badge>}
                          <span className="text-muted-foreground">{post.publishedAt ? new Date(post.publishedAt).toLocaleDateString() : new Date(post.createdAt).toLocaleDateString()}</span>
                          {post.slug && (
                            <a href={`https://archibaldtitan.com/blog/${post.slug}`} target="_blank" rel="noopener noreferrer" className="ml-auto text-cyan-400 hover:text-cyan-300 flex items-center gap-1">
                              View <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                        {post.tags && post.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {post.tags.slice(0, 4).map((tag: string) => (
                              <span key={tag} className="text-xs px-1.5 py-0.5 rounded bg-muted/40 text-muted-foreground">{tag}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No blog posts yet — run a cycle to generate content</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── CONTENT QUEUE ── */}
        <TabsContent value="content" className="mt-4 space-y-4">
          <Card className="border-border bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <PenTool className="w-4 h-4 text-purple-400" />
                Content Queue
              </CardTitle>
            </CardHeader>
            <CardContent>
              {contentQueue.isLoading ? (
                <div className="flex items-center justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-cyan-400" /></div>
              ) : contentQueue.data?.items && contentQueue.data.items.length > 0 ? (
                <ScrollArea className="h-[500px]">
                  <div className="space-y-2">
                    {contentQueue.data.items.map((item: any) => (
                      <div key={item.id} className="p-3 rounded-xl border border-border bg-muted/20">
                        <div className="flex items-start gap-2">
                          {channelIcon(item.channel)}
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-muted-foreground capitalize mb-0.5">{item.channel?.replace(/_/g, " ")}</p>
                            <p className="text-sm line-clamp-2">{item.content}</p>
                          </div>
                          <Badge variant="outline" className={`text-xs shrink-0 ${item.status === "approved" ? "border-emerald-600/40 text-emerald-400" : item.status === "published" ? "border-blue-600/40 text-blue-400" : item.status === "rejected" ? "border-red-600/40 text-red-400" : "border-zinc-600/40 text-zinc-400"}`}>
                            {item.status}
                          </Badge>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1.5">{new Date(item.createdAt).toLocaleString()}</div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <PenTool className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No content in queue</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── TIKTOK ── */}
        <TabsContent value="tiktok" className="mt-4 space-y-4">
          <Card className="border-pink-600/30 bg-pink-950/10">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Video className="w-4 h-4 text-pink-400" />
                TikTok Content Pipeline
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {tiktokStats.data ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: "Total Posts", value: (tiktokStats.data as any).totalPosts ?? 0 },
                    { label: "Published", value: (tiktokStats.data as any).published ?? 0 },
                    { label: "Pending", value: (tiktokStats.data as any).pending ?? 0 },
                    { label: "Failed", value: (tiktokStats.data as any).failed ?? 0 },
                  ].map(({ label, value }) => (
                    <div key={label} className="p-3 rounded-xl bg-muted/20 border border-border text-center">
                      <p className="text-2xl font-bold">{value}</p>
                      <p className="text-xs text-muted-foreground">{label}</p>
                    </div>
                  ))}
                </div>
              ) : null}
              <Button className="w-full bg-pink-600 hover:bg-pink-700 text-white" onClick={() => triggerTikTok.mutate()} disabled={triggerTikTok.isPending}>
                {triggerTikTok.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Video className="w-4 h-4 mr-2" />}
                Trigger TikTok Content Pipeline
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                Generates carousel images from blog posts and publishes to TikTok via the official API. Runs automatically on Wed/Fri.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── ACTIVITY LOG ── */}
        <TabsContent value="activity" className="mt-4 space-y-4">
          <Card className="border-border bg-card">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <Activity className="w-4 h-4 text-cyan-400" />
                Real-Time Activity Log
              </CardTitle>
              <Button size="sm" variant="ghost" onClick={() => activity.refetch()}><RefreshCw className="w-3.5 h-3.5" /></Button>
            </CardHeader>
            <CardContent>
              {activity.isLoading ? (
                <div className="flex items-center justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-cyan-400" /></div>
              ) : activity.data && Array.isArray(activity.data) && activity.data.length > 0 ? (
                <ScrollArea className="h-[500px]">
                  <div className="space-y-1.5">
                    {(activity.data as any[]).map((item: any, i: number) => (
                      <div key={i} className="flex items-start gap-2 p-2.5 rounded-lg bg-muted/20 border border-border text-xs">
                        {statusIcon(item.status)}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold capitalize">{item.channel?.replace(/_/g, " ")}</span>
                            <span className="text-muted-foreground">·</span>
                            <span className="text-muted-foreground">{item.action?.replace(/_/g, " ")}</span>
                          </div>
                          {item.details && <p className="text-muted-foreground mt-0.5 line-clamp-2">{item.details}</p>}
                        </div>
                        <span className="text-muted-foreground shrink-0">{new Date(item.createdAt || item.timestamp).toLocaleTimeString()}</span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Activity className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No activity yet — run a cycle to see the log</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── STRATEGIES ── */}
        <TabsContent value="strategies" className="mt-4 space-y-4">
          {strategies.data && Array.isArray(strategies.data) ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {(strategies.data as any[]).map((s: any) => (
                <Card key={s.name} className="border-border bg-card">
                  <CardContent className="pt-4 pb-3">
                    <div className="flex items-start gap-2 mb-2">
                      <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${s.costPerMonth === 0 ? "bg-emerald-400" : "bg-amber-400"}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold">{s.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{s.description}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs">
                      <Badge variant="outline" className={s.costPerMonth === 0 ? "border-emerald-600/40 text-emerald-400" : "border-amber-600/40 text-amber-400"}>
                        {s.costPerMonth === 0 ? "Free" : `$${s.costPerMonth}/mo`}
                      </Badge>
                      {s.frequency && <Badge variant="outline" className="text-xs">{s.frequency}</Badge>}
                      {s.expectedReach && <span className="text-muted-foreground">{s.expectedReach}</span>}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-cyan-400" /></div>
          )}
        </TabsContent>

      </Tabs>
    </div>
  );
}
