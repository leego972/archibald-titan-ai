# Archibald Titan: Apple App Store Readiness Report & Roadmap

This document outlines the comprehensive strategy to transition Archibald Titan from its current web and desktop (Electron) architecture to a native-feeling iOS application suitable for the Apple App Store. Based on an in-depth audit of the current codebase and Apple's strict App Review Guidelines, this roadmap details the technical, compliance, and business model transformations required.

## 1. Current State Assessment

Archibald Titan is currently a highly sophisticated web application with a dense, feature-rich interface. 

**Current Architecture:**
- Frontend: React + Vite + TailwindCSS (109+ complex pages).
- Backend: Node.js + Express + tRPC + Drizzle ORM.
- Desktop: Electron wrapper.
- Payments: Stripe (Subscriptions, Top-ups, Marketplace).
- Authentication: Custom OAuth (Google, GitHub, etc.).

**The Mobile Gap:**
There is currently **no mobile codebase** (no React Native, Expo, or Capacitor setup). Attempting to simply wrap the existing web application in a WebView (e.g., using Capacitor without major UI overhauls) will result in an immediate rejection under **Apple App Store Guideline 4.2.2 (Minimum Functionality)**, which states that apps must be more than just a repackaged website [1].

---

## 2. Critical Compliance Hurdles (The "App Store Police")

Before writing any mobile code, we must address fundamental clashes between Titan's current feature set and Apple's App Review Guidelines.

### A. Offensive Security Tools (Guideline 1.1 & 1.2)
Titan includes modules like `BlackEyePage`, `EvilginxPage`, `ExploitPackPage`, and `MetasploitPage`. 
- **The Problem:** Apple strictly prohibits apps that facilitate hacking, provide exploits, or encourage illegal activities. Even if intended for "educational" or "authorized penetration testing" purposes, these tools will trigger rejections under the Safety guidelines [1].
- **The Solution:** The iOS app must serve as a "clean" version of Titan. We must implement feature-flagging based on the client platform. On iOS, these specific offensive security modules must be hidden from the UI entirely.

### B. In-App Purchases and Stripe (Guideline 3.1.1)
Titan uses Stripe for subscriptions, credit top-ups, and marketplace purchases.
- **The Problem:** Apple mandates that any digital goods, services, or subscriptions consumed within the app must use Apple's In-App Purchase (IAP) system, giving Apple their 15-30% cut. You cannot link out to Stripe or use a Stripe checkout sheet for digital credits [1].
- **The Solution:** We must integrate **RevenueCat** or native StoreKit for the iOS app. Users purchasing on iOS will use Apple Pay. Users purchasing on the Web will continue using Stripe. The backend must unify these entitlements.

### C. Sign in with Apple (Guideline 4.8)
- **The Problem:** If an app offers third-party logins (like Google, GitHub, or Manus OAuth), Apple requires that "Sign in with Apple" is also offered as an equivalent option [1].
- **The Solution:** Implement Sign in with Apple in the backend auth service and add the button to the mobile login screen.

### D. The Marketplace (Guideline 3.1.1 & 3.2.2)
- **The Problem:** Selling third-party digital goods (agents, blueprints) requires either IAP for every item (which is a logistical nightmare for user-generated content) or strict adherence to "Reader" app guidelines. 
- **The Solution:** The mobile app should likely act as a "Reader" for the marketplace. Users can browse and use items they have already purchased on the web, but the actual transaction might need to be restricted to the web version, or all marketplace items must be purchasable via an abstracted "Credit" system where the credits are bought via Apple IAP.

---

## 3. Technical Roadmap: Web to Native

To achieve parity while maintaining a single source of truth, we will adopt a **React Native + Expo** architecture. This allows us to reuse our TypeScript logic, tRPC clients, and state management while rendering native UI components.

### Phase 1: Mobile Foundation & Monorepo Setup
Instead of maintaining a completely separate repository, we should restructure into a Turborepo/Yarn Workspace.
1. **Extract Shared Logic:** Move all tRPC definitions, Zod schemas, utility functions, and API clients into a `shared` package.
2. **Initialize Expo:** Create a new `apps/mobile` directory using Expo (managed workflow).
3. **Auth Integration:** Implement JWT/Session handling in React Native, ensuring "Sign in with Apple" is prioritized.

### Phase 2: UI/UX Adaptation
Titan's desktop UI is extremely dense. We cannot simply port it 1:1.
1. **Mobile Navigation:** Replace the complex sidebar with a bottom tab navigation (Home, Agents, Marketplace, Settings) and stack navigators for deeper flows.
2. **Component Library:** Adopt a mobile-first component library (e.g., React Native Paper, Tamagui, or Gluestack) that mirrors the current Radix/Tailwind aesthetic but uses native primitives.
3. **Feature Triage:** Start by porting the core "Builder", "Chat", and "Dashboards". Leave complex administrative or highly technical tables (like raw database views) for the web.

### Phase 3: Payment & Entitlement Unification
1. **RevenueCat Integration:** Set up RevenueCat to manage Apple IAP.
2. **Backend Webhooks:** Connect RevenueCat webhooks to the Titan Express backend to sync Apple subscriptions with the existing database schema (granting the correct `PlanId` and credit balances).
3. **Credit Purchasing:** Create specific IAP packages for credit top-ups that match the existing Stripe packages, adjusting prices slightly if necessary to account for the App Store fee.

### Phase 4: Platform-Specific Feature Gating
1. **Platform Detection:** Implement logic in the backend and frontend to detect the `x-client-platform` header.
2. **Hide Restricted Content:** Ensure that any API queries for marketplace items, tools, or pages related to "exploits," "malware," or "pentesting" return empty arrays or 403 Forbidden when requested from an iOS client.

---

## 4. Submission Checklist & Timeline

| Milestone | Estimated Effort | Description |
| :--- | :--- | :--- |
| **1. Apple Developer Account** | 1 Week | Register as an organization (requires D-U-N-S number). |
| **2. Monorepo & Expo Setup** | 2 Weeks | Restructure codebase, share tRPC, verify basic connectivity. |
| **3. Core UI Porting** | 4-6 Weeks | Build mobile auth, chat, dashboards, and basic builder flows. |
| **4. RevenueCat & IAP** | 2 Weeks | Implement Apple Pay for subscriptions and credits. |
| **5. Content Gating** | 1 Week | Hide offensive security tools and non-compliant marketplace items. |
| **6. TestFlight Beta** | 2 Weeks | Internal testing, crash reporting, and UI refinement. |
| **7. App Store Review** | 1-2 Weeks | Initial submission. Expect at least one rejection; buffer time for appeals and minor tweaks. |

## Conclusion

Bringing Archibald Titan to the App Store is entirely feasible, but it requires treating the mobile app as a **focused, safe companion** to the web platform rather than a 1:1 clone. By utilizing Expo for rapid development, RevenueCat for seamless IAP integration, and strict feature-flagging to hide App Store-violating security tools, we can successfully pass Apple's review process and tap into the mobile ecosystem.

---
### References
[1] Apple Inc. "App Review Guidelines." Apple Developer. https://developer.apple.com/app-store/review/guidelines/ (accessed March 29, 2026).
