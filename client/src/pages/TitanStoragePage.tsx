/**
 * Titan Storage Page
 * Per-user paid cloud storage add-on for Archibald Titan AI.
 *
 * Features:
 * - Storage plan selection with Stripe Checkout
 * - File upload, listing, download, and deletion
 * - Storage quota visualisation
 * - Shareable download links
 * - API key management
 * - Usage breakdown by Titan feature
 */

import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  HardDrive, Upload, Download, Trash2, Share2, Key,
  Plus, RefreshCw, Cloud, CreditCard, CheckCircle,
  AlertTriangle, FileText, Lock, Unlock, Copy, Eye, EyeOff,
  BarChart3, ShieldCheck, Database, Webhook, FolderOpen,
} from "lucide-react";

// ─── Helpers ──────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

const FEATURE_META: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  vault:    { label: "Vault Backups",       icon: Lock,        color: "text-yellow-500" },
  builder:  { label: "Builder Projects",    icon: FolderOpen,  color: "text-blue-500"   },
  fetcher:  { label: "Fetcher History",     icon: Database,    color: "text-green-500"  },
  scanner:  { label: "Scan Reports",        icon: ShieldCheck, color: "text-red-500"    },
  webhook:  { label: "Webhook Logs",        icon: Webhook,     color: "text-purple-500" },
  export:   { label: "Exports",             icon: Download,    color: "text-orange-500" },
  generic:  { label: "General Storage",     icon: HardDrive,   color: "text-slate-400"  },
};

// ─── Plan Card ────────────────────────────────────────────────────

function PlanCard({
  plan,
  isActive,
  onSelect,
  loading,
}: {
  plan: { id: string; label: string; bytes: number; price_monthly: number; features: readonly string[] };
  isActive: boolean;
  onSelect: () => void;
  loading: boolean;
}) {
  return (
    <Card className={`relative transition-all ${isActive ? "border-primary ring-1 ring-primary" : "border-border/40 hover:border-border"}`}>
      {isActive && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <Badge className="bg-primary text-primary-foreground text-xs px-2 py-0.5">Active Plan</Badge>
        </div>
      )}
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{plan.label}</CardTitle>
          <div className="text-right">
            <div className="text-2xl font-bold">${plan.price_monthly}</div>
            <div className="text-xs text-muted-foreground">/month</div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <ul className="space-y-1.5">
          {plan.features.map((f, i) => (
            <li key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle className="h-3.5 w-3.5 text-green-500 shrink-0" />
              {f}
            </li>
          ))}
        </ul>
        <Button
          className="w-full"
          variant={isActive ? "outline" : "default"}
          onClick={onSelect}
          disabled={loading}
        >
          {loading ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : null}
          {isActive ? "Manage Plan" : "Get Started"}
        </Button>
      </CardContent>
    </Card>
  );
}

// ─── Storage Overview ─────────────────────────────────────────────

function StorageOverview({ sub }: { sub: any }) {
  const pct = sub.usage_pct ?? 0;
  const color = pct > 90 ? "bg-red-500" : pct > 70 ? "bg-yellow-500" : "bg-primary";

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Cloud className="h-4 w-4 text-primary" />
            Storage Usage
          </CardTitle>
          <Badge variant={sub.status === "active" ? "default" : "destructive"} className="text-xs capitalize">
            {sub.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1.5">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">{sub.used_formatted} used</span>
            <span className="font-medium">{sub.quota_formatted} total</span>
          </div>
          <div className="h-2 w-full rounded-full bg-secondary overflow-hidden">
            <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${Math.min(pct, 100)}%` }} />
          </div>
          <div className="text-xs text-muted-foreground text-right">{pct}% used</div>
        </div>
        <div className="grid grid-cols-2 gap-3 pt-1">
          <div className="rounded-lg bg-secondary/50 p-3 text-center">
            <div className="text-lg font-bold">{sub.plan_label}</div>
            <div className="text-xs text-muted-foreground">Current Plan</div>
          </div>
          <div className="rounded-lg bg-secondary/50 p-3 text-center">
            <div className="text-lg font-bold">{formatBytes(sub.available_bytes)}</div>
            <div className="text-xs text-muted-foreground">Available</div>
          </div>
        </div>
        {sub.current_period_end && (
          <div className="text-xs text-muted-foreground text-center">
            Renews {new Date(sub.current_period_end).toLocaleDateString()}
            {sub.cancel_at_period_end && <span className="text-destructive ml-1">(cancels at period end)</span>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── File Row ─────────────────────────────────────────────────────

function FileRow({ file, onDelete, onShare, onDownload }: {
  file: any;
  onDelete: () => void;
  onShare: () => void;
  onDownload: () => void;
}) {
  const meta = FEATURE_META[file.feature] ?? FEATURE_META.generic;
  const Icon = meta.icon;

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border border-border/40 hover:border-border transition-all group">
      <div className={`p-2 rounded-md bg-secondary ${meta.color}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{file.originalName}</div>
        <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
          <span>{formatBytes(file.sizeBytes)}</span>
          <span>·</span>
          <span>{meta.label}</span>
          <span>·</span>
          <span>{new Date(file.createdAt).toLocaleDateString()}</span>
        </div>
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onDownload} title="Download">
          <Download className="h-3.5 w-3.5" />
        </Button>
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onShare} title="Share">
          <Share2 className="h-3.5 w-3.5" />
        </Button>
        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={onDelete} title="Delete">
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────

