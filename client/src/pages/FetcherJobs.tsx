import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { trpc } from "@/lib/trpc";
import { Loader2, RefreshCw, Eye, XCircle } from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

const statusColors: Record<string, string> = {
  queued: "bg-yellow-100 text-yellow-800",
  running: "bg-blue-100 text-blue-800",
  completed: "bg-green-100 text-green-800",
  failed: "bg-red-100 text-red-800",
  cancelled: "bg-gray-100 text-gray-800",
};

export default function FetcherJobs() {
  const [, setLocation] = useLocation();
  const { data: jobs, isLoading, refetch } = trpc.fetcher.listJobs.useQuery(undefined, {
    refetchInterval: 5000,
  });

  const cancelJob = trpc.fetcher.cancelJob.useMutation({
    onSuccess: () => {
      toast.success("Job cancelled");
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Fetch Jobs</h1>
          <p className="text-muted-foreground mt-1">
            Monitor and manage your credential retrieval jobs.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {!jobs || jobs.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground mb-4">No fetch jobs yet.</p>
            <Button onClick={() => setLocation("/fetcher/new")}>
              Create Your First Job
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {jobs.map((job) => {
            const progress = job.totalProviders > 0
              ? Math.round(((job.completedProviders + job.failedProviders) / job.totalProviders) * 100)
              : 0;

            return (
              <Card key={job.id} className="overflow-hidden">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CardTitle className="text-base">Job #{job.id}</CardTitle>
                      <Badge variant="secondary" className={statusColors[job.status] || ""}>
                        {job.status}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setLocation(`/fetcher/jobs/${job.id}`)}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        Details
                      </Button>
                      {(job.status === "queued" || job.status === "running") && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => cancelJob.mutate({ jobId: job.id })}
                          disabled={cancelJob.isPending}
                        >
                          <XCircle className="h-4 w-4 mr-1" />
                          Cancel
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>{job.email}</span>
                    <span>
                      {job.completedProviders}/{job.totalProviders} providers
                      {job.failedProviders > 0 && ` (${job.failedProviders} failed)`}
                    </span>
                  </div>
                  <Progress value={progress} className="h-2" />
                  <div className="text-xs text-muted-foreground">
                    Created: {new Date(job.createdAt).toLocaleString()}
                    {job.completedAt && ` · Completed: ${new Date(job.completedAt).toLocaleString()}`}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
