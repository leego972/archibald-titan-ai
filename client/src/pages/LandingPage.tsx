import { useAuth } from "@/_core/hooks/useAuth";
import AffiliateRecommendations from "@/components/AffiliateRecommendations";
import ArchibaldWizard from "@/components/ArchibaldWizard";
import { Button } from "@/components/ui/button";
import { getLoginUrl, getRegisterUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { trackDownload } from "@/lib/adTracking";
import { AT_ICON_64, FULL_LOGO_ORIGINAL, TIER_LOGOS } from "@/lib/logos";
import { useState, useEffect, useRef } from "react";
import { useLocation, Link } from "wouter";
import {
  Shield, Zap, Globe, KeyRound, Download, Monitor, Apple, Terminal,
  ChevronDown, ArrowRight, Check, Lock, Eye, RefreshCw,
  ShieldAlert, Fingerprint, Network, Clock, Sparkles,
  Github, ChevronUp, Star, Quote, X,
  Menu, PackageOpen, Cpu, HardDrive,
  Copy, CheckCircle2, ScanSearch, Vault,
  BarChart3, Code2, Layers, Users, Building2,
  Hammer, Rocket, Target, Bug, Crosshair,
  ShieldCheck, Swords, FlaskConical, Store, Boxes,
  Terminal as TerminalIcon, Database, Workflow, CreditCard,
  Settings2, GitBranch, Wifi, Globe2,
} from "lucide-react";

function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-white/5 last:border-0">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between py-5 text-left gap-4 group">
        <span className="text-sm sm:text-base font-medium text-white/80 group-hover:text-white transition-colors">{question}</span>
        {open ? <ChevronUp className="h-4 w-4 text-white/40 shrink-0" /> : <ChevronDown className="h-4 w-4 text-white/40 shrink-0" />}
      </button>
      {open && <div className="pb-5"><p className="text-sm text-white/50 leading-relaxed">{answer}</p></div>}
    </div>
  );
}

function detectPlatform(): "windows" | "mac" | "linux" {
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes("mac")) return "mac";
  if (ua.includes("linux") || ua.includes("ubuntu") || ua.includes("debian") || ua.includes("fedora")) return "linux";
  return "windows";
}

const PLATFORM_INFO: Record<string, { label: string; icon: typeof Monitor; ext: string; note: string; installTip: string }> = {
  windows: { label: "Windows", icon: Monitor, ext: ".exe", note: "Windows 10+ (64-bit)", installTip: "Your download has started. Once complete, double-click the .exe file to install. If SmartScreen appears, click More info then Run anyway." },
  mac: { label: "macOS", icon: Apple, ext: ".dmg", note: "macOS 12+ (Apple Silicon & Intel)", installTip: "Your download has started. Open the .dmg file and drag Archibald Titan to Applications. If blocked, go to System Settings > Privacy & Security > Open Anyway." },
  linux: { label: "Linux", icon: Terminal, ext: ".AppImage", note: "Ubuntu 20.04+ / Debian / Fedora", installTip: "Your download has started. Make it executable with: chmod +x ArchibaldTitan-*.AppImage then double-click or run from terminal." },
};

