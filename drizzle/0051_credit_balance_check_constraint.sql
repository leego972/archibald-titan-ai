-- Add CHECK constraint to prevent negative credit balances
  -- MySQL 8.0.16+ enforces CHECK constraints at the engine level.
  -- This is a belt-and-suspenders measure — application code already prevents
  -- negative balances via SELECT FOR UPDATE + pre-deduction validation.

  ALTER TABLE `credit_balances`
    ADD CONSTRAINT `credit_balances_credits_non_negative`
    CHECK (`credits` >= 0);

  ALTER TABLE `credit_balances`
    ADD CONSTRAINT `credit_balances_lifetime_non_negative`
    CHECK (`lifetimeCreditsUsed` >= 0 AND `lifetimeCreditsAdded` >= 0);
  