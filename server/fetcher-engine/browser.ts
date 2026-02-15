/**
 * Stealth Browser Engine
 * Launches a Playwright Chromium browser with anti-detection measures,
 * device fingerprint mimicking, proxy support, and human-like behavior.
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
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    viewport: { width: 1920, height: 1080 },
    locale: "en-US",
    timezoneId: "America/New_York",
    platform: "Win32",
    screenSize: { width: 1920, height: 1080 },
  },
  {
    name: "MacOS Chrome Desktop",
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    viewport: { width: 1440, height: 900 },
    locale: "en-US",
    timezoneId: "America/Los_Angeles",
    platform: "MacIntel",
    screenSize: { width: 1440, height: 900 },
  },
  {
    name: "Windows Firefox Desktop",
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0",
    viewport: { width: 1366, height: 768 },
    locale: "en-US",
    timezoneId: "America/Chicago",
    platform: "Win32",
    screenSize: { width: 1366, height: 768 },
  },
  {
    name: "MacOS Safari Desktop",
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15",
    viewport: { width: 1680, height: 1050 },
    locale: "en-US",
    timezoneId: "America/Denver",
    platform: "MacIntel",
    screenSize: { width: 1680, height: 1050 },
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
}

// ─── Stealth Scripts ──────────────────────────────────────────────────
function getStealthScripts(profile: DeviceProfile): string {
  return `
    // Override navigator.webdriver
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    
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
    
    // Override navigator.hardwareConcurrency
    Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });
    
    // Override navigator.deviceMemory
    Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });
    
    // Override screen properties
    Object.defineProperty(screen, 'width', { get: () => ${profile.screenSize.width} });
    Object.defineProperty(screen, 'height', { get: () => ${profile.screenSize.height} });
    Object.defineProperty(screen, 'availWidth', { get: () => ${profile.screenSize.width} });
    Object.defineProperty(screen, 'availHeight', { get: () => ${profile.screenSize.height - 40} });
    Object.defineProperty(screen, 'colorDepth', { get: () => 24 });
    Object.defineProperty(screen, 'pixelDepth', { get: () => 24 });
    
    // Override chrome runtime
    window.chrome = {
      runtime: { connect: () => {}, sendMessage: () => {} },
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
    
    // Override WebGL renderer
    const getParameter = WebGLRenderingContext.prototype.getParameter;
    WebGLRenderingContext.prototype.getParameter = function(parameter) {
      if (parameter === 37445) return 'Intel Inc.';
      if (parameter === 37446) return 'Intel Iris OpenGL Engine';
      return getParameter.call(this, parameter);
    };
    
    // Override canvas fingerprint
    const toDataURL = HTMLCanvasElement.prototype.toDataURL;
    HTMLCanvasElement.prototype.toDataURL = function(type) {
      if (type === 'image/png' && this.width === 220 && this.height === 30) {
        const ctx = this.getContext('2d');
        if (ctx) {
          const imageData = ctx.getImageData(0, 0, this.width, this.height);
          for (let i = 0; i < imageData.data.length; i += 4) {
            imageData.data[i] = imageData.data[i] ^ 1;
          }
          ctx.putImageData(imageData, 0, 0);
        }
      }
      return toDataURL.apply(this, arguments);
    };
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
    await page.keyboard.type(char, { delay: Math.floor(Math.random() * 100) + 30 });
  }
}

export async function humanClick(page: Page, selector: string): Promise<void> {
  const element = await page.waitForSelector(selector, { timeout: 10000 });
  if (!element) throw new Error(`Element not found: ${selector}`);
  const box = await element.boundingBox();
  if (box) {
    // Move to element with slight randomness
    const x = box.x + box.width / 2 + (Math.random() * 6 - 3);
    const y = box.y + box.height / 2 + (Math.random() * 6 - 3);
    await page.mouse.move(x, y, { steps: Math.floor(Math.random() * 10) + 5 });
    await humanDelay(100, 300);
  }
  await element.click();
}

export async function humanScroll(page: Page): Promise<void> {
  const scrollAmount = Math.floor(Math.random() * 300) + 100;
  await page.mouse.wheel(0, scrollAmount);
  await humanDelay(300, 800);
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
      "Accept-Encoding": "gzip, deflate, br",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
      "Sec-Ch-Ua": '"Chromium";v="131", "Not_A Brand";v="24"',
      "Sec-Ch-Ua-Mobile": "?0",
      "Sec-Ch-Ua-Platform": `"${profile.platform === "Win32" ? "Windows" : "macOS"}"`,
      "Sec-Fetch-Dest": "document",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-Site": "none",
      "Sec-Fetch-User": "?1",
      "Upgrade-Insecure-Requests": "1",
    },
  });

  // Inject stealth scripts before every page load
  await context.addInitScript(getStealthScripts(profile));

  const page = await context.newPage();

  return { browser, context, page, profile };
}

// ─── Screenshot Helper ────────────────────────────────────────────────
export async function takeScreenshot(page: Page, name: string, dir?: string): Promise<string | null> {
  try {
    const path = `${dir || "/tmp"}/${name}_${Date.now()}.png`;
    await page.screenshot({ path, fullPage: false });
    return path;
  } catch {
    return null;
  }
}
