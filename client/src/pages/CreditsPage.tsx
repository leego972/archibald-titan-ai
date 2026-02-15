/**
 * CreditsPage — Full credit management page.
 *
 * Shows balance, credit costs, purchasable packs, and transaction history.
 */

import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Coins,
  Sparkles,
  Infinity,
  ShoppingCart,
  ArrowUpRight,
  TrendingUp,
  TrendingDown,
  Clock,
  Zap,
  Gift,
  CreditCard,
  Settings,
  MessageSquare,
  Wrench,
  Mic,
} from "lucide-react";
import { useLocation, useSearch } from "wouter";
import { useEffect } from "react";
import { toast } from "sonner";

export default function CreditsPage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const search = useSearch();

  const { data: balance, isLoading: balanceLoading } = trpc.credits.getBalance.useQuery(undefined, {
    enabled: !!user,
  });

  const { data: history, isLoading: historyLoading } = trpc.credits.getHistory.useQuery(
    { limit: 50, offset: 0 },
    { enabled: !!user }
  );

  const { data: packs } = trpc.credits.getPacks.useQuery(undefined, { enabled: !!user });

  const purchaseMutation = trpc.credits.purchasePack.useMutation({
    onSuccess: (data) => {
      if (data.checkoutUrl) {
        window.open(data.checkoutUrl, "_blank");
      toast.success("Redirecting to checkout", {
        description: "A new tab has been opened for payment.",
      });
      }
    },
    onError: (err) => {
      toast.error("Purchase failed", {
        description: err.message,
      });
    },
  });

  // Handle purchase success/cancel from Stripe redirect
  useEffect(() => {
    const params = new URLSearchParams(search);
    if (params.get("purchase") === "success") {
      toast.success("Credits purchased!", {
        description: `${params.get("credits") || ""} credits have been added to your account.`,
      });
    } else if (params.get("purchase") === "canceled") {
      toast.info("Purchase canceled", {
        description: "No credits were added.",
      });
    }
  }, [search]);

  const isUnlimited = balance?.isUnlimited ?? false;
  const credits = balance?.credits ?? 0;

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "chat_message": return <MessageSquare className="h-4 w-4" />;
      case "builder_action": return <Wrench className="h-4 w-4" />;
      case "voice_action": return <Mic className="h-4 w-4" />;
      case "signup_bonus": return <Gift className="h-4 w-4" />;
      case "monthly_refill": return <Clock className="h-4 w-4" />;
      case "pack_purchase": return <ShoppingCart className="h-4 w-4" />;
      case "admin_adjustment": return <Settings className="h-4 w-4" />;
      case "referral_bonus": return <Gift className="h-4 w-4" />;
      default: return <Coins className="h-4 w-4" />;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "chat_message": return "Chat";
      case "builder_action": return "Builder";
      case "voice_action": return "Voice";
      case "signup_bonus": return "Welcome Bonus";
      case "monthly_refill": return "Monthly Refill";
      case "pack_purchase": return "Purchase";
      case "admin_adjustment": return "Admin";
      case "referral_bonus": return "Referral";
      default: return type;
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Balance Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="md:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              {isUnlimited ? (
                <Sparkles className="h-5 w-5 text-amber-400" />
              ) : (
                <Coins className="h-5 w-5 text-primary" />
              )}
              Credit Balance
            </CardTitle>
            <CardDescription>
              {isUnlimited
                ? "You have unlimited credits as an admin"
                : "Credits are consumed when you use AI features"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold tabular-nums">
                {isUnlimited ? (
                  <span className="flex items-center gap-2 text-amber-400">
                    <Infinity className="h-8 w-8" /> Unlimited
                  </span>
                ) : (
                  credits.toLocaleString()
                )}
              </span>
              {!isUnlimited && <span className="text-muted-foreground">credits remaining</span>}
            </div>
            {balance && !isUnlimited && (
              <div className="flex gap-6 mt-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <TrendingDown className="h-4 w-4 text-red-400" />
                  <span>{balance.lifetimeUsed.toLocaleString()} used total</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <TrendingUp className="h-4 w-4 text-emerald-400" />
                  <span>{balance.lifetimeAdded.toLocaleString()} earned total</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Credit Costs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
                <span>Chat message</span>
              </div>
              <Badge variant="secondary" className="font-mono">1</Badge>
            </div>
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <Wrench className="h-4 w-4 text-muted-foreground" />
                <span>Builder action</span>
              </div>
              <Badge variant="secondary" className="font-mono">5</Badge>
            </div>
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <Mic className="h-4 w-4 text-muted-foreground" />
                <span>Voice action</span>
              </div>
              <Badge variant="secondary" className="font-mono">3</Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Credit Packs */}
      {!isUnlimited && packs && packs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              Buy Credit Packs
            </CardTitle>
            <CardDescription>
              One-time purchases — credits never expire
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {packs.map((pack) => (
                <div
                  key={pack.id}
                  className={`relative rounded-lg border p-4 transition-colors hover:border-primary/50 ${
                    pack.popular ? "border-primary bg-primary/5" : ""
                  }`}
                >
                  {pack.popular && (
                    <Badge className="absolute -top-2 right-3 text-xs">Popular</Badge>
                  )}
                  <div className="space-y-2">
                    <h3 className="font-semibold text-sm">{pack.name}</h3>
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-bold">{pack.credits.toLocaleString()}</span>
                      <span className="text-xs text-muted-foreground">credits</span>
                    </div>
                    <p className="text-lg font-semibold text-primary">${pack.price}</p>
                    <p className="text-xs text-muted-foreground">
                      ${(pack.price / pack.credits * 100).toFixed(1)}¢ per credit
                    </p>
                    <Button
                      size="sm"
                      className="w-full mt-2"
                      variant={pack.popular ? "default" : "outline"}
                      onClick={() => purchaseMutation.mutate({ packId: pack.id })}
                      disabled={purchaseMutation.isPending}
                    >
                      <CreditCard className="h-3.5 w-3.5 mr-1.5" />
                      Buy Now
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Upgrade Plan CTA */}
      {!isUnlimited && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="flex items-center justify-between py-4">
            <div className="flex items-center gap-3">
              <Zap className="h-8 w-8 text-primary" />
              <div>
                <p className="font-semibold">Need more credits every month?</p>
                <p className="text-sm text-muted-foreground">
                  Upgrade your plan for higher monthly credit allocations
                </p>
              </div>
            </div>
            <Button onClick={() => navigate("/pricing")} className="gap-2">
              View Plans
              <ArrowUpRight className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Transaction History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Transaction History
          </CardTitle>
          <CardDescription>
            {history ? `${history.total} total transactions` : "Loading..."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {historyLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading transactions...</div>
          ) : history && history.transactions.length > 0 ? (
            <div className="space-y-2">
              {history.transactions.map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-1.5 rounded-md ${tx.amount >= 0 ? "bg-emerald-500/10 text-emerald-500" : "bg-muted text-muted-foreground"}`}>
                      {getTypeIcon(tx.type)}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{getTypeLabel(tx.type)}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(tx.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-mono font-medium ${
                      tx.amount > 0 ? "text-emerald-500" : tx.amount < 0 ? "text-red-400" : "text-muted-foreground"
                    }`}>
                      {tx.amount > 0 ? "+" : ""}{tx.amount}
                    </p>
                    <p className="text-xs text-muted-foreground tabular-nums">
                      bal: {tx.balanceAfter.toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No transactions yet. Start using AI features to see your credit usage.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
