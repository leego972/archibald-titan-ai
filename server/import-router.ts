/**
 * Import Router — Import credentials from 1Password, LastPass, Bitwarden, and generic CSV.
 *
 * Parses CSV exports from popular password managers and imports them
 * into the vault as encrypted entries.
 */
import { z } from "zod";
import { eq, desc } from "drizzle-orm";
import { protectedProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "./db";
import { credentialImports, vaultItems } from "../drizzle/schema";
import { logAudit } from "./audit-log-db";
import crypto from "crypto";
import { getErrorMessage } from "./_core/errors.js";
import { consumeCredits } from "./credit-service";

// ─── AES-256 encryption (same as vault) ─────────────────────────
const VAULT_KEY = process.env.JWT_SECRET?.slice(0, 32).padEnd(32, "0") || "archibald-titan-vault-key-32char";

function encryptValue(plaintext: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-cbc", Buffer.from(VAULT_KEY, "utf8"), iv);
  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");
  return iv.toString("hex") + ":" + encrypted;
}

// ─── CSV Parsers for each source ────────────────────────────────

interface ParsedCredential {
  name: string;
  username?: string;
  password?: string;
  url?: string;
  notes?: string;
  totp?: string;
  credentialType: string;
}

function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let current = "";
  let inQuotes = false;
  let row: string[] = [];

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        row.push(current.trim());
        current = "";
      } else if (ch === "\n" || (ch === "\r" && text[i + 1] === "\n")) {
        row.push(current.trim());
        if (row.some(c => c.length > 0)) rows.push(row);
        row = [];
        current = "";
        if (ch === "\r") i++;
      } else {
        current += ch;
      }
    }
  }
  if (current.length > 0 || row.length > 0) {
    row.push(current.trim());
    if (row.some(c => c.length > 0)) rows.push(row);
  }
  return rows;
}

function parse1Password(csvText: string): ParsedCredential[] {
  const rows = parseCSV(csvText);
  if (rows.length < 2) return [];
  const headers = rows[0].map(h => h.toLowerCase());
  const titleIdx = headers.indexOf("title");
  const usernameIdx = headers.indexOf("username");
  const passwordIdx = headers.indexOf("password");
  const urlIdx = headers.indexOf("url");
  const notesIdx = headers.indexOf("notes");
  const otpIdx = headers.indexOf("otp");

  return rows.slice(1).map(row => ({
    name: row[titleIdx] || "Untitled",
    username: row[usernameIdx] || undefined,
    password: row[passwordIdx] || undefined,
    url: row[urlIdx] || undefined,
    notes: row[notesIdx] || undefined,
    totp: row[otpIdx] || undefined,
    credentialType: "password",
  })).filter(c => c.password || c.username);
}

function parseLastPass(csvText: string): ParsedCredential[] {
  const rows = parseCSV(csvText);
  if (rows.length < 2) return [];
  const headers = rows[0].map(h => h.toLowerCase());
  const nameIdx = headers.indexOf("name");
  const urlIdx = headers.indexOf("url");
  const usernameIdx = headers.indexOf("username");
  const passwordIdx = headers.indexOf("password");
  const notesIdx = headers.indexOf("extra");
  const totpIdx = headers.indexOf("totp");

  return rows.slice(1).map(row => ({
    name: row[nameIdx] || row[urlIdx] || "Untitled",
    username: row[usernameIdx] || undefined,
    password: row[passwordIdx] || undefined,
    url: row[urlIdx] || undefined,
    notes: row[notesIdx] || undefined,
    totp: row[totpIdx] || undefined,
    credentialType: "password",
  })).filter(c => c.password || c.username);
}

function parseBitwarden(csvText: string): ParsedCredential[] {
  const rows = parseCSV(csvText);
  if (rows.length < 2) return [];
  const headers = rows[0].map(h => h.toLowerCase());
  const nameIdx = headers.indexOf("name");
  const urlIdx = headers.findIndex(h => h === "login_uri" || h === "uri");
  const usernameIdx = headers.findIndex(h => h === "login_username" || h === "username");
  const passwordIdx = headers.findIndex(h => h === "login_password" || h === "password");
  const notesIdx = headers.indexOf("notes");
  const totpIdx = headers.findIndex(h => h === "login_totp" || h === "totp");

  return rows.slice(1).map(row => ({
    name: row[nameIdx] || "Untitled",
    username: usernameIdx >= 0 ? row[usernameIdx] : undefined,
    password: passwordIdx >= 0 ? row[passwordIdx] : undefined,
    url: urlIdx >= 0 ? row[urlIdx] : undefined,
    notes: notesIdx >= 0 ? row[notesIdx] : undefined,
    totp: totpIdx >= 0 ? row[totpIdx] : undefined,
    credentialType: "password",
  })).filter(c => c.password || c.username);
}

