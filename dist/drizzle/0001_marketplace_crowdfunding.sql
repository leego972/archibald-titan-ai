-- Add new crowdfunding hybrid columns
ALTER TABLE `crowdfundingCampaigns` ADD COLUMN `source` enum('internal','kickstarter','indiegogo','gofundme','other') NOT NULL DEFAULT 'internal';--> statement-breakpoint
ALTER TABLE `crowdfundingCampaigns` ADD COLUMN `externalId` varchar(255);--> statement-breakpoint
ALTER TABLE `crowdfundingCampaigns` ADD COLUMN `externalUrl` varchar(500);--> statement-breakpoint
ALTER TABLE `crowdfundingCampaigns` ADD COLUMN `creatorName` varchar(255);--> statement-breakpoint
ALTER TABLE `crowdfundingCampaigns` ADD COLUMN `location` varchar(255);--> statement-breakpoint
ALTER TABLE `crowdfundingCampaigns` ADD COLUMN `percentFunded` int DEFAULT 0;--> statement-breakpoint
ALTER TABLE `crowdfundingCampaigns` ADD COLUMN `daysLeft` int;--> statement-breakpoint
ALTER TABLE `crowdfundingCampaigns` ADD COLUMN `subcategory` varchar(100);--> statement-breakpoint
ALTER TABLE `crowdfundingCampaigns` ADD COLUMN `tags` json;--> statement-breakpoint
ALTER TABLE `crowdfundingCampaigns` ADD COLUMN `creatorAvatarUrl` varchar(500);--> statement-breakpoint

-- Create marketplace tables
CREATE TABLE IF NOT EXISTS `marketplace_listings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`uid` varchar(64) NOT NULL,
	`sellerId` int NOT NULL,
	`title` varchar(256) NOT NULL,
	`slug` varchar(300) NOT NULL,
	`description` text NOT NULL,
	`longDescription` text,
	`category` enum('agents','modules','blueprints','artifacts','exploits','templates','datasets','other') NOT NULL DEFAULT 'modules',
	`riskCategory` enum('safe','low_risk','medium_risk','high_risk') NOT NULL DEFAULT 'safe',
	`reviewStatus` enum('pending_review','approved','rejected','flagged') NOT NULL DEFAULT 'pending_review',
	`reviewNotes` text,
	`status` enum('draft','active','paused','sold_out','removed') NOT NULL DEFAULT 'draft',
	`priceCredits` int NOT NULL,
	`priceUsd` int NOT NULL DEFAULT 0,
	`currency` varchar(8) NOT NULL DEFAULT 'USD',
	`fileUrl` text,
	`fileSize` int,
	`fileType` varchar(64),
	`previewUrl` text,
	`thumbnailUrl` text,
	`demoUrl` text,
	`tags` text,
	`language` varchar(64),
	`license` varchar(64) DEFAULT 'MIT',
	`version` varchar(32) DEFAULT '1.0.0',
	`totalSales` int NOT NULL DEFAULT 0,
	`totalRevenue` int NOT NULL DEFAULT 0,
	`viewCount` int NOT NULL DEFAULT 0,
	`downloadCount` int NOT NULL DEFAULT 0,
	`avgRating` int NOT NULL DEFAULT 0,
	`ratingCount` int NOT NULL DEFAULT 0,
	`featured` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `marketplace_listings_id` PRIMARY KEY(`id`),
	CONSTRAINT `marketplace_listings_uid_unique` UNIQUE(`uid`),
	CONSTRAINT `marketplace_listings_slug_unique` UNIQUE(`slug`)
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS `marketplace_purchases` (
	`id` int AUTO_INCREMENT NOT NULL,
	`uid` varchar(64) NOT NULL,
	`buyerId` int NOT NULL,
	`listingId` int NOT NULL,
	`sellerId` int NOT NULL,
	`priceCredits` int NOT NULL,
	`priceUsd` int NOT NULL DEFAULT 0,
	`status` enum('completed','refunded','disputed') NOT NULL DEFAULT 'completed',
	`downloadCount` int NOT NULL DEFAULT 0,
	`maxDownloads` int NOT NULL DEFAULT 5,
	`downloadToken` varchar(128),
	`hasReviewed` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `marketplace_purchases_id` PRIMARY KEY(`id`),
	CONSTRAINT `marketplace_purchases_uid_unique` UNIQUE(`uid`)
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS `marketplace_reviews` (
	`id` int AUTO_INCREMENT NOT NULL,
	`listingId` int NOT NULL,
	`purchaseId` int NOT NULL,
	`reviewerId` int NOT NULL,
	`rating` int NOT NULL,
	`title` varchar(256),
	`comment` text,
	`sellerRating` int,
	`helpful` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `marketplace_reviews_id` PRIMARY KEY(`id`)
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS `seller_profiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`displayName` varchar(128) NOT NULL,
	`bio` text,
	`avatarUrl` text,
	`totalSales` int NOT NULL DEFAULT 0,
	`totalRevenue` int NOT NULL DEFAULT 0,
	`avgRating` int NOT NULL DEFAULT 0,
	`ratingCount` int NOT NULL DEFAULT 0,
	`verified` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `seller_profiles_id` PRIMARY KEY(`id`),
	CONSTRAINT `seller_profiles_userId_unique` UNIQUE(`userId`)
);--> statement-breakpoint

-- Indexes for marketplace
CREATE INDEX `idx_marketplace_listings_sellerId` ON `marketplace_listings` (`sellerId`);--> statement-breakpoint
CREATE INDEX `idx_marketplace_listings_category` ON `marketplace_listings` (`category`);--> statement-breakpoint
CREATE INDEX `idx_marketplace_listings_status` ON `marketplace_listings` (`status`);--> statement-breakpoint
CREATE INDEX `idx_marketplace_purchases_buyerId` ON `marketplace_purchases` (`buyerId`);--> statement-breakpoint
CREATE INDEX `idx_marketplace_purchases_listingId` ON `marketplace_purchases` (`listingId`);--> statement-breakpoint
CREATE INDEX `idx_marketplace_reviews_listingId` ON `marketplace_reviews` (`listingId`);
