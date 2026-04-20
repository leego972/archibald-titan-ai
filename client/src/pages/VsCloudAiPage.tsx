import { Link } from "wouter";
import { Check, ArrowRight, Shield, Lock, Globe, Cpu } from "lucide-react";
import { AT_ICON_64 } from "@/lib/logos";
import MarketingLayout from "@/components/MarketingLayout";

const TABLE_ROWS = [
  { feature: "Data handling", titan: "Local-first — never sent to third-party servers", cloud: "Sent to OpenAI/Anthropic/Google servers" },
  { feature: "Output type", titan: "Structured, deployable outputs (pages, tools, docs)", cloud: "Raw text responses requiring manual implementation" },
  { feature: "Credential vault", titan: "Built-in encrypted vault", cloud: "None" },
  { feature: "Enterprise governance", titan: "Audit logs, team vault, role controls", cloud: "Limited (ChatGPT Enterprise only)" },
  { feature: "Sandbox testing", titan: "Yes — test outputs before shipping", cloud: "No" },
  { feature: "Marketplace", titan: "Bot & tool marketplace", cloud: "No" },
  { feature: "Offline capability", titan: "Yes — desktop app", cloud: "No" },
  { feature: "Compliance controls", titan: "Data residency, audit trail, access controls", cloud: "Varies — limited for most plans" },
  { feature: "Structured workflows", titan: "Plan → Generate → Edit → Test → Ship", cloud: "Single-turn or multi-turn chat only" },
  { feature: "Pricing", titan: "Free · Pro $29/mo · Enterprise $99/mo · Cyber $199/mo", cloud: "$20/mo (ChatGPT Plus), $25/mo (Claude Pro)" },
  { feature: "Offensive security toolkit", titan: "26 integrated security tools (Metasploit, Evilginx, BlackEye, Astra, Argus...)", cloud: "None" },
    { feature: "AI model", titan: "Titan Crucible (security-domain fine-tuned)", cloud: "Generic reasoning model (GPT-4o / Claude 3.5 / Gemini)" },
  ];

export default function VsCloudAiPage() {
  return (
    <MarketingLayout>

      <div className="pt-24 pb-20">
        <section className="max-w-4xl mx-auto px-4 sm:px-6 text-center py-16">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-blue-500/20 bg-blue-500/5 text-blue-400 text-xs font-medium mb-6">
            Titan Builder vs Cloud AI Tools
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-6">
            Titan Builder vs<br />
            <span className="text-white/40">ChatGPT, Claude & Gemini</span>
          </h1>
          <p className="text-lg text-white/60 max-w-2xl mx-auto leading-relaxed">
            Cloud AI tools give you text. Titan Builder gives you working, deployable outputs — with your data staying local and your workflow structured from prompt to ship.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-8">
            <Link href="/builder" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 font-semibold transition-colors">
              Try Titan Builder Free <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/security" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-white/10 hover:border-white/20 text-white/70 hover:text-white transition-colors">
              Read Security Details
            </Link>
          </div>
        </section>

        <section className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-6 rounded-2xl border border-blue-500/20 bg-blue-500/5">
              <div className="flex items-center gap-3 mb-4">
                <img src={AT_ICON_64} alt="Titan" className="h-10 w-10 object-contain" />
                <div>
                  <h3 className="font-bold text-white">Titan Builder</h3>
                  <p className="text-xs text-white/50">Best for: Security-conscious builders</p>
                </div>
              </div>
              <ul className="space-y-2">
                {["Local-first — your data never leaves your machine","Structured outputs: pages, tools, docs, plans","Built-in vault, sandbox, and governance controls","Audit logs and team access controls","Deployable outputs — not just text to copy-paste"].map(p => (
                  <li key={p} className="flex items-start gap-2 text-sm text-white/70">
                    <Check className="h-4 w-4 text-green-400 shrink-0 mt-0.5" />{p}
                  </li>
                ))}
              </ul>
            </div>
            <div className="p-6 rounded-2xl border border-white/10 bg-white/[0.02]">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-10 w-10 rounded-lg bg-white/10 flex items-center justify-center">
                  <Globe className="h-5 w-5 text-white/60" />
                </div>
                <div>
                  <h3 className="font-bold text-white">ChatGPT / Claude / Gemini</h3>
                  <p className="text-xs text-white/50">Best for: General text generation</p>
                </div>
              </div>
              <ul className="space-y-2">
                {["Raw text responses — you implement manually","Data sent to third-party servers","No vault, sandbox, or governance controls","No structured build workflow","$20–$25/mo with limited enterprise controls"].map(p => (
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

        <section className="max-w-5xl mx-auto px-4 sm:px-6 py-12">
          <h2 className="text-2xl font-bold text-center mb-8">Feature-by-Feature Comparison</h2>
          <div className="rounded-2xl border border-white/10 overflow-hidden">
            <div className="grid grid-cols-3 bg-white/5 px-6 py-3 text-xs font-semibold text-white/50 uppercase tracking-wider">
              <span>Feature</span>
              <span className="text-blue-400">Titan Builder</span>
              <span>Cloud AI Tools</span>
            </div>
            {TABLE_ROWS.map((row, i) => (
              <div key={i} className={`grid grid-cols-3 px-6 py-4 gap-4 border-t border-white/5 ${i % 2 === 0 ? "" : "bg-white/[0.01]"}`}>
                <span className="text-sm text-white/60 font-medium">{row.feature}</span>
                <span className="text-sm text-white/80">{row.titan}</span>
                <span className="text-sm text-white/50">{row.cloud}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
          <h2 className="text-2xl font-bold text-center mb-8">Why local-first matters</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { icon: Shield, title: "Your data stays yours", desc: "When you use ChatGPT or Claude, your prompts and context are processed on their servers. With Titan, your workflow runs locally — nothing is shared externally." },
              { icon: Lock, title: "Enterprise-grade controls", desc: "Titan includes audit logs, team vault, role-based access, and data residency controls. Cloud AI tools offer these only on expensive enterprise tiers, if at all." },
              { icon: Cpu, title: "Structured outputs, not text", desc: "Cloud AI gives you text to copy-paste and implement yourself. Titan gives you working pages, tools, and documents — ready to use or deploy." },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="p-6 rounded-2xl border border-white/10 bg-white/[0.02]">
                <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center mb-4">
                  <Icon className="h-5 w-5 text-blue-400" />
                </div>
                <h3 className="font-bold text-white mb-2">{title}</h3>
                <p className="text-sm text-white/50 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="max-w-2xl mx-auto px-4 sm:px-6 py-16 text-center">
          <h2 className="text-3xl font-bold mb-4">Build with AI — without the data risk.</h2>
          <p className="text-white/60 mb-8">Titan Builder gives you the power of AI with the security of local-first. Start free today.</p>
          <Link href="/builder" className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-blue-600 hover:bg-blue-500 font-semibold text-lg transition-colors">
            Start Building Free <ArrowRight className="h-5 w-5" />
          </Link>
        </section>
      </div>
    </MarketingLayout>
  );
}