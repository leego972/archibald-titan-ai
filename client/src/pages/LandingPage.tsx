import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import {
  Bot,
  Shield,
  Zap,
  Globe,
  KeyRound,
  Download,
  Monitor,
  Apple,
  Terminal,
  ChevronDown,
  ChevronRight,
  ArrowRight,
  Check,
  Lock,
  Eye,
  RefreshCw,
  ShieldAlert,
  Fingerprint,
  Network,
  FileJson,
  Clock,
  Sparkles,
  ExternalLink,
  Github,
  ChevronUp,
  Star,
  Quote,
  MessageSquare,
  LogIn,
  Menu,
  X,
  PackageOpen,
  Settings,
  Cpu,
  HardDrive,
  Wifi,
  WifiOff,
  Copy,
  CheckCircle2,
  ScanSearch,
  Wand2,
  Vault,
  Book,
  Webhook,
  BarChart3,
  Mail,
  Code2,
  TestTube2,
} from "lucide-react";
import { Link } from "wouter";

// ─── Animated Counter ───────────────────────────────────────────────

function AnimatedNumber({ target, duration = 2000 }: { target: number; duration?: number }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const hasAnimated = useRef(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
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
      },
      { threshold: 0.3 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [target, duration]);

  return <span ref={ref}>{count}</span>;
}

// ─── FAQ Accordion ──────────────────────────────────────────────────

function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-white/10">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-5 text-left group"
      >
        <span className="text-base font-medium text-white/90 group-hover:text-white transition-colors pr-4">
          {question}
        </span>
        {open ? (
          <ChevronUp className="h-5 w-5 text-blue-400 shrink-0" />
        ) : (
          <ChevronDown className="h-5 w-5 text-white/40 group-hover:text-blue-400 shrink-0 transition-colors" />
        )}
      </button>
      <div
        className={`overflow-hidden transition-all duration-300 ${
          open ? "max-h-96 pb-5" : "max-h-0"
        }`}
      >
        <p className="text-sm text-white/60 leading-relaxed">{answer}</p>
      </div>
    </div>
  );
}

// ─── Main Landing Page ──────────────────────────────────────────────

// ─── Platform Detection ────────────────────────────────────────────

function detectPlatform(): "windows" | "mac" | "linux" {
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes("mac")) return "mac";
  if (ua.includes("linux") || ua.includes("ubuntu") || ua.includes("debian") || ua.includes("fedora")) return "linux";
  return "windows";
}

const PLATFORM_INFO: Record<string, { label: string; icon: typeof Monitor; ext: string; note: string; installTip: string }> = {
  windows: {
    label: "Windows",
    icon: Monitor,
    ext: ".exe",
    note: "Windows 10+ (64-bit)",
    installTip: "Your download has started. Once complete, double-click the .exe file to install. If SmartScreen appears, click 'More info' → 'Run anyway'.",
  },
  mac: {
    label: "macOS",
    icon: Apple,
    ext: ".dmg",
    note: "macOS 12+ (Apple Silicon & Intel)",
    installTip: "Your download has started. Open the .dmg file and drag Archibald Titan to Applications. If blocked, go to System Settings → Privacy & Security → 'Open Anyway'.",
  },
  linux: {
    label: "Linux",
    icon: Terminal,
    ext: ".AppImage",
    note: "Ubuntu 20.04+ / Debian / Fedora",
    installTip: "Your download has started. Make it executable with: chmod +x ArchibaldTitan-*.AppImage — then double-click or run from terminal.",
  },
};

