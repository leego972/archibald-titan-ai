CREATE TABLE `builder_activity_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`tool` varchar(64) NOT NULL,
	`status` enum('success','failure','error') NOT NULL,
	`summary` text,
	`durationMs` int,
	`details` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `builder_activity_log_id` PRIMARY KEY(`id`)
);
