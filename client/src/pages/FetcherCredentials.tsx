import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { Loader2, RefreshCw, Trash2, Eye, EyeOff, KeyRound } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function FetcherCredentials() {
  const { data: credentials, isLoading, refetch } = trpc.fetcher.listCredentials.useQuery();
  const [revealedIds, setRevealedIds] = useState<Set<number>>(new Set());
  const [revealedValues, setRevealedValues] = useState<Record<number, string>>({});

  const deleteCred = trpc.fetcher.deleteCredential.useMutation({
    onSuccess: () => {
      toast.success("Credential deleted");
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const { data: decryptedCreds } = trpc.fetcher.revealCredential.useQuery(
    { credentialId: 0 },
    { enabled: revealedIds.size > 0 }
  );

  const toggleReveal = (id: number) => {
    setRevealedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Credentials Vault</h1>
          <p className="text-muted-foreground mt-1">
            All retrieved API keys and tokens, encrypted with AES-256-GCM.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {!credentials || credentials.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <KeyRound className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No credentials stored yet.</p>
            <p className="text-sm text-muted-foreground mt-1">
              Run a fetch job to retrieve API keys.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {credentials.map((cred) => {
            const isRevealed = revealedIds.has(cred.id);
            const decrypted = decryptedCreds?.find((d) => d.id === cred.id);

            return (
              <Card key={cred.id}>
                <CardContent className="flex items-center justify-between py-4">
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <KeyRound className="h-5 w-5 text-primary shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">{cred.providerName}</p>
                        <Badge variant="secondary" className="text-xs">
                          {cred.keyType}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 font-mono truncate">
                        {isRevealed && decrypted
                          ? decrypted.value
                          : cred.encryptedValue}
                      </p>
                      {cred.keyLabel && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {cred.keyLabel}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleReveal(cred.id)}
                    >
                      {isRevealed ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteCred.mutate({ credentialId: cred.id })}
                      disabled={deleteCred.isPending}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
