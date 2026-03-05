/**
 * Virelle Studios — Director Scene Management
 *
 * Admin-only feature. Directors can create, manage, and get AI assistance
 * on scenes. External scenes are added without any content censorship.
 *
 * Copyright disclaimer: "Any copyright material used without permission is
 * the sole responsibility of the user and Virelle Studios are not liable
 * for any misuse."
 */
import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import {
  Film,
  Plus,
  Pencil,
  Trash2,
  ExternalLink,
  ShieldAlert,
  Loader2,
  Clapperboard,
  Globe,
  Sparkles,
  Eye,
  Archive,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Settings,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type Scene = {
  id: number;
  title: string;
  description: string | null;
  type: "internal" | "external";
  externalUrl: string | null;
  externalSource: string | null;
  notes: string | null;
  status: "draft" | "published" | "archived";
  copyrightAcknowledged: boolean;
  createdAt: Date;
  updatedAt: Date;
};

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: Scene["status"] }) {
  const map = {
    draft: { label: "Draft", className: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
    published: { label: "Published", className: "bg-green-500/20 text-green-400 border-green-500/30" },
    archived: { label: "Archived", className: "bg-gray-500/20 text-gray-400 border-gray-500/30" },
  };
  const { label, className } = map[status];
  return <Badge variant="outline" className={className}>{label}</Badge>;
}

// ─── Type Badge ───────────────────────────────────────────────────────────────

function TypeBadge({ type }: { type: Scene["type"] }) {
  if (type === "external") {
    return (
      <Badge variant="outline" className="bg-purple-500/20 text-purple-400 border-purple-500/30 gap-1">
        <Globe className="w-3 h-3" /> External
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="bg-blue-500/20 text-blue-400 border-blue-500/30 gap-1">
      <Sparkles className="w-3 h-3" /> Internal
    </Badge>
  );
}

// ─── Scene Form Dialog ────────────────────────────────────────────────────────

function SceneFormDialog({
  open,
  onClose,
  editScene,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  editScene?: Scene | null;
  onSuccess: () => void;
}) {
  const isEdit = !!editScene;

  const [title, setTitle] = useState(editScene?.title ?? "");
  const [description, setDescription] = useState(editScene?.description ?? "");
  const [type, setType] = useState<"internal" | "external">(editScene?.type ?? "internal");
  const [externalUrl, setExternalUrl] = useState(editScene?.externalUrl ?? "");
  const [externalSource, setExternalSource] = useState(editScene?.externalSource ?? "");
  const [notes, setNotes] = useState(editScene?.notes ?? "");
  const [status, setStatus] = useState<Scene["status"]>(editScene?.status ?? "draft");
  const [copyrightAcknowledged, setCopyrightAcknowledged] = useState(editScene?.copyrightAcknowledged ?? false);

  const utils = trpc.useUtils();

  const createMutation = trpc.virelle.createScene.useMutation({
    onSuccess: () => {
      toast.success("Scene created successfully");
      utils.virelle.listScenes.invalidate();
      onSuccess();
      onClose();
    },
    onError: (err) => toast.error(err.message),
  });

  const updateMutation = trpc.virelle.updateScene.useMutation({
    onSuccess: () => {
      toast.success("Scene updated successfully");
      utils.virelle.listScenes.invalidate();
      onSuccess();
      onClose();
    },
    onError: (err) => toast.error(err.message),
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  const handleSubmit = () => {
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    if (type === "external" && !externalUrl.trim()) {
      toast.error("External URL is required for external scenes");
      return;
    }
    if (type === "external" && !copyrightAcknowledged) {
      toast.error("You must acknowledge the copyright disclaimer for external scenes");
      return;
    }

    if (isEdit && editScene) {
      updateMutation.mutate({
        sceneId: editScene.id,
        title: title.trim(),
        description: description.trim() || undefined,
        externalUrl: type === "external" ? externalUrl.trim() : null,
        externalSource: type === "external" ? externalSource.trim() || null : null,
        notes: notes.trim() || undefined,
        status,
      });
    } else {
      createMutation.mutate({
        title: title.trim(),
        description: description.trim() || undefined,
        type,
        externalUrl: type === "external" ? externalUrl.trim() : undefined,
        externalSource: type === "external" ? externalSource.trim() || undefined : undefined,
        notes: notes.trim() || undefined,
        copyrightAcknowledged: type === "external" ? copyrightAcknowledged : true,
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clapperboard className="w-5 h-5 text-purple-400" />
            {isEdit ? "Edit Scene" : "Add New Scene"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update the scene details below."
              : "Create a new scene for your Virelle Studios project."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Title */}
          <div className="space-y-1">
            <label className="text-sm font-medium">Scene Title *</label>
            <Input
              placeholder="Enter scene title..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          {/* Type — only changeable on create */}
          {!isEdit && (
            <div className="space-y-1">
              <label className="text-sm font-medium">Scene Type *</label>
              <Select value={type} onValueChange={(v) => setType(v as "internal" | "external")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="internal">
                    <span className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-blue-400" /> Internal (AI-generated)
                    </span>
                  </SelectItem>
                  <SelectItem value="external">
                    <span className="flex items-center gap-2">
                      <Globe className="w-4 h-4 text-purple-400" /> External (Uploaded / Linked)
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* External URL fields */}
          {(type === "external" || (isEdit && editScene?.type === "external")) && (
            <>
              <div className="space-y-1">
                <label className="text-sm font-medium">External URL *</label>
                <Input
                  placeholder="https://..."
                  value={externalUrl}
                  onChange={(e) => setExternalUrl(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Source Platform</label>
                <Input
                  placeholder="e.g. YouTube, Vimeo, Custom..."
                  value={externalSource}
                  onChange={(e) => setExternalSource(e.target.value)}
                />
              </div>

              {/* Copyright Disclaimer */}
              <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 space-y-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-amber-300">Copyright Disclaimer</p>
                    <p className="text-xs text-amber-200/80 mt-1 leading-relaxed">
                      Any copyright material used without permission is the sole responsibility of the
                      user and Virelle Studios are not liable for any misuse. By adding an external
                      scene, you confirm that you have all necessary rights, licenses, or permissions
                      for the content you are linking to.
                    </p>
                  </div>
                </div>
                {!isEdit && (
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={copyrightAcknowledged}
                      onChange={(e) => setCopyrightAcknowledged(e.target.checked)}
                      className="w-4 h-4 rounded accent-amber-400"
                    />
                    <span className="text-xs text-amber-200">
                      I acknowledge this disclaimer and accept full responsibility for this content.
                    </span>
                  </label>
                )}
              </div>
            </>
          )}

          {/* Description */}
          <div className="space-y-1">
            <label className="text-sm font-medium">Description</label>
            <Textarea
              placeholder="Describe this scene..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          {/* Notes */}
          <div className="space-y-1">
            <label className="text-sm font-medium">Director's Notes</label>
            <Textarea
              placeholder="Private notes for this scene..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>

          {/* Status — only on edit */}
          {isEdit && (
            <div className="space-y-1">
              <label className="text-sm font-medium">Status</label>
              <Select value={status} onValueChange={(v) => setStatus(v as Scene["status"])}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="published">Published</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isPending} className="bg-purple-600 hover:bg-purple-700">
            {isPending ? (
              <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Saving...</>
            ) : (
              <><CheckCircle2 className="w-4 h-4 mr-2" /> {isEdit ? "Save Changes" : "Create Scene"}</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Delete Confirm Dialog ────────────────────────────────────────────────────

function DeleteDialog({
  open,
  scene,
  onClose,
}: {
  open: boolean;
  scene: Scene | null;
  onClose: () => void;
}) {
  const utils = trpc.useUtils();
  const deleteMutation = trpc.virelle.deleteScene.useMutation({
    onSuccess: () => {
      toast.success("Scene deleted");
      utils.virelle.listScenes.invalidate();
      onClose();
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-400">
            <Trash2 className="w-5 h-5" /> Delete Scene
          </DialogTitle>
          <DialogDescription>
            Are you sure you want to delete{" "}
            <span className="font-semibold text-foreground">"{scene?.title}"</span>? This action
            cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={deleteMutation.isPending}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => scene && deleteMutation.mutate({ sceneId: scene.id })}
            disabled={deleteMutation.isPending}
          >
            {deleteMutation.isPending ? (
              <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Deleting...</>
            ) : (
              "Delete Scene"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Studio Profile Dialog ────────────────────────────────────────────────────

function StudioProfileDialog({
  open,
  onClose,
  currentName,
  currentBio,
}: {
  open: boolean;
  onClose: () => void;
  currentName: string;
  currentBio: string | null;
}) {
  const [studioName, setStudioName] = useState(currentName);
  const [bio, setBio] = useState(currentBio ?? "");
  const utils = trpc.useUtils();

  const updateMutation = trpc.virelle.updateDirectorProfile.useMutation({
    onSuccess: () => {
      toast.success("Studio profile updated");
      utils.virelle.getDirectorProfile.invalidate();
      onClose();
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-purple-400" /> Studio Profile
          </DialogTitle>
          <DialogDescription>Update your Virelle Studios director profile.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <label className="text-sm font-medium">Studio Name</label>
            <Input
              value={studioName}
              onChange={(e) => setStudioName(e.target.value)}
              placeholder="Your studio name..."
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Bio</label>
            <Textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell us about your studio..."
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={() => updateMutation.mutate({ studioName, bio: bio || undefined })}
            disabled={updateMutation.isPending || !studioName.trim()}
            className="bg-purple-600 hover:bg-purple-700"
          >
            {updateMutation.isPending ? (
              <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Saving...</>
            ) : (
              "Save Profile"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function VirellePage() {
  const { user } = useAuth();

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editScene, setEditScene] = useState<Scene | null>(null);
  const [deleteScene, setDeleteScene] = useState<Scene | null>(null);
  const [showProfileDialog, setShowProfileDialog] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"all" | Scene["status"]>("all");
  const [typeFilter, setTypeFilter] = useState<"all" | Scene["type"]>("all");

  const profileQuery = trpc.virelle.getDirectorProfile.useQuery();
  const scenesQuery = trpc.virelle.listScenes.useQuery();

  const isAdmin = user?.role === "admin" || user?.role === "head_admin";

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <ShieldAlert className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">Access Denied</h2>
            <p className="text-muted-foreground">
              Virelle Studios is available to directors only. Contact an administrator to request
              access.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const scenes = (scenesQuery.data ?? []) as Scene[];
  const profile = profileQuery.data;

  const filteredScenes = scenes.filter((s) => {
    if (statusFilter !== "all" && s.status !== statusFilter) return false;
    if (typeFilter !== "all" && s.type !== typeFilter) return false;
    return true;
  });

  const stats = {
    total: scenes.length,
    published: scenes.filter((s) => s.status === "published").length,
    draft: scenes.filter((s) => s.status === "draft").length,
    external: scenes.filter((s) => s.type === "external").length,
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Film className="w-7 h-7 text-purple-400" />
            Virelle Studios
          </h1>
          {profile && (
            <p className="text-muted-foreground text-sm mt-1">
              Director:{" "}
              <span className="text-purple-300 font-medium">{profile.studioName}</span>
            </p>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowProfileDialog(true)}
            className="gap-1"
          >
            <Settings className="w-4 h-4" /> Studio Profile
          </Button>
          <Button
            size="sm"
            onClick={() => setShowCreateDialog(true)}
            className="bg-purple-600 hover:bg-purple-700 gap-1"
          >
            <Plus className="w-4 h-4" /> Add Scene
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total Scenes", value: stats.total, icon: Clapperboard, color: "text-purple-400" },
          { label: "Published", value: stats.published, icon: Eye, color: "text-green-400" },
          { label: "Drafts", value: stats.draft, icon: FileText, color: "text-yellow-400" },
          { label: "External", value: stats.external, icon: Globe, color: "text-blue-400" },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label} className="border-border/50">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="text-2xl font-bold mt-0.5">{value}</p>
                </div>
                <Icon className={`w-8 h-8 ${color} opacity-60`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="published">Published</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as typeof typeFilter)}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="internal">Internal</SelectItem>
            <SelectItem value="external">External</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Scenes Table */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Clapperboard className="w-4 h-4 text-purple-400" />
            Scenes ({filteredScenes.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {scenesQuery.isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredScenes.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Clapperboard className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No scenes yet</p>
              <p className="text-sm mt-1">Click "Add Scene" to create your first scene.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Source / URL</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredScenes.map((scene) => (
                    <TableRow key={scene.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm">{scene.title}</p>
                          {scene.description && (
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                              {scene.description}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <TypeBadge type={scene.type} />
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={scene.status} />
                      </TableCell>
                      <TableCell>
                        {scene.type === "external" && scene.externalUrl ? (
                          <a
                            href={scene.externalUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"
                          >
                            <ExternalLink className="w-3 h-3" />
                            {scene.externalSource || "View"}
                          </a>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(scene.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => setEditScene(scene)}
                            title="Edit scene"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                            onClick={() => setDeleteScene(scene)}
                            title="Delete scene"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Copyright Notice */}
      <div className="rounded-lg border border-border/50 bg-muted/30 p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-amber-300">Copyright & Content Disclaimer</p>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              Any copyright material used without permission is the sole responsibility of the user
              and Virelle Studios are not liable for any misuse. Directors are solely responsible for
              ensuring they have all necessary rights, licenses, or permissions for any external
              content they add. Virelle Studios does not review or moderate external content and
              assumes no liability for copyright infringement or any other legal claims arising from
              user-added content.
            </p>
          </div>
        </div>
      </div>

      {/* Dialogs */}
      <SceneFormDialog
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onSuccess={() => {}}
      />
      <SceneFormDialog
        open={!!editScene}
        onClose={() => setEditScene(null)}
        editScene={editScene}
        onSuccess={() => {}}
      />
      <DeleteDialog
        open={!!deleteScene}
        scene={deleteScene}
        onClose={() => setDeleteScene(null)}
      />
      {profile && (
        <StudioProfileDialog
          open={showProfileDialog}
          onClose={() => setShowProfileDialog(false)}
          currentName={profile.studioName}
          currentBio={profile.bio ?? null}
        />
      )}
    </div>
  );
}
