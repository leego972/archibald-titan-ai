/**
 * Security Tool SSE Streaming
 * ─────────────────────────────────────────────────────────────────────────────
 * Provides real-time SSH command output streaming for Evilginx, BlackEye,
 * and Metasploit via Server-Sent Events (SSE).
 *
 * Endpoint: GET /api/security-stream/:tool?cmd=<command>
 *
 * The client connects with EventSource, receives output lines as they arrive,
 * and gets a "done" event when the command completes.
 *
 * Auth: Uses the same createContext pattern as other SSE endpoints.
 */
import type { Express, Request, Response } from "express";
import { createContext } from "./_core/context";
import { execSSHStream, type SSHConfig } from "./titan-server";
import { getDb } from "./db";
import { userSecrets } from "../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { decrypt } from "./fetcher-db";
import { createLogger } from "./_core/logger.js";
import { isAdminRole } from '@shared/const';

const log = createLogger("security-stream");

// ─── Node lookup helpers (mirrors the pattern in each tool's router) ──────────

interface ToolNode {
  sshHost: string;
  sshPort: number;
  sshUser: string;
  sshPassword?: string;
  sshKey?: string;
}

const SECRET_PREFIXES: Record<string, { nodes: string; active: string }> = {
  evilginx:   { nodes: "__evilginx_nodes",   active: "__evilginx_active"   },
  blackeye:   { nodes: "__blackeye_nodes",    active: "__blackeye_active"   },
  metasploit: { nodes: "__msf_nodes",         active: "__msf_active"        },
  exploitpack:{ nodes: "__exploitpack_nodes", active: "__exploitpack_active"},
};

async function getActiveNodeForTool(userId: number, tool: string): Promise<ToolNode | null> {
  const db = await getDb();
  if (!db) return null;
  const prefixes = SECRET_PREFIXES[tool];
  if (!prefixes) return null;

  // Get active node ID
  const activeRows = await db.select().from(userSecrets)
    .where(and(eq(userSecrets.userId, userId), eq(userSecrets.secretType, prefixes.active)))
    .limit(1);
  if (!activeRows.length) return null;
  let activeId: string;
  try { activeId = decrypt(activeRows[0].encryptedValue); } catch { return null; }
  if (!activeId) return null;

  // Get nodes list
  const nodeRows = await db.select().from(userSecrets)
    .where(and(eq(userSecrets.userId, userId), eq(userSecrets.secretType, prefixes.nodes)))
    .limit(1);
  if (!nodeRows.length) return null;
  let nodes: ToolNode[];
  try {
    const raw = decrypt(nodeRows[0].encryptedValue);
    nodes = JSON.parse(raw) as ToolNode[];
  } catch { return null; }

  return nodes.find((n: any) => n.id === activeId) ?? null;
}

// ─── SSE helper ───────────────────────────────────────────────────────────────

function sseWrite(res: Response, event: string, data: unknown) {
  try {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    // Flush for nginx/Railway proxy buffering
    if (typeof (res as any).flush === "function") (res as any).flush();
  } catch {
    // Client disconnected
  }
}

// ─── Register SSE routes ──────────────────────────────────────────────────────

export function registerSecurityStreamRoutes(app: Express): void {
  /**
   * GET /api/security-stream/:tool
   * Query params:
   *   cmd  — the command to execute on the VPS node
   *
   * Events emitted:
   *   connected  — initial connection confirmation
   *   line       — { text: string, isStderr: boolean }
   *   done       — { exitCode: number }
   *   error      — { message: string }
   */
  app.get("/api/security-stream/:tool", async (req: Request, res: Response) => {
    const { tool } = req.params as { tool: string };
    const cmd = (req.query.cmd as string | undefined) ?? "";

    // ── Auth ──
    let userId: number;
    try {
      const ctx = await createContext({ req, res, info: {} as any });
      if (!ctx.user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      if (!isAdminRole(ctx.user.role)) {
        res.status(403).json({ error: "Forbidden" });
        return;
      }
      userId = ctx.user.id;
    } catch {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    // ── Validate tool ──
    if (!SECRET_PREFIXES[tool]) {
      res.status(400).json({ error: `Unknown tool: ${tool}` });
      return;
    }

    // ── Validate command ──
    if (!cmd.trim()) {
      res.status(400).json({ error: "cmd query parameter is required" });
      return;
    }

    // ── Get active node ──
    const node = await getActiveNodeForTool(userId, tool);
    if (!node) {
      res.status(404).json({ error: `No active ${tool} node configured` });
      return;
    }

    const ssh: SSHConfig = {
      host: node.sshHost,
      port: node.sshPort,
      username: node.sshUser,
      password: node.sshPassword,
      privateKey: node.sshKey,
    };

    // ── Set up SSE ──
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    sseWrite(res, "connected", { tool, userId, cmd: cmd.substring(0, 100) });

    // Keep-alive ping every 20s
    const keepAlive = setInterval(() => {
      try { res.write(": ping\n\n"); } catch { clearInterval(keepAlive); }
    }, 20_000);

    // ── Stream SSH command ──
    const cancel = execSSHStream(
      ssh,
      cmd,
      (line, isStderr) => {
        sseWrite(res, "line", { text: line, isStderr });
      },
      (exitCode) => {
        clearInterval(keepAlive);
        sseWrite(res, "done", { exitCode });
        res.end();
        log.info(`[SecurityStream] ${tool} command done`, { userId, exitCode });
      },
      (err) => {
        clearInterval(keepAlive);
        sseWrite(res, "error", { message: err.message });
        res.end();
        log.error(`[SecurityStream] ${tool} command error`, { userId, error: err.message });
      },
      120_000,
      userId
    );

    // ── Cleanup on client disconnect ──
    req.on("close", () => {
      clearInterval(keepAlive);
      cancel();
      log.info(`[SecurityStream] Client disconnected from ${tool} stream`, { userId });
    });
  });
}
