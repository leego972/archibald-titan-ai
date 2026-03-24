/**
 * ═══════════════════════════════════════════════════════════════════════════
 * MARKETPLACE INTELLIGENCE ROUTER
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { z } from "zod";
import { router, protectedProcedure, publicProcedure } from "./_core/trpc";
import {
  getSimilarListings,
  getBuyersAlsoBought,
  getPersonalizedRecommendations,
  getTrendingListings,
  getSellerLeaderboard,
  getSellerAnalytics,
  getWishlist,
  addToWishlist,
  removeFromWishlist,
  getDisputes,
  openDispute,
  advancedSearch,
  generateListingDescription,
  suggestPrice,
} from "./marketplace-intelligence";

export const marketplaceIntelligenceRouter = router({

  // ─── Recommendations ───────────────────────────────────────────────────────

  getSimilarListings: publicProcedure
    .input(z.object({ listingId: z.number(), limit: z.number().optional() }))
    .query(async ({ input }) => {
      return getSimilarListings(input.listingId, input.limit);
    }),

  getBuyersAlsoBought: publicProcedure
    .input(z.object({ listingId: z.number(), limit: z.number().optional() }))
    .query(async ({ input }) => {
      return getBuyersAlsoBought(input.listingId, input.limit);
    }),

  getPersonalizedRecommendations: protectedProcedure
    .input(z.object({ limit: z.number().optional() }))
    .query(async ({ ctx, input }) => {
      if (!ctx.user?.id) return [];
      return getPersonalizedRecommendations(ctx.user.id, input.limit);
    }),

  // ─── Trending ──────────────────────────────────────────────────────────────

  getTrending: publicProcedure
    .input(z.object({ category: z.string().optional(), limit: z.number().optional() }))
    .query(async ({ input }) => {
      return getTrendingListings(input.category, input.limit);
    }),

  // ─── Leaderboard ───────────────────────────────────────────────────────────

  getLeaderboard: publicProcedure
    .input(z.object({ limit: z.number().optional() }))
    .query(async ({ input }) => {
      return getSellerLeaderboard(input.limit);
    }),

  // ─── Seller Analytics ──────────────────────────────────────────────────────

  getMyAnalytics: protectedProcedure
    .query(async ({ ctx }) => {
      if (!ctx.user?.id) return null;
      return getSellerAnalytics(ctx.user.id);
    }),

  // ─── Wishlist ──────────────────────────────────────────────────────────────

  getWishlist: protectedProcedure
    .query(async ({ ctx }) => {
      if (!ctx.user?.id) return [];
      return getWishlist(ctx.user.id);
    }),

  addToWishlist: protectedProcedure
    .input(z.object({ listingId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user?.id) return { success: false };
      const ok = await addToWishlist(ctx.user.id, input.listingId);
      return { success: ok };
    }),

  removeFromWishlist: protectedProcedure
    .input(z.object({ listingId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user?.id) return { success: false };
      const ok = await removeFromWishlist(ctx.user.id, input.listingId);
      return { success: ok };
    }),

  // ─── Disputes ──────────────────────────────────────────────────────────────

  getMyDisputes: protectedProcedure
    .input(z.object({ role: z.enum(["buyer", "seller"]) }))
    .query(async ({ ctx, input }) => {
      if (!ctx.user?.id) return [];
      return getDisputes(ctx.user.id, input.role);
    }),

  openDispute: protectedProcedure
    .input(z.object({
      purchaseId: z.number(),
      reason: z.enum(["not_as_described", "not_delivered", "defective", "unauthorized", "other"]),
      description: z.string().min(20).max(1000),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user?.id) return { success: false, error: "Not authenticated" };
      return openDispute(ctx.user.id, input.purchaseId, input.reason, input.description);
    }),

  // ─── Advanced Search ───────────────────────────────────────────────────────

  advancedSearch: publicProcedure
    .input(z.object({
      query: z.string().optional(),
      category: z.string().optional(),
      minPrice: z.number().optional(),
      maxPrice: z.number().optional(),
      minRating: z.number().optional(),
      language: z.string().optional(),
      license: z.string().optional(),
      riskCategory: z.string().optional(),
      sortBy: z.enum(["relevance", "price_asc", "price_desc", "rating", "newest", "bestseller"]).optional(),
      page: z.number().optional(),
      limit: z.number().optional(),
    }))
    .query(async ({ input }) => {
      return advancedSearch(input);
    }),

  // ─── AI Tools ──────────────────────────────────────────────────────────────

  generateDescription: protectedProcedure
    .input(z.object({
      title: z.string(),
      category: z.string(),
      tags: z.array(z.string()),
      language: z.string().optional(),
      keyFeatures: z.string(),
    }))
    .mutation(async ({ input }) => {
      const description = await generateListingDescription(input);
      return { description };
    }),

  suggestPrice: protectedProcedure
    .input(z.object({
      category: z.string(),
      language: z.string().optional(),
      tags: z.array(z.string()),
    }))
    .query(async ({ input }) => {
      return suggestPrice(input);
    }),

});
