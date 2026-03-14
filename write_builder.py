import os

dest = "/home/ubuntu/archibald-titan-ai/client/src/pages/BuilderPage.tsx"

content = r'''import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { getLoginUrl } from "@/const";
import { AT_ICON_64 } from "@/lib/logos";
import { useState } from "react";
import { useLocation, Link } from "wouter";
import {
  ArrowRight, Check, ChevronDown, ChevronUp, Code2, Cpu, Download,
  Eye, FileCode, Hammer, HardDrive, LayoutDashboard, Layers, Lock,
  MessageSquare, RefreshCw, Rocket, Settings, Shield, Sparkles,
  Target, Users, Building2, Globe, Book, Github, Menu, X, Zap,
  Star, Quote, CheckCircle2, ExternalLink,
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

export default function BuilderPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleCTA = () => {
    if (user) setLocation("/dashboard");
    else window.location.href = getLoginUrl();
  };

  return (
    <div className="min-h-screen bg-[#060611] text-white overflow-x-hidden">

      {/* NAV */}
      <nav aria-label="Navigation" className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-[#060611]/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
              <img loading="eager" src={AT_ICON_64} alt="AT" className="h-9 w-9 object-contain" />
              <span className="text-lg font-bold tracking-tight">Archibald Titan</span>
            </Link>
            <div className="hidden md:flex items-center gap-6">
              <span className="text-sm text-blue-400 font-semibold">Titan Builder</span>
              <a href="#how-it-works" className="text-sm text-white/60 hover:text-white transition-colors">How It Works</a>
              <a href="#examples" className="text-sm text-white/60 hover:text-white transition-colors">Examples</a>
              <a href="#security" className="text-sm text-white/60 hover:text-white transition-colors">Security</a>
              <a href="#faq" className="text-sm text-white/60 hover:text-white transition-colors">FAQ</a>
              <Link href="/pricing" className="text-sm text-white/60 hover:text-white transition-colors">Pricing</Link>
            </div>
            <div className="flex items-center gap-2">
              {user ? (
                <Button onClick={() => setLocation("/dashboard")} size="sm" className="bg-blue-600 hover:bg-blue-500 text-white border-0 shadow-lg shadow-blue-600/25">
                  Open Builder <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                </Button>
              ) : (
                <>
                  <Button onClick={() => { window.location.href = getLoginUrl(); }} size="sm" variant="ghost" className="text-white/70 hover:text-white hidden sm:flex">Sign In</Button>
                  <Button onClick={handleCTA} size="sm" className="bg-blue-600 hover:bg-blue-500 text-white border-0 shadow-lg shadow-blue-600/25">Start Building Free</Button>
                </>
              )}
              <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="md:hidden flex items-center justify-center h-9 w-9 rounded-lg border border-white/10 bg-white/5 text-white hover:bg-white/10 transition-colors" aria-label="Toggle menu">
                {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            </div>
          </div>
        </div>
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-white/5 bg-[#060611]/95 backdrop-blur-xl">
            <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col gap-1">
              <a href="#how-it-works" onClick={() => setMobileMenuOpen(false)} className="block py-2.5 px-3 rounded-lg text-sm text-white/70 hover:text-white hover:bg-white/5 transition-colors">How It Works</a>
              <a href="#examples" onClick={() => setMobileMenuOpen(false)} className="block py-2.5 px-3 rounded-lg text-sm text-white/70 hover:text-white hover:bg-white/5 transition-colors">Examples</a>
              <a href="#security" onClick={() => setMobileMenuOpen(false)} className="block py-2.5 px-3 rounded-lg text-sm text-white/70 hover:text-white hover:bg-white/5 transition-colors">Security</a>
              <a href="#faq" onClick={() => setMobileMenuOpen(false)} className="block py-2.5 px-3 rounded-lg text-sm text-white/70 hover:text-white hover:bg-white/5 transition-colors">FAQ</a>
              <Link href="/pricing" onClick={() => setMobileMenuOpen(false)} className="block py-2.5 px-3 rounded-lg text-sm text-white/70 hover:text-white hover:bg-white/5 transition-colors">Pricing</Link>
              <div className="pt-2 border-t border-white/5 mt-1">
                <Button onClick={() => { setMobileMenuOpen(false); handleCTA(); }} className="w-full bg-blue-600 hover:bg-blue-500 text-white border-0" size="sm">Start Building Free</Button>
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* HERO */}
      <section className="relative pt-32 pb-20 sm:pt-40 sm:pb-32">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[600px] bg-blue-600/10 rounded-full blur-[130px]" />
          <div className="absolute top-1/3 right-1/4 w-[400px] h-[400px] bg-indigo-600/6 rounded-full blur-[100px]" />
          <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-500/20 to-transparent" />
        </div>
        <div className="absolute inset-0 opacity-[0.02]" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)", backgroundSize: "60px 60px" }} />
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-blue-500/20 bg-blue-500/5 mb-8">
            <Sparkles className="h-3.5 w-3.5 text-blue-400" />
            <span className="text-xs font-medium text-blue-300">Titan Builder — AI-powered output for real work</span>
          </div>
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black tracking-tight leading-[1.05]">
            <span className="text-white">Turn ideas into</span><br />
            <span className="bg-gradient-to-r from-blue-400 via-blue-500 to-indigo-500 bg-clip-text text-transparent">working outputs</span><br />
            <span className="text-white">with Titan Builder.</span>
          </h1>
          <p className="mt-6 text-lg sm:text-xl text-white/50 max-w-3xl mx-auto leading-relaxed">
            Titan Builder is the AI-powered build environment inside Archibald Titan. Describe what you need — a landing page, internal tool, business plan, or prototype — and Titan Builder produces a structured, editable, exportable result.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button size="lg" onClick={handleCTA} className="bg-blue-600 hover:bg-blue-500 text-white border-0 shadow-xl shadow-blue-600/25 h-14 px-10 text-base font-semibold gap-3">
              <Rocket className="h-5 w-5" />{user ? "Open Titan Builder" : "Start Building Free"}
            </Button>
            <a href="#how-it-works">
              <Button size="lg" variant="outline" className="border-white/10 bg-white/5 hover:bg-white/10 text-white h-12 px-8 text-base">
                See How It Works <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </a>
          </div>
          <p className="mt-4 text-sm text-white/30">No setup. No cloud dependency. Local-first workflow.</p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
            {[
              { icon: Lock, label: "Local-first" },
              { icon: Shield, label: "Encrypted credential handling" },
              { icon: Cpu, label: "Sandbox execution" },
              { icon: Download, label: "Export to any format" },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-2 text-sm text-white/40">
                <item.icon className="h-4 w-4 text-blue-400/60" />{item.label}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* WHAT YOU CAN BUILD */}
      <section id="what-you-can-build" className="relative py-24 sm:py-32">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-blue-950/5 to-transparent" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <span className="text-sm font-semibold text-blue-400 tracking-widest uppercase">Capabilities</span>
            <h2 className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight">What Titan Builder can produce</h2>
            <p className="mt-4 text-white/50 max-w-2xl mx-auto">Every output starts with a plain-language brief. Titan Builder structures the work, generates the output, and lets you refine and export it.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              { icon: Rocket, title: "Landing Pages", desc: "Hero, features, pricing, and CTA sections — production-ready HTML/CSS you can deploy immediately.", tag: "Web", color: "text-blue-400", bg: "bg-blue-500/10" },
              { icon: Layers, title: "MVPs & Prototypes", desc: "Functional prototypes with real UI, routing, and data structures — enough to test with real users.", tag: "App", color: "text-indigo-400", bg: "bg-indigo-500/10" },
              { icon: LayoutDashboard, title: "Internal Tools", desc: "Dashboards, admin panels, CRUD interfaces, and operational views for your team.", tag: "Tool", color: "text-cyan-400", bg: "bg-cyan-500/10" },
              { icon: FileCode, title: "Business Plans", desc: "Executive summary, market analysis, financial model, and go-to-market strategy — structured and editable.", tag: "Doc", color: "text-emerald-400", bg: "bg-emerald-500/10" },
              { icon: Settings, title: "Automation Scripts", desc: "Python, Bash, and Node scripts for data processing, API integrations, and workflow automation.", tag: "Code", color: "text-amber-400", bg: "bg-amber-500/10" },
              { icon: Book, title: "Product Documentation", desc: "PRDs, user stories, API docs, onboarding guides, and technical specifications.", tag: "Doc", color: "text-rose-400", bg: "bg-rose-500/10" },
            ].map((card) => (
              <div key={card.title} className="group p-6 rounded-2xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] hover:border-blue-500/20 transition-all duration-200">
                <div className="flex items-start justify-between mb-4">
                  <div className={`inline-flex p-3 rounded-xl ${card.bg}`}><card.icon className={`h-6 w-6 ${card.color}`} /></div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/5 text-white/40 border border-white/10">{card.tag}</span>
                </div>
                <h3 className="text-base font-semibold text-white mb-2">{card.title}</h3>
                <p className="text-sm text-white/50 leading-relaxed">{card.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how-it-works" className="relative py-24 sm:py-32">
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <span className="text-sm font-semibold text-blue-400 tracking-widest uppercase">Workflow</span>
            <h2 className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight">How Titan Builder works</h2>
            <p className="mt-4 text-white/50 max-w-xl mx-auto">Five steps from brief to working output. No setup. No configuration.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
            {[
              { step: "01", title: "Start with a brief", desc: "Describe the asset, workflow, or tool you want to create in plain language.", icon: MessageSquare },
              { step: "02", title: "Titan generates a plan", desc: "The builder structures your brief into a clear, actionable build path.", icon: Layers },
              { step: "03", title: "Build in a sandbox", desc: "Code, copy, and structure are generated in a controlled local environment.", icon: Hammer },
              { step: "04", title: "Refine and iterate", desc: "Edit output, adjust structure, and improve quality with follow-up prompts.", icon: RefreshCw },
              { step: "05", title: "Export and deploy", desc: "Download your output in the format you need and move it into your workflow.", icon: Download },
            ].map((item, i) => (
              <div key={item.step} className="relative text-center">
                {i < 4 && <div className="hidden lg:block absolute top-10 left-full w-full z-0"><div className="h-px w-full bg-gradient-to-r from-blue-500/30 to-transparent" /></div>}
                <div className="relative z-10 inline-flex items-center justify-center h-20 w-20 rounded-2xl border border-white/10 bg-white/[0.03] mb-5">
                  <item.icon className="h-9 w-9 text-blue-400" />
                </div>
                <div className="text-xs font-bold text-blue-500 tracking-widest mb-2">STEP {item.step}</div>
                <h3 className="text-base font-bold text-white mb-2">{item.title}</h3>
                <p className="text-sm text-white/50 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* WHY TITAN BUILDER */}
      <section className="relative py-20">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-blue-950/5 to-transparent" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <span className="text-sm font-semibold text-blue-400 tracking-widest uppercase">Why Titan Builder</span>
            <h2 className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight">Built differently from other AI tools</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: Target, title: "Outcome-oriented", desc: "Produces usable business outputs — not just generic responses. Every run ends with something you can use.", color: "text-blue-400", bg: "bg-blue-500/10" },
              { icon: HardDrive, title: "Local-first by design", desc: "The build environment runs on your machine. Your data, your control, your workflow.", color: "text-indigo-400", bg: "bg-indigo-500/10" },
              { icon: Shield, title: "Security-aware", desc: "Credential handling, AES-256-GCM encryption, and sandbox isolation are built into the architecture.", color: "text-cyan-400", bg: "bg-cyan-500/10" },
              { icon: Users, title: "Useful across roles", desc: "Founders, developers, agencies, and teams with sensitive workflows all have a clear use case.", color: "text-emerald-400", bg: "bg-emerald-500/10" },
            ].map((col) => (
              <div key={col.title} className="p-6 rounded-2xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] hover:border-blue-500/20 transition-all duration-200">
                <div className={`inline-flex p-3 rounded-xl ${col.bg} mb-4`}><col.icon className={`h-6 w-6 ${col.color}`} /></div>
                <h3 className="text-base font-semibold text-white mb-2">{col.title}</h3>
                <p className="text-sm text-white/50 leading-relaxed">{col.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* BY AUDIENCE */}
      <section className="relative py-24 sm:py-32">
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <span className="text-sm font-semibold text-blue-400 tracking-widest uppercase">Who It's For</span>
            <h2 className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight">A builder for every role</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: Rocket, audience: "Founders", goal: "Launch fast without hiring a full team", message: "Go from concept to offer page, prototype, and business plan faster — without waiting for a developer.", color: "from-blue-500 to-indigo-500" },
              { icon: Code2, audience: "Developers", goal: "Accelerate building while keeping control", message: "Generate interfaces, utilities, and scaffolding without giving up technical control over the output.", color: "from-indigo-500 to-violet-500" },
              { icon: Building2, audience: "Agencies & Freelancers", goal: "Deliver client work faster", message: "Clone, adapt, and ship landing pages and internal tools with better turnaround on every project.", color: "from-cyan-500 to-teal-500" },
              { icon: Shield, audience: "Teams with Sensitive Work", goal: "Use AI without exposing sensitive data", message: "A local-first workflow designed for teams where data sovereignty and access control matter.", color: "from-emerald-500 to-green-500" },
            ].map((card) => (
              <div key={card.audience} className="p-6 rounded-2xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] hover:border-blue-500/20 transition-all duration-200">
                <div className={`inline-flex items-center justify-center h-12 w-12 rounded-xl bg-gradient-to-br ${card.color} mb-4`}>
                  <card.icon className="h-6 w-6 text-white" />
                </div>
                <div className="text-xs font-semibold text-blue-400 tracking-wide mb-1">{card.goal}</div>
                <h3 className="text-base font-bold text-white mb-2">{card.audience}</h3>
                <p className="text-sm text-white/50 leading-relaxed">{card.message}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* EXAMPLES */}
      <section id="examples" className="relative py-20">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-blue-950/5 to-transparent" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <span className="text-sm font-semibold text-blue-400 tracking-widest uppercase">Example Outputs</span>
            <h2 className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight">Real outputs from real briefs</h2>
            <p className="mt-4 text-white/50 max-w-xl mx-auto">These are the kinds of outputs Titan Builder produces. Each starts with a plain-language description.</p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {[
              {
                brief: "Build me a SaaS landing page for a project management tool targeting remote teams",
                output: "Full HTML/CSS landing page with hero, feature grid, pricing table, testimonials, and CTA. Responsive, dark mode, ready to deploy.",
                type: "Landing Page",
                icon: Rocket,
                lines: "~420 lines HTML/CSS",
              },
              {
                brief: "Create an internal dashboard for tracking customer support tickets with status filters",
                output: "React component with data table, status badge system, filter sidebar, and mock API integration. Fully editable.",
                type: "Internal Tool",
                icon: LayoutDashboard,
                lines: "~280 lines TSX",
              },
              {
                brief: "Write a business plan for a B2B SaaS company selling compliance software to law firms",
                output: "12-section business plan including executive summary, market sizing, competitive analysis, go-to-market strategy, and 3-year financial model.",
                type: "Business Plan",
                icon: FileCode,
                lines: "~3,200 words",
              },
              {
                brief: "Build a Python script that pulls data from a REST API and exports it to a formatted CSV",
                output: "Documented Python script with error handling, rate limiting, pagination support, and configurable field mapping.",
                type: "Automation Script",
                icon: Settings,
                lines: "~180 lines Python",
              },
            ].map((ex, i) => (
              <div key={i} className="p-6 rounded-2xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] hover:border-blue-500/20 transition-all duration-200">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 rounded-lg bg-blue-500/10"><ex.icon className="h-5 w-5 text-blue-400" /></div>
                  <span className="text-xs font-semibold text-blue-400 tracking-wide">{ex.type}</span>
                  <span className="ml-auto text-xs text-white/30">{ex.lines}</span>
                </div>
                <div className="mb-4 p-3 rounded-lg bg-white/[0.03] border border-white/5">
                  <div className="text-[10px] font-semibold text-white/30 uppercase tracking-widest mb-1.5">Brief</div>
                  <p className="text-sm text-white/70 italic">"{ex.brief}"</p>
                </div>
                <div className="p-3 rounded-lg bg-blue-500/5 border border-blue-500/10">
                  <div className="text-[10px] font-semibold text-blue-400/60 uppercase tracking-widest mb-1.5">Output</div>
                  <p className="text-sm text-white/60 leading-relaxed">{ex.output}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="text-center mt-8">
            <Button onClick={handleCTA} className="bg-blue-600 hover:bg-blue-500 text-white border-0 shadow-lg shadow-blue-600/20">
              Try Titan Builder <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </section>

      {/* SECURITY */}
      <section id="security" className="relative py-24 sm:py-32">
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <span className="text-sm font-semibold text-blue-400 tracking-widest uppercase">Security & Privacy</span>
            <h2 className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight">A controlled build environment</h2>
            <p className="mt-4 text-white/50 max-w-2xl mx-auto">Titan Builder is built on a local-first architecture. Your prompts, credentials, and outputs stay on your machine unless you explicitly export them.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-12">
            {[
              { icon: HardDrive, title: "Local-first execution", desc: "The AI agent runs on your machine. Prompts and outputs are processed locally, not in a shared cloud environment." },
              { icon: Lock, title: "AES-256-GCM encryption", desc: "All credentials and vault entries are encrypted before storage. The key is derived from your session and never transmitted." },
              { icon: Eye, title: "No telemetry", desc: "No usage tracking, no behavioural analytics, no data sent to third parties. Full transparency into what the agent does." },
              { icon: Building2, title: "Team governance", desc: "Role-based access control, shared team vaults, and a full audit trail for organisations that need governed AI workflows." },
              { icon: Shield, title: "Sandbox isolation", desc: "Build operations run in an isolated environment. Experimental code and scripts don't affect your main system." },
              { icon: Zap, title: "Credential-aware", desc: "Titan Builder integrates with the Credential Fetcher to use your own API keys — not shared rate-limited keys." },
            ].map((item) => (
              <div key={item.title} className="flex gap-4 p-5 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] hover:border-blue-500/20 transition-all duration-200">
                <div className="p-2.5 rounded-xl bg-blue-500/10 h-fit shrink-0"><item.icon className="h-5 w-5 text-blue-400" /></div>
                <div>
                  <h4 className="text-sm font-semibold text-white mb-1.5">{item.title}</h4>
                  <p className="text-xs text-white/50 leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING CTA */}
      <section className="relative py-20">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-blue-950/5 to-transparent" />
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <span className="text-sm font-semibold text-blue-400 tracking-widest uppercase">Pricing</span>
            <h2 className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight">Start free. Upgrade when you're ready.</h2>
            <p className="mt-4 text-white/50 max-w-xl mx-auto">Titan Builder is available on all plans. Start with the free tier and upgrade when you need more credits, more integrations, or team capabilities.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 max-w-3xl mx-auto">
            {[
              { tier: "Starter", price: "$0", desc: "Good for early testing", features: ["300 AI credits/month", "AI Chat & Builder", "AES-256 vault", "3 integrations"], cta: "Start Free", primary: false },
              { tier: "Pro", price: "$29", desc: "Good for weekly production work", features: ["10,000 AI credits/month", "Unlimited credential fetches", "All 15+ integrations", "Priority support", "API access"], cta: "Start 7-Day Trial", primary: true },
              { tier: "Enterprise", price: "$99", desc: "Good for teams", features: ["25,000 AI credits/month", "Team vault with RBAC", "Full audit trail", "All 15+ integrations"], cta: "Contact Sales", primary: false },
            ].map((plan) => (
              <div key={plan.tier} className={`p-6 rounded-2xl border transition-all duration-300 ${plan.primary ? "border-2 border-blue-500/40 bg-blue-500/[0.04] ring-1 ring-blue-500/20 shadow-xl shadow-blue-500/10" : "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]"}`}>
                {plan.primary && (
                  <div className="flex justify-center mb-3">
                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-500 text-white shadow-lg shadow-blue-500/30">MOST POPULAR</span>
                  </div>
                )}
                <div className={`text-sm font-semibold mb-1 ${plan.primary ? "text-blue-400" : "text-white/60"}`}>{plan.tier}</div>
                <div className="text-3xl font-bold text-white mb-1">{plan.price}<span className="text-base font-normal text-white/40">/mo</span></div>
                <p className="text-sm text-white/40 mb-5">{plan.desc}</p>
                <div className="space-y-2.5 mb-6">
                  {plan.features.map((f) => (
                    <div key={f} className={`flex items-center gap-2 text-sm ${plan.primary ? "text-white/80" : "text-white/60"}`}>
                      <Check className="h-4 w-4 text-blue-400 shrink-0" />{f}
                    </div>
                  ))}
                </div>
                <Button onClick={() => { if (user) setLocation("/pricing"); else window.location.href = getLoginUrl(); }} className={`w-full h-11 ${plan.primary ? "bg-blue-600 hover:bg-blue-500 text-white border-0 shadow-lg shadow-blue-600/25" : "bg-white/5 hover:bg-white/10 text-white border border-white/10"}`}>
                  {plan.cta}
                </Button>
                {plan.primary && <p className="text-xs text-center text-white/30 mt-2">30-day money-back guarantee</p>}
              </div>
            ))}
          </div>
          <div className="text-center mt-6">
            <Link href="/pricing" className="text-sm text-blue-400 hover:text-blue-300 font-medium transition-colors inline-flex items-center gap-1">
              View all 6 plans and full feature comparison <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="relative py-24 sm:py-32">
        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <span className="text-sm font-semibold text-blue-400 tracking-widest uppercase">FAQ</span>
            <h2 className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight">Titan Builder — common questions</h2>
          </div>
          <div className="divide-y divide-white/5">
            <FAQItem question="What is Titan Builder?" answer="Titan Builder is the AI-powered build environment inside Archibald Titan. You describe what you want to create — a landing page, internal tool, business plan, or script — and Titan Builder generates a structured, editable, exportable result. It's designed to produce usable business outputs, not just conversational responses." />
            <FAQItem question="What types of outputs can it produce?" answer="Landing pages, MVPs, internal tools, admin panels, dashboards, business plans, product documentation, automation scripts, and structured content. The output is always editable and exportable in a format you can use directly." />
            <FAQItem question="How is this different from ChatGPT or other AI chat tools?" answer="Titan Builder is outcome-oriented. It's designed to produce complete, structured outputs — not conversational responses. It runs locally, integrates with your credentials and tools, supports a multi-step build workflow, and produces exportable results. It's a build environment, not a chat interface." />
            <FAQItem question="Does it run locally or in the cloud?" answer="Titan Builder runs locally on your machine. Your prompts, credentials, and outputs are processed in a local-first environment. Nothing leaves your machine unless you explicitly export or deploy the output." />
            <FAQItem question="Can I edit the output?" answer="Yes. Every output is fully editable inside the builder. You can refine copy, adjust structure, modify code, and iterate with follow-up prompts. When you're satisfied, export in your preferred format." />
            <FAQItem question="What formats can I export to?" answer="HTML, CSS, Markdown, JSON, Python, TypeScript, .env files, and zip archives. The export format depends on the output type — code outputs export as source files, documents export as Markdown or PDF, and full projects export as zip archives." />
            <FAQItem question="Is Titan Builder available on the free plan?" answer="Yes. The free Starter plan includes 300 AI credits per month, which is enough to test the workflow and produce small outputs. Pro ($29/mo) gives you 10,000 credits for regular production work. All paid plans include a 7-day free trial." />
            <FAQItem question="Can teams use Titan Builder?" answer="Yes. The Enterprise plan ($99/mo) adds team management with role-based access control, shared credential vaults, and a full audit trail — designed for teams that need governed AI workflows." />
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="relative py-24 sm:py-32">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-blue-600/10 rounded-full blur-[120px]" />
        </div>
        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Start building with Titan Builder</h2>
          <p className="mt-4 text-white/50 text-lg max-w-2xl mx-auto">Turn your next idea into a working output. No setup. No cloud dependency. Just describe what you need and build it.</p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button size="lg" onClick={handleCTA} className="bg-blue-600 hover:bg-blue-500 text-white border-0 shadow-xl shadow-blue-600/25 h-14 px-10 text-base font-semibold gap-3">
              <Rocket className="h-5 w-5" />{user ? "Open Titan Builder" : "Start Building Free"}
            </Button>
            <Link href="/contact">
              <Button size="lg" variant="outline" className="border-white/10 bg-white/5 hover:bg-white/10 text-white h-12 px-8 text-base">
                Talk to Sales <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
          <p className="mt-4 text-sm text-white/30">Free plan available. No credit card required.</p>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="relative border-t border-white/5 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="md:col-span-2">
              <Link href="/" className="flex items-center gap-3 mb-4 hover:opacity-80 transition-opacity w-fit">
                <img loading="eager" src={AT_ICON_64} alt="AT" className="h-8 w-8 object-contain" />
                <span className="text-base font-bold tracking-tight">Archibald Titan</span>
              </Link>
              <p className="text-sm text-white/40 max-w-sm leading-relaxed">Titan Builder — AI-powered build environment for founders, developers, and teams. Local-first. Secure. Exportable.</p>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white/80 mb-4">Titan Builder</h4>
              <div className="space-y-2.5">
                <a href="#what-you-can-build" className="block text-sm text-white/40 hover:text-white/70 transition-colors">What You Can Build</a>
                <a href="#how-it-works" className="block text-sm text-white/40 hover:text-white/70 transition-colors">How It Works</a>
                <a href="#examples" className="block text-sm text-white/40 hover:text-white/70 transition-colors">Examples</a>
                <a href="#security" className="block text-sm text-white/40 hover:text-white/70 transition-colors">Security</a>
                <a href="#faq" className="block text-sm text-white/40 hover:text-white/70 transition-colors">FAQ</a>
              </div>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white/80 mb-4">Archibald Titan</h4>
              <div className="space-y-2.5">
                <Link href="/" className="block text-sm text-white/40 hover:text-white/70 transition-colors">Home</Link>
                <Link href="/pricing" className="block text-sm text-white/40 hover:text-white/70 transition-colors">Pricing</Link>
                <Link href="/blog" className="block text-sm text-white/40 hover:text-white/70 transition-colors">Blog</Link>
                <Link href="/contact" className="block text-sm text-white/40 hover:text-white/70 transition-colors">Contact</Link>
                <Link href="/terms" className="block text-sm text-white/40 hover:text-white/70 transition-colors">Terms</Link>
                <Link href="/privacy" className="block text-sm text-white/40 hover:text-white/70 transition-colors">Privacy</Link>
              </div>
            </div>
          </div>
          <div className="mt-10 pt-6 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs text-white/20">&copy; {new Date().getFullYear()} Archibald Titan. All rights reserved.</p>
            <div className="flex items-center gap-6">
              <Link href="/terms" className="text-xs text-white/20 hover:text-white/40 transition-colors">Terms</Link>
              <Link href="/privacy" className="text-xs text-white/20 hover:text-white/40 transition-colors">Privacy</Link>
              <Link href="/contact" className="text-xs text-white/20 hover:text-white/40 transition-colors">Contact</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
'''

with open(dest, 'w') as f:
    f.write(content)

print(f"Written {len(content.splitlines())} lines to {dest}")
