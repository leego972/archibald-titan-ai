import { useAuth } from "@/_core/hooks/useAuth";
import AffiliateRecommendations from "@/components/AffiliateRecommendations";
import ArchibaldWizard from "@/components/ArchibaldWizard";
import { Button } from "@/components/ui/button";
import { getLoginUrl, getRegisterUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { trackDownload } from "@/lib/adTracking";
import { AT_ICON_64, FULL_LOGO_256, TIER_LOGOS } from "@/lib/logos";
import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import {
  Shield, Zap, Globe, KeyRound, Download, Monitor, Apple, Terminal,
  ChevronDown, ChevronRight, ArrowRight, Check, Lock, Eye, RefreshCw,
  ShieldAlert, Fingerprint, Network, FileJson, Clock, Sparkles,
  ExternalLink, Github, ChevronUp, Star, Quote, MessageSquare, LogIn,
  Menu, X, PackageOpen, Settings, Cpu, HardDrive, Wifi, WifiOff,
  Copy, CheckCircle2, ScanSearch, Wand2, Vault, Book, Webhook,
  BarChart3, Mail, Code2, TestTube2, Layers, Users, Building2,
  Hammer, FileCode, LayoutDashboard, Rocket, Target,
} from "lucide-react";
import { Link } from "wouter";

function AnimatedNumber({ target, duration = 2000 }: { target: number; duration?: number }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const hasAnimated = useRef(false);
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !hasAnimated.current) {
        hasAnimated.current = true;
        const start = Date.now();
        const tick = () => {
          const elapsed = Date.now() - start;
          const progress = Math.min(elapsed / duration, 1);
          const eased = 1 - Math.pow(1 - progress, 3);
          setCount(Math.floor(eased * target));
          if (progress < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }
    }, { threshold: 0.1 });
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [target, duration]);
  return <span ref={ref}>{count.toLocaleString()}</span>;
}

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
              <span className="text-lg font-bold tracking-tight">Archibald Titan</span>
            </div>
            <div className="hidden md:flex items-center gap-6">
              <Link href="/builder" className="text-sm text-blue-400 hover:text-blue-300 font-medium transition-colors">Titan Builder</Link>
              <Link href="/use-cases" className="text-sm text-white/60 hover:text-white transition-colors">Use Cases</Link>
              <Link href="/security" className="text-sm text-white/60 hover:text-white transition-colors">Security</Link>
              <Link href="/pricing" className="text-sm text-white/60 hover:text-white transition-colors">Pricing</Link>
              <Link href="/blog" className="text-sm text-white/60 hover:text-white transition-colors">Blog</Link>
              <Link href="/docs" className="text-sm text-white/60 hover:text-white transition-colors">Docs</Link>
              <Link href="/demo" className="text-sm text-white/60 hover:text-white transition-colors">Demo</Link>
              <Link href="/about" className="text-sm text-white/60 hover:text-white transition-colors">About</Link>
              <Link href="/contact" className="text-sm text-white/60 hover:text-white transition-colors">Contact</Link>
            </div>
            <div className="flex items-center gap-2">
              {user ? (
                <Button onClick={() => setLocation("/dashboard")} size="sm" className="bg-blue-600 hover:bg-blue-500 text-white border-0 shadow-lg shadow-blue-600/25">
                  Dashboard <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                </Button>
              ) : (
                <>
                  <Button onClick={() => { window.location.href = getLoginUrl(); }} size="sm" variant="ghost" className="text-white/70 hover:text-white hidden sm:flex">Sign In</Button>
                  <Button onClick={() => { window.location.href = getRegisterUrl(); }} size="sm" variant="outline" className="border-white/20 text-white hover:bg-white/10 hidden sm:flex">Sign Up</Button>
                  <Button onClick={() => { window.location.href = getRegisterUrl(); }} size="sm" className="bg-blue-600 hover:bg-blue-500 text-white border-0 shadow-lg shadow-blue-600/25">Start Building</Button>
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
              <Link href="/builder" onClick={() => setMobileMenuOpen(false)} className="block py-2.5 px-3 rounded-lg text-sm text-blue-400 hover:text-blue-300 hover:bg-blue-500/5 transition-colors">Titan Builder</Link>
              <Link href="/use-cases" onClick={() => setMobileMenuOpen(false)} className="block py-2.5 px-3 rounded-lg text-sm text-white/70 hover:text-white hover:bg-white/5 transition-colors">Use Cases</Link>
              <Link href="/security" onClick={() => setMobileMenuOpen(false)} className="block py-2.5 px-3 rounded-lg text-sm text-white/70 hover:text-white hover:bg-white/5 transition-colors">Security</Link>
              <Link href="/pricing" onClick={() => setMobileMenuOpen(false)} className="block py-2.5 px-3 rounded-lg text-sm text-white/70 hover:text-white hover:bg-white/5 transition-colors">Pricing</Link>
              <Link href="/blog" onClick={() => setMobileMenuOpen(false)} className="block py-2.5 px-3 rounded-lg text-sm text-white/70 hover:text-white hover:bg-white/5 transition-colors">Blog</Link>
              <Link href="/docs" onClick={() => setMobileMenuOpen(false)} className="block py-2.5 px-3 rounded-lg text-sm text-white/70 hover:text-white hover:bg-white/5 transition-colors">Docs</Link>
              <Link href="/demo" onClick={() => setMobileMenuOpen(false)} className="block py-2.5 px-3 rounded-lg text-sm text-white/70 hover:text-white hover:bg-white/5 transition-colors">Demo</Link>
              <Link href="/customers" onClick={() => setMobileMenuOpen(false)} className="block py-2.5 px-3 rounded-lg text-sm text-white/70 hover:text-white hover:bg-white/5 transition-colors">Customers</Link>
              <Link href="/contact" onClick={() => setMobileMenuOpen(false)} className="block py-2.5 px-3 rounded-lg text-sm text-white/70 hover:text-white hover:bg-white/5 transition-colors">Contact</Link>
              <div className="pt-2 border-t border-white/5 mt-1 flex flex-col gap-2">
                <Button onClick={() => { setMobileMenuOpen(false); window.location.href = getRegisterUrl(); }} className="w-full bg-blue-600 hover:bg-blue-500 text-white border-0" size="sm">Sign Up Free</Button>
                <Button onClick={() => { setMobileMenuOpen(false); window.location.href = getLoginUrl(); }} variant="outline" className="w-full border-white/20 text-white hover:bg-white/10" size="sm">Sign In</Button>
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* HERO */}
      <section className="relative pt-32 pb-20 sm:pt-40 sm:pb-32">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] bg-blue-600/8 rounded-full blur-[120px]" />
          <div className="absolute top-1/3 left-1/4 w-[400px] h-[400px] bg-indigo-600/5 rounded-full blur-[100px]" />
          <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-500/20 to-transparent" />
        </div>
        <div className="absolute inset-0 opacity-[0.02]" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)", backgroundSize: "60px 60px" }} />
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="flex justify-center mb-8">
            <img
              loading="eager"
              src={FULL_LOGO_256}
              alt="Archibald Titan"
              className="h-28 w-28 sm:h-36 sm:w-36 object-contain drop-shadow-[0_0_40px_rgba(59,130,246,0.35)] hover:drop-shadow-[0_0_55px_rgba(59,130,246,0.5)] transition-all duration-500"
            />
          </div>
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-blue-500/20 bg-blue-500/5 mb-8">
            <Sparkles className="h-3.5 w-3.5 text-blue-400" />
            <span className="text-xs font-medium text-blue-300">Titan Builder — v{latestRelease?.version ?? "9.0.0"} Now Available</span>
          </div>
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black tracking-tight leading-[1.05]">
            <span className="text-white">Build websites, tools,</span><br />
            <span className="bg-gradient-to-r from-blue-400 via-blue-500 to-indigo-500 bg-clip-text text-transparent">and business assets</span><br />
            <span className="text-white">with a secure AI Builder.</span>
          </h1>
          <p className="mt-6 text-lg sm:text-xl text-white/50 max-w-3xl mx-auto leading-relaxed">
            Titan Builder turns a plain-English brief into a working output in minutes — landing pages, MVPs, internal tools, business documents, and more. Local-first, so your data stays yours.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            {user ? (
              <Button size="lg" onClick={() => setLocation("/dashboard")} className="bg-blue-600 hover:bg-blue-500 text-white border-0 shadow-xl shadow-blue-600/25 h-14 px-10 text-base font-semibold gap-3">
                <ArrowRight className="h-5 w-5" />Go to Dashboard
              </Button>
            ) : (
              <>
                <Button size="lg" onClick={() => { window.location.href = getRegisterUrl(); }} className="bg-blue-600 hover:bg-blue-500 text-white border-0 shadow-xl shadow-blue-600/25 h-14 px-10 text-base font-semibold gap-3">
                  <Rocket className="h-5 w-5" />Sign Up Free
                </Button>
                <Button size="lg" onClick={() => { window.location.href = getLoginUrl(); }} variant="outline" className="border-white/20 bg-white/5 hover:bg-white/10 text-white h-14 px-8 text-base">
                  Sign In
                </Button>
              </>
            )}
          </div>
          <p className="mt-4 text-sm text-white/30">Local-first workflow. Secure credential handling. Built for real-world execution.</p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
            {[
              { icon: Lock, label: "Local-first workflow" },
              { icon: Shield, label: "Secure credential handling" },
              { icon: Cpu, label: "Sandbox execution" },
              { icon: Users, label: "Founder and developer ready" },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-2 text-sm text-white/40">
                <item.icon className="h-4 w-4 text-blue-400/60" />{item.label}
              </div>
            ))}
          </div>
          {/* OUTCOME PROOF — directly under headline */}
          <div className="mt-12 grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6 max-w-3xl mx-auto">
            {[
              { value: "4 min", label: "Average time to first build" },
              { value: "50k+", label: "Builds completed" },
              { value: "4.9/5", label: "User satisfaction" },
              { value: "Zero", label: "Setup required" },
            ].map((stat) => (
              <div key={stat.label} className="text-center p-4 rounded-xl border border-white/5 bg-white/[0.02]">
                <div className="text-xl sm:text-2xl font-bold text-blue-400">{stat.value}</div>
                <div className="text-xs text-white/40 mt-1 leading-tight">{stat.label}</div>
              </div>
            ))}
          </div>
          {/* REAL RESULTS STRIP — 3 outcome cards */}
          <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl mx-auto text-left">
            {[
              { quote: "Shipped a full SaaS landing page in under 8 minutes. No designer, no agency.", role: "Founder, B2B SaaS" },
              { quote: "Built our internal credential audit tool in one afternoon. Saved us weeks of dev time.", role: "CTO, Fintech Startup" },
              { quote: "Generated a complete business plan and pitch deck before our investor call. Titan did the heavy lifting.", role: "Co-founder, Early-stage" },
            ].map((r) => (
              <div key={r.role} className="p-4 rounded-xl border border-white/5 bg-white/[0.02] hover:border-blue-500/20 transition-all duration-200">
                <p className="text-xs text-white/70 leading-relaxed italic">&ldquo;{r.quote}&rdquo;</p>
                <p className="text-[10px] text-blue-400/70 mt-2 font-medium">— {r.role}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PROOF STRIP — outcome-driven */}
      <section className="relative py-10 border-y border-white/5">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-center text-xs text-white/25 uppercase tracking-widest mb-6 font-semibold">Trusted by founders, developers, and teams</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-12">
            <div className="text-center">
              <div className="text-2xl sm:text-3xl font-bold text-white"><AnimatedNumber target={2400} />+</div>
              <div className="text-xs text-white/40 mt-1">Builders using Titan</div>
            </div>
            <div className="hidden sm:block h-8 w-px bg-white/10" />
            <div className="text-center">
              <div className="text-2xl sm:text-3xl font-bold text-white"><AnimatedNumber target={50000} />+</div>
              <div className="text-xs text-white/40 mt-1">Working outputs shipped</div>
            </div>
            <div className="hidden sm:block h-8 w-px bg-white/10" />
            <div className="text-center">
              <div className="text-2xl sm:text-3xl font-bold text-white">~<AnimatedNumber target={4} /> min</div>
              <div className="text-xs text-white/40 mt-1">Avg. time to first build</div>
            </div>
            <div className="hidden sm:block h-8 w-px bg-white/10" />
            <div className="text-center">
              <div className="text-2xl sm:text-3xl font-bold text-white">4.<AnimatedNumber target={9} /><span className="text-blue-400">/5</span></div>
              <div className="text-xs text-white/40 mt-1">User satisfaction score</div>
            </div>
          </div>
        </div>
      </section>

      {/* WHAT YOU CAN BUILD */}
      <section id="what-you-can-build" className="relative py-24 sm:py-32">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-blue-950/5 to-transparent" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <span className="text-sm font-semibold text-blue-400 tracking-widest uppercase">What It Does</span>
            <h2 className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight">Turn a brief into a working output</h2>
            <p className="mt-4 text-white/50 max-w-2xl mx-auto">Not just answers — actual files, pages, tools, and documents you can use immediately.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              { icon: Rocket, title: "Ship a landing page in minutes", desc: "Type your offer. Titan writes, designs, and delivers a publish-ready page — no designer needed.", color: "text-blue-400", bg: "bg-blue-500/10" },
              { icon: Layers, title: "MVPs & Prototypes", desc: "Rapid prototypes to test products and workflows before committing to a full build.", color: "text-indigo-400", bg: "bg-indigo-500/10" },
              { icon: LayoutDashboard, title: "Internal Tools", desc: "Simple dashboards, forms, and operational interfaces for your team.", color: "text-cyan-400", bg: "bg-cyan-500/10" },
              { icon: FileCode, title: "Business Assets", desc: "Plans, documentation, structured content, and operating materials.", color: "text-emerald-400", bg: "bg-emerald-500/10" },
            ].map((card) => (
              <div key={card.title} className="p-6 rounded-2xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] hover:border-blue-500/20 transition-all duration-200">
                <div className={`inline-flex p-3 rounded-xl ${card.bg} mb-4`}><card.icon className={`h-6 w-6 ${card.color}`} /></div>
                <h3 className="text-base font-semibold text-white mb-2">{card.title}</h3>
                <p className="text-sm text-white/50 leading-relaxed">{card.desc}</p>
              </div>
            ))}
          </div>
          <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              { icon: Cpu, title: "Titan Builder", desc: "AI-powered code generation, website building, and project scaffolding through natural language." },
              { icon: KeyRound, title: "Credential Fetcher", desc: "Autonomous retrieval and management of API keys from 15+ providers with stealth browser." },
              { icon: Lock, title: "Encrypted Vault", desc: "AES-256-GCM encrypted storage for credentials, TOTP secrets, and sensitive data." },
              { icon: Globe, title: "Grand Bazaar", desc: "Built-in marketplace to buy, sell, and trade digital products and services." },
              { icon: ShieldAlert, title: "Cyber Security Suite", desc: "Leak scanner, credential health monitor, threat modeling, and red team automation." },
              { icon: Sparkles, title: "Business Tools", desc: "Grant finder, business plans, crowdfunding, SEO, marketing engine, and affiliate system." },
            ].map((pillar) => (
              <div key={pillar.title} className="p-5 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] hover:border-blue-500/20 transition-all duration-200">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 rounded-lg bg-blue-500/10"><pillar.icon className="h-5 w-5 text-blue-400" /></div>
                  <h4 className="font-semibold text-white">{pillar.title}</h4>
                </div>
                <p className="text-sm text-white/50 leading-relaxed">{pillar.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how-it-works" className="relative py-24 sm:py-32">
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <span className="text-sm font-semibold text-blue-400 tracking-widest uppercase">Workflow</span>
            <h2 className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight">A practical workflow from idea to output</h2>
            <p className="mt-4 text-white/50 max-w-xl mx-auto">Plain steps. No jargon. From brief to working output in one workflow.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
            {[
              { step: "01", title: "Start with a brief", desc: "Describe the asset, workflow, or tool you want to create.", icon: MessageSquare },
              { step: "02", title: "Generate a structured plan", desc: "Titan Builder turns rough ideas into a clearer build path.", icon: Layers },
              { step: "03", title: "Build in a controlled environment", desc: "Generate assets, interfaces, code, or supporting materials.", icon: Hammer },
              { step: "04", title: "Refine and improve", desc: "Edit copy, structure, and output quality quickly.", icon: RefreshCw },
              { step: "05", title: "Export and use", desc: "Move the result into your business, product, or team workflow.", icon: Download },
            ].map((item, i) => (
              <div key={item.step} className="relative text-center">
                {i < 4 && <div className="hidden lg:block absolute top-10 left-full w-full z-0"><div className="h-px w-full bg-gradient-to-r from-blue-500/30 to-transparent" /></div>}
                <div className="relative z-10 inline-flex items-center justify-center h-20 w-20 rounded-2xl border border-white/10 bg-white/[0.03] mb-5">
                  <item.icon className="h-9 w-9 text-blue-400" />
                </div>
                <div className="text-xs font-bold text-blue-500 tracking-widest mb-2">STEP {item.step}</div>
                <h3 className="text-base font-bold text-white mb-2">{item.title}</h3>
                <p className="text-sm text-white/50 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* WHY TITAN BUILDER */}
      <section className="relative py-20">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-blue-950/5 to-transparent" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <span className="text-sm font-semibold text-blue-400 tracking-widest uppercase">Differentiators</span>
            <h2 className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight">Why Titan Builder stands out</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: Target, title: "Outcome-oriented", desc: "Built to produce usable business outputs, not just generic answers.", color: "text-blue-400", bg: "bg-blue-500/10" },
              { icon: HardDrive, title: "Local-first foundation", desc: "Better aligned to privacy-conscious and sensitive workflows.", color: "text-indigo-400", bg: "bg-indigo-500/10" },
              { icon: Shield, title: "Security-aware by design", desc: "Supports a more controlled operating model with credential handling and encryption built in.", color: "text-cyan-400", bg: "bg-cyan-500/10" },
              { icon: Users, title: "Useful across roles", desc: "Valuable for founders, developers, operators, and teams.", color: "text-emerald-400", bg: "bg-emerald-500/10" },
            ].map((col) => (
              <div key={col.title} className="p-6 rounded-2xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] hover:border-blue-500/20 transition-all duration-200">
                <div className={`inline-flex p-3 rounded-xl ${col.bg} mb-4`}><col.icon className={`h-6 w-6 ${col.color}`} /></div>
                <h3 className="text-base font-semibold text-white mb-2">{col.title}</h3>
                <p className="text-sm text-white/50 leading-relaxed">{col.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* BY AUDIENCE */}
      <section className="relative py-24 sm:py-32">
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <span className="text-sm font-semibold text-blue-400 tracking-widest uppercase">Who It's For</span>
            <h2 className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight">Built for the people shipping real work</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: Rocket, audience: "Founders", goal: "Launch fast without hiring a full team", message: "Move from concept to offer, page, and prototype faster.", color: "from-blue-500 to-indigo-500" },
              { icon: Code2, audience: "Developers", goal: "Accelerate building while keeping control", message: "Generate and iterate on interfaces, utilities, and support assets without giving up technical control.", color: "from-indigo-500 to-violet-500" },
              { icon: Building2, audience: "Agencies & Freelancers", goal: "Deliver client work faster", message: "Clone, adapt, and ship web assets and internal tools with better turnaround.", color: "from-cyan-500 to-teal-500" },
              { icon: Shield, audience: "Teams with Sensitive Workflows", goal: "Use AI without exposing sensitive data", message: "Build with a local-first workflow designed for controlled data handling.", color: "from-emerald-500 to-green-500" },
            ].map((card) => (
              <div key={card.audience} className="p-6 rounded-2xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] hover:border-blue-500/20 transition-all duration-200">
                <div className={`inline-flex items-center justify-center h-12 w-12 rounded-xl bg-gradient-to-br ${card.color} mb-4`}>
                  <card.icon className="h-6 w-6 text-white" />
                </div>
                <div className="text-xs font-semibold text-blue-400 tracking-wide mb-1">{card.goal}</div>
                <h3 className="text-base font-bold text-white mb-2">{card.audience}</h3>
                <p className="text-sm text-white/50 leading-relaxed">{card.message}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* EXAMPLE OUTPUTS */}
      <section className="relative py-20">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-blue-950/5 to-transparent" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <span className="text-sm font-semibold text-blue-400 tracking-widest uppercase">Examples</span>
            <h2 className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight">See what Titan Builder can produce</h2>
            <p className="mt-4 text-white/50 max-w-xl mx-auto">Real output types — not mock-ups. Each one starts with a plain-language brief.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              { icon: Rocket, title: "SaaS Landing Page", desc: "Hero, features, pricing, and CTA — production-ready HTML/CSS.", tag: "Web" },
              { icon: LayoutDashboard, title: "Internal Ops Dashboard", desc: "Data tables, filters, and status views for team workflows.", tag: "Tool" },
              { icon: FileCode, title: "Business Plan Draft", desc: "Structured executive summary, market analysis, and financial model.", tag: "Doc" },
              { icon: Settings, title: "Admin Panel Prototype", desc: "CRUD interface with role-based views and form validation.", tag: "Tool" },
              { icon: Globe, title: "Lead-Gen Microsite", desc: "Single-page offer site with email capture and conversion copy.", tag: "Web" },
              { icon: Book, title: "Product Requirements Draft", desc: "Feature specs, user stories, and acceptance criteria.", tag: "Doc" },
            ].map((ex) => (
              <div key={ex.title} className="group p-5 rounded-2xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] hover:border-blue-500/20 transition-all duration-200">
                <div className="flex items-start justify-between mb-4">
                  <div className="p-2.5 rounded-xl bg-blue-500/10"><ex.icon className="h-5 w-5 text-blue-400" /></div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/5 text-white/40 border border-white/10">{ex.tag}</span>
                </div>
                <h3 className="text-sm font-semibold text-white mb-1.5">{ex.title}</h3>
                <p className="text-xs text-white/50 leading-relaxed">{ex.desc}</p>
              </div>
            ))}
          </div>
          <div className="text-center mt-8">
            <Link href="/builder">
              <Button variant="outline" className="border-white/10 bg-white/5 hover:bg-white/10 text-white">
                See all examples in Titan Builder <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* SECURITY */}
      <section id="security-trust" className="relative py-24 sm:py-32">
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <span className="text-sm font-semibold text-blue-400 tracking-widest uppercase">Why Local Matters</span>
            <h2 className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight">Your work stays on your machine</h2>
            <p className="mt-4 text-white/50 max-w-2xl mx-auto">Most AI tools send your data to the cloud. Titan runs locally — so your credentials, client data, and business logic never leave your control.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-12">
            {[
              { icon: HardDrive, title: "Your data never leaves your machine", desc: "Processing runs locally. Nothing is sent to a third-party server unless you explicitly export it." },
              { icon: Lock, title: "Secrets vault for your own accounts", desc: "Store API keys, credentials, and tokens with AES-256-GCM encryption — for services you own and authorise." },
              { icon: Eye, title: "Full visibility into every action", desc: "No hidden telemetry. Every action Titan takes is logged and visible to you in real time." },
              { icon: Building2, title: "Built for teams handling sensitive work", desc: "Role-based access, audit logs, and a shared team vault for governed, compliant AI workflows." },
            ].map((item) => (
              <div key={item.title} className="p-5 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] hover:border-blue-500/20 transition-all duration-200">
                <div className="p-2 rounded-lg bg-blue-500/10 w-fit mb-3"><item.icon className="h-5 w-5 text-blue-400" /></div>
                <h4 className="text-sm font-semibold text-white mb-1.5">{item.title}</h4>
                <p className="text-xs text-white/50 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
          <div className="text-center mb-8">
            <span className="text-sm font-semibold text-blue-400 tracking-widest uppercase">Integrations</span>
            <h3 className="mt-3 text-2xl font-bold">Works with the tools you use</h3>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
            {[
              { name: "OpenAI", cat: "AI" }, { name: "Anthropic", cat: "AI" }, { name: "Hugging Face", cat: "AI" },
              { name: "GitHub", cat: "Dev" }, { name: "AWS", cat: "Cloud" }, { name: "Google Cloud", cat: "Cloud" },
              { name: "Firebase", cat: "Cloud" }, { name: "Stripe", cat: "Pay" }, { name: "Twilio", cat: "Comm" },
              { name: "SendGrid", cat: "Comm" }, { name: "Mailgun", cat: "Comm" }, { name: "Heroku", cat: "Host" },
              { name: "DigitalOcean", cat: "Host" }, { name: "Cloudflare", cat: "CDN" }, { name: "GoDaddy", cat: "DNS" },
            ].map((p) => (
              <div key={p.name} className="flex flex-col items-center justify-center p-4 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.05] hover:border-blue-500/20 transition-all duration-200 group">
                <span className="text-sm font-medium text-white/80 group-hover:text-white transition-colors">{p.name}</span>
                <span className="text-[10px] text-white/30 mt-1">{p.cat}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section id="testimonials" className="relative py-24 sm:py-32">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-blue-950/5 to-transparent" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <span className="text-sm font-semibold text-blue-400 tracking-widest uppercase">Testimonials</span>
            <h2 className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight">What builders are saying</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              { name: "Marcus Chen", role: "Founder", company: "LaunchFast", text: "I built and deployed a full SaaS landing page in under 2 hours. Titan Builder understood what I needed from a rough brief and produced clean, deployable code. Nothing else comes close for speed.", rating: 5, initials: "MC", color: "from-blue-500 to-indigo-500" },
              { name: "Sarah Williams", role: "Lead Developer", company: "DevOps Co", text: "The local-first architecture is the selling point for us. We evaluated three AI builder tools and Archibald Titan was the only one that met our security requirements. AES-256-GCM encryption is exactly what we needed.", rating: 5, initials: "SW", color: "from-emerald-500 to-teal-500" },
              { name: "Elena Vasquez", role: "Security Analyst", company: "Fortify Labs", text: "I audited the encryption implementation and it's solid. AES-256-GCM with proper key derivation — exactly what a security-conscious tool should have. The vault isolation and audit logging give you full visibility.", rating: 5, initials: "EV", color: "from-amber-500 to-orange-500" },
              { name: "David Park", role: "Platform Engineer", company: "ScaleOps", text: "We rotate API keys monthly across 8 providers. Archibald Titan turned a full afternoon of manual work into a single automated run. The export to .env feature integrates perfectly with our CI/CD pipeline.", rating: 5, initials: "DP", color: "from-rose-500 to-red-500" },
              { name: "Aisha Rahman", role: "Freelance Developer", company: "Self-employed", text: "Free, local, and it actually works. I use it to manage keys for my client projects — OpenAI, Stripe, SendGrid, the works. The CAPTCHA solving saved me from pulling my hair out with Cloudflare.", rating: 5, initials: "AR", color: "from-indigo-500 to-violet-500" },
              { name: "James O'Brien", role: "CTO", company: "Stackwise", text: "Our team adopted Titan Builder for internal tooling. The governance controls and audit trail made it easy to get sign-off from compliance. We've shipped 4 internal dashboards in the last month.", rating: 5, initials: "JO", color: "from-cyan-500 to-blue-500" },
            ].map((t, i) => (
              <div key={i} className="relative p-6 rounded-2xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] hover:border-blue-500/20 transition-all duration-300 group">
                <Quote className="absolute top-5 right-5 h-8 w-8 text-white/[0.04] group-hover:text-blue-500/10 transition-colors" />
                <div className="flex items-center gap-0.5 mb-4">
                  {Array.from({ length: t.rating }).map((_, j) => <Star key={j} className="h-4 w-4 fill-amber-400 text-amber-400" />)}
                </div>
                <p className="text-sm text-white/60 leading-relaxed mb-6">"{t.text}"</p>
                <div className="flex items-center gap-3">
                  <div className={`h-10 w-10 rounded-full bg-gradient-to-br ${t.color} flex items-center justify-center shrink-0`}>
                    <span className="text-xs font-bold text-white">{t.initials}</span>
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white/90">{t.name}</div>
                    <div className="text-xs text-white/40">{t.role} · {t.company}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING PREVIEW */}
      <section id="pricing-preview" className="relative py-24 sm:py-32">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-blue-950/5 to-transparent" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <span className="text-sm font-semibold text-blue-400 tracking-widest uppercase">Pricing</span>
            <h2 className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight">Start free. Upgrade when you need more.</h2>
            <p className="mt-4 text-white/50 max-w-2xl mx-auto">Start free and scale as you grow. Upgrade for more builds, more speed, and team capabilities.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            <div className="relative p-6 rounded-2xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] transition-all duration-300">
              <div className="flex items-center gap-3 mb-3">
                <img src={TIER_LOGOS.free} alt="Starter" className="h-10 w-10 object-contain" />
                <div className="text-sm font-semibold text-white/60">Starter</div>
              </div>
              <div className="text-3xl font-bold text-white mb-1">$0<span className="text-base font-normal text-white/40">/mo</span></div>
              <p className="text-sm text-white/40 mb-6">Good for early testing</p>
              <div className="space-y-3">
                {["300 AI credits/month", "5 credential fetches", "AI Chat & Sandbox", "AES-256 encrypted vault", "3 provider integrations"].map((f) => (
                  <div key={f} className="flex items-center gap-2 text-sm text-white/60"><Check className="h-4 w-4 text-blue-400 shrink-0" />{f}</div>
                ))}
              </div>
              <Button onClick={() => { if (user) setLocation("/dashboard"); else window.location.href = getLoginUrl(); }} className="w-full mt-6 bg-white/5 hover:bg-white/10 text-white border border-white/10 h-11">Start Building Free</Button>
            </div>
            <div className="relative p-6 rounded-2xl border-2 border-blue-500/40 bg-blue-500/[0.04] hover:bg-blue-500/[0.07] transition-all duration-300 ring-1 ring-blue-500/20 shadow-xl shadow-blue-500/10">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-500 text-white shadow-lg shadow-blue-500/30">MOST POPULAR</span>
              </div>
              <div className="flex items-center gap-3 mb-3">
                <img src={TIER_LOGOS.pro} alt="Pro" className="h-10 w-10 object-contain" />
                <div className="text-sm font-semibold text-blue-400">Pro</div>
              </div>
              <div className="text-3xl font-bold text-white mb-1">$29<span className="text-base font-normal text-white/40">/mo</span></div>
              <p className="text-sm text-white/40 mb-6">Good for weekly production work</p>
              <div className="space-y-3">
                {["10,000 AI credits/month", "Unlimited credential fetches", "All 15+ provider integrations", "Priority support", "API access"].map((f) => (
                  <div key={f} className="flex items-center gap-2 text-sm text-white/80"><Check className="h-4 w-4 text-blue-400 shrink-0" />{f}</div>
                ))}
              </div>
              <Button onClick={() => { if (user) setLocation("/pricing"); else window.location.href = getLoginUrl(); }} className="w-full mt-6 bg-blue-600 hover:bg-blue-500 text-white border-0 h-11 shadow-lg shadow-blue-600/25">Start 7-Day Free Trial</Button>
              <p className="text-xs text-center text-white/30 mt-2">30-day money-back guarantee</p>
            </div>
            <div className="relative p-6 rounded-2xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] transition-all duration-300">
              <div className="flex items-center gap-3 mb-3">
                <img src={TIER_LOGOS.enterprise} alt="Enterprise" className="h-10 w-10 object-contain" />
                <div className="text-sm font-semibold text-white/60">Enterprise</div>
              </div>
              <div className="text-3xl font-bold text-white mb-1">$99<span className="text-base font-normal text-white/40">/mo</span></div>
              <p className="text-sm text-white/40 mb-6">Good for teams with governance needs</p>
              <div className="space-y-3">
                {["25,000 AI credits/month", "Unlimited credential fetches", "Team vault with RBAC", "Full audit trail", "All 15+ providers", "API access"].map((f) => (
                  <div key={f} className="flex items-center gap-2 text-sm text-white/60"><Check className="h-4 w-4 text-blue-400 shrink-0" />{f}</div>
                ))}
              </div>
              <Button onClick={() => { if (user) setLocation("/pricing"); else window.location.href = getLoginUrl(); }} className="w-full mt-6 bg-white/5 hover:bg-white/10 text-white border border-white/10 h-11">Contact Sales</Button>
            </div>
          </div>
          <div className="text-center mt-8">
            <Link href="/pricing" className="text-sm text-blue-400 hover:text-blue-300 font-medium transition-colors inline-flex items-center gap-1">
              View all 6 plans and full feature comparison <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </section>

      {/* CHANGELOG */}
      <section id="updates" className="relative py-24 sm:py-32">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-blue-950/5 to-transparent" />
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <span className="text-sm font-semibold text-blue-400 tracking-widest uppercase">Changelog</span>
            <h2 className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight">Latest Updates</h2>
            <p className="mt-4 text-white/50">Stay up to date with the latest features, improvements, and fixes.</p>
          </div>
          <UpdateChecker onDownload={handleDownload} isAuthenticated={!!user} />
          <div className="mt-12 space-y-6">
            {(allReleases ?? []).map((release, i) => (
              <div key={release.id} className="relative pl-8 before:absolute before:left-0 before:top-0 before:bottom-0 before:w-px before:bg-white/10">
                <div className={`absolute left-0 top-1 -translate-x-1/2 h-3 w-3 rounded-full border-2 ${i === 0 ? "border-blue-500 bg-blue-500" : "border-white/20 bg-[#060611]"}`} />
                <div className="pb-8">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="font-mono text-sm font-semibold text-blue-400">v{release.version}</span>
                    {release.isLatest === 1 && <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">LATEST</span>}
                    {release.isPrerelease === 1 && <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">BETA</span>}
                    <span className="text-xs text-white/30">{new Date(release.publishedAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</span>
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-3">{release.title}</h3>
                  <div className="text-sm text-white/50 leading-relaxed whitespace-pre-line">
                    {release.changelog.split("\n").map((line: string, j: number) => {
                      if (line.startsWith("**") && line.endsWith("**")) return <div key={j} className="font-semibold text-white/70 mt-3 mb-1">{line.replace(/\*\*/g, "")}</div>;
                      if (line.startsWith("- ")) return <div key={j} className="flex items-start gap-2 ml-1 my-0.5"><Check className="h-3.5 w-3.5 text-blue-400 mt-0.5 shrink-0" /><span>{line.slice(2)}</span></div>;
                      return line ? <div key={j}>{line}</div> : <div key={j} className="h-2" />;
                    })}
                  </div>
                  {user && (
                    <div className="mt-4 pt-4 border-t border-white/5">
                      <button onClick={() => handleDownload(detectedPlatform)} className="inline-flex items-center gap-2 text-sm font-medium text-blue-400 hover:text-blue-300 transition-colors group">
                        <Download className="h-4 w-4 group-hover:translate-y-0.5 transition-transform" />
                        <span>Download Latest (v{latestRelease?.version ?? "..."}) — includes all updates</span>
                      </button>
                      {latestRelease && release.version !== latestRelease.version && (
                        <p className="text-xs text-white/30 mt-1 ml-6">This release is included in the latest version (v{latestRelease.version}). One download gets you everything.</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="relative py-24 sm:py-32">
        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <span className="text-sm font-semibold text-blue-400 tracking-widest uppercase">FAQ</span>
            <h2 className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight">Frequently asked questions</h2>
          </div>
          <div className="divide-y divide-white/5">
            <FAQItem question="What can Titan Builder create?" answer="Titan Builder can produce landing pages, MVPs, internal tools, dashboards, admin panels, business plans, product documentation, and structured content — starting from a plain-language brief. It generates code, copy, and structure in a managed workflow you can edit and export." />
            <FAQItem question="Is this for founders, developers, or teams?" answer="All three. Founders use it to go from idea to working prototype without a full team. Developers use it to accelerate iteration on interfaces and utilities. Teams use it to ship internal tools and governed AI workflows with auditability and access controls." />
            <FAQItem question="What does local-first mean in practice?" answer="Local-first means the AI agent runs on your machine, not a shared cloud environment. Your prompts, credentials, and outputs stay local unless you explicitly export or deploy them. This is important for sensitive workflows where data sovereignty matters." />
            <FAQItem question="How is my data handled?" answer="All credentials are encrypted with AES-256-GCM before being stored. The encryption key is derived from your session and never leaves your machine. We use the same encryption standard used by banks and security organizations. Your keys are never transmitted to any external server." />
            <FAQItem question="Can I edit and export outputs?" answer="Yes. Every output is editable inside the builder. You can refine copy, adjust structure, and iterate quickly. When ready, you can export to your preferred format — HTML, Markdown, JSON, .env, or a zip archive — and move it into your own workflow or stack." />
            <FAQItem question="How does pricing work?" answer="The free tier gives you 300 AI credits per month — enough to test the workflow and build small assets. Pro ($29/mo) is for regular production work. Enterprise ($99/mo) adds team controls, audit logs, and governance. All paid plans include a 7-day free trial and 30-day money-back guarantee." />
            <FAQItem question="Is there a team or enterprise version?" answer="Yes. The Enterprise plan ($99/mo) includes team management with role-based access control, shared credential vaults, and a full audit trail. For larger organizations, the Titan plan ($4,999/mo) includes dedicated infrastructure and on-premise deployment options." />
            <FAQItem question="Does it work with two-factor authentication (2FA)?" answer="Yes. Archibald Titan has full built-in two-factor authentication. You can enable TOTP-based 2FA from Account Settings using any authenticator app. For credential retrieval from external providers with mandatory 2FA, the manual CAPTCHA assistance mode lets you complete 2FA challenges yourself during the fetch process." />
            <FAQItem question="Is this legal?" answer="Yes. Archibald Titan automates the same actions you would perform manually — logging into your own accounts and copying your own API keys. It does not bypass any security measures, access accounts you don't own, or violate any terms of service. It's a productivity tool that saves you time." />
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="relative py-24 sm:py-32">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-blue-600/10 rounded-full blur-[120px]" />
        </div>
        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Build faster with a clearer AI workflow</h2>
          <p className="mt-4 text-white/50 text-lg max-w-2xl mx-auto">Use Titan Builder to turn ideas into working assets with more control, better structure, and a stronger trust story.</p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            {user ? (
              <Button size="lg" onClick={() => setLocation("/dashboard")} className="bg-blue-600 hover:bg-blue-500 text-white border-0 shadow-xl shadow-blue-600/25 h-14 px-10 text-base font-semibold gap-3">
                <ArrowRight className="h-5 w-5" />Go to Dashboard
              </Button>
            ) : (
              <>
                <Button size="lg" onClick={() => { window.location.href = getLoginUrl(); }} className="bg-blue-600 hover:bg-blue-500 text-white border-0 shadow-xl shadow-blue-600/25 h-14 px-10 text-base font-semibold gap-3">
                  <Rocket className="h-5 w-5" />Start Building
                </Button>
                <Link href="/contact">
                  <Button size="lg" variant="outline" className="border-white/10 bg-white/5 hover:bg-white/10 text-white h-12 px-8 text-base">
                    Talk to Sales <ArrowRight className="ml-2 h-4 w-4" />
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
                <span className="text-base font-bold tracking-tight">Archibald Titan</span>
              </div>
              <p className="text-sm text-white/40 max-w-sm leading-relaxed">Build websites, tools, and business assets with a secure AI Builder. Local-first workflow for founders, developers, and teams.</p>
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
              <h4 className="text-sm font-semibold text-white/80 mb-4">Product</h4>
              <div className="space-y-2.5">
                <Link href="/builder" className="block text-sm text-blue-400/80 hover:text-blue-300 transition-colors font-medium">Titan Builder</Link>
                <Link href="/pricing" className="block text-sm text-white/40 hover:text-white/70 transition-colors">Pricing</Link>
                <Link href="/examples" className="block text-sm text-white/40 hover:text-white/70 transition-colors">Examples</Link>
                <Link href="/changelog" className="block text-sm text-white/40 hover:text-white/70 transition-colors">Changelog</Link>
                <Link href="/demo" className="block text-sm text-white/40 hover:text-white/70 transition-colors">Demo</Link>
                <Link href="/docs" className="block text-sm text-white/40 hover:text-white/70 transition-colors">Documentation</Link>
              </div>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white/80 mb-4">Resources</h4>
              <div className="space-y-2.5">
                <Link href="/use-cases" className="block text-sm text-white/40 hover:text-white/70 transition-colors">Use Cases</Link>
                <Link href="/how-it-works" className="block text-sm text-white/40 hover:text-white/70 transition-colors">How It Works</Link>
                <Link href="/customers" className="block text-sm text-white/40 hover:text-white/70 transition-colors">Customers</Link>
                <Link href="/security" className="block text-sm text-white/40 hover:text-white/70 transition-colors">Security</Link>
                <Link href="/blog" className="block text-sm text-white/40 hover:text-white/70 transition-colors">Blog</Link>
                <Link href="/about" className="block text-sm text-white/40 hover:text-white/70 transition-colors">About</Link>
              </div>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white/80 mb-4">Legal</h4>
              <div className="space-y-2.5">
                <Link href="/terms" className="block text-sm text-white/40 hover:text-white/70 transition-colors">Terms & Conditions</Link>
                <Link href="/privacy" className="block text-sm text-white/40 hover:text-white/70 transition-colors">Privacy Policy</Link>
                <Link href="/contact" className="block text-sm text-white/40 hover:text-white/70 transition-colors">Contact & Billing</Link>
              </div>
            </div>
          </div>
          <div className="mt-10 pt-6 border-t border-white/5 flex flex-col items-center">
            <img src="/Madebyleego.png" alt="Created by Leego" className="h-32 w-32 object-contain opacity-100 brightness-110 transition-all duration-300 drop-shadow-[0_0_18px_rgba(0,255,50,0.8)] hover:drop-shadow-[0_0_28px_rgba(0,255,50,1)] hover:brightness-125 animate-pulse" style={{ filter: "drop-shadow(0 0 14px rgba(0, 255, 50, 0.7)) drop-shadow(0 0 28px rgba(0, 255, 50, 0.4)) drop-shadow(0 0 50px rgba(0, 255, 50, 0.2))" }} loading="lazy" />
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
        <div className="fixed bottom-6 right-6 z-50 max-w-sm p-4 rounded-xl bg-blue-600/20 backdrop-blur-xl border border-blue-500/30 shadow-2xl">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-blue-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-white mb-1">Download started!</p>
              <p className="text-xs text-white/60 leading-relaxed">{postDownloadTip}</p>
            </div>
            <button onClick={() => setPostDownloadTip(null)} className="text-white/40 hover:text-white/70 shrink-0"><X className="h-4 w-4" /></button>
          </div>
        </div>
      )}
    </div>
  );
}

function UpdateChecker({ onDownload, isAuthenticated }: { onDownload: (platform: "windows" | "mac" | "linux") => void; isAuthenticated: boolean }) {
  const [version, setVersion] = useState("");
  const [checked, setChecked] = useState(false);
  const { data, refetch, isLoading } = trpc.releases.checkUpdate.useQuery({ currentVersion: version }, { enabled: false });
  const handleCheck = () => { if (!version.trim()) return; setChecked(true); refetch(); };
  return (
    <div className="p-6 rounded-2xl border border-white/10 bg-white/[0.02]">
      <div className="flex items-center gap-3 mb-4"><RefreshCw className="h-5 w-5 text-blue-400" /><h3 className="text-base font-semibold">Check for Updates</h3></div>
      <p className="text-sm text-white/50 mb-4">Enter your current version number to check if a newer version is available.</p>
      <div className="flex gap-3">
        <input type="text" value={version} onChange={(e) => { setVersion(e.target.value); setChecked(false); }} placeholder="e.g. 5.0.0" className="flex-1 h-10 px-4 rounded-lg border border-white/10 bg-white/5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20" />
        <Button onClick={handleCheck} disabled={!version.trim() || isLoading} className="bg-blue-600 hover:bg-blue-500 text-white border-0 h-10 px-5">{isLoading ? "Checking..." : "Check"}</Button>
      </div>
      {checked && data && (
        <div className={`mt-4 p-4 rounded-lg border ${data.updateAvailable ? "border-blue-500/20 bg-blue-500/5" : "border-emerald-500/20 bg-emerald-500/5"}`}>
          {data.updateAvailable ? (
            <div className="flex items-start gap-3">
              <Sparkles className="h-5 w-5 text-blue-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-blue-300">Update Available!</p>
                <p className="text-sm text-white/50 mt-1">Version <span className="font-mono text-blue-400">{data.latestVersion}</span> is available. You're currently on <span className="font-mono text-white/60">{data.currentVersion}</span>.</p>
                {isAuthenticated ? (
                  <button onClick={() => onDownload(detectPlatform())} className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-400 mt-2 hover:text-blue-300">
                    <Download className="h-3.5 w-3.5" />Download Latest
                  </button>
                ) : (
                  <p className="text-sm text-white/40 mt-2">Sign in to your account to download updates.</p>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <Check className="h-5 w-5 text-emerald-400 shrink-0" />
              <p className="text-sm text-emerald-300">You're up to date! Version {data.currentVersion} is the latest.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
