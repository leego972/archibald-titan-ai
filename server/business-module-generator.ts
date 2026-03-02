/**
 * Business Module Generator — Autonomous Weekly Developer Resource Factory
 *
 * PHILOSOPHY:
 * The Grand Bazaar is a developer resource hub. Every module is a practical
 * foundation that saves developers time AND credits. Pricing rule:
 *
 *   Module price = 30% LESS than what it would cost to build from scratch
 *
 * Build cost is estimated from: chat messages (1 credit each) + builder
 * actions (3 credits each) + GitHub pushes (5 credits) + time value.
 * A module that would take ~15 builder actions + 10 chat messages to build
 * from scratch costs ~55 credits. We'd price it at ~38 credits.
 *
 * Every module includes:
 *   - Production-ready foundation code (not a demo)
 *   - Relevant security hardening & pentesting considerations
 *   - Clear extension points so Titan can expand it further
 *   - Unit tests and documentation
 *   - "How to Expand with Titan" section showing upgrade paths
 *
 * Schedule: Wednesdays at 2 AM, 2-3 modules per week
 * Verticals: 15 business industries, rotated weekly
 */

import { invokeLLM } from "./_core/llm";
import { createLogger } from "./_core/logger.js";
import { getErrorMessage } from "./_core/errors.js";
import { storagePut } from "./storage";
import * as db from "./db";
import { getDb } from "./db";
import { marketplaceListings, users } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import crypto from "crypto";

const log = createLogger("BusinessModuleGen");

// ─── Configuration ─────────────────────────────────────────────────
const MODULES_PER_CYCLE = 2;          // Target: 2-3 modules per weekly run
const MAX_ATTEMPTS_PER_CYCLE = 6;     // Allow retries to hit target
const GENERATION_DAY = 3;             // Wednesday (0=Sun, 3=Wed)
const GENERATION_HOUR_START = 2;      // Start at 2 AM
const GENERATION_HOUR_END = 4;        // Finish by 4 AM
const CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000; // Check every 4h

// ─── Build Cost Economics ──────────────────────────────────────────
// Credit costs per action (from shared/pricing.ts):
//   chat_message = 1, builder_action = 3, github_action = 5
//
// Typical build-from-scratch cost for a module:
//   SMALL:  ~8 chat + ~10 builder + 1 github = 8 + 30 + 5 = 43 credits
//   MEDIUM: ~12 chat + ~20 builder + 1 github = 12 + 60 + 5 = 77 credits
//   LARGE:  ~20 chat + ~35 builder + 2 github = 20 + 105 + 10 = 135 credits
//
// Module price = build cost × 0.70 (30% discount)
const BUILD_COST_ESTIMATES = {
  small:  { chatMessages: 8,  builderActions: 10, githubPushes: 1 },
  medium: { chatMessages: 12, builderActions: 20, githubPushes: 1 },
  large:  { chatMessages: 20, builderActions: 35, githubPushes: 2 },
};
const DISCOUNT_RATE = 0.70; // 30% off build cost
const CREDIT_COSTS = { chat: 1, builder: 3, github: 5 };

function calculateModulePrice(complexity: "small" | "medium" | "large"): {
  buildCost: number;
  modulePrice: number;
  savings: number;
  savingsPercent: number;
} {
  const est = BUILD_COST_ESTIMATES[complexity];
  const buildCost =
    est.chatMessages * CREDIT_COSTS.chat +
    est.builderActions * CREDIT_COSTS.builder +
    est.githubPushes * CREDIT_COSTS.github;
  const modulePrice = Math.round(buildCost * DISCOUNT_RATE);
  return {
    buildCost,
    modulePrice,
    savings: buildCost - modulePrice,
    savingsPercent: 30,
  };
}

// Business-focused seller bot openIds
const BUSINESS_SELLER_BOTS = [
  "bot_stacksmith_004",       // StackSmith — full-stack dev tools
  "bot_synthwave_002",        // SynthWave AI — AI/ML integrations
  "bot_devops_ninja_006",     // DevOps Ninja — automation
  "bot_titan_official_008",   // Archibald Titan Official — premium
];
const SELLER_WEIGHTS = [2, 2, 1, 3]; // Titan Official weighted higher

