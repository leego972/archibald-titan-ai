-- Migration: Add rateLimit to apiKeys, and create marketplaceWishlists, marketplaceDisputes, marketplaceVersionHistory tables

-- Add rateLimit column to apiKeys (default 60 req/min)
ALTER TABLE `api_keys` ADD COLUMN `rate_limit` int NOT NULL DEFAULT 60;

-- Create marketplace_wishlists table
CREATE TABLE IF NOT EXISTS `marketplace_wishlists` (
  `id` int AUTO_INCREMENT NOT NULL,
  `user_id` varchar(255) NOT NULL,
  `listing_id` int NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `marketplace_wishlists_pk` PRIMARY KEY (`id`)
);

-- Create marketplace_disputes table
CREATE TABLE IF NOT EXISTS `marketplace_disputes` (
  `id` int AUTO_INCREMENT NOT NULL,
  `purchase_id` int NOT NULL,
  `buyer_id` varchar(255) NOT NULL,
  `seller_id` varchar(255) NOT NULL,
  `reason` text NOT NULL,
  `description` text,
  `status` enum('open','under_review','resolved_buyer','resolved_seller','closed') NOT NULL DEFAULT 'open',
  `resolution` text,
  `created_at` timestamp NOT NULL DEFAULT (now()),
  `updated_at` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `marketplace_disputes_pk` PRIMARY KEY (`id`)
);

-- Create marketplace_version_history table
CREATE TABLE IF NOT EXISTS `marketplace_version_history` (
  `id` int AUTO_INCREMENT NOT NULL,
  `listing_id` int NOT NULL,
  `version` int NOT NULL DEFAULT 1,
  `title` varchar(255) NOT NULL,
  `description` text,
  `price` decimal(10,2),
  `changed_by` varchar(255) NOT NULL,
  `change_note` text,
  `created_at` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `marketplace_version_history_pk` PRIMARY KEY (`id`)
);
