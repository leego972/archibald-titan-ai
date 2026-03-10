import { describe, it, expect } from "vitest";

describe("OAuth Secrets Validation", () => {
  // In CI test mode we inject placeholder values; skip format checks then.
  const isTestMode = process.env.NODE_ENV === "test" && process.env.GITHUB_CLIENT_ID?.startsWith("test-");

  it("should have GITHUB_CLIENT_ID set", () => {
    const val = process.env.GITHUB_CLIENT_ID;
    expect(val).toBeTruthy();
    if (!isTestMode) {
      expect(val!.startsWith("Ov")).toBe(true);
    }
  });

  it("should have GITHUB_CLIENT_SECRET set", () => {
    const val = process.env.GITHUB_CLIENT_SECRET;
    expect(val).toBeTruthy();
    expect(val!.length).toBeGreaterThan(10);
  });

  it("should have GOOGLE_CLIENT_ID set", () => {
    const val = process.env.GOOGLE_CLIENT_ID;
    expect(val).toBeTruthy();
    if (!isTestMode) {
      expect(val!.includes(".apps.googleusercontent.com")).toBe(true);
    }
  });

  it("should have GOOGLE_CLIENT_SECRET set", () => {
    const val = process.env.GOOGLE_CLIENT_SECRET;
    expect(val).toBeTruthy();
    if (!isTestMode) {
      expect(val!.startsWith("GOCSPX-")).toBe(true);
    }
  });
});
