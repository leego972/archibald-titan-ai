CREATE TABLE `crypto_payments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`campaignId` int NOT NULL,
	`contributionId` int,
	`merchantTradeNo` varchar(64) NOT NULL,
	`binancePrepayId` varchar(128),
	`status` varchar(32) NOT NULL DEFAULT 'pending',
	`fiatAmount` varchar(32) NOT NULL,
	`fiatCurrency` varchar(8) NOT NULL DEFAULT 'USD',
	`cryptoCurrency` varchar(16),
	`cryptoAmount` varchar(64),
	`platformFee` varchar(32) NOT NULL DEFAULT '0',
	`creatorAmount` varchar(32) NOT NULL DEFAULT '0',
	`checkoutUrl` text,
	`qrcodeLink` text,
	`donorName` varchar(128),
	`donorEmail` varchar(256),
	`donorMessage` text,
	`webhookData` text,
	`paidAt` timestamp,
	`expiresAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `crypto_payments_id` PRIMARY KEY(`id`),
	CONSTRAINT `crypto_payments_merchantTradeNo_unique` UNIQUE(`merchantTradeNo`)
);
--> statement-breakpoint
CREATE TABLE `marketplace_listings` (
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
	`fileHash` varchar(128),
	`originalListingId` int,
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
);
--> statement-breakpoint
CREATE TABLE `marketplace_purchases` (
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
);
--> statement-breakpoint
CREATE TABLE `marketplace_reviews` (
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
);
--> statement-breakpoint
CREATE TABLE `platform_revenue` (
	`id` int AUTO_INCREMENT NOT NULL,
	`source` varchar(64) NOT NULL,
	`sourceId` varchar(128),
	`type` varchar(64) NOT NULL,
	`amount` varchar(32) NOT NULL,
	`currency` varchar(8) NOT NULL DEFAULT 'USD',
	`description` text,
	`metadata` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `platform_revenue_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `seller_payout_methods` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sellerId` int NOT NULL,
	`userId` int NOT NULL,
	`methodType` enum('bank_transfer','paypal','stripe_connect') NOT NULL,
	`isDefault` boolean NOT NULL DEFAULT false,
	`bankBsb` varchar(16),
	`bankAccountNumber` varchar(32),
	`bankAccountName` varchar(128),
	`bankName` varchar(128),
	`bankCountry` varchar(64),
	`bankSwiftBic` varchar(16),
	`paypalEmail` varchar(320),
	`stripeConnectAccountId` varchar(128),
	`stripeConnectOnboarded` boolean NOT NULL DEFAULT false,
	`verified` boolean NOT NULL DEFAULT false,
	`status` enum('active','pending_verification','disabled') NOT NULL DEFAULT 'pending_verification',
	`label` varchar(128),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `seller_payout_methods_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `seller_profiles` (
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
	`sellerSubscriptionActive` boolean NOT NULL DEFAULT false,
	`sellerSubscriptionExpiresAt` timestamp,
	`sellerSubscriptionPaidAt` timestamp,
	`sellerSubscriptionStripeId` varchar(128),
	`totalPlatformFeesPaid` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `seller_profiles_id` PRIMARY KEY(`id`),
	CONSTRAINT `seller_profiles_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `user_secrets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`secretType` varchar(64) NOT NULL,
	`encryptedValue` text NOT NULL,
	`label` varchar(128),
	`lastUsedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `user_secrets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `credit_transactions` MODIFY COLUMN `type` enum('signup_bonus','monthly_refill','pack_purchase','admin_adjustment','chat_message','builder_action','voice_action','referral_bonus','marketplace_purchase','marketplace_sale','marketplace_refund','marketplace_seller_fee','marketplace_seller_renewal','marketplace_feature','marketplace_boost','marketplace_verification') NOT NULL;--> statement-breakpoint
ALTER TABLE `subscriptions` MODIFY COLUMN `plan` enum('free','pro','enterprise','cyber','cyber_plus','titan') NOT NULL DEFAULT 'free';--> statement-breakpoint
ALTER TABLE `crowdfundingCampaigns` ADD `source` enum('internal','kickstarter','indiegogo','gofundme','other') DEFAULT 'internal' NOT NULL;--> statement-breakpoint
ALTER TABLE `crowdfundingCampaigns` ADD `externalId` varchar(255);--> statement-breakpoint
ALTER TABLE `crowdfundingCampaigns` ADD `externalUrl` varchar(500);--> statement-breakpoint
ALTER TABLE `crowdfundingCampaigns` ADD `creatorName` varchar(255);--> statement-breakpoint
ALTER TABLE `crowdfundingCampaigns` ADD `creatorAvatarUrl` varchar(500);--> statement-breakpoint
ALTER TABLE `crowdfundingCampaigns` ADD `location` varchar(255);--> statement-breakpoint
ALTER TABLE `crowdfundingCampaigns` ADD `percentFunded` int DEFAULT 0;--> statement-breakpoint
ALTER TABLE `crowdfundingCampaigns` ADD `daysLeft` int;--> statement-breakpoint
ALTER TABLE `crowdfundingCampaigns` ADD `subcategory` varchar(100);--> statement-breakpoint
ALTER TABLE `crowdfundingCampaigns` ADD `tags` json;--> statement-breakpoint
ALTER TABLE `users` ADD `marketingConsent` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `loginCount` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `trialStartedAt` timestamp;--> statement-breakpoint
ALTER TABLE `users` ADD `trialEndsAt` timestamp;--> statement-breakpoint
ALTER TABLE `users` ADD `hasPaymentMethod` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `stripeCustomerId` varchar(128);--> statement-breakpoint
ALTER TABLE `users` ADD `trialConvertedAt` timestamp;