import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { getLoginUrl } from "@/const";
import {
import MarketingLayout from "@/components/MarketingLayout";
  Rocket, Code2, FileCode, LayoutDashboard, Settings, BookOpen,
  Globe, Zap, ArrowRight, Copy, CheckCircle2, Menu, X, Layers,
} from "lucide-react";

type Tag = "All" | "Web" | "App" | "Tool" | "Doc" | "Code";

const EXAMPLES = [
  {
    id: 1, tag: "Web" as Tag,
    title: "SaaS Landing Page",
    audience: "Founders",
    icon: Rocket,
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    brief: "Build a landing page for a project management SaaS targeting remote teams",
    output: "Full HTML/CSS page — hero with animated headline, 6-feature grid, social proof strip, 3-tier pricing table, FAQ accordion, and CTA section. Responsive, dark mode, deploy-ready.",
    lines: "~480 lines",
    time: "~45 sec",
  },
  {
    id: 2, tag: "App" as Tag,
    title: "MVP Prototype",
    audience: "Developers",
    icon: Layers,
    color: "text-indigo-400",
    bg: "bg-indigo-500/10",
    brief: "Scaffold a React MVP for a habit tracking app with streaks and reminders",
    output: "React + TypeScript project: 8 components, routing, local state, habit CRUD, streak calculator, reminder logic, and a clean mobile-first UI.",
    lines: "~620 lines",
    time: "~60 sec",
  },
  {
    id: 3, tag: "Tool" as Tag,
    title: "Admin Dashboard",
    audience: "Operations teams",
    icon: LayoutDashboard,
    color: "text-cyan-400",
    bg: "bg-cyan-500/10",
    brief: "Build an admin dashboard for monitoring customer support tickets by agent and priority",
    output: "React dashboard: date range filter, agent performance table with sortable columns, ticket volume bar chart, priority breakdown pie chart, and CSV export.",
    lines: "~390 lines",
    time: "~50 sec",
  },
  {
    id: 4, tag: "Doc" as Tag,
    title: "Business Plan",
    audience: "Founders",
    icon: FileCode,
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    brief: "Write a business plan for a B2B SaaS selling compliance software to law firms",
    output: "12-section document: executive summary, problem/solution, market sizing, competitive analysis, product overview, go-to-market strategy, team, financials (3-year model), risks, and appendix.",
    lines: "~2,800 words",
    time: "~90 sec",
  },
  {
    id: 5, tag: "Code" as Tag,
    title: "Automation Script",
    audience: "Developers",
    icon: Settings,
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    brief: "Write a Python script that pulls data from a Shopify store and syncs it to a Google Sheet",
    output: "Python script with Shopify API client, Google Sheets API integration, incremental sync logic, error handling, retry logic, and .env config template.",
    lines: "~280 lines",
    time: "~35 sec",
  },
  {
    id: 6, tag: "Doc" as Tag,
    title: "Product Requirements Doc",
    audience: "Product teams",
    icon: BookOpen,
    color: "text-rose-400",
    bg: "bg-rose-500/10",
    brief: "Write a PRD for a mobile app that helps users track daily water intake",
    output: "Full PRD: problem statement, user personas, functional requirements, non-functional requirements, user stories with acceptance criteria, success metrics, and out-of-scope items.",
    lines: "~1,900 words",
    time: "~75 sec",
  },
  {
    id: 7, tag: "Web" as Tag,
    title: "Agency Portfolio Site",
    audience: "Agencies",
    icon: Globe,
    color: "text-purple-400",
    bg: "bg-purple-500/10",
    brief: "Build a portfolio site for a digital agency specialising in e-commerce brands",
    output: "Multi-section site: animated hero, services grid, case study cards with hover states, team section, client logo strip, testimonials, and contact form. Responsive, accessible.",
    lines: "~520 lines",
    time: "~55 sec",
  },
  {
    id: 8, tag: "Code" as Tag,
    title: "REST API Scaffold",
    audience: "Developers",
    icon: Code2,
    color: "text-teal-400",
    bg: "bg-teal-500/10",
    brief: "Scaffold a Node.js REST API with JWT auth, PostgreSQL, and rate limiting",
    output: "Full project: Express routes, JWT middleware, PostgreSQL models with Drizzle ORM, migrations, rate limiter, error handler, .env template, Dockerfile, and README.",
    lines: "~740 lines",
    time: "~70 sec",
  },
  {
    id: 9, tag: "Tool" as Tag,
    title: "Internal Shift Scheduler",
    audience: "Operations teams",
    icon: LayoutDashboard,
    color: "text-orange-400",
    bg: "bg-orange-500/10",
    brief: "Build an internal tool for a restaurant chain to manage shift scheduling across 12 locations",
    output: "React admin panel: location selector, weekly shift calendar, staff roster with drag-to-assign, conflict detection, and export to CSV/PDF.",
    lines: "~560 lines",
    time: "~65 sec",
  },
  {
    id: 10, tag: "Doc" as Tag,
    title: "GDPR Data Processing Agreement",
    audience: "Legal / Enterprise",
    icon: FileCode,
    color: "text-slate-400",
    bg: "bg-slate-500/10",
    brief: "Generate a GDPR DPA template for a healthcare SaaS company",
    output: "Full DPA: controller/processor definitions, data categories, processing purposes, retention schedules, sub-processor list, security measures, and breach notification clauses.",
    lines: "~3,200 words",
    time: "~95 sec",
  },
  {
    id: 11, tag: "App" as Tag,
    title: "E-commerce Checkout Flow",
    audience: "Developers",
    icon: Layers,
    color: "text-pink-400",
    bg: "bg-pink-500/10",
    brief: "Build a multi-step checkout flow for a Shopify-style e-commerce store",
    output: "React checkout: cart summary, address form with validation, shipping selector, payment form (Stripe-ready), order confirmation, and mobile-optimised layout.",
    lines: "~430 lines",
    time: "~50 sec",
  },
  {
    id: 12, tag: "Web" as Tag,
    title: "Startup Pitch Deck Page",
    audience: "Founders",
    icon: Rocket,
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    brief: "Build a web-based pitch deck for a fintech startup targeting SME lending",
    output: "12-slide web deck: problem, solution, market size, product demo section, business model, traction, team, financials, and ask. Animated slide transitions, investor-ready design.",
    lines: "~510 lines",
    time: "~60 sec",
  },
];

