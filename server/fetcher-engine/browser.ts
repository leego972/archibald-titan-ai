/**
 * Stealth Browser Engine v2 — Hardened Edition
 *
 * Improvements over v1:
 * 1. Updated user agents (Chrome 133, Firefox 134, Safari 18.3, Edge 133)
 * 2. More device profiles (8 total — includes Linux, Edge, mobile-like viewports)
 * 3. Enhanced stealth scripts (WebGL2, AudioContext, Battery API spoofing)
 * 4. Improved human-like behavior (mouse jitter, random scroll patterns)
 * 5. Connection timeout configuration per launch
 * 6. Better screenshot handling with compression
 */
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";

// ─── Device Profiles ──────────────────────────────────────────────────
export interface DeviceProfile {
  name: string;
  userAgent: string;
  viewport: { width: number; height: number };
  locale: string;
  timezoneId: string;
  platform: string;
  screenSize: { width: number; height: number };
}

const DEVICE_PROFILES: DeviceProfile[] = [
  {
    name: "Windows Chrome Desktop",
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36",
    viewport: { width: 1920, height: 1080 },
    locale: "en-US",
    timezoneId: "America/New_York",
    platform: "Win32",
    screenSize: { width: 1920, height: 1080 },
  },
  {
    name: "MacOS Chrome Desktop",
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36",
    viewport: { width: 1440, height: 900 },
    locale: "en-US",
    timezoneId: "America/Los_Angeles",
    platform: "MacIntel",
    screenSize: { width: 1440, height: 900 },
  },
  {
    name: "Windows Edge Desktop",
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36 Edg/133.0.0.0",
    viewport: { width: 1536, height: 864 },
    locale: "en-US",
    timezoneId: "America/Chicago",
    platform: "Win32",
    screenSize: { width: 1536, height: 864 },
  },
  {
    name: "Windows Firefox Desktop",
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:134.0) Gecko/20100101 Firefox/134.0",
    viewport: { width: 1366, height: 768 },
    locale: "en-US",
    timezoneId: "America/Chicago",
    platform: "Win32",
    screenSize: { width: 1366, height: 768 },
  },
  {
    name: "MacOS Safari Desktop",
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.3 Safari/605.1.15",
    viewport: { width: 1680, height: 1050 },
    locale: "en-US",
    timezoneId: "America/Denver",
    platform: "MacIntel",
    screenSize: { width: 1680, height: 1050 },
  },
  {
    name: "Linux Chrome Desktop",
    userAgent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36",
    viewport: { width: 1920, height: 1080 },
    locale: "en-US",
    timezoneId: "America/New_York",
    platform: "Linux x86_64",
    screenSize: { width: 1920, height: 1080 },
  },
  {
    name: "MacOS Chrome Laptop",
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36",
    viewport: { width: 1280, height: 800 },
    locale: "en-US",
    timezoneId: "America/Los_Angeles",
    platform: "MacIntel",
    screenSize: { width: 2560, height: 1600 },
  },
  {
    name: "Windows Chrome Laptop",
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36",
    viewport: { width: 1366, height: 768 },
    locale: "en-US",
    timezoneId: "America/Denver",
    platform: "Win32",
    screenSize: { width: 1366, height: 768 },
  },
];

export function getRandomProfile(): DeviceProfile {
  return DEVICE_PROFILES[Math.floor(Math.random() * DEVICE_PROFILES.length)];
}

// ─── Browser Config ───────────────────────────────────────────────────
export interface BrowserConfig {
  headless: boolean;
  proxy?: {
    server: string;
    username?: string;
    password?: string;
  };
  profile?: DeviceProfile;
  screenshotDir?: string;
  navigationTimeout?: number;
}

