import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { Loader2, ShieldAlert, ShieldCheck, ShieldOff, RefreshCw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useSubscription } from "@/hooks/useSubscription";
import { UpgradeBanner, UpgradeDialog } from "@/components/UpgradePrompt";

export default function FetcherKillSwitch() {
  const { data: ks, isLoading, refetch } = trpc.fetcher.getKillSwitch.useQuery();
  const [code, setCode] = useState("");
  const [showUpgrade, setShowUpgrade] = useState(false);
  const sub = useSubscription();

  const activate = trpc.fetcher.activateKillSwitch.useMutation({
    onSuccess: () => {
      toast.success("Kill switch ACTIVATED. All automation halted.");
      setCode("");
      refetch();
    },
    onError: (err) => {
      if (err.message.includes("Upgrade to")) {
        setShowUpgrade(true);
      } else {
        toast.error(err.message);
      }
    },
  });

  const deactivate = trpc.fetcher.deactivateKillSwitch.useMutation({
    onSuccess: () => {
      toast.success("Kill switch deactivated. Automation resumed.");
      setCode("");
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const reset = trpc.fetcher.resetKillSwitch.useMutation({
    onSuccess: () => {
      toast.success("Kill switch code has been reset.");
      setCode("");
      refetch();
    },
    onError: (err) => {
      if (err.message.includes("Upgrade to")) {
        setShowUpgrade(true);
      } else {
        toast.error(err.message);
      }
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isActive = ks?.active;
  const isLocked = ks?.locked;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Kill Switch</h1>
        <p className="text-muted-foreground mt-1">
          Emergency control to halt all automation instantly.
        </p>
      </div>

      {/* Plan Gate */}
      {isLocked && (
        <UpgradeBanner
          feature="Kill Switch"
          requiredPlan="pro"
        />
      )}

      {/* Status Card */}
      <Card className={isActive ? "border-red-500 bg-red-50 dark:bg-red-950/20" : "border-green-500 bg-green-50 dark:bg-green-950/20"}>
        <CardContent className="flex items-center gap-4 py-6">
          {isActive ? (
            <ShieldAlert className="h-12 w-12 text-red-500 shrink-0" />
          ) : (
            <ShieldCheck className="h-12 w-12 text-green-500 shrink-0" />
          )}
          <div>
            <p className="text-lg font-semibold">
              {isActive ? "KILL SWITCH ACTIVE" : "Kill Switch Inactive"}
            </p>
            <p className="text-sm text-muted-foreground">
              {isActive
                ? "All automation is halted. No new jobs can be created. Enter your code to deactivate."
                : isLocked
                ? "Upgrade to Pro to enable the kill switch for emergency automation control."
                : "Automation is running normally. Enter your code to activate the kill switch."}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Code Display */}
      <Card className={isLocked ? "opacity-50 pointer-events-none" : ""}>
        <CardHeader>
          <CardTitle className="text-lg">Your Kill Switch Code</CardTitle>
          <CardDescription>
            This 10-character code is required to activate or deactivate the kill switch.
            Keep it safe.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-muted p-4 rounded-lg text-center">
            <code className="text-2xl font-mono font-bold tracking-widest">
              {isLocked ? "••••••••••" : ks?.code}
            </code>
          </div>
        </CardContent>
      </Card>

      {/* Action Card */}
      <Card className={isLocked ? "opacity-50 pointer-events-none" : ""}>
        <CardHeader>
          <CardTitle className="text-lg">
            {isActive ? "Deactivate Kill Switch" : "Activate Kill Switch"}
          </CardTitle>
          <CardDescription>
            Enter your kill switch code to {isActive ? "resume" : "halt"} all automation.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ks-code">Kill Switch Code</Label>
            <Input
              id="ks-code"
              placeholder="Enter your 10-character code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              maxLength={10}
              className="font-mono text-center text-lg tracking-wider"
              disabled={isLocked}
            />
          </div>
          <div className="flex gap-3">
            {isActive ? (
              <Button
                onClick={() => deactivate.mutate({ code })}
                disabled={deactivate.isPending || code.length !== 10 || isLocked}
                className="flex-1"
                variant="default"
              >
                {deactivate.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <ShieldCheck className="h-4 w-4 mr-2" />
                )}
                Deactivate
              </Button>
            ) : (
              <Button
                onClick={() => activate.mutate({ code })}
                disabled={activate.isPending || code.length !== 10 || isLocked}
                className="flex-1"
                variant="destructive"
              >
                {activate.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <ShieldOff className="h-4 w-4 mr-2" />
                )}
                Activate Kill Switch
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Reset */}
      <Card className={isLocked ? "opacity-50 pointer-events-none" : ""}>
        <CardHeader>
          <CardTitle className="text-lg">Reset Code</CardTitle>
          <CardDescription>
            Generate a new kill switch code. This will deactivate the current kill switch
            and create a new code.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            onClick={() => reset.mutate()}
            disabled={reset.isPending || isLocked}
          >
            {reset.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Reset Kill Switch Code
          </Button>
        </CardContent>
      </Card>

      {/* Upgrade Dialog */}
      <UpgradeDialog
        open={showUpgrade}
        onOpenChange={setShowUpgrade}
        feature="Kill Switch"
        description="The kill switch provides emergency control to instantly halt all automation. Essential for protecting your accounts."
        requiredPlan="pro"
      />
    </div>
  );
}
