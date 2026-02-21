CREATE TABLE `identity_providers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`provider` varchar(64) NOT NULL,
	`providerAccountId` varchar(256) NOT NULL,
	`email` varchar(320),
	`displayName` varchar(256),
	`avatarUrl` text,
	`metadata` json,
	`linkedAt` timestamp NOT NULL DEFAULT (now()),
	`lastUsedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `identity_providers_id` PRIMARY KEY(`id`)
);
