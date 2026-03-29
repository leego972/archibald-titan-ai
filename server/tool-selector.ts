/**
 * Smart Tool Selector — context-aware tool subset selection for external builds.
 *
 * OpenAI enforces a hard limit of 128 tools per request. EXTERNAL_BUILD_TOOLS
 * currently has 126 tools, but as new tools are added this will be exceeded.
 *
 * This module selects a relevant subset of tools based on the user's request,
 * ensuring we never exceed 128 while keeping ALL tools available.
 *
 * CORE tools (always included, ~30): file creation, sandbox, web research, GitHub, system
 * OPTIONAL groups (included based on keywords): security, platform, credentials, business, etc.
 *
 * ADMIN / BUILDER OVERRIDE: When isBuildRequest=true, ALL tools are returned (up to 128).
 * This ensures the Builder never misses a tool due to keyword mismatch.
 */

import type { Tool } from "./_core/llm";
import { EXTERNAL_BUILD_TOOLS } from "./chat-tools";

// ─── Tool name groups ────────────────────────────────────────────────────────

const ALWAYS_INCLUDE = new Set([
  // Core file building
  "create_file", "read_uploaded_file", "provide_project_zip",
  // Binary/rich file generation — ALWAYS available, never filtered
  "generate_pdf", "generate_spreadsheet", "generate_image", "generate_markdown_report",
  // Sandbox — full access: exec, write, read, list, delete, download
  "sandbox_exec", "sandbox_write_file", "sandbox_read_file", "sandbox_list_files",
  "sandbox_delete_file", "sandbox_download_url",
  // Web research
  "web_search", "web_page_read", "search_bazaar",
  // GitHub
  "create_github_repo", "push_to_github_repo",
  // Navigation & system
  "navigate_to_page", "get_system_status",
  // Credentials (always needed — builds often need API keys)
  "list_credentials", "reveal_credential", "list_vault_entries", "save_credential",
  // Memory
  "memory_save_fact", "memory_list_facts", "memory_delete_fact",
]);

const SECURITY_TOOLS = new Set([
  "install_security_toolkit", "network_scan", "generate_yara_rule", "generate_sigma_rule",
  "hash_crack", "generate_payload", "osint_lookup", "cve_lookup", "run_exploit",
  "decompile_binary", "fuzzer_run", "shellcode_gen", "code_obfuscate", "privesc_check",
  "web_attack", "threat_intel_lookup", "traffic_capture", "ad_attack", "cloud_enum",
  "generate_pentest_report", "auto_fix_vulnerability", "auto_fix_all",
]);

const PLATFORM_TOOLS = new Set([
  "evilginx_connect", "evilginx_run_command", "evilginx_list_phishlets",
  "evilginx_list_sessions", "evilginx_list_lures",
  "metasploit_test_connection", "metasploit_run_command", "metasploit_list_sessions",
  "metasploit_search_modules",
  "argus_test_connection", "astra_test_connection",
  "blackeye_test_connection", "blackeye_run_command",
  "cybermcp_test_basic_auth",
]);

const ANONYMITY_TOOLS = new Set([
  "tor_get_status", "tor_new_circuit", "tor_install", "tor_set_active", "tor_set_firewall",
  "vpn_chain_get_chain", "vpn_chain_add_hop", "vpn_chain_test_chain", "vpn_chain_set_active",
  "proxy_maker_get_pool", "proxy_maker_scrape_proxies", "proxy_maker_health_check",
  "proxy_maker_set_rotation", "proxy_maker_deploy_proxy",
]);

const CREDENTIAL_MGMT_TOOLS = new Set([
  "export_credentials", "create_fetch_job", "list_jobs", "get_job_details",
  "list_providers", "list_api_keys", "create_api_key", "revoke_api_key",
  "start_leak_scan", "get_leak_scan_results", "add_vault_entry",
  "trigger_bulk_sync", "get_bulk_sync_status", "totp_vault_list",
]);

const TEAM_TOOLS = new Set([
  "list_team_members", "add_team_member", "remove_team_member", "update_team_member_role",
  "list_schedules", "create_schedule", "delete_schedule",
  "get_watchdog_summary", "check_provider_health", "get_recommendations",
  "get_audit_logs", "get_plan_usage",
]);

const BUSINESS_TOOLS = new Set([
  "content_creator_get_campaigns", "advertising_get_strategy", "affiliate_get_stats",
  "grant_list", "seo_get_health_score", "site_monitor_list_sites",
  "replicate_list_projects", "marketplace_browse",
  "get_business_module_status", "get_business_verticals_list",
  "trigger_business_module_generation", "app_research", "app_clone", "website_replicate",
]);

const STORAGE_TOOLS = new Set([
  "storage_get_stats", "storage_list_files", "storage_get_download_url",
  "storage_delete_file", "storage_upload_file",
]);

const FINANCE_TOOLS = new Set([
  "bin_lookup", "card_validate", "bin_reverse_lookup",
]);

const CHANNEL_TOOLS = new Set([
  "get_autonomous_status", "get_channel_status", "refresh_vault_bridge", "get_vault_bridge_info",
]);

const VOICE_TOOLS = new Set([
  "voice_transcribe",
]);

// ─── Keyword → tool group mapping ────────────────────────────────────────────

