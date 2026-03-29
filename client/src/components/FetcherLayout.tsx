import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { getLoginUrl } from "@/const";
import { useIsMobile } from "@/hooks/useMobile";
import { useSubscription } from "@/hooks/useSubscription";
import { PlanBadge } from "@/components/UpgradePrompt";
import {
  PlusCircle,
  ListOrdered,
  KeyRound,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Download,
  LogOut,
  PanelLeft,
  Crown,
  Key,
  Users,
  ScrollText,
  Package,
  Timer,
  RefreshCw,
  History,
  Activity,
  CalendarClock,
  Sparkles,
  TrendingUp,
  ScanSearch,
  Wand2,
  Vault,
  Book,
  Webhook,
  BarChart3,
  UserCog,
  Zap,
  CreditCard,
  Upload,
  Clock,
  Bell,
  Terminal,
  Search,
  Building2,
  FileText,
  Rocket,
  Copy,
  Megaphone,
  DollarSign,
  Gift,
  Store,
  ShoppingBag,
  Package2,
  LayoutDashboard,
  Sun,
  Moon,
  FolderOpen,
  Globe,
  UserPlus,
} from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { OutOfCreditsModal } from "./OutOfCreditsModal";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";
import { TitanLogo } from "./TitanLogo";
import { featureIcon } from "./FeatureIcon";
import { Button } from "./ui/button";
import OnboardingWizard from "./OnboardingWizard";
import HelpBotWidget from "./HelpBotWidget";
import TrialBanner from "./TrialBanner";
import DesktopStatusBar from "./DesktopStatusBar";
import DesktopOfflineGuard from "./DesktopOfflineGuard";
import { isDesktop } from "@/lib/desktop";
import { useArchibald } from "@/contexts/ArchibaldContext";
import { useTheme } from "@/contexts/ThemeContext";
import { LanguageSelector, useLanguage } from "@/i18n";
import { AddAdminModal } from "./AddAdminModal";
import { isAdminRole } from "@shared/const";
import { trpc } from "@/lib/trpc";
import { Shield, Loader2, Mic, MicOff } from "lucide-react";
import { toast } from "sonner";
import { useVoiceMode } from "./VoiceMode";

type MenuItem = {
  icon: any;
  label: string;
  path: string;
  adminOnly?: boolean;
  premiumOnly?: boolean;
  titanOnly?: boolean;
  isNew?: boolean;
  isCyber?: boolean;
};

type MenuGroup = {
  title: string;
  items: MenuItem[];
};

