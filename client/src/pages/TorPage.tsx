/**
 * Titan Tor Browser Page
 * Ultra-fast server-side Tor with reverse-connection firewall.
 * Advanced under the hood — dead simple to operate.
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
import { toast } from "sonner";
import {
  Shield, ShieldCheck, ShieldOff, Globe, RefreshCw, Loader2,
  Terminal, Copy, CheckCircle2, AlertTriangle, Wifi, WifiOff,
  Lock, Unlock, Eye, Server, Zap, Info
} from "lucide-react";

export default function TorPage() {
  const [tab, setTab] = useState("status");
  const [customHost, setCustomHost] = useState("");
  const [customPort, setCustomPort] = useState("22");
  const [customUser, setCustomUser] = useState("root");
  const [customPass, setCustomPass] = useState("");
  const [tunnelPort, setTunnelPort] = useState("9150");
  const [copied, setCopied] = useState(false);

  const configQuery = trpc.tor.getConfig.useQuery();
  const activeStateQuery = trpc.tor.getActiveState.useQuery();
  const tunnelQuery = trpc.tor.getTunnelCommand.useQuery();

  const configureTitan = trpc.tor.configureTitanServer.useMutation({
    onSuccess: () => { toast.success("Configured to use Titan Server"); configQuery.refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const configureCustom = trpc.tor.configureCustomServer.useMutation({
    onSuccess: () => { toast.success("Custom server configured"); configQuery.refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const installTor = trpc.tor.installTor.useMutation({
    onSuccess: (d) => {
      if (d.success) toast.success(d.message);
      else toast.error(d.message);
      configQuery.refetch();
    },
    onError: (e) => toast.error(e.message),
  });
  const setFirewall = trpc.tor.setFirewall.useMutation({
    onSuccess: (d) => {
      toast[d.success ? "success" : "error"](d.message);
      configQuery.refetch();
    },
    onError: (e) => toast.error(e.message),
  });
  const getStatus = trpc.tor.getStatus.useMutation({
    onSuccess: (d) => {
      if (d.running) toast.success(d.message);
      else toast.warning(d.message);
    },
    onError: (e) => toast.error(e.message),
  });
  const newCircuit = trpc.tor.newCircuit.useMutation({
    onSuccess: (d) => toast[d.success ? "success" : "error"](d.message),
    onError: (e) => toast.error(e.message),
  });
  const setActive = trpc.tor.setActive.useMutation({
    onSuccess: () => activeStateQuery.refetch(),
    onError: (e) => toast.error(e.message),
  });

  const config = configQuery.data;
  const status = getStatus.data;
  const tunnel = tunnelQuery.data;
  const isActive = activeStateQuery.data?.active ?? false;

  const copyTunnel = () => {
    if (tunnel?.command) {
      navigator.clipboard.writeText(tunnel.command);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-purple-500/10 border border-purple-500/20">
            <Globe className="w-6 h-6 text-purple-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Tor Browser</h1>
            <p className="text-sm text-zinc-400">Ultra-fast anonymous browsing with reverse-connection firewall</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {config?.configured && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-zinc-400">Active</span>
              <Switch
                checked={isActive}
                onCheckedChange={(v) => setActive.mutate({ active: v })}
              />
            </div>
          )}
          <Badge variant={isActive ? "default" : "secondary"} className={isActive ? "bg-purple-500/20 text-purple-300 border-purple-500/30" : ""}>
            {isActive ? "ON" : "OFF"}
          </Badge>
        </div>
      </div>

      {/* Speed + Security badges */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { icon: Zap, label: "Circuit Racing", desc: "3 circuits built simultaneously", color: "yellow" },
          { icon: Shield, label: "Firewall", desc: config?.firewallEnabled ? "Active" : "Inactive", color: config?.firewallEnabled ? "green" : "zinc" },
          { icon: Lock, label: "DNS Protected", desc: "No DNS leaks", color: "blue" },
          { icon: Globe, label: "Exit IP", desc: status?.exitIp ?? "Unknown", color: "purple" },
        ].map(({ icon: Icon, label, desc, color }) => (
          <div key={label} className={`p-3 rounded-lg bg-${color}-500/10 border border-${color}-500/20`}>
            <Icon className={`w-4 h-4 text-${color}-400 mb-1`} />
            <div className={`text-xs font-medium text-${color}-300`}>{label}</div>
            <div className="text-xs text-zinc-400 truncate">{desc}</div>
          </div>
        ))}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-zinc-900 border border-zinc-800">
          <TabsTrigger value="status">Status</TabsTrigger>
          <TabsTrigger value="setup">Setup</TabsTrigger>
          <TabsTrigger value="connect">Connect Browser</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
        </TabsList>

        {/* ── Status Tab ── */}
        <TabsContent value="status" className="space-y-4 mt-4">
          {!config?.configured ? (
            <Card className="bg-zinc-900 border-zinc-800">
              <CardContent className="pt-6 text-center space-y-3">
                <Globe className="w-12 h-12 text-zinc-600 mx-auto" />
                <p className="text-zinc-400">Tor is not configured yet.</p>
                <Button onClick={() => setTab("setup")} variant="outline">Go to Setup</Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {/* Status card */}
              <Card className="bg-zinc-900 border-zinc-800">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    {status?.running
                      ? <CheckCircle2 className="w-4 h-4 text-green-400" />
                      : <AlertTriangle className="w-4 h-4 text-yellow-400" />}
                    Tor Status
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="space-y-1">
                      <span className="text-zinc-500">Status</span>
                      <div className={`font-medium ${status?.running ? "text-green-400" : "text-zinc-400"}`}>
                        {status?.running ? "Running" : "Not checked"}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <span className="text-zinc-500">Tor Verified</span>
                      <div className={`font-medium ${status?.isTor ? "text-green-400" : "text-zinc-400"}`}>
                        {status?.isTor ? "✓ Yes" : "—"}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <span className="text-zinc-500">Exit IP</span>
                      <div className="font-medium text-purple-300">{status?.exitIp ?? "—"}</div>
                    </div>
                    <div className="space-y-1">
                      <span className="text-zinc-500">Version</span>
                      <div className="font-medium text-zinc-300">{status?.version ?? "—"}</div>
                    </div>
                    <div className="space-y-1">
                      <span className="text-zinc-500">Firewall</span>
                      <div className={`font-medium ${status?.firewallActive ? "text-green-400" : "text-zinc-400"}`}>
                        {status?.firewallActive ? "✓ Active" : "Inactive"}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <span className="text-zinc-500">Server</span>
                      <div className="font-medium text-zinc-300">{config.useTitanServer ? "Titan Server" : config.sshHost}</div>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button
                      onClick={() => getStatus.mutate()}
                      disabled={getStatus.isPending}
                      className="flex-1"
                      variant="outline"
                    >
                      {getStatus.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                      Check Status
                    </Button>
                    <Button
                      onClick={() => newCircuit.mutate()}
                      disabled={newCircuit.isPending}
                      className="flex-1 bg-purple-600 hover:bg-purple-700"
                    >
                      {newCircuit.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                      New Circuit
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Install / Reinstall */}
              <Card className="bg-zinc-900 border-zinc-800">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Install / Update Tor</CardTitle>
                  <CardDescription>Installs Tor with ultra-fast config on your server. Safe to run again to update.</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button
                    onClick={() => installTor.mutate({ enableFirewall: true })}
                    disabled={installTor.isPending}
                    className="w-full bg-purple-600 hover:bg-purple-700"
                  >
                    {installTor.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Zap className="w-4 h-4 mr-2" />}
                    {installTor.isPending ? "Installing..." : "Install Tor (Ultra-Fast + Firewall)"}
                  </Button>
                  {installTor.data && (
                    <div className={`mt-3 p-3 rounded text-xs font-mono whitespace-pre-wrap max-h-40 overflow-y-auto ${installTor.data.success ? "bg-green-500/10 text-green-300" : "bg-red-500/10 text-red-300"}`}>
                      {installTor.data.output || installTor.data.message}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* ── Setup Tab ── */}
        <TabsContent value="setup" className="space-y-4 mt-4">
          {/* Option 1: Titan Server */}
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Server className="w-4 h-4 text-purple-400" />
                Use Titan Server (Recommended)
              </CardTitle>
              <CardDescription>Runs Tor on your already-configured Titan Server. One click.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={() => configureTitan.mutate({ localTunnelPort: parseInt(tunnelPort) })}
                disabled={configureTitan.isPending}
                className="w-full bg-purple-600 hover:bg-purple-700"
              >
                {configureTitan.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                Use Titan Server
              </Button>
            </CardContent>
          </Card>

          {/* Option 2: Custom server */}
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Terminal className="w-4 h-4 text-zinc-400" />
                Use Custom SSH Server
              </CardTitle>
              <CardDescription>Connect to any VPS via SSH to run Tor there.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Host / IP</Label>
                  <Input value={customHost} onChange={e => setCustomHost(e.target.value)} placeholder="192.168.1.1" className="bg-zinc-800 border-zinc-700" />
                </div>
                <div className="space-y-1">
                  <Label>SSH Port</Label>
                  <Input value={customPort} onChange={e => setCustomPort(e.target.value)} placeholder="22" className="bg-zinc-800 border-zinc-700" />
                </div>
                <div className="space-y-1">
                  <Label>Username</Label>
                  <Input value={customUser} onChange={e => setCustomUser(e.target.value)} placeholder="root" className="bg-zinc-800 border-zinc-700" />
                </div>
                <div className="space-y-1">
                  <Label>Password</Label>
                  <Input type="password" value={customPass} onChange={e => setCustomPass(e.target.value)} placeholder="••••••••" className="bg-zinc-800 border-zinc-700" />
                </div>
              </div>
              <Button
                onClick={() => configureCustom.mutate({ host: customHost, port: parseInt(customPort), username: customUser, password: customPass, localTunnelPort: parseInt(tunnelPort) })}
                disabled={configureCustom.isPending || !customHost}
                className="w-full"
                variant="outline"
              >
                {configureCustom.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Save Custom Server
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Connect Browser Tab ── */}
        <TabsContent value="connect" className="space-y-4 mt-4">
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Connect Your Browser</CardTitle>
              <CardDescription>Route your browser traffic through Tor in 2 steps.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {tunnel?.command ? (
                <>
                  <div className="space-y-2">
                    <Label className="text-zinc-300">Step 1 — Run this in your terminal</Label>
                    <div className="flex gap-2">
                      <code className="flex-1 p-3 bg-zinc-800 rounded text-xs text-green-300 font-mono break-all">{tunnel.command}</code>
                      <Button size="icon" variant="outline" onClick={copyTunnel}>
                        {copied ? <CheckCircle2 className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-zinc-300">Step 2 — Set browser SOCKS5 proxy</Label>
                    <div className="p-3 bg-zinc-800 rounded text-sm space-y-1">
                      <div className="flex justify-between"><span className="text-zinc-400">Proxy type</span><span className="text-white font-mono">SOCKS5</span></div>
                      <div className="flex justify-between"><span className="text-zinc-400">Host</span><span className="text-white font-mono">127.0.0.1</span></div>
                      <div className="flex justify-between"><span className="text-zinc-400">Port</span><span className="text-white font-mono">{tunnel.localPort}</span></div>
                    </div>
                  </div>
                  <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded text-xs text-blue-300 flex gap-2">
                    <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span>After connecting, visit <strong>check.torproject.org</strong> to verify. The reverse-connection firewall prevents any website from connecting back to your device.</span>
                  </div>
                </>
              ) : (
                <div className="text-center py-6 text-zinc-500">
                  <Globe className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p>Configure a server first to get connection instructions.</p>
                  <Button onClick={() => setTab("setup")} variant="outline" className="mt-3">Go to Setup</Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* New circuit */}
          {config?.configured && (
            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Change Exit IP</CardTitle>
                <CardDescription>Request a new Tor circuit to get a different exit IP address instantly.</CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  onClick={() => newCircuit.mutate()}
                  disabled={newCircuit.isPending}
                  className="w-full bg-purple-600 hover:bg-purple-700"
                >
                  {newCircuit.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                  Get New Exit IP
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── Security Tab ── */}
        <TabsContent value="security" className="space-y-4 mt-4">
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-green-400" />
                Reverse-Connection Firewall
              </CardTitle>
              <CardDescription>
                Prevents remote servers from ever connecting back to your device. All unsolicited inbound connections are blocked at the server level.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-2 text-sm">
                {[
                  { label: "Inbound block", desc: "All unsolicited TCP/UDP connections dropped" },
                  { label: "Kill-switch", desc: "If Tor drops, ALL traffic drops — no IP leak" },
                  { label: "DNS protection", desc: "All DNS queries through Tor — port 53 blocked" },
                  { label: "TCP hardening", desc: "SYN cookies, no redirects, no source routing" },
                  { label: "Connection isolation", desc: "Each destination gets its own Tor circuit" },
                ].map(({ label, desc }) => (
                  <div key={label} className="flex items-start gap-2 p-2 rounded bg-zinc-800/50">
                    <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="font-medium text-zinc-200">{label}</div>
                      <div className="text-zinc-500 text-xs">{desc}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-800 border border-zinc-700">
                <div>
                  <div className="text-sm font-medium text-zinc-200">Firewall Status</div>
                  <div className={`text-xs ${config?.firewallEnabled ? "text-green-400" : "text-zinc-500"}`}>
                    {config?.firewallEnabled ? "Active — you are protected" : "Inactive"}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {config?.firewallEnabled
                    ? <ShieldCheck className="w-5 h-5 text-green-400" />
                    : <ShieldOff className="w-5 h-5 text-zinc-500" />}
                  <Switch
                    checked={config?.firewallEnabled ?? false}
                    onCheckedChange={(v) => setFirewall.mutate({ enabled: v })}
                    disabled={setFirewall.isPending || !config?.configured}
                  />
                </div>
              </div>

              {setFirewall.isPending && (
                <div className="flex items-center gap-2 text-sm text-zinc-400">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Applying firewall rules...
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
