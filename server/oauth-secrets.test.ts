import { describe, it, expect } from "vitest";

describe("OAuth Secrets Validation", () => {
  it("should have GITHUB_CLIENT_ID set", () => {
    const val = process.env.GITHUB_CLIENT_ID;
    expect(val).toBeTruthy();
    expect(val!.startsWith("Ov")).toBe(true);
  });

  it("should have GITHUB_CLIENT_SECRET set", () => {
    const val = process.env.GITHUB_CLIENT_SECRET;
    expect(val).toBeTruthy();
    expect(val!.length).toBeGreaterThan(20);
  });

  it("should have GOOGLE_CLIENT_ID set", () => {
    const val = process.env.GOOGLE_CLIENT_ID;
    expect(val).toBeTruthy();
    expect(val!.includes(".apps.googleusercontent.com")).toBe(true);
  });

  it("should have GOOGLE_CLIENT_SECRET set", () => {
    const val = process.env.GOOGLE_CLIENT_SECRET;
    expect(val).toBeTruthy();
    expect(val!.startsWith("GOCSPX-")).toBe(true);
  });
});
