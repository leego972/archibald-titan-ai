import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { UpgradeBanner } from "@/components/UpgradePrompt";
import AffiliateRecommendations from "@/components/AffiliateRecommendations";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  ScanSearch,
  Shield,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
  RefreshCw,
  ExternalLink,
  Eye,
  FileWarning,
  Clock,
  Target,
  Zap,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

const SEVERITY_CONFIG = {
  critical: { color: "text-red-500", bg: "bg-red-500/10", border: "border-red-500/20", label: "Critical", icon: XCircle },
  high: { color: "text-orange-500", bg: "bg-orange-500/10", border: "border-orange-500/20", label: "High", icon: AlertTriangle },
  medium: { color: "text-amber-500", bg: "bg-amber-500/10", border: "border-amber-500/20", label: "Medium", icon: FileWarning },
  low: { color: "text-blue-500", bg: "bg-blue-500/10", border: "border-blue-500/20", label: "Low", icon: Eye },
};

const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  new: { color: "text-red-400", label: "New" },
  reviewing: { color: "text-amber-400", label: "Reviewing" },
  confirmed: { color: "text-orange-400", label: "Confirmed" },
  false_positive: { color: "text-zinc-400", label: "False Positive" },
  resolved: { color: "text-green-400", label: "Resolved" },
};

