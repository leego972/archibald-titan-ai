import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import {
  Rocket, Plus, Loader2, Users, Target, Search, ExternalLink,
  TrendingUp, Clock, DollarSign, ArrowLeft, Heart, Share2,
  Globe, Zap, Filter, BarChart3, Star, ChevronRight, RefreshCw,
  Sparkles, Trash2, MessageCircle, Send, Gift, Eye, Edit3,
  CheckCircle, ChevronLeft, Image as ImageIcon, Video, Tag,
} from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";

// ─── Source badge colors ───────────────────────────────────────
function SourceBadge({ source }: { source: string }) {
  const config: Record<string, { label: string; className: string }> = {
    kickstarter: { label: "Kickstarter", className: "bg-green-500/15 text-green-400 border-green-500/30" },
    indiegogo: { label: "Indiegogo", className: "bg-pink-500/15 text-pink-400 border-pink-500/30" },
    gofundme: { label: "GoFundMe", className: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
    internal: { label: "Archibald Titan", className: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
    other: { label: "Community", className: "bg-purple-500/15 text-purple-400 border-purple-500/30" },
  };
  const c = config[source] || config.other;
  return <Badge variant="outline" className={c.className}>{c.label}</Badge>;
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { className: string }> = {
    active: { className: "bg-green-500/15 text-green-400 border-green-500/30" },
    funded: { className: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30" },
    ended: { className: "bg-gray-500/15 text-gray-400 border-gray-500/30" },
    draft: { className: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
    cancelled: { className: "bg-red-500/15 text-red-400 border-red-500/30" },
  };
  const c = config[status] || config.active;
  return <Badge variant="outline" className={c.className}>{status.charAt(0).toUpperCase() + status.slice(1)}</Badge>;
}

function formatAmount(amount: number): string {
  if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
  if (amount >= 1000) return `$${(amount / 1000).toFixed(0)}K`;
  return `$${amount.toLocaleString()}`;
}

const CATEGORIES = [
  { value: "technology", label: "Technology", icon: "💻" },
  { value: "science", label: "Science", icon: "🔬" },
  { value: "health", label: "Health & Medical", icon: "🏥" },
  { value: "education", label: "Education", icon: "📚" },
  { value: "environment", label: "Environment", icon: "🌍" },
  { value: "community", label: "Community", icon: "🤝" },
  { value: "creative", label: "Creative & Arts", icon: "🎨" },
  { value: "gaming", label: "Gaming", icon: "🎮" },
  { value: "film", label: "Film & Video", icon: "🎬" },
  { value: "music", label: "Music", icon: "🎵" },
  { value: "food", label: "Food & Drink", icon: "🍕" },
  { value: "fashion", label: "Fashion", icon: "👗" },
  { value: "sports", label: "Sports & Fitness", icon: "⚽" },
  { value: "nonprofit", label: "Nonprofit & Charity", icon: "❤️" },
  { value: "other", label: "Other", icon: "📦" },
];

// ─── Campaign Card ───────────────────────────────────────
function CampaignCard({ campaign, onClick }: { campaign: any; onClick: () => void }) {
  const isExternal = campaign.source !== "internal";
  const progressPct = Math.min(100, Math.round((campaign.currentAmount / campaign.goalAmount) * 100));

  return (
    <Card className="overflow-hidden cursor-pointer hover:border-blue-500/30 transition-all hover:shadow-lg hover:shadow-blue-500/5 group" onClick={onClick}>
      <div className="h-36 bg-gradient-to-br from-blue-600/20 via-purple-600/20 to-pink-600/20 relative overflow-hidden">
        {campaign.imageUrl ? (
          <img loading="lazy" src={campaign.imageUrl} alt={campaign.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center"><Rocket className="h-10 w-10 text-blue-400/30" /></div>
        )}
        <div className="absolute top-2 left-2 flex gap-1.5">
          <SourceBadge source={campaign.source || "internal"} />
          <StatusBadge status={campaign.status} />
        </div>
      </div>
      <CardContent className="p-4 space-y-2.5">
        <h3 className="font-semibold text-sm line-clamp-1 group-hover:text-blue-400 transition-colors">{campaign.title}</h3>
        <p className="text-xs text-muted-foreground line-clamp-2">{campaign.description}</p>
        <Progress value={progressPct} className="h-1.5" />
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="font-semibold text-green-400">{formatAmount(campaign.currentAmount)}</span>
          <span>{progressPct}% of {formatAmount(campaign.goalAmount)}</span>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-1"><Users className="h-3 w-3" /><span>{campaign.backerCount || 0}</span></div>
          <div className="flex items-center gap-1"><TrendingUp className="h-3 w-3" /><span className="font-semibold text-green-400">{campaign.percentFunded || progressPct}%</span></div>
          {campaign.daysLeft != null && (
            <div className="flex items-center gap-1"><Clock className="h-3 w-3" /><span>{campaign.daysLeft}d left</span></div>
          )}
        </div>
        {campaign.tags && Array.isArray(campaign.tags) && campaign.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {campaign.tags.slice(0, 3).map((tag: string) => (
              <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0">{tag}</Badge>
            ))}
          </div>
        )}
        {isExternal && (
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <ExternalLink className="h-3 w-3" />
            <span>View on {campaign.source?.charAt(0).toUpperCase() + campaign.source?.slice(1)}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════
// BROWSE VIEW
// ═══════════════════════════════════════════════════════════════

function BrowseView() {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [sortBy, setSortBy] = useState<string>("trending");
  const [statusFilter, setStatusFilter] = useState("all");

  const { data: campaigns, isLoading } = trpc.crowdfunding.list.useQuery({
    sort: sortBy as any,
    source: sourceFilter !== "all" ? sourceFilter : undefined,
    status: statusFilter !== "all" ? statusFilter : undefined,
    search: search || undefined,
  });

  const { data: stats } = trpc.crowdfunding.stats.useQuery();

  const seedMutation = trpc.crowdfunding.seed.useMutation({
    onSuccess: (data) => { toast.success(`Seeded ${data.seeded} campaigns (${data.skipped} already existed)`); },
    onError: (err) => toast.error(err.message),
  });

  return (
    <div className="space-y-6">
      {/* Hero header */}
      <div className="relative overflow-hidden rounded-xl border border-white/10 bg-gradient-to-br from-blue-600/10 via-purple-600/10 to-pink-600/10 p-6">
        <div className="relative">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-3">
                <Rocket className="h-7 w-7 text-blue-400" />
                Crowdfunding Hub
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Launch your own campaign or back innovative projects from our community and beyond
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setLocation("/crowdfunding/my-campaigns")}>
                <BarChart3 className="h-4 w-4 mr-1" /> My Campaigns
              </Button>
              <Button size="sm" className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500" onClick={() => setLocation("/crowdfunding/create")}>
                <Plus className="h-4 w-4 mr-1" /> Launch Campaign
              </Button>
            </div>
          </div>

          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-4">
              <div className="bg-background/50 rounded-lg p-3 border border-white/5">
                <div className="text-lg font-bold">{stats.total}</div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Total Campaigns</div>
              </div>
              <div className="bg-background/50 rounded-lg p-3 border border-white/5">
                <div className="text-lg font-bold text-green-400">{formatAmount(stats.totalRaised || 0)}</div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Total Raised</div>
              </div>
              <div className="bg-background/50 rounded-lg p-3 border border-white/5">
                <div className="text-lg font-bold">{stats.internal || 0}</div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Our Community</div>
              </div>
              <div className="bg-background/50 rounded-lg p-3 border border-white/5">
                <div className="text-lg font-bold">{stats.totalBackers || 0}</div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Total Backers</div>
              </div>
              <div className="bg-background/50 rounded-lg p-3 border border-white/5">
                <div className="text-lg font-bold text-yellow-400">{stats.kickstarter + stats.indiegogo + stats.gofundme}</div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">External</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search campaigns..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={sourceFilter} onValueChange={setSourceFilter}>
          <SelectTrigger className="w-[140px]"><Globe className="h-4 w-4 mr-1" /><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sources</SelectItem>
            <SelectItem value="internal">Our Community</SelectItem>
            <SelectItem value="kickstarter">Kickstarter</SelectItem>
            <SelectItem value="indiegogo">Indiegogo</SelectItem>
            <SelectItem value="gofundme">GoFundMe</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[130px]"><Filter className="h-4 w-4 mr-1" /><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="funded">Funded</SelectItem>
            <SelectItem value="ended">Ended</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-[140px]"><BarChart3 className="h-4 w-4 mr-1" /><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="trending">Trending</SelectItem>
            <SelectItem value="newest">Newest</SelectItem>
            <SelectItem value="most_funded">Most Funded</SelectItem>
            <SelectItem value="ending_soon">Ending Soon</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Campaign grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-blue-400" /></div>
      ) : !campaigns || campaigns.length === 0 ? (
        <Card className="p-12 text-center">
          <Rocket className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No campaigns found</h3>
          <p className="text-sm text-muted-foreground mb-4">Be the first to launch a campaign!</p>
          <div className="flex gap-3 justify-center">
            <Button onClick={() => setLocation("/crowdfunding/create")}><Plus className="h-4 w-4 mr-1" /> Launch Campaign</Button>
            <Button variant="outline" onClick={() => seedMutation.mutate()} disabled={seedMutation.isPending}>
              {seedMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-4 w-4 mr-1" />}
              Discover External Campaigns
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {campaigns.map((campaign: any) => (
            <CampaignCard
              key={campaign.id}
              campaign={campaign}
              onClick={() => {
                if (campaign.source !== "internal" && campaign.externalUrl) {
                  window.open(campaign.externalUrl, "_blank");
                } else {
                  setLocation(`/crowdfunding/campaign/${campaign.id}`);
                }
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// COMMENTS SECTION
// ═══════════════════════════════════════════════════════════════

function CommentsSection({ campaignId }: { campaignId: number }) {
  const [newComment, setNewComment] = useState("");
  const utils = trpc.useUtils();

  const { data: comments, isLoading } = trpc.crowdfunding.comments.useQuery({ campaignId });

  const addCommentMutation = trpc.crowdfunding.addComment.useMutation({
    onSuccess: () => {
      toast.success("Comment posted!");
      setNewComment("");
      utils.crowdfunding.comments.invalidate({ campaignId });
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <MessageCircle className="h-5 w-5 text-blue-400" />
          Discussion ({comments?.length || 0})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add comment */}
        <div className="flex gap-2">
          <Textarea
            placeholder="Share your thoughts about this campaign..."
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            rows={2}
            className="flex-1"
          />
          <Button
            size="sm"
            className="self-end bg-blue-600 hover:bg-blue-500"
            onClick={() => {
              if (!newComment.trim()) { toast.error("Write something first"); return; }
              addCommentMutation.mutate({ campaignId, content: newComment.trim() });
            }}
            disabled={addCommentMutation.isPending}
          >
            {addCommentMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>

        {/* Comments list */}
        {isLoading ? (
          <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-blue-400" /></div>
        ) : !comments || comments.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No comments yet. Be the first to share your thoughts!</p>
        ) : (
          <div className="space-y-3">
            {comments.map((comment: any) => (
              <div key={comment.id} className="p-3 rounded-lg border border-white/5 bg-white/[0.02]">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-xs font-medium text-blue-400">User #{comment.userId}</span>
                  <span className="text-[10px] text-muted-foreground">{new Date(comment.createdAt).toLocaleDateString()}</span>
                </div>
                <p className="text-sm mt-1.5">{comment.content}</p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════
// CAMPAIGN DETAIL VIEW
// ═══════════════════════════════════════════════════════════════

function CampaignDetailView({ campaignId }: { campaignId: number }) {
  const [, setLocation] = useLocation();
  const [contributeAmount, setContributeAmount] = useState("");
  const [contributeMessage, setContributeMessage] = useState("");
  const [showContribute, setShowContribute] = useState(false);

  const { data: campaign, isLoading, refetch } = trpc.crowdfunding.get.useQuery({ id: campaignId });

  const contributeMutation = trpc.crowdfunding.contribute.useMutation({
    onSuccess: () => {
      toast.success("Contribution recorded successfully!");
      setShowContribute(false);
      setContributeAmount("");
      setContributeMessage("");
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  if (isLoading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-blue-400" /></div>;

  if (!campaign) {
    return (
      <Card className="p-12 text-center">
        <h3 className="text-lg font-semibold">Campaign not found</h3>
        <Button className="mt-4" onClick={() => setLocation("/crowdfunding")}><ArrowLeft className="h-4 w-4 mr-1" /> Back to Campaigns</Button>
      </Card>
    );
  }

  const isExternal = (campaign as any).source !== "internal";
  const progressPct = Math.min(100, Math.round((campaign.currentAmount / campaign.goalAmount) * 100));

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" onClick={() => setLocation("/crowdfunding")}><ArrowLeft className="h-4 w-4 mr-1" /> Back to Campaigns</Button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="overflow-hidden">
            <div className="h-48 bg-gradient-to-br from-blue-600/20 via-purple-600/20 to-pink-600/20 relative">
              {campaign.imageUrl ? (
                <img loading="lazy" src={campaign.imageUrl} alt={campaign.title} className="w-full h-full object-cover" />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center"><Rocket className="h-16 w-16 text-blue-400/30" /></div>
              )}
              <div className="absolute top-3 left-3 flex gap-2">
                <SourceBadge source={(campaign as any).source || "internal"} />
                <StatusBadge status={campaign.status} />
              </div>
            </div>
            <CardContent className="p-6">
              <h1 className="text-2xl font-bold">{campaign.title}</h1>
              <p className="text-sm text-muted-foreground mt-1">
                by {(campaign as any).creatorName || "Anonymous"}
                {(campaign as any).location ? ` · ${(campaign as any).location}` : ""}
              </p>
              <p className="mt-4 text-sm">{campaign.description}</p>
              {(campaign as any).tags && Array.isArray((campaign as any).tags) && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {(campaign as any).tags.map((tag: string) => (
                    <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-lg">Campaign Story</CardTitle></CardHeader>
            <CardContent>
              <div className="text-sm leading-relaxed whitespace-pre-wrap prose prose-invert max-w-none">
                {campaign.story || campaign.description || "No detailed story provided."}
              </div>
            </CardContent>
          </Card>

          {campaign.updates && (campaign.updates as any[]).length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-lg">Updates ({(campaign.updates as any[]).length})</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {(campaign.updates as any[]).map((update: any) => (
                  <div key={update.id} className="border-l-2 border-blue-500/30 pl-4">
                    <h4 className="font-semibold text-sm">{update.title}</h4>
                    <p className="text-xs text-muted-foreground mt-1">{update.content}</p>
                    <p className="text-[10px] text-muted-foreground mt-2">{new Date(update.createdAt).toLocaleDateString()}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Comments Section */}
          <CommentsSection campaignId={campaignId} />

          {campaign.contributions && (campaign.contributions as any[]).length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-lg">Recent Backers ({(campaign.contributions as any[]).length})</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {(campaign.contributions as any[]).slice(0, 10).map((c: any) => (
                  <div key={c.id} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                    <div>
                      <span className="text-sm font-medium">{c.anonymous ? "Anonymous" : c.backerName}</span>
                      {c.message && <p className="text-xs text-muted-foreground mt-0.5">{c.message}</p>}
                    </div>
                    <span className="text-sm font-semibold text-green-400">${c.amount}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <Card className="border-blue-500/20">
            <CardContent className="p-6 space-y-4">
              <div className="text-center">
                <div className="text-3xl font-bold text-green-400">{formatAmount(campaign.currentAmount)}</div>
                <div className="text-sm text-muted-foreground">raised of {formatAmount(campaign.goalAmount)} goal</div>
              </div>
              <Progress value={progressPct} className="h-3" />
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <div className="text-lg font-bold text-green-400">{(campaign as any).percentFunded || progressPct}%</div>
                  <div className="text-[10px] text-muted-foreground">Funded</div>
                </div>
                <div>
                  <div className="text-lg font-bold">{(campaign.backerCount || 0).toLocaleString()}</div>
                  <div className="text-[10px] text-muted-foreground">Backers</div>
                </div>
                <div>
                  <div className="text-lg font-bold">{(campaign as any).daysLeft ?? "N/A"}</div>
                  <div className="text-[10px] text-muted-foreground">Days Left</div>
                </div>
              </div>

              {isExternal ? (
                <div className="space-y-2">
                  <Button className="w-full bg-green-600 hover:bg-green-500" onClick={() => window.open((campaign as any).externalUrl, "_blank")}>
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Back on {((campaign as any).source || "").charAt(0).toUpperCase() + ((campaign as any).source || "").slice(1)}
                  </Button>
                  <p className="text-[10px] text-center text-muted-foreground">You'll be redirected to the original campaign page</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {!showContribute ? (
                    <div className="space-y-2">
                      <Button className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500" onClick={() => setShowContribute(true)} disabled={campaign.status !== "active"}>
                        <Heart className="h-4 w-4 mr-2" />
                        {campaign.status === "active" ? "Back This Project" : "Campaign Not Active"}
                      </Button>
                      {campaign.status === "active" && (
                        <Button variant="outline" className="w-full border-orange-500/30 text-orange-400 hover:bg-orange-500/10" onClick={() => setShowContribute(true)}>
                          <Zap className="h-4 w-4 mr-2" />
                          Pay with Crypto (BTC, ETH, USDT)
                        </Button>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3 p-3 bg-blue-500/5 rounded-lg border border-blue-500/20">
                      <Label className="text-xs">Contribution Amount ($)</Label>
                      <Input type="number" min="1" placeholder="25" value={contributeAmount} onChange={(e) => setContributeAmount(e.target.value)} />
                      <Label className="text-xs">Message (optional)</Label>
                      <Textarea placeholder="Good luck with the project!" value={contributeMessage} onChange={(e) => setContributeMessage(e.target.value)} rows={2} />
                      <div className="flex gap-2">
                        <Button className="flex-1 bg-green-600 hover:bg-green-500" onClick={() => {
                          const amount = parseInt(contributeAmount);
                          if (!amount || amount < 1) { toast.error("Enter a valid amount"); return; }
                          contributeMutation.mutate({ campaignId: campaign.id, amount, message: contributeMessage || undefined });
                        }} disabled={contributeMutation.isPending}>
                          {contributeMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm"}
                        </Button>
                        <Button variant="outline" onClick={() => setShowContribute(false)}>Cancel</Button>
                      </div>
                      <p className="text-[10px] text-center text-muted-foreground">5% platform fee applies. Crypto payments (BTC, ETH, USDT) also accepted.</p>
                    </div>
                  )}
                </div>
              )}

              <Button variant="outline" className="w-full" onClick={() => { navigator.clipboard.writeText(window.location.href); toast.success("Link copied!"); }}>
                <Share2 className="h-4 w-4 mr-2" /> Share Campaign
              </Button>
            </CardContent>
          </Card>

          {campaign.rewards && (campaign.rewards as any[]).length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Gift className="h-4 w-4 text-yellow-400" /> Reward Tiers</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {(campaign.rewards as any[]).map((reward: any) => (
                  <div key={reward.id} className="p-3 rounded-lg border border-white/10 hover:border-blue-500/30 transition-colors cursor-pointer" onClick={() => { setContributeAmount(String(reward.minAmount)); setShowContribute(true); }}>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sm">{reward.title}</span>
                      <Badge variant="secondary" className="bg-green-500/15 text-green-400">${reward.minAmount}+</Badge>
                    </div>
                    {reward.description && <p className="text-xs text-muted-foreground mt-1">{reward.description}</p>}
                    {reward.maxClaims && <p className="text-[10px] text-muted-foreground mt-1">{reward.claimedCount}/{reward.maxClaims} claimed</p>}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader><CardTitle className="text-sm">Campaign Info</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-xs">
              <div className="flex justify-between"><span className="text-muted-foreground">Category</span><span>{campaign.category || "Technology"}</span></div>
              {(campaign as any).subcategory && <div className="flex justify-between"><span className="text-muted-foreground">Subcategory</span><span>{(campaign as any).subcategory}</span></div>}
              <div className="flex justify-between"><span className="text-muted-foreground">Currency</span><span>{campaign.currency}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Start Date</span><span>{new Date(campaign.startDate).toLocaleDateString()}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">End Date</span><span>{new Date(campaign.endDate).toLocaleDateString()}</span></div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MY CAMPAIGNS VIEW
// ═══════════════════════════════════════════════════════════════

function MyCampaignsView() {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const { data: campaigns, isLoading } = trpc.crowdfunding.myCampaigns.useQuery();

  const updateMutation = trpc.crowdfunding.update.useMutation({
    onSuccess: () => { toast.success("Campaign updated"); utils.crowdfunding.myCampaigns.invalidate(); },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.crowdfunding.delete.useMutation({
    onSuccess: () => { toast.success("Campaign deleted"); utils.crowdfunding.myCampaigns.invalidate(); },
    onError: (err) => toast.error(err.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3"><Rocket className="h-7 w-7 text-blue-400" /> My Campaigns</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage and track your crowdfunding campaigns</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setLocation("/crowdfunding")}><ArrowLeft className="h-4 w-4 mr-1" /> Browse All</Button>
          <Button size="sm" className="bg-gradient-to-r from-blue-600 to-purple-600" onClick={() => setLocation("/crowdfunding/create")}><Plus className="h-4 w-4 mr-1" /> New Campaign</Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-blue-400" /></div>
      ) : !campaigns || campaigns.length === 0 ? (
        <Card className="p-12 text-center">
          <Rocket className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No campaigns yet</h3>
          <p className="text-sm text-muted-foreground mb-4">Create your first crowdfunding campaign to start raising funds for your project.</p>
          <Button className="bg-gradient-to-r from-blue-600 to-purple-600" onClick={() => setLocation("/crowdfunding/create")}><Plus className="h-4 w-4 mr-1" /> Launch Your First Campaign</Button>
        </Card>
      ) : (
        <div className="space-y-4">
          {campaigns.map((campaign: any) => {
            const progressPct = Math.min(100, Math.round((campaign.currentAmount / campaign.goalAmount) * 100));
            return (
              <Card key={campaign.id} className="hover:border-blue-500/30 transition-colors">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold cursor-pointer hover:text-blue-400 transition-colors" onClick={() => setLocation(`/crowdfunding/campaign/${campaign.id}`)}>{campaign.title}</h3>
                        <StatusBadge status={campaign.status} />
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{campaign.description}</p>
                      <div className="mt-3 space-y-1.5">
                        <Progress value={progressPct} className="h-2" />
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span className="text-green-400 font-semibold">{formatAmount(campaign.currentAmount)} / {formatAmount(campaign.goalAmount)}</span>
                          <span>{campaign.backerCount} backers</span>
                          <span>{progressPct}% funded</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      {campaign.status === "draft" && (
                        <>
                          <Button size="sm" className="bg-green-600 hover:bg-green-500" onClick={() => updateMutation.mutate({ id: campaign.id, status: "active" })}>
                            <Rocket className="h-3.5 w-3.5 mr-1" /> Launch
                          </Button>
                          <Button size="sm" variant="outline" className="text-red-400 border-red-500/30 hover:bg-red-500/10" onClick={() => {
                            if (confirm("Delete this campaign? This cannot be undone.")) deleteMutation.mutate({ id: campaign.id });
                          }}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}
                      {campaign.status === "active" && (
                        <Button size="sm" variant="outline" className="text-red-400 border-red-500/30" onClick={() => updateMutation.mutate({ id: campaign.id, status: "ended" })}>End</Button>
                      )}
                      <Button size="sm" variant="outline" onClick={() => setLocation(`/crowdfunding/campaign/${campaign.id}`)}>
                        <Eye className="h-3.5 w-3.5 mr-1" /> View
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// CREATE CAMPAIGN WIZARD (Multi-Step)
// ═══════════════════════════════════════════════════════════════

const WIZARD_STEPS = [
  { id: 1, title: "Basics", icon: Edit3, description: "Name and category" },
  { id: 2, title: "Story", icon: MessageCircle, description: "Tell your story" },
  { id: 3, title: "Funding", icon: Target, description: "Goal and timeline" },
  { id: 4, title: "Rewards", icon: Gift, description: "Backer rewards" },
  { id: 5, title: "Preview", icon: Eye, description: "Review and launch" },
];

interface RewardTier {
  title: string;
  description: string;
  minAmount: number;
  estimatedDelivery: string;
}

function CreateCampaignView() {
  const [, setLocation] = useLocation();
  const [step, setStep] = useState(1);

  // Step 1: Basics
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("technology");
  const [imageUrl, setImageUrl] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [tags, setTags] = useState("");

  // Step 2: Story
  const [story, setStory] = useState("");

  // Step 3: Funding
  const [goalAmount, setGoalAmount] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [endDate, setEndDate] = useState(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]);

  // Step 4: Rewards
  const [rewards, setRewards] = useState<RewardTier[]>([]);
  const [newRewardTitle, setNewRewardTitle] = useState("");
  const [newRewardDesc, setNewRewardDesc] = useState("");
  const [newRewardAmount, setNewRewardAmount] = useState("");
  const [newRewardDelivery, setNewRewardDelivery] = useState("");

  // AI mutations
  const generateStoryMutation = trpc.crowdfunding.generateStory.useMutation({
    onSuccess: (data) => {
      setStory(data.story);
      toast.success("Story generated! Feel free to edit it.");
    },
    onError: (err) => toast.error(err.message),
  });

  const suggestRewardsMutation = trpc.crowdfunding.suggestRewards.useMutation({
    onSuccess: (data) => {
      if (data.rewards.length > 0) {
        setRewards(data.rewards);
        toast.success(`${data.rewards.length} reward tiers suggested! Edit as needed.`);
      } else {
        toast.error("Couldn't generate suggestions. Try again.");
      }
    },
    onError: (err) => toast.error(err.message),
  });

  const createMutation = trpc.crowdfunding.create.useMutation({
    onSuccess: (data) => {
      toast.success("Campaign created successfully!");
      setLocation(`/crowdfunding/campaign/${data.id}`);
    },
    onError: (err) => toast.error(err.message),
  });

  const addRewardMutation = trpc.crowdfunding.addReward.useMutation({
    onError: (err) => toast.error(err.message),
  });

  const canProceed = () => {
    switch (step) {
      case 1: return title.trim() && description.trim() && category;
      case 2: return true; // Story is optional
      case 3: return goalAmount && parseInt(goalAmount) >= 100 && startDate && endDate;
      case 4: return true; // Rewards are optional
      case 5: return true;
      default: return false;
    }
  };

  const handleLaunch = async (asDraft: boolean) => {
    try {
      const result = await createMutation.mutateAsync({
        title: title.trim(),
        description: description.trim(),
        story: story.trim() || undefined,
        category,
        goalAmount: parseInt(goalAmount),
        startDate,
        endDate,
        imageUrl: imageUrl.trim() || undefined,
        videoUrl: videoUrl.trim() || undefined,
        tags: tags.split(",").map(t => t.trim()).filter(Boolean),
      });

      // Add rewards if any
      for (const reward of rewards) {
        try {
          await addRewardMutation.mutateAsync({
            campaignId: result.id,
            title: reward.title,
            description: reward.description,
            minAmount: reward.minAmount,
            estimatedDelivery: reward.estimatedDelivery,
          });
        } catch {
          // Continue even if a reward fails
        }
      }
    } catch {
      // Error handled by mutation
    }
  };

  const addReward = () => {
    if (!newRewardTitle || !newRewardAmount) { toast.error("Reward needs a title and amount"); return; }
    setRewards([...rewards, {
      title: newRewardTitle,
      description: newRewardDesc,
      minAmount: parseInt(newRewardAmount),
      estimatedDelivery: newRewardDelivery || "TBD",
    }]);
    setNewRewardTitle("");
    setNewRewardDesc("");
    setNewRewardAmount("");
    setNewRewardDelivery("");
  };

  return (
    <div className="w-full max-w-3xl space-y-6">
      <Button variant="ghost" size="sm" onClick={() => setLocation("/crowdfunding")}><ArrowLeft className="h-4 w-4 mr-1" /> Back</Button>

      {/* Progress Steps */}
      <div className="flex items-center justify-between px-2">
        {WIZARD_STEPS.map((s, i) => (
          <div key={s.id} className="flex items-center">
            <button
              onClick={() => { if (s.id <= step) setStep(s.id); }}
              className={`flex flex-col items-center gap-1 transition-all ${s.id <= step ? "opacity-100" : "opacity-40"}`}
            >
              <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all ${
                s.id === step ? "border-blue-500 bg-blue-500/20 text-blue-400" :
                s.id < step ? "border-green-500 bg-green-500/20 text-green-400" :
                "border-white/20 text-muted-foreground"
              }`}>
                {s.id < step ? <CheckCircle className="h-5 w-5" /> : <s.icon className="h-5 w-5" />}
              </div>
              <span className="text-[10px] font-medium hidden sm:block">{s.title}</span>
            </button>
            {i < WIZARD_STEPS.length - 1 && (
              <div className={`w-8 sm:w-16 h-0.5 mx-1 ${s.id < step ? "bg-green-500/50" : "bg-white/10"}`} />
            )}
          </div>
        ))}
      </div>

      {/* Step Content */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {(() => { const StepIcon = WIZARD_STEPS[step - 1].icon; return <StepIcon className="h-5 w-5 text-blue-400" />; })()}
            {WIZARD_STEPS[step - 1].title}
          </CardTitle>
          <CardDescription>{WIZARD_STEPS[step - 1].description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">

          {/* STEP 1: Basics */}
          {step === 1 && (
            <>
              <div className="space-y-2">
                <Label>Campaign Title *</Label>
                <Input placeholder="Give your campaign a catchy name" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100} />
                <p className="text-[10px] text-muted-foreground">{title.length}/100 characters</p>
              </div>

              <div className="space-y-2">
                <Label>Short Description *</Label>
                <Textarea placeholder="Explain your project in 2-3 sentences. This appears in campaign cards." value={description} onChange={(e) => setDescription(e.target.value)} rows={3} maxLength={500} />
                <p className="text-[10px] text-muted-foreground">{description.length}/500 characters</p>
              </div>

              <div className="space-y-2">
                <Label>Category *</Label>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat.value}
                      onClick={() => setCategory(cat.value)}
                      className={`p-2 rounded-lg border text-center transition-all text-xs ${
                        category === cat.value
                          ? "border-blue-500 bg-blue-500/10 text-blue-400"
                          : "border-white/10 hover:border-white/20"
                      }`}
                    >
                      <div className="text-lg mb-0.5">{cat.icon}</div>
                      <div>{cat.label}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2"><ImageIcon className="h-4 w-4" /> Cover Image URL</Label>
                <Input placeholder="https://example.com/image.jpg" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} />
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2"><Video className="h-4 w-4" /> Video URL (optional)</Label>
                <Input placeholder="https://youtube.com/watch?v=..." value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} />
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2"><Tag className="h-4 w-4" /> Tags (comma-separated)</Label>
                <Input placeholder="ai, startup, innovation" value={tags} onChange={(e) => setTags(e.target.value)} />
              </div>
            </>
          )}

          {/* STEP 2: Story */}
          {step === 2 && (
            <>
              <div className="flex items-center justify-between">
                <Label>Campaign Story</Label>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-purple-500/30 text-purple-400 hover:bg-purple-500/10"
                  onClick={() => {
                    if (!title || !description) { toast.error("Fill in basics first"); return; }
                    generateStoryMutation.mutate({ title, description, category, goalAmount: parseInt(goalAmount) || 10000 });
                  }}
                  disabled={generateStoryMutation.isPending}
                >
                  {generateStoryMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Sparkles className="h-4 w-4 mr-1" />}
                  AI Write Story
                </Button>
              </div>
              <Textarea
                placeholder="Tell your story in detail. What problem are you solving? Why should people back you? How will the funds be used? The more compelling your story, the more backers you'll attract."
                value={story}
                onChange={(e) => setStory(e.target.value)}
                rows={16}
                className="font-mono text-sm"
              />
              <p className="text-[10px] text-muted-foreground">
                Tip: Great campaigns tell a personal story. Explain the problem, your solution, how funds will be used, and why now is the right time. Markdown formatting is supported.
              </p>
            </>
          )}

          {/* STEP 3: Funding */}
          {step === 3 && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Funding Goal *</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input type="number" min="100" placeholder="10000" value={goalAmount} onChange={(e) => setGoalAmount(e.target.value)} className="pl-9" />
                  </div>
                  <p className="text-[10px] text-muted-foreground">Minimum $100</p>
                </div>
                <div className="space-y-2">
                  <Label>Currency</Label>
                  <Select value={currency} onValueChange={setCurrency}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USD">USD ($)</SelectItem>
                      <SelectItem value="EUR">EUR (&#8364;)</SelectItem>
                      <SelectItem value="GBP">GBP (&pound;)</SelectItem>
                      <SelectItem value="AUD">AUD (A$)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start Date *</Label>
                  <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>End Date *</Label>
                  <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                </div>
              </div>

              {startDate && endDate && (
                <div className="p-4 rounded-lg bg-blue-500/5 border border-blue-500/20">
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-blue-400" />
                    <span>Campaign duration: <strong>{Math.max(0, Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)))} days</strong></span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">Most successful campaigns run 30-45 days. Shorter campaigns create urgency.</p>
                </div>
              )}

              <div className="p-4 rounded-lg bg-yellow-500/5 border border-yellow-500/20">
                <h4 className="text-sm font-semibold flex items-center gap-2"><DollarSign className="h-4 w-4 text-yellow-400" /> Platform Fees</h4>
                <p className="text-xs text-muted-foreground mt-1">5% platform fee on funds raised. Crypto payments (BTC, ETH, USDT) are supported via Binance Pay.</p>
              </div>
            </>
          )}

          {/* STEP 4: Rewards */}
          {step === 4 && (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Reward Tiers</Label>
                  <p className="text-[10px] text-muted-foreground">Optional but highly recommended. Campaigns with rewards raise 3x more on average.</p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-purple-500/30 text-purple-400 hover:bg-purple-500/10"
                  onClick={() => {
                    if (!title) { toast.error("Fill in campaign title first"); return; }
                    suggestRewardsMutation.mutate({ title, category, goalAmount: parseInt(goalAmount) || 10000 });
                  }}
                  disabled={suggestRewardsMutation.isPending}
                >
                  {suggestRewardsMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Sparkles className="h-4 w-4 mr-1" />}
                  AI Suggest Rewards
                </Button>
              </div>

              {/* Existing rewards */}
              {rewards.length > 0 && (
                <div className="space-y-2">
                  {rewards.map((reward, idx) => (
                    <div key={idx} className="p-3 rounded-lg border border-white/10 flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm">{reward.title}</span>
                          <Badge variant="secondary" className="bg-green-500/15 text-green-400">${reward.minAmount}+</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{reward.description}</p>
                        {reward.estimatedDelivery && <p className="text-[10px] text-muted-foreground mt-0.5">Est. delivery: {reward.estimatedDelivery}</p>}
                      </div>
                      <Button size="sm" variant="ghost" className="text-red-400 hover:text-red-300" onClick={() => setRewards(rewards.filter((_, i) => i !== idx))}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add reward form */}
              <div className="p-4 rounded-lg border border-dashed border-white/20 space-y-3">
                <h4 className="text-sm font-medium flex items-center gap-2"><Plus className="h-4 w-4" /> Add Reward Tier</h4>
                <div className="grid grid-cols-2 gap-3">
                  <Input placeholder="Reward title" value={newRewardTitle} onChange={(e) => setNewRewardTitle(e.target.value)} />
                  <Input type="number" placeholder="Min amount ($)" value={newRewardAmount} onChange={(e) => setNewRewardAmount(e.target.value)} />
                </div>
                <Textarea placeholder="What backers get at this tier..." value={newRewardDesc} onChange={(e) => setNewRewardDesc(e.target.value)} rows={2} />
                <div className="flex gap-3">
                  <Input placeholder="Est. delivery (e.g. March 2026)" value={newRewardDelivery} onChange={(e) => setNewRewardDelivery(e.target.value)} className="flex-1" />
                  <Button onClick={addReward} variant="outline"><Plus className="h-4 w-4 mr-1" /> Add</Button>
                </div>
              </div>
            </>
          )}

          {/* STEP 5: Preview */}
          {step === 5 && (
            <>
              <div className="rounded-lg border border-white/10 overflow-hidden">
                <div className="h-32 bg-gradient-to-br from-blue-600/20 via-purple-600/20 to-pink-600/20 relative">
                  {imageUrl ? (
                    <img src={imageUrl} alt={title} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center"><Rocket className="h-12 w-12 text-blue-400/30" /></div>
                  )}
                  <div className="absolute top-2 left-2 flex gap-1.5">
                    <SourceBadge source="internal" />
                    <StatusBadge status="draft" />
                  </div>
                </div>
                <div className="p-5 space-y-3">
                  <h2 className="text-xl font-bold">{title || "Untitled Campaign"}</h2>
                  <p className="text-sm text-muted-foreground">{description || "No description"}</p>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="flex items-center gap-1"><Target className="h-4 w-4 text-green-400" /> Goal: <strong>{formatAmount(parseInt(goalAmount) || 0)}</strong></span>
                    <span className="flex items-center gap-1"><Clock className="h-4 w-4 text-blue-400" /> {Math.max(0, Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)))} days</span>
                    <span className="flex items-center gap-1"><Tag className="h-4 w-4 text-purple-400" /> {CATEGORIES.find(c => c.value === category)?.label || category}</span>
                  </div>
                  {story && (
                    <div className="mt-3 p-3 rounded bg-white/[0.02] border border-white/5">
                      <h4 className="text-xs font-semibold text-muted-foreground mb-1">STORY PREVIEW</h4>
                      <p className="text-xs line-clamp-4 whitespace-pre-wrap">{story}</p>
                    </div>
                  )}
                  {rewards.length > 0 && (
                    <div className="mt-3">
                      <h4 className="text-xs font-semibold text-muted-foreground mb-2">REWARD TIERS ({rewards.length})</h4>
                      <div className="flex gap-2 flex-wrap">
                        {rewards.map((r, i) => (
                          <Badge key={i} variant="secondary">{r.title} - ${r.minAmount}+</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {tags && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {tags.split(",").map(t => t.trim()).filter(Boolean).map((tag) => (
                        <Badge key={tag} variant="outline" className="text-[10px]">{tag}</Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="p-4 rounded-lg bg-green-500/5 border border-green-500/20">
                <h4 className="text-sm font-semibold flex items-center gap-2"><CheckCircle className="h-4 w-4 text-green-400" /> Ready to Launch?</h4>
                <p className="text-xs text-muted-foreground mt-1">Your campaign will be created as a draft. You can review it and launch it when you're ready from the "My Campaigns" page.</p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Navigation Buttons */}
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={() => step > 1 ? setStep(step - 1) : setLocation("/crowdfunding")} disabled={createMutation.isPending}>
          <ChevronLeft className="h-4 w-4 mr-1" />
          {step === 1 ? "Cancel" : "Back"}
        </Button>

        <div className="flex gap-2">
          {step === 5 ? (
            <>
              <Button
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500"
                onClick={() => handleLaunch(false)}
                disabled={createMutation.isPending}
              >
                {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Rocket className="h-4 w-4 mr-1" />}
                Create Campaign
              </Button>
            </>
          ) : (
            <Button
              onClick={() => setStep(step + 1)}
              disabled={!canProceed()}
              className="bg-blue-600 hover:bg-blue-500"
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN PAGE ROUTER
// ═══════════════════════════════════════════════════════════════

export default function CrowdfundingPage() {
  const [location] = useLocation();
  const path = location.replace(/^\/crowdfunding\/?/, "");

  const campaignMatch = path.match(/^campaign\/(\d+)/);
  if (campaignMatch) return <CampaignDetailView campaignId={parseInt(campaignMatch[1])} />;
  if (path === "my-campaigns") return <MyCampaignsView />;
  if (path === "create") return <CreateCampaignView />;
  return <BrowseView />;
}
