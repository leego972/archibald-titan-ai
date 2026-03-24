/**
 * Content Streaming — SSE endpoint for real-time content generation progress.
 *
 * Provides live progress updates for long-running content generation tasks:
 * - generateContent (AI blog/social/email/ad copy generation)
 * - bulkGenerate (multi-piece batch generation)
 * - generateFromSeoBrief (SEO-optimised long-form content)
 * - generateStrategy (campaign strategy generation)
 *
 * Events emitted:
 * - progress: Step-by-step progress update (e.g., "Generating outline...")
 * - text_chunk: Streaming text token from the LLM
 * - done: Generation complete — includes the final content
 * - error: An error occurred during generation
 *
 * Usage:
 *   1. Client starts a content generation mutation → receives a jobId
 *   2. Client connects to /api/content/stream/:jobId via EventSource
 *   3. Server streams progress events and text chunks
 *   4. Client receives "done" event with final content
 */
import type { Express, Request, Response } from "express";
import { EventEmitter } from "events";

// ── Active Content Job Tracking ──────────────────────────────────
// Maps jobId (string UUID) → EventEmitter for streaming events
const activeContentStreams = new Map<string, EventEmitter>();

// Maps jobId → current status for reconnection support
export interface ContentJobStatus {
  jobId: string;
  userId: number;
  status: "running" | "completed" | "failed";
  startedAt: number;
  completedAt?: number;
  currentStep: string;
  totalSteps: number;
  completedSteps: number;
  result?: string;
  error?: string;
}
const activeContentJobs = new Map<string, ContentJobStatus>();

// ── Job Management ────────────────────────────────────────────────

/**
 * Register a new content generation job.
 * Returns a jobId that the client can use to connect to the SSE stream.
 */
export function registerContentJob(jobId: string, userId: number, totalSteps = 5): void {
  activeContentJobs.set(jobId, {
    jobId,
    userId,
    status: "running",
    startedAt: Date.now(),
    currentStep: "Initialising...",
    totalSteps,
    completedSteps: 0,
  });
  // Create the event emitter for this job
  const emitter = new EventEmitter();
  emitter.setMaxListeners(20);
  activeContentStreams.set(jobId, emitter);
}

/**
 * Emit a progress event for a content generation job.
 */
export function emitContentProgress(
  jobId: string,
  step: string,
  completedSteps?: number
): void {
  const job = activeContentJobs.get(jobId);
  if (job) {
    job.currentStep = step;
    if (completedSteps !== undefined) job.completedSteps = completedSteps;
  }
  const emitter = activeContentStreams.get(jobId);
  if (!emitter) return;
  emitter.emit("event", {
    type: "progress",
    data: {
      step,
      completedSteps: job?.completedSteps ?? 0,
      totalSteps: job?.totalSteps ?? 5,
      percent: job ? Math.round((job.completedSteps / job.totalSteps) * 100) : 0,
      timestamp: Date.now(),
    },
  });
}

/**
 * Emit a text chunk (streaming token) for a content generation job.
 */
export function emitContentChunk(jobId: string, chunk: string): void {
  const emitter = activeContentStreams.get(jobId);
  if (!emitter) return;
  emitter.emit("event", {
    type: "text_chunk",
    data: { chunk, timestamp: Date.now() },
  });
}

/**
 * Mark a content generation job as complete.
 */
export function completeContentJob(jobId: string, result: string): void {
  const job = activeContentJobs.get(jobId);
  if (job) {
    job.status = "completed";
    job.completedAt = Date.now();
    job.result = result;
    job.completedSteps = job.totalSteps;
    job.currentStep = "Complete";
  }
  const emitter = activeContentStreams.get(jobId);
  if (!emitter) return;
  emitter.emit("event", {
    type: "done",
    data: {
      result,
      durationMs: job ? Date.now() - job.startedAt : 0,
      timestamp: Date.now(),
    },
  });
  emitter.emit("close", {});
  // Clean up after 60 seconds
  setTimeout(() => {
    activeContentStreams.delete(jobId);
    activeContentJobs.delete(jobId);
  }, 60_000);
}

/**
 * Mark a content generation job as failed.
 */
