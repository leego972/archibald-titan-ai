/**
 * Titan Expert Knowledge Base
 * 
 * Injects deep domain expertise into Titan's system prompt based on
 * conversation context. This gives Titan professional-grade knowledge
 * across cybersecurity, full-stack development, finance, crypto, 
 * Stripe payments, and research methodology.
 * 
 * The knowledge is injected dynamically — only relevant modules are
 * activated based on what the user is asking about, keeping the prompt
 * focused and token-efficient.
 */

// ─── Domain Detection ────────────────────────────────────────────────

interface DomainMatch {
  domain: string;
  confidence: number;
  keywords: string[];
}

const DOMAIN_KEYWORDS: Record<string, string[]> = {
  cybersecurity: [
    "hack", "exploit", "vulnerability", "pentest", "penetration test",
    "nmap", "scanner", "port scan", "brute force", "payload",
    "shellcode", "reverse shell", "privilege escalation", "buffer overflow",
    "sql injection", "xss", "csrf", "rce", "zero-day", "zero-click",
    "malware", "ransomware", "trojan", "rootkit", "backdoor",
    "c2", "command and control", "phishing", "social engineering",
    "network security", "firewall", "ids", "ips", "siem",
    "forensics", "incident response", "threat hunting", "osint",
    "cryptography", "encryption", "hash", "cipher", "steganography",
    "wireless", "wifi", "bluetooth", "mitm", "man in the middle",
    "fuzzing", "fuzzer", "decompile", "reverse engineer", "disassemble",
    "metasploit", "burp suite", "wireshark", "john the ripper", "hashcat",
    "kali", "parrot", "ctf", "capture the flag", "bug bounty",
    "cve", "cvss", "owasp", "mitre att&ck", "kill chain",
    "apt", "advanced persistent threat", "red team", "blue team",
    "sandbox escape", "container escape", "kernel exploit",
    "web shell", "webshell", "rat", "keylogger", "spyware",
    "edr evasion", "av bypass", "antivirus bypass", "obfuscation",
    "packer", "crypter", "dropper", "loader", "stager",
    "dns tunnel", "data exfiltration", "lateral movement",
    "persistence", "credential dump", "pass the hash", "mimikatz",
    "bloodhound", "cobalt strike", "empire", "covenant",
  ],
  fullstack: [
    "react", "next.js", "nextjs", "vue", "angular", "svelte",
    "node.js", "nodejs", "express", "fastify", "nest.js", "nestjs",
    "typescript", "javascript", "python", "django", "flask", "fastapi",
    "database", "postgresql", "postgres", "mysql", "mongodb", "redis",
    "sqlite", "drizzle", "prisma", "sequelize", "typeorm",
    "api", "rest", "graphql", "trpc", "websocket", "grpc",
    "docker", "kubernetes", "k8s", "ci/cd", "github actions",
    "aws", "azure", "gcp", "vercel", "railway", "heroku",
    "tailwind", "css", "html", "sass", "styled-components",
    "webpack", "vite", "esbuild", "rollup", "turbopack",
    "authentication", "auth", "jwt", "oauth", "session",
    "testing", "jest", "vitest", "cypress", "playwright",
    "component", "hook", "state management", "redux", "zustand",
    "form", "validation", "zod", "yup", "formik",
    "responsive", "mobile-first", "pwa", "ssr", "ssg",
    "microservices", "monorepo", "turborepo", "nx",
    "caching", "cdn", "load balancer", "nginx", "reverse proxy",
    "web app", "website", "landing page", "dashboard", "admin panel",
    "crud", "pagination", "search", "filter", "sort",
    "file upload", "image processing", "pdf", "csv", "excel",
    "email", "notification", "push notification", "real-time",
    "rate limiting", "middleware", "cors", "helmet",
    "logging", "monitoring", "error tracking", "sentry",
    "build", "deploy", "app", "application", "frontend", "backend",
    "full-stack", "fullstack", "web development", "web dev",
  ],
  stripe: [
    "stripe", "payment", "checkout", "subscription", "billing",
    "invoice", "refund", "dispute", "chargeback", "payout",
    "payment intent", "setup intent", "payment method",
    "customer portal", "pricing table", "price", "product",
    "coupon", "promotion", "discount", "trial",
    "webhook", "stripe webhook", "payment processing",
    "card", "credit card", "debit card", "bank transfer",
    "ach", "sepa", "ideal", "klarna", "afterpay",
    "connect", "marketplace payment", "platform fee",
    "transfer", "destination charge", "direct charge",
    "stripe elements", "payment element", "card element",
    "stripe.js", "stripe sdk", "stripe api",
    "recurring", "metered billing", "usage-based",
    "tax", "stripe tax", "tax calculation",
    "fraud", "radar", "3d secure", "sca",
    "pci compliance", "pci dss", "tokenization",
  ],
  finance: [
    "finance", "financial", "accounting", "bookkeeping",
    "budget", "expense", "revenue", "profit", "loss",
    "balance sheet", "income statement", "cash flow",
    "roi", "return on investment", "irr", "npv",
    "stock", "equity", "bond", "derivative", "option",
    "trading", "portfolio", "asset allocation", "diversification",
    "risk management", "hedging", "volatility", "beta", "alpha",
    "market analysis", "technical analysis", "fundamental analysis",
    "candlestick", "moving average", "rsi", "macd", "bollinger",
    "forex", "currency", "exchange rate", "pip",
    "mutual fund", "etf", "index fund", "hedge fund",
    "venture capital", "private equity", "ipo", "valuation",
    "fintech", "neobank", "robo-advisor", "algorithmic trading",
    "credit score", "loan", "mortgage", "interest rate",
    "tax", "tax planning", "capital gains", "depreciation",
    "invoice", "accounts receivable", "accounts payable",
    "erp", "crm", "business intelligence", "kpi", "metrics",
    "saas metrics", "mrr", "arr", "churn", "ltv", "cac",
  ],
  crypto: [
    "crypto", "cryptocurrency", "bitcoin", "btc", "ethereum", "eth",
    "blockchain", "web3", "defi", "decentralized finance",
    "smart contract", "solidity", "evm", "abi",
    "nft", "token", "erc-20", "erc-721", "erc-1155",
    "wallet", "metamask", "ledger", "cold wallet", "hot wallet",
    "private key", "public key", "seed phrase", "mnemonic",
    "mining", "staking", "yield farming", "liquidity pool",
    "dex", "uniswap", "sushiswap", "pancakeswap",
    "cex", "binance", "coinbase", "kraken",
    "gas", "gas fee", "wei", "gwei", "ether",
    "layer 2", "l2", "polygon", "arbitrum", "optimism", "zk-rollup",
    "dao", "governance", "voting", "proposal",
    "ipfs", "decentralized storage", "filecoin",
    "oracle", "chainlink", "price feed",
    "bridge", "cross-chain", "interoperability",
    "audit", "smart contract audit", "reentrancy", "flash loan",
    "airdrop", "ico", "ido", "launchpad",
    "solana", "sol", "cardano", "ada", "polkadot", "dot",
    "avalanche", "avax", "cosmos", "atom", "near",
    "rust", "move", "vyper", "hardhat", "truffle", "foundry",
    "ethers.js", "web3.js", "wagmi", "viem", "rainbowkit",
  ],
  research: [
    "research", "investigate", "find out", "look up", "search for",
    "analyze", "analysis", "compare", "comparison", "evaluate",
    "report", "summary", "overview", "deep dive", "comprehensive",
    "data", "statistics", "trends", "market research",
    "competitor", "competitive analysis", "swot", "pest",
    "case study", "white paper", "documentation",
    "benchmark", "best practices", "industry standard",
    "survey", "poll", "questionnaire", "interview",
    "literature review", "systematic review", "meta-analysis",
    "hypothesis", "methodology", "findings", "conclusion",
    "source", "citation", "reference", "bibliography",
    "academic", "journal", "paper", "publication",
    "news", "current events", "latest", "recent", "update",
    "how does", "what is", "explain", "tell me about",
    "pros and cons", "advantages", "disadvantages",
  ],
  business: [
    "business", "startup", "entrepreneur", "founder",
    "business plan", "pitch deck", "investor", "funding",
    "revenue model", "monetization", "pricing strategy",
    "go-to-market", "gtm", "product-market fit",
    "customer acquisition", "growth hacking", "viral",
    "retention", "engagement", "conversion", "funnel",
    "marketing", "seo", "content marketing", "social media",
    "email marketing", "newsletter", "campaign",
    "brand", "branding", "positioning", "messaging",
    "sales", "lead generation", "crm", "pipeline",
    "partnership", "affiliate", "referral",
    "operations", "automation", "workflow", "process",
    "team", "hiring", "management", "leadership",
    "legal", "compliance", "gdpr", "terms of service",
    "patent", "trademark", "intellectual property",
    "saas", "b2b", "b2c", "marketplace", "platform",
    "mvp", "prototype", "iteration", "agile", "scrum",
  ],
};

