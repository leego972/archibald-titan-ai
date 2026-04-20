import { Link } from "wouter";
import { Check, X, ArrowRight, Shield, Zap, Code2, Lock, Users, Globe } from "lucide-react";
import { AT_ICON_64 } from "@/lib/logos";
import MarketingLayout from "@/components/MarketingLayout";

const TABLE_ROWS = [
  { feature: "Output type", titan: "Full working code, pages, tools, docs", copilot: "Code suggestions & completions" },
  { feature: "Who it's for", titan: "Founders, agencies, developers, teams", copilot: "Developers only" },
  { feature: "Data handling", titan: "Local-first — your data stays on your machine", copilot: "Sent to GitHub/Microsoft servers" },
  { feature: "Non-developer use", titan: "Yes — plain English prompts produce full outputs", copilot: "No — requires coding knowledge" },
  { feature: "Credential vault", titan: "Built-in encrypted vault", copilot: "None" },
  { feature: "Sandbox testing", titan: "Yes — test before shipping", copilot: "No" },
  { feature: "Marketplace", titan: "Bot & tool marketplace included", copilot: "No" },
  { feature: "Enterprise controls", titan: "Audit logs, team vault, role management", copilot: "GitHub Enterprise only" },
  { feature: "Pricing", titan: "Free starter, Pro $29/mo, Enterprise $99/mo", copilot: "$10–$19/mo (individual), $39/mo (enterprise)" },
  { feature: "Offline capability", titan: "Yes — desktop app works offline", copilot: "No" },
    { feature: "Offensive security", titan: "20+ integrated engines (Metasploit, Evilginx, BlackEye, Astra, Argus...)", copilot: "None" },
    { feature: "AI model", titan: "Titan Crucible (security-domain trained)", copilot: "GitHub Copilot (GPT-4o — generic coding model)" },
  ];

export default function VsCopilotPage() {
  return (
    <MarketingLayout>

      <div className="pt-24 pb-20">
        {/* HERO */}
        <section className="max-w-4xl mx-auto px-4 sm:px-6 text-center py-16">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-blue-500/20 bg-blue-500/5 text-blue-400 text-xs font-medium mb-6">
            Titan Builder vs GitHub Copilot
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-6">
            Titan Builder vs<br />
            <span className="text-white/40">GitHub Copilot</span>
          </h1>
          <p className="text-lg text-white/60 max-w-2xl mx-auto leading-relaxed">
            GitHub Copilot helps developers write code faster. Titan Builder helps anyone build complete, working outputs — from landing pages to internal tools — without needing to code at all.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-8">
            <Link href="/builder" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 font-semibold transition-colors">
              Try Titan Builder Free <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/pricing" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-white/10 hover:border-white/20 text-white/70 hover:text-white transition-colors">
              Compare Plans
            </Link>
          </div>
        </section>

        {/* SUMMARY CARDS */}
        <section className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-6 rounded-2xl border border-blue-500/20 bg-blue-500/5">
              <div className="flex items-center gap-3 mb-4">
                <img src={AT_ICON_64} alt="Titan" className="h-10 w-10 object-contain" />
                <div>
                  <h3 className="font-bold text-white">Titan Builder</h3>
                  <p className="text-xs text-white/50">Best for: Everyone who builds</p>
                </div>
              </div>
              <ul className="space-y-2">
                {["Full working outputs — not just code suggestions","Local-first — your data never leaves your machine","No coding required — plain English prompts","Built-in vault, sandbox, marketplace, and security tools","Free to start, $29/mo for full Builder access"].map(p => (
                  <li key={p} className="flex items-start gap-2 text-sm text-white/70">
                    <Check className="h-4 w-4 text-green-400 shrink-0 mt-0.5" />{p}
                  </li>
                ))}
              </ul>
            </div>
            <div className="p-6 rounded-2xl border border-white/10 bg-white/[0.02]">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-10 w-10 rounded-lg bg-white/10 flex items-center justify-center">
                  <Code2 className="h-5 w-5 text-white/60" />
                </div>
                <div>
                  <h3 className="font-bold text-white">GitHub Copilot</h3>
                  <p className="text-xs text-white/50">Best for: Developers in IDEs</p>
                </div>
              </div>
              <ul className="space-y-2">
                {["Inline code suggestions as you type","Requires coding knowledge to use effectively","Data sent to Microsoft/GitHub servers","No vault, sandbox, or marketplace","$10–$19/mo individual, $39/mo enterprise"].map(p => (
                  <li key={p} className="flex items-start gap-2 text-sm text-white/70">
                    <div className="h-4 w-4 shrink-0 mt-0.5 flex items-center justify-center">
                      <div className="h-1.5 w-1.5 rounded-full bg-white/30" />
                    </div>{p}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* COMPARISON TABLE */}
        <section className="max-w-5xl mx-auto px-4 sm:px-6 py-12">
          <h2 className="text-2xl font-bold text-center mb-8">Feature-by-Feature Comparison</h2>
          <div className="rounded-2xl border border-white/10 overflow-hidden">
            <div className="grid grid-cols-3 bg-white/5 px-6 py-3 text-xs font-semibold text-white/50 uppercase tracking-wider">
              <span>Feature</span>
              <span className="text-blue-400">Titan Builder</span>
              <span>GitHub Copilot</span>
            </div>
            {TABLE_ROWS.map((row, i) => (
              <div key={i} className={`grid grid-cols-3 px-6 py-4 gap-4 border-t border-white/5 ${i % 2 === 0 ? "" : "bg-white/[0.01]"}`}>
                <span className="text-sm text-white/60 font-medium">{row.feature}</span>
                <span className="text-sm text-white/80">{row.titan}</span>
                <span className="text-sm text-white/50">{row.copilot}</span>
              </div>
            ))}
          </div>
        </section>

        {/* WHO WINS */}
        <section className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
          <h2 className="text-2xl font-bold text-center mb-8">Which tool is right for you?</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              { title: "Choose Titan Builder if you...", icon: Check, color: "text-green-400", border: "border-green-500/20 bg-green-500/5", items: ["Are a founder, marketer, or agency building web assets","Want complete outputs — not just code completions","Need your data to stay local and private","Want a vault, sandbox, and marketplace in one platform","Are building for non-technical stakeholders"] },
              { title: "Choose Copilot if you...", icon: Code2, color: "text-white/50", border: "border-white/10 bg-white/[0.02]", items: ["Are a developer who lives in VS Code or JetBrains","Only need code suggestions and completions","Are comfortable with data going to Microsoft servers","Already have GitHub Enterprise","Don't need full-stack output generation"] },
            ].map(({ title, icon: Icon, color, border, items }) => (
              <div key={title} className={`p-6 rounded-2xl border ${border}`}>
                <h3 className="font-bold text-white mb-4">{title}</h3>
                <ul className="space-y-2">
                  {items.map(item => (
                    <li key={item} className="flex items-start gap-2 text-sm text-white/70">
                      <Icon className={`h-4 w-4 shrink-0 mt-0.5 ${color}`} />{item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="max-w-2xl mx-auto px-4 sm:px-6 py-16 text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to build more than code?</h2>
          <p className="text-white/60 mb-8">Titan Builder turns your ideas into complete, working outputs. Start free — no credit card required.</p>
          <Link href="/builder" className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-blue-600 hover:bg-blue-500 font-semibold text-lg transition-colors">
            Start Building Free <ArrowRight className="h-5 w-5" />
          </Link>
          <p className="text-sm text-white/30 mt-4">Free plan includes chat. Builder access from $29/mo.</p>
        </section>
      </div>
    </MarketingLayout>
  );
}