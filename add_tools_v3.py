"""
Add new tool definitions to chat-tools.ts in the correct location:
1. Tool definitions go BEFORE the TITAN_TOOLS array
2. Tool names get added to TITAN_TOOLS and EXTERNAL_BUILD_TOOLS arrays
"""

tools_file = "/home/ubuntu/archibald-titan-ai/server/chat-tools.ts"

with open(tools_file, "r") as f:
    lines = f.readlines()

# New tool definitions to insert before TITAN_TOOLS
new_tool_definitions = """\n// ─── NEW TITAN PLATFORM TOOLS ─────────────────────────────────────────────

export const evilginxConnectTool: Tool = {
  type: "function",
  function: {
    name: "evilginx_connect",
    description: "Connect to the local Evilginx3 server and check its status.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
  },
};

export const metasploitTestConnectionTool: Tool = {
  type: "function",
  function: {
    name: "metasploit_test_connection",
    description: "Test SSH connection to a Metasploit server.",
    parameters: {
      type: "object",
      properties: {
        host: { type: "string", description: "The SSH host" },
        port: { type: "number", description: "The SSH port (default 22)" },
        username: { type: "string", description: "The SSH username" },
        password: { type: "string", description: "The SSH password (optional)" },
        privateKey: { type: "string", description: "The SSH private key (optional)" },
      },
      required: ["host", "username"],
    },
  },
};

export const argusTestConnectionTool: Tool = {
  type: "function",
  function: {
    name: "argus_test_connection",
    description: "Test SSH connection to an Argus server.",
    parameters: {
      type: "object",
      properties: {
        host: { type: "string", description: "The SSH host" },
        port: { type: "number", description: "The SSH port (default 22)" },
        username: { type: "string", description: "The SSH username" },
        password: { type: "string", description: "The SSH password (optional)" },
        privateKey: { type: "string", description: "The SSH private key (optional)" },
      },
      required: ["host", "username"],
    },
  },
};

export const astraTestConnectionTool: Tool = {
  type: "function",
  function: {
    name: "astra_test_connection",
    description: "Test SSH connection to an Astra server.",
    parameters: {
      type: "object",
      properties: {
        host: { type: "string", description: "The SSH host" },
        port: { type: "number", description: "The SSH port (default 22)" },
        username: { type: "string", description: "The SSH username" },
        authType: { type: "string", enum: ["password", "key"], description: "Authentication type" },
        password: { type: "string", description: "The SSH password (optional)" },
        privateKey: { type: "string", description: "The SSH private key (optional)" },
        astraPort: { type: "number", description: "The Astra port (default 8094)" },
      },
      required: ["host", "username", "authType"],
    },
  },
};

export const blackeyeTestConnectionTool: Tool = {
  type: "function",
  function: {
    name: "blackeye_test_connection",
    description: "Test SSH connection to a BlackEye server.",
    parameters: {
      type: "object",
      properties: {
        host: { type: "string", description: "The SSH host" },
        port: { type: "number", description: "The SSH port (default 22)" },
        username: { type: "string", description: "The SSH username" },
        password: { type: "string", description: "The SSH password (optional)" },
        privateKey: { type: "string", description: "The SSH private key (optional)" },
      },
      required: ["host", "username"],
    },
  },
};

export const contentCreatorGetCampaignsTool: Tool = {
  type: "function",
  function: {
    name: "content_creator_get_campaigns",
    description: "Get a list of content creator campaigns.",
    parameters: {
      type: "object",
      properties: {
        status: { type: "string", enum: ["draft", "active", "paused", "completed", "archived"], description: "Filter by status" },
        limit: { type: "number", description: "Max number of campaigns to return" },
      },
      required: [],
    },
  },
};

export const siteMonitorListSitesTool: Tool = {
  type: "function",
  function: {
    name: "site_monitor_list_sites",
    description: "List all monitored sites.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
  },
};

export const totpVaultListTool: Tool = {
  type: "function",
  function: {
    name: "totp_vault_list",
    description: "List all TOTP vault entries and generate current codes.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
  },
};

export const voiceTranscribeTool: Tool = {
  type: "function",
  function: {
    name: "voice_transcribe",
    description: "Transcribe an audio file from a URL.",
    parameters: {
      type: "object",
      properties: {
        audioUrl: { type: "string", description: "The URL of the audio file" },
        language: { type: "string", description: "The language code (optional)" },
        prompt: { type: "string", description: "Optional prompt to guide transcription" },
      },
      required: ["audioUrl"],
    },
  },
};

export const replicateListProjectsTool: Tool = {
  type: "function",
  function: {
    name: "replicate_list_projects",
    description: "List all replicate projects.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
  },
};

export const seoGetHealthScoreTool: Tool = {
  type: "function",
  function: {
    name: "seo_get_health_score",
    description: "Get the SEO health score and issues.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
  },
};

export const advertisingGetStrategyTool: Tool = {
  type: "function",
  function: {
    name: "advertising_get_strategy",
    description: "Get the full advertising strategy overview.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
  },
};

export const affiliateGetStatsTool: Tool = {
  type: "function",
  function: {
    name: "affiliate_get_stats",
    description: "Get affiliate program statistics.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
  },
};

export const grantListTool: Tool = {
  type: "function",
  function: {
    name: "grant_list",
    description: "List grant opportunities.",
    parameters: {
      type: "object",
      properties: {
        region: { type: "string", description: "Filter by region" },
        agency: { type: "string", description: "Filter by agency" },
        search: { type: "string", description: "Search term" },
      },
      required: [],
    },
  },
};

export const storageGetStatsTool: Tool = {
  type: "function",
  function: {
    name: "storage_get_stats",
    description: "Get storage usage statistics.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
  },
};

export const marketplaceBrowseTool: Tool = {
  type: "function",
  function: {
    name: "marketplace_browse",
    description: "Browse marketplace listings.",
    parameters: {
      type: "object",
      properties: {
        category: { type: "string", description: "Filter by category" },
        search: { type: "string", description: "Search term" },
        limit: { type: "number", description: "Max number of listings to return" },
      },
      required: [],
    },
  },
};

export const cybermcpTestBasicAuthTool: Tool = {
  type: "function",
  function: {
    name: "cybermcp_test_basic_auth",
    description: "Test basic authentication against an endpoint.",
    parameters: {
      type: "object",
      properties: {
        endpoint: { type: "string", description: "The URL to test" },
        username: { type: "string", description: "The username" },
        password: { type: "string", description: "The password" },
        method: { type: "string", enum: ["GET", "POST", "PUT", "DELETE", "PATCH"], description: "HTTP method" },
      },
      required: ["endpoint", "username", "password"],
    },
  },
};

"""

