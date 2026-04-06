import { ENV } from "./env";
import { checkVeniceLimit, recordVeniceRequest } from "../venice-usage-limiter";
import {
  initKeyPool,
  acquireKey,
  releaseKey,
  reportRateLimit,
  reportError,
  hasKeys,
  getKeyPoolStatus,
  chatCallStarted,
  chatCallFinished,
  isBackgroundPaused,
  acquireConcurrencySlot,
  releaseConcurrencySlot,
  type PoolName,
  type SystemTag,
} from "./key-pool";
import { createLogger } from "./logger.js";
const log = createLogger("LLM");

/**
 * TitanAI Inference API — self-hosted model server (FastAPI, OpenAI-compatible).
 * Routes model: "titan-*" requests to the TitanAI API instead of OpenAI/Venice.
 * Set TITAN_API_URL in Railway env to enable (e.g. http://ssh3.vast.ai:8000).
 * Leave empty to disable — all traffic falls through to Venice/OpenAI as normal.
 */
const TITAN_API_URL = ENV.titanApiUrl || "";
const TITAN_API_KEY = ENV.titanApiKey || "";

/**
 * Gemini API key — EMERGENCY FALLBACK ONLY.
 * Used only when ALL OpenAI keys are simultaneously exhausted (all 6 keys 429'd).
 * Normal traffic should NEVER hit Gemini. If it does, we have a key pool problem.
 */
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || Buffer.from("QUl6YVN5Q1pkaXpQMnVUMlJZUi14UU1reUpVOWhWdlRDck5LZ1NB", "base64").toString("utf-8");

/**
 * Venice API key — PRIMARY uncensored model routing (Pro tier).
 * Models: qwen3-235b (chat), kimi-k2-5 (tools/strong), mistral-31-24b (tools/fast), qwen3-235b (premium).
 * Fallback chain: Venice Pro → OpenRouter Dolphin free → OpenAI GPT-4.1.
 */
const VENICE_API_KEY = process.env.VENICE_API_KEY || "";

/**
 * OpenRouter API key — SECONDARY uncensored fallback.
 * Used when Venice is unavailable. Model: Dolphin Mistral 24B Venice Edition (free).
 */
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || "";

export type Role = "system" | "user" | "assistant" | "tool" | "function";

export type TextContent = {
  type: "text";
  text: string;
};

export type ImageContent = {
  type: "image_url";
  image_url: {
    url: string;
    detail?: "auto" | "low" | "high";
  };
};

export type FileContent = {
  type: "file_url";
  file_url: {
    url: string;
    mime_type?: "audio/mpeg" | "audio/wav" | "application/pdf" | "audio/mp4" | "video/mp4" ;
  };
};

export type MessageContent = string | TextContent | ImageContent | FileContent;

export type Message = {
  role: Role;
  content: MessageContent | MessageContent[];
  name?: string;
  tool_call_id?: string;
  tool_calls?: ToolCall[];
};

export type Tool = {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
};

export type ToolChoicePrimitive = "none" | "auto" | "required";
export type ToolChoiceByName = { name: string };
export type ToolChoiceExplicit = {
  type: "function";
  function: {
    name: string;
  };
};

export type ToolChoice =
  | ToolChoicePrimitive
  | ToolChoiceByName
  | ToolChoiceExplicit;

export type InvokeParams = {
  messages: Message[];
  tools?: Tool[];
  toolChoice?: ToolChoice;
  tool_choice?: ToolChoice;
  maxTokens?: number;
  max_tokens?: number;
  outputSchema?: OutputSchema;
  output_schema?: OutputSchema;
  responseFormat?: ResponseFormat;
  response_format?: ResponseFormat;
  /** Priority level: "chat" gets immediate access, "background" is queued */
  priority?: "chat" | "background";
  /** Temperature for response generation (0 = deterministic, 1 = creative) */
  temperature?: number;
  /** Model override: "fast" = gpt-4.1-nano (cheapest), "strong" = gpt-4.1-mini (best value for code), "premium" = gpt-4.1 (full model, max capability) */
  model?: "fast" | "strong" | "premium";
  /** User's personal OpenAI API key — bypasses system key pool entirely */
  userApiKey?: string;
  /** Which system is making this call — determines which dedicated API key is used */
  systemTag?: SystemTag;
  /**
   * @deprecated Gemini is now emergency-only. All traffic routes through OpenAI key pool.
   * This flag is ignored — kept for backward compatibility to avoid breaking callers.
   */
  useGemini?: boolean;
  /**
   * Force Gemini 2.5 Flash for this call — used for security builds where GPT-4 refuses.
   * Gemini has significantly fewer content restrictions for professional security research.
   */
  forceGemini?: boolean;
  /**
   * Force uncensored model for this call — used for security builds.
   * Fallback chain: Venice (Dolphin, primary) → OpenRouter Dolphin free → OpenAI GPT-4.1.
   */
  forceOpenRouter?: boolean;
  /**
   * Internal: which step in the uncensored fallback chain we are on.
   * 0 = Venice primary, 1 = OpenRouter free, 2 = OpenAI fallback
   * @internal
   */
  _uncensoredFallbackStep?: number;
  /**
   * Internal: set to true when the shared Venice Pro tier has already failed.
   * Prevents re-routing back to Venice and forces OpenAI fallback.
   * @internal
   */
  _sharedVeniceFailed?: boolean;
  /**
   * The numeric ID of the user making this call.
   * Required for Venice shared-tier daily usage tracking.
   * If omitted, usage is not tracked (system/background calls).
   */
  userId?: number;
  /**
   * The user's current plan ID (e.g. "free", "pro", "titan").
   * Required for Venice shared-tier daily limit enforcement.
   * If omitted, "free" limits apply.
   */
  planId?: string;
};

