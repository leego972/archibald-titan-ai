/**
 * Ad Tracking Module — Google Ads, TikTok Pixel, Snapchat Pixel
 *
 * Loads tracking pixels and provides conversion event helpers.
 * Pixel IDs are injected via VITE_ env vars so they can be changed
 * without a code deploy.
 *
 * Usage:
 *   import { initAdTracking, trackSignup, trackPurchase } from "@/lib/adTracking";
 *   initAdTracking();                       // call once on app mount
 *   trackSignup();                          // on registration success
 *   trackPurchase({ value: 29, currency: "USD" }); // on checkout complete
 */

/* ---------- type stubs for global pixel functions ---------- */
declare global {
  interface Window {
    dataLayer: unknown[];
    gtag: (...args: unknown[]) => void;
    ttq: {
      load: (id: string) => void;
      page: () => void;
      track: (event: string, data?: Record<string, unknown>) => void;
      identify: (data: Record<string, unknown>) => void;
    };
    snaptr: (...args: unknown[]) => void;
  }
}

/* ---------- env var helpers ---------- */
const GOOGLE_ADS_ID = import.meta.env.VITE_GOOGLE_ADS_ID as string | undefined;
const GOOGLE_ADS_SIGNUP_LABEL = import.meta.env.VITE_GOOGLE_ADS_SIGNUP_LABEL as string | undefined;
const GOOGLE_ADS_PURCHASE_LABEL = import.meta.env.VITE_GOOGLE_ADS_PURCHASE_LABEL as string | undefined;
const TIKTOK_PIXEL_ID = import.meta.env.VITE_TIKTOK_PIXEL_ID as string | undefined;
const SNAP_PIXEL_ID = import.meta.env.VITE_SNAP_PIXEL_ID as string | undefined;

/* ---------- script loader ---------- */
function loadScript(src: string, id: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.getElementById(id)) {
      resolve();
      return;
    }
    const s = document.createElement("script");
    s.id = id;
    s.src = src;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(s);
  });
}

/* ---------- Google Ads (gtag.js) ---------- */
async function initGoogleAds() {
  if (!GOOGLE_ADS_ID) return;
  try {
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () {
      // eslint-disable-next-line prefer-rest-params
      window.dataLayer.push(arguments);
    };
    window.gtag("js", new Date());
    window.gtag("config", GOOGLE_ADS_ID, { send_page_view: true });
    await loadScript(
      `https://www.googletagmanager.com/gtag/js?id=${GOOGLE_ADS_ID}`,
      "gtag-js"
    );
    console.log("[AdTracking] Google Ads initialized:", GOOGLE_ADS_ID);
  } catch (e) {
    console.warn("[AdTracking] Google Ads failed to load", e);
  }
}

/* ---------- TikTok Pixel ---------- */
function initTikTokPixel() {
  if (!TIKTOK_PIXEL_ID) return;
  try {
    // TikTok pixel inline bootstrap (official snippet)
    const w = window as Window;
    if (!w.ttq) {
      const ttq: unknown[] = [];
      (ttq as unknown as Record<string, unknown>).methods = [
        "page", "track", "identify", "instances", "debug", "on", "off",
        "once", "ready", "alias", "group", "enableCookie", "disableCookie",
      ];
      (ttq as unknown as Record<string, unknown>).setAndDefer = function (
        t: Record<string, (...args: unknown[]) => void>,
        e: string
      ) {
        t[e] = function () {
          // eslint-disable-next-line prefer-rest-params
          t.push([e].concat(Array.prototype.slice.call(arguments)));
        };
      };
      const methods = (ttq as unknown as Record<string, string[]>).methods;
      for (let i = 0; i < methods.length; i++) {
        (ttq as unknown as Record<string, (t: unknown, e: string) => void>)
          .setAndDefer(ttq as unknown as Record<string, (...args: unknown[]) => void>, methods[i]);
      }
      w.ttq = ttq as unknown as typeof w.ttq;
    }
    w.ttq.load(TIKTOK_PIXEL_ID);
    w.ttq.page();
    loadScript(
      "https://analytics.tiktok.com/i18n/pixel/events.js",
      "ttq-js"
    );
    console.log("[AdTracking] TikTok Pixel initialized:", TIKTOK_PIXEL_ID);
  } catch (e) {
    console.warn("[AdTracking] TikTok Pixel failed to load", e);
  }
}

