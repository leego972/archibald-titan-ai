/**
 * Security Module Marketplace - DB-backed version
 * Replaces in-memory MODULES array with DB persistence
 */
import { router, adminProcedure } from "./_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { getUserPlan, enforceFeature, enforceAdminFeature } from "./subscription-gate";
import { checkCredits, consumeCredits } from "./credit-service";
import * as db from "./db";
import type { InsertSecurityModule } from "../drizzle/schema";

function tryParse(val: string | null | undefined): any[] {
  try { return JSON.parse(val as string); } catch { return []; }
}

const SEED: InsertSecurityModule[] = [
  { slug:"mod_shodan_enricher", name:"Shodan Enricher", description:"Enrich Argus OSINT results with Shodan host data, open ports, and CVEs", longDescription:"Connects to the Shodan API to pull host intelligence for any IP discovered during an Argus scan. Returns open ports, running services, known CVEs, geolocation, and ISP data. Requires a Shodan API key stored in your Titan vault.", category:"osint", tags:JSON.stringify(["shodan","osint","enrichment","cve","ports"]), authorId:"platform", authorLabel:"Archibald Titan", version:"1.2.0", license:"credits", creditCost:5, verified:true, featured:true, status:"published", requirements:JSON.stringify(["Shodan API key","Argus OSINT"]), compatibleWith:JSON.stringify(["argus","attack-graph"]) },
  { slug:"mod_subdomain_takeover", name:"Subdomain Takeover Scanner", description:"Detect dangling DNS records vulnerable to subdomain takeover", longDescription:"Scans all discovered subdomains for dangling CNAME records pointing to deprovisioned cloud services. Outputs a prioritised list of vulnerable subdomains with remediation steps.", category:"scanning", tags:JSON.stringify(["subdomain","dns","takeover","recon","cloud"]), authorId:"platform", authorLabel:"Archibald Titan", version:"2.0.1", license:"free", verified:true, featured:true, status:"published", requirements:JSON.stringify(["Target domain"]), compatibleWith:JSON.stringify(["argus","astra"]) },
  { slug:"mod_nuclei_templates", name:"Nuclei Template Pack (500+)", description:"500+ curated Nuclei templates for web vulnerability detection", longDescription:"A curated pack of 500+ Nuclei templates covering CVEs, misconfigurations, exposed panels, default credentials, and web application vulnerabilities. Updated quarterly. Integrates directly with Astra Scanner.", category:"scanning", tags:JSON.stringify(["nuclei","templates","web","cve","misconfiguration"]), authorId:"platform", authorLabel:"Archibald Titan", version:"3.1.0", license:"free", verified:true, featured:true, status:"published", requirements:JSON.stringify(["Astra Scanner"]), compatibleWith:JSON.stringify(["astra"]) },
  { slug:"mod_phishing_kit_office365", name:"Office 365 Phishing Kit", description:"Realistic Office 365 login page template for authorised phishing simulations", longDescription:"A high-fidelity Office 365 login page template for use in authorised red team phishing simulations. Includes credential capture logging, MFA bypass simulation, and automatic redirect to the real O365 portal post-capture. Requires written authorisation from the target organisation.", category:"phishing", tags:JSON.stringify(["phishing","office365","evilginx","redteam","simulation"]), authorId:"platform", authorLabel:"Archibald Titan", version:"1.5.2", license:"subscription", verified:true, featured:false, status:"published", requirements:JSON.stringify(["Evilginx","Written authorisation"]), compatibleWith:JSON.stringify(["evilginx"]) },
  { slug:"mod_tor_exit_checker", name:"Tor Exit Node Checker", description:"Verify if your current IP is a known Tor exit node", longDescription:"Queries the Tor Project exit node list and multiple threat intelligence feeds to determine if a given IP address is a known Tor exit node. Returns exit node status, last seen timestamp, and associated relay fingerprint.", category:"anonymity", tags:JSON.stringify(["tor","anonymity","exit-node","ip","opsec"]), authorId:"platform", authorLabel:"Archibald Titan", version:"1.0.3", license:"free", verified:true, featured:false, status:"published", requirements:JSON.stringify([]), compatibleWith:JSON.stringify([]) },
  { slug:"mod_full_recon_playbook", name:"Full Recon Playbook", description:"Complete reconnaissance playbook: OSINT to Scan to Report in one click", longDescription:"An automated playbook that chains Argus OSINT, Astra Scanner, and the Report Generator into a single end-to-end reconnaissance workflow. Input a target domain and receive a full recon report in under 10 minutes.", category:"playbook", tags:JSON.stringify(["playbook","recon","automation","osint","scanning"]), authorId:"platform", authorLabel:"Archibald Titan", version:"2.3.0", license:"credits", creditCost:10, verified:true, featured:true, status:"published", requirements:JSON.stringify(["Argus OSINT","Astra Scanner"]), compatibleWith:JSON.stringify(["argus","astra","report-generator"]) },
  { slug:"mod_rockyou_wordlist", name:"RockYou2024 Wordlist", description:"Updated RockYou wordlist with 10 billion passwords for credential testing", longDescription:"The updated RockYou2024 wordlist containing approximately 10 billion unique plaintext passwords compiled from data breaches. For use in authorised password auditing and penetration testing engagements only.", category:"wordlist", tags:JSON.stringify(["wordlist","passwords","rockyou","bruteforce","credentials"]), authorId:"platform", authorLabel:"Archibald Titan", version:"2024.1", license:"credits", creditCost:15, verified:true, featured:false, status:"published", requirements:JSON.stringify(["Sufficient disk space (45GB uncompressed)"]), compatibleWith:JSON.stringify([]) },
  { slug:"mod_soc2_report_template", name:"SOC2 Type II Report Template", description:"Professional SOC2 Type II report template for compliance documentation", longDescription:"A comprehensive SOC2 Type II report template covering all five Trust Service Criteria. Includes pre-written control descriptions, evidence collection checklists, and auditor-ready formatting. Exported as DOCX and PDF.", category:"reporting", tags:JSON.stringify(["soc2","compliance","reporting","audit","template"]), authorId:"platform", authorLabel:"Archibald Titan", version:"1.0.0", license:"free", verified:true, featured:false, status:"published", requirements:JSON.stringify([]), compatibleWith:JSON.stringify([]) },
  { slug:"mod_owasp_top10_scanner", name:"OWASP Top 10 Scanner", description:"Automated scanner for all OWASP Top 10 vulnerabilities", longDescription:"Runs automated checks for all OWASP Top 10 2021 vulnerabilities against a target web application. Covers injection, broken authentication, sensitive data exposure, XXE, broken access control, security misconfiguration, XSS, insecure deserialisation, known vulnerable components, and insufficient logging.", category:"scanning", tags:JSON.stringify(["owasp","web","scanning","top10","vulnerabilities"]), authorId:"platform", authorLabel:"Archibald Titan", version:"1.3.0", license:"credits", creditCost:8, verified:true, featured:true, status:"published", requirements:JSON.stringify(["Astra Scanner","Target web application URL"]), compatibleWith:JSON.stringify(["astra"]) },
  { slug:"mod_email_harvester", name:"Email Harvester Pro", description:"Extract email addresses from domains, LinkedIn, and public sources", longDescription:"Harvests email addresses associated with a target organisation from public sources including domain WHOIS, certificate transparency logs, LinkedIn, GitHub commits, and Pastebin. Validates addresses and deduplicates results.", category:"osint", tags:JSON.stringify(["email","osint","harvesting","recon","linkedin"]), authorId:"platform", authorLabel:"Archibald Titan", version:"1.1.0", license:"credits", creditCost:6, verified:true, featured:false, status:"published", requirements:JSON.stringify(["Target domain or organisation name"]), compatibleWith:JSON.stringify(["argus"]) },
  { slug:"mod_cloud_enum", name:"Cloud Asset Enumerator", description:"Discover exposed S3 buckets, Azure blobs, and GCP storage for a target", longDescription:"Enumerates publicly accessible cloud storage assets belonging to a target organisation across AWS S3, Azure Blob Storage, and Google Cloud Storage. Uses permutation-based bucket name guessing and DNS enumeration.", category:"osint", tags:JSON.stringify(["cloud","s3","azure","gcp","enumeration","osint"]), authorId:"platform", authorLabel:"Archibald Titan", version:"2.1.0", license:"credits", creditCost:7, verified:true, featured:false, status:"published", requirements:JSON.stringify(["Target organisation name or domain"]), compatibleWith:JSON.stringify(["argus","astra"]) },
  { slug:"mod_password_spray", name:"Password Spray Toolkit", description:"Controlled password spray tool for Active Directory and cloud identity providers", longDescription:"A controlled password spray toolkit for authorised Active Directory and cloud identity provider assessments. Implements intelligent timing to avoid account lockouts. Supports custom wordlists, MFA detection, and automatic lockout threshold detection.", category:"exploitation", tags:JSON.stringify(["password","spray","activedirectory","azuread","exploitation"]), authorId:"platform", authorLabel:"Archibald Titan", version:"1.4.0", license:"subscription", verified:true, featured:false, status:"published", requirements:JSON.stringify(["Written authorisation","Target identity provider details"]), compatibleWith:JSON.stringify([]) },
  { slug:"mod_network_pivot", name:"Network Pivot Toolkit", description:"Establish and manage network pivots through compromised hosts", longDescription:"A toolkit for establishing and managing network pivots through compromised hosts during authorised penetration tests. Supports SSH tunnelling, SOCKS5 proxying, port forwarding, and reverse shells. Integrates with Metasploit for session management.", category:"exploitation", tags:JSON.stringify(["pivot","tunnelling","metasploit","socks5","lateral-movement"]), authorId:"platform", authorLabel:"Archibald Titan", version:"1.0.0", license:"subscription", verified:true, featured:false, status:"published", requirements:JSON.stringify(["Metasploit","Written authorisation"]), compatibleWith:JSON.stringify(["metasploit"]) },
  { slug:"mod_api_security_scanner", name:"API Security Scanner", description:"Test REST and GraphQL APIs for OWASP API Top 10 vulnerabilities", longDescription:"Automated scanner for REST and GraphQL APIs covering the OWASP API Security Top 10. Tests for broken object-level authorisation, excessive data exposure, lack of rate limiting, broken function-level authorisation, mass assignment, security misconfiguration, injection, improper asset management, and insufficient logging.", category:"scanning", tags:JSON.stringify(["api","rest","graphql","owasp","scanning"]), authorId:"platform", authorLabel:"Archibald Titan", version:"1.2.0", license:"credits", creditCost:10, verified:true, featured:true, status:"published", requirements:JSON.stringify(["Target API URL or OpenAPI spec"]), compatibleWith:JSON.stringify(["astra"]) },
  { slug:"mod_dark_web_monitor", name:"Dark Web Monitor", description:"Monitor Tor hidden services and paste sites for credential leaks", longDescription:"Monitors Tor hidden services, paste sites, and dark web forums for leaked credentials, PII, and proprietary data matching your configured keywords and domains. Sends real-time alerts when matches are found.", category:"osint", tags:JSON.stringify(["darkweb","tor","monitoring","credentials","leaks"]), authorId:"platform", authorLabel:"Archibald Titan", version:"1.0.0", license:"subscription", verified:true, featured:true, status:"published", requirements:JSON.stringify(["Tor connectivity"]), compatibleWith:JSON.stringify(["argus"]) },
  { slug:"mod_ssl_tls_auditor", name:"SSL/TLS Configuration Auditor", description:"Deep audit of SSL/TLS configuration, cipher suites, and certificate chains", longDescription:"Performs a comprehensive audit of SSL/TLS configuration for a target host. Tests for weak cipher suites, deprecated protocol versions, certificate chain issues, HSTS configuration, certificate transparency, OCSP stapling, and known vulnerabilities including POODLE, BEAST, HEARTBLEED, DROWN, and ROBOT.", category:"scanning", tags:JSON.stringify(["ssl","tls","certificates","ciphers","scanning"]), authorId:"platform", authorLabel:"Archibald Titan", version:"2.0.0", license:"free", verified:true, featured:false, status:"published", requirements:JSON.stringify(["Target hostname"]), compatibleWith:JSON.stringify(["astra"]) },
  { slug:"mod_social_engineering_toolkit", name:"Social Engineering Toolkit", description:"Templates and scripts for authorised social engineering assessments", longDescription:"A collection of templates and scripts for authorised social engineering assessments. Includes pretexting scripts, vishing call guides, USB drop payload templates, and physical security assessment checklists. All templates include legal disclaimer sections.", category:"automation", tags:JSON.stringify(["social-engineering","vishing","pretexting","physical","redteam"]), authorId:"platform", authorLabel:"Archibald Titan", version:"1.1.0", license:"subscription", verified:true, featured:false, status:"published", requirements:JSON.stringify(["Written authorisation"]), compatibleWith:JSON.stringify([]) },
  { slug:"mod_container_security", name:"Container Security Scanner", description:"Scan Docker images and Kubernetes clusters for vulnerabilities and misconfigurations", longDescription:"Scans Docker images and Kubernetes clusters for known CVEs, misconfigurations, and security best practice violations. Checks image layers against vulnerability databases, Kubernetes RBAC misconfigurations, exposed secrets in environment variables, privileged containers, and network policy gaps.", category:"scanning", tags:JSON.stringify(["docker","kubernetes","containers","cve","devops"]), authorId:"platform", authorLabel:"Archibald Titan", version:"1.3.0", license:"credits", creditCost:8, verified:true, featured:false, status:"published", requirements:JSON.stringify(["Docker or Kubernetes access"]), compatibleWith:JSON.stringify(["astra"]) },
  { slug:"mod_wireless_audit", name:"Wireless Network Auditor", description:"Audit Wi-Fi networks for WPA2/WPA3 weaknesses and rogue access points", longDescription:"Audits wireless networks for WPA2/WPA3 configuration weaknesses, rogue access points, deauthentication attack exposure, PMKID capture, and KRACK vulnerability. Includes a passive monitoring mode for detecting evil twin attacks.", category:"scanning", tags:JSON.stringify(["wifi","wireless","wpa2","wpa3","rogue-ap"]), authorId:"platform", authorLabel:"Archibald Titan", version:"1.0.0", license:"subscription", verified:true, featured:false, status:"published", requirements:JSON.stringify(["Wireless adapter with monitor mode support","Written authorisation"]), compatibleWith:JSON.stringify([]) },
  { slug:"mod_pentest_report_template", name:"Penetration Test Report Template", description:"Professional penetration test report template with executive and technical sections", longDescription:"A professional penetration test report template covering executive summary, scope and methodology, risk ratings, findings with CVSS scoring, proof-of-concept evidence sections, and remediation recommendations. Available in DOCX, PDF, and Markdown formats.", category:"reporting", tags:JSON.stringify(["pentest","report","template","cvss","compliance"]), authorId:"platform", authorLabel:"Archibald Titan", version:"3.0.0", license:"free", verified:true, featured:true, status:"published", requirements:JSON.stringify([]), compatibleWith:JSON.stringify([]) },
  { slug:"mod_threat_intel_aggregator", name:"Threat Intelligence Aggregator", description:"Aggregate IOCs from multiple threat intelligence feeds into a unified dashboard", longDescription:"Aggregates indicators of compromise from multiple public and commercial threat intelligence feeds including AlienVault OTX, Abuse.ch, Emerging Threats, and Feodo Tracker. Deduplicates, scores, and enriches IOCs with context. Exports to STIX/TAXII, CSV, or direct SIEM integration.", category:"automation", tags:JSON.stringify(["threat-intel","ioc","stix","taxii","siem"]), authorId:"platform", authorLabel:"Archibald Titan", version:"1.2.0", license:"credits", creditCost:12, verified:true, featured:false, status:"published", requirements:JSON.stringify(["SIEM integration (optional)"]), compatibleWith:JSON.stringify(["siem-integration"]) },
  { slug:"mod_active_directory_audit", name:"Active Directory Security Auditor", description:"Comprehensive AD security audit: Kerberoasting, AS-REP roasting, ACL abuse paths", longDescription:"Performs a comprehensive Active Directory security audit covering Kerberoastable accounts, AS-REP roasting candidates, DCSync rights holders, unconstrained delegation, ACL abuse paths, password policy weaknesses, stale accounts, and AdminSDHolder misconfigurations. Generates a BloodHound-compatible graph export.", category:"exploitation", tags:JSON.stringify(["activedirectory","kerberoasting","bloodhound","acl","windows"]), authorId:"platform", authorLabel:"Archibald Titan", version:"2.1.0", license:"subscription", verified:true, featured:true, status:"published", requirements:JSON.stringify(["Domain user credentials","Written authorisation"]), compatibleWith:JSON.stringify([]) },
  { slug:"mod_iot_ot_scanner", name:"IoT and OT Device Scanner", description:"Fingerprint and audit IoT devices, industrial control systems, and embedded hardware", longDescription:"Specialised scanner for Internet of Things and Operational Technology environments. Identifies devices by banner grabbing and protocol fingerprinting including Modbus, DNP3, BACnet, EtherNet/IP, MQTT, and CoAP. Checks for default credentials, unencrypted protocols, outdated firmware versions, and unauthenticated MQTT brokers.", category:"scanning", tags:JSON.stringify(["iot","ot","modbus","mqtt","scada","embedded","firmware"]), authorId:"platform", authorLabel:"Archibald Titan", version:"1.1.0", license:"credits", creditCost:18, verified:true, featured:false, status:"published", requirements:JSON.stringify(["Network access to target subnet","Written authorisation"]), compatibleWith:JSON.stringify(["attack-graph","siem-integration","astra"]) },
];

