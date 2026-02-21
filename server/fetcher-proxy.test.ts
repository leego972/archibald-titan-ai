import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  parseProxyUrl,
  PROVIDER_PROXY_REQUIREMENTS,
  RECOMMENDED_PROXY_PROVIDERS,
} from "./fetcher-engine/proxy-manager";
import { PROVIDERS } from "../shared/fetcher";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// ─── Unit Tests for parseProxyUrl ────────────────────────────────────

describe("parseProxyUrl", () => {
  it("parses http://user:pass@host:port format", () => {
    const result = parseProxyUrl("http://myuser:mypass@proxy.example.com:8080");
    expect(result).toEqual({
      protocol: "http",
      host: "proxy.example.com",
      port: 8080,
      username: "myuser",
      password: "mypass",
    });
  });

  it("parses https://host:port format without auth", () => {
    const result = parseProxyUrl("https://proxy.example.com:443");
    expect(result).toEqual({
      protocol: "https",
      host: "proxy.example.com",
      port: 443,
      username: undefined,
      password: undefined,
    });
  });

  it("parses socks5://user:pass@host:port format", () => {
    const result = parseProxyUrl("socks5://admin:secret@socks.proxy.io:1080");
    expect(result).toEqual({
      protocol: "socks5",
      host: "socks.proxy.io",
      port: 1080,
      username: "admin",
      password: "secret",
    });
  });

  it("parses host:port:user:pass format", () => {
    const result = parseProxyUrl("proxy.example.com:8080:myuser:mypass");
    expect(result).toEqual({
      protocol: "http",
      host: "proxy.example.com",
      port: 8080,
      username: "myuser",
      password: "mypass",
    });
  });

  it("parses host:port format", () => {
    const result = parseProxyUrl("proxy.example.com:8080");
    expect(result).toEqual({
      protocol: "http",
      host: "proxy.example.com",
      port: 8080,
    });
  });

  it("returns null for invalid input", () => {
    expect(parseProxyUrl("not-a-proxy")).toBeNull();
    expect(parseProxyUrl("")).toBeNull();
  });
});

// ─── Provider Proxy Requirements ─────────────────────────────────────

describe("PROVIDER_PROXY_REQUIREMENTS", () => {
  it("marks GoDaddy as requiring residential proxy", () => {
    const req = PROVIDER_PROXY_REQUIREMENTS["godaddy"];
    expect(req).toBeDefined();
    expect(req.requiresProxy).toBe(true);
    expect(req.proxyTypes).toContain("residential");
    expect(req.reason).toContain("Akamai");
  });

  it("marks Cloudflare as requiring proxy", () => {
    const req = PROVIDER_PROXY_REQUIREMENTS["cloudflare"];
    expect(req).toBeDefined();
    expect(req.requiresProxy).toBe(true);
    expect(req.proxyTypes).toContain("residential");
  });

  it("marks Google Cloud as requiring proxy", () => {
    const req = PROVIDER_PROXY_REQUIREMENTS["google_cloud"];
    expect(req).toBeDefined();
    expect(req.requiresProxy).toBe(true);
  });

  it("marks GitHub as not requiring proxy", () => {
    const req = PROVIDER_PROXY_REQUIREMENTS["github"];
    expect(req).toBeDefined();
    expect(req.requiresProxy).toBe(false);
  });

  it("marks AWS as not requiring proxy", () => {
    const req = PROVIDER_PROXY_REQUIREMENTS["aws"];
    expect(req).toBeDefined();
    expect(req.requiresProxy).toBe(false);
  });
});

// ─── Provider Config Proxy Flags ─────────────────────────────────────

describe("Provider config proxy flags", () => {
  it("all providers have requiresResidentialProxy field", () => {
    for (const [id, provider] of Object.entries(PROVIDERS)) {
      expect(provider.requiresResidentialProxy).toBeDefined();
      expect(typeof provider.requiresResidentialProxy).toBe("boolean");
      expect(provider.proxyNote).toBeDefined();
      expect(typeof provider.proxyNote).toBe("string");
      expect(provider.proxyNote.length).toBeGreaterThan(0);
    }
  });

  it("GoDaddy provider is flagged as requiring residential proxy", () => {
    expect(PROVIDERS.godaddy.requiresResidentialProxy).toBe(true);
    expect(PROVIDERS.godaddy.proxyNote).toContain("Akamai");
  });

  it("Cloudflare provider is flagged as requiring residential proxy", () => {
    expect(PROVIDERS.cloudflare.requiresResidentialProxy).toBe(true);
  });

  it("OpenAI provider is not flagged as requiring residential proxy", () => {
    expect(PROVIDERS.openai.requiresResidentialProxy).toBe(false);
  });

  it("GitHub provider is not flagged as requiring residential proxy", () => {
    expect(PROVIDERS.github.requiresResidentialProxy).toBe(false);
  });

  it("provider proxy flags are consistent with PROVIDER_PROXY_REQUIREMENTS", () => {
    for (const [id, provider] of Object.entries(PROVIDERS)) {
      const req = PROVIDER_PROXY_REQUIREMENTS[id];
      if (req) {
        expect(provider.requiresResidentialProxy).toBe(req.requiresProxy);
      }
    }
  });
});

// ─── Recommended Proxy Providers ─────────────────────────────────────

describe("RECOMMENDED_PROXY_PROVIDERS", () => {
  it("has at least 3 recommended providers", () => {
    expect(RECOMMENDED_PROXY_PROVIDERS.length).toBeGreaterThanOrEqual(3);
  });

  it("each provider has required fields", () => {
    for (const provider of RECOMMENDED_PROXY_PROVIDERS) {
      expect(provider.name).toBeDefined();
      expect(provider.url).toBeDefined();
      expect(provider.url).toMatch(/^https?:\/\//);
      expect(provider.types).toBeDefined();
      expect(provider.types.length).toBeGreaterThan(0);
      expect(provider.pricing).toBeDefined();
      expect(provider.features).toBeDefined();
      expect(provider.features.length).toBeGreaterThan(0);
      expect(provider.setupGuide).toBeDefined();
      expect(provider.setupGuide.length).toBeGreaterThan(0);
    }
  });

  it("all recommended providers include residential type", () => {
    for (const provider of RECOMMENDED_PROXY_PROVIDERS) {
      expect(provider.types).toContain("residential");
    }
  });
});

// ─── tRPC Router Tests (proxy endpoints) ─────────────────────────────

function createAuthContext(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "test-user",
      email: "test@example.com",
      name: "Test User",
      loginMethod: "manus",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

describe("fetcher.proxyRequirements tRPC endpoint", () => {
  it("returns proxy requirements for all known providers", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.fetcher.proxyRequirements();

    expect(result).toBeDefined();
    expect(result["godaddy"]).toBeDefined();
    expect(result["godaddy"].requiresProxy).toBe(true);
    expect(result["github"]).toBeDefined();
    expect(result["github"].requiresProxy).toBe(false);
  });
});

describe("fetcher.recommendedProxyProviders tRPC endpoint", () => {
  it("returns list of recommended proxy providers", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.fetcher.recommendedProxyProviders();

    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThanOrEqual(3);
    expect(result[0].name).toBeDefined();
    expect(result[0].url).toBeDefined();
  });
});

describe("fetcher.providers tRPC endpoint includes proxy info", () => {
  it("returns providers with proxy requirements", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.fetcher.providers();

    expect(result.providers).toBeDefined();
    expect(result.proxyRequirements).toBeDefined();
    expect(result.proxyRequirements["godaddy"]).toBeDefined();
  });
});
