ALTER TABLE `crowdfundingCampaigns` ADD COLUMN `source` enum('internal','kickstarter','indiegogo','gofundme','other') NOT NULL DEFAULT 'internal';--> statement-breakpoint
ALTER TABLE `crowdfundingCampaigns` ADD COLUMN `externalId` varchar(255);--> statement-breakpoint
ALTER TABLE `crowdfundingCampaigns` ADD COLUMN `externalUrl` varchar(500);--> statement-breakpoint
ALTER TABLE `crowdfundingCampaigns` ADD COLUMN `creatorName` varchar(255);--> statement-breakpoint
ALTER TABLE `crowdfundingCampaigns` ADD COLUMN `location` varchar(255);--> statement-breakpoint
ALTER TABLE `crowdfundingCampaigns` ADD COLUMN `percentFunded` int DEFAULT 0;--> statement-breakpoint
ALTER TABLE `crowdfundingCampaigns` ADD COLUMN `daysLeft` int;--> statement-breakpoint
ALTER TABLE `crowdfundingCampaigns` ADD COLUMN `subcategory` varchar(100);--> statement-breakpoint
ALTER TABLE `crowdfundingCampaigns` ADD COLUMN `tags` json;--> statement-breakpoint
ALTER TABLE `crowdfundingCampaigns` ADD COLUMN `creatorAvatarUrl` varchar(500);
