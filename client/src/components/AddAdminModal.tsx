/**
 * AddAdminModal — Admin-only modal for promoting users to admin or head_admin.
 *
 * Uses the existing trpc.admin.listUsers and trpc.admin.updateRole endpoints.
 * Only rendered when the current user has role="admin" or "head_admin".
 */
import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { isAdminRole, isHeadAdmin } from "@shared/const";
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  Search,
  UserCheck,
  UserX,
  Loader2,
  Crown,
} from "lucide-react";

interface AddAdminModalProps {
  open: boolean;
  onClose: () => void;
  /** The current logged-in user's role — used to gate head_admin promotion */
  currentUserRole: string;
}

function RoleBadge({ role }: { role: string }) {
  if (role === "head_admin") {
    return (
      <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30 gap-1 text-[10px]">
        <Crown className="h-2.5 w-2.5" />
        Head Admin
      </Badge>
    );
  }
  if (role === "admin") {
    return (
      <Badge className="bg-blue-500/15 text-blue-400 border-blue-500/30 gap-1 text-[10px]">
        <ShieldCheck className="h-2.5 w-2.5" />
        Admin
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-muted-foreground text-[10px]">
      User
    </Badge>
  );
}

export function AddAdminModal({ open, onClose, currentUserRole }: AddAdminModalProps) {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [confirmUserId, setConfirmUserId] = useState<number | null>(null);
  const [confirmAction, setConfirmAction] = useState<"promote" | "demote" | "head_admin" | null>(null);

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  const usersQuery = trpc.admin.listUsers.useQuery(
    {
      search: debouncedSearch || undefined,
      limit: 20,
      page: 1,
      sortBy: "createdAt",
      sortOrder: "desc",
    },
    { enabled: open }
  );

  const updateRole = trpc.admin.updateRole.useMutation({
    onSuccess: (_data, variables) => {
      const action = variables.role === "user" ? "removed from admin" : `set as ${variables.role.replace("_", " ")}`;
      toast.success(`User ${action} successfully`);
      usersQuery.refetch();
      setConfirmUserId(null);
      setConfirmAction(null);
    },
    onError: (err) => {
      toast.error(err.message || "Failed to update role");
      setConfirmUserId(null);
      setConfirmAction(null);
    },
  });

  function handlePromote(userId: number, targetRole: "admin" | "head_admin") {
    setConfirmUserId(userId);
    setConfirmAction(targetRole === "head_admin" ? "head_admin" : "promote");
  }

  function handleDemote(userId: number) {
    setConfirmUserId(userId);
    setConfirmAction("demote");
  }

  function handleConfirm() {
    if (confirmUserId === null || confirmAction === null) return;
    const role =
      confirmAction === "demote"
        ? "user"
        : confirmAction === "head_admin"
        ? "head_admin"
        : "admin";
    updateRole.mutate({ userId: confirmUserId, role });
  }

  function handleCancel() {
    setConfirmUserId(null);
    setConfirmAction(null);
  }

  const users = usersQuery.data?.users ?? [];
  const confirmUser = users.find((u) => u.id === confirmUserId);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { onClose(); handleCancel(); } }}>
      <DialogContent className="max-w-lg w-full">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <ShieldAlert className="h-4 w-4 text-blue-400" />
            Manage Admins
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Search for a user and promote or demote their admin role. Only head admins can assign other head admins.
          </DialogDescription>
        </DialogHeader>

        {/* Confirm action overlay */}
        {confirmUserId !== null && confirmUser && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-3">
            <p className="text-sm font-medium text-amber-400">
              {confirmAction === "demote"
                ? `Remove admin from ${confirmUser.name || confirmUser.email}?`
                : confirmAction === "head_admin"
                ? `Promote ${confirmUser.name || confirmUser.email} to Head Admin?`
                : `Promote ${confirmUser.name || confirmUser.email} to Admin?`}
            </p>
            <p className="text-xs text-muted-foreground">
              {confirmAction === "demote"
                ? "This user will lose all admin privileges immediately."
                : confirmAction === "head_admin"
                ? "Head admins have full platform access including the ability to manage other admins."
                : "This user will gain admin-level access to the platform."}
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={confirmAction === "demote" ? "destructive" : "default"}
                className={confirmAction !== "demote" ? "bg-blue-600 hover:bg-blue-700" : ""}
                onClick={handleConfirm}
                disabled={updateRole.isPending}
              >
                {updateRole.isPending ? (
                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                ) : null}
                Confirm
              </Button>
              <Button size="sm" variant="outline" onClick={handleCancel} disabled={updateRole.isPending}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-sm"
            autoFocus
          />
        </div>

        {/* User list */}
        <div className="space-y-1 max-h-72 overflow-y-auto pr-1 scrollbar-thin">
          {usersQuery.isLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {!usersQuery.isLoading && users.length === 0 && (
            <div className="text-center py-8 text-sm text-muted-foreground">
              No users found{debouncedSearch ? ` for "${debouncedSearch}"` : ""}.
            </div>
          )}

          {users.map((user) => {
            const isCurrentlyAdmin = isAdminRole(user.role);
            const isCurrentlyHeadAdmin = user.role === "head_admin";
            const canPromoteToHeadAdmin = isHeadAdmin(currentUserRole) && !isCurrentlyHeadAdmin;
            const isBeingUpdated = updateRole.isPending && confirmUserId === user.id;

            return (
              <div
                key={user.id}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-white/[0.03] transition-colors group"
              >
                <Avatar className="h-8 w-8 shrink-0 border border-white/10">
                  <AvatarFallback className="text-xs bg-blue-500/10 text-blue-400">
                    {(user.name || user.email || "?").charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium truncate">
                      {user.name || "(no name)"}
                    </span>
                    <RoleBadge role={user.role} />
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                </div>

                <div className="flex items-center gap-1.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  {isBeingUpdated ? (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  ) : (
                    <>
                      {/* Promote to Admin (only if not already admin/head_admin) */}
                      {!isCurrentlyAdmin && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-[11px] border-blue-500/30 text-blue-400 hover:bg-blue-500/10 hover:text-blue-300"
                          onClick={() => handlePromote(user.id, "admin")}
                          title="Promote to Admin"
                        >
                          <Shield className="h-3 w-3 mr-1" />
                          Make Admin
                        </Button>
                      )}

                      {/* Promote to Head Admin (only head_admin can do this, and only for non-head_admin users) */}
                      {canPromoteToHeadAdmin && isCurrentlyAdmin && !isCurrentlyHeadAdmin && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-[11px] border-amber-500/30 text-amber-400 hover:bg-amber-500/10 hover:text-amber-300"
                          onClick={() => handlePromote(user.id, "head_admin")}
                          title="Promote to Head Admin"
                        >
                          <Crown className="h-3 w-3 mr-1" />
                          Head Admin
                        </Button>
                      )}

                      {/* Demote (only if currently admin, not head_admin) */}
                      {isCurrentlyAdmin && !isCurrentlyHeadAdmin && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-[11px] border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300"
                          onClick={() => handleDemote(user.id)}
                          title="Remove Admin"
                        >
                          <UserX className="h-3 w-3 mr-1" />
                          Remove
                        </Button>
                      )}

                      {/* Head admin can demote other head admins */}
                      {isCurrentlyHeadAdmin && isHeadAdmin(currentUserRole) && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-[11px] border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300"
                          onClick={() => handleDemote(user.id)}
                          title="Remove Head Admin"
                        >
                          <UserX className="h-3 w-3 mr-1" />
                          Remove
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer summary */}
        {!usersQuery.isLoading && users.length > 0 && (
          <div className="flex items-center justify-between pt-1 border-t border-white/5">
            <span className="text-[11px] text-muted-foreground">
              {usersQuery.data?.total ?? 0} total users
            </span>
            <span className="text-[11px] text-muted-foreground">
              {users.filter((u) => isAdminRole(u.role)).length} admin(s) shown
            </span>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
