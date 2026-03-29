/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  SIEM INTEGRATION ROUTER — Archibald Titan                              ║
 * ║  Forwards security events to external SIEM platforms via webhooks:      ║
 * ║  Splunk HEC, Elastic SIEM, Datadog, Microsoft Sentinel, QRadar, etc.    ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

import { router, protectedProcedure } from "./_core/trpc";
import { z } from "zod";
import axios from "axios";

// ─── Types ────────────────────────────────────────────────────────────────────
type SiemProvider = "splunk" | "elastic" | "datadog" | "sentinel" | "qradar" | "generic_webhook";
type EventSeverity = "critical" | "high" | "medium" | "low" | "info";

interface SiemConfig {
  id: string;
  userId: string;
  name: string;
  provider: SiemProvider;
  webhookUrl: string;
  apiKey?: string;
  indexName?: string;
  enabled: boolean;
  eventTypes: string[];
  createdAt: Date;
  lastTestedAt?: Date;
  lastTestStatus?: "success" | "failed";
  eventsSent: number;
}

interface SiemEvent {
  id: string;
  configId: string;
  userId: string;
  eventType: string;
  severity: EventSeverity;
  source: string;
  payload: Record<string, unknown>;
  sentAt: Date;
  status: "sent" | "failed";
  error?: string;
}

// ─── In-memory store ──────────────────────────────────────────────────────────
const siemConfigs: SiemConfig[] = [];
const siemEventLog: SiemEvent[] = [];
const MAX_EVENTS = 500;

// ─── Formatters ───────────────────────────────────────────────────────────────
function formatForSplunk(event: Omit<SiemEvent, "id" | "configId" | "userId" | "sentAt" | "status">, config: SiemConfig) {
  return {
    time: Date.now() / 1000,
    host: "archibald-titan",
    source: event.source,
    sourcetype: "titan:security",
    index: config.indexName || "main",
    event: {
      ...event.payload,
      event_type: event.eventType,
      severity: event.severity,
    },
  };
}

function formatForElastic(event: Omit<SiemEvent, "id" | "configId" | "userId" | "sentAt" | "status">) {
  return {
    "@timestamp": new Date().toISOString(),
    "event.type": event.eventType,
    "event.severity": event.severity,
    "event.source": event.source,
    "event.provider": "archibald-titan",
    ...event.payload,
  };
}

function formatForDatadog(event: Omit<SiemEvent, "id" | "configId" | "userId" | "sentAt" | "status">) {
  return {
    ddsource: "archibald-titan",
    ddtags: `severity:${event.severity},event_type:${event.eventType}`,
    hostname: "archibald-titan",
    message: JSON.stringify(event.payload),
    service: event.source,
    status: event.severity === "critical" || event.severity === "high" ? "error" : event.severity === "medium" ? "warn" : "info",
  };
}

function formatForSentinel(event: Omit<SiemEvent, "id" | "configId" | "userId" | "sentAt" | "status">) {
  return {
    TimeGenerated: new Date().toISOString(),
    EventType: event.eventType,
    Severity: event.severity,
    Source: event.source,
    Provider: "ArcibaldTitan",
    Properties: JSON.stringify(event.payload),
  };
}

// ─── Event dispatcher (exported for other engines to use) ─────────────────────
export async function dispatchSiemEvent(
  userId: string,
  eventType: string,
  severity: EventSeverity,
  source: string,
  payload: Record<string, unknown>
): Promise<void> {
  const userConfigs = siemConfigs.filter((c) => c.userId === userId && c.enabled && c.eventTypes.includes(eventType));

  for (const config of userConfigs) {
    let body: unknown;
    const headers: Record<string, string> = { "Content-Type": "application/json" };

    switch (config.provider) {
      case "splunk":
        body = formatForSplunk({ eventType, severity, source, payload }, config);
        if (config.apiKey) headers["Authorization"] = `Splunk ${config.apiKey}`;
        break;
      case "elastic":
        body = formatForElastic({ eventType, severity, source, payload });
        if (config.apiKey) headers["Authorization"] = `ApiKey ${config.apiKey}`;
        break;
      case "datadog":
        body = [formatForDatadog({ eventType, severity, source, payload })];
        if (config.apiKey) headers["DD-API-KEY"] = config.apiKey;
        break;
      case "sentinel":
        body = [formatForSentinel({ eventType, severity, source, payload })];
        if (config.apiKey) headers["Authorization"] = `SharedKey ${config.apiKey}`;
        break;
      default:
        body = { eventType, severity, source, payload, timestamp: new Date().toISOString(), provider: "archibald-titan" };
        if (config.apiKey) headers["Authorization"] = `Bearer ${config.apiKey}`;
    }

    const logEntry: SiemEvent = {
      id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      configId: config.id,
      userId,
      eventType,
      severity,
      source,
      payload,
      sentAt: new Date(),
      status: "sent",
    };

    try {
      await axios.post(config.webhookUrl, body, { headers, timeout: 5000 });
      config.eventsSent++;
    } catch (err: any) {
      logEntry.status = "failed";
      logEntry.error = err?.message ?? "Unknown error";
    }

    siemEventLog.unshift(logEntry);
    if (siemEventLog.length > MAX_EVENTS) siemEventLog.splice(MAX_EVENTS);
  }
}

