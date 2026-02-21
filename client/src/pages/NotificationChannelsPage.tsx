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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { useSubscription } from "@/hooks/useSubscription";
import {
  Bell,
  Plus,
  Trash2,
  Check,
  X,
  Play,
  Loader2,
  MessageSquare,
  Mail,
  Hash,
  ToggleLeft,
  ToggleRight,
  AlertTriangle,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";

// ─── Channel Type Icons & Colors ──────────────────────────────────
const CHANNEL_CONFIG: Record<
  string,
  { icon: typeof Bell; color: string; label: string; bgColor: string }
> = {
  slack: {
    icon: Hash,
    color: "text-green-400",
    label: "Slack",
    bgColor: "bg-green-500/10",
  },
  discord: {
    icon: MessageSquare,
    color: "text-indigo-400",
    label: "Discord",
    bgColor: "bg-indigo-500/10",
  },
  email: {
    icon: Mail,
    color: "text-blue-400",
    label: "Email",
    bgColor: "bg-blue-500/10",
  },
};

export default function NotificationChannelsPage() {
  const sub = useSubscription();
  const utils = trpc.useUtils();

  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<"slack" | "discord" | "email">(
    "slack"
  );
  const [newUrl, setNewUrl] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);

  // ─── Queries ──────────────────────────────────────────────────
  const channelsQuery = trpc.notificationChannels.list.useQuery(undefined, {
    enabled: sub.canUse("webhooks"),
  });
  const eventTypesQuery = trpc.notificationChannels.eventTypes.useQuery(
    undefined,
    {
      enabled: sub.canUse("webhooks"),
    }
  );

  // ─── Mutations ────────────────────────────────────────────────
  const createMutation = trpc.notificationChannels.create.useMutation({
    onSuccess: () => {
      utils.notificationChannels.list.invalidate();
      toast.success("Notification channel created");
      resetForm();
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.notificationChannels.delete.useMutation({
    onSuccess: () => {
      utils.notificationChannels.list.invalidate();
      toast.success("Channel deleted");
    },
    onError: (err) => toast.error(err.message),
  });

  const testMutation = trpc.notificationChannels.test.useMutation({
    onSuccess: () => toast.success("Test notification sent!"),
    onError: (err) => toast.error(err.message),
  });

  const toggleMutation = trpc.notificationChannels.update.useMutation({
    onSuccess: () => {
      utils.notificationChannels.list.invalidate();
      toast.success("Channel updated");
    },
    onError: (err) => toast.error(err.message),
  });

  // ─── Grouped Events ──────────────────────────────────────────
  const groupedEvents = useMemo(() => {
    if (!eventTypesQuery.data) return {};
    const groups: Record<
      string,
      Array<{ value: string; label: string; category: string }>
    > = {};
    for (const evt of eventTypesQuery.data) {
      if (!groups[evt.category]) groups[evt.category] = [];
      groups[evt.category].push(evt);
    }
    return groups;
  }, [eventTypesQuery.data]);

  // ─── Helpers ──────────────────────────────────────────────────
  function resetForm() {
    setShowCreate(false);
    setNewName("");
    setNewType("slack");
    setNewUrl("");
    setNewEmail("");
    setSelectedEvents([]);
  }

  function toggleEvent(value: string) {
    setSelectedEvents((prev) =>
      prev.includes(value) ? prev.filter((e) => e !== value) : [...prev, value]
    );
  }

  function selectAllEvents() {
    if (!eventTypesQuery.data) return;
    setSelectedEvents(eventTypesQuery.data.map((e) => e.value));
  }

  function deselectAllEvents() {
    setSelectedEvents([]);
  }

  function handleCreate() {
    if (!newName.trim()) {
      toast.error("Please enter a channel name");
      return;
    }
    if (selectedEvents.length === 0) {
      toast.error("Please select at least one event");
      return;
    }

    createMutation.mutate({
      name: newName.trim(),
      type: newType,
      webhookUrl:
        newType === "slack" || newType === "discord" ? newUrl : undefined,
      emailAddress: newType === "email" ? newEmail : undefined,
      events: selectedEvents,
    });
  }

  const [showUpgrade, setShowUpgrade] = useState(false);

  // ─── Upgrade Gate ─────────────────────────────────────────────
  if (!sub.canUse("webhooks")) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bell className="h-6 w-6 text-purple-400" />
            Notification Channels
          </h1>
          <p className="text-muted-foreground mt-1">
            Get real-time alerts in Slack, Discord, or email when important
            events happen.
          </p>
        </div>
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center mb-4">
              <Bell className="h-8 w-8 text-purple-400" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Pro Feature</h3>
            <p className="text-sm text-muted-foreground max-w-md mb-6">
              Upgrade to Pro to receive real-time notifications in Slack, Discord,
              or via email when credentials are created, rotated, breached, or expire.
            </p>
            <Button
              onClick={() => setShowUpgrade(true)}
              className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white"
            >
              Upgrade to Pro
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const channels = channelsQuery.data ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bell className="h-6 w-6 text-purple-400" />
            Notification Channels
          </h1>
          <p className="text-muted-foreground mt-1">
            Get real-time alerts in Slack, Discord, or email when important
            events happen.
          </p>
        </div>

        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Channel
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add Notification Channel</DialogTitle>
              <DialogDescription>
                Configure where to receive notifications for credential events.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              {/* Channel Name */}
              <div className="space-y-2">
                <Label htmlFor="channel-name">Channel Name</Label>
                <Input
                  id="channel-name"
                  placeholder="e.g., DevOps Alerts"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
              </div>

              {/* Channel Type */}
              <div className="space-y-2">
                <Label>Channel Type</Label>
                <Select
                  value={newType}
                  onValueChange={(v) =>
                    setNewType(v as "slack" | "discord" | "email")
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="slack">
                      <span className="flex items-center gap-2">
                        <Hash className="h-4 w-4 text-green-400" />
                        Slack Webhook
                      </span>
                    </SelectItem>
                    <SelectItem value="discord">
                      <span className="flex items-center gap-2">
                        <MessageSquare className="h-4 w-4 text-indigo-400" />
                        Discord Webhook
                      </span>
                    </SelectItem>
                    <SelectItem value="email">
                      <span className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-blue-400" />
                        Email
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Webhook URL (Slack/Discord) */}
              {(newType === "slack" || newType === "discord") && (
                <div className="space-y-2">
                  <Label htmlFor="webhook-url">
                    {newType === "slack" ? "Slack" : "Discord"} Webhook URL
                  </Label>
                  <Input
                    id="webhook-url"
                    placeholder={
                      newType === "slack"
                        ? "https://hooks.slack.com/services/..."
                        : "https://discord.com/api/webhooks/..."
                    }
                    value={newUrl}
                    onChange={(e) => setNewUrl(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    {newType === "slack" ? (
                      <>
                        Create an Incoming Webhook in your Slack workspace
                        settings. Go to{" "}
                        <span className="text-purple-400">
                          Slack App &gt; Incoming Webhooks
                        </span>{" "}
                        to generate one.
                      </>
                    ) : (
                      <>
                        Create a Webhook in your Discord server settings. Go to{" "}
                        <span className="text-purple-400">
                          Server Settings &gt; Integrations &gt; Webhooks
                        </span>{" "}
                        to generate one.
                      </>
                    )}
                  </p>
                </div>
              )}

              {/* Email Address */}
              {newType === "email" && (
                <div className="space-y-2">
                  <Label htmlFor="email-address">Email Address</Label>
                  <Input
                    id="email-address"
                    type="email"
                    placeholder="alerts@yourcompany.com"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                  />
                </div>
              )}

              {/* Event Selection */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Events to Subscribe</Label>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={selectAllEvents}
                      className="text-xs h-7"
                    >
                      Select All
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={deselectAllEvents}
                      className="text-xs h-7"
                    >
                      Clear
                    </Button>
                  </div>
                </div>

                <div className="border rounded-lg p-3 space-y-3 max-h-48 overflow-y-auto bg-background/50">
                  {Object.entries(groupedEvents).map(
                    ([category, events]) => (
                      <div key={category}>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                          {category}
                        </p>
                        <div className="space-y-1">
                          {events.map((evt) => (
                            <label
                              key={evt.value}
                              className="flex items-center gap-2 cursor-pointer hover:bg-accent/50 rounded px-2 py-1 transition-colors"
                            >
                              <Checkbox
                                checked={selectedEvents.includes(evt.value)}
                                onCheckedChange={() =>
                                  toggleEvent(evt.value)
                                }
                              />
                              <span className="text-sm">{evt.label}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {selectedEvents.length} event
                  {selectedEvents.length !== 1 ? "s" : ""} selected
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={resetForm}>
                Cancel
              </Button>
              <Button
                onClick={handleCreate}
                disabled={createMutation.isPending}
              >
                {createMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Plus className="h-4 w-4 mr-2" />
                )}
                Create Channel
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-green-500/20 bg-green-500/5">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <Hash className="h-5 w-5 text-green-400" />
              </div>
              <div>
                <p className="font-medium text-sm">Slack</p>
                <p className="text-xs text-muted-foreground">
                  Rich formatted messages with event details
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-indigo-500/20 bg-indigo-500/5">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-indigo-500/10">
                <MessageSquare className="h-5 w-5 text-indigo-400" />
              </div>
              <div>
                <p className="font-medium text-sm">Discord</p>
                <p className="text-xs text-muted-foreground">
                  Embedded messages with color-coded severity
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-blue-500/20 bg-blue-500/5">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Mail className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <p className="font-medium text-sm">Email</p>
                <p className="text-xs text-muted-foreground">
                  Direct email alerts for critical events
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Channels List */}
      {channelsQuery.isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : channels.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Bell className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-medium mb-1">No channels configured</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Add a Slack, Discord, or email channel to start receiving
              notifications.
            </p>
            <Button onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Your First Channel
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {channels.map((channel) => {
            const config = CHANNEL_CONFIG[channel.type] || CHANNEL_CONFIG.email;
            const Icon = config.icon;
            const events = (channel.events as string[]) || [];

            return (
              <Card key={channel.id} className="group">
                <CardContent className="py-4">
                  <div className="flex items-start justify-between gap-4">
                    {/* Left: Icon + Info */}
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <div
                        className={`p-2 rounded-lg ${config.bgColor} shrink-0`}
                      >
                        <Icon className={`h-5 w-5 ${config.color}`} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-medium truncate">
                            {channel.name}
                          </h3>
                          <Badge
                            variant={channel.active ? "default" : "secondary"}
                            className="text-xs shrink-0"
                          >
                            {channel.active ? "Active" : "Paused"}
                          </Badge>
                          {channel.failCount > 0 && (
                            <Badge variant="destructive" className="text-xs shrink-0">
                              {channel.failCount} failures
                            </Badge>
                          )}
                        </div>

                        <p className="text-xs text-muted-foreground mb-2">
                          {config.label}
                          {channel.webhookUrl && ` • ${channel.webhookUrl}`}
                          {channel.emailAddress &&
                            ` • ${channel.emailAddress}`}
                        </p>

                        <div className="flex flex-wrap gap-1">
                          {events.slice(0, 4).map((evt) => (
                            <Badge
                              key={evt}
                              variant="outline"
                              className="text-xs"
                            >
                              {evt}
                            </Badge>
                          ))}
                          {events.length > 4 && (
                            <Badge variant="outline" className="text-xs">
                              +{events.length - 4} more
                            </Badge>
                          )}
                        </div>

                        {channel.lastNotifiedAt && (
                          <p className="text-xs text-muted-foreground mt-1.5">
                            Last notified:{" "}
                            {new Date(
                              channel.lastNotifiedAt
                            ).toLocaleString()}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        title={
                          channel.active
                            ? "Pause channel"
                            : "Activate channel"
                        }
                        onClick={() =>
                          toggleMutation.mutate({
                            id: channel.id,
                            active: !channel.active,
                          })
                        }
                        disabled={toggleMutation.isPending}
                      >
                        {channel.active ? (
                          <ToggleRight className="h-4 w-4 text-green-400" />
                        ) : (
                          <ToggleLeft className="h-4 w-4 text-muted-foreground" />
                        )}
                      </Button>

                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        title="Send test notification"
                        onClick={() => testMutation.mutate({ id: channel.id })}
                        disabled={testMutation.isPending || !channel.active}
                      >
                        {testMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Play className="h-4 w-4 text-purple-400" />
                        )}
                      </Button>

                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        title="Delete channel"
                        onClick={() => {
                          if (
                            confirm(
                              `Delete notification channel "${channel.name}"?`
                            )
                          ) {
                            deleteMutation.mutate({ id: channel.id });
                          }
                        }}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* How It Works */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">How It Works</CardTitle>
          <CardDescription>
            Notification channels deliver real-time alerts when events occur in
            your Archibald Titan workspace.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="h-6 w-6 rounded-full bg-purple-500/20 flex items-center justify-center text-xs font-bold text-purple-400">
                  1
                </div>
                <h4 className="font-medium text-sm">Configure</h4>
              </div>
              <p className="text-xs text-muted-foreground pl-8">
                Add a Slack webhook, Discord webhook, or email address and
                select which events to subscribe to.
              </p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="h-6 w-6 rounded-full bg-purple-500/20 flex items-center justify-center text-xs font-bold text-purple-400">
                  2
                </div>
                <h4 className="font-medium text-sm">Monitor</h4>
              </div>
              <p className="text-xs text-muted-foreground pl-8">
                When subscribed events occur (credential created, breach
                detected, etc.), notifications are dispatched automatically.
              </p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="h-6 w-6 rounded-full bg-purple-500/20 flex items-center justify-center text-xs font-bold text-purple-400">
                  3
                </div>
                <h4 className="font-medium text-sm">Act</h4>
              </div>
              <p className="text-xs text-muted-foreground pl-8">
                Receive formatted alerts with event details so your team can
                respond immediately. Channels auto-disable after 5 consecutive
                failures.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
