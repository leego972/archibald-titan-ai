/**
 * Master Growth Orchestrator tRPC Router
 * Exposes all orchestrator functions to the frontend dashboard
 */

import { z } from "zod";
import { router, protectedProcedure } from "./_core/trpc.js";
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

export const masterGrowthRouter = router({
  // Run a full growth cycle immediately
  runCycle: protectedProcedure.mutation(async () => {
    return await runMasterGrowthCycle();
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
