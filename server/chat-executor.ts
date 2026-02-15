/**
 * Chat Tool Executor — Executes LLM tool calls against real backend data.
 *
 * Each function here maps a tool name to a real database query or action.
 * The executor receives the parsed arguments from the LLM and returns
 * a JSON-serializable result that gets fed back to the LLM as a tool response.
 */

import { getDb } from "./db";
import {
  fetcherJobs,
  fetcherTasks,
  fetcherCredentials,
  fetcherSettings,
  fetcherProxies,
  fetcherKillSwitch,
  apiKeys,
  teamMembers,
  users,
  credentialWatches,
  bulkSyncJobs,
  syncSchedules,
  leakScans,
  leakFindings,
  vaultItems,
  vaultAccessLog,
  providerHealthSnapshots,
  fetchRecommendations,
  auditLogs,
  builderActivityLog,
} from "../drizzle/schema";
import { eq, and, desc, isNull, sql, gte } from "drizzle-orm";
import { PROVIDERS } from "../shared/fetcher";
import {
  getDecryptedCredentials,
  exportCredentials as exportCredsDb,
  getCredentials,
  getJobs,
  getJob,
  getJobTasks,
  activateKillSwitch as activateKS,
  encrypt,
  decrypt,
} from "./fetcher-db";
import { getUserPlan } from "./subscription-gate";
import {
  readFile as selfReadFileImpl,
  listFiles as selfListFilesImpl,
  applyModifications,
  runHealthCheck,
  runQuickHealthCheck,
  runTypeCheck,
  runTests,
  rollbackToSnapshot,
  rollbackToLastGood,
  requestRestart,
  getModificationHistory,
  getProtectedFiles,
  getAllowedDirectories,
  validateModifications,
} from "./self-improvement-engine";
import { queryAuditLogs } from "./audit-log-db";
import { logAudit } from "./audit-log-db";
import { callDataApi } from "./_core/dataApi";
import crypto from "crypto";

// ─── Types ──────────────────────────────────────────────────────────

export interface ToolExecutionResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

// ─── Main Executor ──────────────────────────────────────────────────

