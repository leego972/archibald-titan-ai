/**
 * IP Rotation Router
 * tRPC endpoints for the production-quality 3-layer IP rotation engine.
 * Uses: fingerprints.ts, tor-supervisor.ts, proxy-pool.ts, request-interceptor.ts
 */

import { z } from "zod";
import { router, adminProcedure } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { enforceAdminFeature } from "./subscription-gate";
import { getDb } from "./db";
import { userSecrets } from "../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { encrypt, decrypt } from "./fetcher-db";
import { createLogger } from "./_core/logger.js";
import { consumeCredits, checkCredits } from "./credit-service";
import { getErrorMessage } from "./_core/errors.js";
import { torSupervisor } from "./ip-rotation/tor-supervisor";
import { proxyPool } from "./ip-rotation/proxy-pool";
import { setIPRotationConfig, getIPRotationConfig } from "./ip-rotation/request-interceptor";
import { BROWSER_PROFILES } from "./ip-rotation/fingerprints";

const log = createLogger("IPRotationRouter");

const SETTINGS_KEY = "__ip_rotation_settings_v2";

interface IPRotationSettings {
  headerSpoofing: boolean;
  torEnabled: boolean;
  proxyEnabled: boolean;
}

const DEFAULT_SETTINGS: IPRotationSettings = {
  headerSpoofing: false,
  torEnabled: false,
  proxyEnabled: false,
};

