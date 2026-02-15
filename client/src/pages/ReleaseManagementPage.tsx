import { useState, useRef } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  Plus,
  Upload,
  Monitor,
  Apple,
  Terminal,
  CheckCircle2,
  XCircle,
  Loader2,
  Package,
  Trash2,
  Edit,
  Download,
  Star,
} from "lucide-react";

// Platform config
const PLATFORMS = [
  { key: "windows" as const, label: "Windows", icon: Monitor, extensions: ".exe, .msi, .zip" },
  { key: "mac" as const, label: "macOS", icon: Apple, extensions: ".dmg, .pkg, .zip" },
  { key: "linux" as const, label: "Linux", icon: Terminal, extensions: ".AppImage, .deb, .rpm, .tar.gz" },
];

export default function ReleaseManagementPage() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const { data: releasesList, isLoading } = trpc.releases.adminList.useQuery();
  const createRelease = trpc.releases.create.useMutation({
    onSuccess: () => {
      utils.releases.adminList.invalidate();
      utils.releases.latest.invalidate();
      utils.releases.list.invalidate();
      toast.success("Release created successfully");
      setCreateOpen(false);
      resetCreateForm();
    },
    onError: (err) => toast.error(err.message),
  });
  const updateRelease = trpc.releases.update.useMutation({
    onSuccess: () => {
      utils.releases.adminList.invalidate();
      utils.releases.latest.invalidate();
      utils.releases.list.invalidate();
      toast.success("Release updated");
    },
    onError: (err) => toast.error(err.message),
  });
  const deleteRelease = trpc.releases.delete.useMutation({
    onSuccess: () => {
      utils.releases.adminList.invalidate();
      utils.releases.latest.invalidate();
      utils.releases.list.invalidate();
      toast.success("Release deleted");
    },
    onError: (err) => toast.error(err.message),
  });

  // Create release form state
  const [createOpen, setCreateOpen] = useState(false);
  const [newVersion, setNewVersion] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newChangelog, setNewChangelog] = useState("");
  const [newIsPrerelease, setNewIsPrerelease] = useState(false);
  const [newSetAsLatest, setNewSetAsLatest] = useState(true);

  // Upload state
  const [uploading, setUploading] = useState<Record<string, boolean>>({});
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  function resetCreateForm() {
    setNewVersion("");
    setNewTitle("");
    setNewChangelog("");
    setNewIsPrerelease(false);
    setNewSetAsLatest(true);
  }

  async function handleUpload(releaseId: number, platform: string, file: File) {
    const uploadKey = `${releaseId}-${platform}`;
    setUploading((prev) => ({ ...prev, [uploadKey]: true }));

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("platform", platform);
      formData.append("releaseId", releaseId.toString());

      const response = await fetch("/api/releases/upload", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Upload failed");
      }

      const result = await response.json();
      toast.success(`${platform} binary uploaded (${result.fileSizeMb} MB)`);
      utils.releases.adminList.invalidate();
      utils.releases.latest.invalidate();
      utils.releases.list.invalidate();
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploading((prev) => ({ ...prev, [uploadKey]: false }));
    }
  }

  if (user?.role !== "admin") {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-muted-foreground">Admin access required</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Release Management</h1>
          <p className="text-muted-foreground mt-1">
            Create releases and upload platform binaries for distribution
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Release
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Create New Release</DialogTitle>
              <DialogDescription>
                Create a release first, then upload binaries for each platform.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Version</Label>
                  <Input
                    placeholder="e.g. 1.1.0"
                    value={newVersion}
                    onChange={(e) => setNewVersion(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Title</Label>
                  <Input
                    placeholder="e.g. Archibald Titan v1.1.0"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Changelog (Markdown)</Label>
                <Textarea
                  placeholder="**New Features:**&#10;- Feature one&#10;- Feature two"
                  value={newChangelog}
                  onChange={(e) => setNewChangelog(e.target.value)}
                  rows={6}
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={newIsPrerelease}
                    onCheckedChange={setNewIsPrerelease}
                  />
                  <Label>Pre-release</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={newSetAsLatest}
                    onCheckedChange={setNewSetAsLatest}
                  />
                  <Label>Set as latest</Label>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setCreateOpen(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={() =>
                  createRelease.mutate({
                    version: newVersion,
                    title: newTitle,
                    changelog: newChangelog,
                    isPrerelease: newIsPrerelease,
                    setAsLatest: newSetAsLatest,
                  })
                }
                disabled={!newVersion || !newTitle || !newChangelog || createRelease.isPending}
              >
                {createRelease.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4 mr-2" />
                )}
                Create Release
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Releases list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : !releasesList?.length ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Package className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground">No releases yet</p>
            <p className="text-sm text-muted-foreground/60 mt-1">
              Create your first release to start distributing binaries
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {releasesList.map((release) => (
            <Card key={release.id} className="overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <CardTitle className="text-lg font-semibold">
                      {release.title}
                    </CardTitle>
                    <Badge variant="outline" className="font-mono text-xs">
                      v{release.version}
                    </Badge>
                    {release.isLatest === 1 && (
                      <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                        <Star className="h-3 w-3 mr-1" />
                        Latest
                      </Badge>
                    )}
                    {release.isPrerelease === 1 && (
                      <Badge variant="secondary">Pre-release</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        updateRelease.mutate({
                          id: release.id,
                          setAsLatest: true,
                        })
                      }
                      disabled={release.isLatest === 1}
                      title="Set as latest"
                    >
                      <Star className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Release</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete v{release.version}? This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteRelease.mutate({ id: release.id })}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
                <CardDescription className="flex items-center gap-4 mt-1">
                  <span>
                    Published {new Date(release.publishedAt).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                  {release.fileSizeMb && <span>{release.fileSizeMb} MB</span>}
                  <span className="flex items-center gap-1">
                    <Download className="h-3 w-3" />
                    {release.downloadCount} downloads
                  </span>
                </CardDescription>
              </CardHeader>
              <CardContent>
                {/* Platform binaries */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {PLATFORMS.map((p) => {
                    const urlField =
                      p.key === "windows"
                        ? release.downloadUrlWindows
                        : p.key === "mac"
                        ? release.downloadUrlMac
                        : release.downloadUrlLinux;
                    const hasFile = !!urlField;
                    const uploadKey = `${release.id}-${p.key}`;
                    const isUploading = uploading[uploadKey];
                    const PlatformIcon = p.icon;

                    return (
                      <div
                        key={p.key}
                        className={`relative flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                          hasFile
                            ? "border-emerald-500/20 bg-emerald-500/5"
                            : "border-dashed border-muted-foreground/20 bg-muted/5"
                        }`}
                      >
                        <PlatformIcon className={`h-5 w-5 shrink-0 ${hasFile ? "text-emerald-400" : "text-muted-foreground"}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{p.label}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {hasFile ? (
                              <span className="flex items-center gap-1 text-emerald-400">
                                <CheckCircle2 className="h-3 w-3" />
                                Binary uploaded
                              </span>
                            ) : (
                              <span className="flex items-center gap-1">
                                <XCircle className="h-3 w-3" />
                                No binary — {p.extensions}
                              </span>
                            )}
                          </p>
                        </div>
                        <input
                          ref={(el) => { fileInputRefs.current[uploadKey] = el; }}
                          type="file"
                          className="hidden"
                          accept={p.extensions.split(", ").map(e => e.trim()).join(",")}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleUpload(release.id, p.key, file);
                            e.target.value = "";
                          }}
                        />
                        <Button
                          variant={hasFile ? "outline" : "default"}
                          size="sm"
                          onClick={() => fileInputRefs.current[uploadKey]?.click()}
                          disabled={isUploading}
                          className="shrink-0"
                        >
                          {isUploading ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Upload className="h-3.5 w-3.5" />
                          )}
                          <span className="ml-1.5 text-xs">
                            {isUploading ? "Uploading..." : hasFile ? "Replace" : "Upload"}
                          </span>
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
