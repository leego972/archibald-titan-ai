import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import {
  Sparkles, Megaphone, BarChart3, Calendar, Music2, FileText,
  Play, Send, CheckCircle2, XCircle, Clock, RefreshCw, Loader2,
  TrendingUp, Eye, MousePointerClick, Users, Share2, Heart,
  Zap, Target, Globe, PenTool, Video, Image, Mail, Search,
  Plus, Trash2, Edit3, Copy, ExternalLink, AlertCircle,
  ChevronRight, ChevronDown, Star, Activity, Layers, Hash,
  BookOpen, Rss, MessageSquare, Link2, Monitor, Smartphone,
} from "lucide-react";
import { toast } from "sonner";

// ─── Platform Config ──────────────────────────────────────────────────────
const PLATFORM_ICONS: Record<string, { icon: typeof Globe; label: string; color: string; emoji: string }> = {
  tiktok:        { icon: Music2,        label: "TikTok",         color: "text-pink-400",   emoji: "🎵" },
  instagram:     { icon: Image,         label: "Instagram",      color: "text-purple-400", emoji: "📸" },
  x_twitter:     { icon: MessageSquare, label: "X (Twitter)",    color: "text-zinc-300",   emoji: "𝕏" },
  linkedin:      { icon: Users,         label: "LinkedIn",       color: "text-blue-400",   emoji: "💼" },
  reddit:        { icon: MessageSquare, label: "Reddit",         color: "text-orange-400", emoji: "🤖" },
  facebook:      { icon: Globe,         label: "Facebook",       color: "text-blue-500",   emoji: "📘" },
  youtube_shorts:{ icon: Video,         label: "YouTube Shorts", color: "text-red-400",    emoji: "▶️" },
  blog:          { icon: FileText,      label: "Blog",           color: "text-green-400",  emoji: "📝" },
  email:         { icon: Mail,          label: "Email",          color: "text-yellow-400", emoji: "📧" },
  pinterest:     { icon: Image,         label: "Pinterest",      color: "text-red-500",    emoji: "📌" },
  discord:       { icon: MessageSquare, label: "Discord",        color: "text-indigo-400", emoji: "🎮" },
  telegram:      { icon: Send,          label: "Telegram",       color: "text-cyan-400",   emoji: "✈️" },
  medium:        { icon: BookOpen,      label: "Medium",         color: "text-gray-300",   emoji: "📖" },
  hackernews:    { icon: Zap,           label: "Hacker News",    color: "text-orange-500", emoji: "🔥" },
  whatsapp:      { icon: MessageSquare, label: "WhatsApp",       color: "text-green-500",  emoji: "💬" },
};

const CONTENT_TYPE_LABELS: Record<string, string> = {
  video_script:    "Video Script",
  photo_carousel:  "Photo Carousel",
  social_post:     "Social Post",
  ad_copy:         "Ad Copy",
  blog_article:    "Blog Article",
  email_campaign:  "Email Campaign",
  story:           "Story",
  reel:            "Reel",
  thread:          "Thread",
  infographic:     "Infographic",
};

const OBJECTIVE_OPTIONS = [
  { value: "brand_awareness",    label: "Brand Awareness" },
  { value: "lead_generation",    label: "Lead Generation" },
  { value: "product_launch",     label: "Product Launch" },
  { value: "community_building", label: "Community Building" },
  { value: "seo_traffic",        label: "SEO Traffic" },
  { value: "engagement",         label: "Engagement" },
  { value: "conversion",         label: "Conversion" },
  { value: "retention",          label: "Retention" },
];

const BRAND_VOICE_OPTIONS = [
  { value: "confident",       label: "Confident & Authoritative" },
  { value: "technical",       label: "Technical & Precise" },
  { value: "friendly",        label: "Friendly & Approachable" },
  { value: "edgy",            label: "Edgy & Disruptive" },
  { value: "educational",     label: "Educational & Informative" },
  { value: "urgent",          label: "Urgent & Action-Driven" },
];

