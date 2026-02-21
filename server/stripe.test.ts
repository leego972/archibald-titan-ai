import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { PRICING_TIERS } from "../shared/pricing";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): { ctx: TrpcContext } {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "sample-user",
    email: "sample@example.com",
    name: "Sample User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: { origin: "https://test.example.com" },
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };

  return { ctx };
}

function createPublicContext(): { ctx: TrpcContext } {
  const ctx: TrpcContext = {
    user: null,
    req: {
      protocol: "https",
      headers: { origin: "https://test.example.com" },
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };

  return { ctx };
}

describe("Pricing Configuration", () => {
  it("has exactly 4 pricing tiers", () => {
    expect(PRICING_TIERS).toHaveLength(4);
  });

  it("includes free, pro, enterprise, and cyber tiers", () => {
    const ids = PRICING_TIERS.map((t) => t.id);
    expect(ids).toContain("free");
    expect(ids).toContain("pro");
    expect(ids).toContain("enterprise");
    expect(ids).toContain("cyber");
  });

  it("free tier has $0 pricing", () => {
    const free = PRICING_TIERS.find((t) => t.id === "free");
    expect(free).toBeDefined();
    expect(free!.monthlyPrice).toBe(0);
    expect(free!.yearlyPrice).toBe(0);
  });

  it("pro tier has correct pricing", () => {
    const pro = PRICING_TIERS.find((t) => t.id === "pro");
    expect(pro).toBeDefined();
    expect(pro!.monthlyPrice).toBe(29);
    expect(pro!.yearlyPrice).toBe(290);
    expect(pro!.highlighted).toBe(true);
  });

  it("enterprise tier has correct pricing", () => {
    const enterprise = PRICING_TIERS.find((t) => t.id === "enterprise");
    expect(enterprise).toBeDefined();
    expect(enterprise!.monthlyPrice).toBe(99);
    expect(enterprise!.yearlyPrice).toBe(990);
  });

  it("yearly prices are less than 12x monthly", () => {
    for (const tier of PRICING_TIERS) {
      if (tier.monthlyPrice > 0) {
        expect(tier.yearlyPrice).toBeLessThan(tier.monthlyPrice * 12);
      }
    }
  });

  it("all tiers have features listed", () => {
    for (const tier of PRICING_TIERS) {
      expect(tier.features.length).toBeGreaterThan(0);
    }
  });

  it("all tiers have limits defined", () => {
    for (const tier of PRICING_TIERS) {
      expect(tier.limits).toBeDefined();
      expect(tier.limits.fetchesPerMonth).toBeDefined();
      expect(tier.limits.providers).toBeDefined();
      expect(tier.limits.exportFormats.length).toBeGreaterThan(0);
    }
  });

  it("only one tier is highlighted", () => {
    const highlighted = PRICING_TIERS.filter((t) => t.highlighted);
    expect(highlighted).toHaveLength(1);
    expect(highlighted[0].id).toBe("pro");
  });

  it("cyber tier is the highest priced tier", () => {
    const cyber = PRICING_TIERS.find((t) => t.id === "cyber");
    expect(cyber).toBeDefined();
    expect(cyber!.monthlyPrice).toBeGreaterThan(99);
    for (const tier of PRICING_TIERS) {
      if (tier.id !== "cyber") {
        expect(cyber!.monthlyPrice).toBeGreaterThanOrEqual(tier.monthlyPrice);
      }
    }
  });
});

describe("stripe.getSubscription", () => {
  it("returns free plan for authenticated user with no subscription", async () => {
    // Use a high user ID that won't have a subscription in the database
    const user: AuthenticatedUser = {
      id: 999999,
      openId: "no-sub-user",
      email: "nosub@example.com",
      name: "No Sub User",
      loginMethod: "manus",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    };
    const ctx: TrpcContext = {
      user,
      req: {
        protocol: "https",
        headers: { origin: "https://test.example.com" },
      } as TrpcContext["req"],
      res: {
        clearCookie: () => {},
      } as TrpcContext["res"],
    };
    const caller = appRouter.createCaller(ctx);

    const result = await caller.stripe.getSubscription();
    expect(result).toBeDefined();
    expect(result.plan).toBe("free");
    expect(result.status).toBe("active");
  });
});

describe("stripe.createCheckout", () => {
  it("requires authentication", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.stripe.createCheckout({ planId: "pro", interval: "month" })
    ).rejects.toThrow();
  });

  it("validates plan ID input", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.stripe.createCheckout({ planId: "invalid" as any, interval: "month" })
    ).rejects.toThrow();
  });

  it("validates interval input", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.stripe.createCheckout({ planId: "pro", interval: "weekly" as any })
    ).rejects.toThrow();
  });
});

describe("stripe.createPortalSession", () => {
  it("requires authentication", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(caller.stripe.createPortalSession()).rejects.toThrow();
  });
});
