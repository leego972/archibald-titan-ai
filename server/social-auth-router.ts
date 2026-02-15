/**
 * Independent Social OAuth Router
 * 
 * Direct GitHub and Google OAuth flows — no Manus proxy.
 * Creates/links users and issues JWT sessions identical to email auth.
 * 
 * Cross-domain flow (when PUBLIC_URL differs from MANUS_ORIGIN):
 *   1. User on archibaldtitan.com clicks "Sign in with Google"
 *   2. Browser goes to archibaldtitan.com/api/auth/google (relative URL)
 *   3. Server redirects to Google with callback = manus.space (registered domain)
 *   4. Google redirects back to manus.space/api/auth/google/callback
 *   5. Server creates a one-time token, redirects to archibaldtitan.com/api/auth/token-exchange?token=XXX
 *   6. Token-exchange endpoint sets the session cookie on archibaldtitan.com and redirects to /dashboard
 */

import { Express, Request, Response } from "express";
import crypto from "crypto";
import { eq, and } from "drizzle-orm";
import { getDb } from "./db";
import { users, identityProviders } from "../drizzle/schema";
import { sdk } from "./_core/sdk";
import { getSessionCookieOptions } from "./_core/cookies";
import { COOKIE_NAME, ONE_YEAR_MS } from "../shared/const";
import { ENV } from "./_core/env";

// ─── Origin Helpers ──────────────────────────────────────────────
// The manus.space domain is registered in Google/GitHub OAuth console.
// We MUST use it for OAuth callbacks (redirect_uri), then transfer the
// session to the public custom domain via a one-time token exchange.
const MANUS_ORIGIN = "https://architabot-f68pur9a.manus.space";

function getOAuthCallbackOrigin(): string {
  return MANUS_ORIGIN;
}

function getPublicOrigin(): string {
  if (ENV.publicUrl) return ENV.publicUrl.replace(/\/$/, "");
  return MANUS_ORIGIN;
}

// ─── CSRF State Store ──────────────────────────────────────────────
const pendingStates = new Map<string, { provider: string; returnPath: string; expiresAt: number; mode: string }>();

// ─── One-Time Token Store (for cross-domain cookie transfer) ──────
const pendingTokens = new Map<string, { sessionToken: string; returnPath: string; expiresAt: number }>();

// Cleanup expired states and tokens every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of Array.from(pendingStates.entries())) {
    if (now > val.expiresAt) pendingStates.delete(key);
  }
  for (const [key, val] of Array.from(pendingTokens.entries())) {
    if (now > val.expiresAt) pendingTokens.delete(key);
  }
}, 5 * 60 * 1000);

// ─── GitHub OAuth Helpers ──────────────────────────────────────────

async function exchangeGitHubCode(code: string, redirectUri: string): Promise<{ access_token: string }> {
  const res = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      client_id: ENV.githubClientId,
      client_secret: ENV.githubClientSecret,
      code,
      redirect_uri: redirectUri,
    }),
  });
  const data = await res.json();
  if (data.error) throw new Error(`GitHub token exchange failed: ${data.error_description || data.error}`);
  return data;
}

async function getGitHubUser(accessToken: string): Promise<{ id: number; login: string; name: string | null; email: string | null; avatar_url: string }> {
  const res = await fetch("https://api.github.com/user", {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
  });
  if (!res.ok) throw new Error("Failed to fetch GitHub user");
  const user = await res.json();
  if (!user.email) {
    const emailRes = await fetch("https://api.github.com/user/emails", {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
    });
    if (emailRes.ok) {
      const emails = await emailRes.json();
      const primary = emails.find((e: any) => e.primary && e.verified);
      if (primary) user.email = primary.email;
      else {
        const verified = emails.find((e: any) => e.verified);
        if (verified) user.email = verified.email;
      }
    }
  }
  return user;
}

// ─── Google OAuth Helpers ──────────────────────────────────────────

async function exchangeGoogleCode(code: string, redirectUri: string): Promise<{ access_token: string; id_token?: string }> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: ENV.googleClientId,
      client_secret: ENV.googleClientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  const data = await res.json();
  if (data.error) throw new Error(`Google token exchange failed: ${data.error_description || data.error}`);
  return data;
}

async function getGoogleUser(accessToken: string): Promise<{ sub: string; name: string; email: string; picture: string; email_verified: boolean }> {
  const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error("Failed to fetch Google user info");
  return res.json();
}

// ─── Shared: Find or Create User ───────────────────────────────────

