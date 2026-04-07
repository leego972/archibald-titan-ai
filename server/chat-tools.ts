/**
 * Chat Tool Definitions — LLM function-calling schemas for Titan Assistant.
 *
 * Each tool maps to a real backend action (tRPC procedure or DB query).
 * The LLM receives these schemas and can invoke them to execute actions
 * on behalf of the user.
 */

import type { Tool } from "./_core/llm";

// ─── Credential & Fetch Tools ───────────────────────────────────────

const listCredentials: Tool = {
  type: "function",
  function: {
    name: "list_credentials",
    description:
      "List all stored credentials for the current user. Returns provider name, key type, label, and creation date. Does NOT reveal the actual secret values.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
  },
};

const revealCredential: Tool = {
  type: "function",
  function: {
    name: "reveal_credential",
    description:
      "Reveal the decrypted value of a specific credential by its ID. Use this when the user asks to see or copy a specific credential.",
    parameters: {
      type: "object",
      properties: {
        credentialId: {
          type: "number",
          description: "The ID of the credential to reveal",
        },
      },
      required: ["credentialId"],
    },
  },
};

const exportCredentials: Tool = {
  type: "function",
  function: {
    name: "export_credentials",
    description:
      "Export all credentials in a specified format (json, env, or csv). Returns the formatted export data.",
    parameters: {
      type: "object",
      properties: {
        format: {
          type: "string",
          enum: ["json", "env", "csv"],
          description: "Export format",
        },
      },
      required: ["format"],
    },
  },
};

const createFetchJob: Tool = {
  type: "function",
  function: {
    name: "create_fetch_job",
    description:
      "Create a new credential fetch job. Specify which providers to fetch from. The job runs asynchronously and retrieves API keys/credentials from the selected providers using the stealth browser.",
    parameters: {
      type: "object",
      properties: {
        providerIds: {
          type: "array",
          items: { type: "string" },
          description:
            "Array of provider IDs to fetch from (e.g. ['openai', 'aws', 'github']). Use list_providers to see available IDs.",
        },
      },
      required: ["providerIds"],
    },
  },
};

const listJobs: Tool = {
  type: "function",
  function: {
    name: "list_jobs",
    description:
      "List recent fetch jobs with their status, progress, and results summary.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
  },
};

const getJobDetails: Tool = {
  type: "function",
  function: {
    name: "get_job_details",
    description:
      "Get detailed information about a specific fetch job including per-provider task status.",
    parameters: {
      type: "object",
      properties: {
        jobId: {
          type: "number",
          description: "The ID of the job to inspect",
        },
      },
      required: ["jobId"],
    },
  },
};

const listProviders: Tool = {
  type: "function",
  function: {
    name: "list_providers",
    description:
      "List all available credential providers with their IDs, names, categories, and key types. Use this to help the user choose which providers to fetch from.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
  },
};

// ─── API Key Management Tools ────────────────────────────────────────

const listApiKeys: Tool = {
  type: "function",
  function: {
    name: "list_api_keys",
    description:
      "List all API keys for the current user, showing name, prefix, scopes, usage count, and status.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
  },
};

const createApiKey: Tool = {
  type: "function",
  function: {
    name: "create_api_key",
    description:
      "Create a new API key with specified name, scopes, and optional expiration. Returns the raw key (shown only once).",
    parameters: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "A descriptive name for the API key",
        },
        scopes: {
          type: "array",
          items: {
            type: "string",
            enum: [
              "credentials:read",
              "credentials:export",
              "jobs:read",
              "jobs:create",
            ],
          },
          description: "Permission scopes for the key",
        },
        expiresInDays: {
          type: "number",
          description:
            "Number of days until the key expires (1-365). Omit for no expiration.",
        },
      },
      required: ["name", "scopes"],
    },
  },
};

const revokeApiKey: Tool = {
  type: "function",
  function: {
    name: "revoke_api_key",
    description: "Revoke an API key by its ID, permanently disabling it.",
    parameters: {
      type: "object",
      properties: {
        keyId: {
          type: "number",
          description: "The ID of the API key to revoke",
        },
      },
      required: ["keyId"],
    },
  },
};

// ─── Leak Scanner Tools ──────────────────────────────────────────────

const startLeakScan: Tool = {
  type: "function",
  function: {
    name: "start_leak_scan",
    description:
      "Start a credential leak scan. Searches public sources (GitHub, Pastebin, etc.) for exposed credentials matching the user's stored keys.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
  },
};

const getLeakScanResults: Tool = {
  type: "function",
  function: {
    name: "get_leak_scan_results",
    description:
      "Get the results of leak scans including findings, severity, and affected credentials.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
  },
};

// ─── Vault Tools ─────────────────────────────────────────────────────

const listVaultEntries: Tool = {
  type: "function",
  function: {
    name: "list_vault_entries",
    description:
      "List all entries in the Team Vault, showing name, category, who added it, and sharing status.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
  },
};

const addVaultEntry: Tool = {
  type: "function",
  function: {
    name: "add_vault_entry",
    description:
      "Add a new secret to the Team Vault with a name, value, optional category, and optional notes.",
    parameters: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Name/label for the secret",
        },
        value: {
          type: "string",
          description: "The secret value to store (will be encrypted)",
        },
        category: {
          type: "string",
          description:
            "Category for organization (e.g. 'api_key', 'password', 'token', 'certificate', 'other')",
        },
        notes: {
          type: "string",
          description: "Optional notes about this secret",
        },
      },
      required: ["name", "value"],
    },
  },
};

const saveCredential: Tool = {
  type: "function",
  function: {
    name: "save_credential",
    description:
      "Save a credential (API key, token, secret, password, etc.) to the user's encrypted vault. Use this when the user provides a credential and wants to store it. Auto-detect the provider and key type from the value format when possible. Common patterns: 'sk-...' = OpenAI API key, 'AKIA...' = AWS Access Key ID, 'ghp_...' = GitHub Personal Access Token, 'SG....' = SendGrid API key, 'xoxb-...' = Slack Bot Token. If you can't detect the provider, ask the user or use 'custom' as the providerId.",
    parameters: {
      type: "object",
      properties: {
        providerId: {
          type: "string",
          description:
            "Provider ID (e.g. 'openai', 'aws', 'github', 'stripe', 'anthropic', 'cloudflare', 'sendgrid', 'twilio', 'heroku', 'digitalocean', 'godaddy', 'firebase', 'google_cloud', 'huggingface', 'mailgun', 'meta', 'tiktok', 'google_ads', 'snapchat', 'discord', 'roblox', or 'custom' for unknown providers)",
        },
        providerName: {
          type: "string",
          description:
            "Human-readable provider name (e.g. 'OpenAI', 'AWS', 'GitHub'). Use the official name.",
        },
        keyType: {
          type: "string",
          description:
            "Type of credential (e.g. 'api_key', 'secret_key', 'access_token', 'personal_access_token', 'bot_token', 'password', 'oauth_client_id', 'oauth_client_secret', 'webhook_url')",
        },
        value: {
          type: "string",
          description: "The actual credential value to store (will be encrypted with AES-256-GCM)",
        },
        label: {
          type: "string",
          description:
            "Optional label to identify this credential (e.g. 'Production key', 'My personal token', 'Staging environment')",
        },
      },
      required: ["providerId", "providerName", "keyType", "value"],
    },
  },
};

// ─── Bulk Sync Tools ─────────────────────────────────────────────────

const triggerBulkSync: Tool = {
  type: "function",
  function: {
    name: "trigger_bulk_sync",
    description:
      "Trigger a bulk sync job that re-fetches credentials from all or specified providers to keep them up to date.",
    parameters: {
      type: "object",
      properties: {
        providerIds: {
          type: "array",
          items: { type: "string" },
          description:
            "Optional array of provider IDs to sync. If omitted, syncs all providers.",
        },
      },
      required: [],
    },
  },
};

const getBulkSyncStatus: Tool = {
  type: "function",
  function: {
    name: "get_bulk_sync_status",
    description:
      "Get the status of recent bulk sync jobs, showing progress and results.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
  },
};

// ─── Team Management Tools ───────────────────────────────────────────

const listTeamMembers: Tool = {
  type: "function",
  function: {
    name: "list_team_members",
    description:
      "List all team members with their roles, email, and join date.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
  },
};

const addTeamMember: Tool = {
  type: "function",
  function: {
    name: "add_team_member",
    description:
      "Add a user to the team by their email address with a specified role.",
    parameters: {
      type: "object",
      properties: {
        email: {
          type: "string",
          description: "Email address of the user to add",
        },
        role: {
          type: "string",
          enum: ["admin", "member", "viewer"],
          description: "Role to assign (default: member)",
        },
      },
      required: ["email"],
    },
  },
};

const removeTeamMember: Tool = {
  type: "function",
  function: {
    name: "remove_team_member",
    description: "Remove a team member by their member ID.",
    parameters: {
      type: "object",
      properties: {
        memberId: {
          type: "number",
          description: "The ID of the team member to remove",
        },
      },
      required: ["memberId"],
    },
  },
};

const updateTeamMemberRole: Tool = {
  type: "function",
  function: {
    name: "update_team_member_role",
    description: "Update the role of an existing team member.",
    parameters: {
      type: "object",
      properties: {
        memberId: {
          type: "number",
          description: "The ID of the team member",
        },
        role: {
          type: "string",
          enum: ["admin", "member", "viewer"],
          description: "New role to assign",
        },
      },
      required: ["memberId", "role"],
    },
  },
};

// ─── Scheduler Tools ─────────────────────────────────────────────────

const listSchedules: Tool = {
  type: "function",
  function: {
    name: "list_schedules",
    description:
      "List all scheduled auto-sync jobs with their frequency, next run time, and status.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
  },
};

const createSchedule: Tool = {
  type: "function",
  function: {
    name: "create_schedule",
    description:
      "Create a new scheduled auto-sync that periodically fetches credentials from specified providers.",
    parameters: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Name for the schedule",
        },
        providerIds: {
          type: "array",
          items: { type: "string" },
          description: "Provider IDs to include in the schedule",
        },
        frequency: {
          type: "string",
          enum: ["hourly", "daily", "weekly", "monthly"],
          description: "How often to run the sync",
        },
      },
      required: ["name", "providerIds", "frequency"],
    },
  },
};

const deleteSchedule: Tool = {
  type: "function",
  function: {
    name: "delete_schedule",
    description: "Delete a scheduled auto-sync by its ID.",
    parameters: {
      type: "object",
      properties: {
        scheduleId: {
          type: "number",
          description: "The ID of the schedule to delete",
        },
      },
      required: ["scheduleId"],
    },
  },
};

// ─── Watchdog Tools ──────────────────────────────────────────────────

const getWatchdogSummary: Tool = {
  type: "function",
  function: {
    name: "get_watchdog_summary",
    description:
      "Get a summary of credential expiration watches — how many are active, expiring soon, or already expired.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
  },
};

// ─── Provider Health Tools ───────────────────────────────────────────

const checkProviderHealth: Tool = {
  type: "function",
  function: {
    name: "check_provider_health",
    description:
      "Check the health status of all credential providers — shows which are online, degraded, or offline, with success rates.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
  },
};

// ─── Recommendations Tools ───────────────────────────────────────────

const getRecommendations: Tool = {
  type: "function",
  function: {
    name: "get_recommendations",
    description:
      "Get AI-generated recommendations for improving credential security, rotation schedules, and setup optimization.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
  },
};

// ─── Audit Log Tools ─────────────────────────────────────────────────

const getAuditLogs: Tool = {
  type: "function",
  function: {
    name: "get_audit_logs",
    description:
      "Retrieve recent audit log entries showing all actions taken in the account.",
    parameters: {
      type: "object",
      properties: {
        action: {
          type: "string",
          description:
            "Filter by action type (e.g. 'apiKey.create', 'team.addMember'). Omit for all.",
        },
        limit: {
          type: "number",
          description: "Number of entries to return (default: 20, max: 100)",
        },
      },
      required: [],
    },
  },
};

// ─── Kill Switch Tool — REMOVED (now a Grand Bazaar marketplace module) ────

// ─── System Status Tool ──────────────────────────────────────────────

const getSystemStatus: Tool = {
  type: "function",
  function: {
    name: "get_system_status",
    description:
      "Get a comprehensive system status overview: plan info, usage stats, credential count, job count, proxy health, watchdog alerts, provider health, AND full autonomous systems status (SEO engines, advertising orchestrator, affiliate engines, content generators, marketing channels, connected/disconnected channels with setup instructions, and recommendations for maximizing traffic).",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
  },
};

// ─── Plan & Usage Tool ───────────────────────────────────────────────

const getPlanUsage: Tool = {
  type: "function",
  function: {
    name: "get_plan_usage",
    description:
      "Get the current subscription plan details and usage statistics — fetches used, credentials stored, proxy slots, export formats available.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
  },
};

// ─── Self-Improvement Tools ─────────────────────────────────────────

const selfReadFile: Tool = {
  type: "function",
  function: {
    name: "self_read_file",
    description:
      "Read the contents of a source file in YOUR OWN project codebase. You have FULL ACCESS to all files in server/, client/src/, client/public/, shared/, scripts/, electron/. You are NEVER locked out — if you think you cannot access a file, you are wrong. Use this to inspect code before making modifications. For CSS/visual issues, ALWAYS start by reading client/src/index.css.",
    parameters: {
      type: "object",
      properties: {
        filePath: {
          type: "string",
          description:
            "Relative path to the file from project root (e.g. 'server/chat-router.ts', 'client/src/pages/ChatPage.tsx', 'client/src/index.css')",
        },
      },
      required: ["filePath"],
    },
  },
};

const selfListFiles: Tool = {
  type: "function",
  function: {
    name: "self_list_files",
    description:
      "List files in YOUR OWN project directory. You have FULL ACCESS to explore the entire codebase. Use this to discover what files exist before reading or modifying them.",
    parameters: {
      type: "object",
      properties: {
        dirPath: {
          type: "string",
          description:
            "Relative path to the directory (e.g. 'server/' or 'client/src/pages/')",
        },
      },
      required: ["dirPath"],
    },
  },
};