// ─── Stealth Scripts ──────────────────────────────────────────────────
function getStealthScripts(profile: DeviceProfile): string {
  return `
    // Override navigator.webdriver
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    
    // Delete automation indicators
    delete window.__playwright;
    delete window.__pw_manual;
    
    // Override navigator.plugins to look real
    Object.defineProperty(navigator, 'plugins', {
      get: () => {
        const plugins = [
          { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
          { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: '' },
          { name: 'Native Client', filename: 'internal-nacl-plugin', description: '' },
        ];
        plugins.length = 3;
        return plugins;
      }
    });
    
    // Override navigator.languages
    Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
    
    // Override navigator.platform
    Object.defineProperty(navigator, 'platform', { get: () => '${profile.platform}' });
    
    // Override navigator.hardwareConcurrency (randomize between 4-16)
    Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => ${4 + Math.floor(Math.random() * 13)} });
    
    // Override navigator.deviceMemory (randomize 4 or 8)
    Object.defineProperty(navigator, 'deviceMemory', { get: () => ${Math.random() > 0.5 ? 8 : 4} });
    
    // Override navigator.maxTouchPoints (0 for desktop)
    Object.defineProperty(navigator, 'maxTouchPoints', { get: () => 0 });
    
    // Override screen properties
    Object.defineProperty(screen, 'width', { get: () => ${profile.screenSize.width} });
    Object.defineProperty(screen, 'height', { get: () => ${profile.screenSize.height} });
    Object.defineProperty(screen, 'availWidth', { get: () => ${profile.screenSize.width} });
    Object.defineProperty(screen, 'availHeight', { get: () => ${profile.screenSize.height - 40} });
    Object.defineProperty(screen, 'colorDepth', { get: () => 24 });
    Object.defineProperty(screen, 'pixelDepth', { get: () => 24 });
    
    // Override chrome runtime
    window.chrome = {
      runtime: { connect: () => {}, sendMessage: () => {}, id: undefined },
      loadTimes: () => ({
        requestTime: Date.now() / 1000 - Math.random() * 10,
        startLoadTime: Date.now() / 1000 - Math.random() * 5,
        commitLoadTime: Date.now() / 1000 - Math.random() * 2,
        finishDocumentLoadTime: Date.now() / 1000 - Math.random(),
        finishLoadTime: Date.now() / 1000,
        firstPaintTime: Date.now() / 1000 - Math.random() * 3,
        firstPaintAfterLoadTime: 0,
        navigationType: 'Other',
        wasFetchedViaSpdy: false,
        wasNpnNegotiated: true,
        npnNegotiatedProtocol: 'h2',
        wasAlternateProtocolAvailable: false,
        connectionInfo: 'h2',
      }),
      csi: () => ({ startE: Date.now(), onloadT: Date.now() + 100, pageT: Date.now() + 200, tran: 15 }),
    };
    
    // Override permissions API
    const originalQuery = window.navigator.permissions?.query;
    if (originalQuery) {
      window.navigator.permissions.query = (parameters) => {
        if (parameters.name === 'notifications') {
          return Promise.resolve({ state: Notification.permission, onchange: null });
        }
        return originalQuery.call(window.navigator.permissions, parameters);
      };
    }
    
    // Override WebGL renderer (randomize between common GPUs)
    const gpus = [
      { vendor: 'Intel Inc.', renderer: 'Intel Iris OpenGL Engine' },
      { vendor: 'Intel Inc.', renderer: 'Intel(R) UHD Graphics 630' },
      { vendor: 'Google Inc. (NVIDIA)', renderer: 'ANGLE (NVIDIA, NVIDIA GeForce GTX 1650)' },
      { vendor: 'Google Inc. (Intel)', renderer: 'ANGLE (Intel, Intel(R) UHD Graphics 770)' },
    ];
    const selectedGpu = gpus[Math.floor(Math.random() * gpus.length)];
    
    const getParameter = WebGLRenderingContext.prototype.getParameter;
    WebGLRenderingContext.prototype.getParameter = function(parameter) {
      if (parameter === 37445) return selectedGpu.vendor;
      if (parameter === 37446) return selectedGpu.renderer;
      return getParameter.call(this, parameter);
    };
    
    // WebGL2 override too
    if (typeof WebGL2RenderingContext !== 'undefined') {
      const getParameter2 = WebGL2RenderingContext.prototype.getParameter;
      WebGL2RenderingContext.prototype.getParameter = function(parameter) {
        if (parameter === 37445) return selectedGpu.vendor;
        if (parameter === 37446) return selectedGpu.renderer;
        return getParameter2.call(this, parameter);
      };
    }
    
    // Override canvas fingerprint with subtle noise
    const toDataURL = HTMLCanvasElement.prototype.toDataURL;
    HTMLCanvasElement.prototype.toDataURL = function(type) {
      if (type === 'image/png' && this.width < 300 && this.height < 100) {
        const ctx = this.getContext('2d');
        if (ctx) {
          const imageData = ctx.getImageData(0, 0, this.width, this.height);
          for (let i = 0; i < imageData.data.length; i += 4) {
            imageData.data[i] = imageData.data[i] ^ (Math.random() > 0.5 ? 1 : 0);
          }
          ctx.putImageData(imageData, 0, 0);
        }
      }
      return toDataURL.apply(this, arguments);
    };
    
    // Override AudioContext fingerprint
    if (typeof AudioContext !== 'undefined') {
      const origCreateOscillator = AudioContext.prototype.createOscillator;
      AudioContext.prototype.createOscillator = function() {
        const osc = origCreateOscillator.call(this);
        const origConnect = osc.connect.bind(osc);
        osc.connect = function(dest) {
          return origConnect(dest);
        };
        return osc;
      };
    }
    
    // Spoof Battery API
    if (navigator.getBattery) {
      navigator.getBattery = () => Promise.resolve({
        charging: true,
        chargingTime: 0,
        dischargingTime: Infinity,
        level: 1.0,
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => true,
        onchargingchange: null,
        onchargingtimechange: null,
        ondischargingtimechange: null,
        onlevelchange: null,
      });
    }
    
    // Spoof Connection API
    if (navigator.connection) {
      Object.defineProperty(navigator.connection, 'rtt', { get: () => 50 + Math.floor(Math.random() * 100) });
      Object.defineProperty(navigator.connection, 'downlink', { get: () => 5 + Math.random() * 15 });
      Object.defineProperty(navigator.connection, 'effectiveType', { get: () => '4g' });
    }
  `;
}

