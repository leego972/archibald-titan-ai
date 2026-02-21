/**
 * Builder Pipeline Tests
 *
 * Tests for the v5.2 builder enhancements:
 * - New builder tools (self_type_check, self_run_tests, self_multi_file_modify)
 * - Enhanced self_health_check with skip options
 * - Tool definitions and parameter schemas
 * - Engine function exports (runTypeCheck, runTests, runQuickHealthCheck)
 * - Admin gating for builder write tools
 * - Summary generation for builder actions
 *
 * NOTE: Tests that invoke runTests/runTypeCheck via the executor are EXCLUDED
 * because they spawn child vitest/tsc processes which can cause recursive
 * process spawning inside the test runner. Those functions are tested by
 * verifying their exports and return types only.
 */

import { describe, expect, it } from "vitest";
import { TITAN_TOOLS } from "./chat-tools";
import {
  validateModifications,
  getProtectedFiles,
  getAllowedDirectories,
  type ModificationRequest,
} from "./self-improvement-engine";

// ═══════════════════════════════════════════════════════════════════
// Builder Tool Definitions
// ═══════════════════════════════════════════════════════════════════

describe("Builder Tool Definitions", () => {
  const toolNames = TITAN_TOOLS.map((t) => t.function.name);

  it("should include all 3 new builder tools", () => {
    expect(toolNames).toContain("self_type_check");
    expect(toolNames).toContain("self_run_tests");
    expect(toolNames).toContain("self_multi_file_modify");
  });

  it("should have exactly 57 tools total", () => {
    expect(TITAN_TOOLS.length).toBe(57);
  });

  it("self_type_check should have no required parameters", () => {
    const tool = TITAN_TOOLS.find((t) => t.function.name === "self_type_check");
    expect(tool).toBeDefined();
    expect(tool!.function.parameters.required).toEqual([]);
  });

  it("self_run_tests should have optional testPattern parameter", () => {
    const tool = TITAN_TOOLS.find((t) => t.function.name === "self_run_tests");
    expect(tool).toBeDefined();
    expect(tool!.function.parameters.required).toEqual([]);
    expect(tool!.function.parameters.properties).toHaveProperty("testPattern");
    expect((tool!.function.parameters.properties as any).testPattern.type).toBe("string");
  });

  it("self_multi_file_modify should require modifications array", () => {
    const tool = TITAN_TOOLS.find((t) => t.function.name === "self_multi_file_modify");
    expect(tool).toBeDefined();
    expect(tool!.function.parameters.required).toContain("modifications");
    expect((tool!.function.parameters.properties as any).modifications.type).toBe("array");
  });

  it("self_health_check should have skipTests and skipTypeCheck parameters", () => {
    const tool = TITAN_TOOLS.find((t) => t.function.name === "self_health_check");
    expect(tool).toBeDefined();
    const props = tool!.function.parameters.properties as any;
    expect(props).toHaveProperty("skipTests");
    expect(props).toHaveProperty("skipTypeCheck");
    expect(props.skipTests.type).toBe("boolean");
    expect(props.skipTypeCheck.type).toBe("boolean");
  });

  it("all builder tools should have valid descriptions (>20 chars)", () => {
    const builderToolNames = ["self_type_check", "self_run_tests", "self_multi_file_modify"];
    for (const name of builderToolNames) {
      const tool = TITAN_TOOLS.find((t) => t.function.name === name);
      expect(tool).toBeDefined();
      expect(tool!.function.description.length).toBeGreaterThan(20);
    }
  });

  it("self_multi_file_modify items should have filePath, action, content, description", () => {
    const tool = TITAN_TOOLS.find((t) => t.function.name === "self_multi_file_modify");
    const items = (tool!.function.parameters.properties as any).modifications.items;
    expect(items.properties).toHaveProperty("filePath");
    expect(items.properties).toHaveProperty("action");
    expect(items.properties).toHaveProperty("content");
    expect(items.properties).toHaveProperty("description");
    expect(items.required).toContain("filePath");
    expect(items.required).toContain("action");
    expect(items.required).toContain("description");
  });

  it("self_multi_file_modify action should be an enum of modify/create/delete", () => {
    const tool = TITAN_TOOLS.find((t) => t.function.name === "self_multi_file_modify");
    const actionProp = (tool!.function.parameters.properties as any).modifications.items.properties.action;
    expect(actionProp.enum).toEqual(["modify", "create", "delete"]);
  });
});

// ═══════════════════════════════════════════════════════════════════
// Engine Function Exports
// ═══════════════════════════════════════════════════════════════════

describe("Self-Improvement Engine Exports", () => {
  it("should export runTypeCheck function", async () => {
    const mod = await import("./self-improvement-engine");
    expect(typeof mod.runTypeCheck).toBe("function");
  });

  it("should export runTests function", async () => {
    const mod = await import("./self-improvement-engine");
    expect(typeof mod.runTests).toBe("function");
  });

  it("should export runQuickHealthCheck function", async () => {
    const mod = await import("./self-improvement-engine");
    expect(typeof mod.runQuickHealthCheck).toBe("function");
  });
});

// ═══════════════════════════════════════════════════════════════════
// Executor Exports
// ═══════════════════════════════════════════════════════════════════

describe("Chat Executor Exports", () => {
  it("should export executeToolCall function", async () => {
    const mod = await import("./chat-executor");
    expect(typeof mod.executeToolCall).toBe("function");
  });

  it("executeToolCall should handle unknown tools gracefully", async () => {
    const { executeToolCall } = await import("./chat-executor");
    const result = await executeToolCall("unknown_tool_xyz", {}, 1, "admin", "admin@test.com");
    expect(result.success).toBe(false);
    expect(result.error).toContain("Unknown tool");
  });
});

