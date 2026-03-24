/**
 * useCyberMcpScan
 * ─────────────────────────────────────────────────────────────────────────────
 * React hook for the CyberMCP full security scan with real-time SSE progress.
 * Connects to /api/cybermcp-scan/stream and emits per-check progress events.
 *
 * Usage:
 *   const { start, cancel, isScanning, checks, finalResult, error } = useCyberMcpScan();
 *   start({ endpoint, method, authToken, paramName });
 */
import { useState, useRef, useCallback } from "react";

export type CheckStatus = "pending" | "running" | "done" | "error";

export interface CheckProgress {
  key: string;
  label: string;
  status: CheckStatus;
  result?: any;
  index: number;
}

export interface FinalScanResult {
  scanResults: Record<string, any>;
  overallRisk: string;
  duration: number;
  scannedAt: string;
}

export interface ScanParams {
  endpoint: string;
  method: "GET" | "POST";
  authToken?: string;
  paramName?: string;
}

const CHECK_LABELS: Record<string, string> = {
  securityHeaders: "Security Headers",
  authBypass:      "Auth Bypass",
  sqlInjection:    "SQL Injection",
  xss:             "XSS Detection",
  sensitiveData:   "Sensitive Data",
};

const INITIAL_CHECKS: CheckProgress[] = [
  { key: "securityHeaders", label: "Security Headers", status: "pending", index: 0 },
  { key: "authBypass",      label: "Auth Bypass",      status: "pending", index: 1 },
  { key: "sqlInjection",    label: "SQL Injection",    status: "pending", index: 2 },
  { key: "xss",             label: "XSS Detection",    status: "pending", index: 3 },
  { key: "sensitiveData",   label: "Sensitive Data",   status: "pending", index: 4 },
];

export interface UseCyberMcpScanReturn {
  start: (params: ScanParams) => void;
  cancel: () => void;
  isScanning: boolean;
  checks: CheckProgress[];
  finalResult: FinalScanResult | null;
  error: string | null;
  reset: () => void;
}

export function useCyberMcpScan(): UseCyberMcpScanReturn {
  const [isScanning, setIsScanning] = useState(false);
  const [checks, setChecks] = useState<CheckProgress[]>(INITIAL_CHECKS);
  const [finalResult, setFinalResult] = useState<FinalScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const esRef = useRef<EventSource | null>(null);

  const cancel = useCallback(() => {
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }
    setIsScanning(false);
  }, []);

  const reset = useCallback(() => {
    cancel();
    setChecks(INITIAL_CHECKS.map(c => ({ ...c })));
    setFinalResult(null);
    setError(null);
  }, [cancel]);

  const start = useCallback((params: ScanParams) => {
    // Cancel any existing scan
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }

    // Reset state
    setChecks(INITIAL_CHECKS.map(c => ({ ...c })));
    setFinalResult(null);
    setError(null);
    setIsScanning(true);

    // Build URL
    const qs = new URLSearchParams({
      endpoint: params.endpoint,
      method: params.method,
      ...(params.authToken ? { authToken: params.authToken } : {}),
      ...(params.paramName ? { paramName: params.paramName } : {}),
    });
    const url = `/api/cybermcp-scan/stream?${qs.toString()}`;

    const es = new EventSource(url);
    esRef.current = es;

    es.addEventListener("start", () => {
      // Scan started — all checks are pending
    });

    es.addEventListener("progress", (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data) as {
          check: string;
          status: "running" | "done" | "error";
          result?: any;
          index: number;
        };
        setChecks(prev =>
          prev.map(c =>
            c.key === data.check
              ? { ...c, status: data.status, result: data.result }
              : c
          )
        );
      } catch { /* ignore parse errors */ }
    });

    es.addEventListener("complete", (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data) as FinalScanResult;
        setFinalResult(data);
      } catch { /* ignore */ }
      setIsScanning(false);
      es.close();
      esRef.current = null;
    });

    es.addEventListener("error", (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data) as { message: string };
        setError(data.message);
      } catch {
        setError("Scan failed — connection error");
      }
      setIsScanning(false);
      es.close();
      esRef.current = null;
    });

    // Network-level error (e.g. 401, 402)
    es.onerror = () => {
      if (es.readyState === EventSource.CLOSED) {
        if (isScanning) {
          setError("Connection closed unexpectedly");
        }
        setIsScanning(false);
        esRef.current = null;
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { start, cancel, isScanning, checks, finalResult, error, reset };
}
