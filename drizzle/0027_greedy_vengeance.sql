CREATE TABLE `credential_imports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`source` varchar(64) NOT NULL,
	`fileName` varchar(256),
	`totalEntries` int NOT NULL DEFAULT 0,
	`importedCount` int NOT NULL DEFAULT 0,
	`skippedCount` int NOT NULL DEFAULT 0,
	`errorCount` int NOT NULL DEFAULT 0,
	`status` enum('pending','processing','completed','failed') NOT NULL DEFAULT 'pending',
	`errorDetails` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `credential_imports_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `notification_channels` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(128) NOT NULL,
	`type` enum('slack','discord','email') NOT NULL,
	`webhookUrl` text,
	`emailAddress` varchar(320),
	`events` json NOT NULL,
	`active` boolean NOT NULL DEFAULT true,
	`lastNotifiedAt` timestamp,
	`failCount` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `notification_channels_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `totp_secrets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(256) NOT NULL,
	`issuer` varchar(256),
	`encryptedSecret` text NOT NULL,
	`algorithm` varchar(16) DEFAULT 'SHA1',
	`digits` int NOT NULL DEFAULT 6,
	`period` int NOT NULL DEFAULT 30,
	`iconUrl` varchar(512),
	`tags` json,
	`lastUsedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `totp_secrets_id` PRIMARY KEY(`id`)
);
