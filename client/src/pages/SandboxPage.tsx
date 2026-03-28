import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import AffiliateRecommendations from "@/components/AffiliateRecommendations";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Terminal as TerminalIcon,
  Plus,
  Trash2,
  FolderOpen,
  Save,
  Play,
  FileCode,
  Shield,
  Loader2,
  ChevronRight,
  FolderTree,
  File,
  X,
  Settings,
  Package,
  Variable,
  Activity,
  Search,
  RotateCcw,
  Download,
  Upload,
  Copy,
  Check,
  Cpu,
  HardDrive,
  Wifi,
  Clock,
  RefreshCw,
  Pencil,
  Eye,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Info,
  Globe,
  Lock,
  FileText,
  FolderPlus,
  FilePlus,
  MoreVertical,
  GitBranch,
  FlaskConical,
  Diff,
  SearchCode,
  Wand2,
  Gauge,
  Cpu as CpuIcon,
  StopCircle,
} from "lucide-react";
import { toast } from "sonner";

// ─── Types ──────────────────────────────────────────────────────────

type OutputLine = {
  type: "command" | "output" | "error" | "system" | "info";
  text: string;
  timestamp?: number;
};

type SidePanel = "files" | "editor" | "packages" | "env" | "security" | "history" | "processes" | "git" | "tests" | "search" | "settings";

// ─── Web Terminal Component ─────────────────────────────────────────

function WebTerminal({
  sandboxId,
  onCommandExecuted,
}: {
  sandboxId: number;
  onCommandExecuted?: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const outputRef = useRef<HTMLDivElement>(null);
  const [commandInput, setCommandInput] = useState("");
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [cwd, setCwd] = useState("/home/sandbox");
  const [outputs, setOutputs] = useState<OutputLine[]>([
    {
      type: "system",
      text: `╔══════════════════════════════════════════════════════════════╗
║  Titan Sandbox v2.0 — Persistent Linux Environment          ║
║  Type commands and press Enter. Use Tab for autocomplete.    ║
║  Type 'help' for available commands. 'clear' to reset.       ║
╚══════════════════════════════════════════════════════════════╝`,
      timestamp: Date.now(),
    },
  ]);

  const execMutation = trpc.sandbox.exec.useMutation();

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [outputs]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const executeCommand = useCallback(
    async (cmd: string) => {
      if (!cmd.trim()) return;

      setCommandHistory((prev) => {
        const filtered = prev.filter((c) => c !== cmd);
        return [...filtered, cmd];
      });
      setHistoryIndex(-1);

      setOutputs((prev) => [
        ...prev,
        { type: "command", text: `${cwd} $ ${cmd}`, timestamp: Date.now() },
      ]);

      if (cmd.trim() === "clear") {
        setOutputs([]);
        return;
      }

      if (cmd.trim() === "help") {
        setOutputs((prev) => [
          ...prev,
          {
            type: "info",
            text: `Available commands:
  clear          — Clear terminal output
  help           — Show this help message
  <any command>  — Execute in sandbox (bash)

Keyboard shortcuts:
  ↑/↓            — Navigate command history
  Ctrl+L         — Clear terminal
  Ctrl+C         — Cancel current input

The sandbox persists files between sessions.
Use 'Save to Cloud' to backup your workspace.`,
            timestamp: Date.now(),
          },
        ]);
        return;
      }

      try {
        const result = await execMutation.mutateAsync({
          sandboxId,
          command: cmd,
          workingDirectory: cwd,
        });

        if (result.output) {
          setOutputs((prev) => [
            ...prev,
            {
              type: result.exitCode === 0 ? "output" : "error",
              text: result.output,
              timestamp: Date.now(),
            },
          ]);
        }

        if (result.workingDirectory !== cwd) {
          setCwd(result.workingDirectory);
        }

        onCommandExecuted?.();
      } catch (err: any) {
        setOutputs((prev) => [
          ...prev,
          { type: "error", text: `Error: ${err.message}`, timestamp: Date.now() },
        ]);
      }
    },
    [sandboxId, cwd, execMutation, onCommandExecuted]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      executeCommand(commandInput);
      setCommandInput("");
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (commandHistory.length > 0) {
        const newIndex =
          historyIndex === -1
            ? commandHistory.length - 1
            : Math.max(0, historyIndex - 1);
        setHistoryIndex(newIndex);
        setCommandInput(commandHistory[newIndex]);
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (historyIndex >= 0) {
        const newIndex = historyIndex + 1;
        if (newIndex >= commandHistory.length) {
          setHistoryIndex(-1);
          setCommandInput("");
        } else {
          setHistoryIndex(newIndex);
          setCommandInput(commandHistory[newIndex]);
        }
      }
    } else if (e.ctrlKey && e.key === "l") {
      e.preventDefault();
      setOutputs([]);
    } else if (e.ctrlKey && e.key === "c") {
      e.preventDefault();
      setCommandInput("");
      setOutputs((prev) => [
        ...prev,
        { type: "system", text: "^C", timestamp: Date.now() },
      ]);
    }
  };

  return (
    <div
      className="flex flex-col h-full bg-[#0d1117] rounded-lg border border-zinc-800 overflow-hidden font-mono text-sm"
      onClick={() => inputRef.current?.focus()}
    >
      <div className="flex items-center gap-2 px-4 py-2 bg-[#161b22] border-b border-zinc-800">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-500/80" />
          <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
          <div className="w-3 h-3 rounded-full bg-green-500/80" />
        </div>
        <span className="text-zinc-400 text-xs ml-2 truncate">
          sandbox — {cwd}
        </span>
        {execMutation.isPending && (
          <Loader2 className="w-3 h-3 animate-spin text-cyan-400 ml-auto" />
        )}
        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setOutputs([]);
            }}
            className="text-zinc-500 hover:text-zinc-300 p-1"
            title="Clear terminal"
          >
            <RotateCcw className="w-3 h-3" />
          </button>
        </div>
      </div>

      <div
        ref={outputRef}
        className="flex-1 overflow-y-auto p-4 space-y-0.5 min-h-0"
      >
        {outputs.map((line, i) => (
          <div
            key={i}
            className={`whitespace-pre-wrap break-all leading-relaxed ${
              line.type === "command"
                ? "text-cyan-400 font-semibold"
                : line.type === "error"
                  ? "text-red-400"
                  : line.type === "system"
                    ? "text-zinc-500"
                    : line.type === "info"
                      ? "text-blue-400"
                      : "text-zinc-300"
            }`}
          >
            {line.text}
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 px-4 py-2 border-t border-zinc-800 bg-[#0d1117]">
        <span className="text-green-400 text-xs shrink-0 font-semibold">
          {cwd} $
        </span>
        <input
          ref={inputRef}
          type="text"
          value={commandInput}
          onChange={(e) => setCommandInput(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1 bg-transparent text-zinc-200 outline-none text-sm font-mono"
          placeholder="Type a command..."
          disabled={execMutation.isPending}
          autoComplete="off"
          spellCheck={false}
        />
      </div>
    </div>
  );
}

// ─── File Browser Component ─────────────────────────────────────────

function FileBrowser({
  sandboxId,
  refreshKey,
  onFileSelect,
}: {
  sandboxId: number;
  refreshKey: number;
  onFileSelect?: (path: string) => void;
}) {
  const [currentPath, setCurrentPath] = useState("/home/sandbox");
  const [showNewFileDialog, setShowNewFileDialog] = useState(false);
  const [showNewFolderDialog, setShowNewFolderDialog] = useState(false);
  const [newName, setNewName] = useState("");

  const { data: files, isLoading } = trpc.sandbox.listFiles.useQuery(
    { sandboxId, path: currentPath },
    { refetchInterval: false }
  );

  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [renameTarget, setRenameTarget] = useState<{ path: string; name: string } | null>(null);
  const [renameTo, setRenameTo] = useState("");

  const utils = trpc.useUtils();
  const invalidateFiles = () => utils.sandbox.listFiles.invalidate({ sandboxId, path: currentPath });

  const writeMutation = trpc.sandbox.writeFile.useMutation({
    onSuccess: () => { invalidateFiles(); toast.success("Created successfully"); },
  });
  const deleteFileMutation = trpc.sandbox.deleteFile.useMutation({
    onSuccess: () => { invalidateFiles(); toast.success("Deleted"); },
    onError: (err) => toast.error(err.message),
  });
  const createDirMutation = trpc.sandbox.createDir.useMutation({
    onSuccess: () => { invalidateFiles(); toast.success("Folder created"); },
    onError: (err) => toast.error(err.message),
  });
  const execMutation = trpc.sandbox.exec.useMutation({
    onSuccess: () => { invalidateFiles(); },
  });

  useEffect(() => {
    utils.sandbox.listFiles.invalidate({ sandboxId, path: currentPath });
  }, [refreshKey, sandboxId, currentPath, utils]);

  const navigateTo = (path: string) => setCurrentPath(path);
  const goUp = () => {
    const parent = currentPath.split("/").slice(0, -1).join("/") || "/";
    setCurrentPath(parent);
  };

  const createFile = () => {
    if (!newName.trim()) return;
    const filePath = `${currentPath}/${newName.trim()}`;
    writeMutation.mutate({ sandboxId, path: filePath, content: "" });
    setShowNewFileDialog(false);
    setNewName("");
  };

  const createFolder = () => {
    if (!newName.trim()) return;
    const folderPath = `${currentPath}/${newName.trim()}`;
    createDirMutation.mutate({ sandboxId, path: folderPath });
    setShowNewFolderDialog(false);
    setNewName("");
  };

  const deleteItem = (itemPath: string) => {
    if (!confirm(`Delete: ${itemPath}?`)) return;
    deleteFileMutation.mutate({ sandboxId, path: itemPath });
  };

  const startRename = (path: string, name: string) => {
    setRenameTarget({ path, name });
    setRenameTo(name);
    setShowRenameDialog(true);
  };

  const doRename = () => {
    if (!renameTarget || !renameTo.trim() || renameTo.trim() === renameTarget.name) {
      setShowRenameDialog(false);
      return;
    }
    const dir = renameTarget.path.split("/").slice(0, -1).join("/") || "/";
    const newPath = `${dir}/${renameTo.trim()}`;
    execMutation.mutate({
      sandboxId,
      command: `mv "${renameTarget.path}" "${newPath}"`,
      workingDirectory: currentPath,
    });
    setShowRenameDialog(false);
    setRenameTarget(null);
    setRenameTo("");
  };

  const getFileIcon = (name: string) => {
    const ext = name.split(".").pop()?.toLowerCase();
    if (["ts", "tsx", "js", "jsx"].includes(ext || "")) return <FileCode className="w-3.5 h-3.5 text-blue-400 shrink-0" />;
    if (["py"].includes(ext || "")) return <FileCode className="w-3.5 h-3.5 text-yellow-400 shrink-0" />;
    if (["md", "txt"].includes(ext || "")) return <FileText className="w-3.5 h-3.5 text-zinc-400 shrink-0" />;
    if (["json", "yaml", "yml", "toml"].includes(ext || "")) return <FileCode className="w-3.5 h-3.5 text-green-400 shrink-0" />;
    if (["sh", "bash"].includes(ext || "")) return <TerminalIcon className="w-3.5 h-3.5 text-orange-400 shrink-0" />;
    return <File className="w-3.5 h-3.5 text-zinc-500 shrink-0" />;
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}K`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}M`;
  };

  // Sort: directories first, then alphabetical
  const sortedFiles = useMemo(() => {
    if (!files) return [];
    return [...files].sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [files]);

  return (
    <div className="flex flex-col h-full bg-[#0d1117] rounded-lg border border-zinc-800 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-[#161b22] border-b border-zinc-800">
        <div className="flex items-center gap-2 min-w-0">
          <FolderTree className="w-4 h-4 text-cyan-400 shrink-0" />
          <span className="text-zinc-300 text-xs font-medium">Files</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => { setNewName(""); setShowNewFileDialog(true); }}
            className="text-zinc-500 hover:text-zinc-300 p-1"
            title="New file"
          >
            <FilePlus className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => { setNewName(""); setShowNewFolderDialog(true); }}
            className="text-zinc-500 hover:text-zinc-300 p-1"
            title="New folder"
          >
            <FolderPlus className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => utils.sandbox.listFiles.invalidate({ sandboxId, path: currentPath })}
            className="text-zinc-500 hover:text-zinc-300 p-1"
            title="Refresh"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Breadcrumb */}
      <div className="flex items-center gap-1 px-3 py-1.5 border-b border-zinc-800/50 text-xs overflow-x-auto">
        <button onClick={() => setCurrentPath("/")} className="text-cyan-400 hover:underline shrink-0">/</button>
        {currentPath.split("/").filter(Boolean).map((segment, i, arr) => (
          <span key={i} className="flex items-center gap-1 shrink-0">
            <ChevronRight className="w-3 h-3 text-zinc-600" />
            <button
              onClick={() => navigateTo("/" + arr.slice(0, i + 1).join("/"))}
              className="text-cyan-400 hover:underline"
            >
              {segment}
            </button>
          </span>
        ))}
      </div>

      {/* File list */}
      <div className="flex-1 overflow-y-auto">
        {currentPath !== "/" && (
          <button onClick={goUp} className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-zinc-400 hover:bg-zinc-800/50">
            <FolderOpen className="w-3.5 h-3.5 text-yellow-500" />
            ..
          </button>
        )}
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-4 h-4 animate-spin text-zinc-500" />
          </div>
        ) : (
          sortedFiles.map((file) => (
            <div
              key={file.path}
              className="group flex items-center gap-2 w-full px-3 py-1.5 text-xs hover:bg-zinc-800/50"
            >
              <button
                onClick={() => {
                  if (file.isDirectory) navigateTo(file.path);
                  else onFileSelect?.(file.path);
                }}
                className={`flex items-center gap-2 flex-1 min-w-0 ${
                  file.isDirectory ? "text-cyan-400 cursor-pointer" : "text-zinc-400 cursor-pointer"
                }`}
              >
                {file.isDirectory ? (
                  <FolderOpen className="w-3.5 h-3.5 text-yellow-500 shrink-0" />
                ) : (
                  getFileIcon(file.name)
                )}
                <span className="truncate">{file.name}</span>
              </button>
              {!file.isDirectory && (
                <span className="text-zinc-600 shrink-0">{formatSize(file.size)}</span>
              )}
              <button
                onClick={() => startRename(file.path, file.name)}
                className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-zinc-300 p-0.5 transition-opacity"
                title="Rename"
              >
                <Pencil className="w-3 h-3" />
              </button>
              <button
                onClick={() => deleteItem(file.path)}
                className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-red-400 p-0.5 transition-opacity"
                title="Delete"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))
        )}
        {!isLoading && (!files || files.length === 0) && (
          <div className="text-center text-zinc-600 text-xs py-8">Empty directory</div>
        )}
      </div>

      {/* New file dialog */}
      <Dialog open={showNewFileDialog} onOpenChange={setShowNewFileDialog}>
        <DialogContent className="bg-[#161b22] border-zinc-700 text-zinc-200">
          <DialogHeader>
            <DialogTitle className="text-zinc-100">New File</DialogTitle>
          </DialogHeader>
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="filename.ts"
            className="bg-[#0d1117] border-zinc-700 text-zinc-200"
            onKeyDown={(e) => e.key === "Enter" && createFile()}
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewFileDialog(false)} className="border-zinc-700 text-zinc-400">Cancel</Button>
            <Button onClick={createFile} className="bg-cyan-600 hover:bg-cyan-700 text-white">Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New folder dialog */}
      <Dialog open={showNewFolderDialog} onOpenChange={setShowNewFolderDialog}>
        <DialogContent className="bg-[#161b22] border-zinc-700 text-zinc-200">
          <DialogHeader>
            <DialogTitle className="text-zinc-100">New Folder</DialogTitle>
          </DialogHeader>
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="folder-name"
            className="bg-[#0d1117] border-zinc-700 text-zinc-200"
            onKeyDown={(e) => e.key === "Enter" && createFolder()}
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewFolderDialog(false)} className="border-zinc-700 text-zinc-400">Cancel</Button>
            <Button onClick={createFolder} className="bg-cyan-600 hover:bg-cyan-700 text-white">Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename dialog */}
      <Dialog open={showRenameDialog} onOpenChange={setShowRenameDialog}>
        <DialogContent className="bg-[#161b22] border-zinc-700 text-zinc-200">
          <DialogHeader>
            <DialogTitle className="text-zinc-100">Rename</DialogTitle>
          </DialogHeader>
          <Input
            value={renameTo}
            onChange={(e) => setRenameTo(e.target.value)}
            placeholder="new-name"
            className="bg-[#0d1117] border-zinc-700 text-zinc-200"
            onKeyDown={(e) => e.key === "Enter" && doRename()}
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRenameDialog(false)} className="border-zinc-700 text-zinc-400">Cancel</Button>
            <Button onClick={doRename} className="bg-cyan-600 hover:bg-cyan-700 text-white">Rename</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Code Editor Component ──────────────────────────────────────────