export default function LeakScannerPage() {
  const { user } = useAuth();
  const sub = useSubscription();
  const [scanType, setScanType] = useState<"full" | "quick" | "targeted">("full");
  const [expandedScan, setExpandedScan] = useState<number | null>(null);
  const [resolveDialogOpen, setResolveDialogOpen] = useState(false);
  const [selectedFinding, setSelectedFinding] = useState<number | null>(null);
  const [resolveNote, setResolveNote] = useState("");
  const [resolveStatus, setResolveStatus] = useState<"resolved" | "false_positive">("resolved");

  const summaryQuery = trpc.leakScanner.summary.useQuery(undefined, { enabled: !!user });
  const scansQuery = trpc.leakScanner.listScans.useQuery(undefined, { enabled: !!user });
  const allFindingsQuery = trpc.leakScanner.allFindings.useQuery(undefined, { enabled: !!user });
  const patternsQuery = trpc.leakScanner.patterns.useQuery(undefined, { enabled: !!user });

  const startScanMutation = trpc.leakScanner.startScan.useMutation();
  const updateFindingMutation = trpc.leakScanner.updateFinding.useMutation();
  const utils = trpc.useUtils();

  const summary = summaryQuery.data;
  const scans = scansQuery.data ?? [];
  const allFindings = allFindingsQuery.data ?? [];
  const patterns = patternsQuery.data ?? [];

  const unresolvedFindings = useMemo(
    () => allFindings.filter((f) => ["new", "reviewing", "confirmed"].includes(f.status)),
    [allFindings]
  );

  if (!sub.canUse("leak_scanner")) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-3">
            <ScanSearch className="h-7 w-7 text-primary" />
            Credential Leak Scanner
          </h1>
          <p className="text-muted-foreground mt-1">
            Scan public repositories and paste sites for leaked credentials.
          </p>
        </div>
        <UpgradeBanner feature="Credential Leak Scanner" requiredPlan="cyber" />
      </div>
    );
  }

  const handleStartScan = async () => {
    try {
      toast.info(`Starting ${scanType} scan...`);
      const result = await startScanMutation.mutateAsync({ scanType });
      toast.success(
        `Scan complete! Scanned ${result.sourcesScanned} sources, found ${result.leaksFound} potential leaks.`
      );
      utils.leakScanner.listScans.invalidate();
      utils.leakScanner.allFindings.invalidate();
      utils.leakScanner.summary.invalidate();
    } catch (err: any) {
      toast.error(err.message || "Scan failed.");
    }
  };

  const handleResolveFinding = async () => {
    if (selectedFinding === null) return;
    try {
      await updateFindingMutation.mutateAsync({
        id: selectedFinding,
        status: resolveStatus,
        resolvedNote: resolveNote || undefined,
      });
      toast.success(`Finding marked as ${resolveStatus === "resolved" ? "resolved" : "false positive"}.`);
      setResolveDialogOpen(false);
      setSelectedFinding(null);
      setResolveNote("");
      utils.leakScanner.allFindings.invalidate();
      utils.leakScanner.summary.invalidate();
    } catch (err: any) {
      toast.error(err.message || "Failed to update finding.");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-rose-500 to-rose-600 flex items-center justify-center shadow-lg shadow-rose-500/20">
              <ScanSearch className="h-5 w-5 text-white" />
            </div>
            <span className="bg-gradient-to-r from-white to-white/70 bg-clip-text text-transparent">Credential Leak Scanner</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1 ml-12">
            Scan public repositories and paste sites for leaked credentials.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={scanType} onValueChange={(v) => setScanType(v as any)}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="full">Full Scan</SelectItem>
              <SelectItem value="quick">Quick Scan</SelectItem>
              <SelectItem value="targeted">Targeted</SelectItem>
            </SelectContent>
          </Select>
          <Button
            onClick={handleStartScan}
            disabled={startScanMutation.isPending}
            className="gap-2"
          >
            {startScanMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ScanSearch className="h-4 w-4" />
            )}
            Start Scan
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Scans", value: summary?.totalScans ?? 0, icon: ScanSearch, gradient: "from-blue-500/20 to-blue-600/5", iconColor: "text-blue-400", iconBg: "bg-blue-500/10" },
          { label: "Total Findings", value: summary?.totalFindings ?? 0, icon: AlertTriangle, gradient: "from-amber-500/20 to-amber-600/5", iconColor: "text-amber-400", iconBg: "bg-amber-500/10" },
          { label: "Unresolved", value: summary?.unresolvedFindings ?? 0, icon: FileWarning, gradient: "from-orange-500/20 to-orange-600/5", iconColor: "text-orange-400", iconBg: "bg-orange-500/10", valueColor: "text-orange-400" },
          { label: "Critical", value: summary?.criticalFindings ?? 0, icon: XCircle, gradient: "from-red-500/20 to-red-600/5", iconColor: "text-red-400", iconBg: "bg-red-500/10", valueColor: "text-red-400" },
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

      {/* Unresolved Findings */}
      {unresolvedFindings.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Unresolved Findings ({unresolvedFindings.length})
            </CardTitle>
            <CardDescription>
              Potential credential leaks that need your attention.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {unresolvedFindings.map((finding) => {
                const sev = SEVERITY_CONFIG[finding.severity as keyof typeof SEVERITY_CONFIG] || SEVERITY_CONFIG.medium;
                const SevIcon = sev.icon;
                const status = STATUS_CONFIG[finding.status] || STATUS_CONFIG.new;

                return (
                  <div
                    key={finding.id}
                    className={`rounded-lg border ${sev.border} ${sev.bg} p-4 space-y-2`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <SevIcon className={`h-5 w-5 ${sev.color} shrink-0`} />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm">{finding.credentialType}</span>
                            <Badge variant="outline" className={`text-xs ${sev.color} ${sev.border}`}>
                              {sev.label}
                            </Badge>
                            <Badge variant="outline" className={`text-xs ${status.color}`}>
                              {status.label}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1 truncate">
                            {finding.source} — {finding.repoOrFile || "Unknown file"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {finding.sourceUrl && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => window.open(finding.sourceUrl!, "_blank")}
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs"
                          onClick={() => {
                            setSelectedFinding(finding.id);
                            setResolveDialogOpen(true);
                          }}
                        >
                          Resolve
                        </Button>
                      </div>
                    </div>

                    {finding.snippet && (
                      <div className="bg-black/20 rounded-md p-3 font-mono text-xs text-muted-foreground overflow-x-auto">
                        {finding.snippet}
                      </div>
                    )}

                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>Pattern: <code className="text-foreground/70">{finding.matchedPattern}</code></span>
                      {finding.author && <span>Author: {finding.author}</span>}
                      <span>{new Date(finding.detectedAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Scan History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Scan History
          </CardTitle>
          <CardDescription>Previous scans and their results.</CardDescription>
        </CardHeader>
        <CardContent>
          {scans.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <ScanSearch className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>No scans yet. Run your first scan to check for leaked credentials.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {scans.map((scan) => {
                const isExpanded = expandedScan === scan.id;
                return (
                  <div key={scan.id} className="rounded-lg border bg-card p-4">
                    <div
                      className="flex items-center justify-between cursor-pointer"
                      onClick={() => setExpandedScan(isExpanded ? null : scan.id)}
                    >
                      <div className="flex items-center gap-3">
                        {scan.status === "completed" ? (
                          <CheckCircle2 className="h-5 w-5 text-green-500" />
                        ) : scan.status === "scanning" ? (
                          <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
                        ) : scan.status === "failed" ? (
                          <XCircle className="h-5 w-5 text-red-500" />
                        ) : (
                          <Clock className="h-5 w-5 text-muted-foreground" />
                        )}
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm capitalize">{scan.scanType} Scan</span>
                            <Badge variant="outline" className="text-xs capitalize">{scan.status}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {new Date(scan.createdAt).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right text-sm">
                          <span className="text-muted-foreground">{scan.sourcesScanned} sources</span>
                          {scan.leaksFound > 0 && (
                            <span className="ml-3 text-amber-500 font-medium">{scan.leaksFound} leaks</span>
                          )}
                        </div>
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                    </div>

                    {isExpanded && <ScanFindings scanId={scan.id} />}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Known Patterns */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Detection Patterns ({patterns.length})
          </CardTitle>
          <CardDescription>
            Credential patterns the scanner looks for across public sources.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {patterns.map((p) => {
              const sev = SEVERITY_CONFIG[p.severity as keyof typeof SEVERITY_CONFIG] || SEVERITY_CONFIG.medium;
              return (
                <div key={p.id} className={`rounded-lg border ${sev.border} ${sev.bg} p-3`}>
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">{p.type.replace(/_/g, " ")}</span>
                    <Badge variant="outline" className={`text-xs ${sev.color} ${sev.border}`}>
                      {sev.label}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 font-mono truncate">{p.pattern}</p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Resolve Dialog */}
      <Dialog open={resolveDialogOpen} onOpenChange={setResolveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resolve Finding</DialogTitle>
            <DialogDescription>
              Mark this finding as resolved or a false positive.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Status</Label>
              <Select value={resolveStatus} onValueChange={(v) => setResolveStatus(v as any)}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="false_positive">False Positive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Note (optional)</Label>
              <Textarea
                value={resolveNote}
                onChange={(e) => setResolveNote(e.target.value)}
                placeholder="Add a note about how this was resolved..."
                className="mt-1"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResolveDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleResolveFinding} disabled={updateFindingMutation.isPending}>
              {updateFindingMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Security-focused affiliate recommendations — VPN, password managers */}
      <AffiliateRecommendations context="security" variant="banner" className="mt-6" />
    </div>
  );
}
// ─── Sub-component: Findings for a specific scann ─────────────────
function ScanFindings({ scanId }: { scanId: number }) {
  const findingsQuery = trpc.leakScanner.getFindings.useQuery({ scanId });
  const findings = findingsQuery.data ?? [];

  if (findingsQuery.isLoading) {
    return (
      <div className="mt-4 flex items-center justify-center py-6">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (findings.length === 0) {
    return (
      <div className="mt-4 text-center py-6 text-muted-foreground text-sm">
        <Shield className="h-8 w-8 mx-auto mb-2 text-green-500 opacity-50" />
        No leaks found in this scan. Your credentials look safe!
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-2 border-t pt-4">
      {findings.map((f) => {
        const sev = SEVERITY_CONFIG[f.severity as keyof typeof SEVERITY_CONFIG] || SEVERITY_CONFIG.medium;
        const SevIcon = sev.icon;
        return (
          <div key={f.id} className={`rounded-md border ${sev.border} ${sev.bg} p-3 text-sm`}>
            <div className="flex items-center gap-2">
              <SevIcon className={`h-4 w-4 ${sev.color}`} />
              <span className="font-medium">{f.credentialType}</span>
              <Badge variant="outline" className={`text-xs ${sev.color}`}>{sev.label}</Badge>
              <span className="text-xs text-muted-foreground ml-auto">{f.source}</span>
            </div>
            {f.snippet && (
              <div className="mt-2 bg-black/20 rounded p-2 font-mono text-xs text-muted-foreground overflow-x-auto">
                {f.snippet}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
