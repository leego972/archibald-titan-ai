/**
 * IP Rotation Router
 * tRPC endpoints for managing the 3-layer IP rotation engine.
 */

import { z } from "zod";
import { router, protectedProcedure } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "./db";
import { userSecrets } from "../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { encrypt, decrypt } from "./fetcher-db";
import { createLogger } from "./_core/logger.js";
import {
  startTorDaemon, stopTorDaemon, isTorReady, isTorStarting,
  getNewTorCircuit, scrapeAndRefreshProxies, startAutoProxyScraper,
  stopAutoProxyScraper, getProxyPoolStats, getProxyPool,
} from "./ip-rotation-engine";

const log = createLogger("IPRotationRouter");

const SECRET_SETTINGS = "__ip_rotation_settings";

interface IPRotationSettings {
  headerSpoofing: boolean;
  torEnabled: boolean;
  autoProxyEnabled: boolean;
  activeLayer: "headers" | "tor" | "proxy" | "all";
}

const DEFAULT_SETTINGS: IPRotationSettings = {
  headerSpoofing: false,
  torEnabled: false,
  autoProxyEnabled: false,
  activeLayer: "headers",
};

async function getSettings(userId: number): Promise<IPRotationSettings> {
  const db = await getDb();
  if (!db) return DEFAULT_SETTINGS;
  const rows = await db.select().from(userSecrets)
    .where(and(eq(userSecrets.userId, userId), eq(userSecrets.secretType, SECRET_SETTINGS))).limit(1);
  if (!rows.length) return DEFAULT_SETTINGS;
  try { return { ...DEFAULT_SETTINGS, ...JSON.parse(decrypt(rows[0].encryptedValue)) }; } catch { return DEFAULT_SETTINGS; }
}

async function saveSettings(userId: number, settings: IPRotationSettings): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const enc = encrypt(JSON.stringify(settings));
  const ex = await db.select().from(userSecrets)
    .where(and(eq(userSecrets.userId, userId), eq(userSecrets.secretType, SECRET_SETTINGS))).limit(1);
  if (ex.length) {
    await db.update(userSecrets).set({ encryptedValue: enc, updatedAt: new Date() }).where(eq(userSecrets.id, ex[0].id));
  } else {
    await db.insert(userSecrets).values({ userId, secretType: SECRET_SETTINGS, label: "IP Rotation Settings", encryptedValue: enc });
  }
}

export const ipRotationRouter = router({

  /** Get full state for the IP Rotation Manager page */
  getState: protectedProcedure.query(async ({ ctx }) => {
    const settings = await getSettings(ctx.user.id);
    const torStatus = isTorReady() ? "running" : isTorStarting() ? "starting" : "stopped";
    const poolStats = getProxyPoolStats();
    return {
      settings,
      tor: {
        status: torStatus,
        ready: isTorReady(),
        starting: isTorStarting(),
      },
      proxyPool: {
        ...poolStats,
        lastScrapeAgo: poolStats.lastScrapeTime ? Math.floor((Date.now() - poolStats.lastScrapeTime) / 1000) : null,
      },
    };
  }),

  /** Get sidebar quick state */
  getActiveState: protectedProcedure.query(async ({ ctx }) => {
    const settings = await getSettings(ctx.user.id);
    const anyActive = settings.headerSpoofing || settings.torEnabled || settings.autoProxyEnabled;
    return { active: anyActive, settings };
  }),

  /** Toggle header spoofing */
  setHeaderSpoofing: protectedProcedure
    .input(z.object({ enabled: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const settings = await getSettings(ctx.user.id);
      settings.headerSpoofing = input.enabled;
      await saveSettings(ctx.user.id, settings);
      return { success: true, enabled: input.enabled };
    }),

  /** Toggle Tor routing */
  setTorEnabled: protectedProcedure
    .input(z.object({ enabled: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const settings = await getSettings(ctx.user.id);
      if (input.enabled) {
        if (!isTorReady() && !isTorStarting()) {
          // Start Tor in background — don't wait for it
          startTorDaemon().then(r => {
            log.info(`Tor start result: ${r.message}`);
          }).catch(e => log.error(`Tor start error: ${e.message}`));
        }
      }
      settings.torEnabled = input.enabled;
      await saveSettings(ctx.user.id, settings);
      return { success: true, enabled: input.enabled, torStatus: isTorReady() ? "running" : isTorStarting() ? "starting" : "stopped" };
    }),

  /** Start Tor daemon explicitly */
  startTor: protectedProcedure.mutation(async () => {
    if (isTorReady()) return { success: true, message: "Tor already running" };
    if (isTorStarting()) return { success: false, message: "Tor is already starting up..." };
    const result = await startTorDaemon();
    return result;
  }),

  /** Stop Tor daemon */
  stopTor: protectedProcedure.mutation(async ({ ctx }) => {
    stopTorDaemon();
    const settings = await getSettings(ctx.user.id);
    settings.torEnabled = false;
    await saveSettings(ctx.user.id, settings);
    return { success: true, message: "Tor stopped" };
  }),

  /** Request a new Tor circuit (new exit IP) */
  newCircuit: protectedProcedure.mutation(async () => {
    if (!isTorReady()) throw new TRPCError({ code: "BAD_REQUEST", message: "Tor is not running. Enable Tor first." });
    const ok = await getNewTorCircuit();
    return { success: ok, message: ok ? "New Tor circuit requested — IP will change shortly" : "Failed to request new circuit" };
  }),

  /** Toggle auto proxy scraper */
  setAutoProxy: protectedProcedure
    .input(z.object({ enabled: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const settings = await getSettings(ctx.user.id);
      if (input.enabled) {
        startAutoProxyScraper();
      } else {
        stopAutoProxyScraper();
      }
      settings.autoProxyEnabled = input.enabled;
      await saveSettings(ctx.user.id, settings);
      const stats = getProxyPoolStats();
      return { success: true, enabled: input.enabled, poolStats: stats };
    }),

  /** Manually trigger a proxy scrape */
  scrapeProxies: protectedProcedure.mutation(async () => {
    const result = await scrapeAndRefreshProxies();
    return result;
  }),

  /** Get current proxy pool */
  getProxyPool: protectedProcedure.query(async () => {
    const pool = getProxyPool();
    const stats = getProxyPoolStats();
    return {
      proxies: pool.slice(0, 100), // return up to 100 for display
      stats,
    };
  }),

  /** Enable all layers at once */
  enableAll: protectedProcedure.mutation(async ({ ctx }) => {
    const settings = await getSettings(ctx.user.id);
    settings.headerSpoofing = true;
    settings.autoProxyEnabled = true;
    settings.torEnabled = true;
    await saveSettings(ctx.user.id, settings);
    // Start background services
    startAutoProxyScraper();
    if (!isTorReady() && !isTorStarting()) {
      startTorDaemon().catch(e => log.error(`Tor start: ${e.message}`));
    }
    return { success: true };
  }),

  /** Disable all layers */
  disableAll: protectedProcedure.mutation(async ({ ctx }) => {
    const settings = await getSettings(ctx.user.id);
    settings.headerSpoofing = false;
    settings.autoProxyEnabled = false;
    settings.torEnabled = false;
    await saveSettings(ctx.user.id, settings);
    return { success: true };
  }),
});
