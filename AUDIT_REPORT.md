# Archibald Titan — Web/Desktop Parity Audit & Feature Improvement Report

**Date:** February 24, 2026  
**Commit:** `caa2c524` pushed to both `leego972/archibald-titan-ai` and `leego972/architabot`  
**TypeScript Status:** 0 errors (clean compilation)

---

## Executive Summary

A comprehensive audit was conducted across the web application (Vite + React + tRPC) and the Electron desktop application (local Express proxy + BrowserWindow). The audit covered **12 feature areas** across **~25,000 lines of frontend code** and **~800 lines of Electron proxy code**. One **critical parity gap** was identified and fixed (tRPC batch requests), along with multiple feature improvements across the codebase.

---

## 1. Critical Parity Gap Fixed

### tRPC Batch Request Support (Electron)

| Aspect | Before | After |
|--------|--------|-------|
| **Web App** | Uses `httpBatchLink` — sends batched requests like `/api/trpc/auth.me,credits.getBalance?batch=1` | No change needed |
| **Desktop App** | Only handled single procedure calls (`/api/trpc/:procedure`) — **batch requests silently failed** | Full batch support with local handler merging |
| **Impact** | Dashboard, navigation, and most pages would fail to load in the desktop app | All pages load correctly |

The fix implements intelligent batch handling: if all procedures in a batch can be resolved locally (e.g., `auth.me` + `credits.getBalance`), they are handled without a network call. Mixed batches are proxied to the remote server.

---

## 2. Feature-by-Feature Audit Results

### 2.1 Builder Chat (ChatPage.tsx — 2,105 lines)

**Status:** Fully functional on both web and desktop.

| Feature | Web | Desktop | Notes |
|---------|-----|---------|-------|
| Conversation management | Yes | Yes | Create, rename, delete, search |
| SSE streaming responses | Yes | Yes | Electron proxies SSE correctly |
| File upload | Yes | Yes | Chat upload proxy added |
| Slash commands | Yes | Yes | **Improved: 6 new commands added** |
| Action badges | Yes | Yes | **Improved: descriptive summaries** |
| Conversation export | No | No | **Added: /export command** |
| Vault integration | Yes | Yes | Save to vault from chat |

**Improvements Made:**
- Added slash commands: `/marketplace`, `/grants`, `/replicate`, `/sandbox`, `/export`, `/vault`
- Enhanced `ActionBadges` component to show human-readable tool descriptions instead of raw tool names
- Added `/export` command that exports the current conversation to a downloadable Markdown file

### 2.2 Clone Website (ReplicatePage.tsx — 1,236 lines)

**Status:** Fully functional on both platforms.

| Feature | Web | Desktop | Notes |
|---------|-----|---------|-------|
| 3-step wizard (URL → Research → Build) | Yes | Yes | Well-implemented |
| Auto-pipeline | Yes | Yes | Research → plan → build |
| Domain search | Yes | Yes | Via tRPC |
| Deployment | Yes | Yes | Via tRPC |
| Build progress polling | No | No | **Added: auto-refresh during builds** |

**Improvements Made:**
- Added `useEffect` auto-refresh polling (5-second interval) during active builds so users don't have to manually refresh to see build progress

### 2.3 Project Files Viewer (ProjectFilesViewer.tsx — 472 lines)

**Status:** Functional on both platforms.

| Feature | Web | Desktop | Notes |
|---------|-----|---------|-------|
| File tree navigation | Yes | Yes | Recursive folder structure |
| File content viewing | Yes | Yes | With syntax detection |
| Download files | Yes | Yes | Via tRPC |
| Syntax highlighting | Basic | Basic | **Improved: color coding + line numbers** |

**Improvements Made:**
- Added syntax-aware color coding for keywords, strings, comments, and numbers
- Added line numbers in the code viewer
- Improved empty state with better messaging

### 2.4 Dashboard & Navigation (FetcherLayout.tsx — 559 lines)

**Status:** Fully functional on both platforms.

| Feature | Web | Desktop | Notes |
|---------|-----|---------|-------|
| Sidebar navigation | Yes | Yes | Collapsible, resizable |
| Mobile responsive | Yes | N/A | Hamburger menu on mobile |
| Theme toggle | Yes | Yes | Light/dark mode |
| Language selector | Yes | Yes | i18n support |
| Project Files link | No | No | **Added to sidebar** |
| Desktop status bar | N/A | No | **Added: DesktopStatusBar component** |

**Improvements Made:**
- Added "Project Files" to the Developer Tools sidebar section
- Created `DesktopStatusBar` component (only visible in Electron) showing:
  - Desktop version indicator
  - Online/Offline mode toggle
  - Auto-update status (check, download, install)

### 2.5 Marketplace (MarketplacePage.tsx — 1,753 lines)

**Status:** Fully functional on both platforms.

| Feature | Web | Desktop | Notes |
|---------|-----|---------|-------|
| Browse listings | Yes | Yes | With search, filters, categories |
| Purchase items | Yes | Yes | Credit-based transactions |
| Download purchased items | Yes | Yes | **Electron proxy added** |
| Seller registration | Yes | Yes | $12/year via Stripe |
| Create listings | Yes | Yes | With file upload |
| Seller dashboard | Yes | Yes | Revenue, sales, ratings |
| Payout methods | Yes | Yes | Bank, PayPal, Stripe Connect |
| Reviews & ratings | Yes | Yes | Star ratings with seller ratings |
| File upload for listings | Yes | Yes | **Electron proxy added** |