export function failContentJob(jobId: string, error: string): void {
  const job = activeContentJobs.get(jobId);
  if (job) {
    job.status = "failed";
    job.completedAt = Date.now();
    job.error = error;
    job.currentStep = "Failed";
  }
  const emitter = activeContentStreams.get(jobId);
  if (!emitter) return;
  emitter.emit("event", {
    type: "error",
    data: { error, timestamp: Date.now() },
  });
  emitter.emit("close", {});
  setTimeout(() => {
    activeContentStreams.delete(jobId);
    activeContentJobs.delete(jobId);
  }, 30_000);
}

/**
 * Get the current status of a content job (for reconnection).
 */
export function getContentJobStatus(jobId: string): ContentJobStatus | undefined {
  return activeContentJobs.get(jobId);
}

// ── Express SSE Routes ────────────────────────────────────────────

export function registerContentStreamRoutes(app: Express): void {
  /**
   * GET /api/content/stream/:jobId
   * SSE endpoint — client connects here to receive real-time progress events.
   */
  app.get("/api/content/stream/:jobId", (req: Request, res: Response) => {
    const { jobId } = req.params;
    if (!jobId || typeof jobId !== "string") {
      res.status(400).json({ error: "Invalid job ID" });
      return;
    }

    // Set SSE headers
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });

    // Get or create emitter for this job
    let emitter = activeContentStreams.get(jobId);
    if (!emitter) {
      emitter = new EventEmitter();
      emitter.setMaxListeners(20);
      activeContentStreams.set(jobId, emitter);
    }

    // Send events to client
    const onEvent = (event: { type: string; data: Record<string, unknown> }) => {
      try {
        res.write(`event: ${event.type}\n`);
        res.write(`data: ${JSON.stringify(event.data)}\n\n`);
        if (typeof (res as any).flush === "function") (res as any).flush();
      } catch {
        // Client disconnected — ignore
      }
    };

    const onClose = () => {
      try { res.end(); } catch { /* ignore */ }
    };

    emitter.on("event", onEvent);
    emitter.on("close", onClose);

    // Send initial status for reconnection support
    const jobStatus = activeContentJobs.get(jobId);
    res.write(`event: connected\ndata: ${JSON.stringify({
      jobId,
      active: !!jobStatus && jobStatus.status === "running",
      currentStep: jobStatus?.currentStep || "Waiting...",
      completedSteps: jobStatus?.completedSteps ?? 0,
      totalSteps: jobStatus?.totalSteps ?? 5,
      percent: jobStatus
        ? Math.round((jobStatus.completedSteps / jobStatus.totalSteps) * 100)
        : 0,
    })}\n\n`);

    // If job already completed, send done immediately
    if (jobStatus?.status === "completed" && jobStatus.result) {
      res.write(`event: done\ndata: ${JSON.stringify({
        result: jobStatus.result,
        durationMs: (jobStatus.completedAt ?? Date.now()) - jobStatus.startedAt,
        timestamp: Date.now(),
      })}\n\n`);
      res.end();
      return;
    }

    // Heartbeat every 15 seconds
    const heartbeat = setInterval(() => {
      try {
        res.write(`event: heartbeat\ndata: ${JSON.stringify({ ts: Date.now() })}\n\n`);
        if (typeof (res as any).flush === "function") (res as any).flush();
      } catch {
        clearInterval(heartbeat);
      }
    }, 15_000);

    // Clean up on client disconnect
    req.on("close", () => {
      clearInterval(heartbeat);
      emitter!.removeListener("event", onEvent);
      emitter!.removeListener("close", onClose);
      if (emitter!.listenerCount("event") === 0) {
        activeContentStreams.delete(jobId);
      }
    });
  });

  /**
   * GET /api/content/stream/status/:jobId
   * Polling fallback — returns current job status as JSON.
   */
  app.get("/api/content/stream/status/:jobId", (req: Request, res: Response) => {
    const { jobId } = req.params;
    const status = activeContentJobs.get(jobId);
    if (!status) {
      res.status(404).json({ error: "Job not found or expired" });
      return;
    }
    res.json(status);
  });
}