const selfModifyFile: Tool = {
  type: "function",
  function: {
    name: "self_modify_file",
    description:
      "Modify, create, or delete a source file in YOUR OWN project codebase. You have FULL ACCESS to modify any file in server/, client/src/, client/public/, shared/, scripts/, electron/. SAFETY: A snapshot is automatically taken before any change and automatic rollback occurs if the system breaks. Protected files (auth, encryption, schema, payment) cannot be modified. For CSS/theme fixes, modify client/src/index.css. For mobile layout fixes, modify client/src/pages/ChatPage.tsx. ALWAYS use action='patch' for targeted edits to existing files.",
    parameters: {
      type: "object",
      properties: {
        filePath: {
          type: "string",
          description: "Relative path to the file",
        },
        action: {
          type: "string",
          enum: ["modify", "create", "delete", "patch"],
          description: "What to do with the file. Use 'patch' for targeted edits to existing files (preferred for large files) — provide search_replace pairs instead of full content.",
        },
        content: {
          type: "string",
          description:
            "The COMPLETE file content (required for modify/create, ignored for delete/patch). CRITICAL: For 'modify' action, this MUST be the ENTIRE file — all original lines plus your additions. Partial snippets will be REJECTED. For large files, prefer 'patch' action instead.",
        },
        patches: {
          type: "array",
          description: "Array of search-and-replace patches (required for 'patch' action only). Each patch finds exact text and replaces it.",
          items: {
            type: "object",
            properties: {
              search: {
                type: "string",
                description: "Exact text to find in the file (must match precisely, including whitespace and newlines)",
              },
              replace: {
                type: "string",
                description: "Replacement text",
              },
            },
            required: ["search", "replace"],
          },
        },
        description: {
          type: "string",
          description: "Brief description of what this change does and why",
        },
      },
      required: ["filePath", "action", "description"],
    },
  },
};

const selfHealthCheck: Tool = {
  type: "function",
  function: {
    name: "self_health_check",
    description:
      "Run a comprehensive health check on the system — verifies critical files exist, syntax is valid, database is accessible, self-improvement engine is intact, and optionally runs TypeScript type checking and test suite.",
    parameters: {
      type: "object",
      properties: {
        skipTests: {
          type: "boolean",
          description: "Skip running the test suite (faster check). Default: false.",
        },
        skipTypeCheck: {
          type: "boolean",
          description: "Skip TypeScript type checking (faster check). Default: false.",
        },
      },
      required: [],
    },
  },
};

const selfRollback: Tool = {
  type: "function",
  function: {
    name: "self_rollback",
    description:
      "Roll back to the last known good state. Use this if something is broken and needs to be reverted. Can also roll back to a specific snapshot by ID.",
    parameters: {
      type: "object",
      properties: {
        snapshotId: {
          type: "number",
          description:
            "Optional: specific snapshot ID to roll back to. If omitted, rolls back to the last known good snapshot.",
        },
      },
      required: [],
    },
  },
};

const selfRestart: Tool = {
  type: "function",
  function: {
    name: "self_restart",
    description:
      "Request a service restart. Use this after making code changes that require a server restart to take effect.",
    parameters: {
      type: "object",
      properties: {
        reason: {
          type: "string",
          description: "Why the restart is needed",
        },
      },
      required: ["reason"],
    },
  },
};

const selfModificationHistory: Tool = {
  type: "function",
  function: {
    name: "self_modification_history",
    description:
      "View the history of all self-modifications — what was changed, when, by whom, and whether it was rolled back.",
    parameters: {
      type: "object",
      properties: {
        limit: {
          type: "number",
          description: "Number of entries to return (default: 20)",
        },
      },
      required: [],
    },
  },
};

// ─── Builder Tools ──────────────────────────────────────────────────

const selfTypeCheck: Tool = {
  type: "function",
  function: {
    name: "self_type_check",
    description:
      "Run the TypeScript compiler in check-only mode (tsc --noEmit). Returns pass/fail status with error count and detailed output. ALWAYS run this after modifying any .ts or .tsx file.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
  },
};

const selfRunTests: Tool = {
  type: "function",
  function: {
    name: "self_run_tests",
    description:
      "Run the vitest test suite and return results. Optionally pass a test pattern to run specific tests. ALWAYS run this after making code changes to verify nothing is broken.",
    parameters: {
      type: "object",
      properties: {
        testPattern: {
          type: "string",
          description:
            "Optional test file pattern to run specific tests (e.g. 'auth.logout' or 'chat-router'). If omitted, runs all tests.",
        },
      },
      required: [],
    },
  },
};

const selfMultiFileModify: Tool = {
  type: "function",
  function: {
    name: "self_multi_file_modify",
    description:
      "Atomically modify multiple files in YOUR OWN project codebase in a single operation. You have FULL ACCESS to all files in server/, client/src/, client/public/, shared/. All changes succeed or all are rolled back. SAFETY: Snapshot is taken before changes, health check runs after, automatic rollback on failure. Use this instead of multiple self_modify_file calls when changes span multiple files. This is the PREFERRED tool for multi-file fixes like CSS + layout changes.",
    parameters: {
      type: "object",
      properties: {
        modifications: {
          type: "array",
          items: {
            type: "object",
            properties: {
              filePath: {
                type: "string",
                description: "Relative path to the file",
              },
              action: {
                type: "string",
                enum: ["modify", "create", "delete"],
                description: "What to do with the file",
              },
              content: {
                type: "string",
                description:
                  "The COMPLETE file content (required for modify/create, ignored for delete). For 'modify', MUST be the ENTIRE file with all original lines plus additions.",
              },
              description: {
                type: "string",
                description: "Brief description of what this change does",
              },
            },
            required: ["filePath", "action", "description"],
          },
          description:
            "Array of file modifications to apply atomically",
        },
      },
      required: ["modifications"],
    },
  },
};

const selfGetProtectedFiles: Tool = {
  type: "function",
  function: {
    name: "self_get_protected_files",
    description:
      "List all protected files that cannot be modified by the self-improvement engine. These are critical security, auth, and infrastructure files.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
  },
};


// ─── Navigation Tool ────────────────────────────────────────────────

const navigateToPage: Tool = {
  type: "function",
  function: {
    name: "navigate_to_page",
    description:
      "Navigate the user to a specific page within the Archibald Titan app. Use this when the user asks about a feature, wants to go somewhere, or when you need to perform an action on a feature page. ALWAYS navigate first, then use perform_page_action to execute actions. Available pages — CORE: dashboard, dashboard/credits, dashboard/subscription, project-files, sandbox, pricing, contact. FETCHER: fetcher/new, fetcher/jobs, fetcher/credentials, fetcher/export, fetcher/import, fetcher/api-access, fetcher/smart-fetch, fetcher/cli, fetcher/watchdog, fetcher/provider-health, fetcher/health-trends, fetcher/credential-health, fetcher/leak-scanner, fetcher/bulk-sync, fetcher/auto-sync, fetcher/onboarding, fetcher/team, fetcher/team-vault, fetcher/totp-vault, fetcher/notifications, fetcher/history, fetcher/audit-logs, fetcher/developer-docs, fetcher/webhooks, fetcher/api-analytics, fetcher/account, fetcher/settings, fetcher/releases, fetcher/admin, fetcher/self-improvement. BUSINESS: marketplace, replicate, companies, business-plans, grants, grant-applications, crowdfunding, referrals, affiliate. MARKETING: blog, blog-admin, seo, marketing, advertising, master-growth, content-creator. SECURITY: site-monitor, evilginx, blackeye, metasploit, exploitpack, cybermcp, astra, argus, linken-sphere, tor, vpn-chain, proxy-maker, proxy-rotation, ip-rotation, isolated-browser, bin-checker, web-agent. STORAGE: storage. DOWNLOAD: fetcher/download-app.",
    parameters: {
      type: "object",
      properties: {
        page: {
          type: "string",
          description:
            "The page path to navigate to (e.g. 'fetcher/account' for Account Settings & 2FA, 'fetcher/credentials' for Credentials, 'dashboard' for Titan Assistant)",
        },
        reason: {
          type: "string",
          description:
            "Brief explanation of why navigating there (shown to user)",
        },
      },
      required: ["page", "reason"],
    },
  },
};

// ─── Web Research ────────────────────────────────────────────────────

const webSearch: Tool = {
  type: "function",
  function: {
    name: "web_search",
    description:
      "Search the web for current information, news, facts, documentation, or any topic. Use this PROACTIVELY whenever the user asks about anything that benefits from up-to-date information, factual data, research, or real-world references. Use multiple searches with different query phrasings for comprehensive research. After searching, ALWAYS use web_page_read on at least 2-3 results to get full details. Cite sources with URLs in your response. Returns search results with titles, snippets, and URLs.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description:
            "The search query. Be specific and use keywords for best results.",
        },
      },
      required: ["query"],
    },
  },
};

const webPageRead: Tool = {
  type: "function",
  function: {
    name: "web_page_read",
    description:
      "Read and extract the main text content from a web page URL. Use this after web_search to get full details from search results. Read at least 2-3 pages for comprehensive research. Cross-validate information across multiple sources. Returns the page title and main text content.",
    parameters: {
      type: "object",
      properties: {
        url: {
          type: "string",
          description: "The full URL of the web page to read.",
        },
      },
      required: ["url"],
    },
  },
};

// ─── Sandbox Tools ─────────────────────────────────────────────────

const sandboxExec: Tool = {
  type: "function",
  function: {
    name: "sandbox_exec",
    description:
      "Execute a shell command in the user's persistent sandbox environment. The sandbox is a Linux environment with bash, core utilities, Python3, pip3, and Node.js. Use this to VERIFY your work after creating files: run syntax checks (python3 -c 'import py_compile; py_compile.compile(\"file.py\")'), run unit tests, install dependencies (pip3 install -r requirements.txt), or execute scripts. IMPORTANT: Be efficient — verify with 1-2 targeted commands, not exhaustive testing. If a command fails, diagnose and fix the code, don't retry the same command.",
    parameters: {
      type: "object",
      properties: {
        command: {
          type: "string",
          description: "The shell command to execute (e.g., 'python3 scanner.py', 'npm test', 'nmap -sV target.com')",
        },
        sandboxId: {
          type: "number",
          description: "The sandbox ID to execute in. If not provided, uses the user's default sandbox (auto-created if needed).",
        },
        timeoutMs: {
          type: "number",
          description: "Timeout in milliseconds (default: 60000, max: 300000)",
        },
      },
      required: ["command"],
    },
  },
};

const sandboxWriteFile: Tool = {
  type: "function",
  function: {
    name: "sandbox_write_file",
    description:
      "Write a file ONLY to the sandbox environment (not stored in cloud, not downloadable by user). Use this for temporary test files, config overrides, or scratch work. For project files that the user should receive, use create_file instead — it automatically syncs to sandbox too. Use paths like /home/sandbox/project/filename.",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "File path within the sandbox (e.g., '/home/sandbox/scanner.py')",
        },
        content: {
          type: "string",
          description: "The file content to write",
        },
        sandboxId: {
          type: "number",
          description: "The sandbox ID. If not provided, uses the user's default sandbox.",
        },
      },
      required: ["path", "content"],
    },
  },
};

const sandboxReadFile: Tool = {
  type: "function",
  function: {
    name: "sandbox_read_file",
    description:
      "Read a file from the user's sandbox environment. Use this to check output files, read logs, or inspect code that was generated.",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "File path within the sandbox to read",
        },
        sandboxId: {
          type: "number",
          description: "The sandbox ID. If not provided, uses the user's default sandbox.",
        },
      },
      required: ["path"],
    },
  },
};

const sandboxListFiles: Tool = {
  type: "function",
  function: {
    name: "sandbox_list_files",
    description:
      "List files and directories in the user's sandbox. Use this to explore the sandbox filesystem.",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Directory path to list (default: /home/sandbox)",
        },
        sandboxId: {
          type: "number",
          description: "The sandbox ID. If not provided, uses the user's default sandbox.",
        },
      },
      required: [],
    },
  },
};

// ─── Security Tools ────────────────────────────────────────────────

const securityScan: Tool = {
  type: "function",
  function: {
    name: "security_scan",
    description:
      "Run a passive security scan on a target URL. Analyzes HTTP security headers, cookies, SSL/TLS configuration, and generates a professional security report. This is a non-intrusive scan that only sends HEAD requests.",
    parameters: {
      type: "object",
      properties: {
        target: {
          type: "string",
          description: "The target URL or domain to scan (e.g., 'example.com' or 'https://example.com')",
        },
      },
      required: ["target"],
    },
  },
};

const codeSecurityReview: Tool = {
  type: "function",
  function: {
    name: "code_security_review",
    description:
      "Perform an AI-powered security code review on provided source files. Analyzes for SQL injection, XSS, CSRF, authentication bypasses, insecure crypto, hardcoded secrets, path traversal, command injection, and more. Returns a detailed report with severity ratings and fix suggestions.",
    parameters: {
      type: "object",
      properties: {
        files: {
          type: "array",
          items: {
            type: "object",
            properties: {
              filename: { type: "string", description: "The filename" },
              content: { type: "string", description: "The file content to review" },
            },
            required: ["filename", "content"],
          },
          description: "Array of files to review",
        },
      },
      required: ["files"],
    },
  },
};

const portScan: Tool = {
  type: "function",
  function: {
    name: "port_scan",
    description:
      "Scan common ports on a target host to discover open services. Checks 21 common ports (FTP, SSH, HTTP, HTTPS, MySQL, PostgreSQL, Redis, MongoDB, etc.) and identifies running services.",
    parameters: {
      type: "object",
      properties: {
        host: {
          type: "string",
          description: "The target hostname or IP address to scan",
        },
        ports: {
          type: "array",
          items: { type: "number" },
          description: "Optional: specific port numbers to scan. If not provided, scans 21 common ports.",
        },
      },
      required: ["host"],
    },
  },
};

const sslCheck: Tool = {
  type: "function",
  function: {
    name: "ssl_check",
    description:
      "Check the SSL/TLS certificate of a target host. Returns certificate details including issuer, validity dates, days until expiry, TLS version, and any security issues.",
    parameters: {
      type: "object",
      properties: {
        host: {
          type: "string",
          description: "The target hostname to check (e.g., 'example.com')",
        },
      },
      required: ["host"],
    },
  },
};