export async function executeToolCall(
  toolName: string,
  args: Record<string, unknown>,
  userId: number,
  userName?: string,
  userEmail?: string
): Promise<ToolExecutionResult> {
  try {
    switch (toolName) {
      // ── Credentials & Fetching ──────────────────────────────────
  
    // ─── Navigation ────────────────────────────────────────────────
    case "navigate_to_page": {
      const page = args.page as string;
      const reason = args.reason as string;
      if (!page) return { success: false, error: "Page path is required" };
      
      // Normalize the path
      const normalizedPath = page.startsWith("/") ? page : `/${page}`;
      
      // Validate against known pages
      const validPages = [
        "/dashboard", "/fetcher/new", "/fetcher/jobs", "/fetcher/credentials",
        "/fetcher/export", "/fetcher/api-access", "/fetcher/smart-fetch",
        "/fetcher/watchdog", "/fetcher/provider-health", "/fetcher/health-trends",
        "/fetcher/leak-scanner", "/fetcher/bulk-sync", "/fetcher/auto-sync",
        "/fetcher/onboarding", "/fetcher/team", "/fetcher/team-vault",
        "/fetcher/history", "/fetcher/audit-logs", "/fetcher/developer-docs",
        "/fetcher/webhooks", "/fetcher/api-analytics", "/fetcher/account",
        "/fetcher/settings", "/fetcher/killswitch", "/fetcher/releases",
        "/fetcher/admin", "/fetcher/self-improvement", "/pricing", "/contact",
      ];
      
      if (!validPages.includes(normalizedPath)) {
        return { success: false, error: `Unknown page: ${page}. Valid pages: ${validPages.join(", ")}` };
      }
      
      return {
        success: true,
        data: {
          action: "navigate",
          path: normalizedPath,
          reason: reason || "Navigate to page",
          message: `Navigate to [${normalizedPath}](${normalizedPath}): ${reason || ""}`
        },
      };
    }

    // ─── Web Research ──────────────────────────────────────────────
    case "web_search": {
      const query = args.query as string;
      if (!query) return { success: false, error: "Search query is required" };
      try {
        // Use DuckDuckGo HTML search as a simple, free search API
        const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
        const resp = await fetch(searchUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          },
        });
        const html = await resp.text();
        // Parse results from DuckDuckGo HTML
        const results: Array<{ title: string; url: string; snippet: string }> = [];
        const resultRegex = /<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;
        let match;
        let count = 0;
        while ((match = resultRegex.exec(html)) !== null && count < 8) {
          const rawUrl = match[1];
          const title = match[2].replace(/<[^>]*>/g, "").trim();
          const snippet = match[3].replace(/<[^>]*>/g, "").trim();
          // DuckDuckGo wraps URLs in a redirect - extract the actual URL
          let url = rawUrl;
          const uddgMatch = rawUrl.match(/uddg=([^&]*)/);
          if (uddgMatch) {
            url = decodeURIComponent(uddgMatch[1]);
          }
          if (title && url) {
            results.push({ title, url, snippet });
            count++;
          }
        }
        // Fallback: try simpler regex if the above didn't match
        if (results.length === 0) {
          const simpleRegex = /<a[^>]*class="result__a"[^>]*>([\s\S]*?)<\/a>/g;
          const snippetRegex = /<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;
          const urlRegex = /<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*/g;
          const titles: string[] = [];
          const urls: string[] = [];
          const snippets: string[] = [];
          let m;
          while ((m = simpleRegex.exec(html)) !== null) titles.push(m[1].replace(/<[^>]*>/g, "").trim());
          while ((m = urlRegex.exec(html)) !== null) {
            let u = m[1];
            const uddg = u.match(/uddg=([^&]*)/);
            if (uddg) u = decodeURIComponent(uddg[1]);
            urls.push(u);
          }
          while ((m = snippetRegex.exec(html)) !== null) snippets.push(m[1].replace(/<[^>]*>/g, "").trim());
          for (let i = 0; i < Math.min(titles.length, urls.length, 8); i++) {
            results.push({ title: titles[i], url: urls[i], snippet: snippets[i] || "" });
          }
        }
        if (results.length === 0) {
          return { success: true, data: { message: "No results found. Try a different search query.", query } };
        }
        return { success: true, data: { query, resultCount: results.length, results } };
      } catch (err: any) {
        return { success: false, error: `Search failed: ${err.message}` };
      }
    }

    case "web_page_read": {
      const url = args.url as string;
      if (!url) return { success: false, error: "URL is required" };
      try {
        const resp = await fetch(url, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          },
          signal: AbortSignal.timeout(15000),
        });
        if (!resp.ok) {
          return { success: false, error: `Failed to fetch page: ${resp.status} ${resp.statusText}` };
        }
        const html = await resp.text();
        // Extract title
        const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
        const title = titleMatch ? titleMatch[1].replace(/<[^>]*>/g, "").trim() : "Untitled";
        // Remove script, style, nav, header, footer tags
        let text = html
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
          .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, "")
          .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, "")
          .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, "")
          .replace(/<[^>]*>/g, " ")
          .replace(/&nbsp;/g, " ")
          .replace(/&amp;/g, "&")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/\s+/g, " ")
          .trim();
        // Truncate to ~4000 chars to fit in context
        if (text.length > 4000) {
          text = text.substring(0, 4000) + "... [truncated]";
        }
        return { success: true, data: { title, url, contentLength: text.length, content: text } };
      } catch (err: any) {
        return { success: false, error: `Failed to read page: ${err.message}` };
      }
    }

    case "list_credentials":
        return await execListCredentials(userId);

      case "reveal_credential":
        return await execRevealCredential(userId, args.credentialId as number);

      case "export_credentials":
        return await execExportCredentials(userId, args.format as string);

      case "create_fetch_job":
        return await execCreateFetchJob(userId, args.providerIds as string[]);

      case "list_jobs":
        return await execListJobs(userId);

      case "get_job_details":
        return await execGetJobDetails(userId, args.jobId as number);

      case "list_providers":
        return execListProviders();

      // ── API Keys ────────────────────────────────────────────────
      case "list_api_keys":
        return await execListApiKeys(userId);

      case "create_api_key":
        return await execCreateApiKey(userId, args as any, userName, userEmail);

      case "revoke_api_key":
        return await execRevokeApiKey(userId, args.keyId as number, userName, userEmail);

      // ── Leak Scanner ────────────────────────────────────────────
      case "start_leak_scan":
        return await execStartLeakScan(userId);

      case "get_leak_scan_results":
        return await execGetLeakScanResults(userId);

      // ── Vault ───────────────────────────────────────────────────
      case "list_vault_entries":
        return await execListVaultEntries(userId);

      case "add_vault_entry":
        return await execAddVaultEntry(userId, args as any, userName);

      // ── Bulk Sync ───────────────────────────────────────────────
      case "trigger_bulk_sync":
        return await execTriggerBulkSync(userId, args.providerIds as string[] | undefined);

      case "get_bulk_sync_status":
        return await execGetBulkSyncStatus(userId);

      // ── Team ────────────────────────────────────────────────────
      case "list_team_members":
        return await execListTeamMembers(userId);

      case "add_team_member":
        return await execAddTeamMember(userId, args as any, userName, userEmail);

      case "remove_team_member":
        return await execRemoveTeamMember(userId, args.memberId as number, userName, userEmail);

      case "update_team_member_role":
        return await execUpdateTeamMemberRole(userId, args as any, userName, userEmail);

      // ── Scheduler ───────────────────────────────────────────────
      case "list_schedules":
        return await execListSchedules(userId);

      case "create_schedule":
        return await execCreateSchedule(userId, args as any);

      case "delete_schedule":
        return await execDeleteSchedule(userId, args.scheduleId as number);

      // ── Watchdog ────────────────────────────────────────────────
      case "get_watchdog_summary":
        return await execGetWatchdogSummary(userId);

      // ── Provider Health ─────────────────────────────────────────
      case "check_provider_health":
        return await execCheckProviderHealth(userId);

      // ── Recommendations ─────────────────────────────────────────
      case "get_recommendations":
        return await execGetRecommendations(userId);

      // ── Audit ───────────────────────────────────────────────────
      case "get_audit_logs":
        return await execGetAuditLogs(args as any);

      // ── Kill Switch ─────────────────────────────────────────────
      case "activate_kill_switch":
        return await execActivateKillSwitch(userId, args.code as string);

      // ── System ──────────────────────────────────────────────────
      case "get_system_status":
        return await execGetSystemStatus(userId);

      case "get_plan_usage":
        return await execGetPlanUsage(userId);

      // ── Self-Improvement ────────────────────────────────────────
      case "self_read_file":
        return execSelfReadFile(args.filePath as string);

      case "self_list_files":
        return execSelfListFiles(args.dirPath as string);

      case "self_modify_file":
        return await execSelfModifyFile(userId, args as any, userName);

      case "self_health_check":
        return await execSelfHealthCheck({
          skipTests: args.skipTests as boolean | undefined,
          skipTypeCheck: args.skipTypeCheck as boolean | undefined,
        });

      case "self_rollback":
        return await execSelfRollback(userId, args.snapshotId as number | undefined, userName);

      case "self_restart":
        return await execSelfRestart(userId, args.reason as string);

      case "self_modification_history":
        return await execSelfModificationHistory(args.limit as number | undefined);

      case "self_get_protected_files":
        return execSelfGetProtectedFiles();

      // ── Builder Tools ──────────────────────────────────────────────
      case "self_type_check":
        return await execSelfTypeCheck(userId);
      case "self_run_tests":
        return await execSelfRunTests(args.testPattern as string | undefined, userId);
      case "self_multi_file_modify":
        return await execSelfMultiFileModify(userId, args.modifications as any[], userName);

      default:
        return { success: false, error: `Unknown tool: ${toolName}` };
    }
  } catch (err: any) {
    console.error(`[ChatExecutor] Error executing ${toolName}:`, err);
    return {
      success: false,
      error: err.message || `Failed to execute ${toolName}`,
    };
  }
}

