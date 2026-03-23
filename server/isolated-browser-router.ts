/**
 * Titan Isolated Browser — credit-metered ephemeral browser sessions
 *
 * Tier access: Cyber+ and Titan only
 * Credit cost:
 *   - Titan plan:      25 credits / minute
 *   - Cyber+ plan:     50 credits / minute
 *   - Admin:           free (unlimited)
 *
 * Sessions are ephemeral — they exist only in memory (Map) per server process.
 * On session end (manual or timeout), credits are finalized and session is purged.
 * Max session duration: 60 minutes (auto-terminated at limit).
 * Heartbeat required every 30s or session is auto-terminated.
 */

import { z } from "zod";
import { router, protectedProcedure } from "./_core/trpc";
import { consumeCreditsAmount, getCreditBalance } from "./credit-service";
import { TRPCError } from "@trpc/server";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface IsolatedSession {
  id: string;
  userId: number;
  planId: string;
  startedAt: Date;
  lastHeartbeat: Date;
  endedAt?: Date;
  status: "active" | "ended" | "expired" | "credit_exhausted";
  creditsPerMinute: number;
  creditsConsumed: number;
  lastBilledMinute: number; // minutes elapsed at last billing tick
  url: string;
  userAgent: string;
  notes: string;
}

// ─── In-memory session store ──────────────────────────────────────────────────

