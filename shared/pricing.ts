/**
 * Centralized pricing configuration for Archibald Titan.
 * Products and prices are defined here for consistency across frontend and backend.
 *
 * CREDIT PHILOSOPHY:
 * - Paying users should get generous, fair value for their money.
 * - A Pro user ($29/mo) should be able to use the platform daily without worrying about credits.
 * - An Enterprise user ($99/mo) should never hit a limit in normal usage.
 * - Credit costs are kept low so users feel empowered, not restricted.
 * - Top-up packs exist for users who run out mid-month but don't want to upgrade yet.
 * - Top-up packs are intentionally more expensive per-credit than upgrading — this makes
 *   upgrading the obvious better deal and drives conversions.
 *
 * TIER STRUCTURE:
 * Pro -> Enterprise -> Cyber (public tiers)
 * Cyber+ and Titan are internal/enterprise tiers, not shown in the public pricing UI.
 *
 * CREDIT ALLOCATION (aligned with pricing page advertising):
 * - Free:       500 credits/mo  (50 signup bonus)
 * - Pro:        50,000 credits/mo  (1,000 signup bonus)   — ~1,000 builder tasks/mo
 * - Enterprise: 250,000 credits/mo (5,000 signup bonus)   — ~5,000 builder tasks/mo
 * - Cyber:      750,000 credits/mo (25,000 signup bonus)  — heavy security usage
 * - Cyber+:     3,000,000 credits/mo (100,000 signup bonus)
 * - Titan:      10,000,000 credits/mo (500,000 signup bonus)
 *
 * UPGRADE INCENTIVE MATH:
 * - Top-up 50,000 credits = $29.99 (same price as Pro monthly!)
 * - Pro gives 50,000 credits/mo for $29/mo — clearly better value than buying a top-up
 * - Top-up 100,000 credits = $54.99 — Enterprise gives 250,000 for $99/mo (5x more credits)
 * - This pricing structure naturally pushes heavy users toward upgrading.
 */

export type PlanId = "free" | "pro" | "enterprise" | "cyber" | "cyber_plus" | "titan";

export interface PricingTier {
  id: PlanId;
  name: string;
  tagline: string;
  monthlyPrice: number; // in USD, 0 = free
  yearlyPrice: number;  // in USD, 0 = free
  features: string[];
  highlighted: boolean;
  cta: string;
  limits: {
    fetchesPerMonth: number;    // -1 = unlimited
    providers: number;          // -1 = all
    credentialStorage: number;  // -1 = unlimited
    proxySlots: number;         // 0 = none
    exportFormats: string[];
    support: string;
  };
  credits: {
    monthlyAllocation: number;  // credits added each month, -1 = unlimited
    signupBonus: number;        // one-time bonus on first signup
  };
}

