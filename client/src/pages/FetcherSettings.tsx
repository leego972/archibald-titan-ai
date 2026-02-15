import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import {
  Loader2, Save, Globe, Bot as BotIcon, Shield, Plus, Trash2, TestTube,
  CheckCircle2, XCircle, Clock, ExternalLink, Wifi, WifiOff, MapPin,
  Zap, Info, ChevronDown, ChevronUp, AlertTriangle
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

// ─── Proxy Pool Section ──────────────────────────────────────────────

function ProxyPoolSection() {
  const utils = trpc.useUtils();
  const { data: proxyData, isLoading: proxiesLoading } = trpc.fetcher.listProxies.useQuery();
  const proxies = proxyData?.proxies;
  const { data: recommendations } = trpc.fetcher.recommendedProxyProviders.useQuery();
  const { data: requirements } = trpc.fetcher.proxyRequirements.useQuery();

  const addProxy = trpc.fetcher.addProxy.useMutation({
    onSuccess: () => {
      utils.fetcher.listProxies.invalidate();
      toast.success("Proxy added to pool");
      setShowAddDialog(false);
      resetForm();
    },
    onError: (err) => toast.error(err.message),
  });

  const addProxyFromUrl = trpc.fetcher.addProxyFromUrl.useMutation({
    onSuccess: () => {
      utils.fetcher.listProxies.invalidate();
      toast.success("Proxy added from URL");
      setShowQuickAdd(false);
      setQuickUrl("");
      setQuickLabel("");
      setQuickType("residential");
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteProxy = trpc.fetcher.deleteProxy.useMutation({
    onSuccess: () => {
      utils.fetcher.listProxies.invalidate();
      toast.success("Proxy removed");
    },
    onError: (err) => toast.error(err.message),
  });

  const testProxy = trpc.fetcher.testProxy.useMutation({
    onSuccess: (result, variables) => {
      utils.fetcher.listProxies.invalidate();
      if (result.healthy) {
        toast.success(`Proxy healthy! IP: ${result.externalIp} | ${result.country}, ${result.city} | ${result.latencyMs}ms`);
      } else {
        toast.error(`Proxy unhealthy: ${result.error}`);
      }
    },
    onError: (err) => toast.error(err.message),
  });

  // Add dialog state
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [showProviders, setShowProviders] = useState(false);
  const [showRequirements, setShowRequirements] = useState(false);

  // Form state
  const [label, setLabel] = useState("");
  const [protocol, setProtocol] = useState<"http" | "https" | "socks5">("http");
  const [host, setHost] = useState("");
  const [port, setPort] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [proxyType, setProxyType] = useState<"residential" | "datacenter" | "mobile" | "isp">("residential");
  const [country, setCountry] = useState("");
  const [provider, setProvider] = useState("");
  const [notes, setNotes] = useState("");

  // Quick add state
  const [quickUrl, setQuickUrl] = useState("");
  const [quickLabel, setQuickLabel] = useState("");
  const [quickType, setQuickType] = useState<"residential" | "datacenter" | "mobile" | "isp">("residential");

  const [testingId, setTestingId] = useState<number | null>(null);

  const resetForm = () => {
    setLabel(""); setProtocol("http"); setHost(""); setPort("");
    setUsername(""); setPassword(""); setProxyType("residential");
    setCountry(""); setProvider(""); setNotes("");
  };

  const handleAddProxy = () => {
    if (!label || !host || !port) {
      toast.error("Label, host, and port are required");
      return;
    }
    addProxy.mutate({
      label, protocol, host, port: parseInt(port),
      username: username || undefined, password: password || undefined,
      proxyType, country: country || undefined,
      provider: provider || undefined, notes: notes || undefined,
    });
  };

  const handleQuickAdd = () => {
    if (!quickUrl || !quickLabel) {
      toast.error("URL and label are required");
      return;
    }
    addProxyFromUrl.mutate({
      url: quickUrl, label: quickLabel, proxyType: quickType,
    });
  };

  const handleTest = (proxyId: number) => {
    setTestingId(proxyId);
    testProxy.mutate({ proxyId }, {
      onSettled: () => setTestingId(null),
    });
  };

  const proxyTypeColors: Record<string, string> = {
    residential: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    datacenter: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    mobile: "bg-purple-500/20 text-purple-400 border-purple-500/30",
    isp: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Proxy Pool</CardTitle>
              {proxies && proxies.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {proxies.filter(p => p.healthy === 1).length}/{proxies.length} healthy
                </Badge>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowQuickAdd(true)}>
                <Zap className="h-3.5 w-3.5 mr-1" />
                Quick Add
              </Button>
              <Button size="sm" onClick={() => setShowAddDialog(true)}>
                <Plus className="h-3.5 w-3.5 mr-1" />
                Add Proxy
              </Button>
            </div>
          </div>
          <CardDescription>
            Manage your proxy pool for automated credential fetching. Residential proxies are required
            for providers with bot detection (GoDaddy, Cloudflare, Google).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {proxiesLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !proxies || proxies.length === 0 ? (
            <div className="text-center py-8 space-y-3">
              <WifiOff className="h-10 w-10 mx-auto text-muted-foreground/50" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">No proxies configured</p>
                <p className="text-xs text-muted-foreground/70 mt-1">
                  Add a residential proxy to bypass bot detection on provider websites like GoDaddy.
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => setShowProviders(true)}>
                <Info className="h-3.5 w-3.5 mr-1" />
                Where to get proxies
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {proxies.map((proxy) => (
                <div
                  key={proxy.id}
                  className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                    proxy.healthy === 1
                      ? "border-border bg-card hover:bg-accent/30"
                      : "border-destructive/30 bg-destructive/5"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {proxy.healthy === 1 ? (
                      <Wifi className="h-4 w-4 text-emerald-400 shrink-0" />
                    ) : (
                      <WifiOff className="h-4 w-4 text-destructive shrink-0" />
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm truncate">{proxy.label}</span>
                        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${proxyTypeColors[proxy.proxyType] || ""}`}>
                          {proxy.proxyType}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                        <span>{proxy.protocol}://{proxy.host}:{proxy.port}</span>
                        {proxy.country && (
                          <span className="flex items-center gap-0.5">
                            <MapPin className="h-3 w-3" />
                            {proxy.country}{proxy.city ? `, ${proxy.city}` : ""}
                          </span>
                        )}
                        {proxy.latencyMs !== null && (
                          <span className="flex items-center gap-0.5">
                            <Clock className="h-3 w-3" />
                            {proxy.latencyMs}ms
                          </span>
                        )}
                        <span className="text-emerald-400">{proxy.successCount} ok</span>
                        {proxy.failCount > 0 && (
                          <span className="text-destructive">{proxy.failCount} fail</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 ml-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleTest(proxy.id)}
                      disabled={testingId === proxy.id}
                      className="h-8 px-2"
                    >
                      {testingId === proxy.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <TestTube className="h-3.5 w-3.5" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteProxy.mutate({ proxyId: proxy.id })}
                      className="h-8 px-2 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Provider Proxy Requirements */}
      <Card>
        <CardHeader
          className="cursor-pointer"
          onClick={() => setShowRequirements(!showRequirements)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-400" />
              <CardTitle className="text-lg">Provider Proxy Requirements</CardTitle>
            </div>
            {showRequirements ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </div>
          <CardDescription>
            Some providers require residential proxies to bypass bot detection.
          </CardDescription>
        </CardHeader>
        {showRequirements && requirements && (
          <CardContent>
            <div className="space-y-2">
              {Object.entries(requirements).map(([providerId, req]) => (
                <div key={providerId} className="flex items-start gap-3 p-2 rounded-md bg-accent/30">
                  {req.requiresProxy ? (
                    <XCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 mt-0.5 shrink-0" />
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium capitalize">{providerId.replace("_", " ")}</span>
                      {req.requiresProxy ? (
                        <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Proxy Required</Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Optional</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{req.reason}</p>
                    {req.requiresProxy && req.proxyTypes.length > 0 && (
                      <div className="flex gap-1 mt-1">
                        {req.proxyTypes.map(t => (
                          <Badge key={t} variant="outline" className={`text-[10px] px-1 py-0 ${proxyTypeColors[t] || ""}`}>
                            {t}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        )}
      </Card>

      {/* Add Proxy Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Proxy to Pool</DialogTitle>
            <DialogDescription>
              Enter your proxy details. Residential proxies are recommended for providers with bot detection.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Label</Label>
              <Input placeholder="e.g., BrightData US Residential" value={label} onChange={e => setLabel(e.target.value)} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>Protocol</Label>
                <Select value={protocol} onValueChange={(v: any) => setProtocol(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="http">HTTP</SelectItem>
                    <SelectItem value="https">HTTPS</SelectItem>
                    <SelectItem value="socks5">SOCKS5</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Host</Label>
                <Input placeholder="proxy.example.com" value={host} onChange={e => setHost(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Port</Label>
                <Input placeholder="8080" type="number" value={port} onChange={e => setPort(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Username (optional)</Label>
                <Input placeholder="proxy_user" value={username} onChange={e => setUsername(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Password (optional)</Label>
                <Input type="password" placeholder="proxy_pass" value={password} onChange={e => setPassword(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Proxy Type</Label>
                <Select value={proxyType} onValueChange={(v: any) => setProxyType(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="residential">Residential</SelectItem>
                    <SelectItem value="datacenter">Datacenter</SelectItem>
                    <SelectItem value="mobile">Mobile</SelectItem>
                    <SelectItem value="isp">ISP</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Country (optional)</Label>
                <Input placeholder="US" value={country} onChange={e => setCountry(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Provider (optional)</Label>
              <Input placeholder="e.g., Bright Data, Oxylabs" value={provider} onChange={e => setProvider(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Textarea placeholder="Any notes about this proxy..." value={notes} onChange={e => setNotes(e.target.value)} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancel</Button>
            <Button onClick={handleAddProxy} disabled={addProxy.isPending}>
              {addProxy.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Add Proxy
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quick Add Dialog */}
      <Dialog open={showQuickAdd} onOpenChange={setShowQuickAdd}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Quick Add Proxy</DialogTitle>
            <DialogDescription>
              Paste a proxy URL in any common format.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Proxy URL</Label>
              <Input
                placeholder="http://user:pass@host:port or host:port:user:pass"
                value={quickUrl}
                onChange={e => setQuickUrl(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Supported: <code>protocol://user:pass@host:port</code>, <code>host:port:user:pass</code>, <code>host:port</code>
              </p>
            </div>
            <div className="space-y-2">
              <Label>Label</Label>
              <Input placeholder="My Residential Proxy" value={quickLabel} onChange={e => setQuickLabel(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Proxy Type</Label>
              <Select value={quickType} onValueChange={(v: any) => setQuickType(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="residential">Residential</SelectItem>
                  <SelectItem value="datacenter">Datacenter</SelectItem>
                  <SelectItem value="mobile">Mobile</SelectItem>
                  <SelectItem value="isp">ISP</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowQuickAdd(false)}>Cancel</Button>
            <Button onClick={handleQuickAdd} disabled={addProxyFromUrl.isPending}>
              {addProxyFromUrl.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Recommended Providers Dialog */}
      <Dialog open={showProviders} onOpenChange={setShowProviders}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Recommended Proxy Providers</DialogTitle>
            <DialogDescription>
              These providers offer residential proxies that work well with the Fetcher.
              Sign up with any provider, get your proxy credentials, and add them to your pool.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {recommendations?.map((rec) => (
              <Card key={rec.name} className="border-border/50">
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-sm">{rec.name}</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">{rec.pricing}</p>
                    </div>
                    <a href={rec.url} target="_blank" rel="noopener noreferrer">
                      <Button variant="outline" size="sm">
                        <ExternalLink className="h-3 w-3 mr-1" />
                        Visit
                      </Button>
                    </a>
                  </div>
                  <div className="flex gap-1 mt-2">
                    {rec.types.map(t => (
                      <Badge key={t} variant="outline" className={`text-[10px] px-1.5 py-0 ${proxyTypeColors[t] || ""}`}>
                        {t}
                      </Badge>
                    ))}
                  </div>
                  <ul className="text-xs text-muted-foreground mt-2 space-y-0.5">
                    {rec.features.map((f, i) => (
                      <li key={i} className="flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3 text-emerald-400 shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-2 p-2 rounded bg-accent/30">
                    <p className="text-xs text-muted-foreground">
                      <strong>Setup:</strong> {rec.setupGuide}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Where to get proxies button (always visible) */}
      {proxies && proxies.length > 0 && (
        <div className="flex justify-center">
          <Button variant="ghost" size="sm" onClick={() => setShowProviders(true)} className="text-muted-foreground">
            <Info className="h-3.5 w-3.5 mr-1" />
            Where to get residential proxies
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Main Settings Page ──────────────────────────────────────────────

export default function FetcherSettings() {
  const { data: settings, isLoading } = trpc.fetcher.getSettings.useQuery();
  const updateSettings = trpc.fetcher.updateSettings.useMutation({
    onSuccess: () => toast.success("Settings saved"),
    onError: (err) => toast.error(err.message),
  });

  const [proxyServer, setProxyServer] = useState("");
  const [proxyUsername, setProxyUsername] = useState("");
  const [proxyPassword, setProxyPassword] = useState("");
  const [captchaService, setCaptchaService] = useState("");
  const [captchaApiKey, setCaptchaApiKey] = useState("");
  const [headless, setHeadless] = useState(true);

  useEffect(() => {
    if (settings) {
      setProxyServer(settings.proxyServer || "");
      setProxyUsername(settings.proxyUsername || "");
      setProxyPassword(settings.proxyPassword === "***" ? "" : settings.proxyPassword || "");
      setCaptchaService(settings.captchaService || "");
      setCaptchaApiKey(settings.captchaApiKey === "***" ? "" : settings.captchaApiKey || "");
      setHeadless(settings.headless === 1);
    }
  }, [settings]);

  const handleSave = () => {
    updateSettings.mutate({
      proxyServer: proxyServer || null,
      proxyUsername: proxyUsername || null,
      proxyPassword: proxyPassword || null,
      captchaService: captchaService || null,
      captchaApiKey: captchaApiKey || null,
      headless: headless ? 1 : 0,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Fetcher Settings</h1>
        <p className="text-muted-foreground mt-1">
          Configure proxies, CAPTCHA solving, and browser behavior.
        </p>
      </div>

      <Tabs defaultValue="proxies" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="proxies" className="flex items-center gap-1.5">
            <Globe className="h-3.5 w-3.5" />
            Proxies
          </TabsTrigger>
          <TabsTrigger value="captcha" className="flex items-center gap-1.5">
            <Shield className="h-3.5 w-3.5" />
            CAPTCHA
          </TabsTrigger>
          <TabsTrigger value="browser" className="flex items-center gap-1.5">
            <BotIcon className="h-3.5 w-3.5" />
            Browser
          </TabsTrigger>
        </TabsList>

        <TabsContent value="proxies" className="mt-4">
          <ProxyPoolSection />

          {/* Legacy single proxy (kept for backwards compatibility) */}
          <Card className="mt-4 border-dashed border-muted-foreground/20">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-sm text-muted-foreground">Legacy Single Proxy (Fallback)</CardTitle>
              </div>
              <CardDescription className="text-xs">
                This is the original single-proxy setting. It's used as a fallback if no proxy pool entries match.
                The proxy pool above is preferred.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="proxy-server" className="text-xs">Proxy Server</Label>
                <Input
                  id="proxy-server"
                  placeholder="http://proxy.example.com:8080"
                  value={proxyServer}
                  onChange={(e) => setProxyServer(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="proxy-user" className="text-xs">Username</Label>
                  <Input
                    id="proxy-user"
                    placeholder="proxy_username"
                    value={proxyUsername}
                    onChange={(e) => setProxyUsername(e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="proxy-pass" className="text-xs">Password</Label>
                  <Input
                    id="proxy-pass"
                    type="password"
                    placeholder="proxy_password"
                    value={proxyPassword}
                    onChange={(e) => setProxyPassword(e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="captcha" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">CAPTCHA Solver</CardTitle>
              </div>
              <CardDescription>
                Configure a CAPTCHA solving service to automatically handle reCAPTCHA,
                hCaptcha, and image CAPTCHAs during credential retrieval.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="captcha-service">Service</Label>
                <Select value={captchaService} onValueChange={setCaptchaService}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a CAPTCHA solving service" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2captcha">2Captcha</SelectItem>
                    <SelectItem value="anticaptcha">Anti-Captcha</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="captcha-key">API Key</Label>
                <Input
                  id="captcha-key"
                  type="password"
                  placeholder="Your CAPTCHA service API key"
                  value={captchaApiKey}
                  onChange={(e) => setCaptchaApiKey(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="browser" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <BotIcon className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">Browser Settings</CardTitle>
              </div>
              <CardDescription>
                Control how the stealth browser operates during fetch jobs.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Headless Mode</Label>
                  <p className="text-sm text-muted-foreground">
                    Run browser without visible window. Disable to watch the automation.
                  </p>
                </div>
                <Switch checked={headless} onCheckedChange={setHeadless} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Save (for legacy settings and browser/captcha) */}
      <Button onClick={handleSave} disabled={updateSettings.isPending} className="w-full">
        {updateSettings.isPending ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <Save className="h-4 w-4 mr-2" />
        )}
        Save Settings
      </Button>
    </div>
  );
}
