/**
 * Sentry Server-Side Initialisation
 * Import this at the very top of server/_core/index.ts (before all other imports).
 * Set SENTRY_DSN in your environment variables to enable error reporting.
 */
import * as Sentry from "@sentry/node";

const dsn = process.env.SENTRY_DSN;
const env = process.env.NODE_ENV ?? "development";

if (dsn) {
  Sentry.init({
    dsn,
    environment: env,
    // Capture 100% of transactions in development, 10% in production
    tracesSampleRate: env === "production" ? 0.1 : 1.0,
    // Capture 100% of errors always
    sampleRate: 1.0,
    integrations: [
      Sentry.httpIntegration(),
      Sentry.expressIntegration(),
    ],
    beforeSend(event) {
      // Strip sensitive fields from request data
      if (event.request?.cookies) delete event.request.cookies;
      if (event.request?.headers?.authorization) delete event.request.headers.authorization;
      if (event.request?.headers?.cookie) delete event.request.headers.cookie;
      return event;
    },
  });
  console.log(`[Sentry] Initialised for environment: ${env}`);
} else {
  console.log("[Sentry] SENTRY_DSN not set — error reporting disabled");
}

export { Sentry };
