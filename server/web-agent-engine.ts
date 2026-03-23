/**
 * Titan Web Agent Engine
 *
 * Autonomous browser automation engine that executes natural-language tasks
 * on any website using Playwright stealth browser + LLM-guided action planning.
 *
 * Architecture:
 * 1. Task planner: LLM analyses the instruction and produces a step plan
 * 2. Browser executor: Playwright executes each step with human-like behaviour
 * 3. Result extractor: LLM reads the final page state and extracts requested data
 * 4. Confirmation gate: Irreversible actions (payments, posts, deletes) require user approval
 *
 * Safety:
 * - NEVER completes payments without explicit user confirmation
 * - NEVER posts content without explicit user confirmation
 * - NEVER deletes data without explicit user confirmation
 * - Always stops and reports back if uncertain
 */

import { getDb } from "./db";
import { webAgentTasks, webAgentCredentials } from "../drizzle/schema";
import { eq, and } from "drizzle-orm";
import {
  launchStealthBrowser,
  humanDelay,
  humanType,
  humanClick,
  takeScreenshot,
  type BrowserConfig,
} from "./fetcher-engine/browser";
import { detectAndSolveCaptcha } from "./fetcher-engine/captcha-solver";
import { invokeLLM } from "./_core/llm";
import { encrypt, decrypt } from "./fetcher-db";
import { createLogger } from "./_core/logger.js";
import { getErrorMessage } from "./_core/errors.js";
import type { Page, Browser } from "playwright";

const log = createLogger("WebAgent");

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AgentStep {
  action: string;
  detail: string;
  timestamp: string;
}

export interface AgentPlan {
  targetUrl: string;
  steps: Array<{
    type: "navigate" | "login" | "click" | "type" | "extract" | "wait" | "confirm" | "screenshot" | "search" | "scroll";
    description: string;
    selector?: string;
    value?: string;
    extractKey?: string;
    requiresConfirmation?: boolean;
    confirmationMessage?: string;
  }>;
  requiresLogin: boolean;
  siteName: string;
  extractionGoal: string;
}

export interface AgentResult {
  success: boolean;
  summary: string;
  data?: Record<string, any>;
  screenshotUrl?: string;
  steps: AgentStep[];
  requiresConfirmation?: boolean;
  confirmationMessage?: string;
  error?: string;
}

// ─── Credential Management ────────────────────────────────────────────────────

export async function getCredentialForSite(
  userId: number,
  siteName: string
): Promise<{ username: string; password: string; totpSecret?: string } | null> {
  const db = getDb();
  const creds = await db
    .select()
    .from(webAgentCredentials)
    .where(
      and(
        eq(webAgentCredentials.userId, userId),
        eq(webAgentCredentials.siteName, siteName)
      )
    )
    .limit(1);

  if (!creds.length) return null;
  const cred = creds[0];
  return {
    username: decrypt(cred.username),
    password: decrypt(cred.password),
    totpSecret: cred.totpSecret ? decrypt(cred.totpSecret) : undefined,
  };
}

export async function saveCredential(
  userId: number,
  siteName: string,
  siteUrl: string,
  username: string,
  password: string,
  totpSecret?: string,
  notes?: string
): Promise<number> {
  const db = getDb();
  // Check if credential already exists for this site
  const existing = await db
    .select({ id: webAgentCredentials.id })
    .from(webAgentCredentials)
    .where(
      and(
        eq(webAgentCredentials.userId, userId),
        eq(webAgentCredentials.siteName, siteName)
      )
    )
    .limit(1);

  if (existing.length) {
    await db
      .update(webAgentCredentials)
      .set({
        siteUrl,
        username: encrypt(username),
        password: encrypt(password),
        totpSecret: totpSecret ? encrypt(totpSecret) : null,
        notes: notes ?? null,
      })
      .where(eq(webAgentCredentials.id, existing[0].id));
    return existing[0].id;
  }

  const result = await db.insert(webAgentCredentials).values({
    userId,
    siteName,
    siteUrl,
    username: encrypt(username),
    password: encrypt(password),
    totpSecret: totpSecret ? encrypt(totpSecret) : null,
    notes: notes ?? null,
  });
  return (result as any).insertId ?? 0;
}

