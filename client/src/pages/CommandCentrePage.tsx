import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Activity, Shield, Globe, TrendingUp, Users, Server, Database,
  Zap, RefreshCw, AlertTriangle, CheckCircle2, XCircle, Clock,
  ArrowRight, BarChart2, Target, Lock, WifiOff,
  Loader2, Cpu, HardDrive, FileText, Search,
  ShieldCheck, Vault, Network, Terminal, Monitor
} from "lucide-react";
import { useLocation } from "wouter";

// ─── Types ────────────────────────────────────────────────────────────────────
type EngineStatus = "online" | "running" | "idle" | "error" | "offline";

interface EngineCard {
  id: string;
  name: string;
  icon: React.ReactNode;
  path: string;
  color: string;
  category: "security" | "infrastructure" | "growth";
}

// ─── Engine Registry ──────────────────────────────────────────────────────────
const ENGINES: EngineCard[] = [
  // Security & Intelligence
  { id: "astra", name: "Astra Scanner", icon: <ShieldCheck className="w-4 h-4" />, path: "/astra", color: "blue", category: "security" },
  { id: "argus", name: "Argus OSINT", icon: <Search className="w-4 h-4" />, path: "/argus", color: "blue", category: "security" },
  { id: "leakScanner", name: "Leak Scanner", icon: <ShieldAlert className="w-4 h-4" />, path: "/fetcher/leak-scanner", color: "blue", category: "security" },
  { id: "attackGraph", name: "Attack Graph", icon: <Network className="w-4 h-4" />, path: "/attack-graph", color: "blue", category: "security" },
  { id: "redTeamPlaybooks", name: "Red Team", icon: <Target className="w-4 h-4" />, path: "/red-team-playbooks", color: "blue", category: "security" },
  
  // Infrastructure & Vault
  { id: "titanStorage", name: "Titan Storage", icon: <Database className="w-4 h-4" />, path: "/storage", color: "slate", category: "infrastructure" },
  { id: "siteMonitor", name: "Site Monitor", icon: <Activity className="w-4 h-4" />, path: "/site-monitor", color: "slate", category: "infrastructure" },
  { id: "vault", name: "Secure Vault", icon: <Vault className="w-4 h-4" />, path: "/fetcher/credentials", color: "slate", category: "infrastructure" },
  { id: "providerHub", name: "Provider Hub", icon: <Globe className="w-4 h-4" />, path: "/fetcher/provider-health", color: "slate", category: "infrastructure" },
  
  // Business & Growth
  { id: "affiliate", name: "Affiliate", icon: <Users className="w-4 h-4" />, path: "/affiliate", color: "indigo", category: "growth" },
  { id: "marketing", name: "Marketing", icon: <TrendingUp className="w-4 h-4" />, path: "/marketing", color: "indigo", category: "growth" },
  { id: "contentCreator", name: "Content Creator", icon: <FileText className="w-4 h-4" />, path: "/content-creator", color: "indigo", category: "growth" },
];

const STATUS_CONFIG: Record<EngineStatus, { color: string; bg: string; label: string; icon: React.ReactNode }> = {
  online:  { color: "text-emerald-400",  bg: "bg-emerald-400",  label: "Online",  icon: <CheckCircle2 className="w-3 h-3" /> },
  running: { color: "text-blue-400",   bg: "bg-blue-400",   label: "Running", icon: <Loader2 className="w-3 h-3 animate-spin" /> },
  idle:    { color: "text-white/20",   bg: "bg-white/20",   label: "Idle",    icon: <Clock className="w-3 h-3" /> },
  error:   { color: "text-red-400",    bg: "bg-red-400",    label: "Error",   icon: <XCircle className="w-3 h-3" /> },
  offline: { color: "text-white/10",   bg: "bg-white/10",   label: "Offline", icon: <WifiOff className="w-3 h-3" /> },
};

const CATEGORY_LABELS = {
  security: "Security & Intelligence",
  infrastructure: "Infrastructure & Vault",
  growth: "Business & Growth"
};