function buildMenuGroups(t: (key: string) => string): MenuGroup[] {
  return [
  // ═══════════════════════════════════════════════════════════════
  // SECTION 1: DEVELOPER TOOLS
  // ═══════════════════════════════════════════════════════════════
  {
    title: t("group.developerTools"),
    items: [
      { icon: () => <TitanLogo size="sm" />, label: t("nav.titanBuilder"), path: "/dashboard" },
      { icon: featureIcon("icon_01_r1c1"), label: "Builder Templates", path: "/builder-templates", isNew: true },
      { icon: featureIcon("icon_41_r6c1"), label: t("nav.sandbox"), path: "/sandbox", isNew: true },
      { icon: featureIcon("icon_04_r1c4"), label: t("nav.myProjects"), path: "/project-files", isNew: true },
      { icon: featureIcon("icon_05_r1c5"), label: t("nav.smartFetch"), path: "/fetcher/smart-fetch" },
      { icon: featureIcon("icon_06_r1c6"), label: t("nav.newFetch"), path: "/fetcher/new" },
      { icon: featureIcon("icon_08_r1c8"), label: t("nav.fetchJobs"), path: "/fetcher/jobs" },
      { icon: featureIcon("icon_09_r2c1"), label: t("nav.grandBazaar"), path: "/marketplace", isNew: true },
      { icon: featureIcon("icon_10_r2c2"), label: t("nav.myInventory"), path: "/marketplace/inventory", isNew: true },
      { icon: featureIcon("icon_07_r1c7"), label: t("nav.sellListings"), path: "/marketplace/sell", isNew: true },
      { icon: featureIcon("icon_45_r6c5"), label: t("nav.sellerDashboard"), path: "/marketplace/seller", isNew: true },
    ],
  },
  // ═══════════════════════════════════════════════════════════════
  // SECTION 1b: SECURITY TOOLS
  // ═══════════════════════════════════════════════════════════════
  {
    title: t("group.security"),
    items: [
      { icon: featureIcon("icon_14_r2c6"), label: t("nav.totpVault"), path: "/fetcher/totp-vault", isCyber: true },
      { icon: featureIcon("icon_15_r2c7"), label: t("nav.expiryWatchdog"), path: "/fetcher/watchdog" },
      { icon: featureIcon("icon_16_r2c8"), label: t("nav.providerHealth"), path: "/fetcher/provider-health" },
      { icon: featureIcon("icon_37_r5c5"), label: t("nav.healthTrends"), path: "/fetcher/health-trends", isCyber: true },
      { icon: featureIcon("icon_38_r5c6"), label: t("nav.leakScanner"), path: "/fetcher/leak-scanner", isCyber: true },
      { icon: featureIcon("icon_18_r3c2"), label: t("nav.credentialHealth"), path: "/fetcher/credential-health", isCyber: true },
      { icon: featureIcon("icon_19_r3c3"), label: t("nav.siteMonitor"), path: "/site-monitor", premiumOnly: true, isNew: true },
      { icon: featureIcon("icon_16_r2c8"), label: t("nav.linkenSphere"), path: "/linken-sphere", isNew: true },
      { icon: featureIcon("icon_38_r5c6"), label: t("nav.cyberMcp"), path: "/cybermcp", isCyber: true, isNew: true },
      { icon: featureIcon("icon_18_r3c2"), label: t("nav.astraScanner"), path: "/astra", isCyber: true, isNew: true },
      { icon: featureIcon("icon_15_r2c7"), label: t("nav.argusOsint"), path: "/argus", isCyber: true, isNew: true },
    ],
  },
  // ═══════════════════════════════════════════════════════════════
  // SECTION 1c: SPECIALISED (Titan + Admin only — hidden from all other tiers)
  // ═══════════════════════════════════════════════════════════════
  {
    title: t("group.specialised"),
    items: [
      { icon: featureIcon("icon_02_r1c2"), label: t("nav.cloneWebsite"), path: "/replicate", isNew: true, premiumOnly: true },
      { icon: featureIcon("icon_15_r2c7"), label: "Evilginx 3", path: "/evilginx", titanOnly: true },
      { icon: featureIcon("icon_38_r5c6"), label: "BlackEye", path: "/blackeye", titanOnly: true },
      { icon: featureIcon("icon_41_r6c1"), label: "Metasploit", path: "/metasploit", titanOnly: true },
      { icon: featureIcon("icon_16_r2c8"), label: "Exploit Pack", path: "/exploitpack", titanOnly: true, isNew: true },
      // ── Titan Storage Add-on ──────────────────────────────────────────────
      { icon: featureIcon("icon_31_r4c7"), label: t("nav.titanStorage"), path: "/storage", isNew: true },
      // ── Privacy & Anonymity ───────────────────────────────────────────────
      { icon: featureIcon("icon_38_r5c6"), label: "Tor Browser", path: "/tor", isNew: true, titanOnly: true },
      { icon: featureIcon("icon_16_r2c8"), label: "Isolated Browser", path: "/isolated-browser", isNew: true, isCyber: true },
      { icon: featureIcon("icon_15_r2c7"), label: "VPN Chain", path: "/vpn-chain", isNew: true, titanOnly: true },
      { icon: featureIcon("icon_16_r2c8"), label: "Proxy Maker", path: "/proxy-maker", isNew: true, titanOnly: true },
      { icon: featureIcon("icon_38_r5c6"), label: "Proxy Rotation", path: "/proxy-rotation", isNew: true },
      { icon: featureIcon("icon_15_r2c7"), label: "IP Rotation", path: "/ip-rotation", isNew: true },
      // ── Card Tools ───────────────────────────────────────────────────────
      { icon: featureIcon("icon_12_r2c4"), label: "BIN Checker", path: "/bin-checker", isNew: true },
      // ── Web Agent ────────────────────────────────────────────────────────
      { icon: featureIcon("icon_09_r2c1"), label: "Web Agent", path: "/web-agent", isNew: true },
    ],
  },
  // ═══════════════════════════════════════════════════════════════
  // SECTION 2: BUSINESS & FUNDING
  // ═══════════════════════════════════════════════════════════════
  {
    title: t("group.businessFunding"),
    items: [
      { icon: featureIcon("icon_29_r4c5"), label: t("nav.browseGrants"), path: "/grants", isNew: true },
      { icon: featureIcon("icon_21_r3c5"), label: t("nav.grantApplications"), path: "/grant-applications", isNew: true },
      { icon: featureIcon("icon_23_r3c7"), label: t("nav.companies"), path: "/companies", isNew: true },
      { icon: featureIcon("icon_01_r1c1"), label: t("nav.businessPlans"), path: "/business-plans", isNew: true },
      { icon: featureIcon("icon_39_r5c7"), label: t("nav.crowdfunding"), path: "/crowdfunding", isNew: true },
      { icon: featureIcon("icon_20_r3c4"), label: t("nav.myCampaigns"), path: "/crowdfunding/my-campaigns", isNew: true },
      { icon: featureIcon("icon_12_r2c4"), label: t("nav.advertising"), path: "/advertising", adminOnly: true, isNew: true },
      { icon: featureIcon("icon_43_r6c3"), label: t("nav.affiliateDashboard"), path: "/affiliate", adminOnly: true, isNew: true },
      { icon: featureIcon("icon_35_r5c3"), label: t("nav.myReferrals"), path: "/referrals", isNew: true },
      { icon: featureIcon("icon_13_r2c5"), label: t("nav.seoCommandCenter"), path: "/seo", adminOnly: true, isNew: true },
      { icon: featureIcon("icon_33_r5c1"), label: t("nav.blogEngine"), path: "/blog-admin", adminOnly: true, isNew: true },
      { icon: featureIcon("icon_31_r4c7"), label: t("nav.marketingEngine"), path: "/marketing", adminOnly: true, isNew: true },
      { icon: featureIcon("icon_12_r2c4"), label: t("nav.contentCreator"), path: "/content-creator", adminOnly: true, isNew: true },
      { icon: featureIcon("icon_13_r2c5"), label: "Master Growth", path: "/master-growth", adminOnly: true, isNew: true },
    ],
  },
  // ═══════════════════════════════════════════════════════════════
  // SECTION 3: ACCOUNT & SETTINGS
  // ═══════════════════════════════════════════════════════════════
  {
    title: t("group.accountSettings"),
    items: [
      { icon: featureIcon("icon_11_r2c3"), label: t("nav.subscription"), path: "/dashboard/subscription" },
      { icon: featureIcon("icon_35_r5c3"), label: t("nav.credits"), path: "/dashboard/credits", isNew: true },
      { icon: featureIcon("icon_26_r4c2"), label: t("nav.credentials"), path: "/fetcher/credentials" },
      { icon: featureIcon("icon_19_r3c3"), label: t("nav.apiAccess"), path: "/fetcher/api-access" },
      { icon: featureIcon("icon_36_r5c4"), label: t("nav.teamManagement"), path: "/fetcher/team" },
      { icon: featureIcon("icon_22_r3c6"), label: t("nav.teamVault"), path: "/fetcher/team-vault", isNew: true },
      { icon: featureIcon("icon_44_r6c4"), label: t("nav.settings"), path: "/fetcher/settings" },
      { icon: featureIcon("icon_31_r4c7"), label: "Desktop Settings", path: "/desktop-settings", isNew: true },
    ],
  },
  // ═══════════════════════════════════════════════════════════════
  // SECTION 3b: DATA & AUTOMATION
  // ═══════════════════════════════════════════════════════════════
  {
    title: t("group.automation"),
    items: [
      { icon: featureIcon("icon_40_r5c8"), label: t("nav.csvExport"), path: "/fetcher/export" },
      { icon: featureIcon("icon_42_r6c2"), label: t("nav.import"), path: "/fetcher/import", isNew: true },
      { icon: featureIcon("icon_32_r4c8"), label: t("nav.bulkSync"), path: "/fetcher/bulk-sync" },
      { icon: featureIcon("icon_34_r5c2"), label: t("nav.autoSync"), path: "/fetcher/auto-sync" },
      { icon: featureIcon("icon_03_r1c3"), label: t("nav.providerOnboarding"), path: "/fetcher/onboarding", isNew: true },
      { icon: featureIcon("icon_08_r1c8"), label: t("nav.credentialHistory"), path: "/fetcher/history" },
      { icon: featureIcon("icon_08_r1c8"), label: t("nav.auditLogs"), path: "/fetcher/audit-logs" },
    ],
  },
  // ═══════════════════════════════════════════════════════════════
  // SECTION 4: DEVELOPER API & ADMIN
  // ═══════════════════════════════════════════════════════════════
  {
    title: t("group.developerApi"),
    items: [
      { icon: featureIcon("icon_33_r5c1"), label: t("nav.apiDocs"), path: "/fetcher/developer-docs", isNew: true },
      { icon: featureIcon("icon_27_r4c3"), label: t("nav.webhooks"), path: "/fetcher/webhooks", isNew: true },
      { icon: featureIcon("icon_28_r4c4"), label: t("nav.notifications"), path: "/fetcher/notifications", isNew: true },
      { icon: featureIcon("icon_30_r4c6"), label: t("nav.apiAnalytics"), path: "/fetcher/api-analytics", isNew: true },
      { icon: featureIcon("icon_41_r6c1"), label: t("nav.cliTool"), path: "/fetcher/cli", isNew: true },
      { icon: featureIcon("icon_41_r6c1"), label: t("nav.gitBash"), path: "/fetcher/git-bash", isNew: true },
      { icon: featureIcon("icon_10_r2c2"), label: t("nav.downloadApp"), path: "/fetcher/download-app", isNew: true },
    ],
  },
  {
    title: t("group.admin"),
    items: [
      { icon: featureIcon("icon_10_r2c2"), label: t("nav.releases"), path: "/fetcher/releases", adminOnly: true },
      { icon: featureIcon("icon_44_r6c4"), label: t("nav.userManagement"), path: "/fetcher/admin", adminOnly: true, isNew: true },
      { icon: featureIcon("icon_16_r2c8"), label: t("nav.activityLog"), path: "/admin/activity-log", adminOnly: true },
      { icon: featureIcon("icon_41_r6c1"), label: t("nav.titanServer"), path: "/admin/titan-server", adminOnly: true, isNew: true },
      { icon: featureIcon("icon_06_r1c6"), label: t("nav.selfImprovement"), path: "/fetcher/self-improvement", adminOnly: true, isNew: true },
    ],
  },
  ];
}
// Flat list for active item detection (English fallback for path matching)
const allMenuItemPaths = [
  "/dashboard", "/sandbox", "/project-files", "/fetcher/smart-fetch", "/fetcher/new", "/fetcher/jobs",
  "/marketplace", "/marketplace/inventory", "/marketplace/sell", "/marketplace/seller",
  "/fetcher/totp-vault", "/fetcher/watchdog", "/fetcher/provider-health", "/fetcher/health-trends",
  "/fetcher/leak-scanner", "/fetcher/credential-health", "/site-monitor", "/linken-sphere",
  "/cybermcp", "/astra", "/argus", "/replicate", "/evilginx", "/blackeye", "/metasploit", "/storage",
  "/grants", "/grant-applications", "/companies", "/business-plans", "/crowdfunding",
  "/crowdfunding/my-campaigns", "/advertising", "/affiliate", "/referrals", "/seo",
  "/blog-admin", "/marketing", "/content-creator", "/master-growth",
  "/dashboard/subscription", "/dashboard/credits", "/fetcher/credentials", "/fetcher/api-access",
  "/fetcher/team", "/fetcher/team-vault", "/fetcher/settings",
  "/fetcher/export", "/fetcher/import", "/fetcher/bulk-sync", "/fetcher/auto-sync",
  "/fetcher/onboarding", "/fetcher/history", "/fetcher/audit-logs",
  "/fetcher/developer-docs", "/fetcher/webhooks", "/fetcher/notifications",
  "/fetcher/api-analytics", "/fetcher/cli", "/fetcher/git-bash", "/fetcher/download-app",
  "/fetcher/releases", "/fetcher/admin", "/admin/activity-log", "/admin/titan-server", "/fetcher/self-improvement",
  "/tor", "/vpn-chain", "/proxy-maker", "/proxy-rotation", "/ip-rotation", "/bin-checker", "/exploitpack",
  "/web-agent",
];

