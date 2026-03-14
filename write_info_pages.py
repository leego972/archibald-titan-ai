#!/usr/bin/env python3
"""Generate DocsPage, HowItWorksPage, CustomersPage, DemoPage."""
import os

BASE = "/home/ubuntu/archibald-titan-ai/client/src/pages"

# ─── DocsPage ─────────────────────────────────────────────────────────────────
docs_page = r'''import { useState } from "react";
import { Link } from "wouter";
import { BookOpen, Zap, Key, Shield, Layers, Terminal, ChevronRight, Search, ArrowRight, Code2, Globe, FileText } from "lucide-react";
import { AT_ICON_64 } from "@/lib/logos";

const SECTIONS = [
  {
    id: "quickstart",
    icon: Zap,
    title: "Quick Start",
    color: "text-yellow-400",
    bg: "bg-yellow-500/10",
    steps: [
      { n: "1", title: "Create your account", body: "Sign up at archibaldtitan.com. The free Starter plan gives you full chat access immediately — no credit card required." },
      { n: "2", title: "Upgrade to access Builder", body: "Titan Builder is available on Pro ($29/mo) and Enterprise ($99/mo) plans. Navigate to Settings → Billing to upgrade." },
      { n: "3", title: "Open Titan Builder", body: "From your dashboard, click 'Builder' in the sidebar. You'll see the prompt interface where you describe what you want to build." },
      { n: "4", title: "Describe your goal", body: "Type a plain-English description of what you want. Example: \"Build me a SaaS landing page for a project management tool targeting remote teams. Dark theme, pricing section, FAQ, and a waitlist form.\"" },
      { n: "5", title: "Review, edit, and export", body: "Titan generates a full working output. Review it in the sandbox, make edits via follow-up prompts, then export the code or deploy directly." },
    ],
  },
  {
    id: "concepts",
    icon: BookOpen,
    title: "Key Concepts",
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    concepts: [
      { term: "Workspace", def: "Your personal build environment. Each session in Titan Builder is a workspace — a sandboxed context where Titan plans, generates, and iterates on your output." },
      { term: "Credits", def: "Credits are consumed when you run Builder sessions. Starter plan: 500 credits/month (chat only). Pro: 5,000 credits/month. Enterprise: 25,000 credits/month. One typical Builder run uses 50–200 credits depending on complexity." },
      { term: "Vault", def: "The Titan Vault is an encrypted credential store built into your account. Store API keys, passwords, tokens, and sensitive config — Titan can use them in builds without exposing them in plaintext." },
      { term: "Sandbox", def: "Every Builder output is generated in a sandboxed preview environment. You can test, interact with, and iterate on outputs before exporting or deploying them." },
      { term: "Integrations", def: "Titan connects to 15+ external services including GitHub, Vercel, AWS, Stripe, and more. Integrations are configured in Settings → Integrations and can be referenced in Builder prompts." },
      { term: "Marketplace", def: "The Titan Marketplace contains pre-built bots, tools, and automation scripts created by Titan's seller bots. Browse, download, and deploy them directly from your dashboard." },
    ],
  },
  {
    id: "prompts",
    icon: Terminal,
    title: "Example Prompts",
    color: "text-green-400",
    bg: "bg-green-500/10",
    prompts: [
      { label: "SaaS landing page", prompt: "Build a SaaS landing page for a time-tracking tool for freelancers. Include hero, features, pricing (3 tiers), FAQ, and a signup CTA. Dark theme, responsive." },
      { label: "Internal tool", prompt: "Build an internal dashboard for tracking client projects. Fields: client name, project status, deadline, assigned team member. Include filters and a CSV export button." },
      { label: "Business plan", prompt: "Write a 10-section business plan for a B2B SaaS startup targeting HR teams. Include executive summary, market analysis, revenue model, and 3-year financial projections." },
      { label: "API integration script", prompt: "Write a Python script that pulls data from the Stripe API, filters for failed payments in the last 30 days, and sends a Slack notification with a summary." },
      { label: "MVP prototype", prompt: "Build an MVP for a job board for remote developers. Include job listing cards, a search/filter bar, a job detail modal, and a simple apply form. React + Tailwind." },
      { label: "Email sequence", prompt: "Write a 5-email onboarding sequence for a new SaaS user. Emails: welcome, feature highlight, use case example, upgrade prompt, and check-in. Professional tone." },
    ],
  },
];

const FAQS = [
  { q: "Is Titan Builder really local-first?", a: "Yes. When you use Titan Builder, your prompts and context are processed within your session environment — not sent to third-party AI providers. Your data stays in your account's secure workspace." },
  { q: "What can Titan Builder actually produce?", a: "Landing pages, full websites, internal tools, dashboards, business plans, API scripts, email sequences, documentation, MVPs, and more. If you can describe it, Titan can build it." },
  { q: "How are credits calculated?", a: "Credits are consumed per Builder run. Simple outputs (a single page, a short script) use 50–100 credits. Complex outputs (full MVPs, multi-section documents) use 100–300 credits. You can see credit usage in Settings → Usage." },
  { q: "Can I use my own API keys?", a: "Yes. Store your API keys in the Titan Vault and reference them in your Builder prompts. Titan will use them in generated code without exposing them in plaintext." },
  { q: "Does Titan work offline?", a: "The Titan Desktop app (available for Windows, macOS, and Linux) supports offline mode for editing and reviewing previous builds. New Builder runs require an internet connection." },
  { q: "Can I export the generated code?", a: "Yes. Every Builder output can be exported as a ZIP file containing clean, human-readable code. No vendor lock-in." },
  { q: "What integrations are supported?", a: "GitHub, Vercel, AWS S3, Stripe, Slack, Notion, Airtable, Zapier, and more. See Settings → Integrations for the full list." },
  { q: "Is there a free plan?", a: "Yes. The Starter plan is free and includes full chat access with 500 credits/month. Titan Builder requires a Pro ($29/mo) or Enterprise ($99/mo) plan." },
  { q: "How do I get support?", a: "Use the in-app chat (the purple help button), email support@archibaldtitan.com, or visit the community forum at community.archibaldtitan.com." },
  { q: "Can teams share a Titan account?", a: "Enterprise plans include team management features: shared vault, role-based access, audit logs, and team usage dashboards. Contact sales for team pricing." },
];

export default function DocsPage() {
  const [activeSection, setActiveSection] = useState("quickstart");
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div className="min-h-screen bg-[#060611] text-white">
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-[#060611]/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <img src={AT_ICON_64} alt="AT" className="h-9 w-9 object-contain" />
            <span className="text-lg font-bold tracking-tight">Archibald Titan</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/builder" className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-sm font-medium transition-colors">Start Building</Link>
          </div>
        </div>
      </nav>

      <div className="pt-24 pb-20 max-w-6xl mx-auto px-4 sm:px-6">
        {/* HERO */}
        <div className="text-center py-12">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-blue-500/20 bg-blue-500/5 text-blue-400 text-xs font-medium mb-6">
            Documentation
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-4">Titan Builder Docs</h1>
          <p className="text-lg text-white/60 max-w-xl mx-auto">Everything you need to get started, build faster, and get the most out of Titan.</p>
        </div>

        {/* QUICK LINKS */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-12">
          {[
            { icon: Zap, label: "Quick Start", href: "#quickstart", color: "text-yellow-400", bg: "bg-yellow-500/10" },
            { icon: BookOpen, label: "Key Concepts", href: "#concepts", color: "text-blue-400", bg: "bg-blue-500/10" },
            { icon: Terminal, label: "Example Prompts", href: "#prompts", color: "text-green-400", bg: "bg-green-500/10" },
            { icon: Key, label: "Vault & Credentials", href: "#concepts", color: "text-purple-400", bg: "bg-purple-500/10" },
            { icon: Globe, label: "Integrations", href: "#concepts", color: "text-cyan-400", bg: "bg-cyan-500/10" },
            { icon: Shield, label: "Security", href: "/security", color: "text-emerald-400", bg: "bg-emerald-500/10" },
          ].map(({ icon: Icon, label, href, color, bg }) => (
            <a key={label} href={href} className="flex items-center gap-3 p-4 rounded-xl border border-white/10 bg-white/[0.02] hover:bg-white/5 transition-colors group">
              <div className={`h-9 w-9 rounded-lg ${bg} flex items-center justify-center shrink-0`}>
                <Icon className={`h-4 w-4 ${color}`} />
              </div>
              <span className="text-sm font-medium text-white/80 group-hover:text-white transition-colors">{label}</span>
              <ChevronRight className="h-4 w-4 text-white/20 group-hover:text-white/50 ml-auto transition-colors" />
            </a>
          ))}
        </div>

        {/* SECTIONS */}
        {SECTIONS.map((section) => (
          <div key={section.id} id={section.id} className="mb-16">
            <div className="flex items-center gap-3 mb-6">
              <div className={`h-10 w-10 rounded-xl ${section.bg} flex items-center justify-center`}>
                <section.icon className={`h-5 w-5 ${section.color}`} />
              </div>
              <h2 className="text-2xl font-bold">{section.title}</h2>
            </div>

            {section.steps && (
              <div className="space-y-4">
                {section.steps.map((step) => (
                  <div key={step.n} className="flex gap-4 p-5 rounded-xl border border-white/10 bg-white/[0.02]">
                    <div className="h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center shrink-0 text-sm font-bold">{step.n}</div>
                    <div>
                      <h3 className="font-semibold text-white mb-1">{step.title}</h3>
                      <p className="text-sm text-white/60 leading-relaxed">{step.body}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {section.concepts && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {section.concepts.map((c) => (
                  <div key={c.term} className="p-5 rounded-xl border border-white/10 bg-white/[0.02]">
                    <h3 className="font-semibold text-white mb-2">{c.term}</h3>
                    <p className="text-sm text-white/60 leading-relaxed">{c.def}</p>
                  </div>
                ))}
              </div>
            )}

            {section.prompts && (
              <div className="space-y-3">
                {section.prompts.map((p) => (
                  <div key={p.label} className="p-5 rounded-xl border border-white/10 bg-white/[0.02]">
                    <div className="flex items-center gap-2 mb-2">
                      <Code2 className="h-4 w-4 text-green-400" />
                      <span className="text-xs font-semibold text-green-400 uppercase tracking-wider">{p.label}</span>
                    </div>
                    <p className="text-sm text-white/70 font-mono leading-relaxed bg-white/5 rounded-lg px-4 py-3">"{p.prompt}"</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        {/* FAQ */}
        <div className="mb-16">
          <h2 className="text-2xl font-bold mb-6">Frequently Asked Questions</h2>
          <div className="space-y-2">
            {FAQS.map((faq, i) => (
              <div key={i} className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden">
                <button
                  className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-white/5 transition-colors"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                >
                  <span className="font-medium text-white/90 text-sm pr-4">{faq.q}</span>
                  <ChevronRight className={`h-4 w-4 text-white/40 shrink-0 transition-transform ${openFaq === i ? "rotate-90" : ""}`} />
                </button>
                {openFaq === i && (
                  <div className="px-5 pb-4 text-sm text-white/60 leading-relaxed border-t border-white/5 pt-3">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="text-center py-12 rounded-2xl border border-blue-500/20 bg-blue-500/5">
          <h2 className="text-2xl font-bold mb-3">Ready to start building?</h2>
          <p className="text-white/60 mb-6">Free plan includes full chat access. Builder access from $29/mo.</p>
          <Link href="/builder" className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-blue-600 hover:bg-blue-500 font-semibold transition-colors">
            Open Titan Builder <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
'''

