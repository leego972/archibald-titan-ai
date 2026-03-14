import { Link } from "wouter";
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
