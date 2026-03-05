import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Megaphone,
  DollarSign,
  TrendingUp,
  Zap,
  Play,
  BarChart3,
  Target,
  Eye,
  MousePointerClick,
  Users,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  Globe,
  Clock,
  FileText,
  Mail,
  Link2,
  MessageSquare,
  Rss,
  Search,
  PenTool,
  Video,
  Image,
  Send,
  Music,
  Smartphone,
  Monitor,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  X,
} from "lucide-react";
import { toast } from "sonner";

// Channel display config
const CHANNEL_ICONS: Record<string, { icon: typeof Globe; label: string; color: string }> = {
  seo_organic: { icon: Search, label: "SEO Organic", color: "text-green-500" },
  blog_content: { icon: FileText, label: "Blog Content", color: "text-blue-500" },
  social_organic: { icon: Rss, label: "Social Media", color: "text-purple-500" },
  community_engagement: { icon: MessageSquare, label: "Community", color: "text-orange-500" },
  affiliate_network: { icon: Link2, label: "Affiliates", color: "text-cyan-500" },
  email_nurture: { icon: Mail, label: "Email Nurture", color: "text-yellow-500" },
  google_ads: { icon: Target, label: "Google Ads", color: "text-red-500" },
  product_hunt: { icon: Zap, label: "Product Hunt", color: "text-amber-500" },
  github_presence: { icon: Globe, label: "GitHub", color: "text-gray-500" },
  backlink_outreach: { icon: Link2, label: "Backlinks", color: "text-indigo-500" },
  forum_participation: { icon: MessageSquare, label: "Forums", color: "text-teal-500" },
};

function ImpactBadge({ impact }: { impact: string }) {
  const colors: Record<string, string> = {
    high: "bg-green-500/10 text-green-500 border-green-500/20",
    medium: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
    low: "bg-gray-500/10 text-gray-400 border-gray-500/20",
  };
  return (
    <Badge variant="outline" className={colors[impact] || colors.low}>
      {impact}
    </Badge>
  );
}

function StatusIcon({ status }: { status: string }) {
  if (status === "success") return <CheckCircle2 className="w-4 h-4 text-green-500" />;
  if (status === "failed") return <XCircle className="w-4 h-4 text-red-500" />;
  if (status === "partial") return <AlertCircle className="w-4 h-4 text-yellow-500" />;
  return <Clock className="w-4 h-4 text-gray-400" />;
}

