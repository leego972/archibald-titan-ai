/**
 * Auto-Fix Engine v3.0 (MAXIMUM)
 *
 * LLM-powered vulnerability auto-fixer that takes code + vulnerability report
 * and generates patched code with diffs, explanations, and confidence scores.
 *
 * Supports:
 * - Single vulnerability fixes
 * - Batch fix (all vulnerabilities in one pass)
 * - Diff generation (before/after with highlighted changes)
 * - Confidence scoring per fix
 * - Explanation of what was changed and why
 */

import OpenAI from "openai";
const _openai = new OpenAI();
import type { CodeReviewIssue, CodeReviewReport } from "./security-tools";
import { getErrorMessage } from "./_core/errors.js";

// ─── Types ──────────────────────────────────────────────────────────

export type VulnerabilityFix = {
  issueTitle: string;
  severity: string;
  category: string;
  file: string;
  line?: number | null;
  originalCode: string;
  fixedCode: string;
  explanation: string;
  diffSummary: string;
  confidence: number; // 0-100
  breakingChange: boolean;
  testSuggestion: string;
};

export type AutoFixResult = {
  totalIssues: number;
  fixedCount: number;
  skippedCount: number;
  fixes: VulnerabilityFix[];
  skipped: Array<{ title: string; reason: string }>;
  overallSummary: string;
};

export type SingleFixInput = {
  code: string;
  filename: string;
  issue: CodeReviewIssue;
};

export type BatchFixInput = {
  files: Array<{ filename: string; content: string }>;
  report: CodeReviewReport;
};

// ─── Single Vulnerability Fix ───────────────────────────────────────

export async function fixSingleVulnerability(
  input: SingleFixInput
): Promise<VulnerabilityFix> {
  const { code, filename, issue } = input;
  const cweRef = (issue as any).cwe ? `\n**CWE:** ${(issue as any).cwe}` : "";
  const cvssRef = (issue as any).cvss ? `\n**CVSS 3.1:** ${(issue as any).cvss}` : "";
  const owaspRef = (issue as any).owaspCategory ? `\n**OWASP:** ${(issue as any).owaspCategory}` : "";
  const fixHint = issue.recommendation || (issue as any).suggestion || "";

  const response = await _openai.chat.completions.create({
    model: "gpt-4.1-mini",
    messages: [
      {
        role: "system",
        content: `You are a world-class application security engineer specializing in secure code remediation. Produce production-ready, minimal, correct fixes for specific security vulnerabilities.\n\nRules:\n- Fix ONLY the specific vulnerability described — do not refactor or change unrelated code\n- Preserve the original code structure, formatting, variable names, and style exactly\n- If the fix requires adding imports or helper functions, include them\n- Apply defense-in-depth: fix the root cause, not just the symptom\n- If the fix could break existing functionality, set breakingChange to true\n- Provide a precise technical explanation citing exact lines changed and why\n- Suggest a specific runnable test (unit test or curl command) to verify the fix\n- Rate confidence 0-100: 100 = certain the fix is correct, complete, and won't break anything\n- For SQL injection: always use parameterized queries, never string concatenation\n- For XSS: escape output, use textContent not innerHTML, implement nonces\n- For command injection: use argument arrays, never shell string interpolation\n- For hardcoded secrets: replace with environment variable lookups\n- For broken auth: implement proper JWT validation with algorithm pinning\n- For SSRF: implement allowlist-based URL validation with DNS rebinding protection\n- For path traversal: use path.resolve() and validate against allowed base directory\n- For prototype pollution: use Object.create(null) or freeze prototypes\nReturn JSON only.`,
      },
      {
        role: "user",
        content: `Fix this vulnerability:\n\n**File:** ${filename}\n**Vulnerability:** [${issue.severity.toUpperCase()}] ${issue.title}${cweRef}${cvssRef}${owaspRef}\n**Description:** ${issue.description}\n**Recommendation:** ${fixHint}\n${issue.line ? `**Line:** ${issue.line}` : ""}\n\n**Code:**\n\`\`\`\n${code.slice(0, 12000)}\n\`\`\`\n\nReturn JSON: {"fixedCode":"...","explanation":"...","diffSummary":"...","confidence":0-100,"breakingChange":true|false,"testSuggestion":"..."}`,
      },
    ],
    response_format: { type: "json_object" },
    temperature: 0.05,
    max_tokens: 8000,
  });

  const rawContent = response.choices[0]?.message?.content;
  const content = typeof rawContent === "string" ? rawContent : null;

  if (!content) {
    return {
      issueTitle: issue.title,
      severity: issue.severity,
      category: (issue as any).category || "security",
      file: filename,
      line: issue.line ?? null,
      originalCode: code,
      fixedCode: code,
      explanation: "Auto-fix failed — LLM returned no response.",
      diffSummary: "No changes made.",
      confidence: 0,
      breakingChange: false,
      testSuggestion: "Manual review required.",
    };
  }

  try {
    const parsed = JSON.parse(content);
    return {
      issueTitle: issue.title,
      severity: issue.severity,
      category: (issue as any).category || "security",
      file: filename,
      line: issue.line ?? null,
      originalCode: code,
      fixedCode: parsed.fixedCode || code,
      explanation: parsed.explanation || "No explanation provided.",
      diffSummary: parsed.diffSummary || "No diff summary.",
      confidence: Math.min(100, Math.max(0, parsed.confidence || 0)),
      breakingChange: Boolean(parsed.breakingChange),
      testSuggestion: parsed.testSuggestion || "No test suggestion.",
    };
  } catch {
    return {
      issueTitle: issue.title,
      severity: issue.severity,
      category: (issue as any).category || "security",
      file: filename,
      line: issue.line ?? null,
      originalCode: code,
      fixedCode: code,
      explanation: "Auto-fix failed — could not parse LLM response.",
      diffSummary: "No changes made.",
      confidence: 0,
      breakingChange: false,
      testSuggestion: "Manual review required.",
    };
  }
}

