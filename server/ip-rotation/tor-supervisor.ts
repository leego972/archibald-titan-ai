/**
 * Tor Supervisor
 *
 * Production-quality Tor daemon management:
 * - Supervised process with automatic restart on crash
 * - Bootstrap progress monitoring
 * - Exit IP verification after NEWNYM
 * - Circuit health polling every 2 minutes
 * - Graceful shutdown with cleanup
 * - Exponential backoff on repeated failures
 */

import { spawn, exec } from "child_process";
import { promisify } from "util";
import * as fs from "fs";
import * as net from "net";
import { createLogger } from "../_core/logger.js";

const execAsync = promisify(exec);
const log = createLogger("TorSupervisor");

export type TorState = "stopped" | "installing" | "starting" | "bootstrapping" | "running" | "restarting" | "error";

export interface TorStatus {
  state: TorState;
  bootstrapPercent: number;
  exitIp: string | null;
  circuitCount: number;
  uptime: number | null; // seconds
  restartCount: number;
  lastError: string | null;
  socksPort: number;
}

const SOCKS_PORT = 9150;
const CONTROL_PORT = 9151;
const TOR_DATA_DIR = "/tmp/titan-tor";
const TORRC_PATH = "/tmp/titan-torrc";
const MAX_RESTART_ATTEMPTS = 5;
const RESTART_BACKOFF_BASE_MS = 3000;
const BOOTSTRAP_TIMEOUT_MS = 90000;
const HEALTH_CHECK_INTERVAL_MS = 120000; // 2 minutes

const TORRC = `
SocksPort ${SOCKS_PORT} IsolateDestAddr IsolateDestPort
ControlPort ${CONTROL_PORT}
DataDirectory ${TOR_DATA_DIR}
CookieAuthentication 0
HashedControlPassword ""
# Circuit settings
NumEntryGuards 3
NumDirectoryGuards 3
CircuitBuildTimeout 20
MaxCircuitDirtiness 300
NewCircuitPeriod 60
NumPreemptiveCircuits 4
# Only use fast, stable relays
StrictNodes 0
# Logging
Log notice stderr
SafeLogging 1
# Reduce startup time
LearnCircuitBuildTimeout 0
`.trim();

class TorSupervisor {
  private process: ReturnType<typeof spawn> | null = null;
  private state: TorState = "stopped";
  private bootstrapPercent = 0;
  private exitIp: string | null = null;
  private circuitCount = 0;
  private startedAt: number | null = null;
  private restartCount = 0;
  private lastError: string | null = null;
  private healthCheckTimer: ReturnType<typeof setInterval> | null = null;
  private bootstrapTimer: ReturnType<typeof setTimeout> | null = null;
  private shouldRun = false;
  private bootstrapResolve: ((ok: boolean) => void) | null = null;

  getStatus(): TorStatus {
    return {
      state: this.state,
      bootstrapPercent: this.bootstrapPercent,
      exitIp: this.exitIp,
      circuitCount: this.circuitCount,
      uptime: this.startedAt ? Math.floor((Date.now() - this.startedAt) / 1000) : null,
      restartCount: this.restartCount,
      lastError: this.lastError,
      socksPort: SOCKS_PORT,
    };
  }

  isReady(): boolean { return this.state === "running"; }
  isStarting(): boolean { return ["installing", "starting", "bootstrapping"].includes(this.state); }
  getSocksPort(): number { return SOCKS_PORT; }

  async start(): Promise<{ success: boolean; message: string }> {
    if (this.state === "running") return { success: true, message: "Tor already running" };
    if (this.isStarting()) return { success: false, message: "Tor is already starting up..." };

    this.shouldRun = true;
    this.restartCount = 0;
    return this._doStart();
  }

