with open('/home/ubuntu/archibald-titan-ai/server/astra-router.ts', 'r') as f:
    content = f.read()

# The function is named astraApiCall, not execAstraApi
# Fix the signature to add userId
old_sig = """async function astraApiCall(
  ssh: SSHConfig,
  path: string,
  method: "GET" | "POST",
  body?: object,
  timeoutMs = 60000
): Promise<{ status: number; data: any }> {"""

new_sig = """async function astraApiCall(
  ssh: SSHConfig,
  path: string,
  method: "GET" | "POST",
  body?: object,
  timeoutMs = 60000,
  userId?: number
): Promise<{ status: number; data: any }> {"""

content = content.replace(old_sig, new_sig)

# Also add the import if not present
if 'import { getTitanServerConfig' not in content:
    content = content.replace(
        'import { logAdminAction } from "./admin-activity-log";',
        'import { logAdminAction } from "./admin-activity-log";\nimport { getTitanServerConfig, execSSHCommand as execTitanSSH } from "./titan-server";'
    )

with open('/home/ubuntu/archibald-titan-ai/server/astra-router.ts', 'w') as f:
    f.write(content)

print("Done")