// ─── Batch Fix (All Vulnerabilities) ────────────────────────────────

export async function fixAllVulnerabilities(
  input: BatchFixInput
): Promise<AutoFixResult> {
  const { files, report } = input;

  if (!report.issues || report.issues.length === 0) {
    return {
      totalIssues: 0,
      fixedCount: 0,
      skippedCount: 0,
      fixes: [],
      skipped: [],
      overallSummary: "No vulnerabilities found to fix.",
    };
  }

  // Build a map of filename -> content for quick lookup
  const fileMap = new Map<string, string>();
  for (const f of files) {
    fileMap.set(f.filename, f.content);
  }

  const fixes: VulnerabilityFix[] = [];
  const skipped: Array<{ title: string; reason: string }> = [];

  // Sort issues by severity: critical first, then high, medium, low
  const severityOrder: Record<string, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
  };

  const sortedIssues = [...report.issues].sort(
    (a, b) => (severityOrder[a.severity] ?? 4) - (severityOrder[b.severity] ?? 4)
  );

  // Track which files have been modified so we apply fixes cumulatively
  const modifiedFiles = new Map<string, string>();

  for (const issue of sortedIssues) {
    const currentCode = modifiedFiles.get(issue.file) ?? fileMap.get(issue.file);

    if (!currentCode) {
      skipped.push({
        title: issue.title,
        reason: `File "${issue.file}" not found in provided files.`,
      });
      continue;
    }

    try {
      const fix = await fixSingleVulnerability({
        code: currentCode,
        filename: issue.file,
        issue,
      });

      if (fix.confidence > 0 && fix.fixedCode !== currentCode) {
        fixes.push(fix);
        // Update the file content for subsequent fixes
        modifiedFiles.set(issue.file, fix.fixedCode);
      } else {
        skipped.push({
          title: issue.title,
          reason: fix.confidence === 0
            ? "LLM could not generate a fix."
            : "Fix produced no code changes.",
        });
      }
    } catch (err: unknown) {
      skipped.push({
        title: issue.title,
        reason: `Error during fix: ${getErrorMessage(err) || "Unknown error"}`,
      });
    }
  }

  // Generate overall summary
  const criticalFixed = fixes.filter((f) => f.severity === "critical").length;
  const highFixed = fixes.filter((f) => f.severity === "high").length;
  const mediumFixed = fixes.filter((f) => f.severity === "medium").length;
  const lowFixed = fixes.filter((f) => f.severity === "low").length;
  const breakingCount = fixes.filter((f) => f.breakingChange).length;
  const avgConfidence = fixes.length > 0
    ? Math.round(fixes.reduce((sum, f) => sum + f.confidence, 0) / fixes.length)
    : 0;

  const summaryParts: string[] = [];
  summaryParts.push(`Fixed ${fixes.length} of ${sortedIssues.length} vulnerabilities.`);
  if (criticalFixed > 0) summaryParts.push(`${criticalFixed} critical fixes applied.`);
  if (highFixed > 0) summaryParts.push(`${highFixed} high-severity fixes applied.`);
  if (mediumFixed > 0) summaryParts.push(`${mediumFixed} medium-severity fixes applied.`);
  if (lowFixed > 0) summaryParts.push(`${lowFixed} low-severity fixes applied.`);
  if (breakingCount > 0) summaryParts.push(`⚠️ ${breakingCount} fix(es) may introduce breaking changes — review carefully.`);
  summaryParts.push(`Average confidence: ${avgConfidence}%.`);
  if (skipped.length > 0) summaryParts.push(`${skipped.length} issue(s) could not be auto-fixed.`);

  return {
    totalIssues: sortedIssues.length,
    fixedCount: fixes.length,
    skippedCount: skipped.length,
    fixes,
    skipped,
    overallSummary: summaryParts.join(" "),
  };
}

