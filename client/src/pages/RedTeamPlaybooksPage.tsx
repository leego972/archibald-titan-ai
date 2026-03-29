import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  Shield, Play, Square, Trash2, ChevronRight, Clock, CheckCircle2,
  XCircle, AlertTriangle, Loader2, Target, FileText, RefreshCw,
  Filter, Search, BookOpen, Zap, Lock, Globe, User, Server,
  Copy, Download, Eye
} from "lucide-react";
import ReactMarkdown from "react-markdown";

// ─── Types ────────────────────────────────────────────────────────────────────
interface PlaybookStep {
  id: string;
  name: string;
  tool: string;
  description: string;
  status: "pending" | "running" | "completed" | "failed" | "skipped";
  startedAt?: string;
  completedAt?: string;
  result?: unknown;
  error?: string;
}

interface PlaybookRun {
  id: string;
  playbookId: string;
  playbookName: string;
  target: string;
  status: "running" | "completed" | "failed" | "cancelled";
  steps: PlaybookStep[];
  startedAt: string;
  completedAt?: string;
  report?: string;
  findings: Array<{
    severity: "critical" | "high" | "medium" | "low" | "info";
    title: string;
    description: string;
    tool: string;
    evidence?: string;
  }>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const DIFFICULTY_COLORS: Record<string, string> = {
  beginner: "bg-green-500/20 text-green-400 border-green-500/30",
  intermediate: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  advanced: "bg-red-500/20 text-red-400 border-red-500/30",
};

const SEVERITY_COLORS: Record<string, string> = {
  critical: "bg-red-600 text-white",
  high: "bg-orange-500 text-white",
  medium: "bg-yellow-500 text-black",
  low: "bg-blue-500 text-white",
  info: "bg-gray-500 text-white",
};

const STEP_ICONS: Record<string, React.ReactNode> = {
  pending: <div className="w-3 h-3 rounded-full bg-gray-500" />,
  running: <Loader2 className="w-3 h-3 text-blue-400 animate-spin" />,
  completed: <CheckCircle2 className="w-3 h-3 text-green-400" />,
  failed: <XCircle className="w-3 h-3 text-red-400" />,
  skipped: <div className="w-3 h-3 rounded-full bg-gray-600" />,
};

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  "Reconnaissance": <Search className="w-4 h-4" />,
  "Vulnerability Assessment": <AlertTriangle className="w-4 h-4" />,
  "Social Engineering": <User className="w-4 h-4" />,
  "Infrastructure": <Server className="w-4 h-4" />,
  "OSINT": <Globe className="w-4 h-4" />,
  "API Security": <Zap className="w-4 h-4" />,
};

