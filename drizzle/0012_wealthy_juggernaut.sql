CREATE TABLE `fetch_recommendations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`providerId` varchar(64) NOT NULL,
	`recommendationType` enum('stale_credential','rotation_detected','high_failure_rate','optimal_time','new_provider','proxy_needed') NOT NULL,
	`title` varchar(256) NOT NULL,
	`description` text NOT NULL,
	`priority` enum('low','medium','high','critical') NOT NULL DEFAULT 'medium',
	`actionUrl` varchar(256),
	`dismissed` int NOT NULL DEFAULT 0,
	`expiresAt` timestamp,
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `fetch_recommendations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `provider_health_snapshots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`providerId` varchar(64) NOT NULL,
	`totalFetches` int NOT NULL DEFAULT 0,
	`successfulFetches` int NOT NULL DEFAULT 0,
	`failedFetches` int NOT NULL DEFAULT 0,
	`avgDurationMs` int,
	`circuitState` varchar(16),
	`snapshotDate` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `provider_health_snapshots_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sync_schedules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(128) NOT NULL,
	`frequency` enum('daily','weekly','biweekly','monthly') NOT NULL DEFAULT 'weekly',
	`dayOfWeek` int,
	`timeOfDay` varchar(5) NOT NULL,
	`timezone` varchar(64) NOT NULL DEFAULT 'UTC',
	`providerIds` json NOT NULL,
	`enabled` int NOT NULL DEFAULT 1,
	`lastRunAt` timestamp,
	`nextRunAt` timestamp,
	`lastRunStatus` enum('success','partial','failed'),
	`lastRunJobId` int,
	`totalRuns` int NOT NULL DEFAULT 0,
	`successfulRuns` int NOT NULL DEFAULT 0,
	`failedRuns` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `sync_schedules_id` PRIMARY KEY(`id`)
);
