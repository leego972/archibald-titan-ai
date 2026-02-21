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
  CheckCircle2,
  XCircle,
  Loader2,
  Brain,
  ArrowRight,
  Eye,
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
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-3">
            <Sparkles className="h-7 w-7 text-primary" />
            Smart Fetch Recommendations
          </h1>
          <p className="text-muted-foreground mt-1">
            AI-powered analysis of your credential usage patterns with actionable recommendations.
          </p>
        </div>
        <Button
          onClick={handleGenerate}
          disabled={generateMutation.isPending}
          className="gap-2"
        >
          {generateMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Brain className="h-4 w-4" />
          )}
          {generateMutation.isPending ? "Analyzing..." : "Generate Insights"}
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{recommendations.length}</p>
                <p className="text-sm text-muted-foreground">Total</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-500/10">
                <AlertTriangle className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{criticalCount}</p>
                <p className="text-sm text-muted-foreground">Critical</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <Shield className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{highCount}</p>
                <p className="text-sm text-muted-foreground">High Priority</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <TrendingUp className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{mediumCount}</p>
                <p className="text-sm text-muted-foreground">Medium</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Generating state */}
      {generateMutation.isPending && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="flex items-center gap-4 py-6">
            <div className="relative">
              <Brain className="h-8 w-8 text-primary animate-pulse" />
              <Sparkles className="h-4 w-4 text-primary absolute -top-1 -right-1 animate-bounce" />
            </div>
            <div>
              <p className="font-semibold">Analyzing credential patterns...</p>
              <p className="text-sm text-muted-foreground">
                Titan AI is reviewing your fetch history, provider health, and credential age to generate smart recommendations.
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
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Sparkles className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-semibold mb-1">No recommendations yet</h3>
            <p className="text-muted-foreground text-sm mb-4 text-center max-w-md">
              Click "Generate Insights" to let Titan AI analyze your credential usage patterns and provide smart recommendations.
            </p>
            <Button onClick={handleGenerate} disabled={generateMutation.isPending}>
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
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${priority.bg}`}>
                        <TypeIcon className={`h-5 w-5 ${priority.color}`} />
                      </div>
                      <div>
                        <CardTitle className="text-base flex items-center gap-2">
                          {rec.title}
                          <Badge variant="outline" className={`text-xs ${priority.color}`}>
                            {priority.label}
                          </Badge>
                        </CardTitle>
                        <CardDescription className="mt-0.5">
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
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDismiss(rec.id)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <EyeOff className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-3">{rec.description}</p>
                  {rec.actionUrl && (
                    <div className="flex items-center gap-2 text-sm">
                      <ArrowRight className="h-3.5 w-3.5 text-primary" />
                      <span className="text-primary font-medium">Take Action</span>
                    </div>
                  )}
                  <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
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
