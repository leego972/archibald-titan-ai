import { useState, useEffect } from "react";
import { isDesktop, type UpdateStatus } from "@/lib/desktop";
import {
  Download,
  RefreshCw,
  Wifi,
  WifiOff,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Monitor,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export default function DesktopStatusBar() {
  const [mode, setMode] = useState<"online" | "offline">("online");
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!isDesktop()) return;
    setVisible(true);

    // Get initial mode
    window.titanDesktop?.getMode().then((m) => setMode(m));

    // Listen for mode changes
    const cleanupMode = window.titanDesktop?.onModeChange((m) => {
      setMode(m as "online" | "offline");
      toast.info(`Switched to ${m} mode`);
    });

    // Listen for update status
    const cleanupUpdate = window.titanDesktop?.onUpdateStatus((status) => {
      setUpdateStatus(status);
    });

    return () => {
      cleanupMode?.();
      cleanupUpdate?.();
    };
  }, []);

  if (!visible) return null;

  const handleToggleMode = async () => {
    const newMode = mode === "online" ? "offline" : "online";
    await window.titanDesktop?.setMode(newMode);
    setMode(newMode);
  };

  const handleCheckUpdates = () => {
    window.titanDesktop?.checkForUpdates();
    toast.info("Checking for updates...");
  };

  const handleDownloadUpdate = () => {
    window.titanDesktop?.downloadUpdate();
  };

  const handleInstallUpdate = () => {
    window.titanDesktop?.installUpdate();
  };

  const version = window.titanDesktop?.version;

  return (
    <div className="flex items-center gap-3 px-4 py-1.5 bg-background/60 border-b border-border/30 text-xs text-muted-foreground">
      {/* Desktop indicator */}
      <div className="flex items-center gap-1.5">
        <Monitor className="w-3 h-3" />
        <span className="font-medium">Desktop</span>
        {version && <span className="opacity-60">v{version}</span>}
      </div>

      <div className="w-px h-3 bg-border/50" />

      {/* Online/Offline mode toggle */}
      <button
        onClick={handleToggleMode}
        className="flex items-center gap-1.5 px-2 py-0.5 rounded hover:bg-accent/50 transition-colors"
        title={`Currently ${mode}. Click to switch.`}
      >
        {mode === "online" ? (
          <>
            <Wifi className="w-3 h-3 text-emerald-400" />
            <span className="text-emerald-400">Online</span>
          </>
        ) : (
          <>
            <WifiOff className="w-3 h-3 text-amber-400" />
            <span className="text-amber-400">Offline</span>
          </>
        )}
      </button>

      <div className="flex-1" />

      {/* Update status */}
      {updateStatus?.status === "available" && (
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[10px] border-blue-500/30 text-blue-400">
            v{updateStatus.version} available
          </Badge>
          <Button
            size="sm"
            variant="ghost"
            className="h-5 px-2 text-[10px] text-blue-400 hover:text-blue-300"
            onClick={handleDownloadUpdate}
          >
            <Download className="w-3 h-3 mr-1" /> Download
          </Button>
        </div>
      )}

      {updateStatus?.status === "downloading" && (
        <div className="flex items-center gap-2">
          <Loader2 className="w-3 h-3 animate-spin text-blue-400" />
          <span className="text-blue-400">
            Downloading {updateStatus.percent?.toFixed(0)}%
          </span>
        </div>
      )}

      {updateStatus?.status === "downloaded" && (
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-400">
            <CheckCircle2 className="w-3 h-3 mr-1" /> Ready to install
          </Badge>
          <Button
            size="sm"
            variant="ghost"
            className="h-5 px-2 text-[10px] text-emerald-400 hover:text-emerald-300"
            onClick={handleInstallUpdate}
          >
            <RefreshCw className="w-3 h-3 mr-1" /> Restart
          </Button>
        </div>
      )}

      {updateStatus?.status === "error" && (
        <div className="flex items-center gap-1.5 text-red-400">
          <AlertCircle className="w-3 h-3" />
          <span>Update error</span>
        </div>
      )}

      {updateStatus?.status === "up-to-date" && (
        <div className="flex items-center gap-1.5 text-muted-foreground/60">
          <CheckCircle2 className="w-3 h-3" />
          <span>Up to date</span>
        </div>
      )}

      {!updateStatus && (
        <button
          onClick={handleCheckUpdates}
          className="flex items-center gap-1 px-2 py-0.5 rounded hover:bg-accent/50 transition-colors"
          title="Check for updates"
        >
          <RefreshCw className="w-3 h-3" />
          <span>Check updates</span>
        </button>
      )}
    </div>
  );
}