/* ---------- Snapchat Pixel ---------- */
function initSnapPixel() {
  if (!SNAP_PIXEL_ID) return;
  try {
    // Snapchat pixel inline bootstrap (official snippet)
    const w = window as Window;
    if (!w.snaptr) {
      const tr = function () {
        // eslint-disable-next-line prefer-rest-params
        (tr as unknown as { queue: unknown[] }).queue.push(
          Array.prototype.slice.call(arguments)
        );
      };
      (tr as unknown as { queue: unknown[] }).queue = [];
      w.snaptr = tr as typeof w.snaptr;
    }
    w.snaptr("init", SNAP_PIXEL_ID, {});
    w.snaptr("track", "PAGE_VIEW");
    loadScript(
      "https://sc-static.net/scevent.min.js",
      "snap-pixel-js"
    );
    console.log("[AdTracking] Snapchat Pixel initialized:", SNAP_PIXEL_ID);
  } catch (e) {
    console.warn("[AdTracking] Snapchat Pixel failed to load", e);
  }
}

/* ========== PUBLIC API ========== */

/** Call once on app mount (e.g., in main.tsx or App.tsx useEffect) */
export function initAdTracking() {
  initGoogleAds();
  initTikTokPixel();
  initSnapPixel();
}

/** Track a successful signup / registration */
export function trackSignup(email?: string) {
  // Google Ads conversion
  if (GOOGLE_ADS_ID && GOOGLE_ADS_SIGNUP_LABEL && window.gtag) {
    window.gtag("event", "conversion", {
      send_to: `${GOOGLE_ADS_ID}/${GOOGLE_ADS_SIGNUP_LABEL}`,
    });
  }

  // TikTok
  if (window.ttq) {
    window.ttq.track("CompleteRegistration", {
      content_name: "Archibald Titan Signup",
    });
    if (email) window.ttq.identify({ email });
  }

  // Snapchat
  if (window.snaptr) {
    window.snaptr("track", "SIGN_UP", {
      sign_up_method: "email",
    });
  }

  console.log("[AdTracking] Signup tracked");
}

/** Track a successful purchase / subscription */
export function trackPurchase(opts: {
  value: number;
  currency?: string;
  planName?: string;
}) {
  const { value, currency = "USD", planName = "Pro" } = opts;

  // Google Ads conversion
  if (GOOGLE_ADS_ID && GOOGLE_ADS_PURCHASE_LABEL && window.gtag) {
    window.gtag("event", "conversion", {
      send_to: `${GOOGLE_ADS_ID}/${GOOGLE_ADS_PURCHASE_LABEL}`,
      value,
      currency,
    });
  }

  // TikTok
  if (window.ttq) {
    window.ttq.track("CompletePayment", {
      content_name: planName,
      value,
      currency,
    });
  }

  // Snapchat
  if (window.snaptr) {
    window.snaptr("track", "PURCHASE", {
      price: value,
      currency,
      item_category: planName,
    });
  }

  console.log("[AdTracking] Purchase tracked:", { value, currency, planName });
}

/** Track a page view (call on route change if needed) */
export function trackPageView(url?: string) {
  // Google Ads — automatic with config send_page_view
  if (GOOGLE_ADS_ID && window.gtag) {
    window.gtag("event", "page_view", { page_location: url || window.location.href });
  }

  // TikTok
  if (window.ttq) {
    window.ttq.page();
  }

  // Snapchat
  if (window.snaptr) {
    window.snaptr("track", "PAGE_VIEW");
  }
}

/** Track a content view (e.g., pricing page, feature page) */
export function trackViewContent(contentName: string) {
  if (window.ttq) {
    window.ttq.track("ViewContent", { content_name: contentName });
  }
  if (window.snaptr) {
    window.snaptr("track", "VIEW_CONTENT", { item_category: contentName });
  }
}

/** Track download initiation */
export function trackDownload(platform: string) {
  if (window.gtag && GOOGLE_ADS_ID) {
    window.gtag("event", "download", { platform });
  }
  if (window.ttq) {
    window.ttq.track("Download", { content_name: `Titan ${platform}` });
  }
  if (window.snaptr) {
    window.snaptr("track", "ADD_TO_CART", { item_category: platform });
  }
  console.log("[AdTracking] Download tracked:", platform);
}
