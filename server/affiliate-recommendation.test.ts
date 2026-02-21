import { describe, it, expect } from "vitest";
import {
  detectProjectDomains,
  generateRecommendationContext,
  getAffiliateRecommendationContext,
} from "./affiliate-recommendation-engine";
import type { Message } from "./_core/llm";

describe("Affiliate Recommendation Engine", () => {
  describe("detectProjectDomains", () => {
    it("detects finance domain from crypto keywords", () => {
      const messages: Message[] = [
        { role: "user", content: "I want to build a crypto trading bot" },
      ];
      const domains = detectProjectDomains(messages, "How do I connect to the Binance API?");
      expect(domains.length).toBeGreaterThan(0);
      const financeDomain = domains.find(d => d.domain === "finance");
      expect(financeDomain).toBeDefined();
      expect(financeDomain!.confidence).toBeGreaterThan(0.3);
      expect(financeDomain!.keywords).toContain("crypto");
    });

    it("detects web development domain", () => {
      const messages: Message[] = [
        { role: "user", content: "I need to deploy my React website" },
      ];
      const domains = detectProjectDomains(messages, "What hosting should I use for a Next.js app?");
      const webDomain = domains.find(d => d.domain === "web_development");
      expect(webDomain).toBeDefined();
      expect(webDomain!.confidence).toBeGreaterThan(0.3);
    });

    it("detects security domain from VPN keywords", () => {
      const messages: Message[] = [];
      const domains = detectProjectDomains(messages, "I need a VPN for secure research and privacy");
      const secDomain = domains.find(d => d.domain === "security");
      expect(secDomain).toBeDefined();
      expect(secDomain!.keywords).toContain("vpn");
    });

    it("detects AI/ML domain", () => {
      const messages: Message[] = [
        { role: "user", content: "I'm training a machine learning model for image recognition" },
      ];
      const domains = detectProjectDomains(messages, "What GPU cloud should I use?");
      const aiDomain = domains.find(d => d.domain === "ai_ml");
      expect(aiDomain).toBeDefined();
      expect(aiDomain!.confidence).toBeGreaterThan(0.3);
    });

    it("detects multiple domains when keywords overlap", () => {
      const messages: Message[] = [
        { role: "user", content: "I'm building a web app with AI features and need to deploy it" },
      ];
      const domains = detectProjectDomains(messages, "I need hosting for my AI-powered website");
      expect(domains.length).toBeGreaterThanOrEqual(2);
    });

    it("returns empty array for generic messages", () => {
      const messages: Message[] = [];
      const domains = detectProjectDomains(messages, "Hello, how are you?");
      // Generic greetings shouldn't trigger any domain
      const highConfidence = domains.filter(d => d.confidence >= 0.3);
      expect(highConfidence.length).toBe(0);
    });

    it("ignores assistant messages for domain detection", () => {
      const messages: Message[] = [
        { role: "assistant", content: "I can help you with crypto trading and blockchain development" },
      ];
      const domains = detectProjectDomains(messages, "What's the weather like?");
      // Assistant messages should not contribute to domain detection
      const financeDomain = domains.find(d => d.domain === "finance" && d.confidence >= 0.3);
      expect(financeDomain).toBeUndefined();
    });

    it("detects marketing domain", () => {
      const messages: Message[] = [];
      const domains = detectProjectDomains(messages, "I need to improve my SEO and run email marketing campaigns");
      const mktDomain = domains.find(d => d.domain === "marketing");
      expect(mktDomain).toBeDefined();
      expect(mktDomain!.confidence).toBeGreaterThan(0.3);
    });

    it("detects education domain", () => {
      const messages: Message[] = [];
      const domains = detectProjectDomains(messages, "I want to create an online course platform with certification");
      const eduDomain = domains.find(d => d.domain === "education");
      expect(eduDomain).toBeDefined();
    });
  });

  describe("generateRecommendationContext", () => {
    it("returns null for empty domains", () => {
      const result = generateRecommendationContext([], "test message");
      expect(result).toBeNull();
    });

    it("returns null for low-confidence domains", () => {
      const result = generateRecommendationContext(
        [{ domain: "finance", confidence: 0.1, keywords: ["budget"] }],
        "test"
      );
      expect(result).toBeNull();
    });

    it("generates context for high-confidence finance domain", () => {
      const result = generateRecommendationContext(
        [{ domain: "finance", confidence: 0.8, keywords: ["crypto", "trading"] }],
        "I need to connect to exchange APIs"
      );
      expect(result).not.toBeNull();
      expect(result).toContain("CONTEXTUAL EXPERTISE");
      expect(result).toContain("Binance");
      expect(result).toContain("NEVER say");
      expect(result).toContain("industry knowledge");
    });

    it("generates context for web development domain", () => {
      const result = generateRecommendationContext(
        [{ domain: "web_development", confidence: 0.9, keywords: ["website", "deploy", "hosting"] }],
        "Where should I host my app?"
      );
      expect(result).not.toBeNull();
      expect(result).toContain("Hostinger");
      expect(result).toContain("DigitalOcean");
    });

    it("generates context for security domain", () => {
      const result = generateRecommendationContext(
        [{ domain: "security", confidence: 0.8, keywords: ["vpn", "privacy"] }],
        "I need a VPN"
      );
      expect(result).not.toBeNull();
      expect(result).toContain("NordVPN");
    });

    it("includes affiliate URLs in recommendations", () => {
      const result = generateRecommendationContext(
        [{ domain: "finance", confidence: 0.8, keywords: ["crypto"] }],
        "crypto exchange"
      );
      expect(result).not.toBeNull();
      expect(result).toContain("utm_source=archibaldtitan");
    });

    it("limits to max 2 domains", () => {
      const result = generateRecommendationContext(
        [
          { domain: "finance", confidence: 0.9, keywords: ["crypto"] },
          { domain: "web_development", confidence: 0.8, keywords: ["website"] },
          { domain: "security", confidence: 0.7, keywords: ["vpn"] },
        ],
        "test"
      );
      expect(result).not.toBeNull();
      // Should contain at most 2 domain sections
      const sectionMatches = result!.match(/### For .* projects:/g);
      expect(sectionMatches).not.toBeNull();
      expect(sectionMatches!.length).toBeLessThanOrEqual(2);
    });

    it("includes anti-pushy instructions", () => {
      const result = generateRecommendationContext(
        [{ domain: "web_development", confidence: 0.8, keywords: ["website"] }],
        "build a website"
      );
      expect(result).not.toBeNull();
      expect(result).toContain("Never be pushy");
      expect(result).toContain("Maximum 1-2 recommendations per response");
      expect(result).toContain("insider knowledge");
    });
  });

  describe("getAffiliateRecommendationContext (integration)", () => {
    it("returns recommendations for finance-related conversation", () => {
      const messages: Message[] = [
        { role: "user", content: "I'm building a DeFi application on Ethereum" },
        { role: "assistant", content: "Great! I can help you with that." },
      ];
      const result = getAffiliateRecommendationContext(messages, "What exchange should I integrate with?");
      expect(result).not.toBeNull();
      expect(result).toContain("Finance");
    });

    it("returns recommendations for web dev conversation", () => {
      const messages: Message[] = [
        { role: "user", content: "I need to build and deploy a React application" },
      ];
      const result = getAffiliateRecommendationContext(messages, "What's the best hosting for Node.js?");
      expect(result).not.toBeNull();
      expect(result).toContain("Web Development");
    });

    it("returns null for casual conversation", () => {
      const messages: Message[] = [
        { role: "user", content: "Hey" },
        { role: "assistant", content: "Hello! How can I help?" },
      ];
      const result = getAffiliateRecommendationContext(messages, "What's your name?");
      expect(result).toBeNull();
    });

    it("returns recommendations for security conversation", () => {
      const messages: Message[] = [];
      const result = getAffiliateRecommendationContext(
        messages,
        "I need to set up a VPN and password manager for my security research lab"
      );
      expect(result).not.toBeNull();
      expect(result).toContain("Security");
    });

    it("returns recommendations for AI/ML conversation", () => {
      const messages: Message[] = [
        { role: "user", content: "I want to build a chatbot using GPT and add text-to-speech" },
      ];
      const result = getAffiliateRecommendationContext(messages, "What's the best AI voice API?");
      expect(result).not.toBeNull();
      expect(result).toContain("AI");
    });
  });
});
