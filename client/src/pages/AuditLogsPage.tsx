import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { useSubscription } from "@/hooks/useSubscription";
import { UpgradeDialog } from "@/components/UpgradePrompt";
import { toast } from "sonner";
import {
  ScrollText,
  Search,
  ChevronLeft,
  ChevronRight,
  Activity,
  Clock,
  Filter,
  User,
  Key,
  Users,
  Download,
  Zap,
  Shield,
  Settings,
  Trash2,
  FileDown,
  Calendar,
  Loader2,
} from "lucide-react";
import { useState, useCallback } from "react";

const ACTION_ICONS: Record<string, any> = {
  "apiKey.create": Key,
  "apiKey.revoke": Trash2,
  "team.addMember": Users,
  "team.removeMember": Trash2,
  "team.updateRole": Shield,
  "credential.export": Download,
  "job.create": Zap,
  "job.complete": Activity,
  "settings.update": Settings,
};

const ACTION_COLORS: Record<string, string> = {
  create: "text-emerald-500 bg-emerald-500/10",
  add: "text-emerald-500 bg-emerald-500/10",
  update: "text-blue-500 bg-blue-500/10",
  revoke: "text-destructive bg-destructive/10",
  remove: "text-destructive bg-destructive/10",
  delete: "text-destructive bg-destructive/10",
  export: "text-amber-500 bg-amber-500/10",
};

function getActionColor(action: string): string {
  for (const [key, color] of Object.entries(ACTION_COLORS)) {
    if (action.toLowerCase().includes(key)) return color;
  }
  return "text-muted-foreground bg-muted";
}

/** Quick date range presets */
const DATE_PRESETS = [
  { label: "All Time", value: "all" },
  { label: "Last 24 hours", value: "24h" },
  { label: "Last 7 days", value: "7d" },
  { label: "Last 30 days", value: "30d" },
  { label: "Last 90 days", value: "90d" },
] as const;

function getDateFromPreset(preset: string): Date | undefined {
  const now = Date.now();
  switch (preset) {
    case "24h":
      return new Date(now - 24 * 60 * 60 * 1000);
    case "7d":
      return new Date(now - 7 * 24 * 60 * 60 * 1000);
    case "30d":
      return new Date(now - 30 * 24 * 60 * 60 * 1000);
    case "90d":
      return new Date(now - 90 * 24 * 60 * 60 * 1000);
    default:
      return undefined;
  }
}

