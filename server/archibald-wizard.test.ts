import { describe, it, expect } from "vitest";

/**
 * Server-side tests for Archibald wizard configuration.
 * The component itself is a React component tested via the frontend,
 * but we validate the data structures and tip configurations here.
 */

// Simulate the PAGE_TIPS structure from the component
const PAGE_TIPS: Record<string, string[]> = {
  "/": [
    "Welcome to Archibald Titan! I'm Archibald, your magical guide. Let me show you around!",
    "Titan is the world's most advanced local AI agent. Download it free and take control of your digital life!",
    "Tip: Scroll down to see all the incredible features Titan offers — from credential management to AI-powered automation.",
    "Ready to get started? Click 'Download Free' or sign in to access your dashboard!",
  ],
  "/dashboard": [
    "Welcome back! I'm Archibald, your magical assistant. Ask me anything!",
    "Tip: You can talk to Titan AI right here in the chat. Try asking about your credentials!",
    "Did you know? Titan can auto-fetch credentials from 50+ providers. Try 'New Fetch'!",
    "Pro tip: Set up Auto-Sync to keep your credentials fresh automatically.",
  ],
  "/fetcher/new": [
    "Starting a new fetch? I can help! Just pick a provider and enter your credentials.",
    "Tip: Use Smart Fetch AI for intelligent credential extraction.",
    "Remember: Your credentials are encrypted end-to-end. Even I can't see them!",
  ],
  "/fetcher/credentials": [
    "Your credential vault — all your secrets, safely stored.",
    "Tip: Use the search bar to quickly find any credential.",
    "Pro tip: Set up expiry alerts so you never get caught off guard!",
  ],
  "/fetcher/killswitch": [
    "The Kill Switch — for when things go sideways. Use with caution!",
    "This will immediately halt all automated processes. Only use in emergencies.",
  ],
  "/grants": [
    "Looking for funding? I'll help you find the perfect grants for your business!",
    "Tip: Use filters to narrow down grants by industry, amount, and deadline.",
    "Pro tip: Save grants you're interested in and I'll remind you before deadlines!",
  ],
  "/affiliate": [
    "Your affiliate empire starts here! Track all your partner programs.",
    "Tip: Check which programs are approved and start embedding your links!",
  ],
};

const IDLE_MESSAGES = [
  "Need help? Click me!",
  "I sense you might need assistance...",
  "Having a magical day?",
  "Click me for a tip!",
  "I'm here if you need me!",
  "Anything I can help with?",
  "Let's make some magic happen!",
];

const GREETINGS = [
  "Greetings, fellow wizard!",
  "Ah, you've returned!",
  "Welcome to the realm of Titan!",
  "At your service, master!",
  "The stars align for great things today!",
];

describe("Archibald Wizard Configuration", () => {
  it("should have tips for all major pages", () => {
    const requiredPages = ["/", "/dashboard", "/fetcher/new", "/fetcher/credentials", "/grants", "/affiliate"];
    for (const page of requiredPages) {
      expect(PAGE_TIPS[page]).toBeDefined();
      expect(PAGE_TIPS[page].length).toBeGreaterThan(0);
    }
  });

  it("should have non-empty tips for each page", () => {
    for (const [page, tips] of Object.entries(PAGE_TIPS)) {
      for (const tip of tips) {
        expect(tip.length).toBeGreaterThan(10);
        expect(tip.trim()).toBe(tip); // No leading/trailing whitespace
      }
    }
  });

  it("should have idle messages as fallback", () => {
    expect(IDLE_MESSAGES.length).toBeGreaterThan(3);
    for (const msg of IDLE_MESSAGES) {
      expect(msg.length).toBeGreaterThan(5);
    }
  });

  it("should have greeting messages", () => {
    expect(GREETINGS.length).toBeGreaterThan(2);
    for (const greeting of GREETINGS) {
      expect(greeting.length).toBeGreaterThan(5);
    }
  });

  it("should have kill switch page tips with warning tone", () => {
    const killSwitchTips = PAGE_TIPS["/fetcher/killswitch"];
    expect(killSwitchTips).toBeDefined();
    // At least one tip should mention caution or emergency
    const hasWarning = killSwitchTips.some(
      (tip) => tip.toLowerCase().includes("caution") || tip.toLowerCase().includes("emergency")
    );
    expect(hasWarning).toBe(true);
  });

  it("should not have duplicate tips within the same page", () => {
    for (const [page, tips] of Object.entries(PAGE_TIPS)) {
      const uniqueTips = new Set(tips);
      expect(uniqueTips.size).toBe(tips.length);
    }
  });

  it("should have unique greeting messages", () => {
    const uniqueGreetings = new Set(GREETINGS);
    expect(uniqueGreetings.size).toBe(GREETINGS.length);
  });
});