export default function AdvertisingDashboard() {
  const [isRunning, setIsRunning] = useState(false);

  const dashboard = trpc.advertising.getDashboard.useQuery();
  const strategies = trpc.advertising.getStrategies.useQuery();
  const budget = trpc.advertising.getBudgetBreakdown.useQuery();
  const contentQueue = trpc.advertising.getContentQueue.useQuery({ limit: 20 });
  const channelStatuses = trpc.advertising.getChannelStatuses.useQuery();
  const runCycle = trpc.advertising.runCycle.useMutation({
    onSuccess: (result) => {
      setIsRunning(false);
      const successCount = result.actions.filter((a: any) => a.status === "success").length;
      toast.success(`Advertising cycle complete: ${successCount}/${result.actions.length} actions succeeded`);
      dashboard.refetch();
      contentQueue.refetch();
    },
    onError: (err) => {
      setIsRunning(false);
      toast.error(`Cycle failed: ${err.message}`);
    },
  });

  const updateContent = trpc.advertising.updateContentStatus.useMutation({
    onSuccess: () => {
      toast.success("Content status updated");
      contentQueue.refetch();
    },
  });

  const handleRunCycle = () => {
    setIsRunning(true);
    runCycle.mutate();
  };

  const data = dashboard.data;
  const perf = data?.performance;
  const strat = data?.strategy;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Megaphone className="w-6 h-6 text-primary" />
            Autonomous Advertising
          </h1>
          <p className="text-muted-foreground mt-1">
            AI-powered growth engine — 80% free organic, 20% paid amplification
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="text-sm py-1 px-3">
            <DollarSign className="w-3.5 h-3.5 mr-1" />
            ${strat?.monthlyBudget || 500} AUD/mo
          </Badge>
          <Button onClick={handleRunCycle} disabled={isRunning} size="sm">
            {isRunning ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Running...</>
            ) : (
              <><Play className="w-4 h-4 mr-2" /> Run Cycle Now</>
            )}
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <FileText className="w-4 h-4" /> Blog Posts (30d)
            </div>
            <div className="text-2xl font-bold mt-1">
              {perf?.organic?.blogPostsPublished ?? "—"}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <PenTool className="w-4 h-4" /> Content Created
            </div>
            <div className="text-2xl font-bold mt-1">
              {perf?.organic?.contentPiecesCreated ?? "—"}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <MousePointerClick className="w-4 h-4" /> Affiliate Clicks
            </div>
            <div className="text-2xl font-bold mt-1">
              {perf?.organic?.affiliateClicks ?? "—"}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <DollarSign className="w-4 h-4" /> Budget Used
            </div>
            <div className="text-2xl font-bold mt-1">
              {perf?.budgetUtilization ? `${perf.budgetUtilization.utilizationPercent}%` : "—"}
            </div>
            <div className="text-xs text-muted-foreground">
              ${perf?.budgetUtilization?.spent ?? 0} / ${perf?.budgetUtilization?.monthlyBudget ?? 500}
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="channels">Channels</TabsTrigger>
          <TabsTrigger value="strategies">Growth Strategies</TabsTrigger>
          <TabsTrigger value="content">Content Queue</TabsTrigger>
          <TabsTrigger value="budget">Budget</TabsTrigger>
          <TabsTrigger value="activity">Activity Log</TabsTrigger>
          <TabsTrigger value="tiktok">TikTok</TabsTrigger>
          <TabsTrigger value="preview">Ad Preview</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          {/* Schedule */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="w-5 h-5" /> Autonomous Schedule
              </CardTitle>
              <CardDescription>
                What the advertising engine does automatically each day
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                {strat?.schedule && Object.entries(strat.schedule).map(([key, value]) => (
                  <div key={key} className="flex items-start gap-2 p-3 rounded-lg bg-muted/50">
                    <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                    <div>
                      <div className="text-sm font-medium capitalize">
                        {key.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase())}
                      </div>
                      <div className="text-xs text-muted-foreground">{value as string}</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Content Pillars */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Target className="w-5 h-5" /> Content Pillars
              </CardTitle>
              <CardDescription>
                SEO-optimized content topics driving organic traffic
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {strat?.contentPillars?.map((pillar: any) => (
                  <div key={pillar.name} className="p-3 rounded-lg border">
                    <div className="font-medium text-sm">{pillar.name}</div>
                    <div className="flex gap-2 mt-2">
                      <Badge variant="secondary" className="text-xs">
                        {pillar.keywordCount} keywords
                      </Badge>
                      <Badge variant="secondary" className="text-xs">
                        {pillar.blogTopicCount} blog topics
                      </Badge>
                      <Badge variant="secondary" className="text-xs">
                        {pillar.socialAngleCount} social angles
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Paid Performance */}
          {perf?.paid && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <BarChart3 className="w-5 h-5" /> Paid Campaign Performance (30d)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <div className="text-sm text-muted-foreground">Impressions</div>
                    <div className="text-xl font-bold">{perf.paid.totalImpressions.toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Clicks</div>
                    <div className="text-xl font-bold">{perf.paid.totalClicks.toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">CTR</div>
                    <div className="text-xl font-bold">{perf.paid.ctr}%</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">CPC</div>
                    <div className="text-xl font-bold">${perf.paid.cpc}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Strategies Tab */}
        <TabsContent value="strategies" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Growth Strategy Matrix</CardTitle>
              <CardDescription>
                All channels ranked by expected impact — {strategies.data?.filter((s: any) => s.costPerMonth === 0).length || 0} free, {strategies.data?.filter((s: any) => s.costPerMonth > 0).length || 0} paid
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {strategies.data?.map((strategy: any) => {
                  const channelInfo = CHANNEL_ICONS[strategy.channel] || { icon: Globe, label: strategy.channel, color: "text-gray-500" };
                  const IconComp = channelInfo.icon;
                  return (
                    <div key={strategy.channel} className="flex items-start gap-4 p-4 rounded-lg border">
                      <div className={`mt-0.5 ${channelInfo.color}`}>
                        <IconComp className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{channelInfo.label}</span>
                          <ImpactBadge impact={strategy.expectedImpact} />
                          {strategy.costPerMonth === 0 ? (
                            <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">FREE</Badge>
                          ) : (
                            <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/20">
                              ${strategy.costPerMonth}/mo
                            </Badge>
                          )}
                          {strategy.automatable && (
                            <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/20">
                              <Zap className="w-3 h-3 mr-1" /> Auto
                            </Badge>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground mt-1">{strategy.description}</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          <Clock className="w-3 h-3 inline mr-1" /> {strategy.frequency}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Content Queue Tab */}
        <TabsContent value="content" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <PenTool className="w-5 h-5" /> Content Queue
              </CardTitle>
              <CardDescription>
                AI-generated content awaiting review — {data?.contentQueue?.draft || 0} drafts, {data?.contentQueue?.approved || 0} approved
              </CardDescription>
            </CardHeader>
            <CardContent>
              {contentQueue.data?.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <PenTool className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>No content in queue. Run a cycle to generate content.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {contentQueue.data?.map((item: any) => (
                    <div key={item.id} className="flex items-start gap-3 p-3 rounded-lg border">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-xs capitalize">
                            {item.platform}
                          </Badge>
                          <Badge variant="outline" className="text-xs capitalize">
                            {item.contentType?.replace(/_/g, " ")}
                          </Badge>
                          <Badge
                            variant="outline"
                            className={
                              item.status === "published"
                                ? "bg-green-500/10 text-green-500"
                                : item.status === "approved"
                                ? "bg-blue-500/10 text-blue-500"
                                : item.status === "rejected"
                                ? "bg-red-500/10 text-red-500"
                                : "bg-yellow-500/10 text-yellow-500"
                            }
                          >
                            {item.status}
                          </Badge>
                        </div>
                        <div className="font-medium text-sm mt-1">{item.headline}</div>
                        <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {item.body?.substring(0, 200)}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {new Date(item.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                      {item.status === "draft" && (
                        <div className="flex gap-1 shrink-0">
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-green-500 hover:text-green-600"
                            onClick={() => updateContent.mutate({ id: item.id, status: "approved" })}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-red-500 hover:text-red-600"
                            onClick={() => updateContent.mutate({ id: item.id, status: "failed" })}
                          >
                            <XCircle className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Budget Tab */}
        <TabsContent value="budget" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <DollarSign className="w-5 h-5" /> Budget Allocation
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-3 rounded-lg bg-red-500/10">
                    <div className="flex items-center gap-2">
                      <Target className="w-5 h-5 text-red-500" />
                      <span className="font-medium">Google Ads</span>
                    </div>
                    <span className="font-bold text-red-500">
                      ${budget.data?.allocation?.googleAds || 500} AUD/mo
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-3 rounded-lg bg-green-500/10">
                    <div className="flex items-center gap-2">
                      <Globe className="w-5 h-5 text-green-500" />
                      <span className="font-medium">Free Channels ({budget.data?.freeChannels || 10})</span>
                    </div>
                    <span className="font-bold text-green-500">$0 AUD/mo</span>
                  </div>
                  <div className="border-t pt-3 flex justify-between items-center">
                    <span className="font-medium">Total Monthly</span>
                    <span className="font-bold text-lg">${budget.data?.monthlyBudget || 500} AUD</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" /> Channel Cost Breakdown
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {budget.data?.costBreakdown?.map((item: any) => {
                    const channelInfo = CHANNEL_ICONS[item.channel] || { icon: Globe, label: item.channel, color: "text-gray-500" };
                    return (
                      <div key={item.channel} className="flex items-center justify-between text-sm py-1">
                        <div className="flex items-center gap-2">
                          <span className={channelInfo.color}>●</span>
                          <span>{channelInfo.label}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <ImpactBadge impact={item.impact} />
                          <span className={item.costPerMonth === 0 ? "text-green-500 font-medium" : "text-red-500 font-medium"}>
                            {item.costPerMonth === 0 ? "FREE" : `$${item.costPerMonth}`}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Channels Tab */}
        <TabsContent value="channels" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground">API-Automated Free Channels</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-500">
                  {channelStatuses.data?.summary.freeApiConnected ?? 0}
                  <span className="text-lg text-muted-foreground"> / {channelStatuses.data?.summary.freeApiTotal ?? 0}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Connected and posting automatically</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground">Content Queue Channels</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-blue-500">
                  {channelStatuses.data?.summary.contentQueueTotal ?? 0}
                </div>
                <p className="text-xs text-muted-foreground mt-1">AI generates content every cycle for manual posting</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground">Core Platform Channels</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {channelStatuses.data?.summary.coreConnected ?? 0}
                  <span className="text-lg text-muted-foreground"> / {channelStatuses.data?.summary.coreTotal ?? 0}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Social + paid platforms connected</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Globe className="w-5 h-5 text-green-500" /> Free API-Automated Channels
              </CardTitle>
              <CardDescription>These channels post automatically every advertising cycle — no manual action needed. Add a token to activate any disconnected channel.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {channelStatuses.data?.freeApiChannels?.map((ch: any) => (
                  <div key={ch.id} className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="flex items-center gap-3">
                      <span className={`w-2 h-2 rounded-full ${ch.connected ? 'bg-green-500' : 'bg-gray-400'}`} />
                      <div>
                        <div className="font-medium text-sm">{ch.name}</div>
                        <div className="text-xs text-muted-foreground">{ch.description}</div>
                      </div>
                    </div>
                    <Badge variant={ch.connected ? 'default' : 'secondary'} className={ch.connected ? 'bg-green-500/20 text-green-400 border-green-500/30' : ''}>
                      {ch.connected ? 'Active' : 'Add Token'}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-500" /> Content Queue Channels
              </CardTitle>
              <CardDescription>AI generates ready-to-post content for these channels every cycle. Content appears in the Content Queue tab for you to copy and post.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {channelStatuses.data?.contentQueueChannels?.map((ch: any) => (
                  <div key={ch.id} className="flex items-center gap-2 p-2 rounded-lg border text-sm">
                    <span className="w-2 h-2 rounded-full bg-blue-500" />
                    <div>
                      <div className="font-medium">{ch.name}</div>
                      <div className="text-xs text-muted-foreground truncate max-w-[200px]">{ch.description}</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Activity Log Tab */}
        <TabsContent value="activity" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Eye className="w-5 h-5" /> Activity Log
                  </CardTitle>
                  <CardDescription>Recent autonomous advertising actions</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={() => dashboard.refetch()}>
                  <RefreshCw className="w-4 h-4 mr-2" /> Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {data?.recentActivity?.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>No activity yet. The advertising engine runs automatically once daily.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {data?.recentActivity?.map((activity: any, i: number) => (
                    <div key={i} className="flex items-start gap-3 p-3 rounded-lg border">
                      <StatusIcon status={activity.status} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm capitalize">
                            {activity.action?.replace(/_/g, " ")}
                          </span>
                          <Badge variant="secondary" className="text-xs">
                            {activity.channel}
                          </Badge>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {activity.details ? (
                            typeof activity.details === "string"
                              ? activity.details.substring(0, 200)
                              : JSON.stringify(activity.details).substring(0, 200)
                          ) : "No details"}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {new Date(activity.createdAt).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TikTok Content Tab */}
        <TabsContent value="tiktok" className="space-y-4">
          <TikTokContentTab />
        </TabsContent>

        {/* Ad Preview Tab */}
        <TabsContent value="preview" className="space-y-4">
          <AdPreviewTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ============================================
// TIKTOK CONTENT TAB
// ============================================

function TikTokContentTab() {
  const [isGenerating, setIsGenerating] = useState(false);
  const tiktokStats = trpc.advertising.getTikTokStats.useQuery();
  const triggerPost = trpc.advertising.triggerTikTokPost.useMutation({
    onSuccess: (result) => {
      setIsGenerating(false);
      if (result.success) {
        toast.success(result.details);
      } else {
        toast.error(result.details);
      }
      tiktokStats.refetch();
    },
    onError: (err) => {
      setIsGenerating(false);
      toast.error(`TikTok post failed: ${err.message}`);
    },
  });

  const stats = tiktokStats.data;

  return (
    <div className="space-y-4">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Video className="w-5 h-5 text-pink-500" />
              <div>
                <div className="text-2xl font-bold">{stats?.totalPosts ?? 0}</div>
                <div className="text-xs text-muted-foreground">Total Posts</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-500" />
              <div>
                <div className="text-2xl font-bold">{stats?.publishedPosts ?? 0}</div>
                <div className="text-xs text-muted-foreground">Published</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Image className="w-5 h-5 text-blue-500" />
              <div>
                <div className="text-2xl font-bold">{stats?.approvedPosts ?? 0}</div>
                <div className="text-xs text-muted-foreground">Ready to Post</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-yellow-500" />
              <div>
                <div className="text-2xl font-bold">{stats?.draftPosts ?? 0}</div>
                <div className="text-xs text-muted-foreground">Drafts</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Connection Status + Generate Button */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Music className="w-5 h-5 text-pink-500" /> TikTok Content Engine
              </CardTitle>
              <CardDescription>
                Auto-generates photo carousels from blog posts using AI-generated cyberpunk infographics
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={stats?.configured ? "default" : "secondary"} className={stats?.configured ? "bg-green-500/10 text-green-500 border-green-500/20" : ""}>
                {stats?.configured ? "API Connected" : "Content-Only Mode"}
              </Badge>
              <Button
                onClick={() => {
                  setIsGenerating(true);
                  triggerPost.mutate();
                }}
                disabled={isGenerating}
                size="sm"
              >
                {isGenerating ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating...</>
                ) : (
                  <><Send className="w-4 h-4 mr-2" /> Generate Post</>
                )}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {stats?.creatorInfo ? (
            <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
              {stats.creatorInfo.creatorAvatarUrl && (
                <img loading="lazy" src={stats.creatorInfo.creatorAvatarUrl} alt="" className="w-10 h-10 rounded-full" />
              )}
              <div>
                <div className="font-medium">{stats.creatorInfo.creatorNickname || "Connected Account"}</div>
                <div className="text-xs text-muted-foreground">
                  Privacy options: {stats.creatorInfo.privacyLevelOptions?.join(", ") || "N/A"}
                  {stats.creatorInfo.maxVideoPostDurationSec && ` • Max video: ${stats.creatorInfo.maxVideoPostDurationSec}s`}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground p-3 rounded-lg border border-dashed">
              <p className="font-medium mb-1">TikTok Content Posting API not connected</p>
              <p>Content will be generated and saved as ready-to-post drafts. To enable direct posting, configure your TikTok Developer App credentials in Settings.</p>
              <p className="mt-2 text-xs">Required: <code>TIKTOK_CREATOR_TOKEN</code> or <code>TIKTOK_ACCESS_TOKEN</code></p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Posts */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Recent TikTok Content</CardTitle>
              <CardDescription>Auto-generated content from blog posts</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => tiktokStats.refetch()}>
              <RefreshCw className="w-4 h-4 mr-2" /> Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {!stats?.recentPosts?.length ? (
            <div className="text-center py-8 text-muted-foreground">
              <Video className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No TikTok content generated yet.</p>
              <p className="text-xs mt-1">Content is auto-generated on Tue/Thu/Sat, or click "Generate Post" above.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {stats.recentPosts.map((post: any, i: number) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-lg border">
                  <div className="flex-shrink-0 mt-1">
                    {post.status === "published" ? (
                      <CheckCircle2 className="w-5 h-5 text-green-500" />
                    ) : post.status === "approved" ? (
                      <Image className="w-5 h-5 text-blue-500" />
                    ) : (
                      <FileText className="w-5 h-5 text-yellow-500" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{post.title}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-xs capitalize">{post.status}</Badge>
                      {post.imageCount > 0 && (
                        <span className="text-xs text-muted-foreground">{post.imageCount} slides</span>
                      )}
                      {post.publishedAt && (
                        <span className="text-xs text-muted-foreground">
                          {new Date(post.publishedAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* How It Works */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">How TikTok Content Engine Works</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-4 gap-4">
            <div className="text-center p-4 rounded-lg border">
              <FileText className="w-8 h-8 mx-auto mb-2 text-blue-500" />
              <div className="font-medium text-sm">1. Pick Blog Post</div>
              <div className="text-xs text-muted-foreground mt-1">Selects an unpromoted blog post from the content library</div>
            </div>
            <div className="text-center p-4 rounded-lg border">
              <PenTool className="w-8 h-8 mx-auto mb-2 text-purple-500" />
              <div className="font-medium text-sm">2. AI Content Plan</div>
              <div className="text-xs text-muted-foreground mt-1">LLM generates hook, caption, hashtags, and image prompts</div>
            </div>
            <div className="text-center p-4 rounded-lg border">
              <Image className="w-8 h-8 mx-auto mb-2 text-pink-500" />
              <div className="font-medium text-sm">3. Generate Images</div>
              <div className="text-xs text-muted-foreground mt-1">AI creates cyberpunk-style carousel slides (3 images)</div>
            </div>
            <div className="text-center p-4 rounded-lg border">
              <Send className="w-8 h-8 mx-auto mb-2 text-green-500" />
              <div className="font-medium text-sm">4. Post to TikTok</div>
              <div className="text-xs text-muted-foreground mt-1">Direct post via Content Posting API (or save as draft)</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================
// AD PREVIEW TAB
// ============================================

// Platform display configuration for preview rendering
const PLATFORM_CONFIG: Record<string, {
  label: string;
  color: string;
  bgColor: string;
  maxChars?: number;
  aspectRatio?: string;
}> = {
  x_twitter: { label: "X / Twitter", color: "text-sky-400", bgColor: "bg-black", maxChars: 280 },
  linkedin: { label: "LinkedIn", color: "text-blue-600", bgColor: "bg-white", maxChars: 3000 },
  meta: { label: "Meta (Facebook/Instagram)", color: "text-blue-500", bgColor: "bg-white" },
  reddit: { label: "Reddit", color: "text-orange-500", bgColor: "bg-zinc-900" },
  tiktok: { label: "TikTok", color: "text-pink-500", bgColor: "bg-black", aspectRatio: "9:16" },
  youtube: { label: "YouTube", color: "text-red-500", bgColor: "bg-zinc-900" },
  google_ads: { label: "Google Ads", color: "text-green-600", bgColor: "bg-white" },
  snapchat: { label: "Snapchat", color: "text-yellow-400", bgColor: "bg-black" },
  pinterest: { label: "Pinterest", color: "text-red-600", bgColor: "bg-white" },
  discord: { label: "Discord", color: "text-indigo-400", bgColor: "bg-[#36393f]" },
  mastodon: { label: "Mastodon", color: "text-purple-500", bgColor: "bg-[#282c37]" },
  telegram: { label: "Telegram", color: "text-blue-400", bgColor: "bg-[#17212b]" },
  devto: { label: "DEV.to", color: "text-gray-200", bgColor: "bg-[#0a0a0a]" },
  medium: { label: "Medium", color: "text-green-600", bgColor: "bg-white" },
  hashnode: { label: "Hashnode", color: "text-blue-500", bgColor: "bg-white" },
  content_seo: { label: "Blog / SEO", color: "text-emerald-500", bgColor: "bg-white" },
  email_outreach: { label: "Email", color: "text-amber-500", bgColor: "bg-white" },
  sendgrid: { label: "Email (SendGrid)", color: "text-blue-400", bgColor: "bg-white" },
  hacker_forum: { label: "Hacker Forum", color: "text-lime-400", bgColor: "bg-zinc-900" },
};

const CONTENT_TYPE_LABELS: Record<string, string> = {
  social_post: "Social Post",
  ad_copy: "Ad Copy",
  blog_article: "Blog Article",
  email: "Email",
  image_ad: "Image Ad",
  video_script: "Video Script",
  backlink_outreach: "Outreach Email",
  email_nurture: "Nurture Email",
  community_engagement: "Community Post",
  hacker_forum_post: "Forum Post",
  content_queue: "Queued Content",
};

/** Detect if a URL points to a video file */
function isVideoUrl(url: string): boolean {
  if (!url) return false;
  const lower = url.toLowerCase();
  return lower.endsWith(".mp4") || lower.endsWith(".webm") || lower.endsWith(".mov")
    || lower.endsWith(".avi") || lower.endsWith(".mkv") || lower.includes("/video")
    || lower.includes("video_gen") || lower.includes("pollinations.ai/video");
}

/** Detect if a URL points to an image file */
function isImageUrl(url: string): boolean {
  if (!url) return false;
  const lower = url.toLowerCase();
  return lower.endsWith(".png") || lower.endsWith(".jpg") || lower.endsWith(".jpeg")
    || lower.endsWith(".gif") || lower.endsWith(".webp") || lower.endsWith(".svg")
    || lower.includes("/image") || lower.includes("pollinations.ai") || lower.includes("s3.amazonaws.com");
}

/** Extract all media URLs from a content item (mediaUrl, metadata.imageUrls, body if URL) */
function extractMediaUrls(item: any): { images: string[]; videos: string[] } {
  const images: string[] = [];
  const videos: string[] = [];

  // Primary mediaUrl
  if (item.mediaUrl) {
    if (isVideoUrl(item.mediaUrl)) {
      videos.push(item.mediaUrl);
    } else if (isImageUrl(item.mediaUrl)) {
      images.push(item.mediaUrl);
    }
  }

  // Metadata imageUrls (TikTok carousel, etc.)
  if (item.metadata?.imageUrls && Array.isArray(item.metadata.imageUrls)) {
    for (const url of item.metadata.imageUrls) {
      if (typeof url === "string" && url.startsWith("http")) {
        if (isVideoUrl(url)) videos.push(url);
        else images.push(url);
      }
    }
  }

  // Body might be a direct URL (video content stores URL in body)
  if (item.body && item.body.startsWith("http") && item.body.length < 500) {
    const bodyUrl = item.body.trim();
    if (isVideoUrl(bodyUrl) && !videos.includes(bodyUrl)) {
      videos.push(bodyUrl);
    } else if (isImageUrl(bodyUrl) && !images.includes(bodyUrl)) {
      images.push(bodyUrl);
    }
  }

  // Metadata may also have video URLs
  if (item.metadata?.videoUrl) {
    videos.push(item.metadata.videoUrl);
  }
  if (item.metadata?.publishResult?.videoUrl) {
    videos.push(item.metadata.publishResult.videoUrl);
  }

  return { images, videos };
}

/** Platform-specific post preview mockup */
function PlatformPreview({ item, viewMode }: { item: any; viewMode: "desktop" | "mobile" }) {
  const platform = item.channel || item.platform || "content_seo";
  const config = PLATFORM_CONFIG[platform] || PLATFORM_CONFIG.content_seo;
  const { images, videos } = extractMediaUrls(item);
  const hashtags: string[] = item.hashtags || item.metadata?.plan?.hashtags || [];
  const isMobileView = viewMode === "mobile";

  return (
    <div className={`rounded-xl border overflow-hidden ${isMobileView ? "max-w-[375px] mx-auto" : "w-full"}`}>
      {/* Platform Header Bar */}
      <div className={`flex items-center gap-2 px-4 py-2.5 border-b ${config.bgColor === "bg-white" ? "bg-gray-50" : config.bgColor}`}>
        <div className={`w-2 h-2 rounded-full ${config.color.replace("text-", "bg-")}`} />
        <span className={`text-sm font-semibold ${config.bgColor === "bg-white" || config.bgColor === "bg-gray-50" ? "text-gray-800" : "text-white"}`}>
          {config.label}
        </span>
        <Badge variant="outline" className="ml-auto text-xs">
          {CONTENT_TYPE_LABELS[item.contentType] || item.contentType}
        </Badge>
      </div>

      {/* Post Content Area */}
      <div className={`${config.bgColor === "bg-white" ? "bg-white" : "bg-zinc-950"} p-0`}>
        {/* Author / Profile Mock */}
        <div className="flex items-center gap-3 px-4 pt-4 pb-2">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm ${config.color.replace("text-", "bg-")}`}>
            AT
          </div>
          <div>
            <div className={`font-semibold text-sm ${config.bgColor === "bg-white" ? "text-gray-900" : "text-white"}`}>
              Archibald Titan
            </div>
            <div className="text-xs text-muted-foreground">
              @archibaldtitan · {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : "Draft"}
            </div>
          </div>
        </div>

        {/* Headline */}
        {(item.headline || item.title) && (
          <div className={`px-4 pb-1 font-semibold ${config.bgColor === "bg-white" ? "text-gray-900" : "text-white"} ${platform === "blog_article" || item.contentType === "blog_article" ? "text-xl" : "text-sm"}`}>
            {item.headline || item.title}
          </div>
        )}

        {/* Body Text */}
        <div className={`px-4 py-2 text-sm whitespace-pre-wrap break-words ${config.bgColor === "bg-white" ? "text-gray-700" : "text-gray-200"}`}>
          {(() => {
            const body = item.body || "";
            // Don't render body if it's just a URL (already handled as media)
            if (body.startsWith("http") && body.length < 500) return null;
            // Try to parse JSON body (email nurture stores JSON)
            try {
              const parsed = JSON.parse(body);
              if (parsed.subject && parsed.body) {
                return (
                  <div className="space-y-2">
                    <div className="font-semibold">Subject: {parsed.subject}</div>
                    <div>{parsed.body}</div>
                  </div>
                );
              }
            } catch {
              // Not JSON, render as-is
            }
            // Truncate for social platforms
            const maxChars = config.maxChars;
            if (maxChars && body.length > maxChars) {
              return body.substring(0, maxChars) + "...";
            }
            return body;
          })()}
        </div>

        {/* Hashtags */}
        {hashtags.length > 0 && (
          <div className="px-4 pb-2 flex flex-wrap gap-1">
            {hashtags.map((tag: string, i: number) => (
              <span key={i} className={`text-xs ${config.color}`}>
                #{tag.replace(/^#/, "")}
              </span>
            ))}
          </div>
        )}

        {/* Media: Images */}
        {images.length > 0 && (
          <div className={`px-4 pb-3 ${images.length > 1 ? "grid grid-cols-2 gap-2" : ""}`}>
            {images.map((url, i) => (
              <div key={i} className="relative group rounded-lg overflow-hidden border border-border/50">
                <img
                  loading="lazy"
                  src={url}
                  alt={`Ad creative ${i + 1}`}
                  className={`w-full object-cover ${images.length === 1 ? "max-h-[400px]" : "h-48"} ${isMobileView ? "max-h-[250px]" : ""}`}
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                  <a href={url} target="_blank" rel="noopener noreferrer" className="p-2 rounded-full bg-black/60 text-white hover:bg-black/80">
                    <Maximize2 className="w-4 h-4" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Media: Videos */}
        {videos.length > 0 && (
          <div className="px-4 pb-3 space-y-3">
            {videos.map((url, i) => (
              <div key={i} className="rounded-lg overflow-hidden border border-border/50">
                <video
                  src={url}
                  controls
                  preload="metadata"
                  className={`w-full ${isMobileView ? "max-h-[300px]" : "max-h-[400px]"} bg-black`}
                  poster=""
                >
                  <source src={url} />
                  Your browser does not support video playback.
                </video>
                <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 text-xs text-muted-foreground">
                  <Video className="w-3 h-3" />
                  <span>Video {i + 1}</span>
                  <a href={url} target="_blank" rel="noopener noreferrer" className="ml-auto flex items-center gap-1 hover:text-foreground">
                    <ExternalLink className="w-3 h-3" /> Open
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Engagement Mock Footer */}
        <div className={`flex items-center gap-6 px-4 py-3 border-t ${config.bgColor === "bg-white" ? "border-gray-200" : "border-zinc-800"}`}>
          <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
            <Eye className="w-3.5 h-3.5" />
            <span>{item.impressions || 0}</span>
          </div>
          <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
            <MousePointerClick className="w-3.5 h-3.5" />
            <span>{item.clicks || 0}</span>
          </div>
          <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
            <Users className="w-3.5 h-3.5" />
            <span>{item.engagements || 0}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Full-screen preview dialog for a single content item */
function PreviewDialog({
  item,
  open,
  onClose,
}: {
  item: any;
  open: boolean;
  onClose: () => void;
}) {
  const [viewMode, setViewMode] = useState<"desktop" | "mobile">("desktop");
  const { images, videos } = extractMediaUrls(item);
  const platform = item.channel || item.platform || "content_seo";
  const config = PLATFORM_CONFIG[platform] || PLATFORM_CONFIG.content_seo;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="flex items-center gap-2">
                <Eye className="w-5 h-5" />
                Ad Preview
              </DialogTitle>
              <DialogDescription>
                Preview how this content will appear on {config.label}
              </DialogDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant={viewMode === "desktop" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("desktop")}
              >
                <Monitor className="w-4 h-4 mr-1" /> Desktop
              </Button>
              <Button
                variant={viewMode === "mobile" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("mobile")}
              >
                <Smartphone className="w-4 h-4 mr-1" /> Mobile
              </Button>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-6 pb-4">
            {/* Platform Preview */}
            <PlatformPreview item={item} viewMode={viewMode} />

            {/* Media Gallery (if multiple images/videos) */}
            {(images.length > 1 || videos.length > 0) && (
              <>
                <Separator />
                <div>
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <Image className="w-4 h-4" /> Media Assets ({images.length} image{images.length !== 1 ? "s" : ""}, {videos.length} video{videos.length !== 1 ? "s" : ""})
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {images.map((url, i) => (
                      <a key={`img-${i}`} href={url} target="_blank" rel="noopener noreferrer" className="group relative rounded-lg overflow-hidden border hover:border-primary transition-colors">
                        <img loading="lazy" src={url} alt={`Asset ${i + 1}`} className="w-full h-32 object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                          <Maximize2 className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </a>
                    ))}
                    {videos.map((url, i) => (
                      <div key={`vid-${i}`} className="rounded-lg overflow-hidden border">
                        <video src={url} controls preload="metadata" className="w-full h-32 object-cover bg-black" />
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Content Details */}
            <Separator />
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Platform</span>
                <div className="font-medium">{config.label}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Content Type</span>
                <div className="font-medium">{CONTENT_TYPE_LABELS[item.contentType] || item.contentType}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Status</span>
                <div>
                  <Badge
                    variant="outline"
                    className={
                      item.status === "published" ? "bg-green-500/10 text-green-500" :
                      item.status === "approved" ? "bg-blue-500/10 text-blue-500" :
                      item.status === "failed" ? "bg-red-500/10 text-red-500" :
                      "bg-yellow-500/10 text-yellow-500"
                    }
                  >
                    {item.status}
                  </Badge>
                </div>
              </div>
              <div>
                <span className="text-muted-foreground">Created</span>
                <div className="font-medium">
                  {item.createdAt ? new Date(item.createdAt).toLocaleString() : "Unknown"}
                </div>
              </div>
              {item.publishedAt && (
                <div>
                  <span className="text-muted-foreground">Published</span>
                  <div className="font-medium">{new Date(item.publishedAt).toLocaleString()}</div>
                </div>
              )}
              {item.aiPrompt && (
                <div className="col-span-2">
                  <span className="text-muted-foreground">AI Prompt Used</span>
                  <div className="mt-1 text-xs bg-muted/50 rounded-lg p-3 max-h-24 overflow-y-auto">
                    {item.aiPrompt}
                  </div>
                </div>
              )}
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

function AdPreviewTab() {
  const [channelFilter, setChannelFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [viewMode, setViewMode] = useState<"desktop" | "mobile">("desktop");

  const contentQueue = trpc.advertising.getContentQueue.useQuery({ limit: 100 });

  // Filter content
  const filteredContent = useMemo(() => {
    if (!contentQueue.data) return [];
    return contentQueue.data.filter((item: any) => {
      if (channelFilter !== "all" && item.channel !== channelFilter) return false;
      if (typeFilter !== "all" && item.contentType !== typeFilter) return false;
      if (statusFilter !== "all" && item.status !== statusFilter) return false;
      return true;
    });
  }, [contentQueue.data, channelFilter, typeFilter, statusFilter]);

  // Get unique channels and types for filter dropdowns
  const uniqueChannels = useMemo((): string[] => {
    if (!contentQueue.data) return [];
    return Array.from(new Set<string>(contentQueue.data.map((item: any) => item.channel as string))).sort();
  }, [contentQueue.data]);

  const uniqueTypes = useMemo((): string[] => {
    if (!contentQueue.data) return [];
    return Array.from(new Set<string>(contentQueue.data.map((item: any) => item.contentType as string))).sort();
  }, [contentQueue.data]);

  // Count items with media
  const mediaStats = useMemo(() => {
    if (!contentQueue.data) return { withImages: 0, withVideos: 0, total: 0 };
    let withImages = 0;
    let withVideos = 0;
    for (const item of contentQueue.data) {
      const { images, videos } = extractMediaUrls(item);
      if (images.length > 0) withImages++;
      if (videos.length > 0) withVideos++;
    }
    return { withImages, withVideos, total: contentQueue.data.length };
  }, [contentQueue.data]);

  return (
    <div className="space-y-4">
      {/* Header Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Eye className="w-5 h-5" /> Ad Preview
              </CardTitle>
              <CardDescription>
                Preview your ads, social posts, and content before they go live.
                View images, videos, and text exactly as they will appear on each platform.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant={viewMode === "desktop" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("desktop")}
              >
                <Monitor className="w-4 h-4 mr-1" /> Desktop
              </Button>
              <Button
                variant={viewMode === "mobile" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("mobile")}
              >
                <Smartphone className="w-4 h-4 mr-1" /> Mobile
              </Button>
              <Button variant="outline" size="sm" onClick={() => contentQueue.refetch()}>
                <RefreshCw className="w-4 h-4 mr-2" /> Refresh
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Stats Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/50">
              <FileText className="w-4 h-4 text-muted-foreground" />
              <div>
                <div className="text-lg font-bold">{mediaStats.total}</div>
                <div className="text-xs text-muted-foreground">Total Items</div>
              </div>
            </div>
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/50">
              <Image className="w-4 h-4 text-blue-500" />
              <div>
                <div className="text-lg font-bold">{mediaStats.withImages}</div>
                <div className="text-xs text-muted-foreground">With Images</div>
              </div>
            </div>
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/50">
              <Video className="w-4 h-4 text-pink-500" />
              <div>
                <div className="text-lg font-bold">{mediaStats.withVideos}</div>
                <div className="text-xs text-muted-foreground">With Videos</div>
              </div>
            </div>
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/50">
              <Target className="w-4 h-4 text-green-500" />
              <div>
                <div className="text-lg font-bold">{filteredContent.length}</div>
                <div className="text-xs text-muted-foreground">Showing</div>
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-3">
            <Select value={channelFilter} onValueChange={setChannelFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Channels" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Channels</SelectItem>
                {uniqueChannels.map((ch: string) => (
                  <SelectItem key={ch} value={ch}>
                    {PLATFORM_CONFIG[ch]?.label || ch}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {uniqueTypes.map((t: string) => (
                  <SelectItem key={t} value={t}>
                    {CONTENT_TYPE_LABELS[t] || t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="published">Published</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Content Preview Grid */}
      {contentQueue.isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : filteredContent.length === 0 ? (
        <Card>
          <CardContent className="py-16">
            <div className="text-center text-muted-foreground">
              <Eye className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-lg font-medium">No content to preview</p>
              <p className="text-sm mt-1">
                {contentQueue.data?.length === 0
                  ? "Run an advertising cycle to generate content, then come back here to preview it."
                  : "No content matches your current filters. Try adjusting them."}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className={`grid gap-6 ${viewMode === "mobile" ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-3" : "grid-cols-1 lg:grid-cols-2"}`}>
          {filteredContent.map((item: any) => {
            const { images, videos } = extractMediaUrls(item);
            const hasMedia = images.length > 0 || videos.length > 0;
            return (
              <div key={item.id} className="relative group">
                <PlatformPreview item={item} viewMode={viewMode} />
                {/* Overlay action buttons */}
                <div className="absolute top-12 right-3 flex flex-col gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    size="sm"
                    variant="secondary"
                    className="shadow-lg"
                    onClick={() => setSelectedItem(item)}
                  >
                    <Maximize2 className="w-3.5 h-3.5 mr-1" /> Expand
                  </Button>
                  {hasMedia && (
                    <Badge variant="secondary" className="text-xs justify-center shadow-lg">
                      {images.length > 0 && <><Image className="w-3 h-3 mr-1" />{images.length}</>}
                      {images.length > 0 && videos.length > 0 && " · "}
                      {videos.length > 0 && <><Video className="w-3 h-3 mr-1" />{videos.length}</>}
                    </Badge>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Full Preview Dialog */}
      {selectedItem && (
        <PreviewDialog
          item={selectedItem}
          open={!!selectedItem}
          onClose={() => setSelectedItem(null)}
        />
      )}
    </div>
  );
}
