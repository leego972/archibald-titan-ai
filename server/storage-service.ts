/**
 * Titan Storage Service
 * Core business logic for per-user cloud storage.
 * Integrates with the existing storage.ts S3 utilities.
 *
 * Admin policy:
 *   - Admins (role === 'admin' | 'head_admin') have UNLIMITED storage.
 *   - No subscription is required for admins.
 *   - Quota checks are completely bypassed for admins.
 *   - Admins can access, download, and delete any user's files.
 */

import { eq, and, sql, desc } from "drizzle-orm";
import { getDb } from "./db";
import { storagePut, storageGet, storageDelete } from "./storage";
import {
  storageSubscriptions,
  storageFiles,
  storageShareLinks,
  storageApiKeys,
  type StorageSubscription,
  type StorageFile,
} from "../drizzle/storage-schema";
import { isAdminRole } from "../shared/const";
import crypto from "crypto";
import { createLogger } from "./_core/logger.js";

const log = createLogger("StorageService");

// ─── Admin Sentinel ──────────────────────────────────────────────────────────
// A virtual subscription returned for admin users — unlimited quota, always active.

const ADMIN_UNLIMITED_QUOTA = Number.MAX_SAFE_INTEGER; // ~9 PB effective limit

export function buildAdminSubscription(userId: number): StorageSubscription {
  return {
    id: -1,
    userId,
    plan: "admin_unlimited" as any,
    quotaBytes: ADMIN_UNLIMITED_QUOTA,
    usedBytes: 0,
    status: "active",
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    stripePriceId: null,
    currentPeriodStart: null,
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as unknown as StorageSubscription;
}

// ─── Plan Definitions ────────────────────────────────────────────────────────

export const STORAGE_PLANS = {
  "10gb": {
    label: "10 GB",
    bytes: 10 * 1024 ** 3,
    price_monthly: 4.99,
    features: [
      "10 GB cloud storage",
      "Vault encrypted backups",
      "Builder project files",
      "Scan report archives",
      "Shareable download links",
      "REST API access",
    ],
  },
  "50gb": {
    label: "50 GB",
    bytes: 50 * 1024 ** 3,
    price_monthly: 14.99,
    features: [
      "50 GB cloud storage",
      "All 10 GB features",
      "Credential export archives",
      "Webhook delivery logs",
      "Fetcher history storage",
      "Priority support",
    ],
  },
  "100gb": {
    label: "100 GB",
    bytes: 100 * 1024 ** 3,
    price_monthly: 24.99,
    features: [
      "100 GB cloud storage",
      "All 50 GB features",
      "Bulk file operations",
      "Advanced sharing controls",
      "Password-protected links",
    ],
  },
  "500gb": {
    label: "500 GB",
    bytes: 500 * 1024 ** 3,
    price_monthly: 79.99,
    features: [
      "500 GB cloud storage",
      "All 100 GB features",
      "Team file sharing",
      "Dedicated support",
    ],
  },
  "1tb": {
    label: "1 TB",
    bytes: 1 * 1024 ** 4,
    price_monthly: 149.99,
    features: [
      "1 TB cloud storage",
      "All 500 GB features",
      "Unlimited API keys",
      "SLA guarantee",
      "Custom retention policies",
    ],
  },
} as const;

export type StoragePlanId = keyof typeof STORAGE_PLANS;

// ─── Subscription Helpers ────────────────────────────────────────────────────

/**
 * Returns the user's storage subscription.
 * For admins, returns a virtual unlimited subscription without a DB lookup.
 */
export async function getStorageSubscription(
  userId: number,
  userRole?: string | null
): Promise<StorageSubscription | null> {
  // Admin bypass — unlimited, always active
  if (isAdminRole(userRole)) {
    return buildAdminSubscription(userId);
  }

  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(storageSubscriptions)
    .where(eq(storageSubscriptions.userId, userId))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Returns true if the user has an active storage subscription.
 * Admins always return true.
 */
export async function hasActiveStorageSubscription(
  userId: number,
  userRole?: string | null
): Promise<boolean> {
  if (isAdminRole(userRole)) return true;
  const sub = await getStorageSubscription(userId);
  return sub?.status === "active" || sub?.status === "trialing";
}

export async function getStorageQuota(
  userId: number,
  userRole?: string | null
): Promise<{ used: number; quota: number; available: number }> {
  if (isAdminRole(userRole)) {
    // Admins: show real used bytes but unlimited quota
    const db = await getDb();
    let usedBytes = 0;
    if (db) {
      const [row] = await db
        .select({ total: sql<number>`COALESCE(SUM(sizeBytes), 0)` })
        .from(storageFiles)
        .where(and(eq(storageFiles.userId, userId), eq(storageFiles.isDeleted, false)));
      usedBytes = Number(row?.total ?? 0);
    }
    return { used: usedBytes, quota: ADMIN_UNLIMITED_QUOTA, available: ADMIN_UNLIMITED_QUOTA };
  }

  const sub = await getStorageSubscription(userId);
  if (!sub) return { used: 0, quota: 0, available: 0 };
  return {
    used: sub.usedBytes,
    quota: sub.quotaBytes,
    available: Math.max(0, sub.quotaBytes - sub.usedBytes),
  };
}

// ─── File Operations ──────────────────────────────────────────────────────────

export interface UploadOptions {
  feature?: "vault" | "builder" | "fetcher" | "scanner" | "webhook" | "export" | "generic";
  featureResourceId?: string;
  tags?: string[];
  originalName?: string;
}

/**
 * Upload a file to S3 and record it in the database.
 * Admins bypass all subscription and quota checks.
 */
export async function uploadFile(
  userId: number,
  data: Buffer | Uint8Array | string,
  filename: string,
  mimeType: string,
  options: UploadOptions = {},
  userRole?: string | null
): Promise<StorageFile> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");

  const isAdmin = isAdminRole(userRole);

  if (!isAdmin) {
    // Regular user: require active subscription
    const sub = await getStorageSubscription(userId);
    if (!sub || sub.status !== "active") {
      throw new Error("No active storage subscription. Please purchase a Titan Storage plan.");
    }

    const sizeBytes = typeof data === "string"
      ? Buffer.byteLength(data, "utf8")
      : (data as Buffer).length;

    // Quota check
    if (sub.usedBytes + sizeBytes > sub.quotaBytes) {
      const available = sub.quotaBytes - sub.usedBytes;
      throw new Error(
        `Storage quota exceeded. Available: ${formatBytes(available)}, Required: ${formatBytes(sizeBytes)}`
      );
    }
  }

  const sizeBytes = typeof data === "string"
    ? Buffer.byteLength(data, "utf8")
    : (data as Buffer).length;

  // Build S3 key: users/{userId}/{feature}/{timestamp}-{filename}
  const feature = options.feature || "generic";
  const timestamp = Date.now();
  const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const s3Key = `users/${userId}/${feature}/${timestamp}-${safeFilename}`;

  // Upload to S3
  const { url } = await storagePut(s3Key, data, mimeType, filename);
  log.info(`[StorageService] ${isAdmin ? "[ADMIN]" : ""} Uploaded ${s3Key} (${formatBytes(sizeBytes)}) for user ${userId}`);

  // Insert file record
  const [result] = await db.insert(storageFiles).values({
    userId,
    s3Key,
    s3Url: url,
    originalName: options.originalName || filename,
    mimeType,
    sizeBytes,
    feature: feature as any,
    featureResourceId: options.featureResourceId ?? null,
    tags: options.tags ?? null,
  });

  // Update used bytes for regular users only (admin usage is not quota-tracked)
  if (!isAdmin) {
    await db
      .update(storageSubscriptions)
      .set({ usedBytes: sql`usedBytes + ${sizeBytes}` })
      .where(eq(storageSubscriptions.userId, userId));
  }

  // Fetch and return the created record
  const [file] = await db
    .select()
    .from(storageFiles)
    .where(eq(storageFiles.id, (result as any).insertId))
    .limit(1);

  return file;
}

/**
 * Get a pre-signed download URL for a file.
 * Admins can download any user's file (ownership check bypassed).
 */
export async function getDownloadUrl(
  userId: number,
  fileId: number,
  expiresIn = 3600,
  userRole?: string | null
): Promise<{ url: string; file: StorageFile }> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");

  const isAdmin = isAdminRole(userRole);

  // Admins can access any file; regular users only their own
  const conditions = isAdmin
    ? and(eq(storageFiles.id, fileId), eq(storageFiles.isDeleted, false))
    : and(eq(storageFiles.id, fileId), eq(storageFiles.userId, userId), eq(storageFiles.isDeleted, false));

  const [file] = await db
    .select()
    .from(storageFiles)
    .where(conditions)
    .limit(1);

  if (!file) throw new Error("File not found");

  const { url } = await storageGet(file.s3Key);
  return { url, file };
}

