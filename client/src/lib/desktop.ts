declare global {
  interface Window {
    titanDesktop?: {
      isDesktop: boolean;
      platform: string;
      version: string;
      getDataDir: () => Promise<string>;
      getPort: () => Promise<number>;
      getRemoteUrl: () => Promise<string>;
    };
  }
}

export function isDesktop(): boolean {
  return !!(typeof window !== "undefined" && window.titanDesktop?.isDesktop);
}

export function getDesktopInfo() {
  return window.titanDesktop || null;
}
