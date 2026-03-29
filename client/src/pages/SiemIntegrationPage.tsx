import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Activity, Plus, Trash2, TestTube, CheckCircle, XCircle,
  AlertTriangle, RefreshCw, Send, Server, Zap, Shield
} from "lucide-react";
import { toast } from "sonner";

const PROVIDER_ICONS: Record<string, string> = {
  splunk: "🔴",
  elastic: "🟡",
  datadog: "🐶",
  sentinel: "🔷",
  qradar: "🔵",
  generic_webhook: "🔗",
};

const PROVIDER_LABELS: Record<string, string> = {
  splunk: "Splunk HEC",
  elastic: "Elastic SIEM",
  datadog: "Datadog",
  sentinel: "Microsoft Sentinel",
  qradar: "IBM QRadar",
  generic_webhook: "Generic Webhook",
};

export default function SiemIntegrationPage() {
  const [showAdd, setShowAdd] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    provider: "splunk" as string,
    webhookUrl: "",
    apiKey: "",
    indexName: "",
    eventTypes: [] as string[],
  });

  const { data: configsData, refetch: refetchConfigs } = trpc.siem.getConfigs.useQuery();
  const { data: eventLogData, refetch: refetchLog } = trpc.siem.getEventLog.useQuery({ limit: 100 });
  const { data: eventTypesData } = trpc.siem.getEventTypes.useQuery();
  const { data: statsData } = trpc.siem.getStats.useQuery();

  const createConfig = trpc.siem.createConfig.useMutation({
    onSuccess: () => {
      refetchConfigs();
      setShowAdd(false);
      setForm({ name: "", provider: "splunk", webhookUrl: "", apiKey: "", indexName: "", eventTypes: [] });
      toast.success("SIEM integration created");
    },
    onError: (e) => toast.error("Error", { description: e.message }),
  });

  const updateConfig = trpc.siem.updateConfig.useMutation({
    onSuccess: () => { refetchConfigs(); toast.success("Updated"); },
  });

  const deleteConfig = trpc.siem.deleteConfig.useMutation({
    onSuccess: () => { refetchConfigs(); toast.success("Integration deleted"); },
  });

  const testConfig = trpc.siem.testConfig.useMutation({
    onSuccess: (_, vars) => {
      setTesting(null);
      refetchConfigs();
      refetchLog();
      toast.success("Test successful");
    },
    onError: (e) => { setTesting(null); toast.error("Test failed", { description: e.message }); },
  });

  const handleTest = (configId: string) => {
    setTesting(configId);
    testConfig.mutate({ configId });
  };

  const toggleEventType = (typeId: string) => {
    setForm((f) => ({
      ...f,
      eventTypes: f.eventTypes.includes(typeId)
        ? f.eventTypes.filter((t) => t !== typeId)
        : [...f.eventTypes, typeId],
    }));
  };

  const severityColor = (severity: string) => {
    if (severity === "critical") return "text-red-400";
    if (severity === "high") return "text-orange-400";
    if (severity === "medium") return "text-yellow-400";
    if (severity === "low") return "text-blue-400";
    return "text-slate-400";
  };

  const configs = configsData?.configs ?? [];
  const events = eventLogData?.events ?? [];
  const eventTypes = eventTypesData?.eventTypes ?? [];
  const stats = statsData;

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Activity className="h-7 w-7 text-blue-400" />
              SIEM Integration
            </h1>
            <p className="text-slate-400 mt-1">Forward security events to Splunk, Elastic, Datadog, Sentinel, and more</p>
          </div>
          <Button onClick={() => setShowAdd(true)} className="bg-blue-600 hover:bg-blue-700">
            <Plus className="h-4 w-4 mr-2" />
            Add Integration
          </Button>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { label: "Total Integrations", value: stats.totalConfigs, icon: <Server className="h-4 w-4" />, color: "text-blue-400" },
              { label: "Active", value: stats.enabledConfigs, icon: <Zap className="h-4 w-4" />, color: "text-green-400" },
              { label: "Events Sent", value: stats.totalEventsSent, icon: <Send className="h-4 w-4" />, color: "text-purple-400" },
              { label: "Failed", value: stats.totalEventsFailed, icon: <XCircle className="h-4 w-4" />, color: "text-red-400" },
              { label: "Success Rate", value: `${stats.successRate}%`, icon: <CheckCircle className="h-4 w-4" />, color: "text-green-400" },
            ].map((s) => (
              <Card key={s.label} className="bg-slate-900/50 border-slate-800">
                <CardContent className="p-4">
                  <div className={`flex items-center gap-2 mb-1 ${s.color}`}>{s.icon}<span className="text-xs text-slate-400">{s.label}</span></div>
                  <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Tabs */}
        <Tabs defaultValue="integrations">
          <TabsList className="bg-slate-900 border border-slate-800">
            <TabsTrigger value="integrations">Integrations ({configs.length})</TabsTrigger>
            <TabsTrigger value="eventlog">Event Log ({events.length})</TabsTrigger>
          </TabsList>

          {/* Integrations Tab */}
          <TabsContent value="integrations" className="space-y-4">
            {configs.length === 0 ? (
              <Card className="bg-slate-900/50 border-slate-800">
                <CardContent className="py-16 text-center">
                  <Activity className="h-12 w-12 text-slate-600 mx-auto mb-4" />
                  <p className="text-slate-400 text-lg font-medium mb-2">No SIEM integrations configured</p>
                  <p className="text-slate-500 text-sm mb-6">Connect your SIEM platform to receive real-time security events</p>
                  <Button onClick={() => setShowAdd(true)} className="bg-blue-600 hover:bg-blue-700">
                    <Plus className="h-4 w-4 mr-2" />Add Your First Integration
                  </Button>
                </CardContent>
              </Card>
            ) : (
              configs.map((config) => (
                <Card key={config.id} className="bg-slate-900/50 border-slate-800">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="text-2xl">{PROVIDER_ICONS[config.provider] ?? "🔗"}</div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-white">{config.name}</span>
                            <Badge className={config.enabled ? "bg-green-500/20 text-green-400 border-green-500/30" : "bg-slate-500/20 text-slate-400 border-slate-500/30"}>
                              {config.enabled ? "Active" : "Disabled"}
                            </Badge>
                            {config.lastTestStatus && (
                              <Badge className={config.lastTestStatus === "success" ? "bg-green-500/20 text-green-400 border-green-500/30" : "bg-red-500/20 text-red-400 border-red-500/30"}>
                                Last test: {config.lastTestStatus}
                              </Badge>
                            )}
                          </div>
                          <div className="text-sm text-slate-400 mt-0.5">{PROVIDER_LABELS[config.provider]} · {config.eventTypes.length} event types · {config.eventsSent} events sent</div>
                          <div className="text-xs text-slate-600 mt-1 font-mono truncate max-w-xs">{config.webhookUrl}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-slate-700 text-slate-300 hover:bg-slate-800"
                          onClick={() => updateConfig.mutate({ configId: config.id, enabled: !config.enabled })}
                        >
                          {config.enabled ? "Disable" : "Enable"}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
                          onClick={() => handleTest(config.id)}
                          disabled={testing === config.id}
                        >
                          {testing === config.id ? <RefreshCw className="h-3 w-3 animate-spin" /> : <TestTube className="h-3 w-3" />}
                          <span className="ml-1">Test</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                          onClick={() => deleteConfig.mutate({ configId: config.id })}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          {/* Event Log Tab */}
          <TabsContent value="eventlog" className="space-y-2">
            <div className="flex justify-end">
              <Button size="sm" variant="outline" className="border-slate-700 text-slate-300 hover:bg-slate-800" onClick={() => refetchLog()}>
                <RefreshCw className="h-3 w-3 mr-1" />Refresh
              </Button>
            </div>
            {events.length === 0 ? (
              <Card className="bg-slate-900/50 border-slate-800">
                <CardContent className="py-12 text-center text-slate-500">
                  <Activity className="h-8 w-8 mx-auto mb-3 text-slate-600" />
                  No events sent yet
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {events.map((event) => (
                  <Card key={event.id} className="bg-slate-900/50 border-slate-800">
                    <CardContent className="p-3">
                      <div className="flex items-center gap-3">
                        {event.status === "sent"
                          ? <CheckCircle className="h-4 w-4 text-green-400 shrink-0" />
                          : <XCircle className="h-4 w-4 text-red-400 shrink-0" />
                        }
                        <span className={`text-xs font-medium ${severityColor(event.severity)}`}>{event.severity.toUpperCase()}</span>
                        <span className="text-sm text-white font-mono">{event.eventType}</span>
                        <span className="text-xs text-slate-500">{event.source}</span>
                        <span className="text-xs text-slate-600 ml-auto">{new Date(event.sentAt).toLocaleString()}</span>
                      </div>
                      {event.error && <div className="text-xs text-red-400 mt-1 ml-7">{event.error}</div>}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Add Integration Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="bg-slate-900 border-slate-800 text-white max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add SIEM Integration</DialogTitle>
            <DialogDescription className="text-slate-400">Configure a webhook to forward security events to your SIEM</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label className="text-slate-300">Integration Name</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Production Splunk" className="bg-slate-800 border-slate-700 text-white" />
            </div>
            <div className="space-y-1">
              <Label className="text-slate-300">Provider</Label>
              <Select value={form.provider} onValueChange={(v) => setForm((f) => ({ ...f, provider: v }))}>
                <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  {Object.entries(PROVIDER_LABELS).map(([id, label]) => (
                    <SelectItem key={id} value={id} className="text-white hover:bg-slate-700">{PROVIDER_ICONS[id]} {label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-slate-300">Webhook URL</Label>
              <Input value={form.webhookUrl} onChange={(e) => setForm((f) => ({ ...f, webhookUrl: e.target.value }))} placeholder="https://your-siem.example.com/webhook" className="bg-slate-800 border-slate-700 text-white" />
            </div>
            <div className="space-y-1">
              <Label className="text-slate-300">API Key (optional)</Label>
              <Input type="password" value={form.apiKey} onChange={(e) => setForm((f) => ({ ...f, apiKey: e.target.value }))} placeholder="Bearer token or API key" className="bg-slate-800 border-slate-700 text-white" />
            </div>
            {(form.provider === "splunk" || form.provider === "elastic") && (
              <div className="space-y-1">
                <Label className="text-slate-300">Index Name (optional)</Label>
                <Input value={form.indexName} onChange={(e) => setForm((f) => ({ ...f, indexName: e.target.value }))} placeholder="main" className="bg-slate-800 border-slate-700 text-white" />
              </div>
            )}
            <div className="space-y-2">
              <Label className="text-slate-300">Event Types to Forward</Label>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {eventTypes.map((et) => (
                  <div key={et.id} className="flex items-center gap-2">
                    <Checkbox
                      id={et.id}
                      checked={form.eventTypes.includes(et.id)}
                      onCheckedChange={() => toggleEventType(et.id)}
                      className="border-slate-600"
                    />
                    <label htmlFor={et.id} className="text-sm text-slate-300 cursor-pointer flex-1">
                      {et.label}
                      <span className="text-xs text-slate-500 ml-2">({et.category})</span>
                    </label>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)} className="border-slate-700 text-slate-300">Cancel</Button>
            <Button
              onClick={() => createConfig.mutate(form as any)}
              disabled={!form.name || !form.webhookUrl || form.eventTypes.length === 0 || createConfig.isPending}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {createConfig.isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : "Create Integration"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
