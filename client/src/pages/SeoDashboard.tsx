import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import {
  Search,
  Globe,
  BarChart3,
  FileText,
  AlertTriangle,
  CheckCircle,
  XCircle,
  RefreshCw,
  Shield,
  Zap,
  TrendingUp,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Lightbulb,
  Target,
  Code,
  Activity,
} from "lucide-react";

export default function SeoDashboard() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"overview" | "keywords" | "meta" | "structured" | "pages">("overview");

  const statusQuery = trpc.seo.getStatus.useQuery(undefined, { enabled: user?.role === "admin" });
  const healthQuery = trpc.seo.getHealthScore.useQuery(undefined, { enabled: user?.role === "admin" && activeTab === "overview" });
  const keywordsQuery = trpc.seo.getKeywords.useQuery(undefined, { enabled: user?.role === "admin" && activeTab === "keywords" });
  const metaQuery = trpc.seo.getMetaOptimizations.useQuery(undefined, { enabled: user?.role === "admin" && activeTab === "meta" });
  const structuredQuery = trpc.seo.getStructuredData.useQuery(undefined, { enabled: user?.role === "admin" && activeTab === "structured" });
  const pagesQuery = trpc.seo.getPublicPages.useQuery(undefined, { enabled: user?.role === "admin" && activeTab === "pages" });

  const runOptimization = trpc.seo.runOptimization.useMutation({
    onSuccess: () => {
      healthQuery.refetch();
      statusQuery.refetch();
    },
  });

  const killSwitch = trpc.seo.killSwitch.useMutation({
    onSuccess: () => statusQuery.refetch(),
  });

  if (user?.role !== "admin") {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-400">Admin access required</p>
      </div>
    );
  }

  const tabs = [
    { id: "overview" as const, label: "Health Score", icon: Activity },
    { id: "keywords" as const, label: "Keywords", icon: Target },
    { id: "meta" as const, label: "Meta Tags", icon: FileText },
    { id: "structured" as const, label: "Structured Data", icon: Code },
    { id: "pages" as const, label: "Pages", icon: Globe },
  ];

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-emerald-400";
    if (score >= 60) return "text-yellow-400";
    return "text-red-400";
  };

  const getScoreBg = (score: number) => {
    if (score >= 80) return "from-emerald-500/20 to-emerald-600/5";
    if (score >= 60) return "from-yellow-500/20 to-yellow-600/5";
    return "from-red-500/20 to-red-600/5";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500/20 to-cyan-500/20">
              <Search className="w-6 h-6 text-blue-400" />
            </div>
            SEO Command Center
          </h1>
          <p className="text-gray-400 mt-1">Autonomous search engine optimization for Archibald Titan</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Kill Switch */}
          <Button
            variant="outline"
            size="sm"
            className={`${statusQuery.data?.isKilled ? "border-red-500/50 text-red-400" : "border-gray-600 text-gray-400"}`}
            onClick={() => killSwitch.mutate({ action: statusQuery.data?.isKilled ? "deactivate" : "activate" })}
          >
            <Shield className="w-4 h-4 mr-1" />
            {statusQuery.data?.isKilled ? "Engine Killed" : "Kill Switch"}
          </Button>
          {/* Run Optimization */}
          <Button
            size="sm"
            className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500"
            onClick={() => runOptimization.mutate()}
            disabled={runOptimization.isPending || statusQuery.data?.isKilled}
          >
            <RefreshCw className={`w-4 h-4 mr-1 ${runOptimization.isPending ? "animate-spin" : ""}`} />
            {runOptimization.isPending ? "Optimizing..." : "Run Optimization"}
          </Button>
        </div>
      </div>

      {/* Status Bar */}
      {statusQuery.data && (
        <div className="flex items-center gap-4 text-sm text-gray-400">
          <span className="flex items-center gap-1">
            <div className={`w-2 h-2 rounded-full ${statusQuery.data.isKilled ? "bg-red-500" : "bg-emerald-500"}`} />
            Engine {statusQuery.data.isKilled ? "Stopped" : "Active"}
          </span>
          {statusQuery.data.lastRun > 0 && (
            <span>Last run: {new Date(statusQuery.data.lastRun).toLocaleString()}</span>
          )}
          {statusQuery.data.hasCachedReport && statusQuery.data.cachedReportAge && (
            <span>Report age: {Math.round(statusQuery.data.cachedReportAge / 60000)}m</span>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-white/5 rounded-lg p-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
              activeTab === tab.id
                ? "bg-blue-600/20 text-blue-400"
                : "text-gray-400 hover:text-gray-300 hover:bg-white/5"
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {healthQuery.isLoading ? (
            <div className="flex items-center justify-center h-40">
              <RefreshCw className="w-6 h-6 text-blue-400 animate-spin" />
            </div>
          ) : healthQuery.data ? (
            <>
              {/* Score Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className={`rounded-xl p-4 bg-gradient-to-br ${getScoreBg(healthQuery.data.overall)} border border-white/5`}>
                  <p className="text-xs text-gray-400 uppercase tracking-wider">Overall Score</p>
                  <p className={`text-3xl font-bold mt-1 ${getScoreColor(healthQuery.data.overall)}`}>
                    {healthQuery.data.overall}/100
                  </p>
                </div>
                <div className="rounded-xl p-4 bg-gradient-to-br from-white/5 to-white/0 border border-white/5">
                  <p className="text-xs text-gray-400 uppercase tracking-wider">Title Score</p>
                  <p className={`text-2xl font-bold mt-1 ${getScoreColor(healthQuery.data.titleScore)}`}>
                    {healthQuery.data.titleScore}
                  </p>
                </div>
                <div className="rounded-xl p-4 bg-gradient-to-br from-white/5 to-white/0 border border-white/5">
                  <p className="text-xs text-gray-400 uppercase tracking-wider">Description</p>
                  <p className={`text-2xl font-bold mt-1 ${getScoreColor(healthQuery.data.descriptionScore)}`}>
                    {healthQuery.data.descriptionScore}
                  </p>
                </div>
                <div className="rounded-xl p-4 bg-gradient-to-br from-white/5 to-white/0 border border-white/5">
                  <p className="text-xs text-gray-400 uppercase tracking-wider">Technical</p>
                  <p className={`text-2xl font-bold mt-1 ${getScoreColor(healthQuery.data.technicalScore)}`}>
                    {healthQuery.data.technicalScore}
                  </p>
                </div>
              </div>

              {/* Issues */}
              <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
                <div className="px-4 py-3 border-b border-white/10 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-yellow-400" />
                  <h3 className="text-sm font-semibold text-white">Issues ({healthQuery.data.issues.length})</h3>
                </div>
                <div className="divide-y divide-white/5 max-h-64 overflow-y-auto">
                  {healthQuery.data.issues.map((issue, i) => (
                    <div key={i} className="px-4 py-3 flex items-start gap-3">
                      {issue.severity === "critical" ? (
                        <XCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                      ) : issue.severity === "warning" ? (
                        <AlertTriangle className="w-4 h-4 text-yellow-400 mt-0.5 shrink-0" />
                      ) : (
                        <CheckCircle className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
                      )}
                      <div>
                        <span className="text-xs text-gray-500 uppercase">{issue.category}</span>
                        <p className="text-sm text-gray-300">{issue.message}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recommendations */}
              <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
                <div className="px-4 py-3 border-b border-white/10 flex items-center gap-2">
                  <Lightbulb className="w-4 h-4 text-cyan-400" />
                  <h3 className="text-sm font-semibold text-white">Recommendations</h3>
                </div>
                <div className="divide-y divide-white/5">
                  {healthQuery.data.recommendations.map((rec, i) => (
                    <div key={i} className="px-4 py-3 flex items-center gap-3">
                      <Zap className="w-4 h-4 text-cyan-400 shrink-0" />
                      <p className="text-sm text-gray-300">{rec}</p>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : null}
        </div>
      )}

      {activeTab === "keywords" && (
        <div className="space-y-6">
          {keywordsQuery.isLoading ? (
            <div className="flex items-center justify-center h-40">
              <RefreshCw className="w-6 h-6 text-blue-400 animate-spin" />
            </div>
          ) : keywordsQuery.data ? (
            <>
              {/* Primary Keywords */}
              <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
                <div className="px-4 py-3 border-b border-white/10 flex items-center gap-2">
                  <Target className="w-4 h-4 text-blue-400" />
                  <h3 className="text-sm font-semibold text-white">Primary Keywords ({keywordsQuery.data.primaryKeywords.length})</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-gray-400 text-xs uppercase border-b border-white/5">
                        <th className="px-4 py-2 text-left">Keyword</th>
                        <th className="px-4 py-2 text-left">Volume</th>
                        <th className="px-4 py-2 text-left">Difficulty</th>
                        <th className="px-4 py-2 text-left">Opportunity</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {keywordsQuery.data.primaryKeywords.map((kw, i) => (
                        <tr key={i} className="hover:bg-white/5">
                          <td className="px-4 py-2 text-gray-200 font-medium">{kw.keyword}</td>
                          <td className="px-4 py-2">
                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                              kw.volume === "high" ? "bg-emerald-500/20 text-emerald-400" :
                              kw.volume === "medium" ? "bg-yellow-500/20 text-yellow-400" :
                              "bg-gray-500/20 text-gray-400"
                            }`}>{kw.volume}</span>
                          </td>
                          <td className="px-4 py-2">
                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                              kw.difficulty === "low" ? "bg-emerald-500/20 text-emerald-400" :
                              kw.difficulty === "medium" ? "bg-yellow-500/20 text-yellow-400" :
                              "bg-red-500/20 text-red-400"
                            }`}>{kw.difficulty}</span>
                          </td>
                          <td className="px-4 py-2">
                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                              kw.opportunity === "high" ? "bg-emerald-500/20 text-emerald-400" :
                              kw.opportunity === "medium" ? "bg-yellow-500/20 text-yellow-400" :
                              "bg-gray-500/20 text-gray-400"
                            }`}>{kw.opportunity}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Long-tail Keywords */}
              <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
                <div className="px-4 py-3 border-b border-white/10 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-cyan-400" />
                  <h3 className="text-sm font-semibold text-white">Long-tail Keywords ({keywordsQuery.data.longTailKeywords.length})</h3>
                </div>
                <div className="divide-y divide-white/5">
                  {keywordsQuery.data.longTailKeywords.map((kw, i) => (
                    <div key={i} className="px-4 py-3 flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-200">{kw.keyword}</p>
                        <p className="text-xs text-gray-500 mt-0.5">Intent: {kw.intent} · Page: {kw.suggestedPage}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Content Gaps */}
              <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
                <div className="px-4 py-3 border-b border-white/10 flex items-center gap-2">
                  <Lightbulb className="w-4 h-4 text-yellow-400" />
                  <h3 className="text-sm font-semibold text-white">Content Gaps</h3>
                </div>
                <div className="divide-y divide-white/5">
                  {keywordsQuery.data.contentGaps.map((gap, i) => (
                    <div key={i} className="px-4 py-3 text-sm text-gray-300">{gap}</div>
                  ))}
                </div>
              </div>

              {/* Competitor Keywords */}
              <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
                <div className="px-4 py-3 border-b border-white/10 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-purple-400" />
                  <h3 className="text-sm font-semibold text-white">Competitor Keywords</h3>
                </div>
                <div className="flex flex-wrap gap-2 p-4">
                  {keywordsQuery.data.competitorKeywords.map((kw, i) => (
                    <span key={i} className="text-xs px-3 py-1 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20">
                      {kw}
                    </span>
                  ))}
                </div>
              </div>
            </>
          ) : null}
        </div>
      )}

      {activeTab === "meta" && (
        <div className="space-y-4">
          {metaQuery.isLoading ? (
            <div className="flex items-center justify-center h-40">
              <RefreshCw className="w-6 h-6 text-blue-400 animate-spin" />
            </div>
          ) : metaQuery.data && metaQuery.data.length > 0 ? (
            metaQuery.data.map((opt, i) => (
              <MetaOptCard key={i} optimization={opt} />
            ))
          ) : (
            <div className="text-center py-12 text-gray-400">
              <FileText className="w-8 h-8 mx-auto mb-3 opacity-50" />
              <p>No meta tag optimizations available. Run an optimization to generate suggestions.</p>
            </div>
          )}
        </div>
      )}

      {activeTab === "structured" && (
        <div className="space-y-4">
          {structuredQuery.isLoading ? (
            <div className="flex items-center justify-center h-40">
              <RefreshCw className="w-6 h-6 text-blue-400 animate-spin" />
            </div>
          ) : structuredQuery.data ? (
            structuredQuery.data.map((schema: any, i: number) => (
              <div key={i} className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
                <div className="px-4 py-3 border-b border-white/10 flex items-center gap-2">
                  <Code className="w-4 h-4 text-cyan-400" />
                  <h3 className="text-sm font-semibold text-white">{schema["@type"]}</h3>
                </div>
                <pre className="p-4 text-xs text-gray-300 overflow-x-auto max-h-64">
                  {JSON.stringify(schema, null, 2)}
                </pre>
              </div>
            ))
          ) : null}
        </div>
      )}

      {activeTab === "pages" && (
        <div className="space-y-4">
          {pagesQuery.isLoading ? (
            <div className="flex items-center justify-center h-40">
              <RefreshCw className="w-6 h-6 text-blue-400 animate-spin" />
            </div>
          ) : pagesQuery.data ? (
            <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-gray-400 text-xs uppercase border-b border-white/5">
                      <th className="px-4 py-2 text-left">Path</th>
                      <th className="px-4 py-2 text-left">Title</th>
                      <th className="px-4 py-2 text-left">Priority</th>
                      <th className="px-4 py-2 text-left">Frequency</th>
                      <th className="px-4 py-2 text-left">Keywords</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {pagesQuery.data.map((page: any, i: number) => (
                      <tr key={i} className="hover:bg-white/5">
                        <td className="px-4 py-2">
                          <a
                            href={`https://www.archibaldtitan.com${page.path}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-400 hover:text-blue-300 flex items-center gap-1"
                          >
                            {page.path}
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </td>
                        <td className="px-4 py-2 text-gray-300 max-w-xs truncate">{page.title}</td>
                        <td className="px-4 py-2">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            page.priority >= 0.8 ? "bg-emerald-500/20 text-emerald-400" :
                            page.priority >= 0.5 ? "bg-yellow-500/20 text-yellow-400" :
                            "bg-gray-500/20 text-gray-400"
                          }`}>{page.priority}</span>
                        </td>
                        <td className="px-4 py-2 text-gray-400">{page.changefreq}</td>
                        <td className="px-4 py-2">
                          <div className="flex flex-wrap gap-1">
                            {page.keywords.slice(0, 3).map((kw: string, j: number) => (
                              <span key={j} className="text-xs px-1.5 py-0.5 rounded bg-white/5 text-gray-400">{kw}</span>
                            ))}
                            {page.keywords.length > 3 && (
                              <span className="text-xs text-gray-500">+{page.keywords.length - 3}</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* How It Works */}
      <div className="rounded-xl border border-white/10 bg-gradient-to-br from-blue-500/5 to-cyan-500/5 p-6">
        <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
          <Zap className="w-5 h-5 text-blue-400" />
          How the Autonomous SEO Engine Works
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-300">
          <div>
            <p className="font-medium text-white mb-1">1. Analyze</p>
            <p>Scans all public pages for meta tags, structured data, keyword density, and technical SEO factors.</p>
          </div>
          <div>
            <p className="font-medium text-white mb-1">2. Optimize</p>
            <p>Uses AI to generate improved titles, descriptions, and keyword recommendations based on search intent.</p>
          </div>
          <div>
            <p className="font-medium text-white mb-1">3. Monitor</p>
            <p>Runs weekly health checks, generates reports, and alerts you when scores drop below thresholds.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// Meta Optimization Card Component
function MetaOptCard({ optimization }: { optimization: any }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Globe className="w-4 h-4 text-blue-400" />
          <span className="text-sm font-medium text-white">{optimization.page}</span>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>
      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-white/5 pt-3">
          <div>
            <p className="text-xs text-gray-500 uppercase">Current Title</p>
            <p className="text-sm text-gray-400">{optimization.currentTitle}</p>
          </div>
          <div>
            <p className="text-xs text-emerald-500 uppercase">Suggested Title</p>
            <p className="text-sm text-emerald-300">{optimization.suggestedTitle}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase">Current Description</p>
            <p className="text-sm text-gray-400">{optimization.currentDescription}</p>
          </div>
          <div>
            <p className="text-xs text-emerald-500 uppercase">Suggested Description</p>
            <p className="text-sm text-emerald-300">{optimization.suggestedDescription}</p>
          </div>
          {optimization.suggestedKeywords && (
            <div>
              <p className="text-xs text-gray-500 uppercase mb-1">Suggested Keywords</p>
              <div className="flex flex-wrap gap-1">
                {optimization.suggestedKeywords.map((kw: string, i: number) => (
                  <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400">{kw}</span>
                ))}
              </div>
            </div>
          )}
          <div className="bg-white/5 rounded-lg p-3">
            <p className="text-xs text-gray-500 uppercase">AI Reasoning</p>
            <p className="text-sm text-gray-300 mt-1">{optimization.reasoning}</p>
          </div>
        </div>
      )}
    </div>
  );
}
