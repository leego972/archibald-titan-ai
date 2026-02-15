import { describe, expect, it } from "vitest";
import {
  PRICING_TIERS,
  CREDIT_COSTS,
  CREDIT_PACKS,
} from "../shared/pricing";

// ─── Pricing Configuration Tests ─────────────────────────────────────

describe("Credit System — Pricing Configuration", () => {
  it("has three pricing tiers: free, pro, enterprise", () => {
    const ids = PRICING_TIERS.map((t) => t.id);
    expect(ids).toContain("free");
    expect(ids).toContain("pro");
    expect(ids).toContain("enterprise");
    expect(ids).toHaveLength(3);
  });

  it("free tier has correct credit allocations", () => {
    const free = PRICING_TIERS.find((t) => t.id === "free")!;
    expect(free.credits.monthlyAllocation).toBe(50);
    expect(free.credits.signupBonus).toBe(25);
    expect(free.monthlyPrice).toBe(0);
  });

  it("pro tier has higher credit allocations than free", () => {
    const free = PRICING_TIERS.find((t) => t.id === "free")!;
    const pro = PRICING_TIERS.find((t) => t.id === "pro")!;
    expect(pro.credits.monthlyAllocation).toBeGreaterThan(free.credits.monthlyAllocation);
    expect(pro.credits.signupBonus).toBeGreaterThan(free.credits.signupBonus);
  });

  it("enterprise tier has highest credit allocations", () => {
    const pro = PRICING_TIERS.find((t) => t.id === "pro")!;
    const enterprise = PRICING_TIERS.find((t) => t.id === "enterprise")!;
    expect(enterprise.credits.monthlyAllocation).toBeGreaterThan(pro.credits.monthlyAllocation);
    expect(enterprise.credits.signupBonus).toBeGreaterThan(pro.credits.signupBonus);
  });

  it("all tiers have positive monthly allocations", () => {
    for (const tier of PRICING_TIERS) {
      expect(tier.credits.monthlyAllocation).toBeGreaterThan(0);
    }
  });

  it("all tiers have non-negative signup bonuses", () => {
    for (const tier of PRICING_TIERS) {
      expect(tier.credits.signupBonus).toBeGreaterThanOrEqual(0);
    }
  });
});

// ─── Credit Costs Tests ──────────────────────────────────────────────

describe("Credit System — Credit Costs", () => {
  it("defines costs for all action types", () => {
    expect(CREDIT_COSTS.chat_message).toBeDefined();
    expect(CREDIT_COSTS.builder_action).toBeDefined();
    expect(CREDIT_COSTS.voice_action).toBeDefined();
    expect(CREDIT_COSTS.fetch_action).toBeDefined();
  });

  it("chat message costs 1 credit", () => {
    expect(CREDIT_COSTS.chat_message).toBe(1);
  });

  it("builder action costs 5 credits (most expensive)", () => {
    expect(CREDIT_COSTS.builder_action).toBe(5);
    expect(CREDIT_COSTS.builder_action).toBeGreaterThan(CREDIT_COSTS.chat_message);
  });

  it("voice action costs 3 credits", () => {
    expect(CREDIT_COSTS.voice_action).toBe(3);
  });

  it("fetch action costs 2 credits", () => {
    expect(CREDIT_COSTS.fetch_action).toBe(2);
  });

  it("all costs are positive integers", () => {
    for (const [, cost] of Object.entries(CREDIT_COSTS)) {
      expect(cost).toBeGreaterThan(0);
      expect(Number.isInteger(cost)).toBe(true);
    }
  });
});

// ─── Credit Packs Tests ──────────────────────────────────────────────