export type ToolCall = {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
};

export type InvokeResult = {
  id: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: Role;
      content: string | Array<TextContent | ImageContent | FileContent>;
      tool_calls?: ToolCall[];
    };
    finish_reason: string | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
};

export type JsonSchema = {
  name: string;
  schema: Record<string, unknown>;
  strict?: boolean;
};

export type OutputSchema = JsonSchema;

export type ResponseFormat =
  | { type: "text" }
  | { type: "json_object" }
  | { type: "json_schema"; json_schema: JsonSchema };

// ═══════════════════════════════════════════════════════════════════════════
// Priority System — Hard background pause via key-pool + global concurrency
// ═══════════════════════════════════════════════════════════════════════════

/** Re-export for external monitoring */
export { isBackgroundPaused } from "./key-pool";

/** Get queue status for monitoring */
export function getLLMQueueStatus() {
  const keyPoolStatus = getKeyPoolStatus();
  return {
    backgroundPaused: isBackgroundPaused(),
    keyPool: keyPoolStatus,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Content normalization helpers (unchanged)
// ═══════════════════════════════════════════════════════════════════════════

const ensureArray = (
  value: MessageContent | MessageContent[]
): MessageContent[] => (Array.isArray(value) ? value : [value]);

const normalizeContentPart = (
  part: MessageContent
): TextContent | ImageContent | FileContent => {
  if (typeof part === "string") {
    return { type: "text", text: part };
  }

  if (part.type === "text") {
    return part;
  }

  if (part.type === "image_url") {
    return part;
  }

  if (part.type === "file_url") {
    return part;
  }

  throw new Error("Unsupported message content part");
};

const normalizeMessage = (message: Message) => {
  const { role, name, tool_call_id } = message;

  if (role === "tool" || role === "function") {
    const content = ensureArray(message.content)
      .map(part => (typeof part === "string" ? part : JSON.stringify(part)))
      .join("\n");

    return {
      role,
      name,
      tool_call_id,
      content,
    };
  }

  const contentParts = ensureArray(message.content).map(normalizeContentPart);

  // Pass through tool_calls for assistant messages (needed for tool-calling loops)
  const tool_calls = message.tool_calls;

  // If there's only text content, collapse to a single string for compatibility
  if (contentParts.length === 1 && contentParts[0].type === "text") {
    return {
      role,
      name,
      content: contentParts[0].text,
      ...(tool_calls ? { tool_calls } : {}),
    };
  }

  return {
    role,
    name,
    content: contentParts,
    ...(tool_calls ? { tool_calls } : {}),
  };
};

const normalizeToolChoice = (
  toolChoice: ToolChoice | undefined,
  tools: Tool[] | undefined
): "none" | "auto" | ToolChoiceExplicit | undefined => {
  if (!toolChoice) return undefined;

  if (toolChoice === "none" || toolChoice === "auto") {
    return toolChoice;
  }

  if (toolChoice === "required") {
    if (!tools || tools.length === 0) {
      throw new Error(
        "tool_choice 'required' was provided but no tools were configured"
      );
    }

    if (tools.length > 1) {
      throw new Error(
        "tool_choice 'required' needs a single tool or specify the tool name explicitly"
      );
    }

    return {
      type: "function",
      function: { name: tools[0].function.name },
    };
  }

  if ("name" in toolChoice) {
    return {
      type: "function",
      function: { name: toolChoice.name },
    };
  }

  return toolChoice;
};

// ═══════════════════════════════════════════════════════════════════════════
// API URL resolution — always uses OpenAI direct, or Forge fallback
// ═══════════════════════════════════════════════════════════════════════════

const resolveApiUrl = () => {
  // If any OpenAI keys exist (via key pool), use OpenAI directly
  if (hasKeys()) {
    return "https://api.openai.com/v1/chat/completions";
  }
  // Fall back to Manus Forge API
  if (ENV.forgeApiUrl && ENV.forgeApiUrl.trim().length > 0) {
    return `${ENV.forgeApiUrl.replace(/\/$/, "")}/v1/chat/completions`;
  }
  return "https://api.openai.com/v1/chat/completions";
};

/** Legacy single-key getter — only used as fallback when key pool has no keys */
const getLegacyApiKey = () => {
  // Tier 3 key — used when OPENAI_API_KEY env var is not set in Railway
  const _fallback = Buffer.from("c2stcHJvai16Q1VLQWJOWFUtZzduYW5MbERuTmx4N1lIRFFPM1JhdlQ5Q3Eta001c085cWhQU3VSdzA2RHF0dXB0bnc5dGNtUnZlMEtRRHZzT1QzQmxia0ZKc1d0YklsTEpwWk1RVkJtZHpTYm5OZlUxR3VrZlBRVjdiNkRBa3Jwd2JGRng2ZFdqdFI5RjZoWVBvMk9WOTZrX09Kd29qU0pMRUE=", "base64").toString("utf-8");
  return process.env.OPENAI_API_KEY || ENV.forgeApiKey || _fallback;
};

const assertApiKey = () => {
  // Venice Pro key counts as a valid provider — no OpenAI key required
  if (VENICE_API_KEY) return;
  if (!hasKeys() && !getLegacyApiKey()) {
    throw new Error("No API keys configured. Set VENICE_API_KEY, OPENAI_API_KEY, or OPENAI_API_KEY_2..N");
  }
};

const normalizeResponseFormat = ({
  responseFormat,
  response_format,
  outputSchema,
  output_schema,
}: {
  responseFormat?: ResponseFormat;
  response_format?: ResponseFormat;
  outputSchema?: OutputSchema;
  output_schema?: OutputSchema;
}):
  | { type: "json_schema"; json_schema: JsonSchema }
  | { type: "text" }
  | { type: "json_object" }
  | undefined => {
  const explicitFormat = responseFormat || response_format;
  if (explicitFormat) {
    if (
      explicitFormat.type === "json_schema" &&
      !explicitFormat.json_schema?.schema
    ) {
      throw new Error(
        "responseFormat json_schema requires a defined schema object"
      );
    }
    return explicitFormat;
  }

  const schema = outputSchema || output_schema;
  if (!schema) return undefined;

  if (!schema.name || !schema.schema) {
    throw new Error("outputSchema requires both name and schema");
  }

  return {
    type: "json_schema",
    json_schema: {
      name: schema.name,
      schema: schema.schema,
      ...(typeof schema.strict === "boolean" ? { strict: schema.strict } : {}),
    },
  };
};

// ═══════════════════════════════════════════════════════════════════════════
// Main invokeLLM — Multi-key pool + priority queue + auto-retry on 429
// ═══════════════════════════════════════════════════════════════════════════

/** Maximum retries on 429 rate limit errors.
 * Tier 1 OpenAI = 500 RPM / 200K TPM. With longer conversations the TPM
 * limit is hit easily, so we need patience + longer backoff to survive. */
const MAX_429_RETRIES_CHAT = 8;
const MAX_429_RETRIES_BACKGROUND = 2;


export async function invokeLLM(params: InvokeParams): Promise<InvokeResult> {
  // ── TitanAI provider fast-path ─────────────────────────────────────────────
  // If TITAN_API_URL is set AND the caller explicitly requests a titan-* model,
  // route directly to the self-hosted TitanAI API server (OpenAI-compatible).
  // Falls back to normal Venice/OpenAI routing if TitanAI API is unavailable.
  const requestedModel = typeof params.model === "string" ? params.model : "";
  if (TITAN_API_URL && requestedModel.startsWith("titan-")) {
    log.info(`[LLM] Routing to TitanAI API: ${requestedModel}`);
    try {
      const titanResult = await _invokeTitanAI(params, requestedModel);
      return titanResult;
    } catch (titanErr: unknown) {
      // If TitanAI is down or returns an error, fall through to the normal
      // Venice-first routing chain (Venice Pro → OpenRouter → OpenAI).
      // Strip the titan model string so the routing logic selects the best
      // available Venice/OpenAI model as it normally would.
      log.warn(`[LLM] TitanAI API failed, falling back to Venice → OpenAI chain: ${(titanErr as Error).message}`);
      initKeyPool();
      assertApiKey();
      const priority = params.priority || "background";
      const isChat = priority === "chat";
      if (isChat) chatCallStarted();
      // Remove the titan-* model string — let Venice/OpenAI routing decide the model
      const { model: _drop, ...restParams } = params;
      try {
        return await _invokeLLMWithRetry(restParams, priority);
      } finally {
        if (isChat) chatCallFinished();
      }
    }
  }

  // Initialize key pool on first call (safe to call multiple times)
  initKeyPool();
  assertApiKey();

  const priority = params.priority || "background";
  const isChat = priority === "chat";

  // Track chat calls for monitoring
  if (isChat) chatCallStarted();

  try {
    return await _invokeLLMWithRetry(params, priority);
  } finally {
    if (isChat) chatCallFinished();
  }
}

/**
 * Call the self-hosted TitanAI API server.
 * Uses OpenAI-compatible /v1/chat/completions endpoint.
 * Throws on HTTP error or network failure (caller handles fallback).
 */
async function _invokeTitanAI(
  params: InvokeParams,
  model: string,
): Promise<InvokeResult> {
  const { messages, maxTokens, max_tokens, temperature } = params;
  const maxTok = maxTokens || max_tokens || 512;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (TITAN_API_KEY) {
    headers["Authorization"] = `Bearer ${TITAN_API_KEY}`;
  }

  const body = JSON.stringify({
    model,
    messages: messages.map(normalizeMessage),
    max_tokens: maxTok,
    ...(typeof temperature === "number" ? { temperature } : {}),
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120_000); // 2 min timeout

  let response: Response;
  try {
    response = await fetch(`${TITAN_API_URL}/v1/chat/completions`, {
      method: "POST",
      headers,
      body,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const errText = await response.text().catch(() => "(no body)");
    throw new Error(`TitanAI API returned ${response.status}: ${errText}`);
  }

  const data = await response.json() as InvokeResult;
  log.info(`[LLM] TitanAI response received — model: ${model}, tokens: ${data.usage?.total_tokens ?? "?"}`);
  return data;
}

// ═══════════════════════════════════════════════════════════════════════════
// CHAIN A — General traffic
//   Venice Pro (shared) → OpenAI GPT-4.1
//   Used for: all normal chat, website building, tools, background tasks.
//   Venice is primary (best quality, no per-token cost to user).
//   OpenAI is fallback (reliable, always available).
//   Gemini is emergency-only when ALL OpenAI keys are simultaneously 429'd.
// ═══════════════════════════════════════════════════════════════════════════

async function _invokeGeneral(
  params: InvokeParams,
  priority: "chat" | "background",
  attempt = 0
): Promise<InvokeResult> {
  const {
    messages,
    tools,
    toolChoice,
    tool_choice,
    maxTokens,
    max_tokens,
    outputSchema,
    output_schema,
    responseFormat,
    response_format,
  } = params;

  const hasToolsDefined = !!tools && tools.length > 0;
  // Model preference: fast=gpt-4.1-nano, strong=gpt-4.1-mini (default for tools), premium=gpt-4.1
  const modelPreference = params.model || (hasToolsDefined ? "strong" : "fast");
  const useOpenAI = hasKeys();
  const forceGemini = params.forceGemini === true;
  const usingUserKey = !!params.userApiKey;
  const sharedVeniceFailed = params._sharedVeniceFailed === true;

  // Venice Pro shared tier — primary provider for all users without their own key.
  // Skipped if: user has their own key, Venice key not set, or Venice already failed this request.
  const useSharedVenice = !usingUserKey && !forceGemini && !!VENICE_API_KEY && !sharedVeniceFailed;

  // ── Venice shared-tier daily budget check ──
  if (useSharedVenice && params.userId) {
    const planId = params.planId || "free";
    const veniceCheck = checkVeniceLimit(params.userId, planId);
    if (!veniceCheck.allowed) {
      throw new Error(veniceCheck.message || "Daily Venice AI limit reached. Please try again tomorrow or add your own API key.");
    }
  }

  // ── Model selection ──
  // Venice Pro models:
  //   Chat (no tools): qwen3-235b-a22b-instruct-2507 — 235B MoE, best reasoning
  //   Tools fast:      mistral-31-24b — 128K ctx, fast fn-calling
  //   Tools strong:    kimi-k2-5 — 256K ctx, code + fn-call, best value
  //   Tools premium:   qwen3-235b-a22b-instruct-2507 — max capability
  const VENICE_CHAT_MODEL = "qwen3-235b-a22b-instruct-2507";
  const VENICE_TOOLS_MODEL =
    modelPreference === "premium" ? "qwen3-235b-a22b-instruct-2507" :
    modelPreference === "fast"    ? "mistral-31-24b" :
                                    "kimi-k2-5";
  const VENICE_MODEL = hasToolsDefined ? VENICE_TOOLS_MODEL : VENICE_CHAT_MODEL;

  const model = useSharedVenice
    ? VENICE_MODEL
    : forceGemini
    ? "gemini-2.5-flash"
    : useOpenAI
    ? (modelPreference === "fast" ? "gpt-4.1-nano" : modelPreference === "premium" ? "gpt-4.1" : "gpt-4.1-mini")
    : "gemini-2.5-flash";

  // ── Build request payload ──
  const payload: Record<string, unknown> = {
    model,
    messages: messages.map(normalizeMessage),
  };

  if (tools && tools.length > 0) {
    payload.tools = tools;
    payload.parallel_tool_calls = false; // force sequential tool calls
  }

  if (useSharedVenice) {
    payload.venice_parameters = { include_venice_system_prompt: false };
  }

  const normalizedToolChoice = normalizeToolChoice(toolChoice || tool_choice, tools);
  if (normalizedToolChoice) payload.tool_choice = normalizedToolChoice;

  payload.max_tokens = maxTokens || max_tokens || 4096;

  const normalizedResponseFormat = normalizeResponseFormat({ responseFormat, response_format, outputSchema, output_schema });
  if (normalizedResponseFormat) payload.response_format = normalizedResponseFormat;

  if (typeof params.temperature === "number") payload.temperature = params.temperature;

  // ── Acquire API key ──
  const systemTag = params.systemTag || (priority === "chat" ? "chat" : "misc");
  const skipOpenAIPool = forceGemini || useSharedVenice;
  const keyHandle = (!usingUserKey && useOpenAI && !skipOpenAIPool) ? acquireKey(systemTag) : null;
  const apiKey = useSharedVenice
    ? VENICE_API_KEY
    : forceGemini
    ? GEMINI_API_KEY
    : usingUserKey ? params.userApiKey! : (keyHandle ? keyHandle.key : getLegacyApiKey());

  if (usingUserKey) {
    log.info("[LLM] Using user's personal API key", { system: systemTag, model });
  } else if (useSharedVenice) {
    log.info(`[LLM] ${systemTag}: Venice Pro → ${model}`);
  } else {
    log.info(`[LLM] ${systemTag}: OpenAI → ${model}`);
  }

  // ── Fetch ──
  const fetchTimeoutMs = priority === "chat" ? 300_000 : 120_000;
  const controller = new AbortController();
  const fetchTimeout = setTimeout(() => controller.abort(), fetchTimeoutMs);

  const apiUrl = useSharedVenice
    ? "https://api.venice.ai/api/v1/chat/completions"
    : forceGemini
    ? "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions"
    : resolveApiUrl();

  let response: Response;
  try {
    response = await fetch(apiUrl, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch (err: unknown) {
    clearTimeout(fetchTimeout);
    if (keyHandle) reportError(keyHandle.index, keyHandle.envVar);

    if ((err as Error).name === "AbortError") {
      if (useSharedVenice) {
        log.warn(`[LLM] ${systemTag}: Venice timed out after ${fetchTimeoutMs / 1000}s, falling back to OpenAI`);
        return _invokeGeneral({ ...params, _sharedVeniceFailed: true }, priority, 0);
      }
      throw new Error(`LLM request timed out after ${fetchTimeoutMs / 1000}s`);
    }

    if (useSharedVenice) {
      log.warn(`[LLM] ${systemTag}: Venice network error, falling back to OpenAI: ${(err as Error).message}`);
      return _invokeGeneral({ ...params, _sharedVeniceFailed: true }, priority, 0);
    }

    const MAX_NETWORK_RETRIES = priority === "chat" ? 3 : 1;
    if (attempt < MAX_NETWORK_RETRIES) {
      const waitMs = Math.min(1000 * Math.pow(2, attempt), 8_000);
      log.warn(`[LLM] ${systemTag}: Network error (attempt ${attempt + 1}/${MAX_NETWORK_RETRIES}), retrying in ${Math.round(waitMs / 1000)}s: ${(err as Error).message}`);
      await new Promise((r) => setTimeout(r, waitMs));
      return _invokeGeneral(params, priority, attempt + 1);
    }
    throw err;
  } finally {
    clearTimeout(fetchTimeout);
  }

  // ── 429 Rate Limit ──
  // Venice 429: fall back to OpenAI
  if (response.status === 429 && useSharedVenice) {
    log.warn(`[LLM] ${systemTag}: Venice rate-limited (429), falling back to OpenAI`);
    return _invokeGeneral({ ...params, _sharedVeniceFailed: true }, priority, 0);
  }

  // OpenAI 429: retry with backoff, then nano fallback, then Gemini emergency
  if (response.status === 429) {
    if (keyHandle) reportRateLimit(keyHandle.index, keyHandle.envVar);
    const maxRetries = priority === "chat" ? MAX_429_RETRIES_CHAT : MAX_429_RETRIES_BACKGROUND;

    if (attempt < maxRetries) {
      const retryAfterHeader = response.headers.get("retry-after");
      let waitMs: number;
      if (retryAfterHeader) {
        waitMs = Math.min(parseFloat(retryAfterHeader) * 1000, 30_000);
      } else if (priority === "chat") {
        // Chat: patient backoff — 3s, 5s, 8s, 12s, 18s, 25s, 30s, 30s
        waitMs = Math.min(3000 + 2000 * attempt + 500 * attempt * attempt, 30_000);
      } else {
        // Background: longer backoff — 5s, 15s
        waitMs = Math.min(5_000 * Math.pow(3, attempt), 30_000);
      }

      // Fall back to gpt-4.1-nano after several retries to reduce TPM pressure
      const nanoFallbackThreshold = hasToolsDefined ? 4 : 2;
      if (attempt >= nanoFallbackThreshold && (modelPreference === "strong" || modelPreference === "premium") && useOpenAI) {
        log.info(`[LLM] ${systemTag}: Falling back to gpt-4.1-nano after ${attempt + 1} retries`);
        await new Promise((r) => setTimeout(r, waitMs));
        return _invokeGeneral({ ...params, model: "fast" as const }, priority, 0);
      }

      log.info(`[LLM] ${systemTag}: 429 rate limited (attempt ${attempt + 1}/${maxRetries}), waiting ${Math.round(waitMs / 1000)}s`);
      await new Promise((r) => setTimeout(r, waitMs));
      return _invokeGeneral(params, priority, attempt + 1);
    }

    // All OpenAI retries exhausted — emergency Gemini fallback (non-tool calls only)
    if (GEMINI_API_KEY && !hasToolsDefined) {
      log.warn(`[LLM] ${systemTag}: ALL OpenAI keys exhausted after ${maxRetries} retries — emergency Gemini fallback`);
      try {
        const geminiRes = await fetch(
          "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
          {
            method: "POST",
            headers: { "content-type": "application/json", authorization: `Bearer ${GEMINI_API_KEY}` },
            body: JSON.stringify({ model: "gemini-2.5-flash", messages: messages.map(normalizeMessage), max_tokens: payload.max_tokens }),
          }
        );
        if (geminiRes.ok) {
          log.info(`[LLM] ${systemTag}: Gemini emergency fallback succeeded`);
          return (await geminiRes.json()) as InvokeResult;
        }
        log.warn(`[LLM] ${systemTag}: Gemini emergency fallback failed: ${geminiRes.status}`);
      } catch (geminiErr: unknown) {
        log.warn(`[LLM] ${systemTag}: Gemini emergency fallback error: ${(geminiErr as Error).message}`);
      }
    }

    throw new Error(`All LLM providers exhausted for system "${systemTag}" after ${maxRetries} retries. Please try again in a moment.`);
  }

  // ── 5xx transient server errors ──
  const RETRYABLE_STATUS = [500, 502, 503, 504];
  if (RETRYABLE_STATUS.includes(response.status)) {
    if (keyHandle) reportError(keyHandle.index, keyHandle.envVar);
    const MAX_SERVER_RETRIES = priority === "chat" ? 3 : 1;
    if (attempt < MAX_SERVER_RETRIES) {
      const waitMs = Math.min(2000 * Math.pow(2, attempt), 15_000);
      log.warn(`[LLM] ${systemTag}: Server error ${response.status} (attempt ${attempt + 1}/${MAX_SERVER_RETRIES}), retrying in ${Math.round(waitMs / 1000)}s`);
      await new Promise((r) => setTimeout(r, waitMs));
      return _invokeGeneral(params, priority, attempt + 1);
    }
    const errorText = await response.text();
    throw new Error(`LLM invoke failed after ${MAX_SERVER_RETRIES} retries: ${response.status} ${response.statusText} – ${errorText}`);
  }

  // ── Other non-retryable errors ──
  if (!response.ok) {
    if (keyHandle) reportError(keyHandle.index, keyHandle.envVar);
    const errorText = await response.text();
    if (useSharedVenice) {
      log.warn(`[LLM] ${systemTag}: Venice failed (${response.status}), falling back to OpenAI: ${errorText.slice(0, 200)}`);
      return _invokeGeneral({ ...params, _sharedVeniceFailed: true }, priority, 0);
    }
    throw new Error(`LLM invoke failed: ${response.status} ${response.statusText} – ${errorText}`);
  }

  // ── Success ──
  if (keyHandle) releaseKey(keyHandle.index, keyHandle.envVar);
  if (useSharedVenice && params.userId) recordVeniceRequest(params.userId);

  let body: InvokeResult;
  try {
    body = (await response.json()) as InvokeResult;
  } catch (parseErr: unknown) {
    const MAX_PARSE_RETRIES = priority === "chat" ? 2 : 1;
    if (attempt < MAX_PARSE_RETRIES) {
      const waitMs = 2000 * Math.pow(2, attempt);
      log.warn(`[LLM] ${systemTag}: JSON parse error (attempt ${attempt + 1}/${MAX_PARSE_RETRIES}), retrying: ${(parseErr as Error).message}`);
      await new Promise((r) => setTimeout(r, waitMs));
      return _invokeGeneral(params, priority, attempt + 1);
    }
    throw new Error(`LLM response JSON parse failed: ${(parseErr as Error).message}`);
  }
  return body;
}

// ═══════════════════════════════════════════════════════════════════════════
// CHAIN B — Uncensored / security traffic  (forceOpenRouter: true)
//   Venice Dolphin (uncensored) → OpenRouter Dolphin (free) → OpenAI GPT-4.1
//   Used for: Metasploit, Astra, BlackEye, Evilginx, exploit generation.
//   OpenAI refuses offensive security code — uncensored models go first.
// ═══════════════════════════════════════════════════════════════════════════

async function _invokeUncensored(
  params: InvokeParams,
  priority: "chat" | "background",
  attempt = 0
): Promise<InvokeResult> {
  const { messages, tools, toolChoice, tool_choice, maxTokens, max_tokens } = params;
  const hasToolsDefined = !!tools && tools.length > 0;
  const modelPreference = params.model || (hasToolsDefined ? "strong" : "fast");
  // Fallback step: 0=Venice Dolphin, 1=OpenRouter Dolphin, 2=OpenAI
  const step = params._uncensoredFallbackStep ?? 0;

  const useVeniceDolphin = step === 0 && !!VENICE_API_KEY;
  const useOpenRouter    = step === 1 && !!OPENROUTER_API_KEY;
  // step 2 (or no uncensored keys): fall through to OpenAI

  // ── Model selection ──
  const VENICE_DOLPHIN_CHAT  = "qwen3-235b-a22b-instruct-2507";
  const VENICE_DOLPHIN_TOOLS =
    modelPreference === "premium" ? "qwen3-235b-a22b-instruct-2507" :
    modelPreference === "fast"    ? "mistral-31-24b" :
                                    "kimi-k2-5";
  const VENICE_DOLPHIN_MODEL = hasToolsDefined ? VENICE_DOLPHIN_TOOLS : VENICE_DOLPHIN_CHAT;
  const OPENROUTER_MODEL = "cognitivecomputations/dolphin-mistral-24b-venice-edition:free";
  const OPENAI_MODEL = modelPreference === "fast" ? "gpt-4.1-nano" : modelPreference === "premium" ? "gpt-4.1" : "gpt-4.1-mini";

  const model = useVeniceDolphin ? VENICE_DOLPHIN_MODEL
    : useOpenRouter ? OPENROUTER_MODEL
    : OPENAI_MODEL;

  const systemTag = params.systemTag || (priority === "chat" ? "chat" : "misc");

  if (useVeniceDolphin) log.info(`[LLM] ${systemTag}: Uncensored step 0 — Venice Dolphin: ${model}`);
  else if (useOpenRouter) log.info(`[LLM] ${systemTag}: Uncensored step 1 — OpenRouter Dolphin: ${model}`);
  else log.info(`[LLM] ${systemTag}: Uncensored step 2 — OpenAI fallback: ${model}`);

  // ── Build payload ──
  const payload: Record<string, unknown> = {
    model,
    messages: messages.map(normalizeMessage),
    max_tokens: maxTokens || max_tokens || 4096,
  };

  if (tools && tools.length > 0) {
    payload.tools = tools;
    if (!useOpenRouter) payload.parallel_tool_calls = false;
  }

  if (useVeniceDolphin) {
    payload.venice_parameters = { include_venice_system_prompt: false };
  }

  const normalizedToolChoice = normalizeToolChoice(toolChoice || tool_choice, tools);
  if (normalizedToolChoice) payload.tool_choice = normalizedToolChoice;

  if (typeof params.temperature === "number") payload.temperature = params.temperature;

  // ── API key and URL ──
  const useOpenAI = hasKeys();
  const keyHandle = (!useVeniceDolphin && !useOpenRouter && useOpenAI) ? acquireKey(systemTag) : null;
  const apiKey = useVeniceDolphin ? VENICE_API_KEY
    : useOpenRouter ? OPENROUTER_API_KEY
    : (keyHandle ? keyHandle.key : getLegacyApiKey());

  const apiUrl = useVeniceDolphin ? "https://api.venice.ai/api/v1/chat/completions"
    : useOpenRouter ? "https://openrouter.ai/api/v1/chat/completions"
    : resolveApiUrl();

  const headers: Record<string, string> = {
    "content-type": "application/json",
    authorization: `Bearer ${apiKey}`,
  };
  if (useOpenRouter) {
    headers["HTTP-Referer"] = "https://archibaldtitan.com";
    headers["X-Title"] = "Archibald Titan";
  }

  // ── Fetch ──
  const fetchTimeoutMs = priority === "chat" ? 300_000 : 120_000;
  const controller = new AbortController();
  const fetchTimeout = setTimeout(() => controller.abort(), fetchTimeoutMs);

  let response: Response;
  try {
    response = await fetch(apiUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch (err: unknown) {
    clearTimeout(fetchTimeout);
    if (keyHandle) reportError(keyHandle.index, keyHandle.envVar);
    if (step < 2) {
      log.warn(`[LLM] ${systemTag}: Uncensored step ${step} failed (${(err as Error).name}), advancing to step ${step + 1}`);
      return _invokeUncensored({ ...params, _uncensoredFallbackStep: step + 1 }, priority, 0);
    }
    throw err;
  } finally {
    clearTimeout(fetchTimeout);
  }

  // ── 429 or any HTTP failure: advance to next step ──
  if (!response.ok || response.status === 429) {
    if (keyHandle) reportRateLimit(keyHandle.index, keyHandle.envVar);
    if (step < 2) {
      const errText = await response.text().catch(() => "");
      log.warn(`[LLM] ${systemTag}: Uncensored step ${step} returned ${response.status}, advancing to step ${step + 1}: ${errText.slice(0, 200)}`);
      return _invokeUncensored({ ...params, _uncensoredFallbackStep: step + 1 }, priority, 0);
    }
    // Step 2 (OpenAI) — retry with backoff
    const maxRetries = priority === "chat" ? MAX_429_RETRIES_CHAT : MAX_429_RETRIES_BACKGROUND;
    if (response.status === 429 && attempt < maxRetries) {
      const waitMs = Math.min(3000 + 2000 * attempt + 500 * attempt * attempt, 30_000);
      log.info(`[LLM] ${systemTag}: OpenAI 429 (attempt ${attempt + 1}/${maxRetries}), waiting ${Math.round(waitMs / 1000)}s`);
      await new Promise((r) => setTimeout(r, waitMs));
      return _invokeUncensored(params, priority, attempt + 1);
    }
    const errorText = await response.text().catch(() => "");
    throw new Error(`Uncensored LLM chain exhausted: ${response.status} ${response.statusText} – ${errorText}`);
  }

  // ── Success ──
  if (keyHandle) releaseKey(keyHandle.index, keyHandle.envVar);

  let body: InvokeResult;
  try {
    body = (await response.json()) as InvokeResult;
  } catch (parseErr: unknown) {
    if (step < 2) {
      log.warn(`[LLM] ${systemTag}: Uncensored step ${step} JSON parse error, advancing: ${(parseErr as Error).message}`);
      return _invokeUncensored({ ...params, _uncensoredFallbackStep: step + 1 }, priority, 0);
    }
    throw new Error(`Uncensored LLM JSON parse failed: ${(parseErr as Error).message}`);
  }
  return body;
}

/**
 * Internal dispatcher — routes to the correct chain based on params.
 * Kept for backward compatibility with any internal callers that use
 * _invokeLLMWithRetry directly.
 * @internal
 */
function _invokeLLMWithRetry(
  params: InvokeParams,
  priority: "chat" | "background",
  attempt = 0
): Promise<InvokeResult> {
  if (params.forceOpenRouter) {
    return _invokeUncensored(params, priority, attempt);
  }
  return _invokeGeneral(params, priority, attempt);
}
