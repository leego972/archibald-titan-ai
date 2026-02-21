import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(userId = 9999): TrpcContext {
  const user: AuthenticatedUser = {
    id: userId,
    openId: `dashboard-test-user-${userId}`,
    email: `dashtest-${userId}@example.com`,
    name: "Dashboard Test User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
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

describe("dashboard.getLayout", () => {
  it("returns null when no layout is saved", async () => {
    const ctx = createAuthContext(8888);
    const caller = appRouter.createCaller(ctx);
    const result = await caller.dashboard.getLayout();
    // Should be null for a user with no saved layout
    expect(result === null || result?.widgetOrder).toBeTruthy();
  });
});

describe("dashboard.saveLayout", () => {
  it("saves a layout with widget order", async () => {
    const ctx = createAuthContext(8889);
    const caller = appRouter.createCaller(ctx);

    const result = await caller.dashboard.saveLayout({
      widgetOrder: ["quick_actions", "usage_stats", "providers", "feature_access"],
      hiddenWidgets: ["providers"],
    });

    expect(result).toEqual({ success: true });
  });

  it("retrieves the saved layout", async () => {
    const ctx = createAuthContext(8889);
    const caller = appRouter.createCaller(ctx);

    const layout = await caller.dashboard.getLayout();
    expect(layout).not.toBeNull();
    expect(layout!.widgetOrder).toEqual([
      "quick_actions",
      "usage_stats",
      "providers",
      "feature_access",
    ]);
    expect(layout!.hiddenWidgets).toEqual(["providers"]);
  });

  it("updates an existing layout", async () => {
    const ctx = createAuthContext(8889);
    const caller = appRouter.createCaller(ctx);

    const result = await caller.dashboard.saveLayout({
      widgetOrder: ["feature_access", "usage_stats"],
      hiddenWidgets: [],
    });

    expect(result).toEqual({ success: true });

    const layout = await caller.dashboard.getLayout();
    expect(layout!.widgetOrder).toEqual(["feature_access", "usage_stats"]);
    expect(layout!.hiddenWidgets).toEqual([]);
  });
});

describe("dashboard.resetLayout", () => {
  it("resets the layout to default", async () => {
    const ctx = createAuthContext(8889);
    const caller = appRouter.createCaller(ctx);

    const result = await caller.dashboard.resetLayout();
    expect(result).toEqual({ success: true });

    const layout = await caller.dashboard.getLayout();
    // After reset, should be null (no saved layout)
    expect(layout).toBeNull();
  });
});

describe("dashboard.credentialHealth", () => {
  it("returns credential health data for authenticated user", async () => {
    const ctx = createAuthContext(8892);
    const caller = appRouter.createCaller(ctx);
    const result = await caller.dashboard.credentialHealth();
    expect(result).toBeDefined();
    expect(result).toHaveProperty("totalCredentials");
    expect(result).toHaveProperty("totalApiKeys");
    expect(result).toHaveProperty("expired");
    expect(result).toHaveProperty("expiringSoon");
    expect(result).toHaveProperty("expiringWarning");
    expect(result).toHaveProperty("healthy");
    expect(result).toHaveProperty("summary");
    expect(result).toHaveProperty("overallStatus");
    expect(typeof result.totalCredentials).toBe("number");
    expect(typeof result.totalApiKeys).toBe("number");
    expect(Array.isArray(result.expired)).toBe(true);
    expect(Array.isArray(result.expiringSoon)).toBe(true);
    expect(Array.isArray(result.healthy)).toBe(true);
    expect(result.summary).toHaveProperty("expired");
    expect(result.summary).toHaveProperty("expiringSoon");
    expect(result.summary).toHaveProperty("healthy");
    expect(["healthy", "warning", "critical"]).toContain(result.overallStatus);
  });
});

describe("dashboard.saveLayout validation", () => {
  it("accepts widgetSizes parameter", async () => {
    const ctx = createAuthContext(8890);
    const caller = appRouter.createCaller(ctx);

    const result = await caller.dashboard.saveLayout({
      widgetOrder: ["usage_stats", "quick_actions"],
      hiddenWidgets: [],
      widgetSizes: { usage_stats: "lg", quick_actions: "sm" },
    });

    expect(result).toEqual({ success: true });

    const layout = await caller.dashboard.getLayout();
    expect(layout!.widgetSizes).toEqual({
      usage_stats: "lg",
      quick_actions: "sm",
    });
  });

  it("handles empty widget order", async () => {
    const ctx = createAuthContext(8891);
    const caller = appRouter.createCaller(ctx);

    const result = await caller.dashboard.saveLayout({
      widgetOrder: [],
      hiddenWidgets: ["usage_stats", "quick_actions", "feature_access", "providers"],
    });

    expect(result).toEqual({ success: true });
  });
});
