/**
 * Sentry Client-Side Initialisation
 * Imported by main.tsx before the React app renders.
 */
import * as Sentry from "@sentry/react";

const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
const env = import.meta.env.MODE ?? "development";

if (dsn) {
  Sentry.init({
    dsn,
    environment: env,
    tracesSampleRate: env === "production" ? 0.1 : 1.0,
    // Replay 10% of sessions, 100% of sessions with errors
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: false,
        blockAllMedia: false,
      }),
    ],
    beforeSend(event) {
      // Don't report auth errors — they are expected
      const msg = event.exception?.values?.[0]?.value ?? "";
      if (msg.includes("UNAUTHORIZED") || msg.includes("Not authenticated")) return null;
      return event;
    },
  });
}

export { Sentry };
