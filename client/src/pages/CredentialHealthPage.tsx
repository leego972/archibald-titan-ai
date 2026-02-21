import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Copy,
  RefreshCw,
  Loader2,
  Lock,
  Unlock,
  Key,
  Clock,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useSubscription } from "@/hooks/useSubscription";
import { UpgradeBanner } from "@/components/UpgradePrompt";

type ScanResult = {
  credentialId: number;
  providerId: string;
  providerName: string;
  label: string;
  breached: boolean;
  breachCount: number;
  strength: { score: number; issues: string[]; severity: string };
  isDuplicate: boolean;
  duplicateWith: string[];
  ageInDays: number;
  isOld: boolean;
  healthScore: number;
  recommendations: string[];
};

type ScanData = {
  overallScore: number;
  totalCredentials: number;
  breachedCount: number;
  weakCount: number;
  reusedCount: number;
  oldCount: number;
  results: ScanResult[];
  recommendations: string[];
  scannedAt: string;
};

function getScoreColor(score: number): string {
  if (score >= 80) return "text-green-500";
  if (score >= 60) return "text-yellow-500";
  if (score >= 40) return "text-orange-500";
  return "text-red-500";
}

function getScoreBg(score: number): string {
  if (score >= 80) return "bg-green-500/10 border-green-500/30";
  if (score >= 60) return "bg-yellow-500/10 border-yellow-500/30";
  if (score >= 40) return "bg-orange-500/10 border-orange-500/30";
  return "bg-red-500/10 border-red-500/30";
}

function getScoreLabel(score: number): string {
  if (score >= 80) return "Healthy";
  if (score >= 60) return "Fair";
  if (score >= 40) return "At Risk";
  return "Critical";
}

function getSeverityBadge(severity: string) {
  const colors: Record<string, string> = {
    critical: "bg-red-500/20 text-red-400 border-red-500/30",
    high: "bg-orange-500/20 text-orange-400 border-orange-500/30",
    medium: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    low: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    good: "bg-green-500/20 text-green-400 border-green-500/30",
  };
  return (
    <Badge variant="outline" className={colors[severity] || colors.medium}>
      {severity}
    </Badge>
  );
}

function ScoreRing({ score, size = 120 }: { score: number; size?: number }) {
  const radius = (size - 12) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = score >= 80 ? "#22c55e" : score >= 60 ? "#eab308" : score >= 40 ? "#f97316" : "#ef4444";

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="currentColor" strokeWidth="6" className="text-muted/30" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className={`text-2xl font-bold ${getScoreColor(score)}`}>{score}</span>
        <span className="text-xs text-muted-foreground">{getScoreLabel(score)}</span>
      </div>
    </div>
  );
}

