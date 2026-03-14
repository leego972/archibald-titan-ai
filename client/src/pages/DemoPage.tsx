import { useState } from "react";
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
