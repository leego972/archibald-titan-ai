/**
 * Titan Isolated Browser v2.0
 *
 * Upgrades:
 *  - Live screenshot viewport via SSE stream
 *  - Interactive browser chrome: address bar, back/forward/reload, scroll
 *  - Click-to-interact: click on the viewport to send clicks to the real browser
 *  - Device profile selector
 *  - Screenshot gallery with save & download
 *  - Session status bar with credits, elapsed time, page title
 *  - Proxy server input
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
  Globe, Play, Square, Clock, Zap, Shield, Crown, Loader2,
  RefreshCw, AlertTriangle, CheckCircle, XCircle, Timer,
  Coins, History, Info, Lock, ArrowLeft, ArrowRight, Camera,
  Download, Monitor, ChevronDown, ChevronUp, Keyboard,
  MousePointer, Image as ImageIcon, Settings, Wifi,
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

// ─── Live Viewport Component ──────────────────────────────────────────────────

interface ViewportProps {
  sessionId: string;
  onUrlChange: (url: string) => void;
  onTitleChange: (title: string) => void;
  onNavigate: (url: string) => void;
  onBack: () => void;
  onForward: () => void;
  onReload: () => void;
  onClick: (x: number, y: number) => void;
  onScroll: (direction: "up" | "down") => void;
  currentUrl: string;
  pageTitle: string;
  isNavigating: boolean;
}

function LiveViewport({
  sessionId, onUrlChange, onTitleChange, onNavigate, onBack, onForward, onReload,
  onClick, onScroll, currentUrl, pageTitle, isNavigating,
}: ViewportProps) {
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [urlInput, setUrlInput] = useState(currentUrl);
  const [showTypeInput, setShowTypeInput] = useState(false);
  const [typeText, setTypeText] = useState("");
  const imgRef = useRef<HTMLImageElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Sync URL input with external changes
  useEffect(() => {
    setUrlInput(currentUrl);
  }, [currentUrl]);

  // Connect to SSE stream
  useEffect(() => {
    if (!sessionId) return;
    const es = new EventSource(`/api/isolated-browser/stream/${sessionId}`);
    eventSourceRef.current = es;

    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "connected") {
          setConnected(true);
          if (data.lastScreenshot) setScreenshot(data.lastScreenshot);
          if (data.url) { setUrlInput(data.url); onUrlChange(data.url); }
          if (data.title) onTitleChange(data.title);
        } else if (data.type === "screenshot") {
          setScreenshot(data.data);
          if (data.url) { setUrlInput(data.url); onUrlChange(data.url); }
          if (data.title) onTitleChange(data.title);
        } else if (data.type === "session_ended") {
          setConnected(false);
        }
      } catch { /* ignore parse errors */ }
    };

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, [sessionId]);

  const handleViewportClick = useCallback((e: React.MouseEvent<HTMLImageElement>) => {
    if (!imgRef.current) return;
    const rect = imgRef.current.getBoundingClientRect();
    const naturalW = imgRef.current.naturalWidth || 1920;
    const naturalH = imgRef.current.naturalHeight || 1080;
    const scaleX = naturalW / rect.width;
    const scaleY = naturalH / rect.height;
    const x = Math.round((e.clientX - rect.left) * scaleX);
    const y = Math.round((e.clientY - rect.top) * scaleY);
    onClick(x, y);
  }, [onClick]);

  const handleUrlKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      let url = urlInput.trim();
      if (!url.startsWith("http://") && !url.startsWith("https://")) url = "https://" + url;
      onNavigate(url);
    }
  };

  const handleTypeSubmit = () => {
    if (!typeText.trim()) return;
    // We'll use the parent's type mutation via a custom event
    window.dispatchEvent(new CustomEvent("titan-browser-type", { detail: { text: typeText, pressEnter: true } }));
    setTypeText("");
    setShowTypeInput(false);
  };

  return (
    <div className="flex flex-col rounded-xl border border-border overflow-hidden bg-zinc-950">
      {/* Browser Chrome */}
      <div className="flex items-center gap-1.5 px-3 py-2 bg-zinc-900 border-b border-border">
        {/* Traffic lights */}
        <div className="flex gap-1.5 mr-2">
          <div className="w-3 h-3 rounded-full bg-red-500/70" />
          <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
          <div className="w-3 h-3 rounded-full bg-green-500/70" />
        </div>
        {/* Nav buttons */}
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onBack}><ArrowLeft className="w-3.5 h-3.5" /></Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onForward}><ArrowRight className="w-3.5 h-3.5" /></Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onReload}>
          {isNavigating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
        </Button>
        {/* Address bar */}
        <div className="flex-1 flex items-center gap-1.5 px-3 py-1 rounded-md bg-zinc-800 border border-zinc-700">
          <Shield className="w-3 h-3 text-emerald-400 shrink-0" />
          <input
            className="flex-1 bg-transparent text-xs text-foreground outline-none min-w-0"
            value={urlInput}
            onChange={e => setUrlInput(e.target.value)}
            onKeyDown={handleUrlKeyDown}
            placeholder="https://example.com"
          />
        </div>
        {/* Connection indicator */}
        <div className={`w-2 h-2 rounded-full shrink-0 ${connected ? "bg-emerald-400 animate-pulse" : "bg-zinc-600"}`} />
      </div>

      {/* Page title bar */}
      {pageTitle && (
        <div className="px-3 py-1 bg-zinc-900/50 border-b border-border/50 text-xs text-muted-foreground truncate">
          {pageTitle}
        </div>
      )}

      {/* Viewport */}
      <div className="relative bg-zinc-950 min-h-[500px] flex items-center justify-center">
        {screenshot ? (
          <img
            ref={imgRef}
            src={`data:image/jpeg;base64,${screenshot}`}
            alt="Browser viewport"
            className="w-full h-auto cursor-crosshair select-none"
            onClick={handleViewportClick}
            draggable={false}
          />
        ) : (
          <div className="flex flex-col items-center gap-3 text-muted-foreground">
            <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
            <p className="text-sm">Connecting to browser...</p>
          </div>
        )}

        {/* Scroll controls overlay */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex flex-col gap-1">
          <Button
            variant="secondary"
            size="icon"
            className="h-8 w-8 opacity-70 hover:opacity-100"
            onClick={() => onScroll("up")}
          >
            <ChevronUp className="w-4 h-4" />
          </Button>
          <Button
            variant="secondary"
            size="icon"
            className="h-8 w-8 opacity-70 hover:opacity-100"
            onClick={() => onScroll("down")}
          >
            <ChevronDown className="w-4 h-4" />
          </Button>
        </div>

        {/* Type input overlay */}
        {showTypeInput && (
          <div className="absolute bottom-4 left-4 right-4 flex gap-2 bg-zinc-900/95 p-3 rounded-xl border border-border shadow-xl">
            <Input
              autoFocus
              value={typeText}
              onChange={e => setTypeText(e.target.value)}
              placeholder="Type text to send to the browser..."
              className="flex-1 text-sm"
              onKeyDown={e => e.key === "Enter" && handleTypeSubmit()}
            />
            <Button size="sm" onClick={handleTypeSubmit}>Send</Button>
            <Button size="sm" variant="ghost" onClick={() => setShowTypeInput(false)}>Cancel</Button>
          </div>
        )}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 bg-zinc-900 border-t border-border">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs gap-1.5"
          onClick={() => setShowTypeInput(v => !v)}
        >
          <Keyboard className="w-3.5 h-3.5" />
          Type
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs gap-1.5"
          onClick={() => onScroll("down")}
        >
          <ChevronDown className="w-3.5 h-3.5" />
          Scroll Down
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs gap-1.5"
          onClick={() => onScroll("up")}
        >
          <ChevronUp className="w-3.5 h-3.5" />
          Scroll Up
        </Button>
        <div className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
          <MousePointer className="w-3 h-3" />
          Click viewport to interact
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function IsolatedBrowserPage() {
  const utils = trpc.useUtils();

  // ── Server data ──
  const { data: costInfo, isLoading: costLoading } = trpc.isolatedBrowser.getCostInfo.useQuery();
  const { data: sessionsData, refetch: refetchSessions } = trpc.isolatedBrowser.listSessions.useQuery();
  const { data: profilesData } = trpc.isolatedBrowser.getDeviceProfiles.useQuery();

  // ── Mutations ──
  const launchMutation = trpc.isolatedBrowser.launch.useMutation({
    onSuccess: (data) => {
      setActiveSessionId(data.sessionId);
      setSessionStatus("active");
      setElapsed(0);
      setCreditsConsumed(0);
      setCreditsRemaining(costInfo?.currentBalance ?? 0);
      setCurrentUrl(data.url);
      setPageTitle("");
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
      if (data.url) setCurrentUrl(data.url);
      if (data.title) setPageTitle(data.title);
      if (data.status !== "active") {
        stopHeartbeat();
        refetchSessions();
        if (data.status === "credit_exhausted") toast.error("Session terminated — credits exhausted.");
        else if (data.status === "expired") toast.warning("Session expired (max duration reached).");
      }
    },
    onError: () => { /* heartbeat failed */ },
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

  const navigateMutation = trpc.isolatedBrowser.navigate.useMutation({
    onSuccess: (data) => {
      if (data.url) setCurrentUrl(data.url);
      if (data.title) setPageTitle(data.title);
      setIsNavigating(false);
    },
    onError: (err) => { toast.error(err.message); setIsNavigating(false); },
  });

  const clickMutation = trpc.isolatedBrowser.click.useMutation({
    onError: (err) => toast.error(`Click failed: ${err.message}`),
  });

  const typeMutation = trpc.isolatedBrowser.type.useMutation({
    onError: (err) => toast.error(`Type failed: ${err.message}`),
  });

  const scrollMutation = trpc.isolatedBrowser.scroll.useMutation({
    onError: (err) => toast.error(`Scroll failed: ${err.message}`),
  });

  const goBackMutation = trpc.isolatedBrowser.goBack.useMutation({
    onSuccess: (data) => { if (data.url) setCurrentUrl(data.url); setIsNavigating(false); },
    onError: (err) => { toast.error(err.message); setIsNavigating(false); },
  });

  const goForwardMutation = trpc.isolatedBrowser.goForward.useMutation({
    onSuccess: (data) => { if (data.url) setCurrentUrl(data.url); setIsNavigating(false); },
    onError: (err) => { toast.error(err.message); setIsNavigating(false); },
  });

  const reloadMutation = trpc.isolatedBrowser.reload.useMutation({
    onSuccess: () => setIsNavigating(false),
    onError: (err) => { toast.error(err.message); setIsNavigating(false); },
  });

  const screenshotMutation = trpc.isolatedBrowser.takeScreenshot.useMutation({
    onSuccess: (data) => {
      toast.success("Screenshot saved!");
      setScreenshots(prev => [...prev, { ...data, takenAt: new Date().toISOString() }]);
    },
    onError: (err) => toast.error(err.message),
  });

  // ── Local state ──
  const [url, setUrl] = useState("https://www.google.com");
  const [notes, setNotes] = useState("");
  const [deviceProfile, setDeviceProfile] = useState("random");
  const [proxyServer, setProxyServer] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [sessionStatus, setSessionStatus] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [creditsConsumed, setCreditsConsumed] = useState(0);
  const [creditsRemaining, setCreditsRemaining] = useState(0);
  const [currentUrl, setCurrentUrl] = useState("");
  const [pageTitle, setPageTitle] = useState("");
  const [isNavigating, setIsNavigating] = useState(false);
  const [screenshots, setScreenshots] = useState<Array<{ key: string; url: string; takenAt: string; label?: string }>>([]);
  const [screenshotLabel, setScreenshotLabel] = useState("");
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const localTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Heartbeat loop ──
  const stopHeartbeat = useCallback(() => {
    if (heartbeatRef.current) { clearInterval(heartbeatRef.current); heartbeatRef.current = null; }
    if (localTimerRef.current) { clearInterval(localTimerRef.current); localTimerRef.current = null; }
  }, []);

  const startHeartbeat = useCallback((sessionId: string) => {
    stopHeartbeat();
    localTimerRef.current = setInterval(() => {
      setElapsed(prev => prev + (1 / 60));
    }, 1000);
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

  // Listen for type events from the viewport component
  useEffect(() => {
    const handler = (e: Event) => {
      const { text, pressEnter } = (e as CustomEvent).detail;
      if (activeSessionId) typeMutation.mutate({ sessionId: activeSessionId, text, pressEnter });
    };
    window.addEventListener("titan-browser-type", handler);
    return () => window.removeEventListener("titan-browser-type", handler);
  }, [activeSessionId, typeMutation]);

  // ── Handlers ──
  const handleLaunch = () => {
    if (!url.trim()) { toast.error("Enter a URL to launch."); return; }
    let finalUrl = url.trim();
    if (!finalUrl.startsWith("http://") && !finalUrl.startsWith("https://")) finalUrl = "https://" + finalUrl;
    launchMutation.mutate({
      url: finalUrl,
      notes,
      deviceProfile,
      proxyServer: proxyServer.trim() || undefined,
    });
  };

  const handleEnd = () => {
    if (!activeSessionId) return;
    endMutation.mutate({ sessionId: activeSessionId });
  };

  const handleNavigate = (navUrl: string) => {
    if (!activeSessionId) return;
    setIsNavigating(true);
    navigateMutation.mutate({ sessionId: activeSessionId, url: navUrl });
  };

  const handleClick = (x: number, y: number) => {
    if (!activeSessionId) return;
    clickMutation.mutate({ sessionId: activeSessionId, x, y });
  };

  const handleScroll = (direction: "up" | "down") => {
    if (!activeSessionId) return;
    scrollMutation.mutate({ sessionId: activeSessionId, direction });
  };

  const handleBack = () => {
    if (!activeSessionId) return;
    setIsNavigating(true);
    goBackMutation.mutate({ sessionId: activeSessionId });
  };

  const handleForward = () => {
    if (!activeSessionId) return;
    setIsNavigating(true);
    goForwardMutation.mutate({ sessionId: activeSessionId });
  };

  const handleReload = () => {
    if (!activeSessionId) return;
    setIsNavigating(true);
    reloadMutation.mutate({ sessionId: activeSessionId });
  };

  const handleTakeScreenshot = () => {
    if (!activeSessionId) return;
    screenshotMutation.mutate({ sessionId: activeSessionId, label: screenshotLabel || undefined });
    setScreenshotLabel("");
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
          Run ephemeral, isolated browser sessions in the cloud — live viewport, full interactivity, no local exposure.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8 text-left">
          {[
            { icon: Monitor, color: "text-cyan-400", title: "Live viewport", desc: "See the real browser render in real-time via screenshot stream." },
            { icon: Globe, color: "text-blue-400", title: "Full interactivity", desc: "Click, type, scroll, navigate — full browser control from your dashboard." },
            { icon: Camera, color: "text-purple-400", title: "Screenshot gallery", desc: "Save and download screenshots from any point in your session." },
            { icon: Shield, color: "text-emerald-400", title: "Stealth profiles", desc: "Windows/Mac/Linux × Chrome/Firefox/Safari — undetectable automation." },
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
  const profiles = profilesData?.profiles ?? [];

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-4">

      {/* ── Header ── */}
      <div className="flex items-center gap-4">
        <div className="h-12 w-12 rounded-xl bg-cyan-500/15 flex items-center justify-center">
          <Globe className="h-6 w-6 text-cyan-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Titan Isolated Browser</h1>
          <p className="text-muted-foreground text-sm">
            Live cloud browser sessions — {costInfo.creditsPerMinute} credits/min on your {costInfo.planId} plan
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Coins className="w-4 h-4 text-amber-400" />
          <span className="text-sm font-semibold">
            {costInfo.isUnlimited ? "Unlimited" : `${costInfo.currentBalance.toLocaleString()} credits`}
          </span>
        </div>
      </div>

      {/* ── Info pills ── */}
      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
        {[
          { icon: Timer, color: "text-cyan-400", label: `Max ${costInfo.maxMinutes} min` },
          { icon: Coins, color: "text-amber-400", label: `${costInfo.creditsPerMinute} credits/min` },
          { icon: Shield, color: "text-emerald-400", label: "Isolated & ephemeral" },
          { icon: Monitor, color: "text-blue-400", label: "Live viewport" },
          { icon: Camera, color: "text-purple-400", label: "Screenshot gallery" },
        ].map(({ icon: Icon, color, label }) => (
          <div key={label} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-card border border-border">
            <Icon className={`w-3.5 h-3.5 ${color}`} />
            {label}
          </div>
        ))}
      </div>

      {/* ── Session ended banner ── */}
      {sessionStatus && sessionStatus !== "active" && (
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
      )}

      {/* ── Active session layout ── */}
      {isActive && activeSessionId ? (
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-4">

          {/* Left: viewport */}
          <div className="space-y-3">
            {/* Status bar */}
            <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl border border-emerald-600/30 bg-emerald-950/10">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-sm font-medium text-emerald-400">Session Active</span>
              <div className="flex gap-4 ml-auto text-xs">
                <span className="text-muted-foreground">
                  <span className="font-mono font-bold text-emerald-400">{formatDuration(elapsed)}</span> elapsed
                </span>
                <span className="text-muted-foreground">
                  <span className="font-mono font-bold text-amber-400">{creditsConsumed.toLocaleString()}</span> credits used
                </span>
                <span className="text-muted-foreground">
                  <span className="font-mono font-bold text-cyan-400">
                    {costInfo.isUnlimited ? "∞" : creditsRemaining.toLocaleString()}
                  </span> remaining
                </span>
              </div>
            </div>

            {/* Warning */}
            {elapsed >= costInfo.maxMinutes * 0.8 && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-orange-950/20 border border-orange-600/30 text-orange-400 text-sm">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                Approaching session limit ({costInfo.maxMinutes} min max). Session will auto-terminate.
              </div>
            )}

            {/* Live viewport */}
            <LiveViewport
              sessionId={activeSessionId}
              onUrlChange={setCurrentUrl}
              onTitleChange={setPageTitle}
              onNavigate={handleNavigate}
              onBack={handleBack}
              onForward={handleForward}
              onReload={handleReload}
              onClick={handleClick}
              onScroll={handleScroll}
              currentUrl={currentUrl}
              pageTitle={pageTitle}
              isNavigating={isNavigating}
            />
          </div>

          {/* Right: controls panel */}
          <div className="space-y-3">
            {/* End session */}
            <Button
              variant="destructive"
              className="w-full"
              onClick={handleEnd}
              disabled={endMutation.isPending}
            >
              {endMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Square className="w-4 h-4 mr-2" />}
              End Session
            </Button>

            {/* Tabs: Screenshot / Session Info */}
            <Tabs defaultValue="screenshot">
              <TabsList className="w-full">
                <TabsTrigger value="screenshot" className="flex-1 text-xs">
                  <Camera className="w-3.5 h-3.5 mr-1.5" />Screenshots
                </TabsTrigger>
                <TabsTrigger value="info" className="flex-1 text-xs">
                  <Info className="w-3.5 h-3.5 mr-1.5" />Session Info
                </TabsTrigger>
              </TabsList>

              <TabsContent value="screenshot" className="mt-3 space-y-3">
                {/* Take screenshot */}
                <div className="space-y-2">
                  <Input
                    value={screenshotLabel}
                    onChange={e => setScreenshotLabel(e.target.value)}
                    placeholder="Screenshot label (optional)"
                    className="text-sm"
                  />
                  <Button
                    className="w-full bg-purple-600 hover:bg-purple-700 text-white"
                    onClick={handleTakeScreenshot}
                    disabled={screenshotMutation.isPending}
                  >
                    {screenshotMutation.isPending
                      ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      : <Camera className="w-4 h-4 mr-2" />
                    }
                    Save Screenshot
                  </Button>
                </div>

                {/* Gallery */}
                {screenshots.length > 0 ? (
                  <ScrollArea className="h-64">
                    <div className="space-y-2">
                      {screenshots.map((s, i) => (
                        <div key={s.key} className="flex items-center gap-2 p-2 rounded-lg border border-border bg-muted/20 text-xs">
                          <ImageIcon className="w-4 h-4 text-purple-400 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{s.label || `Screenshot ${i + 1}`}</p>
                            <p className="text-muted-foreground">{new Date(s.takenAt).toLocaleTimeString()}</p>
                          </div>
                          <a href={s.url} target="_blank" rel="noopener noreferrer">
                            <Button variant="ghost" size="icon" className="h-6 w-6">
                              <Download className="w-3 h-3" />
                            </Button>
                          </a>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                ) : (
                  <p className="text-xs text-muted-foreground text-center py-4">No screenshots saved yet</p>
                )}
              </TabsContent>

              <TabsContent value="info" className="mt-3 space-y-2">
                {[
                  { label: "Session ID", value: activeSessionId.slice(0, 24) + "..." },
                  { label: "Device Profile", value: launchMutation.data?.deviceProfile ?? "—" },
                  { label: "Max Duration", value: `${costInfo.maxMinutes} min` },
                  { label: "Cost Rate", value: `${costInfo.creditsPerMinute} credits/min` },
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between text-xs p-2 rounded-lg bg-muted/20 border border-border">
                    <span className="text-muted-foreground">{label}</span>
                    <span className="font-mono text-foreground/80 truncate max-w-[150px]">{value}</span>
                  </div>
                ))}
              </TabsContent>
            </Tabs>
          </div>
        </div>
      ) : !sessionStatus ? (
        /* ── Launch form ── */
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
          <div className="space-y-4">
            <Card className="border-border bg-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Play className="w-4 h-4 text-cyan-400" />
                  Launch New Session
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* URL */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Starting URL</label>
                  <div className="relative">
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

                {/* Device profile */}
                <div className="space-y-2">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <Monitor className="w-4 h-4 text-blue-400" />
                    Device Profile
                  </label>
                  <Select value={deviceProfile} onValueChange={setDeviceProfile}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select device profile" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="random">Random (recommended)</SelectItem>
                      {profiles.map(p => (
                        <SelectItem key={p.name} value={p.name}>
                          {p.name} — {p.viewport.width}×{p.viewport.height}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">Choose the browser fingerprint to use for this session.</p>
                </div>

                {/* Notes */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Notes <span className="text-muted-foreground font-normal">(optional)</span></label>
                  <Input
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="e.g. OSINT research, checking phishing site..."
                    maxLength={200}
                  />
                </div>

                {/* Advanced */}
                <div>
                  <button
                    type="button"
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    onClick={() => setShowAdvanced(v => !v)}
                  >
                    <Settings className="w-3.5 h-3.5" />
                    Advanced options
                    {showAdvanced ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>
                  {showAdvanced && (
                    <div className="mt-3 space-y-3 p-3 rounded-lg bg-muted/20 border border-border">
                      <div className="space-y-2">
                        <label className="text-sm font-medium flex items-center gap-2">
                          <Wifi className="w-4 h-4 text-orange-400" />
                          Proxy Server <span className="text-muted-foreground font-normal">(optional)</span>
                        </label>
                        <Input
                          value={proxyServer}
                          onChange={e => setProxyServer(e.target.value)}
                          placeholder="http://user:pass@proxy.example.com:8080"
                          className="font-mono text-xs"
                        />
                        <p className="text-xs text-muted-foreground">Route this session through a proxy or VPN endpoint.</p>
                      </div>
                    </div>
                  )}
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
                    ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Launching browser...</>
                    : <><Play className="w-4 h-4 mr-2" /> Launch Isolated Session</>
                  }
                </Button>

                <p className="text-xs text-muted-foreground text-center">
                  Sessions are billed per minute. Credits are deducted in real time.
                  Session auto-terminates at {costInfo.maxMinutes} min or when credits run out.
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Right: how it works */}
          <div className="space-y-4">
            <Card className="border-border bg-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Info className="w-4 h-4 text-blue-400" />
                  What's New in v2.0
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 text-sm">
                  {[
                    { icon: Monitor, color: "text-cyan-400", bg: "bg-cyan-500/10", title: "Live viewport", desc: "Real Playwright browser renders pages and streams screenshots every 2.5 seconds." },
                    { icon: MousePointer, color: "text-blue-400", bg: "bg-blue-500/10", title: "Click to interact", desc: "Click anywhere on the viewport to send real mouse clicks to the browser." },
                    { icon: Keyboard, color: "text-purple-400", bg: "bg-purple-500/10", title: "Type & navigate", desc: "Type text, press Enter, navigate to any URL — full keyboard control." },
                    { icon: Camera, color: "text-amber-400", bg: "bg-amber-500/10", title: "Screenshot gallery", desc: "Save screenshots to cloud storage and download them at any time." },
                    { icon: Shield, color: "text-emerald-400", bg: "bg-emerald-500/10", title: "Stealth profiles", desc: "8 device profiles — Windows/Mac/Linux × Chrome/Firefox/Safari/Edge." },
                  ].map(({ icon: Icon, color, bg, title, desc }) => (
                    <div key={title} className="flex gap-3">
                      <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center shrink-0`}>
                        <Icon className={`w-4 h-4 ${color}`} />
                      </div>
                      <div>
                        <p className="font-semibold text-sm">{title}</p>
                        <p className="text-muted-foreground text-xs leading-relaxed">{desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      ) : null}

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
                    <p className="font-mono text-xs text-muted-foreground truncate">{s.currentUrl || s.url}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {new Date(s.startedAt).toLocaleString()} · {formatDuration(s.elapsedMinutes)}
                      {s.deviceProfile && <span className="ml-2 text-blue-400/70">{s.deviceProfile}</span>}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {s.screenshotCount > 0 && (
                      <span className="text-xs text-purple-400/70">
                        <Camera className="w-3 h-3 inline mr-0.5" />{s.screenshotCount}
                      </span>
                    )}
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
