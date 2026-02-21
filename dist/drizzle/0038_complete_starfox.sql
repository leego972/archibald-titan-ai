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
