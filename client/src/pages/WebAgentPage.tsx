/**
 * Web Agent Page
 *
 * Titan's autonomous browser agent — give it a natural-language instruction
 * and it will navigate to any website, log in with your saved credentials,
 * and complete the task for you.
 *
 * Examples:
 * - "Find emails from John this week in Gmail"
 * - "Check if my Amazon order has shipped"
 * - "Add milk, bread, and eggs to my Tesco basket"
 */

import { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Globe,
  Play,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Trash2,
  Plus,
  Key,
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  RefreshCw,
  Bot,
  Shield,
} from "lucide-react";

// ─── Status Badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; icon: any; className: string }> = {
    pending: { label: "Pending", icon: Clock, className: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30" },
    running: { label: "Running", icon: Loader2, className: "bg-blue-500/15 text-blue-400 border-blue-500/30 animate-pulse" },
    awaiting_confirmation: { label: "Needs Confirmation", icon: AlertTriangle, className: "bg-orange-500/15 text-orange-400 border-orange-500/30" },
    completed: { label: "Completed", icon: CheckCircle2, className: "bg-green-500/15 text-green-400 border-green-500/30" },
    failed: { label: "Failed", icon: XCircle, className: "bg-red-500/15 text-red-400 border-red-500/30" },
    cancelled: { label: "Cancelled", icon: XCircle, className: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30" },
  };
  const c = config[status] || config.pending;
  const Icon = c.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${c.className}`}>
      <Icon className={`h-3 w-3 ${status === "running" ? "animate-spin" : ""}`} />
      {c.label}
    </span>
  );
}

// ─── Task Card ────────────────────────────────────────────────────────────────
function TaskCard({
  task,
  onConfirm,
  onCancel,
  onDelete,
  onRefresh,
}: {
  task: any;
  onConfirm: (id: number) => void;
  onCancel: (id: number) => void;
  onDelete: (id: number) => void;
  onRefresh: (id: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const result = task.result as any;

  return (
    <Card className="bg-zinc-900/50 border-white/10">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <StatusBadge status={task.status} />
              {task.targetSite && (
                <span className="text-xs text-zinc-500">{task.targetSite}</span>
              )}
              <span className="text-xs text-zinc-600 ml-auto">
                {new Date(task.createdAt).toLocaleString()}
              </span>
            </div>
            <p className="text-sm text-zinc-200 font-medium truncate">{task.instruction}</p>
            {result?.summary && (
              <p className="text-xs text-zinc-400 mt-1 line-clamp-2">{result.summary}</p>
            )}
            {task.errorMessage && (
              <p className="text-xs text-red-400 mt-1">{task.errorMessage}</p>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {(task.status === "pending" || task.status === "running") && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0 text-zinc-500 hover:text-zinc-300"
                onClick={() => onRefresh(task.id)}
                title="Refresh status"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
            )}
            {task.status === "awaiting_confirmation" && (
              <>
                <Button
                  size="sm"
                  className="h-7 text-xs bg-green-600 hover:bg-green-500"
                  onClick={() => onConfirm(task.id)}
                >
                  Confirm
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs text-red-400 hover:text-red-300"
                  onClick={() => onCancel(task.id)}
                >
                  Cancel
                </Button>
              </>
            )}
            {(task.status === "completed" || task.status === "failed" || task.status === "cancelled") && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0 text-zinc-600 hover:text-red-400"
                onClick={() => onDelete(task.id)}
                title="Delete"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>

        {/* Steps expand */}
        {result?.steps && result.steps.length > 0 && (
          <div className="mt-3">
            <button
              className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              {result.steps.length} steps
            </button>
            {expanded && (
              <div className="mt-2 space-y-1 pl-3 border-l border-white/10">
                {result.steps.map((step: any, i: number) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="text-[10px] text-zinc-600 mt-0.5 shrink-0 font-mono">
                      {new Date(step.timestamp).toLocaleTimeString()}
                    </span>
                    <span className="text-xs text-zinc-400">
                      <span className="text-zinc-500 capitalize">[{step.action}]</span> {step.detail}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Confirmation message */}
        {task.status === "awaiting_confirmation" && task.confirmationRequired && (
          <div className="mt-3 p-3 rounded-lg bg-orange-500/10 border border-orange-500/20">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-orange-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-medium text-orange-300">Confirmation Required</p>
                <p className="text-xs text-orange-400 mt-0.5">{task.confirmationRequired}</p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Add Credential Dialog ────────────────────────────────────────────────────
function AddCredentialDialog({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [siteName, setSiteName] = useState("");
  const [siteUrl, setSiteUrl] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [notes, setNotes] = useState("");

  const saveCredential = trpc.webAgent.saveCredential.useMutation({
    onSuccess: () => {
      toast.success("Credential saved");
      onSaved();
      onClose();
      setSiteName(""); setSiteUrl(""); setUsername(""); setPassword(""); setNotes("");
    },
    onError: (err) => toast.error(err.message),
  });

  const handleSave = () => {
    if (!siteName || !siteUrl || !username || !password) {
      toast.error("Please fill in all required fields");
      return;
    }
    let url = siteUrl;
    if (!url.startsWith("http")) url = "https://" + url;
    saveCredential.mutate({ siteName, siteUrl: url, username, password, notes: notes || undefined });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-zinc-900 border-white/10 max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Key className="h-4 w-4 text-blue-400" />
            Add Site Credential
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Site Name *</Label>
              <Input
                placeholder="e.g. Gmail"
                value={siteName}
                onChange={(e) => setSiteName(e.target.value)}
                className="bg-zinc-800 border-white/10 h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Site URL *</Label>
              <Input
                placeholder="e.g. mail.google.com"
                value={siteUrl}
                onChange={(e) => setSiteUrl(e.target.value)}
                className="bg-zinc-800 border-white/10 h-9"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Username / Email *</Label>
            <Input
              placeholder="your@email.com"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="bg-zinc-800 border-white/10 h-9"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Password *</Label>
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-zinc-800 border-white/10 h-9 pr-9"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
              >
                {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Notes (optional)</Label>
            <Input
              placeholder="Any notes about this account"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="bg-zinc-800 border-white/10 h-9"
            />
          </div>
          <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
            <Shield className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
            <p className="text-xs text-blue-300">
              Credentials are encrypted at rest using AES-256. Passwords are never stored in plain text and are only decrypted in memory when the agent needs them.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} className="h-9">Cancel</Button>
          <Button
            onClick={handleSave}
            disabled={saveCredential.isPending}
            className="h-9 bg-blue-600 hover:bg-blue-500"
          >
            {saveCredential.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Save Credential
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function WebAgentPage() {
  const [instruction, setInstruction] = useState("");
  const [activeTaskId, setActiveTaskId] = useState<number | null>(null);
  const [showAddCredential, setShowAddCredential] = useState(false);
  const [activeTab, setActiveTab] = useState<"tasks" | "credentials">("tasks");
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const tasksQuery = trpc.webAgent.listTasks.useQuery({ limit: 50 });
  const credentialsQuery = trpc.webAgent.listCredentials.useQuery();

  const submitTask = trpc.webAgent.submitTask.useMutation({
    onSuccess: (data) => {
      setActiveTaskId(data.taskId);
      setInstruction("");
      tasksQuery.refetch();
      toast.success("Task started — Titan is working on it");
    },
    onError: (err) => toast.error(err.message),
  });

  const confirmTask = trpc.webAgent.confirmTask.useMutation({
    onSuccess: () => { tasksQuery.refetch(); toast.success("Task confirmed — continuing..."); },
    onError: (err) => toast.error(err.message),
  });

  const cancelTask = trpc.webAgent.cancelTask.useMutation({
    onSuccess: () => { tasksQuery.refetch(); toast.info("Task cancelled"); },
    onError: (err) => toast.error(err.message),
  });

  const deleteTask = trpc.webAgent.deleteTask.useMutation({
    onSuccess: () => tasksQuery.refetch(),
    onError: (err) => toast.error(err.message),
  });

  const deleteCredential = trpc.webAgent.deleteCredential.useMutation({
    onSuccess: () => { credentialsQuery.refetch(); toast.success("Credential deleted"); },
    onError: (err) => toast.error(err.message),
  });

  // Poll for active task updates
  useEffect(() => {
    const hasActiveTasks = tasksQuery.data?.some(
      (t: any) => t.status === "pending" || t.status === "running"
    );
    if (hasActiveTasks) {
      if (!pollIntervalRef.current) {
        pollIntervalRef.current = setInterval(() => tasksQuery.refetch(), 3000);
      }
    } else {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    }
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [tasksQuery.data]);

  const handleSubmit = () => {
    if (!instruction.trim()) return;
    submitTask.mutate({ instruction: instruction.trim() });
  };

  const tasks = tasksQuery.data || [];
  const credentials = credentialsQuery.data || [];

  const exampleInstructions = [
    "Find emails from my boss this week in Gmail",
    "Check if my latest Amazon order has shipped",
    "Add milk, bread, and eggs to my Tesco basket",
    "Find the cheapest flight from London to New York next month",
    "Check my LinkedIn notifications",
    "Find the latest news about AI on BBC",
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bot className="h-6 w-6 text-blue-400" />
            Web Agent
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Tell Titan what to do on any website — it will log in with your saved credentials and complete the task autonomously.
          </p>
        </div>
      </div>

      {/* Task Input */}
      <Card className="bg-zinc-900/50 border-white/10">
        <CardContent className="p-4 space-y-3">
          <Textarea
            placeholder='What should Titan do? e.g. "Find emails from John this week in Gmail" or "Check if my Amazon order has shipped"'
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            className="bg-zinc-800/50 border-white/10 resize-none min-h-[80px] text-sm"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSubmit();
            }}
          />
          <div className="flex items-center justify-between">
            <div className="flex flex-wrap gap-1.5">
              {exampleInstructions.slice(0, 3).map((ex) => (
                <button
                  key={ex}
                  onClick={() => setInstruction(ex)}
                  className="text-[11px] px-2 py-1 rounded-md bg-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700 transition-colors border border-white/5"
                >
                  {ex}
                </button>
              ))}
            </div>
            <Button
              onClick={handleSubmit}
              disabled={!instruction.trim() || submitTask.isPending}
              className="h-9 bg-blue-600 hover:bg-blue-500 shrink-0 ml-2"
            >
              {submitTask.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Play className="h-4 w-4 mr-2" />
              )}
              Run Task
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-white/10">
        {(["tasks", "credentials"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
              activeTab === tab
                ? "border-blue-500 text-blue-400"
                : "border-transparent text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {tab === "tasks" ? `Tasks (${tasks.length})` : `Site Credentials (${credentials.length})`}
          </button>
        ))}
      </div>

      {/* Tasks Tab */}
      {activeTab === "tasks" && (
        <div className="space-y-3">
          {tasks.length === 0 ? (
            <div className="text-center py-12 text-zinc-500">
              <Bot className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No tasks yet. Give Titan an instruction above.</p>
            </div>
          ) : (
            tasks.map((task: any) => (
              <TaskCard
                key={task.id}
                task={task}
                onConfirm={(id) => confirmTask.mutate({ taskId: id })}
                onCancel={(id) => cancelTask.mutate({ taskId: id })}
                onDelete={(id) => deleteTask.mutate({ taskId: id })}
                onRefresh={() => tasksQuery.refetch()}
              />
            ))
          )}
        </div>
      )}

      {/* Credentials Tab */}
      {activeTab === "credentials" && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <Button
              size="sm"
              onClick={() => setShowAddCredential(true)}
              className="h-8 bg-blue-600 hover:bg-blue-500"
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Add Site
            </Button>
          </div>

          {credentials.length === 0 ? (
            <div className="text-center py-12 text-zinc-500">
              <Key className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No site credentials saved yet.</p>
              <p className="text-xs mt-1">Add credentials so Titan can log into websites on your behalf.</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {credentials.map((cred: any) => (
                <Card key={cred.id} className="bg-zinc-900/50 border-white/10">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                          <Globe className="h-4 w-4 text-blue-400" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">{cred.siteName}</p>
                          <p className="text-xs text-zinc-500">{cred.username} · {cred.siteUrl}</p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0 text-zinc-600 hover:text-red-400"
                        onClick={() => deleteCredential.mutate({ credentialId: cred.id })}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    {cred.notes && (
                      <p className="text-xs text-zinc-500 mt-2 pl-12">{cred.notes}</p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      <AddCredentialDialog
        open={showAddCredential}
        onClose={() => setShowAddCredential(false)}
        onSaved={() => credentialsQuery.refetch()}
      />
    </div>
  );
}