  async stop(): Promise<void> {
    this.shouldRun = false;
    this._clearTimers();
    if (this.process) {
      try { this.process.kill("SIGTERM"); } catch {}
      await new Promise(r => setTimeout(r, 1000));
      try { this.process.kill("SIGKILL"); } catch {}
      this.process = null;
    }
    this.state = "stopped";
    this.bootstrapPercent = 0;
    this.exitIp = null;
    this.startedAt = null;
    log.info("Tor stopped");
  }

  private async _doStart(): Promise<{ success: boolean; message: string }> {
    this.state = "installing";
    this.bootstrapPercent = 0;
    this.lastError = null;

    // Ensure tor is installed
    try {
      await execAsync("which tor");
    } catch {
      log.info("Installing Tor...");
      try {
        await execAsync("apt-get update -qq && apt-get install -y -qq tor 2>&1 | tail -5");
      } catch (e: any) {
        this.state = "error";
        this.lastError = `Failed to install Tor: ${e.message}`;
        return { success: false, message: this.lastError };
      }
    }

    // Write torrc and create data dir
    fs.mkdirSync(TOR_DATA_DIR, { recursive: true });
    fs.writeFileSync(TORRC_PATH, TORRC);

    // Kill any stale tor process on our ports
    try { await execAsync(`fuser -k ${SOCKS_PORT}/tcp 2>/dev/null || true`); } catch {}
    try { await execAsync(`fuser -k ${CONTROL_PORT}/tcp 2>/dev/null || true`); } catch {}
    await new Promise(r => setTimeout(r, 800));

    this.state = "starting";

    // Spawn tor
    this.process = spawn("tor", ["-f", TORRC_PATH], {
      detached: false,
      stdio: ["ignore", "pipe", "pipe"],
    });

    this.process.stderr?.on("data", (data: Buffer) => {
      this._handleTorOutput(data.toString());
    });

    this.process.stdout?.on("data", (data: Buffer) => {
      this._handleTorOutput(data.toString());
    });

    this.process.on("exit", (code, signal) => {
      log.info(`Tor process exited (code=${code}, signal=${signal})`);
      const wasRunning = this.state === "running";
      this.state = "stopped";
      this.startedAt = null;
      this.process = null;
      this._clearTimers();

      if (this.shouldRun && this.restartCount < MAX_RESTART_ATTEMPTS) {
        const delay = RESTART_BACKOFF_BASE_MS * Math.pow(2, this.restartCount);
        this.restartCount++;
        this.state = "restarting";
        log.info(`Tor crashed — restarting in ${delay}ms (attempt ${this.restartCount}/${MAX_RESTART_ATTEMPTS})`);
        setTimeout(() => {
          if (this.shouldRun) this._doStart();
        }, delay);
      } else if (this.restartCount >= MAX_RESTART_ATTEMPTS) {
        this.state = "error";
        this.lastError = "Tor failed to stay running after maximum restart attempts";
        log.error(this.lastError);
      }
    });

    this.process.on("error", (err) => {
      this.lastError = err.message;
      log.error(`Tor process error: ${err.message}`);
    });

    // Wait for bootstrap
    this.state = "bootstrapping";
    const bootstrapped = await this._waitForBootstrap();

    if (!bootstrapped) {
      this.lastError = "Tor failed to bootstrap within timeout";
      this.state = "error";
      return { success: false, message: this.lastError };
    }

    this.state = "running";
    this.startedAt = Date.now();
    log.info("Tor bootstrapped and running");

    // Verify exit IP
    this._refreshExitIp();

    // Start health check loop
    this._startHealthCheck();

    return { success: true, message: "Tor started and bootstrapped successfully" };
  }

  private _handleTorOutput(output: string): void {
    for (const line of output.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // Bootstrap progress
      const bootstrapMatch = trimmed.match(/Bootstrapped (\d+)%/);
      if (bootstrapMatch) {
        this.bootstrapPercent = parseInt(bootstrapMatch[1]);
        if (this.bootstrapPercent === 100 && this.bootstrapResolve) {
          this.bootstrapResolve(true);
          this.bootstrapResolve = null;
        }
      }

      // Circuit built
      if (trimmed.includes("Circuit ") && trimmed.includes("BUILT")) {
        this.circuitCount++;
      }

      // Errors
      if (trimmed.includes("[err]") || trimmed.includes("[warn]")) {
        log.warn(`Tor: ${trimmed}`);
      }
    }
  }

