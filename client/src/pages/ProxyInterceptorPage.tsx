import { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Activity,
  Circle,
  Download,
  Filter,
  Globe,
  RefreshCw,
  Search,
  Shield,
  Trash2,
  Wifi,
  WifiOff,
  ChevronRight,
  Copy,
  Code,
  Lock,
  Unlock,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface TrafficEntry {
  id: string;
  timestamp: string;
  method: string;
  url: string;
  status?: number;
  contentType?: string;
  requestHeaders?: Record<string, string>;
  responseHeaders?: Record<string, string>;
  requestBody?: string;
  responseBody?: string;
  duration?: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function statusColor(status?: number): string {
  if (!status) return "text-muted-foreground";
  if (status < 300) return "text-green-500";
  if (status < 400) return "text-blue-500";
  if (status < 500) return "text-yellow-500";
  return "text-red-500";
}

function methodColor(method: string): string {
  switch (method) {
    case "GET": return "bg-blue-500/20 text-blue-400 border-blue-500/30";
    case "POST": return "bg-green-500/20 text-green-400 border-green-500/30";
    case "PUT": return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
    case "DELETE": return "bg-red-500/20 text-red-400 border-red-500/30";
    case "PATCH": return "bg-purple-500/20 text-purple-400 border-purple-500/30";
    default: return "bg-muted text-muted-foreground";
  }
}

function getUrlHost(url: string): string {
  try { return new URL(url).hostname; } catch { return url.slice(0, 40); }
}

function getUrlPath(url: string): string {
  try {
    const u = new URL(url);
    return u.pathname + u.search;
  } catch { return url; }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ProxyInterceptorPage() {
  const { toast } = useToast();
  const [sessionId, setSessionId] = useState("");
  const [capturing, setCapturing] = useState(false);
  const [entries, setEntries] = useState<TrafficEntry[]>([]);
  const [selected, setSelected] = useState<TrafficEntry | null>(null);
  const [methodFilter, setMethodFilter] = useState("all");
  const [urlSearch, setUrlSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [total, setTotal] = useState(0);
  const refreshRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── tRPC ──────────────────────────────────────────────────────────────────
  const sessions = trpc.isolatedBrowser.listSessions.useQuery(undefined, { refetchInterval: 10000 });

  const enableCapture = trpc.isolatedBrowser.enableTrafficCapture.useMutation({
    onSuccess: (data) => {
      setCapturing(data.enabled);
      toast({ title: data.enabled ? "Traffic capture started" : "Traffic capture stopped" });
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const trafficLog = trpc.isolatedBrowser.getTrafficLog.useQuery(
    {
      sessionId: sessionId || "placeholder",
      method: methodFilter !== "all" ? methodFilter : undefined,
      urlFilter: urlSearch || undefined,
      statusFilter: statusFilter !== "all" ? parseInt(statusFilter) : undefined,
      limit: 200,
    },
    {
      enabled: !!sessionId,
      refetchInterval: autoRefresh ? 2000 : false,
      onSuccess: (data) => {
        setEntries(data.entries);
        setTotal(data.total);
        setCapturing(data.capturing);
      },
    }
  );

  const clearLog = trpc.isolatedBrowser.clearTrafficLog.useMutation({
    onSuccess: () => {
      setEntries([]);
      setTotal(0);
      setSelected(null);
      toast({ title: "Traffic log cleared" });
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  // ── Auto-refresh ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (autoRefresh && sessionId) {
      refreshRef.current = setInterval(() => trafficLog.refetch(), 2000);
    } else {
      if (refreshRef.current) clearInterval(refreshRef.current);
    }
    return () => { if (refreshRef.current) clearInterval(refreshRef.current); };
  }, [autoRefresh, sessionId]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleToggleCapture = () => {
    if (!sessionId) return toast({ title: "Select a session first", variant: "destructive" });
    enableCapture.mutate({ sessionId, enabled: !capturing });
  };

  const handleExport = () => {
    const har = {
      log: {
        version: "1.2",
        creator: { name: "Archibald Titan Proxy Interceptor", version: "1.0" },
        entries: entries.map((e) => ({
          startedDateTime: e.timestamp,
          time: e.duration || 0,
          request: {
            method: e.method,
            url: e.url,
            headers: Object.entries(e.requestHeaders || {}).map(([k, v]) => ({ name: k, value: v })),
            postData: e.requestBody ? { text: e.requestBody } : undefined,
          },
          response: {
            status: e.status || 0,
            headers: Object.entries(e.responseHeaders || {}).map(([k, v]) => ({ name: k, value: v })),
            content: { text: e.responseBody || "", mimeType: e.contentType || "" },
          },
        })),
      },
    };
    const blob = new Blob([JSON.stringify(har, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `traffic-${sessionId}-${Date.now()}.har`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied to clipboard" });
  };

  const activeSessions = (sessions.data?.sessions || []).filter((s: { status: string }) => s.status === "active");

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <div className="border-b px-6 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Shield className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Proxy Interceptor</h1>
            <p className="text-sm text-muted-foreground">Capture and inspect HTTP traffic from Isolated Browser sessions</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {entries.length > 0 && (
            <>
              <Button variant="outline" size="sm" onClick={handleExport}>
                <Download className="h-4 w-4 mr-1" /> Export HAR
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => sessionId && clearLog.mutate({ sessionId })}
                disabled={clearLog.isPending}
              >
                <Trash2 className="h-4 w-4 mr-1" /> Clear
              </Button>
            </>
          )}
          <Button
            variant={autoRefresh ? "default" : "outline"}
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
            disabled={!sessionId}
          >
            <Activity className={`h-4 w-4 mr-1 ${autoRefresh ? "animate-pulse" : ""}`} />
            {autoRefresh ? "Live" : "Auto-refresh"}
          </Button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="border-b px-6 py-3 flex items-center gap-3 shrink-0 bg-muted/20">
        {/* Session selector */}
        <div className="flex items-center gap-2 min-w-[260px]">
          <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
          <Select value={sessionId} onValueChange={setSessionId}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Select active session..." />
            </SelectTrigger>
            <SelectContent>
              {activeSessions.length === 0 ? (
                <SelectItem value="none" disabled>No active sessions</SelectItem>
              ) : (
                activeSessions.map((s: { id: string; currentUrl?: string }) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.id.slice(0, 8)}… — {s.currentUrl ? getUrlHost(s.currentUrl) : "Unknown"}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>

        {/* Capture toggle */}
        <Button
          size="sm"
          variant={capturing ? "destructive" : "default"}
          onClick={handleToggleCapture}
          disabled={!sessionId || enableCapture.isPending}
          className="shrink-0"
        >
          {capturing ? (
            <><WifiOff className="h-4 w-4 mr-1" /> Stop Capture</>
          ) : (
            <><Wifi className="h-4 w-4 mr-1" /> Start Capture</>
          )}
        </Button>

        <Separator orientation="vertical" className="h-6" />

        {/* Filters */}
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            className="pl-7 h-8 text-xs"
            placeholder="Filter by URL..."
            value={urlSearch}
            onChange={(e) => setUrlSearch(e.target.value)}
          />
        </div>

        <Select value={methodFilter} onValueChange={setMethodFilter}>
          <SelectTrigger className="h-8 text-xs w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Methods</SelectItem>
            {["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD"].map((m) => (
              <SelectItem key={m} value={m}>{m}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-8 text-xs w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="200">200 OK</SelectItem>
            <SelectItem value="301">301 Redirect</SelectItem>
            <SelectItem value="302">302 Redirect</SelectItem>
            <SelectItem value="400">400 Bad Request</SelectItem>
            <SelectItem value="401">401 Unauthorized</SelectItem>
            <SelectItem value="403">403 Forbidden</SelectItem>
            <SelectItem value="404">404 Not Found</SelectItem>
            <SelectItem value="500">500 Server Error</SelectItem>
          </SelectContent>
        </Select>

        <Button variant="ghost" size="sm" onClick={() => trafficLog.refetch()} disabled={!sessionId}>
          <RefreshCw className={`h-4 w-4 ${trafficLog.isFetching ? "animate-spin" : ""}`} />
        </Button>

        <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
          {capturing && (
            <span className="flex items-center gap-1 text-green-500">
              <Circle className="h-2 w-2 fill-green-500 animate-pulse" /> Capturing
            </span>
          )}
          <span>{entries.length} / {total} requests</span>
        </div>
      </div>

      {/* Main content — split pane */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: request list */}
        <div className="w-1/2 border-r flex flex-col overflow-hidden">
          {entries.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 text-muted-foreground p-8">
              <Shield className="h-12 w-12 opacity-20" />
              <div>
                <p className="font-semibold">No traffic captured</p>
                <p className="text-sm">
                  {!sessionId
                    ? "Select an active Isolated Browser session above"
                    : capturing
                    ? "Browse in the Isolated Browser to capture requests"
                    : "Click 'Start Capture' to begin intercepting traffic"}
                </p>
              </div>
              {!sessionId && (
                <Button variant="outline" size="sm" onClick={() => window.location.href = "/isolated-browser"}>
                  Open Isolated Browser
                </Button>
              )}
            </div>
          ) : (
            <ScrollArea className="flex-1">
              <div className="divide-y">
                {entries.map((entry) => (
                  <button
                    key={entry.id}
                    className={`w-full text-left px-4 py-2.5 hover:bg-muted/50 transition-colors ${selected?.id === entry.id ? "bg-muted" : ""}`}
                    onClick={() => setSelected(entry)}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className={`text-[10px] px-1.5 py-0 font-mono ${methodColor(entry.method)}`}>
                        {entry.method}
                      </Badge>
                      <span className={`text-xs font-mono font-bold ${statusColor(entry.status)}`}>
                        {entry.status || "—"}
                      </span>
                      {entry.duration && (
                        <span className="text-[10px] text-muted-foreground ml-auto">{entry.duration}ms</span>
                      )}
                      <ChevronRight className={`h-3 w-3 text-muted-foreground shrink-0 ${selected?.id === entry.id ? "opacity-100" : "opacity-0"}`} />
                    </div>
                    <div className="text-xs text-muted-foreground truncate font-mono">
                      <span className="text-foreground font-medium">{getUrlHost(entry.url)}</span>
                      <span className="opacity-60">{getUrlPath(entry.url)}</span>
                    </div>
                    {entry.contentType && (
                      <div className="text-[10px] text-muted-foreground mt-0.5 truncate">
                        {entry.contentType.split(";")[0]}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>

        {/* Right: request detail */}
        <div className="w-1/2 flex flex-col overflow-hidden">
          {!selected ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <Filter className="h-8 w-8 opacity-20 mx-auto mb-2" />
                <p className="text-sm">Select a request to inspect</p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col h-full overflow-hidden">
              {/* URL bar */}
              <div className="px-4 py-3 border-b bg-muted/20 shrink-0">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="outline" className={`text-xs px-2 font-mono ${methodColor(selected.method)}`}>
                    {selected.method}
                  </Badge>
                  <span className={`text-sm font-bold ${statusColor(selected.status)}`}>
                    {selected.status || "Pending"}
                  </span>
                  {selected.duration && (
                    <span className="text-xs text-muted-foreground">{selected.duration}ms</span>
                  )}
                  {selected.url.startsWith("https") ? (
                    <Lock className="h-3 w-3 text-green-500 ml-auto" />
                  ) : (
                    <Unlock className="h-3 w-3 text-yellow-500 ml-auto" />
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <p className="text-xs font-mono text-muted-foreground truncate flex-1">{selected.url}</p>
                  <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0" onClick={() => copyToClipboard(selected.url)}>
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </div>

              {/* Tabs */}
              <Tabs defaultValue="request" className="flex-1 flex flex-col overflow-hidden">
                <TabsList className="mx-4 mt-2 w-auto shrink-0">
                  <TabsTrigger value="request" className="text-xs">Request</TabsTrigger>
                  <TabsTrigger value="response" className="text-xs">Response</TabsTrigger>
                  <TabsTrigger value="headers" className="text-xs">Headers</TabsTrigger>
                  <TabsTrigger value="raw" className="text-xs">Raw</TabsTrigger>
                </TabsList>

                <TabsContent value="request" className="flex-1 overflow-hidden m-0 mt-2">
                  <ScrollArea className="h-full px-4">
                    {selected.requestBody ? (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs font-medium text-muted-foreground">Request Body</p>
                          <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => copyToClipboard(selected.requestBody!)}>
                            <Copy className="h-3 w-3 mr-1" /> Copy
                          </Button>
                        </div>
                        <pre className="text-xs font-mono bg-muted/50 rounded p-3 overflow-x-auto whitespace-pre-wrap break-all">
                          {selected.requestBody}
                        </pre>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">No request body</p>
                    )}
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="response" className="flex-1 overflow-hidden m-0 mt-2">
                  <ScrollArea className="h-full px-4">
                    {selected.responseBody ? (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs font-medium text-muted-foreground">
                            Response Body
                            {selected.responseBody && (
                              <span className="ml-2 text-muted-foreground/60">
                                ({formatBytes(selected.responseBody.length)})
                              </span>
                            )}
                          </p>
                          <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => copyToClipboard(selected.responseBody!)}>
                            <Copy className="h-3 w-3 mr-1" /> Copy
                          </Button>
                        </div>
                        <pre className="text-xs font-mono bg-muted/50 rounded p-3 overflow-x-auto whitespace-pre-wrap break-all">
                          {(() => {
                            try {
                              return JSON.stringify(JSON.parse(selected.responseBody), null, 2);
                            } catch {
                              return selected.responseBody;
                            }
                          })()}
                        </pre>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        {selected.status ? "No response body captured (binary or non-text content)" : "Response pending..."}
                      </p>
                    )}
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="headers" className="flex-1 overflow-hidden m-0 mt-2">
                  <ScrollArea className="h-full px-4">
                    <div className="space-y-4">
                      {selected.requestHeaders && Object.keys(selected.requestHeaders).length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-2">Request Headers</p>
                          <div className="space-y-1">
                            {Object.entries(selected.requestHeaders).map(([k, v]) => (
                              <div key={k} className="flex gap-2 text-xs font-mono">
                                <span className="text-blue-400 shrink-0 min-w-[140px]">{k}:</span>
                                <span className="text-muted-foreground break-all">{v}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {selected.responseHeaders && Object.keys(selected.responseHeaders).length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-2">Response Headers</p>
                          <div className="space-y-1">
                            {Object.entries(selected.responseHeaders).map(([k, v]) => (
                              <div key={k} className="flex gap-2 text-xs font-mono">
                                <span className="text-green-400 shrink-0 min-w-[140px]">{k}:</span>
                                <span className="text-muted-foreground break-all">{v}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="raw" className="flex-1 overflow-hidden m-0 mt-2">
                  <ScrollArea className="h-full px-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                        <Code className="h-3 w-3" /> Raw Request
                      </p>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-xs"
                        onClick={() => {
                          const raw = [
                            `${selected.method} ${getUrlPath(selected.url)} HTTP/1.1`,
                            `Host: ${getUrlHost(selected.url)}`,
                            ...Object.entries(selected.requestHeaders || {}).map(([k, v]) => `${k}: ${v}`),
                            "",
                            selected.requestBody || "",
                          ].join("\n");
                          copyToClipboard(raw);
                        }}
                      >
                        <Copy className="h-3 w-3 mr-1" /> Copy
                      </Button>
                    </div>
                    <pre className="text-xs font-mono bg-muted/50 rounded p-3 overflow-x-auto whitespace-pre-wrap break-all">
                      {[
                        `${selected.method} ${getUrlPath(selected.url)} HTTP/1.1`,
                        `Host: ${getUrlHost(selected.url)}`,
                        ...Object.entries(selected.requestHeaders || {}).map(([k, v]) => `${k}: ${v}`),
                        "",
                        selected.requestBody || "(no body)",
                      ].join("\n")}
                    </pre>
                  </ScrollArea>
                </TabsContent>
              </Tabs>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
