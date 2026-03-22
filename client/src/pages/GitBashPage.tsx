import { useState, useRef, useEffect, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Terminal,
  GitBranch,
  GitCommit,
  GitMerge,
  GitPullRequest,
  Trash2,
  Copy,
  Plus,
  FolderOpen,
  RefreshCw,
  ChevronRight,
  Loader2,
  Code2,
  Download,
  Upload,
  History,
} from "lucide-react";
import AffiliateRecommendations from "@/components/AffiliateRecommendations";

// ─── Types ─────────────────────────────────────────────────────────
interface TerminalLine {
  type: "input" | "output" | "error" | "info";
  content: string;
  timestamp: number;
}

// ─── Quick Git Commands ─────────────────────────────────────────────
const GIT_QUICK_COMMANDS = [
  { label: "Status", cmd: "git status", icon: <GitBranch className="h-3 w-3" /> },
  { label: "Log", cmd: "git log --oneline -10", icon: <History className="h-3 w-3" /> },
  { label: "Branches", cmd: "git branch -a", icon: <GitMerge className="h-3 w-3" /> },
  { label: "Diff", cmd: "git diff", icon: <Code2 className="h-3 w-3" /> },
  { label: "Pull", cmd: "git pull", icon: <Download className="h-3 w-3" /> },
  { label: "Push", cmd: "git push", icon: <Upload className="h-3 w-3" /> },
  { label: "Stash", cmd: "git stash", icon: <GitCommit className="h-3 w-3" /> },
  { label: "Fetch", cmd: "git fetch --all", icon: <RefreshCw className="h-3 w-3" /> },
];

const BASH_QUICK_COMMANDS = [
  { label: "List Files", cmd: "ls -la", icon: <FolderOpen className="h-3 w-3" /> },
  { label: "Current Dir", cmd: "pwd", icon: <FolderOpen className="h-3 w-3" /> },
  { label: "Disk Usage", cmd: "df -h", icon: <Code2 className="h-3 w-3" /> },
  { label: "Processes", cmd: "ps aux | head -20", icon: <RefreshCw className="h-3 w-3" /> },
  { label: "Node Version", cmd: "node --version && npm --version", icon: <Code2 className="h-3 w-3" /> },
  { label: "Git Version", cmd: "git --version", icon: <GitBranch className="h-3 w-3" /> },
  { label: "Env Vars", cmd: "env | sort | head -30", icon: <Code2 className="h-3 w-3" /> },
  { label: "Network", cmd: "curl -s ifconfig.me", icon: <GitPullRequest className="h-3 w-3" /> },
];

