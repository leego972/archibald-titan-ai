/**
 * Titan BIN Checker & Card Validator
 *
 * ZERO-CHARGE PASSIVE METHODS ONLY:
 *   • BIN database lookup (no transaction, no authorisation request)
 *   • Luhn algorithm (mathematical check — completely offline)
 *   • Card network identification (Visa/MC/Amex/etc. by prefix)
 *   • Issuer bank lookup via public BIN databases
 *   • Reverse BIN search (search by bank name + country → get BIN numbers)
 *
 * Nothing here touches a live payment network. No charges, no auth requests,
 * no CVV checks, no balance checks. Pure data lookup only.
 */

import { z } from "zod";
import { router, protectedProcedure } from "./_core/trpc";
import { createLogger } from "./_core/logger.js";
import { consumeCredits, checkCredits } from "./credit-service";
import { getErrorMessage } from "./_core/errors.js";
import { searchBins } from "./bin-database.js";
import { checkCard } from "./card-checker.js";

const log = createLogger("BinChecker");

// ─── Card network detection ───────────────────────────────────────────────────

interface CardNetwork {
  name: string;
  code: string;
  pattern: RegExp;
  lengths: number[];
  cvvLength: number;
  luhnCheck: boolean;
}

const CARD_NETWORKS: CardNetwork[] = [
  { name: "Visa", code: "visa", pattern: /^4/, lengths: [13, 16, 19], cvvLength: 3, luhnCheck: true },
  { name: "Mastercard", code: "mastercard", pattern: /^(5[1-5]|2[2-7])/, lengths: [16], cvvLength: 3, luhnCheck: true },
  { name: "American Express", code: "amex", pattern: /^3[47]/, lengths: [15], cvvLength: 4, luhnCheck: true },
  { name: "Discover", code: "discover", pattern: /^(6011|622|64[4-9]|65)/, lengths: [16, 19], cvvLength: 3, luhnCheck: true },
  { name: "Diners Club", code: "diners", pattern: /^(300|301|302|303|304|305|36|38)/, lengths: [14], cvvLength: 3, luhnCheck: true },
  { name: "JCB", code: "jcb", pattern: /^35(2[89]|[3-8])/, lengths: [16, 17, 18, 19], cvvLength: 3, luhnCheck: true },
  { name: "UnionPay", code: "unionpay", pattern: /^62/, lengths: [16, 17, 18, 19], cvvLength: 3, luhnCheck: false },
  { name: "Maestro", code: "maestro", pattern: /^(5018|5020|5038|6304|6759|676[1-3])/, lengths: [12, 13, 14, 15, 16, 17, 18, 19], cvvLength: 3, luhnCheck: true },
  { name: "Elo", code: "elo", pattern: /^(4011|4312|4389|4514|4576|5041|5066|5090|6277|6362|6516|6550)/, lengths: [16], cvvLength: 3, luhnCheck: true },
  { name: "Hipercard", code: "hipercard", pattern: /^(384100|384140|384160|606282|637095|637568|60643)/, lengths: [13, 16, 19], cvvLength: 3, luhnCheck: true },
  { name: "Mir", code: "mir", pattern: /^220[0-4]/, lengths: [16], cvvLength: 3, luhnCheck: true },
  { name: "RuPay", code: "rupay", pattern: /^(508[5-9]|6069|607|608|6521|6522)/, lengths: [16], cvvLength: 3, luhnCheck: true },
];

function detectNetwork(cardNumber: string): CardNetwork | null {
  const clean = cardNumber.replace(/\D/g, "");
  return CARD_NETWORKS.find(n => n.pattern.test(clean)) ?? null;
}

// ─── Luhn algorithm ───────────────────────────────────────────────────────────

function luhnCheck(cardNumber: string): boolean {
  const digits = cardNumber.replace(/\D/g, "").split("").reverse().map(Number);
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let d = digits[i];
    if (i % 2 === 1) { d *= 2; if (d > 9) d -= 9; }
    sum += d;
  }
  return sum % 10 === 0;
}

// ─── BIN API lookup ───────────────────────────────────────────────────────────

interface BinApiResult {
  scheme?: string;
  type?: string;
  brand?: string;
  prepaid?: boolean;
  country?: { name?: string; alpha2?: string; emoji?: string; currency?: string; latitude?: number; longitude?: number };
  bank?: { name?: string; url?: string; phone?: string; city?: string };
  number?: { length?: number; luhn?: boolean };
}

