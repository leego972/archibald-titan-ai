CREATE TABLE `marketing_activity_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`action` varchar(100) NOT NULL,
	`channel` varchar(50),
	`details` json,
	`status` enum('success','failed','skipped') NOT NULL DEFAULT 'success',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `marketing_activity_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `marketing_budgets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`month` varchar(7) NOT NULL,
	`totalBudget` int NOT NULL,
	`status` enum('draft','active','paused','completed') NOT NULL DEFAULT 'draft',
	`allocations` json,
	`actualSpend` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `marketing_budgets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `marketing_campaigns` (
	`id` int AUTO_INCREMENT NOT NULL,
	`budgetId` int,
	`channel` enum('meta','google_ads','x_twitter','linkedin','snapchat','content_seo') NOT NULL,
	`name` varchar(255) NOT NULL,
	`status` enum('draft','pending_review','active','paused','completed','failed') NOT NULL DEFAULT 'draft',
	`type` enum('awareness','engagement','conversion','retargeting') NOT NULL,
	`targetAudience` json,
	`dailyBudget` int NOT NULL DEFAULT 0,
	`totalBudget` int NOT NULL DEFAULT 0,
	`totalSpend` int NOT NULL DEFAULT 0,
	`externalCampaignId` varchar(255),
	`startDate` timestamp,
	`endDate` timestamp,
	`impressions` int NOT NULL DEFAULT 0,
	`clicks` int NOT NULL DEFAULT 0,
	`conversions` int NOT NULL DEFAULT 0,
	`aiStrategy` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `marketing_campaigns_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `marketing_content` (
	`id` int AUTO_INCREMENT NOT NULL,
	`campaignId` int,
	`channel` enum('meta','google_ads','x_twitter','linkedin','snapchat','content_seo') NOT NULL,
	`contentType` enum('social_post','ad_copy','blog_article','email','image_ad','video_script') NOT NULL,
	`title` varchar(500),
	`body` text NOT NULL,
	`mediaUrl` text,
	`hashtags` json,
	`status` enum('draft','approved','published','failed') NOT NULL DEFAULT 'draft',
	`externalPostId` varchar(255),
	`publishedAt` timestamp,
	`impressions` int NOT NULL DEFAULT 0,
	`engagements` int NOT NULL DEFAULT 0,
	`clicks` int NOT NULL DEFAULT 0,
	`aiPrompt` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `marketing_content_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `marketing_performance` (
	`id` int AUTO_INCREMENT NOT NULL,
	`date` varchar(10) NOT NULL,
	`channel` enum('meta','google_ads','x_twitter','linkedin','snapchat','content_seo') NOT NULL,
	`impressions` int NOT NULL DEFAULT 0,
	`clicks` int NOT NULL DEFAULT 0,
	`conversions` int NOT NULL DEFAULT 0,
	`spend` int NOT NULL DEFAULT 0,
	`cpc` int NOT NULL DEFAULT 0,
	`cpm` int NOT NULL DEFAULT 0,
	`ctr` varchar(10) NOT NULL DEFAULT '0',
	`roas` varchar(10) NOT NULL DEFAULT '0',
	`signups` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `marketing_performance_id` PRIMARY KEY(`id`)
);
