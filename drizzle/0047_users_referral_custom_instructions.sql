-- Migration: add missing columns to users table
-- titanUnlockExpiry, titanUnlockGrantedBy (referral Titan unlock)
-- customInstructions (user-defined persistent Titan instructions)

ALTER TABLE `users`
  ADD COLUMN IF NOT EXISTS `titanUnlockExpiry` timestamp NULL,
  ADD COLUMN IF NOT EXISTS `titanUnlockGrantedBy` int NULL,
  ADD COLUMN IF NOT EXISTS `customInstructions` text NULL;
