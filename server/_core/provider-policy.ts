/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Archibald Titan — Provider Policy Layer
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * PURPOSE
 * -------
 * Centralise all AI provider routing decisions in one place.
 * No module should hard-code "use Venice" or "use OpenAI" directly —
 * instead, every caller declares a TaskType and this module decides
 * which provider, model tier, and flags to use.
 *
 * PROVIDER STRATEGY (3 tiers)
 * ---------------------------
 * A. PREMIUM  — Venice API (shared Pro tier)
 *    Used for: complex builder tasks, long-horizon orchestration, hard
 *    reasoning, advanced security/analysis, user-facing output where
 *    weak quality would damage product perception.
 *
 * B. ROUTINE  — Gemini 2.5 Flash (free tier via GEMINI_API_KEY)
 *    Used for: summarization, classification, tagging, lightweight
 *    rewriting, basic extraction, background helpers, repetitive
 *    system prompts, low-risk copilots.
 *    Falls back to Venice if Gemini is unavailable.
 *
 * C. FALLBACK — OpenAI GPT-4.1-mini / nano
 *    Used only when both Venice and Gemini are unavailable.
 *    Never the primary path for any task type.
 *
 * LOW-COST DEFAULT MODE
 * ---------------------
 * When LOW_COST_MODE=true (or VENICE_API_KEY is not set), ALL tasks
 * default to ROUTINE tier unless explicitly marked PREMIUM.
 * This is the default unless overridden.
 *
 * ENVIRONMENT VARIABLES
 * ---------------------
 * VENICE_API_KEY       — Venice Pro key (enables premium tier)
 * GEMINI_API_KEY       — Gemini free-tier key (enables routine tier)
 * OPENAI_API_KEY       — OpenAI fallback key
 * LOW_COST_MODE        — "true" forces all tasks to routine tier
 *
 * HOW TO USE
 * ----------
 * import { getProviderParams } from "./_core/provider-policy";
 *
 * const llmParams = await invokeLLM({
 *   messages,
 *   ...getProviderParams("seo_keyword_extraction"),
 * });
 *
 * ADDING NEW TASK TYPES
 * ---------------------
 * 1. Add the task name to the TaskType union below.
 * 2. Add it to TASK_TIER_MAP with the appropriate tier.
 * 3. Done — no other changes needed.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 */

// ─── Task type catalogue ────────────────────────────────────────────────────

/**
 * Every AI task in Titan must be declared here.
 * Use the most specific name that describes what the task does.
 */
export type TaskType =
  // ── Premium: complex builder / reasoning / security ──────────────────────
  | "builder_code_generation"       // Full app/module code generation
  | "builder_architecture_plan"     // Multi-step build planning
  | "builder_auto_fix"              // Automated code fix loop
  | "builder_module_generator"      // Business module generation
  | "builder_website_replicate"     // Website clone/replicate workflow
  | "chat_main"                     // Primary user-facing chat response
  | "chat_tool_call"                // Tool-calling within chat loop
  | "security_analysis"             // Security scan / red team analysis
  | "security_exploit_generation"   // Exploit / payload generation (forceOpenRouter)
  | "security_compliance_report"    // Compliance report generation
  | "web_agent_execution"           // Multi-step web agent task
  | "growth_intelligence"           // Growth strategy analysis
  | "marketplace_intelligence"      // Marketplace opportunity analysis
  | "grant_application"             // Grant application writing
  | "content_creator_draft"         // Long-form content creation (user-facing)
  | "improvement_backlog"           // Self-improvement backlog generation

  // ── Routine: commodity / background / low-risk ────────────────────────────
  | "seo_keyword_extraction"        // Extract keywords from content
  | "seo_meta_generation"           // Generate meta titles/descriptions
  | "seo_content_brief"             // Generate SEO content brief
  | "seo_robots_txt"                // Generate robots.txt
  | "blog_post_generation"          // Blog post writing (background)
  | "blog_bulk_generation"          // Bulk blog generation
  | "advertising_copy"              // Ad copy generation
  | "advertising_targeting"         // Audience targeting suggestions
  | "affiliate_discovery"           // Affiliate program discovery
  | "affiliate_recommendation"      // Affiliate link recommendations
  | "marketing_copy"                // Marketing copy generation
  | "content_intelligence_draft"    // Social post draft (background)
  | "content_intelligence_critique" // Content critique pass
  | "content_intelligence_rewrite"  // Content rewrite pass
  | "memory_fact_extraction"        // Extract facts from conversation
  | "memory_summarization"          // Summarize conversation history
  | "chat_title_generation"         // Auto-generate chat title
  | "grant_matching"                // Match grants to user profile
  | "tiktok_content"                // TikTok caption/script generation
  | "red_team_playbook"             // Red team playbook generation
  | "v3_feature_misc"               // Misc v3 feature AI calls
  | "v4_feature_misc"               // Misc v4 feature AI calls
  | "crowdfunding_story"            // Crowdfunding campaign story/reward tiers
  | "grant_plan_generation"         // Grant business plan generation
  | "security_finding_analysis"     // Analyse individual security tool findings
  | "security_report_generation"    // Generate full security assessment report
  | "grant_application_writing";    // Write individual grant application sections

