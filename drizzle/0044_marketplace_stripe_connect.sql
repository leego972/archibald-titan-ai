-- Migration 0044: Add Stripe Connect fields to seller_profiles
-- stripeConnectAccountId: platform account ID for bot sellers, seller's own acct_xxx for real sellers
-- stripeConnectOnboarded: true once Connect onboarding is complete
-- isPlatformBot: marks bot sellers whose revenue flows to the platform owner

ALTER TABLE `sellerProfiles`
  ADD COLUMN `stripeConnectAccountId` varchar(128),
  ADD COLUMN `stripeConnectOnboarded` boolean NOT NULL DEFAULT false,
  ADD COLUMN `isPlatformBot` boolean NOT NULL DEFAULT false;
