/**
 * Unified Request Interceptor
 *
 * Priority waterfall for all Titan server-side fetch requests:
 *   1. Tor (if running) — real anonymous IP, changes every ~10 min
 *   2. Proxy Pool (if live proxies available) — real different IPs
 *   3. Header Spoofing (always available) — spoofed headers, same exit IP
 *   4. Direct (fallback) — no modification
 *
 * Features:
 * - Automatic failover: if Tor fails, falls back to proxy; if proxy fails, falls back to headers
 * - Per-request retry logic with different proxy on each retry
 * - Request timing and logging
 * - Configurable per-request layer override
 */

import { createLogger } from "../_core/logger.js";
import { torSupervisor } from "./tor-supervisor";
import { proxyPool } from "./proxy-pool";
import { getSpoofedHeadersForUrl } from "./fingerprints";

const log = createLogger("RequestInterceptor");

export type LayerUsed = "tor" | "proxy" | "headers" | "direct";

export interface InterceptedFetchOptions extends RequestInit {
  /** Override which layer to use. Default: auto (waterfall) */
  preferLayer?: "tor" | "proxy" | "headers" | "direct" | "auto";
  /** Max retries on failure. Default: 2 */
  maxRetries?: number;
  /** Whether to apply header spoofing even when using Tor/proxy. Default: true */
  alwaysSpoofHeaders?: boolean;
}

export interface InterceptedFetchResult {
  response: Response;
  layerUsed: LayerUsed;
  proxyId?: string;
  latencyMs: number;
  retries: number;
}

export interface IPRotationConfig {
  headerSpoofing: boolean;
  torEnabled: boolean;
  proxyEnabled: boolean;
}

let globalConfig: IPRotationConfig = {
  headerSpoofing: false,
  torEnabled: false,
  proxyEnabled: false,
};

export function setIPRotationConfig(config: Partial<IPRotationConfig>): void {
  globalConfig = { ...globalConfig, ...config };
}

export function getIPRotationConfig(): IPRotationConfig {
  return { ...globalConfig };
}

/**
 * The main intercepted fetch function.
 * Drop-in replacement for fetch() that applies IP rotation automatically.
 */
export async function titanFetch(
  url: string,
  options: InterceptedFetchOptions = {}
): Promise<InterceptedFetchResult> {
  const { preferLayer = "auto", maxRetries = 2, alwaysSpoofHeaders = true, ...fetchOptions } = options;
  const startTime = Date.now();
  let lastError: Error | null = null;
  let retries = 0;

  // Determine which layers to attempt, in order
  const layers = _buildLayerOrder(preferLayer);

  for (const layer of layers) {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = await _fetchWithLayer(url, fetchOptions, layer, alwaysSpoofHeaders);
        const latencyMs = Date.now() - startTime;

        if (attempt > 0 || layer !== layers[0]) {
          log.info(`[${layer}] ${url.substring(0, 60)} — ${result.response.status} (${latencyMs}ms, ${attempt} retries)`);
        }

        return { ...result, latencyMs, retries: retries + attempt };
      } catch (err: any) {
        lastError = err;
        retries++;
        if (attempt < maxRetries) {
          // Brief backoff before retry
          await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
        }
      }
    }
    // This layer exhausted — try next
    log.warn(`Layer [${layer}] failed for ${url.substring(0, 60)}: ${lastError?.message}`);
  }

  // All layers failed — throw the last error
  throw lastError || new Error("All IP rotation layers failed");
}

async function _fetchWithLayer(
  url: string,
  options: RequestInit,
  layer: LayerUsed,
  alwaysSpoofHeaders: boolean
): Promise<Omit<InterceptedFetchResult, "latencyMs" | "retries">> {
  // Build base headers (always include spoofed headers if enabled)
  const spoofedHeaders = (globalConfig.headerSpoofing || alwaysSpoofHeaders)
    ? getSpoofedHeadersForUrl(url)
    : {};

  const mergedHeaders = {
    ...spoofedHeaders,
    ...(options.headers as Record<string, string> || {}),
  };

  switch (layer) {
    case "tor": {
      if (!torSupervisor.isReady()) throw new Error("Tor not ready");
      const { SocksProxyAgent } = await import("socks-proxy-agent");
      const agent = new SocksProxyAgent(`socks5://127.0.0.1:${torSupervisor.getSocksPort()}`);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);
      try {
        const response = await fetch(url, {
          ...options,
          headers: mergedHeaders,
          signal: controller.signal,
          // @ts-ignore
          agent,
        } as any);
        clearTimeout(timeout);
        return { response, layerUsed: "tor" };
      } catch (e) {
        clearTimeout(timeout);
        throw e;
      }
    }

    case "proxy": {
      const domain = (() => { try { return new URL(url).hostname; } catch { return url; } })();
      const proxy = proxyPool.getProxyForDomain(domain);
      if (!proxy) throw new Error("No live proxies available");

      let agent: any;
      const proxyUrl = proxy.username
        ? `${proxy.protocol}://${proxy.username}:${proxy.password}@${proxy.host}:${proxy.port}`
        : `${proxy.protocol}://${proxy.host}:${proxy.port}`;

      if (proxy.protocol === "socks5" || proxy.protocol === "socks4") {
        const { SocksProxyAgent } = await import("socks-proxy-agent");
        agent = new SocksProxyAgent(proxyUrl);
      } else {
        const { HttpsProxyAgent } = await import("https-proxy-agent");
        agent = new HttpsProxyAgent(proxyUrl);
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20000);
      const start = Date.now();
      try {
        const response = await fetch(url, {
          ...options,
          headers: mergedHeaders,
          signal: controller.signal,
          // @ts-ignore
          agent,
        } as any);
        clearTimeout(timeout);
        proxyPool.reportSuccess(proxy.id, Date.now() - start);
        return { response, layerUsed: "proxy", proxyId: proxy.id };
      } catch (e) {
        clearTimeout(timeout);
        proxyPool.reportFailure(proxy.id);
        throw e;
      }
    }

    case "headers": {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20000);
      try {
        const response = await fetch(url, {
          ...options,
          headers: mergedHeaders,
          signal: controller.signal,
        });
        clearTimeout(timeout);
        return { response, layerUsed: "headers" };
      } catch (e) {
        clearTimeout(timeout);
        throw e;
      }
    }

    case "direct":
    default: {
      const response = await fetch(url, options);
      return { response, layerUsed: "direct" };
    }
  }
}

function _buildLayerOrder(preferLayer: InterceptedFetchOptions["preferLayer"]): LayerUsed[] {
  if (preferLayer !== "auto") {
    // Explicit layer requested — use it with fallback to direct
    return [preferLayer as LayerUsed, "direct"];
  }

  // Auto waterfall: use whatever is enabled and available
  const order: LayerUsed[] = [];

  if (globalConfig.torEnabled && torSupervisor.isReady()) {
    order.push("tor");
  }

  if (globalConfig.proxyEnabled) {
    const stats = proxyPool.getStats();
    if (stats.live > 0) order.push("proxy");
  }

  if (globalConfig.headerSpoofing) {
    order.push("headers");
  }

  // Always end with direct as final fallback
  order.push("direct");

  return order;
}

/**
 * Simple wrapper for when you just need the Response (no metadata).
 * Use this as a drop-in for fetch() in scraping code.
 */
export async function titanFetchSimple(url: string, options?: InterceptedFetchOptions): Promise<Response> {
  const result = await titanFetch(url, options);
  return result.response;
}
