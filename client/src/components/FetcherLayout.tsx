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
  Shield,
  Loader2,
  Mic,
  MicOff,
  Cpu,
  Workflow,
  Database,
  Layers,
  ShieldQuestion,
  Fingerprint,
  Network,
  Settings2,
  GitBranch,
  Globe2,
  Boxes,
  Server,
  FileCode,
  Monitor
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
    // SECTION 1: COMMAND CENTER
    // ═══════════════════════════════════════════════════════════════
    {
      title: "Command Center",
      items: [
        { icon: LayoutDashboard, label: "Overview", path: "/dashboard" },
        { icon: Terminal, label: "Titan Builder", path: "/builder" },
        { icon: Monitor, label: "Command Centre", path: "/command-centre" },
        { icon: Boxes, label: "Module Library", path: "/marketplace" },
        { icon: FolderOpen, label: "Project Files", path: "/project-files" },
      ],
    },
    // ═══════════════════════════════════════════════════════════════
    // SECTION 2: DEVSECOPS SUITE
    // ═══════════════════════════════════════════════════════════════
    {
      title: "DevSecOps Suite",
      items: [
        { icon: ShieldCheck, label: "Astra Scanner", path: "/astra", isCyber: true },
        { icon: Search, label: "Argus OSINT", path: "/argus", isCyber: true },
        { icon: ShieldAlert, label: "Leak Scanner", path: "/fetcher/leak-scanner", isCyber: true },
        { icon: Activity, label: "Site Monitor", path: "/site-monitor", premiumOnly: true },
        { icon: Network, label: "Attack Graph", path: "/attack-graph", isCyber: true },
        { icon: ScrollText, label: "Compliance", path: "/compliance-reports", isCyber: true },
      ],
    },
    // ═══════════════════════════════════════════════════════════════
    // SECTION 3: INFRASTRUCTURE & VAULT
    // ═══════════════════════════════════════════════════════════════
    {
      title: "Infrastructure & Vault",
      items: [
        { icon: Vault, label: "Secure Vault", path: "/fetcher/credentials" },
        { icon: Fingerprint, label: "TOTP Manager", path: "/fetcher/totp-vault", isCyber: true },
        { icon: Database, label: "Titan Storage", path: "/storage" },
        { icon: Workflow, label: "Automations", path: "/fetcher/auto-sync" },
        { icon: Globe2, label: "Provider Hub", path: "/fetcher/provider-health" },
      ],
    },
    // ═══════════════════════════════════════════════════════════════
    // SECTION 4: ORGANIZATION
    // ═══════════════════════════════════════════════════════════════
    {
      title: "Organization",
      items: [
        { icon: Users, label: "Team Management", path: "/fetcher/team" },
        { icon: CreditCard, label: "Billing & Credits", path: "/dashboard/subscription" },
        { icon: Webhook, label: "API & Webhooks", path: "/fetcher/api-access" },
        { icon: Settings2, label: "System Settings", path: "/fetcher/settings" },
        { icon: Shield, label: "Admin Console", path: "/fetcher/admin", adminOnly: true },
      ],
    },
  ];
}

