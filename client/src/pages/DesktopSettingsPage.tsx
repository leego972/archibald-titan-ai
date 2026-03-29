/**
 * Desktop Settings Page
 * Complete settings hub for the Archibald Titan Electron desktop app.
 * Accessible at /desktop-settings (only shown in desktop mode).
 */
import { useState, useEffect } from "react";
import { isDesktop } from "@/lib/desktop";
import { useLocation } from "wouter";
import {
  Monitor,
  Wifi,
  WifiOff,
  RefreshCw,
  Download,
  CheckCircle2,
  AlertCircle,
  Loader2,
  CloudDownload,
  FolderOpen,
  Info,
  Shield,
  Zap,
  Globe,
  Settings,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import type { UpdateStatus } from "@/lib/desktop";

type SyncStatus = {
  status: "idle" | "checking" | "downloading" | "installing" | "synced" | "up-to-date" | "error" | "unknown";
  version?: string | null;
  lastCheck?: string | null;
  error?: string | null;
};

export default function DesktopSettingsPage() {
  const [, setLocation] = useLocation();

  // Redirect to dashboard if not in desktop mode
  useEffect(() => {
    if (!isDesktop()) {
      setLocation("/dashboard");
    }
  }, [setLocation]);

  const [mode, setMode] = useState<"online" | "offline">("online");
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({ status: "idle" });
  const [dataDir, setDataDir] = useState<string | null>(null);
  const [remoteUrl, setRemoteUrl] = useState<string | null>(null);
  const [platform, setPlatform] = useState<string | null>(null);
  const [version, setVersion] = useState<string | null>(null);

  useEffect(() => {
    if (!isDesktop()) return;

    // Load all desktop info
    window.titanDesktop?.getMode().then(setMode);
    window.titanDesktop?.getDataDir().then(setDataDir);
    window.titanDesktop?.getRemoteUrl().then(setRemoteUrl);
    window.titanDesktop?.getSyncStatus?.().then((s) => {
      if (s) setSyncStatus(s as SyncStatus);
    });
    setPlatform(window.titanDesktop?.platform ?? null);
    setVersion(window.titanDesktop?.version ?? null);

    // Listen for mode changes
    const cleanupMode = window.titanDesktop?.onModeChange((m) => {
      setMode(m as "online" | "offline");
    });

    // Listen for update status
    const cleanupUpdate = window.titanDesktop?.onUpdateStatus((status) => {
      setUpdateStatus(status);
    });

    // Listen for bundle sync
    const cleanupSync = window.titanDesktop?.onBundleSynced?.((manifest) => {
      setSyncStatus({ status: "synced", version: manifest.version, lastCheck: new Date().toISOString(), error: null });
    });

    return () => {
      cleanupMode?.();
      cleanupUpdate?.();
      cleanupSync?.();
    };
  }, []);

  const handleToggleMode = async () => {
    const newMode = mode === "online" ? "offline" : "online";
    await window.titanDesktop?.setMode(newMode);
    setMode(newMode);
    toast.success(`Switched to ${newMode} mode`);
  };

  const handleCheckUpdates = () => {
    window.titanDesktop?.checkForUpdates();
    setUpdateStatus({ status: "checking" });
    toast.info("Checking for updates...");
  };

  const handleDownloadUpdate = () => {
    window.titanDesktop?.downloadUpdate();
  };

  const handleInstallUpdate = () => {
    window.titanDesktop?.installUpdate();
  };

  const handleSyncNow = () => {
    window.titanDesktop?.checkBundleSync?.();
    setSyncStatus((prev) => ({ ...prev, status: "checking" }));
    toast.info("Checking for new version...");
  };

  const handleOpenDataDir = () => {
    if (dataDir) {
      window.titanDesktop?.openExternal?.(`file://${dataDir}`);
    }
  };

  const handleOpenWebApp = () => {
    if (remoteUrl) {
      window.titanDesktop?.openExternal?.(remoteUrl);
    }
  };

  if (!isDesktop()) return null;

  const platformLabel = platform === "darwin" ? "macOS" : platform === "win32" ? "Windows" : platform === "linux" ? "Linux" : platform ?? "Desktop";

  return (
    <div className="max-w-2xl mx-auto py-8 px-4 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="h-12 w-12 rounded-xl bg-blue-500/15 flex items-center justify-center">
          <Monitor className="h-6 w-6 text-blue-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Desktop Settings</h1>
          <p className="text-sm text-muted-foreground">
            Archibald Titan Desktop — {platformLabel}
            {version && <span className="ml-2 text-muted-foreground/60">v{version}</span>}
          </p>
        </div>
      </div>

      {/* Connection Mode */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            {mode === "online" ? <Wifi className="h-4 w-4 text-emerald-400" /> : <WifiOff className="h-4 w-4 text-amber-400" />}
            Connection Mode
          </CardTitle>
          <CardDescription>
            Control whether the app connects to the Archibald Titan servers or runs in local-only mode.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-card/50">
            <div>
              <p className="text-sm font-medium">
                {mode === "online" ? "Online Mode" : "Offline Mode"}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {mode === "online"
                  ? "All features are available. App communicates with remote servers."
                  : "Limited to local features: credentials, projects, and chat history."}
              </p>
            </div>
            <Button
              variant={mode === "online" ? "outline" : "default"}
              size="sm"
              onClick={handleToggleMode}
              className={mode === "offline" ? "bg-amber-600 hover:bg-amber-500 text-white border-0" : ""}
            >
              {mode === "online" ? (
                <><WifiOff className="h-3.5 w-3.5 mr-1.5" /> Go Offline</>
              ) : (
                <><Wifi className="h-3.5 w-3.5 mr-1.5" /> Go Online</>
              )}
            </Button>
          </div>

          {mode === "offline" && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/8 border border-amber-500/20 text-xs text-amber-300">
              <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>
                In offline mode, AI features, advertising, affiliate, marketing, SEO, and all other cloud-based features are unavailable.
                Only credentials, projects, and chat history are accessible locally.
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* App Updates */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="h-4 w-4 text-blue-400" />
            App Updates
          </CardTitle>
          <CardDescription>
            Full Electron binary updates — includes new features, security patches, and performance improvements.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-sm">
              {!updateStatus && <span className="text-muted-foreground">Status unknown — click to check</span>}
              {updateStatus?.status === "checking" && (
                <span className="flex items-center gap-1.5 text-blue-400">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking for updates...
                </span>
              )}
              {updateStatus?.status === "up-to-date" && (
                <span className="flex items-center gap-1.5 text-emerald-400">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Up to date {updateStatus.version && `(v${updateStatus.version})`}
                </span>
              )}
              {updateStatus?.status === "available" && (
                <span className="flex items-center gap-1.5 text-blue-400">
                  <Download className="h-3.5 w-3.5" /> v{updateStatus.version} available
                </span>
              )}
              {updateStatus?.status === "downloading" && (
                <span className="flex items-center gap-1.5 text-blue-400">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Downloading {updateStatus.percent?.toFixed(0)}%
                  {updateStatus.total && ` (${(updateStatus.total / 1024 / 1024).toFixed(0)} MB)`}
                </span>
              )}
              {updateStatus?.status === "downloaded" && (
                <span className="flex items-center gap-1.5 text-emerald-400">
                  <CheckCircle2 className="h-3.5 w-3.5" /> v{updateStatus.version} ready to install
                </span>
              )}
              {updateStatus?.status === "error" && (
                <span className="flex items-center gap-1.5 text-red-400">
                  <AlertCircle className="h-3.5 w-3.5" /> Update error
                  {updateStatus.message && <span className="text-xs text-muted-foreground ml-1">— {updateStatus.message}</span>}
                </span>
              )}
            </div>
            <div className="flex gap-2">
              {updateStatus?.status === "available" && (
                <Button size="sm" onClick={handleDownloadUpdate}>
                  <Download className="h-3.5 w-3.5 mr-1.5" /> Download
                </Button>
              )}
              {updateStatus?.status === "downloaded" && (
                <Button size="sm" onClick={handleInstallUpdate} className="bg-emerald-600 hover:bg-emerald-500">
                  <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Restart & Install
                </Button>
              )}
              {(!updateStatus || updateStatus.status === "up-to-date" || updateStatus.status === "error") && (
                <Button size="sm" variant="outline" onClick={handleCheckUpdates}>
                  <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Check Now
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bundle Sync */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <CloudDownload className="h-4 w-4 text-cyan-400" />
            UI Bundle Sync
          </CardTitle>
          <CardDescription>
            The app UI is synced from the server automatically. This keeps your interface up to date without requiring a full app reinstall.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-sm">
              {syncStatus.status === "idle" || syncStatus.status === "unknown" ? (
                <span className="text-muted-foreground">Not checked yet</span>
              ) : syncStatus.status === "checking" ? (
                <span className="flex items-center gap-1.5 text-blue-400">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking...
                </span>
              ) : syncStatus.status === "downloading" ? (
                <span className="flex items-center gap-1.5 text-blue-400">
                  <CloudDownload className="h-3.5 w-3.5 animate-pulse" /> Downloading v{syncStatus.version}...
                </span>
              ) : syncStatus.status === "installing" ? (
                <span className="flex items-center gap-1.5 text-amber-400">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Installing...
                </span>
              ) : syncStatus.status === "synced" ? (
                <span className="flex items-center gap-1.5 text-emerald-400">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Synced to v{syncStatus.version}
                </span>
              ) : syncStatus.status === "up-to-date" ? (
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Bundle up to date
                  {syncStatus.version && <span className="text-xs ml-1">(v{syncStatus.version})</span>}
                </span>
              ) : syncStatus.status === "error" ? (
                <span className="flex items-center gap-1.5 text-red-400">
                  <AlertCircle className="h-3.5 w-3.5" /> Sync error
                  {syncStatus.error && <span className="text-xs text-muted-foreground ml-1">— {syncStatus.error}</span>}
                </span>
              ) : null}
              {syncStatus.lastCheck && (
                <p className="text-xs text-muted-foreground mt-1">
                  Last checked: {new Date(syncStatus.lastCheck).toLocaleString()}
                </p>
              )}
            </div>
            <Button size="sm" variant="outline" onClick={handleSyncNow}>
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Sync Now
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Data & Storage */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FolderOpen className="h-4 w-4 text-purple-400" />
            Local Data
          </CardTitle>
          <CardDescription>
            Local credentials, projects, and chat history are stored on your device.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {dataDir && (
            <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-card/50">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-0.5">Data Directory</p>
                <p className="text-sm font-mono text-muted-foreground truncate max-w-xs">{dataDir}</p>
              </div>
              <Button size="sm" variant="ghost" onClick={handleOpenDataDir} title="Open in file manager">
                <ExternalLink className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
          <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-500/8 border border-blue-500/20 text-xs text-blue-300">
            <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>
              Credentials and projects stored locally are synced to the server when you are online.
              Your data is encrypted at rest.
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Remote Server */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Globe className="h-4 w-4 text-green-400" />
            Remote Server
          </CardTitle>
          <CardDescription>
            The Archibald Titan cloud server that powers AI, features, and sync.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {remoteUrl && (
            <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-card/50">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-0.5">Server URL</p>
                <p className="text-sm font-mono text-muted-foreground">{remoteUrl}</p>
              </div>
              <Button size="sm" variant="ghost" onClick={handleOpenWebApp} title="Open web app">
                <ExternalLink className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Security */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-4 w-4 text-red-400" />
            Security
          </CardTitle>
          <CardDescription>
            Desktop app security settings and information.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between py-2">
              <span className="text-muted-foreground">Context isolation</span>
              <Badge variant="outline" className="text-emerald-400 border-emerald-500/30 text-xs">Enabled</Badge>
            </div>
            <Separator />
            <div className="flex items-center justify-between py-2">
              <span className="text-muted-foreground">Node integration</span>
              <Badge variant="outline" className="text-emerald-400 border-emerald-500/30 text-xs">Disabled</Badge>
            </div>
            <Separator />
            <div className="flex items-center justify-between py-2">
              <span className="text-muted-foreground">Sandbox mode</span>
              <Badge variant="outline" className="text-emerald-400 border-emerald-500/30 text-xs">Enabled</Badge>
            </div>
            <Separator />
            <div className="flex items-center justify-between py-2">
              <span className="text-muted-foreground">Deep link protocol</span>
              <Badge variant="outline" className="text-blue-400 border-blue-500/30 text-xs">titandesktop://</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* About */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Info className="h-4 w-4 text-muted-foreground" />
            About
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between py-1.5">
              <span className="text-muted-foreground">App version</span>
              <span className="font-mono">{version ?? "—"}</span>
            </div>
            <Separator />
            <div className="flex items-center justify-between py-1.5">
              <span className="text-muted-foreground">Platform</span>
              <span>{platformLabel}</span>
            </div>
            <Separator />
            <div className="flex items-center justify-between py-1.5">
              <span className="text-muted-foreground">Built with</span>
              <span className="text-muted-foreground">Electron + React + tRPC</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick links */}
      <div className="flex gap-3">
        <Button variant="outline" size="sm" className="flex-1" onClick={() => setLocation("/fetcher/download-app")}>
          <Download className="h-3.5 w-3.5 mr-1.5" /> Download Page
        </Button>
        <Button variant="outline" size="sm" className="flex-1" onClick={() => setLocation("/fetcher/settings")}>
          <Settings className="h-3.5 w-3.5 mr-1.5" /> App Settings
        </Button>
        <Button variant="outline" size="sm" className="flex-1" onClick={() => setLocation("/dashboard")}>
          <ChevronRight className="h-3.5 w-3.5 mr-1.5" /> Dashboard
        </Button>
      </div>
    </div>
  );
}
