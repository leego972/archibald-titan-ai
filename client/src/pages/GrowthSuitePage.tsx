import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { BarChart3, Brain, CheckCircle2, DollarSign, Globe, Lightbulb, Loader2, Megaphone, Target, Zap } from "lucide-react";

function PriorityBadge({ priority }: { priority: string }) {
  const cls = priority === "critical"
    ? "border-red-600/40 text-red-400"
    : priority === "high"
      ? "border-orange-600/40 text-orange-400"
      : priority === "medium"
        ? "border-yellow-600/40 text-yellow-400"
        : "border-zinc-600/40 text-zinc-400";
  return <Badge variant="outline" className={cls}>{priority}</Badge>;
}

function LoadingCard() {
  return (
    <Card className="border-border bg-card">
      <CardContent className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-cyan-400" />
      </CardContent>
    </Card>
  );
}

export default function GrowthSuitePage() {
  const [budget, setBudget] = useState(500);
  const [audience, setAudience] = useState("startup CTOs");

  const dashboard = trpc.growthSuite.getDashboard.useQuery();
  const seoPlan = trpc.growthSuite.getSeoPlan.useQuery();
  const adPlan = trpc.growthSuite.getAdvertisingPlan.useQuery({ monthlyBudget: budget });
  const ideas = trpc.growthSuite.getCampaignIdeas.useQuery({ audience });
  const actions = trpc.growthSuite.getActions.useQuery();
  const channels = trpc.growthSuite.getChannels.useQuery();

  const data = dashboard.data;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Brain className="h-6 w-6 text-purple-400" />
            Growth Suite
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            SEO, GEO, content, advertising, affiliate, conversion, and analytics execution plan.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className="border-emerald-600/40 text-emerald-400">
            <CheckCircle2 className="mr-1 h-3 w-3" /> Connected
          </Badge>
          {data && <Badge variant="outline">Score {data.score}/100</Badge>}
        </div>
      </div>

      {!data ? <LoadingCard /> : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <Card className="border-border bg-card">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground"><Target className="h-4 w-4 text-cyan-400" /> Growth Score</div>
              <div className="mt-1 text-3xl font-bold">{data.score}</div>
            </CardContent>
          </Card>
          <Card className="border-border bg-card">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground"><Globe className="h-4 w-4 text-emerald-400" /> Free Channels</div>
              <div className="mt-1 text-3xl font-bold">{data.channelMix.free}</div>
            </CardContent>
          </Card>
          <Card className="border-border bg-card">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground"><DollarSign className="h-4 w-4 text-yellow-400" /> Low-cost Channels</div>
              <div className="mt-1 text-3xl font-bold">{data.channelMix.lowCost}</div>
            </CardContent>
          </Card>
          <Card className="border-border bg-card">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground"><Zap className="h-4 w-4 text-purple-400" /> Top Priorities</div>
              <div className="mt-1 text-3xl font-bold">{data.priorities.length}</div>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="priorities" className="space-y-4">
        <TabsList className="flex h-auto flex-wrap gap-1">
          <TabsTrigger value="priorities">Priorities</TabsTrigger>
          <TabsTrigger value="seo">SEO Plan</TabsTrigger>
          <TabsTrigger value="ads">Ads Budget</TabsTrigger>
          <TabsTrigger value="campaigns">Campaign Ideas</TabsTrigger>
          <TabsTrigger value="channels">Channels</TabsTrigger>
        </TabsList>

        <TabsContent value="priorities" className="space-y-3">
          {(actions.data ?? data?.priorities ?? []).map((action: any) => (
            <Card key={action.id} className="border-border bg-card">
              <CardContent className="pt-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold">{action.title}</h3>
                      <PriorityBadge priority={action.priority} />
                      <Badge variant="outline">{action.area}</Badge>
                      <Badge variant="outline">score {action.score}</Badge>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">{action.expectedOutcome}</p>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
                  <div>
                    <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Implementation</p>
                    <ul className="space-y-1 text-sm text-muted-foreground">
                      {action.implementation.map((item: string) => <li key={item}>• {item}</li>)}
                    </ul>
                  </div>
                  <div>
                    <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Free / cheap path</p>
                    <p className="text-sm text-muted-foreground">{action.freeOrCheapPath}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="seo" className="space-y-3">
          {!seoPlan.data ? <LoadingCard /> : (
            <>
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                {seoPlan.data.pillars.map((pillar: any) => (
                  <Card key={pillar.pillar} className="border-border bg-card">
                    <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Globe className="h-4 w-4 text-cyan-400" />{pillar.pillar}</CardTitle></CardHeader>
                    <CardContent>
                      <Badge variant="outline">{pillar.intent}</Badge>
                      <p className="mt-3 text-xs font-semibold uppercase text-muted-foreground">Pages</p>
                      <p className="text-sm text-muted-foreground">{pillar.pages.join(" · ")}</p>
                      <p className="mt-3 text-xs font-semibold uppercase text-muted-foreground">Keywords</p>
                      <p className="text-sm text-muted-foreground">{pillar.keywords.join(", ")}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
              <Card className="border-border bg-card">
                <CardHeader><CardTitle className="text-sm">Technical checklist</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  {seoPlan.data.technicalChecklist.map((item: string) => <div key={item} className="flex gap-2 text-sm text-muted-foreground"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />{item}</div>)}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="ads" className="space-y-3">
          <Card className="border-border bg-card">
            <CardContent className="pt-4">
              <label className="text-sm font-medium">Monthly test budget</label>
              <Input type="number" className="mt-2 max-w-xs" value={budget} min={0} max={100000} onChange={(e) => setBudget(Number(e.target.value || 0))} />
            </CardContent>
          </Card>
          {!adPlan.data ? <LoadingCard /> : (
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {adPlan.data.allocation.map((bucket: any) => (
                <Card key={bucket.bucket} className="border-border bg-card">
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-semibold">{bucket.bucket}</h3>
                      <Badge variant="outline">${bucket.amount}</Badge>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">{bucket.rationale}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="campaigns" className="space-y-3">
          <Card className="border-border bg-card"><CardContent className="pt-4"><label className="text-sm font-medium">Audience</label><Input className="mt-2 max-w-sm" value={audience} onChange={(e) => setAudience(e.target.value)} /></CardContent></Card>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
            {(ideas.data?.ideas ?? []).map((idea: any) => (
              <Card key={idea.title} className="border-border bg-card">
                <CardContent className="pt-4">
                  <Lightbulb className="mb-2 h-5 w-5 text-yellow-400" />
                  <h3 className="font-semibold">{idea.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{idea.hook}</p>
                  <div className="mt-3 flex flex-wrap gap-2"><Badge variant="outline">{idea.format}</Badge><Badge variant="outline">{idea.cta}</Badge></div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="channels" className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {(channels.data ?? []).map((channel: any) => (
            <Card key={channel.channel} className="border-border bg-card">
              <CardContent className="pt-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Megaphone className="h-4 w-4 text-cyan-400" />
                  <h3 className="font-semibold">{channel.channel}</h3>
                  <Badge variant="outline">{channel.type}</Badge>
                  <Badge variant="outline">{channel.cost}</Badge>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{channel.role}</p>
                <p className="mt-3 text-xs font-semibold uppercase text-muted-foreground">Setup</p>
                <ul className="mt-1 space-y-1 text-sm text-muted-foreground">
                  {channel.setup.map((step: string) => <li key={step}>• {step}</li>)}
                </ul>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
