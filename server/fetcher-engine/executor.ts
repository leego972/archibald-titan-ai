/**
 * Job Executor
 * Orchestrates the browser automation for each fetch job.
 * Launches a stealth browser with automatic proxy selection from the pool,
 * iterates through tasks, runs provider automation, stores credentials,
 * and handles errors/kill switch.
 */
import type { Browser } from "playwright";
import {
  launchStealthBrowser,
  takeScreenshot,
  humanDelay,
  type BrowserConfig,
} from "./browser";
import { automateProvider } from "./providers";
import type { CaptchaConfig, CaptchaService } from "./captcha-solver";
import {
  getJobTasks,
  updateJobStatus,
  updateTaskStatus,
  incrementJobCompleted,
  incrementJobFailed,
  storeCredential,
  isKillSwitchActive,
  getSettings,
  decrypt,
  getJob,
} from "../fetcher-db";
import { PROVIDERS } from "../../shared/fetcher";
import {
  selectProxyForProvider,
  recordProxyResult,
  PROVIDER_PROXY_REQUIREMENTS,
} from "./proxy-manager";
import {
  checkCircuit,
  recordCircuitSuccess,
  recordCircuitFailure,
  classifyError,
  isRetryable,
  calculateRetryDelay,
  incrementActiveJobs,
  decrementActiveJobs,
} from "./safety-engine";

// Track running jobs so kill switch can abort them
const runningJobs = new Map<number, { abort: boolean }>();

export function abortJob(jobId: number): void {
  const job = runningJobs.get(jobId);
  if (job) job.abort = true;
}

export function isJobRunning(jobId: number): boolean {
  return runningJobs.has(jobId);
}

/**
 * Execute a fetch job with real browser automation.
 * Now with automatic proxy pool selection per provider.
 */