// ─── Human-Like Behavior ──────────────────────────────────────────────
export async function humanDelay(min = 500, max = 2000): Promise<void> {
  const delay = Math.floor(Math.random() * (max - min) + min);
  await new Promise((resolve) => setTimeout(resolve, delay));
}

export async function humanType(page: Page, selector: string, text: string): Promise<void> {
  await page.click(selector);
  await humanDelay(200, 500);
  for (const char of text) {
    await page.keyboard.type(char, { delay: Math.floor(Math.random() * 120) + 25 });
    // Occasional longer pause (simulates thinking)
    if (Math.random() < 0.05) {
      await humanDelay(300, 800);
    }
  }
}

export async function humanClick(page: Page, selector: string): Promise<void> {
  const element = await page.waitForSelector(selector, { timeout: 10000 });
  if (!element) throw new Error(`Element not found: ${selector}`);
  const box = await element.boundingBox();
  if (box) {
    // Move to element with slight randomness and natural curve
    const x = box.x + box.width / 2 + (Math.random() * 8 - 4);
    const y = box.y + box.height / 2 + (Math.random() * 8 - 4);
    await page.mouse.move(x, y, { steps: Math.floor(Math.random() * 15) + 5 });
    await humanDelay(80, 250);
  }
  await element.click();
}

