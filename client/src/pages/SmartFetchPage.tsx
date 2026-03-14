import { useState } from "react";
import { trpc } from "@/lib/trpc";
import AffiliateRecommendations from "@/components/AffiliateRecommendations";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Sparkles,
  RefreshCw,
  AlertTriangle,
  Clock,
  TrendingUp,
  Shield,
  Zap,
  Loader2,
  Brain,
  ArrowRight,
  EyeOff,
} from "lucide-react";
import { PROVIDERS } from "@shared/fetcher";

const PRIORITY_CONFIG = {
  critical: { color: "text-red-500", bg: "bg-red-500/10", border: "border-red-500/20", label: "Critical" },
  high: { color: "text-amber-500", bg: "bg-amber-500/10", border: "border-amber-500/20", label: "High" },
  medium: { color: "text-blue-500", bg: "bg-blue-500/10", border: "border-blue-500/20", label: "Medium" },
  low: { color: "text-muted-foreground", bg: "bg-muted/50", border: "border-muted", label: "Low" },
};

const TYPE_ICONS: Record<string, typeof Sparkles> = {
  stale_credential: Clock,
  high_failure_rate: AlertTriangle,
  rotation_detected: RefreshCw,
  optimal_time: Zap,
  new_provider: TrendingUp,
  proxy_needed: Shield,
};

export default function SmartFetchPage() {
  const [dismissed, setDismissed] = useState<Set<number>>(new Set());

  const recsQuery = trpc.recommendations.list.useQuery();
  const generateMutation = trpc.recommendations.generate.useMutation();
  const dismissMutation = trpc.recommendations.dismiss.useMutation();
  const utils = trpc.useUtils();

  const handleGenerate = async () => {
    try {
      toast.info("Analyzing your credential patterns...");
      const result = await generateMutation.mutateAsync();
      toast.success(`Generated ${result.count} recommendations.`);
      utils.recommendations.list.invalidate();
    } catch (err: any) {
      toast.error(err.message || "Failed to generate recommendations.");
    }
  };

  const handleDismiss = async (id: number) => {
    try {
      await dismissMutation.mutateAsync({ id });
      setDismissed((prev) => new Set(prev).add(id));
      toast.success("Recommendation dismissed.");
      utils.recommendations.list.invalidate();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  type Rec = NonNullable<typeof recsQuery.data>[number];
  const recommendations: Rec[] = (recsQuery.data ?? []).filter((r: Rec) => !dismissed.has(r.id));
  const criticalCount = recommendations.filter((r: Rec) => r.priority === "critical").length;
  const highCount = recommendations.filter((r: Rec) => r.priority === "high").length;
  const mediumCount = recommendations.filter((r: Rec) => r.priority === "medium").length;

  return (
    <div className="w-full max-w-5xl space-y-4 sm:space-y-6 overflow-x-hidden">
      {/* Header — stacks on mobile, side-by-side on sm+ */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2 flex-wrap">
            <Sparkles className="h-6 w-6 sm:h-7 sm:w-7 text-primary shrink-0" />
            <span>Smart Fetch Recommendations</span>
          </h1>
          <p className="text-muted-foreground mt-1 text-sm leading-snug">
            AI-powered analysis of your credential usage patterns with actionable recommendations.
          </p>
        </div>
        <Button
          onClick={handleGenerate}
          disabled={generateMutation.isPending}
          className="gap-2 w-full sm:w-auto shrink-0"
        >
          {generateMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Brain className="h-4 w-4" />
          )}
          {generateMutation.isPending ? "Analyzing..." : "Generate Insights"}
        </Button>
      </div>

      {/* Summary Cards — 2 columns on mobile, 4 on md+ */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4 pb-4 px-4">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-primary/10 shrink-0">
                <Sparkles className="h-4 w-4 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-xl font-bold leading-none">{recommendations.length}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Total</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 px-4">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-red-500/10 shrink-0">
                <AlertTriangle className="h-4 w-4 text-red-500" />
              </div>
              <div className="min-w-0">
                <p className="text-xl font-bold leading-none">{criticalCount}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Critical</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 px-4">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-amber-500/10 shrink-0">
                <Shield className="h-4 w-4 text-amber-500" />
              </div>
              <div className="min-w-0">
                <p className="text-xl font-bold leading-none">{highCount}</p>
                <p className="text-xs text-muted-foreground mt-0.5">High</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 px-4">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-blue-500/10 shrink-0">
                <TrendingUp className="h-4 w-4 text-blue-500" />
              </div>
              <div className="min-w-0">
                <p className="text-xl font-bold leading-none">{mediumCount}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Medium</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Generating state */}
      {generateMutation.isPending && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="flex items-center gap-3 py-4 px-4">
            <div className="relative shrink-0">
              <Brain className="h-7 w-7 text-primary animate-pulse" />
              <Sparkles className="h-3.5 w-3.5 text-primary absolute -top-1 -right-1 animate-bounce" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-sm">Analyzing credential patterns...</p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                Titan AI is reviewing your fetch history, provider health, and credential age.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recommendations List */}
      {recsQuery.isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : recommendations.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <Sparkles className="h-10 w-10 text-muted-foreground/30 mb-3" />
            <h3 className="text-base font-semibold mb-1">No recommendations yet</h3>
            <p className="text-muted-foreground text-sm mb-4 max-w-xs">
              Click "Generate Insights" to let Titan AI analyze your credential usage patterns.
            </p>
            <Button onClick={handleGenerate} disabled={generateMutation.isPending} size="sm">
              <Brain className="h-4 w-4 mr-2" />
              Generate Insights
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {recommendations.map((rec: Rec) => {
            const priority = PRIORITY_CONFIG[rec.priority as keyof typeof PRIORITY_CONFIG] || PRIORITY_CONFIG.medium;
            const TypeIcon = TYPE_ICONS[rec.recommendationType] || Sparkles;

            return (
              <Card key={rec.id} className={`border-l-4 ${priority.border}`}>
                <CardHeader className="pb-2 px-4 pt-4">
                  {/* Title row — icon + title + dismiss button */}
                  <div className="flex items-start gap-3">
                    <div className={`p-1.5 rounded-lg ${priority.bg} shrink-0 mt-0.5`}>
                      <TypeIcon className={`h-4 w-4 ${priority.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-sm font-semibold leading-snug flex-1 min-w-0">
                          {rec.title}
                        </CardTitle>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDismiss(rec.id)}
                          className="text-muted-foreground hover:text-foreground h-7 w-7 p-0 shrink-0"
                        >
                          <EyeOff className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-4 ${priority.color}`}>
                          {priority.label}
                        </Badge>
                        <CardDescription className="text-xs">
                          {rec.providerId && (
                            <span className="font-medium">
                              {PROVIDERS[rec.providerId]?.name || rec.providerId}
                            </span>
                          )}
                          {rec.providerId && " — "}
                          {rec.recommendationType.replace(/_/g, " ")}
                        </CardDescription>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <p className="text-sm text-muted-foreground mb-2 leading-snug">{rec.description}</p>
                  {rec.actionUrl && (
                    <div className="flex items-center gap-1.5 text-sm mb-2">
                      <ArrowRight className="h-3.5 w-3.5 text-primary shrink-0" />
                      <span className="text-primary font-medium">Take Action</span>
                    </div>
                  )}
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs text-muted-foreground">
                    <span>Type: {rec.recommendationType.replace(/_/g, " ")}</span>
                    <span>Generated: {new Date(rec.createdAt).toLocaleDateString()}</span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
      <AffiliateRecommendations context="ai_tools" variant="banner" />
    </div>
  );
}
