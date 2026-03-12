-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: 0042_titan_storage.sql
-- Adds per-user paid cloud storage tables to Archibald Titan.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Storage Subscriptions ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `storage_subscriptions` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `userId` INT NOT NULL UNIQUE,
  `stripeCustomerId` VARCHAR(128),
  `stripeSubscriptionId` VARCHAR(128),
  `stripePriceId` VARCHAR(128),
  `plan` ENUM('10gb','50gb','100gb','500gb','1tb') NOT NULL,
  `status` ENUM('active','canceled','past_due','incomplete','trialing') NOT NULL DEFAULT 'active',
  `quotaBytes` BIGINT NOT NULL,
  `usedBytes` BIGINT NOT NULL DEFAULT 0,
  `currentPeriodEnd` TIMESTAMP NULL,
  `cancelAtPeriodEnd` BOOLEAN NOT NULL DEFAULT FALSE,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_storage_subs_userId` (`userId`),
  INDEX `idx_storage_subs_status` (`status`)
);

-- ── Storage Files ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `storage_files` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `userId` INT NOT NULL,
  `s3Key` VARCHAR(512) NOT NULL UNIQUE,
  `s3Url` TEXT,
  `originalName` VARCHAR(512) NOT NULL,
  `mimeType` VARCHAR(128) NOT NULL,
  `sizeBytes` BIGINT NOT NULL,
  `feature` ENUM('vault','builder','fetcher','scanner','webhook','export','generic') NOT NULL DEFAULT 'generic',
  `featureResourceId` VARCHAR(128),
  `tags` JSON,
  `isDeleted` BOOLEAN NOT NULL DEFAULT FALSE,
  `deletedAt` TIMESTAMP NULL,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_storage_files_userId` (`userId`),
  INDEX `idx_storage_files_feature` (`feature`),
  INDEX `idx_storage_files_deleted` (`isDeleted`),
  INDEX `idx_storage_files_userId_feature` (`userId`, `feature`, `isDeleted`)
);

-- ── Storage Share Links ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `storage_share_links` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `userId` INT NOT NULL,
  `fileId` INT NOT NULL,
  `token` VARCHAR(64) NOT NULL UNIQUE,
  `expiresAt` TIMESTAMP NULL,
  `maxDownloads` INT NOT NULL DEFAULT 0,
  `downloadCount` INT NOT NULL DEFAULT 0,
  `passwordHash` VARCHAR(64),
  `isActive` BOOLEAN NOT NULL DEFAULT TRUE,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_share_links_token` (`token`),
  INDEX `idx_share_links_userId` (`userId`)
);

-- ── Storage API Keys ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `storage_api_keys` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `userId` INT NOT NULL,
  `name` VARCHAR(128) NOT NULL,
  `keyHash` VARCHAR(64) NOT NULL UNIQUE,
  `keyPrefix` VARCHAR(12) NOT NULL,
  `scopes` JSON NOT NULL,
  `lastUsedAt` TIMESTAMP NULL,
  `expiresAt` TIMESTAMP NULL,
  `isActive` BOOLEAN NOT NULL DEFAULT TRUE,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_storage_api_keys_userId` (`userId`),
  INDEX `idx_storage_api_keys_hash` (`keyHash`)
);
