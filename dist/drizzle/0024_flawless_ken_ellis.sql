CREATE TABLE `credit_balances` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`credits` int NOT NULL DEFAULT 0,
	`lifetimeCreditsUsed` int NOT NULL DEFAULT 0,
	`lifetimeCreditsAdded` int NOT NULL DEFAULT 0,
	`isUnlimited` boolean NOT NULL DEFAULT false,
	`lastRefillAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `credit_balances_id` PRIMARY KEY(`id`),
	CONSTRAINT `credit_balances_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `credit_transactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`amount` int NOT NULL,
	`type` enum('signup_bonus','monthly_refill','pack_purchase','admin_adjustment','chat_message','builder_action','voice_action','referral_bonus') NOT NULL,
	`description` text,
	`balanceAfter` int NOT NULL,
	`stripePaymentIntentId` varchar(256),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `credit_transactions_id` PRIMARY KEY(`id`)
);
