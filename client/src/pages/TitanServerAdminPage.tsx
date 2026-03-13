import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Server, ShieldCheck, ShieldAlert, Terminal, RefreshCw } from "lucide-react";

export default function TitanServerAdminPage() {
  const [testResult, setTestResult] = useState<{success: boolean, message: string, output?: string} | null>(null);

  const { data: status, isLoading } = trpc.titanServer.getStatus.useQuery();

  const testConnection = trpc.titanServer.testConnection.useMutation({
    onSuccess: (data) => {
      setTestResult(data);
      if (data.success) {
        toast.success("Connection Successful", { description: data.message });
      } else {
        toast.error("Connection Failed", { description: data.message });
      }
    },
    onError: (error) => {
      setTestResult({ success: false, message: error.message });
      toast.error("Connection Failed", { description: error.message });
    }
  });

  if (isLoading) {
    return <div className="p-8 flex justify-center"><RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="container mx-auto py-8 max-w-5xl space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <Server className="h-8 w-8 text-primary" />
          Titan Server Management
        </h1>
        <p className="text-muted-foreground mt-2">
          Manage the shared infrastructure server used by Metasploit, Argus, Astra, BlackEye, and Evilginx.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Server Status
              {status?.isConfigured ? (
                <Badge variant="default" className="bg-green-500/10 text-green-500 hover:bg-green-500/20 border-green-500/20">
                  <ShieldCheck className="h-3 w-3 mr-1" /> Configured
                </Badge>
              ) : (
                <Badge variant="destructive">
                  <ShieldAlert className="h-3 w-3 mr-1" /> Not Configured
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              Environment variable configuration status
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {status?.isConfigured ? (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div className="text-muted-foreground">Host:</div>
                  <div className="col-span-2 font-mono">{status.host}</div>
                  
                  <div className="text-muted-foreground">Port:</div>
                  <div className="col-span-2 font-mono">{status.port}</div>
                  
                  <div className="text-muted-foreground">User:</div>
                  <div className="col-span-2 font-mono">{status.username}</div>
                  
                  <div className="text-muted-foreground">Auth:</div>
                  <div className="col-span-2 flex gap-2">
                    {status.hasKey && <Badge variant="outline">SSH Key</Badge>}
                    {status.hasPassword && <Badge variant="outline">Password</Badge>}
                  </div>
                </div>
                
                <div className="pt-4 border-t">
                  <Button 
                    onClick={() => testConnection.mutate()}
                    disabled={testConnection.isPending}
                    className="w-full"
                  >
                    {testConnection.isPending ? (
                      <><RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Testing Connection...</>
                    ) : (
                      <><Terminal className="mr-2 h-4 w-4" /> Test Connection</>
                    )}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="bg-muted/50 p-4 rounded-md text-sm">
                <p className="mb-2">The Titan Server is not configured. To enable shared infrastructure for users, set the following environment variables in Railway:</p>
                <ul className="list-disc pl-5 space-y-1 font-mono text-xs text-muted-foreground">
                  <li>TITAN_SERVER_HOST</li>
                  <li>TITAN_SERVER_PORT (default: 22)</li>
                  <li>TITAN_SERVER_USER (default: root)</li>
                  <li>TITAN_SERVER_PASSWORD or TITAN_SERVER_KEY</li>
                </ul>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Architecture Overview</CardTitle>
            <CardDescription>How the shared server works</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>
              The Titan Server acts as a fallback execution environment for users who haven't configured their own VPS.
            </p>
            <p>
              When a user runs a tool (like Metasploit or Argus) without a personal SSH config, the system automatically routes the execution to this shared server.
            </p>
            <div className="bg-muted/50 p-3 rounded-md border">
              <h4 className="font-medium text-foreground mb-1">Isolation Mechanism</h4>
              <p>Every command executed on the Titan Server is automatically wrapped to run inside a user-specific directory:</p>
              <code className="block mt-2 p-2 bg-background rounded border text-xs">
                /opt/titan/users/user_&#123;id&#125;/
              </code>
            </div>
          </CardContent>
        </Card>
      </div>

      {testResult && (
        <Card className={testResult.success ? "border-green-500/20" : "border-red-500/20"}>
          <CardHeader>
            <CardTitle className={testResult.success ? "text-green-500" : "text-red-500"}>
              Test Result: {testResult.success ? "Success" : "Failed"}
            </CardTitle>
            <CardDescription>{testResult.message}</CardDescription>
          </CardHeader>
          {testResult.output && (
            <CardContent>
              <pre className="bg-muted p-4 rounded-md text-xs font-mono overflow-x-auto whitespace-pre-wrap">
                {testResult.output}
              </pre>
            </CardContent>
          )}
        </Card>
      )}
    </div>
  );
}