// ─── tRPC Router ─────────────────────────────────────────────────────────────
export const siemRouter = router({
  // ── List configs ──────────────────────────────────────────────────────────
  getConfigs: protectedProcedure.query(({ ctx }) => {
    const configs = siemConfigs.filter((c) => c.userId === ctx.user.id).map((c) => ({
      ...c,
      apiKey: c.apiKey ? "••••••••" : undefined, // mask key
    }));
    return { configs };
  }),

  // ── Create config ─────────────────────────────────────────────────────────
  createConfig: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        provider: z.enum(["splunk", "elastic", "datadog", "sentinel", "qradar", "generic_webhook"]),
        webhookUrl: z.string().url(),
        apiKey: z.string().optional(),
        indexName: z.string().optional(),
        eventTypes: z.array(z.string()).min(1),
      })
    )
    .mutation(({ input, ctx }) => {
      const config: SiemConfig = {
        id: `siem_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        userId: ctx.user.id,
        name: input.name,
        provider: input.provider,
        webhookUrl: input.webhookUrl,
        apiKey: input.apiKey,
        indexName: input.indexName,
        enabled: true,
        eventTypes: input.eventTypes,
        createdAt: new Date(),
        eventsSent: 0,
      };
      siemConfigs.push(config);
      return { success: true, config: { ...config, apiKey: config.apiKey ? "••••••••" : undefined } };
    }),

  // ── Update config ─────────────────────────────────────────────────────────
  updateConfig: protectedProcedure
    .input(
      z.object({
        configId: z.string(),
        name: z.string().min(1).max(100).optional(),
        webhookUrl: z.string().url().optional(),
        apiKey: z.string().optional(),
        indexName: z.string().optional(),
        eventTypes: z.array(z.string()).optional(),
        enabled: z.boolean().optional(),
      })
    )
    .mutation(({ input, ctx }) => {
      const config = siemConfigs.find((c) => c.id === input.configId && c.userId === ctx.user.id);
      if (!config) throw new Error("Config not found");
      if (input.name !== undefined) config.name = input.name;
      if (input.webhookUrl !== undefined) config.webhookUrl = input.webhookUrl;
      if (input.apiKey !== undefined) config.apiKey = input.apiKey;
      if (input.indexName !== undefined) config.indexName = input.indexName;
      if (input.eventTypes !== undefined) config.eventTypes = input.eventTypes;
      if (input.enabled !== undefined) config.enabled = input.enabled;
      return { success: true };
    }),

  // ── Delete config ─────────────────────────────────────────────────────────
  deleteConfig: protectedProcedure
    .input(z.object({ configId: z.string() }))
    .mutation(({ input, ctx }) => {
      const idx = siemConfigs.findIndex((c) => c.id === input.configId && c.userId === ctx.user.id);
      if (idx === -1) throw new Error("Config not found");
      siemConfigs.splice(idx, 1);
      return { success: true };
    }),

  // ── Test a config ─────────────────────────────────────────────────────────
  testConfig: protectedProcedure
    .input(z.object({ configId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const config = siemConfigs.find((c) => c.id === input.configId && c.userId === ctx.user.id);
      if (!config) throw new Error("Config not found");

      try {
        await dispatchSiemEvent(ctx.user.id, "titan.test", "info", "archibald-titan", {
          message: "Test event from Archibald Titan SIEM integration",
          timestamp: new Date().toISOString(),
        });
        config.lastTestedAt = new Date();
        config.lastTestStatus = "success";
        return { success: true, message: "Test event sent successfully" };
      } catch (err: any) {
        config.lastTestedAt = new Date();
        config.lastTestStatus = "failed";
        throw new Error(`Test failed: ${err?.message}`);
      }
    }),

  // ── Get event log ─────────────────────────────────────────────────────────
  getEventLog: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(200).default(50), configId: z.string().optional() }))
    .query(({ ctx, input }) => {
      let events = siemEventLog.filter((e) => e.userId === ctx.user.id);
      if (input.configId) events = events.filter((e) => e.configId === input.configId);
      return { events: events.slice(0, input.limit) };
    }),

  // ── Get available event types ─────────────────────────────────────────────
  getEventTypes: protectedProcedure.query(() => {
    return {
      eventTypes: [
        { id: "security.scan.completed", label: "Security Scan Completed", category: "Security" },
        { id: "security.vulnerability.found", label: "Vulnerability Found", category: "Security" },
        { id: "security.breach.detected", label: "Breach Detected", category: "Security" },
        { id: "auth.login.failed", label: "Login Failed", category: "Authentication" },
        { id: "auth.login.success", label: "Login Success", category: "Authentication" },
        { id: "auth.mfa.disabled", label: "MFA Disabled", category: "Authentication" },
        { id: "site.monitor.down", label: "Site Down", category: "Monitoring" },
        { id: "site.monitor.ssl_expiry", label: "SSL Certificate Expiring", category: "Monitoring" },
        { id: "credential.leaked", label: "Credential Leaked", category: "Credentials" },
        { id: "credential.created", label: "Credential Created", category: "Credentials" },
        { id: "playbook.executed", label: "Red Team Playbook Executed", category: "Red Team" },
        { id: "argus.scan.completed", label: "Argus OSINT Scan Completed", category: "OSINT" },
        { id: "astra.scan.completed", label: "Astra Scan Completed", category: "Scanning" },
        { id: "titan.test", label: "Test Event", category: "System" },
      ],
    };
  }),

  // ── Get stats ─────────────────────────────────────────────────────────────
  getStats: protectedProcedure.query(({ ctx }) => {
    const userConfigs = siemConfigs.filter((c) => c.userId === ctx.user.id);
    const userEvents = siemEventLog.filter((e) => e.userId === ctx.user.id);
    const totalSent = userEvents.filter((e) => e.status === "sent").length;
    const totalFailed = userEvents.filter((e) => e.status === "failed").length;
    return {
      totalConfigs: userConfigs.length,
      enabledConfigs: userConfigs.filter((c) => c.enabled).length,
      totalEventsSent: totalSent,
      totalEventsFailed: totalFailed,
      successRate: totalSent + totalFailed > 0 ? Math.round((totalSent / (totalSent + totalFailed)) * 100) : 100,
    };
  }),
});