function CodeEditor({
  sandboxId,
  filePath,
  onClose,
}: {
  sandboxId: number;
  filePath: string;
  onClose: () => void;
}) {
  const [content, setContent] = useState("");
  const [originalContent, setOriginalContent] = useState("");
  const [isDirty, setIsDirty] = useState(false);
  const [MonacoEditor, setMonacoEditor] = useState<any>(null);

  const { data: fileData, isLoading } = trpc.sandbox.readFile.useQuery(
    { sandboxId, path: filePath },
    { enabled: !!filePath }
  );

  const writeMutation = trpc.sandbox.writeFile.useMutation({
    onSuccess: () => {
      setOriginalContent(content);
      setIsDirty(false);
      toast.success("File saved");
    },
    onError: (err) => toast.error(err.message),
  });

  useEffect(() => {
    import("@monaco-editor/react").then((mod) => {
      setMonacoEditor(() => mod.default);
    });
  }, []);

  useEffect(() => {
    if (fileData?.content !== undefined) {
      setContent(fileData.content);
      setOriginalContent(fileData.content);
      setIsDirty(false);
    }
  }, [fileData]);

  const getLanguage = (path: string) => {
    const ext = path.split(".").pop()?.toLowerCase();
    const map: Record<string, string> = {
      ts: "typescript", tsx: "typescript", js: "javascript", jsx: "javascript",
      py: "python", json: "json", md: "markdown", html: "html", css: "css",
      sh: "shell", bash: "shell", yaml: "yaml", yml: "yaml", toml: "toml",
      sql: "sql", xml: "xml", rs: "rust", go: "go", rb: "ruby", php: "php",
      c: "c", cpp: "cpp", h: "c", hpp: "cpp", java: "java", kt: "kotlin",
      swift: "swift", r: "r", lua: "lua", dockerfile: "dockerfile",
    };
    return map[ext || ""] || "plaintext";
  };

  const handleSave = () => {
    writeMutation.mutate({ sandboxId, path: filePath, content });
  };

  const fileName = filePath.split("/").pop() || filePath;

  return (
    <div className="flex flex-col h-full bg-[#0d1117] rounded-lg border border-zinc-800 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-[#161b22] border-b border-zinc-800">
        <div className="flex items-center gap-2 min-w-0">
          <FileCode className="w-4 h-4 text-blue-400 shrink-0" />
          <span className="text-zinc-300 text-xs font-medium truncate">{fileName}</span>
          {isDirty && <span className="text-yellow-400 text-xs">●</span>}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSave}
            disabled={!isDirty || writeMutation.isPending}
            className="h-6 px-2 text-xs text-zinc-400 hover:text-zinc-200"
          >
            {writeMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3 mr-1" />}
            Save
          </Button>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 p-1">
                  <span className="sr-only">Close</span>
                  <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-5 h-5 animate-spin text-zinc-500" />
          </div>
        ) : MonacoEditor ? (
          <MonacoEditor
            height="100%"
            language={getLanguage(filePath)}
            value={content}
            onChange={(val: string | undefined) => {
              const newVal = val ?? "";
              setContent(newVal);
              setIsDirty(newVal !== originalContent);
            }}
            theme="vs-dark"
            options={{
              minimap: { enabled: false },
              fontSize: 13,
              fontFamily: "'JetBrains Mono', monospace",
              lineNumbers: "on",
              scrollBeyondLastLine: false,
              wordWrap: "on",
              tabSize: 2,
              padding: { top: 8 },
              renderWhitespace: "selection",
              bracketPairColorization: { enabled: true },
              automaticLayout: true,
            }}
          />
        ) : (
          <textarea
            value={content}
            onChange={(e) => {
              setContent(e.target.value);
              setIsDirty(e.target.value !== originalContent);
            }}
            className="w-full h-full bg-[#0d1117] text-zinc-300 font-mono text-sm p-4 resize-none outline-none"
            spellCheck={false}
          />
        )}
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-between px-3 py-1 bg-[#161b22] border-t border-zinc-800 text-[10px] text-zinc-500">
        <span>{getLanguage(filePath)}</span>
        <span>{content.split("\n").length} lines</span>
        <span>UTF-8</span>
        <span className="flex items-center gap-1">
          {isDirty ? (
            <><span className="w-1.5 h-1.5 rounded-full bg-yellow-400" /> Modified</>
          ) : (
            <><Check className="w-2.5 h-2.5 text-green-400" /> Saved</>
          )}
        </span>
      </div>
    </div>
  );
}

