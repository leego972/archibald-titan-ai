import { defineConfig } from "vitest/config";
import path from "path";

const templateRoot = path.resolve(import.meta.dirname);

export default defineConfig({
  root: templateRoot,
  resolve: {
    alias: {
      "@": path.resolve(templateRoot, "client", "src"),
      "@shared": path.resolve(templateRoot, "shared"),
      "@assets": path.resolve(templateRoot, "attached_assets"),
    },
  },
  test: {
    environment: "node",
    include: ["server/**/*.test.ts", "server/**/*.spec.ts"],
    env: {
      // Public URL — used by public-url.test.ts
      PUBLIC_URL: "https://archibaldtitan.com",
      // X (Twitter) credentials — used by x-credentials.test.ts
      X_API_KEY: "test-x-api-key",
      X_API_KEY_SECRET: "test-x-api-key-secret",
      X_ACCESS_TOKEN: "test-x-access-token",
      X_ACCESS_TOKEN_SECRET: "test-x-access-token-secret",
      X_BEARER_TOKEN: "test-x-bearer-token",
      // OAuth secrets — used by oauth-secrets.test.ts
      GITHUB_CLIENT_ID: "test-github-client-id",
      GITHUB_CLIENT_SECRET: "test-github-client-secret",
      GOOGLE_CLIENT_ID: "test-google-client-id",
      GOOGLE_CLIENT_SECRET: "test-google-client-secret",
      // Platform credentials — used by platform-credentials.test.ts
      MASTODON_ACCESS_TOKEN: "test-mastodon-token",
      TELEGRAM_BOT_TOKEN: "test-telegram-bot-token",
      TELEGRAM_CHANNEL_ID: "@test-channel",
      HASHNODE_API_TOKEN: "test-hashnode-token",
      HASHNODE_PUBLICATION_ID: "test-publication-id",
    },
  },
});