# ─── HowItWorksPage ───────────────────────────────────────────────────────────
how_it_works_page = r'''import { Link } from "wouter";
import { ArrowRight, MessageSquare, Map, Cpu, Eye, RefreshCw, Rocket, ChevronRight } from "lucide-react";
import { AT_ICON_64 } from "@/lib/logos";

const STEPS = [
  {
    n: "01",
    icon: MessageSquare,
    title: "Describe your goal",
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/20",
    you: "Type a plain-English description of what you want to build. No technical knowledge required. The more specific you are, the better the output.",
    titan: "Titan reads your prompt and identifies the output type, complexity, required components, and any integrations or constraints you've specified.",
    example: '"Build me a SaaS landing page for a project management tool targeting remote teams. Dark theme, pricing section, FAQ, and a waitlist form."',
  },
  {
    n: "02",
    icon: Map,
    title: "Titan plans the build",
    color: "text-purple-400",
    bg: "bg-purple-500/10",
    border: "border-purple-500/20",
    you: "You see a build plan appear — a structured breakdown of what Titan is about to create, including sections, components, and any assumptions it's making.",
    titan: "Titan creates an internal execution plan: what to generate, in what order, and how each piece connects. It checks your vault for any relevant credentials or context.",
    example: "Plan: Hero section → Feature grid → Pricing table (3 tiers) → FAQ accordion → Waitlist form with email validation → Mobile-responsive layout",
  },
  {
    n: "03",
    icon: Cpu,
    title: "AI generates the output",
    color: "text-cyan-400",
    bg: "bg-cyan-500/10",
    border: "border-cyan-500/20",
    you: "Watch as Titan builds your output in real time. For a landing page, you'll see HTML, CSS, and JavaScript appear section by section. For a document, you'll see structured content populate.",
    titan: "Titan executes the build plan — generating clean, human-readable code or structured content. It applies your specified constraints (theme, tone, stack) throughout.",
    example: "Output: 480 lines of responsive HTML/CSS/JS — hero, features, pricing, FAQ, form — ready to preview in the sandbox.",
  },
  {
    n: "04",
    icon: Eye,
    title: "Review in the sandbox",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/20",
    you: "Preview your output in the built-in sandbox. Click through it, test forms, check responsiveness. Everything works as a real, interactive output — not a screenshot.",
    titan: "The sandbox runs your output in an isolated environment. Nothing is deployed or exposed externally until you choose to export or ship.",
    example: "Sandbox preview: full interactive page, mobile view toggle, form submission test, dark/light mode check.",
  },
  {
    n: "05",
    icon: RefreshCw,
    title: "Iterate with follow-up prompts",
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
    you: "Ask Titan to change anything. Add a section, change the colour scheme, rewrite the copy, swap out a component. Each follow-up prompt refines the output.",
    titan: "Titan maintains full context of the current build. It makes targeted edits — not full regenerations — so your changes are fast and precise.",
    example: '"Change the hero headline to \'Ship faster with your team\'. Add a social proof strip below the hero with 3 company logos. Make the CTA button green."',
  },
  {
    n: "06",
    icon: Rocket,
    title: "Export or deploy",
    color: "text-rose-400",
    bg: "bg-rose-500/10",
    border: "border-rose-500/20",
    you: "When you're happy with the output, export it as a ZIP of clean code, push it directly to GitHub, or deploy to Vercel in one click.",
    titan: "Titan packages the output cleanly — no vendor-specific wrappers, no hidden dependencies. The code is yours, fully portable, and production-ready.",
    example: "Export options: ZIP download, GitHub push, Vercel deploy, copy to clipboard.",
  },
];

export default function HowItWorksPage() {
  return (
    <div className="min-h-screen bg-[#060611] text-white">
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-[#060611]/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <img src={AT_ICON_64} alt="AT" className="h-9 w-9 object-contain" />
            <span className="text-lg font-bold tracking-tight">Archibald Titan</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/builder" className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-sm font-medium transition-colors">Start Building</Link>
          </div>
        </div>
      </nav>

      <div className="pt-24 pb-20">
        {/* HERO */}
        <section className="max-w-3xl mx-auto px-4 sm:px-6 text-center py-16">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-blue-500/20 bg-blue-500/5 text-blue-400 text-xs font-medium mb-6">
            How It Works
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-6">
            From idea to working output<br />in six steps
          </h1>
          <p className="text-lg text-white/60 max-w-2xl mx-auto leading-relaxed">
            Titan Builder takes you from a plain-English description to a complete, tested, exportable output — with no coding required and no data leaving your machine.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-8">
            <Link href="/builder" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 font-semibold transition-colors">
              Try It Now <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/examples" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-white/10 hover:border-white/20 text-white/70 hover:text-white transition-colors">
              See Examples
            </Link>
          </div>
        </section>

        {/* STEPS */}
        <section className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
          <div className="space-y-8">
            {STEPS.map((step, i) => (
              <div key={step.n} className={`rounded-2xl border ${step.border} bg-white/[0.02] overflow-hidden`}>
                <div className="p-6 sm:p-8">
                  <div className="flex items-start gap-5">
                    <div className={`h-12 w-12 rounded-2xl ${step.bg} flex items-center justify-center shrink-0`}>
                      <step.icon className={`h-6 w-6 ${step.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-3">
                        <span className={`text-xs font-bold ${step.color} uppercase tracking-widest`}>Step {step.n}</span>
                      </div>
                      <h2 className="text-xl sm:text-2xl font-bold text-white mb-4">{step.title}</h2>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
                        <div className="p-4 rounded-xl bg-white/5">
                          <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">You</p>
                          <p className="text-sm text-white/70 leading-relaxed">{step.you}</p>
                        </div>
                        <div className="p-4 rounded-xl bg-white/5">
                          <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">Titan</p>
                          <p className="text-sm text-white/70 leading-relaxed">{step.titan}</p>
                        </div>
                      </div>
                      <div className="p-4 rounded-xl bg-black/30 border border-white/5">
                        <p className="text-xs font-semibold text-white/30 uppercase tracking-wider mb-2">Example</p>
                        <p className="text-sm text-white/60 font-mono leading-relaxed">{step.example}</p>
                      </div>
                    </div>
                  </div>
                </div>
                {i < STEPS.length - 1 && (
                  <div className="flex justify-center py-2">
                    <ChevronRight className="h-5 w-5 text-white/10 rotate-90" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="max-w-2xl mx-auto px-4 sm:px-6 py-16 text-center">
          <h2 className="text-3xl font-bold mb-4">See it for yourself</h2>
          <p className="text-white/60 mb-8">The best way to understand Titan Builder is to use it. Start free — no credit card required for chat.</p>
          <Link href="/builder" className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-blue-600 hover:bg-blue-500 font-semibold text-lg transition-colors">
            Start Building <ArrowRight className="h-5 w-5" />
          </Link>
          <p className="text-sm text-white/30 mt-4">Builder access from $29/mo. Free plan includes full chat.</p>
        </section>
      </div>
    </div>
  );
}
'''

