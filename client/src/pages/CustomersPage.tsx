import { Link } from "wouter";
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
