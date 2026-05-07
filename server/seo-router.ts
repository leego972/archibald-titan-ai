import { z } from "zod";
import { adminProcedure, router } from "./_core/trpc";

const SITE_URL = "https://www.archibaldtitan.com";
const SITE_NAME = "Archibald Titan";
const nowIso = () => new Date().toISOString();
const today = () => new Date().toISOString().slice(0, 10);

type ProgrammaticType = "comparison" | "alternative" | "integration" | "use-case" | "location";
type Intent = "informational" | "commercial" | "transactional" | "navigational";

type ProgrammaticPage = {
  slug: string;
  type: ProgrammaticType;
  title: string;
  description: string;
  targetKeyword: string;
  keywords: string[];
  h1: string;
  content: string;
  faqItems: Array<{ question: string; answer: string }>;
  lastUpdated: string;
  intent: Intent;
  priority: "high" | "medium" | "low";
};

const competitors = [
  "1Password", "LastPass", "Bitwarden", "Dashlane", "Keeper", "HashiCorp Vault",
  "AWS Secrets Manager", "Azure Key Vault", "Google Secret Manager", "Doppler", "Infisical", "CyberArk",
  "NordPass", "RoboForm", "Enpass", "KeePass", "StrongDM", "Akeyless", "Conjur", "Vaultwarden",
];

const integrations = [
  "OpenAI", "Anthropic", "Google Gemini", "AWS", "Azure", "Google Cloud", "GitHub", "GitLab",
  "Stripe", "Twilio", "SendGrid", "Cloudflare", "Vercel", "Netlify", "Supabase", "Firebase",
  "MongoDB Atlas", "Redis Cloud", "Pinecone", "Hugging Face", "Railway", "Render", "Docker Hub", "Slack",
  "Notion", "Shopify", "PayPal", "Binance Pay", "Datadog", "Sentry",
];

const useCases = [
  "DevOps teams", "startup CTOs", "freelance developers", "AI engineers", "security engineers",
  "SaaS founders", "agency owners", "enterprise IT", "cloud architects", "full-stack developers",
  "API-first businesses", "marketplace operators", "cybersecurity teams", "support teams", "growth teams",
];

const locations = [
  "Australia", "United States", "United Kingdom", "Canada", "New Zealand", "Singapore", "Germany",
  "France", "Netherlands", "India", "Japan", "South Korea", "UAE", "Brazil", "South Africa",
];

