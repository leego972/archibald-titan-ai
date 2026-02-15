import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Clock,
  Plus,
  Copy,
  Trash2,
  Key,
  Shield,
  RefreshCw,
  QrCode,
  Loader2,
  Eye,
  EyeOff,
  Search,
} from "lucide-react";
import { useState, useEffect, useCallback, useRef } from "react";

/** Circular countdown indicator */
function CountdownRing({
  remaining,
  period,
}: {
  remaining: number;
  period: number;
}) {
  const pct = (remaining / period) * 100;
  const isLow = remaining <= 5;
  const circumference = 2 * Math.PI * 14;
  const offset = circumference - (pct / 100) * circumference;

  return (
    <div className="relative h-9 w-9 shrink-0">
      <svg className="h-9 w-9 -rotate-90" viewBox="0 0 36 36">
        <circle
          cx="18"
          cy="18"
          r="14"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          className="text-muted/30"
        />
        <circle
          cx="18"
          cy="18"
          r="14"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className={isLow ? "text-destructive" : "text-blue-500"}
          style={{ transition: "stroke-dashoffset 1s linear" }}
        />
      </svg>
      <span
        className={`absolute inset-0 flex items-center justify-center text-[10px] font-mono font-bold ${
          isLow ? "text-destructive" : "text-muted-foreground"
        }`}
      >
        {remaining}
      </span>
    </div>
  );
}

