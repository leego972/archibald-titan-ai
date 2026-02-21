CREATE TABLE `sandbox_commands` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sandboxId` int NOT NULL,
	`userId` int NOT NULL,
	`command` text NOT NULL,
	`output` text,
	`exitCode` int,
	`workingDirectory` varchar(512),
	`durationMs` int,
	`triggeredBy` enum('user','ai','system') NOT NULL DEFAULT 'user',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `sandbox_commands_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sandbox_files` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sandboxId` int NOT NULL,
	`filePath` varchar(512) NOT NULL,
	`content` text,
	`s3Key` varchar(256),
	`fileSize` int NOT NULL DEFAULT 0,
	`isDirectory` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `sandbox_files_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sandboxes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(128) NOT NULL,
	`osType` enum('linux') NOT NULL DEFAULT 'linux',
	`status` enum('creating','running','stopped','error') NOT NULL DEFAULT 'creating',
	`workspaceKey` varchar(256),
	`workingDirectory` varchar(512) NOT NULL DEFAULT '/home/sandbox',
	`memoryMb` int NOT NULL DEFAULT 512,
	`diskMb` int NOT NULL DEFAULT 2048,
	`timeoutSeconds` int NOT NULL DEFAULT 300,
	`totalCommands` int NOT NULL DEFAULT 0,
	`totalSessionTime` int NOT NULL DEFAULT 0,
	`lastActiveAt` timestamp,
	`installedPackages` json,
	`envVars` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `sandboxes_id` PRIMARY KEY(`id`)
);
