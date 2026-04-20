import { trpc } from "@/lib/trpc";
  import { useAuth } from "@/_core/hooks/useAuth";
  import {
    Coins, Sparkles, ArrowUpRight, Infinity as InfinityIcon,
    ShoppingCart, Zap, Shield, Bug, Crosshair, MessageSquare, Wrench,
  } from "lucide-react";
  import { Button } from "@/components/ui/button";
  import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
  import { useLocation } from "wouter";

  const COST_LABELS = [
    { label: "Chat",        key: "chat_message",     icon: <MessageSquare className="h-3 w-3" /> },
    { label: "Builder",     key: "builder_action",   icon: <Wrench className="h-3 w-3" /> },
    { label: "Argus Scan",  key: "security_scan",    icon: <Shield className="h-3 w-3" /> },
    { label: "Astra Scan",  key: "astra_scan",       icon: <Bug className="h-3 w-3" /> },
    { label: "Metasploit",  key: "metasploit_action",icon: <Crosshair className="h-3 w-3" /> },
  ];

  export function CreditBalanceWidget() {
    const { user } = useAuth();
    const [, navigate] = useLocation();

    const { data: balance, isLoading } = trpc.credits.getBalance.useQuery(undefined, {
      enabled: !!user,
      refetchInterval: 60000,
    });
    const { data: costs } = trpc.credits.getCosts.useQuery(undefined, { enabled: !!user });

    if (!user) return null;
    if (isLoading) return (
      <div className="h-8 w-24 rounded-lg bg-white/5 animate-pulse" />
    );

    const isUnlimited = balance?.isUnlimited ?? false;
    const credits = balance?.credits ?? 0;

    const getCreditColor = () => {
      if (isUnlimited) return "text-amber-400";
      if (credits > 50000) return "text-emerald-400";
      if (credits > 5000) return "text-blue-400";
      if (credits > 1000) return "text-amber-400";
      if (credits > 0) return "text-orange-400";
      return "text-red-400";
    };

    const getBgColor = () => {
      if (isUnlimited) return "bg-amber-500/10 hover:bg-amber-500/20 border-amber-500/20";
      if (credits > 10000) return "bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/20";
      if (credits > 500) return "bg-amber-500/10 hover:bg-amber-500/20 border-amber-500/20";
      if (credits > 0) return "bg-orange-500/10 hover:bg-orange-500/20 border-orange-500/20";
      return "bg-red-500/10 hover:bg-red-500/20 border-red-500/20";
    };

    const formatCredits = (n: number) =>
      n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` :
      n >= 1_000 ? `${(n / 1_000).toFixed(0)}k` :
      n.toLocaleString();

    return (
      <Popover>
        <PopoverTrigger asChild>
          <button className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm font-medium transition-colors ${getBgColor()} ${getCreditColor()}`}>
            {isUnlimited ? <InfinityIcon className="h-4 w-4" /> : <Coins className="h-4 w-4" />}
            <span className="tabular-nums">
              {isUnlimited ? "Unlimited" : formatCredits(credits)}
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-0 border-white/[0.08] bg-[#0a0a0f]" align="end">
          <div className="p-4 space-y-4">
            {/* Balance */}
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-xl ${isUnlimited ? "bg-amber-500/10" : "bg-blue-600/10"}`}>
                {isUnlimited ? <Sparkles className="h-5 w-5 text-amber-400" /> : <Coins className="h-5 w-5 text-blue-400" />}
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-white/30">Balance</p>
                <p className={`text-xl font-black ${getCreditColor()}`}>
                  {isUnlimited ? "Unlimited" : credits.toLocaleString()}
                  {!isUnlimited && <span className="text-xs text-white/20 ml-1 font-medium">credits</span>}
                </p>
              </div>
            </div>

            {/* Credit Costs */}
            {!isUnlimited && costs && (
              <div className="space-y-1.5">
                <p className="text-[10px] font-black uppercase tracking-[0.15em] text-white/25">Cost per action</p>
                {COST_LABELS.map(({ label, key, icon }) => (
                  <div key={key} className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2 text-white/40">
                      <span className="text-white/20">{icon}</span>
                      {label}
                    </span>
                    <span className="font-mono text-white/50">{((costs as any)[key] ?? 0).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Lifetime */}
            {balance && !isUnlimited && (
              <div className="flex gap-4 text-xs text-white/25">
                <span><span className="text-white/50 font-bold">{balance.lifetimeUsed.toLocaleString()}</span> used</span>
                <span><span className="text-white/50 font-bold">{balance.lifetimeAdded.toLocaleString()}</span> earned</span>
              </div>
            )}

            {/* Actions */}
            <div className="space-y-2 pt-1 border-t border-white/[0.05]">
              {!isUnlimited && (
                <Button
                  size="sm"
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white border-0 font-bold shadow-lg shadow-blue-600/20"
                  onClick={() => navigate("/dashboard/credits")}
                >
                  <ShoppingCart className="h-3.5 w-3.5 mr-2" />
                  Buy Credits
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                className="w-full border-white/10 bg-white/5 text-white/70 hover:text-white font-semibold"
                onClick={() => navigate("/pricing")}
              >
                <Zap className="h-3.5 w-3.5 mr-2" />
                Upgrade Plan
                <ArrowUpRight className="h-3 w-3 ml-auto" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-xs text-white/25 hover:text-white/50"
                onClick={() => navigate("/dashboard/credits")}
              >
                View Full History
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    );
  }
  