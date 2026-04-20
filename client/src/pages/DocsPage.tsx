import { useState } from "react";
import { Link } from "wouter";
import { BookOpen, Zap, Key, Shield, Layers, Terminal, ChevronRight, Search, ArrowRight, Code2, Globe, FileText, ShieldAlert } from "lucide-react";
import MarketingLayout from "@/components/MarketingLayout";

const SECTIONS = [
  {
    id: "quickstart",
    icon: Zap,
    title: "Quick Start",
    color: "text-yellow-400",
    bg: "bg-yellow-500/10",
    steps: [
      { n: "1", title: "Create your account", body: "Sign up at archibaldtitan.com. The free Starter plan gives you full chat access immediately — no credit card required." },
      { n: "2", title: "Upgrade to access Builder", body: "Titan Builder is available on Pro ($29/mo) and Enterprise ($99/mo) plans. Navigate to Settings → Billing to upgrade." },
      { n: "3", title: "Open Titan Builder", body: "From your dashboard, click 'Builder' in the sidebar. You'll see the prompt interface where you describe what you want to build." },
      { n: "4", title: "Describe your goal", body: "Type a plain-English description of what you want. Example: \"Build me a SaaS landing page for a project management tool targeting remote teams. Dark theme, pricing section, FAQ, and a waitlist form.\"" },
      { n: "5", title: "Review, edit, and export", body: "Titan generates a full working output. Review it in the sandbox, make edits via follow-up prompts, then export the code or deploy directly." },
    ],
  },
  {
    id: "concepts",
    icon: BookOpen,
    title: "Key Concepts",
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    concepts: [
      { term: "Workspace", def: "Your personal build environment. Each session in Titan Builder is a workspace — a sandboxed context where Titan plans, generates, and iterates on your output." },
      { term: "Credits", def: "Credits are consumed when you run Builder sessions. Starter plan: 500 credits/month (chat only). Pro: 50,000 credits/month. Enterprise: 250,000 credits/month. Cyber: 750,000 credits/month. One typical Builder run uses 50–200 credits depending on complexity." },
      { term: "Vault", def: "The Titan Vault is an encrypted credential store built into your account. Store API keys, passwords, tokens, and sensitive config — Titan can use them in builds without exposing them in plaintext." },
      { term: "Sandbox", def: "Every Builder output is generated in a sandboxed preview environment. You can test, interact with, and iterate on outputs before exporting or deploying them." },
      { term: "Integrations", def: "Titan connects to 15+ external services including GitHub, Vercel, AWS, Stripe, and more. Integrations are configured in Settings → Integrations and can be referenced in Builder prompts." },
      { term: "Marketplace", def: "The Titan Marketplace contains pre-built bots, tools, and automation scripts created by Titan's seller bots. Browse, download, and deploy them directly from your dashboard." },
    ],
  },
  {
      id: "security-tools",
      icon: ShieldAlert,
      title: "Security Tools (Cyber Tier)",
      color: "text-red-400",
      bg: "bg-red-500/10",
      steps: [
        { n: "1", title: "Upgrade to Cyber ($199/mo)", body: "Security tools are available on the Cyber tier. Navigate to Settings → Billing and select the Cyber plan. All tools activate immediately — no configuration required." },
        { n: "2", title: "Access tools from the dashboard", body: "All security engines appear in the dashboard sidebar under 'Cyber Tools': Argus, Astra, Metasploit, BlackEye, Evilginx2, CyberMCP, Attack Graph, VPN Chain, LinkenSphere, and more." },
        { n: "3", title: "Run your first Argus scan", body: 'Open Argus from the sidebar. Enter a target domain (e.g. "target.example.com"), select scan depth (Light / Full / Deep), and click Run. Argus enumerates subdomains, maps exposed services, and cross-references CVEs against NVD and ExploitDB.' },
        { n: "4", title: "Review findings in the dashboard", body: "Results appear in the Argus findings table — sorted by severity. Critical and High findings include CVE references, CVSS scores, and links to ExploitDB entries. Filter by severity, service type, or subdomain." },
        { n: "5", title: "Generate an executive report", body: 'Use Titan Builder to format scan output into a structured report. Prompt: "Generate an executive security report from the Argus scan results for target.example.com." Titan produces a client-ready document with risk ratings, findings summary, and a remediation roadmap.' },
      ],
    },
    {
    id: "prompts",
    icon: Terminal,
    title: "Example Prompts",
    color: "text-green-400",
    bg: "bg-green-500/10",
    prompts: [
      { label: "SaaS landing page", prompt: "Build a SaaS landing page for a time-tracking tool for freelancers. Include hero, features, pricing (3 tiers), FAQ, and a signup CTA. Dark theme, responsive." },
      { label: "Internal tool", prompt: "Build an internal dashboard for tracking client projects. Fields: client name, project status, deadline, assigned team member. Include filters and a CSV export button." },
      { label: "Business plan", prompt: "Write a 10-section business plan for a B2B SaaS startup targeting HR teams. Include executive summary, market analysis, revenue model, and 3-year financial projections." },
      { label: "API integration script", prompt: "Write a Python script that pulls data from the Stripe API, filters for failed payments in the last 30 days, and sends a Slack notification with a summary." },
      { label: "MVP prototype", prompt: "Build an MVP for a job board for remote developers. Include job listing cards, a search/filter bar, a job detail modal, and a simple apply form. React + Tailwind." },
      { label: "Email sequence", prompt: "Write a 5-email onboarding sequence for a new SaaS user. Emails: welcome, feature highlight, use case example, upgrade prompt, and check-in. Professional tone." },
    ],
  },
];