export const PRICING_TIERS: PricingTier[] = [
  // --- FREE ----
  {
    id: "free",
    name: "Free",
    tagline: "Get started with the basics",
    monthlyPrice: 0,
    yearlyPrice: 0,
    highlighted: false,
    cta: "Get Started",
    features: [
      "500 credits/month",
      "Basic credential fetching (3 providers)",
      "JSON export only",
      "Community support",
    ],
    limits: {
      fetchesPerMonth: 10,
      providers: 3,
      credentialStorage: 5,
      proxySlots: 0,
      exportFormats: ["json"],
      support: "community",
    },
    credits: {
      monthlyAllocation: 500,
      signupBonus: 50,
    },
  },

  // --- PRO ----
  {
    id: "pro",
    name: "Pro",
    tagline: "For power users and professionals",
    monthlyPrice: 29,
    yearlyPrice: 290,
    highlighted: true,
    cta: "Upgrade to Pro",
    features: [
      "50,000 credits/month (~1,000 builder tasks/mo)",
      "Titan Builder (unlimited chat & code)",
      "Unlimited fetches & all 15+ providers",
      "Unlimited credential storage",
      "Advanced stealth browser + CAPTCHA solving",
      "5 proxy slots",
      "JSON & .ENV export",
      "Scheduled fetches & advanced automation",
      "Sandbox + unlimited projects",
      "Grand Bazaar (buy & sell)",
      "Seller Dashboard & inventory",
      "Smart Fetch AI",
      "Expiry Watchdog",
      "Provider Health monitoring",
      "Credential History & Audit Logs",
      "Auto-Sync & Bulk Sync",
      "Browse & apply for grants",
      "Company profiles & business plans",
      "Crowdfunding campaigns",
      "Referral program",
      "Site Monitor",
      "Webhooks & Notifications",
      "Developer API (100 req/day)",
      "API key management",
      "CLI Tool",
      "Priority email support",
    ],
    limits: {
      fetchesPerMonth: -1,
      providers: -1,
      credentialStorage: -1,
      proxySlots: 5,
      exportFormats: ["json", "env"],
      support: "priority_email",
    },
    credits: {
      monthlyAllocation: 50000,
      signupBonus: 1000,
    },
  },

  // --- ENTERPRISE ----
  {
    id: "enterprise",
    name: "Enterprise",
    tagline: "For organizations at scale",
    monthlyPrice: 99,
    yearlyPrice: 990,
    highlighted: false,
    cta: "Upgrade to Enterprise",
    features: [
      "250,000 credits/month (~5,000 builder tasks)",
      "Everything in Pro, plus:",
      "Unlimited proxy slots",
      "Team management (up to 25 seats)",
      "Team Vault (shared credentials)",
      "Developer API (10,000 req/day)",
      "API Analytics dashboard",
      "Webhook integrations",
      "Custom provider integrations",
      "Health Trends analytics",
      "Provider Onboarding wizard",
      "Import/Export all formats",
      "SEO Command Center",
      "Blog Engine",
      "Marketing Engine",
      "Advertising dashboard",
      "Affiliate dashboard",
      "SSO / SAML authentication",
      "Audit logs (90-day retention)",
      "SLA guarantee (99.9% uptime)",
      "White-label option",
      "Dedicated account manager",
    ],
    limits: {
      fetchesPerMonth: -1,
      providers: -1,
      credentialStorage: -1,
      proxySlots: -1,
      exportFormats: ["json", "env", "csv", "api"],
      support: "dedicated",
    },
    credits: {
      monthlyAllocation: 250000,
      signupBonus: 5000,
    },
  },

  // --- CYBER ----
  {
    id: "cyber",
    name: "Cyber",
    tagline: "Elite cybersecurity arsenal for professionals",
    monthlyPrice: 199,
    yearlyPrice: 1990,
    highlighted: false,
    cta: "Unlock Cyber",
    features: [
      "750,000 credits/month",
      "Everything in Enterprise, plus:",
      "TOTP Vault (2FA management)",
      "Credential Leak Scanner",
      "Credential Health Monitor",
      "Advanced threat modeling",
      "Vulnerability auto-fixer",
      "Security code review",
      "Red team automation",
      "Audit logs (1-year retention)",
      "Priority security support",
    ],
    limits: {
      fetchesPerMonth: -1,
      providers: -1,
      credentialStorage: -1,
      proxySlots: -1,
      exportFormats: ["json", "env", "csv", "api"],
      support: "priority_security",
    },
    credits: {
      monthlyAllocation: 750000,
      signupBonus: 25000,
    },
  },

];

/**
 * Internal tiers (Cyber+, Titan) -- used for admin/referral unlocks and feature gating.
 * Not shown in the public pricing UI. The PRICING_TIERS array above is the source of truth
 * for what users see on the pricing page.
 */