export default function TotpVaultPage() {
  const [showAdd, setShowAdd] = useState(false);
  const [showUri, setShowUri] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [tick, setTick] = useState(0);

  // Form state
  const [name, setName] = useState("");
  const [issuer, setIssuer] = useState("");
  const [secret, setSecret] = useState("");
  const [algorithm, setAlgorithm] = useState<"SHA1" | "SHA256" | "SHA512">("SHA1");
  const [digits, setDigits] = useState(6);
  const [period, setPeriod] = useState(30);
  const [uriInput, setUriInput] = useState("");
  const [showSecret, setShowSecret] = useState(false);

  const utils = trpc.useUtils();

  // Auto-refresh every second for countdown
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  // Refetch codes every period to get fresh codes
  const listQuery = trpc.totpVault.list.useQuery(undefined, {
    refetchInterval: 30000,
  });

  const addMutation = trpc.totpVault.add.useMutation({
    onSuccess: (data) => {
      toast.success(`Added ${data.name} to TOTP Vault`);
      setShowAdd(false);
      resetForm();
      utils.totpVault.list.invalidate();
    },
    onError: (err) => {
      toast.error(err.message || "Failed to add TOTP entry");
    },
  });

  const deleteMutation = trpc.totpVault.delete.useMutation({
    onSuccess: () => {
      toast.success("TOTP entry deleted");
      setDeleteId(null);
      utils.totpVault.list.invalidate();
    },
    onError: (err) => {
      toast.error(err.message || "Failed to delete entry");
    },
  });

  const parseUriMutation = trpc.totpVault.parseUri.useMutation({
    onSuccess: (data) => {
      setName(data.name);
      setIssuer(data.issuer);
      setSecret(data.secret);
      setAlgorithm(data.algorithm);
      setDigits(data.digits);
      setPeriod(data.period);
      setShowUri(false);
      setUriInput("");
      setShowAdd(true);
      toast.success("URI parsed successfully — review and save");
    },
    onError: (err) => {
      toast.error(err.message || "Invalid otpauth:// URI");
    },
  });

  const resetForm = useCallback(() => {
    setName("");
    setIssuer("");
    setSecret("");
    setAlgorithm("SHA1");
    setDigits(6);
    setPeriod(30);
    setShowSecret(false);
  }, []);

  const handleAdd = () => {
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }
    if (!secret.trim()) {
      toast.error("Secret key is required");
      return;
    }
    addMutation.mutate({
      name: name.trim(),
      issuer: issuer.trim() || undefined,
      secret: secret.trim().replace(/\s/g, "").toUpperCase(),
      algorithm,
      digits,
      period,
    });
  };

  const handleCopy = async (code: string, id: number) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedId(id);
      toast.success("Code copied to clipboard");
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast.error("Failed to copy code");
    }
  };

  const entries = listQuery.data || [];
  const filtered = search
    ? entries.filter(
        (e) =>
          e.name.toLowerCase().includes(search.toLowerCase()) ||
          (e.issuer && e.issuer.toLowerCase().includes(search.toLowerCase()))
      )
    : entries;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">TOTP Vault</h1>
          <p className="text-muted-foreground mt-1">
            Store and generate time-based one-time passwords for your accounts.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowUri(true)}
            className="gap-1.5"
          >
            <QrCode className="h-4 w-4" />
            Import URI
          </Button>
          <Button
            size="sm"
            onClick={() => {
              resetForm();
              setShowAdd(true);
            }}
            className="gap-1.5"
          >
            <Plus className="h-4 w-4" />
            Add Entry
          </Button>
        </div>
      </div>

      {/* Search */}
      {entries.length > 0 && (
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search entries..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      )}

      {/* Entries */}
      {listQuery.isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Shield className="h-12 w-12 text-muted-foreground/40 mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              {entries.length === 0 ? "No TOTP Entries Yet" : "No Matching Entries"}
            </h3>
            <p className="text-sm text-muted-foreground max-w-sm mb-4">
              {entries.length === 0
                ? "Add your first TOTP secret to start generating one-time passwords. You can enter the secret manually or import an otpauth:// URI."
                : "Try adjusting your search query."}
            </p>
            {entries.length === 0 && (
              <Button
                onClick={() => {
                  resetForm();
                  setShowAdd(true);
                }}
                className="gap-1.5"
              >
                <Plus className="h-4 w-4" />
                Add Your First Entry
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((entry) => (
            <Card key={entry.id} className="overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  {/* Icon */}
                  <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                    <Key className="h-5 w-5 text-blue-500" />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{entry.name}</span>
                      {entry.issuer && (
                        <Badge variant="secondary" className="text-[10px] shrink-0">
                          {entry.issuer}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                      <span>{entry.digits}-digit</span>
                      <span>·</span>
                      <span>{entry.period}s</span>
                      {entry.algorithm !== "SHA1" && (
                        <>
                          <span>·</span>
                          <span>{entry.algorithm}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Code + Countdown */}
                  <div className="flex items-center gap-3 shrink-0">
                    <button
                      onClick={() => handleCopy(entry.currentCode, entry.id)}
                      className="font-mono text-xl tracking-[0.3em] font-bold hover:text-blue-500 transition-colors cursor-pointer select-all"
                      title="Click to copy"
                    >
                      {entry.currentCode.slice(0, 3)}{" "}
                      {entry.currentCode.slice(3)}
                    </button>
                    <CountdownRing
                      remaining={entry.remainingSeconds}
                      period={entry.period}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => setDeleteId(entry.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add TOTP Entry</DialogTitle>
            <DialogDescription>
              Enter the details from your authenticator setup. The secret key is
              usually shown as a base32 string.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="totp-name">Name *</Label>
              <Input
                id="totp-name"
                placeholder="e.g. GitHub, AWS, Google"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="totp-issuer">Issuer</Label>
              <Input
                id="totp-issuer"
                placeholder="e.g. github.com"
                value={issuer}
                onChange={(e) => setIssuer(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="totp-secret">Secret Key *</Label>
              <div className="relative">
                <Input
                  id="totp-secret"
                  type={showSecret ? "text" : "password"}
                  placeholder="JBSWY3DPEHPK3PXP"
                  value={secret}
                  onChange={(e) => setSecret(e.target.value)}
                  className="pr-10 font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowSecret(!showSecret)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showSecret ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>Algorithm</Label>
                <Select
                  value={algorithm}
                  onValueChange={(v) =>
                    setAlgorithm(v as "SHA1" | "SHA256" | "SHA512")
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SHA1">SHA-1</SelectItem>
                    <SelectItem value="SHA256">SHA-256</SelectItem>
                    <SelectItem value="SHA512">SHA-512</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="totp-digits">Digits</Label>
                <Input
                  id="totp-digits"
                  type="number"
                  min={6}
                  max={8}
                  value={digits}
                  onChange={(e) => setDigits(parseInt(e.target.value) || 6)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="totp-period">Period (s)</Label>
                <Input
                  id="totp-period"
                  type="number"
                  min={15}
                  max={120}
                  value={period}
                  onChange={(e) => setPeriod(parseInt(e.target.value) || 30)}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAdd}
              disabled={addMutation.isPending}
              className="gap-1.5"
            >
              {addMutation.isPending && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              Add Entry
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import URI Dialog */}
      <Dialog open={showUri} onOpenChange={setShowUri}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Import from URI</DialogTitle>
            <DialogDescription>
              Paste an otpauth:// URI to auto-fill the TOTP entry details.
              These URIs are typically encoded in QR codes shown during 2FA
              setup.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="uri-input">otpauth:// URI</Label>
            <Input
              id="uri-input"
              placeholder="otpauth://totp/Example:user@example.com?secret=JBSWY3DPEHPK3PXP&issuer=Example"
              value={uriInput}
              onChange={(e) => setUriInput(e.target.value)}
              className="font-mono text-xs"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUri(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => parseUriMutation.mutate({ uri: uriInput })}
              disabled={!uriInput.trim() || parseUriMutation.isPending}
              className="gap-1.5"
            >
              {parseUriMutation.isPending && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              Parse URI
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog
        open={deleteId !== null}
        onOpenChange={(open) => !open && setDeleteId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete TOTP Entry?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove this TOTP entry. You will no longer
              be able to generate codes for this account. Make sure you have an
              alternative 2FA method set up.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate({ id: deleteId })}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
