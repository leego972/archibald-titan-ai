/**
 * Argus Page — OSINT & Reconnaissance Toolkit
 * Security section — accessible to cyber, cyber_plus, and titan tiers.
 *
 * 135 modules across 3 categories:
 * - Network & Infrastructure (52 modules)
 * - Web Application Analysis (50 modules)
 * - Security & Threat Intelligence (33 modules)
 *
 * Reference: https://github.com/jasonxtn/argus
 */
import { useState, useMemo } from "react";
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
  Search, Play, RefreshCw, Terminal, Server, Settings,
  CheckCircle, XCircle, Download, Globe, Shield,
  Network, Code, Eye, Zap, ChevronDown, ChevronUp,
  Copy, ExternalLink, List, Star, Info, AlertTriangle,
  Wifi, WifiOff, Key,
} from "lucide-react";

// ─── Category Config ──────────────────────────────────────────────
const CATEGORY_CONFIG = {
  network: { label: "Network & Infrastructure", icon: Network, color: "text-blue-500", bg: "bg-blue-500/10" },
  web: { label: "Web Application", icon: Globe, color: "text-green-500", bg: "bg-green-500/10" },
  security: { label: "Security & Threat Intel", icon: Shield, color: "text-red-500", bg: "bg-red-500/10" },
};