db.seedSecurityModulesIfEmpty(SEED).catch(() => {});

export const securityMarketplaceRouter = router({
  listModules: adminProcedure
    .input(z.object({
      category: z.enum(["osint","scanning","exploitation","phishing","anonymity","automation","reporting","playbook","wordlist","template","all"]).default("all"),
      search: z.string().optional(),
      featured: z.boolean().optional(),
      license: z.enum(["free","credits","subscription","all"]).default("all"),
      sortBy: z.enum(["downloads","rating","newest","name"]).default("downloads"),
      limit: z.number().min(1).max(100).default(20),
      offset: z.number().min(0).default(0),
    }))
    .query(async ({ input, ctx }) => {
    enforceAdminFeature(ctx.user.role, "Security Marketplace");
      const modules = await db.listSecurityModules({ category: input.category, search: input.search, featured: input.featured, limit: 500 });
      const installedSlugs = new Set((await db.getSecurityModuleInstalls(ctx.user.id as number)).map(i => i.moduleSlug));
      let filtered = input.license !== "all" ? modules.filter(m => m.license === input.license) : [...modules];
      switch (input.sortBy) {
        case "rating": filtered.sort((a, b) => b.rating - a.rating); break;
        case "newest": filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()); break;
        case "name": filtered.sort((a, b) => a.name.localeCompare(b.name)); break;
        default: filtered.sort((a, b) => b.downloads - a.downloads);
      }
      const paginated = filtered.slice(input.offset, input.offset + input.limit);
      return { modules: paginated.map(m => ({ ...m, tags: tryParse(m.tags), requirements: tryParse(m.requirements), compatibleWith: tryParse(m.compatibleWith), screenshots: tryParse(m.screenshots), installed: installedSlugs.has(m.slug) })), total: filtered.length, hasMore: input.offset + input.limit < filtered.length };
    }),

  getModule: adminProcedure
    .input(z.object({ moduleId: z.string() }))
    .query(async ({ input, ctx }) => {
    enforceAdminFeature(ctx.user.role, "Security Marketplace");
      const module = await db.getSecurityModuleBySlug(input.moduleId);
      if (!module) throw new Error(`Security module not found: ${input.moduleId}`);
      const installed = await db.isSecurityModuleInstalled(ctx.user.id as number, module.slug);
      const reviews = await db.getSecurityModuleReviews(module.slug);
      return { module: { ...module, tags: tryParse(module.tags), requirements: tryParse(module.requirements), compatibleWith: tryParse(module.compatibleWith), screenshots: tryParse(module.screenshots), installed }, reviews };
    }),

  installModule: adminProcedure
    .input(z.object({ moduleId: z.string() }))
    .mutation(async ({ input, ctx }) => {
    enforceAdminFeature(ctx.user.role, "Security Marketplace");
      const plan = await getUserPlan(ctx.user.id);
      enforceFeature(plan.planId, "security_tools", "Security Module Marketplace");
      const isAdmin = ctx.user.role === "admin" || ctx.user.role === "head_admin";
      const module = await db.getSecurityModuleBySlug(input.moduleId);
      if (!module) throw new Error(`Security module not found: ${input.moduleId}`);
      if (await db.isSecurityModuleInstalled(ctx.user.id as number, module.slug)) return { success: true, message: module.name + " is already installed" };
      await db.installSecurityModule({ userId: ctx.user.id as number, moduleSlug: module.slug, moduleName: module.name, version: module.version });
      await db.incrementSecurityModuleDownloads(module.slug);
      return { success: true, message: module.name + " installed successfully" };
    }),

  uninstallModule: adminProcedure
    .input(z.object({ moduleId: z.string() }))
    .mutation(async ({ input, ctx }) => {
    enforceAdminFeature(ctx.user.role, "Security Marketplace");
      await db.uninstallSecurityModule(ctx.user.id as number, input.moduleId);
      return { success: true };
    }),

  getInstalled: adminProcedure.query(async ({ ctx }) => {
    enforceAdminFeature(ctx.user.role, "Security Marketplace");
    const installs = await db.getSecurityModuleInstalls(ctx.user.id as number);
    if (installs.length === 0) return { modules: [] };
    const slugs = new Set(installs.map(i => i.moduleSlug));
    const all = await db.listSecurityModules({ limit: 500 });
    return { modules: all.filter(m => slugs.has(m.slug)).map(m => ({ ...m, tags: tryParse(m.tags), requirements: tryParse(m.requirements), compatibleWith: tryParse(m.compatibleWith), screenshots: tryParse(m.screenshots), installed: true })) };
  }),

  addReview: adminProcedure
    .input(z.object({ moduleId: z.string(), rating: z.number().min(1).max(5), comment: z.string().min(10).max(1000) }))
    .mutation(async ({ input, ctx }) => {
    enforceAdminFeature(ctx.user.role, "Security Marketplace");
      const module = await db.getSecurityModuleBySlug(input.moduleId);
      if (!module) throw new Error(`Security module not found: ${input.moduleId}`);
      const existing = (await db.getSecurityModuleReviews(input.moduleId)).find(r => r.userId === (ctx.user.id as number));
      if (existing) throw new TRPCError({ code: "CONFLICT", message: "You have already reviewed this module" });
      const review = await db.addSecurityModuleReview({ moduleSlug: input.moduleId, userId: ctx.user.id as number, username: (ctx.user as any).username ?? "Anonymous", rating: input.rating, comment: input.comment });
      return { success: true, review };
    }),

  rateModule: adminProcedure
    .input(z.object({ moduleId: z.string(), rating: z.number().min(1).max(5), comment: z.string().min(10).max(1000) }))
    .mutation(async ({ input, ctx }) => {
    enforceAdminFeature(ctx.user.role, "Security Marketplace");
      const module = await db.getSecurityModuleBySlug(input.moduleId);
      if (!module) throw new Error(`Security module not found: ${input.moduleId}`);
      const existing = (await db.getSecurityModuleReviews(input.moduleId)).find(r => r.userId === (ctx.user.id as number));
      if (existing) throw new TRPCError({ code: "CONFLICT", message: "You have already reviewed this module" });
      const review = await db.addSecurityModuleReview({ moduleSlug: input.moduleId, userId: ctx.user.id as number, username: (ctx.user as any).username ?? "Anonymous", rating: input.rating, comment: input.comment });
      return { success: true, review };
    }),

  publishModule: adminProcedure
    .input(z.object({ name: z.string().min(3).max(80), description: z.string().min(10).max(300), category: z.enum(["osint","scanning","exploitation","phishing","anonymity","automation","reporting","playbook","wordlist","template"]), version: z.string().default("1.0.0"), tags: z.string().optional(), code: z.string().optional(), readme: z.string().optional(), price: z.number().min(0).default(0) }))
    .mutation(async ({ input, ctx }) => {
    enforceAdminFeature(ctx.user.role, "Security Marketplace");
      const slug = "community_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
      await db.createSecurityModule({ slug, name: input.name, description: input.description, longDescription: input.readme ?? input.description, category: input.category, tags: input.tags ? JSON.stringify(input.tags.split(",").map((t: string) => t.trim())) : JSON.stringify([]), authorId: String(ctx.user.id), authorLabel: (ctx.user as any).username ?? "Community", version: input.version, license: input.price > 0 ? "credits" : "free", creditCost: input.price > 0 ? input.price : undefined, readme: input.readme, status: "draft", downloads: 0, rating: 0, ratingCount: 0, verified: false, featured: false });
      return { success: true, message: "Your module has been submitted for review. It will appear in the marketplace once approved by the Archibald Titan team." };
    }),

  getCategories: adminProcedure.query(async () => {
    const modules = await db.listSecurityModules({ limit: 500 });
    const counts = modules.reduce((acc: Record<string,number>, m) => { acc[m.category] = (acc[m.category] ?? 0) + 1; return acc; }, {});
    return { categories: [{ id:"all", label:"All Modules", count:modules.length },{ id:"osint", label:"OSINT", count:counts.osint??0 },{ id:"scanning", label:"Scanning", count:counts.scanning??0 },{ id:"exploitation", label:"Exploitation", count:counts.exploitation??0 },{ id:"phishing", label:"Phishing", count:counts.phishing??0 },{ id:"anonymity", label:"Anonymity", count:counts.anonymity??0 },{ id:"automation", label:"Automation", count:counts.automation??0 },{ id:"reporting", label:"Reporting", count:counts.reporting??0 },{ id:"playbook", label:"Playbooks", count:counts.playbook??0 },{ id:"wordlist", label:"Wordlists", count:counts.wordlist??0 },{ id:"template", label:"Templates", count:counts.template??0 }] };
  }),

  getStats: adminProcedure.query(async ({ ctx }) => {
    enforceAdminFeature(ctx.user.role, "Security Marketplace");
    return db.getSecurityModuleStats(ctx.user.id as number);
  }),
});