// ─── Advanced Security Tools ──────────────────────────────────────────────────
const installSecurityToolkit: Tool = {
  type: "function",
  function: {
    name: "install_security_toolkit",
    description:
      "Install a curated set of security tools in the sandbox (nmap, sqlmap, hydra, hashcat, nikto, gobuster, masscan, metasploit-framework, john, aircrack-ng, wireshark-cli, binwalk, volatility3, radare2, impacket, pwntools, scapy). Use this at the start of any offensive security or CTF task to ensure all tools are available. Returns the list of installed tools and their versions.",
    parameters: {
      type: "object",
      properties: {
        tools: {
          type: "array",
          items: { type: "string" },
          description: "Specific tools to install (e.g. ['nmap', 'sqlmap']). Leave empty to install the full toolkit.",
        },
        sandboxId: {
          type: "number",
          description: "The sandbox ID. If not provided, uses the user's default sandbox.",
        },
      },
      required: [],
    },
  },
};
const networkScan: Tool = {
  type: "function",
  function: {
    name: "network_scan",
    description:
      "Run an nmap network scan against a target. Supports full nmap flag syntax. Use for port discovery, service enumeration, OS detection, and vulnerability scanning. Examples: '-sV -p 1-65535 target.com', '-sU --top-ports 100 target.com', '-A -T4 target.com', '--script vuln target.com'.",
    parameters: {
      type: "object",
      properties: {
        target: {
          type: "string",
          description: "Target IP address, hostname, or CIDR range (e.g. '192.168.1.0/24', 'target.com')",
        },
        flags: {
          type: "string",
          description: "nmap flags and options (e.g. '-sV -p 80,443,8080', '-A -T4', '--script vuln'). Default: '-sV --top-ports 1000'",
        },
        sandboxId: {
          type: "number",
          description: "The sandbox ID. If not provided, uses the user's default sandbox.",
        },
      },
      required: ["target"],
    },
  },
};
const generateYaraRule: Tool = {
  type: "function",
  function: {
    name: "generate_yara_rule",
    description:
      "Generate a YARA rule for malware detection based on a description, sample bytes, strings, or behavioral patterns. Returns a complete, valid YARA rule file ready for use with yara-python or any YARA scanner.",
    parameters: {
      type: "object",
      properties: {
        description: {
          type: "string",
          description: "Description of what to detect (e.g. 'Detect Emotet dropper', 'Match files containing base64-encoded PowerShell', 'Detect Cobalt Strike beacon')",
        },
        strings: {
          type: "array",
          items: { type: "string" },
          description: "Known strings, byte patterns, or hex sequences to include in the rule",
        },
        ruleName: {
          type: "string",
          description: "Name for the YARA rule (e.g. 'Emotet_Dropper_v2'). Auto-generated if not provided.",
        },
      },
      required: ["description"],
    },
  },
};
const generateSigmaRule: Tool = {
  type: "function",
  function: {
    name: "generate_sigma_rule",
    description:
      "Generate a Sigma detection rule for SIEM systems (Splunk, Elastic, QRadar, etc.) based on a description of the attack technique or log pattern. Returns a complete Sigma YAML rule with ATT&CK mapping.",
    parameters: {
      type: "object",
      properties: {
        description: {
          type: "string",
          description: "Description of the attack or behavior to detect (e.g. 'Detect pass-the-hash via Windows Security logs', 'Detect PowerShell download cradle', 'Detect LSASS memory dumping')",
        },
        logSource: {
          type: "string",
          description: "Log source type (e.g. 'windows', 'linux', 'aws', 'azure', 'network'). Default: 'windows'",
        },
        attackTechnique: {
          type: "string",
          description: "MITRE ATT&CK technique ID (e.g. 'T1003.001', 'T1059.001'). Optional — will be inferred if not provided.",
        },
      },
      required: ["description"],
    },
  },
};
const hashCrack: Tool = {
  type: "function",
  function: {
    name: "hash_crack",
    description:
      "Attempt to crack a password hash using hashcat or john in the sandbox. Supports MD5, SHA1, SHA256, SHA512, NTLM, bcrypt, WPA2, and more. Uses rockyou.txt and common wordlists by default. Returns cracked password if successful.",
    parameters: {
      type: "object",
      properties: {
        hash: {
          type: "string",
          description: "The hash to crack (e.g. '5f4dcc3b5aa765d61d8327deb882cf99' for MD5)",
        },
        hashType: {
          type: "string",
          description: "Hash type (e.g. 'md5', 'sha1', 'sha256', 'ntlm', 'bcrypt', 'wpa2', 'sha512crypt'). Auto-detected if not provided.",
        },
        wordlist: {
          type: "string",
          description: "Wordlist to use: 'rockyou' (default), 'common', 'custom'. For custom, provide the wordlist content.",
        },
        rules: {
          type: "string",
          description: "Hashcat rules to apply (e.g. 'best64', 'dive', 'rockyou-30000'). Optional.",
        },
        sandboxId: {
          type: "number",
          description: "The sandbox ID. If not provided, uses the user's default sandbox.",
        },
      },
      required: ["hash"],
    },
  },
};
const generatePayload: Tool = {
  type: "function",
  function: {
    name: "generate_payload",
    description:
      "Generate a security payload for authorized penetration testing. Supports shellcode, reverse shells, bind shells, web shells, macro payloads, and encoded variants. Returns the payload code/bytes and usage instructions.",
    parameters: {
      type: "object",
      properties: {
        payloadType: {
          type: "string",
          description: "Type of payload: 'reverse_shell', 'bind_shell', 'web_shell', 'shellcode', 'macro', 'powershell_cradle', 'msfvenom'",
        },
        lhost: {
          type: "string",
          description: "Attacker IP address for reverse connections (e.g. '10.10.14.1')",
        },
        lport: {
          type: "number",
          description: "Listener port (e.g. 4444)",
        },
        platform: {
          type: "string",
          description: "Target platform: 'windows', 'linux', 'macos', 'web'. Default: 'linux'",
        },
        language: {
          type: "string",
          description: "Payload language: 'python', 'bash', 'powershell', 'c', 'php', 'asp', 'java'. Auto-selected based on platform if not provided.",
        },
        encoding: {
          type: "string",
          description: "Encoding/obfuscation: 'none', 'base64', 'xor', 'shikata_ga_nai'. Default: 'none'",
        },
      },
      required: ["payloadType"],
    },
  },
};
const osintLookup: Tool = {
  type: "function",
  function: {
    name: "osint_lookup",
    description:
      "Perform OSINT (Open Source Intelligence) lookups on a target. Aggregates data from multiple sources: WHOIS, DNS records, Shodan/Censys (if API key available), certificate transparency logs, breach databases, social media presence, and GitHub. Returns a structured intelligence report.",
    parameters: {
      type: "object",
      properties: {
        target: {
          type: "string",
          description: "Target to investigate: domain, IP address, email, username, or company name",
        },
        targetType: {
          type: "string",
          description: "Type of target: 'domain', 'ip', 'email', 'username', 'company'. Auto-detected if not provided.",
        },
        depth: {
          type: "string",
          description: "Investigation depth: 'quick' (DNS/WHOIS only), 'standard' (default), 'deep' (all sources including breach data)",
        },
      },
      required: ["target"],
    },
  },
};
const cveLookup: Tool = {
  type: "function",
  function: {
    name: "cve_lookup",
    description:
      "Look up CVE details, CVSS scores, affected versions, and available exploits from NVD (National Vulnerability Database) and Exploit-DB. Use before building exploits to get accurate vulnerability details.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "CVE ID (e.g. 'CVE-2021-44228') or keyword search (e.g. 'Apache Log4j RCE', 'SMB EternalBlue')",
        },
        includeExploits: {
          type: "boolean",
          description: "Whether to include known exploit code from Exploit-DB. Default: true",
        },
      },
      required: ["query"],
    },
  },
};
const runExploit: Tool = {
  type: "function",
  function: {
    name: "run_exploit",
    description:
      "Execute an exploit or penetration testing tool in the sandbox against a target. Supports Metasploit modules, custom exploit scripts, sqlmap, hydra, and other offensive tools. Returns the output and any captured credentials/shells.",
    parameters: {
      type: "object",
      properties: {
        tool: {
          type: "string",
          description: "Tool to use: 'metasploit', 'sqlmap', 'hydra', 'nikto', 'gobuster', 'wfuzz', 'ffuf', 'custom'",
        },
        target: {
          type: "string",
          description: "Target URL, IP, or host (e.g. 'http://target.com/login', '10.10.10.1')",
        },
        options: {
          type: "string",
          description: "Tool-specific options (e.g. for metasploit: 'use exploit/multi/handler; set PAYLOAD windows/x64/meterpreter/reverse_tcp; set LHOST 10.10.14.1; set LPORT 4444; run')",
        },
        scriptPath: {
          type: "string",
          description: "Path to a custom exploit script in the sandbox (e.g. '/home/sandbox/exploit.py'). Used when tool is 'custom'.",
        },
        sandboxId: {
          type: "number",
          description: "The sandbox ID. If not provided, uses the user's default sandbox.",
        },
      },
      required: ["tool", "target"],
    },
  },
};
const decompileBinary: Tool = {
  type: "function",
  function: {
    name: "decompile_binary",
    description:
      "Decompile or disassemble a binary file using radare2 or Ghidra (headless). Extracts functions, strings, imports, and pseudo-C code. Use for reverse engineering CTF challenges, malware analysis, or binary exploitation.",
    parameters: {
      type: "object",
      properties: {
        filePath: {
          type: "string",
          description: "Path to the binary in the sandbox (e.g. '/home/sandbox/challenge.elf', '/home/sandbox/malware.exe')",
        },
        tool: {
          type: "string",
          description: "Tool to use: 'radare2' (default, fast), 'ghidra' (thorough, slower), 'strings' (quick string extraction)",
        },
        analysis: {
          type: "string",
          description: "Analysis type: 'full' (complete decompilation), 'functions' (list functions), 'strings' (extract strings), 'imports' (list imports/exports), 'main' (decompile main function only). Default: 'full'",
        },
        sandboxId: {
          type: "number",
          description: "The sandbox ID. If not provided, uses the user's default sandbox.",
        },
      },
      required: ["filePath"],
    },
  },
};
const fuzzerRun: Tool = {
  type: "function",
  function: {
    name: "fuzzer_run",
    description:
      "Run a fuzzer against a target to discover vulnerabilities, hidden endpoints, or crash conditions. Supports web fuzzing (ffuf/gobuster), API fuzzing, and binary fuzzing (AFL++). Returns discovered paths, parameters, or crash inputs.",
    parameters: {
      type: "object",
      properties: {
        target: {
          type: "string",
          description: "Target URL or binary path (e.g. 'http://target.com/FUZZ', '/home/sandbox/vulnerable_binary')",
        },
        fuzzerType: {
          type: "string",
          description: "Type of fuzzer: 'web' (ffuf/gobuster for HTTP), 'api' (parameter fuzzing), 'binary' (AFL++ for binaries). Default: 'web'",
        },
        wordlist: {
          type: "string",
          description: "Wordlist: 'common' (default), 'big', 'api', 'directories', 'files', or a custom path in the sandbox",
        },
        options: {
          type: "string",
          description: "Additional fuzzer options (e.g. '-mc 200,301,302', '-H \'Authorization: Bearer token\'', '-X POST -d \'user=FUZZ\'')",
        },
        sandboxId: {
          type: "number",
          description: "The sandbox ID. If not provided, uses the user's default sandbox.",
        },
      },
      required: ["target"],
    },
  },
};

// ── New Security Tool Definitions (#51-#62) ──────────────────────────────

const shellcodeGenTool: Tool = {
  type: "function",
  function: {
    name: "shellcode_gen",
    description: "Generate raw shellcode for a target architecture and OS. Supports x86/x64/ARM for Linux/Windows. Can encode with XOR, base64, or shikata_ga_nai. Returns shellcode in hex, C array, Python bytes, or base64 format. Uses msfvenom if available, falls back to pwntools.",
    parameters: {
      type: "object",
      properties: {
        arch: { type: "string", description: "Target architecture: 'x86', 'x64' (default), 'arm'" },
        os: { type: "string", description: "Target OS: 'linux' (default), 'windows'" },
        shellcodeType: { type: "string", description: "Type: 'reverse_shell' (default), 'bind_shell', 'shell', 'exec'" },
        lhost: { type: "string", description: "Attacker IP for reverse shell (default: 10.10.14.1)" },
        lport: { type: "number", description: "Listener port (default: 4444)" },
        encoder: { type: "string", description: "Encoding: 'none' (default), 'xor', 'base64', 'x86/shikata_ga_nai'" },
        outputFormat: { type: "string", description: "Output format: 'hex' (default), 'c', 'python', 'base64'" },
        sandboxId: { type: "number", description: "Sandbox ID (optional, uses default)" },
      },
      required: [],
    },
  },
};

const codeObfuscateTool: Tool = {
  type: "function",
  function: {
    name: "code_obfuscate",
    description: "Obfuscate code to evade static analysis and AV detection. Supports Python (PyArmor/base64+zlib), PowerShell (base64 encoded command + char array), JavaScript (atob/eval + hex), and Bash (base64 pipe). Returns obfuscated version ready to execute.",
    parameters: {
      type: "object",
      properties: {
        code: { type: "string", description: "The source code to obfuscate" },
        language: { type: "string", description: "Language: 'python' (default), 'powershell', 'javascript', 'bash'" },
        level: { type: "string", description: "Obfuscation level: 'light', 'medium' (default), 'heavy'" },
        sandboxId: { type: "number", description: "Sandbox ID (optional)" },
      },
      required: ["code"],
    },
  },
};

const privescCheckTool: Tool = {
  type: "function",
  function: {
    name: "privesc_check",
    description: "Run privilege escalation checks against the sandbox or a target OS. For Linux: runs LinPEAS or manual checks (SUID, sudo, capabilities, cron, kernel). For Windows: provides WinPEAS commands and manual checklist. Returns prioritised findings.",
    parameters: {
      type: "object",
      properties: {
        targetOs: { type: "string", description: "Target OS: 'linux' (default), 'windows'" },
        depth: { type: "string", description: "Check depth: 'quick', 'standard' (default), 'thorough'" },
        sandboxId: { type: "number", description: "Sandbox ID (optional)" },
      },
      required: [],
    },
  },
};

const webAttackTool: Tool = {
  type: "function",
  function: {
    name: "web_attack",
    description: "Run web application attacks and security tests against a target URL. Supports: nikto (full scan), sqli (SQLMap injection), xss (XSStrike cross-site scripting), ssrf (server-side request forgery), headers (security headers analysis). Returns findings and vulnerabilities.",
    parameters: {
      type: "object",
      properties: {
        target: { type: "string", description: "Target URL (e.g. 'http://target.com/page?id=1')" },
        attackType: { type: "string", description: "Attack type: 'scan'/'nikto', 'sqli', 'xss', 'ssrf', 'headers'" },
        options: { type: "string", description: "Additional options passed to the tool" },
        sandboxId: { type: "number", description: "Sandbox ID (optional)" },
      },
      required: ["target"],
    },
  },
};

