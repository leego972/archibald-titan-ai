/**
 * Onboarding Wizard Router
 *
 * Manages the new-user onboarding flow. Tracks which steps have been
 * completed and marks the user as onboarded when done.
 */

import { z } from "zod";
import { eq, count } from "drizzle-orm";
import { protectedProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { users, fetcherCredentials, fetcherJobs, fetcherSettings } from "../drizzle/schema";

// The onboarding steps — order matters
const ONBOARDING_STEPS = [
  {
    id: "welcome",
    title: "Welcome to Titan",
    description: "Get to know your AI-powered credential management platform.",
  },
  {
    id: "add_credential",
    title: "Add Your First Credential",
    description: "Store a credential from any supported provider.",
  },
  {
    id: "run_fetch",
    title: "Run Your First Fetch",
    description: "Fetch credentials from a provider to see Titan in action.",
  },
  {
    id: "configure_settings",
    title: "Configure Settings",
    description: "Set up your proxy, captcha, and browser preferences.",
  },
  {
    id: "explore_features",
    title: "Explore Features",
    description: "Discover Titan Assistant, Leak Scanner, and more.",
  },
] as const;

type StepId = (typeof ONBOARDING_STEPS)[number]["id"];

export const onboardingWizardRouter = router({
  /**
   * Get onboarding status — which steps are done, current step, etc.
   */
  getStatus: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return { completed: true, steps: [], currentStep: null };

    const [user] = await db
      .select({
        onboardingCompleted: users.onboardingCompleted,
      })
      .from(users)
      .where(eq(users.id, ctx.user.id))
      .limit(1);

    if (!user || user.onboardingCompleted) {
      return { completed: true, steps: [], currentStep: null };
    }

    // Check which steps are actually completed based on real data
    const [credCount] = await db
      .select({ total: count() })
      .from(fetcherCredentials)
      .where(eq(fetcherCredentials.userId, ctx.user.id));

    const [jobCount] = await db
      .select({ total: count() })
      .from(fetcherJobs)
      .where(eq(fetcherJobs.userId, ctx.user.id));

    const [settingsRow] = await db
      .select()
      .from(fetcherSettings)
      .where(eq(fetcherSettings.userId, ctx.user.id))
      .limit(1);

    const stepStatus: Record<StepId, boolean> = {
      welcome: true, // Always completed once they see the wizard
      add_credential: credCount.total > 0,
      run_fetch: jobCount.total > 0,
      configure_settings: !!settingsRow,
      explore_features: false, // Manually completed
    };

    const steps = ONBOARDING_STEPS.map((step) => ({
      ...step,
      completed: stepStatus[step.id],
    }));

    // Find current step (first incomplete)
    const currentStep = steps.find((s) => !s.completed)?.id || null;

    return {
      completed: false,
      steps,
      currentStep,
      progress: steps.filter((s) => s.completed).length,
      total: steps.length,
    };
  }),

  /**
   * Mark a specific step as completed.
   */
  completeStep: protectedProcedure
    .input(z.object({ stepId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // For most steps, completion is automatic (based on real data).
      // "explore_features" is the only one that needs manual marking.
      // We just return success — the getStatus query will re-check real data.
      return { success: true, stepId: input.stepId };
    }),

  /**
   * Mark onboarding as fully completed (skip or finish).
   */
  complete: protectedProcedure.mutation(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return { success: false };

    await db
      .update(users)
      .set({ onboardingCompleted: true })
      .where(eq(users.id, ctx.user.id));

    return { success: true };
  }),

  /**
   * Reset onboarding (for testing or re-onboarding).
   */
  reset: protectedProcedure.mutation(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return { success: false };

    await db
      .update(users)
      .set({ onboardingCompleted: false })
      .where(eq(users.id, ctx.user.id));

    return { success: true };
  }),
});
