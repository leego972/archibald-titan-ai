/**
 * IP Rotation Manager
 * Production UI for the 3-layer IP rotation engine.
 * Layer 1: Browser Fingerprint Profiles (20 consistent profiles)
 * Layer 2: Tor Network (supervised, auto-restart, exit IP verification)
 * Layer 3: Auto Proxy Pool (DB-persistent, 20+ sources, per-domain tracking)
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  Shield, Globe, Wifi, RefreshCw, Loader2, CheckCircle2,
  XCircle, RotateCcw, Zap, Info, ChevronDown, ChevronUp,
  Activity, Clock, TrendingUp, AlertCircle, Eye
} from "lucide-react";

function LayerCard({
  icon: Icon,
  color,
  title,
  subtitle,
  enabled,
  onToggle,
  loading,
  badge,
  children,
}: {
  icon: any; color: string; title: string; subtitle: string;
  enabled: boolean; onToggle: () => void; loading?: boolean;
  badge?: React.ReactNode; children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Card className={`bg-zinc-900 border-zinc-800 transition-all duration-200 ${enabled ? "border-l-[3px] border-l-green-500" : ""}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`p-2 rounded-lg flex-shrink-0 ${enabled ? "bg-green-500/10 border border-green-500/20" : "bg-zinc-800 border border-zinc-700"}`}>
              <Icon className={`w-5 h-5 ${enabled ? "text-green-400" : color}`} />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-white text-sm">{title}</p>
              <p className="text-xs text-zinc-500 truncate">{subtitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {badge}
            <Switch checked={enabled} onCheckedChange={onToggle} disabled={loading} />
          </div>
        </div>
      </CardHeader>
      {children && (
        <>
          <button
            className="w-full px-5 pb-2 flex items-center gap-1.5 text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
            onClick={() => setOpen(!open)}
          >
            {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {open ? "Hide details" : "Show details"}
          </button>
          {open && <CardContent className="pt-0 border-t border-zinc-800">{children}</CardContent>}
        </>
      )}
    </Card>
  );
}

function StatBox({ label, value, color = "text-white" }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="p-3 rounded-lg bg-zinc-800/60 border border-zinc-700/50">
      <p className="text-xs text-zinc-500 mb-1">{label}</p>
      <p className={`text-sm font-bold ${color}`}>{value}</p>
    </div>
  );
}

export default function IPRotationPage() {
  const utils = trpc.useUtils();

  const { data, isLoading } = trpc.ipRotation.getState.useQuery(undefined, {
    refetchInterval: 4000,
  });

  const { data: torStatusData } = trpc.ipRotation.getTorStatus.useQuery(undefined, {
    refetchInterval: 3000,
  });

  const { data: poolData } = trpc.ipRotation.getProxyPool.useQuery(undefined, {
    refetchInterval: 10000,
  });

  const invalidate = () => {
    utils.ipRotation.getState.invalidate();
    utils.ipRotation.getTorStatus.invalidate();
    utils.ipRotation.getProxyPool.invalidate();
    utils.ipRotation.getActiveState.invalidate();
  };

  const setHeaderSpoofing = trpc.ipRotation.setHeaderSpoofing.useMutation({
    onSuccess: (d) => { invalidate(); toast.success(d.enabled ? "Header spoofing enabled" : "Header spoofing disabled"); },
    onError: (e) => toast.error(e.message),
  });

  const setTorEnabled = trpc.ipRotation.setTorEnabled.useMutation({
    onSuccess: (d) => { invalidate(); toast.success(d.message); },
    onError: (e) => toast.error(e.message),
  });

  const startTor = trpc.ipRotation.startTor.useMutation({
    onSuccess: (d) => {
      invalidate();
      if (d.success) toast.success(`${d.message}${d.exitIp ? ` — Exit IP: ${d.exitIp}` : ""}`);
      else toast.error(d.message);
    },
    onError: (e) => toast.error(e.message),
  });

  const stopTor = trpc.ipRotation.stopTor.useMutation({
    onSuccess: () => { invalidate(); toast.success("Tor stopped"); },
    onError: (e) => toast.error(e.message),
  });

  const newCircuit = trpc.ipRotation.newCircuit.useMutation({
    onSuccess: (d) => {
      invalidate();
      if (d.success) toast.success(d.message);
      else toast.error(d.message);
    },
    onError: (e) => toast.error(e.message),
  });

  const setProxyEnabled = trpc.ipRotation.setProxyEnabled.useMutation({
    onSuccess: (d) => { invalidate(); toast.success(d.message); },
    onError: (e) => toast.error(e.message),
  });

  const scrapeProxies = trpc.ipRotation.scrapeProxies.useMutation({
    onSuccess: (d) => {
      invalidate();
      toast.success(`Scrape complete: ${d.scraped} found, ${d.tested} tested, ${d.live} live`);
    },
    onError: (e) => toast.error(e.message),
  });

  const enableAll = trpc.ipRotation.enableAll.useMutation({
    onSuccess: (d) => { invalidate(); toast.success(d.message); },
    onError: (e) => toast.error(e.message),
  });

  const disableAll = trpc.ipRotation.disableAll.useMutation({
    onSuccess: () => { invalidate(); toast.success("All layers disabled"); },
    onError: (e) => toast.error(e.message),
  });

  const settings = data?.settings;
  const tor = torStatusData ?? data?.tor;
  const poolStats = data?.proxyPool;
  const anyActive = settings?.headerSpoofing || settings?.torEnabled || settings?.proxyEnabled;

  const torState = tor?.state ?? "stopped";
  const torBadge = torState === "running"
    ? <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-xs gap-1"><CheckCircle2 className="w-3 h-3" />Running</Badge>
    : torState === "starting" || torState === "bootstrapping"
    ? <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 text-xs gap-1"><Loader2 className="w-3 h-3 animate-spin" />{tor?.bootstrapPercent ?? 0}%</Badge>
    : torState === "restarting"
    ? <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30 text-xs gap-1"><RefreshCw className="w-3 h-3 animate-spin" />Restarting</Badge>
    : torState === "error"
    ? <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-xs gap-1"><AlertCircle className="w-3 h-3" />Error</Badge>
    : <Badge className="bg-zinc-700/50 text-zinc-400 border-zinc-600 text-xs gap-1"><XCircle className="w-3 h-3" />Stopped</Badge>;

  const liveProxies = poolStats?.live ?? 0;
  const proxyBadge = liveProxies > 0
    ? <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-xs">{liveProxies} live</Badge>
    : undefined;

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-5">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-xl ${anyActive ? "bg-green-500/10 border border-green-500/20" : "bg-zinc-800 border border-zinc-700"}`}>
            <Shield className={`w-6 h-6 ${anyActive ? "text-green-400" : "text-zinc-400"}`} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">IP Rotation</h1>
            <p className="text-xs text-zinc-500">3-layer engine — no VPS, no signup required</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline"
            onClick={() => disableAll.mutate()}
            disabled={disableAll.isPending || !anyActive}
            className="text-red-400 border-red-500/30 hover:bg-red-500/10 text-xs h-8"
          >
            Disable All
          </Button>
          <Button size="sm"
            onClick={() => enableAll.mutate()}
            disabled={enableAll.isPending}
            className="bg-green-600 hover:bg-green-700 text-xs h-8"
          >
            {enableAll.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Zap className="w-3 h-3 mr-1" />}
            Enable All
          </Button>
        </div>
      </div>

      {/* Status row */}
      <div className="grid grid-cols-3 gap-2">
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="p-3 flex items-center gap-2">
            <Eye className={`w-4 h-4 flex-shrink-0 ${settings?.headerSpoofing ? "text-blue-400" : "text-zinc-600"}`} />
            <div>
              <p className="text-xs text-zinc-500">Headers</p>
              <p className={`text-xs font-bold ${settings?.headerSpoofing ? "text-blue-400" : "text-zinc-600"}`}>
                {settings?.headerSpoofing ? "ON" : "OFF"}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="p-3 flex items-center gap-2">
            <Globe className={`w-4 h-4 flex-shrink-0 ${torState === "running" ? "text-purple-400" : "text-zinc-600"}`} />
            <div>
              <p className="text-xs text-zinc-500">Tor</p>
              <p className={`text-xs font-bold ${torState === "running" ? "text-purple-400" : torState === "bootstrapping" || torState === "starting" ? "text-yellow-400" : "text-zinc-600"}`}>
                {torState === "running" ? `${tor?.exitIp ?? "LIVE"}` : torState === "bootstrapping" ? `${tor?.bootstrapPercent ?? 0}%` : torState === "starting" ? "..." : "OFF"}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="p-3 flex items-center gap-2">
            <Wifi className={`w-4 h-4 flex-shrink-0 ${liveProxies > 0 ? "text-green-400" : "text-zinc-600"}`} />
            <div>
              <p className="text-xs text-zinc-500">Proxies</p>
              <p className={`text-xs font-bold ${liveProxies > 0 ? "text-green-400" : "text-zinc-600"}`}>
                {liveProxies > 0 ? `${liveProxies} live` : "0"}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Info banner */}
      <div className="p-3 rounded-lg bg-blue-500/5 border border-blue-500/15 flex gap-2 text-xs text-blue-300">
        <Info className="w-4 h-4 flex-shrink-0 mt-0.5 text-blue-400" />
        <span>All layers apply to Titan's <strong>server-side requests</strong> — scraping, API calls, URL fetching. Enable multiple layers for maximum coverage. Layers are applied in order: Tor → Proxy → Headers → Direct.</span>
      </div>

      {/* Layer 1: Header Spoofing */}
      <LayerCard
        icon={Eye} color="text-blue-400"
        title="Layer 1 — Browser Fingerprint Profiles"
        subtitle="20 consistent profiles. Each domain gets a sticky profile for 1 hour."
        enabled={settings?.headerSpoofing ?? false}
        onToggle={() => setHeaderSpoofing.mutate({ enabled: !settings?.headerSpoofing })}
        loading={setHeaderSpoofing.isPending}
      >
        <div className="pt-3 space-y-3">
          <p className="text-xs text-zinc-400">
            Unlike simple header rotation, each domain is assigned one <strong className="text-zinc-300">consistent browser profile</strong> for a full hour. This means all requests to the same site look like they come from the same real browser — mixing headers from different browsers is a major bot detection signal.
          </p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2 rounded bg-zinc-800/50 space-y-1">
              <p className="text-zinc-400 font-medium">What rotates</p>
              <ul className="text-zinc-500 space-y-0.5 list-disc list-inside">
                <li>User-Agent (14 real browsers)</li>
                <li>Accept-Language (20 locales)</li>
                <li>X-Forwarded-For (ISP IP ranges)</li>
                <li>Sec-CH-UA / Sec-Fetch headers</li>
                <li>Cache-Control / DNT</li>
              </ul>
            </div>
            <div className="p-2 rounded bg-zinc-800/50 space-y-1">
              <p className="text-zinc-400 font-medium">Profile types</p>
              <ul className="text-zinc-500 space-y-0.5 list-disc list-inside">
                <li>Chrome / Windows (US, UK, DE)</li>
                <li>Chrome / Mac (US, FR)</li>
                <li>Firefox (Win, Mac, Linux)</li>
                <li>Safari (Mac, iPhone, iPad)</li>
                <li>Edge, Opera, Samsung</li>
                <li>Googlebot, Bingbot</li>
              </ul>
            </div>
          </div>
          <p className="text-xs text-zinc-600">Note: This spoofs headers only — the outbound IP is still Railway's. Combine with Tor or Proxy for real IP changes.</p>
        </div>
      </LayerCard>

      {/* Layer 2: Tor */}
      <LayerCard
        icon={Globe} color="text-purple-400"
        title="Layer 2 — Tor Network"
        subtitle="Supervised daemon with auto-restart. Real exit IPs verified after each circuit change."
        enabled={settings?.torEnabled ?? false}
        onToggle={() => setTorEnabled.mutate({ enabled: !settings?.torEnabled })}
        loading={setTorEnabled.isPending}
        badge={torBadge}
      >
        <div className="pt-3 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <StatBox label="State" value={torState} color={torState === "running" ? "text-green-400" : torState === "error" ? "text-red-400" : "text-zinc-400"} />
            <StatBox label="Bootstrap" value={`${tor?.bootstrapPercent ?? 0}%`} color={tor?.bootstrapPercent === 100 ? "text-green-400" : "text-yellow-400"} />
            <StatBox label="Exit IP" value={tor?.exitIp ?? "—"} color="text-purple-400" />
            <StatBox label="Uptime" value={tor?.uptime != null ? `${Math.floor(tor.uptime / 60)}m ${tor.uptime % 60}s` : "—"} />
            <StatBox label="Restarts" value={tor?.restartCount ?? 0} color={(tor?.restartCount ?? 0) > 0 ? "text-yellow-400" : "text-zinc-400"} />
            <StatBox label="Circuits" value={tor?.circuitCount ?? 0} />
          </div>

          {tor?.lastError && (
            <div className="p-2 rounded bg-red-500/10 border border-red-500/20 text-xs text-red-400">
              <AlertCircle className="w-3 h-3 inline mr-1" />{tor.lastError}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {(torState === "stopped" || torState === "error") && (
              <Button size="sm" variant="outline" onClick={() => startTor.mutate()} disabled={startTor.isPending} className="text-xs h-7">
                {startTor.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Globe className="w-3 h-3 mr-1" />}
                Start Tor
              </Button>
            )}
            {torState === "running" && (
              <>
                <Button size="sm" variant="outline" onClick={() => newCircuit.mutate()} disabled={newCircuit.isPending} className="text-xs h-7">
                  {newCircuit.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <RotateCcw className="w-3 h-3 mr-1" />}
                  New Circuit
                </Button>
                <Button size="sm" variant="outline" onClick={() => stopTor.mutate()} disabled={stopTor.isPending} className="text-xs h-7 text-red-400 border-red-500/30">
                  Stop Tor
                </Button>
              </>
            )}
            {(torState === "starting" || torState === "bootstrapping") && (
              <div className="flex items-center gap-2 text-xs text-yellow-400">
                <Loader2 className="w-3 h-3 animate-spin" />
                Bootstrapping... {tor?.bootstrapPercent ?? 0}% — this takes ~60 seconds
              </div>
            )}
          </div>

          <p className="text-xs text-zinc-600">
            Tor runs directly on the Railway server — no VPS needed. The supervisor auto-restarts on crash with exponential backoff (max 5 attempts). Exit IP is verified via ipify after each NEWNYM signal.
          </p>
        </div>
      </LayerCard>

      {/* Layer 3: Auto Proxy Pool */}
      <LayerCard
        icon={Wifi} color="text-green-400"
        title="Layer 3 — Auto Proxy Pool"
        subtitle="22 sources, DB-persistent, per-domain sticky assignment, smart rotation."
        enabled={settings?.proxyEnabled ?? false}
        onToggle={() => setProxyEnabled.mutate({ enabled: !settings?.proxyEnabled })}
        loading={setProxyEnabled.isPending}
        badge={proxyBadge}
      >
        <div className="pt-3 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <StatBox label="Total in pool" value={poolStats?.total ?? 0} />
            <StatBox label="Live proxies" value={poolStats?.live ?? 0} color="text-green-400" />
            <StatBox label="Dead proxies" value={poolStats?.dead ?? 0} color={(poolStats?.dead ?? 0) > 0 ? "text-red-400" : "text-zinc-400"} />
            <StatBox label="Avg latency" value={poolStats?.avgLatencyMs ? `${poolStats.avgLatencyMs}ms` : "—"} />
            <StatBox label="Requests routed" value={poolStats?.totalRequestsRouted ?? 0} color="text-blue-400" />
            <StatBox label="Last scraped" value={
              poolStats?.lastScrapeAgo != null
                ? poolStats.lastScrapeAgo < 60
                  ? `${poolStats.lastScrapeAgo}s ago`
                  : `${Math.floor(poolStats.lastScrapeAgo / 60)}m ago`
                : "Never"
            } />
          </div>

          {poolStats?.scrapeInProgress && (
            <div className="flex items-center gap-2 text-xs text-yellow-400">
              <Loader2 className="w-3 h-3 animate-spin" />
              Scraping and testing proxies...
            </div>
          )}

          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => scrapeProxies.mutate()} disabled={scrapeProxies.isPending || poolStats?.scrapeInProgress} className="text-xs h-7">
              {scrapeProxies.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <RefreshCw className="w-3 h-3 mr-1" />}
              Scrape Now
            </Button>
          </div>

          {/* Live proxy list */}
          {(poolData?.proxies?.filter(p => p.healthy).length ?? 0) > 0 && (
            <div className="space-y-1 max-h-[160px] overflow-y-auto rounded border border-zinc-800 p-2">
              {poolData?.proxies?.filter(p => p.healthy).slice(0, 15).map((p, i) => (
                <div key={i} className="flex items-center gap-2 text-xs font-mono text-zinc-400">
                  <CheckCircle2 className="w-3 h-3 text-green-400 flex-shrink-0" />
                  <span className="flex-1 truncate">{p.host}:{p.port}</span>
                  <Badge variant="outline" className="py-0 px-1 text-zinc-500 border-zinc-700 text-xs">{p.protocol}</Badge>
                  {p.avgLatencyMs > 0 && <span className="text-zinc-600">{p.avgLatencyMs}ms</span>}
                  {p.externalIp && <span className="text-zinc-600 hidden sm:block">{p.externalIp}</span>}
                </div>
              ))}
            </div>
          )}

          <p className="text-xs text-zinc-600">
            Sources: TheSpeedX, ShiftyTR, monosans, hookzof, clarketm, sunny9577, mmpx12, roosterkid, yakumo, vakhov (HTTP + SOCKS4 + SOCKS5). Pool persists to DB — survives server restarts. Each domain gets a sticky proxy for 30 minutes. Proxies with 5+ consecutive failures are auto-evicted.
          </p>
        </div>
      </LayerCard>
    </div>
  );
}
