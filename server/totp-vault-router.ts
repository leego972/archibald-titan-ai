/**
 * TOTP Vault Router — Store and generate TOTP codes for external services.
 *
 * Allows users to store TOTP secrets for their external accounts (GitHub, AWS, etc.)
 * and generate time-based one-time passwords on demand.
 */
import { z } from "zod";
import { eq, and, desc } from "drizzle-orm";
import { protectedProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "./db";
import { totpSecrets } from "../drizzle/schema";
import { logAudit } from "./audit-log-db";
import crypto from "crypto";

// ─── AES-256 encryption (same key as vault) ─────────────────────
const VAULT_KEY = process.env.JWT_SECRET?.slice(0, 32).padEnd(32, "0") || "archibald-titan-vault-key-32char";

function encryptValue(plaintext: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-cbc", Buffer.from(VAULT_KEY, "utf8"), iv);
  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");
  return iv.toString("hex") + ":" + encrypted;
}

function decryptValue(ciphertext: string): string {
  const [ivHex, encrypted] = ciphertext.split(":");
  if (!ivHex || !encrypted) throw new Error("Invalid encrypted value");
  const iv = Buffer.from(ivHex, "hex");
  const decipher = crypto.createDecipheriv("aes-256-cbc", Buffer.from(VAULT_KEY, "utf8"), iv);
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

// ─── TOTP Generation (RFC 6238) ─────────────────────────────────

function generateTOTP(secret: string, algorithm = "SHA1", digits = 6, period = 30): { code: string; remaining: number } {
  const now = Math.floor(Date.now() / 1000);
  const counter = Math.floor(now / period);
  const remaining = period - (now % period);

  // Decode base32 secret
  const base32Chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const cleanSecret = secret.replace(/[\s=-]/g, "").toUpperCase();
  let bits = "";
  for (const ch of cleanSecret) {
    const val = base32Chars.indexOf(ch);
    if (val === -1) continue;
    bits += val.toString(2).padStart(5, "0");
  }
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.substring(i, i + 8), 2));
  }
  const key = Buffer.from(bytes);

  // Counter to bytes (big-endian 8 bytes)
  const counterBuf = Buffer.alloc(8);
  let tmp = counter;
  for (let i = 7; i >= 0; i--) {
    counterBuf[i] = tmp & 0xff;
    tmp = Math.floor(tmp / 256);
  }

  // HMAC
  const alg = algorithm.toLowerCase().replace("-", "");
  const hmac = crypto.createHmac(alg === "sha1" ? "sha1" : alg === "sha256" ? "sha256" : "sha512", key);
  hmac.update(counterBuf);
  const hash = hmac.digest();

  // Dynamic truncation
  const offset = hash[hash.length - 1] & 0x0f;
  const binary =
    ((hash[offset] & 0x7f) << 24) |
    ((hash[offset + 1] & 0xff) << 16) |
    ((hash[offset + 2] & 0xff) << 8) |
    (hash[offset + 3] & 0xff);

  const otp = binary % Math.pow(10, digits);
  const code = otp.toString().padStart(digits, "0");

  return { code, remaining };
}

// ─── Router ─────────────────────────────────────────────────────

