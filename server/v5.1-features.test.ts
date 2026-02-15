/**
 * v5.1 Feature Tests
 *
 * Tests for:
 * - Chat Tools (tool definitions)
 * - Self-Improvement Engine (validation, protected files)
 * - Admin Panel (admin router — role gating)
 * - Onboarding Wizard
 * - Subscription Gate Admin Bypass
 */

import { describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { TITAN_TOOLS } from "./chat-tools";
import {
  validateModifications,
  getProtectedFiles,
  getAllowedDirectories,
  type ModificationRequest,
} from "./self-improvement-engine";

// ─── Test Helpers ────────────────────────────────────────────────

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAdminContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "admin-user",
    email: "admin@example.com",
    name: "Admin User",
    loginMethod: "email",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
      ip: "127.0.0.1",
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

function createUserContext(overrides?: Partial<AuthenticatedUser>): TrpcContext {
  const user: AuthenticatedUser = {
    id: 2,
    openId: "regular-user",
    email: "user@example.com",
    name: "Regular User",
    loginMethod: "email",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
    ...overrides,
  };

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
      ip: "127.0.0.1",
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

// ═══════════════════════════════════════════════════════════════════
// Chat Tools Tests
// ═══════════════════════════════════════════════════════════════════

describe("Chat Tools", () => {
  it("should export a non-empty array of tool definitions", () => {
    expect(Array.isArray(TITAN_TOOLS)).toBe(true);
    expect(TITAN_TOOLS.length).toBeGreaterThan(0);
  });

  it("every tool should have required fields", () => {
    for (const tool of TITAN_TOOLS) {
      expect(tool.type).toBe("function");
      expect(tool.function).toBeDefined();
      expect(tool.function.name).toBeTruthy();
      expect(typeof tool.function.name).toBe("string");
      expect(tool.function.description).toBeTruthy();
      expect(tool.function.parameters).toBeDefined();
      expect(tool.function.parameters.type).toBe("object");
    }
  });

  it("tool names should be unique", () => {
    const names = TITAN_TOOLS.map((t) => t.function.name);
    const uniqueNames = new Set(names);
    expect(uniqueNames.size).toBe(names.length);
  });

  it("should include self-improvement tools", () => {
    const names = TITAN_TOOLS.map((t) => t.function.name);
    expect(names).toContain("self_read_file");
    expect(names).toContain("self_modify_file");
    expect(names).toContain("self_health_check");
    expect(names).toContain("self_rollback");
    expect(names).toContain("self_restart");
  });

  it("should include core action tools", () => {
    const names = TITAN_TOOLS.map((t) => t.function.name);
    expect(names).toContain("list_credentials");
    expect(names).toContain("create_fetch_job");
    expect(names).toContain("create_api_key");
    expect(names).toContain("list_api_keys");
  });

  it("all tool parameters should have valid JSON schema", () => {
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
// Self-Improvement Engine Tests
// ═══════════════════════════════════════════════════════════════════

describe("Self-Improvement Engine", () => {
  describe("Protected Files", () => {
    it("should return protected file patterns", () => {
      const protectedFiles = getProtectedFiles();
      expect(Array.isArray(protectedFiles)).toBe(true);
      expect(protectedFiles.length).toBeGreaterThan(0);
    });

    it("should protect critical system files", () => {
      const protectedFiles = getProtectedFiles();
      const joined = protectedFiles.join(" ");
      expect(joined).toContain("_core");
      expect(joined).toContain("schema");
      expect(joined).toContain("self-improvement-engine");
    });
  });

  describe("Allowed Directories", () => {
    it("should return allowed directories", () => {
      const dirs = getAllowedDirectories();
      expect(Array.isArray(dirs)).toBe(true);
      expect(dirs.length).toBeGreaterThan(0);
    });

    it("should include server and client directories", () => {
      const dirs = getAllowedDirectories();
      const hasServer = dirs.some((d) => d.includes("server"));
      const hasClient = dirs.some((d) => d.includes("client"));
      expect(hasServer).toBe(true);
      expect(hasClient).toBe(true);
    });
  });

  describe("Validation", () => {
    it("should reject modifications to protected files", () => {
      const mods: ModificationRequest[] = [
        { filePath: "server/_core/context.ts", action: "modify", content: "// malicious code" },
      ];
      const result = validateModifications(mods);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain("PROTECTED");
    });

    it("should reject files outside allowed directories", () => {
      const mods: ModificationRequest[] = [
        { filePath: "/etc/passwd", action: "modify", content: "root:x:0:0" },
      ];
      // Absolute paths trigger a path traversal throw
      expect(() => validateModifications(mods)).toThrow("Path traversal");
    });

    it("should reject oversized content", () => {
      const bigContent = "x".repeat(200_001);
      const mods: ModificationRequest[] = [
        { filePath: "server/test-file.ts", action: "modify", content: bigContent },
      ];
      const result = validateModifications(mods);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("SIZE"))).toBe(true);
    });

    it("should reject content with dangerous patterns like process.exit", () => {
      const mods: ModificationRequest[] = [
        { filePath: "server/test-file.ts", action: "modify", content: "process.exit(1);" },
      ];
      const result = validateModifications(mods);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("DANGEROUS"))).toBe(true);
    });

    it("should reject content with eval()", () => {
      const mods: ModificationRequest[] = [
        { filePath: "server/test-file.ts", action: "modify", content: 'eval("alert(1)")' },
      ];
      const result = validateModifications(mods);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("DANGEROUS"))).toBe(true);
    });

    it("should accept valid modifications to allowed files", () => {
      const mods: ModificationRequest[] = [
        {
          filePath: "server/test-new-feature.ts",
          action: "create",
          content: '// A valid new feature\nexport function hello() { return "world"; }\n',
        },
      ];
      const result = validateModifications(mods);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should reject self-improvement engine modification", () => {
      const mods: ModificationRequest[] = [
        {
          filePath: "server/self-improvement-engine.ts",
          action: "modify",
          content: "// try to modify safety system",
        },
      ];
      const result = validateModifications(mods);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain("PROTECTED");
    });
  });
});