const threatIntelLookupTool: Tool = {
  type: "function",
  function: {
    name: "threat_intel_lookup",
    description: "Look up an IOC (IP address, domain, file hash, or URL) across multiple threat intelligence sources simultaneously: VirusTotal, AbuseIPDB (IPs), AlienVault OTX, and Shodan (IPs). Returns aggregated verdict and details from each source.",
    parameters: {
      type: "object",
      properties: {
        ioc: { type: "string", description: "The IOC to look up: IP address, domain, MD5/SHA1/SHA256 hash, or URL" },
        iocType: { type: "string", description: "IOC type: 'auto' (default, auto-detect), 'ip', 'domain', 'md5', 'sha1', 'sha256', 'url'" },
        sandboxId: { type: "number", description: "Sandbox ID (optional)" },
      },
      required: ["ioc"],
    },
  },
};

const trafficCaptureTool: Tool = {
  type: "function",
  function: {
    name: "traffic_capture",
    description: "Capture network traffic in the sandbox using tcpdump, then analyse with Scapy. Returns protocol breakdown, top source/destination IPs, port statistics, DNS queries, and suspicious patterns. Saves PCAP file for further analysis.",
    parameters: {
      type: "object",
      properties: {
        interface: { type: "string", description: "Network interface to capture on (default: 'eth0')" },
        duration: { type: "number", description: "Capture duration in seconds (default: 10)" },
        filter: { type: "string", description: "BPF filter expression (e.g. 'tcp port 80', 'host 192.168.1.1')" },
        analysisType: { type: "string", description: "Analysis type: 'summary' (default), 'detailed', 'suspicious'" },
        sandboxId: { type: "number", description: "Sandbox ID (optional)" },
      },
      required: [],
    },
  },
};

const adAttackTool: Tool = {
  type: "function",
  function: {
    name: "ad_attack",
    description: "Execute Active Directory attacks using Impacket tools. Supports: kerberoasting (GetUserSPNs), AS-REP roasting (GetNPUsers), DCSync (secretsdump), WMIExec remote execution, PSExec, LDAP enumeration, and BloodHound collection. Returns hashes, credentials, or enumeration data.",
    parameters: {
      type: "object",
      properties: {
        attackType: { type: "string", description: "Attack: 'enum'/'ldap', 'kerberoast', 'asreproast', 'dcsync', 'wmiexec', 'psexec', 'bloodhound'" },
        dcIp: { type: "string", description: "Domain controller IP address" },
        domain: { type: "string", description: "Domain name (e.g. 'corp.local')" },
        username: { type: "string", description: "Username for authentication" },
        password: { type: "string", description: "Password for authentication" },
        hash: { type: "string", description: "NTLM hash for pass-the-hash (alternative to password)" },
        sandboxId: { type: "number", description: "Sandbox ID (optional)" },
      },
      required: ["attackType"],
    },
  },
};

const cloudEnumTool: Tool = {
  type: "function",
  function: {
    name: "cloud_enum",
    description: "Enumerate cloud infrastructure using stolen credentials or from inside a cloud instance. Supports AWS (identity, IAM, S3, EC2, Lambda, metadata), Azure (ROADtools, AADInternals), GCP (gcloud, metadata), and Kubernetes (kubectl, RBAC, secrets). Returns discovered resources and misconfigurations.",
    parameters: {
      type: "object",
      properties: {
        provider: { type: "string", description: "Cloud provider: 'aws' (default), 'azure', 'gcp', 'kubernetes'" },
        enumType: { type: "string", description: "What to enumerate: 'identity', 'iam', 's3', 'ec2', 'lambda', 'metadata', 'all'" },
        accessKey: { type: "string", description: "AWS access key ID (optional)" },
        secretKey: { type: "string", description: "AWS secret access key (optional)" },
        sessionToken: { type: "string", description: "AWS session token (optional, for temporary credentials)" },
        sandboxId: { type: "number", description: "Sandbox ID (optional)" },
      },
      required: ["provider"],
    },
  },
};

const generatePentestReportTool: Tool = {
  type: "function",
  function: {
    name: "generate_pentest_report",
    description: "Generate a professional penetration test report in Markdown format. Includes executive summary, risk summary table, scope and methodology, detailed findings with CVSS v3.1 scores, MITRE ATT&CK mappings, evidence, business impact, and specific remediation steps. Saves report to sandbox.",
    parameters: {
      type: "object",
      properties: {
        clientName: { type: "string", description: "Client/company name" },
        scope: { type: "string", description: "Scope of the assessment (e.g. 'Internal network 192.168.1.0/24, web app https://target.com')" },
        tester: { type: "string", description: "Tester name or team" },
        findings: {
          type: "array",
          description: "Array of findings. Each finding: {title, severity, description, evidence, impact, remediation}",
          items: { type: "object" },
        },
        format: { type: "string", description: "Output format: 'markdown' (default), 'html'" },
        sandboxId: { type: "number", description: "Sandbox ID (optional)" },
      },
      required: [],
    },
  },
};

const sandboxDeleteFileTool: Tool = {
  type: "function",
  function: {
    name: "sandbox_delete_file",
    description: "Delete a file or directory from the sandbox filesystem. Use recursive=true to delete directories. Protected system paths (/, /etc, /usr, /bin) cannot be deleted.",
    parameters: {
      type: "object",
      properties: {
        filePath: { type: "string", description: "Absolute path to the file or directory to delete" },
        recursive: { type: "boolean", description: "If true, delete directory and all contents (rm -rf). Default: false" },
        sandboxId: { type: "number", description: "Sandbox ID (optional)" },
      },
      required: ["filePath"],
    },
  },
};

const sandboxDownloadUrlTool: Tool = {
  type: "function",
  function: {
    name: "sandbox_download_url",
    description: "Download a file from a URL into the sandbox filesystem. Useful for pulling exploit code, wordlists, tools, or any remote resource. Returns HTTP status, file size, and save path.",
    parameters: {
      type: "object",
      properties: {
        url: { type: "string", description: "URL to download (http/https)" },
        outputPath: { type: "string", description: "Destination path in sandbox (e.g. '/tmp/exploit.py', '/home/sandbox/wordlist.txt')" },
        followRedirects: { type: "boolean", description: "Follow HTTP redirects (default: true)" },
        sandboxId: { type: "number", description: "Sandbox ID (optional)" },
      },
      required: ["url"],
    },
  },
};

// ─── Auto-Fix Tools ────────────────────────────────────────────────

const autoFixVulnerability: Tool = {
  type: "function",
  function: {
    name: "auto_fix_vulnerability",
    description:
      "Automatically fix a single vulnerability found by the code security reviewer. Takes source code and a specific vulnerability, uses AI to generate patched code with explanations and confidence scores.",
    parameters: {
      type: "object",
      properties: {
        filename: { type: "string", description: "The filename of the code to fix" },
        code: { type: "string", description: "The full source code of the file" },
        issueTitle: { type: "string", description: "Title of the vulnerability" },
        issueSeverity: { type: "string", enum: ["critical", "high", "medium", "low"], description: "Severity level" },
        issueCategory: { type: "string", description: "Category (e.g., sql_injection, xss)" },
        issueDescription: { type: "string", description: "Detailed description" },
        issueSuggestion: { type: "string", description: "Suggested fix from code review" },
        issueLine: { type: "number", description: "Line number (optional)" },
      },
      required: ["filename", "code", "issueTitle", "issueSeverity", "issueCategory", "issueDescription", "issueSuggestion"],
    },
  },
};

// ── Build Error Recovery: suggest_fix ──────────────────────────────────────
const suggestFix: Tool = {
  type: "function",
  function: {
    name: "suggest_fix",
    description:
      "Diagnose a TypeScript/build error and suggest a targeted fix. Use this whenever a build, type-check, or test run fails. Provide the error message and the relevant file path; the tool returns a structured diagnosis with the root cause, the exact code change needed, and a confidence score.",
    parameters: {
      type: "object",
      properties: {
        error_message: {
          type: "string",
          description: "The full error output from tsc, vitest, or the build process",
        },
        file_path: {
          type: "string",
          description: "Path to the file where the error occurred (e.g. server/chat-router.ts)",
        },
        code_context: {
          type: "string",
          description: "Optional: the relevant lines of code around the error (10-30 lines)",
        },
      },
      required: ["error_message", "file_path"],
    },
  },
};

const autoFixAll: Tool = {
  type: "function",
  function: {
    name: "auto_fix_all_vulnerabilities",
    description:
      "Automatically fix ALL vulnerabilities in one batch. Takes source files and the full review report, generates patched code for every fixable issue. Fixes applied cumulatively (critical first).",
    parameters: {
      type: "object",
      properties: {
        files: {
          type: "array",
          items: {
            type: "object",
            properties: {
              filename: { type: "string" },
              content: { type: "string" },
            },
            required: ["filename", "content"],
          },
          description: "Array of source files to fix",
        },
        issues: {
          type: "array",
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              severity: { type: "string", enum: ["critical", "high", "medium", "low"] },
              category: { type: "string" },
              description: { type: "string" },
              suggestion: { type: "string" },
              file: { type: "string" },
              line: { type: "number" },
            },
            required: ["title", "severity", "category", "description", "suggestion", "file"],
          },
          description: "Array of vulnerability issues from code review",
        },
      },
      required: ["files", "issues"],
    },
  },
};

// ─── App Research & Clone Tools ────────────────────────────────────

const appResearch: Tool = {
  type: "function",
  function: {
    name: "app_research",
    description:
      "Research an existing application by analyzing its website, features, UI patterns, and functionality. Produces a structured feature analysis report. Use before app_clone.",
    parameters: {
      type: "object",
      properties: {
        target: { type: "string", description: "URL or name of the app to research" },
        focusAreas: { type: "array", items: { type: "string" }, description: "Specific features to focus on (optional)" },
      },
      required: ["target"],
    },
  },
};

const appClone: Tool = {
  type: "function",
  function: {
    name: "app_clone",
    description:
      "Generate a complete build plan and start building a clone of an application based on research results. Creates the full project structure and builds it step by step in the sandbox.",
    parameters: {
      type: "object",
      properties: {
        appName: { type: "string", description: "Name for the clone project" },
        features: { type: "array", items: { type: "string" }, description: "Features to implement" },
        techStack: { type: "string", description: "Preferred tech stack (optional)" },
        priority: { type: "string", enum: ["mvp", "full"], description: "mvp for core features, full for complete parity" },
      },
      required: ["appName", "features"],
    },
  },
};

const websiteReplicate: Tool = {
  type: "function",
  function: {
    name: "website_replicate",
    description:
      "Create a Website Replicate project that researches a target website/app, analyzes its features, generates a build plan, and builds a working clone with custom branding and optional Stripe payment integration. This is the full-featured replication workflow. Use navigate_to_page to send the user to /replicate to view their projects.",
    parameters: {
      type: "object",
      properties: {
        targetUrl: { type: "string", description: "URL or name of the website/app to replicate" },
        targetName: { type: "string", description: "Name for the replicate project" },
        priority: { type: "string", enum: ["mvp", "full"], description: "mvp for core features only, full for complete feature parity" },
        brandName: { type: "string", description: "Custom brand name to use instead of the original (optional)" },
        brandTagline: { type: "string", description: "Custom tagline for the clone (optional)" },
        autoResearch: { type: "boolean", description: "If true, automatically start research after creating the project (default: true)" },
      },
      required: ["targetUrl", "targetName"],
    },
  },
};

// ─── Professional Builder Tools ─────────────────────────────────────

const selfDependencyAudit: Tool = {
  type: "function",
  function: {
    name: "self_dependency_audit",
    description:
      "Audit project dependencies for known vulnerabilities, outdated packages, and license issues. Scans package.json and reports security advisories, version drift, and upgrade recommendations. Use this before deploying or after adding new packages.",
    parameters: {
      type: "object",
      properties: {
        focus: {
          type: "string",
          enum: ["security", "outdated", "all"],
          description: "Focus area: 'security' for CVEs only, 'outdated' for version drift, 'all' for comprehensive audit (default: all)",
        },
      },
      required: [],
    },
  },
};

const selfGrepCodebase: Tool = {
  type: "function",
  function: {
    name: "self_grep_codebase",
    description:
      "Search the entire codebase for a pattern using regex. Returns matching lines with file paths and line numbers. Useful for finding usages, dead code, hardcoded secrets, TODO/FIXME comments, deprecated API calls, or tracing how a function/variable is used across the project. Excludes node_modules and dist.",
    parameters: {
      type: "object",
      properties: {
        pattern: {
          type: "string",
          description: "Regex pattern to search for (e.g., 'TODO|FIXME|HACK', 'password.*=.*[\"\']', 'console\\.log')",
        },
        filePattern: {
          type: "string",
          description: "Glob pattern to filter files (e.g., '*.ts', '*.tsx', 'server/**/*.ts'). Default: all source files",
        },
        maxResults: {
          type: "number",
          description: "Maximum number of results to return (default: 50)",
        },
      },
      required: ["pattern"],
    },
  },
};

const selfGitDiff: Tool = {
  type: "function",
  function: {
    name: "self_git_diff",
    description:
      "Preview the current uncommitted changes in the codebase. Shows a git-style diff of all modified, added, and deleted files. Use this to review staged changes before flushing or pushing to GitHub, or to verify what modifications were made during a build session.",
    parameters: {
      type: "object",
      properties: {
        filePath: {
          type: "string",
          description: "Optional: show diff for a specific file only. If omitted, shows all changes.",
        },
        staged: {
          type: "boolean",
          description: "If true, show only staged (git add) changes. Default: show all working tree changes.",
        },
      },
      required: [],
    },
  },
};

const selfEnvCheck: Tool = {
  type: "function",
  function: {
    name: "self_env_check",
    description:
      "Verify that all required environment variables are set and valid. Checks for missing variables, empty values, and common misconfigurations. Reports which services are properly configured (database, API keys, GitHub, Stripe, etc.) without revealing actual secret values.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
  },
};

const selfDbSchemaInspect: Tool = {
  type: "function",
  function: {
    name: "self_db_schema_inspect",
    description:
      "Inspect the current database schema. Lists all tables with their columns, types, indexes, and foreign keys. Use this to understand the data model before making changes, to verify migrations ran correctly, or to plan new features that need database changes.",
    parameters: {
      type: "object",
      properties: {
        table: {
          type: "string",
          description: "Optional: inspect a specific table only. If omitted, lists all tables with summary.",
        },
      },
      required: [],
    },
  },
};