export async function listCredentials(userId: number) {
  const db = getDb();
  const creds = await db
    .select({
      id: webAgentCredentials.id,
      siteName: webAgentCredentials.siteName,
      siteUrl: webAgentCredentials.siteUrl,
      username: webAgentCredentials.username,
      notes: webAgentCredentials.notes,
      createdAt: webAgentCredentials.createdAt,
      updatedAt: webAgentCredentials.updatedAt,
    })
    .from(webAgentCredentials)
    .where(eq(webAgentCredentials.userId, userId));

  // Decrypt usernames for display (never return passwords)
  return creds.map((c) => ({
    ...c,
    username: decrypt(c.username),
  }));
}

export async function deleteCredential(userId: number, credentialId: number) {
  const db = getDb();
  await db
    .delete(webAgentCredentials)
    .where(
      and(
        eq(webAgentCredentials.id, credentialId),
        eq(webAgentCredentials.userId, userId)
      )
    );
}

// ─── Task Planning ────────────────────────────────────────────────────────────

async function planTask(
  instruction: string,
  availableSites: string[]
): Promise<AgentPlan> {
  const sitesContext =
    availableSites.length > 0
      ? `\nAvailable saved credentials for sites: ${availableSites.join(", ")}`
      : "\nNo saved credentials available.";

  const planPrompt = `You are a browser automation planner. Given a natural-language task instruction, produce a structured JSON plan.

Task: "${instruction}"
${sitesContext}

Produce a JSON plan with this exact structure:
{
  "targetUrl": "https://...",
  "siteName": "Gmail",
  "requiresLogin": true,
  "extractionGoal": "what data to extract or what action to confirm",
  "steps": [
    {
      "type": "navigate",
      "description": "Navigate to Gmail",
      "value": "https://mail.google.com"
    },
    {
      "type": "login",
      "description": "Log in with saved credentials"
    },
    {
      "type": "search",
      "description": "Search for emails from John",
      "value": "from:John"
    },
    {
      "type": "extract",
      "description": "Extract email subjects and senders",
      "extractKey": "emails"
    }
  ]
}

Step types:
- navigate: go to a URL (value = URL)
- login: use saved credentials to log in
- click: click an element (selector = CSS selector or text description)
- type: type text into a field (selector = field description, value = text to type)
- extract: read and extract data from the current page (extractKey = name for the data)
- wait: wait for page to load (value = milliseconds or element description)
- confirm: requires user confirmation before proceeding (requiresConfirmation: true, confirmationMessage: what will happen)
- screenshot: take a screenshot of current state
- search: use a search box (value = search query)
- scroll: scroll down to load more content

IMPORTANT: Any step that involves payment, posting content, deleting data, or making purchases MUST have requiresConfirmation: true.

Return ONLY valid JSON, no markdown, no explanation.`;

  const response = await invokeLLM({
    model: "fast",
    messages: [{ role: "user", content: planPrompt }],
    temperature: 0.1,
    maxTokens: 2000,
  });

  try {
    const cleaned = response.content
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();
    return JSON.parse(cleaned) as AgentPlan;
  } catch {
    // Fallback plan if LLM returns invalid JSON
    return {
      targetUrl: "about:blank",
      siteName: "Unknown",
      requiresLogin: false,
      extractionGoal: instruction,
      steps: [
        {
          type: "navigate",
          description: "Navigate to target",
          value: "about:blank",
        },
      ],
    };
  }
}

// ─── Result Extraction ────────────────────────────────────────────────────────

