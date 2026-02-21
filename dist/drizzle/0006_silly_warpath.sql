CREATE TABLE `download_audit_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`userEmail` varchar(320),
	`userName` varchar(256),
	`releaseId` int NOT NULL,
	`releaseVersion` varchar(32) NOT NULL,
	`platform` enum('windows','mac','linux') NOT NULL,
	`tokenId` int,
	`ipAddress` varchar(64),
	`userAgent` text,
	`status` enum('initiated','completed','expired','revoked','rate_limited') NOT NULL DEFAULT 'initiated',
	`downloadedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `download_audit_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `download_tokens` (
	`id` int AUTO_INCREMENT NOT NULL,
	`token` varchar(64) NOT NULL,
	`userId` int NOT NULL,
	`releaseId` int NOT NULL,
	`platform` enum('windows','mac','linux') NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`usedAt` timestamp,
	`revokedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `download_tokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `download_tokens_token_unique` UNIQUE(`token`)
);
