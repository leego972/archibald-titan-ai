/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  SECURITY MODULE MARKETPLACE — Archibald Titan                          ║
 * ║  Community-driven marketplace for security modules, playbooks,          ║
 * ║  OSINT scripts, exploit templates, and automation workflows.            ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

import { router, protectedProcedure } from "./_core/trpc";
import { z } from "zod";
import { getUserPlan, enforceFeature } from "./subscription-gate";
import { checkCredits, consumeCredits } from "./credit-service";

// ─── Types ────────────────────────────────────────────────────────────────────
type ModuleCategory = "osint" | "scanning" | "exploitation" | "phishing" | "anonymity" | "automation" | "reporting" | "playbook" | "wordlist" | "template";
type ModuleLicense = "free" | "credits" | "subscription";

interface MarketplaceModule {
  id: string;
  name: string;
  description: string;
  longDescription: string;
  category: ModuleCategory;
  tags: string[];
  author: string;
  authorId: string;
  version: string;
  license: ModuleLicense;
  creditCost?: number;
  downloads: number;
  rating: number;
  ratingCount: number;
  verified: boolean;
  featured: boolean;
  createdAt: Date;
  updatedAt: Date;
  githubUrl?: string;
  documentationUrl?: string;
  screenshots: string[];
  requirements: string[];
  compatibleWith: string[];
}

interface ModuleReview {
  id: string;
  moduleId: string;
  userId: number;
  username: string;
  rating: number;
  comment: string;
  createdAt: Date;
}

