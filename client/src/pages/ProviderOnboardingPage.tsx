import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { UpgradeBanner } from "@/components/UpgradePrompt";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Wand2,
  Globe,
  CheckCircle2,
  XCircle,
  Loader2,
  ExternalLink,
  Trash2,
  Sparkles,
  ArrowRight,
  KeyRound,
  Link2,
  Gauge,
  AlertTriangle,
  Info,
  ChevronDown,
  ChevronUp,
  Zap,
} from "lucide-react";

const STATUS_CONFIG: Record<string, { color: string; bg: string; border: string; label: string }> = {
  analyzing: { color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20", label: "Analyzing" },
  ready: { color: "text-green-400", bg: "bg-green-500/10", border: "border-green-500/20", label: "Ready" },
  testing: { color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20", label: "Testing" },
  verified: { color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20", label: "Verified" },
  failed: { color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/20", label: "Failed" },
};

export default function ProviderOnboardingPage() {
  const { user } = useAuth();
  const sub = useSubscription();
  const [url, setUrl] = useState("");
  const [expandedItem, setExpandedItem] = useState<number | null>(null);

  const listQuery = trpc.onboarding.list.useQuery(undefined, { enabled: !!user });
  const statsQuery = trpc.onboarding.stats.useQuery(undefined, { enabled: !!user });
  const analyzeMutation = trpc.onboarding.analyze.useMutation();
  const deleteMutation = trpc.onboarding.delete.useMutation();
  const utils = trpc.useUtils();

  const items = listQuery.data ?? [];
  const stats = statsQuery.data;

  if (!sub.canUse("scheduled_fetches")) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-3">
            <Wand2 className="h-7 w-7 text-primary" />
            One-Click Provider Onboarding
          </h1>
          <p className="text-muted-foreground mt-1">
            Paste any provider URL and let AI auto-detect how to fetch credentials.
          </p>
        </div>
        <UpgradeBanner feature="Provider Onboarding" requiredPlan="pro" />
      </div>
    );
  }

  const handleAnalyze = async () => {
    if (!url.trim()) {
      toast.error("Please enter a URL.");
      return;
    }

    try {
      toast.info("Analyzing provider...");
      const result = await analyzeMutation.mutateAsync({ url: url.trim() });

      if (result.alreadyKnown) {
        toast.info(result.message || `${result.providerName} is already a built-in provider!`);
      } else {
        toast.success(
          `Detected: ${result.detectedName} (${result.confidence}% confidence)`
        );
      }

      setUrl("");
      utils.onboarding.list.invalidate();
      utils.onboarding.stats.invalidate();
    } catch (err: any) {
      toast.error(err.message || "Analysis failed.");
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteMutation.mutateAsync({ id });
      toast.success("Onboarding record deleted.");
      utils.onboarding.list.invalidate();
      utils.onboarding.stats.invalidate();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete.");
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return "text-green-400";
    if (confidence >= 50) return "text-amber-400";
    return "text-red-400";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Wand2 className="h-5 w-5 text-white" />
          </div>
          <span className="bg-gradient-to-r from-white to-white/70 bg-clip-text text-transparent">One-Click Provider Onboarding</span>
        </h1>
        <p className="text-sm text-muted-foreground mt-1 ml-12">
          Paste any provider URL and let AI auto-detect login pages, API key locations, and automation scripts.
        </p>
      </div>

      {/* URL Input */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Globe className="h-5 w-5" />
            Analyze New Provider
          </CardTitle>
          <CardDescription>
            Enter the URL of any service provider. Titan AI will analyze it and generate an automation script.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <div className="flex-1">
              <Input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://console.example.com or https://api.example.com"
                onKeyDown={(e) => e.key === "Enter" && handleAnalyze()}
              />
            </div>
            <Button
              onClick={handleAnalyze}
              disabled={analyzeMutation.isPending || !url.trim()}
              className="gap-2"
            >
              {analyzeMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              Analyze
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Works with any web service — SaaS platforms, cloud providers, payment processors, etc.
          </p>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "Total Analyzed", value: stats?.total ?? 0, icon: Globe, gradient: "from-indigo-500/20 to-indigo-600/5", iconColor: "text-indigo-400", iconBg: "bg-indigo-500/10" },
          { label: "Verified", value: stats?.verified ?? 0, icon: CheckCircle2, gradient: "from-emerald-500/20 to-emerald-600/5", iconColor: "text-emerald-400", iconBg: "bg-emerald-500/10", valueColor: "text-emerald-400" },
          { label: "In Progress", value: stats?.analyzing ?? 0, icon: Loader2, gradient: "from-blue-500/20 to-blue-600/5", iconColor: "text-blue-400", iconBg: "bg-blue-500/10", valueColor: "text-blue-400" },
        ].map((stat) => (
          <Card key={stat.label} className="relative overflow-hidden">
            <div className={`absolute inset-0 bg-gradient-to-br ${stat.gradient} opacity-50`} />
            <CardContent className="pt-6 relative">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{stat.label}</p>
                  <p className={`text-3xl font-bold mt-1 ${stat.valueColor || ""}`}>{stat.value}</p>
                </div>
                <div className={`h-10 w-10 rounded-xl ${stat.iconBg} flex items-center justify-center`}>
                  <stat.icon className={`h-5 w-5 ${stat.iconColor}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Onboarded Providers List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Analyzed Providers ({items.length})
          </CardTitle>
          <CardDescription>
            AI-analyzed providers with detected automation details.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Wand2 className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>No providers analyzed yet. Paste a URL above to get started.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((item) => {
                const isExpanded = expandedItem === item.id;
                const statusCfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.analyzing;

                return (
                  <div key={item.id} className={`rounded-lg border ${statusCfg.border} ${statusCfg.bg} p-4`}>
                    <div
                      className="flex items-center justify-between cursor-pointer"
                      onClick={() => setExpandedItem(isExpanded ? null : item.id)}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-10 w-10 rounded-lg bg-background/50 flex items-center justify-center shrink-0">
                          <Globe className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium">{item.detectedName || "Unknown"}</span>
                            <Badge variant="outline" className={`text-xs ${statusCfg.color} ${statusCfg.border}`}>
                              {statusCfg.label}
                            </Badge>
                            {item.confidence > 0 && (
                              <span className={`text-xs font-mono ${getConfidenceColor(item.confidence)}`}>
                                {item.confidence}%
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">
                            {item.providerUrl}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(item.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="mt-4 border-t border-border/50 pt-4 space-y-4">
                        {/* Detected Details */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {item.detectedLoginUrl && (
                            <div className="space-y-1">
                              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                                <Link2 className="h-3 w-3" /> Login URL
                              </Label>
                              <a
                                href={item.detectedLoginUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm text-primary hover:underline flex items-center gap-1 truncate"
                              >
                                {item.detectedLoginUrl}
                                <ExternalLink className="h-3 w-3 shrink-0" />
                              </a>
                            </div>
                          )}
                          {item.detectedKeysUrl && (
                            <div className="space-y-1">
                              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                                <KeyRound className="h-3 w-3" /> API Keys URL
                              </Label>
                              <a
                                href={item.detectedKeysUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm text-primary hover:underline flex items-center gap-1 truncate"
                              >
                                {item.detectedKeysUrl}
                                <ExternalLink className="h-3 w-3 shrink-0" />
                              </a>
                            </div>
                          )}
                        </div>

                        {/* Key Types */}
                        {item.detectedKeyTypes && (item.detectedKeyTypes as string[]).length > 0 && (
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Detected Key Types</Label>
                            <div className="flex flex-wrap gap-2">
                              {(item.detectedKeyTypes as string[]).map((kt, i) => (
                                <Badge key={i} variant="outline" className="text-xs">
                                  <KeyRound className="h-3 w-3 mr-1" />
                                  {kt}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Confidence Meter */}
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground flex items-center gap-1">
                            <Gauge className="h-3 w-3" /> Confidence Score
                          </Label>
                          <div className="flex items-center gap-3">
                            <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  item.confidence >= 80
                                    ? "bg-green-500"
                                    : item.confidence >= 50
                                    ? "bg-amber-500"
                                    : "bg-red-500"
                                }`}
                                style={{ width: `${item.confidence}%` }}
                              />
                            </div>
                            <span className={`text-sm font-mono font-medium ${getConfidenceColor(item.confidence)}`}>
                              {item.confidence}%
                            </span>
                          </div>
                        </div>

                        {/* Generated Script Preview */}
                        {item.generatedScript && (
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Generated Automation Script</Label>
                            <pre className="bg-black/30 rounded-lg p-3 text-xs text-muted-foreground overflow-x-auto max-h-48 overflow-y-auto font-mono">
                              {item.generatedScript}
                            </pre>
                          </div>
                        )}

                        {/* Error Message */}
                        {item.errorMessage && (
                          <div className="flex items-start gap-2 text-sm text-red-400 bg-red-500/5 rounded-lg p-3">
                            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                            <span>{item.errorMessage}</span>
                          </div>
                        )}

                        <p className="text-xs text-muted-foreground">
                          Analyzed on {new Date(item.createdAt).toLocaleString()}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