function CredentialRow({ result }: { result: ScanResult }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-4 p-4 hover:bg-muted/30 transition-colors text-left"
      >
        <div className="flex-shrink-0">
          {result.healthScore >= 80 ? (
            <ShieldCheck className="h-5 w-5 text-green-500" />
          ) : result.healthScore >= 40 ? (
            <ShieldAlert className="h-5 w-5 text-yellow-500" />
          ) : (
            <ShieldX className="h-5 w-5 text-red-500" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium truncate">{result.providerName}</span>
            <span className="text-sm text-muted-foreground truncate">({result.label})</span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            {result.breached && (
              <Badge variant="outline" className="bg-red-500/20 text-red-400 border-red-500/30 text-xs">
                Breached
              </Badge>
            )}
            {result.isDuplicate && (
              <Badge variant="outline" className="bg-orange-500/20 text-orange-400 border-orange-500/30 text-xs">
                Reused
              </Badge>
            )}
            {result.isOld && (
              <Badge variant="outline" className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 text-xs">
                Old
              </Badge>
            )}
            {getSeverityBadge(result.strength.severity)}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className={`text-lg font-bold ${getScoreColor(result.healthScore)}`}>{result.healthScore}</span>
            <span className="text-xs text-muted-foreground block">/ 100</span>
          </div>
          {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-border p-4 bg-muted/10 space-y-3">
          {/* Strength Details */}
          <div className="flex items-start gap-3">
            <Key className="h-4 w-4 text-muted-foreground mt-0.5" />
            <div>
              <p className="text-sm font-medium">Strength Score: {result.strength.score}/100</p>
              {result.strength.issues.length > 0 && (
                <ul className="text-sm text-muted-foreground mt-1 space-y-0.5">
                  {result.strength.issues.map((issue, i) => (
                    <li key={i} className="flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3 text-yellow-500 flex-shrink-0" />
                      {issue}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Breach Info */}
          {result.breached && (
            <div className="flex items-start gap-3">
              <ShieldX className="h-4 w-4 text-red-500 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-400">
                  Found in {result.breachCount.toLocaleString()} data breaches
                </p>
                <p className="text-sm text-muted-foreground">
                  This credential appears in known breach databases. Rotate it immediately.
                </p>
              </div>
            </div>
          )}

          {/* Duplicate Info */}
          {result.isDuplicate && (
            <div className="flex items-start gap-3">
              <Copy className="h-4 w-4 text-orange-500 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-orange-400">
                  Reused across {result.duplicateWith.length + 1} providers
                </p>
                <p className="text-sm text-muted-foreground">
                  Also used with: {result.duplicateWith.join(", ")}
                </p>
              </div>
            </div>
          )}

          {/* Age Info */}
          <div className="flex items-start gap-3">
            <Clock className="h-4 w-4 text-muted-foreground mt-0.5" />
            <p className="text-sm text-muted-foreground">
              Credential age: {result.ageInDays} days {result.isOld && <span className="text-yellow-500">(consider rotating)</span>}
            </p>
          </div>

          {/* Recommendations */}
          {result.recommendations.length > 0 && (
            <div className="border-t border-border pt-3 mt-3">
              <p className="text-sm font-medium mb-2">Recommendations:</p>
              <ul className="space-y-1">
                {result.recommendations.map((rec, i) => (
                  <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                    <CheckCircle2 className="h-3 w-3 text-blue-500 mt-1 flex-shrink-0" />
                    {rec}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function CredentialHealthPage() {
  const sub = useSubscription();
  const [scanData, setScanData] = useState<ScanData | null>(null);

  // Cyber plan gate
  if (!sub.canUse("credential_health")) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-3">
            <Shield className="h-7 w-7 text-primary" />
            Credential Health
          </h1>
          <p className="text-muted-foreground mt-1">
            Analyze your credentials for breaches, weak passwords, and reuse.
          </p>
        </div>
        <UpgradeBanner feature="Credential Health Monitor" requiredPlan="cyber" />
      </div>
    );
  }

  const scanMutation = trpc.credentialHealth.scan.useMutation({
    onSuccess: (data) => {
      setScanData(data);
      toast.success(`Health scan complete — Score: ${data.overallScore}/100`);
    },
    onError: (err) => {
      toast.error(err.message || "Scan failed");
    },
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            Credential Health
          </h1>
          <p className="text-muted-foreground mt-1">
            Scan your credentials for breaches, weak passwords, duplicates, and age.
            Uses HaveIBeenPwned's k-anonymity API — your passwords never leave the server.
          </p>
        </div>
        <Button
          onClick={() => scanMutation.mutate()}
          disabled={scanMutation.isPending}
          size="lg"
        >
          {scanMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Scanning...
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4 mr-2" />
              Run Health Scan
            </>
          )}
        </Button>
      </div>

      {/* No scan yet */}
      {!scanData && !scanMutation.isPending && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Shield className="h-16 w-16 text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-medium mb-2">No scan results yet</h3>
            <p className="text-muted-foreground max-w-md mb-6">
              Run a health scan to check your stored credentials against known data breaches,
              analyze password strength, detect reused credentials, and get actionable recommendations.
            </p>
            <Button onClick={() => scanMutation.mutate()} disabled={scanMutation.isPending}>
              <Shield className="h-4 w-4 mr-2" />
              Run First Scan
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Scanning state */}
      {scanMutation.isPending && !scanData && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
            <h3 className="text-lg font-medium mb-2">Scanning credentials...</h3>
            <p className="text-muted-foreground">
              Checking against HaveIBeenPwned, analyzing strength, detecting duplicates...
            </p>
          </CardContent>
        </Card>
      )}

      {/* Scan Results */}
      {scanData && (
        <>
          {/* Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {/* Overall Score */}
            <Card className={`md:col-span-1 border ${getScoreBg(scanData.overallScore)}`}>
              <CardContent className="flex flex-col items-center justify-center py-6">
                <ScoreRing score={scanData.overallScore} />
                <p className="text-sm text-muted-foreground mt-2">Overall Health</p>
              </CardContent>
            </Card>

            {/* Stats */}
            <Card className="md:col-span-4">
              <CardContent className="py-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-red-500/10">
                      <ShieldX className="h-5 w-5 text-red-500" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{scanData.breachedCount}</p>
                      <p className="text-xs text-muted-foreground">Breached</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-orange-500/10">
                      <Unlock className="h-5 w-5 text-orange-500" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{scanData.weakCount}</p>
                      <p className="text-xs text-muted-foreground">Weak</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-yellow-500/10">
                      <Copy className="h-5 w-5 text-yellow-500" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{scanData.reusedCount}</p>
                      <p className="text-xs text-muted-foreground">Reused</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-500/10">
                      <Clock className="h-5 w-5 text-blue-500" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{scanData.oldCount}</p>
                      <p className="text-xs text-muted-foreground">Old (90+ days)</p>
                    </div>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-border">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {scanData.totalCredentials} credential(s) scanned
                    </span>
                    <span className="text-muted-foreground">
                      Last scan: {new Date(scanData.scannedAt).toLocaleString()}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recommendations */}
          {scanData.recommendations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-500" />
                  Recommendations
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {scanData.recommendations.map((rec, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm">
                      {rec.includes("breach") || rec.includes("Rotate") ? (
                        <XCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                      ) : rec.includes("healthy") || rec.includes("good") ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                      )}
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Credential List */}
          {scanData.results.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-3">Credential Details</h2>
              <div className="space-y-2">
                {scanData.results.map((result) => (
                  <CredentialRow key={result.credentialId} result={result} />
                ))}
              </div>
            </div>
          )}

          {scanData.results.length === 0 && (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <Lock className="h-12 w-12 text-muted-foreground/30 mb-3" />
                <h3 className="font-medium mb-1">No credentials stored</h3>
                <p className="text-sm text-muted-foreground">
                  Fetch some credentials first, then run a health scan to check their security.
                </p>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
