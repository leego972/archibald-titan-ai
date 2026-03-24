/**
 * Advertising Dashboard — Elite v3.0
 *
 * Tabs:
 *  1. Overview         — live metrics, scheduler status, quick actions
 *  2. Intelligence     — competitor gaps, viral patterns, growth velocity, anomalies
 *  3. Attribution      — multi-touch ROI waterfall (first/last/linear/time-decay/blended)
 *  4. Budget           — channel allocation, ROI-based recommendations, rebalancer
 *  5. MVT Testing      — multi-variate test manager with Thompson Sampling convergence
 *  6. Channel Health   — health matrix with auto-pause/resume controls
 *  7. Content Queue    — approve/reject/preview generated content
 *  8. Blog Posts       — generated blog post gallery
 *  9. A/B Tests        — classic A/B test manager
 * 10. Activity Log     — full real-time activity feed
 */

import { useState } from "react";
import { trpc } from "../lib/trpc";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Switch } from "../components/ui/switch";
import { Progress } from "../components/ui/progress";
import { useToast } from "../hooks/use-toast";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    success: "bg-green-500/20 text-green-400 border-green-500/30",
    failed: "bg-red-500/20 text-red-400 border-red-500/30",
    skipped: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    running: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    paused: "bg-orange-500/20 text-orange-400 border-orange-500/30",
    active: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${map[status] ?? "bg-gray-500/20 text-gray-400 border-gray-500/30"}`}>
      {status}
    </span>
  );
}

function TrendArrow({ delta }: { delta: number }) {
  if (delta > 10) return <span className="text-green-400 font-bold">↑ {delta.toFixed(1)}%</span>;
  if (delta < -10) return <span className="text-red-400 font-bold">↓ {Math.abs(delta).toFixed(1)}%</span>;
  return <span className="text-gray-400">→ {delta.toFixed(1)}%</span>;
}

function SeverityBadge({ severity }: { severity: string }) {
  const map: Record<string, string> = {
    critical: "bg-red-500/20 text-red-400 border-red-500/30",
    warning: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    info: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${map[severity] ?? "bg-gray-500/20 text-gray-400"}`}>
      {severity}
    </span>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AdvertisingDashboard() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedContent, setSelectedContent] = useState<any>(null);
  const [viralPlatform, setViralPlatform] = useState("x_twitter");
  const [viralTopic, setViralTopic] = useState("");
  const [mvtChannel, setMvtChannel] = useState("x_twitter");
  const [mvtHooks, setMvtHooks] = useState("Hook A\nHook B\nHook C");
  const [previewContent, setPreviewContent] = useState<any>(null);

  // ─── Queries ─────────────────────────────────────────────────────────────
  const dashboard = trpc.advertising.getDashboard.useQuery(undefined, { refetchInterval: 60000 });
  const intelligence = trpc.advertising.getIntelligenceSummary.useQuery(undefined, { refetchInterval: 120000 });
  const velocity = trpc.advertising.getGrowthVelocity.useQuery(undefined, { refetchInterval: 120000 });
  const anomalies = trpc.advertising.getAnomalyAlerts.useQuery(undefined, { refetchInterval: 60000 });
  const attribution = trpc.advertising.getAttribution.useQuery({ days: 30 });
  const budgetRecs = trpc.advertising.getBudgetRecommendations.useQuery({ totalBudget: 500, currentAllocations: {} });
  const mvtTests = trpc.advertising.getMVTTests.useQuery();
  const viralPatterns = trpc.advertising.getViralPatterns.useQuery();
  const channelHealth = trpc.advertising.getChannelHealth.useQuery(undefined, { refetchInterval: 60000 });
  const contentQueue = trpc.advertising.getContentQueue.useQuery({ limit: 50 });
  const blogPosts = trpc.advertising.getBlogPosts.useQuery({ limit: 20 });
  const abTests = trpc.advertising.getABTests.useQuery();
  const activity = trpc.advertising.getActivity.useQuery({ limit: 100 });
  const competitorGaps = trpc.advertising.getCompetitorGaps.useQuery();
  const channelStatuses = trpc.advertising.getChannelStatuses.useQuery();

  // ─── Mutations ────────────────────────────────────────────────────────────
  const runCycle = trpc.advertising.runCycle.useMutation({
    onSuccess: () => { toast({ title: "Advertising cycle started", description: "Running full autonomous cycle now" }); dashboard.refetch(); },
    onError: (e) => toast({ title: "Cycle failed", description: e.message, variant: "destructive" }),
  });
  const startScheduler = trpc.advertising.startScheduler.useMutation({
    onSuccess: () => { toast({ title: "Scheduler started" }); },
  });
  const stopScheduler = trpc.advertising.stopScheduler.useMutation({
    onSuccess: () => { toast({ title: "Scheduler stopped" }); },
  });
  const updateStatus = trpc.advertising.updateContentStatus.useMutation({
    onSuccess: () => { contentQueue.refetch(); toast({ title: "Status updated" }); },
  });
  const triggerContentCycle = trpc.advertising.triggerContentCycle.useMutation({
    onSuccess: (r) => { toast({ title: "Content cycle complete", description: `Generated: ${(r as any).generated ?? 0}, Published: ${(r as any).published ?? 0}` }); },
  });
  const autoApprove = trpc.advertising.autoApproveContent.useMutation({
    onSuccess: (r) => { toast({ title: "Auto-approve complete", description: `Approved: ${(r as any).approved ?? 0}` }); contentQueue.refetch(); },
  });
  const generateViral = trpc.advertising.generateViralContent.useMutation({
    onSuccess: (r) => { setPreviewContent(r); toast({ title: "Viral content generated" }); },
    onError: (e) => toast({ title: "Generation failed", description: e.message, variant: "destructive" }),
  });
  const createMVT = trpc.advertising.createMVTTest.useMutation({
    onSuccess: () => { mvtTests.refetch(); toast({ title: "MVT test created" }); },
  });
  const resumeChannel = trpc.advertising.resumeChannel.useMutation({
    onSuccess: (_, vars) => { channelHealth.refetch(); toast({ title: `Channel ${vars.channel} resumed` }); },
  });
  const createABTest = trpc.advertising.createABTest.useMutation({
    onSuccess: () => { abTests.refetch(); toast({ title: "A/B test created" }); },
  });

  const data = dashboard.data;
  const intel = intelligence.data;
  const vel = velocity.data ?? [];
  const anom = anomalies.data ?? [];
  const attr = attribution.data ?? [];
  const budget = budgetRecs.data ?? [];
  const tests = mvtTests.data ?? [];
  const patterns = viralPatterns.data ?? [];
  const health = channelHealth.data ?? [];
  const queue = contentQueue.data ?? [];
  const blogs = blogPosts.data?.items ?? [];
  const abTestList = abTests.data ?? [];
  const activityLog = activity.data ?? [];
  const gaps = competitorGaps.data;

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Advertising Intelligence</h1>
          <p className="text-gray-400 text-sm mt-1">Autonomous growth system — promoting archibaldtitan.com daily</p>
        </div>
        <div className="flex gap-3">
          {anom.filter((a: any) => a.severity === "critical").length > 0 && (
            <Badge className="bg-red-500/20 text-red-400 border-red-500/30 animate-pulse">
              {anom.filter((a: any) => a.severity === "critical").length} Critical Alerts
            </Badge>
          )}
          <Button
            onClick={() => runCycle.mutate()}
            disabled={runCycle.isPending}
            className="bg-cyan-600 hover:bg-cyan-700 text-white"
          >
            {runCycle.isPending ? "Running..." : "▶ Run Cycle Now"}
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-gray-900 border border-gray-800 mb-6 flex flex-wrap gap-1 h-auto p-1">
          {["overview", "intelligence", "attribution", "budget", "mvt", "health", "queue", "blogs", "abtests", "activity"].map(tab => (
            <TabsTrigger key={tab} value={tab} className="data-[state=active]:bg-cyan-600 data-[state=active]:text-white text-gray-400 capitalize text-xs px-3 py-1.5">
              {tab === "mvt" ? "MVT Tests" : tab === "abtests" ? "A/B Tests" : tab}
              {tab === "queue" && queue.filter((c: any) => c.status === "draft").length > 0 && (
                <span className="ml-1 bg-yellow-500 text-black rounded-full text-xs px-1.5">{queue.filter((c: any) => c.status === "draft").length}</span>
              )}
              {tab === "intelligence" && anom.length > 0 && (
                <span className="ml-1 bg-red-500 text-white rounded-full text-xs px-1.5">{anom.length}</span>
              )}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* ── 1. OVERVIEW ─────────────────────────────────────────────────── */}
        <TabsContent value="overview">
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {[
              { label: "Blog Posts", value: data?.performance?.blogPostsPublished ?? 0, sub: "last 30 days" },
              { label: "Social Posts", value: data?.performance?.socialPostsPublished ?? 0, sub: "last 30 days" },
              { label: "Community Posts", value: data?.performance?.communityEngagements ?? 0, sub: "last 30 days" },
              { label: "Active Channels", value: (channelStatuses.data?.summary?.coreConnected ?? 0) + (channelStatuses.data?.summary?.freeApiConnected ?? 0), sub: `of ${(channelStatuses.data?.summary?.coreTotal ?? 0) + (channelStatuses.data?.summary?.freeApiTotal ?? 0)} total` },
            ].map(kpi => (
              <Card key={kpi.label} className="bg-gray-900 border-gray-800">
                <CardContent className="p-4">
                  <div className="text-2xl font-bold text-cyan-400">{kpi.value}</div>
                  <div className="text-sm font-medium text-white mt-1">{kpi.label}</div>
                  <div className="text-xs text-gray-500">{kpi.sub}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Content Queue Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {Object.entries(data?.contentQueue ?? { draft: 0, approved: 0, published: 0, rejected: 0 }).map(([status, count]) => (
              <Card key={status} className="bg-gray-900 border-gray-800">
                <CardContent className="p-4">
                  <div className="text-xl font-bold text-white">{count as number}</div>
                  <div className="flex items-center gap-2 mt-1">
                    <StatusBadge status={status} />
                    <span className="text-xs text-gray-500">content pieces</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Scheduler Control + Quick Actions */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <Card className="bg-gray-900 border-gray-800">
              <CardHeader><CardTitle className="text-sm text-gray-300">Scheduler Control</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-gray-500">Autonomous advertising runs daily at 9 AM AEST, promoting archibaldtitan.com across all channels.</p>
                <div className="flex gap-3">
                  <Button size="sm" onClick={() => startScheduler.mutate()} className="bg-green-700 hover:bg-green-600 text-white flex-1">
                    Start Scheduler
                  </Button>
                  <Button size="sm" onClick={() => stopScheduler.mutate()} variant="outline" className="border-red-700 text-red-400 hover:bg-red-900/20 flex-1">
                    Stop Scheduler
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gray-900 border-gray-800">
              <CardHeader><CardTitle className="text-sm text-gray-300">Quick Actions</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <Button size="sm" onClick={() => triggerContentCycle.mutate({})} disabled={triggerContentCycle.isPending} className="w-full bg-purple-700 hover:bg-purple-600 text-white">
                  {triggerContentCycle.isPending ? "Generating..." : "⚡ Run Content Cycle"}
                </Button>
                <Button size="sm" onClick={() => autoApprove.mutate({})} disabled={autoApprove.isPending} variant="outline" className="w-full border-gray-700 text-gray-300">
                  {autoApprove.isPending ? "Approving..." : "✓ Auto-Approve High Quality"}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Growth Velocity Summary */}
          {vel.length > 0 && (
            <Card className="bg-gray-900 border-gray-800">
              <CardHeader><CardTitle className="text-sm text-gray-300">Growth Velocity (Week-over-Week)</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {vel.slice(0, 8).map((v: any) => (
                    <div key={v.channel} className="bg-gray-800 rounded-lg p-3">
                      <div className="text-xs text-gray-400 truncate">{v.channel}</div>
                      <div className="mt-1"><TrendArrow delta={v.deltaPercent} /></div>
                      <div className="text-xs text-gray-500 mt-1">{v.thisWeek} this wk / {v.lastWeek} last wk</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── 2. INTELLIGENCE ─────────────────────────────────────────────── */}
        <TabsContent value="intelligence">
          <div className="space-y-6">
            {/* Anomaly Alerts */}
            {anom.length > 0 && (
              <Card className="bg-gray-900 border-red-800/50">
                <CardHeader><CardTitle className="text-sm text-red-400">⚠ Anomaly Alerts</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {anom.map((alert: any, i: number) => (
                      <div key={i} className="bg-gray-800 rounded-lg p-3 border border-gray-700">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-white">{alert.channel}</span>
                          <SeverityBadge severity={alert.severity} />
                        </div>
                        <p className="text-xs text-gray-400 mb-1">{alert.diagnosis}</p>
                        <p className="text-xs text-cyan-400">→ {alert.recommendedAction}</p>
                        <div className="text-xs text-gray-500 mt-1">Drop: {alert.dropPercent.toFixed(1)}% ({alert.currentValue} vs {alert.previousValue} prev)</div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Competitor Gaps */}
            <Card className="bg-gray-900 border-gray-800">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm text-gray-300">Competitor Intelligence</CardTitle>
                  <Button size="sm" variant="outline" onClick={() => competitorGaps.refetch()} className="border-gray-700 text-gray-400 text-xs">
                    Refresh Analysis
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {gaps ? (
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-xs font-semibold text-cyan-400 mb-2">Content Gaps to Own</h4>
                      <div className="flex flex-wrap gap-2">
                        {(gaps.gaps ?? []).map((g: string, i: number) => (
                          <span key={i} className="bg-cyan-900/30 text-cyan-300 text-xs px-2 py-1 rounded-full border border-cyan-800/50">{g}</span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold text-green-400 mb-2">Recommended Topics This Week</h4>
                      <div className="space-y-1">
                        {(gaps.recommendedTopics ?? []).map((t: string, i: number) => (
                          <div key={i} className="flex items-center gap-2 text-xs text-gray-300">
                            <span className="text-green-400">{i + 1}.</span> {t}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold text-yellow-400 mb-2">Competitor Weaknesses to Exploit</h4>
                      <div className="space-y-2">
                        {Object.entries(gaps.competitorWeaknesses ?? {}).map(([comp, weaknesses]: [string, any]) => (
                          <div key={comp} className="bg-gray-800 rounded p-2">
                            <span className="text-xs font-medium text-white">{comp}: </span>
                            <span className="text-xs text-gray-400">{(weaknesses as string[]).join(", ")}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-gray-500 text-sm">Loading competitor analysis...</div>
                )}
              </CardContent>
            </Card>

            {/* Viral Pattern Generator */}
            <Card className="bg-gray-900 border-gray-800">
              <CardHeader><CardTitle className="text-sm text-gray-300">Viral Content Generator</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-gray-400">Platform</Label>
                    <Select value={viralPlatform} onValueChange={setViralPlatform}>
                      <SelectTrigger className="bg-gray-800 border-gray-700 text-white mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-800 border-gray-700">
                        {["x_twitter", "linkedin", "reddit", "hackernews", "tiktok_organic", "discord_community"].map(p => (
                          <SelectItem key={p} value={p} className="text-white">{p}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-400">Topic</Label>
                    <Input
                      value={viralTopic}
                      onChange={e => setViralTopic(e.target.value)}
                      placeholder="e.g. Why local AI beats cloud password managers"
                      className="bg-gray-800 border-gray-700 text-white mt-1 text-xs"
                    />
                  </div>
                </div>
                <Button
                  onClick={() => generateViral.mutate({ platform: viralPlatform, topic: viralTopic })}
                  disabled={!viralTopic || generateViral.isPending}
                  className="bg-purple-700 hover:bg-purple-600 text-white w-full"
                >
                  {generateViral.isPending ? "Generating..." : "Generate Viral Content"}
                </Button>
                {previewContent && (
                  <div className="bg-gray-800 rounded-lg p-4 space-y-2 border border-purple-800/50">
                    <div className="text-xs font-semibold text-purple-400">Generated Content</div>
                    <div className="text-sm font-bold text-white">{previewContent.headline}</div>
                    <div className="text-xs text-gray-300 whitespace-pre-wrap">{previewContent.body}</div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">Viral Score:</span>
                      <span className="text-xs font-bold text-cyan-400">{previewContent.viralScore}/100</span>
                      <span className="text-xs text-gray-500">Pattern: {previewContent.patternUsed}</span>
                    </div>
                  </div>
                )}

                {/* Viral Patterns Reference */}
                <div>
                  <h4 className="text-xs font-semibold text-gray-400 mb-2">Available Viral Patterns</h4>
                  <div className="space-y-2">
                    {patterns.map((p: any) => (
                      <div key={p.id} className="bg-gray-800 rounded p-3 border border-gray-700">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium text-white capitalize">{p.hookType} Hook — {p.platform}</span>
                          <span className="text-xs text-green-400">{p.avgEngagementRate.toFixed(1)}% avg engagement</span>
                        </div>
                        <p className="text-xs text-gray-400 italic">"{p.hookTemplate}"</p>
                        <p className="text-xs text-gray-500 mt-1">Structure: {p.bodyStructure.join(" → ")}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── 3. ATTRIBUTION ──────────────────────────────────────────────── */}
        <TabsContent value="attribution">
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader>
              <CardTitle className="text-sm text-gray-300">Multi-Touch Attribution — Last 30 Days</CardTitle>
              <p className="text-xs text-gray-500">Blended model = average of first-touch, last-touch, linear, and time-decay attribution</p>
            </CardHeader>
            <CardContent>
              {attr.length === 0 ? (
                <div className="text-gray-500 text-sm py-8 text-center">
                  No attribution data yet. Touch points are recorded as users interact with content.
                  <br /><span className="text-xs text-gray-600 mt-2 block">Attribution builds over time as the advertising system runs.</span>
                </div>
              ) : (
                <div className="space-y-4">
                  {attr.map((a: any) => (
                    <div key={a.channel} className="bg-gray-800 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-medium text-white">{a.channel}</span>
                        <span className="text-sm font-bold text-cyan-400">{a.blended.toFixed(1)}% blended</span>
                      </div>
                      <div className="grid grid-cols-4 gap-2 text-xs">
                        {[
                          { label: "First Touch", value: a.firstTouch },
                          { label: "Last Touch", value: a.lastTouch },
                          { label: "Linear", value: a.linear },
                          { label: "Time Decay", value: a.timeDecay },
                        ].map(m => (
                          <div key={m.label} className="bg-gray-700 rounded p-2">
                            <div className="text-gray-400">{m.label}</div>
                            <div className="text-white font-bold mt-1">{m.value.toFixed(1)}%</div>
                          </div>
                        ))}
                      </div>
                      <div className="mt-3">
                        <Progress value={a.blended} className="h-1.5 bg-gray-700" />
                      </div>
                      <div className="text-xs text-gray-500 mt-1">{a.conversions} conversions tracked</div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── 4. BUDGET ───────────────────────────────────────────────────── */}
        <TabsContent value="budget">
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader>
              <CardTitle className="text-sm text-gray-300">ROI-Based Budget Recommendations</CardTitle>
              <p className="text-xs text-gray-500">Allocations are calculated using a modified Kelly Criterion based on actual channel ROI</p>
            </CardHeader>
            <CardContent>
              {budget.length === 0 ? (
                <div className="text-gray-500 text-sm py-8 text-center">Loading budget recommendations...</div>
              ) : (
                <div className="space-y-3">
                  {budget.map((b: any) => (
                    <div key={b.channel} className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-white">{b.channel}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-gray-400">${b.currentBudget.toFixed(0)} → </span>
                          <span className={`text-sm font-bold ${b.recommendedBudget > b.currentBudget ? "text-green-400" : b.recommendedBudget < b.currentBudget ? "text-red-400" : "text-gray-300"}`}>
                            ${b.recommendedBudget.toFixed(0)}
                          </span>
                        </div>
                      </div>
                      <p className="text-xs text-gray-400">{b.reason}</p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                        <span>ROI: <span className="text-cyan-400">{(b.roi * 100).toFixed(0)}%</span></span>
                        <span>Conversions: <span className="text-white">{b.conversions}</span></span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── 5. MVT TESTS ────────────────────────────────────────────────── */}
        <TabsContent value="mvt">
          <div className="space-y-4">
            {/* Create New MVT Test */}
            <Card className="bg-gray-900 border-gray-800">
              <CardHeader><CardTitle className="text-sm text-gray-300">Create Multi-Variate Test</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-gray-400">Channel</Label>
                    <Select value={mvtChannel} onValueChange={setMvtChannel}>
                      <SelectTrigger className="bg-gray-800 border-gray-700 text-white mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-800 border-gray-700">
                        {["x_twitter", "linkedin", "reddit", "hackernews", "tiktok_organic", "blog_content"].map(c => (
                          <SelectItem key={c} value={c} className="text-white">{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-400">Hook Variants (one per line)</Label>
                    <Textarea
                      value={mvtHooks}
                      onChange={e => setMvtHooks(e.target.value)}
                      className="bg-gray-800 border-gray-700 text-white mt-1 text-xs h-20"
                    />
                  </div>
                </div>
                <Button
                  onClick={() => createMVT.mutate({
                    channel: mvtChannel,
                    variables: [{ name: "hook", variants: mvtHooks.split("\n").filter(h => h.trim()) }],
                  })}
                  disabled={createMVT.isPending}
                  className="bg-cyan-700 hover:bg-cyan-600 text-white"
                >
                  Create MVT Test
                </Button>
              </CardContent>
            </Card>

            {/* Active Tests */}
            {tests.length === 0 ? (
              <div className="text-gray-500 text-sm text-center py-8">No MVT tests yet. Create one above.</div>
            ) : (
              tests.map((test: any) => (
                <Card key={test.id} className="bg-gray-900 border-gray-800">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm text-white">{test.channel} — {test.id}</CardTitle>
                      {test.winner ? (
                        <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Winner Found ({test.confidence.toFixed(0)}% confidence)</Badge>
                      ) : (
                        <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">Running ({test.confidence.toFixed(0)}% confidence)</Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {Object.entries(test.results).map(([variant, stats]: [string, any]) => {
                        const rate = stats.alpha / (stats.alpha + stats.beta);
                        const isWinner = test.winner === variant;
                        return (
                          <div key={variant} className={`bg-gray-800 rounded p-3 border ${isWinner ? "border-green-600" : "border-gray-700"}`}>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs text-gray-300 truncate max-w-xs">{variant}</span>
                              <div className="flex items-center gap-2">
                                {isWinner && <span className="text-xs text-green-400 font-bold">WINNER</span>}
                                <span className="text-xs text-cyan-400">{(rate * 100).toFixed(1)}% CVR</span>
                              </div>
                            </div>
                            <Progress value={rate * 100} className="h-1 bg-gray-700" />
                            <div className="text-xs text-gray-500 mt-1">{stats.impressions} impressions, {stats.conversions} conversions</div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        {/* ── 6. CHANNEL HEALTH ───────────────────────────────────────────── */}
        <TabsContent value="health">
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader><CardTitle className="text-sm text-gray-300">Channel Health Matrix</CardTitle></CardHeader>
            <CardContent>
              {health.length === 0 ? (
                <div className="text-gray-500 text-sm text-center py-8">Health data accumulates as channels are used in advertising cycles.</div>
              ) : (
                <div className="space-y-3">
                  {health.map((ch: any) => (
                    <div key={ch.channel} className={`bg-gray-800 rounded-lg p-4 border ${ch.isPaused ? "border-red-800/50" : "border-gray-700"}`}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-white">{ch.channel}</span>
                        <div className="flex items-center gap-2">
                          {ch.isPaused ? (
                            <>
                              <StatusBadge status="paused" />
                              <Button
                                size="sm"
                                onClick={() => resumeChannel.mutate({ channel: ch.channel })}
                                className="bg-green-700 hover:bg-green-600 text-white text-xs h-6 px-2"
                              >
                                Resume
                              </Button>
                            </>
                          ) : (
                            <StatusBadge status="active" />
                          )}
                        </div>
                      </div>
                      {ch.pausedReason && (
                        <p className="text-xs text-red-400 mb-2">{ch.pausedReason}</p>
                      )}
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div>
                          <span className="text-gray-500">Success Rate</span>
                          <div className="text-white font-bold">{(ch.successRate * 100).toFixed(0)}%</div>
                          <Progress value={ch.successRate * 100} className="h-1 bg-gray-700 mt-1" />
                        </div>
                        <div>
                          <span className="text-gray-500">Consecutive Fails</span>
                          <div className={`font-bold ${ch.consecutiveFailures >= 3 ? "text-red-400" : ch.consecutiveFailures > 0 ? "text-yellow-400" : "text-green-400"}`}>
                            {ch.consecutiveFailures}
                          </div>
                        </div>
                        <div>
                          <span className="text-gray-500">Avg Latency</span>
                          <div className="text-white font-bold">{ch.avgLatencyMs > 0 ? `${ch.avgLatencyMs}ms` : "—"}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── 7. CONTENT QUEUE ────────────────────────────────────────────── */}
        <TabsContent value="queue">
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="text-sm text-gray-300 font-medium">{queue.length} content pieces</h3>
              <Button size="sm" onClick={() => autoApprove.mutate({})} variant="outline" className="border-gray-700 text-gray-300 text-xs">
                Auto-Approve High Quality
              </Button>
            </div>
            {queue.map((item: any) => (
              <Card key={item.id} className="bg-gray-900 border-gray-800">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <StatusBadge status={item.status} />
                        <span className="text-xs text-gray-500">{item.channel}</span>
                        {item.qualityScore && <span className="text-xs text-cyan-400">Q:{item.qualityScore}/100</span>}
                      </div>
                      <p className="text-sm text-white font-medium truncate">{item.headline || item.title || "Untitled"}</p>
                      <p className="text-xs text-gray-400 mt-1 line-clamp-2">{item.body || item.content}</p>
                    </div>
                    {item.status === "draft" && (
                      <div className="flex gap-2 shrink-0">
                        <Button size="sm" onClick={() => updateStatus.mutate({ id: item.id, status: "approved" })} className="bg-green-700 hover:bg-green-600 text-white text-xs h-7 px-2">
                          Approve
                        </Button>
                        <Button size="sm" onClick={() => updateStatus.mutate({ id: item.id, status: "failed" })} variant="outline" className="border-red-700 text-red-400 text-xs h-7 px-2">
                          Reject
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* ── 8. BLOG POSTS ───────────────────────────────────────────────── */}
        <TabsContent value="blogs">
          <div className="space-y-3">
            {blogs.map((post: any) => (
              <Card key={post.id} className="bg-gray-900 border-gray-800">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <StatusBadge status={post.status} />
                        <span className="text-xs text-gray-500">{post.category}</span>
                        {post.seoScore && <span className="text-xs text-green-400">SEO:{post.seoScore}/100</span>}
                        {post.aiGenerated && <span className="text-xs text-purple-400">AI</span>}
                      </div>
                      <p className="text-sm text-white font-medium">{post.title}</p>
                      <p className="text-xs text-gray-400 mt-1 line-clamp-2">{post.excerpt}</p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                        <span>/{post.slug}</span>
                        <span>{post.readingTimeMinutes} min read</span>
                        <span>{new Date(post.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* ── 9. A/B TESTS ────────────────────────────────────────────────── */}
        <TabsContent value="abtests">
          <div className="space-y-4">
            <Card className="bg-gray-900 border-gray-800">
              <CardHeader><CardTitle className="text-sm text-gray-300">Create A/B Test</CardTitle></CardHeader>
              <CardContent>
                <ABTestCreator onSubmit={(data) => createABTest.mutate(data)} isPending={createABTest.isPending} />
              </CardContent>
            </Card>
            {abTestList.map((test: any) => (
              <Card key={test.id} className="bg-gray-900 border-gray-800">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <span className="text-sm font-medium text-white">{test.channel}</span>
                      <span className="text-xs text-gray-500 ml-2">{test.id}</span>
                    </div>
                    {test.winner ? (
                      <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Winner: {test.winner}</Badge>
                    ) : (
                      <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">Running</Badge>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {["A", "B"].map(variant => {
                      const stats = test.results?.[variant];
                      const rate = stats ? (stats.conversions / Math.max(stats.impressions, 1)) * 100 : 0;
                      return (
                        <div key={variant} className={`bg-gray-800 rounded p-3 border ${test.winner === variant ? "border-green-600" : "border-gray-700"}`}>
                          <div className="text-xs font-bold text-white mb-1">Variant {variant}</div>
                          <div className="text-xs text-gray-400 mb-2">{test[`variant${variant}Desc`]}</div>
                          <div className="text-xs text-cyan-400">{rate.toFixed(1)}% CVR</div>
                          <div className="text-xs text-gray-500">{stats?.impressions ?? 0} impressions</div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* ── 10. ACTIVITY LOG ────────────────────────────────────────────── */}
        <TabsContent value="activity">
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader><CardTitle className="text-sm text-gray-300">Activity Log</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {activityLog.map((log: any) => (
                  <div key={log.id} className="flex items-start gap-3 py-2 border-b border-gray-800">
                    <StatusBadge status={log.status} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400">{log.channel}</span>
                        <span className="text-xs text-gray-600">·</span>
                        <span className="text-xs text-gray-500">{log.action}</span>
                      </div>
                      {log.details && (
                        <p className="text-xs text-gray-300 mt-0.5 truncate">
                          {typeof log.details === "string" ? log.details : JSON.stringify(log.details).substring(0, 120)}
                        </p>
                      )}
                    </div>
                    <span className="text-xs text-gray-600 shrink-0">{new Date(log.createdAt).toLocaleTimeString()}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── A/B Test Creator Sub-Component ──────────────────────────────────────────

function ABTestCreator({ onSubmit, isPending }: { onSubmit: (data: any) => void; isPending: boolean }) {
  const [channel, setChannel] = useState("x_twitter");
  const [variantA, setVariantA] = useState("");
  const [variantB, setVariantB] = useState("");

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-3">
        <div>
          <Label className="text-xs text-gray-400">Channel</Label>
          <Select value={channel} onValueChange={setChannel}>
            <SelectTrigger className="bg-gray-800 border-gray-700 text-white mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-gray-800 border-gray-700">
              {["x_twitter", "linkedin", "reddit", "hackernews", "tiktok_organic", "blog_content"].map(c => (
                <SelectItem key={c} value={c} className="text-white">{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs text-gray-400">Variant A Description</Label>
          <Input value={variantA} onChange={e => setVariantA(e.target.value)} className="bg-gray-800 border-gray-700 text-white mt-1 text-xs" placeholder="e.g. Question hook" />
        </div>
        <div>
          <Label className="text-xs text-gray-400">Variant B Description</Label>
          <Input value={variantB} onChange={e => setVariantB(e.target.value)} className="bg-gray-800 border-gray-700 text-white mt-1 text-xs" placeholder="e.g. Statistic hook" />
        </div>
      </div>
      <Button
        onClick={() => onSubmit({ channel, variantADesc: variantA, variantBDesc: variantB })}
        disabled={isPending || !variantA || !variantB}
        className="bg-cyan-700 hover:bg-cyan-600 text-white"
        size="sm"
      >
        Create A/B Test
      </Button>
    </div>
  );
}