async function lookupBinApi(bin: string): Promise<BinApiResult | null> {
  try {
    const res = await fetch(`https://lookup.binlist.net/${bin}`, {
      headers: { "Accept-Version": "3", "User-Agent": "TitanBinChecker/1.0" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    return await res.json() as BinApiResult;
  } catch {
    return null;
  }
}

// Fallback: bincheck.io
async function lookupBinFallback(bin: string): Promise<BinApiResult | null> {
  try {
    const res = await fetch(`https://api.bincodes.com/bin/?format=json&api_key=free&bin=${bin}`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data = await res.json() as any;
    if (data.error) return null;
    return {
      scheme: data.card?.toLowerCase(),
      type: data.type?.toLowerCase(),
      brand: data.brand,
      country: { name: data.country, alpha2: data.countrycode },
      bank: { name: data.bank },
    };
  } catch {
    return null;
  }
}

// ─── Country list ─────────────────────────────────────────────────────────────

export const COUNTRIES = [
  { code: "AU", name: "Australia", emoji: "🇦🇺" },
  { code: "US", name: "United States", emoji: "🇺🇸" },
  { code: "GB", name: "United Kingdom", emoji: "🇬🇧" },
  { code: "CA", name: "Canada", emoji: "🇨🇦" },
  { code: "NZ", name: "New Zealand", emoji: "🇳🇿" },
  { code: "DE", name: "Germany", emoji: "🇩🇪" },
  { code: "FR", name: "France", emoji: "🇫🇷" },
  { code: "IT", name: "Italy", emoji: "🇮🇹" },
  { code: "ES", name: "Spain", emoji: "🇪🇸" },
  { code: "NL", name: "Netherlands", emoji: "🇳🇱" },
  { code: "BE", name: "Belgium", emoji: "🇧🇪" },
  { code: "CH", name: "Switzerland", emoji: "🇨🇭" },
  { code: "AT", name: "Austria", emoji: "🇦🇹" },
  { code: "SE", name: "Sweden", emoji: "🇸🇪" },
  { code: "NO", name: "Norway", emoji: "🇳🇴" },
  { code: "DK", name: "Denmark", emoji: "🇩🇰" },
  { code: "FI", name: "Finland", emoji: "🇫🇮" },
  { code: "PL", name: "Poland", emoji: "🇵🇱" },
  { code: "PT", name: "Portugal", emoji: "🇵🇹" },
  { code: "IE", name: "Ireland", emoji: "🇮🇪" },
  { code: "SG", name: "Singapore", emoji: "🇸🇬" },
  { code: "HK", name: "Hong Kong", emoji: "🇭🇰" },
  { code: "JP", name: "Japan", emoji: "🇯🇵" },
  { code: "KR", name: "South Korea", emoji: "🇰🇷" },
  { code: "CN", name: "China", emoji: "🇨🇳" },
  { code: "IN", name: "India", emoji: "🇮🇳" },
  { code: "BR", name: "Brazil", emoji: "🇧🇷" },
  { code: "MX", name: "Mexico", emoji: "🇲🇽" },
  { code: "AR", name: "Argentina", emoji: "🇦🇷" },
  { code: "ZA", name: "South Africa", emoji: "🇿🇦" },
  { code: "AE", name: "United Arab Emirates", emoji: "🇦🇪" },
  { code: "SA", name: "Saudi Arabia", emoji: "🇸🇦" },
  { code: "TR", name: "Turkey", emoji: "🇹🇷" },
  { code: "RU", name: "Russia", emoji: "🇷🇺" },
  { code: "UA", name: "Ukraine", emoji: "🇺🇦" },
  { code: "TH", name: "Thailand", emoji: "🇹🇭" },
  { code: "MY", name: "Malaysia", emoji: "🇲🇾" },
  { code: "ID", name: "Indonesia", emoji: "🇮🇩" },
  { code: "PH", name: "Philippines", emoji: "🇵🇭" },
  { code: "VN", name: "Vietnam", emoji: "🇻🇳" },
  { code: "NG", name: "Nigeria", emoji: "🇳🇬" },
  { code: "KE", name: "Kenya", emoji: "🇰🇪" },
  { code: "GH", name: "Ghana", emoji: "🇬🇭" },
  { code: "EG", name: "Egypt", emoji: "🇪🇬" },
  { code: "IL", name: "Israel", emoji: "🇮🇱" },
  { code: "CZ", name: "Czech Republic", emoji: "🇨🇿" },
  { code: "HU", name: "Hungary", emoji: "🇭🇺" },
  { code: "RO", name: "Romania", emoji: "🇷🇴" },
  { code: "GR", name: "Greece", emoji: "🇬🇷" },
  { code: "HR", name: "Croatia", emoji: "🇭🇷" },
];

// ─── Router ───────────────────────────────────────────────────────────────────

export const binCheckerRouter = router({

  /** Get the country list for the country picker */
  getCountries: protectedProcedure.query(async () => {
    return { countries: COUNTRIES };
  }),

  /**
   * Look up a BIN (first 6-8 digits of a card number).
   * Returns bank name, card type, country, network — NO charge, NO auth.
   */
  lookupBin: protectedProcedure
    .input(z.object({ bin: z.string().min(6).max(8) }))
    .mutation(async ({ ctx, input }) => {
      const creditCheck = await checkCredits(ctx.user.id, "bin_lookup");
      if (!creditCheck.allowed) {
        throw new Error(`Insufficient credits for BIN lookup. Need ${creditCheck.cost}, have ${creditCheck.currentBalance}.`);
      }
       const bin = input.bin.replace(/\D/g, "").slice(0, 8);
      if (bin.length < 6) return { success: false, error: "BIN must be at least 6 digits." };
      // Detect card network from prefix
      const network = detectNetwork(bin);

      // ── Layer 1: Try local 343k-row BIN database first (instant, no rate limits) ──
      const localResults = await searchBins({ bin: bin.slice(0, 6) });
      let localRow = localResults.length > 0 ? localResults[0] : null;

      // ── Layer 2: Fall back to external API only if not found locally ──
      let apiData: BinApiResult | null = null;
      if (!localRow) {
        apiData = await lookupBinApi(bin.slice(0, 6));
        if (!apiData) apiData = await lookupBinFallback(bin.slice(0, 6));
      }

      // Deduct credits after successful lookup
      try { await consumeCredits(ctx.user.id, "bin_lookup", `BIN lookup: ${bin.slice(0, 6)}`); } catch (e) {
        log.warn("[BinChecker] Credit consumption failed (non-fatal):", { error: getErrorMessage(e) });
      }

      // Build unified response from local DB or API data
      const bankName = localRow?.issuer ?? apiData?.bank?.name ?? null;
      const countryCode = localRow?.alpha2 ?? apiData?.country?.alpha2 ?? null;
      const countryName = localRow?.country ?? apiData?.country?.name ?? null;
      const cardType = localRow?.type ?? apiData?.type ?? null;
      const cardBrand = localRow?.brand ?? apiData?.brand ?? apiData?.scheme ?? null;

      return {
        success: true,
        bin: bin.slice(0, 6),
        source: localRow ? "local_db" : (apiData ? "external_api" : "network_only"),
        network: network ? { name: network.name, code: network.code } : (cardBrand ? { name: cardBrand, code: cardBrand.toLowerCase() } : null),
        type: cardType,
        brand: cardBrand,
        prepaid: apiData?.prepaid ?? null,
        country: countryCode ? { name: countryName, alpha2: countryCode } : apiData?.country ?? null,
        bank: bankName ? { name: bankName } : apiData?.bank ?? null,
        luhnEnabled: apiData?.number?.luhn ?? (network?.luhnCheck ?? true),
      };
    }),

  /**
   * Validate a full card number using Luhn algorithm + network detection.
   * Completely offline — no network request, no charge.
   */
  validateCard: protectedProcedure
    .input(z.object({ cardNumber: z.string().min(13).max(19) }))
    .mutation(async ({ input }) => {
      const clean = input.cardNumber.replace(/\D/g, "");
      if (clean.length < 13 || clean.length > 19) {
        return { valid: false, luhnValid: false, network: null, error: "Card number must be 13-19 digits." };
      }

      const network = detectNetwork(clean);
      const luhnValid = luhnCheck(clean);
      const lengthValid = network ? network.lengths.includes(clean.length) : true;

      // Look up BIN info — local DB first, then external API fallback
      const bin = clean.slice(0, 6);
      const localBin = await searchBins({ bin });
      const localRow = localBin.length > 0 ? localBin[0] : null;
      let binData = null;
      if (!localRow) {
        binData = await lookupBinApi(bin);
        if (!binData) binData = await lookupBinFallback(bin);
      }
      const bankName = localRow?.issuer ?? binData?.bank?.name ?? null;
      const countryCode = localRow?.alpha2 ?? binData?.country?.alpha2 ?? null;
      const countryName = localRow?.country ?? binData?.country?.name ?? null;
      const cardType = localRow?.type ?? binData?.type ?? null;
      const cardBrand = localRow?.brand ?? binData?.brand ?? binData?.scheme ?? null;
      return {
        valid: luhnValid && lengthValid,
        luhnValid,
        lengthValid,
        cardLength: clean.length,
        network: network ? { name: network.name, code: network.code, cvvLength: network.cvvLength } : null,
        bin,
        bank: bankName ? { name: bankName } : binData?.bank ?? null,
        country: countryCode ? { name: countryName, alpha2: countryCode } : binData?.country ?? null,
        type: cardType,
        brand: cardBrand,
        prepaid: binData?.prepaid ?? null,
        maskedNumber: `${clean.slice(0, 4)} **** **** ${clean.slice(-4)}`,
        message: luhnValid && lengthValid ? "✓ Card number is mathematically valid" : luhnValid ? "Card passes Luhn but length is unusual for this network" : "✗ Card number fails Luhn check — likely invalid",
      };
    }),

  /**
   * Bulk validate multiple card numbers at once.
   */
  bulkValidate: protectedProcedure
    .input(z.object({ cards: z.array(z.string()).min(1).max(100) }))
    .mutation(async ({ ctx, input }) => {
      const creditCheck = await checkCredits(ctx.user.id, "bin_lookup");
      if (!creditCheck.allowed) {
        throw new Error(`Insufficient credits for bulk card validation. Need ${creditCheck.cost}, have ${creditCheck.currentBalance}.`);
      }
      const results = input.cards.map(card => {
        const clean = card.replace(/\D/g, "");
        if (clean.length < 13 || clean.length > 19) return { card: card.trim(), valid: false, luhnValid: false, network: null, error: "Invalid length" };
        const network = detectNetwork(clean);
        const luhnValid = luhnCheck(clean);
        const lengthValid = network ? network.lengths.includes(clean.length) : true;
        return {
          card: `${clean.slice(0, 4)} **** **** ${clean.slice(-4)}`,
          bin: clean.slice(0, 6),
          valid: luhnValid && lengthValid,
          luhnValid,
          lengthValid,
          network: network ? network.name : "Unknown",
        };
      });
      const valid = results.filter(r => r.valid).length;
      return { results, validCount: valid, invalidCount: results.length - valid, total: results.length };
    }),

  /**
   * Reverse BIN search — search by bank name + country to get BIN numbers.
   * Uses the local 343k-row BIN database — no external API needed.
   */
  reverseBinSearch: protectedProcedure
    .input(z.object({
      query: z.string().min(1).max(100),
      country: z.string().nullish(),   // ISO alpha-2 code e.g. "AU"
      network: z.string().nullish(),   // "visa", "mastercard", etc.
      cardType: z.string().nullish(),  // "credit", "debit", "prepaid"
    }))
    .mutation(async ({ ctx, input }) => {
      const creditCheck = await checkCredits(ctx.user.id, "bin_lookup");
      if (!creditCheck.allowed) {
        throw new Error(`Insufficient credits for reverse BIN search. Need ${creditCheck.cost}, have ${creditCheck.currentBalance}.`);
      }
      // Search the local 343k-row BIN database — awaits DB load if cold start
      const matches = await searchBins({
        bank: input.query.trim() || undefined,
        country: input.country ?? undefined,
        network: input.network ?? undefined,
        cardType: input.cardType ?? undefined,
        limit: 100,
      });

      // Map local DB results to the expected response format
      const results = matches.map(m => ({
        bin: m.bin,
        bank: m.issuer || "Unknown",
        brand: m.brand || "Unknown",
        type: m.type || "Unknown",
        network: m.brand || "Unknown",
        country: m.country || "Unknown",
        countryCode: m.alpha2 || "",
        prepaid: m.prepaid,
      }));

      // Consume credits after successful search
      try { await consumeCredits(ctx.user.id, "bin_lookup", `Reverse BIN search: ${input.query}`); } catch (e) {
        log.warn("[BinChecker] Credit consumption failed (non-fatal):", { error: getErrorMessage(e) });
      }

      return {
        success: true,
        results,
        count: results.length,
        query: input.query,
        country: input.country,
        message: results.length > 0 ? `Found ${results.length} BIN(s) matching "${input.query}"` : `No BINs found for "${input.query}"${input.country ? ` in ${input.country}` : ""}. Try a shorter search term.`,
      };
    }),

  /**
   * Bulk BIN lookup — look up multiple BINs at once.
   */
  bulkBinLookup: protectedProcedure
    .input(z.object({ bins: z.array(z.string().min(6).max(8)).min(1).max(50) }))
    .mutation(async ({ ctx, input }) => {
      const creditCheck = await checkCredits(ctx.user.id, "bin_lookup");
      if (!creditCheck.allowed) {
        throw new Error(`Insufficient credits for bulk BIN lookup. Need ${creditCheck.cost}, have ${creditCheck.currentBalance}.`);
      }
      const results = [];
      for (const rawBin of input.bins) {
        const bin = rawBin.replace(/\D/g, "").slice(0, 6);
        const network = detectNetwork(bin);
        // Try local DB first
        const localResults = await searchBins({ bin });
        const localRow = localResults.length > 0 ? localResults[0] : null;
        let apiData = null;
        if (!localRow) {
          apiData = await lookupBinApi(bin);
          if (!apiData) apiData = await lookupBinFallback(bin);
          // Rate limit: 1 request per 500ms for binlist.net
          await new Promise(r => setTimeout(r, 500));
        }
        results.push({
          bin,
          network: network?.name ?? localRow?.brand ?? apiData?.scheme ?? "Unknown",
          type: localRow?.type ?? apiData?.type ?? "Unknown",
          bank: localRow?.issuer ?? apiData?.bank?.name ?? "Unknown",
          country: localRow?.country ?? apiData?.country?.name ?? "Unknown",
          countryCode: localRow?.alpha2 ?? apiData?.country?.alpha2 ?? "",
          prepaid: localRow?.prepaid ?? apiData?.prepaid ?? false,
        });
      }
      return { results, count: results.length };
    }),

  /** Get card network info by prefix (instant, offline) */
  detectNetwork: protectedProcedure
    .input(z.object({ prefix: z.string().min(1).max(8) }))
    .query(async ({ input }) => {
      const network = detectNetwork(input.prefix);
      if (!network) return { found: false, network: null };
      return {
        found: true,
        network: {
          name: network.name,
          code: network.code,
          lengths: network.lengths,
          cvvLength: network.cvvLength,
          luhnCheck: network.luhnCheck,
        },
      };
    }),

  /**
   * Full 3-layer card check:
   *   Layer 1: Luhn algorithm (instant, offline)
   *   Layer 2: BIN lookup (bank, country, type, brand)
   *   Layer 3: Stripe SetupIntent live verification (contacts issuing bank, returns real decline codes)
   *
   * ZERO CHARGE — uses SetupIntent, not PaymentIntent. No money moves.
   * Returns exact bank decline codes: insufficient_funds, lost_card, stolen_card,
   * expired_card, do_not_honor, fraudulent, card_velocity_exceeded, etc.
   */
  fullCheck: protectedProcedure
    .input(
      z.object({
        cardNumber: z.string().min(13).max(19),
        expMonth: z.number().int().min(1).max(12),
        expYear: z.number().int().min(2024).max(2040),
        cvc: z.string().min(3).max(4),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Consume credits for a live card check
      const creditCheck = await checkCredits(ctx.user.id, "card_live_check");
      if (!creditCheck.allowed) {
        throw new Error(`Insufficient credits. Need ${creditCheck.cost}, have ${creditCheck.currentBalance}.`);
      }
      await consumeCredits(ctx.user.id, "card_live_check", "Full card check (Luhn + BIN + Stripe live)");
      const result = await checkCard({
        cardNumber: input.cardNumber.replace(/\D/g, ""),
        expMonth: input.expMonth,
        expYear: input.expYear,
        cvc: input.cvc,
      });
      return result;
    }),
});