async function findOrCreateOAuthUser(opts: {
  provider: string;
  providerAccountId: string;
  email: string | null;
  name: string | null;
  avatarUrl: string | null;
}): Promise<{ userId: number; openId: string; name: string; isNew: boolean }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const existingLink = await db
    .select({ userId: identityProviders.userId })
    .from(identityProviders)
    .where(and(eq(identityProviders.provider, opts.provider), eq(identityProviders.providerAccountId, opts.providerAccountId)))
    .limit(1);

  if (existingLink.length > 0) {
    const user = await db.select().from(users).where(eq(users.id, existingLink[0].userId)).limit(1);
    if (user.length > 0) {
      await db.update(identityProviders).set({ lastUsedAt: new Date() }).where(and(eq(identityProviders.provider, opts.provider), eq(identityProviders.providerAccountId, opts.providerAccountId)));
      await db.update(users).set({ lastSignedIn: new Date() }).where(eq(users.id, user[0].id));
      return { userId: user[0].id, openId: user[0].openId, name: user[0].name || "", isNew: false };
    }
  }

  if (opts.email) {
    const existingUser = await db.select().from(users).where(eq(users.email, opts.email.toLowerCase())).limit(1);
    if (existingUser.length > 0) {
      await db.insert(identityProviders).values({
        userId: existingUser[0].id, provider: opts.provider, providerAccountId: opts.providerAccountId,
        email: opts.email, displayName: opts.name, avatarUrl: opts.avatarUrl, linkedAt: new Date(), lastUsedAt: new Date(),
      });
      await db.update(users).set({ lastSignedIn: new Date() }).where(eq(users.id, existingUser[0].id));
      return { userId: existingUser[0].id, openId: existingUser[0].openId, name: existingUser[0].name || "", isNew: false };
    }
  }

  const openId = `${opts.provider}_${crypto.randomUUID().replace(/-/g, "")}`;
  const role = openId === ENV.ownerOpenId ? "admin" : "user";
  const displayName = opts.name || (opts.email ? opts.email.split("@")[0] : "User");

  await db.insert(users).values({
    openId, name: displayName, email: opts.email?.toLowerCase() || null,
    loginMethod: opts.provider, role, emailVerified: true, lastSignedIn: new Date(),
  });

  const newUser = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  if (newUser.length === 0) throw new Error("Failed to create user");

  await db.insert(identityProviders).values({
    userId: newUser[0].id, provider: opts.provider, providerAccountId: opts.providerAccountId,
    email: opts.email, displayName: opts.name, avatarUrl: opts.avatarUrl, linkedAt: new Date(), lastUsedAt: new Date(),
  });

  return { userId: newUser[0].id, openId, name: displayName, isNew: true };
}

// ─── Helper: Issue session and redirect (handles cross-domain) ────

async function issueSessionAndRedirect(
  req: Request, res: Response,
  result: { userId: number; openId: string; name: string; isNew: boolean },
  returnPath: string, logPrefix: string, logDetail: string
) {
  const sessionToken = await sdk.createSessionToken(result.openId, { name: result.name, expiresInMs: ONE_YEAR_MS });
  const publicOrigin = getPublicOrigin();
  const isCrossDomain = publicOrigin !== MANUS_ORIGIN;

  if (isCrossDomain) {
    const oneTimeToken = crypto.randomBytes(32).toString("hex");
    pendingTokens.set(oneTimeToken, { sessionToken, returnPath, expiresAt: Date.now() + 2 * 60 * 1000 });
    console.log(`${logPrefix} ${logDetail} → user ${result.userId} (${result.isNew ? "new" : "existing"}) [cross-domain token issued]`);
    return res.redirect(302, `${publicOrigin}/api/auth/token-exchange?token=${oneTimeToken}&returnPath=${encodeURIComponent(returnPath)}`);
  } else {
    const cookieOptions = getSessionCookieOptions(req);
    res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
    console.log(`${logPrefix} ${logDetail} → user ${result.userId} (${result.isNew ? "new" : "existing"})`);
    return res.redirect(302, `${publicOrigin}${returnPath}`);
  }
}

// ─── Route Registration ────────────────────────────────────────────