// ─── Implementation Functions ────────────────────────────────────────

async function execListCredentials(userId: number): Promise<ToolExecutionResult> {
  const creds = await getCredentials(userId);
  return {
    success: true,
    data: {
      count: creds.length,
      credentials: creds.map((c: any) => ({
        id: c.id,
        provider: c.providerName || c.providerId,
        providerId: c.providerId,
        keyType: c.keyType,
        label: c.keyLabel || "—",
        createdAt: c.createdAt,
      })),
    },
  };
}

async function execRevealCredential(userId: number, credentialId: number): Promise<ToolExecutionResult> {
  const db = await getDb();
  if (!db) return { success: false, error: "Database unavailable" };

  const rows = await db
    .select()
    .from(fetcherCredentials)
    .where(and(eq(fetcherCredentials.id, credentialId), eq(fetcherCredentials.userId, userId)))
    .limit(1);

  if (rows.length === 0) {
    return { success: false, error: "Credential not found or access denied" };
  }

  const cred = rows[0];
  let value: string;
  try {
    value = decrypt(cred.encryptedValue);
  } catch {
    value = "[decryption failed]";
  }

  return {
    success: true,
    data: {
      id: cred.id,
      provider: cred.providerName,
      keyType: cred.keyType,
      label: cred.keyLabel,
      value,
    },
  };
}

async function execExportCredentials(userId: number, format: string): Promise<ToolExecutionResult> {
  if (!["json", "env", "csv"].includes(format)) {
    return { success: false, error: "Invalid format. Use: json, env, or csv" };
  }
  const data = await exportCredsDb(userId, format as "json" | "env" | "csv");
  return { success: true, data: { format, content: data } };
}

async function execCreateFetchJob(userId: number, providerIds: string[]): Promise<ToolExecutionResult> {
  if (!providerIds || providerIds.length === 0) {
    return { success: false, error: "No providers specified. Use list_providers to see available options." };
  }

  // Validate provider IDs
  const invalid = providerIds.filter((id) => !PROVIDERS[id]);
  if (invalid.length > 0) {
    return { success: false, error: `Unknown provider IDs: ${invalid.join(", ")}. Use list_providers to see valid IDs.` };
  }

  // Note: actual job creation requires email/password for the provider portals.
  // The chat assistant can't collect those securely, so we return guidance.
  return {
    success: true,
    data: {
      message: `To create a fetch job for ${providerIds.length} provider(s) (${providerIds.join(", ")}), please use the Fetcher page in the dashboard. The fetch process requires your provider login credentials which must be entered securely through the UI.`,
      providers: providerIds.map((id) => ({
        id,
        name: PROVIDERS[id]?.name || id,
        url: PROVIDERS[id]?.loginUrl || "",
      })),
      tip: "Navigate to Dashboard → Fetcher → New Fetch to start a job.",
    },
  };
}

async function execListJobs(userId: number): Promise<ToolExecutionResult> {
  const jobs = await getJobs(userId);
  return {
    success: true,
    data: {
      count: jobs.length,
      jobs: jobs.slice(0, 10).map((j: any) => ({
        id: j.id,
        status: j.status,
        completedProviders: j.completedProviders,
        totalProviders: j.totalProviders,
        failedProviders: j.failedProviders,
        completedAt: j.completedAt,
        createdAt: j.createdAt,
      })),
    },
  };
}

async function execGetJobDetails(userId: number, jobId: number): Promise<ToolExecutionResult> {
  const job = await getJob(jobId, userId);
  if (!job) return { success: false, error: "Job not found" };

  const tasks = await getJobTasks(jobId);
  return {
    success: true,
    data: {
      job: {
        id: job.id,
        status: job.status,
        completedProviders: job.completedProviders,
        totalProviders: job.totalProviders,
        failedProviders: job.failedProviders,
        completedAt: job.completedAt,
        createdAt: job.createdAt,
      },
      tasks: tasks.map((t: any) => ({
        id: t.id,
        providerId: t.providerId,
        status: t.status,
        message: t.message,
      })),
    },
  };
}

function execListProviders(): ToolExecutionResult {
  const providers = Object.values(PROVIDERS).map((p) => ({
    id: p.id,
    name: p.name,
    category: p.category,
    keyTypes: p.keyTypes,
    description: p.description,
    requiresProxy: p.requiresResidentialProxy,
  }));
  return { success: true, data: { count: providers.length, providers } };
}

async function execListApiKeys(userId: number): Promise<ToolExecutionResult> {
  const db = await getDb();
  if (!db) return { success: false, error: "Database unavailable" };

  const keys = await db
    .select({
      id: apiKeys.id,
      name: apiKeys.name,
      keyPrefix: apiKeys.keyPrefix,
      scopes: apiKeys.scopes,
      lastUsedAt: apiKeys.lastUsedAt,
      usageCount: apiKeys.usageCount,
      expiresAt: apiKeys.expiresAt,
      revokedAt: apiKeys.revokedAt,
      createdAt: apiKeys.createdAt,
    })
    .from(apiKeys)
    .where(eq(apiKeys.userId, userId))
    .orderBy(desc(apiKeys.createdAt));

  return {
    success: true,
    data: {
      count: keys.length,
      activeCount: keys.filter((k) => !k.revokedAt).length,
      keys: keys.map((k) => ({
        ...k,
        status: k.revokedAt ? "revoked" : k.expiresAt && k.expiresAt < new Date() ? "expired" : "active",
      })),
    },
  };
}

