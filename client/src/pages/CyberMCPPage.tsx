/**
 * CyberMCP Page — AI-powered API Security Testing
 * Security section — accessible to cyber, cyber_plus, and titan tiers.
 *
 * Provides 14 security tools across 4 categories:
 * Authentication, Injection, Data Protection, Infrastructure
 *
 * Full Scan tab uses SSE streaming for real-time per-check progress.
 *
 * Reference: https://github.com/ricauts/CyberMCP
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Shield, Lock, Zap,
  AlertTriangle, CheckCircle, XCircle, Info,
  Play, RefreshCw, Copy, ChevronDown, ChevronUp,
  Code, Activity, Eye, Loader2, StopCircle,
} from "lucide-react";
import { useCyberMcpScan, type CheckProgress } from "@/hooks/useCyberMcpScan";

// ─── Risk Badge ───────────────────────────────────────────────────
function RiskBadge({ risk }: { risk: string }) {
  const map: Record<string, { label: string; className: string }> = {
    critical: { label: "CRITICAL", className: "bg-red-600 text-white" },
    high:     { label: "HIGH",     className: "bg-orange-500 text-white" },
    medium:   { label: "MEDIUM",   className: "bg-yellow-500 text-black" },
    low:      { label: "LOW",      className: "bg-blue-500 text-white" },
    pass:     { label: "PASS",     className: "bg-green-600 text-white" },
    info:     { label: "INFO",     className: "bg-gray-500 text-white" },
  };
  const cfg = map[risk?.toLowerCase()] || map.info;
  return <Badge className={`text-xs font-bold ${cfg.className}`}>{cfg.label}</Badge>;
}

// ─── Result Panel ─────────────────────────────────────────────────
function ResultPanel({ title, data, risk }: { title: string; data: any; risk?: string }) {
  const [expanded, setExpanded] = useState(true);
  if (!data) return null;
  return (
    <Card className="mt-4 border-border/60">
      <CardHeader className="py-3 px-4 cursor-pointer" onClick={() => setExpanded(e => !e)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
            {risk && <RiskBadge risk={risk} />}
          </div>
          {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </CardHeader>
      {expanded && (
        <CardContent className="px-4 pb-4">
          <pre className="text-xs bg-muted/50 rounded p-3 overflow-auto max-h-80 whitespace-pre-wrap font-mono">
            {JSON.stringify(data, null, 2)}
          </pre>
          <Button variant="ghost" size="sm" className="mt-2 h-7 text-xs" onClick={() => { navigator.clipboard.writeText(JSON.stringify(data, null, 2)); toast.success("Copied to clipboard"); }}>
            <Copy className="h-3 w-3 mr-1" /> Copy JSON
          </Button>
        </CardContent>
      )}
    </Card>
  );
}

// ─── Check Row (live progress indicator) ─────────────────────────
function CheckRow({ check }: { check: CheckProgress }) {
  const statusIcon = () => {
    if (check.status === "pending")  return <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30" />;
    if (check.status === "running")  return <Loader2 className="h-4 w-4 text-primary animate-spin" />;
    if (check.status === "done")     return <CheckCircle className="h-4 w-4 text-green-500" />;
    if (check.status === "error")    return <XCircle className="h-4 w-4 text-red-500" />;
    return null;
  };

  const riskFromResult = check.result?.risk;

  return (
    <div className={`flex items-center justify-between p-3 rounded-lg border transition-all duration-300 ${
      check.status === "running" ? "border-primary/40 bg-primary/5" :
      check.status === "done"    ? "border-green-500/20 bg-green-500/5" :
      check.status === "error"   ? "border-red-500/20 bg-red-500/5" :
      "border-border/40 bg-muted/20"
    }`}>
      <div className="flex items-center gap-3">
        {statusIcon()}
        <div>
          <p className="text-xs font-medium">{check.label}</p>
          {check.status === "running" && (
            <p className="text-[11px] text-muted-foreground animate-pulse">Scanning...</p>
          )}
          {check.status === "done" && check.result && (
            <p className="text-[11px] text-muted-foreground">
              {check.result.score !== undefined && `Score: ${check.result.score}%`}
              {check.result.vulnerable !== undefined && (check.result.vulnerable ? " · Vulnerable" : " · Clean")}
              {check.result.findingCount !== undefined && ` · ${check.result.findingCount} findings`}
              {check.result.criticalMissing !== undefined && ` · ${check.result.criticalMissing} critical missing`}
            </p>
          )}
          {check.status === "error" && check.result?.error && (
            <p className="text-[11px] text-red-400 truncate max-w-[200px]">{check.result.error}</p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {riskFromResult && check.status !== "pending" && <RiskBadge risk={riskFromResult} />}
      </div>
    </div>
  );
}

// ─── Full Scan Tab ────────────────────────────────────────────────
function FullScanTab() {
  const [endpoint, setEndpoint] = useState("");
  const [method, setMethod] = useState<"GET" | "POST">("GET");
  const [authToken, setAuthToken] = useState("");
  const [paramName, setParamName] = useState("id");

  const { start, cancel, isScanning, checks, finalResult, error, reset } = useCyberMcpScan();

  const doneCount = checks.filter(c => c.status === "done" || c.status === "error").length;
  const progressPct = isScanning ? Math.round((doneCount / checks.length) * 100) : (finalResult ? 100 : 0);

  const handleStart = () => {
    if (!endpoint) return;
    reset();
    start({ endpoint, method, authToken: authToken || undefined, paramName: paramName || "id" });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2"><Zap className="h-4 w-4 text-primary" /> Full Security Scan</CardTitle>
          <CardDescription className="text-xs">
            Runs 5 security checks with live per-check progress — Security Headers, Auth Bypass, SQL Injection, XSS, Sensitive Data
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2 space-y-1">
              <Label className="text-xs">Target Endpoint URL</Label>
              <Input
                placeholder="https://api.example.com/users"
                value={endpoint}
                onChange={e => setEndpoint(e.target.value)}
                className="h-9 text-sm font-mono"
                disabled={isScanning}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">HTTP Method</Label>
              <Select value={method} onValueChange={(v: any) => setMethod(v)} disabled={isScanning}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="GET">GET</SelectItem>
                  <SelectItem value="POST">POST</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Auth Token (optional)</Label>
              <Input
                placeholder="eyJhbGciOiJIUzI1NiJ9..."
                value={authToken}
                onChange={e => setAuthToken(e.target.value)}
                className="h-9 text-sm font-mono"
                disabled={isScanning}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Parameter Name (for injection tests)</Label>
              <Input
                placeholder="id"
                value={paramName}
                onChange={e => setParamName(e.target.value)}
                className="h-9 text-sm"
                disabled={isScanning}
              />
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={handleStart}
              disabled={!endpoint || isScanning}
              className="flex-1"
            >
              {isScanning
                ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Scanning ({doneCount}/{checks.length})...</>
                : <><Play className="h-4 w-4 mr-2" /> Run Full Scan</>
              }
            </Button>
            {isScanning && (
              <Button variant="outline" onClick={cancel} className="gap-2">
                <StopCircle className="h-4 w-4" /> Cancel
              </Button>
            )}
          </div>

          {/* Credit cost notice */}
          <p className="text-[11px] text-muted-foreground text-center">
            150 credits · Runs 5 security checks in sequence
          </p>
        </CardContent>
      </Card>

      {/* Live progress panel — shown while scanning or after completion */}
      {(isScanning || finalResult || error) && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                {isScanning
                  ? <><Loader2 className="h-4 w-4 animate-spin text-primary" /> Live Scan Progress</>
                  : finalResult
                  ? <><CheckCircle className="h-4 w-4 text-green-500" /> Scan Complete</>
                  : <><XCircle className="h-4 w-4 text-red-500" /> Scan Failed</>
                }
              </CardTitle>
              {finalResult && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Overall Risk:</span>
                  <RiskBadge risk={finalResult.overallRisk} />
                  <span className="text-xs text-muted-foreground">{finalResult.duration}ms</span>
                </div>
              )}
            </div>
            {(isScanning || finalResult) && (
              <div className="mt-2 space-y-1">
                <Progress value={progressPct} className="h-1.5" />
                <p className="text-[11px] text-muted-foreground text-right">{progressPct}%</p>
              </div>
            )}
          </CardHeader>
          <CardContent className="space-y-2 pb-4">
            {error && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
                <p className="text-xs text-red-400">{error}</p>
              </div>
            )}
            {checks.map(check => (
              <CheckRow key={check.key} check={check} />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Final results grid */}
      {finalResult && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold">Check Summary</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            {Object.entries(finalResult.scanResults).map(([key, val]: [string, any]) => (
              <Card key={key} className="p-3 text-center">
                <p className="text-xs text-muted-foreground capitalize mb-1">
                  {key.replace(/([A-Z])/g, ' $1').trim()}
                </p>
                <RiskBadge risk={val?.risk || "info"} />
                {val?.score !== undefined && <p className="text-xs mt-1 font-mono">{val.score}%</p>}
                {val?.vulnerable !== undefined && (
                  <p className={`text-xs mt-1 ${val.vulnerable ? "text-red-400" : "text-green-400"}`}>
                    {val.vulnerable ? "Vulnerable" : "Clean"}
                  </p>
                )}
                {val?.findingCount !== undefined && <p className="text-xs mt-1">{val.findingCount} found</p>}
                {val?.criticalMissing !== undefined && <p className="text-xs mt-1">{val.criticalMissing} missing</p>}
              </Card>
            ))}
          </div>
          <ResultPanel title="Raw Scan Data" data={finalResult} risk={finalResult.overallRisk} />
        </div>
      )}
    </div>
  );
}

