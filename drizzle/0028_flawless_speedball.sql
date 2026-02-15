CREATE TABLE `businessPlans` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`executiveSummary` text,
	`technologyDescription` text,
	`marketAnalysis` text,
	`competitiveAnalysis` text,
	`teamQualifications` text,
	`researchPlan` text,
	`commercializationStrategy` text,
	`financialProjections` text,
	`ipStrategy` text,
	`version` int NOT NULL DEFAULT 1,
	`status` enum('draft','completed','archived') NOT NULL DEFAULT 'draft',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `businessPlans_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `companies` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`industry` varchar(255),
	`technologyArea` text,
	`employeeCount` int,
	`annualRevenue` int,
	`foundedYear` int,
	`location` varchar(255),
	`minorityOwned` int DEFAULT 0,
	`womenOwned` int DEFAULT 0,
	`veteranOwned` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `companies_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `crowdfundingCampaigns` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`companyId` int,
	`title` varchar(255) NOT NULL,
	`slug` varchar(255) NOT NULL,
	`description` text,
	`story` text,
	`category` varchar(100),
	`goalAmount` int NOT NULL,
	`currentAmount` int NOT NULL DEFAULT 0,
	`currency` varchar(3) NOT NULL DEFAULT 'USD',
	`backerCount` int NOT NULL DEFAULT 0,
	`imageUrl` varchar(500),
	`videoUrl` varchar(500),
	`startDate` timestamp NOT NULL,
	`endDate` timestamp NOT NULL,
	`status` enum('draft','active','funded','ended','cancelled') NOT NULL DEFAULT 'draft',
	`featured` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `crowdfundingCampaigns_id` PRIMARY KEY(`id`),
	CONSTRAINT `crowdfundingCampaigns_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `crowdfundingContributions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`campaignId` int NOT NULL,
	`userId` int,
	`amount` int NOT NULL,
	`currency` varchar(3) NOT NULL DEFAULT 'USD',
	`stripePaymentIntentId` varchar(255),
	`status` enum('pending','completed','failed','refunded') NOT NULL DEFAULT 'pending',
	`backerName` varchar(255),
	`backerEmail` varchar(320),
	`message` text,
	`anonymous` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `crowdfundingContributions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `crowdfundingRewards` (
	`id` int AUTO_INCREMENT NOT NULL,
	`campaignId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text,
	`minAmount` int NOT NULL,
	`maxClaims` int,
	`claimedCount` int NOT NULL DEFAULT 0,
	`estimatedDelivery` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `crowdfundingRewards_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `crowdfundingUpdates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`campaignId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`content` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `crowdfundingUpdates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `grantApplications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int NOT NULL,
	`businessPlanId` int,
	`grantOpportunityId` int NOT NULL,
	`technicalAbstract` text,
	`projectDescription` text,
	`specificAims` text,
	`innovation` text,
	`approach` text,
	`commercializationPlan` text,
	`budget` text,
	`budgetJustification` text,
	`timeline` text,
	`successProbability` int,
	`expectedValue` int,
	`qualityScore` int,
	`priority` int,
	`status` enum('draft','ready','submitted','under_review','awarded','rejected') NOT NULL DEFAULT 'draft',
	`submittedAt` timestamp,
	`decisionDate` timestamp,
	`awardAmount` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `grantApplications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `grantMatches` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int NOT NULL,
	`grantOpportunityId` int NOT NULL,
	`matchScore` int NOT NULL,
	`eligibilityScore` int NOT NULL,
	`alignmentScore` int NOT NULL,
	`competitivenessScore` int NOT NULL,
	`recommendationReason` text,
	`estimatedSuccessProbability` int,
	`expectedValue` int,
	`isRecommended` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `grantMatches_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `grantOpportunities` (
	`id` int AUTO_INCREMENT NOT NULL,
	`agency` varchar(255) NOT NULL,
	`programName` varchar(255) NOT NULL,
	`opportunityNumber` varchar(255),
	`title` text NOT NULL,
	`description` text,
	`focusAreas` text,
	`region` varchar(50) NOT NULL DEFAULT 'USA',
	`country` varchar(100),
	`minAmount` int,
	`maxAmount` int,
	`phase` varchar(50),
	`eligibilityCriteria` text,
	`applicationDeadline` timestamp,
	`openDate` timestamp,
	`closeDate` timestamp,
	`estimatedAwards` int,
	`competitiveness` varchar(50),
	`url` text,
	`status` enum('open','closed','upcoming') NOT NULL DEFAULT 'open',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `grantOpportunities_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `businessPlans` ADD CONSTRAINT `businessPlans_companyId_companies_id_fk` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `companies` ADD CONSTRAINT `companies_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `crowdfundingCampaigns` ADD CONSTRAINT `crowdfundingCampaigns_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `crowdfundingCampaigns` ADD CONSTRAINT `crowdfundingCampaigns_companyId_companies_id_fk` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `crowdfundingContributions` ADD CONSTRAINT `crowdfundingContributions_campaignId_crowdfundingCampaigns_id_fk` FOREIGN KEY (`campaignId`) REFERENCES `crowdfundingCampaigns`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `crowdfundingContributions` ADD CONSTRAINT `crowdfundingContributions_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `crowdfundingRewards` ADD CONSTRAINT `crowdfundingRewards_campaignId_crowdfundingCampaigns_id_fk` FOREIGN KEY (`campaignId`) REFERENCES `crowdfundingCampaigns`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `crowdfundingUpdates` ADD CONSTRAINT `crowdfundingUpdates_campaignId_crowdfundingCampaigns_id_fk` FOREIGN KEY (`campaignId`) REFERENCES `crowdfundingCampaigns`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `grantApplications` ADD CONSTRAINT `grantApplications_companyId_companies_id_fk` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `grantApplications` ADD CONSTRAINT `grantApplications_businessPlanId_businessPlans_id_fk` FOREIGN KEY (`businessPlanId`) REFERENCES `businessPlans`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `grantApplications` ADD CONSTRAINT `grantApplications_grantOpportunityId_grantOpportunities_id_fk` FOREIGN KEY (`grantOpportunityId`) REFERENCES `grantOpportunities`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `grantMatches` ADD CONSTRAINT `grantMatches_companyId_companies_id_fk` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `grantMatches` ADD CONSTRAINT `grantMatches_grantOpportunityId_grantOpportunities_id_fk` FOREIGN KEY (`grantOpportunityId`) REFERENCES `grantOpportunities`(`id`) ON DELETE no action ON UPDATE no action;