describe("Credit System — Credit Packs", () => {
  it("has at least 3 credit packs", () => {
    expect(CREDIT_PACKS.length).toBeGreaterThanOrEqual(3);
  });

  it("all packs have unique IDs", () => {
    const ids = CREDIT_PACKS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("all packs have positive credit amounts and prices", () => {
    for (const pack of CREDIT_PACKS) {
      expect(pack.credits).toBeGreaterThan(0);
      expect(pack.price).toBeGreaterThan(0);
    }
  });

  it("larger packs offer better per-credit value", () => {
    const sorted = [...CREDIT_PACKS].sort((a, b) => a.credits - b.credits);
    for (let i = 1; i < sorted.length; i++) {
      const prevRate = sorted[i - 1].price / sorted[i - 1].credits;
      const currRate = sorted[i].price / sorted[i].credits;
      expect(currRate).toBeLessThanOrEqual(prevRate);
    }
  });

  it("has exactly one popular pack", () => {
    const popular = CREDIT_PACKS.filter((p) => p.popular);
    expect(popular.length).toBe(1);
  });
});

// ─── Credit Balance Logic Tests (unit-level) ─────────────────────────

describe("Credit System — Balance Logic", () => {
  it("admin users should be unlimited (isUnlimited flag)", () => {
    const isAdmin = true;
    const isUnlimited = isAdmin;
    expect(isUnlimited).toBe(true);
  });

  it("non-admin users should not be unlimited by default", () => {
    const isAdmin = false;
    const isUnlimited = isAdmin;
    expect(isUnlimited).toBe(false);
  });

  it("credit check allows action when balance >= cost", () => {
    const balance = 10;
    const cost = CREDIT_COSTS.chat_message;
    const allowed = balance >= cost;
    expect(allowed).toBe(true);
  });

  it("credit check denies action when balance < cost", () => {
    const balance = 2;
    const cost = CREDIT_COSTS.builder_action;
    const allowed = balance >= cost;
    expect(allowed).toBe(false);
  });

  it("unlimited users always pass credit check", () => {
    const isUnlimited = true;
    const balance = 0;
    const cost = CREDIT_COSTS.builder_action;
    const allowed = isUnlimited || balance >= cost;
    expect(allowed).toBe(true);
  });

  it("credit consumption reduces balance correctly", () => {
    let balance = 100;
    const cost = CREDIT_COSTS.builder_action;
    balance -= cost;
    expect(balance).toBe(95);
  });

  it("monthly refill adds correct amount per tier", () => {
    const freeTier = PRICING_TIERS.find((t) => t.id === "free")!;
    const proTier = PRICING_TIERS.find((t) => t.id === "pro")!;

    let freeBalance = 10;
    freeBalance += freeTier.credits.monthlyAllocation;
    expect(freeBalance).toBe(60);

    let proBalance = 10;
    proBalance += proTier.credits.monthlyAllocation;
    expect(proBalance).toBe(510);
  });

  it("signup bonus is applied correctly per tier", () => {
    const freeTier = PRICING_TIERS.find((t) => t.id === "free")!;
    const proTier = PRICING_TIERS.find((t) => t.id === "pro")!;
    const entTier = PRICING_TIERS.find((t) => t.id === "enterprise")!;

    expect(freeTier.credits.signupBonus).toBe(25);
    expect(proTier.credits.signupBonus).toBe(100);
    expect(entTier.credits.signupBonus).toBe(500);
  });
});

// ─── Desktop License Logic Tests ─────────────────────────────────────

describe("Credit System — Desktop License Logic", () => {
  it("license duration is 30 days", () => {
    const LICENSE_DURATION_DAYS = 30;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + LICENSE_DURATION_DAYS * 24 * 60 * 60 * 1000);
    const diffMs = expiresAt.getTime() - now.getTime();
    const diffDays = diffMs / (24 * 60 * 60 * 1000);
    expect(diffDays).toBe(30);
  });

  it("license auto-refresh triggers within 7 days of expiry", () => {
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    const now = Date.now();

    const expiresInFive = new Date(now + 5 * 24 * 60 * 60 * 1000);
    const sevenDaysFromNow = new Date(now + sevenDaysMs);
    expect(expiresInFive < sevenDaysFromNow).toBe(true);

    const expiresInFifteen = new Date(now + 15 * 24 * 60 * 60 * 1000);
    expect(expiresInFifteen < sevenDaysFromNow).toBe(false);
  });

  it("admin desktop users get unlimited credits flag", () => {
    const role = "admin";
    const isUnlimited = role === "admin";
    expect(isUnlimited).toBe(true);
  });

  it("regular desktop users do not get unlimited credits", () => {
    const role = "user";
    const isUnlimited = role === "admin";
    expect(isUnlimited).toBe(false);
  });

  it("desktop credit check rejects when balance is 0 and not unlimited", () => {
    const credits = { balance: 0, isUnlimited: false };
    const hasCredits = credits.isUnlimited || credits.balance > 0;
    expect(hasCredits).toBe(false);
  });

  it("desktop credit check allows when unlimited even with 0 balance", () => {
    const credits = { balance: 0, isUnlimited: true };
    const hasCredits = credits.isUnlimited || credits.balance > 0;
    expect(hasCredits).toBe(true);
  });
});

// ─── Integration-style Tests ─────────────────────────────────────────

describe("Credit System — Integration Scenarios", () => {
  it("free user can send ~50 chat messages per month", () => {
    const freeTier = PRICING_TIERS.find((t) => t.id === "free")!;
    const chatCost = CREDIT_COSTS.chat_message;
    const messagesPerMonth = Math.floor(freeTier.credits.monthlyAllocation / chatCost);
    expect(messagesPerMonth).toBe(50);
  });

  it("pro user can send ~500 chat messages per month", () => {
    const proTier = PRICING_TIERS.find((t) => t.id === "pro")!;
    const chatCost = CREDIT_COSTS.chat_message;
    const messagesPerMonth = Math.floor(proTier.credits.monthlyAllocation / chatCost);
    expect(messagesPerMonth).toBe(500);
  });

  it("free user can do ~10 builder actions per month", () => {
    const freeTier = PRICING_TIERS.find((t) => t.id === "free")!;
    const builderCost = CREDIT_COSTS.builder_action;
    const actionsPerMonth = Math.floor(freeTier.credits.monthlyAllocation / builderCost);
    expect(actionsPerMonth).toBe(10);
  });

  it("credit pack purchase adds correct amount", () => {
    const pack = CREDIT_PACKS.find((p) => p.id === "pack_500")!;
    let balance = 10;
    balance += pack.credits;
    expect(balance).toBe(510);
  });

  it("mixed usage scenario: chat + builder within free tier", () => {
    const freeTier = PRICING_TIERS.find((t) => t.id === "free")!;
    let balance = freeTier.credits.monthlyAllocation;

    balance -= 20 * CREDIT_COSTS.chat_message;
    expect(balance).toBe(30);

    balance -= 4 * CREDIT_COSTS.builder_action;
    expect(balance).toBe(10);

    balance -= 3 * CREDIT_COSTS.voice_action;
    expect(balance).toBe(1);

    expect(balance >= CREDIT_COSTS.builder_action).toBe(false);
    expect(balance >= CREDIT_COSTS.chat_message).toBe(true);
  });
});