// ─── Package Manager Component ──────────────────────────────────────

function PackageManager({ sandboxId }: { sandboxId: number }) {
  const [packageName, setPackageName] = useState("");
  const [packageManager, setPackageManager] = useState<"npm" | "pip" | "apt">("npm");

  const utils = trpc.useUtils();
  const installMutation = trpc.sandbox.installPackage.useMutation({
    onSuccess: (result) => {
      if (result.success) {
        toast.success(`Installed ${packageName}`);
        setPackageName("");
        utils.sandbox.getPackages.invalidate({ sandboxId });
      } else {
        toast.error(`Failed: ${result.output.slice(0, 200)}`);
      }
    },
    onError: (err) => toast.error(err.message),
  });

  const { data: packages } = trpc.sandbox.getPackages.useQuery({ sandboxId });

  return (
    <div className="flex flex-col h-full bg-[#0d1117] rounded-lg border border-zinc-800 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 bg-[#161b22] border-b border-zinc-800">
        <Package className="w-4 h-4 text-green-400" />
        <span className="text-zinc-300 text-xs font-medium">Packages</span>
      </div>

      {/* Install form */}
      <div className="p-3 border-b border-zinc-800/50 space-y-2">
        <div className="flex gap-1">
          {(["npm", "pip", "apt"] as const).map((pm) => (
            <button
              key={pm}
              onClick={() => setPackageManager(pm)}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                packageManager === pm
                  ? "bg-cyan-600/20 text-cyan-400 border border-cyan-600/40"
                  : "text-zinc-500 hover:text-zinc-300 border border-transparent"
              }`}
            >
              {pm}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            value={packageName}
            onChange={(e) => setPackageName(e.target.value)}
            placeholder={`Package name (${packageManager})`}
            className="h-8 text-xs bg-[#0d1117] border-zinc-700 text-zinc-200"
            onKeyDown={(e) => {
              if (e.key === "Enter" && packageName.trim()) {
                installMutation.mutate({ sandboxId, packageManager, packageName: packageName.trim() });
              }
            }}
          />
          <Button
            size="sm"
            onClick={() => {
              if (packageName.trim()) {
                installMutation.mutate({ sandboxId, packageManager, packageName: packageName.trim() });
              }
            }}
            disabled={installMutation.isPending || !packageName.trim()}
            className="h-8 text-xs bg-green-600 hover:bg-green-700 text-white shrink-0"
          >
            {installMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3 mr-1" />}
            Install
          </Button>
        </div>
      </div>

      {/* Installed packages */}
      <div className="flex-1 overflow-y-auto p-3">
        <p className="text-zinc-500 text-xs mb-2 font-medium">Installed</p>
        {packages && packages.length > 0 ? (
          <div className="space-y-1">
            {packages.map((pkg, i) => {
              const [pm, name] = (pkg as string).split(":");
              return (
                <div key={i} className="flex items-center gap-2 text-xs text-zinc-400 py-1 px-2 rounded hover:bg-zinc-800/50">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                    pm === "npm" ? "bg-red-900/30 text-red-400" :
                    pm === "pip" ? "bg-blue-900/30 text-blue-400" :
                    "bg-green-900/30 text-green-400"
                  }`}>{pm}</span>
                  <span className="text-zinc-300">{name}</span>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-zinc-600 text-xs">No packages installed yet</p>
        )}
      </div>
    </div>
  );
}

// ─── Environment Variables Component ────────────────────────────────

