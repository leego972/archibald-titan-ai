import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Megaphone,
  DollarSign,
  TrendingUp,
  Zap,
  Play,
  Pause,
  BarChart3,
  PenTool,
  Target,
  Eye,
  MousePointerClick,
  Users,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  Settings,
  Activity,
  Sparkles,
  Globe,
  Clock,
} from "lucide-react";
import { toast } from "sonner";

// Channel display config
const CHANNEL_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  meta_facebook: { label: "Facebook", color: "bg-blue-600", icon: "📘" },
  meta_instagram: { label: "Instagram", color: "bg-pink-500", icon: "📸" },
  google_ads: { label: "Google Ads", color: "bg-red-500", icon: "🔍" },
  x_twitter: { label: "X (Twitter)", color: "bg-zinc-800", icon: "𝕏" },
  linkedin: { label: "LinkedIn", color: "bg-blue-700", icon: "💼" },
  snapchat: { label: "Snapchat", color: "bg-yellow-400", icon: "👻" },
  sendgrid: { label: "Email (SendGrid)", color: "bg-blue-400", icon: "📧" },
  reddit: { label: "Reddit", color: "bg-orange-600", icon: "🤖" },
  tiktok: { label: "TikTok", color: "bg-pink-600", icon: "🎵" },
  pinterest: { label: "Pinterest", color: "bg-red-600", icon: "📌" },
};

