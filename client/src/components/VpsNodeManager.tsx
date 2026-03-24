/**
 * VpsNodeManager — Shared component for managing dedicated VPS nodes
 * across all security tools (Evilginx, BlackEye, Metasploit, ExploitPack).
 *
 * Each tool has its own tRPC router with identical node management procedures:
 *   listNodes, addNode, deployNode, checkNode, setActiveNode, removeNode
 *
 * This component is tool-agnostic — callers pass in the tRPC mutation/query
 * objects so the same UI works for every tool.
 */

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Server,
  Plus,
  Trash2,
  RefreshCw,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Key,
  FileText,
  Wifi,
  WifiOff,
  Zap,
  Star,
  Globe,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface VpsNode {
  id: string;
  label: string;
  sshHost: string;
  sshPort: number;
  sshUser: string;
  publicIp?: string;
  status: "pending" | "deploying" | "ready" | "running" | "offline" | "error";
  installed: boolean;
  running?: boolean;
  version?: string;
  lastChecked?: string;
  country?: string;
  addedAt: string;
  deployedAt?: string;
  errorMessage?: string;
}

export interface NodeManagerHooks {
  listNodes: { data?: { nodes: VpsNode[]; activeNodeId: string | null }; refetch: () => void; isLoading: boolean };
  addNode: { mutateAsync: (input: any) => Promise<any>; isPending: boolean };
  deployNode: { mutateAsync: (input: any) => Promise<any>; isPending: boolean };
  checkNode: { mutateAsync: (input: any) => Promise<any>; isPending: boolean };
  setActiveNode: { mutateAsync: (input: any) => Promise<any>; isPending: boolean };
  removeNode: { mutateAsync: (input: any) => Promise<any>; isPending: boolean };
}

interface VpsNodeManagerProps {
  open: boolean;
  onClose: () => void;
  hooks: NodeManagerHooks;
  toolName: string;
  accentColor: string; // tailwind color prefix e.g. "orange" | "red" | "blue" | "purple"
  deployLabel?: string; // e.g. "Deploy BlackEye" | "Install Metasploit"
}

// ─── Status badge helper ──────────────────────────────────────────────────────

