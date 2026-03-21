/**
 * Titan VPN Chain Page
 * Multi-hop VPN routing — traffic bounces through multiple servers
 * so no single server knows both who you are AND where you're going.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Shield, Plus, Trash2, ArrowUp, ArrowDown, CheckCircle2,
  AlertTriangle, Loader2, RefreshCw, Server, Globe, Lock,
  ChevronRight, Info, Zap
} from "lucide-react";

export default function VpnChainPage() {
  const [addOpen, setAddOpen] = useState(false);
  const [newHop, setNewHop] = useState({ label: "", host: "", port: "22", username: "root", password: "", country: "" });
  const [testResults, setTestResults] = useState<Record<string, { ok: boolean; msg: string }>>({});

  const chainQuery = trpc.vpnChain.getChain.useQuery();
  const activeQuery = trpc.vpnChain.getActiveState.useQuery();

  const addHop = trpc.vpnChain.addHop.useMutation({
    onSuccess: () => { toast.success("Hop added to chain"); setAddOpen(false); chainQuery.refetch(); setNewHop({ label: "", host: "", port: "22", username: "root", password: "", country: "" }); },
    onError: (e) => toast.error(e.message),
  });
  const removeHop = trpc.vpnChain.removeHop.useMutation({
    onSuccess: () => { toast.success("Hop removed"); chainQuery.refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const reorderHops = trpc.vpnChain.reorderHops.useMutation({
    onSuccess: () => chainQuery.refetch(),
    onError: (e) => toast.error(e.message),
  });
  const setUseTitan = trpc.vpnChain.setUseTitanEntry.useMutation({
    onSuccess: () => chainQuery.refetch(),
    onError: (e) => toast.error(e.message),
  });
  const testHop = trpc.vpnChain.testHop.useMutation({
    onSuccess: (d, vars) => {
      setTestResults(prev => ({ ...prev, [vars.hopId]: { ok: d.success, msg: d.message } }));
    },
    onError: (e) => toast.error(e.message),
  });
  const testChain = trpc.vpnChain.testChain.useMutation({
    onSuccess: (d) => {
      if (d.success) toast.success(d.message);
      else toast.error(d.message);
    },
    onError: (e) => toast.error(e.message),
  });
  const setActive = trpc.vpnChain.setActive.useMutation({
    onSuccess: () => activeQuery.refetch(),
    onError: (e) => toast.error(e.message),
  });
  const clearChain = trpc.vpnChain.clearChain.useMutation({
    onSuccess: () => { toast.success("Chain cleared"); chainQuery.refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const chain = chainQuery.data;
  const hops = chain?.hops ?? [];
  const isActive = activeQuery.data?.active ?? false;

  const moveHop = (id: string, dir: "up" | "down") => {
    const idx = hops.findIndex(h => h.id === id);
    if (dir === "up" && idx === 0) return;
    if (dir === "down" && idx === hops.length - 1) return;
    const newOrder = [...hops];
    const swap = dir === "up" ? idx - 1 : idx + 1;
    [newOrder[idx], newOrder[swap]] = [newOrder[swap], newOrder[idx]];
    reorderHops.mutate({ orderedIds: newOrder.map(h => h.id) });
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
            <Shield className="w-6 h-6 text-blue-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">VPN Chain</h1>
            <p className="text-sm text-zinc-400">Multi-hop routing — virtually untraceable</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm text-zinc-400">Active</span>
            <Switch
              checked={isActive}
              onCheckedChange={(v) => setActive.mutate({ active: v })}
              disabled={hops.length === 0}
            />
          </div>
          <Badge variant={isActive ? "default" : "secondary"} className={isActive ? "bg-blue-500/20 text-blue-300 border-blue-500/30" : ""}>
            {isActive ? "ON" : "OFF"}
          </Badge>
        </div>
      </div>

      {/* How it works */}
      <div className="p-4 rounded-lg bg-blue-500/5 border border-blue-500/20 text-sm text-blue-200">
        <div className="flex gap-2">
          <Info className="w-4 h-4 flex-shrink-0 mt-0.5 text-blue-400" />
          <span>Traffic flows: <strong>You → Hop 1 → Hop 2 → Hop 3 → Internet</strong>. Each server only knows the previous and next hop — no single server can trace the full path back to you.</span>
        </div>
      </div>

      {/* Chain visualiser */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Your Chain ({hops.length} hop{hops.length !== 1 ? "s" : ""})</CardTitle>
            <div className="flex gap-2">
              {hops.length > 0 && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => testChain.mutate()}
                    disabled={testChain.isPending}
                  >
                    {testChain.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Zap className="w-3 h-3 mr-1" />}
                    Test Chain
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => clearChain.mutate()} disabled={clearChain.isPending}>
                    Clear All
                  </Button>
                </>
              )}
              <Button size="sm" className="bg-blue-600 hover:bg-blue-700" onClick={() => setAddOpen(true)}>
                <Plus className="w-3 h-3 mr-1" /> Add Hop
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {hops.length === 0 ? (
            <div className="text-center py-10 space-y-3">
              <Shield className="w-12 h-12 text-zinc-700 mx-auto" />
              <p className="text-zinc-500">No hops yet. Add at least 2 servers to create a chain.</p>
              <Button onClick={() => setAddOpen(true)} className="bg-blue-600 hover:bg-blue-700">
                <Plus className="w-4 h-4 mr-2" /> Add First Hop
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {/* Titan Server as entry */}
              <div className="flex items-center gap-2 p-3 rounded-lg bg-zinc-800/50 border border-zinc-700/50">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-xs text-purple-300 font-bold">T</div>
                <div className="flex-1">
                  <div className="text-sm font-medium text-zinc-200">Titan Server (Entry)</div>
                  <div className="text-xs text-zinc-500">Use your Titan Server as the first hop</div>
                </div>
                <Switch
                  checked={chain?.useTitanAsEntry ?? false}
                  onCheckedChange={(v) => setUseTitan.mutate({ enabled: v })}
                  disabled={setUseTitan.isPending}
                />
              </div>

              {chain?.useTitanAsEntry && hops.length > 0 && (
                <div className="flex justify-center py-1">
                  <ChevronRight className="w-4 h-4 text-zinc-600 rotate-90" />
                </div>
              )}

              {hops.map((hop, idx) => {
                const result = testResults[hop.id];
                return (
                  <div key={hop.id}>
                    <div className={`flex items-center gap-3 p-3 rounded-lg border ${result?.ok === true ? "bg-green-500/5 border-green-500/20" : result?.ok === false ? "bg-red-500/5 border-red-500/20" : "bg-zinc-800/50 border-zinc-700/50"}`}>
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-xs text-blue-300 font-bold">
                        {idx + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-zinc-200 truncate">{hop.label || hop.host}</span>
                          {hop.country && <Badge variant="outline" className="text-xs py-0">{hop.country}</Badge>}
                          {idx === 0 && !chain?.useTitanAsEntry && <Badge variant="outline" className="text-xs py-0 text-green-400 border-green-500/30">Entry</Badge>}
                          {idx === hops.length - 1 && <Badge variant="outline" className="text-xs py-0 text-orange-400 border-orange-500/30">Exit</Badge>}
                        </div>
                        <div className="text-xs text-zinc-500">{hop.host}:{hop.port} · {hop.username}</div>
                        {result && <div className={`text-xs mt-0.5 ${result.ok ? "text-green-400" : "text-red-400"}`}>{result.msg}</div>}
                      </div>
                      <div className="flex items-center gap-1">
                        <Button size="icon" variant="ghost" className="w-7 h-7" onClick={() => moveHop(hop.id, "up")} disabled={idx === 0}>
                          <ArrowUp className="w-3 h-3" />
                        </Button>
                        <Button size="icon" variant="ghost" className="w-7 h-7" onClick={() => moveHop(hop.id, "down")} disabled={idx === hops.length - 1}>
                          <ArrowDown className="w-3 h-3" />
                        </Button>
                        <Button
                          size="icon" variant="ghost" className="w-7 h-7 text-blue-400"
                          onClick={() => testHop.mutate({ hopId: hop.id })}
                          disabled={testHop.isPending}
                        >
                          {testHop.isPending && testHop.variables?.hopId === hop.id
                            ? <Loader2 className="w-3 h-3 animate-spin" />
                            : <Zap className="w-3 h-3" />}
                        </Button>
                        <Button
                          size="icon" variant="ghost" className="w-7 h-7 text-red-400 hover:text-red-300"
                          onClick={() => removeHop.mutate({ hopId: hop.id })}
                          disabled={removeHop.isPending}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                    {idx < hops.length - 1 && (
                      <div className="flex justify-center py-1">
                        <ChevronRight className="w-4 h-4 text-zinc-600 rotate-90" />
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Final destination */}
              <div className="flex justify-center py-1">
                <ChevronRight className="w-4 h-4 text-zinc-600 rotate-90" />
              </div>
              <div className="flex items-center gap-2 p-3 rounded-lg bg-zinc-800/30 border border-dashed border-zinc-700">
                <Globe className="w-4 h-4 text-zinc-500" />
                <span className="text-sm text-zinc-500">Internet (destination)</span>
              </div>
            </div>
          )}

          {testChain.data && (
            <div className={`mt-4 p-3 rounded text-xs font-mono whitespace-pre-wrap max-h-40 overflow-y-auto ${testChain.data.success ? "bg-green-500/10 text-green-300" : "bg-red-500/10 text-red-300"}`}>
              {testChain.data.message}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Hop Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-white">
          <DialogHeader>
            <DialogTitle>Add VPN Hop</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1">
                <Label>Label (optional)</Label>
                <Input value={newHop.label} onChange={e => setNewHop(p => ({ ...p, label: e.target.value }))} placeholder="e.g. Germany VPS" className="bg-zinc-800 border-zinc-700" />
              </div>
              <div className="space-y-1">
                <Label>Host / IP *</Label>
                <Input value={newHop.host} onChange={e => setNewHop(p => ({ ...p, host: e.target.value }))} placeholder="192.168.1.1" className="bg-zinc-800 border-zinc-700" />
              </div>
              <div className="space-y-1">
                <Label>SSH Port</Label>
                <Input value={newHop.port} onChange={e => setNewHop(p => ({ ...p, port: e.target.value }))} placeholder="22" className="bg-zinc-800 border-zinc-700" />
              </div>
              <div className="space-y-1">
                <Label>Username</Label>
                <Input value={newHop.username} onChange={e => setNewHop(p => ({ ...p, username: e.target.value }))} placeholder="root" className="bg-zinc-800 border-zinc-700" />
              </div>
              <div className="space-y-1">
                <Label>Password</Label>
                <Input type="password" value={newHop.password} onChange={e => setNewHop(p => ({ ...p, password: e.target.value }))} placeholder="••••••••" className="bg-zinc-800 border-zinc-700" />
              </div>
              <div className="col-span-2 space-y-1">
                <Label>Country (display only)</Label>
                <Input value={newHop.country} onChange={e => setNewHop(p => ({ ...p, country: e.target.value }))} placeholder="e.g. Germany" className="bg-zinc-800 border-zinc-700" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button
              className="bg-blue-600 hover:bg-blue-700"
              disabled={!newHop.host || addHop.isPending}
              onClick={() => addHop.mutate({
                label: newHop.label || newHop.host,
                host: newHop.host,
                port: parseInt(newHop.port) || 22,
                username: newHop.username,
                password: newHop.password || undefined,
                country: newHop.country || undefined,
              })}
            >
              {addHop.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
              Add Hop
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
