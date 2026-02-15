import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { users } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { generateSecret, generateSync, verifySync, generateURI } from "otplib";
import * as QRCode from "qrcode";
import bcrypt from "bcryptjs";
import { getDb } from "./db";

const APP_NAME = "Archibald Titan";

// Generate 8 backup codes
function makeBackupCodes(): string[] {
  const codes: string[] = [];
  for (let i = 0; i < 8; i++) {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    codes.push(code);
  }
  return codes;
}

// Hash backup codes for storage
async function hashBackupCodes(codes: string[]): Promise<string[]> {
  return Promise.all(codes.map((c) => bcrypt.hash(c, 10)));
}

export const twoFactorRouter = router({
  // Get 2FA status
  status: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
    const [user] = await db
      .select({
        twoFactorEnabled: users.twoFactorEnabled,
        hasBackupCodes: users.twoFactorBackupCodes,
      })
      .from(users)
      .where(eq(users.id, ctx.user.id))
      .limit(1);

    return {
      enabled: user?.twoFactorEnabled ?? false,
      hasBackupCodes: !!(user?.hasBackupCodes && user.hasBackupCodes.length > 0),
    };
  }),

  // Step 1: Generate a TOTP secret and QR code for setup
  setup: protectedProcedure.mutation(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
    const [user] = await db
      .select({ twoFactorEnabled: users.twoFactorEnabled, email: users.email })
      .from(users)
      .where(eq(users.id, ctx.user.id))
      .limit(1);

    if (user?.twoFactorEnabled) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "2FA is already enabled. Disable it first to reconfigure.",
      });
    }

    const secret = generateSecret();
    const accountName = user?.email || `user-${ctx.user.id}`;
    const otpauth = generateURI({
      label: accountName,
      issuer: APP_NAME,
      secret,
    });
    const qrCodeDataUrl = await QRCode.toDataURL(otpauth);

    // Store the secret temporarily (not yet enabled)
    await db
      .update(users)
      .set({ twoFactorSecret: secret })
      .where(eq(users.id, ctx.user.id));

    return {
      secret,
      qrCode: qrCodeDataUrl,
      otpauth,
    };
  }),

  // Step 2: Verify the TOTP code and enable 2FA
  verify: protectedProcedure
    .input(z.object({ code: z.string().length(6) }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const [user] = await db
        .select({
          twoFactorSecret: users.twoFactorSecret,
          twoFactorEnabled: users.twoFactorEnabled,
        })
        .from(users)
        .where(eq(users.id, ctx.user.id))
        .limit(1);

      if (!user?.twoFactorSecret) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No 2FA setup in progress. Please start setup first.",
        });
      }

      if (user.twoFactorEnabled) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "2FA is already enabled.",
        });
      }

      const result = verifySync({
        token: input.code,
        secret: user.twoFactorSecret,
      });

      if (!result.valid) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid verification code. Please try again.",
        });
      }

      // Generate backup codes
      const backupCodes = makeBackupCodes();
      const hashedCodes = await hashBackupCodes(backupCodes);

      // Enable 2FA
      await db
        .update(users)
        .set({
          twoFactorEnabled: true,
          twoFactorBackupCodes: hashedCodes,
        })
        .where(eq(users.id, ctx.user.id));

      return {
        success: true,
        backupCodes, // Show these once to the user
      };
    }),

  // Disable 2FA (requires current TOTP code or backup code)
  disable: protectedProcedure
    .input(z.object({ code: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const [user] = await db
        .select({
          twoFactorSecret: users.twoFactorSecret,
          twoFactorEnabled: users.twoFactorEnabled,
          twoFactorBackupCodes: users.twoFactorBackupCodes,
        })
        .from(users)
        .where(eq(users.id, ctx.user.id))
        .limit(1);

      if (!user?.twoFactorEnabled) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "2FA is not enabled.",
        });
      }

      // Try TOTP code first
      let isValid = false;
      if (input.code.length === 6 && user.twoFactorSecret) {
        const result = verifySync({
          token: input.code,
          secret: user.twoFactorSecret,
        });
        isValid = result.valid;
      }

      // Try backup code if TOTP didn't work
      if (!isValid && user.twoFactorBackupCodes) {
        for (const hashedCode of user.twoFactorBackupCodes) {
          if (await bcrypt.compare(input.code, hashedCode)) {
            isValid = true;
            break;
          }
        }
      }

      if (!isValid) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid code. Please enter a valid TOTP code or backup code.",
        });
      }

      // Disable 2FA
      await db
        .update(users)
        .set({
          twoFactorEnabled: false,
          twoFactorSecret: null,
          twoFactorBackupCodes: null,
        })
        .where(eq(users.id, ctx.user.id));

      return { success: true };
    }),

  // Regenerate backup codes
  regenerateBackupCodes: protectedProcedure
    .input(z.object({ code: z.string().length(6) }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const [user] = await db
        .select({
          twoFactorSecret: users.twoFactorSecret,
          twoFactorEnabled: users.twoFactorEnabled,
        })
        .from(users)
        .where(eq(users.id, ctx.user.id))
        .limit(1);

      if (!user?.twoFactorEnabled || !user.twoFactorSecret) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "2FA is not enabled.",
        });
      }

      const result = verifySync({
        token: input.code,
        secret: user.twoFactorSecret,
      });

      if (!result.valid) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid verification code.",
        });
      }

      const backupCodes = makeBackupCodes();
      const hashedCodes = await hashBackupCodes(backupCodes);

      await db
        .update(users)
        .set({ twoFactorBackupCodes: hashedCodes })
        .where(eq(users.id, ctx.user.id));

      return { backupCodes };
    }),

  // Validate a TOTP code (used during login challenge)
  validateCode: protectedProcedure
    .input(z.object({ code: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const [user] = await db
        .select({
          twoFactorSecret: users.twoFactorSecret,
          twoFactorEnabled: users.twoFactorEnabled,
          twoFactorBackupCodes: users.twoFactorBackupCodes,
        })
        .from(users)
        .where(eq(users.id, ctx.user.id))
        .limit(1);

      if (!user?.twoFactorEnabled || !user.twoFactorSecret) {
        return { valid: true }; // 2FA not enabled, pass through
      }

      // Try TOTP code
      if (input.code.length === 6) {
        const result = verifySync({
          token: input.code,
          secret: user.twoFactorSecret,
        });
        if (result.valid) return { valid: true };
      }

      // Try backup code
      if (user.twoFactorBackupCodes) {
        for (let i = 0; i < user.twoFactorBackupCodes.length; i++) {
          if (await bcrypt.compare(input.code, user.twoFactorBackupCodes[i])) {
            // Remove used backup code
            const updatedCodes = [...user.twoFactorBackupCodes];
            updatedCodes.splice(i, 1);
            await db
              .update(users)
              .set({ twoFactorBackupCodes: updatedCodes })
              .where(eq(users.id, ctx.user.id));
            return { valid: true, usedBackupCode: true };
          }
        }
      }

      return { valid: false };
    }),
});