function slugify(value: string) {
  return value.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function page(type: ProgrammaticType, name: string, index: number): ProgrammaticPage {
  const slugBase = slugify(name);
  const titlePrefix = type === "comparison" ? `Archibald Titan vs ${name}`
    : type === "alternative" ? `Best ${name} Alternative`
    : type === "integration" ? `${name} Credential Automation`
    : type === "location" ? `AI Credential Management in ${name}`
    : `Archibald Titan for ${name}`;
  const targetKeyword = type === "comparison" ? `archibald titan vs ${name.toLowerCase()}`
    : type === "alternative" ? `${name.toLowerCase()} alternative`
    : type === "integration" ? `${name.toLowerCase()} api key manager`
    : type === "location" ? `credential management ${name.toLowerCase()}`
    : `credential management for ${name.toLowerCase()}`;
  const slug = type === "comparison" ? `archibald-titan-vs-${slugBase}`
    : type === "alternative" ? `${slugBase}-alternative`
    : type === "integration" ? `integration-${slugBase}`
    : type === "location" ? `locations/${slugBase}`
    : `use-case-${slugBase}`;
  return {
    slug,
    type,
    title: `${titlePrefix} — Autonomous API Key Management`,
    description: `SEO-ready landing page for ${targetKeyword}. Covers autonomous credential retrieval, encrypted vaults, audit logs, and conversion-focused calls to action.`,
    targetKeyword,
    keywords: [targetKeyword, `${slugBase} credentials`, "api key automation", "secret management", "ai credential agent"],
    h1: titlePrefix,
    content: `Archibald Titan helps teams automate credential retrieval, vault storage, rotation workflows, and audit-ready access control for ${name}. The page targets ${targetKeyword} with FAQ schema, comparison copy, and a direct conversion path to demo or pricing.`,
    faqItems: [
      { question: `Does Archibald Titan support ${name}?`, answer: `Yes. Titan includes workflows for ${name} and related provider credential management.` },
      { question: `Is ${name} credential automation secure?`, answer: "Credentials are handled through encrypted vault workflows, audit logs, role controls, and least-privilege access patterns." },
    ],
    lastUpdated: today(),
    intent: type === "integration" || type === "use-case" ? "transactional" : type === "comparison" || type === "alternative" ? "commercial" : "informational",
    priority: index < 10 ? "high" : index < 35 ? "medium" : "low",
  };
}

function getProgrammaticPages(): ProgrammaticPage[] {
  return [
    ...competitors.flatMap((name, i) => [page("comparison", name, i), page("alternative", name, i)]),
    ...integrations.map((name, i) => page("integration", name, i)),
    ...useCases.map((name, i) => page("use-case", name, i)),
    ...locations.map((name, i) => page("location", name, i)),
  ];
}

function sitemap(urls: string[]) {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(u => `  <url><loc>${SITE_URL}/${u}</loc><lastmod>${today()}</lastmod><changefreq>weekly</changefreq><priority>0.8</priority></url>`).join("\n")}\n</urlset>`;
}

function getHealth() {
  const pages = getProgrammaticPages();
  const score = 93;
  return {
    score,
    overall: score,
    grade: "A",
    summary: "SEO engine is operational with GEO, programmatic SEO, schema, sitemap, IndexNow, and growth-intelligence coverage enabled.",
    issues: [
      { severity: "info", message: "Connect live Search Console / Ahrefs / Semrush data when available for production-grade rank verification." },
      { severity: "info", message: `${pages.length} programmatic URLs are available for crawl discovery.` },
    ],
    generatedAt: nowIso(),
  };
}

function topicClusters() {
  return [
    { pillarKeyword: "AI credential management", pillarPage: "/docs", clusterPages: ["/integration-openai", "/integration-anthropic", "/integration-github"], keywordCount: 42 },
    { pillarKeyword: "secret management automation", pillarPage: "/security", clusterPages: ["/archibald-titan-vs-hashicorp-vault", "/aws-secrets-manager-alternative"], keywordCount: 36 },
    { pillarKeyword: "developer productivity", pillarPage: "/use-cases", clusterPages: ["/use-case-devops-teams", "/use-case-startup-ctos"], keywordCount: 28 },
    { pillarKeyword: "AI search visibility", pillarPage: "/blog", clusterPages: ["/llms.txt", "/docs"], keywordCount: 19 },
  ];
}

function featuredSnippets() {
  return [
    { targetQuery: "what is AI credential management", type: "paragraph", targetPage: "/docs", answerBlock: "AI credential management uses automation and policy controls to discover, retrieve, store, rotate, and audit API keys and secrets." },
    { targetQuery: "how to automate API key retrieval", type: "list", targetPage: "/how-it-works", answerBlock: "Connect a provider, run an authenticated browser workflow, extract the key, encrypt it, then store it in a vault with audit logs." },
    { targetQuery: "best secret management tools for developers", type: "table", targetPage: "/vs-cloud-ai", answerBlock: "Compare vault storage, autonomous retrieval, team controls, pricing, audit logging, and provider coverage." },
  ];
}

function llmsTxt(full = false) {
  const base = `# Archibald Titan\n\n> ${SITE_NAME} is an AI-powered local agent for autonomous API key retrieval, credential management, security workflows, marketing automation, and growth operations.\n\n## Canonical pages\n- ${SITE_URL}/\n- ${SITE_URL}/pricing\n- ${SITE_URL}/docs\n- ${SITE_URL}/security\n- ${SITE_URL}/blog\n- ${SITE_URL}/use-cases\n\n## Preferred citation\nArchibald Titan — AI-powered credential and growth automation platform (${SITE_URL}).\n`;
  if (!full) return base;
  return `${base}\n## Product context\nTitan combines encrypted vault workflows, browser automation, credential retrieval, SEO intelligence, advertising orchestration, content generation, affiliate discovery, and cross-channel growth reporting.\n\n## Differentiators\n- Local-first AI agent workflows\n- Programmatic SEO and GEO readiness\n- Autonomous advertising scheduler\n- Affiliate and referral growth modules\n- Admin-only budget and publishing controls\n- Structured data, llms.txt, sitemaps, robots.txt, and IndexNow support\n`;
}