// ─── Main Component ─────────────────────────────────────────────────
export default function GitBashPage() {
  const [sandboxId, setSandboxId] = useState<number | null>(null);
  const [lines, setLines] = useState<TerminalLine[]>([
    {
      type: "info",
      content: "╔══════════════════════════════════════════════════════════╗",
      timestamp: Date.now(),
    },
    {
      type: "info",
      content: "║         Archibald Titan — Git Bash Terminal              ║",
      timestamp: Date.now(),
    },
    {
      type: "info",
      content: "║  Full bash + git environment. Type commands below.       ║",
      timestamp: Date.now(),
    },
    {
      type: "info",
      content: "╚══════════════════════════════════════════════════════════╝",
      timestamp: Date.now(),
    },
    {
      type: "info",
      content: "Initializing sandbox environment...",
      timestamp: Date.now(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [workingDir, setWorkingDir] = useState("/workspace");
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const terminalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // ─── tRPC ─────────────────────────────────────────────────────────
  const createSandbox = trpc.sandbox.create.useMutation();
  const execCommand = trpc.sandbox.exec.useMutation();

  // ─── Init Sandbox ─────────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      try {
        const sandbox = await createSandbox.mutateAsync({
          name: "Git Bash Terminal",
        });
        setSandboxId(sandbox.id);
        addLine("info", `✓ Sandbox ready (ID: ${sandbox.id})`);
        addLine("info", `Working directory: ${workingDir}`);
        addLine("info", "Type any bash or git command to get started.");
        addLine("info", "");
      } catch (err: any) {
        addLine("error", `Failed to initialize sandbox: ${err?.message ?? "Unknown error"}`);
      }
    };
    init();
  }, []);

  // ─── Auto-scroll ──────────────────────────────────────────────────
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [lines]);

  // ─── Helpers ──────────────────────────────────────────────────────
  const addLine = useCallback((type: TerminalLine["type"], content: string) => {
    setLines(prev => [...prev, { type, content, timestamp: Date.now() }]);
  }, []);

  const runCommand = useCallback(async (cmd: string) => {
    if (!cmd.trim() || isRunning || !sandboxId) return;

    const trimmed = cmd.trim();
    addLine("input", `$ ${trimmed}`);
    setHistory(prev => [trimmed, ...prev.slice(0, 99)]);
    setHistoryIndex(-1);
    setInput("");
    setIsRunning(true);

    // Handle cd locally
    if (trimmed.startsWith("cd ")) {
      const newDir = trimmed.slice(3).trim();
      const resolved = newDir.startsWith("/") ? newDir : `${workingDir}/${newDir}`;
      setWorkingDir(resolved);
      addLine("output", "");
      setIsRunning(false);
      return;
    }

    if (trimmed === "clear" || trimmed === "cls") {
      setLines([]);
      setIsRunning(false);
      return;
    }

    try {
      const result = await execCommand.mutateAsync({
        sandboxId,
        command: trimmed,
        workingDirectory: workingDir,
        timeoutMs: 30000,
      });

      if (result.output) {
        result.output.split("\n").forEach((line: string) => {
          if (line.startsWith("Error:") || line.startsWith("error:") || result.exitCode !== 0) {
            addLine("error", line);
          } else {
            addLine("output", line);
          }
        });
      } else {
        addLine("output", "");
      }
    } catch (err: any) {
      addLine("error", err?.message ?? "Command failed");
    } finally {
      setIsRunning(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [sandboxId, isRunning, workingDir, addLine, execCommand]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      runCommand(input);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const newIndex = Math.min(historyIndex + 1, history.length - 1);
      setHistoryIndex(newIndex);
      setInput(history[newIndex] ?? "");
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      const newIndex = Math.max(historyIndex - 1, -1);
      setHistoryIndex(newIndex);
      setInput(newIndex === -1 ? "" : history[newIndex] ?? "");
    } else if (e.key === "c" && e.ctrlKey) {
      addLine("info", "^C");
      setInput("");
      setIsRunning(false);
    }
  };

  const copyTerminal = () => {
    const text = lines.map(l => l.content).join("\n");
    navigator.clipboard.writeText(text);
    toast.success("Terminal output copied");
  };

  const clearTerminal = () => {
    setLines([]);
  };

  // ─── Render ───────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full min-h-screen bg-background p-4 gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-emerald-500/15 flex items-center justify-center">
            <Terminal className="h-5 w-5 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              Git Bash Terminal
              <Badge variant="outline" className="text-xs text-emerald-400 border-emerald-500/30">
                LIVE
              </Badge>
            </h1>
            <p className="text-xs text-muted-foreground">Full bash + git environment in your browser</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={copyTerminal} className="gap-1.5">
            <Copy className="h-3.5 w-3.5" />
            Copy
          </Button>
          <Button variant="outline" size="sm" onClick={clearTerminal} className="gap-1.5">
            <Trash2 className="h-3.5 w-3.5" />
            Clear
          </Button>
        </div>
      </div>

      {/* Quick Commands */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Git Commands</p>
        <div className="flex flex-wrap gap-1.5">
          {GIT_QUICK_COMMANDS.map(qc => (
            <button
              key={qc.cmd}
              onClick={() => runCommand(qc.cmd)}
              disabled={isRunning || !sandboxId}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 transition-colors border border-zinc-700 text-zinc-300"
            >
              {qc.icon}
              {qc.label}
            </button>
          ))}
        </div>
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mt-2">Bash Commands</p>
        <div className="flex flex-wrap gap-1.5">
          {BASH_QUICK_COMMANDS.map(qc => (
            <button
              key={qc.cmd}
              onClick={() => runCommand(qc.cmd)}
              disabled={isRunning || !sandboxId}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 transition-colors border border-zinc-700 text-zinc-300"
            >
              {qc.icon}
              {qc.label}
            </button>
          ))}
        </div>
      </div>

      {/* Terminal */}
      <div
        className="flex-1 min-h-[400px] rounded-xl border border-zinc-800 bg-zinc-950 overflow-hidden flex flex-col font-mono text-sm"
        onClick={() => inputRef.current?.focus()}
      >
        {/* Terminal output */}
        <div
          ref={terminalRef}
          className="flex-1 overflow-y-auto p-4 space-y-0.5"
          style={{ maxHeight: "60vh" }}
        >
          {lines.map((line, i) => (
            <div
              key={i}
              className={
                line.type === "input"
                  ? "text-cyan-400"
                  : line.type === "error"
                  ? "text-red-400"
                  : line.type === "info"
                  ? "text-emerald-400"
                  : "text-zinc-300"
              }
            >
              <pre className="whitespace-pre-wrap break-all">{line.content}</pre>
            </div>
          ))}
          {isRunning && (
            <div className="flex items-center gap-2 text-yellow-400">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>Running...</span>
            </div>
          )}
        </div>

        {/* Input line */}
        <div className="border-t border-zinc-800 p-3 flex items-center gap-2">
          <span className="text-emerald-400 shrink-0 text-xs">
            {workingDir.split("/").pop() || "~"}$
          </span>
          <ChevronRight className="h-3 w-3 text-zinc-500 shrink-0" />
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isRunning || !sandboxId}
            placeholder={sandboxId ? "Type a command..." : "Initializing..."}
            className="flex-1 bg-transparent outline-none text-zinc-100 placeholder:text-zinc-600 text-sm"
            autoFocus
            autoComplete="off"
            spellCheck={false}
          />
          {isRunning && <Loader2 className="h-3.5 w-3.5 animate-spin text-zinc-500 shrink-0" />}
        </div>
      </div>

      {/* Command History */}
      {history.length > 0 && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Recent Commands</p>
          <div className="flex flex-wrap gap-1.5">
            {history.slice(0, 10).map((cmd, i) => (
              <button
                key={i}
                onClick={() => { setInput(cmd); inputRef.current?.focus(); }}
                className="px-2 py-0.5 rounded text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 transition-colors font-mono border border-zinc-700"
              >
                {cmd.length > 40 ? cmd.slice(0, 40) + "…" : cmd}
              </button>
            ))}
          </div>
        </div>
      )}

      <AffiliateRecommendations context="developer tools" />
    </div>
  );
}
