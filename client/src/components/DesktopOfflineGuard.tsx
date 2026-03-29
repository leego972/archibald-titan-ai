import { useState, useEffect } from "react";
import { isDesktop } from "@/lib/desktop";
import { useLocation } from "wouter";
import { WifiOff, Wifi } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Global offline banner that appears below the TrialBanner when the desktop
 * app is in offline mode AND the current page is a feature that requires
 * an internet connection.
 *
 * Pages that work offline (credentials, projects, chat, settings) are excluded.
 */

const OFFLINE_CAPABLE_PATHS = [
  "/dashboard",
  "/fetcher/credentials",
  "/fetcher/settings",
  "/fetcher/team",
  "/fetcher/api-access",
  "/desktop-settings",
  "/desktop-login",
  "/desktop-billing-callback",
];

const FEATURE_NAMES: Record<string, string> = {
  "/advertising": "Advertising Engine",
  "/affiliate": "Affiliate Engine",
  "/marketing": "Marketing Engine",
  "/content-creator": "Content Creator",
  "/grants": "Grant Finder",
  "/grant-applications": "Grant Applications",
  "/companies": "Companies",
  "/business-plans": "Business Plans",
  "/crowdfunding": "Crowdfunding",
  "/site-monitor": "Site Monitor",
  "/seo": "SEO Engine",
  "/storage": "Titan Storage",
  "/marketplace": "Marketplace",
  "/security": "Security Dashboard",
  "/vpn-chain": "VPN Chain",
  "/proxy-maker": "Proxy Maker",
  "/proxy-rotation": "Proxy Rotation",
  "/ip-rotation": "IP Rotation",
  "/tor": "Tor Browser",
  "/isolated-browser": "Isolated Browser",
  "/master-growth": "Master Growth",
  "/blog-admin": "Blog Engine",
  "/replicate": "Clone Website",
  "/sandbox": "Sandbox",
  "/fetcher/smart-fetch": "Smart Fetch",
  "/fetcher/new": "New Fetch",
  "/fetcher/jobs": "Fetch Jobs",
  "/fetcher/totp-vault": "TOTP Vault",
  "/fetcher/watchdog": "Expiry Watchdog",
  "/fetcher/provider-health": "Provider Health",
  "/fetcher/health-trends": "Health Trends",
  "/fetcher/leak-scanner": "Leak Scanner",
  "/fetcher/credential-health": "Credential Health",
  "/linken-sphere": "Linken Sphere",
  "/cybermcp": "Cyber MCP",
  "/astra": "Astra Scanner",
  "/argus": "Argus OSINT",
  "/evilginx": "Evilginx 3",
  "/blackeye": "BlackEye",
  "/metasploit": "Metasploit",
  "/exploitpack": "Exploit Pack",
  "/bin-checker": "BIN Checker",
  "/web-agent": "Web Agent",
  "/referrals": "Referrals",
  "/project-files": "Project Files",
  "/attack-graph": "Attack Graph",
  "/proxy-interceptor": "Proxy Interceptor",
  "/red-team-playbooks": "Red Team Playbooks",
  "/command-centre": "Command Centre",
  "/event-bus": "Event Bus",
  "/compliance-reports": "Compliance Reports",
  "/siem-integration": "SIEM Integration",
  "/security-marketplace": "Security Marketplace",
};

function getFeatureName(path: string): string | null {
  // Exact match first
  if (FEATURE_NAMES[path]) return FEATURE_NAMES[path];
  // Prefix match
  for (const [prefix, name] of Object.entries(FEATURE_NAMES)) {
    if (path.startsWith(prefix)) return name;
  }
  return null;
}

function isOfflineCapable(path: string): boolean {
  return OFFLINE_CAPABLE_PATHS.some(p => path === p || path.startsWith(p));
}

export default function DesktopOfflineGuard() {
  const [isOffline, setIsOffline] = useState(false);
  const [visible, setVisible] = useState(false);
  const [location] = useLocation();

  useEffect(() => {
    if (!isDesktop()) return;

    const checkMode = async () => {
      try {
        const mode = await window.titanDesktop?.getMode();
        setIsOffline(mode === "offline");
        setVisible(true);
      } catch {
        setVisible(false);
      }
    };

    checkMode();

    const cleanup = window.titanDesktop?.onModeChange((mode) => {
      setIsOffline(mode === "offline");
    });

    return () => cleanup?.();
  }, []);

  if (!visible || !isOffline) return null;
  if (isOfflineCapable(location)) return null;

  const featureName = getFeatureName(location);
  if (!featureName) return null;

  const handleGoOnline = async () => {
    await window.titanDesktop?.setMode("online");
    setIsOffline(false);
    window.location.reload();
  };

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 bg-amber-500/8 border-b border-amber-500/20 text-sm">
      <WifiOff className="w-4 h-4 text-amber-400 shrink-0" />
      <div className="flex-1 min-w-0">
        <span className="text-amber-300 font-medium">{featureName}</span>
        <span className="text-muted-foreground ml-2">
          requires an internet connection. Switch to Online mode to use this feature.
        </span>
      </div>
      <Button
        size="sm"
        variant="outline"
        className="shrink-0 h-7 px-3 text-xs border-amber-500/30 text-amber-300 hover:bg-amber-500/10 hover:text-amber-200"
        onClick={handleGoOnline}
      >
        <Wifi className="w-3 h-3 mr-1.5" />
        Go Online
      </Button>
    </div>
  );
}