const TAGS: Tag[] = ["All", "Web", "App", "Tool", "Doc", "Code"];

export default function ExamplesPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeTag, setActiveTag] = useState<Tag>("All");
  const filtered = activeTag === "All" ? EXAMPLES : EXAMPLES.filter(e => e.tag === activeTag);

  return (
    <MarketingLayout>
      {/* NAV */}

      {/* HERO */}
      <section className="relative pt-32 pb-16 sm:pt-40 sm:pb-20">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-blue-600/8 rounded-full blur-[130px]" />
        </div>
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-blue-500/20 bg-blue-500/5 mb-8">
            <Zap className="h-3.5 w-3.5 text-blue-400" />
            <span className="text-xs font-medium text-blue-300">12 real output examples</span>
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-[1.05]">
            <span className="text-white">Real outputs.</span><br />
            <span className="bg-gradient-to-r from-blue-400 via-blue-500 to-indigo-500 bg-clip-text text-transparent">Real briefs.</span>
          </h1>
          <p className="mt-6 text-lg sm:text-xl text-white/50 max-w-2xl mx-auto leading-relaxed">
            Every example below was generated by Titan Builder from a plain-language brief. No templates, no manual editing — just describe what you need and build it.
          </p>
        </div>
      </section>

      {/* FILTER + GRID */}
      <section className="relative py-8 sm:py-12">
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Filter tabs */}
          <div className="flex flex-wrap gap-2 mb-10">
            {TAGS.map((tag) => (
              <button
                key={tag}
                onClick={() => setActiveTag(tag)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${activeTag === tag ? "bg-blue-600 text-white" : "bg-white/5 text-white/50 hover:bg-white/10 hover:text-white"}`}
              >
                {tag}
              </button>
            ))}
          </div>
          {/* Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map((ex) => {
              const Icon = ex.icon;
              return (
                <div key={ex.id} className="group p-5 rounded-2xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/10 transition-all duration-300">
                  <div className="flex items-start justify-between mb-4">
                    <div className={`p-2 rounded-lg ${ex.bg}`}>
                      <Icon className={`h-4 w-4 ${ex.color}`} />
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/5 text-white/40 border border-white/10">{ex.tag}</span>
                  </div>
                  <h3 className="text-sm font-semibold text-white mb-1">{ex.title}</h3>
                  <p className="text-xs text-white/40 mb-4">{ex.audience}</p>
                  <div className="space-y-3 mb-4">
                    <div>
                      <p className="text-[10px] text-white/25 uppercase tracking-wider mb-1">Brief</p>
                      <p className="text-xs text-white/50 italic leading-relaxed">&ldquo;{ex.brief}&rdquo;</p>
                    </div>
                    <div className="h-px bg-white/5" />
                    <div>
                      <p className="text-[10px] text-white/25 uppercase tracking-wider mb-1">Output</p>
                      <p className="text-xs text-white/60 leading-relaxed">{ex.output}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 pt-3 border-t border-white/5">
                    <span className="text-[10px] text-white/30">{ex.lines}</span>
                    <span className="text-white/20">·</span>
                    <span className="text-[10px] text-white/30">{ex.time} to generate</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative py-20 sm:py-28">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-blue-600/8 rounded-full blur-[120px]" />
        </div>
        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Build your first output</h2>
          <p className="mt-4 text-white/50 text-lg max-w-xl mx-auto">Describe what you need. Titan Builder produces a structured, editable, exportable result.</p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/builder">
              <Button size="lg" className="bg-blue-600 hover:bg-blue-500 text-white border-0 shadow-xl shadow-blue-600/25 h-14 px-10 text-base font-semibold gap-3">
                <Zap className="h-5 w-5" /> Open Titan Builder
              </Button>
            </Link>
            <Link href="/use-cases">
              <Button size="lg" variant="outline" className="border-white/10 bg-white/5 hover:bg-white/10 text-white h-12 px-8 text-base">
                Browse Use Cases <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* FOOTER */}
    </MarketingLayout>
  );
}