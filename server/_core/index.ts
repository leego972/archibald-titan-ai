import "./sentry.js";
import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import path from "path";
import { fileURLToPath } from "url";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { migrate } from "drizzle-orm/mysql2/migrator";
import { drizzle } from "drizzle-orm/mysql2";
import { createPool } from "mysql2";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic } from "./serve-static";
import { registerStripeWebhook, processAllMonthlyRefills } from "../stripe-router";
import { registerDownloadRoute } from "../download-gate";
import { registerApiRoutes } from "../api-access-router";
import { registerV5ApiRoutes } from "../v5-features-router";
import { registerEmailAuthRoutes } from "../email-auth-router";
import { registerReleaseUploadRoute, registerUpdateFeedRoutes, registerGitHubSyncRoute } from "../releases-router";
import { registerVoiceUploadRoute, registerVoiceTTSRoute, registerVoiceTempRoute } from "../voice-router";
import { registerSocialAuthRoutes } from "../social-auth-router";
import { startScheduledDiscovery } from "../affiliate-discovery-engine";
import { startScheduledSignups } from "../affiliate-signup-engine";
import { runOptimizationCycleV2 } from "../affiliate-engine-v2";
import { seedMarketplaceWithMerchants as seedMarketplace } from "../marketplace-seed";
import { updateCampaignImages } from "../crowdfunding-aggregator";
import { updateCampaign, listCampaigns } from "../db";
import { startAdvertisingScheduler } from "../advertising-orchestrator";
import { startMasterOrchestrator } from "../master-growth-orchestrator";
import { startModuleGeneratorScheduler } from "../module-generator-engine";
import { startBusinessModuleGeneratorScheduler } from "../business-module-generator";
import { startSecuritySweepScheduler } from "../security-hardening";
import { startFortressSweepScheduler } from "../security-fortress";
import { registerBinancePayWebhook } from "../binance-pay-webhook";
import { registerStorageWebhook } from "../storage-billing-router";
import { registerStorageUploadRoutes } from "../storage-upload-handler";
import { registerSeoRoutes, startScheduledSeo } from "../seo-engine";
import { registerSeoV4Routes, runGeoOptimization } from "../seo-engine-v4";
import { runStartupDiagnostic, registerIndexNowRoute, patchIndexNowKey, startPeriodicSync } from "../autonomous-sync";
import { registerChatStreamRoutes } from "../chat-stream";
import { registerContentStreamRoutes } from "../content-stream";
import { registerChatUploadRoute } from "../chat-upload";
import { registerProjectDownloadRoutes } from "../project-download-router";
import { registerMarketplaceFileRoutes } from "../marketplace-files";
import { registerBundleSyncRoutes } from "../bundle-sync";
import { runHealthCheck, createSnapshot } from "../self-improvement-engine";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";
import compression from "compression";
import { csrfCookieMiddleware, csrfValidationMiddleware } from "./csrf";
import { correlationMiddleware } from "./correlation";
import { createLogger } from "./logger";
import helmet from "helmet";
import { getErrorMessage } from "../_core/errors.js";

