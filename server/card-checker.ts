/**
 * ═══════════════════════════════════════════════════════════════════════
 *  CARD CHECKER — 3-Layer BIN + Validation + Live Verification Engine
 * ═══════════════════════════════════════════════════════════════════════
 *
 *  Layer 1: Luhn Algorithm — mathematical card number validation (instant, free)
 *  Layer 2: BIN Lookup — identifies bank, country, card type, level (free API)
 *  Layer 3: Stripe SetupIntent — verifies card is LIVE without charging (free, no burn)
 *
 *  This module NEVER charges a card. It uses Stripe's SetupIntent API which
 *  contacts the issuing bank for verification without creating any transaction.
 *  This is the same mechanism Netflix/Spotify use when you "add a card."
 */

import Stripe from "stripe";
import { ENV } from "./_core/env";
import { createLogger } from "./_core/logger.js";

const log = createLogger("CardChecker");

// ─── Types ───────────────────────────────────────────────────────────

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
}

export interface LiveCheckResult {
  isLive: boolean;
  cvcCheck: string;     // pass, fail, unavailable, unchecked
  addressCheck: string; // pass, fail, unavailable, unchecked
  zipCheck: string;     // pass, fail, unavailable, unchecked
  declineCode?: string;
  declineMessage?: string;
  funding?: string;     // credit, debit, prepaid, unknown
  brand?: string;       // visa, mastercard, amex
  last4?: string;
  expMonth?: number;
  expYear?: number;
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
  summary: string;
  checkedAt: string;
}

// ─── Layer 1: Luhn Algorithm ─────────────────────────────────────────

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

// ─── Layer 2: BIN Lookup ─────────────────────────────────────────────

async function binLookup(cardNumber: string): Promise<BinInfo | null> {
  const digits = cardNumber.replace(/\D/g, "");
  const bin = digits.substring(0, 8); // Use 8-digit BIN for better accuracy

  try {
    // Try binlist.net first (free, no auth)
    const response = await fetch(`https://lookup.binlist.net/${bin}`, {
      headers: {
        "Accept-Version": "3",
        "Accept": "application/json",
      },
    });

    if (!response.ok) {
      // Fall back to 6-digit BIN
      const response6 = await fetch(`https://lookup.binlist.net/${bin.substring(0, 6)}`, {
        headers: {
          "Accept-Version": "3",
          "Accept": "application/json",
        },
      });
      if (!response6.ok) return null;
      const data = await response6.json() as Record<string, any>;
      return parseBinResponse(data, digits);
    }

    const data = await response.json() as Record<string, any>;
    return parseBinResponse(data, digits);
  } catch (err) {
    log.warn("BIN lookup failed:", { error: String(err) });
    return null;
  }
}

function parseBinResponse(data: Record<string, any>, digits: string): BinInfo {
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
  };
}

// ─── Layer 3: Stripe SetupIntent Live Verification ───────────────────

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

  // Step 1: Create a temporary payment method with the card details
  let paymentMethod: Stripe.PaymentMethod;
  try {
    paymentMethod = await stripe.paymentMethods.create({
      type: "card",
      card: {
        number: card.cardNumber.replace(/\D/g, ""),
        exp_month: card.expMonth,
        exp_year: card.expYear,
        cvc: card.cvc,
      },
    });
  } catch (err: any) {
    // Card was rejected at creation — this means it's invalid/declined
    return {
      isLive: false,
      cvcCheck: "unavailable",
      addressCheck: "unavailable",
      zipCheck: "unavailable",
      declineCode: err.code || "card_declined",
      declineMessage: err.message || "Card was declined",
    };
  }

  // Step 2: Create a temporary customer
  let customer: Stripe.Customer;
  try {
    customer = await stripe.customers.create({
      description: "Temporary card verification — auto-cleanup",
      metadata: { purpose: "card_check", autoDelete: "true" },
    });
  } catch (err: any) {
    // Cleanup payment method
    try { await stripe.paymentMethods.detach(paymentMethod.id); } catch {}
    throw new Error(`Failed to create temp customer: ${err.message}`);
  }

  // Step 3: Create and confirm a SetupIntent (this contacts the issuing bank)
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

    return {
      isLive: false,
      cvcCheck: "unavailable",
      addressCheck: "unavailable",
      zipCheck: "unavailable",
      declineCode: err.code || "setup_failed",
      declineMessage: err.message || "Card verification failed",
    };
  }

  // Step 4: Extract verification results
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
  };

  if (setupIntent.status !== "succeeded") {
    const lastError = setupIntent.last_setup_error;
    result.declineCode = lastError?.code || "unknown";
    result.declineMessage = lastError?.message || "Verification did not succeed";
  }

  // Step 5: Cleanup — detach payment method and delete temp customer
  try { await stripe.paymentMethods.detach(paymentMethod.id); } catch {}
  try { await stripe.customers.del(customer.id); } catch {}

  return result;
}

