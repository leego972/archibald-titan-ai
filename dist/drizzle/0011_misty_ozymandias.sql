CREATE TABLE `bulk_sync_jobs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`totalProviders` int NOT NULL DEFAULT 0,
	`completedProviders` int NOT NULL DEFAULT 0,
	`failedProviders` int NOT NULL DEFAULT 0,
	`status` enum('queued','running','completed','failed','cancelled') NOT NULL DEFAULT 'queued',
	`triggeredBy` enum('manual','scheduled') NOT NULL DEFAULT 'manual',
	`linkedJobIds` json,
	`startedAt` timestamp,
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `bulk_sync_jobs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `credential_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`credentialId` int NOT NULL,
	`userId` int NOT NULL,
	`providerId` varchar(64) NOT NULL,
	`keyType` varchar(64) NOT NULL,
	`encryptedValue` text NOT NULL,
	`changeType` enum('created','rotated','manual_update','rollback') NOT NULL DEFAULT 'created',
	`snapshotNote` varchar(512),
	`jobId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `credential_history_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `credential_watches` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`credentialId` int NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`alertDaysBefore` int NOT NULL DEFAULT 7,
	`status` enum('active','expiring_soon','expired','dismissed') NOT NULL DEFAULT 'active',
	`lastNotifiedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `credential_watches_id` PRIMARY KEY(`id`)
);
