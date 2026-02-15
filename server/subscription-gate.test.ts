import { describe, expect, it } from "vitest";
import {
  getAllowedProviders,
  isFeatureAllowed,
  getAllowedExportFormats,
  enforceExportFormat,
  enforceFeature,
} from "./subscription-gate";
import { PRICING_TIERS, type PlanId } from "../shared/pricing";

// ─── getAllowedProviders ──────────────────────────────────────────

describe("getAllowedProviders", () => {
  it("returns limited provider list for free plan", () => {
    const providers = getAllowedProviders("free");
    expect(providers).not.toBeNull();
    expect(providers).toEqual(["aws", "azure", "gcp"]);
    expect(providers!.length).toBe(3);
  });

  it("returns null (all providers) for pro plan", () => {
    const providers = getAllowedProviders("pro");
    expect(providers).toBeNull();
  });

  it("returns null (all providers) for enterprise plan", () => {
    const providers = getAllowedProviders("enterprise");
    expect(providers).toBeNull();
  });
});

// ─── isFeatureAllowed ─────────────────────────────────────────────

describe("isFeatureAllowed", () => {
  it("blocks captcha_solving for free plan", () => {
    expect(isFeatureAllowed("free", "captcha_solving")).toBe(false);
  });

  it("allows captcha_solving for pro plan", () => {
    expect(isFeatureAllowed("pro", "captcha_solving")).toBe(true);
  });

  it("allows captcha_solving for enterprise plan", () => {
    expect(isFeatureAllowed("enterprise", "captcha_solving")).toBe(true);
  });

  it("blocks kill_switch for free plan", () => {
    expect(isFeatureAllowed("free", "kill_switch")).toBe(false);
  });

  it("allows kill_switch for pro plan", () => {
    expect(isFeatureAllowed("pro", "kill_switch")).toBe(true);
  });

  it("blocks team_management for free plan", () => {
    expect(isFeatureAllowed("free", "team_management")).toBe(false);
  });

  it("blocks team_management for pro plan", () => {
    expect(isFeatureAllowed("pro", "team_management")).toBe(false);
  });

  it("allows team_management for enterprise plan", () => {
    expect(isFeatureAllowed("enterprise", "team_management")).toBe(true);
  });

  it("blocks api_access for free plan", () => {
    expect(isFeatureAllowed("free", "api_access")).toBe(false);
  });

  it("allows api_access for pro and enterprise plans", () => {
    expect(isFeatureAllowed("pro", "api_access")).toBe(true);
    expect(isFeatureAllowed("enterprise", "api_access")).toBe(true);
  });

  it("blocks sso_saml for free and pro plans", () => {
    expect(isFeatureAllowed("free", "sso_saml")).toBe(false);
    expect(isFeatureAllowed("pro", "sso_saml")).toBe(false);
  });

  it("allows sso_saml for enterprise plan", () => {
    expect(isFeatureAllowed("enterprise", "sso_saml")).toBe(true);
  });

  it("blocks audit_logs for free and pro plans", () => {
    expect(isFeatureAllowed("free", "audit_logs")).toBe(false);
    expect(isFeatureAllowed("pro", "audit_logs")).toBe(false);
  });

  it("allows audit_logs for enterprise plan", () => {
    expect(isFeatureAllowed("enterprise", "audit_logs")).toBe(true);
  });

  it("allows unknown features for all plans (default open)", () => {
    expect(isFeatureAllowed("free", "some_unknown_feature")).toBe(true);
    expect(isFeatureAllowed("pro", "some_unknown_feature")).toBe(true);
    expect(isFeatureAllowed("enterprise", "some_unknown_feature")).toBe(true);
  });

  it("blocks scheduled_fetches for free plan", () => {
    expect(isFeatureAllowed("free", "scheduled_fetches")).toBe(false);
  });

  it("allows scheduled_fetches for pro plan", () => {
    expect(isFeatureAllowed("pro", "scheduled_fetches")).toBe(true);
  });

  it("blocks proxy_pool for free plan", () => {
    expect(isFeatureAllowed("free", "proxy_pool")).toBe(false);
  });

  it("allows proxy_pool for pro plan", () => {
    expect(isFeatureAllowed("pro", "proxy_pool")).toBe(true);
  });
});

// ─── getAllowedExportFormats ──────────────────────────────────────

describe("getAllowedExportFormats", () => {
  it("returns only json for free plan", () => {
    const formats = getAllowedExportFormats("free");
    expect(formats).toEqual(["json"]);
  });

  it("returns json and env for pro plan", () => {
    const formats = getAllowedExportFormats("pro");
    expect(formats).toEqual(["json", "env"]);
  });

  it("returns all formats for enterprise plan", () => {
    const formats = getAllowedExportFormats("enterprise");
    expect(formats).toEqual(["json", "env", "csv", "api"]);
  });
});

// ─── enforceExportFormat ─────────────────────────────────────────

describe("enforceExportFormat", () => {
  it("allows json export for free plan", () => {
    expect(() => enforceExportFormat("free", "json")).not.toThrow();
  });

  it("blocks env export for free plan", () => {
    expect(() => enforceExportFormat("free", "env")).toThrow();
  });

  it("allows env export for pro plan", () => {
    expect(() => enforceExportFormat("pro", "env")).not.toThrow();
  });

  it("blocks csv export for free plan", () => {
    expect(() => enforceExportFormat("free", "csv")).toThrow();
  });

  it("blocks csv export for pro plan", () => {
    expect(() => enforceExportFormat("pro", "csv")).toThrow();
  });

  it("allows csv export for enterprise plan", () => {
    expect(() => enforceExportFormat("enterprise", "csv")).not.toThrow();
  });

  it("blocks api export for free and pro plans", () => {
    expect(() => enforceExportFormat("free", "api")).toThrow();
    expect(() => enforceExportFormat("pro", "api")).toThrow();
  });

  it("allows api export for enterprise plan", () => {
    expect(() => enforceExportFormat("enterprise", "api")).not.toThrow();
  });
});

