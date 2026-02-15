ALTER TABLE `releases` ADD `sha512Windows` text;--> statement-breakpoint
ALTER TABLE `releases` ADD `sha512Mac` text;--> statement-breakpoint
ALTER TABLE `releases` ADD `sha512Linux` text;--> statement-breakpoint
ALTER TABLE `releases` ADD `fileSizeWindows` int;--> statement-breakpoint
ALTER TABLE `releases` ADD `fileSizeMac` int;--> statement-breakpoint
ALTER TABLE `releases` ADD `fileSizeLinux` int;