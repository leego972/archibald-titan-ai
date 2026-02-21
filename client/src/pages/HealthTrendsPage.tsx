import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  TrendingUp,
  TrendingDown,
  Activity,
  BarChart3,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  RefreshCw,
  Minus,
  Shield,
} from "lucide-react";
import { useSubscription } from "@/hooks/useSubscription";
import { UpgradeBanner } from "@/components/UpgradePrompt";

const TIME_RANGES = [
  { value: "7", label: "Last 7 days" },
  { value: "14", label: "Last 14 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
];

export default function HealthTrendsPage() {
  const sub = useSubscription();
  const [days, setDays] = useState(30);

  // Cyber plan gate
  if (!sub.canUse("credential_health")) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-3">
            <Activity className="h-7 w-7 text-primary" />
            Health Trends
          </h1>
          <p className="text-muted-foreground mt-1">
            Track credential health over time.
          </p>
        </div>
        <UpgradeBanner feature="Health Trends" requiredPlan="cyber" />
      </div>
    );
  }

  const overviewQuery = trpc.healthTrends.overview.useQuery({ days });
  const dailyQuery = trpc.healthTrends.dailyTrend.useQuery({ days });
  const utils = trpc.useUtils();

  const handleRefresh = () => {
    utils.healthTrends.overview.invalidate();
    utils.healthTrends.dailyTrend.invalidate();
    toast.success("Refreshed");
  };

  type OverviewItem = NonNullable<typeof overviewQuery.data>[number];
  type DailyItem = NonNullable<typeof dailyQuery.data>[number];

  const overview: OverviewItem[] = overviewQuery.data ?? [];
  const daily: DailyItem[] = dailyQuery.data ?? [];

  // Compute aggregate summary from overview data
  const summary = useMemo(() => {
    if (!overview.length) return null;
    const totalFetches = overview.reduce((s, p) => s + p.totalFetches, 0);
    const totalSuccess = overview.reduce((s, p) => s + p.successfulFetches, 0);
    const totalFail = overview.reduce((s, p) => s + p.failedFetches, 0);
    const overallRate = totalFetches > 0 ? Math.round((totalSuccess / totalFetches) * 100) : 0;
    return {
      totalProviders: overview.length,
      totalFetches,
      totalSuccess,
      totalFail,
      overallRate,
    };
  }, [overview]);

  // Mini bar chart for daily trend
  const DailyChart = ({ items }: { items: DailyItem[] }) => {
    const maxFetches = Math.max(...items.map((i) => i.totalFetches), 1);
    const last14 = items.slice(-14);

    return (
      <div className="flex items-end gap-1 h-24">
        {last14.map((item, idx) => {
          const height = Math.max((item.totalFetches / maxFetches) * 100, 4);
          const rate = item.successRate;
          const color = rate >= 80 ? "bg-green-500" : rate >= 50 ? "bg-amber-500" : "bg-red-500";
          const dateStr = item.date ? new Date(item.date).toLocaleDateString() : `Day ${idx + 1}`;

          return (
            <div
              key={idx}
              className="flex-1 flex flex-col items-center"
              title={`${dateStr}: ${item.successfulFetches}/${item.totalFetches} (${rate}%)`}
            >
              <div
                className={`w-full rounded-sm ${color} transition-all hover:opacity-80 cursor-default`}
                style={{ height: `${height}%` }}
              />
            </div>
          );
        })}
      </div>
    );
  };

  const TrendBadge = ({ rate }: { rate: number }) => {
    if (rate >= 80) return <Badge className="bg-green-500/10 text-green-500 border-green-500/20">{rate}%</Badge>;
    if (rate >= 50) return <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20">{rate}%</Badge>;
    return <Badge className="bg-red-500/10 text-red-500 border-red-500/20">{rate}%</Badge>;
  };

  const isLoading = overviewQuery.isLoading || dailyQuery.isLoading;

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-3">
            <BarChart3 className="h-7 w-7 text-primary" />
            Provider Health Trends
          </h1>
          <p className="text-muted-foreground mt-1">
            Historical performance data and success rate trends across all providers.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={days.toString()} onValueChange={(v) => setDays(parseInt(v))}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIME_RANGES.map((r) => (
                <SelectItem key={r.value} value={r.value}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Activity className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{summary.totalProviders}</p>
                  <p className="text-sm text-muted-foreground">Active Providers</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-500/10">
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{summary.overallRate}%</p>
                  <p className="text-sm text-muted-foreground">Success Rate</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <Clock className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{summary.totalFetches}</p>
                  <p className="text-sm text-muted-foreground">Total Jobs ({days}d)</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-red-500/10">
                  <XCircle className="h-5 w-5 text-red-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{summary.totalFail}</p>
                  <p className="text-sm text-muted-foreground">Failures ({days}d)</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Daily Trend Chart */}
      {daily.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Daily Activity</CardTitle>
            <CardDescription>Aggregate fetch success across all providers</CardDescription>
          </CardHeader>
          <CardContent>
            <DailyChart items={daily} />
            <div className="flex justify-between mt-2 text-xs text-muted-foreground">
              <span>{daily.length > 0 && daily[Math.max(daily.length - 14, 0)]?.date ? new Date(daily[Math.max(daily.length - 14, 0)].date!).toLocaleDateString() : ""}</span>
              <span className="flex items-center gap-3">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" /> &ge;80%</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" /> 50-79%</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" /> &lt;50%</span>
              </span>
              <span>{daily.length > 0 && daily[daily.length - 1]?.date ? new Date(daily[daily.length - 1].date!).toLocaleDateString() : ""}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Per-Provider Breakdown */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : overview.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <BarChart3 className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-semibold mb-1">No trend data yet</h3>
            <p className="text-muted-foreground text-sm text-center max-w-md">
              Health trends will appear here as you run fetch jobs. Start fetching credentials to begin collecting performance data.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <h2 className="text-lg font-semibold">Per-Provider Breakdown</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {overview.map((provider: OverviewItem) => (
              <Card key={provider.providerId}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base">{provider.providerName}</CardTitle>
                      <CardDescription>
                        {provider.totalFetches} fetches over {provider.dataPoints} data points
                      </CardDescription>
                    </div>
                    <TrendBadge rate={provider.successRate} />
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground text-xs">Successful</p>
                      <p className="font-semibold text-green-500">{provider.successfulFetches}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Failed</p>
                      <p className="font-semibold text-red-500">{provider.failedFetches}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Avg Duration</p>
                      <p className="font-semibold">{provider.avgDurationMs > 0 ? `${(provider.avgDurationMs / 1000).toFixed(1)}s` : "N/A"}</p>
                    </div>
                  </div>

                  {/* Success bar */}
                  <div className="mt-3">
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          provider.successRate >= 80 ? "bg-green-500" : provider.successRate >= 50 ? "bg-amber-500" : "bg-red-500"
                        }`}
                        style={{ width: `${provider.successRate}%` }}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
