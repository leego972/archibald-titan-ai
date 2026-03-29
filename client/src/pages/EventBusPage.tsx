import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Zap, Plus, Trash2, RefreshCw, Play, CheckCircle2, XCircle,
  Clock, AlertTriangle, ArrowRight, Activity, Settings, List
} from "lucide-react";

type Tab = "rules" | "log" | "stats";

export default function EventBusPage() {
  const [activeTab, setActiveTab] = useState<Tab>("rules");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newRule, setNewRule] = useState({
    name: "",
    description: "",
    sourceEngine: "",
    eventType: "",
    targetEngine: "",
    actionType: "",
  });

  // ── Queries ────────────────────────────────────────────────────────────────
  const { data: rulesData, refetch: refetchRules } = trpc.eventBus.getRules.useQuery();
  const { data: logData, refetch: refetchLog } = trpc.eventBus.getEventLog.useQuery({ limit: 100 });
  const { data: statsData } = trpc.eventBus.getStats.useQuery(undefined, { refetchInterval: 15000 });
  const { data: eventTypesData } = trpc.eventBus.getEventTypes.useQuery();

  // ── Mutations ──────────────────────────────────────────────────────────────
  const toggleRule = trpc.eventBus.toggleRule.useMutation({
    onSuccess: () => refetchRules(),
  });

  const deleteRule = trpc.eventBus.deleteRule.useMutation({
    onSuccess: () => {
      refetchRules();
      toast.success("Rule deleted");
    },
  });

  const createRule = trpc.eventBus.createRule.useMutation({
    onSuccess: () => {
      refetchRules();
      setShowCreateDialog(false);
      setNewRule({ name: "", description: "", sourceEngine: "", eventType: "", targetEngine: "", actionType: "" });
      toast.success("Rule created");
    },
    onError: (e) => toast.error("Error", { description: e.message }),
  });

  const emitTest = trpc.eventBus.emitTestEvent.useMutation({
    onSuccess: () => {
      refetchLog();
      toast.success("Test event emitted");
    },
  });

  // ── Helpers ────────────────────────────────────────────────────────────────
  const getEventTypesForEngine = (engineId: string) => {
    return eventTypesData?.engines.find((e) => e.id === engineId)?.events ?? [];
  };

  const handleCreateRule = () => {
    if (!newRule.name || !newRule.sourceEngine || !newRule.eventType || !newRule.targetEngine || !newRule.actionType) {
      toast.error("Missing fields", { description: "Please fill in all required fields" });
      return;
    }
    createRule.mutate({
      name: newRule.name,
      description: newRule.description,
      sourceEngine: newRule.sourceEngine,
      eventType: newRule.eventType,
      conditions: [],
      actions: [{ targetEngine: newRule.targetEngine, actionType: newRule.actionType, params: {} }],
    });
  };

  const rules = rulesData?.rules ?? [];
  const events = logData?.events ?? [];

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="border-b border-border px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/10 rounded-lg border border-purple-500/20">
              <Zap className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h1 className="text-lg font-semibold">Cross-Engine Event Bus</h1>
              <p className="text-sm text-muted-foreground">Automate actions across engines with trigger rules</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => { refetchRules(); refetchLog(); }}>
              <RefreshCw className="w-4 h-4 mr-1" />
              Refresh
            </Button>
            <Button size="sm" onClick={() => setShowCreateDialog(true)}>
              <Plus className="w-4 h-4 mr-1" />
              New Rule
            </Button>
          </div>
        </div>

        {/* Stats Row */}
        {statsData && (
          <div className="flex items-center gap-6 mt-4 text-sm">
            <span className="text-muted-foreground">
              <span className="text-foreground font-medium">{statsData.enabledRules}</span> / {statsData.totalRules} rules active
            </span>
            <span className="text-muted-foreground">
              <span className="text-foreground font-medium">{statsData.totalTriggers}</span> total triggers
            </span>
            {statsData.failedEvents > 0 && (
              <span className="text-red-400">
                <AlertTriangle className="w-3.5 h-3.5 inline mr-1" />
                {statsData.failedEvents} failed events
              </span>
            )}
          </div>
        )}

        {/* Tabs */}
        <div className="flex items-center gap-1 mt-4">
          {(["rules", "log", "stats"] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-1.5 text-sm rounded-lg capitalize transition-colors ${
                activeTab === tab
                  ? "bg-purple-500/20 text-purple-400 border border-purple-500/30"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab === "rules" && <Settings className="w-3.5 h-3.5 inline mr-1.5" />}
              {tab === "log" && <List className="w-3.5 h-3.5 inline mr-1.5" />}
              {tab === "stats" && <Activity className="w-3.5 h-3.5 inline mr-1.5" />}
              {tab}
            </button>
          ))}
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-6">

          {/* ── Rules Tab ─────────────────────────────────────────────────── */}
          {activeTab === "rules" && (
            <div className="space-y-3">
              {rules.length === 0 && (
                <div className="text-center py-16 text-muted-foreground">
                  <Zap className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p>No automation rules yet.</p>
                  <p className="text-sm mt-1">Create a rule to automate cross-engine actions.</p>
                </div>
              )}
              {rules.map((rule) => (
                <Card key={rule.id} className={`border-border transition-colors ${rule.enabled ? "border-purple-500/20" : ""}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-sm">{rule.name}</span>
                          {rule.triggerCount > 0 && (
                            <Badge variant="outline" className="text-xs text-purple-400 border-purple-500/30">
                              {rule.triggerCount} triggers
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mb-3">{rule.description}</p>
                        {/* Rule Flow */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className="text-xs font-mono">{rule.sourceEngine}</Badge>
                          <span className="text-xs text-muted-foreground">emits</span>
                          <Badge variant="outline" className="text-xs font-mono text-blue-400 border-blue-500/30">{rule.eventType}</Badge>
                          <ArrowRight className="w-3 h-3 text-muted-foreground" />
                          {rule.actions.map((action, i) => (
                            <span key={i} className="flex items-center gap-1">
                              <Badge variant="outline" className="text-xs font-mono">{action.targetEngine}</Badge>
                              <span className="text-xs text-muted-foreground">→</span>
                              <Badge variant="outline" className="text-xs font-mono text-green-400 border-green-500/30">{action.actionType}</Badge>
                            </span>
                          ))}
                        </div>
                        {rule.lastTriggered && (
                          <p className="text-xs text-muted-foreground mt-2">
                            Last triggered: {new Date(rule.lastTriggered).toLocaleString()}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">{rule.enabled ? "On" : "Off"}</span>
                          <Switch
                            checked={rule.enabled}
                            onCheckedChange={(checked) => toggleRule.mutate({ ruleId: rule.id, enabled: checked })}
                          />
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-muted-foreground hover:text-red-400"
                          onClick={() => deleteRule.mutate({ ruleId: rule.id })}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* ── Event Log Tab ──────────────────────────────────────────────── */}
          {activeTab === "log" && (
            <div className="space-y-2">
              {events.length === 0 && (
                <div className="text-center py-16 text-muted-foreground">
                  <List className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p>No events yet.</p>
                  <p className="text-sm mt-1">Events will appear here when engines emit them.</p>
                </div>
              )}
              {events.map((event) => (
                <div
                  key={event.id}
                  className={`p-3 rounded-lg border text-sm ${
                    event.status === "failed" ? "border-red-500/30 bg-red-500/5" :
                    event.triggeredRules.length > 0 ? "border-purple-500/20 bg-purple-500/5" :
                    "border-border"
                  }`}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2 min-w-0">
                      {event.status === "processed" ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-green-400 shrink-0" />
                      ) : event.status === "failed" ? (
                        <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                      ) : (
                        <Clock className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      )}
                      <span className="font-mono text-xs text-muted-foreground shrink-0">
                        {new Date(event.timestamp).toLocaleTimeString()}
                      </span>
                      <Badge variant="outline" className="text-xs font-mono shrink-0">{event.sourceEngine}</Badge>
                      <ArrowRight className="w-3 h-3 text-muted-foreground shrink-0" />
                      <span className="font-mono text-xs text-blue-400 truncate">{event.eventType}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {event.triggeredRules.length > 0 && (
                        <Badge variant="outline" className="text-xs text-purple-400 border-purple-500/30">
                          {event.triggeredRules.length} rule{event.triggeredRules.length > 1 ? "s" : ""}
                        </Badge>
                      )}
                      {event.actionsExecuted.length > 0 && (
                        <Badge variant="outline" className="text-xs text-green-400 border-green-500/30">
                          {event.actionsExecuted.length} action{event.actionsExecuted.length > 1 ? "s" : ""}
                        </Badge>
                      )}
                    </div>
                  </div>
                  {event.error && (
                    <p className="text-xs text-red-400 mt-1 ml-5">{event.error}</p>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ── Stats Tab ──────────────────────────────────────────────────── */}
          {activeTab === "stats" && statsData && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {[
                { label: "Total Rules", value: statsData.totalRules, color: "text-foreground" },
                { label: "Active Rules", value: statsData.enabledRules, color: "text-green-400" },
                { label: "Events Logged", value: statsData.totalEvents, color: "text-blue-400" },
                { label: "Failed Events", value: statsData.failedEvents, color: "text-red-400" },
                { label: "Total Triggers", value: statsData.totalTriggers, color: "text-purple-400" },
              ].map((stat) => (
                <Card key={stat.label} className="border-border">
                  <CardContent className="p-4">
                    <div className="text-xs text-muted-foreground mb-1">{stat.label}</div>
                    <div className={`text-3xl font-bold ${stat.color}`}>{stat.value}</div>
                  </CardContent>
                </Card>
              ))}

              {/* Test Event */}
              <Card className="border-border col-span-2 md:col-span-3">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Emit Test Event</CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <p className="text-xs text-muted-foreground mb-3">
                    Emit a test event to verify your rules are working correctly.
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => emitTest.mutate({ sourceEngine: "siteMonitor", eventType: "site.down", payload: { url: "https://test.example.com", severity: "critical" } })}
                      disabled={emitTest.isPending}
                    >
                      <Play className="w-3.5 h-3.5 mr-1" />
                      Test: site.down
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => emitTest.mutate({ sourceEngine: "astra", eventType: "vulnerability.critical", payload: { severity: "critical", url: "https://test.example.com" } })}
                      disabled={emitTest.isPending}
                    >
                      <Play className="w-3.5 h-3.5 mr-1" />
                      Test: vulnerability.critical
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => emitTest.mutate({ sourceEngine: "marketing", eventType: "cycle.completed", payload: { campaignsLaunched: 3 } })}
                      disabled={emitTest.isPending}
                    >
                      <Play className="w-3.5 h-3.5 mr-1" />
                      Test: cycle.completed
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

        </div>
      </ScrollArea>

      {/* ── Create Rule Dialog ─────────────────────────────────────────────── */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Automation Rule</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Rule Name *</Label>
              <Input
                placeholder="e.g. Site Down → OSINT Scan"
                value={newRule.name}
                onChange={(e) => setNewRule({ ...newRule, name: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Description</Label>
              <Input
                placeholder="What does this rule do?"
                value={newRule.description}
                onChange={(e) => setNewRule({ ...newRule, description: e.target.value })}
                className="mt-1"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Source Engine *</Label>
                <Select
                  value={newRule.sourceEngine}
                  onValueChange={(v) => setNewRule({ ...newRule, sourceEngine: v, eventType: "" })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select engine" />
                  </SelectTrigger>
                  <SelectContent>
                    {eventTypesData?.engines.map((e) => (
                      <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Event Type *</Label>
                <Select
                  value={newRule.eventType}
                  onValueChange={(v) => setNewRule({ ...newRule, eventType: v })}
                  disabled={!newRule.sourceEngine}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select event" />
                  </SelectTrigger>
                  <SelectContent>
                    {getEventTypesForEngine(newRule.sourceEngine).map((ev) => (
                      <SelectItem key={ev} value={ev}>{ev}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <ArrowRight className="w-4 h-4" />
              <span>Then trigger:</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Target Engine *</Label>
                <Select
                  value={newRule.targetEngine}
                  onValueChange={(v) => setNewRule({ ...newRule, targetEngine: v })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select engine" />
                  </SelectTrigger>
                  <SelectContent>
                    {eventTypesData?.engines.map((e) => (
                      <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Action *</Label>
                <Input
                  placeholder="e.g. quickRecon, generateContent"
                  value={newRule.actionType}
                  onChange={(e) => setNewRule({ ...newRule, actionType: e.target.value })}
                  className="mt-1"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
            <Button onClick={handleCreateRule} disabled={createRule.isPending}>
              {createRule.isPending ? "Creating..." : "Create Rule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