async function execCreateApiKey(
  userId: number,
  args: { name: string; scopes: string[]; expiresInDays?: number },
  userName?: string,
  userEmail?: string
): Promise<ToolExecutionResult> {
  const db = await getDb();
  if (!db) return { success: false, error: "Database unavailable" };

  // Check active key count
  const activeCount = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(apiKeys)
    .where(and(eq(apiKeys.userId, userId), isNull(apiKeys.revokedAt)));

  if (activeCount[0].count >= 10) {
    return { success: false, error: "Maximum of 10 active API keys. Revoke an existing key first." };
  }

  const raw = `at_${crypto.randomBytes(32).toString("hex")}`;
  const prefix = raw.substring(0, 11);
  const hash = crypto.createHash("sha256").update(raw).digest("hex");
  const expiresAt = args.expiresInDays
    ? new Date(Date.now() + args.expiresInDays * 24 * 60 * 60 * 1000)
    : null;

  await db.insert(apiKeys).values({
    userId,
    name: args.name,
    keyPrefix: prefix,
    keyHash: hash,
    scopes: args.scopes,
    expiresAt,
  });

  await logAudit({
    userId,
    userName: userName || undefined,
    userEmail: userEmail || undefined,
    action: "apiKey.create",
    resource: "apiKey",
    details: { name: args.name, scopes: args.scopes, source: "titan_assistant" },
  });

  return {
    success: true,
    data: {
      key: raw,
      prefix,
      name: args.name,
      scopes: args.scopes,
      expiresAt,
      warning: "This is the only time the full key will be shown. Save it securely.",
    },
  };
}

async function execRevokeApiKey(
  userId: number,
  keyId: number,
  userName?: string,
  userEmail?: string
): Promise<ToolExecutionResult> {
  const db = await getDb();
  if (!db) return { success: false, error: "Database unavailable" };

  await db
    .update(apiKeys)
    .set({ revokedAt: new Date() })
    .where(and(eq(apiKeys.id, keyId), eq(apiKeys.userId, userId)));

  await logAudit({
    userId,
    userName: userName || undefined,
    userEmail: userEmail || undefined,
    action: "apiKey.revoke",
    resource: "apiKey",
    resourceId: keyId.toString(),
    details: { source: "titan_assistant" },
  });

  return { success: true, data: { message: `API key #${keyId} has been revoked.` } };
}

async function execStartLeakScan(userId: number): Promise<ToolExecutionResult> {
  const db = await getDb();
  if (!db) return { success: false, error: "Database unavailable" };

  // Create a new scan record
  const scanId = crypto.randomUUID();
  await db.insert(leakScans).values({
    userId,
    status: "scanning",
  });

  return {
    success: true,
    data: {
      message: "Leak scan started. It will check your stored credentials against known breach databases and public code repositories.",
      tip: "Check results with get_leak_scan_results or visit the Leak Scanner page.",
    },
  };
}

async function execGetLeakScanResults(userId: number): Promise<ToolExecutionResult> {
  const db = await getDb();
  if (!db) return { success: false, error: "Database unavailable" };

  const scans = await db
    .select()
    .from(leakScans)
    .where(eq(leakScans.userId, userId))
    .orderBy(desc(leakScans.createdAt))
    .limit(5);

  if (scans.length === 0) {
    return { success: true, data: { message: "No leak scans found. Use start_leak_scan to run one." } };
  }

  const latestScan = scans[0];
  const findings = await db
    .select()
    .from(leakFindings)
    .where(eq(leakFindings.scanId, latestScan.id))
    .orderBy(desc(leakFindings.createdAt));

  return {
    success: true,
    data: {
      latestScan: {
        id: latestScan.id,
        status: latestScan.status,
        sourcesScanned: latestScan.sourcesScanned,
        leaksFound: latestScan.leaksFound,
        createdAt: latestScan.createdAt,
      },
      findings: findings.map((f: any) => ({
        id: f.id,
        severity: f.severity,
        source: f.source,
        description: f.description,
        status: f.status,
        credentialId: f.credentialId,
      })),
      totalScans: scans.length,
    },
  };
}

async function execListVaultEntries(userId: number): Promise<ToolExecutionResult> {
  const db = await getDb();
  if (!db) return { success: false, error: "Database unavailable" };

  const items = await db
    .select({
      id: vaultItems.id,
      name: vaultItems.name,
      credentialType: vaultItems.credentialType,
      createdByUserId: vaultItems.createdByUserId,
      notes: vaultItems.notes,
      createdAt: vaultItems.createdAt,
      updatedAt: vaultItems.updatedAt,
    })
    .from(vaultItems)
    .where(eq(vaultItems.teamOwnerId, userId))
    .orderBy(desc(vaultItems.createdAt));

  return {
    success: true,
    data: {
      count: items.length,
      entries: items,
    },
  };
}

async function execAddVaultEntry(
  userId: number,
  args: { name: string; value: string; category?: string; notes?: string },
  userName?: string
): Promise<ToolExecutionResult> {
  const db = await getDb();
  if (!db) return { success: false, error: "Database unavailable" };

  const encryptedValue = encrypt(args.value);

  await db.insert(vaultItems).values({
    teamOwnerId: userId,
    createdByUserId: userId,
    name: args.name,
    encryptedValue,
    credentialType: args.category || "other",
    notes: args.notes || null,
  });

  return {
    success: true,
    data: {
      message: `Vault entry "${args.name}" created successfully.`,
      category: args.category || "other",
    },
  };
}