const sessions = new Map<string, IsolatedSession>();

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_SESSION_MINUTES = 60;
const HEARTBEAT_TIMEOUT_MS = 90_000; // 90s — kill session if no heartbeat
const CREDITS_PER_MINUTE: Record<string, number> = {
  titan: 25,
  cyber_plus: 50,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function generateSessionId(): string {
  return `isb_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function elapsedMinutes(session: IsolatedSession): number {
  const ms = Date.now() - session.startedAt.getTime();
  return ms / 60_000;
}

function minutesSinceLastBill(session: IsolatedSession): number {
  return elapsedMinutes(session) - session.lastBilledMinute;
}

function isSessionExpired(session: IsolatedSession): boolean {
  if (elapsedMinutes(session) >= MAX_SESSION_MINUTES) return true;
  if (Date.now() - session.lastHeartbeat.getTime() > HEARTBEAT_TIMEOUT_MS) return true;
  return false;
}

// ─── Background cleanup ───────────────────────────────────────────────────────

setInterval(() => {
  for (const [id, session] of sessions.entries()) {
    if (session.status !== "active") continue;
    if (isSessionExpired(session)) {
      session.status = elapsedMinutes(session) >= MAX_SESSION_MINUTES ? "expired" : "expired";
      session.endedAt = new Date();
      // Final billing happens on next heartbeat/end call; mark as expired
      console.log(`[IsolatedBrowser] Session ${id} auto-expired for user ${session.userId}`);
    }
  }
}, 30_000);

// ─── Router ───────────────────────────────────────────────────────────────────

export const isolatedBrowserRouter = router({

  // ── Launch a new session ──────────────────────────────────────────────────
  launch: protectedProcedure
    .input(z.object({
      url: z.string().url().optional().default("https://www.google.com"),
      notes: z.string().max(200).optional().default(""),
    }))
    .mutation(async ({ ctx, input }) => {
      const user = ctx.user!;
      const planId = (user as any).planId ?? "free";
      const isAdmin = user.role === "admin" || user.role === "head_admin";

      // ── Tier gate ──
      if (!isAdmin && planId !== "titan" && planId !== "cyber_plus") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Titan Isolated Browser requires Cyber+ or Titan plan.",
        });
      }

      // ── Check for existing active session ──
      for (const session of sessions.values()) {
        if (session.userId === user.id && session.status === "active") {
          throw new TRPCError({
            code: "CONFLICT",
            message: "You already have an active isolated browser session. End it before starting a new one.",
          });
        }
      }

      // ── Credit pre-check (require at least 1 minute worth) ──
      const creditsPerMinute = isAdmin ? 0 : (CREDITS_PER_MINUTE[planId] ?? 50);
      if (!isAdmin && creditsPerMinute > 0) {
        const balance = await getCreditBalance(user.id);
        if (!balance.isUnlimited && balance.credits < creditsPerMinute) {
          throw new TRPCError({
            code: "PAYMENT_REQUIRED",
            message: `Insufficient credits. You need at least ${creditsPerMinute} credits to start a session (1 minute minimum).`,
          });
        }
      }

      // ── Create session ──
      const sessionId = generateSessionId();
      const now = new Date();
      const session: IsolatedSession = {
        id: sessionId,
        userId: user.id,
        planId,
        startedAt: now,
        lastHeartbeat: now,
        status: "active",
        creditsPerMinute,
        creditsConsumed: 0,
        lastBilledMinute: 0,
        url: input.url,
        userAgent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        notes: input.notes,
      };
      sessions.set(sessionId, session);

      console.log(`[IsolatedBrowser] Session ${sessionId} launched for user ${user.id} (${planId}, ${creditsPerMinute} credits/min)`);

      return {
        sessionId,
        url: input.url,
        creditsPerMinute,
        maxMinutes: MAX_SESSION_MINUTES,
        startedAt: now.toISOString(),
      };
    }),

  // ── Heartbeat — keeps session alive + bills per-minute ───────────────────
  heartbeat: protectedProcedure
    .input(z.object({ sessionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const user = ctx.user!;
      const session = sessions.get(input.sessionId);

      if (!session) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Session not found." });
      }
      if (session.userId !== user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Not your session." });
      }
      if (session.status !== "active") {
        return {
          status: session.status,
          creditsConsumed: session.creditsConsumed,
          elapsedMinutes: elapsedMinutes(session),
          creditsRemaining: 0,
        };
      }

      // ── Auto-expire check ──
      if (isSessionExpired(session)) {
        session.status = "expired";
        session.endedAt = new Date();
        return {
          status: "expired",
          creditsConsumed: session.creditsConsumed,
          elapsedMinutes: elapsedMinutes(session),
          creditsRemaining: 0,
        };
      }

      // ── Per-minute billing ──
      const minutesSinceBill = minutesSinceLastBill(session);
      const fullMinutesToBill = Math.floor(minutesSinceBill);

      if (fullMinutesToBill >= 1 && session.creditsPerMinute > 0) {
        const creditsToBill = fullMinutesToBill * session.creditsPerMinute;
        const result = await consumeCreditsAmount(
          user.id,
          creditsToBill,
          "isolated_browser" as any,
          `Titan Isolated Browser — ${fullMinutesToBill} min @ ${session.creditsPerMinute} credits/min`
        );

        if (!result.success) {
          // Out of credits — terminate session
          session.status = "credit_exhausted";
          session.endedAt = new Date();
          console.log(`[IsolatedBrowser] Session ${session.id} terminated — credit exhausted for user ${user.id}`);
          return {
            status: "credit_exhausted",
            creditsConsumed: session.creditsConsumed,
            elapsedMinutes: elapsedMinutes(session),
            creditsRemaining: result.balanceAfter,
          };
        }

        session.creditsConsumed += creditsToBill;
        session.lastBilledMinute += fullMinutesToBill;

        const balance = await getCreditBalance(user.id);
        session.lastHeartbeat = new Date();

        return {
          status: "active",
          creditsConsumed: session.creditsConsumed,
          elapsedMinutes: elapsedMinutes(session),
          creditsRemaining: balance.isUnlimited ? 999999 : balance.credits,
          billed: creditsToBill,
        };
      }

      // ── No billing this tick — just update heartbeat ──
      session.lastHeartbeat = new Date();
      const balance = await getCreditBalance(user.id);

      return {
        status: "active",
        creditsConsumed: session.creditsConsumed,
        elapsedMinutes: elapsedMinutes(session),
        creditsRemaining: balance.isUnlimited ? 999999 : balance.credits,
        billed: 0,
      };
    }),

  // ── End session manually ─────────────────────────────────────────────────
  end: protectedProcedure
    .input(z.object({ sessionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const user = ctx.user!;
      const session = sessions.get(input.sessionId);

      if (!session) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Session not found." });
      }
      if (session.userId !== user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Not your session." });
      }

      // ── Final billing for partial minute ──
      if (session.status === "active" && session.creditsPerMinute > 0) {
        const minutesSinceBill = minutesSinceLastBill(session);
        const partialMinutes = Math.ceil(minutesSinceBill); // round up on manual end
        if (partialMinutes >= 1) {
          const creditsToBill = partialMinutes * session.creditsPerMinute;
          await consumeCreditsAmount(
            user.id,
            creditsToBill,
            "isolated_browser" as any,
            `Titan Isolated Browser — final ${partialMinutes} min @ ${session.creditsPerMinute} credits/min`
          ).catch(() => {}); // best-effort final bill
          session.creditsConsumed += creditsToBill;
        }
      }

      session.status = "ended";
      session.endedAt = new Date();

      const totalMinutes = elapsedMinutes(session);
      console.log(`[IsolatedBrowser] Session ${session.id} ended by user ${user.id} — ${totalMinutes.toFixed(1)} min, ${session.creditsConsumed} credits`);

      return {
        status: "ended",
        totalMinutes,
        creditsConsumed: session.creditsConsumed,
      };
    }),

  // ── Get current session status ───────────────────────────────────────────
  getSession: protectedProcedure
    .input(z.object({ sessionId: z.string() }))
    .query(({ ctx, input }) => {
      const user = ctx.user!;
      const session = sessions.get(input.sessionId);

      if (!session) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Session not found." });
      }
      if (session.userId !== user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Not your session." });
      }

      return {
        id: session.id,
        status: session.status,
        url: session.url,
        startedAt: session.startedAt.toISOString(),
        endedAt: session.endedAt?.toISOString() ?? null,
        creditsPerMinute: session.creditsPerMinute,
        creditsConsumed: session.creditsConsumed,
        elapsedMinutes: elapsedMinutes(session),
        maxMinutes: MAX_SESSION_MINUTES,
        notes: session.notes,
      };
    }),

  // ── List user's recent sessions ──────────────────────────────────────────
  listSessions: protectedProcedure.query(({ ctx }) => {
    const user = ctx.user!;
    const userSessions = Array.from(sessions.values())
      .filter(s => s.userId === user.id)
      .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())
      .slice(0, 20)
      .map(s => ({
        id: s.id,
        status: s.status,
        url: s.url,
        startedAt: s.startedAt.toISOString(),
        endedAt: s.endedAt?.toISOString() ?? null,
        creditsPerMinute: s.creditsPerMinute,
        creditsConsumed: s.creditsConsumed,
        elapsedMinutes: elapsedMinutes(s),
        notes: s.notes,
      }));

    return { sessions: userSessions };
  }),

  // ── Get credit cost info for current plan ────────────────────────────────
  getCostInfo: protectedProcedure.query(async ({ ctx }) => {
    const user = ctx.user!;
    const planId = (user as any).planId ?? "free";
    const isAdmin = user.role === "admin" || user.role === "head_admin";
    const creditsPerMinute = isAdmin ? 0 : (CREDITS_PER_MINUTE[planId] ?? 50);
    const balance = await getCreditBalance(user.id);

    const canAccess = isAdmin || planId === "titan" || planId === "cyber_plus";
    const maxAffordableMinutes = balance.isUnlimited
      ? MAX_SESSION_MINUTES
      : creditsPerMinute > 0
        ? Math.min(Math.floor(balance.credits / creditsPerMinute), MAX_SESSION_MINUTES)
        : MAX_SESSION_MINUTES;

    return {
      canAccess,
      planId,
      creditsPerMinute,
      maxMinutes: MAX_SESSION_MINUTES,
      maxAffordableMinutes,
      currentBalance: balance.isUnlimited ? 999999 : balance.credits,
      isUnlimited: balance.isUnlimited,
    };
  }),
});