function StatusBadge({ status }: { status: VpsNode["status"] }) {
  const map: Record<VpsNode["status"], { label: string; cls: string }> = {
    pending:   { label: "Pending",   cls: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30" },
    deploying: { label: "Deploying", cls: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
    ready:     { label: "Ready",     cls: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
    running:   { label: "Running",   cls: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30 animate-pulse" },
    offline:   { label: "Offline",   cls: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30" },
    error:     { label: "Error",     cls: "bg-red-500/20 text-red-400 border-red-500/30" },
  };
  const { label, cls } = map[status] ?? map.offline;
  return <Badge className={`text-xs ${cls}`}>{label}</Badge>;
}

// ─── Add Node Form ────────────────────────────────────────────────────────────

function AddNodeForm({
  onAdd,
  adding,
  accentColor,
}: {
  onAdd: (data: any) => Promise<void>;
  adding: boolean;
  accentColor: string;
}) {
  const [label, setLabel] = useState("");
  const [host, setHost] = useState("");
  const [port, setPort] = useState("22");
  const [user, setUser] = useState("root");
  const [authType, setAuthType] = useState<"password" | "key">("password");
  const [password, setPassword] = useState("");
  const [privateKey, setPrivateKey] = useState("");
  const [country, setCountry] = useState("");
  const [expanded, setExpanded] = useState(false);

  const handleSubmit = async () => {
    if (!host.trim()) { toast.error("Host / IP is required"); return; }
    if (!label.trim()) { toast.error("Node label is required"); return; }
    if (authType === "password" && !password.trim()) { toast.error("Password is required"); return; }
    if (authType === "key" && !privateKey.trim()) { toast.error("Private key is required"); return; }
    await onAdd({
      label: label.trim(),
      sshHost: host.trim(),
      sshPort: parseInt(port) || 22,
      sshUser: user.trim() || "root",
      sshPassword: authType === "password" ? password : undefined,
      sshKey: authType === "key" ? privateKey : undefined,
      country: country.trim() || undefined,
    });
    setLabel(""); setHost(""); setPort("22"); setUser("root");
    setPassword(""); setPrivateKey(""); setCountry("");
  };

  const btnCls = `bg-${accentColor}-600 hover:bg-${accentColor}-700`;

  return (
    <div className="border border-zinc-700 rounded-lg overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-4 py-3 bg-zinc-800/60 hover:bg-zinc-800 transition-colors text-left"
        onClick={() => setExpanded(e => !e)}
      >
        <span className="flex items-center gap-2 text-sm font-medium text-white">
          <Plus className="w-4 h-4" /> Add New VPS Node
        </span>
        {expanded ? <ChevronUp className="w-4 h-4 text-zinc-400" /> : <ChevronDown className="w-4 h-4 text-zinc-400" />}
      </button>

      {expanded && (
        <div className="p-4 space-y-3 bg-zinc-900/40">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-zinc-400 text-xs">Node Label</Label>
              <Input value={label} onChange={e => setLabel(e.target.value)} placeholder="e.g. US-East-1" className="bg-zinc-800 border-zinc-700 text-white h-8 text-sm mt-1" />
            </div>
            <div>
              <Label className="text-zinc-400 text-xs">Country (optional)</Label>
              <Input value={country} onChange={e => setCountry(e.target.value)} placeholder="e.g. US" className="bg-zinc-800 border-zinc-700 text-white h-8 text-sm mt-1" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <Label className="text-zinc-400 text-xs">Host / IP</Label>
              <Input value={host} onChange={e => setHost(e.target.value)} placeholder="123.45.67.89" className="bg-zinc-800 border-zinc-700 text-white h-8 text-sm mt-1" />
            </div>
            <div>
              <Label className="text-zinc-400 text-xs">SSH Port</Label>
              <Input value={port} onChange={e => setPort(e.target.value)} placeholder="22" className="bg-zinc-800 border-zinc-700 text-white h-8 text-sm mt-1" />
            </div>
          </div>
          <div>
            <Label className="text-zinc-400 text-xs">SSH Username</Label>
            <Input value={user} onChange={e => setUser(e.target.value)} placeholder="root" className="bg-zinc-800 border-zinc-700 text-white h-8 text-sm mt-1" />
          </div>
          <div>
            <Label className="text-zinc-400 text-xs">Authentication</Label>
            <div className="flex gap-2 mt-1">
              <Button size="sm" variant={authType === "password" ? "default" : "outline"} onClick={() => setAuthType("password")} className={`h-7 text-xs ${authType === "password" ? btnCls : "border-zinc-700"}`}>
                <Key className="w-3 h-3 mr-1" /> Password
              </Button>
              <Button size="sm" variant={authType === "key" ? "default" : "outline"} onClick={() => setAuthType("key")} className={`h-7 text-xs ${authType === "key" ? btnCls : "border-zinc-700"}`}>
                <FileText className="w-3 h-3 mr-1" /> SSH Key
              </Button>
            </div>
          </div>
          {authType === "password" ? (
            <div>
              <Label className="text-zinc-400 text-xs">Password</Label>
              <Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="SSH password" className="bg-zinc-800 border-zinc-700 text-white h-8 text-sm mt-1" />
            </div>
          ) : (
            <div>
              <Label className="text-zinc-400 text-xs">Private Key</Label>
              <textarea value={privateKey} onChange={e => setPrivateKey(e.target.value)} placeholder="-----BEGIN OPENSSH PRIVATE KEY-----" className="w-full h-20 bg-zinc-800 border border-zinc-700 text-white text-xs rounded-md p-2 font-mono resize-none mt-1" />
            </div>
          )}
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-md p-2 text-xs text-amber-300/80">
            <AlertTriangle className="w-3 h-3 inline mr-1" />
            Credentials are AES-256 encrypted at rest. Use a fresh VPS with a dedicated IP.
          </div>
          <Button onClick={handleSubmit} disabled={adding} className={`w-full ${btnCls}`} size="sm">
            {adding ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
            Add Node
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Node Row ─────────────────────────────────────────────────────────────────

function NodeRow({
  node,
  isActive,
  onSetActive,
  onDeploy,
  onCheck,
  onRemove,
  deploying,
  checking,
  accentColor,
}: {
  node: VpsNode;
  isActive: boolean;
  onSetActive: () => void;
  onDeploy: () => void;
  onCheck: () => void;
  onRemove: () => void;
  deploying: boolean;
  checking: boolean;
  accentColor: string;
}) {
  const btnCls = `bg-${accentColor}-600 hover:bg-${accentColor}-700`;

  return (
    <div className={`border rounded-lg p-3 space-y-2 ${isActive ? `border-${accentColor}-500/40 bg-${accentColor}-500/5` : "border-zinc-700 bg-zinc-800/30"}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {isActive && <Star className={`w-3.5 h-3.5 text-${accentColor}-400 flex-shrink-0`} />}
          <div className="min-w-0">
            <p className="text-white text-sm font-medium truncate">{node.label}</p>
            <p className="text-zinc-500 text-xs font-mono truncate">{node.publicIp ?? node.sshHost}:{node.sshPort}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <StatusBadge status={node.status} />
          {node.country && (
            <Badge className="bg-zinc-700/50 text-zinc-400 border-zinc-600/30 text-xs">
              <Globe className="w-2.5 h-2.5 mr-1" />{node.country}
            </Badge>
          )}
        </div>
      </div>

      {node.errorMessage && (
        <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded px-2 py-1">
          <XCircle className="w-3 h-3 inline mr-1" />{node.errorMessage}
        </p>
      )}

      <div className="flex items-center gap-1.5 flex-wrap">
        {!isActive && (
          <Button size="sm" variant="outline" className="border-zinc-600 h-6 text-xs px-2" onClick={onSetActive}>
            <Star className="w-3 h-3 mr-1" /> Set Active
          </Button>
        )}
        {!node.installed && node.status !== "deploying" && (
          <Button size="sm" className={`h-6 text-xs px-2 ${btnCls}`} onClick={onDeploy} disabled={deploying}>
            {deploying ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Zap className="w-3 h-3 mr-1" />}
            Deploy
          </Button>
        )}
        {node.status === "deploying" && (
          <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-xs">
            <Loader2 className="w-3 h-3 animate-spin mr-1" /> Deploying…
          </Badge>
        )}
        {node.installed && (
          <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs">
            <CheckCircle2 className="w-3 h-3 mr-1" /> Installed
          </Badge>
        )}
        <Button size="sm" variant="outline" className="border-zinc-600 h-6 text-xs px-2" onClick={onCheck} disabled={checking}>
          {checking ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <RefreshCw className="w-3 h-3 mr-1" />}
          Check
        </Button>
        <Button size="sm" variant="outline" className="border-red-800/50 text-red-400 hover:bg-red-500/10 h-6 text-xs px-2" onClick={onRemove}>
          <Trash2 className="w-3 h-3" />
        </Button>
      </div>

      {node.lastChecked && (
        <p className="text-zinc-600 text-xs">Last checked: {new Date(node.lastChecked).toLocaleString()}</p>
      )}
    </div>
  );
}

// ─── Main Dialog ──────────────────────────────────────────────────────────────

export default function VpsNodeManager({
  open,
  onClose,
  hooks,
  toolName,
  accentColor,
  deployLabel,
}: VpsNodeManagerProps) {
  const { listNodes, addNode, deployNode, checkNode, setActiveNode, removeNode } = hooks;
  const [deployingId, setDeployingId] = useState<string | null>(null);
  const [checkingId, setCheckingId] = useState<string | null>(null);

  const nodes = listNodes.data?.nodes ?? [];
  const activeNodeId = listNodes.data?.activeNodeId ?? null;

  const handleAdd = async (data: any) => {
    try {
      await addNode.mutateAsync(data);
      toast.success(`Node "${data.label}" added`);
      listNodes.refetch();
    } catch (err: any) {
      toast.error(err.message ?? "Failed to add node");
    }
  };

  const handleDeploy = async (nodeId: string, label: string) => {
    setDeployingId(nodeId);
    try {
      toast.loading(`Deploying ${toolName} on "${label}"…`, { id: `deploy-${nodeId}` });
      const result = await deployNode.mutateAsync({ nodeId });
      if (result.success) {
        toast.success(result.message ?? `${toolName} deployed on "${label}"`, { id: `deploy-${nodeId}` });
      } else {
        toast.error(result.message ?? "Deployment failed", { id: `deploy-${nodeId}` });
      }
      listNodes.refetch();
    } catch (err: any) {
      toast.error(err.message ?? "Deploy failed", { id: `deploy-${nodeId}` });
    } finally {
      setDeployingId(null);
    }
  };

  const handleCheck = async (nodeId: string) => {
    setCheckingId(nodeId);
    try {
      const result = await checkNode.mutateAsync({ nodeId });
      toast.info(result.message ?? "Check complete");
      listNodes.refetch();
    } catch (err: any) {
      toast.error(err.message ?? "Check failed");
    } finally {
      setCheckingId(null);
    }
  };

  const handleSetActive = async (nodeId: string) => {
    try {
      await setActiveNode.mutateAsync({ nodeId });
      toast.success("Active node updated");
      listNodes.refetch();
    } catch (err: any) {
      toast.error(err.message ?? "Failed to set active node");
    }
  };

  const handleRemove = async (nodeId: string, label: string) => {
    if (!confirm(`Remove node "${label}"? This cannot be undone.`)) return;
    try {
      await removeNode.mutateAsync({ nodeId });
      toast.success(`Node "${label}" removed`);
      listNodes.refetch();
    } catch (err: any) {
      toast.error(err.message ?? "Failed to remove node");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-zinc-900 border-zinc-800 max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <Server className={`w-5 h-5 text-${accentColor}-400`} />
            {toolName} — VPS Node Manager
          </DialogTitle>
          <DialogDescription>
            {toolName} requires a dedicated VPS with its own IP address. Add a node below,
            then click Deploy to install {toolName} on it automatically via SSH.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Node list */}
          {listNodes.isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
            </div>
          ) : nodes.length === 0 ? (
            <div className="text-center py-8 border border-dashed border-zinc-700 rounded-lg">
              <WifiOff className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
              <p className="text-zinc-400 text-sm font-medium">No VPS nodes yet</p>
              <p className="text-zinc-600 text-xs mt-1">Add a node below to get started</p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-zinc-500 font-medium uppercase tracking-wide">
                {nodes.length} node{nodes.length !== 1 ? "s" : ""} · {nodes.filter(n => n.installed).length} installed
              </p>
              {nodes.map(node => (
                <NodeRow
                  key={node.id}
                  node={node}
                  isActive={node.id === activeNodeId}
                  onSetActive={() => handleSetActive(node.id)}
                  onDeploy={() => handleDeploy(node.id, node.label)}
                  onCheck={() => handleCheck(node.id)}
                  onRemove={() => handleRemove(node.id, node.label)}
                  deploying={deployingId === node.id}
                  checking={checkingId === node.id}
                  accentColor={accentColor}
                />
              ))}
            </div>
          )}

          {/* Add node form */}
          <AddNodeForm onAdd={handleAdd} adding={addNode.isPending} accentColor={accentColor} />

          {/* Info box */}
          <div className="bg-zinc-800/40 border border-zinc-700/50 rounded-lg p-3 text-xs text-zinc-500 space-y-1">
            <p className="text-zinc-400 font-medium">How it works</p>
            <p>1. Add a fresh VPS (any provider — Vultr, DigitalOcean, Hetzner, etc.)</p>
            <p>2. Click <strong className="text-zinc-300">Deploy</strong> — Titan SSHes in and installs {toolName} automatically</p>
            <p>3. The node becomes your active {toolName} server — all operations run on it</p>
            <p>4. Add multiple nodes for campaign isolation or geographic diversity</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