const FAQS = [
  { q: "What security tools are included in the Cyber tier?", a: "The Cyber tier ($199/mo) includes 26 dedicated security tools: Argus (OSINT + attack surface mapping), Astra (vulnerability scanning + auto-exploitation), Metasploit (exploit chain builder), BlackEye (phishing framework), Evilginx2 (MITM proxy), CyberMCP (AI-powered offensive operations), Attack Graph, Red Team Playbooks, VPN Chain, LinkenSphere, Proxy Interceptor, Isolated Browser, SIEM integration, and more." },
    { q: "Can I use the offensive security tools against live targets?", a: "Yes — for authorised engagements only. All Cyber tier tools run in a sandboxed, auditable environment with full session logging. You are legally responsible for having written authorisation before running any scan or exploitation tool against a target. Unauthorised use is prohibited by our Terms of Service." },
    { q: "How does Argus differ from running nmap or Shodan manually?", a: "Argus orchestrates multiple OSINT sources simultaneously — passive DNS, certificate transparency, Shodan, VirusTotal, and more — and cross-references the results against CVE databases in a single automated workflow. It outputs structured, risk-rated findings rather than raw data dumps, and can feed directly into Astra for vulnerability confirmation." },
    { q: "Is Titan Builder really local-first?", a: "Yes. When you use Titan Builder, your prompts and context are processed within your session environment — not sent to third-party AI providers. Your data stays in your account's secure workspace." },
  { q: "What can Titan Builder actually produce?", a: "Landing pages, full websites, internal tools, dashboards, business plans, API scripts, email sequences, documentation, MVPs, and more. If you can describe it, Titan can build it." },
  { q: "How are credits calculated?", a: "Credits are consumed per Builder run. Simple outputs (a single page, a short script) use 50–100 credits. Complex outputs (full MVPs, multi-section documents) use 100–300 credits. You can see credit usage in Settings → Usage." },
  { q: "Can I use my own API keys?", a: "Yes. Store your API keys in the Titan Vault and reference them in your Builder prompts. Titan will use them in generated code without exposing them in plaintext." },
  { q: "Does Titan work offline?", a: "The Titan Desktop app (available for Windows, macOS, and Linux) supports offline mode for editing and reviewing previous builds. New Builder runs require an internet connection." },
  { q: "Can I export the generated code?", a: "Yes. Every Builder output can be exported as a ZIP file containing clean, human-readable code. No vendor lock-in." },
  { q: "What integrations are supported?", a: "GitHub, Vercel, AWS S3, Stripe, Slack, Notion, Airtable, Zapier, and more. See Settings → Integrations for the full list." },
  { q: "Is there a free plan?", a: "Yes. The Starter plan is free and includes full chat access with 500 credits/month. Titan Builder requires a Pro ($29/mo) or Enterprise ($99/mo) plan." },
  { q: "How do I get support?", a: "Use the in-app chat (the purple help button), email support@archibaldtitan.com, or visit the community forum at community.archibaldtitan.com." },
  { q: "Can teams share a Titan account?", a: "Enterprise plans include team management features: shared vault, role-based access, audit logs, and team usage dashboards. Contact sales for team pricing." },
];

