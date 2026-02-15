import { boolean, int, json, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  passwordHash: text("passwordHash"), // null for OAuth users, bcrypt hash for email users
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  emailVerified: boolean("emailVerified").default(false).notNull(),
  emailVerificationToken: varchar("emailVerificationToken", { length: 128 }),
  emailVerificationExpires: timestamp("emailVerificationExpires"),
  twoFactorSecret: text("twoFactorSecret"), // encrypted TOTP secret
  twoFactorEnabled: boolean("twoFactorEnabled").default(false).notNull(),
  twoFactorBackupCodes: json("twoFactorBackupCodes").$type<string[]>(), // hashed backup codes
  onboardingCompleted: boolean("onboardingCompleted").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── Password Reset Tokens ─────────────────────────────────────────

export const passwordResetTokens = mysqlTable("password_reset_tokens", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  token: varchar("token", { length: 128 }).notNull().unique(),
  expiresAt: timestamp("expiresAt").notNull(),
  usedAt: timestamp("usedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
export type InsertPasswordResetToken = typeof passwordResetTokens.$inferInsert;

// ─── Identity Providers (Multi-Provider Auth) ─────────────────────

export const identityProviders = mysqlTable("identity_providers", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  provider: varchar("provider", { length: 64 }).notNull(), // "email", "manus", "google", "github"
  providerAccountId: varchar("providerAccountId", { length: 256 }).notNull(), // email address or OAuth openId
  email: varchar("email", { length: 320 }),
  displayName: varchar("displayName", { length: 256 }),
  avatarUrl: text("avatarUrl"),
  metadata: json("metadata").$type<Record<string, unknown>>(),
  linkedAt: timestamp("linkedAt").defaultNow().notNull(),
  lastUsedAt: timestamp("lastUsedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type IdentityProvider = typeof identityProviders.$inferSelect;
export type InsertIdentityProvider = typeof identityProviders.$inferInsert;

// ─── Fetcher Tables ─────────────────────────────────────────────────

export const fetcherJobs = mysqlTable("fetcher_jobs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  encryptedPassword: text("encryptedPassword").notNull(),
  selectedProviders: json("selectedProviders").$type<string[]>().notNull(),
  status: mysqlEnum("status", ["queued", "running", "completed", "failed", "cancelled"]).default("queued").notNull(),
  totalProviders: int("totalProviders").default(0).notNull(),
  completedProviders: int("completedProviders").default(0).notNull(),
  failedProviders: int("failedProviders").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  completedAt: timestamp("completedAt"),
});

export type FetcherJob = typeof fetcherJobs.$inferSelect;

export const fetcherTasks = mysqlTable("fetcher_tasks", {
  id: int("id").autoincrement().primaryKey(),
  jobId: int("jobId").notNull(),
  providerId: varchar("providerId", { length: 64 }).notNull(),
  providerName: varchar("providerName", { length: 128 }).notNull(),
  status: mysqlEnum("status", ["queued", "logging_in", "navigating", "extracting", "captcha_wait", "completed", "failed"]).default("queued").notNull(),
  statusMessage: text("statusMessage"),
  errorMessage: text("errorMessage"),
  captchaType: varchar("captchaType", { length: 64 }),
  needsUserCaptcha: int("needsUserCaptcha").default(0).notNull(),
  userCaptchaDone: int("userCaptchaDone").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  completedAt: timestamp("completedAt"),
});

export type FetcherTask = typeof fetcherTasks.$inferSelect;

export const fetcherCredentials = mysqlTable("fetcher_credentials", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  jobId: int("jobId").notNull(),
  taskId: int("taskId").notNull(),
  providerId: varchar("providerId", { length: 64 }).notNull(),
  providerName: varchar("providerName", { length: 128 }).notNull(),
  keyType: varchar("keyType", { length: 64 }).notNull(),
  keyLabel: varchar("keyLabel", { length: 256 }),
  encryptedValue: text("encryptedValue").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type FetcherCredential = typeof fetcherCredentials.$inferSelect;

export const fetcherSettings = mysqlTable("fetcher_settings", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  proxyServer: varchar("proxyServer", { length: 512 }),
  proxyUsername: varchar("proxyUsername", { length: 128 }),
  proxyPassword: text("proxyPassword"),
  captchaService: varchar("captchaService", { length: 64 }),
  captchaApiKey: text("captchaApiKey"),
  headless: int("headless").default(1).notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type FetcherSettings = typeof fetcherSettings.$inferSelect;

export const fetcherKillSwitch = mysqlTable("fetcher_killswitch", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  code: varchar("code", { length: 16 }).notNull(),
  active: int("active").default(0).notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type FetcherKillSwitch = typeof fetcherKillSwitch.$inferSelect;

// ─── Proxy Pool ─────────────────────────────────────────────────────

export const fetcherProxies = mysqlTable("fetcher_proxies", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  label: varchar("label", { length: 128 }).notNull(),
  protocol: mysqlEnum("protocol", ["http", "https", "socks5"]).default("http").notNull(),
  host: varchar("host", { length: 256 }).notNull(),
  port: int("port").notNull(),
  username: varchar("username", { length: 128 }),
  password: text("password"),
  proxyType: mysqlEnum("proxyType", ["residential", "datacenter", "mobile", "isp"]).default("residential").notNull(),
  country: varchar("country", { length: 8 }),
  city: varchar("city", { length: 128 }),
  // Health tracking
  healthy: int("healthy").default(1).notNull(),
  latencyMs: int("latencyMs"),
  lastCheckedAt: timestamp("lastCheckedAt"),
  lastUsedAt: timestamp("lastUsedAt"),
  failCount: int("failCount").default(0).notNull(),
  successCount: int("successCount").default(0).notNull(),
  // Metadata
  provider: varchar("provider", { length: 128 }),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type FetcherProxy = typeof fetcherProxies.$inferSelect;
export type InsertFetcherProxy = typeof fetcherProxies.$inferInsert;

// ─── Releases / Downloads ──────────────────────────────────────────

export const releases = mysqlTable("releases", {
  id: int("id").autoincrement().primaryKey(),
  version: varchar("version", { length: 32 }).notNull(),
  title: varchar("title", { length: 256 }).notNull(),
  changelog: text("changelog").notNull(),
  downloadUrlWindows: text("downloadUrlWindows"),
  downloadUrlMac: text("downloadUrlMac"),
  downloadUrlLinux: text("downloadUrlLinux"),
  sha512Windows: text("sha512Windows"),
  sha512Mac: text("sha512Mac"),
  sha512Linux: text("sha512Linux"),
  fileSizeWindows: int("fileSizeWindows"),
  fileSizeMac: int("fileSizeMac"),
  fileSizeLinux: int("fileSizeLinux"),
  fileSizeMb: int("fileSizeMb"),
  isLatest: int("isLatest").default(0).notNull(),
  isPrerelease: int("isPrerelease").default(0).notNull(),
  downloadCount: int("downloadCount").default(0).notNull(),
  publishedAt: timestamp("publishedAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Release = typeof releases.$inferSelect;
export type InsertRelease = typeof releases.$inferInsert;

// ─── Contact / Billing Submissions ─────────────────────────────────
export const contactSubmissions = mysqlTable("contact_submissions", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 256 }).notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  category: mysqlEnum("category", ["billing", "technical", "account", "general"]).default("general").notNull(),
  subject: varchar("subject", { length: 512 }).notNull(),
  message: text("message").notNull(),
  status: mysqlEnum("status", ["new", "in_progress", "resolved", "closed"]).default("new").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type ContactSubmission = typeof contactSubmissions.$inferSelect;
export type InsertContactSubmission = typeof contactSubmissions.$inferInsert;

// ─── Subscriptions (Stripe) ───────────────────────────────────────
export const subscriptions = mysqlTable("subscriptions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  stripeCustomerId: varchar("stripeCustomerId", { length: 128 }).notNull(),
  stripeSubscriptionId: varchar("stripeSubscriptionId", { length: 128 }),
  plan: mysqlEnum("plan", ["free", "pro", "enterprise"]).default("free").notNull(),
  status: mysqlEnum("status", ["active", "canceled", "past_due", "incomplete", "trialing"]).default("active").notNull(),
  currentPeriodEnd: timestamp("currentPeriodEnd"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Subscription = typeof subscriptions.$inferSelect;
export type InsertSubscription = typeof subscriptions.$inferInsert;

// ─── Download Gate ────────────────────────────────────────────────

export const downloadTokens = mysqlTable("download_tokens", {
  id: int("id").autoincrement().primaryKey(),
  token: varchar("token", { length: 64 }).notNull().unique(),
  userId: int("userId").notNull(),
  releaseId: int("releaseId").notNull(),
  platform: mysqlEnum("platform", ["windows", "mac", "linux"]).notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  usedAt: timestamp("usedAt"),
  revokedAt: timestamp("revokedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type DownloadToken = typeof downloadTokens.$inferSelect;
export type InsertDownloadToken = typeof downloadTokens.$inferInsert;

export const downloadAuditLog = mysqlTable("download_audit_log", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  userEmail: varchar("userEmail", { length: 320 }),
  userName: varchar("userName", { length: 256 }),
  releaseId: int("releaseId").notNull(),
  releaseVersion: varchar("releaseVersion", { length: 32 }).notNull(),
  platform: mysqlEnum("platform", ["windows", "mac", "linux"]).notNull(),
  tokenId: int("tokenId"),
  ipAddress: varchar("ipAddress", { length: 64 }),
  userAgent: text("userAgent"),
  status: mysqlEnum("status", ["initiated", "completed", "expired", "revoked", "rate_limited"]).default("initiated").notNull(),
  downloadedAt: timestamp("downloadedAt").defaultNow().notNull(),
});

export type DownloadAuditLog = typeof downloadAuditLog.$inferSelect;
export type InsertDownloadAuditLog = typeof downloadAuditLog.$inferInsert;

// ─── API Keys ────────────────────────────────────────────────────────

export const apiKeys = mysqlTable("api_keys", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 128 }).notNull(),
  keyPrefix: varchar("keyPrefix", { length: 16 }).notNull(), // first 8 chars for display
  keyHash: varchar("keyHash", { length: 128 }).notNull(), // SHA-256 hash for lookup
  scopes: json("scopes").$type<string[]>().notNull(), // ["credentials:read", "credentials:export", etc.]
  lastUsedAt: timestamp("lastUsedAt"),
  usageCount: int("usageCount").default(0).notNull(),
  expiresAt: timestamp("expiresAt"),
  revokedAt: timestamp("revokedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ApiKey = typeof apiKeys.$inferSelect;
export type InsertApiKey = typeof apiKeys.$inferInsert;

// ─── Team Members ────────────────────────────────────────────────────

export const teamMembers = mysqlTable("team_members", {
  id: int("id").autoincrement().primaryKey(),
  teamOwnerId: int("teamOwnerId").notNull(), // the user who owns the team
  userId: int("userId").notNull(), // the member user
  role: mysqlEnum("role", ["owner", "admin", "member", "viewer"]).default("member").notNull(),
  invitedByUserId: int("invitedByUserId"),
  inviteEmail: varchar("inviteEmail", { length: 320 }),
  inviteToken: varchar("inviteToken", { length: 64 }),
  inviteStatus: mysqlEnum("inviteStatus", ["pending", "accepted", "declined", "expired"]).default("accepted").notNull(),
  joinedAt: timestamp("joinedAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type TeamMember = typeof teamMembers.$inferSelect;
export type InsertTeamMember = typeof teamMembers.$inferInsert;

// ─── Audit Logs ──────────────────────────────────────────────────────

export const auditLogs = mysqlTable("audit_logs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  userName: varchar("userName", { length: 256 }),
  userEmail: varchar("userEmail", { length: 320 }),
  action: varchar("action", { length: 128 }).notNull(), // e.g. "credential.export", "job.create", "team.invite"
  resource: varchar("resource", { length: 128 }), // e.g. "credential", "job", "proxy", "apiKey"
  resourceId: varchar("resourceId", { length: 64 }), // ID of the affected resource
  details: json("details").$type<Record<string, unknown>>(), // extra context
  ipAddress: varchar("ipAddress", { length: 64 }),
  userAgent: text("userAgent"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = typeof auditLogs.$inferInsert;

// ─── Dashboard Layout Preferences ──────────────────────────────────

export const dashboardLayouts = mysqlTable("dashboard_layouts", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(), // one layout per user
  widgetOrder: json("widgetOrder").$type<string[]>().notNull(), // ordered list of widget IDs
  hiddenWidgets: json("hiddenWidgets").$type<string[]>(), // widgets the user has hidden
  widgetSizes: json("widgetSizes").$type<Record<string, "sm" | "md" | "lg">>(), // optional size overrides
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type DashboardLayout = typeof dashboardLayouts.$inferSelect;
export type InsertDashboardLayout = typeof dashboardLayouts.$inferInsert;

// ─── V2.0: Credential Expiry Watchdog ─────────────────────────────

export const credentialWatches = mysqlTable("credential_watches", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  credentialId: int("credentialId").notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  alertDaysBefore: int("alertDaysBefore").default(7).notNull(),
  status: mysqlEnum("status", ["active", "expiring_soon", "expired", "dismissed"]).default("active").notNull(),
  lastNotifiedAt: timestamp("lastNotifiedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type CredentialWatch = typeof credentialWatches.$inferSelect;
export type InsertCredentialWatch = typeof credentialWatches.$inferInsert;

// ─── V2.0: Credential Diff & History ──────────────────────────────

export const credentialHistory = mysqlTable("credential_history", {
  id: int("id").autoincrement().primaryKey(),
  credentialId: int("credentialId").notNull(),
  userId: int("userId").notNull(),
  providerId: varchar("providerId", { length: 64 }).notNull(),
  keyType: varchar("keyType", { length: 64 }).notNull(),
  encryptedValue: text("encryptedValue").notNull(),
  changeType: mysqlEnum("changeType", ["created", "rotated", "manual_update", "rollback"]).default("created").notNull(),
  snapshotNote: varchar("snapshotNote", { length: 512 }),
  jobId: int("jobId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type CredentialHistoryEntry = typeof credentialHistory.$inferSelect;
export type InsertCredentialHistoryEntry = typeof credentialHistory.$inferInsert;

// ─── V2.0: Bulk Provider Sync ─────────────────────────────────────

export const bulkSyncJobs = mysqlTable("bulk_sync_jobs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  totalProviders: int("totalProviders").default(0).notNull(),
  completedProviders: int("completedProviders").default(0).notNull(),
  failedProviders: int("failedProviders").default(0).notNull(),
  status: mysqlEnum("status", ["queued", "running", "completed", "failed", "cancelled"]).default("queued").notNull(),
  triggeredBy: mysqlEnum("triggeredBy", ["manual", "scheduled"]).default("manual").notNull(),
  linkedJobIds: json("linkedJobIds").$type<number[]>(),
  startedAt: timestamp("startedAt"),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type BulkSyncJob = typeof bulkSyncJobs.$inferSelect;
export type InsertBulkSyncJob = typeof bulkSyncJobs.$inferInsert;

// ─── V3.0: Scheduled Auto-Sync ──────────────────────────────────

export const syncSchedules = mysqlTable("sync_schedules", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 128 }).notNull(),
  frequency: mysqlEnum("frequency", ["daily", "weekly", "biweekly", "monthly"]).default("weekly").notNull(),
  dayOfWeek: int("dayOfWeek"), // 0=Sunday, 6=Saturday (for weekly/biweekly)
  timeOfDay: varchar("timeOfDay", { length: 5 }).notNull(), // HH:mm in 24h format
  timezone: varchar("timezone", { length: 64 }).default("UTC").notNull(),
  providerIds: json("providerIds").$type<string[]>().notNull(), // which providers to sync
  enabled: int("enabled").default(1).notNull(),
  lastRunAt: timestamp("lastRunAt"),
  nextRunAt: timestamp("nextRunAt"),
  lastRunStatus: mysqlEnum("lastRunStatus", ["success", "partial", "failed"]),
  lastRunJobId: int("lastRunJobId"),
  totalRuns: int("totalRuns").default(0).notNull(),
  successfulRuns: int("successfulRuns").default(0).notNull(),
  failedRuns: int("failedRuns").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SyncSchedule = typeof syncSchedules.$inferSelect;
export type InsertSyncSchedule = typeof syncSchedules.$inferInsert;

// ─── V3.0: Provider Health Snapshots (for trends) ───────────────

export const providerHealthSnapshots = mysqlTable("provider_health_snapshots", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  providerId: varchar("providerId", { length: 64 }).notNull(),
  totalFetches: int("totalFetches").default(0).notNull(),
  successfulFetches: int("successfulFetches").default(0).notNull(),
  failedFetches: int("failedFetches").default(0).notNull(),
  avgDurationMs: int("avgDurationMs"),
  circuitState: varchar("circuitState", { length: 16 }),
  snapshotDate: timestamp("snapshotDate").notNull(), // one snapshot per day per provider
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ProviderHealthSnapshot = typeof providerHealthSnapshots.$inferSelect;
export type InsertProviderHealthSnapshot = typeof providerHealthSnapshots.$inferInsert;

// ─── V3.0: Smart Fetch Recommendations ──────────────────────────

export const fetchRecommendations = mysqlTable("fetch_recommendations", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  providerId: varchar("providerId", { length: 64 }).notNull(),
  recommendationType: mysqlEnum("recommendationType", [
    "stale_credential",     // credential hasn't been refreshed in a long time
    "rotation_detected",    // upstream rotation likely happened
    "high_failure_rate",    // provider has high failure rate, suggest retry
    "optimal_time",         // best time to fetch based on historical success
    "new_provider",         // suggest a new provider the user hasn't tried
    "proxy_needed",         // provider needs proxy but user doesn't have one
  ]).notNull(),
  title: varchar("title", { length: 256 }).notNull(),
  description: text("description").notNull(),
  priority: mysqlEnum("priority", ["low", "medium", "high", "critical"]).default("medium").notNull(),
  actionUrl: varchar("actionUrl", { length: 256 }), // deep link to take action
  dismissed: int("dismissed").default(0).notNull(),
  expiresAt: timestamp("expiresAt"),
  metadata: json("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type FetchRecommendation = typeof fetchRecommendations.$inferSelect;
export type InsertFetchRecommendation = typeof fetchRecommendations.$inferInsert;

// ─── V4.0: Credential Leak Scanner ─────────────────────────────

export const leakScans = mysqlTable("leak_scans", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  status: mysqlEnum("status", ["queued", "scanning", "completed", "failed"]).default("queued").notNull(),
  sourcesScanned: int("sourcesScanned").default(0).notNull(),
  leaksFound: int("leaksFound").default(0).notNull(),
  scanType: mysqlEnum("scanType", ["full", "quick", "targeted"]).default("full").notNull(),
  targetPatterns: json("targetPatterns").$type<string[]>(), // specific patterns to scan for
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type LeakScan = typeof leakScans.$inferSelect;
export type InsertLeakScan = typeof leakScans.$inferInsert;

export const leakFindings = mysqlTable("leak_findings", {
  id: int("id").autoincrement().primaryKey(),
  scanId: int("scanId").notNull(),
  userId: int("userId").notNull(),
  source: mysqlEnum("source", ["github", "gitlab", "pastebin", "stackoverflow", "npm", "docker_hub", "other"]).notNull(),
  sourceUrl: text("sourceUrl"), // URL where the leak was found
  matchedPattern: varchar("matchedPattern", { length: 256 }).notNull(), // e.g. "sk-..." or "AKIA..."
  credentialType: varchar("credentialType", { length: 64 }).notNull(), // e.g. "openai_api_key", "aws_access_key"
  severity: mysqlEnum("severity", ["critical", "high", "medium", "low"]).default("high").notNull(),
  snippet: text("snippet"), // redacted context around the match
  repoOrFile: varchar("repoOrFile", { length: 512 }), // repo name or file path
  author: varchar("author", { length: 256 }), // commit author or poster
  detectedAt: timestamp("detectedAt").defaultNow().notNull(),
  status: mysqlEnum("status", ["new", "reviewing", "confirmed", "false_positive", "resolved"]).default("new").notNull(),
  resolvedAt: timestamp("resolvedAt"),
  resolvedNote: text("resolvedNote"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type LeakFinding = typeof leakFindings.$inferSelect;
export type InsertLeakFinding = typeof leakFindings.$inferInsert;

// ─── V4.0: One-Click Provider Onboarding ────────────────────────

export const providerOnboarding = mysqlTable("provider_onboarding", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  providerUrl: text("providerUrl").notNull(), // URL the user pasted
  detectedName: varchar("detectedName", { length: 256 }), // AI-detected provider name
  detectedLoginUrl: text("detectedLoginUrl"), // AI-detected login page
  detectedKeysUrl: text("detectedKeysUrl"), // AI-detected API keys page
  detectedKeyTypes: json("detectedKeyTypes").$type<string[]>(), // AI-detected key types
  generatedScript: text("generatedScript"), // AI-generated automation script
  status: mysqlEnum("status", ["analyzing", "ready", "testing", "verified", "failed"]).default("analyzing").notNull(),
  confidence: int("confidence").default(0).notNull(), // 0-100 confidence score
  errorMessage: text("errorMessage"),
  testResult: json("testResult").$type<{ success: boolean; steps: string[]; errors: string[] }>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ProviderOnboarding = typeof providerOnboarding.$inferSelect;
export type InsertProviderOnboarding = typeof providerOnboarding.$inferInsert;

// ─── V4.0: Team Credential Vault ────────────────────────────────

export const vaultItems = mysqlTable("vault_items", {
  id: int("id").autoincrement().primaryKey(),
  teamOwnerId: int("teamOwnerId").notNull(), // the team owner
  createdByUserId: int("createdByUserId").notNull(), // who added it
  name: varchar("name", { length: 256 }).notNull(), // human-readable label
  providerId: varchar("providerId", { length: 64 }), // optional link to a known provider
  credentialType: varchar("credentialType", { length: 64 }).notNull(), // api_key, token, secret, etc.
  encryptedValue: text("encryptedValue").notNull(), // AES-256 encrypted
  accessLevel: mysqlEnum("accessLevel", ["owner", "admin", "member", "viewer"]).default("member").notNull(),
  expiresAt: timestamp("expiresAt"),
  lastAccessedAt: timestamp("lastAccessedAt"),
  accessCount: int("accessCount").default(0).notNull(),
  tags: json("tags").$type<string[]>(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type VaultItem = typeof vaultItems.$inferSelect;
export type InsertVaultItem = typeof vaultItems.$inferInsert;

export const vaultAccessLog = mysqlTable("vault_access_log", {
  id: int("id").autoincrement().primaryKey(),
  vaultItemId: int("vaultItemId").notNull(),
  userId: int("userId").notNull(),
  userName: varchar("userName", { length: 256 }),
  action: mysqlEnum("action", ["view", "copy", "reveal", "update", "delete", "share"]).notNull(),
  ipAddress: varchar("ipAddress", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type VaultAccessLogEntry = typeof vaultAccessLog.$inferSelect;
export type InsertVaultAccessLogEntry = typeof vaultAccessLog.$inferInsert;

// ─── V5.0: Webhooks ────────────────────────────────────────────

export const webhooks = mysqlTable("webhooks", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 128 }).notNull(),
  url: text("url").notNull(), // delivery URL
  secret: varchar("secret", { length: 128 }).notNull(), // HMAC signing secret
  events: json("events").$type<string[]>().notNull(), // e.g. ["scan.completed", "credential.rotated"]
  active: int("active").default(1).notNull(),
  lastDeliveredAt: timestamp("lastDeliveredAt"),
  lastStatusCode: int("lastStatusCode"),
  failCount: int("failCount").default(0).notNull(),
  successCount: int("successCount").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Webhook = typeof webhooks.$inferSelect;
export type InsertWebhook = typeof webhooks.$inferInsert;

export const webhookDeliveryLogs = mysqlTable("webhook_delivery_logs", {
  id: int("id").autoincrement().primaryKey(),
  webhookId: int("webhookId").notNull(),
  userId: int("userId").notNull(),
  eventType: varchar("eventType", { length: 64 }).notNull(),
  payload: json("payload").$type<Record<string, unknown>>(),
  statusCode: int("statusCode"),
  responseMs: int("responseMs"),
  success: int("success").default(0).notNull(),
  errorMessage: text("errorMessage"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type WebhookDeliveryLog = typeof webhookDeliveryLogs.$inferSelect;
export type InsertWebhookDeliveryLog = typeof webhookDeliveryLogs.$inferInsert;

// ─── V5.0: API Usage Logs ──────────────────────────────────────

export const apiUsageLogs = mysqlTable("api_usage_logs", {
  id: int("id").autoincrement().primaryKey(),
  apiKeyId: int("apiKeyId").notNull(),
  userId: int("userId").notNull(),
  endpoint: varchar("endpoint", { length: 256 }).notNull(),
  method: varchar("method", { length: 10 }).notNull(),
  statusCode: int("statusCode").notNull(),
  responseMs: int("responseMs"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ApiUsageLog = typeof apiUsageLogs.$inferSelect;
export type InsertApiUsageLog = typeof apiUsageLogs.$inferInsert;

// ─── V5.1: Self-Improvement Engine ──────────────────────────────────

/**
 * System snapshots — saved before any self-modification.
 * Each snapshot captures the state of modified files so we can
 * roll back to the last known good state if a change breaks things.
 */
export const systemSnapshots = mysqlTable("system_snapshots", {
  id: int("id").autoincrement().primaryKey(),
  triggeredBy: varchar("triggeredBy", { length: 64 }).notNull(), // "titan_assistant", "admin", "auto"
  reason: text("reason").notNull(), // why the snapshot was taken
  fileCount: int("fileCount").default(0).notNull(),
  status: mysqlEnum("status", ["active", "rolled_back", "superseded"]).default("active").notNull(),
  isKnownGood: int("isKnownGood").default(0).notNull(), // 1 = validated as working
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type SystemSnapshot = typeof systemSnapshots.$inferSelect;
export type InsertSystemSnapshot = typeof systemSnapshots.$inferInsert;

/**
 * Snapshot files — individual file contents captured in a snapshot.
 */
export const snapshotFiles = mysqlTable("snapshot_files", {
  id: int("id").autoincrement().primaryKey(),
  snapshotId: int("snapshotId").notNull(),
  filePath: varchar("filePath", { length: 512 }).notNull(),
  contentHash: varchar("contentHash", { length: 64 }).notNull(), // SHA-256
  content: text("content").notNull(), // full file content
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type SnapshotFile = typeof snapshotFiles.$inferSelect;
export type InsertSnapshotFile = typeof snapshotFiles.$inferInsert;

/**
 * Self-modification log — audit trail of every change the system makes to itself.
 */
export const selfModificationLog = mysqlTable("self_modification_log", {
  id: int("id").autoincrement().primaryKey(),
  snapshotId: int("snapshotId"), // snapshot taken before this change
  requestedBy: varchar("requestedBy", { length: 64 }).notNull(), // "titan_assistant", "admin"
  userId: int("userId"), // who triggered it
  action: mysqlEnum("action", [
    "modify_file",
    "create_file",
    "delete_file",
    "modify_config",
    "add_dependency",
    "restart_service",
    "rollback",
    "validate",
  ]).notNull(),
  targetFile: varchar("targetFile", { length: 512 }),
  description: text("description").notNull(),
  validationResult: mysqlEnum("validationResult", ["passed", "failed", "skipped"]),
  applied: int("applied").default(0).notNull(), // 1 = change was applied
  rolledBack: int("rolledBack").default(0).notNull(), // 1 = change was rolled back
  errorMessage: text("errorMessage"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type SelfModificationLogEntry = typeof selfModificationLog.$inferSelect;
export type InsertSelfModificationLogEntry = typeof selfModificationLog.$inferInsert;

// ─── Chat Conversations ──────────────────────────────────────────
export const chatConversations = mysqlTable("chat_conversations", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  title: varchar("title", { length: 255 }).notNull().default("New Conversation"),
  pinned: int("pinned").default(0).notNull(), // 1 = pinned
  archived: int("archived").default(0).notNull(), // 1 = archived
  messageCount: int("messageCount").default(0).notNull(),
  lastMessageAt: timestamp("lastMessageAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type ChatConversation = typeof chatConversations.$inferSelect;
export type InsertChatConversation = typeof chatConversations.$inferInsert;

// ─── Chat Messages ───────────────────────────────────────────────
export const chatMessages = mysqlTable("chat_messages", {
  id: int("id").autoincrement().primaryKey(),
  conversationId: int("conversationId").notNull(),
  userId: int("userId").notNull(),
  role: mysqlEnum("role", ["user", "assistant", "system", "tool"]).notNull(),
  content: text("content").notNull(),
  toolCalls: json("toolCalls").$type<Array<{ name: string; args: Record<string, unknown>; result: unknown }>>(),
  actionsTaken: json("actionsTaken").$type<Array<{ tool: string; success: boolean; summary: string }>>(),
  tokenCount: int("tokenCount"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type ChatMessage = typeof chatMessages.$inferSelect;
export type InsertChatMessage = typeof chatMessages.$inferInsert;

// ─── V6.0: Builder Activity Log ──────────────────────────────────────

export const builderActivityLog = mysqlTable("builder_activity_log", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  tool: varchar("tool", { length: 64 }).notNull(), // self_type_check, self_run_tests, self_multi_file_modify
  status: mysqlEnum("status", ["success", "failure", "error"]).notNull(),
  summary: text("summary"), // e.g. "TypeScript: 0 errors", "Tests: 582 passed"
  durationMs: int("durationMs"), // execution time in milliseconds
  details: json("details").$type<Record<string, unknown>>(), // extra context (error output, file list, etc.)
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type BuilderActivity = typeof builderActivityLog.$inferSelect;
export type InsertBuilderActivity = typeof builderActivityLog.$inferInsert;

// ─── Self-Improvement Task Backlog ───────────────────────────────────
export const improvementTasks = mysqlTable("improvement_tasks", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 256 }).notNull(),
  description: text("description").notNull(),
  category: mysqlEnum("category", [
    "performance",
    "security",
    "ux",
    "feature",
    "reliability",
    "testing",
    "infrastructure",
  ]).notNull(),
  priority: mysqlEnum("priority", ["critical", "high", "medium", "low"]).notNull().default("medium"),
  status: mysqlEnum("status", ["pending", "in_progress", "completed", "failed", "skipped"]).notNull().default("pending"),
  complexity: mysqlEnum("complexity", ["trivial", "small", "medium", "large", "epic"]).notNull().default("medium"),
  estimatedFiles: int("estimatedFiles").default(1),
  assignedBy: mysqlEnum("assignedBy", ["system", "admin", "titan"]).notNull().default("system"),
  completedAt: timestamp("completedAt"),
  completionNotes: text("completionNotes"),
  snapshotId: int("snapshotId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type ImprovementTask = typeof improvementTasks.$inferSelect;
export type InsertImprovementTask = typeof improvementTasks.$inferInsert;

// ─── Credit System ───────────────────────────────────────────────────

/**
 * Credit balances per user — tracks current credits and lifetime usage.
 * Admin users are flagged as unlimited and bypass all credit checks.
 */
export const creditBalances = mysqlTable("credit_balances", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  credits: int("credits").notNull().default(0),
  lifetimeCreditsUsed: int("lifetimeCreditsUsed").notNull().default(0),
  lifetimeCreditsAdded: int("lifetimeCreditsAdded").notNull().default(0),
  isUnlimited: boolean("isUnlimited").notNull().default(false), // admin bypass
  lastRefillAt: timestamp("lastRefillAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type CreditBalance = typeof creditBalances.$inferSelect;
export type InsertCreditBalance = typeof creditBalances.$inferInsert;

/**
 * Credit transaction log — every credit add/consume is recorded.
 */
export const creditTransactions = mysqlTable("credit_transactions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  amount: int("amount").notNull(), // positive = added, negative = consumed
  type: mysqlEnum("type", [
    "signup_bonus",
    "monthly_refill",
    "pack_purchase",
    "admin_adjustment",
    "chat_message",
    "builder_action",
    "voice_action",
    "referral_bonus",
  ]).notNull(),
  description: text("description"),
  balanceAfter: int("balanceAfter").notNull(),
  stripePaymentIntentId: varchar("stripePaymentIntentId", { length: 256 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type CreditTransaction = typeof creditTransactions.$inferSelect;
export type InsertCreditTransaction = typeof creditTransactions.$inferInsert;

// ─── Desktop Licenses ───────────────────────────────────────────────

/**
 * Desktop app license keys — issued on activation, validated on each launch.
 * Admin users get unlimited licenses. Paid users get licenses tied to their plan.
 * Each device gets a unique license; users can deactivate old devices.
 */
export const desktopLicenses = mysqlTable("desktop_licenses", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  deviceId: varchar("deviceId", { length: 128 }).notNull(), // unique per machine
  deviceName: varchar("deviceName", { length: 256 }), // e.g. "John's MacBook Pro"
  platform: varchar("platform", { length: 32 }).notNull(), // "win32", "darwin", "linux"
  licenseKey: varchar("licenseKey", { length: 512 }).notNull(), // JWT token
  status: mysqlEnum("status", ["active", "revoked", "expired"]).default("active").notNull(),
  lastValidatedAt: timestamp("lastValidatedAt"),
  lastIpAddress: varchar("lastIpAddress", { length: 64 }),
  activatedAt: timestamp("activatedAt").defaultNow().notNull(),
  expiresAt: timestamp("expiresAt").notNull(), // 30 days, auto-refreshed
  revokedAt: timestamp("revokedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type DesktopLicense = typeof desktopLicenses.$inferSelect;
export type InsertDesktopLicense = typeof desktopLicenses.$inferInsert;

// ─── V7.1: Credential Import History ────────────────────────────
export const credentialImports = mysqlTable("credential_imports", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  source: varchar("source", { length: 64 }).notNull(), // "1password", "lastpass", "bitwarden", "csv"
  fileName: varchar("fileName", { length: 256 }),
  totalEntries: int("totalEntries").default(0).notNull(),
  importedCount: int("importedCount").default(0).notNull(),
  skippedCount: int("skippedCount").default(0).notNull(),
  errorCount: int("errorCount").default(0).notNull(),
  status: mysqlEnum("status", ["pending", "processing", "completed", "failed"]).default("pending").notNull(),
  errorDetails: json("errorDetails").$type<string[]>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type CredentialImport = typeof credentialImports.$inferSelect;
export type InsertCredentialImport = typeof credentialImports.$inferInsert;

// ─── V7.1: TOTP Vault (external service authenticator codes) ────
export const totpSecrets = mysqlTable("totp_secrets", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 256 }).notNull(), // e.g. "GitHub", "AWS Console"
  issuer: varchar("issuer", { length: 256 }), // e.g. "GitHub"
  encryptedSecret: text("encryptedSecret").notNull(), // AES-256 encrypted TOTP secret
  algorithm: varchar("algorithm", { length: 16 }).default("SHA1"), // SHA1, SHA256, SHA512
  digits: int("digits").default(6).notNull(), // 6 or 8
  period: int("period").default(30).notNull(), // seconds
  iconUrl: varchar("iconUrl", { length: 512 }),
  tags: json("tags").$type<string[]>(),
  lastUsedAt: timestamp("lastUsedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type TotpSecret = typeof totpSecrets.$inferSelect;
export type InsertTotpSecret = typeof totpSecrets.$inferInsert;

// ─── V7.1: Notification Channels (Slack/Discord webhooks) ──────
export const notificationChannels = mysqlTable("notification_channels", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 128 }).notNull(),
  type: mysqlEnum("type", ["slack", "discord", "email"]).notNull(),
  webhookUrl: text("webhookUrl"), // Slack/Discord webhook URL
  emailAddress: varchar("emailAddress", { length: 320 }),
  events: json("events").$type<string[]>().notNull(), // events to subscribe to
  active: boolean("active").default(true).notNull(),
  lastNotifiedAt: timestamp("lastNotifiedAt"),
  failCount: int("failCount").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type NotificationChannel = typeof notificationChannels.$inferSelect;
export type InsertNotificationChannel = typeof notificationChannels.$inferInsert;

// ==========================================
// GRANT FINDER + CROWDFUNDING TABLES
// ==========================================

export const companies = mysqlTable("companies", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id),
  name: varchar("name", { length: 255 }).notNull(),
  industry: varchar("industry", { length: 255 }),
  technologyArea: text("technologyArea"),
  employeeCount: int("employeeCount"),
  annualRevenue: int("annualRevenue"),
  foundedYear: int("foundedYear"),
  location: varchar("location", { length: 255 }),
  minorityOwned: int("minorityOwned").default(0),
  womenOwned: int("womenOwned").default(0),
  veteranOwned: int("veteranOwned").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type Company = typeof companies.$inferSelect;
export type InsertCompany = typeof companies.$inferInsert;

export const businessPlans = mysqlTable("businessPlans", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull().references(() => companies.id),
  title: varchar("title", { length: 255 }).notNull(),
  executiveSummary: text("executiveSummary"),
  technologyDescription: text("technologyDescription"),
  marketAnalysis: text("marketAnalysis"),
  competitiveAnalysis: text("competitiveAnalysis"),
  teamQualifications: text("teamQualifications"),
  researchPlan: text("researchPlan"),
  commercializationStrategy: text("commercializationStrategy"),
  financialProjections: text("financialProjections"),
  ipStrategy: text("ipStrategy"),
  version: int("version").default(1).notNull(),
  status: mysqlEnum("status", ["draft", "completed", "archived"]).default("draft").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type BusinessPlan = typeof businessPlans.$inferSelect;
export type InsertBusinessPlan = typeof businessPlans.$inferInsert;

export const grantOpportunities = mysqlTable("grantOpportunities", {
  id: int("id").autoincrement().primaryKey(),
  agency: varchar("agency", { length: 255 }).notNull(),
  programName: varchar("programName", { length: 255 }).notNull(),
  opportunityNumber: varchar("opportunityNumber", { length: 255 }),
  title: text("title").notNull(),
  description: text("description"),
  focusAreas: text("focusAreas"),
  region: varchar("region", { length: 50 }).default("USA").notNull(),
  country: varchar("country", { length: 100 }),
  minAmount: int("minAmount"),
  maxAmount: int("maxAmount"),
  phase: varchar("phase", { length: 50 }),
  eligibilityCriteria: text("eligibilityCriteria"),
  applicationDeadline: timestamp("applicationDeadline"),
  openDate: timestamp("openDate"),
  closeDate: timestamp("closeDate"),
  estimatedAwards: int("estimatedAwards"),
  competitiveness: varchar("competitiveness", { length: 50 }),
  url: text("url"),
  status: mysqlEnum("status", ["open", "closed", "upcoming"]).default("open").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type GrantOpportunity = typeof grantOpportunities.$inferSelect;
export type InsertGrantOpportunity = typeof grantOpportunities.$inferInsert;

export const grantApplications = mysqlTable("grantApplications", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull().references(() => companies.id),
  businessPlanId: int("businessPlanId").references(() => businessPlans.id),
  grantOpportunityId: int("grantOpportunityId").notNull().references(() => grantOpportunities.id),
  technicalAbstract: text("technicalAbstract"),
  projectDescription: text("projectDescription"),
  specificAims: text("specificAims"),
  innovation: text("innovation"),
  approach: text("approach"),
  commercializationPlan: text("commercializationPlan"),
  budget: text("budget"),
  budgetJustification: text("budgetJustification"),
  timeline: text("timeline"),
  successProbability: int("successProbability"),
  expectedValue: int("expectedValue"),
  qualityScore: int("qualityScore"),
  priority: int("priority"),
  status: mysqlEnum("status", ["draft", "ready", "submitted", "under_review", "awarded", "rejected"]).default("draft").notNull(),
  submittedAt: timestamp("submittedAt"),
  decisionDate: timestamp("decisionDate"),
  awardAmount: int("awardAmount"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type GrantApplication = typeof grantApplications.$inferSelect;
export type InsertGrantApplication = typeof grantApplications.$inferInsert;

export const grantMatches = mysqlTable("grantMatches", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull().references(() => companies.id),
  grantOpportunityId: int("grantOpportunityId").notNull().references(() => grantOpportunities.id),
  matchScore: int("matchScore").notNull(),
  eligibilityScore: int("eligibilityScore").notNull(),
  alignmentScore: int("alignmentScore").notNull(),
  competitivenessScore: int("competitivenessScore").notNull(),
  recommendationReason: text("recommendationReason"),
  estimatedSuccessProbability: int("estimatedSuccessProbability"),
  expectedValue: int("expectedValue"),
  isRecommended: int("isRecommended").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type GrantMatch = typeof grantMatches.$inferSelect;
export type InsertGrantMatch = typeof grantMatches.$inferInsert;

export const crowdfundingCampaigns = mysqlTable("crowdfundingCampaigns", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id),
  companyId: int("companyId").references(() => companies.id),
  title: varchar("title", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  description: text("description"),
  story: text("story"),
  category: varchar("category", { length: 100 }),
  goalAmount: int("goalAmount").notNull(),
  currentAmount: int("currentAmount").default(0).notNull(),
  currency: varchar("currency", { length: 3 }).default("USD").notNull(),
  backerCount: int("backerCount").default(0).notNull(),
  imageUrl: varchar("imageUrl", { length: 500 }),
  videoUrl: varchar("videoUrl", { length: 500 }),
  startDate: timestamp("startDate").notNull(),
  endDate: timestamp("endDate").notNull(),
  status: mysqlEnum("status", ["draft", "active", "funded", "ended", "cancelled"]).default("draft").notNull(),
  featured: int("featured").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type CrowdfundingCampaign = typeof crowdfundingCampaigns.$inferSelect;
export type InsertCrowdfundingCampaign = typeof crowdfundingCampaigns.$inferInsert;

export const crowdfundingRewards = mysqlTable("crowdfundingRewards", {
  id: int("id").autoincrement().primaryKey(),
  campaignId: int("campaignId").notNull().references(() => crowdfundingCampaigns.id),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  minAmount: int("minAmount").notNull(),
  maxClaims: int("maxClaims"),
  claimedCount: int("claimedCount").default(0).notNull(),
  estimatedDelivery: timestamp("estimatedDelivery"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type CrowdfundingReward = typeof crowdfundingRewards.$inferSelect;
export type InsertCrowdfundingReward = typeof crowdfundingRewards.$inferInsert;

export const crowdfundingContributions = mysqlTable("crowdfundingContributions", {
  id: int("id").autoincrement().primaryKey(),
  campaignId: int("campaignId").notNull().references(() => crowdfundingCampaigns.id),
  userId: int("userId").references(() => users.id),
  amount: int("amount").notNull(),
  currency: varchar("currency", { length: 3 }).default("USD").notNull(),
  stripePaymentIntentId: varchar("stripePaymentIntentId", { length: 255 }),
  status: mysqlEnum("status", ["pending", "completed", "failed", "refunded"]).default("pending").notNull(),
  backerName: varchar("backerName", { length: 255 }),
  backerEmail: varchar("backerEmail", { length: 320 }),
  message: text("message"),
  anonymous: int("anonymous").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type CrowdfundingContribution = typeof crowdfundingContributions.$inferSelect;
export type InsertCrowdfundingContribution = typeof crowdfundingContributions.$inferInsert;

export const crowdfundingUpdates = mysqlTable("crowdfundingUpdates", {
  id: int("id").autoincrement().primaryKey(),
  campaignId: int("campaignId").notNull().references(() => crowdfundingCampaigns.id),
  title: varchar("title", { length: 255 }).notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type CrowdfundingUpdate = typeof crowdfundingUpdates.$inferSelect;
export type InsertCrowdfundingUpdate = typeof crowdfundingUpdates.$inferInsert;