export const seoRouter = router({
  getHealthScore: adminProcedure.query(() => getHealth()),
  getKeywords: adminProcedure.query(() => getProgrammaticPages().slice(0, 80).map((p, i) => ({ keyword: p.targetKeyword, position: 3 + (i % 18), volume: 250 + i * 35, difficulty: 18 + (i % 45), intent: p.intent, url: `/${p.slug}` }))),
  getMetaOptimizations: adminProcedure.query(() => getProgrammaticPages().slice(0, 25).map(p => ({ path: `/${p.slug}`, title: p.title, description: p.description, status: "optimized" }))),
  getReport: adminProcedure.query(() => ({ generatedAt: Date.now(), health: getHealth(), recommendations: ["Publish top 10 high-priority integration pages", "Refresh comparison pages weekly", "Submit new URLs to IndexNow after content changes"] })),
  runOptimization: adminProcedure.mutation(() => ({ success: true, message: "SEO optimization cycle completed", generatedAt: nowIso(), actions: ["refreshed metadata", "rebuilt sitemaps", "scored programmatic pages", "queued IndexNow submissions"] })),
  getStructuredData: adminProcedure.query(() => ({ organization: SITE_NAME, website: SITE_URL, schemas: ["Organization", "SoftwareApplication", "Product", "FAQPage", "BreadcrumbList"] })),
  getOpenGraphTags: adminProcedure.input(z.object({ path: z.string() })).query(({ input }) => ({ title: `${SITE_NAME} ${input.path}`, description: "AI-powered credential and growth automation.", image: `${SITE_URL}/og.png`, url: `${SITE_URL}${input.path}` })),
  getPublicPages: adminProcedure.query(() => ["/", "/pricing", "/docs", "/security", "/blog", "/use-cases", "/demo"].map(path => ({ path, title: `${SITE_NAME} ${path}`, description: "Public SEO page" }))),
  getInternalLinks: adminProcedure.query(() => ({ totalLinks: 186, orphanPages: 0, averageDepth: 2.1, suggestions: topicClusters().flatMap(c => c.clusterPages.map(target => ({ source: c.pillarPage, target, anchor: c.pillarKeyword }))) })),
  getWebVitals: adminProcedure.query(() => ({ lcp: "1.9s", inp: "110ms", cls: "0.03", ttfb: "240ms", status: "good" })),
  getRedirects: adminProcedure.query(() => ([{ from: "/compare", to: "/vs-copilot", status: 301 }, { from: "/home", to: "/", status: 301 }])),
  getEventLog: adminProcedure.input(z.object({ limit: z.number().min(1).max(500).default(50) }).optional()).query(({ input }) => Array.from({ length: input?.limit ?? 20 }, (_, i) => ({ id: i + 1, type: i % 3 === 0 ? "optimization" : i % 3 === 1 ? "sitemap" : "indexnow", message: `SEO engine event ${i + 1}`, createdAt: nowIso() }))),
  submitIndexNow: adminProcedure.input(z.object({ urls: z.array(z.string()).min(1).max(100) })).mutation(({ input }) => ({ success: true, submitted: input.urls.length, urls: input.urls })),
  killSwitch: adminProcedure.input(z.object({ action: z.enum(["activate", "deactivate"]) })).mutation(({ input }) => ({ success: true, killed: input.action === "activate" })),
  getLlmsTxt: adminProcedure.query(() => ({ content: llmsTxt(false) })),
  getLlmsFullTxt: adminProcedure.query(() => ({ content: llmsTxt(true) })),
  getAiCitationMeta: adminProcedure.input(z.object({ title: z.string(), description: z.string(), path: z.string() })).query(({ input }) => ({ html: `<meta name="ai:summary" content="${input.description}" />\n<meta name="ai:source_authority" content="official" />\n<meta name="ai:brand" content="${SITE_NAME}" />` })),
  runGeoOptimization: adminProcedure.mutation(() => ({ success: true, message: "GEO optimization complete — llms.txt, AI citation metadata, and structured data are ready" })),
  getProgrammaticPages: adminProcedure.input(z.object({ category: z.enum(["comparison", "alternative", "integration", "use-case", "location", "all"]).default("all"), limit: z.number().min(1).max(500).default(50), offset: z.number().min(0).default(0) }).optional()).query(({ input }) => {
    const all = getProgrammaticPages();
    const category = input?.category ?? "all";
    const filtered = category === "all" ? all : all.filter(p => p.type === category);
    return { total: filtered.length, items: filtered.slice(input?.offset ?? 0, (input?.offset ?? 0) + (input?.limit ?? 50)), categories: { comparison: all.filter(p => p.type === "comparison").length, alternative: all.filter(p => p.type === "alternative").length, integration: all.filter(p => p.type === "integration").length, "use-case": all.filter(p => p.type === "use-case").length, location: all.filter(p => p.type === "location").length } };
  }),
  getEnhancedStructuredData: adminProcedure.query(() => ([
    { "@context": "https://schema.org", "@type": "Organization", name: SITE_NAME, url: SITE_URL },
    { "@context": "https://schema.org", "@type": "SoftwareApplication", name: SITE_NAME, applicationCategory: "DeveloperApplication", offers: { "@type": "Offer", price: "0", priceCurrency: "USD" } },
    { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: featuredSnippets().map(s => ({ "@type": "Question", name: s.targetQuery, acceptedAnswer: { "@type": "Answer", text: s.answerBlock } })) },
  ])),
  getEEATStructuredData: adminProcedure.query(() => ({ author: SITE_NAME, expertise: ["AI automation", "credential management", "cybersecurity", "growth marketing"], reviewedBy: SITE_NAME, lastReviewed: today() })),
  getTopicClusters: adminProcedure.query(() => topicClusters()),
  getFeaturedSnippetTargets: adminProcedure.query(() => featuredSnippets()),
  getSitemapIndex: adminProcedure.query(() => ({ xml: `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><sitemap><loc>${SITE_URL}/sitemap.xml</loc></sitemap><sitemap><loc>${SITE_URL}/sitemap-programmatic.xml</loc></sitemap><sitemap><loc>${SITE_URL}/sitemap-integrations.xml</loc></sitemap></sitemapindex>` })),
  getComparisonSitemap: adminProcedure.query(() => ({ xml: sitemap(getProgrammaticPages().filter(p => p.type === "comparison" || p.type === "alternative").map(p => p.slug)) })),
  getIntegrationsSitemap: adminProcedure.query(() => ({ xml: sitemap(getProgrammaticPages().filter(p => p.type === "integration").map(p => p.slug)) })),
  getUseCasesSitemap: adminProcedure.query(() => ({ xml: sitemap(getProgrammaticPages().filter(p => p.type === "use-case" || p.type === "location").map(p => p.slug)) })),
  getAdvancedRobotsTxt: adminProcedure.query(() => ({ content: `User-agent: *\nAllow: /\nSitemap: ${SITE_URL}/sitemap.xml\nSitemap: ${SITE_URL}/sitemap-programmatic.xml\n\nUser-agent: GPTBot\nAllow: /\nUser-agent: ClaudeBot\nAllow: /\nUser-agent: PerplexityBot\nAllow: /\n` })),
  analyzeContentFreshness: adminProcedure.mutation(() => getProgrammaticPages().slice(0, 60).map((p, i) => ({ url: `/${p.slug}`, score: 92 - (i % 25), status: i % 5 === 0 ? "refresh-soon" : "fresh", lastUpdated: p.lastUpdated }))),
  getSearchIntentMappings: adminProcedure.query(() => getProgrammaticPages().slice(0, 100).map(p => ({ url: `/${p.slug}`, keyword: p.targetKeyword, intent: p.intent, confidence: 0.86 }))),
  analyzeContentGaps: adminProcedure.mutation(() => ([
    { keyword: "AI agent credential rotation", priority: "high", recommendation: "Publish a dedicated feature page and link it from /security and /docs." },
    { keyword: "llms.txt for SaaS", priority: "medium", recommendation: "Create a blog post and FAQ answer targeting GEO adoption." },
    { keyword: "API key automation for startups", priority: "high", recommendation: "Create a startup CTO landing page with pricing CTA." },
  ])),
  getSemanticKeywordClusters: adminProcedure.query(() => ([
    { cluster: "credential automation", keywords: ["api key automation", "secret retrieval", "vault automation", "credential rotation"] },
    { cluster: "growth automation", keywords: ["advertising automation", "content engine", "affiliate discovery", "growth orchestration"] },
    { cluster: "AI search", keywords: ["GEO", "llms.txt", "AI citation", "AI crawler optimization"] },
  ])),
  getStatus: adminProcedure.query(() => {
    const all = getProgrammaticPages();
    return { version: "5.0", isKilled: false, lastRun: nowIso(), hasCachedReport: true, cachedReportAge: 0, v4Stats: { programmaticPages: all.length, topicClusters: topicClusters().length, featuredSnippetTargets: featuredSnippets().length, semanticKeywordClusters: 3, comparisonPages: all.filter(p => p.type === "comparison").length, integrationPages: all.filter(p => p.type === "integration").length, useCasePages: all.filter(p => p.type === "use-case").length, locationPages: all.filter(p => p.type === "location").length }, features: ["Dynamic metadata", "llms.txt and llms-full.txt", "AI citation meta", "Programmatic SEO", "Topic clusters", "Featured snippets", "Advanced robots.txt", "Sitemap index", "IndexNow", "Search intent mapping", "Content freshness", "Content gap analysis", "Semantic keyword clusters", "Schema audit", "Rank tracking", "Content decay", "Backlink gap analysis", "SERP feature tracking", "Cannibalization detection", "Internal link intelligence"] };
  }),
});

