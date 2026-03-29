/**
 * DeliverablesShelf — a persistent row of download/open buttons shown above the
 * chat input bar after every build that produces deliverables. Stays visible until
 * the user starts a new conversation or dismisses it.
 */
import { X, FileText, Table2, Image as ImageIcon, Download, FileCode2, GitBranch, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BuildDeliverable } from "./BuildReportCard";

interface DeliverablesShelfProps {
  deliverables: BuildDeliverable[];
  onDismiss: () => void;
  isMobile?: boolean;
  className?: string;
}

function typeIcon(type?: string) {
  switch (type) {
    case "pdf":         return <FileText className="h-3 w-3 text-red-400 shrink-0" />;
    case "spreadsheet": return <Table2 className="h-3 w-3 text-emerald-400 shrink-0" />;
    case "image":       return <ImageIcon className="h-3 w-3 text-blue-400 shrink-0" />;
    case "zip":         return <Download className="h-3 w-3 text-amber-400 shrink-0" />;
    case "markdown":    return <FileCode2 className="h-3 w-3 text-purple-400 shrink-0" />;
    case "repo":        return <GitBranch className="h-3 w-3 text-cyan-400 shrink-0" />;
    default:            return <FileText className="h-3 w-3 text-muted-foreground shrink-0" />;
  }
}

function typeColor(type?: string): string {
  switch (type) {
    case "pdf":         return "border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-red-300";
    case "spreadsheet": return "border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300";
    case "image":       return "border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/20 text-blue-300";
    case "zip":         return "border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300";
    case "markdown":    return "border-purple-500/30 bg-purple-500/10 hover:bg-purple-500/20 text-purple-300";
    case "repo":        return "border-cyan-500/30 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300";
    default:            return "border-border/40 bg-muted/40 hover:bg-muted/60 text-muted-foreground";
  }
}

export function DeliverablesShelf({ deliverables, onDismiss, isMobile = false, className }: DeliverablesShelfProps) {
  if (deliverables.length === 0) return null;

  return (
    <div
      className={cn(
        "flex items-center gap-1.5 px-2 sm:px-3 py-1.5 border-t border-border/30 bg-background/80 backdrop-blur-sm",
        className
      )}
    >
      {/* Label */}
      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground shrink-0 mr-0.5">
        {isMobile ? "Files" : "Deliverables"}
      </span>

      {/* Scrollable pill row */}
      <div className="flex items-center gap-1.5 overflow-x-auto flex-1 scrollbar-none min-w-0 pb-0.5">
        {deliverables.map((d, i) => (
          d.url ? (
            <a
              key={i}
              href={d.url}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                "flex items-center gap-1 rounded-full border px-2 py-0.5 transition-colors shrink-0",
                isMobile ? "text-[10px]" : "text-xs",
                typeColor(d.type)
              )}
              title={d.name}
            >
              {typeIcon(d.type)}
              <span className={cn("truncate", isMobile ? "max-w-[80px]" : "max-w-[140px]")}>
                {d.name}
              </span>
              <ExternalLink className="h-2.5 w-2.5 shrink-0 opacity-60" />
            </a>
          ) : (
            <span
              key={i}
              className={cn(
                "flex items-center gap-1 rounded-full border px-2 py-0.5 shrink-0 opacity-60",
                isMobile ? "text-[10px]" : "text-xs",
                typeColor(d.type)
              )}
              title={d.name}
            >
              {typeIcon(d.type)}
              <span className={cn("truncate", isMobile ? "max-w-[80px]" : "max-w-[140px]")}>
                {d.name}
              </span>
            </span>
          )
        ))}
      </div>

      {/* Dismiss */}
      <button
        onClick={onDismiss}
        className="shrink-0 p-1 rounded-full hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors"
        title="Dismiss deliverables shelf"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}
