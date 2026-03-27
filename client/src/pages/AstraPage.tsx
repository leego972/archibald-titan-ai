/**
 * Astra Page — Automated REST API Security Testing
 * Security section — accessible to cyber, cyber_plus, and titan tiers.
 *
 * Astra tests for: SQL injection, XSS, Information Leakage, Broken Auth,
 * CSRF, Rate limiting, CORS misconfiguration, JWT attacks, CRLF injection,
 * Blind XXE, SSRF, Template Injection
 *
 * Reference: https://github.com/flipkart-incubator/Astra
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
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Shield, ShieldAlert, Server, Play, RefreshCw, Terminal,
  CheckCircle, XCircle, AlertTriangle, Info, Download,
  List, FileText, Wifi, WifiOff, Settings, Upload,
  ChevronDown, ChevronUp, Copy, Trash2, ExternalLink,
} from "lucide-react";

// ─── Status Indicator ─────────────────────────────────────────────
function StatusDot({ running }: { running: boolean }) {
  return (
    <span className={`inline-block h-2 w-2 rounded-full ${running ? "bg-green-500 animate-pulse" : "bg-red-500"}`} />
  );
}

// ─── Severity Badge ───────────────────────────────────────────────
function SeverityBadge({ impact }: { impact: string }) {
  const lower = (impact || "").toLowerCase();
  const cfg = lower.includes("critical") ? { label: "Critical", cls: "bg-red-600 text-white" }
    : lower.includes("high") ? { label: "High", cls: "bg-orange-500 text-white" }
    : lower.includes("medium") ? { label: "Medium", cls: "bg-yellow-500 text-black" }
    : lower.includes("low") ? { label: "Low", cls: "bg-blue-500 text-white" }
    : { label: "Info", cls: "bg-gray-500 text-white" };
  return <Badge className={`text-[10px] font-bold ${cfg.cls}`}>{cfg.label}</Badge>;
}

// ─── Setup Tab ────────────────────────────────────────────────────
function SetupTab({ onConnected }: { onConnected: () => void }) {
  const [host, setHost] = useState("");
  const [port, setPort] = useState(22);
  const [username, setUsername] = useState("root");
  const [authType, setAuthType] = useState<"password" | "key">("password");
  const [password, setPassword] = useState("");
  const [privateKey, setPrivateKey] = useState("");
  const [astraPort, setAstraPort] = useState(8094);
  const [testResult, setTestResult] = useState<any>(null);

  const testConn = trpc.astra.testConnection.useMutation({
    onSuccess: (data) => { setTestResult(data); if (data.success) toast.success("SSH connection successful!"); },
    onError: (e) => toast.error(`Connection failed: ${e.message}`),
  });

  const saveConn = trpc.astra.saveConnection.useMutation({
    onSuccess: () => { toast.success("Connection saved"); onConnected(); },
    onError: (e) => toast.error(e.message),
  });

  const install = trpc.astra.install.useMutation({
    onSuccess: (data) => { toast[data.success ? "success" : "error"](data.success ? "Astra installed successfully!" : "Installation may have issues — check output"); },
    onError: (e) => toast.error(e.message),
  });

  const start = trpc.astra.start.useMutation({
    onSuccess: (data) => { toast[data.success ? "success" : "warning"](data.message); if (data.success) onConnected(); },
    onError: (e) => toast.error(e.message),
  });

  const stop = trpc.astra.stop.useMutation({
    onSuccess: () => toast.success("Astra stopped"),
    onError: (e) => toast.error(e.message),
  });

  const isPending = testConn.isPending || saveConn.isPending || install.isPending || start.isPending || stop.isPending;

  const connInput = { host, port, username, authType, password: authType === "password" ? password : undefined, privateKey: authType === "key" ? privateKey : undefined, astraPort };

  return (
    <div className="space-y-4">
      {/* Installation Guide */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="py-3 px-4">
          <div className="flex items-start gap-3">
            <Info className="h-4 w-4 text-primary mt-0.5 shrink-0" />
            <div className="text-xs text-muted-foreground space-y-2">
              <p><strong className="text-foreground">Astra</strong> is a Python/Flask REST API security scanner by Flipkart. It runs on your VPS and tests for 12+ vulnerability classes.</p>
              <div className="bg-muted/60 rounded p-2 font-mono text-[11px] space-y-0.5">
                <p className="text-green-400"># Quick install (runs automatically via "Install Astra" button)</p>
                <p>git clone https://github.com/flipkart-incubator/Astra</p>
                <p>cd Astra && sudo pip install -r requirements.txt</p>
                <p>sudo rabbitmq-server &</p>
                <p>celery -A worker -loglevel=INFO &</p>
                <p>cd API && python3 api.py</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* SSH Connection */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2"><Server className="h-4 w-4 text-primary" /> VPS Connection</CardTitle>
          <CardDescription className="text-xs">Connect to the server where Astra is (or will be) installed</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2 space-y-1">
              <Label className="text-xs">Host / IP Address</Label>
              <Input placeholder="192.168.1.100 or vps.example.com" value={host} onChange={e => setHost(e.target.value)} className="h-9 text-sm font-mono" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">SSH Port</Label>
              <Input type="number" value={port} onChange={e => setPort(Number(e.target.value))} className="h-9 text-sm" />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Username</Label>
              <Input value={username} onChange={e => setUsername(e.target.value)} className="h-9 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Astra Port</Label>
              <Input type="number" value={astraPort} onChange={e => setAstraPort(Number(e.target.value))} className="h-9 text-sm" />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Authentication</Label>
            <div className="flex gap-2">
              <Button variant={authType === "password" ? "default" : "outline"} size="sm" onClick={() => setAuthType("password")} className="h-8 text-xs">Password</Button>
              <Button variant={authType === "key" ? "default" : "outline"} size="sm" onClick={() => setAuthType("key")} className="h-8 text-xs">SSH Key</Button>
            </div>
          </div>
          {authType === "password" ? (
            <div className="space-y-1">
              <Label className="text-xs">Password</Label>
              <Input type="password" value={password} onChange={e => setPassword(e.target.value)} className="h-9 text-sm" />
            </div>
          ) : (
            <div className="space-y-1">
              <Label className="text-xs">Private Key (PEM format)</Label>
              <Textarea placeholder="-----BEGIN RSA PRIVATE KEY-----&#10;..." value={privateKey} onChange={e => setPrivateKey(e.target.value)} className="text-xs font-mono h-28 resize-none" />
            </div>
          )}

          <div className="flex gap-2 flex-wrap">
            <Button onClick={() => testConn.mutate(connInput)} disabled={!host || isPending} variant="outline" size="sm" className="h-9">
              {testConn.isPending ? <RefreshCw className="h-3.5 w-3.5 animate-spin mr-1" /> : <Wifi className="h-3.5 w-3.5 mr-1" />} Test Connection
            </Button>
            <Button onClick={() => saveConn.mutate(connInput)} disabled={!host || isPending} variant="outline" size="sm" className="h-9">
              <Settings className="h-3.5 w-3.5 mr-1" /> Save Connection
            </Button>
            <Button onClick={() => install.mutate()} disabled={!testResult?.success || isPending} variant="outline" size="sm" className="h-9">
              {install.isPending ? <RefreshCw className="h-3.5 w-3.5 animate-spin mr-1" /> : <Download className="h-3.5 w-3.5 mr-1" />} Install Astra
            </Button>
            <Button onClick={() => start.mutate()} disabled={!testResult?.success || isPending} size="sm" className="h-9">
              {start.isPending ? <RefreshCw className="h-3.5 w-3.5 animate-spin mr-1" /> : <Play className="h-3.5 w-3.5 mr-1" />} Start Astra
            </Button>
            <Button onClick={() => stop.mutate()} disabled={isPending} variant="destructive" size="sm" className="h-9">
              <WifiOff className="h-3.5 w-3.5 mr-1" /> Stop
            </Button>
          </div>

          {testResult && (
            <div className={`rounded-lg p-3 text-xs border ${testResult.success ? "bg-green-500/10 border-green-500/30" : "bg-red-500/10 border-red-500/30"}`}>
              <div className="flex items-center gap-2 mb-1">
                {testResult.success ? <CheckCircle className="h-3.5 w-3.5 text-green-500" /> : <XCircle className="h-3.5 w-3.5 text-red-500" />}
                <span className="font-medium">{testResult.success ? "Connected" : "Failed"}</span>
                {testResult.astraRunning !== undefined && (
                  <span className={`ml-auto ${testResult.astraRunning ? "text-green-500" : "text-orange-500"}`}>
                    Astra: {testResult.astraRunning ? "Running" : "Not running"}
                  </span>
                )}
              </div>
              {testResult.osInfo && <p className="text-muted-foreground font-mono mt-1">{testResult.osInfo.split("\n")[0]}</p>}
              {testResult.message && <p className="text-muted-foreground mt-1">{testResult.message}</p>}
            </div>
          )}

          {install.data && (
            <div className="bg-muted/50 rounded p-3">
              <p className="text-xs font-medium mb-1">Installation Output:</p>
              <pre className="text-[11px] font-mono text-muted-foreground whitespace-pre-wrap max-h-40 overflow-auto">{install.data.output}</pre>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Scan Tab ─────────────────────────────────────────────────────
function ScanTab() {
  const [appname, setAppname] = useState("");
  const [url, setUrl] = useState("");
  const [method, setMethod] = useState<"GET" | "POST">("GET");
  const [headers, setHeaders] = useState("");
  const [body, setBody] = useState("");
  const [authHeader, setAuthHeader] = useState("");
  const [authUrl, setAuthUrl] = useState("");
  const [mode, setMode] = useState<"single" | "postman" | "fuzzer" | "wfuzz">("single");
  const [collectionUrl, setCollectionUrl] = useState("");

  const startScan = trpc.astra.startScan.useMutation({
    onSuccess: (data) => toast.success(`Scan started! ID: ${data.scanId}`),
    onError: (e) => toast.error(e.message),
  });

  const postmanScan = trpc.astra.startPostmanScan.useMutation({
    onSuccess: (data) => toast.success(`Postman scan started! ID: ${data.scanId}`),
    onError: (e) => toast.error(e.message),
  });
  const startFuzzer = trpc.astra.startFuzzer.useMutation({
    onSuccess: (data) => toast.success(`Fuzzer started on ${data.target}`),
    onError: (e) => toast.error(e.message),
  });
  const startWfuzz = trpc.astra.startWfuzz.useMutation({
    onSuccess: (data) => toast.success(`Wfuzz started on ${data.target}`),
    onError: (e) => toast.error(e.message),
  });

  const isPending = startScan.isPending || postmanScan.isPending || startFuzzer.isPending || startWfuzz.isPending;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2"><Play className="h-4 w-4 text-primary" /> Start New Scan</CardTitle>
          <CardDescription className="text-xs">Astra will test the target for 12+ vulnerability classes</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2 flex-wrap">
            <Button variant={mode === "single" ? "default" : "outline"} size="sm" onClick={() => setMode("single")} className="h-8 text-xs">Single API</Button>
            <Button variant={mode === "postman" ? "default" : "outline"} size="sm" onClick={() => setMode("postman")} className="h-8 text-xs">Postman Collection</Button>
            <Button variant={mode === "fuzzer" ? "default" : "outline"} size="sm" onClick={() => setMode("fuzzer" as any)} className="h-8 text-xs">Fuzzer (Astra)</Button>
            <Button variant={mode === "wfuzz" ? "default" : "outline"} size="sm" onClick={() => setMode("wfuzz" as any)} className="h-8 text-xs">Wfuzz</Button>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Application Name</Label>
            <Input placeholder="My API v2" value={appname} onChange={e => setAppname(e.target.value)} className="h-9 text-sm" />
          </div>

          {mode === "single" ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-2 space-y-1">
                  <Label className="text-xs">Target URL</Label>
                  <Input placeholder="https://api.example.com/v1/users" value={url} onChange={e => setUrl(e.target.value)} className="h-9 text-sm font-mono" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Method</Label>
                  <Select value={method} onValueChange={(v: any) => setMethod(v)}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="GET">GET</SelectItem><SelectItem value="POST">POST</SelectItem></SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Headers (JSON, optional)</Label>
                <Input placeholder='{"Authorization": "Bearer token", "X-API-Key": "key"}' value={headers} onChange={e => setHeaders(e.target.value)} className="h-9 text-sm font-mono" />
              </div>
              {method === "POST" && (
                <div className="space-y-1">
                  <Label className="text-xs">Request Body</Label>
                  <Textarea placeholder='{"username": "test", "password": "test"}' value={body} onChange={e => setBody(e.target.value)} className="text-sm font-mono h-20 resize-none" />
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Auth Header (optional)</Label>
                  <Input placeholder="Authorization: Bearer token" value={authHeader} onChange={e => setAuthHeader(e.target.value)} className="h-9 text-sm font-mono" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Auth Refresh URL (optional)</Label>
                  <Input placeholder="https://api.example.com/auth/refresh" value={authUrl} onChange={e => setAuthUrl(e.target.value)} className="h-9 text-sm font-mono" />
                </div>
              </div>
              <Button onClick={() => startScan.mutate({ appname, url, method, headers: headers || undefined, body: body || undefined, authHeader: authHeader || undefined, authUrl: authUrl || undefined })} disabled={!appname || !url || isPending} className="w-full">
                {isPending ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Starting scan...</> : <><Play className="h-4 w-4 mr-2" /> Start Security Scan</>}
              </Button>
            </>
          ) : (
            <>
              <div className="space-y-1">
                <Label className="text-xs">Postman Collection URL (public)</Label>
                <Input placeholder="https://www.getpostman.com/collections/..." value={collectionUrl} onChange={e => setCollectionUrl(e.target.value)} className="h-9 text-sm font-mono" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Auth Header (optional)</Label>
                <Input placeholder="Authorization: Bearer token" value={authHeader} onChange={e => setAuthHeader(e.target.value)} className="h-9 text-sm font-mono" />
              </div>
              <Button onClick={() => postmanScan.mutate({ appname, collectionUrl, authHeader: authHeader || undefined })} disabled={!appname || !collectionUrl || isPending} className="w-full">
                {isPending ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Starting scan...</> : <><Upload className="h-4 w-4 mr-2" /> Start Postman Scan</>}
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* Vulnerability Coverage */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Vulnerability Coverage</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {["SQL Injection", "Cross-Site Scripting (XSS)", "Information Leakage",
              "Broken Authentication", "CSRF / Blind CSRF", "Rate Limiting",
              "CORS Misconfiguration", "JWT Attacks", "CRLF Injection",
              "Blind XXE Injection", "Server-Side Request Forgery", "Template Injection",
              "Path Traversal", "Open Redirect", "Business Logic Flaws",
            ].map(vuln => (
              <div key={vuln} className="flex items-center gap-2 text-xs">
                <CheckCircle className="h-3 w-3 text-green-500 shrink-0" />
                <span>{vuln}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Results Tab ──────────────────────────────────────────────────
function ResultsTab() {
  const [selectedScanId, setSelectedScanId] = useState<string | null>(null);
  const [expandedAlert, setExpandedAlert] = useState<number | null>(null);

  const scans = trpc.astra.listScans.useQuery(undefined, { refetchInterval: 10000 });
  const alerts = trpc.astra.getAlerts.useQuery(
    { scanId: selectedScanId! },
    { enabled: !!selectedScanId }
  );

  return (
    <div className="space-y-4">
      {/* Scan List */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2"><List className="h-4 w-4 text-primary" /> Scans</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => scans.refetch()} className="h-7 text-xs">
              <RefreshCw className={`h-3 w-3 mr-1 ${scans.isFetching ? "animate-spin" : ""}`} /> Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {scans.isLoading ? (
            <div className="text-center py-6 text-xs text-muted-foreground"><RefreshCw className="h-4 w-4 animate-spin mx-auto mb-2" />Loading scans...</div>
          ) : scans.data?.scans?.length === 0 ? (
            <div className="text-center py-6 text-xs text-muted-foreground">No scans yet — start a scan from the Scan tab</div>
          ) : (
            <div className="space-y-2">
              {scans.data?.scans?.map((scan: any) => (
                <div key={scan.scanid} onClick={() => setSelectedScanId(scan.scanid)}
                  className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${selectedScanId === scan.scanid ? "border-primary bg-primary/5" : "border-border/40 hover:border-border"}`}>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium truncate">{scan.name}</p>
                    <p className="text-[11px] text-muted-foreground font-mono truncate">{scan.url}</p>
                  </div>
                  <div className="flex items-center gap-2 ml-3 shrink-0">
                    <Badge variant="outline" className="text-[10px]">{scan.scan_status || "running"}</Badge>
                    <span className="text-[10px] text-muted-foreground font-mono">{scan.scanid?.substring(0, 8)}...</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Alerts */}
      {selectedScanId && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2"><ShieldAlert className="h-4 w-4 text-primary" /> Vulnerabilities Found</CardTitle>
              {alerts.data && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  {alerts.data.bySeverity.critical > 0 && <Badge className="bg-red-600 text-white text-[10px]">{alerts.data.bySeverity.critical} Critical</Badge>}
                  {alerts.data.bySeverity.high > 0 && <Badge className="bg-orange-500 text-white text-[10px]">{alerts.data.bySeverity.high} High</Badge>}
                  {alerts.data.bySeverity.medium > 0 && <Badge className="bg-yellow-500 text-black text-[10px]">{alerts.data.bySeverity.medium} Medium</Badge>}
                  {alerts.data.bySeverity.low > 0 && <Badge className="bg-blue-500 text-white text-[10px]">{alerts.data.bySeverity.low} Low</Badge>}
                  <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={() => {
                    const blob = new Blob([JSON.stringify(alerts.data, null, 2)], { type: "application/json" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a"); a.href = url; a.download = `astra_scan_${selectedScanId}_${Date.now()}.json`; a.click();
                    URL.revokeObjectURL(url); toast.success("Exported scan results");
                  }}><Download className="h-3 w-3 mr-1" /> Export</Button>
                  <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={() => { navigator.clipboard.writeText(JSON.stringify(alerts.data, null, 2)); toast.success("Copied"); }}><Copy className="h-3 w-3 mr-1" /> Copy</Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {alerts.isLoading ? (
              <div className="text-center py-6 text-xs text-muted-foreground"><RefreshCw className="h-4 w-4 animate-spin mx-auto mb-2" />Loading vulnerabilities...</div>
            ) : alerts.data?.alerts?.length === 0 ? (
              <div className="text-center py-6">
                <CheckCircle className="h-8 w-8 text-green-500 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">No vulnerabilities detected in this scan</p>
              </div>
            ) : (
              <div className="space-y-2">
                {alerts.data?.alerts?.map((alert: any, i: number) => (
                  <div key={i} className="border border-border/40 rounded-lg overflow-hidden">
                    <div className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/30" onClick={() => setExpandedAlert(expandedAlert === i ? null : i)}>
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <SeverityBadge impact={alert.impact} />
                        <span className="text-xs font-medium truncate">{alert.name}</span>
                      </div>
                      <div className="flex items-center gap-2 ml-2 shrink-0">
                        <span className="text-[11px] text-muted-foreground font-mono truncate max-w-[120px]">{alert.url}</span>
                        {expandedAlert === i ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
                      </div>
                    </div>
                    {expandedAlert === i && (
                      <div className="px-3 pb-3 space-y-2 border-t border-border/40 bg-muted/20">
                        {alert.Description && (
                          <div className="pt-2">
                            <p className="text-[11px] font-medium text-muted-foreground mb-1">Description</p>
                            <p className="text-xs">{alert.Description}</p>
                          </div>
                        )}
                        {alert.remediation && (
                          <div>
                            <p className="text-[11px] font-medium text-muted-foreground mb-1">Remediation</p>
                            <p className="text-xs text-green-600 dark:text-green-400">{alert.remediation}</p>
                          </div>
                        )}
                        {alert.req_headers && (
                          <div>
                            <p className="text-[11px] font-medium text-muted-foreground mb-1">Request Headers</p>
                            <pre className="text-[11px] font-mono bg-muted/50 rounded p-2 overflow-auto max-h-24">{typeof alert.req_headers === "string" ? alert.req_headers : JSON.stringify(alert.req_headers, null, 2)}</pre>
                          </div>
                        )}
                        {alert.res_body && (
                          <div>
                            <p className="text-[11px] font-medium text-muted-foreground mb-1">Response Body (excerpt)</p>
                            <pre className="text-[11px] font-mono bg-muted/50 rounded p-2 overflow-auto max-h-24">{String(alert.res_body).substring(0, 500)}</pre>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Status Tab ───────────────────────────────────────────────────
function StatusTab() {
  const status = trpc.astra.getStatus.useQuery(undefined, { refetchInterval: 15000, retry: false });
  const logs = trpc.astra.getLogs.useMutation({ onError: e => toast.error(e.message) });
  const update = trpc.astra.update.useMutation({
    onSuccess: (data) => toast[data.success ? "success" : "warning"](data.success ? "Astra updated to latest version" : "Update may have issues"),
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2"><Server className="h-4 w-4 text-primary" /> Service Status</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => status.refetch()} className="h-7 text-xs">
              <RefreshCw className={`h-3 w-3 mr-1 ${status.isFetching ? "animate-spin" : ""}`} /> Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {status.error ? (
            <div className="text-center py-6">
              <WifiOff className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">No connection configured — set up your server in the Setup tab</p>
            </div>
          ) : status.data ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Astra API", value: status.data.astraRunning ? "Running" : "Stopped", ok: status.data.astraRunning },
                  { label: "Host", value: status.data.host, ok: true },
                  { label: "API Port", value: String(status.data.astraPort), ok: true },
                  { label: "RabbitMQ", value: status.data.rabbitmqStatus?.includes("active") || status.data.rabbitmqStatus?.includes("running") ? "Active" : "Check required", ok: !!(status.data.rabbitmqStatus?.includes("active") || status.data.rabbitmqStatus?.includes("running")) },
                ].map(item => (
                  <div key={item.label} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/40">
                    <span className="text-xs text-muted-foreground">{item.label}</span>
                    <div className="flex items-center gap-1.5">
                      <StatusDot running={item.ok} />
                      <span className="text-xs font-medium">{item.value}</span>
                    </div>
                  </div>
                ))}
              </div>
              {status.data.apiProcess && (
                <div className="p-2 bg-muted/30 rounded text-[11px] font-mono text-muted-foreground truncate">
                  {status.data.apiProcess}
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-6 text-xs text-muted-foreground"><RefreshCw className="h-4 w-4 animate-spin mx-auto mb-2" />Checking status...</div>
          )}
        </CardContent>
      </Card>

      {/* Logs */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2"><Terminal className="h-4 w-4 text-primary" /> Logs</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Button onClick={() => logs.mutate({ logType: "api", lines: 50 })} disabled={logs.isPending} variant="outline" size="sm" className="h-8 text-xs">
              {logs.isPending ? <RefreshCw className="h-3 w-3 animate-spin mr-1" /> : <FileText className="h-3 w-3 mr-1" />} API Logs
            </Button>
            <Button onClick={() => logs.mutate({ logType: "celery", lines: 50 })} disabled={logs.isPending} variant="outline" size="sm" className="h-8 text-xs">
              {logs.isPending ? <RefreshCw className="h-3 w-3 animate-spin mr-1" /> : <FileText className="h-3 w-3 mr-1" />} Celery Logs
            </Button>
            <Button onClick={() => update.mutate()} disabled={update.isPending} variant="outline" size="sm" className="h-8 text-xs ml-auto">
              {update.isPending ? <RefreshCw className="h-3 w-3 animate-spin mr-1" /> : <Download className="h-3 w-3 mr-1" />} Update Astra
            </Button>
          </div>
          {logs.data && (
            <div className="bg-black/90 rounded-lg p-3">
              <pre className="text-[11px] font-mono text-green-400 whitespace-pre-wrap max-h-64 overflow-auto">{logs.data.output || "No log output"}</pre>
            </div>
          )}
          {update.data && (
            <div className="bg-muted/50 rounded p-3">
              <pre className="text-[11px] font-mono text-muted-foreground whitespace-pre-wrap max-h-40 overflow-auto">{update.data.output}</pre>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────
export default function AstraPage() {
  const [activeTab, setActiveTab] = useState("scan");
  const status = trpc.astra.getStatus.useQuery(undefined, { retry: false, refetchInterval: 30000 });

  return (
    <div className="w-full max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="h-9 w-9 rounded-lg bg-orange-500/10 flex items-center justify-center">
              <ShieldAlert className="h-5 w-5 text-orange-500" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-semibold tracking-tight">Astra</h1>
                {status.data && (
                  <div className="flex items-center gap-1.5">
                    <StatusDot running={status.data.astraRunning} />
                    <span className="text-xs text-muted-foreground">{status.data.astraRunning ? "Running" : "Offline"}</span>
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground">Automated REST API Security Testing · 12 Vulnerability Classes</p>
            </div>
          </div>
        </div>
        <a href="https://github.com/flipkart-incubator/Astra" target="_blank" rel="noopener noreferrer">
          <Button variant="ghost" size="sm" className="h-8 text-xs">
            <ExternalLink className="h-3.5 w-3.5 mr-1" /> GitHub
          </Button>
        </a>
      </div>

      {/* Info Banner */}
      <Card className="border-orange-500/20 bg-orange-500/5">
        <CardContent className="py-3 px-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-4 w-4 text-orange-500 mt-0.5 shrink-0" />
            <p className="text-xs text-muted-foreground">
              <strong className="text-foreground">Astra</strong> is a Black Hat Arsenal tool by Flipkart Incubator. It performs active security testing and sends real attack payloads to the target. Only test APIs you own or have explicit written permission to test. Unauthorised testing is illegal.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-4 w-full">
          <TabsTrigger value="setup" className="text-xs"><Settings className="h-3 w-3 mr-1" />Setup</TabsTrigger>
          <TabsTrigger value="scan" className="text-xs"><Play className="h-3 w-3 mr-1" />Scan</TabsTrigger>
          <TabsTrigger value="results" className="text-xs"><ShieldAlert className="h-3 w-3 mr-1" />Results</TabsTrigger>
          <TabsTrigger value="status" className="text-xs"><Server className="h-3 w-3 mr-1" />Status</TabsTrigger>
        </TabsList>
        <TabsContent value="setup" className="mt-4"><SetupTab onConnected={() => setActiveTab("scan")} /></TabsContent>
        <TabsContent value="scan" className="mt-4"><ScanTab /></TabsContent>
        <TabsContent value="results" className="mt-4"><ResultsTab /></TabsContent>
        <TabsContent value="status" className="mt-4"><StatusTab /></TabsContent>
      </Tabs>
    </div>
  );
}
