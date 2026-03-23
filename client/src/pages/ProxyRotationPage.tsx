/**
 * Proxy Rotation Manager
 * Zero-VPS proxy rotation for Titan's server-side fetch requests.
 * Paste a list of proxies, toggle rotation on, done.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  Shield, Plus, Trash2, RefreshCw, CheckCircle2, XCircle,
  Loader2, Globe, Zap, Info, Upload, RotateCcw, Activity
} from "lucide-react";

function ProxyStatusBadge({ healthy }: { healthy?: boolean }) {
  if (healthy === undefined) return <Badge variant="outline" className="text-xs text-zinc-400 border-zinc-600">Untested</Badge>;
  if (healthy) return <Badge className="text-xs bg-green-500/20 text-green-400 border-green-500/30"><CheckCircle2 className="w-3 h-3 mr-1" />Live</Badge>;
  return <Badge className="text-xs bg-red-500/20 text-red-400 border-red-500/30"><XCircle className="w-3 h-3 mr-1" />Dead</Badge>;
}

export default function ProxyRotationPage() {
  const [bulkText, setBulkText] = useState("");
  const [showImport, setShowImport] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);

  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.proxyRotation.getState.useQuery(undefined, { refetchInterval: 10000 });

  const setActive = trpc.proxyRotation.setActive.useMutation({
    onSuccess: (d) => {
      utils.proxyRotation.getState.invalidate();
      toast.success(d.active ? "Proxy rotation enabled — Titan's requests now route through your proxies" : "Proxy rotation disabled");
    },
    onError: (e) => toast.error(e.message),
  });

  const importList = trpc.proxyRotation.importList.useMutation({
    onSuccess: (d) => {
      utils.proxyRotation.getState.invalidate();
      toast.success(`Imported ${d.added} proxies${d.duplicates ? ` (${d.duplicates} duplicates skipped)` : ""}${d.skipped ? ` (${d.skipped} invalid lines skipped)` : ""}`);
      setBulkText("");
      setShowImport(false);
    },
    onError: (e) => toast.error(e.message),
  });

  const removeProxy = trpc.proxyRotation.removeProxy.useMutation({
    onSuccess: () => { utils.proxyRotation.getState.invalidate(); toast.success("Proxy removed"); },
    onError: (e) => toast.error(e.message),
  });

  const clearAll = trpc.proxyRotation.clearAll.useMutation({
    onSuccess: () => { utils.proxyRotation.getState.invalidate(); toast.success("All proxies cleared"); },
    onError: (e) => toast.error(e.message),
  });

  const testProxy = trpc.proxyRotation.testProxy.useMutation({
    onSuccess: (d, vars) => {
      utils.proxyRotation.getState.invalidate();
      setTestingId(null);
      if (d.healthy) toast.success(`Proxy live — IP: ${d.externalIp} (${d.latencyMs}ms)`);
      else toast.error(`Proxy dead: ${d.error}`);
    },
    onError: (e) => { setTestingId(null); toast.error(e.message); },
  });

  const testAll = trpc.proxyRotation.testAll.useMutation({
    onSuccess: (d) => {
      utils.proxyRotation.getState.invalidate();
      toast.success(`Health check done: ${d.healthy}/${d.tested} proxies live`);
    },
    onError: (e) => toast.error(e.message),
  });

  const proxies = data?.proxies ?? [];
  const isActive = data?.active ?? false;

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-green-500/10 border border-green-500/20">
            <Shield className="w-6 h-6 text-green-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Proxy Rotation</h1>
            <p className="text-sm text-zinc-400">Route Titan's fetch requests through your proxy pool — no VPS needed</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div
            className="flex items-center gap-2 cursor-pointer"
            onClick={() => {
              if (setActive.isPending) return;
              if (!isActive && !proxies.length) {
                toast.info("Import proxies first", { description: "Click 'Import Proxies' to add your proxy list." });
                return;
              }
              setActive.mutate({ active: !isActive });
            }}
          >
            <span className="text-sm text-zinc-400">Active</span>
            <Switch
              checked={isActive}
              onCheckedChange={(v) => {
                if (!v || proxies.length > 0) setActive.mutate({ active: v });
                else toast.info("Import proxies first");
              }}
              disabled={setActive.isPending}
              className={!proxies.length ? "opacity-40" : ""}
            />
          </div>
          <Badge
            variant={isActive ? "default" : "secondary"}
            className={isActive ? "bg-green-500/20 text-green-300 border-green-500/30" : ""}
          >
            {isActive ? "ON" : "OFF"}
          </Badge>
        </div>
      </div>

      {/* Status bar */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="p-4 flex items-center gap-3">
            <Globe className="w-5 h-5 text-blue-400" />
            <div>
              <p className="text-xs text-zinc-500">Total Proxies</p>
              <p className="text-xl font-bold text-white">{data?.totalCount ?? 0}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="p-4 flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-400" />
            <div>
              <p className="text-xs text-zinc-500">Live Proxies</p>
              <p className="text-xl font-bold text-white">{data?.healthyCount ?? 0}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="p-4 flex items-center gap-3">
            <Activity className="w-5 h-5 text-purple-400" />
            <div>
              <p className="text-xs text-zinc-500">Requests Routed</p>
              <p className="text-xl font-bold text-white">{data?.totalRequests ?? 0}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* How it works */}
      <div className="p-4 rounded-lg bg-blue-500/5 border border-blue-500/20 text-sm text-blue-200">
        <div className="flex gap-2">
          <Info className="w-4 h-4 flex-shrink-0 mt-0.5 text-blue-400" />
          <span>When rotation is <strong>ON</strong>, every fetch/scrape request Titan makes cycles through your proxy list automatically. Target websites see different IPs — not Titan's Railway server IP. Paste any SOCKS5 or HTTP proxy list below.</span>
        </div>
      </div>

      {/* Import section */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Proxy List ({proxies.length})</CardTitle>
            <div className="flex gap-2">
              {proxies.length > 0 && (
                <>
                  <Button
                    size="sm" variant="outline"
                    onClick={() => testAll.mutate()}
                    disabled={testAll.isPending}
                  >
                    {testAll.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Zap className="w-3 h-3 mr-1" />}
                    Test All
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => clearAll.mutate()} disabled={clearAll.isPending}>
                    Clear All
                  </Button>
                </>
              )}
              <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => setShowImport(!showImport)}>
                <Upload className="w-3 h-3 mr-1" /> Import Proxies
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Import textarea */}
          {showImport && (
            <div className="space-y-3 p-4 rounded-lg bg-zinc-800/50 border border-zinc-700">
              <div>
                <p className="text-sm font-medium text-zinc-200 mb-1">Paste proxy list (one per line)</p>
                <p className="text-xs text-zinc-500 mb-2">
                  Supported formats: <code className="text-zinc-400">host:port</code> · <code className="text-zinc-400">host:port:user:pass</code> · <code className="text-zinc-400">socks5://user:pass@host:port</code> · <code className="text-zinc-400">http://user:pass@host:port</code>
                </p>
                <Textarea
                  value={bulkText}
                  onChange={e => setBulkText(e.target.value)}
                  placeholder={"192.168.1.1:1080:username:password\nsocks5://user:pass@proxy.example.com:1080\nhttp://proxy.example.com:8080"}
                  className="bg-zinc-900 border-zinc-700 text-zinc-200 font-mono text-xs min-h-[120px]"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={() => { setShowImport(false); setBulkText(""); }}>Cancel</Button>
                <Button
                  size="sm"
                  className="bg-green-600 hover:bg-green-700"
                  disabled={!bulkText.trim() || importList.isPending}
                  onClick={() => importList.mutate({ text: bulkText, replace: false })}
                >
                  {importList.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Plus className="w-3 h-3 mr-1" />}
                  Import
                </Button>
              </div>
            </div>
          )}

          {/* Proxy list */}
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
            </div>
          ) : proxies.length === 0 ? (
            <div className="text-center py-10 space-y-3">
              <Globe className="w-12 h-12 text-zinc-700 mx-auto" />
              <p className="text-zinc-500">No proxies yet. Import a list to get started.</p>
              <p className="text-xs text-zinc-600">Get free proxies from <a href="https://free-proxy-list.net" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">free-proxy-list.net</a> or use paid proxies from Bright Data, Oxylabs, or IPRoyal.</p>
              <Button onClick={() => setShowImport(true)} className="bg-green-600 hover:bg-green-700">
                <Upload className="w-4 h-4 mr-2" /> Import Proxy List
              </Button>
            </div>
          ) : (
            <div className="space-y-1.5 max-h-[400px] overflow-y-auto pr-1">
              {proxies.map((proxy) => (
                <div key={proxy.id} className="flex items-center gap-3 p-3 rounded-lg bg-zinc-800/50 border border-zinc-700/50 hover:border-zinc-600/50 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-mono text-zinc-200 truncate">{proxy.host}:{proxy.port}</span>
                      <Badge variant="outline" className="text-xs py-0 text-zinc-400 border-zinc-600">{proxy.protocol.toUpperCase()}</Badge>
                      {proxy.username && <Badge variant="outline" className="text-xs py-0 text-blue-400 border-blue-500/30">Auth</Badge>}
                      <ProxyStatusBadge healthy={proxy.healthy} />
                      {proxy.latencyMs && proxy.healthy && (
                        <span className="text-xs text-zinc-500">{proxy.latencyMs}ms</span>
                      )}
                      {proxy.externalIp && proxy.healthy && (
                        <span className="text-xs text-zinc-500">→ {proxy.externalIp}</span>
                      )}
                    </div>
                    {proxy.requestCount > 0 && (
                      <p className="text-xs text-zinc-600 mt-0.5">{proxy.requestCount} requests routed</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Button
                      size="icon" variant="ghost" className="w-7 h-7 text-blue-400 hover:text-blue-300"
                      disabled={testingId === proxy.id || testProxy.isPending}
                      onClick={() => { setTestingId(proxy.id); testProxy.mutate({ proxyId: proxy.id }); }}
                      title="Test this proxy"
                    >
                      {testingId === proxy.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                    </Button>
                    <Button
                      size="icon" variant="ghost" className="w-7 h-7 text-red-400 hover:text-red-300"
                      onClick={() => removeProxy.mutate({ proxyId: proxy.id })}
                      disabled={removeProxy.isPending}
                      title="Remove proxy"
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

      {/* Tips */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-zinc-400">Proxy Sources</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            {[
              { name: "Free Proxy List", url: "https://free-proxy-list.net", note: "Free HTTP/HTTPS proxies — lower reliability" },
              { name: "Bright Data", url: "https://brightdata.com", note: "Premium residential proxies — highest success rate" },
              { name: "Oxylabs", url: "https://oxylabs.io", note: "Residential & datacenter — enterprise grade" },
              { name: "IPRoyal", url: "https://iproyal.com", note: "Affordable residential proxies from $5.50/GB" },
            ].map(p => (
              <a key={p.name} href={p.url} target="_blank" rel="noopener noreferrer"
                className="p-3 rounded-lg bg-zinc-800/50 border border-zinc-700/50 hover:border-zinc-600 transition-colors block">
                <p className="font-medium text-zinc-200">{p.name}</p>
                <p className="text-xs text-zinc-500 mt-0.5">{p.note}</p>
              </a>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
