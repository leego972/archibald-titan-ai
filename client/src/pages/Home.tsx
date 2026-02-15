import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PlanBadge, UsageBar } from "@/components/UpgradePrompt";
import { useSubscription } from "@/hooks/useSubscription";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import {
  Bot,
  KeyRound,
  Shield,
  Zap,
  Globe,
  ArrowRight,
  Crown,
  TrendingUp,
  Activity,
  Server,
  GripVertical,
  Settings2,
  RotateCcw,
  Eye,
  EyeOff,
  Check,
  HeartPulse,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Clock,
  RefreshCw,
} from "lucide-react";
import { useLocation } from "wouter";
import { useState, useMemo, useCallback, useEffect } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { toast } from "sonner";

// ─── Widget Definitions ───────────────────────────────────────────

const WIDGET_IDS = [
  "usage_stats",
  "credential_health",
  "quick_actions",
  "feature_access",
  "providers",
] as const;

type WidgetId = (typeof WIDGET_IDS)[number];

const DEFAULT_ORDER: WidgetId[] = [...WIDGET_IDS];

const WIDGET_META: Record<WidgetId, { title: string; description: string }> = {
  usage_stats: { title: "Usage Stats", description: "Monthly fetches, credentials, proxy slots, and plan info" },
  credential_health: { title: "Credential Health", description: "Monitor expiring API keys and stale credentials" },
  quick_actions: { title: "Quick Actions", description: "Start a new fetch or view credentials" },
  feature_access: { title: "Feature Access", description: "Features available on your current plan" },
  providers: { title: "Supported Providers", description: "All cloud providers supported by Archibald Titan" },
};

// ─── Sortable Widget Wrapper ──────────────────────────────────────

function SortableWidget({
  id,
  children,
  isCustomizing,
}: {
  id: string;
  children: React.ReactNode;
  isCustomizing: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : ("auto" as any),
  };

  return (
    <div ref={setNodeRef} style={style} className="relative group">
      {isCustomizing && (
        <div
          {...attributes}
          {...listeners}
          className="absolute -left-2 top-1/2 -translate-y-1/2 z-10 p-1.5 rounded-md bg-primary/10 border border-primary/20 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <GripVertical className="h-4 w-4 text-primary" />
        </div>
      )}
      <div className={isCustomizing ? "ring-1 ring-primary/20 ring-dashed rounded-xl transition-all" : ""}>
        {children}
      </div>
    </div>
  );
}

// ─── Individual Widget Components ─────────────────────────────────

