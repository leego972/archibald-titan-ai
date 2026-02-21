CREATE TABLE `api_usage_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`apiKeyId` int NOT NULL,
	`userId` int NOT NULL,
	`endpoint` varchar(256) NOT NULL,
	`method` varchar(10) NOT NULL,
	`statusCode` int NOT NULL,
	`responseMs` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `api_usage_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `webhook_delivery_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`webhookId` int NOT NULL,
	`userId` int NOT NULL,
	`eventType` varchar(64) NOT NULL,
	`payload` json,
	`statusCode` int,
	`responseMs` int,
	`success` int NOT NULL DEFAULT 0,
	`errorMessage` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `webhook_delivery_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `webhooks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(128) NOT NULL,
	`url` text NOT NULL,
	`secret` varchar(128) NOT NULL,
	`events` json NOT NULL,
	`active` int NOT NULL DEFAULT 1,
	`lastDeliveredAt` timestamp,
	`lastStatusCode` int,
	`failCount` int NOT NULL DEFAULT 0,
	`successCount` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `webhooks_id` PRIMARY KEY(`id`)
);
