/**
 * Centralized pricing configuration for Archibald Titan.
 * Products and prices are defined here for consistency across frontend and backend.
 */

export type PlanId = "free" | "pro" | "enterprise";

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
  {
    id: "free",
    name: "Free",
    tagline: "Get started with the basics",
    monthlyPrice: 0,
    yearlyPrice: 0,
    highlighted: false,
    cta: "Get Started Free",
    features: [
      "5 fetches per month",
      "3 providers (AWS, Azure, GCP)",
      "AES-256 encrypted vault",
      "JSON export",
      "Community support",
      "Basic stealth browser",
    ],
    limits: {
      fetchesPerMonth: 5,
      providers: 3,
      credentialStorage: 25,
      proxySlots: 0,
      exportFormats: ["json"],
      support: "community",
    },
    credits: {
      monthlyAllocation: 50,
      signupBonus: 25,
    },
  },
  {
    id: "pro",
    name: "Pro",
    tagline: "For power users and professionals",
    monthlyPrice: 29,
    yearlyPrice: 290,
    highlighted: true,
    cta: "Upgrade to Pro",
    features: [
      "Unlimited fetches",
      "All 15+ providers",
      "AES-256 encrypted vault",
      "JSON & .ENV export",
      "Priority email support",
      "Advanced stealth browser",
      "CAPTCHA auto-solving",
      "5 proxy slots",
      "Kill switch",
      "Scheduled fetches",
      "Developer API (100 req/day)",
      "API key management",
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
      monthlyAllocation: 500,
      signupBonus: 100,
    },
  },
  {
    id: "enterprise",
    name: "Enterprise",
    tagline: "For organizations at scale",
    monthlyPrice: 99,
    yearlyPrice: 990,
    highlighted: false,
    cta: "Contact Sales",
    features: [
      "Everything in Pro",
      "Unlimited proxy slots",
      "Team management (up to 25 seats)",
      "Developer API (10,000 req/day)",
      "Webhook integrations",
      "Custom provider integrations",
      "Dedicated account manager",
      "SLA guarantee (99.9% uptime)",
      "SSO / SAML authentication",
      "Audit logs",
      "White-label option",
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
      monthlyAllocation: 5000,
      signupBonus: 500,
    },
  },
];

/**
 * Stripe Price IDs — these will be created in Stripe and mapped here.
 * For test mode, we create prices dynamically via the API.
 * For production, replace these with actual Stripe Price IDs.
 */
// ─── Credit Costs ──────────────────────────────────────────────────

export const CREDIT_COSTS = {
  chat_message: 1,      // 1 credit per chat message
  builder_action: 5,    // 5 credits per builder tool action (file create/modify)
  voice_action: 3,      // 3 credits per voice transcription
  fetch_action: 2,      // 2 credits per credential fetch
} as const;

export type CreditActionType = keyof typeof CREDIT_COSTS;

// ─── Credit Packs (one-time purchases) ─────────────────────────────

export interface CreditPack {
  id: string;
  name: string;
  credits: number;
  price: number; // USD
  popular?: boolean;
}

export const CREDIT_PACKS: CreditPack[] = [
  { id: "pack_100", name: "Starter Pack", credits: 100, price: 4.99 },
  { id: "pack_500", name: "Power Pack", credits: 500, price: 19.99, popular: true },
  { id: "pack_1500", name: "Pro Pack", credits: 1500, price: 49.99 },
  { id: "pack_5000", name: "Enterprise Pack", credits: 5000, price: 149.99 },
];

export const STRIPE_PRICES: Record<string, { monthly: string; yearly: string }> = {
  pro: {
    monthly: "", // Will be set dynamically or via env
    yearly: "",
  },
  enterprise: {
    monthly: "",
    yearly: "",
  },
};
