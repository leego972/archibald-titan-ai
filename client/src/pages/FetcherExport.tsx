import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { Download, FileJson, FileText, FileSpreadsheet, Loader2, Lock, Crown } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useSubscription } from "@/hooks/useSubscription";
import { UpgradeDialog, PlanBadge } from "@/components/UpgradePrompt";

export default function FetcherExport() {
  const [format, setFormat] = useState<"json" | "env" | "csv">("json");
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [upgradeFeature, setUpgradeFeature] = useState("");
  const [upgradePlan, setUpgradePlan] = useState<"pro" | "enterprise">("pro");
  const sub = useSubscription();

  const { isLoading, refetch } = trpc.fetcher.exportCredentials.useQuery(
    { format },
    { enabled: false }
  );

  const handleExport = async (fmt: "json" | "env" | "csv") => {
    // Check plan access
    if (fmt === "env" && !sub.exportFormats.includes("env")) {
      setUpgradeFeature(".ENV Export");
      setUpgradePlan("pro");
      setShowUpgrade(true);
      return;
    }
    if (fmt === "csv" && !sub.exportFormats.includes("csv")) {
      setUpgradeFeature("CSV Export");
      setUpgradePlan("enterprise");
      setShowUpgrade(true);
      return;
    }

    setFormat(fmt);
    try {
      const result = await refetch();
      if (result.data) {
        const blob = new Blob([result.data], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download =
          fmt === "json"
            ? "credentials.json"
            : fmt === "env"
            ? "credentials.env"
            : "credentials.csv";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success(`Exported as ${fmt.toUpperCase()}`);
      }
    } catch (err: any) {
      if (err?.message?.includes("Upgrade to")) {
        setUpgradeFeature(err.message);
        setShowUpgrade(true);
      } else {
        toast.error("Export failed");
      }
    }
  };

  const formats = [
    {
      id: "json" as const,
      name: "JSON",
      icon: FileJson,
      description: "Structured JSON format with provider names, key types, and values. Ideal for programmatic use.",
      available: true,
      plan: "free" as const,
    },
    {
      id: "env" as const,
      name: ".ENV",
      icon: FileText,
      description: "Environment variable format. Copy directly into your .env file for immediate use.",
      available: sub.exportFormats.includes("env"),
      plan: "pro" as const,
    },
    {
      id: "csv" as const,
      name: "CSV",
      icon: FileSpreadsheet,
      description: "Spreadsheet-compatible format for bulk analysis, auditing, and team sharing.",
      available: sub.exportFormats.includes("csv"),
      plan: "enterprise" as const,
    },
  ];

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Export Credentials</h1>
        <p className="text-muted-foreground mt-1">
          Download your retrieved credentials in your preferred format.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {formats.map((fmt) => {
          const Icon = fmt.icon;
          const isLocked = !fmt.available;
          return (
            <Card
              key={fmt.id}
              className={`cursor-pointer transition-colors ${
                isLocked
                  ? "border-dashed border-muted-foreground/20 opacity-70"
                  : "hover:border-primary"
              }`}
              onClick={() => handleExport(fmt.id)}
            >
              <CardHeader className="text-center pb-3">
                <div className="relative mx-auto">
                  <Icon
                    className={`h-12 w-12 mx-auto mb-2 ${
                      isLocked ? "text-muted-foreground/40" : "text-primary"
                    }`}
                  />
                  {isLocked && (
                    <div className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-amber-500/10 flex items-center justify-center">
                      <Lock className="h-3 w-3 text-amber-500" />
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-center gap-2">
                  <CardTitle className="text-lg">{fmt.name}</CardTitle>
                  {fmt.plan !== "free" && (
                    <PlanBadge planId={fmt.plan} />
                  )}
                </div>
              </CardHeader>
              <CardContent className="text-center">
                <CardDescription>{fmt.description}</CardDescription>
                <Button
                  className={`mt-4 ${
                    isLocked
                      ? "bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white"
                      : ""
                  }`}
                  disabled={isLoading && format === fmt.id}
                >
                  {isLoading && format === fmt.id ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : isLocked ? (
                    <Crown className="h-4 w-4 mr-2" />
                  ) : (
                    <Download className="h-4 w-4 mr-2" />
                  )}
                  {isLocked ? "Unlock" : `Download ${fmt.name}`}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <UpgradeDialog
        open={showUpgrade}
        onOpenChange={setShowUpgrade}
        feature={upgradeFeature}
        requiredPlan={upgradePlan}
      />
    </div>
  );
}
