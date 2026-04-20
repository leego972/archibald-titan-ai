import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { getLoginUrl } from "@/const";
import { Zap, Shield, Sparkles, Wrench, ArrowRight, CheckCircle2 } from "lucide-react";
import MarketingLayout from "@/components/MarketingLayout";

type ChangeType = "feature" | "improvement" | "fix" | "security";

interface Release {
  version: string;
  date: string;
  label?: string;
  changes: { type: ChangeType; text: string }[];
}

const RELEASES: Release[] = [
  {
      version: "v4.1.0",
      date: "April 2026",
      label: "Latest",
      changes: [
        { type: "feature", text: "Proxy Network — managed residential proxy via Decodo/Smartproxy with 18 exit countries, HTTP/HTTPS/SOCKS5/SOCKS4, and IP leak test" },
        { type: "feature", text: "Unified platform branding — all 15 marketing pages now share consistent navigation, mobile menu, and professional 4-column footer" },
        { type: "improvement", text: "Public developer portal — /developer-docs, /cli, and /download now accessible pre-authentication" },
        { type: "improvement", text: "Sidebar — Proxy Network added to Privacy & Network section alongside VPN Chain, Tor, and IP Rotation" },
        { type: "security", text: "Proxy credentials isolated per user — each account generates a unique sub-user with encrypted credential storage" },
      ],
    },
    {
      version: "v4.0.0",
      date: "January 2026",
      changes: [
        { type: "feature", text: "Red Team Playbooks — structured offensive exercises with MITRE ATT&CK mapping, step-by-step runbooks, and AI-assisted execution" },
        { type: "feature", text: "Attack Graph — interactive kill-chain visualiser mapping vulnerabilities, entry points, and lateral movement paths" },
        { type: "feature", text: "Command Centre — unified mission control for all active Titan operations with real-time status and cross-tool coordination" },
        { type: "feature", text: "Security Marketplace — browse, install, and purchase security modules, exploit packs, and OSINT plugins from vetted contributors" },
        { type: "feature", text: "SIEM Integration — forward Titan events and alerts to Splunk, Elastic, Datadog, and custom webhook endpoints" },
        { type: "feature", text: "Compliance Reports — automated SOC2, ISO 27001, and GDPR readiness reports generated from your Titan audit trail" },
        { type: "feature", text: "Event Bus — subscribe to platform events and build custom automation pipelines across Titan tools" },
      ],
    },
    {
      version: "v3.9.0",
      date: "September 2025",
      changes: [
        { type: "feature", text: "LinkenSphere — anti-detect browser profile management with fingerprint spoofing, proxy binding, and session isolation" },
        { type: "feature", text: "Isolated Browser — Titan-sandboxed Chromium for safe reconnaissance, payload staging, and dark-web browsing" },
        { type: "feature", text: "Proxy Interceptor — man-in-the-middle proxy with real-time request inspection, rewriting, and response manipulation" },
        { type: "feature", text: "Exploit Pack — curated exploit collection with CVE search, PoC runner, and automated impact assessment" },
        { type: "improvement", text: "Titan AI model upgrades — faster reasoning, deeper context retention, and improved code generation accuracy" },
        { type: "security", text: "VPN Chain multi-hop routing — chain up to 6 SSH/VPN hops with automatic dead-route fallback and geo-diversity enforcement" },
      ],
    },
    {
    version: "v3.8.0",
    date: "March 2025",
    changes: [
      { type: "feature", text: "AI Content Studio — generate platform-optimised content for TikTok, Instagram, LinkedIn, and 12 other platforms" },
      { type: "feature", text: "Message queue in Titan Chat — send messages while Titan is processing without interrupting the current run" },
      { type: "feature", text: "Marketplace payload generator — real, functional code payloads for all marketplace listings" },
      { type: "improvement", text: "Builder page — full Archibald Titan crest logo in hero, tier logos on pricing cards" },
      { type: "improvement", text: "Mobile layout fixes — tab bar scrollable, platform labels no longer truncated on small screens" },
      { type: "security", text: "Builder access gated to paid users — free plan restricted to AI Chat only" },
    ],
  },
  {
    version: "v3.7.0",
    date: "February 2025",
    changes: [
      { type: "feature", text: "Dedicated /builder landing page with 8 sections, examples gallery, and builder-specific FAQ" },
      { type: "feature", text: "Homepage rewrite — new hero, proof strip, audience routing, security section, and updated pricing preview" },
      { type: "feature", text: "Advertising Dashboard — campaign management, ad copy generation, and performance analytics" },
      { type: "improvement", text: "Nav updated with Builder, Use Cases, Security, and Pricing links" },
      { type: "fix", text: "TypeScript compilation errors in marketplace-payload-generator resolved" },
    ],
  },
  {
    version: "v3.6.0",
    date: "January 2025",
    changes: [
      { type: "feature", text: "TikTok Pipeline — automated content scheduling and publishing to TikTok" },
      { type: "feature", text: "SEO Engine — keyword research, SERP analysis, and content brief generation" },
      { type: "feature", text: "Affiliate Dashboard — referral tracking, commission management, and payout reporting" },
      { type: "improvement", text: "Credential health scoring — automated detection of weak, reused, and compromised credentials" },
      { type: "security", text: "Vault lock timeout now configurable per user (1–60 minutes)" },
    ],
  },
  {
    version: "v3.5.0",
    date: "December 2024",
    changes: [
      { type: "feature", text: "Tech Bazaar Marketplace — buy and sell tools, scripts, and integrations built on Titan" },
      { type: "feature", text: "Seller bot system — automated marketplace listings with real functional code payloads" },
      { type: "feature", text: "Crowdfunding module — campaign creation, backer management, and milestone tracking" },
      { type: "improvement", text: "Titan Builder output quality improvements — better structure, more consistent formatting" },
      { type: "fix", text: "Queue indicator now shows dismissible chips per queued message" },
    ],
  },
  {
    version: "v3.4.0",
    date: "November 2024",
    changes: [
      { type: "feature", text: "Argus — autonomous web monitoring and alerting system" },
      { type: "feature", text: "Astra — AI-powered research and intelligence gathering tool" },
      { type: "feature", text: "CyberMCP — Model Context Protocol server for security tooling" },
      { type: "improvement", text: "Dashboard sidebar — Specialised section with cyber tools, research tools, and advanced modules" },
      { type: "security", text: "TOTP vault — time-based one-time password storage with AES-256 encryption" },
    ],
  },
  {
    version: "v3.3.0",
    date: "October 2024",
    changes: [
      { type: "feature", text: "Enterprise tier — RBAC, team vault, SSO/SAML, and full audit trail" },
      { type: "feature", text: "Team management — invite members, assign roles, and manage permissions" },
      { type: "feature", text: "API access — REST API for programmatic credential and builder access" },
      { type: "improvement", text: "Pricing page — task-based economics, usage examples, and upgrade logic" },
      { type: "fix", text: "Credential sync reliability improvements for large vaults (1,000+ credentials)" },
    ],
  },
  {
    version: "v3.2.0",
    date: "September 2024",
    changes: [
      { type: "feature", text: "Titan Builder GA — AI-powered build environment for landing pages, MVPs, tools, and documents" },
      { type: "feature", text: "Sandbox execution — generated code runs in an isolated environment" },
      { type: "feature", text: "Export formats — HTML, CSS, Markdown, JSON, Python, TypeScript, .env, and zip" },
      { type: "improvement", text: "Builder output now includes inline comments and README by default" },
      { type: "security", text: "Sandbox network isolation — generated scripts cannot make external calls without explicit permission" },
    ],
  },
  {
    version: "v3.0.0",
    date: "August 2024",
    changes: [
      { type: "feature", text: "Titan Chat — conversational AI with tool calling, memory, and multi-step reasoning" },
      { type: "feature", text: "Credential fetcher — automated credential retrieval from 15+ provider integrations" },
      { type: "feature", text: "Proxy pool — residential and datacenter proxy management with health monitoring" },
      { type: "improvement", text: "Complete UI redesign — dark-first, accessible, mobile-responsive" },
      { type: "security", text: "AES-256-GCM vault encryption with PBKDF2 key derivation" },
    ],
  },
];

