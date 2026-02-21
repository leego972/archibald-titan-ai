CREATE TABLE `improvement_tasks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(256) NOT NULL,
	`description` text NOT NULL,
	`category` enum('performance','security','ux','feature','reliability','testing','infrastructure') NOT NULL,
	`priority` enum('critical','high','medium','low') NOT NULL DEFAULT 'medium',
	`status` enum('pending','in_progress','completed','failed','skipped') NOT NULL DEFAULT 'pending',
	`complexity` enum('trivial','small','medium','large','epic') NOT NULL DEFAULT 'medium',
	`estimatedFiles` int DEFAULT 1,
	`assignedBy` enum('system','admin','titan') NOT NULL DEFAULT 'system',
	`completedAt` timestamp,
	`completionNotes` text,
	`snapshotId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `improvement_tasks_id` PRIMARY KEY(`id`)
);
