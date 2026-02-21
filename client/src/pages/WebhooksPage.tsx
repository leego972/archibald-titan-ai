import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { trpc } from "@/lib/trpc";
import { useSubscription } from "@/hooks/useSubscription";
import { UpgradeDialog } from "@/components/UpgradePrompt";
import {
  Webhook,
  Plus,
  Copy,
  Trash2,
  RefreshCw,
  Check,
  X,
  Play,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  Zap,
  Globe,
  Shield,
  Clock,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Loader2,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function WebhooksPage() {
  const sub = useSubscription();
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newSecret, setNewSecret] = useState<string | null>(null);
  const [showSecretFor, setShowSecretFor] = useState<number | null>(null);
  const [expandedHook, setExpandedHook] = useState<number | null>(null);
  const [hookName, setHookName] = useState("");
  const [hookUrl, setHookUrl] = useState("");
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);

  const hooksQuery = trpc.webhooks.list.useQuery(undefined, {
    enabled: sub.canUse("webhooks"),
    retry: false,
  });
  const eventTypesQuery = trpc.webhooks.eventTypes.useQuery(undefined, {
    enabled: sub.canUse("webhooks"),
    retry: false,
  });

  const createMutation = trpc.webhooks.create.useMutation({
    onSuccess: (data) => {
      setNewSecret(data.secret);
      setShowCreate(false);
      setHookName("");
      setHookUrl("");
      setSelectedEvents([]);
      hooksQuery.refetch();
      toast.success("Webhook created");
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.webhooks.delete.useMutation({
    onSuccess: () => {
      hooksQuery.refetch();
      toast.success("Webhook deleted");
    },
    onError: (err) => toast.error(err.message),
  });

  const testMutation = trpc.webhooks.test.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        toast.success(`Test delivered (${data.statusCode} in ${data.responseMs}ms)`);
      } else {
        toast.error(`Test failed: ${data.error || `HTTP ${data.statusCode}`}`);
      }
      hooksQuery.refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const rotateMutation = trpc.webhooks.rotateSecret.useMutation({
    onSuccess: (data) => {
      setNewSecret(data.secret);
      toast.success("Secret rotated");
    },
    onError: (err) => toast.error(err.message),
  });

  const toggleMutation = trpc.webhooks.update.useMutation({
    onSuccess: () => {
      hooksQuery.refetch();
      toast.success("Webhook updated");
    },
    onError: (err) => toast.error(err.message),
  });

  if (!sub.canUse("webhooks")) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            Webhooks
          </h1>
          <p className="text-muted-foreground mt-1">
            Receive real-time notifications when events happen in Titan.
          </p>
        </div>
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center mb-4">
              <Webhook className="h-8 w-8 text-purple-400" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Enterprise Feature</h3>
            <p className="text-sm text-muted-foreground max-w-md mb-6">
              Webhooks deliver real-time event notifications to your server when
              credentials are fetched, scans complete, vault items change, and more.
            </p>
            <Button
              onClick={() => setShowUpgrade(true)}
              className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white"
            >
              Upgrade to Enterprise
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </CardContent>
        </Card>
        <UpgradeDialog
          open={showUpgrade}
          onOpenChange={setShowUpgrade}
          feature="Webhooks"
          requiredPlan="enterprise"
        />
      </div>
    );
  }

  const hooks = hooksQuery.data || [];
  const eventTypes = eventTypesQuery.data || [];
  const groupedEvents = eventTypes.reduce(
    (acc, e) => {
      if (!acc[e.category]) acc[e.category] = [];
      acc[e.category].push(e);
      return acc;
    },
    {} as Record<string, typeof eventTypes>
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            Webhooks
          </h1>
          <p className="text-muted-foreground mt-1">
            Receive real-time event notifications via HTTP POST.
          </p>
        </div>
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Webhook
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Webhook</DialogTitle>
              <DialogDescription>
                Configure a new webhook endpoint to receive event notifications.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Name</Label>
                <Input
                  placeholder="e.g. Production Notifications"
                  value={hookName}
                  onChange={(e) => setHookName(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Endpoint URL</Label>
                <Input
                  placeholder="https://your-server.com/webhooks/titan"
                  value={hookUrl}
                  onChange={(e) => setHookUrl(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Events</Label>
                <div className="mt-2 space-y-4 max-h-48 overflow-y-auto pr-2">
                  {Object.entries(groupedEvents).map(([category, events]) => (
                    <div key={category}>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                        {category}
                      </p>
                      <div className="space-y-1.5">
                        {events.map((event) => (
                          <label
                            key={event.id}
                            className="flex items-center gap-2.5 p-2 rounded-md hover:bg-accent/50 cursor-pointer transition-colors"
                          >
                            <Checkbox
                              checked={selectedEvents.includes(event.id)}
                              onCheckedChange={(checked) => {
                                setSelectedEvents((prev) =>
                                  checked
                                    ? [...prev, event.id]
                                    : prev.filter((e) => e !== event.id)
                                );
                              }}
                            />
                            <span className="text-sm">{event.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreate(false)}>
                Cancel
              </Button>
              <Button
                onClick={() =>
                  createMutation.mutate({
                    name: hookName,
                    url: hookUrl,
                    events: selectedEvents,
                  })
                }
                disabled={
                  !hookName ||
                  !hookUrl ||
                  selectedEvents.length === 0 ||
                  createMutation.isPending
                }
              >
                {createMutation.isPending && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                Create Webhook
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* New Secret Banner */}
      {newSecret && (
        <Card className="border-emerald-500/50 bg-emerald-500/5">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Check className="h-5 w-5 text-emerald-500" />
              <CardTitle className="text-base">Webhook Secret</CardTitle>
            </div>
            <CardDescription>
              Copy this secret now — it won't be shown again. Use it to verify
              webhook signatures.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-background border rounded-lg px-3 py-2 text-sm font-mono break-all">
                {newSecret}
              </code>
              <Button
                variant="outline"
                size="icon"
                onClick={() => {
                  navigator.clipboard.writeText(newSecret);
                  toast.success("Copied to clipboard");
                }}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="mt-3 text-muted-foreground"
              onClick={() => setNewSecret(null)}
            >
              Dismiss
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Webhook List */}
      {hooks.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Webhook className="h-10 w-10 text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">
              No webhooks configured. Create one to start receiving events.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {hooks.map((hook) => (
            <Card
              key={hook.id}
              className={`transition-all ${
                hook.active ? "" : "opacity-60 border-dashed"
              }`}
            >
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{hook.name}</span>
                      <Badge
                        variant={hook.active ? "default" : "secondary"}
                        className="text-[10px]"
                      >
                        {hook.active ? "Active" : "Paused"}
                      </Badge>
                      {hook.lastStatusCode && (
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${
                            hook.lastStatusCode >= 200 &&
                            hook.lastStatusCode < 300
                              ? "text-emerald-400 border-emerald-500/30"
                              : "text-red-400 border-red-500/30"
                          }`}
                        >
                          Last: {hook.lastStatusCode}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground font-mono truncate">
                      {hook.url}
                    </p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Zap className="h-3 w-3" />
                        {(hook.events as string[]).length} events
                      </span>
                      <span className="flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                        {hook.successCount} delivered
                      </span>
                      {(hook.failCount ?? 0) > 0 && (
                        <span className="flex items-center gap-1">
                          <XCircle className="h-3 w-3 text-red-400" />
                          {hook.failCount} failed
                        </span>
                      )}
                      {hook.lastDeliveredAt && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Last:{" "}
                          {new Date(hook.lastDeliveredAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 ml-4">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() =>
                        testMutation.mutate({ id: hook.id })
                      }
                      disabled={testMutation.isPending}
                      title="Send test event"
                    >
                      {testMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Play className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() =>
                        toggleMutation.mutate({
                          id: hook.id,
                          active: !hook.active,
                        })
                      }
                      title={hook.active ? "Pause" : "Resume"}
                    >
                      {hook.active ? (
                        <X className="h-4 w-4" />
                      ) : (
                        <Check className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() =>
                        rotateMutation.mutate({ id: hook.id })
                      }
                      title="Rotate secret"
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => {
                        if (
                          confirm(
                            "Delete this webhook? This cannot be undone."
                          )
                        ) {
                          deleteMutation.mutate({ id: hook.id });
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Events list */}
                <div className="flex gap-1.5 flex-wrap mt-3">
                  {(hook.events as string[]).map((event) => (
                    <Badge
                      key={event}
                      variant="secondary"
                      className="text-[10px]"
                    >
                      {event}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Signature Verification */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-amber-400" />
            <CardTitle className="text-base">Signature Verification</CardTitle>
          </div>
          <CardDescription>
            Verify webhook signatures to ensure events are from Archibald Titan.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="bg-zinc-950 border border-zinc-800 rounded-lg p-4 text-sm font-mono overflow-x-auto text-zinc-300">
            <code>{`const crypto = require('crypto');

function verifyWebhook(payload, signature, secret) {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );
}

// In your webhook handler:
app.post('/webhooks/titan', (req, res) => {
  const sig = req.headers['x-titan-signature'];
  if (!verifyWebhook(req.body, sig, WEBHOOK_SECRET)) {
    return res.status(401).send('Invalid signature');
  }
  // Process event...
  res.status(200).send('OK');
});`}</code>
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}
