/**
 * Proxy Maker Page — Multi-VPS rotating proxy pool
 * Each proxy node is a separate VPS with its own unique IP.
 */
import React, { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Server,
  Plus,
  Trash2,
  RefreshCw,
  Play,
  CheckCircle,
  XCircle,
  Clock,
  Globe,
  Download,
  ToggleLeft,
  ToggleRight,
  Wifi,
  Copy,
  AlertTriangle,
  Key,
  FileText,
  Shield,
  Zap,
} from "lucide-react";

interface AddNodeDialogProps {
  open: boolean;
  onClose: () => void;
  onAdded: () => void;
}

function AddNodeDialog({ open, onClose, onAdded }: AddNodeDialogProps) {
  const [label, setLabel] = useState("");
  const [sshHost, setSshHost] = useState("");
  const [sshPort, setSshPort] = useState("22");
  const [sshUser, setSshUser] = useState("root");
  const [authType, setAuthType] = useState<"password" | "key">("password");
  const [sshPassword, setSshPassword] = useState("");
  const [sshKey, setSshKey] = useState("");
  const [country, setCountry] = useState("");
  const [socks5Port, setSocks5Port] = useState("1080");
  const [httpPort, setHttpPort] = useState("3128");

  const addNode = trpc.proxyMaker.addNode.useMutation();

  const handleAdd = async () => {
    if (!label || !sshHost) {
      toast.error("Label and host are required");
      return;
    }
    try {
      await addNode.mutateAsync({
        label,
        sshHost,
        sshPort: parseInt(sshPort) || 22,
        sshUser,
        sshPassword: authType === "password" ? sshPassword : undefined,
        sshKey: authType === "key" ? sshKey : undefined,
        country: country || undefined,
      });
      toast.success(`Node "${label}" added`);
      onAdded();
      onClose();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-zinc-900 border-zinc-800 max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <Server className="w-5 h-5 text-violet-400" /> Add Proxy Node
          </DialogTitle>
          <DialogDescription>
            Each node is a separate VPS with its own unique IP. Credentials are
            AES-256 encrypted.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-zinc-400">Node Label</Label>
              <Input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="US East Node 1"
                className="bg-zinc-800 border-zinc-700 text-white"
              />
            </div>
            <div>
              <Label className="text-zinc-400">Country (optional)</Label>
              <Input
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                placeholder="US"
                className="bg-zinc-800 border-zinc-700 text-white"
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <Label className="text-zinc-400">Host / IP</Label>
              <Input
                value={sshHost}
                onChange={(e) => setSshHost(e.target.value)}
                placeholder="123.45.67.89"
                className="bg-zinc-800 border-zinc-700 text-white"
              />
            </div>
            <div>
              <Label className="text-zinc-400">SSH Port</Label>
              <Input
                value={sshPort}
                onChange={(e) => setSshPort(e.target.value)}
                placeholder="22"
                className="bg-zinc-800 border-zinc-700 text-white"
              />
            </div>
          </div>
          <div>
            <Label className="text-zinc-400">SSH Username</Label>
            <Input
              value={sshUser}
              onChange={(e) => setSshUser(e.target.value)}
              placeholder="root"
              className="bg-zinc-800 border-zinc-700 text-white"
            />
          </div>
          <div>
            <Label className="text-zinc-400">Authentication</Label>
            <div className="flex gap-2 mt-1">
              <Button
                size="sm"
                variant={authType === "password" ? "default" : "outline"}
                onClick={() => setAuthType("password")}
                className={
                  authType === "password" ? "bg-violet-600" : "border-zinc-700"
                }
              >
                <Key className="w-3 h-3 mr-1" /> Password
              </Button>
              <Button
                size="sm"
                variant={authType === "key" ? "default" : "outline"}
                onClick={() => setAuthType("key")}
                className={
                  authType === "key" ? "bg-violet-600" : "border-zinc-700"
                }
              >
                <FileText className="w-3 h-3 mr-1" /> SSH Key
              </Button>
            </div>
          </div>
          {authType === "password" ? (
            <div>
              <Label className="text-zinc-400">Password</Label>
              <Input
                type="password"
                value={sshPassword}
                onChange={(e) => setSshPassword(e.target.value)}
                placeholder="SSH password"
                className="bg-zinc-800 border-zinc-700 text-white"
              />
            </div>
          ) : (
            <div>
              <Label className="text-zinc-400">Private Key</Label>
              <textarea
                value={sshKey}
                onChange={(e) => setSshKey(e.target.value)}
                placeholder="-----BEGIN OPENSSH PRIVATE KEY-----"
                className="w-full h-24 bg-zinc-800 border border-zinc-700 text-white text-xs rounded-md p-2 font-mono resize-none"
              />
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-zinc-400">SOCKS5 Port</Label>
              <Input
                value={socks5Port}
                onChange={(e) => setSocks5Port(e.target.value)}
                placeholder="1080"
                className="bg-zinc-800 border-zinc-700 text-white"
              />
            </div>
            <div>
              <Label className="text-zinc-400">HTTP Port</Label>
              <Input
                value={httpPort}
                onChange={(e) => setHttpPort(e.target.value)}
                placeholder="3128"
                className="bg-zinc-800 border-zinc-700 text-white"
              />
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              className="border-zinc-700 flex-1"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              className="bg-violet-600 hover:bg-violet-700 flex-1"
              onClick={handleAdd}
              disabled={addNode.isPending || !label || !sshHost}
            >
              {addNode.isPending ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Plus className="w-4 h-4 mr-2" />
              )}{" "}
              Add Node
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "online")
    return (
      <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
        <CheckCircle className="w-3 h-3 mr-1" />
        Online
      </Badge>
    );
  if (status === "deploying")
    return (
      <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 animate-pulse">
        <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
        Deploying
      </Badge>
    );
  if (status === "error")
    return (
      <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
        <XCircle className="w-3 h-3 mr-1" />
        Error
      </Badge>
    );
  return (
    <Badge className="bg-zinc-500/20 text-zinc-400 border-zinc-500/30">
      <Clock className="w-3 h-3 mr-1" />
      Pending
    </Badge>
  );
}

export default function ProxyMakerPage() {
  const [showAddNode, setShowAddNode] = useState(false);
  const [activeTab, setActiveTab] = useState("nodes");

  const nodesQuery = trpc.proxyMaker.listNodes.useQuery();
  const nextProxyQuery = trpc.proxyMaker.getNextProxy.useQuery();
  const exportQuery = trpc.proxyMaker.exportProxies.useQuery({
    type: "all",
    onlineOnly: true,
  });

  const deployNode = trpc.proxyMaker.deployNode.useMutation({
    onSuccess: () => nodesQuery.refetch(),
  });
  const checkNode = trpc.proxyMaker.checkNode.useMutation({
    onSuccess: () => nodesQuery.refetch(),
  });
  const checkAllNodes = trpc.proxyMaker.checkAllNodes.useMutation({
    onSuccess: () => nodesQuery.refetch(),
  });
  const stopNode = trpc.proxyMaker.stopNode.useMutation({
    onSuccess: () => nodesQuery.refetch(),
  });
  const removeNode = trpc.proxyMaker.removeNode.useMutation({
    onSuccess: () => nodesQuery.refetch(),
  });
  const testProxy = trpc.proxyMaker.testProxy.useMutation();
  const setRotation = trpc.proxyMaker.setRotation.useMutation({
    onSuccess: () => nodesQuery.refetch(),
  });

  const nodes = nodesQuery.data?.nodes ?? [];
  const rotationEnabled = nodesQuery.data?.rotationEnabled ?? false;
  const onlineCount = nodes.filter((n: any) => n.status === "online").length;

  const handleDeploy = async (nodeId: string) => {
    try {
      toast.loading("Deploying proxy...", { id: `d-${nodeId}` });
      const r = await deployNode.mutateAsync({ nodeId });
      toast.success(r.message, { id: `d-${nodeId}` });
    } catch (err: any) {
      toast.error(err.message, { id: `d-${nodeId}` });
    }
  };

  const handleCheck = async (nodeId: string) => {
    try {
      const r = await checkNode.mutateAsync({ nodeId });
      toast.success(r.message);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleTest = async (nodeId: string) => {
    try {
      toast.loading("Testing...", { id: `t-${nodeId}` });
      const r = await testProxy.mutateAsync({ nodeId });
      if (r.success) toast.success(r.message, { id: `t-${nodeId}` });
      else toast.error(r.message, { id: `t-${nodeId}` });
    } catch (err: any) {
      toast.error(err.message, { id: `t-${nodeId}` });
    }
  };

  const handleStop = async (nodeId: string) => {
    try {
      const r = await stopNode.mutateAsync({ nodeId });
      toast.success(r.message);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleRemove = async (nodeId: string, label: string) => {
    if (!confirm(`Remove node "${label}"?`)) return;
    try {
      await removeNode.mutateAsync({ nodeId });
      toast.success(`Node "${label}" removed`);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleCheckAll = async () => {
    try {
      toast.loading("Checking all nodes...", { id: "ca" });
      const r = await checkAllNodes.mutateAsync();
      toast.success(r.message, { id: "ca" });
    } catch (err: any) {
      toast.error(err.message, { id: "ca" });
    }
  };

  const handleCopyExport = () => {
    if (exportQuery.data?.list) {
      navigator.clipboard.writeText(exportQuery.data.list);
      toast.success("Proxy list copied");
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="bg-violet-500/10 rounded-xl p-3">
            <Globe className="w-8 h-8 text-violet-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              Proxy Maker{" "}
              <Badge className="bg-violet-500/20 text-violet-400 border-violet-500/30 text-xs">
                Multi-Node
              </Badge>
            </h1>
            <p className="text-zinc-500">
              {onlineCount} of {nodes.length} nodes online — each with a unique
              IP
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="border-zinc-700"
            onClick={handleCheckAll}
            disabled={checkAllNodes.isPending || nodes.length === 0}
          >
            {checkAllNodes.isPending ? (
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-2" />
            )}{" "}
            Check All
          </Button>
          <Button
            className="bg-violet-600 hover:bg-violet-700"
            onClick={() => setShowAddNode(true)}
          >
            <Plus className="w-4 h-4 mr-2" /> Add Node
          </Button>
        </div>
      </div>

      {/* Warning */}
      <Card className="bg-amber-500/5 border-amber-500/20">
        <CardContent className="p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-amber-300/80">
            <strong className="text-amber-300">Authorised Use Only.</strong>{" "}
            Only use proxies for lawful purposes. Misuse for fraud, spam, or
            unauthorised access is illegal.
          </p>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Nodes", value: nodes.length, color: "text-white" },
          {
            label: "Online",
            value: onlineCount,
            color: "text-emerald-400",
          },
          {
            label: "Deployed",
            value: nodes.filter((n: any) => n.deployed).length,
            color: "text-violet-400",
          },
          {
            label: "Rotation",
            value: rotationEnabled ? "ON" : "OFF",
            color: rotationEnabled ? "text-emerald-400" : "text-zinc-500",
          },
        ].map((s) => (
          <Card key={s.label} className="bg-zinc-900 border-zinc-800">
            <CardContent className="p-4 text-center">
              <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
              <div className="text-xs text-zinc-500 mt-1">{s.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-zinc-900 border border-zinc-800">
          <TabsTrigger value="nodes">Nodes</TabsTrigger>
          <TabsTrigger value="rotation">Rotation</TabsTrigger>
          <TabsTrigger value="export">Export</TabsTrigger>
        </TabsList>

        {/* Nodes Tab */}
        <TabsContent value="nodes" className="space-y-4 mt-4">
          {nodesQuery.isLoading ? (
            <div className="text-center py-12 text-zinc-500">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
              Loading nodes...
            </div>
          ) : nodes.length === 0 ? (
            <Card className="bg-zinc-900 border-zinc-800 border-dashed">
              <CardContent className="p-12 text-center">
                <Globe className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
                <h3 className="text-white font-semibold mb-2">
                  No proxy nodes yet
                </h3>
                <p className="text-zinc-500 text-sm mb-4">
                  Add a VPS server to create your first proxy node with a unique
                  IP address.
                </p>
                <Button
                  className="bg-violet-600 hover:bg-violet-700"
                  onClick={() => setShowAddNode(true)}
                >
                  <Plus className="w-4 h-4 mr-2" /> Add First Node
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {nodes.map((node: any) => (
                <Card key={node.id} className="bg-zinc-900 border-zinc-800">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between flex-wrap gap-3">
                      <div className="flex items-center gap-3">
                        <div className="bg-violet-500/10 rounded-lg p-2">
                          <Server className="w-5 h-5 text-violet-400" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-white font-medium">
                              {node.label}
                            </span>
                            {node.country && (
                              <Badge className="bg-zinc-800 text-zinc-400 border-zinc-700 text-xs">
                                {node.country}
                              </Badge>
                            )}
                            <StatusBadge status={node.status} />
                          </div>
                          <div className="text-xs text-zinc-500 mt-0.5 font-mono">
                            {node.publicIp
                              ? `${node.publicIp} — SOCKS5:${node.socks5Port} HTTP:${node.httpPort}`
                              : `${node.sshHost}:${node.sshPort}`}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {!node.deployed ? (
                          <Button
                            size="sm"
                            className="bg-violet-600 hover:bg-violet-700"
                            onClick={() => handleDeploy(node.id)}
                            disabled={deployNode.isPending}
                          >
                            <Play className="w-3 h-3 mr-1" /> Deploy
                          </Button>
                        ) : (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-zinc-700"
                              onClick={() => handleCheck(node.id)}
                              disabled={checkNode.isPending}
                            >
                              <RefreshCw className="w-3 h-3 mr-1" /> Check
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-zinc-700"
                              onClick={() => handleTest(node.id)}
                              disabled={testProxy.isPending}
                            >
                              <Wifi className="w-3 h-3 mr-1" /> Test
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-red-700 text-red-400"
                              onClick={() => handleStop(node.id)}
                              disabled={stopNode.isPending}
                            >
                              Stop
                            </Button>
                          </>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-red-800 text-red-500 hover:bg-red-500/10"
                          onClick={() => handleRemove(node.id, node.label)}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                    {node.lastError && (
                      <div className="mt-2 text-xs text-red-400 bg-red-500/10 rounded p-2 font-mono">
                        {node.lastError}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Rotation Tab */}
        <TabsContent value="rotation" className="space-y-4 mt-4">
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Zap className="w-5 h-5 text-violet-400" /> IP Rotation
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-zinc-800/50 rounded-lg">
                <div>
                  <div className="text-white font-medium">Auto-Rotation</div>
                  <div className="text-zinc-500 text-sm">
                    Automatically cycle through all online proxy nodes
                  </div>
                </div>
                <Button
                  variant="outline"
                  className={
                    rotationEnabled
                      ? "border-emerald-600 text-emerald-400"
                      : "border-zinc-700"
                  }
                  onClick={() =>
                    setRotation.mutate({ enabled: !rotationEnabled })
                  }
                  disabled={setRotation.isPending}
                >
                  {rotationEnabled ? (
                    <ToggleRight className="w-5 h-5 mr-2" />
                  ) : (
                    <ToggleLeft className="w-5 h-5 mr-2" />
                  )}
                  {rotationEnabled ? "Enabled" : "Disabled"}
                </Button>
              </div>
              {nextProxyQuery.data?.proxy && (
                <div className="p-4 bg-zinc-800/50 rounded-lg">
                  <div className="text-zinc-400 text-sm mb-2">
                    Next Proxy in Rotation
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className="bg-violet-500/20 text-violet-400 border-violet-500/30 font-mono">
                      {nextProxyQuery.data.proxy.host}:
                      {nextProxyQuery.data.proxy.socks5Port}
                    </Badge>
                    <span className="text-zinc-500 text-sm">
                      {nextProxyQuery.data.proxy.label}
                    </span>
                    {nextProxyQuery.data.proxy.country && (
                      <Badge className="bg-zinc-800 text-zinc-400 border-zinc-700 text-xs">
                        {nextProxyQuery.data.proxy.country}
                      </Badge>
                    )}
                  </div>
                </div>
              )}
              <div className="p-4 bg-blue-500/5 border border-blue-500/20 rounded-lg">
                <div className="flex items-start gap-2">
                  <Shield className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-blue-300/80">
                    <strong className="text-blue-300">How it works:</strong>{" "}
                    Each request routes through a different VPS node in
                    round-robin order. No single IP is used twice in a row —
                    extremely difficult to track or block.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Export Tab */}
        <TabsContent value="export" className="space-y-4 mt-4">
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Download className="w-5 h-5 text-violet-400" /> Export Proxy
                List
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {!exportQuery.data?.count ? (
                <div className="text-center py-8 text-zinc-500">
                  No online nodes to export. Deploy nodes first.
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-400 text-sm">
                      {exportQuery.data.count} online nodes
                    </span>
                    <Button
                      variant="outline"
                      className="border-zinc-700"
                      onClick={handleCopyExport}
                    >
                      <Copy className="w-4 h-4 mr-2" /> Copy All
                    </Button>
                  </div>
                  <pre className="bg-zinc-800/50 rounded-lg p-4 text-xs text-zinc-300 font-mono overflow-x-auto max-h-64 overflow-y-auto">
                    {exportQuery.data.list || "No proxies available"}
                  </pre>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <AddNodeDialog
        open={showAddNode}
        onClose={() => setShowAddNode(false)}
        onAdded={() => nodesQuery.refetch()}
      />
    </div>
  );
}
