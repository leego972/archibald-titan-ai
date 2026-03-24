/**
 * StreamingTerminal
 * ─────────────────────────────────────────────────────────────────────────────
 * A professional terminal-style component for displaying real-time SSH output.
 * Used by Evilginx, BlackEye, Metasploit, and ExploitPack pages.
 *
 * Features:
 * - ANSI colour stripping (clean output)
 * - Auto-scroll to bottom
 * - Stderr lines highlighted in amber
 * - Exit code badge (green/red)
 * - Copy all output button
 * - Clear button
 */
import React, { useEffect, useRef } from "react";
import { Copy, Trash2, Square, Loader2, CheckCircle2, XCircle } from "lucide-react";
import type { StreamLine } from "../hooks/useSecurityStream";

interface StreamingTerminalProps {
  lines: StreamLine[];
  isStreaming: boolean;
  exitCode: number | null;
  error: string | null;
  onClear: () => void;
  onCancel: () => void;
  maxLines?: number;
  className?: string;
}

// Strip ANSI escape codes for clean terminal display
function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1b\[[0-9;]*[mGKHF]/g, "").replace(/\x1b\[[0-9;]*[A-Za-z]/g, "");
}

export function StreamingTerminal({
  lines,
  isStreaming,
  exitCode,
  error,
  onClear,
  onCancel,
  maxLines = 2000,
  className = "",
}: StreamingTerminalProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const userScrolledRef = useRef(false);

  // Auto-scroll to bottom unless user has scrolled up
  useEffect(() => {
    if (!userScrolledRef.current && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [lines]);

  const handleScroll = () => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    userScrolledRef.current = scrollHeight - scrollTop - clientHeight > 40;
  };

  const handleCopyAll = () => {
    const text = lines.map(l => stripAnsi(l.text)).join("\n");
    navigator.clipboard.writeText(text).catch(() => {});
  };

  const displayLines = lines.slice(-maxLines);

  return (
    <div className={`flex flex-col rounded-lg border border-gray-700 bg-gray-950 overflow-hidden ${className}`}>
      {/* Terminal header */}
      <div className="flex items-center justify-between px-3 py-2 bg-gray-900 border-b border-gray-700">
        <div className="flex items-center gap-2">
          {/* Traffic light dots */}
          <div className="w-3 h-3 rounded-full bg-red-500 opacity-80" />
          <div className="w-3 h-3 rounded-full bg-yellow-500 opacity-80" />
          <div className="w-3 h-3 rounded-full bg-green-500 opacity-80" />
          <span className="ml-2 text-xs text-gray-400 font-mono">
            {isStreaming ? (
              <span className="flex items-center gap-1 text-emerald-400">
                <Loader2 className="w-3 h-3 animate-spin" />
                streaming…
              </span>
            ) : exitCode !== null ? (
              <span className={`flex items-center gap-1 ${exitCode === 0 ? "text-emerald-400" : "text-red-400"}`}>
                {exitCode === 0 ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                exit {exitCode}
              </span>
            ) : error ? (
              <span className="flex items-center gap-1 text-red-400">
                <XCircle className="w-3 h-3" />
                {error}
              </span>
            ) : (
              <span className="text-gray-500">idle</span>
            )}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {isStreaming && (
            <button
              onClick={onCancel}
              className="p-1 rounded hover:bg-gray-700 text-gray-400 hover:text-red-400 transition-colors"
              title="Cancel"
            >
              <Square className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={handleCopyAll}
            disabled={lines.length === 0}
            className="p-1 rounded hover:bg-gray-700 text-gray-400 hover:text-gray-200 transition-colors disabled:opacity-30"
            title="Copy all output"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onClear}
            disabled={lines.length === 0}
            className="p-1 rounded hover:bg-gray-700 text-gray-400 hover:text-gray-200 transition-colors disabled:opacity-30"
            title="Clear"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Terminal body */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-3 font-mono text-xs leading-5 min-h-[200px] max-h-[480px]"
        style={{ scrollbarWidth: "thin", scrollbarColor: "#374151 transparent" }}
      >
        {displayLines.length === 0 && !isStreaming && !error && (
          <span className="text-gray-600">No output yet. Run a command above.</span>
        )}
        {displayLines.map((line, i) => (
          <div
            key={i}
            className={`whitespace-pre-wrap break-all ${
              line.isStderr ? "text-amber-400" : "text-gray-200"
            }`}
          >
            {stripAnsi(line.text)}
          </div>
        ))}
        {isStreaming && (
          <div className="flex items-center gap-1 text-emerald-400 mt-1">
            <span className="animate-pulse">▋</span>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