export const INTERNAL_TIERS: PricingTier[] = [
  // --- CYBER+ (internal tier) ----
  {
    id: "cyber_plus",
    name: "Cyber+",
    tagline: "Maximum firepower for security teams and agencies",
    monthlyPrice: 499,
    yearlyPrice: 4990,
    highlighted: false,
    cta: "Go Cyber+",
    features: [
      "3,000,000 credits/month",
      "Everything in Cyber, plus:",
      "Website Clone Engine (exclusive)",
      "Unlimited team seats",
      "Zero-click exploit research",
      "C2 framework building",
      "Offensive security tooling",
      "Custom AI model fine-tuning",
      "Dedicated infrastructure",
      "Developer API (unlimited req/day)",
      "Multi-org management",
      "Volume discount on credit top-ups",
      "Direct Slack/Teams support channel",
    ],
    limits: {
      fetchesPerMonth: -1,
      providers: -1,
      credentialStorage: -1,
      proxySlots: -1,
      exportFormats: ["json", "env", "csv", "api"],
      support: "dedicated_slack",
    },
    credits: {
      monthlyAllocation: 3000000,
      signupBonus: 100000,
    },
  },

  // --- TITAN (internal tier) ----
  {
    id: "titan",
    name: "Titan",
    tagline: "Unlimited power for large-scale enterprise operations",
    monthlyPrice: 4999,
    yearlyPrice: 49990,
    highlighted: false,
    cta: "Contact Sales",
    features: [
      "10,000,000 credits/month",
      "Everything in Cyber+, plus:",
      "Dedicated GPU cluster",
      "Custom model training on your data",
      "On-premise deployment option",
      "24/7 phone support",
      "Quarterly business reviews",
      "Custom SLA (99.99% uptime)",
      "Compliance certifications (SOC2, ISO 27001)",
      "Data residency options",
      "Priority feature development",
      "White-glove onboarding",
      "Early access to all new features",
    ],
    limits: {
      fetchesPerMonth: -1,
      providers: -1,
      credentialStorage: -1,
      proxySlots: -1,
      exportFormats: ["json", "env", "csv", "api"],
      support: "white_glove",
    },
    credits: {
      monthlyAllocation: 10000000,
      signupBonus: 500000,
    },
  },
];

// --- Credit Costs ----
//
// COST PHILOSOPHY (rebalanced to match actual allocations):
// - Pro user (50,000 credits/mo) should get ~1,000 builder tasks/mo = 50 credits/task.
// - A typical builder request (7-12 tool calls) costs ~350-600 credits total.
// - Chat messages are cheap so users never hesitate to ask questions.
// - Heavy compute (image, video, security exploits) costs proportionally more.
// - A Pro user can send ~5,000 chat messages OR ~1,000 builder tasks per month.
// - Enterprise (250,000 credits/mo) = ~5,000 builder tasks -- power user territory.
//
// WEIGHT TIERS:
//   Micro    (5)   -- Single API ping, passive lookup
//   Light    (15)  -- Simple fetch, sync, short AI call
//   Standard (25)  -- Chat message, voice, basic AI action
//   Medium   (75)  -- Full tool call, GitHub op, credential fetch
//   Heavy    (150) -- SEO run, blog gen, security scan, site monitor
//   Intense  (300) -- VPN/proxy build, marketing run, grant apply
//   Power    (500) -- Image gen, business plan, Blackeye session
//   Elite    (750) -- Evilginx full session, advanced exploit
//   Max      (1000)-- Metasploit chain, full site clone, video gen
//   Extreme  (2000)-- Full site replication job
//
// ONE ACTION = ONE CHARGE:
//   Internal sub-calls (SSH hops, API retries, tool iterations) within a
//   single user-initiated action do NOT add extra charges. The router
//   deducts once at the top of the action, before execution begins.
//   For complexity-scaled actions (e.g. VPN hop count), use consumeCreditsAmount().

export const CREDIT_COSTS = {
  // Core AI
  chat_message: 10,
  builder_action: 50,
  voice_action: 25,
  image_generation: 500,
  video_generation: 1000,

  // Credential & Fetch
  fetch_action: 5,
  github_action: 75,
  import_action: 25,

  // Clone & Replicate
  clone_action: 1000,
  replicate_action: 1000,

  // SEO & Content
  seo_run: 150,
  blog_generate: 150,
  content_generate: 75,
  marketing_run: 300,
  advertising_run: 300,

  // Security Tools (Cyber tier)
  security_scan: 150,
  metasploit_action: 1000,
  evilginx_action: 750,
  blackeye_action: 500,

  // VPN & Proxies
  vpn_generate: 300,

  // Grants & Business
  grant_match: 75,
  grant_apply: 300,
  business_plan_generate: 500,

  // Marketplace
  marketplace_list: 25,
  marketplace_feature: 150,

  // Site Monitor & Sandbox
  site_monitor_add: 25,
  sandbox_run: 75,

  // Affiliate & API
  affiliate_action: 15,
  api_call: 5,

  // Content Creator
  content_campaign_create: 50,
  content_bulk_generate: 200,
  content_seo_brief: 100,

  // Marketplace Intelligence
  marketplace_ai_describe: 50,
  marketplace_ai_price: 25,

  // Security / Astra
  astra_scan: 200,
  exploit_exec: 500,
  exploit_cve_search: 50,

  // BIN Checker
  bin_lookup: 5,
  bin_bulk_lookup: 50,
  bin_reverse_search: 25,
  card_live_check: 50,

  // Proxy & IP Rotation
  proxy_test: 10,
  proxy_test_all: 75,
  proxy_scrape: 50,
  ip_rotation_circuit: 25,

  // Web Agent
  web_agent_task: 150,

  // TOR / Anonymity
  tor_new_circuit: 25,
  tor_run_command: 75,

  // Credential Health
  credential_breach_check: 25,

  // TOTP Vault
  totp_code_generate: 5,

  // VPN Chain
  vpn_chain_build: 500,
  vpn_chain_config: 150,

  // Isolated Browser
  isolated_browser_session: 200,

  // Site Monitor
  site_monitor_check: 10,

  // Proxy
  proxy_add: 10,

  // Linken Sphere
  linken_session_start: 50,
  linken_quick_create: 25,

  // CyberMCP
  cybermcp_scan: 150,

  // Red Team & Advanced Security
  red_team_run: 500,
  compliance_report: 200,
  siem_config: 25,
  siem_test: 75,
  event_bus_rule: 15,
  security_module_install: 50,
} as const;

