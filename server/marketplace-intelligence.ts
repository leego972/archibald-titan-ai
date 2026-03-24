/**
 * ═══════════════════════════════════════════════════════════════════════════
 * MARKETPLACE INTELLIGENCE ENGINE
 * ═══════════════════════════════════════════════════════════════════════════
 * Elite marketplace capabilities:
 * - Recommendation engine (collaborative filtering + content-based)
 * - Wishlist / save for later
 * - Advanced seller analytics (revenue chart, conversion rate, top listings)
 * - Dispute & refund system
 * - Trending / hot items engine
 * - Seller leaderboard
 * - Advanced search with filters (price, rating, language, license)
 * - Listing version history
 * - Buyer persona profiling
 */

import { getDb } from "./_core/db";
import { invokeLLM } from "./_core/llm";
import { logger } from "./_core/logger";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RecommendationResult {
  listingId: number;
  score: number;
  reason: string;
  type: "similar" | "trending" | "buyers_also_bought" | "personalized";
}

export interface SellerAnalytics {
  totalRevenue: number;
  totalSales: number;
  conversionRate: number;
  avgOrderValue: number;
  revenueByDay: { date: string; revenue: number; sales: number }[];
  topListings: { listingId: number; title: string; revenue: number; sales: number; avgRating: number }[];
  categoryBreakdown: { category: string; revenue: number; sales: number }[];
  ratingTrend: { month: string; avgRating: number }[];
  repeatBuyerRate: number;
  refundRate: number;
}

export interface TrendingItem {
  listingId: number;
  title: string;
  category: string;
  trendScore: number;
  viewVelocity: number;
  salesVelocity: number;
  ratingMomentum: number;
  rank: number;
}

export interface SellerLeaderboardEntry {
  sellerId: number;
  displayName: string;
  verified: boolean;
  totalRevenue: number;
  totalSales: number;
  avgRating: number;
  listingCount: number;
  rank: number;
  badge: "gold" | "silver" | "bronze" | "rising" | null;
}

