CREATE TABLE `custom_providers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(100) NOT NULL,
	`slug` varchar(100) NOT NULL,
	`icon` varchar(10) DEFAULT '🔌',
	`category` varchar(50) NOT NULL DEFAULT 'custom',
	`loginUrl` text NOT NULL,
	`keysUrl` text NOT NULL,
	`keyTypes` json NOT NULL,
	`description` text,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `custom_providers_id` PRIMARY KEY(`id`)
);
