/**
 * LinkenSphere Integration — Manage antidetect browser sessions directly from Titan.
 * Connects to the locally running LinkenSphere client via its REST API.
 */
import { useState, useEffect, useCallback, useRef } from "react";
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
  Trash2,
  Copy,
  Code2,
  Eye,
  EyeOff,
  Zap,
  Server,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Terminal,
  LogIn,
  LogOut,
} from "lucide-react";

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

interface LSSessionDetail {
  device?: {
    browser_version?: string;
    cpu?: string;
    mode?: string;
    noises?: {
      audio?: string;
      canvas?: string;
      clientRects?: string;
      webgl?: string;
    };
  };
  debug_port?: number;
  uuid?: string;
}

type ConnectionStatus = "disconnected" | "connecting" | "connected" | "error";

// ─── LS API Helper ───────────────────────────────────────────────────────────

function lsApi(port: number) {
  const base = `http://127.0.0.1:${port}`;

  async function request(method: string, path: string, body?: any) {
    const opts: RequestInit = {
      method,
      headers: { "Content-Type": "application/json" },
    };
    if (body) opts.body = JSON.stringify(body);
    const resp = await fetch(`${base}${path}`, opts);
    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      throw new Error(`LS API ${resp.status}: ${text || resp.statusText}`);
    }
    const text = await resp.text();
    if (!text) return {};
    return JSON.parse(text);
  }

  return {
    // Auth
    signIn: (email: string, password: string, autologin = true) =>
      request("POST", "/auth/signin", { email, password, autologin }),
    signOut: () => request("POST", "/auth/signout"),

    // Sessions
    getSessions: (status?: string, proxyInfo = false) => {
      const body: any = {};
      if (status) body.status = status;
      if (proxyInfo) body.proxy_info = true;
      return request("GET", "/sessions", Object.keys(body).length ? body : undefined);
    },
    getSession: (uuid: string) => request("GET", `/sessions/${uuid}`),
    createQuickSessions: (count = 1) =>
      request("POST", "/sessions/create_quick", { count }),
    startSession: (uuid: string, headless = false, debugPort?: number) => {
      const body: any = { uuid, headless };
      if (debugPort) body.debug_port = debugPort;
      return body;
    },
    startSessionFull: (body: any) => request("POST", "/sessions/start", body),
    stopSession: (uuid: string) =>
      request("POST", "/sessions/stop", { uuid }),
    setSessionName: (uuid: string, name: string) =>
      request("POST", "/sessions/set_name", { uuid, name }),

    // Providers
    getProviders: () => request("GET", "/providers"),

    // Desktops
    getDesktops: () => request("GET", "/desktops"),

    // App
    getAppInfo: () => request("GET", "/app"),
  };
}