// ─── Business Verticals with Security Focus ────────────────────────
const BUSINESS_VERTICALS = [
  {
    name: "SaaS & Startup Tools",
    focus: "subscription management, user onboarding, churn prediction, feature flagging, usage analytics, billing automation, multi-tenancy, trial-to-paid conversion",
    security: "API key rotation, rate limiting, tenant isolation, session management, OAuth2 implementation, CSRF protection, input sanitization for multi-tenant data",
    pentest: "tenant boundary testing, privilege escalation between tenants, API abuse detection, subscription bypass attempts",
    examples: "SaaS metrics dashboard, subscription billing engine, user onboarding wizard, churn early warning system, feature flag manager",
  },
  {
    name: "E-commerce & Retail",
    focus: "product catalog management, inventory tracking, order fulfillment, shopping cart optimization, payment processing, customer reviews, dynamic pricing, abandoned cart recovery",
    security: "PCI-DSS compliance, payment tokenization, SQL injection prevention, XSS in product descriptions, CSRF on checkout, inventory manipulation prevention",
    pentest: "price manipulation testing, coupon/discount abuse, cart quantity overflow, payment bypass, review spam detection",
    examples: "inventory sync engine, dynamic pricing optimizer, abandoned cart recovery bot, product recommendation engine",
  },
  {
    name: "Healthcare & Medical",
    focus: "patient scheduling, HIPAA-compliant data handling, telemedicine integration, medical records management, appointment reminders, insurance verification",
    security: "HIPAA compliance (encryption at rest + transit), PHI access logging, role-based access control, audit trails, data retention policies, BAA enforcement",
    pentest: "PHI exposure testing, unauthorized record access, session hijacking in telehealth, API endpoint enumeration for patient data",
    examples: "HIPAA-compliant patient portal, appointment scheduler, medical records search, insurance eligibility checker",
  },
  {
    name: "Finance & Fintech",
    focus: "transaction processing, fraud detection, KYC/AML compliance, portfolio management, invoice automation, expense tracking, financial reporting",
    security: "PCI compliance, transaction signing, fraud detection rules, KYC data encryption, AML screening integration, SOX audit logging",
    pentest: "transaction replay attacks, balance manipulation, KYC bypass testing, API rate limit abuse for financial data scraping",
    examples: "invoice automation engine, expense categorizer, fraud detection rule engine, financial report generator",
  },
  {
    name: "Marketing & Growth",
    focus: "email campaign automation, social media scheduling, A/B testing, lead scoring, funnel analytics, content calendar, SEO optimization, influencer outreach",
    security: "email injection prevention, API key management for social platforms, webhook signature verification, GDPR consent tracking, unsubscribe compliance",
    pentest: "email header injection, campaign URL manipulation, analytics data poisoning, unauthorized list access",
    examples: "email drip campaign builder, social media scheduler, A/B test framework, lead scoring engine, funnel analytics dashboard",
  },
  {
    name: "Real Estate & Property",
    focus: "property listing management, tenant screening, lease management, rental payments, property valuation, virtual tours, maintenance tracking",
    security: "PII protection for tenant data, secure document storage, payment processing security, access control for property managers vs tenants",
    pentest: "tenant data exposure, lease document tampering, payment redirect attacks, unauthorized property access",
    examples: "property listing aggregator, tenant screening automation, lease document generator, rent collection system",
  },
  {
    name: "Education & EdTech",
    focus: "course management, student progress tracking, quiz generation, learning path personalization, certificate issuance, classroom scheduling",
    security: "FERPA/COPPA compliance, student data protection, assessment integrity (anti-cheating), certificate forgery prevention, LMS access control",
    pentest: "grade manipulation testing, quiz answer extraction, certificate forgery, unauthorized course access, student data enumeration",
    examples: "course builder platform, student progress dashboard, auto-quiz generator, learning path recommender, digital certificate issuer",
  },
  {
    name: "Legal & Compliance",
    focus: "contract management, document automation, compliance monitoring, case management, time tracking, regulatory alerts, NDA generation",
    security: "attorney-client privilege protection, document encryption, access audit trails, e-discovery compliance, data retention enforcement",
    pentest: "document access bypass, privilege escalation in case management, time entry manipulation, unauthorized document download",
    examples: "contract template engine, compliance checklist automation, legal document parser, case management dashboard",
  },
  {
    name: "HR & Recruitment",
    focus: "applicant tracking, resume parsing, interview scheduling, employee onboarding, performance reviews, payroll integration, time-off management",
    security: "PII/SSN encryption, EEOC compliance logging, payroll data protection, background check data handling, access segregation (HR vs managers)",
    pentest: "salary data exposure, unauthorized personnel file access, payroll manipulation, resume injection attacks",
    examples: "resume parser and scorer, interview scheduling bot, employee onboarding workflow, performance review automation",
  },
  {
    name: "Logistics & Supply Chain",
    focus: "shipment tracking, warehouse management, route optimization, demand forecasting, supplier management, barcode/QR generation, fleet management",
    security: "supply chain integrity verification, IoT device authentication, GPS data protection, supplier portal access control, EDI message validation",
    pentest: "shipment redirect attacks, inventory count manipulation, GPS spoofing detection, supplier impersonation",
    examples: "shipment tracking dashboard, route optimization engine, demand forecasting model, warehouse inventory scanner",
  },
  {
    name: "Restaurant & Hospitality",
    focus: "menu management, table reservation, order management, kitchen display, inventory for perishables, staff scheduling, loyalty programs, delivery integration",
    security: "POS system hardening, payment terminal security, customer loyalty data protection, delivery API key management, staff access levels",
    pentest: "POS price manipulation, loyalty point fraud, order injection, unauthorized menu modification, delivery redirect",
    examples: "digital menu builder, table reservation system, kitchen order display, perishable inventory tracker, staff shift scheduler",
  },
  {
    name: "Construction & Field Services",
    focus: "project estimation, job scheduling, field worker dispatch, safety compliance, material tracking, progress documentation, change order management",
    security: "field device authentication, offline data sync security, document integrity for compliance, GPS tracking privacy, subcontractor access control",
    pentest: "estimate manipulation, safety record tampering, material tracking bypass, unauthorized change order approval",
    examples: "project cost estimator, field worker dispatch system, safety inspection checklist, material usage tracker",
  },
  {
    name: "Media & Content Creation",
    focus: "content management, editorial workflow, asset management, publishing automation, analytics, collaboration tools, content repurposing",
    security: "DRM and content protection, CDN security, hotlink prevention, contributor access control, content integrity verification, DMCA compliance",
    pentest: "content scraping prevention, unauthorized publishing, asset URL enumeration, editorial workflow bypass",
    examples: "editorial workflow engine, digital asset manager, multi-platform publisher, content analytics dashboard",
  },
  {
    name: "Agriculture & AgriTech",
    focus: "crop monitoring, irrigation scheduling, soil analysis, yield prediction, equipment tracking, weather integration, farm-to-table supply chain",
    security: "IoT sensor authentication, data integrity for yield records, equipment GPS security, weather API key management, supply chain traceability",
    pentest: "sensor data spoofing, irrigation override attacks, yield data manipulation, equipment tracking bypass",
    examples: "crop health monitor, smart irrigation scheduler, yield prediction model, farm equipment tracker",
  },
  {
    name: "Energy & Sustainability",
    focus: "energy consumption monitoring, carbon footprint tracking, renewable energy optimization, smart grid management, ESG reporting, utility analysis",
    security: "SCADA/ICS security basics, smart meter data protection, grid access control, ESG data integrity for audits, utility API security",
    pentest: "meter data manipulation, grid control bypass testing, ESG report tampering, unauthorized energy trading",
    examples: "energy consumption dashboard, carbon footprint calculator, solar panel ROI optimizer, ESG compliance reporter",
  },
];

