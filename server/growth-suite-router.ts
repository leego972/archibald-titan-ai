import { z } from "zod";
import { adminProcedure, router } from "./_core/trpc";

const SITE_URL = "https://www.archibaldtitan.com";
const BRAND = "Archibald Titan";

type Priority = "critical" | "high" | "medium" | "low";
type ChannelType = "free" | "low_cost" | "paid";

type GrowthAction = {
  id: string;
  area: "seo" | "content" | "advertising" | "affiliate" | "conversion" | "analytics";
  title: string;
  priority: Priority;
  impact: number;
  effort: number;
  expectedOutcome: string;
  implementation: string[];
  freeOrCheapPath: string;
};

const coreAudiences = ["solo developers", "startup CTOs", "DevOps teams", "AI engineers", "security engineers", "agency owners", "SaaS founders", "enterprise IT teams"];

const seoPillars = [
  { pillar: "AI credential management", intent: "commercial", pages: ["/docs", "/security", "/use-cases", "/pricing"], keywords: ["AI credential management", "API key automation", "automated secret retrieval", "developer credential vault"] },
  { pillar: "Secrets management alternatives", intent: "commercial", pages: ["/vs-cloud-ai", "/vs-copilot", "/security"], keywords: ["HashiCorp Vault alternative", "1Password alternative for developers", "AWS Secrets Manager alternative"] },
  { pillar: "Local AI agent automation", intent: "informational", pages: ["/how-it-works", "/docs", "/blog"], keywords: ["local AI agent", "AI browser automation", "autonomous devops agent"] },
  { pillar: "Growth automation for technical founders", intent: "transactional", pages: ["/marketing", "/master-growth", "/content-creator"], keywords: ["AI marketing automation", "startup growth automation", "autonomous advertising engine"] },
];

const channels: Array<{ channel: string; type: ChannelType; cost: string; role: string; setup: string[] }> = [
  { channel: "Programmatic SEO", type: "free", cost: "$0", role: "Long-tail acquisition for comparisons, alternatives, integrations, and use-cases.", setup: ["Publish comparison pages", "Add FAQ schema", "Submit updated sitemap", "Add internal links from pillar pages"] },
  { channel: "LinkedIn founder content", type: "free", cost: "$0", role: "Authority and B2B reach for founders, CTOs, and DevOps buyers.", setup: ["Post 3 proof-led posts weekly", "Repurpose product demos", "Comment on DevOps/security threads"] },
  { channel: "YouTube Shorts / TikTok demos", type: "free", cost: "$0-$20/mo", role: "Show credential automation visually and build trust through short demos.", setup: ["Record 30-60 second workflows", "Use one CTA", "Publish 4 clips weekly"] },
  { channel: "Reddit / Hacker News soft launch", type: "free", cost: "$0", role: "Collect technical feedback without paid spend.", setup: ["Share lessons, not ads", "Post build-in-public updates", "Answer security questions transparently"] },
  { channel: "Product Hunt / AlternativeTo / directories", type: "free", cost: "$0", role: "Low-cost backlinks, discovery, and comparison traffic.", setup: ["Create profiles", "Link comparison pages", "Collect reviews"] },
  { channel: "Google Search exact-match tests", type: "low_cost", cost: "$5-$25/day test budget", role: "Validate buying-intent keywords before scaling paid ads.", setup: ["Start with exact-match competitor alternatives", "Use strict negative keywords", "Send to comparison pages"] },
  { channel: "Retargeting", type: "low_cost", cost: "$3-$15/day", role: "Recover visitors from pricing, docs, and comparison pages.", setup: ["Install pixel tracking", "Segment docs/pricing visits", "Use demo CTA"] },
];

const conversionPages = [
  { path: "/pricing", score: 84, weakness: "Needs stronger proof near plan cards", fix: "Add short customer outcome bullets and direct demo CTA above fold." },
  { path: "/demo", score: 88, weakness: "Primary CTA can be more specific", fix: "Use role-based CTAs: founders, DevOps, security teams." },
  { path: "/docs", score: 76, weakness: "High-intent docs traffic needs conversion bridge", fix: "Add contextual cards to pricing, demo, and security proof pages." },
  { path: "/vs-cloud-ai", score: 81, weakness: "Comparison intent needs stronger objection handling", fix: "Add competitor table, migration FAQ, and proof screenshots." },
];

const backlinkTasks = [
  { target: "Product Hunt", type: "directory", priority: "high" as Priority, cost: "$0", action: "Prepare launch/update page and drive maker comments to comparison pages." },
  { target: "AlternativeTo", type: "directory", priority: "high" as Priority, cost: "$0", action: "List Titan against password manager and secrets manager alternatives." },
  { target: "Dev.to", type: "content", priority: "medium" as Priority, cost: "$0", action: "Cross-post technical credential automation articles with canonical URL." },
  { target: "Hashnode", type: "content", priority: "medium" as Priority, cost: "$0", action: "Publish developer-focused tutorials linking to docs and demo." },
  { target: "G2/Capterra", type: "review", priority: "medium" as Priority, cost: "$0-$200", action: "Create profiles only after onboarding first active users for reviews." },
];