// ─── Tier definitions ────────────────────────────────────────────────────────

export type ProviderTier = "premium" | "routine";

/**
 * Maps each task type to its provider tier.
 * PREMIUM → Venice (shared Pro) or OpenAI strong/premium
 * ROUTINE → Gemini Flash (free) with Venice fallback
 */
const TASK_TIER_MAP: Record<TaskType, ProviderTier> = {
  // Premium tasks
  builder_code_generation:      "premium",
  builder_architecture_plan:    "premium",
  builder_auto_fix:             "premium",
  builder_module_generator:     "premium",
  builder_website_replicate:    "premium",
  chat_main:                    "premium",
  chat_tool_call:               "premium",
  security_analysis:            "premium",
  security_exploit_generation:  "premium",
  security_compliance_report:   "premium",
  web_agent_execution:          "premium",
  growth_intelligence:          "premium",
  marketplace_intelligence:     "premium",
  grant_application:            "premium",
  content_creator_draft:        "premium",
  improvement_backlog:          "premium",

  // Routine tasks
  seo_keyword_extraction:       "routine",
  seo_meta_generation:          "routine",
  seo_content_brief:            "routine",
  seo_robots_txt:               "routine",
  blog_post_generation:         "routine",
  blog_bulk_generation:         "routine",
  advertising_copy:             "routine",
  advertising_targeting:        "routine",
  affiliate_discovery:          "routine",
  affiliate_recommendation:     "routine",
  marketing_copy:               "routine",
  content_intelligence_draft:   "routine",
  content_intelligence_critique:"routine",
  content_intelligence_rewrite: "routine",
  memory_fact_extraction:       "routine",
  memory_summarization:         "routine",
  chat_title_generation:        "routine",
  grant_matching:               "routine",
  tiktok_content:               "routine",
  red_team_playbook:            "routine",
  v3_feature_misc:              "routine",
  v4_feature_misc:              "routine",
  crowdfunding_story:           "routine",
  grant_plan_generation:        "routine",
  security_finding_analysis:    "routine",
  security_report_generation:   "premium",
  grant_application_writing:    "premium",
};

// ─── Provider params type ────────────────────────────────────────────────────

/**
 * The subset of InvokeParams that the policy layer controls.
 * Merge these into your invokeLLM call.
 */
export interface ProviderParams {
  /** Model quality tier for Venice/OpenAI routing */
  model: "fast" | "strong" | "premium";
  /** Background tasks don't consume chat rate limit */
  priority: "chat" | "background";
  /** Force Gemini for this call (routine tier) */
  forceGemini?: boolean;
  /** Force uncensored model chain (security exploit tasks) */
  forceOpenRouter?: boolean;
}

// ─── Low-cost mode detection ─────────────────────────────────────────────────

/**
 * Returns true when Titan is running in low-cost mode.
 * In this mode, all tasks default to ROUTINE tier unless explicitly PREMIUM.
 *
 * Enabled when:
 * - LOW_COST_MODE=true env var is set, OR
 * - VENICE_API_KEY is not configured (no premium provider available)
 *
 * This is the DEFAULT when Venice is not configured.
 */
