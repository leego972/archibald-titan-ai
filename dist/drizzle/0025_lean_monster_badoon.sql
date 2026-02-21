CREATE TABLE `desktop_licenses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`deviceId` varchar(128) NOT NULL,
	`deviceName` varchar(256),
	`platform` varchar(32) NOT NULL,
	`licenseKey` varchar(512) NOT NULL,
	`status` enum('active','revoked','expired') NOT NULL DEFAULT 'active',
	`lastValidatedAt` timestamp,
	`lastIpAddress` varchar(64),
	`activatedAt` timestamp NOT NULL DEFAULT (now()),
	`expiresAt` timestamp NOT NULL,
	`revokedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `desktop_licenses_id` PRIMARY KEY(`id`)
);
