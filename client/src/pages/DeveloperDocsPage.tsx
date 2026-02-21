import { Button } from "@/components/ui/button";
import AffiliateRecommendations from "@/components/AffiliateRecommendations";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSubscription } from "@/hooks/useSubscription";
import { UpgradeDialog } from "@/components/UpgradePrompt";
import {
  Book,
  Code,
  Copy,
  Check,
  Terminal,
  Braces,
  Globe,
  Shield,
  Zap,
  ArrowRight,
  Download,
  ExternalLink,
  Lock,
  Key,
  Webhook,
  BarChart3,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const BASE_URL = typeof window !== "undefined" ? window.location.origin : "";

// ─── API Endpoint Definitions ────────────────────────────────────
const API_ENDPOINTS = [
  {
    method: "GET",
    path: "/api/v1/me",
    description: "Get information about the authenticated API key",
    scope: "—",
    response: `{
  "userId": 42,
  "plan": "pro",
  "scopes": ["credentials:read", "credentials:export"],
  "rateLimit": { "daily": 100 }
}`,
  },
  {
    method: "GET",
    path: "/api/v1/credentials",
    description: "List all stored credentials with decrypted values",
    scope: "credentials:read",
    response: `{
  "data": [
    {
      "id": 1,
      "provider": "AWS",
      "providerId": "aws",
      "keyType": "access_key",
      "label": "Production Key",
      "value": "AKIA...",
      "createdAt": "2026-01-15T..."
    }
  ],
  "count": 1
}`,
  },
  {
    method: "GET",
    path: "/api/v1/credentials/export",
    description: "Export credentials in JSON, ENV, or CSV format",
    scope: "credentials:export",
    params: "?format=json|env|csv",
    response: `# format=env
AWS_ACCESS_KEY=AKIA...
AWS_SECRET_KEY=wJalr...
STRIPE_SECRET_KEY=your_stripe_key_here`,
  },
  {
    method: "GET",
    path: "/api/v1/vault",
    description: "List team vault items (metadata only, no secrets)",
    scope: "credentials:read",
    response: `{
  "data": [
    {
      "id": 1,
      "name": "Production DB",
      "credentialType": "api_key",
      "accessLevel": "admin",
      "tags": ["production"],
      "expiresAt": "2026-06-01T..."
    }
  ],
  "count": 1
}`,
  },
  {
    method: "GET",
    path: "/api/v1/scans",
    description: "List recent credential leak scan results",
    scope: "credentials:read",
    response: `{
  "data": [
    {
      "id": 1,
      "scanType": "text",
      "status": "completed",
      "totalLeaks": 2,
      "criticalLeaks": 1,
      "createdAt": "2026-02-10T..."
    }
  ],
  "count": 1
}`,
  },
  {
    method: "GET",
    path: "/api/v1/totp",
    description: "List TOTP entries (metadata only, no secrets)",
    scope: "totp:read",
    response: `{
  "data": [
    {
      "id": 1,
      "name": "GitHub",
      "issuer": "GitHub",
      "algorithm": "SHA1",
      "digits": 6,
      "period": 30,
      "lastUsedAt": "2026-02-14T...",
      "createdAt": "2026-01-20T..."
    }
  ],
  "count": 1
}`,
  },
  {
    method: "POST",
    path: "/api/v1/totp/:id/generate",
    description: "Generate a fresh TOTP code for a specific entry",
    scope: "totp:generate",
    response: `{
  "code": "482901",
  "remaining": 18,
  "name": "GitHub",
  "issuer": "GitHub"
}`,
  },
  {
    method: "GET",
    path: "/api/v1/audit",
    description: "List audit log entries with optional filtering",
    scope: "audit:read",
    params: "?action=credential.created&limit=50&offset=0",
    response: `{
  "logs": [
    {
      "id": 1,
      "action": "credential.created",
      "resource": "credential:42",
      "userName": "user@example.com",
      "createdAt": "2026-02-14T..."
    }
  ],
  "total": 156
}`,
  },
  {
    method: "GET",
    path: "/api/v1/audit/export",
    description: "Export audit logs as CSV file",
    scope: "audit:export",
    params: "?limit=1000",
    response: `ID,Timestamp,User,Action,Resource,Details
1,2026-02-14T...,"user@example.com","credential.created","credential:42","{}"`,
  },
  {
    method: "GET",
    path: "/api/v1/health",
    description: "API health check (no auth required)",
    scope: "\u2014",
    response: `{
  "status": "ok",
  "version": "7.1.0",
  "timestamp": "2026-02-14T..."
}`,
  },
];

// ─── Code Examples ───────────────────────────────────────────────
function getCurlExample(endpoint: (typeof API_ENDPOINTS)[0]) {
  const params = endpoint.params || "";
  return `curl -s -H "Authorization: Bearer at_YOUR_API_KEY" \\
  "${BASE_URL}${endpoint.path}${params}"`;
}

function getPythonExample(endpoint: (typeof API_ENDPOINTS)[0]) {
  const params = endpoint.params || "";
  return `import requests

headers = {"Authorization": "Bearer at_YOUR_API_KEY"}
response = requests.get("${BASE_URL}${endpoint.path}${params}", headers=headers)
data = response.json()
print(data)`;
}

function getNodeExample(endpoint: (typeof API_ENDPOINTS)[0]) {
  const params = endpoint.params || "";
  return `const response = await fetch("${BASE_URL}${endpoint.path}${params}", {
  headers: { "Authorization": "Bearer at_YOUR_API_KEY" }
});
const data = await response.json();
console.log(data);`;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-7 w-7 absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-emerald-400" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
    </Button>
  );
}

