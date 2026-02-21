ALTER TABLE `grantOpportunities` MODIFY COLUMN `region` varchar(64) NOT NULL DEFAULT 'USA';--> statement-breakpoint
ALTER TABLE `grantOpportunities` MODIFY COLUMN `country` varchar(128);