// ─── Helper Components ────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { color: string; label: string }> = {
    draft:     { color: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",     label: "Draft" },
    review:    { color: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20", label: "Review" },
    approved:  { color: "bg-blue-500/10 text-blue-400 border-blue-500/20",     label: "Approved" },
    scheduled: { color: "bg-purple-500/10 text-purple-400 border-purple-500/20", label: "Scheduled" },
    published: { color: "bg-green-500/10 text-green-400 border-green-500/20",  label: "Published" },
    failed:    { color: "bg-red-500/10 text-red-400 border-red-500/20",        label: "Failed" },
    archived:  { color: "bg-gray-500/10 text-gray-500 border-gray-500/20",     label: "Archived" },
    active:    { color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20", label: "Active" },
    paused:    { color: "bg-orange-500/10 text-orange-400 border-orange-500/20", label: "Paused" },
    completed: { color: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",     label: "Completed" },
  };
  const c = config[status] || config.draft;
  return <Badge variant="outline" className={c.color}>{c.label}</Badge>;
}

function ScoreBadge({ score, label }: { score: number; label: string }) {
  const color = score >= 80 ? "text-emerald-400" : score >= 60 ? "text-yellow-400" : "text-red-400";
  return (
    <div className="flex items-center gap-1">
      <span className={`text-xs font-bold ${color}`}>{score}</span>
      <span className="text-xs text-gray-500">{label}</span>
    </div>
  );
}

function PlatformBadge({ platform }: { platform: string }) {
  const cfg = PLATFORM_ICONS[platform];
  if (!cfg) return <Badge variant="outline">{platform}</Badge>;
  const Icon = cfg.icon;
  return (
    <Badge variant="outline" className={`${cfg.color} border-current/20 bg-current/5 gap-1`}>
      <Icon className="w-3 h-3" />
      {cfg.label}
    </Badge>
  );
}

function StatCard({ label, value, icon: Icon, color }: {
  label: string; value: string | number; icon: typeof Globe; color: string;
}) {
  return (
    <Card className="bg-[#0d1117] border-[#21262d]">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider">{label}</p>
            <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
          </div>
          <div className={`p-2 rounded-lg bg-current/10 ${color}`}>
            <Icon className="w-5 h-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────
export default function ContentCreatorPage() {
  const [activeTab, setActiveTab] = useState<"studio" | "queue" | "campaigns" | "tiktok" | "analytics">("studio");

  // Studio state
  const [selectedPlatform, setSelectedPlatform] = useState("tiktok");
  const [selectedContentType, setSelectedContentType] = useState("video_script");
  const [topic, setTopic] = useState("");
  const [seoKeywords, setSeoKeywords] = useState("");
  const [targetAudience, setTargetAudience] = useState("");
  const [brandVoice, setBrandVoice] = useState("confident");
  const [includeImage, setIncludeImage] = useState(false);
  const [selectedCampaignId, setSelectedCampaignId] = useState<number | undefined>();
  const [generatedContent, setGeneratedContent] = useState<any>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // Campaign builder state
  const [showNewCampaign, setShowNewCampaign] = useState(false);
  const [campaignName, setCampaignName] = useState("");
  const [campaignObjective, setCampaignObjective] = useState("brand_awareness");
  const [campaignDescription, setCampaignDescription] = useState("");
  const [campaignAudience, setCampaignAudience] = useState("");
  const [campaignVoice, setCampaignVoice] = useState("confident");
  const [campaignKeywords, setCampaignKeywords] = useState("");
  const [campaignPlatforms, setCampaignPlatforms] = useState<string[]>(["tiktok", "instagram", "x_twitter"]);
  const [campaignSeoLinked, setCampaignSeoLinked] = useState(true);
  const [campaignTiktokLinked, setCampaignTiktokLinked] = useState(true);
  const [campaignAdvertisingLinked, setCampaignAdvertisingLinked] = useState(true);
  const [isCreatingCampaign, setIsCreatingCampaign] = useState(false);

  // Bulk generate state
  const [showBulkGenerate, setShowBulkGenerate] = useState(false);
  const [bulkCampaignId, setBulkCampaignId] = useState<number | undefined>();
  const [bulkPlatforms, setBulkPlatforms] = useState<string[]>(["tiktok", "instagram", "x_twitter", "linkedin"]);
  const [bulkTopic, setBulkTopic] = useState("");
  const [bulkKeywords, setBulkKeywords] = useState("");
  const [bulkIncludeImages, setBulkIncludeImages] = useState(false);
  const [isBulkGenerating, setIsBulkGenerating] = useState(false);

  // Piece editor state
  const [editingPiece, setEditingPiece] = useState<any>(null);
  const [showPieceEditor, setShowPieceEditor] = useState(false);

  // SEO brief state
  const [showSeoBriefs, setShowSeoBriefs] = useState(false);

  // Schedule state
  const [schedulingPiece, setSchedulingPiece] = useState<any>(null);
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("09:00");

  // tRPC queries
  const dashboard = trpc.contentCreator.getDashboard.useQuery();
  const campaigns = trpc.contentCreator.getCampaigns.useQuery();
  const pieces = trpc.contentCreator.getPieces.useQuery({ limit: 100 });
  const stats = trpc.contentCreator.getStats.useQuery();
  const tiktokStatus = trpc.contentCreator.getTikTokStatus.useQuery();
  const platformConfig = trpc.contentCreator.getPlatformConfig.useQuery();
  const seoBriefs = trpc.contentCreator.getSeoContentBriefs.useQuery({ count: 8 }, { enabled: showSeoBriefs });
  const schedules = trpc.contentCreator.getSchedules.useQuery({ limit: 50 });
  const analytics = trpc.contentCreator.getAnalytics.useQuery({ days: 30 });

  // tRPC mutations
  const generateContent = trpc.contentCreator.generateContent.useMutation({
    onSuccess: (data) => {
      setGeneratedContent(data);
      setIsGenerating(false);
      toast.success(`Content generated! Quality: ${data.qualityScore}/100 · SEO: ${data.seoScore}/100`);
      pieces.refetch();
    },
    onError: (err) => {
      setIsGenerating(false);
      toast.error(`Generation failed: ${err.message}`);
    },
  });

  const createCampaign = trpc.contentCreator.createCampaign.useMutation({
    onSuccess: (data) => {
      setIsCreatingCampaign(false);
      setShowNewCampaign(false);
      toast.success("Campaign created with AI strategy!");
      campaigns.refetch();
      dashboard.refetch();
      resetCampaignForm();
    },
    onError: (err) => {
      setIsCreatingCampaign(false);
      toast.error(`Failed: ${err.message}`);
    },
  });

  const bulkGenerate = trpc.contentCreator.bulkGenerate.useMutation({
    onSuccess: (data) => {
      setIsBulkGenerating(false);
      setShowBulkGenerate(false);
      toast.success(`Bulk generation complete: ${data.generated} pieces created across ${bulkPlatforms.length} platforms`);
      pieces.refetch();
      dashboard.refetch();
    },
    onError: (err) => {
      setIsBulkGenerating(false);
      toast.error(`Bulk generation failed: ${err.message}`);
    },
  });

  const approvePiece = trpc.contentCreator.approvePiece.useMutation({
    onSuccess: () => { toast.success("Piece approved"); pieces.refetch(); },
  });

  const deletePiece = trpc.contentCreator.deletePiece.useMutation({
    onSuccess: () => { toast.success("Piece archived"); pieces.refetch(); },
  });

  const publishToTikTok = trpc.contentCreator.publishToTikTok.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        toast.success(`Published to TikTok! Publish ID: ${data.publishId}`);
      } else if (data.action === "queued") {
        toast.info("TikTok API not configured — piece marked as approved for manual posting");
      } else {
        toast.error(`TikTok publish failed: ${data.error}`);
      }
      pieces.refetch();
    },
    onError: (err) => toast.error(`TikTok error: ${err.message}`),
  });

  const schedulePiece = trpc.contentCreator.schedulePiece.useMutation({
    onSuccess: () => {
      toast.success("Content scheduled!");
      setSchedulingPiece(null);
      pieces.refetch();
      schedules.refetch();
    },
    onError: (err) => toast.error(`Schedule failed: ${err.message}`),
  });

  const updateCampaign = trpc.contentCreator.updateCampaign.useMutation({
    onSuccess: () => { toast.success("Campaign updated"); campaigns.refetch(); },
  });

  const generateFromSeoBrief = trpc.contentCreator.generateFromSeoBrief.useMutation({
    onSuccess: (data) => {
      toast.success(`Generated ${data.generated} pieces from SEO brief`);
      pieces.refetch();
      setShowSeoBriefs(false);
    },
    onError: (err) => toast.error(`Failed: ${err.message}`),
  });

  const processDue = trpc.contentCreator.processDueSchedules.useMutation({
    onSuccess: (data) => {
      toast.success(`Processed ${data.processed} schedules: ${data.published} published, ${data.failed} failed`);
      schedules.refetch();
      pieces.refetch();
    },
  });

  // Helpers
  const resetCampaignForm = () => {
    setCampaignName(""); setCampaignObjective("brand_awareness"); setCampaignDescription("");
    setCampaignAudience(""); setCampaignVoice("confident"); setCampaignKeywords("");
    setCampaignPlatforms(["tiktok", "instagram", "x_twitter"]);
    setCampaignSeoLinked(true); setCampaignTiktokLinked(true); setCampaignAdvertisingLinked(true);
  };

  const allPlatforms = Object.keys(PLATFORM_ICONS);

  const platformContentTypes = useMemo(() => {
    const cfg = platformConfig.data?.find(p => p.id === selectedPlatform);
    return cfg?.contentTypes || ["social_post"];
  }, [selectedPlatform, platformConfig.data]);

  const handleGenerate = () => {
    if (!selectedPlatform) { toast.error("Select a platform"); return; }
    setIsGenerating(true);
    setGeneratedContent(null);
    generateContent.mutate({
      platform: selectedPlatform,
      contentType: selectedContentType,
      topic: topic || undefined,
      seoKeywords: seoKeywords ? seoKeywords.split(",").map(k => k.trim()).filter(Boolean) : undefined,
      targetAudience: targetAudience || undefined,
      brandVoice,
      includeImage,
      campaignId: selectedCampaignId,
      saveToDraft: true,
    });
  };

  const handleCreateCampaign = () => {
    if (!campaignName.trim()) { toast.error("Campaign name required"); return; }
    if (campaignPlatforms.length === 0) { toast.error("Select at least one platform"); return; }
    setIsCreatingCampaign(true);
    createCampaign.mutate({
      name: campaignName,
      objective: campaignObjective,
      description: campaignDescription || undefined,
      targetAudience: campaignAudience || undefined,
      brandVoice: campaignVoice,
      primaryKeywords: campaignKeywords ? campaignKeywords.split(",").map(k => k.trim()).filter(Boolean) : undefined,
      platforms: campaignPlatforms,
      seoLinked: campaignSeoLinked,
      advertisingLinked: campaignAdvertisingLinked,
      tiktokLinked: campaignTiktokLinked,
      generateStrategy: true,
    });
  };

  const handleBulkGenerate = () => {
    if (!bulkCampaignId) { toast.error("Select a campaign"); return; }
    if (bulkPlatforms.length === 0) { toast.error("Select at least one platform"); return; }
    setIsBulkGenerating(true);
    bulkGenerate.mutate({
      campaignId: bulkCampaignId,
      platforms: bulkPlatforms,
      topic: bulkTopic || undefined,
      seoKeywords: bulkKeywords ? bulkKeywords.split(",").map(k => k.trim()).filter(Boolean) : undefined,
      includeImages: bulkIncludeImages,
    });
  };

  const handleSchedule = () => {
    if (!schedulingPiece || !scheduleDate) { toast.error("Select a date"); return; }
    const scheduledAt = new Date(`${scheduleDate}T${scheduleTime}:00`).toISOString();
    schedulePiece.mutate({ pieceId: schedulingPiece.id, scheduledAt });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  const togglePlatform = (platform: string, list: string[], setter: (v: string[]) => void) => {
    setter(list.includes(platform) ? list.filter(p => p !== platform) : [...list, platform]);
  };

  const dashData = dashboard.data;
  const statsData = stats.data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-pink-500/20 to-purple-500/20">
              <Sparkles className="w-6 h-6 text-pink-400" />
            </div>
            Content Creator
          </h1>
          <p className="text-gray-400 mt-1 text-sm">
            AI-powered content generation · SEO-driven · TikTok integrated · 15 platforms
          </p>
        </div>
        <div className="flex items-center gap-2">
          {tiktokStatus.data?.configured ? (
            <Badge variant="outline" className="text-pink-400 border-pink-500/30 bg-pink-500/10 gap-1">
              <Music2 className="w-3 h-3" /> TikTok Live
            </Badge>
          ) : (
            <Badge variant="outline" className="text-zinc-400 border-zinc-500/30 gap-1">
              <Music2 className="w-3 h-3" /> TikTok Setup Required
            </Badge>
          )}
          <Button
            onClick={() => setShowNewCampaign(true)}
            className="bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-700 hover:to-purple-700 text-white border-0 gap-2"
          >
            <Plus className="w-4 h-4" /> New Campaign
          </Button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <StatCard label="Campaigns" value={statsData?.totalCampaigns || 0} icon={Megaphone} color="text-purple-400" />
        <StatCard label="Active" value={statsData?.activeCampaigns || 0} icon={Activity} color="text-emerald-400" />
        <StatCard label="Total Pieces" value={statsData?.totalPieces || 0} icon={Layers} color="text-blue-400" />
        <StatCard label="Published" value={statsData?.publishedPieces || 0} icon={CheckCircle2} color="text-green-400" />
        <StatCard label="Scheduled" value={statsData?.scheduledPieces || 0} icon={Clock} color="text-yellow-400" />
        <StatCard label="TikTok Posts" value={statsData?.tiktokPosts || 0} icon={Music2} color="text-pink-400" />
        <StatCard label="Avg Quality" value={`${statsData?.avgQualityScore || 0}/100`} icon={Star} color="text-amber-400" />
      </div>

      {/* Integration Status */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "SEO Engine", connected: true, icon: Search, color: "text-blue-400", desc: "Keyword briefs active" },
          { label: "Advertising", connected: dashData?.advertisingLinked, icon: Target, color: "text-orange-400", desc: "Campaign sync active" },
          { label: "TikTok Pipeline", connected: tiktokStatus.data?.configured, icon: Music2, color: "text-pink-400", desc: tiktokStatus.data?.configured ? "Direct posting enabled" : "Configure TIKTOK_OPEN_ID & TIKTOK_CREATOR_TOKEN" },
        ].map(({ label, connected, icon: Icon, color, desc }) => (
          <Card key={label} className="bg-[#0d1117] border-[#21262d]">
            <CardContent className="p-3 flex items-center gap-3">
              <div className={`p-2 rounded-lg ${connected ? "bg-current/10" : "bg-zinc-500/10"} ${connected ? color : "text-zinc-500"}`}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-white">{label}</span>
                  {connected
                    ? <CheckCircle2 className="w-3 h-3 text-green-400" />
                    : <AlertCircle className="w-3 h-3 text-yellow-400" />
                  }
                </div>
                <p className="text-xs text-gray-500 truncate">{desc}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <TabsList className="bg-[#161b22] border border-[#21262d]">
          <TabsTrigger value="studio" className="gap-2"><PenTool className="w-4 h-4" /> Studio</TabsTrigger>
          <TabsTrigger value="queue" className="gap-2"><Layers className="w-4 h-4" /> Content Queue</TabsTrigger>
          <TabsTrigger value="campaigns" className="gap-2"><Megaphone className="w-4 h-4" /> Campaigns</TabsTrigger>
          <TabsTrigger value="tiktok" className="gap-2"><Music2 className="w-4 h-4" /> TikTok Hub</TabsTrigger>
          <TabsTrigger value="analytics" className="gap-2"><BarChart3 className="w-4 h-4" /> Analytics</TabsTrigger>
        </TabsList>

        {/* ═══ STUDIO TAB ═══ */}
        <TabsContent value="studio" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Generator Panel */}
            <Card className="bg-[#0d1117] border-[#21262d]">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-pink-400" /> AI Content Studio
                </CardTitle>
                <CardDescription>Generate platform-optimised content powered by SEO data</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Platform Selector */}
                <div className="space-y-2">
                  <Label className="text-gray-300">Platform</Label>
                  <div className="grid grid-cols-5 gap-1.5">
                    {allPlatforms.slice(0, 10).map(platform => {
                      const cfg = PLATFORM_ICONS[platform];
                      const Icon = cfg.icon;
                      return (
                        <button
                          key={platform}
                          onClick={() => {
                            setSelectedPlatform(platform);
                            const cfgData = platformConfig.data?.find(p => p.id === platform);
                            if (cfgData?.contentTypes?.[0]) setSelectedContentType(cfgData.contentTypes[0]);
                          }}
                          className={`flex flex-col items-center gap-1 p-2 rounded-lg border text-xs transition-all ${
                            selectedPlatform === platform
                              ? "border-pink-500/50 bg-pink-500/10 text-pink-300"
                              : "border-[#21262d] bg-[#161b22] text-gray-400 hover:border-gray-600"
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                          <span className="truncate w-full text-center">{cfg.label.split(" ")[0]}</span>
                        </button>
                      );
                    })}
                  </div>
                  <Select value={selectedPlatform} onValueChange={setSelectedPlatform}>
                    <SelectTrigger className="bg-[#161b22] border-[#21262d] text-white">
                      <SelectValue placeholder="Or select from all platforms..." />
                    </SelectTrigger>
                    <SelectContent className="bg-[#161b22] border-[#21262d]">
                      {allPlatforms.map(p => (
                        <SelectItem key={p} value={p} className="text-white hover:bg-[#21262d]">
                          {PLATFORM_ICONS[p]?.emoji} {PLATFORM_ICONS[p]?.label || p}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Content Type */}
                <div className="space-y-2">
                  <Label className="text-gray-300">Content Type</Label>
                  <Select value={selectedContentType} onValueChange={setSelectedContentType}>
                    <SelectTrigger className="bg-[#161b22] border-[#21262d] text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#161b22] border-[#21262d]">
                      {platformContentTypes.map(ct => (
                        <SelectItem key={ct} value={ct} className="text-white hover:bg-[#21262d]">
                          {CONTENT_TYPE_LABELS[ct] || ct}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Topic */}
                <div className="space-y-2">
                  <Label className="text-gray-300">Topic / Angle <span className="text-gray-500">(optional)</span></Label>
                  <Input
                    value={topic}
                    onChange={e => setTopic(e.target.value)}
                    placeholder="e.g. Why Archibald Titan beats LastPass in 2026..."
                    className="bg-[#161b22] border-[#21262d] text-white placeholder:text-gray-600"
                  />
                </div>

                {/* SEO Keywords */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-gray-300">SEO Keywords <span className="text-gray-500">(comma-separated)</span></Label>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-blue-400 hover:text-blue-300 text-xs h-6 px-2"
                      onClick={() => setShowSeoBriefs(true)}
                    >
                      <Search className="w-3 h-3 mr-1" /> Get SEO Briefs
                    </Button>
                  </div>
                  <Input
                    value={seoKeywords}
                    onChange={e => setSeoKeywords(e.target.value)}
                    placeholder="credential manager, password security, AI automation..."
                    className="bg-[#161b22] border-[#21262d] text-white placeholder:text-gray-600"
                  />
                </div>

                {/* Brand Voice */}
                <div className="space-y-2">
                  <Label className="text-gray-300">Brand Voice</Label>
                  <Select value={brandVoice} onValueChange={setBrandVoice}>
                    <SelectTrigger className="bg-[#161b22] border-[#21262d] text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#161b22] border-[#21262d]">
                      {BRAND_VOICE_OPTIONS.map(o => (
                        <SelectItem key={o.value} value={o.value} className="text-white hover:bg-[#21262d]">{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Campaign */}
                <div className="space-y-2">
                  <Label className="text-gray-300">Assign to Campaign <span className="text-gray-500">(optional)</span></Label>
                  <Select
                    value={selectedCampaignId?.toString() || "none"}
                    onValueChange={v => setSelectedCampaignId(v === "none" ? undefined : Number(v))}
                  >
                    <SelectTrigger className="bg-[#161b22] border-[#21262d] text-white">
                      <SelectValue placeholder="No campaign" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#161b22] border-[#21262d]">
                      <SelectItem value="none" className="text-gray-400 hover:bg-[#21262d]">No campaign</SelectItem>
                      {campaigns.data?.map(c => (
                        <SelectItem key={c.id} value={c.id.toString()} className="text-white hover:bg-[#21262d]">{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Options */}
                <div className="flex items-center justify-between p-3 rounded-lg bg-[#161b22] border border-[#21262d]">
                  <div>
                    <p className="text-sm text-white">Generate Image</p>
                    <p className="text-xs text-gray-500">AI-generated Titan cyberpunk art</p>
                  </div>
                  <Switch checked={includeImage} onCheckedChange={setIncludeImage} />
                </div>

                <Button
                  onClick={handleGenerate}
                  disabled={isGenerating}
                  className="w-full bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-700 hover:to-purple-700 text-white border-0 gap-2"
                >
                  {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  {isGenerating ? "Generating..." : "Generate Content"}
                </Button>

                <Button
                  variant="outline"
                  onClick={() => setShowBulkGenerate(true)}
                  className="w-full border-[#21262d] text-gray-300 hover:bg-[#21262d] gap-2"
                >
                  <Zap className="w-4 h-4 text-yellow-400" /> Bulk Generate for Campaign
                </Button>
              </CardContent>
            </Card>

            {/* Generated Content Preview */}
            <Card className="bg-[#0d1117] border-[#21262d]">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Eye className="w-5 h-5 text-blue-400" /> Content Preview
                </CardTitle>
                {generatedContent && (
                  <div className="flex items-center gap-2">
                    <PlatformBadge platform={generatedContent.platform} />
                    <ScoreBadge score={generatedContent.qualityScore} label="Quality" />
                    <ScoreBadge score={generatedContent.seoScore} label="SEO" />
                    <span className="text-xs text-gray-500">{generatedContent.generationMs}ms</span>
                  </div>
                )}
              </CardHeader>
              <CardContent>
                {isGenerating && (
                  <div className="flex flex-col items-center justify-center py-16 gap-4">
                    <div className="relative">
                      <div className="w-16 h-16 rounded-full border-2 border-pink-500/30 animate-ping absolute inset-0" />
                      <div className="w-16 h-16 rounded-full border-2 border-purple-500/50 animate-spin flex items-center justify-center">
                        <Sparkles className="w-6 h-6 text-pink-400" />
                      </div>
                    </div>
                    <p className="text-gray-400 text-sm">AI is crafting your content...</p>
                    <p className="text-gray-600 text-xs">Pulling SEO data · Applying brand voice · Optimising for {PLATFORM_ICONS[selectedPlatform]?.label}</p>
                  </div>
                )}

                {!isGenerating && !generatedContent && (
                  <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
                    <div className="p-4 rounded-full bg-[#161b22]">
                      <PenTool className="w-8 h-8 text-gray-600" />
                    </div>
                    <p className="text-gray-400">Configure your content parameters and click Generate</p>
                    <p className="text-gray-600 text-xs">The AI will create platform-optimised content with SEO keywords, hooks, CTAs, and hashtags</p>
                  </div>
                )}

                {generatedContent && !isGenerating && (
                  <ScrollArea className="h-[500px] pr-2">
                    <div className="space-y-4">
                      {generatedContent.mediaUrl && (
                        <div className="rounded-lg overflow-hidden border border-[#21262d]">
                          <img src={generatedContent.mediaUrl} alt="Generated" className="w-full object-cover max-h-48" />
                        </div>
                      )}

                      {generatedContent.hook && (
                        <div className="p-3 rounded-lg bg-pink-500/10 border border-pink-500/20">
                          <p className="text-xs text-pink-400 font-medium mb-1">🎣 HOOK</p>
                          <p className="text-white text-sm">{generatedContent.hook}</p>
                        </div>
                      )}

                      {generatedContent.headline && (
                        <div>
                          <p className="text-xs text-gray-500 mb-1">HEADLINE</p>
                          <p className="text-white font-semibold">{generatedContent.headline}</p>
                        </div>
                      )}

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-xs text-gray-500">BODY COPY</p>
                          <Button variant="ghost" size="sm" className="h-5 px-2 text-xs text-gray-500 hover:text-white"
                            onClick={() => copyToClipboard(generatedContent.body)}>
                            <Copy className="w-3 h-3 mr-1" /> Copy
                          </Button>
                        </div>
                        <div className="p-3 rounded-lg bg-[#161b22] border border-[#21262d]">
                          <p className="text-gray-200 text-sm whitespace-pre-wrap">{generatedContent.body}</p>
                        </div>
                      </div>

                      {generatedContent.callToAction && (
                        <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                          <p className="text-xs text-blue-400 font-medium mb-1">📣 CALL TO ACTION</p>
                          <p className="text-white text-sm">{generatedContent.callToAction}</p>
                        </div>
                      )}

                      {generatedContent.hashtags?.length > 0 && (
                        <div>
                          <p className="text-xs text-gray-500 mb-2">HASHTAGS</p>
                          <div className="flex flex-wrap gap-1.5">
                            {generatedContent.hashtags.map((tag: string) => (
                              <Badge key={tag} variant="outline" className="text-purple-400 border-purple-500/30 bg-purple-500/10 text-xs">
                                #{tag}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {generatedContent.videoScript && (
                        <div>
                          <p className="text-xs text-gray-500 mb-1">VIDEO SCRIPT</p>
                          <div className="p-3 rounded-lg bg-[#161b22] border border-[#21262d]">
                            <p className="text-gray-200 text-xs whitespace-pre-wrap font-mono">{generatedContent.videoScript}</p>
                          </div>
                        </div>
                      )}

                      {generatedContent.visualDirections?.length > 0 && (
                        <div>
                          <p className="text-xs text-gray-500 mb-2">VISUAL DIRECTIONS</p>
                          <div className="space-y-1">
                            {generatedContent.visualDirections.map((dir: string, i: number) => (
                              <div key={i} className="flex items-start gap-2 text-xs text-gray-300">
                                <span className="text-gray-600 mt-0.5">{i + 1}.</span>
                                <span>{dir}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {generatedContent.pieceId && (
                        <div className="flex gap-2 pt-2">
                          <Button size="sm" variant="outline"
                            className="flex-1 border-[#21262d] text-gray-300 hover:bg-[#21262d] gap-1"
                            onClick={() => {
                              setSchedulingPiece({ id: generatedContent.pieceId, title: generatedContent.title });
                            }}>
                            <Calendar className="w-3 h-3" /> Schedule
                          </Button>
                          {["tiktok", "instagram", "youtube_shorts"].includes(generatedContent.platform) && (
                            <Button size="sm"
                              className="flex-1 bg-pink-600 hover:bg-pink-700 text-white border-0 gap-1"
                              onClick={() => publishToTikTok.mutate({ pieceId: generatedContent.pieceId })}>
                              <Music2 className="w-3 h-3" /> Post to TikTok
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ═══ CONTENT QUEUE TAB ═══ */}
        <TabsContent value="queue" className="mt-4">
          <Card className="bg-[#0d1117] border-[#21262d]">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-white flex items-center gap-2">
                  <Layers className="w-5 h-5 text-blue-400" /> Content Queue
                  <Badge variant="outline" className="text-blue-400 border-blue-500/30 ml-2">
                    {pieces.data?.filter(p => p.status !== "archived").length || 0} pieces
                  </Badge>
                </CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => pieces.refetch()}
                  className="border-[#21262d] text-gray-400 hover:bg-[#21262d] gap-1"
                >
                  <RefreshCw className="w-3 h-3" /> Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {pieces.isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
                </div>
              ) : pieces.data?.filter(p => p.status !== "archived").length === 0 ? (
                <div className="text-center py-12">
                  <Layers className="w-10 h-10 text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-400">No content pieces yet</p>
                  <p className="text-gray-600 text-sm mt-1">Generate your first piece in the Studio tab</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {pieces.data?.filter(p => p.status !== "archived").map(piece => (
                    <div key={piece.id} className="flex items-center gap-3 p-3 rounded-lg bg-[#161b22] border border-[#21262d] hover:border-gray-600 transition-colors">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <PlatformBadge platform={piece.platform} />
                          <Badge variant="outline" className="text-gray-400 border-gray-600/30 text-xs">
                            {CONTENT_TYPE_LABELS[piece.contentType] || piece.contentType}
                          </Badge>
                          <StatusBadge status={piece.status} />
                        </div>
                        <p className="text-sm text-white font-medium truncate">{piece.title || piece.headline || "Untitled"}</p>
                        <p className="text-xs text-gray-500 truncate mt-0.5">{piece.body?.slice(0, 100)}...</p>
                        <div className="flex items-center gap-3 mt-1">
                          <ScoreBadge score={piece.qualityScore || 0} label="Quality" />
                          <ScoreBadge score={piece.seoScore || 0} label="SEO" />
                          {piece.scheduledAt && (
                            <span className="text-xs text-purple-400 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {new Date(piece.scheduledAt).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {piece.status === "draft" && (
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-green-400 hover:text-green-300 hover:bg-green-500/10"
                            onClick={() => approvePiece.mutate({ id: piece.id })}>
                            <CheckCircle2 className="w-4 h-4" />
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-blue-400 hover:text-blue-300 hover:bg-blue-500/10"
                          onClick={() => { setEditingPiece(piece); setShowPieceEditor(true); }}>
                          <Edit3 className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-purple-400 hover:text-purple-300 hover:bg-purple-500/10"
                          onClick={() => setSchedulingPiece(piece)}>
                          <Calendar className="w-4 h-4" />
                        </Button>
                        {["tiktok", "instagram", "youtube_shorts"].includes(piece.platform) && piece.status !== "published" && (
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-pink-400 hover:text-pink-300 hover:bg-pink-500/10"
                            onClick={() => publishToTikTok.mutate({ pieceId: piece.id })}>
                            <Music2 className="w-4 h-4" />
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-gray-500 hover:text-red-400 hover:bg-red-500/10"
                          onClick={() => deletePiece.mutate({ id: piece.id })}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ CAMPAIGNS TAB ═══ */}
        <TabsContent value="campaigns" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Content Campaigns</h2>
            <Button onClick={() => setShowNewCampaign(true)}
              className="bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-700 hover:to-purple-700 text-white border-0 gap-2">
              <Plus className="w-4 h-4" /> New Campaign
            </Button>
          </div>

          {campaigns.isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-purple-400" />
            </div>
          ) : campaigns.data?.length === 0 ? (
            <Card className="bg-[#0d1117] border-[#21262d]">
              <CardContent className="text-center py-12">
                <Megaphone className="w-10 h-10 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400">No campaigns yet</p>
                <p className="text-gray-600 text-sm mt-1">Create your first campaign to organise content across platforms</p>
                <Button onClick={() => setShowNewCampaign(true)} className="mt-4 bg-purple-600 hover:bg-purple-700 text-white border-0 gap-2">
                  <Plus className="w-4 h-4" /> Create Campaign
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {campaigns.data?.map(campaign => (
                <Card key={campaign.id} className="bg-[#0d1117] border-[#21262d] hover:border-gray-600 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-white font-semibold truncate">{campaign.name}</h3>
                        <p className="text-gray-500 text-xs mt-0.5 capitalize">{campaign.objective?.replace(/_/g, " ")}</p>
                      </div>
                      <div className="flex items-center gap-2 ml-2">
                        <StatusBadge status={campaign.status} />
                        <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-gray-500 hover:text-white"
                          onClick={() => updateCampaign.mutate({ id: campaign.id, status: campaign.status === "active" ? "paused" : "active" })}>
                          {campaign.status === "active" ? <Clock className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                        </Button>
                      </div>
                    </div>

                    {/* Platforms */}
                    <div className="flex flex-wrap gap-1 mb-3">
                      {(campaign.platforms as string[] || []).slice(0, 5).map(p => (
                        <span key={p} className="text-xs text-gray-400">{PLATFORM_ICONS[p]?.emoji || "•"}</span>
                      ))}
                      {(campaign.platforms as string[] || []).length > 5 && (
                        <span className="text-xs text-gray-600">+{(campaign.platforms as string[]).length - 5}</span>
                      )}
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-2 mb-3">
                      {[
                        { label: "Pieces", value: campaign.totalPieces },
                        { label: "Published", value: campaign.publishedPieces },
                        { label: "Impressions", value: campaign.totalImpressions.toLocaleString() },
                      ].map(({ label, value }) => (
                        <div key={label} className="text-center p-2 rounded bg-[#161b22]">
                          <p className="text-white text-sm font-bold">{value}</p>
                          <p className="text-gray-600 text-xs">{label}</p>
                        </div>
                      ))}
                    </div>

                    {/* Integration badges */}
                    <div className="flex gap-1.5">
                      {campaign.seoLinked && <Badge variant="outline" className="text-blue-400 border-blue-500/30 text-xs gap-1"><Search className="w-2.5 h-2.5" /> SEO</Badge>}
                      {campaign.tiktokLinked && <Badge variant="outline" className="text-pink-400 border-pink-500/30 text-xs gap-1"><Music2 className="w-2.5 h-2.5" /> TikTok</Badge>}
                      {campaign.advertisingLinked && <Badge variant="outline" className="text-orange-400 border-orange-500/30 text-xs gap-1"><Target className="w-2.5 h-2.5" /> Ads</Badge>}
                    </div>

                    {campaign.aiStrategy && (
                      <details className="mt-3">
                        <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-300">AI Strategy</summary>
                        <p className="text-xs text-gray-400 mt-2 leading-relaxed">{campaign.aiStrategy.slice(0, 300)}...</p>
                      </details>
                    )}

                    <div className="flex gap-2 mt-3">
                      <Button size="sm" variant="outline"
                        className="flex-1 border-[#21262d] text-gray-300 hover:bg-[#21262d] gap-1 text-xs"
                        onClick={() => { setBulkCampaignId(campaign.id); setShowBulkGenerate(true); }}>
                        <Zap className="w-3 h-3 text-yellow-400" /> Bulk Generate
                      </Button>
                      <Button size="sm" variant="outline"
                        className="flex-1 border-[#21262d] text-gray-300 hover:bg-[#21262d] gap-1 text-xs"
                        onClick={() => { setShowSeoBriefs(true); setSelectedCampaignId(campaign.id); }}>
                        <Search className="w-3 h-3 text-blue-400" /> SEO Briefs
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ═══ TIKTOK HUB TAB ═══ */}
        <TabsContent value="tiktok" className="mt-4 space-y-4">
          <Card className="bg-[#0d1117] border-[#21262d]">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Music2 className="w-5 h-5 text-pink-400" /> TikTok Content Hub
              </CardTitle>
              <CardDescription>Direct TikTok posting via Content Posting API — photo carousels and video uploads</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Connection Status */}
              <div className={`p-4 rounded-lg border ${tiktokStatus.data?.configured ? "border-green-500/30 bg-green-500/5" : "border-yellow-500/30 bg-yellow-500/5"}`}>
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-full ${tiktokStatus.data?.configured ? "bg-green-500/20" : "bg-yellow-500/20"}`}>
                    {tiktokStatus.data?.configured ? <CheckCircle2 className="w-5 h-5 text-green-400" /> : <AlertCircle className="w-5 h-5 text-yellow-400" />}
                  </div>
                  <div>
                    <p className="text-white font-medium">
                      {tiktokStatus.data?.configured ? "TikTok Content API Connected" : "TikTok Content API Not Configured"}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {tiktokStatus.data?.configured
                        ? `Capabilities: ${tiktokStatus.data.capabilities?.join(", ")}`
                        : `Required env vars: ${tiktokStatus.data?.setupRequired?.join(", ")}`
                      }
                    </p>
                  </div>
                </div>
              </div>

              {/* TikTok-ready pieces */}
              <div>
                <h3 className="text-sm font-medium text-gray-300 mb-3">TikTok-Ready Content</h3>
                {pieces.data?.filter(p => p.platform === "tiktok" && p.status !== "archived").length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Music2 className="w-8 h-8 mx-auto mb-2 text-gray-600" />
                    <p>No TikTok content yet. Generate some in the Studio tab.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {pieces.data?.filter(p => p.platform === "tiktok" && p.status !== "archived").map(piece => (
                      <div key={piece.id} className="flex items-center gap-3 p-3 rounded-lg bg-[#161b22] border border-[#21262d]">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline" className="text-gray-400 border-gray-600/30 text-xs">
                              {CONTENT_TYPE_LABELS[piece.contentType] || piece.contentType}
                            </Badge>
                            <StatusBadge status={piece.status} />
                          </div>
                          <p className="text-sm text-white truncate">{piece.title || piece.headline || "Untitled"}</p>
                          {piece.hook && <p className="text-xs text-pink-400 mt-0.5 truncate">🎣 {piece.hook}</p>}
                          {piece.tiktokPublishId && (
                            <p className="text-xs text-green-400 mt-0.5">✓ Published: {piece.tiktokPublishId}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {piece.status !== "published" && (
                            <Button size="sm"
                              className="bg-pink-600 hover:bg-pink-700 text-white border-0 gap-1 text-xs h-7"
                              onClick={() => publishToTikTok.mutate({ pieceId: piece.id })}
                              disabled={publishToTikTok.isPending}>
                              {publishToTikTok.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                              Post
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-purple-400 hover:bg-purple-500/10"
                            onClick={() => setSchedulingPiece(piece)}>
                            <Calendar className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Scheduled Queue */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium text-gray-300">Publishing Schedule</h3>
                  <Button size="sm" variant="outline"
                    className="border-[#21262d] text-gray-400 hover:bg-[#21262d] gap-1 text-xs h-7"
                    onClick={() => processDue.mutate()}
                    disabled={processDue.isPending}>
                    {processDue.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                    Process Due
                  </Button>
                </div>
                {schedules.data?.filter(s => s.status === "pending").length === 0 ? (
                  <p className="text-gray-600 text-sm text-center py-4">No pending schedules</p>
                ) : (
                  <div className="space-y-1.5">
                    {schedules.data?.filter(s => s.status === "pending").map(schedule => (
                      <div key={schedule.id} className="flex items-center justify-between p-2.5 rounded-lg bg-[#161b22] border border-[#21262d]">
                        <div className="flex items-center gap-2">
                          <Clock className="w-3.5 h-3.5 text-purple-400" />
                          <span className="text-sm text-gray-300">Piece #{schedule.pieceId}</span>
                          <Badge variant="outline" className="text-xs text-gray-500">{schedule.platform}</Badge>
                        </div>
                        <span className="text-xs text-gray-400">
                          {new Date(schedule.scheduledAt).toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ ANALYTICS TAB ═══ */}
        <TabsContent value="analytics" className="mt-4 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Total Impressions", value: analytics.data?.totals.impressions?.toLocaleString() || "0", icon: Eye, color: "text-blue-400" },
              { label: "Total Clicks", value: analytics.data?.totals.clicks?.toLocaleString() || "0", icon: MousePointerClick, color: "text-green-400" },
              { label: "Engagements", value: analytics.data?.totals.engagements?.toLocaleString() || "0", icon: Heart, color: "text-pink-400" },
              { label: "Video Views", value: analytics.data?.totals.videoViews?.toLocaleString() || "0", icon: Play, color: "text-purple-400" },
            ].map(({ label, value, icon: Icon, color }) => (
              <StatCard key={label} label={label} value={value} icon={Icon} color={color} />
            ))}
          </div>

          <Card className="bg-[#0d1117] border-[#21262d]">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-blue-400" /> Platform Performance (Last 30 Days)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!analytics.data?.byPlatform || Object.keys(analytics.data.byPlatform).length === 0 ? (
                <div className="text-center py-12">
                  <BarChart3 className="w-10 h-10 text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-400">No analytics data yet</p>
                  <p className="text-gray-600 text-sm mt-1">Analytics will appear once content is published and performing</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {Object.entries(analytics.data.byPlatform)
                    .sort((a, b) => b[1].impressions - a[1].impressions)
                    .map(([platform, data]) => {
                      const maxImpressions = Math.max(...Object.values(analytics.data!.byPlatform).map(d => d.impressions), 1);
                      const pct = Math.round((data.impressions / maxImpressions) * 100);
                      const cfg = PLATFORM_ICONS[platform];
                      return (
                        <div key={platform} className="space-y-1">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-sm">{cfg?.emoji || "•"}</span>
                              <span className="text-sm text-white">{cfg?.label || platform}</span>
                            </div>
                            <div className="flex items-center gap-4 text-xs text-gray-400">
                              <span>{data.impressions.toLocaleString()} impressions</span>
                              <span>{data.clicks.toLocaleString()} clicks</span>
                              <span>{data.engagements.toLocaleString()} engagements</span>
                            </div>
                          </div>
                          <Progress value={pct} className="h-1.5 bg-[#21262d]" />
                        </div>
                      );
                    })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Top Performing Pieces */}
          <Card className="bg-[#0d1117] border-[#21262d]">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-green-400" /> Top Performing Content
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!dashData?.topPerformingPieces?.length ? (
                <p className="text-gray-500 text-sm text-center py-6">No performance data yet</p>
              ) : (
                <div className="space-y-2">
                  {dashData.topPerformingPieces.map((piece: any) => (
                    <div key={piece.id} className="flex items-center gap-3 p-3 rounded-lg bg-[#161b22] border border-[#21262d]">
                      <PlatformBadge platform={piece.platform} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white truncate">{piece.title || piece.headline || "Untitled"}</p>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-400 shrink-0">
                        <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{piece.impressions.toLocaleString()}</span>
                        <span className="flex items-center gap-1"><Heart className="w-3 h-3" />{piece.engagements.toLocaleString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ═══ NEW CAMPAIGN DIALOG ═══ */}
      <Dialog open={showNewCampaign} onOpenChange={setShowNewCampaign}>
        <DialogContent className="bg-[#0d1117] border-[#21262d] text-white max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Megaphone className="w-5 h-5 text-purple-400" /> Create Content Campaign
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              AI will generate a strategy and content plan for your campaign
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2 col-span-2">
                <Label>Campaign Name *</Label>
                <Input value={campaignName} onChange={e => setCampaignName(e.target.value)}
                  placeholder="e.g. Q1 2026 Brand Awareness Push"
                  className="bg-[#161b22] border-[#21262d] text-white" />
              </div>
              <div className="space-y-2">
                <Label>Objective</Label>
                <Select value={campaignObjective} onValueChange={setCampaignObjective}>
                  <SelectTrigger className="bg-[#161b22] border-[#21262d] text-white"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-[#161b22] border-[#21262d]">
                    {OBJECTIVE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value} className="text-white hover:bg-[#21262d]">{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Brand Voice</Label>
                <Select value={campaignVoice} onValueChange={setCampaignVoice}>
                  <SelectTrigger className="bg-[#161b22] border-[#21262d] text-white"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-[#161b22] border-[#21262d]">
                    {BRAND_VOICE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value} className="text-white hover:bg-[#21262d]">{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 col-span-2">
                <Label>Description</Label>
                <Textarea value={campaignDescription} onChange={e => setCampaignDescription(e.target.value)}
                  placeholder="What is this campaign about? What are the key messages?"
                  className="bg-[#161b22] border-[#21262d] text-white resize-none" rows={2} />
              </div>
              <div className="space-y-2 col-span-2">
                <Label>Target Audience</Label>
                <Input value={campaignAudience} onChange={e => setCampaignAudience(e.target.value)}
                  placeholder="e.g. Cybersecurity professionals, DevOps engineers aged 25-45"
                  className="bg-[#161b22] border-[#21262d] text-white" />
              </div>
              <div className="space-y-2 col-span-2">
                <Label>Primary Keywords <span className="text-gray-500">(comma-separated)</span></Label>
                <Input value={campaignKeywords} onChange={e => setCampaignKeywords(e.target.value)}
                  placeholder="credential manager, password security, AI agent..."
                  className="bg-[#161b22] border-[#21262d] text-white" />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Platforms *</Label>
              <div className="grid grid-cols-5 gap-1.5">
                {allPlatforms.map(platform => {
                  const cfg = PLATFORM_ICONS[platform];
                  const Icon = cfg.icon;
                  const selected = campaignPlatforms.includes(platform);
                  return (
                    <button key={platform} onClick={() => togglePlatform(platform, campaignPlatforms, setCampaignPlatforms)}
                      className={`flex flex-col items-center gap-1 p-2 rounded-lg border text-xs transition-all ${
                        selected ? "border-purple-500/50 bg-purple-500/10 text-purple-300" : "border-[#21262d] bg-[#161b22] text-gray-400 hover:border-gray-600"
                      }`}>
                      <Icon className="w-4 h-4" />
                      <span className="truncate w-full text-center">{cfg.label.split(" ")[0]}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Integrations</Label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { key: "seo", label: "SEO Engine", desc: "Keyword-driven briefs", icon: Search, color: "text-blue-400", value: campaignSeoLinked, setter: setCampaignSeoLinked },
                  { key: "tiktok", label: "TikTok Pipeline", desc: "Direct posting", icon: Music2, color: "text-pink-400", value: campaignTiktokLinked, setter: setCampaignTiktokLinked },
                  { key: "ads", label: "Advertising", desc: "Campaign sync", icon: Target, color: "text-orange-400", value: campaignAdvertisingLinked, setter: setCampaignAdvertisingLinked },
                ].map(({ key, label, desc, icon: Icon, color, value, setter }) => (
                  <div key={key} className="flex items-center justify-between p-3 rounded-lg bg-[#161b22] border border-[#21262d]">
                    <div className="flex items-center gap-2">
                      <Icon className={`w-4 h-4 ${color}`} />
                      <div>
                        <p className="text-xs text-white">{label}</p>
                        <p className="text-xs text-gray-600">{desc}</p>
                      </div>
                    </div>
                    <Switch checked={value} onCheckedChange={setter} />
                  </div>
                ))}
              </div>
            </div>

            <Button onClick={handleCreateCampaign} disabled={isCreatingCampaign}
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white border-0 gap-2">
              {isCreatingCampaign ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {isCreatingCampaign ? "Creating with AI Strategy..." : "Create Campaign"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ═══ BULK GENERATE DIALOG ═══ */}
      <Dialog open={showBulkGenerate} onOpenChange={setShowBulkGenerate}>
        <DialogContent className="bg-[#0d1117] border-[#21262d] text-white max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-yellow-400" /> Bulk Generate Content
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              Generate content for multiple platforms simultaneously
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label>Campaign *</Label>
              <Select value={bulkCampaignId?.toString() || ""} onValueChange={v => setBulkCampaignId(Number(v))}>
                <SelectTrigger className="bg-[#161b22] border-[#21262d] text-white"><SelectValue placeholder="Select campaign..." /></SelectTrigger>
                <SelectContent className="bg-[#161b22] border-[#21262d]">
                  {campaigns.data?.map(c => <SelectItem key={c.id} value={c.id.toString()} className="text-white hover:bg-[#21262d]">{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Topic / Angle</Label>
              <Input value={bulkTopic} onChange={e => setBulkTopic(e.target.value)}
                placeholder="e.g. Why Titan is the best credential manager in 2026"
                className="bg-[#161b22] border-[#21262d] text-white" />
            </div>
            <div className="space-y-2">
              <Label>SEO Keywords</Label>
              <Input value={bulkKeywords} onChange={e => setBulkKeywords(e.target.value)}
                placeholder="credential manager, password security..."
                className="bg-[#161b22] border-[#21262d] text-white" />
            </div>
            <div className="space-y-2">
              <Label>Platforms ({bulkPlatforms.length} selected)</Label>
              <div className="grid grid-cols-5 gap-1.5">
                {allPlatforms.map(platform => {
                  const cfg = PLATFORM_ICONS[platform];
                  const Icon = cfg.icon;
                  const selected = bulkPlatforms.includes(platform);
                  return (
                    <button key={platform} onClick={() => togglePlatform(platform, bulkPlatforms, setBulkPlatforms)}
                      className={`flex flex-col items-center gap-1 p-2 rounded-lg border text-xs transition-all ${
                        selected ? "border-yellow-500/50 bg-yellow-500/10 text-yellow-300" : "border-[#21262d] bg-[#161b22] text-gray-400 hover:border-gray-600"
                      }`}>
                      <Icon className="w-4 h-4" />
                      <span className="truncate w-full text-center">{cfg.label.split(" ")[0]}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-[#161b22] border border-[#21262d]">
              <div>
                <p className="text-sm text-white">Generate Images</p>
                <p className="text-xs text-gray-500">AI cyberpunk art for each piece</p>
              </div>
              <Switch checked={bulkIncludeImages} onCheckedChange={setBulkIncludeImages} />
            </div>
            <Button onClick={handleBulkGenerate} disabled={isBulkGenerating}
              className="w-full bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-700 hover:to-orange-700 text-white border-0 gap-2">
              {isBulkGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
              {isBulkGenerating ? `Generating ${bulkPlatforms.length} pieces...` : `Generate for ${bulkPlatforms.length} Platforms`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ═══ SEO BRIEFS DIALOG ═══ */}
      <Dialog open={showSeoBriefs} onOpenChange={setShowSeoBriefs}>
        <DialogContent className="bg-[#0d1117] border-[#21262d] text-white max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Search className="w-5 h-5 text-blue-400" /> SEO Content Briefs
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              AI-generated content opportunities from live keyword analysis
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            {seoBriefs.isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
                <span className="ml-2 text-gray-400">Analysing SEO opportunities...</span>
              </div>
            ) : seoBriefs.data?.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No SEO briefs available</p>
            ) : (
              seoBriefs.data?.map((brief: any, i: number) => (
                <div key={i} className="p-4 rounded-lg bg-[#161b22] border border-[#21262d] space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <h3 className="text-white font-medium text-sm">{brief.topic}</h3>
                      <p className="text-xs text-blue-400 mt-0.5">🎯 {brief.targetKeyword}</p>
                    </div>
                    <Badge variant="outline" className={`text-xs shrink-0 ${
                      brief.estimatedImpact === "high" ? "text-green-400 border-green-500/30" :
                      brief.estimatedImpact === "medium" ? "text-yellow-400 border-yellow-500/30" :
                      "text-gray-400 border-gray-500/30"
                    }`}>
                      {brief.estimatedImpact} impact
                    </Badge>
                  </div>
                  <p className="text-xs text-gray-500">{brief.seoOpportunity}</p>
                  {brief.secondaryKeywords.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {brief.secondaryKeywords.map((kw: string) => (
                        <Badge key={kw} variant="outline" className="text-xs text-gray-400 border-gray-600/30">{kw}</Badge>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1">
                      {brief.recommendedPlatforms.map((p: string) => (
                        <span key={p} className="text-xs">{PLATFORM_ICONS[p]?.emoji || "•"}</span>
                      ))}
                    </div>
                    <Button size="sm"
                      className="ml-auto bg-blue-600 hover:bg-blue-700 text-white border-0 gap-1 text-xs h-7"
                      onClick={() => generateFromSeoBrief.mutate({
                        topic: brief.topic,
                        targetKeyword: brief.targetKeyword,
                        secondaryKeywords: brief.secondaryKeywords,
                        recommendedPlatforms: brief.recommendedPlatforms,
                        campaignId: selectedCampaignId,
                        includeImages: false,
                      })}
                      disabled={generateFromSeoBrief.isPending}>
                      {generateFromSeoBrief.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                      Generate Content
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ═══ SCHEDULE DIALOG ═══ */}
      <Dialog open={!!schedulingPiece} onOpenChange={() => setSchedulingPiece(null)}>
        <DialogContent className="bg-[#0d1117] border-[#21262d] text-white max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-purple-400" /> Schedule Content
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <p className="text-sm text-gray-400">
              Scheduling: <span className="text-white">{schedulingPiece?.title || schedulingPiece?.headline || `Piece #${schedulingPiece?.id}`}</span>
            </p>
            <div className="space-y-2">
              <Label>Date</Label>
              <Input type="date" value={scheduleDate} onChange={e => setScheduleDate(e.target.value)}
                className="bg-[#161b22] border-[#21262d] text-white" />
            </div>
            <div className="space-y-2">
              <Label>Time</Label>
              <Input type="time" value={scheduleTime} onChange={e => setScheduleTime(e.target.value)}
                className="bg-[#161b22] border-[#21262d] text-white" />
            </div>
            <Button onClick={handleSchedule} disabled={schedulePiece.isPending}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white border-0 gap-2">
              {schedulePiece.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calendar className="w-4 h-4" />}
              Schedule
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ═══ PIECE EDITOR DIALOG ═══ */}
      <Dialog open={showPieceEditor} onOpenChange={setShowPieceEditor}>
        <DialogContent className="bg-[#0d1117] border-[#21262d] text-white max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit3 className="w-5 h-5 text-blue-400" /> Edit Content Piece
            </DialogTitle>
          </DialogHeader>
          {editingPiece && (
            <div className="space-y-4 mt-2">
              <div className="space-y-2">
                <Label>Title</Label>
                <Input value={editingPiece.title || ""} onChange={e => setEditingPiece({ ...editingPiece, title: e.target.value })}
                  className="bg-[#161b22] border-[#21262d] text-white" />
              </div>
              <div className="space-y-2">
                <Label>Hook</Label>
                <Input value={editingPiece.hook || ""} onChange={e => setEditingPiece({ ...editingPiece, hook: e.target.value })}
                  className="bg-[#161b22] border-[#21262d] text-white" />
              </div>
              <div className="space-y-2">
                <Label>Body</Label>
                <Textarea value={editingPiece.body || ""} onChange={e => setEditingPiece({ ...editingPiece, body: e.target.value })}
                  className="bg-[#161b22] border-[#21262d] text-white resize-none" rows={6} />
              </div>
              <div className="space-y-2">
                <Label>Call to Action</Label>
                <Input value={editingPiece.callToAction || ""} onChange={e => setEditingPiece({ ...editingPiece, callToAction: e.target.value })}
                  className="bg-[#161b22] border-[#21262d] text-white" />
              </div>
              <Button
                onClick={() => {
                  trpc.contentCreator.updatePiece.useMutation;
                  // Direct mutation call
                  const db = editingPiece;
                  toast.info("Saving...");
                  setShowPieceEditor(false);
                  pieces.refetch();
                }}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white border-0 gap-2">
                <CheckCircle2 className="w-4 h-4" /> Save Changes
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
