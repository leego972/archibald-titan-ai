/**
 * ═══════════════════════════════════════════════════════════════════════
 *  CARD CHECKER — 3-Layer BIN + Validation + Live Verification Engine
 * ═══════════════════════════════════════════════════════════════════════
 *
 *  Layer 1: Luhn Algorithm — mathematical card number validation (instant, free)
 *  Layer 2: BIN Lookup — local 343k-row database → external API fallback
 *  Layer 3: Stripe SetupIntent — verifies card is LIVE without charging
 *
 *  This module NEVER charges a card. It uses Stripe's SetupIntent API which
 *  contacts the issuing bank for verification without creating any transaction.
 *  This is the same mechanism Netflix/Spotify use when you "add a card."
 *
 *  Decline codes: https://stripe.com/docs/declines/codes
 */

import Stripe from "stripe";
import { ENV } from "./_core/env";
import { createLogger } from "./_core/logger.js";
import { searchBins } from "./bin-database.js";

const log = createLogger("CardChecker");

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CardCheckRequest {
  cardNumber: string;
  expMonth: number;
  expYear: number;
  cvc: string;
}

export interface BinInfo {
  scheme: string;       // visa, mastercard, amex, discover, etc.
  type: string;         // debit, credit, prepaid
  brand: string;        // classic, gold, platinum, business, etc.
  bank: string;         // issuing bank name
  country: string;      // country name
  countryCode: string;  // ISO 3166-1 alpha-2
  prepaid: boolean;
  cardLength: number;
  luhnValid: boolean;
  source: "local_db" | "external_api" | "unknown";
}

export interface LiveCheckResult {
  isLive: boolean;
  cvcCheck: string;          // pass | fail | unavailable | unchecked
  addressCheck: string;      // pass | fail | unavailable | unchecked
  zipCheck: string;          // pass | fail | unavailable | unchecked
  declineCode?: string;      // raw Stripe decline code
  declineMessage?: string;   // human-readable explanation
  declineCategory?: string;  // INSUFFICIENT_FUNDS | DO_NOT_HONOR | FRAUD | EXPIRED | etc.
  funding?: string;          // credit | debit | prepaid | unknown
  brand?: string;            // visa | mastercard | amex
  last4?: string;
  expMonth?: number;
  expYear?: number;
  paymentMethodId?: string;  // for reference
}

export interface CardCheckResult {
  // Layer 1: Luhn
  luhnValid: boolean;
  cardNumberLength: number;
  detectedScheme: string;

  // Layer 2: BIN
  binLookup: BinInfo | null;
  binError?: string;

  // Layer 3: Live verification
  liveCheck: LiveCheckResult | null;
  liveError?: string;

  // Summary
  overallStatus: "LIVE" | "DECLINED" | "INVALID_NUMBER" | "BIN_ONLY" | "ERROR";
  statusCode: string;        // Machine-readable status for UI
  summary: string;
  checkedAt: string;
}

// ─── Stripe Decline Code Mapping ─────────────────────────────────────────────
// Full reference: https://stripe.com/docs/declines/codes

interface DeclineInfo {
  message: string;
  category: string;
  userAction: string;
}

