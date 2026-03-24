import { useState, useMemo, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { useLocation, useSearch } from "wouter";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Search, Star, Eye, Download, Store, ShoppingCart, Filter, Sparkles, Code2,
  FileCode, Cpu, Wand2, Package2, ShoppingBag, LayoutDashboard, Plus, Loader2,
  AlertTriangle, Shield, ShieldAlert, CheckCircle2, XCircle, DollarSign,
  TrendingUp, BarChart3, Tag, ExternalLink, ArrowLeft, Coins, MessageSquare,
  Skull, Bug, Database, FileText, Zap, Crown, Upload, CreditCard, Wallet,
  Building2, Mail, Link2, Trash2, Edit, Settings,
} from "lucide-react";
import AffiliateRecommendations from "@/components/AffiliateRecommendations";
import { BAZAAR_LOGO_256, BAZAAR_LOGO_128 } from "@/lib/logos";

// ─── Types ────────────────────────────────────────────────────────

type Listing = {
  id: number; uid: string; sellerId: number; title: string; slug: string;
  description: string; longDescription: string | null; category: string;
  riskCategory: string; reviewStatus: string; reviewNotes: string | null;
  status: string; priceCredits: number; priceUsd: number; currency: string;
  fileUrl: string | null; fileSize: number | null; fileType: string | null;
  previewUrl: string | null; thumbnailUrl: string | null; demoUrl: string | null;
  tags: string | null; language: string | null; license: string | null;
  version: string | null; totalSales: number; totalRevenue: number;
  viewCount: number; downloadCount: number; avgRating: number; ratingCount: number;
  featured: boolean; createdAt: string; updatedAt: string;
};

type Purchase = {
  id: number; uid: string; buyerId: number; listingId: number; sellerId: number;
  priceCredits: number; priceUsd: number; status: string; downloadCount: number;
  maxDownloads: number; downloadToken: string | null; hasReviewed: boolean;
  createdAt: string; listing?: Listing | null;
};

type Review = {
  id: number; listingId: number; purchaseId: number; reviewerId: number;
  rating: number; title: string | null; comment: string | null;
  sellerRating: number | null; helpful: number; createdAt: string;
};

type PayoutMethod = {
  id: number; sellerId: number; userId: number;
  methodType: "bank_transfer" | "paypal" | "stripe_connect";
  isDefault: boolean; label: string | null;
  bankBsb: string | null; bankAccountNumber: string | null;
  bankAccountName: string | null; bankName: string | null;
  bankCountry: string | null; bankSwiftBic: string | null;
  paypalEmail: string | null;
  stripeConnectAccountId: string | null; stripeConnectOnboarded: boolean;
  verified: boolean; status: string;
  createdAt: string; updatedAt: string;
};

// ─── Constants ────────────────────────────────────────────────────

const CATEGORIES = [
  { label: "All Wares", icon: Store, value: "all" },
  { label: "AI Agents", icon: Sparkles, value: "agents" },
  { label: "Modules", icon: Code2, value: "modules" },
  { label: "Blueprints", icon: FileCode, value: "blueprints" },
  { label: "Artifacts", icon: Cpu, value: "artifacts" },
  { label: "Exploits", icon: Skull, value: "exploits" },
  { label: "Templates", icon: FileText, value: "templates" },
  { label: "Datasets", icon: Database, value: "datasets" },
];

const RISK_BADGES: Record<string, { label: string; color: string; icon: any }> = {
  safe: { label: "Safe", color: "bg-emerald-600", icon: Shield },
  low_risk: { label: "Low Risk", color: "bg-blue-600", icon: Shield },
  medium_risk: { label: "Medium Risk", color: "bg-amber-600", icon: ShieldAlert },
  high_risk: { label: "High Risk", color: "bg-red-600", icon: AlertTriangle },
};

const CATEGORY_ICONS: Record<string, any> = {
  agents: Sparkles, modules: Code2, blueprints: FileCode, artifacts: Cpu,
  exploits: Skull, templates: FileText, datasets: Database, other: Package2,
};

// ─── Star Rating Component ────────────────────────────────────────

function StarRating({ rating, count, size = "sm" }: { rating: number; count: number; size?: "sm" | "md" }) {
  const displayRating = rating > 5 ? rating / 100 : rating;
  const stars = Math.round(displayRating);
  const w = size === "md" ? "w-4 h-4" : "w-3 h-3";
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star key={s} className={`${w} ${s <= stars ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`} />
      ))}
      <span className="text-xs text-muted-foreground ml-1">({count})</span>
    </div>
  );
}

// ─── Interactive Star Input ───────────────────────────────────────

function StarInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          className={`w-6 h-6 cursor-pointer transition-colors ${
            s <= (hover || value) ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"
          }`}
          onMouseEnter={() => setHover(s)}
          onMouseLeave={() => setHover(0)}
          onClick={() => onChange(s)}
        />
      ))}
    </div>
  );
}

// ─── Risk Badge Component ─────────────────────────────────────────

function RiskBadge({ risk }: { risk: string }) {
  const info = RISK_BADGES[risk] || RISK_BADGES.safe;
  const Icon = info.icon;
  return (
    <Badge className={`${info.color} text-white text-[10px] px-1.5 py-0.5 gap-1`}>
      <Icon className="w-3 h-3" /> {info.label}
    </Badge>
  );
}

// ─── Marketplace Tab Navigation ──────────────────────────────────