function scoreAction(action: Pick<GrowthAction, "impact" | "effort" | "priority">) {
  const priorityBoost = action.priority === "critical" ? 30 : action.priority === "high" ? 20 : action.priority === "medium" ? 10 : 0;
  return Math.round(action.impact * 12 - action.effort * 4 + priorityBoost);
}

function actions(): GrowthAction[] {
  return [
    { id: "seo-programmatic-index", area: "seo", title: "Create a complete programmatic SEO index", priority: "critical", impact: 9, effort: 5, expectedOutcome: "More crawlable long-tail pages for competitor, integration, and use-case intent.", implementation: ["Generate comparison, alternative, integration, and use-case page metadata", "Expose sitemap groups", "Add FAQ and breadcrumb schema", "Submit changed URLs via IndexNow"], freeOrCheapPath: "Use generated static metadata first; add paid rank tracking only after pages are indexed." },
    { id: "seo-ai-search", area: "seo", title: "Strengthen GEO / AI-search discoverability", priority: "high", impact: 8, effort: 3, expectedOutcome: "Better visibility in AI assistants and answer engines through llms.txt, concise product facts, and citation-ready content.", implementation: ["Maintain llms.txt and llms-full.txt", "Add clear product facts", "Add AI citation meta to important pages", "Create FAQ snippets with direct answers"], freeOrCheapPath: "No paid tool required; rely on clean public files, structured data, and consistent facts." },
    { id: "content-snippet-briefs", area: "content", title: "Publish featured-snippet content briefs", priority: "high", impact: 7, effort: 4, expectedOutcome: "Capture informational searches and feed users into pricing/demo flows.", implementation: ["Write 40-60 word answer blocks", "Add comparison tables", "Use FAQ schema", "Link to pricing and demo"], freeOrCheapPath: "Use internal content generator and free Google autocomplete/People Also Ask research." },
    { id: "ads-low-budget-validation", area: "advertising", title: "Run low-budget keyword validation before scaling ads", priority: "high", impact: 8, effort: 4, expectedOutcome: "Avoid wasted ad spend and discover high-converting buyer intent.", implementation: ["Start exact-match campaigns", "Cap daily spend", "Use strict negatives", "Send competitor keywords to comparison pages"], freeOrCheapPath: "Start with organic channels and $5/day validation only after pages convert organically." },
    { id: "affiliate-marketplaces", area: "affiliate", title: "Build an affiliate and directory backlink loop", priority: "medium", impact: 6, effort: 3, expectedOutcome: "More referral traffic, review signals, and backlinks without heavy ad spend.", implementation: ["Create partner landing page", "List on software directories", "Offer founder-friendly affiliate terms", "Track /go/:slug redirects"], freeOrCheapPath: "Use directories and founder partnerships first; delay paid affiliate network fees." },
    { id: "conversion-demo-path", area: "conversion", title: "Make demo the primary conversion path", priority: "critical", impact: 9, effort: 4, expectedOutcome: "Turn technical curiosity into measurable leads and trials.", implementation: ["Place demo CTA on docs, pricing, and comparison pages", "Add short product proof", "Add trust badges", "Track demo clicks"], freeOrCheapPath: "Use existing demo page and event tracking before adding paid CRO tools." },
    { id: "analytics-source-quality", area: "analytics", title: "Track source quality, not just traffic volume", priority: "high", impact: 7, effort: 4, expectedOutcome: "Know which channels drive signups, demos, activation, and revenue.", implementation: ["Standardize UTM parameters", "Track trial starts", "Track demo intent", "Compare CAC-free channels against paid tests"], freeOrCheapPath: "Use existing event tables and free analytics before paying for attribution platforms." },
  ];
}

function contentIdeas(audience: string) {
  return [
    { title: `${BRAND} for ${audience}: automate API key retrieval without manual dashboard work`, format: "blog + LinkedIn carousel", hook: `Most ${audience} still waste time copying API keys by hand. This shows the automated alternative.`, cta: "Book a demo" },
    { title: `The ${audience} guide to safer credential workflows`, format: "SEO article + checklist", hook: "Credential sprawl creates security risk and slows shipping. The fix is a repeatable retrieval and vault workflow.", cta: "View security workflow" },
    { title: `Before you buy another secrets manager, check this automation gap`, format: "comparison post", hook: "Most vaults store secrets. Titan helps retrieve and manage them autonomously.", cta: "Compare options" },
  ];
}

function getExecutionQueue() {
  return actions().map((action) => ({
    id: action.id,
    title: action.title,
    area: action.area,
    priority: action.priority,
    score: scoreAction(action),
    status: "ready_for_review",
    safeToRun: !["advertising"].includes(action.area),
    requiresConfirmation: action.area === "advertising",
    nextStep: action.implementation[0],
  })).sort((a, b) => b.score - a.score);
}