// ─── Auth Testing Tab ─────────────────────────────────────────────
function AuthTab() {
  const [mode, setMode] = useState<"bypass" | "jwt" | "basic" | "token">("bypass");
  const [endpoint, setEndpoint] = useState("");
  const [token, setToken] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [result, setResult] = useState<any>(null);

  const bypass = trpc.cyberMcp.checkAuthBypass.useMutation({ onSuccess: setResult, onError: e => toast.error(e.message) });
  const jwt = trpc.cyberMcp.checkJwtVulnerability.useMutation({ onSuccess: setResult, onError: e => toast.error(e.message) });
  const basic = trpc.cyberMcp.testBasicAuth.useMutation({ onSuccess: setResult, onError: e => toast.error(e.message) });
  const tokenAuth = trpc.cyberMcp.testTokenAuth.useMutation({ onSuccess: setResult, onError: e => toast.error(e.message) });

  const isPending = bypass.isPending || jwt.isPending || basic.isPending || tokenAuth.isPending;

  const run = () => {
    setResult(null);
    if (mode === "bypass") bypass.mutate({ endpoint, validToken: token || undefined });
    else if (mode === "jwt") jwt.mutate({ token });
    else if (mode === "basic") basic.mutate({ endpoint, username, password });
    else if (mode === "token") tokenAuth.mutate({ endpoint, token });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2"><Lock className="h-4 w-4 text-primary" /> Authentication Testing</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2 flex-wrap">
            {(["bypass", "jwt", "basic", "token"] as const).map(m => (
              <Button key={m} variant={mode === m ? "default" : "outline"} size="sm" onClick={() => setMode(m)} className="h-8 text-xs capitalize">
                {m === "bypass" ? "Auth Bypass" : m === "jwt" ? "JWT Analysis" : m === "basic" ? "Basic Auth" : "Token Auth"}
              </Button>
            ))}
          </div>

          {mode !== "jwt" && (
            <div className="space-y-1">
              <Label className="text-xs">Endpoint URL</Label>
              <Input placeholder="https://api.example.com/protected" value={endpoint} onChange={e => setEndpoint(e.target.value)} className="h-9 text-sm font-mono" />
            </div>
          )}

          {(mode === "bypass" || mode === "token") && (
            <div className="space-y-1">
              <Label className="text-xs">{mode === "bypass" ? "Valid Token (optional — for effectiveness check)" : "Bearer Token"}</Label>
              <Input placeholder="eyJhbGciOiJIUzI1NiJ9..." value={token} onChange={e => setToken(e.target.value)} className="h-9 text-sm font-mono" />
            </div>
          )}

          {mode === "jwt" && (
            <div className="space-y-1">
              <Label className="text-xs">JWT Token to Analyse</Label>
              <Textarea
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.signature"
                value={token}
                onChange={e => setToken(e.target.value)}
                className="text-sm font-mono h-20 resize-none"
              />
            </div>
          )}

          {mode === "basic" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label className="text-xs">Username</Label><Input value={username} onChange={e => setUsername(e.target.value)} className="h-9 text-sm" /></div>
              <div className="space-y-1"><Label className="text-xs">Password</Label><Input type="password" value={password} onChange={e => setPassword(e.target.value)} className="h-9 text-sm" /></div>
            </div>
          )}

          <Button onClick={run} disabled={isPending || (!endpoint && mode !== "jwt") || (!token && (mode === "jwt" || mode === "token"))} className="w-full">
            {isPending ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Testing...</> : <><Play className="h-4 w-4 mr-2" /> Run Test</>}
          </Button>
        </CardContent>
      </Card>
      {result && <ResultPanel title="Authentication Test Results" data={result} risk={result.overallRisk || result.risk} />}
    </div>
  );
}

