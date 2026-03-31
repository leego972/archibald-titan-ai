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
  Zap, BarChart3, Users, LayoutDashboard,
  Search, Fingerprint, Network, Monitor,
  FileText, ShieldAlert, History
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
      {/* HERO: THE TITAN BUILDER FOCUS */}
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
            The Operating System <br />
            <span className="text-white/40">for AI Operations.</span>
          </h1>
          <p className="max-w-2xl mx-auto text-lg sm:text-xl text-white/40 leading-relaxed mb-10">
            Archibald Titan is the professional orchestration platform for secure AI operations. Automate complex DevSecOps workflows, manage encrypted credentials, and deploy local-first intelligence with executive-grade control.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button onClick={() => { window.location.href = getRegisterUrl(); }} size="lg" className="w-full sm:w-auto bg-blue-600 hover:bg-blue-500 text-white border-0 shadow-xl shadow-blue-600/20 h-14 px-10 text-base font-bold group">
              Launch Titan Builder <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </Button>
            <Button onClick={() => { document.getElementById("pillars")?.scrollIntoView({ behavior: "smooth" }); }} size="lg" variant="outline" className="w-full sm:w-auto border-white/10 bg-white/5 hover:bg-white/10 text-white h-14 px-10 text-base font-bold">
              Explore Platform
            </Button>
          </div>
          
          {/* TRUST SIGNALS - GROUNDED PROOF */}
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
              <span className="text-[9px] uppercase tracking-widest font-bold">Aligned Design</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <span className="text-xl font-black text-white">100%</span>
              <span className="text-[9px] uppercase tracking-widest font-bold">Local Execution</span>
            </div>
          </div>
        </div>
      </section>

      {/* 3 CORE PILLARS - SHARP OPERATING LOOP */}
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

      {/* ENTERPRISE TRUST SURFACES - AUTHORITATIVE PROOF */}
      <section className="relative py-24 sm:py-32 border-t border-white/5 bg-white/[0.01]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight mb-6 text-white">Control, Auditability, <br />and Deployment Flexibility.</h2>
          <p className="text-white/40 text-lg leading-relaxed mb-8">
            Archibald Titan is built for teams that cannot afford ambiguity. Every credential access is logged, every workflow is versioned, and every deployment option preserves your data sovereignty.
          </p>
              <div className="space-y-4">
                {[
                  { icon: ShieldAlert, title: "Full Auditability", desc: "Comprehensive audit logs for every credential access and AI operation, ensuring complete traceability." },
                  { icon: History, title: "Versioned Workflows", desc: "Roll back and audit automation changes with complete history, maintaining operational integrity." },
                  { icon: Network, title: "Deployment Flexibility", desc: "Deploy on-premise, in your private cloud, or via our secure managed cloud with zero data leakage." },
                  { icon: Fingerprint, title: "RBAC & Team Control", desc: "Granular role-based access control for teams and organizations, enforcing the principle of least privilege." }
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
                <span className="text-[10px] font-black uppercase tracking-widest text-white/20">Titan Compliance Monitor</span>
              </div>
              <div className="space-y-3">
                {[
                  { label: "Credential Integrity", status: "Verified", color: "text-emerald-400" },
                  { label: "Audit Log Sync", status: "Active", color: "text-blue-400" },
                  { label: "Encryption Status", status: "AES-256-GCM", color: "text-emerald-400" },
                  { label: "Access Control", status: "Enforced", color: "text-blue-400" },
                  { label: "SOC2 Compliance", status: "Ready", color: "text-emerald-400" }
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

      {/* FAQ - GROUNDED ANSWERS */}
      <section className="relative py-24 sm:py-32 border-t border-white/5">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight mb-4 text-white">Frequently Asked Questions.</h2>
            <p className="text-white/40">Common questions about the Titan platform and enterprise deployment.</p>
          </div>
          <div className="divide-y divide-white/5">
            <FAQItem 
              question="How does Archibald Titan handle data sovereignty?" 
              answer="Titan is built with a local-first architecture. All AI operations, credential management, and sensitive data processing occur within your defined environment. We do not store your credentials or project data on our servers unless you explicitly opt for our managed cloud sync."
            />
            <FAQItem 
              question="Can we deploy Titan on-premise?" 
              answer="Yes. Archibald Titan Enterprise supports full on-premise deployment via Docker or Kubernetes, allowing you to run the entire orchestration layer within your own air-gapped or private network."
            />
            <FAQItem 
              question="What encryption standards are used for the Vault?" 
              answer="All credentials and sensitive project data are encrypted at rest using AES-256-GCM. Keys are managed via your own KMS or our secure hardware security modules (HSM)."
            />
            <FAQItem 
              question="Is the platform SOC2 compliant?" 
              answer="Archibald Titan is designed to meet SOC2 Type II and ISO 27001 standards. We provide the necessary audit logs and security controls required for your own compliance certifications."
            />
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="relative py-24 sm:py-32 border-t border-white/5 overflow-hidden">
        <div className="absolute inset-0 bg-blue-600/[0.02] pointer-events-none" />
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl sm:text-6xl font-black tracking-tighter mb-8 text-white">Take Control of Your AI Operations.</h2>
          <p className="text-lg text-white/40 mb-10">Trusted by engineering and security teams who require auditability, control, and local-first execution.</p>
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