export const growthSuiteRouter = router({
  getDashboard: adminProcedure.query(() => {
    const allActions = actions();
    const sorted = [...allActions].sort((a, b) => scoreAction(b) - scoreAction(a));
    const avgConversion = Math.round(conversionPages.reduce((sum, page) => sum + page.score, 0) / conversionPages.length);
    return {
      brand: BRAND,
      siteUrl: SITE_URL,
      generatedAt: new Date().toISOString(),
      score: Math.round((91 + avgConversion) / 2),
      summary: "Growth suite is configured around SEO, GEO, content, low-budget ad validation, affiliate loops, conversion tracking, and source-quality analytics.",
      priorities: sorted.slice(0, 5).map((action) => ({ ...action, score: scoreAction(action) })),
      channelMix: { free: channels.filter((c) => c.type === "free").length, lowCost: channels.filter((c) => c.type === "low_cost").length, paid: channels.filter((c) => c.type === "paid").length },
      conversionScore: avgConversion,
      backlinkTasks: backlinkTasks.length,
      executionReady: getExecutionQueue().filter((item) => item.safeToRun).length,
    };
  }),

  getSeoPlan: adminProcedure.query(() => ({
    pillars: seoPillars,
    technicalChecklist: ["Canonical URLs on every public page", "Sitemap index plus segmented sitemaps", "Robots.txt with AI crawler allowances", "llms.txt and llms-full.txt", "FAQ, Breadcrumb, Organization, SoftwareApplication, and Product schema", "Internal links from high-authority pages to high-intent comparison pages", "IndexNow submission after meaningful content updates"],
    geoReadiness: { score: 87, checks: ["llms.txt planned", "AI citation metadata planned", "answer-block content briefs planned", "structured product facts planned"] },
    publishingCadence: "2 comparison pages, 2 integration pages, 1 use-case page, and 1 founder/product proof post per week.",
  })),

  getAdvertisingPlan: adminProcedure.input(z.object({ monthlyBudget: z.number().min(0).max(100000).default(500) }).optional()).query(({ input }) => {
    const budget = input?.monthlyBudget ?? 500;
    const experimental = Math.round(budget * 0.2);
    const search = Math.round(budget * 0.45);
    const retargeting = Math.round(budget * 0.2);
    const creative = Math.max(0, budget - experimental - search - retargeting);
    return {
      monthlyBudget: budget,
      allocation: [
        { bucket: "Exact-match search validation", amount: search, rationale: "Capture high-intent competitor and alternative searches." },
        { bucket: "Retargeting", amount: retargeting, rationale: "Recover docs/pricing/comparison visitors." },
        { bucket: "Creative testing", amount: creative, rationale: "Produce and test hooks before scaling." },
        { bucket: "Experiments", amount: experimental, rationale: "Test new channels without risking core budget." },
      ],
      safeguards: ["Daily caps", "Strict negative keywords", "Pause rules for low CTR and zero demo intent", "UTM tracking on every ad", "No broad match until conversion data exists"],
      freeFirstChannels: channels.filter((c) => c.type !== "paid"),
    };
  }),

  getCampaignIdeas: adminProcedure.input(z.object({ audience: z.string().min(2).max(80).optional() }).optional()).query(({ input }) => {
    const audience = input?.audience || "startup CTOs";
    return { audience, ideas: contentIdeas(audience), reusableAngles: ["Stop copying API keys manually", "Credentials are workflow debt, not just vault data", "Local AI agent for technical founders", "Secrets management needs retrieval automation", "Cut DevOps admin work without cutting security"], audiences: coreAudiences };
  }),

  getActions: adminProcedure.query(() => actions().map((action) => ({ ...action, score: scoreAction(action) })).sort((a, b) => b.score - a.score)),
  getChannels: adminProcedure.query(() => channels),
  getBacklinkTasks: adminProcedure.query(() => backlinkTasks),
  getConversionAudit: adminProcedure.query(() => ({ pages: conversionPages, averageScore: Math.round(conversionPages.reduce((sum, page) => sum + page.score, 0) / conversionPages.length), nextFix: conversionPages.sort((a, b) => a.score - b.score)[0] })),
  getExecutionQueue: adminProcedure.query(() => getExecutionQueue()),
  getWeeklyOperatingPlan: adminProcedure.query(() => ({
    monday: ["Review Growth Suite priorities", "Publish one high-intent comparison page"],
    tuesday: ["Ship one integration page", "Create LinkedIn founder post"],
    wednesday: ["Run conversion audit fixes", "Prepare directory/backlink submissions"],
    thursday: ["Publish snippet-optimized article", "Create short demo clip"],
    friday: ["Review channel quality", "Update next-week execution queue"],
  })),
  exportPlan: adminProcedure.query(() => {
    const top = actions().map((action) => ({ ...action, score: scoreAction(action) })).sort((a, b) => b.score - a.score).slice(0, 7);
    return {
      filename: "archibald-titan-growth-plan.md",
      markdown: [`# ${BRAND} Growth Plan`, `Generated: ${new Date().toISOString()}`, "", "## Top Actions", ...top.map((a, i) => `${i + 1}. **${a.title}** (${a.priority}, score ${a.score}) - ${a.expectedOutcome}`), "", "## Free/Low-cost channels", ...channels.map((c) => `- ${c.channel}: ${c.cost} - ${c.role}`)].join("\n"),
    };
  }),
});