const selfCodeStats: Tool = {
  type: "function",
  function: {
    name: "self_code_stats",
    description:
      "Get comprehensive codebase statistics: total lines of code, file counts by type, largest files, function counts, import analysis, and complexity indicators. Use this to understand project scale, identify bloated files, or track growth over time.",
    parameters: {
      type: "object",
      properties: {
        directory: {
          type: "string",
          description: "Optional: analyze a specific directory (e.g., 'server', 'client/src'). Default: entire project.",
        },
      },
      required: [],
    },
  },
};

const selfDeploymentCheck: Tool = {
  type: "function",
  function: {
    name: "self_deployment_check",
    description:
      "Run a comprehensive pre-deployment readiness check. Validates: TypeScript compilation, environment variables, database connectivity, API endpoint health, critical file integrity, and configuration consistency. Returns a pass/fail report with actionable fix suggestions for any issues found.",
    parameters: {
      type: "object",
      properties: {
        quick: {
          type: "boolean",
          description: "If true, run only critical checks (env + db + types). Default: full check.",
        },
      },
      required: [],
    },
  },
};

// ─── Checkpoint Tools────────────────────────────────────────────────────

const selfSaveCheckpoint: Tool = {
  type: "function",
  function: {
    name: "self_save_checkpoint",
    description:
      "Save a named checkpoint of the entire project. Captures ALL source files (server, client, shared, drizzle, configs) so the project can be fully restored later. Use this BEFORE making risky changes, after completing a major feature, or when the user asks to save progress. The checkpoint is stored in the database and marked as known-good.",
    parameters: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description:
            "A descriptive name for this checkpoint. Examples: 'before-auth-refactor', 'marketplace-v2-complete', 'pre-deploy-feb-20'. Keep it short and meaningful.",
        },
      },
      required: ["name"],
    },
  },
};

const selfListCheckpoints: Tool = {
  type: "function",
  function: {
    name: "self_list_checkpoints",
    description:
      "List all saved checkpoints (most recent first). Shows checkpoint name, file count, status, and creation date. Use this to find a checkpoint ID before rolling back.",
    parameters: {
      type: "object",
      properties: {
        limit: {
          type: "number",
          description: "Maximum number of checkpoints to return. Default: 20.",
        },
      },
      required: [],
    },
  },
};

const selfRollbackToCheckpoint: Tool = {
  type: "function",
  function: {
    name: "self_rollback_to_checkpoint",
    description:
      "Rollback the entire project to a saved checkpoint. Restores ALL files that were captured in that checkpoint. If no checkpoint ID is provided, rolls back to the most recent checkpoint. SAFETY: Automatically saves a backup of the current state before rolling back, so you can always undo the rollback.",
    parameters: {
      type: "object",
      properties: {
        checkpointId: {
          type: "number",
          description:
            "The checkpoint ID to roll back to. Use self_list_checkpoints to find available IDs. If omitted, rolls back to the most recent checkpoint.",
        },
      },
      required: [],
    },
  },
};

// ─── Advanced Builder Analysis Tools ──────────────────────────────────────

const selfAnalyzeFile: Tool = {
  type: "function",
  function: {
    name: "self_analyze_file",
    description:
      "Deep analysis of a source file: lists all imports, exports, functions, classes, and identifies potential issues like missing error handling, unused variables, or security concerns. Use this BEFORE modifying any file to understand its structure.",
    parameters: {
      type: "object",
      properties: {
        filePath: {
          type: "string",
          description: "Relative path to the file to analyze (e.g. 'server/chat-router.ts')",
        },
      },
      required: ["filePath"],
    },
  },
};

const selfFindDeadCode: Tool = {
  type: "function",
  function: {
    name: "self_find_dead_code",
    description:
      "Scan the codebase for dead code: exported functions/constants that are never imported anywhere else. Helps identify cleanup opportunities and reduce bundle size.",
    parameters: {
      type: "object",
      properties: {
        directory: {
          type: "string",
          description: "Directory to scan (default: 'server'). Options: 'server', 'client/src', 'shared'",
        },
      },
      required: [],
    },
  },
};

const selfApiMap: Tool = {
  type: "function",
  function: {
    name: "self_api_map",
    description:
      "Map all API endpoints in the project: tRPC procedures (with auth level), Express routes, and webhook handlers. Essential before adding or modifying any API endpoint to avoid conflicts and understand the full API surface.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
  },
};


// ─── Project Builder Tools (create real downloadable files) ──────────
const createProjectFile: Tool = {
  type: "function",
  function: {
    name: "create_file",
    description:
      "Create a file in the user's project. Files are stored in cloud (downloadable by user) AND automatically synced to the sandbox filesystem at /home/sandbox/projects/<fileName>. You do NOT need to also call sandbox_write_file — create_file handles both. ALWAYS use this for every file you build. Every file must contain COMPLETE, WORKING code — no stubs, no TODOs, no placeholders. CRITICAL: The fileName MUST always start with a project root folder name (e.g., 'my-project/main.py', NOT just 'main.py'). All files for a build MUST share the same project root folder so they are grouped together in the user's project list.",
    parameters: {
      type: "object",
      properties: {
        fileName: {
          type: "string",
          description: "File path that MUST start with the project name as the root folder. Format: '<project-name>/<path>'. Examples: 'port-scanner/main.py', 'my-landing-page/src/index.html', 'evilginx2/cmd/main.go', 'todo-app/package.json'. The project name should be a kebab-case slug derived from what you're building. NEVER create files without a project root folder — loose files like 'main.py' or 'src/index.html' are FORBIDDEN.",
        },
        content: {
          type: "string",
          description: "The complete file content",
        },
        language: {
          type: "string",
          description: "Programming language for syntax highlighting (e.g., 'html', 'css', 'javascript', 'typescript', 'python', 'json')",
        },
      },
      required: ["fileName", "content"],
    },
  },
};
const createGithubRepo: Tool = {
  type: "function",
  function: {
    name: "create_github_repo",
    description:
      "Create a new GitHub repository for the user's project. Requires the user to have connected their GitHub PAT in settings. Returns the repo URL.",
    parameters: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Repository name (lowercase, hyphens allowed, e.g., 'my-landing-page')",
        },
        description: {
          type: "string",
          description: "Short description of the repository",
        },
        isPrivate: {
          type: "boolean",
          description: "Whether the repo should be private (default: true)",
        },
      },
      required: ["name"],
    },
  },
};
const pushToGithubRepo: Tool = {
  type: "function",
  function: {
    name: "push_to_github",
    description:
      "Push all project files from the current conversation to a GitHub repository. The repo must have been created first with create_github_repo, or the user can provide an existing repo name.",
    parameters: {
      type: "object",
      properties: {
        repoFullName: {
          type: "string",
          description: "Full repo name (e.g., 'username/repo-name'). If not provided, uses the last created repo.",
        },
        commitMessage: {
          type: "string",
          description: "Git commit message (default: 'Initial commit from Titan Builder')",
        },
      },
      required: [],
    },
  },
};
const generatePdfTool: Tool = {
  type: "function",
  function: {
    name: "generate_pdf",
    description:
      "Generate a real, downloadable PDF document from structured content. " +
      "Use this tool whenever the user asks for a PDF report, comparison document, analysis, or any deliverable in PDF format. " +
      "This produces a properly formatted, styled PDF file and returns a direct download URL. " +
      "IMPORTANT: Use this tool instead of create_file + provide_project_zip for PDF deliverables — " +
      "create_file cannot produce valid binary PDFs and provide_project_zip wraps files in a ZIP which the user must unzip. " +
      "This tool generates a real PDF the user can open directly. " +
      "You can pass content either as a 'sections' array (preferred for structured reports) or as a single 'content' markdown string.",
    parameters: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: "The main title of the PDF document, shown prominently at the top. Example: 'Virelle vs Competitors — Website Analysis Report'",
        },
        subtitle: {
          type: "string",
          description: "Optional subtitle shown below the title. Example: 'Competitive Analysis & Improvement Recommendations'",
        },
        fileName: {
          type: "string",
          description: "Desired filename for the PDF (without path). Example: 'virelle-competitor-analysis.pdf'. Defaults to a slugified version of the title.",
        },
        content: {
          type: "string",
          description:
            "The full report content as a markdown string. Use ## headings to create sections, " +
            "- bullet points for lists, and plain paragraphs for body text. " +
            "Use this when you want to pass the entire document as one markdown block. " +
            "Alternatively, use the 'sections' array for more structured control.",
        },
        sections: {
          type: "array",
          description:
            "Ordered list of sections to render in the PDF. Each section has an optional heading and a body. " +
            "Use this for structured reports where you want explicit control over each section.",
          items: {
            type: "object",
            properties: {
              heading: {
                type: "string",
                description: "Section heading (rendered as a bold H2 with an accent underline). Optional.",
              },
              body: {
                type: "string",
                description:
                  "Section body text. Supports markdown-style formatting: " +
                  "## sub-headings, - bullet points, 1. numbered lists, **bold** text, and --- horizontal rules.",
              },
            },
            required: ["body"],
          },
        },
      },
      required: ["title"],
    },
  },
};

const generateSpreadsheetTool: Tool = {
  type: "function",
  function: {
    name: "generate_spreadsheet",
    description:
      "Generate a real, downloadable XLSX or CSV spreadsheet from structured data. " +
      "Use this tool whenever the user asks for a spreadsheet, Excel file, CSV export, data table, or any tabular data deliverable. " +
      "This produces a properly formatted, styled XLSX file (or plain CSV) and returns a direct download URL. " +
      "IMPORTANT: Use this tool instead of create_file for spreadsheet deliverables — " +
      "create_file cannot produce valid binary XLSX files and will corrupt them. " +
      "For CSV, this tool handles proper escaping and encoding. " +
      "You can pass a single sheet via top-level 'columns' + 'rows', or multiple sheets via the 'sheets' array.",
    parameters: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: "Title of the spreadsheet, used as the default sheet name and filename. Example: 'Virelle Competitor Analysis'",
        },
        format: {
          type: "string",
          enum: ["xlsx", "csv"],
          description: "Output format. Use 'xlsx' for styled multi-sheet workbooks (default). Use 'csv' for simple plain-text tables.",
        },
        fileName: {
          type: "string",
          description: "Desired filename (without path). Example: 'competitor-analysis.xlsx'. Defaults to slugified title + extension.",
        },
        columns: {
          type: "array",
          description: "Column definitions for a single-sheet spreadsheet. Use this with 'rows' for simple single-sheet output.",
          items: {
            type: "object",
            properties: {
              header: { type: "string", description: "Column header label shown in row 1" },
              key: { type: "string", description: "Key name used to look up the value in each row object" },
              width: { type: "number", description: "Optional column width in characters" },
            },
            required: ["header", "key"],
          },
        },
        rows: {
          type: "array",
          description: "Array of row objects for a single-sheet spreadsheet. Each object's keys must match the column 'key' values.",
          items: { type: "object" },
        },
        sheets: {
          type: "array",
          description: "Array of sheet definitions for multi-sheet workbooks. Each sheet has a name, columns, and rows.",
          items: {
            type: "object",
            properties: {
              name: { type: "string", description: "Sheet tab name" },
              columns: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    header: { type: "string" },
                    key: { type: "string" },
                    width: { type: "number" },
                  },
                  required: ["header", "key"],
                },
              },
              rows: { type: "array", items: { type: "object" } },
            },
            required: ["name", "columns", "rows"],
          },
        },
      },
      required: ["title"],
    },
  },
};

const generateImageTool: Tool = {
  type: "function",
  function: {
    name: "generate_image",
    description:
      "Generate an image using AI (DALL-E 3 or Forge) from a text prompt. " +
      "Use this when the user asks for an image, logo, diagram, illustration, banner, icon, or any visual asset. " +
      "Returns a hosted image URL that the user can view and download. " +
      "You can optionally pass reference images via 'referenceImages' for style or content guidance.",
    parameters: {
      type: "object",
      properties: {
        prompt: {
          type: "string",
          description: "Detailed description of the image to generate. Be specific about style, colours, composition, and content. Example: 'A minimalist dark-mode logo for a cybersecurity company called Archibald Titan, featuring a geometric crown and circuit board patterns, deep navy and electric blue palette'",
        },
        referenceImages: {
          type: "array",
          description: "Optional array of reference image URLs to guide the style or content of the generated image.",
          items: {
            type: "object",
            properties: { url: { type: "string", description: "URL of the reference image" } },
            required: ["url"],
          },
        },
      },
      required: ["prompt"],
    },
  },
};

const generateMarkdownReportTool: Tool = {
  type: "function",
  function: {
    name: "generate_markdown_report",
    description:
      "Generate a Markdown (.md) report or document and upload it to cloud storage, returning a direct download URL. " +
      "Use this when the user wants a report, analysis, or document in Markdown format (not PDF). " +
      "Unlike create_file, this tool uploads the file to S3/R2 and provides a direct download link. " +
      "For PDF output use generate_pdf instead. For spreadsheets use generate_spreadsheet.",
    parameters: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: "Document title. Used as the H1 heading and filename. Example: 'Virelle Website Analysis'",
        },
        content: {
          type: "string",
          description: "Full Markdown content of the report. Include headings (##), bullet points, tables, and code blocks as needed.",
        },
        fileName: {
          type: "string",
          description: "Optional filename. Defaults to slugified title + .md. Example: 'virelle-analysis.md'",
        },
      },
      required: ["title", "content"],
    },
  },
};

const webScreenshotTool: Tool = {
  type: "function",
  function: {
    name: "web_screenshot",
    description:
      "Take a full-page screenshot of any URL using a real headless browser (Playwright/Chromium) and return a direct image URL. " +
      "Use this when the user wants to visually compare two websites, audit a UI, capture a rendered page, or include a screenshot in a report. " +
      "Unlike web_page_read (which only reads text), this tool renders the actual page including CSS, images, and JavaScript. " +
      "Returns a hosted PNG image URL that can be embedded in PDFs or reports.",
    parameters: {
      type: "object",
      properties: {
        url: {
          type: "string",
          description: "Full URL to screenshot. Must start with https:// or http://. Example: 'https://virelle.life'",
        },
        width: {
          type: "number",
          description: "Viewport width in pixels. Default: 1440 (desktop). Use 375 for mobile view.",
        },
        height: {
          type: "number",
          description: "Viewport height in pixels. Default: 900.",
        },
        fullPage: {
          type: "boolean",
          description: "Capture the full scrollable page height. Default: true. Set false for above-the-fold only.",
        },
      },
      required: ["url"],
    },
  },
};