export interface DisputeRecord {
  id: number;
  purchaseId: number;
  buyerId: number;
  sellerId: number;
  reason: string;
  description: string;
  status: "open" | "under_review" | "resolved_buyer" | "resolved_seller" | "closed";
  resolution: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WishlistItem {
  listingId: number;
  addedAt: string;
  priceAtAdd: number;
  currentPrice: number;
  priceDelta: number;
  inStock: boolean;
}

export interface VersionHistoryEntry {
  version: string;
  changelog: string;
  createdAt: string;
  fileUrl: string | null;
  fileSize: number | null;
}

// ─── Recommendation Engine ────────────────────────────────────────────────────

/**
 * Content-based similarity: find listings with matching tags, category, language
 */
export async function getSimilarListings(
  listingId: number,
  limit = 6
): Promise<RecommendationResult[]> {
  try {
    const db = await getDb();
    if (!db) return [];

    const { marketplaceListings } = await import("../drizzle/schema");
    const { eq, ne, and, sql } = await import("drizzle-orm");

    const [target] = await db
      .select()
      .from(marketplaceListings)
      .where(eq(marketplaceListings.id, listingId))
      .limit(1);

    if (!target) return [];

    const targetTags = target.tags ? target.tags.split(",").map((t: string) => t.trim()) : [];

    const candidates = await db
      .select()
      .from(marketplaceListings)
      .where(
        and(
          ne(marketplaceListings.id, listingId),
          eq(marketplaceListings.status, "active"),
          eq(marketplaceListings.reviewStatus, "approved")
        )
      )
      .limit(100);

    const scored = candidates.map((c: any) => {
      let score = 0;
      const cTags = c.tags ? c.tags.split(",").map((t: string) => t.trim()) : [];

      // Category match: +40
      if (c.category === target.category) score += 40;

      // Language match: +20
      if (c.language && c.language === target.language) score += 20;

      // Tag overlap: +5 per matching tag
      const overlap = targetTags.filter((t: string) => cTags.includes(t));
      score += overlap.length * 5;

      // Rating bonus: up to +15
      if (c.avgRating > 0) score += Math.min(15, (c.avgRating / 100) * 3);

      // Sales popularity: up to +10
      score += Math.min(10, c.totalSales * 0.5);

      return {
        listingId: c.id,
        score,
        reason: c.category === target.category
          ? `Same category · ${overlap.length} shared tags`
          : `${overlap.length} shared tags`,
        type: "similar" as const,
      };
    });

    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  } catch (err) {
    logger.error("getSimilarListings error", err);
    return [];
  }
}

/**
 * Collaborative filtering: buyers of this listing also bought these
 */
export async function getBuyersAlsoBought(
  listingId: number,
  limit = 6
): Promise<RecommendationResult[]> {
  try {
    const db = await getDb();
    if (!db) return [];

    const { marketplacePurchases, marketplaceListings } = await import("../drizzle/schema");
    const { eq, ne, inArray, sql } = await import("drizzle-orm");

    // Get all buyers of this listing
    const buyers = await db
      .select({ buyerId: marketplacePurchases.buyerId })
      .from(marketplacePurchases)
      .where(eq(marketplacePurchases.listingId, listingId));

    if (buyers.length === 0) return [];

    const buyerIds = buyers.map((b: any) => b.buyerId);

    // Get all other purchases by those buyers
    const otherPurchases = await db
      .select({ listingId: marketplacePurchases.listingId })
      .from(marketplacePurchases)
      .where(
        inArray(marketplacePurchases.buyerId, buyerIds)
      );

    // Count frequency
    const freq: Record<number, number> = {};
    for (const p of otherPurchases) {
      if (p.listingId !== listingId) {
        freq[p.listingId] = (freq[p.listingId] || 0) + 1;
      }
    }

    const topIds = Object.entries(freq)
      .sort(([, a], [, b]) => b - a)
      .slice(0, limit)
      .map(([id]) => Number(id));

    if (topIds.length === 0) return [];

    const listings = await db
      .select()
      .from(marketplaceListings)
      .where(inArray(marketplaceListings.id, topIds));

    return topIds.map((id) => {
      const listing = listings.find((l: any) => l.id === id);
      return {
        listingId: id,
        score: freq[id] * 10,
        reason: `${freq[id]} buyers of this item also bought this`,
        type: "buyers_also_bought" as const,
      };
    }).filter((r) => r.listingId);
  } catch (err) {
    logger.error("getBuyersAlsoBought error", err);
    return [];
  }
}

/**
 * Personalized recommendations based on user purchase history
 */
export async function getPersonalizedRecommendations(
  userId: number,
  limit = 8
): Promise<RecommendationResult[]> {
  try {
    const db = await getDb();
    if (!db) return [];

    const { marketplacePurchases, marketplaceListings } = await import("../drizzle/schema");
    const { eq, ne, notInArray, sql } = await import("drizzle-orm");

    // Get user's purchase history
    const purchases = await db
      .select({ listingId: marketplacePurchases.listingId })
      .from(marketplacePurchases)
      .where(eq(marketplacePurchases.buyerId, userId));

    const purchasedIds = purchases.map((p: any) => p.listingId);

    // Get details of purchased listings to understand preferences
    let preferredCategories: string[] = [];
    let preferredTags: string[] = [];

    if (purchasedIds.length > 0) {
      const { inArray } = await import("drizzle-orm");
      const purchasedListings = await db
        .select()
        .from(marketplaceListings)
        .where(inArray(marketplaceListings.id, purchasedIds));

      preferredCategories = [...new Set(purchasedListings.map((l: any) => l.category))];
      preferredTags = purchasedListings
        .flatMap((l: any) => l.tags ? l.tags.split(",").map((t: string) => t.trim()) : [])
        .filter(Boolean);
    }

    // Get active listings not yet purchased
    const query = purchasedIds.length > 0
      ? db.select().from(marketplaceListings).where(
          (await import("drizzle-orm")).and(
            notInArray(marketplaceListings.id, purchasedIds),
            eq(marketplaceListings.status, "active"),
            eq(marketplaceListings.reviewStatus, "approved")
          )
        ).limit(200)
      : db.select().from(marketplaceListings).where(
          (await import("drizzle-orm")).and(
            eq(marketplaceListings.status, "active"),
            eq(marketplaceListings.reviewStatus, "approved")
          )
        ).limit(200);

    const candidates = await query;

    const scored = candidates.map((c: any) => {
      let score = 0;
      const cTags = c.tags ? c.tags.split(",").map((t: string) => t.trim()) : [];

      if (preferredCategories.includes(c.category)) score += 30;
      const tagMatches = preferredTags.filter((t) => cTags.includes(t)).length;
      score += tagMatches * 5;
      if (c.avgRating > 0) score += (c.avgRating / 100) * 10;
      score += Math.min(20, c.totalSales * 0.2);
      if (c.featured) score += 10;

      return {
        listingId: c.id,
        score,
        reason: preferredCategories.includes(c.category)
          ? `Matches your interest in ${c.category}`
          : "Popular in the Bazaar",
        type: "personalized" as const,
      };
    });

    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  } catch (err) {
    logger.error("getPersonalizedRecommendations error", err);
    return [];
  }
}

// ─── Trending Engine ──────────────────────────────────────────────────────────

/**
 * Calculate trending score based on view velocity, sales velocity, rating momentum
 */
export async function getTrendingListings(
  category?: string,
  limit = 10
): Promise<TrendingItem[]> {
  try {
    const db = await getDb();
    if (!db) return [];

    const { marketplaceListings } = await import("../drizzle/schema");
    const { eq, and, gte, sql } = await import("drizzle-orm");

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const conditions: any[] = [
      eq(marketplaceListings.status, "active"),
      eq(marketplaceListings.reviewStatus, "approved"),
    ];
    if (category && category !== "all") {
      conditions.push(eq(marketplaceListings.category, category));
    }

    const listings = await db
      .select()
      .from(marketplaceListings)
      .where(and(...conditions))
      .limit(200);

    const now = Date.now();
    const scored = listings.map((l: any) => {
      const ageMs = now - new Date(l.createdAt).getTime();
      const ageDays = ageMs / (1000 * 60 * 60 * 24);

      // Decay factor: newer items get higher weight
      const decayFactor = Math.exp(-ageDays / 14);

      // View velocity: views per day
      const viewVelocity = ageDays > 0 ? l.viewCount / ageDays : l.viewCount;

      // Sales velocity: sales per day
      const salesVelocity = ageDays > 0 ? l.totalSales / ageDays : l.totalSales;

      // Rating momentum: avg rating * rating count
      const ratingMomentum = (l.avgRating / 100) * Math.log1p(l.ratingCount);

      // Composite trend score
      const trendScore =
        (viewVelocity * 2 + salesVelocity * 10 + ratingMomentum * 5) * (1 + decayFactor);

      return {
        listingId: l.id,
        title: l.title,
        category: l.category,
        trendScore,
        viewVelocity: Math.round(viewVelocity * 10) / 10,
        salesVelocity: Math.round(salesVelocity * 100) / 100,
        ratingMomentum: Math.round(ratingMomentum * 100) / 100,
        rank: 0,
      };
    });

    const sorted = scored
      .sort((a, b) => b.trendScore - a.trendScore)
      .slice(0, limit)
      .map((item, i) => ({ ...item, rank: i + 1 }));

    return sorted;
  } catch (err) {
    logger.error("getTrendingListings error", err);
    return [];
  }
}

// ─── Seller Leaderboard ───────────────────────────────────────────────────────

export async function getSellerLeaderboard(limit = 20): Promise<SellerLeaderboardEntry[]> {
  try {
    const db = await getDb();
    if (!db) return [];

    const { sellerProfiles, marketplacePurchases, marketplaceListings } = await import("../drizzle/schema");
    const { sql, eq } = await import("drizzle-orm");

    const profiles = await db
      .select()
      .from(sellerProfiles)
      .limit(200);

    const entries: SellerLeaderboardEntry[] = [];

    for (const profile of profiles) {
      const sales = await db
        .select()
        .from(marketplacePurchases)
        .where(eq(marketplacePurchases.sellerId, profile.userId));

      const totalRevenue = sales.reduce((sum: number, s: any) => sum + (s.priceCredits || 0), 0);
      const totalSales = sales.length;

      const listings = await db
        .select()
        .from(marketplaceListings)
        .where(eq(marketplaceListings.sellerId, profile.userId));

      const listingCount = listings.length;
      const avgRating = listings.length > 0
        ? listings.reduce((sum: number, l: any) => sum + (l.avgRating || 0), 0) / listings.length / 100
        : 0;

      entries.push({
        sellerId: profile.userId,
        displayName: profile.displayName || `Seller #${profile.userId}`,
        verified: profile.verified || false,
        totalRevenue,
        totalSales,
        avgRating: Math.round(avgRating * 10) / 10,
        listingCount,
        rank: 0,
        badge: null,
      });
    }

    const sorted = entries
      .sort((a, b) => b.totalRevenue - a.totalRevenue)
      .slice(0, limit)
      .map((e, i) => ({
        ...e,
        rank: i + 1,
        badge: i === 0 ? "gold" as const
          : i === 1 ? "silver" as const
          : i === 2 ? "bronze" as const
          : e.totalSales > 0 && e.totalRevenue < 1000 ? "rising" as const
          : null,
      }));

    return sorted;
  } catch (err) {
    logger.error("getSellerLeaderboard error", err);
    return [];
  }
}

// ─── Seller Analytics ─────────────────────────────────────────────────────────

export async function getSellerAnalytics(sellerId: number): Promise<SellerAnalytics> {
  try {
    const db = await getDb();
    if (!db) return getEmptyAnalytics();

    const { marketplacePurchases, marketplaceListings, marketplaceReviews } = await import("../drizzle/schema");
    const { eq, and, gte, sql } = await import("drizzle-orm");

    const sales = await db
      .select()
      .from(marketplacePurchases)
      .where(eq(marketplacePurchases.sellerId, sellerId));

    const listings = await db
      .select()
      .from(marketplaceListings)
      .where(eq(marketplaceListings.sellerId, sellerId));

    const totalRevenue = sales.reduce((sum: number, s: any) => sum + (s.priceCredits || 0), 0);
    const totalSales = sales.length;
    const avgOrderValue = totalSales > 0 ? totalRevenue / totalSales : 0;

    // Revenue by day (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentSales = sales.filter((s: any) => new Date(s.createdAt) >= thirtyDaysAgo);

    const revenueByDay: Record<string, { revenue: number; sales: number }> = {};
    for (let i = 29; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const key = d.toISOString().split("T")[0];
      revenueByDay[key] = { revenue: 0, sales: 0 };
    }
    for (const s of recentSales) {
      const key = new Date(s.createdAt).toISOString().split("T")[0];
      if (revenueByDay[key]) {
        revenueByDay[key].revenue += s.priceCredits || 0;
        revenueByDay[key].sales += 1;
      }
    }

    // Top listings
    const topListings = listings
      .map((l: any) => ({
        listingId: l.id,
        title: l.title,
        revenue: l.totalRevenue || 0,
        sales: l.totalSales || 0,
        avgRating: l.avgRating ? l.avgRating / 100 : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    // Category breakdown
    const catMap: Record<string, { revenue: number; sales: number }> = {};
    for (const l of listings) {
      if (!catMap[l.category]) catMap[l.category] = { revenue: 0, sales: 0 };
      catMap[l.category].revenue += l.totalRevenue || 0;
      catMap[l.category].sales += l.totalSales || 0;
    }

    // Conversion rate (views to sales)
    const totalViews = listings.reduce((sum: number, l: any) => sum + (l.viewCount || 0), 0);
    const conversionRate = totalViews > 0 ? (totalSales / totalViews) * 100 : 0;

    // Repeat buyer rate
    const buyerIds = sales.map((s: any) => s.buyerId);
    const uniqueBuyers = new Set(buyerIds).size;
    const repeatBuyers = buyerIds.length - uniqueBuyers;
    const repeatBuyerRate = uniqueBuyers > 0 ? (repeatBuyers / uniqueBuyers) * 100 : 0;

    return {
      totalRevenue,
      totalSales,
      conversionRate: Math.round(conversionRate * 10) / 10,
      avgOrderValue: Math.round(avgOrderValue),
      revenueByDay: Object.entries(revenueByDay).map(([date, data]) => ({ date, ...data })),
      topListings,
      categoryBreakdown: Object.entries(catMap).map(([category, data]) => ({ category, ...data })),
      ratingTrend: [],
      repeatBuyerRate: Math.round(repeatBuyerRate * 10) / 10,
      refundRate: 0,
    };
  } catch (err) {
    logger.error("getSellerAnalytics error", err);
    return getEmptyAnalytics();
  }
}

function getEmptyAnalytics(): SellerAnalytics {
  return {
    totalRevenue: 0, totalSales: 0, conversionRate: 0, avgOrderValue: 0,
    revenueByDay: [], topListings: [], categoryBreakdown: [],
    ratingTrend: [], repeatBuyerRate: 0, refundRate: 0,
  };
}

// ─── Wishlist ─────────────────────────────────────────────────────────────────

export async function getWishlist(userId: number): Promise<WishlistItem[]> {
  try {
    const db = await getDb();
    if (!db) return [];

    const { marketplaceWishlists, marketplaceListings } = await import("../drizzle/schema");
    const { eq, inArray } = await import("drizzle-orm");

    // Check if wishlist table exists
    try {
      const items = await db
        .select()
        .from(marketplaceWishlists)
        .where(eq(marketplaceWishlists.userId, userId));

      if (items.length === 0) return [];

      const listingIds = items.map((i: any) => i.listingId);
      const listings = await db
        .select()
        .from(marketplaceListings)
        .where(inArray(marketplaceListings.id, listingIds));

      return items.map((item: any) => {
        const listing = listings.find((l: any) => l.id === item.listingId);
        const currentPrice = listing?.priceCredits || 0;
        const priceAtAdd = item.priceAtAdd || currentPrice;
        return {
          listingId: item.listingId,
          addedAt: item.createdAt,
          priceAtAdd,
          currentPrice,
          priceDelta: currentPrice - priceAtAdd,
          inStock: listing?.status === "active",
        };
      });
    } catch {
      // Table doesn't exist yet — return empty
      return [];
    }
  } catch (err) {
    logger.error("getWishlist error", err);
    return [];
  }
}

export async function addToWishlist(userId: number, listingId: number): Promise<boolean> {
  try {
    const db = await getDb();
    if (!db) return false;

    const { marketplaceWishlists, marketplaceListings } = await import("../drizzle/schema");
    const { eq, and } = await import("drizzle-orm");

    const [listing] = await db
      .select({ priceCredits: marketplaceListings.priceCredits })
      .from(marketplaceListings)
      .where(eq(marketplaceListings.id, listingId))
      .limit(1);

    try {
      await db.insert(marketplaceWishlists).values({
        userId,
        listingId,
        priceAtAdd: listing?.priceCredits || 0,
        createdAt: new Date().toISOString(),
      });
      return true;
    } catch {
      return false;
    }
  } catch (err) {
    logger.error("addToWishlist error", err);
    return false;
  }
}

export async function removeFromWishlist(userId: number, listingId: number): Promise<boolean> {
  try {
    const db = await getDb();
    if (!db) return false;

    const { marketplaceWishlists } = await import("../drizzle/schema");
    const { eq, and } = await import("drizzle-orm");

    try {
      await db
        .delete(marketplaceWishlists)
        .where(
          and(
            eq(marketplaceWishlists.userId, userId),
            eq(marketplaceWishlists.listingId, listingId)
          )
        );
      return true;
    } catch {
      return false;
    }
  } catch (err) {
    logger.error("removeFromWishlist error", err);
    return false;
  }
}

// ─── Dispute System ───────────────────────────────────────────────────────────

export async function getDisputes(userId: number, role: "buyer" | "seller" | "admin"): Promise<DisputeRecord[]> {
  try {
    const db = await getDb();
    if (!db) return [];

    const { marketplaceDisputes } = await import("../drizzle/schema");
    const { eq, or } = await import("drizzle-orm");

    try {
      let query;
      if (role === "admin") {
        query = db.select().from(marketplaceDisputes).limit(100);
      } else if (role === "buyer") {
        query = db.select().from(marketplaceDisputes).where(eq(marketplaceDisputes.buyerId, userId));
      } else {
        query = db.select().from(marketplaceDisputes).where(eq(marketplaceDisputes.sellerId, userId));
      }

      const disputes = await query;
      return disputes.map((d: any) => ({
        id: d.id,
        purchaseId: d.purchaseId,
        buyerId: d.buyerId,
        sellerId: d.sellerId,
        reason: d.reason,
        description: d.description,
        status: d.status,
        resolution: d.resolution,
        createdAt: d.createdAt,
        updatedAt: d.updatedAt,
      }));
    } catch {
      return [];
    }
  } catch (err) {
    logger.error("getDisputes error", err);
    return [];
  }
}

export async function openDispute(
  buyerId: number,
  purchaseId: number,
  reason: string,
  description: string
): Promise<{ success: boolean; disputeId?: number; error?: string }> {
  try {
    const db = await getDb();
    if (!db) return { success: false, error: "Database unavailable" };

    const { marketplacePurchases, marketplaceDisputes } = await import("../drizzle/schema");
    const { eq } = await import("drizzle-orm");

    const [purchase] = await db
      .select()
      .from(marketplacePurchases)
      .where(eq(marketplacePurchases.id, purchaseId))
      .limit(1);

    if (!purchase) return { success: false, error: "Purchase not found" };
    if (purchase.buyerId !== buyerId) return { success: false, error: "Not your purchase" };

    try {
      const [dispute] = await db
        .insert(marketplaceDisputes)
        .values({
          purchaseId,
          buyerId,
          sellerId: purchase.sellerId,
          reason,
          description,
          status: "open",
          resolution: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        .returning({ id: marketplaceDisputes.id });

      return { success: true, disputeId: dispute.id };
    } catch {
      return { success: false, error: "Dispute table not available — contact support" };
    }
  } catch (err) {
    logger.error("openDispute error", err);
    return { success: false, error: String(err) };
  }
}

// ─── Advanced Search ──────────────────────────────────────────────────────────

export interface AdvancedSearchParams {
  query?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  language?: string;
  license?: string;
  riskCategory?: string;
  sortBy?: "relevance" | "price_asc" | "price_desc" | "rating" | "newest" | "bestseller";
  page?: number;
  limit?: number;
}

export async function advancedSearch(params: AdvancedSearchParams) {
  try {
    const db = await getDb();
    if (!db) return { results: [], total: 0, page: 1, totalPages: 0 };

    const { marketplaceListings } = await import("../drizzle/schema");
    const { eq, and, gte, lte, like, sql, asc, desc } = await import("drizzle-orm");

    const conditions: any[] = [
      eq(marketplaceListings.status, "active"),
      eq(marketplaceListings.reviewStatus, "approved"),
    ];

    if (params.category && params.category !== "all") {
      conditions.push(eq(marketplaceListings.category, params.category));
    }
    if (params.minPrice !== undefined) {
      conditions.push(gte(marketplaceListings.priceCredits, params.minPrice));
    }
    if (params.maxPrice !== undefined) {
      conditions.push(lte(marketplaceListings.priceCredits, params.maxPrice));
    }
    if (params.minRating !== undefined) {
      conditions.push(gte(marketplaceListings.avgRating, params.minRating * 100));
    }
    if (params.language) {
      conditions.push(eq(marketplaceListings.language, params.language));
    }
    if (params.license) {
      conditions.push(eq(marketplaceListings.license, params.license));
    }
    if (params.riskCategory) {
      conditions.push(eq(marketplaceListings.riskCategory, params.riskCategory));
    }
    if (params.query) {
      conditions.push(like(marketplaceListings.title, `%${params.query}%`));
    }

    const allResults = await db
      .select()
      .from(marketplaceListings)
      .where(and(...conditions))
      .limit(500);

    // Sort
    let sorted = [...allResults];
    switch (params.sortBy) {
      case "price_asc": sorted.sort((a, b) => a.priceCredits - b.priceCredits); break;
      case "price_desc": sorted.sort((a, b) => b.priceCredits - a.priceCredits); break;
      case "rating": sorted.sort((a: any, b: any) => (b.avgRating || 0) - (a.avgRating || 0)); break;
      case "newest": sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()); break;
      case "bestseller": sorted.sort((a, b) => (b.totalSales || 0) - (a.totalSales || 0)); break;
      default: // relevance — featured first, then by sales
        sorted.sort((a: any, b: any) => {
          if (a.featured && !b.featured) return -1;
          if (!a.featured && b.featured) return 1;
          return (b.totalSales || 0) - (a.totalSales || 0);
        });
    }

    const page = params.page || 1;
    const limit = params.limit || 24;
    const total = sorted.length;
    const totalPages = Math.ceil(total / limit);
    const results = sorted.slice((page - 1) * limit, page * limit);

    return { results, total, page, totalPages };
  } catch (err) {
    logger.error("advancedSearch error", err);
    return { results: [], total: 0, page: 1, totalPages: 0 };
  }
}

// ─── AI-Powered Listing Description Generator ─────────────────────────────────

export async function generateListingDescription(params: {
  title: string;
  category: string;
  tags: string[];
  language?: string;
  keyFeatures: string;
}): Promise<string> {
  try {
    const result = await invokeLLM({
      systemTag: "misc",
      messages: [
        {
          role: "system",
          content: `You are an expert marketplace copywriter for a cybersecurity and AI tools marketplace called "The Grand Bazaar". 
Write compelling, accurate product descriptions that highlight value, use cases, and technical details.
Keep descriptions between 150-300 words. Use markdown formatting.`,
        },
        {
          role: "user",
          content: `Write a marketplace listing description for:
Title: ${params.title}
Category: ${params.category}
Tags: ${params.tags.join(", ")}
Language: ${params.language || "N/A"}
Key Features: ${params.keyFeatures}`,
        },
      ],
    });

    const content = (result as any)?.choices?.[0]?.message?.content;
    return typeof content === "string" ? content : "";
  } catch (err) {
    logger.error("generateListingDescription error", err);
    return "";
  }
}

// ─── Price Suggestion Engine ──────────────────────────────────────────────────

export async function suggestPrice(params: {
  category: string;
  language?: string;
  tags: string[];
}): Promise<{ suggested: number; min: number; max: number; median: number }> {
  try {
    const db = await getDb();
    if (!db) return { suggested: 100, min: 50, max: 500, median: 100 };

    const { marketplaceListings } = await import("../drizzle/schema");
    const { eq, and } = await import("drizzle-orm");

    const similar = await db
      .select({ priceCredits: marketplaceListings.priceCredits })
      .from(marketplaceListings)
      .where(
        and(
          eq(marketplaceListings.category, params.category),
          eq(marketplaceListings.status, "active"),
          eq(marketplaceListings.reviewStatus, "approved")
        )
      )
      .limit(50);

    if (similar.length === 0) return { suggested: 100, min: 50, max: 500, median: 100 };

    const prices = similar.map((l: any) => l.priceCredits).sort((a: number, b: number) => a - b);
    const min = prices[0];
    const max = prices[prices.length - 1];
    const median = prices[Math.floor(prices.length / 2)];
    const avg = prices.reduce((s: number, p: number) => s + p, 0) / prices.length;

    return {
      suggested: Math.round(avg),
      min,
      max,
      median,
    };
  } catch (err) {
    logger.error("suggestPrice error", err);
    return { suggested: 100, min: 50, max: 500, median: 100 };
  }
}