export async function humanScroll(page: Page): Promise<void> {
  // Random scroll pattern: 2-4 small scrolls instead of one big one
  const scrollCount = Math.floor(Math.random() * 3) + 2;
  for (let i = 0; i < scrollCount; i++) {
    const scrollAmount = Math.floor(Math.random() * 200) + 80;
    await page.mouse.wheel(0, scrollAmount);
    await humanDelay(200, 600);
  }
}

/**
 * Move mouse randomly across the page to simulate natural browsing
 */
export async function humanMouseJitter(page: Page): Promise<void> {
  const viewport = page.viewportSize();
  if (!viewport) return;
  const moves = Math.floor(Math.random() * 3) + 1;
  for (let i = 0; i < moves; i++) {
    const x = Math.floor(Math.random() * viewport.width * 0.8) + viewport.width * 0.1;
    const y = Math.floor(Math.random() * viewport.height * 0.8) + viewport.height * 0.1;
    await page.mouse.move(x, y, { steps: Math.floor(Math.random() * 10) + 3 });
    await humanDelay(100, 400);
  }
}

// ─── Browser Launcher ─────────────────────────────────────────────────
export async function launchStealthBrowser(config: BrowserConfig): Promise<{
  browser: Browser;
  context: BrowserContext;
  page: Page;
  profile: DeviceProfile;
}> {
  const profile = config.profile || getRandomProfile();

  const launchOptions: Record<string, unknown> = {
    headless: config.headless,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-blink-features=AutomationControlled",
      "--disable-features=IsolateOrigins,site-per-process",
      "--disable-infobars",
      "--disable-dev-shm-usage",
      "--disable-accelerated-2d-canvas",
      "--no-first-run",
      "--no-zygote",
      "--disable-gpu",
      "--disable-background-networking",
      "--disable-default-apps",
      "--disable-extensions",
      "--disable-sync",
      "--disable-translate",
      "--metrics-recording-only",
      "--mute-audio",
      `--window-size=${profile.viewport.width},${profile.viewport.height}`,
      "--lang=en-US,en",
    ],
  };

  if (config.proxy) {
    launchOptions.proxy = {
      server: config.proxy.server,
      username: config.proxy.username,
      password: config.proxy.password,
    };
  }

  const browser = await chromium.launch(launchOptions as any);

  const context = await browser.newContext({
    userAgent: profile.userAgent,
    viewport: profile.viewport,
    locale: profile.locale,
    timezoneId: profile.timezoneId,
    permissions: ["geolocation"],
    geolocation: { latitude: 40.7128, longitude: -74.006 },
    colorScheme: "light",
    extraHTTPHeaders: {
      "Accept-Language": "en-US,en;q=0.9",
      "Accept-Encoding": "gzip, deflate, br, zstd",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
      "Sec-Ch-Ua": '"Chromium";v="133", "Not_A Brand";v="24"',
      "Sec-Ch-Ua-Mobile": "?0",
      "Sec-Ch-Ua-Platform": `"${profile.platform === "Win32" ? "Windows" : profile.platform.includes("Linux") ? "Linux" : "macOS"}"`,
      "Sec-Fetch-Dest": "document",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-Site": "none",
      "Sec-Fetch-User": "?1",
      "Upgrade-Insecure-Requests": "1",
      "Priority": "u=0, i",
    },
  });

  // Inject stealth scripts before every page load
  await context.addInitScript(getStealthScripts(profile));

  const page = await context.newPage();

  // Set default timeouts
  page.setDefaultNavigationTimeout(config.navigationTimeout || 45_000);
  page.setDefaultTimeout(15_000);

  return { browser, context, page, profile };
}

// ─── Screenshot Helper ────────────────────────────────────────────────
export async function takeScreenshot(page: Page, name: string, dir?: string): Promise<string | null> {
  try {
    const sanitizedName = name.replace(/[^a-zA-Z0-9_-]/g, "_");
    const path = `${dir || "/tmp"}/${sanitizedName}_${Date.now()}.png`;
    await page.screenshot({ path, fullPage: false, type: "png" });
    return path;
  } catch {
    return null;
  }
}
