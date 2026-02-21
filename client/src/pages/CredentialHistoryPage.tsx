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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  History,
  RotateCcw,
  FileText,
  GitBranch,
  Plus,
  ArrowDownUp,
  Clock,
  CheckCircle2,
  RefreshCw,
  Edit3,
} from "lucide-react";
import { toast } from "sonner";

export default function CredentialHistoryPage() {
  const { user } = useAuth();
  const [selectedCredentialId, setSelectedCredentialId] = useState<number | null>(null);
  const [noteDialogOpen, setNoteDialogOpen] = useState(false);
  const [noteCredentialId, setNoteCredentialId] = useState<number | null>(null);
  const [noteText, setNoteText] = useState("");
  const [rollbackDialogOpen, setRollbackDialogOpen] = useState(false);
  const [rollbackEntryId, setRollbackEntryId] = useState<number | null>(null);

  const allHistoryQuery = trpc.credentialHistory.listAll.useQuery(
    { limit: 50 },
    { enabled: !!user }
  );
  const diffSummaryQuery = trpc.credentialHistory.diffSummary.useQuery(undefined, { enabled: !!user });
  const credentialsQuery = trpc.fetcher.listCredentials.useQuery(undefined, { enabled: !!user });

  const singleHistoryQuery = trpc.credentialHistory.getHistory.useQuery(
    { credentialId: selectedCredentialId! },
    { enabled: !!selectedCredentialId }
  );

  const addNote = trpc.credentialHistory.addNote.useMutation({
    onSuccess: () => {
      toast.success("Snapshot note added");
      setNoteDialogOpen(false);
      setNoteText("");
      allHistoryQuery.refetch();
      if (selectedCredentialId) singleHistoryQuery.refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const rollback = trpc.credentialHistory.rollback.useMutation({
    onSuccess: () => {
      toast.success("Credential rolled back to previous value");
      setRollbackDialogOpen(false);
      allHistoryQuery.refetch();
      if (selectedCredentialId) singleHistoryQuery.refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const allHistory = allHistoryQuery.data ?? [];
  const diffSummary = diffSummaryQuery.data;
  const credentials = (credentialsQuery.data ?? []) as Array<{
    id: number;
    providerName: string;
    keyType: string;
    keyLabel: string | null;
  }>;

  const credentialMap = useMemo(() => {
    const map: Record<number, { providerName: string; keyType: string; keyLabel: string | null }> = {};
    for (const c of credentials) {
      map[c.id] = { providerName: c.providerName, keyType: c.keyType, keyLabel: c.keyLabel };
    }
    return map;
  }, [credentials]);

  // Group history by credential
  const groupedHistory = useMemo(() => {
    const groups: Record<number, typeof allHistory> = {};
    for (const entry of allHistory) {
      if (!groups[entry.credentialId]) groups[entry.credentialId] = [];
      groups[entry.credentialId].push(entry);
    }
    return groups;
  }, [allHistory]);

  const uniqueCredentialIds = Object.keys(groupedHistory).map(Number);

  const getChangeTypeInfo = (changeType: string) => {
    switch (changeType) {
      case "created":
        return { label: "Created", icon: Plus, color: "text-emerald-400", bg: "bg-emerald-500/10" };
      case "rotated":
        return { label: "Rotated", icon: RefreshCw, color: "text-blue-400", bg: "bg-blue-500/10" };
      case "manual_update":
        return { label: "Manual Update", icon: Edit3, color: "text-amber-400", bg: "bg-amber-500/10" };
      case "rollback":
        return { label: "Rollback", icon: RotateCcw, color: "text-purple-400", bg: "bg-purple-500/10" };
      default:
        return { label: changeType, icon: History, color: "text-muted-foreground", bg: "bg-muted/50" };
    }
  };

  const displayHistory = selectedCredentialId
    ? (singleHistoryQuery.data ?? [])
    : allHistory;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-1">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold tracking-tight">Credential History</h1>
          <span className="inline-flex items-center rounded-full bg-blue-500/10 px-2.5 py-0.5 text-xs font-medium text-blue-400 ring-1 ring-inset ring-blue-500/20">
            v2.0
          </span>
        </div>
        <p className="text-muted-foreground">
          Track credential changes over time. Compare versions, add notes, and roll back if needed.
        </p>
      </div>

      {/* Diff Summary */}
      {diffSummary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <ArrowDownUp className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{diffSummary.totalChanges}</p>
                  <p className="text-xs text-muted-foreground">Total Changes (30d)</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <Plus className="h-5 w-5 text-emerald-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{diffSummary.created}</p>
                  <p className="text-xs text-muted-foreground">New Credentials</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <RefreshCw className="h-5 w-5 text-blue-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{diffSummary.rotated}</p>
                  <p className="text-xs text-muted-foreground">Rotated</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                  <RotateCcw className="h-5 w-5 text-purple-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{diffSummary.rolledBack}</p>
                  <p className="text-xs text-muted-foreground">Rolled Back</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filter by Credential */}
      {uniqueCredentialIds.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground mr-1">Filter:</span>
          <Button
            variant={selectedCredentialId === null ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedCredentialId(null)}
          >
            All
          </Button>
          {uniqueCredentialIds.map((credId) => {
            const cred = credentialMap[credId];
            return (
              <Button
                key={credId}
                variant={selectedCredentialId === credId ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCredentialId(credId)}
              >
                {cred ? `${cred.providerName} — ${cred.keyLabel || cred.keyType}` : `#${credId}`}
              </Button>
            );
          })}
        </div>
      )}

      {/* History Timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitBranch className="h-5 w-5 text-primary" />
            Change Timeline
          </CardTitle>
          <CardDescription>
            {selectedCredentialId
              ? "Showing history for selected credential"
              : "All credential changes across your vault"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {displayHistory.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <History className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No credential history recorded yet.</p>
              <p className="text-xs mt-1">
                History entries are created when credentials are fetched, rotated, or modified.
              </p>
            </div>
          ) : (
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-[19px] top-0 bottom-0 w-px bg-border" />

              <div className="space-y-4">
                {displayHistory.map((entry, index) => {
                  const info = getChangeTypeInfo(entry.changeType);
                  const InfoIcon = info.icon;
                  const cred = credentialMap[entry.credentialId];
                  return (
                    <div key={entry.id} className="relative flex gap-4">
                      {/* Timeline dot */}
                      <div
                        className={`relative z-10 h-10 w-10 rounded-full ${info.bg} flex items-center justify-center shrink-0 border border-background`}
                      >
                        <InfoIcon className={`h-4 w-4 ${info.color}`} />
                      </div>

                      {/* Content */}
                      <div className="flex-1 pb-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-sm">
                              {cred
                                ? `${cred.providerName} — ${cred.keyLabel || cred.keyType}`
                                : `Credential #${entry.credentialId}`}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              <span
                                className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${info.bg} ${info.color}`}
                              >
                                {info.label}
                              </span>
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {new Date(entry.createdAt).toLocaleString()}
                              </span>
                            </div>
                            {entry.snapshotNote && (
                              <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1">
                                <FileText className="h-3 w-3" />
                                {entry.snapshotNote}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setNoteCredentialId(entry.credentialId);
                                setNoteDialogOpen(true);
                              }}
                              className="text-muted-foreground hover:text-foreground h-8"
                            >
                              <FileText className="h-3.5 w-3.5 mr-1" />
                              Note
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setRollbackEntryId(entry.id);
                                setRollbackDialogOpen(true);
                              }}
                              className="text-muted-foreground hover:text-foreground h-8"
                            >
                              <RotateCcw className="h-3.5 w-3.5 mr-1" />
                              Rollback
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Note Dialog */}
      <Dialog open={noteDialogOpen} onOpenChange={setNoteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Snapshot Note</DialogTitle>
            <DialogDescription>
              Add a note to this credential's history. This also creates a snapshot of the current value.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Note</Label>
              <Input
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="e.g., Rotated key after security audit"
                maxLength={512}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNoteDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!noteCredentialId || !noteText.trim()) {
                  toast.error("Please enter a note");
                  return;
                }
                addNote.mutate({
                  credentialId: noteCredentialId,
                  note: noteText.trim(),
                });
              }}
              disabled={addNote.isPending}
            >
              {addNote.isPending ? "Saving..." : "Save Note"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rollback Confirmation Dialog */}
      <Dialog open={rollbackDialogOpen} onOpenChange={setRollbackDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rollback Credential</DialogTitle>
            <DialogDescription>
              This will restore the credential to the value it had at this point in history.
              The current value will be saved as a snapshot before the rollback.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRollbackDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (rollbackEntryId) {
                  rollback.mutate({ historyEntryId: rollbackEntryId });
                }
              }}
              disabled={rollback.isPending}
            >
              {rollback.isPending ? "Rolling back..." : "Confirm Rollback"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
