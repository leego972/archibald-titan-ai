/**
 * fix-journal.mjs
 * Rebuilds drizzle/meta/_journal.json to include every .sql migration file
 * that exists in drizzle/ but is missing from the journal.
 *
 * Safe to run multiple times — only adds missing entries, never removes existing ones.
 * Entries are sorted by tag name (numeric prefix order).
 */
import { readFileSync, writeFileSync, readdirSync } from "fs";
import { createHash } from "crypto";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const drizzleDir = resolve(__dirname, "..", "drizzle");
const journalPath = resolve(drizzleDir, "meta", "_journal.json");

const journal = JSON.parse(readFileSync(journalPath, "utf8"));
const existingTags = new Set(journal.entries.map((e) => e.tag));

// Collect all .sql files (excluding add-indexes.sql which is a utility, not a migration)
const sqlFiles = readdirSync(drizzleDir)
  .filter((f) => f.endsWith(".sql") && f !== "add-indexes.sql")
  .sort();

let added = 0;
for (const file of sqlFiles) {
  const tag = file.replace(/\.sql$/, "");
  if (existingTags.has(tag)) continue;

  // Compute a deterministic hash from the file content (same format Drizzle uses)
  const content = readFileSync(resolve(drizzleDir, file), "utf8");
  const hash = createHash("sha256").update(content).digest("hex");

  // Use a timestamp derived from the numeric prefix so ordering is stable
  const numericPrefix = parseInt(tag.split("_")[0], 10);
  const baseTs = 1771090955324; // last known real timestamp
  const fakeTs = baseTs + (numericPrefix + 1) * 1000;

  journal.entries.push({ idx: numericPrefix, version: "7", when: fakeTs, tag, breakpoints: true });
  console.log(`  + Added: ${tag}`);
  added++;
}

// Sort all entries by tag (lexicographic = numeric order for zero-padded names)
journal.entries.sort((a, b) => a.tag.localeCompare(b.tag));

// Re-index idx fields
journal.entries.forEach((e, i) => { e.idx = i; });

writeFileSync(journalPath, JSON.stringify(journal, null, 2) + "\n");
console.log(`\nDone. Added ${added} entries. Total: ${journal.entries.length}`);
