// @ts-nocheck — Electron preload has its own build pipeline
import { contextBridge, ipcRenderer } from "electron";

/**
 * Exposes the full titanDesktop IPC bridge to the renderer process.
 * This must stay in sync with electron/preload.js (the compiled version used in production).
 * All methods here map 1-to-1 to ipcMain.handle() registrations in electron/main.js.
 */
contextBridge.exposeInMainWorld("titanDesktop", {
  isDesktop: true,
  platform: process.platform,
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  version: require("./package.json").version,

  // ── Data / port / remote URL ──────────────────────────────────────
  getDataDir: () => ipcRenderer.invoke("get-data-dir"),
  getPort: () => ipcRenderer.invoke("get-port"),
  getRemoteUrl: () => ipcRenderer.invoke("get-remote-url"),

  // ── Navigation ────────────────────────────────────────────────────
  navigateTo: (path) => ipcRenderer.invoke("navigate-to", path),

  // ── Online / Offline mode ─────────────────────────────────────────
  getMode: () => ipcRenderer.invoke("get-mode"),
  setMode: (mode) => ipcRenderer.invoke("set-mode", mode),
  isOffline: () => ipcRenderer.invoke("get-mode").then((m) => m === "offline"),
  onModeChange: (callback) => {
    ipcRenderer.on("mode-changed", (_event, mode) => callback(mode));
    return () => ipcRenderer.removeAllListeners("mode-changed");
  },

  // ── Bundle sync ───────────────────────────────────────────────────
  checkBundleSync: () => ipcRenderer.invoke("check-bundle-sync"),
  getSyncStatus: () => ipcRenderer.invoke("get-sync-status"),
  onBundleSynced: (callback) => {
    ipcRenderer.on("bundle-synced", (_event, manifest) => callback(manifest));
    return () => ipcRenderer.removeAllListeners("bundle-synced");
  },

  // ── Auto-updater ──────────────────────────────────────────────────
  checkForUpdates: () => ipcRenderer.invoke("check-for-updates"),
  downloadUpdate: () => ipcRenderer.invoke("download-update"),
  installUpdate: () => ipcRenderer.invoke("install-update"),
  onUpdateStatus: (callback) => {
    ipcRenderer.on("update-status", (_event, status) => callback(status));
    return () => ipcRenderer.removeAllListeners("update-status");
  },

  // ── System ────────────────────────────────────────────────────────
  openExternal: (url) => ipcRenderer.invoke("open-external", url),
  showSaveDialog: (options) => ipcRenderer.invoke("show-save-dialog", options),
  showMessageBox: (options) => ipcRenderer.invoke("show-message-box", options),
});
