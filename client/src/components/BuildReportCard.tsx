import {
  CheckCircle2,
  XCircle,
  FileText,
  ExternalLink,
  Clock,
  Layers,
  Download,
  Image as ImageIcon,
  Table2,
  FileCode2,
  GitBranch,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface BuildDeliverable {
  name: string;
  url?: string;
  type?: "pdf" | "spreadsheet" | "image" | "zip" | "markdown" | "repo" | "file" | string;
}

export interface BuildReportCardProps {
  totalRounds: number;
  successCount: number;
  failedCount: number;
  filesCreated: number;
  deliverables?: BuildDeliverable[];
  buildType?: string;
  durationMs?: number;
  className?: string;
}

function DeliverableIcon({ type }: { type?: string }) {
  switch (type) {
    case "pdf":         return <FileText className="h-3.5 w-3.5 text-red-400 shrink-0" />;
    case "spreadsheet": return <Table2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />;
    case "image":       return <ImageIcon className="h-3.5 w-3.5 text-blue-400 shrink-0" />;
    case "zip":         return <Download className="h-3.5 w-3.5 text-amber-400 shrink-0" />;
    case "markdown":    return <FileCode2 className="h-3.5 w-3.5 text-purple-400 shrink-0" />;
    case "repo":        return <GitBranch className="h-3.5 w-3.5 text-cyan-400 shrink-0" />;
    default:            return <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />;
  }
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const mins = Math.floor(ms / 60000);
  const secs = Math.round((ms % 60000) / 1000);
  return `${mins}m ${secs}s`;
}

export function BuildReportCard({
  totalRounds,
  successCount,
  failedCount,
  filesCreated,
  deliverables = [],
  buildType,
  durationMs,
  className,
}: BuildReportCardProps) {
  const isSuccess = failedCount === 0;

  return (
    <div
      className={cn(
        "rounded-xl border bg-muted/30 overflow-hidden mt-2",
        isSuccess ? "border-emerald-500/30" : "border-amber-500/30",
        className
      )}
    >
      {/* Header */}
      <div
        className={cn(
          "flex items-center gap-2 px-3 py-2 border-b",
          isSuccess
            ? "bg-emerald-500/10 border-emerald-500/20"
            : "bg-amber-500/10 border-amber-500/20"
        )}
      >
        {isSuccess ? (
          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
        ) : (
          <XCircle className="h-4 w-4 text-amber-400 shrink-0" />
        )}
        <span
          className={cn(
            "text-xs font-bold uppercase tracking-wider",
            isSuccess ? "text-emerald-400" : "text-amber-400"
          )}
        >
          Build {isSuccess ? "Complete" : "Completed with Errors"}
        </span>
        {buildType && (
          <span className="ml-auto text-[10px] text-muted-foreground capitalize bg-background/40 rounded-full px-2 py-0.5 border border-border/40">
            {buildType.replace(/_/g, " ")}
          </span>
        )}
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-4 px-3 py-2 border-b border-border/20 flex-wrap">
        <div className="flex items-center gap-1.5">
          <Layers className="h-3 w-3 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">{totalRounds} round{totalRounds !== 1 ? "s" : ""}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <CheckCircle2 className="h-3 w-3 text-emerald-400" />
          <span className="text-xs text-emerald-400">{successCount} succeeded</span>
        </div>
        {failedCount > 0 && (
          <div className="flex items-center gap-1.5">
            <XCircle className="h-3 w-3 text-red-400" />
            <span className="text-xs text-red-400">{failedCount} failed</span>
          </div>
        )}
        {filesCreated > 0 && (
          <div className="flex items-center gap-1.5">
            <FileText className="h-3 w-3 text-blue-400" />
            <span className="text-xs text-blue-400">{filesCreated} file{filesCreated !== 1 ? "s" : ""}</span>
          </div>
        )}
        {durationMs !== undefined && (
          <div className="flex items-center gap-1.5 ml-auto">
            <Clock className="h-3 w-3 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">{formatDuration(durationMs)}</span>
          </div>
        )}
      </div>

      {/* Deliverables */}
      {deliverables.length > 0 && (
        <div className="px-3 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
            Deliverables
          </p>
          <div className="space-y-1">
            {deliverables.map((d, i) => (
              <div key={i} className="flex items-center gap-2">
                <DeliverableIcon type={d.type} />
                {d.url ? (
                  <a
                    href={d.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline flex items-center gap-1 truncate"
                  >
                    {d.name}
                    <ExternalLink className="h-2.5 w-2.5 shrink-0" />
                  </a>
                ) : (
                  <span className="text-xs text-muted-foreground truncate">{d.name}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
