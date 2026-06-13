import { Router, Request, Response } from "express";

// Note: uses native fetch — requires Node 18+.
// If on older Node, run: npm install node-fetch and import it above.

const router = Router();
const TITAN_URL = process.env.TITAN_INFERENCE_URL || "http://localhost:8080";

// GET /api/titan/health — Check if inference server is running
router.get("/health", async (_req: Request, res: Response) => {
  try {
    const r = await fetch(TITAN_URL + "/health", {
      signal: AbortSignal.timeout(4000),   // 4 s timeout
    });
    const data = await r.json() as Record<string, unknown>;
    res.json({ status: "ok", model: data });
  } catch {
    res.status(503).json({ status: "offline", message: "Titan inference server unreachable. Set TITAN_INFERENCE_URL environment variable to connect." });
  }
});

// POST /api/titan/chat — Send a message to Titan AI
router.post("/chat", async (req: Request, res: Response) => {
  const { messages = [], max_tokens = 512, temperature = 0.7 } = req.body;
  try {
    const r = await fetch(TITAN_URL + "/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages, max_tokens, temperature }),
      signal: AbortSignal.timeout(60000),  // 60 s timeout for generation
    });
    const data = await r.json();
    res.json(data);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    res.status(500).json({ error: "Titan inference server error", detail: msg });
  }
});

export default router;
