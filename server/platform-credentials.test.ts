import { describe, it, expect } from "vitest";

describe("Platform API Credentials", () => {
  // Mastodon
  describe("Mastodon", () => {
    it("should have MASTODON_ACCESS_TOKEN set", () => {
      expect(process.env.MASTODON_ACCESS_TOKEN).toBeTruthy();
    });

    it("should verify credentials with Mastodon API", async () => {
      const token = process.env.MASTODON_ACCESS_TOKEN;
      const instanceUrl = (process.env.MASTODON_INSTANCE_URL || "https://mastodon.social").replace(/\/$/, "");
      
      const response = await fetch(`${instanceUrl}/api/v1/accounts/verify_credentials`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(response.ok).toBe(true);
      const data = await response.json() as any;
      expect(data.username).toBe("archibaldtitan");
    });
  });

  // Telegram
  describe("Telegram", () => {
    it("should have TELEGRAM_BOT_TOKEN set", () => {
      expect(process.env.TELEGRAM_BOT_TOKEN).toBeTruthy();
    });

    it("should have TELEGRAM_CHANNEL_ID set", () => {
      expect(process.env.TELEGRAM_CHANNEL_ID).toBeTruthy();
    });

    it("should verify bot with Telegram API", async () => {
      const token = process.env.TELEGRAM_BOT_TOKEN;
      const response = await fetch(`https://api.telegram.org/bot${token}/getMe`);
      expect(response.ok).toBe(true);
      const data = await response.json() as any;
      expect(data.ok).toBe(true);
      expect(data.result.username).toBe("ArchibaldTitanBot");
    });
  });

  // Hashnode
  describe("Hashnode", () => {
    it("should have HASHNODE_API_TOKEN set", () => {
      expect(process.env.HASHNODE_API_TOKEN).toBeTruthy();
    });

    it("should have HASHNODE_PUBLICATION_ID set", () => {
      expect(process.env.HASHNODE_PUBLICATION_ID).toBeTruthy();
      expect(process.env.HASHNODE_PUBLICATION_ID).toBe("699411c798e55bf8fd36e420");
    });

    it("should verify credentials with Hashnode API", async () => {
      const token = process.env.HASHNODE_API_TOKEN;
      const response = await fetch("https://gql.hashnode.com/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: token!,
        },
        body: JSON.stringify({ query: "{ me { id username } }" }),
      });
      expect(response.ok).toBe(true);
      const data = await response.json() as any;
      expect(data.data.me.username).toBe("archibaldtitan");
    });
  });
});