// ─── Injection Tab ────────────────────────────────────────────────
function InjectionTab() {
  const [mode, setMode] = useState<"sql" | "xss">("sql");
  const [endpoint, setEndpoint] = useState("");
  const [paramName, setParamName] = useState("id");
  const [method, setMethod] = useState<"GET" | "POST">("GET");
  const [result, setResult] = useState<any>(null);

  const sql = trpc.cyberMcp.checkSqlInjection.useMutation({ onSuccess: setResult, onError: e => toast.error(e.message) });
  const xss = trpc.cyberMcp.checkXss.useMutation({ onSuccess: setResult, onError: e => toast.error(e.message) });
  const isPending = sql.isPending || xss.isPending;

  const run = () => {
    setResult(null);
    if (mode === "sql") sql.mutate({ endpoint, paramName, method });
    else xss.mutate({ endpoint, paramName, method });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2"><Code className="h-4 w-4 text-primary" /> Injection Testing</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Button variant={mode === "sql" ? "default" : "outline"} size="sm" onClick={() => setMode("sql")} className="h-8 text-xs">SQL Injection</Button>
            <Button variant={mode === "xss" ? "default" : "outline"} size="sm" onClick={() => setMode("xss")} className="h-8 text-xs">XSS Detection</Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2 space-y-1">
              <Label className="text-xs">Target Endpoint</Label>
              <Input placeholder="https://api.example.com/search" value={endpoint} onChange={e => setEndpoint(e.target.value)} className="h-9 text-sm font-mono" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Parameter Name</Label>
              <Input placeholder="id" value={paramName} onChange={e => setParamName(e.target.value)} className="h-9 text-sm" />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Method</Label>
            <Select value={method} onValueChange={(v: any) => setMethod(v)}>
              <SelectTrigger className="h-9 text-sm w-32"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="GET">GET</SelectItem><SelectItem value="POST">POST</SelectItem></SelectContent>
            </Select>
          </div>
          <Button onClick={run} disabled={!endpoint || isPending} className="w-full">
            {isPending ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Testing payloads...</> : <><Play className="h-4 w-4 mr-2" /> Run {mode === "sql" ? "SQL Injection" : "XSS"} Test</>}
          </Button>
        </CardContent>
      </Card>
      {result && <ResultPanel title={`${mode === "sql" ? "SQL Injection" : "XSS"} Results`} data={result} risk={result.risk} />}
    </div>
  );
}

