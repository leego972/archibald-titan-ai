import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  CalendarClock,
  Plus,
  Trash2,
  Play,
  Pause,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  RotateCw,
  Zap,
} from "lucide-react";
import { PROVIDERS } from "@shared/fetcher";

const DAYS_OF_WEEK = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const FREQUENCY_LABELS: Record<string, string> = {
  daily: "Every Day",
  weekly: "Every Week",
  biweekly: "Every 2 Weeks",
  monthly: "Every Month",
};

export default function AutoSyncPage() {
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [frequency, setFrequency] = useState<string>("daily");
  const [dayOfWeek, setDayOfWeek] = useState<number>(1);
  const [timeOfDay, setTimeOfDay] = useState("09:00");
  const [selectedProviders, setSelectedProviders] = useState<string[]>([]);

  const schedulesQuery = trpc.scheduler.list.useQuery();
  const createMutation = trpc.scheduler.create.useMutation();
  const toggleMutation = trpc.scheduler.toggle.useMutation();
  const deleteMutation = trpc.scheduler.delete.useMutation();
  const triggerMutation = trpc.scheduler.triggerNow.useMutation();
  const utils = trpc.useUtils();

  const providerList = Object.entries(PROVIDERS).map(([id, p]) => ({
    id,
    name: p.name,
    category: p.category,
  }));

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error("Please enter a schedule name.");
      return;
    }
    if (selectedProviders.length === 0) {
      toast.error("Select at least one provider.");
      return;
    }

    setCreating(true);
    try {
      await createMutation.mutateAsync({
        name: name.trim(),
        frequency: frequency as "daily" | "weekly" | "biweekly" | "monthly",
        dayOfWeek: (frequency === "weekly" || frequency === "biweekly") ? dayOfWeek : undefined,
        timeOfDay,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        providerIds: selectedProviders,
      });
      toast.success(`"${name}" will run ${FREQUENCY_LABELS[frequency]?.toLowerCase()}.`);
      setShowCreate(false);
      setName("");
      setSelectedProviders([]);
      utils.scheduler.list.invalidate();
    } catch (err: any) {
      toast.error(err.message || "Failed to create schedule.");
    } finally {
      setCreating(false);
    }
  };

  const handleToggle = async (id: number) => {
    try {
      const result = await toggleMutation.mutateAsync({ id });
      toast.success(result.enabled ? "Schedule enabled" : "Schedule paused");
      utils.scheduler.list.invalidate();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDelete = async (id: number, scheduleName: string) => {
    try {
      await deleteMutation.mutateAsync({ id });
      toast.success(`"${scheduleName}" has been removed.`);
      utils.scheduler.list.invalidate();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleTriggerNow = async (id: number) => {
    try {
      const result = await triggerMutation.mutateAsync({ id });
      toast.success(`Syncing ${result.providers.length} providers now.`);
      utils.scheduler.list.invalidate();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const toggleProvider = (pid: string) => {
    setSelectedProviders((prev) =>
      prev.includes(pid) ? prev.filter((p) => p !== pid) : [...prev, pid]
    );
  };

  const schedules = schedulesQuery.data ?? [];

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-3">
            <CalendarClock className="h-7 w-7 text-primary" />
            Auto-Sync Schedules
          </h1>
          <p className="text-muted-foreground mt-1">
            Configure automatic credential re-fetches on a daily, weekly, or monthly basis.
          </p>
        </div>
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Schedule
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Sync Schedule</DialogTitle>
              <DialogDescription>
                Set up automatic credential re-fetches for selected providers.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Schedule Name</Label>
                <Input
                  placeholder="e.g., Daily API Key Refresh"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Frequency</Label>
                  <Select value={frequency} onValueChange={setFrequency}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="biweekly">Every 2 Weeks</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Time</Label>
                  <Input
                    type="time"
                    value={timeOfDay}
                    onChange={(e) => setTimeOfDay(e.target.value)}
                  />
                </div>
              </div>

              {(frequency === "weekly" || frequency === "biweekly") && (
                <div className="space-y-2">
                  <Label>Day of Week</Label>
                  <Select value={dayOfWeek.toString()} onValueChange={(v) => setDayOfWeek(parseInt(v))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DAYS_OF_WEEK.map((day, i) => (
                        <SelectItem key={i} value={i.toString()}>{day}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label>Providers ({selectedProviders.length} selected)</Label>
                <div className="border rounded-lg p-3 max-h-48 overflow-y-auto space-y-1">
                  {providerList.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => toggleProvider(p.id)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-sm transition-colors ${
                        selectedProviders.includes(p.id)
                          ? "bg-primary/10 text-primary border border-primary/20"
                          : "hover:bg-accent"
                      }`}
                    >
                      <span>{p.name}</span>
                      <Badge variant="outline" className="text-xs">
                        {p.category}
                      </Badge>
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedProviders(providerList.map((p) => p.id))}
                  >
                    Select All
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedProviders([])}
                  >
                    Clear
                  </Button>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreate(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreate} disabled={creating}>
                {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Create Schedule
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <CalendarClock className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{schedules.length}</p>
                <p className="text-sm text-muted-foreground">Total Schedules</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {schedules.filter((s) => s.enabled === 1).length}
                </p>
                <p className="text-sm text-muted-foreground">Active</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <Clock className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {schedules.filter((s) => s.enabled === 1 && s.nextRunAt).length}
                </p>
                <p className="text-sm text-muted-foreground">Upcoming Runs</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Schedule List */}
      {schedulesQuery.isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : schedules.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <CalendarClock className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-semibold mb-1">No schedules yet</h3>
            <p className="text-muted-foreground text-sm mb-4">
              Create your first auto-sync schedule to keep credentials fresh automatically.
            </p>
            <Button onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Schedule
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {schedules.map((schedule) => (
            <Card key={schedule.id} className={schedule.enabled === 0 ? "opacity-60" : ""}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CardTitle className="text-base">{schedule.name}</CardTitle>
                    <Badge variant={schedule.enabled === 1 ? "default" : "secondary"}>
                      {schedule.enabled === 1 ? "Active" : "Paused"}
                    </Badge>
                    <Badge variant="outline">
                      {FREQUENCY_LABELS[schedule.frequency] || schedule.frequency}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={schedule.enabled === 1}
                      onCheckedChange={() => handleToggle(schedule.id)}
                    />
                  </div>
                </div>
                <CardDescription className="flex items-center gap-4 mt-1">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    {schedule.timeOfDay} {schedule.timezone}
                  </span>
                  {(schedule.frequency === "weekly" || schedule.frequency === "biweekly") && schedule.dayOfWeek !== null && (
                    <span>on {DAYS_OF_WEEK[schedule.dayOfWeek]}</span>
                  )}
                  <span>
                    {(schedule.providerIds as string[]).length} provider{(schedule.providerIds as string[]).length !== 1 ? "s" : ""}
                  </span>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-6 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <RotateCw className="h-3.5 w-3.5" />
                      {schedule.totalRuns} runs
                    </span>
                    <span className="flex items-center gap-1.5 text-green-500">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {schedule.successfulRuns} success
                    </span>
                    <span className="flex items-center gap-1.5 text-red-500">
                      <XCircle className="h-3.5 w-3.5" />
                      {schedule.failedRuns} failed
                    </span>
                    {schedule.nextRunAt && schedule.enabled === 1 && (
                      <span className="flex items-center gap-1.5 text-primary">
                        <Clock className="h-3.5 w-3.5" />
                        Next: {new Date(schedule.nextRunAt).toLocaleString()}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleTriggerNow(schedule.id)}
                      disabled={triggerMutation.isPending}
                    >
                      <Zap className="h-3.5 w-3.5 mr-1" />
                      Run Now
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => handleDelete(schedule.id, schedule.name)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Provider chips */}
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {(schedule.providerIds as string[]).map((pid) => (
                    <Badge key={pid} variant="outline" className="text-xs">
                      {PROVIDERS[pid]?.name || pid}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
