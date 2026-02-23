# Feature Parity Audit: Web App vs Electron Desktop

## Web App Routes (from App.tsx)

### Public Pages
- `/` - Landing Page
- `/login`, `/register`, `/forgot-password`, `/reset-password`, `/verify-email` - Auth
- `/desktop-login` - Desktop-specific login
- `/pricing`, `/terms`, `/privacy`, `/contact`, `/blog` - Public content

### Dashboard (requires auth, wrapped in FetcherLayout)
- `/dashboard` - Builder Chat (ChatPage)
- `/replicate` - Clone Website (ReplicatePage)
- `/sandbox` - Sandbox (SandboxPage)
- `/fetcher/smart-fetch` - Smart Fetch
- `/fetcher/new` - New Fetcher Job
- `/fetcher/jobs` - Fetcher Jobs List
- `/fetcher/jobs/:id` - Job Detail
- `/marketplace` - Developer Marketplace
- `/project-files` - Project Files Viewer

### Security
- `/fetcher/totp-vault` - TOTP Vault
- `/fetcher/watchdog` - Watchdog
- `/fetcher/provider-health` - Provider Health
- `/fetcher/health-trends` - Health Trends
- `/fetcher/leak-scanner` - Leak Scanner
- `/fetcher/credential-health` - Credential Health

### Business & Funding
- `/grants` - Grants
- `/grant-applications` - Grant Applications
- `/companies` - Companies
- `/business-plans` - Business Plans
- `/crowdfunding` - Crowdfunding
- `/referrals` - Referrals
- `/advertising` - Advertising Dashboard
- `/affiliate` - Affiliate Dashboard
- `/seo` - SEO Dashboard
- `/blog-admin` - Blog Admin
- `/marketing` - Marketing Page

### Account & Settings
- `/dashboard/subscription` - Subscription
- `/dashboard/credits` - Credits
- `/fetcher/credentials` - Credentials
- `/fetcher/api-access` - API Access
- `/fetcher/team` - Team Management
- `/fetcher/team-vault` - Team Vault
- `/fetcher/settings` - Settings
- `/fetcher/killswitch` - Kill Switch
- `/fetcher/account` - Account Settings

### Automation
- `/fetcher/export` - Export
- `/fetcher/import` - Import
- `/fetcher/bulk-sync` - Bulk Sync
- `/fetcher/auto-sync` - Auto Sync
- `/fetcher/onboarding` - Provider Onboarding
- `/fetcher/history` - Credential History
- `/fetcher/audit-logs` - Audit Logs

### Developer API
- `/fetcher/developer-docs` - Developer Docs
- `/fetcher/webhooks` - Webhooks
- `/fetcher/notifications` - Notification Channels
- `/fetcher/api-analytics` - API Analytics
- `/fetcher/cli` - CLI Tool

### Admin
- `/fetcher/releases` - Release Management
- `/fetcher/admin` - Admin Panel
- `/fetcher/self-improvement` - Self Improvement Dashboard

## Electron local-server.js Proxy Endpoints

### Handled Locally
- GET `/api/health` - Health check
- GET/POST `/api/desktop/mode` - Online/offline mode
- POST `/api/desktop/login` - Login (activates license)
- POST `/api/desktop/logout` - Logout
- GET `/api/desktop/session` - Session check
- POST `/api/desktop/refresh` - Refresh license
- GET `/api/trpc/auth.me` - Auth check (tRPC compat)
- GET `/api/trpc/credits.getBalance` - Credits (tRPC compat)
- CRUD `/api/local/credentials` - Local encrypted credentials
- CRUD `/api/local/projects` - Local projects
- CRUD `/api/local/chat` - Local chat history
- GET `/api/local/activity` - Activity log
- GET `/api/local/stats` - Stats

### Proxied to Remote
- POST `/api/trpc/chat.send` - Chat (with online/offline check)
- GET `/api/chat/stream/:id` - SSE stream proxy
- POST `/api/chat/abort/:id` - Abort build
- GET `/api/chat/build-status/:id` - Build status
- GET `/api/chat/active-builds` - Active builds
- POST `/api/chat/upload` - File upload
- POST `/api/voice/upload` - Voice upload
- ALL `/api/trpc/:procedure` - Generic tRPC proxy (catch-all)
- GET `*` - SPA fallback (serves local or proxies remote)

## PARITY GAPS IDENTIFIED

### Critical Gaps
1. **No batch tRPC support** - Web uses batched tRPC calls (`/api/trpc/a,b,c?batch=1`), 
   but the proxy only handles single procedure calls. Batch calls will fail.
2. **No SSE for tRPC mutations** - Some tRPC mutations use SSE streaming 
   (e.g., chat.sendMessage), but the generic proxy doesn't handle SSE responses.
3. **Cookie-based auth mismatch** - Desktop sends `titan_session=${license.licenseKey}` 
   as cookie, but the remote server expects actual session cookies from OAuth.
4. **No file download proxy** - `/api/storage/*` or S3 file URLs aren't proxied.

### Feature Gaps
1. **Clone Website** - Proxied via generic tRPC, but file operations (S3 reads) may fail
2. **Project Files Viewer** - Needs `/api/storage/*` proxy for file downloads
3. **Marketplace** - Fully proxied via generic tRPC
4. **Sandbox** - Needs sandbox file system access proxy

### UX Gaps
1. **No desktop-specific navigation** - Uses same sidebar as web
2. **No native window controls** - Standard Electron chrome
3. **No auto-update mechanism** - No electron-updater
4. **No offline indicator** - Mode exists but no visual indicator in UI
