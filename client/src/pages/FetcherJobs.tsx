import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { trpc } from "@/lib/trpc";
import {
  Loader2, RefreshCw, Eye, XCircle, Plus, Search,
  CheckCircle2, AlertCircle, Clock, Zap, Filter,
  Download, ChevronDown, ChevronUp, Activity,
  BarChart3, Mail, Calendar, Timer,
} from "lucide-react";
import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

const STATUS_CFG: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  queued:    { label: "Queued",    color: "text-yellow-400",  bg: "bg-yellow-500/10 border-yellow-500/20",   icon: <Clock className="h-3.5 w-3.5" /> },
  running:   { label: "Running",   color: "text-blue-400",    bg: "bg-blue-500/10 border-blue-500/20",       icon: <Activity className="h-3.5 w-3.5 animate-pulse" /> },
  completed: { label: "Completed", color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20", icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
  failed:    { label: "Failed",    color: "text-red-400",     bg: "bg-red-500/10 border-red-500/20",         icon: <AlertCircle className="h-3.5 w-3.5" /> },
  cancelled: { label: "Cancelled", color: "text-zinc-400",    bg: "bg-zinc-500/10 border-zinc-500/20",       icon: <XCircle className="h-3.5 w-3.5" /> },
};

function StatusBadge({ status }: { status: string }) {
  const c = STATUS_CFG[status] || STATUS_CFG.queued;
  return <Badge variant="outline" className={`text-xs gap-1 ${c.color} ${c.bg}`}>{c.icon}{c.label}</Badge>;
}

function dur(start: string, end?: string | null) {
  const ms = (end ? new Date(end) : new Date()).getTime() - new Date(start).getTime();
  if (ms < 60000) return Math.round(ms / 1000) + "s";
  return Math.floor(ms / 60000) + "m " + Math.round((ms % 60000) / 1000) + "s";
}