**Proxy Routes Added for Desktop:**
- `/api/marketplace/*` — handles all marketplace REST endpoints including file uploads
- `/api/download/:token` — download gate proxy for purchased files

### 2.6 Account Settings (AccountSettingsPage.tsx — 873 lines)

**Status:** Fully functional on both platforms.

| Feature | Web | Desktop | Notes |
|---------|-----|---------|-------|
| Profile editing | Yes | Yes | Name, email |
| Password change | Yes | Yes | With strength indicator |
| Two-factor auth | Yes | Yes | TOTP setup |
| Linked providers | Yes | Yes | Google, GitHub |
| OpenAI API key | Yes | Yes | Save, test, delete |
| Theme toggle | Yes | Yes | **Fixed in previous session** |

### 2.7 Subscription (SubscriptionPage.tsx — 395 lines)

**Status:** Fully functional on both platforms.

| Feature | Web | Desktop | Notes |
|---------|-----|---------|-------|
| Current plan display | Yes | Yes | With status badge |
| Plan change | Yes | Yes | With prorated billing |
| Cancel/resume | Yes | Yes | With confirmation dialogs |
| Billing portal | Yes | Yes | Stripe portal redirect |
| Usage stats | Yes | Yes | Fetches, credentials, proxy slots |

### 2.8 Desktop Login (DesktopLoginPage.tsx — 224 lines)

**Status:** Functional.

| Feature | Before | After |
|---------|--------|-------|
| Login form | Yes | Yes |
| Version display | Hardcoded "v7.0.0" | **Dynamic from preload API** |
| Desktop API usage | `(window as any).titanDesktop` | **Typed `window.titanDesktop`** |
| Web version link | Yes | Yes |

### 2.9 Mobile Responsiveness

**Status:** Excellent across all pages.

| Feature | Status | Notes |
|---------|--------|-------|
| Safe area insets | Yes | iOS/Android notch support |
| Touch targets | Yes | 44px minimum |
| Font size fix | Yes | 16px minimum to prevent zoom |
| PWA standalone | Yes | `display-mode: standalone` support |
| Scrollbar hiding | Yes | Mobile scrollbar hidden |
| Dialog safe areas | Yes | Bottom padding for dialogs |
| Reduced motion | Yes | `prefers-reduced-motion` respected |

---

## 3. Electron Proxy Route Coverage

### Complete Route Map (After Fixes)

| Route | Method | Purpose | Status |
|-------|--------|---------|--------|
| `/api/desktop/login` | POST | Desktop license activation | Existing |
| `/api/desktop/logout` | POST | Desktop license deactivation | Existing |
| `/api/desktop/refresh` | POST | License refresh | Existing |
| `/api/desktop/status` | GET | Connection status | Existing |
| `/api/trpc/:procedure` | ALL | tRPC proxy (single + **batch**) | **Fixed** |
| `/api/chat/stream/:id` | GET | SSE streaming proxy | Existing |
| `/api/chat/abort/:id` | POST | Abort chat stream | Existing |
| `/api/chat/upload` | POST | Chat file upload | Existing |
| `/api/voice/upload` | POST | Voice upload | Existing |
| `/api/marketplace/*` | ALL | Marketplace REST proxy | **Added** |
| `/api/download/:token` | GET | Download gate proxy | **Added** |
| `/api/auth/*` | ALL | Auth endpoints proxy | **Added** |
| `/api/v1/*` | ALL | Generic API proxy | **Added** |
| `/api/files` | ALL | Project files proxy | **Added** |
| `/api/releases/upload` | POST | Release upload proxy | **Added** |
| `*` | GET | SPA fallback (local or remote) | Existing |

---

## 4. New Components Created

### DesktopStatusBar (`client/src/components/DesktopStatusBar.tsx`)

A thin status bar that only renders inside the Electron desktop app. It provides:
- **Desktop indicator** with version number
- **Online/Offline mode toggle** (persisted via IPC)
- **Auto-update status** with download/install buttons
- Listens to `onModeChange` and `onUpdateStatus` IPC events

### Updated Type Declarations (`client/src/lib/desktop.ts`)

Complete TypeScript type declarations for all Electron preload APIs including:
- `getMode()` / `setMode()` / `onModeChange()`
- `checkForUpdates()` / `downloadUpdate()` / `installUpdate()` / `onUpdateStatus()`
- `UpdateStatus` interface with all status variants

---

## 5. Files Modified

| File | Lines Changed | Type |
|------|--------------|------|
| `client/src/components/DesktopStatusBar.tsx` | +170 (new) | New component |
| `client/src/components/FetcherLayout.tsx` | +3 | Import + render |
| `client/src/lib/desktop.ts` | +12 | Type declarations |
| `client/src/pages/ChatPage.tsx` | +80 | Slash commands, export, badges |
| `client/src/pages/DesktopLoginPage.tsx` | +5 | Typed API, dynamic version |
| `client/src/pages/ProjectFilesViewer.tsx` | +45 | Syntax colors, line numbers |
| `client/src/pages/ReplicatePage.tsx` | +15 | Auto-refresh polling |
| `electron/local-server.js` | +250 | Batch support, proxy routes |
| **Total** | **+581 lines** | |
