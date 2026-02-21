/**
 * Contextual Affiliate Recommendations Widget — Revenue Maximizer
 * 
 * Shows relevant partner recommendations based on user context.
 * Optimized for maximum click-through rate and conversion.
 * 
 * Variants:
 *   "banner"  — Full-width strip showing ALL recommendations (high visibility)
 *   "sidebar" — Vertical list for dashboard sidebar (persistent visibility)
 *   "inline"  — Compact pill buttons (embedded in content)
 *   "card"    — Rich cards with descriptions (landing page, pricing page)
 */

import { trpc } from "@/lib/trpc";
import { ExternalLink, Sparkles, Star, TrendingUp, Zap } from "lucide-react";
import { useCallback } from "react";

type Props = {
  context: string;
  limit?: number;
  variant?: "inline" | "sidebar" | "banner" | "card";
  className?: string;
};

const verticalIcons: Record<string, typeof Sparkles> = {
  ai_tools: Zap,
  hosting: TrendingUp,
  vpn: Star,
  security: Star,
  saas: TrendingUp,
  dev_tools: Zap,
  crypto: TrendingUp,
  education: Star,
};

const verticalLabels: Record<string, string> = {
  ai_tools: "AI Tool",
  hosting: "Hosting",
  dev_tools: "Dev Tool",
  security: "Security",
  vpn: "VPN",
  crypto: "Crypto",
  saas: "SaaS",
  education: "Learning",
  marketing: "Marketing",
  other: "Partner",
};

const verticalCTA: Record<string, string> = {
  ai_tools: "Try Free",
  hosting: "Get Started",
  dev_tools: "Start Free",
  security: "Protect Now",
  vpn: "Get Protected",
  crypto: "Start Trading",
  saas: "Try Free",
  education: "Start Learning",
  marketing: "Boost Traffic",
  other: "Learn More",
};

export default function AffiliateRecommendations({ context, limit = 3, variant = "inline", className = "" }: Props) {
  const { data: recommendations } = trpc.affiliate.getRecommendations.useQuery(
    { context, limit: variant === "banner" ? Math.max(limit, 3) : limit },
    { staleTime: 60_000 }
  );

  const trackClick = trpc.affiliate.trackClick.useMutation();

  const handleClick = useCallback((partnerId: number, affiliateUrl: string | null) => {
    trackClick.mutate({ partnerId, utmSource: "titan_app", utmMedium: "contextual", utmCampaign: context });
    if (affiliateUrl) {
      window.open(affiliateUrl, "_blank", "noopener,noreferrer");
    }
  }, [context, trackClick]);

  if (!recommendations || recommendations.length === 0) return null;

  // ═══ BANNER: Full-width, shows ALL partners — maximum visibility ═══
  if (variant === "banner") {
    return (
      <div className={`px-4 py-3 bg-gradient-to-r from-purple-900/20 via-indigo-900/15 to-purple-900/20 border border-purple-500/10 rounded-lg ${className}`}>
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-4 h-4 text-purple-400 shrink-0" />
          <span className="text-xs font-medium text-purple-400/80 uppercase tracking-wider">Recommended Tools</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {recommendations.map((rec) => {
            const Icon = verticalIcons[rec.vertical] || Sparkles;
            return (
              <button
                key={rec.id}
                onClick={() => handleClick(rec.id, rec.affiliateUrl)}
                className="inline-flex items-center gap-2 px-3 py-1.5 text-sm rounded-md bg-white/5 hover:bg-purple-500/15 border border-white/5 hover:border-purple-500/30 transition-all group cursor-pointer"
              >
                <Icon className="w-3.5 h-3.5 text-purple-400/60 group-hover:text-purple-400" />
                <span className="text-muted-foreground group-hover:text-purple-300 font-medium">{rec.name}</span>
                <span className="text-[10px] text-muted-foreground/40 group-hover:text-purple-400/60">
                  {verticalLabels[rec.vertical] || "Partner"}
                </span>
                <ExternalLink className="w-3 h-3 text-muted-foreground/30 group-hover:text-purple-400" />
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // ═══ CARD: Rich cards with CTA — for landing/pricing pages ═══
  if (variant === "card") {
    return (
      <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 ${className}`}>
        {recommendations.map((rec) => {
          const Icon = verticalIcons[rec.vertical] || Sparkles;
          const cta = verticalCTA[rec.vertical] || "Learn More";
          return (
            <button
              key={rec.id}
              onClick={() => handleClick(rec.id, rec.affiliateUrl)}
              className="flex flex-col items-start gap-2 p-4 rounded-lg bg-gradient-to-br from-white/5 to-white/2 border border-white/5 hover:border-purple-500/30 hover:from-purple-500/10 hover:to-indigo-500/5 transition-all group cursor-pointer text-left"
            >
              <div className="flex items-center gap-2 w-full">
                <Icon className="w-4 h-4 text-purple-400/60 group-hover:text-purple-400" />
                <span className="font-semibold text-sm text-foreground group-hover:text-purple-300">{rec.name}</span>
                <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400/70">
                  {verticalLabels[rec.vertical] || "Partner"}
                </span>
              </div>
              <div className="flex items-center gap-1 text-xs text-purple-400 group-hover:text-purple-300 font-medium mt-1">
                {cta}
                <ExternalLink className="w-3 h-3" />
              </div>
            </button>
          );
        })}
      </div>
    );
  }

  // ═══ SIDEBAR: Persistent vertical list ═══
  if (variant === "sidebar") {
    return (
      <div className={`space-y-1 ${className}`}>
        <p className="text-xs text-muted-foreground/60 flex items-center gap-1 mb-2 px-3">
          <Sparkles className="w-3 h-3" />
          Recommended Tools
        </p>
        {recommendations.map((rec) => {
          const Icon = verticalIcons[rec.vertical] || Sparkles;
          return (
            <button
              key={rec.id}
              onClick={() => handleClick(rec.id, rec.affiliateUrl)}
              className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm rounded-md hover:bg-purple-500/10 transition-colors group cursor-pointer"
            >
              <Icon className="w-3.5 h-3.5 text-muted-foreground/40 group-hover:text-purple-400 shrink-0" />
              <span className="text-muted-foreground group-hover:text-purple-400 transition-colors font-medium">
                {rec.name}
              </span>
              <ExternalLink className="w-3 h-3 text-muted-foreground/30 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          );
        })}
      </div>
    );
  }

  // ═══ INLINE: Compact pill buttons ═══
  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {recommendations.map((rec) => {
        const Icon = verticalIcons[rec.vertical] || Sparkles;
        return (
          <button
            key={rec.id}
            onClick={() => handleClick(rec.id, rec.affiliateUrl)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-full border border-white/5 bg-white/2 hover:bg-purple-500/10 hover:border-purple-500/20 transition-all group cursor-pointer"
          >
            <Icon className="w-3 h-3 text-muted-foreground/40 group-hover:text-purple-400" />
            <span className="text-muted-foreground group-hover:text-purple-400 font-medium">{rec.name}</span>
            <ExternalLink className="w-3 h-3 text-muted-foreground/40 group-hover:text-purple-400" />
          </button>
        );
      })}
    </div>
  );
}
