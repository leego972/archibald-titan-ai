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
import {
  RefreshCw,
  Play,
  XCircle,
  CheckCircle2,
  Clock,
  Loader2,
  Zap,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";

export default function BulkSyncPage() {
  const { user } = useAuth();

  const syncJobsQuery = trpc.bulkSync.list.useQuery(undefined, { enabled: !!user });
  const credentialsQuery = trpc.fetcher.listCredentials.useQuery(undefined, { enabled: !!user });

  const createSync = trpc.bulkSync.create.useMutation({
    onSuccess: (data) => {
      toast.success(`Bulk sync queued for ${data.totalProviders} providers`);
      syncJobsQuery.refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const cancelSync = trpc.bulkSync.cancel.useMutation({
    onSuccess: () => {
      toast.success("Sync job cancelled");
      syncJobsQuery.refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const syncJobs = syncJobsQuery.data ?? [];
  const credentials = credentialsQuery.data ?? [];

  // Get unique providers from existing credentials
  const uniqueProviders = Array.from(
    new Set((credentials as Array<{ providerId: string; providerName: string }>).map((c) => c.providerId))
  );

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="h-5 w-5 text-emerald-400" />;
      case "running":
        return <Loader2 className="h-5 w-5 text-blue-400 animate-spin" />;
      case "failed":
        return <XCircle className="h-5 w-5 text-red-400" />;
      case "cancelled":
        return <XCircle className="h-5 w-5 text-muted-foreground" />;
      default:
        return <Clock className="h-5 w-5 text-amber-400" />;
    }
  };

  const getStatusBg = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-emerald-500/10 border-emerald-500/20";
      case "running":
        return "bg-blue-500/10 border-blue-500/20";
      case "failed":
        return "bg-red-500/10 border-red-500/20";
      case "cancelled":
        return "bg-muted/50 border-muted-foreground/20";
      default:
        return "bg-amber-500/10 border-amber-500/20";
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">Bulk Provider Sync</h1>
            <span className="inline-flex items-center rounded-full bg-blue-500/10 px-2.5 py-0.5 text-xs font-medium text-blue-400 ring-1 ring-inset ring-blue-500/20">
              v2.0
            </span>
          </div>
          <p className="text-muted-foreground">
            Re-fetch credentials across all your configured providers in one click.
          </p>
        </div>
        <Button
          onClick={() => createSync.mutate({})}
          disabled={createSync.isPending || uniqueProviders.length === 0}
          className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white"
        >
          {createSync.isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Zap className="h-4 w-4 mr-2" />
          )}
          Sync All Providers
        </Button>
      </div>

      {/* Provider Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-primary" />
            Providers to Sync
          </CardTitle>
          <CardDescription>
            {uniqueProviders.length > 0
              ? `${uniqueProviders.length} provider${uniqueProviders.length !== 1 ? "s" : ""} with existing credentials will be re-fetched.`
              : "No providers with stored credentials found. Run a fetch first to populate your vault."}
          </CardDescription>
        </CardHeader>
        {uniqueProviders.length > 0 && (
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {uniqueProviders.map((providerId) => {
                const providerCred = (credentials as Array<{ providerId: string; providerName: string }>).find(
                  (c) => c.providerId === providerId
                );
                return (
                  <div
                    key={providerId}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border border-primary/20 bg-primary/5 text-primary"
                  >
                    <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                    {providerCred ? (providerCred as any).providerName : providerId}
                  </div>
                );
              })}
            </div>
          </CardContent>
        )}
      </Card>

      {/* Sync Jobs History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            Sync History
          </CardTitle>
          <CardDescription>
            Recent bulk sync operations and their status.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {syncJobs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <RefreshCw className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No bulk sync jobs yet.</p>
              <p className="text-xs mt-1">
                Click "Sync All Providers" to re-fetch credentials across all your providers.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {syncJobs.map((job) => {
                const progress =
                  job.totalProviders > 0
                    ? Math.round(
                        ((job.completedProviders + job.failedProviders) /
                          job.totalProviders) *
                          100
                      )
                    : 0;
                return (
                  <div
                    key={job.id}
                    className={`flex items-center justify-between p-4 rounded-lg border ${getStatusBg(job.status)}`}
                  >
                    <div className="flex items-center gap-3">
                      {getStatusIcon(job.status)}
                      <div>
                        <p className="font-medium text-sm">
                          Bulk Sync #{job.id}
                        </p>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-xs text-muted-foreground capitalize">
                            {job.status}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {job.completedProviders}/{job.totalProviders} providers
                          </span>
                          {job.failedProviders > 0 && (
                            <span className="text-xs text-red-400 flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3" />
                              {job.failedProviders} failed
                            </span>
                          )}
                          <span className="text-xs text-muted-foreground">
                            {new Date(job.createdAt).toLocaleString()}
                          </span>
                        </div>
                        {(job.status === "running" || job.status === "queued") && (
                          <div className="mt-2 w-48 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary rounded-full transition-all"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                    {(job.status === "running" || job.status === "queued") && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => cancelSync.mutate({ id: job.id })}
                        className="text-destructive hover:text-destructive"
                      >
                        <XCircle className="h-4 w-4 mr-1" />
                        Cancel
                      </Button>
                    )}
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
