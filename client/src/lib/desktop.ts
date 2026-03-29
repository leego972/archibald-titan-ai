declare global {
  interface Window {
    titanDesktop?: {
      isDesktop: boolean;
      platform: string;
      version: string;
      getDataDir: () => Promise<string>;
      getPort: () => Promise<number>;
      getRemoteUrl: () => Promise<string>;
      navigateTo: (path: string) => Promise<void>;
      openExternal: (url: string) => Promise<void>;
      // Online/Offline mode
      getMode: () => Promise<"online" | "offline">;
      setMode: (mode: "online" | "offline") => Promise<string>;
      isOffline: () => Promise<boolean>;
      onModeChange: (callback: (mode: string) => void) => () => void;
      // Bundle sync
      checkBundleSync: () => Promise<{ checking: boolean }>;
      getSyncStatus: () => Promise<{ status: string; version?: string | null; lastCheck?: string | null; error?: string | null }>;
      onBundleSynced: (callback: (manifest: { version: string; hash: string }) => void) => () => void;
      // Auto-updater
      checkForUpdates: () => Promise<{ checking: boolean }>;
      downloadUpdate: () => Promise<{ downloading: boolean }>;
      installUpdate: () => Promise<void>;
      onUpdateStatus: (callback: (status: UpdateStatus) => void) => () => void;
      // Native dialogs
      showSaveDialog: (options: Record<string, unknown>) => Promise<{ canceled: boolean; filePath?: string }>;
      showMessageBox: (options: Record<string, unknown>) => Promise<{ response: number }>;
    };
  }
}

export interface UpdateStatus {
  status: "checking" | "available" | "up-to-date" | "downloading" | "downloaded" | "error";
  version?: string;
  percent?: number;
  bytesPerSecond?: number;
  transferred?: number;
  total?: number;
  message?: string;
  releaseNotes?: string;
  releaseName?: string;
  releaseDate?: string;
}

export function isDesktop(): boolean {
  return !!(typeof window !== "undefined" && window.titanDesktop?.isDesktop);
}

export function getDesktopInfo() {
  return window.titanDesktop || null;
}

export function getDesktopVersion(): string | null {
  return window.titanDesktop?.version || null;
}

export function getDesktopPlatform(): string | null {
  return window.titanDesktop?.platform || null;
}

/** Returns true if running in the Electron desktop app AND offline mode is active */
export async function isDesktopOffline(): Promise<boolean> {
  if (!isDesktop()) return false;
  try {
    return await window.titanDesktop!.isOffline();
  } catch {
    return false;
  }
}

/** Open a URL in the user's default system browser (desktop only, falls back to window.open) */
export function openExternalUrl(url: string): void {
  if (isDesktop() && window.titanDesktop?.openExternal) {
    window.titanDesktop.openExternal(url);
  } else {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}
