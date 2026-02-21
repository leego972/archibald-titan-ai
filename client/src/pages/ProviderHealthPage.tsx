import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import AffiliateRecommendations from "@/components/AffiliateRecommendations";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  RefreshCw,
  Shield,
  Wifi,
  Server,
  Cpu,
  Database,
  Zap,
  RotateCcw,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useState, useMemo } from "react";

// ─── Health Status Helpers ──────────────────────────────────────────

function getHealthIcon(status: string) {
  switch (status) {
    case "healthy":
      return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
    case "degraded":
      return <AlertTriangle className="h-4 w-4 text-amber-500" />;
    case "down":
      return <XCircle className="h-4 w-4 text-red-500" />;
    default:
      return <HelpCircle className="h-4 w-4 text-muted-foreground" />;
  }
}

function getHealthBadge(status: string) {
  switch (status) {
    case "healthy":
      return <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 hover:bg-emerald-500/10">Healthy</Badge>;
    case "degraded":
      return <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20 hover:bg-amber-500/10">Degraded</Badge>;
    case "down":
      return <Badge className="bg-red-500/10 text-red-500 border-red-500/20 hover:bg-red-500/10">Down</Badge>;
    default:
      return <Badge variant="outline" className="text-muted-foreground">No Data</Badge>;
  }
}

function getCircuitBadge(state: string) {
  switch (state) {
    case "closed":
      return <Badge variant="outline" className="text-emerald-500 border-emerald-500/30">Closed</Badge>;
    case "half_open":
      return <Badge variant="outline" className="text-amber-500 border-amber-500/30">Half-Open</Badge>;
    case "open":
      return <Badge variant="outline" className="text-red-500 border-red-500/30">Open</Badge>;
    default:
      return <Badge variant="outline">Unknown</Badge>;
  }
}

function getSystemStatusIcon(status: string) {
  switch (status) {
    case "healthy":
      return <CheckCircle2 className="h-5 w-5 text-emerald-500" />;
    case "degraded":
      return <AlertTriangle className="h-5 w-5 text-amber-500" />;
    case "unhealthy":
      return <XCircle className="h-5 w-5 text-red-500" />;
    default:
      return <HelpCircle className="h-5 w-5 text-muted-foreground" />;
  }
}

function getComponentIcon(name: string) {
  switch (name.toLowerCase()) {
    case "database":
      return <Database className="h-4 w-4" />;
    case "memory":
      return <Cpu className="h-4 w-4" />;
    case "circuit breakers":
      return <Zap className="h-4 w-4" />;
    case "llm service":
      return <Server className="h-4 w-4" />;
    default:
      return <Activity className="h-4 w-4" />;
  }
}

// ─── Success Rate Bar ───────────────────────────────────────────────

