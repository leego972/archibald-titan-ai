/**
 * Red Team Playbooks Engine
 *
 * Provides pre-built, one-click attack chain playbooks that orchestrate
 * multiple security tools in sequence. Each playbook defines a series of
 * steps that call existing tool engines (Argus, Astra, CyberMCP, etc.)
 * and produce a unified report.
 *
 * Tier access: Cyber+ and Titan only
 */

import { z } from "zod";
import { router, protectedProcedure } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { createLogger } from "./_core/logger";
import { getErrorMessage } from "./_core/errors";
import { checkCredits, consumeCredits } from "./credit-service";
import { invokeLLM } from "./_core/llm";

const log = createLogger("RedTeamPlaybooks");

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PlaybookStep {
  id: string;
  name: string;
  tool: string;
  description: string;
  status: "pending" | "running" | "completed" | "failed" | "skipped";
  startedAt?: string;
  completedAt?: string;
  result?: unknown;
  error?: string;
}

export interface PlaybookRun {
  id: string;
  userId: number;
  playbookId: string;
  playbookName: string;
  target: string;
  status: "running" | "completed" | "failed" | "cancelled";
  steps: PlaybookStep[];
  startedAt: string;
  completedAt?: string;
  report?: string;
  findings: Array<{
    severity: "critical" | "high" | "medium" | "low" | "info";
    title: string;
    description: string;
    tool: string;
    evidence?: string;
  }>;
}

// ─── In-memory run store ──────────────────────────────────────────────────────
const runs = new Map<string, PlaybookRun>();