// ─── Module Card ──────────────────────────────────────────────────
function ModuleCard({ module, selected, onSelect }: { module: any; selected: boolean; onSelect: () => void }) {
  const cat = CATEGORY_CONFIG[module.category as keyof typeof CATEGORY_CONFIG];
  return (
    <div
      onClick={onSelect}
      className={`p-3 rounded-lg border cursor-pointer transition-all ${selected ? "border-primary bg-primary/5" : "border-border/40 hover:border-border"}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-[10px] font-mono text-muted-foreground">#{module.id}</span>
            <span className="text-xs font-medium truncate">{module.name}</span>
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed">{module.description}</p>
        </div>
        <Badge variant="outline" className={`text-[10px] shrink-0 ${cat.color}`}>{cat.label.split(" ")[0]}</Badge>
      </div>
    </div>
  );
}

// ─── Output Panel ─────────────────────────────────────────────────
function OutputPanel({ title, output, duration, target }: { title: string; output: string; duration?: number; target?: string }) {
  const [expanded, setExpanded] = useState(true);
  return (
    <Card className="mt-4 border-border/60">
      <CardHeader className="py-3 px-4 cursor-pointer" onClick={() => setExpanded(e => !e)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Terminal className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
            {target && <Badge variant="secondary" className="text-[10px] font-mono">{target}</Badge>}
            {duration !== undefined && <span className="text-[11px] text-muted-foreground">{(duration / 1000).toFixed(1)}s</span>}
          </div>
          {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </CardHeader>
      {expanded && (
        <CardContent className="px-4 pb-4">
          <div className="bg-black/90 rounded-lg p-3">
            <pre className="text-[11px] font-mono text-green-400 whitespace-pre-wrap max-h-80 overflow-auto">{output || "No output"}</pre>
          </div>
          <Button variant="ghost" size="sm" className="mt-2 h-7 text-xs" onClick={() => { navigator.clipboard.writeText(output); toast.success("Copied to clipboard"); }}>
            <Copy className="h-3 w-3 mr-1" /> Copy Output
          </Button>
        </CardContent>
      )}
    </Card>
  );
}

// ─── Setup Tab ────────────────────────────────────────────────────
function SetupTab({ onConnected }: { onConnected: () => void }) {
  const [host, setHost] = useState("");
  const [port, setPort] = useState(22);
  const [username, setUsername] = useState("root");
  const [authType, setAuthType] = useState<"password" | "key">("password");
  const [password, setPassword] = useState("");
  const [privateKey, setPrivateKey] = useState("");
  const [installMethod, setInstallMethod] = useState<"git" | "pip" | "docker">("git");
  const [testResult, setTestResult] = useState<any>(null);
  const [apiKeys, setApiKeys] = useState({ virustotalKey: "", shodanKey: "", censysId: "", censysSecret: "", hibpKey: "", googleKey: "" });

  const testConn = trpc.argus.testConnection.useMutation({ onSuccess: setTestResult, onError: e => toast.error(`Connection failed: ${e.message}`) });
  const saveConn = trpc.argus.saveConnection.useMutation({ onSuccess: () => { toast.success("Connection saved"); onConnected(); }, onError: e => toast.error(e.message) });
  const install = trpc.argus.install.useMutation({ onSuccess: d => toast[d.success ? "success" : "warning"](d.success ? "Argus installed!" : "Check install output"), onError: e => toast.error(e.message) });
  const setKeys = trpc.argus.setApiKeys.useMutation({ onSuccess: d => toast.success(`${d.keysConfigured} API key(s) configured`), onError: e => toast.error(e.message) });

  const isPending = testConn.isPending || saveConn.isPending || install.isPending || setKeys.isPending;
  const connInput = { host, port, username, authType, password: authType === "password" ? password : undefined, privateKey: authType === "key" ? privateKey : undefined };

  return (
    <div className="space-y-4">
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="py-3 px-4">
          <div className="flex items-start gap-3">
            <Info className="h-4 w-4 text-primary mt-0.5 shrink-0" />
            <div className="text-xs text-muted-foreground space-y-1">
              <p><strong className="text-foreground">Argus</strong> is a Python-based OSINT toolkit with 135 recon modules. It runs on your VPS via SSH.</p>
              <div className="bg-muted/60 rounded p-2 font-mono text-[11px] space-y-0.5">
                <p className="text-green-400"># Option 1: Direct (recommended)</p>
                <p>git clone https://github.com/jasonxtn/argus.git && cd argus</p>
                <p>pip install -r requirements.txt && python -m argus</p>
                <p className="text-green-400 mt-1"># Option 2: pip</p>
                <p>pip install argus-recon && argus</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2"><Server className="h-4 w-4 text-primary" /> VPS Connection</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2 space-y-1">
              <Label className="text-xs">Host / IP</Label>
              <Input placeholder="192.168.1.100 or vps.example.com" value={host} onChange={e => setHost(e.target.value)} className="h-9 text-sm font-mono" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">SSH Port</Label>
              <Input type="number" value={port} onChange={e => setPort(Number(e.target.value))} className="h-9 text-sm" />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Username</Label>
            <Input value={username} onChange={e => setUsername(e.target.value)} className="h-9 text-sm w-48" />
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
              <Input type="password" value={password} onChange={e => setPassword(e.target.value)} className="h-9 text-sm w-64" />
            </div>
          ) : (
            <div className="space-y-1">
              <Label className="text-xs">Private Key (PEM)</Label>
              <Textarea placeholder="-----BEGIN RSA PRIVATE KEY-----&#10;..." value={privateKey} onChange={e => setPrivateKey(e.target.value)} className="text-xs font-mono h-24 resize-none" />
            </div>
          )}
          <div className="flex gap-2 flex-wrap">
            <Button onClick={() => testConn.mutate(connInput)} disabled={!host || isPending} variant="outline" size="sm" className="h-9">
              {testConn.isPending ? <RefreshCw className="h-3.5 w-3.5 animate-spin mr-1" /> : <Wifi className="h-3.5 w-3.5 mr-1" />} Test
            </Button>
            <Button onClick={() => saveConn.mutate(connInput)} disabled={!host || isPending} variant="outline" size="sm" className="h-9">
              <Settings className="h-3.5 w-3.5 mr-1" /> Save
            </Button>
            <div className="flex items-center gap-1">
              <Select value={installMethod} onValueChange={(v: any) => setInstallMethod(v)}>
                <SelectTrigger className="h-9 text-xs w-24"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="git">Git</SelectItem>
                  <SelectItem value="pip">pip</SelectItem>
                  <SelectItem value="docker">Docker</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={() => install.mutate({ method: installMethod })} disabled={!testResult?.success || isPending} size="sm" className="h-9">
                {install.isPending ? <RefreshCw className="h-3.5 w-3.5 animate-spin mr-1" /> : <Download className="h-3.5 w-3.5 mr-1" />} Install Argus
              </Button>
            </div>
          </div>

          {testResult && (
            <div className={`rounded-lg p-3 text-xs border ${testResult.success ? "bg-green-500/10 border-green-500/30" : "bg-red-500/10 border-red-500/30"}`}>
              <div className="flex items-center gap-2 mb-1">
                {testResult.success ? <CheckCircle className="h-3.5 w-3.5 text-green-500" /> : <XCircle className="h-3.5 w-3.5 text-red-500" />}
                <span className="font-medium">{testResult.success ? "Connected" : "Failed"}</span>
                <span className={`ml-auto text-xs ${testResult.argusInstalled ? "text-green-500" : "text-orange-500"}`}>
                  Argus: {testResult.argusInstalled ? "Installed" : "Not installed"}
                </span>
              </div>
              <p className="text-muted-foreground font-mono mt-1">{testResult.message}</p>
            </div>
          )}

          {install.data && (
            <div className="bg-muted/50 rounded p-3">
              <pre className="text-[11px] font-mono text-muted-foreground whitespace-pre-wrap max-h-40 overflow-auto">{install.data.output}</pre>
            </div>
          )}
        </CardContent>
      </Card>

      {/* API Keys */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2"><Key className="h-4 w-4 text-primary" /> API Keys (Optional)</CardTitle>
          <CardDescription className="text-xs">Enhance Argus with threat intelligence API keys</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[
              { key: "virustotalKey", label: "VirusTotal API Key", placeholder: "VT API key" },
              { key: "shodanKey", label: "Shodan API Key", placeholder: "Shodan API key" },
              { key: "censysId", label: "Censys API ID", placeholder: "Censys ID" },
              { key: "censysSecret", label: "Censys API Secret", placeholder: "Censys secret" },
              { key: "hibpKey", label: "HaveIBeenPwned Key", placeholder: "HIBP API key" },
              { key: "googleKey", label: "Google API Key", placeholder: "Google API key" },
            ].map(field => (
              <div key={field.key} className="space-y-1">
                <Label className="text-xs">{field.label}</Label>
                <Input type="password" placeholder={field.placeholder} value={apiKeys[field.key as keyof typeof apiKeys]} onChange={e => setApiKeys(k => ({ ...k, [field.key]: e.target.value }))} className="h-9 text-sm font-mono" />
              </div>
            ))}
          </div>
          <Button onClick={() => setKeys.mutate(apiKeys)} disabled={isPending || Object.values(apiKeys).every(v => !v)} variant="outline" size="sm" className="h-9">
            {setKeys.isPending ? <RefreshCw className="h-3.5 w-3.5 animate-spin mr-1" /> : <Key className="h-3.5 w-3.5 mr-1" />} Save API Keys
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Modules Tab ──────────────────────────────────────────────────
function ModulesTab() {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<"all" | "network" | "web" | "security">("all");
  const [selectedModules, setSelectedModules] = useState<number[]>([]);
  const [target, setTarget] = useState("");
  const [threads, setThreads] = useState(10);
  const [results, setResults] = useState<any[]>([]);

  const modulesData = trpc.argus.getModules.useQuery({ category: "all" });
  const runModule = trpc.argus.runModule.useMutation({ onSuccess: d => { setResults(r => [d, ...r]); toast.success(`${d.moduleName} complete`); }, onError: e => toast.error(e.message) });
  const runBatch = trpc.argus.runBatch.useMutation({ onSuccess: d => { setResults(r => [...d.results.map((r: any) => ({ ...r, target: d.target })), ...r]); toast.success(`Batch scan complete — ${d.totalModules} modules`); }, onError: e => toast.error(e.message) });

  const filteredModules = useMemo(() => {
    const mods = modulesData.data?.modules || [];
    return mods.filter(m => {
      const matchCat = categoryFilter === "all" || m.category === categoryFilter;
      const matchSearch = !search || m.name.toLowerCase().includes(search.toLowerCase()) || m.description.toLowerCase().includes(search.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [modulesData.data, categoryFilter, search]);

  const toggleModule = (id: number) => setSelectedModules(s => s.includes(id) ? s.filter(x => x !== id) : s.length < 10 ? [...s, id] : s);

  return (
    <div className="space-y-4">
      {/* Controls */}
      <Card>
        <CardContent className="py-3 px-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Target Domain / IP</Label>
              <Input placeholder="example.com or 192.168.1.1" value={target} onChange={e => setTarget(e.target.value)} className="h-9 text-sm font-mono" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Threads</Label>
              <Input type="number" min={1} max={50} value={threads} onChange={e => setThreads(Number(e.target.value))} className="h-9 text-sm w-24" />
            </div>
          </div>
          <div className="flex gap-2 flex-wrap items-center">
            <Button onClick={() => runBatch.mutate({ moduleIds: selectedModules, target, threads })} disabled={!target || selectedModules.length === 0 || runBatch.isPending} size="sm" className="h-9">
              {runBatch.isPending ? <RefreshCw className="h-3.5 w-3.5 animate-spin mr-1" /> : <Play className="h-3.5 w-3.5 mr-1" />}
              Run {selectedModules.length > 0 ? `${selectedModules.length} Selected` : "Selected"}
            </Button>
            {selectedModules.length > 0 && (
              <Button onClick={() => setSelectedModules([])} variant="ghost" size="sm" className="h-9 text-xs">Clear Selection</Button>
            )}
            <span className="text-xs text-muted-foreground ml-auto">{selectedModules.length}/10 selected</span>
          </div>
        </CardContent>
      </Card>

      {/* Module Browser */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-sm flex items-center gap-2"><List className="h-4 w-4 text-primary" /> Module Browser</CardTitle>
            <span className="text-xs text-muted-foreground">{filteredModules.length} modules</span>
          </div>
          <div className="flex gap-2 flex-wrap mt-2">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input placeholder="Search modules..." value={search} onChange={e => setSearch(e.target.value)} className="h-9 text-sm pl-8" />
            </div>
            <div className="flex gap-1">
              {(["all", "network", "web", "security"] as const).map(cat => (
                <Button key={cat} variant={categoryFilter === cat ? "default" : "outline"} size="sm" onClick={() => setCategoryFilter(cat)} className="h-9 text-xs capitalize">
                  {cat === "all" ? "All" : cat === "network" ? "Network" : cat === "web" ? "Web" : "Security"}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-[500px] overflow-y-auto pr-1">
            {filteredModules.map(mod => (
              <ModuleCard key={mod.id} module={mod} selected={selectedModules.includes(mod.id)} onSelect={() => toggleModule(mod.id)} />
            ))}
            {filteredModules.length === 0 && (
              <div className="col-span-2 text-center py-8 text-xs text-muted-foreground">No modules match your search</div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {results.map((r, i) => (
        <OutputPanel key={i} title={r.moduleName || `Module ${r.moduleId}`} output={r.output} duration={r.duration} target={r.target} />
      ))}
    </div>
  );
}

// ─── Quick Scan Tab ───────────────────────────────────────────────
function QuickScanTab() {
  const [target, setTarget] = useState("");
  const [scanType, setScanType] = useState<"quick" | "category">("quick");
  const [category, setCategory] = useState<"infra" | "web" | "security">("infra");
  const [threads, setThreads] = useState(10);
  const [results, setResults] = useState<any>(null);

  const quickRecon = trpc.argus.quickRecon.useMutation({
    onSuccess: d => { setResults(d); toast.success(`Quick recon complete for ${d.target}`); },
    onError: e => toast.error(e.message),
  });
  const runCategory = trpc.argus.runCategory.useMutation({
    onSuccess: d => { setResults(d); toast.success(`${d.category} scan complete`); },
    onError: e => toast.error(e.message),
  });

  const isPending = quickRecon.isPending || runCategory.isPending;

  const run = () => {
    setResults(null);
    if (scanType === "quick") quickRecon.mutate({ target });
    else runCategory.mutate({ category, target, threads });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2"><Zap className="h-4 w-4 text-primary" /> Quick Scan</CardTitle>
          <CardDescription className="text-xs">Run pre-configured scan profiles against a target</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Button variant={scanType === "quick" ? "default" : "outline"} size="sm" onClick={() => setScanType("quick")} className="h-8 text-xs">
              <Zap className="h-3 w-3 mr-1" /> Quick Recon (5 core modules)
            </Button>
            <Button variant={scanType === "category" ? "default" : "outline"} size="sm" onClick={() => setScanType("category")} className="h-8 text-xs">
              <List className="h-3 w-3 mr-1" /> Full Category Scan
            </Button>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Target Domain / IP</Label>
            <Input placeholder="example.com or 192.168.1.1" value={target} onChange={e => setTarget(e.target.value)} className="h-9 text-sm font-mono" />
          </div>

          {scanType === "category" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Category</Label>
                <Select value={category} onValueChange={(v: any) => setCategory(v)}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="infra">Network & Infrastructure</SelectItem>
                    <SelectItem value="web">Web Application</SelectItem>
                    <SelectItem value="security">Security & Threat Intel</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Threads</Label>
                <Input type="number" min={1} max={50} value={threads} onChange={e => setThreads(Number(e.target.value))} className="h-9 text-sm" />
              </div>
            </div>
          )}

          {scanType === "quick" && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              {[{ id: 3, name: "DNS Records" }, { id: 18, name: "WHOIS" }, { id: 12, name: "SSL Chain" }, { id: 9, name: "Open Ports" }, { id: 118, name: "Subdomains" }].map(m => (
                <div key={m.id} className="flex items-center gap-1.5 p-2 rounded bg-muted/30 text-xs">
                  <CheckCircle className="h-3 w-3 text-green-500 shrink-0" />
                  <span>{m.name}</span>
                </div>
              ))}
            </div>
          )}

          <Button onClick={run} disabled={!target || isPending} className="w-full">
            {isPending ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Scanning...</> : <><Play className="h-4 w-4 mr-2" /> {scanType === "quick" ? "Run Quick Recon" : `Scan ${category} Category`}</>}
          </Button>
        </CardContent>
      </Card>

      {/* Quick Recon Results */}
      {results && Array.isArray(results.results) && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold">Results for {results.target}</h3>
          {results.results.map((r: any, i: number) => (
            <OutputPanel key={i} title={r.moduleName} output={r.output} target={results.target} />
          ))}
        </div>
      )}

      {/* Category Scan Results */}
      {results && results.output && (
        <OutputPanel title={`${results.category} Category Scan`} output={results.output} duration={results.duration} target={results.target} />
      )}
    </div>
  );
}

// ─── Status Tab ───────────────────────────────────────────────────
function StatusTab() {
  const status = trpc.argus.getStatus.useQuery(undefined, { retry: false, refetchInterval: 30000 });
  const update = trpc.argus.update.useMutation({
    onSuccess: d => toast[d.success ? "success" : "warning"](d.success ? "Argus updated" : "Update may have issues"),
    onError: e => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2"><Server className="h-4 w-4 text-primary" /> Installation Status</CardTitle>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => status.refetch()} className="h-7 text-xs">
                <RefreshCw className={`h-3 w-3 mr-1 ${status.isFetching ? "animate-spin" : ""}`} /> Refresh
              </Button>
              <Button onClick={() => update.mutate()} disabled={update.isPending} variant="outline" size="sm" className="h-7 text-xs">
                {update.isPending ? <RefreshCw className="h-3 w-3 animate-spin mr-1" /> : <Download className="h-3 w-3 mr-1" />} Update
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {status.error ? (
            <div className="text-center py-6">
              <WifiOff className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">No connection configured — set up your server in the Setup tab</p>
            </div>
          ) : status.data ? (
            <div className="space-y-2">
              {[
                { label: "Host", value: status.data.host, ok: true },
                { label: "Python", value: status.data.pythonVersion?.split("\n")[0] || "unknown", ok: !!status.data.pythonVersion },
                { label: "Argus", value: status.data.argusVersion || "not installed", ok: status.data.installed },
                { label: "pip Package", value: status.data.pipInfo || "not found", ok: status.data.pipInfo?.includes("Version") },
              ].map(item => (
                <div key={item.label} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/40">
                  <span className="text-xs text-muted-foreground">{item.label}</span>
                  <div className="flex items-center gap-1.5">
                    {item.ok ? <CheckCircle className="h-3.5 w-3.5 text-green-500" /> : <XCircle className="h-3.5 w-3.5 text-red-500" />}
                    <span className="text-xs font-mono">{item.value}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 text-xs text-muted-foreground"><RefreshCw className="h-4 w-4 animate-spin mx-auto mb-2" />Checking status...</div>
          )}
        </CardContent>
      </Card>

      {update.data && (
        <Card>
          <CardContent className="py-3 px-4">
            <pre className="text-[11px] font-mono text-muted-foreground whitespace-pre-wrap max-h-40 overflow-auto">{update.data.output}</pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────
export default function ArgusPage() {
  const [activeTab, setActiveTab] = useState("quickscan");

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-purple-500/10 flex items-center justify-center">
            <Eye className="h-5 w-5 text-purple-500" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Argus</h1>
            <p className="text-xs text-muted-foreground">OSINT & Reconnaissance Toolkit · 135 Modules</p>
          </div>
        </div>
        <a href="https://github.com/jasonxtn/argus" target="_blank" rel="noopener noreferrer">
          <Button variant="ghost" size="sm" className="h-8 text-xs">
            <ExternalLink className="h-3.5 w-3.5 mr-1" /> GitHub
          </Button>
        </a>
      </div>

      {/* Warning */}
      <Card className="border-yellow-500/20 bg-yellow-500/5">
        <CardContent className="py-3 px-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5 shrink-0" />
            <p className="text-xs text-muted-foreground">
              <strong className="text-foreground">Legal Disclaimer:</strong> Argus is intended for educational and ethical use only. Only scan targets you own or have explicit written permission to test. Unauthorised reconnaissance is illegal.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Module Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { cat: "network", label: "Network & Infrastructure", count: 52, icon: Network, color: "text-blue-500", bg: "bg-blue-500/10" },
          { cat: "web", label: "Web Application", count: 50, icon: Globe, color: "text-green-500", bg: "bg-green-500/10" },
          { cat: "security", label: "Security & Threat Intel", count: 33, icon: Shield, color: "text-red-500", bg: "bg-red-500/10" },
        ].map(item => (
          <Card key={item.cat} className="p-3">
            <div className={`h-8 w-8 rounded-lg ${item.bg} flex items-center justify-center mb-2`}>
              <item.icon className={`h-4 w-4 ${item.color}`} />
            </div>
            <p className="text-lg font-bold">{item.count}</p>
            <p className="text-xs text-muted-foreground">{item.label}</p>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-4 w-full">
          <TabsTrigger value="setup" className="text-xs"><Settings className="h-3 w-3 mr-1" />Setup</TabsTrigger>
          <TabsTrigger value="quickscan" className="text-xs"><Zap className="h-3 w-3 mr-1" />Quick Scan</TabsTrigger>
          <TabsTrigger value="modules" className="text-xs"><List className="h-3 w-3 mr-1" />Modules</TabsTrigger>
          <TabsTrigger value="status" className="text-xs"><Server className="h-3 w-3 mr-1" />Status</TabsTrigger>
        </TabsList>
        <TabsContent value="setup" className="mt-4"><SetupTab onConnected={() => setActiveTab("quickscan")} /></TabsContent>
        <TabsContent value="quickscan" className="mt-4"><QuickScanTab /></TabsContent>
        <TabsContent value="modules" className="mt-4"><ModulesTab /></TabsContent>
        <TabsContent value="status" className="mt-4"><StatusTab /></TabsContent>
      </Tabs>
    </div>
  );
}
