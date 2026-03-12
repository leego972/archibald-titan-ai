/**
 * Mock for the `ssh2` native module.
 * Used in test environments where ssh2 is not installed.
 * The evilginx-router uses ssh2 for Titan-tier SSH connections to VPS.
 */

class MockSSHClient {
  connect(_config: unknown) {}
  exec(_cmd: string, _opts: unknown, _callback?: unknown) {}
  end() {}
  on(_event: string, _listener: unknown) { return this; }
  once(_event: string, _listener: unknown) { return this; }
  removeListener(_event: string, _listener: unknown) { return this; }
}

export const Client = MockSSHClient;
export default { Client: MockSSHClient };
