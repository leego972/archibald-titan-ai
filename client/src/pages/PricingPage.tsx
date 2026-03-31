import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { getRegisterUrl } from "@/const";
import { useLocation } from "wouter";
import MarketingLayout from "@/components/MarketingLayout";
import {
  Check, Shield, Zap, Server, Cpu, Activity,
  Database, Workflow, Globe2, Boxes,
  Vault, Terminal, Lock, BarChart3, Users,
  LayoutDashboard, ShieldCheck, Search,
  Fingerprint, Network, Monitor, FileText,
  ShieldAlert, History, ArrowRight, CalendarDays,
  PhoneCall
} from "lucide-react";

export default function PricingPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

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
        </div>
      </section>

      {/* PRICING GRID */}
      <section className="relative pb-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            
            {/* PRO - SELF SERVE */}
            <div className="flex flex-col p-8 rounded-3xl border border-white/[0.05] bg-white/[0.01] hover:bg-white/[0.02] transition-all duration-500">
              <div className="mb-8">
                <h3 className="text-sm font-black uppercase tracking-widest text-white/30 mb-4">Pro</h3>
                <div className="flex items-baseline gap-1 mb-2">
                  <span className="text-5xl font-black text-white">$49</span>
                  <span className="text-lg text-white/20">/mo</span>
                </div>
                <p className="text-sm text-white/40">For individual engineers and security professionals.</p>
              </div>
              
              <div className="flex-1 space-y-4 mb-10">
                {[
                  "50,000 Monthly Credits",
                  "Titan Builder Access",
                  "Standard Security Suite",
                  "3 Encrypted Vaults",
                  "Community Support"
                ].map(f => (
                  <div key={f} className="flex items-center gap-3 text-sm text-white/60">
                    <Check className="h-4 w-4 text-blue-500 shrink-0" />
                    <span>{f}</span>
                  </div>
                ))}
              </div>

              <Button onClick={() => { window.location.href = getRegisterUrl(); }} className="w-full bg-white/5 hover:bg-white/10 text-white border border-white/10 h-12 font-bold">
                Get Started
              </Button>
            </div>

            {/* ENTERPRISE - MOST POPULAR */}
            <div className="flex flex-col p-8 rounded-3xl border border-blue-600/20 bg-blue-600/[0.02] relative group">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-blue-600 text-[10px] font-black uppercase tracking-widest text-white shadow-xl shadow-blue-600/20">
                Most Popular
              </div>
              <div className="mb-8">
                <h3 className="text-sm font-black uppercase tracking-widest text-blue-400 mb-4">Enterprise</h3>
                <div className="flex items-baseline gap-1 mb-2">
                  <span className="text-5xl font-black text-white">$199</span>
                  <span className="text-lg text-white/20">/mo</span>
                </div>
                <p className="text-sm text-white/40">For security teams and engineering organizations.</p>
              </div>
              
              <div className="flex-1 space-y-4 mb-10">
                {[
                  "250,000 Monthly Credits",
                  "Advanced Red Team Ops",
                  "Unlimited Team Vaults",
                  "RBAC & Team Control",
                  "Priority Support"
                ].map(f => (
                  <div key={f} className="flex items-center gap-3 text-sm text-white/60">
                    <Check className="h-4 w-4 text-blue-500 shrink-0" />
                    <span>{f}</span>
                  </div>
                ))}
              </div>

              <Button onClick={() => { window.location.href = getRegisterUrl(); }} className="w-full bg-blue-600 hover:bg-blue-500 text-white border-0 h-12 font-bold shadow-xl shadow-blue-600/20">
                Start with Enterprise
              </Button>
            </div>

            {/* TITAN - CONTACT SALES */}
            <div className="flex flex-col p-8 rounded-3xl border border-white/[0.05] bg-white/[0.01] hover:bg-white/[0.02] transition-all duration-500">
              <div className="mb-8">
                <h3 className="text-sm font-black uppercase tracking-widest text-white/30 mb-4">Titan</h3>
                <div className="flex items-baseline gap-1 mb-2">
                  <span className="text-5xl font-black text-white">Custom</span>
                </div>
                <p className="text-sm text-white/40">For large organizations requiring custom deployment and SLAs.</p>
              </div>
              
              <div className="flex-1 space-y-4 mb-10">
                {[
                  "Unlimited Credits",
                  "On-Premise or Air-Gapped Deployment",
                  "Custom AI Model Tuning",
                  "Dedicated Account Manager",
                  "SLA & Procurement Support"
                ].map(f => (
                  <div key={f} className="flex items-center gap-3 text-sm text-white/60">
                    <Check className="h-4 w-4 text-blue-500 shrink-0" />
                    <span>{f}</span>
                  </div>
                ))}
              </div>

              <Button onClick={() => { window.location.href = "mailto:sales@archibaldtitan.ai"; }} variant="outline" className="w-full border-white/10 bg-white/5 hover:bg-white/10 text-white h-12 font-bold">
                Contact Sales
              </Button>
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
            <Button onClick={() => { window.location.href = getRegisterUrl(); }} size="lg" className="w-full sm:w-auto bg-blue-600 hover:bg-blue-500 text-white border-0 h-14 px-10 text-base font-bold">
              Get Started
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