const SIDEBAR_WIDTH_KEY = "fetcher-sidebar-width";
const DEFAULT_WIDTH = 260;
const MIN_WIDTH = 200;
const MAX_WIDTH = 400;

function ArchibaldToggleItem() {
  const { isEnabled, toggle } = useArchibald();
  return (
    <DropdownMenuItem
      onClick={(e) => {
        e.preventDefault();
        toggle();
      }}
      className="cursor-pointer"
    >
      <Wand2 className="mr-2 h-4 w-4" />
      <span>{isEnabled ? "Hide Help Bot" : "Show Help Bot"}</span>
    </DropdownMenuItem>
  );
}

// ─── Voice Mode Toggle ─────────────────────────────────────────────────────
function VoiceModeToggle() {
  const { enabled, phase, setEnabled } = useVoiceMode();
  const isListening  = phase === "active" || phase === "recording";
  const isSpeaking   = phase === "speaking";
  const isStandby    = phase === "standby";
  const isProcessing = phase === "processing";
  return (
    <button
      onClick={() => setEnabled(!enabled)}
      title={
        !enabled      ? "Voice Mode OFF — tap to enable" :
        isStandby     ? 'Standby — say "Titan" to wake' :
        isListening   ? "Listening..." :
        isSpeaking    ? "Titan is speaking..." :
        isProcessing  ? "Processing..." :
        "Voice Mode ON — tap to disable"
      }
      className={`flex items-center gap-1.5 flex-1 rounded-lg px-2 py-1.5 text-xs font-medium transition-all border ${
        !enabled
          ? "bg-zinc-800/50 text-zinc-500 border-zinc-700/50 hover:bg-zinc-700/50"
          : isListening
          ? "bg-red-500/20 text-red-300 border-red-500/30 hover:bg-red-500/30 animate-pulse"
          : isSpeaking
          ? "bg-purple-500/20 text-purple-300 border-purple-500/30 hover:bg-purple-500/30"
          : isStandby
          ? "bg-amber-500/20 text-amber-300 border-amber-500/30 hover:bg-amber-500/30"
          : isProcessing
          ? "bg-blue-500/20 text-blue-300 border-blue-500/30 animate-pulse"
          : "bg-blue-500/20 text-blue-300 border-blue-500/30 hover:bg-blue-500/30"
      } group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:flex-none group-data-[collapsible=icon]:w-8 group-data-[collapsible=icon]:h-8`}
    >
      {!enabled ? (
        <MicOff className="h-3.5 w-3.5 shrink-0" />
      ) : isListening ? (
        <Mic className="h-3.5 w-3.5 shrink-0 animate-pulse" />
      ) : (
        <Mic className="h-3.5 w-3.5 shrink-0" />
      )}
      <span className="group-data-[collapsible=icon]:hidden">
        {!enabled      ? "Voice OFF" :
         isListening   ? "Listening" :
         isSpeaking    ? "Speaking" :
         isStandby     ? "Standby" :
         isProcessing  ? "Processing" :
         "Voice ON"}
      </span>
    </button>
  );
}