function CodeBlock({ code, language }: { code: string; language: string }) {
  return (
    <div className="relative group">
      <pre className="bg-zinc-950 border border-zinc-800 rounded-lg p-4 text-sm font-mono overflow-x-auto text-zinc-300">
        <code>{code}</code>
      </pre>
      <CopyButton text={code} />
    </div>
  );
}

function MethodBadge({ method }: { method: string }) {
  const colors: Record<string, string> = {
    GET: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    POST: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    PUT: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    DELETE: "bg-red-500/15 text-red-400 border-red-500/30",
  };
  return (
    <Badge
      variant="outline"
      className={`font-mono text-xs ${colors[method] || ""}`}
    >
      {method}
    </Badge>
  );
}

export default function DeveloperDocsPage() {
  const sub = useSubscription();
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [expandedEndpoint, setExpandedEndpoint] = useState<number | null>(null);

  if (!sub.canUse("developer_api")) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
            Developer API
          </h1>
          <p className="text-muted-foreground mt-1">
            Integrate Archibald Titan into your applications and workflows.
          </p>
        </div>
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center mb-4">
              <Code className="h-8 w-8 text-blue-400" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Pro Feature</h3>
            <p className="text-sm text-muted-foreground max-w-md mb-6">
              The Developer API gives you programmatic access to credentials,
              vault items, scan results, and more. Build integrations, automate
              workflows, and extend Titan's capabilities.
            </p>
            <div className="flex flex-wrap gap-3 justify-center mb-6">
              <Badge variant="secondary" className="gap-1.5">
                <Terminal className="h-3 w-3" /> REST API
              </Badge>
              <Badge variant="secondary" className="gap-1.5">
                <Shield className="h-3 w-3" /> Scoped Keys
              </Badge>
              <Badge variant="secondary" className="gap-1.5">
                <Zap className="h-3 w-3" /> Rate Limiting
              </Badge>
              <Badge variant="secondary" className="gap-1.5">
                <Webhook className="h-3 w-3" /> Webhooks
              </Badge>
            </div>
            <Button
              onClick={() => setShowUpgrade(true)}
              className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white"
            >
              Upgrade to Pro
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </CardContent>
        </Card>
        <UpgradeDialog
          open={showUpgrade}
          onOpenChange={setShowUpgrade}
          feature="Developer API"
          requiredPlan="pro"
        />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
          Developer API Documentation
        </h1>
        <p className="text-muted-foreground mt-1">
          Integrate Archibald Titan into your applications with our REST API.
        </p>
      </div>

      <AffiliateRecommendations context="developer" variant="banner" />

      {/* Quick Start */}
      <Card className="border-blue-500/20 bg-gradient-to-br from-blue-500/5 to-purple-500/5">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-blue-400" />
            <CardTitle className="text-lg">Quick Start</CardTitle>
          </div>
          <CardDescription>
            Get started in 3 steps. All API requests require an API key.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="flex gap-3">
              <div className="h-8 w-8 rounded-full bg-blue-500/20 flex items-center justify-center text-sm font-bold text-blue-400 shrink-0">
                1
              </div>
              <div>
                <p className="text-sm font-medium">Create an API Key</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Go to{" "}
                  <a
                    href="/fetcher/api-access"
                    className="text-blue-400 hover:underline"
                  >
                    API Access
                  </a>{" "}
                  and generate a key with the scopes you need.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="h-8 w-8 rounded-full bg-blue-500/20 flex items-center justify-center text-sm font-bold text-blue-400 shrink-0">
                2
              </div>
              <div>
                <p className="text-sm font-medium">Authenticate</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Include your key in the{" "}
                  <code className="text-[11px] bg-muted px-1 py-0.5 rounded">
                    Authorization
                  </code>{" "}
                  header.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="h-8 w-8 rounded-full bg-blue-500/20 flex items-center justify-center text-sm font-bold text-blue-400 shrink-0">
                3
              </div>
              <div>
                <p className="text-sm font-medium">Make Requests</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Call any endpoint below. Responses are JSON by default.
                </p>
              </div>
            </div>
          </div>

          <CodeBlock
            code={`curl -H "Authorization: Bearer at_YOUR_API_KEY" ${BASE_URL}/api/v1/me`}
            language="bash"
          />
        </CardContent>
      </Card>

      {/* Authentication */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-amber-400" />
            <CardTitle className="text-lg">Authentication</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            All API requests (except{" "}
            <code className="text-xs bg-muted px-1 py-0.5 rounded">
              /api/v1/health
            </code>
            ) require a Bearer token in the Authorization header:
          </p>
          <CodeBlock
            code={`Authorization: Bearer at_YOUR_API_KEY`}
            language="http"
          />
          <div className="grid gap-3 md:grid-cols-2 mt-4">
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
              <Key className="h-4 w-4 text-blue-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium">Scoped Permissions</p>
                <p className="text-xs text-muted-foreground">
                  Each key has specific scopes. Requests outside the key's scope
                  return 403.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
              <BarChart3 className="h-4 w-4 text-purple-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium">Rate Limits</p>
                <p className="text-xs text-muted-foreground">
                  Pro: 100 req/day, Enterprise: 10,000 req/day. Check{" "}
                  <code className="text-[10px]">X-RateLimit-Remaining</code>{" "}
                  header.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Endpoints */}
      <div>
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Globe className="h-5 w-5 text-blue-400" />
          API Endpoints
        </h2>
        <div className="space-y-3">
          {API_ENDPOINTS.map((endpoint, i) => (
            <Card
              key={i}
              className={`cursor-pointer transition-all hover:border-blue-500/30 ${
                expandedEndpoint === i ? "border-blue-500/40 shadow-lg shadow-blue-500/5" : ""
              }`}
              onClick={() =>
                setExpandedEndpoint(expandedEndpoint === i ? null : i)
              }
            >
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <MethodBadge method={endpoint.method} />
                    <code className="text-sm font-mono">
                      {endpoint.path}
                      {endpoint.params && (
                        <span className="text-muted-foreground">
                          {endpoint.params}
                        </span>
                      )}
                    </code>
                  </div>
                  <div className="flex items-center gap-2">
                    {endpoint.scope !== "—" && (
                      <Badge variant="secondary" className="text-[10px]">
                        {endpoint.scope}
                      </Badge>
                    )}
                    <ArrowRight
                      className={`h-4 w-4 text-muted-foreground transition-transform ${
                        expandedEndpoint === i ? "rotate-90" : ""
                      }`}
                    />
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mt-1.5">
                  {endpoint.description}
                </p>

                {expandedEndpoint === i && (
                  <div
                    className="mt-4 space-y-4"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Tabs defaultValue="curl">
                      <TabsList className="h-8">
                        <TabsTrigger value="curl" className="text-xs h-7">
                          <Terminal className="h-3 w-3 mr-1" />
                          cURL
                        </TabsTrigger>
                        <TabsTrigger value="python" className="text-xs h-7">
                          Python
                        </TabsTrigger>
                        <TabsTrigger value="node" className="text-xs h-7">
                          Node.js
                        </TabsTrigger>
                        <TabsTrigger value="response" className="text-xs h-7">
                          <Braces className="h-3 w-3 mr-1" />
                          Response
                        </TabsTrigger>
                      </TabsList>
                      <TabsContent value="curl" className="mt-3">
                        <CodeBlock
                          code={getCurlExample(endpoint)}
                          language="bash"
                        />
                      </TabsContent>
                      <TabsContent value="python" className="mt-3">
                        <CodeBlock
                          code={getPythonExample(endpoint)}
                          language="python"
                        />
                      </TabsContent>
                      <TabsContent value="node" className="mt-3">
                        <CodeBlock
                          code={getNodeExample(endpoint)}
                          language="javascript"
                        />
                      </TabsContent>
                      <TabsContent value="response" className="mt-3">
                        <CodeBlock
                          code={endpoint.response}
                          language="json"
                        />
                      </TabsContent>
                    </Tabs>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Error Codes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Error Codes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 pr-4 font-medium">Code</th>
                  <th className="text-left py-2 pr-4 font-medium">Meaning</th>
                  <th className="text-left py-2 font-medium">Resolution</th>
                </tr>
              </thead>
              <tbody className="text-muted-foreground">
                <tr className="border-b border-dashed">
                  <td className="py-2 pr-4">
                    <Badge variant="outline" className="font-mono">
                      401
                    </Badge>
                  </td>
                  <td className="py-2 pr-4">Unauthorized</td>
                  <td className="py-2">
                    Check your API key is valid and not expired
                  </td>
                </tr>
                <tr className="border-b border-dashed">
                  <td className="py-2 pr-4">
                    <Badge variant="outline" className="font-mono">
                      403
                    </Badge>
                  </td>
                  <td className="py-2 pr-4">Forbidden</td>
                  <td className="py-2">
                    Missing required scope or plan doesn't include this feature
                  </td>
                </tr>
                <tr className="border-b border-dashed">
                  <td className="py-2 pr-4">
                    <Badge variant="outline" className="font-mono">
                      429
                    </Badge>
                  </td>
                  <td className="py-2 pr-4">Rate Limited</td>
                  <td className="py-2">
                    Daily request limit exceeded. Check X-RateLimit-Reset header
                  </td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">
                    <Badge variant="outline" className="font-mono">
                      500
                    </Badge>
                  </td>
                  <td className="py-2 pr-4">Server Error</td>
                  <td className="py-2">
                    Internal error. Retry with exponential backoff
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* SDK Downloads */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Download className="h-5 w-5 text-emerald-400" />
            <CardTitle className="text-lg">SDKs & Libraries</CardTitle>
          </div>
          <CardDescription>
            Use our official libraries to integrate faster.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="flex items-center gap-3 p-4 rounded-lg border hover:bg-accent/50 transition-colors">
              <div className="h-10 w-10 rounded-lg bg-yellow-500/15 flex items-center justify-center text-yellow-400 font-bold text-sm">
                JS
              </div>
              <div>
                <p className="text-sm font-medium">Node.js / TypeScript</p>
                <p className="text-xs text-muted-foreground">
                  npm install @archibald/titan-sdk
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 rounded-lg border hover:bg-accent/50 transition-colors">
              <div className="h-10 w-10 rounded-lg bg-blue-500/15 flex items-center justify-center text-blue-400 font-bold text-sm">
                PY
              </div>
              <div>
                <p className="text-sm font-medium">Python</p>
                <p className="text-xs text-muted-foreground">
                  pip install archibald-titan
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 rounded-lg border hover:bg-accent/50 transition-colors">
              <div className="h-10 w-10 rounded-lg bg-cyan-500/15 flex items-center justify-center text-cyan-400 font-bold text-sm">
                GO
              </div>
              <div>
                <p className="text-sm font-medium">Go</p>
                <p className="text-xs text-muted-foreground">
                  go get github.com/archibald/titan-go
                </p>
              </div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            SDKs are open source and available on GitHub. Community contributions welcome.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
