/**
 * Titan Local BIN Database
 *
 * Loads a compressed 343k-row BIN dataset from server/data/bins.json.gz
 * and provides fast in-memory search by BIN prefix, bank name, country,
 * card network, and card type.
 *
 * The dataset is loaded once on first call and cached for the lifetime
 * of the server process.
 */
import { createReadStream, existsSync } from "fs";
import { createGunzip } from "zlib";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface BinRow {
  bin: string;
  brand: string;     // VISA, MASTERCARD, AMEX, JCB, etc.
  type: string;      // CREDIT, DEBIT, PREPAID, CHARGE
  issuer: string;    // Bank / issuer name
  alpha2: string;    // ISO 3166-1 alpha-2 country code
  country: string;   // Country name
  prepaid: boolean;
}

export interface SearchParams {
  bin?: string;       // Exact BIN prefix match (6-8 digits)
  bank?: string;      // Substring match against issuer name (case-insensitive)
  country?: string;   // Exact ISO alpha-2 match (e.g. "AU", "US")
  network?: string;   // Substring match against brand (e.g. "visa", "mastercard")
  cardType?: string;  // Substring match against type (e.g. "credit", "debit")
  limit?: number;     // Max results to return (default 100)
}

// ─── In-memory cache ──────────────────────────────────────────────────────────
let _db: BinRow[] | null = null;
let _loading: Promise<BinRow[]> | null = null;

function getDataPath(): string {
  return join(__dirname, "data", "bins.json.gz");
}

export async function loadDatabase(): Promise<BinRow[]> {
  if (_db) return _db;
  if (_loading) return _loading;

  _loading = (async () => {
    const dataPath = getDataPath();
    if (!existsSync(dataPath)) {
      console.warn("[BinDatabase] bins.json.gz not found at", dataPath, "— BIN search will use external API only");
      _db = [];
      return _db;
    }

    return new Promise<BinRow[]>((resolve, reject) => {
      const rows: BinRow[] = [];
      let buffer = "";

      const stream = createReadStream(dataPath).pipe(createGunzip());
      stream.on("data", (chunk: Buffer) => {
        buffer += chunk.toString("utf8");
      });
      stream.on("end", () => {
        try {
          const parsed = JSON.parse(buffer);
          if (Array.isArray(parsed)) {
            for (const item of parsed) {
              rows.push({
                bin: String(item.bin ?? ""),
                brand: String(item.brand ?? item.scheme ?? "").toUpperCase(),
                type: String(item.type ?? "").toUpperCase(),
                issuer: String(item.issuer ?? item.bank ?? ""),
                alpha2: String(item.alpha2 ?? item.country_code ?? "").toUpperCase(),
                country: String(item.country ?? ""),
                prepaid: String(item.type ?? "").toUpperCase() === "PREPAID",
              });
            }
          }
          _db = rows;
          console.info(`[BinDatabase] Loaded ${rows.length.toLocaleString()} BIN records`);
          resolve(_db);
        } catch (err) {
          console.error("[BinDatabase] Failed to parse bins.json.gz:", err);
          _db = [];
          resolve(_db);
        }
      });
      stream.on("error", (err) => {
        console.error("[BinDatabase] Stream error:", err);
        _db = [];
        resolve(_db);
      });
    });
  })();

  return _loading;
}

// Pre-warm the cache on module load (non-blocking)
loadDatabase().catch(() => {});

/**
 * Search the local BIN database (async — awaits DB load if not yet ready).
 *
 * Returns up to `limit` rows matching all provided criteria.
 * All string comparisons are case-insensitive.
 */
export async function searchBins(params: SearchParams): Promise<BinRow[]> {
  // Always await the database — handles cold-start race condition
  const db = await loadDatabase();

  if (!db || db.length === 0) {
    return [];
  }

  const {
    bin,
    bank,
    country,
    network,
    cardType,
    limit = 100,
  } = params;

  const bankLower = bank?.toLowerCase().trim();
  const networkLower = network?.toLowerCase().trim();
  const cardTypeLower = cardType?.toLowerCase().trim();
  const countryUpper = country?.toUpperCase().trim();

  const results: BinRow[] = [];

  for (const row of db) {
    if (results.length >= limit) break;

    // BIN prefix match
    if (bin && !row.bin.startsWith(bin.slice(0, 8))) continue;

    // Bank name substring match
    if (bankLower && !row.issuer.toLowerCase().includes(bankLower)) continue;

    // Country exact match
    if (countryUpper && row.alpha2 !== countryUpper) continue;

    // Network/brand substring match
    if (networkLower && !row.brand.toLowerCase().includes(networkLower)) continue;

    // Card type substring match
    if (cardTypeLower && !row.type.toLowerCase().includes(cardTypeLower)) continue;

    results.push(row);
  }

  return results;
}

/**
 * Look up a single BIN by exact prefix (async).
 * Returns the first matching row or null.
 */
export async function lookupBin(bin: string): Promise<BinRow | null> {
  const results = await searchBins({ bin: bin.slice(0, 8), limit: 1 });
  return results.length > 0 ? results[0] : null;
}

/**
 * Returns true if the local database has been loaded and has records.
 */
export function isDatabaseLoaded(): boolean {
  return _db !== null && _db.length > 0;
}