/**
 * List files for a user.
 * Admins can list any user's files, or all files across the platform.
 */
export async function listFiles(
  userId: number,
  options: { feature?: string; limit?: number; offset?: number; allUsers?: boolean } = {},
  userRole?: string | null
): Promise<StorageFile[]> {
  const db = await getDb();
  if (!db) return [];

  const isAdmin = isAdminRole(userRole);

  // If admin requests all users' files (platform-wide view)
  if (isAdmin && options.allUsers) {
    const baseCondition = eq(storageFiles.isDeleted, false);
    const condition = options.feature
      ? and(baseCondition, eq(storageFiles.feature, options.feature as any))
      : baseCondition;
    return db
      .select()
      .from(storageFiles)
      .where(condition)
      .orderBy(desc(storageFiles.createdAt))
      .limit(options.limit ?? 500)
      .offset(options.offset ?? 0);
  }

  // Normal per-user listing
  const userCondition = and(eq(storageFiles.userId, userId), eq(storageFiles.isDeleted, false));
  const condition = options.feature
    ? and(userCondition, eq(storageFiles.feature, options.feature as any))
    : userCondition;

  return db
    .select()
    .from(storageFiles)
    .where(condition)
    .orderBy(desc(storageFiles.createdAt))
    .limit(options.limit ?? 100)
    .offset(options.offset ?? 0);
}

