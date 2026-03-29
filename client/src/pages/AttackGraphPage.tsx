import { useState, useCallback, useMemo } from "react";
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  addEdge,
  type Node,
  type Edge,
  type Connection,
  MarkerType,
  Panel,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Network,
  Shield,
  AlertTriangle,
  Globe,
  Server,
  Lock,
  Zap,
  Eye,
  RefreshCw,
  Download,
  Filter,
  Target,
  Bug,
  Wifi,
  Database,
  Key,
} from "lucide-react";

// ─── Node colour palette by severity / type ────────────────────────────────
const NODE_COLORS: Record<string, string> = {
  target: "#6366f1",      // indigo — root target
  critical: "#ef4444",    // red
  high: "#f97316",        // orange
  medium: "#eab308",      // yellow
  low: "#22c55e",         // green
  info: "#3b82f6",        // blue
  module: "#8b5cf6",      // purple — Argus module
  network: "#06b6d4",     // cyan — network asset
  web: "#ec4899",         // pink — web endpoint
  service: "#14b8a6",     // teal — running service
  credential: "#f59e0b",  // amber — credential/key
};

const SEVERITY_ORDER = ["critical", "high", "medium", "low", "info"];

// ─── Custom node renderer ───────────────────────────────────────────────────
function AttackNode({ data }: { data: { label: string; type: string; severity?: string; detail?: string; count?: number } }) {
  const color = NODE_COLORS[data.severity || data.type] || "#64748b";
  const Icon = getNodeIcon(data.type);

  return (
    <div
      className="rounded-lg border-2 px-3 py-2 shadow-lg min-w-[120px] max-w-[200px] text-center"
      style={{ borderColor: color, background: `${color}18`, backdropFilter: "blur(4px)" }}
    >
      <div className="flex items-center justify-center gap-1 mb-1">
        <Icon size={14} style={{ color }} />
        <span className="text-xs font-bold truncate" style={{ color }}>
          {data.label}
        </span>
        {data.count !== undefined && data.count > 0 && (
          <span
            className="text-[10px] rounded-full px-1 font-bold"
            style={{ background: color, color: "#fff" }}
          >
            {data.count}
          </span>
        )}
      </div>
      {data.detail && (
        <p className="text-[10px] text-muted-foreground truncate">{data.detail}</p>
      )}
    </div>
  );
}

function getNodeIcon(type: string) {
  switch (type) {
    case "target": return Target;
    case "critical": return Bug;
    case "high": return AlertTriangle;
    case "medium": return Shield;
    case "low": return Eye;
    case "info": return Zap;
    case "module": return Network;
    case "network": return Wifi;
    case "web": return Globe;
    case "service": return Server;
    case "credential": return Key;
    default: return Database;
  }
}

const nodeTypes = { attackNode: AttackNode };

// ─── Graph builder helpers ──────────────────────────────────────────────────
function buildArgusGraph(
  target: string,
  results: Array<{ moduleId?: number; moduleName?: string; module?: string; category?: string; output: string; success?: boolean; duration?: number }>
): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  // Root target node
  nodes.push({
    id: "target",
    type: "attackNode",
    position: { x: 400, y: 50 },
    data: { label: target, type: "target", detail: "Scan Target" },
  });

  // Infer category from module name
  const getCat = (r: { moduleName?: string; module?: string; category?: string }) => {
    const name = (r.moduleName || r.module || "").toLowerCase();
    if (name.includes("port") || name.includes("network") || name.includes("ping") || name.includes("traceroute")) return "network";
    if (name.includes("web") || name.includes("http") || name.includes("url") || name.includes("dir")) return "web";
    if (name.includes("ssl") || name.includes("cert") || name.includes("tls")) return "security";
    if (name.includes("dns") || name.includes("whois") || name.includes("subdomain")) return "recon";
    return r.category || "other";
  };
  const categories = [...new Set(results.map(getCat))];
  const catPositions: Record<string, { x: number; y: number }> = {};
  categories.forEach((cat, i) => {
    const angle = (i / categories.length) * 2 * Math.PI - Math.PI / 2;
    const x = 400 + Math.cos(angle) * 250;
    const y = 300 + Math.sin(angle) * 200;
    catPositions[cat] = { x, y };
    nodes.push({
      id: `cat_${cat}`,
      type: "attackNode",
      position: { x, y },
      data: { label: cat.toUpperCase(), type: "module", count: results.filter((r) => getCat(r) === cat).length },
    });
    edges.push({
      id: `e_target_${cat}`,
      source: "target",
      target: `cat_${cat}`,
      markerEnd: { type: MarkerType.ArrowClosed },
      style: { stroke: NODE_COLORS.module, strokeWidth: 1.5 },
      animated: true,
    });
  });

  // Module result nodes (only successful ones with meaningful output)
  results
    .filter((r) => r.output && r.output.length > 10 && !r.output.includes("Timed out") && !r.output.includes("Skipped"))
    .slice(0, 40) // cap at 40 to keep graph readable
    .forEach((r, i) => {
      const nodeId = `mod_${i}`;
      // Detect severity hints in output
      const outLower = r.output.toLowerCase();
      const severity =
        outLower.includes("critical") ? "critical" :
        outLower.includes("vulnerable") || outLower.includes("exploit") ? "high" :
        outLower.includes("open") || outLower.includes("exposed") ? "medium" :
        "info";
      const modCat = getCat(r);
      const catPos = catPositions[modCat] || { x: 400, y: 300 };
      const angle = (i / results.length) * 2 * Math.PI;
      const x = catPos.x + Math.cos(angle) * 120;
      const y = catPos.y + Math.sin(angle) * 80;

      nodes.push({
        id: nodeId,
        type: "attackNode",
        position: { x, y },
        data: {
          label: r.moduleName || r.module || `Module ${i}`,
          type: severity,
          severity,
          detail: r.output.slice(0, 60),
        },
      });
      edges.push({
        id: `e_${nodeId}`,
        source: `cat_${modCat}`,
        target: nodeId,
        style: { stroke: NODE_COLORS[severity], strokeWidth: 1 },
        markerEnd: { type: MarkerType.ArrowClosed },
      });
    });

  return { nodes, edges };
}