// ─── Component ────────────────────────────────────────────────────────────────
export default function RedTeamPlaybooksPage() {
  const [activeTab, setActiveTab] = useState<"library" | "runs" | "run-detail">("library");
  const [selectedPlaybookId, setSelectedPlaybookId] = useState<string | null>(null);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [target, setTarget] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [difficultyFilter, setDifficultyFilter] = useState<string | null>(null);
  const [reportView, setReportView] = useState<"report" | "findings" | "steps">("report");

  // ── Queries ────────────────────────────────────────────────────────────────
  const { data: playbooksData, isLoading: playbooksLoading } = trpc.redTeamPlaybooks.listPlaybooks.useQuery(
    { category: categoryFilter ?? undefined, difficulty: (difficultyFilter as any) ?? undefined },
    { refetchOnWindowFocus: false }
  );

  const { data: categoriesData } = trpc.redTeamPlaybooks.getCategories.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

  const { data: runsData, refetch: refetchRuns } = trpc.redTeamPlaybooks.listRuns.useQuery(
    { limit: 20 },
    { refetchInterval: 3000 }
  );

  const { data: runDetail, refetch: refetchRunDetail } = trpc.redTeamPlaybooks.getRun.useQuery(
    { runId: selectedRunId! },
    { enabled: !!selectedRunId, refetchInterval: 2000 }
  );

  // ── Mutations ──────────────────────────────────────────────────────────────
  const startRun = trpc.redTeamPlaybooks.startRun.useMutation({
    onSuccess: (data) => {
      toast.success("Playbook started", { description: `Run ID: ${data.runId}` });
      setSelectedRunId(data.runId);
      setActiveTab("run-detail");
      refetchRuns();
    },
    onError: (err) => {
      toast.error("Failed to start playbook", { description: err.message });
    },
  });

  const cancelRun = trpc.redTeamPlaybooks.cancelRun.useMutation({
    onSuccess: () => {
      toast.success("Run cancelled");
      refetchRuns();
      refetchRunDetail();
    },
  });

  const deleteRun = trpc.redTeamPlaybooks.deleteRun.useMutation({
    onSuccess: () => {
      toast.success("Run deleted");
      setSelectedRunId(null);
      setActiveTab("runs");
      refetchRuns();
    },
  });

  // ── Helpers ────────────────────────────────────────────────────────────────
  const filteredPlaybooks = (playbooksData?.playbooks ?? []).filter((p) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q) ||
      p.tags.some((t) => t.includes(q))
    );
  });

  const selectedPlaybook = filteredPlaybooks.find((p) => p.id === selectedPlaybookId);

  const getRunProgress = (run: PlaybookRun) => {
    const done = run.steps.filter((s) => s.status === "completed" || s.status === "failed" || s.status === "skipped").length;
    return Math.round((done / run.steps.length) * 100);
  };

  const getStatusColor = (status: string) => {
    if (status === "running") return "text-blue-400";
    if (status === "completed") return "text-green-400";
    if (status === "failed") return "text-red-400";
    if (status === "cancelled") return "text-gray-400";
    return "text-gray-400";
  };

  const handleStartRun = () => {
    if (!selectedPlaybookId) {
      toast.error("Select a playbook first");
      return;
    }
    if (!target.trim()) {
      toast.error("Enter a target", { description: "e.g. example.com or 192.168.1.1" });
      return;
    }
    startRun.mutate({ playbookId: selectedPlaybookId, target: target.trim() });
  };

  const copyReport = () => {
    if (runDetail?.run.report) {
      navigator.clipboard.writeText(runDetail.run.report);
      toast.success("Report copied to clipboard");
    }
  };

  const downloadReport = () => {
    if (!runDetail?.run.report) return;
    const blob = new Blob([runDetail.run.report], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${runDetail.run.playbookName.replace(/\s+/g, "_")}_${runDetail.run.target}_report.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="border-b border-border px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-500/10 rounded-lg border border-red-500/20">
              <Shield className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <h1 className="text-lg font-semibold">Red Team Playbooks</h1>
              <p className="text-sm text-muted-foreground">Pre-built attack chains for structured security assessments</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-red-400 border-red-500/30 bg-red-500/10">
              Cyber+ / Titan
            </Badge>
            <Button variant="outline" size="sm" onClick={() => { refetchRuns(); }}>
              <RefreshCw className="w-4 h-4 mr-1" />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="flex-1 flex flex-col overflow-hidden">
        <div className="border-b border-border px-6">
          <TabsList className="bg-transparent h-10 p-0 gap-4">
            <TabsTrigger value="library" className="data-[state=active]:border-b-2 data-[state=active]:border-red-400 rounded-none pb-2">
              <BookOpen className="w-4 h-4 mr-1.5" />
              Playbook Library
            </TabsTrigger>
            <TabsTrigger value="runs" className="data-[state=active]:border-b-2 data-[state=active]:border-red-400 rounded-none pb-2">
              <Play className="w-4 h-4 mr-1.5" />
              Active Runs
              {(runsData?.runs ?? []).filter((r) => r.status === "running").length > 0 && (
                <Badge className="ml-1.5 bg-blue-500 text-white text-xs h-4 px-1">
                  {(runsData?.runs ?? []).filter((r) => r.status === "running").length}
                </Badge>
              )}
            </TabsTrigger>
            {selectedRunId && (
              <TabsTrigger value="run-detail" className="data-[state=active]:border-b-2 data-[state=active]:border-red-400 rounded-none pb-2">
                <Eye className="w-4 h-4 mr-1.5" />
                Run Detail
              </TabsTrigger>
            )}
          </TabsList>
        </div>

        {/* ── Library Tab ─────────────────────────────────────────────────── */}
        <TabsContent value="library" className="flex-1 overflow-hidden m-0">
          <div className="flex h-full">
            {/* Left: Playbook List */}
            <div className="w-80 border-r border-border flex flex-col">
              {/* Search & Filters */}
              <div className="p-4 space-y-3 border-b border-border">
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search playbooks..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 h-9"
                  />
                </div>
                <div className="flex gap-2 flex-wrap">
                  {(categoriesData?.categories ?? []).map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setCategoryFilter(categoryFilter === cat ? null : cat)}
                      className={`text-xs px-2 py-1 rounded border transition-colors ${
                        categoryFilter === cat
                          ? "bg-red-500/20 border-red-500/40 text-red-400"
                          : "border-border text-muted-foreground hover:border-red-500/30"
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Playbook List */}
              <ScrollArea className="flex-1">
                {playbooksLoading ? (
                  <div className="flex items-center justify-center h-32">
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredPlaybooks.length === 0 ? (
                  <div className="p-4 text-center text-muted-foreground text-sm">No playbooks found</div>
                ) : (
                  <div className="p-2 space-y-1">
                    {filteredPlaybooks.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => setSelectedPlaybookId(p.id)}
                        className={`w-full text-left p-3 rounded-lg border transition-all ${
                          selectedPlaybookId === p.id
                            ? "bg-red-500/10 border-red-500/30"
                            : "border-transparent hover:border-border hover:bg-muted/30"
                        } ${!p.accessible ? "opacity-50" : ""}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 mb-1">
                              {CATEGORY_ICONS[p.category] ?? <Shield className="w-4 h-4" />}
                              <span className="text-sm font-medium truncate">{p.name}</span>
                            </div>
                            <p className="text-xs text-muted-foreground line-clamp-2">{p.description}</p>
                          </div>
                          {!p.accessible && <Lock className="w-3 h-3 text-muted-foreground shrink-0 mt-0.5" />}
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          <Badge className={`text-xs border ${DIFFICULTY_COLORS[p.difficulty]}`}>
                            {p.difficulty}
                          </Badge>
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            ~{p.estimatedMinutes}m
                          </span>
                          <span className="text-xs text-muted-foreground">{p.steps.length} steps</span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>

            {/* Right: Playbook Detail + Launch */}
            <div className="flex-1 flex flex-col overflow-hidden">
              {selectedPlaybook ? (
                <>
                  <div className="p-6 border-b border-border">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          {CATEGORY_ICONS[selectedPlaybook.category] ?? <Shield className="w-5 h-5" />}
                          <h2 className="text-xl font-semibold">{selectedPlaybook.name}</h2>
                        </div>
                        <p className="text-muted-foreground">{selectedPlaybook.description}</p>
                        <div className="flex items-center gap-3 mt-3">
                          <Badge className={`border ${DIFFICULTY_COLORS[selectedPlaybook.difficulty]}`}>
                            {selectedPlaybook.difficulty}
                          </Badge>
                          <span className="text-sm text-muted-foreground flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            ~{selectedPlaybook.estimatedMinutes} minutes
                          </span>
                          <span className="text-sm text-muted-foreground">{selectedPlaybook.steps.length} steps</span>
                          <Badge variant="outline" className="text-xs">
                            {selectedPlaybook.tier === "titan" ? "Titan only" : "Cyber+"}
                          </Badge>
                        </div>
                        <div className="flex gap-1.5 mt-2">
                          {selectedPlaybook.tags.map((tag) => (
                            <span key={tag} className="text-xs bg-muted px-2 py-0.5 rounded text-muted-foreground">
                              #{tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Launch Controls */}
                    {selectedPlaybook.accessible ? (
                      <div className="flex items-center gap-3 mt-4">
                        <Input
                          placeholder="Target (e.g. example.com, 192.168.1.1)"
                          value={target}
                          onChange={(e) => setTarget(e.target.value)}
                          className="max-w-xs"
                          onKeyDown={(e) => e.key === "Enter" && handleStartRun()}
                        />
                        <Button
                          onClick={handleStartRun}
                          disabled={startRun.isPending || !target.trim()}
                          className="bg-red-600 hover:bg-red-700 text-white"
                        >
                          {startRun.isPending ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          ) : (
                            <Play className="w-4 h-4 mr-2" />
                          )}
                          Launch Playbook
                        </Button>
                      </div>
                    ) : (
                      <div className="mt-4 p-3 bg-muted/30 rounded-lg border border-border flex items-center gap-2">
                        <Lock className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">
                          Upgrade to {selectedPlaybook.tier === "titan" ? "Titan" : "Cyber+"} to access this playbook
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Steps Preview */}
                  <ScrollArea className="flex-1 p-6">
                    <h3 className="text-sm font-medium text-muted-foreground mb-4 uppercase tracking-wider">Execution Steps</h3>
                    <div className="space-y-3">
                      {selectedPlaybook.steps.map((step, i) => (
                        <div key={step.id} className="flex items-start gap-3">
                          <div className="flex flex-col items-center">
                            <div className="w-7 h-7 rounded-full bg-muted border border-border flex items-center justify-center text-xs font-mono text-muted-foreground">
                              {i + 1}
                            </div>
                            {i < selectedPlaybook.steps.length - 1 && (
                              <div className="w-px h-6 bg-border mt-1" />
                            )}
                          </div>
                          <div className="flex-1 pb-2">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">{step.name}</span>
                              <Badge variant="outline" className="text-xs text-muted-foreground">
                                {step.tool}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">{step.description}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center">
                    <Shield className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-30" />
                    <p className="text-muted-foreground">Select a playbook to view details and launch</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* ── Runs Tab ─────────────────────────────────────────────────────── */}
        <TabsContent value="runs" className="flex-1 overflow-hidden m-0 p-6">
          {(runsData?.runs ?? []).length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <Target className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-30" />
                <p className="text-muted-foreground">No playbook runs yet</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => setActiveTab("library")}
                >
                  Browse Playbooks
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {(runsData?.runs ?? []).map((run) => (
                <Card
                  key={run.id}
                  className="cursor-pointer hover:border-red-500/30 transition-colors"
                  onClick={() => {
                    setSelectedRunId(run.id);
                    setActiveTab("run-detail");
                  }}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${
                          run.status === "running" ? "bg-blue-400 animate-pulse" :
                          run.status === "completed" ? "bg-green-400" :
                          run.status === "failed" ? "bg-red-400" : "bg-gray-400"
                        }`} />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{run.playbookName}</span>
                            <span className="text-muted-foreground">→</span>
                            <span className="text-sm font-mono text-muted-foreground">{run.target}</span>
                          </div>
                          <div className="flex items-center gap-3 mt-1">
                            <span className={`text-xs capitalize ${getStatusColor(run.status)}`}>
                              {run.status}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {new Date(run.startedAt).toLocaleString()}
                            </span>
                            {run.findings.length > 0 && (
                              <span className="text-xs text-orange-400">
                                {run.findings.filter((f) => f.severity === "critical" || f.severity === "high").length} critical/high findings
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {run.status === "running" && (
                          <div className="w-24">
                            <Progress value={getRunProgress(run)} className="h-1.5" />
                            <span className="text-xs text-muted-foreground mt-0.5 block text-right">
                              {getRunProgress(run)}%
                            </span>
                          </div>
                        )}
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── Run Detail Tab ────────────────────────────────────────────────── */}
        <TabsContent value="run-detail" className="flex-1 overflow-hidden m-0">
          {runDetail ? (
            <div className="flex h-full">
              {/* Left: Steps */}
              <div className="w-72 border-r border-border flex flex-col">
                <div className="p-4 border-b border-border">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">{runDetail.run.playbookName}</span>
                    <div className="flex gap-1">
                      {runDetail.run.status === "running" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-red-400 hover:text-red-300"
                          onClick={() => cancelRun.mutate({ runId: runDetail.run.id })}
                        >
                          <Square className="w-3.5 h-3.5" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-red-400"
                        onClick={() => deleteRun.mutate({ runId: runDetail.run.id })}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground font-mono mb-2">{runDetail.run.target}</div>
                  <Progress value={getRunProgress(runDetail.run)} className="h-1.5 mb-1" />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span className={`capitalize ${getStatusColor(runDetail.run.status)}`}>
                      {runDetail.run.status}
                    </span>
                    <span>{getRunProgress(runDetail.run)}%</span>
                  </div>
                </div>

                <ScrollArea className="flex-1 p-3">
                  <div className="space-y-2">
                    {runDetail.run.steps.map((step, i) => (
                      <div key={step.id} className="flex items-start gap-2 p-2 rounded-lg hover:bg-muted/30">
                        <div className="mt-0.5">{STEP_ICONS[step.status]}</div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium truncate">{step.name}</div>
                          <div className="text-xs text-muted-foreground">{step.tool}</div>
                          {step.error && (
                            <div className="text-xs text-red-400 mt-0.5 truncate" title={step.error}>
                              {step.error}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>

              {/* Right: Report + Findings */}
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="flex items-center justify-between px-6 py-3 border-b border-border">
                  <div className="flex gap-2">
                    {(["report", "findings", "steps"] as const).map((v) => (
                      <button
                        key={v}
                        onClick={() => setReportView(v)}
                        className={`text-sm px-3 py-1 rounded capitalize transition-colors ${
                          reportView === v
                            ? "bg-red-500/20 text-red-400"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {v}
                        {v === "findings" && runDetail.run.findings.length > 0 && (
                          <span className="ml-1 text-xs bg-orange-500 text-white rounded-full px-1.5 py-0.5">
                            {runDetail.run.findings.length}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                  {runDetail.run.status === "completed" && (
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" onClick={copyReport}>
                        <Copy className="w-3.5 h-3.5 mr-1" />
                        Copy
                      </Button>
                      <Button variant="ghost" size="sm" onClick={downloadReport}>
                        <Download className="w-3.5 h-3.5 mr-1" />
                        Download
                      </Button>
                    </div>
                  )}
                </div>

                <ScrollArea className="flex-1 p-6">
                  {reportView === "report" && (
                    <>
                      {runDetail.run.status === "running" ? (
                        <div className="flex items-center justify-center h-32 gap-3">
                          <Loader2 className="w-5 h-5 animate-spin text-blue-400" />
                          <span className="text-muted-foreground">Generating report...</span>
                        </div>
                      ) : runDetail.run.report ? (
                        <div className="prose prose-sm prose-invert max-w-none">
                          <ReactMarkdown>{runDetail.run.report}</ReactMarkdown>
                        </div>
                      ) : (
                        <div className="text-center text-muted-foreground">
                          <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
                          <p>Report not yet available</p>
                        </div>
                      )}
                    </>
                  )}

                  {reportView === "findings" && (
                    <div className="space-y-3">
                      {runDetail.run.findings.length === 0 ? (
                        <div className="text-center text-muted-foreground py-8">
                          <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-green-400 opacity-50" />
                          <p>No findings yet</p>
                        </div>
                      ) : (
                        runDetail.run.findings.map((f, i) => (
                          <Card key={i} className="border-border">
                            <CardContent className="p-4">
                              <div className="flex items-start gap-3">
                                <Badge className={`text-xs shrink-0 ${SEVERITY_COLORS[f.severity]}`}>
                                  {f.severity.toUpperCase()}
                                </Badge>
                                <div>
                                  <p className="font-medium text-sm">{f.title}</p>
                                  <p className="text-xs text-muted-foreground mt-1">{f.description}</p>
                                  {f.evidence && (
                                    <pre className="text-xs bg-muted p-2 rounded mt-2 overflow-x-auto">
                                      {f.evidence}
                                    </pre>
                                  )}
                                  <span className="text-xs text-muted-foreground mt-1 block">Tool: {f.tool}</span>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))
                      )}
                    </div>
                  )}

                  {reportView === "steps" && (
                    <div className="space-y-4">
                      {runDetail.run.steps.map((step) => (
                        <div key={step.id} className="border border-border rounded-lg p-4">
                          <div className="flex items-center gap-2 mb-2">
                            {STEP_ICONS[step.status]}
                            <span className="font-medium text-sm">{step.name}</span>
                            <Badge variant="outline" className="text-xs">{step.tool}</Badge>
                            <span className={`text-xs capitalize ml-auto ${
                              step.status === "completed" ? "text-green-400" :
                              step.status === "failed" ? "text-red-400" :
                              step.status === "running" ? "text-blue-400" : "text-gray-400"
                            }`}>
                              {step.status}
                            </span>
                          </div>
                          {step.error && (
                            <div className="text-xs text-red-400 bg-red-500/10 p-2 rounded">
                              Error: {step.error}
                            </div>
                          )}
                          {step.result != null && (
                            <details className="mt-2">
                              <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                                View raw result
                              </summary>
                              <pre className="text-xs bg-muted p-2 rounded mt-1 overflow-x-auto max-h-48">
                                {JSON.stringify(step.result as Record<string, unknown>, null, 2)}
                              </pre>
                            </details>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
