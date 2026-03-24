/**
 * LinkenSphere Integration — Manage antidetect browser sessions directly from Titan.
 *
 * Architecture (v2): All API calls now go through the Titan backend proxy router
 * (linkenSphere tRPC router) instead of direct browser-to-localhost calls.
 * This eliminates CORS issues, secures the API port server-side, and enables
 * credit deduction for session operations.
 */
import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Globe,
  Play,
  Square,
  Plus,
  RefreshCw,
  Settings,
  Shield,
  Fingerprint,
  Monitor,
  Wifi,
  WifiOff,
  Loader2,
  Copy,
  Code2,
  Eye,
  EyeOff,
  Zap,
  Server,
  AlertTriangle,
  Terminal,
  LogIn,
  LogOut,
  Save,
} from "lucide-react";
import { trpc } from "@/lib/trpc";

// ─── Types ───────────────────────────────────────────────────────────────────
interface LSSession {
  name: string;
  uuid: string;
  status?: string;
  proxy?: {
    protocol?: string;
    host?: string;
    port?: number;
  };
  debug_port?: number;
}

type ConnectionStatus = "disconnected" | "connecting" | "connected" | "error";

// ─── Helpers ─────────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status?: string }) {
  const map: Record<string, { color: string; label: string }> = {
    running: { color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30", label: "Running" },
    stopped: { color: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30", label: "Stopped" },
    starting: { color: "bg-blue-500/20 text-blue-400 border-blue-500/30", label: "Starting" },
    stopping: { color: "bg-orange-500/20 text-orange-400 border-orange-500/30", label: "Stopping" },
    warming_up: { color: "bg-amber-500/20 text-amber-400 border-amber-500/30", label: "Warming Up" },
    automationRunning: { color: "bg-purple-500/20 text-purple-400 border-purple-500/30", label: "Automation" },
  };
  const s = map[status || ""] || { color: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30", label: status || "Unknown" };
  return <Badge variant="outline" className={`${s.color} text-[10px] font-medium`}>{s.label}</Badge>;
}

function generateScript(lang: "python" | "node", debugPort: string): string {
  if (lang === "python") {
    return `from selenium import webdriver
from selenium.webdriver.chrome.options import Options

options = Options()
options.debugger_address = f"127.0.0.1:${debugPort || "DEBUG_PORT"}"

driver = webdriver.Chrome(options=options)
print("Connected to session:", driver.title)

# Your automation code here
driver.get("https://example.com")
print(driver.title)`;
  }
  return `const puppeteer = require("puppeteer-core");

(async () => {
  const browser = await puppeteer.connect({
    browserURL: "http://127.0.0.1:${debugPort || "DEBUG_PORT"}",
    defaultViewport: null,
  });
  const pages = await browser.pages();
  const page = pages[0];
  console.log("Connected to:", await page.title());

  // Your automation code here
  await page.goto("https://example.com");
  console.log(await page.title());
})();`;
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).then(() => toast.success("Copied to clipboard"));
}

// ─── Main Component ──────────────────────────────────────────────────────────
export default function LinkenSpherePage() {
  const [portInput, setPortInput] = useState("40080");
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("disconnected");
  const [showSettings, setShowSettings] = useState(false);

  const [showAuthDialog, setShowAuthDialog] = useState(false);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [sessions, setSessions] = useState<LSSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createCount, setCreateCount] = useState(1);

  const [showStartDialog, setShowStartDialog] = useState(false);
  const [startUuid, setStartUuid] = useState("");
  const [startHeadless, setStartHeadless] = useState(false);
  const [startDebugPort, setStartDebugPort] = useState("");

  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [renameUuid, setRenameUuid] = useState("");
  const [renameName, setRenameName] = useState("");

  const [showScriptDialog, setShowScriptDialog] = useState(false);
  const [scriptPort, setScriptPort] = useState("12345");
  const [scriptLang, setScriptLang] = useState<"python" | "node">("python");

  // ─── tRPC ─────────────────────────────────────────────────────────────────
  const portQuery = trpc.linkenSphere.getPort.useQuery(undefined, { retry: false });

  const savePortMutation = trpc.linkenSphere.savePort.useMutation({
    onSuccess: (data) => {
      toast.success(`Port saved: ${data.port}`);
      setShowSettings(false);
    },
    onError: (err) => toast.error("Failed to save port: " + err.message),
  });

  const testConnectionMutation = trpc.linkenSphere.testConnection.useMutation({
    onSuccess: () => {
      setConnectionStatus("connected");
      toast.success("Connected to LinkenSphere");
      sessionsQuery.refetch();
    },
    onError: (err) => {
      setConnectionStatus("error");
      toast.error(err.message);
    },
  });

  const sessionsQuery = trpc.linkenSphere.getSessions.useQuery(
    { status: statusFilter === "all" ? undefined : statusFilter, proxyInfo: true },
    {
      enabled: connectionStatus === "connected",
      refetchInterval: connectionStatus === "connected" ? 10_000 : false,
      retry: false,
    }
  );

  // Sync sessions from query data
  useEffect(() => {
    if (sessionsQuery.data && Array.isArray(sessionsQuery.data)) {
      setSessions(sessionsQuery.data as LSSession[]);
    }
    if (sessionsQuery.isError) {
      setConnectionStatus("error");
    }
  }, [sessionsQuery.data, sessionsQuery.isError]);

  const signInMutation = trpc.linkenSphere.signIn.useMutation({
    onSuccess: () => {
      toast.success("Signed in to LinkenSphere");
      setShowAuthDialog(false);
      setAuthEmail("");
      setAuthPassword("");
      sessionsQuery.refetch();
    },
    onError: (err) => toast.error("Sign in failed: " + err.message),
  });

  const signOutMutation = trpc.linkenSphere.signOut.useMutation({
    onSuccess: () => {
      toast.success("Signed out");
      setSessions([]);
      setConnectionStatus("disconnected");
    },
    onError: (err) => toast.error(err.message),
  });

  const createSessionsMutation = trpc.linkenSphere.createQuickSessions.useMutation({
    onSuccess: () => {
      toast.success(`Created ${createCount} session(s)`);
      setShowCreateDialog(false);
      sessionsQuery.refetch();
    },
    onError: (err) => toast.error("Failed to create sessions: " + err.message),
  });

  const startSessionMutation = trpc.linkenSphere.startSession.useMutation({
    onSuccess: () => {
      toast.success("Session started");
      setShowStartDialog(false);
      sessionsQuery.refetch();
    },
    onError: (err) => toast.error("Failed to start: " + err.message),
  });

  const stopSessionMutation = trpc.linkenSphere.stopSession.useMutation({
    onSuccess: () => {
      toast.success("Session stopped");
      sessionsQuery.refetch();
    },
    onError: (err) => toast.error("Failed to stop: " + err.message),
  });

  const renameSessionMutation = trpc.linkenSphere.setSessionName.useMutation({
    onSuccess: () => {
      toast.success("Session renamed");
      setShowRenameDialog(false);
      sessionsQuery.refetch();
    },
    onError: (err) => toast.error("Failed to rename: " + err.message),
  });

  // ─── Effects ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (portQuery.data?.port) setPortInput(String(portQuery.data.port));
  }, [portQuery.data]);

  // ─── Handlers ─────────────────────────────────────────────────────────────
  const testConnection = useCallback(() => {
    setConnectionStatus("connecting");
    testConnectionMutation.mutate({ port: parseInt(portInput) || undefined });
  }, [portInput, testConnectionMutation]);

  const handleSavePort = () => {
    const port = parseInt(portInput);
    if (isNaN(port) || port < 1024 || port > 65535) {
      toast.error("Port must be between 1024 and 65535");
      return;
    }
    savePortMutation.mutate({ port });
  };

  const handleSignIn = () => {
    if (!authEmail || !authPassword) return;
    signInMutation.mutate({ email: authEmail, password: authPassword, port: parseInt(portInput) || undefined });
  };

  const handleCreate = () => {
    createSessionsMutation.mutate({ count: createCount, port: parseInt(portInput) || undefined });
  };

  const handleStart = () => {
    if (!startUuid) return;
    startSessionMutation.mutate({
      uuid: startUuid,
      headless: startHeadless,
      debugPort: startDebugPort ? parseInt(startDebugPort) : undefined,
      port: parseInt(portInput) || undefined,
    });
  };

  const handleStop = (uuid: string) => {
    stopSessionMutation.mutate({ uuid, port: parseInt(portInput) || undefined });
  };

  const handleRename = () => {
    if (!renameUuid || !renameName.trim()) return;
    renameSessionMutation.mutate({ uuid: renameUuid, name: renameName.trim(), port: parseInt(portInput) || undefined });
  };

  // ─── Derived ──────────────────────────────────────────────────────────────
  const filteredSessions = statusFilter === "all" ? sessions : sessions.filter((s) => s.status === statusFilter);
  const runningCount = sessions.filter((s) => s.status === "running").length;
  const stoppedCount = sessions.filter((s) => s.status === "stopped").length;
  const isLoading = sessionsQuery.isFetching;

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border/50 bg-card/30 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
                <Fingerprint className="h-5 w-5 text-cyan-400" />
              </div>
              <div>
                <h1 className="text-lg font-semibold">Linken Sphere</h1>
                <p className="text-xs text-muted-foreground">Antidetect browser session management</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium ${
                connectionStatus === "connected" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" :
                connectionStatus === "connecting" ? "border-blue-500/30 bg-blue-500/10 text-blue-400" :
                connectionStatus === "error" ? "border-red-500/30 bg-red-500/10 text-red-400" :
                "border-zinc-500/30 bg-zinc-500/10 text-zinc-400"
              }`}>
                {connectionStatus === "connected" ? <><Wifi className="h-3 w-3" /> Connected</> :
                 connectionStatus === "connecting" ? <><Loader2 className="h-3 w-3 animate-spin" /> Connecting</> :
                 connectionStatus === "error" ? <><WifiOff className="h-3 w-3" /> Error</> :
                 <><WifiOff className="h-3 w-3" /> Disconnected</>}
              </div>
              <Button variant="outline" size="sm" onClick={() => setShowSettings(true)} className="gap-1.5">
                <Settings className="h-3.5 w-3.5" /> Port: {portInput}
              </Button>
              <Button variant="outline" size="sm" onClick={testConnection} disabled={connectionStatus === "connecting"} className="gap-1.5">
                <RefreshCw className={`h-3.5 w-3.5 ${connectionStatus === "connecting" ? "animate-spin" : ""}`} />
                {connectionStatus === "connected" ? "Refresh" : "Connect"}
              </Button>
              {connectionStatus === "connected" ? (
                <Button variant="outline" size="sm" onClick={() => signOutMutation.mutate({ port: parseInt(portInput) || undefined })} className="gap-1.5 text-red-400 border-red-500/30 hover:bg-red-500/10">
                  <LogOut className="h-3.5 w-3.5" /> Sign Out
                </Button>
              ) : (
                <Button variant="outline" size="sm" onClick={() => setShowAuthDialog(true)} className="gap-1.5">
                  <LogIn className="h-3.5 w-3.5" /> Sign In
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Error Banner */}
        {connectionStatus === "error" && (
          <Card className="border-red-500/30 bg-red-500/5">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-red-400 mt-0.5 shrink-0" />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-red-400">Cannot connect to LinkenSphere</p>
                  <p className="text-xs text-muted-foreground">
                    Make sure LinkenSphere is running on your computer and the API port is set to <strong>{portInput}</strong> in Preferences.
                  </p>
                  <div className="flex gap-2 pt-2">
                    <Button size="sm" variant="outline" onClick={testConnection} className="gap-1.5 text-xs"><RefreshCw className="h-3 w-3" /> Retry</Button>
                    <Button size="sm" variant="outline" onClick={() => setShowSettings(true)} className="gap-1.5 text-xs"><Settings className="h-3 w-3" /> Change Port</Button>
                    <Button size="sm" variant="outline" onClick={() => setShowAuthDialog(true)} className="gap-1.5 text-xs"><LogIn className="h-3 w-3" /> Sign In</Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Total Sessions", value: sessions.length, icon: Monitor, color: "text-cyan-400" },
            { label: "Running", value: runningCount, icon: Play, color: "text-emerald-400" },
            { label: "Stopped", value: stoppedCount, icon: Square, color: "text-zinc-400" },
            { label: "API Port", value: portInput, icon: Server, color: "text-cyan-400" },
          ].map((stat) => (
            <Card key={stat.label} className="bg-card/50">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{stat.label}</p>
                    <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
                  </div>
                  <stat.icon className={`h-8 w-8 ${stat.color}/30`} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Tabs */}
        <Tabs defaultValue="sessions" className="space-y-4">
          <div className="flex items-center justify-between">
            <TabsList>
              <TabsTrigger value="sessions" className="gap-1.5"><Monitor className="h-3.5 w-3.5" /> Sessions</TabsTrigger>
              <TabsTrigger value="automation" className="gap-1.5"><Code2 className="h-3.5 w-3.5" /> Automation</TabsTrigger>
            </TabsList>
            <div className="flex items-center gap-2">
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="text-xs px-2 py-1.5 rounded-md border border-border bg-background">
                <option value="all">All Status</option>
                <option value="running">Running</option>
                <option value="stopped">Stopped</option>
                <option value="starting">Starting</option>
              </select>
              <Button size="sm" variant="outline" onClick={() => sessionsQuery.refetch()} disabled={isLoading || connectionStatus !== "connected"} className="gap-1.5">
                <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} /> Refresh
              </Button>
              {connectionStatus === "connected" && (
                <Button size="sm" onClick={() => setShowCreateDialog(true)} className="gap-1.5 bg-cyan-600 hover:bg-cyan-700">
                  <Plus className="h-3.5 w-3.5" /> Quick Create
                </Button>
              )}
            </div>
          </div>

          <TabsContent value="sessions" className="space-y-3">
            {isLoading && sessions.length === 0 ? (
              <Card className="bg-card/50"><CardContent className="p-12 flex flex-col items-center justify-center"><Loader2 className="h-8 w-8 text-cyan-400 animate-spin mb-3" /><p className="text-sm text-muted-foreground">Loading sessions...</p></CardContent></Card>
            ) : connectionStatus !== "connected" ? (
              <Card className="bg-card/50">
                <CardContent className="p-12 flex flex-col items-center justify-center">
                  <Shield className="h-12 w-12 text-muted-foreground/30 mb-3" />
                  <p className="text-sm font-medium text-muted-foreground">Not connected to LinkenSphere</p>
                  <p className="text-xs text-muted-foreground/70 mt-1">Click Connect to establish a connection to your local LinkenSphere instance</p>
                  <Button size="sm" onClick={testConnection} className="mt-4 gap-1.5 bg-cyan-600 hover:bg-cyan-700"><Wifi className="h-3.5 w-3.5" /> Connect Now</Button>
                </CardContent>
              </Card>
            ) : filteredSessions.length === 0 ? (
              <Card className="bg-card/50">
                <CardContent className="p-12 flex flex-col items-center justify-center">
                  <Monitor className="h-12 w-12 text-muted-foreground/30 mb-3" />
                  <p className="text-sm font-medium text-muted-foreground">No sessions found</p>
                  <Button size="sm" onClick={() => setShowCreateDialog(true)} className="mt-4 gap-1.5 bg-cyan-600 hover:bg-cyan-700"><Plus className="h-3.5 w-3.5" /> Create Session</Button>
                </CardContent>
              </Card>
            ) : filteredSessions.map((session) => (
              <Card key={session.uuid} className={`bg-card/50 transition-all ${selectedSession === session.uuid ? "border-cyan-500/50 ring-1 ring-cyan-500/20" : "hover:border-border/80"}`}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0 cursor-pointer flex-1" onClick={() => setSelectedSession(selectedSession === session.uuid ? null : session.uuid)}>
                      <div className={`p-2 rounded-lg ${session.status === "running" ? "bg-emerald-500/10" : "bg-zinc-500/10"}`}>
                        <Globe className={`h-4 w-4 ${session.status === "running" ? "text-emerald-400" : "text-zinc-500"}`} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium truncate">{session.name || "Unnamed Session"}</p>
                          <StatusBadge status={session.status} />
                        </div>
                        <p className="text-[10px] text-muted-foreground font-mono truncate mt-0.5">{session.uuid}</p>
                        {session.proxy?.protocol && (
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            Proxy: {session.proxy.protocol}{session.proxy.host ? ` — ${session.proxy.host}:${session.proxy.port}` : ""}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {session.status === "stopped" ? (
                        <Button size="sm" variant="outline" onClick={() => { setStartUuid(session.uuid); setShowStartDialog(true); }} className="gap-1 text-xs text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10">
                          <Play className="h-3 w-3" /> Start
                        </Button>
                      ) : session.status === "running" ? (
                        <Button size="sm" variant="outline" onClick={() => handleStop(session.uuid)} disabled={stopSessionMutation.isPending} className="gap-1 text-xs text-red-400 border-red-500/30 hover:bg-red-500/10">
                          <Square className="h-3 w-3" /> Stop
                        </Button>
                      ) : null}
                      <Button size="sm" variant="ghost" onClick={() => { setRenameUuid(session.uuid); setRenameName(session.name || ""); setShowRenameDialog(true); }} title="Rename">
                        <Terminal className="h-3.5 w-3.5" />
                      </Button>
                      {session.debug_port && (
                        <Button size="sm" variant="ghost" onClick={() => { setScriptPort(String(session.debug_port)); setShowScriptDialog(true); }} title="Automation Script">
                          <Code2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                  {selectedSession === session.uuid && (
                    <div className="mt-3 pt-3 border-t border-border/50 grid grid-cols-2 sm:grid-cols-3 gap-3">
                      <div className="space-y-0.5">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">UUID</p>
                        <p className="text-xs font-mono truncate">{session.uuid}</p>
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Status</p>
                        <StatusBadge status={session.status} />
                      </div>
                      {session.debug_port && (
                        <div className="space-y-0.5">
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Debug Port</p>
                          <p className="text-xs font-mono">{session.debug_port}</p>
                        </div>
                      )}
                      {session.proxy?.host && (
                        <div className="space-y-0.5">
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Proxy</p>
                          <p className="text-xs font-mono">{session.proxy.protocol}://{session.proxy.host}:{session.proxy.port}</p>
                        </div>
                      )}
                      <div className="col-span-full flex gap-2 pt-1">
                        <Button size="sm" variant="outline" onClick={() => copyToClipboard(session.uuid)} className="gap-1 text-xs"><Copy className="h-3 w-3" /> Copy UUID</Button>
                        {session.debug_port && (
                          <Button size="sm" variant="outline" onClick={() => { setScriptPort(String(session.debug_port)); setShowScriptDialog(true); }} className="gap-1 text-xs"><Code2 className="h-3 w-3" /> Generate Script</Button>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="automation" className="space-y-4">
            <Card className="bg-card/50">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2"><Code2 className="h-4 w-4 text-cyan-400" /> Automation Script Generator</CardTitle>
                <CardDescription className="text-xs">Generate ready-to-use scripts that connect to your LinkenSphere sessions via DevTools Protocol.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs">Debug Port</Label>
                    <Input value={scriptPort} onChange={(e) => setScriptPort(e.target.value)} placeholder="12345" className="text-sm" />
                    <p className="text-[10px] text-muted-foreground">The debug port assigned when starting a session</p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Language</Label>
                    <div className="flex gap-2">
                      <Button size="sm" variant={scriptLang === "python" ? "default" : "outline"} onClick={() => setScriptLang("python")} className="flex-1 text-xs">Python (Selenium)</Button>
                      <Button size="sm" variant={scriptLang === "node" ? "default" : "outline"} onClick={() => setScriptLang("node")} className="flex-1 text-xs">Node.js (Puppeteer)</Button>
                    </div>
                  </div>
                </div>
                <div className="relative">
                  <pre className="bg-zinc-950 border border-border rounded-lg p-4 text-xs font-mono text-zinc-300 overflow-x-auto whitespace-pre">{generateScript(scriptLang, scriptPort)}</pre>
                  <Button size="sm" variant="ghost" onClick={() => copyToClipboard(generateScript(scriptLang, scriptPort))} className="absolute top-2 right-2 text-xs gap-1"><Copy className="h-3 w-3" /> Copy</Button>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-card/50">
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><Zap className="h-4 w-4 text-amber-400" /> Quick Tips</CardTitle></CardHeader>
              <CardContent>
                <div className="grid sm:grid-cols-2 gap-4">
                  {[
                    { title: "Headless Mode", desc: "Start sessions with headless mode enabled for automated tasks that don't need a visible browser window. This saves system resources." },
                    { title: "Custom Debug Ports", desc: "Assign specific debug ports when starting sessions to run multiple automations in parallel. Each session needs a unique port." },
                    { title: "Session Warm-up", desc: "Use the warm-up feature to build browsing history and cookies before running automation. This makes sessions appear more natural." },
                    { title: "Proxy Rotation", desc: "Each session can use a different proxy. Configure proxies in LinkenSphere's Providers section, then assign them to sessions." },
                  ].map((tip) => (
                    <div key={tip.title} className="space-y-2 p-3 rounded-lg border border-border bg-background/50">
                      <p className="text-xs font-medium">{tip.title}</p>
                      <p className="text-[11px] text-muted-foreground">{tip.desc}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Settings Dialog */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>LinkenSphere Connection Settings</DialogTitle>
            <DialogDescription>Configure the API port. Saved securely to your account and proxied server-side.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>API Port</Label>
              <Input value={portInput} onChange={(e) => setPortInput(e.target.value)} placeholder="40080" type="number" min={1024} max={65535} />
              <p className="text-xs text-muted-foreground">Default is 40080. Find this in LinkenSphere → Preferences → API.</p>
            </div>
            <div className="p-3 rounded-lg border border-amber-500/20 bg-amber-500/5">
              <div className="flex items-start gap-2">
                <Shield className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
                <p className="text-xs text-muted-foreground">Your API port is stored securely and all calls are proxied through the Titan server — LinkenSphere never needs to be exposed to the internet.</p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSettings(false)}>Cancel</Button>
            <Button onClick={handleSavePort} disabled={savePortMutation.isPending} className="gap-1.5">
              {savePortMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <Save className="h-3.5 w-3.5" /> Save Port
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Auth Dialog */}
      <Dialog open={showAuthDialog} onOpenChange={setShowAuthDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sign In to LinkenSphere</DialogTitle>
            <DialogDescription>Enter your LinkenSphere account credentials.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} type="email" placeholder="you@example.com" />
            </div>
            <div className="space-y-2">
              <Label>Password</Label>
              <div className="relative">
                <Input value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} type={showPassword ? "text" : "password"} placeholder="••••••••" onKeyDown={(e) => e.key === "Enter" && handleSignIn()} />
                <Button size="sm" variant="ghost" onClick={() => setShowPassword(!showPassword)} className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0">
                  {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAuthDialog(false)}>Cancel</Button>
            <Button onClick={handleSignIn} disabled={signInMutation.isPending || !authEmail || !authPassword} className="gap-1.5">
              {signInMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <LogIn className="h-3.5 w-3.5" /> Sign In
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quick Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Quick Create Sessions</DialogTitle>
            <DialogDescription>Create new antidetect browser sessions. Costs 25 credits per session.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Number of Sessions</Label>
              <Input value={createCount} onChange={(e) => setCreateCount(Math.max(1, Math.min(50, parseInt(e.target.value) || 1)))} type="number" min={1} max={50} />
              <p className="text-xs text-muted-foreground">Cost: {createCount * 25} credits</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={createSessionsMutation.isPending} className="bg-cyan-600 hover:bg-cyan-700 gap-1.5">
              {createSessionsMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Create {createCount} Session{createCount > 1 ? "s" : ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Start Session Dialog */}
      <Dialog open={showStartDialog} onOpenChange={setShowStartDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start Session</DialogTitle>
            <DialogDescription>Configure and launch the browser session. Costs 50 credits.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Session UUID</Label>
              <Input value={startUuid} readOnly className="font-mono text-xs" />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>Headless Mode</Label>
                <p className="text-xs text-muted-foreground">Run without visible browser window</p>
              </div>
              <Switch checked={startHeadless} onCheckedChange={setStartHeadless} />
            </div>
            <div className="space-y-2">
              <Label>Debug Port (optional)</Label>
              <Input value={startDebugPort} onChange={(e) => setStartDebugPort(e.target.value)} placeholder="Auto-assigned if empty" type="number" />
              <p className="text-xs text-muted-foreground">Specify a port for DevTools Protocol automation</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowStartDialog(false)}>Cancel</Button>
            <Button onClick={handleStart} disabled={startSessionMutation.isPending} className="bg-emerald-600 hover:bg-emerald-700 gap-1.5">
              {startSessionMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <Play className="h-3.5 w-3.5" /> Start Session
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Dialog */}
      <Dialog open={showRenameDialog} onOpenChange={setShowRenameDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Rename Session</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>New Name</Label>
              <Input value={renameName} onChange={(e) => setRenameName(e.target.value)} placeholder="My Session" onKeyDown={(e) => e.key === "Enter" && handleRename()} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRenameDialog(false)}>Cancel</Button>
            <Button onClick={handleRename} disabled={renameSessionMutation.isPending || !renameName.trim()} className="bg-cyan-600 hover:bg-cyan-700 gap-1.5">
              {renameSessionMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Rename
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Script Dialog */}
      <Dialog open={showScriptDialog} onOpenChange={setShowScriptDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Automation Script</DialogTitle>
            <DialogDescription>Connect to this session's debug port with Selenium or Puppeteer.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex gap-2">
              <Button size="sm" variant={scriptLang === "python" ? "default" : "outline"} onClick={() => setScriptLang("python")} className="text-xs">Python (Selenium)</Button>
              <Button size="sm" variant={scriptLang === "node" ? "default" : "outline"} onClick={() => setScriptLang("node")} className="text-xs">Node.js (Puppeteer)</Button>
            </div>
            <div className="relative">
              <pre className="bg-zinc-950 border border-border rounded-lg p-4 text-xs font-mono text-zinc-300 overflow-x-auto whitespace-pre max-h-[400px] overflow-y-auto">{generateScript(scriptLang, scriptPort)}</pre>
              <Button size="sm" variant="ghost" onClick={() => copyToClipboard(generateScript(scriptLang, scriptPort))} className="absolute top-2 right-2 text-xs gap-1"><Copy className="h-3 w-3" /> Copy</Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowScriptDialog(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
