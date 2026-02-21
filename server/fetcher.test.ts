import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user-fetcher",
    email: "test@example.com",
    name: "Test User",
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

function createUnauthContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

describe("fetcher.providers", () => {
  it("returns the list of providers", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.fetcher.providers();

    expect(result.providers).toBeDefined();
    expect(Array.isArray(result.providers)).toBe(true);
    expect(result.providers.length).toBeGreaterThanOrEqual(15);

    // Check GoDaddy is included
    const godaddy = result.providers.find((p) => p.id === "godaddy");
    expect(godaddy).toBeDefined();
    expect(godaddy?.name).toBe("GoDaddy");
    expect(godaddy?.category).toBe("domains");

    // Check OpenAI is included
    const openai = result.providers.find((p) => p.id === "openai");
    expect(openai).toBeDefined();
    expect(openai?.name).toBe("OpenAI");
  });

  it("rejects unauthenticated access", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.fetcher.providers()).rejects.toThrow();
  });
});

describe("fetcher shared types", () => {
  it("PROVIDERS has correct structure", async () => {
    const { PROVIDERS, CATEGORIES } = await import("../shared/fetcher");

    expect(Object.keys(PROVIDERS).length).toBeGreaterThanOrEqual(15);
    expect(Object.keys(CATEGORIES).length).toBeGreaterThanOrEqual(5);

    // Verify each provider has required fields
    for (const provider of Object.values(PROVIDERS)) {
      expect(provider.id).toBeTruthy();
      expect(provider.name).toBeTruthy();
      expect(provider.category).toBeTruthy();
      expect(provider.url).toBeTruthy();
      expect(provider.loginUrl).toBeTruthy();
      expect(provider.keysUrl).toBeTruthy();
      expect(Array.isArray(provider.keyTypes)).toBe(true);
      expect(provider.keyTypes.length).toBeGreaterThan(0);
      expect(provider.description).toBeTruthy();
    }
  });

  it("each provider category exists in CATEGORIES", async () => {
    const { PROVIDERS, CATEGORIES } = await import("../shared/fetcher");

    for (const provider of Object.values(PROVIDERS)) {
      expect(CATEGORIES[provider.category]).toBeDefined();
    }
  });
});

describe("fetcher encryption", () => {
  it("encrypt and decrypt round-trip", async () => {
    const { encrypt, decrypt } = await import("./fetcher-db");
    const original = "sk-test-1234567890abcdef";
    const encrypted = encrypt(original);

    // Encrypted should be different from original
    expect(encrypted).not.toBe(original);
    // Should contain the iv:tag:ciphertext format
    expect(encrypted.split(":").length).toBe(3);

    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(original);
  });

  it("different encryptions produce different ciphertexts", async () => {
    const { encrypt } = await import("./fetcher-db");
    const original = "test-api-key-12345";
    const enc1 = encrypt(original);
    const enc2 = encrypt(original);

    // Due to random IV, same plaintext should produce different ciphertexts
    expect(enc1).not.toBe(enc2);
  });
});
