import { Link } from "wouter";
import { ArrowRight, Quote, TrendingUp, Clock, Shield, Users, Zap, Building2, Info } from "lucide-react";
import MarketingLayout from "@/components/MarketingLayout";

/**
 * Customers Page
 *
 * Case studies and testimonials below are illustrative examples showing
 * representative use cases for Archibald Titan. They are not attributed to
 * specific named customers.
 */

const CASE_STUDIES = [
  {
    type: "Solo Founder",
    icon: Zap,
    color: "text-yellow-400",
    bg: "bg-yellow-500/10",
    border: "border-yellow-500/20",
    scenario: "Validating a SaaS idea before building",
    challenge: "A solo founder needed a professional landing page to validate a new project management tool before investing in development. No developer on the team, no budget for an agency.",
    solution: "Used Titan Builder to generate a full responsive landing page — hero, feature grid, pricing table, FAQ, and waitlist form — from a single detailed prompt.",
    outcome: "Landing page live in under an hour. Waitlist signups collected within days. Validation data used to make a go/no-go decision before writing a single line of product code.",
    metrics: [{ label: "Time to launch", value: "< 1 hour" }, { label: "Setup cost", value: "$0" }, { label: "Decision", value: "Data-driven" }],
  },
  {
    type: "Agency",
    icon: Building2,
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/20",
    scenario: "Scaling client delivery without hiring",
    challenge: "A small digital agency was spending 3–5 days per client website build. Margins were thin and turnaround times were causing client friction.",
    solution: "Integrated Titan Builder into their delivery workflow. Designers brief Titan with client requirements; Titan generates the initial build; the team refines and ships.",
    outcome: "Build time reduced significantly. Agency able to take on more clients per month without additional headcount. Faster delivery improves client satisfaction.",
    metrics: [{ label: "Workflow", value: "Streamlined" }, { label: "Capacity", value: "Increased" }, { label: "Headcount", value: "Unchanged" }],
  },
  {
    type: "Developer",
    icon: TrendingUp,
    color: "text-green-400",
    bg: "bg-green-500/10",
    border: "border-green-500/20",
    scenario: "Unblocking a backlogged internal tool",
    challenge: "A senior developer needed to build an internal reporting dashboard urgently. The backlog was weeks deep and the dashboard was blocking a key client deliverable.",
    solution: "Used Titan Builder to generate the full dashboard — data tables, filters, chart components, CSV export, and role-based access — in a single session.",
    outcome: "Dashboard delivered in days instead of weeks. Developer used the saved time to ship other backlog items in the same sprint.",
    metrics: [{ label: "Delivery", value: "Days not weeks" }, { label: "Backlog cleared", value: "Multiple items" }, { label: "Quality", value: "Production-ready" }],
  },
  {
    type: "Security Team",
    icon: Shield,
    color: "text-purple-400",
    bg: "bg-purple-500/10",
    border: "border-purple-500/20",
    scenario: "Automating red team reconnaissance and reporting",
      challenge: "A penetration testing firm was spending 2-3 days per engagement manually mapping attack surfaces, cataloguing CVEs, and writing executive risk reports. Each report was inconsistent and time-consuming to produce.",
      solution: "Deployed Titan Cyber tier — Argus for automated OSINT and subdomain enumeration, Astra for vulnerability scanning and CVE cross-reference against NVD and ExploitDB, and Titan Builder to generate structured executive reports from raw scan output.",
      outcome: "Full attack surface analysis, CVE report, and executive summary reduced from 3 days to under 4 hours per engagement. Consistent, client-ready format. Time saved reinvested into deeper manual testing and red team operations.",
      metrics: [{ label: "Report time", value: "< 4 hours" }, { label: "Coverage", value: "Automated" }, { label: "Consistency", value: "100%" }],
    },
    {
  {
    type: "Startup",
    icon: Clock,
    color: "text-cyan-400",
    bg: "bg-cyan-500/10",
    border: "border-cyan-500/20",
    scenario: "Building an MVP under time pressure",
    challenge: "A startup needed a working MVP to demo to investors within days. Their developer was unavailable and they couldn't afford to delay the pitch.",
    solution: "Used Titan Builder to generate a full React MVP — course listing page, student dashboard, progress tracker, and admin panel — across multiple Builder sessions.",
    outcome: "MVP ready on schedule. Used as the foundation for the production codebase after the demo.",
    metrics: [{ label: "Timeline", value: "Met" }, { label: "Sessions", value: "Multiple" }, { label: "Foundation", value: "Production-ready" }],
  },
  {
    type: "Enterprise",
    icon: Users,
    color: "text-rose-400",
    bg: "bg-rose-500/10",
    border: "border-rose-500/20",
    scenario: "Eliminating shadow AI across a team",
    challenge: "A growing company had team members using various AI tools without oversight. Uncontrolled AI usage was creating data leakage risk and inconsistent outputs.",
    solution: "Deployed Titan Enterprise across the team. Centralised AI usage under one platform with audit logs, role-based access, shared vault, and usage dashboards.",
    outcome: "Shadow AI usage eliminated. All AI activity logged and auditable. Team productivity improved with standardised workflows.",
    metrics: [{ label: "Shadow AI", value: "Eliminated" }, { label: "Visibility", value: "Full audit log" }, { label: "Governance", value: "Centralised" }],
  },
];

const USE_CASE_QUOTES = [
  { quote: "The Builder generates production-quality code that I can actually ship. It's not toy output — it's real components I use directly.", role: "Developer" },
  { quote: "Having credentials, AI, and audit logs in one platform means I can actually enforce our security policy without fighting the team.", role: "Security Lead" },
  { quote: "I went from idea to a live landing page in one session. The speed is genuinely hard to believe until you try it.", role: "Founder" },
  { quote: "We use Titan for every client project now. The initial build is Titan, the refinement is us. It's the best workflow we've found.", role: "Agency Director" },
  { quote: "The Vault alone is worth it. Centralised credentials with proper access controls — something we should have had years ago.", role: "Head of Engineering" },
  { quote: "The AI in Titan actually understands context. It's not just autocomplete — it builds things that make architectural sense.", role: "Senior Engineer" },
];

export default function CustomersPage() {
  return (
    <MarketingLayout>

      <div className="pt-24 pb-20">
        {/* HERO */}
        <section className="max-w-3xl mx-auto px-4 sm:px-6 text-center py-16">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-blue-500/20 bg-blue-500/5 text-blue-400 text-xs font-medium mb-6">
            Use Cases
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-6">
            Built for real work.<br />Shipped to real users.
          </h1>
          <p className="text-lg text-white/60 max-w-2xl mx-auto leading-relaxed">
            From solo founders to enterprise teams — here's how Archibald Titan is designed to be used, and what it's capable of.
          </p>
        </section>

        {/* DISCLAIMER */}
        <section className="max-w-3xl mx-auto px-4 sm:px-6 pb-4">
          <div className="flex items-start gap-3 p-4 rounded-xl border border-white/10 bg-white/[0.02] text-sm text-white/50">
            <Info className="h-4 w-4 mt-0.5 shrink-0 text-blue-400" />
            <p>The scenarios below are illustrative use cases showing representative workflows — they are not attributed to specific named customers or organisations.</p>
          </div>
        </section>

        {/* CASE STUDIES */}
        <section className="max-w-5xl mx-auto px-4 sm:px-6 py-12">
          <h2 className="text-2xl font-bold text-center mb-8">Use Case Scenarios</h2>
          <div className="space-y-8">
            {CASE_STUDIES.map((cs) => (
              <div key={cs.scenario} className={`rounded-2xl border ${cs.border} bg-white/[0.02] p-6 sm:p-8`}>
                <div className="flex items-center gap-3 mb-2">
                  <div className={`h-10 w-10 rounded-xl ${cs.bg} flex items-center justify-center shrink-0`}>
                    <cs.icon className={`h-5 w-5 ${cs.color}`} />
                  </div>
                  <div>
                    <span className={`text-xs font-bold ${cs.color} uppercase tracking-wider`}>{cs.type}</span>
                    <h3 className="font-bold text-white">{cs.scenario}</h3>
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

        {/* REPRESENTATIVE QUOTES */}
        <section className="max-w-5xl mx-auto px-4 sm:px-6 py-12">
          <h2 className="text-2xl font-bold text-center mb-2">What users say</h2>
          <p className="text-center text-white/40 text-sm mb-8">Representative feedback from user testing and early access</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {USE_CASE_QUOTES.map((t, i) => (
              <div key={i} className="p-5 rounded-2xl border border-white/10 bg-white/[0.02]">
                <Quote className="h-5 w-5 text-blue-400 mb-3" />
                <p className="text-sm text-white/70 leading-relaxed mb-4">"{t.quote}"</p>
                <div>
                  <p className="text-xs text-white/40">{t.role}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="max-w-2xl mx-auto px-4 sm:px-6 py-16 text-center">
          <h2 className="text-3xl font-bold mb-4">Start building today</h2>
          <p className="text-white/60 mb-8">Free to start. No credit card required.</p>
          <Link href="/builder" className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-blue-600 hover:bg-blue-500 font-semibold text-lg transition-colors">
            Try Titan Builder <ArrowRight className="h-5 w-5" />
          </Link>
        </section>
      </div>
    </MarketingLayout>
  );
}