function buildAstraGraph(
  target: string,
  alerts: Array<{ name: string; impact: string; description?: string; url?: string; method?: string }>
): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  nodes.push({
    id: "target",
    type: "attackNode",
    position: { x: 400, y: 50 },
    data: { label: target, type: "target", detail: "Web Application Target" },
  });

  // Group by severity
  const bySeverity: Record<string, typeof alerts> = {};
  for (const a of alerts) {
    const sev = a.impact?.toLowerCase().includes("critical") ? "critical" :
      a.impact?.toLowerCase().includes("high") ? "high" :
      a.impact?.toLowerCase().includes("medium") ? "medium" :
      a.impact?.toLowerCase().includes("low") ? "low" : "info";
    if (!bySeverity[sev]) bySeverity[sev] = [];
    bySeverity[sev].push(a);
  }

  const sevKeys = SEVERITY_ORDER.filter((s) => bySeverity[s]?.length > 0);
  sevKeys.forEach((sev, si) => {
    const angle = (si / sevKeys.length) * 2 * Math.PI - Math.PI / 2;
    const cx = 400 + Math.cos(angle) * 220;
    const cy = 320 + Math.sin(angle) * 180;
    const clusterId = `sev_${sev}`;

    nodes.push({
      id: clusterId,
      type: "attackNode",
      position: { x: cx, y: cy },
      data: { label: sev.toUpperCase(), type: sev, count: bySeverity[sev].length },
    });
    edges.push({
      id: `e_target_${sev}`,
      source: "target",
      target: clusterId,
      animated: sev === "critical" || sev === "high",
      style: { stroke: NODE_COLORS[sev], strokeWidth: sev === "critical" ? 3 : 1.5 },
      markerEnd: { type: MarkerType.ArrowClosed },
    });

    bySeverity[sev].slice(0, 8).forEach((alert, ai) => {
      const angle2 = (ai / bySeverity[sev].length) * 2 * Math.PI;
      const nx = cx + Math.cos(angle2) * 130;
      const ny = cy + Math.sin(angle2) * 90;
      const nid = `alert_${sev}_${ai}`;
      nodes.push({
        id: nid,
        type: "attackNode",
        position: { x: nx, y: ny },
        data: {
          label: alert.name?.slice(0, 30) || "Unknown",
          type: sev,
          severity: sev,
          detail: alert.url || alert.description?.slice(0, 50) || "",
        },
      });
      edges.push({
        id: `e_${nid}`,
        source: clusterId,
        target: nid,
        style: { stroke: NODE_COLORS[sev], strokeWidth: 1 },
        markerEnd: { type: MarkerType.ArrowClosed },
      });
    });
  });

  return { nodes, edges };
}