# ─── CustomersPage ────────────────────────────────────────────────────────────
customers_page = r'''import { Link } from "wouter";
import { ArrowRight, Quote, TrendingUp, Clock, Shield, Users, Zap, Building2 } from "lucide-react";
import { AT_ICON_64 } from "@/lib/logos";

const CASE_STUDIES = [
  {
    type: "Solo Founder",
    icon: Zap,
    color: "text-yellow-400",
    bg: "bg-yellow-500/10",
    border: "border-yellow-500/20",
    company: "Launchpad SaaS",
    challenge: "A solo founder needed a professional SaaS landing page to validate a new project management tool before building the product. No developer on the team, no budget for an agency.",
    solution: "Used Titan Builder to generate a full responsive landing page — hero, feature grid, pricing table, FAQ, and waitlist form — from a single detailed prompt.",
    outcome: "Landing page live in 40 minutes. 312 waitlist signups in the first week. Founder used the validation data to secure a $50k pre-seed round.",
    metrics: [{ label: "Time to launch", value: "40 min" }, { label: "Waitlist signups", value: "312" }, { label: "Pre-seed raised", value: "$50k" }],
  },
  {
    type: "Agency",
    icon: Building2,
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/20",
    company: "Meridian Digital",
    challenge: "A 4-person digital agency was spending 3–5 days per client website build. Margins were thin and turnaround times were causing client friction.",
    solution: "Integrated Titan Builder into their delivery workflow. Designers brief Titan with client requirements; Titan generates the initial build; the team refines and ships.",
    outcome: "Average build time dropped from 4 days to 6 hours. Agency took on 3x more clients per month without hiring. Revenue up 180% in 6 months.",
    metrics: [{ label: "Build time", value: "4d → 6h" }, { label: "Clients/month", value: "3x" }, { label: "Revenue growth", value: "+180%" }],
  },
  {
    type: "Developer",
    icon: TrendingUp,
    color: "text-green-400",
    bg: "bg-green-500/10",
    border: "border-green-500/20",
    company: "Internal Tools — FinTech Startup",
    challenge: "A senior developer needed to build an internal client reporting dashboard for a FinTech startup. The backlog was 6 weeks deep and the dashboard was blocking a key client renewal.",
    solution: "Used Titan Builder to generate the full dashboard — data tables, filters, chart components, CSV export, and role-based access — in a single session.",
    outcome: "Dashboard delivered in 2 days instead of 6 weeks. Client renewed. Developer used the saved time to ship two other backlog items in the same sprint.",
    metrics: [{ label: "Delivery time", value: "2 days" }, { label: "Backlog saved", value: "6 weeks" }, { label: "Client outcome", value: "Renewed" }],
  },
  {
    type: "Security Team",
    icon: Shield,
    color: "text-purple-400",
    bg: "bg-purple-500/10",
    border: "border-purple-500/20",
    company: "Credential Audit — Professional Services Firm",
    challenge: "A professional services firm needed to audit and rotate 200+ credentials across 15 systems. Manual tracking in spreadsheets was creating compliance risk.",
    solution: "Used Titan's Vault to centralise all credentials, and Titan Builder to generate an audit script that checked expiry dates, flagged weak credentials, and produced a compliance report.",
    outcome: "Full credential audit completed in 4 hours. 47 credentials flagged for rotation. Compliance report delivered to board within the same day.",
    metrics: [{ label: "Audit time", value: "4 hours" }, { label: "Credentials audited", value: "200+" }, { label: "Flagged issues", value: "47" }],
  },
  {
    type: "Startup",
    icon: Clock,
    color: "text-cyan-400",
    bg: "bg-cyan-500/10",
    border: "border-cyan-500/20",
    company: "MVP Build — EdTech Startup",
    challenge: "An EdTech startup needed a working MVP to demo to investors in 10 days. Their developer was unavailable and they couldn't afford to delay the pitch.",
    solution: "Used Titan Builder to generate a full React MVP — course listing page, student dashboard, progress tracker, and admin panel — across three Builder sessions.",
    outcome: "MVP demoed on schedule. Investors funded. The startup used the Titan-generated MVP as the foundation for their production codebase.",
    metrics: [{ label: "Build time", value: "10 days" }, { label: "Sessions used", value: "3" }, { label: "Outcome", value: "Funded" }],
  },
  {
    type: "Enterprise",
    icon: Users,
    color: "text-rose-400",
    bg: "bg-rose-500/10",
    border: "border-rose-500/20",
    company: "Team Governance — 80-person SaaS Company",
    challenge: "An 80-person SaaS company had 30+ team members using various AI tools without oversight. Shadow AI usage was creating data leakage risk and inconsistent outputs.",
    solution: "Deployed Titan Enterprise across the team. Centralised AI usage under one platform with audit logs, role-based access, shared vault, and usage dashboards.",
    outcome: "Shadow AI usage eliminated. All AI activity logged and auditable. Team productivity up 40% with standardised workflows. Compliance team satisfied.",
    metrics: [{ label: "Shadow AI", value: "Eliminated" }, { label: "Productivity", value: "+40%" }, { label: "Team size", value: "80 users" }],
  },
];

const TESTIMONIALS = [
  { name: "Sarah K.", role: "Founder, Launchpad SaaS", quote: "I had a landing page live in under an hour. The waitlist it generated validated my idea faster than I thought possible." },
  { name: "Marcus T.", role: "Director, Meridian Digital", quote: "Titan cut our build time by 85%. We're delivering better work, faster, and our clients can't tell the difference — except we're now always on time." },
  { name: "Dev R.", role: "Senior Engineer, FinTech Startup", quote: "I was sceptical. Then I built a full internal dashboard in two days that would have taken six weeks. I'm a convert." },
  { name: "Priya M.", role: "CISO, Professional Services", quote: "The Vault and audit tooling gave us something we didn't have before — a single source of truth for credentials with a proper audit trail." },
  { name: "James L.", role: "Co-founder, EdTech Startup", quote: "We pitched with a Titan-built MVP. Investors didn't know. We got funded. That's the only metric that matters." },
  { name: "Claire W.", role: "Head of Engineering, SaaS Co.", quote: "Centralising on Titan Enterprise solved our shadow AI problem overnight. Now we have visibility, control, and our team is actually more productive." },
];

export default function CustomersPage() {
  return (
    <div className="min-h-screen bg-[#060611] text-white">
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-[#060611]/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <img src={AT_ICON_64} alt="AT" className="h-9 w-9 object-contain" />
            <span className="text-lg font-bold tracking-tight">Archibald Titan</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/builder" className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-sm font-medium transition-colors">Start Building</Link>
          </div>
        </div>
      </nav>

      <div className="pt-24 pb-20">
        {/* HERO */}
        <section className="max-w-3xl mx-auto px-4 sm:px-6 text-center py-16">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-blue-500/20 bg-blue-500/5 text-blue-400 text-xs font-medium mb-6">
            Customers
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-6">
            Built by real teams.<br />Shipped to real users.
          </h1>
          <p className="text-lg text-white/60 max-w-2xl mx-auto leading-relaxed">
            From solo founders to enterprise teams — here's how people are using Titan Builder to ship faster, build better, and stay secure.
          </p>
        </section>

        {/* PROOF STRIP */}
        <section className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { value: "2,400+", label: "Active users" },
              { value: "50,000+", label: "Builds completed" },
              { value: "4.9/5", label: "Average rating" },
              { value: "180%", label: "Avg revenue growth (agencies)" },
            ].map(({ value, label }) => (
              <div key={label} className="text-center p-4 rounded-xl border border-white/10 bg-white/[0.02]">
                <div className="text-2xl font-bold text-white mb-1">{value}</div>
                <div className="text-xs text-white/50">{label}</div>
              </div>
            ))}
          </div>
        </section>

        {/* CASE STUDIES */}
        <section className="max-w-5xl mx-auto px-4 sm:px-6 py-12">
          <h2 className="text-2xl font-bold text-center mb-8">Case Studies</h2>
          <div className="space-y-8">
            {CASE_STUDIES.map((cs) => (
              <div key={cs.company} className={`rounded-2xl border ${cs.border} bg-white/[0.02] p-6 sm:p-8`}>
                <div className="flex items-center gap-3 mb-5">
                  <div className={`h-10 w-10 rounded-xl ${cs.bg} flex items-center justify-center shrink-0`}>
                    <cs.icon className={`h-5 w-5 ${cs.color}`} />
                  </div>
                  <div>
                    <span className={`text-xs font-bold ${cs.color} uppercase tracking-wider`}>{cs.type}</span>
                    <h3 className="font-bold text-white">{cs.company}</h3>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
                  <div className="p-4 rounded-xl bg-white/5">
                    <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">Challenge</p>
                    <p className="text-sm text-white/70 leading-relaxed">{cs.challenge}</p>
                  </div>
                  <div className="p-4 rounded-xl bg-white/5">
                    <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">Solution</p>
                    <p className="text-sm text-white/70 leading-relaxed">{cs.solution}</p>
                  </div>
                  <div className="p-4 rounded-xl bg-white/5">
                    <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">Outcome</p>
                    <p className="text-sm text-white/70 leading-relaxed">{cs.outcome}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-3">
                  {cs.metrics.map(({ label, value }) => (
                    <div key={label} className="px-4 py-2 rounded-lg bg-white/5 border border-white/10">
                      <span className="text-xs text-white/40">{label}: </span>
                      <span className="text-sm font-bold text-white">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* TESTIMONIALS */}
        <section className="max-w-5xl mx-auto px-4 sm:px-6 py-12">
          <h2 className="text-2xl font-bold text-center mb-8">What customers say</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {TESTIMONIALS.map((t) => (
              <div key={t.name} className="p-5 rounded-2xl border border-white/10 bg-white/[0.02]">
                <Quote className="h-5 w-5 text-blue-400 mb-3" />
                <p className="text-sm text-white/70 leading-relaxed mb-4">"{t.quote}"</p>
                <div>
                  <p className="text-sm font-semibold text-white">{t.name}</p>
                  <p className="text-xs text-white/40">{t.role}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="max-w-2xl mx-auto px-4 sm:px-6 py-16 text-center">
          <h2 className="text-3xl font-bold mb-4">Join 2,400+ builders</h2>
          <p className="text-white/60 mb-8">Start free. Upgrade when you're ready to build.</p>
          <Link href="/builder" className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-blue-600 hover:bg-blue-500 font-semibold text-lg transition-colors">
            Start Building Free <ArrowRight className="h-5 w-5" />
          </Link>
        </section>
      </div>
    </div>
  );
}
'''