export function FetcherLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const { subscription } = useSubscription();
  const [location, setLocation] = useLocation();
  const { t } = useLanguage();
  const { theme, setTheme } = useTheme();
  const { isCollapsed, toggleSidebar } = useSidebar();
  const isMobile = useIsMobile();
  const [showAddAdmin, setShowAddAdmin] = useState(false);
  const { isListening, toggleListening } = useVoiceMode();

  const menuGroups = buildMenuGroups(t);

  if (loading) return <DashboardLayoutSkeleton />;
  if (!user) {
    window.location.href = getLoginUrl();
    return null;
  }

  const isActive = (path: string) => location === path || (path !== "/dashboard" && location.startsWith(path));

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-[#02040a]">
        <Sidebar collapsible="icon" className="border-r border-white/[0.05] bg-[#03060e]">
          <SidebarHeader className="h-16 flex items-center px-4 border-b border-white/[0.05]">
            <Link href="/dashboard" className="flex items-center gap-3 overflow-hidden">
              <TitanLogo size="sm" />
              {!isCollapsed && (
                <span className="text-sm font-bold tracking-tight text-white/90 whitespace-nowrap">
                  Archibald Titan
                </span>
              )}
            </Link>
          </SidebarHeader>

          <SidebarContent className="py-4 px-2 custom-scrollbar">
            {menuGroups.map((group, idx) => (
              <div key={idx} className="mb-6 last:mb-0">
                {!isCollapsed && (
                  <h4 className="px-3 mb-2 text-[10px] font-black uppercase tracking-widest text-white/20">
                    {group.title}
                  </h4>
                )}
                <SidebarMenu>
                  {group.items.map((item) => {
                    if (item.adminOnly && !isAdminRole(user.role)) return null;
                    if (item.titanOnly && subscription?.planId !== "titan") return null;

                    const active = isActive(item.path);
                    return (
                      <SidebarMenuItem key={item.path}>
                        <SidebarMenuButton
                          asChild
                          isActive={active}
                          tooltip={item.label}
                          className={`h-9 transition-all duration-200 ${
                            active 
                              ? "bg-blue-600/10 text-blue-400 font-semibold" 
                              : "text-white/40 hover:text-white/70 hover:bg-white/[0.03]"
                          }`}
                        >
                          <Link href={item.path} className="flex items-center gap-3">
                            <item.icon className={`h-4 w-4 shrink-0 ${active ? "text-blue-400" : ""}`} />
                            {!isCollapsed && <span className="text-sm truncate">{item.label}</span>}
                            {!isCollapsed && item.isCyber && (
                              <Lock className="h-3 w-3 ml-auto text-blue-500/40" />
                            )}
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </div>
            ))}
          </SidebarContent>

          <SidebarFooter className="p-4 border-t border-white/[0.05]">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 w-full p-2 rounded-xl hover:bg-white/[0.03] transition-colors text-left group">
                  <Avatar className="h-8 w-8 border border-white/10">
                    <AvatarFallback className="bg-blue-600/20 text-blue-400 text-xs font-bold">
                      {user.email?.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  {!isCollapsed && (
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-white/80 truncate">{user.email}</p>
                      <p className="text-[10px] text-white/30 truncate uppercase tracking-tighter">
                        {subscription?.planId || "Free"} Tier
                      </p>
                    </div>
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 bg-[#0c111d] border-white/10 text-white">
                <DropdownMenuItem onClick={() => setLocation("/fetcher/settings")} className="hover:bg-white/5 cursor-pointer">
                  <UserCog className="h-4 w-4 mr-2 text-white/40" /> Profile Settings
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => logout()} className="hover:bg-red-500/10 text-red-400 cursor-pointer">
                  <LogOut className="h-4 w-4 mr-2" /> Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>

        <SidebarInset className="flex flex-col flex-1 min-w-0 bg-[#02040a]">
          <header className="h-16 flex items-center justify-between px-4 sm:px-6 border-b border-white/[0.05] bg-[#02040a]/50 backdrop-blur-xl sticky top-0 z-30">
            <div className="flex items-center gap-4">
              <SidebarTrigger className="text-white/40 hover:text-white" />
              <div className="h-4 w-px bg-white/10 hidden sm:block" />
              <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/5 border border-blue-500/10">
                <Activity className="h-3 w-3 text-blue-500" />
                <span className="text-[10px] font-black uppercase tracking-widest text-blue-400/80">System Operational</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.05]">
                <Zap className="h-3.5 w-3.5 text-amber-400" />
                <span className="text-xs font-bold text-white/60">{subscription?.credits?.toLocaleString() ?? 0}</span>
                <span className="text-[10px] font-medium text-white/20 uppercase tracking-tighter">Credits</span>
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                className="text-white/40 hover:text-white hover:bg-white/5"
              >
                {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                className="text-white/40 hover:text-white hover:bg-white/5 relative"
              >
                <Bell className="h-4 w-4" />
                <span className="absolute top-2 right-2 h-1.5 w-1.5 bg-blue-500 rounded-full" />
              </Button>
            </div>
          </header>

          <main className="flex-1 overflow-y-auto custom-scrollbar">
            {children}
          </main>
        </SidebarInset>
      </div>
      <OutOfCreditsModal />
      <AddAdminModal open={showAddAdmin} onOpenChange={setShowAddAdmin} />
    </SidebarProvider>
  );
}
