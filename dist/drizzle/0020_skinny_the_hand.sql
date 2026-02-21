CREATE TABLE `self_modification_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`snapshotId` int,
	`requestedBy` varchar(64) NOT NULL,
	`userId` int,
	`action` enum('modify_file','create_file','delete_file','modify_config','add_dependency','restart_service','rollback','validate') NOT NULL,
	`targetFile` varchar(512),
	`description` text NOT NULL,
	`validationResult` enum('passed','failed','skipped'),
	`applied` int NOT NULL DEFAULT 0,
	`rolledBack` int NOT NULL DEFAULT 0,
	`errorMessage` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `self_modification_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `snapshot_files` (
	`id` int AUTO_INCREMENT NOT NULL,
	`snapshotId` int NOT NULL,
	`filePath` varchar(512) NOT NULL,
	`contentHash` varchar(64) NOT NULL,
	`content` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `snapshot_files_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `system_snapshots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`triggeredBy` varchar(64) NOT NULL,
	`reason` text NOT NULL,
	`fileCount` int NOT NULL DEFAULT 0,
	`status` enum('active','rolled_back','superseded') NOT NULL DEFAULT 'active',
	`isKnownGood` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `system_snapshots_id` PRIMARY KEY(`id`)
);
