import { useState, useEffect } from "react";
import { isDesktop } from "@/lib/desktop";
import { WifiOff, Wifi } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DesktopOfflineBannerProps {
  featureName: string;
  /** Optional: list of things that ARE available offline */
  offlineCapabilities?: string[];
}

/**
 * Shows a banner when the desktop app is in offline mode, explaining that
 * the current feature requires an internet connection.
 * Returns null when not in desktop mode or when online.
 */
export default function DesktopOfflineBanner({ featureName, offlineCapabilities }: DesktopOfflineBannerProps) {
  const [isOffline, setIsOffline] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!isDesktop()) return;

    const checkMode = async () => {
      try {
        const mode = await window.titanDesktop?.getMode();
        const offline = mode === "offline";
        setIsOffline(offline);
        setVisible(true);
      } catch {
        setVisible(false);
      }
    };

    checkMode();

    // Listen for mode changes
    const cleanup = window.titanDesktop?.onModeChange((mode) => {
      setIsOffline(mode === "offline");
    });

    return () => cleanup?.();
  }, []);

  if (!visible || !isOffline) return null;

  const handleGoOnline = async () => {
    await window.titanDesktop?.setMode("online");
    setIsOffline(false);
    window.location.reload();
  };

  return (
    <div className="flex items-start gap-3 p-4 mb-6 rounded-lg border border-amber-500/30 bg-amber-500/5">
      <WifiOff className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-amber-300">
          {featureName} is unavailable in offline mode
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          This feature requires an active internet connection to communicate with the Archibald Titan servers.
          {offlineCapabilities && offlineCapabilities.length > 0 && (
            <> Available offline: {offlineCapabilities.join(", ")}.</>
          )}
        </p>
      </div>
      <Button
        size="sm"
        variant="outline"
        className="shrink-0 border-amber-500/30 text-amber-300 hover:bg-amber-500/10 hover:text-amber-200"
        onClick={handleGoOnline}
      >
        <Wifi className="w-3.5 h-3.5 mr-1.5" />
        Go Online
      </Button>
    </div>
  );
}