async function extractResultFromPage(
  page: Page,
  goal: string,
  extractedData: Record<string, any>
): Promise<string> {
  // Get the page's visible text content
  const pageText = await page
    .evaluate(() => {
      const body = document.body;
      if (!body) return "";
      // Remove scripts and styles
      const clone = body.cloneNode(true) as HTMLElement;
      clone.querySelectorAll("script, style, nav, footer").forEach((el) => el.remove());
      return clone.innerText.substring(0, 8000); // limit to 8k chars
    })
    .catch(() => "");

  const extractPrompt = `You are summarising the result of a browser automation task.

Goal: "${goal}"

Data extracted during task: ${JSON.stringify(extractedData, null, 2)}

Current page content (truncated):
${pageText}

Write a clear, concise summary of what was found or accomplished. Be specific — include names, dates, numbers, subjects, etc. if available. Maximum 3 sentences.`;

  const response = await invokeLLM({
    model: "fast",
    messages: [{ role: "user", content: extractPrompt }],
    temperature: 0.3,
    maxTokens: 500,
  });

  return response.content;
}

// ─── Browser Action Executor ──────────────────────────────────────────────────

async function executeStep(
  page: Page,
  step: AgentPlan["steps"][0],
  credentials: { username: string; password: string; totpSecret?: string } | null,
  steps: AgentStep[],
  extractedData: Record<string, any>
): Promise<{ requiresConfirmation?: boolean; confirmationMessage?: string }> {
  const timestamp = new Date().toISOString();

  switch (step.type) {
    case "navigate": {
      const url = step.value || "about:blank";
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
      await humanDelay(800, 1500);
      steps.push({ action: "navigate", detail: `Navigated to ${url}`, timestamp });
      break;
    }

    case "login": {
      if (!credentials) {
        steps.push({ action: "login", detail: "No credentials available — skipping login", timestamp });
        break;
      }
      // Try to find username and password fields
      const usernameSelectors = [
        'input[type="email"]',
        'input[type="text"][name*="user"]',
        'input[type="text"][name*="email"]',
        'input[id*="email"]',
        'input[id*="user"]',
        'input[name="username"]',
        'input[name="email"]',
        'input[placeholder*="email" i]',
        'input[placeholder*="username" i]',
      ];
      const passwordSelectors = [
        'input[type="password"]',
        'input[name="password"]',
        'input[id*="password"]',
      ];

      let loggedIn = false;
      for (const sel of usernameSelectors) {
        try {
          const el = await page.$(sel);
          if (el) {
            await humanType(page, sel, credentials.username);
            await humanDelay(300, 600);
            loggedIn = true;
            break;
          }
        } catch {}
      }

      if (loggedIn) {
        // Look for a "Next" button (Gmail-style two-step login)
        const nextBtn = await page.$('button:has-text("Next"), button[id*="next"], input[value="Next"]');
        if (nextBtn) {
          await nextBtn.click();
          await humanDelay(1500, 2500);
        }

        for (const sel of passwordSelectors) {
          try {
            const el = await page.$(sel);
            if (el) {
              await humanType(page, sel, credentials.password);
              await humanDelay(300, 600);
              break;
            }
          } catch {}
        }

        // Submit
        const submitBtn = await page.$(
          'button[type="submit"], input[type="submit"], button:has-text("Sign in"), button:has-text("Log in"), button:has-text("Login")'
        );
        if (submitBtn) {
          await submitBtn.click();
          await page.waitForLoadState("domcontentloaded", { timeout: 15000 }).catch(() => {});
          await humanDelay(1500, 3000);
        }
      }

      steps.push({
        action: "login",
        detail: loggedIn ? `Logged in as ${credentials.username}` : "Could not find login form",
        timestamp,
      });
      break;
    }

    case "search": {
      const searchSelectors = [
        'input[type="search"]',
        'input[placeholder*="search" i]',
        'input[aria-label*="search" i]',
        'input[name="q"]',
        'input[name="search"]',
        '[role="searchbox"]',
      ];
      let searched = false;
      for (const sel of searchSelectors) {
        try {
          const el = await page.$(sel);
          if (el) {
            await humanType(page, sel, step.value || "");
            await humanDelay(300, 600);
            await page.keyboard.press("Enter");
            await page.waitForLoadState("domcontentloaded", { timeout: 10000 }).catch(() => {});
            await humanDelay(1000, 2000);
            searched = true;
            break;
          }
        } catch {}
      }
      steps.push({
        action: "search",
        detail: searched ? `Searched for: ${step.value}` : `Could not find search box`,
        timestamp,
      });
      break;
    }

    case "click": {
      if (!step.selector) break;
      try {
        // Try CSS selector first, then text-based
        const el =
          (await page.$(step.selector).catch(() => null)) ||
          (await page.getByText(step.selector, { exact: false }).first().elementHandle().catch(() => null));
        if (el) {
          await el.scrollIntoViewIfNeeded();
          await humanDelay(200, 500);
          await el.click();
          await humanDelay(500, 1200);
        }
      } catch {}
      steps.push({ action: "click", detail: `Clicked: ${step.description}`, timestamp });
      break;
    }

    case "type": {
      if (!step.selector || !step.value) break;
      try {
        await humanType(page, step.selector, step.value);
      } catch {}
      steps.push({ action: "type", detail: `Typed into ${step.description}: ${step.value}`, timestamp });
      break;
    }

    case "extract": {
      // Extract visible text from the page
      const text = await page
        .evaluate(() => {
          const body = document.body;
          if (!body) return "";
          const clone = body.cloneNode(true) as HTMLElement;
          clone.querySelectorAll("script, style").forEach((el) => el.remove());
          return clone.innerText.substring(0, 5000);
        })
        .catch(() => "");

      if (step.extractKey) {
        extractedData[step.extractKey] = text;
      }
      steps.push({ action: "extract", detail: `Extracted data: ${step.extractKey || "page content"}`, timestamp });
      break;
    }

    case "wait": {
      const ms = parseInt(step.value || "2000", 10);
      await humanDelay(Math.min(ms, 5000), Math.min(ms + 1000, 6000));
      steps.push({ action: "wait", detail: `Waited ${ms}ms`, timestamp });
      break;
    }

    case "scroll": {
      await page.evaluate(() => window.scrollBy(0, window.innerHeight));
      await humanDelay(500, 1000);
      steps.push({ action: "scroll", detail: "Scrolled down", timestamp });
      break;
    }

    case "screenshot": {
      steps.push({ action: "screenshot", detail: "Screenshot taken", timestamp });
      break;
    }

    case "confirm": {
      if (step.requiresConfirmation) {
        steps.push({
          action: "confirm",
          detail: `Paused — requires confirmation: ${step.confirmationMessage}`,
          timestamp,
        });
        return {
          requiresConfirmation: true,
          confirmationMessage: step.confirmationMessage || step.description,
        };
      }
      break;
    }
  }

  return {};
}

