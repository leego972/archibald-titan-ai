import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { useLocation } from "wouter";
import {
  Activity, Shield, Globe, TrendingUp, Users, Server, Database,
  Zap, RefreshCw, AlertTriangle, CheckCircle2, XCircle, Clock,
  ArrowRight, Eye, Play, BarChart2, Target, Lock, Wifi, WifiOff,
  Loader2, Cpu, HardDrive, DollarSign, FileText, Search
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
type EngineStatus = "online" | "running" | "idle" | "error" | "offline";

interface EngineCard {
  id: string;
  name: string;
  icon: React.ReactNode;
  path: string;
  color: string;
  category: "security" | "growth" | "infrastructure" | "intelligence";
}

// ─── Engine Registry ──────────────────────────────────────────────────────────
const ENGINES: EngineCard[] = [
  // Security
  { id: "argus", name: "Argus OSINT", icon: <Search className="w-4 h-4" />, path: "/argus", color: "blue", category: "security" },
  { id: "astra", name: "Astra Scanner", icon: <Target className="w-4 h-4" />, path: "/astra", color: "orange", category: "security" },
  { id: "cybermcp", name: "CyberMCP", icon: <Shield className="w-4 h-4" />, path: "/cybermcp", color: "red", category: "security" },
  { id: "isolatedBrowser", name: "Isolated Browser", icon: <Globe className="w-4 h-4" />, path: "/isolated-browser", color: "purple", category: "security" },
  { id: "redTeamPlaybooks", name: "Red Team", icon: <Target className="w-4 h-4" />, path: "/red-team-playbooks", color: "red", category: "security" },
  // Growth
  { id: "advertising", name: "Advertising", icon: <BarChart2 className="w-4 h-4" />, path: "/advertising", color: "yellow", category: "growth" },
  { id: "affiliate", name: "Affiliate", icon: <Users className="w-4 h-4" />, path: "/affiliate", color: "green", category: "growth" },
  { id: "marketing", name: "Marketing", icon: <TrendingUp className="w-4 h-4" />, path: "/marketing", color: "blue", category: "growth" },
  { id: "contentCreator", name: "Content Creator", icon: <FileText className="w-4 h-4" />, path: "/content-creator", color: "pink", category: "growth" },
  { id: "seo", name: "SEO Engine", icon: <Search className="w-4 h-4" />, path: "/seo", color: "teal", category: "growth" },
  // Infrastructure
  { id: "titanStorage", name: "Titan Storage", icon: <HardDrive className="w-4 h-4" />, path: "/storage", color: "gray", category: "infrastructure" },
  { id: "siteMonitor", name: "Site Monitor", icon: <Activity className="w-4 h-4" />, path: "/site-monitor", color: "green", category: "infrastructure" },
  { id: "tor", name: "Tor Network", icon: <Lock className="w-4 h-4" />, path: "/tor", color: "purple", category: "infrastructure" },
  { id: "vpnChain", name: "VPN Chain", icon: <Wifi className="w-4 h-4" />, path: "/vpn-chain", color: "blue", category: "infrastructure" },
];

const STATUS_CONFIG: Record<EngineStatus, { color: string; bg: string; label: string; icon: React.ReactNode }> = {
  online:  { color: "text-green-400",  bg: "bg-green-400",  label: "Online",  icon: <CheckCircle2 className="w-3 h-3" /> },
  running: { color: "text-blue-400",   bg: "bg-blue-400",   label: "Running", icon: <Loader2 className="w-3 h-3 animate-spin" /> },
  idle:    { color: "text-gray-400",   bg: "bg-gray-400",   label: "Idle",    icon: <Clock className="w-3 h-3" /> },
  error:   { color: "text-red-400",    bg: "bg-red-400",    label: "Error",   icon: <XCircle className="w-3 h-3" /> },
  offline: { color: "text-gray-500",   bg: "bg-gray-600",   label: "Offline", icon: <WifiOff className="w-3 h-3" /> },
};

const COLOR_MAP: Record<string, string> = {
  blue: "border-blue-500/30 bg-blue-500/5",
  orange: "border-orange-500/30 bg-orange-500/5",
  red: "border-red-500/30 bg-red-500/5",
  purple: "border-purple-500/30 bg-purple-500/5",
  yellow: "border-yellow-500/30 bg-yellow-500/5",
  green: "border-green-500/30 bg-green-500/5",
  pink: "border-pink-500/30 bg-pink-500/5",
  teal: "border-teal-500/30 bg-teal-500/5",
  gray: "border-gray-500/30 bg-gray-500/5",
};

// ─── Component ────────────────────────────────────────────────────────────────
export default function CommandCentrePage() {
  const [, setLocation] = useLocation();
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  // ── Data Queries ───────────────────────────────────────────────────────────
  const { data: credits, refetch: refetchCredits } = trpc.credits.getBalance.useQuery(undefined, {
    refetchInterval: 30000,
  });

  const { data: argusStatus } = trpc.argus.getStatus.useQuery(undefined, {
    refetchInterval: 15000,
    retry: false,
  });

  const { data: astraStatus } = trpc.astra.getStatus.useQuery(undefined, {
    refetchInterval: 15000,
    retry: false,
  });

  const { data: storageStats } = trpc.titanStorage.getStats.useQuery(undefined, {
    refetchInterval: 30000,
    retry: false,
  });

  const { data: siteMonitorStats } = trpc.siteMonitor.getDashboardStats.useQuery(undefined, {
    refetchInterval: 15000,
    retry: false,
  });

  const { data: affiliateStats } = trpc.affiliate.getStats.useQuery(undefined, {
    refetchInterval: 30000,
    retry: false,
  });

  const { data: contentCreatorStats } = trpc.contentCreator.getStats.useQuery(undefined, {
    refetchInterval: 30000,
    retry: false,
  });

  const { data: redTeamRuns } = trpc.redTeamPlaybooks.listRuns.useQuery(
    { limit: 5 },
    { refetchInterval: 10000, retry: false }
  );

  // ── Derived Status ─────────────────────────────────────────────────────────
  const getEngineStatus = (id: string): EngineStatus => {
    switch (id) {
      case "argus":
        if (!argusStatus) return "offline";
        return (argusStatus as any).activeScans > 0 ? "running" : "idle";
      case "astra":
        if (!astraStatus) return "offline";
        return (astraStatus as any).activeScans > 0 ? "running" : "idle";
      case "siteMonitor":
        if (!siteMonitorStats) return "offline";
        return (siteMonitorStats as any).totalSites > 0 ? "online" : "idle";
      case "titanStorage":
        if (!storageStats) return "offline";
        return "online";
      case "affiliate":
        if (!affiliateStats) return "offline";
        return "online";
      case "contentCreator":
        if (!contentCreatorStats) return "offline";
        return "online";
      case "redTeamPlaybooks":
        if (!redTeamRuns) return "offline";
        return (redTeamRuns.runs ?? []).some((r: any) => r.status === "running") ? "running" : "idle";
      default:
        return "idle";
    }
  };

  const getEngineMetric = (id: string): string | null => {
    switch (id) {
      case "argus":
        return argusStatus ? `${(argusStatus as any).totalScans ?? 0} scans` : null;
      case "astra":
        return astraStatus ? `${(astraStatus as any).totalAlerts ?? 0} alerts` : null;
      case "siteMonitor":
        return siteMonitorStats ? `${(siteMonitorStats as any).totalSites ?? 0} sites` : null;
      case "titanStorage":
        if (!storageStats) return null;
        const gb = ((storageStats as any).usedBytes ?? 0) / (1024 ** 3);
        return `${gb.toFixed(1)} GB used`;
      case "affiliate":
        return affiliateStats ? `${(affiliateStats as any).totalPartners ?? 0} partners` : null;
      case "contentCreator":
        return contentCreatorStats ? `${(contentCreatorStats as any).totalPieces ?? 0} pieces` : null;
      case "redTeamPlaybooks":
        return redTeamRuns ? `${redTeamRuns.runs?.length ?? 0} runs` : null;
      default:
        return null;
    }
  };

  // ── Summary Stats ──────────────────────────────────────────────────────────
  const onlineCount = ENGINES.filter((e) => {
    const s = getEngineStatus(e.id);
    return s === "online" || s === "running";
  }).length;

  const runningCount = ENGINES.filter((e) => getEngineStatus(e.id) === "running").length;

  const siteAlerts = (siteMonitorStats as any)?.sitesDown ?? 0;
  const astraAlerts = (astraStatus as any)?.criticalAlerts ?? 0;
  const totalAlerts = siteAlerts + astraAlerts;

  const filteredEngines = categoryFilter === "all"
    ? ENGINES
    : ENGINES.filter((e) => e.category === categoryFilter);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="border-b border-border px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 rounded-lg border border-blue-500/20">
              <Cpu className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h1 className="text-lg font-semibold">Command Centre</h1>
              <p className="text-sm text-muted-foreground">Unified real-time status across all Titan engines</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Credits */}
            {credits && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-muted/50 rounded-lg border border-border">
                <Zap className="w-3.5 h-3.5 text-yellow-400" />
                <span className="text-sm font-mono">
                  {((credits as any).balance ?? 0).toLocaleString()} credits
                </span>
              </div>
            )}
            <Button variant="outline" size="sm" onClick={() => refetchCredits()}>
              <RefreshCw className="w-4 h-4 mr-1" />
              Refresh
            </Button>
          </div>
        </div>

        {/* Summary Row */}
        <div className="flex items-center gap-6 mt-4">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-sm text-muted-foreground">
              <span className="text-foreground font-medium">{onlineCount}</span> / {ENGINES.length} engines active
            </span>
          </div>
          {runningCount > 0 && (
            <div className="flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 text-blue-400 animate-spin" />
              <span className="text-sm text-blue-400">{runningCount} running</span>
            </div>
          )}
          {totalAlerts > 0 && (
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-3.5 h-3.5 text-orange-400" />
              <span className="text-sm text-orange-400">{totalAlerts} alert{totalAlerts > 1 ? "s" : ""}</span>
            </div>
          )}
        </div>
      </div>

      {/* Category Filter */}
      <div className="px-6 py-3 border-b border-border flex items-center gap-2">
        {["all", "security", "growth", "infrastructure"].map((cat) => (
          <button
            key={cat}
            onClick={() => setCategoryFilter(cat)}
            className={`text-sm px-3 py-1 rounded-full capitalize transition-colors ${
              categoryFilter === cat
                ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                : "text-muted-foreground hover:text-foreground border border-transparent hover:border-border"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      <ScrollArea className="flex-1">
        <div className="p-6 space-y-8">

          {/* ── Engine Grid ─────────────────────────────────────────────────── */}
          <div>
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">
              Engine Status
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {filteredEngines.map((engine) => {
                const status = getEngineStatus(engine.id);
                const metric = getEngineMetric(engine.id);
                const statusCfg = STATUS_CONFIG[status];
                return (
                  <button
                    key={engine.id}
                    onClick={() => setLocation(engine.path)}
                    className={`p-4 rounded-xl border text-left transition-all hover:scale-[1.02] hover:shadow-lg group ${COLOR_MAP[engine.color] ?? "border-border bg-muted/20"}`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="p-1.5 rounded-lg bg-background/50">
                        {engine.icon}
                      </div>
                      <div className={`flex items-center gap-1 ${statusCfg.color}`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${statusCfg.bg} ${status === "running" ? "animate-pulse" : ""}`} />
                        <span className="text-xs">{statusCfg.label}</span>
                      </div>
                    </div>
                    <div className="text-sm font-medium mb-1">{engine.name}</div>
                    {metric && (
                      <div className="text-xs text-muted-foreground">{metric}</div>
                    )}
                    <div className="flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="text-xs text-muted-foreground">Open</span>
                      <ArrowRight className="w-3 h-3 text-muted-foreground" />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Key Metrics Row ──────────────────────────────────────────────── */}
          <div>
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">
              Key Metrics
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {/* Site Monitor */}
              <Card className="border-border">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-muted-foreground">Sites Monitored</span>
                    <Activity className="w-4 h-4 text-green-400" />
                  </div>
                  <div className="text-2xl font-bold">
                    {siteMonitorStats ? (siteMonitorStats as any).totalSites ?? 0 : "—"}
                  </div>
                  {siteMonitorStats && (siteMonitorStats as any).sitesDown > 0 && (
                    <div className="text-xs text-red-400 mt-1">
                      {(siteMonitorStats as any).sitesDown} down
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Astra Alerts */}
              <Card className="border-border">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-muted-foreground">Security Alerts</span>
                    <AlertTriangle className="w-4 h-4 text-orange-400" />
                  </div>
                  <div className="text-2xl font-bold">
                    {astraStatus ? (astraStatus as any).totalAlerts ?? 0 : "—"}
                  </div>
                  {astraStatus && (astraStatus as any).criticalAlerts > 0 && (
                    <div className="text-xs text-red-400 mt-1">
                      {(astraStatus as any).criticalAlerts} critical
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Storage */}
              <Card className="border-border">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-muted-foreground">Storage Used</span>
                    <HardDrive className="w-4 h-4 text-gray-400" />
                  </div>
                  {storageStats ? (
                    <>
                      <div className="text-2xl font-bold">
                        {(((storageStats as any).usedBytes ?? 0) / (1024 ** 3)).toFixed(1)} GB
                      </div>
                      <Progress
                        value={Math.min(100, (((storageStats as any).usedBytes ?? 0) / Math.max(1, (storageStats as any).quotaBytes ?? 1)) * 100)}
                        className="h-1 mt-2"
                      />
                    </>
                  ) : (
                    <div className="text-2xl font-bold">—</div>
                  )}
                </CardContent>
              </Card>

              {/* Credits */}
              <Card className="border-border">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-muted-foreground">Credits Balance</span>
                    <Zap className="w-4 h-4 text-yellow-400" />
                  </div>
                  <div className="text-2xl font-bold">
                    {credits ? ((credits as any).balance ?? 0).toLocaleString() : "—"}
                  </div>
                  <button
                    className="text-xs text-blue-400 hover:text-blue-300 mt-1"
                    onClick={() => setLocation("/dashboard/credits")}
                  >
                    Top up →
                  </button>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* ── Recent Red Team Runs ─────────────────────────────────────────── */}
          {redTeamRuns && (redTeamRuns.runs ?? []).length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                  Recent Red Team Runs
                </h2>
                <button
                  className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
                  onClick={() => setLocation("/red-team-playbooks")}
                >
                  View all <ArrowRight className="w-3 h-3" />
                </button>
              </div>
              <div className="space-y-2">
                {(redTeamRuns.runs ?? []).slice(0, 5).map((run: any) => (
                  <div
                    key={run.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-border hover:border-red-500/30 cursor-pointer transition-colors"
                    onClick={() => setLocation("/red-team-playbooks")}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${
                        run.status === "running" ? "bg-blue-400 animate-pulse" :
                        run.status === "completed" ? "bg-green-400" :
                        run.status === "failed" ? "bg-red-400" : "bg-gray-400"
                      }`} />
                      <div>
                        <span className="text-sm font-medium">{run.playbookName}</span>
                        <span className="text-muted-foreground mx-2">→</span>
                        <span className="text-sm font-mono text-muted-foreground">{run.target}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {run.findings?.length > 0 && (
                        <Badge variant="outline" className="text-xs text-orange-400 border-orange-500/30">
                          {run.findings.length} findings
                        </Badge>
                      )}
                      <span className={`text-xs capitalize ${
                        run.status === "running" ? "text-blue-400" :
                        run.status === "completed" ? "text-green-400" :
                        run.status === "failed" ? "text-red-400" : "text-gray-400"
                      }`}>
                        {run.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Quick Actions ────────────────────────────────────────────────── */}
          <div>
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">
              Quick Actions
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: "New OSINT Scan", icon: <Search className="w-4 h-4" />, path: "/argus", color: "blue" },
                { label: "Vulnerability Scan", icon: <Target className="w-4 h-4" />, path: "/astra", color: "orange" },
                { label: "Launch Playbook", icon: <Play className="w-4 h-4" />, path: "/red-team-playbooks", color: "red" },
                { label: "View Attack Graph", icon: <Eye className="w-4 h-4" />, path: "/attack-graph", color: "purple" },
                { label: "Run Marketing Cycle", icon: <TrendingUp className="w-4 h-4" />, path: "/marketing", color: "green" },
                { label: "Content Generation", icon: <FileText className="w-4 h-4" />, path: "/content-creator", color: "pink" },
                { label: "Check Sites", icon: <Activity className="w-4 h-4" />, path: "/site-monitor", color: "teal" },
                { label: "Builder Chat", icon: <Zap className="w-4 h-4" />, path: "/dashboard", color: "yellow" },
              ].map((action) => (
                <button
                  key={action.label}
                  onClick={() => setLocation(action.path)}
                  className="flex items-center gap-2.5 p-3 rounded-lg border border-border hover:border-blue-500/30 hover:bg-blue-500/5 transition-all text-left group"
                >
                  <div className="p-1.5 rounded bg-muted group-hover:bg-blue-500/10 transition-colors">
                    {action.icon}
                  </div>
                  <span className="text-sm">{action.label}</span>
                </button>
              ))}
            </div>
          </div>

        </div>
      </ScrollArea>
    </div>
  );
}