// ─── Data Protection Tab ──────────────────────────────────────────
function DataProtectionTab() {
  const [mode, setMode] = useState<"sensitive" | "traversal">("sensitive");
  const [endpoint, setEndpoint] = useState("");
  const [paramName, setParamName] = useState("file");
  const [result, setResult] = useState<any>(null);

  const sensitive = trpc.cyberMcp.checkSensitiveData.useMutation({ onSuccess: setResult, onError: e => toast.error(e.message) });
  const traversal = trpc.cyberMcp.checkPathTraversal.useMutation({ onSuccess: setResult, onError: e => toast.error(e.message) });
  const isPending = sensitive.isPending || traversal.isPending;

  const run = () => {
    setResult(null);
    if (mode === "sensitive") sensitive.mutate({ endpoint });
    else traversal.mutate({ endpoint, paramName });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2"><Eye className="h-4 w-4 text-primary" /> Data Protection</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Button variant={mode === "sensitive" ? "default" : "outline"} size="sm" onClick={() => setMode("sensitive")} className="h-8 text-xs">Sensitive Data Exposure</Button>
            <Button variant={mode === "traversal" ? "default" : "outline"} size="sm" onClick={() => setMode("traversal")} className="h-8 text-xs">Path Traversal</Button>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Target Endpoint</Label>
            <Input placeholder="https://api.example.com/data" value={endpoint} onChange={e => setEndpoint(e.target.value)} className="h-9 text-sm font-mono" />
          </div>
          {mode === "traversal" && (
            <div className="space-y-1">
              <Label className="text-xs">File Parameter Name</Label>
              <Input placeholder="file" value={paramName} onChange={e => setParamName(e.target.value)} className="h-9 text-sm" />
            </div>
          )}
          <Button onClick={run} disabled={!endpoint || isPending} className="w-full">
            {isPending ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Scanning...</> : <><Play className="h-4 w-4 mr-2" /> Run {mode === "sensitive" ? "Sensitive Data" : "Path Traversal"} Check</>}
          </Button>
        </CardContent>
      </Card>
      {result && <ResultPanel title="Data Protection Results" data={result} risk={result.risk} />}
    </div>
  );
}

