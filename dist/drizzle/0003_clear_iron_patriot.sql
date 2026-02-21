CREATE TABLE `releases` (
	`id` int AUTO_INCREMENT NOT NULL,
	`version` varchar(32) NOT NULL,
	`title` varchar(256) NOT NULL,
	`changelog` text NOT NULL,
	`downloadUrlWindows` text,
	`downloadUrlMac` text,
	`downloadUrlLinux` text,
	`fileSizeMb` int,
	`isLatest` int NOT NULL DEFAULT 0,
	`isPrerelease` int NOT NULL DEFAULT 0,
	`downloadCount` int NOT NULL DEFAULT 0,
	`publishedAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `releases_id` PRIMARY KEY(`id`)
);
