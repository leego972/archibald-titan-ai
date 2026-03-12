/**
 * Titan Storage — Drizzle Schema Additions
 * Add these tables to your main schema.ts by importing and re-exporting.
 *
 * These tables support the per-user paid cloud storage add-on system.
 */

import {
  mysqlTable,
  int,
  varchar,
  text,
  timestamp,
  bigint,
  boolean,
  mysqlEnum,
  json,
} from "drizzle-orm/mysql-core";

// ─── Storage Subscriptions ────────────────────────────────────────────────
// One row per user who has purchased a storage plan.
export const storageSubscriptions = mysqlTable("storage_subscriptions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  stripeCustomerId: varchar("stripeCustomerId", { length: 128 }),
  stripeSubscriptionId: varchar("stripeSubscriptionId", { length: 128 }),
  stripePriceId: varchar("stripePriceId", { length: 128 }),
  plan: mysqlEnum("storage_plan", ["10gb", "50gb", "100gb", "500gb", "1tb"]).notNull(),
  status: mysqlEnum("storage_status", [
    "active", "canceled", "past_due", "incomplete", "trialing",
  ]).default("active").notNull(),
  quotaBytes: bigint("quotaBytes", { mode: "number" }).notNull(),
  usedBytes: bigint("usedBytes", { mode: "number" }).default(0).notNull(),
  currentPeriodEnd: timestamp("currentPeriodEnd"),
  cancelAtPeriodEnd: boolean("cancelAtPeriodEnd").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type StorageSubscription = typeof storageSubscriptions.$inferSelect;
export type InsertStorageSubscription = typeof storageSubscriptions.$inferInsert;

// ─── Storage Files ────────────────────────────────────────────────────────
// One row per file uploaded to the storage system.
export const storageFiles = mysqlTable("storage_files", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  s3Key: varchar("s3Key", { length: 512 }).notNull().unique(),
  s3Url: text("s3Url"),
  originalName: varchar("originalName", { length: 512 }).notNull(),
  mimeType: varchar("mimeType", { length: 128 }).notNull(),
  sizeBytes: bigint("sizeBytes", { mode: "number" }).notNull(),
  // Which Titan feature this file belongs to
  feature: mysqlEnum("storage_feature", [
    "vault", "builder", "fetcher", "scanner", "webhook", "export", "generic",
  ]).default("generic").notNull(),
  // Optional: link to a specific resource (e.g., project ID, scan ID)
  featureResourceId: varchar("featureResourceId", { length: 128 }),
  // Optional: user-defined tags
  tags: json("tags").$type<string[]>(),
  isDeleted: boolean("isDeleted").default(false).notNull(),
  deletedAt: timestamp("deletedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type StorageFile = typeof storageFiles.$inferSelect;
export type InsertStorageFile = typeof storageFiles.$inferInsert;

// ─── Storage Share Links ──────────────────────────────────────────────────
// Shareable download links for storage files.
export const storageShareLinks = mysqlTable("storage_share_links", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  fileId: int("fileId").notNull(),
  token: varchar("token", { length: 64 }).notNull().unique(),
  expiresAt: timestamp("expiresAt"),
  maxDownloads: int("maxDownloads").default(0).notNull(), // 0 = unlimited
  downloadCount: int("downloadCount").default(0).notNull(),
  passwordHash: varchar("passwordHash", { length: 64 }), // SHA-256 of password
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type StorageShareLink = typeof storageShareLinks.$inferSelect;
export type InsertStorageShareLink = typeof storageShareLinks.$inferInsert;

// ─── Storage API Keys ─────────────────────────────────────────────────────
// Per-user API keys for programmatic access to the storage system.
export const storageApiKeys = mysqlTable("storage_api_keys", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 128 }).notNull(),
  keyHash: varchar("keyHash", { length: 64 }).notNull().unique(), // SHA-256 of the key
  keyPrefix: varchar("keyPrefix", { length: 12 }).notNull(), // First 12 chars for display
  scopes: json("scopes").$type<string[]>().notNull(),
  lastUsedAt: timestamp("lastUsedAt"),
  expiresAt: timestamp("expiresAt"),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type StorageApiKey = typeof storageApiKeys.$inferSelect;
export type InsertStorageApiKey = typeof storageApiKeys.$inferInsert;