function SuccessRateBar({ rate }: { rate: number | null }) {
  if (rate === null) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-muted-foreground/20 rounded-full" style={{ width: "100%" }} />
        </div>
        <span className="text-xs text-muted-foreground w-10 text-right">N/A</span>
      </div>
    );
  }

  const color = rate >= 80 ? "bg-emerald-500" : rate >= 50 ? "bg-amber-500" : "bg-red-500";

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all duration-500`} style={{ width: `${rate}%` }} />
      </div>
      <span className="text-xs font-medium w-10 text-right">{rate}%</span>
    </div>
  );
}

// ─── Provider Card ──────────────────────────────────────────────────

function ProviderCard({
  provider,
  onResetCircuit,
}: {
  provider: {
    id: string;
    name: string;
    category: string;
    healthStatus: string;
    circuitState: string;
    consecutiveFailures: number;
    totalFetches: number;
    successfulFetches: number;
    failedFetches: number;
    successRate: number | null;
    requiresProxy: boolean;
    proxyNote: string;
  };
  onResetCircuit: (providerId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className="overflow-hidden transition-all hover:shadow-md">
      <div
        className="flex items-center justify-between p-4 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3 min-w-0">
          {getHealthIcon(provider.healthStatus)}
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium truncate">{provider.name}</span>
              {provider.requiresProxy && (
                <Shield className="h-3.5 w-3.5 text-amber-500 shrink-0" />
              )}
            </div>
            <p className="text-xs text-muted-foreground capitalize">{provider.category}</p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {getHealthBadge(provider.healthStatus)}
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </div>

      {expanded && (
        <CardContent className="pt-0 pb-4 px-4 border-t">
          <div className="grid gap-4 mt-4">
            {/* Success Rate */}
            <div>
              <p className="text-xs text-muted-foreground mb-1.5">Success Rate</p>
              <SuccessRateBar rate={provider.successRate} />
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center p-2 bg-muted/50 rounded-lg">
                <p className="text-lg font-semibold">{provider.totalFetches}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
              <div className="text-center p-2 bg-emerald-500/5 rounded-lg">
                <p className="text-lg font-semibold text-emerald-500">{provider.successfulFetches}</p>
                <p className="text-xs text-muted-foreground">Success</p>
              </div>
              <div className="text-center p-2 bg-red-500/5 rounded-lg">
                <p className="text-lg font-semibold text-red-500">{provider.failedFetches}</p>
                <p className="text-xs text-muted-foreground">Failed</p>
              </div>
            </div>

            {/* Circuit Breaker */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">Circuit Breaker</span>
              </div>
              <div className="flex items-center gap-2">
                {getCircuitBadge(provider.circuitState)}
                {provider.consecutiveFailures > 0 && (
                  <span className="text-xs text-muted-foreground">
                    ({provider.consecutiveFailures} failures)
                  </span>
                )}
              </div>
            </div>

            {/* Proxy Requirement */}
            {provider.requiresProxy && (
              <div className="flex items-start gap-2 p-2 bg-amber-500/5 rounded-lg">
                <Shield className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                <p className="text-xs text-amber-500/80">{provider.proxyNote}</p>
              </div>
            )}

            {/* Reset Circuit Button */}
            {provider.circuitState !== "closed" && (
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={(e) => {
                  e.stopPropagation();
                  onResetCircuit(provider.id);
                }}
              >
                <RotateCcw className="h-3.5 w-3.5 mr-2" />
                Reset Circuit Breaker
              </Button>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────

export default function ProviderHealthPage() {
  const healthQuery = trpc.fetcher.providerHealth.useQuery();
  const systemQuery = trpc.fetcher.systemHealth.useQuery();
  const utils = trpc.useUtils();

  const resetCircuit = trpc.fetcher.resetProviderCircuit.useMutation({
    onSuccess: (data) => {
      toast.success(`Circuit breaker reset for ${data.providerId}`);
      utils.fetcher.providerHealth.invalidate();
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const providers = healthQuery.data ?? [];

  // Summary stats
  const summary = useMemo(() => {
    if (providers.length === 0) return null;
    const healthy = providers.filter((p) => p.healthStatus === "healthy").length;
    const degraded = providers.filter((p) => p.healthStatus === "degraded").length;
    const down = providers.filter((p) => p.healthStatus === "down").length;
    const unknown = providers.filter((p) => p.healthStatus === "unknown").length;
    const totalFetches = providers.reduce((sum, p) => sum + p.totalFetches, 0);
    const totalSuccess = providers.reduce((sum, p) => sum + p.successfulFetches, 0);
    const overallRate = totalFetches > 0 ? Math.round((totalSuccess / totalFetches) * 100) : null;
    return { healthy, degraded, down, unknown, totalFetches, totalSuccess, overallRate };
  }, [providers]);

  // Group by category
  const grouped = useMemo(() => {
    const groups: Record<string, typeof providers> = {};
    for (const p of providers) {
      if (!groups[p.category]) groups[p.category] = [];
      groups[p.category].push(p);
    }
    return groups;
  }, [providers]);

  const categoryLabels: Record<string, string> = {
    ai: "AI & ML",
    cloud: "Cloud Platforms",
    payments: "Payments",
    communications: "Communications",
    devtools: "Developer Tools",
    hosting: "Hosting & CDN",
    domains: "Domain & DNS",
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Activity className="h-6 w-6 text-primary" />
            Provider Health Dashboard
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Real-time monitoring of circuit breakers, success rates, and system health
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            utils.fetcher.providerHealth.invalidate();
            utils.fetcher.systemHealth.invalidate();
            toast.success("Refreshed");
          }}
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* System Health */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Wifi className="h-4 w-4" />
            System Health
          </CardTitle>
          <CardDescription>Core infrastructure status</CardDescription>
        </CardHeader>
        <CardContent>
          {systemQuery.isLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-16 rounded-lg" />
              ))}
            </div>
          ) : systemQuery.data ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                {getSystemStatusIcon(systemQuery.data.overall)}
                <span className="font-medium capitalize">{systemQuery.data.overall}</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {systemQuery.data.components.map((comp) => (
                  <div
                    key={comp.name}
                    className={`p-3 rounded-lg border ${
                      comp.status === "healthy"
                        ? "border-emerald-500/20 bg-emerald-500/5"
                        : comp.status === "degraded"
                          ? "border-amber-500/20 bg-amber-500/5"
                          : "border-red-500/20 bg-red-500/5"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      {getComponentIcon(comp.name)}
                      <span className="text-sm font-medium">{comp.name}</span>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">{comp.message}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Failed to load system health</p>
          )}
        </CardContent>
      </Card>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              <span className="text-xs text-muted-foreground">Healthy</span>
            </div>
            <p className="text-2xl font-bold">{summary.healthy}</p>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <span className="text-xs text-muted-foreground">Degraded</span>
            </div>
            <p className="text-2xl font-bold">{summary.degraded}</p>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <XCircle className="h-4 w-4 text-red-500" />
              <span className="text-xs text-muted-foreground">Down</span>
            </div>
            <p className="text-2xl font-bold">{summary.down}</p>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <HelpCircle className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">No Data</span>
            </div>
            <p className="text-2xl font-bold">{summary.unknown}</p>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Activity className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground">Overall Rate</span>
            </div>
            <p className="text-2xl font-bold">{summary.overallRate !== null ? `${summary.overallRate}%` : "N/A"}</p>
          </Card>
        </div>
      )}

      {/* Provider List by Category */}
      {healthQuery.isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-16 rounded-lg" />
          ))}
        </div>
      ) : (
        Object.entries(grouped).map(([category, categoryProviders]) => (
          <div key={category} className="space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              {categoryLabels[category] || category}
            </h2>
            <div className="space-y-2">
              {categoryProviders.map((provider) => (
                <ProviderCard
                  key={provider.id}
                  provider={provider}
                  onResetCircuit={(id) => resetCircuit.mutate({ providerId: id })}
                />
              ))}
            </div>
          </div>
        ))
      )}

      {/* Empty State */}
      {!healthQuery.isLoading && providers.length === 0 && (
        <Card className="p-12 text-center">
          <Activity className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">No Provider Data</h3>
          <p className="text-sm text-muted-foreground">
            Run some fetch jobs to start collecting provider health data.
          </p>
        </Card>
      )}
      <AffiliateRecommendations context="security" variant="banner" />
    </div>
  );
}
