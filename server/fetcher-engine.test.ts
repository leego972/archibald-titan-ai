import { describe, expect, it, vi } from "vitest";

// ─── Browser Module Tests ─────────────────────────────────────────────
describe("fetcher-engine/browser", () => {
  it("exports getRandomProfile that returns a valid device profile", async () => {
    const { getRandomProfile } = await import("./fetcher-engine/browser");
    const profile = getRandomProfile();
    expect(profile).toBeDefined();
    expect(profile.name).toBeTruthy();
    expect(profile.userAgent).toBeTruthy();
    expect(profile.viewport).toBeDefined();
    expect(profile.viewport.width).toBeGreaterThan(0);
    expect(profile.viewport.height).toBeGreaterThan(0);
    expect(profile.locale).toBeTruthy();
    expect(profile.timezoneId).toBeTruthy();
    expect(profile.platform).toBeTruthy();
    expect(profile.screenSize.width).toBeGreaterThan(0);
    expect(profile.screenSize.height).toBeGreaterThan(0);
  });

  it("getRandomProfile returns one of the predefined profiles", async () => {
    const { getRandomProfile } = await import("./fetcher-engine/browser");
    const validNames = [
      "Windows Chrome Desktop",
      "MacOS Chrome Desktop",
      "Windows Firefox Desktop",
      "MacOS Safari Desktop",
    ];
    const profile = getRandomProfile();
    expect(validNames).toContain(profile.name);
  });

  it("humanDelay waits at least the minimum time", async () => {
    const { humanDelay } = await import("./fetcher-engine/browser");
    const start = Date.now();
    await humanDelay(50, 100);
    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThanOrEqual(40); // small tolerance
  });

  it("BrowserConfig interface accepts proxy settings", async () => {
    const { launchStealthBrowser } = await import("./fetcher-engine/browser");
    // Just verify the function exists and is callable
    expect(typeof launchStealthBrowser).toBe("function");
  });
});

// ─── CAPTCHA Solver Module Tests ──────────────────────────────────────
describe("fetcher-engine/captcha-solver", () => {
  it("exports detectAndSolveCaptcha function", async () => {
    const { detectAndSolveCaptcha } = await import("./fetcher-engine/captcha-solver");
    expect(typeof detectAndSolveCaptcha).toBe("function");
  });

  it("exports detectBotProtection function", async () => {
    const { detectBotProtection } = await import("./fetcher-engine/captcha-solver");
    expect(typeof detectBotProtection).toBe("function");
  });

  it("CaptchaConfig type accepts valid service values", async () => {
    const config: import("./fetcher-engine/captcha-solver").CaptchaConfig = {
      service: "2captcha",
      apiKey: "test-key-123",
    };
    expect(config.service).toBe("2captcha");
    expect(config.apiKey).toBe("test-key-123");
  });

  it("CaptchaConfig type accepts null service", async () => {
    const config: import("./fetcher-engine/captcha-solver").CaptchaConfig = {
      service: null,
      apiKey: "",
    };
    expect(config.service).toBeNull();
  });
});

// ─── Providers Module Tests ───────────────────────────────────────────
describe("fetcher-engine/providers", () => {
  it("exports automateProvider function", async () => {
    const { automateProvider } = await import("./fetcher-engine/providers");
    expect(typeof automateProvider).toBe("function");
  });

  it("AutomationResult interface has correct shape", async () => {
    const result: import("./fetcher-engine/providers").AutomationResult = {
      success: true,
      credentials: [
        { keyType: "api_key", value: "test-key", label: "Test Key" },
      ],
    };
    expect(result.success).toBe(true);
    expect(result.credentials).toHaveLength(1);
    expect(result.credentials[0].keyType).toBe("api_key");
  });

  it("AutomationResult can represent failure", async () => {
    const result: import("./fetcher-engine/providers").AutomationResult = {
      success: false,
      credentials: [],
      error: "Login failed",
    };
    expect(result.success).toBe(false);
    expect(result.credentials).toHaveLength(0);
    expect(result.error).toBe("Login failed");
  });
});

// ─── Executor Module Tests ────────────────────────────────────────────
describe("fetcher-engine/executor", () => {
  it("exports executeJob function", async () => {
    const { executeJob } = await import("./fetcher-engine/executor");
    expect(typeof executeJob).toBe("function");
  }, 30000);

  it("exports abortJob function", async () => {
    const { abortJob } = await import("./fetcher-engine/executor");
    expect(typeof abortJob).toBe("function");
  }, 30000);

  it("exports isJobRunning function", async () => {
    const { isJobRunning } = await import("./fetcher-engine/executor");
    expect(typeof isJobRunning).toBe("function");
  });

  it("isJobRunning returns false for non-existent job", async () => {
    const { isJobRunning } = await import("./fetcher-engine/executor");
    expect(isJobRunning(99999)).toBe(false);
  });

  it("abortJob does not throw for non-existent job", async () => {
    const { abortJob } = await import("./fetcher-engine/executor");
    expect(() => abortJob(99999)).not.toThrow();
  });
});

// ─── Encryption Tests ─────────────────────────────────────────────────
describe("fetcher-db encryption", () => {
  it("encrypt and decrypt round-trip correctly", async () => {
    const { encrypt, decrypt } = await import("./fetcher-db");
    const original = "my-secret-api-key-12345";
    const encrypted = encrypt(original);
    expect(encrypted).not.toBe(original);
    expect(encrypted).toContain(":");
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(original);
  });

  it("encrypt produces different ciphertext each time (random IV)", async () => {
    const { encrypt } = await import("./fetcher-db");
    const text = "same-input-text";
    const enc1 = encrypt(text);
    const enc2 = encrypt(text);
    expect(enc1).not.toBe(enc2);
  });

  it("decrypt fails on tampered ciphertext", async () => {
    const { encrypt, decrypt } = await import("./fetcher-db");
    const encrypted = encrypt("test");
    const parts = encrypted.split(":");
    parts[2] = parts[2].replace(/[0-9a-f]/, "0"); // tamper
    expect(() => decrypt(parts.join(":"))).toThrow();
  });
});

// ─── Shared Provider Config Tests ─────────────────────────────────────
describe("shared/fetcher PROVIDERS", () => {
  it("has at least 15 providers", async () => {
    const { PROVIDERS } = await import("../shared/fetcher");
    expect(Object.keys(PROVIDERS).length).toBeGreaterThanOrEqual(15);
  });

  it("each provider has required fields", async () => {
    const { PROVIDERS } = await import("../shared/fetcher");
    for (const [id, provider] of Object.entries(PROVIDERS)) {
      expect(provider.id).toBe(id);
      expect(provider.name).toBeTruthy();
      expect(provider.loginUrl).toBeTruthy();
      expect(provider.keysUrl).toBeTruthy();
      expect(provider.category).toBeTruthy();
      expect(Array.isArray(provider.keyTypes)).toBe(true);
      expect(provider.keyTypes.length).toBeGreaterThan(0);
    }
  });

  it("includes GoDaddy provider", async () => {
    const { PROVIDERS } = await import("../shared/fetcher");
    expect(PROVIDERS["godaddy"]).toBeDefined();
    expect(PROVIDERS["godaddy"].name).toBe("GoDaddy");
  });

  it("includes OpenAI provider", async () => {
    const { PROVIDERS } = await import("../shared/fetcher");
    expect(PROVIDERS["openai"]).toBeDefined();
    expect(PROVIDERS["openai"].name).toBe("OpenAI");
  });
});
