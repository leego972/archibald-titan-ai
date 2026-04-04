/**
 * bin-database.ts
 *
 * Local BIN database loader and search engine.
 * Loads the compressed 343k-row BIN dataset from server/data/bins.json.gz
 * and provides fast in-memory reverse lookup by bank name, country, brand, and card type.
 *
 * Data format per row: [bin, brand, type, issuer, alpha2, country]
 * Indices: 0=bin, 1=brand, 2=type, 3=issuer, 4=alpha2, 5=country
 */

import fs from "fs";
import path from "path";
import zlib from "zlib";

export interface BinRecord {
  bin: string;
  brand: string;
  type: string;
  issuer: string;
  alpha2: string;
  country: string;
  prepaid: boolean;
}

type RawRow = [string, string, string, string, string, string];

let _db: RawRow[] | null = null;

function loadDb(): RawRow[] {
  if (_db) return _db;
  const filePath = path.join(__dirname, "data", "bins.json.gz");
  const compressed = fs.readFileSync(filePath);
  const json = zlib.gunzipSync(compressed).toString("utf8");
  _db = JSON.parse(json) as RawRow[];
  return _db;
}

function rowToRecord(row: RawRow): BinRecord {
  return {
    bin: row[0],
    brand: row[1],
    type: row[2],
    issuer: row[3],
    alpha2: row[4],
    country: row[5],
    prepaid: row[2] === "PREPAID",
  };
}

export interface BinSearchParams {
  /** Bank / issuer name (partial match, case-insensitive) */
  bank?: string;
  /** ISO-3166 alpha-2 country code (e.g. "US", "GB") */
  country?: string;
  /** Card network / brand: VISA, MASTERCARD, AMEX, DISCOVER, MAESTRO, JCB, UNIONPAY */
  network?: string;
  /** Card type: CREDIT, DEBIT, PREPAID, CHARGE */
  cardType?: string;
  /** Maximum results to return (default 50) */
  limit?: number;
}

/**
 * Search the local BIN database by any combination of criteria.
 * Returns up to `limit` matching BIN records.
 */
export function searchBins(params: BinSearchParams): BinRecord[] {
  const db = loadDb();
  const {
    bank,
    country,
    network,
    cardType,
    limit = 50,
  } = params;

  const bankQ = bank?.trim().toUpperCase();
  const countryQ = country?.trim().toUpperCase();
  const networkQ = normaliseNetwork(network);
  const typeQ = normaliseCardType(cardType);

  // Require at least one filter
  if (!bankQ && !countryQ && !networkQ && !typeQ) return [];

  const results: BinRecord[] = [];

  for (const row of db) {
    if (results.length >= limit) break;

    // Country filter (exact alpha2 match)
    if (countryQ && row[4] !== countryQ) continue;

    // Network / brand filter
    if (networkQ && !row[1].includes(networkQ)) continue;

    // Card type filter
    if (typeQ && !row[2].includes(typeQ)) continue;

    // Bank / issuer filter (substring match)
    if (bankQ && !row[3].includes(bankQ)) continue;

    results.push(rowToRecord(row));
  }

  return results;
}

/**
 * Look up a single BIN from the local database.
 */
export function lookupBinLocal(bin: string): BinRecord | null {
  const db = loadDb();
  const target = bin.replace(/\D/g, "").slice(0, 8);
  // Try exact match first (6-digit then 8-digit)
  for (const row of db) {
    if (row[0] === target || row[0] === target.slice(0, 6)) {
      return rowToRecord(row);
    }
  }
  return null;
}

// ─── Normalisation helpers ────────────────────────────────────────────────────

function normaliseNetwork(n?: string): string | undefined {
  if (!n) return undefined;
  const u = n.toUpperCase().trim();
  if (u === "VISA") return "VISA";
  if (u === "MASTERCARD" || u === "MC") return "MASTERCARD";
  if (u === "AMEX" || u === "AMERICAN EXPRESS") return "AMERICAN EXPRESS";
  if (u === "DISCOVER") return "DISCOVER";
  if (u === "MAESTRO") return "MAESTRO";
  if (u === "JCB") return "JCB";
  if (u === "UNIONPAY" || u === "UNION PAY" || u === "CUP") return "CHINA UNION PAY";
  if (u === "DINERS" || u === "DINERS CLUB") return "DINERS CLUB";
  return u;
}

function normaliseCardType(t?: string): string | undefined {
  if (!t) return undefined;
  const u = t.toUpperCase().trim();
  if (u === "CREDIT") return "CREDIT";
  if (u === "DEBIT") return "DEBIT";
  if (u === "PREPAID") return "PREPAID";
  if (u === "CHARGE" || u === "CHARGE CARD") return "CHARGE CARD";
  return u;
}
