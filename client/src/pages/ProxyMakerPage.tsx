/**
 * Titan Proxy Maker Page
 * Build and manage a rotating proxy pool — deploy, scrape, test, export.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Globe, Plus, Trash2, CheckCircle2, AlertTriangle, Loader2,
  RefreshCw, Server, Copy, Download, Zap, Activity, Shield,
  Search, ChevronDown
} from "lucide-react";

export default function ProxyMakerPage() {
  const [tab, setTab] = useState("pool");
  const [addOpen, setAddOpen] = useState(false);
  const [deployOpen, setDeployOpen] = useState(false);
  const [newProxy, setNewProxy] = useState({ host: "", port: "1080", type: "socks5" as "socks5" | "http" | "https", username: "", password: "", country: "", label: "" });
  const [deployForm, setDeployForm] = useState({ host: "", port: "22", username: "root", password: "", label: "", useTitan: false });
  const [scrapeType, setScrapeType] = useState<"socks5" | "http" | "all">("socks5");
  const [scrapeMax, setScrapeMax] = useState("20");
  const [exportCopied, setExportCopied] = useState(false);

  const poolQuery = trpc.proxyMaker.getPool.useQuery();
  const exportQuery = trpc.proxyMaker.exportPool.useQuery({ aliveOnly: true, type: "all" });

  const addProxy = trpc.proxyMaker.addProxy.useMutation({
    onSuccess: () => { toast.success("Proxy added"); setAddOpen(false); poolQuery.refetch(); setNewProxy({ host: "", port: "1080", type: "socks5", username: "", password: "", country: "", label: "" }); },
    onError: (e) => toast.error(e.message),
  });
  const removeProxy = trpc.proxyMaker.removeProxy.useMutation({
    onSuccess: () => { toast.success("Proxy removed"); poolQuery.refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const testProxy = trpc.proxyMaker.testProxy.useMutation({
    onSuccess: (d) => {
      toast[d.success ? "success" : "error"](d.message);
      poolQuery.refetch();
    },
    onError: (e) => toast.error(e.message),
  });
  const healthCheck = trpc.proxyMaker.healthCheckAll.useMutation({
    onSuccess: (d) => { toast.success(d.message); poolQuery.refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const deployProxy = trpc.proxyMaker.deployProxy.useMutation({
    onSuccess: (d) => {
      if (d.success) { toast.success(d.message); setDeployOpen(false); poolQuery.refetch(); }
      else toast.error(d.message);
    },
    onError: (e) => toast.error(e.message),
  });
  const scrapeProxies = trpc.proxyMaker.scrapeProxies.useMutation({
    onSuccess: (d) => { toast[d.success ? "success" : "error"](d.message); poolQuery.refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const setRotation = trpc.proxyMaker.setRotation.useMutation({
    onSuccess: () => poolQuery.refetch(),
    onError: (e) => toast.error(e.message),
  });
  const clearPool = trpc.proxyMaker.clearPool.useMutation({
    onSuccess: () => { toast.success("Pool cleared"); poolQuery.refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const pool = poolQuery.data;
  const proxies = pool?.proxies ?? [];

  const copyExport = () => {
    if (exportQuery.data?.list) {
      navigator.clipboard.writeText(exportQuery.data.list);
      setExportCopied(true);
      setTimeout(() => setExportCopied(false), 2000);
    }
  };

  const typeColor = (type: string) => type === "socks5" ? "text-purple-300 border-purple-500/30" : type === "http" ? "text-blue-300 border-blue-500/30" : "text-green-300 border-green-500/30";

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-green-500/10 border border-green-500/20">
            <Globe className="w-6 h-6 text-green-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Proxy Maker</h1>
            <p className="text-sm text-zinc-400">Build, manage and rotate your own proxy pool</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm text-zinc-400">Rotation</span>
            <Switch
              checked={pool?.rotationEnabled ?? false}
              onCheckedChange={(v) => setRotation.mutate({ enabled: v })}
              disabled={proxies.length === 0}
            />
          </div>
          <Badge variant={pool?.rotationEnabled ? "default" : "secondary"} className={pool?.rotationEnabled ? "bg-green-500/20 text-green-300 border-green-500/30" : ""}>
            {pool?.rotationEnabled ? "Rotating" : "Static"}
          </Badge>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="p-4 rounded-lg bg-zinc-900 border border-zinc-800 text-center">
          <div className="text-2xl font-bold text-white">{pool?.totalCount ?? 0}</div>
          <div className="text-xs text-zinc-500 mt-1">Total Proxies</div>
        </div>
        <div className="p-4 rounded-lg bg-zinc-900 border border-zinc-800 text-center">
          <div className="text-2xl font-bold text-green-400">{pool?.aliveCount ?? 0}</div>
          <div className="text-xs text-zinc-500 mt-1">Alive</div>
        </div>
        <div className="p-4 rounded-lg bg-zinc-900 border border-zinc-800 text-center">
          <div className="text-2xl font-bold text-red-400">{(pool?.totalCount ?? 0) - (pool?.aliveCount ?? 0)}</div>
          <div className="text-xs text-zinc-500 mt-1">Dead</div>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-zinc-900 border border-zinc-800">
          <TabsTrigger value="pool">Pool</TabsTrigger>
          <TabsTrigger value="add">Add Proxies</TabsTrigger>
          <TabsTrigger value="deploy">Deploy Server</TabsTrigger>
          <TabsTrigger value="export">Export</TabsTrigger>
        </TabsList>

        {/* ── Pool Tab ── */}
        <TabsContent value="pool" className="mt-4">
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Proxy Pool</CardTitle>
                <div className="flex gap-2">
                  {proxies.length > 0 && (
                    <>
                      <Button size="sm" variant="outline" onClick={() => healthCheck.mutate()} disabled={healthCheck.isPending}>
                        {healthCheck.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Activity className="w-3 h-3 mr-1" />}
                        Health Check
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => clearPool.mutate()} disabled={clearPool.isPending}>
                        Clear All
                      </Button>
                    </>
                  )}
                  <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => setAddOpen(true)}>
                    <Plus className="w-3 h-3 mr-1" /> Add
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {proxies.length === 0 ? (
                <div className="text-center py-10 space-y-3">
                  <Globe className="w-12 h-12 text-zinc-700 mx-auto" />
                  <p className="text-zinc-500">No proxies yet. Add manually, scrape, or deploy a server.</p>
                  <div className="flex gap-2 justify-center">
                    <Button onClick={() => setAddOpen(true)} variant="outline" size="sm">Add Manually</Button>
                    <Button onClick={() => setTab("add")} className="bg-green-600 hover:bg-green-700" size="sm">Auto-Scrape</Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                  {proxies.map((proxy) => (
                    <div key={proxy.id} className={`flex items-center gap-3 p-3 rounded-lg border ${proxy.alive ? "bg-zinc-800/50 border-zinc-700/50" : "bg-red-500/5 border-red-500/20 opacity-60"}`}>
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${proxy.alive ? "bg-green-400" : "bg-red-400"}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-mono text-zinc-200">{proxy.host}:{proxy.port}</span>
                          <Badge variant="outline" className={`text-xs py-0 ${typeColor(proxy.type)}`}>{proxy.type.toUpperCase()}</Badge>
                          {proxy.country && <Badge variant="outline" className="text-xs py-0">{proxy.country}</Badge>}
                          {proxy.source === "deployed" && <Badge variant="outline" className="text-xs py-0 text-purple-300 border-purple-500/30">Deployed</Badge>}
                          {proxy.source === "scraped" && <Badge variant="outline" className="text-xs py-0 text-zinc-400">Scraped</Badge>}
                        </div>
                        {proxy.label && <div className="text-xs text-zinc-500 mt-0.5">{proxy.label}</div>}
                        {proxy.latencyMs && <div className="text-xs text-zinc-500">{proxy.latencyMs}ms</div>}
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          size="icon" variant="ghost" className="w-7 h-7 text-blue-400"
                          onClick={() => testProxy.mutate({ proxyId: proxy.id })}
                          disabled={testProxy.isPending}
                        >
                          {testProxy.isPending && testProxy.variables?.proxyId === proxy.id
                            ? <Loader2 className="w-3 h-3 animate-spin" />
                            : <Zap className="w-3 h-3" />}
                        </Button>
                        <Button
                          size="icon" variant="ghost" className="w-7 h-7 text-red-400 hover:text-red-300"
                          onClick={() => removeProxy.mutate({ proxyId: proxy.id })}
                          disabled={removeProxy.isPending}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Add / Scrape Tab ── */}
        <TabsContent value="add" className="mt-4 space-y-4">
          {/* Auto-scrape */}
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Search className="w-4 h-4 text-green-400" />
                Auto-Scrape Free Proxies
              </CardTitle>
              <CardDescription>Automatically finds and tests free public proxies, adds working ones to your pool.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Proxy Type</Label>
                  <Select value={scrapeType} onValueChange={(v) => setScrapeType(v as any)}>
                    <SelectTrigger className="bg-zinc-800 border-zinc-700">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="socks5">SOCKS5 (recommended)</SelectItem>
                      <SelectItem value="http">HTTP</SelectItem>
                      <SelectItem value="all">All types</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Max to add</Label>
                  <Input value={scrapeMax} onChange={e => setScrapeMax(e.target.value)} type="number" min="1" max="100" className="bg-zinc-800 border-zinc-700" />
                </div>
              </div>
              <Button
                onClick={() => scrapeProxies.mutate({ type: scrapeType, maxToAdd: parseInt(scrapeMax) || 20 })}
                disabled={scrapeProxies.isPending}
                className="w-full bg-green-600 hover:bg-green-700"
              >
                {scrapeProxies.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Search className="w-4 h-4 mr-2" />}
                {scrapeProxies.isPending ? "Scraping..." : "Scrape Proxies"}
              </Button>
              {scrapeProxies.data && (
                <div className={`p-3 rounded text-sm ${scrapeProxies.data.success ? "bg-green-500/10 text-green-300" : "bg-red-500/10 text-red-300"}`}>
                  {scrapeProxies.data.message}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Manual add button */}
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Add Manually</CardTitle>
              <CardDescription>Add a specific proxy you already have.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => setAddOpen(true)} className="w-full" variant="outline">
                <Plus className="w-4 h-4 mr-2" /> Add Proxy Manually
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Deploy Tab ── */}
        <TabsContent value="deploy" className="mt-4">
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Server className="w-4 h-4 text-purple-400" />
                Deploy Your Own Proxy Server
              </CardTitle>
              <CardDescription>
                Installs 3proxy on any VPS via SSH — creates a SOCKS5 (port 1080) and HTTP (port 8080) proxy you fully control.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 flex items-center justify-between p-3 rounded-lg bg-zinc-800 border border-zinc-700">
                  <div>
                    <div className="text-sm font-medium text-zinc-200">Use Titan Server</div>
                    <div className="text-xs text-zinc-500">Deploy on your already-configured Titan Server</div>
                  </div>
                  <Switch checked={deployForm.useTitan} onCheckedChange={(v) => setDeployForm(p => ({ ...p, useTitan: v }))} />
                </div>
                {!deployForm.useTitan && (
                  <>
                    <div className="space-y-1">
                      <Label>Host / IP *</Label>
                      <Input value={deployForm.host} onChange={e => setDeployForm(p => ({ ...p, host: e.target.value }))} placeholder="192.168.1.1" className="bg-zinc-800 border-zinc-700" />
                    </div>
                    <div className="space-y-1">
                      <Label>SSH Port</Label>
                      <Input value={deployForm.port} onChange={e => setDeployForm(p => ({ ...p, port: e.target.value }))} placeholder="22" className="bg-zinc-800 border-zinc-700" />
                    </div>
                    <div className="space-y-1">
                      <Label>Username</Label>
                      <Input value={deployForm.username} onChange={e => setDeployForm(p => ({ ...p, username: e.target.value }))} placeholder="root" className="bg-zinc-800 border-zinc-700" />
                    </div>
                    <div className="space-y-1">
                      <Label>Password</Label>
                      <Input type="password" value={deployForm.password} onChange={e => setDeployForm(p => ({ ...p, password: e.target.value }))} placeholder="••••••••" className="bg-zinc-800 border-zinc-700" />
                    </div>
                  </>
                )}
                <div className="col-span-2 space-y-1">
                  <Label>Label (optional)</Label>
                  <Input value={deployForm.label} onChange={e => setDeployForm(p => ({ ...p, label: e.target.value }))} placeholder="My US Proxy" className="bg-zinc-800 border-zinc-700" />
                </div>
              </div>
              <Button
                onClick={() => deployProxy.mutate({
                  host: deployForm.host || "titan",
                  port: parseInt(deployForm.port) || 22,
                  username: deployForm.username,
                  password: deployForm.password || undefined,
                  label: deployForm.label || undefined,
                  useTitanServer: deployForm.useTitan,
                })}
                disabled={deployProxy.isPending || (!deployForm.useTitan && !deployForm.host)}
                className="w-full bg-purple-600 hover:bg-purple-700"
              >
                {deployProxy.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Server className="w-4 h-4 mr-2" />}
                {deployProxy.isPending ? "Deploying..." : "Deploy Proxy Server"}
              </Button>
              {deployProxy.data && (
                <div className={`p-3 rounded text-xs font-mono whitespace-pre-wrap max-h-40 overflow-y-auto ${deployProxy.data.success ? "bg-green-500/10 text-green-300" : "bg-red-500/10 text-red-300"}`}>
                  {deployProxy.data.output || deployProxy.data.message}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Export Tab ── */}
        <TabsContent value="export" className="mt-4">
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Download className="w-4 h-4 text-zinc-400" />
                Export Proxy List
              </CardTitle>
              <CardDescription>Export alive proxies as a plain host:port list for use in other tools.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-800 border border-zinc-700">
                <span className="text-sm text-zinc-300">{exportQuery.data?.count ?? 0} alive proxies ready to export</span>
                <Button size="sm" variant="outline" onClick={copyExport} disabled={!exportQuery.data?.list}>
                  {exportCopied ? <CheckCircle2 className="w-3 h-3 mr-1 text-green-400" /> : <Copy className="w-3 h-3 mr-1" />}
                  {exportCopied ? "Copied!" : "Copy List"}
                </Button>
              </div>
              {exportQuery.data?.list && (
                <pre className="p-3 bg-zinc-800 rounded text-xs text-zinc-300 font-mono max-h-60 overflow-y-auto whitespace-pre-wrap">
                  {exportQuery.data.list}
                </pre>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add Proxy Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-white">
          <DialogHeader>
            <DialogTitle>Add Proxy</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Host / IP *</Label>
                <Input value={newProxy.host} onChange={e => setNewProxy(p => ({ ...p, host: e.target.value }))} placeholder="192.168.1.1" className="bg-zinc-800 border-zinc-700" />
              </div>
              <div className="space-y-1">
                <Label>Port *</Label>
                <Input value={newProxy.port} onChange={e => setNewProxy(p => ({ ...p, port: e.target.value }))} placeholder="1080" className="bg-zinc-800 border-zinc-700" />
              </div>
              <div className="col-span-2 space-y-1">
                <Label>Type</Label>
                <Select value={newProxy.type} onValueChange={(v) => setNewProxy(p => ({ ...p, type: v as any }))}>
                  <SelectTrigger className="bg-zinc-800 border-zinc-700">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="socks5">SOCKS5</SelectItem>
                    <SelectItem value="http">HTTP</SelectItem>
                    <SelectItem value="https">HTTPS</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Username (optional)</Label>
                <Input value={newProxy.username} onChange={e => setNewProxy(p => ({ ...p, username: e.target.value }))} placeholder="user" className="bg-zinc-800 border-zinc-700" />
              </div>
              <div className="space-y-1">
                <Label>Password (optional)</Label>
                <Input type="password" value={newProxy.password} onChange={e => setNewProxy(p => ({ ...p, password: e.target.value }))} placeholder="••••••••" className="bg-zinc-800 border-zinc-700" />
              </div>
              <div className="space-y-1">
                <Label>Country (optional)</Label>
                <Input value={newProxy.country} onChange={e => setNewProxy(p => ({ ...p, country: e.target.value }))} placeholder="US" className="bg-zinc-800 border-zinc-700" />
              </div>
              <div className="space-y-1">
                <Label>Label (optional)</Label>
                <Input value={newProxy.label} onChange={e => setNewProxy(p => ({ ...p, label: e.target.value }))} placeholder="My Proxy" className="bg-zinc-800 border-zinc-700" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button
              className="bg-green-600 hover:bg-green-700"
              disabled={!newProxy.host || !newProxy.port || addProxy.isPending}
              onClick={() => addProxy.mutate({
                host: newProxy.host,
                port: parseInt(newProxy.port),
                type: newProxy.type,
                username: newProxy.username || undefined,
                password: newProxy.password || undefined,
                country: newProxy.country || undefined,
                label: newProxy.label || undefined,
              })}
            >
              {addProxy.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
              Add Proxy
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