// ─── enforceFeature ──────────────────────────────────────────────

describe("enforceFeature", () => {
  it("throws FORBIDDEN for free plan accessing kill_switch", () => {
    expect(() => enforceFeature("free", "kill_switch", "Kill Switch")).toThrow(
      /not available on the Free plan/
    );
  });

  it("does not throw for pro plan accessing kill_switch", () => {
    expect(() => enforceFeature("pro", "kill_switch", "Kill Switch")).not.toThrow();
  });

  it("throws FORBIDDEN for pro plan accessing team_management", () => {
    expect(() => enforceFeature("pro", "team_management", "Team Management")).toThrow(
      /not available on the Pro plan/
    );
  });

  it("does not throw for enterprise plan accessing team_management", () => {
    expect(() => enforceFeature("enterprise", "team_management", "Team Management")).not.toThrow();
  });

  it("does not throw for unknown features", () => {
    expect(() => enforceFeature("free", "unknown_feature", "Unknown")).not.toThrow();
  });
});

// ─── PRICING_TIERS configuration integrity ───────────────────────

describe("PRICING_TIERS configuration", () => {
  it("has exactly 3 tiers", () => {
    expect(PRICING_TIERS).toHaveLength(3);
  });

  it("has free, pro, and enterprise tiers in order", () => {
    expect(PRICING_TIERS[0].id).toBe("free");
    expect(PRICING_TIERS[1].id).toBe("pro");
    expect(PRICING_TIERS[2].id).toBe("enterprise");
  });

  it("free tier has $0 pricing", () => {
    const free = PRICING_TIERS[0];
    expect(free.monthlyPrice).toBe(0);
    expect(free.yearlyPrice).toBe(0);
  });

  it("pro tier is highlighted", () => {
    const pro = PRICING_TIERS[1];
    expect(pro.highlighted).toBe(true);
  });

  it("enterprise tier has unlimited fetches", () => {
    const enterprise = PRICING_TIERS[2];
    expect(enterprise.limits.fetchesPerMonth).toBe(-1);
  });

  it("free tier has limited fetches", () => {
    const free = PRICING_TIERS[0];
    expect(free.limits.fetchesPerMonth).toBe(5);
  });

  it("pro tier has unlimited fetches", () => {
    const pro = PRICING_TIERS[1];
    expect(pro.limits.fetchesPerMonth).toBe(-1);
  });

  it("free tier has 0 proxy slots", () => {
    const free = PRICING_TIERS[0];
    expect(free.limits.proxySlots).toBe(0);
  });

  it("pro tier has 5 proxy slots", () => {
    const pro = PRICING_TIERS[1];
    expect(pro.limits.proxySlots).toBe(5);
  });

  it("enterprise tier has unlimited proxy slots", () => {
    const enterprise = PRICING_TIERS[2];
    expect(enterprise.limits.proxySlots).toBe(-1);
  });

  it("each tier has non-empty features list", () => {
    for (const tier of PRICING_TIERS) {
      expect(tier.features.length).toBeGreaterThan(0);
    }
  });

  it("each tier has a CTA label", () => {
    for (const tier of PRICING_TIERS) {
      expect(tier.cta).toBeTruthy();
    }
  });

  it("yearly price is less than 12x monthly for paid tiers", () => {
    const pro = PRICING_TIERS[1];
    expect(pro.yearlyPrice).toBeLessThan(pro.monthlyPrice * 12);
    const enterprise = PRICING_TIERS[2];
    expect(enterprise.yearlyPrice).toBeLessThan(enterprise.monthlyPrice * 12);
  });
});

// ─── Plan hierarchy ──────────────────────────────────────────────

describe("Plan hierarchy enforcement", () => {
  const plans: PlanId[] = ["free", "pro", "enterprise"];

  it("enterprise has strictly more export formats than pro", () => {
    const proFormats = getAllowedExportFormats("pro");
    const entFormats = getAllowedExportFormats("enterprise");
    expect(entFormats.length).toBeGreaterThan(proFormats.length);
    // All pro formats should be in enterprise
    for (const fmt of proFormats) {
      expect(entFormats).toContain(fmt);
    }
  });

  it("pro has strictly more export formats than free", () => {
    const freeFormats = getAllowedExportFormats("free");
    const proFormats = getAllowedExportFormats("pro");
    expect(proFormats.length).toBeGreaterThan(freeFormats.length);
    for (const fmt of freeFormats) {
      expect(proFormats).toContain(fmt);
    }
  });

  it("free plan has the most restrictions", () => {
    // Free should have limited providers
    expect(getAllowedProviders("free")).not.toBeNull();
    // Pro and enterprise should have all providers
    expect(getAllowedProviders("pro")).toBeNull();
    expect(getAllowedProviders("enterprise")).toBeNull();
  });

  it("pro features are a subset of enterprise features", () => {
    const proFeatures = ["captcha_solving", "kill_switch", "scheduled_fetches", "proxy_pool", "env_export"];
    for (const feature of proFeatures) {
      expect(isFeatureAllowed("enterprise", feature)).toBe(true);
    }
  });
});
