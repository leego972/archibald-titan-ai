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
import { useSubscription } from "@/hooks/useSubscription";
import {
  LayoutDashboard,
  Terminal,
  Monitor,
  FolderOpen,
  ShieldCheck,
  Search,
  ShieldAlert,
  Network,
  Activity,
  ScrollText,
  History,
  Vault,
  Workflow,
  Webhook,
  Globe2,
  Boxes,
  Database,
  Users,
  CreditCard,
  Settings2,
  Shield,
  LogOut,
  UserCog,
  Zap,
  Sun,
  Moon,
  Bell,
  Lock
} from "lucide-react";
import { useState } from "react";
import { useLocation, Link } from "wouter";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";
import { TitanLogo } from "./TitanLogo";
import { Button } from "./ui/button";
import { useTheme } from "@/contexts/ThemeContext";
import { useLanguage } from "@/i18n";
import { isAdminRole } from "@shared/const";

type MenuItem = {
  icon: any;
  label: string;
  path: string;
  adminOnly?: boolean;
  premiumOnly?: boolean;
  titanOnly?: boolean;
  isCyber?: boolean;
};

type MenuGroup = {
  title: string;
  items: MenuItem[];
};

function buildMenuGroups(t: (key: string) => string): MenuGroup[] {
  return [
    {
      title: "Builder",
      items: [
        { icon: LayoutDashboard, label: "Overview", path: "/dashboard" },
        { icon: Terminal, label: "Titan Builder", path: "/builder" },
        { icon: Monitor, label: "Command Centre", path: "/command-centre" },
        { icon: FolderOpen, label: "Project Files", path: "/project-files" },
      ],
    },
    {
      title: "Security",
      items: [
        { icon: ShieldCheck, label: "Astra Scanner", path: "/astra", isCyber: true },
        { icon: Search, label: "Argus OSINT", path: "/argus", isCyber: true },
        { icon: ShieldAlert, label: "Leak Scanner", path: "/fetcher/leak-scanner", isCyber: true },
        { icon: Network, label: "Attack Graph", path: "/attack-graph", isCyber: true },
      ],
    },
    {
      title: "Monitoring & Compliance",
      items: [
        { icon: Activity, label: "Site Monitor", path: "/site-monitor", premiumOnly: true },
        { icon: ScrollText, label: "Compliance Reports", path: "/compliance-reports", isCyber: true },
        { icon: History, label: "Audit Logs", path: "/fetcher/audit-logs" },
      ],
    },
    {
      title: "Integrations & Automation",
      items: [
        { icon: Vault, label: "Secure Vault", path: "/fetcher/credentials" },
        { icon: Workflow, label: "Automations", path: "/fetcher/auto-sync" },
        { icon: Webhook, label: "API & Webhooks", path: "/fetcher/api-access" },
        { icon: Globe2, label: "Provider Hub", path: "/fetcher/provider-health" },
      ],
    },
    {
      title: "Extensions",
      items: [
        { icon: Boxes, label: "Module Library", path: "/marketplace" },
        { icon: Database, label: "Titan Storage", path: "/storage" },
      ],
    },
    {
      title: "Organization",
      items: [
        { icon: Users, label: "Team Management", path: "/fetcher/team" },
        { icon: CreditCard, label: "Billing & Credits", path: "/dashboard/subscription" },
        { icon: Settings2, label: "System Settings", path: "/fetcher/settings" },
        { icon: Shield, label: "Admin Console", path: "/fetcher/admin", adminOnly: true },
      ],
    },
  ];
}

export default function FetcherLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const { subscription } = useSubscription();
  const [location, setLocation] = useLocation();
  const { t } = useLanguage();
  const { theme, setTheme } = useTheme();
  const { isCollapsed } = useSidebar();

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
                <span className="text-sm font-black tracking-tight text-white/90 whitespace-nowrap uppercase">
                  Archibald Titan
                </span>
              )}
            </Link>
          </SidebarHeader>

          <SidebarContent className="py-6 px-2 custom-scrollbar">
            {menuGroups.map((group, idx) => (
              <div key={idx} className="mb-8 last:mb-0">
                {!isCollapsed && (
                  <h4 className="px-3 mb-3 text-[9px] font-black uppercase tracking-[0.2em] text-white/20">
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
                              ? "bg-blue-600/10 text-blue-400 font-bold" 
                              : "text-white/40 hover:text-white/70 hover:bg-white/[0.02]"
                          }`}
                        >
                          <Link href={item.path} className="flex items-center gap-3">
                            <item.icon className={`h-4 w-4 shrink-0 ${active ? "text-blue-400" : ""}`} />
                            {!isCollapsed && <span className="text-xs truncate">{item.label}</span>}
                            {!isCollapsed && item.isCyber && (
                              <Lock className="h-2.5 w-2.5 ml-auto text-blue-500/30" />
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
                <button className="flex items-center gap-3 w-full p-2 rounded-xl hover:bg-white/[0.02] transition-colors text-left group">
                  <Avatar className="h-8 w-8 border border-white/10">
                    <AvatarFallback className="bg-blue-600/10 text-blue-400 text-[10px] font-black">
                      {user.email?.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  {!isCollapsed && (
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-bold text-white/80 truncate">{user.email}</p>
                      <p className="text-[9px] text-white/20 truncate uppercase tracking-widest font-black">
                        {subscription?.planId ? subscription.planId.replace(/_/g, " ") : "No Active Plan"} Tier
                      </p>
                    </div>
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 bg-[#0c111d] border-white/10 text-white">
                <DropdownMenuItem onClick={() => setLocation("/fetcher/settings")} className="hover:bg-white/5 cursor-pointer text-xs font-bold">
                  <UserCog className="h-3.5 w-3.5 mr-2 text-white/40" /> Profile Settings
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => logout()} className="hover:bg-red-500/10 text-red-400 cursor-pointer text-xs font-bold">
                  <LogOut className="h-3.5 w-3.5 mr-2" /> Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>

        <SidebarInset className="flex flex-col flex-1 min-w-0 bg-[#02040a]">
          <header className="h-16 flex items-center justify-between px-6 border-b border-white/[0.05] bg-[#02040a]/50 backdrop-blur-xl sticky top-0 z-30">
            <div className="flex items-center gap-4">
              <SidebarTrigger className="text-white/20 hover:text-white transition-colors" />
              <div className="h-4 w-px bg-white/5 hidden sm:block" />
              <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/5 border border-blue-500/10">
                <div className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-blue-400/80">System Operational</span>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.02] border border-white/[0.05]">
                <Zap className="h-3.5 w-3.5 text-amber-400/60" />
                <span className="text-xs font-bold text-white/60">{subscription?.credits?.toLocaleString() ?? 0}</span>
                <span className="text-[9px] font-black text-white/20 uppercase tracking-widest">Credits</span>
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                className="text-white/20 hover:text-white hover:bg-white/5 h-9 w-9"
              >
                {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                className="text-white/20 hover:text-white hover:bg-white/5 h-9 w-9 relative"
              >
                <Bell className="h-4 w-4" />
                <span className="absolute top-2.5 right-2.5 h-1.5 w-1.5 bg-blue-600 rounded-full" />
              </Button>
            </div>
          </header>

          <main className="flex-1 overflow-y-auto custom-scrollbar">
            {children}
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
