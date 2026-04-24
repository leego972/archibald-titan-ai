/**
   * TitanAI API configuration.
   *
   * In dev: Vite proxies /titan-api → the API server (configured in vite.config.ts).
   * In prod: set VITE_TITAN_API_URL to your deployed API server URL.
   *
   * Example .env entry:
   *   VITE_TITAN_API_URL=https://your-titan-api.replit.app/api-server
   */

  export const TITAN_API_BASE: string =
    (import.meta.env.VITE_TITAN_API_URL ?? "").replace(/\/$/, "") || "/titan-api";

  export const TITAN_MODEL = "titan-1b-cyber" as const;
  export const TITAN_FILM_MODEL = "titan-1b-film" as const;
  export const TITAN_MAX_STEPS = 10;
  