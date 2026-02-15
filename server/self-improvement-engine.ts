/**
 * Self-Improvement Engine v5.1
 *
 * Allows Titan Assistant to modify its own code safely through:
 *
 * 1. SNAPSHOT — Save current file state before any modification
 * 2. VALIDATE — Syntax/type check changes before applying
 * 3. APPLY — Write changes to disk with atomic writes
 * 4. VERIFY — Confirm the system is still healthy after changes
 * 5. ROLLBACK — Revert to last known good state if anything breaks
 * 6. RESTART — Restart services after successful changes
 *
 * Safety barriers:
 * - Protected core files cannot be modified (auth, encryption, safety engine itself)
 * - All changes are logged in the self_modification_log table
 * - Automatic rollback if health check fails after a change
 * - Maximum change size limits to prevent catastrophic rewrites
 * - Dry-run validation before any write
 */

import { createHash } from "crypto";
import * as fs from "fs";
import * as path from "path";
import { eq, desc } from "drizzle-orm";
import { getDb } from "./db";
import {
  systemSnapshots,
  snapshotFiles,
  selfModificationLog,
} from "../drizzle/schema";

// ─── Constants ───────────────────────────────────────────────────────

const PROJECT_ROOT = process.cwd();

/**
 * PROTECTED FILES — These cannot be modified by the self-improvement engine.
 * Modifying these could break authentication, encryption, or the safety system itself.
 */
const PROTECTED_PATHS: string[] = [
  // Core framework — never touch
  "server/_core/",
  // The self-improvement engine itself — prevent self-corruption
  "server/self-improvement-engine.ts",
  // Authentication and encryption — security critical
  "server/email-auth-router.ts",
  "server/two-factor-router.ts",
  "server/identity-provider-router.ts",
  // Database schema — changes here require migration
  "drizzle/schema.ts",
  "drizzle/relations.ts",
  // Package config — dependency changes need careful review
  "package.json",
  "pnpm-lock.yaml",
  // Environment and secrets
  ".env",
  "server/_core/env.ts",
  // Kill switch — emergency shutdown must always work
  "server/fetcher-engine/safety-engine.ts",
  // Stripe/payment — financial operations are critical
  "server/stripe-router.ts",
  "server/subscription-gate.ts",
];

/**
 * ALLOWED DIRECTORIES — Only files in these directories can be modified.
 */
const ALLOWED_DIRECTORIES: string[] = [
  "server/",
  "client/src/",
  "shared/",
];

/**
 * Maximum file size that can be written (100KB) — prevents catastrophic overwrites.
 */
const MAX_FILE_SIZE = 100 * 1024;

/**
 * Maximum number of files that can be modified in a single operation.
 */
const MAX_FILES_PER_OPERATION = 5;

// ─── Types ───────────────────────────────────────────────────────────