/**
 * Delete a file.
 * Admins can delete any user's file (ownership check bypassed).
 */
export async function deleteFile(
  userId: number,
  fileId: number,
  userRole?: string | null
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");

  const isAdmin = isAdminRole(userRole);

  // Admins can delete any file; regular users only their own
  const conditions = isAdmin
    ? eq(storageFiles.id, fileId)
    : and(eq(storageFiles.id, fileId), eq(storageFiles.userId, userId));

  const [file] = await db
    .select()
    .from(storageFiles)
    .where(conditions)
    .limit(1);

  if (!file) throw new Error("File not found");
  if (file.isDeleted) return;

  // Soft delete
  await db
    .update(storageFiles)
    .set({ isDeleted: true, deletedAt: new Date() })
    .where(eq(storageFiles.id, fileId));

  // Free up quota for the file's owner (not admin)
  if (!isAdmin) {
    await db
      .update(storageSubscriptions)
      .set({ usedBytes: sql`GREATEST(0, usedBytes - ${file.sizeBytes})` })
      .where(eq(storageSubscriptions.userId, file.userId));
  } else {
    // Admin deleted a user's file — still reclaim quota from the owner's subscription
    await db
      .update(storageSubscriptions)
      .set({ usedBytes: sql`GREATEST(0, usedBytes - ${file.sizeBytes})` })
      .where(eq(storageSubscriptions.userId, file.userId));
    log.info(`[StorageService] [ADMIN] Admin ${userId} deleted file ${fileId} (owner: ${file.userId})`);
  }

  // Try to delete from S3 (best-effort)
  try {
    await storageDelete(file.s3Key);
  } catch (err) {
    log.warn(`[StorageService] Could not delete S3 object ${file.s3Key}: ${err}`);
  }
}

// ─── Share Links ──────────────────────────────────────────────────────────────

export async function createShareLink(
  userId: number,
  fileId: number,
  options: { expiresHours?: number; maxDownloads?: number; password?: string } = {},
  userRole?: string | null
) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");

  const isAdmin = isAdminRole(userRole);

  // Admins can share any file; regular users only their own
  const conditions = isAdmin
    ? and(eq(storageFiles.id, fileId), eq(storageFiles.isDeleted, false))
    : and(eq(storageFiles.id, fileId), eq(storageFiles.userId, userId), eq(storageFiles.isDeleted, false));

  const [file] = await db
    .select()
    .from(storageFiles)
    .where(conditions)
    .limit(1);
  if (!file) throw new Error("File not found");

  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = options.expiresHours
    ? new Date(Date.now() + options.expiresHours * 3600 * 1000)
    : null;
  const passwordHash = options.password
    ? crypto.createHash("sha256").update(options.password).digest("hex")
    : null;

  await db.insert(storageShareLinks).values({
    userId: file.userId, // always attribute to the file owner
    fileId,
    token,
    expiresAt,
    maxDownloads: options.maxDownloads ?? 0,
    passwordHash,
  });

  const shareUrl = `${process.env.APP_URL || "https://archibaldtitan.com"}/storage/share/${token}`;
  return { token, url: shareUrl, expires_at: expiresAt };
}

// ─── API Keys ─────────────────────────────────────────────────────────────────

export async function createApiKey(
  userId: number,
  name: string,
  scopes: string[],
  userRole?: string | null
) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");

  // Admins can create API keys without a subscription
  if (!isAdminRole(userRole)) {
    const active = await hasActiveStorageSubscription(userId);
    if (!active) throw new Error("No active storage subscription.");
  }

  const rawKey = `tsk_${crypto.randomBytes(32).toString("hex")}`;
  const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");
  const keyPrefix = rawKey.slice(0, 12);

  await db.insert(storageApiKeys).values({
    userId,
    name,
    keyHash,
    keyPrefix,
    scopes,
  });

  return { key: rawKey, key_prefix: keyPrefix, name, scopes };
}

export async function validateApiKey(rawKey: string): Promise<{ userId: number; scopes: string[] } | null> {
  const db = await getDb();
  if (!db) return null;

  const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");
  const [apiKey] = await db
    .select()
    .from(storageApiKeys)
    .where(and(eq(storageApiKeys.keyHash, keyHash), eq(storageApiKeys.isActive, true)))
    .limit(1);

  if (!apiKey) return null;
  if (apiKey.expiresAt && new Date(apiKey.expiresAt) < new Date()) return null;

  // Update last used
  await db
    .update(storageApiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(storageApiKeys.id, apiKey.id));

  return { userId: apiKey.userId, scopes: (apiKey.scopes as string[]) };
}

// ─── Utility ──────────────────────────────────────────────────────────────────

export function formatBytes(bytes: number): string {
  if (!bytes || bytes === 0) return "0 B";
  if (bytes >= Number.MAX_SAFE_INTEGER - 1) return "Unlimited";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
