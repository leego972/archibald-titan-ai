CREATE TABLE `marketing_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`key` varchar(100) NOT NULL,
	`value` text,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `marketing_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `marketing_settings_key_unique` UNIQUE(`key`)
);