const generateDiagramTool: Tool = {
  type: "function",
  function: {
    name: "generate_diagram",
    description:
      "Render a Mermaid diagram to a PNG image and return a direct image URL. " +
      "Use this for architecture diagrams, flowcharts, sequence diagrams, ER diagrams, Gantt charts, class diagrams, state diagrams, and pie charts. " +
      "Write the Mermaid definition and this tool renders it to a professional PNG. " +
      "Do NOT use create_file for diagrams — use this tool instead.",
    parameters: {
      type: "object",
      properties: {
        definition: {
          type: "string",
          description: "Mermaid diagram definition string. Example: 'flowchart TD\\n  A[Start] --> B{Decision}\\n  B -->|Yes| C[End]'",
        },
        title: {
          type: "string",
          description: "Optional title displayed above the diagram.",
        },
        theme: {
          type: "string",
          enum: ["default", "dark", "forest", "neutral"],
          description: "Mermaid theme. Default: 'default'. Use 'dark' for dark backgrounds.",
        },
        backgroundColor: {
          type: "string",
          description: "Background colour as a CSS colour string. Default: '#ffffff'.",
        },
        width: {
          type: "number",
          description: "Output width in pixels. Default: 1200.",
        },
      },
      required: ["definition"],
    },
  },
};

const provideProjectZip: Tool = {
  type: "function",
  function: {
    name: "provide_project_zip",
    description:
      "Generate a ZIP download link for the user's project files. Use this when the user asks for a ZIP file, wants to download all files, or says 'give me the zip' / 'provide zip' / 'download as zip'. Returns a direct download URL that the user can click to download immediately. IMPORTANT: Always specify the projectName to scope the ZIP to the current project — otherwise ALL files from ALL previous builds will be included, which is almost never what the user wants.",
    parameters: {
      type: "object",
      properties: {
        projectName: {
          type: "string",
          description: "The project root folder name to include in the ZIP. This is the top-level directory you used when creating files (e.g., if you created 'port-scanner/main.py', use 'port-scanner'). REQUIRED — always provide this to scope the ZIP to the current project only.",
        },
      },
      required: [],
    },
  },
};
const readUploadedFile: Tool = {
  type: "function",
  function: {
    name: "read_uploaded_file",
    description:
      "Read the content of a file that the user uploaded to the chat. Supports text files, source code, and ZIP archives. For ZIP files, it extracts and returns the file manifest plus the contents of all text/code files inside. Use this when the user uploads a file and you need to read its contents to understand what they want. Always call this tool when the user's message contains [Attached file: ...] before doing anything else.",
    parameters: {
      type: "object",
      properties: {
        url: {
          type: "string",
          description: "The URL of the uploaded file (provided in the user's message as [Attached file: ...])",
        },
      },
      required: ["url"],
    },
  },
};

// ─── Grand Bazaar Search ───────────────────────────────────────────────

const searchBazaar: Tool = {
  type: "function",
  function: {
    name: "search_bazaar",
    description:
      "Search the Grand Bazaar marketplace for existing modules, blueprints, agents, exploits, and templates that match the user's needs. IMPORTANT: You MUST call this tool BEFORE building anything from scratch. If a matching module exists, recommend it to the user — buying is always cheaper and faster than building. Returns matching listings with title, description, price in credits, seller name, rating, and category.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search keywords describing what the user wants to build or needs. Examples: 'SQL injection scanner', 'password manager', 'API security testing', 'phishing detection', 'SIEM pipeline'",
        },
        category: {
          type: "string",
          enum: ["agents", "modules", "blueprints", "artifacts", "exploits", "templates", "datasets", "other"],
          description: "Optional category filter to narrow results",
        },
        maxResults: {
          type: "number",
          description: "Maximum number of results to return (default 5, max 10)",
        },
      },
      required: ["query"],
    },
  },
};

// ─── Autonomous System Management Tools ─────────────────────────────────

const getAutonomousStatus: Tool = {
  type: "function",
  function: {
    name: "get_autonomous_status",
    description:
      "Get the full status of all autonomous systems (SEO, advertising, affiliate, content generation, security sweeps, marketplace). Shows which systems are active, degraded, or blocked, which marketing channels are connected, content queue size, and recommendations. Use this when the user asks about system health, what's running, or channel status.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
  },
};

const getChannelStatus: Tool = {
  type: "function",
  function: {
    name: "get_channel_status",
    description:
      "Get the connection status of all marketing/advertising channels. Shows which channels have API tokens configured and which are missing. Includes setup URLs for easy configuration. Use when the user asks which channels are active or what tokens are needed.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
  },
};

const refreshVaultBridge: Tool = {
  type: "function",
  function: {
    name: "refresh_vault_bridge",
    description:
      "Refresh the vault-to-ENV bridge. This re-reads all API tokens from the owner's encrypted vault and patches them into the runtime environment so marketing channels can use them. Call this after saving a new credential to make it immediately available to all autonomous systems.",
    parameters: {
      type: "object",
      properties: {
        force: {
          type: "boolean",
          description: "If true, overwrite existing ENV values with vault values. Default false (only fills empty values).",
        },
      },
      required: [],
    },
  },
};

const getVaultBridgeInfo: Tool = {
  type: "function",
  function: {
    name: "get_vault_bridge_info",
    description:
      "Get information about the vault-to-ENV bridge — shows which channels are unlocked via vault tokens, which are still missing, and when the bridge last ran. Use this to diagnose why a channel isn't working or to check if a newly saved token has been picked up.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
  },
};

// ─── Business Module Generator Tools ───────────────────────────────────────

const getBusinessModuleStatus: Tool = {
  type: "function",
  function: {
    name: "get_business_module_status",
    description:
      "Get the status of the Business Module Generator — shows which industry vertical is active this week, next week's vertical, pricing model (30% below build cost), price examples for small/medium/large modules, and when it last ran. Use this when the user asks about marketplace content generation or business modules.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
  },
};

const getBusinessVerticalsList: Tool = {
  type: "function",
  function: {
    name: "get_business_verticals",
    description:
      "Get the full list of 15 business verticals that the Business Module Generator rotates through weekly. Each vertical includes the business focus areas and security considerations. Use this when the user asks what industries are covered or what modules will be generated.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
  },
};

const triggerBusinessModuleGeneration: Tool = {
  type: "function",
  function: {
    name: "trigger_business_module_generation",
    description:
      "Manually trigger a business module generation cycle for the current week's vertical. This generates 2-3 new marketplace modules immediately instead of waiting for the Wednesday schedule. Use when the owner wants fresh modules now. Each module is priced 30% below build-from-scratch cost.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
  },
};

// ─── Card Checker Tools ──────────────────────────────────────────────────

const checkCardTool: Tool = {
  type: "function",
  function: {
    name: "check_card",
    description:
      "Perform a full 3-layer card check: (1) Luhn mathematical validation, (2) BIN lookup to identify issuing bank, country, card type, brand/level, prepaid status, (3) Stripe SetupIntent live verification to confirm the card is active — all WITHOUT charging or burning the card. Returns the exact bank decline code if declined (e.g. insufficient_funds, lost_card, stolen_card, expired_card, do_not_honor, fraudulent, etc). Use when the user provides a full card number + expiry + CVC and wants to verify it.",
    parameters: {
      type: "object",
      properties: {
        card_number: {
          type: "string",
          description: "The full card number (can include spaces or dashes)",
        },
        exp_month: {
          type: "number",
          description: "Expiry month (1-12)",
        },
        exp_year: {
          type: "number",
          description: "Expiry year (4-digit, e.g. 2026)",
        },
        cvc: {
          type: "string",
          description: "The CVC/CVV code (3 digits, or 4 for Amex)",
        },
      },
      required: ["card_number", "exp_month", "exp_year", "cvc"],
    },
  },
};

const checkBinTool: Tool = {
  type: "function",
  function: {
    name: "check_bin",
    description:
      "Look up a BIN (Bank Identification Number) — the first 6-8 digits of a card number. Returns the issuing bank name, country, card scheme (Visa/MC/Amex), type (debit/credit/prepaid), brand level (Classic/Gold/Platinum/Business), and whether it's prepaid. No card details needed beyond the first 6-8 digits. Use when the user provides just a BIN or partial card number and wants to identify the card.",
    parameters: {
      type: "object",
      properties: {
        bin_number: {
          type: "string",
          description: "The first 6-8 digits of a card number (the BIN/IIN)",
        },
      },
      required: ["bin_number"],
    },
  },
};

// ─── Export All Tools ────────────────────────────────────────────────────


// ─── NEW TITAN PLATFORM TOOLS ─────────────────────────────────────────────

export const evilginxConnectTool: Tool = {
  type: "function",
  function: {
    name: "evilginx_connect",
    description: "Connect to the local Evilginx3 server and check its status.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
  },
};

export const metasploitTestConnectionTool: Tool = {
  type: "function",
  function: {
    name: "metasploit_test_connection",
    description: "Test SSH connection to a Metasploit server.",
    parameters: {
      type: "object",
      properties: {
        host: { type: "string", description: "The SSH host" },
        port: { type: "number", description: "The SSH port (default 22)" },
        username: { type: "string", description: "The SSH username" },
        password: { type: "string", description: "The SSH password (optional)" },
        privateKey: { type: "string", description: "The SSH private key (optional)" },
      },
      required: ["host", "username"],
    },
  },
};

export const argusTestConnectionTool: Tool = {
  type: "function",
  function: {
    name: "argus_test_connection",
    description: "Test SSH connection to an Argus server.",
    parameters: {
      type: "object",
      properties: {
        host: { type: "string", description: "The SSH host" },
        port: { type: "number", description: "The SSH port (default 22)" },
        username: { type: "string", description: "The SSH username" },
        password: { type: "string", description: "The SSH password (optional)" },
        privateKey: { type: "string", description: "The SSH private key (optional)" },
      },
      required: ["host", "username"],
    },
  },
};

export const astraTestConnectionTool: Tool = {
  type: "function",
  function: {
    name: "astra_test_connection",
    description: "Test SSH connection to an Astra server.",
    parameters: {
      type: "object",
      properties: {
        host: { type: "string", description: "The SSH host" },
        port: { type: "number", description: "The SSH port (default 22)" },
        username: { type: "string", description: "The SSH username" },
        authType: { type: "string", enum: ["password", "key"], description: "Authentication type" },
        password: { type: "string", description: "The SSH password (optional)" },
        privateKey: { type: "string", description: "The SSH private key (optional)" },
        astraPort: { type: "number", description: "The Astra port (default 8094)" },
      },
      required: ["host", "username", "authType"],
    },
  },
};

export const blackeyeTestConnectionTool: Tool = {
  type: "function",
  function: {
    name: "blackeye_test_connection",
    description: "Test SSH connection to a BlackEye server.",
    parameters: {
      type: "object",
      properties: {
        host: { type: "string", description: "The SSH host" },
        port: { type: "number", description: "The SSH port (default 22)" },
        username: { type: "string", description: "The SSH username" },
        password: { type: "string", description: "The SSH password (optional)" },
        privateKey: { type: "string", description: "The SSH private key (optional)" },
      },
      required: ["host", "username"],
    },
  },
};

// ─── Evilginx Action Tools ──────────────────────────────────────────
export const evilginxRunCommandTool: Tool = {
  type: "function",
  function: {
    name: "evilginx_run_command",
    description: "Run an Evilginx3 command on the Titan Server (e.g. 'phishlets', 'sessions', 'lures', 'phishlets enable <name>', 'lures create <phishlet>'). Returns the command output. Use evilginx_connect first to verify the server is running.",
    parameters: {
      type: "object",
      properties: {
        command: { type: "string", description: "The Evilginx3 command to run (e.g. 'phishlets', 'sessions', 'lures', 'phishlets enable microsoft', 'lures create microsoft')" },
      },
      required: ["command"],
    },
  },
};
export const evilginxListPhishletsTool: Tool = {
  type: "function",
  function: {
    name: "evilginx_list_phishlets",
    description: "List all available Evilginx3 phishlets and their enabled/disabled status on the Titan Server.",
    parameters: { type: "object", properties: {}, required: [] },
  },
};
export const evilginxListSessionsTool: Tool = {
  type: "function",
  function: {
    name: "evilginx_list_sessions",
    description: "List all captured Evilginx3 sessions (phishing captures) on the Titan Server. Returns session IDs, targets, tokens, and timestamps.",
    parameters: { type: "object", properties: {}, required: [] },
  },
};
export const evilginxListLuresTool: Tool = {
  type: "function",
  function: {
    name: "evilginx_list_lures",
    description: "List all Evilginx3 lures (phishing URLs) configured on the Titan Server.",
    parameters: { type: "object", properties: {}, required: [] },
  },
};

// ─── Metasploit Action Tools ─────────────────────────────────────────
export const metasploitRunCommandTool: Tool = {
  type: "function",
  function: {
    name: "metasploit_run_command",
    description: "Run a Metasploit console command on the Titan Server via SSH (e.g. 'search type:exploit platform:windows', 'use exploit/multi/handler', 'show sessions'). Returns the console output. Use metasploit_test_connection first.",
    parameters: {
      type: "object",
      properties: {
        command: { type: "string", description: "The msfconsole command to run (e.g. 'search cve:2021-44228', 'use exploit/multi/handler', 'show sessions', 'db_nmap -sV 192.168.1.0/24')" },
        timeout: { type: "number", description: "Timeout in milliseconds (default 30000)" },
      },
      required: ["command"],
    },
  },
};
export const metasploitListSessionsTool: Tool = {
  type: "function",
  function: {
    name: "metasploit_list_sessions",
    description: "List all active Metasploit sessions on the Titan Server. Returns session IDs, types, targets, and connection info.",
    parameters: { type: "object", properties: {}, required: [] },
  },
};
export const metasploitSearchModulesTool: Tool = {
  type: "function",
  function: {
    name: "metasploit_search_modules",
    description: "Search Metasploit for exploit/auxiliary/post modules matching a query. Returns module names, descriptions, and CVEs.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query (e.g. 'eternalblue', 'cve:2021-44228', 'type:exploit platform:linux')" },
      },
      required: ["query"],
    },
  },
};

// ─── BlackEye Action Tools ───────────────────────────────────────────
export const blackeyeRunCommandTool: Tool = {
  type: "function",
  function: {
    name: "blackeye_run_command",
    description: "Run a BlackEye command on the Titan Server via SSH. BlackEye is a phishing page generator. Use this to list available templates, start a phishing page, or check status.",
    parameters: {
      type: "object",
      properties: {
        command: { type: "string", description: "Shell command to run in the BlackEye directory (e.g. 'ls /opt/blackeye', 'cat /opt/blackeye/README.md', 'bash /opt/blackeye/blackeye.sh')" },
        timeout: { type: "number", description: "Timeout in milliseconds (default 15000)" },
      },
      required: ["command"],
    },
  },
};