export type CreditActionType = keyof typeof CREDIT_COSTS;

// --- Credit Top-Up Packs (one-time purchases) ----

export interface CreditPack {
  id: string;
  name: string;
  credits: number;
  price: number; // USD
  popular?: boolean;
  upgradeNudge?: string;
}

export const CREDIT_PACKS: CreditPack[] = [
  {
    id: "pack_500",
    name: "Quick Top-Up",
    credits: 10000,
    price: 4.99,
    upgradeNudge: undefined,
  },
  {
    id: "pack_2500",
    name: "Boost Pack",
    credits: 25000,
    price: 9.99,
    popular: true,
    upgradeNudge: "Pro gives 50,000 credits/mo for just $29 -- 2x the credits every month!",
  },
  {
    id: "pack_5000",
    name: "Power Top-Up",
    credits: 50000,
    price: 17.99,
    upgradeNudge: "Pro gives the same 50,000 credits every month for $29/mo -- upgrade and save!",
  },
  {
    id: "pack_10000",
    name: "Mega Top-Up",
    credits: 150000,
    price: 49.99,
    upgradeNudge: "Enterprise gives 250,000 credits/mo for $99 -- 5x more credits! Upgrading saves you money.",
  },
];

// --- Credit Escalation Funnel ----

export interface PlanDoubleStep {
  basePlanId: string;
  basePriceUsd: number;
  doubledPriceUsd: number;
  doubledCredits: number;
  stripePriceId?: string;
  label: string;
  description: string;
}

export const PLAN_DOUBLE_MAP: Record<string, PlanDoubleStep> = {
  pro: {
    basePlanId: "pro",
    basePriceUsd: 29,
    doubledPriceUsd: 58,
    doubledCredits: 100000,
    label: "Pro 2x",
    description: "Double your Pro plan -- 100,000 credits for $58/mo until your cycle resets",
  },
  enterprise: {
    basePlanId: "enterprise",
    basePriceUsd: 99,
    doubledPriceUsd: 198,
    doubledCredits: 500000,
    label: "Enterprise 2x",
    description: "Double your Enterprise plan -- 500,000 credits for $198/mo until your cycle resets",
  },
  cyber: {
    basePlanId: "cyber",
    basePriceUsd: 199,
    doubledPriceUsd: 398,
    doubledCredits: 1500000,
    label: "Cyber 2x",
    description: "Double your Cyber plan -- 1,500,000 credits for $398/mo until your cycle resets",
  },
  cyber_plus: {
    basePlanId: "cyber_plus",
    basePriceUsd: 499,
    doubledPriceUsd: 998,
    doubledCredits: 6000000,
    label: "Cyber+ 2x",
    description: "Double your Cyber+ plan -- 6,000,000 credits for $998/mo until your cycle resets",
  },
  titan: {
    basePlanId: "titan",
    basePriceUsd: 4999,
    doubledPriceUsd: 9998,
    doubledCredits: 20000000,
    label: "Titan 2x",
    description: "Double your Titan plan -- 20,000,000 credits for $9,998/mo until your cycle resets",
  },
};

