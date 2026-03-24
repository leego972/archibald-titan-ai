import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Shield,
  Activity,
  Database,
  FileCode,
  RotateCcw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Loader2,
  Camera,
  FolderLock,
  History,
  Wrench,
  Zap,
  ChevronDown,
  ChevronUp,
  Heart,
  Eye,
  ArrowDownToLine,
  ListTodo,
  Rocket,
  Filter,
  Plus,
  Trash2,
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// ─── Stats Card ──────────────────────────────────────────────────────
function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: number | string;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <div className="bg-card border border-border/50 rounded-xl p-4 flex items-center gap-4">
      <div
        className={`h-10 w-10 rounded-lg flex items-center justify-center ${color}`}
      >
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

// ─── Health Check Panel ──────────────────────────────────────────────
function HealthCheckPanel() {
  const healthMutation = trpc.selfImprovement.healthCheck.useMutation({
    onSuccess: (data) => {
      if (data.healthy) {
        toast.success("System is healthy");
      } else {
        toast.error("System health issues detected");
      }
    },
    onError: () => toast.error("Health check failed"),
  });

  const result = healthMutation.data;

  return (
    <div className="bg-card border border-border/50 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Heart className="h-5 w-5 text-rose-400" />
          <h3 className="font-semibold">System Health</h3>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => healthMutation.mutate()}
          disabled={healthMutation.isPending}
        >
          {healthMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin mr-1" />
          ) : (
            <Activity className="h-4 w-4 mr-1" />
          )}
          Run Check
        </Button>
      </div>

      {result ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            {result.healthy ? (
              <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Healthy
              </Badge>
            ) : (
              <Badge className="bg-red-500/10 text-red-400 border-red-500/30">
                <XCircle className="h-3 w-3 mr-1" />
                Issues Detected
              </Badge>
            )}
          </div>

          <div className="space-y-2">
            {result.checks.map(
              (
                check: { name: string; passed: boolean; message?: string },
                i: number
              ) => (
                <div
                  key={i}
                  className="flex items-center gap-2 text-sm py-1 px-2 rounded-lg bg-muted/30"
                >
                  {check.passed ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                  ) : (
                    <XCircle className="h-3.5 w-3.5 text-red-400 shrink-0" />
                  )}
                  <span className="font-medium">{check.name}</span>
                  {check.message && (
                    <span className="text-muted-foreground text-xs ml-auto">
                      {check.message}
                    </span>
                  )}
                </div>
              )
            )}
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Click "Run Check" to verify system integrity, database connectivity,
          and critical file presence.
        </p>
      )}
    </div>
  );
}