export default function AuditLogsPage() {
  const sub = useSubscription();
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [datePreset, setDatePreset] = useState<string>("all");
  const [page, setPage] = useState(0);
  const pageSize = 25;

  const startDate = getDateFromPreset(datePreset);

  const logsQuery = trpc.audit.list.useQuery(
    {
      action: actionFilter !== "all" ? actionFilter : undefined,
      search: search || undefined,
      startDate,
      limit: pageSize,
      offset: page * pageSize,
    },
    {
      enabled: sub.canUse("audit_logs"),
      retry: false,
      placeholderData: (prev: any) => prev,
    }
  );

  const actionsQuery = trpc.audit.actions.useQuery(undefined, {
    enabled: sub.canUse("audit_logs"),
    retry: false,
  });

  const statsQuery = trpc.audit.stats.useQuery(undefined, {
    enabled: sub.canUse("audit_logs"),
    retry: false,
  });

  const exportMutation = trpc.audit.exportCsv.useMutation({
    onSuccess: (data) => {
      // Create and download the CSV file
      const blob = new Blob([data.csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = data.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success(`Exported ${data.totalExported} of ${data.totalAvailable} audit log entries.`);
    },
    onError: (err) => {
      toast.error(err.message || "Failed to export audit logs");
    },
  });

  const handleExport = useCallback(() => {
    exportMutation.mutate({
      action: actionFilter !== "all" ? actionFilter : undefined,
      search: search || undefined,
      startDate,
      limit: 10000,
    });
  }, [actionFilter, search, startDate]);

  if (!sub.canUse("audit_logs")) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Audit Logs</h1>
          <p className="text-muted-foreground mt-1">
            Track all actions and changes across your account.
          </p>
        </div>
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <ScrollText className="h-12 w-12 text-muted-foreground/40 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Enterprise Feature</h3>
            <p className="text-sm text-muted-foreground max-w-sm mb-4">
              Audit Logs provide a complete trail of all actions taken in your
              account — exports, key management, team changes, and more.
            </p>
            <Button
              onClick={() => setShowUpgrade(true)}
              className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white"
            >
              Upgrade to Enterprise
            </Button>
          </CardContent>
        </Card>
        <UpgradeDialog
          open={showUpgrade}
          onOpenChange={setShowUpgrade}
          feature="Audit Logs"
          requiredPlan="enterprise"
        />
      </div>
    );
  }

  const logs = logsQuery.data?.logs || [];
  const total = logsQuery.data?.total || 0;
  const totalPages = Math.ceil(total / pageSize);
  const stats = statsQuery.data;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Audit Logs</h1>
          <p className="text-muted-foreground mt-1">
            Complete activity trail for your account.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={handleExport}
          disabled={exportMutation.isPending || total === 0}
          className="gap-2"
        >
          {exportMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <FileDown className="h-4 w-4" />
          )}
          Export CSV
        </Button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="text-2xl font-bold">{stats.last24h}</div>
              <p className="text-xs text-muted-foreground mt-1">Last 24 hours</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="text-2xl font-bold">{stats.last7d}</div>
              <p className="text-xs text-muted-foreground mt-1">Last 7 days</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="text-2xl font-bold">{stats.last30d}</div>
              <p className="text-xs text-muted-foreground mt-1">Last 30 days</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search actions..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            className="pl-9"
          />
        </div>
        <Select
          value={actionFilter}
          onValueChange={(v) => {
            setActionFilter(v);
            setPage(0);
          }}
        >
          <SelectTrigger className="w-[200px]">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="All actions" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Actions</SelectItem>
            {actionsQuery.data?.map((action) => (
              <SelectItem key={action} value={action}>
                {action}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={datePreset}
          onValueChange={(v) => {
            setDatePreset(v);
            setPage(0);
          }}
        >
          <SelectTrigger className="w-[180px]">
            <Calendar className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Date range" />
          </SelectTrigger>
          <SelectContent>
            {DATE_PRESETS.map((preset) => (
              <SelectItem key={preset.value} value={preset.value}>
                {preset.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Log Entries */}
      <Card>
        <CardContent className="p-0">
          {logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <ScrollText className="h-8 w-8 text-muted-foreground/40 mb-2" />
              <p className="text-sm text-muted-foreground">
                No audit log entries found.
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {logs.map((log) => {
                const Icon = ACTION_ICONS[log.action] || Activity;
                const colorClass = getActionColor(log.action);
                return (
                  <div
                    key={log.id}
                    className="flex items-start gap-4 px-4 py-3 hover:bg-accent/30 transition-colors"
                  >
                    <div
                      className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${colorClass}`}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="text-[10px] font-mono">
                          {log.action}
                        </Badge>
                        {log.resource && (
                          <Badge variant="secondary" className="text-[10px]">
                            {log.resource}
                            {log.resourceId ? ` #${log.resourceId}` : ""}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {log.userName || log.userEmail || `User #${log.userId}`}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {new Date(log.createdAt).toLocaleString()}
                        </span>
                        {log.ipAddress && (
                          <span className="font-mono">{log.ipAddress}</span>
                        )}
                      </div>
                      {log.details && Object.keys(log.details).length > 0 && (
                        <pre className="mt-1.5 text-[10px] text-muted-foreground bg-muted/50 rounded px-2 py-1 overflow-x-auto max-w-lg">
                          {JSON.stringify(log.details, null, 2)}
                        </pre>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {page * pageSize + 1}–
            {Math.min((page + 1) * pageSize, total)} of {total} entries
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm">
              Page {page + 1} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
