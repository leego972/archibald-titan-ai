import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Download,
  Monitor,
  Terminal,
  Smartphone,
  Loader2,
  CheckCircle2,
  Apple,
  Package,
} from "lucide-react";

type Platform = "windows" | "mac" | "linux" | "android";

function detectPlatform(): "windows" | "mac" | "linux" {
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes("mac")) return "mac";
  if (ua.includes("linux") || ua.includes("ubuntu") || ua.includes("debian") || ua.includes("fedora")) return "linux";
  return "windows";
}

const PLATFORM_CONFIG: Record<Platform, { label: string; icon: React.ReactNode; color: string; bg: string; border: string }> = {
  windows: {
    label: "Windows",
    icon: <Monitor className="h-6 w-6" />,
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/20",
  },
  mac: {
    label: "macOS",
    icon: <Apple className="h-6 w-6" />,
    color: "text-slate-300",
    bg: "bg-slate-500/10",
    border: "border-slate-500/20",
  },
  linux: {
    label: "Linux",
    icon: <Terminal className="h-6 w-6" />,
    color: "text-orange-400",
    bg: "bg-orange-500/10",
    border: "border-orange-500/20",
  },
  android: {
    label: "Android",
    icon: <Smartphone className="h-6 w-6" />,
    color: "text-green-400",
    bg: "bg-green-500/10",
    border: "border-green-500/20",
  },
};

export default function DownloadAppPage() {
  const { data: latestRelease, isLoading } = trpc.releases.latest.useQuery();
  const requestDownloadToken = trpc.download.requestToken.useMutation();
  const [downloadPending, setDownloadPending] = useState<Platform | null>(null);
  const [detectedPlatform] = useState<"windows" | "mac" | "linux">(detectPlatform);

  const handleDownload = async (platform: Platform) => {
    if (!latestRelease) {
      toast.error("No release available yet. Check back soon!");
      return;
    }
    const cfg = PLATFORM_CONFIG[platform];
    const hasDownload =
      platform === "windows" ? latestRelease.hasWindows :
      platform === "mac" ? latestRelease.hasMac :
      platform === "android" ? !!(latestRelease as any).hasAndroid :
      latestRelease.hasLinux;

    if (!hasDownload) {
      toast.info(`${cfg.label} build coming soon!`);
      return;
    }
    try {
      setDownloadPending(platform);
      const { token } = await requestDownloadToken.mutateAsync({
        releaseId: latestRelease.id,
        platform,
      });
      window.open(`/api/download/${token}`, "_blank");
      toast.success(`Downloading Titan for ${cfg.label}...`);
    } catch (err: any) {
      toast.error(err?.message ?? "Download failed. Please try again.");
    } finally {
      setDownloadPending(null);
    }
  };

  const platforms: Platform[] = ["windows", "mac", "linux", "android"];

  return (
    <div className="min-h-screen bg-background p-6 md:p-10">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <div className="h-14 w-14 rounded-2xl bg-cyan-500/15 flex items-center justify-center">
            <Download className="h-7 w-7 text-cyan-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Download Titan Desktop</h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              Same features as the web — plus offline mode
              {latestRelease ? ` • v${latestRelease.version}` : ""}
            </p>
          </div>
        </div>

        {/* Recommended platform */}
        <div className="mb-6">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Recommended for your device
          </p>
          <button
            onClick={() => handleDownload(detectedPlatform)}
            disabled={!!downloadPending || isLoading}
            className="w-full flex items-center justify-center gap-3 px-6 py-4 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-semibold text-base transition-all shadow-lg shadow-cyan-500/20"
          >
            {downloadPending === detectedPlatform ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              PLATFORM_CONFIG[detectedPlatform].icon
            )}
            Download for {PLATFORM_CONFIG[detectedPlatform].label}
          </button>
        </div>

        {/* All platforms grid */}
        <div className="mb-8">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            All platforms
          </p>
          <div className="grid grid-cols-2 gap-3">
            {platforms.map((platform) => {
              const cfg = PLATFORM_CONFIG[platform];
              const isRecommended = platform === detectedPlatform;
              const hasDownload =
                platform === "windows" ? latestRelease?.hasWindows :
                platform === "mac" ? latestRelease?.hasMac :
                platform === "android" ? !!(latestRelease as any)?.hasAndroid :
                latestRelease?.hasLinux;

              return (
                <button
                  key={platform}
                  onClick={() => handleDownload(platform)}
                  disabled={!!downloadPending || isLoading}
                  className={`relative flex flex-col items-center gap-3 p-5 rounded-xl border ${cfg.border} ${cfg.bg} hover:brightness-110 disabled:opacity-50 transition-all text-center group`}
                >
                  {isRecommended && (
                    <span className="absolute top-2 right-2 text-[10px] font-semibold bg-cyan-500/20 text-cyan-400 px-1.5 py-0.5 rounded-full">
                      Your device
                    </span>
                  )}
                  <div className={`${cfg.color}`}>
                    {downloadPending === platform ? (
                      <Loader2 className="h-6 w-6 animate-spin" />
                    ) : (
                      cfg.icon
                    )}
                  </div>
                  <div>
                    <p className="font-semibold text-sm">{cfg.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {hasDownload === undefined ? "Loading..." : hasDownload ? "Available" : "Coming soon"}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Release info */}
        {latestRelease && (
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center gap-2 mb-3">
              <Package className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-semibold">Release {latestRelease.version}</p>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <CheckCircle2 className={`h-4 w-4 ${latestRelease.hasWindows ? "text-green-400" : "text-muted-foreground/30"}`} />
                Windows {latestRelease.hasWindows ? (latestRelease.fileSizeMb ? `(${latestRelease.fileSizeMb} MB)` : "") : "(coming soon)"}
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <CheckCircle2 className={`h-4 w-4 ${latestRelease.hasMac ? "text-green-400" : "text-muted-foreground/30"}`} />
                macOS {latestRelease.hasMac ? (latestRelease.fileSizeMb ? `(${latestRelease.fileSizeMb} MB)` : "") : "(coming soon)"}
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <CheckCircle2 className={`h-4 w-4 ${latestRelease.hasLinux ? "text-green-400" : "text-muted-foreground/30"}`} />
                Linux {latestRelease.hasLinux ? (latestRelease.fileSizeMb ? `(${latestRelease.fileSizeMb} MB)` : "") : "(coming soon)"}
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <CheckCircle2 className={`h-4 w-4 ${(latestRelease as any).hasAndroid ? "text-green-400" : "text-muted-foreground/30"}`} />
                Android {(latestRelease as any).hasAndroid ? (latestRelease.fileSizeMb ? `(${latestRelease.fileSizeMb} MB)` : "") : "(coming soon)"}
              </div>
            </div>
            {latestRelease.changelog && (
              <div className="mt-4 pt-4 border-t border-border">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Release Notes</p>
                <p className="text-sm text-muted-foreground whitespace-pre-line">{latestRelease.changelog}</p>
              </div>
            )}
          </div>
        )}

        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>
    </div>
  );
}
