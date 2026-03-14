with open('/home/ubuntu/archibald-titan-ai/server/astra-router.ts', 'r') as f:
    content = f.read()

# Check if import was added
if 'import { getTitanServerConfig' not in content:
    # Add import - find the consumeCredits import
    if 'import { consumeCredits }' in content:
        content = content.replace(
            'import { consumeCredits } from "./credit-service";',
            'import { consumeCredits } from "./credit-service";\nimport { getTitanServerConfig, execSSHCommand as execTitanSSH } from "./titan-server";'
        )
    else:
        # Add after logAdminAction import
        content = content.replace(
            'import { logAdminAction } from "./admin-activity-log";',
            'import { logAdminAction } from "./admin-activity-log";\nimport { getTitanServerConfig, execSSHCommand as execTitanSSH } from "./titan-server";'
        )

# Fix the execAstraApi function signature - add userId parameter
old_sig = """async function execAstraApi(
  ssh: SSHConfig,
  path: string,
  method: "GET" | "POST",
  body?: object,
  timeoutMs = 60000
): Promise<{ status: number; data: any }> {"""

new_sig = """async function execAstraApi(
  ssh: SSHConfig,
  path: string,
  method: "GET" | "POST",
  body?: object,
  timeoutMs = 60000,
  userId?: number
): Promise<{ status: number; data: any }> {"""

content = content.replace(old_sig, new_sig)

with open('/home/ubuntu/archibald-titan-ai/server/astra-router.ts', 'w') as f:
    f.write(content)

print("Done")
