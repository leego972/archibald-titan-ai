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
    downloads: 0,
    rating: 0,
    ratingCount: 0,
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
    downloads: 0,
    rating: 0,
    ratingCount: 0,
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
    downloads: 0,
    rating: 0,
    ratingCount: 0,
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
    downloads: 0,
    rating: 0,
    ratingCount: 0,
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
    downloads: 0,
    rating: 0,
    ratingCount: 0,
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
    downloads: 0,
    rating: 0,
    ratingCount: 0,
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
    downloads: 0,
    rating: 0,
    ratingCount: 0,
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
    downloads: 0,
    rating: 0,
    ratingCount: 0,
    verified: true,
    featured: false,
    createdAt: new Date("2025-08-01"),
    updatedAt: new Date("2025-11-30"),
    requirements: ["Titan subscription"],
    compatibleWith: ["compliance-reports"],
    screenshots: [],
  },
  // ── NEW SECURITY BUILDS ───────────────────────────────────────────────────
  {
    id: "mod_api_key_harvester",
    name: "API Key Harvester",
    description: "Scan public GitHub repos, Pastebin, and npm packages for leaked API keys",
    longDescription: "Automatically searches GitHub code search, Gist, Pastebin, and npm package source for exposed API keys, tokens, and secrets using 200+ regex patterns covering AWS, Stripe, Twilio, SendGrid, OpenAI, Slack, Discord, and more. Integrates with the Leak Scanner to deduplicate and triage findings. Outputs a severity-ranked report with direct links to the source and estimated blast radius of each leak.",
    category: "osint",
    tags: ["api-keys", "secrets", "github", "leak", "osint", "recon"],
    author: "VaultBreaker",
    authorId: "vaultbreaker",
    version: "3.1.0",
    license: "credits",
    creditCost: 8,
    downloads: 0,
    rating: 0,
    ratingCount: 0,
    verified: true,
    featured: true,
    createdAt: new Date("2025-05-10"),
    updatedAt: new Date("2026-02-01"),
    requirements: ["GitHub token in credentials"],
    compatibleWith: ["argus", "leak-scanner"],
    screenshots: [],
  },
  {
    id: "mod_jwt_forge",
    name: "JWT Forge",
    description: "Craft, decode, and attack JWT tokens — alg:none, key confusion, brute-force",
    longDescription: "Comprehensive JWT attack toolkit for authorised penetration testing. Supports alg:none bypass, RS256 to HS256 key confusion attacks, weak secret brute-force (using RockYou or custom wordlist), kid injection, jku/x5u header manipulation, and claim tampering. Includes a visual JWT decoder and a live request interceptor that automatically replaces tokens in HTTP traffic. Integrates with the Proxy Interceptor for seamless in-session testing.",
    category: "exploitation",
    tags: ["jwt", "token", "auth-bypass", "brute-force", "web"],
    author: "TokenSmith",
    authorId: "tokensmith",
    version: "2.0.4",
    license: "credits",
    creditCost: 12,
    downloads: 0,
    rating: 0,
    ratingCount: 0,
    verified: true,
    featured: true,
    createdAt: new Date("2025-09-01"),
    updatedAt: new Date("2026-01-20"),
    requirements: [],
    compatibleWith: ["proxy-interceptor", "astra"],
    screenshots: [],
  },
  {
    id: "mod_cloud_misconfig_scanner",
    name: "Cloud Misconfiguration Scanner",
    description: "Detect open S3 buckets, exposed GCS blobs, and public Azure storage accounts",
    longDescription: "Scans AWS S3, Google Cloud Storage, and Azure Blob Storage for publicly accessible buckets and containers. Uses permutation-based bucket name discovery, ACL analysis, and static website hosting detection. Checks for sensitive file patterns (*.env, *.pem, *.sql, backup.zip) inside open buckets. Integrates with the Attack Graph to visualise cloud exposure and generates a remediation checklist with exact AWS/GCP/Azure CLI commands to lock down each finding.",
    category: "scanning",
    tags: ["cloud", "s3", "aws", "gcp", "azure", "misconfiguration", "bucket"],
    author: "CloudAudit",
    authorId: "cloudaudit",
    version: "1.8.2",
    license: "credits",
    creditCost: 10,
    downloads: 0,
    rating: 0,
    ratingCount: 0,
    verified: true,
    featured: true,
    createdAt: new Date("2025-06-15"),
    updatedAt: new Date("2026-01-28"),
    requirements: [],
    compatibleWith: ["argus", "attack-graph", "astra"],
    screenshots: [],
  },
  {
    id: "mod_c2_beacon_simulator",
    name: "C2 Beacon Simulator",
    description: "Simulate Cobalt Strike, Sliver, and Havoc C2 beacon traffic for EDR testing",
    longDescription: "Generates realistic command-and-control beacon traffic patterns mimicking Cobalt Strike Malleable C2 profiles, Sliver implants, and Havoc Demon agents. Used to test EDR/XDR detection coverage, SIEM alert rules, and network monitoring without deploying real malware. Supports HTTP, HTTPS, DNS, and SMB transport channels. Includes 30+ pre-built Malleable C2 profiles (Amazon, Bing, OneDrive, Slack) and a profile editor. For authorised red team and blue team testing only.",
    category: "automation",
    tags: ["c2", "cobalt-strike", "edr-testing", "red-team", "beacon", "sliver"],
    author: "RedCellOps",
    authorId: "redcellops",
    version: "1.3.0",
    license: "subscription",
    downloads: 0,
    rating: 0,
    ratingCount: 0,
    verified: true,
    featured: true,
    createdAt: new Date("2025-10-01"),
    updatedAt: new Date("2026-02-10"),
    requirements: ["Titan subscription", "Isolated browser session recommended"],
    compatibleWith: ["command-centre", "siem-integration", "red-team-playbooks"],
    screenshots: [],
  },
  {
    id: "mod_memory_forensics",
    name: "Memory Forensics Toolkit",
    description: "Volatility 3 wrapper — extract processes, network connections, and injected shellcode from memory dumps",
    longDescription: "A Volatility 3 automation wrapper that analyses Windows, Linux, and macOS memory dumps. Automatically runs the most useful plugins: pslist, netscan, malfind (injected shellcode detection), cmdline, dlllist, hashdump, and lsadump. Highlights suspicious processes (hollowing, injection indicators), extracts network connections, and dumps credentials from LSASS. Results are visualised in an interactive process tree and exported as a structured JSON report compatible with the SIEM Integration module.",
    category: "exploitation",
    tags: ["forensics", "memory", "volatility", "malware", "incident-response", "dfir"],
    author: "DFIRLabs",
    authorId: "dfirlabs",
    version: "2.1.0",
    license: "credits",
    creditCost: 20,
    downloads: 0,
    rating: 0,
    ratingCount: 0,
    verified: true,
    featured: false,
    createdAt: new Date("2025-07-01"),
    updatedAt: new Date("2026-01-05"),
    requirements: ["Memory dump file (.raw, .vmem, .dmp)"],
    compatibleWith: ["siem-integration", "attack-graph"],
    screenshots: [],
  },
  {
    id: "mod_graphql_auditor",
    name: "GraphQL Introspection Auditor",
    description: "Discover hidden queries, mutations, and IDOR vulnerabilities in GraphQL APIs",
    longDescription: "Performs deep security auditing of GraphQL endpoints. Runs introspection to map the full schema, then automatically tests for: disabled introspection bypass, batching attacks (DoS), field-level authorisation flaws (IDOR), SQL/NoSQL injection via arguments, deeply nested query DoS, and information disclosure through verbose error messages. Generates a visual schema explorer and a severity-ranked vulnerability report. Integrates with the Proxy Interceptor to capture and replay live GraphQL traffic.",
    category: "scanning",
    tags: ["graphql", "api", "idor", "introspection", "web", "injection"],
    author: "APIBreaker",
    authorId: "apibreaker",
    version: "1.4.1",
    license: "credits",
    creditCost: 8,
    downloads: 0,
    rating: 0,
    ratingCount: 0,
    verified: true,
    featured: false,
    createdAt: new Date("2025-08-20"),
    updatedAt: new Date("2025-12-15"),
    requirements: [],
    compatibleWith: ["astra", "proxy-interceptor"],
    screenshots: [],
  },
  {
    id: "mod_wifi_deauth_playbook",
    name: "Wi-Fi Deauth & Handshake Capture Playbook",
    description: "Automate 802.11 deauthentication attacks and WPA2 handshake capture for authorised testing",
    longDescription: "Automated playbook for authorised Wi-Fi penetration testing. Orchestrates monitor mode setup, target AP discovery, deauthentication frame injection, WPA2 4-way handshake capture, and PMKID extraction. Captured handshakes are automatically queued for offline cracking using hashcat with the RockYou2024 wordlist. Includes PMKID attack support (no client required), EVIL-TWIN AP setup instructions, and a channel hopper for passive survey mode. For authorised testing of networks you own or have written permission to test.",
    category: "playbook",
    tags: ["wifi", "wpa2", "deauth", "handshake", "wireless", "hashcat"],
    author: "WirelessOps",
    authorId: "wirelessops",
    version: "1.2.0",
    license: "subscription",
    downloads: 0,
    rating: 0,
    ratingCount: 0,
    verified: true,
    featured: false,
    createdAt: new Date("2025-04-01"),
    updatedAt: new Date("2025-10-10"),
    requirements: ["Compatible wireless adapter (monitor mode + injection)", "Titan subscription"],
    compatibleWith: ["red-team-playbooks", "command-centre"],
    screenshots: [],
  },
  {
    id: "mod_kubernetes_auditor",
    name: "Kubernetes Security Auditor",
    description: "Audit K8s clusters for RBAC misconfigs, exposed dashboards, and privilege escalation paths",
    longDescription: "Comprehensive Kubernetes security audit tool that connects to a cluster via kubeconfig or service account token and checks for: overly permissive RBAC roles (cluster-admin bindings), exposed Kubernetes Dashboard, unauthenticated API server, privileged pods, hostPath mounts, container escape vectors, secrets in environment variables, and network policy gaps. Generates a CIS Kubernetes Benchmark report with pass/fail for all 100+ controls and a prioritised remediation roadmap. Integrates with the Attack Graph to visualise lateral movement paths.",
    category: "scanning",
    tags: ["kubernetes", "k8s", "rbac", "cloud", "container", "devops", "cis"],
    author: "K8sGuard",
    authorId: "k8sguard",
    version: "2.0.0",
    license: "credits",
    creditCost: 15,
    downloads: 0,
    rating: 0,
    ratingCount: 0,
    verified: true,
    featured: true,
    createdAt: new Date("2025-09-15"),
    updatedAt: new Date("2026-02-05"),
    requirements: ["kubeconfig or service account token"],
    compatibleWith: ["attack-graph", "compliance-reports", "siem-integration"],
    screenshots: [],
  },
  {
    id: "mod_browser_fingerprint_spoofer",
    name: "Browser Fingerprint Spoofer",
    description: "Randomise canvas, WebGL, AudioContext, and font fingerprints in isolated sessions",
    longDescription: "Injects a comprehensive fingerprint randomisation layer into isolated browser sessions. Spoofs: Canvas 2D and WebGL rendering (unique per session), AudioContext fingerprint, installed font enumeration, screen resolution and colour depth, navigator.plugins and mimeTypes, hardware concurrency and device memory, timezone and locale, WebRTC IP leak prevention, and battery API. Each session gets a cryptographically unique but internally consistent fingerprint profile that passes major fingerprinting test suites (AmIUnique, FingerprintJS, CreepJS). Essential for OPSEC-sensitive investigations.",
    category: "anonymity",
    tags: ["fingerprint", "browser", "opsec", "privacy", "canvas", "webgl", "anonymity"],
    author: "GhostBrowser",
    authorId: "ghostbrowser",
    version: "1.6.3",
    license: "credits",
    creditCost: 5,
    downloads: 0,
    rating: 0,
    ratingCount: 0,
    verified: true,
    featured: true,
    createdAt: new Date("2025-03-20"),
    updatedAt: new Date("2026-01-30"),
    requirements: [],
    compatibleWith: ["tor", "vpn-chain", "proxy-interceptor"],
    screenshots: [],
  },
  {
    id: "mod_active_directory_enum",
    name: "Active Directory Enumerator",
    description: "BloodHound-style AD enumeration — map attack paths to Domain Admin",
    longDescription: "Performs comprehensive Active Directory enumeration using LDAP queries (no agent required). Collects: all users, groups, computers, GPOs, ACLs, and trust relationships. Automatically identifies Kerberoastable accounts, AS-REP roastable users, unconstrained delegation, constrained delegation, DCSync rights, WriteDACL/GenericAll/GenericWrite ACEs, and AdminSDHolder misconfigurations. Visualises attack paths to Domain Admin in the Attack Graph with step-by-step exploitation guidance for each path. Exports BloodHound-compatible JSON for offline analysis.",
    category: "exploitation",
    tags: ["active-directory", "bloodhound", "kerberoast", "ldap", "windows", "domain"],
    author: "ADReaper",
    authorId: "adreaper",
    version: "3.0.1",
    license: "subscription",
    downloads: 0,
    rating: 0,
    ratingCount: 0,
    verified: true,
    featured: true,
    createdAt: new Date("2025-05-01"),
    updatedAt: new Date("2026-02-12"),
    requirements: ["Domain credentials (low-privilege user sufficient)", "Titan subscription"],
    compatibleWith: ["attack-graph", "red-team-playbooks", "command-centre"],
    screenshots: [],
  },
  {
    id: "mod_dark_web_monitor",
    name: "Dark Web Brand Monitor",
    description: "Monitor Tor hidden services, paste sites, and dark web forums for brand mentions and credential leaks",
    longDescription: "Continuously monitors dark web sources for mentions of your organisation, domain, executive names, and email addresses. Crawls Tor hidden services, I2P eepsites, Zeronet sites, and clearnet paste sites (Pastebin, Ghostbin, Rentry). Detects: credential dumps containing your domain, ransomware group victim listings, data broker listings, threat actor discussions mentioning your organisation, and leaked internal documents. Sends real-time alerts via email or webhook. Integrates with the Leak Scanner for deduplication and the SIEM Integration for alert correlation.",
    category: "osint",
    tags: ["dark-web", "tor", "brand-monitoring", "leak", "ransomware", "threat-intel"],
    author: "DarkWatch",
    authorId: "darkwatch",
    version: "2.2.0",
    license: "subscription",
    downloads: 0,
    rating: 0,
    ratingCount: 0,
    verified: true,
    featured: false,
    createdAt: new Date("2025-06-01"),
    updatedAt: new Date("2026-01-25"),
    requirements: ["Tor enabled", "Titan subscription"],
    compatibleWith: ["argus", "tor", "leak-scanner", "siem-integration"],
    screenshots: [],
  },
  {
    id: "mod_owasp_top10_scanner",
    name: "OWASP Top 10 Auto-Scanner",
    description: "Automated scanner for all OWASP Top 10 vulnerabilities — SQLi, XSS, SSRF, XXE, IDOR, and more",
    longDescription: "Fully automated OWASP Top 10 (2021) vulnerability scanner that goes beyond simple pattern matching. Uses headless browser rendering for DOM-based XSS detection, out-of-band callbacks (DNS/HTTP) for blind SQLi and SSRF, XML entity injection testing, broken object-level authorisation (IDOR) fuzzing via parameter manipulation, security misconfiguration checks (default credentials, exposed admin panels, directory listing), and cryptographic failure detection (weak TLS, mixed content, insecure cookies). Generates a developer-friendly report with code-level remediation examples for each finding.",
    category: "scanning",
    tags: ["owasp", "sqli", "xss", "ssrf", "xxe", "idor", "web", "automated"],
    author: "WebAuditPro",
    authorId: "webauditpro",
    version: "4.0.0",
    license: "credits",
    creditCost: 12,
    downloads: 0,
    rating: 0,
    ratingCount: 0,
    verified: true,
    featured: true,
    createdAt: new Date("2025-02-01"),
    updatedAt: new Date("2026-02-08"),
    requirements: [],
    compatibleWith: ["astra", "proxy-interceptor", "attack-graph"],
    screenshots: [],
  },
  {
    id: "mod_phishing_awareness_kit",
    name: "Phishing Awareness Training Kit",
    description: "Send simulated phishing campaigns to employees and track click/credential rates",
    longDescription: "Complete phishing simulation and awareness training platform. Create campaigns with customisable templates (IT helpdesk, HR, CEO fraud, parcel delivery, bank alert), schedule sends to employee lists, and track open rates, click rates, and credential submission rates in real time. When an employee falls for a simulation, they are immediately redirected to a branded training page explaining the red flags they missed. Includes 50+ pre-built templates, a landing page builder, and an executive dashboard with department-level risk scoring. Integrates with Evilginx for advanced credential capture simulations.",
    category: "phishing",
    tags: ["phishing", "awareness", "training", "simulation", "social-engineering", "hr"],
    author: "AwarenessPro",
    authorId: "awarenessPro",
    version: "2.5.0",
    license: "subscription",
    downloads: 0,
    rating: 0,
    ratingCount: 0,
    verified: true,
    featured: false,
    createdAt: new Date("2025-07-15"),
    updatedAt: new Date("2026-01-10"),
    requirements: ["Titan subscription", "Custom domain for landing pages"],
    compatibleWith: ["evilginx", "blackeye"],
    screenshots: [],
  },
  {
    id: "mod_supply_chain_auditor",
    name: "Supply Chain Dependency Auditor",
    description: "Detect typosquatting, dependency confusion, and malicious packages in npm/PyPI/Maven dependencies",
    longDescription: "Audits your project dependency tree for supply chain attack vectors. Detects: typosquatted package names (e.g. lodahs vs lodash), dependency confusion attacks (internal package names published to public registries), packages with post-install scripts that exfiltrate data, packages with known malicious versions (cross-referenced against OSV, Snyk, and GitHub Advisory databases), abandoned packages with new malicious maintainers, and packages with excessive permission requests. Supports npm, PyPI, Maven, NuGet, and RubyGems. Generates a SBOM (Software Bill of Materials) in CycloneDX format.",
    category: "scanning",
    tags: ["supply-chain", "npm", "pypi", "dependencies", "sbom", "typosquatting"],
    author: "ChainGuard",
    authorId: "chainguard",
    version: "1.5.0",
    license: "credits",
    creditCost: 6,
    downloads: 0,
    rating: 0,
    ratingCount: 0,
    verified: true,
    featured: false,
    createdAt: new Date("2025-08-10"),
    updatedAt: new Date("2026-01-18"),
    requirements: [],
    compatibleWith: ["astra", "compliance-reports"],
    screenshots: [],
  },
  {
    id: "mod_iot_scanner",
    name: "IoT & OT Device Scanner",
    description: "Fingerprint and audit IoT devices, industrial control systems, and embedded hardware on your network",
    longDescription: "Specialised scanner for Internet of Things and Operational Technology environments. Identifies devices by banner grabbing, protocol fingerprinting (Modbus, DNP3, BACnet, EtherNet/IP, MQTT, CoAP, Zigbee gateway detection), and passive traffic analysis. Checks for: default credentials (database of 5,000+ device/credential pairs), unencrypted protocols (Telnet, HTTP, FTP), outdated firmware versions (cross-referenced against CVE database), unauthenticated MQTT brokers, exposed RTSP camera streams, and Modbus/DNP3 write access. Generates a network topology map and a risk-scored device inventory. Integrates with the Attack Graph to show IoT-to-IT lateral movement paths.",
    category: "scanning",
    tags: ["iot", "ot", "modbus", "mqtt", "scada", "embedded", "firmware", "network"],
    author: "OTSecurity",
    authorId: "otsecurity",
    version: "1.1.0",
    license: "credits",
    creditCost: 18,
    downloads: 0,
    rating: 0,
    ratingCount: 0,
    verified: true,
    featured: false,
    createdAt: new Date("2025-10-15"),
    updatedAt: new Date("2026-02-01"),
    requirements: ["Network access to target subnet"],
    compatibleWith: ["attack-graph", "siem-integration", "astra"],
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

  // ── Rate module (alias for addReview) ──────────────────────────────────────
  rateModule: protectedProcedure
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
      const moduleReviews = reviews.filter((r) => r.moduleId === input.moduleId);
      module.rating = Math.round((moduleReviews.reduce((sum, r) => sum + r.rating, 0) / moduleReviews.length) * 10) / 10;
      module.ratingCount = moduleReviews.length;
      return { success: true, review };
    }),
  // ── Publish module (community submission) ────────────────────────────────
  publishModule: protectedProcedure
    .input(
      z.object({
        name: z.string().min(3).max(80),
        description: z.string().min(10).max(300),
        category: z.enum(["osint", "scanning", "exploitation", "phishing", "anonymity", "automation", "reporting", "playbook", "wordlist", "template"]),
        version: z.string().default("1.0.0"),
        tags: z.string().optional(),
        code: z.string().optional(),
        readme: z.string().optional(),
        price: z.number().min(0).default(0),
      })
    )
    .mutation(({ input, ctx }) => {
      // Community submissions are queued for review — stored as pending in-memory
      const newModule: MarketplaceModule = {
        id: `mod_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        name: input.name,
        description: input.description,
        longDescription: input.readme ?? input.description,
        category: input.category,
        tags: input.tags ? input.tags.split(",").map((t: string) => t.trim()) : [],
        author: (ctx.user as any).username ?? "Community",
        authorId: String(ctx.user.id),
        version: input.version,
        license: input.price > 0 ? "credits" : "free",
        creditCost: input.price > 0 ? input.price : undefined,
        downloads: 0,
        rating: 0,
        ratingCount: 0,
        verified: false,
        featured: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        screenshots: [],
        requirements: [],
        compatibleWith: [],
      };
      MODULES.push(newModule);
      return { success: true, module: newModule };
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
      totalContributors: new Set(MODULES.map((m) => m.authorId)).size,
    };
  }),
});
