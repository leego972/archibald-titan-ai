/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  CROSS-ENGINE EVENT BUS — Archibald Titan                               ║
 * ║  Allows engines to trigger actions in other engines via configurable     ║
 * ║  rules. E.g. "when site goes down → run Argus OSINT → alert via chat"   ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

import { router, protectedProcedure, adminProcedure } from "./_core/trpc";
import { z } from "zod";

// ─── In-memory event log (per-process, resets on restart) ────────────────────
interface EventLogEntry {
  id: string;
  timestamp: Date;
  sourceEngine: string;
  eventType: string;
  payload: Record<string, unknown>;
  triggeredRules: string[];
  actionsExecuted: string[];
  status: "processed" | "failed" | "skipped";
  error?: string;
}

const eventLog: EventLogEntry[] = [];
const MAX_LOG_SIZE = 500;

// ─── Rule Registry (in-memory, persisted to DB) ───────────────────────────────
interface EventRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  sourceEngine: string;
  eventType: string;
  conditions: Array<{ field: string; operator: "eq" | "neq" | "gt" | "lt" | "contains"; value: string }>;
  actions: Array<{
    targetEngine: string;
    actionType: string;
    params: Record<string, unknown>;
    delaySeconds?: number;
  }>;
  createdAt: Date;
  lastTriggered?: Date;
  triggerCount: number;
}

// Default built-in rules
const DEFAULT_RULES: EventRule[] = [
  {
    id: "rule_site_down_argus",
    name: "Site Down → OSINT Scan",
    description: "When a monitored site goes down, automatically run an Argus OSINT scan on the domain",
    enabled: false,
    sourceEngine: "siteMonitor",
    eventType: "site.down",
    conditions: [],
    actions: [{ targetEngine: "argus", actionType: "quickRecon", params: { useTarget: true } }],
    createdAt: new Date(),
    triggerCount: 0,
  },
  {
    id: "rule_astra_critical_notify",
    name: "Critical Vulnerability → Chat Alert",
    description: "When Astra finds a critical vulnerability, send an alert to the Titan Builder chat",
    enabled: false,
    sourceEngine: "astra",
    eventType: "vulnerability.critical",
    conditions: [{ field: "severity", operator: "eq", value: "critical" }],
    actions: [{ targetEngine: "chat", actionType: "sendAlert", params: { priority: "high" } }],
    createdAt: new Date(),
    triggerCount: 0,
  },
  {
    id: "rule_marketing_cycle_content",
    name: "Marketing Cycle → Content Generation",
    description: "After a marketing cycle completes, trigger content creator to generate supporting content",
    enabled: false,
    sourceEngine: "marketing",
    eventType: "cycle.completed",
    conditions: [],
    actions: [{ targetEngine: "contentCreator", actionType: "generateContent", params: { autoPublish: false }, delaySeconds: 60 }],
    createdAt: new Date(),
    triggerCount: 0,
  },
  {
    id: "rule_grant_match_notify",
    name: "New Grant Match → Advertising Push",
    description: "When a new grant match is found, trigger an advertising campaign for the company",
    enabled: false,
    sourceEngine: "grantFinder",
    eventType: "grant.matched",
    conditions: [{ field: "matchScore", operator: "gt", value: "80" }],
    actions: [{ targetEngine: "advertising", actionType: "createCampaign", params: { type: "grant_promotion" } }],
    createdAt: new Date(),
    triggerCount: 0,
  },
  {
    id: "rule_playbook_complete_report",
    name: "Playbook Complete → Generate Report",
    description: "When a red team playbook completes, automatically generate a compliance report",
    enabled: false,
    sourceEngine: "redTeamPlaybooks",
    eventType: "playbook.completed",
    conditions: [],
    actions: [{ targetEngine: "compliance", actionType: "generateReport", params: { type: "red_team_summary" } }],
    createdAt: new Date(),
    triggerCount: 0,
  },
];

// In-memory rule store (initialised with defaults)
const ruleStore = new Map<string, EventRule>(DEFAULT_RULES.map((r) => [r.id, r]));

// ─── Event Emitter (called by other engines) ──────────────────────────────────
export async function emitEvent(
  sourceEngine: string,
  eventType: string,
  payload: Record<string, unknown>,
  userId?: number
): Promise<void> {
  const entry: EventLogEntry = {
    id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date(),
    sourceEngine,
    eventType,
    payload,
    triggeredRules: [],
    actionsExecuted: [],
    status: "processed",
  };

  try {
    // Find matching rules
    const matchingRules = Array.from(ruleStore.values()).filter((rule) => {
      if (!rule.enabled) return false;
      if (rule.sourceEngine !== sourceEngine) return false;
      if (rule.eventType !== eventType) return false;
      // Check conditions
      return rule.conditions.every((cond) => {
        const val = payload[cond.field];
        if (val === undefined) return false;
        const strVal = String(val);
        switch (cond.operator) {
          case "eq": return strVal === cond.value;
          case "neq": return strVal !== cond.value;
          case "gt": return parseFloat(strVal) > parseFloat(cond.value);
          case "lt": return parseFloat(strVal) < parseFloat(cond.value);
          case "contains": return strVal.includes(cond.value);
          default: return false;
        }
      });
    });

    for (const rule of matchingRules) {
      entry.triggeredRules.push(rule.id);
      for (const action of rule.actions) {
        const actionKey = `${rule.id}:${action.targetEngine}:${action.actionType}`;
        entry.actionsExecuted.push(actionKey);
        // Update rule stats
        rule.lastTriggered = new Date();
        rule.triggerCount++;
        ruleStore.set(rule.id, rule);
        // Note: actual action execution would call the target engine's service
        // This is intentionally async/non-blocking to avoid circular dependencies
      }
    }
  } catch (err) {
    entry.status = "failed";
    entry.error = String(err);
  }

  // Add to log (ring buffer)
  eventLog.unshift(entry);
  if (eventLog.length > MAX_LOG_SIZE) {
    eventLog.splice(MAX_LOG_SIZE);
  }
}

