/**
 * Chat Streaming — SSE endpoint for real-time Titan activity events.
 *
 * This module provides:
 * 1. An Express SSE endpoint that streams events during chat processing
 * 2. An abort mechanism to cancel in-progress requests
 * 3. An event emitter system that the chat-router hooks into
 * 4. Background build tracking — builds continue even if user disconnects/logs out
 * 5. A build status endpoint so the client can reconnect and see progress
 *
 * Events emitted:
 * - thinking: Titan is processing/reasoning
 * - tool_start: A tool call is beginning
 * - tool_result: A tool call completed
 * - text_chunk: Streaming text from the final response
 * - done: Processing complete
 * - error: An error occurred
 * - aborted: Request was cancelled by user
 */
import type { Express, Request, Response } from "express";
import { EventEmitter } from "events";

// ── Active Request Tracking ──────────────────────────────────────
// Maps conversationId → AbortController for cancellation
const activeRequests = new Map<number, AbortController>();

// Maps conversationId → EventEmitter for streaming events
const activeStreams = new Map<number, EventEmitter>();

// ── Background Build Tracking ────────────────────────────────────
// Tracks active builds so they persist through disconnects.
// The build runs server-side regardless of client connection state.
export interface BuildStatus {
  conversationId: number;
  userId: number;
  status: "running" | "completed" | "failed" | "aborted";
  startedAt: number;
  completedAt?: number;
  currentPhase: string;
  rounds: number;
  actionsCompleted: number;
  lastEvent?: { type: string; message: string; timestamp: number };
  response?: string;
  actions?: Array<{ tool: string; success: boolean; summary: string }>;
}

const activeBuilds = new Map<number, BuildStatus>();

/**
 * Register a new background build for a conversation.
 */
export function registerBuild(conversationId: number, userId: number): void {
  activeBuilds.set(conversationId, {
    conversationId,
    userId,
    status: "running",
    startedAt: Date.now(),
    currentPhase: "Starting...",
    rounds: 0,
    actionsCompleted: 0,
  });
}

/**
 * Update the status of an active build.
 */
export function updateBuildStatus(
  conversationId: number,
  update: Partial<BuildStatus>
): void {
  const build = activeBuilds.get(conversationId);
  if (build) {
    Object.assign(build, update);
  }
}

/**
 * Mark a build as completed and keep it for 5 minutes so the client can retrieve the result.
 */
export function completeBuild(
  conversationId: number,
  result: { response?: string; actions?: BuildStatus["actions"]; status?: "completed" | "failed" | "aborted" }
): void {
  const build = activeBuilds.get(conversationId);
  if (build) {
    build.status = result.status || "completed";
    build.completedAt = Date.now();
    build.response = result.response;
    build.actions = result.actions;
    // Keep completed builds for 5 minutes so client can retrieve results after reconnect
    setTimeout(() => {
      activeBuilds.delete(conversationId);
    }, 5 * 60 * 1000);
  }
}

/**
 * Get the status of a build (for client reconnection).
 */
export function getBuildStatus(conversationId: number): BuildStatus | undefined {
  return activeBuilds.get(conversationId);
}

/**
 * Get all active/recent builds for a user.
 */
export function getUserBuilds(userId: number): BuildStatus[] {
  return Array.from(activeBuilds.values()).filter(b => b.userId === userId);
}

/**
 * Get or create an AbortController for a conversation.
 * Used by the chat-router to check if a request should be cancelled.
 */
export function getAbortSignal(conversationId: number): AbortSignal {
  let controller = activeRequests.get(conversationId);
  if (!controller) {
    controller = new AbortController();
    activeRequests.set(conversationId, controller);
  }
  return controller.signal;
}

/**
 * Cancel an active request for a conversation.
 * This is the ONLY way to stop a build — it requires explicit user action.
 */
export function abortRequest(conversationId: number): boolean {
  const controller = activeRequests.get(conversationId);
  if (controller) {
    controller.abort();
    activeRequests.delete(conversationId);
    // Also emit abort event to any connected SSE clients
    const emitter = activeStreams.get(conversationId);
    if (emitter) {
      emitter.emit("event", {
        type: "aborted",
        data: { message: "Request cancelled by user" },
      });
      emitter.emit("close");
    }
    // Mark build as aborted
    completeBuild(conversationId, { status: "aborted" });
    return true;
  }
  return false;
}

/**
 * Clean up tracking for a conversation.
 * NOTE: Does NOT abort the build — only cleans up stream/request tracking.
 */
export function cleanupRequest(conversationId: number): void {
  activeRequests.delete(conversationId);
  // Don't delete activeStreams here — the SSE connection cleanup handles that.
  // Don't delete activeBuilds — builds persist for reconnection.
}

/**
 * Emit a streaming event for a conversation.
 * Called by the chat-router during processing.
 * Events are emitted to connected SSE clients AND stored in build status.
 */
export function emitChatEvent(
  conversationId: number,
  event: {
    type: "thinking" | "tool_start" | "tool_result" | "text_chunk" | "done" | "error";
    data: Record<string, unknown>;
  }
): void {
  // Update build status with latest event
  const build = activeBuilds.get(conversationId);
  if (build) {
    build.lastEvent = {
      type: event.type,
      message: (event.data.message as string) || (event.data.tool as string) || event.type,
      timestamp: Date.now(),
    };
    if (event.type === "thinking") {
      build.currentPhase = (event.data.message as string) || "Processing...";
    }
    if (event.type === "tool_start") {
      build.currentPhase = `Using ${((event.data.tool as string) || "").replace(/_/g, " ")}...`;
    }
    if (event.type === "tool_result") {
      build.actionsCompleted++;
    }
    if (event.data.round) {
      build.rounds = event.data.round as number;
    }
  }

  // Emit to connected SSE clients (if any — build continues regardless)
  const emitter = activeStreams.get(conversationId);
  if (emitter) {
    emitter.emit("event", event);
  }
}