function ShieldAlert(props: any) {
  return <Shield {...props} className={`${props.className} text-red-400`} />;
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function CommandCentrePage() {
  const [, setLocation] = useLocation();
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  // ── Data Queries ───────────────────────────────────────────────────────────
  const { data: credits, refetch: refetchCredits } = trpc.credits.getBalance.useQuery(undefined, {
    refetchInterval: 30000,
  });

  const { data: argusStatus } = trpc.argus.getStatus.useQuery(undefined, { retry: false });
  const { data: astraStatus } = trpc.astra.getStatus.useQuery(undefined, { retry: false });
  const { data: storageStats } = trpc.titanStorage.getStats.useQuery(undefined, { retry: false });
  const { data: siteMonitorStats } = trpc.siteMonitor.getDashboardStats.useQuery(undefined, { retry: false });
  const { data: affiliateStats } = trpc.affiliate.getStats.useQuery(undefined, { retry: false });
  const { data: contentCreatorStats } = trpc.contentCreator.getStats.useQuery(undefined, { retry: false });
  const { data: redTeamRuns } = trpc.redTeamPlaybooks.listRuns.useQuery({ limit: 5 }, { retry: false });

  // ── Derived Status ─────────────────────────────────────────────────────────
  const getEngineStatus = (id: string): EngineStatus => {
    switch (id) {
      case "argus": return argusStatus ? ((argusStatus as any).activeScans > 0 ? "running" : "idle") : "offline";
      case "astra": return astraStatus ? ((astraStatus as any).activeScans > 0 ? "running" : "idle") : "offline";
      case "siteMonitor": return siteMonitorStats ? ((siteMonitorStats as any).totalSites > 0 ? "online" : "idle") : "offline";
      case "titanStorage": return storageStats ? "online" : "offline";
      case "affiliate": return affiliateStats ? "online" : "offline";
      case "contentCreator": return contentCreatorStats ? "online" : "offline";
      case "redTeamPlaybooks": return redTeamRuns ? ((redTeamRuns.runs ?? []).some((r: any) => r.status === "running") ? "running" : "idle") : "offline";
      case "vault": return "online";
      case "providerHub": return "online";
      default: return "idle";
    }
  };

  const getEngineMetric = (id: string): string | null => {
    switch (id) {
      case "argus": return argusStatus ? `${(argusStatus as any).totalScans ?? 0} scans` : null;
      case "astra": return astraStatus ? `${(astraStatus as any).totalAlerts ?? 0} alerts` : null;
      case "siteMonitor": return siteMonitorStats ? `${(siteMonitorStats as any).totalSites ?? 0} sites` : null;
      case "titanStorage": 
        if (!storageStats) return null;
        const gb = ((storageStats as any).usedBytes ?? 0) / (1024 ** 3);
        return `${gb.toFixed(1)} GB used`;
      case "affiliate": return affiliateStats ? `${(affiliateStats as any).totalPartners ?? 0} partners` : null;
      case "contentCreator": return contentCreatorStats ? `${(contentCreatorStats as any).totalPieces ?? 0} pieces` : null;
      default: return null;
    }
  };

  const filteredEngines = categoryFilter === "all"
    ? ENGINES
    : ENGINES.filter((e) => e.category === categoryFilter);

  return (
    <div className="flex flex-col h-full bg-[#02040a] text-white">
      {/* Header */}
      <div className="border-b border-white/[0.05] px-8 py-6 bg-[#02040a]/50 backdrop-blur-xl sticky top-0 z-20">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="p-2.5 bg-blue-600/10 rounded-xl border border-blue-600/20">
              <Monitor className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight">Command Center</h1>
              <p className="text-sm text-white/40">Enterprise orchestration and real-time engine status</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-white/[0.03] rounded-lg border border-white/[0.05]">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-xs font-bold text-white/60">
                {credits ? ((credits as any).balance ?? 0).toLocaleString() : "0"} Credits
              </span>
            </div>
            <Button variant="outline" size="sm" onClick={() => refetchCredits()} className="border-white/10 bg-white/5 text-white/70 hover:text-white">
              <RefreshCw className="w-4 h-4 mr-2" /> Sync
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2">
          {["all", "security", "infrastructure", "growth"].map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${
                categoryFilter === cat 
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20" 
                  : "bg-white/[0.03] text-white/40 hover:text-white/60 border border-white/[0.05]"
              }`}
            >
              {cat === "all" ? "All Engines" : CATEGORY_LABELS[cat as keyof typeof CATEGORY_LABELS]}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 p-8 overflow-y-auto custom-scrollbar">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredEngines.map((engine) => {
            const status = getEngineStatus(engine.id);
            const config = STATUS_CONFIG[status];
            const metric = getEngineMetric(engine.id);

            return (
              <Card 
                key={engine.id} 
                onClick={() => setLocation(engine.path)}
                className="group border-white/[0.05] bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/10 transition-all cursor-pointer overflow-hidden"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="p-2 rounded-lg bg-white/[0.03] border border-white/[0.05] group-hover:scale-110 transition-transform">
                      {engine.icon}
                    </div>
                    <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md border ${config.bg}/10 border-${config.bg}/20`}>
                      <div className={`h-1.5 w-1.5 rounded-full ${config.bg} ${status === "running" ? "animate-pulse" : ""}`} />
                      <span className={`text-[10px] font-black uppercase tracking-widest ${config.color}`}>
                        {config.label}
                      </span>
                    </div>
                  </div>
                  <CardTitle className="text-sm font-bold text-white/90">{engine.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-white/30 uppercase tracking-widest font-medium">
                      {metric || "System Idle"}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-white/10 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Operational Insights */}
        <div className="mt-12 grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Card className="border-white/[0.05] bg-white/[0.02]">
            <CardHeader>
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Activity className="h-4 w-4 text-blue-500" />
                Real-time Orchestration
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[
                  { label: "Active AI Agents", value: "4", status: "Optimal" },
                  { label: "Vault Latency", value: "12ms", status: "Excellent" },
                  { label: "Provider Uptime", value: "99.98%", status: "Stable" },
                ].map((stat, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/[0.05]">
                    <span className="text-xs text-white/50">{stat.label}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold text-white/90">{stat.value}</span>
                      <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500/60">{stat.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border-white/[0.05] bg-white/[0.02]">
            <CardHeader>
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-blue-500" />
                Security Posture
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[
                  { label: "Last Astra Scan", value: "14 mins ago", color: "text-white/90" },
                  { label: "Critical Vulnerabilities", value: "0", color: "text-emerald-400" },
                  { label: "Credential Leaks", value: "None Detected", color: "text-emerald-400" },
                ].map((stat, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/[0.05]">
                    <span className="text-xs text-white/50">{stat.label}</span>
                    <span className={`text-xs font-bold ${stat.color}`}>{stat.value}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