// ─── VPN Sidebar Widget ───────────────────────────────────────────────────
const VPN_COUNTRIES = [
  { id: "us", name: "United States", flag: "🇺🇸" },
  { id: "gb", name: "United Kingdom", flag: "🇬🇧" },
  { id: "ca", name: "Canada", flag: "🇨🇦" },
  { id: "de", name: "Germany", flag: "🇩🇪" },
  { id: "fr", name: "France", flag: "🇫🇷" },
  { id: "nl", name: "Netherlands", flag: "🇳🇱" },
  { id: "jp", name: "Japan", flag: "🇯🇵" },
  { id: "au", name: "Australia", flag: "🇦🇺" },
  { id: "br", name: "Brazil", flag: "🇧🇷" },
  { id: "in", name: "India", flag: "🇮🇳" },
  { id: "sg", name: "Singapore", flag: "🇸🇬" },
  { id: "hk", name: "Hong Kong", flag: "🇭🇰" },
  { id: "se", name: "Sweden", flag: "🇸🇪" },
  { id: "ch", name: "Switzerland", flag: "🇨🇭" },
  { id: "mx", name: "Mexico", flag: "🇲🇽" },
  { id: "ru", name: "Russia", flag: "🇷🇺" },
  { id: "ua", name: "Ukraine", flag: "🇺🇦" },
  { id: "pl", name: "Poland", flag: "🇵🇱" },
  { id: "it", name: "Italy", flag: "🇮🇹" },
  { id: "es", name: "Spain", flag: "🇪🇸" },
  { id: "il", name: "Israel", flag: "🇮🇱" },
];

