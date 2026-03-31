import { Button } from "@/components/ui/button";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { TIER_LOGOS } from "@/lib/logos";
import { useState } from "react";
import MarketingLayout from "@/components/MarketingLayout";
import {
  Check,
  Sparkles,
  Loader2,
  ShieldCheck,
  Globe,
  Lock
} from "lucide-react";
import {
  PRICING_TIERS,
  type PlanId,
  type PricingTier,
} from "@shared/pricing";

// Filter tiers for public display: Pro, Enterprise, Cyber, Titan (Contact Sales)
const PUBLIC_TIERS = PRICING_TIERS.filter(t => ["pro", "enterprise", "cyber", "titan"].includes(t.id));

function BillingToggle({
  interval,
  setInterval,
}: {
  interval: "month" | "year";
  setInterval: (v: "month" | "year") => void;
}) {
  return (
    <div className="flex items-center justify-center gap-4 mb-12">
      <span className={`text-sm font-medium transition-colors ${interval === "month" ? "text-white" : "text-white/40"}`}>
        Monthly
      </span>
      <button
        onClick={() => setInterval(interval === "month" ? "year" : "month")}
        className={`relative w-14 h-7 rounded-full transition-colors duration-300 ${
          interval === "year" ? "bg-blue-600" : "bg-white/10 border border-white/20"
        }`}
      >
        <span className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow-md transition-transform duration-300 ${
          interval === "year" ? "translate-x-7" : "translate-x-0"
        }`} />
      </button>
      <span className={`text-sm font-medium transition-colors ${interval === "year" ? "text-white" : "text-white/40"}`}>
        Yearly
      </span>
      {interval === "year" && (
        <span className="ml-1 px-2.5 py-0.5 text-xs font-bold bg-blue-500/20 text-blue-400 rounded-full border border-blue-500/30">
          Save 17%
        </span>
      )}
    </div>
  );
}

function TierCard({
  tier,
  interval,
  onSubscribe,
  isLoading,
}: {
  tier: PricingTier;
  interval: "month" | "year";
  onSubscribe: (planId: PlanId) => void;
  isLoading: boolean;
}) {
  const price = interval === "month" ? tier.monthlyPrice : tier.yearlyPrice;
  const isHighlighted = tier.id === "enterprise";
  const isContactSales = tier.id === "titan";
  const tierLogo = TIER_LOGOS[tier.id];

  return (
    <div className={`relative flex flex-col rounded-3xl border transition-all duration-300 ${
      isHighlighted 
        ? "border-blue-500/40 bg-blue-500/[0.05] shadow-2xl shadow-blue-500/10 ring-1 ring-blue-500/20 scale-[1.02]" 
        : "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]"
    }`}>
      {isHighlighted && (
        <div className="absolute -top-4 left-1/2 -translate-x-1/2">
          <span className="inline-flex items-center gap-1.5 px-4 py-1 text-[10px] font-black uppercase tracking-widest bg-blue-600 text-white rounded-full shadow-lg shadow-blue-500/30">
            <Sparkles className="w-3 h-3" />
            Most Popular
          </span>
        </div>
      )}

      <div className="p-8 flex-1 flex flex-col">
        <div className="flex items-center gap-3 mb-4">
          {tierLogo && <img src={tierLogo} alt={tier.name} className="w-10 h-10 object-contain opacity-80" />}
          <h3 className="text-xl font-bold text-white">{tier.name}</h3>
        </div>
        <p className="text-sm text-white/50 mb-6 leading-relaxed">{tier.tagline}</p>

        <div className="mb-8">
          {isContactSales ? (
            <div className="text-4xl font-black text-white tracking-tight">Custom</div>
          ) : (
            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-black text-white tracking-tight">${price.toLocaleString()}</span>
              <span className="text-white/40 text-sm">/{interval === "month" ? "mo" : "yr"}</span>
            </div>
          )}
        </div>

        <Button 
          onClick={() => isContactSales ? (window.location.href = "/contact") : onSubscribe(tier.id)}
          disabled={isLoading}
          className={`w-full h-12 text-sm font-bold mb-8 ${
            isHighlighted 
              ? "bg-blue-600 hover:bg-blue-500 text-white border-0 shadow-xl shadow-blue-600/20" 
              : "bg-white/5 hover:bg-white/10 text-white border border-white/10"
          }`}
        >
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : isContactSales ? "Contact Sales" : tier.cta}
        </Button>

        <div className="space-y-4">
          <p className="text-[10px] font-black text-white/30 uppercase tracking-widest">Key Features</p>
          <ul className="space-y-3">
            {tier.features.slice(0, 6).map((feature, i) => (
              <li key={i} className="flex items-start gap-3">
                <Check className="w-4 h-4 mt-0.5 text-blue-500 shrink-0" />
                <span className="text-sm text-white/70">{feature}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

export default function PricingPage() {
  const { user } = useAuth();
  const [interval, setInterval] = useState<"month" | "year">("month");
  const [loadingPlan, setLoadingPlan] = useState<PlanId | null>(null);

  const createCheckout = trpc.stripe.createCheckoutSession.useMutation();

  const handleSubscribe = async (planId: PlanId) => {
    if (!user) { window.location.href = getLoginUrl(); return; }
    try {
      setLoadingPlan(planId);
      const { url } = await createCheckout.mutateAsync({ planId, interval });
      if (url) window.location.href = url;
    } catch (err: any) {
      console.error("Checkout failed:", err);
    } finally {
      setLoadingPlan(null);
    }
  };

  return (
    <MarketingLayout>
      <main className="pt-32 pb-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h1 className="text-4xl sm:text-6xl font-black tracking-tight mb-6">Enterprise-Grade <br />AI Orchestration.</h1>
            <p className="text-white/50 text-lg max-w-2xl mx-auto mb-10">Choose the plan that fits your team's scale. All plans include our local-first architecture and AES-256 encrypted vault.</p>
            <BillingToggle interval={interval} setInterval={setInterval} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-24">
            {PUBLIC_TIERS.map((tier) => (
              <TierCard 
                key={tier.id} 
                tier={tier} 
                interval={interval} 
                onSubscribe={handleSubscribe}
                isLoading={loadingPlan === tier.id}
              />
            ))}
          </div>

          {/* Trust Section */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 py-24 border-t border-white/5">
            <div className="text-center">
              <div className="h-12 w-12 rounded-2xl bg-blue-500/10 flex items-center justify-center mx-auto mb-6">
                <ShieldCheck className="h-6 w-6 text-blue-500" />
              </div>
              <h4 className="font-bold mb-2">SOC2 Ready</h4>
              <p className="text-sm text-white/40">Designed with enterprise compliance and security standards in mind.</p>
            </div>
            <div className="text-center">
              <div className="h-12 w-12 rounded-2xl bg-blue-500/10 flex items-center justify-center mx-auto mb-6">
                <Globe className="h-6 w-6 text-blue-500" />
              </div>
              <h4 className="font-bold mb-2">Global Infrastructure</h4>
              <p className="text-sm text-white/40">Connect to over 15+ cloud providers and credential systems seamlessly.</p>
            </div>
            <div className="text-center">
              <div className="h-12 w-12 rounded-2xl bg-blue-500/10 flex items-center justify-center mx-auto mb-6">
                <Lock className="h-6 w-6 text-blue-500" />
              </div>
              <h4 className="font-bold mb-2">Local-First Privacy</h4>
              <p className="text-sm text-white/40">Your prompts and credentials never leave your local environment.</p>
            </div>
          </div>
        </div>
      </main>
    </MarketingLayout>
  );
}
