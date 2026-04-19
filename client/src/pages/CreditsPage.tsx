import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Coins, Sparkles, Infinity as InfinityIcon, ShoppingCart, ArrowUpRight,
  TrendingUp, TrendingDown, Clock, Zap, Gift, CreditCard, Settings,
  MessageSquare, Wrench, Mic, Shield, Crosshair, Bug, Eye, Network,
  Globe, Server, RefreshCw, Monitor, Cpu, Activity, Terminal, Search,
  FileText, Upload, Download, DollarSign, ShoppingBag, Share2, Lock,
  AlertTriangle, Fingerprint, Radio, GitBranch, Image, Video, Code2,
} from "lucide-react";
import { useLocation, useSearch } from "wouter";
import { useEffect } from "react";
import { toast } from "sonner";

function getTypeIcon(type: string) {
  const map: Record<string, React.ReactNode> = {
    chat_message:            <MessageSquare className="h-4 w-4" />,
    builder_action:          <Wrench className="h-4 w-4" />,
    voice_action:            <Mic className="h-4 w-4" />,
    signup_bonus:            <Gift className="h-4 w-4" />,
    monthly_refill:          <Clock className="h-4 w-4" />,
    pack_purchase:           <ShoppingCart className="h-4 w-4" />,
    admin_adjustment:        <Settings className="h-4 w-4" />,
    referral_bonus:          <Gift className="h-4 w-4" />,
    security_scan:           <Shield className="h-4 w-4" />,
    metasploit_action:       <Crosshair className="h-4 w-4" />,
    evilginx_action:         <Eye className="h-4 w-4" />,
    blackeye_action:         <Eye className="h-4 w-4" />,
    astra_scan:              <Bug className="h-4 w-4" />,
    exploit_exec:            <AlertTriangle className="h-4 w-4" />,
    exploit_cve_search:      <AlertTriangle className="h-4 w-4" />,
    bin_lookup:              <CreditCard className="h-4 w-4" />,
    bin_bulk_lookup:         <CreditCard className="h-4 w-4" />,
    bin_reverse_search:      <CreditCard className="h-4 w-4" />,
    card_live_check:         <CreditCard className="h-4 w-4" />,
    vpn_generate:            <Network className="h-4 w-4" />,
    vpn_chain_build:         <Network className="h-4 w-4" />,
    vpn_chain_config:        <Network className="h-4 w-4" />,
    tor_new_circuit:         <Globe className="h-4 w-4" />,
    tor_run_command:         <Globe className="h-4 w-4" />,
    proxy_test:              <Server className="h-4 w-4" />,
    proxy_test_all:          <Server className="h-4 w-4" />,
    proxy_scrape:            <Server className="h-4 w-4" />,
    proxy_add:               <Server className="h-4 w-4" />,
    ip_rotation_circuit:     <RefreshCw className="h-4 w-4" />,
    web_agent_task:          <Radio className="h-4 w-4" />,
    isolated_browser_session:<Monitor className="h-4 w-4" />,
    cybermcp_scan:           <Cpu className="h-4 w-4" />,
    linken_session_start:    <Fingerprint className="h-4 w-4" />,
    linken_quick_create:     <Fingerprint className="h-4 w-4" />,
    site_monitor_add:        <Activity className="h-4 w-4" />,
    site_monitor_check:      <Activity className="h-4 w-4" />,
    sandbox_run:             <Terminal className="h-4 w-4" />,
    seo_run:                 <Search className="h-4 w-4" />,
    blog_generate:           <FileText className="h-4 w-4" />,
    content_generate:        <FileText className="h-4 w-4" />,
    content_campaign_create: <FileText className="h-4 w-4" />,
    content_bulk_generate:   <FileText className="h-4 w-4" />,
    content_seo_brief:       <FileText className="h-4 w-4" />,
    marketing_run:           <TrendingUp className="h-4 w-4" />,
    advertising_run:         <TrendingUp className="h-4 w-4" />,
    clone_action:            <Download className="h-4 w-4" />,
    replicate_action:        <Download className="h-4 w-4" />,
    github_action:           <GitBranch className="h-4 w-4" />,
    import_action:           <Upload className="h-4 w-4" />,
    fetch_action:            <Download className="h-4 w-4" />,
    grant_match:             <DollarSign className="h-4 w-4" />,
    grant_apply:             <DollarSign className="h-4 w-4" />,
    business_plan_generate:  <FileText className="h-4 w-4" />,
    marketplace_list:        <ShoppingBag className="h-4 w-4" />,
    marketplace_feature:     <ShoppingBag className="h-4 w-4" />,
    marketplace_ai_describe: <ShoppingBag className="h-4 w-4" />,
    marketplace_ai_price:    <ShoppingBag className="h-4 w-4" />,
    affiliate_action:        <Share2 className="h-4 w-4" />,
    api_call:                <Code2 className="h-4 w-4" />,
    image_generation:        <Image className="h-4 w-4" />,
    video_generation:        <Video className="h-4 w-4" />,
    credential_breach_check: <Shield className="h-4 w-4" />,
    totp_code_generate:      <Lock className="h-4 w-4" />,
  };
  return map[type] ?? <Coins className="h-4 w-4" />;
}