// ─── Types ─────────────────────────────────────────────────────────
interface GeneratedBusinessModule {
  title: string;
  description: string;
  longDescription: string;
  category: "modules" | "blueprints" | "agents" | "templates";
  complexity: "small" | "medium" | "large";
  priceCredits: number;
  estimatedBuildCost: number;
  tags: string[];
  language: string;
  code: string;
  tests: string;
  readme: string;
  vertical: string;
  securityFeatures: string;
  expandability: string;
  titanUpgrades: string[];
}

export interface BusinessGenerationResult {
  modulesGenerated: number;
  modulesListed: number;
  modulesFailed: number;
  titles: string[];
  vertical: string;
  errors: string[];
}

// ─── State ─────────────────────────────────────────────────────────
let currentVerticalIndex = -1;

function getCurrentVertical(): typeof BUSINESS_VERTICALS[number] {
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const weekNumber = Math.ceil(
    ((now.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7
  );
  currentVerticalIndex = weekNumber % BUSINESS_VERTICALS.length;
  return BUSINESS_VERTICALS[currentVerticalIndex];
}

// ─── Helpers ───────────────────────────────────────────────────────
function pickRandomSellerBot(): string {
  const expanded: string[] = [];
  for (let i = 0; i < BUSINESS_SELLER_BOTS.length; i++) {
    for (let w = 0; w < SELLER_WEIGHTS[i]; w++) {
      expanded.push(BUSINESS_SELLER_BOTS[i]);
    }
  }
  return expanded[Math.floor(Math.random() * expanded.length)];
}

async function getExistingTitles(): Promise<Set<string>> {
  const titles = new Set<string>();
  try {
    const dbInst = await getDb();
    if (!dbInst) return titles;
    const rows = await dbInst
      .select({ title: marketplaceListings.title })
      .from(marketplaceListings);
    for (const row of rows) {
      titles.add(row.title.toLowerCase().trim());
    }
  } catch (err) {
    log.warn("Failed to fetch existing titles:", { error: getErrorMessage(err) });
  }
  return titles;
}

async function getSellerUserId(botOpenId: string): Promise<number | null> {
  try {
    const dbInst = await getDb();
    if (!dbInst) return null;
    const rows = await dbInst
      .select({ id: users.id })
      .from(users)
      .where(eq(users.openId, botOpenId))
      .limit(1);
    return rows[0]?.id ?? null;
  } catch {
    return null;
  }
}

// ─── Step 1: Generate a business module concept ────────────────────
async function generateBusinessModuleConcept(
  existingTitles: Set<string>,
  vertical: typeof BUSINESS_VERTICALS[number],
  attemptNumber: number
): Promise<GeneratedBusinessModule | null> {
  // Pick 2 other verticals for cross-pollination
  const otherVerticals = BUSINESS_VERTICALS
    .filter((v) => v.name !== vertical.name)
    .sort(() => Math.random() - 0.5)
    .slice(0, 2);

  const existingList = Array.from(existingTitles).slice(0, 80).join("\n- ");

  // Show the LLM the pricing economics
  const small = calculateModulePrice("small");
  const medium = calculateModulePrice("medium");
  const large = calculateModulePrice("large");

  const result = await invokeLLM({
    messages: [
      {
        role: "system",
        content: `You are a senior software architect building practical developer tools for the "Grand Bazaar" marketplace on Archibald Titan AI.

## YOUR MISSION
Create production-ready foundation modules that SAVE developers time and credits. Every module you create is a white-label starter kit that developers can buy, customize, and ship to their clients.

## PRICING ECONOMICS (CRITICAL)
Developers on Titan pay credits to build things:
- Chat message = 1 credit, Builder action = 3 credits, GitHub push = 5 credits

If a developer builds from scratch, it costs them:
- Small tool (~10 builder actions): ~${small.buildCost} credits to build → YOUR PRICE: ${small.modulePrice} credits (saves ${small.savings} credits + hours of time)
- Medium system (~20 builder actions): ~${medium.buildCost} credits to build → YOUR PRICE: ${medium.modulePrice} credits (saves ${medium.savings} credits + hours of time)
- Large platform (~35 builder actions): ~${large.buildCost} credits to build → YOUR PRICE: ${large.modulePrice} credits (saves ${large.savings} credits + hours of time)

The module MUST be priced 30% LESS than what it would cost to build from scratch. Include the "complexity" field so we can calculate the correct price.

## THIS WEEK'S VERTICAL: **${vertical.name}**
Business areas: ${vertical.focus}
Example ideas: ${vertical.examples}

## SECURITY & PENTESTING (MUST INCLUDE)
Every business vertical has security concerns. Your module MUST include:
- Security hardening relevant to this vertical: ${vertical.security}
- Pentesting considerations: ${vertical.pentest}
Include security features directly in the code (input validation, auth checks, encryption helpers, audit logging) — not just comments.

## CROSS-POLLINATION (borrow ideas from):
- ${otherVerticals[0].name}: ${otherVerticals[0].focus}
- ${otherVerticals[1].name}: ${otherVerticals[1].focus}

## DESIGN RULES
1. **Foundation, not demo** — This is a starter kit that a developer would actually ship to a client. Real error handling, real validation, real patterns.
2. **White-label ready** — No hardcoded branding. Config-driven so buyers can customize for their business.
3. **Titan-expandable** — Design with clear interfaces, plugin hooks, and config objects so Titan can add features on top. Include a "titanUpgrades" field listing 3-5 specific features Titan could add.
4. **Security built-in** — Include relevant security features for this vertical directly in the code.
5. **TypeScript preferred** — Modern patterns: generics, dependency injection, event emitters, middleware chains.
6. **Tests included** — Real unit tests that verify core business logic.
7. **README with upgrade paths** — Show buyers exactly how to expand the module using Titan.

## EXISTING MODULES (DO NOT DUPLICATE):
- ${existingList}`,
      },
      {
        role: "user",
        content: `Generate a NEW business module for **${vertical.name}** (attempt #${attemptNumber}).

This should be something a developer would buy to save time and credits — a practical foundation they can customize and ship.

Return a JSON object with these exact fields:
{
  "title": "Clear professional title — what it does, not marketing fluff",
  "description": "2-3 sentences: what it does, who it's for, why buy instead of build",
  "longDescription": "Full Markdown with ## Features, ## Security, ## Use Cases, ## Architecture, ## How to Expand with Titan",
  "category": "modules | blueprints | agents | templates",
  "complexity": "small | medium | large",
  "tags": ["relevant", "business", "tags", "including-vertical"],
  "language": "TypeScript",
  "code": "FULL production source code (150+ lines for small, 250+ for medium, 400+ for large). Must include security features, input validation, error handling, and clear extension points (interfaces, config objects, event hooks).",
  "tests": "Unit tests (40+ lines) testing core business logic and security features",
  "readme": "README.md with: Quick Start, Configuration, Security Features, and 'Expand with Titan' section listing 3-5 upgrade commands",
  "vertical": "${vertical.name}",
  "securityFeatures": "2-3 sentences describing the security hardening included",
  "expandability": "2-3 sentences on how this foundation can be customized for different businesses",
  "titanUpgrades": ["Specific feature Titan could add #1", "Feature #2", "Feature #3", "Feature #4", "Feature #5"]
}

IMPORTANT: Return ONLY valid JSON. No markdown code blocks. No explanation.`,
      },
    ],
    model: "strong",
    temperature: 0.85,
    maxTokens: 8000,
  });

  try {
    const rawContent = result.choices?.[0]?.message?.content;
    let jsonStr = (typeof rawContent === "string" ? rawContent : "").trim();
    if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }
    const parsed = JSON.parse(jsonStr);

    // Validate required fields
    if (!parsed.title || !parsed.description || !parsed.code) {
      log.warn("Generated business module missing required fields");
      return null;
    }

    // Check for duplicate title
    if (existingTitles.has(parsed.title.toLowerCase().trim())) {
      log.warn(`Generated duplicate title: "${parsed.title}" — skipping`);
      return null;
    }

    // Validate and fix category
    const validCategories = ["modules", "blueprints", "agents", "templates"];
    if (!validCategories.includes(parsed.category)) {
      parsed.category = "modules";
    }

    // Calculate correct price based on complexity
    const complexity = (["small", "medium", "large"].includes(parsed.complexity))
      ? parsed.complexity as "small" | "medium" | "large"
      : "medium";
    parsed.complexity = complexity;
    const pricing = calculateModulePrice(complexity);
    parsed.priceCredits = pricing.modulePrice;
    parsed.estimatedBuildCost = pricing.buildCost;

    // Ensure vertical is set
    parsed.vertical = vertical.name;

    // Default titanUpgrades if missing
    if (!Array.isArray(parsed.titanUpgrades) || parsed.titanUpgrades.length === 0) {
      parsed.titanUpgrades = [
        "Add database integration (PostgreSQL/MySQL)",
        "Add REST API endpoints with authentication",
        "Add real-time WebSocket notifications",
        "Add admin dashboard with analytics",
        "Add multi-tenant support",
      ];
    }

    return parsed as GeneratedBusinessModule;
  } catch (err) {
    log.warn("Failed to parse generated business module JSON:", { error: getErrorMessage(err) });
    return null;
  }
}

// ─── Step 2: Verify the generated code ─────────────────────────────
async function verifyBusinessModule(
  mod: GeneratedBusinessModule
): Promise<{ valid: boolean; errors: string[] }> {
  const errors: string[] = [];

  // Check minimum code length based on complexity
  const minCodeLength = mod.complexity === "large" ? 400 : mod.complexity === "medium" ? 200 : 150;
  if (!mod.code || mod.code.length < minCodeLength) {
    errors.push(`Code too short for ${mod.complexity} module (< ${minCodeLength} chars)`);
  }

  // Check for TypeScript/Python structure
  if (mod.language === "TypeScript" || !mod.language) {
    if (!mod.code.includes("export") && !mod.code.includes("function") && !mod.code.includes("class")) {
      errors.push("TypeScript code has no exports, functions, or classes");
    }
    // Check for extension points
    const hasExtensionPoints =
      /interface\s|type\s.*=|config|options|plugin|hook|event|middleware/i.test(mod.code);
    if (!hasExtensionPoints) {
      errors.push("Code lacks extension points (no interfaces, config, or plugin patterns)");
    }
    // Check for security features in code
    const hasSecurityCode =
      /validat|sanitiz|encrypt|hash|auth|permission|role|audit|log.*access|rate.?limit|csrf|xss|inject/i.test(mod.code);
    if (!hasSecurityCode) {
      errors.push("Code lacks security features (no validation, auth, encryption, or audit logging)");
    }
  } else if (mod.language === "Python") {
    if (!mod.code.includes("def ") && !mod.code.includes("class ")) {
      errors.push("Python code has no function or class definitions");
    }
  }

  // Check tests
  if (!mod.tests || mod.tests.length < 80) {
    errors.push("Tests too short or missing (< 80 chars)");
  }

  // Check title and description
  if (!mod.title || mod.title.length < 8) errors.push("Title too short");
  if (!mod.description || mod.description.length < 30) errors.push("Description too short");

  // Check for business value
  const fullText = (mod.code + mod.longDescription + mod.description + mod.readme).toLowerCase();
  const hasBusinessValue = /automat|efficien|track|manage|report|analyt|dashboard|workflow|integrat|notif|schedul|optimi|config|custom/i.test(fullText);
  if (!hasBusinessValue) {
    errors.push("Module doesn't demonstrate clear business value");
  }

  // LLM code quality review
  try {
    const reviewResult = await invokeLLM({
      messages: [
        {
          role: "system",
          content: "You are a code reviewer for a business software marketplace. Analyze the code for: (1) production quality, (2) security features present, (3) clear extension points. Reply with ONLY 'PASS' if acceptable, or 'FAIL: <reason>' if it has critical problems.",
        },
        {
          role: "user",
          content: `Review this ${mod.language || "TypeScript"} business module (${mod.complexity} complexity, ${mod.vertical}):\n\n${mod.code.slice(0, 3000)}`,
        },
      ],
      model: "fast",
      temperature: 0,
      maxTokens: 200,
    });
    const reviewRaw = reviewResult.choices?.[0]?.message?.content;
    const reviewText = (typeof reviewRaw === "string" ? reviewRaw : "").trim().toUpperCase();
    if (reviewText.startsWith("FAIL")) {
      errors.push(`Code review: ${(typeof reviewRaw === "string" ? reviewRaw : "").trim()}`);
    }
  } catch (err) {
    log.warn("Business module code review failed:", { error: getErrorMessage(err) });
  }

  return { valid: errors.length === 0, errors };
}

// ─── Step 3: Upload and create listing ─────────────────────────────
async function uploadAndListBusinessModule(
  mod: GeneratedBusinessModule,
  sellerUserId: number
): Promise<{ listingId: number; slug: string } | null> {
  try {
    const fileExt = (mod.language || "TypeScript") === "Python" ? "py" : "ts";
    const pricing = calculateModulePrice(mod.complexity);

    const bundleContent = `// ═══════════════════════════════════════════════════════════════
// ${mod.title}
// Generated by Archibald Titan AI — Business Module Generator
// Vertical: ${mod.vertical} | Complexity: ${mod.complexity}
// ═══════════════════════════════════════════════════════════════
//
// 💰 PRICING: ${mod.priceCredits} credits (saves you ${pricing.savings} credits
//    vs building from scratch at ~${pricing.buildCost} credits + your time)
//
// 🔒 SECURITY: ${mod.securityFeatures || "Includes input validation, auth checks, and audit logging"}
//
// 🚀 EXPAND WITH TITAN: Ask Titan to add any of these upgrades:
${(mod.titanUpgrades || []).map((u, i) => `//    ${i + 1}. ${u}`).join("\n")}
//
// ═══════════════════════════════════════════════════════════════

// ─── MODULE SOURCE CODE ────────────────────────────────────────
${mod.code}

// ─── UNIT TESTS ────────────────────────────────────────────────
/*
${mod.tests}
*/

// ─── README ────────────────────────────────────────────────────
/*
${mod.readme || mod.longDescription}

## 💰 Why Buy Instead of Build?
- Building this from scratch would cost ~${pricing.buildCost} credits + your time
- This module costs ${mod.priceCredits} credits — you save ${pricing.savings} credits (${pricing.savingsPercent}% off)
- Plus you save hours of development time
- Titan can expand this module further — just ask!

## 🚀 Expand with Titan
After purchasing, ask Titan to add any of these features:
${(mod.titanUpgrades || []).map((u, i) => `${i + 1}. "${u}" — Titan can build this on top of your purchased module`).join("\n")}
*/
`;

    // Upload to S3
    const slug = mod.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
    const uid = crypto.randomBytes(8).toString("hex");
    const storageKey = `marketplace/business-modules/${slug}-${uid}.${fileExt}`;

    const { url: fileUrl } = await storagePut(
      storageKey,
      Buffer.from(bundleContent, "utf-8"),
      "text/plain"
    );

    const listingUid = `BIZ-${crypto.randomUUID().split("-").slice(0, 2).join("")}`.toUpperCase();
    const listingSlug = `${slug}-${uid.slice(-6)}`;

    const allTags = [
      ...(mod.tags || []),
      mod.vertical.toLowerCase().replace(/\s+&\s+/g, "-").replace(/\s+/g, "-"),
      "business",
      "foundation",
      "white-label",
      "expandable",
      "security-hardened",
      mod.complexity,
    ];

    // Build the long description with pricing info baked in
    const enhancedLongDescription = `${mod.longDescription || mod.description}

## 💰 Save Credits & Time
| | Build from Scratch | Buy This Module |
|---|---|---|
| **Credits** | ~${pricing.buildCost} credits | **${mod.priceCredits} credits** |
| **Time** | Hours of development | Instant download |
| **Savings** | — | **${pricing.savings} credits (${pricing.savingsPercent}% off) + your time** |

## 🔒 Security Features
${mod.securityFeatures || "Includes input validation, authentication checks, and audit logging relevant to this industry vertical."}

## 🚀 Expand with Titan
After purchasing, ask Titan to upgrade this module:
${(mod.titanUpgrades || []).map((u, i) => `${i + 1}. **${u}**`).join("\n")}

Each upgrade costs just a few builder actions — far less than building the whole thing from scratch.`;

    const listing = await db.createListing({
      uid: listingUid,
      sellerId: sellerUserId,
      title: mod.title,
      slug: listingSlug,
      description: `${mod.description} — Save ${pricing.savingsPercent}% vs building from scratch (${mod.priceCredits} credits instead of ~${pricing.buildCost}).`,
      longDescription: enhancedLongDescription,
      category: mod.category,
      priceCredits: mod.priceCredits,
      priceUsd: Math.max(1, Math.round(mod.priceCredits / 100)),
      tags: JSON.stringify(allTags),
      language: mod.language || "TypeScript",
      license: "MIT",
      version: "1.0.0",
      fileUrl,
      fileSize: Buffer.byteLength(bundleContent),
      fileType: fileExt === "py" ? "text/x-python" : "text/typescript",
      riskCategory: "safe",
      reviewStatus: "approved",
      status: "active",
    });

    log.info(
      `Listed "${mod.title}" (${listingUid}) — ${mod.complexity} @ ${mod.priceCredits} credits (saves ${pricing.savings} vs ${pricing.buildCost} build cost) — ${mod.vertical}`
    );
    return { listingId: listing.id, slug: listingSlug };
  } catch (err) {
    log.error("Failed to upload and list business module:", { error: getErrorMessage(err) });
    return null;
  }
}

// ─── Main Generation Cycle ─────────────────────────────────────────
export async function runBusinessModuleGenerationCycle(): Promise<BusinessGenerationResult> {
  const vertical = getCurrentVertical();
  log.info(`═══ Starting weekly business module generation — Vertical: ${vertical.name} (week index ${currentVerticalIndex}) ═══`);

  const result: BusinessGenerationResult = {
    modulesGenerated: 0,
    modulesListed: 0,
    modulesFailed: 0,
    titles: [],
    vertical: vertical.name,
    errors: [],
  };

  const existingTitles = await getExistingTitles();
  log.info(`Found ${existingTitles.size} existing modules in marketplace`);

  for (let i = 0; i < MAX_ATTEMPTS_PER_CYCLE && result.modulesListed < MODULES_PER_CYCLE; i++) {
    try {
      log.info(`Generating business module ${i + 1}/${MAX_ATTEMPTS_PER_CYCLE} for ${vertical.name}...`);

      const mod = await generateBusinessModuleConcept(existingTitles, vertical, i + 1);
      if (!mod) {
        result.modulesFailed++;
        result.errors.push(`Attempt ${i + 1}: Failed to generate valid concept`);
        continue;
      }

      result.modulesGenerated++;
      const pricing = calculateModulePrice(mod.complexity);
      log.info(`Generated: "${mod.title}" (${mod.complexity}, ${mod.priceCredits} credits — saves ${pricing.savings} vs ${pricing.buildCost} build cost)`);

      const verification = await verifyBusinessModule(mod);
      if (!verification.valid) {
        result.modulesFailed++;
        result.errors.push(`"${mod.title}": Verification failed — ${verification.errors.join("; ")}`);
        log.warn(`"${mod.title}" failed verification:`, { errors: verification.errors });
        continue;
      }

      log.info(`"${mod.title}" passed verification (security + quality + extension points)`);

      const botOpenId = pickRandomSellerBot();
      const sellerUserId = await getSellerUserId(botOpenId);
      if (!sellerUserId) {
        result.modulesFailed++;
        result.errors.push(`No seller user found for bot ${botOpenId}`);
        continue;
      }

      const listing = await uploadAndListBusinessModule(mod, sellerUserId);
      if (!listing) {
        result.modulesFailed++;
        result.errors.push(`"${mod.title}": Failed to upload/list`);
        continue;
      }

      existingTitles.add(mod.title.toLowerCase().trim());
      result.modulesListed++;
      result.titles.push(mod.title);

      try {
        const profile = await db.getSellerProfile(sellerUserId);
        if (profile) {
          await db.updateSellerProfile(sellerUserId, { totalSales: profile.totalSales || 0 });
        }
      } catch { /* non-critical */ }

    } catch (err) {
      result.modulesFailed++;
      result.errors.push(`Attempt ${i + 1}: ${getErrorMessage(err)}`);
      log.error(`Business module attempt ${i + 1} failed:`, { error: getErrorMessage(err) });
    }
  }

  log.info(`═══ Business module generation complete: ${result.modulesListed} listed, ${result.modulesFailed} failed — ${vertical.name} ═══`);
  log.info(`New modules: ${result.titles.join(", ") || "(none)"}`);

  return result;
}

// ─── Status for Chat Tools ─────────────────────────────────────────
export function getBusinessModuleGeneratorStatus(): {
  currentVertical: string;
  nextVertical: string;
  verticalIndex: number;
  totalVerticals: number;
  schedule: string;
  lastRun: string;
  pricingModel: string;
  priceExamples: { complexity: string; buildCost: number; modulePrice: number; savings: number }[];
} {
  const current = getCurrentVertical();
  const nextIndex = (currentVerticalIndex + 1) % BUSINESS_VERTICALS.length;
  return {
    currentVertical: current.name,
    nextVertical: BUSINESS_VERTICALS[nextIndex].name,
    verticalIndex: currentVerticalIndex,
    totalVerticals: BUSINESS_VERTICALS.length,
    schedule: "Every Wednesday, 2-4 AM",
    lastRun: lastGenerationDate || "Never",
    pricingModel: "30% below build-from-scratch cost",
    priceExamples: (["small", "medium", "large"] as const).map((c) => {
      const p = calculateModulePrice(c);
      return { complexity: c, buildCost: p.buildCost, modulePrice: p.modulePrice, savings: p.savings };
    }),
  };
}

export function getBusinessVerticals(): Array<{ name: string; focus: string; security: string }> {
  return BUSINESS_VERTICALS.map((v) => ({ name: v.name, focus: v.focus, security: v.security }));
}

// ─── Weekly Scheduler ──────────────────────────────────────────────
let generatorInterval: ReturnType<typeof setInterval> | null = null;
let lastGenerationDate = "";

export function startBusinessModuleGeneratorScheduler(): void {
  log.info("[BusinessModuleGen] Starting weekly scheduler (Wednesdays 2-4 AM)...");
  log.info(`[BusinessModuleGen] This week's vertical: ${getCurrentVertical().name}`);
  log.info("[BusinessModuleGen] Pricing: 30% below build cost. Skipping startup cycle (cost optimization).");

  generatorInterval = setInterval(async () => {
    try {
      const now = new Date();
      const dayOfWeek = now.getDay();
      const hour = now.getHours();
      const todayStr = now.toISOString().slice(0, 10);

      if (
        dayOfWeek === GENERATION_DAY &&
        hour >= GENERATION_HOUR_START &&
        hour <= GENERATION_HOUR_END &&
        lastGenerationDate !== todayStr
      ) {
        lastGenerationDate = todayStr;
        log.info("[BusinessModuleGen] Running weekly generation cycle...");
        const result = await runBusinessModuleGenerationCycle();
        log.info("[BusinessModuleGen] Weekly result:", result as unknown as Record<string, unknown>);
      }
    } catch (err) {
      log.error("[BusinessModuleGen] Scheduled cycle failed:", { error: getErrorMessage(err) });
    }
  }, CHECK_INTERVAL_MS);
}

export function stopBusinessModuleGeneratorScheduler(): void {
  if (generatorInterval) {
    clearInterval(generatorInterval);
    generatorInterval = null;
    log.info("[BusinessModuleGen] Scheduler stopped.");
  }
}
