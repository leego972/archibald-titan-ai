/**
 * useSecurityStream
 * ─────────────────────────────────────────────────────────────────────────────
 * React hook for real-time SSH command streaming via Server-Sent Events.
 * Used by Evilginx, BlackEye, Metasploit, and ExploitPack pages.
 *
 * Usage:
 *   const { lines, isStreaming, exitCode, error, run, clear } = useSecurityStream("evilginx");
 *   run("evilginx -version");
 */
import { useState, useRef, useCallback } from "react";

export interface StreamLine {
  text: string;
  isStderr: boolean;
  ts: number;
}

export interface UseSecurityStreamReturn {
  lines: StreamLine[];
  isStreaming: boolean;
  exitCode: number | null;
  error: string | null;
  run: (cmd: string) => void;
  cancel: () => void;
  clear: () => void;
}

export function useSecurityStream(tool: string): UseSecurityStreamReturn {
  const [lines, setLines] = useState<StreamLine[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [exitCode, setExitCode] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const esRef = useRef<EventSource | null>(null);

  const cancel = useCallback(() => {
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }
    setIsStreaming(false);
  }, []);

  const clear = useCallback(() => {
    setLines([]);
    setExitCode(null);
    setError(null);
  }, []);

  const run = useCallback((cmd: string) => {
    // Cancel any existing stream
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }
    setLines([]);
    setExitCode(null);
    setError(null);
    setIsStreaming(true);

    const url = `/api/security-stream/${encodeURIComponent(tool)}?cmd=${encodeURIComponent(cmd)}`;
    const es = new EventSource(url);
    esRef.current = es;

    es.addEventListener("connected", () => {
      // Connection confirmed — streaming started
    });

    es.addEventListener("line", (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data) as { text: string; isStderr: boolean };
        setLines(prev => [...prev, { text: data.text, isStderr: data.isStderr, ts: Date.now() }]);
      } catch {
        // Ignore parse errors
      }
    });

    es.addEventListener("done", (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data) as { exitCode: number };
        setExitCode(data.exitCode);
      } catch {
        setExitCode(0);
      }
      setIsStreaming(false);
      es.close();
      esRef.current = null;
    });

    es.addEventListener("error", (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data) as { message: string };
        setError(data.message);
      } catch {
        setError("Connection error");
      }
      setIsStreaming(false);
      es.close();
      esRef.current = null;
    });

    // Handle network-level EventSource errors
    es.onerror = () => {
      if (es.readyState === EventSource.CLOSED) {
        setIsStreaming(false);
        esRef.current = null;
      }
    };
  }, [tool]);

  return { lines, isStreaming, exitCode, error, run, cancel, clear };
}