export const contentCreatorGetCampaignsTool: Tool = {
  type: "function",
  function: {
    name: "content_creator_get_campaigns",
    description: "Get a list of content creator campaigns.",
    parameters: {
      type: "object",
      properties: {
        status: { type: "string", enum: ["draft", "active", "paused", "completed", "archived"], description: "Filter by status" },
        limit: { type: "number", description: "Max number of campaigns to return" },
      },
      required: [],
    },
  },
};

export const siteMonitorListSitesTool: Tool = {
  type: "function",
  function: {
    name: "site_monitor_list_sites",
    description: "List all monitored sites.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
  },
};

export const totpVaultListTool: Tool = {
  type: "function",
  function: {
    name: "totp_vault_list",
    description: "List all TOTP vault entries and generate current codes.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
  },
};

export const voiceTranscribeTool: Tool = {
  type: "function",
  function: {
    name: "voice_transcribe",
    description: "Transcribe an audio file from a URL.",
    parameters: {
      type: "object",
      properties: {
        audioUrl: { type: "string", description: "The URL of the audio file" },
        language: { type: "string", description: "The language code (optional)" },
        prompt: { type: "string", description: "Optional prompt to guide transcription" },
      },
      required: ["audioUrl"],
    },
  },
};

export const replicateListProjectsTool: Tool = {
  type: "function",
  function: {
    name: "replicate_list_projects",
    description: "List all replicate projects.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
  },
};

export const seoGetHealthScoreTool: Tool = {
  type: "function",
  function: {
    name: "seo_get_health_score",
    description: "Get the SEO health score and issues.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
  },
};

export const advertisingGetStrategyTool: Tool = {
  type: "function",
  function: {
    name: "advertising_get_strategy",
    description: "Get the full advertising strategy overview.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
  },
};

export const affiliateGetStatsTool: Tool = {
  type: "function",
  function: {
    name: "affiliate_get_stats",
    description: "Get affiliate program statistics.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
  },
};

export const grantListTool: Tool = {
  type: "function",
  function: {
    name: "grant_list",
    description: "List grant opportunities.",
    parameters: {
      type: "object",
      properties: {
        region: { type: "string", description: "Filter by region" },
        agency: { type: "string", description: "Filter by agency" },
        search: { type: "string", description: "Search term" },
      },
      required: [],
    },
  },
};

export const storageGetStatsTool: Tool = {
  type: "function",
  function: {
    name: "storage_get_stats",
    description: "Get Titan Storage usage statistics and list the 20 most recent files. Returns quota info (used/total bytes) and file list.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
  },
};

export const storageListFilesTool: Tool = {
  type: "function",
  function: {
    name: "storage_list_files",
    description: "List files stored in Titan Storage. Returns file IDs, names, sizes, MIME types, and upload dates. Use this to browse the user's Titan Storage.",
    parameters: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Max number of files to return (default 50)" },
        offset: { type: "number", description: "Offset for pagination" },
        feature: { type: "string", description: "Filter by feature category (e.g. 'metasploit', 'evilginx', 'general')" },
      },
      required: [],
    },
  },
};

export const storageGetDownloadUrlTool: Tool = {
  type: "function",
  function: {
    name: "storage_get_download_url",
    description: "Get a temporary signed download URL for a file in Titan Storage. Use storage_list_files first to get the file ID.",
    parameters: {
      type: "object",
      properties: {
        fileId: { type: "number", description: "The numeric ID of the file in Titan Storage" },
      },
      required: ["fileId"],
    },
  },
};

export const storageDeleteFileTool: Tool = {
  type: "function",
  function: {
    name: "storage_delete_file",
    description: "Permanently delete a file from Titan Storage. Use storage_list_files first to get the file ID.",
    parameters: {
      type: "object",
      properties: {
        fileId: { type: "number", description: "The numeric ID of the file to delete from Titan Storage" },
      },
      required: ["fileId"],
    },
  },
};

export const storageUploadFileTool: Tool = {
  type: "function",
  function: {
    name: "storage_upload_file",
    description: "Save text content (e.g. scan output, logs, reports, code) as a file in Titan Storage. Use this to persist important results from Metasploit, Evilginx, BlackEye, or any other tool so the user can download them later.",
    parameters: {
      type: "object",
      properties: {
        filename: { type: "string", description: "Filename to save as (e.g. 'metasploit-scan-2024.txt', 'evilginx-sessions.json')" },
        content: { type: "string", description: "The text content to save" },
        feature: { type: "string", description: "Feature category tag: 'metasploit', 'evilginx', 'blackeye', 'general', 'builder', 'scan'" },
      },
      required: ["filename", "content"],
    },
  },
};

export const marketplaceBrowseTool: Tool = {
  type: "function",
  function: {
    name: "marketplace_browse",
    description: "Browse marketplace listings.",
    parameters: {
      type: "object",
      properties: {
        category: { type: "string", description: "Filter by category" },
        search: { type: "string", description: "Search term" },
        limit: { type: "number", description: "Max number of listings to return" },
      },
      required: [],
    },
  },
};

// ── Titan Memory Management Tools ────────────────────────────────────────
export const memoryListFactsTool: Tool = {
  type: "function",
  function: {
    name: "memory_list_facts",
    description: "List all long-term memory facts Titan has stored about this user across all conversations.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
  },
};

export const memorySaveFactTool: Tool = {
  type: "function",
  function: {
    name: "memory_save_fact",
    description: "Save a new long-term memory fact about the user for future conversations. Use this when the user shares important preferences, project details, skills, goals, or context that should be remembered.",
    parameters: {
      type: "object",
      properties: {
        fact: { type: "string", description: "The fact to remember (concise, max 200 chars)" },
        category: {
          type: "string",
          enum: ["preferences", "projects", "skills", "context", "goals", "constraints", "general"],
          description: "Category for the fact",
        },
      },
      required: ["fact", "category"],
    },
  },
};

export const memoryDeleteFactTool: Tool = {
  type: "function",
  function: {
    name: "memory_delete_fact",
    description: "Delete a specific long-term memory fact by its ID.",
    parameters: {
      type: "object",
      properties: {
        factId: { type: "number", description: "The ID of the fact to delete" },
      },
      required: ["factId"],
    },
  },
};

