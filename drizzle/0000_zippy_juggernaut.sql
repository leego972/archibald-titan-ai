CREATE TABLE `affiliate_applications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`discoveryId` int NOT NULL,
	`applicationType` enum('email','form_fill','api_signup','network_apply') NOT NULL DEFAULT 'email',
	`app_subject` text,
	`app_body` text,
	`formData` json,
	`app_status` enum('drafted','approved','sent','pending','accepted','rejected') NOT NULL DEFAULT 'drafted',
	`app_sentAt` timestamp,
	`responseReceivedAt` timestamp,
	`responseContent` text,
	`app_aiGenerated` boolean NOT NULL DEFAULT true,
	`app_createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `affiliate_applications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `affiliate_clicks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`partnerId` int NOT NULL,
	`userId` int,
	`clickId` varchar(64) NOT NULL,
	`ipAddress` varchar(45),
	`userAgent` text,
	`referrer` text,
	`utmSource` varchar(128),
	`utmMedium` varchar(128),
	`utmCampaign` varchar(128),
	`converted` boolean NOT NULL DEFAULT false,
	`conversionDate` timestamp,
	`commissionEarned` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `affiliate_clicks_id` PRIMARY KEY(`id`),
	CONSTRAINT `affiliate_clicks_clickId_unique` UNIQUE(`clickId`)
);
--> statement-breakpoint
CREATE TABLE `affiliate_discoveries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(256) NOT NULL,
	`domain` varchar(512) NOT NULL,
	`description` text,
	`vertical_disc` enum('ai_tools','hosting','dev_tools','security','vpn','crypto','saas','education','automation','analytics','design','marketing','fintech','other') NOT NULL DEFAULT 'other',
	`estimatedCommissionType` enum('revshare','cpa','hybrid','unknown') NOT NULL DEFAULT 'unknown',
	`estimatedCommissionRate` int NOT NULL DEFAULT 0,
	`revenueScore` int NOT NULL DEFAULT 0,
	`relevanceScore` int NOT NULL DEFAULT 0,
	`overallScore` int NOT NULL DEFAULT 0,
	`affiliateProgramUrl` text,
	`signupUrl` text,
	`contactEmail` varchar(320),
	`networkName` varchar(128),
	`discovery_status` enum('discovered','evaluating','approved','applied','accepted','rejected','skipped') NOT NULL DEFAULT 'discovered',
	`applicationStatus` enum('not_applied','application_drafted','application_sent','pending_review','approved','rejected') NOT NULL DEFAULT 'not_applied',
	`applicationDraftedAt` timestamp,
	`disc_applicationSentAt` timestamp,
	`applicationResponseAt` timestamp,
	`discoveredBy` enum('llm_search','network_crawl','competitor_analysis','manual') NOT NULL DEFAULT 'llm_search',
	`discoveryBatchId` varchar(64),
	`notes` text,
	`disc_metadata` json,
	`promotedToPartnerId` int,
	`disc_createdAt` timestamp NOT NULL DEFAULT (now()),
	`disc_updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `affiliate_discoveries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `affiliate_discovery_runs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`batchId` varchar(64) NOT NULL,
	`runType` enum('scheduled','manual','startup') NOT NULL DEFAULT 'scheduled',
	`run_status` enum('running','completed','failed','killed') NOT NULL DEFAULT 'running',
	`programsDiscovered` int NOT NULL DEFAULT 0,
	`programsEvaluated` int NOT NULL DEFAULT 0,
	`programsApproved` int NOT NULL DEFAULT 0,
	`applicationsGenerated` int NOT NULL DEFAULT 0,
	`applicationsSent` int NOT NULL DEFAULT 0,
	`searchQueries` json,
	`run_errors` json,
	`startedAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` timestamp,
	`durationMs` int NOT NULL DEFAULT 0,
	`killSwitchTriggered` boolean NOT NULL DEFAULT false,
	CONSTRAINT `affiliate_discovery_runs_id` PRIMARY KEY(`id`),
	CONSTRAINT `affiliate_discovery_runs_batchId_unique` UNIQUE(`batchId`)
);
--> statement-breakpoint
CREATE TABLE `affiliate_outreach` (
	`id` int AUTO_INCREMENT NOT NULL,
	`partnerId` int NOT NULL,
	`type` enum('email','form','api') NOT NULL DEFAULT 'email',
	`subject` text,
	`body` text,
	`status` enum('drafted','sent','opened','replied','accepted','rejected') NOT NULL DEFAULT 'drafted',
	`sentAt` timestamp,
	`repliedAt` timestamp,
	`aiGenerated` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `affiliate_outreach_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `affiliate_partners` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(256) NOT NULL,
	`domain` varchar(512),
	`contactEmail` varchar(320),
	`vertical` enum('ai_tools','hosting','dev_tools','security','vpn','crypto','saas','education','other') NOT NULL DEFAULT 'other',
	`commissionType` enum('revshare','cpa','hybrid','cpm','cpc') NOT NULL DEFAULT 'cpa',
	`commissionRate` int NOT NULL DEFAULT 20,
	`tier` enum('bronze','silver','gold','platinum') NOT NULL DEFAULT 'bronze',
	`status` enum('prospect','applied','active','paused','rejected','churned') NOT NULL DEFAULT 'prospect',
	`affiliateUrl` text,
	`applicationUrl` text,
	`applicationEmail` varchar(320),
	`applicationSentAt` timestamp,
	`approvedAt` timestamp,
	`totalClicks` int NOT NULL DEFAULT 0,
	`totalConversions` int NOT NULL DEFAULT 0,
	`totalEarnings` int NOT NULL DEFAULT 0,
	`performanceScore` int NOT NULL DEFAULT 0,
	`lastOptimizedAt` timestamp,
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `affiliate_partners_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `affiliate_payouts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`partnerId` int NOT NULL,
	`amountCents` int NOT NULL,
	`currency` varchar(3) NOT NULL DEFAULT 'USD',
	`status` enum('pending','processing','completed','failed') NOT NULL DEFAULT 'pending',
	`paymentMethod` varchar(64),
	`paymentReference` varchar(256),
	`periodStart` timestamp NOT NULL,
	`periodEnd` timestamp NOT NULL,
	`clickCount` int NOT NULL DEFAULT 0,
	`conversionCount` int NOT NULL DEFAULT 0,
	`processedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `affiliate_payouts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `api_keys` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(128) NOT NULL,
	`keyPrefix` varchar(16) NOT NULL,
	`keyHash` varchar(128) NOT NULL,
	`scopes` json NOT NULL,
	`lastUsedAt` timestamp,
	`usageCount` int NOT NULL DEFAULT 0,
	`expiresAt` timestamp,
	`revokedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `api_keys_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `api_usage_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`apiKeyId` int NOT NULL,
	`userId` int NOT NULL,
	`endpoint` varchar(256) NOT NULL,
	`method` varchar(10) NOT NULL,
	`statusCode` int NOT NULL,
	`responseMs` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `api_usage_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`userName` varchar(256),
	`userEmail` varchar(320),
	`action` varchar(128) NOT NULL,
	`resource` varchar(128),
	`resourceId` varchar(64),
	`details` json,
	`ipAddress` varchar(64),
	`userAgent` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `audit_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `blog_categories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`cat_name` varchar(100) NOT NULL,
	`cat_slug` varchar(100) NOT NULL,
	`cat_description` text,
	`postCount` int DEFAULT 0,
	`cat_createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `blog_categories_id` PRIMARY KEY(`id`),
	CONSTRAINT `blog_categories_cat_name_unique` UNIQUE(`cat_name`),
	CONSTRAINT `blog_categories_cat_slug_unique` UNIQUE(`cat_slug`)
);
--> statement-breakpoint
CREATE TABLE `blog_posts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`slug` varchar(255) NOT NULL,
	`blog_title` varchar(500) NOT NULL,
	`excerpt` text,
	`blog_content` text NOT NULL,
	`coverImageUrl` text,
	`authorId` int,
	`category` varchar(100) NOT NULL,
	`tags` json DEFAULT ('[]'),
	`metaTitle` varchar(160),
	`metaDescription` varchar(320),
	`focusKeyword` varchar(100),
	`secondaryKeywords` json DEFAULT ('[]'),
	`seoScore` int DEFAULT 0,
	`readingTimeMinutes` int DEFAULT 5,
	`blog_status` enum('draft','published','archived') NOT NULL DEFAULT 'draft',
	`publishedAt` timestamp,
	`blog_createdAt` timestamp NOT NULL DEFAULT (now()),
	`blog_updatedAt` timestamp NOT NULL DEFAULT (now()),
	`viewCount` int DEFAULT 0,
	`blog_aiGenerated` boolean NOT NULL DEFAULT false,
	CONSTRAINT `blog_posts_id` PRIMARY KEY(`id`),
	CONSTRAINT `blog_posts_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `builder_activity_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`tool` varchar(64) NOT NULL,
	`status` enum('success','failure','error') NOT NULL,
	`summary` text,
	`durationMs` int,
	`details` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `builder_activity_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `bulk_sync_jobs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`totalProviders` int NOT NULL DEFAULT 0,
	`completedProviders` int NOT NULL DEFAULT 0,
	`failedProviders` int NOT NULL DEFAULT 0,
	`status` enum('queued','running','completed','failed','cancelled') NOT NULL DEFAULT 'queued',
	`triggeredBy` enum('manual','scheduled') NOT NULL DEFAULT 'manual',
	`linkedJobIds` json,
	`startedAt` timestamp,
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `bulk_sync_jobs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
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
CREATE TABLE `chat_conversations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`title` varchar(255) NOT NULL DEFAULT 'New Conversation',
	`pinned` int NOT NULL DEFAULT 0,
	`archived` int NOT NULL DEFAULT 0,
	`messageCount` int NOT NULL DEFAULT 0,
	`lastMessageAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `chat_conversations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `chat_messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`conversationId` int NOT NULL,
	`userId` int NOT NULL,
	`role` enum('user','assistant','system','tool') NOT NULL,
	`content` text NOT NULL,
	`toolCalls` json,
	`actionsTaken` json,
	`tokenCount` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `chat_messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `companies` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`industry` varchar(255),
	`businessType` varchar(255),
	`technologyArea` text,
	`employeeCount` int,
	`annualRevenue` int,
	`foundedYear` int,
	`location` varchar(255),
	`country` varchar(64),
	`website` varchar(512),
	`description` text,
	`minorityOwned` int DEFAULT 0,
	`womenOwned` int DEFAULT 0,
	`veteranOwned` int DEFAULT 0,
	`indigenousOwned` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `companies_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `contact_submissions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(256) NOT NULL,
	`email` varchar(320) NOT NULL,
	`category` enum('billing','technical','account','general') NOT NULL DEFAULT 'general',
	`subject` varchar(512) NOT NULL,
	`message` text NOT NULL,
	`status` enum('new','in_progress','resolved','closed') NOT NULL DEFAULT 'new',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `contact_submissions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `credential_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`credentialId` int NOT NULL,
	`userId` int NOT NULL,
	`providerId` varchar(64) NOT NULL,
	`keyType` varchar(64) NOT NULL,
	`encryptedValue` text NOT NULL,
	`changeType` enum('created','rotated','manual_update','rollback') NOT NULL DEFAULT 'created',
	`snapshotNote` varchar(512),
	`jobId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `credential_history_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `credential_imports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`source` varchar(64) NOT NULL,
	`fileName` varchar(256),
	`totalEntries` int NOT NULL DEFAULT 0,
	`importedCount` int NOT NULL DEFAULT 0,
	`skippedCount` int NOT NULL DEFAULT 0,
	`errorCount` int NOT NULL DEFAULT 0,
	`status` enum('pending','processing','completed','failed') NOT NULL DEFAULT 'pending',
	`errorDetails` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `credential_imports_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `credential_watches` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`credentialId` int NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`alertDaysBefore` int NOT NULL DEFAULT 7,
	`status` enum('active','expiring_soon','expired','dismissed') NOT NULL DEFAULT 'active',
	`lastNotifiedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `credential_watches_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `credit_balances` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`credits` int NOT NULL DEFAULT 0,
	`lifetimeCreditsUsed` int NOT NULL DEFAULT 0,
	`lifetimeCreditsAdded` int NOT NULL DEFAULT 0,
	`isUnlimited` boolean NOT NULL DEFAULT false,
	`lastRefillAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `credit_balances_id` PRIMARY KEY(`id`),
	CONSTRAINT `credit_balances_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `credit_transactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`amount` int NOT NULL,
	`type` enum('signup_bonus','monthly_refill','pack_purchase','admin_adjustment','chat_message','builder_action','voice_action','referral_bonus') NOT NULL,
	`description` text,
	`balanceAfter` int NOT NULL,
	`stripePaymentIntentId` varchar(256),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `credit_transactions_id` PRIMARY KEY(`id`)
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
CREATE TABLE `custom_providers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(100) NOT NULL,
	`slug` varchar(100) NOT NULL,
	`icon` varchar(10) DEFAULT '🔌',
	`category` varchar(50) NOT NULL DEFAULT 'custom',
	`loginUrl` text NOT NULL,
	`keysUrl` text NOT NULL,
	`keyTypes` json NOT NULL,
	`description` text,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `custom_providers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
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
--> statement-breakpoint
CREATE TABLE `desktop_licenses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`deviceId` varchar(128) NOT NULL,
	`deviceName` varchar(256),
	`platform` varchar(32) NOT NULL,
	`licenseKey` varchar(512) NOT NULL,
	`status` enum('active','revoked','expired') NOT NULL DEFAULT 'active',
	`lastValidatedAt` timestamp,
	`lastIpAddress` varchar(64),
	`activatedAt` timestamp NOT NULL DEFAULT (now()),
	`expiresAt` timestamp NOT NULL,
	`revokedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `desktop_licenses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `download_audit_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`userEmail` varchar(320),
	`userName` varchar(256),
	`releaseId` int NOT NULL,
	`releaseVersion` varchar(32) NOT NULL,
	`platform` enum('windows','mac','linux') NOT NULL,
	`tokenId` int,
	`ipAddress` varchar(64),
	`userAgent` text,
	`status` enum('initiated','completed','expired','revoked','rate_limited') NOT NULL DEFAULT 'initiated',
	`downloadedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `download_audit_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `download_tokens` (
	`id` int AUTO_INCREMENT NOT NULL,
	`token` varchar(64) NOT NULL,
	`userId` int NOT NULL,
	`releaseId` int NOT NULL,
	`platform` enum('windows','mac','linux') NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`usedAt` timestamp,
	`revokedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `download_tokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `download_tokens_token_unique` UNIQUE(`token`)
);
--> statement-breakpoint
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
CREATE TABLE `fetcher_credentials` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`jobId` int NOT NULL,
	`taskId` int NOT NULL,
	`providerId` varchar(64) NOT NULL,
	`providerName` varchar(128) NOT NULL,
	`keyType` varchar(64) NOT NULL,
	`keyLabel` varchar(256),
	`encryptedValue` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `fetcher_credentials_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `fetcher_jobs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`email` varchar(320) NOT NULL,
	`encryptedPassword` text NOT NULL,
	`selectedProviders` json NOT NULL,
	`status` enum('queued','running','completed','failed','cancelled') NOT NULL DEFAULT 'queued',
	`totalProviders` int NOT NULL DEFAULT 0,
	`completedProviders` int NOT NULL DEFAULT 0,
	`failedProviders` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`completedAt` timestamp,
	CONSTRAINT `fetcher_jobs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `fetcher_killswitch` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`code` varchar(16) NOT NULL,
	`active` int NOT NULL DEFAULT 0,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `fetcher_killswitch_id` PRIMARY KEY(`id`),
	CONSTRAINT `fetcher_killswitch_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `fetcher_proxies` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`label` varchar(128) NOT NULL,
	`protocol` enum('http','https','socks5') NOT NULL DEFAULT 'http',
	`host` varchar(256) NOT NULL,
	`port` int NOT NULL,
	`username` varchar(128),
	`password` text,
	`proxyType` enum('residential','datacenter','mobile','isp') NOT NULL DEFAULT 'residential',
	`country` varchar(8),
	`city` varchar(128),
	`healthy` int NOT NULL DEFAULT 1,
	`latencyMs` int,
	`lastCheckedAt` timestamp,
	`lastUsedAt` timestamp,
	`failCount` int NOT NULL DEFAULT 0,
	`successCount` int NOT NULL DEFAULT 0,
	`provider` varchar(128),
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `fetcher_proxies_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `fetcher_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`proxyServer` varchar(512),
	`proxyUsername` varchar(128),
	`proxyPassword` text,
	`captchaService` varchar(64),
	`captchaApiKey` text,
	`headless` int NOT NULL DEFAULT 1,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `fetcher_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `fetcher_settings_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `fetcher_tasks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`jobId` int NOT NULL,
	`providerId` varchar(64) NOT NULL,
	`providerName` varchar(128) NOT NULL,
	`status` enum('queued','logging_in','navigating','extracting','captcha_wait','completed','failed') NOT NULL DEFAULT 'queued',
	`statusMessage` text,
	`errorMessage` text,
	`captchaType` varchar(64),
	`needsUserCaptcha` int NOT NULL DEFAULT 0,
	`userCaptchaDone` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`completedAt` timestamp,
	CONSTRAINT `fetcher_tasks_id` PRIMARY KEY(`id`)
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
	`region` varchar(64) NOT NULL DEFAULT 'USA',
	`country` varchar(128),
	`minAmount` int,
	`maxAmount` int,
	`currency` varchar(8),
	`phase` varchar(50),
	`eligibilityCriteria` text,
	`applicationDeadline` timestamp,
	`openDate` timestamp,
	`closeDate` timestamp,
	`estimatedAwards` int,
	`competitiveness` varchar(50),
	`url` text,
	`status` enum('open','closed','upcoming') NOT NULL DEFAULT 'open',
	`industryTags` text,
	`acceptsOverseas` boolean DEFAULT false,
	`applicableCountries` text,
	`sourceUrl` text,
	`lastVerifiedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `grantOpportunities_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `identity_providers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`provider` varchar(64) NOT NULL,
	`providerAccountId` varchar(256) NOT NULL,
	`email` varchar(320),
	`displayName` varchar(256),
	`avatarUrl` text,
	`metadata` json,
	`linkedAt` timestamp NOT NULL DEFAULT (now()),
	`lastUsedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `identity_providers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
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
--> statement-breakpoint
CREATE TABLE `leak_findings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`scanId` int NOT NULL,
	`userId` int NOT NULL,
	`source` enum('github','gitlab','pastebin','stackoverflow','npm','docker_hub','other') NOT NULL,
	`sourceUrl` text,
	`matchedPattern` varchar(256) NOT NULL,
	`credentialType` varchar(64) NOT NULL,
	`severity` enum('critical','high','medium','low') NOT NULL DEFAULT 'high',
	`snippet` text,
	`repoOrFile` varchar(512),
	`author` varchar(256),
	`detectedAt` timestamp NOT NULL DEFAULT (now()),
	`status` enum('new','reviewing','confirmed','false_positive','resolved') NOT NULL DEFAULT 'new',
	`resolvedAt` timestamp,
	`resolvedNote` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `leak_findings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `leak_scans` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`status` enum('queued','scanning','completed','failed') NOT NULL DEFAULT 'queued',
	`sourcesScanned` int NOT NULL DEFAULT 0,
	`leaksFound` int NOT NULL DEFAULT 0,
	`scanType` enum('full','quick','targeted') NOT NULL DEFAULT 'full',
	`targetPatterns` json,
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `leak_scans_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
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
	`channel` enum('meta','google_ads','x_twitter','linkedin','snapchat','content_seo','devto','medium','hashnode','discord','mastodon','telegram','whatsapp','pinterest','reddit','tiktok','youtube','quora','skool','indiehackers','hackernews','producthunt','email_outreach','sendgrid','hacker_forum') NOT NULL,
	`contentType` enum('social_post','ad_copy','blog_article','email','image_ad','video_script','backlink_outreach','email_nurture','community_engagement','hacker_forum_post','content_queue') NOT NULL,
	`title` varchar(500),
	`body` text NOT NULL,
	`mediaUrl` text,
	`hashtags` json,
	`platform` varchar(128),
	`headline` varchar(500),
	`metadata` json,
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
	`channel` enum('meta','google_ads','x_twitter','linkedin','snapchat','content_seo','devto','medium','hashnode','discord','mastodon','telegram','whatsapp','pinterest','reddit','tiktok','youtube','quora','skool','indiehackers','hackernews','producthunt','email_outreach','sendgrid','hacker_forum') NOT NULL,
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
--> statement-breakpoint
CREATE TABLE `marketing_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`key` varchar(100) NOT NULL,
	`value` text,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `marketing_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `marketing_settings_key_unique` UNIQUE(`key`)
);
--> statement-breakpoint
CREATE TABLE `notification_channels` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(128) NOT NULL,
	`type` enum('slack','discord','email') NOT NULL,
	`webhookUrl` text,
	`emailAddress` varchar(320),
	`events` json NOT NULL,
	`active` boolean NOT NULL DEFAULT true,
	`lastNotifiedAt` timestamp,
	`failCount` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `notification_channels_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `password_reset_tokens` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`token` varchar(128) NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`usedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `password_reset_tokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `password_reset_tokens_token_unique` UNIQUE(`token`)
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
CREATE TABLE `provider_onboarding` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`providerUrl` text NOT NULL,
	`detectedName` varchar(256),
	`detectedLoginUrl` text,
	`detectedKeysUrl` text,
	`detectedKeyTypes` json,
	`generatedScript` text,
	`status` enum('analyzing','ready','testing','verified','failed') NOT NULL DEFAULT 'analyzing',
	`confidence` int NOT NULL DEFAULT 0,
	`errorMessage` text,
	`testResult` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `provider_onboarding_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `referral_codes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`code` varchar(16) NOT NULL,
	`totalReferrals` int NOT NULL DEFAULT 0,
	`totalRewardsEarned` int NOT NULL DEFAULT 0,
	`totalCommissionCents` int NOT NULL DEFAULT 0,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `referral_codes_id` PRIMARY KEY(`id`),
	CONSTRAINT `referral_codes_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `referral_conversions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`referralCodeId` int NOT NULL,
	`referrerId` int NOT NULL,
	`referredUserId` int NOT NULL,
	`status` enum('signed_up','subscribed','rewarded') NOT NULL DEFAULT 'signed_up',
	`rewardType` enum('free_month','commission','credit','tier_upgrade') DEFAULT 'free_month',
	`rewardAmountCents` int NOT NULL DEFAULT 0,
	`rewardGrantedAt` timestamp,
	`subscriptionId` varchar(256),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `referral_conversions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `releases` (
	`id` int AUTO_INCREMENT NOT NULL,
	`version` varchar(32) NOT NULL,
	`title` varchar(256) NOT NULL,
	`changelog` text NOT NULL,
	`downloadUrlWindows` text,
	`downloadUrlMac` text,
	`downloadUrlLinux` text,
	`sha512Windows` text,
	`sha512Mac` text,
	`sha512Linux` text,
	`fileSizeWindows` int,
	`fileSizeMac` int,
	`fileSizeLinux` int,
	`fileSizeMb` int,
	`isLatest` int NOT NULL DEFAULT 0,
	`isPrerelease` int NOT NULL DEFAULT 0,
	`downloadCount` int NOT NULL DEFAULT 0,
	`publishedAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `releases_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `replicate_projects` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`sandboxId` int,
	`targetUrl` varchar(2048) NOT NULL,
	`targetName` varchar(256) NOT NULL,
	`targetDescription` text,
	`researchData` json,
	`buildPlan` json,
	`brandName` varchar(256),
	`brandColors` json,
	`brandLogo` text,
	`brandTagline` varchar(512),
	`stripePublishableKey` text,
	`stripeSecretKey` text,
	`stripePriceIds` json,
	`status` enum('researching','research_complete','planning','plan_complete','building','build_complete','testing','complete','error') NOT NULL DEFAULT 'researching',
	`currentStep` int NOT NULL DEFAULT 0,
	`totalSteps` int NOT NULL DEFAULT 0,
	`statusMessage` text,
	`errorMessage` text,
	`buildLog` json,
	`outputFiles` json,
	`previewUrl` text,
	`priority` enum('mvp','full') NOT NULL DEFAULT 'mvp',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `replicate_projects_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
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
--> statement-breakpoint
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
CREATE TABLE `subscriptions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`stripeCustomerId` varchar(128) NOT NULL,
	`stripeSubscriptionId` varchar(128),
	`plan` enum('free','pro','enterprise','cyber') NOT NULL DEFAULT 'free',
	`status` enum('active','canceled','past_due','incomplete','trialing') NOT NULL DEFAULT 'active',
	`currentPeriodEnd` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `subscriptions_id` PRIMARY KEY(`id`)
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
--> statement-breakpoint
CREATE TABLE `team_members` (
	`id` int AUTO_INCREMENT NOT NULL,
	`teamOwnerId` int NOT NULL,
	`userId` int NOT NULL,
	`role` enum('owner','admin','member','viewer') NOT NULL DEFAULT 'member',
	`invitedByUserId` int,
	`inviteEmail` varchar(320),
	`inviteToken` varchar(64),
	`inviteStatus` enum('pending','accepted','declined','expired') NOT NULL DEFAULT 'accepted',
	`joinedAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `team_members_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `totp_secrets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(256) NOT NULL,
	`issuer` varchar(256),
	`encryptedSecret` text NOT NULL,
	`algorithm` varchar(16) DEFAULT 'SHA1',
	`digits` int NOT NULL DEFAULT 6,
	`period` int NOT NULL DEFAULT 30,
	`iconUrl` varchar(512),
	`tags` json,
	`lastUsedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `totp_secrets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`openId` varchar(64) NOT NULL,
	`name` text,
	`email` varchar(320),
	`loginMethod` varchar(64),
	`passwordHash` text,
	`role` enum('user','admin') NOT NULL DEFAULT 'user',
	`emailVerified` boolean NOT NULL DEFAULT false,
	`emailVerificationToken` varchar(128),
	`emailVerificationExpires` timestamp,
	`twoFactorSecret` text,
	`twoFactorEnabled` boolean NOT NULL DEFAULT false,
	`twoFactorBackupCodes` json,
	`onboardingCompleted` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`lastSignedIn` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_openId_unique` UNIQUE(`openId`)
);
--> statement-breakpoint
CREATE TABLE `vault_access_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`vaultItemId` int NOT NULL,
	`userId` int NOT NULL,
	`userName` varchar(256),
	`action` enum('view','copy','reveal','update','delete','share') NOT NULL,
	`ipAddress` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `vault_access_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `vault_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`teamOwnerId` int NOT NULL,
	`createdByUserId` int NOT NULL,
	`name` varchar(256) NOT NULL,
	`providerId` varchar(64),
	`credentialType` varchar(64) NOT NULL,
	`encryptedValue` text NOT NULL,
	`accessLevel` enum('owner','admin','member','viewer') NOT NULL DEFAULT 'member',
	`expiresAt` timestamp,
	`lastAccessedAt` timestamp,
	`accessCount` int NOT NULL DEFAULT 0,
	`tags` json,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `vault_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `webhook_delivery_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`webhookId` int NOT NULL,
	`userId` int NOT NULL,
	`eventType` varchar(64) NOT NULL,
	`payload` json,
	`statusCode` int,
	`responseMs` int,
	`success` int NOT NULL DEFAULT 0,
	`errorMessage` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `webhook_delivery_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `webhooks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(128) NOT NULL,
	`url` text NOT NULL,
	`secret` varchar(128) NOT NULL,
	`events` json NOT NULL,
	`active` int NOT NULL DEFAULT 1,
	`lastDeliveredAt` timestamp,
	`lastStatusCode` int,
	`failCount` int NOT NULL DEFAULT 0,
	`successCount` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `webhooks_id` PRIMARY KEY(`id`)
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