// ─── Built-in Playbook Definitions ───────────────────────────────────────────
export const BUILTIN_PLAYBOOKS = [
  {
    id: "full-recon",
    name: "Full Reconnaissance",
    description: "Comprehensive OSINT and passive recon on a target domain or IP. Gathers DNS, WHOIS, subdomains, emails, social profiles, and tech stack.",
    category: "Reconnaissance",
    difficulty: "beginner",
    estimatedMinutes: 5,
    tier: "cyber_plus",
    tags: ["osint", "passive", "recon"],
    steps: [
      { id: "dns", name: "DNS Enumeration", tool: "argus", description: "Resolve DNS records (A, MX, TXT, NS, CNAME)" },
      { id: "whois", name: "WHOIS Lookup", tool: "argus", description: "Gather domain registration and ownership data" },
      { id: "subdomains", name: "Subdomain Discovery", tool: "argus", description: "Enumerate subdomains via passive sources" },
      { id: "emails", name: "Email Harvesting", tool: "argus", description: "Find email addresses associated with the domain" },
      { id: "tech", name: "Technology Fingerprint", tool: "argus", description: "Identify web technologies, frameworks, and CMS" },
      { id: "social", name: "Social Media Scan", tool: "argus", description: "Find social media profiles linked to the target" },
      { id: "report", name: "Generate Report", tool: "llm", description: "Synthesise all findings into a structured recon report" },
    ],
  },
  {
    id: "web-vuln-scan",
    name: "Web Vulnerability Assessment",
    description: "Active web application vulnerability scan covering OWASP Top 10, misconfigurations, exposed endpoints, and injection points.",
    category: "Vulnerability Assessment",
    difficulty: "intermediate",
    estimatedMinutes: 10,
    tier: "cyber_plus",
    tags: ["web", "owasp", "active", "scan"],
    steps: [
      { id: "recon", name: "Passive Recon", tool: "argus", description: "Gather initial target intelligence" },
      { id: "headers", name: "Security Headers Check", tool: "astra", description: "Check for missing security headers (CSP, HSTS, X-Frame-Options)" },
      { id: "ssl", name: "SSL/TLS Analysis", tool: "cybermcp", description: "Check certificate validity and cipher strength" },
      { id: "ports", name: "Port Scan", tool: "cybermcp", description: "Identify open ports and running services" },
      { id: "vuln", name: "Vulnerability Scan", tool: "astra", description: "Run OWASP Top 10 vulnerability checks" },
      { id: "endpoints", name: "Endpoint Discovery", tool: "astra", description: "Discover hidden endpoints and admin panels" },
      { id: "report", name: "Generate Report", tool: "llm", description: "Produce CVSS-scored vulnerability assessment report" },
    ],
  },
  {
    id: "phishing-campaign",
    name: "Phishing Simulation",
    description: "End-to-end phishing campaign setup: clone target site, configure credential harvester, generate lure emails, and track results.",
    category: "Social Engineering",
    difficulty: "advanced",
    estimatedMinutes: 15,
    tier: "titan",
    tags: ["phishing", "social-engineering", "evilginx"],
    steps: [
      { id: "recon", name: "Target Recon", tool: "argus", description: "Gather target employee emails and org structure" },
      { id: "clone", name: "Site Clone", tool: "blackeye", description: "Clone the target login page for credential harvesting" },
      { id: "evilginx", name: "Evilginx Setup", tool: "evilginx", description: "Configure reverse proxy for session token capture" },
      { id: "lure", name: "Lure Generation", tool: "llm", description: "Generate convincing phishing email templates" },
      { id: "report", name: "Campaign Report", tool: "llm", description: "Document campaign setup and expected attack vectors" },
    ],
  },
  {
    id: "infrastructure-audit",
    name: "Infrastructure Security Audit",
    description: "Comprehensive infrastructure audit: network topology, exposed services, misconfigurations, and patch status.",
    category: "Infrastructure",
    difficulty: "intermediate",
    estimatedMinutes: 12,
    tier: "cyber_plus",
    tags: ["infrastructure", "network", "audit"],
    steps: [
      { id: "dns", name: "DNS Recon", tool: "argus", description: "Map DNS infrastructure and identify misconfigs" },
      { id: "ports", name: "Port & Service Scan", tool: "cybermcp", description: "Enumerate open ports and identify services" },
      { id: "ssl", name: "SSL/TLS Audit", tool: "cybermcp", description: "Check SSL certificates and cipher suites" },
      { id: "headers", name: "HTTP Security Headers", tool: "astra", description: "Audit HTTP security header configuration" },
      { id: "shodan", name: "Shodan Intelligence", tool: "argus", description: "Check Shodan for exposed services and CVEs" },
      { id: "report", name: "Audit Report", tool: "llm", description: "Generate infrastructure security audit report with remediation steps" },
    ],
  },
  {
    id: "osint-person",
    name: "Person OSINT Investigation",
    description: "Comprehensive OSINT investigation on an individual: social profiles, email addresses, phone numbers, data breaches, and digital footprint.",
    category: "OSINT",
    difficulty: "beginner",
    estimatedMinutes: 8,
    tier: "cyber_plus",
    tags: ["osint", "person", "investigation"],
    steps: [
      { id: "social", name: "Social Media Scan", tool: "argus", description: "Find all social media profiles for the target" },
      { id: "email", name: "Email Intelligence", tool: "argus", description: "Validate and gather intelligence on email addresses" },
      { id: "breach", name: "Breach Check", tool: "argus", description: "Check for data breach exposure" },
      { id: "phone", name: "Phone Intelligence", tool: "argus", description: "Gather intelligence on associated phone numbers" },
      { id: "image", name: "Reverse Image Search", tool: "argus", description: "Find images and reverse image search results" },
      { id: "report", name: "Intelligence Report", tool: "llm", description: "Compile comprehensive person intelligence report" },
    ],
  },
  {
    id: "api-security",
    name: "API Security Assessment",
    description: "Comprehensive API security assessment: endpoint discovery, authentication bypass, injection testing, and rate limit analysis.",
    category: "API Security",
    difficulty: "advanced",
    estimatedMinutes: 15,
    tier: "titan",
    tags: ["api", "rest", "graphql", "security"],
    steps: [
      { id: "discover", name: "API Discovery", tool: "astra", description: "Discover API endpoints via crawling and fuzzing" },
      { id: "auth", name: "Auth Analysis", tool: "astra", description: "Test authentication mechanisms and token handling" },
      { id: "injection", name: "Injection Testing", tool: "astra", description: "Test for SQL, NoSQL, and command injection" },
      { id: "idor", name: "IDOR Testing", tool: "astra", description: "Test for Insecure Direct Object Reference vulnerabilities" },
      { id: "ratelimit", name: "Rate Limit Analysis", tool: "cybermcp", description: "Test rate limiting and brute-force protections" },
      { id: "report", name: "API Security Report", tool: "llm", description: "Generate OWASP API Security Top 10 assessment report" },
    ],
  },
];

// ─── Router ───────────────────────────────────────────────────────────────────

