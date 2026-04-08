/**
 * Sandbox Router — tRPC endpoints for sandbox management and command execution
 */

import { z } from "zod";
import { router, protectedProcedure } from "./_core/trpc";
import {
  createSandbox,
  getSandbox,
  listSandboxes,
  deleteSandbox,
  executeCommand,
  getCommandHistory,
  listFiles,
  readFile,
  writeFile,
  persistWorkspace,
  updateEnvVars,
  installPackage,
  restoreWorkspace,
  writeBinaryFile,
  deleteFile as deleteFileFromSandbox,
} from "./sandbox-engine";
import {
  runPassiveWebScan,
  runPortScan,
  checkSSL,
  analyzeCodeSecurity,
  auditDNSSecurity,
  fingerprintTarget,
  analyzeHeaders,
  generateSecurityReport,
} from "./security-tools";
import {
  fixSingleVulnerability,
  fixAllVulnerabilities,
  generateFixReport,
} from "./auto-fix-engine";
import { consumeCredits } from "./credit-service";

export const sandboxRouter = router({
  /**
   * List all sandboxes for the current user
   */
  list: protectedProcedure.query(async ({ ctx }) => {
    return listSandboxes(ctx.user.id);
  }),

  /**
   * Get a specific sandbox by ID
   */
  get: protectedProcedure
    .input(z.object({ sandboxId: z.number().int() }))
    .query(async ({ input, ctx }) => {
      const sandbox = await getSandbox(input.sandboxId, ctx.user.id);
      if (!sandbox) throw new Error("Sandbox not found");
      return sandbox;
    }),

  /**
   * Create a new sandbox
   */
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(128),
        memoryMb: z.number().int().min(128).max(2048).optional(),
        diskMb: z.number().int().min(256).max(8192).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try { await consumeCredits(ctx.user.id, "sandbox_run", "Sandbox created"); } catch { /* ignore */ }
      return createSandbox(ctx.user.id, input.name, {
        memoryMb: input.memoryMb,
        diskMb: input.diskMb,
      });
    }),

  /**
   * Delete a sandbox
   */
  delete: protectedProcedure
    .input(z.object({ sandboxId: z.number().int() }))
    .mutation(async ({ input, ctx }) => {
      const success = await deleteSandbox(input.sandboxId, ctx.user.id);
      if (!success) throw new Error("Sandbox not found or delete failed");
      return { success: true };
    }),

  /**
   * Execute a command in a sandbox
   */
  exec: protectedProcedure
    .input(
      z.object({
        sandboxId: z.number().int(),
        command: z.string().min(1).max(10_000),
        timeoutMs: z.number().int().min(1000).max(300_000).optional(),
        workingDirectory: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try { await consumeCredits(ctx.user.id, "sandbox_run", `Sandbox exec: ${input.command.slice(0, 60)}`); } catch { /* ignore */ }
      return executeCommand(input.sandboxId, ctx.user.id, input.command, {
        timeoutMs: input.timeoutMs,
        triggeredBy: "user",
        workingDirectory: input.workingDirectory,
      });
    }),

  /**
   * Get command history for a sandbox
   */
  history: protectedProcedure
    .input(
      z.object({
        sandboxId: z.number().int(),
        limit: z.number().int().min(1).max(200).optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      return getCommandHistory(input.sandboxId, ctx.user.id, input.limit ?? 50);
    }),

  /**
   * List files in a sandbox directory
   */
  listFiles: protectedProcedure
    .input(
      z.object({
        sandboxId: z.number().int(),
        path: z.string().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      return listFiles(input.sandboxId, ctx.user.id, input.path ?? "/home/sandbox");
    }),

  /**
   * Read a file from the sandbox
   */
  readFile: protectedProcedure
    .input(
      z.object({
        sandboxId: z.number().int(),
        path: z.string(),
      })
    )
    .query(async ({ input, ctx }) => {
      const content = await readFile(input.sandboxId, ctx.user.id, input.path);
      if (content === null) throw new Error("File not found");
      return { content };
    }),

  /**
   * Write a file to the sandbox
   */
  writeFile: protectedProcedure
    .input(
      z.object({
        sandboxId: z.number().int(),
        path: z.string(),
        content: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const success = await writeFile(input.sandboxId, ctx.user.id, input.path, input.content);
      if (!success) throw new Error("Failed to write file");
      return { success: true };
    }),

  /**
   * Save sandbox workspace to S3
   */
  persist: protectedProcedure
    .input(z.object({ sandboxId: z.number().int() }))
    .mutation(async ({ input, ctx }) => {
      const url = await persistWorkspace(input.sandboxId, ctx.user.id) as string | null;
      if (!url) throw new Error("Failed to persist workspace");
      return { url };
    }),

  /**
   * Update environment variables
   */
  updateEnv: protectedProcedure
    .input(
      z.object({
        sandboxId: z.number().int(),
        envVars: z.record(z.string(), z.string()),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const success = await updateEnvVars(input.sandboxId, ctx.user.id, input.envVars);
      if (!success) throw new Error("Failed to update env vars");
      return { success: true };
    }),

  /**
   * Install a package in the sandbox
   */
  installPackage: protectedProcedure
    .input(
      z.object({
        sandboxId: z.number().int(),
        packageManager: z.enum(["apt", "pip", "npm"]),
        packageName: z.string().min(1),
      })
    )
    .mutation(async ({ input, ctx }) => {
      return installPackage(
        input.sandboxId,
        ctx.user.id,
        input.packageManager,
        input.packageName
      );
    }),

  /**
   * Rename a sandbox
   */
  rename: protectedProcedure
    .input(
      z.object({
        sandboxId: z.number().int(),
        name: z.string().min(1).max(128),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { getDb } = await import("./db");
      const { sandboxes } = await import("../drizzle/schema");
      const { eq, and } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const sandbox = await getSandbox(input.sandboxId, ctx.user.id);
      if (!sandbox) throw new Error("Sandbox not found");
      await db
        .update(sandboxes)
        .set({ name: input.name })
        .where(and(eq(sandboxes.id, input.sandboxId), eq(sandboxes.userId, ctx.user.id)));
      return { success: true };
    }),

  /**
   * Delete a file from the sandbox
   */
  deleteFile: protectedProcedure
    .input(
      z.object({
        sandboxId: z.number().int(),
        path: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const result = await executeCommand(input.sandboxId, ctx.user.id, `rm -rf "${input.path}"`, {
        triggeredBy: "user",
      });
      return { success: result.exitCode === 0 };
    }),

  /**
   * Create a directory in the sandbox
   */
  createDir: protectedProcedure
    .input(
      z.object({
        sandboxId: z.number().int(),
        path: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const result = await executeCommand(input.sandboxId, ctx.user.id, `mkdir -p "${input.path}"`, {
        triggeredBy: "user",
      });
      return { success: result.exitCode === 0 };
    }),

  /**
   * Get environment variables for a sandbox
   */
  getEnv: protectedProcedure
    .input(z.object({ sandboxId: z.number().int() }))
    .query(async ({ input, ctx }) => {
      const sandbox = await getSandbox(input.sandboxId, ctx.user.id);
      if (!sandbox) throw new Error("Sandbox not found");
      return sandbox.envVars || {};
    }),

  /**
   * Delete an environment variable
   */
  deleteEnv: protectedProcedure
    .input(
      z.object({
        sandboxId: z.number().int(),
        key: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { getDb } = await import("./db");
      const { sandboxes } = await import("../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      const sandbox = await getSandbox(input.sandboxId, ctx.user.id);
      if (!sandbox) throw new Error("Sandbox not found");
      const envVars = { ...(sandbox.envVars || {}) };
      delete envVars[input.key];
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      await db.update(sandboxes).set({ envVars }).where(eq(sandboxes.id, input.sandboxId));
      return { success: true };
    }),

  /**
   * Get installed packages for a sandbox
   */
  getPackages: protectedProcedure
    .input(z.object({ sandboxId: z.number().int() }))
    .query(async ({ input, ctx }) => {
      const sandbox = await getSandbox(input.sandboxId, ctx.user.id);
      if (!sandbox) throw new Error("Sandbox not found");
      return sandbox.installedPackages || [];
    }),

  // ─── Security Tools ─────────────────────────────────────────────

  /**
   * Run a full passive web scan — headers, cookies, CORS, WAF, tech fingerprint
   */
  securityScan: protectedProcedure
    .input(z.object({ url: z.string().url() }))
    .mutation(async ({ input, ctx }) => {
      try { await consumeCredits(ctx.user.id, "security_scan", `Security scan: ${input.url}`); } catch { /* ignore */ }
      return runPassiveWebScan(input.url);
    }),

  /**
   * Run a TCP port scan with banner grabbing and OS detection hints
   */
  portScan: protectedProcedure
    .input(z.object({
      host: z.string().min(1),
      ports: z.array(z.number().int().min(1).max(65535)).optional(),
      concurrency: z.number().int().min(1).max(200).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      try { await consumeCredits(ctx.user.id, "security_scan", `Port scan: ${input.host}`); } catch { /* ignore */ }
      return runPortScan(input.host, input.ports, input.concurrency);
    }),

  /**
   * Deep SSL/TLS inspection — protocol, cipher, cert chain, key size, expiry
   */
  sslCheck: protectedProcedure
    .input(z.object({ domain: z.string().min(1) }))
    .mutation(async ({ input }) => {
      return checkSSL(input.domain);
    }),

  /**
   * Analyze code for security vulnerabilities — OWASP Top 10, CWE, CVSS
   */
  codeReview: protectedProcedure
    .input(
      z.object({
        code: z.string().min(1),
        language: z.string().optional(),
        filename: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try { await consumeCredits(ctx.user.id, "security_scan", "Code security review"); } catch { /* ignore */ }
      return analyzeCodeSecurity([{ filename: input.filename || "code.txt", content: input.code }]);
    }),

  /**
   * Multi-file code security review with OWASP Top 10, CWE, CVSS scoring
   */
  codeReviewMulti: protectedProcedure
    .input(
      z.object({
        files: z.array(z.object({ filename: z.string(), content: z.string() })).min(1).max(20),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try { await consumeCredits(ctx.user.id, "security_scan", `Code review: ${input.files.length} files`); } catch { /* ignore */ }
      return analyzeCodeSecurity(input.files);
    }),

  /**
   * DNS security audit — SPF, DMARC, DKIM, DNSSEC, CAA records
   */
  dnsAudit: protectedProcedure
    .input(z.object({ domain: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      try { await consumeCredits(ctx.user.id, "security_scan", `DNS audit: ${input.domain}`); } catch { /* ignore */ }
      return auditDNSSecurity(input.domain);
    }),

  /**
   * Technology fingerprinting — CMS, framework, WAF, analytics detection
   */
  fingerprint: protectedProcedure
    .input(z.object({ url: z.string().url() }))
    .mutation(async ({ input, ctx }) => {
      try { await consumeCredits(ctx.user.id, "security_scan", `Fingerprint: ${input.url}`); } catch { /* ignore */ }
      return fingerprintTarget(input.url);
    }),

  /**
   * HTTP header analysis — full OWASP header checklist with scoring
   */
  headerAnalysis: protectedProcedure
    .input(z.object({ url: z.string().url() }))
    .mutation(async ({ input, ctx }) => {
      try { await consumeCredits(ctx.user.id, "security_scan", `Header analysis: ${input.url}`); } catch { /* ignore */ }
      return analyzeHeaders(input.url);
    }),

  /**
   * Full security report — combines web scan + SSL + DNS + port scan into one markdown report
   */
  fullSecurityReport: protectedProcedure
    .input(z.object({
      target: z.string().min(1),
      includePorts: z.boolean().optional().default(false),
      includeDns: z.boolean().optional().default(true),
      includeSsl: z.boolean().optional().default(true),
    }))
    .mutation(async ({ input, ctx }) => {
      try { await consumeCredits(ctx.user.id, "security_scan", `Full report: ${input.target}`); } catch { /* ignore */ }
      const host = input.target.replace(/^https?:\/\//, "").split("/")[0].split(":")[0];
      const url = input.target.startsWith("http") ? input.target : `https://${input.target}`;
      const [scanResult, sslResult, dnsResult, portScanResult] = await Promise.allSettled([
        runPassiveWebScan(url),
        input.includeSsl ? checkSSL(host) : Promise.resolve(undefined),
        input.includeDns ? auditDNSSecurity(host) : Promise.resolve(undefined),
        input.includePorts ? runPortScan(host) : Promise.resolve(undefined),
      ]);
      const report = generateSecurityReport({
        target: input.target,
        scanResult: scanResult.status === "fulfilled" ? scanResult.value : undefined,
        sslResult: sslResult.status === "fulfilled" ? sslResult.value ?? undefined : undefined,
        dnsResult: dnsResult.status === "fulfilled" ? dnsResult.value ?? undefined : undefined,
        portScanResult: portScanResult.status === "fulfilled" ? portScanResult.value ?? undefined : undefined,
      });
      return {
        report,
        scanResult: scanResult.status === "fulfilled" ? scanResult.value : null,
        sslResult: sslResult.status === "fulfilled" ? sslResult.value : null,
        dnsResult: dnsResult.status === "fulfilled" ? dnsResult.value : null,
        portScanResult: portScanResult.status === "fulfilled" ? portScanResult.value : null,
      };
    }),

  // ── Auto-Fix Endpoints ──────────────────────────────────────────

  /**
   * Fix a single vulnerability in code
   */
  fixVulnerability: protectedProcedure
    .input(
      z.object({
        filename: z.string(),
        code: z.string(),
        issue: z.object({
          title: z.string(),
          severity: z.enum(["critical", "high", "medium", "low"]),
          category: z.enum(["security", "performance", "best-practices", "maintainability"]),
          description: z.string(),
          suggestion: z.string(),
          recommendation: z.string().optional(),
          file: z.string(),
          line: z.number().optional(),
        }),
      })
    )
    .mutation(async ({ input }) => {
      const fix = await fixSingleVulnerability({
        code: input.code,
        filename: input.filename,
        issue: { ...input.issue, recommendation: input.issue.recommendation ?? input.issue.suggestion },
      });
      return fix;
    }),

  /**
   * Fix all vulnerabilities in a batch
   */
  fixAllVulnerabilities: protectedProcedure
    .input(
      z.object({
        files: z.array(
          z.object({
            filename: z.string(),
            content: z.string(),
          })
        ),
        issues: z.array(
          z.object({
            title: z.string(),
            severity: z.enum(["critical", "high", "medium", "low"]),
            category: z.enum(["security", "performance", "best-practices", "maintainability"]),
            description: z.string(),
            suggestion: z.string(),
            recommendation: z.string().optional(),
            file: z.string(),
            line: z.number().optional(),
          })
        ),
      })
    )
    .mutation(async ({ input }) => {
      const normalizedIssues = input.issues.map(i => ({ ...i, recommendation: i.recommendation ?? i.suggestion }));
      const result = await fixAllVulnerabilities({
        files: input.files,
        report: {
          overallScore: 0,
          score: 0,
          grade: 'F',
          totalFiles: input.files.length,
          totalLines: 0,
          owaspCoverage: [],
          issues: normalizedIssues,
          summary: `Batch fix for ${input.issues.length} vulnerabilities`,
          strengths: [],
          recommendations: [],
        },
      });
      const report = generateFixReport(result);
      return { ...result, report };
    }),

  // ── Project Files (from Builder create_file) ─────────────────────

  /**
   * List all project files created by the builder for this user.
   * Reads from the sandboxFiles database table (S3-backed).
   */
  projectFiles: protectedProcedure
    .input(z.object({ conversationId: z.number().int().optional() }).optional())
    .query(async ({ ctx }) => {
      const { getDb } = await import("./db");
      const { sandboxFiles } = await import("../drizzle/schema");
      const { eq, and, desc } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) return { files: [], projects: [] };

      // Get user's sandbox
      const sandboxes = await listSandboxes(ctx.user.id);
      if (sandboxes.length === 0) return { files: [], projects: [] };
      const sbId = sandboxes[0].id;

      // Get all files from the database
      const allFiles = await db
        .select()
        .from(sandboxFiles)
        .where(and(eq(sandboxFiles.sandboxId, sbId), eq(sandboxFiles.isDirectory, 0)))
        .orderBy(desc(sandboxFiles.createdAt));

      // Group files by their top-level directory (project)
      const projectMap = new Map<string, typeof allFiles>();
      for (const file of allFiles) {
        const parts = file.filePath.split("/");
        const projectName = parts.length > 1 ? parts[0] : "general";
        if (!projectMap.has(projectName)) projectMap.set(projectName, []);
        projectMap.get(projectName)!.push(file);
      }

      const projects = Array.from(projectMap.entries()).map(([name, files]) => ({
        name,
        fileCount: files.length,
        totalSize: files.reduce((sum, f) => sum + (f.fileSize || 0), 0),
        lastModified: files[0]?.createdAt || null,
      }));

      return {
        files: allFiles.map(f => ({
          id: f.id,
          path: f.filePath,
          name: f.filePath.split("/").pop() || f.filePath,
          size: f.fileSize || 0,
          s3Key: f.s3Key,
          hasContent: !!f.content,
          createdAt: f.createdAt,
        })),
        projects,
      };
    }),

  /**
   * Read a project file's content from the database or S3.
   */
  projectFileContent: protectedProcedure
    .input(z.object({ fileId: z.number().int() }))
    .query(async ({ ctx, input }) => {
      const { getDb } = await import("./db");
      const { sandboxFiles } = await import("../drizzle/schema");
      const { eq, and } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) return { content: null, error: "Database unavailable" };

      const sandboxes = await listSandboxes(ctx.user.id);
      if (sandboxes.length === 0) return { content: null, error: "No sandbox found" };

      const [file] = await db
        .select()
        .from(sandboxFiles)
        .where(and(eq(sandboxFiles.id, input.fileId), eq(sandboxFiles.sandboxId, sandboxes[0].id)))
        .limit(1);

      if (!file) return { content: null, error: "File not found" };

      // Return content from database if available
      if (file.content) {
        return { content: file.content, path: file.filePath };
      }

      // Otherwise fetch from S3
      if (file.s3Key) {
        try {
          const { storageGet } = await import("./storage");
          const { url } = await storageGet(file.s3Key);
          const res = await fetch(url);
          if (res.ok) {
            const content = await res.text();
            return { content, path: file.filePath };
          }
        } catch { /* ignore */ }
      }

      return { content: null, error: "Content unavailable" };
    }),

  // ── Get a signed download URL for a single project file ──
  projectFileDownloadUrl: protectedProcedure
    .input(z.object({ fileId: z.number().int() }))
    .query(async ({ ctx, input }) => {
      const { getDb } = await import("./db");
      const { sandboxFiles } = await import("../drizzle/schema");
      const { eq, and } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) return { url: null, error: "Database unavailable" };
      const sandboxes = await listSandboxes(ctx.user.id);
      if (sandboxes.length === 0) return { url: null, error: "No sandbox found" };
      const [file] = await db
        .select()
        .from(sandboxFiles)
        .where(and(eq(sandboxFiles.id, input.fileId), eq(sandboxFiles.sandboxId, sandboxes[0].id)))
        .limit(1);
      if (!file) return { url: null, error: "File not found" };
      if (file.s3Key) {
        try {
          const { storageGet } = await import("./storage");
          const { url } = await storageGet(file.s3Key);
          return { url, fileName: file.filePath.split("/").pop() || "file" };
        } catch { /* ignore */ }
      }
      return { url: null, error: "No download available" };
    }),

  // ── Delete a single project file ──
  deleteProjectFile: protectedProcedure
    .input(z.object({ fileId: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const { getDb } = await import("./db");
        const { sandboxFiles } = await import("../drizzle/schema");
        const { eq, and } = await import("drizzle-orm");
        const db = await getDb();
        if (!db) return { success: false, error: "Database unavailable" };
        const sandboxes = await listSandboxes(ctx.user.id);
        if (sandboxes.length === 0) return { success: false, error: "No sandbox found" };
        const [file] = await db
          .select()
          .from(sandboxFiles)
          .where(and(eq(sandboxFiles.id, input.fileId), eq(sandboxFiles.sandboxId, sandboxes[0].id)))
          .limit(1);
        if (!file) return { success: false, error: "File not found" };
        // Delete from S3 if applicable
        if (file.s3Key) {
          try {
            const { storageDelete } = await import("./storage");
            await storageDelete(file.s3Key);
          } catch { /* ignore */ }
        }
        await db.delete(sandboxFiles).where(eq(sandboxFiles.id, input.fileId));
        return { success: true };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return { success: false, error: msg };
      }
    }),

  // ── Delete an entire project (all files with matching path prefix) ──
  deleteProject: protectedProcedure
    .input(z.object({ projectName: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      try {
        const { getDb } = await import("./db");
        const { sandboxFiles } = await import("../drizzle/schema");
        const { eq, and, like, notLike, inArray } = await import("drizzle-orm");
        const db = await getDb();
        if (!db) return { success: false, deleted: 0, error: "Database unavailable" };
        const sandboxes = await listSandboxes(ctx.user.id);
        if (sandboxes.length === 0) return { success: false, deleted: 0, error: "No sandbox found — please create a project first" };

        let allFiles: any[] = [];

        if (input.projectName === "Ungrouped" || input.projectName === "general") {
          // "Ungrouped" / "general" = files without a directory prefix (no "/" in path)
          allFiles = await db
            .select()
            .from(sandboxFiles)
            .where(and(
              eq(sandboxFiles.sandboxId, sandboxes[0].id),
              notLike(sandboxFiles.filePath, "%/%")
            ));
        } else {
          // Find all files belonging to this project (path starts with projectName/)
          const files = await db
            .select()
            .from(sandboxFiles)
            .where(and(
              eq(sandboxFiles.sandboxId, sandboxes[0].id),
              like(sandboxFiles.filePath, `${input.projectName}/%`)
            ));
          // Also include files with exact match (no subdirectory)
          const exactFiles = await db
            .select()
            .from(sandboxFiles)
            .where(and(
              eq(sandboxFiles.sandboxId, sandboxes[0].id),
              eq(sandboxFiles.filePath, input.projectName)
            ));
          // Also try matching by projectName column
          const byProjectName = await db
            .select()
            .from(sandboxFiles)
            .where(and(
              eq(sandboxFiles.sandboxId, sandboxes[0].id),
              eq(sandboxFiles.projectName, input.projectName)
            ));
          // Deduplicate by ID
          const idSet = new Set<number>();
          allFiles = [...files, ...exactFiles, ...byProjectName].filter(f => {
            if (idSet.has(f.id)) return false;
            idSet.add(f.id);
            return true;
          });
        }

        if (allFiles.length === 0) return { success: false, deleted: 0, error: `No files found for project "${input.projectName}"` };
        // Delete S3 objects (best-effort, don't block on failure)
        for (const file of allFiles) {
          if (file.s3Key) {
            try {
              const { storageDelete } = await import("./storage");
              await storageDelete(file.s3Key);
            } catch { /* ignore */ }
          }
        }
        // Delete from DB
        await db.delete(sandboxFiles).where(
          inArray(sandboxFiles.id, allFiles.map(f => f.id))
        );
        return { success: true, deleted: allFiles.length };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return { success: false, deleted: 0, error: msg };
      }
    }),

  // ── Delete multiple project files ──
  deleteProjectFiles: protectedProcedure
    .input(z.object({ fileIds: z.array(z.number().int()) }))
    .mutation(async ({ ctx, input }) => {
      try {
        const { getDb } = await import("./db");
        const { sandboxFiles } = await import("../drizzle/schema");
        const { eq, and, inArray } = await import("drizzle-orm");
        const db = await getDb();
        if (!db) return { success: false, deleted: 0, error: "Database unavailable" };
        const sandboxes = await listSandboxes(ctx.user.id);
        if (sandboxes.length === 0) return { success: false, deleted: 0, error: "No sandbox found" };
        // Get files to delete S3 objects
        const files = await db
          .select()
          .from(sandboxFiles)
          .where(and(
            inArray(sandboxFiles.id, input.fileIds),
            eq(sandboxFiles.sandboxId, sandboxes[0].id)
          ));
        if (files.length === 0) return { success: false, deleted: 0, error: "No matching files found" };
        // Delete S3 objects (best-effort)
        for (const file of files) {
          if (file.s3Key) {
            try {
              const { storageDelete } = await import("./storage");
              await storageDelete(file.s3Key);
            } catch { /* ignore */ }
          }
        }
        // Delete from DB
        await db.delete(sandboxFiles).where(
          inArray(sandboxFiles.id, files.map(f => f.id))
        );
        return { success: true, deleted: files.length };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return { success: false, deleted: 0, error: msg };
      }
    }),

  // ── Developer Tools — Advanced File & Workspace Operations ──────────

  /**
   * Restore a sandbox workspace from S3 (e.g. after server restart or migration)
   */
  restoreWorkspace: protectedProcedure
    .input(z.object({ sandboxId: z.number().int() }))
    .mutation(async ({ input, ctx }) => {
      const success = await restoreWorkspace(input.sandboxId, ctx.user.id);
      if (!success) throw new Error("Failed to restore workspace — no saved snapshot found");
      return { success: true };
    }),

  /**
   * Write a binary file to the sandbox (base64-encoded content)
   * Useful for uploading images, archives, compiled binaries, etc.
   */
  writeBinaryFile: protectedProcedure
    .input(z.object({
      sandboxId: z.number().int(),
      path: z.string().min(1),
      base64Content: z.string().min(1),
    }))
    .mutation(async ({ input, ctx }) => {
      const buffer = Buffer.from(input.base64Content, "base64");
      const success = await writeBinaryFile(input.sandboxId, ctx.user.id, input.path, buffer);
      if (!success) throw new Error("Failed to write binary file");
      return { success: true, sizeBytes: buffer.length };
    }),

  /**
   * Move or rename a file/directory within the sandbox
   */
  moveFile: protectedProcedure
    .input(z.object({
      sandboxId: z.number().int(),
      fromPath: z.string().min(1),
      toPath: z.string().min(1),
    }))
    .mutation(async ({ input, ctx }) => {
      const result = await executeCommand(
        input.sandboxId,
        ctx.user.id,
        `mv "${input.fromPath}" "${input.toPath}"`,
        { triggeredBy: "user" }
      );
      return { success: result.exitCode === 0, output: result.output };
    }),

  /**
   * Copy a file or directory within the sandbox
   */
  copyFile: protectedProcedure
    .input(z.object({
      sandboxId: z.number().int(),
      fromPath: z.string().min(1),
      toPath: z.string().min(1),
    }))
    .mutation(async ({ input, ctx }) => {
      const result = await executeCommand(
        input.sandboxId,
        ctx.user.id,
        `cp -r "${input.fromPath}" "${input.toPath}"`,
        { triggeredBy: "user" }
      );
      return { success: result.exitCode === 0, output: result.output };
    }),

  /**
   * Diff two files in the sandbox — returns unified diff output
   */
  diffFiles: protectedProcedure
    .input(z.object({
      sandboxId: z.number().int(),
      pathA: z.string().min(1),
      pathB: z.string().min(1),
      contextLines: z.number().int().min(0).max(20).optional().default(3),
    }))
    .query(async ({ input, ctx }) => {
      const result = await executeCommand(
        input.sandboxId,
        ctx.user.id,
        `diff -u${input.contextLines} "${input.pathA}" "${input.pathB}" || true`,
        { triggeredBy: "user" }
      );
      return { diff: result.output, identical: result.output.trim() === "" };
    }),

  /**
   * Search for text inside files in the sandbox (grep)
   */
  searchFiles: protectedProcedure
    .input(z.object({
      sandboxId: z.number().int(),
      pattern: z.string().min(1).max(500),
      directory: z.string().optional().default("/home/sandbox"),
      caseSensitive: z.boolean().optional().default(false),
      includeGlob: z.string().optional(),
      maxResults: z.number().int().min(1).max(500).optional().default(100),
    }))
    .query(async ({ input, ctx }) => {
      const flags = input.caseSensitive ? "" : "-i";
      const include = input.includeGlob ? `--include="${input.includeGlob}"` : "";
      const cmd = `grep -rn ${flags} ${include} --max-count=1 -l "${input.pattern.replace(/"/g, '\\"')}" "${input.directory}" 2>/dev/null | head -${input.maxResults} || true`;
      const listResult = await executeCommand(input.sandboxId, ctx.user.id, cmd, { triggeredBy: "user" });
      const files = listResult.output.trim().split("\n").filter(Boolean);
      // Get line-level matches for each file (up to 20 files)
      const matches: Array<{ file: string; line: number; text: string }> = [];
      for (const file of files.slice(0, 20)) {
        const grepCmd = `grep -n ${flags} "${input.pattern.replace(/"/g, '\\"')}" "${file}" 2>/dev/null | head -20 || true`;
        const grepResult = await executeCommand(input.sandboxId, ctx.user.id, grepCmd, { triggeredBy: "user" });
        for (const line of grepResult.output.trim().split("\n").filter(Boolean)) {
          const colonIdx = line.indexOf(":");
          if (colonIdx > 0) {
            const lineNum = parseInt(line.slice(0, colonIdx), 10);
            const text = line.slice(colonIdx + 1);
            if (!isNaN(lineNum)) matches.push({ file, line: lineNum, text });
          }
        }
      }
      return { files, matches, totalFiles: files.length };
    }),

  /**
   * Get disk usage stats for the sandbox workspace
   */
  diskUsage: protectedProcedure
    .input(z.object({ sandboxId: z.number().int() }))
    .query(async ({ input, ctx }) => {
      const result = await executeCommand(
        input.sandboxId,
        ctx.user.id,
        `du -sh /home/sandbox 2>/dev/null && df -h /tmp 2>/dev/null | tail -1 || true`,
        { triggeredBy: "user" }
      );
      return { output: result.output };
    }),

  /**
   * Run a quick lint/syntax check on a file using the appropriate tool
   * Supports: .ts/.tsx (tsc --noEmit), .js/.jsx (node --check), .py (python3 -m py_compile),
   *           .json (python3 -m json.tool), .sh (bash -n)
   */
  lintFile: protectedProcedure
    .input(z.object({
      sandboxId: z.number().int(),
      path: z.string().min(1),
    }))
    .mutation(async ({ input, ctx }) => {
      const ext = input.path.split(".").pop()?.toLowerCase() ?? "";
      let cmd: string;
      if (ext === "ts" || ext === "tsx") {
        cmd = `cd /home/sandbox && npx tsc --noEmit --allowJs --checkJs false --skipLibCheck 2>&1 || true`;
      } else if (ext === "js" || ext === "jsx" || ext === "mjs") {
        cmd = `node --check "${input.path}" 2>&1 || true`;
      } else if (ext === "py") {
        cmd = `python3 -m py_compile "${input.path}" 2>&1 && echo "OK" || true`;
      } else if (ext === "json") {
        cmd = `python3 -m json.tool "${input.path}" > /dev/null 2>&1 && echo "Valid JSON" || echo "Invalid JSON"` ;
      } else if (ext === "sh" || ext === "bash") {
        cmd = `bash -n "${input.path}" 2>&1 && echo "OK" || true`;
      } else {
        cmd = `echo "No linter available for .${ext} files"`;
      }
      const result = await executeCommand(input.sandboxId, ctx.user.id, cmd, { triggeredBy: "user" });
      const passed = result.exitCode === 0 && !result.output.toLowerCase().includes("error");
      return { passed, output: result.output, exitCode: result.exitCode };
    }),

  /**
   * Format a file using prettier (if available) or black (for Python)
   */
  formatFile: protectedProcedure
    .input(z.object({
      sandboxId: z.number().int(),
      path: z.string().min(1),
    }))
    .mutation(async ({ input, ctx }) => {
      const ext = input.path.split(".").pop()?.toLowerCase() ?? "";
      let cmd: string;
      if (["ts", "tsx", "js", "jsx", "json", "css", "html", "md"].includes(ext)) {
        cmd = `cd /home/sandbox && (npx prettier --write "${input.path}" 2>&1 || echo "prettier not available")`;
      } else if (ext === "py") {
        cmd = `(black "${input.path}" 2>&1 || python3 -m black "${input.path}" 2>&1 || echo "black not available")`;
      } else {
        cmd = `echo "No formatter available for .${ext} files"`;
      }
      const result = await executeCommand(input.sandboxId, ctx.user.id, cmd, { triggeredBy: "user" });
      return { success: result.exitCode === 0, output: result.output };
    }),

  /**
   * Run project tests (npm test / pytest / go test)
   * Auto-detects test runner from project files
   */
  runTests: protectedProcedure
    .input(z.object({
      sandboxId: z.number().int(),
      workingDirectory: z.string().optional().default("/home/sandbox"),
      testCommand: z.string().optional(), // override auto-detection
      timeoutMs: z.number().int().min(5000).max(300_000).optional().default(120_000),
    }))
    .mutation(async ({ input, ctx }) => {
      try { await consumeCredits(ctx.user.id, "sandbox_run", "Run tests"); } catch { /* ignore */ }
      let cmd = input.testCommand;
      if (!cmd) {
        // Auto-detect test runner
        const detectCmd = `cd "${input.workingDirectory}" && \
          if [ -f package.json ] && grep -q '"test"' package.json; then echo "npm"; \
          elif [ -f pytest.ini ] || [ -f setup.py ] || [ -f pyproject.toml ]; then echo "pytest"; \
          elif [ -f go.mod ]; then echo "go"; \
          else echo "none"; fi`;
        const detect = await executeCommand(input.sandboxId, ctx.user.id, detectCmd, { triggeredBy: "user" });
        const runner = detect.output.trim();
        if (runner === "npm") cmd = `cd "${input.workingDirectory}" && npm test -- --watchAll=false 2>&1`;
        else if (runner === "pytest") cmd = `cd "${input.workingDirectory}" && python3 -m pytest -v 2>&1`;
        else if (runner === "go") cmd = `cd "${input.workingDirectory}" && go test ./... 2>&1`;
        else cmd = `echo "No test runner detected. Add a test script to package.json or install pytest."`;
      }
      const result = await executeCommand(input.sandboxId, ctx.user.id, cmd, {
        triggeredBy: "user",
        timeoutMs: input.timeoutMs,
      });
      const passed = result.exitCode === 0;
      return { passed, output: result.output, exitCode: result.exitCode, durationMs: result.durationMs };
    }),

  /**
   * Git operations — init, status, add, commit, push, pull, log, branch, diff
   * All operations run inside the sandbox workspace
   */
  git: protectedProcedure
    .input(z.object({
      sandboxId: z.number().int(),
      operation: z.enum(["init", "status", "add", "commit", "push", "pull", "log", "branch", "diff", "clone", "stash", "fetch", "checkout", "merge", "reset"]),
      args: z.string().optional().default(""),
      workingDirectory: z.string().optional().default("/home/sandbox"),
      commitMessage: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      let cmd: string;
      const wd = input.workingDirectory;
      switch (input.operation) {
        case "init": cmd = `cd "${wd}" && git init ${input.args}`; break;
        case "status": cmd = `cd "${wd}" && git status ${input.args}`; break;
        case "add": cmd = `cd "${wd}" && git add ${input.args || "."}` ; break;
        case "commit": cmd = `cd "${wd}" && git commit -m "${(input.commitMessage || input.args || "Update").replace(/"/g, "'")}"`; break;
        case "push": cmd = `cd "${wd}" && git push ${input.args}`; break;
        case "pull": cmd = `cd "${wd}" && git pull ${input.args}`; break;
        case "log": cmd = `cd "${wd}" && git log --oneline -20 ${input.args}`; break;
        case "branch": cmd = `cd "${wd}" && git branch ${input.args}`; break;
        case "diff": cmd = `cd "${wd}" && git diff ${input.args}`; break;
        case "clone": cmd = `cd "${wd}" && git clone ${input.args}`; break;
        case "stash": cmd = `cd "${wd}" && git stash ${input.args}`; break;
        case "fetch": cmd = `cd "${wd}" && git fetch ${input.args}`; break;
        case "checkout": cmd = `cd "${wd}" && git checkout ${input.args}`; break;
        case "merge": cmd = `cd "${wd}" && git merge ${input.args}`; break;
        case "reset": cmd = `cd "${wd}" && git reset ${input.args}`; break;
        default: cmd = `echo "Unknown git operation"`;
      }
      const result = await executeCommand(input.sandboxId, ctx.user.id, cmd, {
        triggeredBy: "user",
        timeoutMs: 60_000,
      });
      return { success: result.exitCode === 0, output: result.output, exitCode: result.exitCode };
    }),

  /**
   * Get process list running in the sandbox
   */
  getProcesses: protectedProcedure
    .input(z.object({ sandboxId: z.number().int() }))
    .query(async ({ input, ctx }) => {
      const result = await executeCommand(
        input.sandboxId,
        ctx.user.id,
        `ps aux --no-headers 2>/dev/null | head -50 || true`,
        { triggeredBy: "user" }
      );
      const processes = result.output.trim().split("\n").filter(Boolean).map(line => {
        const parts = line.trim().split(/\s+/);
        return {
          pid: parts[1] || "",
          cpu: parts[2] || "0",
          mem: parts[3] || "0",
          command: parts.slice(10).join(" ") || parts[10] || "",
        };
      });
      return { processes };
    }),

  /**
   * Kill a process in the sandbox by PID
   */
  killProcess: protectedProcedure
    .input(z.object({
      sandboxId: z.number().int(),
      pid: z.number().int().min(1),
      signal: z.enum(["SIGTERM", "SIGKILL", "SIGHUP"]).optional().default("SIGTERM"),
    }))
    .mutation(async ({ input, ctx }) => {
      const sig = input.signal === "SIGKILL" ? "-9" : input.signal === "SIGHUP" ? "-1" : "-15";
      const result = await executeCommand(
        input.sandboxId,
        ctx.user.id,
        `kill ${sig} ${input.pid} 2>&1 || true`,
        { triggeredBy: "user" }
      );
      return { success: result.exitCode === 0, output: result.output };
    }),

  // ── Delete ALL project files for the current user ──
  deleteAllProjects: protectedProcedure
    .mutation(async ({ ctx }) => {
      try {
        const { getDb } = await import("./db");
        const { sandboxFiles } = await import("../drizzle/schema");
        const { eq, inArray } = await import("drizzle-orm");
        const db = await getDb();
        if (!db) return { success: false, deleted: 0, error: "Database unavailable" };
        const sandboxes = await listSandboxes(ctx.user.id);
        if (sandboxes.length === 0) return { success: false, deleted: 0, error: "No sandbox found" };

        let totalDeleted = 0;
        // Delete files from ALL sandboxes belonging to this user
        for (const sb of sandboxes) {
          const allFiles = await db
            .select()
            .from(sandboxFiles)
            .where(eq(sandboxFiles.sandboxId, sb.id));
          if (allFiles.length === 0) continue;
          // Delete S3 objects (best-effort)
          for (const file of allFiles) {
            if (file.s3Key) {
              try {
                const { storageDelete } = await import("./storage");
                await storageDelete(file.s3Key);
              } catch { /* ignore */ }
            }
          }
          // Delete from DB
          await db.delete(sandboxFiles).where(
            inArray(sandboxFiles.id, allFiles.map(f => f.id))
          );
          totalDeleted += allFiles.length;
        }
        return { success: true, deleted: totalDeleted };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return { success: false, deleted: 0, error: msg };
      }
    }),
});