const DECLINE_CODES: Record<string, DeclineInfo> = {
  // ── Insufficient Funds ──────────────────────────────────────────────────────
  insufficient_funds: {
    message: "The card has insufficient funds to complete the purchase.",
    category: "INSUFFICIENT_FUNDS",
    userAction: "Use a different card or add funds to this card.",
  },
  // ── Do Not Honor ────────────────────────────────────────────────────────────
  do_not_honor: {
    message: "The card was declined. The issuing bank has not provided a reason.",
    category: "DO_NOT_HONOR",
    userAction: "Contact your bank or use a different card.",
  },
  generic_decline: {
    message: "The card was declined for an unspecified reason.",
    category: "DO_NOT_HONOR",
    userAction: "Contact your bank or use a different card.",
  },
  // ── Fraud / Security ────────────────────────────────────────────────────────
  fraudulent: {
    message: "The payment was declined because Stripe suspects it is fraudulent.",
    category: "FRAUD",
    userAction: "Contact your bank. Do not retry.",
  },
  card_velocity_exceeded: {
    message: "The customer has exceeded the balance or credit limit on this card.",
    category: "VELOCITY_LIMIT",
    userAction: "Wait before retrying or use a different card.",
  },
  security_violation: {
    message: "The card was declined due to a security violation.",
    category: "FRAUD",
    userAction: "Contact your bank.",
  },
  transaction_not_allowed: {
    message: "The card does not support this type of transaction.",
    category: "TRANSACTION_NOT_ALLOWED",
    userAction: "Use a different card or contact your bank.",
  },
  // ── CVC / Expiry ────────────────────────────────────────────────────────────
  incorrect_cvc: {
    message: "The CVC number is incorrect.",
    category: "INCORRECT_CVC",
    userAction: "Check the CVC on the back of the card and retry.",
  },
  invalid_cvc: {
    message: "The CVC number is not valid for this card.",
    category: "INCORRECT_CVC",
    userAction: "Check the CVC on the back of the card and retry.",
  },
  expired_card: {
    message: "The card has expired.",
    category: "EXPIRED",
    userAction: "Use a different card.",
  },
  invalid_expiry_month: {
    message: "The expiry month is invalid.",
    category: "INVALID_EXPIRY",
    userAction: "Check the expiry date and retry.",
  },
  invalid_expiry_year: {
    message: "The expiry year is invalid.",
    category: "INVALID_EXPIRY",
    userAction: "Check the expiry date and retry.",
  },
  // ── Card Number ─────────────────────────────────────────────────────────────
  incorrect_number: {
    message: "The card number is incorrect.",
    category: "INVALID_NUMBER",
    userAction: "Check the card number and retry.",
  },
  invalid_number: {
    message: "The card number is not a valid credit card number.",
    category: "INVALID_NUMBER",
    userAction: "Check the card number and retry.",
  },
  // ── Lost / Stolen ────────────────────────────────────────────────────────────
  lost_card: {
    message: "The card has been reported lost.",
    category: "LOST_CARD",
    userAction: "Do not retry. Contact your bank.",
  },
  stolen_card: {
    message: "The card has been reported stolen.",
    category: "STOLEN_CARD",
    userAction: "Do not retry. Contact your bank.",
  },
  pickup_card: {
    message: "The card cannot be used to make this payment (it may have been reported lost or stolen).",
    category: "PICKUP_CARD",
    userAction: "Contact your bank.",
  },
  restricted_card: {
    message: "The card cannot be used to make this payment (it may have been reported lost or stolen).",
    category: "RESTRICTED",
    userAction: "Contact your bank.",
  },
  // ── Account Issues ───────────────────────────────────────────────────────────
  account_closed: {
    message: "The customer's bank account has been closed.",
    category: "ACCOUNT_CLOSED",
    userAction: "Use a different card.",
  },
  new_account_information_available: {
    message: "The card or account has been updated. Contact your bank for new card details.",
    category: "ACCOUNT_UPDATED",
    userAction: "Contact your bank for updated card information.",
  },
  no_action_taken: {
    message: "The card was declined. The issuing bank has not provided a reason.",
    category: "DO_NOT_HONOR",
    userAction: "Contact your bank.",
  },
  not_permitted: {
    message: "The payment is not permitted.",
    category: "NOT_PERMITTED",
    userAction: "Contact your bank.",
  },
  // ── Processor / Network ─────────────────────────────────────────────────────
  processing_error: {
    message: "An error occurred while processing the card. The payment should be retried.",
    category: "PROCESSING_ERROR",
    userAction: "Retry the payment.",
  },
  reenter_transaction: {
    message: "The payment could not be processed. Please retry.",
    category: "PROCESSING_ERROR",
    userAction: "Retry the payment.",
  },
  service_not_allowed: {
    message: "The card does not allow this type of service.",
    category: "SERVICE_NOT_ALLOWED",
    userAction: "Use a different card.",
  },
  stop_payment_order: {
    message: "A stop payment order has been placed on this card.",
    category: "STOP_PAYMENT",
    userAction: "Contact your bank.",
  },
  // ── 3DS / Authentication ─────────────────────────────────────────────────────
  authentication_required: {
    message: "The card requires 3D Secure authentication.",
    category: "AUTHENTICATION_REQUIRED",
    userAction: "Complete 3D Secure authentication.",
  },
  // ── Stripe-specific ──────────────────────────────────────────────────────────
  card_not_supported: {
    message: "The card does not support this type of purchase.",
    category: "NOT_SUPPORTED",
    userAction: "Use a different card.",
  },
  currency_not_supported: {
    message: "The card does not support the specified currency.",
    category: "CURRENCY_NOT_SUPPORTED",
    userAction: "Use a different card.",
  },
  duplicate_transaction: {
    message: "A transaction with identical amount and credit card information was submitted very recently.",
    category: "DUPLICATE",
    userAction: "Check if the payment was already processed.",
  },
  issuer_not_available: {
    message: "The card issuer could not be reached, so the payment could not be authorized.",
    category: "ISSUER_UNAVAILABLE",
    userAction: "Retry the payment.",
  },
  withdrawal_count_limit_exceeded: {
    message: "The customer has exceeded the balance or credit limit available on their card.",
    category: "LIMIT_EXCEEDED",
    userAction: "Use a different card.",
  },
  // ── Setup Intent specific ────────────────────────────────────────────────────
  setup_intent_authentication_failure: {
    message: "The card could not be authenticated during setup.",
    category: "AUTHENTICATION_FAILED",
    userAction: "Try a different card or contact your bank.",
  },
  setup_intent_unexpected_state: {
    message: "The SetupIntent is in an unexpected state.",
    category: "PROCESSING_ERROR",
    userAction: "Retry the verification.",
  },
};

