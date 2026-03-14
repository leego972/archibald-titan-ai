"""
Add new tool definitions to chat-tools.ts in the correct location:
1. Tool definitions go BEFORE the TITAN_TOOLS array
2. Tool names get added to TITAN_TOOLS, BUILDER_TOOLS, and EXTERNAL_BUILD_TOOLS arrays
"""

tools_file = "/home/ubuntu/archibald-titan-ai/server/chat-tools.ts"

with open(tools_file, "r") as f:
    content = f.read()

# New tool definitions to insert before TITAN_TOOLS
new_tool_definitions = """
// ─── NEW TITAN PLATFORM TOOLS ─────────────────────────────────────────────

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

# Insert the tool definitions BEFORE TITAN_TOOLS
titan_tools_marker = "// ─── Export All Tools ────────────────────────────────────────────────────\nexport const TITAN_TOOLS: Tool[] = ["
pos = content.find(titan_tools_marker)
if pos == -1:
    print("ERROR: Could not find TITAN_TOOLS marker")
    exit(1)

content = content[:pos] + new_tool_definitions + content[pos:]
print(f"Inserted tool definitions at position {pos}")

# Add tool names to TITAN_TOOLS array (before its closing bracket)
# Find the TITAN_TOOLS closing bracket
titan_tools_end_marker = "];\n// Focused tool subset for build/research requests"
pos = content.find(titan_tools_end_marker)
if pos == -1:
    print("ERROR: Could not find TITAN_TOOLS end marker")
    exit(1)

tool_names_str = "  // New Titan Platform Tools\n" + "".join(f"  {name},\n" for name in tool_names)
content = content[:pos] + tool_names_str + content[pos:]
print(f"Added tool names to TITAN_TOOLS at position {pos}")

# Add tool names to EXTERNAL_BUILD_TOOLS array (before its closing bracket)
external_end_marker = "  sandboxDownloadUrlTool,\n];"
pos = content.find(external_end_marker)
if pos == -1:
    print("ERROR: Could not find EXTERNAL_BUILD_TOOLS end marker")
    exit(1)

content = content[:pos + len(external_end_marker) - 2] + "  // New Titan Platform Tools\n" + "".join(f"  {name},\n" for name in tool_names) + "];" + content[pos + len(external_end_marker):]
print(f"Added tool names to EXTERNAL_BUILD_TOOLS")

with open(tools_file, "w") as f:
    f.write(content)

print("Successfully updated chat-tools.ts!")
