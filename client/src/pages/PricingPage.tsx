import { useAuth } from "@/_core/hooks/useAuth";
import { trackPurchase, trackViewContent } from "@/lib/adTracking";
import { Button } from "@/components/ui/button";
import { getRegisterUrl } from "@/const";
import { useLocation } from "wouter";
import MarketingLayout from "@/components/MarketingLayout";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { toast } from "sonner";
import {
    Check, Shield, Zap, Server, Cpu, Activity,
    Database, Workflow, Globe2, Boxes,
    Vault, Terminal, Lock, BarChart3, Users,
    LayoutDashboard, ShieldCheck, Search,
    Fingerprint, Network, Monitor, FileText,
    ShieldAlert, History, ArrowRight, CalendarDays,
    PhoneCall, Loader2, Sparkles
} from "lucide-react";

  type PlanId = "pro" | "enterprise" | "cyber" | "cyber_plus";

  interface Plan {
    id: PlanId;
    name: string;
    price: number;
    badge?: string;
    badgeColor?: string;
    accentColor: string;
    borderColor: string;
    bgColor: string;
    btnClass: string;
    description: string;
    credits: string;
    features: string[];
    highlight?: boolean;
  }

  const PLANS: Plan[] = [
      {
        id: "pro",
        name: "Pro",
        price: 29,
        accentColor: "text-white/70",
        borderColor: "border-white/[0.05]",
        bgColor: "bg-white/[0.01]",
        btnClass: "bg-white/5 hover:bg-white/10 text-white border border-white/10",
        description: "For individual engineers and security professionals.",
        credits: "50,000 credits/mo",
        features: [
          "50,000 credits/month (~1,000 builder tasks)",
          "Titan AI Builder — unlimited chat & code",
          "All 15+ credential providers, unlimited storage",
          "Stealth browser + CAPTCHA solving",
          "Smart Fetch AI & Expiry Watchdog",
          "Marketplace — buy & sell on Grand Bazaar",
          "Site Monitor & Developer API",
          "Priority email support",
        ],
      },
      {
        id: "enterprise",
        name: "Enterprise",
        price: 99,
        badge: "Most Popular",
        badgeColor: "bg-blue-600 shadow-blue-600/20",
        accentColor: "text-blue-400",
        borderColor: "border-blue-600/20",
        bgColor: "bg-blue-600/[0.02]",
        btnClass: "bg-blue-600 hover:bg-blue-500 text-white border-0 shadow-xl shadow-blue-600/20",
        description: "For growing security teams and engineering organizations.",
        credits: "250,000 credits/mo",
        highlight: true,
        features: [
          "250,000 credits/month (~5,000 builder tasks)",
          "Everything in Pro, plus:",
          "Team management — up to 25 seats",
          "Team Vault (shared, encrypted credentials)",
          "SSO / SAML authentication",
          "Developer API (10,000 req/day) + webhooks",
          "Audit logs (90-day retention)",
          "Dedicated account manager",
        ],
      },
      {
        id: "cyber",
        name: "Cyber",
        price: 199,
        badge: "Security Pro",
        badgeColor: "bg-cyan-600 shadow-cyan-600/20",
        accentColor: "text-cyan-400",
        borderColor: "border-cyan-500/20",
        bgColor: "bg-cyan-500/[0.02]",
        btnClass: "bg-cyan-600 hover:bg-cyan-500 text-white border-0 shadow-xl shadow-cyan-600/20",
        description: "Full offensive security arsenal. Everything unlocked.",
        credits: "750,000 credits/mo",
        features: [
          "750,000 credits/month",
          "Everything in Enterprise, plus:",
          "Full Offensive Suite: Argus, Astra, Metasploit, EvilGinx, BlackEye, CyberMCP",
          "VPN Chain, Tor Gateway, Proxy Maker, IP Rotation",
          "TOTP Vault, Credential Leak Scanner, Health Monitor",
          "Attack Graph & Red Team Playbooks",
          "Audit logs (1-year retention)",
          "Priority security support",
        ],
      },
      {
        id: "cyber_plus",
        name: "Cyber+",
        price: 499,
        badge: "Elite Tier",
        badgeColor: "bg-violet-600 shadow-violet-600/20",
        accentColor: "text-violet-400",
        borderColor: "border-violet-500/25",
        bgColor: "bg-violet-600/[0.04]",
        btnClass: "bg-violet-600 hover:bg-violet-500 text-white border-0 shadow-xl shadow-violet-600/20",
        description: "Maximum firepower for red teams and elite operators.",
        credits: "3,000,000 credits/mo",
        features: [
          "3,000,000 credits/month",
          "Everything in Cyber, plus:",
          "Zero-Click Research Engine (exclusive)",
          "C2 Framework Integration",
          "Custom AI model fine-tuning",
          "Dedicated infrastructure",
          "Unlimited team seats",
          "Direct Slack/Teams support channel",
        ],
      },
    ];

  export default function PricingPage() {
    const { user } = useAuth();
    const [, setLocation] = useLocation();
    const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
    const [annual, setAnnual] = useState(false);

    const createCheckout = trpc.stripe.createCheckout.useMutation();
      const subQuery = trpc.stripe.getSubscription.useQuery(undefined, {
        enabled: !!user,
        retry: false,
        staleTime: 60_000,
      });
      const currentPlanId = subQuery.data?.plan ?? null;

    const handleGetStarted = async (planId: PlanId) => {
      if (!user) {
        window.location.href = getRegisterUrl("/pricing");
        return;
      }
      setLoadingPlan(planId);
      trackViewContent(planId);
      try {
        const result = await createCheckout.mutateAsync({
          planId,
          interval: annual ? "year" : "month",
          source: "web",
        });
        if (result.url) {
          const priceMap: Record<string, number> = { pro: 29, enterprise: 99, cyber: 199, cyber_plus: 499 };
          const price = annual ? priceMap[planId] * 12 * 0.8 : priceMap[planId];
          trackPurchase({ value: price, currency: "USD", planName: planId });
          window.location.href = result.url;
        } else {
          toast.error("Failed to create checkout session. Please try again.");
        }
      } catch (err: any) {
        toast.error(err?.message || "Something went wrong. Please try again.");
      } finally {
        setLoadingPlan(null);
      }
    };

    const getPrice = (base: number) => annual ? Math.round(base * 0.8) : base;
    const getSaving = (base: number) => Math.round(base * 12 * 0.2);

    return (
      <MarketingLayout>
        {/* HEADER */}
        <section className="relative pt-32 pb-16 sm:pt-48 sm:pb-24 overflow-hidden">
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-blue-600/5 rounded-full blur-[120px]" />
          </div>
          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/5 border border-blue-500/10 mb-8">
              <span className="text-[10px] sm:text-xs font-black tracking-widest uppercase text-blue-400/80">Enterprise Packaging</span>
            </div>
            <h1 className="text-5xl sm:text-7xl font-black tracking-tighter leading-[0.9] mb-8 text-white">
              Plans Built for <br />
              <span className="text-white/40">Serious Operations.</span>
            </h1>
            <p className="max-w-2xl mx-auto text-lg text-white/40 leading-relaxed">
              Choose the tier that fits your engineering and security requirements. Self-serve for teams, custom contracts for enterprise.
            </p>

            {/* Annual / Monthly Toggle */}
            <div className="mt-10 flex items-center justify-center gap-4">
              <span className={`text-sm font-bold ${!annual ? "text-white" : "text-white/30"}`}>Monthly</span>
              <button
                onClick={() => setAnnual(v => !v)}
                className={`relative w-14 h-7 rounded-full transition-colors ${annual ? "bg-blue-600" : "bg-white/10"}`}
                role="switch"
                aria-checked={annual}
              >
                <div className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-transform ${annual ? "translate-x-8" : "translate-x-1"}`} />
              </button>
              <span className={`text-sm font-bold ${annual ? "text-white" : "text-white/30"}`}>
                Annual
                <span className="ml-2 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase tracking-wider">
                  Save 20%
                </span>
              </span>
            </div>
          </div>
        </section>

        {/* PRICING GRID */}
        <section className="relative pb-32">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 max-w-7xl mx-auto">
              {PLANS.map(plan => (
                <div
                  key={plan.id}
                  className={`flex flex-col p-7 rounded-3xl border ${plan.borderColor} ${plan.bgColor} relative transition-all duration-500 hover:scale-[1.01] ${plan.highlight ? "shadow-2xl" : ""}`}
                >
                  {plan.id === currentPlanId && (
                    <div className="absolute -top-4 right-4 px-3 py-1 rounded-full bg-emerald-600 text-[10px] font-black uppercase tracking-widest text-white shadow-lg shadow-emerald-900/30">
                      Current Plan
                    </div>
                  )}
                  {plan.badge && plan.id !== currentPlanId && (
                    <div className={`absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full ${plan.badgeColor} text-[10px] font-black uppercase tracking-widest text-white shadow-xl`}>
                      {plan.badge}
                    </div>
                  )}

                  <div className="mb-7">
                    <h3 className={`text-sm font-black uppercase tracking-widest mb-4 ${plan.accentColor}`}>{plan.name}</h3>
                    <div className="flex items-baseline gap-1 mb-1">
                      <span className="text-4xl font-black text-white">${getPrice(plan.price)}</span>
                      <span className="text-base text-white/20">/mo</span>
                    </div>
                    {annual && (
                      <p className="text-[11px] text-emerald-400 font-bold">
                        Save ${getSaving(plan.price)}/year
                      </p>
                    )}
                    <p className="text-[11px] text-white/30 mt-1 font-semibold uppercase tracking-wider">{plan.credits}</p>
                    <p className="text-sm text-white/40 mt-3">{plan.description}</p>
                  </div>

                  <div className="flex-1 space-y-3.5 mb-8">
                    {plan.features.map(f => (
                      <div key={f} className="flex items-start gap-3 text-sm text-white/60">
                        <Check className={`h-4 w-4 shrink-0 mt-0.5 ${plan.accentColor}`} />
                        <span>{f}</span>
                      </div>
                    ))}
                  </div>

                  <Button
                    onClick={() => handleGetStarted(plan.id)}
                    disabled={loadingPlan === plan.id}
                    className={`w-full h-12 font-bold ${plan.btnClass}`}
                  >
                    {loadingPlan === plan.id && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                    {loadingPlan === plan.id
                      ? "Redirecting..."
                      : user
                      ? `Subscribe to ${plan.name}`
                      : `Start with ${plan.name}`}
                  </Button>
                </div>
              ))}
            </div>

            {/* Titan Enterprise card — below the grid, full width */}
            <div className="mt-6 p-7 rounded-3xl border border-white/[0.05] bg-white/[0.01] max-w-7xl mx-auto">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/20 mb-2">Titan Enterprise</p>
                  <h3 className="text-2xl font-black text-white mb-2">Custom Deployment & SLA</h3>
                  <p className="text-white/40 text-sm max-w-xl">
                    10M+ credits/month · On-premise or air-gapped deployment · Custom AI model tuning · Dedicated account manager · SLA & procurement support
                  </p>
                </div>
                <div className="flex gap-3 shrink-0">
                  <Button
                    onClick={() => { window.location.href = "mailto:sales@archibaldtitan.ai"; }}
                    className="bg-white/5 hover:bg-white/10 text-white border border-white/10 h-12 px-8 font-bold"
                  >
                    Contact Sales
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* TRUST & COMPLIANCE SECTION */}
        <section className="relative py-24 sm:py-32 border-t border-white/5 bg-white/[0.01]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-black tracking-tight mb-4 text-white">Built for Enterprise Security.</h2>
              <p className="text-white/40 max-w-2xl mx-auto">Archibald Titan is designed with the controls and auditability required by professional security and engineering teams.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              {[
                { icon: ShieldCheck, title: "SOC2 Compliance", desc: "Our systems are designed with SOC2 Type II standards in mind." },
                { icon: Lock, title: "AES-256 Encryption", desc: "All sensitive data is encrypted at rest and in transit using GCM." },
                { icon: Fingerprint, title: "RBAC Controls", desc: "Granular role-based access control for your entire organization." },
                { icon: History, title: "Full Audit Logs", desc: "Complete history of all credential access and AI operations." }
              ].map((item, i) => (
                <div key={i} className="p-6 rounded-2xl border border-white/[0.05] bg-white/[0.01]">
                  <div className="h-10 w-10 rounded-xl bg-blue-600/10 flex items-center justify-center mb-4">
                    <item.icon className="h-5 w-5 text-blue-500" />
                  </div>
                  <h4 className="font-bold text-white/80 mb-2">{item.title}</h4>
                  <p className="text-xs text-white/40 leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FINAL CTA */}
        <section className="relative py-24 sm:py-32 border-t border-white/5 overflow-hidden">
          <div className="absolute inset-0 bg-blue-600/[0.02] pointer-events-none" />
          <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-4xl sm:text-6xl font-black tracking-tighter mb-8 text-white">Secure Your AI Operations.</h2>
            <p className="text-lg text-white/40 mb-10">Join the professional teams building the future of AI on Archibald Titan.</p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button onClick={() => handleGetStarted("enterprise")} disabled={loadingPlan === "enterprise"} size="lg" className="w-full sm:w-auto bg-blue-600 hover:bg-blue-500 text-white border-0 h-14 px-10 text-base font-bold">
                {loadingPlan === "enterprise" ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                {"enterprise" === currentPlanId ? "Manage Plan" : user ? "Subscribe Now" : "Get Started"}
              </Button>
              <Button onClick={() => { window.location.href = "mailto:sales@archibaldtitan.ai"; }} size="lg" variant="outline" className="w-full sm:w-auto border-white/10 bg-white/5 hover:bg-white/10 text-white h-14 px-10 text-base font-bold">
                Request Demo
              </Button>
            </div>
          </div>
        </section>
      </MarketingLayout>
    );
  }
  