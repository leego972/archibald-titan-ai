/**
 * Provider-Specific Automation Scripts
 * Each provider has a dedicated automation function that:
 * 1. Navigates to the login page
 * 2. Logs in with user credentials
 * 3. Navigates to the API keys page
 * 4. Extracts or generates API keys
 * 5. Returns the extracted credentials
 */
import type { Page } from "playwright";
import { humanType, humanClick, humanDelay, humanScroll, takeScreenshot } from "./browser";
import { detectAndSolveCaptcha, detectBotProtection, type CaptchaConfig } from "./captcha-solver";

export interface ProviderCredential {
  keyType: string;
  value: string;
  label: string;
}

export interface AutomationResult {
  success: boolean;
  credentials: ProviderCredential[];
  error?: string;
  screenshotPath?: string | null;
}

type StatusCallback = (status: string, message: string) => Promise<void>;

// ─── Helper: Wait for navigation with retry ───────────────────────────
async function safeGoto(page: Page, url: string, timeout = 30000): Promise<void> {
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout });
  } catch {
    // Retry once
    await humanDelay(2000, 4000);
    await page.goto(url, { waitUntil: "domcontentloaded", timeout });
  }
}

// ─── Helper: Login with bot detection handling ────────────────────────
async function loginWithBotCheck(
  page: Page,
  loginUrl: string,
  emailSelector: string,
  passwordSelector: string,
  submitSelector: string,
  email: string,
  password: string,
  captchaConfig: CaptchaConfig,
  onStatus: StatusCallback
): Promise<boolean> {
  await safeGoto(page, loginUrl);
  await humanDelay(2000, 4000);

  // Check for bot detection
  const botCheck = await detectBotProtection(page);
  if (botCheck.detected) {
    await onStatus("captcha_wait", `Bot protection detected (${botCheck.type}). Attempting to solve...`);
    const captchaResult = await detectAndSolveCaptcha(page, captchaConfig);
    if (!captchaResult.solved) {
      throw new Error(`Bot protection (${botCheck.type}) could not be bypassed: ${captchaResult.error}`);
    }
    await humanDelay(2000, 3000);
  }

  // Fill email
  try {
    await page.waitForSelector(emailSelector, { timeout: 10000 });
    await humanType(page, emailSelector, email);
    await humanDelay(500, 1000);
  } catch {
    // Try alternative selectors
    const altSelectors = ['input[type="email"]', 'input[name="email"]', 'input[name="username"]', 'input[id="login-email"]', '#email', '#username'];
    let found = false;
    for (const sel of altSelectors) {
      try {
        await page.waitForSelector(sel, { timeout: 2000 });
        await humanType(page, sel, email);
        found = true;
        break;
      } catch { continue; }
    }
    if (!found) throw new Error("Could not find email input field");
  }

  // Fill password
  try {
    await page.waitForSelector(passwordSelector, { timeout: 5000 });
    await humanType(page, passwordSelector, password);
    await humanDelay(500, 1000);
  } catch {
    const altSelectors = ['input[type="password"]', 'input[name="password"]', '#password'];
    let found = false;
    for (const sel of altSelectors) {
      try {
        await page.waitForSelector(sel, { timeout: 2000 });
        await humanType(page, sel, password);
        found = true;
        break;
      } catch { continue; }
    }
    if (!found) throw new Error("Could not find password input field");
  }

  // Check for CAPTCHA before submit
  const preCaptcha = await detectAndSolveCaptcha(page, captchaConfig);
  if (preCaptcha.solved) {
    await humanDelay(1000, 2000);
  }

  // Submit
  try {
    await humanClick(page, submitSelector);
  } catch {
    const altSelectors = ['button[type="submit"]', 'input[type="submit"]', 'button:has-text("Sign in")', 'button:has-text("Log in")', 'button:has-text("Login")'];
    let clicked = false;
    for (const sel of altSelectors) {
      try {
        await humanClick(page, sel);
        clicked = true;
        break;
      } catch { continue; }
    }
    if (!clicked) {
      await page.keyboard.press("Enter");
    }
  }

  await humanDelay(3000, 5000);

  // Post-login bot check
  const postBotCheck = await detectBotProtection(page);
  if (postBotCheck.detected) {
    await onStatus("captcha_wait", `Post-login bot protection (${postBotCheck.type}). Solving...`);
    const captchaResult = await detectAndSolveCaptcha(page, captchaConfig);
    if (!captchaResult.solved) {
      throw new Error(`Post-login bot protection could not be bypassed: ${captchaResult.error}`);
    }
    await humanDelay(2000, 3000);
  }

  // Check for 2FA prompt
  const has2FA = await page.evaluate(() => {
    const text = document.body?.innerText?.toLowerCase() || "";
    return text.includes("two-factor") || text.includes("2fa") || text.includes("verification code") || text.includes("authenticator");
  });

  if (has2FA) {
    throw new Error("Two-factor authentication detected. Please disable 2FA temporarily or provide the code.");
  }

  return true;
}