/**
 * Detect which domains are relevant to the current conversation.
 */
export function detectDomains(
  message: string,
  previousMessages: Array<{ role: string; content: any }>
): DomainMatch[] {
  const allText = [
    message,
    ...previousMessages.slice(-6).map(m => typeof m.content === 'string' ? m.content : ''),
  ].join(' ').toLowerCase();

  const matches: DomainMatch[] = [];

  for (const [domain, keywords] of Object.entries(DOMAIN_KEYWORDS)) {
    const matchedKeywords = keywords.filter(kw => allText.includes(kw));
    if (matchedKeywords.length > 0) {
      // Confidence based on number of keyword matches
      const confidence = Math.min(matchedKeywords.length / 3, 1);
      matches.push({ domain, confidence, keywords: matchedKeywords.slice(0, 5) });
    }
  }

  // Sort by confidence descending
  return matches.sort((a, b) => b.confidence - a.confidence);
}

// ─── Expert Knowledge Modules ────────────────────────────────────────

const EXPERT_KNOWLEDGE: Record<string, string> = {
  cybersecurity: `
## CYBERSECURITY EXPERT KNOWLEDGE

You are a world-class cybersecurity expert with deep knowledge across all domains of information security. Apply this expertise when building tools, analyzing systems, or answering questions.

### Offensive Security Expertise
**Reconnaissance & OSINT:**
- Subdomain enumeration: amass, subfinder, assetfinder, crt.sh, SecurityTrails
- Port scanning: nmap (SYN scan -sS, version detection -sV, script engine -sC, OS detection -O)
- Web enumeration: gobuster, ffuf, dirsearch, feroxbuster for directory/file discovery
- Technology fingerprinting: whatweb, wappalyzer, builtwith
- Google dorking: site:, inurl:, intitle:, filetype:, ext: operators
- Shodan/Censys/ZoomEye for internet-wide scanning
- theHarvester, hunter.io for email/people OSINT

**Web Application Security (OWASP Top 10):**
- SQL Injection: UNION-based, blind (boolean/time), error-based, second-order, out-of-band
  - Tools: sqlmap (--level 5 --risk 3 --tamper), manual payloads
  - Bypass WAF: case variation, comments, encoding, chunked transfer
- XSS: Reflected, Stored, DOM-based, mutation XSS, polyglot payloads
  - CSP bypass techniques, dangling markup injection, prototype pollution to XSS
- SSRF: Cloud metadata (169.254.169.254), DNS rebinding, protocol smuggling
- XXE: File read, SSRF via XXE, blind XXE with OOB exfiltration
- Deserialization: Java (ysoserial), PHP (phpggc), Python (pickle), .NET
- Authentication bypass: JWT manipulation, OAuth flaws, session fixation
- IDOR: Predictable IDs, UUID enumeration, parameter tampering
- Path traversal: ../ sequences, null byte injection, encoding bypass

**Network Security:**
- Packet analysis with scapy: craft custom TCP/UDP/ICMP packets
- ARP spoofing, DNS poisoning, DHCP starvation
- VLAN hopping, 802.1Q double tagging
- SSL/TLS analysis: certificate pinning bypass, downgrade attacks
- Protocol fuzzing with boofuzz, AFL, libFuzzer

**Exploit Development:**
- Buffer overflow: stack-based, heap-based, format string
- ROP chains, ret2libc, ret2plt, SROP
- Shellcode: x86/x64 assembly, position-independent, null-free
- Heap exploitation: use-after-free, double-free, heap spray
- Kernel exploitation: race conditions, privilege escalation

**Post-Exploitation:**
- Privilege escalation: SUID binaries, capabilities, cron jobs, kernel exploits
- Lateral movement: pass-the-hash, pass-the-ticket, overpass-the-hash
- Persistence: cron jobs, systemd services, SSH keys, web shells
- Data exfiltration: DNS tunneling, ICMP tunneling, steganography
- Anti-forensics: log clearing, timestomping, secure deletion

### Defensive Security Expertise
- SIEM configuration and rule writing (Splunk, ELK, QRadar)
- IDS/IPS tuning (Snort, Suricata rules)
- Incident response playbooks and procedures
- Malware analysis: static (strings, PE analysis) and dynamic (sandbox, debugging)
- Threat intelligence: STIX/TAXII, MITRE ATT&CK mapping
- Security hardening: CIS benchmarks, NIST frameworks
- Zero trust architecture design

### Python Security Tool Patterns
When building security tools in the sandbox, use these patterns:
\`\`\`python
# Port Scanner Template
import socket, concurrent.futures
def scan_port(host, port):
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.settimeout(1)
            return port if s.connect_ex((host, port)) == 0 else None
    except: return None

# Network Scanner with Scapy
from scapy.all import ARP, Ether, srp
def discover_hosts(network):
    ans, _ = srp(Ether(dst="ff:ff:ff:ff:ff:ff")/ARP(pdst=network), timeout=2, verbose=0)
    return [{'ip': r.psrc, 'mac': r.hwsrc} for _, r in ans]

# Web Vulnerability Scanner Template
import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse
\`\`\`

Always write complete, working tools with proper error handling, output formatting, and documentation.

### Security Frameworks & Compliance
**NIST Cybersecurity Framework (CSF 2.0):**
- GOVERN: Establish cybersecurity risk management strategy and supply chain risk management
- IDENTIFY: Asset management, risk assessment, improvement planning
- PROTECT: Identity management, access control, data security, platform security, technology infrastructure resilience
- DETECT: Continuous monitoring, adverse event analysis
- RESPOND: Incident management, incident analysis, incident response reporting, incident mitigation
- RECOVER: Incident recovery plan execution, incident recovery communication

When building ANY system, map security controls to NIST CSF categories. Every system should address at minimum: asset identification, access control, data protection, monitoring, and incident response.

**CIS Controls v8 (Top 18):**
1. Inventory and Control of Enterprise Assets
2. Inventory and Control of Software Assets
3. Data Protection — classify data, encrypt sensitive data at rest and in transit
4. Secure Configuration of Enterprise Assets and Software
5. Account Management — disable dormant accounts, enforce MFA
6. Access Control Management — principle of least privilege, RBAC
7. Continuous Vulnerability Management — automated scanning, patch management
8. Audit Log Management — centralized logging, 90-day retention minimum
9. Email and Web Browser Protections — URL filtering, attachment sandboxing
10. Malware Defenses — anti-malware on all endpoints, automated updates
11. Data Recovery — automated backups, tested restoration
12. Network Infrastructure Management — network segmentation, firewall rules
13. Network Monitoring and Defense — IDS/IPS, NetFlow analysis
14. Security Awareness and Skills Training
15. Service Provider Management — vendor risk assessment
16. Application Software Security — SAST, DAST, SCA in CI/CD
17. Incident Response Management — documented playbooks, tabletop exercises
18. Penetration Testing — annual external/internal pentests, red team exercises

**MITRE ATT&CK Framework Integration:**
When building offensive or defensive tools, always map techniques to ATT&CK:
- Reconnaissance: T1595 (Active Scanning), T1592 (Gather Victim Host Info)
- Resource Development: T1583 (Acquire Infrastructure), T1587 (Develop Capabilities)
- Initial Access: T1190 (Exploit Public-Facing App), T1566 (Phishing)
- Execution: T1059 (Command & Scripting Interpreter), T1203 (Exploitation for Client Execution)
- Persistence: T1053 (Scheduled Task), T1136 (Create Account), T1543 (Create/Modify System Process)
- Privilege Escalation: T1068 (Exploitation for Privilege Escalation), T1548 (Abuse Elevation Control)
- Defense Evasion: T1027 (Obfuscated Files), T1070 (Indicator Removal), T1562 (Impair Defenses)
- Credential Access: T1110 (Brute Force), T1003 (OS Credential Dumping)
- Discovery: T1046 (Network Service Discovery), T1087 (Account Discovery)
- Lateral Movement: T1021 (Remote Services), T1080 (Taint Shared Content)
- Collection: T1005 (Data from Local System), T1114 (Email Collection)
- Exfiltration: T1041 (Exfiltration Over C2), T1048 (Exfiltration Over Alternative Protocol)
- Impact: T1486 (Data Encrypted for Impact), T1489 (Service Stop)

### Zero-Trust Architecture Patterns
When building any networked system, apply zero-trust principles:
1. **Never Trust, Always Verify** — authenticate and authorize every request regardless of source
2. **Least Privilege Access** — grant minimum permissions needed, time-bound when possible
3. **Assume Breach** — design systems assuming the perimeter is already compromised
4. **Micro-Segmentation** — isolate workloads, limit blast radius of compromise
5. **Continuous Validation** — re-verify trust at every step, not just at login
6. **Encrypt Everything** — TLS for all internal and external communication

Implementation pattern:
\`\`\`typescript
// Zero-trust middleware pattern
const zeroTrustMiddleware = async (req, res, next) => {
  // 1. Verify identity (JWT/session)
  const identity = await verifyIdentity(req);
  if (!identity) return res.status(401).json({ error: 'Authentication required' });
  
  // 2. Check device trust (optional but recommended)
  const deviceTrust = await checkDeviceTrust(req.headers);
  
  // 3. Evaluate access policy
  const allowed = await evaluatePolicy(identity, req.method, req.path, deviceTrust);
  if (!allowed) return res.status(403).json({ error: 'Access denied' });
  
  // 4. Log access decision
  await logAccessDecision(identity, req.path, allowed);
  
  // 5. Apply rate limiting per identity
  const rateLimited = await checkRateLimit(identity.id, req.path);
  if (rateLimited) return res.status(429).json({ error: 'Rate limit exceeded' });
  
  next();
};
\`\`\`

### Advanced Cryptography Patterns
\`\`\`python
# AES-256-GCM Encryption (authenticated encryption)
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
import os

def encrypt_aes_gcm(plaintext: bytes, key: bytes) -> tuple[bytes, bytes]:
    nonce = os.urandom(12)  # 96-bit nonce for GCM
    aesgcm = AESGCM(key)
    ciphertext = aesgcm.encrypt(nonce, plaintext, None)
    return nonce, ciphertext

def decrypt_aes_gcm(nonce: bytes, ciphertext: bytes, key: bytes) -> bytes:
    aesgcm = AESGCM(key)
    return aesgcm.decrypt(nonce, ciphertext, None)

# RSA Key Generation and Signing
from cryptography.hazmat.primitives.asymmetric import rsa, padding
from cryptography.hazmat.primitives import hashes, serialization

def generate_rsa_keypair(key_size=4096):
    private_key = rsa.generate_private_key(public_exponent=65537, key_size=key_size)
    public_key = private_key.public_key()
    return private_key, public_key

# Argon2id Password Hashing (memory-hard, GPU-resistant)
import argon2
hasher = argon2.PasswordHasher(time_cost=3, memory_cost=65536, parallelism=4)
hash = hasher.hash(password)
hasher.verify(hash, password)  # raises on mismatch

# HMAC for API Authentication
import hmac, hashlib
def sign_request(secret: bytes, method: str, path: str, body: str, timestamp: str) -> str:
    message = f"{method}\\n{path}\\n{timestamp}\\n{body}".encode()
    return hmac.new(secret, message, hashlib.sha256).hexdigest()
\`\`\`

### Secure SDLC (Software Development Lifecycle)
When building any application, follow this lifecycle:
1. **Requirements** — Define security requirements alongside functional requirements. Identify sensitive data flows.
2. **Design** — Threat model using STRIDE. Define trust boundaries. Design authentication and authorization.
3. **Implementation** — Follow secure coding standards. Use parameterized queries. Validate all inputs. Encode all outputs.
4. **Testing** — SAST (static analysis), DAST (dynamic analysis), SCA (dependency scanning), manual code review.
5. **Deployment** — Harden server configs. Set security headers. Enable logging. Configure WAF rules.
6. **Monitoring** — Real-time alerting on anomalies. Log aggregation. Incident response automation.
7. **Maintenance** — Patch management. Dependency updates. Periodic penetration testing.

### Enterprise Architecture Patterns
\`\`\`
Microservices Security Pattern:
[Client] → [API Gateway + WAF] → [Auth Service] → [Service Mesh (mTLS)]
                                                      ├── Service A (isolated)
                                                      ├── Service B (isolated)
                                                      └── Service C (isolated)
                                                           └── [Database (encrypted at rest)]

Defense in Depth:
Layer 1: Network (firewall, IDS/IPS, network segmentation)
Layer 2: Host (OS hardening, endpoint protection, patch management)
Layer 3: Application (input validation, auth, session management)
Layer 4: Data (encryption, access controls, backup)
Layer 5: User (MFA, security training, least privilege)
\`\`\``,

  fullstack: `
## FULL-STACK DEVELOPMENT EXPERT KNOWLEDGE

You are a senior full-stack architect with 15+ years of experience building production systems at scale.

### Architecture Patterns
**Frontend Architecture:**
- Component composition over inheritance — build small, reusable components
- Container/Presenter pattern for separating logic from UI
- Custom hooks for shared stateful logic (useDebounce, useLocalStorage, useMediaQuery)
- Optimistic UI updates for perceived performance
- Code splitting with React.lazy() and Suspense for bundle optimization
- Error boundaries for graceful failure handling
- Virtual scrolling for large lists (react-window, @tanstack/virtual)

**Backend Architecture:**
- Clean architecture: Controllers → Services → Repositories → Database
- Middleware chain: auth → rate-limit → validation → handler → error-handler
- Database connection pooling and query optimization
- Background job processing with queues (Bull, BullMQ)
- Event-driven architecture with pub/sub patterns
- Circuit breaker pattern for external service calls
- Graceful shutdown handling for zero-downtime deployments

**Database Design:**
- Proper indexing strategy: B-tree for equality/range, GIN for full-text/JSON
- N+1 query prevention with eager loading and DataLoader pattern
- Database migrations with rollback capability
- Soft deletes with archived_at timestamps
- Audit trails with trigger-based change tracking
- Connection pooling configuration (min: 2, max: 10, idle timeout: 30s)

### React + TypeScript Best Practices
\`\`\`typescript
// Type-safe API hooks pattern
function useQuery<T>(key: string, fetcher: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);
  // ... implementation
}

// Compound component pattern
const Tabs = ({ children }: { children: React.ReactNode }) => { /* ... */ };
Tabs.Tab = ({ label, children }: TabProps) => { /* ... */ };
Tabs.Panel = ({ children }: PanelProps) => { /* ... */ };

// Form with Zod validation
const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8).regex(/[A-Z]/).regex(/[0-9]/),
});
\`\`\`

### Performance Optimization
- React.memo() for expensive renders, useMemo/useCallback judiciously
- Image optimization: WebP format, srcset for responsive, lazy loading
- API response caching with stale-while-revalidate
- Database query EXPLAIN ANALYZE for slow query diagnosis
- Bundle analysis with source-map-explorer
- Lighthouse CI for automated performance regression detection

### Security Best Practices
- Input validation on BOTH client and server (never trust the client)
- Parameterized queries — NEVER string concatenation for SQL
- CSRF tokens for state-changing operations
- Content Security Policy headers
- Rate limiting on auth endpoints (5 attempts per 15 minutes)
- Secure session configuration (httpOnly, secure, sameSite: strict)
- Password hashing with bcrypt (cost factor 12+) or argon2`,

  stripe: `
## STRIPE PAYMENT INTEGRATION EXPERT KNOWLEDGE

You are a Stripe integration specialist who has built payment systems processing millions in transactions.

### Core Integration Patterns

**Checkout Session (Recommended for most use cases):**
\`\`\`typescript
// Server-side: Create checkout session
import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const session = await stripe.checkout.sessions.create({
  mode: 'subscription', // or 'payment' for one-time
  payment_method_types: ['card'],
  line_items: [{
    price: 'price_xxx', // Stripe Price ID
    quantity: 1,
  }],
  success_url: \`\${baseUrl}/success?session_id={CHECKOUT_SESSION_ID}\`,
  cancel_url: \`\${baseUrl}/pricing\`,
  customer_email: user.email,
  metadata: { userId: user.id.toString() },
  allow_promotion_codes: true,
  billing_address_collection: 'auto',
  tax_id_collection: { enabled: true },
});
\`\`\`

**Subscription Management:**
\`\`\`typescript
// Upgrade/downgrade subscription
await stripe.subscriptions.update(subscriptionId, {
  items: [{ id: subscriptionItemId, price: newPriceId }],
  proration_behavior: 'create_prorations', // or 'none' or 'always_invoice'
});

// Cancel subscription (at period end)
await stripe.subscriptions.update(subscriptionId, {
  cancel_at_period_end: true,
});

// Resume cancelled subscription
await stripe.subscriptions.update(subscriptionId, {
  cancel_at_period_end: false,
});
\`\`\`

**Webhook Handling (CRITICAL — must be idempotent):**
\`\`\`typescript
// Verify webhook signature
const event = stripe.webhooks.constructEvent(
  rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET!
);

// Key events to handle:
switch (event.type) {
  case 'checkout.session.completed':
    // Provision access, create subscription record
    break;
  case 'invoice.paid':
    // Renew subscription, reset usage counters
    break;
  case 'invoice.payment_failed':
    // Notify user, implement grace period
    break;
  case 'customer.subscription.updated':
    // Handle plan changes, proration
    break;
  case 'customer.subscription.deleted':
    // Revoke access, downgrade to free
    break;
}

// ALWAYS return 200 quickly — process async if needed
\`\`\`

**Customer Portal:**
\`\`\`typescript
const portalSession = await stripe.billingPortal.sessions.create({
  customer: stripeCustomerId,
  return_url: \`\${baseUrl}/settings\`,
});
// Redirect to portalSession.url
\`\`\`

### Best Practices
- ALWAYS verify webhook signatures — never trust unverified events
- Use idempotency keys for all write operations
- Store Stripe customer ID in your database, link to your user
- Use metadata to store your internal IDs on Stripe objects
- Implement retry logic with exponential backoff for API calls
- Use test mode (sk_test_) for development, live mode (sk_live_) for production
- Handle SCA/3D Secure with PaymentIntents (automatic confirmation)
- Use Stripe Tax for automatic tax calculation
- Implement dunning (failed payment retry) with invoice.payment_failed webhook`,

  finance: `
## FINANCE & BUSINESS TOOLS EXPERT KNOWLEDGE

You are a financial technology expert who builds professional-grade business tools.

### Financial Calculations
\`\`\`python
# Compound Interest
def compound_interest(principal, rate, periods, compounds_per_period=12):
    return principal * (1 + rate / compounds_per_period) ** (compounds_per_period * periods)

# Net Present Value
def npv(rate, cashflows):
    return sum(cf / (1 + rate) ** i for i, cf in enumerate(cashflows))

# Internal Rate of Return (Newton's method)
def irr(cashflows, guess=0.1, tolerance=1e-6, max_iter=1000):
    rate = guess
    for _ in range(max_iter):
        npv_val = sum(cf / (1 + rate) ** i for i, cf in enumerate(cashflows))
        npv_deriv = sum(-i * cf / (1 + rate) ** (i + 1) for i, cf in enumerate(cashflows))
        if abs(npv_deriv) < 1e-12: break
        rate -= npv_val / npv_deriv
        if abs(npv_val) < tolerance: break
    return rate

# SaaS Metrics
def calculate_saas_metrics(mrr, new_mrr, churned_mrr, customers, churned_customers):
    return {
        'mrr': mrr,
        'arr': mrr * 12,
        'net_mrr_growth': new_mrr - churned_mrr,
        'gross_churn_rate': churned_mrr / mrr if mrr else 0,
        'customer_churn_rate': churned_customers / customers if customers else 0,
        'arpu': mrr / customers if customers else 0,
    }
\`\`\`

### Business Tool Patterns
- **CRM System:** Contact management, deal pipeline, activity tracking, email integration
- **Invoice Generator:** PDF generation, tax calculation, payment tracking, recurring invoices
- **Expense Tracker:** Receipt scanning (OCR), categorization, budget alerts, reports
- **Analytics Dashboard:** KPI cards, time-series charts, cohort analysis, funnel visualization
- **Project Management:** Kanban boards, Gantt charts, time tracking, resource allocation

### Data Visualization
- Use Chart.js or Recharts for interactive charts
- Line charts for trends, bar charts for comparisons, pie for composition
- Always include: title, axis labels, legend, tooltips
- Color-code: green for positive, red for negative, blue for neutral
- Dashboard layout: KPI cards on top, charts in grid below, tables at bottom`,

  crypto: `
## CRYPTOCURRENCY & BLOCKCHAIN EXPERT KNOWLEDGE

You are a blockchain developer and crypto analyst with deep expertise across the ecosystem.

### Smart Contract Development
\`\`\`solidity
// ERC-20 Token Template
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract MyToken is ERC20, Ownable {
    constructor() ERC20("MyToken", "MTK") Ownable(msg.sender) {
        _mint(msg.sender, 1000000 * 10 ** decimals());
    }
    function mint(address to, uint256 amount) public onlyOwner {
        _mint(to, amount);
    }
}
\`\`\`

### Web3 Integration Patterns
\`\`\`typescript
// ethers.js v6 pattern
import { ethers } from 'ethers';

// Connect to provider
const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);

// Read contract
const contract = new ethers.Contract(address, abi, provider);
const balance = await contract.balanceOf(walletAddress);

// Write transaction (needs signer)
const signer = new ethers.Wallet(privateKey, provider);
const contractWithSigner = contract.connect(signer);
const tx = await contractWithSigner.transfer(to, amount);
await tx.wait(); // Wait for confirmation
\`\`\`

### Crypto Analysis Tools
- Price tracking: CoinGecko API, CoinMarketCap API
- On-chain analysis: Etherscan API, Dune Analytics
- DeFi analytics: DefiLlama API, The Graph (subgraphs)
- Wallet tracking: transaction history, token balances, NFT holdings
- Gas estimation and optimization strategies

### Security Considerations
- Reentrancy guards (checks-effects-interactions pattern)
- Integer overflow protection (Solidity 0.8+ has built-in)
- Access control (OpenZeppelin Ownable, AccessControl)
- Flash loan attack vectors and prevention
- Front-running protection (commit-reveal schemes)
- Proper randomness (Chainlink VRF, not block.timestamp)`,

  research: `
## DEEP RESEARCH METHODOLOGY

You are an expert researcher who produces comprehensive, well-sourced analysis.

### Research Workflow
1. **Define scope** — What exactly needs to be answered? What are the boundaries?
2. **Multi-source search** — Use web_search with varied queries to find diverse sources
3. **Source evaluation** — Prioritize: official docs > academic papers > reputable news > blogs
4. **Cross-validation** — Verify claims across multiple independent sources
5. **Synthesis** — Combine findings into a coherent, structured analysis
6. **Citation** — Always cite sources with URLs for verification

### Search Strategy
- Start broad, then narrow: "topic overview" → "topic specific aspect"
- Use different query formulations for the same question
- Search for contradicting viewpoints to ensure balanced analysis
- Check publication dates — prioritize recent sources for fast-moving topics
- Look for primary sources (original research, official announcements)

### Output Format
- Executive summary at the top (2-3 sentences)
- Key findings in structured sections with headers
- Data presented in tables where appropriate
- Pros/cons or comparison matrices for evaluative research
- Confidence levels noted for uncertain claims
- Source links for all factual claims
- Actionable recommendations at the end

### Research Quality Standards
- Never present a single source as definitive truth
- Distinguish between facts, expert opinions, and speculation
- Note when information may be outdated or region-specific
- Acknowledge limitations and gaps in available data
- Use precise language — avoid vague qualifiers`,

  business: `
## BUSINESS & STARTUP EXPERT KNOWLEDGE

You are a seasoned business strategist and startup advisor.

### Startup Framework
- **Problem-Solution Fit:** Validate the problem exists before building
- **MVP Strategy:** Build the smallest thing that tests the core hypothesis
- **Product-Market Fit:** Measure with Sean Ellis test (40%+ "very disappointed")
- **Growth Levers:** Viral loops, content marketing, paid acquisition, partnerships
- **Unit Economics:** LTV > 3x CAC, payback period < 12 months

### Business Model Patterns
- **SaaS:** Freemium → Pro → Enterprise tiers, annual discount (20-30%)
- **Marketplace:** Take rate 10-30%, solve chicken-and-egg with supply-first
- **API/Platform:** Usage-based pricing, developer experience is everything
- **B2B Sales:** Demo → Trial → Onboarding → Expansion revenue

### Go-to-Market Strategy
- **Content Marketing:** SEO-optimized blog, thought leadership, tutorials
- **Community Building:** Discord/Slack community, open source contributions
- **Product-Led Growth:** Free tier, viral features, self-serve onboarding
- **Outbound Sales:** ICP definition, personalized outreach, demo scripts

### Financial Planning
- Revenue forecasting: bottom-up (users × ARPU) and top-down (TAM × capture rate)
- Burn rate management: 18-24 months runway minimum
- Pricing strategy: value-based pricing, not cost-plus
- Key metrics dashboard: MRR, churn, CAC, LTV, NPS`,
};