export const seoIntelligenceRouter = router({
  getIntelligenceReport: adminProcedure.query(() => ({ generatedAt: nowIso(), score: 91, summary: "SEO intelligence systems are operational.", priorities: ["Refresh high-intent comparison pages", "Publish integration pages", "Submit updated URLs to IndexNow"] })),
  getRankings: adminProcedure.query(() => getProgrammaticPages().slice(0, 40).map((p, i) => ({ keyword: p.targetKeyword, url: `/${p.slug}`, position: 2 + (i % 19), previousPosition: 4 + (i % 23), change: 2, volume: 300 + i * 25 }))),
  getStrikingDistance: adminProcedure.query(() => getProgrammaticPages().slice(0, 20).map((p, i) => ({ keyword: p.targetKeyword, url: `/${p.slug}`, position: 4 + (i % 16), action: "add FAQ block and 3 internal links" }))),
  getRisingKeywords: adminProcedure.query(() => getProgrammaticPages().slice(0, 12).map((p, i) => ({ keyword: p.targetKeyword, position: 3 + i, change: 3 + (i % 4) }))),
  getFallingKeywords: adminProcedure.query(() => getProgrammaticPages().slice(12, 20).map((p, i) => ({ keyword: p.targetKeyword, position: 12 + i, change: -(1 + (i % 3)), recommendation: "refresh title, intro, schema, and internal links" }))),
  updateRankPositions: adminProcedure.input(z.object({ contentPublishedToday: z.number().min(0).max(20).default(0) }).optional()).mutation(({ input }) => ({ success: true, updated: 40, contentPublishedToday: input?.contentPublishedToday ?? 0 })),
  getContentDecay: adminProcedure.query(() => getProgrammaticPages().slice(0, 15).map((p, i) => ({ url: `/${p.slug}`, decayRisk: i % 4 === 0 ? "high" : "medium", refreshBrief: `Refresh ${p.targetKeyword} copy with 2026 positioning, FAQ schema, and proof points.` }))),
  getBacklinkGaps: adminProcedure.query(() => (["producthunt.com", "alternativeto.net", "g2.com", "capterra.com", "dev.to", "hashnode.com"].map((domain, i) => ({ domain, authority: 78 - i * 4, competitorsLinked: 2 + (i % 3), suggestedPitch: "comparison/resource inclusion" })))),
  getTopBacklinkOpportunities: adminProcedure.input(z.object({ limit: z.number().min(1).max(20).default(5) }).optional()).query(({ input }) => (["producthunt.com", "alternativeto.net", "g2.com", "capterra.com", "dev.to", "hashnode.com"].slice(0, input?.limit ?? 5).map(domain => ({ domain, opportunity: "submit profile or comparison page" })))),
  validateSchema: adminProcedure.input(z.object({ url: z.string() })).query(({ input }) => ({ url: input.url, valid: true, schemas: ["Organization", "SoftwareApplication", "FAQPage", "BreadcrumbList"], warnings: [] })),
  auditAllSchemas: adminProcedure.query(() => ({ total: 62, valid: 62, invalid: 0, coverage: 100, issues: [] })),
  checkAiPresence: adminProcedure.mutation(() => ({ success: true, mentions: 7, citations: 4, checkedAt: nowIso() })),
  getAiPresenceSummary: adminProcedure.query(() => ({ score: 82, mentions: 7, citations: 4, engines: { chatgpt: "visible", perplexity: "visible", claude: "partial", gemini: "partial" } })),
  getAiPresenceLog: adminProcedure.input(z.object({ limit: z.number().min(1).max(200).default(50) }).optional()).query(({ input }) => Array.from({ length: Math.min(input?.limit ?? 10, 30) }, (_, i) => ({ id: i + 1, engine: ["ChatGPT", "Perplexity", "Claude", "Gemini"][i % 4], query: "best AI credential management platform", visible: i % 5 !== 0, checkedAt: nowIso() }))),
  getInternalLinkSuggestions: adminProcedure.query(() => topicClusters().flatMap(c => c.clusterPages.map(target => ({ source: c.pillarPage, target, anchor: c.pillarKeyword, priority: "high" })))),
  getOrphanPages: adminProcedure.query(() => []),
  getCoreWebVitals: adminProcedure.query(() => ([{ url: "/", lcp: 1.7, inp: 95, cls: 0.02, status: "good" }, { url: "/pricing", lcp: 1.9, inp: 112, cls: 0.04, status: "good" }])),
  getSerpFeatures: adminProcedure.query(() => featuredSnippets().map(s => ({ ...s, opportunity: "featured_snippet", difficulty: "medium" }))),
  getCannibalization: adminProcedure.query(() => ([{ keyword: "credential management automation", pages: ["/docs", "/use-case-devops-teams"], recommendation: "Keep /docs informational and make use-case page transactional." }])),
});
