import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import AffiliateRecommendations from "@/components/AffiliateRecommendations";
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
import { Checkbox } from "@/components/ui/checkbox";
import { trpc } from "@/lib/trpc";
import { useSubscription } from "@/hooks/useSubscription";
import { UpgradeDialog } from "@/components/UpgradePrompt";
import {
  Key,
  Plus,
  Copy,
  Trash2,
  Shield,
  Clock,
  Activity,
  AlertTriangle,
  Check,
  Eye,
  EyeOff,
  Code,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function ApiAccessPage() {
  const sub = useSubscription();
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newKeyResult, setNewKeyResult] = useState<{
    key: string;
    name: string;
  } | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [keyName, setKeyName] = useState("");
  const [selectedScopes, setSelectedScopes] = useState<string[]>([]);
  const [expiresIn, setExpiresIn] = useState<string>("90");

  const keysQuery = trpc.apiAccess.listKeys.useQuery(undefined, {
    enabled: sub.canUse("api_access"),
    retry: false,
  });
  const scopesQuery = trpc.apiAccess.scopes.useQuery(undefined, {
    enabled: sub.canUse("api_access"),
    retry: false,
  });
  const createMutation = trpc.apiAccess.createKey.useMutation({
    onSuccess: (data) => {
      setNewKeyResult({ key: data.key, name: data.name });
      setShowCreate(false);
      setKeyName("");
      setSelectedScopes([]);
      keysQuery.refetch();
      toast.success("API key created");
    },
    onError: (err) => toast.error(err.message),
  });
  const revokeMutation = trpc.apiAccess.revokeKey.useMutation({
    onSuccess: () => {
      keysQuery.refetch();
      toast.success("API key revoked");
    },
    onError: (err) => toast.error(err.message),
  });

  if (!sub.canUse("api_access")) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">API Access</h1>
          <p className="text-muted-foreground mt-1">
            Programmatic access to your credentials via REST API.
          </p>
        </div>
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Key className="h-12 w-12 text-muted-foreground/40 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Pro Feature</h3>
            <p className="text-sm text-muted-foreground max-w-sm mb-4">
              API Access allows you to programmatically retrieve credentials
              using API keys with scoped permissions. Available on Pro and Enterprise plans.
            </p>
            <Button
              onClick={() => setShowUpgrade(true)}
              className="bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white"
            >
              Upgrade to Pro
            </Button>
          </CardContent>
        </Card>
        <UpgradeDialog
          open={showUpgrade}
          onOpenChange={setShowUpgrade}
          feature="API Access"
          requiredPlan="pro"
        />
      </div>
    );
  }

  if (keysQuery.isLoading) {
    return (
      <div className="flex items-center justify-center h-full py-20">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Loading API keys...</p>
        </div>
      </div>
    );
  }

  const activeKeys =
    keysQuery.data?.filter((k) => !k.revokedAt) || [];
  const revokedKeys =
    keysQuery.data?.filter((k) => k.revokedAt) || [];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <AffiliateRecommendations context="developer" variant="banner" />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">API Access</h1>
          <p className="text-muted-foreground mt-1">
            Manage API keys for programmatic access to your credentials.
          </p>
        </div>
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create API Key
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create API Key</DialogTitle>
              <DialogDescription>
                Generate a new API key with specific permissions.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Key Name</Label>
                <Input
                  placeholder="e.g. Production Server"
                  value={keyName}
                  onChange={(e) => setKeyName(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Permissions</Label>
                <div className="mt-2 space-y-2">
                  {scopesQuery.data?.map((scope) => (
                    <label
                      key={scope.id}
                      className="flex items-start gap-3 p-3 rounded-lg border hover:bg-accent/50 cursor-pointer transition-colors"
                    >
                      <Checkbox
                        checked={selectedScopes.includes(scope.id)}
                        onCheckedChange={(checked) => {
                          setSelectedScopes((prev) =>
                            checked
                              ? [...prev, scope.id]
                              : prev.filter((s) => s !== scope.id)
                          );
                        }}
                        className="mt-0.5"
                      />
                      <div>
                        <div className="text-sm font-medium">
                          {scope.label}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {scope.description}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <Label>Expiration</Label>
                <Select value={expiresIn} onValueChange={setExpiresIn}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="30">30 days</SelectItem>
                    <SelectItem value="90">90 days</SelectItem>
                    <SelectItem value="180">180 days</SelectItem>
                    <SelectItem value="365">1 year</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowCreate(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={() =>
                  createMutation.mutate({
                    name: keyName,
                    scopes: selectedScopes as any,
                    expiresInDays: parseInt(expiresIn),
                  })
                }
                disabled={
                  !keyName || selectedScopes.length === 0 || createMutation.isPending
                }
              >
                Create Key
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* New Key Result */}
      {newKeyResult && (
        <Card className="border-emerald-500/50 bg-emerald-500/5">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Check className="h-5 w-5 text-emerald-500" />
              <CardTitle className="text-base">
                API Key Created: {newKeyResult.name}
              </CardTitle>
            </div>
            <CardDescription>
              Copy this key now — it won't be shown again.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-background border rounded-lg px-3 py-2 text-sm font-mono break-all">
                {showKey
                  ? newKeyResult.key
                  : newKeyResult.key.substring(0, 11) + "•".repeat(40)}
              </code>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setShowKey(!showKey)}
              >
                {showKey ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => {
                  navigator.clipboard.writeText(newKeyResult.key);
                  toast.success("Copied to clipboard");
                }}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="mt-3 text-muted-foreground"
              onClick={() => setNewKeyResult(null)}
            >
              Dismiss
            </Button>
          </CardContent>
        </Card>
      )}

      {/* API Documentation */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Code className="h-4 w-4 text-primary" />
            <CardTitle className="text-base">Quick Start</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <pre className="bg-background border rounded-lg p-4 text-sm font-mono overflow-x-auto">
            <code>{`# List credentials
curl -H "Authorization: Bearer at_YOUR_KEY" \\
  ${window.location.origin}/api/v1/credentials

# Export as CSV
curl -H "Authorization: Bearer at_YOUR_KEY" \\
  "${window.location.origin}/api/v1/credentials/export?format=csv"`}</code>
          </pre>
        </CardContent>
      </Card>

      {/* Active Keys */}
      <div>
        <h2 className="text-lg font-semibold mb-3">
          Active Keys ({activeKeys.length})
        </h2>
        {activeKeys.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-8 text-center">
              <Key className="h-8 w-8 text-muted-foreground/40 mb-2" />
              <p className="text-sm text-muted-foreground">
                No active API keys. Create one to get started.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {activeKeys.map((key) => (
              <Card key={key.id}>
                <CardContent className="flex items-center justify-between py-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{key.name}</span>
                      <code className="text-xs bg-muted px-2 py-0.5 rounded font-mono">
                        {key.keyPrefix}...
                      </code>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Shield className="h-3 w-3" />
                        {(key.scopes as string[]).length} scope
                        {(key.scopes as string[]).length !== 1 ? "s" : ""}
                      </span>
                      <span className="flex items-center gap-1">
                        <Activity className="h-3 w-3" />
                        {key.usageCount} requests
                      </span>
                      {key.lastUsedAt && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Last used{" "}
                          {new Date(key.lastUsedAt).toLocaleDateString()}
                        </span>
                      )}
                      {key.expiresAt && (
                        <span className="flex items-center gap-1">
                          {new Date(key.expiresAt) < new Date() ? (
                            <AlertTriangle className="h-3 w-3 text-destructive" />
                          ) : (
                            <Clock className="h-3 w-3" />
                          )}
                          Expires{" "}
                          {new Date(key.expiresAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                    <div className="flex gap-1.5 flex-wrap">
                      {(key.scopes as string[]).map((scope) => (
                        <Badge
                          key={scope}
                          variant="secondary"
                          className="text-[10px]"
                        >
                          {scope}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive"
                    onClick={() => {
                      if (
                        confirm(
                          "Revoke this API key? Any applications using it will lose access."
                        )
                      ) {
                        revokeMutation.mutate({ keyId: key.id });
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Revoked Keys */}
      {revokedKeys.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3 text-muted-foreground">
            Revoked Keys ({revokedKeys.length})
          </h2>
          <div className="space-y-2 opacity-60">
            {revokedKeys.map((key) => (
              <Card key={key.id} className="border-dashed">
                <CardContent className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm line-through">{key.name}</span>
                    <code className="text-xs bg-muted px-2 py-0.5 rounded font-mono">
                      {key.keyPrefix}...
                    </code>
                    <Badge variant="destructive" className="text-[10px]">
                      Revoked
                    </Badge>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {key.revokedAt &&
                      new Date(key.revokedAt).toLocaleDateString()}
                  </span>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
