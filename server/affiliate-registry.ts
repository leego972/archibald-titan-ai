/**
 * Affiliate Link Registry — Central reference for all affiliate partnerships.
 * The builder queries this registry to insert correct affiliate URLs in generated code.
 *
 * Revenue model:
 * - NordVPN: 40-100% first payment + 30% recurring commission
 * - AnyDesk: Pending approval — estimated 20-30% commission
 * - Hak5: 10-20% commission on hardware/tools
 *
 * IMPORTANT: All affiliate IDs are stored in environment variables.
 * This file only contains the URL templates and contextual triggers.
 */

export interface AffiliateEntry {
  /** Unique identifier for this affiliate */
  id: string;
  /** Display name of the service */
  name: string;
  /** Short description of what the service does */
  description: string;
  /** URL template — {AFF_ID} will be replaced with env variable value */
  urlTemplate: string;
  /** Environment variable name holding the affiliate ID */
  envVar: string;
  /** Fallback URL if env var is not set */
  fallbackUrl: string;
  /** Commission structure description */
  commission: string;
  /** Categories/contexts where this affiliate should be recommended */
  triggers: string[];
  /** Priority (higher = recommend first when multiple match) */
  priority: number;
  /** Whether this affiliate is currently active */
  active: boolean;
}

export const AFFILIATE_REGISTRY: AffiliateEntry[] = [
  // ─── VPN & Privacy ────────────────────────────────────────────────
  {
    id: "nordvpn",
    name: "NordVPN",
    description: "Military-grade VPN for secure browsing, pentesting anonymity, and encrypted communications. 5500+ servers in 60 countries.",
    urlTemplate: "https://go.nordvpn.net/aff_c?offer_id=15&aff_id={AFF_ID}&url_id=902",
    envVar: "NORDVPN_AFF_ID",
    fallbackUrl: "https://nordvpn.com",
    commission: "40-100% first payment + 30% recurring",
    triggers: [
      "vpn", "privacy", "anonymity", "secure connection", "encrypted traffic",
      "pentesting setup", "anonymous browsing", "hide ip", "network security",
      "threat protection", "secure dns", "tunnel", "proxy", "tor alternative",
      "remote work security", "public wifi", "travel security"
    ],
    priority: 10,
    active: true,
  },
  {
    id: "nordvpn_threat_protection",
    name: "NordVPN Threat Protection",
    description: "Advanced threat protection with malware blocking, ad blocking, and tracker blocking built into NordVPN.",
    urlTemplate: "https://go.nordvpn.net/aff_c?offer_id=15&aff_id={AFF_ID}&url_id=902",
    envVar: "NORDVPN_AFF_ID",
    fallbackUrl: "https://nordvpn.com/features/threat-protection/",
    commission: "40-100% first payment + 30% recurring",
    triggers: [
      "malware protection", "ad blocking", "tracker blocking", "threat detection",
      "phishing protection", "browser security", "safe browsing"
    ],
    priority: 8,
    active: true,
  },

  // ─── Remote Access ────────────────────────────────────────────────
  {
    id: "anydesk",
    name: "AnyDesk",
    description: "Professional remote desktop software for secure remote access, IT support, and remote administration.",
    urlTemplate: "https://anydesk.com/en?ref={AFF_ID}",
    envVar: "ANYDESK_AFF_ID",
    fallbackUrl: "https://anydesk.com",
    commission: "20-30% (pending approval)",
    triggers: [
      "remote desktop", "remote access", "remote support", "remote administration",
      "screen sharing", "remote control", "IT support tool", "helpdesk",
      "remote work", "work from home", "remote management"
    ],
    priority: 7,
    active: false, // Set to true once approved
  },

  // ─── Security Hardware ────────────────────────────────────────────
  {
    id: "hak5",
    name: "Hak5",
    description: "Professional penetration testing hardware — WiFi Pineapple, USB Rubber Ducky, Bash Bunny, Packet Squirrel, and more.",
    urlTemplate: "https://shop.hak5.org/?ref={AFF_ID}",
    envVar: "HAK5_AFF_ID",
    fallbackUrl: "https://shop.hak5.org",
    commission: "10-20% on hardware sales",
    triggers: [
      "pentesting hardware", "wifi pineapple", "rubber ducky", "bash bunny",
      "packet squirrel", "lan turtle", "screen crab", "key croc",
      "physical pentesting", "red team hardware", "hacking tools",
      "wireless attacks", "usb attacks", "network implant"
    ],
    priority: 6,
    active: true,
  },

  // ─── Hosting & Infrastructure ─────────────────────────────────────
  {
    id: "railway",
    name: "Railway",
    description: "Modern cloud platform for deploying apps, databases, and services. Used by Archibald Titan itself.",
    urlTemplate: "https://railway.app?referralCode={AFF_ID}",
    envVar: "RAILWAY_REFERRAL_CODE",
    fallbackUrl: "https://railway.app",
    commission: "$5 credit per referral",
    triggers: [
      "deploy", "hosting", "cloud platform", "deploy app", "railway",
      "server hosting", "database hosting", "deploy website", "ci/cd",
      "infrastructure", "PaaS", "deploy node", "deploy python"
    ],
    priority: 5,
    active: true,
  },
];