export function registerSocialAuthRoutes(app: Express) {

  // ─── GET /api/auth/token-exchange ────────────────────────────────
  app.get("/api/auth/token-exchange", (req: Request, res: Response) => {
    const token = req.query.token as string;
    const returnPath = (req.query.returnPath as string) || "/dashboard";
    if (!token) return res.status(400).send("Missing token parameter");

    const pending = pendingTokens.get(token);
    if (!pending) {
      console.warn("[Token Exchange] Invalid or expired token");
      return res.redirect("/login?error=" + encodeURIComponent("Login session expired. Please try again."));
    }
    pendingTokens.delete(token);

    if (Date.now() > pending.expiresAt) {
      console.warn("[Token Exchange] Token expired");
      return res.redirect("/login?error=" + encodeURIComponent("Login session expired. Please try again."));
    }

    const cookieOptions = getSessionCookieOptions(req);
    res.cookie(COOKIE_NAME, pending.sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
    console.log(`[Token Exchange] Session cookie set, redirecting to ${returnPath}`);
    return res.redirect(302, returnPath);
  });

  // ─── GET /api/auth/github ─────────────────────────────────────────
  app.get("/api/auth/github", (req: Request, res: Response) => {
    const returnPath = (req.query.returnPath as string) || "/dashboard";
    const mode = (req.query.mode as string) || "login";
    const state = crypto.randomBytes(32).toString("hex");
    pendingStates.set(state, { provider: "github", returnPath, expiresAt: Date.now() + 10 * 60 * 1000, mode });

    const callbackOrigin = getOAuthCallbackOrigin();
    const params = new URLSearchParams({
      client_id: ENV.githubClientId,
      redirect_uri: `${callbackOrigin}/api/auth/github/callback`,
      scope: "read:user user:email",
      state,
    });
    res.redirect(`https://github.com/login/oauth/authorize?${params.toString()}`);
  });

  // ─── GET /api/auth/github/callback ────────────────────────────────
  app.get("/api/auth/github/callback", async (req: Request, res: Response) => {
    const code = req.query.code as string;
    const state = req.query.state as string;
    if (!code || !state) return res.status(400).send("Missing code or state parameter");

    const pending = pendingStates.get(state);
    if (!pending || pending.provider !== "github") return res.status(400).send("Invalid or expired state. Please try again.");
    pendingStates.delete(state);
    if (Date.now() > pending.expiresAt) return res.status(400).send("OAuth state expired. Please try again.");

    try {
      const callbackOrigin = getOAuthCallbackOrigin();
      const redirectUri = `${callbackOrigin}/api/auth/github/callback`;
      const tokenData = await exchangeGitHubCode(code, redirectUri);
      const ghUser = await getGitHubUser(tokenData.access_token);

      const result = await findOrCreateOAuthUser({
        provider: "github", providerAccountId: String(ghUser.id),
        email: ghUser.email, name: ghUser.name || ghUser.login, avatarUrl: ghUser.avatar_url,
      });

      await issueSessionAndRedirect(req, res, result, pending.returnPath, "[Social Auth]", `GitHub login: ${ghUser.login} (${ghUser.email})`);
    } catch (error: any) {
      console.error("[Social Auth] GitHub callback failed:", error);
      const publicOrigin = getPublicOrigin();
      res.redirect(`${publicOrigin}/login?error=${encodeURIComponent("GitHub login failed. Please try again.")}`);
    }
  });

  // ─── GET /api/auth/google ─────────────────────────────────────────
  app.get("/api/auth/google", (req: Request, res: Response) => {
    const returnPath = (req.query.returnPath as string) || "/dashboard";
    const mode = (req.query.mode as string) || "login";
    const state = crypto.randomBytes(32).toString("hex");
    pendingStates.set(state, { provider: "google", returnPath, expiresAt: Date.now() + 10 * 60 * 1000, mode });

    const callbackOrigin = getOAuthCallbackOrigin();
    const params = new URLSearchParams({
      client_id: ENV.googleClientId,
      redirect_uri: `${callbackOrigin}/api/auth/google/callback`,
      response_type: "code",
      scope: "openid email profile",
      state,
      access_type: "offline",
      prompt: "consent",
    });
    res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
  });

  // ─── GET /api/auth/google/callback ────────────────────────────────
  app.get("/api/auth/google/callback", async (req: Request, res: Response) => {
    const code = req.query.code as string;
    const state = req.query.state as string;
    if (!code || !state) return res.status(400).send("Missing code or state parameter");

    const pending = pendingStates.get(state);
    if (!pending || pending.provider !== "google") return res.status(400).send("Invalid or expired state. Please try again.");
    pendingStates.delete(state);
    if (Date.now() > pending.expiresAt) return res.status(400).send("OAuth state expired. Please try again.");

    try {
      const callbackOrigin = getOAuthCallbackOrigin();
      const redirectUri = `${callbackOrigin}/api/auth/google/callback`;
      const tokenData = await exchangeGoogleCode(code, redirectUri);
      const googleUser = await getGoogleUser(tokenData.access_token);

      const result = await findOrCreateOAuthUser({
        provider: "google", providerAccountId: googleUser.sub,
        email: googleUser.email, name: googleUser.name, avatarUrl: googleUser.picture,
      });

      await issueSessionAndRedirect(req, res, result, pending.returnPath, "[Social Auth]", `Google login: ${googleUser.email}`);
    } catch (error: any) {
      console.error("[Social Auth] Google callback failed:", error);
      const publicOrigin = getPublicOrigin();
      res.redirect(`${publicOrigin}/login?error=${encodeURIComponent("Google login failed. Please try again.")}`);
    }
  });
}
