CREATE TABLE `leak_findings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`scanId` int NOT NULL,
	`userId` int NOT NULL,
	`source` enum('github','gitlab','pastebin','stackoverflow','npm','docker_hub','other') NOT NULL,
	`sourceUrl` text,
	`matchedPattern` varchar(256) NOT NULL,
	`credentialType` varchar(64) NOT NULL,
	`severity` enum('critical','high','medium','low') NOT NULL DEFAULT 'high',
	`snippet` text,
	`repoOrFile` varchar(512),
	`author` varchar(256),
	`detectedAt` timestamp NOT NULL DEFAULT (now()),
	`status` enum('new','reviewing','confirmed','false_positive','resolved') NOT NULL DEFAULT 'new',
	`resolvedAt` timestamp,
	`resolvedNote` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `leak_findings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `leak_scans` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`status` enum('queued','scanning','completed','failed') NOT NULL DEFAULT 'queued',
	`sourcesScanned` int NOT NULL DEFAULT 0,
	`leaksFound` int NOT NULL DEFAULT 0,
	`scanType` enum('full','quick','targeted') NOT NULL DEFAULT 'full',
	`targetPatterns` json,
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `leak_scans_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `provider_onboarding` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`providerUrl` text NOT NULL,
	`detectedName` varchar(256),
	`detectedLoginUrl` text,
	`detectedKeysUrl` text,
	`detectedKeyTypes` json,
	`generatedScript` text,
	`status` enum('analyzing','ready','testing','verified','failed') NOT NULL DEFAULT 'analyzing',
	`confidence` int NOT NULL DEFAULT 0,
	`errorMessage` text,
	`testResult` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `provider_onboarding_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `vault_access_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`vaultItemId` int NOT NULL,
	`userId` int NOT NULL,
	`userName` varchar(256),
	`action` enum('view','copy','reveal','update','delete','share') NOT NULL,
	`ipAddress` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `vault_access_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `vault_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`teamOwnerId` int NOT NULL,
	`createdByUserId` int NOT NULL,
	`name` varchar(256) NOT NULL,
	`providerId` varchar(64),
	`credentialType` varchar(64) NOT NULL,
	`encryptedValue` text NOT NULL,
	`accessLevel` enum('owner','admin','member','viewer') NOT NULL DEFAULT 'member',
	`expiresAt` timestamp,
	`lastAccessedAt` timestamp,
	`accessCount` int NOT NULL DEFAULT 0,
	`tags` json,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `vault_items_id` PRIMARY KEY(`id`)
);