  private _waitForBootstrap(): Promise<boolean> {
    return new Promise((resolve) => {
      if (this.bootstrapPercent === 100) { resolve(true); return; }

      this.bootstrapResolve = resolve;
      this.bootstrapTimer = setTimeout(() => {
        if (this.bootstrapResolve) {
          this.bootstrapResolve = null;
          resolve(false);
        }
      }, BOOTSTRAP_TIMEOUT_MS);
    });
  }

  private _startHealthCheck(): void {
    this._clearTimers();
    this.healthCheckTimer = setInterval(async () => {
      if (this.state !== "running") return;
      await this._refreshExitIp();
    }, HEALTH_CHECK_INTERVAL_MS);
  }

  private async _refreshExitIp(): Promise<void> {
    try {
      const { SocksProxyAgent } = await import("socks-proxy-agent");
      const agent = new SocksProxyAgent(`socks5://127.0.0.1:${SOCKS_PORT}`);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      const res = await fetch("https://api.ipify.org?format=json", {
        signal: controller.signal,
        // @ts-ignore
        agent,
      } as any);
      clearTimeout(timeout);
      if (res.ok) {
        const data = await res.json() as { ip: string };
        const prevIp = this.exitIp;
        this.exitIp = data.ip;
        if (prevIp && prevIp !== this.exitIp) {
          log.info(`Tor exit IP changed: ${prevIp} → ${this.exitIp}`);
        } else if (!prevIp) {
          log.info(`Tor exit IP: ${this.exitIp}`);
        }
      }
    } catch (e: any) {
      log.warn(`Could not verify Tor exit IP: ${e.message}`);
    }
  }

  async requestNewCircuit(): Promise<{ success: boolean; newIp: string | null; message: string }> {
    if (!this.isReady()) {
      return { success: false, newIp: null, message: "Tor is not running" };
    }

    const prevIp = this.exitIp;
    const sent = await this._sendControlCommand("SIGNAL NEWNYM");
    if (!sent) {
      return { success: false, newIp: null, message: "Failed to send NEWNYM signal to Tor control port" };
    }

    // Wait for new circuit to be established (Tor recommends waiting at least 1s)
    await new Promise(r => setTimeout(r, 3000));
    await this._refreshExitIp();

    const changed = this.exitIp !== prevIp;
    return {
      success: true,
      newIp: this.exitIp,
      message: changed
        ? `New circuit established. IP changed: ${prevIp} → ${this.exitIp}`
        : `New circuit requested. IP may still be changing (was: ${prevIp}, now: ${this.exitIp})`,
    };
  }

  private _sendControlCommand(command: string): Promise<boolean> {
    return new Promise((resolve) => {
      const client = net.createConnection(CONTROL_PORT, "127.0.0.1", () => {
        client.write(`AUTHENTICATE ""\r\n${command}\r\nQUIT\r\n`);
      });
      let success = false;
      client.on("data", (data) => {
        if (data.toString().includes("250")) success = true;
      });
      client.on("close", () => resolve(success));
      client.on("error", () => resolve(false));
      setTimeout(() => { client.destroy(); resolve(false); }, 5000);
    });
  }

  private _clearTimers(): void {
    if (this.healthCheckTimer) { clearInterval(this.healthCheckTimer); this.healthCheckTimer = null; }
    if (this.bootstrapTimer) { clearTimeout(this.bootstrapTimer); this.bootstrapTimer = null; }
    if (this.bootstrapResolve) { this.bootstrapResolve(false); this.bootstrapResolve = null; }
  }
}

// Singleton
export const torSupervisor = new TorSupervisor();