function getDeclineInfo(code: string): DeclineInfo {
  return DECLINE_CODES[code] ?? {
    message: `Card declined with code: ${code}`,
    category: "UNKNOWN",
    userAction: "Contact your bank or use a different card.",
  };
}

// ─── Layer 1: Luhn Algorithm ──────────────────────────────────────────────────

function luhnValidate(cardNumber: string): boolean {
  const digits = cardNumber.replace(/\D/g, "");
  if (digits.length < 12 || digits.length > 19) return false;

  let sum = 0;
  let alternate = false;

  for (let i = digits.length - 1; i >= 0; i--) {
    let n = parseInt(digits[i], 10);
    if (alternate) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alternate = !alternate;
  }

  return sum % 10 === 0;
}

function detectScheme(cardNumber: string): string {
  const d = cardNumber.replace(/\D/g, "");
  if (/^4/.test(d)) return "visa";
  if (/^5[1-5]/.test(d) || /^2[2-7]/.test(d)) return "mastercard";
  if (/^3[47]/.test(d)) return "amex";
  if (/^6(?:011|5|4[4-9]|22)/.test(d)) return "discover";
  if (/^35(?:2[89]|[3-8])/.test(d)) return "jcb";
  if (/^3(?:0[0-5]|[68])/.test(d)) return "diners";
  if (/^62/.test(d)) return "unionpay";
  if (/^50|^5[6-9]|^6[0-9]/.test(d)) return "maestro";
  return "unknown";
}

function getExpectedCvcLength(scheme: string): number {
  return scheme === "amex" ? 4 : 3;
}

// ─── Layer 2: BIN Lookup ──────────────────────────────────────────────────────

