# Security Audit Report — Archibald Titan
  **Date:** May 24, 2026  
  **Scope:** Subscription system, authentication, data encryption, API security  
  **Repo:** leego972/archibald-titan-ai  

  ---

  ## Executive Summary

  The overall security posture is **strong**. The codebase has comprehensive security infrastructure already in place including helmet headers, CSRF protection, rate limiting on all sensitive endpoints, AES-256-GCM vault encryption, bcrypt passwords, Stripe webhook signature verification, and strict role-based access control via tRPC middleware. Two vulnerabilities were found and fixed during this audit.

  ---

  ## Fixes Applied

  ### FIX-1 · CRITICAL · Vault encryption key fallback to random bytes
  **File:** `server/fetcher-db.ts`  
  **Commit:** `80599d3`

  **Problem:** The vault encryption key fell back to `crypto.randomBytes(32)` if `JWT_SECRET` was not set. Every server restart would generate a new random key, making all previously encrypted credentials permanently unreadable. Multi-instance deployments would also produce mismatched keys across instances.

  **Before:**
  ```ts
  const ENCRYPTION_KEY = process.env.JWT_SECRET
    ? crypto.scryptSync(process.env.JWT_SECRET, "fetcher-vault-salt", 32)
    : crypto.randomBytes(32);  // ← silent data loss on every restart
  ```

  **After:**
  ```ts
  if (!process.env.JWT_SECRET) {
    throw new Error("[FATAL] JWT_SECRET env var is not set. Vault encryption key cannot be derived.");
  }
  const ENCRYPTION_KEY = crypto.scryptSync(process.env.JWT_SECRET, "fetcher-vault-salt", 32);
  ```

  ---

  ### FIX-2 · MEDIUM · Stripe webhook idempotency lost on server restart
  **File:** `server/stripe-router.ts`  
  **Commit:** `6ea1283`

  **Problem:** Processed Stripe event IDs were tracked in an in-memory `Set`. A server restart during Stripe's retry window (72 hours) would clear the set, allowing Stripe to replay events — potentially causing duplicate subscription upgrades, credit additions, or refills.

  **After:** Idempotency is now DB-backed using the existing `auditLogs` table (no migration required). Processed event IDs are persisted as `stripe_webhook:<eventId>` entries. Falls back to in-memory if the DB is temporarily unavailable, so webhook processing is never blocked.

  ---

  ## What Was Audited

  | Area | Finding |
  |------|---------|
  | Authentication middleware (`trpc.ts`) | ✅ Correct — `protectedProcedure` / `adminProcedure` / `publicProcedure` cleanly separated |
  | Admin routes (`admin-router.ts`) | ✅ Every procedure uses `adminProcedure` — no bypass possible |
  | Vault reveal (`v4-features-router.ts`) | ✅ `checkVaultAccess()` enforces ownership before decryption — no IDOR |
  | User secrets (`user-secrets-router.ts`) | ✅ API keys returned as masked values only — raw keys never sent to client |
  | Stripe checkout (`stripe-router.ts`) | ✅ All checkout/billing mutations use `protectedProcedure` |
  | Public Stripe endpoints | ✅ Only `getCreditPacks` and `getPricingTiers` are public — both read-only, no sensitive data |
  | Stripe webhook signature | ✅ `stripe.webhooks.constructEvent()` with raw body — cannot be spoofed |
  | Subscription gate (`subscription-gate.ts`) | ✅ Server-side plan enforcement — cannot be bypassed client-side |
  | Credit service (`credit-service.ts`) | ✅ `addCredits()` only called from webhook/payment confirmation paths — no direct user control |
  | Password security (`email-auth-router.ts`) | ✅ bcrypt with 12 salt rounds; min 8 / max 128 chars enforced |
  | Vault encryption (`fetcher-db.ts`) | ✅ AES-256-GCM with per-value random IVs — fixed key derivation (this audit) |
  | HTTP security headers (`_core/index.ts`) | ✅ Helmet + full custom CSP, HSTS, X-Frame-Options, Referrer-Policy, Permissions-Policy |
  | Rate limiting | ✅ Auth: 20/min · API: 200/min · Chat: 30/min · Stripe checkout: 10/min · Offensive tools: 15/min |
  | CSRF protection | ✅ Double-submit cookie pattern on all `/api/` POST requests |
  | SQL injection | ✅ Drizzle ORM parameterizes all queries — no raw SQL with user input |
  | Stack traces in production | ✅ Stripped by tRPC error formatter in `NODE_ENV=production` |
  | Required env var validation | ✅ Server refuses to start if `JWT_SECRET` or `DATABASE_URL` are missing |
  | Admin password reset | ✅ `adminProcedure` only; generates temp token; OAuth-only accounts blocked |
  | Session management (`sdk.ts`) | ✅ JWT verified with jose; 1-year expiry; cookie HttpOnly + SameSite |

  ---

  ## Remaining Recommendations (Low Priority)

  1. **API key scoping audit** — The `api-access-router.ts` allows enterprise users to generate keys with `credentials:read` scope. Verify that key-based access is isolated to the owning user's credentials only (not a shared pool).

  2. **Webhook event TTL** — The `auditLogs` table will accumulate `stripe_webhook:*` entries indefinitely. Add a periodic cleanup job or index `createdAt` to keep query performance stable (Stripe's retry window is 72 hours, so entries older than 7 days can be safely pruned).

  3. **CORS origin lockdown** — The server currently accepts cross-origin requests from any domain. Consider restricting `Access-Control-Allow-Origin` to `https://www.archibaldtitan.com` and `https://archibaldtitan.com` in production to reduce the attack surface for CSRF-style requests from third-party sites.

  ---

  ## No Issues Found In

  - Stripe payment flow and subscription lifecycle
  - Admin user management and data exposure
  - Vault access control and encryption
  - Credit balance manipulation
  - OAuth token handling
  - Error message information leakage
  