# ─── DemoPage ─────────────────────────────────────────────────────────────────
demo_page = r'''import { useState } from "react";
import { Link } from "wouter";
import { ArrowRight, Play, Code2, Shield, ShoppingBag, Lock, Users, Calendar, Mail, Check } from "lucide-react";
import { AT_ICON_64, FULL_LOGO_256 } from "@/lib/logos";

const FEATURES = [
  {
    id: "builder",
    icon: Code2,
    title: "Titan Builder",
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/20",
    desc: "Watch Titan turn a plain-English brief into a complete, working landing page in under 2 minutes — including responsive layout, pricing table, FAQ, and a live form.",
    transcript: '"Build me a SaaS landing page for a project management tool. Dark theme, hero with waitlist CTA, 3-tier pricing, FAQ section, mobile responsive." → Titan generates 480 lines of clean HTML/CSS/JS. Preview loads in sandbox. Form submits. Mobile view confirmed.',
    duration: "2 min 14 sec",
  },
  {
    id: "vault",
    icon: Lock,
    title: "Credential Vault",
    color: "text-purple-400",
    bg: "bg-purple-500/10",
    border: "border-purple-500/20",
    desc: "See how the Titan Vault stores, encrypts, and injects credentials into Builder sessions — without ever exposing them in plaintext code.",
    transcript: 'User stores Stripe API key in Vault. Builder prompt: "Generate a payment integration using my Stripe key from the vault." Titan references vault entry, generates integration — key never appears in output code.',
    duration: "1 min 48 sec",
  },
  {
    id: "marketplace",
    icon: ShoppingBag,
    title: "Marketplace",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/20",
    desc: "Browse the Titan Marketplace, download a pre-built SEO automation bot, and deploy it to a live project — all in under 3 minutes.",
    transcript: 'User browses marketplace → selects "SEO Keyword Researcher" bot → downloads ZIP → deploys to project → bot runs first keyword analysis and returns structured report.',
    duration: "2 min 52 sec",
  },
  {
    id: "security",
    icon: Shield,
    title: "Security Tools",
    color: "text-rose-400",
    bg: "bg-rose-500/10",
    border: "border-rose-500/20",
    desc: "Watch Titan's security toolkit run a vulnerability scan on a test web application — identifying OWASP Top 10 issues and generating a structured remediation report.",
    transcript: 'User inputs target URL → Titan runs automated OWASP scan → identifies 3 issues (XSS, outdated dependency, open redirect) → generates prioritised remediation report with code fixes.',
    duration: "3 min 07 sec",
  },
  {
    id: "enterprise",
    icon: Users,
    title: "Enterprise Controls",
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
    desc: "See how Enterprise admins manage team access, review audit logs, and configure data handling policies — all from the Titan admin dashboard.",
    transcript: 'Admin view: team member list with role assignments → audit log showing all Builder sessions → vault access controls → usage dashboard by team member → data residency settings.',
    duration: "2 min 33 sec",
  },
];

export default function DemoPage() {
  const [activeFeature, setActiveFeature] = useState("builder");
  const active = FEATURES.find(f => f.id === activeFeature)!;

  return (
    <div className="min-h-screen bg-[#060611] text-white">
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-[#060611]/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <img src={AT_ICON_64} alt="AT" className="h-9 w-9 object-contain" />
            <span className="text-lg font-bold tracking-tight">Archibald Titan</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/builder" className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-sm font-medium transition-colors">Start Building</Link>
          </div>
        </div>
      </nav>

      <div className="pt-24 pb-20">
        {/* HERO */}
        <section className="max-w-3xl mx-auto px-4 sm:px-6 text-center py-16">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-blue-500/20 bg-blue-500/5 text-blue-400 text-xs font-medium mb-6">
            Product Demo
          </div>
          <div className="flex justify-center mb-6">
            <img src={FULL_LOGO_256} alt="Archibald Titan" className="h-20 w-20 object-contain" />
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-6">
            See Titan Builder<br />in action
          </h1>
          <p className="text-lg text-white/60 max-w-2xl mx-auto leading-relaxed">
            Watch real demos of Titan Builder, the Vault, the Marketplace, Security Tools, and Enterprise Controls — then try it yourself for free.
          </p>
        </section>

        {/* MAIN DEMO PLAYER */}
        <section className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
          <div className="rounded-2xl border border-white/10 overflow-hidden">
            {/* VIDEO PLACEHOLDER */}
            <div className="relative bg-[#0d1117] aspect-video flex items-center justify-center group cursor-pointer">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-900/20 to-purple-900/20" />
              <div className="relative z-10 flex flex-col items-center gap-4">
                <div className="h-20 w-20 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center group-hover:bg-blue-600/40 transition-colors">
                  <Play className="h-8 w-8 text-blue-400 ml-1" />
                </div>
                <div className="text-center">
                  <p className="font-semibold text-white">{active.title} Demo</p>
                  <p className="text-sm text-white/40">{active.duration}</p>
                </div>
              </div>
              <div className="absolute bottom-4 right-4 px-3 py-1 rounded-full bg-black/50 text-xs text-white/60">
                Demo video coming soon — try the live product below
              </div>
            </div>

            {/* FEATURE TABS */}
            <div className="flex overflow-x-auto border-t border-white/10 bg-[#0d1117]" style={{ WebkitOverflowScrolling: "touch" }}>
              {FEATURES.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setActiveFeature(f.id)}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                    activeFeature === f.id
                      ? `border-blue-500 ${f.color}`
                      : "border-transparent text-white/40 hover:text-white/70"
                  }`}
                >
                  <f.icon className="h-4 w-4" />
                  {f.title}
                </button>
              ))}
            </div>

            {/* FEATURE DETAIL */}
            <div className="p-6 sm:p-8 bg-[#0d1117]">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-lg font-bold text-white mb-3">{active.title}</h3>
                  <p className="text-sm text-white/60 leading-relaxed mb-4">{active.desc}</p>
                  <Link href="/builder" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-sm font-medium transition-colors">
                    Try {active.title} <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
                <div className="p-4 rounded-xl bg-black/30 border border-white/5">
                  <p className="text-xs font-semibold text-white/30 uppercase tracking-wider mb-3">Demo Walkthrough</p>
                  <p className="text-sm text-white/60 font-mono leading-relaxed">{active.transcript}</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* BOOK A DEMO */}
        <section className="max-w-3xl mx-auto px-4 sm:px-6 py-16">
          <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-8 sm:p-10">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold mb-3">Want a live walkthrough?</h2>
              <p className="text-white/60">Book a 30-minute demo with the Archibald Titan team. We'll walk you through the platform, answer your questions, and help you figure out if it's the right fit.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
              {[
                { icon: Calendar, title: "30 minutes", desc: "Focused, no-fluff demo" },
                { icon: Users, title: "Your use case", desc: "We tailor it to your team" },
                { icon: Check, title: "No sales pressure", desc: "Honest answers only" },
              ].map(({ icon: Icon, title, desc }) => (
                <div key={title} className="text-center p-4 rounded-xl bg-white/5">
                  <Icon className="h-5 w-5 text-blue-400 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-white">{title}</p>
                  <p className="text-xs text-white/50">{desc}</p>
                </div>
              ))}
            </div>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <a href="mailto:demo@archibaldtitan.com" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 font-semibold transition-colors">
                <Mail className="h-4 w-4" /> Book a Demo
              </a>
              <Link href="/builder" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-white/10 hover:border-white/20 text-white/70 hover:text-white transition-colors">
                Try It Yourself <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
'''

pages = {
    "DocsPage": docs_page,
    "HowItWorksPage": how_it_works_page,
    "CustomersPage": customers_page,
    "DemoPage": demo_page,
}

for name, content in pages.items():
    path = os.path.join(BASE, f"{name}.tsx")
    with open(path, "w") as f:
        f.write(content)
    print(f"Written: {path}")

print("Info pages done.")