export async function executeJob(jobId: number, userId: number): Promise<void> {
  const jobControl = { abort: false };
  runningJobs.set(jobId, jobControl);
  incrementActiveJobs(userId);

  let browser: Browser | null = null;

  try {
    // Check kill switch
    const killed = await isKillSwitchActive(userId);
    if (killed) {
      await updateJobStatus(jobId, "cancelled");
      decrementActiveJobs(userId);
      return;
    }

    // Get user settings for CAPTCHA config and legacy proxy fallback
    const settings = await getSettings(userId);
    const job = await getJob(jobId, userId);
    if (!job) {
      await updateJobStatus(jobId, "failed");
      return;
    }

    // Decrypt the stored password
    const password = decrypt(job.encryptedPassword);

    // Build CAPTCHA config
    const captchaConfig: CaptchaConfig = {
      service: (settings.captchaService as CaptchaService) || null,
      apiKey: settings.captchaApiKey || "",
    };

    // Mark job as running
    await updateJobStatus(jobId, "running");

    // Get tasks
    const tasks = await getJobTasks(jobId);

    for (const task of tasks) {
      // Check kill switch and abort flag before each task
      if (jobControl.abort) {
        await updateTaskStatus(task.id, "failed", "Job aborted by user");
        await incrementJobFailed(jobId);
        continue;
      }

      const stillKilled = await isKillSwitchActive(userId);
      if (stillKilled) {
        await updateTaskStatus(task.id, "failed", "Kill switch activated");
        await incrementJobFailed(jobId);
        continue;
      }

      // Launch a fresh browser for each provider (clean session)
      let selectedProxyId: number | null = null;

      try {
        // ─── Circuit Breaker Check ────────────────────────────────
        const circuitCheck = checkCircuit(task.providerId);
        if (!circuitCheck.allowed) {
          console.warn(`[Fetcher] Task ${task.id}: Circuit breaker tripped — ${circuitCheck.reason}`);
          await updateTaskStatus(task.id, "failed", `Skipped: ${circuitCheck.reason}`);
          await incrementJobFailed(jobId);
          continue;
        }

        // ─── Proxy Selection from Pool ─────────────────────────────
        const proxySelection = await selectProxyForProvider(userId, task.providerId);
        const requirement = PROVIDER_PROXY_REQUIREMENTS[task.providerId];

        // Build browser config with proxy from pool
        const browserConfig: BrowserConfig = {
          headless: settings.headless === 1,
        };

        if (proxySelection.proxyConfig) {
          // Use proxy from pool
          browserConfig.proxy = proxySelection.proxyConfig;
          selectedProxyId = proxySelection.proxy?.id ?? null;
          console.log(`[Fetcher] Task ${task.id}: ${proxySelection.reason}`);
          await updateTaskStatus(task.id, "queued", `Proxy: ${proxySelection.reason}`);
        } else if (settings.proxyServer) {
          // Fallback to legacy single-proxy from settings
          browserConfig.proxy = {
            server: settings.proxyServer,
            username: settings.proxyUsername || undefined,
            password: settings.proxyPassword || undefined,
          };
          console.log(`[Fetcher] Task ${task.id}: Using legacy proxy from settings`);
        } else if (requirement?.requiresProxy) {
          // Provider requires proxy but none available — fail early with helpful message
          const errorMsg = `${task.providerName} requires a residential proxy to bypass bot detection (${requirement.reason}). ` +
            `Please add a residential proxy in Settings → Proxies, then retry.`;
          console.warn(`[Fetcher] Task ${task.id}: ${errorMsg}`);
          await updateTaskStatus(task.id, "failed", errorMsg);
          await incrementJobFailed(jobId);
          continue;
        } else {
          console.log(`[Fetcher] Task ${task.id}: No proxy configured, using direct connection`);
        }

        const { browser: b, context, page, profile } = await launchStealthBrowser(browserConfig);
        browser = b;

        console.log(`[Fetcher] Task ${task.id}: Automating ${task.providerName} with profile ${profile.name}`);

        const provider = PROVIDERS[task.providerId];
        if (!provider) {
          await updateTaskStatus(task.id, "failed", `Unknown provider: ${task.providerId}`);
          await incrementJobFailed(jobId);
          await browser.close();
          browser = null;
          continue;
        }

        // Status callback to update task status in real-time
        const onStatus = async (status: string, message: string) => {
          await updateTaskStatus(task.id, status, message);
        };

        // Run the provider automation
        const result = await automateProvider(
          page,
          task.providerId,
          job.email,
          password,
          captchaConfig,
          onStatus,
          {
            name: provider.name,
            loginUrl: provider.loginUrl,
            keysUrl: provider.keysUrl,
            keyTypes: provider.keyTypes,
          }
        );

        if (result.success && result.credentials.length > 0) {
          // Store each extracted credential
          for (const cred of result.credentials) {
            await storeCredential(
              userId,
              jobId,
              task.id,
              task.providerId,
              task.providerName,
              cred.keyType,
              cred.value,
              cred.label
            );
          }
          await updateTaskStatus(task.id, "completed", `Extracted ${result.credentials.length} credential(s)`);
          await incrementJobCompleted(jobId);

          // Record circuit breaker success
          recordCircuitSuccess(task.providerId);

          // Record proxy success
          if (selectedProxyId) {
            await recordProxyResult(selectedProxyId, true);
          }
        } else {
          // Take a screenshot for debugging
          const screenshotPath = result.screenshotPath || await takeScreenshot(page, `${task.providerId}_failed`);
          await updateTaskStatus(
            task.id,
            "failed",
            result.error || "Failed to extract credentials"
          );
          await incrementJobFailed(jobId);

          // Record proxy failure (only if the error seems proxy-related)
          if (selectedProxyId && isProxyRelatedError(result.error)) {
            await recordProxyResult(selectedProxyId, false);
          }
        }

        // Close browser after each provider
        await browser.close();
        browser = null;

        // Delay between providers to avoid rate limiting
        await humanDelay(3000, 6000);
      } catch (err) {
        const errorCategory = classifyError(err);
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.error(`[Fetcher] Task ${task.id} error (${errorCategory}):`, errorMsg);

        // Record circuit breaker failure
        recordCircuitFailure(task.providerId, errorCategory);

        // Determine if we should retry this task
        if (isRetryable(errorCategory) && !jobControl.abort) {
          const retryDelay = calculateRetryDelay(0, errorCategory);
          console.log(`[Fetcher] Task ${task.id}: Retryable error (${errorCategory}), waiting ${Math.round(retryDelay)}ms before continuing`);
          await updateTaskStatus(
            task.id,
            "failed",
            `${errorCategory} error: ${errorMsg} (circuit breaker tracking)`
          );
        } else {
          await updateTaskStatus(
            task.id,
            "failed",
            `Permanent error (${errorCategory}): ${errorMsg}`
          );
        }
        await incrementJobFailed(jobId);

        // Record proxy failure for connection-level errors
        if (selectedProxyId) {
          await recordProxyResult(selectedProxyId, false);
        }

        if (browser) {
          try { await browser.close(); } catch { /* */ }
          browser = null;
        }
      }
    }

    // Determine final job status
    const updatedTasks = await getJobTasks(jobId);
    const allDone = updatedTasks.every(
      (t) => t.status === "completed" || t.status === "failed"
    );
    const anyCompleted = updatedTasks.some((t) => t.status === "completed");
    const allFailed = updatedTasks.every((t) => t.status === "failed");

    if (allDone) {
      if (allFailed) {
        await updateJobStatus(jobId, "failed");
      } else {
        await updateJobStatus(jobId, "completed");
      }
    }
  } catch (err) {
    console.error(`[Fetcher] Job ${jobId} fatal error:`, err);
    await updateJobStatus(jobId, "failed");
  } finally {
    if (browser !== null) {
      try { await (browser as Browser).close(); } catch { /* */ }
    }
    runningJobs.delete(jobId);
    decrementActiveJobs(userId);
  }
}

/**
 * Check if an error message suggests a proxy-related issue
 * (connection timeout, bot detection, IP blocking, etc.)
 */
function isProxyRelatedError(error?: string): boolean {
  if (!error) return false;
  const proxyIndicators = [
    "bot protection",
    "bot detection",
    "akamai",
    "cloudflare",
    "blocked",
    "captcha",
    "timeout",
    "connection refused",
    "ECONNREFUSED",
    "ECONNRESET",
    "ETIMEDOUT",
    "proxy",
    "network error",
    "seltsam", // German for "strange" — GoDaddy's bot message
  ];
  const lower = error.toLowerCase();
  return proxyIndicators.some(indicator => lower.includes(indicator.toLowerCase()));
}