function EnvVarsManager({ sandboxId }: { sandboxId: number }) {
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");
  const [showValues, setShowValues] = useState<Record<string, boolean>>({});

  const utils = trpc.useUtils();
  const { data: envData } = trpc.sandbox.getEnv.useQuery({ sandboxId });

  const updateMutation = trpc.sandbox.updateEnv.useMutation({
    onSuccess: () => {
      toast.success("Environment updated");
      utils.sandbox.getEnv.invalidate({ sandboxId });
      setNewKey("");
      setNewValue("");
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteEnvMutation = trpc.sandbox.deleteEnv.useMutation({
    onSuccess: () => {
      toast.success("Variable deleted");
      utils.sandbox.getEnv.invalidate({ sandboxId });
    },
    onError: (err) => toast.error(err.message),
  });

  const envVars = (envData || {}) as Record<string, string>;

  const addVar = () => {
    if (!newKey.trim()) return;
    updateMutation.mutate({ sandboxId, envVars: { [newKey.trim()]: newValue } });
  };

  const deleteVar = (key: string) => {
    deleteEnvMutation.mutate({ sandboxId, key });
  };

  return (
    <div className="flex flex-col h-full bg-[#0d1117] rounded-lg border border-zinc-800 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 bg-[#161b22] border-b border-zinc-800">
        <Variable className="w-4 h-4 text-purple-400" />
        <span className="text-zinc-300 text-xs font-medium">Environment Variables</span>
      </div>

      {/* Add new */}
      <div className="p-3 border-b border-zinc-800/50 space-y-2">
        <div className="flex gap-2">
          <Input
            value={newKey}
            onChange={(e) => setNewKey(e.target.value.toUpperCase())}
            placeholder="KEY"
            className="h-7 text-xs bg-[#0d1117] border-zinc-700 text-zinc-200 font-mono w-1/3"
          />
          <Input
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            placeholder="value"
            className="h-7 text-xs bg-[#0d1117] border-zinc-700 text-zinc-200 font-mono flex-1"
            onKeyDown={(e) => e.key === "Enter" && addVar()}
          />
          <Button size="sm" onClick={addVar} disabled={!newKey.trim()} className="h-7 text-xs bg-purple-600 hover:bg-purple-700 text-white">
            <Plus className="w-3 h-3" />
          </Button>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {Object.entries(envVars).filter(([, v]) => v !== "").length > 0 ? (
          Object.entries(envVars).filter(([, v]) => v !== "").map(([key, value]) => (
            <div key={key} className="flex items-center gap-2 px-3 py-2 border-b border-zinc-800/30 hover:bg-zinc-800/30">
              <span className="text-cyan-400 text-xs font-mono font-medium shrink-0">{key}</span>
              <span className="text-zinc-600 text-xs">=</span>
              <span className="text-zinc-400 text-xs font-mono truncate flex-1">
                {showValues[key] ? value : "•".repeat(Math.min(value.length, 20))}
              </span>
              <button
                onClick={() => setShowValues((prev) => ({ ...prev, [key]: !prev[key] }))}
                className="text-zinc-600 hover:text-zinc-400 p-0.5"
              >
                <Eye className="w-3 h-3" />
              </button>
              <button
                onClick={() => { navigator.clipboard.writeText(value); toast.success("Copied"); }}
                className="text-zinc-600 hover:text-zinc-400 p-0.5"
              >
                <Copy className="w-3 h-3" />
              </button>
              <button onClick={() => deleteVar(key)} className="text-zinc-600 hover:text-red-400 p-0.5">
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))
        ) : (
          <div className="text-center text-zinc-600 text-xs py-8">No environment variables set</div>
        )}
      </div>
    </div>
  );
}

// ─── Command History Component ──────────────────────────────────────

function CommandHistory({
  sandboxId,
  onRerun,
}: {
  sandboxId: number;
  onRerun?: (cmd: string) => void;
}) {
  const [searchTerm, setSearchTerm] = useState("");

  const { data: history, isLoading } = trpc.sandbox.history.useQuery(
    { sandboxId, limit: 100 },
    { refetchInterval: 10_000 }
  );

  const filtered = useMemo(() => {
    if (!history) return [];
    if (!searchTerm) return history;
    return history.filter((h) =>
      h.command.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [history, searchTerm]);

  return (
    <div className="flex flex-col h-full bg-[#0d1117] rounded-lg border border-zinc-800 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 bg-[#161b22] border-b border-zinc-800">
        <Clock className="w-4 h-4 text-orange-400" />
        <span className="text-zinc-300 text-xs font-medium">Command History</span>
        <span className="text-zinc-600 text-[10px] ml-auto">{filtered.length} commands</span>
      </div>

      <div className="px-3 py-2 border-b border-zinc-800/50">
        <div className="flex items-center gap-2 bg-[#161b22] rounded px-2 py-1">
          <Search className="w-3 h-3 text-zinc-500" />
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search commands..."
            className="flex-1 bg-transparent text-zinc-300 text-xs outline-none"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-4 h-4 animate-spin text-zinc-500" />
          </div>
        ) : filtered.length > 0 ? (
          filtered.map((entry) => (
            <div
              key={entry.id}
              className="group px-3 py-2 border-b border-zinc-800/30 hover:bg-zinc-800/30 cursor-pointer"
              onClick={() => onRerun?.(entry.command)}
            >
              <div className="flex items-center gap-2">
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                  entry.exitCode === 0 ? "bg-green-400" : "bg-red-400"
                }`} />
                <span className="text-cyan-400 text-xs font-mono truncate flex-1">{entry.command}</span>
                <span className="text-zinc-600 text-[10px] shrink-0">
                  {entry.durationMs ? `${entry.durationMs}ms` : ""}
                </span>
                <Play className="w-3 h-3 text-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-zinc-600 text-[10px]">
                  {entry.triggeredBy === "ai" ? "🤖" : "👤"}{" "}
                  {new Date(entry.createdAt).toLocaleTimeString()}
                </span>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center text-zinc-600 text-xs py-8">No commands yet</div>
        )}
      </div>
    </div>
  );
}

// ─── Security Scanner Component ─────────────────────────────────────

function SecurityScanner({ sandboxId }: { sandboxId: number }) {
  const [secTab, setSecTab] = useState<"headers" | "ports" | "ssl" | "code" | "fixes">("headers");
  const [scanTarget, setScanTarget] = useState("");
  const [scanResult, setScanResult] = useState<any>(null);
  const [scanning, setScanning] = useState(false);
  const [portTarget, setPortTarget] = useState("");
  const [portResult, setPortResult] = useState<any>(null);
  const [portScanning, setPortScanning] = useState(false);
  const [sslDomain, setSslDomain] = useState("");
  const [sslResult, setSslResult] = useState<any>(null);
  const [sslChecking, setSslChecking] = useState(false);
  const [codeInput, setCodeInput] = useState("");
  const [codeFilename, setCodeFilename] = useState("code.ts");
  const [codeReviewResult, setCodeReviewResult] = useState<any>(null);
  const [reviewing, setReviewing] = useState(false);
  const [fixing, setFixing] = useState<string | null>(null);
  const [fixResults, setFixResults] = useState<Record<string, any>>({});
  const [fixingAll, setFixingAll] = useState(false);

  const execMutation = trpc.sandbox.exec.useMutation();
  const codeReviewMutation = trpc.sandbox.codeReview.useMutation();
  const portScanMutation = trpc.sandbox.portScan.useMutation();
  const sslCheckMutation = trpc.sandbox.sslCheck.useMutation();

  // Port scan handler
  const runPortScan = async () => {
    if (!portTarget.trim()) return;
    setPortScanning(true);
    setPortResult(null);
    try {
      const result = await portScanMutation.mutateAsync({ host: portTarget.trim() });
      setPortResult(result);
    } catch (err: any) {
      toast.error(`Port scan failed: ${err.message}`);
    } finally {
      setPortScanning(false);
    }
  };

  // SSL check handler
  const runSslCheck = async () => {
    if (!sslDomain.trim()) return;
    setSslChecking(true);
    setSslResult(null);
    try {
      const domain = sslDomain.trim().replace(/^https?:\/\//, "").split("/")[0];
      const result = await sslCheckMutation.mutateAsync({ domain });
      setSslResult(result);
    } catch (err: any) {
      toast.error(`SSL check failed: ${err.message}`);
    } finally {
      setSslChecking(false);
    }
  };
  // Direct fetch wrappers to bypass tRPC type inference limit (25+ endpoints)
  const fixVulnMutate = async (input: any) => {
    const res = await fetch('/api/trpc/sandbox.fixVulnerability', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ json: input }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message || 'Fix failed');
    return data.result?.data?.json ?? data.result?.data ?? data;
  };
  const fixAllMutate = async (input: any) => {
    const res = await fetch('/api/trpc/sandbox.fixAllVulnerabilities', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ json: input }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message || 'Fix all failed');
    return data.result?.data?.json ?? data.result?.data ?? data;
  };

  // ── Header Scan ──
  const runScan = async () => {
    if (!scanTarget.trim()) return;
    setScanning(true);
    setScanResult(null);
    try {
      const result = await execMutation.mutateAsync({
        sandboxId,
        command: `curl -sI -L --max-time 10 "${scanTarget.trim()}" 2>&1 | head -50`,
        workingDirectory: "/home/sandbox",
      });
      const headers = result.output;
      const headerLines = headers.split("\n").filter(Boolean);
      const securityHeaders: Record<string, boolean> = {
        "Strict-Transport-Security": false,
        "Content-Security-Policy": false,
        "X-Frame-Options": false,
        "X-Content-Type-Options": false,
        "Referrer-Policy": false,
        "Permissions-Policy": false,
      };
      for (const line of headerLines) {
        for (const header of Object.keys(securityHeaders)) {
          if (line.toLowerCase().startsWith(header.toLowerCase())) {
            securityHeaders[header] = true;
          }
        }
      }
      const present = Object.values(securityHeaders).filter(Boolean).length;
      const total = Object.keys(securityHeaders).length;
      setScanResult({ target: scanTarget, rawHeaders: headers, securityHeaders, score: Math.round((present / total) * 100), present, total });
    } catch (err: any) {
      toast.error(`Scan failed: ${err.message}`);
    } finally {
      setScanning(false);
    }
  };

  // ── Code Review ──
  const runCodeReview = async () => {
    if (!codeInput.trim()) return;
    setReviewing(true);
    setCodeReviewResult(null);
    setFixResults({});
    try {
      const result = await codeReviewMutation.mutateAsync({ code: codeInput, filename: codeFilename });
      setCodeReviewResult(result);
      if (result.issues?.length > 0) setSecTab("fixes");
    } catch (err: any) {
      toast.error(`Review failed: ${err.message}`);
    } finally {
      setReviewing(false);
    }
  };

  // ── Fix Single ──
  const fixSingle = async (issue: any) => {
    const key = issue.title;
    setFixing(key);
    try {
      const result = await fixVulnMutate({
        filename: codeFilename,
        code: codeInput,
        issue: {
          title: issue.title,
          severity: issue.severity,
          category: issue.category || "security",
          description: issue.description,
          suggestion: issue.suggestion,
          file: codeFilename,
          line: issue.line,
        },
      });
      setFixResults((prev) => ({ ...prev, [key]: result }));
      toast.success(`Fixed: ${issue.title}`);
    } catch (err: any) {
      toast.error(`Fix failed: ${err.message}`);
    } finally {
      setFixing(null);
    }
  };

  // ── Fix All ──
  const fixAll = async () => {
    if (!codeReviewResult?.issues?.length) return;
    setFixingAll(true);
    try {
      const result = await fixAllMutate({
        files: [{ filename: codeFilename, content: codeInput }],
        issues: codeReviewResult.issues.map((i: any) => ({
          title: i.title,
          severity: i.severity,
          category: i.category || "security",
          description: i.description,
          suggestion: i.suggestion,
          file: codeFilename,
          line: i.line,
        })),
      });
      // Map batch results to individual fix results
      if (result.fixes) {
        const mapped: Record<string, any> = {};
        for (const fix of result.fixes) {
          mapped[fix.issueTitle] = fix;
        }
        setFixResults(mapped);
      }
      toast.success(`Fixed ${result.fixedCount || 0} of ${result.totalIssues || 0} vulnerabilities`);
    } catch (err: any) {
      toast.error(`Batch fix failed: ${err.message}`);
    } finally {
      setFixingAll(false);
    }
  };

  const severityBadge = (sev: string) => {
    const colors: Record<string, string> = {
      critical: "bg-red-900/50 text-red-300 border-red-700/50",
      high: "bg-orange-900/50 text-orange-300 border-orange-700/50",
      medium: "bg-yellow-900/50 text-yellow-300 border-yellow-700/50",
      low: "bg-blue-900/50 text-blue-300 border-blue-700/50",
    };
    return (
      <span className={`text-[10px] px-1.5 py-0.5 rounded border ${colors[sev] || colors.low}`}>
        {sev.toUpperCase()}
      </span>
    );
  };

  return (
    <div className="flex flex-col h-full bg-[#0d1117] rounded-lg border border-zinc-800 overflow-hidden">
      {/* Tab bar */}
      <div className="flex items-center gap-0 bg-[#161b22] border-b border-zinc-800 overflow-x-auto">
        {(["headers", "ports", "ssl", "code", "fixes"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setSecTab(tab)}
            className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors shrink-0 ${
              secTab === tab
                ? "border-red-500 text-zinc-200 bg-[#0d1117]"
                : "border-transparent text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {tab === "headers" && "Headers"}
            {tab === "ports" && "Port Scan"}
            {tab === "ssl" && "SSL Check"}
            {tab === "code" && "Code Review"}
            {tab === "fixes" && (
              <span className="flex items-center gap-1">
                Auto-Fix
                {codeReviewResult?.issues?.length > 0 && (
                  <span className="bg-red-600 text-white text-[9px] px-1 rounded-full">
                    {codeReviewResult.issues.length}
                  </span>
                )}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Header Scan Tab */}
      {secTab === "headers" && (
        <div className="flex flex-col flex-1 overflow-hidden">
          <div className="p-3 border-b border-zinc-800/50">
            <div className="flex gap-2">
              <div className="flex items-center gap-2 bg-[#161b22] rounded px-2 flex-1">
                <Globe className="w-3 h-3 text-zinc-500" />
                <input
                  value={scanTarget}
                  onChange={(e) => setScanTarget(e.target.value)}
                  placeholder="https://example.com"
                  className="flex-1 bg-transparent text-zinc-300 text-xs outline-none py-1.5"
                  onKeyDown={(e) => e.key === "Enter" && runScan()}
                />
              </div>
              <Button size="sm" onClick={runScan} disabled={scanning || !scanTarget.trim()} className="h-8 text-xs bg-red-600 hover:bg-red-700 text-white">
                {scanning ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Shield className="w-3 h-3 mr-1" />}
                Scan
              </Button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            {scanResult ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded bg-[#161b22]">
                  <div>
                    <p className="text-zinc-300 text-sm font-medium">Security Score</p>
                    <p className="text-zinc-500 text-xs">{scanResult.present}/{scanResult.total} headers present</p>
                  </div>
                  <div className={`text-2xl font-bold ${scanResult.score >= 80 ? "text-green-400" : scanResult.score >= 50 ? "text-yellow-400" : "text-red-400"}`}>
                    {scanResult.score}%
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-zinc-400 text-xs font-medium mb-2">Security Headers</p>
                  {Object.entries(scanResult.securityHeaders).map(([header, present]) => (
                    <div key={header} className="flex items-center gap-2 py-1 px-2 rounded hover:bg-zinc-800/30">
                      {present ? <CheckCircle2 className="w-3.5 h-3.5 text-green-400 shrink-0" /> : <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />}
                      <span className={`text-xs font-mono ${present ? "text-green-400" : "text-red-400"}`}>{header}</span>
                    </div>
                  ))}
                </div>
                <div>
                  <p className="text-zinc-400 text-xs font-medium mb-2">Raw Response</p>
                  <pre className="text-[11px] text-zinc-500 font-mono bg-[#161b22] rounded p-2 overflow-x-auto max-h-32 overflow-y-auto">{scanResult.rawHeaders}</pre>
                </div>
              </div>
            ) : (
              <div className="text-center text-zinc-600 text-xs py-8">
                <Shield className="w-8 h-8 text-zinc-700 mx-auto mb-2" />
                <p>Enter a URL to scan for security headers</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Port Scan Tab */}
      {secTab === "ports" && (
        <div className="flex flex-col flex-1 overflow-hidden">
          <div className="p-3 border-b border-zinc-800/50">
            <div className="flex gap-2">
              <div className="flex items-center gap-2 bg-[#161b22] rounded px-2 flex-1">
                <Wifi className="w-3 h-3 text-zinc-500" />
                <input
                  value={portTarget}
                  onChange={(e) => setPortTarget(e.target.value)}
                  placeholder="192.168.1.1 or example.com"
                  className="flex-1 bg-transparent text-zinc-300 text-xs outline-none py-1.5"
                  onKeyDown={(e) => e.key === "Enter" && runPortScan()}
                />
              </div>
              <Button size="sm" onClick={runPortScan} disabled={portScanning || !portTarget.trim()} className="h-8 text-xs bg-orange-600 hover:bg-orange-700 text-white">
                {portScanning ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Activity className="w-3 h-3 mr-1" />}
                Scan
              </Button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            {portResult ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded bg-[#161b22]">
                  <div>
                    <p className="text-zinc-300 text-sm font-medium">{portResult.host}</p>
                    <p className="text-zinc-500 text-xs">{portResult.openPorts?.length || 0} open ports found</p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded ${portResult.openPorts?.length > 0 ? "bg-orange-900/50 text-orange-300" : "bg-green-900/50 text-green-300"}`}>
                    {portResult.openPorts?.length > 0 ? "Exposed" : "Closed"}
                  </span>
                </div>
                {portResult.openPorts?.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-zinc-400 text-xs font-medium mb-2">Open Ports</p>
                    {portResult.openPorts.map((p: any) => (
                      <div key={p.port} className="flex items-center gap-3 py-1.5 px-2 rounded bg-[#161b22]">
                        <span className="text-orange-400 font-mono text-xs w-12">{p.port}</span>
                        <span className="text-zinc-300 text-xs">{p.service || "unknown"}</span>
                        {p.version && <span className="text-zinc-500 text-xs">{p.version}</span>}
                        <span className={`ml-auto text-[10px] px-1.5 py-0.5 rounded border ${
                          p.risk === "high" ? "bg-red-900/50 text-red-300 border-red-700/50" :
                          p.risk === "medium" ? "bg-yellow-900/50 text-yellow-300 border-yellow-700/50" :
                          "bg-zinc-800 text-zinc-400 border-zinc-700"
                        }`}>{p.risk || "low"}</span>
                      </div>
                    ))}
                  </div>
                )}
                {portResult.summary && (
                  <div className="p-2 rounded bg-[#161b22] text-zinc-400 text-xs">{portResult.summary}</div>
                )}
              </div>
            ) : (
              <div className="text-center text-zinc-600 text-xs py-8">
                <Activity className="w-8 h-8 text-zinc-700 mx-auto mb-2" />
                <p>Enter a host to scan for open ports</p>
                <p className="text-zinc-700 mt-1">Checks common ports: 21, 22, 23, 25, 80, 443, 3306, 5432, 6379, 8080, 8443, 27017</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SSL Check Tab */}
      {secTab === "ssl" && (
        <div className="flex flex-col flex-1 overflow-hidden">
          <div className="p-3 border-b border-zinc-800/50">
            <div className="flex gap-2">
              <div className="flex items-center gap-2 bg-[#161b22] rounded px-2 flex-1">
                <Lock className="w-3 h-3 text-zinc-500" />
                <input
                  value={sslDomain}
                  onChange={(e) => setSslDomain(e.target.value)}
                  placeholder="example.com"
                  className="flex-1 bg-transparent text-zinc-300 text-xs outline-none py-1.5"
                  onKeyDown={(e) => e.key === "Enter" && runSslCheck()}
                />
              </div>
              <Button size="sm" onClick={runSslCheck} disabled={sslChecking || !sslDomain.trim()} className="h-8 text-xs bg-green-700 hover:bg-green-800 text-white">
                {sslChecking ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Lock className="w-3 h-3 mr-1" />}
                Check
              </Button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            {sslResult ? (
              <div className="space-y-3">
                <div className={`flex items-center justify-between p-3 rounded ${sslResult.valid ? "bg-green-900/20 border border-green-800/50" : "bg-red-900/20 border border-red-800/50"}`}>
                  <div>
                    <p className="text-zinc-300 text-sm font-medium">{sslResult.domain || sslDomain}</p>
                    <p className="text-zinc-500 text-xs">{sslResult.valid ? "Certificate valid" : "Certificate issue detected"}</p>
                  </div>
                  {sslResult.valid ? <CheckCircle2 className="w-5 h-5 text-green-400" /> : <XCircle className="w-5 h-5 text-red-400" />}
                </div>
                <div className="bg-[#161b22] rounded p-3 space-y-2 text-xs">
                  {sslResult.issuer && (
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Issuer</span>
                      <span className="text-zinc-300">{sslResult.issuer}</span>
                    </div>
                  )}
                  {sslResult.subject && (
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Subject</span>
                      <span className="text-zinc-300">{sslResult.subject}</span>
                    </div>
                  )}
                  {sslResult.validFrom && (
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Valid From</span>
                      <span className="text-zinc-300">{new Date(sslResult.validFrom).toLocaleDateString()}</span>
                    </div>
                  )}
                  {sslResult.validTo && (
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Expires</span>
                      <span className={`${new Date(sslResult.validTo) < new Date(Date.now() + 30 * 86400000) ? "text-orange-400" : "text-zinc-300"}`}>
                        {new Date(sslResult.validTo).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                  {sslResult.daysUntilExpiry !== undefined && (
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Days Until Expiry</span>
                      <span className={`${sslResult.daysUntilExpiry < 30 ? "text-orange-400 font-bold" : "text-green-400"}`}>
                        {sslResult.daysUntilExpiry} days
                      </span>
                    </div>
                  )}
                  {sslResult.protocol && (
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Protocol</span>
                      <span className="text-zinc-300">{sslResult.protocol}</span>
                    </div>
                  )}
                </div>
                {sslResult.warnings?.length > 0 && (
                  <div className="space-y-1">
                    {sslResult.warnings.map((w: string, i: number) => (
                      <div key={i} className="flex items-start gap-2 p-2 rounded bg-yellow-900/20 border border-yellow-800/50">
                        <AlertTriangle className="w-3 h-3 text-yellow-400 mt-0.5 shrink-0" />
                        <span className="text-yellow-300 text-xs">{w}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center text-zinc-600 text-xs py-8">
                <Lock className="w-8 h-8 text-zinc-700 mx-auto mb-2" />
                <p>Enter a domain to check SSL certificate</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Code Review Tab */}
      {secTab === "code" && (
        <div className="flex flex-col flex-1 overflow-hidden">
          <div className="p-3 border-b border-zinc-800/50 space-y-2">
            <div className="flex gap-2">
              <input
                value={codeFilename}
                onChange={(e) => setCodeFilename(e.target.value)}
                placeholder="filename.ts"
                className="w-32 bg-[#161b22] text-zinc-300 text-xs rounded px-2 py-1.5 outline-none border border-zinc-800 focus:border-zinc-600"
              />
              <Button size="sm" onClick={runCodeReview} disabled={reviewing || !codeInput.trim()} className="h-8 text-xs bg-red-600 hover:bg-red-700 text-white ml-auto">
                {reviewing ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Search className="w-3 h-3 mr-1" />}
                Review Code
              </Button>
            </div>
            <textarea
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value)}
              placeholder="Paste your code here for security review..."
              className="w-full h-32 bg-[#161b22] text-zinc-300 text-xs font-mono rounded p-2 outline-none border border-zinc-800 focus:border-zinc-600 resize-none"
            />
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            {codeReviewResult ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded bg-[#161b22]">
                  <div>
                    <p className="text-zinc-300 text-sm font-medium">Review Score</p>
                    <p className="text-zinc-500 text-xs">{codeReviewResult.issues?.length || 0} issues found</p>
                  </div>
                  <div className={`text-2xl font-bold ${(codeReviewResult.overallScore || 0) >= 80 ? "text-green-400" : (codeReviewResult.overallScore || 0) >= 50 ? "text-yellow-400" : "text-red-400"}`}>
                    {codeReviewResult.overallScore || 0}/100
                  </div>
                </div>
                {codeReviewResult.summary && (
                  <p className="text-zinc-400 text-xs">{codeReviewResult.summary}</p>
                )}
                {codeReviewResult.issues?.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-zinc-400 text-xs font-medium">Vulnerabilities</p>
                    {codeReviewResult.issues.map((issue: any, i: number) => (
                      <div key={i} className="p-2 rounded bg-[#161b22] border border-zinc-800">
                        <div className="flex items-center gap-2 mb-1">
                          {severityBadge(issue.severity)}
                          <span className="text-zinc-300 text-xs font-medium">{issue.title}</span>
                        </div>
                        <p className="text-zinc-500 text-[11px] mb-1">{issue.description}</p>
                        {issue.suggestion && <p className="text-blue-400/70 text-[11px]">Fix: {issue.suggestion}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center text-zinc-600 text-xs py-8">
                <FileCode className="w-8 h-8 text-zinc-700 mx-auto mb-2" />
                <p>Paste code above and click Review Code</p>
                <p className="text-zinc-700 mt-1">Checks for SQL injection, XSS, CSRF, and more</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Auto-Fix Tab */}
      {secTab === "fixes" && (
        <div className="flex flex-col flex-1 overflow-hidden">
          <div className="flex items-center justify-between p-3 border-b border-zinc-800/50">
            <span className="text-zinc-400 text-xs">
              {codeReviewResult?.issues?.length || 0} vulnerabilities found
            </span>
            {codeReviewResult?.issues?.length > 0 && (
              <Button
                size="sm"
                onClick={fixAll}
                disabled={fixingAll}
                className="h-7 text-[11px] bg-green-600 hover:bg-green-700 text-white"
              >
                {fixingAll ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <CheckCircle2 className="w-3 h-3 mr-1" />}
                Fix All
              </Button>
            )}
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {!codeReviewResult?.issues?.length ? (
              <div className="text-center text-zinc-600 text-xs py-8">
                <Shield className="w-8 h-8 text-zinc-700 mx-auto mb-2" />
                <p>Run a Code Review first to find vulnerabilities</p>
                <p className="text-zinc-700 mt-1">Then come here to auto-fix them</p>
              </div>
            ) : (
              codeReviewResult.issues.map((issue: any, i: number) => {
                const fixResult = fixResults[issue.title];
                const isFixing = fixing === issue.title;
                return (
                  <div key={i} className="rounded bg-[#161b22] border border-zinc-800 overflow-hidden">
                    <div className="flex items-center justify-between p-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {severityBadge(issue.severity)}
                        <span className="text-zinc-300 text-xs font-medium truncate">{issue.title}</span>
                      </div>
                      {fixResult ? (
                        <span className="flex items-center gap-1 text-green-400 text-[10px] shrink-0">
                          <CheckCircle2 className="w-3 h-3" /> Fixed
                        </span>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => fixSingle(issue)}
                          disabled={isFixing || fixingAll}
                          className="h-6 text-[10px] px-2 bg-green-600/80 hover:bg-green-600 text-white shrink-0"
                        >
                          {isFixing ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : "Fix"}
                        </Button>
                      )}
                    </div>
                    {fixResult && (
                      <div className="border-t border-zinc-800 p-2 space-y-1">
                        <p className="text-zinc-400 text-[11px]">{fixResult.explanation || fixResult.diffSummary}</p>
                        {fixResult.confidence != null && (
                          <div className="flex items-center gap-2">
                            <span className="text-zinc-500 text-[10px]">Confidence:</span>
                            <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${fixResult.confidence >= 80 ? "bg-green-500" : fixResult.confidence >= 50 ? "bg-yellow-500" : "bg-red-500"}`}
                                style={{ width: `${fixResult.confidence}%` }}
                              />
                            </div>
                            <span className="text-zinc-500 text-[10px]">{fixResult.confidence}%</span>
                          </div>
                        )}
                        {fixResult.fixedCode && (
                          <details className="mt-1">
                            <summary className="text-blue-400 text-[10px] cursor-pointer hover:text-blue-300">View patched code</summary>
                            <pre className="mt-1 text-[10px] text-zinc-400 font-mono bg-[#0d1117] rounded p-2 overflow-x-auto max-h-40 overflow-y-auto border border-zinc-800">
                              {fixResult.fixedCode}
                            </pre>
                          </details>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Git Panel Component ─────────────────────────────────────────────────────────────

function GitPanel({ sandboxId }: { sandboxId: number }) {
  const [output, setOutput] = useState("");
  const [args, setArgs] = useState("");
  const [commitMsg, setCommitMsg] = useState("");
  const [workDir, setWorkDir] = useState("/home/sandbox");
  const [running, setRunning] = useState(false);

  const gitMutation = trpc.sandbox.git.useMutation({
    onSuccess: (data) => {
      setOutput(data.output || "");
      setRunning(false);
    },
    onError: (err) => {
      setOutput(err.message);
      setRunning(false);
    },
  });

  const run = (op: "init" | "status" | "add" | "commit" | "push" | "pull" | "log" | "branch" | "diff" | "stash" | "fetch") => {
    setRunning(true);
    setOutput("");
    gitMutation.mutate({ sandboxId, operation: op, args, commitMessage: commitMsg || undefined, workingDirectory: workDir });
  };

  const GIT_ACTIONS: Array<{ op: "init" | "status" | "add" | "commit" | "push" | "pull" | "log" | "branch" | "diff" | "stash" | "fetch"; label: string; color: string }> = [
    { op: "status", label: "Status", color: "text-cyan-400" },
    { op: "log", label: "Log", color: "text-blue-400" },
    { op: "branch", label: "Branches", color: "text-purple-400" },
    { op: "diff", label: "Diff", color: "text-yellow-400" },
    { op: "add", label: "Add All", color: "text-green-400" },
    { op: "commit", label: "Commit", color: "text-emerald-400" },
    { op: "push", label: "Push", color: "text-orange-400" },
    { op: "pull", label: "Pull", color: "text-sky-400" },
    { op: "stash", label: "Stash", color: "text-amber-400" },
    { op: "fetch", label: "Fetch", color: "text-indigo-400" },
    { op: "init", label: "Init", color: "text-zinc-400" },
  ];

  return (
    <div className="flex flex-col h-full bg-[#0d1117] rounded-lg border border-zinc-800 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 bg-[#161b22] border-b border-zinc-800">
        <GitBranch className="w-4 h-4 text-amber-400" />
        <span className="text-zinc-300 text-xs font-medium">Git</span>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        <div>
          <label className="text-zinc-500 text-[10px] mb-1 block">Working Directory</label>
          <input
            value={workDir}
            onChange={(e) => setWorkDir(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 font-mono"
          />
        </div>
        <div>
          <label className="text-zinc-500 text-[10px] mb-1 block">Extra Args (optional)</label>
          <input
            value={args}
            onChange={(e) => setArgs(e.target.value)}
            placeholder="e.g. origin main"
            className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 font-mono"
          />
        </div>
        <div>
          <label className="text-zinc-500 text-[10px] mb-1 block">Commit Message</label>
          <input
            value={commitMsg}
            onChange={(e) => setCommitMsg(e.target.value)}
            placeholder="Update"
            className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200"
          />
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {GIT_ACTIONS.map(({ op, label, color }) => (
            <button
              key={op}
              onClick={() => run(op)}
              disabled={running}
              className={`px-2 py-1.5 rounded text-[10px] font-medium border border-zinc-700 bg-zinc-900 hover:bg-zinc-800 transition-colors ${color} disabled:opacity-50`}
            >
              {label}
            </button>
          ))}
        </div>
        {running && (
          <div className="flex items-center gap-2 text-zinc-500 text-xs">
            <Loader2 className="w-3 h-3 animate-spin" />
            Running...
          </div>
        )}
        {output && (
          <div className="bg-zinc-950 rounded border border-zinc-800 p-2 font-mono text-[10px] text-zinc-300 whitespace-pre-wrap max-h-48 overflow-y-auto">
            {output}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Tests Panel Component ─────────────────────────────────────────────────────────────

function TestsPanel({ sandboxId }: { sandboxId: number }) {
  const [output, setOutput] = useState("");
  const [workDir, setWorkDir] = useState("/home/sandbox");
  const [customCmd, setCustomCmd] = useState("");
  const [running, setRunning] = useState(false);
  const [passed, setPassed] = useState<boolean | null>(null);
  const [duration, setDuration] = useState<number | null>(null);

  const testsMutation = trpc.sandbox.runTests.useMutation({
    onSuccess: (data) => {
      setOutput(data.output || "");
      setPassed(data.passed);
      setDuration(data.durationMs ?? null);
      setRunning(false);
    },
    onError: (err) => {
      setOutput(err.message);
      setPassed(false);
      setRunning(false);
    },
  });

  const lintMutation = trpc.sandbox.lintFile.useMutation({
    onSuccess: (data) => {
      setOutput(data.output || "");
      setPassed(data.passed);
      setRunning(false);
    },
    onError: (err) => {
      setOutput(err.message);
      setPassed(false);
      setRunning(false);
    },
  });

  const formatMutation = trpc.sandbox.formatFile.useMutation({
    onSuccess: (data) => {
      setOutput(data.output || "");
      setPassed(data.success);
      setRunning(false);
    },
    onError: (err) => {
      setOutput(err.message);
      setPassed(false);
      setRunning(false);
    },
  });

  return (
    <div className="flex flex-col h-full bg-[#0d1117] rounded-lg border border-zinc-800 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 bg-[#161b22] border-b border-zinc-800">
        <FlaskConical className="w-4 h-4 text-emerald-400" />
        <span className="text-zinc-300 text-xs font-medium">Tests &amp; Quality</span>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        <div>
          <label className="text-zinc-500 text-[10px] mb-1 block">Working Directory</label>
          <input
            value={workDir}
            onChange={(e) => setWorkDir(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 font-mono"
          />
        </div>
        <div>
          <label className="text-zinc-500 text-[10px] mb-1 block">Custom Test Command (optional)</label>
          <input
            value={customCmd}
            onChange={(e) => setCustomCmd(e.target.value)}
            placeholder="e.g. npm run test:unit"
            className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 font-mono"
          />
        </div>
        <div className="grid grid-cols-1 gap-2">
          <button
            onClick={() => {
              setRunning(true); setOutput(""); setPassed(null); setDuration(null);
              testsMutation.mutate({ sandboxId, workingDirectory: workDir, testCommand: customCmd || undefined });
            }}
            disabled={running}
            className="flex items-center justify-center gap-2 px-3 py-2 rounded text-xs font-medium bg-emerald-900/30 border border-emerald-700/50 text-emerald-400 hover:bg-emerald-900/50 transition-colors disabled:opacity-50"
          >
            {running ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
            Run Tests (Auto-detect)
          </button>
          <button
            onClick={() => {
              const path = prompt("File path to lint:", "/home/sandbox/index.ts");
              if (!path) return;
              setRunning(true); setOutput(""); setPassed(null);
              lintMutation.mutate({ sandboxId, path });
            }}
            disabled={running}
            className="flex items-center justify-center gap-2 px-3 py-2 rounded text-xs font-medium bg-blue-900/30 border border-blue-700/50 text-blue-400 hover:bg-blue-900/50 transition-colors disabled:opacity-50"
          >
            <AlertTriangle className="w-3 h-3" />
            Lint File
          </button>
          <button
            onClick={() => {
              const path = prompt("File path to format:", "/home/sandbox/index.ts");
              if (!path) return;
              setRunning(true); setOutput(""); setPassed(null);
              formatMutation.mutate({ sandboxId, path });
            }}
            disabled={running}
            className="flex items-center justify-center gap-2 px-3 py-2 rounded text-xs font-medium bg-purple-900/30 border border-purple-700/50 text-purple-400 hover:bg-purple-900/50 transition-colors disabled:opacity-50"
          >
            <Wand2 className="w-3 h-3" />
            Format File (Prettier/Black)
          </button>
        </div>
        {passed !== null && (
          <div className={`flex items-center gap-2 text-xs font-medium ${passed ? 'text-emerald-400' : 'text-red-400'}`}>
            {passed ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
            {passed ? 'Passed' : 'Failed'}
            {duration !== null && <span className="text-zinc-500 font-normal ml-1">{(duration / 1000).toFixed(1)}s</span>}
          </div>
        )}
        {output && (
          <div className="bg-zinc-950 rounded border border-zinc-800 p-2 font-mono text-[10px] text-zinc-300 whitespace-pre-wrap max-h-64 overflow-y-auto">
            {output}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Search Panel Component ─────────────────────────────────────────────────────────────

function SearchPanel({ sandboxId }: { sandboxId: number }) {
  const [pattern, setPattern] = useState("");
  const [directory, setDirectory] = useState("/home/sandbox");
  const [glob, setGlob] = useState("");
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const { data, isFetching, refetch } = trpc.sandbox.searchFiles.useQuery(
    { sandboxId, pattern, directory, includeGlob: glob || undefined, caseSensitive },
    { enabled: false }
  );

  const handleSearch = () => {
    if (!pattern.trim()) return;
    setSubmitted(true);
    refetch();
  };

  return (
    <div className="flex flex-col h-full bg-[#0d1117] rounded-lg border border-zinc-800 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 bg-[#161b22] border-b border-zinc-800">
        <SearchCode className="w-4 h-4 text-sky-400" />
        <span className="text-zinc-300 text-xs font-medium">Search Files</span>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        <div>
          <label className="text-zinc-500 text-[10px] mb-1 block">Search Pattern</label>
          <input
            value={pattern}
            onChange={(e) => setPattern(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="e.g. TODO, console.log, import React"
            className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 font-mono"
          />
        </div>
        <div>
          <label className="text-zinc-500 text-[10px] mb-1 block">Directory</label>
          <input
            value={directory}
            onChange={(e) => setDirectory(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 font-mono"
          />
        </div>
        <div>
          <label className="text-zinc-500 text-[10px] mb-1 block">File Filter (glob, optional)</label>
          <input
            value={glob}
            onChange={(e) => setGlob(e.target.value)}
            placeholder="e.g. *.ts, *.py"
            className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 font-mono"
          />
        </div>
        <div className="flex items-center gap-2">
          <input type="checkbox" id="cs" checked={caseSensitive} onChange={(e) => setCaseSensitive(e.target.checked)} className="accent-sky-500" />
          <label htmlFor="cs" className="text-zinc-400 text-xs">Case sensitive</label>
        </div>
        <button
          onClick={handleSearch}
          disabled={!pattern.trim() || isFetching}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded text-xs font-medium bg-sky-900/30 border border-sky-700/50 text-sky-400 hover:bg-sky-900/50 transition-colors disabled:opacity-50"
        >
          {isFetching ? <Loader2 className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
          Search
        </button>
        {submitted && data && (
          <div className="space-y-2">
            <p className="text-zinc-500 text-[10px]">{data.totalFiles} file(s) matched</p>
            {data.matches.slice(0, 50).map((m, i) => (
              <div key={i} className="bg-zinc-950 rounded border border-zinc-800 p-2">
                <p className="text-sky-400 text-[10px] font-mono truncate">{m.file}:{m.line}</p>
                <p className="text-zinc-300 text-[10px] font-mono truncate mt-0.5">{m.text}</p>
              </div>
            ))}
            {data.matches.length === 0 && data.totalFiles > 0 && (
              <p className="text-zinc-500 text-[10px]">Files matched but no line details available.</p>
            )}
            {data.totalFiles === 0 && (
              <p className="text-zinc-500 text-[10px]">No matches found.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Processes Panel Component ─────────────────────────────────────────────────────────────

function ProcessesPanel({ sandboxId }: { sandboxId: number }) {
  const { data, isLoading, refetch, isFetching } = trpc.sandbox.getProcesses.useQuery(
    { sandboxId },
    { refetchInterval: 10_000 }
  );

  const killMutation = trpc.sandbox.killProcess.useMutation({
    onSuccess: () => { toast.success("Process killed"); refetch(); },
    onError: (err) => toast.error(err.message),
  });

  return (
    <div className="flex flex-col h-full bg-[#0d1117] rounded-lg border border-zinc-800 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-[#161b22] border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-pink-400" />
          <span className="text-zinc-300 text-xs font-medium">Processes</span>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="text-zinc-500 hover:text-zinc-300 p-0.5"
          title="Refresh"
        >
          {isFetching ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {isLoading ? (
          <div className="flex items-center justify-center h-16">
            <Loader2 className="w-4 h-4 animate-spin text-zinc-600" />
          </div>
        ) : !data?.processes?.length ? (
          <p className="text-zinc-600 text-xs text-center mt-4">No processes found</p>
        ) : (
          <div className="space-y-1">
            <div className="grid grid-cols-[40px_40px_40px_1fr_24px] gap-1 px-2 py-1 text-[9px] text-zinc-600 font-medium uppercase">
              <span>PID</span><span>CPU%</span><span>MEM%</span><span>Command</span><span></span>
            </div>
            {data.processes.map((proc, i) => (
              <div key={i} className="grid grid-cols-[40px_40px_40px_1fr_24px] gap-1 px-2 py-1 rounded hover:bg-zinc-800/50 items-center">
                <span className="text-zinc-400 text-[10px] font-mono">{proc.pid}</span>
                <span className="text-zinc-400 text-[10px]">{proc.cpu}</span>
                <span className="text-zinc-400 text-[10px]">{proc.mem}</span>
                <span className="text-zinc-300 text-[10px] font-mono truncate" title={proc.command}>{proc.command}</span>
                <button
                  onClick={() => {
                    const pid = parseInt(proc.pid, 10);
                    if (!isNaN(pid) && confirm(`Kill PID ${pid}?`)) {
                      killMutation.mutate({ sandboxId, pid });
                    }
                  }}
                  className="text-zinc-600 hover:text-red-400 transition-colors"
                  title="Kill process"
                >
                  <StopCircle className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Sandbox Settings Component ─────────────────────────────────────────────────────────

function SandboxSettings({
  sandboxId,
  onReset,
  onDelete,
}: {
  sandboxId: number;
  onReset: () => void;
  onDelete: () => void;
}) {
  const utils = trpc.useUtils();
  const { data: sandbox } = trpc.sandbox.get.useQuery({ sandboxId });
  const [newName, setNewName] = useState("");
  const [isEditingName, setIsEditingName] = useState(false);

  const persistMutation = trpc.sandbox.persist.useMutation({
    onSuccess: () => toast.success("Workspace saved to cloud"),
    onError: (err) => toast.error(err.message),
  });

  const renameMutation = trpc.sandbox.rename.useMutation({
    onSuccess: () => {
      toast.success("Sandbox renamed");
      utils.sandbox.get.invalidate({ sandboxId });
      utils.sandbox.list.invalidate();
      setIsEditingName(false);
    },
    onError: (err) => toast.error(err.message),
  });

  const execMutation = trpc.sandbox.exec.useMutation();

  return (
    <div className="flex flex-col h-full bg-[#0d1117] rounded-lg border border-zinc-800 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 bg-[#161b22] border-b border-zinc-800">
        <Settings className="w-4 h-4 text-zinc-400" />
        <span className="text-zinc-300 text-xs font-medium">Settings</span>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {/* Info */}
        <div className="space-y-2">
          <p className="text-zinc-400 text-xs font-medium">Sandbox Info</p>
          <div className="bg-[#161b22] rounded p-3 space-y-2 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-zinc-500">Name</span>
              {isEditingName ? (
                <div className="flex items-center gap-1">
                  <Input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="h-6 text-xs bg-[#0d1117] border-zinc-700 text-zinc-200 w-32"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && newName.trim()) renameMutation.mutate({ sandboxId, name: newName.trim() });
                      if (e.key === "Escape") setIsEditingName(false);
                    }}
                    autoFocus
                  />
                  <button
                    onClick={() => { if (newName.trim()) renameMutation.mutate({ sandboxId, name: newName.trim() }); }}
                    className="text-green-400 hover:text-green-300 p-0.5"
                    disabled={renameMutation.isPending}
                  >
                    {renameMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                  </button>
                  <button onClick={() => setIsEditingName(false)} className="text-zinc-500 hover:text-zinc-300 p-0.5">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1">
                  <span className="text-zinc-300">{sandbox?.name}</span>
                  <button
                    onClick={() => { setNewName(sandbox?.name || ""); setIsEditingName(true); }}
                    className="text-zinc-600 hover:text-zinc-400 p-0.5"
                    title="Rename sandbox"
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">OS</span>
              <span className="text-zinc-300">{sandbox?.osType || "Linux"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Status</span>
              <span className="text-green-400">{sandbox?.status || "running"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Memory</span>
              <span className="text-zinc-300">{sandbox?.memoryMb || 512}MB</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Disk</span>
              <span className="text-zinc-300">{sandbox?.diskMb || 2048}MB</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Commands Run</span>
              <span className="text-zinc-300">{sandbox?.totalCommands || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Last Active</span>
              <span className="text-zinc-300">
                {sandbox?.lastActiveAt ? new Date(sandbox.lastActiveAt).toLocaleString() : "Never"}
              </span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-2">
          <p className="text-zinc-400 text-xs font-medium">Actions</p>
          <div className="space-y-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => persistMutation.mutate({ sandboxId })}
              disabled={persistMutation.isPending}
              className="w-full justify-start text-xs border-zinc-700 text-zinc-300 hover:bg-zinc-800"
            >
              {persistMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : <Upload className="w-3 h-3 mr-2" />}
              Save Workspace to Cloud
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (confirm("Reset workspace? All files will be deleted and a fresh workspace will be created.")) {
                  execMutation.mutate({
                    sandboxId,
                    command: "rm -rf /home/sandbox/* /home/sandbox/.* 2>/dev/null; echo 'Workspace reset'",
                    workingDirectory: "/home/sandbox",
                  });
                  toast.success("Workspace reset");
                  onReset();
                }
              }}
              className="w-full justify-start text-xs border-zinc-700 text-yellow-400 hover:bg-yellow-950/30"
            >
              <RotateCcw className="w-3 h-3 mr-2" />
              Reset Workspace
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (confirm("Delete this sandbox permanently? This cannot be undone.")) {
                  onDelete();
                }
              }}
              className="w-full justify-start text-xs border-zinc-700 text-red-400 hover:bg-red-950/30"
            >
              <Trash2 className="w-3 h-3 mr-2" />
              Delete Sandbox
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Sandbox Page ──────────────────────────────────────────────

export default function SandboxPage() {
  const { user, loading: authLoading } = useAuth();
  const [activeSandboxId, setActiveSandboxId] = useState<number | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newSandboxName, setNewSandboxName] = useState("");
  const [fileRefreshKey, setFileRefreshKey] = useState(0);
  const [activePanel, setActivePanel] = useState<SidePanel>("files");
  const [editingFile, setEditingFile] = useState<string | null>(null);
  const [terminalHeight, setTerminalHeight] = useState(65); // percentage

  const { data: sandboxList, isLoading: listLoading } =
    trpc.sandbox.list.useQuery(undefined, { enabled: !!user });

  const utils = trpc.useUtils();

  const createMutation = trpc.sandbox.create.useMutation({
    onSuccess: (sandbox) => {
      setActiveSandboxId(sandbox.id);
      setShowNewForm(false);
      setNewSandboxName("");
      toast.success(`Sandbox "${sandbox.name}" created`);
      utils.sandbox.list.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.sandbox.delete.useMutation({
    onSuccess: () => {
      setActiveSandboxId(null);
      toast.success("Sandbox deleted");
      utils.sandbox.list.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  useEffect(() => {
    if (sandboxList && sandboxList.length > 0 && !activeSandboxId) {
      setActiveSandboxId(sandboxList[0].id);
    }
  }, [sandboxList, activeSandboxId]);

  const sidePanels: Array<{ id: SidePanel; icon: any; label: string; color: string }> = [
    { id: "files", icon: FolderTree, label: "Files", color: "text-cyan-400" },
    { id: "editor", icon: FileCode, label: "Editor", color: "text-blue-400" },
    { id: "search", icon: SearchCode, label: "Search", color: "text-sky-400" },
    { id: "git", icon: GitBranch, label: "Git", color: "text-amber-400" },
    { id: "tests", icon: FlaskConical, label: "Tests", color: "text-emerald-400" },
    { id: "packages", icon: Package, label: "Packages", color: "text-green-400" },
    { id: "env", icon: Variable, label: "Env Vars", color: "text-purple-400" },
    { id: "processes", icon: Activity, label: "Processes", color: "text-pink-400" },
    { id: "history", icon: Clock, label: "History", color: "text-orange-400" },
    { id: "security", icon: Shield, label: "Security", color: "text-red-400" },
    { id: "settings", icon: Settings, label: "Settings", color: "text-zinc-400" },
  ];

  if (authLoading || listLoading) {
    return (
      <div className="flex items-center justify-center h-full bg-[#010409]">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-cyan-400 mx-auto mb-3" />
          <p className="text-zinc-500 text-sm">Loading sandbox...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#010409]">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-800 bg-[#0d1117]">
        <div className="flex items-center gap-3">
          <TerminalIcon className="w-5 h-5 text-cyan-400" />
          <h1 className="text-base font-semibold text-zinc-100">Sandbox</h1>
          <span className="text-[10px] text-zinc-500 bg-zinc-800/80 px-2 py-0.5 rounded font-medium">
            PERSISTENT LINUX
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => setShowNewForm(true)}
            className="h-7 text-xs bg-cyan-600 hover:bg-cyan-700 text-white"
          >
            <Plus className="w-3 h-3 mr-1" />
            New Sandbox
          </Button>
        </div>
      </div>

      {/* Sandbox tabs */}
      {sandboxList && sandboxList.length > 0 && (
        <div className="flex items-center gap-1 px-4 py-1 border-b border-zinc-800 bg-[#0d1117] overflow-x-auto">
          {sandboxList.map((sb) => (
            <button
              key={sb.id}
              onClick={() => {
                setActiveSandboxId(sb.id);
                setEditingFile(null);
              }}
              className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs transition-colors shrink-0 ${
                activeSandboxId === sb.id
                  ? "bg-cyan-600/20 text-cyan-400 border border-cyan-600/40"
                  : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50 border border-transparent"
              }`}
            >
              <TerminalIcon className="w-3 h-3" />
              {sb.name}
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 ml-1" />
            </button>
          ))}
        </div>
      )}

      {/* New sandbox form */}
      {showNewForm && (
        <div className="flex items-center gap-2 px-4 py-2 border-b border-zinc-800 bg-[#161b22]">
          <Input
            value={newSandboxName}
            onChange={(e) => setNewSandboxName(e.target.value)}
            placeholder="Sandbox name..."
            className="h-7 text-xs bg-[#0d1117] border-zinc-700 text-zinc-200 max-w-xs"
            onKeyDown={(e) => {
              if (e.key === "Enter" && newSandboxName.trim()) {
                createMutation.mutate({ name: newSandboxName.trim() });
              }
            }}
            autoFocus
          />
          <Button
            size="sm"
            onClick={() => {
              if (newSandboxName.trim()) {
                createMutation.mutate({ name: newSandboxName.trim() });
              }
            }}
            disabled={createMutation.isPending || !newSandboxName.trim()}
            className="h-7 text-xs bg-cyan-600 hover:bg-cyan-700"
          >
            {createMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Create"}
          </Button>
          <button onClick={() => setShowNewForm(false)} className="text-zinc-500 hover:text-zinc-300 p-1">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex min-h-0">
        {activeSandboxId ? (
          <>
            {/* Side panel selector */}
            <div className="w-12 bg-[#0d1117] border-r border-zinc-800 flex flex-col items-center py-2 gap-1">
              {sidePanels.map((panel) => (
                <button
                  key={panel.id}
                  onClick={() => setActivePanel(panel.id)}
                  className={`w-9 h-9 rounded flex items-center justify-center transition-colors ${
                    activePanel === panel.id
                      ? "bg-zinc-800 " + panel.color
                      : "text-zinc-600 hover:text-zinc-400 hover:bg-zinc-800/50"
                  }`}
                  title={panel.label}
                >
                  <panel.icon className="w-4 h-4" />
                </button>
              ))}
            </div>

            {/* Terminal + Editor area */}
            <div className="flex-1 flex min-h-0">
              {/* Terminal */}
              <div className="flex-[6] flex flex-col min-h-0">
                {editingFile ? (
                  <>
                    {/* Split view: editor top, terminal bottom */}
                    <div className="flex-1 p-2 pb-1 min-h-0">
                      <CodeEditor
                        sandboxId={activeSandboxId}
                        filePath={editingFile}
                        onClose={() => setEditingFile(null)}
                      />
                    </div>
                    <div className="h-[35%] p-2 pt-1 min-h-0">
                      <WebTerminal
                        sandboxId={activeSandboxId}
                        onCommandExecuted={() => setFileRefreshKey((k) => k + 1)}
                      />
                    </div>
                  </>
                ) : (
                  <div className="flex-1 p-2 min-h-0">
                    <WebTerminal
                      sandboxId={activeSandboxId}
                      onCommandExecuted={() => setFileRefreshKey((k) => k + 1)}
                    />
                  </div>
                )}
              </div>

              {/* Side panel */}
              <div className="w-72 p-2 pl-0 min-h-0">
                {activePanel === "files" && (
                  <FileBrowser
                    sandboxId={activeSandboxId}
                    refreshKey={fileRefreshKey}
                    onFileSelect={(path) => {
                      setEditingFile(path);
                      setActivePanel("editor");
                    }}
                  />
                )}
                {activePanel === "editor" && editingFile ? (
                  <div className="flex flex-col h-full bg-[#0d1117] rounded-lg border border-zinc-800 overflow-hidden">
                    <div className="flex items-center gap-2 px-3 py-2 bg-[#161b22] border-b border-zinc-800">
                      <FileCode className="w-4 h-4 text-blue-400" />
                      <span className="text-zinc-300 text-xs font-medium">Open Files</span>
                    </div>
                    <div className="flex-1 p-3">
                      <div className="flex items-center gap-2 px-2 py-1.5 rounded bg-zinc-800/50 text-xs">
                        <FileCode className="w-3 h-3 text-blue-400" />
                        <span className="text-zinc-300 truncate">{editingFile.split("/").pop()}</span>
                        <button onClick={() => setEditingFile(null)} className="ml-auto text-zinc-600 hover:text-zinc-300">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                      <p className="text-zinc-600 text-[10px] mt-3 px-2">Click a file in the Files panel to open it in the editor.</p>
                    </div>
                  </div>
                ) : activePanel === "editor" ? (
                  <div className="flex flex-col h-full bg-[#0d1117] rounded-lg border border-zinc-800 items-center justify-center">
                    <FileCode className="w-8 h-8 text-zinc-700 mb-2" />
                    <p className="text-zinc-600 text-xs">No file open</p>
                    <p className="text-zinc-700 text-[10px] mt-1">Select a file from the Files panel</p>
                  </div>
                ) : null}
                {activePanel === "packages" && <PackageManager sandboxId={activeSandboxId} />}
                {activePanel === "env" && <EnvVarsManager sandboxId={activeSandboxId} />}
                {activePanel === "history" && (
                  <CommandHistory sandboxId={activeSandboxId} />
                )}
                {activePanel === "security" && <SecurityScanner sandboxId={activeSandboxId} />}

                {/* ── Git Panel ── */}
                {activePanel === "git" && (
                  <GitPanel sandboxId={activeSandboxId} />
                )}

                {/* ── Tests Panel ── */}
                {activePanel === "tests" && (
                  <TestsPanel sandboxId={activeSandboxId} />
                )}

                {/* ── Search Panel ── */}
                {activePanel === "search" && (
                  <SearchPanel sandboxId={activeSandboxId} />
                )}

                {/* ── Processes Panel ── */}
                {activePanel === "processes" && (
                  <ProcessesPanel sandboxId={activeSandboxId} />
                )}

                {activePanel === "settings" && (
                  <SandboxSettings
                    sandboxId={activeSandboxId}
                    onReset={() => setFileRefreshKey((k) => k + 1)}
                    onDelete={() => deleteMutation.mutate({ sandboxId: activeSandboxId })}
                  />
                )}
              </div>
            </div>
          </>
        ) : (
          /* Empty state */
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-zinc-500">
            <div className="w-20 h-20 rounded-2xl bg-[#0d1117] border border-zinc-800 flex items-center justify-center">
              <TerminalIcon className="w-10 h-10 text-zinc-700" />
            </div>
            <div className="text-center">
              <p className="text-lg font-medium text-zinc-300">No sandbox yet</p>
              <p className="text-sm mt-1 text-zinc-500 max-w-md">
                Create a persistent Linux sandbox to run commands, write code, install packages, and build applications.
              </p>
            </div>
            <div className="flex gap-3 mt-2">
              <Button
                onClick={() => {
                  setNewSandboxName("My Workspace");
                  createMutation.mutate({ name: "My Workspace" });
                }}
                className="bg-cyan-600 hover:bg-cyan-700 text-white"
              >
                <Plus className="w-4 h-4 mr-2" />
                Quick Start
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowNewForm(true)}
                className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
              >
                Custom Name
              </Button>
            </div>
            <AffiliateRecommendations context="sandbox" variant="inline" className="mt-4" />
            <div className="grid grid-cols-3 gap-4 mt-6 max-w-lg">
              {[
                { icon: TerminalIcon, label: "Terminal", desc: "Run any command" },
                { icon: FileCode, label: "Code Editor", desc: "Monaco editor built-in" },
                { icon: Package, label: "Packages", desc: "npm, pip, apt" },
                { icon: Variable, label: "Env Vars", desc: "Manage secrets" },
                { icon: Shield, label: "Security", desc: "Scan websites" },
                { icon: Save, label: "Persistent", desc: "Files survive sessions" },
              ].map((feat) => (
                <div key={feat.label} className="text-center p-3 rounded-lg bg-[#0d1117] border border-zinc-800/50">
                  <feat.icon className="w-5 h-5 text-zinc-600 mx-auto mb-1.5" />
                  <p className="text-zinc-400 text-xs font-medium">{feat.label}</p>
                  <p className="text-zinc-600 text-[10px] mt-0.5">{feat.desc}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
