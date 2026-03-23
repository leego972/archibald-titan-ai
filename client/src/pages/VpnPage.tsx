import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Shield, Globe, Power, Copy, Check, AlertCircle, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { trpc } from "@/lib/trpc";

const COUNTRIES = [
  { id: "us", name: "United States" },
  { id: "gb", name: "United Kingdom" },
  { id: "ca", name: "Canada" },
  { id: "de", name: "Germany" },
  { id: "fr", name: "France" },
  { id: "jp", name: "Japan" },
  { id: "au", name: "Australia" },
  { id: "br", name: "Brazil" },
  { id: "in", name: "India" },
];

export default function VpnPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [copiedField, setCopiedField] = useState<string | null>(null);
  
  const { data: status, isLoading: statusLoading } = trpc.vpn.getStatus.useQuery();
  const { data: config, isLoading: configLoading } = trpc.vpn.getConfig.useQuery(undefined, {
    enabled: !!status?.active
  });
  
  const toggleMutation = trpc.vpn.toggleStatus.useMutation({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [["vpn", "getStatus"]] });
      queryClient.invalidateQueries({ queryKey: [["vpn", "getConfig"]] });
      toast({
        title: "VPN Status Updated",
        description: "Your proxy settings have been updated successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to update VPN",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const handleToggle = (checked: boolean) => {
    toggleMutation.mutate({ 
      active: checked,
      country: status?.country || "us"
    });
  };

  const handleCountryChange = (country: string) => {
    if (status?.active) {
      toggleMutation.mutate({ 
        active: true,
        country
      });
    } else {
      // Just update local state if not active, will be sent when toggled
      toggleMutation.mutate({ 
        active: false,
        country
      });
    }
  };

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
    toast({
      title: "Copied to clipboard",
      description: `${field} has been copied.`,
    });
  };

  if (statusLoading) {
    return <div className="flex items-center justify-center h-full p-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;
  }

  return (
    <div className="container mx-auto py-8 max-w-4xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Shield className="h-8 w-8 text-primary" />
            Titan Proxy Network
          </h1>
          <p className="text-muted-foreground mt-2">
            Rotating residential proxies for secure, anonymous browsing and scraping.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Connection Status</CardTitle>
              <CardDescription>Manage your proxy connection</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Power className={`h-5 w-5 ${status?.active ? 'text-green-500' : 'text-muted-foreground'}`} />
                  <span className="font-medium">{status?.active ? 'Connected' : 'Disconnected'}</span>
                </div>
                <Switch 
                  checked={status?.active || false} 
                  onCheckedChange={handleToggle}
                  disabled={toggleMutation.isPending}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  Target Location
                </label>
                <Select 
                  value={status?.country || "us"} 
                  onValueChange={handleCountryChange}
                  disabled={toggleMutation.isPending}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a country" />
                  </SelectTrigger>
                  <SelectContent>
                    {COUNTRIES.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
            <CardFooter className="bg-muted/50 text-xs text-muted-foreground p-4">
              Generating a new proxy connection costs 150 credits.
            </CardFooter>
          </Card>

          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>How it works</AlertTitle>
            <AlertDescription className="text-xs mt-2">
              Titan provisions a secure, rotating residential proxy. Your IP will automatically rotate with every request, keeping you completely anonymous.
            </AlertDescription>
          </Alert>
        </div>

        <div className="md:col-span-2">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Connection Details</CardTitle>
              <CardDescription>
                Use these credentials in your browser, scraper, or system settings.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!status?.active ? (
                <div className="flex flex-col items-center justify-center h-64 text-center border-2 border-dashed rounded-lg p-6">
                  <Shield className="h-12 w-12 text-muted-foreground mb-4 opacity-20" />
                  <h3 className="text-lg font-medium">Proxy is Disconnected</h3>
                  <p className="text-sm text-muted-foreground mt-2 max-w-sm">
                    Turn on the proxy connection to generate your secure credentials.
                  </p>
                  <Button 
                    className="mt-6" 
                    onClick={() => handleToggle(true)}
                    disabled={toggleMutation.isPending}
                  >
                    Connect Now (150 Credits)
                  </Button>
                </div>
              ) : configLoading ? (
                <div className="flex items-center justify-center h-64">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : config ? (
                <div className="space-y-6">
                  <Alert className="bg-green-500/10 border-green-500/20 text-green-600">
                    <Check className="h-4 w-4 text-green-600" />
                    <AlertTitle>Connection Active</AlertTitle>
                    <AlertDescription>
                      Your proxy is ready. Traffic will be routed through {COUNTRIES.find(c => c.id === config.country)?.name || config.country}.
                    </AlertDescription>
                  </Alert>

                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-4 items-center">
                      <div className="text-sm font-medium text-muted-foreground">Host / Server</div>
                      <div className="col-span-2 flex items-center gap-2">
                        <code className="flex-1 bg-muted p-2 rounded text-sm font-mono">{config.host}</code>
                        <Button variant="ghost" size="icon" onClick={() => copyToClipboard(config.host, 'Host')}>
                          {copiedField === 'Host' ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4 items-center">
                      <div className="text-sm font-medium text-muted-foreground">Port</div>
                      <div className="col-span-2 flex items-center gap-2">
                        <code className="flex-1 bg-muted p-2 rounded text-sm font-mono">{config.port}</code>
                        <Button variant="ghost" size="icon" onClick={() => copyToClipboard(config.port.toString(), 'Port')}>
                          {copiedField === 'Port' ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4 items-center">
                      <div className="text-sm font-medium text-muted-foreground">Username</div>
                      <div className="col-span-2 flex items-center gap-2">
                        <code className="flex-1 bg-muted p-2 rounded text-sm font-mono break-all">{config.username}</code>
                        <Button variant="ghost" size="icon" onClick={() => copyToClipboard(config.username, 'Username')}>
                          {copiedField === 'Username' ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4 items-center">
                      <div className="text-sm font-medium text-muted-foreground">Password</div>
                      <div className="col-span-2 flex items-center gap-2">
                        <code className="flex-1 bg-muted p-2 rounded text-sm font-mono break-all">{config.password}</code>
                        <Button variant="ghost" size="icon" onClick={() => copyToClipboard(config.password, 'Password')}>
                          {copiedField === 'Password' ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-4 items-center">
                      <div className="text-sm font-medium text-muted-foreground">Protocol</div>
                      <div className="col-span-2 flex items-center gap-2">
                        <code className="flex-1 bg-muted p-2 rounded text-sm font-mono">{config.protocol}</code>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>Failed to load proxy configuration.</AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