async function getSettings(userId: number): Promise<IPRotationSettings> {
  const db = await getDb();
  if (!db) return DEFAULT_SETTINGS;
  try {
    const rows = await db.select().from(userSecrets)
      .where(and(eq(userSecrets.userId, userId), eq(userSecrets.secretType, SETTINGS_KEY))).limit(1);
    if (!rows.length) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(decrypt(rows[0].encryptedValue)) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

async function saveSettings(userId: number, settings: IPRotationSettings): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const enc = encrypt(JSON.stringify(settings));
  const ex = await db.select().from(userSecrets)
    .where(and(eq(userSecrets.userId, userId), eq(userSecrets.secretType, SETTINGS_KEY))).limit(1);
  if (ex.length) {
    await db.update(userSecrets).set({ encryptedValue: enc, updatedAt: new Date() }).where(eq(userSecrets.id, ex[0].id));
  } else {
    await db.insert(userSecrets).values({
      userId,
      secretType: SETTINGS_KEY,
      label: "IP Rotation Settings",
      encryptedValue: enc,
    });
  }
  // Keep global interceptor config in sync
  setIPRotationConfig(settings);
}

export const ipRotationRouter = router({

  /** Full state for the IP Rotation Manager page */
  getState: adminProcedure.query(async ({ ctx }) => {
    enforceAdminFeature(ctx.user.role, "IP Rotation");
    const settings = await getSettings(ctx.user.id);
    const torStatus = torSupervisor.getStatus();
    const poolStats = proxyPool.getStats();
    const config = getIPRotationConfig();

    return {
      settings,
      tor: torStatus,
      proxyPool: {
        ...poolStats,
        lastScrapeAgo: poolStats.lastScrapeAt
          ? Math.floor((Date.now() - poolStats.lastScrapeAt) / 1000)
          : null,
        nextScrapeInSec: Math.floor(poolStats.nextScrapeIn / 1000),
      },
      interceptorConfig: config,
      profiles: BROWSER_PROFILES.map(p => ({
        id: p.id,
        name: p.name,
        platform: p.platform,
        browser: p.browser,
        mobile: p.mobile,
      })),
    };
  }),

  /** Sidebar quick state */
  getActiveState: adminProcedure.query(async ({ ctx }) => {
    enforceAdminFeature(ctx.user.role, "IP Rotation");
    const settings = await getSettings(ctx.user.id);
    const anyActive = settings.headerSpoofing || settings.torEnabled || settings.proxyEnabled;
    const torStatus = torSupervisor.getStatus();
    const poolStats = proxyPool.getStats();
    return {
      active: anyActive,
      settings,
      torReady: torStatus.state === "running",
      liveProxies: poolStats.live,
    };
  }),

  /** Toggle header spoofing */
  setHeaderSpoofing: adminProcedure
    .input(z.object({ enabled: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
    enforceAdminFeature(ctx.user.role, "IP Rotation");
      const settings = await getSettings(ctx.user.id);
      settings.headerSpoofing = input.enabled;
      await saveSettings(ctx.user.id, settings);
      return { success: true, enabled: input.enabled };
    }),

  /** Toggle Tor routing */
  setTorEnabled: adminProcedure
    .input(z.object({ enabled: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
    enforceAdminFeature(ctx.user.role, "IP Rotation");
      const settings = await getSettings(ctx.user.id);
      settings.torEnabled = input.enabled;
      await saveSettings(ctx.user.id, settings);

      if (input.enabled) {
        const status = torSupervisor.getStatus();
        if (status.state === "stopped" || status.state === "error") {
          // Start in background — don't block the response
          torSupervisor.start().then(r => {
            log.info(`Tor start result: ${r.message}`);
          }).catch(e => log.error(`Tor start error: ${e.message}`));
          return {
            success: true,
            enabled: true,
            torStatus: "starting" as const,
            message: "Tor is bootstrapping in the background (~60s). The page will update automatically.",
          };
        }
      }

      return {
        success: true,
        enabled: input.enabled,
        torStatus: torSupervisor.getStatus().state,
        message: input.enabled ? "Tor enabled" : "Tor disabled",
      };
    }),

  /** Explicitly start Tor and wait for bootstrap */
  startTor: adminProcedure.mutation(async ({ ctx }) => {
    enforceAdminFeature(ctx.user.role, "IP Rotation");
    const creditCheck = await checkCredits(ctx.user.id, "ip_rotation_circuit");
    if (!creditCheck.allowed) {
      throw new TRPCError({ code: "FORBIDDEN", message: `Insufficient credits to start Tor. Need ${creditCheck.cost}, have ${creditCheck.currentBalance}.` });
    }
    const status = torSupervisor.getStatus();
    if (status.state === "running") return { success: true, message: "Tor is already running", exitIp: status.exitIp };
    if (status.state === "starting" || status.state === "bootstrapping") {
      return { success: false, message: "Tor is already starting up, please wait...", exitIp: null };
    }
    const result = await torSupervisor.start();
    try {
      await consumeCredits(ctx.user.id, "ip_rotation_circuit", "Tor circuit started");
    } catch (e) {
      log.warn("[IPRotation] Credit consumption failed (non-fatal):", { error: getErrorMessage(e) });
    }
    const newStatus = torSupervisor.getStatus();
    return { ...result, exitIp: newStatus.exitIp };
  }),

  /** Stop Tor daemon */
  stopTor: adminProcedure.mutation(async ({ ctx }) => {
    enforceAdminFeature(ctx.user.role, "IP Rotation");
    await torSupervisor.stop();
    const settings = await getSettings(ctx.user.id);
    settings.torEnabled = false;
    await saveSettings(ctx.user.id, settings);
    return { success: true, message: "Tor stopped and disabled" };
  }),

  /** Request a new Tor circuit — verifies the IP actually changed */
  newCircuit: adminProcedure.mutation(async ({ ctx }) => {
    enforceAdminFeature(ctx.user.role, "IP Rotation");
    const creditCheck = await checkCredits(ctx.user.id, "ip_rotation_circuit");
    if (!creditCheck.allowed) {
      throw new TRPCError({ code: "FORBIDDEN", message: `Insufficient credits for new Tor circuit. Need ${creditCheck.cost}, have ${creditCheck.currentBalance}.` });
    }
    const result = await torSupervisor.requestNewCircuit();
    try {
      await consumeCredits(ctx.user.id, "ip_rotation_circuit", "New Tor circuit requested");
    } catch (e) {
      log.warn("[IPRotation] Credit consumption failed (non-fatal):", { error: getErrorMessage(e) });
    }
    return result;
  }),

  /** Get live Tor status (for polling during bootstrap) */
  getTorStatus: adminProcedure.query(async () => {
    return torSupervisor.getStatus();
  }),

  /** Toggle auto proxy pool */
  setProxyEnabled: adminProcedure
    .input(z.object({ enabled: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
    enforceAdminFeature(ctx.user.role, "IP Rotation");
      const settings = await getSettings(ctx.user.id);
      settings.proxyEnabled = input.enabled;
      await saveSettings(ctx.user.id, settings);

      if (input.enabled) {
        const stats = proxyPool.getStats();
        if (stats.total === 0) {
          // Start proxy pool with this user's ID for DB persistence
          proxyPool.start(ctx.user.id).catch(e => log.error(`Proxy pool start: ${e.message}`));
          return {
            success: true,
            enabled: true,
            message: "Proxy pool starting — scraping proxies in background (~2 min for first results)",
            stats,
          };
        }
      }

      return {
        success: true,
        enabled: input.enabled,
        message: input.enabled ? "Proxy rotation enabled" : "Proxy rotation disabled",
        stats: proxyPool.getStats(),
      };
    }),

  /** Manually trigger a proxy scrape */
  scrapeProxies: adminProcedure.mutation(async ({ ctx }) => {
    enforceAdminFeature(ctx.user.role, "IP Rotation");
    const creditCheck = await checkCredits(ctx.user.id, "ip_rotation_circuit");
    if (!creditCheck.allowed) {
      throw new TRPCError({ code: "FORBIDDEN", message: `Insufficient credits to scrape proxies. Need ${creditCheck.cost}, have ${creditCheck.currentBalance}.` });
    }
    // Ensure pool is initialized with this user's ID for persistence
    proxyPool.start(ctx.user.id).catch(() => {});
    const result = await proxyPool.triggerScrape();
    try {
      await consumeCredits(ctx.user.id, "ip_rotation_circuit", "Proxy scrape triggered");
    } catch (e) {
      log.warn("[IPRotation] Credit consumption failed (non-fatal):", { error: getErrorMessage(e) });
    }
    return result;
  }),

  /** Get current proxy pool */
  getProxyPool: adminProcedure.query(async () => {
    const proxies = proxyPool.getProxies(100);
    const stats = proxyPool.getStats();
    return { proxies, stats };
  }),

  /** Enable all layers at once */
  enableAll: adminProcedure.mutation(async ({ ctx }) => {
    enforceAdminFeature(ctx.user.role, "IP Rotation");
    const settings: IPRotationSettings = {
      headerSpoofing: true,
      torEnabled: true,
      proxyEnabled: true,
    };
    await saveSettings(ctx.user.id, settings);

    // Start proxy pool
    proxyPool.start(ctx.user.id).catch(e => log.error(`Proxy pool: ${e.message}`));

    // Start Tor in background
    const torStatus = torSupervisor.getStatus();
    if (torStatus.state === "stopped" || torStatus.state === "error") {
      torSupervisor.start().then(r => log.info(`Tor: ${r.message}`)).catch(e => log.error(`Tor: ${e.message}`));
    }

    return {
      success: true,
      message: "All layers enabled. Tor bootstrapping in background (~60s). Proxy scraping starting (~2 min).",
    };
  }),

  /** Disable all layers */
  disableAll: adminProcedure.mutation(async ({ ctx }) => {
    enforceAdminFeature(ctx.user.role, "IP Rotation");
    const settings: IPRotationSettings = {
      headerSpoofing: false,
      torEnabled: false,
      proxyEnabled: false,
    };
    await saveSettings(ctx.user.id, settings);
    return { success: true };
  }),
});
