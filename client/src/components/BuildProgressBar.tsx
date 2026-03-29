import { CheckCircle2, Circle, Loader2, Search, Cpu, Hammer, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

export type BuildPhase = "planning" | "researching" | "building" | "verifying" | "done";

interface BuildProgressBarProps {
  currentPhase: BuildPhase;
  detail?: string;
  filesCreated?: number;
  buildType?: string;
  round?: number;
  className?: string;
}

const PHASES: { id: BuildPhase; label: string; icon: React.ReactNode }[] = [
  { id: "planning",    label: "Planning",    icon: <Cpu className="h-3.5 w-3.5" /> },
  { id: "researching", label: "Researching", icon: <Search className="h-3.5 w-3.5" /> },
  { id: "building",    label: "Building",    icon: <Hammer className="h-3.5 w-3.5" /> },
  { id: "verifying",   label: "Verifying",   icon: <ShieldCheck className="h-3.5 w-3.5" /> },
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
  className,
}: BuildProgressBarProps) {
  const currentIdx = getPhaseIndex(currentPhase);

  return (
    <div className={cn("w-full", className)}>
      {/* Phase stepper */}
      <div className="flex items-center gap-0 w-full mb-2">
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
                    "h-7 w-7 rounded-full flex items-center justify-center border-2 transition-all duration-300",
                    isComplete && "bg-emerald-500/20 border-emerald-500 text-emerald-400",
                    isActive && "bg-primary/20 border-primary text-primary animate-pulse",
                    isPending && "bg-muted/30 border-border/40 text-muted-foreground/40"
                  )}
                >
                  {isComplete ? (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  ) : isActive ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Circle className="h-3.5 w-3.5" />
                  )}
                </div>
                <span
                  className={cn(
                    "text-[10px] mt-1 font-medium whitespace-nowrap",
                    isComplete && "text-emerald-400",
                    isActive && "text-primary",
                    isPending && "text-muted-foreground/40"
                  )}
                >
                  {phase.label}
                </span>
              </div>

              {/* Connector line — not after last step */}
              {i < PHASES.length - 1 && (
                <div
                  className={cn(
                    "flex-1 h-0.5 mx-1 rounded-full transition-all duration-500",
                    currentIdx > phaseIdx ? "bg-emerald-500/60" : "bg-border/30"
                  )}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Detail row */}
      <div className="flex items-center gap-2 flex-wrap">
        {detail && (
          <span className="text-xs text-muted-foreground truncate max-w-[280px] sm:max-w-none">
            {detail}
          </span>
        )}
        {filesCreated !== undefined && filesCreated > 0 && (
          <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full px-2 py-0.5 shrink-0">
            {filesCreated} file{filesCreated !== 1 ? "s" : ""} created
          </span>
        )}
        {buildType && (
          <span className="text-[10px] bg-primary/10 text-primary border border-primary/20 rounded-full px-2 py-0.5 shrink-0 capitalize">
            {buildType.replace(/_/g, " ")}
          </span>
        )}
        {round !== undefined && round > 0 && (
          <span className="text-[10px] text-muted-foreground/50 shrink-0">
            Round {round}
          </span>
        )}
      </div>
    </div>
  );
}
