import { useState, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload, FileText, CheckCircle2, XCircle, AlertTriangle, Download, Loader2, Info } from "lucide-react";
import { toast } from "sonner";

type ImportSource = "1password" | "lastpass" | "bitwarden" | "csv";

const SOURCE_INFO: Record<ImportSource, { name: string; description: string; instructions: string }> = {
  "1password": {
    name: "1Password",
    description: "Import from 1Password CSV export",
    instructions: "In 1Password, go to File → Export → All Vaults. Choose CSV format.",
  },
  lastpass: {
    name: "LastPass",
    description: "Import from LastPass CSV export",
    instructions: "In LastPass, go to Account Options → Advanced → Export. Save as CSV.",
  },
  bitwarden: {
    name: "Bitwarden",
    description: "Import from Bitwarden CSV/JSON export",
    instructions: "In Bitwarden, go to Tools → Export Vault. Choose CSV format.",
  },
  csv: {
    name: "Generic CSV",
    description: "Import from any CSV with standard columns",
    instructions: "CSV must have columns: name/title, username/login, password/secret, url/website (optional). Works with Dashlane, KeePass, Chrome, and other exports.",
  },
};

export default function ImportPage() {
  const [source, setSource] = useState<ImportSource | "">("");
  const [file, setFile] = useState<File | null>(null);
  const [csvContent, setCsvContent] = useState<string>("");
  const [dragOver, setDragOver] = useState(false);


  const importMutation = trpc.import.importCSV.useMutation({
    onSuccess: (data) => {
      toast.success(`Imported ${data.importedCount} credentials. ${data.skippedCount} skipped, ${data.errorCount} errors.`);
      setFile(null);
      setCsvContent("");
      historyQuery.refetch();
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const historyQuery = trpc.import.history.useQuery();

  const handleFile = useCallback((f: File) => {
    if (!f.name.endsWith(".csv") && !f.name.endsWith(".txt")) {
      toast.error("Please upload a .csv file");
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      toast.error("Maximum file size is 10MB");
      return;
    }
    setFile(f);
    const reader = new FileReader();
    reader.onload = (e) => setCsvContent(e.target?.result as string);
    reader.readAsText(f);
  }, [toast]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, [handleFile]);

  const handleImport = () => {
    if (!source || !csvContent) return;
    importMutation.mutate({ source, csvText: csvContent, fileName: file?.name });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Import Credentials</h1>
        <p className="text-muted-foreground mt-1">
          Import credentials from password managers and other sources
        </p>
      </div>

      {/* Source Selection */}
      <Card className="bg-card/50 border-white/5">
        <CardHeader>
          <CardTitle className="text-lg">Step 1: Select Source</CardTitle>
          <CardDescription>Choose where you're importing from</CardDescription>
        </CardHeader>
        <CardContent>
          <Select value={source} onValueChange={(v) => setSource(v as ImportSource)}>
            <SelectTrigger className="w-full max-w-sm">
              <SelectValue placeholder="Select import source..." />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(SOURCE_INFO).map(([key, info]) => (
                <SelectItem key={key} value={key}>
                  {info.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {source && (
            <Alert className="mt-4 bg-blue-500/5 border-blue-500/20">
              <Info className="h-4 w-4 text-blue-400" />
              <AlertDescription className="text-sm text-muted-foreground">
                <strong className="text-foreground">{SOURCE_INFO[source].name}:</strong>{" "}
                {SOURCE_INFO[source].instructions}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* File Upload */}
      <Card className="bg-card/50 border-white/5">
        <CardHeader>
          <CardTitle className="text-lg">Step 2: Upload CSV File</CardTitle>
          <CardDescription>Drag & drop or click to select your export file</CardDescription>
        </CardHeader>
        <CardContent>
          <div
            className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer ${
              dragOver ? "border-blue-400 bg-blue-500/5" : "border-white/10 hover:border-white/20"
            }`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => {
              const input = document.createElement("input");
              input.type = "file";
              input.accept = ".csv,.txt";
              input.onchange = (e) => {
                const f = (e.target as HTMLInputElement).files?.[0];
                if (f) handleFile(f);
              };
              input.click();
            }}
          >
            {file ? (
              <div className="flex items-center justify-center gap-3">
                <FileText className="h-8 w-8 text-blue-400" />
                <div className="text-left">
                  <p className="font-medium">{file.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {(file.size / 1024).toFixed(1)} KB
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setFile(null); setCsvContent(""); }}>
                  Remove
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <Upload className="h-10 w-10 mx-auto text-muted-foreground" />
                <p className="text-muted-foreground">Drop your CSV file here or click to browse</p>
                <p className="text-xs text-muted-foreground/60">Supports .csv files up to 10MB</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Import Button */}
      <div className="flex justify-end">
        <Button
          onClick={handleImport}
          disabled={!source || !csvContent || importMutation.isPending}
          className="bg-blue-600 hover:bg-blue-500"
          size="lg"
        >
          {importMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Importing...
            </>
          ) : (
            <>
              <Download className="h-4 w-4 mr-2" />
              Import Credentials
            </>
          )}
        </Button>
      </div>

      {/* Import Result */}
      {importMutation.data && (
        <Card className="bg-card/50 border-white/5">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-400" />
              Import Results
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-4 rounded-lg bg-green-500/5 border border-green-500/10">
                <p className="text-2xl font-bold text-green-400">{importMutation.data.importedCount}</p>
                <p className="text-sm text-muted-foreground">Imported</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-yellow-500/5 border border-yellow-500/10">
                <p className="text-2xl font-bold text-yellow-400">{importMutation.data.skippedCount}</p>
                <p className="text-sm text-muted-foreground">Skipped</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-red-500/5 border border-red-500/10">
                <p className="text-2xl font-bold text-red-400">{importMutation.data.errorCount}</p>
                <p className="text-sm text-muted-foreground">Errors</p>
              </div>
            </div>
            {importMutation.data.errors && importMutation.data.errors.length > 0 && (
              <div className="mt-4 space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Error details:</p>
                {importMutation.data.errors.slice(0, 10).map((err, i) => (
                  <p key={i} className="text-xs text-red-400/80 font-mono">{err}</p>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Import History */}
      <Card className="bg-card/50 border-white/5">
        <CardHeader>
          <CardTitle className="text-lg">Import History</CardTitle>
          <CardDescription>Previous imports into your vault</CardDescription>
        </CardHeader>
        <CardContent>
          {historyQuery.isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !historyQuery.data?.length ? (
            <p className="text-sm text-muted-foreground text-center py-8">No imports yet</p>
          ) : (
            <div className="space-y-3">
              {historyQuery.data.map((item) => (
                <div key={item.id} className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02] border border-white/5">
                  <div className="flex items-center gap-3">
                    {item.status === "completed" ? (
                      <CheckCircle2 className="h-4 w-4 text-green-400" />
                    ) : item.status === "failed" ? (
                      <XCircle className="h-4 w-4 text-red-400" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-yellow-400" />
                    )}
                    <div>
                      <p className="text-sm font-medium capitalize">{item.source}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(item.createdAt).toLocaleDateString()} — {item.importedCount} imported, {item.skippedCount} skipped
                      </p>
                    </div>
                  </div>
                  <Badge variant={item.status === "completed" ? "default" : item.status === "failed" ? "destructive" : "secondary"}>
                    {item.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