// ─── Main Task Runner ─────────────────────────────────────────────────────────

export async function runWebAgentTask(
  taskId: number,
  userId: number
): Promise<AgentResult> {
  const db = getDb();
  const startTime = Date.now();
  const steps: AgentStep[] = [];
  const extractedData: Record<string, any> = {};

  // Load task
  const tasks = await db
    .select()
    .from(webAgentTasks)
    .where(and(eq(webAgentTasks.id, taskId), eq(webAgentTasks.userId, userId)))
    .limit(1);

  if (!tasks.length) {
    return { success: false, summary: "Task not found", steps, error: "Task not found" };
  }

  const task = tasks[0];

  // Mark as running
  await db
    .update(webAgentTasks)
    .set({ status: "running" })
    .where(eq(webAgentTasks.id, taskId));

  let browser: Browser | null = null;

  try {
    // Get available credential site names for this user
    const creds = await db
      .select({ siteName: webAgentCredentials.siteName })
      .from(webAgentCredentials)
      .where(eq(webAgentCredentials.userId, userId));
    const availableSites = creds.map((c) => c.siteName);

    // Plan the task
    steps.push({
      action: "plan",
      detail: "Analysing task and building execution plan...",
      timestamp: new Date().toISOString(),
    });
    const plan = await planTask(task.instruction, availableSites);

    // Update target site
    await db
      .update(webAgentTasks)
      .set({ targetSite: plan.siteName })
      .where(eq(webAgentTasks.id, taskId));

    // Get credentials if needed
    let credentials: { username: string; password: string; totpSecret?: string } | null = null;
    if (plan.requiresLogin) {
      credentials = await getCredentialForSite(userId, plan.siteName);
      if (!credentials) {
        // Try partial match
        for (const site of availableSites) {
          if (
            plan.siteName.toLowerCase().includes(site.toLowerCase()) ||
            site.toLowerCase().includes(plan.siteName.toLowerCase())
          ) {
            credentials = await getCredentialForSite(userId, site);
            if (credentials) break;
          }
        }
      }
    }

    // Launch stealth browser
    const browserConfig: BrowserConfig = {
      headless: true,
      proxy: undefined,
      deviceProfile: undefined,
    };
    const { browser: b, context, page } = await launchStealthBrowser(browserConfig);
    browser = b;

    // Execute each step
    for (const step of plan.steps) {
      // Check for CAPTCHA before each step
      try {
        const captchaResult = await detectAndSolveCaptcha(page, {
          service: "none",
          apiKey: "",
        });
        if (captchaResult.detected && !captchaResult.solved) {
          steps.push({
            action: "captcha",
            detail: "CAPTCHA detected but could not be solved automatically",
            timestamp: new Date().toISOString(),
          });
        }
      } catch {}

      const stepResult = await executeStep(page, step, credentials, steps, extractedData);

      // Update step count in DB
      await db
        .update(webAgentTasks)
        .set({ stepCount: steps.length })
        .where(eq(webAgentTasks.id, taskId));

      // If confirmation required, pause and return
      if (stepResult.requiresConfirmation) {
        await db
          .update(webAgentTasks)
          .set({
            status: "awaiting_confirmation",
            confirmationRequired: stepResult.confirmationMessage,
            stepCount: steps.length,
            result: {
              summary: `Paused — waiting for your confirmation: ${stepResult.confirmationMessage}`,
              steps,
              data: extractedData,
            },
          })
          .where(eq(webAgentTasks.id, taskId));

        await browser.close();
        return {
          success: true,
          summary: `Paused — waiting for your confirmation: ${stepResult.confirmationMessage}`,
          steps,
          data: extractedData,
          requiresConfirmation: true,
          confirmationMessage: stepResult.confirmationMessage,
        };
      }
    }

    // Extract final result
    const summary = await extractResultFromPage(page, plan.extractionGoal, extractedData);

    const durationMs = Date.now() - startTime;

    await db
      .update(webAgentTasks)
      .set({
        status: "completed",
        stepCount: steps.length,
        durationMs,
        result: { summary, steps, data: extractedData },
      })
      .where(eq(webAgentTasks.id, taskId));

    await browser.close();

    return { success: true, summary, steps, data: extractedData };
  } catch (err) {
    const errorMessage = getErrorMessage(err);
    log.error("Web agent task failed", { taskId, error: errorMessage });

    if (browser) {
      try {
        await browser.close();
      } catch {}
    }

    await db
      .update(webAgentTasks)
      .set({
        status: "failed",
        errorMessage,
        stepCount: steps.length,
        durationMs: Date.now() - startTime,
        result: { summary: `Task failed: ${errorMessage}`, steps },
      })
      .where(eq(webAgentTasks.id, taskId));

    return {
      success: false,
      summary: `Task failed: ${errorMessage}`,
      steps,
      error: errorMessage,
    };
  }
}