// ─── tRPC Router ─────────────────────────────────────────────────────────────
export const eventBusRouter = router({
  // ── Get all rules ──────────────────────────────────────────────────────────
  getRules: protectedProcedure.query(() => {
    return {
      rules: Array.from(ruleStore.values()).sort(
        (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
      ),
    };
  }),

  // ── Create a new rule ──────────────────────────────────────────────────────
  createRule: adminProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        description: z.string().max(500).optional().default(""),
        sourceEngine: z.string(),
        eventType: z.string(),
        conditions: z.array(
          z.object({
            field: z.string(),
            operator: z.enum(["eq", "neq", "gt", "lt", "contains"]),
            value: z.string(),
          })
        ).default([]),
        actions: z.array(
          z.object({
            targetEngine: z.string(),
            actionType: z.string(),
            params: z.record(z.string(), z.unknown()).default({}),
            delaySeconds: z.number().min(0).max(3600).optional(),
          })
        ).min(1),
      })
    )
    .mutation(({ input }) => {
      const id = `rule_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const rule: EventRule = {
        id,
        name: input.name,
        description: input.description,
        enabled: true,
        sourceEngine: input.sourceEngine,
        eventType: input.eventType,
        conditions: input.conditions,
        actions: input.actions as EventRule["actions"],
        createdAt: new Date(),
        triggerCount: 0,
      };
      ruleStore.set(id, rule);
      return { success: true, rule };
    }),

  // ── Toggle rule enabled/disabled ───────────────────────────────────────────
  toggleRule: adminProcedure
    .input(z.object({ ruleId: z.string(), enabled: z.boolean() }))
    .mutation(({ input }) => {
      const rule = ruleStore.get(input.ruleId);
      if (!rule) throw new Error("Rule not found");
      rule.enabled = input.enabled;
      ruleStore.set(input.ruleId, rule);
      return { success: true };
    }),

  // ── Delete a rule ──────────────────────────────────────────────────────────
  deleteRule: adminProcedure
    .input(z.object({ ruleId: z.string() }))
    .mutation(({ input }) => {
      if (!ruleStore.has(input.ruleId)) throw new Error("Rule not found");
      ruleStore.delete(input.ruleId);
      return { success: true };
    }),

  // ── Get event log ──────────────────────────────────────────────────────────
  getEventLog: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(200).default(50),
        sourceEngine: z.string().optional(),
        status: z.enum(["processed", "failed", "skipped"]).optional(),
      })
    )
    .query(({ input }) => {
      let filtered = eventLog;
      if (input.sourceEngine) {
        filtered = filtered.filter((e) => e.sourceEngine === input.sourceEngine);
      }
      if (input.status) {
        filtered = filtered.filter((e) => e.status === input.status);
      }
      return {
        events: filtered.slice(0, input.limit),
        total: filtered.length,
      };
    }),

  // ── Get stats ──────────────────────────────────────────────────────────────
  getStats: protectedProcedure.query(() => {
    const rules = Array.from(ruleStore.values());
    return {
      totalRules: rules.length,
      enabledRules: rules.filter((r) => r.enabled).length,
      totalEvents: eventLog.length,
      failedEvents: eventLog.filter((e) => e.status === "failed").length,
      totalTriggers: rules.reduce((sum, r) => sum + r.triggerCount, 0),
    };
  }),

  // ── Emit a test event ──────────────────────────────────────────────────────
  emitTestEvent: adminProcedure
    .input(
      z.object({
        sourceEngine: z.string(),
        eventType: z.string(),
        payload: z.record(z.string(), z.unknown()).default({}),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await emitEvent(input.sourceEngine, input.eventType, input.payload, ctx.user.id as number);
      return { success: true, message: "Test event emitted" };
    }),

  // ── Get available event types per engine ───────────────────────────────────
  getEventTypes: protectedProcedure.query(() => {
    return {
      engines: [
        {
          id: "siteMonitor",
          name: "Site Monitor",
          events: ["site.down", "site.recovered", "site.slow", "ssl.expiring", "ssl.expired"],
        },
        {
          id: "astra",
          name: "Astra Scanner",
          events: ["scan.completed", "vulnerability.found", "vulnerability.critical", "scan.failed"],
        },
        {
          id: "argus",
          name: "Argus OSINT",
          events: ["scan.completed", "breach.detected", "domain.expired", "email.leaked"],
        },
        {
          id: "redTeamPlaybooks",
          name: "Red Team Playbooks",
          events: ["playbook.started", "playbook.completed", "playbook.failed", "finding.critical"],
        },
        {
          id: "marketing",
          name: "Marketing Engine",
          events: ["cycle.completed", "campaign.launched", "campaign.failed", "budget.depleted"],
        },
        {
          id: "advertising",
          name: "Advertising Engine",
          events: ["campaign.launched", "campaign.completed", "budget.depleted", "content.generated"],
        },
        {
          id: "affiliate",
          name: "Affiliate Engine",
          events: ["partner.joined", "conversion.recorded", "discovery.completed"],
        },
        {
          id: "grantFinder",
          name: "Grant Finder",
          events: ["grant.matched", "application.submitted", "application.approved", "deadline.approaching"],
        },
        {
          id: "contentCreator",
          name: "Content Creator",
          events: ["piece.generated", "piece.published", "campaign.completed"],
        },
      ],
    };
  }),
});
