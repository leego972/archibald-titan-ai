-- Trial system columns on users table
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `trialStartedAt` datetime;--> statement-breakpoint
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `trialEndsAt` datetime;--> statement-breakpoint
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `trialConvertedAt` datetime;--> statement-breakpoint
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `hasPaymentMethod` boolean NOT NULL DEFAULT false;--> statement-breakpoint
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `stripeCustomerId` varchar(255);--> statement-breakpoint
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `marketingConsent` boolean NOT NULL DEFAULT true;--> statement-breakpoint
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `loginCount` int NOT NULL DEFAULT 0;--> statement-breakpoint

-- Seller subscription columns on seller_profiles table
ALTER TABLE `seller_profiles` ADD COLUMN IF NOT EXISTS `sellerSubscriptionActive` boolean NOT NULL DEFAULT false;--> statement-breakpoint
ALTER TABLE `seller_profiles` ADD COLUMN IF NOT EXISTS `sellerSubscriptionExpiresAt` datetime;--> statement-breakpoint
ALTER TABLE `seller_profiles` ADD COLUMN IF NOT EXISTS `sellerSubscriptionPaidAt` datetime;--> statement-breakpoint
ALTER TABLE `seller_profiles` ADD COLUMN IF NOT EXISTS `sellerSubscriptionStripeId` varchar(255);
