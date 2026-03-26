import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Shield, Globe, Power, Copy, Check, AlertCircle, Wifi, WifiOff,
  RefreshCw, ExternalLink, Info, BookOpen, Server, Lock, Zap, Eye, EyeOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

const COUNTRIES = [
  { id: "us", name: "United States",  flag: "🇺🇸" },
  { id: "gb", name: "United Kingdom", flag: "🇬🇧" },
  { id: "ca", name: "Canada",         flag: "🇨🇦" },
  { id: "de", name: "Germany",        flag: "🇩🇪" },
  { id: "fr", name: "France",         flag: "🇫🇷" },
  { id: "jp", name: "Japan",          flag: "🇯🇵" },
  { id: "au", name: "Australia",      flag: "🇦🇺" },
  { id: "br", name: "Brazil",         flag: "🇧🇷" },
  { id: "in", name: "India",          flag: "🇮🇳" },
  { id: "nl", name: "Netherlands",    flag: "🇳🇱" },
  { id: "sg", name: "Singapore",      flag: "🇸🇬" },
  { id: "se", name: "Sweden",         flag: "🇸🇪" },
  { id: "ch", name: "Switzerland",    flag: "🇨🇭" },
  { id: "il", name: "Israel",         flag: "🇮🇱" },
  { id: "mx", name: "Mexico",         flag: "🇲🇽" },
  { id: "za", name: "South Africa",   flag: "🇿🇦" },
  { id: "ae", name: "UAE",            flag: "🇦🇪" },
  { id: "hk", name: "Hong Kong",      flag: "🇭🇰" },
];

const PROXY_PORTS: Record<string, { port: number; label: string; desc: string }> = {
  http:   { port: 7000,  label: "HTTP",         desc: "Standard HTTP proxy — compatible with all browsers and tools" },
  https:  { port: 7000,  label: "HTTPS",        desc: "Encrypted HTTP proxy — same port, use with TLS-capable clients" },
  socks5: { port: 7001,  label: "SOCKS5",       desc: "Low-level proxy — works with any TCP application, supports UDP" },
  socks4: { port: 7002,  label: "SOCKS4",       desc: "Legacy SOCKS proxy — use only if SOCKS5 is unsupported" },
};

