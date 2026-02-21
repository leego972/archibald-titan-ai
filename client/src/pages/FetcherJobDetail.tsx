import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { Loader2, ArrowLeft, RefreshCw, CheckCircle2, XCircle, Clock, Zap } from "lucide-react";
import { useLocation, useParams } from "wouter";

const taskStatusIcons: Record<string, React.ReactNode> = {
  queued: <Clock className="h-4 w-4 text-yellow-500" />,
  logging_in: <Loader2 className="h-4 w-4 animate-spin text-blue-500" />,
  navigating: <Loader2 className="h-4 w-4 animate-spin text-blue-500" />,
  extracting: <Zap className="h-4 w-4 text-purple-500" />,
  captcha_wait: <Clock className="h-4 w-4 text-orange-500" />,
  completed: <CheckCircle2 className="h-4 w-4 text-green-500" />,
  failed: <XCircle className="h-4 w-4 text-red-500" />,
};

const statusColors: Record<string, string> = {
  queued: "bg-yellow-100 text-yellow-800",
  running: "bg-blue-100 text-blue-800",
  completed: "bg-green-100 text-green-800",
  failed: "bg-red-100 text-red-800",
  cancelled: "bg-gray-100 text-gray-800",
  logging_in: "bg-blue-100 text-blue-800",
  navigating: "bg-blue-100 text-blue-800",
  extracting: "bg-purple-100 text-purple-800",
  captcha_wait: "bg-orange-100 text-orange-800",
};

export default function FetcherJobDetail() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const jobId = parseInt(params.id || "0", 10);

  const { data, isLoading, refetch } = trpc.fetcher.getJob.useQuery(
    { jobId },
    { refetchInterval: 3000, enabled: jobId > 0 }
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">Job not found.</p>
        <Button variant="outline" className="mt-4" onClick={() => setLocation("/fetcher/jobs")}>
          Back to Jobs
        </Button>
      </div>
    );
  }

  const { job, tasks } = data;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => setLocation("/fetcher/jobs")}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">Job #{job.id}</h1>
            <Badge variant="secondary" className={statusColors[job.status] || ""}>
              {job.status}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">{job.email}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-3xl font-bold text-green-600">{job.completedProviders}</p>
            <p className="text-sm text-muted-foreground">Completed</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-3xl font-bold text-red-600">{job.failedProviders}</p>
            <p className="text-sm text-muted-foreground">Failed</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-3xl font-bold">{job.totalProviders}</p>
            <p className="text-sm text-muted-foreground">Total</p>
          </CardContent>
        </Card>
      </div>

      {/* Tasks */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Tasks</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {tasks.map((task) => (
              <div
                key={task.id}
                className="flex items-center justify-between p-3 rounded-lg border"
              >
                <div className="flex items-center gap-3">
                  {taskStatusIcons[task.status] || <Clock className="h-4 w-4" />}
                  <div>
                    <p className="text-sm font-medium">{task.providerName}</p>
                    <p className="text-xs text-muted-foreground">
                      {task.statusMessage || task.status}
                    </p>
                  </div>
                </div>
                <Badge variant="secondary" className={statusColors[task.status] || ""}>
                  {task.status}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