export const MAX_BOOST_PACKS_PER_CYCLE = 3;
export const MAX_DOUBLES_PER_CYCLE = 3;

// --- Daily Free Credits (Free Tier Only) ----

export const DAILY_FREE_CREDITS_AMOUNT = 375;
export const DAILY_FREE_CREDITS_RESET_HOURS = 24;
export const DAILY_FREE_CREDITS_PLAN = "free";

// --- Clone Website Pricing (per-use, billed via Stripe) ----

export type CloneComplexity = "simple" | "standard" | "advanced" | "enterprise";

export interface ClonePricingTier {
  id: CloneComplexity;
  name: string;
  description: string;
  price: number;
  titanPrice: number;
  maxPages: number;
  features: string[];
}

export const CLONE_PRICING: ClonePricingTier[] = [
  {
    id: "simple",
    name: "Simple Clone",
    description: "Landing pages, portfolios, brochure sites",
    price: 500,
    titanPrice: 350,
    maxPages: 5,
    features: [
      "Up to 5 pages",
      "Responsive design",
      "Your branding & colors",
      "Contact form",
      "SEO meta tags",
      "GitHub repo + deploy ready",
    ],
  },
  {
    id: "standard",
    name: "Standard Clone",
    description: "Business websites, blogs, multi-page sites",
    price: 1000,
    titanPrice: 700,
    maxPages: 15,
    features: [
      "Up to 15 pages",
      "Everything in Simple",
      "Blog / news section",
      "Dynamic content areas",
      "Multiple forms",
      "Image gallery",
      "Newsletter signup",
    ],
  },
  {
    id: "advanced",
    name: "Advanced Clone",
    description: "E-commerce, SaaS, marketplace sites",
    price: 2000,
    titanPrice: 1400,
    maxPages: 50,
    features: [
      "Up to 50 pages",
      "Everything in Standard",
      "Stripe payment integration",
      "Product catalog",
      "Shopping cart & checkout",
      "User authentication",
      "Dashboard / admin panel",
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise Clone",
    description: "Complex web applications, multi-feature platforms",
    price: 3500,
    titanPrice: 2500,
    maxPages: -1,
    features: [
      "Unlimited pages",
      "Everything in Advanced",
      "Custom API integrations",
      "Multi-role user system",
      "Advanced admin panels",
      "Real-time features",
      "Priority build queue",
    ],
  },
];

export function detectCloneComplexity(pageCount: number, hasPayments: boolean, hasAuth: boolean): CloneComplexity {
  if (hasPayments || hasAuth || pageCount > 50) return "enterprise";
  if (pageCount > 15) return "advanced";
  if (pageCount > 5) return "standard";
  return "simple";
}

// --- Feature Comparison Matrix ----

export interface ComparisonFeature {
  name: string;
  category: string;
  free?: string | boolean;
  pro: string | boolean;
  enterprise: string | boolean;
  cyber: string | boolean;
  cyber_plus: string | boolean;
  titan: string | boolean;
}

export const COMPARISON_FEATURES: ComparisonFeature[] = [
  // AI & Builder
  { name: "Monthly credits", category: "AI & Builder", free: "500", pro: "50,000", enterprise: "250,000", cyber: "750,000", cyber_plus: "3,000,000", titan: "10,000,000" },
  { name: "Titan Builder (AI chat & code)", category: "AI & Builder", pro: "Unlimited", enterprise: "Unlimited", cyber: "Unlimited", cyber_plus: "Unlimited", titan: "Unlimited" },
  { name: "Sandbox environment", category: "AI & Builder", pro: true, enterprise: true, cyber: true, cyber_plus: true, titan: true },
  { name: "My Projects", category: "AI & Builder", pro: "Unlimited", enterprise: "Unlimited", cyber: "Unlimited", cyber_plus: "Unlimited", titan: "Unlimited" },
  { name: "Clone Website", category: "AI & Builder", pro: false, enterprise: false, cyber: false, cyber_plus: true, titan: true },
  { name: "Custom AI model fine-tuning", category: "AI & Builder", pro: false, enterprise: false, cyber: false, cyber_plus: true, titan: true },

  // Credential Management
  { name: "Fetches per month", category: "Credential Management", pro: "Unlimited", enterprise: "Unlimited", cyber: "Unlimited", cyber_plus: "Unlimited", titan: "Unlimited" },
  { name: "Providers", category: "Credential Management", pro: "15+", enterprise: "15+ & custom", cyber: "15+ & custom", cyber_plus: "15+ & custom", titan: "15+ & custom" },
  { name: "Credential storage", category: "Credential Management", pro: "Unlimited", enterprise: "Unlimited", cyber: "Unlimited", cyber_plus: "Unlimited", titan: "Unlimited" },
  { name: "Smart Fetch AI", category: "Credential Management", pro: true, enterprise: true, cyber: true, cyber_plus: true, titan: true },
  { name: "Proxy slots", category: "Credential Management", pro: "5", enterprise: "Unlimited", cyber: "Unlimited", cyber_plus: "Unlimited", titan: "Unlimited" },
  { name: "CAPTCHA auto-solving", category: "Credential Management", pro: true, enterprise: true, cyber: true, cyber_plus: true, titan: true },
  { name: "Scheduled fetches & Auto-Sync", category: "Credential Management", pro: true, enterprise: true, cyber: true, cyber_plus: true, titan: true },
  { name: "Bulk Sync", category: "Credential Management", pro: true, enterprise: true, cyber: true, cyber_plus: true, titan: true },
  { name: "Credential History", category: "Credential Management", pro: true, enterprise: true, cyber: true, cyber_plus: true, titan: true },
  { name: "Expiry Watchdog", category: "Credential Management", pro: true, enterprise: true, cyber: true, cyber_plus: true, titan: true },
  { name: "Provider Health monitoring", category: "Credential Management", pro: true, enterprise: true, cyber: true, cyber_plus: true, titan: true },
  { name: "Provider Onboarding wizard", category: "Credential Management", pro: false, enterprise: true, cyber: true, cyber_plus: true, titan: true },
  { name: "Export formats", category: "Credential Management", pro: "JSON & .ENV", enterprise: "JSON, .ENV, CSV, API", cyber: "JSON, .ENV, CSV, API", cyber_plus: "JSON, .ENV, CSV, API", titan: "JSON, .ENV, CSV, API" },
  { name: "Import credentials", category: "Credential Management", pro: true, enterprise: true, cyber: true, cyber_plus: true, titan: true },

  // Security (Cyber)
  { name: "TOTP Vault (2FA management)", category: "Security", pro: false, enterprise: false, cyber: true, cyber_plus: true, titan: true },
  { name: "Credential Leak Scanner", category: "Security", pro: false, enterprise: false, cyber: true, cyber_plus: true, titan: true },
  { name: "Credential Health Monitor", category: "Security", pro: false, enterprise: false, cyber: true, cyber_plus: true, titan: true },
  { name: "Health Trends analytics", category: "Security", pro: false, enterprise: true, cyber: true, cyber_plus: true, titan: true },
  { name: "Advanced threat modeling", category: "Security", pro: false, enterprise: false, cyber: true, cyber_plus: true, titan: true },
  { name: "Vulnerability auto-fixer", category: "Security", pro: false, enterprise: false, cyber: true, cyber_plus: true, titan: true },
  { name: "Security code review", category: "Security", pro: false, enterprise: false, cyber: true, cyber_plus: true, titan: true },
  { name: "Red team automation", category: "Security", pro: false, enterprise: false, cyber: true, cyber_plus: true, titan: true },
  { name: "Zero-click exploit research", category: "Security", pro: false, enterprise: false, cyber: false, cyber_plus: true, titan: true },
  { name: "C2 framework building", category: "Security", pro: false, enterprise: false, cyber: false, cyber_plus: true, titan: true },
  { name: "Offensive security tooling", category: "Security", pro: false, enterprise: false, cyber: false, cyber_plus: true, titan: true },
  { name: "Site Monitor", category: "Security", pro: true, enterprise: true, cyber: true, cyber_plus: true, titan: true },

  // Marketplace & Business
  { name: "Grand Bazaar (marketplace)", category: "Marketplace & Business", pro: "Buy & sell", enterprise: "Buy & sell", cyber: "Buy & sell", cyber_plus: "Buy & sell", titan: "Buy & sell" },
  { name: "Seller Dashboard & inventory", category: "Marketplace & Business", pro: true, enterprise: true, cyber: true, cyber_plus: true, titan: true },
  { name: "Browse & apply for grants", category: "Marketplace & Business", pro: true, enterprise: true, cyber: true, cyber_plus: true, titan: true },
  { name: "Company profiles & business plans", category: "Marketplace & Business", pro: true, enterprise: true, cyber: true, cyber_plus: true, titan: true },
  { name: "Crowdfunding campaigns", category: "Marketplace & Business", pro: true, enterprise: true, cyber: true, cyber_plus: true, titan: true },
  { name: "Referral program", category: "Marketplace & Business", pro: true, enterprise: true, cyber: true, cyber_plus: true, titan: true },
  { name: "SEO Command Center", category: "Marketplace & Business", pro: false, enterprise: true, cyber: true, cyber_plus: true, titan: true },
  { name: "Blog Engine", category: "Marketplace & Business", pro: false, enterprise: true, cyber: true, cyber_plus: true, titan: true },
  { name: "Marketing Engine", category: "Marketplace & Business", pro: false, enterprise: true, cyber: true, cyber_plus: true, titan: true },
  { name: "Advertising dashboard", category: "Marketplace & Business", pro: false, enterprise: true, cyber: true, cyber_plus: true, titan: true },
  { name: "Affiliate dashboard", category: "Marketplace & Business", pro: false, enterprise: true, cyber: true, cyber_plus: true, titan: true },

  // Team & Collaboration
  { name: "Team management", category: "Team & Collaboration", pro: false, enterprise: "Up to 25 seats", cyber: "Up to 25 seats", cyber_plus: "Unlimited seats", titan: "Unlimited seats" },
  { name: "Team Vault (shared credentials)", category: "Team & Collaboration", pro: false, enterprise: true, cyber: true, cyber_plus: true, titan: true },
  { name: "Multi-org management", category: "Team & Collaboration", pro: false, enterprise: false, cyber: false, cyber_plus: true, titan: true },
  { name: "SSO / SAML authentication", category: "Team & Collaboration", pro: false, enterprise: true, cyber: true, cyber_plus: true, titan: true },

  // Developer & API
  { name: "Developer API", category: "Developer & API", pro: "100 req/day", enterprise: "10,000 req/day", cyber: "10,000 req/day", cyber_plus: "Unlimited", titan: "Unlimited" },
  { name: "API Analytics dashboard", category: "Developer & API", pro: false, enterprise: true, cyber: true, cyber_plus: true, titan: true },
  { name: "Webhooks & Notifications", category: "Developer & API", pro: true, enterprise: true, cyber: true, cyber_plus: true, titan: true },
  { name: "CLI Tool", category: "Developer & API", pro: true, enterprise: true, cyber: true, cyber_plus: true, titan: true },
  { name: "API Docs", category: "Developer & API", pro: true, enterprise: true, cyber: true, cyber_plus: true, titan: true },
  { name: "Audit logs", category: "Developer & API", pro: false, enterprise: "90-day retention", cyber: "1-year retention", cyber_plus: "1-year retention", titan: "Unlimited" },

  // Infrastructure & Support
  { name: "Support", category: "Infrastructure & Support", pro: "Priority email", enterprise: "Dedicated manager", cyber: "Priority security", cyber_plus: "Slack/Teams channel", titan: "24/7 phone + white-glove" },
  { name: "SLA guarantee", category: "Infrastructure & Support", pro: false, enterprise: "99.9%", cyber: "99.9%", cyber_plus: "99.9%", titan: "99.99%" },
  { name: "White-label option", category: "Infrastructure & Support", pro: false, enterprise: true, cyber: true, cyber_plus: true, titan: true },
  { name: "Dedicated infrastructure", category: "Infrastructure & Support", pro: false, enterprise: false, cyber: false, cyber_plus: true, titan: true },
  { name: "On-premise deployment", category: "Infrastructure & Support", pro: false, enterprise: false, cyber: false, cyber_plus: false, titan: true },
  { name: "Compliance certifications", category: "Infrastructure & Support", pro: false, enterprise: false, cyber: false, cyber_plus: false, titan: "SOC2, ISO 27001" },
  { name: "Data residency options", category: "Infrastructure & Support", pro: false, enterprise: false, cyber: false, cyber_plus: false, titan: true },
];
