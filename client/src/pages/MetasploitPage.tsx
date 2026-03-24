/**
 * Metasploit Page — Metasploit Framework management
 * Titan-tier exclusive feature under the Specialised category.
 *
 * Reference: https://docs.metasploit.com/
 */
import { useState } from "react";
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
  Shield,
  Terminal,
  AlertTriangle,
  CheckCircle,
  Search,
  Zap,
  Globe,
  Package,
  Database,
  Cpu,
  Lock,
  Layers,
} from "lucide-react";
import VpsNodeManager from "@/components/VpsNodeManager";

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
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; version?: string } | null>(null);

  const testConnection = trpc.metasploit.testConnection.useMutation();
  const saveConnection = trpc.metasploit.saveConnection.useMutation();

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
            <Server className="w-5 h-5 text-blue-400" />
            Connect to Metasploit Server
          </DialogTitle>
          <DialogDescription>
            Enter the SSH credentials for the VPS running Metasploit Framework.
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
                className={authType === "password" ? "bg-blue-600" : "border-zinc-700"}
              >
                <Key className="w-3 h-3 mr-1" /> Password
              </Button>
              <Button
                size="sm"
                variant={authType === "key" ? "default" : "outline"}
                onClick={() => setAuthType("key")}
                className={authType === "key" ? "bg-blue-600" : "border-zinc-700"}
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
            <div className={`flex items-start gap-2 text-sm p-3 rounded-lg ${testResult.success ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"}`}>
              {testResult.success ? <CheckCircle className="w-4 h-4 mt-0.5" /> : <AlertTriangle className="w-4 h-4 mt-0.5" />}
              <div>
                <p>{testResult.message}</p>
                {testResult.version && <p className="text-xs mt-1 opacity-70">{testResult.version}</p>}
              </div>
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
              className="bg-blue-600 hover:bg-blue-700 flex-1"
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
export default function MetasploitPage() {
  const [showSetup, setShowSetup] = useState(false);
  const [activeTab, setActiveTab] = useState("modules");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchType, setSearchType] = useState<"all" | "exploit" | "auxiliary" | "post" | "payload" | "encoder" | "nop">("all");
  const [selectedModule, setSelectedModule] = useState("");
  const [moduleOptions, setModuleOptions] = useState<Record<string, string>>({});
  const [payload, setPayload] = useState("");
  const [terminalOutput, setTerminalOutput] = useState("");
  const [terminalCommand, setTerminalCommand] = useState("");
  // Payload generator state
  const [payloadType, setPayloadType] = useState("windows/meterpreter/reverse_tcp");
  const [lhost, setLhost] = useState("");
  const [lport, setLport] = useState("4444");
  const [payloadFormat, setPayloadFormat] = useState<"exe" | "elf" | "macho" | "raw" | "python" | "ruby" | "bash" | "powershell" | "asp" | "aspx" | "jsp" | "php" | "war">("exe");
  const [encoder, setEncoder] = useState("");
  // RPC daemon state
  const [rpcPassword, setRpcPassword] = useState("");
  const [rpcPort, setRpcPort] = useState("55553");

  const connectionQuery = trpc.metasploit.getConnection.useQuery(undefined);
  const connection = connectionQuery.data;
  const connected = !!connection?.connected;
  // Node management hooks for VpsNodeManager
  const listNodesQuery = trpc.metasploit.listNodes.useQuery(undefined);
  const addNodeMutation = trpc.metasploit.addNode.useMutation();
  const deployNodeMutation = trpc.metasploit.deployNode.useMutation();
  const checkNodeMutation = trpc.metasploit.checkNode.useMutation();
  const setActiveNodeMutation = trpc.metasploit.setActiveNode.useMutation();
  const removeNodeMutation = trpc.metasploit.removeNode.useMutation();

  const searchMutation = trpc.metasploit.searchModules.useMutation();
  const moduleInfoMutation = trpc.metasploit.getModuleInfo.useMutation();
  const sessionsMutation = trpc.metasploit.listSessions.useMutation();
  const killSessionMutation = trpc.metasploit.killSession.useMutation();
  const runModuleMutation = trpc.metasploit.runModule.useMutation();
  const generatePayloadMutation = trpc.metasploit.generatePayload.useMutation();
  const workspacesMutation = trpc.metasploit.listWorkspaces.useMutation();
  const hostsMutation = trpc.metasploit.listHosts.useMutation();
  const servicesMutation = trpc.metasploit.listServices.useMutation();
  const vulnsMutation = trpc.metasploit.listVulns.useMutation();
  const commandMutation = trpc.metasploit.runCommand.useMutation();
  const statusMutation = trpc.metasploit.getStatus.useMutation();
  const installMutation = trpc.metasploit.install.useMutation();
  const updateMutation = trpc.metasploit.update.useMutation();
  const startRpcdMutation = trpc.metasploit.startRpcd.useMutation();
  const stopRpcdMutation = trpc.metasploit.stopRpcd.useMutation();

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    try {
      const result = await searchMutation.mutateAsync({ query: searchQuery, type: searchType });
      setTerminalOutput(result.raw || "");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleModuleInfo = async (mod: string) => {
    setSelectedModule(mod);
    try {
      const result = await moduleInfoMutation.mutateAsync({ module: mod });
      setTerminalOutput(result.output);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleRunModule = async () => {
    if (!selectedModule) {
      toast.error("No module selected");
      return;
    }
    try {
      toast.loading("Running module...", { id: "run" });
      const result = await runModuleMutation.mutateAsync({
        module: selectedModule,
        options: moduleOptions,
        payload: payload || undefined,
      });
      setTerminalOutput(result.output);
      toast.success("Module executed", { id: "run" });
    } catch (err: any) {
      toast.error(err.message, { id: "run" });
    }
  };

  const handleGeneratePayload = async () => {
    if (!lhost) {
      toast.error("LHOST is required");
      return;
    }
    try {
      toast.loading("Generating payload...", { id: "payload" });
      const result = await generatePayloadMutation.mutateAsync({
        payload: payloadType,
        lhost,
        lport: parseInt(lport),
        format: payloadFormat,
        encoder: encoder || undefined,
      });
      setTerminalOutput(result.output);
      toast.success(`Payload saved to ${result.outputFile}`, { id: "payload" });
    } catch (err: any) {
      toast.error(err.message, { id: "payload" });
    }
  };

  const handleRunCommand = async () => {
    if (!terminalCommand.trim()) return;
    try {
      const result = await commandMutation.mutateAsync({ command: terminalCommand });
      setTerminalOutput(prev => `msf6 > ${terminalCommand}\n${result.output}\n\n${prev}`);
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
          <div className="bg-blue-500/10 rounded-xl p-3">
            <Shield className="w-8 h-8 text-blue-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              Metasploit Framework
              <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-xs">Latest</Badge>
              <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-xs">Titan</Badge>
            </h1>
            <p className="text-zinc-500">
              World's most used penetration testing framework — remote management via SSH
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {connected ? (
            <div className="flex items-center gap-2">
              <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                <Wifi className="w-3 h-3 mr-1" />
                {connection?.nodeLabel ?? connection?.host ?? "Node Active"}
              </Badge>
              <Button size="sm" variant="outline" className="border-zinc-700" onClick={() => setShowSetup(true)}>
                <Settings className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <Button onClick={() => setShowSetup(true)} className="bg-blue-600 hover:bg-blue-700">
              <Server className="w-4 h-4 mr-2" /> Add VPS Node
            </Button>
          )}
        </div>
      </div>

      {/* Disclaimer */}
      <Card className="bg-amber-500/5 border-amber-500/20">
        <CardContent className="p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-amber-300/80">
            <strong className="text-amber-300">Authorised Use Only.</strong> Metasploit is a professional penetration testing tool.
            Only use against systems for which you have explicit written authorisation.
            Unauthorised access to computer systems is a criminal offence in most jurisdictions.
          </p>
        </CardContent>
      </Card>

      {/* Not Connected State */}
      {!connected && (
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="p-12 text-center">
            <WifiOff className="w-16 h-16 text-zinc-600 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-white mb-2">No Server Connected</h2>
            <p className="text-zinc-500 max-w-md mx-auto mb-6">
              Connect to a VPS with Metasploit Framework installed to manage exploits,
              sessions, and payloads from this dashboard.
            </p>
            <div className="space-y-3 text-left max-w-sm mx-auto mb-6">
              {[
                "Deploy a VPS (Kali Linux or Ubuntu recommended)",
                "Enter your SSH credentials to connect",
                "Install Metasploit Framework with one click",
                "Search modules, run exploits, manage sessions",
              ].map((step, i) => (
                <div key={i} className="flex items-start gap-3 text-sm">
                  <div className="bg-blue-500/10 rounded-full p-1 mt-0.5 flex-shrink-0">
                    <span className="text-blue-400 text-xs font-bold w-4 h-4 flex items-center justify-center">{i + 1}</span>
                  </div>
                  <p className="text-zinc-400">{step}</p>
                </div>
              ))}
            </div>
            <Button onClick={() => setShowSetup(true)} className="bg-blue-600 hover:bg-blue-700">
              <Server className="w-4 h-4 mr-2" /> Connect Your Server
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Main Dashboard */}
      {connected && (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-zinc-900 border border-zinc-800 p-1 flex-wrap h-auto gap-1">
            <TabsTrigger value="modules" className="data-[state=active]:bg-zinc-800 data-[state=active]:text-white">
              <Search className="w-4 h-4 mr-2" /> Modules
            </TabsTrigger>
            <TabsTrigger value="sessions" className="data-[state=active]:bg-zinc-800 data-[state=active]:text-white">
              <Zap className="w-4 h-4 mr-2" /> Sessions
            </TabsTrigger>
            <TabsTrigger value="payload" className="data-[state=active]:bg-zinc-800 data-[state=active]:text-white">
              <Package className="w-4 h-4 mr-2" /> Payload Gen
            </TabsTrigger>
            <TabsTrigger value="database" className="data-[state=active]:bg-zinc-800 data-[state=active]:text-white">
              <Database className="w-4 h-4 mr-2" /> Database
            </TabsTrigger>
            <TabsTrigger value="terminal" className="data-[state=active]:bg-zinc-800 data-[state=active]:text-white">
              <Terminal className="w-4 h-4 mr-2" /> Console
            </TabsTrigger>
            <TabsTrigger value="server" className="data-[state=active]:bg-zinc-800 data-[state=active]:text-white">
              <Server className="w-4 h-4 mr-2" /> Server
            </TabsTrigger>
          </TabsList>

          {/* Modules Tab */}
          <TabsContent value="modules" className="space-y-4">
            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardHeader>
                <CardTitle className="text-white text-base flex items-center gap-2">
                  <Search className="w-4 h-4 text-blue-400" />
                  Module Search
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                    <Input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                      placeholder="Search modules (e.g. ms17-010, eternalblue, smb)..."
                      className="bg-zinc-800 border-zinc-700 text-white pl-9"
                    />
                  </div>
                  <Select value={searchType} onValueChange={(v: any) => setSearchType(v)}>
                    <SelectTrigger className="w-36 bg-zinc-900 border-zinc-800 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-zinc-800">
                      {["all", "exploit", "auxiliary", "post", "payload", "encoder", "nop"].map(t => (
                        <SelectItem key={t} value={t} className="text-white hover:bg-zinc-800 capitalize">{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    className="bg-blue-600 hover:bg-blue-700"
                    onClick={handleSearch}
                    disabled={searchMutation.isPending || !searchQuery.trim()}
                  >
                    {searchMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  </Button>
                </div>
                {searchMutation.data?.modules && searchMutation.data.modules.length > 0 && (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {searchMutation.data.modules.map((mod, i) => (
                      <div
                        key={i}
                        className={`bg-zinc-800/50 rounded-lg p-3 cursor-pointer hover:bg-zinc-800 transition-colors ${selectedModule === mod.name ? "border border-blue-500/50" : ""}`}
                        onClick={() => handleModuleInfo(mod.name)}
                      >
                        <div className="flex items-center justify-between">
                          <code className="text-blue-400 text-sm font-mono">{mod.name}</code>
                          <Badge className="bg-zinc-700 text-zinc-300 border-zinc-600 text-xs">{mod.rank}</Badge>
                        </div>
                        <p className="text-zinc-400 text-xs mt-1">{mod.description}</p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Module Runner */}
            {selectedModule && (
              <Card className="bg-zinc-900/50 border-zinc-800">
                <CardHeader>
                  <CardTitle className="text-white text-base flex items-center gap-2">
                    <Play className="w-4 h-4 text-blue-400" />
                    Run Module
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="bg-zinc-800/50 rounded-lg p-3">
                    <p className="text-zinc-400 text-xs mb-1">Selected Module</p>
                    <code className="text-blue-400 font-mono text-sm">{selectedModule}</code>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {["RHOSTS", "RPORT", "LHOST", "LPORT"].map(opt => (
                      <div key={opt}>
                        <Label className="text-zinc-400 text-xs">{opt}</Label>
                        <Input
                          value={moduleOptions[opt] || ""}
                          onChange={(e) => setModuleOptions(prev => ({ ...prev, [opt]: e.target.value }))}
                          placeholder={opt === "RPORT" ? "443" : opt === "LPORT" ? "4444" : ""}
                          className="bg-zinc-800 border-zinc-700 text-white text-sm"
                        />
                      </div>
                    ))}
                  </div>
                  <div>
                    <Label className="text-zinc-400 text-xs">Payload (optional)</Label>
                    <Input
                      value={payload}
                      onChange={(e) => setPayload(e.target.value)}
                      placeholder="windows/meterpreter/reverse_tcp"
                      className="bg-zinc-800 border-zinc-700 text-white text-sm"
                    />
                  </div>
                  <div className="flex gap-3">
                    <Button
                      className="bg-blue-600 hover:bg-blue-700 flex-1"
                      onClick={handleRunModule}
                      disabled={runModuleMutation.isPending}
                    >
                      {runModuleMutation.isPending ? (
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Play className="w-4 h-4 mr-2" />
                      )}
                      Run Module
                    </Button>
                    <Button
                      variant="outline"
                      className="border-zinc-700"
                      onClick={() => handleModuleInfo(selectedModule)}
                    >
                      Info
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Output */}
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

          {/* Sessions Tab */}
          <TabsContent value="sessions" className="space-y-4">
            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-white text-base flex items-center gap-2">
                  <Zap className="w-4 h-4 text-blue-400" />
                  Active Sessions
                </CardTitle>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-zinc-700"
                  onClick={() => sessionsMutation.mutateAsync().then(r => setTerminalOutput(r.raw || ""))}
                  disabled={sessionsMutation.isPending}
                >
                  <RefreshCw className={`w-4 h-4 mr-2 ${sessionsMutation.isPending ? "animate-spin" : ""}`} />
                  Refresh
                </Button>
              </CardHeader>
              <CardContent>
                {sessionsMutation.data?.sessions && sessionsMutation.data.sessions.length > 0 ? (
                  <div className="space-y-2">
                    {sessionsMutation.data.sessions.map((session, i) => (
                      <div key={i} className="bg-zinc-800/50 rounded-lg p-3 flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs">
                              Session {session.id}
                            </Badge>
                            <span className="text-white text-sm">{session.type}</span>
                          </div>
                          <p className="text-zinc-400 text-xs mt-1">{session.info}</p>
                          <p className="text-zinc-500 text-xs font-mono">{session.connection}</p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-zinc-700 h-7"
                            onClick={() => {
                              setActiveTab("terminal");
                              setTerminalCommand(`sessions -i ${session.id}`);
                            }}
                          >
                            <Terminal className="w-3 h-3 mr-1" /> Interact
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-red-700 text-red-400 hover:bg-red-500/10 h-7"
                            onClick={() => killSessionMutation.mutateAsync({ sessionId: parseInt(session.id) })}
                          >
                            <Square className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Zap className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
                    <p className="text-zinc-500">No active sessions. Run an exploit to establish a session.</p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-zinc-700 mt-4"
                      onClick={() => sessionsMutation.mutateAsync()}
                    >
                      Check Sessions
                    </Button>
                  </div>
                )}
                {terminalOutput && (
                  <div className="mt-4 bg-zinc-950 rounded-lg p-4 font-mono text-xs text-green-400 max-h-48 overflow-y-auto whitespace-pre-wrap">
                    {terminalOutput}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Payload Generator Tab */}
          <TabsContent value="payload" className="space-y-4">
            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardHeader>
                <CardTitle className="text-white text-base flex items-center gap-2">
                  <Package className="w-4 h-4 text-blue-400" />
                  msfvenom Payload Generator
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-zinc-400">Payload</Label>
                  <Input
                    value={payloadType}
                    onChange={(e) => setPayloadType(e.target.value)}
                    placeholder="windows/meterpreter/reverse_tcp"
                    className="bg-zinc-800 border-zinc-700 text-white font-mono text-sm"
                  />
                  <div className="flex gap-2 mt-2 flex-wrap">
                    {[
                      "windows/meterpreter/reverse_tcp",
                      "linux/x86/meterpreter/reverse_tcp",
                      "osx/x64/meterpreter/reverse_tcp",
                      "php/meterpreter/reverse_tcp",
                      "python/meterpreter/reverse_tcp",
                    ].map(p => (
                      <Button
                        key={p}
                        size="sm"
                        variant="outline"
                        className="border-zinc-700 text-zinc-400 text-xs font-mono"
                        onClick={() => setPayloadType(p)}
                      >
                        {p.split("/")[0]}
                      </Button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <Label className="text-zinc-400">LHOST (your listener IP)</Label>
                    <Input
                      value={lhost}
                      onChange={(e) => setLhost(e.target.value)}
                      placeholder="192.168.1.100"
                      className="bg-zinc-800 border-zinc-700 text-white"
                    />
                  </div>
                  <div>
                    <Label className="text-zinc-400">LPORT</Label>
                    <Input
                      value={lport}
                      onChange={(e) => setLport(e.target.value)}
                      placeholder="4444"
                      className="bg-zinc-800 border-zinc-700 text-white"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-zinc-400">Output Format</Label>
                    <Select value={payloadFormat} onValueChange={(v: any) => setPayloadFormat(v)}>
                      <SelectTrigger className="bg-zinc-900 border-zinc-800 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-zinc-900 border-zinc-800">
                        {["exe", "elf", "macho", "raw", "python", "ruby", "bash", "powershell", "asp", "aspx", "jsp", "php", "war"].map(f => (
                          <SelectItem key={f} value={f} className="text-white hover:bg-zinc-800">{f}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-zinc-400">Encoder (optional)</Label>
                    <Input
                      value={encoder}
                      onChange={(e) => setEncoder(e.target.value)}
                      placeholder="x86/shikata_ga_nai"
                      className="bg-zinc-800 border-zinc-700 text-white font-mono text-sm"
                    />
                  </div>
                </div>
                <Button
                  className="w-full bg-blue-600 hover:bg-blue-700"
                  onClick={handleGeneratePayload}
                  disabled={generatePayloadMutation.isPending || !lhost}
                >
                  {generatePayloadMutation.isPending ? (
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Cpu className="w-4 h-4 mr-2" />
                  )}
                  Generate Payload
                </Button>
                {generatePayloadMutation.data && (
                  <div className="bg-zinc-950 rounded-lg p-4 font-mono text-xs text-green-400 whitespace-pre-wrap">
                    {generatePayloadMutation.data.output}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Database Tab */}
          <TabsContent value="database" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: "Hosts", icon: Globe, action: () => hostsMutation.mutateAsync().then(r => setTerminalOutput(r.output)) },
                { label: "Services", icon: Layers, action: () => servicesMutation.mutateAsync().then(r => setTerminalOutput(r.output)) },
                { label: "Vulnerabilities", icon: Lock, action: () => vulnsMutation.mutateAsync().then(r => setTerminalOutput(r.output)) },
                { label: "Workspaces", icon: Database, action: () => workspacesMutation.mutateAsync().then(r => setTerminalOutput(r.raw || "")) },
              ].map(({ label, icon: Icon, action }) => (
                <Card key={label} className="bg-zinc-900/50 border-zinc-800 cursor-pointer hover:border-zinc-700 transition-colors" onClick={action}>
                  <CardContent className="p-6 text-center">
                    <Icon className="w-8 h-8 text-blue-400 mx-auto mb-3" />
                    <p className="text-white font-medium">{label}</p>
                    <p className="text-zinc-500 text-xs mt-1">Click to list</p>
                  </CardContent>
                </Card>
              ))}
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

          {/* Terminal / Console Tab */}
          <TabsContent value="terminal" className="space-y-4">
            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardHeader>
                <CardTitle className="text-white text-base flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-blue-400" />
                  msfconsole
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-zinc-950 rounded-lg p-4 font-mono text-xs text-green-400 min-h-48 max-h-96 overflow-y-auto whitespace-pre-wrap">
                  {terminalOutput || "msf6 > # Metasploit Framework Console\n# Enter commands below to execute in msfconsole\n"}
                </div>
                <div className="flex gap-2">
                  <Input
                    value={terminalCommand}
                    onChange={(e) => setTerminalCommand(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleRunCommand()}
                    placeholder="Enter msfconsole command..."
                    className="bg-zinc-800 border-zinc-700 text-white font-mono text-sm"
                  />
                  <Button
                    className="bg-blue-600 hover:bg-blue-700"
                    onClick={handleRunCommand}
                    disabled={commandMutation.isPending || !terminalCommand.trim()}
                  >
                    {commandMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                  </Button>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {[
                    "help",
                    "version",
                    "sessions -l",
                    "hosts",
                    "services",
                    "vulns",
                    "workspace",
                    "db_status",
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
                    <Package className="w-4 h-4 text-blue-400" />
                    Installation
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-zinc-400 text-sm">
                    Install the latest Metasploit Framework via official Rapid7 repository.
                  </p>
                  <Button
                    className="w-full bg-blue-600 hover:bg-blue-700"
                    onClick={() => installMutation.mutateAsync().then(r => setTerminalOutput(r.output))}
                    disabled={installMutation.isPending}
                  >
                    {installMutation.isPending ? (
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Download className="w-4 h-4 mr-2" />
                    )}
                    Install Metasploit
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
                  <Button
                    variant="outline"
                    className="w-full border-zinc-700"
                    onClick={() => statusMutation.mutateAsync().then(r => setTerminalOutput(r.raw || ""))}
                    disabled={statusMutation.isPending}
                  >
                    Check Status
                  </Button>
                </CardContent>
              </Card>
              <Card className="bg-zinc-900/50 border-zinc-800">
                <CardHeader>
                  <CardTitle className="text-white text-base flex items-center gap-2">
                    <Lock className="w-4 h-4 text-blue-400" />
                    msfrpcd (RPC Daemon)
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-zinc-400 text-sm">
                    Start the Metasploit RPC daemon for programmatic API access.
                  </p>
                  <div>
                    <Label className="text-zinc-400 text-xs">RPC Password</Label>
                    <Input
                      type="password"
                      value={rpcPassword}
                      onChange={(e) => setRpcPassword(e.target.value)}
                      placeholder="Min 8 characters"
                      className="bg-zinc-800 border-zinc-700 text-white"
                    />
                  </div>
                  <div>
                    <Label className="text-zinc-400 text-xs">RPC Port</Label>
                    <Input
                      value={rpcPort}
                      onChange={(e) => setRpcPort(e.target.value)}
                      placeholder="55553"
                      className="bg-zinc-800 border-zinc-700 text-white"
                    />
                  </div>
                  <Button
                    className="w-full bg-blue-600 hover:bg-blue-700"
                    onClick={() => startRpcdMutation.mutateAsync({
                      rpcPassword,
                      rpcPort: parseInt(rpcPort),
                      ssl: true,
                    }).then(r => toast.success(r.message))}
                    disabled={startRpcdMutation.isPending || !rpcPassword}
                  >
                    <Play className="w-4 h-4 mr-2" /> Start msfrpcd
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full border-red-700 text-red-400 hover:bg-red-500/10"
                    onClick={() => stopRpcdMutation.mutateAsync().then(() => toast.success("msfrpcd stopped"))}
                    disabled={stopRpcdMutation.isPending}
                  >
                    <Square className="w-4 h-4 mr-2" /> Stop msfrpcd
                  </Button>
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

      {/* VPS Node Manager Dialog */}
      <VpsNodeManager
        open={showSetup}
        onClose={() => {
          setShowSetup(false);
          connectionQuery.refetch();
          listNodesQuery.refetch();
        }}
        toolName="Metasploit"
        accentColor="blue"
        deployLabel="Deploy Metasploit"
        hooks={{
          listNodes: listNodesQuery,
          addNode: addNodeMutation,
          deployNode: deployNodeMutation,
          checkNode: checkNodeMutation,
          setActiveNode: setActiveNodeMutation,
          removeNode: removeNodeMutation,
        }}
      />
    </div>
  );
}