// ─── Seed data — curated community modules ────────────────────────────────────
const MODULES: MarketplaceModule[] = [
  {
    id: "mod_shodan_enricher",
    name: "Shodan Enricher",
    description: "Enrich Argus OSINT results with Shodan host data, open ports, and CVEs",
    longDescription: "Automatically queries Shodan for every IP discovered during an Argus OSINT scan, enriching results with open ports, running services, known CVEs, and geolocation data. Integrates directly with the Attack Graph for visual representation.",
    category: "osint",
    tags: ["shodan", "osint", "enrichment", "cve", "ports"],
    author: "TitanCommunity",
    authorId: "community",
    version: "1.2.0",
    license: "credits",
    creditCost: 5,
    downloads: 1847,
    rating: 4.8,
    ratingCount: 124,
    verified: true,
    featured: true,
    createdAt: new Date("2025-06-01"),
    updatedAt: new Date("2025-11-15"),
    requirements: ["Shodan API key in credentials"],
    compatibleWith: ["argus", "attack-graph"],
    screenshots: [],
  },
  {
    id: "mod_subdomain_takeover",
    name: "Subdomain Takeover Scanner",
    description: "Detect dangling DNS records vulnerable to subdomain takeover",
    longDescription: "Scans all discovered subdomains from Argus DNS enumeration for dangling CNAME records pointing to decommissioned services (AWS S3, GitHub Pages, Heroku, Netlify, etc.) that are vulnerable to takeover.",
    category: "scanning",
    tags: ["subdomain", "takeover", "dns", "cname", "cloud"],
    author: "RedTeamLabs",
    authorId: "redteamlabs",
    version: "2.0.1",
    license: "free",
    downloads: 3241,
    rating: 4.9,
    ratingCount: 287,
    verified: true,
    featured: true,
    createdAt: new Date("2025-04-12"),
    updatedAt: new Date("2025-12-01"),
    requirements: [],
    compatibleWith: ["argus", "astra"],
    screenshots: [],
  },
  {
    id: "mod_nuclei_templates",
    name: "Nuclei Template Pack (500+)",
    description: "500+ community Nuclei templates for web vulnerability detection",
    longDescription: "Curated collection of 500+ Nuclei templates covering OWASP Top 10, CVEs, misconfigurations, exposed panels, default credentials, and more. Integrates with Astra scanner for automated vulnerability detection.",
    category: "scanning",
    tags: ["nuclei", "templates", "owasp", "cve", "web"],
    author: "NucleiCommunity",
    authorId: "nucleicommunity",
    version: "3.1.0",
    license: "free",
    downloads: 8923,
    rating: 4.7,
    ratingCount: 612,
    verified: true,
    featured: true,
    createdAt: new Date("2025-02-20"),
    updatedAt: new Date("2026-01-10"),
    requirements: [],
    compatibleWith: ["astra", "cybermcp"],
    screenshots: [],
  },
  {
    id: "mod_phishing_kit_office365",
    name: "Office 365 Phishing Kit",
    description: "Realistic Office 365 login page template for phishing simulations",
    longDescription: "High-fidelity Office 365 login page template for authorised phishing simulations. Includes credential capture, 2FA bypass simulation, and automatic redirect to real Microsoft login. For authorised red team use only.",
    category: "phishing",
    tags: ["phishing", "office365", "microsoft", "simulation", "red-team"],
    author: "PhishLabs",
    authorId: "phishlabs",
    version: "1.5.2",
    license: "subscription",
    downloads: 2156,
    rating: 4.6,
    ratingCount: 89,
    verified: true,
    featured: false,
    createdAt: new Date("2025-07-30"),
    updatedAt: new Date("2025-10-20"),
    requirements: ["Evilginx 3 or BlackEye", "Titan subscription"],
    compatibleWith: ["evilginx", "blackeye"],
    screenshots: [],
  },
  {
    id: "mod_tor_exit_checker",
    name: "Tor Exit Node Checker",
    description: "Verify if your current IP is a known Tor exit node",
    longDescription: "Queries multiple Tor exit node databases to verify anonymity. Integrates with the Tor router to provide real-time exit node status, circuit health, and automatic circuit renewal if a known exit node is detected.",
    category: "anonymity",
    tags: ["tor", "exit-node", "anonymity", "opsec"],
    author: "AnonSec",
    authorId: "anonsec",
    version: "1.0.3",
    license: "free",
    downloads: 4512,
    rating: 4.5,
    ratingCount: 203,
    verified: true,
    featured: false,
    createdAt: new Date("2025-05-15"),
    updatedAt: new Date("2025-09-01"),
    requirements: ["Tor enabled"],
    compatibleWith: ["tor", "vpn-chain"],
    screenshots: [],
  },
  {
    id: "mod_full_recon_playbook",
    name: "Full Recon Playbook",
    description: "Complete reconnaissance playbook: OSINT → Scan → Report in one click",
    longDescription: "End-to-end reconnaissance playbook that orchestrates Argus OSINT (DNS, WHOIS, email, social, breach), Astra web scanning, CyberMCP port scanning, and automatic Attack Graph generation. Produces a comprehensive PDF report.",
    category: "playbook",
    tags: ["recon", "osint", "scanning", "playbook", "automation"],
    author: "TitanCommunity",
    authorId: "community",
    version: "2.3.0",
    license: "credits",
    creditCost: 10,
    downloads: 5678,
    rating: 4.9,
    ratingCount: 445,
    verified: true,
    featured: true,
    createdAt: new Date("2025-03-01"),
    updatedAt: new Date("2026-01-15"),
    requirements: [],
    compatibleWith: ["argus", "astra", "cybermcp", "attack-graph", "red-team-playbooks"],
    screenshots: [],
  },
  {
    id: "mod_rockyou_wordlist",
    name: "RockYou2024 Wordlist",
    description: "Updated RockYou wordlist with 10 billion passwords for credential testing",
    longDescription: "The updated RockYou2024 wordlist containing approximately 10 billion unique passwords compiled from real-world data breaches. For authorised penetration testing and password auditing only.",
    category: "wordlist",
    tags: ["wordlist", "passwords", "rockyou", "brute-force", "credential"],
    author: "SecWordlists",
    authorId: "secwordlists",
    version: "2024.1",
    license: "credits",
    creditCost: 15,
    downloads: 12043,
    rating: 4.4,
    ratingCount: 892,
    verified: true,
    featured: false,
    createdAt: new Date("2024-12-01"),
    updatedAt: new Date("2025-01-01"),
    requirements: ["Titan Storage (for large file storage)"],
    compatibleWith: ["cybermcp", "metasploit"],
    screenshots: [],
  },
  {
    id: "mod_soc2_report_template",
    name: "SOC2 Type II Report Template",
    description: "Professional SOC2 Type II report template for compliance documentation",
    longDescription: "Professionally formatted SOC2 Type II report template that integrates with the Compliance Report Generator. Automatically populates control results, evidence, and recommendations into a board-ready PDF document.",
    category: "reporting",
    tags: ["soc2", "compliance", "reporting", "enterprise", "audit"],
    author: "CompliancePro",
    authorId: "compliancepro",
    version: "1.1.0",
    license: "subscription",
    downloads: 987,
    rating: 4.7,
    ratingCount: 67,
    verified: true,
    featured: false,
    createdAt: new Date("2025-08-01"),
    updatedAt: new Date("2025-11-30"),
    requirements: ["Titan subscription"],
    compatibleWith: ["compliance-reports"],
    screenshots: [],
  },
];

