import { CheckCircle2, Circle, Loader2, Search, Cpu, Hammer, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

export type BuildPhase = "planning" | "researching" | "building" | "verifying" | "done";

interface BuildProgressBarProps {
  currentPhase: BuildPhase;
  detail?: string;
  filesCreated?: number;
  buildType?: string;
  round?: number;
  isMobile?: boolean;
  className?: string;
}

const PHASES: { id: BuildPhase; label: string; shortLabel: string; icon: React.ReactNode }[] = [
  { id: "planning",    label: "Planning",    shortLabel: "Plan",   icon: <Cpu className="h-3 w-3 sm:h-3.5 sm:w-3.5" /> },
  { id: "researching", label: "Researching", shortLabel: "Search", icon: <Search className="h-3 w-3 sm:h-3.5 sm:w-3.5" /> },
  { id: "building",    label: "Building",    shortLabel: "Build",  icon: <Hammer className="h-3 w-3 sm:h-3.5 sm:w-3.5" /> },
  { id: "verifying",   label: "Verifying",   shortLabel: "Verify", icon: <ShieldCheck className="h-3 w-3 sm:h-3.5 sm:w-3.5" /> },
];

const PHASE_ORDER: BuildPhase[] = ["planning", "researching", "building", "verifying", "done"];

function getPhaseIndex(phase: BuildPhase): number {
  return PHASE_ORDER.indexOf(phase);
}

export function BuildProgressBar({
  currentPhase,
  detail,
  filesCreated,
  buildType,
  round,
  isMobile = false,
  className,
}: BuildProgressBarProps) {
  const currentIdx = getPhaseIndex(currentPhase);

  return (
    <div className={cn("w-full min-w-0", className)}>
      {/* Phase stepper — compact on mobile */}
      <div className="flex items-center w-full mb-1.5 sm:mb-2">
        {PHASES.map((phase, i) => {
          const phaseIdx = getPhaseIndex(phase.id);
          const isComplete = currentIdx > phaseIdx;
          const isActive = currentIdx === phaseIdx;
          const isPending = currentIdx < phaseIdx;

          return (
            <div key={phase.id} className="flex items-center flex-1 min-w-0">
              {/* Step node */}
              <div className="flex flex-col items-center shrink-0">
                <div
                  className={cn(
                    "rounded-full flex items-center justify-center border-2 transition-all duration-300",
                    isMobile ? "h-6 w-6" : "h-7 w-7",
                    isComplete && "bg-emerald-500/20 border-emerald-500 text-emerald-400",
                    isActive && "bg-primary/20 border-primary text-primary animate-pulse",
                    isPending && "bg-muted/30 border-border/40 text-muted-foreground/40"
                  )}
                >
                  {isComplete ? (
                    <CheckCircle2 className="h-3 w-3" />
                  ) : isActive ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Circle className="h-3 w-3" />
                  )}
                </div>
                <span
                  className={cn(
                    "mt-0.5 font-medium whitespace-nowrap",
                    isMobile ? "text-[9px]" : "text-[10px] mt-1",
                    isComplete && "text-emerald-400",
                    isActive && "text-primary",
                    isPending && "text-muted-foreground/40"
                  )}
                >
                  {isMobile ? phase.shortLabel : phase.label}
                </span>
              </div>

              {/* Connector line */}
              {i < PHASES.length - 1 && (
                <div
                  className={cn(
                    "flex-1 h-0.5 mx-0.5 sm:mx-1 rounded-full transition-all duration-500",
                    currentIdx > phaseIdx ? "bg-emerald-500/60" : "bg-border/30"
                  )}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Detail row — wraps gracefully on mobile */}
      <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap min-w-0">
        {detail && (
          <span className={cn(
            "text-muted-foreground truncate",
            isMobile ? "text-[10px] max-w-[160px]" : "text-xs max-w-[280px] sm:max-w-none"
          )}>
            {detail}
          </span>
        )}
        {filesCreated !== undefined && filesCreated > 0 && (
          <span className="text-[9px] sm:text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full px-1.5 sm:px-2 py-0.5 shrink-0">
            {filesCreated} file{filesCreated !== 1 ? "s" : ""}
          </span>
        )}
        {buildType && !isMobile && (
          <span className="text-[10px] bg-primary/10 text-primary border border-primary/20 rounded-full px-2 py-0.5 shrink-0 capitalize">
            {buildType.replace(/_/g, " ")}
          </span>
        )}
        {round !== undefined && round > 0 && (
          <span className={cn("text-muted-foreground/50 shrink-0", isMobile ? "text-[9px]" : "text-[10px]")}>
            R{round}
          </span>
        )}
      </div>
    </div>
  );
}
