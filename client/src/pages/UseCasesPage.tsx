import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { getLoginUrl } from "@/const";
import MarketingLayout from "@/components/MarketingLayout";
import {
  Rocket, Code2, Users, Building2, FileCode, LayoutDashboard,
  Globe, Zap, ArrowRight, CheckCircle2, ChevronDown, ChevronUp,
  Layers, BookOpen, Target, Menu, X, Star, ShieldAlert,
} from "lucide-react";

const USE_CASES = [
  {
    id: "founders",
    icon: Rocket,
    audience: "Founders & Solo Builders",
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/20",
    tagline: "Go from idea to working product without a full team.",
    desc: "Titan Builder lets you move from concept to launch-ready output in hours, not weeks. Generate landing pages, business plans, MVPs, and pitch decks — all from plain-language briefs.",
    outputs: [
      "Launch-ready landing page with hero, features, pricing, and CTA",
      "Business plan with market analysis and financial model",
      "MVP prototype with real UI and routing",
      "Investor pitch deck structure and narrative",
      "Go-to-market strategy document",
    ],
    example: {
      brief: "Build me a landing page for a B2B SaaS tool that helps law firms track billable hours",
      output: "Full HTML/CSS landing page — hero, feature grid, social proof, pricing table, FAQ, CTA. Responsive, dark mode, ready to deploy.",
    },
  },
  {
    id: "developers",
    icon: Code2,
    audience: "Developers",
    color: "text-purple-400",
    bg: "bg-purple-500/10",
    border: "border-purple-500/20",
    tagline: "Accelerate development without giving up technical control.",
    desc: "Generate boilerplate, scaffold projects, write automation scripts, and prototype integrations — all in a sandboxed environment where you review and own every line of output.",
    outputs: [
      "TypeScript/Python project scaffolds with full structure",
      "REST API boilerplate with auth, routing, and DB schema",
      "Automation scripts for data processing and API integrations",
      "Database migration files and seed scripts",
      "Docker and CI/CD configuration files",
    ],
    example: {
      brief: "Scaffold a Node.js REST API with JWT auth, PostgreSQL, and rate limiting",
      output: "Full project structure: routes, middleware, models, migrations, .env template, README, and Dockerfile.",
    },
  },
  {
    id: "agencies",
    icon: Users,
    audience: "Agencies & Freelancers",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/20",
    tagline: "Deliver client work faster with higher margins.",
    desc: "Clone, adapt, and ship web assets and internal tools with better turnaround. Use Titan Builder to produce first drafts, iterate with clients, and export production-ready outputs.",
    outputs: [
      "Client landing pages and marketing sites",
      "Internal tools and admin dashboards",
      "Brand voice documents and content guidelines",
      "Proposal and SOW templates",
      "SEO content briefs and article outlines",
    ],
    example: {
      brief: "Build an internal tool for a restaurant chain to manage shift scheduling across 12 locations",
      output: "Admin dashboard with location selector, shift calendar, staff roster, and export to CSV. React + Tailwind, fully editable.",
    },
  },
  {
    id: "enterprise",
    icon: Building2,
    audience: "Enterprise & Security-Sensitive Teams",
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
    tagline: "Use AI without exposing sensitive workflows to the cloud.",
    desc: "Titan's local-first architecture means your prompts, credentials, and outputs never leave your environment unless you choose. Enterprise plans add RBAC, audit logs, and SSO.",
    outputs: [
      "Internal policy and procedure documents",
      "Compliance checklists and audit templates",
      "Data processing agreements and privacy notices",
      "Internal tooling with RBAC and audit trail",
      "Secure credential management workflows",
    ],
    example: {
      brief: "Generate a GDPR data processing agreement template for a healthcare SaaS company",
      output: "Full DPA document with all required GDPR clauses, controller/processor definitions, data categories, retention schedules, and sub-processor list.",
    },
  },
  {
    id: "internal-tools",
    icon: LayoutDashboard,
    audience: "Operations & Internal Tools",
    color: "text-cyan-400",
    bg: "bg-cyan-500/10",
    border: "border-cyan-500/20",
    tagline: "Build the tools your team actually needs.",
    desc: "Stop waiting for engineering bandwidth. Titan Builder produces functional internal tools — dashboards, CRUD interfaces, reporting views, and operational panels — that your team can use immediately.",
    outputs: [
      "Operations dashboards with real data structures",
      "CRUD admin panels for internal databases",
      "Reporting views and data export tools",
      "Onboarding checklists and workflow trackers",
      "Internal knowledge base templates",
    ],
    example: {
      brief: "Build a dashboard for tracking customer support ticket volume and resolution time by agent",
      output: "React dashboard with date range picker, agent performance table, ticket volume chart, and CSV export. Connects to your existing data source.",
    },
  },
  {
    id: "content",
    icon: BookOpen,
    audience: "Content & Documentation",
    color: "text-rose-400",
    bg: "bg-rose-500/10",
    border: "border-rose-500/20",
    tagline: "Produce structured, professional documents at scale.",
    desc: "From product documentation to business plans, Titan Builder produces structured, editable documents that follow professional formats — not just raw text dumps.",
    outputs: [
      "Product requirements documents (PRDs)",
      "Technical architecture documents",
      "User documentation and help centre articles",
      "Business plans with financial models",
      "Grant applications and funding proposals",
    ],
    example: {
      brief: "Write a PRD for a mobile app that helps users track their daily water intake",
      output: "Full PRD: problem statement, user personas, functional requirements, non-functional requirements, user stories, acceptance criteria, and success metrics.",
      },
    },
    {
      id: "red-team",
      icon: ShieldAlert,
      audience: "Red Teams & Security Researchers",
      color: "text-red-400",
      bg: "bg-red-500/10",
      border: "border-red-500/20",
      tagline: "A complete offensive security platform with full auditability.",
      desc: "Titan gives security professionals a managed, sandboxed environment for red team operations — from OSINT and attack surface mapping through exploitation, phishing simulation, and automated compliance reporting.",
      outputs: [
        "Attack surface analysis (Argus deep scan + visualisation)",
        "Vulnerability chain report (Astra CVE detection + staging)",
        "Phishing campaign setup (BlackEye + Evilginx2 templates)",
        "Red Team Playbook from target profile brief",
        "Automated compliance report (SOC 2 / ISO 27001)",
      ],
      example: {
        brief: "Run a full attack surface analysis on target.example.com and produce an executive summary",
        output: "Argus discovers 347 subdomains, flags 12 exposed services, confirms 3 critical CVEs. Executive report with risk ratings and a prioritised remediation roadmap.",
      },
    },
  ];

