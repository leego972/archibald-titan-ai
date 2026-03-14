import { useEffect } from "react";

/**
 * Adds a noindex,nofollow robots meta tag to the page while the component is mounted.
 * Use this on auth/utility pages (login, register, verify-email, reset-password, etc.)
 * to prevent them from appearing in search engine results.
 */
export function useNoIndex() {
  useEffect(() => {
    // Find or create the robots meta tag
    let meta = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
    const previousContent = meta?.content ?? null;

    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "robots";
      document.head.appendChild(meta);
    }

    meta.content = "noindex, nofollow";

    return () => {
      // Restore previous value on unmount
      if (meta) {
        if (previousContent !== null) {
          meta.content = previousContent;
        } else {
          meta.remove();
        }
      }
    };
  }, []);
}