async function execTriggerBulkSync(userId: number, providerIds?: string[]): Promise<ToolExecutionResult> {
  const db = await getDb();
  if (!db) return { success: false, error: "Database unavailable" };

  const providers = providerIds || Object.keys(PROVIDERS);
  const providerNames = providers.map((id) => PROVIDERS[id]?.name || id);

  await db.insert(bulkSyncJobs).values({
    userId,
    status: "queued",
    totalProviders: providers.length,
    completedProviders: 0,
    failedProviders: 0,
  });

  return {
    success: true,
    data: {
      message: `Bulk sync triggered for ${providers.length} providers: ${providerNames.join(", ")}.`,
      tip: "Note: Bulk sync requires saved provider credentials. Check status with get_bulk_sync_status.",
    },
  };
}

async function execGetBulkSyncStatus(userId: number): Promise<ToolExecutionResult> {
  const db = await getDb();
  if (!db) return { success: false, error: "Database unavailable" };

  const jobs = await db
    .select()
    .from(bulkSyncJobs)
    .where(eq(bulkSyncJobs.userId, userId))
    .orderBy(desc(bulkSyncJobs.createdAt))
    .limit(5);

  return {
    success: true,
    data: {
      count: jobs.length,
      jobs: jobs.map((j) => ({
        id: j.id,
        status: j.status,
        totalProviders: j.totalProviders,
        completedProviders: j.completedProviders,
        failedProviders: j.failedProviders,
        createdAt: j.createdAt,
      })),
    },
  };
}

async function execListTeamMembers(userId: number): Promise<ToolExecutionResult> {
  const db = await getDb();
  if (!db) return { success: false, error: "Database unavailable" };

  const members = await db
    .select({
      id: teamMembers.id,
      userId: teamMembers.userId,
      role: teamMembers.role,
      inviteEmail: teamMembers.inviteEmail,
      inviteStatus: teamMembers.inviteStatus,
      joinedAt: teamMembers.joinedAt,
      createdAt: teamMembers.createdAt,
      userName: users.name,
      userEmail: users.email,
    })
    .from(teamMembers)
    .leftJoin(users, eq(teamMembers.userId, users.id))
    .where(eq(teamMembers.teamOwnerId, userId))
    .orderBy(desc(teamMembers.createdAt));

  return {
    success: true,
    data: {
      count: members.length,
      members: members.map((m) => ({
        id: m.id,
        name: m.userName || m.inviteEmail || "Unknown",
        email: m.userEmail || m.inviteEmail,
        role: m.role,
        status: m.inviteStatus,
        joinedAt: m.joinedAt,
      })),
    },
  };
}

async function execAddTeamMember(
  userId: number,
  args: { email: string; role?: string },
  userName?: string,
  userEmail?: string
): Promise<ToolExecutionResult> {
  const db = await getDb();
  if (!db) return { success: false, error: "Database unavailable" };

  // Find user by email
  const targetUser = await db
    .select()
    .from(users)
    .where(eq(users.email, args.email))
    .limit(1);

  if (targetUser.length === 0) {
    return { success: false, error: `No user found with email "${args.email}". They must sign up first.` };
  }

  const target = targetUser[0];
  if (target.id === userId) {
    return { success: false, error: "You cannot add yourself to your team." };
  }

  // Check if already a member
  const existing = await db
    .select()
    .from(teamMembers)
    .where(and(eq(teamMembers.teamOwnerId, userId), eq(teamMembers.userId, target.id)))
    .limit(1);

  if (existing.length > 0) {
    return { success: false, error: "This user is already a team member." };
  }

  const role = (args.role || "member") as "admin" | "member" | "viewer";
  await db.insert(teamMembers).values({
    teamOwnerId: userId,
    userId: target.id,
    role,
    invitedByUserId: userId,
    inviteEmail: args.email,
    inviteStatus: "accepted",
  });

  await logAudit({
    userId,
    userName: userName || undefined,
    userEmail: userEmail || undefined,
    action: "team.addMember",
    resource: "teamMember",
    details: { email: args.email, role, source: "titan_assistant" },
  });

  return {
    success: true,
    data: { message: `${target.name || args.email} added to team as ${role}.` },
  };
}

async function execRemoveTeamMember(
  userId: number,
  memberId: number,
  userName?: string,
  userEmail?: string
): Promise<ToolExecutionResult> {
  const db = await getDb();
  if (!db) return { success: false, error: "Database unavailable" };

  const member = await db
    .select()
    .from(teamMembers)
    .where(and(eq(teamMembers.id, memberId), eq(teamMembers.teamOwnerId, userId)))
    .limit(1);

  if (member.length === 0) {
    return { success: false, error: "Team member not found." };
  }

  await db
    .delete(teamMembers)
    .where(and(eq(teamMembers.id, memberId), eq(teamMembers.teamOwnerId, userId)));

  await logAudit({
    userId,
    userName: userName || undefined,
    userEmail: userEmail || undefined,
    action: "team.removeMember",
    resource: "teamMember",
    resourceId: memberId.toString(),
    details: { source: "titan_assistant" },
  });

  return { success: true, data: { message: `Team member #${memberId} removed.` } };
}

