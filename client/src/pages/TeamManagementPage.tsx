import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { useSubscription } from "@/hooks/useSubscription";
import { UpgradeDialog } from "@/components/UpgradePrompt";
import {
  Users,
  UserPlus,
  Shield,
  Eye,
  Trash2,
  Crown,
  UserCog,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const ROLE_LABELS: Record<string, { label: string; color: string; icon: any }> = {
  owner: { label: "Owner", color: "text-amber-500", icon: Crown },
  admin: { label: "Admin", color: "text-blue-500", icon: Shield },
  member: { label: "Member", color: "text-emerald-500", icon: UserCog },
  viewer: { label: "Viewer", color: "text-muted-foreground", icon: Eye },
};

export default function TeamManagementPage() {
  const sub = useSubscription();
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "member" | "viewer">("member");

  const membersQuery = trpc.team.listMembers.useQuery(undefined, {
    enabled: sub.canUse("team_management"),
    retry: false,
  });
  const statsQuery = trpc.team.stats.useQuery(undefined, {
    enabled: sub.canUse("team_management"),
    retry: false,
  });

  const addMutation = trpc.team.addMember.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.memberName} added to team`);
      setShowAdd(false);
      setEmail("");
      setRole("member");
      membersQuery.refetch();
      statsQuery.refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const updateRoleMutation = trpc.team.updateRole.useMutation({
    onSuccess: () => {
      toast.success("Role updated");
      membersQuery.refetch();
      statsQuery.refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const removeMutation = trpc.team.removeMember.useMutation({
    onSuccess: () => {
      toast.success("Member removed");
      membersQuery.refetch();
      statsQuery.refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  if (!sub.canUse("team_management")) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Team Management
          </h1>
          <p className="text-muted-foreground mt-1">
            Invite team members and manage access to shared credentials.
          </p>
        </div>
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Users className="h-12 w-12 text-muted-foreground/40 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Enterprise Feature</h3>
            <p className="text-sm text-muted-foreground max-w-sm mb-4">
              Team Management allows you to invite up to 25 members with
              role-based access control for shared credential management.
            </p>
            <Button
              onClick={() => setShowUpgrade(true)}
              className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white"
            >
              Upgrade to Enterprise
            </Button>
          </CardContent>
        </Card>
        <UpgradeDialog
          open={showUpgrade}
          onOpenChange={setShowUpgrade}
          feature="Team Management"
          requiredPlan="enterprise"
        />
      </div>
    );
  }

  const stats = statsQuery.data;
  const members = membersQuery.data || [];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Team Management
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage team members and their access levels.
          </p>
        </div>
        <Dialog open={showAdd} onOpenChange={setShowAdd}>
          <DialogTrigger asChild>
            <Button>
              <UserPlus className="h-4 w-4 mr-2" />
              Add Member
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Team Member</DialogTitle>
              <DialogDescription>
                Add an existing user to your team by their email address. They
                must have signed up first.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Email Address</Label>
                <Input
                  type="email"
                  placeholder="teammate@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Role</Label>
                <Select
                  value={role}
                  onValueChange={(v) =>
                    setRole(v as "admin" | "member" | "viewer")
                  }
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">
                      Admin — Full access, can manage team
                    </SelectItem>
                    <SelectItem value="member">
                      Member — Can create jobs and view credentials
                    </SelectItem>
                    <SelectItem value="viewer">
                      Viewer — Read-only access
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAdd(false)}>
                Cancel
              </Button>
              <Button
                onClick={() =>
                  addMutation.mutate({ email, role })
                }
                disabled={!email || addMutation.isPending}
              >
                Add Member
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="text-2xl font-bold">
                {stats.totalMembers}
                <span className="text-sm font-normal text-muted-foreground">
                  {" "}
                  / {stats.maxSeats}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Total Seats</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="text-2xl font-bold text-blue-500">
                {stats.admins}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Admins</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="text-2xl font-bold text-emerald-500">
                {stats.members}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Members</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="text-2xl font-bold text-muted-foreground">
                {stats.viewers}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Viewers</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Members List */}
      <div>
        <h2 className="text-lg font-semibold mb-3">
          Team Members ({members.length})
        </h2>
        {members.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-8 text-center">
              <Users className="h-8 w-8 text-muted-foreground/40 mb-2" />
              <p className="text-sm text-muted-foreground">
                No team members yet. Add someone to get started.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {members.map((member) => {
              const roleInfo = ROLE_LABELS[member.role] || ROLE_LABELS.member;
              const RoleIcon = roleInfo.icon;
              return (
                <Card key={member.id}>
                  <CardContent className="flex items-center justify-between py-4">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-sm font-medium">
                          {(
                            member.userName ||
                            member.userEmail ||
                            "?"
                          )
                            .charAt(0)
                            .toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            {member.userName || "Unknown User"}
                          </span>
                          <Badge
                            variant="secondary"
                            className={`text-[10px] ${roleInfo.color}`}
                          >
                            <RoleIcon className="h-3 w-3 mr-1" />
                            {roleInfo.label}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {member.userEmail || member.inviteEmail}
                          {member.joinedAt &&
                            ` · Joined ${new Date(member.joinedAt).toLocaleDateString()}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Select
                        value={member.role}
                        onValueChange={(v) =>
                          updateRoleMutation.mutate({
                            memberId: member.id,
                            role: v as "admin" | "member" | "viewer",
                          })
                        }
                      >
                        <SelectTrigger className="w-[120px] h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="member">Member</SelectItem>
                          <SelectItem value="viewer">Viewer</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive h-8 w-8"
                        onClick={() => {
                          if (
                            confirm(
                              `Remove ${member.userName || member.userEmail} from the team?`
                            )
                          ) {
                            removeMutation.mutate({ memberId: member.id });
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
