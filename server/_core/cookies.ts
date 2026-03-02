import type { CookieOptions, Request } from "express";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function isIpAddress(host: string) {
  // Basic IPv4 check and IPv6 presence detection.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return true;
  return host.includes(":");
}

function isSecureRequest(req: Request) {
  if (req.protocol === "https") return true;

  const forwardedProto = req.headers["x-forwarded-proto"];
  if (!forwardedProto) return false;

  const protoList = Array.isArray(forwardedProto)
    ? forwardedProto
    : forwardedProto.split(",");

  return protoList.some(proto => proto.trim().toLowerCase() === "https");
}

/**
 * Extract the root domain for cookie sharing.
 * e.g. "www.archibaldtitan.com" → ".archibaldtitan.com"
 * This ensures cookies work on both www and non-www subdomains.
 */
function getCookieDomain(hostname: string): string | undefined {
  if (!hostname) return undefined;
  if (LOCAL_HOSTS.has(hostname)) return undefined;
  if (isIpAddress(hostname)) return undefined;

  // For archibaldtitan.com or www.archibaldtitan.com → .archibaldtitan.com
  if (hostname === "archibaldtitan.com" || hostname.endsWith(".archibaldtitan.com")) {
    return ".archibaldtitan.com";
  }

  // For other domains (e.g. Railway preview URLs), don't set domain
  return undefined;
}

export function getSessionCookieOptions(
  req: Request
): Pick<CookieOptions, "domain" | "httpOnly" | "path" | "sameSite" | "secure"> {
  const hostname = req.hostname;
  const secure = isSecureRequest(req);
  const domain = getCookieDomain(hostname);

  return {
    httpOnly: true,
    path: "/",
    // Use "lax" for same-domain flows (Railway/custom domain).
    // "lax" allows cookies on top-level navigations (OAuth redirects)
    // and is more compatible across browsers than "none".
    sameSite: "lax",
    secure,
    ...(domain ? { domain } : {}),
  };
}
