-- Migration: add missing columns to users table
-- titanUnlockExpiry, titanUnlockGrantedBy (referral Titan unlock)
-- customInstructions (user-defined persistent Titan instructions)

ALTER TABLE `users`
  ADD COLUMN `titanUnlockExpiry` timestamp NULL,
  ADD COLUMN `titanUnlockGrantedBy` int NULL,
  ADD COLUMN `customInstructions` text NULL;
