CREATE TABLE `fetcher_credentials` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`jobId` int NOT NULL,
	`taskId` int NOT NULL,
	`providerId` varchar(64) NOT NULL,
	`providerName` varchar(128) NOT NULL,
	`keyType` varchar(64) NOT NULL,
	`keyLabel` varchar(256),
	`encryptedValue` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `fetcher_credentials_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `fetcher_jobs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`email` varchar(320) NOT NULL,
	`encryptedPassword` text NOT NULL,
	`selectedProviders` json NOT NULL,
	`status` enum('queued','running','completed','failed','cancelled') NOT NULL DEFAULT 'queued',
	`totalProviders` int NOT NULL DEFAULT 0,
	`completedProviders` int NOT NULL DEFAULT 0,
	`failedProviders` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`completedAt` timestamp,
	CONSTRAINT `fetcher_jobs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `fetcher_killswitch` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`code` varchar(16) NOT NULL,
	`active` int NOT NULL DEFAULT 0,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `fetcher_killswitch_id` PRIMARY KEY(`id`),
	CONSTRAINT `fetcher_killswitch_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `fetcher_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`proxyServer` varchar(512),
	`proxyUsername` varchar(128),
	`proxyPassword` text,
	`captchaService` varchar(64),
	`captchaApiKey` text,
	`headless` int NOT NULL DEFAULT 1,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `fetcher_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `fetcher_settings_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `fetcher_tasks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`jobId` int NOT NULL,
	`providerId` varchar(64) NOT NULL,
	`providerName` varchar(128) NOT NULL,
	`status` enum('queued','logging_in','navigating','extracting','captcha_wait','completed','failed') NOT NULL DEFAULT 'queued',
	`statusMessage` text,
	`errorMessage` text,
	`captchaType` varchar(64),
	`needsUserCaptcha` int NOT NULL DEFAULT 0,
	`userCaptchaDone` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`completedAt` timestamp,
	CONSTRAINT `fetcher_tasks_id` PRIMARY KEY(`id`)
);
