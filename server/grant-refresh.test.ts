import { describe, it, expect } from "vitest";
import { detectBuildIntent, REFUSAL_PHRASES, isRefusalResponse } from "./build-intent";

describe("Build Intent Detection", () => {
  it("detects 'build' keyword", () => {
    expect(detectBuildIntent("build me a hello world app", [])).toBe(true);
  });
  it("detects 'research and replicate' pattern", () => {
    expect(detectBuildIntent("research this program and replicate it for me", [])).toBe(true);
  });
  it("detects 'create' keyword", () => {
    expect(detectBuildIntent("create a new landing page", [])).toBe(true);
  });
  it("detects 'fix' keyword", () => {
    expect(detectBuildIntent("fix the bug in the login page", [])).toBe(true);
  });
  it("does not detect casual conversation", () => {
    expect(detectBuildIntent("hello how are you", [])).toBe(false);
  });
  it("does not detect simple questions", () => {
    expect(detectBuildIntent("what is the weather today", [])).toBe(false);
  });
});

describe("Refusal Detection", () => {
  it("detects 'as a large language model' refusal", () => {
    expect(isRefusalResponse("As a large language model, I don't have the capability to build software")).toBe(true);
  });
  it("detects 'I can't write code' refusal", () => {
    expect(isRefusalResponse("I can't write code or execute programs")).toBe(true);
  });
  it("does not flag normal responses", () => {
    expect(isRefusalResponse("I've created the file for you. Here's what I did:")).toBe(false);
  });
  it("REFUSAL_PHRASES is exported and populated", () => {
    expect(Array.isArray(REFUSAL_PHRASES)).toBe(true);
    expect(REFUSAL_PHRASES.length).toBeGreaterThan(5);
  });
});

describe("Grant Refresh Service Structure", () => {
  it("grant-refresh-service exports expected functions", async () => {
    const mod = await import("./grant-refresh-service");
    expect(typeof mod.refreshGrantsForCountry).toBe("function");
    expect(typeof mod.refreshAllGrants).toBe("function");
    expect(typeof mod.getMatchingGrants).toBe("function");
    expect(typeof mod.getSupportedCountries).toBe("function");
  });
  it("getSupportedCountries returns expected countries", async () => {
    const { getSupportedCountries } = await import("./grant-refresh-service");
    const countries = getSupportedCountries();
    expect(countries.length).toBeGreaterThan(0);
    expect(countries.find((c) => c.code === "US")).toBeTruthy();
    expect(countries.find((c) => c.code === "AU")).toBeTruthy();
    expect(countries.find((c) => c.code === "INTL")).toBeTruthy();
  });
  it("getSupportedCountries includes international", async () => {
    const { getSupportedCountries } = await import("./grant-refresh-service");
    const countries = getSupportedCountries();
    const intl = countries.find((c) => c.code === "INTL");
    expect(intl).toBeTruthy();
    expect(intl!.name).toBe("International");
  });
});