tool_names = [
    "evilginxConnectTool",
    "metasploitTestConnectionTool",
    "argusTestConnectionTool",
    "astraTestConnectionTool",
    "blackeyeTestConnectionTool",
    "contentCreatorGetCampaignsTool",
    "siteMonitorListSitesTool",
    "totpVaultListTool",
    "voiceTranscribeTool",
    "replicateListProjectsTool",
    "seoGetHealthScoreTool",
    "advertisingGetStrategyTool",
    "affiliateGetStatsTool",
    "grantListTool",
    "storageGetStatsTool",
    "marketplaceBrowseTool",
    "cybermcpTestBasicAuthTool",
]

# Find the line with TITAN_TOOLS
titan_tools_line = None
for i, line in enumerate(lines):
    if "export const TITAN_TOOLS: Tool[] = [" in line:
        titan_tools_line = i
        break

if titan_tools_line is None:
    print("ERROR: Could not find TITAN_TOOLS")
    exit(1)

print(f"TITAN_TOOLS at line {titan_tools_line + 1}")

# Find the closing bracket of TITAN_TOOLS
titan_tools_end = None
for i in range(titan_tools_line + 1, len(lines)):
    if lines[i].strip() == "];":
        titan_tools_end = i
        break

print(f"TITAN_TOOLS ends at line {titan_tools_end + 1}")

# Find the closing bracket of EXTERNAL_BUILD_TOOLS
external_build_line = None
for i, line in enumerate(lines):
    if "export const EXTERNAL_BUILD_TOOLS: Tool[] = [" in line:
        external_build_line = i
        break

print(f"EXTERNAL_BUILD_TOOLS at line {external_build_line + 1}")

external_build_end = None
for i in range(external_build_line + 1, len(lines)):
    if lines[i].strip() == "];":
        external_build_end = i
        break

print(f"EXTERNAL_BUILD_TOOLS ends at line {external_build_end + 1}")

# Insert tool definitions before TITAN_TOOLS
new_def_lines = new_tool_definitions.splitlines(keepends=True)
lines = lines[:titan_tools_line] + new_def_lines + lines[titan_tools_line:]

# Recalculate positions after insertion
offset = len(new_def_lines)
titan_tools_end += offset
external_build_end += offset

# Add tool names to TITAN_TOOLS (before its closing bracket)
tool_additions = ["  // New Titan Platform Tools\n"] + [f"  {name},\n" for name in tool_names]
lines = lines[:titan_tools_end] + tool_additions + lines[titan_tools_end:]

# Recalculate positions
offset2 = len(tool_additions)
external_build_end += offset2

# Add tool names to EXTERNAL_BUILD_TOOLS (before its closing bracket)
lines = lines[:external_build_end] + tool_additions + lines[external_build_end:]

with open(tools_file, "w") as f:
    f.writelines(lines)

print("Successfully updated chat-tools.ts!")
