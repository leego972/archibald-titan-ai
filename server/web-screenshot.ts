/**
 * Web Screenshot Engine
 *
 * Takes a full-page screenshot of any URL using Playwright (Chromium),
 * uploads the PNG to S3/R2, and returns a direct public URL.
 *
 * Used by the `web_screenshot` tool so Titan can visually compare websites,
 * capture UI state, and include rendered screenshots in reports.
 */

import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { storagePut } from "./storage";
import { createLogger } from "./_core/logger.js";

const log = createLogger("WebScreenshot");

export interface ScreenshotOptions {
  /** Full URL to screenshot (must include https://) */
  url: string;
  /** Viewport width in pixels (default: 1440) */
  width?: number;
  /** Viewport height in pixels (default: 900) */
  height?: number;
  /** Capture full scrollable page height (default: true) */
  fullPage?: boolean;
  /** Wait for network to be idle before capturing (default: true) */
  waitForIdle?: boolean;
  /** Extra milliseconds to wait after page load (default: 1500) */
  extraWaitMs?: number;
}

export interface ScreenshotResult {
  /** Public URL of the uploaded PNG */
  url: string;
  /** S3/R2 key */
  key: string;
  /** File size in bytes */
  size: number;
  /** Page title extracted from the browser */
  title: string;
  /** Viewport dimensions used */
  viewport: { width: number; height: number };
}

/**
 * Take a full-page screenshot of a URL and upload it to S3/R2.
 * Returns a direct public download URL for the PNG.
 */
export async function takeWebScreenshot(
  userId: number,
  options: ScreenshotOptions,
  conversationId?: number
): Promise<ScreenshotResult> {
  const {
    url,
    width = 1440,
    height = 900,
    fullPage = true,
    waitForIdle = true,
    extraWaitMs = 1500,
  } = options;

  if (!url || !url.startsWith("http")) {
    throw new Error("A valid URL starting with http:// or https:// is required");
  }

  log.info(`[WebScreenshot] Capturing: ${url} (${width}x${height}, fullPage=${fullPage})`);

  // Dynamically import Playwright to avoid startup cost when not needed
  const { chromium } = await import("playwright");

  const browser = await chromium.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--disable-web-security",
      "--disable-features=IsolateOrigins,site-per-process",
    ],
  });

  let screenshotBuffer!: Buffer;
  let pageTitle = "Untitled";

  try {
    const context = await browser.newContext({
      viewport: { width, height },
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      ignoreHTTPSErrors: true,
    });

    const page = await context.newPage();

    // Navigate with generous timeout
    await page.goto(url, {
      timeout: 30_000,
      waitUntil: waitForIdle ? "networkidle" : "domcontentloaded",
    });

    // Extra wait for JS-heavy pages (React, Vue, etc.)
    if (extraWaitMs > 0) {
      await page.waitForTimeout(extraWaitMs);
    }

    // Extract page title
    try {
      pageTitle = await page.title();
    } catch {
      pageTitle = new URL(url).hostname;
    }

    // Take screenshot
    const rawBuffer = await page.screenshot({
      fullPage,
      type: "png",
    });
    screenshotBuffer = Buffer.from(rawBuffer);

    await context.close();
  } finally {
    await browser.close();
  }

  // Upload to S3/R2
  const timestamp = Date.now();
  const safeHost = new URL(url).hostname.replace(/[^a-z0-9.-]/gi, "-");
  const fileName = `screenshot-${safeHost}-${timestamp}.png`;
  const s3Key = `screenshots/${userId}/${conversationId || "general"}/${fileName}`;

  const result = await storagePut(s3Key, screenshotBuffer, "image/png", fileName);

  log.info(`[WebScreenshot] Uploaded ${screenshotBuffer.length} bytes → ${result.url}`);

  return {
    url: result.url,
    key: result.key,
    size: screenshotBuffer.length,
    title: pageTitle,
    viewport: { width, height },
  };
}