function getTypeLabel(type: string) {
  const map: Record<string, string> = {
    chat_message:            "Chat Message",
    builder_action:          "Builder Task",
    voice_action:            "Voice Command",
    signup_bonus:            "Welcome Bonus",
    monthly_refill:          "Monthly Refill",
    pack_purchase:           "Credits Purchased",
    admin_adjustment:        "Admin Adjustment",
    referral_bonus:          "Referral Reward",
    security_scan:           "Argus Recon Scan",
    metasploit_action:       "Metasploit",
    evilginx_action:         "EvilGinx",
    blackeye_action:         "BlackEye",
    astra_scan:              "Astra Scan",
    exploit_exec:            "Exploit Executed",
    exploit_cve_search:      "CVE Search",
    bin_lookup:              "BIN Lookup",
    bin_bulk_lookup:         "BIN Bulk Lookup",
    bin_reverse_search:      "BIN Reverse Search",
    card_live_check:         "Card Live Check",
    vpn_generate:            "VPN Config Generate",
    vpn_chain_build:         "VPN Chain Build",
    vpn_chain_config:        "VPN Chain Config",
    tor_new_circuit:         "Tor New Circuit",
    tor_run_command:         "Tor Command",
    proxy_test:              "Proxy Test",
    proxy_test_all:          "Proxy Bulk Test",
    proxy_scrape:            "Proxy Scrape",
    proxy_add:               "Proxy Added",
    ip_rotation_circuit:     "IP Rotation",
    web_agent_task:          "Web Agent Task",
    isolated_browser_session:"Isolated Browser",
    cybermcp_scan:           "CyberMCP Scan",
    linken_session_start:    "LinkenSphere Session",
    linken_quick_create:     "LinkenSphere Create",
    site_monitor_add:        "Site Monitor Added",
    site_monitor_check:      "Site Health Check",
    sandbox_run:             "Sandbox Run",
    seo_run:                 "SEO Analysis",
    blog_generate:           "Blog Post Generated",
    content_generate:        "Content Generated",
    content_campaign_create: "Campaign Created",
    content_bulk_generate:   "Bulk Content",
    content_seo_brief:       "SEO Brief",
    marketing_run:           "Marketing Run",
    advertising_run:         "Ad Campaign",
    clone_action:            "Clone",
    replicate_action:        "Replicate",
    github_action:           "GitHub Action",
    import_action:           "Import",
    fetch_action:            "Data Fetch",
    grant_match:             "Grant Search",
    grant_apply:             "Grant Application",
    business_plan_generate:  "Business Plan",
    marketplace_list:        "Marketplace Listing",
    marketplace_feature:     "Marketplace Feature",
    marketplace_ai_describe: "AI Description",
    marketplace_ai_price:    "AI Pricing",
    affiliate_action:        "Affiliate Action",
    api_call:                "API Call",
    image_generation:        "Image Generated",
    video_generation:        "Video Generated",
    credential_breach_check: "Breach Check",
    totp_code_generate:      "TOTP Code",
  };
  return map[type] ?? type.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

const CYBER_COST_LABELS: Array<{ label: string; key: string; icon: React.ReactNode; color: string }> = [
  { label: "Chat",          key: "chat_message",     icon: <MessageSquare className="h-3.5 w-3.5" />, color: "text-blue-400" },
  { label: "Builder Task",  key: "builder_action",   icon: <Wrench className="h-3.5 w-3.5" />,        color: "text-purple-400" },
  { label: "Argus Scan",    key: "security_scan",    icon: <Shield className="h-3.5 w-3.5" />,        color: "text-cyan-400" },
  { label: "Astra Scan",    key: "astra_scan",       icon: <Bug className="h-3.5 w-3.5" />,           color: "text-emerald-400" },
  { label: "Metasploit",    key: "metasploit_action",icon: <Crosshair className="h-3.5 w-3.5" />,     color: "text-red-400" },
  { label: "EvilGinx",      key: "evilginx_action",  icon: <Eye className="h-3.5 w-3.5" />,           color: "text-orange-400" },
  { label: "VPN Chain",     key: "vpn_chain_build",  icon: <Network className="h-3.5 w-3.5" />,       color: "text-violet-400" },
  { label: "BIN Lookup",    key: "bin_lookup",        icon: <CreditCard className="h-3.5 w-3.5" />,   color: "text-amber-400" },
  { label: "Web Agent",     key: "web_agent_task",   icon: <Radio className="h-3.5 w-3.5" />,         color: "text-pink-400" },
  { label: "Voice",         key: "voice_action",     icon: <Mic className="h-3.5 w-3.5" />,           color: "text-indigo-400" },
];

export default function CreditsPage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const search = useSearch();

  const { data: balance } = trpc.credits.getBalance.useQuery(undefined, { enabled: !!user });
  const { data: history, isLoading: historyLoading } = trpc.credits.getHistory.useQuery(
    { limit: 50, offset: 0 }, { enabled: !!user }
  );
  const { data: packs } = trpc.credits.getPacks.useQuery(undefined, { enabled: !!user });
  const { data: costs } = trpc.credits.getCosts.useQuery(undefined, { enabled: !!user });
    const { data: subData } = trpc.stripe.getSubscription.useQuery(undefined, { enabled: !!user });
    const PLAN_NAMES: Record<string, string> = {
      free: "Free", pro: "Pro", enterprise: "Enterprise",
      cyber: "Cyber", cyber_plus: "Cyber+", titan: "Titan",
    };
    const planName = PLAN_NAMES[subData?.plan ?? "free"] ?? "Free";

  const purchaseMutation = trpc.credits.purchasePack.useMutation({
    onSuccess: (data) => {
      if (data.checkoutUrl) {
        window.open(data.checkoutUrl, "_blank");
        toast.success("Redirecting to checkout", { description: "A new tab has been opened for payment." });
      }
    },
    onError: (err) => toast.error("Purchase failed", { description: err.message }),
  });

  useEffect(() => {
    const params = new URLSearchParams(search);
    if (params.get("purchase") === "success") {
      toast.success("Credits purchased!", {
        description: `${params.get("credits") || ""} credits have been added to your account.`,
      });
    } else if (params.get("purchase") === "canceled") {
      toast.info("Purchase canceled", { description: "No credits were added." });
    }
  }, [search]);

  const isUnlimited = balance?.isUnlimited ?? false;
  const credits = balance?.credits ?? 0;

  return (
    <div className="w-full max-w-5xl space-y-8 pb-12">

      {/* ── Hero: Balance + Two Primary Actions ─────────────────── */}
      <div className="rounded-2xl border border-white/[0.06] bg-gradient-to-br from-blue-600/10 via-transparent to-violet-600/5 p-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-white/30 mb-2">Credit Balance</p>
            <div className="flex items-baseline gap-3">
              {isUnlimited ? (
                <span className="flex items-center gap-3 text-amber-400">
                  <Sparkles className="h-8 w-8" />
                  <span className="text-5xl font-black">Unlimited</span>
                </span>
              ) : (
                <>
                  <span className="text-5xl font-black text-white tabular-nums">{credits.toLocaleString()}</span>
                  <span className="text-lg text-white/30 font-medium">credits</span>
                </>
              )}
            </div>
            {balance && !isUnlimited && (
              <div className="flex gap-6 mt-3 text-sm text-white/40">
                <span className="flex items-center gap-1.5">
                  <TrendingDown className="h-3.5 w-3.5 text-red-400/60" />
                  {balance.lifetimeUsed.toLocaleString()} used
                </span>
                <span className="flex items-center gap-1.5">
                  <TrendingUp className="h-3.5 w-3.5 text-emerald-400/60" />
                  {balance.lifetimeAdded.toLocaleString()} earned
                </span>
              </div>
            )}
            <p className="text-xs text-white/25 mt-2">
              Plan: <span className="text-white/50 font-semibold">{planName}</span>
              {!isUnlimited && " · Credits refill monthly"}
            </p>
          </div>

          <div className="flex flex-col gap-3 min-w-[200px]">
            {!isUnlimited && (
              <Button
                size="lg"
                className="w-full bg-blue-600 hover:bg-blue-500 text-white border-0 shadow-xl shadow-blue-600/25 font-bold h-12 text-base"
                onClick={() => document.getElementById("buy-packs")?.scrollIntoView({ behavior: "smooth" })}
              >
                <ShoppingCart className="h-5 w-5 mr-2" />
                Buy Credits
              </Button>
            )}
            <Button
              size="lg"
              variant="outline"
              className="w-full border-white/10 bg-white/5 text-white hover:bg-white/10 font-bold h-12 text-base"
              onClick={() => navigate("/pricing")}
            >
              <Zap className="h-5 w-5 mr-2" />
              {isUnlimited ? "View All Plans" : "Upgrade Plan"}
              <ArrowUpRight className="h-4 w-4 ml-auto" />
            </Button>
          </div>
        </div>
      </div>

      {/* ── Credit Packs ─────────────────────────────────────────── */}
      {!isUnlimited && (
        <div id="buy-packs">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-base font-black text-white/80">Top Up Credits</h2>
              <p className="text-xs text-white/30 font-medium mt-0.5">One-time purchase · Credits never expire · Instant delivery</p>
            </div>
          </div>

          {packs && packs.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {packs.map((pack: any) => (
                <div
                  key={pack.id}
                  className={`relative rounded-2xl border p-5 transition-all hover:scale-[1.01] ${
                    pack.popular
                      ? "border-blue-500/40 bg-blue-600/10 shadow-lg shadow-blue-600/10"
                      : "border-white/[0.06] bg-white/[0.01] hover:border-white/10"
                  }`}
                >
                  {pack.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <Badge className="bg-blue-600 text-white text-[10px] font-black uppercase tracking-wider px-3 border-0">
                        Most Popular
                      </Badge>
                    </div>
                  )}
                  <div className="space-y-4">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.15em] text-white/30">{pack.name}</p>
                      <p className="text-3xl font-black text-white mt-1">
                        {pack.credits.toLocaleString()}
                        <span className="text-sm font-bold text-white/30 ml-1">credits</span>
                      </p>
                    </div>
                    <div>
                      <p className="text-2xl font-black text-white">${pack.price}</p>
                      <p className="text-[10px] text-white/25 font-medium">
                        ${(pack.price / pack.credits * 1000).toFixed(2)} per 1k credits
                      </p>
                    </div>
                    <Button
                      className={`w-full font-bold h-10 ${
                        pack.popular
                          ? "bg-blue-600 hover:bg-blue-500 text-white border-0 shadow-lg shadow-blue-600/20"
                          : "bg-white/5 hover:bg-white/10 text-white border border-white/10"
                      }`}
                      onClick={() => purchaseMutation.mutate({ packId: pack.id })}
                      disabled={purchaseMutation.isPending}
                    >
                      <CreditCard className="h-4 w-4 mr-2" />
                      Buy Now
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Card className="border-white/[0.05] bg-white/[0.01]">
              <CardContent className="py-10 text-center text-white/30 text-sm">
                Credit packs are not configured yet.
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ── Upgrade Membership ────────────────────────────────────── */}
      {!isUnlimited && (
        <div className="rounded-2xl border border-violet-500/20 bg-gradient-to-br from-violet-600/10 to-blue-600/5 p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
            <div className="flex items-start gap-4">
              <div className="h-12 w-12 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center shrink-0">
                <Zap className="h-6 w-6 text-violet-400" />
              </div>
              <div>
                <h3 className="text-base font-black text-white/90">Upgrade Your Membership</h3>
                <p className="text-sm text-white/40 font-medium mt-1">
                  Get a higher monthly credit allocation automatically — no one-time purchases needed.
                </p>
                <div className="flex flex-wrap gap-x-6 gap-y-1 mt-3 text-xs text-white/40">
                  <span><span className="text-white/70 font-bold">Pro</span> · 50,000 credits/mo</span>
                  <span><span className="text-white/70 font-bold">Enterprise</span> · 250,000 credits/mo</span>
                  <span><span className="text-cyan-400 font-bold">Cyber</span> · 750,000 credits/mo</span>
                </div>
              </div>
            </div>
            <Button
              size="lg"
              className="bg-violet-600 hover:bg-violet-500 text-white border-0 shadow-xl shadow-violet-600/20 font-bold h-12 px-8 shrink-0"
              onClick={() => navigate("/pricing")}
            >
              View Plans
              <ArrowUpRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </div>
      )}

      {/* ── Credit Cost Reference ─────────────────────────────────── */}
      <div>
        <h2 className="text-base font-black text-white/80 mb-5">Credit Cost Reference</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {CYBER_COST_LABELS.map(({ label, key, icon, color }) => (
            <div
              key={key}
              className="flex items-center justify-between px-4 py-3 rounded-xl border border-white/[0.05] bg-white/[0.01]"
            >
              <div className="flex items-center gap-3">
                <span className={color}>{icon}</span>
                <span className="text-sm text-white/60 font-medium">{label}</span>
              </div>
              <Badge variant="secondary" className="font-mono text-xs bg-white/5 text-white/50 border-white/10">
                {costs ? (costs as any)[key]?.toLocaleString() ?? "—" : "—"}
              </Badge>
            </div>
          ))}
        </div>
      </div>

      {/* ── Transaction History ───────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-base font-black text-white/80">Transaction History</h2>
            {history && (
              <p className="text-xs text-white/30 font-medium mt-0.5">{history.total.toLocaleString()} total transactions</p>
            )}
          </div>
        </div>

        <Card className="border-white/[0.05] bg-white/[0.01] overflow-hidden">
          <CardContent className="p-0">
            {historyLoading ? (
              <div className="flex items-center justify-center py-16 text-white/20 text-sm gap-2">
                <Clock className="h-4 w-4 animate-spin" /> Loading history…
              </div>
            ) : history && history.transactions.length > 0 ? (
              <div className="divide-y divide-white/[0.04]">
                {history.transactions.map((tx: any) => (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between px-5 py-4 hover:bg-white/[0.01] transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`p-2 rounded-lg ${tx.amount >= 0 ? "bg-emerald-500/10 text-emerald-400" : "bg-white/[0.04] text-white/30"}`}>
                        {getTypeIcon(tx.type)}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-white/80">{getTypeLabel(tx.type)}</p>
                        {tx.description && (
                          <p className="text-[11px] text-white/25 font-medium truncate max-w-[240px]">{tx.description}</p>
                        )}
                        <p className="text-[10px] text-white/20 font-medium mt-0.5">
                          {new Date(tx.createdAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`text-sm font-mono font-bold ${
                        tx.amount > 0 ? "text-emerald-400" : tx.amount < 0 ? "text-red-400/80" : "text-white/30"
                      }`}>
                        {tx.amount > 0 ? "+" : ""}{tx.amount.toLocaleString()}
                      </p>
                      <p className="text-[10px] text-white/20 tabular-nums mt-0.5">
                        bal: {tx.balanceAfter.toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <Coins className="h-8 w-8 text-white/10" />
                <p className="text-sm text-white/20 font-medium">No transactions yet — start using your tools to see credit usage</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