function formatCurrency(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function formatPercent(n: number): string {
  return `${(n * 100).toFixed(2)}%`;
}

// ============================================
// MAIN PAGE
// ============================================

export default function MarketingPage() {
  const [activeTab, setActiveTab] = useState("overview");

  const settings = trpc.marketing.getSettings.useQuery();
  const channels = trpc.marketing.getChannelStatuses.useQuery();
  const dashboard = trpc.marketing.getDashboardMetrics.useQuery();
  const campaigns = trpc.marketing.listCampaigns.useQuery({ limit: 20 });
  const content = trpc.marketing.listContent.useQuery({ limit: 30 });
  const budget = trpc.marketing.getCurrentBudget.useQuery();
  const activityLog = trpc.marketing.getActivityLog.useQuery({ limit: 30 });

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-violet-600 to-fuchsia-600 flex items-center justify-center">
                <Megaphone className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">Marketing Command Center</h1>
                <p className="text-sm text-muted-foreground">Titan's Autonomous Marketing Agency</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <EngineToggle settings={settings.data} refetch={settings.refetch} />
              <RunCycleButton />
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="overview" className="gap-2">
              <BarChart3 className="w-4 h-4" /> Overview
            </TabsTrigger>
            <TabsTrigger value="campaigns" className="gap-2">
              <Target className="w-4 h-4" /> Campaigns
            </TabsTrigger>
            <TabsTrigger value="content" className="gap-2">
              <PenTool className="w-4 h-4" /> Content
            </TabsTrigger>
            <TabsTrigger value="budget" className="gap-2">
              <DollarSign className="w-4 h-4" /> Budget
            </TabsTrigger>
            <TabsTrigger value="channels" className="gap-2">
              <Globe className="w-4 h-4" /> Channels
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-2">
              <Settings className="w-4 h-4" /> Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <OverviewTab dashboard={dashboard.data} campaigns={campaigns.data} activityLog={activityLog.data} />
          </TabsContent>

          <TabsContent value="campaigns">
            <CampaignsTab campaigns={campaigns.data} refetch={campaigns.refetch} />
          </TabsContent>

          <TabsContent value="content">
            <ContentTab content={content.data} refetch={content.refetch} />
          </TabsContent>

          <TabsContent value="budget">
            <BudgetTab budget={budget.data} dashboard={dashboard.data} refetch={budget.refetch} />
          </TabsContent>

          <TabsContent value="channels">
            <ChannelsTab channels={channels.data} />
          </TabsContent>

          <TabsContent value="settings">
            <SettingsTab settings={settings.data} refetch={settings.refetch} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

// ============================================
// ENGINE TOGGLE
// ============================================

function EngineToggle({ settings, refetch }: { settings: any; refetch: () => void }) {
  const updateSettings = trpc.marketing.updateSettings.useMutation({
    onSuccess: () => {
      refetch();
      toast.success(settings?.enabled ? "Marketing engine paused" : "Marketing engine activated");
    },
  });

  return (
    <div className="flex items-center gap-2 bg-secondary/50 rounded-lg px-3 py-2">
      <div className={`w-2 h-2 rounded-full ${settings?.enabled ? "bg-green-500 animate-pulse" : "bg-zinc-400"}`} />
      <span className="text-sm font-medium">{settings?.enabled ? "Engine Active" : "Engine Paused"}</span>
      <Switch
        checked={settings?.enabled || false}
        onCheckedChange={(checked) => updateSettings.mutate({ enabled: checked })}
        disabled={updateSettings.isPending}
      />
    </div>
  );
}

// ============================================
// RUN CYCLE BUTTON
// ============================================

function RunCycleButton() {
  const runCycle = trpc.marketing.runCycle.useMutation({
    onSuccess: (result) => {
      toast.success(
        `Cycle complete: ${result.contentGenerated} generated, ${result.contentPublished} published, ${result.campaignsOptimized} optimized`
      );
    },
    onError: (err) => toast.error(`Cycle failed: ${err.message}`),
  });

  return (
    <Button
      onClick={() => runCycle.mutate()}
      disabled={runCycle.isPending}
      className="bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white hover:from-violet-700 hover:to-fuchsia-700"
    >
      {runCycle.isPending ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin mr-2" /> Running Cycle...
        </>
      ) : (
        <>
          <Zap className="w-4 h-4 mr-2" /> Run Autonomous Cycle
        </>
      )}
    </Button>
  );
}

// ============================================
// OVERVIEW TAB
// ============================================

function OverviewTab({ dashboard, campaigns, activityLog }: { dashboard: any; campaigns: any; activityLog: any }) {
  const metrics = [
    {
      label: "Total Spend",
      value: dashboard ? `$${dashboard.totalSpend.toLocaleString("en-US", { minimumFractionDigits: 2 })}` : "$0.00",
      icon: DollarSign,
      color: "text-green-500",
    },
    {
      label: "Impressions",
      value: dashboard ? formatNumber(dashboard.totalImpressions) : "0",
      icon: Eye,
      color: "text-blue-500",
    },
    {
      label: "Clicks",
      value: dashboard ? formatNumber(dashboard.totalClicks) : "0",
      icon: MousePointerClick,
      color: "text-violet-500",
    },
    {
      label: "Conversions",
      value: dashboard ? formatNumber(dashboard.totalConversions) : "0",
      icon: Users,
      color: "text-fuchsia-500",
    },
    {
      label: "Avg CTR",
      value: dashboard ? formatPercent(dashboard.avgCtr) : "0.00%",
      icon: TrendingUp,
      color: "text-amber-500",
    },
    {
      label: "Avg CPC",
      value: dashboard ? `$${dashboard.avgCpc.toFixed(2)}` : "$0.00",
      icon: Target,
      color: "text-cyan-500",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {metrics.map((m) => (
          <Card key={m.label}>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2 mb-1">
                <m.icon className={`w-4 h-4 ${m.color}`} />
                <span className="text-xs text-muted-foreground">{m.label}</span>
              </div>
              <p className="text-xl font-bold">{m.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Channel Breakdown */}
      {dashboard?.channelBreakdown && dashboard.channelBreakdown.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Channel Performance</CardTitle>
            <CardDescription>Last 90 days across all channels</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Channel</th>
                    <th className="text-right py-2 px-3 font-medium text-muted-foreground">Spend</th>
                    <th className="text-right py-2 px-3 font-medium text-muted-foreground">Impressions</th>
                    <th className="text-right py-2 px-3 font-medium text-muted-foreground">Clicks</th>
                    <th className="text-right py-2 px-3 font-medium text-muted-foreground">Conversions</th>
                    <th className="text-right py-2 px-3 font-medium text-muted-foreground">CTR</th>
                    <th className="text-right py-2 px-3 font-medium text-muted-foreground">CPC</th>
                  </tr>
                </thead>
                <tbody>
                  {dashboard.channelBreakdown.map((ch: any) => {
                    const cfg = CHANNEL_CONFIG[ch.channel] || { label: ch.channel, icon: "📊" };
                    return (
                      <tr key={ch.channel} className="border-b border-border/50">
                        <td className="py-2 px-3 font-medium">
                          <span className="mr-2">{cfg.icon}</span>
                          {cfg.label}
                        </td>
                        <td className="text-right py-2 px-3">${(ch.spend / 100).toFixed(2)}</td>
                        <td className="text-right py-2 px-3">{formatNumber(ch.impressions)}</td>
                        <td className="text-right py-2 px-3">{formatNumber(ch.clicks)}</td>
                        <td className="text-right py-2 px-3">{formatNumber(ch.conversions)}</td>
                        <td className="text-right py-2 px-3">{formatPercent(ch.ctr)}</td>
                        <td className="text-right py-2 px-3">${ch.cpc.toFixed(2)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active Campaigns */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Active Campaigns</CardTitle>
            <CardDescription>{campaigns?.filter((c: any) => c.status === "active").length || 0} running</CardDescription>
          </CardHeader>
          <CardContent>
            {!campaigns || campaigns.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Target className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p>No campaigns yet</p>
                <p className="text-xs mt-1">Create one from the Campaigns tab</p>
              </div>
            ) : (
              <div className="space-y-3">
                {campaigns.slice(0, 5).map((c: any) => (
                  <div key={c.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/30">
                    <div>
                      <p className="font-medium text-sm">{c.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {CHANNEL_CONFIG[c.channel]?.icon} {CHANNEL_CONFIG[c.channel]?.label || c.channel}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <CampaignStatusBadge status={c.status} />
                      {c.totalBudget > 0 && (
                        <span className="text-xs text-muted-foreground">{formatCurrency(c.totalBudget)}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Activity Log */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recent Activity</CardTitle>
            <CardDescription>Engine actions and events</CardDescription>
          </CardHeader>
          <CardContent>
            {!activityLog || activityLog.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Activity className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p>No activity yet</p>
                <p className="text-xs mt-1">Activity will appear when the engine runs</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {activityLog.slice(0, 15).map((log: any) => (
                  <div key={log.id} className="flex items-start gap-2 p-2 rounded bg-secondary/20 text-sm">
                    <ActivityIcon action={log.action} status={log.status} />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium">{formatAction(log.action)}</p>
                      {log.channel && (
                        <span className="text-xs text-muted-foreground">
                          {CHANNEL_CONFIG[log.channel]?.icon} {CHANNEL_CONFIG[log.channel]?.label || log.channel}
                        </span>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {new Date(log.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <Badge variant={log.status === "success" ? "default" : "destructive"} className="text-xs shrink-0">
                      {log.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ============================================
// CAMPAIGNS TAB
// ============================================

function CampaignsTab({ campaigns, refetch }: { campaigns: any; refetch: () => void }) {
  const [showCreate, setShowCreate] = useState(false);
  const [goal, setGoal] = useState<string>("awareness");
  const [campaignBudget, setCampaignBudget] = useState("500");
  const [duration, setDuration] = useState("30");

  const createCampaign = trpc.marketing.createCampaign.useMutation({
    onSuccess: (result) => {
      toast.success(`Campaign "${result.plan.name}" created`);
      refetch();
      setShowCreate(false);
    },
    onError: (err) => toast.error(`Failed: ${err.message}`),
  });

  const launchCampaign = trpc.marketing.launchCampaign.useMutation({
    onSuccess: (result) => {
      toast.success(`Launched: ${result.contentPublished} posts, ${result.adsCreated} ads created`);
      refetch();
    },
    onError: (err) => toast.error(`Launch failed: ${err.message}`),
  });

  const updateStatus = trpc.marketing.updateCampaignStatus.useMutation({
    onSuccess: () => {
      toast.success("Campaign status updated");
      refetch();
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Campaigns</h2>
          <p className="text-sm text-muted-foreground">AI-planned and executed marketing campaigns</p>
        </div>
        <Button onClick={() => setShowCreate(!showCreate)} className="gap-2">
          <Sparkles className="w-4 h-4" /> Create AI Campaign
        </Button>
      </div>

      {/* Create Campaign Form */}
      {showCreate && (
        <Card className="border-violet-500/30 bg-violet-500/5">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-violet-500" /> New AI-Planned Campaign
            </CardTitle>
            <CardDescription>AI will create the strategy, content plan, targeting, and budget allocation</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>Campaign Goal</Label>
                <Select value={goal} onValueChange={setGoal}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="awareness">Brand Awareness</SelectItem>
                    <SelectItem value="signups">User Signups</SelectItem>
                    <SelectItem value="engagement">Engagement</SelectItem>
                    <SelectItem value="retention">Retention</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Budget ($)</Label>
                <Input
                  type="number"
                  value={campaignBudget}
                  onChange={(e) => setCampaignBudget(e.target.value)}
                  min="10"
                  placeholder="500"
                />
              </div>
              <div>
                <Label>Duration (days)</Label>
                <Input
                  type="number"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  min="1"
                  max="90"
                  placeholder="30"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <Button
                onClick={() =>
                  createCampaign.mutate({
                    goal: goal as any,
                    budget: parseFloat(campaignBudget),
                    durationDays: parseInt(duration),
                  })
                }
                disabled={createCampaign.isPending}
                className="bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white"
              >
                {createCampaign.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" /> AI Planning...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" /> Generate Campaign Plan
                  </>
                )}
              </Button>
              <Button variant="outline" onClick={() => setShowCreate(false)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Campaign List */}
      {!campaigns || campaigns.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Target className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No campaigns yet</p>
            <p className="text-sm mt-1">Click "Create AI Campaign" to get started</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {campaigns.map((c: any) => (
            <Card key={c.id}>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold">{c.name}</h3>
                      <CampaignStatusBadge status={c.status} />
                      <Badge variant="outline" className="text-xs">
                        {CHANNEL_CONFIG[c.channel]?.icon} {CHANNEL_CONFIG[c.channel]?.label || c.channel}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span>
                        <DollarSign className="w-3 h-3 inline" /> Budget: {formatCurrency(c.totalBudget || 0)}
                      </span>
                      {c.impressions > 0 && (
                        <span>
                          <Eye className="w-3 h-3 inline" /> {formatNumber(c.impressions)} impressions
                        </span>
                      )}
                      {c.clicks > 0 && (
                        <span>
                          <MousePointerClick className="w-3 h-3 inline" /> {formatNumber(c.clicks)} clicks
                        </span>
                      )}
                      <span>
                        <Clock className="w-3 h-3 inline" /> {new Date(c.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {c.status === "draft" && (
                      <Button
                        size="sm"
                        onClick={() => launchCampaign.mutate({ campaignId: c.id })}
                        disabled={launchCampaign.isPending}
                        className="bg-green-600 hover:bg-green-700 text-white"
                      >
                        {launchCampaign.isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <Play className="w-4 h-4 mr-1" /> Launch
                          </>
                        )}
                      </Button>
                    )}
                    {c.status === "active" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateStatus.mutate({ campaignId: c.id, status: "paused" })}
                      >
                        <Pause className="w-4 h-4 mr-1" /> Pause
                      </Button>
                    )}
                    {c.status === "paused" && (
                      <Button
                        size="sm"
                        onClick={() => updateStatus.mutate({ campaignId: c.id, status: "active" })}
                      >
                        <Play className="w-4 h-4 mr-1" /> Resume
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================
// CONTENT TAB
// ============================================

function ContentTab({ content, refetch }: { content: any; refetch: () => void }) {
  const [generating, setGenerating] = useState(false);
  const [platform, setPlatform] = useState("facebook");
  const [contentType, setContentType] = useState("organic_post");

  const generateContent = trpc.marketing.generateContent.useMutation({
    onSuccess: () => {
      toast.success("Content generated successfully");
      refetch();
      setGenerating(false);
    },
    onError: (err) => toast.error(`Failed: ${err.message}`),
  });

  const updateStatus = trpc.marketing.updateContentStatus.useMutation({
    onSuccess: () => {
      toast.success("Content status updated");
      refetch();
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Content Library</h2>
          <p className="text-sm text-muted-foreground">AI-generated marketing content for all channels</p>
        </div>
        <Button onClick={() => setGenerating(!generating)} className="gap-2">
          <PenTool className="w-4 h-4" /> Generate Content
        </Button>
      </div>

      {/* Generate Content Form */}
      {generating && (
        <Card className="border-fuchsia-500/30 bg-fuchsia-500/5">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-fuchsia-500" /> Generate Marketing Content
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Platform</Label>
                <Select value={platform} onValueChange={setPlatform}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="facebook">Facebook</SelectItem>
                    <SelectItem value="instagram">Instagram</SelectItem>
                    <SelectItem value="x_twitter">X (Twitter)</SelectItem>
                    <SelectItem value="linkedin">LinkedIn</SelectItem>
                    <SelectItem value="snapchat">Snapchat</SelectItem>
                    <SelectItem value="blog">Blog Article</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Content Type</Label>
                <Select value={contentType} onValueChange={setContentType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="organic_post">Organic Post</SelectItem>
                    <SelectItem value="ad_copy">Ad Copy</SelectItem>
                    <SelectItem value="blog_article">Blog Article</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <Button
                onClick={() =>
                  generateContent.mutate({
                    platform: platform as any,
                    contentType: contentType as any,
                    includeImage: true,
                  })
                }
                disabled={generateContent.isPending}
                className="bg-gradient-to-r from-fuchsia-600 to-pink-600 text-white"
              >
                {generateContent.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" /> Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" /> Generate
                  </>
                )}
              </Button>
              <Button variant="outline" onClick={() => setGenerating(false)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Content List */}
      {!content || content.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <PenTool className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No content yet</p>
            <p className="text-sm mt-1">Generate content or run an autonomous cycle</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {content.map((c: any) => (
            <Card key={c.id}>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span>{CHANNEL_CONFIG[c.channel]?.icon || "📊"}</span>
                    <Badge variant="outline" className="text-xs">
                      {c.contentType}
                    </Badge>
                    <ContentStatusBadge status={c.status} />
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(c.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <h4 className="font-semibold text-sm mb-1">{c.title || "Untitled"}</h4>
                <p className="text-sm text-muted-foreground line-clamp-3">{c.body}</p>
                {c.mediaUrl && (
                  <img
                    src={c.mediaUrl}
                    alt="Content media"
                    className="mt-2 rounded-md w-full h-32 object-cover"
                  />
                )}
                {c.status === "draft" && (
                  <div className="flex gap-2 mt-3">
                    <Button
                      size="sm"
                      variant="default"
                      onClick={() => updateStatus.mutate({ contentId: c.id, status: "approved" })}
                    >
                      <CheckCircle2 className="w-3 h-3 mr-1" /> Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => updateStatus.mutate({ contentId: c.id, status: "failed" })}
                    >
                      <XCircle className="w-3 h-3 mr-1" /> Reject
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================
// BUDGET TAB
// ============================================

function BudgetTab({ budget, dashboard, refetch }: { budget: any; dashboard: any; refetch: () => void }) {
  const [monthlyBudget, setMonthlyBudget] = useState("1000");

  const allocateBudget = trpc.marketing.allocateBudget.useMutation({
    onSuccess: () => {
      toast.success("Budget allocated by AI across channels");
      refetch();
    },
    onError: (err) => toast.error(`Failed: ${err.message}`),
  });

  const allocations = budget?.allocations || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Budget Management</h2>
          <p className="text-sm text-muted-foreground">Set your monthly spend and let AI allocate it optimally</p>
        </div>
      </div>

      {/* Set Budget */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-green-500" /> Monthly Budget
          </CardTitle>
          <CardDescription>Set your total monthly ad spend — AI will distribute across channels based on performance</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-4">
            <div className="flex-1 max-w-xs">
              <Label>Monthly Budget ($)</Label>
              <Input
                type="number"
                value={monthlyBudget}
                onChange={(e) => setMonthlyBudget(e.target.value)}
                min="10"
                className="text-lg font-bold"
              />
            </div>
            <Button
              onClick={() => allocateBudget.mutate({ monthlyBudget: parseFloat(monthlyBudget) })}
              disabled={allocateBudget.isPending}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {allocateBudget.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" /> Allocating...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" /> AI Allocate
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Current Allocations */}
      {allocations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Current Allocations</CardTitle>
            <CardDescription>
              {budget?.month} — Total: {formatCurrency(budget?.totalBudget || 0)}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {allocations.map((a: any, i: number) => {
                const cfg = CHANNEL_CONFIG[a.channel] || { label: a.channel, color: "bg-gray-500", icon: "📊" };
                const pct = budget?.totalBudget > 0 ? (a.amount / budget.totalBudget) * 100 : 0;
                return (
                  <div key={i}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">
                        {cfg.icon} {cfg.label}
                      </span>
                      <span className="text-sm font-bold">{formatCurrency(a.amount)} ({pct.toFixed(0)}%)</span>
                    </div>
                    <div className="w-full bg-secondary rounded-full h-2.5">
                      <div className={`${cfg.color} h-2.5 rounded-full`} style={{ width: `${pct}%` }} />
                    </div>
                    {a.reasoning && (
                      <p className="text-xs text-muted-foreground mt-1">{a.reasoning}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Spend Summary */}
      {dashboard && dashboard.totalSpend > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Spend Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-3 rounded-lg bg-secondary/30">
                <p className="text-2xl font-bold">${dashboard.totalSpend.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">Total Spend</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-secondary/30">
                <p className="text-2xl font-bold">${dashboard.avgCpc.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">Avg CPC</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-secondary/30">
                <p className="text-2xl font-bold">{formatPercent(dashboard.avgCtr)}</p>
                <p className="text-xs text-muted-foreground">Avg CTR</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-secondary/30">
                <p className="text-2xl font-bold">
                  {dashboard.totalConversions > 0 && dashboard.totalSpend > 0
                    ? `$${(dashboard.totalSpend / dashboard.totalConversions).toFixed(2)}`
                    : "N/A"}
                </p>
                <p className="text-xs text-muted-foreground">Cost per Conversion</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ============================================
// CHANNELS TAB
// ============================================

function ChannelsTab({ channels }: { channels: any }) {
  if (!channels) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">Advertising Channels</h2>
        <p className="text-sm text-muted-foreground">Direct API connections to each platform — no middlemen</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Object.entries(channels).map(([channelId, status]: [string, any]) => {
          const cfg = CHANNEL_CONFIG[channelId] || { label: channelId, color: "bg-gray-500", icon: "📊" };
          return (
            <Card key={channelId} className={status.connected ? "border-green-500/30" : "border-border"}>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{cfg.icon}</span>
                    <div>
                      <h3 className="font-semibold">{cfg.label}</h3>
                      <p className="text-xs text-muted-foreground">{channelId}</p>
                    </div>
                  </div>
                  {status.connected ? (
                    <Badge className="bg-green-600 text-white">Connected</Badge>
                  ) : (
                    <Badge variant="outline" className="text-muted-foreground">Not Connected</Badge>
                  )}
                </div>

                {status.connected ? (
                  <div className="space-y-1 text-sm">
                    <div className="flex items-center gap-2 text-green-600">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>API credentials configured</span>
                    </div>
                    {status.capabilities && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {status.capabilities.map((cap: string) => (
                          <Badge key={cap} variant="secondary" className="text-xs">
                            {cap}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <AlertCircle className="w-4 h-4" />
                      <span>API credentials needed</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Add credentials in Settings → Secrets to enable this channel
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ============================================
// SETTINGS TAB
// ============================================

function SettingsTab({ settings, refetch }: { settings: any; refetch: () => void }) {
  const [monthlyBudget, setMonthlyBudget] = useState(settings?.monthlyBudget?.toString() || "0");
  const [frequency, setFrequency] = useState(settings?.contentFrequency || "daily");

  const updateSettings = trpc.marketing.updateSettings.useMutation({
    onSuccess: () => {
      toast.success("Settings saved");
      refetch();
    },
  });

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-xl font-bold">Engine Settings</h2>
        <p className="text-sm text-muted-foreground">Configure how the autonomous marketing engine operates</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>General Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-base">Engine Enabled</Label>
              <p className="text-sm text-muted-foreground">When enabled, the engine runs autonomous cycles on schedule</p>
            </div>
            <Switch
              checked={settings?.enabled || false}
              onCheckedChange={(checked) => updateSettings.mutate({ enabled: checked })}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label className="text-base">Auto-Publish</Label>
              <p className="text-sm text-muted-foreground">Automatically publish AI-generated content without manual approval</p>
            </div>
            <Switch
              checked={settings?.autoPublish || false}
              onCheckedChange={(checked) => updateSettings.mutate({ autoPublish: checked })}
            />
          </div>

          <div>
            <Label>Monthly Budget ($)</Label>
            <div className="flex gap-2 mt-1">
              <Input
                type="number"
                value={monthlyBudget}
                onChange={(e) => setMonthlyBudget(e.target.value)}
                min="0"
                className="max-w-xs"
              />
              <Button
                variant="outline"
                onClick={() => updateSettings.mutate({ monthlyBudget: parseFloat(monthlyBudget) })}
              >
                Save
              </Button>
            </div>
          </div>

          <div>
            <Label>Content Generation Frequency</Label>
            <Select
              value={frequency}
              onValueChange={(v) => {
                setFrequency(v);
                updateSettings.mutate({ contentFrequency: v as any });
              }}
            >
              <SelectTrigger className="max-w-xs mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="hourly">Hourly</SelectItem>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Engine Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Status</span>
              <Badge variant={settings?.enabled ? "default" : "secondary"}>
                {settings?.enabled ? "Active" : "Paused"}
              </Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Last Cycle</span>
              <span>{settings?.lastCycleAt ? new Date(settings.lastCycleAt).toLocaleString() : "Never"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Monthly Budget</span>
              <span>${settings?.monthlyBudget?.toLocaleString() || "0"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Content Frequency</span>
              <span className="capitalize">{settings?.contentFrequency || "Daily"}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================
// HELPER COMPONENTS
// ============================================

function CampaignStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    draft: "bg-zinc-500/20 text-zinc-400",
    pending_review: "bg-amber-500/20 text-amber-400",
    active: "bg-green-500/20 text-green-400",
    paused: "bg-yellow-500/20 text-yellow-400",
    completed: "bg-blue-500/20 text-blue-400",
    failed: "bg-red-500/20 text-red-400",
  };
  return <Badge className={`text-xs ${styles[status] || ""}`}>{status}</Badge>;
}

function ContentStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    draft: "bg-zinc-500/20 text-zinc-400",
    approved: "bg-green-500/20 text-green-400",
    published: "bg-blue-500/20 text-blue-400",
    failed: "bg-red-500/20 text-red-400",
  };
  return <Badge className={`text-xs ${styles[status] || ""}`}>{status}</Badge>;
}

function ActivityIcon({ action, status }: { action: string; status: string }) {
  if (status === "failed") return <XCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />;
  const icons: Record<string, any> = {
    content_generated: <PenTool className="w-4 h-4 text-fuchsia-500 mt-0.5 shrink-0" />,
    content_published: <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />,
    campaign_created: <Target className="w-4 h-4 text-violet-500 mt-0.5 shrink-0" />,
    campaign_launched: <Play className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />,
    budget_allocated: <DollarSign className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />,
    autonomous_cycle: <Zap className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />,
    settings_updated: <Settings className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />,
  };
  return icons[action] || <Activity className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />;
}

function formatAction(action: string): string {
  return action
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