const log = createLogger('Startup');

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
  // ── Required env var guard — fail hard before anything else ──────────────
  const missingRequired: string[] = [];
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    missingRequired.push('JWT_SECRET (must be at least 32 characters)');
  }
  if (!process.env.DATABASE_URL) {
    missingRequired.push('DATABASE_URL');
  }
  if (missingRequired.length > 0) {
    console.error('[FATAL] Missing or invalid required environment variables:');
    for (const v of missingRequired) console.error(`  - ${v}`);
    console.error('Server cannot start safely. Set the required variables and restart.');
    process.exit(1);
  }
  // ─────────────────────────────────────────────────────────────────────────

  const app = express();
  // Trust proxy headers (Railway uses a single reverse proxy layer)
  // Use number 1 instead of true to prevent express-rate-limit ERR_ERL_PERMISSIVE_TRUST_PROXY
  app.set("trust proxy", 1);
  const server = createServer(app);

  // ── Non-WWW to WWW Redirect ────────────────────────────────────
  // MUST be first middleware: archibaldtitan.com → www.archibaldtitan.com
  // Prevents OAuth cookie domain mismatches and ensures consistent URLs
  app.use((req, res, next) => {
    const host = req.hostname || req.headers.host || '';
    // Only redirect in production, and only for the bare domain (no www)
    if (process.env.NODE_ENV === 'production' && host === 'archibaldtitan.com') {
      const proto = req.headers['x-forwarded-proto'] || req.protocol || 'https';
      return res.redirect(301, `${proto}://www.archibaldtitan.com${req.originalUrl}`);
    }
    next();
  });

  // ── Helmet Security Headers ────────────────────────────────────
  app.use(helmet({ contentSecurityPolicy: false })); // CSP is handled manually below

  // ── Security Headers ──────────────────────────────────────────
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(self), geolocation=()');
    // HSTS: enforce HTTPS for 1 year, include subdomains, allow preload submission
    if (process.env.NODE_ENV === 'production') {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    }
    // Content-Security-Policy: restrict resource loading to trusted origins
    const csp = [
      "default-src 'self'",
      // 'unsafe-eval' removed — no longer required by the Vite production bundle.
      // 'unsafe-inline' retained for Stripe.js and GTM inline event handlers; replace with nonces in a future hardening pass.
      "script-src 'self' 'unsafe-inline' https://js.stripe.com https://www.googletagmanager.com https://www.google-analytics.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "worker-src 'self' blob:",
      "manifest-src 'self'",
      "font-src 'self' https://fonts.gstatic.com data:",
      "img-src 'self' data: blob: https: http:",
      "connect-src 'self' https://api.stripe.com https://*.google-analytics.com https://*.analytics.google.com https://files.manuscdn.com wss: ws:",
      "media-src 'self' https://files.manuscdn.com blob: data:",
      "frame-src 'self' https://js.stripe.com https://hooks.stripe.com",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'self'",
      "upgrade-insecure-requests",
    ].join('; ');
    res.setHeader('Content-Security-Policy', csp);
    // Prevent DNS prefetch to third parties
    res.setHeader('X-DNS-Prefetch-Control', 'off');
    // Prevent MIME type sniffing for downloads
    res.setHeader('X-Download-Options', 'noopen');
    // Prevent cross-origin embedder policy issues
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    next();
  });

  // ── Rate Limiting ─────────────────────────────────────────────
  // General API rate limit: 200 requests per minute per IP
  const apiLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests. Please slow down and try again shortly.' },
    skip: (req: import('express').Request) => req.path === '/api/health',
  });
  app.use('/api/', apiLimiter);

  // Stricter limit for auth endpoints: 20 per minute per IP
  const authLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many authentication attempts. Please wait a moment.' },
  });
  app.use('/api/auth/', authLimiter);
  app.use('/api/email-auth/', authLimiter);
  app.use('/api/social-auth/', authLimiter);

  // Chat streaming limit: 30 per minute per IP (prevents abuse of AI credits)
  const chatLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Chat rate limit reached. Please wait before sending more messages.' },
  });
  app.use('/api/chat/', chatLimiter);

  // Stripe checkout limit: 10 per minute per IP (prevents checkout abuse)
  const stripeLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many checkout attempts. Please wait a moment.' },
  });
  app.use('/api/trpc/stripe.', stripeLimiter);
  // Offensive/admin tool endpoints: 15 per minute per IP (prevents abuse)
  const offensiveLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 15,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests to this endpoint. Please slow down.' },
  });
  for (const path of ['evilginx', 'metasploit', 'blackeye', 'exploitpack', 'cyberMcp', 'linkenSphere', 'torProxy', 'vpnChain', 'proxyMaker', 'ipRotation', 'isolatedBrowser', 'argus', 'astra', 'siem']) {
    app.use(`/api/trpc/${path}.`, offensiveLimiter);
  }

  // File upload limit: 20 per minute per IP
  const uploadLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many upload attempts. Please wait.' },
  });
  app.use('/api/chat/upload', uploadLimiter);
  app.use('/api/marketplace/upload', uploadLimiter);
  app.use('/api/releases/upload', uploadLimiter);

  // Download limit: 30 per minute per IP (prevents scraping)
  const downloadLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Download rate limit reached. Please wait.' },
  });
  app.use('/api/download/', downloadLimiter);
  app.use('/api/desktop/bundle', downloadLimiter);

  // Stripe webhook MUST be registered BEFORE express.json() for raw body access
  registerStripeWebhook(app);
  // Binance Pay webhook (also before express.json for raw body)
  registerBinancePayWebhook(app);
  // Titan Storage billing webhook (also before express.json for raw body)
  registerStorageWebhook(app);

  // ── Gzip/Brotli Compression ─────────────────────────────────
  // Compress all responses except those that are already compressed
  app.use(compression());

  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // ── Request Correlation IDs ───────────────────────────────────
  app.use(correlationMiddleware);

  // ── Cookie Parser & CSRF Protection ───────────────────────────
  app.use(cookieParser());
  app.use(csrfCookieMiddleware);
  app.use('/api/', csrfValidationMiddleware);
  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);
  // Email/password authentication endpoints
  registerEmailAuthRoutes(app);
  // Independent GitHub & Google OAuth (no Manus proxy)
  registerSocialAuthRoutes(app);
  // CSRF token primer endpoint — called by the client on app startup to ensure the CSRF cookie
  // is set before any tRPC POST requests fire. Critical for Safari iOS after OAuth redirects.
  // The csrfCookieMiddleware above already set the cookie; this just returns the value.
  app.get('/api/csrf-token', (req, res) => {
    const token = req.cookies?.['csrf_token'] || '';
    res.json({ token });
  });

  // Health check endpoint (for Railway, load balancers, etc.)
  app.get('/api/health', async (_req, res) => {
    const health: Record<string, unknown> = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
      memory: {
        rss: Math.round(process.memoryUsage().rss / 1024 / 1024),
        heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      },
    };
    // Check database connectivity
    try {
      const { getDb } = await import('../db.js');
      const db = await getDb();
      if (db) {
        const { sql } = await import('drizzle-orm');
        await db.execute(sql`SELECT 1`);
        health.database = 'connected';
      } else {
        health.database = 'unavailable';
        health.status = 'degraded';
      }
    } catch (dbErr: unknown) {
      health.database = 'error';
      health.status = 'degraded';
      // Sanitize error message to avoid leaking connection string or credentials
      const rawDbErr = getErrorMessage(dbErr);
      health.dbError = rawDbErr.replace(/mysql:\/\/[^@]*@[^\s/]*/gi, 'mysql://***@***').replace(/password=[^&\s]*/gi, 'password=***');
    }
    // Check new builder tools are loadable
    const toolChecks: Record<string, string> = {};

    // pdfkit (generate_pdf)
    try {
      const PDFDocument = (await import('pdfkit')).default;
      const doc = new PDFDocument({ autoFirstPage: false });
      doc.addPage();
      doc.end();
      toolChecks.pdfkit = 'ok';
    } catch (e: unknown) {
      toolChecks.pdfkit = `error: ${getErrorMessage(e)}`;
      health.status = 'degraded';
    }

    // exceljs (generate_spreadsheet)
    try {
      const ExcelJS = (await import('exceljs')).default;
      const wb = new ExcelJS.Workbook();
      wb.addWorksheet('test');
      toolChecks.exceljs = 'ok';
    } catch (e: unknown) {
      toolChecks.exceljs = `error: ${getErrorMessage(e)}`;
      health.status = 'degraded';
    }

    // playwright (web_screenshot)
    try {
      const { chromium } = await import('playwright');
      // Just check the module loads — don't launch a browser in health check
      if (chromium) toolChecks.playwright = 'ok';
    } catch (e: unknown) {
      // Playwright not installed — non-fatal, web_screenshot will fall back gracefully
      toolChecks.playwright = `unavailable: ${getErrorMessage(e)}`;
    }

    // sharp / canvas (generate_diagram)
    try {
      const { execSync } = await import('child_process');
      execSync('node -e "require(\"canvas\")"', { timeout: 3000, stdio: 'ignore' });
      toolChecks.canvas = 'ok';
    } catch (_e: unknown) {
      toolChecks.canvas = 'unavailable (diagram fallback active)';
    }

    health.builderTools = toolChecks;

    // Check LLM provider availability (no API call — just check key presence)
    try {
      const { hasKeys } = await import('./key-pool.js');
      const veniceKeySet = !!process.env.VENICE_API_KEY;
      const openaiKeysSet = hasKeys() || !!process.env.OPENAI_API_KEY;
      if (veniceKeySet) {
        health.llm = 'venice-primary';
      } else if (openaiKeysSet) {
        health.llm = 'openai-primary';
      } else {
        health.llm = 'no-key-configured';
        health.status = 'degraded';
      }
    } catch {
      health.llm = 'unknown';
    }

    const statusCode = health.status === 'ok' ? 200 : 503;
    res.status(statusCode).json(health);
  });
  // ── Deep Diagnostic Endpoint ─────────────────────────────────
  // Tests database, LLM API, key pool, and environment config
  // SECURITY: restricted to admin and head_admin roles only
  app.get('/api/diagnose', async (req, res) => {
    try {
      const { sdk } = await import('./sdk.js');
      const user = await sdk.authenticateRequest(req);
      if (user.role !== 'admin' && user.role !== 'head_admin') {
        res.status(403).json({ error: 'Forbidden: admin access required' });
        return;
      }
    } catch {
      res.status(401).json({ error: 'Unauthorized: valid session required' });
      return;
    }
    const diag: Record<string, unknown> = {
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
      nodeEnv: process.env.NODE_ENV || 'not set',
    };

    // 1. Check environment variables
    const envVars = [
      'DATABASE_URL', 'OPENAI_API_KEY', 'OPENAI_API_KEY_1', 'OPENAI_API_KEY_2',
      'OPENAI_API_KEY_3', 'OPENAI_API_KEY_4', 'OPENAI_API_KEY_5',
      'VENICE_API_KEY', 'TITAN_API_URL',
    ];
    diag.envVars = {};
    for (const v of envVars) {
      const val = process.env[v];
      (diag.envVars as Record<string, string>)[v] = val
        ? `set (${val.length} chars, ends: ...${val.slice(-4)})`
        : 'NOT SET';
    }

    // 2. Check database
    try {
      const { getDb } = await import('../db.js');
      const db = await getDb();
      if (db) {
        const { sql } = await import('drizzle-orm');
        await db.execute(sql`SELECT 1`);
        diag.database = 'connected';
      } else {
        diag.database = 'getDb returned null';
      }
    } catch (dbErr: unknown) {
      diag.database = `error: ${getErrorMessage(dbErr)}`;
    }

    // 3. Check LLM key pool
    try {
      const { initKeyPool, getKeyPoolStatus, hasKeys } = await import('./key-pool.js');
      initKeyPool();
      diag.llmHasKeys = hasKeys();
      diag.keyPoolStatus = getKeyPoolStatus();
    } catch (kpErr: unknown) {
      diag.keyPool = `error: ${getErrorMessage(kpErr)}`;
    }

    // 4. Test actual LLM call with a tiny request
    try {
      const { invokeLLM } = await import('./llm.js');
      const testResult = await invokeLLM({
        priority: 'chat',
        model: 'fast',
        messages: [{ role: 'user', content: 'Say OK' }],
        max_tokens: 5,
        temperature: 0,
      });
      const reply = testResult.choices?.[0]?.message?.content || 'no content';
      diag.llmTest = { status: 'success', reply: typeof reply === 'string' ? reply.slice(0, 50) : 'non-string', model: testResult.model };
    } catch (llmErr: unknown) {
      diag.llmTest = { status: 'error', error: getErrorMessage(llmErr) };
    }

    // 5. Recent chat errors (in-memory log)
    try {
      const { recentChatErrors } = await import('../chat-router.js');
      diag.recentChatErrors = recentChatErrors;
    } catch {
      diag.recentChatErrors = 'unavailable';
    }

    res.json(diag);
  });

  // SEO routes (sitemap.xml, robots.txt, security.txt, RSS feed, structured data, redirects)
  registerSeoRoutes(app);
  // SEO v4 routes (llms.txt, programmatic SEO, enhanced structured data, GEO optimization)
  registerSeoV4Routes(app);
  // Autonomous sync: IndexNow verification route + auto-generated key
  patchIndexNowKey();
  registerIndexNowRoute(app);
  // Affiliate v2 cloaked redirect: /go/{partner-slug}
  app.get('/go/:slug', async (req, res) => {
    try {
      const { handleAffiliateRedirect } = await import('../affiliate-engine-v2.js');
      const result = await handleAffiliateRedirect(req.params.slug, {
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        referrer: req.headers['referer'],
      });
      if (result) {
        res.redirect(302, result.redirectUrl);
      } else {
        res.redirect(302, 'https://www.archibaldtitan.com');
      }
    } catch {
      res.redirect(302, 'https://www.archibaldtitan.com');
    }
  });
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
  // GitHub release sync webhook endpoint
  registerGitHubSyncRoute(app);
  // Desktop bundle sync — serves latest web client for auto-sync
  registerBundleSyncRoutes(app);
  // Voice temp audio serve endpoint (for transcription without S3)
  registerVoiceTempRoute(app);
  // Voice audio upload endpoint
  registerVoiceUploadRoute(app);
  // Voice text-to-speech endpoint
  registerVoiceTTSRoute(app);
  // Marketplace file upload/download endpoints
  registerMarketplaceFileRoutes(app);
  // Chat file upload endpoint
  registerChatUploadRoute(app);
  // Titan Storage — file upload and download endpoints
  registerStorageUploadRoutes(app);
  // Project file download (single + ZIP batch)
  registerProjectDownloadRoutes(app);
  // Chat SSE streaming and abort endpoints
  registerChatStreamRoutes(app);
  registerContentStreamRoutes(app);
  // Security Tool SSE streaming (Evilginx, BlackEye, Metasploit, ExploitPack)
  const { registerSecurityStreamRoutes } = await import('../security-stream.js');
  registerSecurityStreamRoutes(app);
  // Isolated Browser SSE screenshot stream
  const { registerIsolatedBrowserSSE } = await import('../isolated-browser-router.js');
  registerIsolatedBrowserSSE(app);
  // CyberMCP full scan SSE streaming (real-time progress per check)
  const { registerCyberMcpStreamRoutes } = await import('../cybermcp-stream.js');
  registerCyberMcpStreamRoutes(app);
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
    // Dynamic import: setupVite depends on 'vite' (devDependency) which is not
    // available in production. By using dynamic import here, esbuild won't
    // include vite.ts's setupVite branch in the production bundle.
    const { setupVite } = await import("./vite.js");
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ── Global Error Handler (must be last middleware) ──
  // Catches unhandled errors from Express routes and prevents stack trace leakage
  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    log.error('Unhandled Express error', { error: err.message, stack: err.stack });
    const isProd = process.env.NODE_ENV === 'production';
    res.status(500).json({
      error: isProd ? 'Internal server error' : err.message,
      ...(isProd ? {} : { stack: err.stack }),
    });
  });

  // ─── Auto-migrate database on startup ──────────────────────────
  if (process.env.DATABASE_URL) {
    const pool = createPool({
      uri: process.env.DATABASE_URL,
      waitForConnections: true,
      connectionLimit: 2,
      connectTimeout: 30000,
    });
    // Step 1: Try Drizzle migrations (may fail if journal is out of sync)
    try {
      log.info('Running database migrations...');
      const migrationDb = drizzle(pool);
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = path.dirname(__filename);
      const migrationsFolder = process.env.NODE_ENV === "production"
        ? path.resolve(__dirname, "..", "drizzle")
        : path.resolve(__dirname, "..", "..", "drizzle");
      log.debug('Migrations folder', { path: migrationsFolder });
      await migrate(migrationDb, { migrationsFolder });
      log.info('Database migrations completed');
    } catch (migErr: unknown) {
      log.warn('Drizzle migration warning (continuing with raw SQL)', { error: getErrorMessage(migErr)?.substring(0, 200) });
    }
    // Step 2: Always run raw SQL to ensure columns and tables exist (idempotent)
    try {

      // Safely add any missing columns that migrations may have missed
      const missingColumns = [
        // crowdfundingCampaigns columns
        "ALTER TABLE `crowdfundingCampaigns` ADD COLUMN `source` enum('internal','kickstarter','indiegogo','gofundme','other') DEFAULT 'internal' NOT NULL",
        "ALTER TABLE `crowdfundingCampaigns` ADD COLUMN `externalId` varchar(255)",
        "ALTER TABLE `crowdfundingCampaigns` ADD COLUMN `externalUrl` varchar(500)",
        "ALTER TABLE `crowdfundingCampaigns` ADD COLUMN `creatorName` varchar(255)",
        "ALTER TABLE `crowdfundingCampaigns` ADD COLUMN `location` varchar(255)",
        "ALTER TABLE `crowdfundingCampaigns` ADD COLUMN `percentFunded` int DEFAULT 0",
        "ALTER TABLE `crowdfundingCampaigns` ADD COLUMN `daysLeft` int",
        "ALTER TABLE `crowdfundingCampaigns` ADD COLUMN `subcategory` varchar(100)",
        "ALTER TABLE `crowdfundingCampaigns` ADD COLUMN `tags` json",
        "ALTER TABLE `crowdfundingCampaigns` ADD COLUMN `creatorAvatarUrl` varchar(500)",
        // CRITICAL: users table trial/marketing/payment columns (login loop fix)
        "ALTER TABLE `users` ADD COLUMN `marketingConsent` boolean NOT NULL DEFAULT true",
        "ALTER TABLE `users` ADD COLUMN `loginCount` int NOT NULL DEFAULT 0",
        "ALTER TABLE `users` ADD COLUMN `trialStartedAt` datetime NULL",
        "ALTER TABLE `users` ADD COLUMN `trialEndsAt` datetime NULL",
        "ALTER TABLE `users` ADD COLUMN `trialConvertedAt` datetime NULL",
        "ALTER TABLE `users` ADD COLUMN `hasPaymentMethod` boolean NOT NULL DEFAULT false",
        "ALTER TABLE `users` ADD COLUMN `stripeCustomerId` varchar(128) NULL",
        // Titan Referral Unlock columns
        "ALTER TABLE `users` ADD COLUMN `titanUnlockExpiry` datetime NULL",
        "ALTER TABLE `users` ADD COLUMN `titanUnlockGrantedBy` int NULL",
        // Custom Instructions column (added for persistent user rules feature)
        "ALTER TABLE `users` ADD COLUMN `customInstructions` text NULL",
        // seller_profiles subscription columns
        "ALTER TABLE `seller_profiles` ADD COLUMN `sellerSubscriptionActive` boolean NOT NULL DEFAULT false",
        "ALTER TABLE `seller_profiles` ADD COLUMN `sellerSubscriptionExpiresAt` datetime NULL",
        "ALTER TABLE `seller_profiles` ADD COLUMN `sellerSubscriptionPaidAt` datetime NULL",
        "ALTER TABLE `seller_profiles` ADD COLUMN `sellerSubscriptionStripeId` varchar(128) NULL",
        "ALTER TABLE `seller_profiles` ADD COLUMN `totalPlatformFeesPaid` int NOT NULL DEFAULT 0",
        // marketplace_listings anti-resale columns
        "ALTER TABLE `marketplace_listings` ADD COLUMN `fileHash` varchar(128) NULL",
        "ALTER TABLE `marketplace_listings` ADD COLUMN `originalListingId` int NULL",
        // Security hardening: audit_logs category column for security event filtering
        "ALTER TABLE `audit_logs` ADD COLUMN `category` varchar(64) DEFAULT 'general' NOT NULL",
        // Security hardening: audit_logs severity column for triage
        "ALTER TABLE `audit_logs` ADD COLUMN `severity` varchar(16) DEFAULT 'low'",
        // sandbox_files: track which conversation/project each file belongs to
        "ALTER TABLE `sandbox_files` ADD COLUMN `conversationId` int NULL",
        "ALTER TABLE `sandbox_files` ADD COLUMN `projectName` varchar(255) NULL",
        // chat_conversations: cross-conversation build memory (build context)
        "ALTER TABLE `chat_conversations` ADD COLUMN `buildContext` JSON NULL",
        // releases: Android download URL and file size (added in v8+)
        "ALTER TABLE `releases` ADD COLUMN `downloadUrlAndroid` text NULL",
        "ALTER TABLE `releases` ADD COLUMN `fileSizeAndroid` int NULL",
      ];
      for (const sql of missingColumns) {
        try {
          await pool.promise().query(sql);
          log.debug('Added column', { column: sql.split('\`')[3] });
        } catch (e: unknown) {
          // Column already exists - ignore
          if (!getErrorMessage(e)?.includes('Duplicate column')) {
            log.warn('Column fix warning', { error: getErrorMessage(e) });
          }
        }
      }
      // Fix source column type if it was created as VARCHAR instead of ENUM
      try {
        await pool.promise().query(
          "ALTER TABLE `crowdfundingCampaigns` MODIFY COLUMN `source` enum('internal','kickstarter','indiegogo','gofundme','other') DEFAULT 'internal' NOT NULL"
        );
        log.debug('Ensured source column is ENUM type');
      } catch (e: unknown) {
        log.warn('Source column fix', { error: getErrorMessage(e)?.substring(0, 100) });
      }

      // Create marketplace tables if they don't exist
      const createTables = [
        `CREATE TABLE IF NOT EXISTS \`marketplace_listings\` (\`id\` int AUTO_INCREMENT NOT NULL, \`uid\` varchar(64) NOT NULL, \`sellerId\` int NOT NULL, \`title\` varchar(256) NOT NULL, \`slug\` varchar(300) NOT NULL, \`description\` text NOT NULL, \`longDescription\` text, \`category\` enum('agents','modules','blueprints','artifacts','exploits','templates','datasets','other') NOT NULL DEFAULT 'modules', \`riskCategory\` enum('safe','low_risk','medium_risk','high_risk') NOT NULL DEFAULT 'safe', \`reviewStatus\` enum('pending_review','approved','rejected','flagged') NOT NULL DEFAULT 'pending_review', \`reviewNotes\` text, \`status\` enum('draft','active','paused','sold_out','removed') NOT NULL DEFAULT 'draft', \`priceCredits\` int NOT NULL, \`priceUsd\` int NOT NULL DEFAULT 0, \`currency\` varchar(8) NOT NULL DEFAULT 'USD', \`fileUrl\` text, \`fileSize\` int, \`fileType\` varchar(64), \`previewUrl\` text, \`thumbnailUrl\` text, \`demoUrl\` text, \`tags\` text, \`language\` varchar(64), \`license\` varchar(64) DEFAULT 'MIT', \`version\` varchar(32) DEFAULT '1.0.0', \`totalSales\` int NOT NULL DEFAULT 0, \`totalRevenue\` int NOT NULL DEFAULT 0, \`viewCount\` int NOT NULL DEFAULT 0, \`downloadCount\` int NOT NULL DEFAULT 0, \`avgRating\` int NOT NULL DEFAULT 0, \`ratingCount\` int NOT NULL DEFAULT 0, \`featured\` boolean NOT NULL DEFAULT false, \`createdAt\` timestamp NOT NULL DEFAULT (now()), \`updatedAt\` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP, CONSTRAINT \`marketplace_listings_id\` PRIMARY KEY(\`id\`), CONSTRAINT \`marketplace_listings_uid_unique\` UNIQUE(\`uid\`), CONSTRAINT \`marketplace_listings_slug_unique\` UNIQUE(\`slug\`))`,
        `CREATE TABLE IF NOT EXISTS \`marketplace_purchases\` (\`id\` int AUTO_INCREMENT NOT NULL, \`uid\` varchar(64) NOT NULL, \`buyerId\` int NOT NULL, \`listingId\` int NOT NULL, \`sellerId\` int NOT NULL, \`priceCredits\` int NOT NULL, \`priceUsd\` int NOT NULL DEFAULT 0, \`status\` enum('completed','refunded','disputed') NOT NULL DEFAULT 'completed', \`downloadCount\` int NOT NULL DEFAULT 0, \`maxDownloads\` int NOT NULL DEFAULT 5, \`downloadToken\` varchar(128), \`hasReviewed\` boolean NOT NULL DEFAULT false, \`createdAt\` timestamp NOT NULL DEFAULT (now()), CONSTRAINT \`marketplace_purchases_id\` PRIMARY KEY(\`id\`), CONSTRAINT \`marketplace_purchases_uid_unique\` UNIQUE(\`uid\`))`,
        `CREATE TABLE IF NOT EXISTS \`marketplace_reviews\` (\`id\` int AUTO_INCREMENT NOT NULL, \`listingId\` int NOT NULL, \`purchaseId\` int NOT NULL, \`reviewerId\` int NOT NULL, \`rating\` int NOT NULL, \`title\` varchar(256), \`comment\` text, \`sellerRating\` int, \`helpful\` int NOT NULL DEFAULT 0, \`createdAt\` timestamp NOT NULL DEFAULT (now()), \`updatedAt\` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP, CONSTRAINT \`marketplace_reviews_id\` PRIMARY KEY(\`id\`))`,
        `CREATE TABLE IF NOT EXISTS \`seller_profiles\` (\`id\` int AUTO_INCREMENT NOT NULL, \`userId\` int NOT NULL, \`displayName\` varchar(128) NOT NULL, \`bio\` text, \`avatarUrl\` text, \`totalSales\` int NOT NULL DEFAULT 0, \`totalRevenue\` int NOT NULL DEFAULT 0, \`avgRating\` int NOT NULL DEFAULT 0, \`ratingCount\` int NOT NULL DEFAULT 0, \`verified\` boolean NOT NULL DEFAULT false, \`createdAt\` timestamp NOT NULL DEFAULT (now()), \`updatedAt\` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP, CONSTRAINT \`seller_profiles_id\` PRIMARY KEY(\`id\`), CONSTRAINT \`seller_profiles_userId_unique\` UNIQUE(\`userId\`))`,
        `CREATE TABLE IF NOT EXISTS \`crypto_payments\` (\`id\` int AUTO_INCREMENT NOT NULL, \`userId\` int, \`campaignId\` int NOT NULL, \`contributionId\` int, \`merchantTradeNo\` varchar(64) NOT NULL, \`binancePrepayId\` varchar(128), \`status\` varchar(32) NOT NULL DEFAULT 'pending', \`fiatAmount\` varchar(32) NOT NULL, \`fiatCurrency\` varchar(8) NOT NULL DEFAULT 'USD', \`cryptoCurrency\` varchar(16), \`cryptoAmount\` varchar(64), \`platformFee\` varchar(32) NOT NULL DEFAULT '0', \`creatorAmount\` varchar(32) NOT NULL DEFAULT '0', \`checkoutUrl\` text, \`qrcodeLink\` text, \`donorName\` varchar(128), \`donorEmail\` varchar(256), \`donorMessage\` text, \`webhookData\` text, \`paidAt\` timestamp, \`expiresAt\` timestamp, \`createdAt\` timestamp NOT NULL DEFAULT (now()), \`updatedAt\` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP, CONSTRAINT \`crypto_payments_id\` PRIMARY KEY(\`id\`), CONSTRAINT \`crypto_payments_merchantTradeNo_unique\` UNIQUE(\`merchantTradeNo\`))`,
        `CREATE TABLE IF NOT EXISTS \`seller_payout_methods\` (\`id\` int AUTO_INCREMENT NOT NULL, \`sellerId\` int NOT NULL, \`userId\` int NOT NULL, \`methodType\` enum('bank_transfer','paypal','stripe_connect') NOT NULL, \`isDefault\` boolean NOT NULL DEFAULT false, \`bankBsb\` varchar(16), \`bankAccountNumber\` varchar(32), \`bankAccountName\` varchar(128), \`bankName\` varchar(128), \`bankCountry\` varchar(64), \`bankSwiftBic\` varchar(16), \`paypalEmail\` varchar(320), \`stripeConnectAccountId\` varchar(128), \`stripeConnectOnboarded\` boolean NOT NULL DEFAULT false, \`verified\` boolean NOT NULL DEFAULT false, \`status\` enum('active','pending_verification','disabled') NOT NULL DEFAULT 'pending_verification', \`label\` varchar(128), \`createdAt\` timestamp NOT NULL DEFAULT (now()), \`updatedAt\` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP, CONSTRAINT \`seller_payout_methods_id\` PRIMARY KEY(\`id\`))`,
        `CREATE TABLE IF NOT EXISTS \`user_secrets\` (\`id\` int AUTO_INCREMENT NOT NULL, \`userId\` int NOT NULL, \`secretType\` varchar(64) NOT NULL, \`encryptedValue\` text NOT NULL, \`label\` varchar(128), \`lastUsedAt\` timestamp, \`createdAt\` timestamp NOT NULL DEFAULT (now()), \`updatedAt\` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP, CONSTRAINT \`user_secrets_id\` PRIMARY KEY(\`id\`))`,
        `CREATE TABLE IF NOT EXISTS \`platform_revenue\` (\`id\` int AUTO_INCREMENT NOT NULL, \`source\` varchar(64) NOT NULL, \`sourceId\` varchar(128), \`type\` varchar(64) NOT NULL, \`amount\` varchar(32) NOT NULL, \`currency\` varchar(8) NOT NULL DEFAULT 'USD', \`description\` text, \`metadata\` text, \`createdAt\` timestamp NOT NULL DEFAULT (now()), CONSTRAINT \`platform_revenue_id\` PRIMARY KEY(\`id\`))`,
        `CREATE TABLE IF NOT EXISTS \`credit_balances\` (\`id\` int AUTO_INCREMENT NOT NULL, \`userId\` int NOT NULL, \`credits\` int NOT NULL DEFAULT 0, \`lifetimeCreditsUsed\` int NOT NULL DEFAULT 0, \`lifetimeCreditsAdded\` int NOT NULL DEFAULT 0, \`isUnlimited\` boolean NOT NULL DEFAULT false, \`lastRefillAt\` timestamp NULL, \`lastLoginBonusAt\` timestamp NULL, \`loginBonusThisMonth\` int NOT NULL DEFAULT 0, \`createdAt\` timestamp NOT NULL DEFAULT (now()), \`updatedAt\` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP, CONSTRAINT \`credit_balances_id\` PRIMARY KEY(\`id\`), CONSTRAINT \`credit_balances_userId_unique\` UNIQUE(\`userId\`))`,
        `CREATE TABLE IF NOT EXISTS \`chat_uploads\` (\`id\` int AUTO_INCREMENT NOT NULL, \`userId\` int NOT NULL, \`fileKey\` varchar(128) NOT NULL, \`fileName\` varchar(256), \`mimeType\` varchar(128) NOT NULL DEFAULT 'application/octet-stream', \`fileSize\` int NOT NULL DEFAULT 0, \`data\` mediumblob NOT NULL, \`createdAt\` timestamp NOT NULL DEFAULT (now()), CONSTRAINT \`chat_uploads_id\` PRIMARY KEY(\`id\`), CONSTRAINT \`chat_uploads_fileKey_unique\` UNIQUE(\`fileKey\`))`,
        `CREATE TABLE IF NOT EXISTS \`crowdfundingComments\` (\`id\` int AUTO_INCREMENT NOT NULL, \`campaignId\` int NOT NULL, \`userId\` int NOT NULL, \`content\` text NOT NULL, \`parentId\` int, \`createdAt\` timestamp NOT NULL DEFAULT (now()), CONSTRAINT \`crowdfundingComments_id\` PRIMARY KEY(\`id\`))`,
        `CREATE TABLE IF NOT EXISTS \`credit_transactions\` (\`id\` int AUTO_INCREMENT NOT NULL, \`userId\` int NOT NULL, \`amount\` int NOT NULL, \`type\` enum('signup_bonus','monthly_refill','pack_purchase','admin_adjustment','chat_message','builder_action','voice_action','referral_bonus','marketplace_purchase','marketplace_sale','marketplace_refund','marketplace_seller_fee','marketplace_seller_renewal','marketplace_feature','marketplace_boost','marketplace_verification','daily_login_bonus') NOT NULL, \`description\` text, \`balanceAfter\` int NOT NULL, \`stripePaymentIntentId\` varchar(256), \`createdAt\` timestamp NOT NULL DEFAULT (now()), CONSTRAINT \`credit_transactions_id\` PRIMARY KEY(\`id\`))`,
        // Content Creator System tables
        `CREATE TABLE IF NOT EXISTS \`content_creator_campaigns\` (\`id\` int AUTO_INCREMENT NOT NULL, \`name\` varchar(255) NOT NULL, \`objective\` varchar(100) NOT NULL DEFAULT 'brand_awareness', \`description\` text, \`targetAudience\` text, \`brandVoice\` varchar(100) NOT NULL DEFAULT 'confident', \`primaryKeywords\` json, \`platforms\` json NOT NULL, \`status\` enum('draft','active','paused','completed','archived') NOT NULL DEFAULT 'draft', \`startDate\` timestamp NULL, \`endDate\` timestamp NULL, \`totalPieces\` int NOT NULL DEFAULT 0, \`publishedPieces\` int NOT NULL DEFAULT 0, \`totalImpressions\` int NOT NULL DEFAULT 0, \`totalClicks\` int NOT NULL DEFAULT 0, \`totalEngagements\` int NOT NULL DEFAULT 0, \`seoLinked\` boolean NOT NULL DEFAULT false, \`advertisingLinked\` boolean NOT NULL DEFAULT false, \`tiktokLinked\` boolean NOT NULL DEFAULT false, \`aiStrategy\` text, \`createdAt\` timestamp NOT NULL DEFAULT (now()), \`updatedAt\` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP, CONSTRAINT \`content_creator_campaigns_id\` PRIMARY KEY(\`id\`))`,
        `CREATE TABLE IF NOT EXISTS \`content_creator_pieces\` (\`id\` int AUTO_INCREMENT NOT NULL, \`campaignId\` int, \`platform\` varchar(64) NOT NULL, \`contentType\` varchar(64) NOT NULL, \`title\` varchar(500), \`headline\` varchar(500), \`body\` text NOT NULL, \`callToAction\` varchar(500), \`hashtags\` json, \`hook\` text, \`videoScript\` text, \`visualDirections\` json, \`seoKeywords\` json, \`imagePrompt\` text, \`mediaUrl\` text, \`seoScore\` int NOT NULL DEFAULT 0, \`qualityScore\` int NOT NULL DEFAULT 0, \`status\` enum('draft','review','approved','scheduled','published','failed','archived') NOT NULL DEFAULT 'draft', \`scheduledAt\` timestamp NULL, \`publishedAt\` timestamp NULL, \`tiktokPublishId\` varchar(255), \`externalPostId\` varchar(255), \`impressions\` int NOT NULL DEFAULT 0, \`clicks\` int NOT NULL DEFAULT 0, \`engagements\` int NOT NULL DEFAULT 0, \`shares\` int NOT NULL DEFAULT 0, \`saves\` int NOT NULL DEFAULT 0, \`videoViews\` int NOT NULL DEFAULT 0, \`aiPrompt\` text, \`aiModel\` varchar(64), \`generationMs\` int, \`createdAt\` timestamp NOT NULL DEFAULT (now()), \`updatedAt\` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP, CONSTRAINT \`content_creator_pieces_id\` PRIMARY KEY(\`id\`))`,
        `CREATE TABLE IF NOT EXISTS \`content_creator_schedules\` (\`id\` int AUTO_INCREMENT NOT NULL, \`pieceId\` int NOT NULL, \`campaignId\` int, \`platform\` varchar(64) NOT NULL DEFAULT 'tiktok', \`scheduledAt\` timestamp NOT NULL, \`status\` enum('pending','processing','published','failed','cancelled') NOT NULL DEFAULT 'pending', \`publishedAt\` timestamp NULL, \`error\` text, \`retryCount\` int NOT NULL DEFAULT 0, \`createdAt\` timestamp NOT NULL DEFAULT (now()), \`updatedAt\` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP, CONSTRAINT \`content_creator_schedules_id\` PRIMARY KEY(\`id\`))`,
        `CREATE TABLE IF NOT EXISTS \`content_creator_analytics\` (\`id\` int AUTO_INCREMENT NOT NULL, \`pieceId\` int NOT NULL, \`campaignId\` int, \`platform\` varchar(64) NOT NULL, \`date\` varchar(10) NOT NULL, \`impressions\` int NOT NULL DEFAULT 0, \`clicks\` int NOT NULL DEFAULT 0, \`engagements\` int NOT NULL DEFAULT 0, \`shares\` int NOT NULL DEFAULT 0, \`saves\` int NOT NULL DEFAULT 0, \`videoViews\` int NOT NULL DEFAULT 0, \`profileVisits\` int NOT NULL DEFAULT 0, \`follows\` int NOT NULL DEFAULT 0, \`createdAt\` timestamp NOT NULL DEFAULT (now()), CONSTRAINT \`content_creator_analytics_id\` PRIMARY KEY(\`id\`))`,
        `CREATE TABLE IF NOT EXISTS \`user_memory\` (\`id\` int AUTO_INCREMENT NOT NULL, \`userId\` int NOT NULL, \`fact\` text NOT NULL, \`category\` varchar(100) NOT NULL DEFAULT 'general', \`confidence\` int NOT NULL DEFAULT 100, \`source\` varchar(255), \`createdAt\` timestamp NOT NULL DEFAULT (now()), \`updatedAt\` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP, CONSTRAINT \`user_memory_id\` PRIMARY KEY(\`id\`))`, 

        // ── Titan Storage Add-on ──────────────────────────────────────────────
        `CREATE TABLE IF NOT EXISTS \`storage_subscriptions\` (\`id\` int AUTO_INCREMENT NOT NULL, \`userId\` int NOT NULL, \`stripeCustomerId\` varchar(128), \`stripeSubscriptionId\` varchar(128), \`stripePriceId\` varchar(128), \`plan\` enum('10gb','50gb','100gb','500gb','1tb') NOT NULL, \`status\` enum('active','canceled','past_due','incomplete','trialing') NOT NULL DEFAULT 'active', \`quotaBytes\` bigint NOT NULL, \`usedBytes\` bigint NOT NULL DEFAULT 0, \`currentPeriodEnd\` timestamp NULL, \`cancelAtPeriodEnd\` boolean NOT NULL DEFAULT false, \`createdAt\` timestamp NOT NULL DEFAULT (now()), \`updatedAt\` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP, CONSTRAINT \`storage_subscriptions_id\` PRIMARY KEY(\`id\`), CONSTRAINT \`storage_subscriptions_userId_unique\` UNIQUE(\`userId\`))`,
        `CREATE TABLE IF NOT EXISTS \`storage_files\` (\`id\` int AUTO_INCREMENT NOT NULL, \`userId\` int NOT NULL, \`s3Key\` varchar(512) NOT NULL, \`s3Url\` text, \`originalName\` varchar(512) NOT NULL, \`mimeType\` varchar(128) NOT NULL, \`sizeBytes\` bigint NOT NULL, \`feature\` enum('vault','builder','fetcher','scanner','webhook','export','generic') NOT NULL DEFAULT 'generic', \`featureResourceId\` varchar(128), \`tags\` json, \`isDeleted\` boolean NOT NULL DEFAULT false, \`deletedAt\` timestamp NULL, \`createdAt\` timestamp NOT NULL DEFAULT (now()), \`updatedAt\` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP, CONSTRAINT \`storage_files_id\` PRIMARY KEY(\`id\`), CONSTRAINT \`storage_files_s3Key_unique\` UNIQUE(\`s3Key\`))`,
        `CREATE TABLE IF NOT EXISTS \`storage_share_links\` (\`id\` int AUTO_INCREMENT NOT NULL, \`userId\` int NOT NULL, \`fileId\` int NOT NULL, \`token\` varchar(64) NOT NULL, \`expiresAt\` timestamp NULL, \`maxDownloads\` int NOT NULL DEFAULT 0, \`downloadCount\` int NOT NULL DEFAULT 0, \`passwordHash\` varchar(64), \`isActive\` boolean NOT NULL DEFAULT true, \`createdAt\` timestamp NOT NULL DEFAULT (now()), CONSTRAINT \`storage_share_links_id\` PRIMARY KEY(\`id\`), CONSTRAINT \`storage_share_links_token_unique\` UNIQUE(\`token\`))`,
        `CREATE TABLE IF NOT EXISTS \`storage_api_keys\` (\`id\` int AUTO_INCREMENT NOT NULL, \`userId\` int NOT NULL, \`name\` varchar(128) NOT NULL, \`keyHash\` varchar(64) NOT NULL, \`keyPrefix\` varchar(12) NOT NULL, \`scopes\` json NOT NULL, \`lastUsedAt\` timestamp NULL, \`expiresAt\` timestamp NULL, \`isActive\` boolean NOT NULL DEFAULT true, \`createdAt\` timestamp NOT NULL DEFAULT (now()), CONSTRAINT \`storage_api_keys_id\` PRIMARY KEY(\`id\`), CONSTRAINT \`storage_api_keys_keyHash_unique\` UNIQUE(\`keyHash\`))`,
        // ── Site Monitor tables ──────────────────────────────────────────────
        `CREATE TABLE IF NOT EXISTS \`monitored_sites\` (\`id\` int AUTO_INCREMENT NOT NULL, \`userId\` int NOT NULL, \`name\` varchar(256) NOT NULL, \`url\` varchar(2048) NOT NULL, \`checkIntervalSeconds\` int NOT NULL DEFAULT 300, \`accessMethod\` enum('none','api','ssh','ftp','login','webhook','railway','vercel','netlify','render','heroku') NOT NULL DEFAULT 'none', \`apiEndpoint\` text, \`apiKey\` text, \`apiHeaders\` text, \`loginUrl\` text, \`loginUsername\` text, \`loginPassword\` text, \`sshHost\` varchar(512), \`sshPort\` int DEFAULT 22, \`sshUsername\` varchar(256), \`sshPrivateKey\` text, \`platformProjectId\` varchar(256), \`platformServiceId\` varchar(256), \`platformToken\` text, \`platformEnvironmentId\` varchar(256), \`repairWebhookUrl\` text, \`repairWebhookSecret\` text, \`expectedStatusCode\` int DEFAULT 200, \`expectedBodyContains\` text, \`timeoutMs\` int DEFAULT 30000, \`followRedirects\` boolean NOT NULL DEFAULT true, \`sslCheckEnabled\` boolean NOT NULL DEFAULT true, \`performanceThresholdMs\` int DEFAULT 5000, \`alertsEnabled\` boolean NOT NULL DEFAULT true, \`alertEmail\` varchar(320), \`alertWebhookUrl\` text, \`alertAfterConsecutiveFailures\` int DEFAULT 3, \`autoRepairEnabled\` boolean NOT NULL DEFAULT true, \`isPaused\` boolean NOT NULL DEFAULT false, \`lastCheckAt\` timestamp NULL, \`lastStatus\` enum('healthy','degraded','down','error','unknown') NOT NULL DEFAULT 'unknown', \`lastResponseTimeMs\` int, \`lastHttpStatusCode\` int, \`consecutiveFailures\` int NOT NULL DEFAULT 0, \`uptimePercent24h\` varchar(8), \`uptimePercent7d\` varchar(8), \`uptimePercent30d\` varchar(8), \`createdAt\` timestamp NOT NULL DEFAULT (now()), \`updatedAt\` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP, CONSTRAINT \`monitored_sites_id\` PRIMARY KEY(\`id\`))`,
        `CREATE TABLE IF NOT EXISTS \`health_checks\` (\`id\` int AUTO_INCREMENT NOT NULL, \`siteId\` int NOT NULL, \`userId\` int NOT NULL, \`checkedAt\` timestamp NOT NULL DEFAULT (now()), \`status\` enum('healthy','degraded','down','error') NOT NULL, \`httpStatusCode\` int, \`responseTimeMs\` int, \`sslValid\` boolean, \`sslExpiresAt\` timestamp NULL, \`sslDaysUntilExpiry\` int, \`errorMessage\` text, \`performanceScore\` int, \`createdAt\` timestamp NOT NULL DEFAULT (now()), CONSTRAINT \`health_checks_id\` PRIMARY KEY(\`id\`))`,
        `CREATE TABLE IF NOT EXISTS \`site_incidents\` (\`id\` int AUTO_INCREMENT NOT NULL, \`siteId\` int NOT NULL, \`userId\` int NOT NULL, \`type\` enum('down','degraded','ssl_expiry','ssl_invalid','performance','error') NOT NULL, \`status\` enum('open','acknowledged','resolved','auto_resolved') NOT NULL DEFAULT 'open', \`title\` varchar(512) NOT NULL, \`description\` text, \`startedAt\` timestamp NOT NULL DEFAULT (now()), \`resolvedAt\` timestamp NULL, \`durationSeconds\` int, \`autoRepairAttempted\` boolean NOT NULL DEFAULT false, \`autoRepairSucceeded\` boolean, \`createdAt\` timestamp NOT NULL DEFAULT (now()), \`updatedAt\` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP, CONSTRAINT \`site_incidents_id\` PRIMARY KEY(\`id\`))`,
        `CREATE TABLE IF NOT EXISTS \`repair_logs\` (\`id\` int AUTO_INCREMENT NOT NULL, \`siteId\` int NOT NULL, \`userId\` int NOT NULL, \`incidentId\` int, \`triggeredBy\` enum('auto','manual') NOT NULL DEFAULT 'manual', \`method\` enum('none','api','ssh','ftp','login','webhook','railway','vercel','netlify','render','heroku') NOT NULL, \`status\` enum('pending','running','success','failed','timeout') NOT NULL DEFAULT 'pending', \`steps\` json, \`errorMessage\` text, \`startedAt\` timestamp NOT NULL DEFAULT (now()), \`completedAt\` timestamp NULL, \`durationSeconds\` int, \`createdAt\` timestamp NOT NULL DEFAULT (now()), CONSTRAINT \`repair_logs_id\` PRIMARY KEY(\`id\`))`,
        // ── Security Module Marketplace tables ──────────────────────────────
        `CREATE TABLE IF NOT EXISTS \`security_modules\` (\`id\` int AUTO_INCREMENT NOT NULL, \`slug\` varchar(128) NOT NULL, \`name\` varchar(128) NOT NULL, \`description\` text NOT NULL, \`longDescription\` text, \`category\` enum('osint','scanning','exploitation','phishing','anonymity','automation','reporting','playbook','wordlist','template') NOT NULL, \`tags\` text, \`authorId\` varchar(64) NOT NULL DEFAULT 'platform', \`authorLabel\` varchar(128), \`version\` varchar(32) NOT NULL DEFAULT '1.0.0', \`license\` enum('free','credits','subscription') NOT NULL DEFAULT 'free', \`creditCost\` int, \`readme\` text, \`downloads\` int NOT NULL DEFAULT 0, \`rating\` int NOT NULL DEFAULT 0, \`ratingCount\` int NOT NULL DEFAULT 0, \`featured\` boolean NOT NULL DEFAULT false, \`verified\` boolean NOT NULL DEFAULT false, \`status\` enum('draft','published','archived','rejected') NOT NULL DEFAULT 'draft', \`requirements\` text, \`compatibleWith\` text, \`screenshots\` text, \`createdAt\` timestamp NOT NULL DEFAULT (now()), \`updatedAt\` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP, CONSTRAINT \`security_modules_id\` PRIMARY KEY(\`id\`), CONSTRAINT \`security_modules_slug_unique\` UNIQUE(\`slug\`))`,
        `CREATE TABLE IF NOT EXISTS \`security_module_installs\` (\`id\` int AUTO_INCREMENT NOT NULL, \`userId\` int NOT NULL, \`moduleSlug\` varchar(128) NOT NULL, \`moduleName\` varchar(128) NOT NULL, \`version\` varchar(32) NOT NULL DEFAULT '1.0.0', \`installedAt\` timestamp NOT NULL DEFAULT (now()), CONSTRAINT \`security_module_installs_id\` PRIMARY KEY(\`id\`))`,
        `CREATE TABLE IF NOT EXISTS \`security_module_reviews\` (\`id\` int AUTO_INCREMENT NOT NULL, \`moduleSlug\` varchar(128) NOT NULL, \`userId\` int NOT NULL, \`username\` varchar(128) NOT NULL, \`rating\` int NOT NULL, \`comment\` text, \`createdAt\` timestamp NOT NULL DEFAULT (now()), CONSTRAINT \`security_module_reviews_id\` PRIMARY KEY(\`id\`))`,
      ];
      for (const ddl of createTables) {
        try {
          await pool.promise().query(ddl);
        } catch (e: unknown) {
          log.warn('Table creation warning', { error: getErrorMessage(e)?.substring(0, 100) });
        }
      }
      // Create indexes for user_secrets
      try {
        await pool.promise().query('CREATE INDEX `idx_user_secrets_userId_type` ON `user_secrets` (`userId`, `secretType`)');
      } catch (e: unknown) {
        // Index already exists - ignore
      }
      // Add contextSummary and summarizedUpToId to chat_conversations (idempotent)
      const alterConversations = [
        'ALTER TABLE `chat_conversations` ADD COLUMN `contextSummary` text',
        'ALTER TABLE `chat_conversations` ADD COLUMN `summarizedUpToId` int',
      ];
      for (const alter of alterConversations) {
        try { await pool.promise().query(alter); } catch (_) { /* column already exists */ }
      }
      // Add index on user_memory userId for fast lookups
      try {
        await pool.promise().query('CREATE INDEX `idx_user_memory_userId` ON `user_memory` (`userId`)');
      } catch (_) { /* index already exists */ }
      // Add performance indexes on chat tables (high-traffic per-user queries)
      const chatIndexes = [
        'CREATE INDEX `idx_chat_conversations_userId` ON `chat_conversations` (`userId`)',
        'CREATE INDEX `idx_chat_conversations_lastMessageAt` ON `chat_conversations` (`lastMessageAt`)',
        'CREATE INDEX `idx_chat_messages_conversationId` ON `chat_messages` (`conversationId`)',
        'CREATE INDEX `idx_chat_messages_userId` ON `chat_messages` (`userId`)',
      ];
      for (const idx of chatIndexes) {
        try { await pool.promise().query(idx); } catch (_) { /* index already exists */ }
      }
      // Add dailyFreeCredits and dailyFreeLastGrantedAt columns to credit_balances if missing
      // (IF NOT EXISTS guard — safe to re-run on every deploy)
      try {
        await pool.promise().query(`ALTER TABLE \`credit_balances\` ADD COLUMN \`dailyFreeCredits\` int NOT NULL DEFAULT 0`);
      } catch (e: unknown) {
        // Ignore 'Duplicate column' — column already exists
        if (!getErrorMessage(e)?.includes('Duplicate column')) {
          log.warn('credit_balances dailyFreeCredits column (non-fatal):', { error: getErrorMessage(e)?.substring(0, 200) });
        }
      }
      try {
        await pool.promise().query(`ALTER TABLE \`credit_balances\` ADD COLUMN \`dailyFreeLastGrantedAt\` timestamp NULL`);
      } catch (e: unknown) {
        // Ignore 'Duplicate column' — column already exists
        if (!getErrorMessage(e)?.includes('Duplicate column')) {
          log.warn('credit_balances dailyFreeLastGrantedAt column (non-fatal):', { error: getErrorMessage(e)?.substring(0, 200) });
        }
      }
      // Add lastLoginBonusAt and loginBonusThisMonth columns to credit_balances if missing
      try {
        await pool.promise().query(`ALTER TABLE \`credit_balances\` ADD COLUMN \`lastLoginBonusAt\` timestamp NULL`);
      } catch (e: unknown) {
        if (!getErrorMessage(e)?.includes('Duplicate column')) {
          log.warn('credit_balances lastLoginBonusAt column (non-fatal):', { error: getErrorMessage(e)?.substring(0, 200) });
        }
      }
      try {
        await pool.promise().query(`ALTER TABLE \`credit_balances\` ADD COLUMN \`loginBonusThisMonth\` int NOT NULL DEFAULT 0`);
      } catch (e: unknown) {
        if (!getErrorMessage(e)?.includes('Duplicate column')) {
          log.warn('credit_balances loginBonusThisMonth column (non-fatal):', { error: getErrorMessage(e)?.substring(0, 200) });
        }
      }
      // Rename api_keys.rate_limit → rateLimit to match Drizzle schema (idempotent — ignore if already renamed)
      try {
        const [cols] = await pool.promise().query(`SHOW COLUMNS FROM \`api_keys\` LIKE 'rate_limit'`) as any[];
        if (Array.isArray(cols) && cols.length > 0) {
          await pool.promise().query(`ALTER TABLE \`api_keys\` RENAME COLUMN \`rate_limit\` TO \`rateLimit\``);
          log.info('api_keys: renamed rate_limit → rateLimit');
        }
      } catch (e: unknown) {
        log.warn('api_keys rate_limit rename (non-fatal):', { error: getErrorMessage(e)?.substring(0, 200) });
      }
      // Expand credit_transactions.type enum to include all action types
      // (MODIFY COLUMN is safe to re-run — MySQL will accept it even if values already exist)
      try {
        await pool.promise().query(`ALTER TABLE \`credit_transactions\` MODIFY COLUMN \`type\` enum('signup_bonus','monthly_refill','pack_purchase','admin_adjustment','referral_bonus','daily_login_bonus','marketplace_sale','marketplace_refund','chat_message','builder_action','voice_action','image_generation','video_generation','fetch_action','github_action','import_action','clone_action','replicate_action','seo_run','blog_generate','content_generate','marketing_run','advertising_run','security_scan','metasploit_action','evilginx_action','blackeye_action','grant_match','grant_apply','business_plan_generate','marketplace_list','marketplace_feature','marketplace_purchase','marketplace_seller_fee','marketplace_seller_renewal','marketplace_boost','marketplace_verification','site_monitor_add','sandbox_run','affiliate_action','api_call','vpn_generate','isolated_browser') NOT NULL`);
      } catch (e: unknown) {
        log.warn('credit_transactions enum expand warning', { error: getErrorMessage(e)?.substring(0, 200) });
      }
      // Expand subscriptions.plan enum to include all plan tiers (cyber, cyber_plus, titan)
      // MODIFY COLUMN is idempotent — safe to re-run on every deploy
      try {
        await pool.promise().query(`ALTER TABLE \`subscriptions\` MODIFY COLUMN \`plan\` enum('free','pro','enterprise','cyber','cyber_plus','titan') NOT NULL DEFAULT 'free'`);
      } catch (e: unknown) {
        log.warn('subscriptions plan enum expand warning', { error: getErrorMessage(e)?.substring(0, 200) });
      }
      // ── CRITICAL: Ensure chat tables exist with all required columns ──────────
      // These tables are used in every chat.send call. If they don't exist or
      // are missing columns (e.g. if Drizzle migration failed), chat breaks.
      const chatTableDDL = [
        // chat_conversations — full schema including all columns added over time
        `CREATE TABLE IF NOT EXISTS \`chat_conversations\` (\`id\` int AUTO_INCREMENT NOT NULL, \`userId\` int NOT NULL, \`title\` varchar(255) NOT NULL DEFAULT 'New Conversation', \`pinned\` int NOT NULL DEFAULT 0, \`archived\` int NOT NULL DEFAULT 0, \`messageCount\` int NOT NULL DEFAULT 0, \`lastMessageAt\` timestamp NOT NULL DEFAULT (now()), \`createdAt\` timestamp NOT NULL DEFAULT (now()), \`updatedAt\` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP, CONSTRAINT \`chat_conversations_id\` PRIMARY KEY(\`id\`))`,
        // chat_messages — full schema including toolCalls, actionsTaken, tokenCount
        `CREATE TABLE IF NOT EXISTS \`chat_messages\` (\`id\` int AUTO_INCREMENT NOT NULL, \`conversationId\` int NOT NULL, \`userId\` int NOT NULL, \`role\` enum('user','assistant','system','tool') NOT NULL, \`content\` text NOT NULL, \`toolCalls\` json, \`actionsTaken\` json, \`tokenCount\` int, \`createdAt\` timestamp NOT NULL DEFAULT (now()), CONSTRAINT \`chat_messages_id\` PRIMARY KEY(\`id\`))`,
      ];
      for (const ddl of chatTableDDL) {
        try { await pool.promise().query(ddl); } catch (_) { /* table already exists */ }
      }
      // Backfill missing columns on chat tables (idempotent — plain ADD COLUMN, ignore Duplicate column errors)
      // Note: ADD COLUMN IF NOT EXISTS is only supported in MySQL 8.0.3+; use plain ADD COLUMN + catch instead
      const chatColumnBackfills = [
        // chat_conversations missing columns
        `ALTER TABLE \`chat_conversations\` ADD COLUMN \`pinned\` int NOT NULL DEFAULT 0`,
        `ALTER TABLE \`chat_conversations\` ADD COLUMN \`messageCount\` int NOT NULL DEFAULT 0`,
        `ALTER TABLE \`chat_conversations\` ADD COLUMN \`archived\` int NOT NULL DEFAULT 0`,
        `ALTER TABLE \`chat_conversations\` ADD COLUMN \`lastMessageAt\` timestamp NOT NULL DEFAULT (now())`,
        `ALTER TABLE \`chat_conversations\` ADD COLUMN \`contextSummary\` text`,
        `ALTER TABLE \`chat_conversations\` ADD COLUMN \`summarizedUpToId\` int`,
        `ALTER TABLE \`chat_conversations\` ADD COLUMN \`buildContext\` json`,
        // chat_messages missing columns
        `ALTER TABLE \`chat_messages\` ADD COLUMN \`toolCalls\` json`,
        `ALTER TABLE \`chat_messages\` ADD COLUMN \`actionsTaken\` json`,
        `ALTER TABLE \`chat_messages\` ADD COLUMN \`tokenCount\` int`,
        // users table missing columns (used in auth and admin checks)
        `ALTER TABLE \`users\` ADD COLUMN \`loginMethod\` varchar(64)`,
        `ALTER TABLE \`users\` ADD COLUMN \`emailVerified\` boolean NOT NULL DEFAULT false`,
        `ALTER TABLE \`users\` ADD COLUMN \`emailVerificationToken\` varchar(128)`,
        `ALTER TABLE \`users\` ADD COLUMN \`emailVerificationExpires\` timestamp`,
        `ALTER TABLE \`users\` ADD COLUMN \`twoFactorSecret\` text`,
        `ALTER TABLE \`users\` ADD COLUMN \`twoFactorEnabled\` boolean NOT NULL DEFAULT false`,
        `ALTER TABLE \`users\` ADD COLUMN \`twoFactorBackupCodes\` json`,
        `ALTER TABLE \`users\` ADD COLUMN \`onboardingCompleted\` boolean NOT NULL DEFAULT false`,
        `ALTER TABLE \`users\` ADD COLUMN \`lastSignedIn\` timestamp NOT NULL DEFAULT (now())`,
        // fetcher_jobs missing columns (used in buildUserContext)
        `ALTER TABLE \`fetcher_jobs\` ADD COLUMN \`encryptedPassword\` text NOT NULL DEFAULT ''`,
        `ALTER TABLE \`fetcher_jobs\` ADD COLUMN \`selectedProviders\` json`,
        `ALTER TABLE \`fetcher_jobs\` ADD COLUMN \`totalProviders\` int NOT NULL DEFAULT 0`,
        `ALTER TABLE \`fetcher_jobs\` ADD COLUMN \`completedProviders\` int NOT NULL DEFAULT 0`,
        `ALTER TABLE \`fetcher_jobs\` ADD COLUMN \`failedProviders\` int NOT NULL DEFAULT 0`,
        `ALTER TABLE \`fetcher_jobs\` ADD COLUMN \`completedAt\` timestamp`,
        // fetcher_credentials missing columns (used in buildUserContext)
        `ALTER TABLE \`fetcher_credentials\` ADD COLUMN \`jobId\` int NOT NULL DEFAULT 0`,
        `ALTER TABLE \`fetcher_credentials\` ADD COLUMN \`taskId\` int NOT NULL DEFAULT 0`,
        `ALTER TABLE \`fetcher_credentials\` ADD COLUMN \`providerId\` varchar(64) NOT NULL DEFAULT ''`,
        `ALTER TABLE \`fetcher_credentials\` ADD COLUMN \`providerName\` varchar(128) NOT NULL DEFAULT ''`,
        `ALTER TABLE \`fetcher_credentials\` ADD COLUMN \`keyType\` varchar(64) NOT NULL DEFAULT ''`,
        `ALTER TABLE \`fetcher_credentials\` ADD COLUMN \`keyLabel\` varchar(256)`,
        // fetcher_settings missing columns (used in buildUserContext)
        `ALTER TABLE \`fetcher_settings\` ADD COLUMN \`proxyServer\` varchar(512)`,
        `ALTER TABLE \`fetcher_settings\` ADD COLUMN \`proxyUsername\` varchar(128)`,
        `ALTER TABLE \`fetcher_settings\` ADD COLUMN \`proxyPassword\` text`,
        `ALTER TABLE \`fetcher_settings\` ADD COLUMN \`captchaService\` varchar(64)`,
        `ALTER TABLE \`fetcher_settings\` ADD COLUMN \`captchaApiKey\` text`,
        `ALTER TABLE \`fetcher_settings\` ADD COLUMN \`headless\` int NOT NULL DEFAULT 1`,
        // fetcher_proxies missing columns (used in buildUserContext)
        `ALTER TABLE \`fetcher_proxies\` ADD COLUMN \`username\` varchar(128)`,
        `ALTER TABLE \`fetcher_proxies\` ADD COLUMN \`proxyType\` enum('residential','datacenter','mobile','isp') NOT NULL DEFAULT 'residential'`,
        `ALTER TABLE \`fetcher_proxies\` ADD COLUMN \`country\` varchar(8)`,
        `ALTER TABLE \`fetcher_proxies\` ADD COLUMN \`city\` varchar(128)`,
        `ALTER TABLE \`fetcher_proxies\` ADD COLUMN \`latencyMs\` int`,
        `ALTER TABLE \`fetcher_proxies\` ADD COLUMN \`lastCheckedAt\` timestamp`,
        `ALTER TABLE \`fetcher_proxies\` ADD COLUMN \`failCount\` int NOT NULL DEFAULT 0`,
        `ALTER TABLE \`fetcher_proxies\` ADD COLUMN \`successCount\` int NOT NULL DEFAULT 0`,
        `ALTER TABLE \`fetcher_proxies\` ADD COLUMN \`provider\` varchar(128)`,
        `ALTER TABLE \`fetcher_proxies\` ADD COLUMN \`notes\` text`,
        // credential_watches missing columns (used in buildUserContext)
        `ALTER TABLE \`credential_watches\` ADD COLUMN \`credentialId\` int NOT NULL DEFAULT 0`,
        `ALTER TABLE \`credential_watches\` ADD COLUMN \`alertDaysBefore\` int NOT NULL DEFAULT 7`,
        `ALTER TABLE \`credential_watches\` ADD COLUMN \`lastNotifiedAt\` timestamp`,
      ];
      for (const alter of chatColumnBackfills) {
        try { await pool.promise().query(alter); } catch (_) { /* column already exists or table missing — safe to ignore */ }
      }
      log.info('Chat path columns ensured');

      // ── Performance indexes (idempotent, IF NOT EXISTS) ────────────────────────────────────────
      const performanceIndexes = [
        `CREATE INDEX IF NOT EXISTS idx_fetcher_jobs_userId ON fetcher_jobs(userId)`,
        `CREATE INDEX IF NOT EXISTS idx_fetcher_tasks_userId ON fetcher_tasks(userId)`,
        `CREATE INDEX IF NOT EXISTS idx_fetcher_credentials_userId ON fetcher_credentials(userId)`,
        `CREATE INDEX IF NOT EXISTS idx_subscriptions_userId ON subscriptions(userId)`,
        `CREATE INDEX IF NOT EXISTS idx_api_keys_userId ON api_keys(userId)`,
        `CREATE INDEX IF NOT EXISTS idx_audit_logs_userId ON audit_logs(userId)`,
        `CREATE INDEX IF NOT EXISTS idx_credential_history_userId ON credential_history(userId)`,
        `CREATE INDEX IF NOT EXISTS idx_marketplace_listings_sellerId ON marketplace_listings(sellerId)`,
        `CREATE INDEX IF NOT EXISTS idx_marketplace_listings_status ON marketplace_listings(status)`,
        `CREATE INDEX IF NOT EXISTS idx_marketplace_purchases_buyerId ON marketplace_purchases(buyerId)`,
        `CREATE INDEX IF NOT EXISTS idx_conversations_userId ON conversations(userId)`,
        `CREATE INDEX IF NOT EXISTS idx_messages_conversationId ON messages(conversationId)`,
        `CREATE INDEX IF NOT EXISTS idx_blog_posts_slug ON blog_posts(slug)`,
        `CREATE INDEX IF NOT EXISTS idx_blog_posts_status ON blog_posts(status)`,
        `CREATE INDEX IF NOT EXISTS idx_audit_logs_createdAt ON audit_logs(createdAt)`,
      ];
      for (const idx of performanceIndexes) {
        try { await pool.promise().query(idx); } catch (_) { /* already exists or table missing — safe to ignore */ }
      }
      log.info('Performance indexes ensured');
      log.info('All tables ensured');
    } catch (err: unknown) {
      log.error('Raw SQL migration failed', { error: getErrorMessage(err) });
    }
    // Always close the migration pool
    try { await pool.promise().end(); } catch (_) { /* ignore */ }
  } else {
    log.warn('No DATABASE_URL - skipping migrations');
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    log.info(`Port ${preferredPort} busy, using ${port} instead`);
  }

  // Set server timeout to 10 minutes for long builder tasks
  server.timeout = 600_000; // 10 minutes
  server.keepAliveTimeout = 620_000; // slightly longer than timeout
  server.headersTimeout = 630_000; // slightly longer than keepAlive

  server.listen(port, () => {
    log.info(`Server running on http://localhost:${port}/`);

    // ─── Scheduled Monthly Credit Refill ──────────────────────────
    // Run once on startup (catches any missed refills) and then every 24 hours.
    // The processMonthlyRefill function is idempotent — it checks lastRefillAt
    // and only refills if the user hasn't been refilled this calendar month.
    scheduleMonthlyRefill();
    // ─── Warm up Venice usage limiter from DB ────────────────────────
    import("../venice-usage-limiter.js").then(m => m.loadVeniceUsageFromDb()).catch(() => {});

       // ─── Auto-Promote Owner to Admin ────────────────────────
    // Ensures the platform owner always has admin role, even if
    // they registered before the auto-promotion logic was added.
    setTimeout(async () => {
      try {
        const { getDb } = await import("../db.js");
        const { users } = await import("../../drizzle/schema.js");
        const { eq, or } = await import("drizzle-orm");
        const { ENV } = await import("./env.js");
        const db = await getDb();
        if (!db) return;

        // Ensure the role enum includes 'head_admin' (safe ALTER — MySQL ignores if already correct)
        try {
          const { sql: rawSql } = await import("drizzle-orm");
          await db.execute(rawSql`ALTER TABLE \`users\` MODIFY COLUMN \`role\` ENUM('user','admin','head_admin') NOT NULL DEFAULT 'user'`);
          log.info('Ensured head_admin role exists in users table');
        } catch (alterErr) {
          // Ignore if already correct or if column doesn't exist yet
          log.warn('ALTER TABLE for head_admin role (non-fatal):', { error: String(alterErr) });
        }

        // Promote HEAD ADMIN — leego972@gmail.com gets head_admin role
        if (ENV.headAdminEmail) {
          await db.update(users).set({ role: "head_admin" as any }).where(
            eq(users.email, ENV.headAdminEmail)
          ).catch(() => {});
          log.info('Head admin promotion', { email: ENV.headAdminEmail });
        }

        // Promote user ID 1 (first user) to admin
        await db.update(users).set({ role: "admin" }).where(
          eq(users.id, 1)
        ).catch(() => {});

        // Promote by OWNER_EMAILS list (except head admin who is already head_admin)
        if (ENV.ownerEmails && ENV.ownerEmails.length > 0) {
          const { inArray } = await import("drizzle-orm");
          const nonHeadOwners = ENV.ownerEmails.filter(e => e !== ENV.headAdminEmail);
          if (nonHeadOwners.length > 0) {
            await db.update(users).set({ role: "admin" }).where(
              inArray(users.email, nonHeadOwners)
            ).catch(() => {});
          }
          log.info('Admin auto-promotion', { emails: ENV.ownerEmails, headAdmin: ENV.headAdminEmail });
        }

        // Promote by OWNER_OPEN_ID
        if (ENV.ownerOpenId) {
          await db.update(users).set({ role: "admin" }).where(
            eq(users.openId, ENV.ownerOpenId)
          ).catch(() => {});
        }
      } catch (err) {
        log.error('Admin auto-promotion failed', { error: String(err) });
      }
    }, 3000);

    // ─── Auto-seed Affiliate Programs ──────────────────────
    // Seeds known affiliate programs on startup if not already presentt
    setTimeout(async () => {
      try {
        const { seedAffiliatePrograms } = await import("../affiliate-engine.js");
        const count = await seedAffiliatePrograms();
        if (count > 0) log.info(`Auto-seeded ${count} affiliate programs`);
        else log.debug('Affiliate programs already seeded');
      } catch (err) {
        log.error('Affiliate seed failed', { error: String(err) });
      }
    }, 5000);

    // ─── Auto-seed Releases ──────────────────────────────────
    // Seeds the initial release with platform binaries if DB is empty
    setTimeout(async () => {
      try {
        const { getDb } = await import("../db.js");
        const { releases } = await import("../../drizzle/schema.js");
        const { sql } = await import("drizzle-orm");
        const db = await getDb();
        if (!db) { log.warn('Release seed skipped: DB not available'); return; }
        const existing = await db.select({ count: sql<number>`count(*)` }).from(releases);
        if (existing[0].count === 0) {
          await db.insert(releases).values({
            version: "8.1.0",
            title: "Archibald Titan v8.1.0",
            changelog: "**Archibald Titan v8.1.0 — Latest Release**\n\n" +
              "All features from v1.0 through v8.1 included:\n\n" +
              "- 15+ Provider Automation with stealth browser\n" +
              "- AES-256-GCM Encrypted Vault\n" +
              "- CAPTCHA Solving (reCAPTCHA, hCaptcha)\n" +
              "- Residential Proxy Pool with auto-rotation\n" +
              "- Kill Switch with emergency shutdown\n" +
              "- Credential Expiry Watchdog\n" +
              "- Bulk Provider Sync & Credential Diff/History\n" +
              "- Scheduled Auto-Sync & Smart Fetch\n" +
              "- Provider Health Trends\n" +
              "- Credential Leak Scanner\n" +
              "- One-Click Provider Onboarding\n" +
              "- Team Credential Vault\n" +
              "- Developer REST API & Webhooks\n" +
              "- Email/Password Authentication\n" +
              "- Credit Membership System\n" +
              "- Autonomous Advertising & Marketing Engine\n" +
              "- Contextual Affiliate Recommendations\n" +
              "- Tech Bazaar Marketplace with dual payment (Credits + Stripe)\n" +
              "- Seller Payout System (Bank, PayPal, Stripe Connect)\n" +
              "- AI-Powered Code Builder with Sandbox\n" +
              "- Website Replicator & Domain Search\n" +
              "- SEO Engine with IndexNow & Structured Data\n" +
              "- Blog CMS with AI Generation",
            downloadUrlWindows: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663339631904/AlISTsCQSdQTgAut.exe",
            downloadUrlMac: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663339631904/hHpsXgJtQRLZdDOK.zip",
            downloadUrlLinux: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663339631904/aelqItiquyVUiorf.AppImage",
            fileSizeMb: 185,
            isLatest: 1,
            isPrerelease: 0,
            downloadCount: 0,
          });
          log.info('Auto-seeded v8.1.0 release');
        } else {
          log.debug(`Releases already exist (${existing[0].count} found)`);
        }
      } catch (err) {
        log.error('Release seed failed', { error: String(err) });
      }
    }, 6000);

    // ─── Auto-seed Blog Posts ──────────────────────────────────
    // Seeds SEO blog posts on startup if not already present
    setTimeout(async () => {
      try {
        const { seedBlogPosts } = await import("../blog-seed.js");
        const count = await seedBlogPosts();
        if (count > 0) log.info(`Auto-seeded ${count} blog posts`);
        else log.debug('Blog posts already seeded');
      } catch (err) {
        log.error('Blog seed failed', { error: String(err) });
      }
    }, 8000);

    // ─── Autonomous Affiliate Discovery ──────────────────────────
    // Runs every Wednesday and Saturday at 6 AM UTC
    // Discovers new affiliate programs, scores them, generates applications
    startScheduledDiscovery();

    // ─── Autonomous SEO Optimization ──────────────────────────────
    // Runs weekly: meta tag analysis, keyword research, health scoring
    startScheduledSeo();

    // ─── GEO Optimization (SEO v4) ──────────────────────────────────
    // Runs 8 hours after deploy, then weekly: submits programmatic pages
    // to IndexNow, updates llms.txt cache, refreshes AI citation signals
    setTimeout(async () => {
      try {
        log.info('[SEO v4] Running first GEO optimization...');
        await runGeoOptimization();
      } catch (err: unknown) {
        log.error('[SEO v4] First GEO optimization failed:', { error: String(err) });
      }
    }, 8 * 60 * 60 * 1000); // 8 hours after deploy
    setInterval(async () => {
      try { await runGeoOptimization(); } catch { /* non-critical */ }
    }, 7 * 24 * 60 * 60 * 1000); // Weekly

    // ─── Autonomous Advertising Orchestrator ──────────────────────
    // Runs daily: blog generation, social media, community engagement,
    // email nurture, backlink outreach, affiliate optimization, SEO
    startAdvertisingScheduler();
    // ─── Master Growth Orchestrator ───────────────────────────────
    // Unified brain: SEO → Content → Advertising in dependency order
    // Runs daily at 6:00 AM — cross-system intelligence sharing
    startMasterOrchestrator();

    // ─── Affiliate Engine v2 Optimization ─────────────────────────
    // Runs daily at 4 AM UTC: EPC recalculation, fraud cleanup,
    // revenue forecasting, milestone checks, seasonal multiplier updates
    setTimeout(async () => {
      try {
        log.info('[Affiliate v2] Running first v2 optimization cycle...');
        await runOptimizationCycleV2();
      } catch (err: unknown) {
        log.error('[Affiliate v2] First optimization failed:', { error: String(err) });
      }
    }, 6 * 60 * 60 * 1000); // 6 hours after deploy
    setInterval(async () => {
      try { await runOptimizationCycleV2(); } catch { /* non-critical */ }
    }, 24 * 60 * 60 * 1000); // Daily

    // ─── Autonomous Module Generator ─────────────────────────────
    // Runs weekly on Sundays at 3 AM: generates 3-5 fresh cyber
    // security modules, verifies code quality, and lists them on
    // Grand Bazaar through seller bots (CyberForge, GhostNet,
    // VaultKeeper, dEciever000). Deduplicates against existing titles.
    startModuleGeneratorScheduler();

    // ─── Autonomous Business Module Generator ────────────────
    // Runs weekly on Wednesdays at 2 AM: generates 2-3 business
    // modules targeting a rotating vertical (SaaS, e-commerce,
    // healthcare, finance, marketing, etc.). 15 verticals rotate
    // weekly. Modules are designed to be expandable across industries.
    startBusinessModuleGeneratorScheduler();

    // ─── Marketplace Seeding ──────────────────────────────────────
    // Seeds seller bot accounts and their module listings on first run.
    // Idempotent — skips if bots already exist.
    setTimeout(async () => {
      try {
        await seedMarketplace();
        log.info('Marketplace seeded successfully');
      } catch (err) {
        log.error('Marketplace seed failed', { error: String(err) });
      }
    }, 12000);

    // ─── Crowdfunding Image Migration ──────────────────────────────
    // Fixes any campaigns that were seeded with broken/empty image URLs.
    // Safe to run every startup — only updates rows with broken images.
    setTimeout(async () => {
      try {
        const result = await updateCampaignImages(updateCampaign, listCampaigns);
        if (result.updated > 0) {
          log.info('[CrowdfundingImages] Fixed broken images', { updated: result.updated, skipped: result.skipped });
        }
      } catch (err) {
        log.error('[CrowdfundingImages] Image update failed', { error: String(err) });
      }
    }, 14000);

    // ─── Autonomous Affiliate Signup Engine ───────────────────────
    // Runs weekly: auto-signs up for discovered affiliate programs,
    // generates unique referral links, and tracks conversions.
    startScheduledSignups();

    // ─── Security Hardening Sweep Scheduler ──────────────────────
    // Runs every 30 minutes: cleans expired rate-limit windows,
    // flushes security event buffer to DB, audits credit balances
    // for active users, and detects anomalous patterns.
    startSecuritySweepScheduler();

    // ─── Security Fortress Sweep Scheduler ───────────────────────
    // Runs every 30 minutes: checks canary tokens, cleans incident
    // counters, prunes geo-history, and validates 2FA sessions.
    startFortressSweepScheduler();

       // ─── Autonomous System Sync ──────────────────────────────
    // Runs startup diagnostic (logs all system statuses, patches
    // IndexNow key, auto-enables marketing engine), then starts
    // periodic sync check every 6 hours.
    setTimeout(async () => {
      try {
        await runStartupDiagnostic();
        startPeriodicSync();
      } catch (err: unknown) {
        log.error('[AutonomousSync] Startup diagnostic failed:', { error: String(err) });
      }
    }, 15_000); // 15 seconds after startup — let DB settle

    // ─── Autonomous Self-Improvement Cycle ───────────────────────
    // Runs daily at 3 AM (offset from deploy): creates a snapshot,
    // runs a health check, and logs the system state. Full code
    // modifications are triggered by Titan via chat when asked.
    // This ensures the engine is always warm and ready.
    const SELF_IMPROVE_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours
    const SELF_IMPROVE_INITIAL_DELAY = 3 * 60 * 60 * 1000; // 3 hours after deploy
    setTimeout(async () => {
      const runSelfImproveCycle = async () => {
        try {
          log.info('[SelfImprove] Starting daily self-improvement health cycle...');
          const health = await runHealthCheck();
          if (health.healthy) {
            log.info('[SelfImprove] Health check passed. System is healthy.', {
              checks: health.checks.filter((c: any) => c.passed).length + '/' + health.checks.length,
            });
            // Create a daily snapshot of key server files so rollback is always available
            const keyFiles = [
              'server/chat-router.ts',
              'server/chat-tools.ts',
              'server/chat-executor.ts',
              'server/build-intent.ts',
              'server/titan-memory.ts',
            ];
            const snapResult = await createSnapshot(keyFiles, 'Daily automated snapshot', 'autonomous_scheduler');
            if (snapResult.success) {
              log.info('[SelfImprove] Daily snapshot created successfully.');
            } else {
              log.warn('[SelfImprove] Snapshot skipped (likely no DB):', { reason: snapResult.error });
            }
          } else {
            const failed = health.checks.filter((c: any) => !c.passed).map((c: any) => c.name);
            log.warn('[SelfImprove] Health check found issues:', { failedChecks: failed });
          }
        } catch (err: unknown) {
          log.error('[SelfImprove] Daily cycle failed:', { error: String(err) });
        }
      };
      await runSelfImproveCycle();
      setInterval(runSelfImproveCycle, SELF_IMPROVE_INTERVAL);
    }, SELF_IMPROVE_INITIAL_DELAY);
  });

  // Venice Connection Pre-Warming
  // Send a minimal request to Venice 45s after startup to establish a warm
  // TCP connection. Eliminates cold-start penalty on first admin message.
  setTimeout(async () => {
    try {
      log.info('[Warmup] Pre-warming Venice connection...');
      const warmupRes = await fetch('https://api.venice.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'authorization': 'Bearer ' + process.env.VENICE_API_KEY,
        },
        body: JSON.stringify({
          model: 'mistral-31-24b',
          messages: [{ role: 'user', content: 'hi' }],
          max_tokens: 1,
          temperature: 0,
        }),
        signal: AbortSignal.timeout(15_000),
      });
      if (warmupRes.ok) {
        log.info('[Warmup] Venice connection pre-warmed successfully');
      } else {
        log.warn('[Warmup] Venice warmup returned ' + warmupRes.status + ' - non-fatal');
      }
    } catch (err) {
      log.warn('[Warmup] Venice pre-warm failed (non-fatal):', { error: String(err) });
    }
  }, 45_000);
}