function VpnSidebarWidget() {
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [, setLocation] = useLocation();
  const [showCountries, setShowCountries] = useState(false);
  const vpnStatus = trpc.vpn.getStatus.useQuery(undefined, { retry: false, refetchInterval: 10000 });
  const vpnToggle = trpc.vpn.toggleStatus.useMutation({
    onSuccess: () => vpnStatus.refetch(),
    onError: (err) => toast.error(err.message),
  });

  const active = vpnStatus.data?.active ?? false;
  const country = vpnStatus.data?.country ?? "us";
  const currentCountry = VPN_COUNTRIES.find(c => c.id === country);

  if (isCollapsed) {
    return (
      <div className="flex items-center gap-2 px-1 pb-1">
        <button
          onClick={() => setLocation("/vpn")}
          title={`VPN ${active ? "ON" : "OFF"} — ${currentCountry?.name ?? country}`}
          className={`flex items-center justify-center w-8 h-8 rounded-lg text-xs font-medium transition-all border ${
            active
              ? "bg-green-500/20 text-green-300 border-green-500/30 hover:bg-green-500/30"
              : "bg-zinc-800/50 text-zinc-500 border-zinc-700/50 hover:bg-zinc-700/50"
          }`}
        >
          <Shield className="h-3.5 w-3.5 shrink-0" />
        </button>
      </div>
    );
  }

  return (
    <div className="px-1 pb-1">
      {/* Toggle row */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => vpnToggle.mutate({ active: !active, country })}
          disabled={vpnToggle.isPending}
          title={active ? "VPN ON — click to disconnect" : "VPN OFF — click to connect"}
          className={`flex items-center gap-1.5 flex-1 rounded-lg px-2 py-1.5 text-xs font-medium transition-all disabled:opacity-60 border ${
            active
              ? "bg-green-500/20 text-green-300 border-green-500/30 hover:bg-green-500/30"
              : "bg-zinc-800/50 text-zinc-500 border-zinc-700/50 hover:bg-zinc-700/50"
          }`}
        >
          {vpnToggle.isPending
            ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
            : <Shield className="h-3.5 w-3.5 shrink-0" />}
          <span>VPN {active ? "ON" : "OFF"}</span>
          {currentCountry && (
            <span className="ml-auto text-[10px] opacity-70">{currentCountry.flag}</span>
          )}
        </button>
        <button
          onClick={() => setShowCountries(v => !v)}
          title="Select country"
          className="flex items-center justify-center w-7 h-7 rounded-lg border border-zinc-700/50 bg-zinc-800/50 hover:bg-zinc-700/50 text-zinc-500 hover:text-zinc-300 transition-all text-xs"
        >
          <Globe className="h-3 w-3" />
        </button>
      </div>

      {/* Scrollable country list */}
      {showCountries && (
        <div className="mt-1 rounded-lg border border-zinc-700/50 bg-zinc-900/80 overflow-hidden">
          <div className="max-h-40 overflow-y-auto scrollbar-thin">
            {VPN_COUNTRIES.map(c => (
              <button
                key={c.id}
                onClick={() => {
                  vpnToggle.mutate({ active, country: c.id });
                  setShowCountries(false);
                }}
                className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-left transition-colors ${
                  c.id === country
                    ? "bg-green-500/15 text-green-300"
                    : "text-zinc-400 hover:bg-zinc-800/80 hover:text-zinc-200"
                }`}
              >
                <span>{c.flag}</span>
                <span className="truncate">{c.name}</span>
                {c.id === country && <span className="ml-auto text-[9px] text-green-400">✓</span>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function FetcherLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const { loading, user } = useAuth();

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  if (loading) {
    return <DashboardLayoutSkeleton />;
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="flex flex-col items-center gap-8 p-8 max-w-md w-full">
          <div className="relative">
            <div className="absolute inset-0 bg-blue-500/20 rounded-full blur-xl" />
            <div className="relative flex items-center gap-3">
              <TitanLogo size="xl" />
              <h1 className="text-3xl font-bold tracking-tight">
                Archibald Titan
              </h1>
            </div>
          </div>
          <p className="text-sm text-muted-foreground text-center max-w-sm">
            Sign in to access Fetcher and manage your API credentials securely.
          </p>
          <Button
            onClick={() => {
              window.location.href = getLoginUrl(window.location.pathname);
            }}
            size="lg"
            className="w-full shadow-lg hover:shadow-xl transition-all bg-blue-600 hover:bg-blue-500"
          >
            Sign in
          </Button>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": `${sidebarWidth}px`,
        } as CSSProperties
      }
    >
      <FetcherLayoutContent setSidebarWidth={setSidebarWidth}>
        {children}
      </FetcherLayoutContent>
      <OnboardingWizard />
      <HelpBotWidget />
      {isDesktop() && <DesktopStatusBar />}
    </SidebarProvider>
  );
}

function FetcherLayoutContent({
  children,
  setSidebarWidth,
}: {
  children: React.ReactNode;
  setSidebarWidth: (width: number) => void;
}) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const { theme, toggleTheme } = useTheme();
  const { t } = useLanguage();
  const sub = useSubscription();
  const isCollapsed = state === "collapsed";
  const menuGroups = buildMenuGroups(t);
  const [isResizing, setIsResizing] = useState(false);
  const [showAddAdminModal, setShowAddAdminModal] = useState(false);
  const [showOutOfCredits, setShowOutOfCredits] = useState(false);

  // Listen for global credit-exhaustion events fired from main.tsx
  // This catches FORBIDDEN errors from ANY tRPC router without per-router wiring.
  useEffect(() => {
    const handler = () => setShowOutOfCredits(true);
    window.addEventListener("titan:out-of-credits", handler);
    return () => window.removeEventListener("titan:out-of-credits", handler);
  }, []);

  // Grant daily free credits to free tier users on mount (silently)
  const grantDailyFree = trpc.escalation.grantDailyFreeCredits.useMutation();
  useEffect(() => {
    if (user && sub?.planId === "free") {
      grantDailyFree.mutate();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const allMenuItems = menuGroups.flatMap((g) => g.items);
  const activeMenuItem = allMenuItems.find(
    (item) => item.path === location || (item.path !== "/dashboard" && location.startsWith(item.path))
  );
  const isMobile = useIsMobile();
  // IP Rotation status for sidebar toggle
  const ipRotationQuery = trpc.ipRotation.getActiveState.useQuery(undefined, { retry: false, refetchInterval: 5000 });
  const enableAllLayers = trpc.ipRotation.enableAll.useMutation({
    onSuccess: () => { ipRotationQuery.refetch(); toast.success("IP Rotation enabled — all 3 layers active"); },
    onError: (err) => toast.error(err.message),
  });
  const disableAllLayers = trpc.ipRotation.disableAll.useMutation({
    onSuccess: () => { ipRotationQuery.refetch(); toast.success("IP Rotation disabled"); },
    onError: (err) => toast.error(err.message),
  });
  const proxyActive = ipRotationQuery.data?.active ?? false;
  useEffect(() => {
    if (isCollapsed) setIsResizing(false);
  }, [isCollapsed]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const sidebarLeft =
        sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const newWidth = e.clientX - sidebarLeft;
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) {
        setSidebarWidth(newWidth);
      }
    };
    const handleMouseUp = () => setIsResizing(false);

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth]);

  return (
    <>
      <OutOfCreditsModal open={showOutOfCredits} onClose={() => setShowOutOfCredits(false)} />
      <div className="relative" ref={sidebarRef}>
        <Sidebar
          collapsible="icon"
          className="border-r-0"
          disableTransition={isResizing}
        >
          <SidebarHeader className="h-16 justify-center">
            <div className="flex items-center gap-3 px-2 transition-all w-full">
              <button
                onClick={toggleSidebar}
                className="h-8 w-8 flex items-center justify-center hover:bg-accent rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring shrink-0"
                aria-label="Toggle navigation"
              >
                <PanelLeft className="h-4 w-4 text-muted-foreground" />
              </button>
              {!isCollapsed && (
                <div
                  className="flex items-center gap-2 min-w-0 cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={() => setLocation("/")}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === "Enter" && setLocation("/")}
                  title="Go to home"
                >
                  <TitanLogo size="sm" />
                  <span className="font-semibold tracking-tight truncate bg-gradient-to-r from-blue-400 to-blue-200 bg-clip-text text-transparent">
                    Archibald Titan
                  </span>
                </div>
              )}
            </div>
          </SidebarHeader>

          <SidebarContent className="gap-0 overflow-y-auto scrollbar-thin">
            {menuGroups.map((group) => {
              const visibleItems = group.items.filter(
                (item) => {
                  if (item.adminOnly && user?.role !== "admin" && user?.role !== "head_admin") return false;
                  if (item.titanOnly) {
                    const plan = sub.planId;
                    if (plan !== "titan" && user?.role !== "admin" && user?.role !== "head_admin") return false;
                  }
                  if (item.premiumOnly) {
                    const plan = sub.planId;
                    if (plan !== "cyber_plus" && plan !== "titan" && user?.role !== "admin" && user?.role !== "head_admin") return false;
                  }
                  return true;
                }
              );
              if (visibleItems.length === 0) return null;
              return (
                <div key={group.title} className="mb-1">
                  {!isCollapsed && (
                    <div className="px-4 pt-4 pb-1">
                      <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground/50">
                        {group.title}
                      </span>
                    </div>
                  )}
                  {isCollapsed && <div className="h-2" />}
                  <SidebarMenu className="px-2 py-0.5">
                    {visibleItems.map((item) => {
                      const isActive =
                        item.path === "/dashboard"
                          ? location === "/dashboard"
                          : location.startsWith(item.path);
                      return (
                        <SidebarMenuItem key={item.path}>
                          <SidebarMenuButton
                            isActive={isActive}
                            onClick={() => { setLocation(item.path); if (isMobile) toggleSidebar(); }}
                            tooltip={item.label}
                            className={`h-12 sm:h-9 transition-all font-normal ${
                              isActive
                                ? "bg-blue-500/10 text-blue-400 font-medium"
                                : "hover:bg-white/[0.04]"
                            }`}
                          >
                            <item.icon
                              className={`h-4 w-4 shrink-0 ${isActive ? "text-blue-400" : "text-muted-foreground"}`}
                            />
                            <span className="flex-1 truncate">{item.label}</span>
                            {item.isCyber && !isCollapsed && (
                              <span className="ml-auto text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/20">
                                cyber
                              </span>
                            )}
                            {item.isNew && !item.isCyber && !isCollapsed && (
                              <span className="ml-auto text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/20">
                                new
                              </span>
                            )}
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    })}
                  </SidebarMenu>
                </div>
              );
            })}
            {/* Created by Leego branding */}
            {!isCollapsed && (
              <div className="flex justify-center py-3 mt-auto">
                <img
                  src="/Madebyleego.png"
                  alt="Created by Leego"
                  className="h-14 w-14 object-contain opacity-100 brightness-110 transition-all duration-300 drop-shadow-[0_0_14px_rgba(0,255,50,0.8)] hover:drop-shadow-[0_0_22px_rgba(0,255,50,1)] hover:brightness-125 animate-pulse"
                  style={{ filter: 'drop-shadow(0 0 10px rgba(0, 255, 50, 0.7)) drop-shadow(0 0 20px rgba(0, 255, 50, 0.4)) drop-shadow(0 0 40px rgba(0, 255, 50, 0.2))' }}
                  loading="lazy"
                />
              </div>
            )}
            {isCollapsed && (
              <div className="flex justify-center py-2 mt-auto">
                <img
                  src="/Madebyleego.png"
                  alt="Created by Leego"
                  className="h-8 w-8 object-contain opacity-100 brightness-110 transition-all duration-300 drop-shadow-[0_0_10px_rgba(0,255,50,0.8)] hover:drop-shadow-[0_0_18px_rgba(0,255,50,1)] hover:brightness-125 animate-pulse"
                  style={{ filter: 'drop-shadow(0 0 8px rgba(0, 255, 50, 0.7)) drop-shadow(0 0 16px rgba(0, 255, 50, 0.4))' }}
                  loading="lazy"
                />
              </div>
            )}
          </SidebarContent>

          <SidebarFooter className="p-3 border-t border-white/5">
            {!isCollapsed && (
              <div className="flex items-center justify-between px-2 pb-2">
                <LanguageSelector forceUp />
                {toggleTheme && (
                  <button
                    onClick={toggleTheme}
                    className="p-1.5 rounded-lg hover:bg-accent/50 text-muted-foreground hover:text-foreground transition-colors"
                    title={theme === 'dark' ? 'Switch to day mode' : 'Switch to night mode'}
                  >
                    {theme === 'dark' ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-blue-400" />}
                  </button>
                )}
              </div>
            )}
            {isCollapsed && (
              <div className="flex flex-col items-center gap-2 pb-2">
                <LanguageSelector compact forceUp />
                {toggleTheme && (
                  <button
                    onClick={toggleTheme}
                    className="p-1.5 rounded-lg hover:bg-accent/50 text-muted-foreground hover:text-foreground transition-colors"
                    title={theme === 'dark' ? 'Switch to day mode' : 'Switch to night mode'}
                  >
                    {theme === 'dark' ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-blue-400" />}
                  </button>
                )}
              </div>
            )}
            {/* Voice Mode toggle */}
            <div className="flex items-center gap-2 px-1 pb-1">
              <VoiceModeToggle />
            </div>
            {/* VPN quick toggle with country selector */}
            <VpnSidebarWidget />
            {/* IP Rotation quick toggle */}
            <div className="flex items-center gap-2 px-1 pb-1">
              <button
                onClick={() => {
                  if (enableAllLayers.isPending || disableAllLayers.isPending) return;
                  if (proxyActive) { disableAllLayers.mutate(); } else { enableAllLayers.mutate(); }
                }}
                disabled={enableAllLayers.isPending || disableAllLayers.isPending}
                title={proxyActive ? "IP Rotation ON (3 layers) — tap to disable" : "IP Rotation OFF — tap to enable all 3 layers"}
                className={`flex items-center gap-1.5 flex-1 rounded-lg px-2 py-1.5 text-xs font-medium transition-all disabled:opacity-60 disabled:cursor-not-allowed ${
                  proxyActive
                    ? "bg-green-500/20 text-green-300 border border-green-500/30 hover:bg-green-500/30"
                    : "bg-zinc-800/50 text-zinc-500 border border-zinc-700/50 hover:bg-zinc-700/50"
                } group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:flex-none group-data-[collapsible=icon]:w-8 group-data-[collapsible=icon]:h-8`}
              >
                {(enableAllLayers.isPending || disableAllLayers.isPending)
                  ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
                  : <Shield className="h-3.5 w-3.5 shrink-0" />}
                <span className="group-data-[collapsible=icon]:hidden">IP Rot {proxyActive ? "ON" : "OFF"}</span>
              </button>
            </div>
            {/* Standalone Logout Button — always visible in sidebar footer */}
            <button
              onClick={logout}
              title="Sign out"
              className="flex items-center gap-2 w-full rounded-xl px-3 py-2 mb-1 text-sm font-medium text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-all group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
            >
              <LogOut className="h-4 w-4 shrink-0" />
              <span className="group-data-[collapsible=icon]:hidden">{t("common.signOut")}</span>
            </button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-white/[0.04] transition-all w-full text-left group-data-[collapsible=icon]:justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <Avatar className="h-9 w-9 border border-blue-500/20 shrink-0">
                    <AvatarFallback className="text-xs font-medium bg-blue-500/10 text-blue-400">
                      {user?.name?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate leading-none">
                        {user?.name || "-"}
                      </p>
                      <PlanBadge planId={sub.planId} />
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-1.5">
                      {user?.email || "-"}
                    </p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem
                  onClick={() => setLocation("/fetcher/account")}
                  className="cursor-pointer h-10 sm:h-auto"
                >
                  <Settings className="mr-2 h-4 w-4" />
                  <span>{t("common.accountSettings")}</span>
                </DropdownMenuItem>
                <ArchibaldToggleItem />
                {toggleTheme && (
                  <DropdownMenuItem onClick={toggleTheme} className="cursor-pointer">
                    {theme === 'dark' ? <Sun className="mr-2 h-4 w-4 text-amber-400" /> : <Moon className="mr-2 h-4 w-4 text-blue-400" />}
                    <span>{theme === 'dark' ? t("common.dayMode") || 'Day Mode' : t("common.nightMode") || 'Night Mode'}</span>
                  </DropdownMenuItem>
                )}
                {sub.isFree && (
                  <DropdownMenuItem
                    onClick={() => setLocation("/pricing")}
                    className="cursor-pointer text-amber-500 focus:text-amber-500"
                  >
                    <Crown className="mr-2 h-4 w-4" />
                    <span>{t("common.upgradePlan")}</span>
                  </DropdownMenuItem>
                )}
                {isAdminRole(user?.role) && (
                  <DropdownMenuItem
                    onClick={() => setShowAddAdminModal(true)}
                    className="cursor-pointer text-blue-400 focus:text-blue-400"
                  >
                    <UserPlus className="mr-2 h-4 w-4" />
                    <span>Manage Admins</span>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  onClick={logout}
                  className="cursor-pointer text-destructive focus:text-destructive h-10 sm:h-auto"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>{t("common.signOut")}</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>
        <div
          className={`absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/20 transition-colors ${isCollapsed ? "hidden" : ""}`}
          onMouseDown={() => {
            if (isCollapsed) return;
            setIsResizing(true);
          }}
          style={{ zIndex: 50 }}
        />
      </div>

      {/* Add Admin Modal — only rendered for admins */}
      {isAdminRole(user?.role) && (
        <AddAdminModal
          open={showAddAdminModal}
          onClose={() => setShowAddAdminModal(false)}
          currentUserRole={user?.role ?? "user"}
        />
      )}

      <SidebarInset>
        {isMobile && (
          <div className="flex border-b border-white/10 h-14 items-center justify-between bg-background px-3 sticky top-0 z-50 safe-area-top" id="mobile-nav-header">
            <div className="flex items-center gap-3">
              <SidebarTrigger className="h-10 w-10 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-foreground [&_svg]:!h-5 [&_svg]:!w-5" />
              <div
                className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
                onClick={() => setLocation("/")}
                role="button"
                tabIndex={0}
                title="Go to home"
              >
                <TitanLogo size="sm" />
                <span className="tracking-tight text-foreground font-semibold text-sm">
                  {activeMenuItem?.label ?? "Archibald Titan"}
                </span>
              </div>
            </div>
            <LanguageSelector compact />
          </div>
        )}
        <TrialBanner />
        <DesktopOfflineGuard />
        <main className="flex-1 p-3 sm:p-4 md:p-6 overflow-x-hidden max-md:[&:has(.chat-page-root)]:p-0 [&:has(.chat-page-root)]:overflow-hidden">{children}</main>
      </SidebarInset>
    </>
  );
}
