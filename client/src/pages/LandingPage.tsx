import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { getRegisterUrl } from "@/const";
import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import MarketingLayout from "@/components/MarketingLayout";
import {
    Shield, ChevronDown, ArrowRight, Check,
    ShieldCheck, Server, Cpu, Activity,
    Database, Workflow, Globe2,
    Vault, Terminal, ChevronUp, Lock,
    Zap, BarChart3, Users, LayoutDashboard,
    Search, Fingerprint, Network, Monitor,
    FileText, ShieldAlert, History, Eye,
    Crosshair, Radio, Layers, Code2, Key,
    BrainCircuit, Satellite, ScanLine, Bug,
    Settings2, GitBranch, Braces, Wifi,
    AlertTriangle, CheckCircle2, TrendingUp,
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

  const CYBER_TOOLS = [
    { icon: ScanLine,  name: "Argus",          desc: "OSINT & attack surface mapping",                    color: "text-blue-400",   bg: "bg-blue-500/10",   border: "border-blue-500/15" },
    { icon: Crosshair, name: "Astra",          desc: "Vulnerability scanner & exploit tester",             color: "text-red-400",    bg: "bg-red-500/10",    border: "border-red-500/15" },
    { icon: Radio,     name: "CyberMCP",       desc: "Multi-channel command & control proxy",              color: "text-purple-400", bg: "bg-purple-500/10", border: "border-purple-500/15" },
    { icon: Bug,       name: "Metasploit",     desc: "Exploitation framework — managed & sandboxed",       color: "text-orange-400", bg: "bg-orange-500/10", border: "border-orange-500/15" },
    { icon: Eye,       name: "EvilGinx",       desc: "Reverse proxy phishing simulation & defence testing",color: "text-amber-400",  bg: "bg-amber-500/10",  border: "border-amber-500/15" },
    { icon: Satellite, name: "BlackEye",       desc: "Advanced phishing campaign framework",               color: "text-cyan-400",   bg: "bg-cyan-500/10",   border: "border-cyan-500/15" },
    { icon: Network,   name: "VPN Chain",      desc: "Multi-hop VPN routing with TOR integration",         color: "text-green-400",  bg: "bg-green-500/10",  border: "border-green-500/15" },
    { icon: Key,       name: "Fetcher",        desc: "Encrypted credential orchestration engine",           color: "text-violet-400", bg: "bg-violet-500/10", border: "border-violet-500/15" },
    { icon: Layers,    name: "Sandbox",        desc: "Isolated execution & payload staging environment",    color: "text-pink-400",   bg: "bg-pink-500/10",   border: "border-pink-500/15" },
  ];

  const PLATFORM_STATS = [
    { value: "26",   label: "Security Tools",      icon: ShieldAlert },
    { value: "176+", label: "Platform Modules",    icon: Layers },
    { value: "50+",  label: "Automation Workflows",icon: Workflow },
    { value: "100%", label: "Data Sovereign",      icon: Lock },
  ];

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
            <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-blue-600/6 rounded-full blur-[130px]" />
            <div className="absolute top-1/3 left-1/4 w-[400px] h-[300px] bg-violet-600/4 rounded-full blur-[100px]" />
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/5 to-transparent" />
            <div className="absolute inset-0 opacity-[0.012]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.8) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.8) 1px,transparent 1px)', backgroundSize: '60px 60px' }} />
          </div>

          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/8 border border-blue-500/15 mb-8">
              <BrainCircuit className="h-3 w-3 text-blue-400" />
              <span className="text-[10px] sm:text-xs font-black tracking-widest uppercase text-blue-400/90">AI-Native Cyber Operations Platform</span>
            </div>

            <h1 className="text-5xl sm:text-7xl lg:text-[5.5rem] font-black tracking-tighter leading-[0.88] mb-8 text-white">
              Archibald Titan.<br />
              <span className="text-white/35">The Platform Cyber</span><br />
              <span className="text-white/35">Teams Actually Use.</span>
            </h1>

            <p className="max-w-2xl mx-auto text-base sm:text-xl text-white/45 leading-relaxed mb-10">
              A unified AI orchestration and offensive security platform. Titan automates your DevSecOps
              workflows, manages encrypted credentials, runs security simulations, and orchestrates
              attacks — all from a single command centre.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button
                onClick={() => { window.location.href = getRegisterUrl(); }}
                size="lg"
                className="w-full sm:w-auto bg-blue-600 hover:bg-blue-500 text-white border-0 shadow-xl shadow-blue-600/20 h-14 px-10 text-base font-bold group"
              >
                Start for Free <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </Button>
              <Button
                onClick={() => document.getElementById("tools")?.scrollIntoView({ behavior: "smooth" })}
                size="lg"
                variant="outline"
                className="w-full sm:w-auto border-white/10 bg-white/5 hover:bg-white/10 text-white h-14 px-10 text-base font-bold"
              >
                Explore Security Tools
              </Button>
            </div>

            <div className="mt-20 grid grid-cols-2 md:grid-cols-4 gap-6 max-w-3xl mx-auto">
              {PLATFORM_STATS.map((stat) => {
                const Icon = stat.icon;
                return (
                  <div key={stat.label} className="flex flex-col items-center gap-2 p-4 rounded-2xl border border-white/5 bg-white/[0.02]">
                    <Icon className="h-4 w-4 text-blue-400/60 mb-1" />
                    <span className="text-2xl font-black text-white">{stat.value}</span>
                    <span className="text-[10px] uppercase tracking-widest font-bold text-white/30">{stat.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* CORE PILLARS */}
        <section id="pillars" className="relative py-24 sm:py-32 border-t border-white/5">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-20">
              <h2 className="text-3xl sm:text-4xl font-black tracking-tight mb-4 text-white">Three Engines. One Platform.</h2>
              <p className="text-white/40 max-w-2xl mx-auto">Titan unifies AI automation, offensive security, and encrypted credential management under a single command surface. No context switching. No tool sprawl.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { icon: BrainCircuit, color: "text-blue-400",   bg: "bg-blue-600/10",   border: "border-blue-500/20",   num: "01", title: "Titan AI Builder",          desc: "An autonomous AI agent that writes code, debugs, orchestrates complex workflows, and runs your engineering operations. Local-first, data-sovereign, and extensible.", tags: ["Code Generation", "Auto-Debug", "Workflow Orchestration", "Local LLM"] },
                { icon: ShieldAlert,  color: "text-red-400",    bg: "bg-red-600/10",    border: "border-red-500/20",    num: "02", title: "Offensive Security Suite",  desc: "26 integrated security tools — from OSINT and scanning to exploitation and phishing simulation. Professional red team operations in a managed, auditable environment.", tags: ["Red Team Ops", "Vulnerability Scanning", "OSINT", "Exploit Staging"] },
                { icon: Vault,        color: "text-violet-400", bg: "bg-violet-600/10", border: "border-violet-500/20", num: "03", title: "Vault & Credential Ops",    desc: "AES-256-GCM encrypted credential orchestration with team vaults, TOTP management, audit logs, and provider health monitoring across 15+ credential providers.", tags: ["AES-256-GCM", "Team Vault", "TOTP", "Audit Logs"] },
              ].map((pillar) => {
                const Icon = pillar.icon;
                return (
                  <div key={pillar.num} className={`group p-8 rounded-3xl border ${pillar.border} bg-white/[0.01] hover:bg-white/[0.025] transition-all duration-500`}>
                    <div className="flex items-center gap-3 mb-6">
                      <div className={`h-11 w-11 rounded-2xl ${pillar.bg} flex items-center justify-center`}>
                        <Icon className={`h-5 w-5 ${pillar.color}`} />
                      </div>
                      <span className="text-xs font-black text-white/20 tracking-widest">{pillar.num}</span>
                    </div>
                    <h3 className="text-xl font-bold mb-3 text-white/90">{pillar.title}</h3>
                    <p className="text-white/40 text-sm leading-relaxed mb-5">{pillar.desc}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {pillar.tags.map(tag => (
                        <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 border border-white/8 text-white/40 font-semibold">{tag}</span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* CYBER TOOLS SHOWCASE */}
        <section id="tools" className="relative py-24 sm:py-32 border-t border-white/5 bg-white/[0.01]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-500/8 border border-red-500/15 mb-6">
                <ShieldAlert className="h-3 w-3 text-red-400" />
                <span className="text-[10px] font-black tracking-widest uppercase text-red-400/90">Offensive Security Toolkit</span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-black tracking-tight mb-4 text-white">
                Every Tool a Red Team Needs.<br />
                <span className="text-white/35">One Platform They Can Trust.</span>
              </h2>
              <p className="text-white/40 max-w-xl mx-auto">Integrated, managed, and sandboxed. Each engine runs in an auditable environment with full logging — so your team operates at speed without losing control.</p>
            </div>

            <div className="max-w-3xl mx-auto mb-14 rounded-2xl border border-white/8 bg-[#040810] shadow-2xl overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5">
                <div className="h-3 w-3 rounded-full bg-red-500/30 border border-red-500/50" />
                <div className="h-3 w-3 rounded-full bg-amber-500/30 border border-amber-500/50" />
                <div className="h-3 w-3 rounded-full bg-emerald-500/30 border border-emerald-500/50" />
                <span className="ml-3 text-[10px] font-black uppercase tracking-widest text-white/20">Titan Command Centre</span>
              </div>
              <div className="p-5 font-mono text-xs space-y-1.5">
                <div><span className="text-blue-400">titan</span> <span className="text-white/60">argus --target example.com --deep-scan</span></div>
                <div className="text-white/30">{"→"} Mapping attack surface... 247 subdomains discovered</div>
                <div><span className="text-red-400">titan</span> <span className="text-white/60">astra --target api.example.com --exploit auto</span></div>
                <div className="text-white/30">{"→"} CVE-2024-3094 confirmed — staging payload...</div>
                <div><span className="text-purple-400">titan</span> <span className="text-white/60">cybermcp --chain tor,vpn --rotate 60s</span></div>
                <div className="text-white/30">{"→"} Identity masked. 5-hop chain active.</div>
                <div><span className="text-emerald-400">titan</span> <span className="text-white/60">report --format soc2 --send compliance@example.com</span></div>
                <div className="text-white/30">{"→"} SOC2 compliance report generated and dispatched.</div>
                <div className="flex items-center gap-1 text-white/60 mt-1"><span className="animate-pulse">{"▋"}</span></div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {CYBER_TOOLS.map((tool) => {
                const Icon = tool.icon;
                return (
                  <div key={tool.name} className={`flex items-start gap-4 p-5 rounded-2xl border ${tool.border} ${tool.bg} hover:border-white/15 transition-all`}>
                    <div className="h-9 w-9 rounded-xl bg-black/30 flex items-center justify-center shrink-0">
                      <Icon className={`h-4 w-4 ${tool.color}`} />
                    </div>
                    <div>
                      <h4 className="font-bold text-white/85 text-sm">{tool.name}</h4>
                      <p className="text-xs text-white/40 leading-relaxed mt-0.5">{tool.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ENTERPRISE TRUST */}
        <section className="relative py-24 sm:py-32 border-t border-white/5">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
              <div>
                <h2 className="text-3xl sm:text-4xl font-black tracking-tight mb-6 text-white">Control, Auditability,<br />and Deployment Flexibility.</h2>
                <p className="text-white/40 text-base leading-relaxed mb-8">Built for teams that cannot afford ambiguity. Every credential access is logged, every workflow is versioned, and every deployment option preserves your data sovereignty.</p>
                <div className="space-y-3">
                  {[
                    { icon: ShieldAlert,  title: "Full Auditability",       desc: "Every credential access and AI operation is logged with immutable audit trails." },
                    { icon: History,      title: "Versioned Workflows",     desc: "Roll back automation changes with complete history — no silent mutations." },
                    { icon: Network,      title: "Deployment Flexibility",  desc: "On-premise, private cloud, or managed. Zero forced data egress." },
                    { icon: Fingerprint,  title: "RBAC & Team Controls",    desc: "Granular role-based access enforcing the principle of least privilege." },
                    { icon: CheckCircle2, title: "Compliance Ready",        desc: "SOC2 Type II and ISO 27001 aligned controls with exportable evidence packs." },
                  ].map((item) => (
                    <div key={item.title} className="flex gap-4 p-4 rounded-2xl border border-white/[0.05] bg-white/[0.02] hover:border-white/10 transition-colors">
                      <div className="h-10 w-10 rounded-xl bg-blue-600/10 flex items-center justify-center shrink-0">
                        <item.icon className="h-5 w-5 text-blue-400" />
                      </div>
                      <div>
                        <h4 className="font-bold text-white/80 text-sm">{item.title}</h4>
                        <p className="text-xs text-white/40 mt-0.5">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="relative p-7 rounded-3xl border border-white/8 bg-[#03060e] shadow-2xl">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-red-500/25 border border-red-500/40" />
                    <div className="h-3 w-3 rounded-full bg-amber-500/25 border border-amber-500/40" />
                    <div className="h-3 w-3 rounded-full bg-emerald-500/25 border border-emerald-500/40" />
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-white/20">Compliance Monitor</span>
                </div>
                <div className="space-y-2.5">
                  {[
                    { label: "Credential Integrity", status: "Verified",    color: "text-emerald-400", dot: "bg-emerald-400" },
                    { label: "Audit Log Sync",        status: "Live",        color: "text-blue-400",    dot: "bg-blue-400" },
                    { label: "Encryption Status",     status: "AES-256-GCM", color: "text-emerald-400", dot: "bg-emerald-400" },
                    { label: "Access Control",        status: "Enforced",    color: "text-blue-400",    dot: "bg-blue-400" },
                    { label: "SOC2 Controls",         status: "Ready",       color: "text-emerald-400", dot: "bg-emerald-400" },
                    { label: "Red Team Session",      status: "Sandboxed",   color: "text-amber-400",   dot: "bg-amber-400" },
                    { label: "Titan AI Engine",       status: "Operational", color: "text-blue-400",    dot: "bg-blue-400" },
                  ].map((row) => (
                    <div key={row.label} className="flex items-center justify-between p-3 rounded-xl bg-white/[0.025] border border-white/[0.05]">
                      <div className="flex items-center gap-2">
                        <div className={`h-1.5 w-1.5 rounded-full ${row.dot} animate-pulse`} />
                        <span className="text-xs font-semibold text-white/55">{row.label}</span>
                      </div>
                      <span className={`text-[10px] font-black uppercase tracking-widest ${row.color}`}>{row.status}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between">
                  <span className="text-[10px] text-white/20">Last sweep: 2 minutes ago</span>
                  <span className="text-[10px] text-emerald-400 font-bold">● All systems nominal</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* TIER COMPARISON */}
        <section className="relative py-24 sm:py-32 border-t border-white/5 bg-white/[0.01]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight mb-4 text-white">One Platform. Four Tiers.</h2>
            <p className="text-white/40 max-w-xl mx-auto mb-14">From solo security researchers to full enterprise red teams — pick the tier that fits your operation.</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
              {[
                { name: "Free",       price: "$0",   color: "text-white/60",   border: "border-white/8",       items: ["500 credits/mo", "3 providers", "JSON export", "Community support"] },
                { name: "Pro",        price: "$29",  color: "text-blue-300",   border: "border-blue-500/25",   items: ["50k credits/mo", "All providers", "Sandbox + Builder", "Priority support"] },
                { name: "Enterprise", price: "$99",  color: "text-violet-300", border: "border-violet-500/25", items: ["250k credits/mo", "Team Vault", "SSO + Audit Logs", "10k API req/day"] },
                { name: "Cyber",      price: "$199", color: "text-red-300",    border: "border-red-500/25",    items: ["750k credits/mo", "All 26 cyber tools", "Argus, Astra, Metasploit + 23 more", "12h security SLA"] },
              ].map((tier) => (
                <div key={tier.name} className={`p-5 rounded-2xl border ${tier.border} bg-white/[0.02] text-left`}>
                  <p className="text-xs font-black text-white/40 uppercase tracking-widest mb-1">{tier.name}</p>
                  <p className={`text-2xl font-black ${tier.color} mb-4`}>{tier.price}<span className="text-sm font-normal text-white/30">/mo</span></p>
                  <ul className="space-y-1.5">
                    {tier.items.map(item => (
                      <li key={item} className="flex items-start gap-1.5 text-xs text-white/50">
                        <Check className="h-3 w-3 text-white/25 shrink-0 mt-0.5" /> {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <div className="mt-8">
              <Button onClick={() => { window.location.href = "/pricing"; }} variant="outline" className="border-white/10 text-white/60 hover:bg-white/5 hover:text-white">
                View Full Pricing <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="relative py-24 sm:py-32 border-t border-white/5">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl sm:text-4xl font-black tracking-tight mb-4 text-white">Frequently Asked Questions.</h2>
              <p className="text-white/40">Common questions about the Titan platform and security operations.</p>
            </div>
            <div className="divide-y divide-white/5">
              <FAQItem question="What is Archibald Titan?" answer="Archibald Titan is an AI-native platform that combines autonomous AI orchestration with professional offensive security tooling. It gives security teams and researchers a unified, auditable environment for running AI workflows, managing credentials, and conducting red team operations." />
              <FAQItem question="What does Titan AI actually do?" answer="Titan is an autonomous AI agent that can write and debug code, orchestrate complex multi-step workflows, run security scans, and answer technical questions. It integrates directly with the platform's security engines so you can trigger Argus scans, Astra exploits, or VPN chain rotations from a natural language prompt." />
              <FAQItem question="Are the offensive security tools safe to run?" answer="Yes. Every security engine runs in a sandboxed, auditable environment. All operations are logged with full attribution, and red team tools require appropriate plan-level permissions. The platform is designed for authorised security professionals — not for unauthorised access to systems you don't own." />
              <FAQItem question="How does Archibald Titan handle data sovereignty?" answer="Titan is built with a local-first architecture. All AI operations, credential management, and sensitive data processing occur within your defined environment. We do not store your credentials or project data on our servers unless you explicitly opt for managed cloud sync." />
              <FAQItem question="Can we deploy Titan on-premise?" answer="Yes. Archibald Titan Enterprise supports full on-premise deployment via Docker or Kubernetes, allowing you to run the entire orchestration layer within your own air-gapped or private network." />
              <FAQItem question="What encryption standards are used for the Vault?" answer="All credentials and sensitive project data are encrypted at rest using AES-256-GCM. Keys are managed via your own KMS or our secure hardware security modules (HSM). In-transit data uses TLS 1.3 exclusively." />
            </div>
          </div>
        </section>

        {/* COMPARE */}
          <section className="relative py-16 border-t border-white/5">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/25 mb-6">See how Titan stacks up against the alternatives</p>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <Link href="/vs-copilot" className="inline-flex items-center gap-2 text-xs text-white/50 hover:text-white/90 border border-white/8 hover:border-white/20 rounded-full px-5 py-2.5 bg-white/[0.02] hover:bg-white/[0.05] transition-all">
                  Titan vs GitHub Copilot <ArrowRight className="h-3 w-3" />
                </Link>
                <Link href="/vs-cloud-ai" className="inline-flex items-center gap-2 text-xs text-white/50 hover:text-white/90 border border-white/8 hover:border-white/20 rounded-full px-5 py-2.5 bg-white/[0.02] hover:bg-white/[0.05] transition-all">
                  Titan vs Cloud AI Agents <ArrowRight className="h-3 w-3" />
                </Link>
                <Link href="/vs-no-code" className="inline-flex items-center gap-2 text-xs text-white/50 hover:text-white/90 border border-white/8 hover:border-white/20 rounded-full px-5 py-2.5 bg-white/[0.02] hover:bg-white/[0.05] transition-all">
                  Titan vs No-Code Builders <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </div>
          </section>

          {/* FINAL CTA */}
        <section className="relative py-24 sm:py-32 border-t border-white/5 overflow-hidden">
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-blue-600/6 rounded-full blur-[100px]" />
          </div>
          <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-4xl sm:text-6xl font-black tracking-tight mb-6 text-white leading-[0.9]">
              Start Your Operation.<br />
              <span className="text-white/30">Free, today.</span>
            </h2>
            <p className="text-white/40 text-lg max-w-lg mx-auto mb-10">Join security researchers, DevSecOps teams, and AI engineers using Archibald Titan to automate what used to take a full team.</p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button
                onClick={() => { window.location.href = getRegisterUrl(); }}
                size="lg"
                className="w-full sm:w-auto bg-blue-600 hover:bg-blue-500 text-white border-0 shadow-xl shadow-blue-600/20 h-14 px-10 text-base font-bold group"
              >
                Create Free Account <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </Button>
              <Button
                onClick={() => { window.location.href = "/pricing"; }}
                size="lg"
                variant="outline"
                className="w-full sm:w-auto border-white/10 bg-white/5 hover:bg-white/10 text-white h-14 px-10 text-base font-bold"
              >
                View Pricing
              </Button>
            </div>
            <p className="mt-6 text-xs text-white/25">No credit card required · Free tier includes 500 credits/month · Upgrade anytime</p>
          </div>
        </section>

      </MarketingLayout>
    );
  }
  