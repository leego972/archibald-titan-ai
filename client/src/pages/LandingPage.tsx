import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { getRegisterUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { AT_ICON_64 } from "@/lib/logos";
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import MarketingLayout from "@/components/MarketingLayout";
import {
  Shield, ChevronDown, ArrowRight, Check,
  ShieldCheck, Server, Cpu, Activity,
  Database, Workflow, Globe2, Boxes,
  Vault, Terminal, ChevronUp
} from "lucide-react";

function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-white/5 last:border-0">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between py-5 text-left gap-4 group">
        <span className="text-sm sm:text-base font-medium text-white/80 group-hover:text-white transition-colors">{question}</span>
        {open ? <ChevronUp className="h-4 w-4 text-white/40 shrink-0" /> : <ChevronDown className="h-4 w-4 text-white/40 shrink-0" />}
      </button>
      {open && <div className="pb-5"><p className="text-sm text-white/50 leading-relaxed">{answer}</p></div>}
    </div>
  );
}

export default function LandingPage() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!loading && user) setLocation("/dashboard");
  }, [user, loading, setLocation]);

  return (
    <MarketingLayout>
      {/* HERO */}
      <section className="relative pt-32 pb-20 sm:pt-48 sm:pb-32 overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-blue-600/10 rounded-full blur-[120px]" />
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 mb-8">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
            </span>
            <span className="text-[10px] sm:text-xs font-bold tracking-widest uppercase text-blue-400">Enterprise DevSecOps Orchestration</span>
          </div>
          <h1 className="text-5xl sm:text-7xl lg:text-8xl font-black tracking-tighter leading-[0.9] mb-8">
            The Unified <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-b from-white via-white to-white/40">AI Command Center.</span>
          </h1>
          <p className="max-w-2xl mx-auto text-lg sm:text-xl text-white/50 leading-relaxed mb-10">
            Archibald Titan is the enterprise-grade orchestration platform for secure AI agents. Automate complex DevSecOps workflows, manage encrypted credentials, and deploy local-first intelligence at scale.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button onClick={() => { window.location.href = getRegisterUrl(); }} size="lg" className="w-full sm:w-auto bg-blue-600 hover:bg-blue-500 text-white border-0 shadow-2xl shadow-blue-600/40 h-14 px-10 text-base font-bold group">
              Start Building <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </Button>
            <Button onClick={() => { document.getElementById("features")?.scrollIntoView({ behavior: "smooth" }); }} size="lg" variant="outline" className="w-full sm:w-auto border-white/10 bg-white/5 hover:bg-white/10 text-white h-14 px-10 text-base font-bold">
              View Solutions
            </Button>
          </div>
          <div className="mt-16 flex items-center justify-center gap-8 text-white/30">
            <div className="flex flex-col items-center gap-1">
              <span className="text-2xl font-black text-white/60">SOC2</span>
              <span className="text-[10px] uppercase tracking-widest font-bold">Ready Design</span>
            </div>
            <div className="w-px h-8 bg-white/10" />
            <div className="flex flex-col items-center gap-1">
              <span className="text-2xl font-black text-white/60">AES-256</span>
              <span className="text-[10px] uppercase tracking-widest font-bold">Encryption</span>
            </div>
            <div className="w-px h-8 bg-white/10" />
            <div className="flex flex-col items-center gap-1">
              <span className="text-2xl font-black text-white/60">100%</span>
              <span className="text-[10px] uppercase tracking-widest font-bold">Local Control</span>
            </div>
          </div>
        </div>
      </section>

      {/* CORE PILLARS */}
      <section id="features" className="relative py-24 sm:py-32 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="group p-8 rounded-3xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] transition-all duration-500">
              <div className="h-12 w-12 rounded-2xl bg-blue-500/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500">
                <Terminal className="h-6 w-6 text-blue-500" />
              </div>
              <h3 className="text-xl font-bold mb-3">Unified AI Command</h3>
              <p className="text-white/50 text-sm leading-relaxed">The Titan Builder console provides a single pane of glass for orchestrating AI agents, managing infrastructure, and automating complex engineering workflows.</p>
            </div>
            <div className="group p-8 rounded-3xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] transition-all duration-500">
              <div className="h-12 w-12 rounded-2xl bg-blue-500/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500">
                <ShieldCheck className="h-6 w-6 text-blue-500" />
              </div>
              <h3 className="text-xl font-bold mb-3">Enterprise DevSecOps</h3>
              <p className="text-white/50 text-sm leading-relaxed">Integrate professional-grade security scanning, OSINT, and vulnerability management directly into your development lifecycle with local-first execution.</p>
            </div>
            <div className="group p-8 rounded-3xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] transition-all duration-500">
              <div className="h-12 w-12 rounded-2xl bg-blue-500/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500">
                <Vault className="h-6 w-6 text-blue-500" />
              </div>
              <h3 className="text-xl font-bold mb-3">Credential Orchestration</h3>
              <p className="text-white/50 text-sm leading-relaxed">Securely manage and rotate credentials across your entire toolchain with an AES-256-GCM encrypted vault designed for high-stakes environments.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ARCHITECTURE */}
      <section className="relative py-24 sm:py-32 border-t border-white/5 bg-white/[0.01]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-3xl sm:text-4xl font-black tracking-tight mb-6">Built for the Modern <br />Security Stack.</h2>
              <p className="text-white/50 text-lg leading-relaxed mb-8">
                Archibald Titan isn't just another AI wrapper. It's a complete control layer that connects your tools, your credentials, and your workflows into a single, secure environment.
              </p>
              <div className="space-y-4">
                {[
                  { icon: Server, title: "Local-First Execution", desc: "Your data and prompts never leave your infrastructure." },
                  { icon: Activity, title: "Real-time Monitoring", desc: "Live tracking of credential health and provider status." },
                  { icon: Cpu, title: "Agent Orchestration", desc: "Deploy and manage multiple AI agents for parallel tasks." }
                ].map((item, i) => (
                  <div key={i} className="flex gap-4 p-4 rounded-2xl border border-white/[0.05] bg-white/[0.02]">
                    <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0">
                      <item.icon className="h-5 w-5 text-blue-500" />
                    </div>
                    <div>
                      <h4 className="font-bold text-white/90">{item.title}</h4>
                      <p className="text-sm text-white/40">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="relative p-8 rounded-3xl border border-blue-500/20 bg-blue-500/[0.02] shadow-2xl shadow-blue-500/5">
              <div className="flex justify-center mb-8">
                <div className="px-6 py-3 rounded-xl border border-blue-500/30 bg-blue-500/10">
                  <span className="text-sm font-bold text-blue-400 tracking-widest uppercase">Titan Builder Console</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { icon: Shield, label: "Security Suite", color: "text-blue-400" },
                  { icon: KeyRound, label: "Vault Manager", color: "text-blue-400" },
                  { icon: Database, label: "Local Storage", color: "text-blue-400" },
                  { icon: Workflow, label: "Automations", color: "text-blue-400" },
                  { icon: Globe2, label: "Provider Hub", color: "text-blue-400" },
                  { icon: Boxes, label: "Module Library", color: "text-blue-400" }
                ].map((node) => (
                  <div key={node.label} className="flex items-center gap-3 p-4 rounded-xl border border-white/[0.05] bg-white/[0.02]">
                    <node.icon className={`h-5 w-5 ${node.color}`} />
                    <span className="text-sm font-medium text-white/70">{node.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PRICING PREVIEW */}
      <section id="pricing-preview" className="relative py-24 sm:py-32 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight mb-4">Scalable for Every Team.</h2>
            <p className="text-white/50 max-w-2xl mx-auto">From individual developers to global security teams, Archibald Titan provides the power you need with the security you demand.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {/* Pro */}
            <div className="p-8 rounded-3xl border border-white/[0.06] bg-white/[0.02]">
              <div className="text-sm font-bold text-white/40 uppercase tracking-widest mb-2">Pro</div>
              <div className="text-4xl font-black mb-6">$49<span className="text-lg font-normal text-white/30">/mo</span></div>
              <ul className="space-y-4 mb-8">
                {["15,000 Credits/mo", "Titan Builder Access", "Standard Security Suite", "3 Vault Connections"].map(f => (
                  <li key={f} className="flex items-center gap-3 text-sm text-white/60"><Check className="h-4 w-4 text-blue-500" />{f}</li>
                ))}
              </ul>
              <Button onClick={() => setLocation("/pricing")} className="w-full bg-white/5 hover:bg-white/10 text-white border border-white/10">Get Started</Button>
            </div>
            {/* Enterprise */}
            <div className="p-8 rounded-3xl border-2 border-blue-500/30 bg-blue-500/[0.05] relative">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-blue-600 rounded-full text-[10px] font-black uppercase tracking-widest">Most Popular</div>
              <div className="text-sm font-bold text-blue-400 uppercase tracking-widest mb-2">Enterprise</div>
              <div className="text-4xl font-black mb-6">$499<span className="text-lg font-normal text-white/30">/mo</span></div>
              <ul className="space-y-4 mb-8">
                {["250,000 Credits/mo", "Full DevSecOps Suite", "Advanced Vault Orchestration", "Team Management"].map(f => (
                  <li key={f} className="flex items-center gap-3 text-sm text-white/80"><Check className="h-4 w-4 text-blue-500" />{f}</li>
                ))}
              </ul>
              <Button onClick={() => setLocation("/pricing")} className="w-full bg-blue-600 hover:bg-blue-500 text-white border-0">Go Enterprise</Button>
            </div>
            {/* Titan */}
            <div className="p-8 rounded-3xl border border-white/[0.06] bg-white/[0.02]">
              <div className="text-sm font-bold text-white/40 uppercase tracking-widest mb-2">Titan</div>
              <div className="text-4xl font-black mb-6">Custom</div>
              <ul className="space-y-4 mb-8">
                {["Unlimited Credits", "On-Premise Deployment", "Custom Integrations", "24/7 Priority Support"].map(f => (
                  <li key={f} className="flex items-center gap-3 text-sm text-white/60"><Check className="h-4 w-4 text-blue-500" />{f}</li>
                ))}
              </ul>
              <Button onClick={() => setLocation("/contact")} className="w-full bg-white/5 hover:bg-white/10 text-white border border-white/10">Contact Sales</Button>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="relative py-24 sm:py-32 border-t border-white/5">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-black tracking-tight text-center mb-12">Frequently Asked Questions</h2>
          <div className="divide-y divide-white/5">
            <FAQItem question="Is Archibald Titan really local-first?" answer="Yes. All AI processing, credential management, and tool execution happen within your local environment or private infrastructure. We never see your prompts or your data." />
            <FAQItem question="What is the Titan Builder Console?" answer="It's our unified interface for orchestrating AI agents and security tools. Think of it as a modern, AI-powered terminal for your entire DevSecOps stack." />
            <FAQItem question="Can I integrate my own tools?" answer="Absolutely. Titan is designed to be extensible. You can connect your own scripts, APIs, and security tools directly into the Builder environment." />
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