// ═══════════════════════════════════════════════════════════════════
// Admin Router Tests
// ═══════════════════════════════════════════════════════════════════

describe("Admin Router", () => {
  it("should reject non-admin users from systemStats", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);

    await expect(caller.admin.systemStats()).rejects.toThrow();
  });

  it("should reject non-admin users from listUsers", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.admin.listUsers({ page: 1, limit: 20, role: "all", sortBy: "createdAt", sortOrder: "desc" })
    ).rejects.toThrow();
  });

  it("should reject non-admin users from updateRole", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.admin.updateRole({ userId: 1, role: "admin" })
    ).rejects.toThrow();
  });

  it("should reject non-admin users from deleteUser", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.admin.deleteUser({ userId: 99 })
    ).rejects.toThrow();
  });

  it("should reject non-admin users from resetPassword", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.admin.resetPassword({ userId: 99 })
    ).rejects.toThrow();
  });

  it("should reject non-admin users from disable2FA", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.admin.disable2FA({ userId: 99 })
    ).rejects.toThrow();
  });
});

// ═══════════════════════════════════════════════════════════════════
// Onboarding Wizard Router Tests
// ═══════════════════════════════════════════════════════════════════

describe("Onboarding Wizard Router", () => {
  it("should allow completeStep mutation for welcome step", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.onboardingWizard.completeStep({ stepId: "welcome" });
    expect(result).toEqual({ success: true, stepId: "welcome" });
  });

  it("should allow completeStep for explore_features step", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.onboardingWizard.completeStep({ stepId: "explore_features" });
    expect(result).toEqual({ success: true, stepId: "explore_features" });
  });

  it("should allow completeStep for any arbitrary step ID", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.onboardingWizard.completeStep({ stepId: "custom_step" });
    expect(result).toEqual({ success: true, stepId: "custom_step" });
  });
});

// ═══════════════════════════════════════════════════════════════════
// Subscription Gate Admin Bypass Tests
// ═══════════════════════════════════════════════════════════════════

describe("Subscription Gate Admin Bypass", () => {
  it("getUserPlan should be importable", async () => {
    const { getUserPlan } = await import("./subscription-gate");
    expect(typeof getUserPlan).toBe("function");
  });

  it("enforceFeature should be importable", async () => {
    const { enforceFeature } = await import("./subscription-gate");
    expect(typeof enforceFeature).toBe("function");
  });
});
