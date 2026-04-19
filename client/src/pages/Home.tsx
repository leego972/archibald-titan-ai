import { useAuth } from "@/_core/hooks/useAuth";
  import { Button } from "@/components/ui/button";
  import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
  } from "@/components/ui/card";
  import { UsageBar } from "@/components/UpgradePrompt";
  import { useSubscription } from "@/hooks/useSubscription";
  import { getLoginUrl } from "@/const";
  import { trpc } from "@/lib/trpc";
  import {
    KeyRound,
    Shield,
    Zap,
    ArrowRight,
    Activity,
    Server,
    Settings2,
    CheckCircle2,
    AlertTriangle,
    AlertCircle,
    Clock,
    RefreshCw,
    Terminal,
    ShieldCheck,
    Search,
    Vault,
    Database,
    Workflow,
    Globe2,
    Boxes,
    LayoutDashboard,
    Cpu,
    Layers,
    Fingerprint,
    Network,
    Monitor,
    Radar,
    Crosshair,
    Fish,
    Bug,
    ScanSearch,
  } from "lucide-react";
  import { useLocation, Link } from "wouter";

  function relativeTime(dateStr: string | Date): string {
    const date = typeof dateStr === "string" ? new Date(dateStr) : dateStr;
    const diff = Date.now() - date.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  }

  function actionLabel(changeType: string): string {
    const map: Record<string, string> = {
      manual_update: "Credential Updated",
      rotation: "Key Rotated",
      created: "Credential Added",
      auto_rotate: "Auto-Rotated",
      expired: "Key Expired",
      revoked: "Key Revoked",
      manual_note: "Snapshot Saved",
      bulk_sync: "Bulk Sync",
      import: "Credential Imported",
    };
    return map[changeType] ?? changeType.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
  }

  function UsageStatsWidget({ sub }: { sub: any }) {
    const stats = [
      {
        label: "Fetches This Month",
        icon: Activity,
        value: sub.fetchesUsed,
        limit: sub.fetchesLimit,
        color: "from-blue-600/10 to-blue-600/5",
        iconColor: "text-blue-400",
      },
      {
        label: "Credentials Stored",
        icon: KeyRound,
        value: sub.credentialsStored,
        limit: sub.credentialsRemaining === -1 ? -1 : sub.credentialsStored + sub.credentialsRemaining,
        color: "from-emerald-600/10 to-emerald-600/5",
        iconColor: "text-emerald-400",
      },
      {
        label: "Proxy Slots",
        icon: Server,
        value: sub.proxySlotsUsed,
        limit: sub.proxySlotLimit,
        color: "from-violet-600/10 to-violet-600/5",
        iconColor: "text-violet-400",
      },
      {
        label: "Storage Used",
        icon: Database,
        value: sub.storageUsedMb != null ? `${(sub.storageUsedMb / 1024).toFixed(1)} GB` : "—",
        limit: sub.storageLimitGb != null ? `${sub.storageLimitGb} GB` : "10 GB",
        color: "from-amber-600/10 to-amber-600/5",
        iconColor: "text-amber-400",
      },
    ];

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        {stats.map((stat) => (
          <Card key={stat.label} className="relative overflow-hidden border-white/[0.05] bg-white/[0.01] hover:bg-white/[0.02] transition-all">
            <div className={`absolute inset-0 bg-gradient-to-br ${stat.color} opacity-20`} />
            <CardHeader className="pb-2 relative">
              <div className="flex items-center justify-between">
                <CardDescription className="text-[9px] font-black uppercase tracking-[0.2em] text-white/20">
                  {stat.label}
                </CardDescription>
                <stat.icon className={`h-3.5 w-3.5 ${stat.iconColor} opacity-40`} />
              </div>
            </CardHeader>
            <CardContent className="relative">
              <div className="text-2xl font-black text-white/90 tracking-tight">
                {stat.value}
                {typeof stat.limit === "number" && stat.limit !== -1 && (
                  <span className="text-xs font-bold text-white/10 ml-1">
                    {" / " + stat.limit}
                  </span>
                )}
                {stat.limit === -1 && <span className="text-xs font-bold text-white/10 ml-1"> / ∞</span>}
              </div>
              {typeof stat.limit === "number" && (
                <UsageBar label="" used={stat.value} limit={stat.limit} className="mt-4 h-1 bg-white/5" />
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  function QuickActions() {
    const actions = [
      { icon: Terminal,    label: "Titan AI",         desc: "Open AI orchestration assistant",   path: "/dashboard",         color: "text-blue-400" },
      { icon: Radar,       label: "Argus Recon",      desc: "Run OSINT & reconnaissance scan",    path: "/argus",             color: "text-cyan-400" },
      { icon: Bug,         label: "Astra Scan",       desc: "Launch vulnerability scanner",       path: "/astra",             color: "text-emerald-400" },
      { icon: Crosshair,   label: "Metasploit",       desc: "Exploitation framework console",     path: "/metasploit",        color: "text-red-400" },
      { icon: Fish,        label: "EvilGinx",         desc: "Phishing campaign manager",          path: "/evilginx",          color: "text-orange-400" },
      { icon: Network,     label: "VPN Chain",        desc: "Multi-hop VPN routing setup",        path: "/vpn-chain",         color: "text-violet-400" },
      { icon: Vault,       label: "Vault",            desc: "Manage & rotate credentials",        path: "/fetcher/credentials", color: "text-purple-400" },
      { icon: Boxes,       label: "Marketplace",      desc: "Browse & purchase cyber modules",    path: "/marketplace",       color: "text-amber-400" },
    ];

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-10">
        {actions.map((action) => (
          <Link key={action.label} href={action.path}>
            <div className="group p-4 rounded-xl border border-white/[0.05] bg-white/[0.01] hover:bg-white/[0.03] hover:border-white/10 transition-all cursor-pointer flex items-center gap-4">
              <div className="h-10 w-10 rounded-lg bg-white/[0.02] border border-white/[0.05] flex items-center justify-center group-hover:scale-105 transition-transform shrink-0">
                <action.icon className={`h-4 w-4 ${action.color} opacity-80`} />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-bold text-white/80">{action.label}</h4>
                <p className="text-[10px] text-white/30 font-medium truncate">{action.desc}</p>
              </div>
              <ArrowRight className="h-3.5 w-3.5 text-white/10 group-hover:text-white/40 group-hover:translate-x-1 transition-all shrink-0" />
            </div>
          </Link>
        ))}
      </div>
    );
  }

  function RecentActivity() {
    const historyQuery = trpc.credentialHistory.listAll.useQuery({ limit: 6 }, { retry: false });
    const items = historyQuery.data ?? [];

    return (
      <Card className="border-white/[0.05] bg-white/[0.01] overflow-hidden">
        <CardContent className="p-0">
          {historyQuery.isLoading ? (
            <div className="flex items-center justify-center py-12 text-white/20 text-sm">
              <Activity className="h-4 w-4 mr-2 animate-spin" />
              Loading activity…
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <Clock className="h-6 w-6 text-white/10" />
              <p className="text-xs text-white/20 font-medium">No recent activity — start by adding credentials or running a scan</p>
            </div>
          ) : (
            <div className="divide-y divide-white/[0.05]">
              {items.map((item: any, i: number) => (
                <div key={i} className="flex items-center justify-between p-5 hover:bg-white/[0.01] transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="h-9 w-9 rounded-lg bg-white/[0.02] border border-white/[0.05] flex items-center justify-center shrink-0">
                      <KeyRound className="h-4 w-4 text-white/20" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white/80">{actionLabel(item.changeType)}</p>
                      <p className="text-[10px] text-white/20 uppercase tracking-widest font-black">
                        {item.keyType ?? item.providerId ?? "credential"}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[11px] font-bold text-emerald-400/80">Recorded</p>
                    <p className="text-[10px] text-white/20 font-medium">
                      {item.createdAt ? relativeTime(item.createdAt) : "—"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  function SystemHealth() {
    const healthQuery = trpc.dashboard.credentialHealth.useQuery();
    const data = healthQuery.data;

    return (
      <Card className="border-white/[0.05] bg-white/[0.01] mb-8">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-white/20 flex items-center gap-2">
              <Activity className="h-3.5 w-3.5 text-blue-500/60" />
              Operational Health
            </CardTitle>
            <div className="flex items-center gap-2 px-2 py-1 rounded-md bg-emerald-500/5 border border-emerald-500/10">
              <div className="h-1 w-1 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[9px] font-black uppercase tracking-widest text-emerald-500/80">Optimal</span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/[0.05]">
              <div className="flex items-center gap-3">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-400/60" />
                <span className="text-[11px] font-bold text-white/60">Credential Integrity</span>
              </div>
              <span className="text-[11px] font-black text-emerald-400/80">{data?.summary?.healthy ?? 0} Healthy</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/[0.05]">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-400/60" />
                <span className="text-[11px] font-bold text-white/60">Expiring Soon</span>
              </div>
              <span className="text-[11px] font-black text-amber-400/80">{(data?.expiringSoon?.length ?? 0) + (data?.expiringWarning?.length ?? 0)} Warning</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/[0.05]">
              <div className="flex items-center gap-3">
                <AlertCircle className="h-3.5 w-3.5 text-red-400/60" />
                <span className="text-[11px] font-bold text-white/60">Critical Issues</span>
              </div>
              <span className="text-[11px] font-black text-red-400/80">{data?.expired?.length ?? 0} Action Required</span>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const PREMIUM_PLANS = ["enterprise", "cyber", "cyber_plus", "titan"];

  export default function Home() {
    const { user, loading } = useAuth();
    const sub = useSubscription();
    const [, setLocation] = useLocation();

    if (loading) return null;
    if (!user) {
      window.location.href = getLoginUrl();
      return null;
    }

    const isPremium = PREMIUM_PLANS.includes(sub?.plan ?? "");

    return (
      <div className="p-8 lg:p-12 max-w-7xl mx-auto">
        <header className="mb-12">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <h1 className="text-3xl font-black tracking-tighter text-white mb-2">
                Welcome back, <span className="text-blue-500">{user.email?.split("@")[0]}</span>
              </h1>
              <p className="text-sm text-white/30 font-medium">
                System status is optimal. You have{" "}
                <span className="text-white/60 font-bold">
                  {sub?.fetchesRemaining === -1
                    ? "unlimited"
                    : (sub?.fetchesRemaining?.toLocaleString() ?? 0)}{" "}
                  fetches
                </span>{" "}
                remaining.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button
                onClick={() => setLocation("/dashboard")}
                className="bg-blue-600 hover:bg-blue-500 text-white border-0 shadow-xl shadow-blue-600/20 font-bold h-11 px-6"
              >
                <Terminal className="h-4 w-4 mr-2" /> Titan AI
              </Button>
              <Button
                variant="outline"
                onClick={() => setLocation("/fetcher/settings")}
                className="border-white/10 bg-white/5 text-white/40 hover:text-white h-11 w-11 p-0"
              >
                <Settings2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </header>

        <UsageStatsWidget sub={sub} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          <div className="lg:col-span-2">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/20 mb-5">
              Quick Access
            </h3>
            <QuickActions />

            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/20 mb-5">
              Recent Activity
            </h3>
            <RecentActivity />
          </div>

          <div>
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/20 mb-5">
              System Status
            </h3>
            <SystemHealth />

            {!isPremium && (
              <Card className="border-blue-600/20 bg-blue-600/[0.02] overflow-hidden relative group">
                <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none">
                  <Zap className="h-24 w-24 text-blue-500" />
                </div>
                <CardHeader className="pb-4">
                  <CardTitle className="text-sm font-black text-blue-400 uppercase tracking-widest">
                    Upgrade to Cyber
                  </CardTitle>
                  <CardDescription className="text-white/30 text-xs leading-relaxed">
                    Unlock advanced security orchestration, red team playbooks, and team vaults.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button
                    onClick={() => setLocation("/pricing")}
                    className="w-full bg-blue-600 hover:bg-blue-500 text-white border-0 font-bold shadow-lg shadow-blue-600/20 h-10"
                  >
                    View Plans
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    );
  }
  