// ═══════════════════════════════════════════════════════════════════
// Multi-file Validation (no process spawning)
// ═══════════════════════════════════════════════════════════════════

describe("Multi-file Validation", () => {
  it("should reject when exceeding max files per operation (>15)", () => {
    const mods: ModificationRequest[] = Array.from({ length: 20 }, (_, i) => ({
      filePath: `server/test-file-${i}.ts`,
      action: "create" as const,
      content: `// test ${i}`,
      description: `test file ${i}`,
    }));
    const result = validateModifications(mods);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("Too many files"))).toBe(true);
  });

  it("should accept up to 15 valid modifications", () => {
    const mods: ModificationRequest[] = Array.from({ length: 15 }, (_, i) => ({
      filePath: `server/test-file-${i}.ts`,
      action: "create" as const,
      content: `// valid test file ${i}\nexport const x${i} = ${i};\n`,
      description: `test file ${i}`,
    }));
    const result = validateModifications(mods);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("should reject if ANY file in a batch is protected", () => {
    const mods: ModificationRequest[] = [
      {
        filePath: "server/test-ok.ts",
        action: "create",
        content: "// ok",
        description: "ok file",
      },
      {
        filePath: "server/_core/context.ts",
        action: "modify",
        content: "// bad",
        description: "trying to modify protected",
      },
    ];
    const result = validateModifications(mods);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("PROTECTED"))).toBe(true);
  });

  it("should reject modifications with truly destructive patterns", () => {
    const mods: ModificationRequest[] = [
      {
        filePath: "server/test-temp.ts",
        action: "create",
        content: "rm -rf /",
        description: "test destructive",
      },
    ];
    const result = validateModifications(mods);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("DANGEROUS"))).toBe(true);
  });

  it("should allow process.exit and exec patterns (loosened restrictions)", () => {
    const mods: ModificationRequest[] = [
      {
        filePath: "server/test-temp.ts",
        action: "create",
        content: "process.exit(1); exec('ls');",
        description: "test allowed patterns",
      },
    ];
    const result = validateModifications(mods);
    expect(result.valid).toBe(true);
  });

  it("should warn about mismatched braces in TypeScript files", () => {
    const mods: ModificationRequest[] = [
      {
        filePath: "server/test-braces.ts",
        action: "create",
        content: "function a() {\n  function b() {\n    function c() {\n",
        description: "mismatched braces",
      },
    ];
    const result = validateModifications(mods);
    expect(result.valid).toBe(true);
    expect(result.warnings.some((w) => w.includes("SYNTAX WARNING"))).toBe(true);
  });

  it("should accept empty modifications array at validation level (executor rejects)", () => {
    // validateModifications considers empty arrays valid (no violations)
    // The executor layer rejects empty arrays before calling validation
    const mods: ModificationRequest[] = [];
    const result = validateModifications(mods);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════════
// Admin Gating for Builder Write Tools
// ═══════════════════════════════════════════════════════════════════

describe("Builder Admin Gating", () => {
  it("self_multi_file_modify should be categorized as a write tool (mentions rollback)", () => {
    const tool = TITAN_TOOLS.find((t) => t.function.name === "self_multi_file_modify");
    expect(tool).toBeDefined();
    expect(tool!.function.description).toContain("rollback");
  });

  it("self_type_check should be a read-only tool (no rollback mention)", () => {
    const tool = TITAN_TOOLS.find((t) => t.function.name === "self_type_check");
    expect(tool).toBeDefined();
    expect(tool!.function.description).not.toContain("rollback");
  });

  it("self_run_tests should be a read-only tool (no rollback mention)", () => {
    const tool = TITAN_TOOLS.find((t) => t.function.name === "self_run_tests");
    expect(tool).toBeDefined();
    expect(tool!.function.description).not.toContain("rollback");
  });

  it("all tool names should be unique", () => {
    const names = TITAN_TOOLS.map((t) => t.function.name);
    const uniqueNames = new Set(names);
    expect(uniqueNames.size).toBe(names.length);
  });

  it("all tools should have valid JSON schema parameters", () => {
    for (const tool of TITAN_TOOLS) {
      const params = tool.function.parameters;
      expect(params.type).toBe("object");
      if (params.properties) {
        expect(typeof params.properties).toBe("object");
        for (const [key, value] of Object.entries(params.properties)) {
          expect(typeof key).toBe("string");
          expect((value as any).type).toBeTruthy();
        }
      }
    }
  });
});

// ═══════════════════════════════════════════════════════════════════
// Executor — self_multi_file_modify (validation only, no process spawn)
// ═══════════════════════════════════════════════════════════════════

describe("Executor — self_multi_file_modify validation", () => {
  it("should reject empty modifications via executor", async () => {
    const { executeToolCall } = await import("./chat-executor");
    const result = await executeToolCall(
      "self_multi_file_modify",
      { modifications: [] },
      1,
      "admin",
      "admin@test.com"
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain("No modifications");
  });

  it("should reject protected file modifications via executor", async () => {
    const { executeToolCall } = await import("./chat-executor");
    const result = await executeToolCall(
      "self_multi_file_modify",
      {
        modifications: [
          {
            filePath: "server/_core/context.ts",
            action: "modify",
            content: "// malicious",
            description: "test",
          },
        ],
      },
      1,
      "admin",
      "admin@test.com"
    );
    expect(result.success).toBe(false);
  });
});
