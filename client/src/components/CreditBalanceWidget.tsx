/**
 * CreditBalanceWidget — Shows remaining credits with a popover for upgrade/purchase.
 *
 * Displays a compact icon + credit count. Clicking opens a popover with:
 * - Current balance and plan info
 * - Credit cost breakdown
 * - Quick links to upgrade membership or buy credit packs
 */

import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Coins, Sparkles, ArrowUpRight, Infinity, ShoppingCart, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useLocation } from "wouter";

export function CreditBalanceWidget() {
  const { user } = useAuth();
  const [, navigate] = useLocation();

  const { data: balance, isLoading } = trpc.credits.getBalance.useQuery(undefined, {
    enabled: !!user,
    refetchInterval: 60000, // Refresh every minute
  });

  if (!user || isLoading) return null;

  const isUnlimited = balance?.isUnlimited ?? false;
  const credits = balance?.credits ?? 0;

  // Color coding based on credit level
  const getCreditColor = () => {
    if (isUnlimited) return "text-amber-400";
    if (credits > 100) return "text-emerald-400";
    if (credits > 25) return "text-amber-400";
    if (credits > 0) return "text-orange-400";
    return "text-red-400";
  };

  const getBgColor = () => {
    if (isUnlimited) return "bg-amber-500/10 hover:bg-amber-500/20 border-amber-500/20";
    if (credits > 100) return "bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/20";
    if (credits > 25) return "bg-amber-500/10 hover:bg-amber-500/20 border-amber-500/20";
    if (credits > 0) return "bg-orange-500/10 hover:bg-orange-500/20 border-orange-500/20";
    return "bg-red-500/10 hover:bg-red-500/20 border-red-500/20";
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm font-medium transition-colors ${getBgColor()} ${getCreditColor()}`}
        >
          {isUnlimited ? (
            <Infinity className="h-4 w-4" />
          ) : (
            <Coins className="h-4 w-4" />
          )}
          <span className="tabular-nums">
            {isUnlimited ? "Unlimited" : credits.toLocaleString()}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="end">
        <div className="p-4 space-y-4">
          {/* Balance Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`p-2 rounded-lg ${isUnlimited ? "bg-amber-500/10" : "bg-primary/10"}`}>
                {isUnlimited ? (
                  <Sparkles className="h-5 w-5 text-amber-400" />
                ) : (
                  <Coins className="h-5 w-5 text-primary" />
                )}
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Credits</p>
                <p className={`text-lg font-bold ${getCreditColor()}`}>
                  {isUnlimited ? "Unlimited" : credits.toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          {/* Credit Costs */}
          {!isUnlimited && (
            <div className="space-y-1.5 text-xs text-muted-foreground">
              <p className="font-medium text-foreground text-xs">Credit Costs:</p>
              <div className="flex justify-between">
                <span>Chat message</span>
                <span className="font-mono">1 credit</span>
              </div>
              <div className="flex justify-between">
                <span>Builder action</span>
                <span className="font-mono">5 credits</span>
              </div>
              <div className="flex justify-between">
                <span>Voice action</span>
                <span className="font-mono">3 credits</span>
              </div>
            </div>
          )}

          {/* Lifetime Stats */}
          {balance && !isUnlimited && (
            <div className="flex gap-3 text-xs text-muted-foreground">
              <div>
                <span className="text-foreground font-medium">{balance.lifetimeUsed.toLocaleString()}</span> used
              </div>
              <div>
                <span className="text-foreground font-medium">{balance.lifetimeAdded.toLocaleString()}</span> earned
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col gap-2 pt-1">
            {!isUnlimited && (
              <Button
                size="sm"
                className="w-full gap-2"
                onClick={() => {
                  navigate("/dashboard/credits");
                }}
              >
                <ShoppingCart className="h-3.5 w-3.5" />
                Buy Credits
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-2"
              onClick={() => {
                navigate("/pricing");
              }}
            >
              <Zap className="h-3.5 w-3.5" />
              {isUnlimited ? "View Plans" : "Upgrade Plan"}
              <ArrowUpRight className="h-3 w-3 ml-auto" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs text-muted-foreground"
              onClick={() => {
                navigate("/dashboard/credits");
              }}
            >
              View Transaction History
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
