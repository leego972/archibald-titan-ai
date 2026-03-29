# Archibald Titan AI — Architecture & Risk Register

This document outlines the core architectural patterns of the Archibald Titan AI platform, alongside known structural risks and the planned roadmap for remediation.

## 1. System Overview

Archibald Titan AI is a monolithic Node.js application built with Express, tRPC, and React. It serves both as a traditional SaaS platform (billing, authentication, user management) and as an orchestrator for autonomous agents, background schedulers, and a self-improving AI builder.

## 2. Known Architectural Risks

Following the Q2 security and architecture audit, two high-priority structural risks have been identified. These represent technical debt that must be addressed before scaling the platform to enterprise customers.

### Risk 1: Blast-Radius of Titan LLM Builder (Audit Finding F3)

**Severity:** High
**Description:** The "Titan" self-improving builder agent currently operates within the same Node.js process and filesystem context as the primary web server. It has the ability to read, modify, and write source code (`server/`, `client/`, `shared/`) while the application is running.
**Impact:** If the LLM generates malformed code, introduces a syntax error, or is manipulated via prompt injection, it could crash the main Node.js process, causing a total platform outage for all users. The blast radius of a failed build is the entire production environment.

**Remediation Roadmap (Q3):**
1. **Process Isolation:** Move the Titan builder engine into a dedicated worker process or a separate containerized microservice.
2. **Ephemeral Sandboxing:** Execute all AI-generated code modifications in an ephemeral, isolated Docker sandbox.
3. **Automated Verification:** Require the sandbox to pass a full `tsc` type-check and test suite run before any code is merged back to the primary branch.
4. **CI/CD Integration:** Instead of live-editing the running production filesystem, the builder should open Pull Requests against the GitHub repository, allowing the standard CI/CD pipeline to validate and deploy the changes safely.

### Risk 2: Scheduler Tight Coupling (Audit Finding F4)

**Severity:** High
**Description:** The platform currently runs multiple heavy background schedulers (e.g., Affiliate Discovery, SEO Engine, Security Sweeps, Marketing Orchestrator) inside the main Express.js web server process.
**Impact:** As the user base grows, these background tasks will consume increasing amounts of CPU and memory. Because Node.js is single-threaded, heavy synchronous operations or garbage collection spikes triggered by these schedulers will block the event loop, degrading the latency and reliability of the user-facing web HTTP API. Furthermore, horizontally scaling the web tier (e.g., running 3 instances) will cause these schedulers to run 3 times concurrently, leading to race conditions and duplicate executions.

**Remediation Roadmap (Q3/Q4):**
1. **Decoupling:** Extract all background schedulers (`setInterval` and `cron` jobs) from `server/_core/index.ts`.
2. **Message Queue:** Implement a robust message broker (e.g., Redis + BullMQ or RabbitMQ) to handle job scheduling, retries, and dead-letter queues.
3. **Worker Tier:** Deploy a separate "Worker" tier of instances dedicated solely to processing background jobs, entirely separate from the "Web" tier handling HTTP requests.
4. **Idempotency:** Ensure all job handlers are idempotent to safely handle retries and distributed execution.
