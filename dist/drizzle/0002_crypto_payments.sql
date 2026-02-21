-- Crypto payments for crowdfunding donations via Binance Pay
CREATE TABLE IF NOT EXISTS `crypto_payments` (
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
);--> statement-breakpoint

-- Platform revenue tracking for all monetization sources
CREATE TABLE IF NOT EXISTS `platform_revenue` (
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
);--> statement-breakpoint

-- Indexes
CREATE INDEX `idx_crypto_payments_campaignId` ON `crypto_payments` (`campaignId`);--> statement-breakpoint
CREATE INDEX `idx_crypto_payments_status` ON `crypto_payments` (`status`);--> statement-breakpoint
CREATE INDEX `idx_crypto_payments_merchantTradeNo` ON `crypto_payments` (`merchantTradeNo`);--> statement-breakpoint
CREATE INDEX `idx_platform_revenue_source` ON `platform_revenue` (`source`);--> statement-breakpoint
CREATE INDEX `idx_platform_revenue_type` ON `platform_revenue` (`type`);
