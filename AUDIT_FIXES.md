# Archibald Titan AI - Audit Fixes Log

**Date:** 2026-04-07
**Auditor:** Vybe (automated via GitHub + Stripe integration audit)

## Fixes Applied

### Fix 1: Navigation 404 - `/solutions` link (CRITICAL)
- **File:** `client/src/components/MarketingLayout.tsx`
- **Commit:** `a3e9ada`
- **Issue:** Both desktop and mobile nav linked to `/solutions` which had no route
- **Fix:** Changed to `/use-cases` (existing page with matching content)

### Fix 2: Missing Cyber Tier on Pricing Page (CRITICAL)
- **File:** `client/src/pages/PricingPage.tsx`
- **Commit:** `e2a2097`
- **Issue:** Cyber tier ($199/mo) defined in pricing config but invisible on pricing page
- **Fix:** Added 4th pricing card for Cyber tier, extended `handleGetStarted` to accept `"cyber"` planId, 4-column grid layout

### Fix 3: Sidebar Builder Link + Credits Widget Mislabel (MEDIUM)
- **File:** `client/src/components/FetcherLayout.tsx`
- **Commit:** `8984aab`
- **Issue 1:** Sidebar "Titan Builder" linked to `/builder` (public marketing page), exiting dashboard
- **Fix 1:** Changed path to `/dashboard` (actual builder chat location)
- **Issue 2:** Header widget showed `fetchesRemaining` but labeled it "Credits"
- **Fix 2:** Changed label from "Credits" to "Fetches" to match actual data source

### Fix 4: Pro Export Format False Advertising (CRITICAL)
- **File:** `shared/pricing.ts`
- **Commit:** `9b69cce`
- **Issue:** Pro features list and COMPARISON_FEATURES matrix both claimed CSV export for Pro, but `limits.exportFormats` only includes `["json", "env"]`
- **Fix:** Changed Pro features to "JSON & .ENV export", comparison matrix to "JSON & .ENV"

## Remaining Recommendations (not code fixes)

1. **Make repo private** - security tool source code is publicly visible
2. **Remove `node_modules` from git** - massively bloats repo
3. **Pre-create Stripe products/prices** - currently 0 products in live Stripe account
4. **Verify Railway env vars** - ensure all required vars are set
5. **Test Stripe checkout end-to-end** - 0 customers/payments ever processed
