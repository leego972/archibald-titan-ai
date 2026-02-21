CREATE TABLE `subscriptions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`stripeCustomerId` varchar(128) NOT NULL,
	`stripeSubscriptionId` varchar(128),
	`plan` enum('free','pro','enterprise') NOT NULL DEFAULT 'free',
	`status` enum('active','canceled','past_due','incomplete','trialing') NOT NULL DEFAULT 'active',
	`currentPeriodEnd` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `subscriptions_id` PRIMARY KEY(`id`)
);
