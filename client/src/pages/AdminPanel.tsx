import { useState, useMemo } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  Users,
  Shield,
  ShieldAlert,
  Search,
  ChevronLeft,
  ChevronRight,
  Crown,
  Key,
  Trash2,
  RotateCcw,
  ShieldOff,
  Eye,
  Copy,
  Activity,
  Database,
  KeyRound,
  CreditCard,
  Loader2,
  UserCog,
  BarChart3,
  Clock,
} from "lucide-react";

export default function AdminPanel() {
  const { user } = useAuth();
  const utils = trpc.useUtils();

  // Filters
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | "user" | "admin">("all");
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<"createdAt" | "lastSignedIn" | "name" | "email">("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Dialogs
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [showUserDetail, setShowUserDetail] = useState(false);
  const [showRoleDialog, setShowRoleDialog] = useState(false);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [show2FADialog, setShow2FADialog] = useState(false);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [newRole, setNewRole] = useState<"user" | "admin">("user");

  // Debounced search
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const searchTimer = useMemo(() => {
    return (val: string) => {
      const t = setTimeout(() => {
        setDebouncedSearch(val);
        setPage(1);
      }, 300);
      return () => clearTimeout(t);
    };
  }, []);

  // Queries
  const usersQuery = trpc.admin.listUsers.useQuery({
    page,
    limit: 20,
    search: debouncedSearch || undefined,
    role: roleFilter,
    sortBy,
    sortOrder,
  });

  const statsQuery = trpc.admin.systemStats.useQuery();

  const userDetailQuery = trpc.admin.getUser.useQuery(
    { userId: selectedUserId! },
    { enabled: !!selectedUserId && showUserDetail }
  );

  // Mutations
  const updateRole = trpc.admin.updateRole.useMutation({
    onSuccess: () => {
      toast.success("User role updated");
      utils.admin.listUsers.invalidate();
      utils.admin.systemStats.invalidate();
      setShowRoleDialog(false);
    },
    onError: (err) => toast.error(err.message),
  });

  const resetPassword = trpc.admin.resetPassword.useMutation({
    onSuccess: (data) => {
      setTempPassword(data.tempPassword);
      toast.success("Password reset successfully");
    },
    onError: (err) => toast.error(err.message),
  });

  const disable2FA = trpc.admin.disable2FA.useMutation({
    onSuccess: () => {
      toast.success("2FA disabled for user");
      utils.admin.listUsers.invalidate();
      setShow2FADialog(false);
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteUser = trpc.admin.deleteUser.useMutation({
    onSuccess: () => {
      toast.success("User deleted");
      utils.admin.listUsers.invalidate();
      utils.admin.systemStats.invalidate();
      setShowDeleteDialog(false);
      setSelectedUserId(null);
    },
    onError: (err) => toast.error(err.message),
  });

  // Guard: admin only
  if (user?.role !== "admin") {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <ShieldAlert className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">Access Denied</h2>
            <p className="text-muted-foreground">You need admin privileges to access this panel.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const stats = statsQuery.data;
  const userData = usersQuery.data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <UserCog className="w-7 h-7 text-blue-400" />
            Admin Panel
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage users, roles, and system settings
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard icon={Users} label="Total Users" value={stats.totalUsers} />
          <StatCard icon={Crown} label="Admin Users" value={stats.adminUsers} />
          <StatCard icon={CreditCard} label="Active Subs" value={stats.activeSubscriptions} />
          <StatCard icon={Clock} label="New (7d)" value={stats.recentSignups} />
          <StatCard icon={Database} label="Credentials" value={stats.totalCredentials} />
          <StatCard icon={Activity} label="Fetch Jobs" value={stats.totalJobs} />
          <StatCard icon={KeyRound} label="API Keys" value={stats.totalApiKeys} />
          <StatCard icon={BarChart3} label="Self-Mods" value={stats.selfModifications} />
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search users by name, email, or ID..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              searchTimer(e.target.value);
            }}
            className="pl-10"
          />
        </div>
        <Select value={roleFilter} onValueChange={(v) => { setRoleFilter(v as any); setPage(1); }}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            <SelectItem value="user">Users</SelectItem>
            <SelectItem value="admin">Admins</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={(v) => { setSortBy(v as any); setPage(1); }}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="createdAt">Created</SelectItem>
            <SelectItem value="lastSignedIn">Last Active</SelectItem>
            <SelectItem value="name">Name</SelectItem>
            <SelectItem value="email">Email</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="icon"
          onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
          title={sortOrder === "asc" ? "Ascending" : "Descending"}
        >
          {sortOrder === "asc" ? "↑" : "↓"}
        </Button>
      </div>

      {/* Users Table */}
      <Card className="border-border/50">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">ID</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="hidden md:table-cell">Method</TableHead>
                <TableHead className="hidden md:table-cell">2FA</TableHead>
                <TableHead className="hidden lg:table-cell">Last Active</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {usersQuery.isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : !userData?.users.length ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No users found
                  </TableCell>
                </TableRow>
              ) : (
                userData.users.map((u) => (
                  <TableRow key={u.id} className="group">
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {u.id}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium text-sm">{u.name || "—"}</p>
                        <p className="text-xs text-muted-foreground">{u.email || u.openId}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={u.role === "admin" ? "default" : "secondary"}
                        className={u.role === "admin" ? "bg-amber-500/20 text-amber-400 border-amber-500/30" : ""}
                      >
                        {u.role === "admin" && <Crown className="w-3 h-3 mr-1" />}
                        {u.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <span className="text-xs text-muted-foreground capitalize">
                        {u.loginMethod || "oauth"}
                      </span>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {u.twoFactorEnabled ? (
                        <Badge variant="outline" className="text-green-400 border-green-500/30 text-xs">
                          <Shield className="w-3 h-3 mr-1" /> On
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">Off</span>
                      )}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                      {new Date(u.lastSignedIn).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => {
                            setSelectedUserId(u.id);
                            setShowUserDetail(true);
                          }}
                          title="View details"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => {
                            setSelectedUserId(u.id);
                            setNewRole(u.role === "admin" ? "user" : "admin");
                            setShowRoleDialog(true);
                          }}
                          title="Change role"
                          disabled={u.id === user?.id}
                        >
                          <Crown className="w-4 h-4" />
                        </Button>
                        {u.loginMethod === "email" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => {
                              setSelectedUserId(u.id);
                              setTempPassword(null);
                              setShowResetDialog(true);
                            }}
                            title="Reset password"
                          >
                            <Key className="w-4 h-4" />
                          </Button>
                        )}
                        {u.twoFactorEnabled && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => {
                              setSelectedUserId(u.id);
                              setShow2FADialog(true);
                            }}
                            title="Disable 2FA"
                          >
                            <ShieldOff className="w-4 h-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-red-400 hover:text-red-300"
                          onClick={() => {
                            setSelectedUserId(u.id);
                            setShowDeleteDialog(true);
                          }}
                          title="Delete user"
                          disabled={u.id === user?.id}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pagination */}
      {userData && userData.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {userData.page} of {userData.totalPages} ({userData.total} users)
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              <ChevronLeft className="w-4 h-4 mr-1" /> Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(userData.totalPages, p + 1))}
              disabled={page === userData.totalPages}
            >
              Next <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* ─── User Detail Dialog ─────────────────────────────────── */}
      <Dialog open={showUserDetail} onOpenChange={setShowUserDetail}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>User Details</DialogTitle>
          </DialogHeader>
          {userDetailQuery.isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : userDetailQuery.data ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <DetailRow label="ID" value={String(userDetailQuery.data.id)} />
                <DetailRow label="Name" value={userDetailQuery.data.name || "—"} />
                <DetailRow label="Email" value={userDetailQuery.data.email || "—"} />
                <DetailRow label="Role" value={userDetailQuery.data.role} />
                <DetailRow label="Login Method" value={userDetailQuery.data.loginMethod || "oauth"} />
                <DetailRow label="Email Verified" value={userDetailQuery.data.emailVerified ? "Yes" : "No"} />
                <DetailRow label="2FA Enabled" value={userDetailQuery.data.twoFactorEnabled ? "Yes" : "No"} />
                <DetailRow label="Onboarded" value={userDetailQuery.data.onboardingCompleted ? "Yes" : "No"} />
                <DetailRow label="Created" value={new Date(userDetailQuery.data.createdAt).toLocaleString()} />
                <DetailRow label="Last Active" value={new Date(userDetailQuery.data.lastSignedIn).toLocaleString()} />
              </div>

              <div className="border-t border-border/50 pt-3">
                <p className="text-xs font-medium text-muted-foreground mb-2">Stats</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <DetailRow label="Credentials" value={String(userDetailQuery.data.stats.credentials)} />
                  <DetailRow label="Fetch Jobs" value={String(userDetailQuery.data.stats.jobs)} />
                  <DetailRow label="API Keys" value={String(userDetailQuery.data.stats.apiKeys)} />
                  <DetailRow
                    label="Subscription"
                    value={
                      userDetailQuery.data.stats.subscription
                        ? `${userDetailQuery.data.stats.subscription.plan} (${userDetailQuery.data.stats.subscription.status})`
                        : "Free"
                    }
                  />
                </div>
              </div>

              {userDetailQuery.data.providers.length > 0 && (
                <div className="border-t border-border/50 pt-3">
                  <p className="text-xs font-medium text-muted-foreground mb-2">Linked Providers</p>
                  <div className="space-y-1">
                    {userDetailQuery.data.providers.map((p, i) => (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <span className="capitalize">{p.provider}</span>
                        <span className="text-muted-foreground text-xs">{p.email}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* ─── Role Change Dialog ─────────────────────────────────── */}
      <Dialog open={showRoleDialog} onOpenChange={setShowRoleDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change User Role</DialogTitle>
            <DialogDescription>
              Change this user's role to <strong>{newRole}</strong>?
              {newRole === "admin" && " This will give them full admin access."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRoleDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (selectedUserId) {
                  updateRole.mutate({ userId: selectedUserId, role: newRole });
                }
              }}
              disabled={updateRole.isPending}
            >
              {updateRole.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Reset Password Dialog ──────────────────────────────── */}
      <Dialog open={showResetDialog} onOpenChange={(open) => { setShowResetDialog(open); if (!open) setTempPassword(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>
              {tempPassword
                ? "A temporary password has been generated. Share it securely with the user."
                : "Generate a new temporary password for this user?"}
            </DialogDescription>
          </DialogHeader>
          {tempPassword ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 bg-muted/50 rounded-lg p-3">
                <code className="flex-1 font-mono text-sm">{tempPassword}</code>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => {
                    navigator.clipboard.writeText(tempPassword);
                    toast.success("Copied to clipboard");
                  }}
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                The user should change this password immediately after signing in.
              </p>
            </div>
          ) : (
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowResetDialog(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (selectedUserId) {
                    resetPassword.mutate({ userId: selectedUserId });
                  }
                }}
                disabled={resetPassword.isPending}
              >
                {resetPassword.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Reset Password
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* ─── Disable 2FA Dialog ─────────────────────────────────── */}
      <Dialog open={show2FADialog} onOpenChange={setShow2FADialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Disable Two-Factor Authentication</DialogTitle>
            <DialogDescription>
              This will remove 2FA from the user's account. They will need to set it up again.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShow2FADialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (selectedUserId) {
                  disable2FA.mutate({ userId: selectedUserId });
                }
              }}
              disabled={disable2FA.isPending}
            >
              {disable2FA.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Disable 2FA
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Delete User Dialog ─────────────────────────────────── */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-red-400">Delete User</DialogTitle>
            <DialogDescription>
              This action is permanent and cannot be undone. All user data including credentials, jobs, API keys, and subscriptions will be deleted.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (selectedUserId) {
                  deleteUser.mutate({ userId: selectedUserId });
                }
              }}
              disabled={deleteUser.isPending}
            >
              {deleteUser.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Delete Permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Helper Components ──────────────────────────────────────────────

function StatCard({ icon: Icon, label, value }: { icon: any; label: string; value: number }) {
  return (
    <Card className="border-border/50">
      <CardContent className="pt-4 pb-3 px-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
            <Icon className="w-4.5 h-4.5 text-blue-400" />
          </div>
          <div>
            <p className="text-2xl font-bold leading-none">{value.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium truncate">{value}</p>
    </div>
  );
}
