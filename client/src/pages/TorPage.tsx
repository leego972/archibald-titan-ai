/**
 * Tor Browser Page — Ultra-fast Tor with dedicated VPS nodes
 * Reverse-connection firewall, circuit racing, guard pinning
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  Globe, Plus, Trash2, Play, Square, RefreshCw, CheckCircle, XCircle,
  Clock, Loader2, Star, Shield, Zap, Lock, RotateCcw,
} from "lucide-react";

function statusBadge(status: string) {
  switch (status) {
    case "ready": return <Badge className="bg-green-500/20 text-green-400 border-green-500/30"><CheckCircle className="w-3 h-3 mr-1" />Ready</Badge>;
    case "deploying": return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30"><Loader2 className="w-3 h-3 mr-1 animate-spin" />Deploying</Badge>;
    case "running": return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30"><CheckCircle className="w-3 h-3 mr-1" />Running</Badge>;
    case "offline": return <Badge className="bg-red-500/20 text-red-400 border-red-500/30"><XCircle className="w-3 h-3 mr-1" />Offline</Badge>;
    case "error": return <Badge className="bg-red-500/20 text-red-400 border-red-500/30"><XCircle className="w-3 h-3 mr-1" />Error</Badge>;
    default: return <Badge className="bg-zinc-500/20 text-zinc-400 border-zinc-500/30"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
  }
}

export default function TorPage() {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.tor.listNodes.useQuery();
  const statusQuery = trpc.tor.getStatus.useQuery();

  const addNode = trpc.tor.addNode.useMutation({ onSuccess: () => { utils.tor.listNodes.invalidate(); toast.success("Node added"); setAddOpen(false); resetForm(); } });
  const deployNode = trpc.tor.deployNode.useMutation({ onSuccess: (r) => { utils.tor.listNodes.invalidate(); utils.tor.getStatus.invalidate(); r.success ? toast.success(r.message) : toast.error(r.message); } });
  const checkNode = trpc.tor.checkNode.useMutation({ onSuccess: (r) => { utils.tor.listNodes.invalidate(); utils.tor.getStatus.invalidate(); toast.info(r.message); } });
  const setActive = trpc.tor.setActiveNode.useMutation({ onSuccess: () => { utils.tor.listNodes.invalidate(); utils.tor.getStatus.invalidate(); toast.success("Active node updated"); } });
  const removeNode = trpc.tor.removeNode.useMutation({ onSuccess: (r) => { utils.tor.listNodes.invalidate(); toast.success(r.message); } });
  const startTor = trpc.tor.startTor.useMutation({ onSuccess: (r) => { utils.tor.getStatus.invalidate(); r.success ? toast.success(r.message) : toast.error(r.message); } });
  const stopTor = trpc.tor.stopTor.useMutation({ onSuccess: (r) => { utils.tor.getStatus.invalidate(); r.success ? toast.success(r.message) : toast.error(r.message); } });
  const newCircuit = trpc.tor.newCircuit.useMutation({ onSuccess: (r) => { utils.tor.getStatus.invalidate(); r.success ? toast.success(r.message) : toast.error(r.message); } });
  const toggleFirewall = trpc.tor.toggleFirewall.useMutation({ onSuccess: (r) => { utils.tor.getStatus.invalidate(); toast.success(r.message); } });

  const [addOpen, setAddOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [sshHost, setSshHost] = useState("");
  const [sshPort, setSshPort] = useState("22");
  const [sshUser, setSshUser] = useState("root");
  const [sshPassword, setSshPassword] = useState("");
  const [sshKey, setSshKey] = useState("");
  const [country, setCountry] = useState("");

  const resetForm = () => { setLabel(""); setSshHost(""); setSshPort("22"); setSshUser("root"); setSshPassword(""); setSshKey(""); setCountry(""); };

  const nodes = data?.nodes ?? [];
  const activeId = data?.activeNodeId;
  const status = statusQuery.data;

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/10 rounded-lg border border-purple-500/20">
              <Globe className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Tor Browser</h1>
              <p className="text-zinc-400 text-sm">Ultra-fast anonymous browsing — dedicated VPS nodes</p>
            </div>
          </div>
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button className="bg-purple-600 hover:bg-purple-700 gap-2"><Plus className="w-4 h-4" />Add Node</Button>
            </DialogTrigger>
            <DialogContent className="bg-zinc-900 border-zinc-800 text-white max-w-md">
              <DialogHeader><DialogTitle>Add Tor Node</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-300 text-sm">
                  <Lock className="w-4 h-4 inline mr-2" />Use a <strong>dedicated VPS</strong> — never your main server.
                </div>
                <div className="space-y-2"><Label>Node Label</Label><Input placeholder="e.g. Tor-Node-DE" value={label} onChange={e => setLabel(e.target.value)} className="bg-zinc-800 border-zinc-700" /></div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2 space-y-2"><Label>Server IP / Hostname</Label><Input placeholder="123.45.67.89" value={sshHost} onChange={e => setSshHost(e.target.value)} className="bg-zinc-800 border-zinc-700" /></div>
                  <div className="space-y-2"><Label>SSH Port</Label><Input placeholder="22" value={sshPort} onChange={e => setSshPort(e.target.value)} className="bg-zinc-800 border-zinc-700" /></div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-2"><Label>SSH User</Label><Input placeholder="root" value={sshUser} onChange={e => setSshUser(e.target.value)} className="bg-zinc-800 border-zinc-700" /></div>
                  <div className="space-y-2"><Label>Country</Label><Input placeholder="DE" value={country} onChange={e => setCountry(e.target.value)} className="bg-zinc-800 border-zinc-700" /></div>
                </div>
                <div className="space-y-2"><Label>SSH Password</Label><Input type="password" placeholder="Leave blank if using SSH key" value={sshPassword} onChange={e => setSshPassword(e.target.value)} className="bg-zinc-800 border-zinc-700" /></div>
                <div className="space-y-2"><Label>SSH Private Key (optional)</Label><Textarea placeholder="-----BEGIN OPENSSH PRIVATE KEY-----" value={sshKey} onChange={e => setSshKey(e.target.value)} className="bg-zinc-800 border-zinc-700 h-20 font-mono text-xs" /></div>
                <Button onClick={() => addNode.mutate({ label, sshHost, sshPort: parseInt(sshPort), sshUser, sshPassword: sshPassword || undefined, sshKey: sshKey || undefined, country: country || undefined })} disabled={addNode.isPending || !label || !sshHost} className="w-full bg-purple-600 hover:bg-purple-700">
                  {addNode.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Adding...</> : "Add Node"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-xl text-sm text-zinc-400 flex gap-3">
          <Shield className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
          <div><span className="text-purple-400 font-medium">Maximum anonymity</span> — Tor runs on your dedicated VPS, not on the Titan platform. Guard node pinning, circuit racing (3 parallel), bandwidth relay filtering, reverse-connection firewall (iptables kill-switch).</div>
        </div>

        {status?.status === "running" && (
          <Card className="bg-zinc-900 border-purple-500/30">
            <CardContent className="p-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                  <div>
                    <p className="font-medium text-green-400">Tor is running</p>
                    <p className="text-sm text-zinc-400">
                      {status.nodeLabel && `Node: ${status.nodeLabel}`}
                      {status.torIp && <span className="ml-3">Exit IP: <span className="font-mono text-white">{status.torIp}</span></span>}
                      {status.firewallEnabled && <span className="ml-3 text-green-400">Firewall active</span>}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => newCircuit.mutate()} disabled={newCircuit.isPending} className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 gap-1">
                    {newCircuit.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}New Circuit
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => toggleFirewall.mutate({ enabled: !status.firewallEnabled })} disabled={toggleFirewall.isPending} className={`border-zinc-700 hover:bg-zinc-800 gap-1 ${status.firewallEnabled ? "text-green-400" : "text-red-400"}`}>
                    <Shield className="w-3 h-3" />{status.firewallEnabled ? "Firewall On" : "Firewall Off"}
                  </Button>
                  <Button size="sm" onClick={() => stopTor.mutate()} disabled={stopTor.isPending} className="bg-red-600 hover:bg-red-700 gap-1">
                    {stopTor.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Square className="w-3 h-3" />}Stop
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-zinc-500" /></div>
        ) : nodes.length === 0 ? (
          <div className="text-center py-16 space-y-4">
            <Globe className="w-16 h-16 text-zinc-700 mx-auto" />
            <p className="text-zinc-400 text-lg">No Tor nodes yet</p>
            <p className="text-zinc-600 text-sm">Add a dedicated VPS to run Tor. Each node is isolated with its own IP and firewall.</p>
            <Button onClick={() => setAddOpen(true)} className="bg-purple-600 hover:bg-purple-700 gap-2"><Plus className="w-4 h-4" />Add Your First Node</Button>
          </div>
        ) : (
          <div className="space-y-3">
            {nodes.map((node: any) => (
              <Card key={node.id} className={`bg-zinc-900 border-zinc-800 ${activeId === node.id ? "ring-1 ring-purple-500/50" : ""}`}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      {activeId === node.id && <Star className="w-4 h-4 text-yellow-400 flex-shrink-0" />}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium truncate">{node.label}</span>
                          {statusBadge(node.status)}
                          {node.country && <Badge variant="outline" className="text-xs border-zinc-700 text-zinc-400">{node.country}</Badge>}
                          {node.firewallEnabled && <Badge className="bg-green-500/10 text-green-400 border-green-500/20 text-xs"><Shield className="w-3 h-3 mr-1" />Firewall</Badge>}
                          {node.speedOptimized && <Badge className="bg-purple-500/10 text-purple-400 border-purple-500/20 text-xs"><Zap className="w-3 h-3 mr-1" />Fast</Badge>}
                        </div>
                        <div className="text-sm text-zinc-500 mt-1">
                          {node.sshHost}:{node.sshPort}
                          {node.publicIp && <span className="ml-3 text-zinc-400">IP: <span className="text-white font-mono">{node.publicIp}</span></span>}
                          {node.lastChecked && <span className="ml-3">Checked: {new Date(node.lastChecked).toLocaleTimeString()}</span>}
                        </div>
                        {node.errorMessage && <p className="text-xs text-red-400 mt-1">{node.errorMessage}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {activeId !== node.id && (
                        <Button size="sm" variant="outline" onClick={() => setActive.mutate({ nodeId: node.id })} className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 text-xs">Set Active</Button>
                      )}
                      {!node.installed ? (
                        <Button size="sm" onClick={() => deployNode.mutate({ nodeId: node.id })} disabled={deployNode.isPending} className="bg-purple-600 hover:bg-purple-700 gap-1 text-xs">
                          {deployNode.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}Deploy
                        </Button>
                      ) : activeId === node.id && status?.status !== "running" ? (
                        <Button size="sm" onClick={() => startTor.mutate()} disabled={startTor.isPending} className="bg-green-600 hover:bg-green-700 gap-1 text-xs">
                          {startTor.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}Start Tor
                        </Button>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => checkNode.mutate({ nodeId: node.id })} disabled={checkNode.isPending} className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 gap-1 text-xs">
                          {checkNode.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}Check
                        </Button>
                      )}
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="ghost" className="text-red-400 hover:text-red-300 hover:bg-red-500/10"><Trash2 className="w-4 h-4" /></Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="bg-zinc-900 border-zinc-800 text-white">
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remove Node</AlertDialogTitle>
                            <AlertDialogDescription className="text-zinc-400">Remove "{node.label}"? The VPS is not affected.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel className="bg-zinc-800 border-zinc-700 text-white hover:bg-zinc-700">Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => removeNode.mutate({ nodeId: node.id })} className="bg-red-600 hover:bg-red-700">Remove</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><Zap className="w-4 h-4 text-purple-400" />Speed Optimisations (Auto-Applied on Deploy)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 text-sm text-zinc-400">
              {[
                ["Guard Node Pinning", "Locks to fast, nearby entry nodes"],
                ["Circuit Racing", "Builds 3 circuits in parallel, uses fastest"],
                ["Bandwidth Filtering", "Only uses relays with 1MB/s+ bandwidth"],
                ["Circuit Pre-building", "5 circuits ready before you need them"],
                ["DNS Pre-resolution", "Resolves domains before circuit is needed"],
                ["Reverse-Connection Firewall", "iptables blocks all inbound — kill-switch if Tor drops"],
              ].map(([title, desc]) => (
                <div key={title} className="flex gap-2">
                  <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                  <div><span className="text-white">{title}</span><br /><span className="text-xs">{desc}</span></div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