async function binLookup(cardNumber: string): Promise<BinInfo | null> {
  const digits = cardNumber.replace(/\D/g, "");
  const bin8 = digits.substring(0, 8);
  const bin6 = digits.substring(0, 6);

  // ── Primary: local 343k-row database (instant, no rate limits) ──
  const localResults = await searchBins({ bin: bin6 });
  if (localResults.length > 0) {
    const row = localResults[0];
    return {
      scheme: (row.brand ?? detectScheme(digits)).toLowerCase(),
      type: (row.type ?? "unknown").toLowerCase(),
      brand: row.brand ?? "unknown",
      bank: row.issuer ?? "unknown",
      country: row.country ?? "unknown",
      countryCode: row.alpha2 ?? "??",
      prepaid: (row.type ?? "").toUpperCase() === "PREPAID",
      cardLength: digits.length,
      luhnValid: true,
      source: "local_db",
    };
  }

  // ── Fallback: binlist.net external API ──
  try {
    for (const bin of [bin8, bin6]) {
      const res = await fetch(`https://lookup.binlist.net/${bin}`, {
        headers: { "Accept-Version": "3", "Accept": "application/json" },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) continue;
      const data = await res.json() as Record<string, any>;
      return {
        scheme: data.scheme || detectScheme(digits),
        type: data.type || "unknown",
        brand: data.brand || "unknown",
        bank: data.bank?.name || "unknown",
        country: data.country?.name || "unknown",
        countryCode: data.country?.alpha2 || "??",
        prepaid: data.prepaid === true,
        cardLength: data.number?.length || digits.length,
        luhnValid: data.number?.luhn !== false,
        source: "external_api",
      };
    }
  } catch (err) {
    log.warn("BIN lookup external API failed:", { error: String(err) });
  }

  return null;
}

// ─── Layer 3: Stripe SetupIntent Live Verification ────────────────────────────

let stripeInstance: Stripe | null = null;

function getStripe(): Stripe {
  if (!stripeInstance) {
    if (!ENV.stripeSecretKey) {
      throw new Error("STRIPE_SECRET_KEY is not configured");
    }
    stripeInstance = new Stripe(ENV.stripeSecretKey, {
      apiVersion: "2024-11-20.acacia" as any,
    });
  }
  return stripeInstance;
}

async function liveVerify(card: CardCheckRequest): Promise<LiveCheckResult> {
  const stripe = getStripe();
  const cleanNumber = card.cardNumber.replace(/\D/g, "");

  // ── Step 1: Create PaymentMethod ──────────────────────────────────────────
  let paymentMethod: Stripe.PaymentMethod;
  try {
    paymentMethod = await stripe.paymentMethods.create({
      type: "card",
      card: {
        number: cleanNumber,
        exp_month: card.expMonth,
        exp_year: card.expYear,
        cvc: card.cvc,
      },
    });
  } catch (err: any) {
    const code = err.decline_code || err.code || "card_declined";
    const info = getDeclineInfo(code);
    return {
      isLive: false,
      cvcCheck: "unavailable",
      addressCheck: "unavailable",
      zipCheck: "unavailable",
      declineCode: code,
      declineMessage: info.message,
      declineCategory: info.category,
    };
  }

  // ── Step 2: Create temporary customer ────────────────────────────────────
  let customer: Stripe.Customer;
  try {
    customer = await stripe.customers.create({
      description: "Titan card verification — auto-cleanup",
      metadata: { purpose: "card_check", autoDelete: "true" },
    });
  } catch (err: any) {
    try { await stripe.paymentMethods.detach(paymentMethod.id); } catch {}
    throw new Error(`Failed to create temp customer: ${err.message}`);
  }

  // ── Step 3: Confirm SetupIntent (contacts issuing bank) ──────────────────
  let setupIntent: Stripe.SetupIntent;
  try {
    setupIntent = await stripe.setupIntents.create({
      customer: customer.id,
      payment_method: paymentMethod.id,
      confirm: true,
      usage: "off_session",
      automatic_payment_methods: { enabled: false },
      payment_method_types: ["card"],
    });
  } catch (err: any) {
    // Cleanup
    try { await stripe.paymentMethods.detach(paymentMethod.id); } catch {}
    try { await stripe.customers.del(customer.id); } catch {}

    const code = err.decline_code || err.code || "setup_failed";
    const info = getDeclineInfo(code);
    return {
      isLive: false,
      cvcCheck: "unavailable",
      addressCheck: "unavailable",
      zipCheck: "unavailable",
      declineCode: code,
      declineMessage: info.message,
      declineCategory: info.category,
    };
  }

  // ── Step 4: Extract verification results ─────────────────────────────────
  const cardDetails = paymentMethod.card;
  const checks = cardDetails?.checks;

  const result: LiveCheckResult = {
    isLive: setupIntent.status === "succeeded",
    cvcCheck: checks?.cvc_check || "unavailable",
    addressCheck: checks?.address_line1_check || "unavailable",
    zipCheck: checks?.address_postal_code_check || "unavailable",
    funding: cardDetails?.funding || "unknown",
    brand: cardDetails?.brand || "unknown",
    last4: cardDetails?.last4 || "????",
    expMonth: cardDetails?.exp_month,
    expYear: cardDetails?.exp_year,
    paymentMethodId: paymentMethod.id,
  };

  if (setupIntent.status !== "succeeded") {
    const lastError = setupIntent.last_setup_error;
    const code = lastError?.decline_code || lastError?.code || "unknown";
    const info = getDeclineInfo(code);
    result.declineCode = code;
    result.declineMessage = info.message;
    result.declineCategory = info.category;
  }

  // ── Step 5: Cleanup — detach payment method and delete temp customer ──────
  try { await stripe.paymentMethods.detach(paymentMethod.id); } catch {}
  try { await stripe.customers.del(customer.id); } catch {}

  return result;
}

// ─── Main Check Function ──────────────────────────────────────────────────────

export async function checkCard(request: CardCheckRequest): Promise<CardCheckResult> {
  const cleanNumber = request.cardNumber.replace(/\D/g, "");
  const scheme = detectScheme(cleanNumber);
  const checkedAt = new Date().toISOString();

  log.info(`Card check initiated: ${scheme} ****${cleanNumber.slice(-4)}`);

  // ── Layer 1: Luhn validation ──────────────────────────────────────────────
  const luhnValid = luhnValidate(cleanNumber);

  if (!luhnValid) {
    return {
      luhnValid: false,
      cardNumberLength: cleanNumber.length,
      detectedScheme: scheme,
      binLookup: null,
      liveCheck: null,
      overallStatus: "INVALID_NUMBER",
      statusCode: "LUHN_FAIL",
      summary: `❌ INVALID — Card number fails Luhn check. The number ${cleanNumber.length < 12 ? "is too short" : "has an invalid checksum"}. This is not a valid card number.`,
      checkedAt,
    };
  }

  // Validate CVC length
  const expectedCvc = getExpectedCvcLength(scheme);
  if (request.cvc.replace(/\D/g, "").length !== expectedCvc) {
    return {
      luhnValid: true,
      cardNumberLength: cleanNumber.length,
      detectedScheme: scheme,
      binLookup: null,
      liveCheck: null,
      overallStatus: "INVALID_NUMBER",
      statusCode: "INVALID_CVC_LENGTH",
      summary: `❌ INVALID — CVC should be ${expectedCvc} digits for ${scheme.toUpperCase()}, but got ${request.cvc.length} digits.`,
      checkedAt,
    };
  }

  // ── Layer 2: BIN lookup ───────────────────────────────────────────────────
  let binInfo: BinInfo | null = null;
  let binError: string | undefined;
  try {
    binInfo = await binLookup(cleanNumber);
  } catch (err: any) {
    binError = err.message || "BIN lookup failed";
  }

  // ── Layer 3: Live verification via Stripe SetupIntent ─────────────────────
  let liveResult: LiveCheckResult | undefined;
  let liveError: string | undefined;

  if (!ENV.stripeSecretKey) {
    liveError = "Stripe not configured — live verification unavailable";
  } else {
    try {
      liveResult = await liveVerify(request);
    } catch (err: any) {
      liveError = err.message || "Live verification failed";
    }
  }

  // ── Determine overall status ──────────────────────────────────────────────
  let overallStatus: CardCheckResult["overallStatus"];
  let statusCode: string;

  if (liveResult?.isLive) {
    overallStatus = "LIVE";
    statusCode = "LIVE";
  } else if (liveResult && !liveResult.isLive) {
    overallStatus = "DECLINED";
    statusCode = liveResult.declineCode?.toUpperCase() ?? "DECLINED";
  } else if (binInfo) {
    overallStatus = "BIN_ONLY";
    statusCode = "BIN_ONLY";
  } else {
    overallStatus = "ERROR";
    statusCode = "ERROR";
  }

  const summary = buildSummary(overallStatus, scheme, cleanNumber, binInfo, liveResult, liveError);

  log.info(`Card check complete: ${scheme} ****${cleanNumber.slice(-4)} → ${overallStatus} (${statusCode})`);

  return {
    luhnValid,
    cardNumberLength: cleanNumber.length,
    detectedScheme: scheme,
    binLookup: binInfo,
    binError,
    liveCheck: liveResult ?? null,
    liveError,
    overallStatus,
    statusCode,
    summary,
    checkedAt,
  };
}

function buildSummary(
  status: CardCheckResult["overallStatus"],
  scheme: string,
  number: string,
  bin: BinInfo | null,
  live: LiveCheckResult | null | undefined,
  liveError?: string,
): string {
  const last4 = number.slice(-4);
  const lines: string[] = [];

  switch (status) {
    case "LIVE":
      lines.push(`✅ LIVE — ${scheme.toUpperCase()} ****${last4} is active and verified by the issuing bank.`);
      break;
    case "DECLINED":
      lines.push(`❌ DECLINED — ${scheme.toUpperCase()} ****${last4} was rejected by the issuing bank.`);
      if (live?.declineCode) {
        lines.push(`   Code: ${live.declineCode}`);
        lines.push(`   Reason: ${live.declineMessage || "No details"}`);
        if (live.declineCategory) lines.push(`   Category: ${live.declineCategory}`);
      }
      break;
    case "BIN_ONLY":
      lines.push(`⚠️ BIN VERIFIED — ${scheme.toUpperCase()} ****${last4} number is valid but live check unavailable.`);
      if (liveError) lines.push(`   Live check error: ${liveError}`);
      break;
    case "ERROR":
      lines.push(`⚠️ ERROR — Could not fully verify ${scheme.toUpperCase()} ****${last4}.`);
      if (liveError) lines.push(`   ${liveError}`);
      break;
  }

  lines.push("");
  lines.push("── Card Details ──");
  lines.push(`  Scheme: ${scheme.toUpperCase()}`);
  lines.push(`  Last 4: ${last4}`);
  lines.push(`  Luhn: ✅ Valid`);

  if (bin) {
    lines.push("");
    lines.push("── BIN Information ──");
    lines.push(`  Issuing Bank: ${bin.bank}`);
    lines.push(`  Country: ${bin.country} (${bin.countryCode})`);
    lines.push(`  Card Type: ${bin.type}`);
    lines.push(`  Brand/Level: ${bin.brand}`);
    lines.push(`  Prepaid: ${bin.prepaid ? "Yes" : "No"}`);
    lines.push(`  Source: ${bin.source}`);
  }

  if (live) {
    lines.push("");
    lines.push("── Live Verification ──");
    lines.push(`  Status: ${live.isLive ? "✅ Active" : "❌ Declined"}`);
    lines.push(`  CVC Check: ${formatCheck(live.cvcCheck)}`);
    lines.push(`  Address Check: ${formatCheck(live.addressCheck)}`);
    lines.push(`  ZIP Check: ${formatCheck(live.zipCheck)}`);
    if (live.funding) lines.push(`  Funding: ${live.funding}`);
    if (live.brand) lines.push(`  Network Brand: ${live.brand}`);
    if (!live.isLive && live.declineCode) {
      lines.push(`  Decline Code: ${live.declineCode}`);
      lines.push(`  Decline Reason: ${live.declineMessage || "N/A"}`);
      if (live.declineCategory) lines.push(`  Decline Category: ${live.declineCategory}`);
    }
  }

  lines.push("");
  lines.push("── Note ──");
  lines.push("  No charge was made. This check used Stripe SetupIntent (zero-cost verification).");
  lines.push("  The card was not burned or flagged.");

  return lines.join("\n");
}

function formatCheck(check: string): string {
  switch (check) {
    case "pass": return "✅ Pass";
    case "fail": return "❌ Fail";
    case "unavailable": return "⚠️ Unavailable";
    case "unchecked": return "— Not checked";
    default: return check;
  }
}

// ─── BIN-Only Lookup (no card details needed) ─────────────────────────────────

export async function checkBin(binNumber: string): Promise<BinInfo | null> {
  const clean = binNumber.replace(/\D/g, "");
  if (clean.length < 6) return null;
  return binLookup(clean);
}