// ─── Main Page ──────────────────────────────────────────────────────────────
export default function AttackGraphPage() {
  const { toast } = useToast();
  const [target, setTarget] = useState("");
  const [activeTab, setActiveTab] = useState<"argus" | "astra">("argus");
  const [scanId, setScanId] = useState("");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [graphSource, setGraphSource] = useState<"argus" | "astra" | null>(null);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  // ── Argus quick recon ────────────────────────────────────────────────────
  const argusRecon = trpc.argus.quickRecon.useMutation({
    onSuccess: (data) => {
      const results = data.results || [];
      const { nodes: n, edges: e } = buildArgusGraph(data.target || target, results);
      setNodes(n);
      setEdges(e);
      setGraphSource("argus");
      toast({ title: "Attack graph built", description: `${n.length} nodes from Argus recon on ${data.target || target}` });
    },
    onError: (err) => toast({ title: "Argus recon failed", description: err.message, variant: "destructive" }),
  });

  // ── Astra alerts ─────────────────────────────────────────────────────────
  const astraAlerts = trpc.astra.getAlerts.useQuery(
    { scanId: scanId || "placeholder" },
    { enabled: false }
  );

  const handleArgusRun = () => {
    if (!target.trim()) return toast({ title: "Enter a target", variant: "destructive" });
    argusRecon.mutate({ target: target.trim() });
  };

  const handleAstraLoad = async () => {
    if (!scanId.trim()) return toast({ title: "Enter a scan ID", variant: "destructive" });
    try {
      const result = await astraAlerts.refetch();
      if (result.data) {
        const { nodes: n, edges: e } = buildAstraGraph(target || scanId, result.data.alerts || []);
        setNodes(n);
        setEdges(e);
        setGraphSource("astra");
        toast({ title: "Attack graph built", description: `${result.data.total} alerts visualised from Astra scan` });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast({ title: "Astra fetch failed", description: msg, variant: "destructive" });
    }
  };

  // ── Severity filter ───────────────────────────────────────────────────────
  const filteredNodes = useMemo(() => {
    if (severityFilter === "all") return nodes;
    return nodes.filter(
      (n) =>
        n.data.type === "target" ||
        n.data.type === "module" ||
        n.data.severity === severityFilter ||
        n.data.type === severityFilter
    );
  }, [nodes, severityFilter]);

  const filteredEdges = useMemo(() => {
    const nodeIds = new Set(filteredNodes.map((n) => n.id));
    return edges.filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target));
  }, [edges, filteredNodes]);

  // ── Stats ─────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const sev of SEVERITY_ORDER) {
      counts[sev] = nodes.filter((n) => n.data.severity === sev || n.data.type === sev).length;
    }
    return counts;
  }, [nodes]);

  // ── Export ────────────────────────────────────────────────────────────────
  const handleExport = () => {
    const data = JSON.stringify({ nodes, edges, target, source: graphSource, generatedAt: new Date().toISOString() }, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `attack-graph-${target || "export"}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const isLoading = argusRecon.isPending || astraAlerts.isFetching;

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <div className="border-b px-6 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Network className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Attack Graph</h1>
            <p className="text-sm text-muted-foreground">Visual attack surface mapping — Argus OSINT &amp; Astra Web Scanner</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {nodes.length > 0 && (
            <>
              <Button variant="outline" size="sm" onClick={handleExport}>
                <Download className="h-4 w-4 mr-1" /> Export JSON
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setNodes([]); setEdges([]); setGraphSource(null); }}
              >
                <RefreshCw className="h-4 w-4 mr-1" /> Clear
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left panel — controls */}
        <div className="w-80 border-r flex flex-col overflow-y-auto shrink-0 p-4 gap-4">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "argus" | "astra")}>
            <TabsList className="w-full">
              <TabsTrigger value="argus" className="flex-1">
                <Network className="h-3.5 w-3.5 mr-1" /> Argus OSINT
              </TabsTrigger>
              <TabsTrigger value="astra" className="flex-1">
                <Bug className="h-3.5 w-3.5 mr-1" /> Astra Web
              </TabsTrigger>
            </TabsList>

            <TabsContent value="argus" className="mt-3 space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Target (IP, domain, or CIDR)</label>
                <Input
                  placeholder="192.168.1.1 or example.com"
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleArgusRun()}
                />
              </div>
              <Button
                className="w-full"
                onClick={handleArgusRun}
                disabled={isLoading || !target.trim()}
              >
                {argusRecon.isPending ? (
                  <><RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Running Recon...</>
                ) : (
                  <><Target className="h-4 w-4 mr-2" /> Run Quick Recon</>
                )}
              </Button>
              <p className="text-xs text-muted-foreground">
                Runs all Argus network, web, and security modules against the target and builds an interactive graph of discovered assets and vulnerabilities.
              </p>
            </TabsContent>

            <TabsContent value="astra" className="mt-3 space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Target URL (for label)</label>
                <Input
                  placeholder="https://example.com"
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Astra Scan ID</label>
                <Input
                  placeholder="scan-id from Astra page"
                  value={scanId}
                  onChange={(e) => setScanId(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAstraLoad()}
                />
              </div>
              <Button
                className="w-full"
                onClick={handleAstraLoad}
                disabled={isLoading || !scanId.trim()}
              >
                {astraAlerts.isFetching ? (
                  <><RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Loading Alerts...</>
                ) : (
                  <><Bug className="h-4 w-4 mr-2" /> Load Vulnerability Graph</>
                )}
              </Button>
              <p className="text-xs text-muted-foreground">
                Loads all vulnerability alerts from a completed Astra scan and maps them as a severity-clustered attack graph.
              </p>
            </TabsContent>
          </Tabs>

          {/* Severity filter */}
          {nodes.length > 0 && (
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <Filter className="h-3 w-3" /> Severity Filter
              </label>
              <Select value={severityFilter} onValueChange={setSeverityFilter}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Severities</SelectItem>
                  {SEVERITY_ORDER.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s.charAt(0).toUpperCase() + s.slice(1)} ({stats[s] || 0})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Stats cards */}
          {nodes.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Graph Summary</p>
              <div className="grid grid-cols-2 gap-2">
                {SEVERITY_ORDER.filter((s) => stats[s] > 0).map((sev) => (
                  <Card key={sev} className="border-0 shadow-none" style={{ background: `${NODE_COLORS[sev]}18` }}>
                    <CardContent className="p-2 text-center">
                      <p className="text-lg font-bold" style={{ color: NODE_COLORS[sev] }}>{stats[sev]}</p>
                      <p className="text-[10px] text-muted-foreground capitalize">{sev}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
              <div className="text-xs text-muted-foreground text-center">
                {filteredNodes.length} nodes · {filteredEdges.length} edges
                {graphSource && <span className="ml-1">· Source: {graphSource.toUpperCase()}</span>}
              </div>
            </div>
          )}

          {/* Legend */}
          <Card>
            <CardHeader className="pb-2 pt-3 px-3">
              <CardTitle className="text-xs">Node Legend</CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-3 space-y-1">
              {Object.entries(NODE_COLORS).map(([type, color]) => (
                <div key={type} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full shrink-0" style={{ background: color }} />
                  <span className="text-xs capitalize text-muted-foreground">{type}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Right panel — graph canvas */}
        <div className="flex-1 relative">
          {nodes.length === 0 ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center gap-4 text-muted-foreground">
              <div className="p-6 rounded-full bg-muted/30">
                <Network className="h-16 w-16 opacity-30" />
              </div>
              <div>
                <p className="text-lg font-semibold">No graph loaded</p>
                <p className="text-sm">Run an Argus recon or load an Astra scan to visualise the attack surface</p>
              </div>
              <div className="flex gap-3 mt-2">
                <Badge variant="outline" className="gap-1">
                  <div className="w-2 h-2 rounded-full bg-red-500" /> Critical
                </Badge>
                <Badge variant="outline" className="gap-1">
                  <div className="w-2 h-2 rounded-full bg-orange-500" /> High
                </Badge>
                <Badge variant="outline" className="gap-1">
                  <div className="w-2 h-2 rounded-full bg-yellow-500" /> Medium
                </Badge>
                <Badge variant="outline" className="gap-1">
                  <div className="w-2 h-2 rounded-full bg-green-500" /> Low
                </Badge>
              </div>
            </div>
          ) : (
            <ReactFlow
              nodes={filteredNodes}
              edges={filteredEdges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              nodeTypes={nodeTypes}
              fitView
              fitViewOptions={{ padding: 0.2 }}
              minZoom={0.1}
              maxZoom={3}
              colorMode="dark"
            >
              <Controls />
              <MiniMap
                nodeColor={(n) => NODE_COLORS[(n.data as { type: string; severity?: string }).severity || (n.data as { type: string }).type] || "#64748b"}
                className="!bg-background !border-border"
              />
              <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#334155" />
              <Panel position="top-right" className="flex gap-2">
                <Badge className="bg-background/80 text-foreground border">
                  <Lock className="h-3 w-3 mr-1" />
                  {graphSource === "argus" ? "Argus OSINT" : "Astra Web Scan"}
                </Badge>
              </Panel>
            </ReactFlow>
          )}
        </div>
      </div>
    </div>
  );
}
