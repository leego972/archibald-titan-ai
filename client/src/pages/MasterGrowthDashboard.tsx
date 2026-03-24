import React, { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
  Loader2, Play, Square, RefreshCw, TrendingUp, TrendingDown,
  AlertTriangle, CheckCircle2, Zap, Target, BarChart3, Globe,
  FileText, Megaphone, Brain, ChevronRight, ArrowUp, ArrowDown,
  Minus, Star, Activity, Shield, Eye, Clock,
} from "lucide-react";

// ─── Status Badge ─────────────────────────────────────────────────────────────
function StatusBadge({ value, label }: { value: number; label: string }) {
  const color = value >= 80 ? "bg-green-900 text-green-300" : value >= 60 ? "bg-yellow-900 text-yellow-300" : "bg-red-900 text-red-300";
  return (
    <div className="flex flex-col items-center">
      <div className={`text-2xl font-bold px-3 py-1 rounded-lg ${color}`}>{value}</div>
      <p className="text-gray-400 text-xs mt-1">{label}</p>
    </div>
  );
}

// ─── Trend Icon ───────────────────────────────────────────────────────────────
function TrendIcon({ trend }: { trend: "up" | "down" | "stable" }) {
  if (trend === "up") return <ArrowUp className="w-4 h-4 text-green-400" />;
  if (trend === "down") return <ArrowDown className="w-4 h-4 text-red-400" />;
  return <Minus className="w-4 h-4 text-gray-400" />;
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function MasterGrowthDashboard() {
  const [activeTab, setActiveTab] = useState("overview");

  const status = trpc.masterGrowth.getStatus.useQuery(undefined, { refetchInterval: 10000 });
  const latestReport = trpc.masterGrowth.getLatestReport.useQuery();
  const anomalies = trpc.masterGrowth.getAnomalies.useQuery();
  const metricsHistory = trpc.masterGrowth.getMetricsHistory.useQuery();
  const insights = trpc.masterGrowth.getCrossSystemInsights.useQuery();
  const adjustments = trpc.masterGrowth.getNextCycleAdjustments.useQuery();
  const context = trpc.masterGrowth.getLatestContext.useQuery();

  const runCycle = trpc.masterGrowth.runCycle.useMutation({
    onSuccess: () => {
      toast.success("Growth cycle complete — report generated");
      latestReport.refetch();
      status.refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const startOrchestrator = trpc.masterGrowth.startOrchestrator.useMutation({
    onSuccess: () => { toast.success("Master Orchestrator started"); status.refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const stopOrchestrator = trpc.masterGrowth.stopOrchestrator.useMutation({
    onSuccess: () => { toast.success("Master Orchestrator stopped"); status.refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const resolveAnomaly = trpc.masterGrowth.resolveAnomaly.useMutation({
    onSuccess: () => { toast.success("Anomaly resolved"); anomalies.refetch(); },
  });

  const report = latestReport.data;
  const stat = status.data;
  const unresolvedAnomalies = (anomalies.data || []).filter((a: any) => !a.autoResolved);

  return (
    <div className="min-h-screen bg-[#0d1117] text-white p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Brain className="w-7 h-7 text-purple-400" />
            Master Growth Orchestrator
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            Unified brain — SEO → Content → Advertising in dependency order
          </p>
        </div>
        <div className="flex items-center gap-3">
          {unresolvedAnomalies.length > 0 && (
            <Badge className="bg-red-900 text-red-300 gap-1">
              <AlertTriangle className="w-3 h-3" />
              {unresolvedAnomalies.length} anomal{unresolvedAnomalies.length === 1 ? "y" : "ies"}
            </Badge>
          )}
          <Badge className={stat?.isRunning ? "bg-green-900 text-green-300" : "bg-[#21262d] text-gray-400"}>
            {stat?.isRunning ? "● Active" : "○ Stopped"}
          </Badge>
          {stat?.isRunning ? (
            <Button onClick={() => stopOrchestrator.mutate()} variant="outline"
              className="border-red-800 text-red-300 hover:bg-red-950 gap-2">
              <Square className="w-4 h-4" /> Stop
            </Button>
          ) : (
            <Button onClick={() => startOrchestrator.mutate()} variant="outline"
              className="border-green-800 text-green-300 hover:bg-green-950 gap-2">
              <Play className="w-4 h-4" /> Start
            </Button>
          )}
          <Button onClick={() => runCycle.mutate()} disabled={runCycle.isPending || stat?.cycleRunning}
            className="bg-purple-600 hover:bg-purple-700 text-white border-0 gap-2">
            {runCycle.isPending || stat?.cycleRunning
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <Zap className="w-4 h-4" />}
            {runCycle.isPending || stat?.cycleRunning ? "Running..." : "Run Cycle Now"}
          </Button>
        </div>
      </div>

      {/* Anomaly Alerts */}
      {unresolvedAnomalies.length > 0 && (
        <div className="space-y-2">
          {unresolvedAnomalies.slice(0, 3).map((a: any) => (
            <div key={a.id} className={`flex items-start justify-between p-3 rounded-lg border gap-3 ${
              a.severity === "critical" ? "bg-red-950/30 border-red-800/50" :
              a.severity === "warning" ? "bg-orange-950/30 border-orange-800/50" :
              "bg-yellow-950/30 border-yellow-800/50"
            }`}>
              <div className="flex items-start gap-2">
                <AlertTriangle className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                  a.severity === "critical" ? "text-red-400" : "text-orange-400"
                }`} />
                <div>
                  <p className="text-white text-sm font-medium">{a.metric} dropped {a.dropPercent}%</p>
                  <p className="text-gray-400 text-xs">{a.diagnosis}</p>
                  <div className="flex gap-1 mt-1 flex-wrap">
                    {a.recommendedActions?.slice(0, 2).map((action: string, i: number) => (
                      <Badge key={i} className="bg-[#21262d] text-gray-300 text-xs">{action}</Badge>
                    ))}
                  </div>
                </div>
              </div>
              <Button size="sm" variant="outline" className="border-[#21262d] text-gray-300 hover:bg-[#21262d] text-xs flex-shrink-0"
                onClick={() => resolveAnomaly.mutate({ anomalyId: a.id })}>
                Resolve
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {[
          { label: "Cycles Run", value: stat?.totalCyclesRun ?? 0, icon: <RefreshCw className="w-4 h-4 text-purple-400" /> },
          { label: "Reports", value: stat?.reportsGenerated ?? 0, icon: <FileText className="w-4 h-4 text-blue-400" /> },
          { label: "Anomalies", value: stat?.anomaliesDetected ?? 0, icon: <AlertTriangle className="w-4 h-4 text-red-400" /> },
          { label: "Keywords", value: stat?.currentContext?.keywordsAnalyzed ?? 0, icon: <Target className="w-4 h-4 text-green-400" /> },
          { label: "Briefs", value: stat?.currentContext?.briefsGenerated ?? 0, icon: <FileText className="w-4 h-4 text-yellow-400" /> },
          { label: "Channels", value: stat?.currentContext?.channelsAnalyzed ?? 0, icon: <Megaphone className="w-4 h-4 text-cyan-400" /> },
        ].map((s) => (
          <Card key={s.label} className="bg-[#161b22] border-[#21262d]">
            <CardContent className="p-3 flex items-center gap-2">
              {s.icon}
              <div>
                <p className="text-white text-lg font-bold">{s.value}</p>
                <p className="text-gray-400 text-xs">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-[#161b22] border border-[#21262d] flex-wrap h-auto gap-1 p-1">
          {[
            { id: "overview", label: "Overview", icon: <BarChart3 className="w-3 h-3" /> },
            { id: "report", label: "Weekly Report", icon: <FileText className="w-3 h-3" /> },
            { id: "seo", label: "SEO Signals", icon: <Globe className="w-3 h-3" /> },
            { id: "content", label: "Content Briefs", icon: <FileText className="w-3 h-3" /> },
            { id: "advertising", label: "Ad Intelligence", icon: <Megaphone className="w-3 h-3" /> },
            { id: "insights", label: "Cross-System", icon: <Brain className="w-3 h-3" /> },
            { id: "anomalies", label: "Anomalies", icon: <AlertTriangle className="w-3 h-3" /> },
            { id: "history", label: "Metrics History", icon: <Activity className="w-3 h-3" /> },
          ].map(tab => (
            <TabsTrigger key={tab.id} value={tab.id}
              className="data-[state=active]:bg-purple-900 data-[state=active]:text-white text-gray-400 text-xs flex items-center gap-1">
              {tab.icon}{tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4 mt-4">
          {report ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Growth Score */}
              <Card className="bg-[#161b22] border-[#21262d]">
                <CardHeader className="pb-2">
                  <CardTitle className="text-white text-sm flex items-center gap-2">
                    <Star className="w-4 h-4 text-yellow-400" /> Overall Growth Score
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-center py-4">
                    <div className="relative">
                      <div className={`text-5xl font-bold ${
                        report.metrics.overallGrowthScore >= 80 ? "text-green-400" :
                        report.metrics.overallGrowthScore >= 60 ? "text-yellow-400" : "text-red-400"
                      }`}>{report.metrics.overallGrowthScore}</div>
                      <div className="text-gray-400 text-sm text-center">/100</div>
                    </div>
                  </div>
                  <Progress value={report.metrics.overallGrowthScore} className="h-2" />
                  <p className="text-gray-400 text-xs mt-2 text-center">Week {report.weekNumber}, {report.year}</p>
                </CardContent>
              </Card>

              {/* Executive Summary */}
              <Card className="bg-[#161b22] border-[#21262d] lg:col-span-2">
                <CardHeader className="pb-2">
                  <CardTitle className="text-white text-sm flex items-center gap-2">
                    <Brain className="w-4 h-4 text-purple-400" /> Executive Summary
                  </CardTitle>
                  <CardDescription className="text-gray-400 text-xs">
                    Generated {new Date(report.generatedAt).toLocaleString()}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-300 text-sm leading-relaxed">{report.executiveSummary}</p>
                  <div className="grid grid-cols-3 gap-3 mt-4">
                    <div className="text-center">
                      <p className="text-green-400 text-xl font-bold">{report.wins.length}</p>
                      <p className="text-gray-400 text-xs">Wins</p>
                    </div>
                    <div className="text-center">
                      <p className="text-red-400 text-xl font-bold">{report.losses.length}</p>
                      <p className="text-gray-400 text-xs">Losses</p>
                    </div>
                    <div className="text-center">
                      <p className="text-blue-400 text-xl font-bold">{report.opportunities.length}</p>
                      <p className="text-gray-400 text-xs">Opportunities</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Key Metrics */}
              <Card className="bg-[#161b22] border-[#21262d] lg:col-span-3">
                <CardHeader className="pb-2">
                  <CardTitle className="text-white text-sm flex items-center gap-2">
                    <Activity className="w-4 h-4 text-cyan-400" /> Key Metrics
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                    {[
                      { label: "Organic Traffic", value: report.metrics.organicTrafficIndex, suffix: "" },
                      { label: "Content Published", value: report.metrics.contentPiecesPublished, suffix: "" },
                      { label: "Avg Quality Score", value: report.metrics.avgContentQualityScore, suffix: "/100" },
                      { label: "Ad Impressions", value: report.metrics.adImpressions.toLocaleString(), suffix: "" },
                      { label: "Ad Conversions", value: report.metrics.adConversions, suffix: "" },
                      { label: "Avg Ad ROI", value: report.metrics.adRoi.toFixed(1), suffix: "x" },
                    ].map(m => (
                      <div key={m.label} className="text-center p-3 bg-[#0d1117] rounded border border-[#21262d]">
                        <p className="text-white text-xl font-bold">{m.value}{m.suffix}</p>
                        <p className="text-gray-400 text-xs mt-1">{m.label}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card className="bg-[#161b22] border-[#21262d]">
              <CardContent className="p-8 text-center">
                <Brain className="w-12 h-12 text-purple-400 mx-auto mb-3" />
                <p className="text-white font-medium">No growth cycle has run yet</p>
                <p className="text-gray-400 text-sm mt-1">Click "Run Cycle Now" to generate your first growth report</p>
                <Button onClick={() => runCycle.mutate()} disabled={runCycle.isPending}
                  className="mt-4 bg-purple-600 hover:bg-purple-700 text-white border-0 gap-2">
                  {runCycle.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                  Run First Cycle
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Weekly Report Tab */}
        <TabsContent value="report" className="space-y-4 mt-4">
          {report ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Wins */}
              <Card className="bg-[#161b22] border-[#21262d]">
                <CardHeader className="pb-2">
                  <CardTitle className="text-green-300 text-sm flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" /> Wins ({report.wins.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {report.wins.map((w: any, i: number) => (
                    <div key={i} className="p-2 bg-green-950/20 border border-green-800/30 rounded">
                      <div className="flex items-center justify-between">
                        <p className="text-white text-xs font-medium">{w.title}</p>
                        <Badge className={`text-xs ${w.impact === "high" ? "bg-green-900 text-green-300" : "bg-[#21262d] text-gray-400"}`}>{w.impact}</Badge>
                      </div>
                      <p className="text-gray-400 text-xs mt-1">{w.detail}</p>
                      <Badge className="bg-[#21262d] text-gray-500 text-xs mt-1">{w.system}</Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Losses */}
              <Card className="bg-[#161b22] border-[#21262d]">
                <CardHeader className="pb-2">
                  <CardTitle className="text-red-300 text-sm flex items-center gap-2">
                    <TrendingDown className="w-4 h-4" /> Losses ({report.losses.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {report.losses.length === 0 ? (
                    <p className="text-gray-400 text-sm text-center py-4">No losses this week 🎉</p>
                  ) : report.losses.map((l: any, i: number) => (
                    <div key={i} className="p-2 bg-red-950/20 border border-red-800/30 rounded">
                      <div className="flex items-center justify-between">
                        <p className="text-white text-xs font-medium">{l.title}</p>
                        <Badge className={`text-xs ${l.impact === "high" ? "bg-red-900 text-red-300" : "bg-[#21262d] text-gray-400"}`}>{l.impact}</Badge>
                      </div>
                      <p className="text-gray-400 text-xs mt-1">{l.detail}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Opportunities */}
              <Card className="bg-[#161b22] border-[#21262d]">
                <CardHeader className="pb-2">
                  <CardTitle className="text-blue-300 text-sm flex items-center gap-2">
                    <Target className="w-4 h-4" /> Opportunities ({report.opportunities.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {report.opportunities.map((o: any, i: number) => (
                    <div key={i} className="p-2 bg-blue-950/20 border border-blue-800/30 rounded">
                      <p className="text-white text-xs font-medium">{o.title}</p>
                      <p className="text-gray-400 text-xs mt-1">{o.detail}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Next Week Plan */}
              <Card className="bg-[#161b22] border-[#21262d]">
                <CardHeader className="pb-2">
                  <CardTitle className="text-yellow-300 text-sm flex items-center gap-2">
                    <Clock className="w-4 h-4" /> Next Week Plan
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {report.nextWeekPlan.map((a: any, i: number) => (
                    <div key={i} className="flex items-start gap-2 p-2 bg-[#0d1117] border border-[#21262d] rounded">
                      <span className="w-5 h-5 rounded-full bg-yellow-900 text-yellow-300 text-xs flex items-center justify-center flex-shrink-0 font-bold">{a.priority}</span>
                      <div>
                        <p className="text-white text-xs">{a.action}</p>
                        <p className="text-gray-500 text-xs mt-0.5">{a.expectedImpact} · {a.system}</p>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card className="bg-[#161b22] border-[#21262d]">
              <CardContent className="p-8 text-center">
                <p className="text-gray-400">Run a growth cycle to generate the first report</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* SEO Signals Tab */}
        <TabsContent value="seo" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="bg-[#161b22] border-[#21262d]">
              <CardHeader className="pb-2">
                <CardTitle className="text-white text-sm flex items-center gap-2">
                  <Globe className="w-4 h-4 text-green-400" /> Keyword Opportunities
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {(context.data?.topKeywords || []).map((k: any, i: number) => (
                  <div key={i} className="flex items-center justify-between p-2 bg-[#0d1117] border border-[#21262d] rounded">
                    <div>
                      <p className="text-white text-xs font-medium">{k.keyword}</p>
                      <p className="text-gray-500 text-xs">Vol: {k.searchVolume.toLocaleString()} · Diff: {k.difficulty}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      {k.contentGap && <Badge className="bg-orange-900 text-orange-300 text-xs">Gap</Badge>}
                      {k.adPotential && <Badge className="bg-blue-900 text-blue-300 text-xs">Ad</Badge>}
                      <Badge className={`text-xs ${k.opportunity === "high" ? "bg-green-900 text-green-300" : "bg-[#21262d] text-gray-400"}`}>{k.opportunity}</Badge>
                    </div>
                  </div>
                ))}
                {(context.data?.topKeywords || []).length === 0 && (
                  <p className="text-gray-400 text-sm text-center py-4">Run a cycle to populate keyword signals</p>
                )}
              </CardContent>
            </Card>

            <Card className="bg-[#161b22] border-[#21262d]">
              <CardHeader className="pb-2">
                <CardTitle className="text-white text-sm flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-orange-400" /> Technical Issues
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {(context.data?.technicalIssues || []).map((issue: string, i: number) => (
                  <div key={i} className="flex items-start gap-2 p-2 bg-orange-950/20 border border-orange-800/30 rounded">
                    <AlertTriangle className="w-3 h-3 text-orange-400 mt-0.5 flex-shrink-0" />
                    <p className="text-gray-300 text-xs">{issue}</p>
                  </div>
                ))}
                {(context.data?.technicalIssues || []).length === 0 && (
                  <p className="text-gray-400 text-sm text-center py-4">No technical issues detected</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Content Briefs Tab */}
        <TabsContent value="content" className="space-y-4 mt-4">
          <Card className="bg-[#161b22] border-[#21262d]">
            <CardHeader className="pb-2">
              <CardTitle className="text-white text-sm flex items-center gap-2">
                <FileText className="w-4 h-4 text-yellow-400" /> AI-Generated Content Briefs
              </CardTitle>
              <CardDescription className="text-gray-400 text-xs">
                Generated from SEO keyword gaps and trend signals
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {(context.data?.generatedBriefs || []).map((brief: any, i: number) => (
                <div key={i} className="p-3 bg-[#0d1117] border border-[#21262d] rounded-lg">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-white text-sm font-medium">{brief.title}</p>
                    <div className="flex gap-1 flex-shrink-0">
                      <Badge className={`text-xs ${brief.priority === "critical" ? "bg-red-900 text-red-300" : brief.priority === "high" ? "bg-orange-900 text-orange-300" : "bg-[#21262d] text-gray-400"}`}>{brief.priority}</Badge>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-2 flex-wrap">
                    <Badge className="bg-blue-900/40 text-blue-300 text-xs">{brief.platform}</Badge>
                    <Badge className="bg-[#21262d] text-gray-400 text-xs">{brief.persona}</Badge>
                    <Badge className="bg-[#21262d] text-gray-400 text-xs">{brief.angle}</Badge>
                    {brief.seoLinked && <Badge className="bg-green-900/40 text-green-300 text-xs">SEO-linked</Badge>}
                    {brief.adLinked && <Badge className="bg-purple-900/40 text-purple-300 text-xs">Ad-linked</Badge>}
                  </div>
                  {brief.targetKeywords?.length > 0 && (
                    <p className="text-gray-500 text-xs mt-1">Keywords: {brief.targetKeywords.join(", ")}</p>
                  )}
                </div>
              ))}
              {(context.data?.generatedBriefs || []).length === 0 && (
                <p className="text-gray-400 text-sm text-center py-4">Run a cycle to generate content briefs</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Ad Intelligence Tab */}
        <TabsContent value="advertising" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="bg-[#161b22] border-[#21262d]">
              <CardHeader className="pb-2">
                <CardTitle className="text-white text-sm flex items-center gap-2">
                  <Megaphone className="w-4 h-4 text-cyan-400" /> Channel Performance
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {(context.data?.topPerformingChannels || []).map((c: any, i: number) => (
                  <div key={i} className="p-2 bg-[#0d1117] border border-[#21262d] rounded">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <TrendIcon trend={c.trend} />
                        <p className="text-white text-xs font-medium capitalize">{c.channel}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Badge className={`text-xs ${c.recommendation === "scale" ? "bg-green-900 text-green-300" : c.recommendation === "reduce" ? "bg-red-900 text-red-300" : "bg-[#21262d] text-gray-400"}`}>{c.recommendation}</Badge>
                        <Badge className="bg-[#21262d] text-gray-300 text-xs">{c.roi}x ROI</Badge>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 mt-2">
                      <div className="text-center">
                        <p className="text-white text-xs font-medium">{c.impressions.toLocaleString()}</p>
                        <p className="text-gray-500 text-xs">Impressions</p>
                      </div>
                      <div className="text-center">
                        <p className="text-white text-xs font-medium">{c.conversions}</p>
                        <p className="text-gray-500 text-xs">Conversions</p>
                      </div>
                      <div className="text-center">
                        <p className="text-white text-xs font-medium">${c.cpa}</p>
                        <p className="text-gray-500 text-xs">CPA</p>
                      </div>
                    </div>
                  </div>
                ))}
                {(context.data?.topPerformingChannels || []).length === 0 && (
                  <p className="text-gray-400 text-sm text-center py-4">Run a cycle to populate channel data</p>
                )}
              </CardContent>
            </Card>

            <Card className="bg-[#161b22] border-[#21262d]">
              <CardHeader className="pb-2">
                <CardTitle className="text-white text-sm flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-purple-400" /> Budget Recommendations
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {(context.data?.budgetRecommendations || []).map((b: any, i: number) => (
                  <div key={i} className="p-2 bg-[#0d1117] border border-[#21262d] rounded">
                    <div className="flex items-center justify-between">
                      <p className="text-white text-xs font-medium capitalize">{b.channel}</p>
                      <div className="flex items-center gap-1 text-xs">
                        <span className="text-gray-400">{b.currentAllocation}%</span>
                        <ChevronRight className="w-3 h-3 text-gray-600" />
                        <span className={b.recommendedAllocation > b.currentAllocation ? "text-green-400" : "text-red-400"}>{b.recommendedAllocation}%</span>
                      </div>
                    </div>
                    <p className="text-gray-500 text-xs mt-1">{b.reason}</p>
                    {b.expectedRoiLift > 0 && (
                      <p className="text-green-400 text-xs mt-0.5">+{b.expectedRoiLift.toFixed(2)}x expected ROI lift</p>
                    )}
                  </div>
                ))}
                {(context.data?.budgetRecommendations || []).length === 0 && (
                  <p className="text-gray-400 text-sm text-center py-4">Run a cycle to generate budget recommendations</p>
                )}
              </CardContent>
            </Card>

            <Card className="bg-[#161b22] border-[#21262d] lg:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-white text-sm flex items-center gap-2">
                  <Eye className="w-4 h-4 text-orange-400" /> Competitor Gaps & Viral Patterns
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-gray-400 text-xs font-medium mb-2">COMPETITOR GAPS</p>
                  {(context.data?.competitorGaps || []).map((gap: string, i: number) => (
                    <div key={i} className="flex items-start gap-2 p-2 bg-orange-950/20 border border-orange-800/30 rounded mb-2">
                      <Target className="w-3 h-3 text-orange-400 mt-0.5 flex-shrink-0" />
                      <p className="text-gray-300 text-xs">{gap}</p>
                    </div>
                  ))}
                </div>
                <div>
                  <p className="text-gray-400 text-xs font-medium mb-2">VIRAL PATTERNS</p>
                  {(context.data?.viralPatterns || []).map((pattern: string, i: number) => (
                    <div key={i} className="flex items-start gap-2 p-2 bg-purple-950/20 border border-purple-800/30 rounded mb-2">
                      <Zap className="w-3 h-3 text-purple-400 mt-0.5 flex-shrink-0" />
                      <p className="text-gray-300 text-xs">{pattern}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Cross-System Insights Tab */}
        <TabsContent value="insights" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="bg-[#161b22] border-[#21262d]">
              <CardHeader className="pb-2">
                <CardTitle className="text-white text-sm flex items-center gap-2">
                  <Brain className="w-4 h-4 text-purple-400" /> Cross-System Intelligence
                </CardTitle>
                <CardDescription className="text-gray-400 text-xs">
                  Insights generated by synthesizing SEO, Content, and Advertising signals
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {(insights.data || []).map((insight: string, i: number) => (
                  <div key={i} className="flex items-start gap-2 p-3 bg-purple-950/20 border border-purple-800/30 rounded">
                    <Brain className="w-4 h-4 text-purple-400 mt-0.5 flex-shrink-0" />
                    <p className="text-gray-300 text-sm">{insight}</p>
                  </div>
                ))}
                {(insights.data || []).length === 0 && (
                  <p className="text-gray-400 text-sm text-center py-4">Run a cycle to generate cross-system insights</p>
                )}
              </CardContent>
            </Card>

            <Card className="bg-[#161b22] border-[#21262d]">
              <CardHeader className="pb-2">
                <CardTitle className="text-white text-sm flex items-center gap-2">
                  <ChevronRight className="w-4 h-4 text-yellow-400" /> Next Cycle Adjustments
                </CardTitle>
                <CardDescription className="text-gray-400 text-xs">
                  Actions queued for the next growth cycle
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {(adjustments.data || []).map((adj: string, i: number) => (
                  <div key={i} className="flex items-start gap-2 p-2 bg-yellow-950/20 border border-yellow-800/30 rounded">
                    <span className="w-5 h-5 rounded-full bg-yellow-900 text-yellow-300 text-xs flex items-center justify-center flex-shrink-0 font-bold">{i + 1}</span>
                    <p className="text-gray-300 text-xs">{adj}</p>
                  </div>
                ))}
                {(adjustments.data || []).length === 0 && (
                  <p className="text-gray-400 text-sm text-center py-4">Run a cycle to generate adjustments</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Anomalies Tab */}
        <TabsContent value="anomalies" className="space-y-4 mt-4">
          <Card className="bg-[#161b22] border-[#21262d]">
            <CardHeader className="pb-2">
              <CardTitle className="text-white text-sm flex items-center gap-2">
                <Shield className="w-4 h-4 text-red-400" /> Anomaly Detection Log
              </CardTitle>
              <CardDescription className="text-gray-400 text-xs">
                Automatic detection of metric drops &gt;20% week-over-week with AI diagnosis
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {(anomalies.data || []).length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto mb-3" />
                  <p className="text-white font-medium">No anomalies detected</p>
                  <p className="text-gray-400 text-sm">All systems performing within normal range</p>
                </div>
              ) : (anomalies.data || []).map((a: any) => (
                <div key={a.id} className={`p-3 rounded-lg border ${
                  a.autoResolved ? "bg-[#0d1117] border-[#21262d] opacity-60" :
                  a.severity === "critical" ? "bg-red-950/30 border-red-800/50" :
                  "bg-orange-950/30 border-orange-800/50"
                }`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2">
                      {a.autoResolved
                        ? <CheckCircle2 className="w-4 h-4 text-green-400 mt-0.5" />
                        : <AlertTriangle className={`w-4 h-4 mt-0.5 ${a.severity === "critical" ? "text-red-400" : "text-orange-400"}`} />
                      }
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-white text-sm font-medium">{a.metric} dropped {a.dropPercent}%</p>
                          <Badge className={`text-xs ${a.severity === "critical" ? "bg-red-900 text-red-300" : "bg-orange-900 text-orange-300"}`}>{a.severity}</Badge>
                          {a.autoResolved && <Badge className="bg-green-900 text-green-300 text-xs">Resolved</Badge>}
                        </div>
                        <p className="text-gray-400 text-xs mt-1">{a.diagnosis}</p>
                        <p className="text-gray-500 text-xs">{a.previousValue} → {a.currentValue} · {a.system}</p>
                        <div className="flex gap-1 mt-2 flex-wrap">
                          {a.recommendedActions?.map((action: string, i: number) => (
                            <Badge key={i} className="bg-[#21262d] text-gray-300 text-xs">{action}</Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                    {!a.autoResolved && (
                      <Button size="sm" variant="outline" className="border-[#21262d] text-gray-300 hover:bg-[#21262d] text-xs flex-shrink-0"
                        onClick={() => resolveAnomaly.mutate({ anomalyId: a.id })}>
                        Resolve
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Metrics History Tab */}
        <TabsContent value="history" className="space-y-4 mt-4">
          <Card className="bg-[#161b22] border-[#21262d]">
            <CardHeader className="pb-2">
              <CardTitle className="text-white text-sm flex items-center gap-2">
                <Activity className="w-4 h-4 text-cyan-400" /> Growth Metrics History
              </CardTitle>
            </CardHeader>
            <CardContent>
              {(metricsHistory.data || []).length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-4">No historical data yet — run multiple cycles to build history</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-[#21262d]">
                        {["Week", "Organic Traffic", "Content Published", "Quality Score", "Ad Impressions", "Conversions", "ROI", "Growth Score"].map(h => (
                          <th key={h} className="text-gray-400 font-medium text-left py-2 px-2">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(metricsHistory.data || []).map((m: any, i: number) => (
                        <tr key={i} className="border-b border-[#21262d]/50 hover:bg-[#0d1117]">
                          <td className="py-2 px-2 text-gray-300">W{m.week} {m.year}</td>
                          <td className="py-2 px-2 text-white">{m.organicTrafficIndex.toLocaleString()}</td>
                          <td className="py-2 px-2 text-white">{m.contentPiecesPublished}</td>
                          <td className="py-2 px-2 text-white">{m.avgContentQualityScore}/100</td>
                          <td className="py-2 px-2 text-white">{m.adImpressions.toLocaleString()}</td>
                          <td className="py-2 px-2 text-white">{m.adConversions}</td>
                          <td className="py-2 px-2 text-white">{m.adRoi.toFixed(1)}x</td>
                          <td className="py-2 px-2">
                            <span className={`font-bold ${m.overallGrowthScore >= 80 ? "text-green-400" : m.overallGrowthScore >= 60 ? "text-yellow-400" : "text-red-400"}`}>
                              {m.overallGrowthScore}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