/**
 * Check if a request has been aborted.
 */
export function isAborted(conversationId: number): boolean {
  const controller = activeRequests.get(conversationId);
  return controller?.signal.aborted ?? false;
}

/**
 * Register the SSE streaming, abort, and build status endpoints on the Express app.
 */
export function registerChatStreamRoutes(app: Express): void {
  // ── SSE Stream Endpoint ──────────────────────────────────────
  // Clients connect to this to receive real-time events during chat processing.
  // IMPORTANT: Client disconnection does NOT stop the build — only the abort
  // endpoint can stop a build. This allows builds to continue in the background.
  app.get("/api/chat/stream/:conversationId", (req: Request, res: Response) => {
    const conversationId = parseInt(req.params.conversationId, 10);
    if (isNaN(conversationId)) {
      res.status(400).json({ error: "Invalid conversation ID" });
      return;
    }

    // Set SSE headers
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // Disable nginx buffering
    });

    // Create or get event emitter for this conversation
    let emitter = activeStreams.get(conversationId);
    if (!emitter) {
      emitter = new EventEmitter();
      activeStreams.set(conversationId, emitter);
    }

    // Send events to client
    const onEvent = (event: { type: string; data: Record<string, unknown> }) => {
      try {
        res.write(`event: ${event.type}\n`);
        res.write(`data: ${JSON.stringify(event.data)}\n\n`);
      } catch {
        // Client disconnected — ignore write errors, build continues
      }
    };

    const onClose = () => {
      try { res.end(); } catch { /* ignore */ }
    };

    emitter.on("event", onEvent);
    emitter.on("close", onClose);

    // Send initial heartbeat with current build status (for reconnection)
    const buildStatus = activeBuilds.get(conversationId);
    res.write(`event: connected\ndata: ${JSON.stringify({
      conversationId,
      buildActive: !!buildStatus && buildStatus.status === "running",
      currentPhase: buildStatus?.currentPhase || null,
      rounds: buildStatus?.rounds || 0,
      actionsCompleted: buildStatus?.actionsCompleted || 0,
    })}\n\n`);

    // Heartbeat every 30 seconds to keep connection alive
    const heartbeat = setInterval(() => {
      try {
        res.write(`event: heartbeat\ndata: {}\n\n`);
      } catch {
        clearInterval(heartbeat);
      }
    }, 30000);

    // Clean up on client disconnect — but DO NOT abort the build
    req.on("close", () => {
      clearInterval(heartbeat);
      emitter!.removeListener("event", onEvent);
      emitter!.removeListener("close", onClose);
      // Only remove the stream if no other listeners are connected
      if (emitter!.listenerCount("event") === 0) {
        activeStreams.delete(conversationId);
      }
    });
  });

  // ── Abort Endpoint ──────────────────────────────────────────
  // POST /api/chat/abort/:conversationId — cancel an active request
  // This is the ONLY way to stop a build. Disconnecting/logging out does NOT stop it.
  app.post("/api/chat/abort/:conversationId", (req: Request, res: Response) => {
    const conversationId = parseInt(req.params.conversationId, 10);
    if (isNaN(conversationId)) {
      res.status(400).json({ error: "Invalid conversation ID" });
      return;
    }

    const aborted = abortRequest(conversationId);
    res.json({ success: aborted, message: aborted ? "Request cancelled" : "No active request found" });
  });

  // ── Build Status Endpoint ──────────────────────────────────
  // GET /api/chat/build-status/:conversationId — check if a build is running
  // Used by the client to reconnect and see progress after page reload/navigation
  app.get("/api/chat/build-status/:conversationId", (req: Request, res: Response) => {
    const conversationId = parseInt(req.params.conversationId, 10);
    if (isNaN(conversationId)) {
      res.status(400).json({ error: "Invalid conversation ID" });
      return;
    }

    const status = activeBuilds.get(conversationId);
    if (!status) {
      res.json({ active: false });
      return;
    }

    res.json({
      active: status.status === "running",
      status: status.status,
      currentPhase: status.currentPhase,
      rounds: status.rounds,
      actionsCompleted: status.actionsCompleted,
      startedAt: status.startedAt,
      completedAt: status.completedAt,
      response: status.response,
      actions: status.actions,
    });
  });

  // ── User Builds Endpoint ──────────────────────────────────
  // GET /api/chat/active-builds — get all active builds for the current user
  app.get("/api/chat/active-builds", (req: Request, res: Response) => {
    // Note: In production, extract userId from session/auth middleware
    // For now, return all active builds (the client filters by conversationId)
    const builds = Array.from(activeBuilds.values())
      .filter(b => b.status === "running")
      .map(b => ({
        conversationId: b.conversationId,
        currentPhase: b.currentPhase,
        rounds: b.rounds,
        actionsCompleted: b.actionsCompleted,
        startedAt: b.startedAt,
      }));
    res.json({ builds });
  });
}
