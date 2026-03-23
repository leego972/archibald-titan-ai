/**
 * OutOfCreditsModal — Progressive credit escalation funnel.
 *
 * FREE TIER:
 *   - Shows daily free credits status (375/day, resets every 24h)
 *   - If daily free credits exhausted: shows upgrade-to-paid offer only
 *   - No boost packs, no plan doubling
 *
 * PAID TIERS (Pro, Enterprise, Cyber, Cyber+, Titan):
 *   Step 1: Out of credits → buy up to 3 boost packs
 *   Step 2: Used 3 packs → offered to double membership (charged immediately)
 *   Step 3: Run out again → offered to double again (up to 3 times/cycle)
 *   Step 4: Maxed out → wait for billing cycle reset
 *
 * DOWNGRADE:
 *   - Available from the modal footer
 *   - Credits do NOT refill on downgrade — only on billing cycle rollover
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Zap,
  TrendingUp,
  Clock,
  ArrowUpRight,
  Star,
  ShoppingCart,
  ChevronDown,
  Sun,
  Lock,
} from "lucide-react";
import { CREDIT_PACKS, PLAN_DOUBLE_MAP, MAX_BOOST_PACKS_PER_CYCLE, DAILY_FREE_CREDITS_AMOUNT } from "@shared/pricing";

interface OutOfCreditsModalProps {
  open: boolean;
  onClose: () => void;
}

export function OutOfCreditsModal({ open, onClose }: OutOfCreditsModalProps) {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [showDowngrade, setShowDowngrade] = useState(false);

  const { data: state, refetch } = trpc.escalation.getState.useQuery(undefined, {
    enabled: open && !!user,
  });

  const grantDailyFree = trpc.escalation.grantDailyFreeCredits.useMutation({
    onSuccess: () => refetch(),
  });

  if (!state) return null;

  const doubleOffer = state.doubleOffer;

  // ─── FREE TIER ────────────────────────────────────────────────────────────────
  if (state.isFreeTier) {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-md bg-[#0d1117] border border-[#30363d] text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-semibold">
              <Sun className="w-5 h-5 text-yellow-400" />
              Daily Credits Exhausted
            </DialogTitle>
            <DialogDescription className="text-[#8b949e]">
              Your {DAILY_FREE_CREDITS_AMOUNT} daily free credits have been used up.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Daily free credit status */}
            <div className="rounded-lg border border-[#30363d] bg-[#161b22] p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-white">Daily Free Credits</span>
                <Badge variant="outline" className="text-yellow-400 border-yellow-400/30 text-xs">
                  Free Tier
                </Badge>
              </div>
              <div className="flex items-center gap-2 text-[#8b949e] text-sm">
                <Clock className="w-4 h-4" />
                <span>Resets every 24 hours — unused credits do not carry over</span>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <div className="flex-1 bg-[#0d1117] rounded-full h-2">
                  <div className="bg-yellow-400 h-2 rounded-full w-0" />
                </div>
                <span className="text-xs text-[#8b949e]">0 / {DAILY_FREE_CREDITS_AMOUNT}</span>
              </div>
            </div>

            {/* Upgrade CTA */}
            <div className="rounded-lg border border-[#388bfd]/30 bg-[#1c2d4a] p-4">
              <div className="flex items-center gap-2 mb-2">
                <Star className="w-4 h-4 text-[#388bfd]" />
                <span className="text-sm font-semibold text-white">Upgrade to Pro — $29/mo</span>
              </div>
              <p className="text-xs text-[#8b949e] mb-3">
                Get 50,000 credits/month, unlimited fetches, Titan Builder, and full access to all tools. No daily limits.
              </p>
              <Button
                className="w-full bg-[#388bfd] hover:bg-[#58a6ff] text-white font-medium"
                onClick={() => { navigate("/pricing"); onClose(); }}
              >
                <ArrowUpRight className="w-4 h-4 mr-2" />
                View Plans
              </Button>
            </div>

            {/* Boost packs locked */}
            <div className="rounded-lg border border-[#30363d] bg-[#161b22] p-3 flex items-center gap-3 opacity-60">
              <Lock className="w-4 h-4 text-[#8b949e] shrink-0" />
              <p className="text-xs text-[#8b949e]">
                Boost packs are available on paid plans only. Upgrade to Pro or higher to unlock instant credit top-ups.
              </p>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button variant="ghost" size="sm" className="text-[#8b949e] hover:text-white" onClick={onClose}>
              Maybe later
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // ─── PAID TIER — STEP 1: Boost Packs ─────────────────────────────────────────
  if (state.funnelStep === "boost_packs") {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-md bg-[#0d1117] border border-[#30363d] text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-semibold">
              <Zap className="w-5 h-5 text-yellow-400" />
              Out of Credits
            </DialogTitle>
            <DialogDescription className="text-[#8b949e]">
              Top up instantly with a boost pack — no plan change required.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            {/* Pack counter */}
            <div className="flex items-center justify-between text-sm text-[#8b949e] px-1">
              <span>Boost packs this cycle</span>
              <span className="font-mono text-white">
                {state.boostPacksBought} / {MAX_BOOST_PACKS_PER_CYCLE}
              </span>
            </div>

            {/* Pack options */}
            {CREDIT_PACKS.slice(0, 3).map((pack) => (
              <div
                key={pack.id}
                className="rounded-lg border border-[#30363d] bg-[#161b22] p-4 flex items-center justify-between hover:border-[#388bfd]/50 transition-colors cursor-pointer"
                onClick={() => navigate(`/credits?pack=${pack.id}`)}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <ShoppingCart className="w-4 h-4 text-[#388bfd]" />
                    <span className="text-sm font-medium text-white">{pack.name}</span>
                    {pack.popular && (
                      <Badge className="bg-[#388bfd]/20 text-[#388bfd] border-[#388bfd]/30 text-xs">Popular</Badge>
                    )}
                  </div>
                  <p className="text-xs text-[#8b949e] mt-0.5">
                    {pack.credits.toLocaleString()} credits
                    {pack.upgradeNudge && (
                      <span className="ml-1 text-yellow-400">· {pack.upgradeNudge.split("—")[0].trim()}</span>
                    )}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-sm font-semibold text-white">${pack.price}</span>
                </div>
              </div>
            ))}

            {/* Upgrade nudge */}
            {state.packsRemaining === 1 && (
              <p className="text-xs text-[#8b949e] text-center px-2">
                After this pack, you'll be offered to double your membership for more monthly credits.
              </p>
            )}
          </div>

          <Separator className="bg-[#30363d]" />

          <div className="flex items-center justify-between pt-1">
            <Button
              variant="ghost"
              size="sm"
              className="text-[#8b949e] hover:text-white text-xs"
              onClick={() => setShowDowngrade(!showDowngrade)}
            >
              <ChevronDown className="w-3 h-3 mr-1" />
              Downgrade plan
            </Button>
            <Button variant="ghost" size="sm" className="text-[#8b949e] hover:text-white" onClick={onClose}>
              Cancel
            </Button>
          </div>

          {showDowngrade && <DowngradeSection currentPlan={state.planId} onClose={onClose} />}
        </DialogContent>
      </Dialog>
    );
  }

  // ─── PAID TIER — STEP 2/3: Double Upgrade Offer ───────────────────────────────
  if (state.funnelStep === "double_offer" && doubleOffer) {
    const timesDoubled = state.doublesThisCycle;
    const newMonthlyRate = doubleOffer.doubledPriceUsd;

    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-md bg-[#0d1117] border border-[#30363d] text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-semibold">
              <TrendingUp className="w-5 h-5 text-green-400" />
              {timesDoubled === 0 ? "Double Your Plan" : `Double Again (${timesDoubled + 1}×)`}
            </DialogTitle>
            <DialogDescription className="text-[#8b949e]">
              You've used all {MAX_BOOST_PACKS_PER_CYCLE} boost packs this cycle. Unlock more credits by doubling your membership.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Offer card */}
            <div className="rounded-lg border border-green-500/30 bg-[#0d2818] p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <span className="text-sm font-semibold text-white">{doubleOffer.label}</span>
                  <p className="text-xs text-[#8b949e] mt-0.5">{doubleOffer.description}</p>
                </div>
                <div className="text-right shrink-0 ml-4">
                  <div className="text-lg font-bold text-white">${newMonthlyRate}<span className="text-xs text-[#8b949e] font-normal">/mo</span></div>
                  <div className="text-xs text-[#8b949e] line-through">${doubleOffer.basePriceUsd}/mo</div>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs text-[#8b949e]">
                <Clock className="w-3 h-3" />
                <span>Charged now. New rate applies when your billing cycle resets.</span>
              </div>
            </div>

            {/* Credits added */}
            <div className="rounded-lg border border-[#30363d] bg-[#161b22] p-3 flex items-center gap-3">
              <Zap className="w-4 h-4 text-yellow-400 shrink-0" />
              <div>
                <p className="text-sm font-medium text-white">
                  +{doubleOffer.doubledCredits.toLocaleString()} credits added immediately
                </p>
                <p className="text-xs text-[#8b949e]">Available right now, no waiting</p>
              </div>
            </div>

            <Button
              className="w-full bg-green-600 hover:bg-green-500 text-white font-medium"
              onClick={() => { navigate(`/credits?action=double&plan=${state.planId}`); onClose(); }}
            >
              <TrendingUp className="w-4 h-4 mr-2" />
              Accept — ${newMonthlyRate}/mo
            </Button>
          </div>

          <Separator className="bg-[#30363d]" />

          <div className="flex items-center justify-between pt-1">
            <Button
              variant="ghost"
              size="sm"
              className="text-[#8b949e] hover:text-white text-xs"
              onClick={() => setShowDowngrade(!showDowngrade)}
            >
              <ChevronDown className="w-3 h-3 mr-1" />
              Downgrade instead
            </Button>
            <Button variant="ghost" size="sm" className="text-[#8b949e] hover:text-white" onClick={onClose}>
              Not now
            </Button>
          </div>

          {showDowngrade && <DowngradeSection currentPlan={state.planId} onClose={onClose} />}
        </DialogContent>
      </Dialog>
    );
  }

  // ─── PAID TIER — MAXED OUT: Wait for cycle reset ──────────────────────────────
  if (state.funnelStep === "maxed_out") {
    const cycleEnd = state.billingCycleEnd ? new Date(state.billingCycleEnd) : null;
    const daysLeft = cycleEnd
      ? Math.max(0, Math.ceil((cycleEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
      : null;

    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-md bg-[#0d1117] border border-[#30363d] text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-semibold">
              <Clock className="w-5 h-5 text-[#8b949e]" />
              Credits Reset Soon
            </DialogTitle>
            <DialogDescription className="text-[#8b949e]">
              You've used all boost packs and plan doublings available this billing cycle.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="rounded-lg border border-[#30363d] bg-[#161b22] p-4 text-center">
              {daysLeft !== null ? (
                <>
                  <div className="text-3xl font-bold text-white mb-1">{daysLeft}</div>
                  <div className="text-sm text-[#8b949e]">days until your credits reset</div>
                  {cycleEnd && (
                    <div className="text-xs text-[#8b949e] mt-1">
                      Resets {cycleEnd.toLocaleDateString("en-AU", { day: "numeric", month: "long" })}
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm text-[#8b949e]">Your credits will reset at the start of your next billing cycle.</p>
              )}
            </div>

            <p className="text-xs text-[#8b949e] text-center">
              Your current plan rate applies at renewal. To reduce your monthly cost, you can downgrade below.
            </p>
          </div>

          <Separator className="bg-[#30363d]" />

          <div className="flex items-center justify-between pt-1">
            <Button
              variant="ghost"
              size="sm"
              className="text-[#8b949e] hover:text-white text-xs"
              onClick={() => setShowDowngrade(!showDowngrade)}
            >
              <ChevronDown className="w-3 h-3 mr-1" />
              Downgrade plan
            </Button>
            <Button variant="ghost" size="sm" className="text-[#8b949e] hover:text-white" onClick={onClose}>
              Close
            </Button>
          </div>

          {showDowngrade && <DowngradeSection currentPlan={state.planId} onClose={onClose} />}
        </DialogContent>
      </Dialog>
    );
  }

  return null;
}

// ─── Downgrade Section ────────────────────────────────────────────────────────

function DowngradeSection({ currentPlan, onClose }: { currentPlan: string; onClose: () => void }) {
  const [, navigate] = useLocation();
  const planOrder = ["free", "pro", "enterprise", "cyber", "cyber_plus", "titan"];
  const planLabels: Record<string, string> = {
    free: "Free — $0/mo",
    pro: "Pro — $29/mo",
    enterprise: "Enterprise — $99/mo",
    cyber: "Cyber — $199/mo",
    cyber_plus: "Cyber+ — $499/mo",
    titan: "Titan — $4,999/mo",
  };

  const currentIdx = planOrder.indexOf(currentPlan);
  const lowerPlans = planOrder.slice(0, currentIdx);

  if (lowerPlans.length === 0) return null;

  return (
    <div className="mt-2 rounded-lg border border-[#30363d] bg-[#161b22] p-3 space-y-2">
      <p className="text-xs text-[#8b949e] font-medium">Downgrade to:</p>
      <p className="text-xs text-yellow-400/80">
        ⚠ Your current credits remain until your billing cycle resets. Credits do not refill on downgrade.
      </p>
      {lowerPlans.reverse().map((plan) => (
        <Button
          key={plan}
          variant="outline"
          size="sm"
          className="w-full border-[#30363d] text-[#8b949e] hover:text-white hover:border-[#388bfd]/50 text-xs justify-start"
          onClick={() => { navigate(`/pricing?downgrade=${plan}`); onClose(); }}
        >
          {planLabels[plan]}
        </Button>
      ))}
    </div>
  );
}
