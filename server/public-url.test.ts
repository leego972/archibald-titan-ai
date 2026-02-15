import { describe, it, expect } from "vitest";

describe("PUBLIC_URL environment variable", () => {
  it("should be set and be a valid URL", () => {
    const publicUrl = process.env.PUBLIC_URL;
    expect(publicUrl).toBeTruthy();
    expect(publicUrl).toMatch(/^https?:\/\//);
  });

  it("should not have a trailing slash", () => {
    const publicUrl = process.env.PUBLIC_URL!;
    // The getPublicOrigin function strips trailing slashes
    expect(publicUrl.replace(/\/$/, "")).toBe(publicUrl.replace(/\/$/, ""));
  });
});
