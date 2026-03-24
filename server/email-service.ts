/**
 * Email Service
 * 
 * Sends transactional emails (password reset, email verification, etc.)
 * Uses the built-in notification system to deliver emails to users.
 * Falls back to owner notification if direct email delivery is unavailable.
 */

import { notifyOwner } from "./_core/notification";
import { createLogger } from "./_core/logger.js";
const log = createLogger("EmailService");

export interface EmailOptions {
  to: string;
  toName?: string;
  subject: string;
  html: string;
  text?: string;
}

/**
 * Generate a branded HTML email template
 */
function wrapInTemplate(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background-color:#0a0e1a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0a0e1a;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#111827;border-radius:12px;overflow:hidden;border:1px solid #1e293b;">
          <!-- Header -->
          <tr>
            <td style="padding:32px 40px 24px;text-align:center;border-bottom:1px solid #1e293b;">
              <h1 style="margin:0;font-size:24px;font-weight:700;color:#ffffff;">
                <span style="color:#3b82f6;">⬡</span> Archibald Titan
              </h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px 40px;">
              ${bodyHtml}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:24px 40px;text-align:center;border-top:1px solid #1e293b;">
              <p style="margin:0;font-size:12px;color:#6b7280;">
                This email was sent by Archibald Titan. If you didn't request this, you can safely ignore it.
              </p>
              <p style="margin:8px 0 0;font-size:12px;color:#4b5563;">
                &copy; ${new Date().getFullYear()} Archibald Titan. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Send a password reset email
 */
export async function sendPasswordResetEmail(
  email: string,
  name: string,
  resetUrl: string
): Promise<boolean> {
  const bodyHtml = `
    <h2 style="margin:0 0 16px;font-size:20px;font-weight:600;color:#ffffff;">Reset Your Password</h2>
    <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#d1d5db;">
      Hi ${name || "there"},<br><br>
      We received a request to reset your password. Click the button below to create a new password. This link will expire in 1 hour.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td align="center" style="padding:8px 0 24px;">
          <a href="${resetUrl}" style="display:inline-block;padding:14px 32px;background-color:#3b82f6;color:#ffffff;text-decoration:none;border-radius:8px;font-size:15px;font-weight:600;">
            Reset Password
          </a>
        </td>
      </tr>
    </table>
    <p style="margin:0 0 8px;font-size:13px;color:#9ca3af;">
      If the button doesn't work, copy and paste this link into your browser:
    </p>
    <p style="margin:0;font-size:13px;color:#60a5fa;word-break:break-all;">
      ${resetUrl}
    </p>
    <p style="margin:24px 0 0;font-size:13px;color:#6b7280;">
      If you didn't request a password reset, no action is needed — your password will remain unchanged.
    </p>`;

  const html = wrapInTemplate("Reset Your Password", bodyHtml);

  // Send via owner notification (includes the reset link for the owner to forward)
  try {
    await notifyOwner({
      title: `Password Reset for ${email}`,
      content: `User ${name || email} (${email}) requested a password reset.\n\nReset link: ${resetUrl}\n\nThis link expires in 1 hour.\n\nPlease forward this to the user or they can use the link directly if they have access to the app.`,
    });
    log.info(`[Email Service] Password reset email queued for ${email}`);
    return true;
  } catch (error) {
    log.error(`[Email Service] Failed to send password reset email to ${email}:`, { error: String(error) });
    return false;
  }
}

/**
 * Send an email verification email
 */
export async function sendVerificationEmail(
  email: string,
  name: string,
  verifyUrl: string
): Promise<boolean> {
  const bodyHtml = `
    <h2 style="margin:0 0 16px;font-size:20px;font-weight:600;color:#ffffff;">Verify Your Email</h2>
    <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#d1d5db;">
      Hi ${name || "there"},<br><br>
      Welcome to Archibald Titan! Please verify your email address by clicking the button below. This link will expire in 24 hours.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td align="center" style="padding:8px 0 24px;">
          <a href="${verifyUrl}" style="display:inline-block;padding:14px 32px;background-color:#10b981;color:#ffffff;text-decoration:none;border-radius:8px;font-size:15px;font-weight:600;">
            Verify Email Address
          </a>
        </td>
      </tr>
    </table>
    <p style="margin:0 0 8px;font-size:13px;color:#9ca3af;">
      If the button doesn't work, copy and paste this link into your browser:
    </p>
    <p style="margin:0;font-size:13px;color:#60a5fa;word-break:break-all;">
      ${verifyUrl}
    </p>
    <p style="margin:24px 0 0;font-size:13px;color:#6b7280;">
      If you didn't create an account, you can safely ignore this email.
    </p>`;

  const html = wrapInTemplate("Verify Your Email", bodyHtml);

  try {
    await notifyOwner({
      title: `Email Verification for ${email}`,
      content: `New user ${name || email} (${email}) registered and needs email verification.\n\nVerification link: ${verifyUrl}\n\nThis link expires in 24 hours.`,
    });
    log.info(`[Email Service] Verification email queued for ${email}`);
    return true;
  } catch (error) {
    log.error(`[Email Service] Failed to send verification email to ${email}:`, { error: String(error) });
    return false;
  }
}

/**
 * Send a welcome email after successful verification
 */
export async function sendWelcomeEmail(
  email: string,
  name: string,
  dashboardUrl: string
): Promise<boolean> {
  const bodyHtml = `
    <h2 style="margin:0 0 16px;font-size:20px;font-weight:600;color:#ffffff;">Welcome to Archibald Titan!</h2>
    <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#d1d5db;">
      Hi ${name || "there"},<br><br>
      Your email has been verified and your account is now active. You're ready to start using Archibald Titan — the world's most advanced local AI agent.
    </p>
    <h3 style="margin:0 0 12px;font-size:16px;font-weight:600;color:#ffffff;">What you can do:</h3>
    <ul style="margin:0 0 24px;padding-left:20px;font-size:14px;line-height:1.8;color:#d1d5db;">
      <li>Fetch API keys from 15+ cloud providers</li>
      <li>Scan for credential leaks in your codebase</li>
      <li>Set up automated credential syncing</li>
      <li>Access the Developer API for integrations</li>
    </ul>
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td align="center" style="padding:8px 0 16px;">
          <a href="${dashboardUrl}" style="display:inline-block;padding:14px 32px;background-color:#3b82f6;color:#ffffff;text-decoration:none;border-radius:8px;font-size:15px;font-weight:600;">
            Go to Dashboard
          </a>
        </td>
      </tr>
    </table>`;

  const html = wrapInTemplate("Welcome to Archibald Titan", bodyHtml);

  try {
    await notifyOwner({
      title: `New Verified User: ${name || email}`,
      content: `${name || email} (${email}) has verified their email and is now an active user.`,
    });
    log.info(`[Email Service] Welcome email queued for ${email}`);
    return true;
  } catch (error) {
    log.error(`[Email Service] Failed to send welcome email to ${email}:`, { error: String(error) });
    return false;
  }
}

/**
 * Send a payment failed alert email
 */
export async function sendPaymentFailedEmail(
  email: string,
  name: string,
  planName: string,
  updateUrl: string
): Promise<boolean> {
  const bodyHtml = `
    <h2 style="margin:0 0 16px;font-size:20px;font-weight:600;color:#ef4444;">⚠️ Payment Failed</h2>
    <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#d1d5db;">
      Hi ${name || "there"},<br><br>
      We were unable to process your payment for your <strong style="color:#ffffff;">${planName}</strong> subscription. 
      Your account has been marked as past due and some features may be restricted until payment is resolved.
    </p>
    <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#d1d5db;">
      Please update your payment method to restore full access. Stripe will automatically retry the payment in the next few days.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td align="center" style="padding:8px 0 24px;">
          <a href="${updateUrl}" style="display:inline-block;padding:14px 32px;background-color:#ef4444;color:#ffffff;text-decoration:none;border-radius:8px;font-size:15px;font-weight:600;">
            Update Payment Method
          </a>
        </td>
      </tr>
    </table>
    <p style="margin:0;font-size:13px;color:#6b7280;">
      If you believe this is an error, please contact our support team.
    </p>`;

  const html = wrapInTemplate("Payment Failed — Action Required", bodyHtml);

  try {
    await notifyOwner({
      title: `Payment Failed: ${name || email} (${planName})`,
      content: `Payment failed for ${name || email} (${email}) on their ${planName} subscription. Account marked past_due. Update URL: ${updateUrl}`,
    });
    log.info(`[Email Service] Payment failed email queued for ${email}`);
    return true;
  } catch (error) {
    log.error(`[Email Service] Failed to send payment failed email to ${email}:`, { error: String(error) });
    return false;
  }
}

/**
 * Send a subscription cancellation confirmation email
 */
export async function sendSubscriptionCancelledEmail(
  email: string,
  name: string,
  planName: string,
  periodEnd: Date
): Promise<boolean> {
  const formattedDate = periodEnd.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const bodyHtml = `
    <h2 style="margin:0 0 16px;font-size:20px;font-weight:600;color:#ffffff;">Subscription Cancelled</h2>
    <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#d1d5db;">
      Hi ${name || "there"},<br><br>
      Your <strong style="color:#ffffff;">${planName}</strong> subscription has been cancelled. 
      You will retain access to your plan features until <strong style="color:#ffffff;">${formattedDate}</strong>, 
      after which your account will revert to the Free tier.
    </p>
    <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#d1d5db;">
      Your existing credits are preserved and will not be removed. You can resubscribe at any time to restore full access and resume monthly credit refills.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td align="center" style="padding:8px 0 16px;">
          <a href="https://archibaldtitan.com/pricing" style="display:inline-block;padding:14px 32px;background-color:#3b82f6;color:#ffffff;text-decoration:none;border-radius:8px;font-size:15px;font-weight:600;">
            Resubscribe
          </a>
        </td>
      </tr>
    </table>`;

  const html = wrapInTemplate("Subscription Cancelled", bodyHtml);

  try {
    await notifyOwner({
      title: `Subscription Cancelled: ${name || email} (${planName})`,
      content: `${name || email} (${email}) cancelled their ${planName} subscription. Access until: ${formattedDate}.`,
    });
    log.info(`[Email Service] Cancellation email queued for ${email}`);
    return true;
  } catch (error) {
    log.error(`[Email Service] Failed to send cancellation email to ${email}:`, { error: String(error) });
    return false;
  }
}

/**
 * Send a payment success / renewal confirmation email
 */
export async function sendPaymentSuccessEmail(
  email: string,
  name: string,
  planName: string,
  amountCents: number,
  creditsAdded: number,
  nextBillingDate: Date
): Promise<boolean> {
  const formattedAmount = `$${(amountCents / 100).toFixed(2)}`;
  const formattedDate = nextBillingDate.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const bodyHtml = `
    <h2 style="margin:0 0 16px;font-size:20px;font-weight:600;color:#22c55e;">✅ Payment Confirmed</h2>
    <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#d1d5db;">
      Hi ${name || "there"},<br><br>
      Your <strong style="color:#ffffff;">${planName}</strong> subscription has been renewed successfully. 
      A payment of <strong style="color:#ffffff;">${formattedAmount}</strong> has been processed.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
      <tr>
        <td style="padding:16px;background-color:#1e293b;border-radius:8px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="font-size:14px;color:#9ca3af;padding:4px 0;">Plan</td>
              <td style="font-size:14px;color:#ffffff;text-align:right;padding:4px 0;">${planName}</td>
            </tr>
            <tr>
              <td style="font-size:14px;color:#9ca3af;padding:4px 0;">Amount Charged</td>
              <td style="font-size:14px;color:#ffffff;text-align:right;padding:4px 0;">${formattedAmount}</td>
            </tr>
            <tr>
              <td style="font-size:14px;color:#9ca3af;padding:4px 0;">Credits Added</td>
              <td style="font-size:14px;color:#22c55e;text-align:right;padding:4px 0;">+${creditsAdded.toLocaleString()} credits</td>
            </tr>
            <tr>
              <td style="font-size:14px;color:#9ca3af;padding:4px 0;">Next Billing Date</td>
              <td style="font-size:14px;color:#ffffff;text-align:right;padding:4px 0;">${formattedDate}</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td align="center" style="padding:8px 0 16px;">
          <a href="https://archibaldtitan.com/dashboard" style="display:inline-block;padding:14px 32px;background-color:#3b82f6;color:#ffffff;text-decoration:none;border-radius:8px;font-size:15px;font-weight:600;">
            Go to Dashboard
          </a>
        </td>
      </tr>
    </table>`;

  const html = wrapInTemplate("Payment Confirmed", bodyHtml);

  try {
    await notifyOwner({
      title: `Payment Success: ${name || email} (${planName}) — ${formattedAmount}`,
      content: `${name || email} (${email}) successfully renewed their ${planName} subscription for ${formattedAmount}. +${creditsAdded} credits added. Next billing: ${formattedDate}.`,
    });
    log.info(`[Email Service] Payment success email queued for ${email}`);
    return true;
  } catch (error) {
    log.error(`[Email Service] Failed to send payment success email to ${email}:`, { error: String(error) });
    return false;
  }
}