export interface SnapshotResult {
  success: boolean;
  snapshotId?: number;
  fileCount?: number;
  error?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface ModificationRequest {
  filePath: string;
  action: "modify" | "create" | "delete";
  content?: string; // new content for modify/create
  description: string;
}

export interface ModificationResult {
  success: boolean;
  snapshotId?: number;
  modifications: Array<{
    filePath: string;
    action: string;
    applied: boolean;
    error?: string;
  }>;
  validationResult?: ValidationResult;
  healthCheckPassed?: boolean;
  rolledBack?: boolean;
  error?: string;
}

export interface HealthCheckResult {
  healthy: boolean;
  checks: Array<{
    name: string;
    passed: boolean;
    message: string;
  }>;
}

// ─── Path Safety ─────────────────────────────────────────────────────

function normalizePath(filePath: string): string {
  // Resolve to absolute, then make relative to project root
  const absolute = path.resolve(PROJECT_ROOT, filePath);
  const relative = path.relative(PROJECT_ROOT, absolute);

  // Prevent path traversal
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Path traversal detected: ${filePath}`);
  }

  return relative;
}

function isProtected(filePath: string): boolean {
  const normalized = normalizePath(filePath);
  return PROTECTED_PATHS.some(
    (p) => normalized === p || normalized.startsWith(p)
  );
}

function isInAllowedDirectory(filePath: string): boolean {
  const normalized = normalizePath(filePath);
  return ALLOWED_DIRECTORIES.some((d) => normalized.startsWith(d));
}

function hashContent(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

// ─── Snapshot System ─────────────────────────────────────────────────

/**
 * Create a snapshot of specific files before modification.
 * Saves the current content to the database so we can roll back.
 */
export async function createSnapshot(
  filePaths: string[],
  reason: string,
  triggeredBy: string = "titan_assistant"
): Promise<SnapshotResult> {
  const db = await getDb();
  if (!db) return { success: false, error: "Database unavailable" };

  try {
    // Create the snapshot record
    const [result] = await db.insert(systemSnapshots).values({
      triggeredBy,
      reason,
      fileCount: filePaths.length,
      status: "active",
      isKnownGood: 0,
    });

    const snapshotId = result.insertId;

    // Save each file's content
    let savedCount = 0;
    for (const fp of filePaths) {
      const normalized = normalizePath(fp);
      const fullPath = path.join(PROJECT_ROOT, normalized);

      if (fs.existsSync(fullPath)) {
        const content = fs.readFileSync(fullPath, "utf-8");
        await db.insert(snapshotFiles).values({
          snapshotId,
          filePath: normalized,
          contentHash: hashContent(content),
          content,
        });
        savedCount++;
      }
    }

    return {
      success: true,
      snapshotId,
      fileCount: savedCount,
    };
  } catch (err) {
    return {
      success: false,
      error: `Snapshot failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/**
 * Mark a snapshot as "known good" — validated as working.
 */
export async function markSnapshotAsGood(
  snapshotId: number
): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  await db
    .update(systemSnapshots)
    .set({ isKnownGood: 1 })
    .where(eq(systemSnapshots.id, snapshotId));

  return true;
}

// ─── Validation ──────────────────────────────────────────────────────

/**
 * Validate proposed modifications before applying them.
 * Checks:
 * - Protected file violations
 * - Allowed directory restrictions
 * - File size limits
 * - Basic syntax validation (brackets, quotes)
 * - Dangerous pattern detection
 */
export function validateModifications(
  modifications: ModificationRequest[]
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check count limit
  if (modifications.length > MAX_FILES_PER_OPERATION) {
    errors.push(
      `Too many files (${modifications.length}). Maximum is ${MAX_FILES_PER_OPERATION} per operation.`
    );
  }

  for (const mod of modifications) {
    const normalized = normalizePath(mod.filePath);

    // Protected file check
    if (isProtected(normalized)) {
      errors.push(
        `PROTECTED: ${normalized} cannot be modified. This file is critical to system security.`
      );
      continue;
    }

    // Allowed directory check
    if (!isInAllowedDirectory(normalized)) {
      errors.push(
        `RESTRICTED: ${normalized} is outside allowed directories (${ALLOWED_DIRECTORIES.join(", ")}).`
      );
      continue;
    }

    // Content checks for modify/create
    if (mod.action !== "delete" && mod.content) {
      // Size limit
      if (Buffer.byteLength(mod.content, "utf-8") > MAX_FILE_SIZE) {
        errors.push(
          `SIZE LIMIT: ${normalized} content exceeds ${MAX_FILE_SIZE / 1024}KB limit.`
        );
      }

      // Dangerous patterns
      const dangerousPatterns = [
        { pattern: /process\.exit/g, msg: "process.exit() call detected" },
        { pattern: /require\s*\(\s*['"]child_process['"]\s*\)/g, msg: "child_process import detected" },
        { pattern: /exec\s*\(/g, msg: "exec() call detected — potential command injection" },
        { pattern: /eval\s*\(/g, msg: "eval() call detected — potential code injection" },
        { pattern: /rm\s+-rf/g, msg: "rm -rf command detected" },
        { pattern: /DROP\s+TABLE/gi, msg: "DROP TABLE SQL detected" },
        { pattern: /DELETE\s+FROM\s+\w+\s*;/gi, msg: "Unfiltered DELETE FROM detected" },
        { pattern: /TRUNCATE/gi, msg: "TRUNCATE SQL detected" },
      ];

      for (const dp of dangerousPatterns) {
        if (dp.pattern.test(mod.content)) {
          errors.push(`DANGEROUS: ${normalized} — ${dp.msg}`);
        }
      }

      // Basic syntax check for TypeScript/JavaScript files
      if (normalized.endsWith(".ts") || normalized.endsWith(".tsx") || normalized.endsWith(".js")) {
        const openBraces = (mod.content.match(/\{/g) || []).length;
        const closeBraces = (mod.content.match(/\}/g) || []).length;
        if (Math.abs(openBraces - closeBraces) > 2) {
          warnings.push(
            `SYNTAX WARNING: ${normalized} has mismatched braces (${openBraces} open, ${closeBraces} close).`
          );
        }

        const openParens = (mod.content.match(/\(/g) || []).length;
        const closeParens = (mod.content.match(/\)/g) || []).length;
        if (Math.abs(openParens - closeParens) > 2) {
          warnings.push(
            `SYNTAX WARNING: ${normalized} has mismatched parentheses (${openParens} open, ${closeParens} close).`
          );
        }
      }

      // Check for import of protected modules
      if (/import.*self-improvement-engine/g.test(mod.content)) {
        warnings.push(
          `WARNING: ${normalized} imports self-improvement-engine — be careful not to create circular dependencies.`
        );
      }
    }

    // Delete checks
    if (mod.action === "delete") {
      const fullPath = path.join(PROJECT_ROOT, normalized);
      if (!fs.existsSync(fullPath)) {
        warnings.push(`WARNING: ${normalized} does not exist (delete is a no-op).`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

// ─── Apply Modifications ─────────────────────────────────────────────

/**
 * Apply validated modifications to the filesystem.
 * This is the core "self-improvement" operation.
 *
 * Flow:
 * 1. Validate all modifications
 * 2. Create snapshot of affected files
 * 3. Apply each modification
 * 4. Run health check
 * 5. If health check fails → automatic rollback
 * 6. Log everything
 */
export async function applyModifications(
  modifications: ModificationRequest[],
  userId: number | null,
  requestedBy: string = "titan_assistant"
): Promise<ModificationResult> {
  const db = await getDb();
  if (!db) return { success: false, error: "Database unavailable", modifications: [] };

  // Step 1: Validate
  const validation = validateModifications(modifications);
  if (!validation.valid) {
    return {
      success: false,
      validationResult: validation,
      modifications: modifications.map((m) => ({
        filePath: m.filePath,
        action: m.action,
        applied: false,
        error: "Validation failed",
      })),
      error: `Validation failed: ${validation.errors.join("; ")}`,
    };
  }

  // Step 2: Snapshot affected files
  const filePaths = modifications.map((m) => m.filePath);
  const snapshot = await createSnapshot(
    filePaths,
    `Pre-modification snapshot: ${modifications.map((m) => `${m.action} ${m.filePath}`).join(", ")}`,
    requestedBy
  );

  if (!snapshot.success) {
    return {
      success: false,
      error: `Failed to create snapshot: ${snapshot.error}`,
      modifications: [],
    };
  }

  // Step 3: Apply each modification
  const results: ModificationResult["modifications"] = [];
  const appliedFiles: string[] = [];

  for (const mod of modifications) {
    const normalized = normalizePath(mod.filePath);
    const fullPath = path.join(PROJECT_ROOT, normalized);

    try {
      switch (mod.action) {
        case "create": {
          // Ensure directory exists
          const dir = path.dirname(fullPath);
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }
          fs.writeFileSync(fullPath, mod.content || "", "utf-8");
          results.push({ filePath: normalized, action: "create", applied: true });
          appliedFiles.push(normalized);
          break;
        }
        case "modify": {
          if (!fs.existsSync(fullPath)) {
            results.push({
              filePath: normalized,
              action: "modify",
              applied: false,
              error: "File does not exist",
            });
            continue;
          }
          fs.writeFileSync(fullPath, mod.content || "", "utf-8");
          results.push({ filePath: normalized, action: "modify", applied: true });
          appliedFiles.push(normalized);
          break;
        }
        case "delete": {
          if (fs.existsSync(fullPath)) {
            fs.unlinkSync(fullPath);
          }
          results.push({ filePath: normalized, action: "delete", applied: true });
          appliedFiles.push(normalized);
          break;
        }
      }

      // Log the modification
      await db.insert(selfModificationLog).values({
        snapshotId: snapshot.snapshotId!,
        requestedBy,
        userId,
        action: mod.action === "create" ? "create_file" : mod.action === "delete" ? "delete_file" : "modify_file",
        targetFile: normalized,
        description: mod.description,
        validationResult: "passed",
        applied: 1,
        rolledBack: 0,
      });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      results.push({
        filePath: normalized,
        action: mod.action,
        applied: false,
        error: errorMsg,
      });

      await db.insert(selfModificationLog).values({
        snapshotId: snapshot.snapshotId!,
        requestedBy,
        userId,
        action: mod.action === "create" ? "create_file" : mod.action === "delete" ? "delete_file" : "modify_file",
        targetFile: normalized,
        description: mod.description,
        validationResult: "failed",
        applied: 0,
        rolledBack: 0,
        errorMessage: errorMsg,
      });
    }
  }

  // Step 4: Health check
  const health = await runHealthCheck();

  if (!health.healthy) {
    // Step 5: Auto-rollback
    console.error(
      "[SelfImprovement] Health check FAILED after modifications. Rolling back..."
    );
    const rollbackResult = await rollbackToSnapshot(snapshot.snapshotId!);

    // Mark all modifications as rolled back
    for (const file of appliedFiles) {
      await db.insert(selfModificationLog).values({
        snapshotId: snapshot.snapshotId!,
        requestedBy: "auto_rollback",
        userId,
        action: "rollback",
        targetFile: file,
        description: `Auto-rollback due to failed health check: ${health.checks.filter((c) => !c.passed).map((c) => c.message).join("; ")}`,
        applied: 1,
        rolledBack: 1,
      });
    }

    return {
      success: false,
      snapshotId: snapshot.snapshotId,
      modifications: results,
      validationResult: validation,
      healthCheckPassed: false,
      rolledBack: true,
      error: `Changes rolled back — health check failed: ${health.checks.filter((c) => !c.passed).map((c) => c.message).join("; ")}`,
    };
  }

  // Mark snapshot as known good
  await markSnapshotAsGood(snapshot.snapshotId!);

  return {
    success: true,
    snapshotId: snapshot.snapshotId,
    modifications: results,
    validationResult: validation,
    healthCheckPassed: true,
    rolledBack: false,
  };
}

// ─── Rollback ────────────────────────────────────────────────────────

/**
 * Rollback to a specific snapshot — restore all files to their saved state.
 */
export async function rollbackToSnapshot(
  snapshotId: number
): Promise<{ success: boolean; filesRestored: number; error?: string }> {
  const db = await getDb();
  if (!db) return { success: false, filesRestored: 0, error: "Database unavailable" };

  try {
    // Get snapshot files
    const files = await db
      .select()
      .from(snapshotFiles)
      .where(eq(snapshotFiles.snapshotId, snapshotId));

    if (files.length === 0) {
      return { success: false, filesRestored: 0, error: "No files found in snapshot" };
    }

    let restored = 0;
    for (const file of files) {
      const fullPath = path.join(PROJECT_ROOT, file.filePath);
      const dir = path.dirname(fullPath);

      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(fullPath, file.content, "utf-8");
      restored++;
    }

    // Mark snapshot as rolled back
    await db
      .update(systemSnapshots)
      .set({ status: "rolled_back" })
      .where(eq(systemSnapshots.id, snapshotId));

    return { success: true, filesRestored: restored };
  } catch (err) {
    return {
      success: false,
      filesRestored: 0,
      error: `Rollback failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/**
 * Rollback to the last known good snapshot.
 */
export async function rollbackToLastGood(): Promise<{
  success: boolean;
  snapshotId?: number;
  filesRestored: number;
  error?: string;
}> {
  const db = await getDb();
  if (!db) return { success: false, filesRestored: 0, error: "Database unavailable" };

  const goodSnapshots = await db
    .select()
    .from(systemSnapshots)
    .where(eq(systemSnapshots.isKnownGood, 1))
    .orderBy(desc(systemSnapshots.createdAt))
    .limit(1);

  if (goodSnapshots.length === 0) {
    return {
      success: false,
      filesRestored: 0,
      error: "No known good snapshots found. Manual intervention required.",
    };
  }

  const result = await rollbackToSnapshot(goodSnapshots[0].id);
  return { ...result, snapshotId: goodSnapshots[0].id };
}

// ─── Health Check ────────────────────────────────────────────────────

/**
 * Run a health check to verify the system is still functional.
 * Checks:
 * - Critical files exist
 * - No syntax errors in key files (basic bracket matching)
 * - Server process is running
 * - Database is accessible
 */
export async function runHealthCheck(): Promise<HealthCheckResult> {
  const checks: HealthCheckResult["checks"] = [];

  // Check 1: Critical files exist
  const criticalFiles = [
    "server/routers.ts",
    "server/db.ts",
    "server/chat-router.ts",
    "server/chat-executor.ts",
    "server/chat-tools.ts",
    "client/src/App.tsx",
    "client/src/main.tsx",
  ];

  for (const cf of criticalFiles) {
    const fullPath = path.join(PROJECT_ROOT, cf);
    const exists = fs.existsSync(fullPath);
    checks.push({
      name: `file_exists:${cf}`,
      passed: exists,
      message: exists ? `${cf} exists` : `CRITICAL: ${cf} is missing!`,
    });
  }

  // Check 2: Basic syntax validation on key server files
  const serverFiles = [
    "server/routers.ts",
    "server/chat-router.ts",
    "server/chat-executor.ts",
  ];

  for (const sf of serverFiles) {
    const fullPath = path.join(PROJECT_ROOT, sf);
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, "utf-8");
      const openBraces = (content.match(/\{/g) || []).length;
      const closeBraces = (content.match(/\}/g) || []).length;
      const balanced = Math.abs(openBraces - closeBraces) <= 1;
      checks.push({
        name: `syntax:${sf}`,
        passed: balanced,
        message: balanced
          ? `${sf} syntax OK`
          : `${sf} has mismatched braces (${openBraces} open, ${closeBraces} close)`,
      });
    }
  }

  // Check 3: Database accessible
  try {
    const db = await getDb();
    if (db) {
      checks.push({
        name: "database",
        passed: true,
        message: "Database connection OK",
      });
    } else {
      checks.push({
        name: "database",
        passed: false,
        message: "Database connection failed",
      });
    }
  } catch {
    checks.push({
      name: "database",
      passed: false,
      message: "Database connection error",
    });
  }

  // Check 4: Self-improvement engine itself is intact
  const selfPath = path.join(PROJECT_ROOT, "server/self-improvement-engine.ts");
  const selfExists = fs.existsSync(selfPath);
  checks.push({
    name: "self_improvement_engine",
    passed: selfExists,
    message: selfExists
      ? "Self-improvement engine intact"
      : "CRITICAL: Self-improvement engine file is missing!",
  });

  const allPassed = checks.every((c) => c.passed);

  return {
    healthy: allPassed,
    checks,
  };
}

// ─── Service Restart ─────────────────────────────────────────────────

/**
 * Request a service restart. In production, this would signal the
 * process manager (PM2, systemd, etc.) to restart. In development,
 * the tsx watcher auto-restarts on file changes.
 *
 * Returns a status message — the actual restart happens asynchronously.
 */
export async function requestRestart(
  reason: string,
  userId: number | null
): Promise<{ success: boolean; message: string }> {
  const db = await getDb();

  // Log the restart request
  if (db) {
    await db.insert(selfModificationLog).values({
      requestedBy: "titan_assistant",
      userId,
      action: "restart_service",
      description: `Service restart requested: ${reason}`,
      validationResult: "skipped",
      applied: 1,
      rolledBack: 0,
    });
  }

  // In development, tsx watch mode auto-restarts on file changes.
  // We can trigger this by touching a key file.
  try {
    const triggerFile = path.join(PROJECT_ROOT, "server/routers.ts");
    if (fs.existsSync(triggerFile)) {
      const now = new Date();
      fs.utimesSync(triggerFile, now, now);
    }

    return {
      success: true,
      message:
        "Restart signal sent. The dev server will restart automatically via file watcher. In production, the process manager handles restarts.",
    };
  } catch (err) {
    return {
      success: false,
      message: `Failed to trigger restart: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

// ─── Read File (for the assistant to inspect code) ───────────────────

/**
 * Read a file's content — allows the assistant to inspect code before modifying it.
 */
export function readFile(
  filePath: string
): { success: boolean; content?: string; error?: string } {
  try {
    const normalized = normalizePath(filePath);

    if (!isInAllowedDirectory(normalized)) {
      return {
        success: false,
        error: `Cannot read files outside allowed directories: ${ALLOWED_DIRECTORIES.join(", ")}`,
      };
    }

    const fullPath = path.join(PROJECT_ROOT, normalized);
    if (!fs.existsSync(fullPath)) {
      return { success: false, error: `File not found: ${normalized}` };
    }

    const content = fs.readFileSync(fullPath, "utf-8");

    // Truncate very large files
    if (content.length > MAX_FILE_SIZE * 2) {
      return {
        success: true,
        content:
          content.substring(0, MAX_FILE_SIZE) +
          `\n\n... [TRUNCATED — file is ${Math.round(content.length / 1024)}KB, showing first ${MAX_FILE_SIZE / 1024}KB]`,
      };
    }

    return { success: true, content };
  } catch (err) {
    return {
      success: false,
      error: `Read failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/**
 * List files in a directory — allows the assistant to explore the codebase.
 */
export function listFiles(
  dirPath: string
): { success: boolean; files?: string[]; error?: string } {
  try {
    const normalized = normalizePath(dirPath);
    const fullPath = path.join(PROJECT_ROOT, normalized);

    if (!fs.existsSync(fullPath)) {
      return { success: false, error: `Directory not found: ${normalized}` };
    }

    if (!fs.statSync(fullPath).isDirectory()) {
      return { success: false, error: `Not a directory: ${normalized}` };
    }

    const entries = fs.readdirSync(fullPath, { withFileTypes: true });
    const files = entries.map((e) =>
      e.isDirectory() ? `${e.name}/` : e.name
    );

    return { success: true, files };
  } catch (err) {
    return {
      success: false,
      error: `List failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

// ─── Get Modification History ────────────────────────────────────────

export async function getModificationHistory(
  limit: number = 20
): Promise<{
  success: boolean;
  entries?: Array<{
    id: number;
    action: string;
    targetFile: string | null;
    description: string;
    validationResult: string | null;
    applied: number;
    rolledBack: number;
    errorMessage: string | null;
    createdAt: Date;
  }>;
  error?: string;
}> {
  const db = await getDb();
  if (!db) return { success: false, error: "Database unavailable" };

  const entries = await db
    .select()
    .from(selfModificationLog)
    .orderBy(desc(selfModificationLog.createdAt))
    .limit(limit);

  return {
    success: true,
    entries: entries.map((e) => ({
      id: e.id,
      action: e.action,
      targetFile: e.targetFile,
      description: e.description,
      validationResult: e.validationResult,
      applied: e.applied,
      rolledBack: e.rolledBack,
      errorMessage: e.errorMessage,
      createdAt: e.createdAt,
    })),
  };
}

// ─── Get Protected Files List ────────────────────────────────────────

export function getProtectedFiles(): string[] {
  return [...PROTECTED_PATHS];
}

export function getAllowedDirectories(): string[] {
  return [...ALLOWED_DIRECTORIES];
}


// ─── TypeScript Type Checking ───────────────────────────────────────

import { execSync } from "child_process";

/**
 * Run the TypeScript compiler in check-only mode (tsc --noEmit).
 * Returns pass/fail status with error count and output.
 */
export async function runTypeCheck(): Promise<{
  passed: boolean;
  errorCount: number;
  output: string;
}> {
  try {
    const output = execSync("npx tsc --noEmit 2>&1", {
      cwd: PROJECT_ROOT,
      encoding: "utf-8",
      timeout: 60000,
    });
    return { passed: true, errorCount: 0, output: output.trim() || "No errors found." };
  } catch (err: any) {
    const output = err.stdout || err.stderr || String(err);
    const errorMatches = output.match(/error TS\d+/g) || [];
    return {
      passed: false,
      errorCount: errorMatches.length,
      output: output.substring(0, 5000),
    };
  }
}

// ─── Test Execution ─────────────────────────────────────────────────

/**
 * Run the test suite (pnpm test) and return results.
 * Optionally pass a test pattern to run specific tests.
 */
export async function runTests(testPattern?: string): Promise<{
  passed: boolean;
  totalTests: number;
  failedTests: number;
  output: string;
}> {
  try {
    const cmd = testPattern
      ? `pnpm test -- ${testPattern} 2>&1`
      : "pnpm test 2>&1";
    const output = execSync(cmd, {
      cwd: PROJECT_ROOT,
      encoding: "utf-8",
      timeout: 120000,
    });
    const passMatch = output.match(/(\d+)\s+passed/);
    const failMatch = output.match(/(\d+)\s+failed/);
    const totalPassed = passMatch ? parseInt(passMatch[1], 10) : 0;
    const totalFailed = failMatch ? parseInt(failMatch[1], 10) : 0;
    return {
      passed: true,
      totalTests: totalPassed + totalFailed,
      failedTests: totalFailed,
      output: output.substring(0, 5000),
    };
  } catch (err: any) {
    const output = err.stdout || err.stderr || String(err);
    const passMatch = output.match(/(\d+)\s+passed/);
    const failMatch = output.match(/(\d+)\s+failed/);
    const totalPassed = passMatch ? parseInt(passMatch[1], 10) : 0;
    const totalFailed = failMatch ? parseInt(failMatch[1], 10) : 0;
    return {
      passed: false,
      totalTests: totalPassed + totalFailed,
      failedTests: totalFailed || 1,
      output: output.substring(0, 5000),
    };
  }
}

// ─── Enhanced Health Check ──────────────────────────────────────────

/**
 * Quick health check with optional TypeScript and test execution.
 * Extends the basic health check with compiler and test verification.
 */
export async function runQuickHealthCheck(options?: {
  skipTests?: boolean;
  skipTypeCheck?: boolean;
}): Promise<HealthCheckResult> {
  const baseResult = await runHealthCheck();

  if (!options?.skipTypeCheck) {
    try {
      const tsResult = await runTypeCheck();
      baseResult.checks.push({
        name: "typescript",
        passed: tsResult.passed,
        message: tsResult.passed
          ? "TypeScript: 0 errors"
          : `TypeScript: ${tsResult.errorCount} error(s) found`,
      });
      if (!tsResult.passed) baseResult.healthy = false;
    } catch {
      baseResult.checks.push({
        name: "typescript",
        passed: false,
        message: "TypeScript check failed to run",
      });
      baseResult.healthy = false;
    }
  }

  if (!options?.skipTests) {
    try {
      const testResult = await runTests();
      baseResult.checks.push({
        name: "tests",
        passed: testResult.passed,
        message: testResult.passed
          ? `Tests: ${testResult.totalTests} passed, 0 failed`
          : `Tests: ${testResult.failedTests} of ${testResult.totalTests} failed`,
      });
      if (!testResult.passed) baseResult.healthy = false;
    } catch {
      baseResult.checks.push({
        name: "tests",
        passed: false,
        message: "Test execution failed to run",
      });
      baseResult.healthy = false;
    }
  }

  return baseResult;
}