// ─── Activity Timeline ───────────────────────────────────────────────
function ActivityTimeline() {
  const { data, isLoading } = trpc.selfImprovement.activityTimeline.useQuery(
    { limit: 20 },
    { refetchOnWindowFocus: false }
  );

  if (isLoading) {
    return (
      <div className="bg-card border border-border/50 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <History className="h-5 w-5 text-blue-400" />
          <h3 className="font-semibold">Activity Timeline</h3>
        </div>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  const events = data?.events ?? [];

  return (
    <div className="bg-card border border-border/50 rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <History className="h-5 w-5 text-blue-400" />
        <h3 className="font-semibold">Activity Timeline</h3>
        <Badge variant="outline" className="text-[10px] ml-auto">
          {events.length} events
        </Badge>
      </div>

      {events.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">
          No self-improvement activity yet. When Titan modifies its own code,
          events will appear here.
        </p>
      ) : (
        <div className="space-y-0 relative">
          {/* Timeline line */}
          <div className="absolute left-[15px] top-2 bottom-2 w-px bg-border/50" />

          {events.map((event, i) => (
            <div key={`${event.eventType}-${event.id}`} className="flex gap-3 py-2 relative">
              {/* Timeline dot */}
              <div className="relative z-10 shrink-0">
                {event.eventType === "snapshot" ? (
                  <div className="h-[30px] w-[30px] rounded-full bg-blue-500/10 border border-blue-500/30 flex items-center justify-center">
                    <Camera className="h-3.5 w-3.5 text-blue-400" />
                  </div>
                ) : (
                  <div
                    className={`h-[30px] w-[30px] rounded-full flex items-center justify-center ${
                      "applied" in event && event.applied
                        ? "bg-emerald-500/10 border border-emerald-500/30"
                        : "rolledBack" in event && event.rolledBack
                        ? "bg-amber-500/10 border border-amber-500/30"
                        : "bg-muted border border-border/50"
                    }`}
                  >
                    {"applied" in event && event.applied ? (
                      <Wrench className="h-3.5 w-3.5 text-emerald-400" />
                    ) : "rolledBack" in event && event.rolledBack ? (
                      <RotateCcw className="h-3.5 w-3.5 text-amber-400" />
                    ) : (
                      <FileCode className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                  </div>
                )}
              </div>

              {/* Event content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium">
                    {event.eventType === "snapshot"
                      ? "Snapshot Created"
                      : "action" in event
                      ? event.action.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())
                      : "Event"}
                  </span>
                  {event.eventType === "snapshot" && "isKnownGood" in event && event.isKnownGood && (
                    <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-[10px]">
                      Known Good
                    </Badge>
                  )}
                  {event.eventType === "modification" &&
                    "validationResult" in event && event.validationResult && (
                      <Badge
                        className={`text-[10px] ${
                          event.validationResult === "passed"
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                            : event.validationResult === "failed"
                            ? "bg-red-500/10 text-red-400 border-red-500/30"
                            : "bg-muted text-muted-foreground border-border/50"
                        }`}
                      >
                        {event.validationResult}
                      </Badge>
                    )}
                </div>

                <p className="text-xs text-muted-foreground mt-0.5 truncate">
                  {event.eventType === "snapshot" && "reason" in event
                    ? event.reason
                    : "description" in event
                    ? event.description
                    : ""}
                </p>

                {"targetFile" in event && event.targetFile && (
                  <p className="text-[10px] text-muted-foreground/70 font-mono mt-0.5">
                    {event.targetFile}
                  </p>
                )}

                {"errorMessage" in event && event.errorMessage && (
                  <p className="text-[10px] text-red-400 mt-0.5">
                    {event.errorMessage}
                  </p>
                )}

                <p className="text-[10px] text-muted-foreground/50 mt-1">
                  {new Date(event.createdAt).toLocaleString()}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Snapshots Table ─────────────────────────────────────────────────
function SnapshotsTable() {
  const [expanded, setExpanded] = useState<number | null>(null);
  const { data, isLoading } = trpc.selfImprovement.listSnapshots.useQuery(
    { limit: 10 },
    { refetchOnWindowFocus: false }
  );

  const rollbackMutation = trpc.selfImprovement.rollbackToSnapshot.useMutation({
    onSuccess: () => toast.success("Rolled back successfully"),
    onError: (err) => toast.error(err.message),
  });

  const { data: snapshotDetail } = trpc.selfImprovement.getSnapshot.useQuery(
    { snapshotId: expanded! },
    { enabled: !!expanded, refetchOnWindowFocus: false }
  );

  const snapshots = data?.snapshots ?? [];

  return (
    <div className="bg-card border border-border/50 rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <Camera className="h-5 w-5 text-indigo-400" />
        <h3 className="font-semibold">Snapshots</h3>
        <Badge variant="outline" className="text-[10px] ml-auto">
          {data?.total ?? 0} total
        </Badge>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : snapshots.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">
          No snapshots yet. Snapshots are created automatically before any
          self-modification.
        </p>
      ) : (
        <div className="space-y-2">
          {snapshots.map((snap) => (
            <div key={snap.id} className="border border-border/30 rounded-lg">
              <div
                className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/30 transition-colors"
                onClick={() =>
                  setExpanded(expanded === snap.id ? null : snap.id)
                }
              >
                <Database className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">#{snap.id}</span>
                    <Badge
                      className={`text-[10px] ${
                        snap.status === "active"
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                          : snap.status === "rolled_back"
                          ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                          : "bg-muted text-muted-foreground border-border/50"
                      }`}
                    >
                      {snap.status}
                    </Badge>
                    {snap.isKnownGood === 1 && (
                      <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/30 text-[10px]">
                        <Shield className="h-2.5 w-2.5 mr-0.5" />
                        Known Good
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    {snap.reason}
                  </p>
                </div>
                <span className="text-[10px] text-muted-foreground shrink-0">
                  {snap.fileCount} files
                </span>
                <span className="text-[10px] text-muted-foreground shrink-0">
                  {new Date(snap.createdAt).toLocaleDateString()}
                </span>
                {expanded === snap.id ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
              </div>

              {expanded === snap.id && snapshotDetail && (
                <div className="border-t border-border/30 p-3 bg-muted/10">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium">
                      Files in snapshot:
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs h-7"
                      onClick={() =>
                        rollbackMutation.mutate({ snapshotId: snap.id })
                      }
                      disabled={rollbackMutation.isPending}
                    >
                      {rollbackMutation.isPending ? (
                        <Loader2 className="h-3 w-3 animate-spin mr-1" />
                      ) : (
                        <RotateCcw className="h-3 w-3 mr-1" />
                      )}
                      Rollback to this
                    </Button>
                  </div>
                  <div className="space-y-1">
                    {snapshotDetail.files.map((f) => (
                      <div
                        key={f.id}
                        className="flex items-center gap-2 text-xs py-1 px-2 rounded bg-muted/30"
                      >
                        <FileCode className="h-3 w-3 text-muted-foreground shrink-0" />
                        <span className="font-mono truncate">{f.filePath}</span>
                        <span className="text-muted-foreground/50 text-[10px] ml-auto shrink-0">
                          {f.contentHash.substring(0, 8)}...
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Modifications Table ─────────────────────────────────────────────
function ModificationsTable() {
  const [filter, setFilter] = useState<string | undefined>(undefined);
  const { data, isLoading } = trpc.selfImprovement.listModifications.useQuery(
    {
      limit: 20,
      action: filter as any,
    },
    { refetchOnWindowFocus: false }
  );

  const modifications = data?.modifications ?? [];

  const actionColors: Record<string, string> = {
    modify_file: "text-blue-400 bg-blue-500/10",
    create_file: "text-emerald-400 bg-emerald-500/10",
    delete_file: "text-red-400 bg-red-500/10",
    restart_service: "text-amber-400 bg-amber-500/10",
    rollback: "text-purple-400 bg-purple-500/10",
    validate: "text-cyan-400 bg-cyan-500/10",
    modify_config: "text-orange-400 bg-orange-500/10",
    add_dependency: "text-teal-400 bg-teal-500/10",
  };

  return (
    <div className="bg-card border border-border/50 rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <Wrench className="h-5 w-5 text-amber-400" />
        <h3 className="font-semibold">Modification Log</h3>
        <Badge variant="outline" className="text-[10px] ml-auto">
          {data?.total ?? 0} total
        </Badge>
      </div>

      {/* Filter chips */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        <button
          onClick={() => setFilter(undefined)}
          className={`px-2.5 py-1 rounded-full text-[10px] font-medium transition-colors ${
            !filter
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-muted/80"
          }`}
        >
          All
        </button>
        {[
          "modify_file",
          "create_file",
          "delete_file",
          "restart_service",
          "rollback",
        ].map((action) => (
          <button
            key={action}
            onClick={() => setFilter(action)}
            className={`px-2.5 py-1 rounded-full text-[10px] font-medium transition-colors ${
              filter === action
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {action.replace(/_/g, " ")}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : modifications.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">
          No modifications recorded yet.
        </p>
      ) : (
        <div className="space-y-1.5">
          {modifications.map((mod) => (
            <div
              key={mod.id}
              className="flex items-start gap-3 p-2.5 rounded-lg bg-muted/20 hover:bg-muted/30 transition-colors"
            >
              <div
                className={`px-2 py-0.5 rounded text-[10px] font-medium shrink-0 ${
                  actionColors[mod.action] || "text-muted-foreground bg-muted"
                }`}
              >
                {mod.action.replace(/_/g, " ")}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm truncate">{mod.description}</p>
                {mod.targetFile && (
                  <p className="text-[10px] text-muted-foreground/70 font-mono truncate">
                    {mod.targetFile}
                  </p>
                )}
                {mod.errorMessage && (
                  <p className="text-[10px] text-red-400 truncate">
                    {mod.errorMessage}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {mod.applied === 1 && (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                )}
                {mod.rolledBack === 1 && (
                  <RotateCcw className="h-3.5 w-3.5 text-amber-400" />
                )}
                {mod.validationResult === "failed" && (
                  <XCircle className="h-3.5 w-3.5 text-red-400" />
                )}
                <span className="text-[10px] text-muted-foreground">
                  {new Date(mod.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Safety Config Panel ─────────────────────────────────────────────
function SafetyConfigPanel() {
  const { data } = trpc.selfImprovement.safetyConfig.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

  return (
    <div className="bg-card border border-border/50 rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <FolderLock className="h-5 w-5 text-rose-400" />
        <h3 className="font-semibold">Safety Configuration</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <h4 className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
            <Shield className="h-3 w-3" />
            Protected Files ({data?.protectedFiles.length ?? 0})
          </h4>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {data?.protectedFiles.map((f, i) => (
              <div
                key={i}
                className="text-[11px] font-mono py-1 px-2 rounded bg-red-500/5 text-red-300 border border-red-500/10"
              >
                {f}
              </div>
            )) ?? (
              <p className="text-xs text-muted-foreground">Loading...</p>
            )}
          </div>
        </div>

        <div>
          <h4 className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
            <FolderLock className="h-3 w-3" />
            Allowed Directories ({data?.allowedDirectories.length ?? 0})
          </h4>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {data?.allowedDirectories.map((d, i) => (
              <div
                key={i}
                className="text-[11px] font-mono py-1 px-2 rounded bg-emerald-500/5 text-emerald-300 border border-emerald-500/10"
              >
                {d}
              </div>
            )) ?? (
              <p className="text-xs text-muted-foreground">Loading...</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Build Health Badges ────────────────────────────────────────────
function BuildHealthBadges() {
  const { data: stats, isLoading } =
    trpc.selfImprovement.builderStats.useQuery(undefined, {
      refetchOnWindowFocus: false,
    });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="bg-card border border-border/50 rounded-xl p-4 h-20 animate-pulse"
          />
        ))}
      </div>
    );
  }

  const typeCheckOk = stats?.typeCheck?.status === "success";
  const testsOk = stats?.tests?.status === "success";

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      {/* TypeScript Badge */}
      <div
        className={`rounded-xl border p-4 flex items-center gap-3 ${
          stats?.typeCheck
            ? typeCheckOk
              ? "border-emerald-500/30 bg-emerald-500/5"
              : "border-red-500/30 bg-red-500/5"
            : "border-border/50 bg-card"
        }`}
      >
        <div
          className={`h-10 w-10 rounded-lg flex items-center justify-center ${
            typeCheckOk
              ? "bg-emerald-500/20"
              : stats?.typeCheck
                ? "bg-red-500/20"
                : "bg-muted"
          }`}
        >
          <FileCode
            className={`h-5 w-5 ${
              typeCheckOk
                ? "text-emerald-400"
                : stats?.typeCheck
                  ? "text-red-400"
                  : "text-muted-foreground"
            }`}
          />
        </div>
        <div>
          <div className="text-sm font-medium">
            TypeScript{" "}
            <Badge
              variant={typeCheckOk ? "default" : "destructive"}
              className="ml-1 text-[10px] px-1.5 py-0"
            >
              {stats?.typeCheck ? (typeCheckOk ? "passing" : "failing") : "no data"}
            </Badge>
          </div>
          <div className="text-xs text-muted-foreground">
            {stats?.typeCheck?.summary ?? "No type checks run yet"}
          </div>
        </div>
      </div>

      {/* Tests Badge */}
      <div
        className={`rounded-xl border p-4 flex items-center gap-3 ${
          stats?.tests
            ? testsOk
              ? "border-emerald-500/30 bg-emerald-500/5"
              : "border-red-500/30 bg-red-500/5"
            : "border-border/50 bg-card"
        }`}
      >
        <div
          className={`h-10 w-10 rounded-lg flex items-center justify-center ${
            testsOk
              ? "bg-emerald-500/20"
              : stats?.tests
                ? "bg-red-500/20"
                : "bg-muted"
          }`}
        >
          <Activity
            className={`h-5 w-5 ${
              testsOk
                ? "text-emerald-400"
                : stats?.tests
                  ? "text-red-400"
                  : "text-muted-foreground"
            }`}
          />
        </div>
        <div>
          <div className="text-sm font-medium">
            Tests{" "}
            <Badge
              variant={testsOk ? "default" : "destructive"}
              className="ml-1 text-[10px] px-1.5 py-0"
            >
              {stats?.tests ? (testsOk ? "passing" : "failing") : "no data"}
            </Badge>
          </div>
          <div className="text-xs text-muted-foreground">
            {stats?.tests?.summary ?? "No test runs yet"}
          </div>
        </div>
      </div>

      {/* Overall Pass Rate */}
      <div className="rounded-xl border border-border/50 bg-card p-4 flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-violet-500/20 flex items-center justify-center">
          <Heart className="h-5 w-5 text-violet-400" />
        </div>
        <div>
          <div className="text-sm font-medium">
            Build Health{" "}
            <Badge
              variant="outline"
              className="ml-1 text-[10px] px-1.5 py-0"
            >
              {stats?.passRate ?? 0}% pass rate
            </Badge>
          </div>
          <div className="text-xs text-muted-foreground">
            {stats?.totalRuns ?? 0} total runs · avg {stats?.avgDuration ?? 0}ms
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Builder Activity Feed ──────────────────────────────────────────
function BuilderActivityFeed() {
  const { data, isLoading } =
    trpc.selfImprovement.builderActivity.useQuery(
      { limit: 15 },
      { refetchOnWindowFocus: false }
    );

  return (
    <div className="bg-card border border-border/50 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Activity className="h-4 w-4 text-violet-400" />
        <h3 className="text-sm font-semibold">Builder Activity Feed</h3>
      </div>
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-10 bg-muted/30 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : !data?.activities?.length ? (
        <div className="text-center py-6 text-muted-foreground text-sm">
          No builder activity yet. Use the chat to run type checks, tests, or code modifications.
        </div>
      ) : (
        <div className="space-y-1.5 max-h-[320px] overflow-y-auto pr-1">
          {data.activities.map((a) => (
            <div
              key={a.id}
              className="flex items-center gap-3 px-3 py-2 rounded-lg bg-muted/20 hover:bg-muted/30 transition-colors"
            >
              <div
                className={`h-2 w-2 rounded-full flex-shrink-0 ${
                  a.status === "success"
                    ? "bg-emerald-400"
                    : a.status === "failure"
                      ? "bg-red-400"
                      : "bg-amber-400"
                }`}
              />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium truncate">
                  {a.tool === "self_type_check"
                    ? "Type Check"
                    : a.tool === "self_run_tests"
                      ? "Test Run"
                      : "Code Modify"}
                  {a.durationMs ? (
                    <span className="text-muted-foreground font-normal ml-1">
                      ({(a.durationMs / 1000).toFixed(1)}s)
                    </span>
                  ) : null}
                </div>
                <div className="text-[11px] text-muted-foreground truncate">
                  {a.summary ?? "No summary"}
                </div>
              </div>
              <div className="text-[10px] text-muted-foreground flex-shrink-0">
                {a.createdAt
                  ? new Date(a.createdAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : ""}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Rollback Controls ───────────────────────────────────────────────
function RollbackControls() {
  const rollbackLastGood =
    trpc.selfImprovement.rollbackToLastGood.useMutation({
      onSuccess: (data) => {
        if (data.success) {
          toast.success(`Rolled back to last known good state (${data.filesRestored} files restored)`);
        } else {
          toast.error(data.error || "Rollback failed");
        }
      },
      onError: (err) => toast.error(err.message),
    });

  return (
    <div className="bg-card border border-amber-500/20 rounded-xl p-5">
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle className="h-5 w-5 text-amber-400" />
        <h3 className="font-semibold">Emergency Controls</h3>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        Use these controls if the system is in a broken state after a
        self-modification. Rollback will restore all modified files to their
        last known good snapshot.
      </p>
      <Button
        variant="outline"
        className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
        onClick={() => {
          if (
            confirm(
              "This will rollback all files to the last known good snapshot. Continue?"
            )
          ) {
            rollbackLastGood.mutate();
          }
        }}
        disabled={rollbackLastGood.isPending}
      >
        {rollbackLastGood.isPending ? (
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
        ) : (
          <RotateCcw className="h-4 w-4 mr-2" />
        )}
        Rollback to Last Known Good
      </Button>
    </div>
  );
}

// ─── Main Dashboard ──────────────────────────────────────────────────
export default function SelfImprovementDashboard() {
  const { data: overview, isLoading } =
    trpc.selfImprovement.overview.useQuery(undefined, {
      refetchOnWindowFocus: false,
    });

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-violet-500/20 to-violet-500/5 flex items-center justify-center">
            <Zap className="h-5 w-5 text-violet-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Self-Improvement Engine
            </h1>
            <p className="text-sm text-muted-foreground">
              Monitor and manage Titan's self-modification capabilities
            </p>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="bg-card border border-border/50 rounded-xl p-4 h-20 animate-pulse"
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard
            label="Total Snapshots"
            value={overview?.totalSnapshots ?? 0}
            icon={Camera}
            color="bg-blue-500/10 text-blue-400"
          />
          <StatCard
            label="Known Good"
            value={overview?.knownGoodSnapshots ?? 0}
            icon={Shield}
            color="bg-emerald-500/10 text-emerald-400"
          />
          <StatCard
            label="Modifications"
            value={overview?.totalModifications ?? 0}
            icon={Wrench}
            color="bg-amber-500/10 text-amber-400"
          />
          <StatCard
            label="Applied"
            value={overview?.appliedModifications ?? 0}
            icon={CheckCircle2}
            color="bg-teal-500/10 text-teal-400"
          />
          <StatCard
            label="Rolled Back"
            value={overview?.rolledBackModifications ?? 0}
            icon={RotateCcw}
            color="bg-purple-500/10 text-purple-400"
          />
          <StatCard
            label="Failed Validations"
            value={overview?.failedValidations ?? 0}
            icon={XCircle}
            color="bg-red-500/10 text-red-400"
          />
          <StatCard
            label="Protected Files"
            value={overview?.protectedFileCount ?? 0}
            icon={FolderLock}
            color="bg-rose-500/10 text-rose-400"
          />
          <StatCard
            label="Allowed Dirs"
            value={overview?.allowedDirectoryCount ?? 0}
            icon={Database}
            color="bg-indigo-500/10 text-indigo-400"
          />
        </div>
      )}

      {/* Build Health Badges */}
      <BuildHealthBadges />

      {/* Health Check + Emergency Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <HealthCheckPanel />
        <RollbackControls />
      </div>

      {/* Builder Activity Feed */}
      <BuilderActivityFeed />

      {/* Activity Timeline */}
      <ActivityTimeline />

      {/* Snapshots */}
      <SnapshotsTable />

      {/* Modifications */}
      <ModificationsTable />

      {/* Safety Config */}
      <SafetyConfigPanel />

      {/* Improvement Backlog */}
      <ImprovementBacklogPanel />
    </div>
  );
}

// ─── Task Execution Result Modal ─────────────────────────────────────
function TaskResultModal({
  result,
  onClose,
}: {
  result: {
    taskId?: number;
    title?: string;
    plan?: string;
    modifications?: Array<{ filePath?: string; action?: string; description?: string; applied?: boolean; error?: string }>;
    commitMessage?: string;
    notes?: string;
    warnings?: string[];
    pushed?: boolean;
    pushMessage?: string;
    snapshotId?: number;
    dryRun?: boolean;
    // analysis fields
    summary?: string;
    affectedFiles?: string[];
    approach?: string;
    risks?: string[];
    estimatedComplexity?: string;
    canAutoApply?: boolean;
  } | null;
  onClose: () => void;
}) {
  if (!result) return null;
  const isAnalysis = "summary" in result && result.summary;
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-lg flex items-center gap-2">
            {isAnalysis ? <Eye className="h-5 w-5 text-blue-400" /> : result.dryRun ? <ArrowDownToLine className="h-5 w-5 text-amber-400" /> : <CheckCircle2 className="h-5 w-5 text-emerald-400" />}
            {isAnalysis ? "Task Analysis" : result.dryRun ? "Dry Run Preview" : "Execution Complete"}
          </h3>
          <Button size="sm" variant="ghost" onClick={onClose}>✕</Button>
        </div>
        {isAnalysis ? (
          <div className="space-y-3">
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1">Summary</p>
              <p className="text-sm">{result.summary}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1">Approach</p>
              <p className="text-sm whitespace-pre-wrap">{result.approach}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1">Affected Files ({result.affectedFiles?.length ?? 0})</p>
              <div className="space-y-1">
                {result.affectedFiles?.map((f, i) => (
                  <p key={i} className="text-xs font-mono bg-muted/30 rounded px-2 py-1">{f}</p>
                ))}
              </div>
            </div>
            {result.risks && result.risks.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1">Risks</p>
                <div className="space-y-1">
                  {result.risks.map((r, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs text-amber-400">
                      <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                      {r}
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="text-[10px]">Complexity: {result.estimatedComplexity}</Badge>
              <Badge className={`text-[10px] ${result.canAutoApply ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" : "bg-amber-500/10 text-amber-400 border-amber-500/30"}`}>
                {result.canAutoApply ? "✓ Can Auto-Apply" : "⚠ Manual Review Recommended"}
              </Badge>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {result.plan && (
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1">Plan</p>
                <p className="text-sm">{result.plan}</p>
              </div>
            )}
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1">File Changes ({result.modifications?.length ?? 0})</p>
              <div className="space-y-1">
                {result.modifications?.map((m, i) => (
                  <div key={i} className={`flex items-center gap-2 text-xs rounded px-2 py-1.5 ${
                    m.applied === false ? "bg-red-500/10 text-red-400" : "bg-muted/30"
                  }`}>
                    {m.applied === false ? <XCircle className="h-3 w-3 shrink-0" /> : <CheckCircle2 className="h-3 w-3 text-emerald-400 shrink-0" />}
                    <span className="font-mono">{m.filePath}</span>
                    <Badge variant="outline" className="text-[9px] ml-auto">{m.action}</Badge>
                    {m.error && <span className="text-red-400 text-[10px]">{m.error}</span>}
                  </div>
                ))}
              </div>
            </div>
            {result.commitMessage && (
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1">Commit Message</p>
                <p className="text-xs font-mono bg-muted/30 rounded px-2 py-1.5">{result.commitMessage}</p>
              </div>
            )}
            {result.notes && (
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1">Notes</p>
                <p className="text-sm text-muted-foreground">{result.notes}</p>
              </div>
            )}
            {result.warnings && result.warnings.length > 0 && (
              <div className="space-y-1">
                {result.warnings.map((w, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-amber-400">
                    <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                    {w}
                  </div>
                ))}
              </div>
            )}
            {!result.dryRun && (
              <div className="flex items-center gap-3 pt-2 border-t border-border/30">
                {result.snapshotId && (
                  <Badge variant="outline" className="text-[10px]">Snapshot #{result.snapshotId}</Badge>
                )}
                <Badge className={`text-[10px] ${result.pushed ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" : "bg-muted text-muted-foreground border-border/50"}`}>
                  {result.pushed ? "✓ Pushed to GitHub" : result.pushMessage ?? "Not pushed"}
                </Badge>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Improvement Backlog ─────────────────────────────────────────────
function ImprovementBacklogPanel() {
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [activeTaskId, setActiveTaskId] = useState<number | null>(null);
  const [taskResult, setTaskResult] = useState<any>(null);

  const { data: tasks, isLoading, refetch } = trpc.improvementBacklog.list.useQuery(
    {
      category: categoryFilter === "all" ? undefined : categoryFilter as any,
      priority: priorityFilter === "all" ? undefined : priorityFilter as any,
      status: statusFilter === "all" ? undefined : statusFilter as any,
    },
    { refetchOnWindowFocus: false }
  );

  const { data: stats } = trpc.improvementBacklog.stats.useQuery(undefined, { refetchOnWindowFocus: false });

  const seedMutation = trpc.improvementBacklog.seed.useMutation({
    onSuccess: (data) => { toast.success(data.message); refetch(); },
    onError: (err) => toast.error(err.message),
  });

  const analyzeTaskMutation = trpc.improvementBacklog.analyzeTask.useMutation({
    onSuccess: (data) => {
      setActiveTaskId(null);
      setTaskResult(data);
      toast.success("Analysis complete");
    },
    onError: (err) => { setActiveTaskId(null); toast.error(`Analysis failed: ${err.message}`); },
  });

  const executeTaskMutation = trpc.improvementBacklog.executeTask.useMutation({
    onSuccess: (data) => {
      setActiveTaskId(null);
      setTaskResult(data);
      refetch();
      if (data.dryRun) {
        toast.success("Dry run complete — no changes applied");
      } else {
        toast.success("Task executed successfully!");
      }
    },
    onError: (err) => {
      setActiveTaskId(null);
      refetch();
      toast.error(`Execution failed: ${err.message}`);
    },
  });

  const updateStatusMutation = trpc.improvementBacklog.updateStatus.useMutation({
    onSuccess: () => { toast.success("Task updated"); refetch(); },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.improvementBacklog.delete.useMutation({
    onSuccess: () => { toast.success("Task deleted"); refetch(); },
    onError: (err) => toast.error(err.message),
  });

  const priorityColors: Record<string, string> = {
    critical: "bg-red-500/10 text-red-400 border-red-500/30",
    high: "bg-orange-500/10 text-orange-400 border-orange-500/30",
    medium: "bg-blue-500/10 text-blue-400 border-blue-500/30",
    low: "bg-slate-500/10 text-slate-400 border-slate-500/30",
  };

  const categoryIcons: Record<string, React.ReactNode> = {
    performance: <Zap className="h-3.5 w-3.5 text-amber-400" />,
    security: <Shield className="h-3.5 w-3.5 text-red-400" />,
    ux: <Eye className="h-3.5 w-3.5 text-purple-400" />,
    feature: <Rocket className="h-3.5 w-3.5 text-blue-400" />,
    reliability: <Heart className="h-3.5 w-3.5 text-rose-400" />,
    testing: <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />,
    infrastructure: <Database className="h-3.5 w-3.5 text-cyan-400" />,
  };

  const statusColors: Record<string, string> = {
    pending: "bg-muted text-muted-foreground border-border/50",
    in_progress: "bg-blue-500/10 text-blue-400 border-blue-500/30",
    completed: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    failed: "bg-red-500/10 text-red-400 border-red-500/30",
    skipped: "bg-slate-500/10 text-slate-400 border-slate-500/30",
  };

  const isRunning = analyzeTaskMutation.isPending || executeTaskMutation.isPending;

  return (
    <>
      {taskResult && <TaskResultModal result={taskResult} onClose={() => setTaskResult(null)} />}
      <div className="bg-card border border-border/50 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <ListTodo className="h-5 w-5 text-violet-400" />
            <h3 className="font-semibold">Improvement Backlog</h3>
            {stats && (
              <Badge variant="outline" className="text-[10px]">
                {stats.completed}/{stats.total} done
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            {tasks && tasks.length === 0 && (
              <Button size="sm" variant="outline" onClick={() => seedMutation.mutate()} disabled={seedMutation.isPending}>
                {seedMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
                Seed Tasks
              </Button>
            )}
          </div>
        </div>

        {/* AI Execution Info Banner */}
        <div className="bg-violet-500/5 border border-violet-500/20 rounded-lg p-3 mb-4 flex items-start gap-3">
          <Zap className="h-4 w-4 text-violet-400 mt-0.5 shrink-0" />
          <div className="text-xs text-muted-foreground">
            <span className="text-violet-300 font-medium">AI-Powered Execution</span> — Each task can be analysed, dry-run previewed, or fully executed by Titan's AI engine.
            Execution reads relevant files, generates code changes, validates them, applies them, and pushes to GitHub automatically.
          </div>
        </div>

        {/* Stats Summary */}
        {stats && stats.total > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-4">
            <div className="bg-muted/30 rounded-lg p-2 text-center">
              <p className="text-lg font-bold">{stats.pending}</p>
              <p className="text-[10px] text-muted-foreground">Pending</p>
            </div>
            <div className="bg-blue-500/5 rounded-lg p-2 text-center">
              <p className="text-lg font-bold text-blue-400">{stats.inProgress}</p>
              <p className="text-[10px] text-muted-foreground">In Progress</p>
            </div>
            <div className="bg-emerald-500/5 rounded-lg p-2 text-center">
              <p className="text-lg font-bold text-emerald-400">{stats.completed}</p>
              <p className="text-[10px] text-muted-foreground">Completed</p>
            </div>
            <div className="bg-red-500/5 rounded-lg p-2 text-center">
              <p className="text-lg font-bold text-red-400">{stats.failed}</p>
              <p className="text-[10px] text-muted-foreground">Failed</p>
            </div>
            <div className="bg-muted/20 rounded-lg p-2 text-center">
              <p className="text-lg font-bold text-muted-foreground">{stats.skipped}</p>
              <p className="text-[10px] text-muted-foreground">Skipped</p>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="h-8 w-[140px] text-xs"><SelectValue placeholder="Category" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="performance">Performance</SelectItem>
              <SelectItem value="security">Security</SelectItem>
              <SelectItem value="ux">UX</SelectItem>
              <SelectItem value="feature">Feature</SelectItem>
              <SelectItem value="reliability">Reliability</SelectItem>
              <SelectItem value="testing">Testing</SelectItem>
              <SelectItem value="infrastructure">Infrastructure</SelectItem>
            </SelectContent>
          </Select>
          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="h-8 w-[120px] text-xs"><SelectValue placeholder="Priority" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priorities</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-8 w-[120px] text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
              <SelectItem value="skipped">Skipped</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Task List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : !tasks || tasks.length === 0 ? (
          <div className="text-center py-8">
            <ListTodo className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No improvement tasks yet.</p>
            <p className="text-xs text-muted-foreground/70 mt-1">Click "Seed Tasks" to populate the backlog with curated improvements.</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[600px] overflow-y-auto">
            {tasks.map((task) => {
              const isThisRunning = activeTaskId === task.id && isRunning;
              return (
                <div key={task.id} className={`border rounded-lg p-3 transition-colors ${
                  task.status === "in_progress" ? "border-blue-500/30 bg-blue-500/5" :
                  task.status === "completed" ? "border-emerald-500/20 bg-emerald-500/5" :
                  task.status === "failed" ? "border-red-500/20 bg-red-500/5" :
                  "border-border/30 hover:bg-muted/10"
                }`}>
                  <div className="flex items-start gap-3">
                    <div className="shrink-0 mt-0.5">
                      {isThisRunning ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-violet-400" />
                      ) : (
                        categoryIcons[task.category] || <FileCode className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-sm font-medium ${task.status === "completed" ? "line-through text-muted-foreground" : ""}`}>
                          {task.title}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{task.description}</p>
                      {task.completionNotes && task.status !== "pending" && (
                        <p className="text-[10px] text-muted-foreground/60 mt-1 line-clamp-2 italic">{task.completionNotes}</p>
                      )}
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <Badge className={`text-[10px] ${priorityColors[task.priority] || ""}`}>{task.priority}</Badge>
                        <Badge className={`text-[10px] ${statusColors[task.status] || ""}`}>{task.status.replace("_", " ")}</Badge>
                        <Badge variant="outline" className="text-[10px]">{task.complexity}</Badge>
                        <span className="text-[10px] text-muted-foreground/50 ml-auto">~{task.estimatedFiles} file{(task.estimatedFiles ?? 1) > 1 ? "s" : ""}</span>
                      </div>
                    </div>
                    {/* Action Buttons */}
                    <div className="flex items-center gap-1 shrink-0">
                      {task.status === "pending" && (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs text-blue-400 hover:text-blue-300 hover:bg-blue-500/10"
                            onClick={() => { setActiveTaskId(task.id); analyzeTaskMutation.mutate({ id: task.id }); }}
                            disabled={isRunning}
                            title="Analyse — AI identifies affected files and creates a plan (no changes applied)"
                          >
                            {isThisRunning && analyzeTaskMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Eye className="h-3 w-3" />}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs text-amber-400 hover:text-amber-300 hover:bg-amber-500/10"
                            onClick={() => { setActiveTaskId(task.id); executeTaskMutation.mutate({ id: task.id, dryRun: true }); }}
                            disabled={isRunning}
                            title="Dry Run — AI generates changes but does NOT apply them"
                          >
                            {isThisRunning && executeTaskMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <ArrowDownToLine className="h-3 w-3" />}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10"
                            onClick={() => {
                              if (confirm(`Execute task "${task.title}"?\n\nThis will:\n1. Generate code changes via AI\n2. Validate them\n3. Apply them to the codebase\n4. Run health check\n5. Push to GitHub\n\nA snapshot will be created first for rollback.`)) {
                                setActiveTaskId(task.id);
                                executeTaskMutation.mutate({ id: task.id, dryRun: false });
                              }
                            }}
                            disabled={isRunning}
                            title="Execute — AI generates, validates, applies changes and pushes to GitHub"
                          >
                            {isThisRunning && executeTaskMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Rocket className="h-3 w-3" />}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs text-muted-foreground hover:text-muted-foreground/70"
                            onClick={() => updateStatusMutation.mutate({ id: task.id, status: "skipped" })}
                            disabled={isRunning}
                            title="Skip this task"
                          >
                            <ArrowDownToLine className="h-3 w-3 rotate-90" />
                          </Button>
                        </>
                      )}
                      {task.status === "failed" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs text-amber-400 hover:text-amber-300"
                          onClick={() => updateStatusMutation.mutate({ id: task.id, status: "pending" })}
                          disabled={isRunning}
                          title="Reset to pending"
                        >
                          <RotateCcw className="h-3 w-3" />
                        </Button>
                      )}
                      {task.status === "skipped" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs text-muted-foreground"
                          onClick={() => updateStatusMutation.mutate({ id: task.id, status: "pending" })}
                          disabled={isRunning}
                          title="Restore to pending"
                        >
                          <RotateCcw className="h-3 w-3" />
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs text-muted-foreground/40 hover:text-red-400"
                        onClick={() => { if (confirm("Delete this task?")) deleteMutation.mutate({ id: task.id }); }}
                        disabled={isRunning}
                        title="Delete task"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Legend */}
        {tasks && tasks.length > 0 && (
          <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border/30 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1"><Eye className="h-3 w-3 text-blue-400" /> Analyse</span>
            <span className="flex items-center gap-1"><ArrowDownToLine className="h-3 w-3 text-amber-400" /> Dry Run</span>
            <span className="flex items-center gap-1"><Rocket className="h-3 w-3 text-emerald-400" /> Execute</span>
            <span className="flex items-center gap-1"><RotateCcw className="h-3 w-3" /> Reset</span>
            <span className="flex items-center gap-1"><Trash2 className="h-3 w-3" /> Delete</span>
          </div>
        )}
      </div>
    </>
  );
}
