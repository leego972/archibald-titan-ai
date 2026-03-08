import { trpc } from "@/lib/trpc";
import { UNAUTHED_ERR_MSG } from '@shared/const';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, TRPCClientError } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import { getLoginUrl } from "./const";
import { LanguageProvider } from "./i18n";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      networkMode: 'always',
    },
    mutations: {
      retry: false,
      networkMode: 'always',
    },
  },
});

const redirectToLoginIfUnauthorized = (error: unknown) => {
  if (!(error instanceof TRPCClientError)) return;
  if (typeof window === "undefined") return;

  const isUnauthorized = error.message === UNAUTHED_ERR_MSG;

  if (!isUnauthorized) return;

  // Don't redirect if already on login/register pages
  const path = window.location.pathname;
  if (path === "/login" || path === "/register") return;

  window.location.href = getLoginUrl(window.location.pathname);
};

queryClient.getQueryCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.query.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Query Error]", error);
  }
});

queryClient.getMutationCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.mutation.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Mutation Error]", error);
  }
});

/** Read the CSRF token from the cookie set by the server */
function getCsrfToken(): string | undefined {
  const match = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : undefined;
}

/**
 * Prime the CSRF cookie by calling the server's /api/csrf-token endpoint.
 * This is critical for Safari iOS (ITP) which may not have the cookie set
 * after an OAuth redirect. The server sets the cookie on this GET response,
 * so all subsequent tRPC POST requests will have the token available.
 */
async function primeCsrfCookie(): Promise<void> {
  // If we already have the cookie, no need to prime
  if (getCsrfToken()) return;
  try {
    await fetch('/api/csrf-token', { credentials: 'include' });
  } catch {
    // Non-fatal — the app will still work, but mutations may fail on first try
  }
}

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,
      headers() {
        const csrf = getCsrfToken();
        return csrf ? { "x-csrf-token": csrf } : {};
      },
      fetch(input, init) {
        // Use a 10-minute timeout for all tRPC requests (builder tasks can be long)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 600_000);
        // If the caller already provided a signal, chain them
        const existingSignal = init?.signal;
        if (existingSignal) {
          existingSignal.addEventListener('abort', () => controller.abort());
        }
        return globalThis.fetch(input, {
          ...(init ?? {}),
          credentials: "include",
          signal: controller.signal,
          keepalive: true,
        }).finally(() => clearTimeout(timeoutId));
      },
    }),
  ],
});

// Prime the CSRF cookie BEFORE rendering the app so that all tRPC requests
// (including the initial useQuery calls which use POST via httpBatchLink)
// have the token available. This prevents the "string did not match the
// expected pattern" error on Safari iOS after Google OAuth redirects.
primeCsrfCookie().finally(() => {
  createRoot(document.getElementById("root")!).render(
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <LanguageProvider>
          <App />
        </LanguageProvider>
      </QueryClientProvider>
    </trpc.Provider>
  );
});

// ── PWA Service Worker Registration ─────────────────────────────
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        // Check for updates every 30 minutes
        setInterval(() => reg.update(), 30 * 60 * 1000);
      })
      .catch(() => {
        // Service worker registration failed — app works fine without it
      });
  });
}