async function execUpdateTeamMemberRole(
  userId: number,
  args: { memberId: number; role: string },
  userName?: string,
  userEmail?: string
): Promise<ToolExecutionResult> {
  const db = await getDb();
  if (!db) return { success: false, error: "Database unavailable" };

  const newRole = args.role as "admin" | "member" | "viewer";
  await db
    .update(teamMembers)
    .set({ role: newRole })
    .where(and(eq(teamMembers.id, args.memberId), eq(teamMembers.teamOwnerId, userId)));

  await logAudit({
    userId,
    userName: userName || undefined,
    userEmail: userEmail || undefined,
    action: "team.updateRole",
    resource: "teamMember",
    resourceId: args.memberId.toString(),
    details: { newRole: args.role, source: "titan_assistant" },
  });

  return { success: true, data: { message: `Team member #${args.memberId} role updated to ${args.role}.` } };
}

async function execListSchedules(userId: number): Promise<ToolExecutionResult> {
  const db = await getDb();
  if (!db) return { success: false, error: "Database unavailable" };

  const schedules = await db
    .select()
    .from(syncSchedules)
    .where(eq(syncSchedules.userId, userId))
    .orderBy(desc(syncSchedules.createdAt));

  return {
    success: true,
    data: {
      count: schedules.length,
      schedules: schedules.map((s: any) => ({
        id: s.id,
        name: s.name,
        frequency: s.frequency,
        providerIds: s.providerIds,
        enabled: s.enabled,
        lastRunAt: s.lastRunAt,
        nextRunAt: s.nextRunAt,
        createdAt: s.createdAt,
      })),
    },
  };
}

async function execCreateSchedule(
  userId: number,
  args: { name: string; providerIds: string[]; frequency: string }
): Promise<ToolExecutionResult> {
  const db = await getDb();
  if (!db) return { success: false, error: "Database unavailable" };

  // Calculate next run
  const frequencyMs: Record<string, number> = {
    daily: 24 * 60 * 60 * 1000,
    weekly: 7 * 24 * 60 * 60 * 1000,
    biweekly: 14 * 24 * 60 * 60 * 1000,
    monthly: 30 * 24 * 60 * 60 * 1000,
  };

  const freq = args.frequency as "daily" | "weekly" | "biweekly" | "monthly";
  const nextRunAt = new Date(Date.now() + (frequencyMs[freq] || frequencyMs.daily));

  await db.insert(syncSchedules).values({
    userId,
    name: args.name,
    frequency: freq,
    providerIds: args.providerIds,
    timeOfDay: "09:00",
    enabled: 1,
    nextRunAt,
  });

  return {
    success: true,
    data: {
      message: `Schedule "${args.name}" created. Will run ${args.frequency} for ${args.providerIds.length} providers.`,
      nextRunAt,
    },
  };
}

async function execDeleteSchedule(userId: number, scheduleId: number): Promise<ToolExecutionResult> {
  const db = await getDb();
  if (!db) return { success: false, error: "Database unavailable" };

  await db
    .delete(syncSchedules)
    .where(and(eq(syncSchedules.id, scheduleId), eq(syncSchedules.userId, userId)));

  return { success: true, data: { message: `Schedule #${scheduleId} deleted.` } };
}

async function execGetWatchdogSummary(userId: number): Promise<ToolExecutionResult> {
  const db = await getDb();
  if (!db) return { success: false, error: "Database unavailable" };

  const watches = await db
    .select()
    .from(credentialWatches)
    .where(eq(credentialWatches.userId, userId));

  const now = new Date();
  const expiringSoon = watches.filter((w) => {
    const daysUntil = Math.ceil(
      (new Date(w.expiresAt).getTime() - now.getTime()) / (24 * 60 * 60 * 1000)
    );
    return daysUntil > 0 && daysUntil <= w.alertDaysBefore;
  });
  const expired = watches.filter((w) => new Date(w.expiresAt).getTime() <= now.getTime());
  const healthy = watches.filter((w) => {
    const daysUntil = Math.ceil(
      (new Date(w.expiresAt).getTime() - now.getTime()) / (24 * 60 * 60 * 1000)
    );
    return daysUntil > w.alertDaysBefore;
  });

  return {
    success: true,
    data: {
      totalWatches: watches.length,
      healthy: healthy.length,
      expiringSoon: expiringSoon.length,
      expired: expired.length,
      details: expiringSoon.map((w) => ({
        id: w.id,
        credentialId: w.credentialId,
        expiresAt: w.expiresAt,
        daysRemaining: Math.ceil(
          (new Date(w.expiresAt).getTime() - now.getTime()) / (24 * 60 * 60 * 1000)
        ),
      })),
    },
  };
}

async function execCheckProviderHealth(userId: number): Promise<ToolExecutionResult> {
  const db = await getDb();
  if (!db) return { success: false, error: "Database unavailable" };

  const snapshots = await db
    .select()
    .from(providerHealthSnapshots)
    .where(eq(providerHealthSnapshots.userId, userId))
    .orderBy(desc(providerHealthSnapshots.createdAt));

  // Group by provider, take latest
  const providerMap = new Map<string, any>();
  for (const s of snapshots) {
    if (!providerMap.has(s.providerId)) {
      providerMap.set(s.providerId, s);
    }
  }

  const providers = Array.from(providerMap.values()).map((s: any) => ({
    providerId: s.providerId,
    name: PROVIDERS[s.providerId]?.name || s.providerId,
    status: s.status,
    successRate: s.successRate,
    avgResponseTime: s.avgResponseTime,
    lastChecked: s.createdAt,
  }));

  return {
    success: true,
    data: {
      totalProviders: providers.length,
      online: providers.filter((p) => p.status === "online").length,
      degraded: providers.filter((p) => p.status === "degraded").length,
      offline: providers.filter((p) => p.status === "offline").length,
      providers,
    },
  };
}