function ConfigRow({ label, value, field, copiedField, onCopy, secret }: {
  label: string; value: string; field: string; copiedField: string | null; onCopy: (v: string, f: string) => void; secret?: boolean;
}) {
  const [show, setShow] = useState(false);
  const display = secret && !show ? "•".repeat(Math.min(value.length, 20)) : value;
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-border/30 last:border-0">
      <span className="text-xs text-muted-foreground w-24 shrink-0">{label}</span>
      <code className="flex-1 text-xs font-mono bg-muted/50 px-2 py-1 rounded truncate">{display}</code>
      {secret && (
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 shrink-0" onClick={() => setShow(s => !s)}>
          {show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
        </Button>
      )}
      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 shrink-0" onClick={() => onCopy(value, field)}>
        {copiedField === field ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
      </Button>
    </div>
  );
}

export default function VpnPage() {
  const queryClient = useQueryClient();
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [protocol, setProtocol] = useState("http");
  const [ipCheckResult, setIpCheckResult] = useState<{ ip: string; country: string; org: string } | null>(null);
  const [ipChecking, setIpChecking] = useState(false);

  const { data: status, isLoading: statusLoading } = trpc.vpn.getStatus.useQuery();
  const { data: config, isLoading: configLoading } = trpc.vpn.getConfig.useQuery(undefined, {
    enabled: !!status?.active,
  });

  const toggleMutation = trpc.vpn.toggleStatus.useMutation({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [["vpn", "getStatus"]] });
      queryClient.invalidateQueries({ queryKey: [["vpn", "getConfig"]] });
      toast.success("VPN status updated");
    },
    onError: (error) => toast.error("Failed to update VPN", { description: error.message }),
  });

  const handleToggle = (checked: boolean) => {
    toggleMutation.mutate({ active: checked, country: status?.country || "us" });
  };

  const handleCountryChange = (country: string) => {
    toggleMutation.mutate({ active: status?.active || false, country });
  };

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
    toast.success(`${field} copied`);
  };

  const copyAllConfig = () => {
    if (!config) return;
    const proxyInfo = PROXY_PORTS[protocol];
    const text = [
      `Host:     ${config.host}`,
      `Port:     ${proxyInfo.port}`,
      `Username: ${config.username}`,
      `Password: ${config.password}`,
      `Protocol: ${proxyInfo.label}`,
      `Country:  ${COUNTRIES.find(c => c.id === config.country)?.name || config.country}`,
    ].join("\n");
    navigator.clipboard.writeText(text);
    toast.success("Full config copied to clipboard");
  };

  const checkMyIp = async () => {
    setIpChecking(true);
    setIpCheckResult(null);
    try {
      const res = await fetch("https://ipapi.co/json/");
      const data = await res.json();
      setIpCheckResult({ ip: data.ip, country: data.country_name, org: data.org });
    } catch {
      toast.error("IP check failed — check your network connection");
    } finally {
      setIpChecking(false);
    }
  };

  const currentCountry = COUNTRIES.find(c => c.id === (status?.country || "us"));
  const proxyInfo = PROXY_PORTS[protocol];

  if (statusLoading) {
    return (
      <div className="flex items-center justify-center h-full p-12">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Shield className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Titan Proxy Network</h1>
            <p className="text-xs text-muted-foreground">Rotating residential proxies · {COUNTRIES.length} countries · HTTP + SOCKS5</p>
          </div>
        </div>
        <Badge
          variant="outline"
          className={status?.active
            ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/30 gap-1.5"
            : "text-zinc-400 bg-zinc-500/10 border-zinc-500/30 gap-1.5"}
        >
          {status?.active ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
          {status?.active ? "Connected" : "Disconnected"}
        </Badge>
      </div>

      <Tabs defaultValue="connection">
        <TabsList className="grid grid-cols-3 w-full">
          <TabsTrigger value="connection" className="text-xs"><Power className="h-3 w-3 mr-1" />Connection</TabsTrigger>
          <TabsTrigger value="config" className="text-xs"><Server className="h-3 w-3 mr-1" />Config</TabsTrigger>
          <TabsTrigger value="guide" className="text-xs"><BookOpen className="h-3 w-3 mr-1" />Setup Guide</TabsTrigger>
        </TabsList>

        {/* ── Connection Tab ── */}
        <TabsContent value="connection" className="mt-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Toggle + Country */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Proxy Control</CardTitle>
                <CardDescription className="text-xs">Toggle connection and select exit country</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {/* Toggle */}
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/40">
                  <div className="flex items-center gap-2.5">
                    <div className={`h-2 w-2 rounded-full ${status?.active ? "bg-emerald-400 animate-pulse" : "bg-zinc-500"}`} />
                    <div>
                      <p className="text-sm font-medium">{status?.active ? "Proxy Active" : "Proxy Inactive"}</p>
                      <p className="text-xs text-muted-foreground">
                        {status?.active
                          ? `Routing via ${currentCountry?.flag} ${currentCountry?.name}`
                          : "150 credits to activate"}
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={status?.active || false}
                    onCheckedChange={handleToggle}
                    disabled={toggleMutation.isPending}
                  />
                </div>

                {/* Country selector */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                    <Globe className="h-3.5 w-3.5" />Exit Country
                  </label>
                  <Select value={status?.country || "us"} onValueChange={handleCountryChange} disabled={toggleMutation.isPending}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue>
                        {currentCountry && (
                          <span className="flex items-center gap-2">
                            <span>{currentCountry.flag}</span>
                            <span>{currentCountry.name}</span>
                          </span>
                        )}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent className="max-h-64">
                      {COUNTRIES.map(c => (
                        <SelectItem key={c.id} value={c.id}>
                          <span className="flex items-center gap-2">
                            <span>{c.flag}</span>
                            <span>{c.name}</span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Protocol selector */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                    <Lock className="h-3.5 w-3.5" />Protocol
                  </label>
                  <Select value={protocol} onValueChange={setProtocol}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(PROXY_PORTS).map(([key, val]) => (
                        <SelectItem key={key} value={key}>
                          <span className="flex items-center gap-2">
                            <span className="font-mono font-medium">{val.label}</span>
                            <span className="text-xs text-muted-foreground">:{val.port}</span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-muted-foreground">{proxyInfo.desc}</p>
                </div>
              </CardContent>
            </Card>

            {/* IP Leak Test */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">IP Leak Test</CardTitle>
                <CardDescription className="text-xs">Verify your real IP is hidden</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={checkMyIp}
                  disabled={ipChecking}
                >
                  {ipChecking
                    ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Checking...</>
                    : <><Zap className="h-4 w-4 mr-2" />Check My IP</>}
                </Button>

                {ipCheckResult && (
                  <div className="space-y-2 p-3 rounded-lg bg-muted/30 border border-border/40">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">IP Address</span>
                      <code className="font-mono font-medium">{ipCheckResult.ip}</code>
                    </div>
                    <Separator className="opacity-30" />
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Country</span>
                      <span>{ipCheckResult.country}</span>
                    </div>
                    <Separator className="opacity-30" />
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">ISP / Org</span>
                      <span className="text-right max-w-[160px] truncate">{ipCheckResult.org}</span>
                    </div>

                    {status?.active && currentCountry && (
                      <div className={`mt-2 text-xs font-medium flex items-center gap-1.5 ${
                        ipCheckResult.country.toLowerCase().includes(currentCountry.name.toLowerCase().split(" ")[0].toLowerCase())
                          ? "text-emerald-400" : "text-yellow-400"
                      }`}>
                        {ipCheckResult.country.toLowerCase().includes(currentCountry.name.toLowerCase().split(" ")[0].toLowerCase())
                          ? <><Check className="h-3.5 w-3.5" />IP matches selected country</>
                          : <><AlertCircle className="h-3.5 w-3.5" />IP does not match — proxy may not be configured in your browser yet</>}
                      </div>
                    )}
                  </div>
                )}

                <Alert className="py-3">
                  <Info className="h-3.5 w-3.5" />
                  <AlertDescription className="text-xs">
                    This test checks your browser's public IP. The proxy only hides your IP when configured in your browser or app — it does not automatically route all traffic.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── Config Tab ── */}
        <TabsContent value="config" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm">Proxy Credentials</CardTitle>
                  <CardDescription className="text-xs">Use these in your browser, scraper, or system proxy settings</CardDescription>
                </div>
                {config && (
                  <Button variant="outline" size="sm" className="h-8 text-xs" onClick={copyAllConfig}>
                    <Copy className="h-3.5 w-3.5 mr-1.5" />Copy All
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {!status?.active ? (
                <div className="flex flex-col items-center justify-center py-12 text-center border-2 border-dashed rounded-lg">
                  <WifiOff className="h-10 w-10 text-muted-foreground mb-3 opacity-30" />
                  <h3 className="font-medium mb-1">Proxy is Disconnected</h3>
                  <p className="text-xs text-muted-foreground mb-4 max-w-xs">
                    Activate the proxy to generate your credentials.
                  </p>
                  <Button size="sm" onClick={() => handleToggle(true)} disabled={toggleMutation.isPending}>
                    <Power className="h-3.5 w-3.5 mr-1.5" />Connect (150 Credits)
                  </Button>
                </div>
              ) : configLoading ? (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : config ? (
                <div className="space-y-0">
                  <Alert className="mb-4 bg-emerald-500/10 border-emerald-500/20">
                    <Wifi className="h-3.5 w-3.5 text-emerald-400" />
                    <AlertTitle className="text-emerald-400 text-xs">Active — {currentCountry?.flag} {currentCountry?.name}</AlertTitle>
                    <AlertDescription className="text-xs">
                      Your proxy is live. Copy the credentials below and configure them in your browser or tool.
                    </AlertDescription>
                  </Alert>

                  <ConfigRow label="Host" value={config.host} field="Host" copiedField={copiedField} onCopy={copyToClipboard} />
                  <ConfigRow label="Port" value={String(proxyInfo.port)} field="Port" copiedField={copiedField} onCopy={copyToClipboard} />
                  <ConfigRow label="Username" value={config.username} field="Username" copiedField={copiedField} onCopy={copyToClipboard} />
                  <ConfigRow label="Password" value={config.password} field="Password" copiedField={copiedField} onCopy={copyToClipboard} secret />
                  <ConfigRow label="Protocol" value={proxyInfo.label} field="Protocol" copiedField={copiedField} onCopy={copyToClipboard} />

                  <div className="mt-4 p-3 rounded-lg bg-muted/30 border border-border/40">
                    <p className="text-[11px] text-muted-foreground font-mono">
                      {protocol === "socks5" || protocol === "socks4"
                        ? `${protocol}://${config.username}:${config.password}@${config.host}:${proxyInfo.port}`
                        : `http://${config.username}:${config.password}@${config.host}:${proxyInfo.port}`}
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-[10px] mt-1 px-2"
                      onClick={() => copyToClipboard(
                        `${protocol}://${config.username}:${config.password}@${config.host}:${proxyInfo.port}`,
                        "URI"
                      )}
                    >
                      {copiedField === "URI" ? <Check className="h-3 w-3 mr-1 text-green-500" /> : <Copy className="h-3 w-3 mr-1" />}
                      Copy URI
                    </Button>
                  </div>
                </div>
              ) : (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>Failed to load proxy configuration.</AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Setup Guide Tab ── */}
        <TabsContent value="guide" className="mt-4 space-y-4">
          {[
            {
              title: "Chrome / Brave (via Extension)",
              steps: [
                "Install the 'Proxy SwitchyOmega' extension from the Chrome Web Store.",
                "Open the extension → New Profile → Proxy Profile.",
                "Set Protocol to HTTP, Server to gate.smartproxy.com, Port to 7000.",
                "Enter your Titan proxy Username and Password.",
                "Click Apply Changes and activate the profile.",
              ],
            },
            {
              title: "Firefox",
              steps: [
                "Go to Settings → Network Settings → Manual proxy configuration.",
                "Set HTTP Proxy to gate.smartproxy.com, Port 7000.",
                "Check 'Use this proxy server for all protocols'.",
                "Click OK. Firefox will prompt for username/password on first use.",
              ],
            },
            {
              title: "Python (requests)",
              steps: [
                "Install requests: pip install requests",
                "Use the proxy dict: proxies = {'http': 'http://USER:PASS@gate.smartproxy.com:7000', 'https': 'http://USER:PASS@gate.smartproxy.com:7000'}",
                "Pass to requests: response = requests.get(url, proxies=proxies)",
              ],
            },
            {
              title: "curl",
              steps: [
                "Use the -x flag: curl -x http://USER:PASS@gate.smartproxy.com:7000 https://example.com",
                "For SOCKS5: curl --socks5 USER:PASS@gate.smartproxy.com:7001 https://example.com",
              ],
            },
          ].map(section => (
            <Card key={section.title}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">{section.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <ol className="space-y-2">
                  {section.steps.map((step, i) => (
                    <li key={i} className="flex gap-2.5 text-xs text-muted-foreground">
                      <span className="h-4 w-4 rounded-full bg-primary/20 text-primary flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">{i + 1}</span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          ))}

          <Card className="border-border/40">
            <CardContent className="py-4 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <ExternalLink className="h-3.5 w-3.5" />
                Need more help? See the full Smartproxy documentation.
              </div>
              <Button variant="outline" size="sm" className="h-7 text-xs" asChild>
                <a href="https://help.smartproxy.com" target="_blank" rel="noopener noreferrer">
                  Open Docs
                </a>
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
