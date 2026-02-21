CREATE TABLE `affiliate_clicks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`partnerId` int NOT NULL,
	`userId` int,
	`clickId` varchar(64) NOT NULL,
	`ipAddress` varchar(45),
	`userAgent` text,
	`referrer` text,
	`utmSource` varchar(128),
	`utmMedium` varchar(128),
	`utmCampaign` varchar(128),
	`converted` boolean NOT NULL DEFAULT false,
	`conversionDate` timestamp,
	`commissionEarned` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `affiliate_clicks_id` PRIMARY KEY(`id`),
	CONSTRAINT `affiliate_clicks_clickId_unique` UNIQUE(`clickId`)
);
--> statement-breakpoint
CREATE TABLE `affiliate_outreach` (
	`id` int AUTO_INCREMENT NOT NULL,
	`partnerId` int NOT NULL,
	`type` enum('email','form','api') NOT NULL DEFAULT 'email',
	`subject` text,
	`body` text,
	`status` enum('drafted','sent','opened','replied','accepted','rejected') NOT NULL DEFAULT 'drafted',
	`sentAt` timestamp,
	`repliedAt` timestamp,
	`aiGenerated` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `affiliate_outreach_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `affiliate_partners` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(256) NOT NULL,
	`domain` varchar(512),
	`contactEmail` varchar(320),
	`vertical` enum('ai_tools','hosting','dev_tools','security','vpn','crypto','saas','education','other') NOT NULL DEFAULT 'other',
	`commissionType` enum('revshare','cpa','hybrid','cpm','cpc') NOT NULL DEFAULT 'cpa',
	`commissionRate` int NOT NULL DEFAULT 20,
	`tier` enum('bronze','silver','gold','platinum') NOT NULL DEFAULT 'bronze',
	`status` enum('prospect','applied','active','paused','rejected','churned') NOT NULL DEFAULT 'prospect',
	`affiliateUrl` text,
	`applicationUrl` text,
	`applicationEmail` varchar(320),
	`applicationSentAt` timestamp,
	`approvedAt` timestamp,
	`totalClicks` int NOT NULL DEFAULT 0,
	`totalConversions` int NOT NULL DEFAULT 0,
	`totalEarnings` int NOT NULL DEFAULT 0,
	`performanceScore` int NOT NULL DEFAULT 0,
	`lastOptimizedAt` timestamp,
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `affiliate_partners_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `affiliate_payouts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`partnerId` int NOT NULL,
	`amountCents` int NOT NULL,
	`currency` varchar(3) NOT NULL DEFAULT 'USD',
	`status` enum('pending','processing','completed','failed') NOT NULL DEFAULT 'pending',
	`paymentMethod` varchar(64),
	`paymentReference` varchar(256),
	`periodStart` timestamp NOT NULL,
	`periodEnd` timestamp NOT NULL,
	`clickCount` int NOT NULL DEFAULT 0,
	`conversionCount` int NOT NULL DEFAULT 0,
	`processedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `affiliate_payouts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `referral_codes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`code` varchar(16) NOT NULL,
	`totalReferrals` int NOT NULL DEFAULT 0,
	`totalRewardsEarned` int NOT NULL DEFAULT 0,
	`totalCommissionCents` int NOT NULL DEFAULT 0,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `referral_codes_id` PRIMARY KEY(`id`),
	CONSTRAINT `referral_codes_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `referral_conversions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`referralCodeId` int NOT NULL,
	`referrerId` int NOT NULL,
	`referredUserId` int NOT NULL,
	`status` enum('signed_up','subscribed','rewarded') NOT NULL DEFAULT 'signed_up',
	`rewardType` enum('free_month','commission','credit','tier_upgrade') DEFAULT 'free_month',
	`rewardAmountCents` int NOT NULL DEFAULT 0,
	`rewardGrantedAt` timestamp,
	`subscriptionId` varchar(256),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `referral_conversions_id` PRIMARY KEY(`id`)
);
