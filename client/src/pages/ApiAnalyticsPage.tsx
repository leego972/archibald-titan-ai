import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { useSubscription } from "@/hooks/useSubscription";
import { UpgradeDialog } from "@/components/UpgradePrompt";
import {
  BarChart3,
  Activity,
  Clock,
  Key,
  TrendingUp,
  Zap,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Loader2,
} from "lucide-react";
import { useState } from "react";

export default function ApiAnalyticsPage() {
  const sub = useSubscription();
  const [showUpgrade, setShowUpgrade] = useState(false);

  const statsQuery = trpc.apiAnalytics.stats.useQuery(undefined, {
    enabled: sub.canUse("developer_api"),
    retry: false,
  });

  const recentQuery = trpc.apiAnalytics.recentRequests.useQuery(
    { limit: 25 },
    {
      enabled: sub.canUse("developer_api"),
      retry: false,
    }
  );

  if (!sub.canUse("developer_api")) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
            API Analytics
          </h1>
          <p className="text-muted-foreground mt-1">
            Monitor your API usage, performance, and rate limits.
          </p>
        </div>
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 flex items-center justify-center mb-4">
              <BarChart3 className="h-8 w-8 text-emerald-400" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Pro Feature</h3>
            <p className="text-sm text-muted-foreground max-w-md mb-6">
              Track API usage, monitor rate limits, and analyze endpoint
              performance with real-time analytics.
            </p>
            <Button
              onClick={() => setShowUpgrade(true)}
              className="bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-white"
            >
              Upgrade to Pro
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </CardContent>
        </Card>
        <UpgradeDialog
          open={showUpgrade}
          onOpenChange={setShowUpgrade}
          feature="API Analytics"
          requiredPlan="pro"
        />
      </div>
    );
  }

  const stats = statsQuery.data;
  const recent = recentQuery.data || [];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
          API Analytics
        </h1>
        <p className="text-muted-foreground mt-1">
          Monitor your API usage and performance.
        </p>
      </div>

      {/* Stats Cards */}
      {statsQuery.isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : stats ? (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <Card className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-blue-500/20">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground font-medium">
                      Total Requests
                    </p>
                    <p className="text-2xl font-bold mt-1">
                      {stats.totalRequests.toLocaleString()}
                    </p>
                  </div>
                  <div className="h-10 w-10 rounded-lg bg-blue-500/15 flex items-center justify-center">
                    <Activity className="h-5 w-5 text-blue-400" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border-emerald-500/20">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground font-medium">
                      Today
                    </p>
                    <p className="text-2xl font-bold mt-1">
                      {stats.todayRequests.toLocaleString()}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      of {stats.dailyLimit.toLocaleString()} daily limit
                    </p>
                  </div>
                  <div className="h-10 w-10 rounded-lg bg-emerald-500/15 flex items-center justify-center">
                    <TrendingUp className="h-5 w-5 text-emerald-400" />
                  </div>
                </div>
                {/* Usage bar */}
                <div className="mt-3 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      stats.dailyLimit > 0 &&
                      stats.todayRequests / stats.dailyLimit > 0.8
                        ? "bg-amber-500"
                        : "bg-emerald-500"
                    }`}
                    style={{
                      width: `${
                        stats.dailyLimit > 0
                          ? Math.min(
                              100,
                              (stats.todayRequests / stats.dailyLimit) * 100
                            )
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-purple-500/10 to-purple-500/5 border-purple-500/20">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground font-medium">
                      Active Keys
                    </p>
                    <p className="text-2xl font-bold mt-1">
                      {stats.activeKeys}
                    </p>
                  </div>
                  <div className="h-10 w-10 rounded-lg bg-purple-500/15 flex items-center justify-center">
                    <Key className="h-5 w-5 text-purple-400" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-amber-500/10 to-amber-500/5 border-amber-500/20">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground font-medium">
                      Daily Limit
                    </p>
                    <p className="text-2xl font-bold mt-1">
                      {stats.dailyLimit.toLocaleString()}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      requests/day
                    </p>
                  </div>
                  <div className="h-10 w-10 rounded-lg bg-amber-500/15 flex items-center justify-center">
                    <Zap className="h-5 w-5 text-amber-400" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Top Endpoints */}
          {stats.topEndpoints.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Top Endpoints</CardTitle>
                <CardDescription>
                  Most frequently called API endpoints.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {stats.topEndpoints.map((ep, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between py-2"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground w-5 text-right">
                          {i + 1}.
                        </span>
                        <code className="text-sm font-mono">
                          {ep.endpoint}
                        </code>
                      </div>
                      <Badge variant="secondary">
                        {ep.count.toLocaleString()} calls
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      ) : null}

      {/* Recent Requests */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Requests</CardTitle>
          <CardDescription>
            Last 25 API requests across all keys.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {recentQuery.isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : recent.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Activity className="h-8 w-8 text-muted-foreground/40 mb-2" />
              <p className="text-sm text-muted-foreground">
                No API requests yet. Create an API key and start making calls.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 pr-3 font-medium">Status</th>
                    <th className="text-left py-2 pr-3 font-medium">Method</th>
                    <th className="text-left py-2 pr-3 font-medium">
                      Endpoint
                    </th>
                    <th className="text-left py-2 pr-3 font-medium">
                      Response
                    </th>
                    <th className="text-left py-2 font-medium">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((req) => (
                    <tr key={req.id} className="border-b border-dashed">
                      <td className="py-2 pr-3">
                        {req.statusCode >= 200 && req.statusCode < 300 ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                        ) : req.statusCode >= 400 ? (
                          <XCircle className="h-4 w-4 text-red-400" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-amber-400" />
                        )}
                      </td>
                      <td className="py-2 pr-3">
                        <Badge
                          variant="outline"
                          className="font-mono text-[10px]"
                        >
                          {req.method}
                        </Badge>
                      </td>
                      <td className="py-2 pr-3">
                        <code className="text-xs font-mono">
                          {req.endpoint}
                        </code>
                      </td>
                      <td className="py-2 pr-3">
                        <span
                          className={`text-xs ${
                            req.statusCode >= 200 && req.statusCode < 300
                              ? "text-emerald-400"
                              : "text-red-400"
                          }`}
                        >
                          {req.statusCode}
                        </span>
                        {req.responseMs && (
                          <span className="text-xs text-muted-foreground ml-2">
                            {req.responseMs}ms
                          </span>
                        )}
                      </td>
                      <td className="py-2">
                        <span className="text-xs text-muted-foreground">
                          {new Date(req.createdAt).toLocaleTimeString()}
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
    </div>
  );
}