export default function TitanStoragePage() {
  const [uploadingFile, setUploadingFile] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [newKeyName, setNewKeyName] = useState("");
  const [revealedKeys, setRevealedKeys] = useState<Record<number, boolean>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── tRPC Queries ──────────────────────────────────────────────
  const subQuery = trpc.titanStorage.getSubscription.useQuery(undefined, { retry: false });
  const plansQuery = trpc.titanStorage.getPlans.useQuery();
  const statsQuery = trpc.titanStorage.getStats.useQuery(undefined, { enabled: !!subQuery.data });
  const filesQuery = trpc.titanStorage.listFiles.useQuery({ limit: 100 }, { enabled: !!subQuery.data });
  const apiKeysQuery = trpc.titanStorage.listApiKeys.useQuery(undefined, { enabled: !!subQuery.data });

  // ── tRPC Mutations ────────────────────────────────────────────
  const createCheckout = trpc.titanStorageBilling.createCheckout.useMutation({
    onSuccess: (data) => {
      if (data.checkout_url) window.location.href = data.checkout_url;
    },
    onError: (err) => toast.error(err.message),
  });

  const createPortal = trpc.titanStorageBilling.createPortal.useMutation({
    onSuccess: (data) => { if (data.portal_url) window.location.href = data.portal_url; },
    onError: (err) => toast.error(err.message),
  });

  const deleteFileMut = trpc.titanStorage.deleteFile.useMutation({
    onSuccess: () => { filesQuery.refetch(); subQuery.refetch(); toast.success("File deleted"); },
    onError: (err) => toast.error(err.message),
  });

  const getDownloadUrl = trpc.titanStorage.getDownloadUrl.useQuery;

  const createShareLinkMut = trpc.titanStorage.createShareLink.useMutation({
    onSuccess: (data) => {
      navigator.clipboard.writeText(data.url).catch(() => {});
      toast.success("Share link copied to clipboard!", { description: data.url });
    },
    onError: (err) => toast.error(err.message),
  });

  const createApiKeyMut = trpc.titanStorage.createApiKey.useMutation({
    onSuccess: (data) => {
      navigator.clipboard.writeText(data.key).catch(() => {});
      toast.success(`API key created and copied! Starts with: ${data.key_prefix}...`);
      apiKeysQuery.refetch();
      setNewKeyName("");
    },
    onError: (err) => toast.error(err.message),
  });

  const revokeApiKeyMut = trpc.titanStorage.revokeApiKey.useMutation({
    onSuccess: () => { apiKeysQuery.refetch(); toast.success("API key revoked"); },
    onError: (err) => toast.error(err.message),
  });

  // ── Handlers ──────────────────────────────────────────────────

  async function handlePlanSelect(planId: string) {
    setCheckoutLoading(planId);
    try {
      await createCheckout.mutateAsync({ plan: planId as any });
    } finally {
      setCheckoutLoading(null);
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingFile(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("feature", "generic");
      const res = await fetch("/api/storage/upload", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "Upload failed" }));
        throw new Error(err.message || "Upload failed");
      }
      toast.success(`${file.name} uploaded successfully`);
      filesQuery.refetch();
      subQuery.refetch();
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploadingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleDownload(fileId: number, fileName: string) {
    try {
      const res = await fetch(`/api/storage/download/${fileId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Download failed");
      const { url } = await res.json();
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.click();
    } catch (err: any) {
      toast.error(err.message || "Download failed");
    }
  }

  // ── Render: No Subscription ───────────────────────────────────

  if (!subQuery.data && !subQuery.isLoading) {
    return (
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        <div className="text-center space-y-3 py-4">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 mb-2">
            <HardDrive className="h-7 w-7 text-primary" />
          </div>
          <h1 className="text-3xl font-bold">Titan Storage</h1>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Unlock cloud storage for your Titan AI data — vault backups, builder projects, scan reports,
            fetcher history, and more. All encrypted, all yours.
          </p>
        </div>

        {plansQuery.isLoading ? (
          <div className="flex justify-center py-12">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            {plansQuery.data?.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                isActive={false}
                onSelect={() => handlePlanSelect(plan.id)}
                loading={checkoutLoading === plan.id}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── Render: Active Subscription ───────────────────────────────

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10">
            <HardDrive className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Titan Storage</h1>
            <p className="text-sm text-muted-foreground">Your personal cloud storage for all Titan features</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => createPortal.mutate({})}>
          <CreditCard className="h-4 w-4 mr-2" />
          Manage Billing
        </Button>
      </div>

      {subQuery.isLoading ? (
        <div className="flex justify-center py-12">
          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <Tabs defaultValue="files" className="space-y-4">
          <div className="flex items-start gap-4">
            {/* Sidebar: Overview */}
            <div className="w-64 shrink-0 space-y-4">
              {subQuery.data && <StorageOverview sub={subQuery.data} />}

              {/* Feature breakdown */}
              {statsQuery.data?.by_feature && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <BarChart3 className="h-4 w-4" />
                      Usage by Feature
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {statsQuery.data.by_feature.map((f: any) => {
                      const meta = FEATURE_META[f.feature] ?? FEATURE_META.generic;
                      const Icon = meta.icon;
                      return (
                        <div key={f.feature} className="flex items-center justify-between text-xs">
                          <div className={`flex items-center gap-1.5 ${meta.color}`}>
                            <Icon className="h-3 w-3" />
                            <span>{meta.label}</span>
                          </div>
                          <span className="text-muted-foreground">{formatBytes(f.total_bytes || 0)}</span>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Main content */}
            <div className="flex-1 min-w-0">
              <TabsList className="mb-4">
                <TabsTrigger value="files">
                  <FileText className="h-4 w-4 mr-1.5" />
                  Files
                </TabsTrigger>
                <TabsTrigger value="plans">
                  <Cloud className="h-4 w-4 mr-1.5" />
                  Plans
                </TabsTrigger>
                <TabsTrigger value="api-keys">
                  <Key className="h-4 w-4 mr-1.5" />
                  API Keys
                </TabsTrigger>
              </TabsList>

              {/* Files Tab */}
              <TabsContent value="files" className="space-y-4">
                <div className="flex items-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                  <Button
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingFile}
                  >
                    {uploadingFile ? (
                      <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Upload className="h-4 w-4 mr-2" />
                    )}
                    Upload File
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => filesQuery.refetch()}>
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                  <span className="text-xs text-muted-foreground ml-auto">
                    {filesQuery.data?.length ?? 0} files
                  </span>
                </div>

                {filesQuery.isLoading ? (
                  <div className="flex justify-center py-8">
                    <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : filesQuery.data?.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <HardDrive className="h-10 w-10 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">No files yet. Upload your first file to get started.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filesQuery.data?.map((file: any) => (
                      <FileRow
                        key={file.id}
                        file={file}
                        onDelete={() => deleteFileMut.mutate({ fileId: file.id })}
                        onShare={() => createShareLinkMut.mutate({ fileId: file.id, expiresHours: 24 })}
                        onDownload={() => handleDownload(file.id, file.originalName)}
                      />
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* Plans Tab */}
              <TabsContent value="plans" className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {plansQuery.data?.map((plan) => (
                    <PlanCard
                      key={plan.id}
                      plan={plan}
                      isActive={subQuery.data?.plan === plan.id}
                      onSelect={() => handlePlanSelect(plan.id)}
                      loading={checkoutLoading === plan.id}
                    />
                  ))}
                </div>
              </TabsContent>

              {/* API Keys Tab */}
              <TabsContent value="api-keys" className="space-y-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Create New API Key</CardTitle>
                    <CardDescription className="text-xs">
                      Use API keys to access your Titan Storage programmatically from external tools.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Key name (e.g. My Script)"
                        value={newKeyName}
                        onChange={(e) => setNewKeyName(e.target.value)}
                        className="h-8 text-sm"
                      />
                      <Button
                        size="sm"
                        onClick={() => createApiKeyMut.mutate({ name: newKeyName, scopes: ["read", "write"] })}
                        disabled={!newKeyName.trim() || createApiKeyMut.isPending}
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Create
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {apiKeysQuery.data?.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Key className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No API keys yet.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {apiKeysQuery.data?.map((key: any) => (
                      <div key={key.id} className="flex items-center gap-3 p-3 rounded-lg border border-border/40">
                        <Key className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium">{key.name}</div>
                          <div className="text-xs text-muted-foreground font-mono">
                            {key.keyPrefix}••••••••••••••••••••••••
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {(key.scopes as string[]).map((s: string) => (
                            <Badge key={s} variant="secondary" className="text-[10px] px-1.5 py-0">{s}</Badge>
                          ))}
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => revokeApiKeyMut.mutate({ keyId: key.id })}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            </div>
          </div>
        </Tabs>
      )}
    </div>
  );
}