function parseGenericCSV(csvText: string): ParsedCredential[] {
  const rows = parseCSV(csvText);
  if (rows.length < 2) return [];
  const headers = rows[0].map(h => h.toLowerCase());

  // Try to find common column names
  const nameIdx = headers.findIndex(h => ["name", "title", "site", "service", "label"].includes(h));
  const usernameIdx = headers.findIndex(h => ["username", "user", "email", "login"].includes(h));
  const passwordIdx = headers.findIndex(h => ["password", "pass", "secret", "key", "value"].includes(h));
  const urlIdx = headers.findIndex(h => ["url", "website", "site_url", "uri", "link"].includes(h));
  const notesIdx = headers.findIndex(h => ["notes", "note", "extra", "comment", "description"].includes(h));

  return rows.slice(1).map(row => ({
    name: nameIdx >= 0 ? row[nameIdx] : (row[0] || "Untitled"),
    username: usernameIdx >= 0 ? row[usernameIdx] : undefined,
    password: passwordIdx >= 0 ? row[passwordIdx] : undefined,
    url: urlIdx >= 0 ? row[urlIdx] : undefined,
    notes: notesIdx >= 0 ? row[notesIdx] : undefined,
    credentialType: "password",
  })).filter(c => c.password || c.username);
}

const PARSERS: Record<string, (csv: string) => ParsedCredential[]> = {
  "1password": parse1Password,
  lastpass: parseLastPass,
  bitwarden: parseBitwarden,
  csv: parseGenericCSV,
};

// ─── Router ─────────────────────────────────────────────────────

export const importRouter = router({
  // Get supported import sources
  sources: protectedProcedure.query(() => [
    { id: "1password", name: "1Password", description: "Export from 1Password → CSV format", icon: "🔐" },
    { id: "lastpass", name: "LastPass", description: "Export from LastPass → CSV format", icon: "🔒" },
    { id: "bitwarden", name: "Bitwarden", description: "Export from Bitwarden → CSV format", icon: "🛡️" },
    { id: "csv", name: "Generic CSV", description: "Any CSV with name, username, password columns", icon: "📄" },
  ]),

  // Import credentials from CSV text
  importCSV: protectedProcedure
    .input(z.object({
      source: z.enum(["1password", "lastpass", "bitwarden", "csv"]),
      csvText: z.string().min(10).max(5_000_000), // max 5MB
      fileName: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const parser = PARSERS[input.source];
      if (!parser) throw new TRPCError({ code: "BAD_REQUEST", message: "Unsupported source" });

      // Parse the CSV
      let parsed: ParsedCredential[];
      try {
        parsed = parser(input.csvText);
      } catch (e: unknown) {
        throw new TRPCError({ code: "BAD_REQUEST", message: `Failed to parse CSV: ${getErrorMessage(e)}` });
      }

      if (parsed.length === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "No valid credentials found in the CSV. Check the format matches the selected source." });
      }

      // Deduct 1 credit per 10 credentials imported (minimum 1)
      const creditUnits = Math.max(1, Math.ceil(parsed.length / 10));
      for (let _i = 0; _i < creditUnits; _i++) {
        try { await consumeCredits(ctx.user.id, "import_action", `CSV import: ${input.source} (${parsed.length} entries)`); } catch { /* ignore */ }
      }

      // Create import record
      const [importRecord] = await db.insert(credentialImports).values({
        userId: ctx.user.id,
        source: input.source,
        fileName: input.fileName || `${input.source}-import.csv`,
        totalEntries: parsed.length,
        status: "processing",
      }).$returningId();

      // Import each credential into the vault
      let importedCount = 0;
      let skippedCount = 0;
      let errorCount = 0;
      const errors: string[] = [];

      for (const cred of parsed) {
        try {
          // Build the value to encrypt (combine username + password)
          const valueObj = {
            username: cred.username || "",
            password: cred.password || "",
            url: cred.url || "",
            notes: cred.notes || "",
            totp: cred.totp || "",
          };

          await db.insert(vaultItems).values({
            teamOwnerId: ctx.user.id,
            createdByUserId: ctx.user.id,
            name: cred.name,
            credentialType: cred.credentialType,
            encryptedValue: encryptValue(JSON.stringify(valueObj)),
            accessLevel: "owner",
            tags: [`imported:${input.source}`],
            notes: `Imported from ${input.source}${cred.url ? ` - ${cred.url}` : ""}`,
          });
          importedCount++;
        } catch (e: unknown) {
          errorCount++;
          errors.push(`${cred.name}: ${getErrorMessage(e)}`);
        }
      }

      skippedCount = parsed.length - importedCount - errorCount;

      // Update import record
      await db.update(credentialImports)
        .set({
          importedCount,
          skippedCount,
          errorCount,
          status: errorCount === parsed.length ? "failed" : "completed",
          errorDetails: errors.length > 0 ? errors.slice(0, 50) : undefined,
        })
        .where(eq(credentialImports.id, importRecord.id));

      await logAudit({
        userId: ctx.user.id,
        userName: ctx.user.name || "Unknown",
        action: "credential.import",
        resource: `import:${input.source}`,
        details: { message: `Imported ${importedCount} credentials from ${input.source}`, importedCount, skippedCount, errorCount, source: input.source },
      });

      return {
        importId: importRecord.id,
        totalEntries: parsed.length,
        importedCount,
        skippedCount,
        errorCount,
        errors: errors.slice(0, 10),
      };
    }),

  // Get import history
  history: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];
    return db.select()
      .from(credentialImports)
      .where(eq(credentialImports.userId, ctx.user.id))
      .orderBy(desc(credentialImports.createdAt))
      .limit(50);
  }),
});
