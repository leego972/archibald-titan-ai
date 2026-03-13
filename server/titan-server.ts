import { ENV } from "./_core/env";
import { Client as SSHClient } from "ssh2";

export interface SSHConfig {
  host: string;
  port: number;
  username: string;
  password?: string;
  privateKey?: string;
  isTitanServer?: boolean;
  userDir?: string;
}

/**
 * Get the global Titan Server SSH configuration.
 * This is the fallback server used when a user hasn't configured their own VPS.
 */
export function getTitanServerConfig(): SSHConfig | null {
  if (!ENV.titanServerHost) return null;
  
  return {
    host: ENV.titanServerHost,
    port: ENV.titanServerPort || 22,
    username: ENV.titanServerUser || "root",
    password: ENV.titanServerPassword || undefined,
    privateKey: ENV.titanServerKey || undefined,
    isTitanServer: true,
  };
}

/**
 * Get the isolated directory path for a specific user on the Titan Server.
 * Format: /opt/titan/users/user_{id}
 */
export function getTitanUserDir(userId: number): string {
  return `/opt/titan/users/user_${userId}`;
}

/**
 * Execute an SSH command. If running on the Titan Server, it automatically
 * wraps the command to execute within the user's isolated directory.
 */
export async function execSSHCommand(
  ssh: SSHConfig,
  command: string,
  timeoutMs = 60000,
  userId?: number
): Promise<string> {
  return new Promise((resolve, reject) => {
    const conn = new SSHClient();
    let output = "";
    let errorOutput = "";

    const timer = setTimeout(() => {
      conn.end();
      reject(new Error(`SSH command timed out after ${timeoutMs / 1000}s`));
    }, timeoutMs);

    // If this is the shared Titan server and we have a userId, 
    // ensure the command runs in their isolated directory
    let finalCommand = command;
    if (ssh.isTitanServer && userId) {
      const userDir = getTitanUserDir(userId);
      // Create the directory if it doesn't exist, then run the command inside it
      finalCommand = `mkdir -p ${userDir} && cd ${userDir} && (${command})`;
    }

    conn
      .on("ready", () => {
        conn.exec(finalCommand, (err: Error | undefined, stream: import('ssh2').ClientChannel) => {
          if (err) {
            clearTimeout(timer);
            conn.end();
            reject(err);
            return;
          }
          stream
            .on("close", () => {
              clearTimeout(timer);
              conn.end();
              resolve(output.trim());
            })
            .on("data", (data: Buffer) => {
              output += data.toString();
            })
            .stderr.on("data", (data: Buffer) => {
              errorOutput += data.toString();
            });
        });
      })
      .on("error", (err: Error) => {
        clearTimeout(timer);
        reject(err);
      })
      .connect({
        host: ssh.host,
        port: ssh.port,
        username: ssh.username,
        password: ssh.password || undefined,
        privateKey: ssh.privateKey || undefined,
        readyTimeout: 8000,
      });
  });
}