// ─── Helper: Extract text from page elements ─────────────────────────
async function extractText(page: Page, selector: string): Promise<string | null> {
  try {
    const el = await page.waitForSelector(selector, { timeout: 5000 });
    return el ? await el.textContent() : null;
  } catch {
    return null;
  }
}

async function extractInputValue(page: Page, selector: string): Promise<string | null> {
  try {
    return await page.inputValue(selector, { timeout: 5000 });
  } catch {
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════
// PROVIDER AUTOMATIONS
// ═══════════════════════════════════════════════════════════════════════

// ─── OpenAI ───────────────────────────────────────────────────────────
async function automateOpenAI(page: Page, email: string, password: string, captchaConfig: CaptchaConfig, onStatus: StatusCallback): Promise<AutomationResult> {
  await onStatus("logging_in", "Logging into OpenAI...");
  await loginWithBotCheck(page, "https://platform.openai.com/login", 'input[name="email"], input[type="email"]', 'input[type="password"]', 'button[type="submit"]', email, password, captchaConfig, onStatus);

  await onStatus("navigating", "Navigating to API keys page...");
  await safeGoto(page, "https://platform.openai.com/api-keys");
  await humanDelay(3000, 5000);

  await onStatus("extracting", "Extracting API keys...");
  // Try to find existing keys or create new one
  const keys = await page.evaluate(() => {
    const rows = document.querySelectorAll('table tbody tr, [class*="key-row"], [data-testid*="key"]');
    const results: { name: string; key: string }[] = [];
    rows.forEach((row) => {
      const nameEl = row.querySelector('td:first-child, [class*="name"]');
      const keyEl = row.querySelector('td:nth-child(2), [class*="key"], code');
      if (nameEl && keyEl) {
        results.push({ name: nameEl.textContent?.trim() || "key", key: keyEl.textContent?.trim() || "" });
      }
    });
    return results;
  });

  if (keys.length > 0) {
    return {
      success: true,
      credentials: keys.map((k) => ({ keyType: "api_key", value: k.key, label: k.name })),
    };
  }

  // Try to create a new key
  try {
    await humanClick(page, 'button:has-text("Create new secret key"), button:has-text("Create key")');
    await humanDelay(2000, 3000);
    const newKey = await page.evaluate(() => {
      const codeEl = document.querySelector('code, [class*="secret"], input[readonly]');
      return codeEl?.textContent?.trim() || (codeEl as HTMLInputElement)?.value || null;
    });
    if (newKey) {
      return { success: true, credentials: [{ keyType: "api_key", value: newKey, label: "New API Key" }] };
    }
  } catch { /* key creation failed */ }

  return { success: false, credentials: [], error: "Could not extract or create API keys" };
}

// ─── Anthropic ────────────────────────────────────────────────────────
async function automateAnthropic(page: Page, email: string, password: string, captchaConfig: CaptchaConfig, onStatus: StatusCallback): Promise<AutomationResult> {
  await onStatus("logging_in", "Logging into Anthropic...");
  await loginWithBotCheck(page, "https://console.anthropic.com/login", 'input[name="email"], input[type="email"]', 'input[type="password"]', 'button[type="submit"]', email, password, captchaConfig, onStatus);

  await onStatus("navigating", "Navigating to API keys...");
  await safeGoto(page, "https://console.anthropic.com/settings/keys");
  await humanDelay(3000, 5000);

  await onStatus("extracting", "Extracting API keys...");
  const keys = await page.evaluate(() => {
    const rows = document.querySelectorAll('table tbody tr, [class*="key"]');
    const results: { name: string; key: string }[] = [];
    rows.forEach((row) => {
      const cells = row.querySelectorAll("td");
      if (cells.length >= 2) {
        results.push({ name: cells[0]?.textContent?.trim() || "key", key: cells[1]?.textContent?.trim() || "" });
      }
    });
    return results;
  });

  if (keys.length > 0) {
    return { success: true, credentials: keys.map((k) => ({ keyType: "api_key", value: k.key, label: k.name })) };
  }

  try {
    await humanClick(page, 'button:has-text("Create Key"), button:has-text("Create")');
    await humanDelay(2000, 3000);
    const newKey = await page.evaluate(() => {
      const el = document.querySelector('code, input[readonly], [class*="secret"]');
      return el?.textContent?.trim() || (el as HTMLInputElement)?.value || null;
    });
    if (newKey) {
      return { success: true, credentials: [{ keyType: "api_key", value: newKey, label: "New API Key" }] };
    }
  } catch { /* */ }

  return { success: false, credentials: [], error: "Could not extract API keys" };
}

// ─── Generic Provider Automation ──────────────────────────────────────
// Used for providers that follow a standard login → keys page → extract pattern
async function automateGeneric(
  page: Page,
  email: string,
  password: string,
  captchaConfig: CaptchaConfig,
  onStatus: StatusCallback,
  providerName: string,
  loginUrl: string,
  keysUrl: string,
  keyTypes: string[]
): Promise<AutomationResult> {
  await onStatus("logging_in", `Logging into ${providerName}...`);
  await loginWithBotCheck(page, loginUrl, 'input[type="email"], input[name="email"], input[name="username"], #email, #username, #login-email', 'input[type="password"], input[name="password"], #password', 'button[type="submit"], input[type="submit"]', email, password, captchaConfig, onStatus);

  await onStatus("navigating", `Navigating to ${providerName} API keys page...`);
  await safeGoto(page, keysUrl);
  await humanDelay(3000, 5000);
  await humanScroll(page);

  await onStatus("extracting", `Extracting credentials from ${providerName}...`);

  // Generic extraction: look for API key patterns on the page
  const credentials: ProviderCredential[] = [];

  // Try to find keys in tables
  const tableKeys = await page.evaluate(() => {
    const results: { text: string; context: string }[] = [];
    // Look in table cells
    document.querySelectorAll("table tbody tr").forEach((row) => {
      const cells = row.querySelectorAll("td");
      cells.forEach((cell) => {
        const text = cell.textContent?.trim() || "";
        if (text.length > 10 && /^[a-zA-Z0-9_\-]+$/.test(text)) {
          results.push({ text, context: row.textContent?.trim()?.substring(0, 100) || "" });
        }
      });
    });
    // Look in code elements
    document.querySelectorAll("code, pre, [class*='key'], [class*='token'], [class*='secret']").forEach((el) => {
      const text = el.textContent?.trim() || "";
      if (text.length > 10 && text.length < 200 && /^[a-zA-Z0-9_\-\.]+$/.test(text)) {
        results.push({ text, context: el.parentElement?.textContent?.trim()?.substring(0, 100) || "" });
      }
    });
    // Look in readonly inputs
    document.querySelectorAll('input[readonly], input[disabled], input[type="text"]').forEach((el) => {
      const val = (el as HTMLInputElement).value?.trim() || "";
      if (val.length > 10 && /^[a-zA-Z0-9_\-\.]+$/.test(val)) {
        results.push({ text: val, context: el.parentElement?.textContent?.trim()?.substring(0, 100) || "" });
      }
    });
    return results;
  });

  if (tableKeys.length > 0) {
    for (let i = 0; i < Math.min(tableKeys.length, keyTypes.length); i++) {
      credentials.push({
        keyType: keyTypes[i] || "api_key",
        value: tableKeys[i].text,
        label: `${providerName} ${keyTypes[i] || "key"} (${tableKeys[i].context.substring(0, 30)})`,
      });
    }
  }

  // If no keys found, try to create/generate new ones
  if (credentials.length === 0) {
    try {
      const createButtons = [
        'button:has-text("Create")',
        'button:has-text("Generate")',
        'button:has-text("New")',
        'button:has-text("Add")',
        'a:has-text("Create")',
        'a:has-text("Generate")',
      ];
      for (const btn of createButtons) {
        try {
          await humanClick(page, btn);
          await humanDelay(3000, 5000);

          // Look for newly generated key
          const newKey = await page.evaluate(() => {
            const el = document.querySelector('code, input[readonly], [class*="secret"], [class*="token"], pre');
            return el?.textContent?.trim() || (el as HTMLInputElement)?.value || null;
          });

          if (newKey && newKey.length > 10) {
            credentials.push({
              keyType: keyTypes[0] || "api_key",
              value: newKey,
              label: `${providerName} New Key`,
            });
            break;
          }
        } catch { continue; }
      }
    } catch { /* */ }
  }

  if (credentials.length > 0) {
    return { success: true, credentials };
  }

  const screenshot = await takeScreenshot(page, `${providerName.toLowerCase()}_keys`);
  return { success: false, credentials: [], error: `Could not extract credentials from ${providerName}. Screenshot saved.`, screenshotPath: screenshot };
}

// ─── GoDaddy Helper: Block Akamai scripts and install overlay killer ─
async function setupGoDaddyAntiBot(page: Page): Promise<void> {
  // Block known Akamai/bot detection script URLs
  await page.route('**/*', (route) => {
    const url = route.request().url();
    const blockPatterns = [
      'akamaihd.net',
      'akam/',
      'akamai',
      '_sec/cp_challenge',
      'ux-disrupt',
      'sec-cpt',
      'challenge-platform',
      'bmak',
    ];
    if (blockPatterns.some(p => url.toLowerCase().includes(p))) {
      return route.abort();
    }
    return route.continue();
  });

  // Install a MutationObserver that continuously kills overlays
  await page.addInitScript(() => {
    const killOverlays = () => {
      document.querySelectorAll('[class*="ux-disrupt"], [data-version], .modal-backdrop, .overlay, [class*="challenge"], [class*="sec-cpt"]').forEach(el => el.remove());
      document.querySelectorAll('div').forEach(el => {
        const s = window.getComputedStyle(el);
        if ((s.position === 'fixed' || s.position === 'absolute') &&
            s.zIndex && parseInt(s.zIndex) > 999 &&
            el.offsetWidth > window.innerWidth * 0.5 &&
            el.offsetHeight > window.innerHeight * 0.5 &&
            !el.querySelector('input') && !el.querySelector('form')) {
          el.remove();
        }
      });
      document.body.style.overflow = 'auto';
      document.documentElement.style.overflow = 'auto';
      document.body.style.pointerEvents = 'auto';
    };
    // Run immediately and on every DOM change
    killOverlays();
    const observer = new MutationObserver(killOverlays);
    if (document.body) {
      observer.observe(document.body, { childList: true, subtree: true });
    } else {
      document.addEventListener('DOMContentLoaded', () => {
        observer.observe(document.body, { childList: true, subtree: true });
      });
    }
    // Also run periodically as a safety net
    setInterval(killOverlays, 500);
  });
}

// ─── GoDaddy Helper: Dismiss overlays (immediate) ──────────────────
async function dismissGoDaddyOverlays(page: Page): Promise<boolean> {
  const dismissed = await page.evaluate(() => {
    let found = false;
    document.querySelectorAll('[class*="ux-disrupt"], [data-version], .modal-backdrop, .overlay, [class*="challenge"], [class*="sec-cpt"]').forEach((el) => {
      el.remove();
      found = true;
    });
    document.querySelectorAll('div').forEach((el) => {
      const style = window.getComputedStyle(el);
      if ((style.position === 'fixed' || style.position === 'absolute') &&
          style.zIndex && parseInt(style.zIndex) > 999 &&
          el.offsetWidth > window.innerWidth * 0.5 &&
          el.offsetHeight > window.innerHeight * 0.5 &&
          !el.querySelector('input') && !el.querySelector('form')) {
        el.remove();
        found = true;
      }
    });
    document.body.style.overflow = 'auto';
    document.documentElement.style.overflow = 'auto';
    document.body.style.pointerEvents = 'auto';
    return found;
  });
  return dismissed;
}

// ─── GoDaddy Helper: JS-based form fill and submit ───────────────────
async function godaddyJSLogin(page: Page, email: string, password: string): Promise<boolean> {
  return await page.evaluate(({ email, password }) => {
    // Find and fill email
    const emailInput = document.querySelector('#username, input[name="username"], input[type="email"]') as HTMLInputElement;
    if (!emailInput) return false;
    emailInput.focus();
    emailInput.value = '';
    // Use native input setter to trigger React/Angular change detection
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
    if (nativeInputValueSetter) {
      nativeInputValueSetter.call(emailInput, email);
    } else {
      emailInput.value = email;
    }
    emailInput.dispatchEvent(new Event('input', { bubbles: true }));
    emailInput.dispatchEvent(new Event('change', { bubbles: true }));

    // Find and fill password
    const pwInput = document.querySelector('#password, input[type="password"]') as HTMLInputElement;
    if (pwInput) {
      pwInput.focus();
      if (nativeInputValueSetter) {
        nativeInputValueSetter.call(pwInput, password);
      } else {
        pwInput.value = password;
      }
      pwInput.dispatchEvent(new Event('input', { bubbles: true }));
      pwInput.dispatchEvent(new Event('change', { bubbles: true }));
    }

    // Click submit via JS (bypasses overlay interception)
    const submitBtn = document.querySelector('button[type="submit"]') as HTMLButtonElement;
    if (submitBtn) {
      submitBtn.click();
      return true;
    }

    // Fallback: submit the form directly
    const form = document.querySelector('form');
    if (form) {
      form.submit();
      return true;
    }
    return false;
  }, { email, password });
}

// ─── GoDaddy ──────────────────────────────────────────────────────────
async function automateGoDaddy(page: Page, email: string, password: string, captchaConfig: CaptchaConfig, onStatus: StatusCallback): Promise<AutomationResult> {
  await onStatus("logging_in", "Setting up anti-bot measures for GoDaddy...");

  // CRITICAL: Set up Akamai script blocking and overlay killer BEFORE navigating
  await setupGoDaddyAntiBot(page);

  await onStatus("logging_in", "Navigating to GoDaddy login...");
  await safeGoto(page, "https://sso.godaddy.com/?realm=idp&app=dcc&path=%2F");
  await humanDelay(3000, 5000);

  // Dismiss any overlays that slipped through
  await dismissGoDaddyOverlays(page);
  await humanDelay(1000, 2000);

  // Check if login form exists
  const hasForm = await page.evaluate(() => {
    return !!document.querySelector('#username, input[name="username"], input[type="email"]');
  });

  if (!hasForm) {
    // Try reloading — the blocked scripts may have prevented the page from rendering
    await onStatus("logging_in", "Reloading page to get login form...");
    // Temporarily unblock routes to let the page load properly
    await page.unrouteAll();
    await safeGoto(page, "https://sso.godaddy.com/?realm=idp&app=dcc&path=%2F");
    await humanDelay(3000, 5000);
    await dismissGoDaddyOverlays(page);
    await humanDelay(1000, 2000);
  }

  // Login using multiple strategies in sequence
  let loginSuccess = false;
  await onStatus("logging_in", "Filling GoDaddy login form...");

  // Strategy 1: Pure JavaScript form fill (bypasses ALL overlays)
  loginSuccess = await godaddyJSLogin(page, email, password);
  if (loginSuccess) {
    await onStatus("logging_in", "Login form submitted via JS injection...");
  }

  if (!loginSuccess) {
    // Strategy 2: Dismiss overlays then use Playwright native
    await onStatus("logging_in", "Trying native Playwright interaction...");
    await dismissGoDaddyOverlays(page);
    await humanDelay(500, 1000);
    try {
      await page.waitForSelector('#username, input[name="username"], input[type="email"]', { timeout: 5000 });
      await humanType(page, '#username, input[name="username"], input[type="email"]', email);
      await humanDelay(500, 1000);
      // GoDaddy sometimes has a "Next" button before password
      try {
        await humanClick(page, 'button:has-text("Next"), button[type="submit"]');
        await humanDelay(2000, 3000);
      } catch { /* single-page login */ }
      await page.waitForSelector('#password, input[type="password"]', { timeout: 5000 });
      await humanType(page, '#password, input[type="password"]', password);
      await humanDelay(500, 1000);
      await humanClick(page, 'button[type="submit"], button:has-text("Sign In"), button:has-text("Anmelden")');
      loginSuccess = true;
    } catch { /* fall through to strategy 3 */ }
  }

  if (!loginSuccess) {
    // Strategy 3: Keyboard-only navigation
    await onStatus("logging_in", "Trying keyboard-based login...");
    await page.keyboard.press('Tab');
    await humanDelay(200, 500);
    for (const char of email) {
      await page.keyboard.type(char, { delay: 50 + Math.random() * 100 });
    }
    await page.keyboard.press('Tab');
    await humanDelay(200, 500);
    for (const char of password) {
      await page.keyboard.type(char, { delay: 50 + Math.random() * 100 });
    }
    await page.keyboard.press('Enter');
    loginSuccess = true;
  }

  if (!loginSuccess) {
    const screenshot = await takeScreenshot(page, "godaddy_login_failed");
    return { success: false, credentials: [], error: "GoDaddy login failed: could not interact with form", screenshotPath: screenshot };
  }

  await humanDelay(5000, 8000);

  // Post-login: check if we actually logged in
  await dismissGoDaddyOverlays(page);
  const currentUrl = page.url();
  await onStatus("logging_in", `Post-login URL: ${currentUrl}`);

  // Check for error messages
  const loginError = await page.evaluate(() => {
    const errorEl = document.querySelector('[class*="error"], [class*="alert"], [role="alert"]');
    return errorEl?.textContent?.trim() || null;
  });

  if (loginError && (loginError.toLowerCase().includes('invalid') || loginError.toLowerCase().includes('incorrect'))) {
    return { success: false, credentials: [], error: `GoDaddy login failed: ${loginError}` };
  }

  // Check for bot protection post-login
  const postBot = await detectBotProtection(page);
  if (postBot.detected) {
    await onStatus("captcha_wait", "Post-login bot protection detected. Attempting bypass...");
    await dismissGoDaddyOverlays(page);
    await humanDelay(1000, 2000);

    if (captchaConfig.service && captchaConfig.apiKey) {
      const result = await detectAndSolveCaptcha(page, captchaConfig);
      if (!result.solved) {
        await page.reload({ waitUntil: 'domcontentloaded' });
        await humanDelay(3000, 5000);
        await dismissGoDaddyOverlays(page);
      }
    } else {
      // Try reload + dismiss as last resort
      await page.reload({ waitUntil: 'domcontentloaded' });
      await humanDelay(3000, 5000);
      await dismissGoDaddyOverlays(page);
    }
  }

  await onStatus("navigating", "Navigating to GoDaddy Developer Keys...");
  await safeGoto(page, "https://developer.godaddy.com/keys");
  await humanDelay(3000, 5000);

  await onStatus("extracting", "Extracting GoDaddy API keys...");

  // Look for existing keys
  const keys = await page.evaluate(() => {
    const results: { key: string; secret: string; name: string }[] = [];
    // Look for key/secret pairs in tables or lists
    document.querySelectorAll("table tbody tr, [class*='key-row'], .api-key").forEach((row) => {
      const cells = row.querySelectorAll("td, span, div");
      const texts = Array.from(cells).map((c) => c.textContent?.trim() || "");
      const keyLike = texts.find((t) => t.length > 20 && /^[a-zA-Z0-9_]+$/.test(t));
      if (keyLike) {
        results.push({ key: keyLike, secret: "", name: texts[0] || "API Key" });
      }
    });
    // Also check for displayed key/secret
    document.querySelectorAll("code, pre, input[readonly]").forEach((el) => {
      const text = el.textContent?.trim() || (el as HTMLInputElement).value?.trim() || "";
      if (text.length > 15 && /^[a-zA-Z0-9_]+$/.test(text)) {
        results.push({ key: text, secret: "", name: "Key" });
      }
    });
    return results;
  });

  if (keys.length > 0) {
    const credentials: ProviderCredential[] = [];
    for (const k of keys) {
      credentials.push({ keyType: "api_key", value: k.key, label: `GoDaddy ${k.name}` });
      if (k.secret) {
        credentials.push({ keyType: "api_secret", value: k.secret, label: `GoDaddy ${k.name} Secret` });
      }
    }
    return { success: true, credentials };
  }

  // Try to create a new key
  try {
    await humanClick(page, 'button:has-text("Create"), a:has-text("Create"), button:has-text("New")');
    await humanDelay(3000, 5000);

    // Select Production environment if available
    try {
      await humanClick(page, 'select option[value="production"], input[value="production"], label:has-text("Production")');
      await humanDelay(1000, 2000);
    } catch { /* */ }

    // Submit creation form
    try {
      await humanClick(page, 'button[type="submit"], button:has-text("Next"), button:has-text("Create")');
      await humanDelay(3000, 5000);
    } catch { /* */ }

    // Extract new key and secret
    const newCreds = await page.evaluate(() => {
      const elements = document.querySelectorAll("code, pre, input[readonly], [class*='key'], [class*='secret']");
      const values: string[] = [];
      elements.forEach((el) => {
        const text = el.textContent?.trim() || (el as HTMLInputElement).value?.trim() || "";
        if (text.length > 10 && /^[a-zA-Z0-9_\-]+$/.test(text)) {
          values.push(text);
        }
      });
      return values;
    });

    if (newCreds.length > 0) {
      const credentials: ProviderCredential[] = [];
      credentials.push({ keyType: "api_key", value: newCreds[0], label: "GoDaddy New API Key" });
      if (newCreds.length > 1) {
        credentials.push({ keyType: "api_secret", value: newCreds[1], label: "GoDaddy New API Secret" });
      }
      return { success: true, credentials };
    }
  } catch { /* */ }

  const screenshot = await takeScreenshot(page, "godaddy_keys_page");
  return { success: false, credentials: [], error: "Could not extract or create GoDaddy API keys", screenshotPath: screenshot };
}

// ─── GitHub ───────────────────────────────────────────────────────────
async function automateGitHub(page: Page, email: string, password: string, captchaConfig: CaptchaConfig, onStatus: StatusCallback): Promise<AutomationResult> {
  await onStatus("logging_in", "Logging into GitHub...");
  await loginWithBotCheck(page, "https://github.com/login", '#login_field', '#password', 'input[type="submit"]', email, password, captchaConfig, onStatus);

  await onStatus("navigating", "Navigating to GitHub tokens page...");
  await safeGoto(page, "https://github.com/settings/tokens");
  await humanDelay(3000, 5000);

  await onStatus("extracting", "Extracting GitHub tokens...");

  // Try to generate a new fine-grained token
  try {
    await safeGoto(page, "https://github.com/settings/personal-access-tokens/new");
    await humanDelay(2000, 3000);

    // Fill token name
    await humanType(page, 'input[name="token_name"], #token-name, input[placeholder*="name"]', `fetcher-${Date.now()}`);
    await humanDelay(500, 1000);

    // Set expiration (30 days)
    try {
      await humanClick(page, 'select[name="expiration"], #expiration');
      await humanDelay(500);
      await page.selectOption('select[name="expiration"], #expiration', "30");
    } catch { /* use default */ }

    // Generate
    await humanClick(page, 'button:has-text("Generate token"), button[type="submit"]');
    await humanDelay(3000, 5000);

    const token = await page.evaluate(() => {
      const el = document.querySelector('code, #new-oauth-token, [class*="token"], pre');
      return el?.textContent?.trim() || null;
    });

    if (token && token.startsWith("ghp_")) {
      return { success: true, credentials: [{ keyType: "personal_access_token", value: token, label: "GitHub PAT" }] };
    }
  } catch { /* */ }

  // Check for existing tokens
  const existingTokens = await page.evaluate(() => {
    const results: string[] = [];
    document.querySelectorAll("code, [class*='token']").forEach((el) => {
      const text = el.textContent?.trim() || "";
      if (text.startsWith("ghp_") || text.startsWith("github_pat_")) {
        results.push(text);
      }
    });
    return results;
  });

  if (existingTokens.length > 0) {
    return { success: true, credentials: existingTokens.map((t) => ({ keyType: "personal_access_token", value: t, label: "GitHub Token" })) };
  }

  return { success: false, credentials: [], error: "Could not extract or create GitHub tokens" };
}

// ─── AWS ──────────────────────────────────────────────────────────────
async function automateAWS(page: Page, email: string, password: string, captchaConfig: CaptchaConfig, onStatus: StatusCallback): Promise<AutomationResult> {
  await onStatus("logging_in", "Logging into AWS...");
  await safeGoto(page, "https://signin.aws.amazon.com/signin");
  await humanDelay(2000, 4000);

  // AWS has a multi-step login
  try {
    await humanType(page, '#resolving_input, input[name="email"], input[type="email"]', email);
    await humanClick(page, '#next_button, button:has-text("Next")');
    await humanDelay(2000, 3000);

    await humanType(page, '#password, input[type="password"]', password);
    await humanClick(page, '#signin_button, button[type="submit"]');
    await humanDelay(4000, 6000);
  } catch (err) {
    return { success: false, credentials: [], error: `AWS login failed: ${err}` };
  }

  await onStatus("navigating", "Navigating to AWS Security Credentials...");
  await safeGoto(page, "https://console.aws.amazon.com/iam/home#/security_credentials");
  await humanDelay(3000, 5000);

  await onStatus("extracting", "Extracting AWS access keys...");

  // Try to create new access key
  try {
    await humanClick(page, 'button:has-text("Create access key"), button:has-text("Create")');
    await humanDelay(3000, 5000);

    const creds = await page.evaluate(() => {
      const accessKeyEl = document.querySelector('[data-testid="access-key"], #accessKey, code');
      const secretKeyEl = document.querySelector('[data-testid="secret-key"], #secretKey');
      return {
        accessKey: accessKeyEl?.textContent?.trim() || "",
        secretKey: secretKeyEl?.textContent?.trim() || "",
      };
    });

    if (creds.accessKey) {
      const credentials: ProviderCredential[] = [
        { keyType: "access_key_id", value: creds.accessKey, label: "AWS Access Key ID" },
      ];
      if (creds.secretKey) {
        credentials.push({ keyType: "secret_access_key", value: creds.secretKey, label: "AWS Secret Access Key" });
      }
      return { success: true, credentials };
    }
  } catch { /* */ }

  return { success: false, credentials: [], error: "Could not extract AWS credentials" };
}

// ─── Stripe ───────────────────────────────────────────────────────────
async function automateStripe(page: Page, email: string, password: string, captchaConfig: CaptchaConfig, onStatus: StatusCallback): Promise<AutomationResult> {
  await onStatus("logging_in", "Logging into Stripe...");
  await loginWithBotCheck(page, "https://dashboard.stripe.com/login", '#email', '#old-password, #password', 'button[type="submit"]', email, password, captchaConfig, onStatus);

  await onStatus("navigating", "Navigating to Stripe API keys...");
  await safeGoto(page, "https://dashboard.stripe.com/apikeys");
  await humanDelay(3000, 5000);

  await onStatus("extracting", "Extracting Stripe API keys...");

  const keys = await page.evaluate(() => {
    const results: { type: string; value: string }[] = [];
    // Look for publishable and secret keys
    document.querySelectorAll('[class*="key"], code, input[readonly]').forEach((el) => {
      const text = el.textContent?.trim() || (el as HTMLInputElement).value?.trim() || "";
      if (text.startsWith("pk_")) {
        results.push({ type: "publishable_key", value: text });
      } else if (text.startsWith("sk_")) {
        results.push({ type: "secret_key", value: text });
      }
    });
    return results;
  });

  if (keys.length > 0) {
    return { success: true, credentials: keys.map((k) => ({ keyType: k.type, value: k.value, label: `Stripe ${k.type}` })) };
  }

  // Try reveal button
  try {
    await humanClick(page, 'button:has-text("Reveal"), button:has-text("Show")');
    await humanDelay(2000, 3000);
    const revealed = await page.evaluate(() => {
      const els = document.querySelectorAll("code, [class*='key']");
      const results: { type: string; value: string }[] = [];
      els.forEach((el) => {
        const text = el.textContent?.trim() || "";
        if (text.startsWith("sk_")) results.push({ type: "secret_key", value: text });
        if (text.startsWith("pk_")) results.push({ type: "publishable_key", value: text });
      });
      return results;
    });
    if (revealed.length > 0) {
      return { success: true, credentials: revealed.map((k) => ({ keyType: k.type, value: k.value, label: `Stripe ${k.type}` })) };
    }
  } catch { /* */ }

  return { success: false, credentials: [], error: "Could not extract Stripe API keys" };
}

// ═══════════════════════════════════════════════════════════════════════
// PROVIDER DISPATCH
// ═══════════════════════════════════════════════════════════════════════

export async function automateProvider(
  page: Page,
  providerId: string,
  email: string,
  password: string,
  captchaConfig: CaptchaConfig,
  onStatus: StatusCallback,
  providerConfig: { name: string; loginUrl: string; keysUrl: string; keyTypes: string[] }
): Promise<AutomationResult> {
  switch (providerId) {
    case "openai":
      return automateOpenAI(page, email, password, captchaConfig, onStatus);
    case "anthropic":
      return automateAnthropic(page, email, password, captchaConfig, onStatus);
    case "godaddy":
      return automateGoDaddy(page, email, password, captchaConfig, onStatus);
    case "github":
      return automateGitHub(page, email, password, captchaConfig, onStatus);
    case "aws":
      return automateAWS(page, email, password, captchaConfig, onStatus);
    case "stripe":
      return automateStripe(page, email, password, captchaConfig, onStatus);
    default:
      // Use generic automation for all other providers
      return automateGeneric(
        page,
        email,
        password,
        captchaConfig,
        onStatus,
        providerConfig.name,
        providerConfig.loginUrl,
        providerConfig.keysUrl,
        providerConfig.keyTypes
      );
  }
}
