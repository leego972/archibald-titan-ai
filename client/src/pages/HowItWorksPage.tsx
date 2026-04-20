import { Link } from "wouter";
import { ArrowRight, MessageSquare, Map, Cpu, Eye, RefreshCw, Rocket, ChevronRight, ShieldAlert } from "lucide-react";
import MarketingLayout from "@/components/MarketingLayout";

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
    <MarketingLayout>

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

        {/* SECURITY OPS MODE */}
          <section className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
            <div className="p-6 sm:p-8 rounded-2xl border border-red-500/20 bg-red-500/[0.03]">
              <div className="flex items-start gap-4">
                <div className="h-10 w-10 rounded-xl bg-red-500/15 flex items-center justify-center shrink-0 mt-0.5">
                  <ShieldAlert className="h-5 w-5 text-red-400" />
                </div>
                <div className="flex-1">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-red-400/60 mb-2">Cyber Tier</p>
                  <h2 className="text-xl sm:text-2xl font-bold text-white mb-3">Security Operations Mode</h2>
                  <p className="text-sm text-white/55 leading-relaxed mb-6">For Cyber tier subscribers, the same six steps drive red team operations — powered by Argus, Astra, Metasploit, and 23 other dedicated security engines.</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
                    {[
                      { n: "01–02", label: "Brief + Plan", desc: 'Describe the target: "Run OSINT and vulnerability scan on target.example.com." Titan scopes the operation — selects engines, scan depth, and report structure.' },
                      { n: "03–04", label: "Scan + Review", desc: "Argus enumerates subdomains and maps the attack surface. Astra cross-references findings against NVD and ExploitDB. Review all findings before any exploitation step." },
                      { n: "05–06", label: "Exploit + Report", desc: "Deep-dive confirmed CVEs with Metasploit, simulate phishing vectors with Evilginx2 or BlackEye, and generate a client-ready executive report from scan output." },
                    ].map(item => (
                      <div key={item.n} className="p-4 rounded-xl bg-black/30 border border-white/5">
                        <p className="text-[10px] font-bold text-red-400/60 uppercase tracking-widest mb-1">Steps {item.n}</p>
                        <p className="text-sm font-semibold text-white mb-2">{item.label}</p>
                        <p className="text-xs text-white/50 leading-relaxed">{item.desc}</p>
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-wrap items-center gap-5">
                    <Link href="/use-cases" className="inline-flex items-center gap-1.5 text-sm text-red-400 hover:text-red-300 font-semibold transition-colors">
                      Security use cases <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                    <Link href="/pricing" className="inline-flex items-center gap-1.5 text-sm text-white/40 hover:text-white/70 font-medium transition-colors">
                      View Cyber tier <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                    <Link href="/demo" className="inline-flex items-center gap-1.5 text-sm text-white/40 hover:text-white/70 font-medium transition-colors">
                      Watch it in action <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
              </div>
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
    </MarketingLayout>
  );
}