function fmtDate(d: string) {
  return new Date(d).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function JobRow({ job, onView, onCancel, cancelling }: { job: any; onView: () => void; onCancel: () => void; cancelling: boolean }) {
  const [exp, setExp] = useState(false);
  const prog = job.totalProviders > 0 ? Math.round(((job.completedProviders + job.failedProviders) / job.totalProviders) * 100) : 0;
  const c = STATUS_CFG[job.status] || STATUS_CFG.queued;
  const active = job.status === "queued" || job.status === "running";
  return (
    <Card className={`overflow-hidden transition-all ${active ? "border-blue-500/30" : "border-border/40"}`}>
      <CardHeader className="pb-0 pt-4 px-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${c.bg}`}><span className={c.color}>{c.icon}</span></div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap"><span className="text-sm font-semibold">Job #{job.id}</span><StatusBadge status={job.status} /></div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5"><Mail className="h-3 w-3 shrink-0" /><span className="truncate">{job.email}</span></div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <TooltipProvider><Tooltip><TooltipTrigger asChild>
              <div className="hidden sm:flex items-center gap-3 text-xs border border-border/40 rounded-lg px-3 py-1.5">
                <span className="text-emerald-400 font-medium">{job.completedProviders} ✓</span>
                {job.failedProviders > 0 && <span className="text-red-400 font-medium">{job.failedProviders} ✗</span>}
                <span className="text-muted-foreground">/ {job.totalProviders}</span>
              </div>
            </TooltipTrigger><TooltipContent><p>{job.completedProviders} completed · {job.failedProviders} failed · {job.totalProviders} total</p></TooltipContent></Tooltip></TooltipProvider>
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={onView}><Eye className="h-3.5 w-3.5 mr-1" />Details</Button>
            {active && (
              <Button variant="outline" size="sm" className="h-8 text-xs text-red-400 border-red-500/30 hover:bg-red-500/10" onClick={onCancel} disabled={cancelling}>
                {cancelling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5 mr-1" />}Cancel
              </Button>
            )}
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setExp(e => !e)}>{exp ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</Button>
          </div>
        </div>
        {active && (
          <div className="mt-3">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1"><span>Progress</span><span>{prog}%</span></div>
            <Progress value={prog} className="h-1.5" />
          </div>
        )}
      </CardHeader>
      {exp && (
        <div className="px-5 pb-4 pt-3 border-t border-border/30 mt-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div><p className="text-[10px] text-muted-foreground uppercase tracking-wider">Created</p><div className="flex items-center gap-1 text-xs mt-0.5"><Calendar className="h-3 w-3 text-muted-foreground" />{fmtDate(job.createdAt)}</div></div>
            <div><p className="text-[10px] text-muted-foreground uppercase tracking-wider">Duration</p><div className="flex items-center gap-1 text-xs mt-0.5"><Timer className="h-3 w-3 text-muted-foreground" />{dur(job.createdAt, job.completedAt)}</div></div>
            <div><p className="text-[10px] text-muted-foreground uppercase tracking-wider">Providers</p><div className="flex items-center gap-1 text-xs mt-0.5"><BarChart3 className="h-3 w-3 text-muted-foreground" />{job.selectedProviders?.length || job.totalProviders} selected</div></div>
            <div><p className="text-[10px] text-muted-foreground uppercase tracking-wider">Success Rate</p><div className="flex items-center gap-1 text-xs mt-0.5"><Zap className="h-3 w-3 text-muted-foreground" />{job.totalProviders > 0 ? Math.round((job.completedProviders / job.totalProviders) * 100) + "%" : "—"}</div></div>
          </div>
          {job.selectedProviders?.length > 0 && (
            <div className="mt-3"><p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5">Providers</p>
              <div className="flex flex-wrap gap-1">{job.selectedProviders.map((p: string) => <Badge key={p} variant="secondary" className="text-[10px] font-mono">{p}</Badge>)}</div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

function SummaryStats({ jobs }: { jobs: any[] }) {
  const s = useMemo(() => ({
    total: jobs.length,
    running: jobs.filter(j => j.status === "running").length,
    completed: jobs.filter(j => j.status === "completed").length,
    providers: jobs.reduce((a, j) => a + j.completedProviders, 0),
  }), [jobs]);
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {[
        { label: "Total Jobs",        val: s.total,     icon: <BarChart3 className="h-4 w-4" />,              color: "text-foreground" },
        { label: "Running",           val: s.running,   icon: <Activity className="h-4 w-4 animate-pulse" />, color: "text-blue-400" },
        { label: "Completed",         val: s.completed, icon: <CheckCircle2 className="h-4 w-4" />,           color: "text-emerald-400" },
        { label: "Providers Fetched", val: s.providers, icon: <Zap className="h-4 w-4" />,                    color: "text-primary" },
      ].map(x => (
        <Card key={x.label} className="p-4">
          <div className={`flex items-center gap-2 mb-1 ${x.color}`}>{x.icon}<span className="text-xs text-muted-foreground">{x.label}</span></div>
          <p className={`text-2xl font-bold ${x.color}`}>{x.val}</p>
        </Card>
      ))}
    </div>
  );
}

export default function FetcherJobs() {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [cancellingId, setCancellingId] = useState<number | null>(null);

  const { data: jobs, isLoading, refetch, isFetching } = trpc.fetcher.listJobs.useQuery(undefined, {
    refetchInterval: (data: any) => data?.some((j: any) => j.status === "running" || j.status === "queued") ? 2000 : 10000,
  });

  const cancelJob = trpc.fetcher.cancelJob.useMutation({
    onSuccess: () => { toast.success("Job cancelled"); setCancellingId(null); refetch(); },
    onError: (err) => { toast.error(err.message); setCancellingId(null); },
  });

  const filtered = useMemo(() => {
    if (!jobs) return [];
    return jobs.filter(j => {
      const ms = !search || j.email.toLowerCase().includes(search.toLowerCase()) || String(j.id).includes(search);
      const ss = statusFilter === "all" || j.status === statusFilter;
      return ms && ss;
    });
  }, [jobs, search, statusFilter]);

  const exportCSV = () => {
    if (!filtered.length) return;
    const csv = [["ID","Email","Status","Total","Completed","Failed","Created","Completed At"].join(","),
      ...filtered.map(j => [j.id,j.email,j.status,j.totalProviders,j.completedProviders,j.failedProviders,j.createdAt,j.completedAt||""].join(","))].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = "fetch-jobs-" + new Date().toISOString().split("T")[0] + ".csv";
    a.click();
    toast.success("Exported as CSV");
  };

  if (isLoading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="w-full max-w-4xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Fetch Jobs</h1>
          <p className="text-muted-foreground mt-1 text-sm">Monitor and manage your credential retrieval jobs in real time.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />Refresh
          </Button>
          {jobs && jobs.length > 0 && <Button variant="outline" size="sm" onClick={exportCSV}><Download className="h-4 w-4 mr-2" />Export CSV</Button>}
          <Button size="sm" onClick={() => setLocation("/fetcher/new")}><Plus className="h-4 w-4 mr-2" />New Job</Button>
        </div>
      </div>

      {jobs && jobs.length > 0 && <SummaryStats jobs={jobs} />}

      {jobs && jobs.length > 0 && (
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search by email or job ID..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9 text-sm" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40 h-9 text-sm"><Filter className="h-3.5 w-3.5 mr-2 text-muted-foreground" /><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="running">Running</SelectItem>
              <SelectItem value="queued">Queued</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {!jobs || jobs.length === 0 ? (
        <Card><CardContent className="flex flex-col items-center justify-center py-16">
          <div className="h-14 w-14 rounded-full bg-muted/50 flex items-center justify-center mb-4"><Zap className="h-7 w-7 text-muted-foreground" /></div>
          <h3 className="font-semibold mb-1">No fetch jobs yet</h3>
          <p className="text-sm text-muted-foreground mb-5 text-center max-w-xs">Create your first job to start retrieving credentials from cloud providers.</p>
          <Button onClick={() => setLocation("/fetcher/new")}><Plus className="h-4 w-4 mr-2" />Create Your First Job</Button>
        </CardContent></Card>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="flex flex-col items-center justify-center py-12">
          <Search className="h-8 w-8 text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">No jobs match your filters.</p>
          <Button variant="link" size="sm" onClick={() => { setSearch(""); setStatusFilter("all"); }}>Clear filters</Button>
        </CardContent></Card>
      ) : (
        <div className="space-y-3">
          {filtered.map(job => (
            <JobRow key={job.id} job={job}
              onView={() => setLocation("/fetcher/jobs/" + job.id)}
              onCancel={() => { setCancellingId(job.id); cancelJob.mutate({ jobId: job.id }); }}
              cancelling={cancellingId === job.id}
            />
          ))}
          {filtered.length < (jobs?.length || 0) && <p className="text-xs text-center text-muted-foreground pt-1">Showing {filtered.length} of {jobs?.length} jobs</p>}
        </div>
      )}
    </div>
  );
}
