import re

with open('/home/ubuntu/archibald-titan-ai/server/argus-router.ts', 'r') as f:
    content = f.read()

# Add import for titan-server
if 'import { getTitanServerConfig }' not in content:
    content = content.replace('import { consumeCredits } from "./credit-service";', 
                              'import { consumeCredits } from "./credit-service";\nimport { getTitanServerConfig, execSSHCommand as execTitanSSH } from "./titan-server";')

# Update getSshConfig to fall back to Titan Server
old_get_ssh = """async function getSshConfig(userId: number): Promise<SSHConfig> {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
  const result = await db.select().from(userSecrets)
    .where(and(eq(userSecrets.userId, userId), eq(userSecrets.secretType, "__argus_ssh")))
    .limit(1);
  if (result.length === 0) throw new TRPCError({ code: "BAD_REQUEST", message: "No Argus server configured. Please set up your SSH connection first." });
  const cfg = JSON.parse(decrypt(result[0].encryptedValue));
  return { host: cfg.host, port: cfg.port || 22, username: cfg.username, password: cfg.password || undefined, privateKey: cfg.privateKey || undefined, argusPort: cfg.argusPort || 8093 };
}"""

new_get_ssh = """async function getSshConfig(userId: number): Promise<SSHConfig> {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
  const result = await db.select().from(userSecrets)
    .where(and(eq(userSecrets.userId, userId), eq(userSecrets.secretType, "__argus_ssh")))
    .limit(1);
  
  if (result.length === 0) {
    // Fallback to shared Titan Server if configured
    const titanConfig = getTitanServerConfig();
    if (titanConfig) {
      return { ...titanConfig, argusPort: 8093 };
    }
    throw new TRPCError({ code: "BAD_REQUEST", message: "No Argus server configured. Please set up your SSH connection first." });
  }
  const cfg = JSON.parse(decrypt(result[0].encryptedValue));
  return { host: cfg.host, port: cfg.port || 22, username: cfg.username, password: cfg.password || undefined, privateKey: cfg.privateKey || undefined, argusPort: cfg.argusPort || 8093 };
}"""

content = content.replace(old_get_ssh, new_get_ssh)

# Update execArgusApi to use titan exec if it's the titan server
old_exec_api = """async function execArgusApi(
  ssh: SSHConfig,
  path: string,
  method: "GET" | "POST",
  body?: object,
  timeoutMs = 60000
): Promise<{ status: number; data: any }> {"""

new_exec_api = """async function execArgusApi(
  ssh: SSHConfig,
  path: string,
  method: "GET" | "POST",
  body?: object,
  timeoutMs = 60000,
  userId?: number
): Promise<{ status: number; data: any }> {"""

content = content.replace(old_exec_api, new_exec_api)

old_exec_call = """const raw = await execSSHCommand(ssh, curlCmd, timeoutMs);"""
new_exec_call = """const raw = (ssh as any).isTitanServer && userId 
    ? await execTitanSSH(ssh as any, curlCmd, timeoutMs, userId)
    : await execSSHCommand(ssh, curlCmd, timeoutMs);"""

content = content.replace(old_exec_call, new_exec_call)

# Update all calls to execArgusApi to pass ctx.user.id
content = re.sub(r'execArgusApi\(([^,]+),\s*([^,]+),\s*([^,]+)\)', r'execArgusApi(\1, \2, \3, undefined, 60000, ctx.user.id)', content)
content = re.sub(r'execArgusApi\(([^,]+),\s*([^,]+),\s*([^,]+),\s*([^,]+)\)', r'execArgusApi(\1, \2, \3, \4, 60000, ctx.user.id)', content)
content = re.sub(r'execArgusApi\(([^,]+),\s*([^,]+),\s*([^,]+),\s*([^,]+),\s*([^)]+)\)', r'execArgusApi(\1, \2, \3, \4, \5, ctx.user.id)', content)

with open('/home/ubuntu/archibald-titan-ai/server/argus-router.ts', 'w') as f:
    f.write(content)
