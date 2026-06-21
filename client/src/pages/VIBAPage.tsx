import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Bot,
  Brain,
  Code2,
  ExternalLink,
  Globe,
  Search,
  Zap,
  ArrowRight,
  Maximize2,
  Minimize2,
  RefreshCw,
  Loader2,
  AlertCircle,
  ShieldCheck,
  Bug,
} from "lucide-react";
import { useSubscription } from "@/hooks/useSubscription";
import { openExternalUrl } from "@/lib/desktop";
import { UpgradeBanner } from "@/components/UpgradePrompt";

// beta7 is the rebranded VIBA / BridgeAI orchestration feature.
// Backwards compatibility: VITE_BRIDGE_AI_URL remains supported while the Railway service/envs are renamed.
const BETA7_URL: string | null =
  import.meta.env.VITE_BETA7_URL ?? import.meta.env.VITE_BRIDGE_AI_URL ?? null;

const PROVIDERS = [
  { name: "ChatGPT", provider: "OpenAI", role: "Strategic Planning", icon: Brain, color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
  { name: "Claude", provider: "Anthropic", role: "Code Review", icon: Code2, color: "text-violet-400", bg: "bg-violet-500/10 border-violet-500/20" },
  { name: "Replit Agent", provider: "Replit", role: "Build & Execute", icon: Zap, color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20" },
  { name: "Perplexity", provider: "Perplexity AI", role: "Research", icon: Search, color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20" },
  { name: "Gemini", provider: "Google", role: "UX & Design", icon: Globe, color: "text-sky-400", bg: "bg-sky-500/10 border-sky-500/20" },
  { name: "Manus", provider: "Manus AI", role: "Autonomous Agent", icon: Bot, color: "text-pink-400", bg: "bg-pink-500/10 border-pink-500/20" },
] as const;

const BETA7_CAPABILITIES = [
  { title: "Multi-agent orchestration", desc: "Routes planning, review, build, research and UX tasks to the right AI role instead of forcing one model to do everything.", icon: Brain },
  { title: "Beta-testing workflow", desc: "Uses the Zippyfixer-style beta-test concept: scan, log, reproduce, classify, report, then repair only when the user has paid access.", icon: Bug },
  { title: "Approval-gated execution", desc: "High-risk actions such as deploy, merge, file deletion, credentials, auth, billing and database changes require explicit approval.", icon: ShieldCheck },
] as const;

type ViewMode = "embed" | "launcher";

export default function VIBAPage() {
  const { canUse, loading, planName } = useSubscription();
  const [view, setView] = useState<ViewMode>("embed");
  const [iframeKey, setIframeKey] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [iframeLoading, setIframeLoading] = useState(true);
  const [iframeError, setIframeError] = useState(false);

  // Existing enterprise feature flag retained so current subscription logic does not break.
  const hasAccess = canUse("bridge_ai");

  function handleIframeLoad() {
    setIframeLoading(false);
    setIframeError(false);
  }

  function handleIframeError() {
    setIframeLoading(false);
    setIframeError(true);
  }

  function reloadIframe() {
    setIframeLoading(true);
    setIframeError(false);
    setIframeKey((k) => k + 1);
  }

  if (loading) {
    return (
      <div className="flex flex-col h-full min-h-0 items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!BETA7_URL) {
    return (
      <div className="flex flex-col h-full min-h-0 items-center justify-center gap-4 p-8 text-center">
        <img src="/beta7-logo.svg" alt="beta7" className="h-20 w-20 rounded-2xl shadow-lg" />
        <div>
          <p className="font-semibold text-sm">beta7 service URL not configured</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm leading-relaxed">
            Set <code className="bg-white/5 px-1 rounded text-amber-300">VITE_BETA7_URL</code> in Railway to your deployed beta7 orchestration service URL.
            <br />
            Backwards compatibility: <code className="bg-white/5 px-1 rounded text-amber-300">VITE_BRIDGE_AI_URL</code> is still accepted during migration.
          </p>
        </div>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="flex flex-col h-full min-h-0">
        <div className="flex items-center gap-3 pb-6 shrink-0">
          <img src="/beta7-logo.svg" alt="beta7" className="h-10 w-10 rounded-xl" />
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold leading-none">beta7 — Multi-Agent Build & Beta-Test Orchestrator</h1>
            <Badge variant="secondary" className="text-[10px]">Pro</Badge>
          </div>
          <Badge variant="outline" className="ml-auto text-xs text-muted-foreground capitalize">{planName}</Badge>
        </div>

        <div className="space-y-6 flex-1 overflow-y-auto pb-6">
          <UpgradeBanner
            feature="beta7 — Multi-Agent Build & Beta-Test Orchestration"
            requiredPlan="enterprise"
            description="Coordinate multiple AI agents for planning, code review, build execution, research, UX checks and beta-test reporting. Trial users can inspect and report; repair, deploy, commit and pull-request actions remain locked behind paid access."
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 opacity-50 pointer-events-none select-none">
            {PROVIDERS.map(({ name, provider, role, icon: Icon, color, bg }) => (
              <Card key={name} className={`border ${bg} bg-card/40`}>
                <CardContent className="pt-4 pb-4 px-4 flex items-center gap-3">
                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${bg}`}>
                    <Icon className={`h-4 w-4 ${color}`} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold leading-none">{name}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{provider} · {role}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {BETA7_CAPABILITIES.map(({ icon: Icon, title, desc }) => (
              <Card key={title} className="border bg-card/40">
                <CardContent className="pt-5 pb-5 px-5 flex flex-col gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/10 border border-blue-500/20">
                    <Icon className="h-4 w-4 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{title}</p>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{desc}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center gap-3 pb-3 shrink-0 flex-wrap">
        <img src="/beta7-logo.svg" alt="beta7" className="h-10 w-10 rounded-xl" />
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-bold leading-none">beta7 — Multi-Agent Build & Beta-Test Orchestrator</h1>
          <Badge variant="secondary" className="text-[10px]">Beta</Badge>
        </div>

        <div className="ml-auto flex items-center gap-2 flex-wrap">
          <div className="flex rounded-md border overflow-hidden text-xs">
            <button
              onClick={() => setView("embed")}
              className={`px-3 py-1.5 transition-colors ${view === "embed" ? "bg-primary text-primary-foreground" : "bg-transparent text-muted-foreground hover:bg-muted"}`}
            >
              Embedded
            </button>
            <button
              onClick={() => setView("launcher")}
              className={`px-3 py-1.5 transition-colors ${view === "launcher" ? "bg-primary text-primary-foreground" : "bg-transparent text-muted-foreground hover:bg-muted"}`}
            >
              Overview
            </button>
          </div>

          {view === "embed" && (
            <>
              <Button size="sm" variant="ghost" onClick={reloadIframe} title="Reload beta7" disabled={iframeLoading}>
                {iframeLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setFullscreen((f) => !f)} title={fullscreen ? "Exit fullscreen" : "Fullscreen"}>
                {fullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
              </Button>
            </>
          )}

          <Button size="sm" className="gap-1.5 bg-blue-600 hover:bg-blue-500" onClick={() => openExternalUrl(BETA7_URL)}>
            <ExternalLink className="h-3.5 w-3.5" />
            Open in tab
          </Button>
        </div>
      </div>

      {view === "embed" && (
        <div className={`relative flex-1 min-h-0 rounded-xl overflow-hidden border border-border/60 shadow-lg ${fullscreen ? "fixed inset-0 z-50 rounded-none border-0" : ""}`}>
          {iframeLoading && !iframeError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/80 backdrop-blur-sm z-10">
              <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
              <p className="text-sm text-muted-foreground">Loading beta7…</p>
            </div>
          )}

          {iframeError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-background z-10 p-6 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10 border border-red-500/20">
                <AlertCircle className="h-6 w-6 text-red-400" />
              </div>
              <div>
                <p className="font-semibold text-sm">beta7 failed to load</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                  The app could not be embedded. This is usually a browser security policy such as CSP or X-Frame-Options.
                </p>
              </div>
              <div className="flex gap-2 flex-wrap justify-center">
                <Button size="sm" variant="outline" onClick={reloadIframe}>
                  <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Try again
                </Button>
                <Button size="sm" className="bg-blue-600 hover:bg-blue-500 gap-1.5" onClick={() => openExternalUrl(BETA7_URL)}>
                  <ExternalLink className="h-3.5 w-3.5" /> Open in new tab
                </Button>
              </div>
            </div>
          )}

          {fullscreen && (
            <div className="absolute top-3 right-3 z-20 flex gap-2">
              <Button size="sm" variant="secondary" onClick={() => setFullscreen(false)}>
                <Minimize2 className="h-3.5 w-3.5 mr-1" /> Exit Fullscreen
              </Button>
            </div>
          )}

          <iframe
            key={iframeKey}
            src={BETA7_URL}
            className="w-full h-full border-0"
            title="beta7 Multi-Agent Build and Beta-Test Orchestrator"
            allow="clipboard-read; clipboard-write; microphone"
            onLoad={handleIframeLoad}
            onError={handleIframeError}
          />
        </div>
      )}

      {view === "launcher" && (
        <div className="flex-1 overflow-y-auto pb-6 space-y-6">
          <p className="text-sm text-muted-foreground">
            beta7 is the rebranded VIBA / BridgeAI feature source: multi-agent orchestration combined with Zippyfixer-style scan, beta-test, log and report workflows.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {PROVIDERS.map(({ name, provider, role, icon: Icon, color, bg }) => (
              <Card key={name} className={`border ${bg} bg-card/50 cursor-pointer hover:bg-card/80 transition-colors`} onClick={() => { setView("embed"); reloadIframe(); }}>
                <CardContent className="pt-4 pb-4 px-4 flex items-center gap-3">
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${bg}`}>
                    <Icon className={`h-4 w-4 ${color}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold leading-none">{name}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{provider} · {role}</p>
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {BETA7_CAPABILITIES.map(({ icon: Icon, title, desc }) => (
              <Card key={title} className="border bg-card/40">
                <CardContent className="pt-5 pb-5 px-5 flex flex-col gap-3">
                  <Icon className="h-5 w-5 text-blue-400" />
                  <p className="text-sm font-semibold">{title}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="flex justify-center pt-2">
            <Button className="bg-blue-600 hover:bg-blue-500 gap-2" onClick={() => setView("embed")}>
              <Zap className="h-4 w-4" /> Launch beta7
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
