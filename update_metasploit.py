import re

with open('/home/ubuntu/archibald-titan-ai/server/metasploit-router.ts', 'r') as f:
    content = f.read()

# Add import for titan-server
if 'import { getTitanServerConfig }' not in content:
    content = content.replace('import { consumeCredits } from "./credit-service";', 
                              'import { consumeCredits } from "./credit-service";\nimport { getTitanServerConfig, execSSHCommand as execTitanSSH } from "./titan-server";')

# Update getSshConfig to fall back to Titan Server
old_get_ssh = """async function getSshConfig(userId: number) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
  const result = await db
    .select()
    .from(userSecrets)
    .where(and(eq(userSecrets.userId, userId), eq(userSecrets.secretType, "__metasploit_ssh")))
    .limit(1);
  if (result.length === 0) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "No Metasploit server configured. Please set up your SSH connection first.",
    });
  }
  return JSON.parse(decrypt(result[0].encryptedValue)) as SSHConfig;
}"""

new_get_ssh = """async function getSshConfig(userId: number) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
  const result = await db
    .select()
    .from(userSecrets)
    .where(and(eq(userSecrets.userId, userId), eq(userSecrets.secretType, "__metasploit_ssh")))
    .limit(1);
  
  if (result.length === 0) {
    // Fallback to shared Titan Server if configured
    const titanConfig = getTitanServerConfig();
    if (titanConfig) {
      return titanConfig;
    }
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "No Metasploit server configured. Please set up your SSH connection first.",
    });
  }
  return JSON.parse(decrypt(result[0].encryptedValue)) as SSHConfig;
}"""

content = content.replace(old_get_ssh, new_get_ssh)

# Update execMsfConsole to use titan exec if it's the titan server
old_exec_msf = """async function execMsfConsole(ssh: SSHConfig, command: string, timeoutMs = 30000): Promise<string> {
  // Run a single msfconsole command non-interactively using -x flag
  const safeCmd = command.replace(/'/g, "'\\\\''");
  const msfCmd = `msfconsole -q -x '${safeCmd}; exit' 2>/dev/null`;
  return execSSHCommand(ssh, msfCmd, timeoutMs);
}"""

new_exec_msf = """async function execMsfConsole(ssh: SSHConfig, command: string, timeoutMs = 30000, userId?: number): Promise<string> {
  // Run a single msfconsole command non-interactively using -x flag
  const safeCmd = command.replace(/'/g, "'\\\\''");
  const msfCmd = `msfconsole -q -x '${safeCmd}; exit' 2>/dev/null`;
  
  if ((ssh as any).isTitanServer && userId) {
    return execTitanSSH(ssh as any, msfCmd, timeoutMs, userId);
  }
  return execSSHCommand(ssh, msfCmd, timeoutMs);
}"""

content = content.replace(old_exec_msf, new_exec_msf)

# Update all calls to execMsfConsole to pass ctx.user.id
content = re.sub(r'execMsfConsole\(([^,]+),\s*([^,]+)\)', r'execMsfConsole(\1, \2, 30000, ctx.user.id)', content)
content = re.sub(r'execMsfConsole\(([^,]+),\s*([^,]+),\s*([^)]+)\)', r'execMsfConsole(\1, \2, \3, ctx.user.id)', content)

with open('/home/ubuntu/archibald-titan-ai/server/metasploit-router.ts', 'w') as f:
    f.write(content)