// ─── Status Badge ────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status?: string }) {
  const map: Record<string, { color: string; label: string }> = {
    running: { color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30", label: "Running" },
    stopped: { color: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30", label: "Stopped" },
    imported: { color: "bg-blue-500/20 text-blue-400 border-blue-500/30", label: "Imported" },
    warmup: { color: "bg-amber-500/20 text-amber-400 border-amber-500/30", label: "Warming Up" },
    automationRunning: { color: "bg-purple-500/20 text-purple-400 border-purple-500/30", label: "Automation" },
  };
  const s = map[status || ""] || { color: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30", label: status || "Unknown" };
  return <Badge variant="outline" className={`${s.color} text-[10px] font-medium`}>{s.label}</Badge>;
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function LinkenSpherePage() {
  // ── Settings ──
  const [apiPort, setApiPort] = useState(() => {
    const saved = localStorage.getItem("ls_api_port");
    return saved ? parseInt(saved) : 40080;
  });
  const [portInput, setPortInput] = useState(apiPort.toString());
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("disconnected");
  const [showSettings, setShowSettings] = useState(false);

  // ── Auth ──
  const [showAuthDialog, setShowAuthDialog] = useState(false);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  // ── Sessions ──
  const [sessions, setSessions] = useState<LSSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [sessionDetail, setSessionDetail] = useState<LSSessionDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // ── Quick Create ──
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createCount, setCreateCount] = useState(1);
  const [createLoading, setCreateLoading] = useState(false);

  // ── Start Session ──
  const [showStartDialog, setShowStartDialog] = useState(false);
  const [startUuid, setStartUuid] = useState("");
  const [startHeadless, setStartHeadless] = useState(false);
  const [startDebugPort, setStartDebugPort] = useState("");
  const [startLoading, setStartLoading] = useState(false);

  // ── Rename ──
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [renameUuid, setRenameUuid] = useState("");
  const [renameName, setRenameName] = useState("");
  const [renameLoading, setRenameLoading] = useState(false);

  // ── Script Generator ──
  const [showScriptDialog, setShowScriptDialog] = useState(false);
  const [scriptPort, setScriptPort] = useState("12345");
  const [scriptLang, setScriptLang] = useState<"python" | "node">("python");

  // ── Filter ──
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const api = useRef(lsApi(apiPort));

  useEffect(() => {
    api.current = lsApi(apiPort);
  }, [apiPort]);

  // ── Connection Test ──
  const testConnection = useCallback(async () => {
    setConnectionStatus("connecting");
    try {
      // Try fetching sessions as a connectivity test
      const data = await api.current.getSessions(undefined, true);
      if (Array.isArray(data)) {
        setSessions(data);
      }
      setConnectionStatus("connected");
      toast.success("Connected to LinkenSphere");
    } catch (err: any) {
      setConnectionStatus("error");
      // Don't toast on initial auto-connect
    }
  }, []);

  // Auto-connect on mount
  useEffect(() => {
    testConnection();
  }, [testConnection]);

  // ── Fetch Sessions ──
  const fetchSessions = useCallback(async () => {
    setLoading(true);
    try {
      const filter = statusFilter === "all" ? undefined : statusFilter;
      const data = await api.current.getSessions(filter, true);
      if (Array.isArray(data)) {
        setSessions(data);
      } else {
        setSessions([]);
      }
    } catch (err: any) {
      toast.error("Failed to fetch sessions: " + (err?.message || "Unknown error"));
      setConnectionStatus("error");
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  // ── Auth ──
  const handleSignIn = async () => {
    setAuthLoading(true);
    try {
      await api.current.signIn(authEmail, authPassword);
      toast.success("Signed in to LinkenSphere");
      setShowAuthDialog(false);
      setAuthEmail("");
      setAuthPassword("");
      await fetchSessions();
    } catch (err: any) {
      toast.error("Sign in failed: " + (err?.message || "Unknown error"));
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await api.current.signOut();
      toast.success("Signed out of LinkenSphere");
      setSessions([]);
      setConnectionStatus("disconnected");
    } catch (err: any) {
      toast.error("Sign out failed: " + (err?.message || "Unknown error"));
    }
  };

  // ── Create Sessions ──
  const handleCreate = async () => {
    setCreateLoading(true);
    try {
      const result = await api.current.createQuickSessions(createCount);
      const created = Array.isArray(result) ? result.length : 1;
      toast.success(`Created ${created} session(s)`);
      setShowCreateDialog(false);
      await fetchSessions();
    } catch (err: any) {
      toast.error("Failed to create sessions: " + (err?.message || "Unknown error"));
    } finally {
      setCreateLoading(false);
    }
  };

  // ── Start Session ──
  const handleStart = async () => {
    setStartLoading(true);
    try {
      const body: any = { uuid: startUuid, headless: startHeadless };
      if (startDebugPort) body.debug_port = parseInt(startDebugPort);
      await api.current.startSessionFull(body);
      toast.success("Session started");
      setShowStartDialog(false);
      await fetchSessions();
    } catch (err: any) {
      toast.error("Failed to start session: " + (err?.message || "Unknown error"));
    } finally {
      setStartLoading(false);
    }
  };

  // ── Stop Session ──
  const handleStop = async (uuid: string) => {
    try {
      await api.current.stopSession(uuid);
      toast.success("Session stopped");
      await fetchSessions();
    } catch (err: any) {
      toast.error("Failed to stop session: " + (err?.message || "Unknown error"));
    }
  };

  // ── Rename Session ──
  const handleRename = async () => {
    setRenameLoading(true);
    try {
      await api.current.setSessionName(renameUuid, renameName);
      toast.success("Session renamed");
      setShowRenameDialog(false);
      await fetchSessions();
    } catch (err: any) {
      toast.error("Failed to rename: " + (err?.message || "Unknown error"));
    } finally {
      setRenameLoading(false);
    }
  };

  // ── View Session Detail ──
  const handleViewDetail = async (uuid: string) => {
    if (selectedSession === uuid) {
      setSelectedSession(null);
      setSessionDetail(null);
      return;
    }
    setSelectedSession(uuid);
    setDetailLoading(true);
    try {
      const data = await api.current.getSession(uuid);
      setSessionDetail(data);
    } catch (err: any) {
      toast.error("Failed to fetch session details: " + (err?.message || "Unknown error"));
      setSessionDetail(null);
    } finally {
      setDetailLoading(false);
    }
  };

  // ── Save Port ──
  const savePort = () => {
    const p = parseInt(portInput);
    if (isNaN(p) || p < 1 || p > 65535) {
      toast.error("Invalid port number");
      return;
    }
    setApiPort(p);
    localStorage.setItem("ls_api_port", p.toString());
    toast.success(`API port set to ${p}`);
    setShowSettings(false);
    // Re-test connection with new port
    setTimeout(() => testConnection(), 100);
  };

  // ── Generate Script ──
  const generateScript = (lang: "python" | "node", port: string) => {
    if (lang === "python") {
      return `from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service

debug_port = ${port}
chromedriver_path = 'path/to/chromedriver'

options = Options()
options.add_experimental_option("debuggerAddress", f"127.0.0.1:{debug_port}")
service = Service(executable_path=chromedriver_path)

driver = webdriver.Chrome(service=service, options=options)
driver.get("https://example.com")
print(driver.title)

# Your automation code here...

driver.quit()`;
    }
    return `const puppeteer = require('puppeteer');

(async () => {
  const debugPort = ${port};
  const browser = await puppeteer.connect({
    browserURL: \`http://localhost:\${debugPort}\`
  });

  const page = await browser.newPage();
  await page.goto('https://example.com');
  console.log(await page.title());

  // Your automation code here...

  await browser.close();
})();`;
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  // ── Connection Status Icon ──
  const ConnectionIcon = () => {
    switch (connectionStatus) {
      case "connected":
        return <Wifi className="h-4 w-4 text-emerald-400" />;
      case "connecting":
        return <Loader2 className="h-4 w-4 text-amber-400 animate-spin" />;
      case "error":
        return <WifiOff className="h-4 w-4 text-red-400" />;
      default:
        return <WifiOff className="h-4 w-4 text-zinc-500" />;
    }
  };

  const filteredSessions = statusFilter === "all"
    ? sessions
    : sessions.filter((s) => s.status === statusFilter);

  const runningCount = sessions.filter((s) => s.status === "running").length;
  const stoppedCount = sessions.filter((s) => s.status === "stopped").length;

  return (
    <div className="min-h-screen bg-background">
      {/* ── Header ── */}
      <div className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/30">
                <Globe className="h-6 w-6 text-cyan-400" />
              </div>
              <div>
                <h1 className="text-xl font-bold flex items-center gap-2">
                  LinkenSphere
                  <Badge variant="outline" className="bg-cyan-500/10 text-cyan-400 border-cyan-500/30 text-[10px]">
                    INTEGRATION
                  </Badge>
                </h1>
                <p className="text-xs text-muted-foreground">
                  Antidetect browser session management
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-card text-xs">
                <ConnectionIcon />
                <span className={
                  connectionStatus === "connected" ? "text-emerald-400" :
                  connectionStatus === "error" ? "text-red-400" :
                  connectionStatus === "connecting" ? "text-amber-400" :
                  "text-zinc-500"
                }>
                  {connectionStatus === "connected" ? `Port ${apiPort}` :
                   connectionStatus === "connecting" ? "Connecting..." :
                   connectionStatus === "error" ? "Not Connected" :
                   "Disconnected"}
                </span>
              </div>
              <Button variant="outline" size="sm" onClick={() => setShowAuthDialog(true)} className="gap-1.5">
                <LogIn className="h-3.5 w-3.5" />
                Sign In
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowSettings(true)} className="gap-1.5">
                <Settings className="h-3.5 w-3.5" />
              </Button>
              <Button variant="outline" size="sm" onClick={testConnection} className="gap-1.5">
                <RefreshCw className={`h-3.5 w-3.5 ${connectionStatus === "connecting" ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* ── Connection Error Banner ── */}
        {connectionStatus === "error" && (
          <Card className="border-red-500/30 bg-red-500/5">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-red-400 mt-0.5 shrink-0" />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-red-400">Cannot connect to LinkenSphere</p>
                  <p className="text-xs text-muted-foreground">
                    Make sure LinkenSphere is running on your computer and the API port is set to <strong>{apiPort}</strong> in
                    Preferences. The API only works when the desktop client is open and authorized.
                  </p>
                  <div className="flex gap-2 pt-2">
                    <Button size="sm" variant="outline" onClick={testConnection} className="gap-1.5 text-xs">
                      <RefreshCw className="h-3 w-3" /> Retry Connection
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setShowSettings(true)} className="gap-1.5 text-xs">
                      <Settings className="h-3 w-3" /> Change Port
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setShowAuthDialog(true)} className="gap-1.5 text-xs">
                      <LogIn className="h-3 w-3" /> Sign In
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Stats Cards ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card className="bg-card/50">
            <CardContent className="p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total Sessions</p>
                  <p className="text-2xl font-bold">{sessions.length}</p>
                </div>
                <Monitor className="h-8 w-8 text-cyan-400/30" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card/50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Running</p>
                  <p className="text-2xl font-bold text-emerald-400">{runningCount}</p>
                </div>
                <Play className="h-8 w-8 text-emerald-400/30" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card/50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Stopped</p>
                  <p className="text-2xl font-bold text-zinc-400">{stoppedCount}</p>
                </div>
                <Square className="h-8 w-8 text-zinc-400/30" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card/50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">API Port</p>
                  <p className="text-2xl font-bold text-cyan-400">{apiPort}</p>
                </div>
                <Server className="h-8 w-8 text-cyan-400/30" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── Tabs ── */}
        <Tabs defaultValue="sessions" className="space-y-4">
          <div className="flex items-center justify-between">
            <TabsList>
              <TabsTrigger value="sessions" className="gap-1.5">
                <Monitor className="h-3.5 w-3.5" /> Sessions
              </TabsTrigger>
              <TabsTrigger value="automation" className="gap-1.5">
                <Code2 className="h-3.5 w-3.5" /> Automation
              </TabsTrigger>
            </TabsList>
            <div className="flex items-center gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="text-xs px-2 py-1.5 rounded-md border border-border bg-background"
              >
                <option value="all">All Status</option>
                <option value="running">Running</option>
                <option value="stopped">Stopped</option>
                <option value="imported">Imported</option>
                <option value="warmup">Warmup</option>
                <option value="automationRunning">Automation</option>
              </select>
              <Button size="sm" onClick={() => setShowCreateDialog(true)} className="gap-1.5 bg-cyan-600 hover:bg-cyan-700">
                <Plus className="h-3.5 w-3.5" /> New Session
              </Button>
              <Button size="sm" variant="outline" onClick={fetchSessions} disabled={loading} className="gap-1.5">
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
              </Button>
            </div>
          </div>

          {/* ── Sessions Tab ── */}
          <TabsContent value="sessions" className="space-y-3">
            {loading && sessions.length === 0 ? (
              <Card className="bg-card/50">
                <CardContent className="p-12 flex flex-col items-center justify-center">
                  <Loader2 className="h-8 w-8 text-cyan-400 animate-spin mb-3" />
                  <p className="text-sm text-muted-foreground">Loading sessions...</p>
                </CardContent>
              </Card>
            ) : filteredSessions.length === 0 ? (
              <Card className="bg-card/50">
                <CardContent className="p-12 flex flex-col items-center justify-center">
                  <Monitor className="h-12 w-12 text-muted-foreground/30 mb-3" />
                  <p className="text-sm font-medium text-muted-foreground">No sessions found</p>
                  <p className="text-xs text-muted-foreground/70 mt-1">
                    {connectionStatus === "connected"
                      ? "Create a new session to get started"
                      : "Connect to LinkenSphere first"}
                  </p>
                  {connectionStatus === "connected" && (
                    <Button size="sm" onClick={() => setShowCreateDialog(true)} className="mt-4 gap-1.5 bg-cyan-600 hover:bg-cyan-700">
                      <Plus className="h-3.5 w-3.5" /> Create Session
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              filteredSessions.map((session) => (
                <Card key={session.uuid} className={`bg-card/50 transition-all ${selectedSession === session.uuid ? "border-cyan-500/50 ring-1 ring-cyan-500/20" : "hover:border-border/80"}`}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`p-2 rounded-lg ${session.status === "running" ? "bg-emerald-500/10" : "bg-zinc-500/10"}`}>
                          <Globe className={`h-4 w-4 ${session.status === "running" ? "text-emerald-400" : "text-zinc-500"}`} />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium truncate">{session.name || "Unnamed Session"}</p>
                            <StatusBadge status={session.status} />
                          </div>
                          <p className="text-[10px] text-muted-foreground font-mono truncate mt-0.5">
                            {session.uuid}
                          </p>
                          {session.proxy?.protocol && (
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              Proxy: {session.proxy.protocol}
                              {session.proxy.host ? ` — ${session.proxy.host}:${session.proxy.port}` : ""}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {session.status === "stopped" ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setStartUuid(session.uuid);
                              setShowStartDialog(true);
                            }}
                            className="gap-1 text-xs text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10"
                          >
                            <Play className="h-3 w-3" /> Start
                          </Button>
                        ) : session.status === "running" ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleStop(session.uuid)}
                            className="gap-1 text-xs text-red-400 border-red-500/30 hover:bg-red-500/10"
                          >
                            <Square className="h-3 w-3" /> Stop
                          </Button>
                        ) : null}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setRenameUuid(session.uuid);
                            setRenameName(session.name || "");
                            setShowRenameDialog(true);
                          }}
                          className="text-xs"
                          title="Rename"
                        >
                          <Settings className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleViewDetail(session.uuid)}
                          className="text-xs"
                          title="View fingerprint details"
                        >
                          <Fingerprint className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => copyToClipboard(session.uuid)}
                          className="text-xs"
                          title="Copy UUID"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                        {session.status === "running" && session.debug_port && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setScriptPort(session.debug_port!.toString());
                              setShowScriptDialog(true);
                            }}
                            className="text-xs text-cyan-400"
                            title="Generate automation script"
                          >
                            <Terminal className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* ── Session Detail Expansion ── */}
                    {selectedSession === session.uuid && (
                      <div className="mt-4 pt-4 border-t border-border">
                        {detailLoading ? (
                          <div className="flex items-center gap-2 py-4 justify-center">
                            <Loader2 className="h-4 w-4 animate-spin text-cyan-400" />
                            <span className="text-xs text-muted-foreground">Loading fingerprint...</span>
                          </div>
                        ) : sessionDetail?.device ? (
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            <div className="space-y-1">
                              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Browser</p>
                              <p className="text-xs font-mono">{sessionDetail.device.browser_version || "N/A"}</p>
                            </div>
                            <div className="space-y-1">
                              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">CPU</p>
                              <p className="text-xs font-mono">{sessionDetail.device.cpu || "N/A"}</p>
                            </div>
                            <div className="space-y-1">
                              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Mode</p>
                              <p className="text-xs font-mono">{sessionDetail.device.mode || "N/A"}</p>
                            </div>
                            {sessionDetail.device.noises && (
                              <>
                                <div className="space-y-1">
                                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Canvas Noise</p>
                                  <p className="text-xs font-mono">{sessionDetail.device.noises.canvas || "N/A"}</p>
                                </div>
                                <div className="space-y-1">
                                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Audio Noise</p>
                                  <p className="text-xs font-mono">{sessionDetail.device.noises.audio || "N/A"}</p>
                                </div>
                                <div className="space-y-1">
                                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">WebGL Noise</p>
                                  <p className="text-xs font-mono">{sessionDetail.device.noises.webgl || "N/A"}</p>
                                </div>
                                <div className="space-y-1">
                                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">ClientRects</p>
                                  <p className="text-xs font-mono">{sessionDetail.device.noises.clientRects || "N/A"}</p>
                                </div>
                              </>
                            )}
                            {sessionDetail.debug_port && (
                              <div className="space-y-1">
                                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Debug Port</p>
                                <p className="text-xs font-mono text-cyan-400">{sessionDetail.debug_port}</p>
                              </div>
                            )}
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground text-center py-2">No fingerprint data available. Session may need to be started first.</p>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          {/* ── Automation Tab ── */}
          <TabsContent value="automation" className="space-y-4">
            <Card className="bg-card/50">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Code2 className="h-4 w-4 text-cyan-400" />
                  Automation Script Generator
                </CardTitle>
                <CardDescription className="text-xs">
                  Generate ready-to-use scripts that connect to your LinkenSphere sessions via DevTools Protocol.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs">Debug Port</Label>
                    <Input
                      value={scriptPort}
                      onChange={(e) => setScriptPort(e.target.value)}
                      placeholder="12345"
                      className="text-sm"
                    />
                    <p className="text-[10px] text-muted-foreground">The debug port assigned when starting a session</p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Language</Label>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant={scriptLang === "python" ? "default" : "outline"}
                        onClick={() => setScriptLang("python")}
                        className="flex-1 text-xs"
                      >
                        Python (Selenium)
                      </Button>
                      <Button
                        size="sm"
                        variant={scriptLang === "node" ? "default" : "outline"}
                        onClick={() => setScriptLang("node")}
                        className="flex-1 text-xs"
                      >
                        Node.js (Puppeteer)
                      </Button>
                    </div>
                  </div>
                </div>
                <div className="relative">
                  <pre className="bg-zinc-950 border border-border rounded-lg p-4 text-xs font-mono text-zinc-300 overflow-x-auto whitespace-pre">
                    {generateScript(scriptLang, scriptPort)}
                  </pre>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => copyToClipboard(generateScript(scriptLang, scriptPort))}
                    className="absolute top-2 right-2 text-xs gap-1"
                  >
                    <Copy className="h-3 w-3" /> Copy
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card/50">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Zap className="h-4 w-4 text-amber-400" />
                  Quick Tips
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2 p-3 rounded-lg border border-border bg-background/50">
                    <p className="text-xs font-medium">Headless Mode</p>
                    <p className="text-[11px] text-muted-foreground">
                      Start sessions with headless mode enabled for automated tasks that don't need a visible browser window. This saves system resources.
                    </p>
                  </div>
                  <div className="space-y-2 p-3 rounded-lg border border-border bg-background/50">
                    <p className="text-xs font-medium">Custom Debug Ports</p>
                    <p className="text-[11px] text-muted-foreground">
                      Assign specific debug ports when starting sessions to run multiple automations in parallel. Each session needs a unique port.
                    </p>
                  </div>
                  <div className="space-y-2 p-3 rounded-lg border border-border bg-background/50">
                    <p className="text-xs font-medium">Session Warm-up</p>
                    <p className="text-[11px] text-muted-foreground">
                      Use the warm-up feature to build browsing history and cookies before running automation. This makes sessions appear more natural.
                    </p>
                  </div>
                  <div className="space-y-2 p-3 rounded-lg border border-border bg-background/50">
                    <p className="text-xs font-medium">Proxy Rotation</p>
                    <p className="text-[11px] text-muted-foreground">
                      Each session can use a different proxy. Configure proxies in LinkenSphere's Providers section, then assign them to sessions.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* DIALOGS                                                           */}
      {/* ═══════════════════════════════════════════════════════════════════ */}

      {/* ── Settings Dialog ── */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>LinkenSphere Settings</DialogTitle>
            <DialogDescription>Configure the connection to your local LinkenSphere client.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>API Port</Label>
              <Input
                value={portInput}
                onChange={(e) => setPortInput(e.target.value)}
                placeholder="40080"
              />
              <p className="text-xs text-muted-foreground">
                Set this in LinkenSphere: Open LS App &rarr; Preferences &rarr; API Port
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSettings(false)}>Cancel</Button>
            <Button onClick={savePort} className="bg-cyan-600 hover:bg-cyan-700">Save &amp; Connect</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Auth Dialog ── */}
      <Dialog open={showAuthDialog} onOpenChange={setShowAuthDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sign In to LinkenSphere</DialogTitle>
            <DialogDescription>Authenticate with your LinkenSphere account on the local client.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
                placeholder="your@email.com"
                type="email"
              />
            </div>
            <div className="space-y-2">
              <Label>Password</Label>
              <Input
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                placeholder="Your password"
                type="password"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAuthDialog(false)}>Cancel</Button>
            <Button onClick={handleSignIn} disabled={authLoading || !authEmail || !authPassword} className="bg-cyan-600 hover:bg-cyan-700 gap-1.5">
              {authLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Sign In
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Create Sessions Dialog ── */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Quick Sessions</DialogTitle>
            <DialogDescription>Create new browser sessions with default settings on the active desktop.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Number of Sessions</Label>
              <Input
                type="number"
                min={1}
                max={50}
                value={createCount}
                onChange={(e) => setCreateCount(parseInt(e.target.value) || 1)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={createLoading} className="bg-cyan-600 hover:bg-cyan-700 gap-1.5">
              {createLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Create {createCount} Session{createCount > 1 ? "s" : ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Start Session Dialog ── */}
      <Dialog open={showStartDialog} onOpenChange={setShowStartDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start Session</DialogTitle>
            <DialogDescription>Configure and launch the browser session.</DialogDescription>
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
              <Input
                value={startDebugPort}
                onChange={(e) => setStartDebugPort(e.target.value)}
                placeholder="Auto-assigned if empty"
                type="number"
              />
              <p className="text-xs text-muted-foreground">Specify a port for DevTools Protocol automation</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowStartDialog(false)}>Cancel</Button>
            <Button onClick={handleStart} disabled={startLoading} className="bg-emerald-600 hover:bg-emerald-700 gap-1.5">
              {startLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <Play className="h-3.5 w-3.5" /> Start Session
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Rename Dialog ── */}
      <Dialog open={showRenameDialog} onOpenChange={setShowRenameDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Session</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>New Name</Label>
              <Input
                value={renameName}
                onChange={(e) => setRenameName(e.target.value)}
                placeholder="My Session"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRenameDialog(false)}>Cancel</Button>
            <Button onClick={handleRename} disabled={renameLoading || !renameName.trim()} className="bg-cyan-600 hover:bg-cyan-700 gap-1.5">
              {renameLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Rename
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Script Dialog ── */}
      <Dialog open={showScriptDialog} onOpenChange={setShowScriptDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Automation Script</DialogTitle>
            <DialogDescription>Connect to this session's debug port with Selenium or Puppeteer.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={scriptLang === "python" ? "default" : "outline"}
                onClick={() => setScriptLang("python")}
                className="text-xs"
              >
                Python (Selenium)
              </Button>
              <Button
                size="sm"
                variant={scriptLang === "node" ? "default" : "outline"}
                onClick={() => setScriptLang("node")}
                className="text-xs"
              >
                Node.js (Puppeteer)
              </Button>
            </div>
            <div className="relative">
              <pre className="bg-zinc-950 border border-border rounded-lg p-4 text-xs font-mono text-zinc-300 overflow-x-auto whitespace-pre max-h-[400px] overflow-y-auto">
                {generateScript(scriptLang, scriptPort)}
              </pre>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => copyToClipboard(generateScript(scriptLang, scriptPort))}
                className="absolute top-2 right-2 text-xs gap-1"
              >
                <Copy className="h-3 w-3" /> Copy
              </Button>
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