async function execGetRecommendations(userId: number): Promise<ToolExecutionResult> {
  const db = await getDb();
  if (!db) return { success: false, error: "Database unavailable" };

  const recs = await db
    .select()
    .from(fetchRecommendations)
    .where(and(eq(fetchRecommendations.userId, userId), eq(fetchRecommendations.dismissed, 0)))
    .orderBy(desc(fetchRecommendations.createdAt))
    .limit(10);

  return {
    success: true,
    data: {
      count: recs.length,
      recommendations: recs.map((r: any) => ({
        id: r.id,
        type: r.type,
        title: r.title,
        description: r.description,
        priority: r.priority,
        actionLabel: r.actionLabel,
      })),
    },
  };
}

async function execGetAuditLogs(args: { action?: string; limit?: number }): Promise<ToolExecutionResult> {
  const result = await queryAuditLogs({
    action: args.action,
    limit: args.limit || 20,
    offset: 0,
  });

  return {
    success: true,
    data: {
      total: result.total,
      entries: result.logs.map((l: any) => ({
        id: l.id,
        action: l.action,
        resource: l.resource,
        resourceId: l.resourceId,
        userName: l.userName,
        userEmail: l.userEmail,
        details: l.details,
        createdAt: l.createdAt,
      })),
    },
  };
}

async function execActivateKillSwitch(userId: number, code: string): Promise<ToolExecutionResult> {
  const success = await activateKS(userId, code);
  if (success) {
    return {
      success: true,
      data: { message: "KILL SWITCH ACTIVATED. All running jobs and automations have been halted immediately." },
    };
  }
  return { success: false, error: "Invalid kill switch code. Please check your code and try again." };
}

async function execGetSystemStatus(userId: number): Promise<ToolExecutionResult> {
  const db = await getDb();
  if (!db) return { success: false, error: "Database unavailable" };

  const plan = await getUserPlan(userId);

  // Credential count
  const creds = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(fetcherCredentials)
    .where(eq(fetcherCredentials.userId, userId));

  // Job count
  const jobs = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(fetcherJobs)
    .where(eq(fetcherJobs.userId, userId));

  // Proxy count
  const proxies = await db
    .select({
      total: sql<number>`COUNT(*)`,
      healthy: sql<number>`SUM(CASE WHEN healthy = 1 THEN 1 ELSE 0 END)`,
    })
    .from(fetcherProxies)
    .where(eq(fetcherProxies.userId, userId));

  // Watchdog
  const watches = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(credentialWatches)
    .where(eq(credentialWatches.userId, userId));

  // API keys
  const keys = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(apiKeys)
    .where(and(eq(apiKeys.userId, userId), isNull(apiKeys.revokedAt)));

  return {
    success: true,
    data: {
      plan: { id: plan.planId, name: plan.tier.name, status: plan.status },
      credentials: creds[0].count,
      totalJobs: jobs[0].count,
      proxies: { total: proxies[0].total, healthy: proxies[0].healthy || 0 },
      watchdogAlerts: watches[0].count,
      activeApiKeys: keys[0].count,
    },
  };
}

async function execGetPlanUsage(userId: number): Promise<ToolExecutionResult> {
  const plan = await getUserPlan(userId);
  return {
    success: true,
    data: {
      planId: plan.planId,
      planName: plan.tier.name,
      status: plan.status,
      isActive: plan.isActive,
      limits: plan.tier.limits,
      features: plan.tier.features,
    },
  };
}


// ─── Self-Improvement Executor Functions ─────────────────────────────

function execSelfReadFile(filePath: string): ToolExecutionResult {
  if (!filePath) return { success: false, error: "filePath is required" };
  const result = selfReadFileImpl(filePath);
  if (!result.success) return { success: false, error: result.error };
  return {
    success: true,
    data: {
      filePath,
      content: result.content,
      length: result.content?.length || 0,
    },
  };
}

function execSelfListFiles(dirPath: string): ToolExecutionResult {
  if (!dirPath) return { success: false, error: "dirPath is required" };
  const result = selfListFilesImpl(dirPath);
  if (!result.success) return { success: false, error: result.error };
  return {
    success: true,
    data: {
      directory: dirPath,
      files: result.files,
      count: result.files?.length || 0,
    },
  };
}

async function execSelfModifyFile(
  userId: number,
  args: { filePath: string; action: "modify" | "create" | "delete"; content?: string; description: string },
  userName?: string
): Promise<ToolExecutionResult> {
  if (!args.filePath || !args.action || !args.description) {
    return { success: false, error: "filePath, action, and description are required" };
  }

  if ((args.action === "modify" || args.action === "create") && !args.content) {
    return { success: false, error: "content is required for modify/create actions" };
  }

  const result = await applyModifications(
    [
      {
        filePath: args.filePath,
        action: args.action,
        content: args.content,
        description: args.description,
      },
    ],
    userId,
    userName || "titan_assistant"
  );

  if (!result.success) {
    return {
      success: false,
      error: result.error,
      data: {
        validationErrors: result.validationResult?.errors,
        validationWarnings: result.validationResult?.warnings,
        rolledBack: result.rolledBack,
        healthCheckPassed: result.healthCheckPassed,
      },
    };
  }

  return {
    success: true,
    data: {
      snapshotId: result.snapshotId,
      modifications: result.modifications,
      healthCheckPassed: result.healthCheckPassed,
      message: `Successfully ${args.action === "create" ? "created" : args.action === "delete" ? "deleted" : "modified"} ${args.filePath}. Snapshot #${result.snapshotId} saved for rollback if needed.`,
    },
  };
}

async function execSelfHealthCheck(options?: {
  skipTests?: boolean;
  skipTypeCheck?: boolean;
}): Promise<ToolExecutionResult> {
  const health = await runQuickHealthCheck(options);
  return {
    success: true,
    data: {
      healthy: health.healthy,
      checks: health.checks,
      summary: health.healthy
        ? "All systems operational"
        : `${health.checks.filter((c) => !c.passed).length} issue(s) detected`,
    },
  };
}