export function isLowCostMode(): boolean {
  if (process.env.LOW_COST_MODE === "true") return true;
  // If Venice is not configured, we're inherently in low-cost mode
  if (!process.env.VENICE_API_KEY) return true;
  return false;
}

/**
 * Returns true when Gemini is available as a free routine provider.
 */
export function isGeminiAvailable(): boolean {
  return !!process.env.GEMINI_API_KEY;
}

// ─── Main policy function ────────────────────────────────────────────────────

/**
 * Get the provider parameters for a given task type.
 *
 * Usage:
 *   const result = await invokeLLM({
 *     messages,
 *     ...getProviderParams("blog_post_generation"),
 *   });
 *
 * @param task - The task type (from TaskType union)
 * @param overrideTier - Optional: force a specific tier regardless of policy
 * @returns Provider params to spread into invokeLLM call
 */
export function getProviderParams(
  task: TaskType,
  overrideTier?: ProviderTier
): ProviderParams {
  const tier = overrideTier ?? (isLowCostMode() ? "routine" : TASK_TIER_MAP[task]);

  // ── Security exploit tasks: always use uncensored chain ──────────────────
  if (task === "security_exploit_generation") {
    return {
      model: "strong",
      priority: "background",
      forceOpenRouter: true,
    };
  }

  // ── Premium tier: Venice (shared Pro) ────────────────────────────────────
  if (tier === "premium") {
    const isPremiumModel = [
      "builder_code_generation",
      "builder_architecture_plan",
      "builder_module_generator",
      "builder_website_replicate",
      "chat_main",
      "chat_tool_call",
    ].includes(task);

    const isStrongModel = [
      "builder_auto_fix",
      "security_analysis",
      "security_compliance_report",
      "web_agent_execution",
      "growth_intelligence",
      "marketplace_intelligence",
      "grant_application",
      "content_creator_draft",
      "improvement_backlog",
    ].includes(task);

    return {
      model: isPremiumModel ? "strong" : isStrongModel ? "strong" : "fast",
      priority: task.startsWith("chat_") ? "chat" : "background",
    };
  }

  // ── Routine tier: Gemini Flash (free) → Venice fallback ──────────────────
  // Use forceGemini when Gemini is available — this routes to Gemini 2.5 Flash
  // which is free-tier and handles commodity tasks well.
  // When Gemini is not available, fall through to Venice fast model.
  if (isGeminiAvailable()) {
    return {
      model: "fast",
      priority: "background",
      forceGemini: true,
    };
  }

  // Gemini not available — use Venice fast model (mistral-31-24b)
  return {
    model: "fast",
    priority: "background",
  };
}

/**
 * Get a human-readable description of the current provider strategy.
 * Useful for logging and operator dashboards.
 */
export function getProviderStrategyDescription(): string {
  const hasVenice = !!process.env.VENICE_API_KEY;
  const hasGemini = !!process.env.GEMINI_API_KEY;
  const hasOpenAI = !!process.env.OPENAI_API_KEY;
  const lowCost = isLowCostMode();

  const lines = [
    `Provider Strategy: ${lowCost ? "LOW-COST MODE" : "STANDARD MODE"}`,
    `  Premium tasks → ${hasVenice ? "Venice Pro (shared tier)" : "OpenAI GPT-4.1-mini (fallback)"}`,
    `  Routine tasks → ${hasGemini ? "Gemini 2.5 Flash (free)" : hasVenice ? "Venice fast (mistral-31-24b)" : "OpenAI GPT-4.1-nano (fallback)"}`,
    `  Uncensored tasks → Venice Dolphin → OpenRouter Dolphin → OpenAI`,
    `  Providers available: ${[hasVenice && "Venice", hasGemini && "Gemini", hasOpenAI && "OpenAI"].filter(Boolean).join(", ") || "none (check env vars)"}`,
  ];
  return lines.join("\n");
}

/**
 * Log the current provider strategy at startup.
 * Call this from server/_core/index.ts during startup.
 */
export function logProviderStrategy(log: { info: (msg: string) => void }): void {
  log.info(getProviderStrategyDescription());
}
