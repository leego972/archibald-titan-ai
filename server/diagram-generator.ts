/**
 * Diagram Generator
 *
 * Renders Mermaid diagrams (flowcharts, sequence diagrams, ER diagrams,
 * Gantt charts, class diagrams, state diagrams, pie charts) to PNG images
 * using Playwright + the Mermaid JS library loaded in a headless browser.
 *
 * Uploads the PNG to S3/R2 and returns a direct public URL.
 */

import { storagePut } from "./storage";
import { createLogger } from "./_core/logger.js";

const log = createLogger("DiagramGenerator");

export interface DiagramOptions {
  /** Mermaid diagram definition string */
  definition: string;
  /** Optional title shown above the diagram */
  title?: string;
  /** Theme: default | dark | forest | neutral (default: default) */
  theme?: "default" | "dark" | "forest" | "neutral";
  /** Background colour (default: white) */
  backgroundColor?: string;
  /** Output width hint in pixels (default: 1200) */
  width?: number;
}

export interface DiagramResult {
  /** Public URL of the uploaded PNG */
  url: string;
  /** S3/R2 key */
  key: string;
  /** File size in bytes */
  size: number;
}

// Mermaid CDN URL — loaded in headless browser
const MERMAID_CDN = "https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js";

/**
 * Render a Mermaid diagram definition to a PNG and upload to S3/R2.
 * Returns a direct public download URL for the PNG.
 */
export async function generateDiagram(
  userId: number,
  options: DiagramOptions,
  conversationId?: number
): Promise<DiagramResult> {
  const {
    definition,
    title,
    theme = "default",
    backgroundColor = "#ffffff",
    width = 1200,
  } = options;

  if (!definition || !definition.trim()) {
    throw new Error("'definition' is required — provide a Mermaid diagram definition string");
  }

  log.info(`[DiagramGenerator] Rendering diagram for user ${userId} (theme: ${theme})`);

  const { chromium } = await import("playwright");

  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
  });

  let pngBuffer: Buffer;

  try {
    const context = await browser.newContext({
      viewport: { width, height: 800 },
    });
    const page = await context.newPage();

    // Build a minimal HTML page that renders the Mermaid diagram
    const escapedDef = definition
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

    const titleHtml = title
      ? `<h2 style="font-family:sans-serif;text-align:center;margin:0 0 16px;color:#333;">${title}</h2>`
      : "";

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: ${backgroundColor}; padding: 32px; display: inline-block; min-width: ${width}px; }
    .mermaid { display: flex; justify-content: center; }
    svg { max-width: 100%; height: auto; }
  </style>
</head>
<body>
  ${titleHtml}
  <div class="mermaid">${escapedDef}</div>
  <script src="${MERMAID_CDN}"></script>
  <script>
    mermaid.initialize({
      startOnLoad: true,
      theme: '${theme}',
      securityLevel: 'loose',
      flowchart: { useMaxWidth: true },
      sequence: { useMaxWidth: true },
    });
  </script>
</body>
</html>`;

    await page.setContent(html, { waitUntil: "networkidle", timeout: 20_000 });

    // Wait for Mermaid to finish rendering
    await page.waitForSelector(".mermaid svg", { timeout: 15_000 });
    await page.waitForTimeout(500);

    // Screenshot just the body element (tight crop)
    const bodyEl = await page.$("body");
    if (!bodyEl) throw new Error("Could not find body element after Mermaid render");

    const rawBuffer = await bodyEl.screenshot({ type: "png" });
    pngBuffer = Buffer.from(rawBuffer);

    await context.close();
  } finally {
    await browser.close();
  }

  // Upload to S3/R2
  const timestamp = Date.now();
  const safeTitle = (title || "diagram").toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40);
  const fileName = `diagram-${safeTitle}-${timestamp}.png`;
  const s3Key = `diagrams/${userId}/${conversationId || "general"}/${fileName}`;

  const result = await storagePut(s3Key, pngBuffer, "image/png", fileName);

  log.info(`[DiagramGenerator] Uploaded ${pngBuffer.length} bytes → ${result.url}`);

  return {
    url: result.url,
    key: result.key,
    size: pngBuffer.length,
  };
}