// ─── Generate Diff Report ───────────────────────────────────────────

export function generateFixReport(result: AutoFixResult): string {
  let report = `# Auto-Fix Vulnerability Report

**Total Issues:** ${result.totalIssues}
**Fixed:** ${result.fixedCount}
**Skipped:** ${result.skippedCount}

---

## Summary

${result.overallSummary}

---

## Fixes Applied

`;

  for (const [idx, fix] of result.fixes.entries()) {
    const badge =
      fix.severity === "critical"
        ? "🔴"
        : fix.severity === "high"
          ? "🟠"
          : fix.severity === "medium"
            ? "🟡"
            : "🟢";

    const confidenceBadge =
      fix.confidence >= 90
        ? "✅ High"
        : fix.confidence >= 70
          ? "🟡 Medium"
          : "⚠️ Low";

    report += `### ${idx + 1}. ${badge} [${fix.severity.toUpperCase()}] ${fix.issueTitle}

**File:** \`${fix.file}\`${fix.line ? ` (line ${fix.line})` : ""}
**Confidence:** ${confidenceBadge} (${fix.confidence}%)
**Breaking Change:** ${fix.breakingChange ? "⚠️ Yes — review carefully" : "No"}

**What was changed:**
${fix.explanation}

**Changes summary:**
${fix.diffSummary}

**Suggested test:**
${fix.testSuggestion}

---

`;
  }

  if (result.skipped.length > 0) {
    report += `## Skipped Issues

`;
    for (const skip of result.skipped) {
      report += `- **${skip.title}:** ${skip.reason}\n`;
    }
    report += "\n---\n\n";
  }

  report += `## Disclaimer

Auto-fixes are AI-generated and should be reviewed before applying to production code. Always run your test suite after applying fixes to verify no regressions were introduced.

---

*Generated by Archibald Titan Auto-Fix Engine — ${new Date().toISOString()}*
`;

  return report;
}
