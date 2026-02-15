import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Terminal,
  Copy,
  Download,
  Key,
  Shield,
  Zap,
  FileText,
  RefreshCw,
  Lock,
  ArrowRight,
  CheckCircle2,
  ExternalLink,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useSubscription } from "@/hooks/useSubscription";

// ─── Code Block Component ────────────────────────────────────────
function CodeBlock({
  code,
  language = "bash",
  title,
}: {
  code: string;
  language?: string;
  title?: string;
}) {
  const copyToClipboard = () => {
    navigator.clipboard.writeText(code);
    toast.success("Copied to clipboard");
  };

  return (
    <div className="rounded-lg border bg-zinc-950 overflow-hidden">
      {title && (
        <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800 bg-zinc-900/50">
          <span className="text-xs text-zinc-400 font-mono">{title}</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-zinc-400 hover:text-white"
            onClick={copyToClipboard}
          >
            <Copy className="h-3 w-3" />
          </Button>
        </div>
      )}
      <div className="relative group">
        <pre className="p-4 text-sm text-zinc-200 overflow-x-auto font-mono leading-relaxed">
          <code>{code}</code>
        </pre>
        {!title && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-2 right-2 h-7 w-7 text-zinc-500 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={copyToClipboard}
          >
            <Copy className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}

// ─── Command Reference ───────────────────────────────────────────
const CLI_COMMANDS = [
  {
    command: "titan auth login",
    description: "Authenticate with your API key",
    example: `$ titan auth login
? Enter your API key: at_xxxxxxxxxxxx
✓ Authenticated as user@example.com (Pro plan)
✓ API key saved to ~/.titan/config.json`,
  },
  {
    command: "titan auth status",
    description: "Check current authentication status",
    example: `$ titan auth status
✓ Authenticated
  User: user@example.com
  Plan: Pro
  Scopes: credentials:read, credentials:export
  Rate Limit: 92/100 remaining today`,
  },
  {
    command: "titan creds list",
    description: "List all stored credentials",
    example: `$ titan creds list
┌────┬──────────┬──────────────┬────────────────────┐
│ ID │ Provider │ Key Type     │ Label              │
├────┼──────────┼──────────────┼────────────────────┤
│  1 │ AWS      │ access_key   │ Production Key     │
│  2 │ Stripe   │ secret_key   │ Live API Key       │
│  3 │ GitHub   │ pat          │ CI/CD Token        │
│  4 │ OpenAI   │ api_key      │ GPT-4 Key          │
└────┴──────────┴──────────────┴────────────────────┘
4 credentials found`,
  },
  {
    command: "titan creds get <id>",
    description: "Get a specific credential value (decrypted)",
    example: `$ titan creds get 1
Provider: AWS
Type: access_key
Label: Production Key
Value: AKIAIOSFODNN7EXAMPLE

# Pipe to clipboard
$ titan creds get 1 --value-only | pbcopy`,
  },
  {
    command: "titan creds export",
    description: "Export all credentials in various formats",
    example: `# Export as .env file
$ titan creds export --format env > .env

# Export as JSON
$ titan creds export --format json > creds.json

# Export as CSV
$ titan creds export --format csv > creds.csv

# Export specific provider only
$ titan creds export --format env --provider aws`,
  },
  {
    command: "titan vault list",
    description: "List team vault items",
    example: `$ titan vault list
┌────┬────────────────┬──────────┬───────────┐
│ ID │ Name           │ Type     │ Access    │
├────┼────────────────┼──────────┼───────────┤
│  1 │ Production DB  │ api_key  │ admin     │
│  2 │ Staging API    │ api_key  │ member    │
└────┴────────────────┴──────────┴───────────┘`,
  },
  {
    command: "titan scans list",
    description: "List recent leak scan results",
    example: `$ titan scans list
┌────┬──────────┬───────────┬────────┬──────────┐
│ ID │ Type     │ Status    │ Leaks  │ Critical │
├────┼──────────┼───────────┼────────┼──────────┤
│  1 │ text     │ completed │ 2      │ 1        │
│  2 │ repo     │ completed │ 0      │ 0        │
└────┴──────────┴───────────┴────────┴──────────┘`,
  },
  {
    command: "titan health",
    description: "Check API health and your account status",
    example: `$ titan health
API Status: ✓ Operational
Version: 7.0.0
Your Plan: Pro
Rate Limit: 92/100 remaining
Uptime: 99.99%`,
  },
  {
    command: "titan totp list",
    description: "List TOTP entries and current codes",
    example: `$ titan totp list
┌────┬──────────┬────────┬─────────────┐
│ ID │ Name     │ Code   │ Expires In  │
├────┼──────────┼────────┼─────────────┤
│  1 │ GitHub   │ 482901 │ 18s         │
│  2 │ AWS      │ 739204 │ 18s         │
└────┴──────────┴────────┴─────────────┘`,
  },
  {
    command: "titan totp get <id>",
    description: "Get a TOTP code and copy to clipboard",
    example: `$ titan totp get 1
GitHub: 482901 (expires in 18s)

# Auto-copy to clipboard
$ titan totp get 1 --copy
✓ Code 482901 copied to clipboard (expires in 18s)`,
  },
];

// ─── Installation Commands ───────────────────────────────────────
const INSTALL_COMMANDS = {
  npm: "npm install -g @archibald/titan-cli",
  brew: "brew install archibald/tap/titan-cli",
  curl: `curl -fsSL https://www.archibaldtitan.com/install.sh | bash`,
  windows: `iwr -useb https://www.archibaldtitan.com/install.ps1 | iex`,
};

export default function CliToolPage() {
  const sub = useSubscription();
  const [activeTab, setActiveTab] = useState("overview");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Terminal className="h-6 w-6 text-emerald-400" />
            titan-cli
          </h1>
          <p className="text-muted-foreground mt-1">
            Command-line interface for Archibald Titan. Manage credentials,
            generate TOTP codes, and export secrets — all from your terminal.
          </p>
        </div>
        <Badge
          variant="outline"
          className="text-emerald-400 border-emerald-400/30"
        >
          v1.0.0
        </Badge>
      </div>

      {/* Quick Start Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-emerald-500/20 bg-emerald-500/5">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10">
                <Download className="h-5 w-5 text-emerald-400" />
              </div>
              <div>
                <p className="font-medium text-sm">Install</p>
                <p className="text-xs text-muted-foreground">npm, brew, or curl</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-blue-500/20 bg-blue-500/5">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Key className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <p className="font-medium text-sm">Authenticate</p>
                <p className="text-xs text-muted-foreground">Use your API key</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-purple-500/20 bg-purple-500/5">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/10">
                <Shield className="h-5 w-5 text-purple-400" />
              </div>
              <div>
                <p className="font-medium text-sm">Manage</p>
                <p className="text-xs text-muted-foreground">Creds, vault, TOTP</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-amber-500/20 bg-amber-500/5">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <Zap className="h-5 w-5 text-amber-400" />
              </div>
              <div>
                <p className="font-medium text-sm">Automate</p>
                <p className="text-xs text-muted-foreground">CI/CD & scripts</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="install">Installation</TabsTrigger>
          <TabsTrigger value="commands">Commands</TabsTrigger>
          <TabsTrigger value="ci-cd">CI/CD</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Quick Start</CardTitle>
              <CardDescription>
                Get up and running in under 60 seconds.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="h-6 w-6 rounded-full bg-emerald-500/20 flex items-center justify-center text-xs font-bold text-emerald-400 shrink-0 mt-0.5">
                    1
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium mb-1">Install the CLI</p>
                    <CodeBlock code="npm install -g @archibald/titan-cli" />
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="h-6 w-6 rounded-full bg-emerald-500/20 flex items-center justify-center text-xs font-bold text-emerald-400 shrink-0 mt-0.5">
                    2
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium mb-1">
                      Authenticate with your API key
                    </p>
                    <CodeBlock code="titan auth login" />
                    <p className="text-xs text-muted-foreground mt-1">
                      Generate an API key from{" "}
                      <a
                        href="/fetcher/api-access"
                        className="text-emerald-400 hover:underline"
                      >
                        API Access
                      </a>{" "}
                      in your dashboard.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="h-6 w-6 rounded-full bg-emerald-500/20 flex items-center justify-center text-xs font-bold text-emerald-400 shrink-0 mt-0.5">
                    3
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium mb-1">
                      Start using Titan from your terminal
                    </p>
                    <CodeBlock
                      code={`# List your credentials
titan creds list

# Export as .env file
titan creds export --format env > .env

# Get a TOTP code
titan totp get 1 --copy`}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Features</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">
                      Credential Management
                    </p>
                    <p className="text-xs text-muted-foreground">
                      List, view, and export credentials in JSON, ENV, or CSV
                      format.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">TOTP Code Generation</p>
                    <p className="text-xs text-muted-foreground">
                      Generate and auto-copy TOTP codes directly from your
                      terminal.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">Team Vault Access</p>
                    <p className="text-xs text-muted-foreground">
                      Access shared team credentials with role-based
                      permissions.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">Leak Scan Results</p>
                    <p className="text-xs text-muted-foreground">
                      View recent credential leak scan results and alerts.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">CI/CD Integration</p>
                    <p className="text-xs text-muted-foreground">
                      Use in GitHub Actions, GitLab CI, or any pipeline to
                      inject secrets.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">Scriptable Output</p>
                    <p className="text-xs text-muted-foreground">
                      Use --json and --value-only flags for machine-readable
                      output.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Installation Tab */}
        <TabsContent value="install" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Installation Methods</CardTitle>
              <CardDescription>
                Choose the installation method that works best for your
                environment.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* npm */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-6 w-6 rounded bg-red-500/15 flex items-center justify-center text-red-400 font-bold text-xs">
                    npm
                  </div>
                  <h4 className="text-sm font-medium">
                    npm (recommended for Node.js users)
                  </h4>
                </div>
                <CodeBlock code={INSTALL_COMMANDS.npm} title="Terminal" />
              </div>

              {/* Homebrew */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-6 w-6 rounded bg-amber-500/15 flex items-center justify-center text-amber-400 font-bold text-xs">
                    🍺
                  </div>
                  <h4 className="text-sm font-medium">
                    Homebrew (macOS / Linux)
                  </h4>
                </div>
                <CodeBlock code={INSTALL_COMMANDS.brew} title="Terminal" />
              </div>

              {/* curl */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-6 w-6 rounded bg-green-500/15 flex items-center justify-center text-green-400 font-bold text-xs">
                    $
                  </div>
                  <h4 className="text-sm font-medium">
                    Shell script (Linux / macOS)
                  </h4>
                </div>
                <CodeBlock code={INSTALL_COMMANDS.curl} title="Terminal" />
              </div>

              {/* Windows */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-6 w-6 rounded bg-blue-500/15 flex items-center justify-center text-blue-400 font-bold text-xs">
                    PS
                  </div>
                  <h4 className="text-sm font-medium">
                    PowerShell (Windows)
                  </h4>
                </div>
                <CodeBlock code={INSTALL_COMMANDS.windows} title="PowerShell" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Configuration</CardTitle>
              <CardDescription>
                After installation, configure the CLI with your API key.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <CodeBlock
                code={`# Interactive login
$ titan auth login
? Enter your API key: at_xxxxxxxxxxxx
✓ Authenticated as user@example.com (Pro plan)
✓ Config saved to ~/.titan/config.json

# Or set via environment variable
$ export TITAN_API_KEY=at_xxxxxxxxxxxx

# Verify authentication
$ titan auth status`}
                title="Terminal"
              />
              <div className="p-3 rounded-lg border border-amber-500/20 bg-amber-500/5">
                <p className="text-sm text-amber-200 flex items-start gap-2">
                  <Lock className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>
                    Your API key is stored encrypted in{" "}
                    <code className="text-xs bg-zinc-800 px-1 py-0.5 rounded">
                      ~/.titan/config.json
                    </code>{" "}
                    with file permissions set to 600 (owner-only). Never commit
                    this file to version control.
                  </span>
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Commands Tab */}
        <TabsContent value="commands" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Command Reference</CardTitle>
              <CardDescription>
                All available commands and their usage.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {CLI_COMMANDS.map((cmd, i) => (
                <div key={i} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <code className="text-sm font-mono font-medium text-emerald-400">
                      {cmd.command}
                    </code>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {cmd.description}
                  </p>
                  <CodeBlock code={cmd.example} title="Example" />
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Global Flags</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center gap-3 p-2 rounded hover:bg-accent/50">
                  <code className="text-xs font-mono text-emerald-400 w-32 shrink-0">
                    --json
                  </code>
                  <p className="text-xs text-muted-foreground">
                    Output in JSON format (machine-readable)
                  </p>
                </div>
                <div className="flex items-center gap-3 p-2 rounded hover:bg-accent/50">
                  <code className="text-xs font-mono text-emerald-400 w-32 shrink-0">
                    --quiet, -q
                  </code>
                  <p className="text-xs text-muted-foreground">
                    Suppress non-essential output
                  </p>
                </div>
                <div className="flex items-center gap-3 p-2 rounded hover:bg-accent/50">
                  <code className="text-xs font-mono text-emerald-400 w-32 shrink-0">
                    --no-color
                  </code>
                  <p className="text-xs text-muted-foreground">
                    Disable colored output
                  </p>
                </div>
                <div className="flex items-center gap-3 p-2 rounded hover:bg-accent/50">
                  <code className="text-xs font-mono text-emerald-400 w-32 shrink-0">
                    --api-key &lt;key&gt;
                  </code>
                  <p className="text-xs text-muted-foreground">
                    Override stored API key for this command
                  </p>
                </div>
                <div className="flex items-center gap-3 p-2 rounded hover:bg-accent/50">
                  <code className="text-xs font-mono text-emerald-400 w-32 shrink-0">
                    --base-url &lt;url&gt;
                  </code>
                  <p className="text-xs text-muted-foreground">
                    Override API base URL (for self-hosted instances)
                  </p>
                </div>
                <div className="flex items-center gap-3 p-2 rounded hover:bg-accent/50">
                  <code className="text-xs font-mono text-emerald-400 w-32 shrink-0">
                    --version, -v
                  </code>
                  <p className="text-xs text-muted-foreground">
                    Show CLI version
                  </p>
                </div>
                <div className="flex items-center gap-3 p-2 rounded hover:bg-accent/50">
                  <code className="text-xs font-mono text-emerald-400 w-32 shrink-0">
                    --help, -h
                  </code>
                  <p className="text-xs text-muted-foreground">
                    Show help for any command
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* CI/CD Tab */}
        <TabsContent value="ci-cd" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                GitHub Actions
              </CardTitle>
              <CardDescription>
                Inject Titan credentials into your GitHub Actions workflows.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CodeBlock
                code={`# .github/workflows/deploy.yml
name: Deploy
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Install Titan CLI
        run: npm install -g @archibald/titan-cli

      - name: Inject secrets
        env:
          TITAN_API_KEY: \${{ secrets.TITAN_API_KEY }}
        run: |
          titan creds export --format env > .env
          source .env

      - name: Deploy
        run: ./deploy.sh`}
                title=".github/workflows/deploy.yml"
                language="yaml"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">GitLab CI</CardTitle>
              <CardDescription>
                Use Titan CLI in your GitLab CI/CD pipelines.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CodeBlock
                code={`# .gitlab-ci.yml
deploy:
  stage: deploy
  image: node:20
  before_script:
    - npm install -g @archibald/titan-cli
    - export TITAN_API_KEY=$TITAN_API_KEY
  script:
    - titan creds export --format env > .env
    - source .env
    - ./deploy.sh`}
                title=".gitlab-ci.yml"
                language="yaml"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Docker</CardTitle>
              <CardDescription>
                Inject credentials at container build or runtime.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CodeBlock
                code={`# At runtime (recommended)
docker run -e TITAN_API_KEY=at_xxx myapp sh -c "
  npx @archibald/titan-cli creds export --format env > .env
  source .env
  node server.js
"

# Or in docker-compose.yml
services:
  app:
    build: .
    environment:
      - TITAN_API_KEY=\${TITAN_API_KEY}
    command: >
      sh -c "npx @archibald/titan-cli creds export --format env > .env &&
             source .env && node server.js"`}
                title="Docker"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Shell Scripts</CardTitle>
              <CardDescription>
                Common patterns for using Titan CLI in automation scripts.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <CodeBlock
                code={`#!/bin/bash
# rotate-and-deploy.sh
# Fetch latest credentials and deploy

set -euo pipefail

echo "🔑 Fetching credentials from Titan..."
titan creds export --format env > .env.production
source .env.production

echo "🚀 Deploying with fresh credentials..."
./deploy.sh

echo "✅ Deployment complete with latest credentials"`}
                title="rotate-and-deploy.sh"
              />
              <CodeBlock
                code={`#!/bin/bash
# get-totp.sh
# Quick TOTP code retrieval for MFA-protected operations

CODE=$(titan totp get 1 --value-only --quiet)
echo "Your TOTP code: $CODE"

# Or use in automation
titan totp get 1 --value-only | xargs -I {} curl -X POST \\
  https://api.example.com/verify-mfa \\
  -d "code={}"`}
                title="get-totp.sh"
              />
            </CardContent>
          </Card>

          <Card className="border-emerald-500/20">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-start gap-3">
                <Shield className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium mb-1">Security Best Practices</p>
                  <ul className="text-xs text-muted-foreground space-y-1">
                    <li>
                      • Always use{" "}
                      <code className="bg-zinc-800 px-1 py-0.5 rounded">
                        TITAN_API_KEY
                      </code>{" "}
                      environment variable in CI/CD (never hardcode)
                    </li>
                    <li>
                      • Create dedicated API keys with minimal scopes for each
                      pipeline
                    </li>
                    <li>
                      • Set key expiration dates for CI/CD keys (rotate
                      quarterly)
                    </li>
                    <li>
                      • Use{" "}
                      <code className="bg-zinc-800 px-1 py-0.5 rounded">
                        --quiet
                      </code>{" "}
                      flag to prevent credential values from appearing in logs
                    </li>
                    <li>
                      • Never pipe credential output to log files or stdout in
                      production
                    </li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* API Key Requirement */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Key className="h-5 w-5 text-purple-400" />
              <div>
                <p className="text-sm font-medium">Need an API Key?</p>
                <p className="text-xs text-muted-foreground">
                  Generate one from your dashboard to start using the CLI.
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => (window.location.href = "/fetcher/api-access")}
            >
              Go to API Access
              <ArrowRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
