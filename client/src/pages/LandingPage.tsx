import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { getRegisterUrl } from "@/const";
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import MarketingLayout from "@/components/MarketingLayout";
import {
  Shield, ChevronDown, ArrowRight, Check,
  ShieldCheck, Server, Cpu, Activity,
  Database, Workflow, Globe2, Boxes,
  Vault, Terminal, ChevronUp, Lock,
  Zap, BarChart3, Users, LayoutDashboard
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
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-blue-600/5 rounded-full blur-[120px]" />
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/5 to-transparent" />
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/5 border border-blue-500/10 mb-8">
            <span className="text-[10px] sm:text-xs font-black tracking-widest uppercase text-blue-400/80">Enterprise AI Orchestration</span>
          </div>
          <h1 className="text-5xl sm:text-7xl lg:text-8xl font-black tracking-tighter leading-[0.9] mb-8 text-white">
            The Unified <br />
            <span className="text-white/40">AI Command Center.</span>
          </h1>
          <p className="max-w-2xl mx-auto text-lg sm:text-xl text-white/40 leading-relaxed mb-10">
            Archibald Titan is the professional orchestration platform for secure AI operations. Automate complex DevSecOps workflows, manage encrypted credentials, and deploy local-first intelligence with executive-grade control.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button onClick={() => { window.location.href = getRegisterUrl(); }} size="lg" className="w-full sm:w-auto bg-blue-600 hover:bg-blue-500 text-white border-0 shadow-xl shadow-blue-600/20 h-14 px-10 text-base font-bold group">
              Get Started <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </Button>
            <Button onClick={() => { document.getElementById("pillars")?.scrollIntoView({ behavior: "smooth" }); }} size="lg" variant="outline" className="w-full sm:w-auto border-white/10 bg-white/5 hover:bg-white/10 text-white h-14 px-10 text-base font-bold">
              Explore Platform
            </Button>
          </div>
          
          <div className="mt-20 grid grid-cols-2 md:grid-cols-4 gap-8 max-w-4xl mx-auto opacity-40 grayscale">
            <div className="flex flex-col items-center gap-1">
              <span className="text-xl font-black text-white">SOC2</span>
              <span className="text-[9px] uppercase tracking-widest font-bold">Compliance Ready</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <span className="text-xl font-black text-white">AES-256</span>
              <span className="text-[9px] uppercase tracking-widest font-bold">GCM Encryption</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <span className="text-xl font-black text-white">ISO 27001</span>
              <span className="text-[9px] uppercase tracking-widest font-bold">Security Standard</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <span className="text-xl font-black text-white">100%</span>
              <span className="text-[9px] uppercase tracking-widest font-bold">Local Execution</span>
            </div>
          </div>
        </div>
      </section>

      {/* 3 PLATFORM PILLARS */}
      <section id="pillars" className="relative py-24 sm:py-32 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-20">
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight mb-4 text-white">Built for Serious Operations.</h2>
            <p className="text-white/40 max-w-2xl mx-auto">Three core pillars designed to provide total control over your AI and security infrastructure.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="group p-8 rounded-3xl border border-white/[0.05] bg-white/[0.01] hover:bg-white/[0.03] transition-all duration-500">
              <div className="h-12 w-12 rounded-2xl bg-blue-600/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500">
                <Terminal className="h-6 w-6 text-blue-500" />
              </div>
              <h3 className="text-xl font-bold mb-3 text-white/90">1. AI Builder & Automation</h3>
              <p className="text-white/40 text-sm leading-relaxed">Orchestrate complex AI agents and automate engineering workflows through a unified command console. Deploy local-first intelligence without compromising data sovereignty.</p>
            </div>
            <div className="group p-8 rounded-3xl border border-white/[0.05] bg-white/[0.01] hover:bg-white/[0.03] transition-all duration-500">
              <div className="h-12 w-12 rounded-2xl bg-blue-600/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500">
                <ShieldCheck className="h-6 w-6 text-blue-500" />
              </div>
              <h3 className="text-xl font-bold mb-3 text-white/90">2. Security & Red Team Ops</h3>
              <p className="text-white/40 text-sm leading-relaxed">Professional-grade vulnerability scanning, OSINT, and red team playbooks. Monitor your attack surface and credential health in real-time with executive-level reporting.</p>
            </div>
            <div className="group p-8 rounded-3xl border border-white/[0.05] bg-white/[0.01] hover:bg-white/[0.03] transition-all duration-500">
              <div className="h-12 w-12 rounded-2xl bg-blue-600/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500">
                <Lock className="h-6 w-6 text-blue-500" />
              </div>
              <h3 className="text-xl font-bold mb-3 text-white/90">3. Enterprise Control & Vault</h3>
              <p className="text-white/40 text-sm leading-relaxed">Centralized credential orchestration with AES-256-GCM encryption. Manage team access, audit logs, and compliance across your entire AI toolchain from a single vault.</p>
            </div>
          </div>
        </div>
      </section>

      {/* CORE WORKFLOWS */}
      <section className="relative py-24 sm:py-32 border-t border-white/5 bg-white/[0.01]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-3xl sm:text-4xl font-black tracking-tight mb-6 text-white">Operational Excellence <br />by Design.</h2>
              <p className="text-white/40 text-lg leading-relaxed mb-8">
                Archibald Titan provides the infrastructure layer that connects your AI agents to your enterprise environment securely and reliably.
              </p>
              <div className="space-y-4">
                {[
                  { icon: Activity, title: "Real-time Monitoring", desc: "Live tracking of credential health and provider status." },
                  { icon: Database, title: "Secure Storage", desc: "Encrypted local storage for sensitive project data." },
                  { icon: Workflow, title: "Automated Sync", desc: "Keep your credentials and tools in sync across the team." }
                ].map((item, i) => (
                  <div key={i} className="flex gap-4 p-4 rounded-2xl border border-white/[0.05] bg-white/[0.02]">
                    <div className="h-10 w-10 rounded-xl bg-blue-600/10 flex items-center justify-center shrink-0">
                      <item.icon className="h-5 w-5 text-blue-500" />
                    </div>
                    <div>
                      <h4 className="font-bold text-white/80">{item.title}</h4>
                      <p className="text-sm text-white/40">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="relative p-8 rounded-3xl border border-white/[0.05] bg-[#03060e] shadow-2xl">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="h-3 w-3 rounded-full bg-red-500/20 border border-red-500/40" />
                  <div className="h-3 w-3 rounded-full bg-amber-500/20 border border-amber-500/40" />
                  <div className="h-3 w-3 rounded-full bg-emerald-500/20 border border-emerald-500/40" />
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest text-white/20">Titan Orchestrator v4.1</span>
              </div>
              <div className="space-y-3">
                {[
                  { label: "Astra Security Scan", status: "Completed", color: "text-emerald-400" },
                  { label: "Vault Rotation", status: "Active", color: "text-blue-400" },
                  { label: "Agent Deployment", status: "Pending", color: "text-white/20" },
                  { label: "Compliance Report", status: "Scheduled", color: "text-white/20" }
                ].map((row, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/[0.05]">
                    <span className="text-xs font-bold text-white/60">{row.label}</span>
                    <span className={`text-[10px] font-black uppercase tracking-widest ${row.color}`}>{row.status}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PRICING PREVIEW */}
      <section id="pricing" className="relative py-24 sm:py-32 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight mb-4 text-white">Enterprise Packaging.</h2>
            <p className="text-white/40 max-w-2xl mx-auto">Scalable plans designed for professional engineering and security teams.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {/* Pro */}
            <div className="p-8 rounded-3xl border border-white/[0.05] bg-white/[0.01]">
              <div className="text-[10px] font-black text-white/30 uppercase tracking-widest mb-2">Pro</div>
              <div className="text-4xl font-black mb-6 text-white">$49<span className="text-lg font-normal text-white/20">/mo</span></div>
              <ul className="space-y-4 mb-8">
                {["15,000 Credits/mo", "Titan Builder Access", "Standard Security Suite", "3 Vault Connections"].map(f => (
                  <li key={f} className="flex items-center gap-3 text-sm text-white/50"><Check className="h-4 w-4 text-blue-500" />{f}</li>
                ))}
              </ul>
              <Button onClick={() => setLocation("/pricing")} className="w-full bg-white/5 hover:bg-white/10 text-white border border-white/10 font-bold">Get Started</Button>
            </div>
            {/* Enterprise */}
            <div className="p-8 rounded-3xl border border-blue-600/20 bg-blue-600/[0.02] relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-blue-600 rounded-full text-[9px] font-black uppercase tracking-widest text-white">Recommended</div>
              <div className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-2">Enterprise</div>
              <div className="text-4xl font-black mb-6 text-white">$499<span className="text-lg font-normal text-white/20">/mo</span></div>
              <ul className="space-y-4 mb-8">
                {["250,000 Credits/mo", "Full DevSecOps Suite", "Advanced Vault Orchestration", "Team Management"].map(f => (
                  <li key={f} className="flex items-center gap-3 text-sm text-white/50"><Check className="h-4 w-4 text-blue-500" />{f}</li>
                ))}
              </ul>
              <Button onClick={() => setLocation("/pricing")} className="w-full bg-blue-600 hover:bg-blue-500 text-white border-0 font-bold shadow-lg shadow-blue-600/20">Select Enterprise</Button>
            </div>
            {/* Titan */}
            <div className="p-8 rounded-3xl border border-white/[0.05] bg-white/[0.01]">
              <div className="text-[10px] font-black text-white/30 uppercase tracking-widest mb-2">Titan</div>
              <div className="text-4xl font-black mb-6 text-white">Custom</div>
              <ul className="space-y-4 mb-8">
                {["Unlimited Credits", "Custom Integrations", "Dedicated Support", "On-premise Deployment"].map(f => (
                  <li key={f} className="flex items-center gap-3 text-sm text-white/50"><Check className="h-4 w-4 text-blue-500" />{f}</li>
                ))}
              </ul>
              <Button onClick={() => setLocation("/contact")} className="w-full bg-white/5 hover:bg-white/10 text-white border border-white/10 font-bold">Contact Sales</Button>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="relative py-24 sm:py-32 border-t border-white/5">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-black tracking-tight mb-12 text-center text-white">Frequently Asked Questions</h2>
          <div className="divide-y divide-white/5">
            <FAQItem 
              question="Is my data secure with Archibald Titan?" 
              answer="Yes. Archibald Titan uses a local-first execution model, meaning your prompts and sensitive data never leave your infrastructure. All credentials are encrypted using AES-256-GCM." 
            />
            <FAQItem 
              question="Can I integrate with my existing SIEM?" 
              answer="Absolutely. Archibald Titan is designed for enterprise environments and supports integration with major SIEM and logging platforms for full auditability." 
            />
            <FAQItem 
              question="What are credits used for?" 
              answer="Credits power the AI orchestration and security scanning engines. Different tasks consume different amounts of credits based on complexity and resource usage." 
            />
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="relative py-24 sm:py-32 border-t border-white/5 overflow-hidden">
        <div className="absolute inset-0 bg-blue-600/[0.02] pointer-events-none" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl sm:text-6xl font-black tracking-tighter mb-8 text-white">Ready to Orchestrate?</h2>
          <p className="max-w-xl mx-auto text-white/40 mb-10">Join the next generation of security-first engineering teams.</p>
          <Button onClick={() => { window.location.href = getRegisterUrl(); }} size="lg" className="bg-blue-600 hover:bg-blue-500 text-white border-0 shadow-xl shadow-blue-600/20 h-14 px-10 text-base font-bold">
            Get Started Now
          </Button>
        </div>
      </section>
    </MarketingLayout>
  );
}