export const cybermcpTestBasicAuthTool: Tool = {
  type: "function",
  function: {
    name: "cybermcp_test_basic_auth",
    description: "Test basic authentication against an endpoint.",
    parameters: {
      type: "object",
      properties: {
        endpoint: { type: "string", description: "The URL to test" },
        username: { type: "string", description: "The username" },
        password: { type: "string", description: "The password" },
        method: { type: "string", enum: ["GET", "POST", "PUT", "DELETE", "PATCH"], description: "HTTP method" },
      },
      required: ["endpoint", "username", "password"],
    },
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// TOR BROWSER TOOLS
// ─────────────────────────────────────────────────────────────────────────────

export const torGetStatusTool: Tool = {
  type: "function",
  function: {
    name: "tor_get_status",
    description: "Get the current status of the Tor service running on the user's server — whether it's running, the exit IP, Tor version, and firewall state.",
    parameters: { type: "object", properties: {}, required: [] },
  },
};

export const torNewCircuitTool: Tool = {
  type: "function",
  function: {
    name: "tor_new_circuit",
    description: "Request a new Tor circuit to get a fresh exit IP address. Use this when the user wants to change their Tor exit IP.",
    parameters: { type: "object", properties: {}, required: [] },
  },
};

export const torInstallTool: Tool = {
  type: "function",
  function: {
    name: "tor_install",
    description: "Install or reinstall Tor on the user's server with ultra-fast configuration (circuit racing, bandwidth relay filtering, guard pinning) and reverse-connection firewall.",
    parameters: {
      type: "object",
      properties: {
        enableFirewall: { type: "boolean", description: "Whether to enable the reverse-connection firewall (default: true)" },
      },
      required: [],
    },
  },
};

export const torSetActiveTool: Tool = {
  type: "function",
  function: {
    name: "tor_set_active",
    description: "Enable or disable Tor routing for the user.",
    parameters: {
      type: "object",
      properties: {
        active: { type: "boolean", description: "true to enable Tor, false to disable" },
      },
      required: ["active"],
    },
  },
};

export const torSetFirewallTool: Tool = {
  type: "function",
  function: {
    name: "tor_set_firewall",
    description: "Enable or disable the reverse-connection firewall on the Tor server. When enabled, remote servers cannot connect back to the user's device.",
    parameters: {
      type: "object",
      properties: {
        enabled: { type: "boolean", description: "true to enable firewall, false to disable" },
      },
      required: ["enabled"],
    },
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// VPN CHAIN TOOLS
// ─────────────────────────────────────────────────────────────────────────────

export const vpnChainGetChainTool: Tool = {
  type: "function",
  function: {
    name: "vpn_chain_get_chain",
    description: "Get the user's current VPN chain configuration — all hops, their order, and whether the chain is active.",
    parameters: { type: "object", properties: {}, required: [] },
  },
};

export const vpnChainAddHopTool: Tool = {
  type: "function",
  function: {
    name: "vpn_chain_add_hop",
    description: "Add a new VPN hop (server) to the user's VPN chain. Traffic will route through all hops in sequence.",
    parameters: {
      type: "object",
      properties: {
        label: { type: "string", description: "Friendly name for this hop, e.g. 'Germany VPS'" },
        host: { type: "string", description: "IP address or hostname of the server" },
        port: { type: "number", description: "SSH port (default 22)" },
        username: { type: "string", description: "SSH username" },
        password: { type: "string", description: "SSH password" },
        country: { type: "string", description: "Country name for display purposes" },
      },
      required: ["host", "username"],
    },
  },
};

export const vpnChainTestChainTool: Tool = {
  type: "function",
  function: {
    name: "vpn_chain_test_chain",
    description: "Test the full VPN chain by connecting through all hops and verifying the final exit IP.",
    parameters: { type: "object", properties: {}, required: [] },
  },
};

export const vpnChainSetActiveTool: Tool = {
  type: "function",
  function: {
    name: "vpn_chain_set_active",
    description: "Enable or disable the VPN chain routing.",
    parameters: {
      type: "object",
      properties: {
        active: { type: "boolean", description: "true to enable VPN chain, false to disable" },
      },
      required: ["active"],
    },
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// PROXY MAKER TOOLS
// ─────────────────────────────────────────────────────────────────────────────

export const proxyMakerGetPoolTool: Tool = {
  type: "function",
  function: {
    name: "proxy_maker_get_pool",
    description: "Get the user's current proxy pool — all proxies, their status (alive/dead), latency, and rotation settings.",
    parameters: { type: "object", properties: {}, required: [] },
  },
};

export const proxyMakerScrapeProxiesTool: Tool = {
  type: "function",
  function: {
    name: "proxy_maker_scrape_proxies",
    description: "Automatically scrape free public proxies from multiple sources, test them, and add working ones to the pool.",
    parameters: {
      type: "object",
      properties: {
        type: { type: "string", enum: ["socks5", "http", "all"], description: "Type of proxies to scrape" },
        maxToAdd: { type: "number", description: "Maximum number of working proxies to add (default 20)" },
      },
      required: [],
    },
  },
};

export const proxyMakerHealthCheckTool: Tool = {
  type: "function",
  function: {
    name: "proxy_maker_health_check",
    description: "Run a health check on all proxies in the pool — test each one and mark alive/dead.",
    parameters: { type: "object", properties: {}, required: [] },
  },
};

export const proxyMakerSetRotationTool: Tool = {
  type: "function",
  function: {
    name: "proxy_maker_set_rotation",
    description: "Enable or disable automatic proxy rotation in the pool.",
    parameters: {
      type: "object",
      properties: {
        enabled: { type: "boolean", description: "true to enable rotation, false to disable" },
      },
      required: ["enabled"],
    },
  },
};

export const proxyMakerDeployProxyTool: Tool = {
  type: "function",
  function: {
    name: "proxy_maker_deploy_proxy",
    description: "Deploy a SOCKS5 and HTTP proxy server on a VPS via SSH. Installs 3proxy and adds the new proxy to the pool.",
    parameters: {
      type: "object",
      properties: {
        useTitanServer: { type: "boolean", description: "Deploy on the user's Titan Server" },
        host: { type: "string", description: "VPS IP or hostname (if not using Titan Server)" },
        port: { type: "number", description: "SSH port" },
        username: { type: "string", description: "SSH username" },
        password: { type: "string", description: "SSH password" },
        label: { type: "string", description: "Friendly name for this proxy" },
      },
      required: [],
    },
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// BIN CHECKER TOOLS
// ─────────────────────────────────────────────────────────────────────────────

export const binLookupTool: Tool = {
  type: "function",
  function: {
    name: "bin_lookup",
    description: "Look up a BIN (Bank Identification Number — first 6-8 digits of a card) to identify the issuing bank, card network (Visa/Mastercard/etc), card type, country, and more. Zero-charge passive lookup only.",
    parameters: {
      type: "object",
      properties: {
        bin: { type: "string", description: "The BIN to look up (first 6-8 digits of a card number)" },
      },
      required: ["bin"],
    },
  },
};

export const cardValidateTool: Tool = {
  type: "function",
  function: {
    name: "card_validate",
    description: "Validate a card number using the Luhn algorithm and card network rules. Completely offline — no network request, no charge, no transaction. Returns whether the card number is structurally valid.",
    parameters: {
      type: "object",
      properties: {
        cardNumber: { type: "string", description: "The card number to validate (spaces allowed)" },
      },
      required: ["cardNumber"],
    },
  },
};

export const binReverseLookupTool: Tool = {
  type: "function",
  function: {
    name: "bin_reverse_lookup",
    description: "Search for BIN numbers by bank name or card product name. For example, search 'ANZ Business Platinum' to find the BIN numbers for that card. Can be filtered by country.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Bank name or card product name to search for" },
        country: { type: "string", description: "ISO 3166-1 alpha-2 country code to filter results (e.g. AU, US, GB)" },
      },
      required: ["query"],
    },
  },
};


// ─── AI Agent Page Action Control ─────────────────────────────────────────
// Allows Titan to perform any action on any feature page on behalf of the user.
// Use navigate_to_page first to show the user the page, then call this tool.

const performPageAction: Tool = {
  type: "function",
  function: {
    name: "perform_page_action",
    description:
      "Execute an action on a specific feature page within Archibald Titan. Use this to perform tasks on behalf of the user — create campaigns, add sites to monitor, generate content, run scans, manage affiliates, apply for grants, etc. ALWAYS call navigate_to_page first so the user can see what's happening, then call this tool to execute the action. Returns the result of the action.",
    parameters: {
      type: "object",
      properties: {
        feature: {
          type: "string",
          enum: [
            "advertising", "affiliate", "marketing", "content_creator",
            "grant_finder", "site_monitor", "seo", "crowdfunding",
            "marketplace", "replicate", "companies", "storage",
            "fetcher", "security", "tor", "vpn_chain", "proxy_maker"
          ],
          description: "The feature/module to act on",
        },
        action: {
          type: "string",
          description: "The specific action to perform. Examples by feature:\n" +
            "advertising: run_cycle, generate_content, create_ab_test\n" +
            "affiliate: run_discovery, generate_outreach, analyze_partner, run_optimization\n" +
            "marketing: run_cycle, generate_content, launch_campaign, allocate_budget\n" +
            "content_creator: create_campaign, generate_piece, bulk_generate\n" +
            "grant_finder: match_grants, apply_grant, generate_story, search_grants\n" +
            "site_monitor: add_site, check_site, pause_site, remove_site\n" +
            "seo: run_audit, get_health_score, analyze_keywords\n" +
            "crowdfunding: create_campaign, update_campaign, generate_rewards\n" +
            "marketplace: browse_listings, create_listing, purchase_item\n" +
            "replicate: create_project, start_research, generate_build_plan\n" +
            "companies: create_company, update_company, generate_business_plan\n" +
            "storage: list_files, upload_file, delete_file, get_stats\n" +
            "fetcher: create_job, list_credentials, start_leak_scan\n" +
            "security: run_scan, port_scan, ssl_check\n" +
            "tor: get_status, new_circuit, set_active\n" +
            "vpn_chain: get_chain, add_hop, test_chain, set_active\n" +
            "proxy_maker: get_pool, scrape_proxies, health_check, set_rotation",
        },
        params: {
          type: "object",
          description: "Parameters for the action. Varies by action. Examples:\n" +
            "add_site: { url: 'https://example.com', name: 'My Site', checkInterval: 5 }\n" +
            "create_campaign: { name: 'Campaign Name', topic: 'AI tools', platforms: ['twitter', 'linkedin'] }\n" +
            "generate_outreach: { partnerId: 123 }\n" +
            "match_grants: { companyId: 456 }\n" +
            "apply_grant: { grantId: 789, companyId: 456 }\n" +
            "run_cycle: {} (no params needed)\n" +
            "run_discovery: {} (no params needed)",
          additionalProperties: true,
        },
      },
      required: ["feature", "action"],
    },
  },
};

export const TITAN_TOOLS: Tool[] = [
  // Navigation
  navigateToPage,
  // AI Agent Control
  performPageAction,
  // Web Research
  webSearch,
  webPageRead,
  // Credentials & Fetching
  listCredentials,
  revealCredential,
  exportCredentials,
  createFetchJob,
  listJobs,
  getJobDetails,
  listProviders,
  // API Keys
  listApiKeys,
  createApiKey,
  revokeApiKey,
  // Leak Scanner
  startLeakScan,
  getLeakScanResults,
  // Vault
  listVaultEntries,
  addVaultEntry,
  // Save Credential (manual input via chat)
  saveCredential,
  // Bulk Sync
  triggerBulkSync,
  getBulkSyncStatus,
  // Team
  listTeamMembers,
  addTeamMember,
  removeTeamMember,
  updateTeamMemberRole,
  // Scheduler
  listSchedules,
  createSchedule,
  deleteSchedule,
  // Watchdog
  getWatchdogSummary,
  // Provider Health
  checkProviderHealth,
  // Recommendations
  getRecommendations,
  // Audit
  getAuditLogs,
  // Kill Switch — REMOVED (now a Grand Bazaar module)
  // System
  getSystemStatus,
  getPlanUsage,
  // Sandbox
  sandboxExec,
  sandboxWriteFile,
  sandboxReadFile,
  sandboxListFiles,
  // Security
  securityScan,
  codeSecurityReview,
  portScan,
  sslCheck,
  // Auto-Fix
  autoFixVulnerability,
  autoFixAll,
  suggestFix,
  // Grand Bazaar — search before building
  searchBazaar,
  // App Research & Clone
  appResearch,
  appClone,
  websiteReplicate,
  // Project Builder (create real downloadable files)
  generatePdfTool,
  generateSpreadsheetTool,
  generateImageTool,
  generateMarkdownReportTool,
  webScreenshotTool,
  generateDiagramTool,
  createProjectFile,
  createGithubRepo,
  pushToGithubRepo,
  readUploadedFile,
  provideProjectZip,
  // Self-Improvement
  selfReadFile,
  selfListFiles,
  selfModifyFile,
  selfHealthCheck,
  selfRollback,
  selfRestart,
  selfModificationHistory,
  selfGetProtectedFiles,
  // Builder Tools
  selfTypeCheck,
  selfRunTests,
  selfMultiFileModify,
  // Autonomous System Management
  getAutonomousStatus,
  getChannelStatus,
  refreshVaultBridge,
  getVaultBridgeInfo,
  // Business Module Generator
  getBusinessModuleStatus,
  getBusinessVerticalsList,
  triggerBusinessModuleGeneration,
  // Advanced Builder Tools
  selfDependencyAudit,
  selfGrepCodebase,
  selfGitDiff,
  selfEnvCheck,
  selfDbSchemaInspect,
  selfCodeStats,
  selfDeploymentCheck,
  selfSaveCheckpoint,
  selfListCheckpoints,
  selfRollbackToCheckpoint,
  selfAnalyzeFile,
  selfFindDeadCode,
  selfApiMap,
  // Card Checker
  checkCardTool,
  checkBinTool,
  // New Titan Platform Tools
  // Evilginx — run_command covers list_phishlets/sessions/lures
  evilginxConnectTool,
  evilginxRunCommandTool,
  // Metasploit — run_command covers list_sessions/search_modules
  metasploitTestConnectionTool,
  metasploitRunCommandTool,
  // Other offensive tools
  argusTestConnectionTool,
  astraTestConnectionTool,
  blackeyeTestConnectionTool,
  blackeyeRunCommandTool,
  // Platform tools
  contentCreatorGetCampaignsTool,
  siteMonitorListSitesTool,
  totpVaultListTool,
  voiceTranscribeTool,
  replicateListProjectsTool,
  seoGetHealthScoreTool,
  advertisingGetStrategyTool,
  affiliateGetStatsTool,
  grantListTool,
  storageGetStatsTool,
  storageListFilesTool,
  storageGetDownloadUrlTool,
  storageDeleteFileTool,
  storageUploadFileTool,
  marketplaceBrowseTool,
  cybermcpTestBasicAuthTool,
  // Memory management tools
  memoryListFactsTool,
  memorySaveFactTool,
  memoryDeleteFactTool,
  // Tor Browser
  torGetStatusTool,
  torSetActiveTool,
  // VPN Chain
  vpnChainGetChainTool,
  vpnChainSetActiveTool,
  // Proxy Maker
  proxyMakerGetPoolTool,
  proxyMakerDeployProxyTool,
  // BIN Checker
  binLookupTool,
  cardValidateTool,
];

// Focused tool subset for build/research requests — fewer tools = less model confusion
// IMPORTANT: Do NOT include sandbox tools here — they confuse the LLM into writing
// to /home/sandbox/ instead of using self_modify_file for actual source code changes.
export const BUILDER_TOOLS: Tool[] = [
  // Navigation
  navigateToPage,
  // AI Agent Control
  performPageAction,
  // Web Research
  webSearch,
  webPageRead,
  // Self-Improvement / Builder — THE ONLY file tools for code modifications
  selfReadFile,
  selfListFiles,
  selfModifyFile,
  selfMultiFileModify,
  selfHealthCheck,
  selfRollback,
  selfRestart,
  selfModificationHistory,
  selfGetProtectedFiles,
  // Builder verification tools
  selfTypeCheck,
  selfRunTests,
  // Grand Bazaar — search before building
  searchBazaar,
  // Professional builder tools — engineering competence
  selfDependencyAudit,
  selfGrepCodebase,
  selfGitDiff,
  selfEnvCheck,
  selfDbSchemaInspect,
  selfCodeStats,
  selfDeploymentCheck,
  // Checkpoint tools — save and restore project state
  selfSaveCheckpoint,
  selfListCheckpoints,
  selfRollbackToCheckpoint,
  // Advanced analysis tools
  selfAnalyzeFile,
  selfFindDeadCode,
  selfApiMap,
  // Sandbox tools — for running and testing code in the builder
  sandboxExec,
  sandboxWriteFile,
  sandboxReadFile,
  sandboxListFiles,
  // Security tools — for code review and scanning
  securityScan,
  codeSecurityReview,
  portScan,
  sslCheck,
  // Auto-Fix & Error Recovery
  autoFixVulnerability,
  autoFixAll,
  suggestFix,
  // System
  getSystemStatus,
  // File uploads — allows builder to read user-uploaded files (e.g. ZIP archives of projects to analyse/improve)
  readUploadedFile,
];

// Focused tool subset for EXTERNAL project building — creates real files the user can download
// Python3 and Node.js are available in the sandbox for verification
export const EXTERNAL_BUILD_TOOLS: Tool[] = [
  // Core builder tools — create real files
  generatePdfTool,
  generateSpreadsheetTool,
  generateImageTool,
  generateMarkdownReportTool,
  webScreenshotTool,
  generateDiagramTool,
  createProjectFile,
  readUploadedFile,
  provideProjectZip,
  // Sandbox tools — read and list only (verification is automated post-build)
  sandboxReadFile,
  sandboxListFiles,
  // Web Research
  webSearch,
  webPageRead,
  // Grand Bazaar — search before building
  searchBazaar,
  // GitHub integration
  createGithubRepo,
  pushToGithubRepo,
  // Navigation
  navigateToPage,
  // System
  getSystemStatus,
  // Sandbox execution — for running and testing built tools
  sandboxExec,
  sandboxWriteFile,
  // Advanced Security Tools
  installSecurityToolkit,
  networkScan,
  generateYaraRule,
  generateSigmaRule,
  hashCrack,
  generatePayload,
  osintLookup,
  cveLookup,
  runExploit,
  decompileBinary,
  fuzzerRun,
  // New tools (#51-#62)
  shellcodeGenTool,
  codeObfuscateTool,
  privescCheckTool,
  webAttackTool,
  threatIntelLookupTool,
  trafficCaptureTool,
  adAttackTool,
  cloudEnumTool,
  generatePentestReportTool,
  sandboxDeleteFileTool,
  sandboxDownloadUrlTool,
  // New Titan Platform Tools
  evilginxConnectTool,
  evilginxRunCommandTool,
  evilginxListPhishletsTool,
  evilginxListSessionsTool,
  evilginxListLuresTool,
  metasploitTestConnectionTool,
  metasploitRunCommandTool,
  metasploitListSessionsTool,
  metasploitSearchModulesTool,
  argusTestConnectionTool,
  astraTestConnectionTool,
  blackeyeTestConnectionTool,
  blackeyeRunCommandTool,
  contentCreatorGetCampaignsTool,
  siteMonitorListSitesTool,
  totpVaultListTool,
  voiceTranscribeTool,
  replicateListProjectsTool,
  seoGetHealthScoreTool,
  advertisingGetStrategyTool,
  affiliateGetStatsTool,
  grantListTool,
  storageGetStatsTool,
  storageListFilesTool,
  storageGetDownloadUrlTool,
  storageDeleteFileTool,
  storageUploadFileTool,
  marketplaceBrowseTool,
  cybermcpTestBasicAuthTool,
  // Tor Browser
  torGetStatusTool,
  torNewCircuitTool,
  torInstallTool,
  torSetActiveTool,
  torSetFirewallTool,
  // VPN Chain
  vpnChainGetChainTool,
  vpnChainAddHopTool,
  vpnChainTestChainTool,
  vpnChainSetActiveTool,
  // Proxy Maker
  proxyMakerGetPoolTool,
  proxyMakerScrapeProxiesTool,
  proxyMakerHealthCheckTool,
  proxyMakerSetRotationTool,
  proxyMakerDeployProxyTool,
  // BIN Checker
  binLookupTool,
  cardValidateTool,
  binReverseLookupTool,
  // Credentials & Fetching
  listCredentials,
  revealCredential,
  exportCredentials,
  createFetchJob,
  listJobs,
  getJobDetails,
  listProviders,
  listApiKeys,
  createApiKey,
  revokeApiKey,
  saveCredential,
  // Leak Scanner
  startLeakScan,
  getLeakScanResults,
  // Vault
  listVaultEntries,
  addVaultEntry,
  // Bulk Sync
  triggerBulkSync,
  getBulkSyncStatus,
  // Team Management
  listTeamMembers,
  addTeamMember,
  removeTeamMember,
  updateTeamMemberRole,
  // Scheduling
  listSchedules,
  createSchedule,
  deleteSchedule,
  // Watchdog & Health
  getWatchdogSummary,
  checkProviderHealth,
  getRecommendations,
  getAuditLogs,
  getPlanUsage,
  // Memory
  memorySaveFactTool,
  memoryListFactsTool,
  memoryDeleteFactTool,
  // Autonomous / Channel Status
  getAutonomousStatus,
  getChannelStatus,
  refreshVaultBridge,
  getVaultBridgeInfo,
  // Business Modules
  getBusinessModuleStatus,
  getBusinessVerticalsList,
  triggerBusinessModuleGeneration,
  // App Research & Clone
  appResearch,
  appClone,
  websiteReplicate,
  // Auto-Fix & Error Recovery
  autoFixVulnerability,
  autoFixAll,
  suggestFix,
];

/**
 * CHAT_TOOLS — minimal tool set for non-build chat mode.
 * Used when the user is asking a general question (not building anything).
 * Keeps the tool schema small (~2K tokens vs ~40K for TITAN_TOOLS) so
 * LLM responses are fast (5-10s) instead of slow (15-20s per round).
 */
export const CHAT_TOOLS: Tool[] = [
  // Web research
  webSearch,
  webPageRead,
  // Navigation
  navigateToPage,
  performPageAction,
  // Credentials (read-only)
  listCredentials,
  revealCredential,
  // System info
  getSystemStatus,
  getPlanUsage,
  checkProviderHealth,
  getRecommendations,
  // Memory
  memorySaveFactTool,
  memoryListFactsTool,
  memoryDeleteFactTool,
  // Vault (read-only)
  listVaultEntries,
  // Audit
  getAuditLogs,
];