function UsageStatsWidget({ sub, setLocation }: { sub: any; setLocation: (path: string) => void }) {
  const stats = [
    {
      label: "Fetches This Month",
      icon: Activity,
      value: sub.fetchesUsed,
      limit: sub.fetchesLimit,
      color: "from-blue-500/20 to-blue-600/5",
      iconColor: "text-blue-400",
    },
    {
      label: "Credentials Stored",
      icon: KeyRound,
      value: sub.credentialsStored,
      limit: sub.credentialsRemaining === -1 ? -1 : sub.credentialsStored + sub.credentialsRemaining,
      color: "from-emerald-500/20 to-emerald-600/5",
      iconColor: "text-emerald-400",
    },
    {
      label: "Proxy Slots",
      icon: Server,
      value: sub.proxySlotsUsed,
      limit: sub.proxySlotLimit,
      color: "from-violet-500/20 to-violet-600/5",
      iconColor: "text-violet-400",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat) => (
        <Card key={stat.label} className="relative overflow-hidden">
          <div className={`absolute inset-0 bg-gradient-to-br ${stat.color} opacity-50`} />
          <CardHeader className="pb-2 relative">
            <div className="flex items-center justify-between">
              <CardDescription className="text-[10px] font-semibold uppercase tracking-widest">
                {stat.label}
              </CardDescription>
              <div className={`h-8 w-8 rounded-lg bg-white/5 flex items-center justify-center`}>
                <stat.icon className={`h-4 w-4 ${stat.iconColor}`} />
              </div>
            </div>
          </CardHeader>
          <CardContent className="relative">
            <div className="text-2xl font-bold">
              {stat.value}
              <span className="text-sm font-normal text-muted-foreground">
                {stat.limit === -1 ? " / ∞" : stat.limit === 0 ? " / 0" : ` / ${stat.limit}`}
              </span>
            </div>
            <UsageBar label="" used={stat.value} limit={stat.limit} className="mt-2" />
          </CardContent>
        </Card>
      ))}

      <Card className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-amber-500/20 to-amber-600/5 opacity-50" />
        <CardHeader className="pb-2 relative">
          <div className="flex items-center justify-between">
            <CardDescription className="text-[10px] font-semibold uppercase tracking-widest">
              Current Plan
            </CardDescription>
            <div className="h-8 w-8 rounded-lg bg-white/5 flex items-center justify-center">
              <TrendingUp className="h-4 w-4 text-amber-400" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="relative">
          <div className="text-2xl font-bold capitalize">{sub.planName}</div>
          <p className="text-xs text-muted-foreground mt-1">
            {sub.isFree
              ? "Basic features included"
              : sub.isPro
              ? "All core features unlocked"
              : "Full enterprise suite"}
          </p>
          {sub.isFree && (
            <Button
              variant="link"
              size="sm"
              className="px-0 text-amber-500 h-auto mt-1"
              onClick={() => setLocation("/pricing")}
            >
              View upgrade options →
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Credential Health Widget ─────────────────────────────────────

function CredentialHealthWidget({ setLocation }: { setLocation: (path: string) => void }) {
  const healthQuery = trpc.dashboard.credentialHealth.useQuery(undefined, {
    refetchOnWindowFocus: true,
    staleTime: 60_000,
  });

  const data = healthQuery.data;
  const isLoading = healthQuery.isLoading;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <HeartPulse className="h-4 w-4 text-primary" />
            Credential Health
          </CardTitle>
          <CardDescription>Checking credential status...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data || (data.totalCredentials === 0 && data.totalApiKeys === 0)) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <HeartPulse className="h-4 w-4 text-primary" />
            Credential Health
          </CardTitle>
          <CardDescription>Monitor expiring API keys and stale credentials</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6 text-muted-foreground">
            <Shield className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No credentials or API keys to monitor yet.</p>
            <p className="text-xs mt-1">Start a fetch or create an API key to see health status here.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const statusColor = {
    healthy: "text-emerald-500",
    warning: "text-amber-500",
    critical: "text-red-500",
  };

  const statusBg = {
    healthy: "bg-emerald-500/10 border-emerald-500/20",
    warning: "bg-amber-500/10 border-amber-500/20",
    critical: "bg-red-500/10 border-red-500/20",
  };

  const statusIcon = {
    healthy: <CheckCircle2 className="h-5 w-5 text-emerald-500" />,
    warning: <AlertTriangle className="h-5 w-5 text-amber-500" />,
    critical: <AlertCircle className="h-5 w-5 text-red-500" />,
  };

  const statusLabel = {
    healthy: "All Clear",
    warning: "Attention Needed",
    critical: "Action Required",
  };

  const itemStatusIcon = (status: string) => {
    switch (status) {
      case "expired":
        return <AlertCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />;
      case "expiring_soon":
        return <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />;
      case "expiring_warning":
        return <Clock className="h-3.5 w-3.5 text-yellow-500 shrink-0" />;
      default:
        return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />;
    }
  };

  const itemStatusLabel = (item: any) => {
    if (item.status === "expired") {
      return item.type === "api_key" ? "Expired" : "Stale (>90 days)";
    }
    if (item.status === "expiring_soon") {
      if (item.type === "api_key" && item.daysRemaining != null) {
        return `Expires in ${item.daysRemaining} day${item.daysRemaining !== 1 ? "s" : ""}`;
      }
      return item.type === "credential" ? "Aging (60-90 days)" : "Expiring soon";
    }
    if (item.status === "expiring_warning") {
      if (item.type === "api_key" && item.daysRemaining != null) {
        return `Expires in ${item.daysRemaining} days`;
      }
      return item.type === "credential" ? "Stale (>90 days)" : "Expiring within 30 days";
    }
    return "Healthy";
  };

  const attentionItems = [...data.expired, ...data.expiringSoon, ...data.expiringWarning];
  const totalItems = data.summary.expired + data.summary.expiringSoon + data.summary.expiringWarning + data.summary.healthy;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <HeartPulse className="h-4 w-4 text-primary" />
              Credential Health
            </CardTitle>
            <CardDescription className="mt-1">
              Monitoring {data.totalCredentials} credential{data.totalCredentials !== 1 ? "s" : ""} and {data.totalApiKeys} API key{data.totalApiKeys !== 1 ? "s" : ""}
            </CardDescription>
          </div>
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium ${statusBg[data.overallStatus]}`}>
            {statusIcon[data.overallStatus]}
            <span className={statusColor[data.overallStatus]}>{statusLabel[data.overallStatus]}</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary counters */}
        <div className="grid grid-cols-4 gap-3">
          <div className="text-center p-2 rounded-lg bg-red-500/5 border border-red-500/10">
            <div className="text-lg font-bold text-red-500">{data.summary.expired}</div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Expired</div>
          </div>
          <div className="text-center p-2 rounded-lg bg-amber-500/5 border border-amber-500/10">
            <div className="text-lg font-bold text-amber-500">{data.summary.expiringSoon}</div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Expiring Soon</div>
          </div>
          <div className="text-center p-2 rounded-lg bg-yellow-500/5 border border-yellow-500/10">
            <div className="text-lg font-bold text-yellow-500">{data.summary.expiringWarning}</div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Warning</div>
          </div>
          <div className="text-center p-2 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
            <div className="text-lg font-bold text-emerald-500">{data.summary.healthy}</div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Healthy</div>
          </div>
        </div>

        {/* Items needing attention */}
        {attentionItems.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Needs Attention</h4>
            <div className="space-y-1.5">
              {attentionItems.slice(0, 5).map((item: any) => (
                <div
                  key={item.id}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/30 border border-border/50 text-sm"
                >
                  {itemStatusIcon(item.status)}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{item.name}</div>
                    <div className="text-xs text-muted-foreground truncate">{item.identifier}</div>
                  </div>
                  <span className={`text-xs font-medium shrink-0 ${
                    item.status === "expired" ? "text-red-500" :
                    item.status === "expiring_soon" ? "text-amber-500" : "text-yellow-500"
                  }`}>
                    {itemStatusLabel(item)}
                  </span>
                </div>
              ))}
              {attentionItems.length > 5 && (
                <p className="text-xs text-muted-foreground text-center pt-1">
                  +{attentionItems.length - 5} more items need attention
                </p>
              )}
            </div>
          </div>
        )}

        {/* All healthy message */}
        {attentionItems.length === 0 && (
          <div className="text-center py-3">
            <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              All {totalItems} credential{totalItems !== 1 ? "s" : ""} and key{totalItems !== 1 ? "s" : ""} are in good health.
            </p>
          </div>
        )}

        {/* Quick actions */}
        <div className="flex items-center gap-2 pt-1">
          <Button
            variant="outline"
            size="sm"
            className="text-xs h-7"
            onClick={() => setLocation("/fetcher/credentials")}
          >
            <KeyRound className="h-3 w-3 mr-1" />
            View Credentials
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-xs h-7"
            onClick={() => setLocation("/api-access")}
          >
            <Shield className="h-3 w-3 mr-1" />
            Manage API Keys
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs h-7 ml-auto"
            onClick={() => healthQuery.refetch()}
          >
            <RefreshCw className={`h-3 w-3 mr-1 ${healthQuery.isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function QuickActionsWidget({ sub, setLocation }: { sub: any; setLocation: (path: string) => void }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Card
        className="hover:border-primary/30 transition-colors cursor-pointer"
        onClick={() => setLocation("/fetcher/new")}
      >
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Zap className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">Start a New Fetch</CardTitle>
              <CardDescription className="text-xs">
                {sub.fetchesRemaining === -1
                  ? "Unlimited fetches available"
                  : sub.fetchesRemaining > 0
                  ? `${sub.fetchesRemaining} fetches remaining this month`
                  : "Monthly limit reached — upgrade for more"}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      <Card
        className="hover:border-primary/30 transition-colors cursor-pointer"
        onClick={() => setLocation("/fetcher/credentials")}
      >
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <KeyRound className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">View Credentials</CardTitle>
              <CardDescription className="text-xs">
                {sub.credentialsStored > 0
                  ? `${sub.credentialsStored} credentials in your encrypted vault`
                  : "Your encrypted vault is empty — start a fetch to collect keys"}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>
    </div>
  );
}

function FeatureAccessWidget({ sub, setLocation }: { sub: any; setLocation: (path: string) => void }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Shield className="h-4 w-4 text-primary" />
          Feature Access
        </CardTitle>
        <CardDescription>Features available on your current plan</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[
            { name: "Basic Providers (AWS, Azure, GCP)", available: true },
            { name: "AES-256 Encrypted Vault", available: true },
            { name: "JSON Export", available: true },
            { name: "All 15+ Providers", available: sub.canUse("proxy_pool") },
            { name: "CAPTCHA Auto-Solving", available: sub.canUse("captcha_solving") },
            { name: "Kill Switch", available: sub.canUse("kill_switch") },
            { name: "Proxy Pool", available: sub.canUse("proxy_pool") },
            { name: ".ENV Export", available: sub.canUse("env_export") },
            { name: "CSV Export", available: sub.canUse("csv_export") },
            { name: "API Access", available: sub.canUse("api_access") },
            { name: "Team Management", available: sub.canUse("team_management") },
            { name: "Audit Logs", available: sub.canUse("audit_logs") },
          ].map((feature) => (
            <div
              key={feature.name}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
                feature.available
                  ? "bg-primary/5 text-foreground"
                  : "bg-muted/50 text-muted-foreground"
              }`}
            >
              {feature.available ? (
                <div className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              ) : (
                <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/30" />
              )}
              {feature.name}
            </div>
          ))}
        </div>
        {sub.isFree && (
          <div className="mt-4 pt-4 border-t">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setLocation("/pricing")}
              className="text-amber-500 border-amber-500/30 hover:bg-amber-500/10"
            >
              <Crown className="h-3.5 w-3.5 mr-1.5" />
              Unlock all features with Pro
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ProvidersWidget({ sub }: { sub: any }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Globe className="h-4 w-4 text-primary" />
          Supported Providers
        </CardTitle>
        <CardDescription>
          {sub.isFree
            ? "3 providers included on Free — upgrade for all 15+"
            : "All providers unlocked on your plan"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
          {[
            { name: "AWS", free: true },
            { name: "Azure", free: true },
            { name: "GCP", free: true },
            { name: "OpenAI", free: false },
            { name: "Anthropic", free: false },
            { name: "GitHub", free: false },
            { name: "Stripe", free: false },
            { name: "Cloudflare", free: false },
            { name: "Firebase", free: false },
            { name: "Twilio", free: false },
            { name: "SendGrid", free: false },
            { name: "Heroku", free: false },
            { name: "DigitalOcean", free: false },
            { name: "GoDaddy", free: false },
            { name: "Hugging Face", free: false },
          ].map((provider) => {
            const isLocked = sub.isFree && !provider.free;
            return (
              <div
                key={provider.name}
                className={`flex items-center justify-center p-2.5 rounded-lg border text-xs font-medium transition-colors ${
                  isLocked
                    ? "border-dashed border-muted-foreground/20 text-muted-foreground/50 bg-muted/30"
                    : "border-border bg-card text-card-foreground hover:bg-accent/50"
                }`}
              >
                {provider.name}
                {isLocked && <span className="ml-1 text-amber-500/60">🔒</span>}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Widget Renderer ──────────────────────────────────────────────

function renderWidget(
  id: WidgetId,
  sub: any,
  setLocation: (path: string) => void
) {
  switch (id) {
    case "usage_stats":
      return <UsageStatsWidget sub={sub} setLocation={setLocation} />;
    case "credential_health":
      return <CredentialHealthWidget setLocation={setLocation} />;
    case "quick_actions":
      return <QuickActionsWidget sub={sub} setLocation={setLocation} />;
    case "feature_access":
      return <FeatureAccessWidget sub={sub} setLocation={setLocation} />;
    case "providers":
      return <ProvidersWidget sub={sub} />;
    default:
      return null;
  }
}

// ─── Customize Panel ──────────────────────────────────────────────

function CustomizePanel({
  widgetOrder,
  hiddenWidgets,
  onToggleWidget,
  onReset,
  onDone,
}: {
  widgetOrder: WidgetId[];
  hiddenWidgets: WidgetId[];
  onToggleWidget: (id: WidgetId) => void;
  onReset: () => void;
  onDone: () => void;
}) {
  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Settings2 className="h-4 w-4 text-primary" />
            Customize Dashboard
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onReset} className="h-7 text-xs">
              <RotateCcw className="h-3 w-3 mr-1" />
              Reset
            </Button>
            <Button size="sm" onClick={onDone} className="h-7 text-xs">
              <Check className="h-3 w-3 mr-1" />
              Done
            </Button>
          </div>
        </div>
        <CardDescription className="text-xs">
          Drag widgets to reorder. Click the eye icon to show/hide widgets.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          {[...widgetOrder, ...hiddenWidgets.filter((h) => !widgetOrder.includes(h))].map((id) => {
            const meta = WIDGET_META[id];
            const isHidden = hiddenWidgets.includes(id);
            return (
              <button
                key={id}
                onClick={() => onToggleWidget(id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  isHidden
                    ? "border-dashed border-muted-foreground/30 text-muted-foreground/60 bg-muted/30"
                    : "border-primary/30 text-primary bg-primary/10"
                }`}
              >
                {isHidden ? (
                  <EyeOff className="h-3 w-3" />
                ) : (
                  <Eye className="h-3 w-3" />
                )}
                {meta?.title || id}
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────

export default function Home() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();
  const sub = useSubscription();
  const [isCustomizing, setIsCustomizing] = useState(false);

  // Load saved layout
  const layoutQuery = trpc.dashboard.getLayout.useQuery(undefined, {
    enabled: !!user,
  });

  // Save layout mutation
  const saveLayout = trpc.dashboard.saveLayout.useMutation({
    onSuccess: () => {
      layoutQuery.refetch();
    },
  });

  // Reset layout mutation
  const resetLayout = trpc.dashboard.resetLayout.useMutation({
    onSuccess: () => {
      layoutQuery.refetch();
    },
  });

  // Local state for widget order and hidden widgets
  const [widgetOrder, setWidgetOrder] = useState<WidgetId[]>(DEFAULT_ORDER);
  const [hiddenWidgets, setHiddenWidgets] = useState<WidgetId[]>([]);

  // Sync from server when data loads
  useEffect(() => {
    if (layoutQuery.data) {
      const validOrder = layoutQuery.data.widgetOrder.filter((id): id is WidgetId =>
        WIDGET_IDS.includes(id as WidgetId)
      );
      // Add any new widgets that aren't in the saved order
      const missing = DEFAULT_ORDER.filter((id) => !validOrder.includes(id));
      setWidgetOrder([...validOrder, ...missing]);
      setHiddenWidgets(
        (layoutQuery.data.hiddenWidgets || []).filter((id): id is WidgetId =>
          WIDGET_IDS.includes(id as WidgetId)
        )
      );
    }
  }, [layoutQuery.data]);

  // Visible widgets (order minus hidden)
  const visibleWidgets = useMemo(
    () => widgetOrder.filter((id) => !hiddenWidgets.includes(id)),
    [widgetOrder, hiddenWidgets]
  );

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      setWidgetOrder((prev) => {
        const oldIndex = prev.indexOf(active.id as WidgetId);
        const newIndex = prev.indexOf(over.id as WidgetId);
        return arrayMove(prev, oldIndex, newIndex);
      });
    },
    []
  );

  const handleToggleWidget = useCallback((id: WidgetId) => {
    setHiddenWidgets((prev) =>
      prev.includes(id) ? prev.filter((h) => h !== id) : [...prev, id]
    );
  }, []);

  const handleSave = useCallback(() => {
    setIsCustomizing(false);
    saveLayout.mutate({
      widgetOrder: widgetOrder,
      hiddenWidgets: hiddenWidgets,
    });
    toast.success("Dashboard layout saved");
  }, [widgetOrder, hiddenWidgets, saveLayout]);

  const handleReset = useCallback(() => {
    setWidgetOrder(DEFAULT_ORDER);
    setHiddenWidgets([]);
    resetLayout.mutate();
    setIsCustomizing(false);
    toast.success("Dashboard reset to default layout");
  }, [resetLayout]);

  return (
    <div className="space-y-8">
      {/* Header with Plan Badge */}
      <div className="flex items-center justify-between">
        <div className="space-y-1.5">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-white to-white/70 bg-clip-text text-transparent">Dashboard</h1>
            {user && <PlanBadge planId={sub.planId} />}
          </div>
          <p className="text-sm text-muted-foreground">
            {user
              ? `Welcome back, ${user.name || "there"}. Here's your usage overview.`
              : "Sign in to access Archibald Titan."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {user && !isCustomizing && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsCustomizing(true)}
              className="text-muted-foreground"
            >
              <Settings2 className="h-4 w-4 mr-1.5" />
              Customize
            </Button>
          )}
          {user && sub.isFree && (
            <Button
              onClick={() => setLocation("/pricing")}
              className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white"
            >
              <Crown className="h-4 w-4 mr-2" />
              Upgrade Plan
            </Button>
          )}
        </div>
      </div>

      {!user ? (
        /* Unauthenticated state */
        <div className="text-center space-y-6 py-12">
          <Bot className="h-16 w-16 text-primary mx-auto" />
          <div className="space-y-2">
            <h2 className="text-2xl font-bold">Get Started with Archibald Titan</h2>
            <p className="text-muted-foreground max-w-md mx-auto">
              Autonomously retrieve API keys and credentials from 15+ providers
              with encrypted vault storage.
            </p>
          </div>
          <Button
            size="lg"
            onClick={() => {
              window.location.href = getLoginUrl();
            }}
          >
            Sign in to Get Started
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      ) : (
        <>
          {/* Customize Panel */}
          {isCustomizing && (
            <CustomizePanel
              widgetOrder={widgetOrder}
              hiddenWidgets={hiddenWidgets}
              onToggleWidget={handleToggleWidget}
              onReset={handleReset}
              onDone={handleSave}
            />
          )}

          {/* Draggable Widget Grid */}
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={visibleWidgets}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-6">
                {visibleWidgets.map((id) => (
                  <SortableWidget key={id} id={id} isCustomizing={isCustomizing}>
                    {renderWidget(id, sub, setLocation)}
                  </SortableWidget>
                ))}
              </div>
            </SortableContext>
          </DndContext>

          {visibleWidgets.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <Settings2 className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">All widgets are hidden.</p>
              <Button
                variant="link"
                size="sm"
                onClick={() => setIsCustomizing(true)}
                className="mt-2"
              >
                Customize to show widgets
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
