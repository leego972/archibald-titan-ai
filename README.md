# Archibald Titan AI

Archibald Titan AI is an advanced, unified DevSecOps and AI agent platform. It combines autonomous software building capabilities with enterprise-grade cybersecurity tooling, red teaming orchestration, compliance reporting, and SIEM integration.

## 🌟 Core Features

### 1. AI Builder & Orchestration
- **Titan Assistant**: An autonomous AI agent capable of writing code, debugging, and orchestrating workflows.
- **Builder Templates**: Pre-configured templates for rapidly deploying common architectures.
- **Auto Error Recovery**: The agent can autonomously detect build errors, suggest fixes, and apply them.

### 2. Offensive Security & Red Teaming
- **Attack Graph Visualisation**: Interactive React Flow-based mapping of attack surfaces and vulnerabilities.
- **Proxy Interceptor**: Burp Suite-style HTTP/HTTPS traffic interception and modification.
- **Red Team Playbooks**: Automated, multi-step attack chains combining OSINT, scanning, and exploitation tools.
- **Unified Command Centre**: Centralised dashboard for monitoring all active security engines (Argus, Astra, CyberMCP).

### 3. Enterprise Compliance & Monitoring
- **Compliance Reports**: Automated generation of SOC2, ISO27001, and GDPR compliance reports based on system configuration and active controls.
- **SIEM Integration**: Forward security events to enterprise SIEMs (Splunk, Elastic, Datadog, Sentinel, Webhooks).
- **Cross-Engine Event Bus**: Create automation rules triggered by security events (e.g., "If Argus finds a new subdomain, run Astra vulnerability scan").

### 4. Ecosystem
- **Security Marketplace**: Community-driven repository of security modules, playbooks, and extensions.
- **Desktop Application**: Packaged as an Electron app for local execution and offline capabilities.
- **Billing & Tiers**: Fully integrated Stripe billing with 6 pricing tiers, including Crypto and Binance Pay options.

## 🛠 Tech Stack

- **Frontend**: React, TypeScript, Tailwind CSS, Vite, wouter, React Flow
- **Backend**: Node.js, Express, tRPC
- **Database**: PostgreSQL (via Drizzle ORM)
- **Desktop**: Electron
- **Security Engines**: Python, Go, Playwright
- **AI Integration**: OpenAI-compatible LLM engine

## 🚀 Getting Started

### Prerequisites
- Node.js (v20+)
- pnpm
- PostgreSQL database
- Stripe account (for billing)
- OpenAI API key (or compatible endpoint)

### Local Development

1. **Clone the repository**
   \`\`\`bash
   git clone https://github.com/leego972/archibald-titan-ai.git
   cd archibald-titan-ai
   \`\`\`

2. **Install dependencies**
   \`\`\`bash
   pnpm install
   \`\`\`

3. **Environment Setup**
   Copy the example environment file and fill in your secrets:
   \`\`\`bash
   cp .env.example .env
   \`\`\`
   *Ensure you set \`DATABASE_URL\`, \`OPENAI_API_KEY\`, and Stripe keys.*

4. **Database Migration**
   \`\`\`bash
   pnpm db:push
   \`\`\`

5. **Start the development server**
   \`\`\`bash
   pnpm dev
   \`\`\`
   The app will be available at \`http://localhost:5000\`.

### Desktop App (Electron)
To build and run the Electron desktop application:
\`\`\`bash
pnpm build:electron
pnpm start:electron
\`\`\`

## 🚢 Deployment

The platform is designed to be deployed on modern PaaS providers like Railway, Render, or Vercel (for frontend).

### Railway Deployment
1. Connect your GitHub repository to Railway.
2. Provision a PostgreSQL database in Railway.
3. Add all required environment variables from your \`.\env\` file.
4. The provided \`railway.toml\` and \`Dockerfile\` will automatically handle the build and deployment process.

### Docker
A multi-stage \`Dockerfile\` is included for containerised deployments, which sets up the Node.js environment alongside Python, Go, and Playwright dependencies required by the security engines.

## ⚠️ Disclaimer

Archibald Titan AI includes powerful offensive security tools. These tools are provided strictly for **educational purposes, authorised penetration testing, and defensive research**. You must only use these tools against systems, networks, and applications for which you have explicit, written permission to test. The developers assume no liability for misuse or damage caused by this software.

## 📄 License

Proprietary. All rights reserved.
