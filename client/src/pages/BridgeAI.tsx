import { Badge } from "@/components/ui/badge";
  import { Button } from "@/components/ui/button";
  import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
  import {
    Bot, Brain, Code2, ExternalLink, Globe, Search, Zap,
    ArrowRight, Check, Layers, Network,
  } from "lucide-react";

  const PROVIDERS = [
    {
      name: "ChatGPT",
      provider: "OpenAI",
      role: "Strategic Planning",
      description: "Breaks down goals into structured task plans, sets priorities and allocates work to specialised agents.",
      icon: Brain,
      color: "text-emerald-400",
      bg: "bg-emerald-500/10 border-emerald-500/20",
    },
    {
      name: "Claude",
      provider: "Anthropic",
      role: "Code Review",
      description: "Reviews deliverables for quality, correctness and edge-cases. Provides actionable critique before delivery.",
      icon: Code2,
      color: "text-violet-400",
      bg: "bg-violet-500/10 border-violet-500/20",
    },
    {
      name: "Replit Agent",
      provider: "Replit",
      role: "Build & Execute",
      description: "Writes, runs and iterates on code. Handles implementation tasks end-to-end in a live environment.",
      icon: Zap,
      color: "text-blue-400",
      bg: "bg-blue-500/10 border-blue-500/20",
    },
    {
      name: "Perplexity",
      provider: "Perplexity AI",
      role: "Research",
      description: "Performs real-time web research, fact-checks claims and surfaces up-to-date information for the team.",
      icon: Search,
      color: "text-amber-400",
      bg: "bg-amber-500/10 border-amber-500/20",
    },
    {
      name: "Gemini",
      provider: "Google",
      role: "UX & Design",
      description: "Evaluates user-facing experiences, suggests UI/UX improvements and crafts human-friendly copy.",
      icon: Globe,
      color: "text-sky-400",
      bg: "bg-sky-500/10 border-sky-500/20",
    },
    {
      name: "Manus",
      provider: "Manus AI",
      role: "Autonomous Agent",
      description: "Handles long-horizon autonomous tasks, persistent workflows and complex multi-step automation.",
      icon: Bot,
      color: "text-pink-400",
      bg: "bg-pink-500/10 border-pink-500/20",
    },
  ] as const;

  const FEATURES = [
    { icon: Layers, title: "Plug-and-play", body: "Connect any AI provider in seconds. No bespoke API glue needed." },
    { icon: Network, title: "Smart task routing", body: "Each task type is automatically routed to the best-suited model." },
    { icon: Check, title: "Built-in review loop", body: "Claude reviews every deliverable before it leaves the session." },
  ];

  const BRIDGE_AI_URL = import.meta.env.VITE_BRIDGE_AI_URL ?? "https://bridge-ai.replit.app";

  export default function BridgeAIPage() {
    return (
      <div className="max-w-5xl mx-auto space-y-10 pb-12">
        {/* Hero ───────────────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-4 pt-2">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 border border-blue-500/20">
              <Zap className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight leading-none">BridgeAI</h1>
              <p className="text-xs text-muted-foreground mt-1 uppercase tracking-widest">AI-to-AI Orchestration</p>
            </div>
            <Badge variant="secondary" className="ml-auto">Beta</Badge>
          </div>

          <p className="text-muted-foreground max-w-2xl leading-relaxed">
            BridgeAI is a plug-and-play orchestration layer that coordinates multiple AI providers
            around a shared session goal. Each model handles the task type it excels at — so you
            get strategic planning, code execution, research and review in one unified workflow.
          </p>

          <div className="flex flex-wrap gap-3">
            <Button
              size="lg"
              className="gap-2 bg-blue-600 hover:bg-blue-500"
              onClick={() => window.open(BRIDGE_AI_URL, "_blank", "noopener,noreferrer")}
            >
              <ExternalLink className="h-4 w-4" />
              Open BridgeAI
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="gap-2"
              onClick={() => window.open(`${BRIDGE_AI_URL}/sessions/new`, "_blank", "noopener,noreferrer")}
            >
              <ArrowRight className="h-4 w-4" />
              Start new session
            </Button>
          </div>
        </div>

        {/* Feature pills ──────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <Card key={title} className="bg-card/50 border-border/60">
              <CardContent className="pt-5 pb-4 flex gap-3">
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <Icon className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-sm leading-none mb-1.5">{title}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{body}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Provider grid ──────────────────────────────────────────────────── */}
        <div>
          <h2 className="text-base font-semibold mb-4">Supported AI Providers</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {PROVIDERS.map(({ name, provider, role, description, icon: Icon, color, bg }) => (
              <Card key={name} className={`border ${bg} bg-card/40 hover:bg-card/60 transition-colors`}>
                <CardHeader className="pb-2 pt-4 px-4">
                  <div className="flex items-center gap-2.5 mb-2">
                    <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${bg}`}>
                      <Icon className={`h-4 w-4 ${color}`} />
                    </div>
                    <div>
                      <CardTitle className="text-sm font-semibold leading-none">{name}</CardTitle>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{provider}</p>
                    </div>
                    <Badge variant="outline" className={`ml-auto text-[10px] px-1.5 py-0.5 ${color} border-current/30`}>
                      {role}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="px-4 pb-4 pt-0">
                  <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* CTA footer ─────────────────────────────────────────────────────── */}
        <Card className="border-blue-500/20 bg-blue-500/5">
          <CardContent className="flex flex-col sm:flex-row items-center gap-4 py-6 px-6">
            <div className="flex-1">
              <p className="font-semibold text-sm">Ready to orchestrate your AI team?</p>
              <p className="text-xs text-muted-foreground mt-1">
                Create a session, describe your goal, and let BridgeAI assign the right model to every task.
              </p>
            </div>
            <Button
              className="gap-2 shrink-0 bg-blue-600 hover:bg-blue-500"
              onClick={() => window.open(BRIDGE_AI_URL, "_blank", "noopener,noreferrer")}
            >
              <ExternalLink className="h-4 w-4" />
              Launch BridgeAI
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  