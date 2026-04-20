import { Link } from "wouter";
import { AT_ICON_64, FULL_LOGO_256 } from "@/lib/logos";
import { Button } from "@/components/ui/button";
import { getLoginUrl } from "@/const";
import {
import MarketingLayout from "@/components/MarketingLayout";
  Shield, Zap, Globe, Users, ArrowRight, CheckCircle2,
  Mail, Github, Twitter, Lock, HardDrive, Cpu,
} from "lucide-react";

export default function AboutPage() {
  const values = [
    { icon: HardDrive, title: "Local-first", desc: "Your data stays on your machine by default. We build for privacy, not convenience.", color: "text-blue-400", bg: "bg-blue-500/10" },
    { icon: Shield, title: "Security without compromise", desc: "AES-256 encryption, sandboxed execution, and zero-knowledge vault design.", color: "text-emerald-400", bg: "bg-emerald-500/10" },
    { icon: Zap, title: "Outcomes over features", desc: "We measure success by what users ship, not by how many features we add.", color: "text-amber-400", bg: "bg-amber-500/10" },
    { icon: Globe, title: "Built for real work", desc: "Every feature is designed to produce something useful — not just impressive demos.", color: "text-purple-400", bg: "bg-purple-500/10" },
  ];

  const milestones = [
    { year: "2023", event: "Archibald Titan founded — initial focus on secure credential management for developers." },
    { year: "Q1 2024", event: "Titan Builder launched in private beta — AI-powered build environment for founders and developers." },
    { year: "Q2 2024", event: "Marketplace launched — community-built tools and integrations." },
    { year: "Q3 2024", event: "Enterprise tier launched — RBAC, audit logs, SSO, and on-premise deployment." },
    { year: "Q4 2024", event: "2,400+ active users. 50,000+ builds completed. 15+ integrations." },
    { year: "2025", event: "Titan cyber tools, AI content studio, and advertising automation added to platform." },
  ];

  return (
    <MarketingLayout>
      {/* NAV */}

      {/* HERO */}
      <section className="relative pt-32 pb-16 sm:pt-40 sm:pb-24">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[400px] bg-blue-600/8 rounded-full blur-[130px]" />
        </div>
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="flex justify-center mb-8">
            <img src={FULL_LOGO_256} alt="Archibald Titan" className="h-24 w-24 object-contain drop-shadow-[0_0_30px_rgba(59,130,246,0.3)]" />
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-[1.05]">
            <span className="text-white">We build tools for people</span><br />
            <span className="bg-gradient-to-r from-blue-400 via-blue-500 to-indigo-500 bg-clip-text text-transparent">who build things.</span>
          </h1>
          <p className="mt-6 text-lg sm:text-xl text-white/50 max-w-2xl mx-auto leading-relaxed">
            Archibald Titan is a local-first AI platform for founders, developers, and teams who need to build fast without compromising on security or control.
          </p>
        </div>
      </section>

      {/* MISSION */}
      <section className="relative py-16 sm:py-24">
        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="p-8 rounded-2xl border border-blue-500/20 bg-blue-500/[0.03]">
            <p className="text-sm font-semibold text-blue-400 uppercase tracking-widest mb-4">Our Mission</p>
            <p className="text-xl sm:text-2xl font-medium text-white leading-relaxed">
              To give every founder, developer, and team access to an AI build environment that is powerful enough to produce real work, and secure enough to trust with sensitive workflows.
            </p>
          </div>
        </div>
      </section>

      {/* VALUES */}
      <section className="relative py-16 sm:py-24">
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <span className="text-sm font-semibold text-blue-400 tracking-widest uppercase">What we stand for</span>
            <h2 className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight">Our values</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {values.map((v) => (
              <div key={v.title} className="p-6 rounded-2xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] transition-all">
                <div className={`inline-flex p-2.5 rounded-xl ${v.bg} mb-4`}>
                  <v.icon className={`h-5 w-5 ${v.color}`} />
                </div>
                <h3 className="text-base font-semibold text-white mb-2">{v.title}</h3>
                <p className="text-sm text-white/50 leading-relaxed">{v.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TIMELINE */}
      <section className="relative py-16 sm:py-24 bg-white/[0.01]">
        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <span className="text-sm font-semibold text-blue-400 tracking-widest uppercase">History</span>
            <h2 className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight">How we got here</h2>
          </div>
          <div className="space-y-6">
            {milestones.map((m, i) => (
              <div key={i} className="flex gap-5">
                <div className="flex flex-col items-center">
                  <div className="w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0 mt-1.5" />
                  {i < milestones.length - 1 && <div className="w-px flex-1 bg-white/10 mt-2" />}
                </div>
                <div className="pb-6">
                  <p className="text-xs font-bold text-blue-400 mb-1">{m.year}</p>
                  <p className="text-sm text-white/60 leading-relaxed">{m.event}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* STATS */}
      <section className="relative py-16 sm:py-20">
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-5">
            {[
              { value: "2,400+", label: "Active users" },
              { value: "50k+", label: "Builds completed" },
              { value: "15+", label: "Integrations" },
              { value: "4.9/5", label: "Average rating" },
            ].map((s) => (
              <div key={s.label} className="p-5 rounded-2xl border border-white/5 bg-white/[0.02] text-center">
                <div className="text-2xl sm:text-3xl font-black text-white mb-1">{s.value}</div>
                <div className="text-xs text-white/40">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CONTACT */}
      <section className="relative py-16 sm:py-24">
        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">Get in touch</h2>
          <p className="text-white/50 mb-8 max-w-xl mx-auto">Have a question, partnership inquiry, or want to discuss enterprise deployment? We would love to hear from you.</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/contact">
              <Button size="lg" className="bg-blue-600 hover:bg-blue-500 text-white border-0 h-12 px-8 gap-2">
                <Mail className="h-4 w-4" /> Contact Us
              </Button>
            </Link>
            <Link href="/pricing">
              <Button size="lg" variant="outline" className="border-white/10 bg-white/5 hover:bg-white/10 text-white h-12 px-8 gap-2">
                View Pricing <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* FOOTER */}
    </MarketingLayout>
  );
}