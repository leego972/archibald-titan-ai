/**
 * Chat Streaming — SSE endpoint for real-time Titan activity events.
 *
 * This module provides:
 * 1. An Express SSE endpoint that streams events during chat processing
 * 2. An abort mechanism to cancel in-progress requests
 * 3. An event emitter system that the chat-router hooks into
 *
 * Events emitted:
 * - thinking: Titan is processing/reasoning
 * - tool_start: A tool call is beginning
 * - tool_result: A tool call completed
 * - text_chunk: Streaming text from the final response
 * - done: Processing complete
 * - error: An error occurred
 */
import type { Express, Request, Response } from "express";
import { EventEmitter } from "events";

// ── Active Request Tracking ──────────────────────────────────────
// Maps conversationId → AbortController for cancellation
const activeRequests = new Map<number, AbortController>();

// Maps conversationId → EventEmitter for streaming events
const activeStreams = new Map<number, EventEmitter>();

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
    return true;
  }
  return false;
}

/**
 * Clean up tracking for a conversation.
 */
export function cleanupRequest(conversationId: number): void {
  activeRequests.delete(conversationId);
  activeStreams.delete(conversationId);
}

/**
 * Emit a streaming event for a conversation.
 * Called by the chat-router during processing.
 */
export function emitChatEvent(
  conversationId: number,
  event: {
    type: "thinking" | "tool_start" | "tool_result" | "text_chunk" | "done" | "error";
    data: Record<string, unknown>;
  }
): void {
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
 * Register the SSE streaming and abort endpoints on the Express app.
 */
export function registerChatStreamRoutes(app: Express): void {
  // ── SSE Stream Endpoint ──────────────────────────────────────
  // Clients connect to this to receive real-time events during chat processing
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

    // Create event emitter for this conversation
    const emitter = new EventEmitter();
    activeStreams.set(conversationId, emitter);

    // Send events to client
    const onEvent = (event: { type: string; data: Record<string, unknown> }) => {
      res.write(`event: ${event.type}\n`);
      res.write(`data: ${JSON.stringify(event.data)}\n\n`);
    };

    const onClose = () => {
      res.end();
    };

    emitter.on("event", onEvent);
    emitter.on("close", onClose);

    // Send initial heartbeat
    res.write(`event: connected\ndata: {"conversationId": ${conversationId}}\n\n`);

    // Heartbeat every 30 seconds to keep connection alive
    const heartbeat = setInterval(() => {
      res.write(`event: heartbeat\ndata: {}\n\n`);
    }, 30000);

    // Clean up on client disconnect
    req.on("close", () => {
      clearInterval(heartbeat);
      emitter.removeListener("event", onEvent);
      emitter.removeListener("close", onClose);
      activeStreams.delete(conversationId);
    });
  });

  // ── Abort Endpoint ──────────────────────────────────────────
  // POST /api/chat/abort/:conversationId — cancel an active request
  app.post("/api/chat/abort/:conversationId", (req: Request, res: Response) => {
    const conversationId = parseInt(req.params.conversationId, 10);
    if (isNaN(conversationId)) {
      res.status(400).json({ error: "Invalid conversation ID" });
      return;
    }

    const aborted = abortRequest(conversationId);
    res.json({ success: aborted, message: aborted ? "Request cancelled" : "No active request found" });
  });
}