export default function UseCasesPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeCase, setActiveCase] = useState("founders");
  const active = USE_CASES.find(u => u.id === activeCase) || USE_CASES[0];
  const Icon = active.icon;

  return (
    <MarketingLayout>

      {/* HERO */}
      <section className="relative pt-32 pb-16 sm:pt-40 sm:pb-24">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[500px] bg-blue-600/8 rounded-full blur-[130px]" />
        </div>
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-blue-500/20 bg-blue-500/5 mb-8">
            <Target className="h-3.5 w-3.5 text-blue-400" />
            <span className="text-xs font-medium text-blue-300">Use Cases</span>
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-[1.05]">
            <span className="text-white">What people build</span><br />
            <span className="bg-gradient-to-r from-blue-400 via-blue-500 to-indigo-500 bg-clip-text text-transparent">with Titan Builder.</span>
          </h1>
          <p className="mt-6 text-lg sm:text-xl text-white/50 max-w-2xl mx-auto leading-relaxed">
            From solo founders shipping their first product to enterprise teams building internal tools — here is how different people use Titan Builder to get real work done.
          </p>
        </div>
      </section>

      {/* INTERACTIVE USE CASE EXPLORER */}
      <section className="relative py-16 sm:py-24">
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Selector */}
            <div className="lg:col-span-1 space-y-2">
              {USE_CASES.map((uc) => {
                const UCIcon = uc.icon;
                const isActive = activeCase === uc.id;
                return (
                  <button
                    key={uc.id}
                    onClick={() => setActiveCase(uc.id)}
                    className={`w-full flex items-center gap-3 p-4 rounded-xl border text-left transition-all duration-200 ${isActive ? `${uc.border} ${uc.bg}` : "border-white/5 bg-white/[0.02] hover:bg-white/[0.04]"}`}
                  >
                    <UCIcon className={`h-5 w-5 shrink-0 ${isActive ? uc.color : "text-white/30"}`} />
                    <div>
                      <div className={`text-sm font-semibold ${isActive ? "text-white" : "text-white/60"}`}>{uc.audience}</div>
                      {isActive && <div className="text-xs text-white/40 mt-0.5">{uc.tagline}</div>}
                    </div>
                  </button>
                );
              })}
            </div>
            {/* Detail */}
            <div className="lg:col-span-2 space-y-5">
              <div className={`p-6 rounded-2xl border ${active.border} ${active.bg}`}>
                <div className="flex items-center gap-3 mb-4">
                  <div className={`p-2.5 rounded-xl bg-white/5`}>
                    <Icon className={`h-6 w-6 ${active.color}`} />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white">{active.audience}</h2>
                    <p className={`text-sm ${active.color}`}>{active.tagline}</p>
                  </div>
                </div>
                <p className="text-sm text-white/60 leading-relaxed mb-5">{active.desc}</p>
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">What you can produce</p>
                  {active.outputs.map((o) => (
                    <div key={o} className="flex items-start gap-2 text-sm text-white/70">
                      <CheckCircle2 className={`h-4 w-4 ${active.color} shrink-0 mt-0.5`} />{o}
                    </div>
                  ))}
                </div>
              </div>
              <div className="p-6 rounded-2xl border border-white/5 bg-white/[0.02]">
                <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-4">Example</p>
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-white/30 mb-1">Brief</p>
                    <p className="text-sm text-white/70 italic leading-relaxed">&ldquo;{active.example.brief}&rdquo;</p>
                  </div>
                  <div className="h-px bg-white/5" />
                  <div>
                    <p className="text-xs text-white/30 mb-1">Output</p>
                    <p className="text-sm text-white/70 leading-relaxed">{active.example.output}</p>
                  </div>
                </div>
              </div>
              <div className="flex gap-3">
                <Link href="/builder">
                  <Button className="bg-blue-600 hover:bg-blue-500 text-white border-0 gap-2">
                    <Zap className="h-4 w-4" /> Try Titan Builder
                  </Button>
                </Link>
                <Link href="/examples">
                  <Button variant="outline" className="border-white/10 bg-white/5 hover:bg-white/10 text-white gap-2">
                    See More Examples <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}