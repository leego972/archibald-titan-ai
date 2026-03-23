/**
 * Titan Isolated Browser — ephemeral credit-metered browser sessions
 * Cyber+ and Titan plans only.
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import {
  Globe, Play, Square, Clock, Zap, Shield, Crown, Loader2,
  RefreshCw, AlertTriangle, CheckCircle, XCircle, Timer,
  Coins, History, Info, Lock,
} from "lucide-react";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDuration(minutes: number): string {
  const m = Math.floor(minutes);
  const s = Math.floor((minutes - m) * 60);
  return `${m}m ${s.toString().padStart(2, "0")}s`;
}

function statusBadge(status: string) {
  switch (status) {
    case "active":
      return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30"><CheckCircle className="w-3 h-3 mr-1" />Active</Badge>;
    case "ended":
      return <Badge className="bg-zinc-500/20 text-zinc-400 border-zinc-500/30"><XCircle className="w-3 h-3 mr-1" />Ended</Badge>;
    case "expired":
      return <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30"><Clock className="w-3 h-3 mr-1" />Expired</Badge>;
    case "credit_exhausted":
      return <Badge className="bg-red-500/20 text-red-400 border-red-500/30"><AlertTriangle className="w-3 h-3 mr-1" />Credits Exhausted</Badge>;
    default:
      return <Badge className="bg-zinc-500/20 text-zinc-400 border-zinc-500/30">{status}</Badge>;
  }
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function IsolatedBrowserPage() {
  const utils = trpc.useUtils();

  // ── Server data ──
  const { data: costInfo, isLoading: costLoading } = trpc.isolatedBrowser.getCostInfo.useQuery();
  const { data: sessionsData, refetch: refetchSessions } = trpc.isolatedBrowser.listSessions.useQuery();

  // ── Mutations ──
  const launchMutation = trpc.isolatedBrowser.launch.useMutation({
    onSuccess: (data) => {
      setActiveSessionId(data.sessionId);
      setSessionStatus("active");
      setElapsed(0);
      setCreditsConsumed(0);
      setCreditsRemaining(costInfo?.currentBalance ?? 0);
      toast.success("Isolated browser session launched.");
      refetchSessions();
    },
    onError: (err) => toast.error(err.message),
  });

  const heartbeatMutation = trpc.isolatedBrowser.heartbeat.useMutation({
    onSuccess: (data) => {
      setSessionStatus(data.status as any);
      setElapsed(data.elapsedMinutes);
      setCreditsConsumed(data.creditsConsumed);
      if (data.creditsRemaining !== undefined) setCreditsRemaining(data.creditsRemaining);
      if (data.status !== "active") {
        stopHeartbeat();
        refetchSessions();
        if (data.status === "credit_exhausted") {
          toast.error("Session terminated — credits exhausted.");
        } else if (data.status === "expired") {
          toast.warning("Session expired (max duration reached).");
        }
      }
    },
    onError: () => {
      // Heartbeat failed — session may be dead
    },
  });

  const endMutation = trpc.isolatedBrowser.end.useMutation({
    onSuccess: (data) => {
      toast.success(`Session ended — ${data.creditsConsumed} credits used over ${formatDuration(data.totalMinutes)}.`);
      setActiveSessionId(null);
      setSessionStatus(null);
      stopHeartbeat();
      refetchSessions();
      utils.isolatedBrowser.getCostInfo.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  // ── Local state ──
  const [url, setUrl] = useState("https://www.google.com");
  const [notes, setNotes] = useState("");
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [sessionStatus, setSessionStatus] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [creditsConsumed, setCreditsConsumed] = useState(0);
  const [creditsRemaining, setCreditsRemaining] = useState(0);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const localTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Heartbeat loop ──
  const stopHeartbeat = useCallback(() => {
    if (heartbeatRef.current) { clearInterval(heartbeatRef.current); heartbeatRef.current = null; }
    if (localTimerRef.current) { clearInterval(localTimerRef.current); localTimerRef.current = null; }
  }, []);

  const startHeartbeat = useCallback((sessionId: string) => {
    stopHeartbeat();
    // Local timer — update elapsed every second
    localTimerRef.current = setInterval(() => {
      setElapsed(prev => prev + (1 / 60));
    }, 1000);
    // Server heartbeat every 20 seconds
    heartbeatRef.current = setInterval(() => {
      heartbeatMutation.mutate({ sessionId });
    }, 20_000);
  }, [stopHeartbeat, heartbeatMutation]);

  useEffect(() => {
    if (activeSessionId && sessionStatus === "active") {
      startHeartbeat(activeSessionId);
    }
    return stopHeartbeat;
  }, [activeSessionId, sessionStatus]);

  useEffect(() => {
    return () => stopHeartbeat();
  }, []);

  // ── Handlers ──
  const handleLaunch = () => {
    if (!url.trim()) { toast.error("Enter a URL to launch."); return; }
    let finalUrl = url.trim();
    if (!finalUrl.startsWith("http://") && !finalUrl.startsWith("https://")) {
      finalUrl = "https://" + finalUrl;
    }
    launchMutation.mutate({ url: finalUrl, notes });
  };

  const handleEnd = () => {
    if (!activeSessionId) return;
    endMutation.mutate({ sessionId: activeSessionId });
  };

  // ── Tier gate ──
  if (costLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
      </div>
    );
  }

  if (!costInfo?.canAccess) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-16 text-center">
        <div className="flex justify-center mb-6">
          <div className="w-20 h-20 rounded-2xl bg-cyan-500/10 flex items-center justify-center">
            <Lock className="w-10 h-10 text-cyan-400" />
          </div>
        </div>
        <h1 className="text-3xl font-bold mb-3">Titan Isolated Browser</h1>
        <p className="text-muted-foreground text-lg mb-8 max-w-md mx-auto">
          Run ephemeral, isolated browser sessions in the cloud — no local exposure, no traces left behind.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8 text-left">
          {[
            { icon: Shield, color: "text-cyan-400", title: "Zero local exposure", desc: "Sessions run on remote infrastructure, not your machine." },
            { icon: Globe, color: "text-blue-400", title: "Ephemeral sessions", desc: "Every session is isolated and wiped on end." },
            { icon: Timer, color: "text-amber-400", title: "Credit-metered", desc: "Pay only for what you use — per minute, billed precisely." },
            { icon: Zap, color: "text-purple-400", title: "Integrated with Builder", desc: "Launch directly from Titan Builder, save outputs to storage." },
          ].map(({ icon: Icon, color, title, desc }) => (
            <div key={title} className="p-4 rounded-xl border border-border bg-card">
              <div className="flex items-center gap-2 mb-2">
                <Icon className={`w-4 h-4 ${color}`} />
                <span className="font-semibold text-sm">{title}</span>
              </div>
              <p className="text-xs text-muted-foreground">{desc}</p>
            </div>
          ))}
        </div>
        <div className="space-y-3">
          <div className="p-4 rounded-xl border border-cyan-600/30 bg-cyan-950/10 text-sm text-left">
            <div className="flex items-center gap-2 mb-2">
              <Crown className="w-4 h-4 text-cyan-400" />
              <span className="font-semibold text-cyan-400">Cyber+ — 50 credits/min</span>
            </div>
            <div className="flex items-center gap-2">
              <Crown className="w-4 h-4 text-amber-400" />
              <span className="font-semibold text-amber-400">Titan — 25 credits/min</span>
            </div>
          </div>
          <Button className="w-full bg-cyan-600 hover:bg-cyan-700 text-white py-5" onClick={() => window.location.href = "/pricing"}>
            <Crown className="w-4 h-4 mr-2" /> Upgrade to Cyber+ or Titan
          </Button>
        </div>
      </div>
    );
  }

  const isActive = sessionStatus === "active";
  const sessions = sessionsData?.sessions ?? [];

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">

      {/* ── Header ── */}
      <div className="flex items-center gap-4">
        <div className="h-12 w-12 rounded-xl bg-cyan-500/15 flex items-center justify-center">
          <Globe className="h-6 w-6 text-cyan-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Titan Isolated Browser</h1>
          <p className="text-muted-foreground text-sm">
            Ephemeral cloud browser sessions — {costInfo.creditsPerMinute} credits/min on your {costInfo.planId} plan
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Coins className="w-4 h-4 text-amber-400" />
          <span className="text-sm font-semibold">
            {costInfo.isUnlimited ? "Unlimited" : `${costInfo.currentBalance.toLocaleString()} credits`}
          </span>
        </div>
      </div>

      {/* ── Info bar ── */}
      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-card border border-border">
          <Timer className="w-3.5 h-3.5 text-cyan-400" />
          Max {costInfo.maxMinutes} min per session
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-card border border-border">
          <Coins className="w-3.5 h-3.5 text-amber-400" />
          {costInfo.creditsPerMinute} credits/min
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-card border border-border">
          <Shield className="w-3.5 h-3.5 text-emerald-400" />
          Isolated — no local exposure
        </div>
        {!costInfo.isUnlimited && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-card border border-border">
            <Info className="w-3.5 h-3.5 text-blue-400" />
            ~{costInfo.maxAffordableMinutes} min affordable at current balance
          </div>
        )}
      </div>

      {/* ── Active session panel ── */}
      {isActive && activeSessionId ? (
        <Card className="border-emerald-600/40 bg-emerald-950/10">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Session Active
              </CardTitle>
              {statusBadge("active")}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="p-3 rounded-lg bg-card border border-border">
                <p className="text-xs text-muted-foreground mb-1">Elapsed</p>
                <p className="text-lg font-mono font-bold text-emerald-400">{formatDuration(elapsed)}</p>
              </div>
              <div className="p-3 rounded-lg bg-card border border-border">
                <p className="text-xs text-muted-foreground mb-1">Credits Used</p>
                <p className="text-lg font-mono font-bold text-amber-400">{creditsConsumed.toLocaleString()}</p>
              </div>
              <div className="p-3 rounded-lg bg-card border border-border">
                <p className="text-xs text-muted-foreground mb-1">Credits Left</p>
                <p className="text-lg font-mono font-bold text-cyan-400">
                  {costInfo.isUnlimited ? "∞" : creditsRemaining.toLocaleString()}
                </p>
              </div>
            </div>

            {/* Session ID */}
            <div className="p-3 rounded-lg bg-card border border-border">
              <p className="text-xs text-muted-foreground mb-1">Session ID</p>
              <p className="text-xs font-mono text-foreground/70">{activeSessionId}</p>
            </div>

            {/* Warning when approaching limit */}
            {elapsed >= costInfo.maxMinutes * 0.8 && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-orange-950/20 border border-orange-600/30 text-orange-400 text-sm">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                Approaching session limit ({costInfo.maxMinutes} min max). Session will auto-terminate.
              </div>
            )}

            <Button
              variant="destructive"
              className="w-full"
              onClick={handleEnd}
              disabled={endMutation.isPending}
            >
              {endMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Square className="w-4 h-4 mr-2" />}
              End Session
            </Button>
          </CardContent>
        </Card>
      ) : sessionStatus && sessionStatus !== "active" ? (
        <Card className="border-zinc-600/30 bg-zinc-950/10">
          <CardContent className="p-4 flex items-center gap-3">
            {statusBadge(sessionStatus)}
            <p className="text-sm text-muted-foreground">
              {sessionStatus === "credit_exhausted"
                ? "Session was terminated due to insufficient credits."
                : sessionStatus === "expired"
                  ? "Session reached the maximum duration and was automatically terminated."
                  : "Session ended."}
            </p>
            <Button size="sm" variant="outline" className="ml-auto" onClick={() => setSessionStatus(null)}>
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> New Session
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {/* ── Launch form ── */}
      {!isActive && (
        <Card className="border-border bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Play className="w-4 h-4 text-cyan-400" />
              Launch New Session
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Starting URL</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    value={url}
                    onChange={e => setUrl(e.target.value)}
                    placeholder="https://example.com"
                    className="pl-9"
                    onKeyDown={e => e.key === "Enter" && handleLaunch()}
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Session opens at this URL. You can navigate freely within the session.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Notes <span className="text-muted-foreground font-normal">(optional)</span></label>
              <Input
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="e.g. Checking phishing site, OSINT research..."
                maxLength={200}
              />
            </div>

            {/* Cost preview */}
            <div className="p-3 rounded-lg bg-muted/30 border border-border text-sm">
              <div className="flex justify-between text-muted-foreground mb-1">
                <span>Cost per minute</span>
                <span className="font-semibold text-foreground">{costInfo.creditsPerMinute} credits</span>
              </div>
              <div className="flex justify-between text-muted-foreground mb-1">
                <span>Max session</span>
                <span className="font-semibold text-foreground">{costInfo.maxMinutes} min</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Max cost</span>
                <span className="font-semibold text-amber-400">
                  {(costInfo.creditsPerMinute * costInfo.maxMinutes).toLocaleString()} credits
                </span>
              </div>
            </div>

            <Button
              className="w-full bg-cyan-600 hover:bg-cyan-700 text-white"
              onClick={handleLaunch}
              disabled={launchMutation.isPending || !url.trim()}
            >
              {launchMutation.isPending
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Launching...</>
                : <><Play className="w-4 h-4 mr-2" /> Launch Isolated Session</>
              }
            </Button>

            <p className="text-xs text-muted-foreground text-center">
              Sessions are billed per minute. Credits are deducted in real time.
              Session auto-terminates at {costInfo.maxMinutes} min or when credits run out.
            </p>
          </CardContent>
        </Card>
      )}

      {/* ── How it works ── */}
      {!isActive && (
        <Card className="border-border bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Info className="w-4 h-4 text-blue-400" />
              How Titan Isolated Browser Works
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
              {[
                {
                  step: "1",
                  icon: Globe,
                  color: "text-cyan-400",
                  bg: "bg-cyan-500/10",
                  title: "Remote session",
                  desc: "Your browsing runs on Titan's cloud infrastructure, not your local machine.",
                },
                {
                  step: "2",
                  icon: Shield,
                  color: "text-emerald-400",
                  bg: "bg-emerald-500/10",
                  title: "Isolated & ephemeral",
                  desc: "Each session is sandboxed. When you end it, everything is wiped — no cookies, no history.",
                },
                {
                  step: "3",
                  icon: Coins,
                  color: "text-amber-400",
                  bg: "bg-amber-500/10",
                  title: "Credit-metered",
                  desc: `${costInfo.creditsPerMinute} credits per minute. End the session any time to stop billing.`,
                },
              ].map(({ step, icon: Icon, color, bg, title, desc }) => (
                <div key={step} className="flex flex-col gap-2">
                  <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center`}>
                    <Icon className={`w-4 h-4 ${color}`} />
                  </div>
                  <p className="font-semibold">{title}</p>
                  <p className="text-muted-foreground text-xs leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Session history ── */}
      {sessions.length > 0 && (
        <Card className="border-border bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <History className="w-4 h-4 text-muted-foreground" />
              Recent Sessions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {sessions.slice(0, 10).map((s) => (
                <div key={s.id} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/20 text-sm">
                  <div className="flex-1 min-w-0">
                    <p className="font-mono text-xs text-muted-foreground truncate">{s.url}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {new Date(s.startedAt).toLocaleString()} · {formatDuration(s.elapsedMinutes)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-amber-400 font-semibold">{s.creditsConsumed} cr</span>
                    {statusBadge(s.status)}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

    </div>
  );
}
