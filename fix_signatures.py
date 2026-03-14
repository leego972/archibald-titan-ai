# Fix blackeye-router.ts
with open('/home/ubuntu/archibald-titan-ai/server/blackeye-router.ts', 'r') as f:
    content = f.read()

# Fix the corrupted function signature
content = content.replace(
    'async function execSSHCommand(\n  ssh: SSHConfig, command: string, timeoutMs = 15000\n, ctx.user.id): Promise<string> {',
    'async function execSSHCommand(\n  ssh: SSHConfig,\n  command: string,\n  timeoutMs = 20000,\n  userId?: number\n): Promise<string> {\n  if ((ssh as any).isTitanServer && userId) {\n    return execTitanSSH(ssh as any, command, timeoutMs, userId);\n  }'
)

# Fix any other corrupted signatures
content = content.replace(
    ', ctx.user.id): Promise<string> {',
    ', userId?: number\n): Promise<string> {'
)

with open('/home/ubuntu/archibald-titan-ai/server/blackeye-router.ts', 'w') as f:
    f.write(content)

# Fix metasploit-router.ts
with open('/home/ubuntu/archibald-titan-ai/server/metasploit-router.ts', 'r') as f:
    content = f.read()

# Fix the corrupted function signature
content = content.replace(
    'async function execMsfConsole(ssh: SSHConfig, command: string, timeoutMs = 30000, userId?: number, ctx.user.id): Promise<string> {',
    'async function execMsfConsole(ssh: SSHConfig, command: string, timeoutMs = 30000, userId?: number): Promise<string> {'
)

with open('/home/ubuntu/archibald-titan-ai/server/metasploit-router.ts', 'w') as f:
    f.write(content)

print("Done")
