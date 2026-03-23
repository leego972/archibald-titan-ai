-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: 0043_credit_escalation.sql
-- Adds the progressive credit escalation funnel and daily free credits system.
--
-- Changes:
--   1. New table: credit_escalation — tracks where each user is in the funnel
--      (boost packs bought, membership doubles, billing cycle anchors)
--   2. New columns on credit_balances:
--      - dailyFreeCredits: current daily free credit balance (free tier only)
--      - dailyFreeCreditsLastGranted: timestamp of last daily grant
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. credit_escalation table ───────────────────────────────────────────────
-- Tracks where a user is in the progressive credit escalation funnel:
--   Step 1: Out of credits → buy up to 3 boost packs (boostPacksBought this cycle)
--   Step 2: Still out → offered to double their plan (doublesThisCycle)
--   Step 3: Run out again → offered to double again (up to 3× per cycle)
--   Step 4: Month resets → billed at current (possibly doubled) rate, state resets
--
-- Downgrade rules:
--   - User can downgrade at any time → charged new rate immediately via Stripe
--   - Credits do NOT refill on downgrade — only refill when billingCycleEnd passes
--   - pendingDowngradePlan stores the target plan for next cycle if user chose "next cycle"
CREATE TABLE IF NOT EXISTS `credit_escalation` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `userId` INT NOT NULL UNIQUE,

  -- Boost pack tracking — resets each billing cycle (max 3 per cycle, paid tiers only)
  `boostPacksBought` INT NOT NULL DEFAULT 0,

  -- Membership doubling tracking — resets each billing cycle
  `doublesThisCycle` INT NOT NULL DEFAULT 0,
  `currentDoubledPlanId` VARCHAR(32) DEFAULT NULL,
  `doubledPriceUsd` INT NOT NULL DEFAULT 0,

  -- Billing cycle anchor — used to detect when month rolls over
  `billingCycleStart` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `billingCycleEnd` TIMESTAMP NULL DEFAULT NULL,

  -- Downgrade state — user chose to downgrade, pending next cycle
  `pendingDowngradePlan` ENUM('free','pro','enterprise','cyber','cyber_plus','titan') DEFAULT NULL,
  `pendingDowngradeAt` TIMESTAMP NULL DEFAULT NULL,

  -- Flags
  `hasBeenOfferedDouble` BOOLEAN NOT NULL DEFAULT FALSE,
  `cycleResetAt` TIMESTAMP NULL DEFAULT NULL,

  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX `idx_credit_escalation_userId` (`userId`),
  INDEX `idx_credit_escalation_billingCycleEnd` (`billingCycleEnd`)
);

-- ── 2. Daily free credits columns on credit_balances ─────────────────────────
-- Free tier users get 375 daily free credits that reset every 24 hours.
-- These are consumed BEFORE paid credits and do NOT accumulate.
-- Paid tier users do NOT receive daily free credits.
ALTER TABLE `credit_balances`
  ADD COLUMN IF NOT EXISTS `dailyFreeCredits` INT NOT NULL DEFAULT 0
    COMMENT 'Current daily free credit balance — free tier only, resets every 24h, does not accumulate',
  ADD COLUMN IF NOT EXISTS `dailyFreeCreditsLastGranted` TIMESTAMP NULL DEFAULT NULL
    COMMENT 'Timestamp of the last daily free credit grant — used to enforce 24h cooldown';

-- ── Indexes ───────────────────────────────────────────────────────────────────
ALTER TABLE `credit_balances`
  ADD INDEX IF NOT EXISTS `idx_credit_balances_dailyFreeLastGranted` (`dailyFreeCreditsLastGranted`);