export default function DocsPage() {
  const [activeSection, setActiveSection] = useState("quickstart");
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <MarketingLayout>

      <div className="pt-24 pb-20 max-w-6xl mx-auto px-4 sm:px-6">
        {/* HERO */}
        <div className="text-center py-12">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-blue-500/20 bg-blue-500/5 text-blue-400 text-xs font-medium mb-6">
            Documentation
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-4">Platform Documentation</h1>
          <p className="text-lg text-white/60 max-w-xl mx-auto">Builder quick start, key concepts, security tool guides, and platform reference for Archibald Titan.</p>
        </div>

        {/* QUICK LINKS */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-12">
          {[
            { icon: Zap, label: "Quick Start", href: "#quickstart", color: "text-yellow-400", bg: "bg-yellow-500/10" },
            { icon: BookOpen, label: "Key Concepts", href: "#concepts", color: "text-blue-400", bg: "bg-blue-500/10" },
            { icon: Terminal, label: "Example Prompts", href: "#prompts", color: "text-green-400", bg: "bg-green-500/10" },
            { icon: Key, label: "Vault & Credentials", href: "#concepts", color: "text-purple-400", bg: "bg-purple-500/10" },
            { icon: Globe, label: "Integrations", href: "#concepts", color: "text-cyan-400", bg: "bg-cyan-500/10" },
            { icon: Shield, label: "Security", href: "/security", color: "text-emerald-400", bg: "bg-emerald-500/10" },
            { icon: ShieldAlert, label: "Security Tools", href: "#security-tools", color: "text-red-400", bg: "bg-red-500/10" },
          ].map(({ icon: Icon, label, href, color, bg }) => (
            <a key={label} href={href} className="flex items-center gap-3 p-4 rounded-xl border border-white/10 bg-white/[0.02] hover:bg-white/5 transition-colors group">
              <div className={`h-9 w-9 rounded-lg ${bg} flex items-center justify-center shrink-0`}>
                <Icon className={`h-4 w-4 ${color}`} />
              </div>
              <span className="text-sm font-medium text-white/80 group-hover:text-white transition-colors">{label}</span>
              <ChevronRight className="h-4 w-4 text-white/20 group-hover:text-white/50 ml-auto transition-colors" />
            </a>
          ))}
        </div>

        {/* SECTIONS */}
        {SECTIONS.map((section) => (
          <div key={section.id} id={section.id} className="mb-16">
            <div className="flex items-center gap-3 mb-6">
              <div className={`h-10 w-10 rounded-xl ${section.bg} flex items-center justify-center`}>
                <section.icon className={`h-5 w-5 ${section.color}`} />
              </div>
              <h2 className="text-2xl font-bold">{section.title}</h2>
            </div>

            {section.steps && (
              <div className="space-y-4">
                {section.steps.map((step) => (
                  <div key={step.n} className="flex gap-4 p-5 rounded-xl border border-white/10 bg-white/[0.02]">
                    <div className="h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center shrink-0 text-sm font-bold">{step.n}</div>
                    <div>
                      <h3 className="font-semibold text-white mb-1">{step.title}</h3>
                      <p className="text-sm text-white/60 leading-relaxed">{step.body}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {section.concepts && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {section.concepts.map((c) => (
                  <div key={c.term} className="p-5 rounded-xl border border-white/10 bg-white/[0.02]">
                    <h3 className="font-semibold text-white mb-2">{c.term}</h3>
                    <p className="text-sm text-white/60 leading-relaxed">{c.def}</p>
                  </div>
                ))}
              </div>
            )}

            {section.prompts && (
              <div className="space-y-3">
                {section.prompts.map((p) => (
                  <div key={p.label} className="p-5 rounded-xl border border-white/10 bg-white/[0.02]">
                    <div className="flex items-center gap-2 mb-2">
                      <Code2 className="h-4 w-4 text-green-400" />
                      <span className="text-xs font-semibold text-green-400 uppercase tracking-wider">{p.label}</span>
                    </div>
                    <p className="text-sm text-white/70 font-mono leading-relaxed bg-white/5 rounded-lg px-4 py-3">"{p.prompt}"</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        {/* FAQ */}
        <div className="mb-16">
          <h2 className="text-2xl font-bold mb-6">Frequently Asked Questions</h2>
          <div className="space-y-2">
            {FAQS.map((faq, i) => (
              <div key={i} className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden">
                <button
                  className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-white/5 transition-colors"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                >
                  <span className="font-medium text-white/90 text-sm pr-4">{faq.q}</span>
                  <ChevronRight className={`h-4 w-4 text-white/40 shrink-0 transition-transform ${openFaq === i ? "rotate-90" : ""}`} />
                </button>
                {openFaq === i && (
                  <div className="px-5 pb-4 text-sm text-white/60 leading-relaxed border-t border-white/5 pt-3">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="text-center py-12 rounded-2xl border border-blue-500/20 bg-blue-500/5">
          <h2 className="text-2xl font-bold mb-3">Ready to start building?</h2>
          <p className="text-white/60 mb-6">Free plan includes full chat access. Builder access from $29/mo.</p>
          <Link href="/builder" className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-blue-600 hover:bg-blue-500 font-semibold transition-colors">
            Open Titan Builder <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </MarketingLayout>
  );
}