// ─── Main Check Function ─────────────────────────────────────────────

export async function checkCard(request: CardCheckRequest): Promise<CardCheckResult> {
  const cleanNumber = request.cardNumber.replace(/\D/g, "");
  const scheme = detectScheme(cleanNumber);
  const checkedAt = new Date().toISOString();

  log.info(`Card check initiated: ${scheme} ****${cleanNumber.slice(-4)}`);

  // Layer 1: Luhn validation
  const luhnValid = luhnValidate(cleanNumber);

  if (!luhnValid) {
    return {
      luhnValid: false,
      cardNumberLength: cleanNumber.length,
      detectedScheme: scheme,
      binLookup: null,
      liveCheck: null,
      overallStatus: "INVALID_NUMBER",
      summary: `❌ INVALID — Card number fails Luhn check. The number ${cleanNumber.length < 12 ? "is too short" : "has an invalid checksum"}. This is not a valid card number.`,
      checkedAt,
    };
  }

  // Validate CVC length
  const expectedCvc = getExpectedCvcLength(scheme);
  if (request.cvc.length !== expectedCvc) {
    return {
      luhnValid: true,
      cardNumberLength: cleanNumber.length,
      detectedScheme: scheme,
      binLookup: null,
      liveCheck: null,
      overallStatus: "INVALID_NUMBER",
      summary: `❌ INVALID — CVC should be ${expectedCvc} digits for ${scheme.toUpperCase()}, but got ${request.cvc.length} digits.`,
      checkedAt,
    };
  }

  // Layer 2: BIN lookup
  let binInfo: BinInfo | null = null;
  let binError: string | undefined;
  try {
    binInfo = await binLookup(cleanNumber);
  } catch (err: any) {
    binError = err.message || "BIN lookup failed";
  }

  // Layer 3: Live verification via Stripe SetupIntent
  let liveResult: LiveCheckResult | null = null;
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

  // Determine overall status
  let overallStatus: CardCheckResult["overallStatus"];
  if (liveResult?.isLive) {
    overallStatus = "LIVE";
  } else if (liveResult && !liveResult.isLive) {
    overallStatus = "DECLINED";
  } else if (binInfo) {
    overallStatus = "BIN_ONLY";
  } else {
    overallStatus = "ERROR";
  }

  // Build summary
  const summary = buildSummary(overallStatus, scheme, cleanNumber, binInfo, liveResult, liveError);

  log.info(`Card check complete: ${scheme} ****${cleanNumber.slice(-4)} → ${overallStatus}`);

  return {
    luhnValid,
    cardNumberLength: cleanNumber.length,
    detectedScheme: scheme,
    binLookup: binInfo,
    binError,
    liveCheck: liveResult,
    liveError,
    overallStatus,
    summary,
    checkedAt,
  };
}

function buildSummary(
  status: CardCheckResult["overallStatus"],
  scheme: string,
  number: string,
  bin: BinInfo | null,
  live: LiveCheckResult | null,
  liveError?: string,
): string {
  const last4 = number.slice(-4);
  const lines: string[] = [];

  switch (status) {
    case "LIVE":
      lines.push(`✅ LIVE — ${scheme.toUpperCase()} ****${last4} is active and verified.`);
      break;
    case "DECLINED":
      lines.push(`❌ DECLINED — ${scheme.toUpperCase()} ****${last4} was rejected by the issuing bank.`);
      if (live?.declineCode) lines.push(`   Reason: ${live.declineCode} — ${live.declineMessage || "No details"}`);
      break;
    case "BIN_ONLY":
      lines.push(`⚠️ BIN VERIFIED — ${scheme.toUpperCase()} ****${last4} number is valid but live check unavailable.`);
      if (liveError) lines.push(`   Live check: ${liveError}`);
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
  }

  if (live) {
    lines.push("");
    lines.push("── Live Verification ──");
    lines.push(`  Status: ${live.isLive ? "✅ Active" : "❌ Declined"}`);
    lines.push(`  CVC Check: ${formatCheck(live.cvcCheck)}`);
    lines.push(`  Funding: ${live.funding || "unknown"}`);
    if (live.brand) lines.push(`  Network Brand: ${live.brand}`);
    if (!live.isLive && live.declineCode) {
      lines.push(`  Decline Code: ${live.declineCode}`);
      lines.push(`  Decline Reason: ${live.declineMessage || "N/A"}`);
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

// ─── BIN-Only Lookup (no card details needed) ────────────────────────

export async function checkBin(binNumber: string): Promise<BinInfo | null> {
  const clean = binNumber.replace(/\D/g, "");
  if (clean.length < 6) return null;
  return binLookup(clean);
}
