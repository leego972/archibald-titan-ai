import { Router, Request, Response } from "express";
  import { ENV } from "../_core/env";
  import { createLogger } from "../_core/logger.js";

  const log = createLogger("TitanBuilder");
  const router = Router();

  interface LLMConfig { url: string; key: string; model: string; provider: string; }

  function getLLMConfig(): LLMConfig | null {
    const veniceKey = process.env.VENICE_API_KEY ?? "";
    const openaiKey = process.env.OPENAI_API_KEY ?? "";

    // 1. Dedicated self-hosted Titan inference server (FastAPI, OpenAI-compatible)
    if (ENV.titanApiUrl && ENV.titanApiKey) {
      return { url: ENV.titanApiUrl, key: ENV.titanApiKey, model: "titan-1b", provider: "titan" };
    }
    // 2. Venice.ai (default platform LLM)
    if (veniceKey) {
      return { url: "https://api.venice.ai/api/v1", key: veniceKey, model: "llama-3.3-70b", provider: "venice" };
    }
    // 3. OpenAI fallback
    if (openaiKey) {
      return { url: "https://api.openai.com/v1", key: openaiKey, model: "gpt-4o-mini", provider: "openai" };
    }
    return null;
  }

  // GET /api/titan/health
  router.get("/health", async (_req: Request, res: Response) => {
    const cfg = getLLMConfig();
    if (!cfg) {
      return void res.status(503).json({
        status: "offline",
        message: "No LLM API key configured (set VENICE_API_KEY or OPENAI_API_KEY)",
      });
    }
    // If dedicated titan server is set, verify it's reachable
    if (ENV.titanApiUrl) {
      try {
        await fetch(`${ENV.titanApiUrl}/health`, { signal: AbortSignal.timeout(4000) });
      } catch {
        return void res.status(503).json({ status: "offline", message: "Titan inference server unreachable" });
      }
    }
    return void res.json({ status: "ok", model: cfg.model, provider: cfg.provider });
  });

  // POST /api/titan/chat
  router.post("/chat", async (req: Request, res: Response) => {
    const { messages = [], max_tokens = 512, temperature = 0.7 } = req.body as {
      messages: Array<{ role: string; content: string }>;
      max_tokens?: number;
      temperature?: number;
    };

    const cfg = getLLMConfig();
    if (!cfg) {
      return void res.status(503).json({
        error: "No LLM API key configured. Set VENICE_API_KEY or OPENAI_API_KEY.",
      });
    }

    try {
      const r = await fetch(`${cfg.url}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${cfg.key}`,
        },
        body: JSON.stringify({ model: cfg.model, messages, max_tokens, temperature, stream: false }),
        signal: AbortSignal.timeout(60000),
      });

      if (!r.ok) {
        const errText = await r.text().catch(() => "");
        log.error("LLM API error", { status: r.status, body: errText.slice(0, 200) });
        return void res.status(502).json({ error: "LLM API error", detail: errText.slice(0, 200) });
      }

      const data = await r.json() as { choices: Array<{ message: { content: string } }> };
      const content = data.choices?.[0]?.message?.content ?? "";
      return void res.json({ response: content, model: cfg.model, provider: cfg.provider });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      log.error("TitanBuilder chat error", { error: msg });
      return void res.status(500).json({ error: "Titan chat error", detail: msg });
    }
  });

  export default router;
  