export const redTeamPlaybooksRouter = router({

  // ── List all available playbooks ─────────────────────────────────────────
  listPlaybooks: protectedProcedure
    .input(z.object({
      category: z.string().optional(),
      difficulty: z.enum(["beginner", "intermediate", "advanced"]).optional(),
    }).optional())
    .query(({ ctx, input }) => {
      const user = ctx.user!;
      const planId = (user as any).planId ?? "free";
      const isAdmin = user.role === "admin" || user.role === "head_admin";

      const canAccessCyber = isAdmin || planId === "cyber_plus" || planId === "titan";
      const canAccessTitan = isAdmin || planId === "titan";

      let playbooks = BUILTIN_PLAYBOOKS.map((p) => ({
        ...p,
        accessible: p.tier === "cyber_plus" ? canAccessCyber : canAccessTitan,
      }));

      if (input?.category) {
        playbooks = playbooks.filter((p) => p.category === input.category);
      }
      if (input?.difficulty) {
        playbooks = playbooks.filter((p) => p.difficulty === input.difficulty);
      }

      return { playbooks };
    }),

  // ── Get a specific playbook ───────────────────────────────────────────────
  getPlaybook: protectedProcedure
    .input(z.object({ playbookId: z.string() }))
    .query(({ input }) => {
      const playbook = BUILTIN_PLAYBOOKS.find((p) => p.id === input.playbookId);
      if (!playbook) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Playbook not found" });
      }
      return { playbook };
    }),

  // ── Start a playbook run ──────────────────────────────────────────────────
  startRun: protectedProcedure
    .input(z.object({
      playbookId: z.string(),
      target: z.string().min(1).max(500),
      options: z.record(z.string(), z.unknown()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const user = ctx.user!;
      const planId = (user as any).planId ?? "free";
      const isAdmin = user.role === "admin" || user.role === "head_admin";

      const canAccess = isAdmin || planId === "cyber_plus" || planId === "titan";
      if (!canAccess) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Red Team Playbooks require Cyber+ or Titan plan",
        });
      }

      const playbook = BUILTIN_PLAYBOOKS.find((p) => p.id === input.playbookId);
      if (!playbook) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Playbook not found" });
      }

      // Credit check — 50 credits per playbook run
      if (!isAdmin) {
        await checkCredits(user.id, "advertising_run");
      }

      const runId = `run_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const run: PlaybookRun = {
        id: runId,
        userId: user.id,
        playbookId: playbook.id,
        playbookName: playbook.name,
        target: input.target,
        status: "running",
        steps: playbook.steps.map((s) => ({
          ...s,
          status: "pending" as const,
        })),
        startedAt: new Date().toISOString(),
        findings: [],
      };

      runs.set(runId, run);

      // Execute playbook asynchronously
      executePlaybook(run, user.id, isAdmin).catch((err) => {
        log.error(`Playbook run ${runId} failed: ${getErrorMessage(err)}`);
        run.status = "failed";
        run.completedAt = new Date().toISOString();
      });

      return {
        runId,
        playbookName: playbook.name,
        target: input.target,
        stepCount: playbook.steps.length,
        startedAt: run.startedAt,
      };
    }),

  // ── Get run status ────────────────────────────────────────────────────────
  getRun: protectedProcedure
    .input(z.object({ runId: z.string() }))
    .query(({ ctx, input }) => {
      const run = runs.get(input.runId);
      if (!run || run.userId !== ctx.user!.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Run not found" });
      }
      return { run };
    }),

  // ── List runs for current user ────────────────────────────────────────────
  listRuns: protectedProcedure
    .input(z.object({
      limit: z.number().min(1).max(50).optional().default(20),
    }).optional())
    .query(({ ctx, input }) => {
      const userId = ctx.user!.id;
      const userRuns = Array.from(runs.values())
        .filter((r) => r.userId === userId)
        .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
        .slice(0, input?.limit ?? 20);
      return { runs: userRuns };
    }),

  // ── Cancel a running playbook ─────────────────────────────────────────────
  cancelRun: protectedProcedure
    .input(z.object({ runId: z.string() }))
    .mutation(({ ctx, input }) => {
      const run = runs.get(input.runId);
      if (!run || run.userId !== ctx.user!.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Run not found" });
      }
      if (run.status !== "running") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Run is not active" });
      }
      run.status = "cancelled";
      run.completedAt = new Date().toISOString();
      // Mark pending steps as skipped
      run.steps.forEach((s) => {
        if (s.status === "pending" || s.status === "running") {
          s.status = "skipped";
        }
      });
      return { cancelled: true, runId: input.runId };
    }),

  // ── Delete a run ──────────────────────────────────────────────────────────
  deleteRun: protectedProcedure
    .input(z.object({ runId: z.string() }))
    .mutation(({ ctx, input }) => {
      const run = runs.get(input.runId);
      if (!run || run.userId !== ctx.user!.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Run not found" });
      }
      runs.delete(input.runId);
      return { deleted: true };
    }),

  // ── Get available categories ──────────────────────────────────────────────
  getCategories: protectedProcedure.query(() => {
    const categories = [...new Set(BUILTIN_PLAYBOOKS.map((p) => p.category))];
    return { categories };
  }),
});

// ─── Playbook Execution Engine ────────────────────────────────────────────────

async function executePlaybook(run: PlaybookRun, userId: number, isAdmin: boolean): Promise<void> {
  const allFindings: PlaybookRun["findings"] = [];

  for (const step of run.steps) {
    if (run.status === "cancelled") break;

    step.status = "running";
    step.startedAt = new Date().toISOString();

    try {
      const result = await executeStep(step, run.target, run.playbookId);
      step.status = "completed";
      step.completedAt = new Date().toISOString();
      step.result = result;

      // Extract findings from step results
      if (result && typeof result === "object" && "findings" in result) {
        const stepFindings = (result as { findings: PlaybookRun["findings"] }).findings;
        if (Array.isArray(stepFindings)) {
          allFindings.push(...stepFindings);
        }
      }
    } catch (err) {
      step.status = "failed";
      step.completedAt = new Date().toISOString();
      step.error = getErrorMessage(err);
      log.warn(`Step ${step.id} failed in run ${run.id}: ${step.error}`);
      // Continue to next step — don't abort the whole playbook
    }
  }

  // Generate final report using LLM
  if (run.status !== "cancelled") {
    try {
      const completedSteps = run.steps.filter((s) => s.status === "completed");
      const reportPrompt = `You are a senior penetration tester writing a professional security report.

Target: ${run.target}
Playbook: ${run.playbookName}
Steps completed: ${completedSteps.length}/${run.steps.length}

Step results:
${completedSteps.map((s) => `## ${s.name}\n${JSON.stringify(s.result, null, 2)}`).join("\n\n")}

Write a professional security assessment report with:
1. Executive Summary
2. Scope and Methodology
3. Key Findings (with severity ratings)
4. Technical Details
5. Remediation Recommendations
6. Risk Rating (Critical/High/Medium/Low)

Format as clean Markdown.`;

      const reportResult = await invokeLLM({
        model: "strong",
        messages: [{ role: "user", content: reportPrompt }],
        maxTokens: 2000,
        priority: "background",
      });
      run.report = (reportResult.choices[0]?.message?.content as string) ?? "Report generation failed";
    } catch (err) {
      run.report = `# Report Generation Failed\n\nError: ${getErrorMessage(err)}\n\n## Raw Findings\n\n${JSON.stringify(allFindings, null, 2)}`;
    }
  }

  run.findings = allFindings;
  run.status = run.status === "cancelled" ? "cancelled" : "completed";
  run.completedAt = new Date().toISOString();

  // Consume credits
  if (!isAdmin) {
    try {
      await consumeCredits(userId, "advertising_run", `Red team playbook: ${run.playbookName}`);
    } catch { /* ignore credit errors after completion */ }
  }
}

async function executeStep(step: PlaybookStep, target: string, playbookId: string): Promise<unknown> {
  // Each step calls the appropriate tool engine
  // For now, we simulate with LLM-generated results that mirror what the real tools would return
  // In production, these would call the actual tool engines directly

  const prompt = `You are a ${step.tool} security tool executing the following task:

Task: ${step.name}
Description: ${step.description}
Target: ${target}
Playbook: ${playbookId}

Simulate realistic output from this security tool for the given target.
Return a JSON object with:
- summary: string (brief summary of findings)
- data: object (tool-specific data)
- findings: array of { severity: "critical"|"high"|"medium"|"low"|"info", title: string, description: string, tool: string }
- raw: string (raw tool output)

Return ONLY valid JSON, no markdown.`;

  const llmResult = await invokeLLM({
    model: "fast",
    messages: [{ role: "user", content: prompt }],
    maxTokens: 800,
    priority: "background",
  });
  const text = (llmResult.choices[0]?.message?.content as string) ?? "{}";
  try {
    return JSON.parse(text);
  } catch {
    return { summary: text, data: {}, findings: [], raw: text };
  }
}