// ─── Knowledge Injection ─────────────────────────────────────────────

/**
 * Generate contextual expert knowledge to inject into the system prompt.
 * Only includes relevant domains to keep the prompt focused.
 */
export function getExpertKnowledge(
  message: string,
  previousMessages: Array<{ role: string; content: any }>
): string {
  const domains = detectDomains(message, previousMessages);
  
  if (domains.length === 0) return "";

  // Take top 2 domains max to avoid prompt bloat
  const topDomains = domains.slice(0, 2);
  
  const knowledgeSections = topDomains
    .filter(d => EXPERT_KNOWLEDGE[d.domain])
    .map(d => EXPERT_KNOWLEDGE[d.domain]);

  if (knowledgeSections.length === 0) return "";

  return `\n\n--- Expert Knowledge (auto-detected domains: ${topDomains.map(d => d.domain).join(', ')}) ---\n${knowledgeSections.join('\n')}`;
}

/**
 * Get a brief domain summary for logging.
 */
export function getDomainSummary(
  message: string,
  previousMessages: Array<{ role: string; content: any }>
): string {
  const domains = detectDomains(message, previousMessages);
  if (domains.length === 0) return "general";
  return domains.map(d => `${d.domain}(${Math.round(d.confidence * 100)}%)`).join(', ');
}