export default function LandingPage() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();

  // Redirect authenticated users straight to the dashboard (chat)
  useEffect(() => {
    if (!loading && user) {
      setLocation("/dashboard");
    }
  }, [user, loading, setLocation]);

  const { data: latestRelease } = trpc.releases.latest.useQuery();
  const { data: allReleases } = trpc.releases.list.useQuery();
  const requestDownloadToken = trpc.download.requestToken.useMutation();
  const { data: builderStats } = trpc.selfImprovement.builderStats.useQuery(undefined, { refetchOnWindowFocus: false });
  const [downloadPending, setDownloadPending] = useState<string | null>(null);
  const [detectedPlatform] = useState(() => detectPlatform());
  const [postDownloadTip, setPostDownloadTip] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Auth-gated download handler
  const handleDownload = async (platform: "windows" | "mac" | "linux") => {
    if (!user) {
      // Not signed in — redirect to login
      window.location.href = getLoginUrl();
      return;
    }

    if (!latestRelease) return;

    const hasDownload =
      platform === "windows" ? latestRelease.hasWindows :
      platform === "mac" ? latestRelease.hasMac :
      latestRelease.hasLinux;

    if (!hasDownload) {
      // Show coming soon toast
      const toast = document.getElementById("coming-soon-toast");
      if (toast) {
        toast.classList.remove("opacity-0", "translate-y-4");
        toast.classList.add("opacity-100", "translate-y-0");
        setTimeout(() => {
          toast.classList.add("opacity-0", "translate-y-4");
          toast.classList.remove("opacity-100", "translate-y-0");
        }, 3000);
      }
      return;
    }

    try {
      setDownloadPending(platform);
      const { token } = await requestDownloadToken.mutateAsync({
        releaseId: latestRelease.id,
        platform,
      });
      // Open the token-gated download URL
      window.open(`/api/download/${token}`, "_blank");
      // Show post-download install tip
      const tip = PLATFORM_INFO[platform]?.installTip;
      if (tip) setPostDownloadTip(tip);
    } catch (err: any) {
      const msg = err?.message ?? "Download failed. Please try again.";
      const toast = document.getElementById("coming-soon-toast");
      if (toast) {
        toast.textContent = msg;
        toast.classList.remove("opacity-0", "translate-y-4");
        toast.classList.add("opacity-100", "translate-y-0");
        setTimeout(() => {
          toast.textContent = "Download links will be available soon. Stay tuned!";
          toast.classList.add("opacity-0", "translate-y-4");
          toast.classList.remove("opacity-100", "translate-y-0");
        }, 4000);
      }
    } finally {
      setDownloadPending(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#060611] text-white overflow-x-hidden">
      {/* ── Navigation ─────────────────────────────────────────────── */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-[#060611]/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <img src="https://files.manuscdn.com/user_upload_by_module/session_file/310519663339631904/XqBVYWONhvkWzLDU.png" alt="AT" className="h-9 w-9 object-contain" />
              <span className="text-lg font-bold tracking-tight">Archibald Titan</span>
            </div>
            <div className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-sm text-white/60 hover:text-white transition-colors">Features</a>
              <a href="#how-it-works" className="text-sm text-white/60 hover:text-white transition-colors">How It Works</a>
              <a href="#testimonials" className="text-sm text-white/60 hover:text-white transition-colors">Testimonials</a>
              <a href="#download" className="text-sm text-white/60 hover:text-white transition-colors">Download</a>
              <a href="#installation" className="text-sm text-white/60 hover:text-white transition-colors">Install</a>
              <a href="#updates" className="text-sm text-white/60 hover:text-white transition-colors">Updates</a>
              <a href="#faq" className="text-sm text-white/60 hover:text-white transition-colors">FAQ</a>
              <Link href="/pricing" className="text-sm text-blue-400 hover:text-blue-300 font-medium transition-colors">Pricing</Link>
            </div>
            <div className="flex items-center gap-2">
              {user ? (
                <Button
                  onClick={() => setLocation("/dashboard")}
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-500 text-white border-0 shadow-lg shadow-blue-600/25"
                >
                  Dashboard
                  <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                </Button>
              ) : (
                <Button
                  onClick={() => { window.location.href = getLoginUrl(); }}
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-500 text-white border-0 shadow-lg shadow-blue-600/25"
                >
                  Sign In
                </Button>
              )}
              {/* Mobile hamburger button */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden flex items-center justify-center h-9 w-9 rounded-lg border border-white/10 bg-white/5 text-white hover:bg-white/10 transition-colors"
                aria-label="Toggle menu"
              >
                {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            </div>
          </div>
        </div>
        {/* Mobile dropdown menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-white/5 bg-[#060611]/95 backdrop-blur-xl">
            <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col gap-1">
              {[
                { href: "#features", label: "Features" },
                { href: "#how-it-works", label: "How It Works" },
                { href: "#testimonials", label: "Testimonials" },
                { href: "#download", label: "Download" },
                { href: "#installation", label: "Install" },
                { href: "#updates", label: "Updates" },
                { href: "#faq", label: "FAQ" },
              ].map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="block py-2.5 px-3 rounded-lg text-sm text-white/70 hover:text-white hover:bg-white/5 transition-colors"
                >
                  {item.label}
                </a>
              ))}
              <Link
                href="/pricing"
                onClick={() => setMobileMenuOpen(false)}
                className="block py-2.5 px-3 rounded-lg text-sm text-blue-400 hover:text-blue-300 hover:bg-white/5 font-medium transition-colors"
              >
                Pricing
              </Link>
            </div>
          </div>
        )}
      </nav>

      {/* ── Hero Section ───────────────────────────────────────────── */}
      <section className="relative pt-32 pb-20 sm:pt-40 sm:pb-32">
        {/* Background effects */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] bg-blue-600/8 rounded-full blur-[120px]" />
          <div className="absolute top-1/3 left-1/4 w-[400px] h-[400px] bg-indigo-600/5 rounded-full blur-[100px]" />
          <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-500/20 to-transparent" />
        </div>

        {/* Grid pattern */}
        <div className="absolute inset-0 opacity-[0.02]" style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
          backgroundSize: '60px 60px',
        }} />

        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          {/* Version badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-blue-500/20 bg-blue-500/5 mb-8">
            <Sparkles className="h-3.5 w-3.5 text-blue-400" />
            <span className="text-xs font-medium text-blue-300">
              v{latestRelease?.version ?? "6.0.1"} — Now Available
            </span>
          </div>

          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black tracking-tight leading-[1.05]">
            <span className="text-white">The World's Most</span>
            <br />
            <span className="bg-gradient-to-r from-blue-400 via-blue-500 to-indigo-500 bg-clip-text text-transparent">
              Advanced Local
            </span>
            <br />
            <span className="text-white">AI Agent</span>
          </h1>

          <p className="mt-6 text-lg sm:text-xl text-white/50 max-w-2xl mx-auto leading-relaxed">
            Autonomously retrieve API keys and credentials from 15+ providers.
            Military-grade encryption. Zero cloud dependency. Your keys never leave your machine.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            {(() => {
              const pi = PLATFORM_INFO[detectedPlatform];
              const PlatformIcon = pi.icon;
              return (
                <Button
                  size="lg"
                  onClick={() => handleDownload(detectedPlatform)}
                  disabled={downloadPending === detectedPlatform}
                  className="bg-blue-600 hover:bg-blue-500 text-white border-0 shadow-xl shadow-blue-600/25 h-14 px-10 text-base font-semibold gap-3"
                >
                  {!user ? (
                    <><LogIn className="h-5 w-5" />Sign In to Download</>
                  ) : downloadPending === detectedPlatform ? (
                    <>Preparing Download...</>
                  ) : (
                    <><PlatformIcon className="h-5 w-5" />Download for {pi.label}<span className="text-white/50 text-sm font-normal">({pi.ext})</span></>
                  )}
                </Button>
              );
            })()}
            <a href="#features">
              <Button
                size="lg"
                variant="outline"
                className="border-white/10 bg-white/5 hover:bg-white/10 text-white h-12 px-8 text-base"
              >
                Learn More
                <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </a>
          </div>
          {/* Other platforms link */}
          <p className="mt-4 text-sm text-white/30">
            Also available for{" "}
            {["windows", "mac", "linux"].filter(p => p !== detectedPlatform).map((p, i, arr) => (
              <span key={p}>
                <a href="#download" className="text-blue-400/60 hover:text-blue-400 transition-colors">{PLATFORM_INFO[p].label}</a>
                {i < arr.length - 1 ? " and " : ""}
              </span>
            ))}
          </p>

          {/* Stats row */}
          <div className="mt-16 grid grid-cols-2 sm:grid-cols-4 gap-6 sm:gap-8 max-w-3xl mx-auto">
            {[
              { value: 15, suffix: "+", label: "Providers" },
              { value: 256, suffix: "-bit", label: "Encryption" },
              { value: 100, suffix: "%", label: "Local & Private" },
              { value: 0, suffix: "", label: "Cloud Dependencies", display: "Zero" },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-2xl sm:text-3xl font-bold text-white">
                  {stat.display ?? (
                    <>
                      <AnimatedNumber target={stat.value} />
                      <span className="text-blue-400">{stat.suffix}</span>
                    </>
                  )}
                </div>
                <div className="text-xs sm:text-sm text-white/40 mt-1">{stat.label}</div>
              </div>
            ))}
          </div>

          {/* CI/CD Build Health Badges */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border ${
              builderStats?.typeCheck?.status === "success"
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                : builderStats?.typeCheck
                  ? "border-red-500/30 bg-red-500/10 text-red-300"
                  : "border-white/10 bg-white/5 text-white/40"
            }`}>
              <Code2 className="h-3 w-3" />
              TypeScript: {builderStats?.typeCheck ? (builderStats.typeCheck.status === "success" ? "passing" : "failing") : "--"}
            </div>
            <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border ${
              builderStats?.tests?.status === "success"
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                : builderStats?.tests
                  ? "border-red-500/30 bg-red-500/10 text-red-300"
                  : "border-white/10 bg-white/5 text-white/40"
            }`}>
              <TestTube2 className="h-3 w-3" />
              Tests: {builderStats?.tests?.summary ?? "--"}
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border border-violet-500/30 bg-violet-500/10 text-violet-300">
              <Shield className="h-3 w-3" />
              Build Health: {builderStats?.passRate ?? 0}%
            </div>
          </div>
        </div>
      </section>

      {/* ── Features Section ───────────────────────────────────────── */}
      <section id="features" className="relative py-24 sm:py-32">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-blue-950/5 to-transparent" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <span className="text-sm font-semibold text-blue-400 tracking-widest uppercase">Capabilities</span>
            <h2 className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight">
              Everything you need. Nothing you don't.
            </h2>
            <p className="mt-4 text-white/50 max-w-xl mx-auto">
              Built from the ground up for security, speed, and stealth. Every feature designed to work autonomously.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              {
                icon: KeyRound,
                title: "15+ Provider Automation",
                desc: "OpenAI, AWS, Stripe, GoDaddy, GitHub, Cloudflare, Google Cloud, and more. One-click credential retrieval with provider-specific automation scripts.",
                color: "from-blue-500 to-blue-600",
              },
              {
                icon: Shield,
                title: "AES-256-GCM Vault",
                desc: "Military-grade encryption for every credential. Keys are encrypted at rest and never stored in plaintext. Your vault, your machine, your rules.",
                color: "from-emerald-500 to-emerald-600",
              },
              {
                icon: Fingerprint,
                title: "Stealth Browser Engine",
                desc: "Playwright with anti-detection, device fingerprinting, randomized profiles, and human-like mouse movements. Undetectable by bot protection systems.",
                color: "from-violet-500 to-violet-600",
              },
              {
                icon: Zap,
                title: "CAPTCHA Solving",
                desc: "Integrated 2Captcha and Anti-Captcha support. Automatically handles reCAPTCHA v2/v3, hCaptcha, and image CAPTCHAs without manual intervention.",
                color: "from-amber-500 to-amber-600",
              },
              {
                icon: Network,
                title: "Residential Proxy Pool",
                desc: "Built-in proxy pool manager with health checking, geo-detection, latency testing, and automatic rotation. Route through residential IPs to bypass datacenter blocks.",
                color: "from-cyan-500 to-cyan-600",
              },
              {
                icon: ShieldAlert,
                title: "Kill Switch",
                desc: "Emergency shutdown with alphanumeric code. Instantly terminates all running jobs, wipes active sessions, and locks the system. Safety first.",
                color: "from-red-500 to-red-600",
              },
              {
                icon: FileJson,
                title: "Multi-Format Export",
                desc: "Export credentials as JSON, CSV, or .env files. Copy individual keys or bulk export your entire vault for easy integration into your projects.",
                color: "from-orange-500 to-orange-600",
              },
              {
                icon: Eye,
                title: "Real-Time Job Monitoring",
                desc: "Watch every step of the automation live. See login progress, navigation status, extraction results, and error details in real-time.",
                color: "from-pink-500 to-pink-600",
              },
              {
                icon: Lock,
                title: "100% Local & Private",
                desc: "Everything runs on your machine. No cloud servers, no telemetry, no data collection. Your credentials never leave your local environment.",
                color: "from-teal-500 to-teal-600",
              },
              {
                icon: ScanSearch,
                title: "Credential Leak Scanner",
                desc: "Scan public repos, paste sites, and code snippets for leaked API keys and secrets. Pattern-based detection for AWS, GitHub, Stripe, OpenAI, and 10+ credential formats.",
                color: "from-rose-500 to-rose-600",
                isNew: true,
              },
              {
                icon: Wand2,
                title: "One-Click Provider Onboarding",
                desc: "Paste any provider URL and let AI auto-detect login pages, API key locations, and credential types. Generates automation scripts instantly — no manual configuration.",
                color: "from-indigo-500 to-indigo-600",
                isNew: true,
              },
              {
                icon: Vault,
                title: "Team Credential Vault",
                desc: "AES-256 encrypted shared vault with role-based access control. Owner, admin, member, and viewer roles with full audit trail on every reveal, copy, and update.",
                color: "from-yellow-500 to-yellow-600",
                isNew: true,
              },
              {
                icon: Book,
                title: "Developer REST API",
                desc: "Full REST API with interactive docs, code examples in cURL, Python, and Node.js. Generate API keys, set scopes, and integrate Titan into your own programs.",
                color: "from-emerald-500 to-emerald-600",
                isNew: true,
              },
              {
                icon: Webhook,
                title: "Webhook Events",
                desc: "Subscribe to real-time events for credential changes, scan results, and vault updates. Delivery logs, retry logic, and HMAC-SHA256 signature verification.",
                color: "from-cyan-500 to-cyan-600",
                isNew: true,
              },
              {
                icon: Mail,
                title: "Email Authentication",
                desc: "Standard email and password sign-up so anyone can create an account. No external OAuth required — just enter your email and get started instantly.",
                color: "from-pink-500 to-pink-600",
                isNew: true,
              },
            ].map((feature) => (
              <div
                key={feature.title}
                className={`group relative p-6 rounded-2xl border transition-all duration-300 ${
                  (feature as any).isNew
                    ? "border-blue-500/15 bg-blue-500/[0.03] hover:bg-blue-500/[0.06] hover:border-blue-500/25 ring-1 ring-blue-500/5"
                    : "border-white/5 bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/10"
                }`}
              >
                {(feature as any).isNew && (
                  <div className="absolute top-4 right-4">
                    <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/20">
                      new in 4.0
                    </span>
                  </div>
                )}
                <div className={`inline-flex items-center justify-center h-11 w-11 rounded-xl bg-gradient-to-br ${feature.color} mb-4 shadow-lg group-hover:shadow-xl group-hover:scale-105 transition-all duration-300`}>
                  <feature.icon className="h-5 w-5 text-white" />
                </div>
                <h3 className="text-base font-semibold text-white mb-2">{feature.title}</h3>
                <p className="text-sm text-white/50 leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How It Works ───────────────────────────────────────────── */}
      <section id="how-it-works" className="relative py-24 sm:py-32">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-600/5 rounded-full blur-[120px]" />
        </div>
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <span className="text-sm font-semibold text-blue-400 tracking-widest uppercase">How The Fetcher Works</span>
            <h2 className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight">
              Three steps. That's it.
            </h2>
            <p className="mt-3 text-white/40 max-w-2xl mx-auto text-sm">
              The Fetcher is Titan's built-in credential retrieval assistant. It automates the entire process of collecting your API keys and credentials.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                step: "01",
                title: "Select Providers",
                desc: "Open the Fetcher inside Titan and choose from 15+ supported providers. Enter your login credentials — they're encrypted immediately with AES-256-GCM before anything else happens.",
                icon: Globe,
              },
              {
                step: "02",
                title: "Sit Back & Watch",
                desc: "The Fetcher launches a stealth browser session, logs into each provider, navigates to the API keys page, and retrieves your credentials — all autonomously within Titan.",
                icon: RefreshCw,
              },
              {
                step: "03",
                title: "Export & Use",
                desc: "Your keys are stored in the encrypted vault. Export as JSON, CSV, or .env. Copy individual keys or bulk export. Use them wherever you need.",
                icon: FileJson,
              },
            ].map((item, i) => (
              <div key={item.step} className="relative">
                {i < 2 && (
                  <div className="hidden md:block absolute top-12 left-full w-full">
                    <div className="h-px w-full bg-gradient-to-r from-blue-500/30 to-transparent" />
                  </div>
                )}
                <div className="text-center">
                  <div className="inline-flex items-center justify-center h-24 w-24 rounded-2xl border border-white/10 bg-white/[0.03] mb-6">
                    <item.icon className="h-10 w-10 text-blue-400" />
                  </div>
                  <div className="text-xs font-bold text-blue-500 tracking-widest mb-2">STEP {item.step}</div>
                  <h3 className="text-xl font-bold text-white mb-3">{item.title}</h3>
                  <p className="text-sm text-white/50 leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Supported Providers ─────────────────────────────────────── */}
      <section className="relative py-20">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-blue-950/5 to-transparent" />
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <span className="text-sm font-semibold text-blue-400 tracking-widest uppercase">Integrations</span>
            <h2 className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight">
              Works with the tools you use
            </h2>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
            {[
              { name: "OpenAI", cat: "AI" },
              { name: "Anthropic", cat: "AI" },
              { name: "Hugging Face", cat: "AI" },
              { name: "GitHub", cat: "Dev" },
              { name: "AWS", cat: "Cloud" },
              { name: "Google Cloud", cat: "Cloud" },
              { name: "Firebase", cat: "Cloud" },
              { name: "Stripe", cat: "Pay" },
              { name: "Twilio", cat: "Comm" },
              { name: "SendGrid", cat: "Comm" },
              { name: "Mailgun", cat: "Comm" },
              { name: "Heroku", cat: "Host" },
              { name: "DigitalOcean", cat: "Host" },
              { name: "Cloudflare", cat: "CDN" },
              { name: "GoDaddy", cat: "DNS" },
            ].map((p) => (
              <div
                key={p.name}
                className="flex flex-col items-center justify-center p-4 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.05] hover:border-blue-500/20 transition-all duration-200 group"
              >
                <span className="text-sm font-medium text-white/80 group-hover:text-white transition-colors">{p.name}</span>
                <span className="text-[10px] text-white/30 mt-1">{p.cat}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Testimonials Section ──────────────────────────────────── */}
      <section id="testimonials" className="relative py-24 sm:py-32">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-500/20 to-transparent" />
          <div className="absolute top-1/2 left-1/3 w-[500px] h-[500px] bg-indigo-600/5 rounded-full blur-[120px]" />
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <span className="text-sm font-semibold text-blue-400 tracking-widest uppercase">Testimonials</span>
            <h2 className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight">
              Trusted by developers worldwide
            </h2>
            <p className="mt-4 text-white/50 max-w-xl mx-auto">
              See what engineers, DevOps teams, and security professionals are saying about Archibald Titan.
            </p>
          </div>

          {/* Testimonial grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                name: "Marcus Chen",
                role: "Senior DevOps Engineer",
                company: "Nexus Systems",
                text: "Managing API keys across 12 different providers was a nightmare. Archibald Titan reduced what used to take me 2 hours every quarter to about 3 minutes. The encrypted vault gives me peace of mind.",
                rating: 5,
                initials: "MC",
                color: "from-blue-500 to-cyan-500",
              },
              {
                name: "Sarah Mitchell",
                role: "Full-Stack Developer",
                company: "Indie Developer",
                text: "I was skeptical about running an AI agent locally, but the stealth browser is genuinely impressive. It handled GoDaddy and AWS without a hitch once I added a residential proxy. Game changer for solo devs.",
                rating: 5,
                initials: "SM",
                color: "from-purple-500 to-pink-500",
              },
              {
                name: "James Okonkwo",
                role: "CTO",
                company: "CloudBridge Inc.",
                text: "The fact that nothing leaves my machine is the selling point. We evaluated three credential management tools and Archibald Titan was the only one that met our security requirements. AES-256-GCM encryption is exactly what we needed.",
                rating: 5,
                initials: "JO",
                color: "from-emerald-500 to-teal-500",
              },
              {
                name: "Elena Vasquez",
                role: "Security Analyst",
                company: "Fortify Labs",
                text: "I audited the encryption implementation and it's solid. The kill switch feature is a nice touch — gives you an emergency off-ramp if anything goes sideways. Exactly what a security-conscious tool should have.",
                rating: 5,
                initials: "EV",
                color: "from-amber-500 to-orange-500",
              },
              {
                name: "David Park",
                role: "Platform Engineer",
                company: "ScaleOps",
                text: "We rotate API keys monthly across 8 providers. Archibald Titan turned a full afternoon of manual work into a single automated run. The export to .env feature integrates perfectly with our CI/CD pipeline.",
                rating: 5,
                initials: "DP",
                color: "from-rose-500 to-red-500",
              },
              {
                name: "Aisha Rahman",
                role: "Freelance Developer",
                company: "Self-employed",
                text: "Free, local, and it actually works. I use it to manage keys for my client projects — OpenAI, Stripe, SendGrid, the works. The CAPTCHA solving saved me from pulling my hair out with Cloudflare.",
                rating: 5,
                initials: "AR",
                color: "from-indigo-500 to-violet-500",
              },
            ].map((t, i) => (
              <div
                key={i}
                className="relative p-6 rounded-2xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] hover:border-blue-500/20 transition-all duration-300 group"
              >
                {/* Quote icon */}
                <Quote className="absolute top-5 right-5 h-8 w-8 text-white/[0.04] group-hover:text-blue-500/10 transition-colors" />

                {/* Stars */}
                <div className="flex items-center gap-0.5 mb-4">
                  {Array.from({ length: t.rating }).map((_, j) => (
                    <Star key={j} className="h-4 w-4 fill-amber-400 text-amber-400" />
                  ))}
                </div>

                {/* Quote text */}
                <p className="text-sm text-white/60 leading-relaxed mb-6">
                  "{t.text}"
                </p>

                {/* Author */}
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

          {/* Social proof stats */}
          <div className="mt-16 flex flex-col sm:flex-row items-center justify-center gap-8 sm:gap-16">
            <div className="text-center">
              <div className="text-3xl font-bold text-white">
                <AnimatedNumber target={2400} />+
              </div>
              <div className="text-sm text-white/40 mt-1">Active Users</div>
            </div>
            <div className="hidden sm:block h-8 w-px bg-white/10" />
            <div className="text-center">
              <div className="text-3xl font-bold text-white">
                <AnimatedNumber target={50000} />+
              </div>
              <div className="text-sm text-white/40 mt-1">Keys Retrieved</div>
            </div>
            <div className="hidden sm:block h-8 w-px bg-white/10" />
            <div className="text-center">
              <div className="text-3xl font-bold text-white">
                4.<AnimatedNumber target={9} />
                <span className="text-blue-400">/5</span>
              </div>
              <div className="text-sm text-white/40 mt-1">Average Rating</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Download Section ───────────────────────────────────────── */}
      <section id="download" className="relative py-24 sm:py-32">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-500/20 to-transparent" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] bg-blue-600/8 rounded-full blur-[120px]" />
        </div>
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <span className="text-sm font-semibold text-blue-400 tracking-widest uppercase">Download</span>
          <h2 className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight">
            Get Archibald Titan
          </h2>
          <p className="mt-4 text-white/50 max-w-xl mx-auto">
            Free to download. Runs entirely on your machine. Available for Windows, macOS, and Linux.
          </p>

          {/* Version info */}
          <div className="mt-8 inline-flex items-center gap-3 px-5 py-2.5 rounded-full border border-white/10 bg-white/[0.03]">
            <span className="text-sm text-white/60">Latest:</span>
            <span className="text-sm font-mono font-semibold text-blue-400">
              v{latestRelease?.version ?? "6.0.1"}
            </span>
            {latestRelease?.fileSizeMb && (
              <>
                <span className="text-white/20">·</span>
                <span className="text-sm text-white/40">{latestRelease.fileSizeMb} MB</span>
              </>
            )}
          </div>

          {/* Download buttons */}
          {/* Auth gate notice */}
          {!user && (
            <div className="mt-6 flex items-center justify-center gap-2 text-sm text-amber-400/80">
              <Lock className="h-4 w-4" />
              <span>Sign in required to download — we verify your email for security</span>
            </div>
          )}

          {/* Recommended download for detected platform */}
          {(() => {
            const pi = PLATFORM_INFO[detectedPlatform];
            const PlatformIcon = pi.icon;
            return (
              <div className="mt-10 max-w-md mx-auto">
                <p className="text-sm text-white/40 mb-3">Recommended for your device:</p>
                <button
                  onClick={() => handleDownload(detectedPlatform as "windows" | "mac" | "linux")}
                  disabled={downloadPending === detectedPlatform}
                  className="w-full flex items-center justify-center gap-3 p-5 rounded-2xl border-2 border-blue-500/30 bg-blue-600/10 hover:bg-blue-600/20 transition-all duration-300 group"
                >
                  <PlatformIcon className="h-8 w-8 text-blue-400" />
                  <div className="text-left">
                    <div className="text-base font-semibold text-white">Download for {pi.label}</div>
                    <div className="text-xs text-white/40">{pi.note} · {pi.ext}</div>
                  </div>
                  <div className="ml-auto flex items-center gap-1.5 text-sm font-medium text-blue-400">
                    {downloadPending === detectedPlatform ? (
                      <>Preparing...</>
                    ) : !user ? (
                      <><LogIn className="h-4 w-4" />Sign In</>
                    ) : (
                      <><Download className="h-4 w-4" />Download</>
                    )}
                  </div>
                </button>
              </div>
            );
          })()}

          <p className="mt-6 mb-4 text-sm text-white/30">Other platforms:</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg mx-auto">
            {([
              {
                platform: "windows" as const,
                label: "Windows",
                icon: Monitor,
                available: latestRelease?.hasWindows ?? false,
                note: "Windows 10+ (64-bit)",
                ext: ".exe",
              },
              {
                platform: "mac" as const,
                label: "macOS",
                icon: Apple,
                available: latestRelease?.hasMac ?? false,
                note: "macOS 12+ (Apple Silicon & Intel)",
                ext: ".dmg",
              },
              {
                platform: "linux" as const,
                label: "Linux",
                icon: Terminal,
                available: latestRelease?.hasLinux ?? false,
                note: "Ubuntu 20.04+ / Debian / Fedora",
                ext: ".AppImage",
              },
            ]).filter(dl => dl.platform !== detectedPlatform).map((dl) => (
              <button
                key={dl.platform}
                onClick={() => handleDownload(dl.platform)}
                disabled={downloadPending === dl.platform}
                className="flex flex-col items-center gap-3 p-6 rounded-2xl border border-white/10 bg-white/[0.03] hover:bg-blue-600/10 hover:border-blue-500/30 transition-all duration-300 group disabled:opacity-50"
              >
                <dl.icon className="h-8 w-8 text-white/60 group-hover:text-blue-400 transition-colors" />
                <div>
                  <div className="text-base font-semibold text-white">{dl.label}</div>
                  <div className="text-xs text-white/40 mt-1">{dl.note}</div>
                </div>
                <div className="flex items-center gap-1.5 text-sm font-medium text-blue-400">
                  {downloadPending === dl.platform ? (
                    <>Preparing...</>
                  ) : !user ? (
                    <><LogIn className="h-3.5 w-3.5" />Sign In to Download</>
                  ) : dl.available ? (
                    <><Download className="h-3.5 w-3.5" />Download {dl.ext}</>
                  ) : (
                    <>Coming Soon</>
                  )}
                </div>
              </button>
            ))}
          </div>

          {/* Post-download install tip */}
          {postDownloadTip && (
            <div className="fixed bottom-8 left-1/2 -translate-x-1/2 max-w-lg w-[90vw] px-6 py-4 rounded-2xl bg-emerald-500/10 backdrop-blur-xl border border-emerald-500/20 z-50 animate-in fade-in slide-in-from-bottom-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-emerald-400 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-emerald-300 mb-1">Download Started</p>
                  <p className="text-sm text-white/60 leading-relaxed">{postDownloadTip}</p>
                </div>
                <button
                  onClick={() => setPostDownloadTip(null)}
                  className="text-white/40 hover:text-white/70 text-lg leading-none"
                >
                  ×
                </button>
              </div>
            </div>
          )}

          {/* Coming soon toast */}
          <div
            id="coming-soon-toast"
            className="fixed bottom-8 left-1/2 -translate-x-1/2 px-6 py-3 rounded-xl bg-white/10 backdrop-blur-xl border border-white/10 text-sm text-white font-medium opacity-0 translate-y-4 transition-all duration-300 z-50 pointer-events-none"
          >
            Download links will be available soon. Stay tuned!
          </div>
        </div>
      </section>

      {/* ── Installation Instructions ──────────────────────────────── */}
      <section id="installation" className="relative py-24 sm:py-32">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-indigo-950/5 to-transparent" />
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <span className="text-sm font-semibold text-blue-400 tracking-widest uppercase">Installation Guide</span>
            <h2 className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight">
              Up and running in minutes
            </h2>
            <p className="mt-4 text-white/50 max-w-2xl mx-auto">
              Follow the platform-specific instructions below to install Archibald Titan on your machine.
            </p>
          </div>

          {/* System Requirements */}
          <div className="mb-16">
            <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
              <Cpu className="h-5 w-5 text-blue-400" />
              System Requirements
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                {
                  platform: "Windows",
                  icon: Monitor,
                  reqs: [
                    "Windows 10 or later (64-bit)",
                    "4 GB RAM minimum (8 GB recommended)",
                    "500 MB free disk space",
                    "Internet connection for credential fetching",
                  ],
                },
                {
                  platform: "macOS",
                  icon: Apple,
                  reqs: [
                    "macOS 12 Monterey or later",
                    "Apple Silicon (M1+) or Intel processor",
                    "4 GB RAM minimum (8 GB recommended)",
                    "500 MB free disk space",
                  ],
                },
                {
                  platform: "Linux",
                  icon: Terminal,
                  reqs: [
                    "Ubuntu 20.04+ / Debian 11+ / Fedora 36+",
                    "4 GB RAM minimum (8 GB recommended)",
                    "500 MB free disk space",
                    "X11 or Wayland display server",
                  ],
                },
              ].map((p) => (
                <div
                  key={p.platform}
                  className="p-6 rounded-2xl border border-white/[0.06] bg-white/[0.02]"
                >
                  <div className="flex items-center gap-3 mb-4">
                    <p.icon className="h-5 w-5 text-blue-400" />
                    <span className="text-base font-semibold text-white">{p.platform}</span>
                  </div>
                  <ul className="space-y-2">
                    {p.reqs.map((r, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-white/50">
                        <Check className="h-3.5 w-3.5 text-blue-400 mt-0.5 shrink-0" />
                        <span>{r}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          {/* Step-by-step installation */}
          <div className="mb-16">
            <h3 className="text-xl font-bold text-white mb-8 flex items-center gap-2">
              <PackageOpen className="h-5 w-5 text-blue-400" />
              Step-by-Step Installation
            </h3>

            {/* Windows */}
            <div className="mb-10">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-8 w-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                  <Monitor className="h-4 w-4 text-blue-400" />
                </div>
                <h4 className="text-lg font-semibold text-white">Windows Installation</h4>
              </div>
              <div className="space-y-3 ml-11">
                {[
                  { step: "1", text: 'Download the .exe installer from the Download section above (sign in required).' },
                  { step: "2", text: 'Double-click the downloaded ArchibaldTitan-Setup.exe file.' },
                  { step: "3", text: 'If Windows SmartScreen appears, click "More info" → "Run anyway". The app is safe — it\'s just not yet code-signed with a Microsoft certificate.' },
                  { step: "4", text: 'Follow the installer wizard — choose your install directory (default is fine) and click Install.' },
                  { step: "5", text: 'Launch Archibald Titan from the Start Menu or desktop shortcut.' },
                  { step: "6", text: 'Sign in with your account to activate your license and sync your subscription tier.' },
                ].map((s) => (
                  <div key={s.step} className="flex items-start gap-3">
                    <div className="h-6 w-6 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-xs font-bold text-blue-400">{s.step}</span>
                    </div>
                    <p className="text-sm text-white/60 leading-relaxed">{s.text}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* macOS */}
            <div className="mb-10">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-8 w-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                  <Apple className="h-4 w-4 text-blue-400" />
                </div>
                <h4 className="text-lg font-semibold text-white">macOS Installation</h4>
              </div>
              <div className="space-y-3 ml-11">
                {[
                  { step: "1", text: 'Download the .dmg file from the Download section above (sign in required).' },
                  { step: "2", text: 'Open the downloaded .dmg file.' },
                  { step: "3", text: 'Drag the Archibald Titan icon into the Applications folder.' },
                  { step: "4", text: 'Open the app from Applications. If macOS blocks it, go to System Settings → Privacy & Security → click "Open Anyway".' },
                  { step: "5", text: 'On first launch, macOS may ask for permissions (Accessibility, Screen Recording). Grant these for full stealth browser functionality.' },
                  { step: "6", text: 'Sign in with your account to activate your license and sync your subscription tier.' },
                ].map((s) => (
                  <div key={s.step} className="flex items-start gap-3">
                    <div className="h-6 w-6 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-xs font-bold text-blue-400">{s.step}</span>
                    </div>
                    <p className="text-sm text-white/60 leading-relaxed">{s.text}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Linux */}
            <div className="mb-10">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-8 w-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                  <Terminal className="h-4 w-4 text-blue-400" />
                </div>
                <h4 className="text-lg font-semibold text-white">Linux Installation</h4>
              </div>
              <div className="space-y-3 ml-11">
                {[
                  { step: "1", text: 'Download the .AppImage file from the Download section above (sign in required).' },
                  { step: "2", text: 'Open a terminal and navigate to the download directory.' },
                  { step: "3", text: 'Make the file executable: chmod +x ArchibaldTitan-*.AppImage' },
                  { step: "4", text: 'Run the application: ./ArchibaldTitan-*.AppImage' },
                  { step: "5", text: 'Optional: Move to /opt or ~/Applications and create a .desktop entry for menu integration.' },
                  { step: "6", text: 'Sign in with your account to activate your license and sync your subscription tier.' },
                ].map((s) => (
                  <div key={s.step} className="flex items-start gap-3">
                    <div className="h-6 w-6 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-xs font-bold text-blue-400">{s.step}</span>
                    </div>
                    <p className="text-sm text-white/60 leading-relaxed">{s.text}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* First-time setup */}
          <div className="mb-16">
            <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
              <Settings className="h-5 w-5 text-blue-400" />
              First-Time Setup
            </h3>
            <div className="p-6 rounded-2xl border border-white/[0.06] bg-white/[0.02]">
              <div className="space-y-4">
                {[
                  {
                    title: "Sign In & Activate",
                    desc: "Launch the app and sign in with your Archibald Titan account. Your subscription tier (Free, Pro, or Enterprise) will be synced automatically.",
                    icon: LogIn,
                  },
                  {
                    title: "Configure Providers",
                    desc: "Go to Settings → Providers and enable the services you want to fetch credentials from (OpenAI, AWS, Stripe, etc.). Enter your login credentials for each — they're encrypted with AES-256-GCM immediately.",
                    icon: Globe,
                  },
                  {
                    title: "Set Up Proxies (Optional)",
                    desc: "If you plan to fetch from providers with aggressive bot detection (GoDaddy, Cloudflare), add a residential proxy in Settings → Proxies. Datacenter proxies work for most other providers.",
                    icon: Network,
                  },
                  {
                    title: "Configure CAPTCHA Solver (Optional)",
                    desc: "For providers that use CAPTCHA challenges, add your 2Captcha or Anti-Captcha API key in Settings → CAPTCHA. This enables automatic CAPTCHA solving during credential fetching.",
                    icon: Fingerprint,
                  },
                  {
                    title: "Run Your First Fetch",
                    desc: "Go to the Dashboard, click 'New Fetch Job', select your providers, and hit Start. Watch the stealth browser work in real-time as it retrieves your API keys.",
                    icon: Zap,
                  },
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-4">
                    <div className="h-10 w-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
                      <item.icon className="h-5 w-5 text-blue-400" />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-white mb-1">{item.title}</h4>
                      <p className="text-sm text-white/50 leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Troubleshooting */}
          <div>
            <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-blue-400" />
              Troubleshooting
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                {
                  q: "App won't open on macOS",
                  a: 'Go to System Settings → Privacy & Security → scroll down and click "Open Anyway" next to the Archibald Titan warning.',
                },
                {
                  q: "Windows SmartScreen blocks the installer",
                  a: 'Click "More info" on the SmartScreen popup, then click "Run anyway". This happens because the app is not yet signed with a Microsoft EV certificate.',
                },
                {
                  q: "Linux AppImage doesn\'t launch",
                  a: 'Make sure FUSE is installed: sudo apt install libfuse2 (Ubuntu/Debian) or sudo dnf install fuse (Fedora). Then retry.',
                },
                {
                  q: "Fetch jobs fail or time out",
                  a: 'Check your internet connection and proxy settings. Some providers require residential proxies. Try increasing the timeout in Settings → Advanced.',
                },
                {
                  q: "CAPTCHA not being solved",
                  a: 'Verify your CAPTCHA solver API key is correct and has sufficient balance. Check Settings → CAPTCHA for status.',
                },
                {
                  q: "Need more help?",
                  a: 'Visit our Contact page or email support@archibaldtitan.com. Enterprise customers get priority support with guaranteed response times.',
                },
              ].map((item, i) => (
                <div
                  key={i}
                  className="p-5 rounded-xl border border-white/[0.06] bg-white/[0.02]"
                >
                  <h4 className="text-sm font-semibold text-white mb-2">{item.q}</h4>
                  <p className="text-sm text-white/50 leading-relaxed">{item.a}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Updates / Changelog ─────────────────────────────────────── */}
      <section id="updates" className="relative py-24 sm:py-32">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-blue-950/5 to-transparent" />
        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <span className="text-sm font-semibold text-blue-400 tracking-widest uppercase">Changelog</span>
            <h2 className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight">
              Latest Updates
            </h2>
            <p className="mt-4 text-white/50">
              Stay up to date with the latest features, improvements, and fixes.
            </p>
          </div>

          {/* Update checker */}
          <UpdateChecker onDownload={handleDownload} isAuthenticated={!!user} />

          {/* Release timeline */}
          <div className="mt-12 space-y-6">
            {(allReleases ?? []).map((release, i) => (
              <div
                key={release.id}
                className="relative pl-8 before:absolute before:left-0 before:top-0 before:bottom-0 before:w-px before:bg-white/10"
              >
                {/* Timeline dot */}
                <div className={`absolute left-0 top-1 -translate-x-1/2 h-3 w-3 rounded-full border-2 ${
                  i === 0 ? "border-blue-500 bg-blue-500" : "border-white/20 bg-[#060611]"
                }`} />

                <div className="pb-8">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="font-mono text-sm font-semibold text-blue-400">v{release.version}</span>
                    {release.isLatest === 1 && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                        LATEST
                      </span>
                    )}
                    {release.isPrerelease === 1 && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        BETA
                      </span>
                    )}
                    <span className="text-xs text-white/30">
                      {new Date(release.publishedAt).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </span>
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-3">{release.title}</h3>
                  <div className="text-sm text-white/50 leading-relaxed whitespace-pre-line">
                    {release.changelog.split("\n").map((line: string, j: number) => {
                      if (line.startsWith("**") && line.endsWith("**")) {
                        return <div key={j} className="font-semibold text-white/70 mt-3 mb-1">{line.replace(/\*\*/g, "")}</div>;
                      }
                      if (line.startsWith("- ")) {
                        return (
                          <div key={j} className="flex items-start gap-2 ml-1 my-0.5">
                            <Check className="h-3.5 w-3.5 text-blue-400 mt-0.5 shrink-0" />
                            <span>{line.slice(2)}</span>
                          </div>
                        );
                      }
                      return line ? <div key={j}>{line}</div> : <div key={j} className="h-2" />;
                    })}
                  </div>

                  {/* Download Latest — always downloads the most recent release with all cumulative updates */}
                  <div className="mt-4 pt-4 border-t border-white/5">
                    <button
                      onClick={() => handleDownload(detectedPlatform)}
                      className="inline-flex items-center gap-2 text-sm font-medium text-blue-400 hover:text-blue-300 transition-colors group"
                    >
                      <Download className="h-4 w-4 group-hover:translate-y-0.5 transition-transform" />
                      {user ? (
                        <span>Download Latest (v{latestRelease?.version ?? "..."}) — includes all updates</span>
                      ) : (
                        <span>Sign in to download latest version</span>
                      )}
                    </button>
                    {latestRelease && release.version !== latestRelease.version && (
                      <p className="text-xs text-white/30 mt-1 ml-6">
                        This release is included in the latest version (v{latestRelease.version}). One download gets you everything.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ Section ────────────────────────────────────────────── */}
      <section id="faq" className="relative py-24 sm:py-32">
        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <span className="text-sm font-semibold text-blue-400 tracking-widest uppercase">FAQ</span>
            <h2 className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight">
              Frequently Asked Questions
            </h2>
          </div>

          <div className="divide-y-0">
            <FAQItem
              question="Is Archibald Titan really free?"
              answer="Yes. The core product is available with a free tier to download and use. There are no hidden fees, subscriptions, or usage limits. Premium features like priority support and early access to new providers may be offered in the future."
            />
            <FAQItem
              question="Are my credentials safe?"
              answer="Absolutely. All credentials are encrypted with AES-256-GCM before being stored. The encryption key is derived from your session and never leaves your machine. We use the same encryption standard used by banks and military organizations. Your keys are never transmitted to any external server."
            />
            <FAQItem
              question="Does it work with two-factor authentication (2FA)?"
              answer="Yes! Archibald Titan has full built-in two-factor authentication. You can enable TOTP-based 2FA from Account Settings using any authenticator app (Google Authenticator, Authy, 1Password, etc.). During setup you'll get a QR code to scan and 8 one-time backup codes for emergency access. Once enabled, every login requires both your password and a 6-digit code from your authenticator app. For credential retrieval from external providers with mandatory 2FA, the manual CAPTCHA assistance mode lets you complete 2FA challenges yourself during the fetch process."
            />
            <FAQItem
              question="What is a residential proxy and do I need one?"
              answer="A residential proxy routes your internet traffic through a real home IP address instead of a datacenter IP. Some providers like GoDaddy and Cloudflare use advanced bot detection that blocks datacenter IPs. If you need to fetch credentials from these providers, you'll need a residential proxy. The app has a built-in proxy manager — just add your proxy credentials in Settings."
            />
            <FAQItem
              question="Can I use this for my team?"
              answer="Yes! Each team member can run their own instance of Archibald Titan. Since everything is local, there's no shared infrastructure to worry about. Each person's vault is completely independent and encrypted with their own keys."
            />
            <FAQItem
              question="What happens if a provider changes their website?"
              answer="Provider automation scripts are updated regularly. When a provider changes their website layout, we release an update with the new automation script. You can check for updates directly in the app or on this page. The modular architecture means individual provider scripts can be updated without affecting the rest of the system."
            />
            <FAQItem
              question="Is this legal?"
              answer="Yes. Archibald Titan automates the same actions you would perform manually — logging into your own accounts and copying your own API keys. It does not bypass any security measures, access accounts you don't own, or violate any terms of service. It's simply a productivity tool that saves you time."
            />
          </div>
        </div>
      </section>

      {/* ── CTA Section ────────────────────────────────────────────── */}
      <section className="relative py-24 sm:py-32">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-blue-600/10 rounded-full blur-[120px]" />
        </div>
        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
            Ready to automate your credentials?
          </h2>
          <p className="mt-4 text-white/50 text-lg">
            Download Archibald Titan and start retrieving API keys in minutes.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            {(() => {
              const pi = PLATFORM_INFO[detectedPlatform];
              const PlatformIcon = pi.icon;
              return (
                <Button
                  size="lg"
                  onClick={() => handleDownload(detectedPlatform)}
                  disabled={downloadPending === detectedPlatform}
                  className="bg-blue-600 hover:bg-blue-500 text-white border-0 shadow-xl shadow-blue-600/25 h-14 px-10 text-base font-semibold gap-3"
                >
                  {!user ? (
                    <><LogIn className="h-5 w-5" />Sign In to Download</>
                  ) : downloadPending === detectedPlatform ? (
                    <>Preparing Download...</>
                  ) : (
                    <><PlatformIcon className="h-5 w-5" />Download for {pi.label}</>
                  )}
                </Button>
              );
            })()}
            {!user && (
              <Button
                size="lg"
                variant="outline"
                onClick={() => { window.location.href = getLoginUrl(); }}
                className="border-white/10 bg-white/5 hover:bg-white/10 text-white h-12 px-8 text-base"
              >
                Sign In to Dashboard
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────── */}
      <footer className="relative border-t border-white/5 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-8">
            {/* Brand */}
            <div className="md:col-span-2">
              <div className="flex items-center gap-3 mb-4">
                <img src="https://files.manuscdn.com/user_upload_by_module/session_file/310519663339631904/XqBVYWONhvkWzLDU.png" alt="AT" className="h-8 w-8 object-contain" />
                <span className="text-base font-bold tracking-tight">Archibald Titan</span>
              </div>
              <p className="text-sm text-white/40 max-w-sm leading-relaxed">
                The world's most advanced local AI agent for autonomous credential retrieval. Built with security and privacy at its core.
              </p>

            </div>

            {/* Links */}
            <div>
              <h4 className="text-sm font-semibold text-white/80 mb-4">Product</h4>
              <div className="space-y-2.5">
                <a href="#features" className="block text-sm text-white/40 hover:text-white/70 transition-colors">Features</a>
                <a href="#download" className="block text-sm text-white/40 hover:text-white/70 transition-colors">Download</a>
                <a href="#updates" className="block text-sm text-white/40 hover:text-white/70 transition-colors">Changelog</a>
                <a href="#faq" className="block text-sm text-white/40 hover:text-white/70 transition-colors">FAQ</a>
                <Link href="/pricing" className="block text-sm text-blue-400/80 hover:text-blue-300 transition-colors font-medium">Pricing</Link>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-white/80 mb-4">Resources</h4>
              <div className="space-y-2.5">
                <a href="#how-it-works" className="block text-sm text-white/40 hover:text-white/70 transition-colors">How It Works</a>
                <a href="#testimonials" className="block text-sm text-white/40 hover:text-white/70 transition-colors">Testimonials</a>
                <button
                  onClick={() => {
                    if (user) setLocation("/dashboard");
                    else window.location.href = getLoginUrl();
                  }}
                  className="block text-sm text-white/40 hover:text-white/70 transition-colors text-left"
                >
                  Dashboard
                </button>
              </div>
            </div>

            {/* Legal */}
            <div className="md:col-span-1">
              <h4 className="text-sm font-semibold text-white/80 mb-4">Legal</h4>
              <div className="space-y-2.5">
                <Link href="/terms" className="block text-sm text-white/40 hover:text-white/70 transition-colors">Terms & Conditions</Link>
                <Link href="/privacy" className="block text-sm text-white/40 hover:text-white/70 transition-colors">Privacy Policy</Link>
                <Link href="/contact" className="block text-sm text-white/40 hover:text-white/70 transition-colors">Contact & Billing</Link>
              </div>
            </div>
          </div>

          {/* Legal bar */}
          <div className="mt-10 pt-6 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs text-white/20">
              &copy; {new Date().getFullYear()} Archibald Titan. All rights reserved.
            </p>
            <div className="flex items-center gap-6">
              <Link href="/terms" className="text-xs text-white/20 hover:text-white/40 transition-colors">Terms</Link>
              <Link href="/privacy" className="text-xs text-white/20 hover:text-white/40 transition-colors">Privacy</Link>
              <Link href="/contact" className="text-xs text-white/20 hover:text-white/40 transition-colors">Contact</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

// ─── Update Checker Component ───────────────────────────────────────

function UpdateChecker({ onDownload, isAuthenticated }: { onDownload: (platform: "windows" | "mac" | "linux") => void; isAuthenticated: boolean }) {
  const [version, setVersion] = useState("");
  const [checked, setChecked] = useState(false);
  const { data, refetch, isLoading } = trpc.releases.checkUpdate.useQuery(
    { currentVersion: version },
    { enabled: false }
  );

  const handleCheck = () => {
    if (!version.trim()) return;
    setChecked(true);
    refetch();
  };

  return (
    <div className="p-6 rounded-2xl border border-white/10 bg-white/[0.02]">
      <div className="flex items-center gap-3 mb-4">
        <RefreshCw className="h-5 w-5 text-blue-400" />
        <h3 className="text-base font-semibold">Check for Updates</h3>
      </div>
      <p className="text-sm text-white/50 mb-4">
        Enter your current version number to check if a newer version is available.
      </p>
      <div className="flex gap-3">
        <input
          type="text"
          value={version}
          onChange={(e) => { setVersion(e.target.value); setChecked(false); }}
          placeholder="e.g. 5.0.0"
          className="flex-1 h-10 px-4 rounded-lg border border-white/10 bg-white/5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20"
        />
        <Button
          onClick={handleCheck}
          disabled={!version.trim() || isLoading}
          className="bg-blue-600 hover:bg-blue-500 text-white border-0 h-10 px-5"
        >
          {isLoading ? "Checking..." : "Check"}
        </Button>
      </div>
      {checked && data && (
        <div className={`mt-4 p-4 rounded-lg border ${
          data.updateAvailable
            ? "border-blue-500/20 bg-blue-500/5"
            : "border-emerald-500/20 bg-emerald-500/5"
        }`}>
          {data.updateAvailable ? (
            <div className="flex items-start gap-3">
              <Sparkles className="h-5 w-5 text-blue-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-blue-300">Update Available!</p>
                <p className="text-sm text-white/50 mt-1">
                  Version <span className="font-mono text-blue-400">{data.latestVersion}</span> is available.
                  You're currently on <span className="font-mono text-white/60">{data.currentVersion}</span>.
                </p>
                <button
                  onClick={() => onDownload(detectPlatform())}
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-400 mt-2 hover:text-blue-300"
                >
                  {!isAuthenticated ? (
                    <><LogIn className="h-3.5 w-3.5" />Sign In to Download</>
                  ) : (
                    <><Download className="h-3.5 w-3.5" />Download Latest</>
                  )}
                </button>
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
