/**
 * useSubscription — Frontend hook for plan-aware UI.
 *
 * Provides current plan info, usage stats, and helpers
 * to check feature access and show upgrade prompts.
 */

import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useMemo } from "react";
import type { PlanId } from "@shared/pricing";

export interface SubscriptionState {
  /** Current plan ID */
  planId: PlanId;
  /** Plan display name */
  planName: string;
  /** Whether data is still loading */
  loading: boolean;
  /** Whether the user has an active paid subscription */
  isPaid: boolean;
  /** Whether the user is on the free plan */
  isFree: boolean;
  /** Whether the user is on the pro plan */
  isPro: boolean;
  /** Whether the user is on the enterprise plan */
  isEnterprise: boolean;
  /** Whether the user is on the cyber plan */
  isCyber: boolean;
  /** Fetches used this month */
  fetchesUsed: number;
  /** Fetches remaining (-1 = unlimited) */
  fetchesRemaining: number;
  /** Max fetches per month (-1 = unlimited) */
  fetchesLimit: number;
  /** Credentials stored */
  credentialsStored: number;
  /** Credentials remaining (-1 = unlimited) */
  credentialsRemaining: number;
  /** Proxy slots used */
  proxySlotsUsed: number;
  /** Proxy slots remaining (-1 = unlimited) */
  proxySlotsRemaining: number;
  /** Max proxy slots (-1 = unlimited) */
  proxySlotLimit: number;
  /** Allowed export formats */
  exportFormats: string[];
  /** Check if a specific feature is available */
  canUse: (feature: string) => boolean;
  /** Refresh the subscription data */
  refresh: () => void;
}

// Feature access map — which plans can use which features
const FEATURE_ACCESS: Record<string, PlanId[]> = {
  captcha_solving: ["pro", "enterprise", "cyber", "cyber_plus", "titan"],
  kill_switch: ["pro", "enterprise", "cyber", "cyber_plus", "titan"],
  scheduled_fetches: ["pro", "enterprise", "cyber", "cyber_plus", "titan"],
  proxy_pool: ["pro", "enterprise", "cyber", "cyber_plus", "titan"],
  env_export: ["pro", "enterprise", "cyber", "cyber_plus", "titan"],
  csv_export: ["enterprise", "cyber", "cyber_plus", "titan"],
  api_export: ["enterprise", "cyber", "cyber_plus", "titan"],
  team_management: ["enterprise", "cyber", "cyber_plus", "titan"],
  api_access: ["enterprise", "cyber", "cyber_plus", "titan"],
  sso_saml: ["enterprise", "cyber", "cyber_plus", "titan"],
  audit_logs: ["enterprise", "cyber", "cyber_plus", "titan"],
  // Cyber+ features
  leak_scanner: ["cyber", "cyber_plus", "titan"],
  credential_health: ["cyber", "cyber_plus", "titan"],
  totp_vault: ["cyber", "cyber_plus", "titan"],
  security_tools: ["cyber", "cyber_plus", "titan"],
  // Titan-exclusive features
  zero_click_research: ["cyber_plus", "titan"],
  c2_framework: ["cyber_plus", "titan"],
  offensive_tooling: ["cyber_plus", "titan"],
  dedicated_gpu: ["titan"],
  on_premise: ["titan"],
};

export function useSubscription(): SubscriptionState {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const usageQuery = trpc.fetcher.planUsage.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: true,
    staleTime: 30_000, // Cache for 30 seconds
  });

  const subQuery = trpc.stripe.getSubscription.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: true,
    staleTime: 30_000,
  });

  return useMemo(() => {
    const loading = usageQuery.isLoading || subQuery.isLoading;
    const usage = usageQuery.data;
    // Admin users always resolve to titan (highest tier, unlimited)
    const planId: PlanId = isAdmin ? "titan" : (usage?.plan?.planId || "free");
    const tier = usage?.plan?.tier;

    const canUse = (feature: string): boolean => {
      if (isAdmin) return true; // Admin bypass — full access to everything
      const allowedPlans = FEATURE_ACCESS[feature];
      if (!allowedPlans) return true; // Unknown features default to allowed
      return allowedPlans.includes(planId);
    };

    return {
      planId,
      planName: isAdmin ? "Admin (Unlimited)" : (tier?.name || "Free"),
      loading,
      isPaid: isAdmin || planId !== "free",
      isFree: !isAdmin && planId === "free",
      isPro: planId === "pro",
      isEnterprise: isAdmin || ["enterprise", "cyber", "cyber_plus", "titan"].includes(planId),
      isCyber: isAdmin || ["cyber", "cyber_plus", "titan"].includes(planId),
      fetchesUsed: usage?.fetchesUsedThisMonth ?? 0,
      fetchesRemaining: isAdmin ? -1 : (usage?.fetchesRemaining ?? 5),
      fetchesLimit: isAdmin ? -1 : (tier?.limits.fetchesPerMonth ?? 5),
      credentialsStored: usage?.credentialsStored ?? 0,
      credentialsRemaining: isAdmin ? -1 : (usage?.credentialsRemaining ?? 25),
      proxySlotsUsed: usage?.proxySlotsUsed ?? 0,
      proxySlotsRemaining: isAdmin ? -1 : (usage?.proxySlotsRemaining ?? 0),
      proxySlotLimit: isAdmin ? -1 : (tier?.limits.proxySlots ?? 0),
      exportFormats: isAdmin ? ["json", "env", "csv", "api"] : (tier?.limits.exportFormats ?? ["json"]),
      canUse,
      refresh: () => {
        usageQuery.refetch();
        subQuery.refetch();
      },
    };
  }, [usageQuery.data, usageQuery.isLoading, subQuery.data, subQuery.isLoading, isAdmin]);
}
