import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  ShoppingBag, Star, Download, Upload, Search, Filter,
  Shield, Zap, Eye, Code, Globe, Lock, RefreshCw, Plus,
  CheckCircle, AlertTriangle, Package, Users
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  osint: <Eye className="h-4 w-4" />,
  exploitation: <Zap className="h-4 w-4" />,
  recon: <Globe className="h-4 w-4" />,
  post_exploitation: <Shield className="h-4 w-4" />,
  reporting: <Code className="h-4 w-4" />,
  automation: <RefreshCw className="h-4 w-4" />,
  evasion: <Lock className="h-4 w-4" />,
  forensics: <Search className="h-4 w-4" />,
};

const CATEGORY_COLORS: Record<string, string> = {
  osint: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  exploitation: "text-red-400 bg-red-500/10 border-red-500/20",
  recon: "text-green-400 bg-green-500/10 border-green-500/20",
  post_exploitation: "text-orange-400 bg-orange-500/10 border-orange-500/20",
  reporting: "text-purple-400 bg-purple-500/10 border-purple-500/20",
  automation: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
  evasion: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
  forensics: "text-pink-400 bg-pink-500/10 border-pink-500/20",
};

export default function SecurityMarketplacePage() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [sortBy, setSortBy] = useState<"popular" | "newest" | "rating">("popular");
  const [selectedModule, setSelectedModule] = useState<any>(null);
  const [showPublish, setShowPublish] = useState(false);
  const [publishForm, setPublishForm] = useState({
    name: "", description: "", category: "osint", version: "1.0.0",
    tags: "", code: "", readme: "", price: 0,
  });

  const { data: modulesData, refetch } = trpc.securityMarketplace.listModules.useQuery({
    search: search || undefined,
    category: category === "all" ? undefined : category,
    sortBy,
  });

  const { data: installedData, refetch: refetchInstalled } = trpc.securityMarketplace.getInstalled.useQuery();
  const { data: statsData } = trpc.securityMarketplace.getStats.useQuery();

  const installModule = trpc.securityMarketplace.installModule.useMutation({
    onSuccess: () => {
      refetchInstalled();
      toast({ title: "Module installed", description: `${selectedModule?.name} is ready to use` });
      setSelectedModule(null);
    },
    onError: (e) => toast({ title: "Install failed", description: e.message, variant: "destructive" }),
  });

  const uninstallModule = trpc.securityMarketplace.uninstallModule.useMutation({
    onSuccess: () => {
      refetchInstalled();
      toast({ title: "Module uninstalled" });
    },
  });

  const rateModule = trpc.securityMarketplace.rateModule.useMutation({
    onSuccess: () => { refetch(); toast({ title: "Rating submitted" }); },
  });

  const publishModule = trpc.securityMarketplace.publishModule.useMutation({
    onSuccess: () => {
      refetch();
      setShowPublish(false);
      toast({ title: "Module submitted", description: "Your module is under review" });
    },
    onError: (e) => toast({ title: "Publish failed", description: e.message, variant: "destructive" }),
  });

  const modules = modulesData?.modules ?? [];
  const installed = installedData?.modules ?? [];
  const installedIds = new Set(installed.map((m: any) => m.moduleId));
  const stats = statsData;

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <ShoppingBag className="h-7 w-7 text-purple-400" />
              Security Module Marketplace
            </h1>
            <p className="text-slate-400 mt-1">Community-built security modules, playbooks, and automation scripts</p>
          </div>
          <Button onClick={() => setShowPublish(true)} className="bg-purple-600 hover:bg-purple-700">
            <Upload className="h-4 w-4 mr-2" />
            Publish Module
          </Button>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Total Modules", value: stats.totalModules, icon: <Package className="h-4 w-4" />, color: "text-purple-400" },
              { label: "Total Downloads", value: stats.totalDownloads.toLocaleString(), icon: <Download className="h-4 w-4" />, color: "text-blue-400" },
              { label: "Contributors", value: stats.totalContributors, icon: <Users className="h-4 w-4" />, color: "text-green-400" },
              { label: "Installed", value: installed.length, icon: <CheckCircle className="h-4 w-4" />, color: "text-cyan-400" },
            ].map((s) => (
              <Card key={s.label} className="bg-slate-900/50 border-slate-800">
                <CardContent className="p-4">
                  <div className={`flex items-center gap-2 mb-1 ${s.color}`}>{s.icon}<span className="text-xs text-slate-400">{s.label}</span></div>
                  <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Tabs */}
        <Tabs defaultValue="browse">
          <TabsList className="bg-slate-900 border border-slate-800">
            <TabsTrigger value="browse">Browse ({modules.length})</TabsTrigger>
            <TabsTrigger value="installed">Installed ({installed.length})</TabsTrigger>
          </TabsList>

          {/* Browse Tab */}
          <TabsContent value="browse" className="space-y-4">
            {/* Filters */}
            <div className="flex gap-3 flex-wrap">
              <div className="relative flex-1 min-w-48">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search modules..."
                  className="pl-9 bg-slate-900 border-slate-700 text-white"
                />
              </div>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="w-40 bg-slate-900 border-slate-700 text-white">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  <SelectItem value="all" className="text-white">All Categories</SelectItem>
                  {Object.keys(CATEGORY_ICONS).map((c) => (
                    <SelectItem key={c} value={c} className="text-white capitalize">{c.replace("_", " ")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
                <SelectTrigger className="w-36 bg-slate-900 border-slate-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  <SelectItem value="popular" className="text-white">Most Popular</SelectItem>
                  <SelectItem value="newest" className="text-white">Newest</SelectItem>
                  <SelectItem value="rating" className="text-white">Top Rated</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Module Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {modules.map((mod: any) => (
                <Card
                  key={mod.id}
                  className="bg-slate-900/50 border-slate-800 hover:border-slate-600 cursor-pointer transition-all"
                  onClick={() => setSelectedModule(mod)}
                >
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div className={`p-2 rounded-lg border ${CATEGORY_COLORS[mod.category] ?? "text-slate-400 bg-slate-800 border-slate-700"}`}>
                        {CATEGORY_ICONS[mod.category] ?? <Package className="h-4 w-4" />}
                      </div>
                      <div className="flex items-center gap-1">
                        {installedIds.has(mod.id) && (
                          <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-xs">Installed</Badge>
                        )}
                        {mod.verified && (
                          <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-xs">Verified</Badge>
                        )}
                      </div>
                    </div>
                    <h3 className="font-semibold text-white mb-1">{mod.name}</h3>
                    <p className="text-slate-400 text-sm line-clamp-2 mb-3">{mod.description}</p>
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <div className="flex items-center gap-1">
                        <Star className="h-3 w-3 text-yellow-400 fill-yellow-400" />
                        <span className="text-yellow-400">{mod.rating.toFixed(1)}</span>
                        <span>({mod.ratingCount})</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Download className="h-3 w-3" />
                        <span>{mod.downloads.toLocaleString()}</span>
                      </div>
                      <span>v{mod.version}</span>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-3">
                      {mod.tags.slice(0, 3).map((tag: string) => (
                        <span key={tag} className="text-xs bg-slate-800 text-slate-400 px-2 py-0.5 rounded">#{tag}</span>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {modules.length === 0 && (
              <div className="text-center py-16 text-slate-500">
                <ShoppingBag className="h-12 w-12 mx-auto mb-4 text-slate-600" />
                <p className="text-lg font-medium mb-2">No modules found</p>
                <p className="text-sm">Try adjusting your search or filters</p>
              </div>
            )}
          </TabsContent>

          {/* Installed Tab */}
          <TabsContent value="installed" className="space-y-3">
            {installed.length === 0 ? (
              <Card className="bg-slate-900/50 border-slate-800">
                <CardContent className="py-16 text-center text-slate-500">
                  <Package className="h-12 w-12 mx-auto mb-4 text-slate-600" />
                  <p className="text-lg font-medium mb-2">No modules installed</p>
                  <p className="text-sm">Browse the marketplace to find security modules</p>
                </CardContent>
              </Card>
            ) : (
              installed.map((inst: any) => (
                <Card key={inst.moduleId} className="bg-slate-900/50 border-slate-800">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-white">{inst.moduleName}</div>
                        <div className="text-sm text-slate-400">v{inst.version} · Installed {new Date(inst.installedAt).toLocaleDateString()}</div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                        onClick={() => uninstallModule.mutate({ moduleId: inst.moduleId })}
                      >
                        Uninstall
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Module Detail Dialog */}
      {selectedModule && (
        <Dialog open={!!selectedModule} onOpenChange={() => setSelectedModule(null)}>
          <DialogContent className="bg-slate-900 border-slate-800 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className={`p-2 rounded-lg border ${CATEGORY_COLORS[selectedModule.category] ?? "text-slate-400 bg-slate-800 border-slate-700"}`}>
                  {CATEGORY_ICONS[selectedModule.category] ?? <Package className="h-5 w-5" />}
                </div>
                <div>
                  <DialogTitle className="text-white">{selectedModule.name}</DialogTitle>
                  <div className="text-sm text-slate-400">by {selectedModule.authorName} · v{selectedModule.version}</div>
                </div>
              </div>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-slate-300">{selectedModule.description}</p>
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1">
                  <Star className="h-4 w-4 text-yellow-400 fill-yellow-400" />
                  <span className="text-yellow-400 font-medium">{selectedModule.rating.toFixed(1)}</span>
                  <span className="text-slate-400">({selectedModule.ratingCount} ratings)</span>
                </div>
                <div className="flex items-center gap-1 text-slate-400">
                  <Download className="h-4 w-4" />
                  <span>{selectedModule.downloads.toLocaleString()} downloads</span>
                </div>
              </div>
              {selectedModule.readme && (
                <div className="bg-slate-800 rounded-lg p-4">
                  <div className="text-xs text-slate-500 mb-2 font-mono">README</div>
                  <pre className="text-sm text-slate-300 whitespace-pre-wrap font-mono">{selectedModule.readme}</pre>
                </div>
              )}
              <div className="flex flex-wrap gap-1">
                {selectedModule.tags.map((tag: string) => (
                  <span key={tag} className="text-xs bg-slate-800 text-slate-400 px-2 py-1 rounded">#{tag}</span>
                ))}
              </div>
              {/* Rating */}
              <div>
                <div className="text-sm text-slate-400 mb-2">Rate this module:</div>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      onClick={() => rateModule.mutate({ moduleId: selectedModule.id, rating: star })}
                      className="text-slate-600 hover:text-yellow-400 transition-colors"
                    >
                      <Star className="h-5 w-5" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSelectedModule(null)} className="border-slate-700 text-slate-300">Close</Button>
              {installedIds.has(selectedModule.id) ? (
                <Button
                  variant="outline"
                  className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                  onClick={() => { uninstallModule.mutate({ moduleId: selectedModule.id }); setSelectedModule(null); }}
                >
                  Uninstall
                </Button>
              ) : (
                <Button
                  onClick={() => installModule.mutate({ moduleId: selectedModule.id })}
                  disabled={installModule.isPending}
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  {installModule.isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <><Download className="h-4 w-4 mr-2" />Install Module</>}
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Publish Dialog */}
      <Dialog open={showPublish} onOpenChange={setShowPublish}>
        <DialogContent className="bg-slate-900 border-slate-800 text-white max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Publish Security Module</DialogTitle>
            <DialogDescription className="text-slate-400">Share your security module with the community</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label className="text-slate-300">Module Name</Label>
              <Input value={publishForm.name} onChange={(e) => setPublishForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. LinkedIn OSINT Scraper" className="bg-slate-800 border-slate-700 text-white" />
            </div>
            <div className="space-y-1">
              <Label className="text-slate-300">Description</Label>
              <Textarea value={publishForm.description} onChange={(e) => setPublishForm((f) => ({ ...f, description: e.target.value }))} placeholder="What does this module do?" className="bg-slate-800 border-slate-700 text-white" rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-slate-300">Category</Label>
                <Select value={publishForm.category} onValueChange={(v) => setPublishForm((f) => ({ ...f, category: v }))}>
                  <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    {Object.keys(CATEGORY_ICONS).map((c) => (
                      <SelectItem key={c} value={c} className="text-white capitalize">{c.replace("_", " ")}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-slate-300">Version</Label>
                <Input value={publishForm.version} onChange={(e) => setPublishForm((f) => ({ ...f, version: e.target.value }))} placeholder="1.0.0" className="bg-slate-800 border-slate-700 text-white" />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-slate-300">Tags (comma-separated)</Label>
              <Input value={publishForm.tags} onChange={(e) => setPublishForm((f) => ({ ...f, tags: e.target.value }))} placeholder="osint, linkedin, scraping" className="bg-slate-800 border-slate-700 text-white" />
            </div>
            <div className="space-y-1">
              <Label className="text-slate-300">README / Documentation</Label>
              <Textarea value={publishForm.readme} onChange={(e) => setPublishForm((f) => ({ ...f, readme: e.target.value }))} placeholder="## Usage&#10;&#10;Describe how to use your module..." className="bg-slate-800 border-slate-700 text-white font-mono text-sm" rows={5} />
            </div>
            <div className="space-y-1">
              <Label className="text-slate-300">Module Code</Label>
              <Textarea value={publishForm.code} onChange={(e) => setPublishForm((f) => ({ ...f, code: e.target.value }))} placeholder="// Your module code here..." className="bg-slate-800 border-slate-700 text-white font-mono text-sm" rows={8} />
            </div>
            <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-400 mt-0.5 shrink-0" />
              <p className="text-xs text-yellow-300">All modules are reviewed before publication. Malicious code will result in a permanent ban.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPublish(false)} className="border-slate-700 text-slate-300">Cancel</Button>
            <Button
              onClick={() => publishModule.mutate({ ...publishForm, tags: publishForm.tags.split(",").map((t) => t.trim()).filter(Boolean) } as any)}
              disabled={!publishForm.name || !publishForm.description || !publishForm.code || publishModule.isPending}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {publishModule.isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <><Upload className="h-4 w-4 mr-2" />Submit for Review</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
