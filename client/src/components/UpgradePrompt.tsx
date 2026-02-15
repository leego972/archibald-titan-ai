/**
 * UpgradePrompt — Reusable upgrade modal/banner for gated features.
 *
 * Shows when a user tries to access a feature not available on their plan.
 * Provides a clear message and CTA to upgrade.
 */

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Crown, Lock, Sparkles, ArrowRight } from "lucide-react";
import { useLocation } from "wouter";
import type { PlanId } from "@shared/pricing";

// ─── Upgrade Dialog (Modal) ─────────────────────────────────────────

interface UpgradeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  feature: string;
  description?: string;
  requiredPlan?: "pro" | "enterprise";
}

export function UpgradeDialog({
  open,
  onOpenChange,
  feature,
  description,
  requiredPlan = "pro",
}: UpgradeDialogProps) {
  const [, setLocation] = useLocation();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="h-10 w-10 rounded-full bg-amber-500/10 flex items-center justify-center">
              <Crown className="h-5 w-5 text-amber-500" />
            </div>
            <DialogTitle className="text-lg">Upgrade Required</DialogTitle>
          </div>
          <DialogDescription className="text-left">
            <span className="font-semibold text-foreground">{feature}</span> is
            available on the{" "}
            <span className="font-semibold text-amber-500 capitalize">
              {requiredPlan}
            </span>{" "}
            plan and above.
            {description && (
              <span className="block mt-2 text-muted-foreground">
                {description}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="bg-muted/50 rounded-lg p-4 space-y-2">
          <p className="text-sm font-medium flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-500" />
            {requiredPlan === "pro" ? "Pro plan includes:" : "Enterprise plan includes:"}
          </p>
          <ul className="text-sm text-muted-foreground space-y-1 ml-6">
            {requiredPlan === "pro" ? (
              <>
                <li>Unlimited fetches per month</li>
                <li>All 15+ providers</li>
                <li>CAPTCHA auto-solving</li>
                <li>5 proxy slots</li>
                <li>Kill switch protection</li>
                <li>JSON & .ENV export</li>
              </>
            ) : (
              <>
                <li>Everything in Pro</li>
                <li>Unlimited proxy slots</li>
                <li>Team management (25 seats)</li>
                <li>API access & CSV export</li>
                <li>Dedicated account manager</li>
              </>
            )}
          </ul>
        </div>
        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Maybe later
          </Button>
          <Button
            onClick={() => {
              onOpenChange(false);
              setLocation("/pricing");
            }}
            className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white"
          >
            <Crown className="h-4 w-4 mr-2" />
            Upgrade to {requiredPlan === "pro" ? "Pro" : "Enterprise"}
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Inline Upgrade Banner ──────────────────────────────────────────

interface UpgradeBannerProps {
  feature: string;
  requiredPlan?: "pro" | "enterprise";
  compact?: boolean;
}

export function UpgradeBanner({
  feature,
  requiredPlan = "pro",
  compact = false,
}: UpgradeBannerProps) {
  const [, setLocation] = useLocation();

  if (compact) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
        <Lock className="h-3.5 w-3.5 text-amber-500 shrink-0" />
        <span className="text-xs text-amber-500/90">
          {feature} requires{" "}
          <button
            onClick={() => setLocation("/pricing")}
            className="font-semibold underline underline-offset-2 hover:text-amber-400 transition-colors"
          >
            {requiredPlan === "pro" ? "Pro" : "Enterprise"}
          </button>
        </span>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-amber-500/20 bg-gradient-to-br from-amber-500/5 to-orange-500/5 p-6 text-center space-y-4">
      <div className="h-12 w-12 rounded-full bg-amber-500/10 flex items-center justify-center mx-auto">
        <Lock className="h-6 w-6 text-amber-500" />
      </div>
      <div>
        <h3 className="text-lg font-semibold">{feature}</h3>
        <p className="text-sm text-muted-foreground mt-1">
          This feature is available on the{" "}
          <span className="font-semibold text-amber-500 capitalize">
            {requiredPlan}
          </span>{" "}
          plan and above.
        </p>
      </div>
      <Button
        onClick={() => setLocation("/pricing")}
        className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white"
      >
        <Crown className="h-4 w-4 mr-2" />
        Upgrade to {requiredPlan === "pro" ? "Pro" : "Enterprise"}
      </Button>
    </div>
  );
}

// ─── Plan Badge ─────────────────────────────────────────────────────

interface PlanBadgeProps {
  planId: PlanId;
  className?: string;
}

export function PlanBadge({ planId, className = "" }: PlanBadgeProps) {
  const colors: Record<PlanId, string> = {
    free: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
    pro: "bg-amber-500/10 text-amber-500 border-amber-500/20",
    enterprise: "bg-violet-500/10 text-violet-400 border-violet-500/20",
  };

  const labels: Record<PlanId, string> = {
    free: "Free",
    pro: "Pro",
    enterprise: "Enterprise",
  };

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${colors[planId]} ${className}`}
    >
      {planId !== "free" && <Crown className="h-3 w-3" />}
      {labels[planId]}
    </span>
  );
}

// ─── Usage Bar ──────────────────────────────────────────────────────

interface UsageBarProps {
  label: string;
  used: number;
  limit: number; // -1 = unlimited
  className?: string;
}

export function UsageBar({ label, used, limit, className = "" }: UsageBarProps) {
  const isUnlimited = limit === -1;
  const percentage = isUnlimited ? 0 : Math.min(100, (used / limit) * 100);
  const isNearLimit = !isUnlimited && percentage >= 80;
  const isAtLimit = !isUnlimited && used >= limit;

  return (
    <div className={`space-y-1.5 ${className}`}>
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span
          className={`font-medium ${
            isAtLimit
              ? "text-destructive"
              : isNearLimit
              ? "text-amber-500"
              : "text-foreground"
          }`}
        >
          {used}
          {isUnlimited ? " / ∞" : ` / ${limit}`}
        </span>
      </div>
      {!isUnlimited && (
        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              isAtLimit
                ? "bg-destructive"
                : isNearLimit
                ? "bg-amber-500"
                : "bg-primary"
            }`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      )}
      {isUnlimited && (
        <div className="h-1.5 rounded-full bg-primary/20 overflow-hidden">
          <div className="h-full rounded-full bg-primary w-full opacity-30" />
        </div>
      )}
    </div>
  );
}
