# Archibald Titan Platform Audit Report

## 1. Executive Summary

A comprehensive, trust-grade audit of the Archibald Titan platform was conducted across all user states, surfaces, and flows. The audit evaluated access controls, billing logic, feature entitlements, download flows, and placeholder exposure.

While the core platform functions as designed, **critical vulnerabilities in access control and billing logic** were identified. Specifically, several admin-only offensive security tools lack server-side role validation, and a significant pricing discrepancy exists between the marketing page and the actual Stripe checkout amounts, leading to revenue leakage.

The previously reported issue regarding the admin badge display has been successfully fixed and deployed to production.

## 2. Full Audit Matrix

| Surface / Feature | State Tested | Expected Behavior | Actual Behavior | Status | Severity |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Admin Badge** | Logged in (Admin) | Sidebar footer shows "Admin" | Sidebar footer shows "Admin" (amber) | ✅ Pass | N/A |
| **Landing Page** | Logged out | Shows marketing content | Shows marketing content | ✅ Pass | N/A |
| **Landing Page** | Logged in | Redirects to dashboard | Redirects to /dashboard | ✅ Pass | N/A |
| **Download App** | Logged out | Prompts login/registration | "Download" CTA redirects to /register | ⚠️ Warn | Low |
| **Download App** | Logged in (Free) | Can download desktop apps | Can download Windows, Mac, Linux apps | ✅ Pass | N/A |
| **Registration** | New User | Assigned Free tier, 500 credits | Assigned Free tier, 500 credits | ✅ Pass | N/A |
| **BIN Checker** | Logged in (Non-Admin) | Access Denied (403/404) | **Accessible via direct URL navigation** | ❌ Fail | Critical |
| **Offensive Tools** | Logged in (Titan Sub) | Access Denied (Admin Only) | **Accessible (Gate checks plan, not role)** | ❌ Fail | High |
| **Security Stream** | Logged in (Non-Admin) | Access Denied (Admin Only) | **Accessible (No role check on endpoint)** | ❌ Fail | High |
| **Pricing Page** | Public | Accurate pricing shown | **Shows $49/$199, Stripe charges $29/$99** | ❌ Fail | Critical |
| **Billing Upgrade** | Logged in | Shows available tiers | Shows Pro ($29), Enterprise ($99), Cyber ($149) | ⚠️ Warn | Medium |
| **Titan Credits** | Admin Granted | Unlimited (∞) | Unlimited (∞) | ✅ Pass | N/A |
| **Titan Credits** | Stripe Subscription | 10M credits/month | **0 credits (Tier not found in PRICING_TIERS)** | ❌ Fail | High |
| **Cancellation** | Canceled Sub | Access until period end | Access until period end, then Free tier | ✅ Pass | N/A |
| **Downgrade** | Downgraded Sub | Prorated charge, new limits | Prorated charge, but excess credits remain | ⚠️ Warn | Medium |

## 3. Website vs App Parity Review

The web platform and desktop application share the same underlying React codebase and API routes. Parity is maintained across both surfaces. However, the following UX issues were noted:

*   **Download Flow:** The public landing page features a "Download Desktop App" button that links to `/download`. This route does not exist and automatically redirects unauthenticated users to `/register`. While functionally secure, this is a deceptive UX pattern. A dedicated public download page or a clearer "Sign Up to Download" CTA is recommended.
*   **Client-Side Routing:** The `FetcherLayout` component successfully hides admin-only items from the sidebar for non-admin users. However, there are no client-side route guards preventing a user from manually navigating to paths like `/bin-checker` or `/evilginx`.

## 4. Registration / Billing / Download Validation

### Registration & Onboarding
*   **Flow:** Works correctly. New users are assigned the "free" plan by default and receive 500 monthly credits.
*   **Access:** Free tier users correctly see standard tools (Overview, Astra Scanner, etc.) and are restricted from premium features.

### Billing & Entitlements (CRITICAL ISSUES)
*   **Pricing Discrepancy (Revenue Leak):** The public marketing page (`PricingPage.tsx`) advertises the Pro plan at $49/month and Enterprise at $199/month. However, the underlying `PRICING_TIERS` configuration (`shared/pricing.ts`) sets these at $29/month and $99/month, respectively. Stripe checkout uses the lower amounts. This results in significant revenue leakage and compliance risks regarding advertised vs. actual pricing.
*   **Titan Tier Subscription Bug:** The Titan tier is defined in `INTERNAL_TIERS`, not `PRICING_TIERS`. If a user manages to subscribe to Titan via Stripe, the webhook handler will fail to find the tier in `PRICING_TIERS` and will not grant the expected 10,000,000 credits.
*   **Credit Display:** The billing page shows "10,000,000 credits/month" for Titan, while the header shows "∞" for admin-granted Titan users.

### Download Flow
*   **Security:** The download token endpoint (`download.requestToken`) correctly requires authentication.
*   **Availability:** Downloads are available to all authenticated users, regardless of their paid tier.

## 5. Placeholder / Stub Exposure Review

A systematic review of all tools and pages revealed the following regarding placeholder and stub content:

*   **Security Marketplace (HIGH SEVERITY):** The Security Marketplace (`/security-marketplace`) displays over 20 modules with fabricated statistics (e.g., "114,617 Total Downloads", "22 Contributors"). These modules are hardcoded in-memory (`const MODULES` in `security-marketplace-router.ts`) and are not real community submissions. This constitutes fake social proof and could mislead users making purchasing decisions.
*   **Functional Stubs:** Tools like BlackEye, Metasploit, and Evilginx display functional UIs but require a connected VPS node to operate. This is acceptable and clearly communicated to the user.
*   **Informational Pages:** The Exploit Pack page is informational and directs users to an external site to purchase a license.
*   **Empty States:** The SIEM Integration page correctly shows an empty state when no integrations are configured.

## 6. Prioritized Fix List

### Critical Priority (Immediate Action Required)
1.  **Fix Pricing Discrepancy:** Align the marketing page prices ($49/$199) with the actual Stripe checkout prices ($29/$99) to stop revenue leakage and ensure compliance. Update `shared/pricing.ts` or `PricingPage.tsx` accordingly.
2.  **Secure Admin-Only Routes:** Implement server-side role validation (e.g., `adminProcedure`) for the BIN Checker (`/bin-checker`) and the Security Stream endpoint (`/api/security-stream/:tool`). Currently, any authenticated user can access these via direct URL.
3.  **Fix Offensive Tooling Gate:** Update `enforceFeature` for "offensive_tooling" to check for the `isAdmin` role, rather than just the "titan" plan ID, to prevent regular users with a Titan subscription from accessing admin-only tools.

### High Priority
4.  **Remove Fake Marketplace Data:** Remove the hardcoded, fabricated modules from the Security Marketplace. Implement a real database-backed marketplace or clearly label the current modules as "Examples" or "Coming Soon".
5.  **Fix Titan Stripe Webhook:** Ensure the Stripe webhook can properly process Titan subscriptions by either moving Titan to `PRICING_TIERS` or updating the webhook logic to check `INTERNAL_TIERS`.

### Medium Priority
6.  **Implement Client-Side Route Guards:** Add client-side route protection in React to redirect non-admin users who attempt to manually navigate to admin-only URLs.
7.  **Improve Download UX:** Create a dedicated public download page or change the landing page CTA from "Download Desktop App" to "Sign Up to Download" to avoid the confusing redirect flow.
8.  **Handle Excess Credits on Downgrade:** Implement logic to zero out or adjust excess credits when a user downgrades their subscription plan.