const KEYWORD_GROUPS: Array<{ regex: RegExp; groups: Set<string>[] }> = [
  {
    regex: /\b(security|pentest|exploit|vuln|cve|malware|keylog|rat\b|trojan|backdoor|rootkit|ransomware|spyware|shellcode|payload|phish|osint|recon|scan|bypass|inject|obfuscat|privesc|lateral|exfil|c2|beacon|implant|dropper|stager|loader|fuzzer|yara|sigma|decompil|crack|brute|hash)\b/i,
    groups: [SECURITY_TOOLS],
  },
  {
    regex: /\b(evilginx|metasploit|argus|astra|blackeye|cybermcp|platform|c2.?server|command.?control)\b/i,
    groups: [PLATFORM_TOOLS],
  },
  {
    regex: /\b(tor|vpn|proxy|anon|anonymi|chain|circuit|hop|rotate|socks)\b/i,
    groups: [ANONYMITY_TOOLS],
  },
  {
    regex: /\b(credential|fetch|provider|api.?key|leak|vault|totp|sync|export.?cred|import.?cred)\b/i,
    groups: [CREDENTIAL_MGMT_TOOLS],
  },
  {
    regex: /\b(team|member|schedule|watchdog|audit|health|plan.?usage|recommend)\b/i,
    groups: [TEAM_TOOLS],
  },
  {
    regex: /\b(business|campaign|advertis|affiliate|grant|seo|site.?monitor|replicate|marketplace|app.?clone|app.?research|website.?clone)\b/i,
    groups: [BUSINESS_TOOLS],
  },
  {
    regex: /\b(storage|file.?upload|file.?download|s3|bucket|cdn)\b/i,
    groups: [STORAGE_TOOLS],
  },
  {
    regex: /\b(bin|card|credit.?card|debit|iin|issuer|bank.?id)\b/i,
    groups: [FINANCE_TOOLS],
  },
  {
    regex: /\b(channel|autonomous|vault.?bridge|auto.?run)\b/i,
    groups: [CHANNEL_TOOLS],
  },
  {
    regex: /\b(voice|transcri|speech|audio|whisper)\b/i,
    groups: [VOICE_TOOLS],
  },
];

// ─── Selector function ────────────────────────────────────────────────────────

/**
 * Select a relevant subset of EXTERNAL_BUILD_TOOLS for the given request.
 *
 * When isBuildRequest=true (Builder mode), ALL tools are returned (up to 128).
 * This ensures the Builder has full access to every tool without keyword restrictions.
 *
 * For general chat (isBuildRequest=false), always includes core tools and adds
 * optional groups based on keywords in the message.
 *
 * Result is capped at 128 tools (OpenAI hard limit).
 */
export function selectToolsForRequest(message: string, isBuildRequest = false): Tool[] {
  // ── BUILDER FULL ACCESS ──────────────────────────────────────────────────────
  // When in Builder mode, return ALL tools up to the 128 limit.
  // The Builder needs every tool available — security tools, platform integrations,
  // sandbox tools, anonymity tools, credentials — everything. No keyword filtering.
  if (isBuildRequest) {
    return EXTERNAL_BUILD_TOOLS.slice(0, 128);
  }

  // ── CHAT MODE: keyword-based subset selection ────────────────────────────────
  // Build the set of tool function names to include
  const includedNames = new Set<string>(ALWAYS_INCLUDE);

  // Add groups based on keywords in the message
  for (const { regex, groups } of KEYWORD_GROUPS) {
    if (regex.test(message)) {
      for (const group of groups) {
        for (const name of group) {
          includedNames.add(name);
        }
      }
    }
  }

  // Map tool function names to actual Tool objects from EXTERNAL_BUILD_TOOLS
  // We match by the tool's function.name field
  const toolMap = new Map<string, Tool>();
  for (const tool of EXTERNAL_BUILD_TOOLS) {
    if (tool.type === "function" && tool.function?.name) {
      toolMap.set(tool.function.name, tool);
    }
  }

  // Build the selected tool list — always-include first, then extras
  const selected: Tool[] = [];
  const seen = new Set<string>();

  // First pass: always-included tools in their original order
  for (const tool of EXTERNAL_BUILD_TOOLS) {
    if (tool.type === "function" && tool.function?.name) {
      const name = tool.function.name;
      if (includedNames.has(name) && !seen.has(name)) {
        selected.push(tool);
        seen.add(name);
      }
    }
  }

  // Second pass: keyword-matched tools in their original order
  for (const tool of EXTERNAL_BUILD_TOOLS) {
    if (tool.type === "function" && tool.function?.name) {
      const name = tool.function.name;
      if (!seen.has(name) && includedNames.has(name)) {
        selected.push(tool);
        seen.add(name);
      }
    }
  }

  // If we still have room, fill with remaining tools up to 128
  if (selected.length < 128) {
    for (const tool of EXTERNAL_BUILD_TOOLS) {
      if (selected.length >= 128) break;
      if (tool.type === "function" && tool.function?.name) {
        const name = tool.function.name;
        if (!seen.has(name)) {
          selected.push(tool);
          seen.add(name);
        }
      }
    }
  }

  // Hard cap at 128
  return selected.slice(0, 128);
}