// ─── Infrastructure Tab ───────────────────────────────────────────
function InfrastructureTab() {
  const [mode, setMode] = useState<"headers" | "ratelimit">("headers");
  const [endpoint, setEndpoint] = useState("");
  const [requestCount, setRequestCount] = useState(20);
  const [result, setResult] = useState<any>(null);

  const headers = trpc.cyberMcp.checkSecurityHeaders.useMutation({ onSuccess: setResult, onError: e => toast.error(e.message) });
  const rateLimit = trpc.cyberMcp.checkRateLimit.useMutation({ onSuccess: setResult, onError: e => toast.error(e.message) });
  const isPending = headers.isPending || rateLimit.isPending;

  const run = () => {
    setResult(null);
    if (mode === "headers") headers.mutate({ endpoint });
    else rateLimit.mutate({ endpoint, requestCount });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2"><Activity className="h-4 w-4 text-primary" /> Infrastructure Testing</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Button variant={mode === "headers" ? "default" : "outline"} size="sm" onClick={() => setMode("headers")} className="h-8 text-xs">Security Headers</Button>
            <Button variant={mode === "ratelimit" ? "default" : "outline"} size="sm" onClick={() => setMode("ratelimit")} className="h-8 text-xs">Rate Limiting</Button>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Target Endpoint</Label>
            <Input placeholder="https://api.example.com" value={endpoint} onChange={e => setEndpoint(e.target.value)} className="h-9 text-sm font-mono" />
          </div>
          {mode === "ratelimit" && (
            <div className="space-y-1">
              <Label className="text-xs">Number of Requests (5–50)</Label>
              <Input type="number" min={5} max={50} value={requestCount} onChange={e => setRequestCount(Number(e.target.value))} className="h-9 text-sm w-32" />
            </div>
          )}
          <Button onClick={run} disabled={!endpoint || isPending} className="w-full">
            {isPending ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Testing...</> : <><Play className="h-4 w-4 mr-2" /> Run {mode === "headers" ? "Headers" : "Rate Limit"} Check</>}
          </Button>
        </CardContent>
      </Card>

      {result && mode === "headers" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Security Headers Analysis</h3>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Score: {result.score}%</span>
              <RiskBadge risk={result.risk} />
            </div>
          </div>
          <div className="grid gap-2">
            {result.headers?.map((h: any) => (
              <div key={h.name} className="flex items-start justify-between p-3 rounded-lg bg-muted/30 border border-border/40">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {h.present ? <CheckCircle className="h-3.5 w-3.5 text-green-500 shrink-0" /> : <XCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />}
                    <span className="text-xs font-mono font-medium truncate">{h.name}</span>
                    <Badge variant="outline" className="text-[10px] h-4 shrink-0">{h.severity}</Badge>
                  </div>
                  {h.present && h.value && <p className="text-[11px] text-muted-foreground font-mono truncate ml-5">{h.value}</p>}
                  {!h.present && <p className="text-[11px] text-muted-foreground ml-5">{h.recommendation}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {result && mode === "ratelimit" && <ResultPanel title="Rate Limit Results" data={result} risk={result.risk} />}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────
export default function CyberMCPPage() {
  return (
    <div className="w-full max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <Shield className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight">CyberMCP</h1>
              <p className="text-xs text-muted-foreground">AI-powered API Security Testing · 14 Security Tools</p>
            </div>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap justify-end">
          {["Auth", "Injection", "Data", "Headers", "Rate Limit"].map(tag => (
            <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
          ))}
        </div>
      </div>

      {/* Info Banner */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="py-3 px-4">
          <div className="flex items-start gap-3">
            <Info className="h-4 w-4 text-primary mt-0.5 shrink-0" />
            <div className="text-xs text-muted-foreground space-y-1">
              <p><strong className="text-foreground">CyberMCP</strong> performs server-side security tests against your target APIs. All requests are proxied through the Archibald Titan backend — no browser CORS restrictions apply.</p>
              <p>Only test APIs you own or have explicit written permission to test. Unauthorised security testing is illegal.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tool Categories */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { icon: Lock, label: "Authentication", desc: "JWT, bypass, OAuth2, basic/token auth", color: "text-blue-500" },
          { icon: Code, label: "Injection", desc: "SQL injection & XSS detection", color: "text-red-500" },
          { icon: Eye, label: "Data Protection", desc: "Sensitive exposure & path traversal", color: "text-orange-500" },
          { icon: Activity, label: "Infrastructure", desc: "Security headers & rate limiting", color: "text-green-500" },
        ].map(cat => (
          <Card key={cat.label} className="p-3">
            <cat.icon className={`h-5 w-5 ${cat.color} mb-2`} />
            <p className="text-xs font-medium">{cat.label}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">{cat.desc}</p>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="fullscan">
        <TabsList className="grid grid-cols-5 w-full">
          <TabsTrigger value="fullscan" className="text-xs"><Zap className="h-3 w-3 mr-1" />Full Scan</TabsTrigger>
          <TabsTrigger value="auth" className="text-xs"><Lock className="h-3 w-3 mr-1" />Auth</TabsTrigger>
          <TabsTrigger value="injection" className="text-xs"><Code className="h-3 w-3 mr-1" />Injection</TabsTrigger>
          <TabsTrigger value="data" className="text-xs"><Eye className="h-3 w-3 mr-1" />Data</TabsTrigger>
          <TabsTrigger value="infra" className="text-xs"><Activity className="h-3 w-3 mr-1" />Infra</TabsTrigger>
        </TabsList>
        <TabsContent value="fullscan" className="mt-4"><FullScanTab /></TabsContent>
        <TabsContent value="auth" className="mt-4"><AuthTab /></TabsContent>
        <TabsContent value="injection" className="mt-4"><InjectionTab /></TabsContent>
        <TabsContent value="data" className="mt-4"><DataProtectionTab /></TabsContent>
        <TabsContent value="infra" className="mt-4"><InfrastructureTab /></TabsContent>
      </Tabs>
    </div>
  );
}
