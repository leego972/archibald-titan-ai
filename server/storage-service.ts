/**
 * Titan Storage Service
 * Core business logic for per-user cloud storage.
 * Integrates with the existing storage.ts S3 utilities.
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
import crypto from "crypto";
import { createLogger } from "./_core/logger.js";

const log = createLogger("StorageService");

// ─── Plan Definitions ────────────────────────────────────────────────────

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

// ─── Subscription Helpers ────────────────────────────────────────────────

export async function getStorageSubscription(userId: number): Promise<StorageSubscription | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(storageSubscriptions)
    .where(eq(storageSubscriptions.userId, userId))
    .limit(1);
  return rows[0] ?? null;
}

export async function hasActiveStorageSubscription(userId: number): Promise<boolean> {
  const sub = await getStorageSubscription(userId);
  return sub?.status === "active" || sub?.status === "trialing";
}

export async function getStorageQuota(userId: number): Promise<{ used: number; quota: number; available: number }> {
  const sub = await getStorageSubscription(userId);
  if (!sub) return { used: 0, quota: 0, available: 0 };
  return {
    used: sub.usedBytes,
    quota: sub.quotaBytes,
    available: Math.max(0, sub.quotaBytes - sub.usedBytes),
  };
}

// ─── File Operations ─────────────────────────────────────────────────────

export interface UploadOptions {
  feature?: keyof typeof STORAGE_PLANS extends never ? string : "vault" | "builder" | "fetcher" | "scanner" | "webhook" | "export" | "generic";
  featureResourceId?: string;
  tags?: string[];
  originalName?: string;
}

export async function uploadFile(
  userId: number,
  data: Buffer | Uint8Array | string,
  filename: string,
  mimeType: string,
  options: UploadOptions = {}
): Promise<StorageFile> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");

  // Check subscription
  const sub = await getStorageSubscription(userId);
  if (!sub || sub.status !== "active") {
    throw new Error("No active storage subscription. Please purchase a Titan Storage plan.");
  }

  const sizeBytes = typeof data === "string"
    ? Buffer.byteLength(data, "utf8")
    : (data as Buffer).length;

  // Check quota
  if (sub.usedBytes + sizeBytes > sub.quotaBytes) {
    const available = sub.quotaBytes - sub.usedBytes;
    throw new Error(
      `Storage quota exceeded. Available: ${formatBytes(available)}, Required: ${formatBytes(sizeBytes)}`
    );
  }

  // Build S3 key: users/{userId}/{feature}/{timestamp}-{filename}
  const feature = options.feature || "generic";
  const timestamp = Date.now();
  const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const s3Key = `users/${userId}/${feature}/${timestamp}-${safeFilename}`;

  // Upload to S3
  const { url } = await storagePut(s3Key, data, mimeType, filename);
  log.info(`[StorageService] Uploaded ${s3Key} (${formatBytes(sizeBytes)}) for user ${userId}`);

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

  // Update used bytes
  await db
    .update(storageSubscriptions)
    .set({ usedBytes: sql`usedBytes + ${sizeBytes}` })
    .where(eq(storageSubscriptions.userId, userId));

  // Fetch and return the created record
  const [file] = await db
    .select()
    .from(storageFiles)
    .where(eq(storageFiles.id, (result as any).insertId))
    .limit(1);

  return file;
}

export async function getDownloadUrl(userId: number, fileId: number, expiresIn = 3600): Promise<{ url: string; file: StorageFile }> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");

  const [file] = await db
    .select()
    .from(storageFiles)
    .where(and(eq(storageFiles.id, fileId), eq(storageFiles.userId, userId), eq(storageFiles.isDeleted, false)))
    .limit(1);

  if (!file) throw new Error("File not found");

  const { url } = await storageGet(file.s3Key);
  return { url, file };
}

export async function listFiles(
  userId: number,
  options: { feature?: string; limit?: number; offset?: number } = {}
): Promise<StorageFile[]> {
  const db = await getDb();
  if (!db) return [];

  let query = db
    .select()
    .from(storageFiles)
    .where(and(eq(storageFiles.userId, userId), eq(storageFiles.isDeleted, false)))
    .orderBy(desc(storageFiles.createdAt))
    .limit(options.limit ?? 100)
    .offset(options.offset ?? 0);

  if (options.feature) {
    query = db
      .select()
      .from(storageFiles)
      .where(and(
        eq(storageFiles.userId, userId),
        eq(storageFiles.isDeleted, false),
        eq(storageFiles.feature, options.feature as any)
      ))
      .orderBy(desc(storageFiles.createdAt))
      .limit(options.limit ?? 100)
      .offset(options.offset ?? 0);
  }

  return query;
}

export async function deleteFile(userId: number, fileId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");

  const [file] = await db
    .select()
    .from(storageFiles)
    .where(and(eq(storageFiles.id, fileId), eq(storageFiles.userId, userId)))
    .limit(1);

  if (!file) throw new Error("File not found");
  if (file.isDeleted) return;

  // Soft delete
  await db
    .update(storageFiles)
    .set({ isDeleted: true, deletedAt: new Date() })
    .where(eq(storageFiles.id, fileId));

  // Free up quota
  await db
    .update(storageSubscriptions)
    .set({ usedBytes: sql`GREATEST(0, usedBytes - ${file.sizeBytes})` })
    .where(eq(storageSubscriptions.userId, userId));

  // Try to delete from S3 (best-effort)
  try {
    await storageDelete(file.s3Key);
  } catch (err) {
    log.warn(`[StorageService] Could not delete S3 object ${file.s3Key}: ${err}`);
  }
}

// ─── Share Links ─────────────────────────────────────────────────────────

export async function createShareLink(
  userId: number,
  fileId: number,
  options: { expiresHours?: number; maxDownloads?: number; password?: string } = {}
) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");

  // Verify file ownership
  const [file] = await db
    .select()
    .from(storageFiles)
    .where(and(eq(storageFiles.id, fileId), eq(storageFiles.userId, userId), eq(storageFiles.isDeleted, false)))
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
    userId,
    fileId,
    token,
    expiresAt,
    maxDownloads: options.maxDownloads ?? 0,
    passwordHash,
  });

  const shareUrl = `${process.env.APP_URL || "https://archibaldtitan.com"}/storage/share/${token}`;
  return { token, url: shareUrl, expires_at: expiresAt };
}

// ─── API Keys ────────────────────────────────────────────────────────────

export async function createApiKey(
  userId: number,
  name: string,
  scopes: string[]
) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");

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

// ─── Utility ─────────────────────────────────────────────────────────────

export function formatBytes(bytes: number): string {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
