/**
 * IP Rotation Manager
 * 3-layer system: Header Spoofing + Tor + Auto Proxy Scraper
 * Zero VPS, zero signup required.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  Shield, Globe, Zap, RefreshCw, Loader2, CheckCircle2,
  XCircle, Activity, Eye, EyeOff, RotateCcw, Wifi, WifiOff,
  ChevronDown, ChevronUp, Info
} from "lucide-react";

function LayerCard({
  icon: Icon,
  iconColor,
  title,
  description,
  enabled,
  onToggle,
  loading,
  status,
  children,
}: {
  icon: any;
  iconColor: string;
  title: string;
  description: string;
  enabled: boolean;
  onToggle: () => void;
  loading?: boolean;
  status?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <Card className={`bg-zinc-900 border-zinc-800 transition-all ${enabled ? "border-l-4 border-l-green-500" : ""}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${enabled ? "bg-green-500/10 border border-green-500/20" : "bg-zinc-800 border border-zinc-700"}`}>
              <Icon className={`w-5 h-5 ${enabled ? "text-green-400" : iconColor}`} />
            </div>
            <div>
              <h3 className="font-semibold text-white">{title}</h3>
              <p className="text-xs text-zinc-500">{description}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {status}
            <Switch
              checked={enabled}
              onCheckedChange={onToggle}
              disabled={loading}
              className={loading ? "opacity-50" : ""}
            />
          </div>
        </div>
      </CardHeader>
      {children && (
        <>
          <button
            className="w-full px-6 pb-2 flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-400 transition-colors"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {expanded ? "Hide details" : "Show details"}
          </button>
          {expanded && <CardContent className="pt-0">{children}</CardContent>}
        </>
      )}
    </Card>
  );
}

export default function IPRotationPage() {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.ipRotation.getState.useQuery(undefined, { refetchInterval: 5000 });
  const { data: poolData } = trpc.ipRotation.getProxyPool.useQuery(undefined, { refetchInterval: 15000 });

  const setHeaderSpoofing = trpc.ipRotation.setHeaderSpoofing.useMutation({
    onSuccess: (d) => { utils.ipRotation.getState.invalidate(); toast.success(d.enabled ? "Header spoofing enabled" : "Header spoofing disabled"); },
    onError: (e) => toast.error(e.message),
  });

  const setTorEnabled = trpc.ipRotation.setTorEnabled.useMutation({
    onSuccess: (d) => {
      utils.ipRotation.getState.invalidate();
      if (d.enabled) toast.success("Tor enabled — bootstrapping in background (may take ~60s)");
      else toast.success("Tor disabled");
    },
    onError: (e) => toast.error(e.message),
  });

  const startTor = trpc.ipRotation.startTor.useMutation({
    onSuccess: (d) => { utils.ipRotation.getState.invalidate(); d.success ? toast.success(d.message) : toast.error(d.message); },
    onError: (e) => toast.error(e.message),
  });

  const stopTor = trpc.ipRotation.stopTor.useMutation({
    onSuccess: () => { utils.ipRotation.getState.invalidate(); toast.success("Tor stopped"); },
    onError: (e) => toast.error(e.message),
  });

  const newCircuit = trpc.ipRotation.newCircuit.useMutation({
    onSuccess: (d) => { d.success ? toast.success(d.message) : toast.error(d.message); },
    onError: (e) => toast.error(e.message),
  });

  const setAutoProxy = trpc.ipRotation.setAutoProxy.useMutation({
    onSuccess: (d) => {
      utils.ipRotation.getState.invalidate();
      utils.ipRotation.getProxyPool.invalidate();
      if (d.enabled) toast.success("Auto proxy scraper enabled — scraping proxies in background...");
      else toast.success("Auto proxy scraper disabled");
    },
    onError: (e) => toast.error(e.message),
  });

  const scrapeProxies = trpc.ipRotation.scrapeProxies.useMutation({
    onSuccess: (d) => {
      utils.ipRotation.getProxyPool.invalidate();
      toast.success(`Scraped ${d.scraped} proxies, tested ${d.tested}, found ${d.live} live`);
    },
    onError: (e) => toast.error(e.message),
  });

  const enableAll = trpc.ipRotation.enableAll.useMutation({
    onSuccess: () => { utils.ipRotation.getState.invalidate(); toast.success("All layers enabled — maximum IP rotation active"); },
    onError: (e) => toast.error(e.message),
  });

  const disableAll = trpc.ipRotation.disableAll.useMutation({
    onSuccess: () => { utils.ipRotation.getState.invalidate(); toast.success("All layers disabled"); },
    onError: (e) => toast.error(e.message),
  });

  const settings = data?.settings;
  const torStatus = data?.tor?.status ?? "stopped";
  const poolStats = data?.proxyPool;
  const anyActive = settings?.headerSpoofing || settings?.torEnabled || settings?.autoProxyEnabled;

  const torStatusBadge = torStatus === "running"
    ? <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-xs"><CheckCircle2 className="w-3 h-3 mr-1" />Running</Badge>
    : torStatus === "starting"
    ? <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 text-xs"><Loader2 className="w-3 h-3 mr-1 animate-spin" />Starting</Badge>
    : <Badge className="bg-zinc-700/50 text-zinc-400 border-zinc-600 text-xs"><XCircle className="w-3 h-3 mr-1" />Stopped</Badge>;

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${anyActive ? "bg-green-500/10 border border-green-500/20" : "bg-zinc-800 border border-zinc-700"}`}>
            <Shield className={`w-6 h-6 ${anyActive ? "text-green-400" : "text-zinc-400"}`} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">IP Rotation</h1>
            <p className="text-sm text-zinc-400">3-layer IP masking — zero VPS, zero signup</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm" variant="outline"
            onClick={() => disableAll.mutate()}
            disabled={disableAll.isPending || !anyActive}
            className="text-red-400 border-red-500/30 hover:bg-red-500/10"
          >
            Disable All
          </Button>
          <Button
            size="sm"
            onClick={() => enableAll.mutate()}
            disabled={enableAll.isPending}
            className="bg-green-600 hover:bg-green-700"
          >
            {enableAll.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Zap className="w-3 h-3 mr-1" />}
            Enable All
          </Button>
        </div>
      </div>

      {/* Status bar */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="p-4 flex items-center gap-2">
            <Eye className={`w-4 h-4 ${settings?.headerSpoofing ? "text-green-400" : "text-zinc-600"}`} />
            <div>
              <p className="text-xs text-zinc-500">Header Spoof</p>
              <p className={`text-sm font-bold ${settings?.headerSpoofing ? "text-green-400" : "text-zinc-500"}`}>
                {settings?.headerSpoofing ? "ON" : "OFF"}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="p-4 flex items-center gap-2">
            <Globe className={`w-4 h-4 ${torStatus === "running" ? "text-purple-400" : "text-zinc-600"}`} />
            <div>
              <p className="text-xs text-zinc-500">Tor</p>
              <p className={`text-sm font-bold ${torStatus === "running" ? "text-purple-400" : torStatus === "starting" ? "text-yellow-400" : "text-zinc-500"}`}>
                {torStatus === "running" ? "LIVE" : torStatus === "starting" ? "..." : "OFF"}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="p-4 flex items-center gap-2">
            <Wifi className={`w-4 h-4 ${(poolStats?.live ?? 0) > 0 ? "text-blue-400" : "text-zinc-600"}`} />
            <div>
              <p className="text-xs text-zinc-500">Live Proxies</p>
              <p className={`text-sm font-bold ${(poolStats?.live ?? 0) > 0 ? "text-blue-400" : "text-zinc-500"}`}>
                {poolStats?.live ?? 0}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Info */}
      <div className="p-4 rounded-lg bg-blue-500/5 border border-blue-500/20 text-sm text-blue-200">
        <div className="flex gap-2">
          <Info className="w-4 h-4 flex-shrink-0 mt-0.5 text-blue-400" />
          <span>All layers apply to Titan's <strong>server-side fetch requests</strong> — scraping, API calls, URL fetching. Enable multiple layers for maximum coverage. Header spoofing is instant; Tor takes ~60s to bootstrap.</span>
        </div>
      </div>

      {/* Layer 1: Header Spoofing */}
      <LayerCard
        icon={Eye}
        iconColor="text-blue-400"
        title="Layer 1 — Header Spoofing"
        description="Rotates X-Forwarded-For, User-Agent, Accept-Language on every request. Instant, zero overhead."
        enabled={settings?.headerSpoofing ?? false}
        onToggle={() => setHeaderSpoofing.mutate({ enabled: !settings?.headerSpoofing })}
        loading={setHeaderSpoofing.isPending}
      >
        <div className="space-y-2 text-xs text-zinc-400">
          <p>Each request gets a different combination of:</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li><strong className="text-zinc-300">X-Forwarded-For</strong> — random public IP from Europe/US/Asia</li>
            <li><strong className="text-zinc-300">User-Agent</strong> — rotates through 14 browser fingerprints (Chrome, Firefox, Safari, mobile)</li>
            <li><strong className="text-zinc-300">Accept-Language</strong> — rotates through 20 locales</li>
            <li><strong className="text-zinc-300">Via / X-Real-IP</strong> — additional forwarding headers</li>
          </ul>
          <p className="text-zinc-500 mt-2">Note: This spoofs headers only — the actual outbound IP is still Titan's Railway server. Combine with Tor or Auto Proxy for real IP changes.</p>
        </div>
      </LayerCard>

      {/* Layer 2: Tor */}
      <LayerCard
        icon={Globe}
        iconColor="text-purple-400"
        title="Layer 2 — Tor Network"
        description="Routes requests through the Tor network. Real exit node IPs that change every ~10 minutes. No VPS needed."
        enabled={settings?.torEnabled ?? false}
        onToggle={() => setTorEnabled.mutate({ enabled: !settings?.torEnabled })}
        loading={setTorEnabled.isPending}
        status={torStatusBadge}
      >
        <div className="space-y-3">
          <div className="text-xs text-zinc-400 space-y-1">
            <p>Tor runs directly on the Railway server. Each request exits from a different Tor relay worldwide.</p>
            <p className="text-zinc-500">Bootstrap takes ~60 seconds on first enable. Subsequent enables are faster.</p>
          </div>
          <div className="flex gap-2">
            {torStatus === "stopped" && (
              <Button size="sm" variant="outline" onClick={() => startTor.mutate()} disabled={startTor.isPending}>
                {startTor.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Globe className="w-3 h-3 mr-1" />}
                Start Tor
              </Button>
            )}
            {torStatus === "running" && (
              <>
                <Button size="sm" variant="outline" onClick={() => newCircuit.mutate()} disabled={newCircuit.isPending}>
                  {newCircuit.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <RotateCcw className="w-3 h-3 mr-1" />}
                  New Circuit
                </Button>
                <Button size="sm" variant="outline" className="text-red-400 border-red-500/30" onClick={() => stopTor.mutate()} disabled={stopTor.isPending}>
                  Stop Tor
                </Button>
              </>
            )}
            {torStatus === "starting" && (
              <div className="flex items-center gap-2 text-xs text-yellow-400">
                <Loader2 className="w-3 h-3 animate-spin" />
                Bootstrapping Tor network...
              </div>
            )}
          </div>
        </div>
      </LayerCard>

      {/* Layer 3: Auto Proxy Scraper */}
      <LayerCard
        icon={Wifi}
        iconColor="text-blue-400"
        title="Layer 3 — Auto Proxy Scraper"
        description="Automatically scrapes and tests free proxies from 8 public sources every 30 minutes. Maintains a live pool."
        enabled={settings?.autoProxyEnabled ?? false}
        onToggle={() => setAutoProxy.mutate({ enabled: !settings?.autoProxyEnabled })}
        loading={setAutoProxy.isPending}
        status={
          (poolStats?.live ?? 0) > 0
            ? <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-xs">{poolStats?.live} live</Badge>
            : undefined
        }
      >
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-2 rounded bg-zinc-800/50">
              <p className="text-zinc-500">Total in pool</p>
              <p className="text-white font-bold">{poolStats?.total ?? 0}</p>
            </div>
            <div className="p-2 rounded bg-zinc-800/50">
              <p className="text-zinc-500">Live proxies</p>
              <p className="text-green-400 font-bold">{poolStats?.live ?? 0}</p>
            </div>
            <div className="p-2 rounded bg-zinc-800/50">
              <p className="text-zinc-500">Last scraped</p>
              <p className="text-white font-bold">
                {poolStats?.lastScrapeAgo != null
                  ? poolStats.lastScrapeAgo < 60
                    ? `${poolStats.lastScrapeAgo}s ago`
                    : `${Math.floor(poolStats.lastScrapeAgo / 60)}m ago`
                  : "Never"}
              </p>
            </div>
            <div className="p-2 rounded bg-zinc-800/50">
              <p className="text-zinc-500">Next refresh</p>
              <p className="text-white font-bold">
                {poolStats?.nextScrapeIn
                  ? `${Math.floor(poolStats.nextScrapeIn / 60000)}m`
                  : "—"}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => scrapeProxies.mutate()} disabled={scrapeProxies.isPending}>
              {scrapeProxies.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <RefreshCw className="w-3 h-3 mr-1" />}
              Scrape Now
            </Button>
          </div>
          {/* Show sample of live proxies */}
          {(poolData?.proxies?.filter(p => p.healthy).length ?? 0) > 0 && (
            <div className="space-y-1 max-h-[150px] overflow-y-auto">
              {poolData?.proxies?.filter(p => p.healthy).slice(0, 10).map((p, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-zinc-400 font-mono">
                  <CheckCircle2 className="w-3 h-3 text-green-400 flex-shrink-0" />
                  <span>{p.host}:{p.port}</span>
                  <Badge variant="outline" className="py-0 text-zinc-500 border-zinc-700">{p.protocol}</Badge>
                  {p.latencyMs && <span className="text-zinc-600">{p.latencyMs}ms</span>}
                  {p.externalIp && <span className="text-zinc-600">→ {p.externalIp}</span>}
                </div>
              ))}
            </div>
          )}
          <p className="text-xs text-zinc-600">Sources: TheSpeedX, ShiftyTR, monosans, hookzof, clarketm proxy lists</p>
        </div>
      </LayerCard>
    </div>
  );
}