const TYPE_CONFIG: Record<ChangeType, { label: string; color: string; bg: string; border: string; icon: typeof Zap }> = {
  feature:     { label: "New",         color: "text-blue-400",    bg: "bg-blue-500/10",    border: "border-blue-500/20",    icon: Sparkles },
  improvement: { label: "Improved",    color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20", icon: Zap },
  fix:         { label: "Fixed",       color: "text-amber-400",   bg: "bg-amber-500/10",   border: "border-amber-500/20",   icon: Wrench },
  security:    { label: "Security",    color: "text-rose-400",    bg: "bg-rose-500/10",    border: "border-rose-500/20",    icon: Shield },
};

export default function ChangelogPage() {
  return (
    <MarketingLayout>
      {/* NAV */}

      {/* HERO */}
      <section className="relative pt-32 pb-12 sm:pt-40 sm:pb-16">
        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-blue-500/20 bg-blue-500/5 mb-8">
            <Zap className="h-3.5 w-3.5 text-blue-400" />
            <span className="text-xs font-medium text-blue-300">Release history</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight">Changelog</h1>
          <p className="mt-4 text-white/50 max-w-xl mx-auto">Every release, every improvement, every fix — documented here.</p>
        </div>
      </section>

      {/* RELEASES */}
      <section className="relative py-8 pb-24">
        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="space-y-10">
            {RELEASES.map((release) => (
              <div key={release.version} className="relative">
                <div className="flex items-center gap-4 mb-5">
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-black text-white">{release.version}</span>
                    {release.label && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500 text-white">
                        {release.label}
                      </span>
                    )}
                  </div>
                  <span className="text-sm text-white/30">{release.date}</span>
                </div>
                <div className="space-y-2.5 pl-4 border-l border-white/5">
                  {release.changes.map((change, i) => {
                    const cfg = TYPE_CONFIG[change.type];
                    const Icon = cfg.icon;
                    return (
                      <div key={i} className="flex items-start gap-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${cfg.bg} ${cfg.color} border ${cfg.border} shrink-0 mt-0.5`}>
                          <Icon className="h-2.5 w-2.5" />{cfg.label}
                        </span>
                        <p className="text-sm text-white/60 leading-relaxed">{change.text}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FOOTER */}
    </MarketingLayout>
  );
}