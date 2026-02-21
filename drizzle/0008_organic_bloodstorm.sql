CREATE TABLE `dashboard_layouts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`widgetOrder` json NOT NULL,
	`hiddenWidgets` json,
	`widgetSizes` json,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `dashboard_layouts_id` PRIMARY KEY(`id`),
	CONSTRAINT `dashboard_layouts_userId_unique` UNIQUE(`userId`)
);