export const totpVaultRouter = router({
  // List all TOTP entries (without secrets)
  list: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];
    const items = await db.select()
      .from(totpSecrets)
      .where(eq(totpSecrets.userId, ctx.user.id))
      .orderBy(desc(totpSecrets.lastUsedAt));

    // Generate current codes for each
    return items.map(item => {
      const secret = decryptValue(item.encryptedSecret);
      const { code, remaining } = generateTOTP(secret, item.algorithm || "SHA1", item.digits, item.period);
      return {
        id: item.id,
        name: item.name,
        issuer: item.issuer,
        algorithm: item.algorithm,
        digits: item.digits,
        period: item.period,
        iconUrl: item.iconUrl,
        tags: item.tags,
        currentCode: code,
        remainingSeconds: remaining,
        lastUsedAt: item.lastUsedAt,
        createdAt: item.createdAt,
      };
    });
  }),

  // Add a new TOTP secret
  add: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(256),
      issuer: z.string().max(256).optional(),
      secret: z.string().min(8).max(512), // base32 encoded TOTP secret
      algorithm: z.enum(["SHA1", "SHA256", "SHA512"]).default("SHA1"),
      digits: z.number().min(6).max(8).default(6),
      period: z.number().min(15).max(120).default(30),
      iconUrl: z.string().max(512).optional(),
      tags: z.array(z.string()).max(10).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      // Validate the secret by trying to generate a code
      try {
        generateTOTP(input.secret, input.algorithm, input.digits, input.period);
      } catch {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid TOTP secret. Ensure it's a valid base32-encoded string." });
      }

      const [result] = await db.insert(totpSecrets).values({
        userId: ctx.user.id,
        name: input.name,
        issuer: input.issuer || null,
        encryptedSecret: encryptValue(input.secret),
        algorithm: input.algorithm,
        digits: input.digits,
        period: input.period,
        iconUrl: input.iconUrl || null,
        tags: input.tags || null,
      }).$returningId();

      await logAudit({
        userId: ctx.user.id,
        userName: ctx.user.name || "Unknown",
        action: "totp.added",
        resource: `totp:${result.id}`,
        details: { name: input.name, issuer: input.issuer },
      });

      return { id: result.id, name: input.name };
    }),

  // Get a fresh TOTP code (and mark as used)
  getCode: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [item] = await db.select()
        .from(totpSecrets)
        .where(and(eq(totpSecrets.id, input.id), eq(totpSecrets.userId, ctx.user.id)))
        .limit(1);

      if (!item) throw new TRPCError({ code: "NOT_FOUND", message: "TOTP entry not found" });

      const secret = decryptValue(item.encryptedSecret);
      const { code, remaining } = generateTOTP(secret, item.algorithm || "SHA1", item.digits, item.period);

      // Update last used
      await db.update(totpSecrets)
        .set({ lastUsedAt: new Date() })
        .where(eq(totpSecrets.id, input.id));

      return { code, remaining, name: item.name };
    }),

  // Delete a TOTP entry
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [item] = await db.select()
        .from(totpSecrets)
        .where(and(eq(totpSecrets.id, input.id), eq(totpSecrets.userId, ctx.user.id)))
        .limit(1);

      if (!item) throw new TRPCError({ code: "NOT_FOUND" });

      await db.delete(totpSecrets)
        .where(and(eq(totpSecrets.id, input.id), eq(totpSecrets.userId, ctx.user.id)));

      await logAudit({
        userId: ctx.user.id,
        userName: ctx.user.name || "Unknown",
        action: "totp.deleted",
        resource: `totp:${input.id}`,
        details: { name: item.name },
      });

      return { success: true };
    }),

  // Parse otpauth:// URI
  parseUri: protectedProcedure
    .input(z.object({ uri: z.string() }))
    .mutation(({ input }) => {
      try {
        const url = new URL(input.uri);
        if (url.protocol !== "otpauth:") throw new Error("Not an otpauth URI");

        const label = decodeURIComponent(url.pathname.slice(2)); // remove //
        const secret = url.searchParams.get("secret") || "";
        const issuer = url.searchParams.get("issuer") || label.split(":")[0] || "";
        const algorithm = (url.searchParams.get("algorithm") || "SHA1").toUpperCase();
        const digits = parseInt(url.searchParams.get("digits") || "6", 10);
        const period = parseInt(url.searchParams.get("period") || "30", 10);

        return {
          name: label.includes(":") ? label.split(":")[1].trim() : label,
          issuer,
          secret,
          algorithm: algorithm as "SHA1" | "SHA256" | "SHA512",
          digits,
          period,
        };
      } catch {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid otpauth:// URI" });
      }
    }),
});