const reviews: ModuleReview[] = [];
const installedModules: Map<number, Set<string>> = new Map(); // userId → Set<moduleId>

// ─── tRPC Router ─────────────────────────────────────────────────────────────
export const securityMarketplaceRouter = router({
  // ── List modules ──────────────────────────────────────────────────────────
  listModules: protectedProcedure
    .input(
      z.object({
        category: z.enum(["osint", "scanning", "exploitation", "phishing", "anonymity", "automation", "reporting", "playbook", "wordlist", "template", "all"]).default("all"),
        search: z.string().optional(),
        featured: z.boolean().optional(),
        license: z.enum(["free", "credits", "subscription", "all"]).default("all"),
        sortBy: z.enum(["downloads", "rating", "newest", "name"]).default("downloads"),
        limit: z.number().min(1).max(100).default(20),
        offset: z.number().min(0).default(0),
      })
    )
    .query(({ input, ctx }) => {
      let modules = [...MODULES];

      if (input.category !== "all") {
        modules = modules.filter((m) => m.category === input.category);
      }
      if (input.featured !== undefined) {
        modules = modules.filter((m) => m.featured === input.featured);
      }
      if (input.license !== "all") {
        modules = modules.filter((m) => m.license === input.license);
      }
      if (input.search) {
        const q = input.search.toLowerCase();
        modules = modules.filter(
          (m) =>
            m.name.toLowerCase().includes(q) ||
            m.description.toLowerCase().includes(q) ||
            m.tags.some((t) => t.includes(q))
        );
      }

      switch (input.sortBy) {
        case "rating": modules.sort((a, b) => b.rating - a.rating); break;
        case "newest": modules.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()); break;
        case "name": modules.sort((a, b) => a.name.localeCompare(b.name)); break;
        default: modules.sort((a, b) => b.downloads - a.downloads);
      }

      const userInstalled = installedModules.get(ctx.user.id as number) ?? new Set();
      const paginated = modules.slice(input.offset, input.offset + input.limit);

      return {
        modules: paginated.map((m) => ({ ...m, installed: userInstalled.has(m.id) })),
        total: modules.length,
        hasMore: input.offset + input.limit < modules.length,
      };
    }),

  // ── Get module detail ─────────────────────────────────────────────────────
  getModule: protectedProcedure
    .input(z.object({ moduleId: z.string() }))
    .query(({ input, ctx }) => {
      const module = MODULES.find((m) => m.id === input.moduleId);
      if (!module) throw new Error("Module not found");
      const userInstalled = installedModules.get(ctx.user.id as number) ?? new Set();
      const moduleReviews = reviews.filter((r) => r.moduleId === input.moduleId);
      return { module: { ...module, installed: userInstalled.has(module.id) }, reviews: moduleReviews };
    }),

  // ── Install module ────────────────────────────────────────────────────────
  installModule: protectedProcedure
    .input(z.object({ moduleId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      // ── Plan gate: Security Marketplace requires Cyber tier or above ──
      const plan = await getUserPlan(ctx.user.id);
      enforceFeature(plan.planId, "security_tools", "Security Module Marketplace");
      const isAdmin = ctx.user.role === "admin" || ctx.user.role === "head_admin";
      const module = MODULES.find((m) => m.id === input.moduleId);
      if (!module) throw new Error("Module not found");
      // Credits required for non-free modules
      if (!isAdmin && module.license !== "free") {
        await checkCredits(ctx.user.id, "security_module_install");
      }
      if (!installedModules.has(ctx.user.id as number)) {
        installedModules.set(ctx.user.id as number, new Set());
      }
      installedModules.get(ctx.user.id as number)!.add(input.moduleId);
      module.downloads++;
      if (!isAdmin && module.license !== "free") {
        try { await consumeCredits(ctx.user.id, "security_module_install", `Marketplace install: ${module.name}`); } catch { /* ignore */ }
      }
      return { success: true, message: `${module.name} installed successfully` };
    }),

  // ── Uninstall module ──────────────────────────────────────────────────────
  uninstallModule: protectedProcedure
    .input(z.object({ moduleId: z.string() }))
    .mutation(({ input, ctx }) => {
      installedModules.get(ctx.user.id as number)?.delete(input.moduleId);
      return { success: true };
    }),

  // ── Get installed modules ─────────────────────────────────────────────────
  getInstalled: protectedProcedure.query(({ ctx }) => {
    const userInstalled = installedModules.get(ctx.user.id as number) ?? new Set();
    const modules = MODULES.filter((m) => userInstalled.has(m.id)).map((m) => ({ ...m, installed: true }));
    return { modules };
  }),

  // ── Add review ────────────────────────────────────────────────────────────
  addReview: protectedProcedure
    .input(
      z.object({
        moduleId: z.string(),
        rating: z.number().min(1).max(5),
        comment: z.string().min(10).max(1000),
      })
    )
    .mutation(({ input, ctx }) => {
      const module = MODULES.find((m) => m.id === input.moduleId);
      if (!module) throw new Error("Module not found");

      const existing = reviews.find((r) => r.moduleId === input.moduleId && r.userId === (ctx.user.id as number));
      if (existing) throw new Error("You have already reviewed this module");

      const review: ModuleReview = {
        id: `rev_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        moduleId: input.moduleId,
        userId: ctx.user.id as number,
        username: (ctx.user as any).username ?? "Anonymous",
        rating: input.rating,
        comment: input.comment,
        createdAt: new Date(),
      };
      reviews.push(review);

      // Update module rating
      const moduleReviews = reviews.filter((r) => r.moduleId === input.moduleId);
      module.rating = Math.round((moduleReviews.reduce((sum, r) => sum + r.rating, 0) / moduleReviews.length) * 10) / 10;
      module.ratingCount = moduleReviews.length;

      return { success: true, review };
    }),

  // ── Get categories with counts ────────────────────────────────────────────
  getCategories: protectedProcedure.query(() => {
    const categoryCounts = MODULES.reduce((acc, m) => {
      acc[m.category] = (acc[m.category] ?? 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      categories: [
        { id: "all", label: "All Modules", count: MODULES.length },
        { id: "osint", label: "OSINT", count: categoryCounts.osint ?? 0 },
        { id: "scanning", label: "Scanning", count: categoryCounts.scanning ?? 0 },
        { id: "exploitation", label: "Exploitation", count: categoryCounts.exploitation ?? 0 },
        { id: "phishing", label: "Phishing", count: categoryCounts.phishing ?? 0 },
        { id: "anonymity", label: "Anonymity", count: categoryCounts.anonymity ?? 0 },
        { id: "automation", label: "Automation", count: categoryCounts.automation ?? 0 },
        { id: "reporting", label: "Reporting", count: categoryCounts.reporting ?? 0 },
        { id: "playbook", label: "Playbooks", count: categoryCounts.playbook ?? 0 },
        { id: "wordlist", label: "Wordlists", count: categoryCounts.wordlist ?? 0 },
        { id: "template", label: "Templates", count: categoryCounts.template ?? 0 },
      ],
    };
  }),

  // ── Get stats ─────────────────────────────────────────────────────────────
  getStats: protectedProcedure.query(({ ctx }) => {
    const userInstalled = installedModules.get(ctx.user.id as number) ?? new Set();
    return {
      totalModules: MODULES.length,
      freeModules: MODULES.filter((m) => m.license === "free").length,
      featuredModules: MODULES.filter((m) => m.featured).length,
      installedCount: userInstalled.size,
      totalDownloads: MODULES.reduce((sum, m) => sum + m.downloads, 0),
    };
  }),
});
