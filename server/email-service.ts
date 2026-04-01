/**
 * Email Service — DISABLED
 *
 * All email sending has been turned off. Every function is a no-op that
 * returns `true` so callers continue to work without errors.
 * To re-enable, restore the original implementation from git history.
 */

import { createLogger } from "./_core/logger.js";
const log = createLogger("EmailService");

export interface EmailOptions {
  to: string;
  toName?: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendPasswordResetEmail(
  email: string,
  _name: string,
  _resetUrl: string
): Promise<boolean> {
  log.info(`[Email Service] DISABLED — password reset email suppressed for ${email}`);
  return true;
}

export async function sendVerificationEmail(
  email: string,
  _name: string,
  _verifyUrl: string
): Promise<boolean> {
  log.info(`[Email Service] DISABLED — verification email suppressed for ${email}`);
  return true;
}

export async function sendWelcomeEmail(
  email: string,
  _name: string,
  _dashboardUrl: string
): Promise<boolean> {
  log.info(`[Email Service] DISABLED — welcome email suppressed for ${email}`);
  return true;
}

export async function sendPaymentFailedEmail(
  email: string,
  _name: string,
  _planName: string,
  _updateUrl: string
): Promise<boolean> {
  log.info(`[Email Service] DISABLED — payment failed email suppressed for ${email}`);
  return true;
}

export async function sendSubscriptionCancelledEmail(
  email: string,
  _name: string,
  _planName: string,
  _periodEnd: Date
): Promise<boolean> {
  log.info(`[Email Service] DISABLED — cancellation email suppressed for ${email}`);
  return true;
}

export async function sendPaymentSuccessEmail(
  email: string,
  _name: string,
  _planName: string,
  _amountCents: number,
  _creditsAdded: number,
  _nextBillingDate: Date
): Promise<boolean> {
  log.info(`[Email Service] DISABLED — payment success email suppressed for ${email}`);
  return true;
}