function scheduleMonthlyRefill() {
  const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

  // Run after a short delay on startup to let DB connections settle
  setTimeout(async () => {
    try {
      log.info('Running startup credit refill check...');
      const result = await processAllMonthlyRefills();
      log.info('Startup refill complete', { processed: result.processed, refilled: result.refilled, errors: result.errors });
    } catch (err: unknown) {
      log.error('Startup refill failed', { error: getErrorMessage(err) });
    }
  }, 30_000); // 30 second delay — give DB connections time to settle

  // Then run every 24 hours
  setInterval(async () => {
    try {
      log.info('Running scheduled credit refill...');
      const result = await processAllMonthlyRefills();
      log.info('Scheduled refill complete', { processed: result.processed, refilled: result.refilled, errors: result.errors });
    } catch (err: unknown) {
      log.error('Scheduled refill failed', { error: getErrorMessage(err) });
    }
  }, TWENTY_FOUR_HOURS);
}

startServer().catch((err) => log.error('Server startup failed', { error: String(err) }));

// ─── Graceful Shutdown ──────────────────────────────────────────
let isShuttingDown = false;

function gracefulShutdown(signal: string) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  log.info(`Received ${signal}. Starting graceful shutdown...`);

  // Stop accepting new connections
  // The server reference is inside startServer scope, so we use process.exit
  // with a timeout to allow in-flight requests to complete
  const SHUTDOWN_TIMEOUT = 15_000; // 15 seconds max

  const forceExit = setTimeout(() => {
    log.error('Graceful shutdown timed out. Forcing exit.');
    process.exit(1);
  }, SHUTDOWN_TIMEOUT);

  // Unref so the timer doesn't keep the process alive if everything closes cleanly
  forceExit.unref();

  // Give in-flight requests time to finish
  setTimeout(() => {
    log.info('Graceful shutdown complete.');
    process.exit(0);
  }, 3000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Catch unhandled rejections and uncaught exceptions
process.on('unhandledRejection', (reason) => {
  log.error('Unhandled promise rejection', { error: String(reason) });
});

process.on('uncaughtException', (err) => {
  log.error('Uncaught exception', { error: err.message, stack: err.stack });
  // Exit after logging — the process is in an undefined state
  process.exit(1);
});
