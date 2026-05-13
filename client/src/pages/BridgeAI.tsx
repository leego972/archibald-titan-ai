import { useState } from "react";
  import { Badge } from "@/components/ui/badge";
  import { Button } from "@/components/ui/button";
  import { Card, CardContent } from "@/components/ui/card";
  import {
    Bot, Brain, Code2, ExternalLink, Globe, Search, Zap,
    ArrowRight, Maximize2, Minimize2, RefreshCw,
  } from "lucide-react";
  import { useSubscription } from "@/hooks/useSubscription";
  import { UpgradeBanner } from "@/components/UpgradePrompt";

  const BRIDGE_AI_URL =
    import.meta.env.VITE_BRIDGE_AI_URL ??
    "https://bridge-ai-app-production.up.railway.app";

  const PROVIDERS = [
    { name: "ChatGPT",      provider: "OpenAI",        role: "Strategic Planning", icon: Brain,  color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
    { name: "Claude",       provider: "Anthropic",     role: "Code Review",        icon: Code2,  color: "text-violet-400",  bg: "bg-violet-500/10 border-violet-500/20"  },
    { name: "Replit Agent", provider: "Replit",        role: "Build & Execute",    icon: Zap,    color: "text-blue-400",    bg: "bg-blue-500/10 border-blue-500/20"      },
    { name: "Perplexity",   provider: "Perplexity AI", role: "Research",           icon: Search, color: "text-amber-400",   bg: "bg-amber-500/10 border-amber-500/20"    },
    { name: "Gemini",       provider: "Google",        role: "UX & Design",        icon: Globe,  color: "text-sky-400",     bg: "bg-sky-500/10 border-sky-500/20"        },
    { name: "Manus",        provider: "Manus AI",      role: "Autonomous Agent",   icon: Bot,    color: "text-pink-400",    bg: "bg-pink-500/10 border-pink-500/20"      },
  ] as const;

  type ViewMode = "embed" | "launcher";

  export default function BridgeAIPage() {
    const { canUse, loading, planName } = useSubscription();
    const [view, setView] = useState<ViewMode>("embed");
    const [iframeKey, setIframeKey] = useState(0);
    const [fullscreen, setFullscreen] = useState(false);

    const hasAccess = canUse("bridge_ai");

    if (loading) {
      return (
        <div className="flex flex-col h-full min-h-0 items-center justify-center">
          <div className="h-8 w-8 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
        </div>
      );
    }

    if (!hasAccess) {
      return (
        <div className="flex flex-col h-full min-h-0">
          <div className="flex items-center gap-3 pb-6 shrink-0">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10 border border-blue-500/20">
              <Zap className="h-4 w-4 text-blue-400" />
            </div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold leading-none">BridgeAI</h1>
              <Badge variant="secondary" className="text-[10px]">Enterprise</Badge>
            </div>
            <Badge variant="outline" className="ml-auto text-xs text-muted-foreground capitalize">{planName}</Badge>
          </div>

          <div className="space-y-6 flex-1 overflow-y-auto pb-6">
            <UpgradeBanner
              feature="BridgeAI — Multi-Agent AI Orchestration"
              requiredPlan="enterprise"
              description="Coordinate GPT-4o, Claude, Gemini, Perplexity and more in a single unified session. Each model handles the task type it excels at — strategy, code review, research, and execution — saving you 40–60% on token costs versus running everything through one model."
            />

            <div className="opacity-40 pointer-events-none select-none">
              <h2 className="text-sm font-semibold mb-3">Supported AI Providers</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
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
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { icon: Brain,  color: "text-violet-400", bg: "bg-violet-500/10 border-violet-500/20", title: "Smart Routing",       desc: "Automatically assigns each task to the most capable — and cheapest — model available." },
                { icon: Zap,    color: "text-blue-400",   bg: "bg-blue-500/10 border-blue-500/20",     title: "40–60% Cost Savings", desc: "Multi-model sessions cost far less than running everything through GPT-4o or Claude alone." },
                { icon: Bot,    color: "text-emerald-400",bg: "bg-emerald-500/10 border-emerald-500/20",title: "Human-in-the-Loop",  desc: "Pause any agent run for your review before high-stakes actions are executed." },
              ].map(({ icon: Icon, color, bg, title, desc }) => (
                <Card key={title} className={`border ${bg} bg-card/40`}>
                  <CardContent className="pt-5 pb-5 px-5 flex flex-col gap-3">
                    <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${bg}`}>
                      <Icon className={`h-4 w-4 ${color}`} />
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
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10 border border-blue-500/20">
            <Zap className="h-4 w-4 text-blue-400" />
          </div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold leading-none">BridgeAI</h1>
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
                <Button size="sm" variant="ghost" onClick={() => setIframeKey(k => k + 1)} title="Reload BridgeAI">
                  <RefreshCw className="h-3.5 w-3.5" />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setFullscreen(f => !f)} title={fullscreen ? "Exit fullscreen" : "Fullscreen"}>
                  {fullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                </Button>
              </>
            )}

            <Button
              size="sm"
              className="gap-1.5 bg-blue-600 hover:bg-blue-500"
              onClick={() => window.open(BRIDGE_AI_URL, "_blank", "noopener,noreferrer")}
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Open in tab
            </Button>
          </div>
        </div>

        {view === "embed" && (
          <div className={`flex-1 min-h-0 rounded-xl overflow-hidden border border-border/60 shadow-lg ${fullscreen ? "fixed inset-0 z-50 rounded-none border-0" : ""}`}>
            {fullscreen && (
              <div className="absolute top-3 right-3 z-10 flex gap-2">
                <Button size="sm" variant="secondary" onClick={() => setFullscreen(false)}>
                  <Minimize2 className="h-3.5 w-3.5 mr-1" /> Exit Fullscreen
                </Button>
              </div>
            )}
            <iframe
              key={iframeKey}
              src={BRIDGE_AI_URL}
              title="BridgeAI"
              className="w-full h-full"
              style={{ minHeight: fullscreen ? "100vh" : "600px", border: "none" }}
              allow="clipboard-read; clipboard-write"
            />
          </div>
        )}

        {view === "launcher" && (
          <div className="flex-1 overflow-y-auto space-y-6 pb-6">
            <p className="text-sm text-muted-foreground max-w-2xl leading-relaxed">
              BridgeAI coordinates multiple AI providers around a shared session goal. Each model handles
              the task type it excels at — so you get strategic planning, code execution, research and
              review in one unified workflow, at a fraction of single-model cost.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button className="gap-2 bg-blue-600 hover:bg-blue-500" onClick={() => { setView("embed"); setIframeKey(k => k + 1); }}>
                <Zap className="h-4 w-4" /> Open in Dashboard
              </Button>
              <Button variant="outline" className="gap-2" onClick={() => window.open(`${BRIDGE_AI_URL}/sessions/new`, "_blank", "noopener,noreferrer")}>
                <ArrowRight className="h-4 w-4" /> Start new session
              </Button>
            </div>
            <div>
              <h2 className="text-sm font-semibold mb-3">Supported AI Providers</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
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
            </div>
            <Card className="border-blue-500/20 bg-blue-500/5">
              <CardContent className="flex flex-col sm:flex-row items-center gap-4 py-5 px-5">
                <div className="flex-1">
                  <p className="font-semibold text-sm">Ready to orchestrate your AI team?</p>
                  <p className="text-xs text-muted-foreground mt-1">Create a session, describe your goal, and let BridgeAI assign the right model to every task.</p>
                </div>
                <Button className="gap-2 shrink-0 bg-blue-600 hover:bg-blue-500" onClick={() => { setView("embed"); setIframeKey(k => k + 1); }}>
                  <Zap className="h-4 w-4" /> Launch BridgeAI
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    );
  }
  