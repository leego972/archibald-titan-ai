/**
   * TitanAI API configuration.
   * Set VITE_TITAN_API_URL in your .env to point to your deployed TitanAI API server.
   *
   * Example .env entry:
   *   VITE_TITAN_API_URL=https://your-titan-api.replit.app/api-server
   */

  // Replit dev domain — update to production URL after deploy
  const DEFAULT_URL =
    "https://6a5c6e25-1a7d-497f-8e00-47eb485bd67d-00-2xiavwi0pvmgb.worf.replit.dev/api-server";

  export const TITAN_API_BASE: string =
    (import.meta as any).env?.VITE_TITAN_API_URL ?? DEFAULT_URL;

  export const TITAN_MODEL = "titan-1b-cyber" as const;
  export const TITAN_FILM_MODEL = "titan-1b-film" as const;
  export const TITAN_MAX_STEPS = 10;
  