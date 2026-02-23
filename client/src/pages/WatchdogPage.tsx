import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Timer,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Plus,
  Trash2,
  BellOff,
  Shield,
  Clock,
} from "lucide-react";
import { toast } from "sonner";

export default function WatchdogPage() {
  const { user } = useAuth();
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [selectedCredentialId, setSelectedCredentialId] = useState<string>("");
  const [expiryDate, setExpiryDate] = useState("");
  const [alertDays, setAlertDays] = useState("7");

  const watchesQuery = trpc.watchdog.list.useQuery(undefined, { enabled: !!user });
  const summaryQuery = trpc.watchdog.summary.useQuery(undefined, { enabled: !!user });
  const credentialsQuery = trpc.fetcher.listCredentials.useQuery(undefined, { enabled: !!user });

  const createWatch = trpc.watchdog.create.useMutation({
    onSuccess: () => {
      toast.success("Expiry watch added");
      setAddDialogOpen(false);
      setSelectedCredentialId("");
      setExpiryDate("");
      setAlertDays("7");
      watchesQuery.refetch();
      summaryQuery.refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const removeWatch = trpc.watchdog.remove.useMutation({
    onSuccess: () => {
      toast.success("Watch removed");
      watchesQuery.refetch();
      summaryQuery.refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const dismissWatch = trpc.watchdog.dismiss.useMutation({
    onSuccess: () => {
      toast.success("Alert dismissed");
      watchesQuery.refetch();
      summaryQuery.refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const summary = summaryQuery.data;
  const watches = watchesQuery.data ?? [];
  const credentials = (credentialsQuery.data ?? []) as Array<{id: number; providerName: string; keyType: string; keyLabel: string | null}>;

  // Map credential IDs to names
  const credentialMap = useMemo(() => {
    const map: Record<number, { providerName: string; keyType: string; keyLabel: string | null }> = {};
    for (const c of credentials) {
      map[c.id] = { providerName: c.providerName, keyType: c.keyType, keyLabel: c.keyLabel };
    }
    return map;
  }, [credentials]);

  const getStatusInfo = (watch: any) => {
    const now = new Date();
    const expiresAt = new Date(watch.expiresAt);
    const daysUntil = Math.ceil((expiresAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));

    if (watch.status === "dismissed") {
      return { label: "Dismissed", color: "text-muted-foreground", icon: BellOff, bg: "bg-muted/50" };
    }
    if (daysUntil <= 0) {
      return { label: "Expired", color: "text-red-400", icon: XCircle, bg: "bg-red-500/10" };
    }
    if (daysUntil <= watch.alertDaysBefore) {
      return { label: `Expires in ${daysUntil}d`, color: "text-amber-400", icon: AlertTriangle, bg: "bg-amber-500/10" };
    }
    return { label: `${daysUntil} days left`, color: "text-emerald-400", icon: CheckCircle2, bg: "bg-emerald-500/10" };
  };

  if (watchesQuery.isLoading) {
    return (
      <div className="flex items-center justify-center h-full py-20">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Loading watchdog data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">Credential Expiry Watchdog</h1>
            <span className="inline-flex items-center rounded-full bg-blue-500/10 px-2.5 py-0.5 text-xs font-medium text-blue-400 ring-1 ring-inset ring-blue-500/20">
              v2.0
            </span>
          </div>
          <p className="text-muted-foreground">
            Monitor API key expiration dates and get alerts before credentials expire.
          </p>
        </div>
        <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Watch
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Expiry Watch</DialogTitle>
              <DialogDescription>
                Set an expiration date for a credential to receive alerts before it expires.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Credential</Label>
                <Select value={selectedCredentialId} onValueChange={setSelectedCredentialId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a credential" />
                  </SelectTrigger>
                  <SelectContent>
                    {credentials.map((c) => (
                      <SelectItem key={c.id} value={c.id.toString()}>
                        {c.providerName} — {c.keyLabel || c.keyType}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Expiry Date</Label>
                <Input
                  type="date"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                  min={new Date().toISOString().split("T")[0]}
                />
              </div>
              <div className="space-y-2">
                <Label>Alert Days Before Expiry</Label>
                <Select value={alertDays} onValueChange={setAlertDays}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="3">3 days</SelectItem>
                    <SelectItem value="7">7 days</SelectItem>
                    <SelectItem value="14">14 days</SelectItem>
                    <SelectItem value="30">30 days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (!selectedCredentialId || !expiryDate) {
                    toast.error("Please select a credential and set an expiry date");
                    return;
                  }
                  createWatch.mutate({
                    credentialId: parseInt(selectedCredentialId),
                    expiresAt: new Date(expiryDate).toISOString(),
                    alertDaysBefore: parseInt(alertDays),
                  });
                }}
                disabled={createWatch.isPending}
              >
                {createWatch.isPending ? "Adding..." : "Add Watch"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Shield className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{summary.total}</p>
                  <p className="text-xs text-muted-foreground">Total Watches</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{summary.active}</p>
                  <p className="text-xs text-muted-foreground">Active & Healthy</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                  <AlertTriangle className="h-5 w-5 text-amber-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{summary.expiringSoon}</p>
                  <p className="text-xs text-muted-foreground">Expiring Soon</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-red-500/10 flex items-center justify-center">
                  <XCircle className="h-5 w-5 text-red-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{summary.expired}</p>
                  <p className="text-xs text-muted-foreground">Expired</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Watches List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Timer className="h-5 w-5 text-primary" />
            Active Watches
          </CardTitle>
          <CardDescription>
            Credentials being monitored for expiration. You'll see alerts when they approach their expiry date.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {watches.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Timer className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No credential watches configured yet.</p>
              <p className="text-xs mt-1">
                Add a watch to monitor when your API keys are about to expire.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {watches.map((watch) => {
                const status = getStatusInfo(watch);
                const cred = credentialMap[watch.credentialId];
                const StatusIcon = status.icon;
                return (
                  <div
                    key={watch.id}
                    className={`flex items-center justify-between p-4 rounded-lg border ${status.bg}`}
                  >
                    <div className="flex items-center gap-3">
                      <StatusIcon className={`h-5 w-5 ${status.color}`} />
                      <div>
                        <p className="font-medium text-sm">
                          {cred
                            ? `${cred.providerName} — ${cred.keyLabel || cred.keyType}`
                            : `Credential #${watch.credentialId}`}
                        </p>
                        <div className="flex items-center gap-3 mt-1">
                          <span className={`text-xs font-medium ${status.color}`}>
                            {status.label}
                          </span>
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Expires: {new Date(watch.expiresAt).toLocaleDateString()}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            Alert: {watch.alertDaysBefore}d before
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {watch.status !== "dismissed" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => dismissWatch.mutate({ id: watch.id })}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <BellOff className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeWatch.mutate({ id: watch.id })}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
