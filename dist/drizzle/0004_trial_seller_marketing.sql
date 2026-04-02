-- Trial system columns on users table
ALTER TABLE `users` ADD COLUMN `trialStartedAt` datetime;--> statement-breakpoint
ALTER TABLE `users` ADD COLUMN `trialEndsAt` datetime;--> statement-breakpoint
ALTER TABLE `users` ADD COLUMN `trialConvertedAt` datetime;--> statement-breakpoint
ALTER TABLE `users` ADD COLUMN `hasPaymentMethod` boolean NOT NULL DEFAULT false;--> statement-breakpoint
ALTER TABLE `users` ADD COLUMN `stripeCustomerId` varchar(255);--> statement-breakpoint
ALTER TABLE `users` ADD COLUMN `marketingConsent` boolean NOT NULL DEFAULT true;--> statement-breakpoint
ALTER TABLE `users` ADD COLUMN `loginCount` int NOT NULL DEFAULT 0;--> statement-breakpoint

-- Seller subscription columns on seller_profiles table
ALTER TABLE `seller_profiles` ADD COLUMN `sellerSubscriptionActive` boolean NOT NULL DEFAULT false;--> statement-breakpoint
ALTER TABLE `seller_profiles` ADD COLUMN `sellerSubscriptionExpiresAt` datetime;--> statement-breakpoint
ALTER TABLE `seller_profiles` ADD COLUMN `sellerSubscriptionPaidAt` datetime;--> statement-breakpoint
ALTER TABLE `seller_profiles` ADD COLUMN `sellerSubscriptionStripeId` varchar(255);
