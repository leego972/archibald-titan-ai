/**
 * Credential Health Router — HaveIBeenPwned breach check, weak/reused/duplicate detection,
 * overall health score, and actionable recommendations.
 */
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { protectedProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "./db";
import { fetcherCredentials } from "../drizzle/schema";
import { PROVIDERS } from "../shared/fetcher";
import { logAudit } from "./audit-log-db";
import { decrypt } from "./fetcher-db";
import crypto from "crypto";

// ─── HaveIBeenPwned API ──────────────────────────────────────────
const HIBP_API_BASE = "https://api.pwnedpasswords.com";

/**
 * Check a password against HaveIBeenPwned using the k-anonymity range API.
 * Only the first 5 chars of the SHA-1 hash are sent — the full password never leaves the server.
 */
async function checkPasswordBreach(password: string): Promise<{ breached: boolean; count: number }> {
  const sha1 = crypto.createHash("sha1").update(password).digest("hex").toUpperCase();
  const prefix = sha1.slice(0, 5);
  const suffix = sha1.slice(5);

  try {
    const response = await fetch(`${HIBP_API_BASE}/range/${prefix}`, {
      headers: { "User-Agent": "ArchibaldTitan-CredentialHealth" },
    });
    if (!response.ok) return { breached: false, count: 0 };

    const text = await response.text();
    const lines = text.split("\n");
    for (const line of lines) {
      const [hashSuffix, countStr] = line.split(":");
      if (hashSuffix.trim() === suffix) {
        return { breached: true, count: parseInt(countStr.trim(), 10) };
      }
    }
    return { breached: false, count: 0 };
  } catch {
    return { breached: false, count: 0 };
  }
}

// ─── Credential Strength Analysis ────────────────────────────────

interface StrengthResult {
  score: number; // 0-100
  issues: string[];
  severity: "critical" | "high" | "medium" | "low" | "good";
}

function analyzeCredentialStrength(value: string): StrengthResult {
  const issues: string[] = [];
  let score = 100;

  // Length check
  if (value.length < 8) {
    issues.push("Very short credential (less than 8 characters)");
    score -= 40;
  } else if (value.length < 16) {
    issues.push("Short credential (less than 16 characters)");
    score -= 15;
  } else if (value.length < 24) {
    score -= 5;
  }

  // Entropy check
  const uniqueChars = new Set(value).size;
  const entropyRatio = uniqueChars / value.length;
  if (entropyRatio < 0.3) {
    issues.push("Low character diversity — credential may be predictable");
    score -= 25;
  } else if (entropyRatio < 0.5) {
    issues.push("Moderate character diversity");
    score -= 10;
  }

  // Common patterns
  const commonPatterns = [
    /^(password|123456|qwerty|admin|letmein|welcome|monkey|dragon)/i,
    /^(.)\1{5,}/,
    /^(abc|xyz|012|987|111|000)/i,
    /^test/i,
    /^demo/i,
    /^default/i,
    /^changeme/i,
  ];
  for (const pattern of commonPatterns) {
    if (pattern.test(value)) {
      issues.push("Contains common/default pattern");
      score -= 30;
      break;
    }
  }

  // Character class diversity
  const hasUpper = /[A-Z]/.test(value);
  const hasLower = /[a-z]/.test(value);
  const hasDigit = /[0-9]/.test(value);
  const hasSpecial = /[^a-zA-Z0-9]/.test(value);
  const classCount = [hasUpper, hasLower, hasDigit, hasSpecial].filter(Boolean).length;
  if (classCount < 2) {
    issues.push("Only uses one character class");
    score -= 15;
  }

  score = Math.max(0, Math.min(100, score));

  let severity: StrengthResult["severity"];
  if (score >= 80) severity = "good";
  else if (score >= 60) severity = "low";
  else if (score >= 40) severity = "medium";
  else if (score >= 20) severity = "high";
  else severity = "critical";

  return { score, issues, severity };
}

// ─── Router ──────────────────────────────────────────────────────

export const credentialHealthRouter = router({
  /**
   * Run a full health scan on all stored credentials.
   * Checks: breach status (HIBP), strength, duplicates/reuse, age.
   */
  scan: protectedProcedure.mutation(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

    const credentials = await db
      .select()
      .from(fetcherCredentials)
      .where(eq(fetcherCredentials.userId, ctx.user.id));

    if (credentials.length === 0) {
      return {
        overallScore: 100,
        totalCredentials: 0,
        breachedCount: 0,
        weakCount: 0,
        reusedCount: 0,
        oldCount: 0,
        results: [],
        recommendations: ["Add some credentials to get started with health monitoring."],
        scannedAt: new Date().toISOString(),
      };
    }

    // Track values for duplicate detection
    const valueHash = new Map<string, string[]>(); // hash -> provider IDs

    const results: Array<{
      credentialId: number;
      providerId: string;
      providerName: string;
      label: string;
      breached: boolean;
      breachCount: number;
      strength: StrengthResult;
      isDuplicate: boolean;
      duplicateWith: string[];
      ageInDays: number;
      isOld: boolean;
      healthScore: number;
      recommendations: string[];
    }> = [];

    for (const cred of credentials) {
      // Decrypt the credential value for analysis
      let value = "";
      try {
        value = decrypt(cred.encryptedValue);
      } catch {
        // If decryption fails, skip this credential
        continue;
      }

      const hash = crypto.createHash("sha256").update(value).digest("hex");

      // Track for duplicate detection
      if (!valueHash.has(hash)) {
        valueHash.set(hash, []);
      }
      valueHash.get(hash)!.push(cred.providerId);

      // Check HIBP (only for password-like credentials, not structured API keys)
      let breached = false;
      let breachCount = 0;
      const looksLikeApiKey = /^(sk-|sk_|ghp_|github_pat_|AKIA|AIza|xox[baprs]-|SG\.|npm_|dckr_pat_)/.test(value);
      if (!looksLikeApiKey && value.length > 0 && value.length < 128) {
        const hibpResult = await checkPasswordBreach(value);
        breached = hibpResult.breached;
        breachCount = hibpResult.count;
      }

      // Strength analysis
      const strength = analyzeCredentialStrength(value);

      // Age calculation
      const createdAt = cred.createdAt ? new Date(cred.createdAt) : new Date();
      const ageInDays = Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
      const isOld = ageInDays > 90;

      // Per-credential recommendations
      const recs: string[] = [];
      if (breached) {
        recs.push(`This credential has appeared in ${breachCount.toLocaleString()} data breaches. Rotate it immediately.`);
      }
      if (strength.severity === "critical" || strength.severity === "high") {
        recs.push("This credential is weak. Generate a stronger one from the provider's dashboard.");
      }
      if (isOld) {
        recs.push(`This credential is ${ageInDays} days old. Consider rotating it for security.`);
      }

      // Calculate per-credential health score
      let healthScore = 100;
      if (breached) healthScore -= 40;
      healthScore -= (100 - strength.score) * 0.3;
      if (isOld) healthScore -= 10;
      healthScore = Math.max(0, Math.round(healthScore));

      results.push({
        credentialId: cred.id,
        providerId: cred.providerId,
        providerName: cred.providerName || PROVIDERS[cred.providerId]?.name || cred.providerId,
        label: cred.keyLabel || cred.keyType || cred.providerId,
        breached,
        breachCount,
        strength,
        isDuplicate: false,
        duplicateWith: [],
        ageInDays,
        isOld,
        healthScore,
        recommendations: recs,
      });
    }

    // Phase 2: Mark duplicates
    for (const [, providerIds] of valueHash) {
      if (providerIds.length > 1) {
        for (const result of results) {
          if (providerIds.includes(result.providerId)) {
            result.isDuplicate = true;
            result.duplicateWith = providerIds.filter((p) => p !== result.providerId);
            result.healthScore = Math.max(0, result.healthScore - 15);
            result.recommendations.push(
              `This credential is reused across ${providerIds.length} providers (${providerIds.map((p) => PROVIDERS[p]?.name ?? p).join(", ")}). Use unique credentials for each provider.`
            );
          }
        }
      }
    }

    // Phase 3: Aggregate stats
    const breachedCount = results.filter((r) => r.breached).length;
    const weakCount = results.filter((r) => r.strength.severity === "critical" || r.strength.severity === "high").length;
    const reusedCount = results.filter((r) => r.isDuplicate).length;
    const oldCount = results.filter((r) => r.isOld).length;

    const overallScore =
      results.length > 0
        ? Math.round(results.reduce((sum, r) => sum + r.healthScore, 0) / results.length)
        : 100;

    const recommendations: string[] = [];
    if (breachedCount > 0) {
      recommendations.push(`${breachedCount} credential(s) found in known data breaches. Rotate them immediately.`);
    }
    if (weakCount > 0) {
      recommendations.push(`${weakCount} credential(s) have weak strength. Generate stronger replacements.`);
    }
    if (reusedCount > 0) {
      recommendations.push(`${reusedCount} credential(s) are reused across providers. Use unique credentials for each.`);
    }
    if (oldCount > 0) {
      recommendations.push(`${oldCount} credential(s) are over 90 days old. Consider rotating them.`);
    }
    if (recommendations.length === 0) {
      recommendations.push("All credentials look healthy. Keep up the good security practices!");
    }

    await logAudit({
      userId: ctx.user.id,
      action: "credential_health_scan",
      resource: "credentials",
      details: {
        totalCredentials: credentials.length,
        breachedCount,
        weakCount,
        reusedCount,
        oldCount,
        overallScore,
      },
    });

    return {
      overallScore,
      totalCredentials: credentials.length,
      breachedCount,
      weakCount,
      reusedCount,
      oldCount,
      results: results.sort((a, b) => a.healthScore - b.healthScore),
      recommendations,
      scannedAt: new Date().toISOString(),
    };
  }),

  /**
   * Quick check a single credential against HaveIBeenPwned.
   */
  checkBreach: protectedProcedure
    .input(z.object({ credentialId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const [cred] = await db
        .select()
        .from(fetcherCredentials)
        .where(
          and(
            eq(fetcherCredentials.id, input.credentialId),
            eq(fetcherCredentials.userId, ctx.user.id)
          )
        )
        .limit(1);

      if (!cred) throw new TRPCError({ code: "NOT_FOUND", message: "Credential not found" });

      let value = "";
      try {
        value = decrypt(cred.encryptedValue);
      } catch {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to decrypt credential" });
      }

      const result = await checkPasswordBreach(value);

      await logAudit({
        userId: ctx.user.id,
        action: "credential_breach_check",
        resource: "credential",
        resourceId: String(input.credentialId),
        details: {
          providerId: cred.providerId,
          breached: result.breached,
        },
      });

      return {
        credentialId: input.credentialId,
        providerId: cred.providerId,
        providerName: cred.providerName || PROVIDERS[cred.providerId]?.name || cred.providerId,
        breached: result.breached,
        breachCount: result.count,
        checkedAt: new Date().toISOString(),
      };
    }),
});