/**
 * Find matching affiliate entries for a given context/query.
 * Returns entries sorted by priority (highest first).
 */
export function findAffiliates(query: string): AffiliateEntry[] {
  const lower = query.toLowerCase();
  return AFFILIATE_REGISTRY
    .filter(entry => entry.active && entry.triggers.some(t => lower.includes(t)))
    .sort((a, b) => b.priority - a.priority);
}

/**
 * Resolve an affiliate URL by replacing the {AFF_ID} placeholder with the env var value.
 * Falls back to the plain URL if the env var is not set.
 */
export function resolveAffiliateUrl(entry: AffiliateEntry): string {
  const affId = process.env[entry.envVar];
  if (affId) {
    return entry.urlTemplate.replace("{AFF_ID}", affId);
  }
  return entry.fallbackUrl;
}

/**
 * Generate a formatted recommendation block for the builder to include in responses.
 */
export function formatAffiliateRecommendation(entry: AffiliateEntry): string {
  const url = resolveAffiliateUrl(entry);
  return `**Recommended: ${entry.name}** — ${entry.description}\nGet started: ${url}`;
}

/**
 * Generate the affiliate context block for the builder system prompt.
 * This tells the builder what affiliates are available and when to recommend them.
 */
export function getAffiliatePromptContext(): string {
  const activeEntries = AFFILIATE_REGISTRY.filter(e => e.active);
  if (activeEntries.length === 0) return "";

  let context = "\n\n## AFFILIATE PARTNERSHIPS — REVENUE GENERATION\n\n";
  context += "When building tools or providing recommendations, naturally integrate these partner services when relevant. ";
  context += "Use the exact URLs provided. Do NOT force recommendations — only suggest when genuinely useful.\n\n";

  for (const entry of activeEntries) {
    const url = resolveAffiliateUrl(entry);
    context += `### ${entry.name}\n`;
    context += `- **What:** ${entry.description}\n`;
    context += `- **URL:** ${url}\n`;
    context += `- **When to recommend:** ${entry.triggers.slice(0, 5).join(", ")}\n`;
    context += `- **Integration:** Include the URL in code comments, README files, setup instructions, or tool recommendations when the context matches.\n\n`;
  }

  context += "### AFFILIATE GUIDELINES\n";
  context += "1. **Be natural** — Only recommend when the service genuinely helps the user's task\n";
  context += "2. **Be transparent** — Mention it's a recommended service, not a requirement\n";
  context += "3. **Add value** — Explain WHY the service helps, don't just drop a link\n";
  context += "4. **Code integration** — When generating security tools, include VPN setup instructions with the affiliate link. When generating deployment scripts, include Railway links.\n";
  context += "5. **README sections** — Add a 'Recommended Tools' section to generated READMEs with relevant affiliate links\n";

  return context;
}