function MarketplaceNav({ activeTab, onTabChange }: { activeTab: string; onTabChange: (tab: string) => void }) {
  const tabs = [
    { id: "browse", label: "Browse", labelFull: "Browse Bazaar", icon: Store },
    { id: "purchases", label: "Purchases", labelFull: "My Purchases", icon: Package2 },
    { id: "listings", label: "Listings", labelFull: "My Listings", icon: ShoppingBag },
    { id: "dashboard", label: "Seller", labelFull: "Seller Dashboard", icon: LayoutDashboard },
  ];

  return (
    <div className="border-b border-border/30 bg-card/30 sticky top-0 z-20 backdrop-blur-sm">
      <div className="max-w-6xl mx-auto px-2 sm:px-6">
        <div className="flex items-center overflow-x-auto scrollbar-hide py-1 -mb-px">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`flex items-center gap-1.5 px-3 sm:px-4 py-3 text-xs sm:text-sm font-medium whitespace-nowrap transition-all border-b-2 shrink-0 ${
                  isActive
                    ? "border-amber-400 text-amber-400"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="hidden sm:inline">{tab.labelFull}</span>
                <span className="sm:hidden">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// BROWSE VIEW — Main marketplace grid
// ═══════════════════════════════════════════════════════════════════

function BrowseView({ onSelectListing, onListItem }: { onSelectListing: (id: number) => void; onListItem: () => void }) {
  const sub = useSubscription();
  const canBuy = sub.canUse("marketplace_buy");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  const { data: trending = [] } = trpc.marketplaceIntelligence.getTrending.useQuery({ limit: 6 });
  const { data: recommendations = [] } = trpc.marketplaceIntelligence.getPersonalizedRecommendations.useQuery({ limit: 6 });

  const wishlistMutation = trpc.marketplaceIntelligence.addToWishlist.useMutation({
    onSuccess: () => toast.success("Added to wishlist!"),
    onError: (err) => toast.error(err.message),
  });

  const { data: listings = [], isLoading, refetch } = trpc.marketplace.browse.useQuery({
    category: activeCategory !== "all" ? activeCategory : undefined,
    search: searchQuery || undefined,
    sortBy,
    limit: 100,
  });

  const seedMutation = trpc.marketplace.seed.useMutation({
    onSuccess: (data) => {
      toast.success(`Seeded ${(data as any).created || 'new'} marketplace listings`);
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const { data: stats } = trpc.marketplace.stats.useQuery();

  return (
    <div className="min-h-screen bg-background">
      {/* Free Tier Browse-Only Banner */}
      {!sub.loading && !canBuy && (
        <div className="bg-amber-950/40 border-b border-amber-600/30 px-4 py-2.5">
          <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-sm text-amber-400">
              <Crown className="w-4 h-4 shrink-0" />
              <span><strong>Free plan:</strong> Browse-only. Upgrade to Pro to buy and sell items.</span>
            </div>
            <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white shrink-0 h-7 text-xs"
              onClick={() => window.location.href = "/pricing"}>
              Upgrade
            </Button>
          </div>
        </div>
      )}
      {/* Hero Header */}
      <div className="relative overflow-hidden border-b border-amber-900/30 bg-gradient-to-b from-amber-950/30 via-background to-background">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-500/5 via-transparent to-transparent" />
        <div className="relative max-w-6xl mx-auto px-6 py-10 text-center">
          <div className="flex justify-center mb-4">
            <img loading="eager" src={BAZAAR_LOGO_256} alt="Tech Bazaar" className="w-48 h-48 md:w-56 md:h-56 object-contain drop-shadow-2xl" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-2">
            <span className="bg-gradient-to-r from-amber-200 via-amber-400 to-amber-200 bg-clip-text text-transparent"
              style={{ fontFamily: "'Cinzel', 'Georgia', serif" }}>
              Tech Bazaar
            </span>
          </h1>
          <p className="text-sm text-amber-400/60 tracking-[0.3em] uppercase mb-3"
            style={{ fontFamily: "'Cinzel', 'Georgia', serif" }}>
            by Archibald Titan
          </p>
          <p className="text-muted-foreground max-w-2xl mx-auto text-sm mb-5">
            Trade AI agents, security modules, code blueprints, and digital artifacts.
            All items are AI-reviewed for risk categorization. Only original work allowed.
          </p>

          {/* Value Proposition */}
          <div className="max-w-xl mx-auto mb-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-left text-sm">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="text-muted-foreground"><strong className="text-foreground">Skip months of debugging</strong> — code that already works</span>
              </div>
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="text-muted-foreground"><strong className="text-foreground">Battle-tested in production</strong> — not AI-generated guesswork</span>
              </div>
              <div className="flex items-center gap-2">
                <Coins className="w-4 h-4 text-blue-400 shrink-0" />
                <span className="text-muted-foreground"><strong className="text-foreground">Fraction of the cost</strong> — vs. building from scratch</span>
              </div>
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-purple-400 shrink-0" />
                <span className="text-muted-foreground"><strong className="text-foreground">Real developer expertise</strong> — baked into every module</span>
              </div>
              <div className="flex items-center gap-2">
                <Download className="w-4 h-4 text-cyan-400 shrink-0" />
                <span className="text-muted-foreground"><strong className="text-foreground">Drop-in ready</strong> — documented, integrated, plug and play</span>
              </div>
              <div className="flex items-center gap-2">
                <Crown className="w-4 h-4 text-amber-300 shrink-0" />
                <span className="text-muted-foreground"><strong className="text-foreground">Sell your own work</strong> — earn 92% on every sale</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground/60 mt-3 italic">AI writes code in seconds — but you spend hours fixing it. Here, it's already fixed.</p>
          </div>

          {/* ★ PROMINENT LIST YOUR ITEM BUTTON ★ */}
          <Button
            size="lg"
            className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white text-base font-semibold px-8 py-6 shadow-lg shadow-amber-500/20 mb-6"
            onClick={onListItem}
          >
            <Plus className="w-5 h-5 mr-2" />
            List Your Item
          </Button>

          {/* Stats */}
          {stats && (
            <div className="flex items-center justify-center gap-6 text-sm">
              <div className="text-center">
                <div className="text-lg font-bold text-amber-400">{stats.totalListings}</div>
                <div className="text-xs text-muted-foreground">Listings</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-emerald-400">{stats.totalCategories}</div>
                <div className="text-xs text-muted-foreground">Categories</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-blue-400">{stats.totalSales}</div>
                <div className="text-xs text-muted-foreground">Total Sales</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Search & Filters */}
      <div className="max-w-6xl mx-auto px-6 py-6">
        {/* Trending Section */}
        {!searchQuery && (trending as any[]).length > 0 && (
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-4 h-4 text-amber-400" />
              <h2 className="text-sm font-semibold text-amber-400 uppercase tracking-wider">Trending Now</h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {(trending as any[]).map((item: any) => (
                <button key={item.id} onClick={() => onSelectListing(item.id)}
                  className="text-left p-3 rounded-lg border border-amber-600/30 bg-amber-950/10 hover:border-amber-500/50 hover:bg-amber-950/20 transition-all group">
                  <div className="text-xs font-medium truncate group-hover:text-amber-400 transition-colors">{item.title}</div>
                  <div className="text-[10px] text-muted-foreground mt-1">{item.priceCredits} cr</div>
                  <div className="flex items-center gap-1 mt-1">
                    <TrendingUp className="w-2.5 h-2.5 text-emerald-400" />
                    <span className="text-[10px] text-emerald-400">{item.trendScore?.toFixed(0) || "Hot"}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Personalized Recommendations */}
        {!searchQuery && (recommendations as any[]).length > 0 && (
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-purple-400" />
              <h2 className="text-sm font-semibold text-purple-400 uppercase tracking-wider">Recommended For You</h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {(recommendations as any[]).map((item: any) => (
                <button key={item.id} onClick={() => onSelectListing(item.id)}
                  className="text-left p-3 rounded-lg border border-purple-600/30 bg-purple-950/10 hover:border-purple-500/50 hover:bg-purple-950/20 transition-all group">
                  <div className="text-xs font-medium truncate group-hover:text-purple-400 transition-colors">{item.title}</div>
                  <div className="text-[10px] text-muted-foreground mt-1">{item.priceCredits} cr</div>
                  <div className="flex items-center gap-1 mt-1">
                    <Star className="w-2.5 h-2.5 text-amber-400" />
                    <span className="text-[10px] text-muted-foreground">{item.score?.toFixed(0) || "Match"}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search the bazaar..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 pr-24 bg-card/50 border-border/50"
          />
          <button
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-amber-400 transition-colors flex items-center gap-1">
            <Filter className="w-3 h-3" />
            Advanced
          </button>
        </div>

        {/* Advanced Filters */}
        {showAdvancedFilters && (
          <div className="p-4 rounded-lg border border-border/30 bg-card/30 mb-4 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Min Price (credits)</label>
              <Input type="number" placeholder="0" value={priceMin} onChange={(e) => setPriceMin(e.target.value)} className="h-8 text-sm" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Max Price (credits)</label>
              <Input type="number" placeholder="Any" value={priceMax} onChange={(e) => setPriceMax(e.target.value)} className="h-8 text-sm" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Min Rating</label>
              <select className="w-full h-8 text-sm bg-card border border-border/50 rounded-md px-2 text-foreground">
                <option value="">Any</option>
                <option value="4">4+ stars</option>
                <option value="3">3+ stars</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">License</label>
              <select className="w-full h-8 text-sm bg-card border border-border/50 rounded-md px-2 text-foreground">
                <option value="">Any</option>
                <option value="MIT">MIT</option>
                <option value="GPL">GPL</option>
                <option value="Commercial">Commercial</option>
              </select>
            </div>
          </div>
        )}

        <div className="mb-6" />

        {/* Category Tabs */}
        <div className="flex items-center justify-between gap-4 flex-wrap mb-6">
          <div className="flex items-center gap-2 flex-wrap">
            {CATEGORIES.map((cat) => {
              const Icon = cat.icon;
              return (
                <Button
                  key={cat.value}
                  variant={activeCategory === cat.value ? "default" : "outline"}
                  size="sm"
                  onClick={() => setActiveCategory(cat.value)}
                  className={activeCategory === cat.value
                    ? "bg-amber-600 hover:bg-amber-700 text-white"
                    : "border-border/50 hover:border-amber-600/50 hover:text-amber-400"
                  }
                >
                  <Icon className="w-3.5 h-3.5 mr-1.5" />
                  {cat.label}
                </Button>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="text-sm bg-card border border-border/50 rounded-md px-3 py-1.5 text-foreground"
            >
              <option value="newest">Freshly Forged</option>
              <option value="rating">Highest Acclaim</option>
              <option value="sales">Most Sought</option>
              <option value="price_asc">Price: Low to High</option>
              <option value="price_desc">Price: High to Low</option>
            </select>

            {listings.length === 0 && !isLoading && (
              <Button
                variant="outline"
                size="sm"
                className="border-amber-600/50 text-amber-400 hover:bg-amber-600/10"
                onClick={() => seedMutation.mutate()}
                disabled={seedMutation.isPending}
              >
                {seedMutation.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Zap className="w-3.5 h-3.5 mr-1.5" />}
                Seed Marketplace
              </Button>
            )}
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
          </div>
        )}

        {/* Product Grid */}
        {!isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {(listings as any[]).map((item) => {
              const CatIcon = CATEGORY_ICONS[item.category] || Package2;
              let tags: string[] = [];
              try { tags = item.tags ? (typeof item.tags === 'string' ? JSON.parse(item.tags) : item.tags) : []; } catch { tags = []; }
              return (
                <Card
                  key={item.id}
                  className="group border-border/30 bg-card/50 hover:border-amber-600/40 hover:shadow-lg hover:shadow-amber-500/5 transition-all cursor-pointer overflow-hidden"
                  onClick={() => onSelectListing(item.id)}
                >
                  {/* Thumbnail */}
                  <div className="relative h-36 bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center">
                    <CatIcon className="w-12 h-12 text-muted-foreground/20" />
                    <div className="absolute top-2 left-2 flex gap-1">
                      {item.featured && (
                        <Badge className="bg-amber-600 text-white text-[10px] px-1.5 py-0.5 gap-1">
                          <Crown className="w-3 h-3" /> Featured
                        </Badge>
                      )}
                    </div>
                    <div className="absolute top-2 right-2">
                      <RiskBadge risk={item.riskCategory} />
                    </div>
                    <div className="absolute bottom-2 left-2">
                      <Badge variant="outline" className="text-[10px] border-border/50 bg-background/80">
                        {item.category}
                      </Badge>
                    </div>
                    {item.language && (
                      <div className="absolute bottom-2 right-2">
                        <Badge variant="outline" className="text-[10px] border-border/50 bg-background/80">
                          {item.language}
                        </Badge>
                      </div>
                    )}
                  </div>

                  <CardContent className="p-4 space-y-2">
                    <h3 className="font-semibold text-sm leading-tight line-clamp-2 group-hover:text-amber-400 transition-colors">
                      {item.title}
                    </h3>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {item.description}
                    </p>

                    {/* Tags */}
                    {tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {tags.slice(0, 3).map((tag: string) => (
                          <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                            {tag}
                          </span>
                        ))}
                        {tags.length > 3 && (
                          <span className="text-[10px] text-muted-foreground">+{tags.length - 3}</span>
                        )}
                      </div>
                    )}

                    {/* Verified Delivery + Stats */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {item.fileUrl ? (
                        <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-medium">
                          <CheckCircle2 className="w-3 h-3" /> Verified Delivery
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-[10px] text-amber-400/60">
                          <Loader2 className="w-3 h-3 animate-spin" /> Preparing...
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Eye className="w-3 h-3" /> {item.viewCount}</span>
                      <span className="flex items-center gap-1"><Download className="w-3 h-3" /> {item.totalSales}</span>
                      <span className="flex items-center gap-1 text-amber-400/80">
                        <Tag className="w-3 h-3" /> {item.uid}
                      </span>
                    </div>

                    {/* Rating + Price */}
                    <div className="flex items-center justify-between pt-1 border-t border-border/20">
                      <StarRating rating={item.avgRating} count={item.ratingCount} />
                      <div className="text-right">
                        <div className="text-sm font-bold text-amber-400 flex items-center gap-1">
                          <Coins className="w-3.5 h-3.5" /> {item.priceCredits.toLocaleString()}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          ${(Math.max(item.priceUsd || item.priceCredits, 50) / 100).toFixed(2)}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {!isLoading && listings.length === 0 && (
          <div className="text-center py-16">
            <Store className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-muted-foreground mb-4">No wares found. The bazaar awaits its first merchants.</p>
            <Button
              variant="outline"
              className="border-amber-600/50 text-amber-400 hover:bg-amber-600/10"
              onClick={() => seedMutation.mutate()}
              disabled={seedMutation.isPending}
            >
              {seedMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Zap className="w-4 h-4 mr-2" />}
              Seed Sample Listings
            </Button>
          </div>
        )}
      </div>

      {/* Affiliate Recommendations — contextual to marketplace browsing */}
      <AffiliateRecommendations context="marketplace" variant="banner" className="mt-6" />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// DETAIL VIEW — Single listing with purchase & review
// ═══════════════════════════════════════════════════════════════════

function DetailView({ listingId, onBack }: { listingId: number; onBack: () => void }) {
  const { data, isLoading } = trpc.marketplace.getById.useQuery({ id: listingId });
  const { data: hasPurchased } = trpc.marketplace.hasPurchased.useQuery({ listingId });
  const sub = useSubscription();
  const canBuy = sub.canUse("marketplace_buy");
  const utils = trpc.useUtils();

  const [showPurchaseDialog, setShowPurchaseDialog] = useState(false);
  const [showReviewDialog, setShowReviewDialog] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [sellerRating, setSellerRating] = useState(5);
  const [reviewTitle, setReviewTitle] = useState("");
  const [reviewComment, setReviewComment] = useState("");

  const purchaseMutation = trpc.marketplace.purchase.useMutation({
    onSuccess: (data) => {
      toast.success(`Purchase complete! ${data.priceCredits} credits deducted. Seller receives ${data.sellerShare} credits.`);
      setShowPurchaseDialog(false);
      utils.marketplace.getById.invalidate({ id: listingId });
      utils.marketplace.hasPurchased.invalidate({ listingId });
      utils.marketplace.myPurchases.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const stripeCheckoutMutation = trpc.stripe.marketplaceCheckout.useMutation({
    onSuccess: (data) => {
      if (data.url) window.location.href = data.url;
    },
    onError: (err) => toast.error(err.message),
  });

  const reviewMutation = trpc.marketplace.submitReview.useMutation({
    onSuccess: () => {
      toast.success("Review submitted! Thank you for your feedback.");
      setShowReviewDialog(false);
      utils.marketplace.getById.invalidate({ id: listingId });
      utils.marketplace.myPurchases.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
      </div>
    );
  }

  if (!data) return <div className="text-center py-20 text-muted-foreground">Listing not found</div>;

  const { listing, reviews, seller } = data;
  let tags: string[] = [];
  try { tags = listing.tags ? (typeof listing.tags === 'string' ? JSON.parse(listing.tags) : listing.tags) : []; } catch { tags = []; }
  const CatIcon = CATEGORY_ICONS[listing.category] || Package2;
  const displayRating = (listing.avgRating ?? 0) > 5 ? ((listing.avgRating ?? 0) / 100).toFixed(1) : (listing.avgRating ?? 0);

  return (
    <div className="max-w-5xl mx-auto px-6 py-6">
      {/* Back Button */}
      <Button variant="ghost" size="sm" onClick={onBack} className="mb-4 text-muted-foreground hover:text-foreground">
        <ArrowLeft className="w-4 h-4 mr-1" /> Back to Bazaar
      </Button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Header Card */}
          <Card className="border-border/30 bg-card/50">
            <div className="relative h-48 bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center rounded-t-lg">
              <CatIcon className="w-20 h-20 text-muted-foreground/15" />
              <div className="absolute top-3 left-3 flex gap-2">
                {listing.featured && (
                  <Badge className="bg-amber-600 text-white gap-1"><Crown className="w-3 h-3" /> Featured</Badge>
                )}
                <RiskBadge risk={listing.riskCategory} />
              </div>
              <div className="absolute bottom-3 right-3 flex gap-2">
                <Badge variant="outline" className="bg-background/80 border-border/50">{listing.category}</Badge>
                {listing.language && <Badge variant="outline" className="bg-background/80 border-border/50">{listing.language}</Badge>}
                {listing.license && <Badge variant="outline" className="bg-background/80 border-border/50">{listing.license}</Badge>}
              </div>
            </div>
            <CardContent className="p-6">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <h1 className="text-2xl font-bold mb-1">{listing.title}</h1>
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1 text-amber-400/80"><Tag className="w-3.5 h-3.5" /> {listing.uid}</span>
                    <span>v{listing.version}</span>
                    <span>{new Date(listing.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-amber-400 flex items-center gap-1">
                    <Coins className="w-5 h-5" /> {(listing.priceCredits ?? 0).toLocaleString()}
                  </div>
                  <div className="text-xs text-muted-foreground">credits</div>
                  {listing.priceCredits > 0 && (
                    <div className="text-xs text-muted-foreground mt-0.5">
                      ${(Math.max(listing.priceUsd || listing.priceCredits, 50) / 100).toFixed(2)} USD
                    </div>
                  )}
                </div>
              </div>

              <p className="text-muted-foreground mb-4">{listing.description}</p>

              {listing.longDescription && (
                <div className="prose prose-invert prose-sm max-w-none border-t border-border/20 pt-4 mt-4">
                  <div className="whitespace-pre-wrap">
                    {listing.longDescription.split('\n').map((line: string, i: number) => {
                      if (line.startsWith('# ')) return <h2 key={i} className="text-lg font-bold mt-3 mb-1">{line.slice(2)}</h2>;
                      if (line.startsWith('## ')) return <h3 key={i} className="text-base font-semibold mt-2 mb-1">{line.slice(3)}</h3>;
                      if (line.startsWith('- ')) return <li key={i} className="ml-4 list-disc">{line.slice(2)}</li>;
                      if (line.trim() === '') return <br key={i} />;
                      return <p key={i} className="mb-1">{line}</p>;
                    })}
                  </div>
                </div>
              )}

              {/* Code Preview — shows a teaser snippet of what's inside the package */}
              {listing.previewUrl && (
                <div className="mt-4 rounded-lg border border-border/30 overflow-hidden">
                  <div className="flex items-center justify-between px-3 py-2 bg-slate-900/80 border-b border-border/20">
                    <div className="flex items-center gap-2">
                      <Code2 className="w-4 h-4 text-cyan-400" />
                      <span className="text-xs font-mono text-muted-foreground">preview.{listing.language?.toLowerCase() || 'py'}</span>
                    </div>
                    <Badge className="bg-cyan-600/20 text-cyan-400 text-[10px]">Preview</Badge>
                  </div>
                  <div className="bg-slate-950/80 p-3 overflow-x-auto max-h-48">
                    <pre className="text-xs font-mono text-slate-300 whitespace-pre">
                      {`# Preview of ${listing.title}\n# Full source code available after purchase\n\n`}
                      {listing.description.slice(0, 200)}
                    </pre>
                  </div>
                </div>
              )}

              {tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-4">
                  {tags.map((tag: string) => (
                    <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
                  ))}
                </div>
              )}

              {(listing.riskCategory === "medium_risk" || listing.riskCategory === "high_risk") && (
                <div className={`mt-4 p-3 rounded-lg border ${listing.riskCategory === "high_risk" ? "border-red-600/50 bg-red-950/20" : "border-amber-600/50 bg-amber-950/20"}`}>
                  <div className="flex items-center gap-2 text-sm font-medium mb-1">
                    <AlertTriangle className={`w-4 h-4 ${listing.riskCategory === "high_risk" ? "text-red-400" : "text-amber-400"}`} />
                    {listing.riskCategory === "high_risk" ? "High Risk Product" : "Medium Risk Product"}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    This item has been categorized as {listing.riskCategory.replace("_", " ")} by our AI review system.
                    The platform facilitates the sale of security tools and code but disclaims liability for misuse or illegal activity.
                    {listing.reviewNotes && ` Review notes: ${listing.reviewNotes}`}
                  </p>
                </div>
              )}

              <div className="flex items-center gap-6 mt-4 pt-4 border-t border-border/20 text-sm text-muted-foreground">
                <span className="flex items-center gap-1"><Eye className="w-4 h-4" /> {listing.viewCount} views</span>
                <span className="flex items-center gap-1"><Download className="w-4 h-4" /> {listing.totalSales} sales</span>
                <StarRating rating={listing.avgRating} count={listing.ratingCount} size="md" />
              </div>
            </CardContent>
          </Card>

          {/* Reviews Section */}
          <Card className="border-border/30 bg-card/50">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-amber-400" /> Reviews ({(reviews as any[]).length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {(reviews as any[]).length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No reviews yet. Be the first to review!</p>
              )}
              {(reviews as any[]).map((review) => (
                <div key={review.id} className="border-b border-border/20 pb-4 last:border-0">
                  <div className="flex items-center justify-between mb-2">
                    <StarRating rating={review.rating} count={0} size="md" />
                    <span className="text-xs text-muted-foreground">{new Date(review.createdAt).toLocaleDateString()}</span>
                  </div>
                  {review.title && <h4 className="font-medium text-sm mb-1">{review.title}</h4>}
                  {review.comment && <p className="text-sm text-muted-foreground">{review.comment}</p>}
                  {review.sellerRating && (
                    <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                      <span>Seller rating:</span>
                      <StarRating rating={review.sellerRating} count={0} />
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <Card className="border-amber-600/30 bg-card/50">
            <CardContent className="p-6 space-y-4">
              <div className="text-center">
                <div className="text-3xl font-bold text-amber-400 flex items-center justify-center gap-2">
                  <Coins className="w-7 h-7" /> {(listing.priceCredits ?? 0).toLocaleString()}
                </div>
                <div className="text-sm text-muted-foreground">credits</div>
                {listing.priceCredits > 0 && (
                  <div className="text-sm text-muted-foreground mt-1">
                    or <span className="font-semibold text-foreground">${(Math.max(listing.priceUsd || listing.priceCredits, 50) / 100).toFixed(2)}</span> USD
                  </div>
                )}
              </div>

              {hasPurchased ? (
                <div className="space-y-2">
                  <Button className="w-full bg-emerald-600 hover:bg-emerald-700" disabled>
                    <CheckCircle2 className="w-4 h-4 mr-2" /> Purchased
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full border-amber-600/50 text-amber-400"
                    onClick={() => setShowReviewDialog(true)}
                  >
                    <Star className="w-4 h-4 mr-2" /> Write a Review
                  </Button>
                </div>
              ) : canBuy ? (
                <Button
                  className="w-full bg-amber-600 hover:bg-amber-700 text-white"
                  onClick={() => setShowPurchaseDialog(true)}
                >
                  <ShoppingCart className="w-4 h-4 mr-2" /> Purchase Now
                </Button>
              ) : (
                <div className="space-y-2">
                  <div className="w-full flex items-center gap-2 p-3 rounded-lg border border-amber-600/30 bg-amber-950/10 text-sm text-amber-400">
                    <Crown className="w-4 h-4 shrink-0" />
                    <span>Upgrade to Pro to buy items in the Bazaar</span>
                  </div>
                  <Button
                    className="w-full bg-amber-600 hover:bg-amber-700 text-white"
                    onClick={() => window.location.href = "/pricing"}
                  >
                    <Crown className="w-4 h-4 mr-2" /> Upgrade to Pro
                  </Button>
                </div>
              )}

              {listing.demoUrl && (
                <Button variant="outline" className="w-full" asChild>
                  <a href={listing.demoUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="w-4 h-4 mr-2" /> View Demo
                  </a>
                </Button>
              )}
            </CardContent>
          </Card>

          {seller && (
            <Card className="border-border/30 bg-card/50">
              <CardContent className="p-4">
                <h3 className="text-sm font-medium mb-2">Seller</h3>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white font-bold">
                    {seller.displayName?.[0] || "?"}
                  </div>
                  <div>
                    <div className="font-medium text-sm flex items-center gap-1">
                      {seller.displayName}
                      {seller.verified && <CheckCircle2 className="w-3.5 h-3.5 text-blue-400" />}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{seller.totalSales} sales</span>
                      {seller.ratingCount > 0 && (
                        <StarRating rating={seller.avgRating} count={seller.ratingCount} />
                      )}
                    </div>
                  </div>
                </div>
                {seller.bio && <p className="text-xs text-muted-foreground mt-2">{seller.bio}</p>}
              </CardContent>
            </Card>
          )}

          <Card className="border-border/30 bg-card/50">
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-medium mb-2">Details</h3>
              {/* Verified Delivery Badge */}
              {listing.fileUrl ? (
                <div className="flex items-center gap-2 p-2 rounded-lg bg-emerald-600/10 border border-emerald-600/30 mb-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <div>
                    <div className="text-xs font-semibold text-emerald-400">Verified Delivery</div>
                    <div className="text-[10px] text-muted-foreground">
                      {listing.fileType?.toUpperCase() || "ZIP"} package ready
                      {listing.fileSize ? ` · ${(listing.fileSize / 1024).toFixed(0)} KB` : ""}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-600/10 border border-amber-600/30 mb-2">
                  <Loader2 className="w-4 h-4 text-amber-400 shrink-0 animate-spin" />
                  <div className="text-xs text-amber-400">File package being prepared...</div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <span className="text-muted-foreground">Category</span>
                <span className="text-right capitalize">{listing.category}</span>
                <span className="text-muted-foreground">Language</span>
                <span className="text-right">{listing.language || "N/A"}</span>
                <span className="text-muted-foreground">License</span>
                <span className="text-right">{listing.license || "N/A"}</span>
                <span className="text-muted-foreground">Version</span>
                <span className="text-right">{listing.version || "1.0.0"}</span>
                <span className="text-muted-foreground">Risk Level</span>
                <span className="text-right capitalize">{listing.riskCategory.replace("_", " ")}</span>
                {listing.fileSize ? (
                  <>
                    <span className="text-muted-foreground">File Size</span>
                    <span className="text-right">{(listing.fileSize / 1024).toFixed(0)} KB</span>
                  </>
                ) : null}
                <span className="text-muted-foreground">Item ID</span>
                <span className="text-right font-mono text-amber-400/80">{listing.uid}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Purchase Dialog — Dual Payment Options */}
      <Dialog open={showPurchaseDialog} onOpenChange={setShowPurchaseDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-amber-400" /> Purchase {listing.title}
            </DialogTitle>
            <DialogDescription>
              Choose your preferred payment method. The seller receives 92% and the platform retains 8% as a commission.
            </DialogDescription>
          </DialogHeader>

          {/* Price Summary */}
          <div className="space-y-2 py-3 border-y border-border/30">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Item Price</span>
              <span className="font-medium">{listing.priceCredits.toLocaleString()} credits <span className="text-muted-foreground">/ ${(Math.max(listing.priceUsd || listing.priceCredits, 50) / 100).toFixed(2)}</span></span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Platform Fee (8%)</span>
              <span className="text-muted-foreground">{Math.floor(listing.priceCredits * 0.08).toLocaleString()} credits</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Seller Receives</span>
              <span className="text-emerald-400">{Math.floor(listing.priceCredits * 0.92).toLocaleString()} credits</span>
            </div>
          </div>

          {/* Payment Options */}
          <div className="space-y-3 py-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Payment Method</p>

            {/* Option 1: Pay with Credits */}
            <button
              className="w-full flex items-center gap-4 p-4 rounded-lg border border-border/50 hover:border-amber-600/60 hover:bg-amber-950/10 transition-all text-left group"
              onClick={() => purchaseMutation.mutate({ listingId: listing.id })}
              disabled={purchaseMutation.isPending || stripeCheckoutMutation.isPending}
            >
              <div className="w-10 h-10 rounded-full bg-amber-600/20 flex items-center justify-center shrink-0">
                {purchaseMutation.isPending ? <Loader2 className="w-5 h-5 text-amber-400 animate-spin" /> : <Coins className="w-5 h-5 text-amber-400" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm group-hover:text-amber-400 transition-colors">Pay with Credits</div>
                <div className="text-xs text-muted-foreground">{listing.priceCredits.toLocaleString()} credits deducted instantly from your balance</div>
              </div>
              <Coins className="w-4 h-4 text-muted-foreground/50 shrink-0" />
            </button>

            {/* Option 2: Pay with Card (Stripe) */}
            <button
              className="w-full flex items-center gap-4 p-4 rounded-lg border border-border/50 hover:border-blue-600/60 hover:bg-blue-950/10 transition-all text-left group"
              onClick={() => stripeCheckoutMutation.mutate({ listingId: listing.id })}
              disabled={purchaseMutation.isPending || stripeCheckoutMutation.isPending}
            >
              <div className="w-10 h-10 rounded-full bg-blue-600/20 flex items-center justify-center shrink-0">
                {stripeCheckoutMutation.isPending ? <Loader2 className="w-5 h-5 text-blue-400 animate-spin" /> : <CreditCard className="w-5 h-5 text-blue-400" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm group-hover:text-blue-400 transition-colors">Pay with Card</div>
                <div className="text-xs text-muted-foreground">${(Math.max(listing.priceUsd || listing.priceCredits, 50) / 100).toFixed(2)} USD via secure Stripe checkout</div>
              </div>
              <CreditCard className="w-4 h-4 text-muted-foreground/50 shrink-0" />
            </button>
          </div>

          {/* Anti-resale notice */}
          <div className="p-3 rounded-lg border border-amber-600/30 bg-amber-950/10 text-xs text-muted-foreground">
            <Shield className="w-3.5 h-3.5 inline mr-1 text-amber-400" />
            <strong className="text-amber-400">Anti-resale protection:</strong> Purchased items cannot be re-listed on the marketplace. Only original work is allowed.
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Review Dialog */}
      <Dialog open={showReviewDialog} onOpenChange={setShowReviewDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Write a Review</DialogTitle>
            <DialogDescription>Share your experience with this item.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Item Rating</label>
              <StarInput value={reviewRating} onChange={setReviewRating} />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Seller Rating</label>
              <StarInput value={sellerRating} onChange={setSellerRating} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Title (optional)</label>
              <Input value={reviewTitle} onChange={(e) => setReviewTitle(e.target.value)} placeholder="Brief summary..." />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Comment (optional)</label>
              <Textarea value={reviewComment} onChange={(e) => setReviewComment(e.target.value)} placeholder="Share your detailed experience..." rows={4} />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button
              className="bg-amber-600 hover:bg-amber-700"
              onClick={() => {
                reviewMutation.mutate({
                  purchaseId: 0,
                  rating: reviewRating,
                  sellerRating,
                  title: reviewTitle || undefined,
                  comment: reviewComment || undefined,
                });
              }}
              disabled={reviewMutation.isPending}
            >
              {reviewMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Star className="w-4 h-4 mr-2" />}
              Submit Review
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// INVENTORY VIEW — My purchased items
// ═══════════════════════════════════════════════════════════════════

function InventoryView({ onSelectListing }: { onSelectListing: (id: number) => void }) {
  const sub = useSubscription();
  const canBuy = sub.canUse("marketplace_buy");
  const { data: purchases = [], isLoading } = trpc.marketplace.myPurchases.useQuery(undefined, { enabled: canBuy });
  const { data: wishlist = [] } = trpc.marketplaceIntelligence.getWishlist.useQuery(undefined, { enabled: canBuy });
  const { data: myDisputes = [] } = trpc.marketplaceIntelligence.getMyDisputes.useQuery({ role: "buyer" }, { enabled: canBuy });
  const [downloading, setDownloading] = useState<string | null>(null);
  const [inventoryTab, setInventoryTab] = useState("purchases");
  const [disputeListingId, setDisputeListingId] = useState<number | null>(null);
  const [disputeReason, setDisputeReason] = useState("");
  const [disputeDesc, setDisputeDesc] = useState("");

  const removeWishlistMutation = trpc.marketplaceIntelligence.removeFromWishlist.useMutation({
    onSuccess: () => toast.success("Removed from wishlist"),
    onError: (err) => toast.error(err.message),
  });

  const openDisputeMutation = trpc.marketplaceIntelligence.openDispute.useMutation({
    onSuccess: () => { toast.success("Dispute opened. We'll review within 48 hours."); setDisputeListingId(null); setDisputeReason(""); setDisputeDesc(""); },
    onError: (err) => toast.error(err.message),
  });

  const handleDownload = async (e: React.MouseEvent, downloadToken: string) => {
    e.stopPropagation();
    if (!downloadToken) { toast.error("No download token available"); return; }
    setDownloading(downloadToken);
    try {
      const res = await fetch(`/api/marketplace/download/${downloadToken}`, { credentials: "include" });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Download failed"); return; }
      window.open(data.downloadUrl, "_blank");
      toast.success(`Download started! ${data.downloadsRemaining} downloads remaining.`);
    } catch (err: any) {
      toast.error(err.message || "Download failed");
    } finally {
      setDownloading(null);
    }
  };

  // Free tier gate
  if (!sub.loading && !canBuy) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-12 text-center">
        <Package2 className="w-16 h-16 text-muted-foreground/20 mx-auto mb-4" />
        <h2 className="text-2xl font-bold mb-3">Purchases Require Pro</h2>
        <p className="text-muted-foreground mb-6">Upgrade to Pro to buy items from the Bazaar and access your purchase inventory.</p>
        <Button className="bg-amber-600 hover:bg-amber-700 text-white" onClick={() => window.location.href = "/pricing"}>
          <Crown className="w-4 h-4 mr-2" /> Upgrade to Pro
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-6">
      <div className="flex items-center gap-3 mb-6">
        <Package2 className="w-6 h-6 text-amber-400" />
        <h1 className="text-2xl font-bold">My Inventory</h1>
        <Badge variant="outline">{(purchases as any[]).length} purchases</Badge>
        {(wishlist as any[]).length > 0 && <Badge variant="outline" className="text-purple-400 border-purple-600/50">{(wishlist as any[]).length} wishlist</Badge>}
        {(myDisputes as any[]).length > 0 && <Badge variant="outline" className="text-red-400 border-red-600/50">{(myDisputes as any[]).length} disputes</Badge>}
      </div>

      <Tabs value={inventoryTab} onValueChange={setInventoryTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="purchases">Purchases ({(purchases as any[]).length})</TabsTrigger>
          <TabsTrigger value="wishlist">Wishlist ({(wishlist as any[]).length})</TabsTrigger>
          <TabsTrigger value="disputes">Disputes ({(myDisputes as any[]).length})</TabsTrigger>
        </TabsList>

        <TabsContent value="purchases">
          {isLoading && <div className="flex items-center justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-amber-400" /></div>}
          {!isLoading && (purchases as any[]).length === 0 && (
            <div className="text-center py-16">
              <Package2 className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
              <p className="text-muted-foreground mb-2">Your inventory is empty.</p>
              <p className="text-sm text-muted-foreground">Browse the Grand Bazaar to find items.</p>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(purchases as any[]).map((purchase) => {
              const listing = purchase.listing;
              if (!listing) return null;
              const CatIcon = CATEGORY_ICONS[listing.category] || Package2;
              return (
                <Card key={purchase.id} className="border-border/30 bg-card/50 hover:border-amber-600/40 transition-all cursor-pointer" onClick={() => onSelectListing(listing.id)}>
                  <CardContent className="p-4">
                    <div className="flex gap-4">
                      <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center flex-shrink-0">
                        <CatIcon className="w-8 h-8 text-muted-foreground/20" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-sm truncate">{listing.title}</h3>
                        <p className="text-xs text-muted-foreground line-clamp-1">{listing.description}</p>
                        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1"><Coins className="w-3 h-3 text-amber-400" /> {purchase.priceCredits}</span>
                          <span>{new Date(purchase.createdAt).toLocaleDateString()}</span>
                          <Badge variant="outline" className="text-[10px]">{purchase.status}</Badge>
                          {!purchase.hasReviewed && <Badge className="bg-amber-600/20 text-amber-400 text-[10px]">Review pending</Badge>}
                        </div>
                        <div className="mt-2 flex gap-2">
                          <Button size="sm" variant="outline" className="text-emerald-400 border-emerald-600/50 text-xs h-7"
                            disabled={downloading === purchase.downloadToken}
                            onClick={(e) => handleDownload(e, purchase.downloadToken)}>
                            {downloading === purchase.downloadToken ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Download className="w-3 h-3 mr-1" />}
                            Download ({purchase.maxDownloads - purchase.downloadCount} left)
                          </Button>
                          <Button size="sm" variant="outline" className="text-red-400 border-red-600/50 text-xs h-7"
                            onClick={(e) => { e.stopPropagation(); setDisputeListingId(listing.id); }}>
                            <AlertTriangle className="w-3 h-3 mr-1" /> Dispute
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="wishlist">
          {(wishlist as any[]).length === 0 ? (
            <div className="text-center py-16">
              <Star className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
              <p className="text-muted-foreground">Your wishlist is empty. Click the heart icon on any listing to save it.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(wishlist as any[]).map((item: any) => (
                <Card key={item.id} className="border-border/30 bg-card/50 hover:border-purple-600/40 transition-all cursor-pointer" onClick={() => onSelectListing(item.listingId)}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-sm truncate">{item.listing?.title || `Listing #${item.listingId}`}</h3>
                        <p className="text-xs text-muted-foreground mt-1">{item.listing?.priceCredits} credits</p>
                        <p className="text-xs text-muted-foreground">Saved {new Date(item.createdAt).toLocaleDateString()}</p>
                      </div>
                      <Button size="sm" variant="outline" className="text-red-400 border-red-600/50 text-xs ml-3"
                        onClick={(e) => { e.stopPropagation(); removeWishlistMutation.mutate({ listingId: item.listingId }); }}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="disputes">
          {(myDisputes as any[]).length === 0 ? (
            <div className="text-center py-16">
              <Shield className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
              <p className="text-muted-foreground">No disputes. If you have an issue with a purchase, use the Dispute button on the item.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {(myDisputes as any[]).map((dispute: any) => (
                <Card key={dispute.id} className="border-border/30 bg-card/50">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Badge className={dispute.status === 'open' ? 'bg-amber-600/20 text-amber-400' : dispute.status === 'resolved' ? 'bg-emerald-600/20 text-emerald-400' : 'bg-red-600/20 text-red-400'}>
                            {dispute.status}
                          </Badge>
                          <span className="text-sm font-medium">{dispute.reason}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">{dispute.description}</p>
                        <p className="text-xs text-muted-foreground mt-1">Opened {new Date(dispute.createdAt).toLocaleDateString()}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Dispute Dialog */}
      <Dialog open={disputeListingId !== null} onOpenChange={(open) => { if (!open) setDisputeListingId(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Open a Dispute</DialogTitle>
            <DialogDescription>Describe the issue with your purchase. We review all disputes within 48 hours.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium mb-1 block">Reason</label>
              <select value={disputeReason} onChange={(e) => setDisputeReason(e.target.value)}
                className="w-full text-sm bg-card border border-border/50 rounded-md px-3 py-2 text-foreground">
                <option value="">Select a reason...</option>
                <option value="not_as_described">Not as described</option>
                <option value="not_working">Not working</option>
                <option value="wrong_item">Wrong item delivered</option>
                <option value="no_download">Cannot download</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Description</label>
              <Textarea value={disputeDesc} onChange={(e) => setDisputeDesc(e.target.value)} rows={4} placeholder="Describe the issue in detail..." />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button className="bg-red-600 hover:bg-red-700"
              onClick={() => { if (disputeListingId && disputeReason) openDisputeMutation.mutate({ purchaseId: disputeListingId, reason: disputeReason as any, description: disputeDesc }); }}
              disabled={!disputeReason || openDisputeMutation.isPending}>
              {openDisputeMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <AlertTriangle className="w-3.5 h-3.5 mr-1" />}
              Submit Dispute
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════
// PAYOUT METHODS MANAGER — BSB/Account, PayPal, Stripe Connect
// ═══════════════════════════════════════════════════════════════════

function PayoutMethodsManager() {
  const { data: payoutMethods = [], isLoading, refetch } = trpc.marketplace.getPayoutMethods.useQuery();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [methodType, setMethodType] = useState<"bank_transfer" | "paypal" | "stripe_connect">("bank_transfer");
  const [formData, setFormData] = useState({
    label: "",
    bankBsb: "", bankAccountNumber: "", bankAccountName: "", bankName: "", bankCountry: "AU", bankSwiftBic: "",
    paypalEmail: "",
  });

  const addMutation = trpc.marketplace.addPayoutMethod.useMutation({
    onSuccess: () => {
      toast.success("Payout method added successfully!");
      setShowAddDialog(false);
      setFormData({ label: "", bankBsb: "", bankAccountNumber: "", bankAccountName: "", bankName: "", bankCountry: "AU", bankSwiftBic: "", paypalEmail: "" });
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.marketplace.deletePayoutMethod.useMutation({
    onSuccess: () => { toast.success("Payout method removed"); refetch(); },
    onError: (err) => toast.error(err.message),
  });

  const setDefaultMutation = trpc.marketplace.updatePayoutMethod.useMutation({
    onSuccess: () => { toast.success("Default payout method updated"); refetch(); },
    onError: (err) => toast.error(err.message),
  });

  const handleAdd = () => {
    const payload: any = { methodType, label: formData.label || undefined, isDefault: (payoutMethods as any[]).length === 0 };
    if (methodType === "bank_transfer") {
      if (!formData.bankBsb || !formData.bankAccountNumber || !formData.bankAccountName) {
        toast.error("BSB, account number, and account name are required"); return;
      }
      payload.bankBsb = formData.bankBsb;
      payload.bankAccountNumber = formData.bankAccountNumber;
      payload.bankAccountName = formData.bankAccountName;
      payload.bankName = formData.bankName || undefined;
      payload.bankCountry = formData.bankCountry || "AU";
      payload.bankSwiftBic = formData.bankSwiftBic || undefined;
    } else if (methodType === "paypal") {
      if (!formData.paypalEmail) { toast.error("PayPal email is required"); return; }
      payload.paypalEmail = formData.paypalEmail;
    } else if (methodType === "stripe_connect") {
      // Stripe Connect will be set up via onboarding link
    }
    addMutation.mutate(payload);
  };

  const METHOD_ICONS: Record<string, any> = {
    bank_transfer: Building2,
    paypal: Wallet,
    stripe_connect: CreditCard,
  };

  const METHOD_LABELS: Record<string, string> = {
    bank_transfer: "Bank Transfer (BSB/Account)",
    paypal: "PayPal",
    stripe_connect: "Stripe Connect",
  };

  return (
    <Card className="border-border/30 bg-card/50">
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Wallet className="w-5 h-5 text-amber-400" /> Payout Methods
          </CardTitle>
          <Button size="sm" className="bg-amber-600 hover:bg-amber-700" onClick={() => setShowAddDialog(true)}>
            <Plus className="w-4 h-4 mr-1" /> Add Method
          </Button>
        </div>
        <CardDescription>Configure how you want to receive payments from your sales.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading && <Loader2 className="w-6 h-6 animate-spin text-amber-400 mx-auto" />}

        {!isLoading && (payoutMethods as any[]).length === 0 && (
          <div className="text-center py-6 border border-dashed border-border/50 rounded-lg">
            <Wallet className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground mb-1">No payout methods configured</p>
            <p className="text-xs text-muted-foreground">Add a bank account, PayPal, or Stripe to receive payments.</p>
          </div>
        )}

        {(payoutMethods as any[]).map((method: any) => {
          const Icon = METHOD_ICONS[method.methodType] || Wallet;
          return (
            <div key={method.id} className="flex items-center justify-between p-4 rounded-lg border border-border/30 bg-card/30">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  method.methodType === "bank_transfer" ? "bg-blue-500/10 text-blue-400" :
                  method.methodType === "paypal" ? "bg-blue-600/10 text-blue-500" :
                  "bg-purple-500/10 text-purple-400"
                }`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{METHOD_LABELS[method.methodType]}</span>
                    {method.isDefault && <Badge className="bg-emerald-600 text-white text-[10px]">Default</Badge>}
                    {method.verified && <Badge className="bg-blue-600 text-white text-[10px]">Verified</Badge>}
                    {method.label && <span className="text-xs text-muted-foreground">({method.label})</span>}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {method.methodType === "bank_transfer" && (
                      <span>BSB: {method.bankBsb} | Acc: ****{method.bankAccountNumber?.slice(-4)} | {method.bankAccountName}</span>
                    )}
                    {method.methodType === "paypal" && (
                      <span>{method.paypalEmail}</span>
                    )}
                    {method.methodType === "stripe_connect" && (
                      <span>{method.stripeConnectOnboarded ? "Connected & Active" : "Onboarding required"}</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {!method.isDefault && (
                  <Button size="sm" variant="outline" className="text-xs h-7"
                    onClick={() => setDefaultMutation.mutate({ id: method.id, isDefault: true })}>
                    Set Default
                  </Button>
                )}
                <Button size="sm" variant="outline" className="text-red-400 border-red-600/50 text-xs h-7"
                  onClick={() => { if (confirm("Remove this payout method?")) deleteMutation.mutate({ id: method.id }); }}>
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </div>
          );
        })}
      </CardContent>

      {/* Add Payout Method Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Payout Method</DialogTitle>
            <DialogDescription>Choose how you want to receive payments from your marketplace sales.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Method Type Selection */}
            <div className="grid grid-cols-3 gap-3">
              {(["bank_transfer", "paypal", "stripe_connect"] as const).map((type) => {
                const Icon = METHOD_ICONS[type];
                const isSelected = methodType === type;
                return (
                  <button
                    key={type}
                    onClick={() => setMethodType(type)}
                    className={`p-4 rounded-lg border text-center transition-all ${
                      isSelected
                        ? "border-amber-500 bg-amber-500/10 text-amber-400"
                        : "border-border/50 hover:border-amber-500/50 text-muted-foreground"
                    }`}
                  >
                    <Icon className="w-6 h-6 mx-auto mb-2" />
                    <div className="text-xs font-medium">
                      {type === "bank_transfer" ? "Bank Transfer" : type === "paypal" ? "PayPal" : "Stripe"}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Label */}
            <div>
              <label className="text-sm font-medium mb-1 block">Label (optional)</label>
              <Input value={formData.label} onChange={(e) => setFormData({ ...formData, label: e.target.value })} placeholder="e.g. Primary Business Account" />
            </div>

            {/* Bank Transfer Fields */}
            {methodType === "bank_transfer" && (
              <div className="space-y-3 border-t border-border/30 pt-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium mb-1 block">BSB *</label>
                    <Input value={formData.bankBsb} onChange={(e) => setFormData({ ...formData, bankBsb: e.target.value })}
                      placeholder="000-000" maxLength={7} />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Account Number *</label>
                    <Input value={formData.bankAccountNumber} onChange={(e) => setFormData({ ...formData, bankAccountNumber: e.target.value })}
                      placeholder="12345678" />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Account Name *</label>
                  <Input value={formData.bankAccountName} onChange={(e) => setFormData({ ...formData, bankAccountName: e.target.value })}
                    placeholder="John Smith" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium mb-1 block">Bank Name</label>
                    <Input value={formData.bankName} onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                      placeholder="Commonwealth Bank" />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Country</label>
                    <Input value={formData.bankCountry} onChange={(e) => setFormData({ ...formData, bankCountry: e.target.value })}
                      placeholder="AU" maxLength={2} />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">SWIFT/BIC (for international)</label>
                  <Input value={formData.bankSwiftBic} onChange={(e) => setFormData({ ...formData, bankSwiftBic: e.target.value })}
                    placeholder="CTBAAU2S" />
                </div>
              </div>
            )}

            {/* PayPal Fields */}
            {methodType === "paypal" && (
              <div className="space-y-3 border-t border-border/30 pt-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">PayPal Email *</label>
                  <Input type="email" value={formData.paypalEmail} onChange={(e) => setFormData({ ...formData, paypalEmail: e.target.value })}
                    placeholder="your@email.com" />
                </div>
                <div className="p-3 rounded-lg bg-blue-950/20 border border-blue-600/30 text-xs text-muted-foreground">
                  <Mail className="w-3.5 h-3.5 inline mr-1 text-blue-400" />
                  Payments will be sent to this PayPal email. Ensure it matches your PayPal account.
                </div>
              </div>
            )}

            {/* Stripe Connect */}
            {methodType === "stripe_connect" && (
              <div className="space-y-3 border-t border-border/30 pt-4">
                <div className="p-4 rounded-lg bg-purple-950/20 border border-purple-600/30 text-center">
                  <CreditCard className="w-8 h-8 text-purple-400 mx-auto mb-2" />
                  <p className="text-sm font-medium mb-1">Stripe Connect</p>
                  <p className="text-xs text-muted-foreground mb-3">
                    Connect your Stripe account for instant, automated payouts. You will be redirected to Stripe to complete onboarding.
                  </p>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button className="bg-amber-600 hover:bg-amber-700" onClick={handleAdd} disabled={addMutation.isPending}>
              {addMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
              {methodType === "stripe_connect" ? "Connect Stripe" : "Add Payout Method"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════════
// SELL VIEW — Create and manage listings
// ═══════════════════════════════════════════════════════════════════

function SellView({ onSelectListing }: { onSelectListing: (id: number) => void }) {
  const sub = useSubscription();
  const canSell = sub.canUse("marketplace_sell");
  const { data: sellerStatus, isLoading: sellerLoading, refetch: refetchSeller } = trpc.marketplace.sellerStatus.useQuery();
  const { data: myListings = [], isLoading, refetch } = trpc.marketplace.myListings.useQuery(undefined, {
    enabled: !!(sellerStatus as any)?.isActive,
  });
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showSellerSignup, setShowSellerSignup] = useState(false);
  const [sellerName, setSellerName] = useState("");
  const [sellerBio, setSellerBio] = useState("");
  const [newListing, setNewListing] = useState({
    title: "", description: "", longDescription: "", category: "modules" as const,
    priceCredits: 100, tags: "", language: "", license: "MIT", version: "1.0.0",
  });

  const purchaseSellerSub = trpc.stripe.purchaseSellerSubscription.useMutation({
    onSuccess: (data) => {
      if (data.url) window.location.href = data.url;
    },
    onError: (err) => toast.error(err.message),
  });

  const becomeSellerCredits = trpc.marketplace.becomeSeller.useMutation({
    onSuccess: () => {
      toast.success("Welcome to the Bazaar! Your seller stall is now active.");
      setShowSellerSignup(false);
      refetchSeller();
    },
    onError: (err) => toast.error(err.message),
  });

  const createMutation = trpc.marketplace.create.useMutation({
    onSuccess: (data) => {
      toast.success(`Listing created! ID: ${data.uid}. Risk: ${data.riskCategory}. Status: ${data.reviewStatus}`);
      setShowCreateDialog(false);
      setNewListing({ title: "", description: "", longDescription: "", category: "modules", priceCredits: 100, tags: "", language: "", license: "MIT", version: "1.0.0" });
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.marketplace.delete.useMutation({
    onSuccess: () => { toast.success("Listing deleted"); refetch(); },
    onError: (err) => toast.error(err.message),
  });

  const [uploading, setUploading] = useState<number | null>(null);

  const handleFileUpload = async (listingId: number) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".zip,.tar.gz,.tgz,.gz,.js,.ts,.py,.json,.md,.txt,.pdf";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      if (file.size > 100 * 1024 * 1024) { toast.error("File too large. Max 100MB."); return; }
      setUploading(listingId);
      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("listingId", String(listingId));
        const csrfTk = document.cookie.split('; ').find(c => c.startsWith('csrf_token='))?.split('=')[1] || '';
        const res = await fetch("/api/marketplace/upload", { method: "POST", body: formData, credentials: "include", headers: csrfTk ? { 'x-csrf-token': csrfTk } : {} });
        const data = await res.json();
        if (!res.ok) { toast.error(data.error || "Upload failed"); return; }
        toast.success(`File uploaded! ${data.fileName} (${data.fileSizeMb}MB)`);
        refetch();
      } catch (err: any) {
        toast.error(err.message || "Upload failed");
      } finally {
        setUploading(null);
      }
    };
    input.click();
  };

  const updateMutation = trpc.marketplace.update.useMutation({
    onSuccess: () => { toast.success("Listing updated"); refetch(); },
    onError: (err) => toast.error(err.message),
  });

  const boostMutation = trpc.marketplace.boostListing.useMutation({
    onSuccess: () => { toast.success("Listing boosted for 7 days! (200 credits deducted)"); refetch(); },
    onError: (err) => toast.error(err.message),
  });

  const featureMutation = trpc.marketplace.featureListing.useMutation({
    onSuccess: () => { toast.success("Listing featured for 30 days! (500 credits deducted)"); refetch(); },
    onError: (err) => toast.error(err.message),
  });

  const verifySellerMutation = trpc.marketplace.verifySeller.useMutation({
    onSuccess: () => { toast.success("Seller verified! Permanent verified badge added. (1000 credits)"); refetchSeller(); },
    onError: (err) => toast.error(err.message),
  });

  const renewSellerMutation = trpc.marketplace.renewSeller.useMutation({
    onSuccess: () => { toast.success("Seller subscription renewed for another year!"); refetchSeller(); },
    onError: (err) => toast.error(err.message),
  });

  const generateDescMutation = trpc.marketplaceIntelligence.generateDescription.useMutation({
    onSuccess: (data) => {
      if (data.description) setNewListing(prev => ({ ...prev, longDescription: data.description }));
      toast.success("AI description generated!");
    },
    onError: (err) => toast.error(err.message),
  });

  const { data: priceSuggestion } = trpc.marketplaceIntelligence.suggestPrice.useQuery(
    { category: newListing.category, tags: newListing.tags ? newListing.tags.split(",").map((t: string) => t.trim()) : [] },
    { enabled: showCreateDialog }
  );

  const STATUS_COLORS: Record<string, string> = {
    active: "bg-emerald-600", draft: "bg-slate-600", paused: "bg-amber-600",
    pending_review: "bg-blue-600", approved: "bg-emerald-600", rejected: "bg-red-600", flagged: "bg-red-600",
  };

  // Check for seller_success URL param
  const urlParams = new URLSearchParams(window.location.search);
  const sellerSuccess = urlParams.get("seller_success");
  if (sellerSuccess === "true" && sellerStatus && !(sellerStatus as any).isActive) {
    setTimeout(() => refetchSeller(), 1500);
  }

  const isActiveSeller = !!(sellerStatus as any)?.isActive;
  const sellerExpiry = (sellerStatus as any)?.expiresAt;

  // ── FREE TIER: Browse-only gate ──
  if (!canSell && !sub.loading) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-12">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-6">
            <Crown className="w-20 h-20 text-amber-400 drop-shadow-lg" />
          </div>
          <h1 className="text-3xl font-bold mb-3">Upgrade to Sell on the Bazaar</h1>
          <p className="text-muted-foreground text-lg max-w-md mx-auto">
            Free accounts can browse the Bazaar. Upgrade to Pro or higher to sell your tools, agents, and code.
          </p>
        </div>
        <div className="space-y-4">
          <div className="p-4 rounded-lg border border-amber-600/30 bg-amber-950/10">
            <div className="flex items-center gap-3 mb-3">
              <Crown className="w-5 h-5 text-amber-400" />
              <span className="font-semibold text-amber-400">Pro Plan — $29/month</span>
            </div>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> List unlimited items on the Bazaar</li>
              <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> Keep 92% of every sale (8% platform fee)</li>
              <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> Seller dashboard with analytics</li>
              <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> Buy tools, agents, and code from other sellers</li>
              <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> 50,000 credits/month + Titan Builder</li>
            </ul>
          </div>
          <Button
            className="w-full bg-amber-600 hover:bg-amber-700 text-white text-lg py-6"
            onClick={() => window.location.href = "/pricing"}
          >
            <Crown className="w-5 h-5 mr-2" /> Upgrade to Pro
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Already subscribed? <a href="/settings" className="text-amber-400 hover:underline">Check your account settings</a>
          </p>
        </div>
      </div>
    );
  }

  if (sellerLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
      </div>
    );
  }

  // ── NOT A SELLER: Show registration gate ──
  if (!isActiveSeller) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-12">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-6">
            <img loading="eager" src={BAZAAR_LOGO_128} alt="Tech Bazaar" className="w-28 h-28 object-contain drop-shadow-lg" />
          </div>
          <h1 className="text-3xl font-bold mb-3">Open Your Tech Bazaar Stall</h1>
          <p className="text-muted-foreground text-lg max-w-md mx-auto">
            Sell your code, AI agents, modules, blueprints, and more to the Titan community.
          </p>
        </div>

        <Card className="border-amber-500/20 bg-gradient-to-br from-amber-500/5 to-transparent mb-6">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">Seller Registration</h2>
              <Badge className="bg-amber-600 text-white text-lg px-4 py-1">$12/year</Badge>
            </div>
            <div className="space-y-3 text-sm text-muted-foreground mb-6">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                <span>List unlimited items on the Bazaar marketplace</span>
              </div>
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                <span>Keep <strong className="text-white">92%</strong> of every sale (only 8% platform fee)</span>
              </div>
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                <span>Seller dashboard with analytics and earnings tracking</span>
              </div>
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                <span>Multiple payout methods: Bank (BSB/Account), PayPal, Stripe Connect</span>
              </div>
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                <span>Verified seller badge available (builds trust)</span>
              </div>
            </div>

            {/* Anti-resale notice */}
            <div className="p-3 rounded-lg border border-amber-600/30 bg-amber-950/10 text-xs text-muted-foreground mb-6">
              <Shield className="w-3.5 h-3.5 inline mr-1 text-amber-400" />
              <strong className="text-amber-400">Original work only:</strong> Only original creations may be listed. Re-selling purchased marketplace items is strictly prohibited and automatically detected.
            </div>

            {!showSellerSignup ? (
              <Button className="w-full bg-amber-600 hover:bg-amber-700 text-lg py-6" onClick={() => setShowSellerSignup(true)}>
                <Store className="w-5 h-5 mr-2" /> Become a Seller
              </Button>
            ) : (
              <div className="space-y-4 border-t border-border/30 pt-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Display Name *</label>
                  <Input value={sellerName} onChange={(e) => setSellerName(e.target.value)} placeholder="Your seller name" />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Bio</label>
                  <Textarea value={sellerBio} onChange={(e) => setSellerBio(e.target.value)} placeholder="Tell buyers about yourself..." rows={3} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    className="bg-amber-600 hover:bg-amber-700"
                    onClick={() => purchaseSellerSub.mutate({ displayName: sellerName || "Seller", bio: sellerBio || undefined })}
                    disabled={purchaseSellerSub.isPending}
                  >
                    {purchaseSellerSub.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CreditCard className="w-4 h-4 mr-2" />}
                    Pay $12/year (Stripe)
                  </Button>
                  <Button
                    variant="outline"
                    className="border-amber-600/50 text-amber-400"
                    onClick={() => becomeSellerCredits.mutate({ displayName: sellerName || "Seller", bio: sellerBio || undefined })}
                    disabled={becomeSellerCredits.isPending || !sellerName}
                  >
                    {becomeSellerCredits.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Coins className="w-4 h-4 mr-2" />}
                    Pay with Credits
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── ACTIVE SELLER: Show listings ──
  return (
    <div className="max-w-5xl mx-auto px-6 py-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <ShoppingBag className="w-6 h-6 text-amber-400" />
          <h1 className="text-2xl font-bold">My Listings</h1>
          <Badge variant="outline">{(myListings as any[]).length} items</Badge>
          {sellerExpiry && (
            <Badge className="bg-emerald-600/20 text-emerald-400 text-xs">
              Seller until {new Date(sellerExpiry).toLocaleDateString()}
            </Badge>
          )}
        </div>
        <Button className="bg-amber-600 hover:bg-amber-700" onClick={() => setShowCreateDialog(true)}>
          <Plus className="w-4 h-4 mr-2" /> Create Listing
        </Button>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
        </div>
      )}

      {!isLoading && (myListings as any[]).length === 0 && (
        <div className="text-center py-16">
          <ShoppingBag className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
          <p className="text-muted-foreground mb-2">You haven't listed anything yet.</p>
          <Button className="bg-amber-600 hover:bg-amber-700 mt-2" onClick={() => setShowCreateDialog(true)}>
            <Plus className="w-4 h-4 mr-2" /> Create Your First Listing
          </Button>
        </div>
      )}

      <div className="space-y-3">
        {(myListings as any[]).map((listing) => (
          <Card key={listing.id} className="border-border/30 bg-card/50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 flex-1 min-w-0 cursor-pointer" onClick={() => onSelectListing(listing.id)}>
                  <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center flex-shrink-0">
                    {(() => { const I = CATEGORY_ICONS[listing.category] || Package2; return <I className="w-6 h-6 text-muted-foreground/20" />; })()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm truncate">{listing.title}</h3>
                    <div className="flex items-center gap-2 mt-1 text-xs">
                      <Badge className={`${STATUS_COLORS[listing.status] || "bg-slate-600"} text-white text-[10px]`}>{listing.status}</Badge>
                      <Badge className={`${STATUS_COLORS[listing.reviewStatus] || "bg-slate-600"} text-white text-[10px]`}>{listing.reviewStatus}</Badge>
                      <RiskBadge risk={listing.riskCategory} />
                      <span className="text-muted-foreground">{listing.totalSales} sales</span>
                      <span className="text-amber-400 font-mono">{listing.uid}</span>
                      {listing.fileUrl
                        ? <Badge className="bg-emerald-600/20 text-emerald-400 text-[10px]">File uploaded</Badge>
                        : <Badge className="bg-red-600/20 text-red-400 text-[10px]">No file</Badge>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 ml-4">
                  <div className="text-right">
                    <div className="text-sm font-bold text-amber-400">{listing.priceCredits.toLocaleString()}</div>
                    <div className="text-[10px] text-muted-foreground">credits</div>
                  </div>
                  <div className="flex gap-1">
                    {listing.status === "draft" && listing.reviewStatus === "approved" && (
                      <Button size="sm" variant="outline" className="text-emerald-400 border-emerald-600/50 text-xs"
                        onClick={() => updateMutation.mutate({ id: listing.id, status: "active" })}>
                        Activate
                      </Button>
                    )}
                    {listing.status === "active" && (
                      <Button size="sm" variant="outline" className="text-amber-400 border-amber-600/50 text-xs"
                        onClick={() => updateMutation.mutate({ id: listing.id, status: "paused" })}>
                        Pause
                      </Button>
                    )}
                    {listing.status === "paused" && (
                      <Button size="sm" variant="outline" className="text-emerald-400 border-emerald-600/50 text-xs"
                        onClick={() => updateMutation.mutate({ id: listing.id, status: "active" })}>
                        Resume
                      </Button>
                    )}
                    <Button size="sm" variant="outline" className="text-blue-400 border-blue-600/50 text-xs"
                      disabled={uploading === listing.id}
                      onClick={() => handleFileUpload(listing.id)}>
                      {uploading === listing.id
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <Upload className="w-3.5 h-3.5" />}
                    </Button>
                    <Button size="sm" variant="outline" className="text-purple-400 border-purple-600/50 text-xs"
                      title="Boost listing for 7 days (200 credits)"
                      onClick={() => { if (confirm("Boost this listing for 7 days? Costs 200 credits.")) boostMutation.mutate({ listingId: listing.id }); }}
                      disabled={boostMutation.isPending}>
                      <Zap className="w-3.5 h-3.5" />
                    </Button>
                    <Button size="sm" variant="outline" className="text-amber-400 border-amber-600/50 text-xs"
                      title="Feature listing for 30 days (500 credits)"
                      onClick={() => { if (confirm("Feature this listing for 30 days? Costs 500 credits.")) featureMutation.mutate({ listingId: listing.id }); }}
                      disabled={featureMutation.isPending}>
                      <Crown className="w-3.5 h-3.5" />
                    </Button>
                    <Button size="sm" variant="outline" className="text-red-400 border-red-600/50 text-xs"
                      onClick={() => { if (confirm("Delete this listing?")) deleteMutation.mutate({ id: listing.id }); }}>
                      <XCircle className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Create Listing Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Listing</DialogTitle>
            <DialogDescription>
              List an item on the Grand Bazaar. All items undergo AI risk review before going live.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Anti-resale notice */}
            <div className="p-3 rounded-lg border border-amber-600/30 bg-amber-950/10 text-xs text-muted-foreground">
              <Shield className="w-3.5 h-3.5 inline mr-1 text-amber-400" />
              <strong className="text-amber-400">Original work only:</strong> You may only list items you have created yourself. Re-selling purchased items is prohibited and automatically detected via file hash verification.
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Title *</label>
              <Input value={newListing.title} onChange={(e) => setNewListing({ ...newListing, title: e.target.value })} placeholder="e.g. AI Vulnerability Scanner Agent" />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Short Description *</label>
              <Textarea value={newListing.description} onChange={(e) => setNewListing({ ...newListing, description: e.target.value })} placeholder="Brief description of what this item does..." rows={3} />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-sm font-medium">Full Description (Markdown)</label>
                <Button size="sm" variant="outline" className="text-xs text-purple-400 border-purple-600/50 h-6 px-2"
                  onClick={() => generateDescMutation.mutate({
                    title: newListing.title,
                    category: newListing.category,
                    tags: newListing.tags ? newListing.tags.split(",").map((t: string) => t.trim()) : [],
                    keyFeatures: newListing.description,
                  })}
                  disabled={generateDescMutation.isPending || !newListing.title}>
                  {generateDescMutation.isPending ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Sparkles className="w-3 h-3 mr-1" />}
                  AI Generate
                </Button>
              </div>
              <Textarea value={newListing.longDescription} onChange={(e) => setNewListing({ ...newListing, longDescription: e.target.value })} placeholder="Detailed description with features, installation steps, etc..." rows={6} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Category *</label>
                <select value={newListing.category} onChange={(e) => setNewListing({ ...newListing, category: e.target.value as any })}
                  className="w-full text-sm bg-card border border-border/50 rounded-md px-3 py-2 text-foreground">
                  <option value="agents">AI Agents</option>
                  <option value="modules">Modules</option>
                  <option value="blueprints">Blueprints</option>
                  <option value="artifacts">Artifacts</option>
                  <option value="exploits">Exploits</option>
                  <option value="templates">Templates</option>
                  <option value="datasets">Datasets</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Price (Credits) *</label>
                <Input type="number" min={0} value={newListing.priceCredits} onChange={(e) => setNewListing({ ...newListing, priceCredits: parseInt(e.target.value) || 0 })} />
                {priceSuggestion && (priceSuggestion as any).suggested && (
                  <p className="text-xs text-muted-foreground mt-1">
                    <Sparkles className="w-3 h-3 inline mr-1 text-purple-400" />
                    AI suggests: <button className="text-amber-400 hover:underline" onClick={() => setNewListing(prev => ({ ...prev, priceCredits: (priceSuggestion as any).suggested }))}>{(priceSuggestion as any).suggested} credits</button>
                    {(priceSuggestion as any).range && <span className="text-muted-foreground/60"> (range: {(priceSuggestion as any).range.min}–{(priceSuggestion as any).range.max})</span>}
                  </p>
                )}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Language</label>
                <Input value={newListing.language} onChange={(e) => setNewListing({ ...newListing, language: e.target.value })} placeholder="TypeScript" />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">License</label>
                <Input value={newListing.license} onChange={(e) => setNewListing({ ...newListing, license: e.target.value })} placeholder="MIT" />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Version</label>
                <Input value={newListing.version} onChange={(e) => setNewListing({ ...newListing, version: e.target.value })} placeholder="1.0.0" />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Tags (comma-separated)</label>
              <Input value={newListing.tags} onChange={(e) => setNewListing({ ...newListing, tags: e.target.value })} placeholder="security, AI, automation" />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button
              className="bg-amber-600 hover:bg-amber-700"
              onClick={() => {
                const tags = newListing.tags ? JSON.stringify(newListing.tags.split(",").map(t => t.trim()).filter(Boolean)) : undefined;
                createMutation.mutate({
                  ...newListing,
                  tags,
                  longDescription: newListing.longDescription || undefined,
                  language: newListing.language || undefined,
                  license: newListing.license || undefined,
                  version: newListing.version || undefined,
                });
              }}
              disabled={createMutation.isPending || !newListing.title || !newListing.description}
            >
              {createMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
              Create Listing
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// SELLER DASHBOARD VIEW — Sales analytics + Payout Methods
// ═══════════════════════════════════════════════════════════════════

function SellerDashboardView() {
  const { data: profile, refetch: refetchProfile } = trpc.marketplace.mySellerProfile.useQuery();
  const { data: sales = [], isLoading: salesLoading } = trpc.marketplace.mySales.useQuery();
  const { data: myListings = [] } = trpc.marketplace.myListings.useQuery();
  const { data: analytics } = trpc.marketplaceIntelligence.getMyAnalytics.useQuery();
  const { data: leaderboard = [] } = trpc.marketplaceIntelligence.getLeaderboard.useQuery({ limit: 10 });
  const [dashTab, setDashTab] = useState("overview");
  const [editingProfile, setEditingProfile] = useState(false);
  const [editName, setEditName] = useState("");
  const [editBio, setEditBio] = useState("");

  const totalRevenue = (sales as any[]).reduce((sum, s) => sum + Math.floor(s.priceCredits * 0.92), 0);
  const thisMonthSales = (sales as any[]).filter(s => {
    const d = new Date(s.createdAt);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });

  const verifySellerMutation = trpc.marketplace.verifySeller.useMutation({
    onSuccess: () => { toast.success("Seller verified! Permanent badge added. (1000 credits)"); refetchProfile(); },
    onError: (err) => toast.error(err.message),
  });
  const renewSellerMutation = trpc.marketplace.renewSeller.useMutation({
    onSuccess: () => { toast.success("Seller subscription renewed for another year!"); refetchProfile(); },
    onError: (err) => toast.error(err.message),
  });
  const updateProfileMutation = trpc.marketplace.updateSellerProfile.useMutation({
    onSuccess: () => { toast.success("Profile updated!"); setEditingProfile(false); refetchProfile(); },
    onError: (err) => toast.error(err.message),
  });

  return (
    <div className="max-w-5xl mx-auto px-6 py-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <LayoutDashboard className="w-6 h-6 text-amber-400" />
          <h1 className="text-2xl font-bold">Seller Dashboard</h1>
        </div>
        <div className="flex gap-2">
          {profile?.profile && !profile.profile.verified && (
            <Button size="sm" variant="outline" className="text-blue-400 border-blue-600/50 text-xs"
              onClick={() => { if (confirm("Get verified seller badge? Costs 1000 credits.")) verifySellerMutation.mutate(); }}
              disabled={verifySellerMutation.isPending}>
              <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Get Verified
            </Button>
          )}
          <Button size="sm" variant="outline" className="text-amber-400 border-amber-600/50 text-xs"
            onClick={() => { if (confirm("Renew seller subscription for 1 year?")) renewSellerMutation.mutate(); }}
            disabled={renewSellerMutation.isPending}>
            <Crown className="w-3.5 h-3.5 mr-1" /> Renew
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card className="border-border/30 bg-card/50">
          <CardContent className="p-4 text-center">
            <DollarSign className="w-6 h-6 text-emerald-400 mx-auto mb-1" />
            <div className="text-2xl font-bold text-emerald-400">{totalRevenue.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">Total Revenue (credits)</div>
          </CardContent>
        </Card>
        <Card className="border-border/30 bg-card/50">
          <CardContent className="p-4 text-center">
            <TrendingUp className="w-6 h-6 text-blue-400 mx-auto mb-1" />
            <div className="text-2xl font-bold text-blue-400">{(sales as any[]).length}</div>
            <div className="text-xs text-muted-foreground">Total Sales</div>
          </CardContent>
        </Card>
        <Card className="border-border/30 bg-card/50">
          <CardContent className="p-4 text-center">
            <ShoppingBag className="w-6 h-6 text-amber-400 mx-auto mb-1" />
            <div className="text-2xl font-bold text-amber-400">{(myListings as any[]).length}</div>
            <div className="text-xs text-muted-foreground">Active Listings</div>
          </CardContent>
        </Card>
        <Card className="border-border/30 bg-card/50">
          <CardContent className="p-4 text-center">
            <Star className="w-6 h-6 text-amber-400 mx-auto mb-1" />
            <div className="text-2xl font-bold text-amber-400">
              {profile?.stats?.avgRating ? (profile.stats.avgRating / 100).toFixed(1) : "N/A"}
            </div>
            <div className="text-xs text-muted-foreground">Seller Rating ({profile?.stats?.ratingCount || 0})</div>
          </CardContent>
        </Card>
      </div>

      {/* Dashboard Tabs */}
      <Tabs value={dashTab} onValueChange={setDashTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="leaderboard">Leaderboard</TabsTrigger>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="payouts">Payouts</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <Card className="border-border/30 bg-card/50">
            <CardHeader><CardTitle className="text-lg">Recent Sales</CardTitle></CardHeader>
            <CardContent>
              {salesLoading && <Loader2 className="w-6 h-6 animate-spin text-amber-400 mx-auto" />}
              {!salesLoading && (sales as any[]).length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No sales yet. Create listings to start selling!</p>
              )}
              <div className="space-y-2">
                {(sales as any[]).slice(0, 20).map((sale) => (
                  <div key={sale.id} className="flex items-center justify-between py-2 border-b border-border/20 last:border-0">
                    <div>
                      <div className="text-sm font-medium">{sale.listing?.title || `Listing #${sale.listingId}`}</div>
                      <div className="text-xs text-muted-foreground">{new Date(sale.createdAt).toLocaleDateString()} — {sale.uid}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold text-emerald-400">+{Math.floor(sale.priceCredits * 0.92).toLocaleString()}</div>
                      <div className="text-[10px] text-muted-foreground">credits earned</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics">
          <div className="space-y-4">
            {analytics ? (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card className="border-border/30 bg-card/50"><CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-purple-400">{(analytics as any).conversionRate?.toFixed(1) || 0}%</div>
                    <div className="text-xs text-muted-foreground">Conversion Rate</div>
                  </CardContent></Card>
                  <Card className="border-border/30 bg-card/50"><CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-blue-400">{(analytics as any).totalViews?.toLocaleString() || 0}</div>
                    <div className="text-xs text-muted-foreground">Total Views</div>
                  </CardContent></Card>
                  <Card className="border-border/30 bg-card/50"><CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-amber-400">{(analytics as any).thisMonthRevenue?.toLocaleString() || 0}</div>
                    <div className="text-xs text-muted-foreground">This Month (credits)</div>
                  </CardContent></Card>
                  <Card className="border-border/30 bg-card/50"><CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-emerald-400">{(analytics as any).avgOrderValue?.toLocaleString() || 0}</div>
                    <div className="text-xs text-muted-foreground">Avg Order Value</div>
                  </CardContent></Card>
                </div>
                {(analytics as any).topListings?.length > 0 && (
                  <Card className="border-border/30 bg-card/50">
                    <CardHeader><CardTitle className="text-sm">Top Performing Listings</CardTitle></CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {(analytics as any).topListings.map((l: any, i: number) => (
                          <div key={i} className="flex items-center justify-between py-1.5 border-b border-border/20 last:border-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground w-5">#{i+1}</span>
                              <span className="text-sm font-medium truncate max-w-[200px]">{l.title}</span>
                            </div>
                            <div className="flex items-center gap-4 text-xs">
                              <span className="text-muted-foreground">{l.views} views</span>
                              <span className="text-emerald-400 font-bold">{l.sales} sales</span>
                              <span className="text-amber-400">{l.revenue?.toLocaleString()} cr</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            ) : (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-amber-400" />
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="leaderboard">
          <Card className="border-border/30 bg-card/50">
            <CardHeader><CardTitle className="text-lg">Top Sellers on the Bazaar</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {(leaderboard as any[]).map((seller, i) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b border-border/20 last:border-0">
                    <div className="flex items-center gap-3">
                      <span className={`text-sm font-bold w-6 text-center ${i === 0 ? 'text-amber-400' : i === 1 ? 'text-slate-300' : i === 2 ? 'text-amber-700' : 'text-muted-foreground'}`}>#{i+1}</span>
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white text-sm font-bold">
                        {seller.displayName?.[0] || "?"}
                      </div>
                      <div>
                        <div className="text-sm font-medium flex items-center gap-1">
                          {seller.displayName}
                          {seller.verified && <CheckCircle2 className="w-3 h-3 text-blue-400" />}
                        </div>
                        <div className="text-xs text-muted-foreground">{seller.totalListings} listings</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold text-emerald-400">{seller.totalSales?.toLocaleString()} sales</div>
                      <div className="text-xs text-amber-400">{seller.totalRevenue?.toLocaleString()} credits</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="profile">
          <Card className="border-border/30 bg-card/50">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Seller Profile</CardTitle>
                <Button size="sm" variant="outline" className="text-xs" onClick={() => {
                  setEditName((profile?.profile as any)?.displayName || "");
                  setEditBio((profile?.profile as any)?.bio || "");
                  setEditingProfile(true);
                }}>
                  <Edit className="w-3.5 h-3.5 mr-1" /> Edit
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {editingProfile ? (
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-1 block">Display Name</label>
                    <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Bio</label>
                    <Textarea value={editBio} onChange={(e) => setEditBio(e.target.value)} rows={3} />
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" className="bg-amber-600 hover:bg-amber-700"
                      onClick={() => updateProfileMutation.mutate({ displayName: editName, bio: editBio })}
                      disabled={updateProfileMutation.isPending}>
                      {updateProfileMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
                      Save
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setEditingProfile(false)}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white text-2xl font-bold">
                    {(profile?.profile as any)?.displayName?.[0] || "?"}
                  </div>
                  <div>
                    <h2 className="text-lg font-bold flex items-center gap-2">
                      {(profile?.profile as any)?.displayName}
                      {(profile?.profile as any)?.verified && <span title="Verified Seller"><CheckCircle2 className="w-4 h-4 text-blue-400" /></span>}
                    </h2>
                    <p className="text-sm text-muted-foreground">{(profile?.profile as any)?.bio || "No bio set"}</p>
                    <p className="text-xs text-muted-foreground mt-1">Member since {profile?.profile?.createdAt ? new Date((profile.profile as any).createdAt).toLocaleDateString() : "N/A"}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payouts">
          <PayoutMethodsManager />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// MAIN MARKETPLACE PAGE — Tab-based Router
// ═══════════════════════════════════════════════════════════════════

export default function MarketplacePage() {
  const [location, navigate] = useLocation();
  const searchString = useSearch();
  const [selectedListingId, setSelectedListingId] = useState<number | null>(null);

  // Handle Stripe checkout success/cancel URL params
  useEffect(() => {
    const params = new URLSearchParams(searchString);
    if (params.get("purchase_success") === "true") {
      const listingUid = params.get("listing") || "";
      toast.success(`Purchase complete! ${listingUid ? `Item ${listingUid} has` : "Your item has"} been added to your inventory.`, { duration: 6000 });
      navigate("/marketplace/inventory", { replace: true });
    } else if (params.get("purchase_canceled") === "true") {
      toast.info("Checkout was canceled. No charges were made.");
      navigate("/marketplace", { replace: true });
    } else if (params.get("seller_success") === "true") {
      toast.success("Welcome to the Bazaar! Your seller stall is now active.", { duration: 6000 });
      navigate("/marketplace/sell", { replace: true });
    } else if (params.get("seller_canceled") === "true") {
      toast.info("Seller registration was canceled. No charges were made.");
      navigate("/marketplace", { replace: true });
    }
  }, [searchString, navigate]);

  // Determine active tab from URL
  const subPath = location.replace("/marketplace", "").replace(/^\//, "");
  const getActiveTab = () => {
    if (subPath === "inventory") return "purchases";
    if (subPath === "sell") return "listings";
    if (subPath === "seller") return "dashboard";
    return "browse";
  };

  const [activeTab, setActiveTab] = useState(getActiveTab());

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setSelectedListingId(null);
    // Update URL
    if (tab === "browse") navigate("/marketplace");
    else if (tab === "purchases") navigate("/marketplace/inventory");
    else if (tab === "listings") navigate("/marketplace/sell");
    else if (tab === "dashboard") navigate("/marketplace/seller");
  };

  const handleSelectListing = (id: number) => {
    setSelectedListingId(id);
  };

  const handleBack = () => {
    setSelectedListingId(null);
  };

  const handleListItem = () => {
    setActiveTab("listings");
    setSelectedListingId(null);
    navigate("/marketplace/sell");
  };

  // If a listing is selected, show detail view with nav
  if (selectedListingId) {
    return (
      <>
        <MarketplaceNav activeTab={activeTab} onTabChange={handleTabChange} />
        <DetailView listingId={selectedListingId} onBack={handleBack} />
      </>
    );
  }

  return (
    <>
      <MarketplaceNav activeTab={activeTab} onTabChange={handleTabChange} />
      {activeTab === "browse" && <BrowseView onSelectListing={handleSelectListing} onListItem={handleListItem} />}
      {activeTab === "purchases" && <InventoryView onSelectListing={handleSelectListing} />}
      {activeTab === "listings" && <SellView onSelectListing={handleSelectListing} />}
      {activeTab === "dashboard" && <SellerDashboardView />}
    </>
  );
}
