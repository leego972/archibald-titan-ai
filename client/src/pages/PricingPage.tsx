import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { getRegisterUrl } from "@/const";
import { useLocation } from "wouter";
import MarketingLayout from "@/components/MarketingLayout";
import { Check, ShieldCheck, Zap, Lock, Globe2, Activity, Users, Terminal, Shield } from "lucide-react";

const PLANS = [
  {
    id: "pro",
    name: "Pro",
    price: "$49",
    description: "For individual developers and security researchers.",
    features: [
      "15,000 Credits per month",
      "Titan Builder Access",
      "Standard Security Suite",
      "3 Vault Connections",
      "Local-first Execution",
      "Community Support"
    ],
    cta: "Get Started",
    highlight: false
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: "$499",
    description: "For professional engineering and security teams.",
    features: [
      "250,000 Credits per month",
      "Full DevSecOps Suite",
      "Advanced Vault Orchestration",
      "Team Management & RBAC",
      "Audit Logging & Compliance",
      "Priority Support"
    ],
    cta: "Select Enterprise",
    highlight: true
  },
  {
    id: "cyber",
    name: "Cyber",
    price: "$1,499",
    description: "For high-stakes security operations and red teams.",
    features: [
      "1,000,000 Credits per month",
      "Red Team Playbooks",
      "Advanced OSINT & Scanning",
      "Isolated Browser Access",
      "Custom Automation Hooks",
      "Dedicated Account Manager"
    ],
    cta: "Select Cyber",
    highlight: false
  }
];

export default function PricingPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  return (
    <MarketingLayout>
      <div className="relative pt-32 pb-24 sm:pt-48 sm:pb-32 overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-blue-600/5 rounded-full blur-[120px]" />
        </div>
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center mb-20">
          <h1 className="text-4xl sm:text-6xl font-black tracking-tighter mb-6 text-white">Enterprise Packaging.</h1>
          <p className="max-w-2xl mx-auto text-lg text-white/40 leading-relaxed">
            Scalable plans designed for professional engineering and security teams. Choose the tier that fits your operational requirements.
          </p>
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-24">
            {PLANS.map((plan) => (
              <div 
                key={plan.id} 
                className={`relative p-8 rounded-3xl border transition-all duration-500 flex flex-col ${
                  plan.highlight 
                    ? "border-blue-600/30 bg-blue-600/[0.03] shadow-2xl shadow-blue-600/10 scale-105 z-10" 
                    : "border-white/[0.05] bg-white/[0.01] hover:bg-white/[0.03]"
                }`}
              >
                {plan.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-blue-600 rounded-full text-[9px] font-black uppercase tracking-widest text-white">
                    Recommended
                  </div>
                )}
                <div className="mb-8">
                  <h3 className="text-[10px] font-black text-white/30 uppercase tracking-widest mb-2">{plan.name}</h3>
                  <div className="flex items-baseline gap-1 mb-4">
                    <span className="text-4xl font-black text-white">{plan.price}</span>
                    <span className="text-sm text-white/20">/mo</span>
                  </div>
                  <p className="text-sm text-white/40 leading-relaxed">{plan.description}</p>
                </div>
                <ul className="space-y-4 mb-10 flex-1">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-3 text-sm text-white/50">
                      <Check className="h-4 w-4 text-blue-500 shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Button 
                  onClick={() => { window.location.href = getRegisterUrl(); }}
                  className={`w-full h-12 font-bold transition-all ${
                    plan.highlight 
                      ? "bg-blue-600 hover:bg-blue-500 text-white border-0 shadow-lg shadow-blue-600/20" 
                      : "bg-white/5 hover:bg-white/10 text-white border border-white/10"
                  }`}
                >
                  {plan.cta}
                </Button>
              </div>
            ))}
          </div>

          {/* Titan Tier */}
          <div className="max-w-4xl mx-auto p-8 sm:p-12 rounded-3xl border border-white/[0.05] bg-white/[0.01] relative overflow-hidden mb-24">
            <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none">
              <Shield className="h-48 w-48 text-white" />
            </div>
            <div className="relative grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
              <div>
                <h3 className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-2">Titan Tier</h3>
                <h2 className="text-3xl font-black text-white mb-4">Custom Enterprise Solutions.</h2>
                <p className="text-sm text-white/40 leading-relaxed mb-8">
                  For global organizations requiring unlimited scale, custom integrations, and on-premise deployment options.
                </p>
                <Button 
                  onClick={() => setLocation("/contact")}
                  className="bg-white text-black hover:bg-white/90 font-bold h-12 px-8"
                >
                  Contact Sales
                </Button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { icon: Globe2, label: "On-premise Deploy" },
                  { icon: Users, label: "Unlimited Seats" },
                  { icon: Zap, label: "Custom Credits" },
                  { icon: ShieldCheck, label: "Dedicated Support" }
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.05]">
                    <item.icon className="h-4 w-4 text-blue-500" />
                    <span className="text-xs font-bold text-white/60">{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Trust Section */}
          <div className="text-center">
            <h3 className="text-[10px] font-black text-white/20 uppercase tracking-widest mb-12">Trusted Security Infrastructure</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-12 opacity-30 grayscale max-w-4xl mx-auto">
              <div className="flex flex-col items-center gap-2">
                <Lock className="h-6 w-6 text-white" />
                <span className="text-[9px] font-black uppercase tracking-widest">AES-256-GCM</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <ShieldCheck className="h-6 w-6 text-white" />
                <span className="text-[9px] font-black uppercase tracking-widest">SOC2 Ready</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <Activity className="h-6 w-6 text-white" />
                <span className="text-[9px] font-black uppercase tracking-widest">99.9% Uptime</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <Users className="h-6 w-6 text-white" />
                <span className="text-[9px] font-black uppercase tracking-widest">Team RBAC</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </MarketingLayout>
  );
}