async function execSelfRollback(
  userId: number,
  snapshotId?: number,
  userName?: string
): Promise<ToolExecutionResult> {
  if (snapshotId) {
    const result = await rollbackToSnapshot(snapshotId);
    return {
      success: result.success,
      data: {
        snapshotId,
        filesRestored: result.filesRestored,
        message: result.success
          ? `Rolled back to snapshot #${snapshotId}. ${result.filesRestored} file(s) restored.`
          : undefined,
      },
      error: result.error,
    };
  }

  // Roll back to last known good
  const result = await rollbackToLastGood();
  return {
    success: result.success,
    data: {
      snapshotId: result.snapshotId,
      filesRestored: result.filesRestored,
      message: result.success
        ? `Rolled back to last known good snapshot #${result.snapshotId}. ${result.filesRestored} file(s) restored.`
        : undefined,
    },
    error: result.error,
  };
}

async function execSelfRestart(
  userId: number,
  reason: string
): Promise<ToolExecutionResult> {
  if (!reason) {
    return { success: false, error: "A reason for the restart is required" };
  }

  const result = await requestRestart(reason, userId);
  return {
    success: result.success,
    data: { message: result.message },
    error: result.success ? undefined : result.message,
  };
}

async function execSelfModificationHistory(
  limit?: number
): Promise<ToolExecutionResult> {
  const result = await getModificationHistory(limit || 20);
  if (!result.success) return { success: false, error: result.error };
  return {
    success: true,
    data: {
      count: result.entries?.length || 0,
      entries: result.entries,
    },
  };
}

function execSelfGetProtectedFiles(): ToolExecutionResult {
  return {
    success: true,
    data: {
      protectedFiles: getProtectedFiles(),
      allowedDirectories: getAllowedDirectories(),
      message:
        "Protected files cannot be modified by the self-improvement engine. Only files in allowed directories can be changed.",
    },
  };
}


// ─── Builder Tool Executor Functions ─────────────────────────────────

async function execSelfTypeCheck(userId?: number): Promise<ToolExecutionResult> {
  const start = Date.now();
  const result = await runTypeCheck();
  const durationMs = Date.now() - start;
  const summary = result.passed
    ? "TypeScript: 0 errors — all types are valid"
    : `TypeScript: ${result.errorCount} error(s) found`;

  // Log to builder_activity_log
  try {
    const db = await getDb();
    if (db) {
      await db.insert(builderActivityLog).values({
        userId: userId ?? 0,
        tool: "self_type_check",
        status: result.passed ? "success" : "failure",
        summary,
        durationMs,
        details: { errorCount: result.errorCount, output: result.output?.slice(0, 2000) },
      });
    }
  } catch (e) { /* non-critical */ }

  return {
    success: true,
    data: {
      passed: result.passed,
      errorCount: result.errorCount,
      output: result.output,
      summary,
    },
  };
}

async function execSelfRunTests(
  testPattern?: string,
  userId?: number
): Promise<ToolExecutionResult> {
  const start = Date.now();
  const result = await runTests(testPattern);
  const durationMs = Date.now() - start;
  const summary = result.passed
    ? `Tests: all ${result.totalTests} passed`
    : `Tests: ${result.failedTests} of ${result.totalTests} failed`;

  // Log to builder_activity_log
  try {
    const db = await getDb();
    if (db) {
      await db.insert(builderActivityLog).values({
        userId: userId ?? 0,
        tool: "self_run_tests",
        status: result.passed ? "success" : "failure",
        summary,
        durationMs,
        details: { totalTests: result.totalTests, failedTests: result.failedTests, pattern: testPattern },
      });
    }
  } catch (e) { /* non-critical */ }

  return {
    success: true,
    data: {
      passed: result.passed,
      totalTests: result.totalTests,
      failedTests: result.failedTests,
      output: result.output,
      summary,
    },
  };
}

async function execSelfMultiFileModify(
  userId: number,
  modifications: Array<{
    filePath: string;
    action: "modify" | "create" | "delete";
    content?: string;
    description: string;
  }>,
  userName?: string
): Promise<ToolExecutionResult> {
  if (!modifications || modifications.length === 0) {
    return { success: false, error: "No modifications provided" };
  }

  const start = Date.now();
  const db = await getDb();
  if (db && userName) {
    await logAudit({
      userId,
      userName: userName || "titan_assistant",
      action: "self_multi_file_modify",
      resource: "codebase",
      details: {
        fileCount: modifications.length,
        files: modifications.map((m) => `${m.action}: ${m.filePath}`),
      },
    });
  }

  const result = await applyModifications(modifications, userId, "titan_assistant");
  const durationMs = Date.now() - start;
  const summary = result.success
    ? `${result.modifications.filter((m) => m.applied).length} file(s) modified successfully. Health check passed.`
    : result.rolledBack
      ? `Changes rolled back — ${result.error}`
      : `Failed: ${result.error}`;

  // Log to builder_activity_log
  try {
    if (db) {
      await db.insert(builderActivityLog).values({
        userId,
        tool: "self_multi_file_modify",
        status: result.success ? "success" : "failure",
        summary,
        durationMs,
        details: {
          fileCount: modifications.length,
          files: modifications.map((m) => m.filePath),
          rolledBack: result.rolledBack,
        },
      });
    }
  } catch (e) { /* non-critical */ }

  return {
    success: result.success,
    data: {
      snapshotId: result.snapshotId,
      modifications: result.modifications,
      healthCheckPassed: result.healthCheckPassed,
      rolledBack: result.rolledBack,
      validationErrors: result.validationResult?.errors,
      validationWarnings: result.validationResult?.warnings,
      summary,
    },
    error: result.error,
  };
}
