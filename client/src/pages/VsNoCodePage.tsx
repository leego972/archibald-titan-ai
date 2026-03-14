import { Link } from "wouter";
import { Check, X, ArrowRight, Code2, Zap, Layers, Globe } from "lucide-react";
import { AT_ICON_64 } from "@/lib/logos";

const TABLE_ROWS = [
  { feature: "How you build", titan: "Describe in plain English — AI generates the output", nocode: "Drag-and-drop visual editor" },
  { feature: "Code ownership", titan: "Full — export clean code you own", nocode: "Locked to platform (Webflow/Bubble/Framer)" },
  { feature: "Customisation depth", titan: "Unlimited — AI generates any structure you describe", nocode: "Limited to available components and templates" },
  { feature: "Speed to first output", titan: "Minutes from prompt to working page", nocode: "Hours to days depending on complexity" },
  { feature: "Non-developer use", titan: "Yes — plain English prompts", nocode: "Yes — visual editor" },
  { feature: "Data handling", titan: "Local-first — stays on your machine", nocode: "Hosted on vendor servers" },
  { feature: "Internal tools", titan: "Yes — full-stack tool generation", nocode: "Limited (Bubble) or not supported (Webflow/Framer)" },
  { feature: "Business docs & plans", titan: "Yes — generates docs, plans, briefs", nocode: "No" },
  { feature: "Credential vault", titan: "Built-in encrypted vault", nocode: "None" },
  { feature: "Pricing", titan: "Free starter, Pro $29/mo, Enterprise $99/mo", nocode: "$14–$212/mo (Webflow), $29–$529/mo (Bubble)" },
];

export default function VsNoCodePage() {
  return (
    <div className="min-h-screen bg-[#060611] text-white">
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-[#060611]/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <img src={AT_ICON_64} alt="AT" className="h-9 w-9 object-contain" />
            <span className="text-lg font-bold tracking-tight">Archibald Titan</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/pricing" className="text-sm text-white/60 hover:text-white transition-colors hidden sm:block">Pricing</Link>
            <Link href="/builder" className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-sm font-medium transition-colors">Start Building</Link>
          </div>
        </div>
      </nav>

      <div className="pt-24 pb-20">
        <section className="max-w-4xl mx-auto px-4 sm:px-6 text-center py-16">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-blue-500/20 bg-blue-500/5 text-blue-400 text-xs font-medium mb-6">
            Titan Builder vs No-Code Tools
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-6">
            Titan Builder vs<br />
            <span className="text-white/40">Webflow, Bubble & Framer</span>
          </h1>
          <p className="text-lg text-white/60 max-w-2xl mx-auto leading-relaxed">
            No-code tools let you build visually. Titan Builder lets you build by describing what you want — and hands you code you actually own.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-8">
            <Link href="/builder" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 font-semibold transition-colors">
              Try Titan Builder Free <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/examples" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-white/10 hover:border-white/20 text-white/70 hover:text-white transition-colors">
              See Examples
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
                  <p className="text-xs text-white/50">Best for: Founders, developers, agencies</p>
                </div>
              </div>
              <ul className="space-y-2">
                {["Describe it — AI builds it in minutes","Export clean code you own forever","Builds websites, tools, docs, and business assets","Local-first — your data stays private","From $29/mo with no per-seat pricing"].map(p => (
                  <li key={p} className="flex items-start gap-2 text-sm text-white/70">
                    <Check className="h-4 w-4 text-green-400 shrink-0 mt-0.5" />{p}
                  </li>
                ))}
              </ul>
            </div>
            <div className="p-6 rounded-2xl border border-white/10 bg-white/[0.02]">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-10 w-10 rounded-lg bg-white/10 flex items-center justify-center">
                  <Layers className="h-5 w-5 text-white/60" />
                </div>
                <div>
                  <h3 className="font-bold text-white">Webflow / Bubble / Framer</h3>
                  <p className="text-xs text-white/50">Best for: Visual designers</p>
                </div>
              </div>
              <ul className="space-y-2">
                {["Visual drag-and-drop editor","Code locked to the platform","Limited to website/app templates","Data hosted on vendor servers","$14–$529/mo depending on platform and plan"].map(p => (
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
              <span>No-Code Tools</span>
            </div>
            {TABLE_ROWS.map((row, i) => (
              <div key={i} className={`grid grid-cols-3 px-6 py-4 gap-4 border-t border-white/5 ${i % 2 === 0 ? "" : "bg-white/[0.01]"}`}>
                <span className="text-sm text-white/60 font-medium">{row.feature}</span>
                <span className="text-sm text-white/80">{row.titan}</span>
                <span className="text-sm text-white/50">{row.nocode}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
          <h2 className="text-2xl font-bold text-center mb-8">The key difference: you own the output</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { icon: Code2, title: "Export clean code", desc: "Every output Titan generates is yours. Export HTML, CSS, JavaScript, or full project files — no vendor lock-in." },
              { icon: Zap, title: "Faster than drag-and-drop", desc: "Describe a landing page in one sentence. Titan builds it in under 2 minutes. No dragging, no templates, no constraints." },
              { icon: Globe, title: "More than websites", desc: "Titan builds landing pages, internal tools, business plans, API integrations, scripts, and docs. No-code tools build websites." },
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
          <h2 className="text-3xl font-bold mb-4">Stop renting your website. Own it.</h2>
          <p className="text-white/60 mb-8">Titan Builder generates code you own. No monthly platform fees. No lock-in. Start free today.</p>
          <Link href="/builder" className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-blue-600 hover:bg-blue-500 font-semibold text-lg transition-colors">
            Start Building Free <ArrowRight className="h-5 w-5" />
          </Link>
        </section>
      </div>
    </div>
  );
}