export default function LandingPage() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();
  const [leegoEnlarged, setLeegoEnlarged] = useState(false);

  useEffect(() => {
    if (!loading && user) setLocation("/dashboard");
  }, [user, loading, setLocation]);

  const { data: latestRelease, refetch: refetchLatest } = trpc.releases.latest.useQuery();
  const { data: allReleases, refetch: refetchList } = trpc.releases.list.useQuery();
  const requestDownloadToken = trpc.download.requestToken.useMutation();
  const syncFromGitHub = trpc.releases.syncFromGitHub.useMutation();

  useEffect(() => {
    const SYNC_KEY = "at_releases_synced";
    const lastSync = sessionStorage.getItem(SYNC_KEY);
    if (!lastSync) {
      syncFromGitHub.mutateAsync().then(() => {
        sessionStorage.setItem(SYNC_KEY, Date.now().toString());
        refetchLatest();
        refetchList();
      }).catch(() => {});
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [downloadPending, setDownloadPending] = useState<string | null>(null);
  const [detectedPlatform] = useState(() => detectPlatform());
  const [postDownloadTip, setPostDownloadTip] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLeegoClick = () => {
    setLeegoEnlarged(true);
    setTimeout(() => setLeegoEnlarged(false), 1800);
  };

  const handleDownload = async (platform: "windows" | "mac" | "linux") => {
    if (!user) { window.location.href = getLoginUrl(); return; }
    if (!latestRelease) return;
    const hasDownload = platform === "windows" ? latestRelease.hasWindows : platform === "mac" ? latestRelease.hasMac : latestRelease.hasLinux;
    if (!hasDownload) {
      const toast = document.getElementById("coming-soon-toast");
      if (toast) {
        toast.classList.remove("opacity-0", "translate-y-4");
        toast.classList.add("opacity-100", "translate-y-0");
        setTimeout(() => { toast.classList.add("opacity-0", "translate-y-4"); toast.classList.remove("opacity-100", "translate-y-0"); }, 3000);
      }
      return;
    }
    try {
      setDownloadPending(platform);
      const { token } = await requestDownloadToken.mutateAsync({ releaseId: latestRelease.id, platform });
      window.open(`/api/download/${token}`, "_blank");
      trackDownload(platform);
      const tip = PLATFORM_INFO[platform]?.installTip;
      if (tip) setPostDownloadTip(tip);
    } catch (err: any) {
      const msg = err?.message ?? "Download failed. Please try again.";
      const toast = document.getElementById("coming-soon-toast");
      if (toast) {
        toast.textContent = msg;
        toast.classList.remove("opacity-0", "translate-y-4");
        toast.classList.add("opacity-100", "translate-y-0");
        setTimeout(() => { toast.textContent = "Download links will be available soon. Stay tuned!"; toast.classList.add("opacity-0", "translate-y-4"); toast.classList.remove("opacity-100", "translate-y-0"); }, 4000);
      }
    } finally { setDownloadPending(null); }
  };

  return (
    <div className="min-h-screen bg-[#060611] text-white overflow-x-hidden">
      <ArchibaldWizard />

      {/* NAV */}
      <nav aria-label="Navigation" className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-[#060611]/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <img loading="eager" src={AT_ICON_64} alt="AT" className="h-9 w-9 object-contain" />
              <span className="text-lg font-black tracking-tight">Archibald Titan</span>
            </div>
            <div className="hidden md:flex items-center gap-6">
              <Link href="/builder" className="text-sm text-red-400 hover:text-red-300 font-semibold transition-colors">Titan Builder</Link>
              <Link href="/pricing" className="text-sm text-white/60 hover:text-white transition-colors">Pricing</Link>
              <Link href="/security" className="text-sm text-white/60 hover:text-white transition-colors">Security</Link>
              <Link href="/use-cases" className="text-sm text-white/60 hover:text-white transition-colors">Use Cases</Link>
              <Link href="/docs" className="text-sm text-white/60 hover:text-white transition-colors">Docs</Link>
              <Link href="/blog" className="text-sm text-white/60 hover:text-white transition-colors">Blog</Link>
              <Link href="/contact" className="text-sm text-white/60 hover:text-white transition-colors">Contact</Link>
            </div>
            <div className="flex items-center gap-2">
              {user ? (
                <Button onClick={() => setLocation("/dashboard")} size="sm" className="bg-red-600 hover:bg-red-500 text-white border-0 shadow-lg shadow-red-600/25">
                  Dashboard <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                </Button>
              ) : (
                <>
                  <Button onClick={() => { window.location.href = getLoginUrl(); }} size="sm" variant="ghost" className="text-white/70 hover:text-white hidden sm:flex">Sign In</Button>
                  <Button onClick={() => { window.location.href = getRegisterUrl(); }} size="sm" className="bg-red-600 hover:bg-red-500 text-white border-0 shadow-lg shadow-red-600/25">Get Started</Button>
                </>
              )}
              <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="md:hidden flex items-center justify-center h-9 w-9 rounded-lg border border-white/10 bg-white/5 text-white hover:bg-white/10 transition-colors" aria-label="Toggle menu">
                {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            </div>
          </div>
        </div>
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-white/5 bg-[#060611]/95 backdrop-blur-xl">
            <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col gap-1">
              <Link href="/builder" onClick={() => setMobileMenuOpen(false)} className="block py-2.5 px-3 rounded-lg text-sm text-red-400 hover:text-red-300 hover:bg-red-500/5 transition-colors font-semibold">Titan Builder</Link>
              <Link href="/pricing" onClick={() => setMobileMenuOpen(false)} className="block py-2.5 px-3 rounded-lg text-sm text-white/70 hover:text-white hover:bg-white/5 transition-colors">Pricing</Link>
              <Link href="/security" onClick={() => setMobileMenuOpen(false)} className="block py-2.5 px-3 rounded-lg text-sm text-white/70 hover:text-white hover:bg-white/5 transition-colors">Security</Link>
              <Link href="/use-cases" onClick={() => setMobileMenuOpen(false)} className="block py-2.5 px-3 rounded-lg text-sm text-white/70 hover:text-white hover:bg-white/5 transition-colors">Use Cases</Link>
              <Link href="/docs" onClick={() => setMobileMenuOpen(false)} className="block py-2.5 px-3 rounded-lg text-sm text-white/70 hover:text-white hover:bg-white/5 transition-colors">Docs</Link>
              <Link href="/blog" onClick={() => setMobileMenuOpen(false)} className="block py-2.5 px-3 rounded-lg text-sm text-white/70 hover:text-white hover:bg-white/5 transition-colors">Blog</Link>
              <Link href="/contact" onClick={() => setMobileMenuOpen(false)} className="block py-2.5 px-3 rounded-lg text-sm text-white/70 hover:text-white hover:bg-white/5 transition-colors">Contact</Link>
              <div className="pt-2 border-t border-white/5 mt-1 flex flex-col gap-2">
                <Button onClick={() => { setMobileMenuOpen(false); window.location.href = getRegisterUrl(); }} className="w-full bg-red-600 hover:bg-red-500 text-white border-0" size="sm">Get Started Free</Button>
                <Button onClick={() => { setMobileMenuOpen(false); window.location.href = getLoginUrl(); }} variant="outline" className="w-full border-white/20 text-white hover:bg-white/10" size="sm">Sign In</Button>
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* ═══════════════════════════════════════════════════════════
          HERO — Titan Builder is the command center
      ═══════════════════════════════════════════════════════════ */}
      <section className="relative pt-28 pb-20 sm:pt-36 sm:pb-28">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[600px] bg-red-700/10 rounded-full blur-[140px]" />
          <div className="absolute top-1/2 left-1/4 w-[500px] h-[400px] bg-orange-600/5 rounded-full blur-[100px]" />
          <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-red-500/20 to-transparent" />
        </div>
        <div className="absolute inset-0 opacity-[0.025]" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.15) 1px, transparent 1px)", backgroundSize: "60px 60px" }} />

        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          {/* BIG LOGO */}
          <div className="flex justify-center mb-8">
            <img
              loading="eager"
              src={FULL_LOGO_ORIGINAL}
              alt="Archibald Titan"
              className="w-56 sm:w-72 lg:w-80 object-contain drop-shadow-[0_0_60px_rgba(220,38,38,0.4)] hover:drop-shadow-[0_0_80px_rgba(220,38,38,0.6)] transition-all duration-500"
            />
          </div>

          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-red-500/25 bg-red-500/8 mb-7">
            <Sparkles className="h-3.5 w-3.5 text-red-400" />
            <span className="text-xs font-semibold text-red-300 tracking-wide">v{latestRelease?.version ?? "9.0.0"} — Now Live</span>
          </div>

          {/* HEADLINE */}
          <h1 className="text-5xl sm:text-6xl lg:text-8xl font-black tracking-tight leading-[1.0] mb-2">
            <span className="text-white">All Hats.</span>
            <br />
            <span className="bg-gradient-to-r from-red-400 via-orange-400 to-red-500 bg-clip-text text-transparent">One Stack.</span>
          </h1>

          <p className="mt-6 text-lg sm:text-xl text-white/55 max-w-2xl mx-auto leading-relaxed">
            Run tools, workflows, marketplace assets, and security modules from <strong className="text-white">Titan Builder</strong> — the command center of the Archibald Titan ecosystem.
          </p>

          {/* CTAs */}
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            {user ? (
              <Button size="lg" onClick={() => setLocation("/builder")} className="bg-red-600 hover:bg-red-500 text-white border-0 shadow-xl shadow-red-600/30 h-14 px-10 text-base font-bold gap-3">
                <Rocket className="h-5 w-5" />Launch Titan Builder
              </Button>
            ) : (
              <>
                <Button size="lg" onClick={() => { window.location.href = getRegisterUrl(); }} className="bg-red-600 hover:bg-red-500 text-white border-0 shadow-xl shadow-red-600/30 h-14 px-10 text-base font-bold gap-3">
                  <Rocket className="h-5 w-5" />Launch Titan Builder
                </Button>
                <Button size="lg" onClick={() => { window.location.href = getLoginUrl(); }} variant="outline" className="border-white/20 bg-white/5 hover:bg-white/10 text-white h-14 px-8 text-base">
                  Sign In
                </Button>
              </>
            )}
          </div>

          <p className="mt-4 text-sm text-white/25">Free tier available. No credit card required to start.</p>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════
          SECTION 1 — What is Titan Builder?
      ═══════════════════════════════════════════════════════════ */}
      <section className="relative py-24 sm:py-32 border-t border-white/5">
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <span className="text-sm font-bold text-red-400 tracking-widest uppercase">What is Titan Builder?</span>
              <h2 className="mt-3 text-3xl sm:text-4xl font-black tracking-tight leading-tight">
                One console.<br />The whole stack.
              </h2>
              <p className="mt-5 text-white/55 leading-relaxed">
                Titan Builder is the central interactive console for everything in your Archibald Titan stack. Instead of switching between ten different tools, you run everything from one place — AI chat, security modules, marketplace purchases, storage, credentials, and automation.
              </p>
              <p className="mt-4 text-white/55 leading-relaxed">
                Every tool, module, and integration you unlock connects back to Titan Builder. It's not a feature — it's the control layer for the entire platform.
              </p>
              <div className="mt-8">
                <Link href="/builder">
                  <Button className="bg-red-600 hover:bg-red-500 text-white border-0 font-bold gap-2">
                    Open Titan Builder <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </div>
            {/* Architecture visual */}
            <div className="relative">
              <div className="relative p-6 rounded-2xl border border-red-500/20 bg-red-500/[0.03]">
                {/* Center node */}
                <div className="flex justify-center mb-6">
                  <div className="px-6 py-3 rounded-xl border-2 border-red-500/50 bg-red-600/15 shadow-lg shadow-red-500/20">
                    <span className="text-base font-black text-red-300 tracking-wide">TITAN BUILDER</span>
                  </div>
                </div>
                {/* Connected modules */}
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { icon: ShieldAlert, label: "Security Modules", color: "text-red-400", bg: "bg-red-500/10 border-red-500/20" },
                    { icon: Store, label: "Marketplace", color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
                    { icon: Database, label: "Storage", color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20" },
                    { icon: CreditCard, label: "Credits", color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20" },
                    { icon: Workflow, label: "Automation", color: "text-purple-400", bg: "bg-purple-500/10 border-purple-500/20" },
                    { icon: Users, label: "Team Workflows", color: "text-cyan-400", bg: "bg-cyan-500/10 border-cyan-500/20" },
                    { icon: KeyRound, label: "Integrations", color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/20" },
                    { icon: PackageOpen, label: "Modules", color: "text-pink-400", bg: "bg-pink-500/10 border-pink-500/20" },
                  ].map((node) => (
                    <div key={node.label} className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg border ${node.bg}`}>
                      <node.icon className={`h-4 w-4 shrink-0 ${node.color}`} />
                      <span className="text-xs font-semibold text-white/70">{node.label}</span>
                    </div>
                  ))}
                </div>
                {/* Connecting lines visual hint */}
                <div className="absolute top-[68px] left-1/2 -translate-x-1/2 w-px h-5 bg-gradient-to-b from-red-500/40 to-transparent" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════
          SECTION 2 — What Titan Builder controls
      ═══════════════════════════════════════════════════════════ */}
      <section className="relative py-24 sm:py-32">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-red-950/5 to-transparent" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <span className="text-sm font-bold text-red-400 tracking-widest uppercase">What it controls</span>
            <h2 className="mt-3 text-3xl sm:text-4xl font-black tracking-tight">Inside Titan Builder you can:</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              {
                icon: TerminalIcon,
                title: "Run programs",
                desc: "Execute code, run security tools, and operate modules directly from the AI-powered console.",
                color: "text-red-400", bg: "bg-red-500/10",
              },
              {
                icon: PackageOpen,
                title: "Buy and launch modules",
                desc: "Purchase tools from the Grand Bazaar marketplace and launch them instantly inside Builder.",
                color: "text-emerald-400", bg: "bg-emerald-500/10",
              },
              {
                icon: Hammer,
                title: "Manage projects",
                desc: "Build websites, tools, and business assets. Save outputs to Titan Storage. Iterate fast.",
                color: "text-blue-400", bg: "bg-blue-500/10",
              },
              {
                icon: KeyRound,
                title: "Control integrations",
                desc: "Connect to 15+ credential providers. Manage API keys, tokens, and secrets from one vault.",
                color: "text-orange-400", bg: "bg-orange-500/10",
              },
              {
                icon: CreditCard,
                title: "Spend credits",
                desc: "Every action in the ecosystem is metered by credits. Monitor, top up, and manage your balance.",
                color: "text-amber-400", bg: "bg-amber-500/10",
              },
              {
                icon: Database,
                title: "Save to storage",
                desc: "All outputs — code, documents, exports — saved to Titan Storage (Cloudflare R2 backed).",
                color: "text-cyan-400", bg: "bg-cyan-500/10",
              },
              {
                icon: Workflow,
                title: "Automate repeat tasks",
                desc: "Schedule jobs, set up webhooks, and run auto-sync workflows without manual intervention.",
                color: "text-purple-400", bg: "bg-purple-500/10",
              },
              {
                icon: Users,
                title: "Operate team workflows",
                desc: "Shared vaults, role-based access, audit logs, and team management for governed operations.",
                color: "text-pink-400", bg: "bg-pink-500/10",
              },
            ].map((item) => (
              <div key={item.title} className="p-6 rounded-2xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] hover:border-red-500/20 transition-all duration-200 group">
                <div className={`inline-flex p-2.5 rounded-xl ${item.bg} mb-4`}>
                  <item.icon className={`h-5 w-5 ${item.color}`} />
                </div>
                <h3 className="text-sm font-bold text-white mb-2">{item.title}</h3>
                <p className="text-xs text-white/50 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════
          SECTION 3 — Security specialisation
      ═══════════════════════════════════════════════════════════ */}
      <section className="relative py-24 sm:py-32 border-t border-white/5">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-red-950/8 to-transparent" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <span className="text-sm font-bold text-red-400 tracking-widest uppercase">Security & Risk</span>
            <h2 className="mt-3 text-3xl sm:text-4xl font-black tracking-tight">A proper vulnerability testing hub</h2>
            <p className="mt-4 text-white/50 max-w-2xl mx-auto">Not a toy scanner. A real platform for security professionals — from credential monitoring to full offensive tooling, all running through Titan Builder.</p>
          </div>

          {/* Tier progression */}
          <div className="space-y-5">
            {/* Cyber tier */}
            <div className="p-6 rounded-2xl border border-orange-500/20 bg-orange-500/[0.03]">
              <div className="flex items-center gap-3 mb-5">
                <img src={TIER_LOGOS.cyber} alt="Cyber" className="h-8 w-8 object-contain" />
                <div>
                  <span className="text-sm font-black text-orange-400">Cyber Tier</span>
                  <p className="text-xs text-white/40">Defensive + active security tooling</p>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {[
                  { icon: ScanSearch, label: "Credential Leak Scanner" },
                  { icon: Vault, label: "TOTP Vault" },
                  { icon: ShieldCheck, label: "Credential Health" },
                  { icon: FlaskConical, label: "Astra Scanner" },
                  { icon: Globe2, label: "Argus OSINT" },
                  { icon: Cpu, label: "CyberMCP" },
                ].map((t) => (
                  <div key={t.label} className="flex flex-col items-center gap-2 p-3 rounded-xl border border-orange-500/15 bg-orange-500/5 text-center">
                    <t.icon className="h-5 w-5 text-orange-400" />
                    <span className="text-[10px] font-semibold text-white/60 leading-tight">{t.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Titan tier */}
            <div className="p-6 rounded-2xl border border-red-500/20 bg-red-500/[0.03]">
              <div className="flex items-center gap-3 mb-5">
                <img src={TIER_LOGOS.titan} alt="Titan" className="h-8 w-8 object-contain" />
                <div>
                  <span className="text-sm font-black text-red-400">Titan Tier</span>
                  <p className="text-xs text-white/40">Full offensive tooling — for authorised red team engagements</p>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {[
                  { icon: Swords, label: "Metasploit" },
                  { icon: Fingerprint, label: "Evilginx 3" },
                  { icon: Target, label: "BlackEye" },
                  { icon: Bug, label: "Exploit Pack" },
                  { icon: Network, label: "VPN Chain Builder" },
                  { icon: Globe, label: "Tor Routing" },
                ].map((t) => (
                  <div key={t.label} className="flex flex-col items-center gap-2 p-3 rounded-xl border border-red-500/15 bg-red-500/5 text-center">
                    <t.icon className="h-5 w-5 text-red-400" />
                    <span className="text-[10px] font-semibold text-white/60 leading-tight">{t.label}</span>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-xs text-white/30 italic">All offensive tools are for use on systems you own or have explicit written permission to test. Misuse is against our terms of service.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════
          SECTION 4 — Who it's for
      ═══════════════════════════════════════════════════════════ */}
      <section className="relative py-24 sm:py-32">
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <span className="text-sm font-bold text-red-400 tracking-widest uppercase">Who it's for</span>
            <h2 className="mt-3 text-3xl sm:text-4xl font-black tracking-tight">All hats. One stack.</h2>
            <p className="mt-4 text-white/50 max-w-xl mx-auto">Different operators. Same platform. Titan Builder adapts to how you work.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {[
              { icon: Code2, title: "Programmers", desc: "Build tools, run sandboxes, manage API keys, and automate workflows — all from one console.", color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20" },
              { icon: ShieldAlert, title: "Security Professionals", desc: "Credential monitoring, leak scanning, OSINT, and active scanning from a single dashboard.", color: "text-red-400", bg: "bg-red-500/10 border-red-500/20" },
              { icon: Crosshair, title: "Pentesters", desc: "Metasploit, Evilginx, BlackEye, Exploit Pack, VPN chains, and Tor routing — all in Titan tier.", color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/20" },
              { icon: Hammer, title: "Builders", desc: "Websites, landing pages, MVPs, business plans, and internal tools — from brief to output in minutes.", color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
              { icon: Settings2, title: "Technical Operators", desc: "Automate, schedule, integrate, and manage complex multi-tool workflows without switching platforms.", color: "text-purple-400", bg: "bg-purple-500/10 border-purple-500/20" },
            ].map((persona) => (
              <div key={persona.title} className={`p-5 rounded-2xl border ${persona.bg} hover:opacity-90 transition-opacity`}>
                <div className="inline-flex p-2 rounded-lg bg-white/5 mb-3">
                  <persona.icon className={`h-5 w-5 ${persona.color}`} />
                </div>
                <h3 className="text-sm font-black text-white mb-2">{persona.title}</h3>
                <p className="text-xs text-white/50 leading-relaxed">{persona.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════
          SECTION 5 — Why one stack
      ═══════════════════════════════════════════════════════════ */}
      <section className="relative py-24 sm:py-32 border-t border-white/5">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-red-950/5 to-transparent" />
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <span className="text-sm font-bold text-red-400 tracking-widest uppercase">Why use it</span>
            <h2 className="mt-3 text-3xl sm:text-4xl font-black tracking-tight">Stop juggling ten systems.</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
            {/* Without Titan */}
            <div className="p-6 rounded-2xl border border-white/5 bg-white/[0.02]">
              <h3 className="text-base font-black text-white/40 mb-5 flex items-center gap-2">
                <X className="h-4 w-4 text-red-500" /> Without Titan
              </h3>
              <div className="space-y-3">
                {[
                  "Separate tool for every security scan",
                  "Different dashboard for credentials",
                  "Another platform for building",
                  "Separate marketplace for tools",
                  "Manual storage and file management",
                  "No unified credit or billing system",
                  "Context switching kills momentum",
                ].map((item) => (
                  <div key={item} className="flex items-center gap-2.5 text-sm text-white/35">
                    <div className="h-1.5 w-1.5 rounded-full bg-white/20 shrink-0" />
                    {item}
                  </div>
                ))}
              </div>
            </div>
            {/* With Titan */}
            <div className="p-6 rounded-2xl border border-red-500/25 bg-red-500/[0.04]">
              <h3 className="text-base font-black text-red-300 mb-5 flex items-center gap-2">
                <Check className="h-4 w-4 text-red-400" /> With Titan Builder
              </h3>
              <div className="space-y-3">
                {[
                  "Security tools run inside Builder",
                  "Credentials managed in the same console",
                  "Build and deploy from the same interface",
                  "Marketplace assets launch directly in Builder",
                  "All outputs saved to Titan Storage automatically",
                  "One credit balance covers the whole stack",
                  "One login. One dashboard. Everything.",
                ].map((item) => (
                  <div key={item} className="flex items-center gap-2.5 text-sm text-white/70">
                    <Check className="h-3.5 w-3.5 text-red-400 shrink-0" />
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════
          SECTION 6 — Pricing
      ═══════════════════════════════════════════════════════════ */}
      <section id="pricing-preview" className="relative py-24 sm:py-32 border-t border-white/5">
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <span className="text-sm font-bold text-red-400 tracking-widest uppercase">Pricing</span>
            <h2 className="mt-3 text-3xl sm:text-4xl font-black tracking-tight">Start free. Go as deep as you need.</h2>
            <p className="mt-4 text-white/50 max-w-2xl mx-auto">Six tiers. Free tier gets 375 daily credits — enough for real work. Paid tiers unlock more credits, more tools, and more power.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {/* Free */}
            <div className="relative p-6 rounded-2xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] transition-all duration-300">
              <div className="flex items-center gap-3 mb-3">
                <img src={TIER_LOGOS.free} alt="Free" className="h-10 w-10 object-contain" />
                <div className="text-sm font-bold text-white/60">Free</div>
              </div>
              <div className="text-3xl font-black text-white mb-1">$0<span className="text-base font-normal text-white/40">/mo</span></div>
              <p className="text-sm text-white/40 mb-6">375 daily credits. Resets every 24h.</p>
              <div className="space-y-2.5">
                {[
                  "375 daily free credits (non-accumulating)",
                  "Titan Builder — AI chat & sandbox",
                  "3 credential provider connections",
                  "AES-256-GCM encrypted vault",
                  "Grand Bazaar read access",
                ].map((f) => (
                  <div key={f} className="flex items-center gap-2 text-sm text-white/60"><Check className="h-4 w-4 text-red-400 shrink-0" />{f}</div>
                ))}
              </div>
              <Button onClick={() => { if (user) setLocation("/builder"); else window.location.href = getLoginUrl(); }} className="w-full mt-6 bg-white/5 hover:bg-white/10 text-white border border-white/10 h-11">Start Free</Button>
            </div>
            {/* Cyber — highlighted */}
            <div className="relative p-6 rounded-2xl border-2 border-red-500/40 bg-red-500/[0.04] hover:bg-red-500/[0.07] transition-all duration-300 ring-1 ring-red-500/20 shadow-xl shadow-red-500/10">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="px-3 py-1 rounded-full text-xs font-black bg-red-600 text-white shadow-lg shadow-red-600/30">MOST POPULAR</span>
              </div>
              <div className="flex items-center gap-3 mb-3">
                <img src={TIER_LOGOS.cyber} alt="Cyber" className="h-10 w-10 object-contain" />
                <div className="text-sm font-bold text-red-400">Cyber</div>
              </div>
              <div className="text-3xl font-black text-white mb-1">$199<span className="text-base font-normal text-white/40">/mo</span></div>
              <p className="text-sm text-white/40 mb-6">750,000 credits. Full security suite.</p>
              <div className="space-y-2.5">
                {[
                  "750,000 credits/month",
                  "Everything in Enterprise",
                  "Credential Leak Scanner",
                  "TOTP Vault",
                  "Astra Scanner + Argus OSINT",
                  "CyberMCP integration",
                ].map((f) => (
                  <div key={f} className="flex items-center gap-2 text-sm text-white/80"><Check className="h-4 w-4 text-red-400 shrink-0" />{f}</div>
                ))}
              </div>
              <Button onClick={() => { if (user) setLocation("/pricing"); else window.location.href = getRegisterUrl(); }} className="w-full mt-6 bg-red-600 hover:bg-red-500 text-white border-0 h-11 font-bold">Get Cyber</Button>
            </div>
            {/* Titan */}
            <div className="relative p-6 rounded-2xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] transition-all duration-300">
              <div className="flex items-center gap-3 mb-3">
                <img src={TIER_LOGOS.titan} alt="Titan" className="h-10 w-10 object-contain" />
                <div className="text-sm font-bold text-white/60">Titan</div>
              </div>
              <div className="text-3xl font-black text-white mb-1">$4,999<span className="text-base font-normal text-white/40">/mo</span></div>
              <p className="text-sm text-white/40 mb-6">10M credits. Full offensive tooling.</p>
              <div className="space-y-2.5">
                {[
                  "10,000,000 credits/month",
                  "Everything in Cyber+",
                  "Metasploit integration",
                  "Evilginx 3 + BlackEye",
                  "VPN Chain + Tor + Proxy Maker",
                  "On-premise deployment option",
                ].map((f) => (
                  <div key={f} className="flex items-center gap-2 text-sm text-white/60"><Check className="h-4 w-4 text-red-400 shrink-0" />{f}</div>
                ))}
              </div>
              <Button onClick={() => { if (user) setLocation("/pricing"); else window.location.href = getLoginUrl(); }} className="w-full mt-6 bg-white/5 hover:bg-white/10 text-white border border-white/10 h-11">Contact Sales</Button>
            </div>
          </div>
          <div className="text-center mt-8">
            <Link href="/pricing" className="text-sm text-red-400 hover:text-red-300 font-semibold transition-colors inline-flex items-center gap-1">
              View all 6 plans — Free, Pro, Enterprise, Cyber, Cyber+, Titan <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════
          FAQ
      ═══════════════════════════════════════════════════════════ */}
      <section id="faq" className="relative py-24 sm:py-32 border-t border-white/5">
        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <span className="text-sm font-bold text-red-400 tracking-widest uppercase">FAQ</span>
            <h2 className="mt-3 text-3xl sm:text-4xl font-black tracking-tight">Straight answers</h2>
          </div>
          <div className="divide-y divide-white/5">
            <FAQItem question="What exactly is Titan Builder?" answer="Titan Builder is the command center of the Archibald Titan platform. It's an AI-powered interactive console where you run tools, manage credentials, launch marketplace modules, control storage, and automate workflows — all from one interface. Everything in the platform connects back to Builder." />
            <FAQItem question="What security tools are actually built and working?" answer="Cyber tier: Credential Leak Scanner, TOTP Vault, Credential Health Monitor, Astra Scanner (active web scanning), Argus OSINT, and CyberMCP. Titan tier adds: Metasploit integration, Evilginx 3, BlackEye, Exploit Pack, VPN Chain Builder, Tor routing, and Proxy Maker. All are real, registered server-side routers — not placeholders." />
            <FAQItem question="Is the offensive tooling legal?" answer="Yes — when used on systems you own or have explicit written permission to test. These are industry-standard tools used by professional penetration testers and red teams. Misuse is against our terms of service and potentially illegal. Titan tier is for qualified security professionals." />
            <FAQItem question="What is the Grand Bazaar?" answer="The Grand Bazaar is Titan's built-in software marketplace. Buy and sell scripts, tools, templates, and digital services. Purchased modules can be launched directly inside Titan Builder. Paid tiers get full buy and sell access." />
            <FAQItem question="How do daily free credits work?" answer="Free tier users get 375 credits every day. They reset at midnight and do not accumulate — use them or lose them. That's enough for roughly 5 standard tasks per day. Free tier cannot buy boost packs; upgrade to a paid plan for more credits." />
            <FAQItem question="What does local-first mean?" answer="The AI agent and credential management run on your machine. Your prompts, credentials, and outputs stay local unless you explicitly export or deploy them. Nothing is sent to a shared cloud environment without your action." />
            <FAQItem question="Can I upgrade or downgrade at any time?" answer="Yes. Upgrades take effect immediately and you get the new credits right away. Downgrades take effect immediately — you're charged the new lower rate, but your credits only refresh when your billing cycle rolls over at month end." />
            <FAQItem question="Is there a team version?" answer="Enterprise includes team management for up to 25 seats with role-based access control and shared credential vaults. Cyber+ and Titan include unlimited seats and multi-org management." />
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════
          FINAL CTA
      ═══════════════════════════════════════════════════════════ */}
      <section className="relative py-24 sm:py-32 border-t border-white/5">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-red-700/12 rounded-full blur-[120px]" />
        </div>
        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl sm:text-5xl font-black tracking-tight">Titan Builder controls the whole ecosystem.</h2>
          <p className="mt-4 text-white/50 text-lg max-w-2xl mx-auto">Use it to run tools, manage marketplace assets, operate security modules, and automate your entire stack — from one console.</p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            {user ? (
              <Button size="lg" onClick={() => setLocation("/builder")} className="bg-red-600 hover:bg-red-500 text-white border-0 shadow-xl shadow-red-600/30 h-14 px-10 text-base font-bold gap-3">
                <Rocket className="h-5 w-5" />Launch Titan Builder
              </Button>
            ) : (
              <>
                <Button size="lg" onClick={() => { window.location.href = getRegisterUrl(); }} className="bg-red-600 hover:bg-red-500 text-white border-0 shadow-xl shadow-red-600/30 h-14 px-10 text-base font-bold gap-3">
                  <Rocket className="h-5 w-5" />Launch Titan Builder
                </Button>
                <Link href="/pricing">
                  <Button size="lg" variant="outline" className="border-white/10 bg-white/5 hover:bg-white/10 text-white h-12 px-8 text-base">
                    View All Plans <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </section>

      {/* AFFILIATE */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <AffiliateRecommendations context="landing" variant="card" limit={6} />
      </section>

      {/* FOOTER */}
      <footer className="relative border-t border-white/5 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-8">
            <div className="md:col-span-2">
              <div className="flex items-center gap-3 mb-4">
                <img loading="eager" src={AT_ICON_64} alt="AT" className="h-8 w-8 object-contain" />
                <span className="text-base font-black tracking-tight">Archibald Titan</span>
              </div>
              <p className="text-sm text-white/40 max-w-sm leading-relaxed">All Hats. One Stack. Titan Builder is the command center for the Archibald Titan ecosystem — security, building, and marketplace in one platform.</p>
              <div className="mt-4 flex items-center gap-4">
                <a href="https://www.snapchat.com/add/archibaldtitan" target="_blank" rel="noopener noreferrer" className="group" title="Add us on Snapchat">
                  <img loading="lazy" src="/snapchat-qr.png" alt="Snapchat QR" className="h-10 w-10 rounded-md opacity-60 group-hover:opacity-100 transition-opacity" />
                </a>
                <a href="https://github.com/archibaldtitan" target="_blank" rel="noopener noreferrer" className="text-white/30 hover:text-white/70 transition-colors" title="GitHub">
                  <Github className="h-5 w-5" />
                </a>
              </div>
            </div>
            <div>
              <h4 className="text-sm font-bold text-white/80 mb-4">Product</h4>
              <div className="space-y-2.5">
                <Link href="/builder" className="block text-sm text-red-400/80 hover:text-red-300 transition-colors font-semibold">Titan Builder</Link>
                <Link href="/pricing" className="block text-sm text-white/40 hover:text-white/70 transition-colors">Pricing</Link>
                <Link href="/security" className="block text-sm text-white/40 hover:text-white/70 transition-colors">Security</Link>
                <Link href="/changelog" className="block text-sm text-white/40 hover:text-white/70 transition-colors">Changelog</Link>
                <Link href="/docs" className="block text-sm text-white/40 hover:text-white/70 transition-colors">Documentation</Link>
              </div>
            </div>
            <div>
              <h4 className="text-sm font-bold text-white/80 mb-4">Resources</h4>
              <div className="space-y-2.5">
                <Link href="/use-cases" className="block text-sm text-white/40 hover:text-white/70 transition-colors">Use Cases</Link>
                <Link href="/blog" className="block text-sm text-white/40 hover:text-white/70 transition-colors">Blog</Link>
                <Link href="/about" className="block text-sm text-white/40 hover:text-white/70 transition-colors">About</Link>
                <Link href="/customers" className="block text-sm text-white/40 hover:text-white/70 transition-colors">Customers</Link>
                <Link href="/contact" className="block text-sm text-white/40 hover:text-white/70 transition-colors">Contact</Link>
              </div>
            </div>
            <div>
              <h4 className="text-sm font-bold text-white/80 mb-4">Legal</h4>
              <div className="space-y-2.5">
                <Link href="/terms" className="block text-sm text-white/40 hover:text-white/70 transition-colors">Terms & Conditions</Link>
                <Link href="/privacy" className="block text-sm text-white/40 hover:text-white/70 transition-colors">Privacy Policy</Link>
                <Link href="/contact" className="block text-sm text-white/40 hover:text-white/70 transition-colors">Contact & Billing</Link>
              </div>
            </div>
          </div>

          {/* LEEGO LOGO — click to enlarge, auto-shrinks after 1.8s */}
          <div className="mt-10 pt-6 border-t border-white/5 flex flex-col items-center">
            <button
              onClick={handleLeegoClick}
              className="focus:outline-none group"
              aria-label="Created by Leego"
              title="Created by Leego"
            >
              <img
                src="/Madebyleego.png"
                alt="Created by Leego"
                className={`object-contain opacity-100 brightness-110 transition-all duration-500 ease-in-out drop-shadow-[0_0_18px_rgba(0,255,50,0.8)] group-hover:drop-shadow-[0_0_28px_rgba(0,255,50,1)] group-hover:brightness-125 animate-pulse cursor-pointer ${leegoEnlarged ? "h-64 w-64" : "h-32 w-32"}`}
                style={{ filter: "drop-shadow(0 0 14px rgba(0, 255, 50, 0.7)) drop-shadow(0 0 28px rgba(0, 255, 50, 0.4)) drop-shadow(0 0 50px rgba(0, 255, 50, 0.2))" }}
                loading="lazy"
              />
            </button>
          </div>

          <div className="mt-6 pt-6 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs text-white/20">&copy; {new Date().getFullYear()} Archibald Titan. All rights reserved.</p>
            <div className="flex items-center gap-6">
              <Link href="/terms" className="text-xs text-white/20 hover:text-white/40 transition-colors">Terms</Link>
              <Link href="/privacy" className="text-xs text-white/20 hover:text-white/40 transition-colors">Privacy</Link>
              <Link href="/contact" className="text-xs text-white/20 hover:text-white/40 transition-colors">Contact</Link>
            </div>
          </div>
        </div>
      </footer>

      <div id="coming-soon-toast" className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-xl bg-white/10 backdrop-blur-xl border border-white/20 text-sm text-white shadow-2xl opacity-0 translate-y-4 transition-all duration-300 pointer-events-none">
        Download links will be available soon. Stay tuned!
      </div>
      {postDownloadTip && (
        <div className="fixed bottom-6 right-6 z-50 max-w-sm p-4 rounded-xl bg-red-600/20 backdrop-blur-xl border border-red-500/30 shadow-2xl">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-white mb-1">Download started!</p>
              <p className="text-xs text-white/60 leading-relaxed">{postDownloadTip}</p>
            </div>
            <button onClick={() => setPostDownloadTip(null)} className="text-white/40 hover:text-white/70 shrink-0"><X className="h-4 w-4" /></button>
          </div>
        </div>
      )}
    </div>
  );
}
