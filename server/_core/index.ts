import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { registerStripeWebhook, processAllMonthlyRefills } from "../stripe-router";
import { registerDownloadRoute } from "../download-gate";
import { registerApiRoutes } from "../api-access-router";
import { registerV5ApiRoutes } from "../v5-features-router";
import { registerEmailAuthRoutes } from "../email-auth-router";
import { registerReleaseUploadRoute, registerUpdateFeedRoutes } from "../releases-router";
import { registerVoiceUploadRoute } from "../voice-router";
import { registerSocialAuthRoutes } from "../social-auth-router";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  // Trust proxy headers (Cloud Run, Cloudflare, etc.)
  app.set("trust proxy", true);
  const server = createServer(app);

  // Stripe webhook MUST be registered BEFORE express.json() for raw body access
  registerStripeWebhook(app);

  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);
  // Email/password authentication endpoints
  registerEmailAuthRoutes(app);
  // Independent GitHub & Google OAuth (no Manus proxy)
  registerSocialAuthRoutes(app);
  // Token-gated download endpoint
  registerDownloadRoute(app);
  // REST API endpoints for API key access
  registerApiRoutes(app);
  // V5.0 expanded REST API with rate limiting and usage logging
  registerV5ApiRoutes(app);
  // Release binary upload endpoint (admin only)
  registerReleaseUploadRoute(app);
  // Auto-update feed for electron-updater (latest.yml endpoints)
  registerUpdateFeedRoutes(app);
  // Voice audio upload endpoint
  registerVoiceUploadRoute(app);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);

    // ─── Scheduled Monthly Credit Refill ──────────────────────────
    // Run once on startup (catches any missed refills) and then every 24 hours.
    // The processMonthlyRefill function is idempotent — it checks lastRefillAt
    // and only refills if the user hasn't been refilled this calendar month.
    scheduleMonthlyRefill();
  });
}

function scheduleMonthlyRefill() {
  const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

  // Run after a short delay on startup to let DB connections settle
  setTimeout(async () => {
    try {
      console.log("[Cron] Running startup credit refill check...");
      const result = await processAllMonthlyRefills();
      console.log(`[Cron] Startup refill: ${result.processed} checked, ${result.refilled} refilled, ${result.errors} errors`);
    } catch (err: any) {
      console.error("[Cron] Startup refill failed:", err.message);
    }
  }, 30_000); // 30 second delay — give DB connections time to settle

  // Then run every 24 hours
  setInterval(async () => {
    try {
      console.log("[Cron] Running scheduled credit refill...");
      const result = await processAllMonthlyRefills();
      console.log(`[Cron] Scheduled refill: ${result.processed} checked, ${result.refilled} refilled, ${result.errors} errors`);
    } catch (err: any) {
      console.error("[Cron] Scheduled refill failed:", err.message);
    }
  }, TWENTY_FOUR_HOURS);
}

startServer().catch(console.error);
