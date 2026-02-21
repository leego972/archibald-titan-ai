import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// ─── Test Helpers ─────────────────────────────────────────────────────

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createTestContext(overrides?: Partial<AuthenticatedUser>): TrpcContext {
  const user: AuthenticatedUser = {
    id: 99999, // Use a high ID to avoid collisions with real data
    openId: "test-user-features",
    email: "test-features@example.com",
    name: "Test Features User",
    loginMethod: "manus",
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
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

// ─── CSV Export Tests ─────────────────────────────────────────────────

describe("CSV Export", () => {
  it("exportCredentials returns CSV format with headers", async () => {
    // Import the function directly
    const { exportCredentials } = await import("./fetcher-db");
    // Use a user ID that won't have credentials — should return just the header
    const result = await exportCredentials(99999, "csv");
    expect(result).toContain("Provider,Provider ID,Key Type,Label,Value");
  });

  it("exportCredentials returns JSON format", async () => {
    const { exportCredentials } = await import("./fetcher-db");
    const result = await exportCredentials(99999, "json");
    const parsed = JSON.parse(result);
    expect(Array.isArray(parsed)).toBe(true);
  });

  it("exportCredentials returns ENV format", async () => {
    const { exportCredentials } = await import("./fetcher-db");
    const result = await exportCredentials(99999, "env");
    expect(typeof result).toBe("string");
  });
});

// ─── API Access Tests ─────────────────────────────────────────────────

describe("API Access Router", () => {
  it("listKeys requires enterprise plan (free user gets FORBIDDEN)", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    await expect(caller.apiAccess.listKeys()).rejects.toThrow(/not available/i);
  });

  it("createKey requires enterprise plan (free user gets FORBIDDEN)", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.apiAccess.createKey({
        name: "Test Key",
        scopes: ["credentials:read"],
        expiresInDays: 30,
      })
    ).rejects.toThrow(/not available/i);
  });

  it("revokeKey requires authentication", async () => {
    const ctx: TrpcContext = {
      user: null,
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: { clearCookie: () => {} } as TrpcContext["res"],
    };
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.apiAccess.revokeKey({ keyId: 1 })
    ).rejects.toThrow();
  });

  it("scopes endpoint returns available scopes", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    // scopes is a public-ish endpoint that just returns the list
    // It's behind protectedProcedure but doesn't check plan
    const scopes = await caller.apiAccess.scopes();
    expect(Array.isArray(scopes)).toBe(true);
    expect(scopes.length).toBeGreaterThan(0);
    expect(scopes[0]).toHaveProperty("id");
    expect(scopes[0]).toHaveProperty("label");
    expect(scopes[0]).toHaveProperty("description");
  });
});

// ─── Team Management Tests ────────────────────────────────────────────

describe("Team Management Router", () => {
  it("listMembers requires enterprise plan (free user gets FORBIDDEN)", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    await expect(caller.team.listMembers()).rejects.toThrow(/not available/i);
  });

  it("addMember requires enterprise plan", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.team.addMember({ email: "test@test.com", role: "member" })
    ).rejects.toThrow(/not available/i);
  });

  it("stats requires enterprise plan", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    await expect(caller.team.stats()).rejects.toThrow(/not available/i);
  });

  it("removeMember requires authentication", async () => {
    const ctx: TrpcContext = {
      user: null,
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: { clearCookie: () => {} } as TrpcContext["res"],
    };
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.team.removeMember({ memberId: 1 })
    ).rejects.toThrow();
  });
});

// ─── Audit Logs Tests ─────────────────────────────────────────────────

describe("Audit Logs Router", () => {
  it("list requires enterprise plan (free user gets FORBIDDEN)", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    await expect(caller.audit.list()).rejects.toThrow(/not available/i);
  });

  it("actions requires enterprise plan", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    await expect(caller.audit.actions()).rejects.toThrow(/not available/i);
  });

  it("stats requires enterprise plan", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    await expect(caller.audit.stats()).rejects.toThrow(/not available/i);
  });
});

// ─── Audit Log DB Helper Tests ────────────────────────────────────────

describe("Audit Log DB Helpers", () => {
  it("logAudit does not throw on write", async () => {
    const { logAudit } = await import("./audit-log-db");

    // Should not throw even if it fails internally
    await expect(
      logAudit({
        userId: 99999,
        userName: "Test User",
        action: "test.action",
        resource: "test",
        details: { foo: "bar" },
      })
    ).resolves.not.toThrow();
  });

  it("queryAuditLogs returns correct structure", async () => {
    const { queryAuditLogs } = await import("./audit-log-db");

    const result = await queryAuditLogs({ limit: 5 });
    expect(result).toHaveProperty("logs");
    expect(result).toHaveProperty("total");
    expect(Array.isArray(result.logs)).toBe(true);
    expect(typeof result.total).toBe("number");
  });

  it("getDistinctActions returns array", async () => {
    const { getDistinctActions } = await import("./audit-log-db");

    const actions = await getDistinctActions();
    expect(Array.isArray(actions)).toBe(true);
  });
});

// ─── API Key Validation Tests ─────────────────────────────────────────

describe("API Key Validation", () => {
  it("validateApiKey returns null for invalid key", async () => {
    const { validateApiKey } = await import("./api-access-router");

    const result = await validateApiKey("at_invalid_key_that_does_not_exist");
    expect(result).toBeNull();
  });

  it("validateApiKey returns null for empty string", async () => {
    const { validateApiKey } = await import("./api-access-router");

    const result = await validateApiKey("");
    expect(result).toBeNull();
  });
});

// ─── Subscription Gate Feature Checks ─────────────────────────────────

describe("Subscription Gate - New Features", () => {
  it("isFeatureAllowed returns false for free plan on enterprise features", async () => {
    const { isFeatureAllowed } = await import("./subscription-gate");

    expect(isFeatureAllowed("free", "api_access")).toBe(false);
    expect(isFeatureAllowed("free", "team_management")).toBe(false);
    expect(isFeatureAllowed("free", "audit_logs")).toBe(false);
    expect(isFeatureAllowed("free", "csv_export")).toBe(false);
  });

  it("isFeatureAllowed returns true for enterprise plan on all features", async () => {
    const { isFeatureAllowed } = await import("./subscription-gate");

    expect(isFeatureAllowed("enterprise", "api_access")).toBe(true);
    expect(isFeatureAllowed("enterprise", "team_management")).toBe(true);
    expect(isFeatureAllowed("enterprise", "audit_logs")).toBe(true);
    expect(isFeatureAllowed("enterprise", "csv_export")).toBe(true);
  });

  it("isFeatureAllowed returns true for pro plan on pro features", async () => {
    const { isFeatureAllowed } = await import("./subscription-gate");

    expect(isFeatureAllowed("pro", "env_export")).toBe(true);
    expect(isFeatureAllowed("pro", "kill_switch")).toBe(true);
    expect(isFeatureAllowed("pro", "proxy_pool")).toBe(true);
  });

  it("isFeatureAllowed returns false for pro plan on enterprise-only features", async () => {
    const { isFeatureAllowed } = await import("./subscription-gate");

    expect(isFeatureAllowed("pro", "api_access")).toBe(true); // api_access now available on pro
    expect(isFeatureAllowed("pro", "team_management")).toBe(false);
    expect(isFeatureAllowed("pro", "audit_logs")).toBe(false);
  });
});
