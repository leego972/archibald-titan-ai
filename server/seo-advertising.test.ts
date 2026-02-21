import { describe, it, expect, vi } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("SEO & Advertising Infrastructure", () => {
  // ─── index.html SEO Meta Tags ───────────────────────────────────
  describe("index.html SEO meta tags", () => {
    const indexHtml = fs.readFileSync(
      path.join(__dirname, "../client/index.html"),
      "utf-8"
    );

    it("has a descriptive title tag", () => {
      expect(indexHtml).toContain("<title>Archibald Titan");
    });

    it("has a meta description", () => {
      expect(indexHtml).toMatch(/meta name="description"/);
    });

    it("has meta keywords", () => {
      expect(indexHtml).toMatch(/meta name="keywords"/);
    });

    it("has a canonical URL", () => {
      expect(indexHtml).toMatch(/rel="canonical"/);
      expect(indexHtml).toContain("https://www.archibaldtitan.com/");
    });

    it("has robots meta tag", () => {
      expect(indexHtml).toMatch(/meta name="robots"/);
      expect(indexHtml).toContain("index, follow");
    });

    it("has theme-color meta tag", () => {
      expect(indexHtml).toMatch(/meta name="theme-color"/);
    });

    it("has Open Graph meta tags", () => {
      expect(indexHtml).toMatch(/property="og:type"/);
      expect(indexHtml).toMatch(/property="og:url"/);
      expect(indexHtml).toMatch(/property="og:title"/);
      expect(indexHtml).toMatch(/property="og:description"/);
      expect(indexHtml).toMatch(/property="og:image"/);
      expect(indexHtml).toMatch(/property="og:site_name"/);
    });

    it("has Twitter Card meta tags", () => {
      expect(indexHtml).toMatch(/name="twitter:card"/);
      expect(indexHtml).toMatch(/name="twitter:title"/);
      expect(indexHtml).toMatch(/name="twitter:description"/);
      expect(indexHtml).toMatch(/name="twitter:image"/);
    });

    it("has Google Search Console verification", () => {
      expect(indexHtml).toMatch(/name="google-site-verification"/);
    });
  });

  // ─── JSON-LD Structured Data ────────────────────────────────────
  describe("JSON-LD structured data", () => {
    const indexHtml = fs.readFileSync(
      path.join(__dirname, "../client/index.html"),
      "utf-8"
    );

    it("has Organization structured data", () => {
      expect(indexHtml).toContain('"@type": "Organization"');
      expect(indexHtml).toContain('"name": "Archibald Titan"');
    });

    it("has SoftwareApplication structured data", () => {
      expect(indexHtml).toContain('"@type": "SoftwareApplication"');
      expect(indexHtml).toContain('"applicationCategory": "DeveloperApplication"');
    });

    it("has pricing offers in structured data", () => {
      expect(indexHtml).toContain('"@type": "Offer"');
      expect(indexHtml).toContain('"Free Plan"');
      expect(indexHtml).toContain('"Pro Plan"');
      expect(indexHtml).toContain('"Enterprise Plan"');
    });

    it("has aggregate rating in structured data", () => {
      expect(indexHtml).toContain('"@type": "AggregateRating"');
    });

    it("has FAQPage structured data", () => {
      expect(indexHtml).toContain('"@type": "FAQPage"');
      expect(indexHtml).toContain('"@type": "Question"');
      expect(indexHtml).toContain('"acceptedAnswer"');
    });

    it("has feature list in structured data", () => {
      expect(indexHtml).toContain('"featureList"');
      expect(indexHtml).toContain("AES-256 encrypted vault");
    });
  });

  // ─── robots.txt ─────────────────────────────────────────────────
  describe("robots.txt", () => {
    const robotsTxt = fs.readFileSync(
      path.join(__dirname, "../client/public/robots.txt"),
      "utf-8"
    );

    it("allows crawling of public pages", () => {
      expect(robotsTxt).toContain("Allow: /");
    });

    it("disallows crawling of API routes", () => {
      expect(robotsTxt).toContain("Disallow: /api/");
    });

    it("disallows crawling of dashboard", () => {
      expect(robotsTxt).toContain("Disallow: /dashboard/");
    });

    it("references the sitemap", () => {
      expect(robotsTxt).toContain("Sitemap:");
      expect(robotsTxt).toContain("sitemap.xml");
    });
  });

  // ─── Ad Tracking Module ─────────────────────────────────────────
  describe("Ad tracking module", () => {
    const adTrackingCode = fs.readFileSync(
      path.join(__dirname, "../client/src/lib/adTracking.ts"),
      "utf-8"
    );

    it("exports initAdTracking function", () => {
      expect(adTrackingCode).toContain("export function initAdTracking");
    });

    it("exports trackSignup function", () => {
      expect(adTrackingCode).toContain("export function trackSignup");
    });

    it("exports trackPurchase function", () => {
      expect(adTrackingCode).toContain("export function trackPurchase");
    });

    it("exports trackPageView function", () => {
      expect(adTrackingCode).toContain("export function trackPageView");
    });

    it("exports trackViewContent function", () => {
      expect(adTrackingCode).toContain("export function trackViewContent");
    });

    it("exports trackDownload function", () => {
      expect(adTrackingCode).toContain("export function trackDownload");
    });

    it("supports Google Ads via VITE_GOOGLE_ADS_ID", () => {
      expect(adTrackingCode).toContain("VITE_GOOGLE_ADS_ID");
    });

    it("supports TikTok Pixel via VITE_TIKTOK_PIXEL_ID", () => {
      expect(adTrackingCode).toContain("VITE_TIKTOK_PIXEL_ID");
    });

    it("supports Snapchat Pixel via VITE_SNAP_PIXEL_ID", () => {
      expect(adTrackingCode).toContain("VITE_SNAP_PIXEL_ID");
    });

    it("tracks Google Ads conversions with send_to", () => {
      expect(adTrackingCode).toContain("send_to");
    });

    it("tracks TikTok CompleteRegistration event", () => {
      expect(adTrackingCode).toContain("CompleteRegistration");
    });

    it("tracks TikTok CompletePayment event", () => {
      expect(adTrackingCode).toContain("CompletePayment");
    });

    it("tracks Snapchat SIGN_UP event", () => {
      expect(adTrackingCode).toContain("SIGN_UP");
    });

    it("tracks Snapchat PURCHASE event", () => {
      expect(adTrackingCode).toContain("PURCHASE");
    });
  });

  // ─── Ad Tracking Integration ────────────────────────────────────
  describe("Ad tracking integration in pages", () => {
    it("App.tsx initializes ad tracking on mount", () => {
      const appCode = fs.readFileSync(
        path.join(__dirname, "../client/src/App.tsx"),
        "utf-8"
      );
      expect(appCode).toContain("initAdTracking");
    });

    it("RegisterPage tracks signup conversion", () => {
      const registerCode = fs.readFileSync(
        path.join(__dirname, "../client/src/pages/RegisterPage.tsx"),
        "utf-8"
      );
      expect(registerCode).toContain("trackSignup");
    });

    it("PricingPage tracks purchase conversion", () => {
      const pricingCode = fs.readFileSync(
        path.join(__dirname, "../client/src/pages/PricingPage.tsx"),
        "utf-8"
      );
      expect(pricingCode).toContain("trackPurchase");
    });

    it("PricingPage tracks content view", () => {
      const pricingCode = fs.readFileSync(
        path.join(__dirname, "../client/src/pages/PricingPage.tsx"),
        "utf-8"
      );
      expect(pricingCode).toContain("trackViewContent");
    });

    it("LandingPage tracks download conversion", () => {
      const landingCode = fs.readFileSync(
        path.join(__dirname, "../client/src/pages/LandingPage.tsx"),
        "utf-8"
      );
      expect(landingCode).toContain("trackDownload");
    });
  });

  // ─── Advertising Strategy Document ──────────────────────────────
  describe("Advertising strategy document", () => {
    const strategyDoc = fs.readFileSync(
      path.join(__dirname, "../ADVERTISING_STRATEGY.md"),
      "utf-8"
    );

    it("exists and has content", () => {
      expect(strategyDoc.length).toBeGreaterThan(1000);
    });

    it("specifies $500 AUD monthly budget", () => {
      expect(strategyDoc).toContain("$500 AUD");
    });

    it("allocates $300 AUD to Google Ads", () => {
      expect(strategyDoc).toContain("$300 AUD");
      expect(strategyDoc).toContain("Google Ads");
    });

    it("allocates $200 AUD to TikTok Ads", () => {
      expect(strategyDoc).toContain("$200 AUD");
      expect(strategyDoc).toContain("TikTok");
    });

    it("includes Google Ads campaign structure", () => {
      expect(strategyDoc).toContain("Ad Group 1");
      expect(strategyDoc).toContain("Ad Group 2");
      expect(strategyDoc).toContain("Ad Group 3");
    });

    it("includes TikTok creative strategy", () => {
      expect(strategyDoc).toContain("Video 1");
      expect(strategyDoc).toContain("Video 2");
      expect(strategyDoc).toContain("Video 3");
    });

    it("includes performance targets", () => {
      expect(strategyDoc).toContain("CPC");
      expect(strategyDoc).toContain("CTR");
      expect(strategyDoc).toContain("Conversion");
    });

    it("includes UTM parameter convention", () => {
      expect(strategyDoc).toContain("utm_source");
      expect(strategyDoc).toContain("utm_medium");
      expect(strategyDoc).toContain("utm_campaign");
    });

    it("mentions Snapchat campaign", () => {
      expect(strategyDoc).toContain("Snapchat");
      expect(strategyDoc).toContain("$250 AUD");
    });
  });
});
