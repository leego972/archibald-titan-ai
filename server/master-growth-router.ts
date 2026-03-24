/**
 * Master Growth Orchestrator tRPC Router
 * Exposes all orchestrator functions to the frontend dashboard
 */

import { z } from "zod";
import { router, protectedProcedure } from "./_core/trpc.js";
import { consumeCredits, checkCredits } from "./credit-service";
import { createLogger } from "./_core/logger.js";
import { getErrorMessage } from "./_core/errors.js";
import {
  runMasterGrowthCycle,
  startMasterOrchestrator,
  stopMasterOrchestrator,
  getMasterOrchestratorStatus,
  getLatestGrowthReport,
  getGrowthReportHistory,
  getAnomalyLog,
  getMetricsHistory,
  getLatestContext,
  getCrossSystemInsights,
  getNextCycleAdjustments,
  resolveAnomaly,
} from "./master-growth-orchestrator.js";

const log = createLogger("MasterGrowthRouter");

export const masterGrowthRouter = router({
  // Run a full growth cycle immediately
  runCycle: protectedProcedure.mutation(async ({ ctx }) => {
    const creditCheck = await checkCredits(ctx.user.id, "advertising_run");
    if (!creditCheck.allowed) {
      throw new Error(`Insufficient credits for master growth cycle. Need ${creditCheck.cost}, have ${creditCheck.currentBalance}.`);
    }
    const result = await runMasterGrowthCycle();
    try {
      await consumeCredits(ctx.user.id, "advertising_run", "Master growth orchestrator cycle");
    } catch (e) {
      log.warn("[MasterGrowth] Credit consumption failed (non-fatal):", { error: getErrorMessage(e) });
    }
    return result;
  }),

  // Start the daily scheduler
  startOrchestrator: protectedProcedure.mutation(() => {
    startMasterOrchestrator();
    return { success: true, message: "Master Growth Orchestrator started — daily cycle at 6:00 AM" };
  }),

  // Stop the scheduler
  stopOrchestrator: protectedProcedure.mutation(() => {
    stopMasterOrchestrator();
    return { success: true, message: "Master Growth Orchestrator stopped" };
  }),

  // Get orchestrator status
  getStatus: protectedProcedure.query(() => {
    return getMasterOrchestratorStatus();
  }),

  // Get the latest weekly growth report
  getLatestReport: protectedProcedure.query(() => {
    return getLatestGrowthReport();
  }),

  // Get all historical reports (last 52 weeks)
  getReportHistory: protectedProcedure.query(() => {
    return getGrowthReportHistory();
  }),

  // Get all anomaly alerts
  getAnomalies: protectedProcedure.query(() => {
    return getAnomalyLog();
  }),

  // Get metrics history for charts
  getMetricsHistory: protectedProcedure.query(() => {
    return getMetricsHistory();
  }),

  // Get the latest growth context (keyword signals, briefs, channels)
  getLatestContext: protectedProcedure.query(() => {
    return getLatestContext();
  }),

  // Get cross-system insights from the latest cycle
  getCrossSystemInsights: protectedProcedure.query(() => {
    return getCrossSystemInsights();
  }),

  // Get next cycle adjustments
  getNextCycleAdjustments: protectedProcedure.query(() => {
    return getNextCycleAdjustments();
  }),

  // Resolve an anomaly
  resolveAnomaly: protectedProcedure
    .input(z.object({ anomalyId: z.string() }))
    .mutation(({ input }) => {
      const resolved = resolveAnomaly(input.anomalyId);
      return { success: resolved };
    }),
});
