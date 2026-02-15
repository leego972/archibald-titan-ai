import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { UpgradeBanner } from "@/components/UpgradePrompt";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Vault,
  Plus,
  Eye,
  EyeOff,
  Copy,
  Trash2,
  Pencil,
  Shield,
  Clock,
  Users,
  KeyRound,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  ScrollText,
  Lock,
  Tag,
} from "lucide-react";

const ACCESS_LEVELS = [
  { value: "owner", label: "Owner Only", description: "Only the team owner can access" },
  { value: "admin", label: "Admin+", description: "Team admins and owner" },
  { value: "member", label: "Member+", description: "All team members" },
  { value: "viewer", label: "Everyone", description: "All team members including viewers" },
];

const CREDENTIAL_TYPES = [
  "api_key",
  "secret_key",
  "access_token",
  "refresh_token",
  "client_id",
  "client_secret",
  "password",
  "ssh_key",
  "certificate",
  "webhook_secret",
  "other",
];

export default function TeamVaultPage() {
  const { user } = useAuth();
  const sub = useSubscription();
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [logDialogOpen, setLogDialogOpen] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);
  const [revealedItems, setRevealedItems] = useState<Record<number, string>>({});
  const [searchQuery, setSearchQuery] = useState("");

  // Form state
  const [formName, setFormName] = useState("");
  const [formType, setFormType] = useState("api_key");
  const [formValue, setFormValue] = useState("");
  const [formAccessLevel, setFormAccessLevel] = useState<"owner" | "admin" | "member" | "viewer">("member");
  const [formTags, setFormTags] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formProviderId, setFormProviderId] = useState("");

  const listQuery = trpc.vault.list.useQuery(undefined, { enabled: !!user });
  const statsQuery = trpc.vault.stats.useQuery(undefined, { enabled: !!user });

  const addMutation = trpc.vault.add.useMutation();
  const updateMutation = trpc.vault.update.useMutation();
  const deleteMutation = trpc.vault.delete.useMutation();
  const revealMutation = trpc.vault.reveal.useMutation();
  const utils = trpc.useUtils();

  const items = listQuery.data ?? [];
  const stats = statsQuery.data;

  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return items;
    const q = searchQuery.toLowerCase();
    return items.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        item.credentialType.toLowerCase().includes(q) ||
        (item.providerId && item.providerId.toLowerCase().includes(q)) ||
        (item.tags && (item.tags as string[]).some((t) => t.toLowerCase().includes(q)))
    );
  }, [items, searchQuery]);

  if (!sub.canUse("team_management")) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-3">
            <Vault className="h-7 w-7 text-primary" />
            Team Credential Vault
          </h1>
          <p className="text-muted-foreground mt-1">
            Securely share encrypted credentials with your team using role-based access.
          </p>
        </div>
        <UpgradeBanner feature="Team Credential Vault" requiredPlan="enterprise" />
      </div>
    );
  }

  const resetForm = () => {
    setFormName("");
    setFormType("api_key");
    setFormValue("");
    setFormAccessLevel("member");
    setFormTags("");
    setFormNotes("");
    setFormProviderId("");
  };

  const handleAdd = async () => {
    if (!formName.trim() || !formValue.trim()) {
      toast.error("Name and value are required.");
      return;
    }

    try {
      await addMutation.mutateAsync({
        name: formName.trim(),
        credentialType: formType,
        value: formValue,
        accessLevel: formAccessLevel,
        tags: formTags ? formTags.split(",").map((t) => t.trim()).filter(Boolean) : undefined,
        notes: formNotes || undefined,
        providerId: formProviderId || undefined,
      });
      toast.success("Credential added to vault.");
      setAddDialogOpen(false);
      resetForm();
      utils.vault.list.invalidate();
      utils.vault.stats.invalidate();
    } catch (err: any) {
      toast.error(err.message || "Failed to add credential.");
    }
  };

  const handleReveal = async (id: number) => {
    if (revealedItems[id]) {
      // Toggle hide
      setRevealedItems((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      return;
    }

    try {
      const result = await revealMutation.mutateAsync({ id });
      setRevealedItems((prev) => ({ ...prev, [id]: result.value }));
      // Auto-hide after 30 seconds
      setTimeout(() => {
        setRevealedItems((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
      }, 30000);
    } catch (err: any) {
      toast.error(err.message || "Failed to reveal credential.");
    }
  };

  const handleCopy = async (id: number) => {
    const revealed = revealedItems[id];
    if (revealed) {
      await navigator.clipboard.writeText(revealed);
      toast.success("Copied to clipboard.");
    } else {
      try {
        const result = await revealMutation.mutateAsync({ id });
        await navigator.clipboard.writeText(result.value);
        toast.success("Copied to clipboard.");
      } catch (err: any) {
        toast.error(err.message || "Failed to copy.");
      }
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteMutation.mutateAsync({ id });
      toast.success("Credential removed from vault.");
      utils.vault.list.invalidate();
      utils.vault.stats.invalidate();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete.");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-yellow-500 to-yellow-600 flex items-center justify-center shadow-lg shadow-yellow-500/20">
              <Vault className="h-5 w-5 text-white" />
            </div>
            <span className="bg-gradient-to-r from-white to-white/70 bg-clip-text text-transparent">Team Credential Vault</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1 ml-12">
            AES-256 encrypted credentials with role-based team access and full audit trail.
          </p>
        </div>
        <Button onClick={() => setAddDialogOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Add Credential
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "Vault Items", value: stats?.totalItems ?? 0, icon: KeyRound, gradient: "from-yellow-500/20 to-yellow-600/5", iconColor: "text-yellow-400", iconBg: "bg-yellow-500/10" },
          { label: "Total Accesses", value: stats?.totalAccesses ?? 0, icon: Eye, gradient: "from-blue-500/20 to-blue-600/5", iconColor: "text-blue-400", iconBg: "bg-blue-500/10" },
          { label: "Expiring Soon", value: stats?.expiringSoon ?? 0, icon: Clock, gradient: "from-amber-500/20 to-amber-600/5", iconColor: "text-amber-400", iconBg: "bg-amber-500/10", valueColor: "text-amber-400" },
        ].map((stat) => (
          <Card key={stat.label} className="relative overflow-hidden">
            <div className={`absolute inset-0 bg-gradient-to-br ${stat.gradient} opacity-50`} />
            <CardContent className="pt-6 relative">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{stat.label}</p>
                  <p className={`text-3xl font-bold mt-1 ${stat.valueColor || ""}`}>{stat.value}</p>
                </div>
                <div className={`h-10 w-10 rounded-xl ${stat.iconBg} flex items-center justify-center`}>
                  <stat.icon className={`h-5 w-5 ${stat.iconColor}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Search */}
      <div className="flex gap-3">
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search vault items by name, type, provider, or tag..."
          className="max-w-md"
        />
      </div>

      {/* Vault Items */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Encrypted Credentials ({filteredItems.length})
          </CardTitle>
          <CardDescription>
            All values are AES-256 encrypted. Reveal actions are logged.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredItems.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Vault className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>{items.length === 0 ? "No credentials in the vault yet." : "No matching credentials found."}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredItems.map((item) => {
                const isRevealed = !!revealedItems[item.id];
                const accessConfig = ACCESS_LEVELS.find((a) => a.value === item.accessLevel);

                return (
                  <div
                    key={item.id}
                    className="rounded-lg border bg-card p-4 hover:bg-accent/5 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium">{item.name}</span>
                          <Badge variant="outline" className="text-xs">
                            {item.credentialType.replace(/_/g, " ")}
                          </Badge>
                          <Badge
                            variant="outline"
                            className="text-xs text-muted-foreground"
                          >
                            <Lock className="h-3 w-3 mr-1" />
                            {accessConfig?.label || item.accessLevel}
                          </Badge>
                          {item.isOwner && (
                            <Badge variant="outline" className="text-xs text-primary border-primary/20">
                              Owner
                            </Badge>
                          )}
                        </div>

                        {/* Tags */}
                        {item.tags && (item.tags as string[]).length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {(item.tags as string[]).map((tag, i) => (
                              <span
                                key={i}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted text-xs text-muted-foreground"
                              >
                                <Tag className="h-3 w-3" />
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Value display */}
                        <div className="mt-3 flex items-center gap-2">
                          <div className="flex-1 font-mono text-sm bg-muted/50 rounded-md px-3 py-2 overflow-x-auto">
                            {isRevealed ? (
                              <span className="text-foreground">{revealedItems[item.id]}</span>
                            ) : (
                              <span className="text-muted-foreground">{item.maskedValue}</span>
                            )}
                          </div>
                        </div>

                        {/* Meta info */}
                        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                          {item.providerId && <span>Provider: {item.providerId}</span>}
                          <span>Accessed {item.accessCount}x</span>
                          {item.lastAccessedAt && (
                            <span>Last: {new Date(item.lastAccessedAt).toLocaleDateString()}</span>
                          )}
                          {item.expiresAt && (
                            <span className={new Date(item.expiresAt) < new Date() ? "text-red-400" : "text-amber-400"}>
                              <Clock className="h-3 w-3 inline mr-1" />
                              {new Date(item.expiresAt) < new Date() ? "Expired" : `Expires ${new Date(item.expiresAt).toLocaleDateString()}`}
                            </span>
                          )}
                        </div>

                        {item.notes && (
                          <p className="text-xs text-muted-foreground mt-1 italic">{item.notes}</p>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => handleReveal(item.id)}
                          title={isRevealed ? "Hide" : "Reveal"}
                        >
                          {isRevealed ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => handleCopy(item.id)}
                          title="Copy to clipboard"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        {item.isOwner && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={() => {
                                setSelectedItemId(item.id);
                                setLogDialogOpen(true);
                              }}
                              title="View access log"
                            >
                              <ScrollText className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                              onClick={() => handleDelete(item.id)}
                              title="Delete"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Credential Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Add Credential to Vault
            </DialogTitle>
            <DialogDescription>
              The value will be encrypted with AES-256 before storage.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Name *</Label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g., Production OpenAI Key"
                className="mt-1"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Credential Type *</Label>
                <Select value={formType} onValueChange={setFormType}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CREDENTIAL_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t.replace(/_/g, " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Access Level</Label>
                <Select value={formAccessLevel} onValueChange={(v) => setFormAccessLevel(v as any)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ACCESS_LEVELS.map((a) => (
                      <SelectItem key={a.value} value={a.value}>
                        {a.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Value *</Label>
              <Textarea
                value={formValue}
                onChange={(e) => setFormValue(e.target.value)}
                placeholder="Paste your credential value here..."
                className="mt-1 font-mono text-sm"
                rows={3}
              />
            </div>
            <div>
              <Label>Provider ID (optional)</Label>
              <Input
                value={formProviderId}
                onChange={(e) => setFormProviderId(e.target.value)}
                placeholder="e.g., openai, aws, stripe"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Tags (comma-separated, optional)</Label>
              <Input
                value={formTags}
                onChange={(e) => setFormTags(e.target.value)}
                placeholder="e.g., production, backend, shared"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Notes (optional)</Label>
              <Textarea
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                placeholder="Any additional notes..."
                className="mt-1"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setAddDialogOpen(false); resetForm(); }}>
              Cancel
            </Button>
            <Button onClick={handleAdd} disabled={addMutation.isPending}>
              {addMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <Shield className="h-4 w-4 mr-2" />
              Encrypt & Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Access Log Dialog */}
      {selectedItemId && (
        <AccessLogDialog
          open={logDialogOpen}
          onOpenChange={setLogDialogOpen}
          itemId={selectedItemId}
        />
      )}
    </div>
  );
}

// ─── Access Log Dialog ───────────────────────────────────────────
function AccessLogDialog({
  open,
  onOpenChange,
  itemId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemId: number;
}) {
  const logQuery = trpc.vault.accessLog.useQuery({ itemId }, { enabled: open });
  const logs = logQuery.data ?? [];

  const ACTION_ICONS: Record<string, typeof Eye> = {
    view: Eye,
    copy: Copy,
    reveal: EyeOff,
    update: Pencil,
    delete: Trash2,
    share: Users,
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScrollText className="h-5 w-5" />
            Access Log
          </DialogTitle>
          <DialogDescription>
            All access events for this vault item.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-80 overflow-y-auto space-y-2">
          {logQuery.isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : logs.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">No access events recorded.</p>
          ) : (
            logs.map((log) => {
              const ActionIcon = ACTION_ICONS[log.action] || Eye;
              return (
                <div key={log.id} className="flex items-center gap-3 p-2 rounded-md bg-muted/30">
                  <ActionIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium">{log.userName || `User #${log.userId}`}</span>
                    <span className="text-xs text-muted-foreground ml-2 capitalize">{log.action}</span>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {new Date(log.createdAt).toLocaleString()}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
